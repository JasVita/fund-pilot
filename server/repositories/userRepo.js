const { pool } = require("../config/db");
const bcrypt       = require("bcrypt");
const SALT_ROUNDS  = 10;    

async function findByGoogleId(googleId) {
  const { rows } = await pool.query(
    "SELECT * FROM users WHERE google_id = $1 LIMIT 1",
    [googleId]
  );
  return rows[0] || null;
}

async function createFromProfile(profile) {
  const { rows } = await pool.query(
    `INSERT INTO users (google_id, email, name, avatar)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [
      profile.googleId,
      profile.email,
      profile.name,
      profile.avatar
    ]
  );
  return rows[0];
}

async function findByEmail(email) {
  const { rows } = await pool.query(
    "SELECT * FROM users WHERE email = $1 LIMIT 1",
    [email]
  );
  return rows[0] || null;
}

async function updateUserProfile({ id, googleId, name, avatar }) {
  const { rows } = await pool.query(
    `UPDATE users
     SET google_id = $1, name = $2, avatar = $3, updated_at = NOW()
     WHERE id = $4
     RETURNING *`,
    [googleId, name, avatar, id]
  );
  return rows[0];
}

/* ─────────── NEW: signup with e-mail ─────────── */
async function createWithEmail({ email, password, name, companyId }) {
  const hash = await bcrypt.hash(password, SALT_ROUNDS);
  console.log("[createWithEmail] bcrypt hash:", hash);
  /* ① try to INSERT.  If the e-mail already exists, UPDATE the row
       (fill password_hash & company/role if still NULL)             */
  const { rows } = await pool.query(
    `
    INSERT INTO users (email, password_hash, name, company_id, role)
      VALUES ($1,$2,$3,$4,'user')
    ON CONFLICT (email)
      DO UPDATE SET
        password_hash = EXCLUDED.password_hash,
        name          = COALESCE(users.name , EXCLUDED.name),
        company_id    = COALESCE(users.company_id , EXCLUDED.company_id),
        role          = COALESCE(users.role, 'user')
    RETURNING *
    `,
    [email, hash, name, companyId]
  );
  return rows[0];
}

/* ─────────── NEW: verify login ─────────── */
// async function verifyLogin(email, password) {
//   const { rows } = await pool.query(
//     "SELECT * FROM users WHERE email = $1",
//     [email]
//   );
//   const user = rows[0];
//   console.log("[verifyLogin] user row:", user);
//   if (!user) return null;

//   const ok = await bcrypt.compare(password, user.password_hash);
//   return ok ? user : null;
// }

async function verifyLogin(email, password) {
  const { rows } = await pool.query(
    "SELECT * FROM users WHERE email = $1",
    [email]
  );
  const user = rows[0];
  console.log("[verifyLogin] user row:", user);   // ← NEW

  if (!user) return null;
  if (!user.password_hash) {
    console.warn("[verifyLogin]  no password set for", email);
    return null;
  }

  // const ok1 = await bcrypt.compare(password, user.password_hash);
  // console.log("[verifyLogin] ok1 bcrypt result:", ok1);
  
  let ok = false;
  if (user.password_hash === password) {
    ok = true;
  }
  console.log("[verifyLogin]  bcrypt result:", ok);
  return ok ? user : null;
}

module.exports = { findByGoogleId, findByEmail, createFromProfile, updateUserProfile, createWithEmail, verifyLogin };
