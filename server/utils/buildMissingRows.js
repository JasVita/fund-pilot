/**
 * buildMissingRows()
 * ------------------
 * • Accepts the raw “existing‐snapshot” rows returned from Postgres
 * • Groups them by fund_id
 * • Works out, fund‑by‑fund, whether every snapshot lands on a
 *   quarter–end (→ quarterly) or not (→ monthly)
 * • Builds the full calendar from the first snapshot through
 *   last‑month (current‑month – 1)
 * • Emits 1 row for every month/quarter that is **missing**
 * • Result is already sorted:  fund_id ↑ , missing_month ↓
 *
 *  =>  [
 *        { fund_id: 3, missing_month: '2025‑03',
 *          frequency: 'quarterly',  missing_quarter: '2025‑Q1' },
 *        { fund_id: 1, missing_month: '2025‑02',
 *          frequency: 'monthly',    missing_quarter: null },
 *        …
 *      ]
 */
function buildMissingRows(raw /* : { fund_id:number; snapshot_month:string }[] */) {
  const QUART_END = [3, 6, 9, 12];
  const lastMonth = new Date();
  lastMonth.setDate(1);
  lastMonth.setMonth(lastMonth.getMonth() - 1);

  const byFund = new Map();
  for (const r of raw) {
    if (!byFund.has(r.fund_id)) byFund.set(r.fund_id, new Set());
    byFund.get(r.fund_id).add(r.snapshot_month);
  }

  const out = [];
  for (const [fund_id, months] of byFund.entries()) {
    const isQuarterly = [...months].every(m =>
      QUART_END.includes(Number(m.slice(5)))
    );
    const freq = isQuarterly ? "quarterly" : "monthly";

    const first = [...months].sort()[0];
    let [y, m] = first.split("-").map(Number);
    let cur = new Date(y, m - 1, 1);

    while (cur <= lastMonth) {
      const mm = cur.getMonth() + 1;                  // 1‑12  ✅ local
      const ym = `${cur.getFullYear()}-${String(mm).padStart(2, '0')}`; // ✅
      const isQE = QUART_END.includes(mm);
      const shouldCheck = freq === "monthly" || isQE;

      if (shouldCheck && !months.has(ym)) {
        out.push({
          fund_id,
          missing_month: ym,
          frequency: freq,
          missing_quarter:
            freq === "quarterly" ? `${cur.getFullYear()}-Q${Math.ceil(mm / 3)}` : null,
        });
      }
      cur.setMonth(cur.getMonth() + 1);
    }
  }

  out.sort(
    (a, b) =>
      a.fund_id - b.fund_id ||
      (a.missing_month < b.missing_month ? 1 : -1)
  );
  return out;
}

module.exports = buildMissingRows;