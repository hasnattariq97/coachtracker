/**
 * Admin Dashboard API Tests
 *
 * Tests for Phase 9c admin endpoints:
 *   GET /api/admin/agent-status
 *   GET /api/admin/decisions
 *   GET /api/admin/coach-patterns
 *
 * @phase 9c
 * @status active
 */

const request = require('supertest');
const express = require('express');
const db = require('../../db');
const { generateToken, authenticateToken } = require('../../auth');
const adminRouter = require('../../routes/admin');

jest.mock('../../db');

const app = express();
app.use(express.json());
app.use('/api/admin', authenticateToken, adminRouter);

const adminToken = generateToken({ id: 1, email: 'admin@tracker.com', role: 'admin' });
const coachToken = generateToken({ id: 2, email: 'coach@test.com', role: 'coach' });

beforeEach(() => {
  jest.clearAllMocks();
});

// ─── GET /api/admin/agent-status ─────────────────────────────────────────────

describe('GET /api/admin/agent-status', () => {
  test('returns 200 with correct shape when agents have run', async () => {
    const monitoringRow = { id: 'uuid-1', timestamp: '2026-06-10T09:00:00Z', snapshots_created: 5, coaches_at_risk: 2, status: 'completed' };
    const supportRow = { id: 'uuid-2', timestamp: '2026-06-10T09:01:00Z', actions_taken: 3, emails_sent: 1, tags_created: 2, escalations: 0, status: 'completed' };
    const reportingRow = { id: 'uuid-3', timestamp: '2026-06-10T09:00:00Z', report_generated: true, insights_count: 4, status: 'completed' };
    const queueRow = { pending: '7' };

    db.query
      .mockResolvedValueOnce({ rows: [monitoringRow] })
      .mockResolvedValueOnce({ rows: [supportRow] })
      .mockResolvedValueOnce({ rows: [reportingRow] })
      .mockResolvedValueOnce({ rows: [queueRow] });

    const res = await request(app)
      .get('/api/admin/agent-status')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('monitoring');
    expect(res.body).toHaveProperty('support');
    expect(res.body).toHaveProperty('reporting');
    expect(res.body).toHaveProperty('groq_queue_pending');
    expect(res.body).toHaveProperty('timestamp');
    expect(res.body.monitoring).toMatchObject({ snapshots_created: 5, coaches_at_risk: 2 });
    expect(res.body.groq_queue_pending).toBe(7);
  });

  test('returns null for agents with no data', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ pending: '0' }] });

    const res = await request(app)
      .get('/api/admin/agent-status')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.monitoring).toBeNull();
    expect(res.body.support).toBeNull();
    expect(res.body.reporting).toBeNull();
    expect(res.body.groq_queue_pending).toBe(0);
  });

  test('returns 403 for non-admin (coach role)', async () => {
    const res = await request(app)
      .get('/api/admin/agent-status')
      .set('Authorization', `Bearer ${coachToken}`);

    expect(res.status).toBe(403);
  });
});

// ─── GET /api/admin/decisions ─────────────────────────────────────────────────

describe('GET /api/admin/decisions', () => {
  test('returns 200 with summary and decisions array', async () => {
    const mockRows = [
      { id: 1, timestamp: '2026-06-10T09:00:00Z', agent_type: 'support_agent', coach_id: 2, groq_recommendation: 'email', groq_confidence: '0.85', final_action: 'email', override_reason: null, overridden: false, coach_pattern: 'procrastinator', task_status: 'overdue', metadata: null },
      { id: 2, timestamp: '2026-06-10T08:00:00Z', agent_type: 'coaching_insights', coach_id: 3, groq_recommendation: null, groq_confidence: null, final_action: 'insight', override_reason: null, overridden: false, coach_pattern: 'steady', task_status: 'completed', metadata: null }
    ];

    db.query.mockResolvedValueOnce({ rows: mockRows });

    const res = await request(app)
      .get('/api/admin/decisions')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('summary');
    expect(res.body).toHaveProperty('decisions');
    expect(Array.isArray(res.body.decisions)).toBe(true);
    expect(res.body.summary.total_decisions).toBe(2);
    expect(res.body.summary.by_agent.support_agent).toBe(1);
    expect(res.body.summary.by_agent.coaching_insights).toBe(1);
  });

  test('filters by coach_id query param', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .get('/api/admin/decisions?coach_id=5')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    const callArgs = db.query.mock.calls[0];
    // The query string should contain the coach_id filter
    expect(callArgs[0]).toContain('coach_id');
    // The params array should contain 5
    expect(callArgs[1]).toContain(5);
  });

  test('calculates correct avg confidence from sample rows', async () => {
    const mockRows = [
      { id: 1, agent_type: 'support_agent', coach_id: 2, groq_confidence: '0.80', final_action: 'email', override_reason: null, overridden: false, coach_pattern: 'steady', task_status: 'overdue', metadata: null },
      { id: 2, agent_type: 'support_agent', coach_id: 3, groq_confidence: '0.60', final_action: 'tag', override_reason: null, overridden: false, coach_pattern: 'procrastinator', task_status: 'at_risk', metadata: null }
    ];

    db.query.mockResolvedValueOnce({ rows: mockRows });

    const res = await request(app)
      .get('/api/admin/decisions')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    // avg of 0.80 and 0.60 = 0.70
    expect(res.body.summary.groq_vs_fallback.groq_confidence_avg).toBe('0.70');
    expect(res.body.summary.groq_vs_fallback.fallback_count).toBe(0);
  });

  test('returns 403 for non-admin', async () => {
    const res = await request(app)
      .get('/api/admin/decisions')
      .set('Authorization', `Bearer ${coachToken}`);

    expect(res.status).toBe(403);
  });
});

// ─── GET /api/admin/coach-patterns ───────────────────────────────────────────

describe('GET /api/admin/coach-patterns', () => {
  test('returns patterns grouped by pattern name', async () => {
    const snapshotRows = [
      { coach_id: 2, coach_pattern: 'procrastinator', detections: '5' },
      { coach_id: 3, coach_pattern: 'procrastinator', detections: '3' },
      { coach_id: 4, coach_pattern: 'fast-track', detections: '8' }
    ];
    const effectivenessRows = [
      { coach_id: 2, final_action: 'email', total: '3', executed: '3' }
    ];

    db.query
      .mockResolvedValueOnce({ rows: snapshotRows })
      .mockResolvedValueOnce({ rows: effectivenessRows });

    const res = await request(app)
      .get('/api/admin/coach-patterns')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('patterns');
    expect(res.body).toHaveProperty('intervention_effectiveness');
    expect(res.body.patterns).toHaveProperty('procrastinator');
    expect(res.body.patterns).toHaveProperty('fast-track');
    expect(res.body.patterns.procrastinator.coaches).toContain(2);
    expect(res.body.patterns.procrastinator.coaches).toContain(3);
    expect(res.body.patterns.procrastinator.detections).toBe(8);
    expect(res.body.patterns['fast-track'].detections).toBe(8);
  });

  test('returns 403 for non-admin', async () => {
    const res = await request(app)
      .get('/api/admin/coach-patterns')
      .set('Authorization', `Bearer ${coachToken}`);

    expect(res.status).toBe(403);
  });
});
