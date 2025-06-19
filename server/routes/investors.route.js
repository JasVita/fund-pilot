const express = require("express");
const requireAuth   = require("../middlewares/requireAuth");
const requireRole  = require("../middlewares/requireRole");
const requireAdmin  = require("../middlewares/requireAdmin"); 
const requireSuper  = require("../middlewares/requireSuper"); 
const { portfolioOverview, investorHoldings, listInvestors } = require("../controllers/investors.controller");

const router = express.Router();

/* ------------------------------------------------------------------ *
 * Everyone who is logged-in (user / admin / super) can hit these
 * ------------------------------------------------------------------ */
router.get("/investors/portfolio",  requireAuth, requireRole, portfolioOverview);
router.get("/investors/holdings",   requireAuth, requireRole, investorHoldings);

/* ------------------------------------------------------------------ *
 * Company-aware list (controller already filters by company_id)
 * ------------------------------------------------------------------ */
router.get("/investors",            requireAuth, requireRole, listInvestors);

/* ------------------------------------------------------------------ *
 * Example admin-only endpoint in same file (optional)
 * Only company admins + super can use this.
 * ------------------------------------------------------------------ */
router.delete(
  "/investors/:id",
  requireAuth,
  requireAdmin,
  async (req, res) => {
    // sample admin-only delete
    res.json({ ok: true, deleted: req.params.id });
  }
);

/* ------------------------------------------------------------------ *
 * Example super-user report across ALL companies (optional)
 * ------------------------------------------------------------------ */
router.get(
  "/super/investors/all",
  requireAuth,
  requireSuper,
  async (_req, res) => {
    const { pool } = require("../config/db");
    const { rows } = await pool.query("SELECT * FROM investors ORDER BY company_id, id");
    res.json(rows);
  }
);

module.exports = router;
