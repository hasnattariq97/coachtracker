/**
 * @phase 9
 * @status active
 * @owner phase-builder
 * @last_updated 2026-06-09T00:00:00Z
 * @beads ["monitoring-agent-phase9"]
 */

/**
 * Monitoring Agent — Phase 9 Autonomous Coaching System
 *
 * Runs every 30 minutes to:
 * 1. Detect at-risk and overdue tasks
 * 2. Analyze task progress from Google Sheets
 * 3. Identify coach behavior patterns
 * 4. Save monitoring snapshot to database
 *
 * READ-ONLY. Does not send notifications.
 */

const db = require('../db');
const GoogleSheetsClient = require('../services/google-sheets-client');

class MonitoringAgent {
  constructor() {
    this.name = 'MonitoringAgent';
    this.sheetsClient = null;
    this.db = db;
  }

  /**
   * Main entry point: run monitoring cycle
   */
  async run() {
    try {
      console.log('🔍 MonitoringAgent: Starting scan');

      // Initialize Google Sheets client
      this.sheetsClient = new GoogleSheetsClient();
      await this.sheetsClient.ensureInitialized();

      // Get all active tasks
      const activeTasks = await this.db.query(
        `SELECT id, coach_id, title, assigned_at, due_date
         FROM tasks
         WHERE status != $1 AND status != $2`,
        ['completed', 'cancelled']
      );

      const snapshots = [];

      for (const task of activeTasks.rows) {
        try {
          const snapshot = await this._analyzeTask(task);
          snapshots.push(snapshot);
        } catch (err) {
          console.error(`Failed to analyze task ${task.id}:`, err.message);
          await this._logAgentError(this.name, 'task_analysis_failed', err.message);
        }
      }

      console.log(`✓ MonitoringAgent: Scanned ${snapshots.length} tasks`);
      return { scannedTasks: snapshots.length, snapshots };
    } catch (err) {
      console.error('❌ MonitoringAgent failed:', err.message);
      await this._logAgentError(this.name, 'run_failed', err.message, 'critical');
      throw err;
    }
  }

  /**
   * Analyze single task for progress and risk
   * Returns: { taskId, coachId, completionPercent, blockers, status, pattern }
   */
  async _analyzeTask(task) {
    const { id: taskId, coach_id: coachId, due_date: dueDateStr, assigned_at: assignedAtStr } = task;

    // 1. Calculate time-based status
    const now = new Date();
    const dueDate = new Date(dueDateStr);
    const assignedDate = new Date(assignedAtStr);
    const totalTime = dueDate - assignedDate;
    const elapsedTime = now - assignedDate;
    const daysRemaining = Math.ceil((dueDate - now) / (1000 * 60 * 60 * 24));

    let status = 'on_time';
    if (daysRemaining < 0) {
      status = 'overdue';
    } else if (elapsedTime > totalTime * 0.75) {
      status = 'at_risk'; // 75% of time elapsed, only 25% left
    }

    // 2. Get task's Google Sheet (if linked)
    const sheetData = await this._analyzeSheet(taskId, coachId);

    // 3. Detect coach behavior pattern
    const pattern = await this._detectCoachPattern(coachId);

    // 4. Save snapshot to database
    const snapshot = {
      taskId,
      coachId,
      sheetId: sheetData.sheetId,
      completionPercent: sheetData.completionPercent,
      missingSections: sheetData.missingSections,
      blockers: sheetData.blockers,
      status,
      daysRemaining,
      pattern,
    };

    // Upsert monitoring_snapshots
    await this.db.query(
      `INSERT INTO monitoring_snapshots
       (task_id, coach_id, sheet_id, sheet_completion_percent, missing_sections, blockers, status, days_remaining, coach_pattern)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (task_id) DO UPDATE SET
         sheet_completion_percent = EXCLUDED.sheet_completion_percent,
         missing_sections = EXCLUDED.missing_sections,
         blockers = EXCLUDED.blockers,
         status = EXCLUDED.status,
         days_remaining = EXCLUDED.days_remaining,
         coach_pattern = EXCLUDED.coach_pattern,
         snapshot_at = CURRENT_TIMESTAMP`,
      [
        taskId,
        coachId,
        sheetData.sheetId,
        sheetData.completionPercent,
        JSON.stringify(sheetData.missingSections),
        JSON.stringify(sheetData.blockers),
        status,
        daysRemaining,
        pattern,
      ]
    );

    return snapshot;
  }

