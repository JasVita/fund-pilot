module.exports = function requireAdmin(req, res, next) {
  if (!req.auth || (req.auth.role !== "admin" && req.auth.role !== "super")) {
    return res.status(403).json({ error: "Admin access required" });
  }
  next();
};