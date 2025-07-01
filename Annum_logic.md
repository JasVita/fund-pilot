# Investor Portfolio Overview

## 1 .  Find the latest snapshot for that fund

<table>
<tr><th>Column in UI</th><th>Rule / expression</th><th>SQL</th></tr>
<tr><td><em>snapshot_id</em> (internal)</td>
<td>Newest <code>id</code> in <code>holdings_snapshot</code> for that <code>fund_id</code></td>
<td>

```sql
WITH snaps AS (
  SELECT hs.id, hs.snapshot_date
  FROM   holdings_snapshot hs
  JOIN   v_fund_lookup vl ON vl.name = hs.fund_name
  WHERE  vl.fund_id = 2
)
SELECT id
FROM   snaps
ORDER  BY snapshot_date DESC, id DESC
LIMIT  1;          -- say this returns snapshot_id = 64
```

</td></tr>
</table>

---

## 2 . Build *base* rows (now sourced from `investor_fund_map`)

| UI column       | Rule (where the value comes from)                                                                                           | SQL fragment                   |
| --------------- | --------------------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| **Investor**    | every `investor_name` linked to the chosen `fund_id` in **investor\_fund\_map** (so even “inactive” names appear)           | `im.investor_name AS investor` |
| **Class**       | most-recent `class` for that investor in **holdings\_detail** of the latest snapshot (may be `NULL` for inactive investors) | `hd.class`                     |
| **Number Held** | same join as above – `number_held`; `NULL` if the investor isn’t in the latest snapshot                                     | `hd.number_held`               |
| **Current NAV** | same join – `nav_value`; `NULL` if not in latest snapshot                                                                   | `hd.nav_value`                 |

```sql
/* fund_id = 2 is just an example ─ replace with the one the user selected */
WITH base AS (
  SELECT
      im.investor_name AS investor,
      hd.class,
      hd.number_held,
      hd.nav_value
  FROM   investor_fund_map im
  LEFT   JOIN holdings_detail hd
         ON  hd.investor_name = im.investor_name
         AND hd.snapshot_id   = 64
  WHERE  im.fund_id = 2
)
SELECT *
FROM   base
ORDER  BY                                -- ① active rows first
         (class IS NULL),                --    (FALSE = active, TRUE = inactive)
         class,                          -- ② alphabetical by class
         investor;  
```

*Result*: one row per **all** investors ever mapped to the fund; those present in the latest snapshot carry real *Class / Number Held / Current NAV*, while the rest show `NULL` (so your UI can flag them “inactive” by default).

---

## 3 . Unpaid Redeem (**active investors only**)

### Mathematical rule

For each investor *i* that appears in the **latest snapshot** of the chosen fund *F* :

$$
\text{UnpaidRedeem}_{i}
=\Bigl|\;\sum_{\substack{\text{fund\_id}=F,\\
                         \text{settled}= \text{FALSE},\\
                         \text{nav\_delta}<0,\\
                         \text{investor}=i}}
          \text{nav\_delta}\Bigr|
$$

* Take only **un-settled** rows (`settled = FALSE`) in `holdings_change`.
* Restrict to that fund `fund_id = F`.
* Optional but safer: keep only negative `nav_delta` (redemptions).
* Use `ABS()` to turn the negative sum into a positive “amount still unpaid”.
* Investors that are **inactive** (not in the latest snapshot) are excluded.


```sql
/* Parameters you already know:
     fund_id      = 2
     snapshot_id  = 64   -- latest snapshot for that fund            */

WITH active AS (                     -- names present in latest snapshot
  SELECT DISTINCT investor_name
  FROM   holdings_detail
  WHERE  snapshot_id = 64
),

redeem AS (                          -- unpaid redeem per active investor
  SELECT
      a.investor_name,
      ABS(COALESCE(SUM(hc.nav_delta), 0)) AS unpaid_redeem
  FROM   active               a
  LEFT   JOIN holdings_change hc
         ON  hc.investor_name = a.investor_name
         AND hc.fund_id       = 2
         AND hc.settled       = FALSE
         AND hc.nav_delta     < 0        -- (only redemption deltas)
  GROUP  BY a.investor_name
)

SELECT *
FROM   redeem
ORDER  BY unpaid_redeem DESC;        -- or any ordering you prefer
```

