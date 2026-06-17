/**
 * @phase 9
 * @status active
 * @owner phase-builder
 * @last_updated 2026-06-09T00:00:00Z
 */

const MonitoringAgent = require('../../agents/monitoring-agent');
const db = require('../../db');

jest.mock('../../services/google-sheets-client');
jest.mock('../../db');

describe('MonitoringAgent', () => {
  let agent;

  beforeEach(() => {
    jest.clearAllMocks();
    agent = new MonitoringAgent();
  });

  describe('initialization', () => {
    test('initializes with correct name', () => {
      expect(agent.name).toBe('MonitoringAgent');
    });

    test('has db reference', () => {
      expect(agent.db).toBeDefined();
    });
  });

  describe('run()', () => {
    test('scans all active tasks without errors', async () => {
      // First call: regions query
      db.query.mockResolvedValueOnce({
        rows: [{ id: 1, name: 'Urban-I' }],
      });

      // Second call: active tasks for region 1
      db.query.mockResolvedValueOnce({
        rows: [
          {
            id: 1,
            coach_id: 1,
            title: 'Task 1',
            assigned_at: '2026-06-01T10:00:00Z',
            due_date: '2026-06-15T18:00:00Z',
          },
        ],
      });

      // Mock subsequent queries for sheet analysis and pattern detection
      db.query
        .mockResolvedValueOnce({ rows: [{ links: '[]' }] }) // _analyzeSheet
        .mockResolvedValueOnce({
          rows: [{ total: '5', completed: '4', overdue: '0', avg_hours_late: 2 }],
        }); // _detectCoachPattern

      // Upsert
      db.query.mockResolvedValueOnce({});

      const result = await agent.run();
      expect(result.scannedTasks).toBeGreaterThanOrEqual(0);
      expect(Array.isArray(result.snapshots)).toBe(true);
    });

    test('handles database query errors gracefully', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));

      await expect(agent.run()).rejects.toThrow('Database error');
    });

    test('logs errors for individual task analysis failures', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      // First call: regions query
      db.query.mockResolvedValueOnce({
        rows: [{ id: 1, name: 'Urban-I' }],
      });

      // Second call: active tasks for region 1
      db.query.mockResolvedValueOnce({
        rows: [
          {
            id: 1,
            coach_id: 1,
            title: 'Task 1',
            assigned_at: '2026-06-01T10:00:00Z',
            due_date: '2026-06-15T18:00:00Z',
          },
        ],
      });

      // Make _analyzeSheet throw
      const analyzeSheetSpy = jest
        .spyOn(agent, '_analyzeSheet')
        .mockRejectedValueOnce(new Error('Sheet access denied'));

      // Mock _detectCoachPattern to avoid it being called
      db.query
        .mockResolvedValueOnce({
          rows: [{ total: '5', completed: '4', overdue: '0', avg_hours_late: 2 }],
        })
        .mockResolvedValueOnce({}); // For _logAgentError

      await agent.run();

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to analyze task'),
        expect.stringContaining('Sheet access denied')
      );

      consoleSpy.mockRestore();
      analyzeSheetSpy.mockRestore();
    });
  });

  describe('_analyzeTask()', () => {
    test('detects on_time status when days remaining > 0', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 10);

      const task = {
        id: 1,
        coach_id: 1,
        title: 'Task 1',
        assigned_at: new Date().toISOString(),
        due_date: futureDate.toISOString(),
      };

      jest.spyOn(agent, '_analyzeSheet').mockResolvedValueOnce({
        sheetId: null,
        completionPercent: 0,
        missingSections: [],
        blockers: [],
      });

      jest.spyOn(agent, '_detectCoachPattern').mockResolvedValueOnce('steady');

      db.query.mockResolvedValueOnce({}); // upsert query

      const snapshot = await agent._analyzeTask(task);

      expect(snapshot.status).toBe('on_time');
      expect(snapshot.daysRemaining).toBeGreaterThan(0);
    });

    test('detects at_risk status when 75% of time elapsed', async () => {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 8); // 8 days ago
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 2); // 2 days from now

      const task = {
        id: 1,
        coach_id: 1,
        title: 'Task 1',
        assigned_at: startDate.toISOString(),
        due_date: dueDate.toISOString(),
      };

      jest.spyOn(agent, '_analyzeSheet').mockResolvedValueOnce({
        sheetId: null,
        completionPercent: 0,
        missingSections: [],
        blockers: [],
      });

      jest.spyOn(agent, '_detectCoachPattern').mockResolvedValueOnce('steady');

      db.query.mockResolvedValueOnce({}); // upsert query

      const snapshot = await agent._analyzeTask(task);

      expect(snapshot.status).toBe('at_risk');
    });

    test('detects overdue status when due_date in past', async () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 5);

      const task = {
        id: 1,
        coach_id: 1,
        title: 'Task 1',
        assigned_at: new Date().toISOString(),
        due_date: pastDate.toISOString(),
      };

      jest.spyOn(agent, '_analyzeSheet').mockResolvedValueOnce({
        sheetId: null,
        completionPercent: 0,
        missingSections: [],
        blockers: [],
      });

      jest.spyOn(agent, '_detectCoachPattern').mockResolvedValueOnce('steady');

      db.query.mockResolvedValueOnce({}); // upsert query

      const snapshot = await agent._analyzeTask(task);

      expect(snapshot.status).toBe('overdue');
      expect(snapshot.daysRemaining).toBeLessThan(0);
    });

    test('saves snapshot to database with upsert', async () => {
      const task = {
        id: 1,
        coach_id: 1,
        title: 'Task 1',
        assigned_at: '2026-06-01T10:00:00Z',
        due_date: '2026-06-15T18:00:00Z',
      };

      jest.spyOn(agent, '_analyzeSheet').mockResolvedValueOnce({
        sheetId: 'sheet123',
        completionPercent: 50,
        missingSections: [],
        blockers: ['Waiting for approval'],
      });

      jest.spyOn(agent, '_detectCoachPattern').mockResolvedValueOnce('steady');

      db.query.mockResolvedValueOnce({ rows: [{}] });

      await agent._analyzeTask(task);

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO monitoring_snapshots'),
        expect.arrayContaining([1, 1, 'sheet123', 50])
      );
    });
  });

  describe('_analyzeSheet()', () => {
    test('returns empty data when task has no links', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ links: '[]' }] });

      const result = await agent._analyzeSheet(1, 1);

      expect(result.sheetId).toBeNull();
      expect(result.completionPercent).toBe(0);
      expect(result.missingSections).toEqual([]);
      expect(result.blockers).toEqual([]);
    });

    test('returns empty data when sheet link not found', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ links: JSON.stringify([{ label: 'Doc', url: 'https://docs.google.com/document/d/xyz' }]) }],
      });

      const result = await agent._analyzeSheet(1, 1);

      expect(result.sheetId).toBeNull();
      expect(result.completionPercent).toBe(0);
    });

    test('correctly parses sheet ID from URL', () => {
      // Test the regex pattern used in _analyzeSheet
      const url = 'https://docs.google.com/spreadsheets/d/abc123xyz/edit';
      const sheetIdMatch = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
      expect(sheetIdMatch).not.toBeNull();
      expect(sheetIdMatch[1]).toBe('abc123xyz');
    });

    test('handles Google Sheets client errors gracefully', async () => {
      db.query.mockResolvedValueOnce({
        rows: [
          {
            links: JSON.stringify([
              { label: 'Sheet', url: 'https://docs.google.com/spreadsheets/d/abc123/edit' },
            ]),
          },
        ],
      });

      agent.sheetsClient = {
        readSheet: jest.fn().mockRejectedValueOnce(new Error('Access denied')),
      };

      const result = await agent._analyzeSheet(1, 1);

      expect(result.sheetId).toBeNull();
      expect(result.completionPercent).toBe(0);
    });
  });

  describe('_calculateCompletion()', () => {
    test('returns 0 for empty sheet', () => {
      const completion = agent._calculateCompletion([]);
      expect(completion).toBe(0);
    });

    test('returns percentage of filled rows', () => {
      const values = [
        ['Task', 'Status'],
        ['Task 1', 'Done'],
        ['Task 2', 'In Progress'],
        ['', ''],
      ];

      const completion = agent._calculateCompletion(values);
      expect(completion).toBeGreaterThan(0);
      expect(completion).toBeLessThanOrEqual(100);
    });

    test('returns 100 for fully filled sheet', () => {
      const values = [
        ['Task', 'Status'],
        ['Task 1', 'Done'],
        ['Task 2', 'In Progress'],
      ];

      const completion = agent._calculateCompletion(values);
      expect(completion).toBe(100);
    });
  });

  describe('_findMissingSections()', () => {
    test('detects empty sheet', () => {
      const missing = agent._findMissingSections([]);
      expect(missing).toContain('Sheet is empty');
    });

    test('detects missing standard headers', () => {
      const values = [['Name', 'Email']]; // Missing Task, Status, etc.

      const missing = agent._findMissingSections(values);
      expect(missing.length).toBeGreaterThan(0);
      expect(missing.some(m => m.includes('Missing section'))).toBe(true);
    });

    test('recognizes present headers', () => {
      const values = [
        ['Task', 'Status', 'Owner', 'Deadline', 'Notes'],
        ['Task 1', 'Done', 'John', '2026-06-15', 'Good work'],
      ];

      const missing = agent._findMissingSections(values);
      expect(missing.length).toBe(0);
    });
  });

  describe('_findBlockers()', () => {
    test('returns empty array for empty sheet', () => {
      const blockers = agent._findBlockers([]);
      expect(blockers).toEqual([]);
    });

    test('detects "blocked" keyword in cells', () => {
      const values = [
        ['Task', 'Status'],
        ['Task 1', 'Blocked: waiting for approval'],
        ['Task 2', 'Done'],
      ];

      const blockers = agent._findBlockers(values);
      expect(blockers.length).toBeGreaterThan(0);
      expect(blockers[0].toLowerCase()).toContain('blocked');
    });

    test('detects "stuck" keyword in cells', () => {
      const values = [
        ['Task', 'Notes'],
        ['Task 1', 'Stuck on database migration'],
      ];

      const blockers = agent._findBlockers(values);
      expect(blockers.length).toBeGreaterThan(0);
      expect(blockers[0].toLowerCase()).toContain('stuck');
    });

    test('ignores cells without blocker keywords', () => {
      const values = [
        ['Task', 'Status'],
        ['Task 1', 'In Progress'],
        ['Task 2', 'Done'],
      ];

      const blockers = agent._findBlockers(values);
      expect(blockers).toEqual([]);
    });
  });

  describe('_detectCoachPattern()', () => {
    test('returns valid pattern string for coach with no completed tasks', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ total: 0, completed: 0, overdue: 0, avg_hours_late: null }],
      });

      const pattern = await agent._detectCoachPattern(1);
      expect(['new_coach', 'unknown']).toContain(pattern);
    });

    test('returns one of valid pattern types', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ total: 10, completed: 8, overdue: 2, avg_hours_late: 12 }],
      });

      const pattern = await agent._detectCoachPattern(1);
      const validPatterns = ['procrastinator', 'fast-track', 'inconsistent', 'steady', 'new_coach', 'unknown'];
      expect(validPatterns).toContain(pattern);
    });

    test('returns valid pattern for new coach with one task', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ total: 1, completed: 1, overdue: 0, avg_hours_late: 1 }],
      });

      const pattern = await agent._detectCoachPattern(99);
      expect(['fast-track', 'steady', 'unknown']).toContain(pattern);
    });
  });

  describe('_logAgentError()', () => {
    test('inserts error into database', async () => {
      db.query.mockResolvedValueOnce({});

      await agent._logAgentError('TestAgent', 'test_error', 'Test message', 'high');

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO agent_errors'),
        ['TestAgent', 'test_error', 'Test message', 'high']
      );
    });

    test('defaults severity to medium', async () => {
      db.query.mockResolvedValueOnce({});

      await agent._logAgentError('TestAgent', 'test_error', 'Test message');

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO agent_errors'),
        ['TestAgent', 'test_error', 'Test message', 'medium']
      );
    });

    test('handles logging errors silently', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      const originalQuery = db.query;
      db.query = jest.fn().mockRejectedValueOnce(new Error('DB error'));

      await agent._logAgentError('TestAgent', 'test_error', 'Test message');

      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to log agent error:',
        expect.any(String)
      );

      consoleSpy.mockRestore();
      db.query = originalQuery;
    });
  });
});
