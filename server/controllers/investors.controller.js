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
  const lo    = (page - 1) * LIMIT + 1;
  const hi    = page * LIMIT;

  try {
    /* ---------- pageCount (same as before) ------------------------- */
    const { rows: [{ total }] } = await pool.query(`
      SELECT COUNT(*)::int AS total
      FROM   get_latest_snapshot_detail();
    `);
    const pageCount = Math.max(1, Math.ceil(total / LIMIT));

    /* ---------- page slice ---------------------------------------- */
    const { rows } = await pool.query(`
      WITH
        latest AS (
          SELECT *
          FROM   get_latest_snapshot_detail()
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
    `, [lo, hi]);

    res.json({ page, pageCount, rows });
  } catch (err) {
    console.error("portfolioOverview:", err);
    res.status(500).json({ error: err.message });
  }
};
