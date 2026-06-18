const express = require('express');
const router = express.Router();
const db = require('../db');
const { requireAdmin, regionFilter } = require('../auth');

router.get('/agent-status', requireAdmin, async (req, res) => {
  try {
    const regionId = regionFilter(req.user);
    const atRiskParams = regionId !== null ? [regionId] : [];
    const atRiskFilter = regionId !== null ? 'AND region_id = $1' : '';

    const [monitoring, support, reporting, queueDepth, atRiskCount] = await Promise.all([
      db.query(
        `SELECT id, timestamp, snapshots_created, coaches_at_risk, status
         FROM agent_runs WHERE agent_type = 'monitoring'
         ORDER BY timestamp DESC LIMIT 1`
      ),
      db.query(
        `SELECT id, timestamp, actions_taken, emails_sent, tags_created, escalations, status
         FROM agent_runs WHERE agent_type = 'support'
         ORDER BY timestamp DESC LIMIT 1`
      ),
      db.query(
        `SELECT id, timestamp, report_generated, insights_count, status
         FROM agent_runs WHERE agent_type = 'reporting'
         ORDER BY timestamp DESC LIMIT 1`
      ),
      db.query(
        `SELECT COUNT(*) as pending FROM groq_queue WHERE status = 'pending'`
      ),
      db.query(
        `SELECT COUNT(DISTINCT coach_id) as count
         FROM monitoring_snapshots
         WHERE status IN ('at_risk', 'overdue')
           ${atRiskFilter}`,
        atRiskParams
      )
    ]);

    const monitoringRow = monitoring.rows[0] || null;
    if (monitoringRow) {
      monitoringRow.coaches_at_risk = parseInt(atRiskCount.rows[0]?.count || 0);
    }

    res.json({
      monitoring: monitoringRow,
      support: support.rows[0] || null,
      reporting: reporting.rows[0] || null,
      groq_queue_pending: parseInt(queueDepth.rows[0]?.pending || 0),
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error('[Admin API] agent-status error:', err.message);
    res.status(500).json({ error: 'Failed to fetch agent status' });
  }
});

router.get('/decisions', requireAdmin, async (req, res) => {
  try {
    const hours = Math.min(168, Math.max(1, parseInt(req.query.hours) || 24));
    const coachId = req.query.coach_id ? parseInt(req.query.coach_id) : null;
    if (req.query.coach_id && (isNaN(coachId) || coachId <= 0)) {
      return res.status(400).json({ error: 'Invalid coach_id' });
    }

    const regionId = regionFilter(req.user);
    let query = `
      SELECT ad.id, ad.created_at as timestamp, ad.agent_type, ad.coach_id,
             u.name as coach_name,
             ad.groq_recommendation, ad.groq_confidence, ad.final_action,
             ad.override_reason, ad.overridden, ad.coach_pattern, ad.task_status, ad.metadata
      FROM agent_decisions ad
      LEFT JOIN users u ON ad.coach_id = u.id
      WHERE ad.created_at > NOW() - INTERVAL '${hours} hours'
    `;
    const params = [];
    if (regionId !== null) {
      params.push(regionId);
      query += ` AND u.region_id = $${params.length}`;
    }
    if (coachId) {
      params.push(coachId);
      query += ` AND ad.coach_id = $${params.length}`;
    }
    query += ` ORDER BY ad.created_at DESC LIMIT 100`;

    const result = await db.query(query, params);
    const rows = result.rows;

    const totalDecisions = rows.length;
    const avgConfidence = totalDecisions > 0
      ? (rows.reduce((s, r) => s + parseFloat(r.groq_confidence || 0), 0) / totalDecisions).toFixed(2)
      : '0.00';
    const fallbackCount = rows.filter(r => !r.groq_confidence || parseFloat(r.groq_confidence) === 0).length;

    const overrideReasons = {};
    rows.filter(r => r.override_reason).forEach(r => {
      overrideReasons[r.override_reason] = (overrideReasons[r.override_reason] || 0) + 1;
    });

    res.json({
      summary: {
        total_decisions: totalDecisions,
        by_agent: {
          support_agent: rows.filter(r => r.agent_type === 'support_agent').length,
          coaching_insights: rows.filter(r => r.agent_type === 'coaching_insights').length
        },
        groq_vs_fallback: {
          groq_confidence_avg: avgConfidence,
          fallback_count: fallbackCount
        },
        overrides: {
          total: rows.filter(r => r.overridden).length,
          by_reason: overrideReasons
        }
      },
      decisions: rows
    });
  } catch (err) {
    console.error('[Admin API] decisions error:', err.message);
    res.status(500).json({ error: 'Failed to fetch decisions' });
  }
});

router.get('/coach-patterns', requireAdmin, async (req, res) => {
  try {
    const regionId = regionFilter(req.user);
    const snapshotParams = regionId !== null ? [regionId] : [];
    const snapshotRegionFilter = regionId !== null ? 'AND region_id = $1' : '';
    const effectivenessParams = regionId !== null ? [regionId] : [];
    const effectivenessRegionFilter = regionId !== null ? 'AND u.region_id = $1' : '';
    const [snapshots, effectiveness] = await Promise.all([
      db.query(`
        SELECT coach_id, coach_pattern, COUNT(*) as detections
        FROM monitoring_snapshots
        WHERE created_at > NOW() - INTERVAL '7 days'
          AND coach_pattern IS NOT NULL
          ${snapshotRegionFilter}
        GROUP BY coach_id, coach_pattern
        ORDER BY detections DESC
      `, snapshotParams),
      db.query(`
        SELECT ad.coach_id, ad.final_action,
               COUNT(*) as total,
               SUM(CASE WHEN ad.overridden = false THEN 1 ELSE 0 END) as executed
        FROM agent_decisions ad
        LEFT JOIN users u ON ad.coach_id = u.id
        WHERE ad.created_at > NOW() - INTERVAL '7 days'
          ${effectivenessRegionFilter}
        GROUP BY ad.coach_id, ad.final_action
      `, effectivenessParams)
    ]);

    const byPattern = {};
    snapshots.rows.forEach(row => {
      const pattern = row.coach_pattern;
      if (!byPattern[pattern]) {
        byPattern[pattern] = { coaches: [], detections: 0 };
      }
      if (!byPattern[pattern].coaches.includes(row.coach_id)) {
        byPattern[pattern].coaches.push(row.coach_id);
      }
      byPattern[pattern].detections += parseInt(row.detections);
    });

    res.json({
      patterns: byPattern,
      intervention_effectiveness: effectiveness.rows
    });
  } catch (err) {
    console.error('[Admin API] coach-patterns error:', err.message);
    res.status(500).json({ error: 'Failed to fetch coach patterns' });
  }
});

module.exports = router;
