---
phase: "1"
status: "active"
owner: "phase-builder"
last_updated: "2026-05-17T23:00:00Z"
beads: []
---

# Phase 1: Auth System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a complete authentication system with JWT tokens, bcrypt password hashing, role-based access control, and secure login endpoint.

**Architecture:** 
- Backend exposes POST /api/auth/login endpoint that validates credentials, returns JWT token with embedded role
- JWT stored in localStorage on frontend, sent as Authorization header on all requests
- Backend auth.js exports middleware for token verification and role-based guards (requireAdmin, requireCoach)
- SQLite users table stores email, password_hash, role, created_at
- Seed admin account (admin@tracker.com/admin123) created on database init

**Tech Stack:**
- Backend: Node.js, Express, better-sqlite3, bcrypt, jsonwebtoken
- Frontend: React, TailwindCSS, axios, react-router-dom
- Testing: Jest + supertest (backend), React Testing Library + Vitest (frontend)

---

## File Structure Overview

### Backend Files
```
server/
├── index.js              # Express app entry point
├── .env                  # JWT_SECRET (add to .gitignore)
├── db.js                 # SQLite schema, seed data
├── auth.js               # JWT verification, role middlewares
└── routes/
    └── auth.js           # POST /api/auth/login endpoint
```

### Frontend Files
```
client/
├── src/
│   ├── context/
│   │   └── AuthContext.jsx         # Login state, localStorage, logout
│   ├── components/
│   │   └── ProtectedRoute.jsx      # Role-based route guard
│   ├── pages/
│   │   └── LoginPage.jsx           # Login form UI
│   └── App.jsx                     # Routes, AuthContext provider
```

### Test Files
```
server/
├── __tests__/
│   └── routes/auth.test.js         # Login endpoint tests
└── db.test.js                      # Database init tests

client/
└── src/__tests__/
    ├── context/AuthContext.test.jsx
    ├── components/ProtectedRoute.test.jsx
    └── pages/LoginPage.test.jsx
```

---

## Task 1: Initialize Backend Project

**Files:**
- Create: `server/package.json`
- Create: `server/.env`
- Create: `server/.gitignore`

**Purpose:** Set up Node.js project with required dependencies for Express, database, auth, and testing.

- [ ] **Step 1: Create server directory and package.json**

Run:
```bash
mkdir -p d:\Cursor_new\server
cd d:\Cursor_new\server
npm init -y
```

Edit `d:\Cursor_new\server\package.json` to set these fields:
```json
{
  "name": "coach-task-tracker-server",
  "version": "1.0.0",
  "description": "Coach Task Tracker API",
  "main": "index.js",
  "type": "module",
  "scripts": {
    "start": "node index.js",
    "dev": "NODE_ENV=development node index.js",
    "test": "jest --testEnvironment=node --detectOpenHandles",
    "test:watch": "jest --testEnvironment=node --watch"
  },
  "dependencies": {
    "express": "^4.18.2",
    "better-sqlite3": "^9.0.0",
    "bcrypt": "^5.1.0",
    "jsonwebtoken": "^9.0.2",
    "cors": "^2.8.5",
    "dotenv": "^16.3.1"
  },
  "devDependencies": {
    "jest": "^29.7.0",
    "supertest": "^6.3.3"
  }
}
```

- [ ] **Step 2: Install dependencies**

Run:
```bash
cd d:\Cursor_new\server
npm install
```

Expected: All packages installed, `node_modules/` created.

- [ ] **Step 3: Create .env file**

Create `d:\Cursor_new\server\.env`:
```
JWT_SECRET=your-super-secret-jwt-key-change-in-production
PORT=3001
```

- [ ] **Step 4: Create .gitignore**

Create `d:\Cursor_new\server\.gitignore`:
```
node_modules/
.env
.env.local
tracker.db
*.db
```

- [ ] **Step 5: Commit**

```bash
cd d:\Cursor_new\server
git init
git add package.json .env .gitignore
git commit -m "[Phase 1] Initialize backend project with dependencies"
```

---

## Task 2: Initialize Frontend Project

**Files:**
- Create: `client/`
- Create: `client/package.json`
- Create: `client/.env`
- Create: `client/vite.config.js`

**Purpose:** Set up React + Vite project with Axios, routing, and proxy configuration.

- [ ] **Step 1: Create frontend project**

Run:
```bash
cd d:\Cursor_new
npm create vite@latest client -- --template react
cd client
```

- [ ] **Step 2: Update package.json with additional dependencies**

Run:
```bash
cd d:\Cursor_new\client
npm install axios react-router-dom react-hot-toast
npm install -D vitest @testing-library/react @testing-library/jest-dom @vitest/ui
```

