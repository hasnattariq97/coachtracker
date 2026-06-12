// jest.mock is hoisted before all code, including const/let/var assignments.
// test-setup.js (setupFilesAfterEnv) loads cron.js which pre-caches the agent
// with the real db object. jest.resetModules() in beforeAll forces a fresh
// require after the mock factory has run, so the agent gets the mocked db.

jest.mock('../../db', () => ({
  query: jest.fn(),
  prepare: jest.fn(),
  pool: { end: jest.fn() },
}));

jest.mock('groq-sdk', () =>
  jest.fn().mockImplementation(() => ({
    chat: { completions: { create: jest.fn() } },
  }))
, { virtual: true });

const FAKE_FEEDBACK = {
  id: 'uuid-1',
  title: 'Bell spinner never ends',
  description: 'Spinner keeps spinning after load',
  type: 'bug',
};

describe('Diagnostic Agent', () => {
  /* eslint-disable-next-line prefer-const */
  let db;
  let runDiagnosticAgent;

  beforeAll(() => {
    jest.resetModules();
    db = require('../../db');
    ({ runDiagnosticAgent } = require('../../agents/diagnostic-agent'));
  });

  beforeEach(() => {
    db.query.mockReset();
    db.query.mockResolvedValue({ rows: [] });
  });

  test('returns skipped when no submitted feedback', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });
    const result = await runDiagnosticAgent();
    expect(result).toEqual({ skipped: true, reason: 'No feedback to diagnose' });
    expect(db.query).toHaveBeenCalledTimes(1);
  });

  test('updates status to diagnosing then calls Groq (unavailable in test env)', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [FAKE_FEEDBACK] })
      .mockResolvedValueOnce({ rows: [] });

    const result = await runDiagnosticAgent();
    expect(result.error).toBe('Groq client unavailable');
    expect(db.query).toHaveBeenCalledTimes(2);
    expect(db.query.mock.calls[1][0]).toContain('diagnosing');
  });

  test('handles SELECT query failure gracefully', async () => {
    db.query.mockRejectedValueOnce(new Error('DB connection lost'));
    const result = await runDiagnosticAgent();
    expect(result.error).toBe('DB connection lost');
  });

  test('handles UPDATE status failure gracefully', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [FAKE_FEEDBACK] })
      .mockRejectedValueOnce(new Error('UPDATE failed'));
    const result = await runDiagnosticAgent();
    expect(result.error).toBe('UPDATE failed');
  });

  test('SELECT query filters by submitted status and joins diagnoses', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });
    await runDiagnosticAgent();
    const sql = db.query.mock.calls[0][0];
    expect(sql).toContain('feedback_reports');
    expect(sql).toContain('diagnoses');
    expect(sql).toContain('submitted');
  });

  test('returns error with message string not object', async () => {
    db.query.mockRejectedValueOnce(new Error('Timeout'));
    const result = await runDiagnosticAgent();
    expect(typeof result.error).toBe('string');
    expect(result.error).toBe('Timeout');
  });

  test('UPDATE passes feedback id as parameter', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [FAKE_FEEDBACK] })
      .mockResolvedValueOnce({ rows: [] });
    await runDiagnosticAgent();
    const updateParams = db.query.mock.calls[1][1];
    expect(updateParams).toContain(FAKE_FEEDBACK.id);
  });
});
