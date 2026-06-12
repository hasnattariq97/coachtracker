const db = require('../db');

const GROQ_MODEL = 'llama-3.3-70b-versatile';
const GROQ_TIMEOUT_MS = 15000;

let groqClient = null;
if (process.env.NODE_ENV !== 'test' && process.env.GROQ_API_KEY) {
  try {
    const Groq = require('groq-sdk');
    groqClient = new Groq({ apiKey: process.env.GROQ_API_KEY });
  } catch (err) {
    console.error('[Diagnostic Agent] Failed to init Groq client:', err.message);
  }
}

async function callGroq(prompt) {
  if (!groqClient) throw new Error('Groq client unavailable');

  const response = await Promise.race([
    groqClient.chat.completions.create({
      model: GROQ_MODEL,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens: 500,
    }),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Groq timeout')), GROQ_TIMEOUT_MS)
    ),
  ]);

  return response.choices[0].message.content;
}

async function runDiagnosticAgent() {
  try {
    // Find next submitted feedback without a diagnosis
    const feedbackResult = await db.query(`
      SELECT f.* FROM feedback_reports f
      LEFT JOIN diagnoses d ON f.id = d.feedback_id
      WHERE f.status = 'submitted' AND d.id IS NULL
      ORDER BY f.created_at ASC
      LIMIT 1
    `);

    const feedback = feedbackResult.rows[0];
    if (!feedback) {
      return { skipped: true, reason: 'No feedback to diagnose' };
    }

    console.log(`[Diagnostic Agent] Analyzing: "${feedback.title}"`);

    await db.query(
      `UPDATE feedback_reports SET status = 'diagnosing', updated_at = NOW() WHERE id = $1`,
      [feedback.id]
    );

    const safeTitle = feedback.title.replace(/[^\w\s.,!?:;()\-]/g, ' ').substring(0, 200);
    const safeDescription = feedback.description.replace(/[^\w\s.,!?:;()\-\n]/g, ' ').substring(0, 5000);

    const content = await callGroq(`You are a bug diagnosis expert. Analyze this report and respond ONLY with valid JSON (no markdown).

Bug Report:
Title: ${safeTitle}
Description: ${safeDescription}
Type: ${feedback.type}

Respond with exactly this JSON structure:
{
  "root_cause": "brief root cause (1-2 sentences)",
  "affected_files": ["file1.js", "file2.jsx"],
  "severity": "low|medium|high|critical",
  "confidence": 0.85
}`);

    let diagnosis;
    try {
      const cleaned = content.replace(/```json\n?|\n?```/g, '').trim();
      diagnosis = JSON.parse(cleaned);
    } catch {
      diagnosis = {
        root_cause: content.substring(0, 500),
        affected_files: [],
        severity: 'medium',
        confidence: 0.5,
      };
    }

    const confidence = Math.min(1, Math.max(0, parseFloat(diagnosis.confidence) || 0.5));
    const severity = ['low', 'medium', 'high', 'critical'].includes(diagnosis.severity)
      ? diagnosis.severity : 'medium';

    await db.query(
      `INSERT INTO diagnoses (feedback_id, root_cause, affected_files, severity, confidence)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        feedback.id,
        diagnosis.root_cause || 'Unknown root cause',
        diagnosis.affected_files || [],
        severity,
        confidence,
      ]
    );

    console.log(`[Diagnostic Agent] ✅ Diagnosed: ${diagnosis.root_cause}`);
    return { success: true, feedbackId: feedback.id, severity };
  } catch (err) {
    console.error('[Diagnostic Agent] Error:', err.message);
    return { error: err.message };
  }
}

module.exports = { runDiagnosticAgent };
