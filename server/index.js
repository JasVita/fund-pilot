require("dotenv").config();
const express        = require("express");
const cors           = require("cors");
const cookieParser   = require("cookie-parser");
const passport       = require("passport");
const { verifyConnection } = require("./config/db");
const { ensureTables }    = require("./config/dbInit");
require("./config/passport");

const app = express();
app.use(express.json());

if (process.env.ENV === "dev") {
  app.use(
    cors({
      origin: process.env.FRONTEND_URL,
      credentials: true
    })
  );
}

app.use(cookieParser());
app.use(passport.initialize());
app.use(require("./routes/auth.route"));
app.use(require("./routes/dashboard.route"));
app.use(require("./routes/investors.route"));
app.use(require("./routes/funds.route"));
app.use(require("./routes/aichat.route"));
app.use(require("./routes/admin.route"));

/* ── single route ── */
app.get("/health", (_, res) => res.send("fundpilot API is healthy!"));

// ── start listening ──
const PORT = process.env.PORT || 5003;
(async () => {
  await verifyConnection();
  await ensureTables();
  app.listen(PORT, () =>
    console.log(`🚀 API running on http://localhost:${PORT}`)
  );
})();