Update `d:\Cursor_new\client\package.json` scripts section:
```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "lint": "eslint . --ext js,jsx --report-unused-disable-directives --max-warnings 0",
    "preview": "vite preview",
    "test": "vitest",
    "test:ui": "vitest --ui"
  }
}
```

- [ ] **Step 3: Create vite.config.js with API proxy**

Create `d:\Cursor_new\client\vite.config.js`:
```javascript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      }
    }
  }
})
```

- [ ] **Step 4: Create .env file**

Create `d:\Cursor_new\client\.env`:
```
VITE_API_URL=http://localhost:3001
```

- [ ] **Step 5: Create .gitignore**

Create `d:\Cursor_new\client\.gitignore`:
```
node_modules/
.env
.env.local
dist/
build/
.DS_Store
*.log
```

- [ ] **Step 6: Commit**

```bash
cd d:\Cursor_new\client
git add package.json vite.config.js .env .gitignore
git commit -m "[Phase 1] Initialize frontend project with React + Vite"
```

---

## Task 3: Create Express App Entry Point

**Files:**
- Create: `server/index.js`

**Purpose:** Set up Express server with CORS, middleware, and route registration.

- [ ] **Step 1: Create server/index.js**

Create `d:\Cursor_new\server\index.js`:
```javascript
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { initializeDatabase } from './db.js';
import authRoutes from './routes/auth.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Initialize database
initializeDatabase();

// Routes
app.use('/api/auth', authRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

export default app;
```

- [ ] **Step 2: Verify Express app structure**

Verify the file exists and contains the main app setup:
```bash
cd d:\Cursor_new\server
cat index.js | grep -E "(import|app\.listen|cors|json)"
```

Expected output contains: import statements, cors, json middleware, listen.

- [ ] **Step 3: Commit**

```bash
cd d:\Cursor_new\server
git add index.js
git commit -m "[Phase 1] Create Express app entry point with CORS"
```

---

## Task 4: Create SQLite Database Schema

**Files:**
- Create: `server/db.js`
- Create: `server/__tests__/db.test.js`

**Purpose:** Initialize SQLite database with users table, seed admin account, and provide query interface.

- [ ] **Step 1: Write failing test for database initialization**

Create `d:\Cursor_new\server\__tests__\db.test.js`:
```javascript
import { initializeDatabase, getDatabase, createUser, getUserByEmail } from '../db.js';
import fs from 'fs';

describe('Database', () => {
  beforeEach(() => {
    // Use in-memory database for tests
    process.env.DATABASE_URL = ':memory:';
  });

  test('initializeDatabase creates users table', () => {
    initializeDatabase();
    const db = getDatabase();
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
    const tableNames = tables.map(t => t.name);
    expect(tableNames).toContain('users');
  });

  test('initializeDatabase seeds admin user', () => {
    initializeDatabase();
    const admin = getUserByEmail('admin@tracker.com');
    expect(admin).toBeDefined();
    expect(admin.email).toBe('admin@tracker.com');
    expect(admin.role).toBe('admin');
    expect(admin.password_hash).toBeDefined();
  });

  test('createUser creates coach with hashed password', () => {
    initializeDatabase();
    const coach = createUser({
      name: 'Test Coach',
      email: 'coach@example.com',
      password: 'testpass123',
      role: 'coach'
    });
    expect(coach.id).toBeDefined();
    expect(coach.email).toBe('coach@example.com');
    expect(coach.role).toBe('coach');
    expect(coach.password_hash).toBeDefined();
  });

  test('getUserByEmail returns user without password_hash', () => {
    initializeDatabase();
    const user = getUserByEmail('admin@tracker.com');
    expect(user.password_hash).toBeDefined(); // For comparison purposes
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
cd d:\Cursor_new\server
npm test -- __tests__/db.test.js
```

Expected: FAIL - "Cannot find module '../db.js'" or similar.

- [ ] **Step 3: Create server/db.js**

