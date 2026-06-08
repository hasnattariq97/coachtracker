const { Pool } = require('pg');
const dns = require('dns');

// Force IPv4 only (fixes Railway PostgreSQL connectivity)
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
    // Convert SQLite-style ? placeholders to PostgreSQL-style $1, $2, etc.
    let convertedText = text;
    let paramIndex = 1;
    convertedText = convertedText.replace(/\?/g, () => `$${paramIndex++}`);

    const result = await client.query(convertedText, params);
    return result;
  } finally {
    client.release();
  }
};

// Initialize database synchronously (BLOCKING)
// Ensures tables exist before server starts handling requests
const initializeDatabase = async () => {
  try {
    console.log('🔄 Initializing database...');

    // Check if users table exists
    const checkTable = await query(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_name = 'users'
      ) as exists;
    `);

    if (!checkTable.rows[0].exists) {
      console.log('📋 Creating database tables...');
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

        CREATE TABLE email_queue (
          id SERIAL PRIMARY KEY,
          coach_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
          admin_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
          type TEXT NOT NULL,
          task_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
          status TEXT DEFAULT 'pending',
          attempt INTEGER DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          scheduled_for TIMESTAMP,
          error_message TEXT
        );

        CREATE TABLE email_logs (
          id SERIAL PRIMARY KEY,
          coach_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
          admin_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
          type TEXT NOT NULL,
          task_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
          recipient TEXT NOT NULL,
          status TEXT NOT NULL,
          sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          error_message TEXT
        );

        CREATE TABLE email_batches (
          id SERIAL PRIMARY KEY,
          batch_hash TEXT UNIQUE NOT NULL,
          coach_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          type TEXT NOT NULL,
          email_count INTEGER DEFAULT 0,
          status TEXT DEFAULT 'pending',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          sent_at TIMESTAMP
        );
      `);
      console.log('✓ Created database tables');
    } else {
      console.log('✓ Database tables already exist');
    }

    // Seed admin user if it doesn't exist
    const adminResult = await query(
      `INSERT INTO users (name, email, password_hash, role)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash
       RETURNING id, email, role`,
      ['Admin', 'admin@tracker.com', '$2b$12$f/iWUwb/VZoNRiVj0tAIJO0xjwWwSXZyibakaHTT25JAbzQ6OB30q', 'admin']
    );
    if (adminResult.rows && adminResult.rows[0]) {
      console.log('✓ Admin user seeded:', adminResult.rows[0].email);
    } else {
      console.log('✓ Admin user already exists');
    }

    console.log('✓ PostgreSQL database ready');
  } catch (err) {
    console.error('❌ Database initialization failed:', err.message);
    throw err;
  }
};

// Export function for synchronous initialization
module.exports.initializeDatabase = initializeDatabase;

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
    run: async (...params) => {
      const result = await query(sql, params);
      return result;
    }
  }),
  exec: (sql) => query(sql, []),
  pragma: () => {} // No-op for PostgreSQL
};

module.exports = db;
module.exports.query = query;
module.exports.pool = pool;
