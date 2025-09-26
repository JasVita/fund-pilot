export const fmt = (v: unknown) =>
  v == null || v === "" ? "—" : Number(v).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

/* ── NEW: general UI-friendly formatters ───────────────────────── */
export const fmtNum = (v: number) =>
  new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(v);

export const usd = (v: number, compact = false) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: compact ? "compact" : "standard",
    maximumFractionDigits: compact ? 1 : 2,
  }).format(v);

export const usdStd = (v: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(v);

export const parseLooseNumber = (raw: string): number | null => {
  const num = parseFloat(raw.replace(/,/g, "").replace(/\.$/, ""));
  return Number.isFinite(num) ? num : null;
};

/** Matches old grid helper: accepts string|number, up to 2dp, en-US. */
export const fmtMoneyEnUS = (v: string | number) =>
  Number.isFinite(+v)
    ? (+v).toLocaleString("en-US", { maximumFractionDigits: 2 })
    : String(v);
/* ──────────────────────────────────────────────────────────────── */

export const fetchJson = async <T = any>(
  url: string,
  init?: RequestInit,
): Promise<T> => {
  const r = await fetch(url, { credentials: "include", ...init });
  try {
    return (await r.json()) as T;
  } catch {
    // non-JSON response ⇒ return empty object so the caller gets []
    console.error(`[fetchJson] ${url} returned non-JSON`, r.status);
    return {} as T;
  }
};

// formats numbers with thousands separators; works for string | number
export const fmtThousands = (v: unknown, maximumFractionDigits = 2): string => {
  const n =
    typeof v === "number"
      ? v
      : Number(String(v ?? "").replace(/,/g, "")); // tolerate "123,456.78"
  return Number.isFinite(n)
    ? n.toLocaleString("en-US", {
        minimumFractionDigits: 0,
        maximumFractionDigits,
      })
    : "—";
};

/** Format a date-like string to YYYY-MM-DD (en-CA). */
export const fmtDateYMD = (s: string): string => {
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? s : d.toLocaleDateString("en-CA");
};

/** Ask the server to format the investor display name (uses your /investors/format-name route). */
export const formatInvestorDisplay = async (
  apiBase: string | undefined,
  rawName: string,
  opts?: { initials?: boolean }
): Promise<string> => {
  const base = (apiBase?.trim() || window.location.origin).replace(/\/$/, "");
  const u = new URL(`${base}/investors/format-name`);
  u.searchParams.set("name", rawName);
  try {
    const res = await fetch(u.toString(), { credentials: "include" });
    const txt = res.ok ? (await res.text()).trim() : rawName;
    const formatted = txt || rawName;
    if (opts?.initials) {
      // Take first letter of each alphabetical token, uppercase; e.g. "Sun Hong Yu" -> "SHY"
      const parts = formatted.match(/[A-Za-z]+/g) || [];
      const abbr = parts.map(w => w[0]?.toUpperCase() ?? "").join("");
      return abbr || "FILES";
    }
    return formatted;
  } catch {
    if (opts?.initials) {
      const parts = String(rawName).match(/[A-Za-z]+/g) || [];
      const abbr = parts.map(w => w[0]?.toUpperCase() ?? "").join("");
      return abbr || "FILES";
    }
    return rawName;
  }
};

/** Today in YYYY-MM-DD. */
export const todayStr = (): string => {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

/** Split a possibly multi-line string into lines (keeps order, trims each) */
export const splitLines = (s?: string | null): string[] =>
  String(s ?? "")
    .split("\n")
    .map(x => x.trim())
    .filter(Boolean);

/** Format each line to YYYY-MM if it’s a valid date; otherwise keep original.
 *  Returns an array of strings (no JSX) so callers decide how to render.
 */
export const fmtDateList = (s: string | null | undefined): string[] =>
  splitLines(s).map((d) => {
    const dt = new Date(d);
    return !Number.isNaN(dt.getTime())
      ? `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`
      : d;
  });

/** Compact USD (e.g., 12.3M) */
export const usdCompact = (v: number) => usd(v, true);

/** USD axis tick label: compact, 0-dp (for charts) */
export const usdAxisTick = (v: number) =>
    new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
    notation: "standard", // <-- forces no K/M
  }).format(v);

/** Percentage label like "12.3%", or "—" if not finite */
export const pctLabel = (v: number | null | undefined, digits = 1) =>
  Number.isFinite(Number(v)) ? `${Number(v).toFixed(digits)}%` : "—";

// ── Date helpers (month label <-> ISO) ────────────────────────────
/** "June 2025" -> "2025-06" */
export const uiMonthToIso = (label: string) => {
  const [name, year] = label.split(" ");
  const m = new Date(`${name} 1, ${year}`).getMonth() + 1; // 0-based
  return `${year}-${String(m).padStart(2, "0")}`;
};

/** "2025-01-31" (or any date-like) -> "January 2025" */
export const monthYearLabel = (input: string | Date) => {
  const d = new Date(input);
  return Number.isNaN(d.getTime())
    ? String(input)
    : d.toLocaleString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
};