Create `d:\Cursor_new\server\db.js`:
```javascript
import Database from 'better-sqlite3';
import bcrypt from 'bcrypt';

let db = null;

export function getDatabase() {
  if (!db) {
    const dbPath = process.env.DATABASE_URL || './tracker.db';
    db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
  }
  return db;
}

export function initializeDatabase() {
  const database = getDatabase();
  
  // Create users table
  database.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('admin', 'coach')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Seed admin user if not exists
  const adminExists = database.prepare('SELECT id FROM users WHERE email = ?').get('admin@tracker.com');
  if (!adminExists) {
    const hashedPassword = bcrypt.hashSync('admin123', 10);
    database.prepare(`
      INSERT INTO users (name, email, password_hash, role)
      VALUES (?, ?, ?, ?)
    `).run('Admin', 'admin@tracker.com', hashedPassword, 'admin');
  }
}

export function createUser({ name, email, password, role = 'coach' }) {
  const database = getDatabase();
  const hashedPassword = bcrypt.hashSync(password, 10);
  
  const result = database.prepare(`
    INSERT INTO users (name, email, password_hash, role)
    VALUES (?, ?, ?, ?)
  `).run(name, email, hashedPassword, role);

  return {
    id: result.lastInsertRowid,
    name,
    email,
    role,
    password_hash: hashedPassword,
    created_at: new Date().toISOString()
  };
}

export function getUserByEmail(email) {
  const database = getDatabase();
  return database.prepare('SELECT * FROM users WHERE email = ?').get(email);
}

export function getUserById(id) {
  const database = getDatabase();
  return database.prepare('SELECT * FROM users WHERE id = ?').get(id);
}

export function verifyPassword(plainPassword, hashedPassword) {
  return bcrypt.compareSync(plainPassword, hashedPassword);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:
```bash
cd d:\Cursor_new\server
npm test -- __tests__/db.test.js
```

Expected: PASS - 4 tests passing.

- [ ] **Step 5: Commit**

```bash
cd d:\Cursor_new\server
git add db.js __tests__/db.test.js
git commit -m "[Phase 1] Create SQLite schema, seed admin user, implement database interface"
```

---

## Task 5: Create JWT Auth Middleware

**Files:**
- Create: `server/auth.js`

**Purpose:** Implement JWT token verification, role-based middleware guards, and token generation.

- [ ] **Step 1: Create server/auth.js**

Create `d:\Cursor_new\server\auth.js`:
```javascript
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-key-change-in-production';
const TOKEN_EXPIRY = '24h';

export function generateToken(user) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role,
      name: user.name
    },
    JWT_SECRET,
    { expiresIn: TOKEN_EXPIRY }
  );
}

export function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (err) {
    return null;
  }
}

export function extractTokenFromHeader(authHeader) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.slice(7);
}

export function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = extractTokenFromHeader(authHeader);

  if (!token) {
    return res.status(401).json({ error: 'Invalid token' });
  }

  const user = verifyToken(token);
  if (!user) {
    return res.status(401).json({ error: 'Invalid token' });
  }

  req.user = user;
  next();
}

export function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Access denied' });
  }
  next();
}

export function requireCoach(req, res, next) {
  if (req.user?.role !== 'coach') {
    return res.status(403).json({ error: 'Access denied' });
  }
  next();
}

export function requireSelf(paramName = 'id') {
  return (req, res, next) => {
    const resourceOwnerId = parseInt(req.params[paramName]);
    if (req.user.id !== resourceOwnerId) {
      return res.status(403).json({ error: 'Access denied' });
    }
    next();
  };
}
```

- [ ] **Step 2: Verify auth.js exports**

Run:
```bash
cd d:\Cursor_new\server
cat auth.js | grep -E "^export function"
```

Expected: Shows all 6 exported functions.

- [ ] **Step 3: Commit**

```bash
cd d:\Cursor_new\server
git add auth.js
git commit -m "[Phase 1] Create JWT auth middleware and role guards"
```

---

## Task 6: Implement Login Endpoint (RED)

**Files:**
- Create: `server/routes/auth.js`
- Create: `server/__tests__/routes/auth.test.js`

**Purpose:** Write failing test for login endpoint before implementation.

- [ ] **Step 1: Create test file with failing test**

Create `d:\Cursor_new\server\__tests__\routes\auth.test.js`:
```javascript
import request from 'supertest';
import express from 'express';
import { initializeDatabase } from '../../db.js';
import authRoutes from '../../routes/auth.js';

// Setup test app
const app = express();
app.use(express.json());

// Use in-memory database for tests
process.env.DATABASE_URL = ':memory:';
initializeDatabase();

app.use('/api/auth', authRoutes);

describe('POST /api/auth/login', () => {
  test('returns JWT token for valid admin credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'admin@tracker.com',
        password: 'admin123'
      });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('token');
    expect(typeof res.body.token).toBe('string');
  });

  test('returns 401 for invalid email', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'nonexistent@example.com',
        password: 'password123'
      });

    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error');
    expect(res.body.error).toBe('Invalid credentials');
  });

  test('returns 401 for invalid password', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'admin@tracker.com',
        password: 'wrongpassword'
      });

    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error');
    expect(res.body.error).toBe('Invalid credentials');
  });

  test('returns 400 when email is missing', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        password: 'admin123'
      });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  test('returns 400 when password is missing', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'admin@tracker.com'
      });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  test('token contains user role and email', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'admin@tracker.com',
        password: 'admin123'
      });

    expect(res.status).toBe(200);
    const token = res.body.token;
    
    // Decode token (JWT format: header.payload.signature)
    const parts = token.split('.');
    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
    
    expect(payload.email).toBe('admin@tracker.com');
    expect(payload.role).toBe('admin');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
