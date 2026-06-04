const express = require('express');
const cors = require('cors');
const app = express();
const PORT = 3002;

console.log('Starting minimal test server...');

app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => {
  console.log('Health endpoint called');
  res.json({ status: 'ok' });
});

app.use((err, req, res, next) => {
  console.error('ERROR:', err.message);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`Minimal server on http://localhost:${PORT}`);
});
