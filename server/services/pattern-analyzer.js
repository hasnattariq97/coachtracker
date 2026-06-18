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
  static async analyze24HourActions(regionId = null) {
    try {
      const regionFilter = regionId !== null ? 'AND u.region_id = $1' : '';
      const regionParams = regionId !== null ? [regionId] : [];

      // Get support actions from past 24 hours, scoped to region
      const result = await db.query(
        `SELECT sa.id, sa.task_id, sa.coach_id, sa.action_type, sa.action_status, sa.details, sa.created_at
         FROM support_actions sa
         JOIN users u ON u.id = sa.coach_id
         WHERE sa.created_at >= CURRENT_TIMESTAMP - INTERVAL '24 hours'
           ${regionFilter}
         ORDER BY sa.created_at DESC`,
        regionParams
      );

      const actions = result.rows || [];

      // Completion rate: tasks completed vs all non-cancelled tasks in this region
      const completedTasks = await db.query(
        `SELECT COUNT(*) as completed
         FROM tasks t
         JOIN users u ON u.id = t.coach_id
         WHERE t.status = 'completed'
           ${regionFilter}`,
        regionParams
      );

      const totalTasks = await db.query(
        `SELECT COUNT(*) as total
         FROM tasks t
         JOIN users u ON u.id = t.coach_id
         WHERE t.status NOT IN ('cancelled')
           ${regionFilter}`,
        regionParams
      );

      const completedCount = parseInt(completedTasks.rows[0]?.completed || 0, 10);
      const totalCount = parseInt(totalTasks.rows[0]?.total || 0, 10);

      const completionRate = totalCount > 0
        ? Math.round((completedCount / totalCount) * 100)
        : 0;

      // Find common blockers from support_actions
      const commonBlockers = this._parseCommonBlockers(actions);

      // Analyze coach performance
      const coachPerformance = await this._analyzeCoachPerformance(regionId);

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
   * Analyze overall coach performance (all-time, by region)
   */
  static async _analyzeCoachPerformance(regionId = null) {
    try {
      const regionFilter = regionId !== null ? 'AND u.region_id = $1' : '';
      const params = regionId !== null ? [regionId] : [];

      const result = await db.query(
        `SELECT u.id as coach_id, u.name as coach_name,
                COUNT(t.id) as total_tasks,
                COUNT(CASE WHEN t.status = 'completed' THEN 1 END) as completed,
                COUNT(CASE WHEN t.status = 'overdue' THEN 1 END) as overdue
         FROM users u
         LEFT JOIN tasks t ON t.coach_id = u.id AND t.status NOT IN ('cancelled')
         WHERE u.role = 'coach'
           ${regionFilter}
         GROUP BY u.id, u.name
         HAVING COUNT(t.id) > 0
         ORDER BY COUNT(CASE WHEN t.status = 'completed' THEN 1 END) DESC`,
        params
      );

      return (result.rows || []).map(row => {
        const total = parseInt(row.total_tasks, 10);
        const completed = parseInt(row.completed, 10);
        const overdue = parseInt(row.overdue, 10);
        return {
          coachId: row.coach_id,
          coachName: row.coach_name || `Coach ${row.coach_id}`,
          total,
          completed,
          overdue,
          completionRate: total > 0 ? Math.round((completed / total) * 100) : 0,
        };
      });
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
      recommendations.push('🎯 Strong completion rate overall. Keep the momentum!');
    } else if (patterns.completionRate < 60 && patterns.completionRate > 0) {
      recommendations.push('⚠️ Completion rate below 60%. Consider increasing support or reducing task load.');
    }

    if (patterns?.commonBlockers?.length > 0) {
      const topBlocker = patterns.commonBlockers[0].blocker;
      recommendations.push(`🔒 Top blocker: ${topBlocker}. Consider proactive support for these items.`);
    }

    if (patterns?.coachPerformance?.length > 0) {
      const topCoach = patterns.coachPerformance[0];
      if (topCoach?.completionRate > 0) {
        recommendations.push(`⭐ Top performer: ${topCoach.coachName} with ${topCoach.completionRate}% completion (${topCoach.completed}/${topCoach.total} tasks).`);
      }
    }

    if (patterns?.coachPerformance?.length > 1) {
      const lowPerformer = patterns.coachPerformance[patterns.coachPerformance.length - 1];
      if (lowPerformer?.overdue > 0) {
        recommendations.push(`💪 ${lowPerformer.coachName} has ${lowPerformer.overdue} overdue task${lowPerformer.overdue > 1 ? 's' : ''} — consider a check-in.`);
      }
    }

    if (recommendations.length === 0) {
      recommendations.push('✅ No issues to flag today. All coaches are on track.');
    }

    return recommendations;
  }
}

module.exports = PatternAnalyzer;
