const { pool } = require("../../config/db");
const buildMissingRows = require("../../utils/buildMissingRows");

/* -------------------------------------------------------- *
 * GET /files/dashboard/missing-bank-statements
 * curl -H "Cookie: fp_jwt=$JWT" "http://localhost:5103/files/dashboard/missing-bank-statements" 
 * curl -H "Cookie: fp_jwt=$JWT" "http://localhost:5103/files/dashboard/missing-bank-statements?fund_id=3"
 * -------------------------------------------------------- */
exports.missingBankStatements = async (req, res) => {
  try {
    /* -------- 1. optional fund filter -------------------- */
    const fundId = req.query.fund_id ? Number(req.query.fund_id) : null;

    const params = [];
    let where = "";
    if (fundId) {
      params.push(fundId);
      where = `WHERE fl.fund_id = $${params.length}`;
    }

    /* -------- 2. fetch distinct “YYYY‑MM” that exist ------ */
    const { rows: existing } = await pool.query(
      `
      SELECT fl.fund_id,
             fl.fund_category            AS fund_name,
             TO_CHAR(fs.statement_date, 'YYYY-MM')   AS snapshot_month
      FROM   public.fund_statement   fs
      JOIN   public.v_fund_lookup    fl ON fl.fund_name = fs.fund_name
      ${where}
      GROUP  BY fl.fund_id, fl.fund_category, snapshot_month
      `,
      params
    );

    /* map id → name once for later annotation */
    const nameById = Object.fromEntries(
      existing.map(({ fund_id, fund_name }) => [fund_id, fund_name])
    );

    /* -------- 3. build the gap rows ---------------------- */
    const rows = buildMissingRows(existing).map((r) => ({
      ...r,
      fund_name: nameById[r.fund_id],
    }));

    res.json({ rows });
  } catch (err) {
    console.error("[files] missingBankStatements:", err);
    res.status(500).json({ error: err.message });
  }
};

/* -------------------------------------------------------- *
 * GET /files/dashboard/investor-snapshot-months
 * curl -H "Cookie: fp_jwt=$JWT" "http://localhost:5103/files/dashboard/investor-snapshot-months"
 * curl -H "Cookie: fp_jwt=$JWT" "http://localhost:5103/files/dashboard/investor-snapshot-months?fund_id=3"
 * -------------------------------------------------------- */
exports.missingInvestorStatements = async (req, res) => {
  try {
    const fundId = req.query.fund_id ? Number(req.query.fund_id) : null;

    const params = [];
    let where = "";
    if (fundId) {
      params.push(fundId);
      where = `WHERE fl.fund_id = $${params.length}`;
    }

    // 1. fetch existing months
    const { rows: existing } = await pool.query(
      `
      SELECT  fl.fund_id,
              fl.fund_category                              AS fund_name,   -- ← new label
              TO_CHAR(hs.snapshot_date,'YYYY-MM')           AS snapshot_month
      FROM    public.holdings_snapshot AS hs
      JOIN    public.v_fund_lookup     AS fl
              ON  fl.fund_name = hs.fund_name               -- join still on the legal name
      ${where}
      GROUP   BY fl.fund_id, fl.fund_category, snapshot_month     
      `,
      params
    );

    /* map id → name once */
    const nameById = Object.fromEntries(
      existing.map(({ fund_id, fund_name }) => [fund_id, fund_name])
    );

    // 2. compute the gaps
    const rows = buildMissingRows(existing).map(r => ({ ...r, fund_name: nameById[r.fund_id] }));

    res.json({ rows });
  } catch (err) {
    console.error("[files] missingInvestorStatements:", err);
    res.status(500).json({ error: err.message });
  }
};


/* -------------------------------------------------------- *
 * GET /files/dashboard/verify-bank-statements
 * curl -H "Cookie: fp_jwt=$JWT" "http://localhost:5103/files/dashboard/verify-bank-statements"
 * curl -H "Cookie: fp_jwt=$JWT" "http://localhost:5103/files/dashboard/verify-bank-statements?fund_id=3"
 * -------------------------------------------------------- */
