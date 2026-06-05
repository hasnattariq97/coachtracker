# Agent-Browser E2E Tests — Quick Start

## Setup (One-Time)

```bash
# Already installed
npm install  # agent-browser is in devDependencies
```

## Run Tests

### Step 1: Start Backend (Terminal 1)
```bash
cd d:\Cursor_new\server
node index.js
# Should print: ✓ Server running on http://localhost:3001
```

### Step 2: Start Frontend (Terminal 2)
```bash
cd d:\Cursor_new\client
npm run dev
# Should print: ✓ Local: http://localhost:5173
```

### Step 3: Run E2E Tests (Terminal 3)
```bash
cd d:\Cursor_new\client
npm run test:e2e

# Or run specific test:
npm run test:e2e -- admin.workflow.test.js
npm run test:e2e -- coach.workflow.test.js
```

## What Gets Tested

### Admin Workflow
- ✅ Login as admin
- ✅ Create new coach
- ✅ Assign task to multiple coaches
- ✅ View dashboard KPIs

### Coach Workflow
- ✅ Login as coach
- ✅ View assigned tasks
- ✅ Mark task as complete
- ✅ Submit delay reason for overdue tasks
- ✅ See notification bell with unread count
- ✅ View personalized dashboard

## Files

```
client/
├── src/__tests__/e2e/
│   ├── agent-browser.helper.js       ← Helper class
│   ├── admin.workflow.test.js         ← Admin tests
│   └── coach.workflow.test.js         ← Coach tests
├── agent-browser.config.js            ← Configuration
├── package.json                       ← Added test:e2e script
└── AGENT-BROWSER-QUICKSTART.md        ← This file
```

## How It Works

Agent-browser gets a "snapshot" of the page (accessibility tree) with element references:

```
Page Snapshot:
@e1: "Email" (input field)
@e2: "Password" (input field)  
@e3: "Sign in" (button)
@e4: "Coaches" (heading)
```

Instead of pixel coordinates or CSS selectors, tests reference elements by ID:

```javascript
await browser.fill('@e1', 'admin@tracker.com');
await browser.click('@e3');
```

This is **robust** — same element always gets same `@ref`, even if layout shifts.

## Troubleshooting

### Tests hang or timeout

1. Check backend is running on :3001
2. Check frontend is running on :5173
3. Check login credentials (admin@tracker.com / admin123)
4. Increase timeout in helper: `await browser.wait('text', 15000)`

### "agent-browser: command not found"

Agent-browser CLI should be installed. If not:

```bash
# Build from source (requires Rust)
git clone https://github.com/vercel-labs/agent-browser
cd agent-browser && cargo install --path .
```

For now, tests use `execSync` to call agent-browser, so install the CLI globally.

### Tests pass locally but might fail in CI/CD

Set `headless: true` in `agent-browser.config.js`:

```javascript
export default {
  headless: true,  // For CI/CD
  // ...
};
```

## Output

Tests generate screenshots in `client/screenshots/`:
- `admin-logged-in.png`
- `admin-coach-created.png`
- `admin-task-assigned.png`
- `coach-logged-in.png`
- `coach-task-detail.png`
- `coach-task-completed.png`
- etc.

## Advantages

✅ **Deterministic:** Element refs (`@e1`, `@e2`) don't break when layout shifts  
✅ **LLM-Friendly:** Claude/agents can reason about element refs better than screenshots  
✅ **Standalone:** Works outside Claude Code, perfect for CI/CD  
✅ **Structured:** Returns accessibility tree, not just images  

## Next Steps

- [ ] Install agent-browser CLI globally
- [ ] Run tests locally to verify setup
- [ ] Add to GitHub Actions CI/CD pipeline
- [ ] Use for Phase 7 multi-agent testing

## Full Documentation

See [`docs/E2E-AGENT-BROWSER.md`](../docs/E2E-AGENT-BROWSER.md) for complete reference.

---

**Status:** ✅ Ready to use  
**Added:** 2026-06-04
