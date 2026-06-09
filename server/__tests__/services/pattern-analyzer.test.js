/**
 * @phase 9
 * @status active
 * @owner phase-builder
 * @last_updated 2026-06-09T00:00:00Z
 */

const PatternAnalyzer = require('../../services/pattern-analyzer');

// Mock db module
jest.mock('../../db', () => ({
  query: jest.fn(),
}));

const db = require('../../db');

describe('PatternAnalyzer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('analyze24HourActions()', () => {
    test('returns patterns object with all properties', async () => {
      db.query.mockResolvedValueOnce({
        rows: [
          {
            id: 1,
            task_id: 1,
            coach_id: 1,
            action_type: 'tag',
            action_status: 'sent',
            details: '{"message":"blocked"}',
            created_at: new Date().toISOString(),
          },
        ],
      });

      db.query.mockResolvedValueOnce({ rows: [{ completed: 5 }] });
      db.query.mockResolvedValueOnce({ rows: [{ total: 10 }] });

      const result = await PatternAnalyzer.analyze24HourActions();

      expect(result).toHaveProperty('supportActions');
      expect(result).toHaveProperty('completionRate');
      expect(result).toHaveProperty('commonBlockers');
      expect(result).toHaveProperty('coachPerformance');
      expect(Array.isArray(result.supportActions)).toBe(true);
      expect(typeof result.completionRate).toBe('number');
      expect(Array.isArray(result.commonBlockers)).toBe(true);
      expect(Array.isArray(result.coachPerformance)).toBe(true);
    });

    test('calculates completion rate correctly', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });
      db.query.mockResolvedValueOnce({ rows: [{ completed: 8 }] });
      db.query.mockResolvedValueOnce({ rows: [{ total: 10 }] });

      const result = await PatternAnalyzer.analyze24HourActions();

      expect(result.completionRate).toBe(80);
    });

    test('handles zero total tasks gracefully', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });
      db.query.mockResolvedValueOnce({ rows: [{ completed: 0 }] });
      db.query.mockResolvedValueOnce({ rows: [{ total: 0 }] });

      const result = await PatternAnalyzer.analyze24HourActions();

      expect(result.completionRate).toBe(0);
    });

    test('throws error on query failure', async () => {
      db.query.mockRejectedValueOnce(new Error('Database error'));

      await expect(PatternAnalyzer.analyze24HourActions()).rejects.toThrow(
        '24-hour analysis failed'
      );
    });

    test('returns support actions from past 24 hours', async () => {
      const mockAction = {
        id: 1,
        task_id: 5,
        coach_id: 2,
        action_type: 'email',
        action_status: 'sent',
        details: '{}',
        created_at: new Date().toISOString(),
      };

      db.query.mockResolvedValueOnce({ rows: [mockAction] });
      db.query.mockResolvedValueOnce({ rows: [{ completed: 1 }] });
      db.query.mockResolvedValueOnce({ rows: [{ total: 1 }] });

      const result = await PatternAnalyzer.analyze24HourActions();

      expect(result.supportActions).toHaveLength(1);
      expect(result.supportActions[0].id).toBe(1);
    });
  });

  describe('_parseCommonBlockers()', () => {
    test('extracts blocker keywords from action details', () => {
      const actions = [
        {
          action_type: 'tag',
          details: JSON.stringify({ message: 'Task blocked by legal team' }),
        },
        {
          action_type: 'tag',
          details: JSON.stringify({ message: 'Stuck on database issue' }),
        },
        {
          action_type: 'escalate',
          details: JSON.stringify({ message: 'Dependency on external API' }),
        },
      ];

      const blockers = PatternAnalyzer._parseCommonBlockers(actions);

      expect(blockers.length).toBeGreaterThan(0);
      expect(blockers[0]).toHaveProperty('blocker');
      expect(blockers[0]).toHaveProperty('count');
    });

    test('counts blocker occurrences correctly', () => {
      const actions = [
        {
          action_type: 'tag',
          details: JSON.stringify({ message: 'blocked' }),
        },
        {
          action_type: 'tag',
          details: JSON.stringify({ message: 'blocked again' }),
        },
        {
          action_type: 'tag',
          details: JSON.stringify({ message: 'stuck' }),
        },
      ];

      const blockers = PatternAnalyzer._parseCommonBlockers(actions);

      const blocked = blockers.find(b => b.blocker === 'blocked');
      expect(blocked?.count).toBe(2);
    });

    test('returns top 5 blockers only', () => {
      const actions = [];
      for (let i = 0; i < 10; i++) {
        actions.push({
          action_type: 'tag',
          details: JSON.stringify({ message: `blocked issue ${i}` }),
        });
      }

      const blockers = PatternAnalyzer._parseCommonBlockers(actions);

      expect(blockers.length).toBeLessThanOrEqual(5);
    });

    test('sorts blockers by frequency', () => {
      const actions = [
        {
          action_type: 'tag',
          details: JSON.stringify({ message: 'stuck' }),
        },
        {
          action_type: 'tag',
          details: JSON.stringify({ message: 'blocked' }),
        },
        {
          action_type: 'tag',
          details: JSON.stringify({ message: 'blocked' }),
        },
        {
          action_type: 'tag',
          details: JSON.stringify({ message: 'blocked' }),
        },
      ];

      const blockers = PatternAnalyzer._parseCommonBlockers(actions);

      if (blockers.length > 1) {
        expect(blockers[0].count).toBeGreaterThanOrEqual(blockers[1].count);
      }
    });

    test('ignores actions without tag or escalate type', () => {
      const actions = [
        {
          action_type: 'email',
          details: JSON.stringify({ message: 'blocked' }),
        },
        {
          action_type: 'tag',
          details: JSON.stringify({ message: 'blocked' }),
        },
      ];

      const blockers = PatternAnalyzer._parseCommonBlockers(actions);

      // Should only count the 'tag' action
      const blocked = blockers.find(b => b.blocker === 'blocked');
      expect(blocked?.count).toBe(1);
    });

    test('handles empty action details', () => {
      const actions = [
        {
          action_type: 'tag',
          details: null,
        },
        {
          action_type: 'tag',
          details: undefined,
        },
        {
          action_type: 'tag',
          details: JSON.stringify({}),
        },
      ];

      // Should not throw
      const blockers = PatternAnalyzer._parseCommonBlockers(actions);
      expect(Array.isArray(blockers)).toBe(true);
    });

    test('handles malformed JSON in action details', () => {
      const actions = [
        {
          id: 1,
          action_type: 'tag',
          details: 'invalid json {not closed',
        },
        {
          id: 2,
          action_type: 'tag',
          details: JSON.stringify({ message: 'blocked' }),
        },
      ];

      // Should not throw, should skip malformed and continue
      const blockers = PatternAnalyzer._parseCommonBlockers(actions);
      expect(Array.isArray(blockers)).toBe(true);
      // Should still find the 'blocked' from the valid JSON
      const blocked = blockers.find(b => b.blocker === 'blocked');
      expect(blocked?.count).toBe(1);
    });
  });

  describe('_analyzeCoachPerformance()', () => {
    test('returns coach performance metrics', async () => {
      db.query.mockResolvedValueOnce({
        rows: [
          {
            coach_id: 1,
            total_tasks: 10,
            completed: 8,
            overdue: 1,
          },
        ],
      });

      const result = await PatternAnalyzer._analyzeCoachPerformance();

      expect(Array.isArray(result)).toBe(true);
      expect(result[0]).toHaveProperty('coachId');
      expect(result[0]).toHaveProperty('total');
      expect(result[0]).toHaveProperty('completed');
      expect(result[0]).toHaveProperty('overdue');
      expect(result[0]).toHaveProperty('completionRate');
    });

    test('calculates completion rate per coach', async () => {
      db.query.mockResolvedValueOnce({
        rows: [
          {
            coach_id: 1,
            total_tasks: 10,
            completed: 9,
            overdue: 0,
          },
        ],
      });

      const result = await PatternAnalyzer._analyzeCoachPerformance();

      expect(result[0].completionRate).toBe(90);
    });

    test('returns empty array if no coaches', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });

      const result = await PatternAnalyzer._analyzeCoachPerformance();

      expect(result).toEqual([]);
    });

    test('handles multiple coaches', async () => {
      db.query.mockResolvedValueOnce({
        rows: [
          {
            coach_id: 1,
            total_tasks: 10,
            completed: 9,
            overdue: 0,
          },
          {
            coach_id: 2,
            total_tasks: 8,
            completed: 7,
            overdue: 1,
          },
        ],
      });

      const result = await PatternAnalyzer._analyzeCoachPerformance();

      expect(result).toHaveLength(2);
      expect(result[0].coachId).toBe(1);
      expect(result[1].coachId).toBe(2);
    });

    test('handles query errors gracefully', async () => {
      db.query.mockRejectedValueOnce(new Error('Query failed'));

      const result = await PatternAnalyzer._analyzeCoachPerformance();

      expect(result).toEqual([]);
    });
  });

  describe('generateRecommendations()', () => {
    test('creates suggestions from patterns', async () => {
      const patterns = {
        completionRate: 90,
        commonBlockers: [{ blocker: 'blocked', count: 5 }],
        coachPerformance: [
          { coachId: 1, completionRate: 95, completed: 10, total: 10 },
        ],
      };

      const recs = await PatternAnalyzer.generateRecommendations(patterns);

      expect(Array.isArray(recs)).toBe(true);
      expect(recs.length).toBeGreaterThan(0);
      expect(typeof recs[0]).toBe('string');
    });

    test('suggests momentum when completion rate high', async () => {
      const patterns = {
        completionRate: 90,
        commonBlockers: [],
        coachPerformance: [],
      };

      const recs = await PatternAnalyzer.generateRecommendations(patterns);

      expect(recs.some(r => r.includes('momentum'))).toBe(true);
    });

    test('suggests support when completion rate low', async () => {
      const patterns = {
        completionRate: 50,
        commonBlockers: [],
        coachPerformance: [],
      };

      const recs = await PatternAnalyzer.generateRecommendations(patterns);

      expect(recs.some(r => r.includes('support') || r.includes('60%'))).toBe(
        true
      );
    });

    test('mentions top blocker if present', async () => {
      const patterns = {
        completionRate: 75,
        commonBlockers: [{ blocker: 'dependency', count: 3 }],
        coachPerformance: [],
      };

      const recs = await PatternAnalyzer.generateRecommendations(patterns);

      expect(recs.some(r => r.includes('dependency'))).toBe(true);
    });

    test('mentions top performer if present', async () => {
      const patterns = {
        completionRate: 80,
        commonBlockers: [],
        coachPerformance: [
          { coachId: 1, completionRate: 95 },
          { coachId: 2, completionRate: 70 },
        ],
      };

      const recs = await PatternAnalyzer.generateRecommendations(patterns);

      expect(recs.some(r => r.includes('Top performer'))).toBe(true);
    });

    test('mentions low performer if completion rate < 50%', async () => {
      const patterns = {
        completionRate: 70,
        commonBlockers: [],
        coachPerformance: [
          { coachId: 1, completionRate: 90 },
          { coachId: 2, completionRate: 40, completed: 2, total: 5 },
        ],
      };

      const recs = await PatternAnalyzer.generateRecommendations(patterns);

      expect(recs.some(r => r.includes('support'))).toBe(true);
    });

    test('returns array of strings', async () => {
      const patterns = {
        completionRate: 75,
        commonBlockers: [],
        coachPerformance: [],
      };

      const recs = await PatternAnalyzer.generateRecommendations(patterns);

      expect(Array.isArray(recs)).toBe(true);
      recs.forEach(rec => {
        expect(typeof rec).toBe('string');
      });
    });

    test('handles null/undefined patterns gracefully', async () => {
      const patterns = {
        completionRate: 75,
        commonBlockers: null,
        coachPerformance: undefined,
      };

      // Should not throw, should skip null/undefined checks
      const recs = await PatternAnalyzer.generateRecommendations(patterns);

      expect(Array.isArray(recs)).toBe(true);
      recs.forEach(rec => {
        expect(typeof rec).toBe('string');
      });
    });

    test('handles missing coach properties in coachPerformance', async () => {
      const patterns = {
        completionRate: 85,
        commonBlockers: [],
        coachPerformance: [
          { coachId: 1, completionRate: 90 },
          { coachId: undefined, completionRate: undefined }, // Missing properties
        ],
      };

      const recs = await PatternAnalyzer.generateRecommendations(patterns);

      expect(Array.isArray(recs)).toBe(true);
      // Should not crash and should include top performer
      expect(recs.some(r => r.includes('Top performer'))).toBe(true);
    });
  });
});
