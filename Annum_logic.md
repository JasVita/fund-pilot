
# 2.1 Investor Portfolio Overview

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

## 3 . Unpaid Redeem (**active investors only – 12-month window**)

### Mathematical rule  (κ = 12 months)

For each investor *i* that is **active** in the latest snapshot *S* of fund *F*:

$$
\text{UnpaidRedeem}^{(\kappa)}_{i}
\;=\;
\sum_{\substack{
   \text{fund\_id}=F,\\
   \text{trade\_type}=\text{‘redemption’},\\
   \text{settled}= \text{FALSE},\\
   \text{trade\_date}\ge S.\text{snapshot\_date}-\kappa,\\
   \text{investor}=i
}}
\text{amount}
$$

* Use **contract\_notes** instead of *holdings\_change*.
* Keep only rows where `trade_type = 'redemption'` **and** `settled = FALSE`.
* Limit to the **rolling last-κ-months** window (κ = 12).
* Sum the **amount** column (already a positive cash value).
* Investors not present in snapshot *S* (inactive) are excluded.

---

### Worked example with real IDs

*Fund* **F = 2** (“Annum Global PE Fund I SP”)
Latest snapshot **id = 64** with `snapshot_date = '2025-03-31'`.

κ = 12 months ⇒ lower bound = **2024-04-01**

---

### SQL (ready to paste)

```sql
/* Parameters you already know:
     fund_id       = 2
     snapshot_id   = 64          -- latest snapshot for that fund
     snap_date     = '2025-03-31'::date   -- ↑ optional, but makes κ easy
*/

/* 1️⃣  active investors in latest snapshot -------------------------- */
WITH active AS (
  SELECT DISTINCT investor_name
  FROM   holdings_detail
  WHERE  snapshot_id = 64                       -- ← latest snapshot
),

/* 2️⃣  unpaid redemption cash within κ-months ----------------------- */
redeem AS (
  SELECT
      cn.investor_name,
      SUM(cn.amount)::numeric AS unpaid_redeem
  FROM   contract_notes cn
  JOIN   active         a  ON a.investor_name = cn.investor_name
  WHERE  cn.fund_id     = 2
    AND  cn.trade_type  = 'redemption'
    AND  cn.settled     = FALSE
    AND  cn.trade_date >= DATE '2025-03-31' - INTERVAL '12 months'
  GROUP  BY cn.investor_name
)

/* 3️⃣  result ------------------------------------------------------- */
SELECT *
FROM   redeem
ORDER  BY unpaid_redeem DESC;     -- most cash outstanding on top
```

| # | Investor (active ↦)                                 | Unpaid Redeem (USD) |
| - | --------------------------------------------------- | ------------------: |
| 1 | Xiang Youjin                                        |          328 684.64 |
| 2 | Qingwen Mao                                         |          289 485.14 |
| 3 | Ming Ying                                           |          239 166.96 |
| 4 | Pan Yue                                             |          238 791.71 |
| 5 | Che Xiao                                            |          238 571.52 |
| 6 | Lu Suzhen                                           |          234 066.94 |
| 7 | International Fund Services & Asset Management S.A. |          229 327.80 |


*(Matches the numbers you supplied; items with no open redemptions
are simply absent from this list.)*

---

### Why it is correct

1. **Time window** – the `trade_date` filter ensures you only look at
   redemptions whose valuation/trade is **within 12 months** before the most
   recent snapshot (rolling window, not calendar year).

2. **Open only** – `settled = FALSE` guarantees we are counting
   *still-unpaid* redemptions.

3. **Active only** – joining to `active` removes investors that have
   fully exited before the latest snapshot.

4. **Absolute cash value** – `amount` in *contract\_notes* is already a
   positive redemption cash flow, so no `ABS()` is needed.

> **If you keep the old *holdings\_change*-based column in your report as well,
> rename one of them to avoid confusion (e.g. `unpaid_redeem_12m`).**

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
WITH everyone AS (
  SELECT investor_name FROM investor_fund_map WHERE fund_id = 2
),
live AS (
  SELECT investor_name, class, number_held, nav_value
  FROM   holdings_detail
  WHERE  snapshot_id = 64
),

/* ---------------------------------------------------
   2️⃣  Base grid: active data where available
   --------------------------------------------------- */
base AS (
  SELECT e.investor_name AS investor,
         l.class, l.number_held, l.nav_value
  FROM   everyone e
  LEFT   JOIN live l USING (investor_name)
),

/* ---------------------------------------------------
   3️⃣  Unsettled redemption tally (active investors only)
   --------------------------------------------------- */
redeem AS (
  SELECT cn.investor_name,
         SUM(cn.amount)::numeric AS unpaid_redeem
  FROM   contract_notes cn
  JOIN   live            l USING (investor_name)   -- active only
  WHERE  cn.fund_id    = 2
    AND  cn.trade_type = 'redemption'
    AND  cn.settled    = FALSE
    AND  cn.trade_date >= DATE '2025-03-31' - INTERVAL '12 months'
  GROUP  BY cn.investor_name
)

/* ---------------------------------------------------
   4️⃣  Final result & ordering
   --------------------------------------------------- */
SELECT
    b.investor,
    b.class,
    b.number_held,
    b.nav_value                        AS current_nav,
    COALESCE(r.unpaid_redeem, 0)       AS unpaid_redeem,
    CASE WHEN b.class IS NOT NULL
         THEN 'active' ELSE 'inactive' END AS status
FROM   base b
LEFT   JOIN redeem r
       ON  r.investor_name = b.investor
