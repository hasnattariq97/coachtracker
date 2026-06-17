# Regional Scoping & Multi-Tenancy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add regional scoping so each of 6 regional managers sees only their own coaches/tasks, with a `super_admin` account for cross-region oversight and admin account management.

**Architecture:** Seed a fixed `regions` table (6 rows). Add `region_id` to `users`. Embed `region_id` in JWT. Every admin route calls `regionFilter(req.user)` — null for `super_admin` (no WHERE filter), `region_id` for `admin` (adds `AND region_id = ?`). New `requireSuperAdmin` middleware protects 7 new routes. Phase 9 agents loop per-region. Frontend adds 3 super_admin pages plus a sidebar variant.

**Tech Stack:** Node.js + Express + PostgreSQL + bcrypt (backend), React + Vite + TailwindCSS + lucide-react + axios (frontend), Jest + supertest (tests)

**Spec:** `docs/superpowers/specs/2026-06-17-regional-scoping-design.md`

---

## File Map

**Create:**
- `server/db-migrations/regions-schema.js` — regions table, users ALTER, data seed
- `server/routes/admins.js` — CRUD for admin accounts + region overview endpoints
- `server/__tests__/routes/admins.test.js` — tests for all new routes
- `client/src/pages/superadmin/Overview.jsx` — 6-region card dashboard
- `client/src/pages/superadmin/RegionDetail.jsx` — read-only region drill-in
- `client/src/pages/superadmin/ManageAdmins.jsx` — admin CRUD page

**Modify:**
- `server/db.js` — import + call regions migration
- `server/auth.js` — add `requireSuperAdmin`, `regionFilter`; update `generateToken`
- `server/routes/coaches.js` — add `regionFilter` to GET and POST, scope PUT/DELETE
- `server/routes/tasks.js` — add `regionFilter` to admin GET /api/tasks
- `server/agents/monitoring-agent.js` — loop per region
- `server/agents/support-agent.js` — scope interventions to region
- `server/agents/reporting-agent.js` — per-region digest + combined for super_admin
- `server/index.js` — register `/api/admins` route; import `requireSuperAdmin`
- `client/src/App.jsx` — add super_admin routes + fix `RoleRedirect`
- `client/src/components/Sidebar.jsx` — region badge for admin; super_admin nav variant

---

## Task 1: DB Migration — Regions Table + Users Schema + Seed

**Files:**
- Create: `server/db-migrations/regions-schema.js`
- Modify: `server/db.js`

- [ ] **Step 1: Create the migration file**

Create `server/db-migrations/regions-schema.js`:

```javascript
const bcrypt = require('bcrypt');

async function migrateRegions(query) {
  // 1. Create regions table
  await query(`
    CREATE TABLE IF NOT EXISTS regions (
      id   SERIAL PRIMARY KEY,
      name TEXT UNIQUE NOT NULL
    );
  `);

  // 2. Seed the 6 fixed regions
  const regions = ['Urban-I', 'Urban-II', 'Barakahu', 'Tarnol', 'Nilore', 'Sihala'];
  for (const name of regions) {
    await query(`INSERT INTO regions (name) VALUES (?) ON CONFLICT (name) DO NOTHING`, [name]);
  }

  // 3. Drop old role CHECK constraint, add new one including super_admin
  await query(`
    DO $$ BEGIN
      ALTER TABLE users DROP CONSTRAINT users_role_check;
    EXCEPTION WHEN undefined_object THEN NULL; END $$;
  `);
  await query(`
    ALTER TABLE users ADD CONSTRAINT users_role_check
    CHECK (role IN ('super_admin', 'admin', 'coach'));
  `);

  // 4. Add region_id column to users (nullable — super_admin has no region)
  await query(`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS region_id INTEGER REFERENCES regions(id);
  `);

  // 5. Migrate existing coaches → Urban-I
  await query(`
    UPDATE users SET region_id = (SELECT id FROM regions WHERE name = 'Urban-I')
    WHERE role = 'coach' AND region_id IS NULL;
  `);

  // 6. Migrate hasnat@niete.edu.pk → admin + Urban-I
  await query(`
    UPDATE users
    SET region_id = (SELECT id FROM regions WHERE name = 'Urban-I')
    WHERE email = 'hasnat@niete.edu.pk' AND region_id IS NULL;
  `);

  // 7. Seed super_admin and 5 new regional admin accounts
  const accounts = [
    { name: 'Super Admin',   email: 'hasnattariq97@gmail.com',     password: 'superadmin123*', role: 'super_admin', region: null },
    { name: 'Hashir Hussain', email: 'hashir.hussain@niete.edu.pk', password: 'hashir1234',    role: 'admin',       region: 'Sihala'   },
    { name: 'Anam Masood',   email: 'anam.masood@niete.edu.pk',    password: 'anam1234',      role: 'admin',       region: 'Urban-II' },
    { name: 'Sara Fatima',   email: 'sara.fatima@niete.edu.pk',    password: 'sara1234',      role: 'admin',       region: 'Nilore'   },
    { name: 'Asma Zaheer',   email: 'asma.zaheer@niete.edu.pk',    password: 'asma1234',      role: 'admin',       region: 'Barakahu' },
    { name: 'Abdul Waheed',  email: 'abdul.waheed@niete.edu.pk',   password: 'waheed1234',    role: 'admin',       region: 'Tarnol'   },
  ];

  for (const acct of accounts) {
    const existing = await query(`SELECT id FROM users WHERE email = ?`, [acct.email]);
    if (existing.rows.length > 0) continue;

    const hash = await bcrypt.hash(acct.password, 12);
    if (acct.region) {
      await query(`
        INSERT INTO users (name, email, password_hash, role, region_id)
        VALUES (?, ?, ?, ?, (SELECT id FROM regions WHERE name = ?))
      `, [acct.name, acct.email, hash, acct.role, acct.region]);
    } else {
      await query(`
        INSERT INTO users (name, email, password_hash, role)
        VALUES (?, ?, ?, ?)
      `, [acct.name, acct.email, hash, acct.role]);
    }
  }

  console.log('✓ Regions migration complete');
}

module.exports = { migrateRegions };
```

- [ ] **Step 2: Import and call the migration in db.js**

At the top of `server/db.js`, add the import alongside the other migrations:

```javascript
const { migrateRegions } = require('./db-migrations/regions-schema');
```

Inside `initializeDatabase()`, after the existing migration calls (e.g., after `migrateFeedbackSchema(query)`), add:

```javascript
await migrateRegions(query);
```

- [ ] **Step 3: Start the server and verify the migration runs**

```bash
cd server && node index.js
```

Expected in console output:
```
✓ Regions migration complete
✓ Server running on http://localhost:3001
```

Then verify via psql or a quick query:
```bash
curl http://localhost:3001/health
```

