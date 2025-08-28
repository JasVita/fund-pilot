// report-format.ts – shared helpers for PDF / PPT generators
// ----------------------------------------------------------

// ---- basic coercion --------------------------------------
export const toStr = (v: string | number | null | undefined): string =>
  v == null ? "" : String(v);

// ---- string helpers --------------------------------------
export const splitLines = (s: string | null | undefined): string[] =>
  toStr(s).split(/\r?\n/).map((x) => x.trim()).filter(Boolean);

// ---- date helpers ---------------------------------------- /* ★ give “2023-04\n2023-09” → “2023-04\n2023-09” (each part YYYY-MM) */
export const fmtYYYYMM = (raw: string | null | undefined): string =>
  splitLines(raw)
    .map((part) => {
      const d = new Date(part);
      return isNaN(d.getTime())
        ? part
        : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    })
    .join("\n");

/** NEW: multi-line → "YYYY-MM" per token, joined with "\n" */
export const fmtDateListStr = (s: string | null | undefined): string =>
  splitLines(s)
    .map((d) => {
      const dt = new Date(d);
      return !isNaN(dt.getTime())
        ? `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`
        : d;
    })
    .join("\n");

// ---- money helpers --------------------------------------- /* ★ keeps multiple numbers, formats each one -> “280,000.00\n500,000.00” */
export const fmtMoney = (raw: string | null | undefined): string =>
  splitLines(raw)
    .map((part) => {
      const n = Number(part.replace(/,/g, ""));
      return !Number.isFinite(n) || n === 0
        ? ""
        : n.toLocaleString("en-US", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          });
    })
    .join("\n");

export const fmtMoneyLines = (v: string | null | undefined): string =>
  splitLines(v).map(fmtMoney).join("\n");

export const to2dp = (s: string): string => {
  const n = Number(s.replace(/,/g, ""));
  return isNaN(n) ? s : n.toFixed(2);
};

/** NEW: multi-line numeric tokens → en-US number strings */
export const fmtNumListStr = (s: string | null | undefined): string =>
  splitLines(s)
    .map((token) => {
      const n = parseFloat(token.replace(/,/g, "").replace(/\.$/, ""));
      return Number.isFinite(n)
        ? new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(
            n,
          )
        : token.replace(/\.$/, "");
    })
    .join("\n");

// ---- name / string utils ---------------------------------
export const initials = (full: string): string =>
  full.trim().split(/\s+/).map((w) => w[0].toUpperCase()).join("");
