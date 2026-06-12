/**
 * GroqService - Central Groq API wrapper with queue management
 *
 * Provides:
 * 1. queueRequest - Queue rate-limited Groq requests
 * 2. analyzeCoachForIntervention - Decide intervention strategy using Groq + fallback
 * 3. enhanceCoachingInsight - Generate personalized coaching messages
 * 4. processQueue - Dequeue and process pending requests (~5 per run, respects 30 RPM)
 *
 * @phase 9b
 * @status active
 * @last_updated 2026-06-09T00:00:00Z
 */

const db = require('../db');
let client = null;

// Initialize Groq client only if API key is set (production/Railway)
if (process.env.NODE_ENV !== 'test' && process.env.GROQ_API_KEY) {
  try {
    const Groq = require('groq-sdk');
    client = new Groq({
      apiKey: process.env.GROQ_API_KEY,
    });
  } catch (err) {
    console.error('[GroqService] Failed to initialize Groq client:', err.message);
    client = null;
  }
}

// Configuration
const AGENT_TIMEOUT_MS = 10000; // 10s per agent call
const GROQ_MODEL = 'llama-3.3-70b-versatile';
const QUEUE_BATCH_SIZE = 5; // Process 5 per cycle (~25 req/min safely under 30 RPM)

class GroqService {
  constructor() {
    this.client = client;
  }

  /**
   * Queue a Groq request for rate-limited processing
   * Stores in groq_queue table, returns immediately with request ID
   */
  async queueRequest(requestType, payload) {
    try {
      if (!requestType || !payload) {
        console.warn('[GroqService] Invalid queueRequest arguments');
        return undefined;
      }

      const result = await db.query(
        `INSERT INTO groq_queue (request_type, payload, status)
         VALUES ($1, $2, 'pending')
         RETURNING id`,
        [requestType, JSON.stringify(payload)]
      );

      const requestId = result.rows[0]?.id;
      return requestId;
    } catch (error) {
      console.error('[GroqService] Error queueing request:', error.message);
      return undefined;
    }
  }

