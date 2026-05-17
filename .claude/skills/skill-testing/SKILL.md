# Testing Patterns — Coach Task Tracker

Test-first development: RED-GREEN-REFACTOR cycle for all non-trivial changes.

## Backend Testing (Jest + SQLite)

### Setup
```bash
cd server
npm install --save-dev jest supertest
npx jest --init
```

### Test File Structure
```javascript
// server/__tests__/routes/auth.test.js
const request = require('supertest');
const app = require('../index');
const db = require('../db');

beforeEach(() => {
  db.exec('DELETE FROM users');
  db.exec('INSERT INTO users VALUES (1, "admin@tracker.com", "$2b$...", "admin")');
});

afterAll(() => {
  db.close();
});

describe('POST /api/auth/login', () => {
  test('returns JWT on valid credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@tracker.com', password: 'admin123' });
    
    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
  });

  test('returns 401 on invalid password', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@tracker.com', password: 'wrong' });
    
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Invalid credentials');
  });
});
```

### Key Patterns

**Mock Database (In-Memory SQLite)**
```javascript
// Use :memory: for tests, keep file for dev
const db = new Database(':memory:');
db.exec(fs.readFileSync('./schema.sql', 'utf8'));
```

**Test Auth with JWT**
```javascript
test('GET /api/tasks/mine requires auth', async () => {
  const res = await request(app)
    .get('/api/tasks/mine')
    .set('Authorization', 'Bearer invalid');
  
  expect(res.status).toBe(401);
});

test('GET /api/tasks/mine returns only own tasks', async () => {
  // Create token for coach_id=1
  const token = jwt.sign({ id: 1, role: 'coach' }, process.env.JWT_SECRET);
  
  const res = await request(app)
    .get('/api/tasks/mine')
    .set('Authorization', `Bearer ${token}`);
  
  expect(res.body).toHaveLength(2); // Only coach 1's tasks
});
```

**Test Role Guards**
```javascript
test('POST /api/coaches requires admin', async () => {
  const coachToken = jwt.sign({ id: 1, role: 'coach' }, process.env.JWT_SECRET);
  
  const res = await request(app)
    .post('/api/coaches')
    .set('Authorization', `Bearer ${coachToken}`)
    .send({ name: 'John', email: 'john@example.com', password: 'temp' });
  
  expect(res.status).toBe(403);
});
```

**Test Notifications (Idempotency)**
```javascript
test('POST /api/tasks does not create duplicate notifications', async () => {
  const adminToken = jwt.sign({ id: 1, role: 'admin' }, process.env.JWT_SECRET);
  
  // Call twice with same data
  await request(app)
    .post('/api/tasks')
    .set('Authorization', `Bearer ${adminToken}`)
    .send(taskData);
  
  await request(app)
    .post('/api/tasks')
    .set('Authorization', `Bearer ${adminToken}`)
    .send(taskData);
  
  const notifs = db.prepare('SELECT COUNT(*) as cnt FROM notifications').get();
  expect(notifs.cnt).toBe(1); // Only one notification
});
```

---

## Frontend Testing (Vitest + React Testing Library)

### Setup
```bash
cd client
npm install --save-dev vitest @testing-library/react @testing-library/jest-dom happy-dom
```

### vite.config.js
```javascript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'happy-dom',
    setupFiles: './src/test/setup.js',
  }
})
```

### Test File Structure
```javascript
// client/src/__tests__/pages/LoginPage.test.jsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import LoginPage from '../../pages/LoginPage';
import { AuthProvider } from '../../context/AuthContext';

describe('LoginPage', () => {
  test('renders login form', () => {
    render(
      <BrowserRouter>
        <AuthProvider>
          <LoginPage />
        </AuthProvider>
      </BrowserRouter>
    );
    
    expect(screen.getByPlaceholderText('Email')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Password')).toBeInTheDocument();
  });

  test('submits credentials on form submit', async () => {
    render(
      <BrowserRouter>
        <AuthProvider>
          <LoginPage />
        </AuthProvider>
      </BrowserRouter>
    );
    
    fireEvent.change(screen.getByPlaceholderText('Email'), {
      target: { value: 'admin@tracker.com' }
    });
    fireEvent.change(screen.getByPlaceholderText('Password'), {
      target: { value: 'admin123' }
    });
    
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));
    
    await waitFor(() => {
      expect(localStorage.getItem('token')).toBeDefined();
    });
  });
});
```

### Key Patterns

