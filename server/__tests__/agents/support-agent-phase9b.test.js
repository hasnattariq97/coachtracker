/**
 * Support Agent Phase 9b Tests — AI-Informed Decisions
 * Tests for GroqService integration and decision logging
 *
 * These tests verify that Support Agent properly integrates with GroqService
 * and logs decisions to the agent_decisions table.
 */

const db = require('../../db');

jest.mock('../../services/google-sheets-client');
jest.mock('../../db');

// Note: GroqService is NOT mocked here; we'll control it per-test
const SupportAgent = require('../../agents/support-agent');
const GroqService = require('../../services/groq-service');

jest.mock('../../services/groq-service');

describe('SupportAgent (Phase 9b: AI-Informed Decisions)', () => {
  let agent;

  beforeEach(() => {
    jest.restoreAllMocks();  // Restore all spies and mocks instead of clearing
    // Set default mock for db.query
    db.query = jest.fn().mockResolvedValue({ rows: [] });
    // Do NOT create agent here - create it in each test after setting up mocks
  });

  afterEach(() => {
    jest.restoreAllMocks();  // Also restore after each test to ensure clean state
  });

  describe('_logDecision() helper method', () => {
    test('inserts decision record with all required fields', async () => {
      agent = new SupportAgent();
      agent.db.query = jest.fn().mockResolvedValue({ rows: [{ id: 1 }] });

      const decisionData = {
        agent_type: 'support_agent',
        coach_id: 1,
        task_id: 1,
        groq_recommendation: 'email',
        groq_confidence: 0.85,
        groq_reasoning: 'Procrastinator pattern detected',
        final_action: 'email',
        override_reason: null,
        overridden: false,
        coach_pattern: 'procrastinator',
        task_status: 'overdue',
      };

      await agent._logDecision(decisionData);

      expect(agent.db.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO agent_decisions'),
        expect.arrayContaining([
          'support_agent',
          1,
          1,
          'email',
          0.85,
        ])
      );
    });

    test('handles logging errors gracefully', async () => {
      agent = new SupportAgent();
      agent.db.query = jest.fn().mockRejectedValue(new Error('Insert failed'));
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      const decisionData = {
        agent_type: 'support_agent',
        coach_id: 1,
        task_id: 1,
        groq_recommendation: 'email',
        groq_confidence: 0.85,
        groq_reasoning: 'Test',
        final_action: 'email',
        override_reason: null,
        overridden: false,
        coach_pattern: 'steady',
        task_status: 'at_risk',
      };

      // Should not throw
      await expect(agent._logDecision(decisionData)).resolves.toBeUndefined();

      consoleErrorSpy.mockRestore();
    });

    test('logs with metadata timestamp', async () => {
      agent = new SupportAgent();
      agent.db.query = jest.fn().mockResolvedValue({ rows: [{ id: 1 }] });

      const decisionData = {
        agent_type: 'support_agent',
        coach_id: 1,
        task_id: 1,
        groq_recommendation: 'escalate',
        groq_confidence: 0.92,
        groq_reasoning: 'High priority escalation',
        final_action: 'escalate',
        override_reason: null,
        overridden: false,
        coach_pattern: 'procrastinator',
        task_status: 'overdue',
      };

      await agent._logDecision(decisionData);

      const callArgs = agent.db.query.mock.calls[0];
      const metadata = callArgs[1][callArgs[1].length - 1];

      expect(typeof metadata).toBe('string');
      const parsed = JSON.parse(metadata);
      expect(parsed.timestamp).toBeDefined();
    });
  });

  describe('_decideIntervention() with GroqService', () => {
    test('uses Groq recommendation when available', async () => {
      // Mock GroqService instance
      GroqService.mockImplementation(() => ({
        client: {},  // Non-null to pass !this.client check
        analyzeCoachForIntervention: jest.fn().mockResolvedValue({
          recommendation: 'escalate',
          confidence: 0.92,
          reasoning: 'Procrastinator with overdue task',
        }),
      }));

      // Create agent AFTER mocking GroqService
      agent = new SupportAgent();

      const snapshot = {
        task_id: 1,
        coach_id: 1,
        status: 'overdue',
        days_remaining: -1,
        coach_pattern: 'procrastinator',
        blockers: '[]',
        missing_sections: '[]',
      };

      // Mock coach history
      agent.db.query = jest.fn()
        .mockResolvedValueOnce({
          rows: [{ id: 1, title: 'Task 1', status: 'completed', completed_at: '2026-06-01T10:00:00Z', due_date: '2026-06-01T18:00:00Z', assigned_at: '2026-05-25T10:00:00Z' }]
        })
        // Mock fatigue check
        .mockResolvedValueOnce({ rows: [] })
        // Mock decision logging
        .mockResolvedValueOnce({ rows: [{ id: 1 }] });

      const result = await agent._decideIntervention(snapshot);

      expect(result.action).toBe('escalate');
      expect(result.taskId).toBe(1);
    });

    test('falls back to Phase 9 rules when Groq unavailable', async () => {
      // Mock GroqService instance
      GroqService.mockImplementation(() => ({
        client: {},  // Non-null to pass !this.client check
        analyzeCoachForIntervention: jest.fn().mockResolvedValue({
          recommendation: 'email',
          confidence: 0,
          reasoning: 'Groq unavailable, using Phase 9 rules',
        }),
      }));

      // Create agent AFTER mocking GroqService
      agent = new SupportAgent();

      const snapshot = {
        task_id: 1,
        coach_id: 1,
        status: 'overdue',
        days_remaining: -1,
        coach_pattern: 'steady',
        blockers: '[]',
        missing_sections: '[]',
      };

      // Mock coach history
      agent.db.query = jest.fn()
        .mockResolvedValueOnce({
          rows: [{ id: 1, title: 'Task 1', status: 'completed', completed_at: '2026-06-01T10:00:00Z', due_date: '2026-06-01T18:00:00Z', assigned_at: '2026-05-25T10:00:00Z' }]
        })
        // Mock fatigue check
        .mockResolvedValueOnce({ rows: [] })
        // Mock decision logging
        .mockResolvedValueOnce({ rows: [{ id: 1 }] });

      const result = await agent._decideIntervention(snapshot);

      expect(result.action).toBe('email');
    });

    test('applies fatigue rules to override Groq recommendation', async () => {
      // Mock GroqService constructor and instance method
      const mockAnalyze = jest.fn().mockResolvedValue({
        recommendation: 'tag',
        confidence: 0.85,
        reasoning: 'Offer proactive support',
      });

      GroqService.mockImplementation(() => ({
        client: true,
        analyzeCoachForIntervention: mockAnalyze,
      }));

      // Create agent AFTER mocking GroqService
      agent = new SupportAgent();

      const snapshot = {
        task_id: 1,
        coach_id: 1,
        status: 'at_risk',
        days_remaining: 2,
        coach_pattern: 'steady',
        blockers: '["blocker"]',
        missing_sections: '[]',
      };

      // Mock coach history, fatigue check, and decision logging
      agent.db.query = jest.fn()
        .mockResolvedValueOnce({
          rows: [{ id: 1, title: 'Task 1', status: 'completed', completed_at: '2026-06-01T10:00:00Z', due_date: '2026-06-01T18:00:00Z', assigned_at: '2026-05-25T10:00:00Z' }]
        })
        .mockResolvedValueOnce({
          rows: [{ minutes_ago: 15 }]
        })
        .mockResolvedValueOnce({ rows: [{ id: 1 }] });

      const result = await agent._decideIntervention(snapshot);

      // Fatigue rule should block the tag
      expect(result.action).toBeNull();
      expect(result.reason).toContain('fatigue');
    });

    test('logs decision with override_reason when fatigue blocks action', async () => {
      // Mock GroqService instance
      GroqService.mockImplementation(() => ({
        client: {},  // Non-null to pass !this.client check
        analyzeCoachForIntervention: jest.fn().mockResolvedValue({
          recommendation: 'email',
          confidence: 0.88,
          reasoning: 'Supportive reminder',
        }),
      }));

      // Create agent AFTER mocking GroqService
      agent = new SupportAgent();

      const snapshot = {
        task_id: 1,
        coach_id: 1,
        status: 'overdue',
        days_remaining: -1,
        coach_pattern: 'procrastinator',
        blockers: '[]',
        missing_sections: '[]',
      };

      // Mock coach history, fatigue check, and decision logging
      agent.db.query = jest.fn()
        .mockResolvedValueOnce({
          rows: [{ id: 1, title: 'Task 1', status: 'completed', completed_at: '2026-06-01T10:00:00Z', due_date: '2026-06-01T18:00:00Z', assigned_at: '2026-05-25T10:00:00Z' }]
        })
        .mockResolvedValueOnce({
          rows: [{ minutes_ago: 120 }]
        })
        .mockResolvedValueOnce({ rows: [{ id: 1 }] });

      const result = await agent._decideIntervention(snapshot);

      // Action should be null due to fatigue override
      expect(result.action).toBeNull();

      // Verify logging was called with override_reason
      const logCall = agent.db.query.mock.calls.find(call =>
        call[0] && call[0].includes('agent_decisions')
      );

      expect(logCall).toBeDefined();
      const [, params] = logCall;
      // Check that override_reason contains 'fatigue_rule'
      expect(params).toContain('fatigue_rule');
    });

    test('logs groq_reasoning in decision record', async () => {
      const groqReasoning = 'Coach is steady performer, gentle nudge appropriate';

      // Mock GroqService instance
      GroqService.mockImplementation(() => ({
        client: {},  // Non-null to pass !this.client check
        analyzeCoachForIntervention: jest.fn().mockResolvedValue({
          recommendation: 'email',
          confidence: 0.82,
          reasoning: groqReasoning,
        }),
      }));

      // Create agent AFTER mocking GroqService
      agent = new SupportAgent();

      const snapshot = {
        task_id: 1,
        coach_id: 1,
        status: 'at_risk',
        days_remaining: 3,
        coach_pattern: 'steady',
        blockers: '[]',
        missing_sections: '[]',
      };

      // Mock coach history
      agent.db.query = jest.fn()
        .mockResolvedValueOnce({
          rows: [{ id: 1, title: 'Task 1', status: 'completed', completed_at: '2026-06-01T10:00:00Z', due_date: '2026-06-01T18:00:00Z', assigned_at: '2026-05-25T10:00:00Z' }]
        })
        // Mock fatigue check
        .mockResolvedValueOnce({ rows: [] })
        // Mock decision logging
        .mockResolvedValueOnce({ rows: [{ id: 1 }] });

      const result = await agent._decideIntervention(snapshot);

      // Verify Groq reasoning was logged
      const logCall = db.query.mock.calls.find(call =>
        call[0] && call[0].includes('agent_decisions')
      );

      expect(logCall).toBeDefined();
      const [, params] = logCall;
      expect(params).toContain(groqReasoning);
    });
  });
});
