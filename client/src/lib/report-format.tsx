// report-format.ts – shared helpers for PDF / PPT generators
// ----------------------------------------------------------
import React from "react";

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

// ────────────────────────────────────────────────────────────────
// Multi-line numeric tokens with optional trailing [TAG] handling
// Example tokens: "289,485.14 [贖回]", "247,621.32", "—"
// ────────────────────────────────────────────────────────────────

/** Split multi-line string into tokens, trimming blanks but preserving order. */
export const splitLinesStrict = (s: string | null | undefined): string[] =>
  (s ?? "").split("\n").map(x => x.trim()).filter(x => x.length > 0);

/** Extracts a numeric value and an optional trailing tag in [BRACKETS]. */
export const parseNumberAndTag = (token: string): {
  value: number | null;             // parsed numeric part (commas tolerated)
  tag: string | null;               // e.g. "贖回" when token ends with "[贖回]"
  raw: string;                      // original token
} => {
  const raw = token;
  // capture trailing [ ... ] if present (at end), allow any non-] chars
  const m = token.match(/\s*\[([^\]]+)\]\s*$/);
  const tag = m ? m[1].trim() : null;

  // strip the trailing [tag] for numeric parsing
  const withoutTag = m ? token.slice(0, m.index).trim() : token.trim();

  // tolerate commas and lone trailing dot
  const num = parseFloat(withoutTag.replace(/,/g, "").replace(/\.$/, ""));
  const value = Number.isFinite(num) ? num : null;

  return { value, tag, raw };
};

/** Formats the numeric value if present; otherwise returns the original token (minus trailing dot). */
export const formatNumberToken = (token: string): string => {
  const { value } = parseNumberAndTag(token);
  if (value === null) return token.replace(/\.$/, "");
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value);
};

/** Preserves the original text for title/tooltips (keeps tags). */
export const titleFromMultilinePreserve = (s: string | null | undefined): string =>
  (s ?? "").trim();

/** Like fmtNumListStr but preserves trailing [TAG] text. */
export const fmtNumListStrKeepTags = (s: string | null | undefined): string =>
  splitLinesStrict(s).map((token) => {
    const { value, tag } = parseNumberAndTag(token);
    const main = value === null
      ? token.replace(/\.$/, "")
      : new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value);
    return tag ? `${main} [${tag}]` : main;
  }).join("\n");


/** Renders multi-line tokens as JSX, formatting numbers and showing [TAG] as a small badge. */
export const renderNumLinesWithBadges = (s: string | null | undefined): React.ReactElement => (
  <>
    {splitLinesStrict(s).map((token, i, arr) => {
      const { value, tag, raw } = parseNumberAndTag(token);
      const main = value === null
        ? raw.replace(/\.$/, "")
        : new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value);

      return (
        <span key={i} className="whitespace-nowrap">
          <span className="font-mono">{main}</span>
          {tag && (
            <span className="ml-1 align-[2px] text-[10px] rounded px-1 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200">
              {tag}
            </span>
          )}
          {i !== arr.length - 1 && <br />}
        </span>
      );
    })}
  </>
);

/** Render YYYY-MM per line and show trailing [TAG] as a badge (e.g., [贖回]) */
export const renderDateLinesWithBadges = (
  s: string | null | undefined
): React.ReactElement => {
  const parts = splitLines(s);
  return (
    <>
      {parts.map((token, i) => {
        const m = token.match(/\s*\[([^\]]+)\]\s*$/);
        const tag = m ? m[1].trim() : null;
        const raw = m ? token.slice(0, m.index).trim() : token.trim();

        const dt = new Date(raw);
        const str = !Number.isNaN(dt.getTime())
          ? `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`
          : raw;

        return (
          <span key={i} className="whitespace-nowrap">
            <span>{str}</span>
            {tag && (
              <span className="ml-1 align-[2px] text-[10px] rounded px-1 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200">
                {tag}
              </span>
            )}
            {i !== parts.length - 1 && <br />}
          </span>
        );
      })}
    </>
  );
};
