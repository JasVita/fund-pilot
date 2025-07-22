const express      = require("express");
const requireAuth  = require("../middlewares/requireAuth");
const requireRole  = require("../middlewares/requireRole");

const {
  missingInvestorStatements,
  verifyBankStatements, verifyInvestorStatements, verifyContactNotes,
} = require("../controllers/files/dashboard.controller");

const router = express.Router();

/* ------------ Missing snapshots (new) ----------- */
router.get( "/files/dashboard/missing-investor-statements",        requireAuth, requireRole, missingInvestorStatements);
/* ----------------  Needs‑Verification endpoints  ---------------- */
router.get("/files/dashboard/verify-bank-statements",              requireAuth, requireRole, verifyBankStatements);
router.get("/files/dashboard/verify-investor-statements",          requireAuth, requireRole, verifyInvestorStatements);
router.get("/files/dashboard/verify-contract-notes",               requireAuth, requireRole, verifyContactNotes);
module.exports = router;