ORDER  BY
    CASE WHEN b.class IS NOT NULL THEN 0 ELSE 1 END,            -- active ↑
    CASE WHEN COALESCE(r.unpaid_redeem,0) <> 0 THEN 0 ELSE 1 END, -- non-zero ↑
    b.investor;                              -- alphabetical
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
<!-- | CTE               | Purpose                                                                                                                              |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| **everyone**      | the default list of investors (`inactive` by default) taken from `investor_fund_map` for the chosen fund.                            |
| **live\_holding** | all rows in `holdings_detail` belonging to the latest snapshot, giving *class / number\_held / nav\_value* for **active** investors. |
| **base**          | left-joins **everyone** with **live\_holding** so active investors carry real data and inactive investors show `NULL`s.              |
| **redeem**        | sums *negative, unsettled* `nav_delta` values per **active** investor to produce “Unpaid Redeem”.                                    |
| **final SELECT**  | assembles the UI columns, flags status, and orders rows: active → inactive → class → investor.                                       | -->
| CTE            | Role in the pipeline                                                                                                                                      |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **everyone**   | every investor ever linked to the fund (default = inactive)                                                                                               |
| **live**       | holdings in the latest snapshot → flags who is **active** and supplies `class / number_held / nav_value`                                                  |
| **base**       | left-joins **everyone** with **live** so active rows carry live data and inactive rows show `NULL`s                                                       |
| **redeem**     | **NEW** logic – sums *still-unsettled* redemption **amounts** from **`contract_notes`** for active investors **within the rolling last 12 months** window |
| *final SELECT* | merges everything, tags status, and applies the three-level ordering                                                                                      |

---

## 6 .  Why it stays fresh automatically

| Moving part                 | Why no manual refresh is needed                                                                                                                                                                                |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **latest snapshot**         | The query always fetches the newest row in `holdings_snapshot` for the fund, so “active” status and live positions update themselves.                                                                          |
| **rolling 12-month redeem** | The `redeem` CTE filters `contract_notes.trade_date` to *snapshot\_date – 12 months* … *snapshot\_date*. Each time a redemption is logged **or** a newer snapshot appears, the sum recalculates automatically. |
| **investor universe**       | A trigger on `investor_fund_map` keeps the mapping up-to-date, so newcomers appear in **everyone** without code changes.                                                                                       |

## Final Function

<!-- ```sql
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

``` -->

```sql
/* ===========================================================
   Function : investor_portfolio_overview( p_fund_id int )
   -----------------------------------------------------------
   • Latest snapshot for the fund
   • Rolling-12-month unpaid-redeem from contract_notes
   • Cosmetic helpers:
       investor_display        – only on the first (visible) row
       unpaid_redeem_display   – idem; blank on inactive-&-zero rows
       status_display          – idem; NULL when investor_display = NULL
   • Row-ordering priority
       1) active  →  inactive
       2) unpaid_redeem ≠ 0  →  unpaid_redeem = 0
       3) investor alphabetical
       4) display row before its NULL duplicates
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
    status                 text,
    status_display         text      -- ← NEW
)  LANGUAGE sql  STABLE  AS
$$
/*-----------------------------------------------------------------
  1️⃣  latest snapshot id + its date
------------------------------------------------------------------*/
WITH latest_snap AS (
  SELECT id, snapshot_date
  FROM   holdings_snapshot hs
  JOIN   v_fund_lookup vl  ON vl.name = hs.fund_name
  WHERE  vl.fund_id = p_fund_id
  ORDER  BY hs.snapshot_date DESC, hs.id DESC
  LIMIT  1
),

/*-----------------------------------------------------------------
  2️⃣  investor universe (even if long gone)
------------------------------------------------------------------*/
everyone AS (
  SELECT investor_name
  FROM   investor_fund_map
  WHERE  fund_id = p_fund_id
),

/*-----------------------------------------------------------------
  3️⃣  live holdings in that snapshot  → “active”
------------------------------------------------------------------*/
live AS (
  SELECT
      hd.investor_name,
      hd.class,
      hd.number_held,
      hd.nav_value
  FROM   holdings_detail hd
  JOIN   latest_snap ls ON ls.id = hd.snapshot_id
),

/*-----------------------------------------------------------------
  4️⃣  base grid  (inactive rows get NULLs)
------------------------------------------------------------------*/
base AS (
  SELECT
      e.investor_name          AS investor,
      l.class,
      l.number_held,
      l.nav_value
  FROM   everyone e
  LEFT   JOIN live l USING (investor_name)
),

/*-----------------------------------------------------------------
  5️⃣  rolling-12-month *un-settled* redemption cash
------------------------------------------------------------------*/
redeem AS (
  SELECT
      cn.investor_name,
      SUM(cn.amount)::numeric AS unpaid_redeem
  FROM        contract_notes      cn
  INNER JOIN  live                l  USING (investor_name)   -- active only
  CROSS JOIN  latest_snap         ls                         -- snapshot_date
  WHERE cn.fund_id     =  p_fund_id
    AND cn.trade_type  = 'redemption'
    AND cn.settled     = FALSE
    AND cn.trade_date >= ls.snapshot_date - INTERVAL '12 months'
  GROUP BY cn.investor_name
),

/*-----------------------------------------------------------------
  6️⃣  merge + status flag
------------------------------------------------------------------*/
merged AS (
  SELECT
      b.investor,
      b.class,
      b.number_held,
      b.nav_value               AS current_nav,
      COALESCE(r.unpaid_redeem,0) AS unpaid_redeem,
      CASE WHEN b.class IS NOT NULL THEN 'active'
           ELSE 'inactive' END  AS status
  FROM   base  b
  LEFT   JOIN redeem r ON r.investor_name = b.investor
),

/*-----------------------------------------------------------------
  7️⃣  row index inside (investor , unpaid_redeem) group
------------------------------------------------------------------*/
dedup AS (
  SELECT * ,
         ROW_NUMBER() OVER (
           PARTITION BY investor, unpaid_redeem
           ORDER BY (class IS NULL), class
         ) AS dup_idx
  FROM merged
),

/*-----------------------------------------------------------------
  8️⃣  add the display helpers
------------------------------------------------------------------*/
final_rows AS (
  SELECT
      investor,
      CASE WHEN dup_idx = 1 THEN investor ELSE NULL END           AS investor_display,
      class,
      number_held,
      current_nav,
      unpaid_redeem,
      CASE
        WHEN status = 'inactive' AND unpaid_redeem = 0 THEN NULL
        WHEN dup_idx  > 1                                         THEN NULL
        ELSE unpaid_redeem
      END                                                         AS unpaid_redeem_display,
      status,
      CASE                                                        -- NEW helper
        WHEN dup_idx = 1 THEN status
        ELSE NULL
      END                                                         AS status_display,
      dup_idx
  FROM dedup
)

/*-----------------------------------------------------------------
  9️⃣  ordered output
------------------------------------------------------------------*/
SELECT
    investor,
    investor_display,
    class,
    number_held,
    current_nav,
    unpaid_redeem,
    unpaid_redeem_display,
    status,
    status_display
FROM   final_rows
ORDER  BY
         (status = 'active') DESC,      -- 1) active first
         (unpaid_redeem <> 0)  DESC,    -- 2) non-zero first
         investor,                      -- 3) A-Z
         (investor_display IS NULL),    -- 4) display row ↑
         dup_idx;                       --    tie-breaker
$$;

```
### How to use

