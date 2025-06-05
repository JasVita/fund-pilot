require("dotenv").config();
const express      = require("express");
const cors         = require("cors");
const { verifyConnection } = require("./config/db");
const dashboardRoutes = require("./routes/dashboard.route");

const app = express();

app.use(cors({ origin: "http://localhost:5003", credentials: true }));
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