Expected: `{"status":"ok",...}`

- [ ] **Step 4: Commit**

```bash
git add server/db-migrations/regions-schema.js server/db.js
git commit -m "[Region] Task 1: DB migration — regions table, users schema, seed accounts"
```

---

## Task 2: Auth — region_id in JWT + requireSuperAdmin + regionFilter

**Files:**
- Modify: `server/auth.js`

- [ ] **Step 1: Write failing tests for new auth helpers**

Create `server/__tests__/auth-region.test.js`:

```javascript
process.env.JWT_SECRET = 'test-secret-key-minimum-32-characters-requirement';
const { generateToken, verifyToken, requireSuperAdmin, regionFilter } = require('../auth');

describe('generateToken with region_id', () => {
  test('includes region_id in payload for admin', () => {
    const token = generateToken({ id: 1, email: 'a@b.com', role: 'admin', region_id: 3 });
    const decoded = verifyToken(token);
    expect(decoded.region_id).toBe(3);
  });

  test('includes null region_id for super_admin', () => {
    const token = generateToken({ id: 1, email: 'a@b.com', role: 'super_admin', region_id: null });
    const decoded = verifyToken(token);
    expect(decoded.region_id).toBeNull();
  });
});

describe('requireSuperAdmin middleware', () => {
  const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
  const next = jest.fn();

  beforeEach(() => { jest.clearAllMocks(); });

  test('calls next() for super_admin', () => {
    const req = { user: { role: 'super_admin' } };
    requireSuperAdmin(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  test('returns 403 for admin', () => {
    const req = { user: { role: 'admin' } };
    requireSuperAdmin(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  test('returns 403 for coach', () => {
    const req = { user: { role: 'coach' } };
    requireSuperAdmin(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
  });
});

describe('regionFilter helper', () => {
  test('returns null for super_admin', () => {
    expect(regionFilter({ role: 'super_admin', region_id: null })).toBeNull();
  });

  test('returns region_id for admin', () => {
    expect(regionFilter({ role: 'admin', region_id: 2 })).toBe(2);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd server && NODE_ENV=test npx jest auth-region.test.js --no-coverage
```

Expected: FAIL — `requireSuperAdmin is not a function`, `regionFilter is not a function`

- [ ] **Step 3: Update server/auth.js**

Replace the current `generateToken` and add two new exports:

```javascript
const generateToken = (user) => {
  if (!user || !user.id || !user.email || !user.role) {
    throw new Error('User must have id, email, and role properties');
  }
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role, region_id: user.region_id ?? null },
    SECRET,
    { expiresIn: '24h' }
  );
};

const requireSuperAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'super_admin') {
    return res.status(403).json({ error: 'Super admin access required' });
  }
  next();
};

const regionFilter = (user) => {
  if (user.role === 'super_admin') return null;
  return user.region_id;
};
```

Update the module.exports line at the bottom:

```javascript
module.exports = {
  generateToken, verifyToken, authenticateToken,
  requireAdmin, requireCoach, requireSuperAdmin, regionFilter
};
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
cd server && NODE_ENV=test npx jest auth-region.test.js --no-coverage
```

Expected: PASS (3 test suites, all green)

- [ ] **Step 5: Update login route to include region_id in the user object passed to generateToken**

In `server/routes/auth.js`, the login route queries `SELECT * FROM users WHERE LOWER(email) = $1`. The `region_id` column is now on `users`, so `user.region_id` is already present in the result. No query change needed — `generateToken(user)` now picks it up automatically.

Verify by reading the login route — the line `const token = generateToken(user)` already passes the full `user` object, so `region_id` flows through automatically.

- [ ] **Step 6: Commit**

```bash
git add server/auth.js server/__tests__/auth-region.test.js
git commit -m "[Region] Task 2: Add region_id to JWT, requireSuperAdmin, regionFilter"
```

---

## Task 3: Admin Management Routes + Tests

**Files:**
- Create: `server/routes/admins.js`
- Create: `server/__tests__/routes/admins.test.js`
- Modify: `server/index.js`

- [ ] **Step 1: Write the failing tests**

Create `server/__tests__/routes/admins.test.js`:

```javascript
const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');

const JWT_SECRET = 'test-secret-key-minimum-32-characters-requirement';

jest.mock('../../db', () => ({
  prepare: jest.fn(),
  query: jest.fn(),
}));

jest.mock('bcrypt', () => ({
  hash: jest.fn().mockResolvedValue('hashed_password'),
}));

const db = require('../../db');
const { authenticateToken, requireSuperAdmin } = require('../../auth');
const adminsRouter = require('../../routes/admins');

const app = express();
app.use(express.json());
app.use('/api/admins', authenticateToken, requireSuperAdmin, adminsRouter);

const superAdminToken = jwt.sign({ id: 1, role: 'super_admin', region_id: null }, JWT_SECRET);
const adminToken      = jwt.sign({ id: 2, role: 'admin',       region_id: 1    }, JWT_SECRET);

beforeEach(() => { jest.clearAllMocks(); });

describe('GET /api/admins', () => {
  test('returns list of admins for super_admin', async () => {
    db.prepare.mockReturnValue({
      all: jest.fn().mockResolvedValue([
        { id: 2, name: 'Hasnat Tariq', email: 'hasnat@niete.edu.pk', region_name: 'Urban-I' },
      ]),
    });
    const res = await request(app)
      .get('/api/admins')
      .set('Authorization', `Bearer ${superAdminToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].region_name).toBe('Urban-I');
  });

  test('blocks admin role with 403', async () => {
    const res = await request(app)
      .get('/api/admins')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(403);
  });
});

describe('POST /api/admins', () => {
  test('creates admin with valid input', async () => {
    db.prepare
      .mockReturnValueOnce({ get: jest.fn().mockResolvedValue(null) })   // email check
      .mockReturnValueOnce({ get: jest.fn().mockResolvedValue({ id: 5, name: 'Sara Fatima', email: 'sara@test.com', region_name: 'Nilore' }) }); // returning

    const res = await request(app)
      .post('/api/admins')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({ name: 'Sara Fatima', email: 'sara@test.com', password: 'sara1234', region_id: 3 });

    expect(res.status).toBe(200);
    expect(res.body.email).toBe('sara@test.com');
  });

  test('returns 400 when required fields missing', async () => {
    const res = await request(app)
      .post('/api/admins')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({ name: 'Sara' });
    expect(res.status).toBe(400);
  });

  test('returns 409 when email already exists', async () => {
    db.prepare.mockReturnValue({ get: jest.fn().mockResolvedValue({ id: 99 }) });
    const res = await request(app)
      .post('/api/admins')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({ name: 'Sara Fatima', email: 'sara@test.com', password: 'sara1234', region_id: 3 });
    expect(res.status).toBe(409);
  });
});

