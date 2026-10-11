const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new Database(path.join(DATA_DIR, 'licensehub.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS licenses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    product TEXT NOT NULL,
    domain TEXT NOT NULL,
    plan TEXT NOT NULL DEFAULT 'starter',
    api_key TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','suspended','expired')),
    starts_at TEXT NOT NULL DEFAULT (date('now')),
    expires_at TEXT,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS validation_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    domain TEXT NOT NULL,
    product TEXT NOT NULL,
    api_key TEXT,
    result TEXT NOT NULL CHECK(result IN ('valid','invalid','not_found')),
    reason TEXT,
    ip TEXT,
    checked_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_licenses_domain ON licenses(domain);
  CREATE INDEX IF NOT EXISTS idx_licenses_api_key ON licenses(api_key);
  CREATE INDEX IF NOT EXISTS idx_validation_logs_checked_at ON validation_logs(checked_at);
`);

module.exports = db;
