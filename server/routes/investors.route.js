const express = require("express");
const { portfolioOverview } = require("../controllers/investors.controller");

const r = express.Router();
r.get("/investors/portfolio", portfolioOverview);
module.exports = r;