```sql
SELECT * FROM investor_portfolio_overview(2);   -- 2 = fund_id
```

# 2.2 Investor Portfolio Overview - Report

`fund_id = 2` | `investor_name = 'Xie Rui'`

All numbers come from **`holdings_change`** only.

---

## Step 0 Base CTE

```sql
WITH c AS (                          -- 👈 the 5 rows below
  SELECT *
  FROM   holdings_change
  WHERE  fund_id       = 2
    AND  investor_name = 'Xie Rui'
  ORDER  BY snapshot_date            -- oldest → newest
)
```

| snapshot\_date | number\_delta |     nav\_delta | note           |
| -------------- | ------------: | -------------: | -------------- |
| **2021-09-30** | **+200.0000** | **203 156.85** | subscription   |
| 2022-01-31     |      −50.6464 |      −1 602.30 | partial redeem |
| 2023-08-31     |     −149.3536 |    −225 098.79 | redeem         |
| **2024-05-31** | **+470.4185** | **571 888.63** | subscription   |
| 2024-10-31     |     −199.6769 |    −255 548.50 | redeem         |

All later CTEs build on `c`.

---

## Step 1 產品名稱 (fund *name*)

```sql
SELECT DISTINCT fund_name FROM c;
```

> **Annum Global Multi-Strategy Fund SPC – Annum Global PE Fund I SP**

---

## Step 2 認購時間 (subscription-date list)

```sql
SELECT string_agg(to_char(snapshot_date,'YYYY-MM'), E'\n')
FROM   c
WHERE  number_delta > 0;
```

Result:

```
2021-09
2024-05
```

Mathematically

$$
\text{SubDates}= \Bigl\{\,d \;\bigl|\; (d,\Delta n,\Delta \$)\in c,\; \Delta n>0 \Bigr\}
$$

---

## **Step 3 數據截止 (data-cut-off list)**

> **Data source has changed** – we now read the redemption *contracts* instead of the position deltas.

| what we want | new 2-part rule                                                                                                                            |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **數據截止**     | ① `contract_notes` rows with `fund_id = 2`, `investor_name = 'Xie Rui'`, `trade_type = 'redemption'` (any `settled`). ordered oldest → newest.<br><br>② **plus** the current **snapshot date** if the investor is **still active** in that snapshot|

#### Mathematical set

Let
- **Logic 1**: *Every redemption contract for the investor*
  * $C_N=\{r\in\texttt{contract\_notes}\mid
      r.fund\_id=2,\;
      r.investor=\text{Xie Rui},\;
      r.trade\_type=\text{‘redemption’}\}, r =rows. \\[6pt]$
  * $$
    \boxed{\;
    \text{CutDates}
          =\bigl\langle r.\text{trade\_date}\bigr\rangle_{r\in C_N}^{\uparrow}  
    \;}
    $$

    (the ↑ means ascending by date).

- **Logic 2**: *The current snapshot date if the investor is still active in that snapshot*
  *  $$
      \newcommand{\CN}{C_{N}}
      \begin{aligned}
      S   &= \text{latest snapshot row for fund 2} \\[4pt]
      \text{CutDates} &=
        \Bigl\langle r.\text{trade\_date}\Bigr\rangle_{r\in\CN}^{\uparrow}\;
        \cup\;
        \begin{cases}
          \bigl\langle S.\text{snapshot\_date}\bigr\rangle &\text{if Xie Rui active in }S\\
          \varnothing &\text{otherwise}
        \end{cases}
      \end{aligned}
      $$

#### SQL (plugged-in test values)

