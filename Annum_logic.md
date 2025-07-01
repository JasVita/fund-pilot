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

# Investor Portfolio Overview - Report

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

## Step 3 數據截止 (data-cut-off list)

```sql
SELECT string_agg(to_char(snapshot_date,'YYYY-MM'), E'\n')
FROM   c
WHERE  number_delta < 0;
```

Result:

```
2022-01
2023-08
2024-10
```

$$
\text{CutDates}= \Bigl\{\,d \;\bigl|\; (d,\Delta n,\Delta \$)\in c,\; \Delta n<0 \Bigr\}
$$

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

## Step 5 市值 (Market-value list)

```sql
SELECT string_agg(to_char(abs(nav_delta),'FM999,999,999.99'), E'\n')
FROM   c
WHERE  number_delta < 0;
```

Result:

```
1,602.30
225,098.79
255,548.50
```

$$
\text{MvAmounts}= \{|\Delta \$| \mid \Delta n<0\},\qquad
\Sigma_{\text{mv}} = \color{royalblue}{482\,249.59}
$$

---

## Step 6 含息後總額

$$
\text{TotalAfter}= \Sigma_{\text{mv}}
                  = 482\,249.59
$$

```sql
SELECT SUM(abs(nav_delta)) AS total_after_int
FROM   c
WHERE  number_delta < 0;
```

---

## Step 7 估派息後盈虧 (%)

$$
\text{pnl\%} =
  \frac{\Sigma_{\text{mv}}-\Sigma_{\text{sub}}}{\Sigma_{\text{sub}}}\times100
  =\frac{482\,249.59-775\,045.48}{775\,045.48}\times100
  \approx -37.79\%
$$

```sql
WITH sums AS (
  SELECT
      SUM(nav_delta)                FILTER (WHERE number_delta>0) AS sub,
      SUM(abs(nav_delta))           FILTER (WHERE number_delta<0) AS mv
  FROM c
)
SELECT ROUND( (mv - sub)/sub*100 , 2 ) AS pnl_pct
FROM   sums;
```

---

## Step 8 Consolidated one-row result

```sql
/* ------------------------------------------------------------------
   Full trace for investor = 'Xie Rui', fund_id = 2
   ------------------------------------------------------------------ */
WITH
/* 0️⃣  base rows --------------------------------------------------- */
c AS (
  SELECT *
  FROM   holdings_change
  WHERE  fund_id       = 2
    AND  investor_name = 'Xie Rui'
  ORDER  BY snapshot_date           -- oldest → newest
),

/* 1️⃣  subscription-date list ------------------------------------- */
sub_dates AS (
  SELECT string_agg(to_char(snapshot_date,'YYYY-MM'), E'\n') AS sub_date
  FROM   c
  WHERE  number_delta > 0
),

/* 2️⃣  data-cut-off list ------------------------------------------ */
cut_dates AS (
  SELECT string_agg(to_char(snapshot_date,'YYYY-MM'), E'\n') AS data_cutoff
  FROM   c
  WHERE  number_delta < 0
),

/* 3️⃣  subscription amounts -------------------------------------- */
subs_amt AS (
  SELECT string_agg(to_char(nav_delta,'FM999,999,999.99'), E'\n') AS subscribed
  FROM   c
  WHERE  number_delta > 0
),

/* 4️⃣  market-value amounts -------------------------------------- */
mkt_val AS (
  SELECT string_agg(to_char(abs(nav_delta),'FM999,999,999.99'), E'\n') AS market_value
  FROM   c
  WHERE  number_delta < 0
),

/* 5️⃣  total after redemption ------------------------------------ */
tot_after AS (
  SELECT SUM(abs(nav_delta)) AS total_after_int
  FROM   c
  WHERE  number_delta < 0
),

/* 6️⃣  PnL%  ------------------------------------------------------ */
pnl AS (
  SELECT
      ROUND( (mv - sub) / sub * 100 , 2 ) AS pnl_pct
  FROM (
    SELECT
        SUM(nav_delta)              FILTER (WHERE number_delta > 0) AS sub,
        SUM(abs(nav_delta))         FILTER (WHERE number_delta < 0) AS mv
    FROM c
  ) s
)

/* 7️⃣  final one-row projection ---------------------------------- */
SELECT
   (SELECT fund_name       FROM c  LIMIT 1)  AS name,
   (SELECT sub_date        FROM sub_dates)   AS sub_date,
   (SELECT data_cutoff     FROM cut_dates)   AS data_cutoff,
   (SELECT subscribed      FROM subs_amt)    AS subscribed,
   (SELECT market_value    FROM mkt_val)     AS market_value,
   (SELECT total_after_int FROM tot_after)   AS total_after_int,
   (SELECT pnl_pct         FROM pnl)         AS pnl_pct;

```

