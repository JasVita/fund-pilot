const express = require("express");
const requireAuth  = require("../middlewares/requireAuth");
const requireRole  = require("../middlewares/requireRole");
const { listFunds } = require("../controllers/funds.controller");
const router = express.Router();

/* logged-in users only */
router.get("/funds", requireAuth, requireRole, listFunds);

module.exports = router;
