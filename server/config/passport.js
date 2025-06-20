require("dotenv").config();
const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: "/api/auth/google/callback",
    },
    async (_access, _refresh, profile, done) => {
      try {
        const googleProfile = {
          googleId: profile.id,
          email: profile.emails?.[0]?.value || null,
          name: profile.displayName,
          avatar: profile.photos?.[0]?.value || null,
        };

        console.log("\x1b[36m[passport.js] Google profile received:\x1b[0m", googleProfile);

        return done(null, googleProfile);
      } catch (err) {
        return done(err);
      }
    }
  )
);

// Serialize user.id
passport.serializeUser((user, done) => done(null, user.id));

// Deserialize user by ID
passport.deserializeUser(async (id, done) => {
  const { rows } = await require("../config/db").pool.query(
    "SELECT * FROM users WHERE id = $1",
    [id]
  );
  done(null, rows[0]);
});
