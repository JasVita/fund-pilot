const { pool } = require("./db");

const TABLE_DEFS = [
  {
    name: "users",
    ddl: `
      CREATE TABLE IF NOT EXISTS users (
        id         SERIAL PRIMARY KEY,
        google_id  VARCHAR(100) UNIQUE NOT NULL,
        email      VARCHAR(320)        NOT NULL,
        name       VARCHAR(255),
        avatar     TEXT,
        created_at TIMESTAMP DEFAULT (NOW() AT TIME ZONE 'Asia/Hong_Kong'),
        updated_at TIMESTAMP DEFAULT (NOW() AT TIME ZONE 'Asia/Hong_Kong')
      );
    `
  }
];

async function ensureTables() {
  for (const { name, ddl } of TABLE_DEFS) {
    await pool.query(ddl);
    console.log(`✅ ensured table "${name}"`);
  }
}

module.exports = { ensureTables };
