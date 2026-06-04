require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { authenticateToken, requireAdmin } = require('./auth');
const { scheduleJobs } = require('./cron');

const app = express();
const PORT = 3007;

console.log('Testing WITH notifications route...');

const corsOptions = {
  origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  credentials: true
};
app.use(cors(corsOptions));
app.use(express.json());

app.use('/api/auth', require('./routes/auth'));
console.log('Auth route loaded OK');

app.use('/api/coaches', authenticateToken, requireAdmin, require('./routes/coaches'));
console.log('Coaches route loaded OK');

app.use('/api/tasks', authenticateToken, require('./routes/tasks'));
console.log('Tasks route loaded OK');

console.log('About to require notifications routes...');
app.use('/api/notifications', authenticateToken, require('./routes/notifications'));
console.log('Notifications route loaded OK');

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.use((err, req, res, next) => {
  console.error('ERROR:', err.message);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`Test server WITH notifications route on http://localhost:${PORT}`);
  scheduleJobs();
});
