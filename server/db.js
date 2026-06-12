const { Pool } = require('pg');
const dns = require('dns');
const { migratePhase9 } = require('./db-migrations/phase9-schema');
const { migratePhase9c } = require('./db-migrations/phase9c-schema');
const { migrateFeedbackSchema } = require('./db-migrations/20260610-feedback-schema');

// Force IPv4 only (fixes Railway PostgreSQL connectivity)
dns.setDefaultResultOrder('ipv4first');

if (!process.env.DATABASE_URL) {
  console.error('FATAL: DATABASE_URL environment variable is not set. Cannot connect to PostgreSQL.');
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

    // Create each table individually with IF NOT EXISTS
    await query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL DEFAULT '',
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL CHECK (role IN ('admin', 'coach')),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await query(`
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
    `);

    await query(`
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
    `);

    await query(`
      CREATE UNIQUE INDEX IF NOT EXISTS unique_notification_dedup
      ON notifications(user_id, task_id, type)
      WHERE task_id IS NOT NULL;
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS email_queue (
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
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS email_logs (
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
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS email_batches (
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

    // Phase 9: Autonomous Coaching System tables
    await migratePhase9(query);

    // Phase 9c: AI-Enhanced Reporting columns and agent_runs table
    await migratePhase9c(query);

    // Phase 10: Autonomous Bug Fix System tables
    await migrateFeedbackSchema(query);

    // Phase 9b: Groq Queue and Agent Decisions tables
    await query(`
      CREATE TABLE IF NOT EXISTS groq_queue (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        request_type VARCHAR NOT NULL,
        payload JSONB NOT NULL,
        status VARCHAR NOT NULL DEFAULT 'pending',
        response JSONB,
        error_message TEXT,
        retry_count INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        started_at TIMESTAMP,
        completed_at TIMESTAMP
      );
    `);
    await query(`
      CREATE INDEX IF NOT EXISTS idx_groq_queue_status ON groq_queue(status);
    `);
    await query(`
      CREATE INDEX IF NOT EXISTS idx_groq_queue_created ON groq_queue(created_at);
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS agent_decisions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        agent_type VARCHAR NOT NULL,
        coach_id INT NOT NULL,
        task_id INT NOT NULL,
        groq_recommendation VARCHAR,
        groq_confidence DECIMAL(3,2),
        groq_reasoning TEXT,
        final_action VARCHAR,
        override_reason VARCHAR,
        overridden BOOLEAN DEFAULT FALSE,
        coach_pattern VARCHAR,
        task_status VARCHAR,
        metadata JSONB,
        FOREIGN KEY (coach_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
      );
    `);
    await query(`
      CREATE INDEX IF NOT EXISTS idx_agent_decisions_coach ON agent_decisions(coach_id);
    `);
    await query(`
      CREATE INDEX IF NOT EXISTS idx_agent_decisions_task ON agent_decisions(task_id);
    `);
    await query(`
      CREATE INDEX IF NOT EXISTS idx_agent_decisions_agent ON agent_decisions(agent_type);
    `);
    await query(`
      CREATE INDEX IF NOT EXISTS idx_agent_decisions_timestamp ON agent_decisions(created_at);
    `);

    console.log('✓ Database tables ready');

    // Migrate old admin@tracker.com → hasnat@niete.edu.pk if not already done
    await query(
      `UPDATE users SET name = $1, email = $2, password_hash = $3
       WHERE email = 'admin@tracker.com' AND role = 'admin'
       AND NOT EXISTS (SELECT 1 FROM users WHERE email = $2)`,
      ['Hasnat Tariq', 'hasnat@niete.edu.pk', '$2b$12$G7sGVwROLniIHfm2lra11O1TcGED7yy/HEhNiNoY4QXtoa1B53PtW']
    );
    // Remove old admin if it survived (i.e. hasnat@... already existed above)
    await query(`DELETE FROM users WHERE email = 'admin@tracker.com'`);

    // Upsert the admin account (handles both fresh installs and re-deploys)
    const adminResult = await query(
      `INSERT INTO users (name, email, password_hash, role)
       VALUES ($1, $2, $3, 'admin')
       ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name, password_hash = EXCLUDED.password_hash, role = EXCLUDED.role
       RETURNING id, email, role`,
      ['Hasnat Tariq', 'hasnat@niete.edu.pk', '$2b$12$G7sGVwROLniIHfm2lra11O1TcGED7yy/HEhNiNoY4QXtoa1B53PtW']
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
module.exports.initializeDatabase = initializeDatabase;
