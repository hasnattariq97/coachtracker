/**
 * @phase 9
 * @status active
 * @owner phase-builder
 * @last_updated 2026-06-09T00:00:00Z
 * @beads ["support-agent-phase9"]
 */

/**
 * Support Agent — Phase 9 Autonomous Coaching System
 *
 * Runs every 30 minutes (after Monitoring Agent) to:
 * 1. Read monitoring snapshots (from previous Monitoring Agent run)
 * 2. Decide intervention strategy based on task status + coach pattern
 * 3. Take actions: tag sheets, queue support emails
 * 4. Prevent message fatigue (30-min tag rule, 4-hour email rule)
 *
 * DECISION-MAKING AGENT. It reads snapshots and decides "should we intervene?" and "what should we do?"
 */

const db = require('../db');
const GoogleSheetsClient = require('../services/google-sheets-client');
const GroqService = require('../services/groq-service');

class SupportAgent {
  constructor() {
    this.name = 'SupportAgent';
    this.sheetsClient = null;
    this.db = db;

    // Fatigue prevention thresholds
    this.TAG_FATIGUE_WINDOW_MINUTES = 30;      // Don't tag same task twice within 30 min
    this.EMAIL_FATIGUE_WINDOW_HOURS = 4;       // Don't email same coach twice within 4 hours
  }

  /**
   * Main entry point: scan monitoring snapshots and decide interventions
   */
  async run() {
    try {
      console.log('💪 SupportAgent: Starting intervention analysis');

      // Initialize Google Sheets client
      this.sheetsClient = new GoogleSheetsClient();
      try {
        await this.sheetsClient.ensureInitialized();
      } catch (err) {
        console.log('Note: Google Sheets client not initialized (OAuth/Service Account not configured)');
        this.sheetsClient = null;
      }

      // Get all snapshots from Monitoring Agent
      const result = await this.db.query(
        `SELECT id, task_id, coach_id, sheet_id, sheet_completion_percent,
                missing_sections, blockers, status, days_remaining, coach_pattern
         FROM monitoring_snapshots
         ORDER BY snapshot_at DESC`
      );

      const snapshots = result.rows || [];
      const actions = [];

      for (const snapshot of snapshots) {
        try {
          const intervention = await this._decideIntervention(snapshot);
          if (intervention && intervention.action) {
            actions.push(intervention);
            await this._executeIntervention(intervention);
          }
        } catch (err) {
          console.error(`Failed to process snapshot ${snapshot.id}:`, err.message);
          await this._logAgentError('intervention_failed', err.message);
        }
      }

      console.log(`✓ SupportAgent: Decided on ${actions.length} interventions`);
      return { analyzedSnapshots: snapshots.length, actionsDecided: actions.length, actions };
    } catch (err) {
      console.error('❌ SupportAgent failed:', err.message);
      await this._logAgentError('run_failed', err.message, 'critical');
      throw err;
    }
  }

