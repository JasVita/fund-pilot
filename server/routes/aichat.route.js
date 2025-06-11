/***********************************************************************/
/*  Route module – declares URL ↔ handler                              */
/***********************************************************************/
const express = require("express");
const { aiChatHandler } = require("../controllers/aichat.controller");

const router = express.Router();

/* Only wiring, no heavy logic here */
router.post("/ai-chat", aiChatHandler);

module.exports = router;