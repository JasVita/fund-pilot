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
