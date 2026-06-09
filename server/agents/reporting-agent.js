/**
 * @phase 9
 * @status active
 * @owner phase-builder
 * @last_updated 2026-06-09T00:00:00Z
 * @beads ["reporting-agent-phase9"]
 */

/**
 * Reporting Agent — Phase 9 Autonomous Coaching System
 *
 * Runs daily at 9am to:
 * 1. Analyze support actions from past 24 hours
 * 2. Detect patterns (completion trends, blockers, coach performance)
 * 3. Generate recommendations via heuristics (Groq in Phase 9b)
 * 4. Create HTML email digest
 * 5. Queue to admin + archive report
 */

const db = require('../db');
const PatternAnalyzer = require('../services/pattern-analyzer');

class ReportingAgent {
  constructor() {
    this.name = 'ReportingAgent';
    this.db = db;
  }

  /**
   * Main entry point: generate and send daily report
   */
  async run() {
    try {
      console.log('📊 ReportingAgent: Generating daily report');

      // 1. Analyze 24-hour patterns
      const patterns = await PatternAnalyzer.analyze24HourActions();

      // 2. Generate recommendations
      const recommendations = await PatternAnalyzer.generateRecommendations(patterns);

      // 3. Create HTML email content
      const emailContent = this._generateEmailHTML(patterns, recommendations);

      // 4. Queue email to admin
      await this._queueReportEmail(emailContent);

      // 5. Archive report to database
      await this._archiveReport(patterns, recommendations);

      console.log('✓ ReportingAgent: Daily report completed');

      return {
        completionRate: patterns.completionRate,
        blockers: patterns.commonBlockers,
        recommendations,
        archived: true,
      };
    } catch (err) {
      console.error('❌ ReportingAgent failed:', err.message);
      await this._logAgentError('run_failed', err.message, 'critical');
      throw err;
    }
  }

  /**
   * Generate HTML email for daily coaching report
   */
  _generateEmailHTML(patterns, recommendations) {
    const { supportActions, completionRate, commonBlockers, coachPerformance } = patterns;

    const blockerHTML = commonBlockers.length > 0
      ? commonBlockers
          .map(b => `<li><strong>${this._formatBlocker(b.blocker)}:</strong> ${b.count} incident${b.count !== 1 ? 's' : ''}</li>`)
          .join('')
      : '<li>No blockers detected</li>';

    const coachPerformanceHTML = coachPerformance.length > 0
      ? coachPerformance
          .slice(0, 3)
          .map(c => `<li>Coach ${c.coachId}: ${c.completionRate}% completion (${c.completed}/${c.total} tasks)</li>`)
          .join('')
      : '<li>No data available</li>';

    const recommendationHTML = recommendations.length > 0
      ? recommendations.map(r => `<li>${r}</li>`).join('')
      : '<li>Keep up the good work!</li>';

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333; background: #f5f5f5; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; background: white; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
          .header { background: linear-gradient(135deg, #0D9488 0%, #059669 100%); color: white; padding: 30px; border-radius: 5px; margin-bottom: 20px; }
          .header h1 { margin: 0; font-size: 24px; }
          .header p { margin: 5px 0 0 0; opacity: 0.9; }
          .section { margin: 20px 0; padding: 15px; border-left: 4px solid #0D9488; background: #f9fafb; }
          .section h2 { margin-top: 0; color: #0D9488; }
          .metric { font-size: 2.5em; font-weight: bold; color: #0D9488; }
          .metric-label { font-size: 0.9em; color: #666; }
          li { margin: 8px 0; }
          .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 0.85em; color: #999; text-align: center; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>📊 Daily Coaching Report</h1>
            <p>${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</p>
          </div>

          <div class="section">
            <h2>📈 Key Metrics</h2>
            <div><span class="metric">${completionRate}%</span></div>
            <div class="metric-label">Completion Rate</div>
            <p style="margin-top: 15px;">Tasks Completed: <strong>${supportActions.filter(a => a.action_type === 'email' || a.action_type === 'tag').length}</strong></p>
            <p>Support Actions Logged: <strong>${supportActions.length}</strong></p>
          </div>

          <div class="section">
            <h2>🔒 Top Blockers</h2>
            <ul>${blockerHTML}</ul>
          </div>

          <div class="section">
            <h2>⭐ Coach Performance</h2>
            <ul>${coachPerformanceHTML}</ul>
          </div>

          <div class="section">
            <h2>💡 Recommendations</h2>
            <ul>${recommendationHTML}</ul>
          </div>

          <div class="footer">
            <p>Generated by ReportingAgent at ${new Date().toISOString().split('T')[0]} ${new Date().toTimeString().split(' ')[0]}</p>
            <p style="margin: 5px 0 0 0; font-size: 0.8em;">Phase 9: Autonomous Multi-Agent Coaching System</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Format blocker names for display
   */
  _formatBlocker(blocker) {
    const titles = {
      'blocked': '🚫 Blocked',
      'stuck': '🔧 Stuck',
      'dependency': '🔗 Dependency',
      'approval': '✋ Approval',
      'clarification': '❓ Clarification',
    };
    return titles[blocker] || blocker;
  }

  /**
   * Queue report email to admin
   */
  async _queueReportEmail(emailContent) {
    try {
      // Find admin user
      const adminResult = await this.db.query(
        `SELECT id, email FROM users WHERE role = 'admin' LIMIT 1`
      );

      if (!adminResult.rows || !adminResult.rows[0]) {
        throw new Error('No admin user found');
      }

      const { id: adminId, email: adminEmail } = adminResult.rows[0];

      // Queue email
      await this.db.query(
        `INSERT INTO email_queue (admin_id, type, status)
         VALUES ($1, $2, $3)`,
        [adminId, 'daily_report', 'pending']
      );

      console.log(`✓ Queued daily report email to admin ${adminEmail}`);
    } catch (err) {
      throw new Error(`Queue email failed: ${err.message}`);
    }
  }

  /**
   * Archive report to daily_reports table
   */
  async _archiveReport(patterns, recommendations) {
    try {
      const today = new Date().toISOString().split('T')[0];

      await this.db.query(
        `INSERT INTO daily_reports
         (report_date, summary_json, patterns_json, recommendations_json, agent_activity_json)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (report_date) DO UPDATE SET
           summary_json = EXCLUDED.summary_json,
           patterns_json = EXCLUDED.patterns_json,
           recommendations_json = EXCLUDED.recommendations_json,
           agent_activity_json = EXCLUDED.agent_activity_json`,
        [
          today,
          JSON.stringify({
            completionRate: patterns.completionRate,
            totalSupportActions: patterns.supportActions.length,
            reportedAt: new Date().toISOString(),
          }),
          JSON.stringify({
            commonBlockers: patterns.commonBlockers,
            coachPerformance: patterns.coachPerformance,
          }),
          JSON.stringify(recommendations),
          JSON.stringify({
            generatedBy: this.name,
            executedAt: new Date().toISOString(),
          }),
        ]
      );

      console.log(`✓ Archived report to daily_reports table for ${today}`);
    } catch (err) {
      throw new Error(`Archive failed: ${err.message}`);
    }
  }

  /**
   * Log agent error
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

module.exports = ReportingAgent;
