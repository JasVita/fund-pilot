const { pool } = require("../config/db");

/**
 * GET  /dashboard/unsettled-redemption
 * Calls: get_unsettled_redeem_6m()
 */
exports.unsettledRedemption = async (_req, res) => {
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

exports.netCash = async (_req, res) => {
  try {
    // 12-month history for the default account
    const { rows } = await pool.query(
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
 */
exports.navVsDiv = async (_req, res) => {
  try {
    const { rows } = await pool.query("SELECT * FROM get_nav_dividend_last6m();");
    res.json(rows);
  } catch (err) {
    console.error("navVsDiv:", err);
    res.status(500).json({ error: err.message });
  }
};