*If an active investor has **no** unsettled redemptions, `SUM(nav_delta)` is `NULL`;
`COALESCE(..., 0)` converts that to `0`, so the column is always numeric.*

## 4 . **Status** 

### Mathematical rule

Let

* **F** = chosen `fund_id` (e.g. 2)
* **S** = `snapshot_id` of the latest snapshot for **F**

$$
\text{Universe}_F \;=\; \{\, i \mid (i,F) \in \text{investor\_fund\_map}\,\}
$$

$$
\text{ActiveSet}_{F,S} \;=\; \{\, i \mid i \in \text{Universe}_F
\;\land\;
\exists\,\text{row in holdings\_detail with } \text{snapshot\_id}=S \text{ and investor\_name}=i \,\}
$$

For every investor $i \in \text{Universe}_F$:

$$
\text{Status}_i =
  \begin{cases}
    \text{‘active’}   &\text{if } i \in \text{ActiveSet}_{F,S}\\[6pt]
    \text{‘inactive’} &\text{otherwise}
  \end{cases}
$$

---


```sql
-- \set fund_id      2     -- chosen fund
-- \set snapshot_id  64    -- latest snapshot for that fund

WITH live AS (               -- investors in the latest snapshot (active)
  SELECT DISTINCT investor_name
  FROM   holdings_detail
  WHERE  snapshot_id = 64
),
everyone AS (                -- all historical investors for the fund
  SELECT investor_name
  FROM   investor_fund_map
  WHERE  fund_id = 2
)
SELECT
    e.investor_name,
    CASE WHEN l.investor_name IS NOT NULL
         THEN 'active'
         ELSE 'inactive'
    END AS status
FROM   everyone e
LEFT   JOIN live l USING (investor_name)
ORDER  BY status DESC,        -- 'active' rows first
         investor;
```

* `everyone` sets the **default** (`inactive`) list from `investor_fund_map`.
* `live` captures the names present in the latest `holdings_detail` snapshot.
* The `LEFT JOIN … USING` toggles the flag to **active** when a match exists.

---

## 5 .  **Final single query** (ready to feed your frontend)

```sql
-- \set fund_id      2      -- chosen fund
-- \set snapshot_id  64     -- latest snapshot_id for that fund

/* ---------------------------------------------------
   1️⃣  Investor universe and live holdings
   --------------------------------------------------- */
WITH everyone AS (             -- all investors ever mapped to the fund
  SELECT investor_name
  FROM   investor_fund_map
  WHERE  fund_id = 2
),

live_holding AS (              -- rows in the latest snapshot (active)
  SELECT
      hd.investor_name,
      hd.class,
      hd.number_held,
      hd.nav_value
  FROM   holdings_detail hd
  WHERE  hd.snapshot_id = 64
),

/* ---------------------------------------------------
   2️⃣  Base grid: active data where available
   --------------------------------------------------- */
base AS (
  SELECT
      e.investor_name                 AS investor,
      lh.class,
      lh.number_held,
      lh.nav_value
  FROM   everyone e
  LEFT   JOIN live_holding lh
         ON lh.investor_name = e.investor_name
),

/* ---------------------------------------------------
   3️⃣  Unsettled redemption tally (active investors only)
   --------------------------------------------------- */
redeem AS (
  SELECT
      investor_name,
      ABS(COALESCE(SUM(nav_delta),0)) AS unpaid_redeem
  FROM   holdings_change hc
  WHERE  hc.fund_id       = 2
    AND  hc.settled       = FALSE
    AND  hc.nav_delta     < 0
    AND  hc.investor_name IN (SELECT investor FROM base WHERE class IS NOT NULL)
  GROUP  BY investor_name
)

/* ---------------------------------------------------
   4️⃣  Final result & ordering
   --------------------------------------------------- */
SELECT
    b.investor,
    b.class,
    b.number_held,
    b.nav_value                       AS current_nav,
    COALESCE(r.unpaid_redeem, 0)      AS unpaid_redeem,
    CASE WHEN b.class IS NOT NULL
         THEN 'active'
         ELSE 'inactive'
    END                               AS status
FROM   base   b
LEFT   JOIN redeem r ON r.investor_name = b.investor
ORDER  BY
         (b.class IS NULL)                         -- 0 (active) ➜ first
       , CASE WHEN COALESCE(r.unpaid_redeem,0)=0
              THEN 1 ELSE 0 END                   -- non-zero redeem before zero
       , b.investor;                               -- alphabetical
```

