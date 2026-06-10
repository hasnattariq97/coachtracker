/**
 * @phase 9c
 * @status active
 * @owner phase-builder
 * @last_updated 2026-06-10T00:00:00Z
 */

const ReportingAgent = require('../../agents/reporting-agent');

// Mock db module
jest.mock('../../db', () => ({
  query: jest.fn(),
}));

// Mock GroqService to ensure deterministic fallback in all test environments
jest.mock('../../services/groq-service', () => {
  return jest.fn().mockImplementation(() => ({
    generateReportingInsights: jest.fn().mockResolvedValue({
      key_insights: ['Team completed 5 tasks on time', 'On-time rate: 80%', '3 coaches supported'],
      recommendations: ['Continue monitoring', 'Review patterns', 'Plan next week'],
      coach_analysis: [{ pattern: 'steady', suggested_approach: 'Email support' }],
      team_insights: { on_time_trend: 'Stable', most_effective_intervention: 'Email', emerging_patterns: 'None' },
      confidence: 0.5
    })
  }));
});

describe('ReportingAgent Phase 9c', () => {
  let agent;

  beforeEach(() => {
    agent = new ReportingAgent();
    jest.clearAllMocks();
  });

  // Test 1: generateAIInsights returns structured data
  it('generateAIInsights returns insights object', async () => {
    const patterns = {
      supportActions: [{ action_type: 'email' }, { action_type: 'tag' }],
      completionRate: 80,
      coachPerformance: [{ coachId: 1, pattern: 'steady' }],
      commonBlockers: []
    };
    const recommendations = ['Keep it up!'];
    const result = await agent.generateAIInsights(patterns, recommendations);
    // In test env, GroqService.client is null → returns fallback
    expect(result).not.toBeNull();
    expect(result).toHaveProperty('key_insights');
    expect(result).toHaveProperty('recommendations');
    expect(result).toHaveProperty('confidence');
  });

  // Test 2: generateAIInsights with empty patterns doesn't throw
  it('generateAIInsights handles empty patterns gracefully', async () => {
    const result = await agent.generateAIInsights({}, []);
    expect(result).not.toBeNull();
    expect(result).toHaveProperty('key_insights');
  });

  // Test 3: _generateEmailHTML includes AI insights section when provided
  it('_generateEmailHTML includes AI insights section when aiInsights provided', () => {
    const patterns = {
      supportActions: [],
      completionRate: 75,
      commonBlockers: [],
      coachPerformance: []
    };
    const recommendations = ['Do better'];
    const aiInsights = {
      key_insights: ['Team is improving', 'Sarah needs support'],
      recommendations: ['Try escalation', 'Send weekly digest'],
      coach_analysis: [],
      team_insights: {},
      confidence: 0.88
    };
    const html = agent._generateEmailHTML(patterns, recommendations, aiInsights);
    expect(html).toContain('AI Coaching Insights');
    expect(html).toContain('Team is improving');
    expect(html).toContain('Try escalation');
    expect(html).toContain('88%');
  });

  // Test 4: _generateEmailHTML works without aiInsights (backward compat)
  it('_generateEmailHTML works without aiInsights parameter', () => {
    const patterns = {
      supportActions: [],
      completionRate: 75,
      commonBlockers: [],
      coachPerformance: []
    };
    const html = agent._generateEmailHTML(patterns, ['Keep going']);
    expect(html).toContain('Daily Coaching Report');
    expect(html).not.toContain('AI Coaching Insights');
  });

  // Test 5: _archiveReport called with aiInsights stores generated_by = 'groq-ai'
  it('_archiveReport stores generated_by groq-ai when aiInsights provided', async () => {
    const mockQuery = jest.fn().mockResolvedValue({ rows: [] });
    agent.db = { query: mockQuery };

    const patterns = {
      supportActions: [],
      completionRate: 80,
      commonBlockers: [],
      coachPerformance: []
    };
    const aiInsights = { key_insights: [], recommendations: [], confidence: 0.85, coach_analysis: [], team_insights: {} };

    await agent._archiveReport(patterns, ['rec'], aiInsights);

    const callArgs = mockQuery.mock.calls[0];
    const params = callArgs[1];
    // generated_by is param index 6 (0-based)
    expect(params[6]).toBe('groq-ai');
    expect(params[7]).toBe(0.85);
  });

  // Test 6: _archiveReport stores generated_by = 'rules-based' when no aiInsights
  it('_archiveReport stores generated_by rules-based when no aiInsights', async () => {
    const mockQuery = jest.fn().mockResolvedValue({ rows: [] });
    agent.db = { query: mockQuery };

    const patterns = {
      supportActions: [],
      completionRate: 80,
      commonBlockers: [],
      coachPerformance: []
    };

    await agent._archiveReport(patterns, ['rec'], null);

    const callArgs = mockQuery.mock.calls[0];
    const params = callArgs[1];
    expect(params[6]).toBe('rules-based');
    expect(params[7]).toBeNull();
  });

  // Test 7: confidence badge shows Groq AI vs fallback
  it('_generateEmailHTML shows confidence badge with Groq AI label', () => {
    const patterns = { supportActions: [], completionRate: 75, commonBlockers: [], coachPerformance: [] };
    const aiInsights = { key_insights: ['insight'], recommendations: ['rec'], confidence: 0.9, coach_analysis: [], team_insights: {} };
    const html = agent._generateEmailHTML(patterns, [], aiInsights);
    expect(html).toContain('Groq AI');
    expect(html).toContain('90%');
  });
});
