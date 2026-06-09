/**
 * @phase 9
 * @status active
 * @owner phase-builder
 * @last_updated 2026-06-09T00:00:00Z
 */

const ReportingAgent = require('../../agents/reporting-agent');
const PatternAnalyzer = require('../../services/pattern-analyzer');

// Mock db module
jest.mock('../../db', () => ({
  query: jest.fn(),
}));

const db = require('../../db');

describe('ReportingAgent', () => {
  let agent;

  beforeEach(() => {
    agent = new ReportingAgent();
    jest.clearAllMocks();
  });

  describe('initialization', () => {
    test('initializes with correct name', () => {
      expect(agent.name).toBe('ReportingAgent');
    });

    test('initializes with db instance', () => {
      expect(agent.db).toBeDefined();
    });
  });

  describe('run()', () => {
    test('run() completes full reporting cycle', async () => {
      // Mock PatternAnalyzer
      jest.spyOn(PatternAnalyzer, 'analyze24HourActions').mockResolvedValue({
        supportActions: [
          { id: 1, action_type: 'tag', details: '{"message":"blocked"}' },
        ],
        completionRate: 85,
        commonBlockers: [{ blocker: 'blocked', count: 3 }],
        coachPerformance: [
          { coachId: 1, completionRate: 90, completed: 9, total: 10 },
        ],
      });

      jest.spyOn(PatternAnalyzer, 'generateRecommendations').mockResolvedValue([
        '🎯 Strong completion rate!',
      ]);

      // Mock admin user query
      db.query.mockResolvedValueOnce({
        rows: [{ id: 1, email: 'admin@tracker.com' }],
      });

      // Mock email queue insert
      db.query.mockResolvedValueOnce({ rowCount: 1, rows: [] });

      // Mock daily_reports insert
      db.query.mockResolvedValueOnce({ rowCount: 1, rows: [] });

      const result = await agent.run();

      expect(result.completionRate).toBe(85);
      expect(result.archived).toBe(true);
      expect(result.recommendations).toHaveLength(1);
    });

    test('run() handles errors gracefully', async () => {
      jest
        .spyOn(PatternAnalyzer, 'analyze24HourActions')
        .mockRejectedValueOnce(new Error('DB error'));

      jest.spyOn(agent, '_logAgentError').mockResolvedValue(undefined);

      await expect(agent.run()).rejects.toThrow();
      expect(agent._logAgentError).toHaveBeenCalledWith(
        'run_failed',
        'DB error',
        'critical'
      );
    });
  });

  describe('_generateEmailHTML()', () => {
    test('generates valid HTML with patterns', () => {
      const patterns = {
        supportActions: [{ action_type: 'tag' }],
        completionRate: 85,
        commonBlockers: [{ blocker: 'blocked', count: 2 }],
        coachPerformance: [
          { coachId: 1, completionRate: 90, completed: 9, total: 10 },
        ],
      };

      const html = agent._generateEmailHTML(patterns, ['Recommendation 1']);

      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('Daily Coaching Report');
      expect(html).toContain('85%');
      expect(html).toContain('🚫 Blocked');
      expect(html).toContain('Recommendation 1');
    });

    test('generates HTML with no blockers', () => {
      const patterns = {
        supportActions: [],
        completionRate: 75,
        commonBlockers: [],
        coachPerformance: [],
      };

      const html = agent._generateEmailHTML(patterns, []);

      expect(html).toContain('No blockers detected');
      expect(html).toContain('No data available');
    });

    test('generates HTML with multiple coaches', () => {
      const patterns = {
        supportActions: [],
        completionRate: 80,
        commonBlockers: [],
        coachPerformance: [
          { coachId: 1, completionRate: 95, completed: 10, total: 10 },
          { coachId: 2, completionRate: 85, completed: 8, total: 9 },
          { coachId: 3, completionRate: 70, completed: 7, total: 10 },
        ],
      };

      const html = agent._generateEmailHTML(patterns, []);

      expect(html).toContain('Coach 1');
      expect(html).toContain('Coach 2');
      expect(html).toContain('Coach 3');
    });
  });

  describe('_formatBlocker()', () => {
    test('formats known blockers with emojis', () => {
      expect(agent._formatBlocker('blocked')).toBe('🚫 Blocked');
      expect(agent._formatBlocker('stuck')).toBe('🔧 Stuck');
      expect(agent._formatBlocker('dependency')).toBe('🔗 Dependency');
      expect(agent._formatBlocker('approval')).toBe('✋ Approval');
      expect(agent._formatBlocker('clarification')).toBe('❓ Clarification');
    });

    test('returns original blocker name if not recognized', () => {
      expect(agent._formatBlocker('unknown')).toBe('unknown');
    });
  });

  describe('_queueReportEmail()', () => {
    test('finds admin and queues email', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ id: 1, email: 'admin@tracker.com' }],
      });
      db.query.mockResolvedValueOnce({ rowCount: 1, rows: [] });

      await agent._queueReportEmail('<html>Report</html>');

      expect(db.query).toHaveBeenCalledTimes(2);
      // First call: fetch admin
      const firstCall = db.query.mock.calls[0];
      expect(firstCall[0]).toContain('users');
      // Second call: insert email queue
      const secondCall = db.query.mock.calls[1];
      expect(secondCall[0]).toContain('email_queue');
    });

    test('throws error if no admin found', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      await expect(agent._queueReportEmail('<html>Report</html>')).rejects.toThrow(
        'No admin user found'
      );
    });

    test('throws error if queue insert fails', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ id: 1, email: 'admin@tracker.com' }],
      });
      db.query.mockRejectedValueOnce(new Error('Insert failed'));

      await expect(agent._queueReportEmail('<html>Report</html>')).rejects.toThrow(
        'Queue email failed'
      );
    });
  });

  describe('_archiveReport()', () => {
    test('saves report to daily_reports table', async () => {
      db.query.mockResolvedValueOnce({ rowCount: 1, rows: [] });

      const patterns = {
        supportActions: [],
        completionRate: 85,
        commonBlockers: [],
        coachPerformance: [],
      };

      await agent._archiveReport(patterns, ['Recommendation']);

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('daily_reports'),
        expect.any(Array)
      );
    });

    test('includes all pattern data in archive', async () => {
      db.query.mockResolvedValueOnce({ rowCount: 1, rows: [] });

      const patterns = {
        supportActions: [{ id: 1 }],
        completionRate: 75,
        commonBlockers: [{ blocker: 'stuck', count: 1 }],
        coachPerformance: [{ coachId: 1, completionRate: 80 }],
      };

      const recommendations = ['Rec 1', 'Rec 2'];

      await agent._archiveReport(patterns, recommendations);

      const callArgs = db.query.mock.calls[0];
      const [sql, params] = callArgs;

      expect(params[1]).toContain('75'); // completionRate
      expect(params[2]).toContain('stuck'); // blocker
      expect(params[3]).toContain('Rec 1'); // recommendation
    });

    test('handles archive errors gracefully', async () => {
      db.query.mockRejectedValueOnce(new Error('Archive failed'));

      jest.spyOn(agent, '_logAgentError').mockResolvedValue(undefined);

      const patterns = {
        supportActions: [],
        completionRate: 85,
        commonBlockers: [],
        coachPerformance: [],
      };

      await expect(agent._archiveReport(patterns, [])).rejects.toThrow(
        'Archive failed'
      );
    });
  });

  describe('_logAgentError()', () => {
    test('logs error to agent_errors table', async () => {
      db.query.mockResolvedValueOnce({ rowCount: 1, rows: [] });

      await agent._logAgentError('test_error', 'Error message', 'high');

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('agent_errors'),
        [agent.name, 'test_error', 'Error message', 'high']
      );
    });

    test('logs with default severity', async () => {
      db.query.mockResolvedValueOnce({ rowCount: 1, rows: [] });

      await agent._logAgentError('test_error', 'Error message');

      expect(db.query).toHaveBeenCalledWith(
        expect.any(String),
        [agent.name, 'test_error', 'Error message', 'medium']
      );
    });

    test('handles logging errors silently', async () => {
      db.query.mockRejectedValueOnce(new Error('Logging failed'));

      // Should not throw
      await expect(
        agent._logAgentError('test_error', 'Error message')
      ).resolves.toBeUndefined();
    });
  });
});
