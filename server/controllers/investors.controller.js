// server/controllers/investors.controller.js
const { pool } = require("../config/db");

/* ------------------------------------------------------------------ *
 * GET /investors/portfolio
 * ------------------------------------------------------------------ *
 * • 20 rows per page
 * • active  → inactive-with-redeem  → other-inactive
 * • Response: { page, pageCount, rows:[…≤20] }
 * ------------------------------------------------------------------ */
exports.portfolioOverview = async (req, res) => {
  const LIMIT = 20;
  const page  = Math.max(1, parseInt(req.query.page ?? "1", 10));
  const fundId = req.query.fund_id ? Number(req.query.fund_id) : null;
  // const lo    = (page - 1) * LIMIT + 1;
  // const hi    = page * LIMIT;
  const offset = (page - 1) * LIMIT;

  try {
    /* ---------- pageCount (same as before) ------------------------- */
    // const { rows: [{ total }] } = await pool.query(
    //   `SELECT COUNT(*)::int AS total
    //      FROM get_latest_snapshot_detail_fund($1);`,
    //   [fundId]    
    /* --------------------------------------------------------------
       ① how many rows in the overview for this fund?
    -------------------------------------------------------------- */
    const { rows: [{ total }] } = await pool.query(
      `SELECT COUNT(*)::int AS total
         FROM investor_portfolio_overview($1);`,
      [fundId] 
    );
    const pageCount = Math.max(1, Math.ceil(total / LIMIT));

    /* ---------- paged slice ------------------------------------- */
    // const sliceSql = `
    //   WITH
    //     latest AS (
    //       SELECT *
    //       FROM   get_latest_snapshot_detail_fund($3)   -- fund filter
    //     ),
    //     redeem AS (
    //       SELECT investor_name,
    //              ABS(nav_delta)::numeric AS unpaid_redeem
    //       FROM   get_unsettled_redeem_6m_fund($3)      -- same filter
    //     ),
    //     combined AS (
    //       SELECT
    //         l.investor_name AS investor,
    //         l.class,
    //         l.number_held,
    //         l.nav_value     AS current_nav,
    //         r.unpaid_redeem,
    //         l.status
    //       FROM   latest l
    //       LEFT   JOIN redeem r USING (investor_name)
    //     ),
    //     ranked AS (
    //       SELECT *,
    //              ROW_NUMBER() OVER (
    //                ORDER BY
    //                  (status = 'active')         DESC,
    //                  (unpaid_redeem IS NOT NULL) DESC,
    //                  investor
    //              ) AS row_num
    //       FROM combined
    //     )
    //   SELECT investor,
    //          class,
    //          number_held,
    //          current_nav,
    //          unpaid_redeem,
    //          status
    //   FROM   ranked
    //   WHERE  row_num BETWEEN $1 AND $2
    //   ORDER  BY row_num;`;
    // const { rows } = await pool.query(sliceSql, [lo, hi, fundId]);

    /* --------------------------------------------------------------
       ② grab the slice for this page (function already pre-orders) investor_display       AS investor, unpaid_redeem_display  AS unpaid_redeem,   
    -------------------------------------------------------------- */
    const sliceSql = `
      SELECT
          investor_display       AS investor,   
          class,
          number_held,
          current_nav,
          unpaid_redeem_display  AS unpaid_redeem,
          status_display         AS status
        FROM investor_portfolio_overview($1)
       OFFSET $2
       LIMIT  $3;`;

    const { rows } = await pool.query(sliceSql, [fundId, offset, LIMIT]);
    res.json({ page, pageCount, rows });

  } catch (err) {
    console.error("portfolioOverview:", err);
    res.status(500).json({ error: err.message });
  }
};

/* ------------------------------------------------------------------ *
 * GET /investors/holdings?investor=A&fund_id=K
 * curl -H "Cookie: fp_jwt=$JWT" "http://localhost:5103/investors/holdings?fund_id=2&investor=Xie%20Rui"
 * ------------------------------------------------------------------ */
exports.investorHoldings = async (req, res) => {
  const investor = (req.query.investor ?? '').trim();
  const fundId   = req.query.fund_id ? Number(req.query.fund_id) : null;

  if (!investor)
    return res.status(400).json({ error: '?investor= is required' });

  try {
    /* single-row summary via new PL/pgSQL function --------------- */
    const sql = `
      SELECT *
        FROM investor_subscription_report($1::int, $2::text);`;

    const { rows } = await pool.query(sql, [fundId, investor]);

    if (rows.length === 0)
      return res.status(404).json({ error: 'No data for that investor/fund' });

    /* shape it exactly like the old response -------------------- */
    const [r] = rows;
    res.json({
      investor,
      rows: [ {
        name            : r.name,
        sub_date        : r.sub_date,
        data_cutoff     : r.data_cutoff,
        subscribed      : r.subscribed,
        market_value    : r.market_value,
        total_after_int : Number(r.total_after_int),
        pnl_pct         : r.pnl_pct == null ? 'NA' : r.pnl_pct.toString()
      } ]
    });

  } catch (err) {
    console.error('investorHoldings:', err);
    res.status(500).json({ error: err.message });
  }
};

/* ------------------------------------------------------------------ *
 * GET /investors/holdings/all-funds?investor=NAME
 *  curl -H "Cookie: fp_jwt=$JWT" "http://localhost:5103/investors/holdings/all-funds?investor=Feng%20Fan"
 * ------------------------------------------------------------------ */
exports.investorAllFunds = async (req, res) => {
  const investor = (req.query.investor ?? "").trim();

  if (!investor)
    return res.status(400).json({ error: "?investor= is required" });

  try {
    const sql = `SELECT * FROM get_investor_latest_holdings($1::text);`;

    const { rows } = await pool.query(sql, [investor]);

    if (rows.length === 0)
      return res
        .status(404)
        .json({ error: "No holdings found for that investor" });

    res.json({ investor, rows });
  } catch (err) {
    console.error("investorAllFunds:", err);
    res.status(500).json({ error: err.message });
  }
};

/* unchanged: listInvestors() */
exports.listInvestors = async (req, res) => {
  const cid = req.auth.role === "super"
            ? req.query.company_id || req.auth.company_id
            : req.auth.company_id;
  const { rows } = await pool.query(
    "SELECT * FROM investors WHERE company_id = $1;", [cid]
  );
  res.json(rows);
};