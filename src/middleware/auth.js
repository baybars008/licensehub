function requireAuth(req, res, next) {
  if (req.session && req.session.authenticated) return next();
  res.redirect('/login');
}

function requireApiKey(req, res, next) {
  next();
}

module.exports = { requireAuth, requireApiKey };