cd d:\Cursor_new\server
npm test -- __tests__/routes/auth.test.js
```

Expected: FAIL - "Cannot find module '../../routes/auth.js'" or tests fail because endpoint doesn't exist.

---

## Task 7: Implement Login Endpoint (GREEN)

**Files:**
- Create: `server/routes/auth.js`

**Purpose:** Write minimal implementation to make all login tests pass.

- [ ] **Step 1: Create server/routes/auth.js**

Create `d:\Cursor_new\server\routes\auth.js`:
```javascript
import express from 'express';
import { getUserByEmail, verifyPassword } from '../db.js';
import { generateToken } from '../auth.js';

const router = express.Router();

router.post('/login', (req, res) => {
  const { email, password } = req.body;

  // Validate input
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  // Find user
  const user = getUserByEmail(email);
  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  // Verify password
  if (!verifyPassword(password, user.password_hash)) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  // Generate token
  const token = generateToken(user);
  res.json({ token });
});

export default router;
```

- [ ] **Step 2: Run test to verify it passes**

Run:
```bash
cd d:\Cursor_new\server
npm test -- __tests__/routes/auth.test.js
```

Expected: PASS - 6 tests passing.

- [ ] **Step 3: Commit**

```bash
cd d:\Cursor_new\server
git add routes/auth.js
git commit -m "[Phase 1] Implement login endpoint with password verification"
```

---

## Task 8: Refactor Login Endpoint

**Files:**
- Modify: `server/routes/auth.js`

**Purpose:** Improve code quality, add error handling, and ensure security best practices.

- [ ] **Step 1: Add input validation helper**

Update `d:\Cursor_new\server\routes\auth.js`:
```javascript
import express from 'express';
import { getUserByEmail, verifyPassword } from '../db.js';
import { generateToken } from '../auth.js';

const router = express.Router();

function validateLoginInput(email, password) {
  const errors = [];
  
  if (!email || typeof email !== 'string') {
    errors.push('Email is required');
  }
  if (!password || typeof password !== 'string') {
    errors.push('Password is required');
  }
  if (email && email.length > 255) {
    errors.push('Email is too long');
  }
  if (password && password.length > 500) {
    errors.push('Password is too long');
  }
  
  return errors;
}

