const express = require("express");
const requireAuth = require("../middlewares/requireAuth");
const requireRole = require("../middlewares/requireRole");
// const { requireCompanyBody } = require("../middlewares/requireCompany");
const requireAdmin = require("../middlewares/requireAdmin");
const requireSuper  = require("../middlewares/requireSuper");

const {
  unsettledRedemption,
  fundLevel,
  netCash,
  navVsDiv,
  aumHistory,
  dealingCalendar,
  getDividendYields,
  upsertDividendYields,
  // NEW:
  listFundClasses,
  fundLevelDb,
} = require("../controllers/dashboard.controller");

const router = express.Router();

router.get("/dashboard/unsettled-redemption", requireAuth, requireRole, unsettledRedemption);
router.get("/dashboard/fund-level",            requireAuth, requireRole, fundLevel);
router.get("/dashboard/net-cash",              requireAuth, requireRole, netCash);
router.get("/dashboard/nav-value-totals-vs-div", requireAuth, requireRole, navVsDiv);
router.get("/dashboard/aum",                   requireAuth, requireRole, aumHistory);
router.get("/dashboard/dealing-calendar",      requireAuth, requireRole, dealingCalendar);

/* ── Annualized Dividend Yield (%) per fund/year ───────────── */
router.get("/dashboard/dividend-yields",  requireAuth, requireRole,  getDividendYields);
router.post("/dashboard/dividend-yields", requireAuth, requireSuper, upsertDividendYields);

/* ── NEW: Fund Level (DB-backed) endpoints ──────────────────── */
router.get("/dashboard/fund-classes",    requireAuth, requireRole, listFundClasses);
router.get("/dashboard/fund-level-db",   requireAuth, requireRole, fundLevelDb);

/* Optional aliases (in case router is mounted differently) */
router.get("/dividend-yields",  requireAuth, requireRole, getDividendYields);
router.post("/dividend-yields", requireAuth, requireSuper, upsertDividendYields);

/* ── admin-only extras ────────────────────────────────── */
router.get("/api/admin/dashboard",  requireAuth, requireAdmin, (req, res) => {
  res.json({ message: "Hi admin!", company: req.auth.company_id });
});

/* ── super-user extras ────────────────────────────────── */
router.get("/api/super/dashboard",  requireAuth, requireSuper, (_req, res) => {
  res.json({ message: "Hello, Super-user - here is everything." });
});

module.exports = router;