  /**
   * Decide intervention strategy based on snapshot
   * Phase 9b: Uses GroqService for AI-informed decisions
   * Fallback to Phase 9 rules if Groq unavailable
   * Returns: { taskId, coachId, action: 'tag'|'email'|'escalate'|null, reason, details }
   */
  async _decideIntervention(snapshot) {
    const { task_id, coach_id, status, days_remaining, coach_pattern, blockers, missing_sections } = snapshot;

    let action = null;
    let reason = '';
    let details = {};
    let groqRecommendation = null;
    let groqConfidence = 0;
    let groqReasoning = '';
    let overridden = false;
    let overrideReason = null;

    try {
      // Step 1: Fetch coach history for context
      let coachHistory = [];
      try {
        const historyResult = await this.db.query(
          `SELECT id, title, status, completed_at, due_date, assigned_at
           FROM tasks WHERE coach_id = $1 ORDER BY assigned_at DESC LIMIT 10`,
          [coach_id]
        );
        coachHistory = (historyResult?.rows || []).map(row => ({
          id: row.id,
          title: row.title,
          status: row.status,
          completed_at: row.completed_at,
          due_date: row.due_date,
          assigned_at: row.assigned_at,
          onTime: row.status === 'completed' && new Date(row.completed_at) <= new Date(row.due_date),
        }));
      } catch (err) {
        console.error(`Failed to fetch coach history for ${coach_id}:`, err.message);
        coachHistory = [];
      }

      // Step 2: Get Groq recommendation (includes fallback if Groq unavailable)
      const groqService = new GroqService();
      const groqAdvice = await groqService.analyzeCoachForIntervention(snapshot, coachHistory);

      // Use Groq recommendation (which may be AI-generated or Phase 9 fallback)
      action = groqAdvice.recommendation;
      groqRecommendation = groqAdvice.recommendation;
      groqConfidence = groqAdvice.confidence || 0;
      groqReasoning = groqAdvice.reasoning || '';
      reason = groqReasoning;

      // Step 3: Apply fatigue rules (can override Groq recommendation)
      if (action === 'tag') {
        const recentTag = await this._checkRecentAction(task_id, 'tag', this.TAG_FATIGUE_WINDOW_MINUTES);
        if (recentTag) {
          overridden = true;
          overrideReason = 'fatigue_rule';
          action = null;
          reason = `[Fatigue rule override] Groq recommended tag, but already tagged ${recentTag.minutes} ago. Wait ${this.TAG_FATIGUE_WINDOW_MINUTES} min between tags.`;
        }
      }

      if (action === 'email') {
        const recentEmail = await this._checkRecentAction(coach_id, 'email', this.EMAIL_FATIGUE_WINDOW_HOURS * 60);
        if (recentEmail) {
          overridden = true;
          overrideReason = 'fatigue_rule';
          action = null;
          reason = `[Fatigue rule override] Groq recommended email, but already emailed ${recentEmail.hours} hours ago. Wait ${this.EMAIL_FATIGUE_WINDOW_HOURS}h between emails.`;
        }
      }

      // Step 4: Log decision to agent_decisions table
      await this._logDecision({
        agent_type: 'support_agent',
        coach_id,
        task_id,
        groq_recommendation: groqRecommendation,
        groq_confidence: groqConfidence,
        groq_reasoning: groqReasoning,
        final_action: action,
        override_reason: overrideReason,
        overridden,
        coach_pattern,
        task_status: status,
      });

      return {
        taskId: task_id,
        coachId: coach_id,
        action,
        reason,
        details,
      };
    } catch (err) {
      console.error(`Error in _decideIntervention for task ${task_id}:`, err.message);
      // Fall back to Phase 9 rules on error
      return await this._decideInterventionPhase9Fallback(snapshot);
    }
  }

  /**
   * Phase 9 fallback: Rule-based intervention (used if Groq fails)
   */
  async _decideInterventionPhase9Fallback(snapshot) {
    const { task_id, coach_id, status, days_remaining, coach_pattern, blockers } = snapshot;

    let action = null;
    let reason = '';
    let details = {};

    // Parse blockers if it's a JSON string
    let blockersArray = [];
    try {
      blockersArray = typeof blockers === 'string' ? JSON.parse(blockers) : (blockers || []);
    } catch (e) {
      blockersArray = [];
    }

    // Decision tree based on task status and coach pattern
    if (status === 'overdue') {
      if (coach_pattern === 'procrastinator') {
        action = 'escalate';
        reason = 'Phase 9 fallback: Procrastinator coach has overdue task. Escalate to admin.';
        details = { severity: 'high' };
      } else {
        action = 'email';
        reason = 'Phase 9 fallback: Task is overdue. Send supportive email.';
        details = { tone: 'supportive' };
      }
    } else if (status === 'at_risk') {
      if (blockersArray && blockersArray.length > 0) {
        action = 'tag';
        reason = 'Phase 9 fallback: Detected blockers. Tag sheet to offer help.';
        details = { blockerCount: blockersArray.length };
      } else if (coach_pattern === 'procrastinator' && days_remaining < 3) {
        action = 'email';
        reason = 'Phase 9 fallback: Procrastinator with <3 days left. Send encouraging email.';
        details = { tone: 'encouraging' };
      } else {
        action = 'tag';
        reason = 'Phase 9 fallback: Task at-risk. Offer proactive support via sheet.';
        details = {};
      }
    } else {
      action = null;
      reason = 'Phase 9 fallback: Task on-time. No intervention needed.';
    }

    // Check fatigue rules
    if (action === 'tag') {
      const recentTag = await this._checkRecentAction(task_id, 'tag', this.TAG_FATIGUE_WINDOW_MINUTES);
      if (recentTag) {
        action = null;
        reason = `Skip: Already tagged ${recentTag.minutes} ago.`;
      }
    }

    if (action === 'email') {
      const recentEmail = await this._checkRecentAction(coach_id, 'email', this.EMAIL_FATIGUE_WINDOW_HOURS * 60);
      if (recentEmail) {
        action = null;
        reason = `Skip: Already emailed ${recentEmail.hours} hours ago.`;
      }
    }

    return {
      taskId: task_id,
      coachId: coach_id,
      action,
      reason,
      details,
    };
  }

