const Anthropic = require('@anthropic-ai/sdk');
const db = require('../db');

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Configuration
const AGENT_TIMEOUT_MS = 10000;  // 10s per agent
const SWARM_TIMEOUT_MS = 30000;  // 30s total
const ANTHROPIC_MODEL = 'claude-opus-4-8';

/**
 * Main entry point: queue coaching insights analysis
 * Called asynchronously from task completion/delay-reason handlers
 */
async function queueCoachingInsights(coachId, taskId, eventType) {
  if (process.env.COACHING_INSIGHTS_ENABLED !== 'true') {
    console.log('[Coaching Insights] Feature disabled, skipping analysis');
    return;
  }

  try {
    // Fetch coach history and task context
    const coachHistory = fetchCoachHistory(coachId, 10);
    const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId);

    if (!task) {
      console.error(`[Coaching Insights] Task ${taskId} not found`);
      return;
    }

    // Call agent swarm in background (don't await)
    setImmediate(() => analyzeCoachBehavior(coachId, taskId, eventType, coachHistory, task));
  } catch (error) {
    console.error(`[Coaching Insights] Error queueing analysis:`, error);
  }
}

/**
 * Analyze coach behavior via 3-agent consensus swarm
 * Runs asynchronously, creates notification on completion
 */
async function analyzeCoachBehavior(coachId, taskId, eventType, coachHistory, task) {
  const startTime = Date.now();

  try {
    // Call 3 agents in parallel with timeout
    const results = await Promise.race([
      callAgentSwarm(coachHistory, task, eventType),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Agent swarm timeout after 30s')), SWARM_TIMEOUT_MS)
      ),
    ]);

    // Create notification with results
    createCoachingInsightNotification(coachId, taskId, results, 'success');
    console.log(`[Coaching Insights] Analysis complete for coach ${coachId}, task ${taskId} (${Date.now() - startTime}ms)`);
  } catch (error) {
    console.error(`[Coaching Insights] Analysis failed:`, error.message);
    createCoachingInsightNotification(coachId, taskId, null, 'timeout');
  }
}

/**
 * Fetch coach's recent task history for context
 */
function fetchCoachHistory(coachId, limit = 10) {
  const rows = db.prepare(`
    SELECT id, title, status, completed_at, delay_reason, due_date, assigned_at
    FROM tasks
    WHERE coach_id = ?
    ORDER BY assigned_at DESC
    LIMIT ?
  `).all(coachId, limit);

  return rows.map(row => ({
    id: row.id,
    title: row.title,
    status: row.status,
    onTime: row.status === 'completed' && new Date(row.completed_at) <= new Date(row.due_date),
    delayReason: row.delay_reason,
    daysToDeadline: Math.ceil((new Date(row.due_date) - new Date()) / (1000 * 60 * 60 * 24)),
  }));
}

/**
 * Call 3 agents in parallel via Claude API
 * Returns: { pattern_agent, growth_agent, risk_agent, consensus }
 */
async function callAgentSwarm(coachHistory, task, eventType) {
  const context = buildContext(coachHistory, task, eventType);

  const [patternResult, growthResult, riskResult] = await Promise.all([
    callPatternAgent(context),
    callGrowthAgent(context),
    callRiskAgent(context),
  ]);

  return {
    pattern_agent: parseAgentResponse(patternResult),
    growth_agent: parseAgentResponse(growthResult),
    risk_agent: parseAgentResponse(riskResult),
    consensus: buildConsensus(patternResult, growthResult, riskResult),
    generated_at: new Date().toISOString(),
  };
}

/**
 * Build context string for all agents
 */
function buildContext(coachHistory, task, eventType) {
  const eventLabel = eventType === 'completion' ? 'just completed' : 'submitted a delay reason for';
  const historyStr = coachHistory
    .slice(0, 5)
    .map(t => `- "${t.title}" (${t.status}, on-time: ${t.onTime ? 'yes' : 'no'})`)
    .join('\n');

  return `
Coach just ${eventLabel} a task.

Current task:
- Title: "${task.title}"
- Description: "${task.description}"
- Priority: ${task.priority}
- Assigned: ${task.assigned_at}
- Due: ${task.due_date}
- Status: ${task.status}

Coach's recent history (last 5 tasks):
${historyStr}

Event type: ${eventType}
`;
}

/**
 * Placeholder agents — will implement in next tasks
 */
async function callPatternAgent(context) {
  // Implemented in Task 4
  return null;
}

async function callGrowthAgent(context) {
  // Implemented in Task 4
  return null;
}

async function callRiskAgent(context) {
  // Implemented in Task 4
  return null;
}

/**
 * Parse agent response and extract structured data
 */
function parseAgentResponse(response) {
  if (!response) return null;

  return {
    summary: extractSummary(response),
    confidence: extractConfidence(response),
    raw: response,
  };
}

function extractSummary(response) {
  // Extract first sentence or key insight
  const match = response.match(/^[^.!?]*[.!?]/);
  return match ? match[0] : response.slice(0, 100);
}

function extractConfidence(response) {
  // Simple heuristic: confident language patterns
  const patterns = [
    { pattern: /definitely|clearly|obviously/i, score: 0.95 },
    { pattern: /likely|probably|appears/i, score: 0.75 },
    { pattern: /possibly|maybe|could/i, score: 0.5 },
  ];

  for (const { pattern, score } of patterns) {
    if (pattern.test(response)) return score;
  }
  return 0.7; // default
}

/**
 * Build consensus statement from all 3 agents
 */
function buildConsensus(patternResponse, growthResponse, riskResponse) {
  // Implemented in Task 4
  return 'Analysis complete. Continue growing!';
}

/**
 * Create notification with coaching insights results
 */
function createCoachingInsightNotification(coachId, taskId, results, status) {
  const task = db.prepare('SELECT title FROM tasks WHERE id = ?').get(taskId);
  if (!task) return;

  const message =
    status === 'success' && results
      ? results.consensus || 'Great work! Keep this momentum going.'
      : 'Insights pending. Check back soon!';

  const metadata = results ? JSON.stringify(results) : null;

  db.prepare(`
    INSERT INTO notifications
    (user_id, task_id, task_title, type, message, metadata, insights_status, read, created_at)
    VALUES (?, ?, ?, 'coaching_insights', ?, ?, ?, 0, ?)
  `).run(
    coachId,
    taskId,
    task.title,
    message,
    metadata,
    status,
    new Date().toISOString()
  );
}

module.exports = {
  queueCoachingInsights,
  fetchCoachHistory,
  callAgentSwarm,
  analyzeCoachBehavior,
  createCoachingInsightNotification,
};
