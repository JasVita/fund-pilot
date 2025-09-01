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
