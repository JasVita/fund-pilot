/*-------------------------------------------------------------
 *  Auto-generated data-dictionary (concise, business-oriented)
 *------------------------------------------------------------*/
export const TABLE_DOCS = {
  holdings_snapshot: `
Purpose  : Header for every month-end investor holdings file.
Grain    : (snapshot_id) — one row per uploaded file.
Columns  :
  • id               (int PK)      – Surrogate key, GENERATED.
  • fund_name        (text)        – As found in PDF/Excel header.
  • snapshot_date    (date)        – Report date in the file (month-end).
  • createdon        (timestamp)   – ETL load time (sys).
Business Notes :
  • For a given fund there is at most one snapshot per calendar month.
`,

  holdings_detail: `
Purpose  : All investor rows in a snapshot (position-level data).
Grain    : (snapshot_id, row_no) — NO aggregation; duplicates allowed.
Columns  :
  • snapshot_id      (int FK)      – Links to holdings_snapshot.id
  • class            (text)        – Series / Class
  • investor_name    (text)        – Raw as in file
  • number_held      (numeric)     – Units / Shares
  • nav_price        (numeric)     – Price per share in file currency
  • nav_value        (numeric)     – number_held × nav_price
Generated :
  • name_norm        (text STORED) – normalize_name(investor_name)
  • compact_norm     (text STORED) – upper( name_norm w/o spaces )
`,

  holdings_change: `
Purpose  : Month-over-month delta (+/-) at investor level.
Grain    : (snapshot_date, investor_name) — one row per investor for which
           number_held or NAV decreased *or* full redemption occurred.
Columns  :
  • snapshot_date   (date)    – Current month snapshot_date
  • number_prev     (numeric) – Previous month total units
  • number_now      (numeric) – Current month total units
  • number_delta    (numeric) – now – prev  (sign shows buy / redeem)
  • nav_prev        (numeric)
  • nav_now         (numeric)
  • nav_delta       (numeric)
  • full_redeem     (boolean) – TRUE if investor vanished this month
Flags     :
  • settled         (boolean) – Updated by settle_holdings_change(); TRUE
                                once cash side has been matched.
`,

  fund_statement: `
Purpose  : Parsed cash-account statement header (one per PDF).
Grain    : (statement_id)
Columns  :
  • id                       (int PK)
  • fund_name                (text)
  • statement_date           (date)  – PDF statement period end
  • account_number           (text)
  • currency                 (char(3))
  • opening_ledger_balance   (numeric)
  • closing_ledger_balance   (numeric)
  • closing_available_balance(numeric)
Business Notes :
  • Used as parent for fund_transaction lines. Latest statement drives
    dashboard totals and “last_date”.
`,

  fund_transaction: `
Purpose  : Line-by-line cash movements extracted from statements.
Grain    : (transaction_id)
Columns  :
  • id              (int PK)
  • statement_id    (int FK)   – fund_statement.id
  • amount          (numeric)  – Positive for CR, negative for DR? (we keep sign 1:1)
  • type            (char(2))  – 'CR' / 'DR'
  • value_date      (date)     – Settlement date
  • counterparty    (text)
  • tran_description(text)
  • is_dividend     (boolean)  – flag_dividends() sets TRUE if line is distribution
Generated :
  • name_norm / compact_norm – same rules as holdings_detail
Indexes  :
  • gist(pg_trgm) on compact_norm for similarity matching to holdings_change.
`,

  contract_notes: `
Purpose  : Trade confirmations (Subscriptions / Redemptions).
Grain    : (id) one row per PDF contract note.
Columns  :
  • order_id        (text  UNIQUE)
  • investor_id     (text)
  • investor_name   (text)
  • class           (text)
  • trade_type      (text)    – 'subscription' | 'redemption'
  • trade_date      (date)
  • valuation_date  (date)
  • shares          (numeric)
  • valuation       (numeric) – Price
  • amount          (numeric)
  • currency        (char(3))
Business Notes :
  • Used by flag_dividends() rule #1 to disqualify redemption cash flows.
`,

  investorlist: `
Purpose  : Golden master list of all investors & current status.
Grain    : (compact_norm) — unique per logical investor.
Columns  :
  • id            (serial PK)
  • investor_name (text)      – Canonical spelling (latest snapshot)
  • status        (text)      – 'active' if in latest snapshot else 'inactive'
  • createdon     (timestamp) – Time of last refresh
Generated :
  • name_norm     (text STORED)
  • compact_norm  (text STORED)
Indexes :
  • UNIQUE(compact_norm)  — avoids duplicates irrespective of spacing / case.
Refresh :
  • CALL refresh_investorlist();  – rebuilds list after new snapshot load.
`,
  _functions: `
Purpose : Utility functions & comparison conventions used in queries

• make_fingerprint(text) → text  
  – Removes spaces, converts to lower-case, sorts letters alphabetically.
  – Use together with the Postgres « similarity(a,b) » operator.

• NAME MATCH RULE  
  A record *matches* an input name when  
    similarity( make_fingerprint(db_name)
              , make_fingerprint(input_name) ) > 0.85

• NUMERIC TOLERANCE RULE  
  Two numeric amounts are considered the same when  
    ABS(val1 − val2) / NULLIF(val2,0) ≤ 0.02   (±2 %)
`
};
