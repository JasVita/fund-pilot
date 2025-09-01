const { pool } = require("../config/db");

/**
 * GET  /dashboard/unsettled-redemption?fund_id=1
 * curl -H "Cookie: fp_jwt=$JWT" "http://localhost:5003/dashboard/unsettled-redemption?fund_id=1"
 * Calls: get_unsettled_redeem_6m($1)
 */
exports.unsettledRedemption = async (req, res) => {
  const user = req.auth;
  const fundId = req.query.fund_id ? Number(req.query.fund_id) : null;
  console.log("[unsettledRedemption] user=%s role=%s fund=%s", user.email, user.role, fundId ?? "ALL");

  try {
    const { rows } = await pool.query("SELECT * FROM get_unsettled_redemptions_fund($1);", [fundId]);
    res.json(rows);
  } catch (err) {
    if (err.code === "P0001" && /unsettled/i.test(err.message)) {
      return res.json([]); // empty JSON array → HTTP 200
    }
    console.error("unsettledRedemption:", err);
    res.status(500).json({ error: err.message });
  }
};
/*  GET  /dashboard/net-cash
 *  curl -H "Cookie: fp_jwt=$JWT" "http://localhost:5003/dashboard/net-cash?acct=233569-20010&fund_id=1"
 *  Params:
 *    ?acct=233569-20010   (optional – default below)
 *    ?month=YYYY-MM       (optional – return single month only)
 *    returns { latest:number|null,  history:[… rows …] }
 */
exports.netCash = async (req, res) => {
  const user = req.auth;
  const period = req.query.month ?? null; // "YYYY-MM"
  const fundId = req.query.fund_id ? Number(req.query.fund_id) : null;
  console.log("[netCash] user=%s role=%s fund=%s Company=%s", user.email, user.role, fundId, user.company_id ?? "ALL");

  try {
    /* ── pull 12 m history once ───────────────────────────── */
    const { rows } = await pool.query("SELECT * FROM get_closing_available_balance_fund_all($1);", [fundId]);

    /* ---------- 3) 取得最新一筆 ----------------------------- */
    // SQL 已 ORDER BY statement_date DESC，rows[0] 就是最新
    const latestRow = rows[0] ?? null;

    /* ---------- 4) &month=YYYY-MM 過濾（若有帶）------------ */
    const filtered = period ? rows.filter((r) => r.statement_date.toISOString().slice(0, 7) === period) : rows;

    /* ---------- 5) 回傳 ------------------------------------ */
    res.json({
      latest: latestRow ? parseFloat(latestRow.closing_avail) : null,
      history: filtered,
    });
  } catch (err) {
    console.error("netCash:", err);
    res.status(500).json({ error: err.message });
  }
};

/**
 * GET /dashboard/nav-value-totals-vs-div?fund_id=…
 * curl -H "Cookie: fp_jwt=$JWT" "http://localhost:5003/dashboard/nav-value-totals-vs-div?fund_id=1"
 * Calls: get_nav_dividend_last6m_fund($1)
 * 3. NAV value totals vs dividends
 * Returns [{ period:"YYYY-MM", nav:1234.56, dividend:789.01 }, …]
 */
exports.navVsDiv = async (req, res) => {
  const user = req.auth;
  const fundId = req.query.fund_id ? Number(req.query.fund_id) : null;
  console.log("[navVsDiv] user=%s role=%s fund=%s Company=%s", user.email, user.role, fundId, user.company_id ?? "ALL");

  try {
    const { rows } = await pool.query(
      `
      SELECT
        to_char(month_start, 'YYYY-MM')   AS period,
        nav_total                          AS nav,
        COALESCE(dividend_total, 0)        AS dividend
      FROM   get_nav_dividend_last6m_fund($1)
      ORDER  BY month_start
    `,
      [fundId]
    );
    res.json(rows);
  } catch (err) {
    /* Function raises P0001 when the fund has no snapshots */
    if (err.code === "P0001" && /No holdings_snapshot rows/.test(err.message)) {
      return res.json([]); // empty set → HTTP 200
    }
    console.error("navVsDiv:", err);
    res.status(500).json({ error: err.message });
  }
};

/**
 * GET  /dashboard/aum
 * Params (all optional):
 *   ?after=YYYY-MM-DD   -  paging; return rows *older* than this date
 *   ?limit=N            -  max rows to return  (default 30)
 *
 * Returns [{ snapshot:"2025-05-31", nav_total: 17_498_268.41 }, …]
 */