| 產品名稱                                                             | 認購時間               | 數據截止                          | 認購金額 (USD)               | 市值                                   | 含息後總額      | 估派息後盈虧 (%)   |
| ---------------------------------------------------------------- | ------------------ | ----------------------------- | ------------------------ | ------------------------------------ | ---------- | ------------ |
| Annum Global Multi-Strategy Fund SPC – Annum Global PE Fund I SP | 2021-09<br>2024-05 | 2022-01<br>2023-08<br>2024-10 | 203 156.85<br>571 888.63 | 1 602.30<br>225 098.79<br>255 548.50 | 482 249.59 | **−37.79 %** |

*(If your business rule is “compare **only the last** redemption to the
sum of subscriptions”, substitute Σ mv with the last `abs(nav_delta)`
to reproduce **−81.07 %**.)*

---

### cheat-sheet

| UI column | SQL filter                                      | math                |
| --------- | ----------------------------------------------- | ------------------- |
| 產品名稱      | `DISTINCT fund_name`                            | $Π\ fund\_name(c)$  |
| 認購時間      | `number_delta>0` → `snapshot_date`              | $σ_{\Delta n>0}(c)$ |
| 數據截止      | `number_delta<0` → `snapshot_date`              | $σ_{\Delta n<0}(c)$ |
| 認購金額      | `number_delta>0` → `nav_delta`                  | Σ sub               |
| 市值        | `abs(nav_delta)` where `Δn<0`                   | Σ mv                |
| 含息後總額     | Σ mv                                            | same                |
| 估派息後盈虧    | $(Σ\text{mv}-Σ\text{sub})/Σ\text{sub}\times100$ | formula             |


The function:

* investor_display / unpaid_redeem_display show values only on the
first row for that (investor, unpaid_redeem) pair; duplicates carry NULL.

* Rows with non-zero unpaid redeem precede rows whose amount is zero.

* Ordering is deterministic and updates automatically whenever a new
snapshot is added.

## Function: `investor_subscription_report(p_fund_id int, p_investor text)`

Returns a single summary row for one investor’s activity in one fund  
(**data source:** `holdings_change`).

| Output column  | Meaning |
|----------------|---------|
| `name`         | Canonical fund name (only one after filtering). |
| `sub_date`     | `YYYY‑MM` list of every **subscription** snapshot ($\Delta n > 0$). |
| `data_cutoff`  | `YYYY‑MM` list of every **redemption** snapshot ($\Delta n < 0$). |
| `subscribed`   | List of subscription cash amounts ($\text{nav\_delta}$, $\Delta n > 0$). |
| `market_value` | List of redemption cash amounts $\lvert\text{nav\_delta}\rvert$, $\Delta n < 0$. |
| `total_after_int` | $\displaystyle \sum \lvert\text{nav\_delta}\rvert$ on redemption rows — 含息後總額. |
| `pnl_pct`      | $\displaystyle \frac{\sum\lvert\text{Mv}\rvert - \sum\text{Sub}}{\sum\text{Sub}}\times100$ — 估派息後盈虧 %. |

---

### Mathematical model

$$
\begin{aligned}
C &= \bigl\{\,r\mid r\in\text{holdings\_change},\;
               r.\text{fund\_id}=p_{\text{fund}},\;
               r.\text{investor\_name}=p_{\text{investor}}\bigr\} \\[6pt]
C^{+} &= \{\,r\in C\mid \Delta n > 0\}, &
C^{-} &= \{\,r\in C\mid \Delta n < 0\} \\[6pt]
L_{\text{sub}} &= \bigl\langle r.\text{nav}_{\!\Delta} \bigr\rangle_{r\in C^{+}}, &
\Sigma_{\text{sub}} &= \sum_{r\in C^{+}} r.\text{nav}_{\!\Delta} \\[6pt]
L_{\text{mv}} &= \bigl\langle \lvert r.\text{nav}_{\!\Delta}\rvert \bigr\rangle_{r\in C^{-}}, &
\Sigma_{\text{mv}} &= \sum_{r\in C^{-}} \lvert r.\text{nav}_{\!\Delta}\rvert \\[6pt]
\text{TotalAfter} &= \Sigma_{\text{mv}}, \qquad
\text{PnL\%} = \frac{\Sigma_{\text{mv}} - \Sigma_{\text{sub}}}{\Sigma_{\text{sub}}}\times100
\end{aligned}
$$

*(If the rule changes to “use only the **latest** redemption”, replace
$\Sigma_{\text{mv}}$ with the last element of $L_{\text{mv}}$.)*

---

