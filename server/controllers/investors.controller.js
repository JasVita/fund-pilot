// server/controllers/investors.controller.js
const { pool } = require("../config/db");

/* ------------------------------------------------------------------ *
 * GET /investors/portfolio
 * ?page=1            —  20 rows per page, ordered so that
 *                       “active” investors come first (A-Z),
 *                       followed by “inactive” (A-Z)
 *
 * Response: { page, pageCount, rows:[…≤20] }
 * ------------------------------------------------------------------ */
exports.portfolioOverview = async (req, res) => {
  const LIMIT = 20;
  const page  = Math.max(1, parseInt(req.query.page ?? "1", 10));
  const lo    = (page - 1) * LIMIT + 1;      // row_num lower bound
  const hi    = page * LIMIT;                // row_num upper bound

  try {
    /* ---------- total row count (to build pageCount) ---------------- */
    const { rows: [{ total }] } = await pool.query(`
      SELECT COUNT(*)::int AS total
      FROM   get_latest_snapshot_detail();
    `);
    const pageCount = Math.max(1, Math.ceil(total / LIMIT));

    /* ---------- fetch requested page -------------------------------- */
    const { rows } = await pool.query(`
        WITH ranked AS (
            SELECT
            investor_name           AS investor,
            class,
            number_held,
            nav_value               AS current_nav,
            NULL::numeric           AS unpaid_redeem,   -- ← placeholder
            status,
            ROW_NUMBER() OVER (
                ORDER BY (status = 'active') DESC, investor_name
            )                       AS row_num
            FROM get_latest_snapshot_detail()
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