```sql
WITH snap AS (                               -- last snapshot for fund 2
  SELECT id, snapshot_date
  FROM   holdings_snapshot hs
  JOIN   v_fund_lookup vl ON vl.name = hs.fund_name
  WHERE  vl.fund_id = 2
  ORDER  BY hs.snapshot_date DESC, hs.id DESC
  LIMIT  1
),                          -- is the investor inside that snapshot?
active_flag AS (
  SELECT 1
  FROM   holdings_detail hd, snap s
  WHERE  hd.snapshot_id   = s.id
    AND  hd.investor_name = 'Xie Rui'
),
red AS (                                   -- redemption contracts
  SELECT trade_date
  FROM   contract_notes
  WHERE  fund_id       = 2
    AND  investor_name = 'Xie Rui'
    AND  trade_type    = 'redemption'
),
all_dates AS (                             -- union both parts
  SELECT trade_date FROM red
  UNION ALL
  SELECT snapshot_date
  FROM   snap
  WHERE  EXISTS (SELECT 1 FROM active_flag)   -- add only if active
)
SELECT string_agg(to_char(trade_date,'YYYY-MM'),
                  E'\n' ORDER BY trade_date) AS data_cutoff
FROM   all_dates;

```

**Expected result**

```
2024-10
2025-03
```

*(Your table shows only one open redemption contract for Xie Rui, dated 2024-10-02.)*

---

## Step 4 認購金額 (USD list)

```sql
SELECT string_agg(to_char(nav_delta,'FM999,999,999.99'), E'\n')
FROM   c
WHERE  number_delta > 0;
```

Result:

```
203,156.85
571,888.63
```

$$
\text{SubAmounts}= \{\Delta \$ \mid \Delta n>0\}, \qquad
\Sigma_{\text{sub}} = \color{royalblue}{775\,045.48}
$$

---
## **Step 5 市值 (Market-value list)**

| what we want | rule — *single source of truth*                                                                                                                                                                                                                                                                               |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **市值**       | <span style="white-space:nowrap">① all `amount` values</span> from every row in **`contract_notes`** where<br>   `fund_id = 2`, `investor_name = 'Xie Rui'`, `trade_type = 'redemption'`<br>② plus **`nav_value`** taken from the latest snapshot *if and only if* the investor is present (status = active). |

### Mathematical definition

Let

* **latest snapshot** for fund 2 be $S=(\text{id}_S,\;d_S)$;
* $C_R$ be the set of redemption contracts:
  $C_R=\{r\in\texttt{contract\_notes}\mid r.fund\_id=2,\;r.\text{investor}=\text{Xie Rui},\;r.\text{trade\_type}=\text{‘redemption’}\}$
* $A_S$ the (possibly empty) row in **`holdings_detail`** for the same investor and snapshot.

$$
\boxed{%
\text{MvAmounts}=\,
\bigl\langle
     r.\text{amount}
 \bigr\rangle_{r\in C_R}^{\uparrow}
\;\cup\;
\begin{cases}
   \bigl\langle A_S.\text{nav\_value}\bigr\rangle & \text{if }A_S \text{ exists}\\[4pt]
   \varnothing & \text{otherwise}
\end{cases}}
$$

$$
\Sigma_{\text{mv}}=\sum\text{MvAmounts}
$$

### Working SQL ( **fund\_id = 2**, **investor = 'Xie Rui'** )

```sql
WITH snap AS (                       -- latest snapshot for fund = 2
    SELECT id, snapshot_date
    FROM   holdings_snapshot hs
    JOIN   v_fund_lookup vl
           ON vl.name = hs.fund_name      -- ← explicit column match
    WHERE  vl.fund_id = 2
    ORDER  BY hs.snapshot_date DESC, hs.id DESC
    LIMIT  1
),

/* nav_value row only if the investor is ACTIVE -------------------- */
snap_val AS (
    SELECT
        s.snapshot_date  AS trade_date,   -- align column names
        hd.nav_value     AS amount
    FROM   snap s
    JOIN   holdings_detail hd
           ON hd.snapshot_id   = s.id
          AND hd.investor_name = 'Xie Rui'
),

/* every redemption contract (no settled filter any more) ---------- */
red_amt AS (
    SELECT trade_date, amount
    FROM   contract_notes
    WHERE  fund_id       = 2
      AND  investor_name = 'Xie Rui'
      AND  trade_type    = 'redemption'
)

/* union & final list ---------------------------------------------- */
SELECT
    string_agg(to_char(amount,'FM999,999,999.99'),
               E'\n' ORDER BY trade_date) AS market_value,
    SUM(amount)::numeric                  AS total_after_int
FROM (
    SELECT * FROM red_amt
    UNION ALL
    SELECT * FROM snap_val        -- present only if investor is active
) mv_list;
```

**Actual output**

| market\_value            | total\_after\_int |
| ------------------------ | ----------------: |
| 247,621.32<br>335,350.09 |        582,971.41 |

* $247\,621.32$ USD – open redemption contract (2024-10-02)
* $335\,350.09$ USD – NAV value in latest snapshot (2025-03-31)

---

## **Step 6 含息後總額 (Total-After)**

| Item           | new definition                                                             |
| -------------- | -------------------------------------------------------------------------- |
| **TotalAfter** | The **sum of all numbers** in Step 5 (Σ mv). No extra filter on `settled`. |

$$
\boxed{\;
\text{TotalAfter}=\Sigma_{\text{mv}}=582\,971.41
\;}
$$

*(The NAV value is now part of the same total.)*

> **Why we no longer look at `settled`** – the business rule says
> “everything on the market-value list counts”, so we simply add them
> up; `settled` is ignored.

SQL is already included in Step 5 (`SUM(amount)` inside the CTE).

---

### **Step 7 估派息後盈虧 (%)** 

### Formula

$$
\text{PnL\%}=
\frac{\Sigma_{\text{mv}}-\Sigma_{\text{sub}}}{\Sigma_{\text{sub}}}
\times100
=
\frac{\,\color{royalblue}{582\,971.41}-775\,045.48\,}{775\,045.48}
\times100
\approx -24.79\%
$$

#### SQL implementation