**Mock API Calls**
```javascript
import { vi } from 'vitest';
import * as api from '../../api';

vi.mock('../../api', () => ({
  login: vi.fn()
}));

test('shows error on login failure', async () => {
  api.login.mockRejectedValue(new Error('Invalid credentials'));
  
  render(<LoginPage />);
  // ... test
});
```

**Test Protected Routes**
```javascript
test('ProtectedRoute redirects unauthenticated users', () => {
  const { AuthContext } = require('../../context/AuthContext');
  
  render(
    <BrowserRouter>
      <AuthProvider value={{ token: null }}>
        <ProtectedRoute requiredRole="admin">
          <div>Admin Only</div>
        </ProtectedRoute>
      </AuthProvider>
    </BrowserRouter>
  );
  
  expect(screen.queryByText('Admin Only')).not.toBeInTheDocument();
});
```

**Test Notifications (Polling)**
```javascript
test('NotificationBell polls every 30s', async () => {
  vi.useFakeTimers();
  const fetchNotifs = vi.fn();
  
  render(<NotificationBell onFetch={fetchNotifs} />);
  
  expect(fetchNotifs).toHaveBeenCalled(); // Initial load
  
  vi.advanceTimersByTime(30000);
  expect(fetchNotifs).toHaveBeenCalledTimes(2); // After 30s
});
```

---

## RED-GREEN-REFACTOR Cycle

### RED: Write Failing Test
```javascript
// test: "should mark task as completed"
test('PUT /api/tasks/:id/complete marks task completed', async () => {
  const res = await request(app)
    .put('/api/tasks/1/complete')
    .set('Authorization', `Bearer ${token}`);
  
  expect(res.status).toBe(200);
  expect(res.body.status).toBe('completed');
  expect(res.body.completed_at).toBeDefined();
});
```

**Run test → FAIL** ✗
```
FAIL: Cannot PUT /api/tasks/:id/complete (route not found)
```

### GREEN: Write Minimal Code
```javascript
app.put('/api/tasks/:id/complete', (req, res) => {
  const task = db.prepare('UPDATE tasks SET status=?, completed_at=? WHERE id=?')
    .run('completed', new Date().toISOString(), req.params.id);
  
  res.json({ id: req.params.id, status: 'completed', completed_at: task.completed_at });
});
```

**Run test → PASS** ✓

### REFACTOR: Improve Without Breaking Tests
```javascript
// Extract to helper, add auth check, create notification
app.put('/api/tasks/:id/complete', requireCoach, (req, res) => {
  const task = completeTask(req.params.id, req.user.id);
  createNotification(task.admin_id, 'task_completed', task.id);
  res.json(task);
});
```

**Run test → PASS** ✓

---

## Test Coverage Goals

| Module | Coverage | Critical? |
|--------|----------|-----------|
| Auth (login, JWT verify) | 100% | YES |
| Role guards (requireAdmin, requireCoach) | 100% | YES |
| Task endpoints | 90%+ | YES |
| Coach CRUD | 85%+ | YES |
| Notifications | 85%+ | YES |
| Cron jobs (idempotency) | 90%+ | YES |
| Frontend forms | 80%+ | YES |
| Dashboard UI | 70%+ | NO |

---

## Running Tests

```bash
# Run all tests
npm test

# Run with coverage
npm test -- --coverage

# Run single file
npm test -- auth.test.js

# Watch mode (auto-rerun on change)
npm test -- --watch
```

---

## Common Mistakes

❌ **Don't:** Test implementation details
```javascript
// Bad: tests internal state
expect(component.state.count).toBe(1);
```

✅ **Do:** Test user behavior
```javascript
// Good: tests what user sees
expect(screen.getByText('1 notification')).toBeInTheDocument();
```

❌ **Don't:** Mock everything
```javascript
// Bad: defeats purpose of testing
vi.mock('../../api');
```

✅ **Do:** Mock only external APIs
```javascript
// Good: real DB, mocked HTTP
vi.mock('axios');
```

❌ **Don't:** Ignore edge cases
```javascript
// Bad: only happy path
test('login works', () => { ... });
```

✅ **Do:** Test failure modes
```javascript
// Good: auth, validation, errors
test('login returns 401 on bad password', () => { ... });
test('login returns 400 on missing email', () => { ... });
```

---

## Debugging Tests

```bash
# Verbose output
npm test -- --reporter=verbose

# Debug single test
node --inspect-brk ./node_modules/.bin/vitest -- auth.test.js

# Print DOM
import { screen, debug } from '@testing-library/react';
debug(screen.getByRole('button'));
```

---

See [@docs/SUPERPOWERS.md](../../docs/SUPERPOWERS.md) for RED-GREEN-REFACTOR workflow.
