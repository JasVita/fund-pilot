const express = require("express");
const requireAuth = require("../middlewares/requireAuth");
const requireRole = require("../middlewares/requireRole");
// const { requireCompanyBody } = require("../middlewares/requireCompany");
const requireAdmin = require("../middlewares/requireAdmin");
const requireSuper  = require("../middlewares/requireSuper");
const { unsettledRedemption, netCash, navVsDiv, aumHistory, dealingCalendar } = require("../controllers/dashboard.controller");

const router = express.Router();

router.get("/dashboard/unsettled-redemption", requireAuth, requireRole, unsettledRedemption);
// now accepts  ?email=nick@turoid.ai   (parameter is required)
router.get("/dashboard/net-cash", requireAuth, requireRole, netCash);
router.get("/dashboard/nav-value-totals-vs-div", requireAuth, requireRole, navVsDiv);
router.get("/dashboard/aum",                   requireAuth, requireRole, aumHistory);
router.get("/dashboard/dealing-calendar",      requireAuth, requireRole, dealingCalendar);

/* ── admin-only extras ────────────────────────────────── */
router.get("/api/admin/dashboard",  requireAuth, requireAdmin, (req, res) => {
  res.json({ message: "Hi admin!", company: req.auth.company_id });
});

/* ── super-user extras ────────────────────────────────── */
router.get("/api/super/dashboard",  requireAuth, requireSuper, (_req, res) => {
  res.json({ message: "Hello, Super-user - here is everything." });
});

module.exports = router;
