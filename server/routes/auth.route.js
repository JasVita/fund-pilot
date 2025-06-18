// routes/auth.route.js
const express = require("express");
const jwt = require("jsonwebtoken");
const passport = require("passport");
const requireAuth = require("../middlewares/requireAuth");
const { findByGoogleId, createFromProfile } = require("../repositories/userRepo");

const router = express.Router();

/* ---------- 1) Kick off Google LOGIN ---------- */
router.get(
  "/api/auth/google",
  passport.authenticate("google", {
    scope: ["profile", "email"],
    session: false,
    state: "login",
  })
);

/* ---------- 2) Kick off Google SIGNUP ---------- */
router.get(
  "/api/auth/google/signup",
  passport.authenticate("google", {
    scope: ["profile", "email"],
    session: false,
    state: "signup",
  })
);

/* ---------- 3) Google callback for both login & signup ---------- */
router.get(
  "/api/auth/google/callback",
  (req, res, next) => {
    // Capture the intent (login or signup) from the Google OAuth state param
    req._isSignup = req.query.state === "signup";
    next();
  },
  passport.authenticate("google", {
    failureRedirect: "/login-failed",
    session: false,
  }),
  async (req, res) => {
    const googleProfile = req.user; // from passport strategy
    const isSignup = req._isSignup;

    let user = await findByGoogleId(googleProfile.id);

    if (!user && isSignup) {
      // User is signing up
      user = await createFromProfile({
        googleId: googleProfile.id,
        email: googleProfile.email,
        name: googleProfile.name,
        avatar: googleProfile.avatar,
      });
    }

    if (!user && !isSignup) {
      // Trying to login without account
      return res.redirect(`${process.env.FRONTEND_URL}/signup-required`);
    }

    const payload = {
      sub: user.id,
      email: user.email,
      name: user.name,
      avatar: user.avatar,
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: "7d",
    });

    const cookieDomain =
      process.env.ENV === "dev"
        ? "localhost"
        : process.env.COOKIE_DOMAIN || ".fundpilot.turoid.ai";

    res.cookie("fp_jwt", token, {
      httpOnly: true,
      secure: process.env.ENV !== "dev",
      sameSite: "lax",
      domain: cookieDomain,
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    res.redirect(`${process.env.FRONTEND_URL}/dashboard`);
  }
);

/* ---------- 4) Auth probe ---------- */
router.get("/api/auth/me", requireAuth, (req, res) => {
  console.log("\x1b[36m[auth.me] token verified, sending user:\x1b[0m", req.auth);
  res.json({ ok: true, user: req.auth });
});

/* ---------- 5) Logout ---------- */
router.post("/api/auth/logout", (_req, res) => {
  res.clearCookie("fp_jwt");
  res.json({ ok: true });
});

module.exports = router;
