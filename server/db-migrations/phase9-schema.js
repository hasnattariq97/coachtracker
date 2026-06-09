/**
 * Phase 9 Database Schema: Autonomous Coaching System
 * Creates tables for monitoring, support actions, and reporting
 * PostgreSQL version (for Railway deployment)
 */

async function migratePhase9(queryFn) {
  try {
    // Table: monitoring_snapshots
    // Stores agent's view of task progress each cycle
    await queryFn(`
      CREATE TABLE IF NOT EXISTS monitoring_snapshots (
        id SERIAL PRIMARY KEY,
        task_id INTEGER NOT NULL UNIQUE REFERENCES tasks(id) ON DELETE CASCADE,
        coach_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        sheet_id VARCHAR(255),
        snapshot_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        sheet_completion_percent INTEGER DEFAULT 0,
        missing_sections TEXT DEFAULT '[]',
        blockers TEXT DEFAULT '[]',
        status VARCHAR(50) DEFAULT 'on_time',
        days_remaining INTEGER,
        last_update_from_coach TIMESTAMP,
        coach_pattern VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Table: sheet_comments
    // Track comments agents leave in Google Sheets
    await queryFn(`
      CREATE TABLE IF NOT EXISTS sheet_comments (
        id SERIAL PRIMARY KEY,
        task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
        coach_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        comment_id VARCHAR(255),
        message TEXT NOT NULL,
        agent_name VARCHAR(50),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        coach_response_at TIMESTAMP,
        coach_response TEXT
      );
    `);

    // Table: support_actions
    // Track support interventions (emails, tags, notifications)
    await queryFn(`
      CREATE TABLE IF NOT EXISTS support_actions (
        id SERIAL PRIMARY KEY,
        task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
        coach_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        action_type VARCHAR(50) NOT NULL,
        action_status VARCHAR(50) DEFAULT 'pending',
        details TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        sent_at TIMESTAMP,
        coach_response TEXT
      );
    `);

    // Table: daily_reports
    // Archive of all daily reports (for history & trends)
    await queryFn(`
      CREATE TABLE IF NOT EXISTS daily_reports (
        id SERIAL PRIMARY KEY,
        report_date DATE UNIQUE NOT NULL,
        summary_json TEXT NOT NULL,
        patterns_json TEXT NOT NULL,
        recommendations_json TEXT NOT NULL,
        agent_activity_json TEXT,
        email_sent_to VARCHAR(255),
        email_sent_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Table: agent_errors
    // Track agent failures for debugging
    await queryFn(`
      CREATE TABLE IF NOT EXISTS agent_errors (
        id SERIAL PRIMARY KEY,
        agent_name VARCHAR(50) NOT NULL,
        error_type VARCHAR(100) NOT NULL,
        error_message TEXT,
        task_id INTEGER REFERENCES tasks(id) ON DELETE SET NULL,
        severity VARCHAR(50) DEFAULT 'medium',
        resolved BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        resolved_at TIMESTAMP
      );
    `);

    // Table: agent_decisions (Phase 9b)
    // Track all intervention decisions (AI-informed + fallback)
    await queryFn(`
      CREATE TABLE IF NOT EXISTS agent_decisions (
        id SERIAL PRIMARY KEY,
        agent_type VARCHAR(50) NOT NULL,
        coach_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
        groq_recommendation VARCHAR(50),
        groq_confidence DECIMAL(3,2),
        groq_reasoning TEXT,
        final_action VARCHAR(50),
        override_reason VARCHAR(100),
        overridden BOOLEAN DEFAULT FALSE,
        coach_pattern VARCHAR(50),
        task_status VARCHAR(50),
        metadata TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    console.log('✓ Phase 9 schema created');
  } catch (error) {
    console.error('✗ Phase 9 migration failed:', error.message);
    throw error;
  }
}

module.exports = { migratePhase9 };
