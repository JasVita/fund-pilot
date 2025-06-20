const { pool } = require("./db");

const TABLE_DEFS = [
  /* ---------- companies ---------- */
  {
    name: "companies",
    ddl: `
      CREATE TABLE IF NOT EXISTS companies (
        id   SERIAL PRIMARY KEY,
        name VARCHAR(255) UNIQUE NOT NULL
      );
    `,
  },

  /* ---------- users ---------- */
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

        /* ---- data-integrity checks -------------------------------- */
        CONSTRAINT role_valid_chk   CHECK (role IN ('super','admin','user') OR role IS NULL),
        CONSTRAINT role_company_chk CHECK (
          (role IN ('admin','user') AND company_id IS NOT NULL)
          OR
          (role IS NULL OR role = 'super')
        )
      );
    `,
  },
];

async function ensureTables() {
  for (const { name, ddl } of TABLE_DEFS) {
    await pool.query(ddl);
    console.log(`✅ ensured table "${name}"`);
  }
}

module.exports = { ensureTables };
