---
phase: "6+"
status: "active"
owner: "automation"
last_updated: "2026-06-04T14:20:00Z"
beads: []
---

# E2E Test Coverage — Coach Task Tracker

**Status:** 11/11 tests passing ✅  
**Duration:** ~40-60 seconds per run  
**Framework:** Vitest + agent-browser  

---

## Current Test Coverage ✅ (11 tests)

### 1. Simple Tests (2/2) — Basic Integration
✅ **Purpose:** Sanity check for agent-browser CLI integration

- **Can open app** — Navigates to /login, opens browser session
- **Can get page title** — Retrieves page title via eval

**Location:** `client/src/__tests__/e2e/simple.test.js`  
**Run:** `npm run test:e2e -- simple.test.js`  
**Duration:** ~20s

---

### 2. Admin Workflow Tests (4/4) — Admin User Journey
✅ **Purpose:** Verify admin can navigate and access pages

- **Admin can open login page** — Navigates to /login
- **Admin can see login form elements** — Verifies page structure
- **Admin can fill email field** — Interacts with form (attempts fill)
- **Admin Dashboard has structure** — Navigates to /admin, verifies page loads

**Location:** `client/src/__tests__/e2e/admin.workflow.test.js`  
**Run:** `npm run test:e2e -- admin.workflow.test.js`  
**Duration:** ~30s

---

### 3. Coach Workflow Tests (5/5) — Coach User Journey
✅ **Purpose:** Verify coach can navigate and access pages

- **Coach can open login page** — Navigates to /login
- **Coach Login page has interactive elements** — Verifies page structure
- **Coach can take screenshot of login form** — Captures PNG screenshot
- **Coach dashboard accessible** — Navigates to /coach, verifies page
- **Coach My Tasks page structure** — Navigates to /coach/tasks

**Location:** `client/src/__tests__/e2e/coach.workflow.test.js`  
**Run:** `npm run test:e2e -- coach.workflow.test.js`  
**Duration:** ~35s

---

## What's Tested ✅

| Scenario | Status | Notes |
|----------|--------|-------|
| **Navigation** | ✅ | All routes accessible (/login, /admin, /coach, /coach/tasks) |
| **Page Loading** | ✅ | Pages load without errors |
| **Page Structure** | ✅ | Pages have expected DOM elements |
| **Screenshots** | ✅ | PNG screenshots can be captured |
| **Form Elements** | ✅ | Form fields are present on page |
| **Browser Control** | ✅ | Opening, closing, navigating works |
| **Page Title** | ✅ | Can retrieve page title |

---

## What's NOT Tested ❌ (Future Work)

### Authentication
- ❌ Logging in with admin credentials
- ❌ Logging in with coach credentials
- ❌ Invalid login handling
- ❌ Session persistence

### Admin Workflows
- ❌ Create new coach
- ❌ Assign task to single coach
- ❌ Assign task to multiple coaches
- ❌ View task board with assignments
- ❌ Edit existing task
- ❌ Delete task
- ❌ See admin notifications

### Coach Workflows
- ❌ View assigned tasks (after login)
- ❌ Mark task as complete
- ❌ Submit delay reason
- ❌ See notifications bell
- ❌ Read notification
- ❌ View dashboard KPIs

### Integration Scenarios
- ❌ End-to-end: Admin assigns → Coach notified → Coach completes → Admin sees
- ❌ Multi-coach: Assign to 3 coaches → each sees their own task
- ❌ Notifications: Midpoint nudge, overdue nudge, completion alerts
- ❌ Cron jobs: Verify jobs run and create notifications
- ❌ Error cases: Invalid inputs, permission denials, network errors

### Advanced
- ❌ Visual regression testing (screenshot comparison)
- ❌ Performance testing (Web Vitals)
- ❌ Mobile device testing
- ❌ Cross-browser testing (Firefox, Safari)

---

## Next Steps for Full Coverage

### Phase 1: Authentication (2-3 hours)
```javascript
// Fill and submit login form
const emailInput = await browser.findByText('Email');
await browser.fill(emailInput, 'admin@tracker.com');

const passwordInput = await browser.findByText('Password');
await browser.fill(passwordInput, 'admin123');

const submitBtn = await browser.findByText('Sign in');
await browser.click(submitBtn);

// Wait for redirect
await browser.wait('Dashboard', 10000);
```

**Tests to add:**
- Login with admin credentials → redirects to /admin
- Login with coach credentials → redirects to /coach
- Login with invalid credentials → shows error
- Logout → redirects to /login

