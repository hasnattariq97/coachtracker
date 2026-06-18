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
   * Main entry point: generate and send daily report (per region + combined super_admin report)
   */
  async run() {
    try {
      console.log('📊 ReportingAgent: Generating daily report');

      // Fetch all regions
      const regionsResult = await this.db.query(`SELECT id, name FROM regions ORDER BY name`);
      const regions = regionsResult.rows || [];

      // 1. Per-region reports — email each region's admin
      for (const region of regions) {
        try {
          await this._runForRegion(region);
        } catch (err) {
          console.error(`Failed to generate report for region ${region.name}:`, err.message);
          await this._logAgentError('region_report_failed', `${region.name}: ${err.message}`);
        }
      }

      // 2. Combined report for super_admin
      const patterns = await PatternAnalyzer.analyze24HourActions();
      const recommendations = await PatternAnalyzer.generateRecommendations(patterns);
      const aiInsights = await this.generateAIInsights(patterns, recommendations);
      const emailContent = this._generateEmailHTML(patterns, recommendations, aiInsights, null);

      // Find super_admin and send combined report
      const superAdminResult = await this.db.query(
        `SELECT id, email FROM users WHERE role = 'super_admin' LIMIT 1`
      );
      if (superAdminResult.rows[0]) {
        const { id: superAdminId } = superAdminResult.rows[0];
        await this._queueReportEmail(emailContent, superAdminId);
      }

      // Archive combined report (region_id = NULL → combined/global)
      await this._archiveReport(patterns, recommendations, aiInsights, null);

      console.log('✓ ReportingAgent: Daily report completed');

      return {
        completionRate: patterns.completionRate,
        blockers: patterns.commonBlockers,
        recommendations,
        aiInsights,
        archived: true,
      };
    } catch (err) {
      console.error('❌ ReportingAgent failed:', err.message);
      await this._logAgentError('run_failed', err.message, 'critical');
      throw err;
    }
  }

  /**
   * Generate and send report for a single region
   */
  async _runForRegion(region) {
    // Analyze 24-hour patterns for this region's coaches
    const patterns = await PatternAnalyzer.analyze24HourActions(region.id);
    const recommendations = await PatternAnalyzer.generateRecommendations(patterns);
    const aiInsights = await this.generateAIInsights(patterns, recommendations);
    const emailContent = this._generateEmailHTML(patterns, recommendations, aiInsights, region.name);

    // Find this region's admin
    const adminResult = await this.db.query(
      `SELECT id, email FROM users WHERE role = 'admin' AND region_id = $1 LIMIT 1`,
      [region.id]
    );

    if (adminResult.rows[0]) {
      const { id: adminId } = adminResult.rows[0];
      await this._queueReportEmail(emailContent, adminId);
      console.log(`✓ Queued daily report email to admin for region ${region.name}`);
    } else {
      console.warn(`No admin found for region ${region.name} — skipping email`);
    }

    // Archive per-region report
    await this._archiveReport(patterns, recommendations, aiInsights, region.id);
    console.log(`✓ Archived report for region ${region.name}`);
  }

  /**
   * Generate AI insights for the daily report using GroqService
   * Returns null on failure (non-blocking)
   */
  async generateAIInsights(patterns, recommendations) {
    try {
      const GroqService = require('../services/groq-service');
      const groqService = new GroqService();

      const context = {
        actions_24h: patterns.supportActions ? patterns.supportActions.length : 0,
        emails_sent: patterns.supportActions ? patterns.supportActions.filter(a => a.action_type === 'email').length : 0,
        tags_created: patterns.supportActions ? patterns.supportActions.filter(a => a.action_type === 'tag').length : 0,
        escalations: patterns.supportActions ? patterns.supportActions.filter(a => a.action_type === 'escalate').length : 0,
        coaches_affected: patterns.coachPerformance ? patterns.coachPerformance.length : 0,
        on_time_rate: patterns.completionRate ? patterns.completionRate / 100 : 0,
        coach_patterns: patterns.coachPerformance
          ? [...new Set(patterns.coachPerformance.map(c => c.pattern).filter(Boolean))]
          : []
      };

      const insights = await groqService.generateReportingInsights(context);
      return insights;
    } catch (err) {
      console.error('[ReportingAgent] generateAIInsights error:', err.message);
      return null;
    }
  }

  /**
   * Generate HTML email for daily coaching report
   * @param {object} patterns - analyzed patterns
   * @param {string[]} recommendations - list of recommendations
   * @param {object|null} aiInsights - AI insights or null
   * @param {string|null} regionName - region name for header (null = combined/global report)
   */
  _generateEmailHTML(patterns, recommendations, aiInsights = null, regionName = null) {
    const { supportActions, completionRate, commonBlockers, coachPerformance } = patterns;

    const blockerHTML = commonBlockers.length > 0
      ? commonBlockers
          .map(b => `<li><strong>${this._formatBlocker(b.blocker)}:</strong> ${b.count} incident${b.count !== 1 ? 's' : ''}</li>`)
          .join('')
      : '<li>No blockers detected</li>';

    const coachPerformanceHTML = coachPerformance.length > 0
      ? coachPerformance
          .slice(0, 5)
          .map(c => `<li><strong>${c.coachName}</strong>: ${c.completionRate}% completion (${c.completed}/${c.total} tasks, ${c.overdue} overdue)</li>`)
          .join('')
      : '<li>No coach data available yet</li>';

    const recommendationHTML = recommendations.length > 0
      ? recommendations.map(r => `<li>${r}</li>`).join('')
      : '<li>Keep up the good work!</li>';

    const aiInsightsHTML = aiInsights ? `
  <div class="section" style="border-left-color: #EA580C;">
    <h2>🤖 AI Coaching Insights</h2>
    ${aiInsights.key_insights && aiInsights.key_insights.length > 0 ? `
      <h3 style="color: #EA580C; font-size: 1em;">Key Insights</h3>
      <ul>${aiInsights.key_insights.map(i => `<li>${i}</li>`).join('')}</ul>
    ` : ''}
    ${aiInsights.recommendations && aiInsights.recommendations.length > 0 ? `
      <h3 style="color: #EA580C; font-size: 1em;">Recommendations</h3>
      <ul>${aiInsights.recommendations.map(r => `<li>${r}</li>`).join('')}</ul>
    ` : ''}
    <p style="font-size: 0.8em; color: #999;">Confidence: ${Math.round((aiInsights.confidence || 0) * 100)}% | ${aiInsights.confidence > 0.5 ? 'Groq AI' : 'Rule-based fallback'}</p>
  </div>
` : '';

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
            <h1>📊 Daily Coaching Report${regionName ? ` — ${regionName}` : ' (All Regions)'}</h1>
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

          ${aiInsightsHTML}

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
   * Queue report email to a specific admin by ID
   * @param {string} emailContent - HTML email content (unused by queue, kept for future use)
   * @param {number} adminId - the admin's user ID to send the report to
   */
  async _queueReportEmail(emailContent, adminId) {
    try {
      if (!adminId) {
        throw new Error('No admin ID provided for report email');
      }

      // Queue email
      await this.db.query(
        `INSERT INTO email_queue (admin_id, type, status)
         VALUES ($1, $2, $3)`,
        [adminId, 'daily_report', 'pending']
      );

      console.log(`✓ Queued daily report email to admin ID ${adminId}`);
    } catch (err) {
      throw new Error(`Queue email failed: ${err.message}`);
    }
  }

  /**
   * Archive report to daily_reports table
   * @param {object} patterns - analyzed patterns
   * @param {string[]} recommendations - recommendations list
   * @param {object|null} aiInsights - AI insights or null
   * @param {number|null} regionId - region ID for per-region reports; NULL = combined/global
   */
  async _archiveReport(patterns, recommendations, aiInsights = null, regionId = null) {
    try {
      const today = new Date().toISOString().split('T')[0];

      // Delete the existing row for this (report_date, region_id) pair before re-inserting.
      // This is the safest way to upsert when the unique index is on a functional expression
      // (COALESCE(region_id, 0)), which PostgreSQL does not support in ON CONFLICT clauses
      // without naming the index explicitly.
      // The WHERE handles both the per-region case (integer match) and the combined report
      // (both sides are NULL, so we use an IS NULL check rather than = NULL).
      await this.db.query(
        `DELETE FROM daily_reports
         WHERE report_date = $1
           AND (
             (region_id = $2)
             OR ($2 IS NULL AND region_id IS NULL)
           )`,
        [today, regionId]
      );

      await this.db.query(
        `INSERT INTO daily_reports
         (report_date, region_id, summary_json, patterns_json, recommendations_json, agent_activity_json, insights, generated_by, ai_confidence)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          today,
          regionId,
          JSON.stringify({
            completionRate: patterns.completionRate,
            totalSupportActions: (patterns.supportActions || []).length,
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
            regionId,
          }),
          aiInsights ? JSON.stringify(aiInsights) : null,
          aiInsights ? 'groq-ai' : 'rules-based',
          aiInsights ? (aiInsights.confidence || null) : null,
        ]
      );

      console.log(`✓ Archived report to daily_reports table for ${today} (region_id: ${regionId})`);
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
