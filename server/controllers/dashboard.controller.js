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

// ────────────────────────────────────────────────────────────
// TEMP: fund-level JSON passthrough until DB schema is ready
// GET /dashboard/fund-level
// GET /dashboard/fund-level?fund=Annum%20Global%20PE%20Fund%20I%20SP&as_of=2025-06-30
// GET /dashboard/fund-level?fund=...&class_name=Class%20A%20-%20Lead%20Series
// GET /dashboard/fund-level?flat=true   (returns flattened rows for chart binding)
// Env override: FUND_LEVEL_JSON=<path-to-file>
// ────────────────────────────────────────────────────────────
const path = require("path");
const fsp  = require("fs").promises;

// Prefer server/data/fund-level.json, fallback to client/public/data/fund-level.json
const CANDIDATE_PATHS = [
  path.resolve(__dirname, "..", "data", "fund-level.json"),
  path.resolve(__dirname, "../..", "client", "public", "data", "fund-level.json"),
];

let _fundLevelCache = { mtimeMs: 0, data: null, path: null };

async function resolveExistingPath() {
  for (const p of CANDIDATE_PATHS) {
    try {
      await fsp.access(p);
      return p;
    } catch (_) {}
  }
  throw new Error(
    `fund-level.json not found. Tried:\n - ${CANDIDATE_PATHS.join("\n - ")}`
  );
}

async function loadFundLevelJSON() {
  const resolved = await resolveExistingPath();
  const stat = await fsp.stat(resolved);
  if (!_fundLevelCache.data || stat.mtimeMs !== _fundLevelCache.mtimeMs || _fundLevelCache.path !== resolved) {
    const raw = await fsp.readFile(resolved, "utf8");
    _fundLevelCache = { mtimeMs: stat.mtimeMs, data: JSON.parse(raw), path: resolved };
    console.log("[fund-level] loaded", resolved);
  }
  return _fundLevelCache.data;
}

/** Flatten to rows: one per (fund, class, month) */
function flattenFundJSON(payload) {
  const rows = [];
  for (const f of payload.funds || []) {
    for (const c of (f.classes || [])) {
      for (const s of (c.series || [])) {
        for (const m of (s.months || [])) {
          rows.push({
            as_of_batch: payload.as_of_batch ?? null,
            fund_name: f.fund_name,
            as_of: f.as_of ?? null,
            base_currency: f.base_currency ?? null,
            class_name: c.class_name,
            year: s.year,
            date: m.date,            // "YYYY-MM"
            nav: m.nav === null || m.nav === undefined ? null : Number(m.nav),
            return_pct: m.return_pct === null || m.return_pct === undefined ? null : Number(m.return_pct),
            class_ytd_pct: s.ytd_pct === null || s.ytd_pct === undefined ? null : Number(s.ytd_pct),
          });
        }
      }
    }
  }
  return rows;
}

