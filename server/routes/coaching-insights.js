const db = require('../db');
let client = null;

// Only initialize Groq client in production or when explicitly testing
if (process.env.NODE_ENV !== 'test' && process.env.GROQ_API_KEY) {
  const Groq = require('groq-sdk');
  client = new Groq({
    apiKey: process.env.GROQ_API_KEY,
  });
}

// Configuration
const AGENT_TIMEOUT_MS = 10000;  // 10s per agent
const SWARM_TIMEOUT_MS = 30000;  // 30s total
const GROQ_MODEL = 'llama-3.3-70b-versatile';

/**
 * Main entry point: queue coaching insights analysis
 * Called asynchronously from task completion/delay-reason handlers
 */
async function queueCoachingInsights(coachId, taskId, eventType) {
  if (process.env.COACHING_INSIGHTS_ENABLED !== 'true' || process.env.NODE_ENV === 'test') {
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
  if (process.env.NODE_ENV === 'test' || !client) {
    return;
  }

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
 * Call 3 agents in parallel via Groq API
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
 * Pattern Analysis Agent: Identify completion patterns
 */
async function callPatternAgent(context) {
  try {
    const systemPrompt = `You are a Pattern Analysis Agent. Analyze a coach's task completion history and current event to identify patterns.
Focus on: on-time completion rate, delays, consistency, patterns by task type or deadline.
Respond with 2-3 specific observations about this coach's patterns. Be concise and actionable.`;

    const message = await client.chat.completions.create({
      model: GROQ_MODEL,
      max_tokens: 500,
      messages: [
        {
          role: 'user',
          content: `${systemPrompt}\n\nAnalyze this coach's patterns:\n${context}`,
        },
      ],
    });

    return message.choices[0]?.message?.content || null;
  } catch (error) {
    console.error('[Pattern Agent] Error:', error.message);
    return null;
  }
}

/**
 * Growth Coach Agent: Identify learning opportunities
 */
async function callGrowthAgent(context) {
  try {
    const systemPrompt = `You are a Growth Coach Agent. Identify learning opportunities and professional growth from a coach's task performance.
Focus on: strengths to leverage, skills to develop, positive momentum.
Respond with 1-2 encouraging observations and a concrete growth opportunity. Use coaching tone (supportive, growth-focused).`;

    const message = await client.chat.completions.create({
      model: GROQ_MODEL,
      max_tokens: 500,
      messages: [
        {
          role: 'user',
          content: `${systemPrompt}\n\nIdentify growth opportunities for this coach:\n${context}`,
        },
      ],
    });

    return message.choices[0]?.message?.content || null;
  } catch (error) {
    console.error('[Growth Agent] Error:', error.message);
    return null;
  }
}

/**
 * Risk Analysis Agent: Identify blockers and risk factors
 */
async function callRiskAgent(context) {
  try {
    const systemPrompt = `You are a Risk Analysis Agent. Identify risk factors and recurring blockers in a coach's task completion.
Focus on: recurring delay patterns, high-risk task types, external blockers, workload concerns.
Respond with observations about risks (if any) and preventive recommendations. If no risks, say so clearly.`;

    const message = await client.chat.completions.create({
      model: GROQ_MODEL,
      max_tokens: 500,
      messages: [
        {
          role: 'user',
          content: `${systemPrompt}\n\nAnalyze risks and blockers for this coach:\n${context}`,
        },
      ],
    });

    return message.choices[0]?.message?.content || null;
  } catch (error) {
    console.error('[Risk Agent] Error:', error.message);
    return null;
  }
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
  if (!patternResponse || !growthResponse || !riskResponse) {
    return 'Insights partial. Continue strong work!';
  }

  // Extract key phrases for consensus
  const patterns = patternResponse.split('.')[0]; // First sentence
  const growth = growthResponse.split('.')[0];
  const risks = riskResponse.includes('no risks') ? null : riskResponse.split('.')[0];

  let consensus = `${growth} ${patterns}`;
  if (risks) {
    consensus += ` Note: ${risks}`;
  }

  return consensus.slice(0, 200); // Truncate to 200 chars for notification message
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
