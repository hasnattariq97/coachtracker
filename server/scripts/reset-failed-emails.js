// One-time script: reset failed emails back to pending so the processor retries them
// Run: node server/scripts/reset-failed-emails.js
import db from '../db.js';

const result = await db.prepare(
  "UPDATE email_queue SET status = 'pending', attempts = 0 WHERE status = 'failed'"
).run();

console.log(`Reset ${result.rowCount ?? result.changes ?? 0} failed emails back to pending.`);
process.exit(0);
