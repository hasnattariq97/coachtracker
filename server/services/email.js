const nodemailer = require('nodemailer');
const db = require('../db.js');

// Lazy initialization - only create transporter when needed
let transporter = null;

function getTransporter() {
  if (!transporter && process.env.GMAIL_EMAIL && process.env.GMAIL_APP_PASSWORD) {
    transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_EMAIL,
        pass: process.env.GMAIL_APP_PASSWORD,
      },
    });
  }
  return transporter;
}

/**
 * Send an email via Gmail SMTP or log to console in test mode
 * @param {string} to - Email address to send to
 * @param {string} subject - Email subject line
 * @param {string} html - Email body in HTML format
 * @returns {Promise<Object>} Response from Gmail or test result
 */
async function sendEmail(to, subject, html) {
  if (process.env.EMAIL_PROVIDER === 'test') {
    console.log(`[EMAIL TEST] To: ${to}`);
    console.log(`[EMAIL TEST] Subject: ${subject}`);
    console.log(`[EMAIL TEST] HTML: ${html.substring(0, 50)}...`);
    return { success: true };
  }

  try {
    const transport = getTransporter();
    if (!transport) {
      throw new Error('Gmail not configured. Set GMAIL_EMAIL and GMAIL_APP_PASSWORD environment variables.');
    }

    const response = await transport.sendMail({
      from: process.env.GMAIL_EMAIL,
      to,
      subject,
      html,
    });
    return { success: true, id: response.messageId };
  } catch (error) {
    throw new Error(`Failed to send email: ${error.message}`);
  }
}

/**
 * Create an email queue entry with idempotency check
 *
 * Prevents duplicate emails by checking if an email of this type for this task+coach
 * has already been queued, sent, or attempted (failed). This prevents the cron job
 * from queuing the same email multiple times across cron runs.
 *
 * @param {string} type - Email type (e.g. 'assignment', 'midpoint_nudge', 'overdue', 'delay_submitted')
 * @param {number} coachId - ID of the coach receiving the email
 * @param {number} taskId - ID of the related task
 * @param {number} adminId - ID of the admin (optional, null if coach-only email)
 * @returns {Promise<Object>} Result with { created: true, id } or { skip: true, reason }
 *
 * @example
 * // Queue an email for a coach when task is assigned
 * const result = await createEmailQueue('assignment', 5, 12);
 * if (result.created) console.log('Email queued with ID:', result.id);
 * if (result.skip) console.log('Email already processed, skipping duplicate');
 */
async function createEmailQueue(type, coachId, taskId, adminId = null) {
  try {
    console.log(`[EMAIL QUEUE] Attempting to queue: type=${type}, coach=${coachId}, task=${taskId}`);

    // Idempotency: check if email already queued, sent, or failed (not skipped)
    const exists = await db.prepare(
      'SELECT id FROM email_queue WHERE type = ? AND task_id = ? AND coach_id = ? AND status IN (?, ?, ?) LIMIT 1'
    ).get(type, taskId, coachId, 'pending', 'sent', 'failed');

    if (exists) {
      console.log(`[EMAIL QUEUE] Already processed, skipping`);
      return { skip: true, reason: 'already_processed' };
    }

    // Insert into queue with atomic RETURNING clause
    const result = await db.prepare(
      'INSERT INTO email_queue (type, coach_id, admin_id, task_id, status) VALUES (?, ?, ?, ?, ?) RETURNING id'
    ).run(type, coachId, adminId, taskId, 'pending');

    const insertedId = result.rows ? result.rows[0]?.id : result.lastID;
    console.log(`[EMAIL QUEUE] ✓ Queued successfully with ID: ${insertedId}`);

    return { created: true, id: insertedId };
  } catch (error) {
    console.error(`[EMAIL QUEUE] ✗ Error queuing email:`, error.message);
    return { error: true, reason: error.message };
  }
}

