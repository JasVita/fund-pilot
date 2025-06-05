const express = require("express");
const {
  unsettledRedemption,
  netCash,
  navVsDiv,
} = require("../controllers/dashboard.controller");

const router = express.Router();

router.get("/dashboard/unsettled-redemption", unsettledRedemption);
// now accepts  ?email=nick@turoid.ai   (parameter is required)
router.get("/dashboard/net-cash", netCash);
router.get("/dashboard/nav-value-totals-vs-div", navVsDiv);

module.exports = router;
