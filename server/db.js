const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const dns = require('dns');

// Force IPv4 only (fixes Render + Supabase connectivity)
dns.setDefaultResultOrder('ipv4first');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 30000,
  statement_timeout: 30000,
  query_timeout: 30000,
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
});

// Helper function to run queries
const query = async (text, params) => {
  const client = await pool.connect();
  try {
    const result = await client.query(text, params);
    return result;
  } finally {
    client.release();
  }
};

// Create tables on startup
(async () => {
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL DEFAULT '',
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL CHECK (role IN ('admin', 'coach')),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS tasks (
        id SERIAL PRIMARY KEY,
        coach_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        description TEXT,
        status TEXT NOT NULL CHECK (status IN ('assigned', 'in_progress', 'completed', 'overdue')),
        priority TEXT NOT NULL CHECK (priority IN ('low', 'medium', 'high')),
        assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        due_date TIMESTAMP NOT NULL,
        completed_at TIMESTAMP,
        delay_reason TEXT,
        links TEXT
      );

      CREATE TABLE IF NOT EXISTS notifications (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        task_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
        task_title TEXT,
        type TEXT NOT NULL,
        message TEXT NOT NULL,
        metadata TEXT,
        insights_status TEXT DEFAULT 'pending',
        read INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE UNIQUE INDEX IF NOT EXISTS unique_notification_dedup
      ON notifications(user_id, task_id, type)
      WHERE task_id IS NOT NULL;
    `);

    // Seed admin user
    const adminExists = await query('SELECT id FROM users WHERE email = $1', ['admin@tracker.com']);
    if (adminExists.rows.length === 0) {
      let seedPassword = process.env.ADMIN_SEED_PASSWORD;

      if (!seedPassword) {
        const defaultPassword = 'admin123';
        if (process.env.NODE_ENV === 'production') {
          throw new Error(
            'ADMIN_SEED_PASSWORD environment variable is required in production. ' +
            'Set a strong password before first startup.'
          );
        }
        console.warn(
          '⚠️  Using default seed password "admin123" for admin@tracker.com. ' +
          'Set ADMIN_SEED_PASSWORD environment variable to use a custom password.'
        );
        seedPassword = defaultPassword;
      }

      if (seedPassword === 'admin123' && process.env.NODE_ENV === 'production') {
        throw new Error('ADMIN_SEED_PASSWORD cannot be "admin123" in production');
      }

      const hashedPassword = bcrypt.hashSync(seedPassword, 12);
      await query('INSERT INTO users (email, password_hash, role) VALUES ($1, $2, $3)', [
        'admin@tracker.com',
        hashedPassword,
        'admin'
      ]);

      const passwordDisplay = seedPassword === 'admin123' ? 'admin123 (dev)' : '[custom password set via env]';
      console.log(`✓ Seeded admin user: admin@tracker.com / ${passwordDisplay}`);
    }

    console.log('✓ PostgreSQL database initialized');
  } catch (err) {
    console.error('Failed to initialize database:', err.message);
    process.exit(1);
  }
})();

// Export a synchronous-like interface for compatibility
const db = {
  prepare: (sql) => ({
    run: (...params) => query(sql, params),
    get: (...params) => query(sql, params).then(res => res.rows[0]),
    all: (...params) => query(sql, params).then(res => res.rows)
  }),
  exec: (sql) => query(sql, []),
  pragma: () => {} // No-op for PostgreSQL
};

module.exports = db;
module.exports.query = query;
module.exports.pool = pool;
