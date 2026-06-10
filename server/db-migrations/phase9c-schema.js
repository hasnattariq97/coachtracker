/**
 * Phase 9c Database Schema: AI-Enhanced Reporting
 * Adds AI insights columns to daily_reports and agent_runs tracking table
 *
 * @phase 9c
 * @status active
 * @owner phase-builder
 * @last_updated 2026-06-10T00:00:00Z
 */

async function migratePhase9c(queryFn) {
  try {
    await queryFn(`
      ALTER TABLE daily_reports ADD COLUMN IF NOT EXISTS insights JSONB;
    `);
    await queryFn(`
      ALTER TABLE daily_reports ADD COLUMN IF NOT EXISTS generated_by VARCHAR DEFAULT 'rules-based';
    `);
    await queryFn(`
      ALTER TABLE daily_reports ADD COLUMN IF NOT EXISTS ai_confidence DECIMAL(3,2);
    `);

    // agent_runs table for Phase 9c dashboard
    await queryFn(`
      CREATE TABLE IF NOT EXISTS agent_runs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        agent_type VARCHAR NOT NULL,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        status VARCHAR DEFAULT 'success',
        snapshots_created INT,
        coaches_at_risk INT,
        actions_taken INT,
        emails_sent INT,
        tags_created INT,
        escalations INT,
        report_generated BOOLEAN,
        insights_count INT,
        metadata JSONB
      );
    `);
    await queryFn(`
      CREATE INDEX IF NOT EXISTS idx_agent_runs_type ON agent_runs(agent_type);
    `);
    await queryFn(`
      CREATE INDEX IF NOT EXISTS idx_agent_runs_timestamp ON agent_runs(timestamp DESC);
    `);

    console.log('✓ Phase 9c schema migrated');
  } catch (error) {
    console.error('✗ Phase 9c migration failed:', error.message);
    throw error;
  }
}

module.exports = { migratePhase9c };