/**
 * Send approval/notification email for autonomous bug fixes
 * @param {string} toEmail - Recipient email
 * @param {string} bugTitle - Title of the bug being fixed
 * @param {'pending'|'approved'|'deployed'} action - Email type
 * @param {Object} data - Extra data (prNumber, approveUrl for pending)
 */
async function sendApprovalEmail(toEmail, bugTitle, action, data = {}) {
  let subject, html;

  if (action === 'pending') {
    subject = `✅ Auto-fix ready for review: ${bugTitle}`;
    html = `
      <h2>Autonomous Fix Ready for Review</h2>
      <p>An AI agent has diagnosed and fixed a reported bug:</p>
      <p><strong>${bugTitle}</strong></p>
      ${data.prNumber ? `<p><a href="https://github.com/hasnattariq97/coachtracker/pull/${data.prNumber}">View PR #${data.prNumber} on GitHub</a></p>` : ''}
      <p style="margin-top:20px">
        <a href="${data.approveUrl}" style="background:#0D9488;color:white;padding:12px 24px;text-decoration:none;border-radius:6px;font-weight:bold">
          ✅ APPROVE FIX
        </a>
      </p>
      <p style="color:#666;font-size:12px;margin-top:16px">This link expires in 7 days. Reply to this email to reject.</p>
      <p style="color:#b45309;background:#fef3c7;border:1px solid #f59e0b;border-radius:4px;padding:10px;font-size:12px;margin-top:12px">
        ⚠️ <strong>Test results are SIMULATED</strong> — real test execution is not yet wired up.
        Review the generated code in the PR before approving.
      </p>
    `;
  } else if (action === 'approved') {
    subject = `🎉 Auto-fix deployed: ${bugTitle}`;
    html = `<h2>Fix Deployed to Production</h2><p><strong>${bugTitle}</strong> has been fixed and is now live.</p>`;
  } else if (action === 'escalated') {
    subject = `⚠️ Bug escalated for manual review: ${bugTitle}`;
    html = `
      <h2>⚠️ Bug Escalated — Manual Fix Required</h2>
      <p>The autonomous pipeline escalated this bug because it's too complex to auto-fix safely:</p>
      <table style="border-collapse:collapse;width:100%;margin:16px 0">
        <tr><td style="padding:8px;border:1px solid #e5e7eb;font-weight:600;background:#f9fafb;width:160px">Bug</td><td style="padding:8px;border:1px solid #e5e7eb">${bugTitle}</td></tr>
        <tr><td style="padding:8px;border:1px solid #e5e7eb;font-weight:600;background:#f9fafb">Escalation reason</td><td style="padding:8px;border:1px solid #e5e7eb;color:#b45309">${data.reason || 'Requires human judgment'}</td></tr>
        ${data.rootCause ? `<tr><td style="padding:8px;border:1px solid #e5e7eb;font-weight:600;background:#f9fafb">Root cause</td><td style="padding:8px;border:1px solid #e5e7eb">${data.rootCause}</td></tr>` : ''}
        ${Array.isArray(data.affectedFiles) && data.affectedFiles.length ? `<tr><td style="padding:8px;border:1px solid #e5e7eb;font-weight:600;background:#f9fafb">Affected files</td><td style="padding:8px;border:1px solid #e5e7eb"><code>${data.affectedFiles.join(', ')}</code></td></tr>` : ''}
      </table>
      <p style="color:#6b7280;font-size:13px">Please fix this manually. You can view all escalated bugs at <a href="https://coachtracker-theta.vercel.app/admin/auto-fixes">Auto Fixes</a>.</p>
    `;
  } else {
    subject = `Coach Tracker: ${bugTitle}`;
    html = `<p>${bugTitle}</p>`;
  }

  return sendEmail(toEmail || process.env.GMAIL_EMAIL || 'hasnat@niete.edu.pk', subject, html);
}

module.exports = {
  sendEmail,
  createEmailQueue,
  sendApprovalEmail,
};