  /**
   * Analyze coach behavior and recommend intervention strategy
   * Uses Groq with fallback to Phase 9 rules if unavailable
   *
   * Returns:
   * {
   *   recommendation: 'email' | 'tag' | 'escalate' | null,
   *   confidence: 0.0-1.0,
   *   reasoning: string
   * }
   *
   * On Groq failure: returns fallback recommendation internally (confidence: 0)
   */
  async analyzeCoachForIntervention(snapshot, coachHistory) {
    // Validate input
    if (!snapshot || !coachHistory) {
      return {
        recommendation: null,
        confidence: 0,
        reasoning: 'Invalid input provided',
      };
    }

    // If Groq unavailable, use Phase 9 fallback rules immediately
    if (!this.client) {
      return {
        recommendation: this._applyPhase9FallbackRule(snapshot),
        confidence: 0,
        reasoning: 'Groq unavailable, using Phase 9 rules',
      };
    }

    try {
      // Build context for Groq
      const recentDelays = coachHistory.filter(t => t.delay_reason).length;
      const completionRate = coachHistory.length > 0
        ? (coachHistory.filter(t => t.status === 'completed').length / coachHistory.length * 100).toFixed(0)
        : 0;

      const prompt = `You are analyzing a coach's behavior to recommend an intervention strategy.

Coach Pattern: ${snapshot.coach_pattern || 'unknown'}
Task Status: ${snapshot.status}
Days Remaining: ${snapshot.days_remaining}
Recent Delays: ${recentDelays} out of ${coachHistory.length} tasks
Completion Rate: ${completionRate}%

Based on this data, recommend ONE intervention:
1. "email" - Send a supportive reminder email
2. "tag" - Tag in shared system (non-intrusive)
3. "escalate" - Direct escalation to manager
4. null - No intervention needed

Respond with ONLY valid JSON:
{
  "recommendation": "email" | "tag" | "escalate" | null,
  "confidence": 0.0-1.0,
  "reasoning": "brief explanation"
}`;

      const response = await Promise.race([
        this.client.chat.completions.create({
          model: GROQ_MODEL,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.5,
          max_tokens: 256,
        }),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Groq timeout')), AGENT_TIMEOUT_MS)
        ),
      ]);

      // Parse Groq response
      const content = response.choices[0]?.message?.content;
      if (!content) {
        return {
          recommendation: this._applyPhase9FallbackRule(snapshot),
          confidence: 0,
          reasoning: 'Groq returned empty response, using Phase 9 rules',
        };
      }

      const parsed = JSON.parse(content);
      return {
        recommendation: parsed.recommendation,
        confidence: parsed.confidence || 0.5,
        reasoning: parsed.reasoning || 'No reasoning provided',
      };
    } catch (error) {
      console.error('[GroqService] analyzeCoachForIntervention error:', error.message);

      // Fall back to Phase 9 rules on any error
      return {
        recommendation: this._applyPhase9FallbackRule(snapshot),
        confidence: 0,
        reasoning: `Groq error: ${error.message}, using Phase 9 rules`,
      };
    }
  }

  /**
   * Generate enhanced coaching message personalized to coach history
   * Uses Groq with fallback to generic message if unavailable
   *
   * Returns:
   * {
   *   message: string,
   *   tone: string,
   *   metrics: array,
   *   prediction: string,
   *   confidence: 0.0-1.0
   * }
   *
   * On Groq failure: returns generic message with confidence: 0
   */
  async enhanceCoachingInsight(coachHistory, task, eventType) {
    // Default fallback message
    const fallback = {
      message: 'Good work. Keep going.',
      tone: 'neutral',
      metrics: [],
      prediction: '',
      confidence: 0,
    };

    // If Groq unavailable, return fallback
    if (!this.client) {
      return fallback;
    }

    try {
      if (!coachHistory || coachHistory.length === 0) {
        return fallback;
      }

      const onTimeCount = coachHistory.filter(t => !t.completed_late).length;
      const onTimeRate = (onTimeCount / coachHistory.length * 100).toFixed(0);

      const eventDesc = eventType === 'completion'
        ? `Coach just completed task: "${task.title}"`
        : `Coach submitted delay reason for: "${task.title}"`;

      const prompt = `You are a coaching AI providing personalized feedback to help a coach improve.

Recent Performance:
- ${coachHistory.length} recent tasks
- ${onTimeRate}% completed on time
- Task: "${task.title}" (${task.priority} priority)
- Event: ${eventDesc}

Generate ONE personalized coaching message (2-3 sentences, specific not generic).
Include: observation + encouragement/insight.

Respond with ONLY valid JSON:
{
  "message": "personalized coaching message",
  "tone": "encouraging|neutral|supportive",
  "metrics": ["metric1", "metric2"],
  "prediction": "likely outcome",
  "confidence": 0.0-1.0
}`;

      const response = await Promise.race([
        this.client.chat.completions.create({
          model: GROQ_MODEL,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.7,
          max_tokens: 300,
        }),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Groq timeout')), AGENT_TIMEOUT_MS)
        ),
      ]);

      const content = response.choices[0]?.message?.content;
      if (!content) {
        return fallback;
      }

      const parsed = JSON.parse(content);
      return {
        message: parsed.message || fallback.message,
        tone: parsed.tone || 'neutral',
        metrics: parsed.metrics || [],
        prediction: parsed.prediction || '',
        confidence: parsed.confidence || 0.5,
      };
    } catch (error) {
      console.error('[GroqService] enhanceCoachingInsight error:', error.message);
      return fallback;
    }
  }

  /**
   * Generate insights for the daily reporting digest
   * Uses Groq with fallback to summary stats if unavailable
   *
   * Input context: { actions_24h, emails_sent, tags_created, escalations,
   *                  coaches_affected, on_time_rate, coach_patterns }
   * Returns: { key_insights, recommendations, coach_analysis, team_insights, confidence }
   */
  async generateReportingInsights(context) {
    if (!this.client) {
      return this._getFallbackReportingInsights(context);
    }

    try {
      const response = await Promise.race([
        this.client.chat.completions.create({
          model: GROQ_MODEL,
          messages: [
            {
              role: 'system',
              content: 'You are a coaching analytics expert. Analyze 24-hour coaching data and generate actionable insights for the admin team. Return ONLY valid JSON with: key_insights (array of 3-5 strings max 100 chars each), recommendations (array of 3-5 strings), coach_analysis (array of objects with coach_id, name, pattern, recent_performance, suggested_approach), team_insights (object with on_time_trend, most_effective_intervention, emerging_patterns), confidence (0.0-1.0)',
            },
            { role: 'user', content: JSON.stringify(context) },
          ],
          max_tokens: 800,
        }),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Groq timeout')), AGENT_TIMEOUT_MS)
        ),
      ]);

      const content = response.choices[0]?.message?.content;
      if (!content) {
        return this._getFallbackReportingInsights(context);
      }
      const parsed = JSON.parse(content);
      return parsed;
    } catch (err) {
      console.error('[GroqService] generateReportingInsights error:', err.message);
      return this._getFallbackReportingInsights(context);
    }
  }

  /**
   * Fallback reporting insights when Groq is unavailable
   */
  _getFallbackReportingInsights(context) {
    return {
      key_insights: [
        `Processed ${context.actions_24h} coaching actions in 24h`,
        `On-time completion rate: ${Math.min(100, Math.round((context.on_time_rate || 0) * 100))}%`,
        `${context.coaches_affected} coaches supported with ${context.emails_sent} emails, ${context.tags_created} tags, ${context.escalations} escalations`,
      ],
      recommendations: [
        'Continue monitoring at-risk coaches daily',
        'Review intervention effectiveness by coach pattern',
        'Consider pattern-specific strategies for next week',
      ],
      coach_analysis: (context.coach_patterns || []).slice(0, 3).map(p => ({
        pattern: p,
        suggested_approach: p === 'procrastinator' ? 'Escalation' : 'Email support',
      })),
      team_insights: {
        on_time_trend: 'Stable',
        most_effective_intervention: 'Escalation for procrastinators',
        emerging_patterns: 'Monitored',
      },
      confidence: 0.5,
    };
  }

  /**
   * Process queue: dequeue up to QUEUE_BATCH_SIZE pending requests
   * Called by cron every 2 minutes
   *
   * Returns: { processed: count, pending: count }
   */
  async processQueue() {
    try {
      // Get pending requests (limit to batch size)
      const pending = await db.query(
        `SELECT id, request_type, payload FROM groq_queue
         WHERE status = 'pending'
         ORDER BY created_at ASC
         LIMIT $1`,
        [QUEUE_BATCH_SIZE]
      );

      let processed = 0;

      for (const request of pending.rows) {
        try {
          // Mark as started
          await db.query(
            `UPDATE groq_queue SET status = 'started', started_at = CURRENT_TIMESTAMP
             WHERE id = $1`,
            [request.id]
          );

          // Process based on request type
          let response = null;
          let payload;
          try {
            payload = JSON.parse(request.payload);
          } catch (parseErr) {
            throw new Error(`Malformed queue payload (id=${request.id}): ${parseErr.message}`);
          }

          if (request.request_type === 'intervention_analysis') {
            response = await this.analyzeCoachForIntervention(
              payload.snapshot,
              payload.coachHistory
            );
          } else if (request.request_type === 'coaching_insight') {
            response = await this.enhanceCoachingInsight(
              payload.coachHistory,
              payload.task,
              payload.eventType
            );
          } else if (request.request_type === 'reporting_insights') {
            response = await this.generateReportingInsights(payload.context);
          }

          // Mark as completed
          await db.query(
            `UPDATE groq_queue SET status = 'completed', response = $1, completed_at = CURRENT_TIMESTAMP
             WHERE id = $2`,
            [JSON.stringify(response), request.id]
          );

          processed++;
        } catch (error) {
          // Mark as failed with error message
          await db.query(
            `UPDATE groq_queue SET status = 'failed', error_message = $1
             WHERE id = $2`,
            [error.message, request.id]
          );

          console.error(`[GroqService] Failed to process request ${request.id}:`, error.message);
        }
      }

      // Count remaining pending
      const pendingCount = await db.query(
        `SELECT COUNT(*) as count FROM groq_queue WHERE status = 'pending'`
      );

      return {
        processed,
        pending: pendingCount.rows[0]?.count || 0,
      };
    } catch (error) {
      console.error('[GroqService] processQueue error:', error.message);
      return {
        processed: 0,
        pending: -1, // Indicate error
      };
    }
  }

  /**
   * Apply Phase 9 fallback rules when Groq is unavailable
   * Rules based on task status and coach pattern
   */
  _applyPhase9FallbackRule(snapshot) {
    if (!snapshot) return null;

    const { status, coach_pattern, days_remaining } = snapshot;

    // Rule 1: Overdue + procrastinator = escalate
    if (status === 'overdue' && coach_pattern === 'procrastinator') {
      return 'escalate';
    }

    // Rule 2: Overdue (any pattern) = email
    if (status === 'overdue') {
      return 'email';
    }

    // Rule 3: At risk with 0-1 days remaining = tag
    if (status === 'at_risk' && days_remaining && days_remaining < 1) {
      return 'tag';
    }

    // Rule 4: No intervention needed
    return null;
  }
}

module.exports = GroqService;