  /**
   * Execute the decided intervention
   */
  async _executeIntervention(intervention) {
    const { taskId, coachId, action, details } = intervention;

    if (!action) {
      return; // No action decided
    }

    try {
      if (action === 'tag') {
        // Tag the sheet with a support comment
        await this._tagInSheet(taskId, details.message);

        // Log in database
        await this.db.query(
          `INSERT INTO support_actions (task_id, coach_id, action_type, action_status, details)
           VALUES ($1, $2, $3, $4, $5)`,
          [taskId, coachId, 'tag', 'sent', JSON.stringify(details)]
        );

      } else if (action === 'email') {
        // Queue email to coach
        await this._queueEmail(coachId, taskId, details);

        // Log in database
        await this.db.query(
          `INSERT INTO support_actions (task_id, coach_id, action_type, action_status, details)
           VALUES ($1, $2, $3, $4, $5)`,
          [taskId, coachId, 'email', 'queued', JSON.stringify(details)]
        );

      } else if (action === 'escalate') {
        // Notify admin
        await this._queueEmailToAdmin(taskId, coachId, details);

        // Log in database
        await this.db.query(
          `INSERT INTO support_actions (task_id, coach_id, action_type, action_status, details)
           VALUES ($1, $2, $3, $4, $5)`,
          [taskId, coachId, 'escalate', 'pending', JSON.stringify(details)]
        );
      }

      console.log(`✓ Support action executed: ${action} for task ${taskId}`);
    } catch (err) {
      console.error(`Failed to execute ${action} for task ${taskId}:`, err.message);
      await this._logAgentError('execution_failed', err.message);
    }
  }