### Query flow (CTEs)
```sql 
/* ================================================================
   Function  : investor_subscription_report(p_fund_id int,
                                            p_investor text)
   Purpose   : Return ONE summary row of an investor’s cash activity
               (subscriptions / redemptions) in a single fund,
               using ONLY `holdings_change`.
   Columns   :
     name              — canonical fund name
     sub_date          — YYYY-MM list (Δn > 0)
     data_cutoff       — YYYY-MM list (Δn < 0)
     subscribed        — nav_delta list where Δn > 0
     market_value      — |nav_delta| list where Δn < 0
     total_after_int   — Σ|nav_delta| on Δn < 0
     pnl_pct           — (ΣMv – ΣSub) / ΣSub × 100
   ================================================================*/
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
) LANGUAGE sql STABLE AS
$$
WITH
/* 0️⃣  base rows */
c AS (
  SELECT *
  FROM   holdings_change
  WHERE  fund_id       = p_fund_id
    AND  investor_name = p_investor
  ORDER  BY snapshot_date
),

/* 1️⃣  subscription-date list */
sub_dates AS (
  SELECT string_agg(to_char(snapshot_date,'YYYY-MM'), E'\n') AS sub_date
  FROM   c
  WHERE  number_delta > 0
),

/* 2️⃣  data-cut-off list */
cut_dates AS (
  SELECT string_agg(to_char(snapshot_date,'YYYY-MM'), E'\n') AS data_cutoff
  FROM   c
  WHERE  number_delta < 0
),

/* 3️⃣  subscription amounts */
subs_amt AS (
  SELECT string_agg(to_char(nav_delta,'FM999,999,999.99'), E'\n') AS subscribed
  FROM   c
  WHERE  number_delta > 0
),

/* 4️⃣  market-value amounts */
mkt_val AS (
  SELECT string_agg(to_char(abs(nav_delta),'FM999,999,999.99'), E'\n') AS market_value
  FROM   c
  WHERE  number_delta < 0
),

/* 5️⃣  total after redemption */
tot_after AS (
  SELECT SUM(abs(nav_delta)) AS total_after_int
  FROM   c
  WHERE  number_delta < 0
),

/* 6️⃣  PnL % */
pnl AS (
  SELECT
      CASE
        WHEN sub = 0 THEN NULL
        ELSE ROUND( (mv - sub) / sub * 100 , 2 )
      END AS pnl_pct
  FROM (
    SELECT
        SUM(nav_delta)              FILTER (WHERE number_delta > 0) AS sub,
        SUM(abs(nav_delta))         FILTER (WHERE number_delta < 0) AS mv
    FROM c
  ) s
)

/* 7️⃣  final projection */
SELECT
   (SELECT fund_name       FROM c  LIMIT 1)  AS name,
   (SELECT sub_date        FROM sub_dates),
   (SELECT data_cutoff     FROM cut_dates),
   (SELECT subscribed      FROM subs_amt),
   (SELECT market_value    FROM mkt_val),
   (SELECT total_after_int FROM tot_after),
   (SELECT pnl_pct         FROM pnl);
$$;

```

| CTE         | Rows/value | Purpose |
|-------------|-----------|---------|
| `c`         | *n* rows  | Base table after filter, oldest → newest |
| `sub_dates` | 1 row     | `string_agg` of `snapshot_date` where $\Delta n > 0$ |
| `cut_dates` | 1 row     | `string_agg` of `snapshot_date` where $\Delta n < 0$ |
| `subs_amt`  | 1 row     | List of subscription `nav_delta` |
| `mkt_val`   | 1 row     | List of redemption $\lvert\text{nav\_delta}\rvert$ |
| `tot_after` | 1 row     | $\sum \lvert\text{nav\_delta}\rvert$ for $\Delta n < 0$ |
| `pnl`       | 1 row     | Calculated PnL % |
| Final SELECT| 1 row     | Projects columns for the UI |

### How to call
```sql
SELECT * FROM investor_subscription_report(2, 'Xie Rui');
```
> **Mathematical model (inside the function)**
> • $C$ = all rows in **`holdings_change`** for the given `(fund_id, investor)`
> • $C^{+}$ = rows where $\Delta n>0$ (subscriptions)
> • $C^{-}$ = rows where $\Delta n<0$ (redemptions)
>
> $$
> \begin{aligned}
> \Sigma_{\text{sub}} &= \sum_{r\in C^{+}} r.\text{nav}_{\!\Delta}\\[4pt]
> \Sigma_{\text{mv}}  &= \sum_{r\in C^{-}} |r.\text{nav}_{\!\Delta}|\\[4pt]
> \text{TotalAfter}   &= \Sigma_{\text{mv}}\\[4pt]
> \text{PnL\%}        &= \frac{\Sigma_{\text{mv}}-\Sigma_{\text{sub}}}
>                             {\Sigma_{\text{sub}}}\times100
> \end{aligned}
> $$
>
> *(If you want the “last-redemption only” rule, replace
> $\Sigma_{\text{mv}}$ with the latest $|\text{nav}_\Delta|$.)*
