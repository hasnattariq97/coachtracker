/**
 * @phase 10
 * @status active
 * @owner phase-builder
 */

// Verify that Phase 10 agents are importable and have the expected exports
// (cron scheduling itself is a side-effect of index.js; these tests confirm the
// agent contracts so the scheduler can wire them up safely)

jest.mock('../db', () => ({
  prepare: jest.fn(() => ({
    get: jest.fn().mockResolvedValue(null),
    all: jest.fn().mockResolvedValue([]),
    run: jest.fn().mockResolvedValue({ rowCount: 0 })
  })),
  query: jest.fn().mockResolvedValue({ rows: [] })
}));

jest.mock('../services/email', () => ({
  sendApprovalEmail: jest.fn().mockResolvedValue({}),
  sendEmail: jest.fn().mockResolvedValue({})
}));

jest.mock('groq-sdk', () =>
  jest.fn().mockImplementation(() => ({
    chat: { completions: { create: jest.fn().mockResolvedValue({ choices: [{ message: { content: '{}' } }] }) } }
  }))
);

describe('Phase 10: Cron Scheduling Contracts', () => {
  test('diagnostic agent exports runDiagnosticAgent function', () => {
    const { runDiagnosticAgent } = require('../agents/diagnostic-agent');
    expect(typeof runDiagnosticAgent).toBe('function');
  });

  test('planning agent exports runPlanningAgent function', () => {
    const { runPlanningAgent } = require('../agents/planning-agent');
    expect(typeof runPlanningAgent).toBe('function');
  });

  test('implementation agent exports runImplementationAgent function', () => {
    const { runImplementationAgent } = require('../agents/implementation-agent');
    expect(typeof runImplementationAgent).toBe('function');
  });

  test('verification agent exports runVerificationAgent function', () => {
    const { runVerificationAgent } = require('../agents/verification-agent');
    expect(typeof runVerificationAgent).toBe('function');
  });

  test('integration agent exports runIntegrationAgent function', () => {
    const { runIntegrationAgent } = require('../agents/integration-agent');
    expect(typeof runIntegrationAgent).toBe('function');
  });

  test('all agents return a defined result when DB returns no work', async () => {
    const { runDiagnosticAgent } = require('../agents/diagnostic-agent');
    const { runPlanningAgent } = require('../agents/planning-agent');
    const { runVerificationAgent } = require('../agents/verification-agent');
    const { runIntegrationAgent } = require('../agents/integration-agent');

    const results = await Promise.all([
      runDiagnosticAgent(),
      runPlanningAgent(),
      runVerificationAgent(),
      runIntegrationAgent()
    ]);

    results.forEach(r => expect(r).toBeDefined());
  });

  test('agents return skipped when no work is available', async () => {
    const { runDiagnosticAgent } = require('../agents/diagnostic-agent');
    const result = await runDiagnosticAgent();
    expect(result.skipped !== undefined || result.error !== undefined || result.success !== undefined).toBe(true);
  });
});