exports.aumHistory = async (req, res) => {
  const user = req.auth;

  /* ---------- 1) normalise inputs --------------------------- */
  // const companyId =
  //   user.company_id && Number.isFinite(+user.company_id)
  //     ? Number(user.company_id)
  //     : null;                                    // null ⇒ no filtering
  const after = req.query.after ?? null; // "YYYY-MM-DD"
  const limit = Number(req.query.limit ?? 30); // default 30
  const fundId = req.query.fund_id ? Number(req.query.fund_id) : null;

  /* ---------- 2) build query & params ----------------------- */

  let text = `
    SELECT
      to_char(hs.snapshot_date,'YYYY-MM-DD') AS snapshot,
      hs.nav_total
    FROM   public.holdings_snapshot hs
     LEFT   JOIN v_fund_lookup vl ON vl.fund_name = hs.fund_name
  `;

  const vals = [];
  let idx = 1;

  if (fundId !== null) {
    text += `WHERE vl.fund_id = $${idx++} `;
    vals.push(fundId);
  }

  if (after) {
    text += (fundId !== null ? "AND " : "WHERE ") + `hs.snapshot_date < $${idx++} `;
    vals.push(after);
  }
  text += `ORDER BY hs.snapshot_date DESC
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

/* -----------------------------------------------------------
 * GET  /dashboard/dealing-calendar?fund_id=2
 * curl -H "Cookie: fp_jwt=$JWT" "http://localhost:5003/dashboard/dealing-calendar?fund_id=2"
 * Calls: get_dealing_calendar($1)
 * Returns: [{ dealing_date:"2025-07-02", daily_amount:706482.85 }, …]
 * -----------------------------------------------------------
 */
exports.dealingCalendar = async (req, res) => {
  const user = req.auth;
  const fundId = req.query.fund_id ? Number(req.query.fund_id) : null;

  console.log("[dealingCalendar] user=%s role=%s fund=%s", user.email, user.role, fundId ?? "ALL");

  // quick sanity‐check - avoids sending “NaN” to the DB
  if (req.query.fund_id && !Number.isFinite(fundId)) {
    return res.status(400).json({ error: "Invalid fund_id" });
  }

  try {
    const { rows } = await pool.query(
      `SELECT
         to_char(dealing_date,   'YYYY-MM-DD')       AS dealing_date,
         ROUND(daily_amount::numeric, 2)             AS daily_amount,
         to_char(submission_date,'YYYY-MM-DD')       AS submission_date
       FROM get_dealing_calendar($1);`,
      [fundId] // null → ALL funds (per fn definition)
    );

    res.json(rows); // ⇐ 200 JSON array
  } catch (err) {
    console.error("dealingCalendar:", err);
    res.status(500).json({ error: err.message });
  }
};

/** GET /dashboard/dividend-yields?fund_id=5
 *  → { "2024": 6.5, "2025": 7.2 }
 */
exports.getDividendYields = async (req, res) => {
  const fundId = Number(req.query.fund_id);
  if (!Number.isFinite(fundId)) {
    return res.status(400).json({ error: "fund_id is required" });
  }

  try {
    const { rows } = await pool.query(
      `SELECT yr, annualized_yield_pct
         FROM dividend_yield
        WHERE fund_id = $1
        ORDER BY yr`,
      [fundId]
    );

    const out = {};
    for (const r of rows) out[String(r.yr)] = Number(r.annualized_yield_pct);
    res.json(out);
  } catch (err) {
    console.error("getDividendYields:", err);
    res.status(500).json({ error: "server_error" });
  }
};

/** POST /dashboard/dividend-yields
 *  body: { fund_id: 5, rates: { "2024": 6.5, "2025": 7.2 }, delete_years: [2024] }
 *  auth: super
 */
exports.upsertDividendYields = async (req, res) => {
  const { fund_id, rates, delete_years } = req.body || {};
  const fundId = Number(fund_id);
  if (!Number.isFinite(fundId)) return res.status(400).json({ error: "fund_id required" });

  // sanitize upsserts
  const entries = Object.entries(rates || {})
    .map(([y, v]) => [Number(y), Number(v)])
    .filter(([yr, pct]) => Number.isFinite(yr) && yr >= 2000 && yr <= 2100 && Number.isFinite(pct) && pct >= 0 && pct <= 100);

  // sanitize deletes
  const delYears = Array.isArray(delete_years)
    ? delete_years.map(Number).filter((y) => Number.isFinite(y) && y >= 2000 && y <= 2100)
    : [];

  // const uid = req.user?.id || null; // set by requireAuth
  const uid = req.auth?.sub ?? null; // JWT subject from requireAuth

  try {
    await pool.query("BEGIN");

    // A) deletes (blank fields become '—' by removing rows)
    if (delYears.length) {
      await pool.query(
        `DELETE FROM dividend_yield
          WHERE fund_id = $1 AND yr = ANY($2::int[])`,
        [fundId, delYears]
      );
    }

    // B) upserts
    if (entries.length) {
      let i = 1;
      const params = [];
      const valuesSQL = entries
        .map(([yr, pct]) => {
          params.push(fundId, yr, pct, uid, uid);
          return `($${i++}, $${i++}, $${i++}, $${i++}, $${i++})`;
        })
        .join(",");

      const sql = `
        INSERT INTO dividend_yield (fund_id, yr, annualized_yield_pct, created_by, updated_by)
        VALUES ${valuesSQL}
        ON CONFLICT (fund_id, yr)
        DO UPDATE SET
          annualized_yield_pct = EXCLUDED.annualized_yield_pct,
          updated_by           = EXCLUDED.updated_by,
          updated_at           = (NOW() AT TIME ZONE 'Asia/Hong_Kong')
      `;
      await pool.query(sql, params);
    }

    await pool.query("COMMIT");
    res.json({ ok: true, upserted: entries.length, deleted: delYears.length });
  } catch (err) {
    await pool.query("ROLLBACK");
    console.error("upsertDividendYields:", err);
    res.status(500).json({ error: "server_error" });
  }
};
