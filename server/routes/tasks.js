/**
 * @phase 3
 * @status draft
 * @owner phase-builder
 * @last_updated 2026-05-17T23:10:00Z
 * @beads []
 */

const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
  res.status(501).json({ error: 'Tasks endpoint not yet implemented' });
});

module.exports = router;
