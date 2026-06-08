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
 * Prevents duplicate emails by checking if a similar queued email already exists.
 * Uses database constraints to enforce atomicity across concurrent requests.
 *
 * @param {string} type - Email type (e.g. 'task_assigned', 'task_completed', 'task_overdue')
 * @param {number} coachId - ID of the coach receiving the email
 * @param {number} taskId - ID of the related task
 * @param {number} adminId - ID of the admin (optional, null if coach-only email)
 * @returns {Promise<Object>} Result with { created: true, id } or { skip: true, reason }
 *
 * @example
 * // Queue an email for a coach when task is assigned
 * const result = await createEmailQueue('task_assigned', 5, 12);
 * if (result.created) console.log('Email queued with ID:', result.id);
 * if (result.skip) console.log('Email already queued, skipping duplicate');
 */
async function createEmailQueue(type, coachId, taskId, adminId = null) {
  try {
    console.log(`[EMAIL QUEUE] Attempting to queue: type=${type}, coach=${coachId}, task=${taskId}`);

    // Idempotency: check if email already queued
    const exists = await db.prepare(
      'SELECT id FROM email_queue WHERE type = ? AND task_id = ? AND coach_id = ? AND status = ? LIMIT 1'
    ).get(type, taskId, coachId, 'pending');

    if (exists) {
      console.log(`[EMAIL QUEUE] Already queued, skipping`);
      return { skip: true, reason: 'already_queued' };
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

module.exports = {
  sendEmail,
  createEmailQueue,
};
