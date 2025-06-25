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
  const lo    = (page - 1) * LIMIT + 1;
  const hi    = page * LIMIT;

  try {
    /* ---------- pageCount (same as before) ------------------------- */
    const { rows: [{ total }] } = await pool.query(`
      SELECT COUNT(*)::int AS total
      FROM   get_latest_snapshot_detail()
      ${fundId !== null ? "WHERE fund_id = $1" : ""};
    `, fundId !== null ? [fundId] : []);
    const pageCount = Math.max(1, Math.ceil(total / LIMIT));

    /* ---------- page slice ---------------------------------------- */
    // const { rows } = await pool.query(`
    const sliceSql = `
      WITH
        latest AS (
          SELECT *
          FROM   get_latest_snapshot_detail()
          ${fundId !== null ? "WHERE fund_id = $" + (fundId !== null ? 3 : "") : ""}
        ),
        redeem AS (
          SELECT
            investor_name,
            ABS(nav_delta)::numeric AS unpaid_redeem
          FROM   get_unsettled_redeem_6m()
        ),
        combined AS (
          SELECT
            l.investor_name                  AS investor,
            l.class,
            l.number_held,
            l.nav_value                      AS current_nav,
            r.unpaid_redeem,                 -- NULL if none
            l.status
          FROM   latest l
          LEFT   JOIN redeem r USING (investor_name)
        ),
        ranked AS (
          SELECT *,
                 ROW_NUMBER() OVER (
                   ORDER BY
                     (status = 'active')         DESC,  -- 1️⃣ actives
                     (unpaid_redeem IS NOT NULL) DESC,  -- 2️⃣ inactive w/ redeem
                     investor                             -- 3️⃣ alphabetical
                 ) AS row_num
          FROM combined
        )
      SELECT investor,
             class,
             number_held,
             current_nav,
             unpaid_redeem,
             status
      FROM   ranked
      WHERE  row_num BETWEEN $1 AND $2
      ORDER  BY row_num;
    `;
    const params = [lo, hi];
    if (fundId !== null) params.push(fundId);
    const { rows } = await pool.query(sliceSql, params);

    res.json({ page, pageCount, rows });
  } catch (err) {
    console.error("portfolioOverview:", err);
    res.status(500).json({ error: err.message });
  }
};

exports.investorHoldings = async (req, res) => {
  const raw = req.query.investor ?? "";
  const investor = raw.trim();          // remove accidental spaces

  // if (!investor) { return res.status(400).json({ error: "Query param ?investor= is required" });}
  const fundId = req.query.fund_id ? Number(req.query.fund_id) : null; 
  if (!investor)
    return res.status(400).json({ error: "Query param ?investor= is required" });


  try {
    /* ---------- 1. latest fund / product name -------------------- */
    const {
      rows: [{ fund_name }],
    } = await pool.query(
      `SELECT fund_name
       FROM   holdings_snapshot
       
       ORDER  BY snapshot_date DESC
       LIMIT  1`
    );

    /* ---------- 2. investor activity ----------------------------- */
    const {
      rows: [{
        inc_dates, inc_navs,         /* arrays */
        dec_dates, dec_navs,         /* arrays */
        last_date, last_nav, div_sum
      }],
    } = await pool.query(`SELECT * FROM get_investor_activity($1)`, [investor]);

    /** helper: PG array → JS array */
    const pgArr = (v) =>
      Array.isArray(v) ? v : v ? v.slice(1, -1).split(",") : [];

    // /* ---------- helpers to deserialize Postgres arrays ----------- */
    // const pgArr = (v) => {
    //   if (Array.isArray(v)) return v;        // already parsed by pg
    //   if (v == null) return [];
    //   return v
    //     .slice(1, -1)                        // "{…}" → "…"
    //     .split(",")
    //     .filter(Boolean);
    // };

    /* ---------- arrays ------------------------------------------ */
    const incDateArr = pgArr(inc_dates);          // 購入日期
    const incNavArr  = pgArr(inc_navs).map(Number);

    const decDateArr = pgArr(dec_dates);
    const decNavArr  = pgArr(dec_navs).map((n) => Math.abs(Number(n)));

    /* ---- build 市值 lists per new rule ------------------------- */
    let mvDates = [...decDateArr];
    let mvVals  = [...decNavArr];

    if (Number(last_nav) !== 0) {
      mvDates.push(String(last_date));
      mvVals.push(Math.abs(Number(last_nav)));
    }

    /* ---- other totals ------------------------------------------ */
    const subscribedSum  = incNavArr.reduce((a, b) => a + b, 0);
    const marketValueSum = mvVals.reduce((a, b) => a + b, 0);
    const totalAfterInt  = marketValueSum + Number(div_sum);

    const pnlPct =
      subscribedSum === 0
        ? null
        : ((totalAfterInt - subscribedSum) / subscribedSum) * 100;

    /* ---- response ---------------------------------------------- */
    res.json({
      investor,
      rows: [
        {
          name: fund_name,
          sub_date: incDateArr.join("\n"),            // 認購時間
          data_cutoff: mvDates.join("\n"),            // 數據截止
          subscribed: incNavArr.join("\n"),           // 認購金額
          market_value: mvVals.join("\n"),            // 市值 (list)
          total_after_int: totalAfterInt,             // 含息後總額
          pnl_pct: pnlPct !== null ? pnlPct.toFixed(2) : "NA",
        },
      ],
    });
  } catch (err) {
    console.error("investorHoldings:", err);
    res.status(500).json({ error: err.message });
  }
};

exports.listInvestors = async (req, res) => {
  const cid = req.auth.role === "super"
            ? req.query.company_id || req.auth.company_id // allow super to pick
            : req.auth.company_id;

  const { rows } = await pool.query(
    "SELECT * FROM investors WHERE company_id = $1",
    [cid]
  );
  res.json(rows);
};