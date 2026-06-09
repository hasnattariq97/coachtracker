/**
 * Support Agent Tests — Phase 9 Autonomous Coaching System
 */

const SupportAgent = require('../../agents/support-agent');
const db = require('../../db');

jest.mock('../../services/google-sheets-client');
jest.mock('../../db');

describe('SupportAgent', () => {
  let agent;

  beforeEach(() => {
    agent = new SupportAgent();
    jest.clearAllMocks();
  });

  describe('initialization', () => {
    test('initializes with correct name', () => {
      expect(agent.name).toBe('SupportAgent');
    });

    test('sets correct fatigue prevention thresholds', () => {
      expect(agent.TAG_FATIGUE_WINDOW_MINUTES).toBe(30);
      expect(agent.EMAIL_FATIGUE_WINDOW_HOURS).toBe(4);
    });
  });

  describe('run()', () => {
    test('processes all snapshots and returns action count', async () => {
      db.query.mockResolvedValue({
        rows: [
          {
            id: 1,
            task_id: 1,
            coach_id: 1,
            sheet_id: null,
            sheet_completion_percent: 0,
            status: 'on_time',
            days_remaining: 5,
            coach_pattern: 'steady',
            blockers: '[]',
            missing_sections: '[]'
          },
        ],
      });

      const result = await agent.run();
      expect(result.analyzedSnapshots).toBe(1);
      expect(typeof result.actionsDecided).toBe('number');
      expect(Array.isArray(result.actions)).toBe(true);
    });

    test('handles empty snapshot list gracefully', async () => {
      db.query.mockResolvedValue({ rows: [] });

      const result = await agent.run();
      expect(result.analyzedSnapshots).toBe(0);
      expect(result.actionsDecided).toBe(0);
    });

    test('logs critical error on failure', async () => {
      db.query.mockRejectedValue(new Error('Database error'));

      await expect(agent.run()).rejects.toThrow('Database error');
    });
  });

  describe('_decideIntervention()', () => {
    test('returns null action for on-time steady coach', async () => {
      const snapshot = {
        task_id: 1,
        coach_id: 1,
        status: 'on_time',
        days_remaining: 10,
        coach_pattern: 'steady',
        blockers: '[]',
        missing_sections: '[]',
      };

      const intervention = await agent._decideIntervention(snapshot);
      expect(intervention.action).toBeNull();
      expect(intervention.reason).toContain('No intervention needed');
    });

    test('returns null action for on-time fast-track coach', async () => {
      const snapshot = {
        task_id: 1,
        coach_id: 1,
        status: 'on_time',
        days_remaining: 10,
        coach_pattern: 'fast-track',
        blockers: '[]',
        missing_sections: '[]',
      };

      const intervention = await agent._decideIntervention(snapshot);
      expect(intervention.action).toBeNull();
    });

    test('escalates overdue procrastinator', async () => {
      const snapshot = {
        task_id: 1,
        coach_id: 1,
        status: 'overdue',
        days_remaining: -2,
        coach_pattern: 'procrastinator',
        blockers: '[]',
        missing_sections: '[]',
      };

      const intervention = await agent._decideIntervention(snapshot);
      expect(intervention.action).toBe('escalate');
      expect(intervention.details.severity).toBe('high');
    });

    test('emails overdue non-procrastinator', async () => {
      db.query.mockResolvedValue({ rows: [] }); // No recent action

      const snapshot = {
        task_id: 1,
        coach_id: 1,
        status: 'overdue',
        days_remaining: -2,
        coach_pattern: 'steady',
        blockers: '[]',
        missing_sections: '[]',
      };

      const intervention = await agent._decideIntervention(snapshot);
      expect(intervention.action).toBe('email');
      expect(intervention.details.tone).toBe('supportive');
    });

    test('tags at-risk task with blockers', async () => {
      db.query.mockResolvedValue({ rows: [] }); // No recent action

      const snapshot = {
        task_id: 1,
        coach_id: 1,
        status: 'at_risk',
        days_remaining: 2,
        coach_pattern: 'steady',
        blockers: '["Task blocked by legal review", "Waiting for approval"]',
        missing_sections: '[]',
      };

      const intervention = await agent._decideIntervention(snapshot);
      expect(intervention.action).toBe('tag');
      expect(intervention.reason).toContain('blockers');
    });

    test('emails procrastinator with <3 days remaining', async () => {
      db.query.mockResolvedValue({ rows: [] }); // No recent action

      const snapshot = {
        task_id: 1,
        coach_id: 1,
        status: 'at_risk',
        days_remaining: 2,
        coach_pattern: 'procrastinator',
        blockers: '[]',
        missing_sections: '[]',
      };

      const intervention = await agent._decideIntervention(snapshot);
      expect(intervention.action).toBe('email');
      expect(intervention.details.tone).toBe('encouraging');
    });

    test('tags at-risk task without blockers', async () => {
      db.query.mockResolvedValue({ rows: [] }); // No recent action

      const snapshot = {
        task_id: 1,
        coach_id: 1,
        status: 'at_risk',
        days_remaining: 5,
        coach_pattern: 'steady',
        blockers: '[]',
        missing_sections: '[]',
      };

      const intervention = await agent._decideIntervention(snapshot);
      expect(intervention.action).toBe('tag');
      expect(intervention.reason).toContain('at-risk');
    });
  });

  describe('fatigue prevention', () => {
    test('skips tag if tagged within 30 minutes', async () => {
      // First we need to handle the decision tree query, then the fatigue check
      db.query.mockResolvedValue({ rows: [{ minutes_ago: 5 }] }); // Recent tag

      agent._checkRecentAction = jest.fn().mockResolvedValue({ minutes: 5, hours: '0.08' });

      const snapshot = {
        task_id: 1,
        coach_id: 1,
        status: 'at_risk',
        days_remaining: 2,
        coach_pattern: 'steady',
        blockers: '[]',
        missing_sections: '[]',
      };

      const intervention = await agent._decideIntervention(snapshot);
      expect(intervention.action).toBeNull();
      expect(intervention.reason).toContain('Already tagged');
    });

    test('skips email if emailed within 4 hours', async () => {
      agent._checkRecentAction = jest.fn().mockResolvedValue({ minutes: 120, hours: '2.0' }); // 2 hours ago

      const snapshot = {
        task_id: 1,
        coach_id: 1,
        status: 'overdue',
        days_remaining: -2,
        coach_pattern: 'steady',
        blockers: '[]',
        missing_sections: '[]',
      };

      const intervention = await agent._decideIntervention(snapshot);
      expect(intervention.action).toBeNull();
      expect(intervention.reason).toContain('Already emailed');
    });

    test('allows action if previous action is old enough', async () => {
      agent._checkRecentAction = jest.fn().mockResolvedValue(null); // No recent action or too old

      const snapshot = {
        task_id: 1,
        coach_id: 1,
        status: 'at_risk',
        days_remaining: 2,
        coach_pattern: 'steady',
        blockers: '[]',
        missing_sections: '[]',
      };

      const intervention = await agent._decideIntervention(snapshot);
      expect(intervention.action).toBe('tag');
    });
  });

  describe('_checkRecentAction()', () => {
    test('returns minutes and hours for recent action within window', async () => {
      db.query.mockResolvedValue({ rows: [{ minutes_ago: 10 }] });

      const result = await agent._checkRecentAction(1, 'tag', 30);
      expect(result).not.toBeNull();
      expect(result.minutes).toBe(10);
      expect(result.hours).toBe('0.2');
    });

    test('returns null if no recent action', async () => {
      db.query.mockResolvedValue({ rows: [] });

      const result = await agent._checkRecentAction(1, 'tag', 30);
      expect(result).toBeNull();
    });

    test('returns null if action is old enough (outside window)', async () => {
      // 50 minutes ago with 30 minute window = action is old enough
      db.query.mockResolvedValue({ rows: [{ minutes_ago: 50 }] });

      const result = await agent._checkRecentAction(1, 'tag', 30);
      expect(result).toBeNull(); // 50 > 30, so it's old enough
    });

    test('handles database error gracefully', async () => {
      db.query.mockRejectedValue(new Error('Database error'));

      const result = await agent._checkRecentAction(1, 'tag', 30);
      expect(result).toBeNull(); // Fail open
    });
  });

  describe('_executeIntervention()', () => {
    test('skips execution if action is null', async () => {
      const intervention = {
        taskId: 1,
        coachId: 1,
        action: null,
        reason: 'No action needed',
        details: {},
      };

      await agent._executeIntervention(intervention);
      // Should not throw or call anything
      expect(db.query).not.toHaveBeenCalled();
    });

    test('queues email for email action', async () => {
      db.query.mockResolvedValue({ rowCount: 1, rows: [{ id: 1 }] });

      const intervention = {
        taskId: 1,
        coachId: 1,
        action: 'email',
        reason: 'Overdue task',
        details: { subject: 'Help needed', tone: 'supportive' },
      };

      await agent._executeIntervention(intervention);
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('email_queue'),
        expect.arrayContaining([1, 'support', 1, 'pending'])
      );
    });

    test('logs support action to database', async () => {
      db.query.mockResolvedValue({ rowCount: 1, rows: [{ id: 1 }] });

      const intervention = {
        taskId: 1,
        coachId: 1,
        action: 'email',
        reason: 'Overdue task',
        details: { subject: 'Help needed' },
      };

      await agent._executeIntervention(intervention);
      // Should have 2 calls: one for email queue, one for support_actions logging
      expect(db.query).toHaveBeenCalledTimes(2);
    });

    test('handles execution errors gracefully', async () => {
      db.query.mockRejectedValue(new Error('Database error'));

      const intervention = {
        taskId: 1,
        coachId: 1,
        action: 'email',
        reason: 'Overdue',
        details: {},
      };

      await agent._executeIntervention(intervention);
      // Should log error but not throw
      expect(db.query).toHaveBeenCalled();
    });
  });

  describe('_tagInSheet()', () => {
    test('returns gracefully if no sheet attached', async () => {
      db.query.mockResolvedValue({ rows: [] });
      agent.sheetsClient = { addComment: jest.fn() };

      await agent._tagInSheet(1, 'Test message');
      expect(agent.sheetsClient.addComment).not.toHaveBeenCalled();
    });

    test('skips if sheetsClient not initialized', async () => {
      agent.sheetsClient = null;

      await agent._tagInSheet(1, 'Test message');
      // Should return gracefully
      expect(db.query).not.toHaveBeenCalled();
    });
  });

  describe('_logAgentError()', () => {
    test('logs error to database with correct parameters', async () => {
      db.query.mockResolvedValue({ rowCount: 1 });

      await agent._logAgentError('test_error', 'Test message', 'high');
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('agent_errors'),
        ['SupportAgent', 'test_error', 'Test message', 'high']
      );
    });

    test('uses default severity if not provided', async () => {
      db.query.mockResolvedValue({ rowCount: 1 });

      await agent._logAgentError('test_error', 'Test message');
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('agent_errors'),
        ['SupportAgent', 'test_error', 'Test message', 'medium']
      );
    });

    test('handles logging errors gracefully', async () => {
      db.query.mockRejectedValue(new Error('Logging failed'));

      await agent._logAgentError('test_error', 'Test message');
      // Should not throw
      expect(db.query).toHaveBeenCalled();
    });
  });

  describe('blocker parsing', () => {
    test('handles string JSON blockers', async () => {
      db.query.mockResolvedValue({ rows: [] });

      const snapshot = {
        task_id: 1,
        coach_id: 1,
        status: 'at_risk',
        days_remaining: 2,
        coach_pattern: 'steady',
        blockers: '["Blocked by legal", "Waiting for approval"]',
        missing_sections: '[]',
      };

      const intervention = await agent._decideIntervention(snapshot);
      expect(intervention.action).toBe('tag');
    });

    test('handles array blockers', async () => {
      db.query.mockResolvedValue({ rows: [] });

      const snapshot = {
        task_id: 1,
        coach_id: 1,
        status: 'at_risk',
        days_remaining: 2,
        coach_pattern: 'steady',
        blockers: ['Blocked by legal'],
        missing_sections: '[]',
      };

      const intervention = await agent._decideIntervention(snapshot);
      expect(intervention.action).toBe('tag');
    });
  });
});
