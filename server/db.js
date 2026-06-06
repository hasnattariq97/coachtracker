require('dotenv').config();
const { Pool } = require('pg');
const dns = require('dns');

// Force IPv4 only (fixes Render + Supabase connectivity)
dns.setDefaultResultOrder('ipv4first');

if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL not set in .env');
  process.exit(1);
}

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

// Helper: Get single row (matches old .get() behavior)
const queryOne = async (text, params = []) => {
  const result = await pool.query(text, params);
  return result.rows[0] || null;
};

// Helper: Get all rows (matches old .all() behavior)
const queryAll = async (text, params = []) => {
  const result = await pool.query(text, params);
  return result.rows;
};

// Helper: Execute query without returning rows (matches old .run() behavior)
const run = async (text, params = []) => {
  const result = await pool.query(text, params);
  return {
    lastID: result.rows[0]?.id,
    changes: result.rowCount,
    rows: result.rows,
  };
};

// Initialize database in background (non-blocking)
// Tables already exist in Supabase, so this is just a safety check
(async () => {
  try {
    // Check if users table exists
    const checkTable = await queryOne(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_name = 'users'
      ) as exists;
    `);

    if (!checkTable?.exists) {
      // Only create tables if they don't exist
      await run(`
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

// Export async helpers (routes must use await)
module.exports = {
  // Get single row: db.query(sql, params)
  query: queryOne,

  // Get multiple rows: db.queryAll(sql, params)
  queryAll: queryAll,

  // Execute insert/update/delete: db.run(sql, params)
  run: run,

  // Raw pool access if needed
  pool: pool,
};

