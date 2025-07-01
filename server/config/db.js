require("dotenv").config();
const { Pool } = require("pg");

const pool = new Pool({
  host:     process.env.PGHOST,
  port:     process.env.PGPORT,
  database: process.env.PGDATABASE,
  user:     process.env.PGUSER,
  password: process.env.PGPASSWORD,
  ssl:      { rejectUnauthorized: false },
  
  /* 🆕 pool controls */
  max: 8,                       // ← keep ≤ (RDS max_connections – other apps)
  idleTimeoutMillis: 30_000,    // 30 s
  connectionTimeoutMillis: 5_000,
  allowExitOnIdle: true,
});

/* ---------------------------------------------------------------
 * Verify connectivity on server start-up
 * ------------------------------------------------------------- */
async function verifyConnection() {
  try {
    await pool.query("SELECT 1");
    console.log("✅  PostgreSQL connection successful");
  } catch (err) {
    console.error("❌  PostgreSQL connection failed:", err.message);
    process.exit(1);           // stop the server if the DB is down
  }
}

/* ---------------------------------------------------------------
 * Gracefully release the pool when nodemon or PM2 restarts
 * ------------------------------------------------------------- */
function setupGracefulShutdown() {
  const shutdown = () => {
    pool.end(() => {
      console.log("📪  PG pool closed");
      process.exit(0);
    });
  };
  process.once("SIGTERM", shutdown);
  process.once("SIGINT",  shutdown);
}

setupGracefulShutdown();

module.exports = { pool, verifyConnection };
