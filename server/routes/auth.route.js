// routes/auth.route.js
const express = require("express");
const jwt = require("jsonwebtoken");
const passport = require("passport");
const requireAuth = require("../middlewares/requireAuth");
const { findByGoogleId, findByEmail, createFromProfile, updateUserProfile, createWithEmail, verifyLogin } = require("../repositories/userRepo");

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
    req._isSignup = req.query.state === "signup";
    next();
  },
  passport.authenticate("google", {
    failureRedirect: "/login-failed",
    session: false,
  }),
  async (req, res) => {
    const googleProfile = req.user;
    const isSignup = req._isSignup;

    console.log("\x1b[35m[auth.route] Google callback - isSignup:\x1b[0m", isSignup);
    console.log("\x1b[35m[auth.route] Google callback - profile:\x1b[0m", googleProfile);

    const { findByGoogleId, findByEmail, createFromProfile, updateUserProfile } = require("../repositories/userRepo");

    let user = await findByGoogleId(googleProfile.googleId);

    if (!user) {
      // Try to match by email
      user = await findByEmail(googleProfile.email);
      if (user) {
        console.log("[auth.route] Found user by email. Updating google_id...");
        user = await updateUserProfile({
          id: user.id,
          googleId: googleProfile.googleId,
          name: googleProfile.name,
          avatar: googleProfile.avatar,
        });
      }
    }

    if (!user) {
      console.log("[auth.route] First-time user. Creating new user...");
      user = await createFromProfile({
        googleId: googleProfile.googleId,
        email: googleProfile.email,
        name: googleProfile.name,
        avatar: googleProfile.avatar,
      });
    }

    // Continue with login
    const payload = {
      sub: user.id,
      email: user.email,
      name: user.name,
      avatar: user.avatar,
      role: user.role, 
      company_id: user.company_id,
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

/* ───────────────── Email SIGN-UP ───────────────── */
router.post("/api/auth/signup-email", async (req, res) => {
  
  const { email, password, name, company_id } = req.body;
  console.log("[signup-email] incoming:", email);

  if (!email || !password)
    return res.status(400).json({ error: "E-mail & password required" });

  /* reject duplicates */
  // if (await findByEmail(email))
  //   return res.status(409).json({ error: "E-mail already in use" });

  // const user = await createWithEmail({ email, password, name, companyId: company_id });
  const user = await createWithEmail({ email, password, name, companyId: company_id });
  console.log("[signup-email] upserted user id:", user.id);
  issueJwtAndSetCookie(res, user);
});

/* ───────────────── Email LOGIN ───────────────── */
router.post("/api/auth/login-email", async (req, res) => {
  
  console.log("[login-email] body:", req.body);  

  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ error: "E-mail & password required" });

  const user = await verifyLogin(email, password);
  if (!user) return res.status(401).json({ error: "Invalid credentials" });

  issueJwtAndSetCookie(res, user);
});

/* ───────────────── Shared helper ───────────────── */
function issueJwtAndSetCookie(res, user) {
  const payload = {
    sub:        user.id,
    email:      user.email,
    name:       user.name,
    avatar:     user.avatar,
    role:       user.role,
    company_id: user.company_id || "",
  };

  const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: "7d" });

  res.cookie("fp_jwt", token, {
    httpOnly : true,
    secure   : process.env.ENV !== "dev",
    sameSite : "lax",
    domain   : process.env.ENV === "dev" ? "localhost"
               : process.env.COOKIE_DOMAIN || ".fundpilot.turoid.ai",
    maxAge   : 7 * 24 * 60 * 60 * 1000,
  });

  res.json({ ok: true });                    // front-end will redirect
}

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
