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

      // Use agent.db.query spy to intercept all db calls in run()
      jest.spyOn(agent.db, 'query')
        .mockResolvedValueOnce({ rows: [] })                                   // regions → empty
        .mockResolvedValueOnce({ rows: [{ id: 99, email: 'hasnattariq97@gmail.com' }] }) // super_admin
        .mockResolvedValueOnce({ rowCount: 1, rows: [] })                      // email_queue insert
        .mockResolvedValueOnce({ rowCount: 0, rows: [] })                      // daily_reports DELETE
        .mockResolvedValueOnce({ rowCount: 1, rows: [] });                     // daily_reports INSERT

      const result = await agent.run();

      expect(result.completionRate).toBe(85);
      expect(result.archived).toBe(true);
      expect(result.recommendations).toHaveLength(1);
    });

    test('run() handles errors gracefully', async () => {
      // Bypass the regions db.query call by mocking _runForRegion and the regions fetch
      jest.spyOn(agent.db, 'query').mockResolvedValueOnce({ rows: [] }); // regions → empty

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
    test('queues email for given adminId', async () => {
      const querySpy = jest.spyOn(agent.db, 'query').mockResolvedValueOnce({ rowCount: 1, rows: [] });

      await agent._queueReportEmail('<html>Report</html>', 1);

      expect(querySpy).toHaveBeenCalledTimes(1);
      // Only call: insert email queue
      const firstCall = querySpy.mock.calls[0];
      expect(firstCall[0]).toContain('email_queue');
    });

    test('throws error if no adminId provided', async () => {
      await expect(agent._queueReportEmail('<html>Report</html>')).rejects.toThrow(
        'No admin ID provided'
      );
    });

    test('throws error if queue insert fails', async () => {
      jest.spyOn(agent.db, 'query').mockRejectedValueOnce(new Error('Insert failed'));

      await expect(agent._queueReportEmail('<html>Report</html>', 1)).rejects.toThrow(
        'Queue email failed'
      );
    });
  });

  describe('_archiveReport()', () => {
    test('saves report to daily_reports table', async () => {
      const querySpy = jest.spyOn(agent.db, 'query')
        .mockResolvedValueOnce({ rowCount: 0, rows: [] })  // DELETE existing row
        .mockResolvedValueOnce({ rowCount: 1, rows: [] }); // INSERT new row

      const patterns = {
        supportActions: [],
        completionRate: 85,
        commonBlockers: [],
        coachPerformance: [],
      };

      await agent._archiveReport(patterns, ['Recommendation']);

      expect(querySpy).toHaveBeenCalledWith(
        expect.stringContaining('daily_reports'),
        expect.any(Array)
      );
    });

    test('includes all pattern data in archive', async () => {
      const querySpy = jest.spyOn(agent.db, 'query')
        .mockResolvedValueOnce({ rowCount: 0, rows: [] })  // DELETE existing row
        .mockResolvedValueOnce({ rowCount: 1, rows: [] }); // INSERT new row

      const patterns = {
        supportActions: [{ id: 1 }],
        completionRate: 75,
        commonBlockers: [{ blocker: 'stuck', count: 1 }],
        coachPerformance: [{ coachId: 1, completionRate: 80 }],
      };

      const recommendations = ['Rec 1', 'Rec 2'];

      await agent._archiveReport(patterns, recommendations);

      // call[0] = DELETE, call[1] = INSERT — check the INSERT params
      const [sql, params] = querySpy.mock.calls[1];

      // params: [today, regionId(null), summaryJson, patternsJson, recommendationsJson, ...]
      expect(params[2]).toContain('75'); // completionRate in summary_json
      expect(params[3]).toContain('stuck'); // blocker in patterns_json
      expect(params[4]).toContain('Rec 1'); // recommendation in recommendations_json
    });

    test('handles archive errors gracefully', async () => {
      jest.spyOn(agent.db, 'query').mockRejectedValueOnce(new Error('Archive failed'));

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
      const querySpy = jest.spyOn(agent.db, 'query').mockResolvedValueOnce({ rowCount: 1, rows: [] });

      await agent._logAgentError('test_error', 'Error message', 'high');

      expect(querySpy).toHaveBeenCalledWith(
        expect.stringContaining('agent_errors'),
        [agent.name, 'test_error', 'Error message', 'high']
      );
    });

    test('logs with default severity', async () => {
      const querySpy = jest.spyOn(agent.db, 'query').mockResolvedValueOnce({ rowCount: 1, rows: [] });

      await agent._logAgentError('test_error', 'Error message');

      expect(querySpy).toHaveBeenCalledWith(
        expect.any(String),
        [agent.name, 'test_error', 'Error message', 'medium']
      );
    });

    test('handles logging errors silently', async () => {
      jest.spyOn(agent.db, 'query').mockRejectedValueOnce(new Error('Logging failed'));

      // Should not throw
      await expect(
        agent._logAgentError('test_error', 'Error message')
      ).resolves.toBeUndefined();
    });
  });
});
