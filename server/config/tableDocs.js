/*-------------------------------------------------------------
 *  Auto-generated data dictionary (optimised, business-oriented)
 *------------------------------------------------------------*/
export const TABLE_DOCS = {

/* ─────────── ❶  Tenant & User Dimension ─────────── */

companies: `
Purpose  : Tenant master. One row = one paying client / legal entity.
Grain    : (id) – surrogate PK, never changes.
Columns  :
  • id    (serial PK)
  • name  (text UNIQUE)
Business Notes :
  • Every transactional table carries company_id ⇒ absolute data isolation.
`,

users: `
Purpose  : Authentication & RBAC per tenant.
Grain    : (id) – one row per human user.
Columns  :
  • id             (serial PK)
  • company_id     (int FK → companies.id)
  • google_id      (text NULL)        – Google-SSO subject
  • email          (text UNIQUE)
  • password_hash  (text NULL)        – NULL if SSO-only
  • role           (text)             – 'admin' | 'ops' | 'viewer'
  • name, avatar   (text)
  • created_at, updated_at (timestamp DEFAULT now())
Business Notes :
  • Gateway injects company_id on every request; cross-tenant access is impossible.
`,

/* ─────────── ❷  Fund & Investor Master ─────────── */

fundlist: `
Purpose  : Canonical catalogue of funds for each tenant.
Grain    : (id) – each row describes *one logical fund*.
Columns  :
  • id             (serial PK)
  • company_id     (int FK → companies.id)
  • name           (text)         – Raw label as found in files
  • currency       (char(3))
  • fund_categories(text[])       – Canonical name(s) for UI / reports
  • fund_id        (int)          – **Uniqueness rule:** one numeric value ⇒ one fund even if repeated across rows.
  • created_on     (timestamp DEFAULT now())
Business Notes :
  • Because PDFs/Excels carry inconsistent “fund_name”, the ETL inserts
    *all* variants here, pointing them to the *same fund_id* value.
`,

investor_fund_map: `
Purpose  : Bridge table – which raw investor_name ever appeared in which fund_id.
Grain    : (investor_fund_id)
Columns  :
  • investor_fund_id (serial PK)
  • investor_name    (text)         – As in source file
  • fund_id          (int FK → fundlist.id)
  • created_on       (timestamp DEFAULT now())
Business Notes :
  • First stop when a query asks: “show everything for investor X”.
  • Give direct answer if user wants to find which fund the investor hold, or has held before.
`,

investorlist: `
Purpose  : De-duplicated investor master (cross-fund).
Grain    : (compact_norm) – upper-case no-space fingerprint (UNIQUE).
Columns  :
  • id, company_id, created_on
  • investor_name (text)   – Canonical spelling (latest snapshot)
  • status        (text)   – 'active' | 'inactive'
  • name_norm     (text)   – TOKEN-SORTED UPPER
  • compact_norm  (text UNIQUE)
Business Notes :
  • Refreshed by **sync_investorlist()**:
      1. scans newest snapshot,
      2. upserts rows by compact_norm,
      3. sets status to active if name appears there.
`,

v_fund_lookup: `
Purpose  : Helper VIEW – quick fund_id → canonical fund_categories.
Grain    : (fund_id).
Columns  : fund_id · name (=fund_categories) · company_id
`,

/* ─────────── ❸  Month-end NAV Snapshot ─────────── */

holdings_snapshot: `
Purpose  : One row per month-end (or ad-hoc) NAV file *per fund*.
Grain    : (fund_name, snapshot_date) within a company.
Columns  :
  • id (serial PK) · fund_name (text raw) · snapshot_date (date)
  • nav_total (numeric) · currency (char3)
  • company_id · created_on
Business Notes :
  • To know the real fund, JOIN fundlist ON fundlist.name ≈ fund_name
    and then rely on fund_id (unique).
`,

holdings_detail: `
Purpose  : Raw investor positions inside a snapshot – no aggregation.
Grain    : (id) so duplicates are allowed.
Columns  :
  • id (serial PK) · snapshot_id (FK) · class · investor_name
  • number_held · nav_price · nav_value · total_value · currency
  • company_id · created_on
Business Notes :
  • To discover fund_id   ⇒  snapshot_id ↔ holdings_snapshot ↔ fundlist.
`,

holdings_change: `
Purpose  : Net ∆ units / NAV per investor between successive snapshots.
Grain    : (id) – one row per investor per month with non-zero delta.
Columns  :
  • id · fund_name (text) · fund_id (FK) · snapshot_date
  • investor_name · number_prev/now/delta · nav_prev/now/delta
  • full_redeem (bool) · settled (bool) · name_norm · compact_norm
  • company_id · created_on
Business Notes :
  • Produced by **update_holdings_change(snapshot_id)**.
  • 'settled' kept for legacy; actual cash match lives in contract_notes.
`,

/* ─────────── ❹  Bank / Admin Statements & Cash Lines ─────────── */

fund_statement: `
Purpose  : Header per bank/admin statement PDF.
Grain    : (id).
Columns  :
  • id                          (serial PK)  
  • fund_name                   (text)  
  • statement_date              (date)  
  • account_number              (text)  
  • currency                    (char(3))  
  • opening_ledger_balance      (numeric)  
  • closing_ledger_balance      (numeric)  
  • closing_available_balance   (numeric)  
  • company_id                  (int FK → companies.id)  
  • created_on                  (timestamp DEFAULT now())  
Business Notes :
  • statement_date = period end; “current” means the latest one.
`,

fund_transaction: `
Purpose  : Every cash line extracted from statements.
Grain    : (id) preserving file order.
Columns  :
  • id               (serial PK)  
  • statement_id     (int FK → fund_statement.id)  
  • amount           (numeric)          
  • type             (text)             – 'DR' | 'CR' (was CHAR(2))  
  • value_date       (date)  
  • counterparty     (text)  
  • tran_description (text)  
  • is_dividend      (bool DEFAULT false) – Flag set by **flag_dividends()**  
  • name_norm        (text)  
  • compact_norm     (text)  
  • company_id       (int FK → companies.id)  
  • created_on       (timestamp DEFAULT now())  
Indexes  : GiST(name_norm), GiST(compact_norm) — trigram search.
Business Notes :
  • **flag_dividends(p_date)** flips is_dividend using:
      1) exact contract_note match,
      2) holdings_change redemptions,
      3) else TRUE (= distribution).
`,

contract_notes: `
Purpose  : Trade confirmations – one row per PDF order.
Grain    : (id).
Columns  :
  • id              (serial PK)  
  • order_id        (text UNIQUE)  
  • investor_id     (text)  
  • investor_name   (text)  
  • class           (text)  
  • trade_type      (text)            – subscription | redemption  
  • trade_date      (date)  
  • valuation_date  (date)  
  • shares          (numeric)  
  • valuation       (numeric)  
  • amount          (numeric)  
  • currency        (char(3))  
  • description     (text)  
  • settled         (bool DEFAULT false) – flip when fund_transaction table has transaction hits  
  • name_norm       (text)  
  • compact_norm    (text)  
  • fund_id         (int FK → fundlist.id)  
  • company_id      (int FK → companies.id)  
  • created_on      (timestamp DEFAULT now())  
Business Notes :
  • If trade_type='redemption' AND settled=false  ⇒  cash not yet paid.
`,

/* ─────────── ❺  Reference rules / helpers ─────────── */

_rules: `
NAME MATCH  : similarity(make_fingerprint(db_name), make_fingerprint(input)) > 0.85
NUM MATCH   : ABS(a-b)/NULLIF(b,0) ≤ 0.02
FUND RULE   : One numeric fund_id == one fund even if fundlist repeats it.
CANON LABEL : fund_categories (from fundlist) is the display name.
`,
};