  /**
   * Analyze attached Google Sheet for progress
   * Returns: { sheetId, completionPercent, missingSections, blockers }
   */
  async _analyzeSheet(taskId, coachId) {
    try {
      // Query for sheet_id from task metadata (stored in tasks table as links JSON)
      const taskResult = await this.db.query(
        'SELECT links FROM tasks WHERE id = $1',
        [taskId]
      );

      if (!taskResult.rows[0]) {
        return { sheetId: null, completionPercent: 0, missingSections: [], blockers: [] };
      }

      const links = JSON.parse(taskResult.rows[0].links || '[]');
      const sheetLink = links.find(l => l.url.includes('docs.google.com/spreadsheets'));

      if (!sheetLink) {
        return { sheetId: null, completionPercent: 0, missingSections: [], blockers: [] };
      }

      // Extract sheet ID from URL
      const sheetIdMatch = sheetLink.url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
      if (!sheetIdMatch) {
        return { sheetId: null, completionPercent: 0, missingSections: [], blockers: [] };
      }

      const sheetId = sheetIdMatch[1];

      // Read sheet values
      const { values } = await this.sheetsClient.readSheet(sheetId, 'A:Z');

      // Analyze content
      const completionPercent = this._calculateCompletion(values);
      const missingSections = this._findMissingSections(values);
      const blockers = this._findBlockers(values);

      return {
        sheetId,
        completionPercent,
        missingSections,
        blockers,
      };
    } catch (err) {
      console.error(`Sheet analysis failed for task ${taskId}:`, err.message);
      return { sheetId: null, completionPercent: 0, missingSections: [], blockers: [] };
    }
  }

  /**
   * Detect coach behavior pattern from historical task data
   * Returns: 'procrastinator' | 'fast-track' | 'inconsistent' | 'steady' | 'new_coach'
   */
  async _detectCoachPattern(coachId) {
    try {
      const result = await this.db.query(
        `SELECT
           COUNT(*) as total,
           COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed,
           COUNT(CASE WHEN status = 'overdue' THEN 1 END) as overdue,
           AVG(EXTRACT(EPOCH FROM (completed_at - due_date))/3600)::int as avg_hours_late
         FROM tasks
         WHERE coach_id = $1 AND completed_at IS NOT NULL`,
        [coachId]
      );

      const stats = result.rows[0];
      if (!stats || stats.total === 0 || stats.total === '0') {
        return 'new_coach';
      }

      const total = parseInt(stats.total, 10) || 0;
      const completed = parseInt(stats.completed, 10) || 0;
      const overdue = parseInt(stats.overdue, 10) || 0;
      const avgLate = parseInt(stats.avg_hours_late, 10) || 0;

      if (total === 0) {
        return 'new_coach';
      }

      const completionRate = (completed / total) * 100;
      const overtimeRate = (overdue / total) * 100;

      // Heuristics
      if (overtimeRate > 50 && avgLate > 48) {
        return 'procrastinator'; // Usually late
      } else if (completionRate > 90 && overtimeRate < 10 && avgLate < 6) {
        return 'fast-track'; // Completes early
      } else if (overtimeRate > 30 || Math.abs(avgLate) > 24) {
        return 'inconsistent'; // Variable performance
      } else {
        return 'steady'; // Reliable, on-time
      }
    } catch (err) {
      console.error(`Pattern detection failed for coach ${coachId}:`, err.message);
      return 'unknown';
    }
  }

  /**
   * Helper: Calculate sheet completion percentage
   */
  _calculateCompletion(values) {
    if (!values || values.length === 0) return 0;

    // Simple heuristic: count filled rows vs total rows
    const filledRows = values.filter(row => row && row.some(cell => cell && String(cell).trim())).length;
    const totalRows = values.length;

    return Math.round((filledRows / totalRows) * 100);
  }

  /**
   * Helper: Find empty sections
   */
  _findMissingSections(values) {
    const missing = [];

    if (!values || values.length === 0) {
      missing.push('Sheet is empty');
      return missing;
    }

    // Check for common task template sections
    const headers = values[0] || [];
    const expectedHeaders = ['Task', 'Status', 'Owner', 'Deadline', 'Notes'];

    for (const header of expectedHeaders) {
      if (!headers.some(h => h && String(h).toLowerCase().includes(header.toLowerCase()))) {
        missing.push(`Missing section: ${header}`);
      }
    }

    return missing;
  }

  /**
   * Helper: Find blocker mentions
   */
  _findBlockers(values) {
    const blockers = [];

    if (!values) return blockers;

    for (const row of values) {
      for (const cell of row || []) {
        const text = String(cell).toLowerCase();
        if (text.includes('blocked') || text.includes('stuck') || text.includes('blocked:')) {
          blockers.push(String(cell));
        }
      }
    }

    return blockers;
  }

  /**
   * Helper: Log agent errors to database
   */
  async _logAgentError(agentName, errorType, message, severity = 'medium') {
    try {
      await this.db.query(
        `INSERT INTO agent_errors (agent_name, error_type, error_message, severity)
         VALUES ($1, $2, $3, $4)`,
        [agentName, errorType, message, severity]
      );
    } catch (err) {
      console.error('Failed to log agent error:', err.message);
    }
  }
}

module.exports = MonitoringAgent;
