/**
 *  1. super  –  always allowed
 *  2. admin/user – company_id must match
 *  3. everybody else (role NULL) – forbidden
 */

exports.requireCompanyParam = function (req, res, next) {
  if (!req.auth?.role)
    return res.status(403).json({ error: "No role assigned" });

  if (req.auth.role === "super") return next();

  if (+req.params.cid !== +req.auth.company_id) {
    return res.status(403).json({ error: "Forbidden for this company" });
  }
  next();
};

exports.requireCompanyBody = function (req, res, next) {
  if (!req.auth?.role) return res.status(403).json({ error: "No role assigned" });

  if (req.auth.role === "super") return next();

  if (+req.body.company_id !== +req.auth.company_id) {
    return res.status(403).json({ error: "Forbidden for this company" });
  }
  next();
};
