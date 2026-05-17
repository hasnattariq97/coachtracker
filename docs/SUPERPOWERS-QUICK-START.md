# Superpowers Quick Start

**TL;DR:** When working on a task, follow this cycle: Brainstorm → Design → Plan → Execute (RED-GREEN-REFACTOR) → Review.

## For Each Feature/Bug

### 1️⃣ BRAINSTORM (1 min)
Ask clarifying questions. Understand requirements.
```
User: "Add email notifications"
Claude: "What events? How often? Retry logic? Template format?"
```

### 2️⃣ DESIGN (2 min)
Propose solutions with tradeoffs. Get approval.
```
Claude: "Option A: SendGrid API (faster setup, cost)"
         "Option B: In-house SMTP (free, more config)"
User: "SendGrid ✓"
```

### 3️⃣ PLAN (5 min, only for complex tasks)
Use `/plan` to design architecture. Get approval.
```
Claude: /plan
        Review codebase, design 4-file implementation
        Show plan to user
User: ✓ Approved
```

**Skip this for:** Single-file changes, one-liners, obvious fixes.

### 4️⃣ EXECUTE (RED-GREEN-REFACTOR)
Write tests first, then implementation.

**RED:** Failing test
```javascript
test('POST /api/tasks/email sends email on complete', async () => {
  // Expect email sent after task completion
});
// Run: npm test → FAIL ✗
```

**GREEN:** Minimal implementation
```javascript
app.put('/api/tasks/:id/complete', (req, res) => {
  sendEmail(req.user.email, ...);
  res.json({ ... });
});
// Run: npm test → PASS ✓
```

**REFACTOR:** Improve without breaking tests
```javascript
// Extract to sendTaskCompleteEmail helper
// Add retry logic
// Check idempotency
// Run: npm test → PASS ✓
```

### 5️⃣ REVIEW (2 min)
Use `/security-reviewer` to audit code.
```
Claude: /security-reviewer
        Check: XSS in templates, API key handling, rate limits
User: ✓ Approved → merge
```

---

## Commands Used in This Workflow

| Step | Command | Purpose |
|------|---------|---------|
| BRAINSTORM | (conversation) | Clarify requirements |
| DESIGN | (conversation) | Propose & discuss options |
| PLAN | `/plan` | Architecture review (complex tasks) |
| READ | `/skill-auth`, `/skill-api`, etc. | Learn patterns |
| EXECUTE | `npm test -- --watch` | RED-GREEN-REFACTOR |
| REVIEW | `/security-reviewer` | Security + code quality audit |

---

## Example: Assign a New Task (Real Scenario)

### BRAINSTORM
```
User: "I want coaches to get a 2-day warning email before tasks are due"

Claude: "Questions:
- Only if not completed yet? [YES]
- Which time of day? [9am]
- Timezone? [Use user's or server?] [User's]
- Template what should it say? [Coaching tone, include task details]
- If email fails, retry? [Yes, up to 3x]"
```

### DESIGN
```
Claude: "Option A: Node-cron job every hour, check 2-day boundary
         Option B: Scheduled job via external queue (Bull/Redis)
         
         I recommend A: simpler, fits our existing cron setup,
         idempotency is easy (check if notification exists)"

User: "✓ Go with A"
```

### PLAN (`/plan`)
```
Claude: /plan
  
  Research: cron.js existing pattern, notifications table
  Design: Add "email_sent" flag to notifications table
  Files to change:
    - server/db.js (schema)
    - server/cron.js (2-day warning job)
    - server/routes/tasks.js (handle email_sent flag)
    - server/config/.env (add EMAIL_SERVICE=sendgrid)
  
User: ✓ Looks good
```

### EXECUTE (RED-GREEN-REFACTOR)

**Read the skill:**
```
/skill-notifications  (understand idempotency, messaging)
/skill-cron           (understand scheduling, error handling)
```

**RED: Test**
```javascript
// server/__tests__/cron.test.js
test('warning job sends email 2 days before due date', async () => {
  // Create task due in 2 days
  // Run job
  // Assert email sent, notification created
});
// npm test → FAIL ✗
```

**GREEN: Implement**
```javascript
// server/cron.js
schedule('0 9 * * *', async () => {
  const tasksDue2Days = await db.prepare(
    'SELECT * FROM tasks WHERE ... AND datediff(day, now(), due_date) = 2'
  ).all();
  
  for (const task of tasksDue2Days) {
    await sendWarningEmail(task);
    db.prepare('INSERT INTO notifications ...').run(...);
  }
});
// npm test → PASS ✓
```

**REFACTOR**
```javascript
// Extract sendWarningEmail to helper
// Add idempotency: don't send if notification exists
// Add error handling + logging
// npm test → PASS ✓
```

### REVIEW
```
Claude: /security-reviewer

  Checks:
  ✓ Email template XSS-safe
  ✓ API key (sendgrid token) not logged
  ✓ Rate limits on email sending
  ✓ User timezone respected
  ✓ Idempotency check prevents double-send

User: ✓ Ship it
```

### COMMIT
```
git commit -m "[Phase 5] Add 2-day warning email job

RED: Test warning email sent 2 days before due
GREEN: Implement cron job, sendgrid integration
REFACTOR: Extract helper, add idempotency check, improve error logs"
```

---

## Common Patterns

### When to SKIP Brainstorm
- Bug already understood → go straight to Plan
- Feature request is tiny → Brainstorm in your head

### When to SKIP Design
- Technical approach is obvious → skip, go to Plan

### When to SKIP Plan
- Single-file change (one component, one endpoint)
- You've already approved the approach
- The feature is straightforward

### When to Use ALL 5 Steps
- New feature affecting multiple components
- Cross-system changes (auth, database schema)
- Complex business logic

---

## Tips

✅ **DO**
- Ask questions when unclear
- Write tests before code
- Use skills for patterns
- Run tests before committing
- Use `/security-reviewer` on anything touching auth/data

❌ **DON'T**
- Skip tests to go faster
- Return password_hash in responses
- Mock database (use real SQLite)
- Ignore edge cases

---

## Need Help?

- Read [@docs/SUPERPOWERS.md](SUPERPOWERS.md) for full methodology
- Read [@.claude/skills/skill-testing/SKILL.md](../.claude/skills/skill-testing/SKILL.md) for RED-GREEN-REFACTOR patterns
- Read [@docs/CONTRIBUTING.md](CONTRIBUTING.md) for conventions
- Ask questions in conversation, no judgment!
