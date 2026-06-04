const express = require('express');
const app = express();

console.log('Starting simple server...');

app.get('/', (req, res) => {
  console.log('GET / called');
  res.json({ hello: 'world' });
});

app.use((err, req, res, next) => {
  console.error('ERROR HANDLER:', err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(3001, () => {
  console.log('✓ Simple server listening on port 3001');
});
