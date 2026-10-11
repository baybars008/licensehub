const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

router.use(requireAuth);

// Dashboard
router.get('/', (req, res) => {
  const stats = {
    total: db.prepare('SELECT COUNT(*) as n FROM licenses').get().n,
    active: db.prepare("SELECT COUNT(*) as n FROM licenses WHERE status='active'").get().n,
    suspended: db.prepare("SELECT COUNT(*) as n FROM licenses WHERE status='suspended'").get().n,
    expired: db.prepare("SELECT COUNT(*) as n FROM licenses WHERE status='expired'").get().n,
    expiringSoon: db.prepare(`SELECT COUNT(*) as n FROM licenses WHERE status='active' AND expires_at IS NOT NULL AND expires_at <= date('now','+30 days')`).get().n,
  };
  const recent = db.prepare(`
    SELECT l.*, c.name as customer_name FROM licenses l
    JOIN customers c ON c.id = l.customer_id
    ORDER BY l.created_at DESC LIMIT 10
  `).all();
  const recentLogs = db.prepare(`SELECT * FROM validation_logs ORDER BY checked_at DESC LIMIT 20`).all();
  res.render('dashboard', { stats, recent, recentLogs });
});

// Customers
router.get('/customers', (req, res) => {
  const customers = db.prepare('SELECT c.*, COUNT(l.id) as license_count FROM customers c LEFT JOIN licenses l ON l.customer_id = c.id GROUP BY c.id ORDER BY c.created_at DESC').all();
  res.render('customers', { customers, error: null });
});

router.post('/customers', (req, res) => {
  const { name, email } = req.body;
  try {
    db.prepare('INSERT INTO customers (name, email) VALUES (?,?)').run(name.trim(), email.trim().toLowerCase());
    res.redirect('/customers');
  } catch (e) {
    const customers = db.prepare('SELECT c.*, COUNT(l.id) as license_count FROM customers c LEFT JOIN licenses l ON l.customer_id = c.id GROUP BY c.id ORDER BY c.created_at DESC').all();
    res.render('customers', { customers, error: 'Bu email zaten kayıtlı.' });
  }
});

router.post('/customers/:id/delete', (req, res) => {
  db.prepare('DELETE FROM customers WHERE id=?').run(req.params.id);
  res.redirect('/customers');
});

// Licenses
router.get('/licenses', (req, res) => {
  const { status, product, search } = req.query;
  let query = `SELECT l.*, c.name as customer_name, c.email as customer_email FROM licenses l JOIN customers c ON c.id = l.customer_id WHERE 1=1`;
  const params = [];
  if (status) { query += ' AND l.status=?'; params.push(status); }
  if (product) { query += ' AND l.product=?'; params.push(product); }
  if (search) { query += ' AND (l.domain LIKE ? OR c.name LIKE ? OR c.email LIKE ?)'; params.push(`%${search}%`, `%${search}%`, `%${search}%`); }
  query += ' ORDER BY l.created_at DESC';
  const licenses = db.prepare(query).all(...params);
  const customers = db.prepare('SELECT * FROM customers ORDER BY name').all();
  const products = db.prepare('SELECT DISTINCT product FROM licenses ORDER BY product').all().map(r => r.product);
  res.render('licenses', { licenses, customers, products, filters: { status, product, search }, error: null });
});

router.post('/licenses', (req, res) => {
  const { customer_id, product, domain, plan, starts_at, expires_at, notes } = req.body;
  const api_key = uuidv4();
  db.prepare(`INSERT INTO licenses (customer_id, product, domain, plan, api_key, starts_at, expires_at, notes) VALUES (?,?,?,?,?,?,?,?)`)
    .run(customer_id, product.trim(), domain.trim().toLowerCase(), plan, api_key, starts_at, expires_at || null, notes || null);
  res.redirect('/licenses');
});

router.post('/licenses/:id/status', (req, res) => {
  const { status } = req.body;
  db.prepare("UPDATE licenses SET status=?, updated_at=datetime('now') WHERE id=?").run(status, req.params.id);
  res.redirect('/licenses');
});

router.post('/licenses/:id/delete', (req, res) => {
  db.prepare('DELETE FROM licenses WHERE id=?').run(req.params.id);
  res.redirect('/licenses');
});

router.post('/licenses/:id/renew-key', (req, res) => {
  db.prepare("UPDATE licenses SET api_key=?, updated_at=datetime('now') WHERE id=?").run(uuidv4(), req.params.id);
  res.redirect('/licenses');
});

// Logs
router.get('/logs', (req, res) => {
  const logs = db.prepare('SELECT * FROM validation_logs ORDER BY checked_at DESC LIMIT 200').all();
  res.render('logs', { logs });
});

module.exports = router;
