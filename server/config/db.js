require("dotenv").config();
const { Pool } = require("pg");

const pool = new Pool({
  host:     process.env.PGHOST,
  port:     process.env.PGPORT,
  database: process.env.PGDATABASE,
  user:     process.env.PGUSER,
  password: process.env.PGPASSWORD,
  ssl:      { rejectUnauthorized: false } 
});

async function verifyConnection() {
  try {
    await pool.query("SELECT 1");
    console.log("✅  PostgreSQL connection successful");
  } catch (err) {
    console.error("❌  PostgreSQL connection failed:", err.message);
    process.exit(1);           // stop the server if the DB is down
  }
}

module.exports = { pool, verifyConnection };