exports.fundLevel = async (req, res) => {
  try {
    const data = await loadFundLevelJSON();
    const { fund, as_of, class_name, flat } = req.query;

    // Filter funds
    let funds = data.funds || [];
    if (fund) funds = funds.filter((f) => f.fund_name === fund);
    if (as_of) funds = funds.filter((f) => (f.as_of || "") === as_of);

    // Filter classes if requested
    if (class_name) {
      funds = funds.map((f) => ({
        ...f,
        classes: (f.classes || []).filter((c) => c.class_name === class_name),
      }));
    }

    const out = { as_of_batch: data.as_of_batch ?? null, funds };

    if (String(flat).toLowerCase() === "true") {
      return res.json(flattenFundJSON(out));
    }
    return res.json(out);
  } catch (err) {
    console.error("fundLevel:", err);
    return res.status(500).json({ error: "failed_to_load_fund_level_json", detail: err.message });
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

  const after = req.query.after ?? null; // "YYYY-MM-DD"
  const limit = Number(req.query.limit ?? 30); // default 30
  const fundId = req.query.fund_id ? Number(req.query.fund_id) : null;

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
      [fundId]
    );

    res.json(rows);
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

  const entries = Object.entries(rates || {})
    .map(([y, v]) => [Number(y), Number(v)])
    .filter(([yr, pct]) => Number.isFinite(yr) && yr >= 2000 && yr <= 2100 && Number.isFinite(pct) && pct >= 0 && pct <= 100);

  const delYears = Array.isArray(delete_years)
    ? delete_years.map(Number).filter((y) => Number.isFinite(y) && y >= 2000 && y <= 2100)
    : [];

  const uid = req.auth?.sub ?? null;

  try {
    await pool.query("BEGIN");

    if (delYears.length) {
      await pool.query(
        `DELETE FROM dividend_yield
          WHERE fund_id = $1 AND yr = ANY($2::int[])`,
        [fundId, delYears]
      );
    }

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

/* ======================================================================
   NEW for Fund Level (DB-backed):
   - GET /dashboard/fund-classes?fund_id=<id>
   - GET /dashboard/fund-level-db?fund_id=<id>&class_name=<name>&flat=true
   ====================================================================== */

/** GET /dashboard/fund-classes?fund_id=<id>
 *  → ["Class A - Lead Series", "Class B - Lead Series", ...]
 */
exports.listFundClasses = async (req, res) => {
  const fundId = Number(req.query.fund_id);
  if (!Number.isFinite(fundId)) {
    return res.status(400).json({ error: "fund_id is required" });
  }

  try {
    const { rows } = await pool.query(
      `SELECT DISTINCT class_name
         FROM dashboard.fund_level
        WHERE fund_id = $1
        ORDER BY class_name`,
      [fundId]
    );
    res.json(rows.map((r) => r.class_name));
  } catch (err) {
    console.error("listFundClasses:", err);
    res.status(500).json({ error: "server_error" });
  }
};

/** GET /dashboard/fund-level-db?fund_id=<id>&class_name=<name>&flat=true
 *  內部呼叫：SELECT dashboard.fund_class_series($1,$2) AS payload;
 *  - flat=true  → 扁平列 [{ fund_id, class_name, year, date:"YYYY-MM", nav, return_pct, ytd_pct }]
 *  - flat!=true → 原始陣列 [{ year, months:[...] }]
 */
exports.fundLevelDb = async (req, res) => {
  const fundId = Number(req.query.fund_id);
  const className = req.query.class_name || null;
  const flat = String(req.query.flat || "false").toLowerCase() === "true";

  if (!Number.isFinite(fundId)) {
    return res.status(400).json({ error: "fund_id is required" });
  }
  if (!className) {
    return res.status(400).json({ error: "class_name is required" });
  }

  try {
    // 你的 SQL function 定義為 p_year 預設 NULL，因此兩參數呼叫即可
    const { rows } = await pool.query(
      "SELECT dashboard.fund_class_series($1,$2) AS payload;",
      [fundId, className]
    );

    const payload = rows?.[0]?.payload || []; // [{year, months:[{month, nav, return_pct, ytd_pct}, ...]}]

    if (!flat) {
      return res.json(payload);
    }

    // 扁平化供 chart 綁定
    const out = [];
    for (const y of payload) {
      for (const m of (y.months || [])) {
        out.push({
          fund_id: fundId,
          class_name: className,
          year: Number(y.year),
          date: m.month,                                 // "YYYY-MM"
          nav: m.nav == null ? null : Number(m.nav),
          return_pct: m.return_pct == null ? null : Number(m.return_pct),
          ytd_pct: m.ytd_pct == null ? null : Number(m.ytd_pct),
        });
      }
    }
    return res.json(out);
  } catch (err) {
    console.error("fundLevelDb:", err);
    return res.status(500).json({ error: "server_error", detail: err.message });
  }
};