```sql
/* ===============================================================
   One-shot PnL% query (subscriptions + redemption cash + live NAV)
   ===============================================================*/

WITH
/* 1️⃣  latest snapshot for the fund ----------------------------------- */
snap AS (
    SELECT id, snapshot_date
    FROM   holdings_snapshot hs
    JOIN   v_fund_lookup     vl
           ON vl.name = hs.fund_name          -- explicit column match
    WHERE  vl.fund_id = 2                     -- << fund filter
    ORDER  BY hs.snapshot_date DESC, hs.id DESC
    LIMIT  1
),

/* 2️⃣  Xie Rui’s nav_value in that snapshot (row exists only if active) */
snap_val AS (
    SELECT
        s.snapshot_date  AS trade_date,       -- align col-names
        hd.nav_value     AS amount
    FROM   snap s
    JOIN   holdings_detail hd
           ON hd.snapshot_id   = s.id
          AND hd.investor_name = 'Xie Rui'    -- << investor filter
),

/* 3️⃣  every redemption contract for the investor -------------------- */
red_amt AS (
    SELECT trade_date, amount
    FROM   contract_notes
    WHERE  fund_id       = 2
      AND  investor_name = 'Xie Rui'
      AND  trade_type    = 'redemption'       -- ignore “settled”
),

/* 4️⃣  Σ mv  =  cash-outs + live NAV  --------------------------------- */
mv AS (
    SELECT SUM(amount) AS mv_sum
    FROM (
        SELECT * FROM red_amt
        UNION ALL
        SELECT * FROM snap_val             -- present only if active
    ) AS unioned
),

/* 5️⃣  Σ sub  =  subscriptions from holdings_change ------------------ */
sub AS (
    SELECT SUM(nav_delta) FILTER (WHERE number_delta > 0) AS sub_sum
    FROM   holdings_change
    WHERE  fund_id       = 2
      AND  investor_name = 'Xie Rui'
)

/* 6️⃣  final % -------------------------------------------------------- */
SELECT
    ROUND( (mv.mv_sum - sub.sub_sum) / sub.sub_sum * 100 , 2 ) AS pnl_pct
FROM   sub, mv;

```

**Expected output**

```
pnl_pct
--------
-24.79
```

---

<!-- > **Recap:**
> *Step 6* now sums `amount` from **contract\_notes** (no more `abs(nav_delta)`), and *Step 7* re-computes PnL % with this new Σ mv value. All other documentation remains intact. -->

## Step 8 Consolidated one-row result

```sql
/* ---------------------------------------------------------------
   Plug-in parameters
   ----------------------------------------------------------------
   :fund_id      ← e.g. 2
   :investor     ← e.g. 'Xie Rui'
   ------------------------------------------------------------- */
WITH
/* ──────────────────────────────────────────────────────────
   1.  latest snapshot id & date for the chosen fund
   ────────────────────────────────────────────────────────── */
latest_snap AS (
    SELECT id, snapshot_date
    FROM   holdings_snapshot hs
    JOIN   v_fund_lookup     vl
           ON vl.name = hs.fund_name         -- explicit column
    WHERE  vl.fund_id = 2                    -- << fund filter
    ORDER  BY hs.snapshot_date DESC, hs.id DESC
    LIMIT  1
),

/* ──────────────────────────────────────────────────────────
   2.  subscriptions (Δn > 0) from holdings_change
   ────────────────────────────────────────────────────────── */
c_sub AS (
    SELECT snapshot_date , nav_delta
    FROM   holdings_change
    WHERE  fund_id       = 2
      AND  investor_name = 'Xie Rui'
      AND  number_delta  > 0
    ORDER  BY snapshot_date
),
sub_dates AS (
    SELECT string_agg(to_char(snapshot_date,'YYYY-MM'), E'\n')
           AS sub_date
    FROM   c_sub
),
sub_amt AS (
    SELECT string_agg(to_char(nav_delta,'FM999,999,999.99'), E'\n')
           AS subscribed,
           SUM(nav_delta)::numeric           AS sub_sum
    FROM   c_sub
),

/* ──────────────────────────────────────────────────────────
   3.  redemption contracts  (no settled filter)
   ────────────────────────────────────────────────────────── */
red_amt AS (
    SELECT trade_date , amount
    FROM   contract_notes
    WHERE  fund_id       = 2
      AND  investor_name = 'Xie Rui'
      AND  trade_type    = 'redemption'
),

/* ──────────────────────────────────────────────────────────
   4.  add live NAV row **iff** investor is active
   ────────────────────────────────────────────────────────── */
live_nav AS (
    SELECT
        s.snapshot_date  AS trade_date,
        hd.nav_value     AS amount
    FROM   latest_snap s
    JOIN   holdings_detail hd
           ON hd.snapshot_id   = s.id
          AND hd.investor_name = 'Xie Rui'
),

/* ──────────────────────────────────────────────────────────
   5.  market-value list  =  red_amt  ∪  live_nav
   ────────────────────────────────────────────────────────── */
mv_list AS (
    SELECT * FROM red_amt
    UNION ALL
    SELECT * FROM live_nav         -- zero rows if not active
),
cut_dates AS (                      -- 數據截止 (= trade_date list)
    SELECT string_agg(to_char(trade_date,'YYYY-MM'),
                      E'\n' ORDER BY trade_date) AS data_cutoff
    FROM   mv_list
),
mv_amt AS (                         -- 市值  (= amount list  + Σmv)
    SELECT
        string_agg(to_char(amount,'FM999,999,999.99'),
                   E'\n' ORDER BY trade_date) AS market_value,
        SUM(amount)::numeric                   AS mv_sum
    FROM   mv_list
),

/* ──────────────────────────────────────────────────────────
   6.  PnL %  =  (Σmv – Σsub) / Σsub
   ────────────────────────────────────────────────────────── */
pnl AS (
    SELECT
        ROUND( (mv_sum - sub_sum) / sub_sum * 100 , 2 ) AS pnl_pct
    FROM sub_amt , mv_amt
),

/* ──────────────────────────────────────────────────────────
   7.  canonical fund name  (any row after filter is fine)
   ────────────────────────────────────────────────────────── */
fund_name AS (
    SELECT fund_name
    FROM   holdings_change
    WHERE  fund_id       = 2
      AND  investor_name = 'Xie Rui'
    LIMIT 1
)

/* ──────────────────────────────────────────────────────────
   8.  final single-row projection  ← feed this to your UI
   ────────────────────────────────────────────────────────── */
SELECT
    (SELECT fund_name   FROM fund_name) AS name,
    (SELECT sub_date    FROM sub_dates) AS sub_date,
    (SELECT data_cutoff FROM cut_dates) AS data_cutoff,
    (SELECT subscribed  FROM sub_amt)   AS subscribed,
    (SELECT market_value FROM mv_amt)   AS market_value,
    (SELECT mv_sum      FROM mv_amt)    AS total_after_int,
    (SELECT pnl_pct     FROM pnl)       AS pnl_pct;

```
### What each CTE does — at a glance
| CTE                       | Rows | Purpose                                                 |
| ------------------------- | ---- | ------------------------------------------------------- |
| **c\_sub**                | *n*  | subscriptions (Δn > 0) from `holdings_change`.          |
| **sub\_dates / sub\_amt** | 1    | formatted list of subscription dates & amounts + Σ sub. |
| **c\_red**                | *m*  | *all* redemption contracts (`contract_notes`).          |
| **cut\_dates / mv\_amt**  | 1    | list of redemption dates & amounts + Σ mv.              |
| **pnl**                   | 1    | uses Σ sub & Σ mv to compute PnL %.                     |
| **fund\_name**            | 1    | grabs canonical name once.                              |
| **final SELECT**          | 1    | returns the seven UI fields.                            |

