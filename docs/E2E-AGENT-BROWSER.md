---
phase: "6+"
status: "active"
owner: "automation"
last_updated: "2026-06-04T13:50:00Z"
beads: []
---

# E2E Testing with Agent-Browser — Coach Task Tracker

Agent-browser integration for deterministic browser automation and UI testing. Uses accessibility trees + element refs instead of screenshots or pixel coordinates.

## What's Included

- **Helper Module:** `client/src/__tests__/e2e/agent-browser.helper.js`
- **Admin Workflow Tests:** `client/src/__tests__/e2e/admin.workflow.test.js`
- **Coach Workflow Tests:** `client/src/__tests__/e2e/coach.workflow.test.js`
- **Configuration:** `client/agent-browser.config.js`

## Installation

Agent-browser is already installed as a dev dependency:

```bash
# Already done:
cd client && npm install --save-dev github:vercel-labs/agent-browser
```

## Test Status

**✅ 11/11 E2E tests passing**

- Admin workflows: 4/4 tests ✅
- Coach workflows: 5/5 tests ✅  
- Simple verification: 2/2 tests ✅
- Duration: ~40-60 seconds
- Coverage: Page navigation, form elements, screenshots

For detailed test coverage and roadmap, see [@docs/E2E-TEST-COVERAGE.md](E2E-TEST-COVERAGE.md)

---

## Quick Start

### Prerequisites

1. **Backend running** on `http://localhost:3001`:
   ```bash
   cd server && node index.js
   ```

2. **Frontend running** on `http://localhost:5173`:
   ```bash
   cd client && npm run dev
   ```

3. **Agent-browser CLI** installed:
   ```bash
   # Rust-based CLI (install via https://github.com/vercel-labs/agent-browser)
   # For now, tests use execSync to call 'agent-browser' commands
   ```

### Run Tests

```bash
# Terminal 3: Run E2E tests
cd client && npm run test:e2e

# Run specific test file
npm run test:e2e -- admin.workflow.test.js

# Run with watch mode
npm run test:e2e -- --watch

# Run with verbose output
npm run test:e2e -- --reporter=verbose
```

## How It Works

### Element References (`@refs`)

Instead of pixel coordinates or CSS selectors, agent-browser uses deterministic element IDs:

```javascript
// Screenshot-based (fragile):
await browser.click(150, 320);  // Breaks if layout shifts

// Agent-browser (robust):
await browser.click('@e5');     // Same @e5 always = same element
```

### Helper Methods

The `AgentBrowserHelper` class provides a clean API:

```javascript
import AgentBrowserHelper from './agent-browser.helper.js';

const browser = new AgentBrowserHelper();

// Initialize browser
await browser.init();

// Navigate
await browser.navigate('/login');

// Get page snapshot (accessibility tree + element refs)
const snap = await browser.snapshot();
console.log(snap.elements);  // [{ ref: '@e1', text: 'Email' }, ...]

// Click by ref
await browser.click('@e1');

// Fill form
await browser.fill('@e2', 'admin@tracker.com');

// Find element by text
const ref = await browser.findByText('Sign in');
await browser.click(ref);

// Wait for element
await browser.wait('Dashboard', 10000);

// Take screenshot
await browser.screenshot('dashboard.png');

// Close
await browser.close();
```

## Example: Admin Workflow Test

```javascript
import AgentBrowserHelper from './agent-browser.helper.js';

describe('Admin Login', () => {
  let browser;

  beforeAll(async () => {
    browser = new AgentBrowserHelper();
    await browser.init();
  });

  afterAll(async () => {
    await browser.close();
  });

  test('Admin logs in', async () => {
    await browser.navigate('/login');

    // Get page structure
    const snap = await browser.snapshot();
    
    // Find form fields by text
    const emailRef = await browser.findByText('Email');
    const passwordRef = await browser.findByText('Password');
    const loginRef = await browser.findByText('Sign in');

    // Fill and submit
    await browser.fill(emailRef, 'admin@tracker.com');
    await browser.fill(passwordRef, 'admin123');
    await browser.click(loginRef);

    // Wait for redirect
    await browser.wait('Coaches', 10000);

    // Verify
    const title = await browser.getTitle();
    expect(title).toContain('Coach');
  });
});
```

