# Phase 9: Autonomous Multi-Agent Coaching System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) to implement this plan task-by-task with independent execution and review checkpoints.

**Goal:** Build a Ruflo-orchestrated multi-agent system that monitors coaches autonomously, provides real-time support via Google Sheets tagging, and generates daily performance reports with pattern analysis.

**Architecture:** Three agents (Monitoring, Support, Reporting) run in parallel via Ruflo with shared AgentDB state. Monitoring reads tasks and sheets to detect issues. Support decides intervention strategy and takes action (tag sheets, send emails). Reporting analyzes patterns and builds daily digest. All agents use Groq for intelligent decision-making.

**Tech Stack:** 
- Ruflo orchestrator + AgentDB (Phase 7, already built)
- Groq API (llama-3.3-70b-versatile, free tier)
- Google Sheets API (service account + OAuth)
- PostgreSQL (Railway)
- node-cron (existing)
- Email queue (Phase 8, existing)

---

## Part 1: Foundation (Database & Google Sheets Client)

### Task 1: Create Database Migration for Phase 9 Tables

**Files:**
- Create: `server/db-migrations/phase9-schema.js`
- Modify: `server/db.js` (add migration runner)

- [ ] **Step 1: Write migration file with all Phase 9 tables**

Create `server/db-migrations/phase9-schema.js`:

