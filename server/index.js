const express = require("express");
const cors    = require("cors");
require("dotenv").config();

const dashboardRoutes = require("./routes/dashboard.route");
const investorsRoutes = require("./routes/investors.route");
const aiChatRoutes    = require("./routes/aichat.route");

const app = express();
app.use(express.json());
if (process.env.ENV === "dev") app.use(cors());

app.use(dashboardRoutes);
app.use(investorsRoutes);
app.use(aiChatRoutes);          // ← your new split route

app.get("/health", (_, res) => res.send("API healthy"));

const PORT = process.env.PORT || 5103;
app.listen(PORT, () => console.log(`🚀  http://localhost:${PORT}`));