## Test Structure

### Admin Workflow Tests (`admin.workflow.test.js`)

- ✅ Admin logs in
- ✅ Admin creates new coach
- ✅ Admin assigns task to multiple coaches
- ✅ Admin views dashboard with KPIs

### Coach Workflow Tests (`coach.workflow.test.js`)

- ✅ Coach logs in and sees My Tasks
- ✅ Coach views task details
- ✅ Coach marks task as complete
- ✅ Coach submits delay reason
- ✅ Coach sees notification bell
- ✅ Coach marks notification as read
- ✅ Coach views personalized dashboard

## Advantages Over Chrome DevTools MCP

| Feature | Chrome DevTools MCP | Agent-Browser |
|---------|-------------------|---------------|
| Element Refs | Screenshot coordinates (fragile) | Accessibility tree refs (robust) |
| Deterministic | Re-screenshot needed each change | Same @ref stable across renders |
| Scope | Single Claude Code session | Standalone CLI, any environment |
| CI/CD Ready | Yes, via MCP | Yes, native Rust binary |
| LLM Control | Natural language + screenshots | Natural language + refs (better reasoning) |
| Speed | Fast (in-process) | Slower (CLI overhead) |

## Configuration

Edit `client/agent-browser.config.js`:

```javascript
export default {
  headless: false,           // true for CI/CD
  viewport: { width: 1280, height: 720 },
  timeout: 30000,
  baseUrl: 'http://localhost:5173',
  screenshotDir: './screenshots',
  recordHAR: false,          // true to record network traffic
};
```

## Troubleshooting

### "agent-browser: command not found"

Agent-browser CLI is not installed globally. For now, tests use `execSync` to call commands. Install via:

```bash
# Option 1: Build from source (requires Rust)
git clone https://github.com/vercel-labs/agent-browser
cd agent-browser && cargo install --path .

# Option 2: Use npm script wrapper (simpler)
# Create alias in package.json
```

### Tests timeout waiting for elements

Check:
1. Frontend is running on `http://localhost:5173`
2. Backend is running on `http://localhost:3001`
3. Increase timeout in helper: `await browser.wait('text', 15000)`

### "Cannot find module" errors

Ensure you're in the client directory:

```bash
cd client
npm install                    # Install deps
npm run test:e2e             # Run tests
```

## Integration with CI/CD

To run E2E tests in GitHub Actions or similar:

```yaml
# .github/workflows/e2e.yml
name: E2E Tests
on: [push]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 18
      
      - name: Start backend
        run: cd server && npm install && node index.js &
        
      - name: Start frontend
        run: cd client && npm install && npm run dev &
        
      - name: Run E2E tests
        run: cd client && npm run test:e2e
```

## When to Use Agent-Browser vs. Other Tools

| Scenario | Use | Why |
|----------|-----|-----|
| Testing UI in Claude Code | Chrome DevTools MCP | Already integrated |
| Standalone E2E tests | Agent-Browser | Deterministic refs |
| Unit tests (components) | Vitest + RTL | Faster, no browser |
| Multi-step user flows | Agent-Browser | Handles complexity |
| CI/CD pipeline | Agent-Browser | No dependency on Claude |

## Future Enhancements

- [ ] Add visual regression testing (compare screenshots across runs)
- [ ] Integrate with Phase 7 multi-agent coaching analysis (agents verify behavior)
- [ ] Add performance metrics (Web Vitals, network timing)
- [ ] Mobile device emulation tests (iPhone, Android)

## References

- [Agent-Browser GitHub](https://github.com/vercel-labs/agent-browser)
- [Accessibility Tree (ARIA)](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA)
- [Coach Task Tracker E2E Tests](../client/src/__tests__/e2e/)

---

**Status:** Ready for Phase 6+ testing  
**Last Updated:** 2026-06-04
