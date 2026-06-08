/**
 * @phase 1
 * @status active
 * @owner phase-builder
 * @last_updated 2026-05-17T23:10:00Z
 * @beads ["express_app_setup"]
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const db = require('./db');
const { authenticateToken, requireAdmin } = require('./auth');
const { scheduleJobs } = require('./cron');

const app = express();
const PORT = process.env.PORT || 3001;

const corsOptions = {
  origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  credentials: true
};
app.use(cors(corsOptions));
app.use(express.json());

app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

app.use('/api/auth', require('./routes/auth'));

app.use('/api/coaches', authenticateToken, requireAdmin, require('./routes/coaches'));
app.use('/api/tasks', authenticateToken, require('./routes/tasks'));
app.use('/api/notifications', authenticateToken, require('./routes/notifications'));

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.use((err, req, res, next) => {
  console.error('[ERROR HANDLER]', err.message || err);
  if (err.stack) console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

if (require.main === module) {
  (async () => {
    try {
      // Initialize database BEFORE starting server
      await db.initializeDatabase();

      const server = app.listen(PORT, () => {
        console.log(`✓ Server running on http://localhost:${PORT}`);
        console.log(`✓ Database: PostgreSQL (Railway)`);
        scheduleJobs();
      });

      // Handle port conflicts gracefully
      server.on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
          console.error(`\n✗ FATAL: Port ${PORT} is already in use`);
          console.error(`✗ This usually means a previous Node process is still running.\n`);
          console.error(`FIX: Run this command to kill all Node processes:`);
          console.error(`  Windows: taskkill /IM node.exe /F`);
          console.error(`  Linux/Mac: killall -9 node\n`);
          console.error(`Then start a new server in a fresh terminal.\n`);
          process.exit(1);
        }
        throw err;
      });
    } catch (err) {
      console.error('❌ Failed to start server:', err.message);
      process.exit(1);
    }
  })();
}

module.exports = app;
