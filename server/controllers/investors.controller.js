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
      page: 1,
      pageCount: 1,
      rows,
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
    // console.log("formatInvestorName:", formatted);
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
 * curl -H "Cookie: fp_jwt=$JWT" "http://localhost:5003/investors/holdings/dividends?investor=Feng%20Fan&fund_id=5"
 * ------------------------------------------------------------------ */
exports.investorDividends = async (req, res) => {
  const investor = (req.query.investor ?? "").trim();
  const fundId = req.query.fund_id ? Number(req.query.fund_id) : null;

  if (!investor) return res.status(400).json({ error: "?investor= is required" });

  try {
    const sql = `
      SELECT *
        FROM get_investor_dividends($1::text) d
       WHERE $2::int IS NULL
          OR d.fund_id = $2::int
       -- ORDER BY d.paid_date DESC;`;

    const { rows } = await pool.query(sql, [investor, fundId]);

    /* shape the response ------------------------------------------ */
    res.json({ investor, rows });
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

/**
 * GET /investors/files?fund_id=2&investor=Feng%20Fan&limit=50&offset=0&sort=desc
 * curl -H "Cookie: fp_jwt=$JWT"   "http://localhost:5103/investors/files?fund_id=2&investor=Feng%20Fan"
 * Returns rows from fund_files: id, investor_name, as_of, type, class, fund_id, url
 * - fund_id is required
 * - investor is required (we do loose/similarity matching; fallback to fund-only if no match)
 */
exports.listInvestorFiles = async (req, res) => {
  const fundId = req.query.fund_id ? Number(req.query.fund_id) : null;
  const investorRaw = (req.query.investor || "").trim();
  const limit  = Math.min(Number(req.query.limit || 100), 500);
  const offset = Math.max(Number(req.query.offset || 0), 0);
  const sort   = String(req.query.sort || "desc").toLowerCase() === "asc" ? "ASC" : "DESC";

  if (!fundId)      return res.status(400).json({ error: "fund_id is required" });
  if (!investorRaw) return res.status(400).json({ error: "investor is required" });

  try {
    // STRICT (case-insensitive) match on investor name, same fund_id.
    // We normalize by trimming and lowercasing on both sides; no LIKE, no trgm.
    const sql = `
      WITH p AS (
        SELECT $1::int  AS fund_id,
               btrim($2::text) AS investor_norm
      )
      SELECT f.id, f.investor_name, f.as_of, f.type, f.class, f.fund_id, f.url
        FROM fund_files f, p
       WHERE f.fund_id = p.fund_id
         AND lower(btrim(f.investor_name)) = lower(p.investor_norm)
       ORDER BY f.as_of ${sort}, f.id ${sort}
       LIMIT $3 OFFSET $4;
    `;
    const { rows } = await pool.query(sql, [fundId, investorRaw, limit, offset]);
    res.json({ fund_id: fundId, investor: investorRaw, count: rows.length, rows });
  } catch (err) {
    console.error("listInvestorFiles:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

const archiver = require("archiver");
const { Readable } = require("stream");

/**
 * GET /investors/files/zip?fund_id=2&investor=Feng%20Fan&ids=1,2,3
 * Streams a zip named "<investor>_YYYY-MM-DD.zip".
 * File names inside zip: "<type>_<class>_<YYYYMMDD><ext>"
 * - fund_id (required)
 * - investor (required, strict case-insensitive equality in DB)
 * - ids (optional, comma-separated list of fund_files.id to restrict)
 * - curl -H "Cookie: fp_jwt=$JWT" \
     -L -o "Feng_Fan_$(date +%F).zip" \
     "http://localhost:5103/investors/files/zip?fund_id=2&investor=Feng%20Fan&sort=desc"
 */
exports.zipInvestorFiles = async (req, res) => {
  const fundId = req.query.fund_id ? Number(req.query.fund_id) : null;
  const investorRaw = (req.query.investor || "").trim();
  const sort   = String(req.query.sort || "desc").toLowerCase() === "asc" ? "ASC" : "DESC";
  const idsCsv = (req.query.ids || "").trim();

  if (!fundId)      return res.status(400).json({ error: "fund_id is required" });
  if (!investorRaw) return res.status(400).json({ error: "investor is required" });

  // sanitize & parse ids (optional)
  let ids = null;
  if (idsCsv) {
    ids = idsCsv
      .split(",")
      .map(s => Number(s.trim()))
      .filter(n => Number.isFinite(n) && n > 0);
    if (!ids.length) ids = null;
  }

  // filename helpers
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm   = String(today.getMonth() + 1).padStart(2, "0");
  const dd   = String(today.getDate()).padStart(2, "0");

  const initials = (s) => {
  const parts = String(s || "").split(/[^A-Za-z]+/).filter(Boolean);
  const abbr = parts.map(w => w[0].toUpperCase()).join("");
  return abbr || "FILES";
  };
  const zipFileName = `${initials(investorRaw)}_${yyyy}-${mm}-${dd}.zip`;

  try {
    // 1) fetch the rows we want to zip (strict investor match, same fund)
    //    and optional restriction by ids
    const params = [fundId, investorRaw];
    let whereIds = "";
    if (ids && ids.length) {
      whereIds = ` AND f.id = ANY($3::int[]) `;
      params.push(ids);
    }

    const sql = `
      WITH p AS (
        SELECT $1::int AS fund_id, btrim($2::text) AS investor_norm
      )
      SELECT f.id, f.investor_name, f.as_of, f.type, f.class, f.fund_id, f.url
        FROM fund_files f, p
       WHERE f.fund_id = p.fund_id
         AND lower(btrim(f.investor_name)) = lower(p.investor_norm)
       ${whereIds}
       ORDER BY f.as_of ${sort}, f.id ${sort};
    `;

    const { rows } = await pool.query(sql, params);

    if (!rows.length) {
      return res.status(404).json({ error: "No files found for that investor/fund" });
    }

    // 2) set zip headers
    res.setHeader("Content-Type", "application/zip");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${zipFileName}"`
    );

    // helps some proxies/browsers to show download UI ASAP
    res.setHeader("Transfer-Encoding", "chunked");
    if (typeof res.flushHeaders === "function") {
      try { res.flushHeaders(); } catch {}
    }

    // 3) create the zip stream
    const archive = archiver("zip", { zlib: { level: 9 } });
    archive.on("error", (err) => {
      console.error("zip error:", err);
      if (!res.headersSent) res.status(500);
      res.end();
    });
    archive.pipe(res);

    // 4) generate unique names & append each URL as a zipped entry
    const seen = new Map(); // name => count

    const pad = (n) => String(n).padStart(2, "0");
    const fmtAsOf = (s) => {
      const d = new Date(s);
      if (Number.isNaN(d.getTime())) return "00000000";
      return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
    };

    const slug = (s) =>
      (s || "")
        .toLowerCase()
        .normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "") || "na";
    const clean = (s) => slug(s);

    // Process with small concurrency to reduce total time
    const CONCURRENCY = 4;
    let index = 0;
    async function worker() {
      while (index < rows.length) {
        const r = rows[index++];
        // compute entry name
        const extFromUrl = (() => {
          try {
            const u = new URL(r.url);
            const m = u.pathname.match(/\.([a-z0-9]+)$/i);
            return m ? `.${m[1].toLowerCase()}` : ".pdf";
          } catch { return ".pdf"; }
        })();
        const typeMap = { is: "investor-statement", cn: "contract-note", other: "other" };
        const shortType  = typeMap[String(r.type || "").toLowerCase()] || slug(r.type);
        const shortClass = slug(r.class);
        const dayStr     = fmtAsOf(r.as_of);
        let baseName = `${shortType}_${shortClass}_${dayStr}${extFromUrl}`;
        if (seen.has(baseName)) {
          const n = seen.get(baseName) + 1;
          seen.set(baseName, n);
          const dot = baseName.lastIndexOf(".");
          baseName = `${baseName.slice(0, dot)}_${n}${baseName.slice(dot)}`;
        } else {
          seen.set(baseName, 1);
        }
        try {
          const resp = await fetch(r.url);
          if (!resp.ok || !resp.body) {
            console.warn("skip url (bad response):", r.url, resp.status);
            continue;
          }
          const nodeStream = Readable.fromWeb(resp.body);
          archive.append(nodeStream, { name: baseName });
        } catch (e) {
          console.warn("skip url (fetch error):", r.url, e?.message);
        }
      }
    }
    await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));
    // finalize after all entries queued
    archive.finalize();

  } catch (err) {
    console.error("zipInvestorFiles:", err);
    if (!res.headersSent) res.status(500).json({ error: "Internal Server Error" });
  }
};

/* unchanged: listInvestors() */
exports.listInvestors = async (req, res) => {
  const cid = req.auth.role === "super" ? req.query.company_id || req.auth.company_id : req.auth.company_id;
  const { rows } = await pool.query("SELECT * FROM investors WHERE company_id = $1;", [cid]);
  res.json(rows);
};
