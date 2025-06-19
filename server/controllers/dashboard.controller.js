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

/**
 * GET  /dashboard/net-cash
 * Completely ignores any ?email= or other params.
 * Always queries the same “default account” and returns 12-month history.
 */
const defaultAccount = "233569-20010";   

exports.netCash = async (req, res) => {
  const user = req.auth;
  console.log("[netCash] User:", user.email, "Role:", user.role, "Company:", user.company_id);

  try {
    // 12-month history for the default account
    const { rows } = await pool.query(
      // "SELECT * FROM get_closing_available_balance(233569-20010, 12);",
      "SELECT * FROM get_closing_available_balance($1, 12);",
      [defaultAccount]
    );

    // find the latest (max month_start) row
    const latestRow = rows.reduce(
      (acc, row) =>
        !acc || row.month_start > acc.month_start ? row : acc,
      null
    );

    res.json({
      latest: latestRow ? parseFloat(latestRow.closing_avail) : null,
      history: rows,
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
