const { pool } = require("./db");

const TABLE_DEFS = [
  /* ---------- companies (unchanged) ------------------------------ */
  {
    name: "companies",
    ddl: `
      CREATE TABLE IF NOT EXISTS companies (
        id   SERIAL PRIMARY KEY,
        name VARCHAR(255) UNIQUE NOT NULL
      );
    `,
  },

  /* ---------- users (unchanged) ---------------------------------- */
  {
    name: "users",
    ddl: `
      CREATE TABLE IF NOT EXISTS users (
        id            SERIAL PRIMARY KEY,
        google_id     VARCHAR(100) UNIQUE,
        email         VARCHAR(320) UNIQUE NOT NULL,
        password_hash TEXT,
        name          VARCHAR(255),
        avatar        TEXT,
        company_id    INTEGER REFERENCES companies(id),
        role          VARCHAR(50) DEFAULT NULL,

        created_at    TIMESTAMP DEFAULT (NOW() AT TIME ZONE 'Asia/Hong_Kong'),
        updated_at    TIMESTAMP DEFAULT (NOW() AT TIME ZONE 'Asia/Hong_Kong'),

        /* ---- data-integrity checks ------------------------------ */
        CONSTRAINT role_valid_chk   CHECK (role IN ('super','admin','user') OR role IS NULL),
        CONSTRAINT role_company_chk CHECK (
          (role IN ('admin','user') AND company_id IS NOT NULL)
          OR
          (role IS NULL OR role = 'super')
        )
      );
    `,
  },

  /* ---------- contract_notes ------------------------------------- */
  {
    name: "contract_notes",
    ddl: `
      CREATE TABLE IF NOT EXISTS contract_notes (
        id            SERIAL PRIMARY KEY,
        order_id      TEXT      NOT NULL,
        investor_id   TEXT      NOT NULL,
        class         TEXT,
        trade_type    TEXT      NOT NULL,
        trade_date    DATE      NOT NULL,
        valuation_date DATE     NOT NULL,
        shares        NUMERIC   NOT NULL,
        valuation     NUMERIC   NOT NULL,
        amount        NUMERIC   NOT NULL,
        currency      TEXT      NOT NULL,
        description   TEXT,
        createdon     TIMESTAMP NOT NULL DEFAULT NOW(),

        investor_name TEXT,
        name_norm     TEXT GENERATED ALWAYS AS (normalize_name(investor_name)) STORED,
        compact_norm  TEXT GENERATED ALWAYS AS (compact_norm(investor_name)) STORED,

        company_id    INTEGER   NOT NULL REFERENCES companies(id)
      );
    `,
  },

  /* ---------- fund_statement ------------------------------------- */
  {
    name: "fund_statement",
    ddl: `
      CREATE TABLE IF NOT EXISTS fund_statement (
        id                          SERIAL PRIMARY KEY,
        fund_name                   TEXT NOT NULL,
        statement_date              DATE NOT NULL,
        account_number              TEXT NOT NULL,
        currency                    TEXT NOT NULL,
        createdon                   TIMESTAMP NOT NULL DEFAULT NOW(),

        opening_ledger_balance      NUMERIC,
        closing_ledger_balance      NUMERIC,
        closing_available_balance   NUMERIC,

        company_id                  INTEGER NOT NULL REFERENCES companies(id)
      );
    `,
  },

  /* ---------- fund_transaction ----------------------------------- */
  {
    name: "fund_transaction",
    ddl: `
      CREATE TABLE IF NOT EXISTS fund_transaction (
        id            SERIAL PRIMARY KEY,
        statement_id  INTEGER NOT NULL,
        amount        NUMERIC NOT NULL,
        type          TEXT    NOT NULL,
        value_date    DATE    NOT NULL,
        counterparty  TEXT,
        description   TEXT,
        created_on    TIMESTAMP NOT NULL DEFAULT NOW(),
        is_dividend   BOOLEAN DEFAULT FALSE,

        name_norm     TEXT GENERATED ALWAYS AS (normalize_name(counterparty)) STORED,
        compact_norm  TEXT GENERATED ALWAYS AS (
                        UPPER(regexp_replace(normalize_name(counterparty), '\\s', '', 'g'))
                       ) STORED,

        company_id    INTEGER NOT NULL REFERENCES companies(id)
      );
    `,
  },

  /* ---------- fundlist ------------------------------------------- */
  {
    name: "fundlist",
    ddl: `
      CREATE TABLE IF NOT EXISTS fundlist (
        id            SERIAL PRIMARY KEY,
        company_id    INTEGER NOT NULL REFERENCES companies(id),
        name          TEXT   NOT NULL,
        currency      TEXT,
        fund_categories TEXT NOT NULL,
        fund_id       INTEGER NOT NULL DEFAULT 1,

        CONSTRAINT uq_fundlist_company_name UNIQUE (company_id, name)
      );
    `,
  },

  /* ---------- dividend_yield (NEW) ------------------------------- */
  {
    name: "dividend_yield",
    ddl: `
      /* one row per fund + year; value stored as percent (e.g. 6.50) */
      CREATE TABLE IF NOT EXISTS dividend_yield (
        fund_id               INTEGER NOT NULL
                               REFERENCES fundlist(id) ON DELETE CASCADE,
        yr                    INTEGER NOT NULL CHECK (yr BETWEEN 2000 AND 2100),
        annualized_yield_pct  NUMERIC(6,3) NOT NULL
                               CHECK (annualized_yield_pct >= 0 AND annualized_yield_pct <= 100),
        notes                 TEXT,

        created_at            TIMESTAMP DEFAULT (NOW() AT TIME ZONE 'Asia/Hong_Kong'),
        updated_at            TIMESTAMP DEFAULT (NOW() AT TIME ZONE 'Asia/Hong_Kong'),
        created_by            INTEGER REFERENCES users(id),
        updated_by            INTEGER REFERENCES users(id),

        PRIMARY KEY (fund_id, yr)
      );
      CREATE INDEX IF NOT EXISTS dividend_yield_fund_idx ON dividend_yield (fund_id);
    `,
  },

  /* ---------- holdings_change ------------------------------------ */
  {
    name: "holdings_change",
    ddl: `
      CREATE TABLE IF NOT EXISTS holdings_change (
        id            SERIAL PRIMARY KEY,
        fund_name     TEXT NOT NULL,
        investor_name TEXT NOT NULL,
        snapshot_date DATE NOT NULL,

        number_prev   NUMERIC,
        number_now    NUMERIC NOT NULL,
        number_delta  NUMERIC NOT NULL,

        nav_prev      NUMERIC,
        nav_now       NUMERIC NOT NULL,
        nav_delta     NUMERIC NOT NULL,

        full_redeem   BOOLEAN NOT NULL,
        created_on    TIMESTAMP DEFAULT NOW(),

        name_norm     TEXT GENERATED ALWAYS AS (normalize_name(investor_name)) STORED,
        compact_norm  TEXT GENERATED ALWAYS AS (
                        UPPER(regexp_replace(normalize_name(investor_name), '\\s', '', 'g'))
                       ) STORED,

        settled       BOOLEAN DEFAULT FALSE,
        company_id    INTEGER NOT NULL REFERENCES companies(id)
      );
    `,
  },

  /* ---------- holdings_snapshot ---------------------------------- */
  {
    name: "holdings_snapshot",
    ddl: `
      CREATE TABLE IF NOT EXISTS holdings_snapshot (
        id            SERIAL PRIMARY KEY,
        fund_name     TEXT NOT NULL,
        snapshot_date DATE NOT NULL,
        created_on    TIMESTAMP NOT NULL DEFAULT NOW(),

        nav_total     NUMERIC NOT NULL DEFAULT 0,
        currency      TEXT    NOT NULL DEFAULT 'USD',

        company_id    INTEGER NOT NULL REFERENCES companies(id)
      );
    `,
  },

  /* ---------- holdings_detail ------------------------------------ */
  {
    name: "holdings_detail",
    ddl: `
      CREATE TABLE IF NOT EXISTS holdings_detail (
        id            SERIAL PRIMARY KEY,
        snapshot_id   INTEGER NOT NULL,
        class         TEXT    NOT NULL,
        investor_name TEXT    NOT NULL,
        number_held   NUMERIC NOT NULL,
        nav_price     NUMERIC NOT NULL,
        currency      TEXT    NOT NULL,
        nav_value     NUMERIC NOT NULL,
        total_value   NUMERIC NOT NULL,
        created_on    TIMESTAMP NOT NULL DEFAULT NOW(),

        company_id    INTEGER NOT NULL REFERENCES companies(id)
      );
    `,
  },

  /* ---------- investorlist --------------------------------------- */
  {
    name: "investorlist",
    ddl: `
      CREATE TABLE IF NOT EXISTS investorlist (
        id            SERIAL PRIMARY KEY,
        investor_name TEXT NOT NULL,
        status        TEXT NOT NULL,
        createdon     TIMESTAMP NOT NULL DEFAULT NOW(),

        name_norm     TEXT GENERATED ALWAYS AS (normalize_name(investor_name)) STORED,
        compact_norm  TEXT GENERATED ALWAYS AS (
                        UPPER(regexp_replace(normalize_name(investor_name), '\\s', '', 'g'))
                       ) STORED,

        company_id    INTEGER NOT NULL REFERENCES companies(id)
      );
    `,
  },
];

/* ------------------------------------------------------------------ */
async function ensureTables() {
  for (const { name, ddl } of TABLE_DEFS) {
    await pool.query(ddl);
    console.log(`✅ ensured table "${name}"`);
  }
}

module.exports = { ensureTables };
  