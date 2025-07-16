// server/controllers/investors.controller.js
const { pool } = require("../config/db");
const { formatName } = require("../utils/nameFormatter");

/* ------------------------------------------------------------------ *
 * GET /investors/portfolio
 * ------------------------------------------------------------------ *
 * • 20 rows per page
 * • active  → inactive-with-redeem  → other-inactive
 * • Response: { page, pageCount, rows:[…≤20] }
 * ------------------------------------------------------------------ */
exports.portfolioOverview = async (req, res) => {
  /* ----------------------------------------------------------------
   * • NO server-side pagination any more – just return the whole set
   * • The page/pageCount fields are kept (always 1) for compatibility
   * ---------------------------------------------------------------- */
  const fundId = req.query.fund_id ? Number(req.query.fund_id) : null;

  try {
    /* ① pull the full overview list -------------------------------- */
    const fullSql = `
      SELECT
          investor,
          class,
          number_held,
          current_nav,
          unpaid_redeem_display AS unpaid_redeem,
          status_display        AS status
        FROM investor_portfolio_overview($1);`;

    const { rows } = await pool.query(fullSql, [fundId]);

    /* ② respond ---------------------------------------------------- */
    res.json({
      page: 1, // ← no pagination any more
      pageCount: 1,
      rows, // ← entire data set
    });
  } catch (err) {
    console.error("portfolioOverview:", err);
    res.status(500).json({ error: err.message });
  }
};

/* ------------------------------------------------------------------ *
 * GET /investors/holdings?investor=A&fund_id=K
 * curl -H "Cookie: fp_jwt=$JWT" "http://localhost:5003/investors/holdings?fund_id=2&investor=Xie%20Rui"
 * ------------------------------------------------------------------ */
exports.investorHoldings = async (req, res) => {
  const investor = (req.query.investor ?? "").trim();
  const fundId = req.query.fund_id ? Number(req.query.fund_id) : null;

  if (!investor) return res.status(400).json({ error: "?investor= is required" });

  try {
    /* single-row summary via new PL/pgSQL function --------------- */
    const sql = `
      SELECT *
        FROM investor_subscription_report($1::int, $2::text);`;

    const { rows } = await pool.query(sql, [fundId, investor]);

    if (rows.length === 0) return res.status(404).json({ error: "No data for that investor/fund" });

    /* shape it exactly like the old response -------------------- */
    const [r] = rows;
    res.json({
      investor,
      rows: [
        {
          name: r.name,
          sub_date: r.sub_date,
          data_cutoff: r.data_cutoff,
          subscribed: r.subscribed,
          market_value: r.market_value,
          total_after_int: Number(r.total_after_int),
          pnl_pct: r.pnl_pct == null ? "NA" : r.pnl_pct.toString(),
        },
      ],
    });
  } catch (err) {
    console.error("investorHoldings:", err);
    res.status(500).json({ error: err.message });
  }
};

exports.formatInvestorName = async (req, res) => {
  const raw = (req.query.name || "").trim();
  if (!raw) return res.status(400).json({ error: "?name= is required" });

  try {
    const formatted = await formatName(raw);
    res.send(formatted);
  } catch (err) {
    console.error("formatInvestorName:", err);
    res.status(500).json({ error: err.message });
  }
};

/* ------------------------------------------------------------------ *
 * GET /investors/holdings/all-funds?investor=NAME
 *  curl -H "Cookie: fp_jwt=$JWT" "http://localhost:5003/investors/holdings/all-funds?investor=Feng%20Fan"
 * ------------------------------------------------------------------ */
exports.investorAllFunds = async (req, res) => {
  const investor = (req.query.investor ?? "").trim();

  if (!investor) return res.status(400).json({ error: "?investor= is required" });

  try {
    const sql = `SELECT * FROM get_investor_latest_holdings($1::text);`;

    const { rows } = await pool.query(sql, [investor]);

    if (rows.length === 0) return res.status(404).json({ error: "No holdings found for that investor" });

    res.json({ investor, rows });
  } catch (err) {
    console.error("investorAllFunds:", err);
    res.status(500).json({ error: err.message });
  }
};

/* ------------------------------------------------------------------ *
 * GET /investors/dividends?investor=NAME
 * curl -H "Cookie: fp_jwt=$JWT" "http://localhost:5003/investors/holdings/dividends?investor=Feng%20Fan"
 * ------------------------------------------------------------------ */
exports.investorDividends = async (req, res) => {
  const investor = (req.query.investor ?? "").trim();

  if (!investor) return res.status(400).json({ error: "?investor= is required" });

  try {
    /* call the PL/pgSQL helper ------------------------------------ */
    const sql = `SELECT * FROM get_investor_dividends($1::text);`;
    const { rows } = await pool.query(sql, [investor]);

    if (rows.length === 0) return res.status(404).json({ error: "No dividend records for that investor" });

    /* shape the response ------------------------------------------ */
    res.json({ investor, rows }); // identical to /holdings style
  } catch (err) {
    console.error("investorDividends:", err);
    res.status(500).json({ error: err.message });
  }
};

/* ────────────────────────────────────────────────────────────────── *
 * GET /investors/subscriptions?investor=NAME
 *   – one record per (fund × subscription-line) that has data
 *   – fund_id is **NOT** returned in the JSON
 *   – Response: { investor, rows:[ … ] }
 * ────────────────────────────────────────────────────────────────── */
exports.investorReport = async (req, res) => {
  const investor = (req.query.investor ?? "").trim();

  if (!investor) {
    return res.status(400).json({ error: "?investor= is required" });
  }

  try {
    /*   Instead of reading from a `funds` table we iterate over a   *
     *   fixed list of fund_id-s (1,2,3,4) and call the PL/pgSQL     *
     *   helper for each.  We discard the fund_id in the SELECT.     */
    const sql = `
      SELECT
          r.name,
          r.sub_date,
          r.data_cutoff,
          r.subscribed,
          r.market_value,
          r.total_after_int,
          r.pnl_pct
        FROM  unnest(ARRAY[1,2,3,4]) AS f(fund_id)
        CROSS JOIN LATERAL investor_subscription_report(f.fund_id, $1::text) AS r
        WHERE  COALESCE(r.sub_date,
                        r.data_cutoff,
                        r.subscribed,
                        r.market_value) IS NOT NULL
        ORDER  BY f.fund_id,
                  r.sub_date; 
    `;

    const { rows } = await pool.query(sql, [investor]);

    if (rows.length === 0) {
      return res.status(404).json({ error: "No subscription data for that investor" });
    }

    res.json({ investor, rows }); // ← fund_id is *not* included
  } catch (err) {
    console.error("investorReport:", err);
    res.status(500).json({ error: err.message });
  }
};

/* unchanged: listInvestors() */
exports.listInvestors = async (req, res) => {
  const cid = req.auth.role === "super" ? req.query.company_id || req.auth.company_id : req.auth.company_id;
  const { rows } = await pool.query("SELECT * FROM investors WHERE company_id = $1;", [cid]);
  res.json(rows);
};