### Output columns

| investor | class | number\_held | current\_nav | unpaid\_redeem | status |
| -------- | ----- | ------------ | ------------ | -------------- | ------ |

| Sort position | Expression                                                | Meaning                                                  | Effect                                                        |
| ------------- | --------------------------------------------------------- | -------------------------------------------------------- | ------------------------------------------------------------- |
| 1             | `(b.class IS NULL)`                                       | `FALSE` (= 0) for active rows, `TRUE` (= 1) for inactive | puts *active* rows on top                                     |
| 2             | `CASE WHEN COALESCE(unpaid_redeem,0)=0 THEN 1 ELSE 0 END` | flag = 0 for non-zero, flag = 1 for zero                 | within each status, rows with unpaid redemptions appear first |
| 3             | `b.investor`                                              | investor name                                            | alphabetical tie-breaker                                      |


### What each CTE does
| CTE               | Purpose                                                                                                                              |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| **everyone**      | the default list of investors (`inactive` by default) taken from `investor_fund_map` for the chosen fund.                            |
| **live\_holding** | all rows in `holdings_detail` belonging to the latest snapshot, giving *class / number\_held / nav\_value* for **active** investors. |
| **base**          | left-joins **everyone** with **live\_holding** so active investors carry real data and inactive investors show `NULL`s.              |
| **redeem**        | sums *negative, unsettled* `nav_delta` values per **active** investor to produce “Unpaid Redeem”.                                    |
| **final SELECT**  | assembles the UI columns, flags status, and orders rows: active → inactive → class → investor.                                       |

---

## 6 .  Why it stays fresh automatically

* Whenever you load a **new snapshot** the `latest_snap` CTE automatically points to the newest `snapshot_date`.
* The `holdings_change` tally always re-computes on today’s data; no need for extra columns.
* The `investor_fund_map` trigger you created earlier ensures new investor names show up for the status logic.

## Final Function

