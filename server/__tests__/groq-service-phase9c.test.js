/**
 * GroqService Phase 9c Tests
 *
 * Tests for generateReportingInsights and _getFallbackReportingInsights methods.
 *
 * @phase 9c
 * @status active
 */

const GroqService = require('../services/groq-service');

const sampleContext = {
  actions_24h: 10,
  emails_sent: 3,
  tags_created: 2,
  escalations: 1,
  coaches_affected: 4,
  on_time_rate: 0.75,
  coach_patterns: ['procrastinator'],
};

describe('GroqService.generateReportingInsights', () => {
  test('returns fallback when client is null (test environment)', async () => {
    const svc = new GroqService();
    // In test environment, client is null by default
    svc.client = null;

    const result = await svc.generateReportingInsights(sampleContext);

    expect(result).toHaveProperty('key_insights');
    expect(result).toHaveProperty('recommendations');
    expect(result).toHaveProperty('coach_analysis');
    expect(result).toHaveProperty('team_insights');
    expect(result).toHaveProperty('confidence');
  });

  test('fallback key_insights contains actions_24h count', async () => {
    const svc = new GroqService();
    svc.client = null;

    const result = await svc.generateReportingInsights(sampleContext);

    expect(result.key_insights[0]).toContain('10');
  });

  test('fallback key_insights contains on_time_rate as percent', async () => {
    const svc = new GroqService();
    svc.client = null;

    const result = await svc.generateReportingInsights(sampleContext);

    expect(result.key_insights[1]).toContain('75%');
  });

  test('fallback confidence is 0.5', async () => {
    const svc = new GroqService();
    svc.client = null;

    const result = await svc.generateReportingInsights(sampleContext);

    expect(result.confidence).toBe(0.5);
  });

  test('fallback recommendations has 3 items', async () => {
    const svc = new GroqService();
    svc.client = null;

    const result = await svc.generateReportingInsights(sampleContext);

    expect(result.recommendations.length).toBe(3);
  });

  test('fallback coach_analysis maps procrastinator to Escalation', async () => {
    const svc = new GroqService();
    svc.client = null;

    const result = await svc.generateReportingInsights(sampleContext);

    expect(result.coach_analysis[0].suggested_approach).toBe('Escalation');
  });

  test('handles empty context gracefully', async () => {
    const svc = new GroqService();
    svc.client = null;

    let result;
    await expect(async () => {
      result = await svc.generateReportingInsights({});
    }).not.toThrow();

    expect(result).toHaveProperty('key_insights');
    expect(result).toHaveProperty('confidence');
  });

  test('generateReportingInsights with mock client returns parsed response', async () => {
    const svc = new GroqService();
    const mockResponse = {
      key_insights: ['a'],
      recommendations: ['b'],
      coach_analysis: [],
      team_insights: {},
      confidence: 0.9,
    };

    svc.client = {
      chat: {
        completions: {
          create: jest.fn().mockResolvedValue({
            choices: [{ message: { content: JSON.stringify(mockResponse) } }],
          }),
        },
      },
    };

    const result = await svc.generateReportingInsights(sampleContext);

    expect(result.confidence).toBe(0.9);
    expect(result.key_insights).toEqual(['a']);
  });
});
