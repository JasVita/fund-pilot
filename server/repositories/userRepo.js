const { pool } = require("../config/db");

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

module.exports = { findByGoogleId, createFromProfile, findByEmail, updateUserProfile };
