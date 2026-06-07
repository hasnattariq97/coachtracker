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
    const coachHistory = await fetchCoachHistory(coachId, 10);
    const task = await db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId);

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
async function fetchCoachHistory(coachId, limit = 10) {
  const rows = await db.prepare(`
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
    const systemPrompt = `You are a direct coach giving performance feedback. Use the SBI model (Situation-Behavior-Impact).
Your job: Point out WHAT the coach is doing well or struggling with, based on actual completion patterns.

RULES:
1. Speak DIRECTLY to the coach (use "You", "Your") - NOT "the coach's"
2. Never say "I've noticed" or "Based on analysis" - just state facts
3. Be SPECIFIC with metrics and patterns (e.g., "You hit 4 of 5 deadlines" not "completion rate trending")
4. Include the IMPACT - WHY it matters (e.g., "That reliability builds team trust")
5. Keep it conversational and direct, like talking to a person

EXAMPLES OF GOOD FEEDBACK:
- "You've hit your last 4 deadlines on time. That consistency builds trust with your team."
- "You tend to slip on high-priority tasks (missed 2 of 3). What's making those harder?"
- "Your on-time rate jumped from 60% to 80% last month. What changed? Do more of that."

EXAMPLE OF BAD FEEDBACK (avoid):
- "I've noticed patterns in the coach's completion history..."
- "Based on the data, here are observations..."
- These sound like AI narrating analysis, not coaching.`;

    const message = await client.chat.completions.create({
      model: GROQ_MODEL,
      max_tokens: 300,
      messages: [
        {
          role: 'user',
          content: `${systemPrompt}\n\nGive pattern feedback to this coach:\n${context}`,
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
    const systemPrompt = `You are a direct coach highlighting strengths and growth opportunities. Your tone is supportive but direct.

Your job: Tell the coach ONE specific thing they're doing well, and ONE actionable growth challenge.

RULES:
1. Speak DIRECTLY to the coach (use "You", "Your")
2. Never analyze or narrate—just give clear, direct feedback
3. Be SPECIFIC about the strength: "You excel at tight deadlines" not "demonstrated strength"
4. Suggest a CONCRETE next step: "Apply that discipline to planning phases" not generic "keep improving"
5. Be motivational but honest—acknowledge real progress or real gaps
6. NO generic praise ("Great job!", "Excellent!", "Amazing work!")

EXAMPLES OF GOOD FEEDBACK:
- "You crushed your last 3 deadlines. Now challenge yourself: can you maintain that pace on complex projects?"
- "You recovered from last month's delays—clearly you know how to execute. What was different? Replicate that."
- "You're strong on execution. Your opportunity: bring that same discipline to the planning phase."
- "You hit your deadlines. Next level: help other coaches develop this skill."

EXAMPLE OF BAD FEEDBACK (avoid):
- "You've demonstrated strength in meeting deadlines" (too vague, not direct)
- "Based on the coach's performance, here's feedback..." (analytical, not coaching)`;

    const message = await client.chat.completions.create({
      model: GROQ_MODEL,
      max_tokens: 250,
      messages: [
        {
          role: 'user',
          content: `${systemPrompt}\n\nGive growth feedback to this coach:\n${context}`,
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
    const systemPrompt = `You are a direct coach flagging potential issues or patterns that might slow the coach down.

Your job: Identify ONE specific risk or blocker pattern, if it exists. If no risks, say so clearly.

RULES:
1. Speak DIRECTLY to the coach (use "You", "Your")
2. Be SPECIFIC about the risk: Name the pattern, the impact, and what to do about it
3. Make it ACTIONABLE: If you see a risk, suggest what they could do differently
4. Only flag REAL patterns, not speculative ones
5. If execution is strong, say so—don't invent risks
6. No vague language—be concrete

EXAMPLES OF GOOD FEEDBACK:
- "You've delayed 2 of 3 high-priority tasks. That's a pattern. What's blocking you on those? Let's surface it early next time."
- "Your tasks with external dependencies slip 50% of the time. Next time, flag dependencies upfront so we can unblock you."
- "You have 4 tasks due the same week—that's risky. Prioritize ruthlessly or escalate early."
- "No patterns detected. Your execution is solid—keep this up."

EXAMPLE OF BAD FEEDBACK (avoid):
- "Tasks with external dependencies may indicate potential issues..." (vague, analytical)
- "Based on analysis, here are risk observations..." (sounds like AI narrating)`;

    const message = await client.chat.completions.create({
      model: GROQ_MODEL,
      max_tokens: 250,
      messages: [
        {
          role: 'user',
          content: `${systemPrompt}\n\nFlag risks for this coach:\n${context}`,
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
 * Build SHORT, PUNCHY, VARIED coaching message
 * Max 1-2 sentences. Completely different messages each time.
 */
function buildConsensus(patternResponse, growthResponse, riskResponse) {
  if (!patternResponse || !growthResponse || !riskResponse) {
    return 'Good work!';
  }

  const isOnTime = !patternResponse.toLowerCase().includes('delay') &&
                   !patternResponse.toLowerCase().includes('slip') &&
                   !patternResponse.toLowerCase().includes('missed');
  const hasRisk = !riskResponse.toLowerCase().includes('no');

  // Multiple DIFFERENT templates (not variations of same template)
  const onTimeMessages = [
    'You crushed this deadline. That execution matters.',
    'On time again. You\'ve got the discipline down.',
    'Another on-time delivery. Keep this momentum.',
    'You hit this one. Your reliability is building trust.',
    'Right on schedule. This is how you build a reputation.',
    'You delivered when promised. That\'s professional.',
    'Nailed the deadline. Do this 10 more times.',
    'On time. You know what this means? You can trust yourself.',
  ];

  const lateMessages = [
    'This one slipped. What got in the way?',
    'You missed this deadline. Let\'s figure out why together.',
    'This took longer. No judgment—what happened?',
    'Deadline passed. Let\'s talk about it.',
  ];

  const patternDelayMessages = [
    'You\'ve missed 2 of 3 high-priority tasks. Pattern alert. What\'s the real blocker?',
    'Recurring delays. This isn\'t random. What\'s slowing you down?',
    'You\'re slipping on deadline pressure. Let\'s address the root cause.',
  ];

  let message;

  if (isOnTime) {
    // Pick random on-time message
    message = onTimeMessages[Math.floor(Math.random() * onTimeMessages.length)];
  } else if (hasRisk && riskResponse.toLowerCase().includes('pattern')) {
    // Recurring delay pattern
    message = patternDelayMessages[Math.floor(Math.random() * patternDelayMessages.length)];
  } else {
    // Single late
    message = lateMessages[Math.floor(Math.random() * lateMessages.length)];
  }

  return message;
}

/**
 * Create notification with coaching insights results
 */
async function createCoachingInsightNotification(coachId, taskId, results, status) {
  const task = await db.prepare('SELECT title FROM tasks WHERE id = ?').get(taskId);
  if (!task) return;

  let message;
  if (status === 'success' && results) {
    // Just the consensus message, clean and simple
    message = results.consensus || 'Good work!';
  } else {
    message = 'Insights pending. Check back soon!';
  }

  const metadata = results ? JSON.stringify(results) : null;

  try {
    await db.prepare(`
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
  } catch (err) {
    console.error('[createCoachingInsightNotification] Error:', err.message);
  }
}

module.exports = {
  queueCoachingInsights,
  fetchCoachHistory,
  callAgentSwarm,
  analyzeCoachBehavior,
  createCoachingInsightNotification,
};