### Output Table
| 產品名稱                                                             | 認購時間               | 數據截止               | 認購金額 (USD)               | 市值                       | 含息後總額      | 估派息後盈虧 (%)   |
| ---------------------------------------------------------------- | ------------------ | ------------------ | ------------------------ | ------------------------ | ---------- | ------------ |
| Hywin Global Multi-Strategy Fund SPC – Hywin Global PE Fund \| SP | 2021-09<br>2024-05 | 2024-10<br>2025-03 | 203 156.85<br>571 888.63 | 247 621.32<br>335 350.09 | 582 971.41 | **-24.79 %** |


* **Σ sub = 775 045.48**
* **Σ mv = 582 971.41** (redemption + live NAV)
* **PnL ≈ -24.79 %**

---

## 📋 cheat-sheet 

| UI column  | SQL source / filter<br>(*for `fund_id = F`, `investor = i`*)                                                                                                                             | math symbol / set                                                                  |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| **產品名稱**   | `SELECT DISTINCT fund_name …` (either table after `fund_id` / `investor` filter)                                                                                                         | $\Pi_{\textit{fund\_name}}(\text{rows})$                                        |
| **認購時間**   | `snapshot_date` where `number_delta > 0` in **`holdings_change`**                                                                                                                        | $\sigma_{\Delta n>0}(C)$                                                        |
| **數據截止**   | <br>① `trade_date` of **all** rows in **`contract_notes`** with `trade_type = 'redemption'` <br>② **plus** the *latest* `snapshot_date` if the investor is still active in that snapshot | $\langle \text{dates}(C_R)\rangle^{\uparrow} \cup {d_S}\_{\text{(if active)}}$ |
| **認購金額**   | `nav_delta` where `number_delta > 0` in **`holdings_change`**                                                                                                                            | list $L_{\text{sub}}$, sum $\Sigma_{\text{sub}}$                             |
| **市值**     | <br>① `amount` from the same **`contract_notes`** rows as above <br>② **plus** `nav_value` from the latest snapshot if active                                                            | list $L_{\text{mv}}$, sum $\Sigma_{\text{mv}}$                               |
| **含息後總額**  | `Σ amount` (**including** the live NAV if present) – no `settled` filter                                                                                                                 | $\Sigma_{\text{mv}}$                                                            |
| **估派息後盈虧** | $\displaystyle\frac{\Sigma_{\text{mv}}-\Sigma_{\text{sub}}}{\Sigma_{\text{sub}}}\times100$                                                                                          | formula                                                                            |

> *Notes*
> • 認購時間 / 認購金額 come **only** from `holdings_change`.
> • 數據截止 / 市值 merge **all** redemption contracts *and* the live NAV row (if the investor is active).
> • 含息後總額 is now simply Σ 市值.
> • Display-helper columns and row-ordering rules stay the same.

---

## 🛠 Function `investor_subscription_report`

*(new definition — reflects the merged redemption + live NAV logic)*

| Output column         | Meaning                                                                                                           |
| --------------------- | ----------------------------------------------------------------------------------------------------------------- |
| **name**              | Canonical fund name (after filtering).                                                                            |
| **sub\_date**         | `YYYY-MM` list of every **subscription** snapshot ($\Delta n>0$).                                               |
| **data\_cutoff**      | `YYYY-MM` list of every redemption contract date **plus** the latest snapshot date (if investor is active).       |
| **subscribed**        | List of subscription amounts (`nav_delta`, $\Delta n>0$).                                                       |
| **market\_value**     | List of:<br>• `amount` from each redemption contract<br>• `nav_value` from the latest snapshot (if active).       |
| **total\_after\_int** | $\displaystyle\sum\text{market\_value}$ — 含息後總額.                                                                |
| **pnl\_pct**          | $\displaystyle\frac{\sum\text{market\_value}-\sum\text{subscribed}}{\sum\text{subscribed}}\times100$ — 估派息後盈虧%. |