router.post('/login', (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate input
    const validationErrors = validateLoginInput(email, password);
    if (validationErrors.length > 0) {
      return res.status(400).json({ error: validationErrors[0] });
    }

    // Find user
    const user = getUserByEmail(email.toLowerCase().trim());
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Verify password
    if (!verifyPassword(password, user.password_hash)) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate token
    const token = generateToken(user);
    res.json({ token });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
```

- [ ] **Step 2: Run tests to verify still passing**

Run:
```bash
cd d:\Cursor_new\server
npm test -- __tests__/routes/auth.test.js
```

Expected: PASS - 6 tests passing.

- [ ] **Step 3: Commit**

```bash
cd d:\Cursor_new\server
git add routes/auth.js
git commit -m "[Phase 1] Refactor login endpoint: add input validation, error handling, trim email"
```

---

## Task 9: Create React AuthContext (RED)

**Files:**
- Create: `client/src/__tests__/context/AuthContext.test.jsx`

**Purpose:** Write failing tests for login state management before implementation.

- [ ] **Step 1: Create test file**

Create `d:\Cursor_new\client\src\__tests__\context\AuthContext.test.jsx`:
```javascript
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AuthProvider, useAuth } from '../../context/AuthContext';
import { beforeEach, describe, test, expect, vi } from 'vitest';

// Mock axios
vi.mock('axios');
import axios from 'axios';

function TestComponent() {
  const { user, login, logout, isLoading, error } = useAuth();
  
  return (
    <div>
      {user && <div data-testid="user-email">{user.email}</div>}
      {isLoading && <div data-testid="loading">Loading...</div>}
      {error && <div data-testid="error">{error}</div>}
      <button onClick={() => login('admin@tracker.com', 'admin123')} data-testid="login-btn">
        Login
      </button>
      <button onClick={logout} data-testid="logout-btn">
        Logout
      </button>
    </div>
  );
}

describe('AuthContext', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  test('provides login function that sets user and token', async () => {
    const mockToken = 'mock-jwt-token';
    axios.post.mockResolvedValue({
      data: { token: mockToken }
    });

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    const loginBtn = screen.getByTestId('login-btn');
    await userEvent.click(loginBtn);

    await waitFor(() => {
      expect(screen.getByTestId('user-email')).toHaveTextContent('admin@tracker.com');
    });

    expect(localStorage.getItem('token')).toBe(mockToken);
  });

  test('provides logout function that clears token', async () => {
    localStorage.setItem('token', 'old-token');
    
    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    const logoutBtn = screen.getByTestId('logout-btn');
    await userEvent.click(logoutBtn);

    expect(localStorage.getItem('token')).toBeNull();
  });

  test('restores user from localStorage token on mount', () => {
    const payload = {
      email: 'admin@tracker.com',
      role: 'admin',
      id: 1,
      name: 'Admin'
    };
    const mockToken = 'mock-jwt-token';
    localStorage.setItem('token', mockToken);

    // Mock jwt_decode to return payload
    vi.mock('jwt-decode', () => ({
      default: () => payload
    }));

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    // User should be restored from token
    expect(screen.getByTestId('user-email')).toHaveTextContent('admin@tracker.com');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
cd d:\Cursor_new\client
npm test -- src/__tests__/context/AuthContext.test.jsx
```

Expected: FAIL - "Cannot find module '../../context/AuthContext'" or tests fail.

---

## Task 10: Create React AuthContext (GREEN)

**Files:**
- Create: `client/src/context/AuthContext.jsx`

**Purpose:** Implement login state management with localStorage and JWT decoding.

- [ ] **Step 1: Install jwt-decode**

Run:
```bash
cd d:\Cursor_new\client
npm install jwt-decode
```

- [ ] **Step 2: Create AuthContext.jsx**

Create `d:\Cursor_new\client\src\context\AuthContext.jsx`:
```javascript
import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';
import { jwtDecode } from 'jwt-decode';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // Restore user from localStorage on mount
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      try {
        const decoded = jwtDecode(token);
        setUser({
          id: decoded.id,
          email: decoded.email,
          role: decoded.role,
          name: decoded.name
        });
      } catch (err) {
        console.error('Failed to decode token:', err);
        localStorage.removeItem('token');
      }
    }
  }, []);

  const login = async (email, password) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await axios.post('/api/auth/login', { email, password });
      const token = response.data.token;
      const decoded = jwtDecode(token);

      localStorage.setItem('token', token);
      setUser({
        id: decoded.id,
        email: decoded.email,
        role: decoded.role,
        name: decoded.name
      });

      return true;
    } catch (err) {
      const errorMessage = err.response?.data?.error || 'Login failed';
      setError(errorMessage);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
    setError(null);
  };

  const value = {
    user,
    login,
    logout,
    isLoading,
    error
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
```

- [ ] **Step 3: Update axios default header**

Update `d:\Cursor_new\client\src\context\AuthContext.jsx` - add this after `jwtDecode` import:
```javascript
// Set up axios interceptor to include token in all requests
axios.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
```

- [ ] **Step 4: Run tests to verify they pass**

Run:
```bash
cd d:\Cursor_new\client
npm test -- src/__tests__/context/AuthContext.test.jsx
```

Expected: PASS - Tests passing (may need to adjust for actual behavior).

- [ ] **Step 5: Commit**

```bash
cd d:\Cursor_new\client
git add src/context/AuthContext.jsx
git commit -m "[Phase 1] Create AuthContext with login, logout, and localStorage persistence"
```

---

## Task 11: Create ProtectedRoute Component (RED)

**Files:**
- Create: `client/src/__tests__/components/ProtectedRoute.test.jsx`

**Purpose:** Write failing tests for role-based route protection.

- [ ] **Step 1: Create test file**

Create `d:\Cursor_new\client\src\__tests__\components\ProtectedRoute.test.jsx`:
```javascript
import { render, screen } from '@testing-library/react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from '../../context/AuthContext';
import ProtectedRoute from '../../components/ProtectedRoute';
import { beforeEach, describe, test, expect, vi } from 'vitest';

// Mock useAuth
vi.mock('../../context/AuthContext', async () => {
  const actual = await vi.importActual('../../context/AuthContext');
  return {
    ...actual,
    useAuth: vi.fn()
  };
});

import { useAuth } from '../../context/AuthContext';

function AdminPage() {
  return <div data-testid="admin-page">Admin Page</div>;
}

function LoginRedirect() {
  return <div data-testid="login-page">Login Page</div>;
}

describe('ProtectedRoute', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('renders protected component when user has correct role', () => {
    useAuth.mockReturnValue({
      user: { id: 1, email: 'admin@tracker.com', role: 'admin' }
    });

    render(
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<ProtectedRoute requiredRole="admin" element={<AdminPage />} />} />
        </Routes>
      </BrowserRouter>
    );

    expect(screen.getByTestId('admin-page')).toBeInTheDocument();
  });

  test('redirects to login when user is not authenticated', () => {
    useAuth.mockReturnValue({
      user: null
    });

    render(
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<ProtectedRoute requiredRole="admin" element={<AdminPage />} />} />
          <Route path="/login" element={<LoginRedirect />} />
        </Routes>
      </BrowserRouter>
    );

    expect(screen.getByTestId('login-page')).toBeInTheDocument();
  });

  test('redirects when user has wrong role', () => {
    useAuth.mockReturnValue({
      user: { id: 1, email: 'coach@example.com', role: 'coach' }
    });

    render(
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<ProtectedRoute requiredRole="admin" element={<AdminPage />} />} />
          <Route path="/login" element={<LoginRedirect />} />
        </Routes>
      </BrowserRouter>
    );

    expect(screen.getByTestId('login-page')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
cd d:\Cursor_new\client
npm test -- src/__tests__/components/ProtectedRoute.test.jsx
```

Expected: FAIL - "Cannot find module '../../components/ProtectedRoute'".

---

## Task 12: Create ProtectedRoute Component (GREEN)

**Files:**
- Create: `client/src/components/ProtectedRoute.jsx`

**Purpose:** Implement role-based route protection with redirects.

- [ ] **Step 1: Create ProtectedRoute.jsx**

Create `d:\Cursor_new\client\src\components\ProtectedRoute.jsx`:
```javascript
import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

function ProtectedRoute({ element, requiredRole = null }) {
  const { user } = useAuth();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (requiredRole && user.role !== requiredRole) {
    return <Navigate to="/login" replace />;
  }

  return element;
}

export default ProtectedRoute;
```

- [ ] **Step 2: Run tests to verify they pass**

Run:
```bash
cd d:\Cursor_new\client
npm test -- src/__tests__/components/ProtectedRoute.test.jsx
```

Expected: PASS - Tests passing.

- [ ] **Step 3: Commit**

```bash
cd d:\Cursor_new\client
git add src/components/ProtectedRoute.jsx
git commit -m "[Phase 1] Create ProtectedRoute component with role-based access control"
```

---

## Task 13: Create LoginPage Component (RED)

**Files:**
- Create: `client/src/__tests__/pages/LoginPage.test.jsx`

**Purpose:** Write failing tests for login form UI before implementation.

- [ ] **Step 1: Create test file**

Create `d:\Cursor_new\client\src\__tests__\pages\LoginPage.test.jsx`:
```javascript
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import LoginPage from '../../pages/LoginPage';
import { beforeEach, describe, test, expect, vi } from 'vitest';

// Mock useAuth
const mockLogin = vi.fn();
const mockUseAuth = () => ({
  login: mockLogin,
  isLoading: false,
  error: null,
  user: null
});

vi.mock('../../context/AuthContext', () => ({
  useAuth: mockUseAuth
}));

// Mock useNavigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate
  };
});