describe('PUT /api/admins/:id', () => {
  test('updates admin name', async () => {
    db.prepare
      .mockReturnValueOnce({ get: jest.fn().mockResolvedValue({ id: 2 }) })  // find admin
      .mockReturnValueOnce({ run: jest.fn().mockResolvedValue({}) });         // update
    const res = await request(app)
      .put('/api/admins/2')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({ name: 'New Name' });
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(2);
  });

  test('returns 404 for unknown admin', async () => {
    db.prepare.mockReturnValue({ get: jest.fn().mockResolvedValue(null) });
    const res = await request(app)
      .put('/api/admins/999')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({ name: 'X' });
    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/admins/:id', () => {
  test('deletes admin', async () => {
    db.prepare
      .mockReturnValueOnce({ get: jest.fn().mockResolvedValue({ id: 2, email: 'hashir@test.com' }) })
      .mockReturnValueOnce({ run: jest.fn().mockResolvedValue({}) });
    const res = await request(app)
      .delete('/api/admins/2')
      .set('Authorization', `Bearer ${superAdminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  test('returns 404 for unknown admin', async () => {
    db.prepare.mockReturnValue({ get: jest.fn().mockResolvedValue(null) });
    const res = await request(app)
      .delete('/api/admins/999')
      .set('Authorization', `Bearer ${superAdminToken}`);
    expect(res.status).toBe(404);
  });
});
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
cd server && NODE_ENV=test npx jest admins.test.js --no-coverage
```

Expected: FAIL — `Cannot find module '../../routes/admins'`

- [ ] **Step 3: Create server/routes/admins.js**

```javascript
const express = require('express');
const bcrypt = require('bcrypt');
const db = require('../db');

const router = express.Router();

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// GET /api/admins — list all regional admins with region name
router.get('/', async (req, res) => {
  try {
    const admins = await db.prepare(`
      SELECT u.id, u.name, u.email, u.role, r.name AS region_name
      FROM users u
      LEFT JOIN regions r ON r.id = u.region_id
      WHERE u.role = 'admin'
      ORDER BY u.name
    `).all();
    res.json(admins);
  } catch (err) {
    console.error('GET /api/admins error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/admins — create regional admin
router.post('/', async (req, res) => {
  const { name, email, password, region_id } = req.body;

  if (!name || !email || !password || !region_id) {
    return res.status(400).json({ error: 'Name, email, password, and region_id are required' });
  }
  if (!EMAIL_REGEX.test(email.trim().toLowerCase())) {
    return res.status(400).json({ error: 'Invalid email format' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }

  const trimmedEmail = email.trim().toLowerCase();
  const trimmedName = name.trim();

  try {
    const existing = await db.prepare('SELECT id FROM users WHERE email = ?').get(trimmedEmail);
    if (existing) return res.status(409).json({ error: 'Email already exists' });

    const hash = await bcrypt.hash(password, 12);
    const result = await db.prepare(`
      INSERT INTO users (name, email, password_hash, role, region_id)
      VALUES (?, ?, ?, 'admin', ?)
      RETURNING id
    `).get(trimmedName, trimmedEmail, hash, region_id);

    const created = await db.prepare(`
      SELECT u.id, u.name, u.email, u.role, r.name AS region_name
      FROM users u LEFT JOIN regions r ON r.id = u.region_id
      WHERE u.id = ?
    `).get(result.id);

    res.json(created);
  } catch (err) {
    console.error('POST /api/admins error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/admins/:id — update admin name, email, or password
router.put('/:id', async (req, res) => {
  const id = Number.parseInt(req.params.id, 10);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid admin id' });

  try {
    const admin = await db.prepare(
      "SELECT id FROM users WHERE id = ? AND role = 'admin'"
    ).get(id);
    if (!admin) return res.status(404).json({ error: 'Admin not found' });

    const { name, email, password } = req.body;

    if (name !== undefined) {
      const t = name.trim();
      if (!t || t.length > 100) return res.status(400).json({ error: 'Name must be 1-100 characters' });
      await db.prepare('UPDATE users SET name = ? WHERE id = ?').run(t, id);
    }
    if (email !== undefined) {
      const t = email.trim().toLowerCase();
      if (!EMAIL_REGEX.test(t)) return res.status(400).json({ error: 'Invalid email format' });
      const conflict = await db.prepare('SELECT id FROM users WHERE email = ? AND id != ?').get(t, id);
      if (conflict) return res.status(409).json({ error: 'Email already in use' });
      await db.prepare('UPDATE users SET email = ? WHERE id = ?').run(t, id);
    }
    if (password !== undefined) {
      if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
      const hash = await bcrypt.hash(password, 12);
      await db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, id);
    }

    res.json({ id });
  } catch (err) {
    console.error('PUT /api/admins error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/admins/:id — delete regional admin
router.delete('/:id', async (req, res) => {
  const id = Number.parseInt(req.params.id, 10);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid admin id' });

  try {
    const admin = await db.prepare(
      "SELECT id, email FROM users WHERE id = ? AND role = 'admin'"
    ).get(id);
    if (!admin) return res.status(404).json({ error: 'Admin not found' });

    await db.prepare('DELETE FROM users WHERE id = ?').run(id);
    res.json({ success: true });
  } catch (err) {
    console.error('DELETE /api/admins error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/admins/regions/overview — 6 region cards with stats
router.get('/regions/overview', async (req, res) => {
  try {
    const overview = await db.prepare(`
      SELECT
        r.id,
        r.name,
        u_admin.name  AS admin_name,
        u_admin.email AS admin_email,
        COUNT(DISTINCT coaches.id)                                            AS coach_count,
        COUNT(CASE WHEN t.status IN ('assigned','in_progress') THEN 1 END)   AS active_tasks,
        COUNT(CASE WHEN t.status = 'overdue' THEN 1 END)                     AS overdue_tasks
      FROM regions r
      LEFT JOIN users u_admin ON u_admin.region_id = r.id AND u_admin.role = 'admin'
      LEFT JOIN users coaches  ON coaches.region_id = r.id AND coaches.role = 'coach'
      LEFT JOIN tasks t        ON t.coach_id = coaches.id
      GROUP BY r.id, r.name, u_admin.name, u_admin.email
      ORDER BY r.name
    `).all();
    res.json(overview);
  } catch (err) {
    console.error('GET /api/admins/regions/overview error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/admins/regions/:id/coaches — read-only coach list for a region
router.get('/regions/:id/coaches', async (req, res) => {
  const regionId = Number.parseInt(req.params.id, 10);
  if (!Number.isInteger(regionId)) return res.status(400).json({ error: 'Invalid region id' });

  try {
    const coaches = await db.prepare(`
      SELECT
        u.id, u.name, u.email,
        COUNT(CASE WHEN t.status IN ('assigned','in_progress') THEN 1 END) AS active_tasks,
        COUNT(CASE WHEN t.status = 'completed' THEN 1 END)                 AS completed,
        COUNT(CASE WHEN t.status = 'overdue' THEN 1 END)                   AS overdue
      FROM users u
      LEFT JOIN tasks t ON t.coach_id = u.id
      WHERE u.role = 'coach' AND u.region_id = ?
      GROUP BY u.id, u.name, u.email
      ORDER BY u.name
    `).all(regionId);
    res.json(coaches);
  } catch (err) {
    console.error('GET /api/admins/regions/:id/coaches error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/admins/regions/:id/tasks — read-only task list for a region
router.get('/regions/:id/tasks', async (req, res) => {
  const regionId = Number.parseInt(req.params.id, 10);
  if (!Number.isInteger(regionId)) return res.status(400).json({ error: 'Invalid region id' });

  try {
    const tasks = await db.prepare(`
      SELECT t.id, t.title, t.status, t.priority, t.due_date, u.name AS coach_name
      FROM tasks t
      JOIN users u ON u.id = t.coach_id
      WHERE u.region_id = ?
      ORDER BY t.due_date ASC
    `).all(regionId);
    res.json(tasks);
  } catch (err) {
    console.error('GET /api/admins/regions/:id/tasks error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
```

- [ ] **Step 4: Register the route in server/index.js**

In `server/index.js`, add the import at the top with other auth imports:

```javascript
const { authenticateToken, requireAdmin, requireSuperAdmin } = require('./auth');
```

Add the route registration after the existing routes:

```javascript
app.use('/api/admins', authenticateToken, requireSuperAdmin, require('./routes/admins'));
```

- [ ] **Step 5: Run tests — expect PASS**

```bash
cd server && NODE_ENV=test npx jest admins.test.js --no-coverage
```

Expected: PASS (all 8 tests green)

- [ ] **Step 6: Commit**

```bash
git add server/routes/admins.js server/__tests__/routes/admins.test.js server/index.js
git commit -m "[Region] Task 3: Admin management routes + region overview endpoints"
```

---

## Task 4: Scope coaches.js — Region Filtering

**Files:**
- Modify: `server/routes/coaches.js`

- [ ] **Step 1: Write failing tests for region-scoped coach listing**

Create `server/__tests__/routes/coaches-region.test.js`:

```javascript
const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');

const JWT_SECRET = 'test-secret-key-minimum-32-characters-requirement';

jest.mock('../../db', () => ({ prepare: jest.fn() }));
jest.mock('bcrypt', () => ({ hash: jest.fn().mockResolvedValue('hashed') }));

const db = require('../../db');
const { authenticateToken, requireAdmin, regionFilter } = require('../../auth');
const coachesRouter = require('../../routes/coaches');

const app = express();
app.use(express.json());
app.use('/api/coaches', authenticateToken, requireAdmin, coachesRouter);

const adminToken = jwt.sign({ id: 1, role: 'admin', region_id: 2 }, JWT_SECRET);

beforeEach(() => { jest.clearAllMocks(); });

describe('GET /api/coaches with region scoping', () => {
  test('admin only sees coaches in their region', async () => {
    db.prepare.mockReturnValue({
      all: jest.fn().mockResolvedValue([
        { id: 10, name: 'Coach A', email: 'a@test.com', role: 'coach', assigned: 2, completed: 1, overdue: 0, total: 3 },
      ]),
    });

    const res = await request(app)
      .get('/api/coaches')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);

    // Verify the SQL included region filter (check db.prepare was called with region-aware query)
    const sqlArg = db.prepare.mock.calls[0][0];
    expect(sqlArg).toContain('region_id');
  });
});

describe('POST /api/coaches with region assignment', () => {
  test('new coach gets assigned to admin region', async () => {
    db.prepare
      .mockReturnValueOnce({ get: jest.fn().mockResolvedValue(null) })  // email check
      .mockReturnValueOnce({ run: jest.fn().mockResolvedValue({ rows: [{ id: 11 }] }) }); // insert

    const res = await request(app)
      .post('/api/coaches')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'New Coach', email: 'new@test.com', password: 'pass123' });

    expect(res.status).toBe(200);

    // Verify region_id was included in INSERT
    const insertCall = db.prepare.mock.calls[1][0];
    expect(insertCall).toContain('region_id');
  });
});
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
cd server && NODE_ENV=test npx jest coaches-region.test.js --no-coverage
```

Expected: FAIL — region_id not in SQL queries yet

- [ ] **Step 3: Update GET / in coaches.js to add region filter**

Replace the existing `router.get('/', ...)` handler:

```javascript
const { regionFilter } = require('../auth');

router.get('/', async (req, res) => {
  console.log('[GET /coaches] Route called');
  try {
    const regionId = regionFilter(req.user);

    let sql = `
      SELECT
        u.id, u.name, u.email, u.role,
        COUNT(CASE WHEN t.status IN ('assigned','in_progress') THEN 1 END) AS assigned,
        COUNT(CASE WHEN t.status = 'completed' THEN 1 END)                 AS completed,
        COUNT(CASE WHEN t.status = 'overdue'   THEN 1 END)                 AS overdue,
        COUNT(t.id)                                                         AS total
      FROM users u
      LEFT JOIN tasks t ON t.coach_id = u.id
      WHERE u.role = 'coach'
    `;
    const params = [];
    if (regionId) {
      sql += ' AND u.region_id = ?';
      params.push(regionId);
    }
    sql += ' GROUP BY u.id ORDER BY u.name';

    const coaches = await db.prepare(sql).all(...params);
    res.json(coaches);
  } catch (err) {
    console.error('GET /api/coaches error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});
```

Add `regionFilter` import at top of coaches.js (alongside existing require):

```javascript
const { regionFilter } = require('../auth');
```

- [ ] **Step 4: Update POST / to assign coach to admin's region**

In the `router.post('/', ...)` handler, replace the INSERT query to include `region_id`:

```javascript
const regionId = req.user.region_id;
const result = await db.prepare(
  'INSERT INTO users (name, email, password_hash, role, region_id) VALUES (?, ?, ?, ?, ?) RETURNING id'
).run(trimmedName, trimmedEmail, hash, 'coach', regionId);
```

- [ ] **Step 5: Update PUT /:id and DELETE /:id to scope to admin's region**

In `router.put('/:id', ...)`, change the coach lookup to add region check:

```javascript
const regionId = req.user.region_id;
const whereRegion = regionId ? ' AND region_id = ?' : '';
const params = regionId ? [id, 'coach', regionId] : [id, 'coach'];
const coach = await db.prepare(
  `SELECT id FROM users WHERE id = ? AND role = ?${whereRegion}`
).get(...params);
```

In `router.delete('/:id', ...)`, same pattern:

```javascript
const regionId = req.user.region_id;
const whereRegion = regionId ? ' AND region_id = ?' : '';
const params = regionId ? [id, 'coach', regionId] : [id, 'coach'];
const coach = await db.prepare(
  `SELECT id FROM users WHERE id = ? AND role = ?${whereRegion}`
).get(...params);
```

- [ ] **Step 6: Run tests — expect PASS**

```bash
cd server && NODE_ENV=test npx jest coaches-region.test.js --no-coverage
```

Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add server/routes/coaches.js server/__tests__/routes/coaches-region.test.js
git commit -m "[Region] Task 4: Scope coaches routes to admin region"
```

---

## Task 5: Scope tasks.js — Admin GET Filter

**Files:**
- Modify: `server/routes/tasks.js`

- [ ] **Step 1: Write failing test**

Create `server/__tests__/routes/tasks-region.test.js`:

```javascript
const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');

const JWT_SECRET = 'test-secret-key-minimum-32-characters-requirement';

jest.mock('../../db', () => ({ prepare: jest.fn(), query: jest.fn() }));

const db = require('../../db');
const { authenticateToken } = require('../../auth');
const tasksRouter = require('../../routes/tasks');

const app = express();
app.use(express.json());
app.use('/api/tasks', authenticateToken, tasksRouter);

const adminToken = jwt.sign({ id: 1, role: 'admin', region_id: 3 }, JWT_SECRET);

beforeEach(() => { jest.clearAllMocks(); });

describe('GET /api/tasks with region scoping', () => {
  test('admin GET /api/tasks query includes region filter', async () => {
    db.prepare.mockReturnValue({ all: jest.fn().mockResolvedValue([]) });

    await request(app)
      .get('/api/tasks')
      .set('Authorization', `Bearer ${adminToken}`);

    const sqlArg = db.prepare.mock.calls[0][0];
    expect(sqlArg).toContain('region_id');
  });
});
```

- [ ] **Step 2: Run test — verify it fails**

```bash
cd server && NODE_ENV=test npx jest tasks-region.test.js --no-coverage
```

Expected: FAIL

- [ ] **Step 3: Add regionFilter to tasks.js GET /api/tasks (admin route)**

Open `server/routes/tasks.js`. Find the `router.get('/', ...)` route (the admin GET all tasks). Add the region filter:

At the top of the file add:
```javascript
const { regionFilter } = require('../auth');
```

In the `router.get('/', ...)` handler, update the query to add a region join + filter:

```javascript
router.get('/', async (req, res) => {
  try {
    if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const regionId = regionFilter(req.user);
    const { coach_id, status } = req.query;

    const VALID_STATUSES = ['assigned', 'in_progress', 'completed', 'overdue'];

    let sql = `
      SELECT t.*, u.name AS coach_name, u.region_id
      FROM tasks t
      JOIN users u ON u.id = t.coach_id
      WHERE 1=1
    `;
    const params = [];

    if (regionId) {
      sql += ' AND u.region_id = ?';
      params.push(regionId);
    }
    if (coach_id) {
      const cId = Number.parseInt(coach_id, 10);
      if (Number.isInteger(cId)) { sql += ' AND t.coach_id = ?'; params.push(cId); }
    }
    if (status && VALID_STATUSES.includes(status)) {
      sql += ' AND t.status = ?';
      params.push(status);
    }

    sql += ' ORDER BY t.assigned_at DESC';
    const tasks = await db.prepare(sql).all(...params);
    res.json(tasks);
  } catch (err) {
    console.error('GET /api/tasks error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});
```

**Note:** `GET /api/tasks/mine` (coach route) is already scoped to `req.user.id` — no change needed.

- [ ] **Step 4: Run test — expect PASS**

```bash
cd server && NODE_ENV=test npx jest tasks-region.test.js --no-coverage
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add server/routes/tasks.js server/__tests__/routes/tasks-region.test.js
git commit -m "[Region] Task 5: Scope admin task listing to region"
```

---

## Task 6: Phase 9 Agents — Region Scoping

**Files:**
- Modify: `server/agents/monitoring-agent.js`
- Modify: `server/agents/support-agent.js`
- Modify: `server/agents/reporting-agent.js`

- [ ] **Step 1: Read the current agent implementations**

```bash
head -50 server/agents/monitoring-agent.js
head -50 server/agents/support-agent.js
head -50 server/agents/reporting-agent.js
```

- [ ] **Step 2: Update monitoring-agent.js to loop per region**

Find where the monitoring agent fetches tasks/coaches (the main function that queries all coaches). Wrap the existing processing logic with a region loop.

Find the top-level function (likely `runMonitoringAgent()` or similar). Add this pattern at the start:

```javascript
const { query } = require('../db');

async function runMonitoringAgent() {
  // Fetch all 6 regions
  const regionsResult = await query('SELECT id, name FROM regions ORDER BY id');
  const regions = regionsResult.rows;

  for (const region of regions) {
    try {
      await processRegion(region);
    } catch (err) {
      console.error(`[MonitoringAgent] Error in region ${region.name}:`, err.message);
    }
  }
}

async function processRegion(region) {
  // Move existing monitoring logic here, adding WHERE u.region_id = $1
  // to any query that fetches coaches or tasks
  // Example — wherever you see:
  //   WHERE u.role = 'coach'
  // change to:
  //   WHERE u.role = 'coach' AND u.region_id = $1
  // and pass region.id as the parameter
}
```

**Important:** The actual query refactoring depends on what queries already exist in the file. Read the file first (Step 1), then apply the `AND u.region_id = $1` (or `AND u.region_id = ?`) filter to every coach/task query, passing `region.id`.

Also save snapshots with `region_id`:
```javascript
// When inserting into monitoring_snapshots:
// Add region_id column to the INSERT if not already there
await query(
  'INSERT INTO monitoring_snapshots (..., region_id) VALUES (..., $N)',
  [...existingParams, region.id]
);
```

- [ ] **Step 3: Update support-agent.js to scope interventions**

The support agent reads snapshots and sends interventions. Add region scoping to its snapshot query:

```javascript
// When fetching snapshots to process:
// Add: WHERE region_id = $1
// Pass region.id as parameter

// Wrap existing logic in a region loop (same pattern as monitoring agent):
async function runSupportAgent() {
  const regionsResult = await query('SELECT id, name FROM regions ORDER BY id');
  const regions = regionsResult.rows;
  for (const region of regions) {
    try {
      await processSupportForRegion(region);
    } catch (err) {
      console.error(`[SupportAgent] Error in region ${region.name}:`, err.message);
    }
  }
}
```

- [ ] **Step 4: Update reporting-agent.js to generate per-region digests**

The reporting agent generates one daily digest. Update it to:
1. Generate one digest per region → email that region's admin
2. Generate a combined digest → email super_admin (`hasnattariq97@gmail.com`)

```javascript
async function runReportingAgent() {
  const regionsResult = await query(`
    SELECT r.id, r.name, u.email AS admin_email
    FROM regions r
    LEFT JOIN users u ON u.region_id = r.id AND u.role = 'admin'
    ORDER BY r.id
  `);
  const regions = regionsResult.rows;

  const allDigests = [];

  for (const region of regions) {
    try {
      const digest = await generateRegionDigest(region.id, region.name);
      allDigests.push({ region: region.name, digest });

      // Email region admin
      if (region.admin_email) {
        await sendEmail(
          region.admin_email,
          `Daily Coaching Report — ${region.name}`,
          digest
        );
      }
    } catch (err) {
      console.error(`[ReportingAgent] Error for region ${region.name}:`, err.message);
    }
  }

  // Email combined digest to super_admin
  try {
    const combinedHtml = allDigests
      .map(d => `<h2>${d.region}</h2>${d.digest}`)
      .join('<hr>');
    await sendEmail(
      'hasnattariq97@gmail.com',
      'Daily Coaching Report — All Regions',
      combinedHtml
    );
  } catch (err) {
    console.error('[ReportingAgent] Error sending combined digest:', err.message);
  }
}

// generateRegionDigest(regionId, regionName) — same as existing generateDigest()
// but all queries filter by: AND u.region_id = $1 (pass regionId)
```

- [ ] **Step 5: Verify server still starts**

```bash
cd server && node index.js
```

Expected: server starts without errors, all agents scheduled.

- [ ] **Step 6: Commit**

```bash
git add server/agents/monitoring-agent.js server/agents/support-agent.js server/agents/reporting-agent.js
git commit -m "[Region] Task 6: Scope Phase 9 agents to loop per region"
```

---

## Task 7: Frontend — Routing + Auth for super_admin

**Files:**
- Modify: `client/src/App.jsx`

- [ ] **Step 1: Update App.jsx**

Add lazy imports for the three new super_admin pages at the top (alongside existing lazy imports):

```javascript
const SuperAdminOverview   = lazy(() => import('./pages/superadmin/Overview'));
const SuperAdminRegion     = lazy(() => import('./pages/superadmin/RegionDetail'));
const SuperAdminManage     = lazy(() => import('./pages/superadmin/ManageAdmins'));
```

Add a `SuperAdminLayout` component (alongside `AdminLayout` and `CoachLayout`):

```javascript
const SuperAdminLayout = () => (
  <ProtectedRoute requiredRole="super_admin" component={() => <Layout role="super_admin" />} />
);
```

Add super_admin routes inside `<Routes>` (after the `<Route element={<AdminLayout />}>` block):

```jsx
<Route element={<SuperAdminLayout />}>
  <Route path="/super-admin/overview"       element={<SuperAdminOverview />} />
  <Route path="/super-admin/region/:id"     element={<SuperAdminRegion />} />
  <Route path="/super-admin/admins"         element={<SuperAdminManage />} />
  <Route path="/super-admin"                element={<Navigate to="/super-admin/overview" replace />} />
</Route>
```

Update `RoleRedirect` to handle `super_admin`:

```javascript
const RoleRedirect = () => {
  const token = localStorage.getItem('token');
  if (!token) return <Navigate to="/login" replace />;
  try {
    const { role } = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    if (role === 'super_admin') return <Navigate to="/super-admin/overview" replace />;
    if (role === 'admin') return <Navigate to="/admin/dashboard" replace />;
    return <Navigate to="/coach/dashboard" replace />;
  } catch {
    return <Navigate to="/login" replace />;
  }
};
```

- [ ] **Step 2: Verify ProtectedRoute already supports super_admin**

`ProtectedRoute` already checks `allowed.includes(user?.role)`. Since we pass `requiredRole="super_admin"`, it will work without changes. No edit needed.

- [ ] **Step 3: Create placeholder page files so App.jsx compiles**

Create `client/src/pages/superadmin/Overview.jsx` with just a stub:

```jsx
import React from 'react';
export default function SuperAdminOverview() {
  return <div className="p-8">Super Admin Overview — coming soon</div>;
}
```

Create `client/src/pages/superadmin/RegionDetail.jsx`:

```jsx
import React from 'react';
export default function RegionDetail() {
  return <div className="p-8">Region Detail — coming soon</div>;
}
```

Create `client/src/pages/superadmin/ManageAdmins.jsx`:

```jsx
import React from 'react';
export default function ManageAdmins() {
  return <div className="p-8">Manage Admins — coming soon</div>;
}
```

- [ ] **Step 4: Start the app and verify login redirects**

Start backend and frontend:
```bash
# Terminal 1
cd server && node index.js

# Terminal 2
cd client && npm run dev
```

Login as `hasnattariq97@gmail.com` / `superadmin123*` → should redirect to `/super-admin/overview` with the stub text.

Login as `hasnat@niete.edu.pk` / `Hasnat97` → should redirect to `/admin/dashboard` as before.

- [ ] **Step 5: Commit**

```bash
git add client/src/App.jsx client/src/pages/superadmin/
git commit -m "[Region] Task 7: Add super_admin routing and page stubs"
```

---

## Task 8: Frontend — Sidebar Region Badge + Super Admin Nav

**Files:**
- Modify: `client/src/components/Sidebar.jsx`
- Modify: `client/src/components/Layout.jsx` (pass role="super_admin" to Sidebar)

- [ ] **Step 1: Check how Layout.jsx passes role to Sidebar**

```bash
cat client/src/components/Layout.jsx | head -30
```

Confirm that `<Sidebar role={role} />` is rendered with the role prop. If not, add it.

- [ ] **Step 2: Update Sidebar.jsx**

Add super_admin nav links alongside the existing `adminLinks` and `coachLinks`:

```javascript
const superAdminLinks = [
  { to: '/super-admin/overview', icon: LayoutDashboard, label: 'Overview' },
  { to: '/super-admin/admins',   icon: Users,           label: 'Manage Admins' },
];
```

Update the `links` selector in the `Sidebar` component:

```javascript
const links = role === 'super_admin' ? superAdminLinks
            : role === 'admin'       ? adminLinks
            :                          coachLinks;
```

Add the portal label in the logo section — update the `<p>` that shows the role:

```jsx
<p className="text-primary-200 text-[11px] capitalize">
  {role === 'super_admin' ? 'Super Admin' : `${role} portal`}
</p>
```

Add region badge for admin role (insert after the logo section, before `<nav>`):

```jsx
{role === 'admin' && user?.region_id && (
  <div className="mx-4 mb-1 px-3 py-1.5 bg-white/10 rounded-lg">
    <p className="text-primary-200 text-[11px] uppercase tracking-wide font-semibold">
      Region
    </p>
    <p className="text-white text-sm font-semibold">{user?.region_name || 'My Region'}</p>
  </div>
)}
```

**Note:** The JWT payload carries `region_id` (a number), not `region_name`. You have two options: (a) add `region_name` to the JWT payload in auth.js, or (b) fetch it client-side. Easiest: update `generateToken` in `auth.js` to also embed `region_name` from the user object (the login query selects the full user row — but `region_name` won't be there unless we JOIN).

Update the login route query in `server/routes/auth.js` to join the region name:

```javascript
// In the login route, replace the single-table query:
const user = await db.prepare(`
  SELECT u.*, r.name AS region_name
  FROM users u
  LEFT JOIN regions r ON r.id = u.region_id
  WHERE LOWER(u.email) = ?
`).get(normalizedEmail);
```

And in `server/auth.js`, update `generateToken` to include `region_name`:

```javascript
return jwt.sign(
  { id: user.id, email: user.email, role: user.role, region_id: user.region_id ?? null, region_name: user.region_name ?? null },
  SECRET,
  { expiresIn: '24h' }
);
```

- [ ] **Step 3: Verify in browser**

Login as `hasnat@niete.edu.pk` → sidebar shows "Region / Urban-I" badge below logo.
Login as `hasnattariq97@gmail.com` → sidebar shows only "Overview" and "Manage Admins" links.

- [ ] **Step 4: Commit**

```bash
git add client/src/components/Sidebar.jsx server/routes/auth.js server/auth.js
git commit -m "[Region] Task 8: Sidebar region badge for admin, super_admin nav"
```

---

## Task 9: Frontend — Super Admin Overview Page

**Files:**
- Modify: `client/src/pages/superadmin/Overview.jsx`

- [ ] **Step 1: Implement Overview.jsx**

Replace the stub with the real component:

```jsx
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { AlertCircle, Users, ClipboardList } from 'lucide-react';

export default function SuperAdminOverview() {
  const [regions, setRegions] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    axios.get('/api/admins/regions/overview')
      .then(r => setRegions(r.data))
      .catch(err => console.error('Overview fetch failed:', err))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="w-8 h-8 border-3 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <h1 className="text-2xl font-heading font-bold text-slate-800">All Regions Overview</h1>
        <span className="text-xs font-semibold bg-primary-100 text-primary-700 px-2 py-0.5 rounded-full">READ ONLY</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {regions.map(region => (
          <button
            key={region.id}
            onClick={() => navigate(`/super-admin/region/${region.id}`)}
            className="text-left bg-white rounded-xl border border-slate-200 p-5 shadow-sm hover:shadow-md hover:border-primary-400 transition-all duration-150 group"
          >
            <h2 className="font-heading font-bold text-lg text-slate-800 mb-1 group-hover:text-primary-700">
              {region.name}
            </h2>
            {region.admin_name && (
              <p className="text-xs text-slate-400 mb-3">Managed by {region.admin_name}</p>
            )}
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <Users size={14} className="text-primary-500" />
                <span>{region.coach_count} coaches</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <ClipboardList size={14} className="text-primary-500" />
                <span>{region.active_tasks} active tasks</span>
              </div>
              {Number(region.overdue_tasks) > 0 && (
                <div className="flex items-center gap-2 text-sm text-accent-600 font-semibold">
                  <AlertCircle size={14} />
                  <span>{region.overdue_tasks} overdue</span>
                </div>
              )}
            </div>
            <p className="text-xs text-primary-500 mt-3 group-hover:underline">View region →</p>
          </button>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify in browser**

Login as `hasnattariq97@gmail.com` → Overview page shows 6 region cards with real stats. Click any card — navigates to `/super-admin/region/:id` (still the stub).

- [ ] **Step 3: Commit**

```bash
git add client/src/pages/superadmin/Overview.jsx
git commit -m "[Region] Task 9: Super admin overview page with 6 region cards"
```

---

## Task 10: Frontend — Region Detail Page

**Files:**
- Modify: `client/src/pages/superadmin/RegionDetail.jsx`

- [ ] **Step 1: Implement RegionDetail.jsx**

Replace the stub:

```jsx
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { ArrowLeft, AlertCircle } from 'lucide-react';

export default function RegionDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [coaches, setCoaches] = useState([]);
  const [regionInfo, setRegionInfo] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      axios.get('/api/admins/regions/overview'),
      axios.get(`/api/admins/regions/${id}/coaches`),
    ]).then(([overviewRes, coachesRes]) => {
      const region = overviewRes.data.find(r => String(r.id) === String(id));
      setRegionInfo(region || null);
      setCoaches(coachesRes.data);
    }).catch(err => console.error('Region detail fetch failed:', err))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="w-8 h-8 border-3 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <button
        onClick={() => navigate('/super-admin/overview')}
        className="flex items-center gap-2 text-sm text-primary-600 hover:text-primary-800 mb-4"
      >
        <ArrowLeft size={16} /> Back to All Regions
      </button>

      <div className="flex items-center gap-3 mb-6">
        <h1 className="text-2xl font-heading font-bold text-slate-800">
          {regionInfo?.name || `Region ${id}`}
        </h1>
        {regionInfo?.admin_name && (
          <span className="text-xs bg-primary-100 text-primary-700 px-2 py-0.5 rounded-full font-medium">
            Managed by: {regionInfo.admin_name}
          </span>
        )}
        {Number(regionInfo?.overdue_tasks) > 0 && (
          <span className="text-xs bg-accent-100 text-accent-700 px-2 py-0.5 rounded-full font-semibold flex items-center gap-1">
            <AlertCircle size={11} /> {regionInfo.overdue_tasks} overdue
          </span>
        )}
      </div>

      {coaches.length === 0 ? (
        <p className="text-slate-400 text-sm">No coaches in this region yet.</p>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-4 py-3 text-left font-semibold text-slate-600">Coach</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600">Active Tasks</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600">Completed</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600">Overdue</th>
              </tr>
            </thead>
            <tbody>
              {coaches.map(coach => (
                <tr key={coach.id} className="border-b border-slate-100 last:border-0">
                  <td className="px-4 py-3 font-medium text-slate-800">{coach.name}</td>
                  <td className="px-4 py-3 text-slate-600">{coach.active_tasks}</td>
                  <td className="px-4 py-3 text-slate-600">{coach.completed}</td>
                  <td className="px-4 py-3">
                    {Number(coach.overdue) > 0
                      ? <span className="text-accent-600 font-semibold">{coach.overdue}</span>
                      : <span className="text-slate-400">0</span>
                    }
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify in browser**

From the Overview page, click any region card → Region Detail shows coach table with task counts. Back button returns to Overview.

- [ ] **Step 3: Commit**

```bash
git add client/src/pages/superadmin/RegionDetail.jsx
git commit -m "[Region] Task 10: Region detail drill-in page (read-only coach table)"
```

---

## Task 11: Frontend — Manage Admins Page

**Files:**
- Modify: `client/src/pages/superadmin/ManageAdmins.jsx`

- [ ] **Step 1: Implement ManageAdmins.jsx**

Replace the stub:

```jsx
import React, { useEffect, useState } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { PlusCircle, Pencil, Trash2, X } from 'lucide-react';

const REGIONS = [
  { id: 1, name: 'Urban-I' },
  { id: 2, name: 'Urban-II' },
  { id: 3, name: 'Barakahu' },
  { id: 4, name: 'Tarnol' },
  { id: 5, name: 'Nilore' },
  { id: 6, name: 'Sihala' },
];

function AdminModal({ admin, onClose, onSave }) {
  const isEdit = !!admin;
  const [form, setForm] = useState({
    name: admin?.name || '',
    email: admin?.email || '',
    password: '',
    region_id: admin?.region_id || '',
  });
  const [saving, setSaving] = useState(false);

  const set = (field) => (e) => setForm(f => ({ ...f, [field]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (isEdit) {
        const payload = { name: form.name, email: form.email };
        if (form.password) payload.password = form.password;
        await axios.put(`/api/admins/${admin.id}`, payload);
        toast.success('Admin updated');
      } else {
        await axios.post('/api/admins', {
          name: form.name, email: form.email,
          password: form.password, region_id: Number(form.region_id),
        });
        toast.success('Admin created');
      }
      onSave();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="font-heading font-bold text-lg">{isEdit ? 'Edit Admin' : 'Add Admin'}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Name</label>
            <input value={form.name} onChange={set('name')} required
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
            <input type="email" value={form.email} onChange={set('email')} required
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Password {isEdit && <span className="text-slate-400 font-normal">(leave blank to keep current)</span>}
            </label>
            <input type="password" value={form.password} onChange={set('password')}
              required={!isEdit} minLength={6}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400" />
          </div>
          {!isEdit && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Region</label>
              <select value={form.region_id} onChange={set('region_id')} required
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400">
                <option value="">Select a region</option>
                {REGIONS.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </div>
          )}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-semibold hover:bg-primary-700 disabled:opacity-50">
              {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Admin'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function ManageAdmins() {
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null); // null | 'add' | {admin object}

  const load = () => {
    axios.get('/api/admins')
      .then(r => setAdmins(r.data))
      .catch(() => toast.error('Failed to load admins'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleDelete = async (admin) => {
    if (!confirm(`Delete ${admin.name}? This cannot be undone.`)) return;
    try {
      await axios.delete(`/api/admins/${admin.id}`);
      toast.success('Admin deleted');
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Delete failed');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="w-8 h-8 border-3 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-heading font-bold text-slate-800">Manage Regional Admins</h1>
        <button
          onClick={() => setModal('add')}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-xl text-sm font-semibold hover:bg-primary-700 transition-colors"
        >
          <PlusCircle size={16} /> Add Admin
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="px-4 py-3 text-left font-semibold text-slate-600">Name</th>
              <th className="px-4 py-3 text-left font-semibold text-slate-600">Email</th>
              <th className="px-4 py-3 text-left font-semibold text-slate-600">Region</th>
              <th className="px-4 py-3 text-left font-semibold text-slate-600">Actions</th>
            </tr>
          </thead>
          <tbody>
            {admins.map(admin => (
              <tr key={admin.id} className="border-b border-slate-100 last:border-0">
                <td className="px-4 py-3 font-medium text-slate-800">{admin.name}</td>
                <td className="px-4 py-3 text-slate-600">{admin.email}</td>
                <td className="px-4 py-3">
                  <span className="text-xs bg-primary-100 text-primary-700 px-2 py-0.5 rounded-full font-medium">
                    {admin.region_name}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setModal(admin)}
                      className="text-primary-600 hover:text-primary-800 flex items-center gap-1 text-xs font-medium"
                    >
                      <Pencil size={13} /> Edit
                    </button>
                    <button
                      onClick={() => handleDelete(admin)}
                      className="text-accent-600 hover:text-accent-800 flex items-center gap-1 text-xs font-medium"
                    >
                      <Trash2 size={13} /> Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modal && (
        <AdminModal
          admin={modal === 'add' ? null : modal}
          onClose={() => setModal(null)}
          onSave={() => { setModal(null); load(); }}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify in browser**

Login as `hasnattariq97@gmail.com` → click "Manage Admins" in sidebar → table shows all 6 regional admins with region badges. Click "+ Add Admin" → modal opens. Fill in form → admin created. Click Edit → modal pre-filled. Click Delete → confirmation, then removed.

- [ ] **Step 3: Run full backend test suite to confirm no regressions**

```bash
cd server && NODE_ENV=test npx jest --no-coverage
```

Expected: All existing tests pass plus new region tests green.

- [ ] **Step 4: Commit**

```bash
git add client/src/pages/superadmin/ManageAdmins.jsx
git commit -m "[Region] Task 11: Manage Admins page with CRUD modal"
```

---

## Task 12: Final Verification + Deploy

- [ ] **Step 1: Run full backend test suite**

```bash
cd server && NODE_ENV=test npx jest --no-coverage
```

Expected: All tests pass (no red).

- [ ] **Step 2: Smoke test the full flow in browser**

1. Login as `hasnattariq97@gmail.com` (super_admin):
   - Overview shows 6 region cards
   - Click a card → coach table loads
   - Navigate to Manage Admins → all 6 admins listed
   - Create a test admin → appears in list
   - Delete the test admin → removed

2. Login as `hasnat@niete.edu.pk` (admin, Urban-I):
   - Sidebar shows "Urban-I" region badge
   - Coaches page shows only Urban-I coaches
   - Create a coach → appears in list scoped to Urban-I
   - Assign a task → only Urban-I coaches in dropdown

3. Login as one of the new regional admins (e.g. `sara.fatima@niete.edu.pk` / `sara1234`):
   - Redirects to admin dashboard
   - Coaches page shows 0 coaches (empty, Nilore has no coaches yet)
   - Region badge shows "Nilore"

- [ ] **Step 3: Deploy to Railway**

```bash
git push origin main
```

Railway auto-deploys on push. Migration runs on startup → regions table created, all accounts seeded.

- [ ] **Step 4: Verify production**

```bash
curl https://spectacular-connection-production-d07b.up.railway.app/health
```

Login at https://coachtracker-theta.vercel.app with `hasnattariq97@gmail.com` / `superadmin123*` → confirm overview loads.

- [ ] **Step 5: Final commit tag**

```bash
git tag v11-regional-scoping
git push origin v11-regional-scoping
```
