
const express = require("express");
const { aiChatHandler } = require("../controllers/aichat.controller");
const requireAuth  = require("../middlewares/requireAuth");
const requireRole  = require("../middlewares/requireRole");

const router = express.Router();

/* Only wiring, no heavy logic here */
router.post("/ai-chat", requireAuth, requireRole, aiChatHandler);

module.exports = router;