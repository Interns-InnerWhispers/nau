require('dotenv').config({ path: '../.env' });
const express = require('express');
const cors    = require('cors');
const helmet  = require('helmet');
const path    = require('path');

// Initialize database connection
require('./config/database');

// Middleware imports
const logging                        = require('./middleware/logging');
const errorHandler                   = require('./middleware/errorHandler');
const { validatePagination, sanitizeQuery } = require('./middleware/validation');
const { multitenancy }               = require('./middleware/multitenancy');
const { authenticate: authMiddleware }= require('./middleware/auth');

// Response helpers
const { successResponse } = require('./utils/response');

// Route imports
const authRoutes         = require('./routes/authRoutes');
const dashboardRoutes    = require('./routes/dashboardRoutes');
const activitiesRoutes   = require('./routes/activitiesRoutes');
const financeRoutes      = require('./routes/financeRoutes');
const usersRoutes        = require('./routes/usersRoutes');
const organizationsRoutes= require('./routes/organizationsRoutes');
const proposalsRoutes    = require('./routes/proposalsRoutes');
const celebrationsRoutes = require('./routes/celebrationsRoutes');
const selfDrivenRoutes   = require('./routes/selfDrivenRoutes');
const reportsRoutes      = require('./routes/reportsRoutes');
const settingsRoutes     = require('./routes/settingsRoutes');
const socialMediaRoutes  = require('./routes/socialMediaRoutes');
const adminRoutes        = require('./routes/adminRoutes');
const notificationsRoutes = require('./routes/notificationsRoutes');

const app  = express();
const PORT = 3006;

// ── Security headers ────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc:  ["'self'", "'unsafe-inline'", "cdn.tailwindcss.com", "cdnjs.cloudflare.com", "cdn.socket.io", "fonts.googleapis.com"],
      scriptSrcAttr: ["'self'", "'unsafe-inline'"],
      styleSrc:   ["'self'", "'unsafe-inline'", "fonts.googleapis.com"],
      fontSrc:    ["'self'", "fonts.gstatic.com"],
      imgSrc:     ["'self'", "data:", "*.amazonaws.com"],
      connectSrc: ["'self'", "http://localhost:3006", "ws://localhost:3006", "wss://localhost:3006", "ws:", "wss:", "https://cdn.socket.io", "https://cdnjs.cloudflare.com"],
    }
  }
}));

// ── CORS ────────────────────────────────────────────────────
app.use(cors({
  origin: (process.env.CORS_ORIGIN || 'http://localhost:3006').split(','),
  credentials: true
}));

// ── Body parsing ─────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// ── Logging & query sanitization ─────────────────────────────
app.use(logging);
app.use(sanitizeQuery);

// ── Static files ─────────────────────────────────────────────
app.use(express.static(path.join(__dirname, '../frontend')));
// Serve HTML pages at root-relative paths
app.use('/html', express.static(path.join(__dirname, '../frontend/html')));
app.use('/images', express.static(path.join(__dirname, '../images')));

// ── Health check (public) ─────────────────────────────────────
app.get('/api/v1/health', (req, res) => {
  successResponse(res, { status: 'ok', timestamp: new Date().toISOString(), version: '1.0.0' }, 'Server is running');
});

// ── Public routes ─────────────────────────────────────────────
app.use('/api/v1/auth', authRoutes);

// ── Auth middleware for all protected routes ──────────────────
app.use('/api/v1', authMiddleware);
app.use('/api/v1', validatePagination);
app.use('/api/v1', multitenancy);

// ── Protected routes ──────────────────────────────────────────
app.use('/api/v1/dashboard',      dashboardRoutes);
app.use('/api/v1/activities',     activitiesRoutes);
app.use('/api/v1/finance',        financeRoutes);
app.use('/api/v1/users',          usersRoutes);
app.use('/api/v1/organizations',  organizationsRoutes);
app.use('/api/v1/proposals',      proposalsRoutes);
app.use('/api/v1/celebrations',   celebrationsRoutes);
app.use('/api/v1/self-driven',    selfDrivenRoutes);
app.use('/api/v1/reports',        reportsRoutes);
app.use('/api/v1/settings',       settingsRoutes);
app.use('/api/v1/social-media',   socialMediaRoutes);
app.use('/api/v1/admin',          adminRoutes);
app.use('/api/v1/notifications',  notificationsRoutes);

// ── SPA fallback ─────────────────────────────────────────────
// Any non-API, non-static route returns the login page
app.get(/^(?!\/api|\/html|\/images|\/css|\/js).*$/, (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/html/index.html'));
});

// ── 404 for unmatched API routes ──────────────────────────────
app.use((req, res) => {
  res.status(404).json({
    success: false, code: 'NOT_FOUND',
    message: `Route ${req.method} ${req.originalUrl} not found`
  });
});

// ── Global error handler ──────────────────────────────────────
app.use(errorHandler);

// ── Start server ──────────────────────────────────────────────
const server = app.listen(PORT, () => {
  console.log('');
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║        NAU Dashboard Backend — Server Started            ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log('');
  console.log(`  🚀 Server:      http://localhost:${PORT}`);
  console.log(`  📡 API Base:    http://localhost:${PORT}/api/v1`);
  console.log(`  🏥 Health:      http://localhost:${PORT}/api/v1/health`);
  console.log(`  🔐 Login:       http://localhost:${PORT}/html/index.html`);
  console.log('');
  console.log(`  📝 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`  🗄️  Database:    ${process.env.DB_HOST}:${process.env.DB_PORT || 3006}/${process.env.DB_NAME}`);
  console.log('');
});

process.on('SIGINT', () => {
  console.log('\n✓ Shutting down gracefully...');
  server.close(() => { console.log('✓ Server closed'); process.exit(0); });
});

module.exports = app;
