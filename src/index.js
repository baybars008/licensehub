const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const path = require('path');
const SQLiteStore = require('connect-sqlite3')(session);

require('./db'); // init db on startup

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');

const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD
  ? bcrypt.hashSync(process.env.ADMIN_PASSWORD, 10)
  : bcrypt.hashSync('changeme', 10);

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

app.use(session({
  store: new SQLiteStore({ dir: DATA_DIR, db: 'sessions.db' }),
  secret: process.env.SESSION_SECRET || 'licensehub-secret-change-me',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 86400000 * 7, httpOnly: true }
}));

// Login
app.get('/login', (req, res) => {
  if (req.session.authenticated) return res.redirect('/');
  res.render('login', { error: null });
});

app.post('/login', (req, res) => {
  const { password } = req.body;
  if (bcrypt.compareSync(password, ADMIN_PASSWORD_HASH)) {
    req.session.authenticated = true;
    return res.redirect('/');
  }
  res.render('login', { error: 'Yanlış şifre.' });
});

app.post('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/login');
});

// Routes
app.use('/', require('./routes/admin'));
app.use('/api/v1', require('./routes/api'));

// Health check (public)
app.get('/health', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

app.listen(PORT, '0.0.0.0', () => {
  console.log(`LicenseHub running on port ${PORT}`);
  if (!process.env.ADMIN_PASSWORD) console.warn('WARN: ADMIN_PASSWORD not set, using default "changeme"');
  if (!process.env.SESSION_SECRET) console.warn('WARN: SESSION_SECRET not set, using default value');
});
