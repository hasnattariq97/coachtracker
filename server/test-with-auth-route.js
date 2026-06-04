require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { authenticateToken, requireAdmin } = require('./auth');

const app = express();
const PORT = 3004;

console.log('Testing WITH auth route...');

const corsOptions = {
  origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  credentials: true
};
app.use(cors(corsOptions));
app.use(express.json());

console.log('About to require auth routes...');
app.use('/api/auth', require('./routes/auth'));
console.log('Auth route loaded OK');

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.use((err, req, res, next) => {
  console.error('ERROR:', err.message);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`Test server WITH auth route on http://localhost:${PORT}`);
});
