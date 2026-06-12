const db = require('../db');

const GROQ_MODEL = 'llama-3.3-70b-versatile';
const GROQ_TIMEOUT_MS = 20000;

const CRITICAL_FILES = ['auth.js', 'db.js', 'cron.js', 'index.js'];
const SECURITY_KEYWORDS = ['security', 'password', 'login', 'encrypt', 'token', 'api key', 'credential', 'auth'];

let groqClient = null;
if (process.env.NODE_ENV !== 'test' && process.env.GROQ_API_KEY) {
  try {
    const Groq = require('groq-sdk');
    groqClient = new Groq({ apiKey: process.env.GROQ_API_KEY });
  } catch (err) {
    console.error('[Planning Agent] Failed to init Groq client:', err.message);
  }
}

async function callGroq(prompt) {
  if (!groqClient) throw new Error('Groq client unavailable');

  const response = await Promise.race([
    groqClient.chat.completions.create({
      model: GROQ_MODEL,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens: 1000,
    }),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Groq timeout')), GROQ_TIMEOUT_MS)
    ),
  ]);

  return response.choices[0].message.content;
}

async function runPlanningAgent() {
  try {
    // Find diagnosed feedback without an implementation plan
    const rowResult = await db.query(`
      SELECT f.id, f.title, f.description, f.priority,
             d.root_cause, d.affected_files, d.severity
      FROM feedback_reports f
      JOIN diagnoses d ON f.id = d.feedback_id
      LEFT JOIN implementation_plans p ON f.id = p.feedback_id
      WHERE f.status = 'diagnosing' AND p.id IS NULL
      ORDER BY f.created_at ASC
      LIMIT 1
    `);

    const row = rowResult.rows[0];
    if (!row) {
      return { skipped: true, reason: 'No diagnosed feedback to plan' };
    }

    console.log(`[Planning Agent] Planning fix for: "${row.title}"`);

    const affectedFiles = Array.isArray(row.affected_files) ? row.affected_files : [];

    // Escalation checks
    const escalateReasons = [];

    if (affectedFiles.some(f => CRITICAL_FILES.some(cf => f.includes(cf)))) {
      escalateReasons.push('Touches critical infrastructure files (auth, db, cron)');
    }
    if (affectedFiles.length > 5) {
      escalateReasons.push(`Too many files affected (${affectedFiles.length} > 5)`);
    }
    const descLower = (row.description || '').toLowerCase();
    if (SECURITY_KEYWORDS.some(kw => descLower.includes(kw))) {
      escalateReasons.push('Security-related issue detected');
    }

    if (escalateReasons.length > 0) {
      const escalationReason = escalateReasons.join('; ');
      await db.query(
        `UPDATE diagnoses SET escalation_reason = $1 WHERE feedback_id = $2`,
        [escalationReason, row.id]
      );
      await db.query(
        `UPDATE feedback_reports SET status = 'escalated', updated_at = NOW() WHERE id = $1`,
        [row.id]
      );
      console.log(`[Planning Agent] ⚠️ Escalated: ${escalateReasons[0]}`);

      try {
        const { sendApprovalEmail } = require('../services/email');
        const diagResult = await db.query(
          'SELECT root_cause, affected_files FROM diagnoses WHERE feedback_id = $1',
          [row.id]
        );
        const diag = diagResult.rows[0];
        await sendApprovalEmail(
          process.env.ADMIN_EMAIL || 'hasnat@niete.edu.pk',
          row.title,
          'escalated',
          {
            reason: escalationReason,
            rootCause: diag?.root_cause,
            affectedFiles: diag?.affected_files,
          }
        );
        console.log('[Planning Agent] ✉️ Escalation email sent to admin');
      } catch (emailErr) {
        console.error('[Planning Agent] Email failed (non-fatal):', emailErr.message);
      }

      return { escalated: true, reason: escalateReasons[0], feedbackId: row.id };
    }

    const planText = await callGroq(`You are a senior software engineer. Create a concise implementation plan.

Bug: ${row.title}
Root Cause: ${row.root_cause}
Affected Files: ${affectedFiles.join(', ') || 'unknown'}
Priority: ${row.priority}

Respond with a numbered implementation plan. At the end include:
Estimated hours: X.X
Complexity: simple|moderate|complex`);

    const effortMatch = planText.match(/Estimated hours?:\s*([\d.]+)/i);
    const estimatedEffort = effortMatch ? parseFloat(effortMatch[1]) : 1.5;

    if (estimatedEffort > 4) {
      await db.query(
        `UPDATE diagnoses SET escalation_reason = $1 WHERE feedback_id = $2`,
        [`Estimated effort too high (${estimatedEffort}h > 4h)`, row.id]
      );
      await db.query(
        `UPDATE feedback_reports SET status = 'escalated', updated_at = NOW() WHERE id = $1`,
        [row.id]
      );
      console.log(`[Planning Agent] ⚠️ Escalated: effort ${estimatedEffort}h`);
      return { escalated: true, reason: 'Effort too high', feedbackId: row.id };
    }

    const complexityMatch = planText.match(/Complexity:\s*(simple|moderate|complex)/i);
    const complexity = complexityMatch ? complexityMatch[1].toLowerCase() : 'moderate';

    await db.query(
      `INSERT INTO implementation_plans (feedback_id, plan, estimated_effort_hours, complexity)
       VALUES ($1, $2, $3, $4)`,
      [row.id, planText, estimatedEffort, complexity]
    );

    await db.query(
      `UPDATE feedback_reports SET status = 'planned', updated_at = NOW() WHERE id = $1`,
      [row.id]
    );

    console.log(`[Planning Agent] ✅ Plan created (${estimatedEffort}h, ${complexity})`);
    return { success: true, feedbackId: row.id, effort: estimatedEffort, complexity };
  } catch (err) {
    console.error('[Planning Agent] Error:', err.message);
    return { error: err.message };
  }
}

module.exports = { runPlanningAgent };