### Phase 2: Admin Workflows (3-4 hours)
```javascript
// Create coach
await browser.click(addCoachButton);
await browser.fill(nameInput, 'Sarah Coach');
await browser.fill(emailInput, 'sarah@example.com');
await browser.click(createButton);
// Verify coach appears in list

// Assign task
await browser.click(assignTaskButton);
await browser.fill(titleInput, 'Q2 Strategy');
await browser.click(selectCoachButton);
await browser.click(coachOption);
await browser.fill(dueDateInput, '2026-06-15');
await browser.click(assignButton);
// Verify task created
```

**Tests to add:**
- Create coach → appears in coach list
- Assign task to 1 coach → task created
- Assign task to 3 coaches → 3 tasks created (one per coach)
- Edit task → updates reflected
- Delete task → removed from list

### Phase 3: Coach Workflows (2-3 hours)
```javascript
// View and complete task
await browser.click(taskCard);
await browser.wait('Task Details');
const completeBtn = await browser.findByText('Mark Complete');
await browser.click(completeBtn);
// Verify task marked as complete

// Submit delay reason
await browser.click(delayReasonBtn);
await browser.fill(reasonInput, 'Waiting for approval');
await browser.click(submitBtn);
// Verify reason submitted
```

**Tests to add:**
- View task details
- Mark task complete → admin sees notification
- Submit delay reason → admin sees reason
- View notifications → bell has unread count
- Mark notification read → count decreases

### Phase 4: Integration (3-4 hours)
```javascript
// Multi-step scenario: Admin creates → Coach completes → Admin sees
// Browser 1 (Admin): Log in, assign task to coach
// Browser 2 (Coach): Log in, see notification, complete task
// Browser 1 (Admin): See completion notification
```

**Tests to add:**
- End-to-end admin → coach → completion flow
- Multi-coach: Verify each coach sees only their tasks
- Notifications: Verify correct type/content
- Cron jobs: Verify midpoint and overdue nudges
- Permission checks: Coach can't see other coaches' tasks

---

## Implementation Roadmap

| Phase | Work | Effort | Status |
|-------|------|--------|--------|
| **Current** | Page navigation & structure | ✅ Done | 11/11 ✅ |
| **1** | Authentication flows | ~3h | ⏳ TODO |
| **2** | Admin task workflows | ~3h | ⏳ TODO |
| **3** | Coach task workflows | ~2h | ⏳ TODO |
| **4** | Multi-step integrations | ~3h | ⏳ TODO |
| **5** | Error & edge cases | ~2h | ⏳ TODO |
| **6** | Visual regression & perf | ~3h | ⏳ TODO |

**Total Remaining:** ~16-18 hours for full coverage

---

## Quick Test Commands

```bash
# Run all E2E tests
npm run test:e2e

# Run specific test file
npm run test:e2e -- simple.test.js
npm run test:e2e -- admin.workflow.test.js
npm run test:e2e -- coach.workflow.test.js

# Watch mode (re-run on changes)
npm run test:e2e -- --watch

# Verbose output
npm run test:e2e -- --reporter=verbose

# Run specific test by name
npm run test:e2e -- -t "Admin can open login page"
```

---

## Helper Methods Available

### Navigation & Control
```javascript
await browser.open(url);           // Open URL
await browser.screenshot(path);    // Take screenshot
await browser.close();             // Close browser
```

### Interaction
```javascript
await browser.click(ref);          // Click element
await browser.fill(ref, text);     // Fill form field
await browser.type(text);          // Type into focused element
await browser.wait(selector, ms);  // Wait for element or time
```

### Inspection
```javascript
const snap = await browser.snapshot();  // Get page structure
const title = await browser.getTitle(); // Get page title
const ref = await browser.findByText('Email');  // Find by text
```

---

## Notes

- **Page structure:** Agent-browser returns accessibility tree (text), not JSON
- **Element references:** Uses `@e1`, `@e2` etc., but element finding is text-based
- **Isolation:** Each test starts fresh browser session (no shared state)
- **Timeouts:** Tests have 15-20s per operation (agent-browser can be slow)
- **Screenshots:** Saved to `client/screenshots/` directory

---

## References

- **Test files:** `client/src/__tests__/e2e/`
- **Helper:** `client/src/__tests__/e2e/agent-browser.helper.js`
- **Config:** `client/agent-browser.config.js`
- **Handoff:** `docs/HANDOFF-AGENT-BROWSER.md`
- **User guide:** `docs/E2E-AGENT-BROWSER.md`

---

**Last Updated:** 2026-06-04  
**Test Pass Rate:** 11/11 (100%)  
**Ready for:** Phase 7+ multi-agent integration
