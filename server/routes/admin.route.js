const express       = require("express");
const requireAuth   = require("../middlewares/requireAuth");
const requireAdmin  = require("../middlewares/requireAdmin");
const requireSuper  = require("../middlewares/requireSuper");
const { pool }      = require("../config/db");

const router = express.Router();

/* ========== Admins can see / manage users in *their* company ========== */

router.get("/api/admin/users", requireAuth, requireAdmin, async (req, res) => {
  const { rows } = await pool.query(
    "SELECT id, email, role FROM users WHERE company_id = $1 ORDER BY email",
    [req.auth.company_id]
  );
  res.json(rows);
});

/* Promote / demote within same company */
router.put(
  "/api/admin/users/:uid/role",
  requireAuth,
  requireAdmin,
  async (req, res) => {
    const { uid } = req.params;
    const { newRole } = req.body;          // 'user' or 'admin'
    if (!["user", "admin"].includes(newRole))
      return res.status(400).json({ error: "Invalid role" });

    const { rows } = await pool.query(
      `UPDATE users
         SET role = $1
       WHERE id = $2
         AND company_id = $3      -- can only touch same-company users
       RETURNING id, email, role`,
      [newRole, uid, req.auth.company_id]
    );
    if (!rows[0]) return res.status(404).json({ error: "User not found" });
    res.json(rows[0]);
  }
);

/* ========== Super user endpoints ========== */

router.get("/api/super/companies", requireAuth, requireSuper, async (_req, res) => {
  const { rows } = await pool.query("SELECT * FROM companies ORDER BY id");
  res.json(rows);
});

router.post("/api/super/companies", requireAuth, requireSuper, async (req, res) => {
  const { name } = req.body;
  const { rows } = await pool.query(
    "INSERT INTO companies (name) VALUES ($1) RETURNING *",
    [name]
  );
  res.json(rows[0]);
});

module.exports = router;
