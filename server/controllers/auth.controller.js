// server/controllers/auth.controller.js
const jwt           = require("jsonwebtoken");
const { findByEmail, verifyLogin } = require("../repositories/userRepo");

/* ------------------------------------------------------------
 * POST /api/auth/login-email
 * ------------------------------------------------------------ */
exports.loginEmail = async (req, res) => {
  const { email = "", password = "" } = req.body;

  /* 1️⃣  Does this e‑mail exist? -------------------------------- */
  const user = await findByEmail(email.trim());
  if (!user) {
    return res            // 404 so the client knows “no such user”
      .status(404)
      .json({ error: "We couldn't find that account - please sign-up first." });
  }

  /* 2️⃣  Check password ---------------------------------------- */
  const ok = await verifyLogin(email, password);
  if (!ok) {
    return res            // 401 = authentication failed
      .status(401)
      .json({ error: "Incorrect password - please try again." });
  }

  /* 3️⃣  Issue JWT & set cookie -------------------------------- */
  const token = jwt.sign(
    { id: user.id, role: user.role, company_id: user.company_id },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );
  res.cookie("fp_jwt", token, { httpOnly: true, sameSite: "lax" });
  res.json({ ok: true });
};

/** Who am I? Used by the dashboard to decide if the pencil shows. */
exports.me = (req, res) => {
  // requireAuth puts the verified payload on req.auth
  const u = req.auth || {};
  console.log("[auth.me] token verified, sending user:", u);

  // return a flat shape the frontend expects
  res.json({
    sub:        u.sub ?? u.id ?? null,
    email:      u.email ?? null,
    name:       u.name ?? null,
    avatar:     u.avatar ?? null,
    role:       u.role || "user",
    company_id: u.company_id ?? null,
  });
};