async function migrateFeedbackSchema(query) {
  try {
    console.log('[Migration] Creating Phase 10 feedback schema...');

    await query(`
      CREATE TABLE IF NOT EXISTS feedback_reports (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        coach_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        type VARCHAR(50) NOT NULL CHECK (type IN ('bug', 'feature_request', 'problem')),
        title VARCHAR(200) NOT NULL,
        description TEXT NOT NULL,
        priority VARCHAR(20) NOT NULL DEFAULT 'medium'
          CHECK (priority IN ('low', 'medium', 'high', 'critical')),
        status VARCHAR(50) NOT NULL DEFAULT 'submitted'
          CHECK (status IN ('submitted', 'diagnosing', 'planned', 'implementing',
                            'testing', 'review', 'approved', 'deployed', 'escalated', 'failed')),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS diagnoses (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        feedback_id UUID NOT NULL REFERENCES feedback_reports(id) ON DELETE CASCADE,
        root_cause TEXT NOT NULL,
        affected_files TEXT[] NOT NULL DEFAULT '{}',
        severity VARCHAR(20) NOT NULL DEFAULT 'medium'
          CHECK (severity IN ('low', 'medium', 'high', 'critical')),
        confidence DECIMAL(3,2) NOT NULL DEFAULT 0.5
          CHECK (confidence >= 0 AND confidence <= 1),
        analysis_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        escalation_reason VARCHAR(500)
      )
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS implementation_plans (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        feedback_id UUID NOT NULL REFERENCES feedback_reports(id) ON DELETE CASCADE,
        plan TEXT NOT NULL,
        estimated_effort_hours DECIMAL(5,2) NOT NULL DEFAULT 1,
        complexity VARCHAR(20) NOT NULL DEFAULT 'simple'
          CHECK (complexity IN ('simple', 'moderate', 'complex')),
        dependencies TEXT[] NOT NULL DEFAULT '{}',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS auto_fixes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        feedback_id UUID NOT NULL REFERENCES feedback_reports(id) ON DELETE CASCADE,
        branch_name VARCHAR(100),
        commit_hash VARCHAR(40),
        pr_number INTEGER,
        status VARCHAR(50) NOT NULL DEFAULT 'implementing'
          CHECK (status IN ('implementing', 'testing_passed', 'testing_failed',
                            'review', 'approved', 'deployed', 'failed')),
        test_results JSONB,
        approval_token_hash VARCHAR(255),
        approval_token_created_at TIMESTAMP,
        approved_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Add columns to existing tables (safe for re-runs)
    await query(`ALTER TABLE auto_fixes ADD COLUMN IF NOT EXISTS approval_token_created_at TIMESTAMP`).catch(() => {});
    await query(`ALTER TABLE auto_fixes ADD COLUMN IF NOT EXISTS generated_code TEXT`).catch(() => {});

    // Fix: add 'testing_pending' to auto_fixes status constraint (was missing, caused silent failures)
    await query(`
      DO $$
      DECLARE cname text;
      BEGIN
        SELECT conname INTO cname FROM pg_constraint
        WHERE conrelid = 'auto_fixes'::regclass AND contype = 'c'
          AND pg_get_constraintdef(oid) LIKE '%status%';
        IF cname IS NOT NULL THEN
          EXECUTE 'ALTER TABLE auto_fixes DROP CONSTRAINT ' || quote_ident(cname);
        END IF;
      END $$;
    `).catch(() => {});
    await query(`
      ALTER TABLE auto_fixes ADD CONSTRAINT auto_fixes_status_check
      CHECK (status IN ('implementing', 'testing_pending', 'testing_passed', 'testing_failed',
                        'review', 'approved', 'deployed', 'failed'))
    `).catch(() => {});

    await query(`CREATE INDEX IF NOT EXISTS idx_feedback_status ON feedback_reports(status)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_feedback_coach ON feedback_reports(coach_id)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_autofix_status ON auto_fixes(status)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_autofix_feedback ON auto_fixes(feedback_id)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_diagnoses_feedback ON diagnoses(feedback_id)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_plans_feedback ON implementation_plans(feedback_id)`);

    console.log('[Migration] ✅ Phase 10 feedback schema created');
  } catch (err) {
    if (err.message && err.message.includes('already exists')) {
      console.log('[Migration] Phase 10 schema already exists, skipping');
    } else {
      throw err;
    }
  }
}

module.exports = { migrateFeedbackSchema };
