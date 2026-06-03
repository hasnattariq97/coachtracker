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
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`✓ Server running on http://localhost:${PORT}`);
    console.log(`✓ Database: server/tracker.db`);
    scheduleJobs();
  });
}

module.exports = app;
