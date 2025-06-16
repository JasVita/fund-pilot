// config/passport.js
require("dotenv").config();
const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const { findByGoogleId, createFromProfile } = require("../repositories/userRepo");

passport.use(
  new GoogleStrategy(
    {
      clientID:     process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL:  "/api/auth/google/callback"
    },
    async (_access, _refresh, profile, done) => {
      try {
        let user = await findByGoogleId(profile.id);
        if (!user) {
          user = await createFromProfile({
            googleId: profile.id,
            email:    profile.emails[0].value,
            name:     profile.displayName,
            avatar:   profile.photos?.[0]?.value || null
          });
        }
        return done(null, user);          // plain user object
      } catch (err) {
        return done(err);
      }
    }
  )
);

// Serialise just the DB id
passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser(async (id, done) => {
  const { rows } = await require("../config/db").pool.query(
    "SELECT * FROM users WHERE id = $1",
    [id]
  );
  done(null, rows[0]);
});