  /**
   * Log a decision to the agent_decisions table for tracking/analysis
   */
  async _logDecision(data) {
    try {
      await this.db.query(
        `INSERT INTO agent_decisions
         (agent_type, coach_id, task_id, groq_recommendation, groq_confidence,
          groq_reasoning, final_action, override_reason, overridden, coach_pattern,
          task_status, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
        [
          data.agent_type,
          data.coach_id,
          data.task_id,
          data.groq_recommendation,
          data.groq_confidence,
          data.groq_reasoning,
          data.final_action,
          data.override_reason,
          data.overridden,
          data.coach_pattern,
          data.task_status,
          JSON.stringify({ timestamp: new Date().toISOString() })
        ]
      );
    } catch (err) {
      console.error('[SupportAgent] Decision logging error:', err.message);
      // Don't throw - logging failure shouldn't block agent
    }
  }

  /**
   * Tag a sheet with a support comment
   * Uses GoogleSheetsClient to add comment if OAuth is set up
   */
  async _tagInSheet(taskId, message) {
    try {
      if (!this.sheetsClient) {
        console.log(`Note: Sheet tagging skipped (Google Sheets not configured)`);
        return;
      }

      // Get sheet_id from latest monitoring snapshot
      const result = await this.db.query(
        'SELECT sheet_id FROM monitoring_snapshots WHERE task_id = $1 ORDER BY snapshot_at DESC LIMIT 1',
        [taskId]
      );

      if (!result.rows[0] || !result.rows[0].sheet_id) {
        console.log(`No sheet attached to task ${taskId}. Skipping tag.`);
        return;
      }

      const sheetId = result.rows[0].sheet_id;

      // Try to add comment via GoogleSheetsClient (requires OAuth setup)
      try {
        await this.sheetsClient.addComment(sheetId, 'A1', message, 'SupportAgent');
        console.log(`✓ Tagged sheet ${sheetId} with support message`);
      } catch (err) {
        // OAuth not set up yet (acceptable for Phase 9a MVP)
        console.log(`Note: Sheet tagging requires OAuth setup. Skipping for now.`);
      }
    } catch (err) {
      throw new Error(`Tag sheet failed: ${err.message}`);
    }
  }

  /**
   * Queue email to coach via email_queue table
   */
  async _queueEmail(coachId, taskId, details) {
    try {
      await this.db.query(
        `INSERT INTO email_queue (coach_id, type, task_id, status)
         VALUES ($1, $2, $3, $4)`,
        [coachId, 'support', taskId, 'pending']
      );

      console.log(`✓ Queued email to coach ${coachId} for task ${taskId}`);
    } catch (err) {
      throw new Error(`Queue email failed: ${err.message}`);
    }
  }

  /**
   * Queue email to admin for escalation
   */
  async _queueEmailToAdmin(taskId, coachId, details) {
    try {
      // Find admin user
      const adminResult = await this.db.query(
        `SELECT id FROM users WHERE role = $1 LIMIT 1`,
        ['admin']
      );

      if (!adminResult.rows[0]) {
        console.error('No admin user found for escalation email');
        return;
      }

      const adminId = adminResult.rows[0].id;

      await this.db.query(
        `INSERT INTO email_queue (admin_id, type, task_id, status)
         VALUES ($1, $2, $3, $4)`,
        [adminId, 'escalation', taskId, 'pending']
      );

      console.log(`✓ Queued escalation email to admin for task ${taskId}`);
    } catch (err) {
      throw new Error(`Queue admin email failed: ${err.message}`);
    }
  }

  /**
   * Check if we recently took the same action (fatigue prevention)
   * Returns: { minutes, hours } or null if action is old enough
   */
  async _checkRecentAction(targetId, actionType, windowMinutes) {
    try {
      let query;
      let params;

      if (actionType === 'tag') {
        // Check for recent tag on same task
        query = `
          SELECT EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - created_at))/60 as minutes_ago
          FROM support_actions
          WHERE task_id = $1 AND action_type = 'tag'
          ORDER BY created_at DESC LIMIT 1
        `;
        params = [targetId];
      } else if (actionType === 'email') {
        // Check for recent email to same coach
        query = `
          SELECT EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - created_at))/60 as minutes_ago
          FROM support_actions
          WHERE coach_id = $1 AND action_type = 'email'
          ORDER BY created_at DESC LIMIT 1
        `;
        params = [targetId];
      }

      const result = await this.db.query(query, params);

      if (!result.rows[0]) {
        return null; // No recent action
      }

      const minutesAgo = Math.round(result.rows[0].minutes_ago);
      if (minutesAgo < windowMinutes) {
        return {
          minutes: minutesAgo,
          hours: (minutesAgo / 60).toFixed(1)
        };
      }

      return null; // Action is old enough
    } catch (err) {
      console.error(`Fatigue check failed: ${err.message}`);
      return null; // On error, allow the action (fail open)
    }
  }

  /**
   * Log agent error to database
   */
  async _logAgentError(errorType, message, severity = 'medium') {
    try {
      await this.db.query(
        `INSERT INTO agent_errors (agent_name, error_type, error_message, severity)
         VALUES ($1, $2, $3, $4)`,
        [this.name, errorType, message, severity]
      );
    } catch (err) {
      console.error('Failed to log agent error:', err.message);
    }
  }
}

module.exports = SupportAgent;
