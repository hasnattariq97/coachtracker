/**
 * @phase 9
 * @status active
 * @owner phase-builder
 * @last_updated 2026-06-09T00:00:00Z
 * @beads ["orchestrator-phase9"]
 */

/**
 * Agent Orchestrator — Phase 9 Multi-Agent Coaching System
 *
 * Coordinates three autonomous agents:
 * 1. Monitoring Agent (every 30 minutes) — detects at-risk tasks
 * 2. Support Agent (every 30 minutes, after Monitoring) — decides interventions
 * 3. Reporting Agent (daily at 9am) — generates coaching digest
 *
 * Integrates with Ruflo AgentDB for shared state and learning.
 */

const MonitoringAgent = require('./monitoring-agent');
const SupportAgent = require('./support-agent');
const ReportingAgent = require('./reporting-agent');
const db = require('../db');

class AgentOrchestrator {
  constructor() {
    this.monitoringAgent = new MonitoringAgent();
    this.supportAgent = new SupportAgent();
    this.reportingAgent = new ReportingAgent();
  }

  /**
   * Run 30-minute cycle: Monitoring Agent → Support Agent
   * Returns: { cycleType, monitoringResult, supportResult }
   */
  async run30MinuteCycle() {
    try {
      console.log('═══════════════════════════════════════');
      console.log('🤖 Phase 9 Agent Cycle: 30-minute');
      console.log('═══════════════════════════════════════');

      const cycleStart = new Date();

      // Step 1: Run Monitoring Agent
      console.log('📍 Step 1: Monitoring Agent');
      const monitoringResult = await this.monitoringAgent.run();
      const monitoringTime = (new Date() - cycleStart) / 1000;
      console.log(`✓ Monitoring: ${monitoringResult.scannedTasks} tasks, ${monitoringTime.toFixed(1)}s`);

      const atRiskCoaches = new Set(
        (monitoringResult?.snapshots || [])
          .filter(s => s.status === 'at_risk' || s.status === 'overdue')
          .map(s => s.coachId)
      ).size;

      await db.query(
        `INSERT INTO agent_runs (agent_type, status, snapshots_created, coaches_at_risk)
         VALUES ('monitoring', 'success', $1, $2)`,
        [monitoringResult?.scannedTasks || 0, atRiskCoaches]
      ).catch(e => console.error('[Orchestrator] Failed to log monitoring run:', e.message));

      // Step 2: Run Support Agent (depends on Monitoring snapshots)
      console.log('📍 Step 2: Support Agent');
      const supportResult = await this.supportAgent.run();
      const supportTime = (new Date() - cycleStart) / 1000;
      console.log(`✓ Support: ${supportResult.actionsDecided} actions, ${supportTime.toFixed(1)}s`);

      await db.query(
        `INSERT INTO agent_runs (agent_type, status, actions_taken, emails_sent, tags_created, escalations)
         VALUES ('support', 'success', $1, $2, $3, $4)`,
        [
          supportResult?.actionsDecided || 0,
          supportResult?.actions?.filter(a => a.action === 'email').length || 0,
          supportResult?.actions?.filter(a => a.action === 'tag').length || 0,
          supportResult?.actions?.filter(a => a.action === 'escalate').length || 0,
        ]
      ).catch(e => console.error('[Orchestrator] Failed to log support run:', e.message));

      // Step 3: Log cycle completion to AgentDB (Ruflo integration)
      await this._logCycleToAgentDB('30-min', {
        monitoringTasks: monitoringResult.scannedTasks,
        supportActions: supportResult.actionsDecided,
        totalTime: supportTime,
      });

      console.log('═══════════════════════════════════════');
      console.log(`✅ 30-minute cycle complete (${supportTime.toFixed(1)}s)`);
      console.log('═══════════════════════════════════════\n');

      return { cycleType: '30-min', monitoringResult, supportResult };
    } catch (err) {
      console.error('❌ 30-minute cycle failed:', err.message);
      await this._logErrorToAgentDB('30-min-cycle', err);
      throw err;
    }
  }

  /**
   * Run daily cycle: Reporting Agent
   * Returns: { cycleType, reportingResult }
   */
  async runDailyCycle() {
    try {
      console.log('═══════════════════════════════════════');
      console.log('🤖 Phase 9 Agent Cycle: Daily (9am)');
      console.log('═══════════════════════════════════════');

      const cycleStart = new Date();

      // Run Reporting Agent
      console.log('📍 Daily Reporting Agent');
      const reportingResult = await this.reportingAgent.run();
      const reportingTime = (new Date() - cycleStart) / 1000;
      console.log(`✓ Reporting: ${reportingResult.recommendations.length} recommendations, ${reportingTime.toFixed(1)}s`);

      await db.query(
        `INSERT INTO agent_runs (agent_type, status, report_generated, insights_count)
         VALUES ('reporting', 'success', $1, $2)`,
        [true, reportingResult?.aiInsights?.key_insights?.length || 0]
      ).catch(e => console.error('[Orchestrator] Failed to log reporting run:', e.message));

      // Log to AgentDB
      await this._logCycleToAgentDB('daily', {
        completionRate: reportingResult.completionRate,
        blockers: reportingResult.blockers.length,
        recommendations: reportingResult.recommendations.length,
        totalTime: reportingTime,
      });

      console.log('═══════════════════════════════════════');
      console.log(`✅ Daily cycle complete (${reportingTime.toFixed(1)}s)`);
      console.log('═══════════════════════════════════════\n');

      return { cycleType: 'daily', reportingResult };
    } catch (err) {
      console.error('❌ Daily cycle failed:', err.message);
      await this._logErrorToAgentDB('daily-cycle', err);
      throw err;
    }
  }

  /**
   * Log cycle execution to AgentDB for Ruflo integration
   * Stores: cycle type, metrics, timestamp
   * TODO: Phase 9b — Integrate with Ruflo AgentDB namespace 'phase-9-cycles'
   */
  async _logCycleToAgentDB(cycleType, metrics) {
    try {
      // Note: AgentDB integration is deferred to Phase 9b
      // For now, log to console for visibility
      console.log(`[AgentDB] Logged ${cycleType} cycle:`, JSON.stringify(metrics));

      // TODO: Phase 9b — Integrate with Ruflo AgentDB
      // namespace = 'phase-9-cycles'
      // await agentdb.save({
      //   namespace: 'phase-9-cycles',
      //   key: `${cycleType}-${new Date().toISOString()}`,
      //   value: { cycleType, metrics, timestamp: new Date() }
      // });
    } catch (err) {
      console.error('Failed to log cycle to AgentDB:', err.message);
    }
  }

  /**
   * Log errors for Ruflo visibility
   * TODO: Phase 9b — Integrate with Ruflo AgentDB namespace 'phase-9-errors'
   */
  async _logErrorToAgentDB(cycleType, error) {
    try {
      console.log(`[AgentDB] Logged error for ${cycleType}:`, error.message);

      // TODO: Phase 9b — Integrate with Ruflo AgentDB
      // await agentdb.save({
      //   namespace: 'phase-9-errors',
      //   key: `${cycleType}-${new Date().toISOString()}`,
      //   value: { error: error.message, cycleType, timestamp: new Date() }
      // });
    } catch (err) {
      console.error('Failed to log error to AgentDB:', err.message);
    }
  }
}

module.exports = AgentOrchestrator;