exports.verifyBankStatements = async (req, res) => {
  try {
    const fundId = req.query.fund_id ? Number(req.query.fund_id) : null;

    const params = [];
    let where = `WHERE rl.category = 'Bank statement'`;
    if (fundId) {
      params.push(fundId);
      where += ` AND rl.fund_id = $${params.length}`;
    }

    const { rows } = await pool.query(
      `SELECT DISTINCT ON (rl.fund_id,
                           to_char((rl.asset ->> 'statement_date')::date,'YYYY-MM'))
              rl.fund_id,
              fl.fund_categories                              AS fund_name,
              to_char((rl.asset ->> 'statement_date')::date,'YYYY-MM') AS month,
              ROUND( (rl.asset ->> 'diff')::numeric , 2)      AS diff   
         FROM public.records_log rl
         JOIN public.fundlist     fl USING (fund_id)
         ${where}
         ORDER BY rl.fund_id,
                  month DESC,
                  rl.anomaly_date DESC
         LIMIT 500`,
      params,
    );

    res.json({ rows });  
  } catch (err) {
    console.error("[files] verifyBankStatements:", err);
    res.status(500).json({ error: err.message });
  }
};

/* -------------------------------------------------------- *
 * GET /files/dashboard/verify-investor-statements
 * curl -H "Cookie: fp_jwt=$JWT" "http://localhost:5103/files/dashboard/verify-investor-statements"
 * curl -H "Cookie: fp_jwt=$JWT" "http://localhost:5103/files/dashboard/verify-investor-statements?fund_id=3"
 * -------------------------------------------------------- */
exports.verifyInvestorStatements = async (req, res) => {
  try {
    const fundId = req.query.fund_id ? Number(req.query.fund_id) : null;

    const params = [];
    let where = `WHERE rl.category = 'Investor holdings'`;
    if (fundId) {
      params.push(fundId);
      where += ` AND rl.fund_id = $${params.length}`;
    }

    const { rows } = await pool.query(
      `SELECT DISTINCT ON (rl.fund_id,
                           to_char((rl.asset ->> 'snapshot_date')::date,'YYYY-MM'))
              rl.fund_id,
              fl.fund_categories                              AS fund_name,
              to_char((rl.asset ->> 'snapshot_date')::date,'YYYY-MM') AS month,
              ROUND( (rl.asset ->> 'nav_calc')::numeric , 2)  AS nav_calc, 
              ROUND( (rl.asset ->> 'nav_db')::numeric  , 2)   AS nav_db   
         FROM public.records_log rl
         JOIN public.fundlist     fl USING (fund_id)
         ${where}
         ORDER BY rl.fund_id,
                  month DESC,
                  rl.anomaly_date DESC
         LIMIT 500`,
      params,
    );

    res.json({ rows });   // [{ fund_id, fund_name, month, nav_calc, nav_db }, …]
  } catch (err) {
    console.error("[files] verifyInvestorStatements:", err);
    res.status(500).json({ error: err.message });
  }
};

/* -------------------------------------------------------- *
 * GET /files/dashboard/verify-contract-notes
 * curl -H "Cookie: fp_jwt=$JWT" "http://localhost:5103/files/dashboard/verify-contract-notes"
 * curl -H "Cookie: fp_jwt=$JWT" "http://localhost:5103/files/dashboard/verify-contract-notes?fund_id=3"
 * -------------------------------------------------------- */
exports.verifyContactNotes = async (req, res) => {
  try {
    const fundId = req.query.fund_id ? Number(req.query.fund_id) : null;

    const params = [];
    let where = `WHERE category = 'Contract notes'`;
    if (fundId) {
      params.push(fundId);
      where += ` AND fund_id = $${params.length}`;
    }

    const { rows } = await pool.query(
      `SELECT fund_id,
              asset ->> 'Investor_name'                AS investor,
              asset ->> 'end_month'                    AS month,
              ROUND( abs((asset ->> 'abs_diff')::numeric) , 2) AS abs_diff 
         FROM public.records_log
         ${where}
         ORDER BY anomaly_date DESC
         LIMIT 500`,
      params,
    );

    res.json({ rows });  
  } catch (err) {
    console.error("[files] verifyContactNotes:", err);
    res.status(500).json({ error: err.message });
  }
};


