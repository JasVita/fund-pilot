/**
 * Reject the request if the JWT contains no role.
 *  - ‘super’, ‘admin’, ‘user’ → allowed
 *  - null / undefined         → 403 Forbidden
 */
module.exports = function requireRole(req, res, next) {
  if (!req.auth?.role) {
    return res.status(403).json({ error: "No role assigned - ask an admin" });
  }
  next();
};
