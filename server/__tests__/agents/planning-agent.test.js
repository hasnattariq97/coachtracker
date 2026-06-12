// See diagnostic-agent.test.js for explanation of resetModules pattern.

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

const SAFE_ROW = {
  id: 'uuid-safe',
  title: 'UI glitch on task card',
  description: 'Card overlaps on mobile',
  priority: 'medium',
  root_cause: 'CSS z-index issue',
  affected_files: ['client/src/components/TaskCard.jsx'],
  severity: 'low',
};

const CRITICAL_ROW = {
  id: 'uuid-critical',
  title: 'Auth bypass issue',
  description: 'Password auth broken',
  priority: 'critical',
  root_cause: 'Auth logic broken',
  affected_files: ['server/auth.js', 'server/db.js'],
  severity: 'critical',
};

describe('Planning Agent', () => {
  /* eslint-disable-next-line prefer-const */
  let db;
  let runPlanningAgent;

  beforeAll(() => {
    jest.resetModules();
    db = require('../../db');
    ({ runPlanningAgent } = require('../../agents/planning-agent'));
  });

  beforeEach(() => {
    db.query.mockReset();
    db.query.mockResolvedValue({ rows: [] });
  });

  test('returns skipped when no diagnosed feedback', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });
    const result = await runPlanningAgent();
    expect(result).toEqual({ skipped: true, reason: 'No diagnosed feedback to plan' });
    expect(db.query).toHaveBeenCalledTimes(1);
  });

  test('escalates bug touching critical infrastructure files', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [CRITICAL_ROW] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    const result = await runPlanningAgent();
    expect(result.escalated).toBe(true);
    expect(result.reason).toContain('critical infrastructure');
    expect(db.query).toHaveBeenCalledTimes(3);
  });

  test('escalates bug with security keywords in description', async () => {
    const securityRow = {
      ...SAFE_ROW,
      id: 'uuid-sec',
      description: 'The password encryption module is leaking tokens',
      affected_files: ['client/src/components/Modal.jsx'],
    };
    db.query
      .mockResolvedValueOnce({ rows: [securityRow] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    const result = await runPlanningAgent();
    expect(result.escalated).toBe(true);
    expect(result.reason).toContain('Security');
  });

  test('escalates bug affecting too many files', async () => {
    const manyFilesRow = {
      ...SAFE_ROW,
      id: 'uuid-many',
      affected_files: ['a.js', 'b.js', 'c.js', 'd.js', 'e.js', 'f.js'],
    };
    db.query
      .mockResolvedValueOnce({ rows: [manyFilesRow] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    const result = await runPlanningAgent();
    expect(result.escalated).toBe(true);
    expect(result.reason).toMatch(/Too many files/i);
  });

  test('returns error when Groq unavailable for safe bug', async () => {
    db.query.mockResolvedValueOnce({ rows: [SAFE_ROW] });
    const result = await runPlanningAgent();
    expect(result.error).toBe('Groq client unavailable');
  });

  test('handles SELECT query failure gracefully', async () => {
    db.query.mockRejectedValueOnce(new Error('DB connection lost'));
    const result = await runPlanningAgent();
    expect(result.error).toBe('DB connection lost');
  });

  test('handles escalation db write failure gracefully', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [CRITICAL_ROW] })
      .mockRejectedValueOnce(new Error('Write failed'));
    const result = await runPlanningAgent();
    expect(result.error).toBe('Write failed');
  });

  test('SELECT joins feedback_reports, diagnoses, and implementation_plans', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });
    await runPlanningAgent();
    const sql = db.query.mock.calls[0][0];
    expect(sql).toContain('feedback_reports');
    expect(sql).toContain('diagnoses');
    expect(sql).toContain('implementation_plans');
    expect(sql).toContain('diagnosing');
  });

  test('treats null affected_files as empty array — no crash', async () => {
    const badRow = { ...SAFE_ROW, id: 'uuid-null', affected_files: null };
    db.query.mockResolvedValueOnce({ rows: [badRow] });
    const result = await runPlanningAgent();
    expect(result.error).toBe('Groq client unavailable');
  });

  test('escalation UPDATE sets correct status to escalated', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [CRITICAL_ROW] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    await runPlanningAgent();
    const updateCall = db.query.mock.calls[2][0];
    expect(updateCall).toContain('escalated');
    expect(updateCall).toContain('feedback_reports');
  });

  test('error result has string message', async () => {
    db.query.mockResolvedValueOnce({ rows: [SAFE_ROW] });
    const result = await runPlanningAgent();
    expect(result.error).toBeDefined();
    expect(typeof result.error).toBe('string');
  });
});
