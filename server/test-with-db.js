require('dotenv').config();
const express = require('express');
const cors = require('cors');
const db = require('./db');  // <-- THIS LINE
const { authenticateToken, requireAdmin } = require('./auth');
const { scheduleJobs } = require('./cron');

const app = express();
const PORT = 3008;

console.log('Testing WITH db require...');

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
  res.json({ status: 'ok' });
});

app.use((err, req, res, next) => {
  console.error('ERROR:', err.message, err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`Test server WITH db on http://localhost:${PORT}`);
  scheduleJobs();
});
