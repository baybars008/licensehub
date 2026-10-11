const express = require('express');
const router = express.Router();
const db = require('../db');

router.post('/validate', (req, res) => {
  const { domain, product, api_key } = req.body;
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

  if (!domain || !product || !api_key) {
    return res.status(400).json({ valid: false, reason: 'missing_fields' });
  }

  const license = db.prepare(`
    SELECT l.*, c.name as customer_name, c.email as customer_email
    FROM licenses l
    JOIN customers c ON c.id = l.customer_id
    WHERE l.api_key = ? AND l.domain = ? AND l.product = ?
  `).get(api_key, domain, product);

  if (!license) {
    db.prepare(`INSERT INTO validation_logs (domain, product, api_key, result, reason, ip) VALUES (?,?,?,?,?,?)`)
      .run(domain, product, api_key, 'not_found', 'license_not_found', ip);
    return res.status(404).json({ valid: false, reason: 'license_not_found' });
  }

  const now = new Date().toISOString().split('T')[0];

  if (license.status === 'suspended') {
    db.prepare(`INSERT INTO validation_logs (domain, product, api_key, result, reason, ip) VALUES (?,?,?,?,?,?)`)
      .run(domain, product, api_key, 'invalid', 'suspended', ip);
    return res.json({ valid: false, reason: 'suspended' });
  }

  if (license.expires_at && license.expires_at < now) {
    db.prepare(`UPDATE licenses SET status='expired', updated_at=datetime('now') WHERE id=?`).run(license.id);
    db.prepare(`INSERT INTO validation_logs (domain, product, api_key, result, reason, ip) VALUES (?,?,?,?,?,?)`)
      .run(domain, product, api_key, 'invalid', 'expired', ip);
    return res.json({ valid: false, reason: 'expired' });
  }

  db.prepare(`INSERT INTO validation_logs (domain, product, api_key, result, reason, ip) VALUES (?,?,?,?,?,?)`)
    .run(domain, product, api_key, 'valid', null, ip);

  res.json({
    valid: true,
    plan: license.plan,
    expires_at: license.expires_at || null,
    customer: license.customer_name
  });
});

module.exports = router;