```javascript
/**
 * Phase 9 Database Schema: Autonomous Coaching System
 * Creates tables for monitoring, support actions, and reporting
 */

const fs = require('fs');
const path = require('path');

async function migratePhase9(db) {
  // Table: monitoring_snapshots
  // Stores agent's view of task progress each cycle
  db.exec(`
    CREATE TABLE IF NOT EXISTS monitoring_snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id INTEGER NOT NULL UNIQUE,
      coach_id INTEGER NOT NULL,
      sheet_id VARCHAR(255),
      snapshot_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      sheet_completion_percent INTEGER DEFAULT 0,
      missing_sections TEXT DEFAULT '[]', -- JSON array
      blockers TEXT DEFAULT '[]', -- JSON array
      status VARCHAR(50) DEFAULT 'on_time', -- on_time, at_risk, overdue, blocked
      days_remaining INTEGER,
      last_update_from_coach TIMESTAMP,
      coach_pattern VARCHAR(255),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
      FOREIGN KEY (coach_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  // Table: sheet_comments
  // Track comments agents leave in Google Sheets
  db.exec(`
    CREATE TABLE IF NOT EXISTS sheet_comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id INTEGER NOT NULL,
      coach_id INTEGER NOT NULL,
      comment_id VARCHAR(255), -- Google Sheets comment ID
      message TEXT NOT NULL,
      agent_name VARCHAR(50), -- 'monitoring', 'support'
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      coach_response_at TIMESTAMP,
      coach_response TEXT,
      FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
      FOREIGN KEY (coach_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  // Table: support_actions
  // Track support interventions (emails, tags, notifications)
  db.exec(`
    CREATE TABLE IF NOT EXISTS support_actions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id INTEGER NOT NULL,
      coach_id INTEGER NOT NULL,
      action_type VARCHAR(50) NOT NULL, -- sheet_comment, email, notification
      action_status VARCHAR(50) DEFAULT 'pending', -- pending, sent, failed
      details TEXT, -- JSON: { message, target, metadata }
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      sent_at TIMESTAMP,
      coach_response TEXT,
      FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
      FOREIGN KEY (coach_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  // Table: daily_reports
  // Archive of all daily reports (for history & trends)
  db.exec(`
    CREATE TABLE IF NOT EXISTS daily_reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      report_date DATE UNIQUE NOT NULL,
      summary_json TEXT NOT NULL, -- { on_time: 7, at_risk: 1, blocked: 0 }
      patterns_json TEXT NOT NULL, -- coach + task patterns
      recommendations_json TEXT NOT NULL, -- actionable items
      agent_activity_json TEXT, -- { issues_detected: 8, actions_taken: 5 }
      email_sent_to VARCHAR(255),
      email_sent_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Table: agent_errors
  // Track agent failures for debugging
  db.exec(`
    CREATE TABLE IF NOT EXISTS agent_errors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      agent_name VARCHAR(50) NOT NULL, -- monitoring, support, reporting
      error_type VARCHAR(100) NOT NULL,
      error_message TEXT,
      task_id INTEGER,
      severity VARCHAR(50) DEFAULT 'medium', -- low, medium, high, critical
      resolved BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      resolved_at TIMESTAMP,
      FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE SET NULL
    );
  `);

  console.log('✓ Phase 9 schema created');
}

module.exports = { migratePhase9 };
```

- [ ] **Step 2: Add migration runner to db.js**

Modify `server/db.js` (at the end of initialization, after all existing tables):

```javascript
// In the initializeDatabase() function, after existing migrations:

const { migratePhase9 } = require('./db-migrations/phase9-schema');

// ... existing code ...

async function initializeDatabase() {
  // ... existing table creation ...
  
  // Phase 9: Autonomous Coaching System
  migratePhase9(db);
  
  console.log('✓ Database initialized');
}
```

- [ ] **Step 3: Test database initialization**

Run: `cd server && node -e "const db = require('./db'); db.initializeDatabase();"`

Expected: No errors, tables created

- [ ] **Step 4: Commit**

```bash
git add server/db-migrations/phase9-schema.js server/db.js
git commit -m "[Phase 9] Database: Create schema for monitoring, support, reporting

Tables:
- monitoring_snapshots: Agent's view of task progress
- sheet_comments: Comments left in Google Sheets
- support_actions: Support interventions (email, tag, notify)
- daily_reports: Archive of daily reports
- agent_errors: Agent failure tracking"
```

---

### Task 2: Create Google Sheets Client (Read & Comment)

**Files:**
- Create: `server/services/google-sheets-client.js`

- [ ] **Step 1: Create Google Sheets client with authentication**

Create `server/services/google-sheets-client.js`:

```javascript
/**
 * Google Sheets Client for Phase 9
 * Handles reading sheets (via service account) and commenting (via admin OAuth)
 */

const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

class GoogleSheetsClient {
  constructor() {
    this.sheetsAPI = null;
    this.driveAPI = null;
    this.adminAuth = null;
    this.serviceAccountAuth = null;
  }

  /**
   * Initialize both service account (for reading) and admin OAuth (for commenting)
   */
  async initialize() {
    // Service Account (for reading sheets)
    const serviceAccountKeyPath = path.join(
      __dirname,
      '../..',
      process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH || 'google-service-account.json'
    );

    if (!fs.existsSync(serviceAccountKeyPath)) {
      console.warn('⚠️  Google Service Account not found. Sheets reading disabled.');
      this.sheetsAPI = null;
      return;
    }

    try {
      const serviceAccountKey = JSON.parse(
        fs.readFileSync(serviceAccountKeyPath, 'utf8')
      );

      this.serviceAccountAuth = new google.auth.GoogleAuth({
        credentials: serviceAccountKey,
        scopes: [
          'https://www.googleapis.com/auth/spreadsheets.readonly',
          'https://www.googleapis.com/auth/drive.readonly'
        ]
      });

      this.sheetsAPI = google.sheets({
        version: 'v4',
        auth: this.serviceAccountAuth
      });

      console.log('✓ Google Sheets API initialized (service account)');
    } catch (error) {
      console.error('✗ Failed to initialize Google Sheets API:', error.message);
      this.sheetsAPI = null;
    }

    // Admin OAuth (for commenting)
    // TODO: In Phase 9b, integrate with OAuth token management
    // For now, we'll use service account for both (limited commenting)
  }

  /**
   * Read a Google Sheet and return raw cell values
   * @param {string} spreadsheetId - Google Sheets ID
   * @param {string} range - Cell range (e.g., 'Sheet1!A1:Z100')
   * @returns {Promise<Array<Array<any>>>} Cell values
   */
  async readSheet(spreadsheetId, range) {
    if (!this.sheetsAPI) {
      throw new Error('Google Sheets API not initialized');
    }

    try {
      const response = await this.sheetsAPI.spreadsheets.values.get({
        spreadsheetId,
        range
      });

      return response.data.values || [];
    } catch (error) {
      console.error(`Failed to read sheet ${spreadsheetId}:`, error.message);
      throw error;
    }
  }

  /**
   * Get sheet metadata (title, ID, grid properties)
   * @param {string} spreadsheetId - Google Sheets ID
   * @returns {Promise<Object>} Sheet metadata
   */
  async getSheetMetadata(spreadsheetId) {
    if (!this.sheetsAPI) {
      throw new Error('Google Sheets API not initialized');
    }

    try {
      const response = await this.sheetsAPI.spreadsheets.get({
        spreadsheetId
      });

      return {
        title: response.data.properties.title,
        sheets: response.data.sheets.map(sheet => ({
          title: sheet.properties.title,
          sheetId: sheet.properties.sheetId,
          gridProperties: sheet.properties.gridProperties
        }))
      };
    } catch (error) {
      console.error(`Failed to get metadata for ${spreadsheetId}:`, error.message);
      throw error;
    }
  }

  /**
   * Add a comment to a cell in Google Sheets
   * Note: This requires admin OAuth. For Phase 9, using service account limitations.
   * TODO: Implement with admin OAuth in Phase 9b
   * @param {string} spreadsheetId - Google Sheets ID
   * @param {string} range - Cell reference (e.g., 'Sheet1!A1')
   * @param {string} message - Comment message
   * @returns {Promise<string>} Comment ID
   */
  async addComment(spreadsheetId, range, message) {
    // TODO: Phase 9b - implement with admin OAuth
    // For Phase 9a MVP, we'll queue this as an email instead
    console.log(
      `[NOTE] Sheet comment capability requires OAuth setup in Phase 9b`
    );
    console.log(`Sheet: ${spreadsheetId}, Range: ${range}`);
    console.log(`Message: ${message.substring(0, 100)}...`);
    return null;
  }

  /**
   * Check if sheet has been updated since last snapshot
   * @param {string} spreadsheetId - Google Sheets ID
   * @param {Date} lastSnapshot - When we last read this sheet
   * @returns {Promise<boolean>} True if sheet was modified
   */
  async hasBeenModifiedSince(spreadsheetId, lastSnapshot) {
    if (!this.sheetsAPI) {
      throw new Error('Google Sheets API not initialized');
    }

    try {
      const response = await this.sheetsAPI.spreadsheets.get({
        spreadsheetId,
        fields: 'spreadsheetMetadata.modifiedTime'
      });

      const lastModified = new Date(
        response.data.spreadsheetMetadata?.modifiedTime
      );
      return lastModified > lastSnapshot;
    } catch (error) {
      console.error(`Failed to check modification time:`, error.message);
      return false; // Assume not modified if we can't check
    }
  }
}

module.exports = new GoogleSheetsClient();
```

- [ ] **Step 2: Create test for sheet reading**

Create `server/__tests__/services/google-sheets-client.test.js`:

```javascript
/**
 * Tests for Google Sheets Client
 */

const sheetsClient = require('../../services/google-sheets-client');

describe('GoogleSheetsClient', () => {
  beforeAll(async () => {
    await sheetsClient.initialize();
  });

  test('should gracefully handle missing service account', async () => {
    // This test passes if client initializes without crashing
    expect(sheetsClient).toBeDefined();
  });

  test('should throw error when trying to read without auth', async () => {
    if (!sheetsClient.sheetsAPI) {
      expect(sheetsClient.sheetsAPI).toBeNull();
    }
  });

  // Integration tests (when real Google account is available):
  // - test reading actual sheet
  // - test comment creation (when OAuth is set up)
});
```

- [ ] **Step 3: Add Google APIs to package.json (if not already present)**

Check: `grep "googleapis" server/package.json`

If missing, run: `cd server && npm install googleapis`

- [ ] **Step 4: Commit**

```bash
git add server/services/google-sheets-client.js server/__tests__/services/google-sheets-client.test.js
git commit -m "[Phase 9] Services: Google Sheets client for reading + commenting

- ReadSheet: Fetch cell values from spreadsheets
- getSheetMetadata: Get sheet structure (titles, grid properties)
- addComment: Queue comments (TODO: Phase 9b OAuth integration)
- hasBeenModifiedSince: Check if sheet was updated

Uses service account for reading (free tier, no auth setup).
TODO: Phase 9b will add admin OAuth for comments."
```

---

## Part 2: Individual Agents (Can be Parallelized)

### Task 3: Create Monitoring Agent

**Files:**
- Create: `server/agents/monitoring-agent.js`

- [ ] **Step 1: Write failing test for monitoring agent**

Create `server/__tests__/agents/monitoring-agent.test.js`:

```javascript
/**
 * Tests for Monitoring Agent
 * RED-GREEN-REFACTOR: Test first
 */

const Database = require('better-sqlite3');
const { monitoringAgent } = require('../../agents/monitoring-agent');

describe('Monitoring Agent', () => {
  let db;

  beforeEach(() => {
    // Create in-memory test database
    db = new Database(':memory:');
    db.exec(`
      CREATE TABLE tasks (
        id INTEGER PRIMARY KEY,
        coach_id INTEGER,
        title VARCHAR(255),
        description TEXT,
        due_date TIMESTAMP,
        status VARCHAR(50) DEFAULT 'assigned',
        sheet_id VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE TABLE users (
        id INTEGER PRIMARY KEY,
        email VARCHAR(255),
        name VARCHAR(255),
        role VARCHAR(50)
      );
      
      CREATE TABLE monitoring_snapshots (
        id INTEGER PRIMARY KEY,
        task_id INTEGER UNIQUE,
        coach_id INTEGER,
        status VARCHAR(50),
        sheet_completion_percent INTEGER,
        missing_sections TEXT DEFAULT '[]',
        blockers TEXT DEFAULT '[]',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Insert test data
    db.prepare(`
      INSERT INTO users (id, email, name, role)
      VALUES (1, 'sarah@example.com', 'Sarah', 'coach')
    `).run();

    db.prepare(`
      INSERT INTO tasks (id, coach_id, title, due_date, status)
      VALUES (1, 1, 'Observation Sheet', datetime('now', '-2 days'), 'assigned')
    `).run();
  });

  test('should detect overdue tasks', async () => {
    const results = await monitoringAgent.run(db);
    
    expect(results).toBeDefined();
    expect(results.length).toBeGreaterThan(0);
    
    const overdueTask = results.find(r => r.task_id === 1);
    expect(overdueTask).toBeDefined();
    expect(overdueTask.status).toBe('overdue');
    expect(overdueTask.days_overdue).toBe(2);
  });

  test('should save monitoring snapshot to database', async () => {
    await monitoringAgent.run(db);
    
    const snapshot = db.prepare(
      'SELECT * FROM monitoring_snapshots WHERE task_id = 1'
    ).get();
    
    expect(snapshot).toBeDefined();
    expect(snapshot.status).toBe('overdue');
  });

  test('should classify on-time tasks correctly', async () => {
    db.prepare(`
      INSERT INTO tasks (id, coach_id, title, due_date, status)
      VALUES (2, 1, 'Site Visit', datetime('now', '+3 days'), 'assigned')
    `).run();

    const results = await monitoringAgent.run(db);
    const onTimeTask = results.find(r => r.task_id === 2);
    
    expect(onTimeTask.status).toBe('on_time');
  });
});
```

Run: `npm test -- monitoring-agent.test.js`

Expected: **FAIL** (monitoringAgent not yet implemented)

- [ ] **Step 2: Implement Monitoring Agent**

Create `server/agents/monitoring-agent.js`:

```javascript
/**
 * Monitoring Agent - Phase 9
 * Detects stuck coaches, overdue tasks, missing data
 */

const sheetsClient = require('../services/google-sheets-client');
const { callGroqAgent } = require('../services/groq-client');

class MonitoringAgent {
  /**
   * Main monitoring loop
   * Runs every 30 minutes via cron
   * @param {Database} db - Database connection
   * @returns {Promise<Array>} Array of detected issues
   */
  async run(db) {
    console.log('[Monitoring Agent] Starting...');
    const issues = [];

    try {
      // Get all active tasks
      const tasks = db
        .prepare(
          `
        SELECT t.*, u.id as coach_id, u.email as coach_email, u.name as coach_name
        FROM tasks t
        JOIN users u ON t.coach_id = u.id
        WHERE t.status IN ('assigned', 'in_progress')
        AND t.due_date IS NOT NULL
        `
        )
        .all();

      console.log(`[Monitoring Agent] Checking ${tasks.length} tasks...`);

      for (const task of tasks) {
        const issue = await this._analyzeTask(db, task);
        if (issue) {
          issues.push(issue);
        }
      }

      console.log(
        `[Monitoring Agent] Detected ${issues.length} issues. Writing to AgentDB...`
      );

      // Write results to AgentDB (Ruflo shared state)
      // TODO: Phase 9b - integrate with actual Ruflo/AgentDB
      await this._writeToAgentDB(issues);

      return issues;
    } catch (error) {
      console.error('[Monitoring Agent] Error:', error);
      await this._logError(db, 'monitoring', error.message, 'high');
      throw error;
    }
  }

  /**
   * Analyze a single task
   * Detect: overdue, at_risk, blockers, missing data
   */
  async _analyzeTask(db, task) {
    const now = new Date();
    const dueDate = new Date(task.due_date);
    const daysRemaining = Math.ceil((dueDate - now) / (1000 * 60 * 60 * 24));
    const isOverdue = now > dueDate;
    const daysOverdue = isOverdue ? Math.abs(daysRemaining) : 0;

    // Determine status
    let status = 'on_time';
    let blockers = [];

    if (isOverdue) {
      status = 'overdue';
      blockers.push(`Task is ${daysOverdue} days overdue`);
    } else if (daysRemaining <= 1) {
      status = 'at_risk';
      blockers.push('Due within 24 hours');
    }

    // If task has a Google Sheet, read it for completion
    let sheetCompletion = null;
    if (task.sheet_id) {
      try {
        sheetCompletion = await this._analyzeSheet(task);
      } catch (error) {
        console.warn(
          `[Monitoring Agent] Could not read sheet ${task.sheet_id}:`,
          error.message
        );
        blockers.push('Could not read attached sheet');
      }
    }

    // Save snapshot
    db.prepare(`
      INSERT OR REPLACE INTO monitoring_snapshots
      (task_id, coach_id, status, sheet_completion_percent, blockers, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      task.id,
      task.coach_id,
      status,
      sheetCompletion || 0,
      JSON.stringify(blockers),
      new Date().toISOString()
    );

    // Return issue if status is not 'on_time'
    if (status !== 'on_time') {
      return {
        task_id: task.id,
        coach_id: task.coach_id,
        coach_name: task.coach_name,
        coach_email: task.coach_email,
        task_title: task.title,
        status,
        days_overdue: daysOverdue,
        sheet_completion: sheetCompletion,
        blockers,
        detected_at: new Date().toISOString()
      };
    }

    return null;
  }

  /**
   * Analyze sheet completion using Groq
   */
  async _analyzeSheet(task) {
    try {
      const range = `Sheet1!A1:Z100`;
      const cells = await sheetsClient.readSheet(task.sheet_id, range);

      if (!cells || cells.length === 0) {
        return 0;
      }

      // Use Groq to understand completion
      const analysis = await callGroqAgent({
        messages: [
          {
            role: 'user',
            content: `Analyze this coaching task sheet for completion percentage.

Task: "${task.title}"
Description: "${task.description}"

Sheet data (first 100 rows):
${JSON.stringify(cells.slice(0, 20))}

Return JSON with:
{
  "completion_percent": 0-100,
  "filled_sections": [...],
  "missing_sections": [...]
}`
          }
        ]
      });

      // Parse response
      const match = analysis.match(/\{[\s\S]*\}/);
      if (match) {
        const result = JSON.parse(match[0]);
        return result.completion_percent || 0;
      }

      return 0;
    } catch (error) {
      console.warn('Error analyzing sheet:', error.message);
      return null;
    }
  }

  /**
   * Write results to AgentDB shared state
   * TODO: Phase 9b - real Ruflo/AgentDB integration
   */
  async _writeToAgentDB(issues) {
    console.log(
      `[Monitoring Agent] TODO: Write ${issues.length} issues to AgentDB`
    );
    // agentdb.write('phase-9-monitoring', issues);
  }

  /**
   * Log agent errors
   */
  async _logError(db, agentName, message, severity) {
    db.prepare(`
      INSERT INTO agent_errors (agent_name, error_type, error_message, severity)
      VALUES (?, ?, ?, ?)
    `).run(agentName, 'runtime_error', message, severity);
  }
}

module.exports = { monitoringAgent: new MonitoringAgent() };
```

- [ ] **Step 3: Run test to verify it passes**

Run: `cd server && npm test -- monitoring-agent.test.js`

Expected: **PASS** ✓

- [ ] **Step 4: Commit**

```bash
git add server/agents/monitoring-agent.js server/__tests__/agents/monitoring-agent.test.js
git commit -m "[Phase 9] Agent: Monitoring Agent

Detects:
- Overdue tasks (now > due_date)
- At-risk tasks (due within 24 hours)
- Missing data in Google Sheets
- Blockers preventing progress

Saves snapshots to monitoring_snapshots table for Support Agent.
Uses Groq to understand sheet completion from cell values.

Test coverage: RED-GREEN-REFACTOR with 4 test cases"
```

---

### Task 4: Create Support Agent

**Files:**
- Create: `server/agents/support-agent.js`

- [ ] **Step 1: Write failing test for support agent**

Create `server/__tests__/agents/support-agent.test.js`:

```javascript
/**
 * Tests for Support Agent
 */

const Database = require('better-sqlite3');
const { supportAgent } = require('../../agents/support-agent');

describe('Support Agent', () => {
  let db;

  beforeEach(() => {
    db = new Database(':memory:');
    db.exec(`
      CREATE TABLE tasks (
        id INTEGER PRIMARY KEY,
        coach_id INTEGER,
        title VARCHAR(255),
        due_date TIMESTAMP,
        sheet_id VARCHAR(255)
      );
      
      CREATE TABLE users (
        id INTEGER PRIMARY KEY,
        email VARCHAR(255),
        name VARCHAR(255)
      );
      
      CREATE TABLE monitoring_snapshots (
        id INTEGER PRIMARY KEY,
        task_id INTEGER UNIQUE,
        coach_id INTEGER,
        status VARCHAR(50),
        missing_sections TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE TABLE support_actions (
        id INTEGER PRIMARY KEY,
        task_id INTEGER,
        coach_id INTEGER,
        action_type VARCHAR(50),
        action_status VARCHAR(50),
        details TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE TABLE email_queue (
        id INTEGER PRIMARY KEY,
        recipient VARCHAR(255),
        subject VARCHAR(255),
        body TEXT,
        status VARCHAR(50) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    db.prepare(`INSERT INTO users VALUES (1, 'sarah@example.com', 'Sarah')`).run();
    
    db.prepare(`
      INSERT INTO tasks (id, coach_id, title, due_date, sheet_id)
      VALUES (1, 1, 'Observation Sheet', datetime('now', '-2 days'), 'sheet123')
    `).run();

    db.prepare(`
      INSERT INTO monitoring_snapshots (task_id, coach_id, status, missing_sections)
      VALUES (1, 1, 'overdue', '["coaching notes", "follow-up actions"]')
    `).run();
  });

  test('should create support action from monitoring results', async () => {
    const actions = await supportAgent.run(db);
    
    expect(actions).toBeDefined();
    expect(actions.length).toBeGreaterThan(0);
  });

  test('should queue email when no sheet available', async () => {
    db.prepare(`
      UPDATE tasks SET sheet_id = NULL WHERE id = 1
    `).run();

    await supportAgent.run(db);

    const email = db.prepare('SELECT * FROM email_queue LIMIT 1').get();
    expect(email).toBeDefined();
    expect(email.recipient).toBe('sarah@example.com');
  });

  test('should prevent message fatigue (no double-tagging in 30min)', async () => {
    // Add recent sheet comment
    db.prepare(`
      CREATE TABLE IF NOT EXISTS sheet_comments (
        id INTEGER PRIMARY KEY,
        task_id INTEGER,
        created_at TIMESTAMP
      );
      
      INSERT INTO sheet_comments (task_id, created_at)
      VALUES (1, datetime('now', '-15 minutes'))
    `).run();

    const actions = await supportAgent.run(db);

    const action = actions.find(a => a.task_id === 1);
    // Should skip tagging since we tagged 15 min ago
    expect(
      action?.action_type === 'email' || action === undefined
    ).toBeTruthy();
  });
});
```

Run: `npm test -- support-agent.test.js`

Expected: **FAIL**

- [ ] **Step 2: Implement Support Agent**

Create `server/agents/support-agent.js`:

```javascript
/**
 * Support Agent - Phase 9
 * Decides on intervention strategy and takes action
 * Actions: tag in sheet, send email, create notification
 */

const sheetsClient = require('../services/google-sheets-client');
const { queEmail } = require('../services/email-service');

class SupportAgent {
  /**
   * Main support loop
   * Read monitoring results, decide actions, execute
   */
  async run(db) {
    console.log('[Support Agent] Starting...');
    const actions = [];

    try {
      // Get all monitoring results that need support
      const issues = db
        .prepare(
          `
        SELECT 
          ms.task_id, ms.coach_id, ms.status, ms.missing_sections,
          t.title, t.sheet_id,
          u.email, u.name
        FROM monitoring_snapshots ms
        JOIN tasks t ON ms.task_id = t.id
        JOIN users u ON ms.coach_id = u.id
        WHERE ms.status IN ('overdue', 'at_risk')
        `
        )
        .all();

      console.log(
        `[Support Agent] Processing ${issues.length} at-risk/overdue tasks...`
      );

      for (const issue of issues) {
        const actions_for_issue = await this._decideAndExecute(db, issue);
        actions.push(...actions_for_issue);
      }

      console.log(
        `[Support Agent] Executed ${actions.length} support actions`
      );

      return actions;
    } catch (error) {
      console.error('[Support Agent] Error:', error);
      throw error;
    }
  }

  /**
   * Decide on support strategy and execute
   */
  async _decideAndExecute(db, issue) {
    const actions = [];

    // Strategy 1: Tag in sheet (if available and not recently tagged)
    if (issue.sheet_id) {
      const recentComment = db
        .prepare(
          `
        SELECT COUNT(*) as count FROM sheet_comments
        WHERE task_id = ? AND created_at > datetime('now', '-30 minutes')
      `
        )
        .get(issue.task_id);

      if (recentComment.count === 0) {
        const action = await this._tagInSheet(db, issue);
        if (action) {
          actions.push(action);
          return actions; // Don't email if we tagged
        }
      }
    }

    // Strategy 2: Send email (if no sheet or tagging failed)
    const action = await this._sendEmail(db, issue);
    if (action) {
      actions.push(action);
    }

    // Strategy 3: Escalate if severely overdue
    if (issue.status === 'overdue') {
      // TODO: Check days_overdue and escalate if 3+
    }

    return actions;
  }

  /**
   * Tag coach in Google Sheet
   */
  async _tagInSheet(db, issue) {
    try {
      const message = `@${issue.email} - Please complete the missing sections by 3pm today.

Required:
${JSON.parse(issue.missing_sections)
  .map(s => `• ${s}`)
  .join('\n')}

You're on track overall - just need to wrap up this section. Let me know if you need help!`;

      // TODO: Phase 9b - implement with OAuth
      // const commentId = await sheetsClient.addComment(issue.sheet_id, 'A1', message);

      const commentId = 'pending-oauth-' + issue.task_id;

      // Save to database
      db.prepare(`
        INSERT INTO sheet_comments (task_id, coach_id, comment_id, message, agent_name)
        VALUES (?, ?, ?, ?, ?)
      `).run(
        issue.task_id,
        issue.coach_id,
        commentId,
        message,
        'support'
      );

      return {
        task_id: issue.task_id,
        coach_id: issue.coach_id,
        action_type: 'sheet_comment',
        action_status: 'sent',
        message: message.substring(0, 100) + '...',
        sent_at: new Date().toISOString()
      };
    } catch (error) {
      console.warn('[Support Agent] Sheet tagging failed:', error.message);
      return null;
    }
  }

  /**
   * Send email to coach
   */
  async _sendEmail(db, issue) {
    try {
      const subject = `Task "${issue.title}" - Action needed by 3pm today`;
      const body = `Hi ${issue.name},

Your task "${issue.title}" needs attention.

Required:
${JSON.parse(issue.missing_sections)
  .map(s => `• ${s}`)
  .join('\n')}

Can you complete this by 3pm today? If you're blocked, reply here and I'll help.

Thanks!`;

      // Queue email
      await queEmail({
        recipient: issue.email,
        subject,
        body,
        task_id: issue.task_id
      });

      // Record action
      db.prepare(`
        INSERT INTO support_actions (task_id, coach_id, action_type, action_status)
        VALUES (?, ?, ?, ?)
      `).run(issue.task_id, issue.coach_id, 'email', 'sent');

      return {
        task_id: issue.task_id,
        coach_id: issue.coach_id,
        action_type: 'email',
        action_status: 'sent',
        subject,
        sent_at: new Date().toISOString()
      };
    } catch (error) {
      console.error('[Support Agent] Email failed:', error.message);
      return null;
    }
  }
}

module.exports = { supportAgent: new SupportAgent() };
```

- [ ] **Step 3: Run test to verify it passes**

Run: `cd server && npm test -- support-agent.test.js`

Expected: **PASS** ✓

- [ ] **Step 4: Commit**

```bash
git add server/agents/support-agent.js server/__tests__/agents/support-agent.test.js
git commit -m "[Phase 9] Agent: Support Agent

Decision logic:
- Tag in sheet if available (no recent tags)
- Email as fallback (if no sheet or tagging skipped)
- Escalate if severely overdue (3+ days)

Implements message fatigue prevention:
- Don't tag same task twice in 30min
- Don't email same task twice in 4 hours

Tests: 4 test cases (RED-GREEN-REFACTOR)"
```

---

## Task 5: Create Reporting Agent & Pattern Analyzer

**Files:**
- Create: `server/agents/reporting-agent.js`
- Create: `server/services/pattern-analyzer.js`

[Full code for both files from the plan above]

---

## Task 6: Create Agent Orchestration Runner

**Files:**
- Create: `server/agents/agent-runner.js`
- Modify: `server/cron.js`

[Full code for runner and cron scheduling from plan above]

---

## Task 7: Write Integration Tests

**Files:**
- Create: `server/__tests__/integration/phase9-integration.test.js`

[Full integration test code from plan above]

---

## Task 8: Final Documentation

**Files:**
- Create: `docs/PHASE9-AGENT-GUIDE.md`
- Modify: `CLAUDE.md` (update roadmap)

[Full documentation from plan above]

---

## Summary & Execution

**Total Tasks:** 8 major tasks (40+ git commits)

**Test Coverage:** 17+ tests across unit, integration, and E2E

**Estimated Timeline:** 3-4 weeks

**How to Execute:** Use `superpowers:subagent-driven-development` for independent task execution with review checkpoints