---

### Mathematical model

Let

* $C$ = rows in **`holdings_change`** where `fund_id=F`, `investor=i`.

  * $C^{+} = {r\in C\mid \Delta n>0}$ (subscriptions)
  * $C^{-} = {r\in C\mid \Delta n<0}$ (position-level redemptions) – *no longer shown.*

* $C_R$ = rows in **`contract_notes`** with  
  $\bigl[r.\text{fund\_id}=F,\; r.\text{investor}=i,\; r.\text{trade\_type}=\text{'redemption'}\bigr]$

* $S = (\text{id}_S, d_S)$ = **latest snapshot** of fund $F$  
  – and $A_S$ the holdings row for investor $i$ in that snapshot (may be empty).


$$
\begin{aligned}
L_{\text{sub}}        &= \bigl\langle r.\text{nav}_{\!\Delta}\bigr\rangle_{r\in C^{+}}, &
\Sigma_{\text{sub}}   &= \sum_{r\in C^{+}} r.\text{nav}_{\!\Delta} \\[6pt]
L_{\text{mv}}         &= \bigl\langle r.\text{amount}\bigr\rangle_{r\in C_R}^{\uparrow}
                         \;\cup\;
                         \begin{cases}
                           \bigl\langle A_S.\text{nav\_value}\bigr\rangle & A_S\neq\varnothing\\[4pt]
                           \varnothing & \text{(inactive)}
                         \end{cases} \\[6pt]
\Sigma_{\text{mv}}    &= \sum L_{\text{mv}} \\[6pt]
\text{TotalAfter}     &= \Sigma_{\text{mv}} \\[6pt]
\text{PnL\%}          &= \dfrac{\Sigma_{\text{mv}}-\Sigma_{\text{sub}}}{\Sigma_{\text{sub}}}\times100
\end{aligned}
$$

*(If you ever change the rule to “latest contract only”, substitute
$\Sigma_{\text{mv}}$ with the last element of $L_{\text{mv}}$.)*

---

### Query flow (CTEs)
```sql 
/* =======================================================================
   Function : investor_subscription_report( p_fund_id int
                                          , p_investor text )
   -----------------------------------------------------------------------
   • ONE summary row (7 columns) for one investor in one fund.
   • Subscriptions   →  holdings_change  (Δn > 0 only)
   • Market-value    →  contract_notes  (all ‘redemption’ rows)
                       ∪ live nav_value from the latest snapshot
     ───────────────
       name               canonical fund name
       sub_date           list YYYY-MM of every subscription
       data_cutoff        list of redemption contract dates
                          + snapshot date if investor active
       subscribed         list of subscription cash amounts
       market_value       list of redemption amounts + live NAV
       total_after_int    Σ market_value
       pnl_pct            (ΣMv – ΣSub) / ΣSub × 100
   =======================================================================*/
CREATE OR REPLACE FUNCTION investor_subscription_report
        (p_fund_id int, p_investor text)
RETURNS TABLE (
    name             text,
    sub_date         text,
    data_cutoff      text,
    subscribed       text,
    market_value     text,
    total_after_int  numeric,
    pnl_pct          numeric
)  LANGUAGE sql  STABLE  AS
$$
WITH
/* ────────────────────────────────────────────────────────────────
  1️⃣  latest snapshot id & date for the chosen fund
──────────────────────────────────────────────────────────────── */
latest_snap AS (
    SELECT id, snapshot_date
    FROM   holdings_snapshot hs
    JOIN   v_fund_lookup     vl
           ON vl.name = hs.fund_name
    WHERE  vl.fund_id = p_fund_id
    ORDER  BY hs.snapshot_date DESC, hs.id DESC
    LIMIT  1
),

/* ────────────────────────────────────────────────────────────────
  2️⃣  subscriptions (Δn > 0)  ——  lists  +  Σsub
──────────────────────────────────────────────────────────────── */
c_sub AS (
    SELECT snapshot_date , nav_delta
    FROM   holdings_change
    WHERE  fund_id       = p_fund_id
      AND  investor_name = p_investor
      AND  number_delta  > 0
    ORDER  BY snapshot_date
),
sub_dates AS (
    SELECT string_agg(to_char(snapshot_date,'YYYY-MM'), E'\n') AS sub_date
    FROM   c_sub
),
sub_amt AS (
    SELECT string_agg(to_char(nav_delta,'FM999,999,999.99'), E'\n')
             AS subscribed ,
           SUM(nav_delta)::numeric           AS sub_sum
    FROM   c_sub
),

/* ────────────────────────────────────────────────────────────────
  3️⃣  redemption contracts  ——  all rows, no settled filter
──────────────────────────────────────────────────────────────── */
red_amt AS (
    SELECT trade_date , amount
    FROM   contract_notes
    WHERE  fund_id       = p_fund_id
      AND  investor_name = p_investor
      AND  trade_type    = 'redemption'
),

/* ────────────────────────────────────────────────────────────────
  4️⃣  live NAV row  ——  appears only if investor active
──────────────────────────────────────────────────────────────── */
live_nav AS (
    SELECT
        s.snapshot_date  AS trade_date,
        hd.nav_value     AS amount
    FROM   latest_snap s
    JOIN   holdings_detail hd
           ON hd.snapshot_id   = s.id
          AND hd.investor_name = p_investor
),

/* ────────────────────────────────────────────────────────────────
  5️⃣  market-value  lists  +  Σmv   (red_amt ∪ live_nav)
──────────────────────────────────────────────────────────────── */
mv_list AS (
    SELECT * FROM red_amt
    UNION ALL
    SELECT * FROM live_nav       -- zero rows if not active
),
cut_dates AS (
    SELECT string_agg(to_char(trade_date,'YYYY-MM'),
                      E'\n' ORDER BY trade_date) AS data_cutoff
    FROM   mv_list
),
mv_amt AS (
    SELECT string_agg(to_char(amount,'FM999,999,999.99'),
                      E'\n' ORDER BY trade_date) AS market_value,
           SUM(amount)::numeric                 AS mv_sum
    FROM   mv_list
),

/* ────────────────────────────────────────────────────────────────
  6️⃣  PnL %
──────────────────────────────────────────────────────────────── */
pnl AS (
    SELECT
        ROUND( (mv.mv_sum - sub.sub_sum) / sub.sub_sum * 100 , 2 )
        AS pnl_pct
    FROM sub_amt sub, mv_amt mv
),

/* ────────────────────────────────────────────────────────────────
  7️⃣  canonical fund name  (any row after filter)
──────────────────────────────────────────────────────────────── */
fund_name AS (
    SELECT fund_name
    FROM   holdings_change
    WHERE  fund_id       = p_fund_id
      AND  investor_name = p_investor
    LIMIT 1
)

/* ────────────────────────────────────────────────────────────────
  8️⃣  final single-row projection
──────────────────────────────────────────────────────────────── */
SELECT
    (SELECT fund_name       FROM fund_name)   AS name,
    (SELECT sub_date        FROM sub_dates),
    (SELECT data_cutoff     FROM cut_dates),
    (SELECT subscribed      FROM sub_amt),
    (SELECT market_value    FROM mv_amt),
    (SELECT mv_sum          FROM mv_amt)      AS total_after_int,
    (SELECT pnl_pct         FROM pnl);
$$;

```
| CTE                       | Cardinality      | Purpose                                        |
| ------------------------- | ---------------- | ---------------------------------------------- |
| **latest\_snap**          | 1 row            | id + date of most-recent snapshot for the fund |
| **c\_sub**                | *n* rows         | all subscription movements (`Δn > 0`)          |
| **sub\_dates / sub\_amt** | 1 row each       | formatted list & Σ sub                         |
| **red\_amt**              | *m* rows         | every redemption contract (any `settled`)      |
| **live\_nav**             | 0 or 1           | adds `nav_value` if investor is still active   |
| **mv\_list**              | *m + {0,1}* rows | union of redemptions + live NAV                |
| **cut\_dates / mv\_amt**  | 1 row each       | list of dates & amounts + Σ mv                 |
| **pnl**                   | 1 row            | computes PnL % from Σ sub & Σ mv               |
| **fund\_name**            | 1 row            | gets the canonical fund name once              |
| **final SELECT**          | 1 row            | outputs the seven UI fields                    |

