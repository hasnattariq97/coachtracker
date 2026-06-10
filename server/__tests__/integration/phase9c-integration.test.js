/**
 * Phase 9c Integration Tests
 *
 * Tests the full Phase 9c pipeline:
 * - Admin API endpoints (agent-status, decisions, coach-patterns)
 * - Agent runs logging flow
 * - Daily reports with AI insights
 *
 * @phase 9c
 * @status active
 * @last_updated 2026-06-10T00:00:00Z
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

// ─── Test 1: agent-status returns 200 with correct structure ─────────────────

describe('Phase 9c Integration: Admin API Endpoints', () => {
  test('GET /api/admin/agent-status returns 200 with correct structure', async () => {
    const monitoringRow = {
      id: 'run-uuid-1',
      timestamp: '2026-06-10T09:00:00Z',
      snapshots_created: 3,
      coaches_at_risk: 1,
      status: 'completed',
    };
    const supportRow = {
      id: 'run-uuid-2',
      timestamp: '2026-06-10T09:01:00Z',
      actions_taken: 2,
      emails_sent: 1,
      tags_created: 1,
      escalations: 0,
      status: 'completed',
    };
    const reportingRow = {
      id: 'run-uuid-3',
      timestamp: '2026-06-10T09:00:00Z',
      report_generated: true,
      insights_count: 3,
      status: 'completed',
    };
    const queueRow = { pending: '5' };

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

    // monitoring and support keys exist — may be null if no data
    // Here we expect actual objects back
    expect(res.body.monitoring).toMatchObject({ snapshots_created: 3, coaches_at_risk: 1 });
    expect(res.body.support).toMatchObject({ emails_sent: 1, tags_created: 1 });
    expect(res.body.reporting).toMatchObject({ insights_count: 3 });
    expect(res.body.groq_queue_pending).toBe(5);
  });

  // ─── Test 2: agent-status returns 403 for non-admin ────────────────────────

  test('GET /api/admin/agent-status returns 403 for non-admin user', async () => {
    const res = await request(app)
      .get('/api/admin/agent-status')
      .set('Authorization', `Bearer ${coachToken}`);

    expect(res.status).toBe(403);
  });

  // ─── Test 2b: agent-status returns null fields when no run history ──────────

  test('GET /api/admin/agent-status returns null fields when no run history', async () => {
    // All 4 DB queries return empty rows
    db.query
      .mockResolvedValueOnce({ rows: [] })   // monitoring
      .mockResolvedValueOnce({ rows: [] })   // support
      .mockResolvedValueOnce({ rows: [] })   // reporting
      .mockResolvedValueOnce({ rows: [{ pending: '0' }] });  // groq queue

    const res = await request(app)
      .get('/api/admin/agent-status')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.monitoring).toBeNull();
    expect(res.body.support).toBeNull();
    expect(res.body.reporting).toBeNull();
    expect(res.body.groq_queue_pending).toBe(0);
  });

  // ─── Test 3: decisions returns 200 with summary and decisions array ─────────

  test('GET /api/admin/decisions returns 200 with summary and decisions array', async () => {
    const mockRows = [
      {
        id: 1,
        timestamp: '2026-06-10T09:00:00Z',
        agent_type: 'support_agent',
        coach_id: 2,
        groq_recommendation: 'email',
        groq_confidence: '0.85',
        final_action: 'email',
        override_reason: null,
        overridden: false,
        coach_pattern: 'procrastinator',
        task_status: 'overdue',
        metadata: null,
      },
      {
        id: 2,
        timestamp: '2026-06-10T08:00:00Z',
        agent_type: 'coaching_insights',
        coach_id: 3,
        groq_recommendation: null,
        groq_confidence: null,
        final_action: 'insight',
        override_reason: null,
        overridden: false,
        coach_pattern: 'steady',
        task_status: 'completed',
        metadata: null,
      },
    ];

    db.query.mockResolvedValueOnce({ rows: mockRows });

    const res = await request(app)
      .get('/api/admin/decisions')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('summary');
    expect(res.body).toHaveProperty('decisions');
    expect(Array.isArray(res.body.decisions)).toBe(true);
    expect(res.body.decisions).toHaveLength(2);
    expect(res.body.summary).toHaveProperty('total_decisions', 2);
    expect(res.body.summary.by_agent).toHaveProperty('support_agent', 1);
    expect(res.body.summary.by_agent).toHaveProperty('coaching_insights', 1);
  });

  // ─── Test 4: decisions with invalid hours param defaults to 24h (no 400) ────

  test('GET /api/admin/decisions with invalid hours param defaults gracefully', async () => {
    // Note: The endpoint uses `parseInt(hours) || 24` so invalid string
    // defaults to 24 hours rather than returning 400.
    db.query.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .get('/api/admin/decisions?hours=abc')
      .set('Authorization', `Bearer ${adminToken}`);

    // Invalid hours string defaults to 24h window — returns 200 not 400
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('decisions');
    expect(Array.isArray(res.body.decisions)).toBe(true);
  });

  // ─── Test 5: coach-patterns returns 200 with patterns object ────────────────

  test('GET /api/admin/coach-patterns returns 200 with patterns object', async () => {
    const snapshotRows = [
      { coach_id: 2, coach_pattern: 'procrastinator', detections: '4' },
      { coach_id: 4, coach_pattern: 'fast-track', detections: '6' },
    ];
    const effectivenessRows = [
      { coach_id: 2, final_action: 'email', total: '2', executed: '2' },
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
    expect(typeof res.body.patterns).toBe('object');
  });

  // ─── Test 6: decisions filters by coach_id ──────────────────────────────────

  test('GET /api/admin/decisions filters by coach_id and returns empty array for unknown coach', async () => {
    // coach_id=999 has no decisions in the test DB
    db.query.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .get('/api/admin/decisions?coach_id=999')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.decisions)).toBe(true);
    expect(res.body.decisions).toHaveLength(0);
    expect(res.body.summary.total_decisions).toBe(0);

    // Verify the DB was called with coach_id filter
    const callArgs = db.query.mock.calls[0];
    expect(callArgs[0]).toContain('coach_id');
    expect(callArgs[1]).toContain(999);
  });

  // ─── Test 7: decisions returns 400 for invalid coach_id ─────────────────────

  test('GET /api/admin/decisions returns 400 for invalid coach_id param', async () => {
    const res = await request(app)
      .get('/api/admin/decisions?coach_id=abc')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
    expect(res.body.error).toMatch(/invalid coach_id/i);
  });
});
