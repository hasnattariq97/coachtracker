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
    jest.clearAllMocks();
    agent = new SupportAgent();
  });

  describe('_logDecision() helper method', () => {
    test('inserts decision record with all required fields', async () => {
      db.query.mockResolvedValue({ rows: [{ id: 1 }] });

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

      expect(db.query).toHaveBeenCalledWith(
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
      db.query.mockRejectedValue(new Error('Insert failed'));
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
      db.query.mockResolvedValue({ rows: [{ id: 1 }] });

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

      const callArgs = db.query.mock.calls[0];
      const metadata = callArgs[1][callArgs[1].length - 1];

      expect(typeof metadata).toBe('string');
      const parsed = JSON.parse(metadata);
      expect(parsed.timestamp).toBeDefined();
    });
  });

  describe('_decideIntervention() with GroqService', () => {
    test('uses Groq recommendation when available', async () => {
      // Mock Groq service to return a recommendation
      const mockGroqService = {
        analyzeCoachForIntervention: jest.fn().mockResolvedValue({
          recommendation: 'escalate',
          confidence: 0.92,
          reasoning: 'Procrastinator with overdue task',
        }),
      };

      jest.spyOn(GroqService.prototype, 'analyzeCoachForIntervention')
        .mockResolvedValue({
          recommendation: 'escalate',
          confidence: 0.92,
          reasoning: 'Procrastinator with overdue task',
        });

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
      db.query.mockResolvedValueOnce({
        rows: [{ id: 1, title: 'Task 1', status: 'completed', completed_at: '2026-06-01T10:00:00Z', due_date: '2026-06-01T18:00:00Z', assigned_at: '2026-05-25T10:00:00Z' }]
      });

      // Mock fatigue check
      db.query.mockResolvedValueOnce({ rows: [] });

      // Mock decision logging
      db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });

      const result = await agent._decideIntervention(snapshot);

      expect(result.action).toBe('escalate');
      expect(result.taskId).toBe(1);
    });

    test('falls back to Phase 9 rules when Groq unavailable', async () => {
      jest.spyOn(GroqService.prototype, 'analyzeCoachForIntervention')
        .mockResolvedValue({
          fallbackRule: 'email',
          confidence: 0,
        });

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
      db.query.mockResolvedValueOnce({
        rows: [{ id: 1, title: 'Task 1', status: 'completed', completed_at: '2026-06-01T10:00:00Z', due_date: '2026-06-01T18:00:00Z', assigned_at: '2026-05-25T10:00:00Z' }]
      });

      // Mock fatigue check
      db.query.mockResolvedValueOnce({ rows: [] });

      // Mock decision logging
      db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });

      const result = await agent._decideIntervention(snapshot);

      expect(result.action).toBe('email');
    });

    test('applies fatigue rules to override Groq recommendation', async () => {
      jest.spyOn(GroqService.prototype, 'analyzeCoachForIntervention')
        .mockResolvedValue({
          recommendation: 'tag',
          confidence: 0.85,
          reasoning: 'Offer proactive support',
        });

      const snapshot = {
        task_id: 1,
        coach_id: 1,
        status: 'at_risk',
        days_remaining: 2,
        coach_pattern: 'steady',
        blockers: '["blocker"]',
        missing_sections: '[]',
      };

      // Mock coach history
      db.query.mockResolvedValueOnce({
        rows: [{ id: 1, title: 'Task 1', status: 'completed', completed_at: '2026-06-01T10:00:00Z', due_date: '2026-06-01T18:00:00Z', assigned_at: '2026-05-25T10:00:00Z' }]
      });

      // Mock fatigue check: tag was sent 15 minutes ago (within 30-min window)
      db.query.mockResolvedValueOnce({
        rows: [{ minutes_ago: 15 }]
      });

      // Mock decision logging
      db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });

      const result = await agent._decideIntervention(snapshot);

      // Fatigue rule should block the tag
      expect(result.action).toBeNull();
      expect(result.reason).toContain('fatigue');
    });

    test('logs decision with override_reason when fatigue blocks action', async () => {
      jest.spyOn(GroqService.prototype, 'analyzeCoachForIntervention')
        .mockResolvedValue({
          recommendation: 'email',
          confidence: 0.88,
          reasoning: 'Supportive reminder',
        });

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
      db.query.mockResolvedValueOnce({
        rows: [{ id: 1, title: 'Task 1', status: 'completed', completed_at: '2026-06-01T10:00:00Z', due_date: '2026-06-01T18:00:00Z', assigned_at: '2026-05-25T10:00:00Z' }]
      });

      // Mock fatigue check: email was sent 2 hours ago (within 4-hour window)
      db.query.mockResolvedValueOnce({
        rows: [{ minutes_ago: 120 }]
      });

      // Mock decision logging
      db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });

      const result = await agent._decideIntervention(snapshot);

      // Action should be null due to fatigue override
      expect(result.action).toBeNull();

      // Verify logging was called with override_reason
      const logCall = db.query.mock.calls.find(call =>
        call[0] && call[0].includes('agent_decisions')
      );

      expect(logCall).toBeDefined();
      const [, params] = logCall;
      // Check that override_reason contains 'fatigue_rule'
      expect(params).toContain('fatigue_rule');
    });

    test('logs groq_reasoning in decision record', async () => {
      const groqReasoning = 'Coach is steady performer, gentle nudge appropriate';

      jest.spyOn(GroqService.prototype, 'analyzeCoachForIntervention')
        .mockResolvedValue({
          recommendation: 'email',
          confidence: 0.82,
          reasoning: groqReasoning,
        });

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
      db.query.mockResolvedValueOnce({
        rows: [{ id: 1, title: 'Task 1', status: 'completed', completed_at: '2026-06-01T10:00:00Z', due_date: '2026-06-01T18:00:00Z', assigned_at: '2026-05-25T10:00:00Z' }]
      });

      // Mock fatigue check
      db.query.mockResolvedValueOnce({ rows: [] });

      // Mock decision logging
      db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });

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
