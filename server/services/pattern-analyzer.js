/**
 * @phase 9
 * @status active
 * @owner phase-builder
 * @last_updated 2026-06-09T00:00:00Z
 * @beads ["pattern-analyzer-phase9"]
 */

/**
 * Pattern Analyzer — Detect trends in coaching data
 * Finds: completion rate trends, common blockers, coach performance patterns
 */

const db = require('../db');

class PatternAnalyzer {
  /**
   * Analyze 24-hour support actions
   * Returns: { supportActions: [...], completionRate, commonBlockers, coachPerformance }
   */
  static async analyze24HourActions() {
    try {
      // Get actions from past 24 hours
      const result = await db.query(
        `SELECT id, task_id, coach_id, action_type, action_status, details, created_at
         FROM support_actions
         WHERE created_at >= CURRENT_TIMESTAMP - INTERVAL '24 hours'
         ORDER BY created_at DESC`
      );

      const actions = result.rows || [];

      // Analyze completion rate
      const completedTasks = await db.query(
        `SELECT COUNT(*) as completed
         FROM tasks
         WHERE completed_at >= CURRENT_TIMESTAMP - INTERVAL '24 hours'`
      );

      const totalTasks = await db.query(
        `SELECT COUNT(*) as total
         FROM tasks
         WHERE assigned_at <= CURRENT_TIMESTAMP
         AND status IN ('completed', 'overdue')`
      );

      const completedCount = completedTasks.rows[0]?.completed || 0;
      const totalCount = totalTasks.rows[0]?.total || 0;

      const completionRate = totalCount > 0
        ? Math.round((completedCount / totalCount) * 100)
        : 0;

      // Find common blockers from support_actions
      const commonBlockers = this._parseCommonBlockers(actions);

      // Analyze coach performance
      const coachPerformance = await this._analyzeCoachPerformance();

      return {
        supportActions: actions,
        completionRate,
        commonBlockers,
        coachPerformance,
      };
    } catch (err) {
      throw new Error(`24-hour analysis failed: ${err.message}`);
    }
  }

  /**
   * Parse common blockers from support action details
   */
  static _parseCommonBlockers(actions) {
    const blockersMap = {};

    for (const action of actions) {
      if (action.action_type === 'tag' || action.action_type === 'escalate') {
        let details = {};
        try {
          details = action.details ? JSON.parse(action.details) : {};
        } catch (err) {
          console.error(`Failed to parse details JSON for action ${action.id}:`, err.message);
          details = {};
        }
        const message = (details.message || '').toLowerCase();

        // Extract blocked/stuck mentions
        if (message.includes('block')) blockersMap['blocked'] = (blockersMap['blocked'] || 0) + 1;
        if (message.includes('stuck')) blockersMap['stuck'] = (blockersMap['stuck'] || 0) + 1;
        if (message.includes('depend')) blockersMap['dependency'] = (blockersMap['dependency'] || 0) + 1;
        if (message.includes('approval')) blockersMap['approval'] = (blockersMap['approval'] || 0) + 1;
        if (message.includes('clarif')) blockersMap['clarification'] = (blockersMap['clarification'] || 0) + 1;
      }
    }

    // Sort by frequency
    return Object.entries(blockersMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([blocker, count]) => ({ blocker, count }));
  }

  /**
   * Analyze coach performance metrics from past 24 hours
   */
  static async _analyzeCoachPerformance() {
    try {
      const result = await db.query(
        `SELECT coach_id,
                COUNT(*) as total_tasks,
                COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed,
                COUNT(CASE WHEN status = 'overdue' THEN 1 END) as overdue
         FROM tasks
         WHERE assigned_at >= CURRENT_TIMESTAMP - INTERVAL '24 hours'
         GROUP BY coach_id
         ORDER BY completed DESC`
      );

      return (result.rows || []).map(row => ({
        coachId: row.coach_id,
        total: row.total_tasks,
        completed: row.completed,
        overdue: row.overdue,
        completionRate: row.total_tasks > 0
          ? Math.round((row.completed / row.total_tasks) * 100)
          : 0,
      }));
    } catch (err) {
      console.error('Coach performance analysis failed:', err.message);
      return [];
    }
  }

  /**
   * Generate recommendations based on patterns
   * (Heuristic-based — Groq integration in Phase 9b)
   */
  static async generateRecommendations(patterns) {
    const recommendations = [];

    if (patterns.completionRate > 85) {
      recommendations.push('🎯 Strong completion rate this week. Keep the momentum!');
    } else if (patterns.completionRate < 60) {
      recommendations.push('⚠️ Completion rate below 60%. Consider increasing support or reducing task load.');
    }

    if (patterns?.commonBlockers?.length > 0) {
      const topBlocker = patterns.commonBlockers[0].blocker;
      recommendations.push(`🔒 Top blocker: ${topBlocker}. Consider proactive support for these items.`);
    }

    if (patterns?.coachPerformance?.length > 0) {
      const topCoach = patterns.coachPerformance[0];
      recommendations.push(`⭐ Top performer: Coach ${topCoach?.coachId || 'N/A'} with ${topCoach?.completionRate || 0}% completion.`);
    }

    if (patterns?.coachPerformance?.length > 1) {
      const lowPerformer = patterns.coachPerformance[patterns.coachPerformance.length - 1];
      if (lowPerformer?.completionRate < 50) {
        recommendations.push(`💪 Coach ${lowPerformer?.coachId || 'N/A'} needs support: ${lowPerformer?.completionRate || 0}% completion rate.`);
      }
    }

    return recommendations;
  }
}

module.exports = PatternAnalyzer;
