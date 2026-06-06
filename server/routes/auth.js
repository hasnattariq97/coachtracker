/**
 * @phase 1
 * @status active
 * @owner phase-builder
 * @last_updated 2026-05-17T23:30:00Z
 * @beads ["login_endpoint_refactor_phase"]
 */

const express = require('express');
const bcrypt = require('bcrypt');
const db = require('../db');
const { generateToken } = require('../auth');

const router = express.Router();

function isValidEmail(email) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
}

function validateLoginInput(email, password) {
  const errors = [];

  if (!email || typeof email !== 'string') {
    errors.push('Email is required');
  } else {
    if (email.length > 255) {
      errors.push('Email is too long');
    }
    const trimmedEmail = email.trim();
    if (!isValidEmail(trimmedEmail)) {
      errors.push('Invalid email format');
    }
  }

  if (!password || typeof password !== 'string') {
    errors.push('Password is required');
  } else {
    if (password.length > 500) {
      errors.push('Password is too long');
    }
  }

  return errors;
}

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate input
    const validationErrors = validateLoginInput(email, password);
    if (validationErrors.length > 0) {
      return res.status(400).json({ error: validationErrors[0] });
    }

    // Normalize email (trim and lowercase)
    const normalizedEmail = email.trim().toLowerCase();

    // Query user by email (case-insensitive)
    const user = await db.prepare('SELECT * FROM users WHERE LOWER(email) = $1').get(normalizedEmail);
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Verify password with bcrypt
    const passwordValid = await bcrypt.compare(password, user.password_hash);
    if (!passwordValid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Generate JWT token
    const token = generateToken(user);

    // Return token (never return password_hash or sensitive data)
    res.json({ token });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
