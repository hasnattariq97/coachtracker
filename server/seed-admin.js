const { Pool } = require('pg');
const dns = require('dns');

// Force IPv4
dns.setDefaultResultOrder('ipv4first');

require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function seedAdmin() {
  const client = await pool.connect();
  try {
    // Delete existing admin if present
    await client.query(
      'DELETE FROM users WHERE email = $1',
      ['admin@tracker.com']
    );
    console.log('Deleted existing admin user (if any)');

    // Insert new admin user
    const result = await client.query(
      'INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING id, email, role',
      ['Admin', 'admin@tracker.com', '$2b$12$f/iWUwb/VZoNRiVj0tAIJO0xjwWwSXZyibakaHTT25JAbzQ6OB30q', 'admin']
    );
    console.log('✓ Admin user created:', result.rows[0]);
  } catch (err) {
    console.error('✗ Error:', err.message);
  } finally {
    client.release();
    pool.end();
  }
}

seedAdmin();
