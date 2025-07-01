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
          investor,    
          class,
          number_held,
          current_nav,
          unpaid_redeem,    
          status
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
 * ------------------------------------------------------------------ */
exports.investorHoldings = async (req, res) => {
  const investor = (req.query.investor ?? "").trim();
  const fundId   = req.query.fund_id ? Number(req.query.fund_id) : null;

  if (!investor)
    return res.status(400).json({ error: "?investor= is required" });

  try {
    /* ---- 1. canonical fund name (so the drawer header is right) */
    const { rows: [{ fund_name }] } = await pool.query(
      `SELECT fund_name
         FROM holdings_snapshot hs
         LEFT JOIN v_fund_lookup vl ON vl.name = hs.fund_name
        WHERE vl.fund_id = COALESCE($1::int, vl.fund_id)  
     ORDER BY hs.snapshot_date DESC, hs.id DESC
        LIMIT 1;`,
      [fundId]
    );

    /* ---- 2. activity wrapper that honours the fund filter ----- */
    const q = `SELECT *
                 FROM get_investor_activity_fund($1::text, 0.3, $2::int);`;
    const {
      rows: [{
        inc_dates, inc_navs,
        dec_dates, dec_navs,
        last_date, last_nav, div_sum
      }],
    } = await pool.query(q, [investor, fundId]);

    /* ---- helpers --------------------------------------------- */
    const pgArr = v =>
      Array.isArray(v) ? v
      : v == null       ? []
      : v.slice(1, -1).split(",");

    const incDateArr = pgArr(inc_dates);
    const incNavArr  = pgArr(inc_navs).map(Number);
    const decDateArr = pgArr(dec_dates);
    const decNavArr  = pgArr(dec_navs).map(n => Math.abs(Number(n)));

    let mvDates = [...decDateArr];
    let mvVals  = [...decNavArr];
    if (Number(last_nav) !== 0) {
      mvDates.push(String(last_date));
      mvVals.push(Math.abs(Number(last_nav)));
    }

    const subscribed = incNavArr.reduce((a,b) => a+b, 0);
    const mktValue   = mvVals.reduce((a,b) => a+b, 0);
    const totalAfter = mktValue + Number(div_sum);
    const pnlPct     = subscribed === 0 ? null
                     : ((totalAfter - subscribed) / subscribed) * 100;

    res.json({
      investor,
      rows: [{
        name            : fund_name,
        sub_date        : incDateArr.join("\n"),
        data_cutoff     : mvDates.join("\n"),
        subscribed      : incNavArr.join("\n"),
        market_value    : mvVals.join("\n"),
        total_after_int : totalAfter,
        pnl_pct         : pnlPct != null ? pnlPct.toFixed(2) : "NA",
      }],
    });

  } catch (err) {
    console.error("investorHoldings:", err);
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