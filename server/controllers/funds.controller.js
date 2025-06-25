const { pool } = require("../config/db");

exports.listFunds = async (_req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT DISTINCT fund_id, fund_categories AS fund_name
      FROM   public.fundlist     
      ORDER  BY fund_name
    `);
    res.json(rows);              // [{ fund_id: 1, fund_name: "Hywin …" }, …]
  } catch (err) {
    console.error("listFunds:", err);
    res.status(500).json({ error: err.message });
  }
};