describe('LoginPage', () => {
  beforeEach(() => {
    mockLogin.mockClear();
    mockNavigate.mockClear();
  });

  test('renders login form with email and password fields', () => {
    render(
      <BrowserRouter>
        <LoginPage />
      </BrowserRouter>
    );

    expect(screen.getByPlaceholderText(/email/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
  });

  test('calls login with email and password on form submission', async () => {
    mockLogin.mockResolvedValue(true);
    const user = userEvent.setup();

    render(
      <BrowserRouter>
        <LoginPage />
      </BrowserRouter>
    );

    await user.type(screen.getByPlaceholderText(/email/i), 'admin@tracker.com');
    await user.type(screen.getByPlaceholderText(/password/i), 'admin123');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith('admin@tracker.com', 'admin123');
    });
  });

  test('shows error message on login failure', async () => {
    mockLogin.mockResolvedValue(false);
    
    const user = userEvent.setup();
    render(
      <BrowserRouter>
        <LoginPage />
      </BrowserRouter>
    );

    await user.type(screen.getByPlaceholderText(/email/i), 'wrong@example.com');
    await user.type(screen.getByPlaceholderText(/password/i), 'wrongpass');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    // Login should have been called
    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalled();
    });
  });

  test('disables button while loading', async () => {
    const user = userEvent.setup();
    
    // Mock useAuth with isLoading true
    vi.stubGlobal('mockUseAuth', () => ({
      login: mockLogin,
      isLoading: true,
      error: null
    }));

    render(
      <BrowserRouter>
        <LoginPage />
      </BrowserRouter>
    );

    const button = screen.getByRole('button', { name: /sign in/i });
    expect(button).toBeDisabled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
cd d:\Cursor_new\client
npm test -- src/__tests__/pages/LoginPage.test.jsx
```

Expected: FAIL - "Cannot find module '../../pages/LoginPage'".

---

## Task 14: Create LoginPage Component (GREEN)

**Files:**
- Create: `client/src/pages/LoginPage.jsx`

**Purpose:** Implement login form UI with error handling and coaching tone.

- [ ] **Step 1: Create LoginPage.jsx**

Create `d:\Cursor_new\client\src\pages\LoginPage.jsx`:
```javascript
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const navigate = useNavigate();
  const { login, isLoading, error, user } = useAuth();

  // Redirect if already logged in
  useEffect(() => {
    if (user) {
      navigate(user.role === 'admin' ? '/admin/dashboard' : '/coach/dashboard');
    }
  }, [user, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const success = await login(email, password);
    if (success) {
      navigate(user?.role === 'admin' ? '/admin/dashboard' : '/coach/dashboard');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-lg shadow-xl p-8">
        <h1 className="text-3xl font-bold text-center text-gray-900 mb-2">
          Coach Task Tracker
        </h1>
        <p className="text-center text-gray-600 mb-8">
          Sign in to manage and track your tasks
        </p>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded p-4">
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          )}

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
              Email
            </label>
            <input
              id="email"
              type="email"
              placeholder="admin@tracker.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isLoading}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none disabled:bg-gray-100"
              required
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
              Password
            </label>
            <input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isLoading}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none disabled:bg-gray-100"
              required
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold py-2 px-4 rounded-lg transition duration-200"
          >
            {isLoading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>

        <p className="text-center text-gray-600 text-sm mt-6">
          Demo: admin@tracker.com / admin123
        </p>
      </div>
    </div>
  );
}

export default LoginPage;
```

- [ ] **Step 2: Run tests to verify they pass**

Run:
```bash
cd d:\Cursor_new\client
npm test -- src/__tests__/pages/LoginPage.test.jsx
```

Expected: PASS or partial pass (mocking may need adjustment).

- [ ] **Step 3: Commit**

```bash
cd d:\Cursor_new\client
git add src/pages/LoginPage.jsx
git commit -m "[Phase 1] Create LoginPage with form, error handling, and coaching tone"
```

---

## Task 15: Create App.jsx with Routes and AuthContext

**Files:**
- Create: `client/src/App.jsx`
- Modify: `client/src/main.jsx`

**Purpose:** Set up routing structure with AuthProvider and protected routes.

- [ ] **Step 1: Create App.jsx**

Create `d:\Cursor_new\client\src\App.jsx`:
```javascript
import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import LoginPage from './pages/LoginPage';

function AppContent() {
  const { user } = useAuth();

  return (
    <Routes>
      {/* Public route */}
      <Route path="/login" element={<LoginPage />} />

      {/* Redirect root to appropriate dashboard based on role */}
      <Route
        path="/"
        element={
          user ? (
            <Navigate to={user.role === 'admin' ? '/admin/dashboard' : '/coach/dashboard'} replace />
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />

      {/* Admin routes (to be implemented in later phases) */}
      <Route
        path="/admin/*"
        element={<ProtectedRoute requiredRole="admin" element={<AdminLayout />} />}
      />

      {/* Coach routes (to be implemented in later phases) */}
      <Route
        path="/coach/*"
        element={<ProtectedRoute requiredRole="coach" element={<CoachLayout />} />}
      />

      {/* 404 fallback */}
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}

function AdminLayout() {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold">Admin Dashboard</h1>
      <p className="text-gray-600 mt-2">Coming in Phase 2+</p>
    </div>
  );
}

function CoachLayout() {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold">Coach Dashboard</h1>
      <p className="text-gray-600 mt-2">Coming in Phase 4+</p>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
```

- [ ] **Step 2: Update client/src/main.jsx to use BrowserRouter at app level**

Update `d:\Cursor_new\client\src\main.jsx`:
```javascript
import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
)
```

- [ ] **Step 3: Ensure TailwindCSS is configured**

Verify `d:\Cursor_new\client\src\index.css` includes:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

If not, create/update it.

- [ ] **Step 4: Install TailwindCSS if needed**

Run:
```bash
cd d:\Cursor_new\client
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
```

Update `d:\Cursor_new\client\tailwind.config.js`:
```javascript
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
```

- [ ] **Step 5: Commit**

```bash
cd d:\Cursor_new\client
git add src/App.jsx src/main.jsx tailwind.config.js
git commit -m "[Phase 1] Create App.jsx with routing, AuthProvider, and TailwindCSS"
```

---

## Task 16: End-to-End Verification

**Purpose:** Verify full auth flow works: login → token → protected routes → logout.

- [ ] **Step 1: Start backend**

Run in one terminal:
```bash
cd d:\Cursor_new\server
npm start
```

Wait for: "Server running on http://localhost:3001"

- [ ] **Step 2: Start frontend**

Run in another terminal:
```bash
cd d:\Cursor_new\client
npm run dev
```

Wait for: "Local: http://localhost:5173"

- [ ] **Step 3: Verify backend health**

Run:
```bash
curl http://localhost:3001/health
```

Expected response:
```json
{"status":"ok"}
```

- [ ] **Step 4: Test login endpoint directly**

Run:
```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@tracker.com","password":"admin123"}'
```

Expected: Returns JSON with `token` field.

- [ ] **Step 5: Test login with invalid credentials**

Run:
```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@tracker.com","password":"wrongpass"}'
```

Expected: Returns 401 with `{"error":"Invalid credentials"}`

- [ ] **Step 6: Open frontend in browser**

Open http://localhost:5173 in a browser.

Verify:
- [ ] LoginPage renders with email/password form
- [ ] Demo credentials shown: admin@tracker.com / admin123

- [ ] **Step 7: Test login flow**

1. Enter email: admin@tracker.com
2. Enter password: admin123
3. Click "Sign in"
4. Verify redirected to /admin/dashboard
5. Check browser DevTools > Application > localStorage
6. Verify `token` key exists with JWT value

- [ ] **Step 8: Test role routing**

1. Open browser DevTools > Application > localStorage
2. Manually edit the `token` to have role: "coach" (base64 decode/encode)
3. Or create a new coach user via database and test with their credentials
4. Verify redirects to /coach/dashboard instead

- [ ] **Step 9: Test persistence**

1. Refresh the page (F5)
2. Verify user stays logged in (token restored from localStorage)
3. Verify dashboard still renders without re-login

- [ ] **Step 10: Run all tests**

Run backend tests:
```bash
cd d:\Cursor_new\server
npm test
```

Expected: All tests passing (db.test.js, routes/auth.test.js)

Run frontend tests:
```bash
cd d:\Cursor_new\client
npm test
```

Expected: All tests passing (AuthContext, ProtectedRoute, LoginPage)

- [ ] **Step 11: Create summary**

Create `d:\Cursor_new\.beads\phase1-complete.txt`:
```
PHASE 1 COMPLETE: AUTH SYSTEM

✅ Backend
- Express app with CORS (server/index.js)
- SQLite schema with users table (server/db.js)
- JWT auth middleware (server/auth.js)
- Login endpoint (server/routes/auth.js)
- All tests passing

✅ Frontend
- AuthContext with login/logout (context/AuthContext.jsx)
- ProtectedRoute component (components/ProtectedRoute.jsx)
- LoginPage with form (pages/LoginPage.jsx)
- App.jsx with routing
- TailwindCSS configured
- All tests passing

✅ Security
- Bcrypt salt rounds: 10+
- JWT secret in .env
- Password hash never returned in responses
- Role-based route protection
- Input validation (email, password)

✅ E2E Flow
- User can login with admin@tracker.com / admin123
- JWT token stored in localStorage
- Protected routes redirect unauthenticated users
- User persists on page refresh
- Can logout and return to login page

Next Phase: Coach Management (CRUD routes)
```

- [ ] **Step 12: Final commit**

```bash
cd d:\Cursor_new
git add .beads/phase1-complete.txt
git commit -m "[Phase 1] Complete auth system: JWT, bcrypt, protected routes, E2E verified"
```

---

## Security Checklist (Final Review)

Before marking Phase 1 complete, verify:

- [ ] **password_hash never in API responses** — Check server/routes/auth.js returns only `token`
- [ ] **Email validation** — Check max length 255, required
- [ ] **Password validation** — Check max length 500, required
- [ ] **Bcrypt salt rounds ≥ 10** — Check server/db.js uses `bcrypt.hashSync(password, 10)`
- [ ] **JWT secret in .env** — Check server/.env has JWT_SECRET, never hardcoded
- [ ] **Login error handling** — Test 401, 400 responses
- [ ] **Token expiry set** — Check server/auth.js: `expiresIn: '24h'`
- [ ] **ProtectedRoute prevents unauthenticated access** — Test accessing /admin/dashboard without token
- [ ] **ProtectedRoute prevents wrong role access** — Test coach accessing /admin/dashboard
- [ ] **localStorage used for token** — Verify client/src/context/AuthContext.jsx uses localStorage.setItem('token', ...)
- [ ] **Axios interceptor sets Authorization header** — Verify all requests include `Authorization: Bearer <token>`

---

## Summary

Phase 1 implementation is complete when:

1. ✅ **Backend running** on http://localhost:3001
2. ✅ **Frontend running** on http://localhost:5173
3. ✅ **Login works** with admin@tracker.com / admin123
4. ✅ **JWT stored** in localStorage
5. ✅ **Protected routes** redirect unauthenticated users
6. ✅ **Role guards** prevent wrong-role access
7. ✅ **All tests passing** (backend + frontend)
8. ✅ **E2E verified** (login → dashboard → refresh → still logged in)

Next: Phase 2 - Coach Management (create, read, update, delete coaches)
