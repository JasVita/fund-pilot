// routes/auth.route.js
const express  = require("express");
const jwt      = require("jsonwebtoken");
const passport = require("passport");
const requireAuth = require("../middlewares/requireAuth");

const router = express.Router();

/* ---------- 1) Kick off Google ---------- */
router.get(
  "/api/auth/google",
  passport.authenticate("google", {
    scope: ["profile", "email"],
    session: false,
  })
);

/* ---------- 2) Google callback ---------- */
router.get(
  "/api/auth/google/callback",
  passport.authenticate("google", {
    failureRedirect: "/login-failed",
    session: false,
  }),
  (req, res) => {
    const user = req.user; // full DB row

    const payload = {
      sub: user.id,
      email: user.email,
      name: user.name,
      avatar: user.avatar,
    };

    // console.log("\x1b[33m[auth.callback] issuing JWT payload:\x1b[0m", payload);

    const token = jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: "7d",
    });

    /** Choose cookie domain:
     *  - DEV  : if ENV=dev → "localhost"
     *  - PROD : .fundpilot.turoid.ai  (set in .env)
     */
    const cookieDomain =
      process.env.ENV === "dev"
        ? "localhost"
        : process.env.COOKIE_DOMAIN || ".fundpilot.turoid.ai";

    res.cookie("fp_jwt", token, {
      httpOnly: true,
      secure: process.env.ENV !== "dev",
      sameSite: "lax",
      domain: cookieDomain,            // ← ********  ONLY CHANGE
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.redirect(`${process.env.FRONTEND_URL}/dashboard`);
  }
);

/* ---------- 3) Auth probe ---------- */
router.get("/api/auth/me", requireAuth, (req, res) => {
  console.log("\x1b[36m[auth.me] token verified, sending user:\x1b[0m", req.auth);
  res.json({ ok: true, user: req.auth });
});

/* ---------- 4) Logout ---------- */
router.post("/api/auth/logout", (_req, res) => {
  res.clearCookie("fp_jwt");
  res.json({ ok: true });
});

module.exports = router;
