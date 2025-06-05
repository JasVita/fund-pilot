require("dotenv").config();
const express      = require("express");
const cors         = require("cors");
const { verifyConnection } = require("./config/db");
const dashboardRoutes = require("./routes/dashboard.route");

const app = express();

// app.use(cors({ origin: "http://localhost:5003", credentials: true }));
/* ------------------------------------------------------------
 *  CORS
 *  Allow whatever front-end origin you’re developing on
 *  (default Next.js dev port is 3000; you’re on 3003 here).
 * ---------------------------------------------------------- */
const allowedOrigins = [
  "http://localhost:3003",
  "http://localhost:5003",
];
app.use(
  cors({
    origin: (origin, cb) => {
      // allow Postman / curl (no Origin header) as well
      if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
      return cb(new Error("Not allowed by CORS"));
    },
    credentials: true,
  }),
);

app.use(express.json());
app.use(dashboardRoutes);                                 

app.use((_, res) => res.status(404).send("Not found"));


/* -----------------------------------------------------------
 * 1) Check DB, then 2) start server.
 * --------------------------------------------------------- */

const PORT = process.env.PORT || 5003;
(async () => {
  await verifyConnection();       
  app.listen(PORT, () =>
    console.log(`🚀  API running on http://localhost:${PORT}`)
  );
})();

// const PORT = process.env.PORT || 5003;
// app.listen(PORT, () => console.log(`🚀 API running on http://localhost:${PORT}`));
