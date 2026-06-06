const { Pool } = require('pg');
const dns = require('dns');

// Force IPv4 only (fixes Render + Supabase connectivity)
dns.setDefaultResultOrder('ipv4first');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 60000,
  statement_timeout: 60000,
  query_timeout: 60000,
  max: 5,
  min: 1,
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

// Initialize database in background (non-blocking)
// Tables already exist in Supabase, so this is just a safety check
(async () => {
  try {
    // Check if users table exists
    const checkTable = await query(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_name = 'users'
      ) as exists;
    `);

    if (!checkTable.rows[0].exists) {
      // Only create tables if they don't exist
      await query(`
        CREATE TABLE users (
          id SERIAL PRIMARY KEY,
          name TEXT NOT NULL DEFAULT '',
          email TEXT UNIQUE NOT NULL,
          password_hash TEXT NOT NULL,
          role TEXT NOT NULL CHECK (role IN ('admin', 'coach')),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE tasks (
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

        CREATE TABLE notifications (
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

        CREATE UNIQUE INDEX unique_notification_dedup
        ON notifications(user_id, task_id, type)
        WHERE task_id IS NOT NULL;
      `);
      console.log('✓ Created database tables');
    }

    console.log('✓ PostgreSQL database ready');
  } catch (err) {
    // Non-blocking: log but don't crash server
    console.warn('⚠️  Database initialization warning:', err.message);
  }
})();

// Export async helpers for PostgreSQL
const queryOne = async (text, params = []) => {
  const result = await query(text, params);
  return result.rows[0] || null;
};

const queryAll = async (text, params = []) => {
  const result = await query(text, params);
  return result.rows;
};

const run = async (text, params = []) => {
  const result = await query(text, params);
  return { lastID: result.rows[0]?.id, changes: result.rowCount, rows: result.rows };
};

// Export a synchronous-like interface for compatibility
const db = {
  prepare: (sql) => ({
    get: async (...params) => {
      const result = await query(sql, params);
      return result.rows[0] || null;
    },
    all: async (...params) => {
      const result = await query(sql, params);
      return result.rows;
    },
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
