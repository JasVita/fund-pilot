const { pool } = require("../config/db");

/**
 * GET  /dashboard/unsettled-redemption
 * Calls: get_unsettled_redeem_6m()
 */
exports.unsettledRedemption = async (req, res) => {
  const user = req.auth;
  console.log("[unsettledRedemption] User:", user.email, "Role:", user.role, "Company:", user.company_id);

  try {
    const { rows } = await pool.query("SELECT * FROM get_unsettled_redeem_6m();");
    res.json(rows);
  } catch (err) {
    console.error("unsettledRedemption:", err);
    res.status(500).json({ error: err.message });
  }
};

 /*  GET  /dashboard/net-cash
  *  Params:
  *    ?acct=233569-20010   (optional – default below)
  *    ?month=YYYY-MM       (optional – return single month only)
  *    returns { latest:number|null,  history:[… rows …] }
  */
const defaultAccount = "233569-20010";   

exports.netCash = async (req, res) => {
  const user = req.auth;
  console.log("[netCash] User:", user.email, "Role:", user.role, "Company:", user.company_id);

  // try {
  //   // 12-month history for the default account
  //   const { rows } = await pool.query(
  //     // "SELECT * FROM get_closing_available_balance(233569-20010, 12);",
  //     "SELECT * FROM get_closing_available_balance($1, 12);",
  //     [defaultAccount]
  //   );

  try {
    const acct   = req.query.acct  ?? defaultAccount;
    const period = req.query.month ?? null;          // e.g. "2025-02"

    /* ── pull 12 m history once ───────────────────────────── */
    const { rows } = await pool.query(
      "SELECT * FROM get_closing_available_balance($1, 12);",
      [acct]
    );

    // find the latest (max month_start) row
    const latestRow = rows.reduce(
      (acc, row) =>
        !acc || row.month_start > acc.month_start ? row : acc,
      null
    );
    
    /* ── single-month shortcut if &month=YYY-MM was supplied ─ */
    const filtered = period
      ? rows.filter(r => r.month_start.toISOString().slice(0,7) === period)
      : rows;


    res.json({
      latest: latestRow ? parseFloat(latestRow.closing_avail) : null,
      // history: rows,
      history: filtered,
    });
  } catch (err) {
    console.error("netCash:", err);
    res.status(500).json({ error: err.message });
  }
};

/**
 * GET  /dashboard/nav-value-totals-vs-div
 * Calls: get_nav_dividend_last6m()
 * Returns [{ period:"YYYY-MM", nav:1234.56, dividend:789.01 }, …]
 */
exports.navVsDiv = async (req, res) => {
  const user = req.auth;
  console.log("[navVsDiv] Accessed by:", user.email, "Role:", user.role, "Company:", user.company_id);

  try {
    // const { rows } = await pool.query("SELECT * FROM get_nav_dividend_last6m();");
    // res.json(rows);
    const { rows } = await pool.query(`
      SELECT
        to_char(month_start, 'YYYY-MM')   AS period,
        nav_total                          AS nav,
        COALESCE(dividend_total, 0)        AS dividend
      FROM   get_nav_dividend_last6m()
      ORDER  BY month_start
    `);
    res.json(rows);
    
  } catch (err) {
    console.error("navVsDiv:", err);
    res.status(500).json({ error: err.message });
  }
};

/**
 * GET  /dashboard/aum
 * Params (all optional):
 *   ?after=YYYY-MM-DD   –  paging; return rows *older* than this date
 *   ?limit=N            –  max rows to return  (default 30)
 *
 * Returns [{ snapshot:"2025-05-31", nav_total: 17_498_268.41 }, …]
 */
exports.aumHistory = async (req, res) => {
  const user = req.auth;

  /* ---------- 1) normalise inputs --------------------------- */
  const companyId =
    user.company_id && Number.isFinite(+user.company_id)
      ? Number(user.company_id)
      : null;                                    // null ⇒ no filtering
  const after  = req.query.after ?? null;        // "YYYY-MM-DD"
  const limit  = Number(req.query.limit ?? 30);  // default 30

  /* ---------- 2) build query & params ----------------------- */
  let text   = `
    SELECT
      to_char(snapshot_date, 'YYYY-MM-DD') AS snapshot,
      nav_total
    FROM   public.holdings_snapshot
  `;
  const vals = [];
  let idx = 1;

  if (companyId !== null) {
    text += `WHERE company_id = $${idx++} `;
    vals.push(companyId);
  }

  if (after) {
    text += (companyId !== null ? "AND " : "WHERE ")
         +  `snapshot_date < $${idx++} `;
    vals.push(after);
  }

  text += `ORDER BY snapshot_date DESC
           LIMIT  $${idx}`;
  vals.push(limit);

  /* ---------- 3) run & return ------------------------------- */
  try {
    const { rows } = await pool.query(text, vals);
    res.json(rows);
  } catch (err) {
    console.error("aumHistory:", err);
    res.status(500).json({ error: err.message });
  }
};