### How to call
```sql
SELECT * FROM investor_subscription_report(2, 'Xie Rui');
```
| 產品名稱                                                                   | 認購時間               | 數據截止               | 認購金額 (USD)               | 市值                       | 含息後總額      | 估派息後盈虧 (%) |
| ---------------------------------------------------------------------- | ------------------ | ------------------ | ------------------------ | ------------------------ | ---------- | ---------- |
| Hywin Global Multi-Strategy Fund SPC – Hywin Global PE Fund I SP \| SP | 2021-09<br>2024-05 | 2024-10<br>2025-03 | 203 156.85<br>571 888.63 | 247 621.32<br>335 350.09 | 582 971.41 | **-24.79** |

* **Σ sub = 775 045.48**
* **Σ mv = 582 971.41** (redemption + live NAV)
* **PnL ≈ -24.79 %**

> **Mathematical model (inside the function)**
>Let
>
>* $C^{+}\;$ = $\{\,r\in\texttt{holdings\_change}\mid
>         r.\text{fund\_id}=F,\;
>         r.\text{investor}=i,\;
>         \Delta n>0\}$   (*subscription rows*)
>
>* $C_R\;$ = $\{\,r\in\texttt{contract\_notes}\mid
>         r.\text{fund\_id}=F,\;
>         r.\text{investor}=i,\;
>         r.\text{trade\_type}=\text{‘redemption’}\}$   (*all redemption contracts*)
>
>* $S=(\text{id}_S,d_S)$ be the **latest snapshot** of fund $F$.
>  Let $A_S$ be the (possibly empty) holdings row for investor $i$ in snapshot $S$.
>
>---
>
>$$
>\begin{aligned}
>\Sigma_{\text{sub}}
>  &= \sum_{r\in C^{+}} r.\text{nav}_{\!\Delta} \\[8pt]
>
>\Sigma_{\text{mv}}
>  &= \underbrace{\sum_{r\in C_R} r.\text{amount}}_{\text{all redemption cash}}
>     \;+\;
>     \begin{cases}
>       A_S.\text{nav\_value} & \text{if }A_S\neq\varnothing\;(\text{investor active})\\[4pt]
>       0                      & \text{otherwise}
>     \end{cases} \\[14pt]
>
>\text{TotalAfter}
>  &= \Sigma_{\text{mv}} \\[8pt]
>
>\text{PnL}\%
>  &= \frac{\displaystyle\Sigma_{\text{mv}}-\Sigma_{\text{sub}}}
>          {\displaystyle\Sigma_{\text{sub}}}\times100
>\end{aligned}
>$$
>
>*If the business rule ever changes to “**last** redemption only”, replace
>$\Sigma_{\text{mv}}$ with the **latest** $r.\text{amount}$ in $C_R$.*