```sql
/* ===========================================================
   Function: investor_portfolio_overview( fund_id integer )
   -----------------------------------------------------------
   • Finds the *latest* snapshot for the chosen fund.
   • Produces one row per (investor, share-class) holding.
   • Adds two presentation helpers:
         - investor_display        ← name only on first row
         - unpaid_redeem_display   ← amount only on first row;
                                      NULL for inactive-&-zero rows
   • Output columns
       investor, investor_display, class, number_held,
       current_nav, unpaid_redeem, unpaid_redeem_display, status
   • Row-ordering priority
       1. active  →  inactive
       2. rows with   unpaid_redeem <> 0   before those with 0
       3. investor name A-Z
       4. inside each investor block, the row that
          shows the display columns (non-NULL) before its NULL
          duplicates
   ===========================================================*/
CREATE OR REPLACE FUNCTION investor_portfolio_overview (p_fund_id int)
RETURNS TABLE (
    investor               text,
    investor_display       text,
    class                  text,
    number_held            numeric,
    current_nav            numeric,
    unpaid_redeem          numeric,
    unpaid_redeem_display  numeric,
    status                 text
) LANGUAGE sql STABLE AS
$$
/* ---------- 1. latest snapshot id -------------------------------- */
WITH latest_snap AS (
  SELECT hs.id
  FROM   holdings_snapshot hs
  JOIN   v_fund_lookup vl ON vl.name = hs.fund_name
  WHERE  vl.fund_id = p_fund_id
  ORDER  BY hs.snapshot_date DESC, hs.id DESC
  LIMIT  1
),

/* ---------- 2. investor universe --------------------------------- */
everyone AS (
  SELECT investor_name
  FROM   investor_fund_map
  WHERE  fund_id = p_fund_id
),

/* ---------- 3. active rows from that snapshot -------------------- */
live AS (
  SELECT
      hd.investor_name,
      hd.class,
      hd.number_held,
      hd.nav_value
  FROM   holdings_detail hd
  JOIN   latest_snap ls ON ls.id = hd.snapshot_id
),

/* ---------- 4. base grid (inactive ⇒ NULL fields) ---------------- */
base AS (
  SELECT
      e.investor_name       AS investor,
      l.class,
      l.number_held,
      l.nav_value
  FROM   everyone e
  LEFT   JOIN live l ON l.investor_name = e.investor_name
),

/* ---------- 5. unsettled redemptions for ACTIVE investors -------- */
redeem AS (
  SELECT
      investor_name,
      ABS(COALESCE(SUM(nav_delta),0)) AS unpaid_redeem
  FROM   holdings_change hc
  WHERE  hc.fund_id   = p_fund_id
    AND  hc.settled   = FALSE
    AND  hc.nav_delta < 0
    AND  hc.investor_name IN (SELECT investor FROM base WHERE class IS NOT NULL)
  GROUP  BY investor_name
),

/* ---------- 6. merge + status flag ------------------------------ */
merged AS (
  SELECT
      b.investor,
      b.class,
      b.number_held,
      b.nav_value                  AS current_nav,
      COALESCE(r.unpaid_redeem,0)  AS unpaid_redeem,
      CASE WHEN b.class IS NOT NULL THEN 'active'
           ELSE 'inactive' END     AS status
  FROM   base  b
  LEFT   JOIN redeem r ON r.investor_name = b.investor
),

/* ---------- 7. row index inside each (investor , unpaid) group --- */
dedup AS (
  SELECT *,
         ROW_NUMBER() OVER (
           PARTITION BY investor, unpaid_redeem
           ORDER BY (class IS NULL), class
         ) AS dup_idx
  FROM merged
),

/* ---------- 8. add display helpers ------------------------------ */
final_rows AS (
  SELECT
      investor,
      CASE WHEN dup_idx = 1 THEN investor ELSE NULL END         AS investor_display,
      class,
      number_held,
      current_nav,
      unpaid_redeem,
      CASE
        WHEN status = 'inactive' AND unpaid_redeem = 0 THEN NULL
        WHEN dup_idx  > 1                                       THEN NULL
        ELSE unpaid_redeem
      END                                                       AS unpaid_redeem_display,
      status,
      dup_idx
  FROM dedup
)

/* ---------- 9. return ordered result ---------------------------- */
SELECT
    investor,
    investor_display,
    class,
    number_held,
    current_nav,
    unpaid_redeem,
    unpaid_redeem_display,
    status
FROM   final_rows
ORDER  BY
         (status = 'active')            DESC,   -- 1) active first
         (unpaid_redeem <> 0)           DESC,   -- 2) non-zero before zero
         investor,                              -- 3) alphabetical
         (investor_display IS NULL),            -- 4) show-row before blanks
         dup_idx;                               --    (ensures stable order)
$$;

```

### How to use

```sql
SELECT * FROM investor_portfolio_overview(2);   -- 2 = fund_id
```

The function:

* investor_display / unpaid_redeem_display show values only on the
first row for that (investor, unpaid_redeem) pair; duplicates carry NULL.

* Rows with non-zero unpaid redeem precede rows whose amount is zero.

* Ordering is deterministic and updates automatically whenever a new
snapshot is added.
