require("dotenv").config();
const express = require("express");
const cors    = require("cors");
const { verifyConnection } = require("./config/db");
const dashboardRoutes = require("./routes/dashboard.route");
const investorsRoutes = require("./routes/investors.route");
const aiChatRoutes    = require("./routes/aichat.route");

const app = express();
app.use(express.json());
if (process.env.ENV === "dev") app.use(cors());

app.use(dashboardRoutes);
app.use(investorsRoutes);
app.use(aiChatRoutes);          // ← your new split route

app.get("/health", (_, res) => res.send("fundpilot API is healthy!")); 

const PORT = process.env.PORT || 5003;
(async () => {

  await verifyConnection(); 
  app.listen(PORT, () => console.log(`🚀  API running on http://localhost:${PORT}`)); //2) start server.

})();
