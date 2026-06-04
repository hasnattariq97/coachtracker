require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();
const PORT = 3003;

console.log('Testing without route modules...');

const corsOptions = {
  origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  credentials: true
};
app.use(cors(corsOptions));
app.use(express.json());

// NO route requires yet

app.get('/health', (req, res) => {
  console.log('Health called');
  res.json({ status: 'ok' });
});

app.use((err, req, res, next) => {
  console.error('ERROR:', err.message);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`Test server (no routes) on http://localhost:${PORT}`);
});
