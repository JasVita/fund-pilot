module.exports = function requireSuper(req, res, next) {
  if (req.auth?.role !== "super") {
    return res.status(403).json({ error: "Super-user access required" });
  }
  next();
};
