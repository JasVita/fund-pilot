const express = require("express");
const { portfolioOverview, investorHoldings } = require("../controllers/investors.controller");

const r = express.Router();
r.get("/investors/portfolio", portfolioOverview);
r.get("/investors/holdings", investorHoldings);
module.exports = r;
