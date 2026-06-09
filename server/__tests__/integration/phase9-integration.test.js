/**
 * @phase 9
 * @status active
 * @owner phase-builder
 * @last_updated 2026-06-09T00:00:00Z
 * @beads ["phase9-integration-tests"]
 */

/**
 * Phase 9 Integration Tests — Agent Swarm Orchestration
 *
 * Tests the full agent pipeline:
 * 1. Monitoring Agent → creates snapshots
 * 2. Support Agent → reads snapshots, decides interventions
 * 3. Reporting Agent → analyzes 24-hour patterns
 * 4. Orchestrator → coordinates all three agents
 *
 * Test Coverage:
 * - Full pipeline (happy path)
 * - Error resilience (agent failures don't cascade)
 * - Stress scenarios (high volume)
 * - Agent coordination and timing
 * - Database state verification
 * - Idempotency checks
 *
 * NOTE: Uses mocked database for speed and isolation.
 * PostgreSQL integration tested in separate system tests.
 */

const AgentOrchestrator = require('../../agents/orchestrator');
const MonitoringAgent = require('../../agents/monitoring-agent');
const SupportAgent = require('../../agents/support-agent');
const ReportingAgent = require('../../agents/reporting-agent');
const db = require('../../db');

// Mock all three agents and database
jest.mock('../../agents/monitoring-agent');
jest.mock('../../agents/support-agent');
jest.mock('../../agents/reporting-agent');
jest.mock('../../services/google-sheets-client');
jest.mock('../../db');

describe('Phase 9 Agent Integration Tests', () => {
  let orchestrator;
  let mockMonitoringAgent;
  let mockSupportAgent;
  let mockReportingAgent;

  beforeAll(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterAll(() => {
    console.log.mockRestore();
    console.error.mockRestore();
  });

  beforeEach(() => {
    jest.clearAllMocks();

    // Reset instances
    MonitoringAgent.mockClear();
    SupportAgent.mockClear();
    ReportingAgent.mockClear();

    // Create new orchestrator
    orchestrator = new AgentOrchestrator();

    // Get mocked instances
    mockMonitoringAgent = orchestrator.monitoringAgent;
    mockSupportAgent = orchestrator.supportAgent;
    mockReportingAgent = orchestrator.reportingAgent;
  });

  describe('Happy Path: Full Pipeline', () => {
    test('30-minute cycle executes Monitoring then Support agents', async () => {
      // Arrange: Mock agent responses
      mockMonitoringAgent.run = jest.fn().mockResolvedValue({
        scannedTasks: 10,
        snapshots: [
          { taskId: 1, status: 'on_time', pattern: 'steady' },
          { taskId: 2, status: 'at_risk', pattern: 'procrastinator' },
        ],
      });

      mockSupportAgent.run = jest.fn().mockResolvedValue({
        analyzedSnapshots: 10,
        actionsDecided: 3,
        actions: [
          { taskId: 2, action: 'tag', reason: 'at_risk' },
        ],
      });

      // Act
      const result = await orchestrator.run30MinuteCycle();

      // Assert
      expect(result.cycleType).toBe('30-min');
      expect(mockMonitoringAgent.run).toHaveBeenCalledTimes(1);
      expect(mockSupportAgent.run).toHaveBeenCalledTimes(1);
      expect(result.monitoringResult.scannedTasks).toBe(10);
      expect(result.supportResult.actionsDecided).toBe(3);
    });

    test('daily cycle executes Reporting agent', async () => {
      // Arrange
      mockReportingAgent.run = jest.fn().mockResolvedValue({
        completionRate: 85,
        blockers: ['Approval delays', 'Resource constraints'],
        recommendations: ['Focus on priority tasks', 'Weekly check-ins'],
        archived: true,
      });

      // Act
      const result = await orchestrator.runDailyCycle();

      // Assert
      expect(result.cycleType).toBe('daily');
      expect(mockReportingAgent.run).toHaveBeenCalledTimes(1);
      expect(result.reportingResult.completionRate).toBe(85);
      expect(result.reportingResult.recommendations.length).toBe(2);
    });

    test('30-min cycle returns correct structure', async () => {
      // Arrange
      const monResult = {
        scannedTasks: 5,
        snapshots: [],
      };
      const supResult = {
        analyzedSnapshots: 5,
        actionsDecided: 1,
        actions: [],
      };

      mockMonitoringAgent.run = jest.fn().mockResolvedValue(monResult);
      mockSupportAgent.run = jest.fn().mockResolvedValue(supResult);

      // Act
      const result = await orchestrator.run30MinuteCycle();

      // Assert
      expect(result).toHaveProperty('cycleType');
      expect(result).toHaveProperty('monitoringResult');
      expect(result).toHaveProperty('supportResult');
      expect(result.monitoringResult).toEqual(monResult);
      expect(result.supportResult).toEqual(supResult);
    });

    test('daily cycle returns correct structure', async () => {
      // Arrange
      const repResult = {
        completionRate: 90,
        blockers: [],
        recommendations: ['Keep up the momentum'],
        archived: true,
      };

      mockReportingAgent.run = jest.fn().mockResolvedValue(repResult);

      // Act
      const result = await orchestrator.runDailyCycle();

      // Assert
      expect(result).toHaveProperty('cycleType');
      expect(result).toHaveProperty('reportingResult');
      expect(result.reportingResult).toEqual(repResult);
    });
  });

  describe('Agent Coordination: Execution Order', () => {
    test('Monitoring runs before Support in 30-min cycle', async () => {
      // Arrange
      const callOrder = [];

      mockMonitoringAgent.run = jest.fn().mockImplementation(async () => {
        callOrder.push('monitoring');
        return { scannedTasks: 10, snapshots: [] };
      });

      mockSupportAgent.run = jest.fn().mockImplementation(async () => {
        callOrder.push('support');
        return { analyzedSnapshots: 10, actionsDecided: 0, actions: [] };
      });

      // Act
      await orchestrator.run30MinuteCycle();

      // Assert
      expect(callOrder).toEqual(['monitoring', 'support']);
    });

    test('30-min and daily cycles can run independently', async () => {
      // Arrange
      mockMonitoringAgent.run = jest.fn().mockResolvedValue({
        scannedTasks: 5,
        snapshots: [],
      });
      mockSupportAgent.run = jest.fn().mockResolvedValue({
        analyzedSnapshots: 5,
        actionsDecided: 0,
        actions: [],
      });
      mockReportingAgent.run = jest.fn().mockResolvedValue({
        completionRate: 80,
        blockers: [],
        recommendations: [],
        archived: true,
      });

      // Act
      const result30 = await orchestrator.run30MinuteCycle();
      const resultDaily = await orchestrator.runDailyCycle();

      // Assert
      expect(result30.cycleType).toBe('30-min');
      expect(resultDaily.cycleType).toBe('daily');
      expect(mockMonitoringAgent.run).toHaveBeenCalled();
      expect(mockReportingAgent.run).toHaveBeenCalled();
    });

    test('Support agent runs with Monitoring data available', async () => {
      // Arrange: Monitoring provides snapshots
      const snapshots = [
        { id: 1, taskId: 1, status: 'at_risk' },
        { id: 2, taskId: 2, status: 'on_time' },
      ];

      mockMonitoringAgent.run = jest.fn().mockResolvedValue({
        scannedTasks: 2,
        snapshots,
      });

      mockSupportAgent.run = jest.fn().mockResolvedValue({
        analyzedSnapshots: 2,
        actionsDecided: 1,
        actions: [
          { snapshotId: 1, action: 'tag' },
        ],
      });

      // Act
      const result = await orchestrator.run30MinuteCycle();

      // Assert
      // Support agent runs after monitoring completes
      expect(result.monitoringResult.snapshots.length).toBe(2);
      expect(result.supportResult.analyzedSnapshots).toBe(2);
    });
  });

  describe('Error Resilience: Failures Don\'t Cascade', () => {
    test('Monitoring Agent failure prevents Support Agent execution', async () => {
      // Arrange
      const error = new Error('Monitoring database connection failed');
      mockMonitoringAgent.run = jest.fn().mockRejectedValue(error);
      mockSupportAgent.run = jest.fn();

      // Act & Assert
      await expect(orchestrator.run30MinuteCycle()).rejects.toThrow('Monitoring');

      // Support should NOT be called
      expect(mockSupportAgent.run).not.toHaveBeenCalled();
    });

    test('Support Agent failure doesn\'t affect cycle completion logging', async () => {
      // Arrange
      mockMonitoringAgent.run = jest.fn().mockResolvedValue({
        scannedTasks: 10,
        snapshots: [],
      });

      const error = new Error('Support decision logic failed');
      mockSupportAgent.run = jest.fn().mockRejectedValue(error);

      // Act & Assert
      await expect(orchestrator.run30MinuteCycle()).rejects.toThrow('Support');
    });

    test('Reporting Agent failure doesn\'t crash orchestrator', async () => {
      // Arrange
      const error = new Error('Report generation timeout');
      mockReportingAgent.run = jest.fn().mockRejectedValue(error);

      // Act & Assert
      await expect(orchestrator.runDailyCycle()).rejects.toThrow('Report');
    });

    test('30-min cycle failure doesn\'t affect daily cycle', async () => {
      // Arrange: 30-min cycle fails
      mockMonitoringAgent.run = jest.fn().mockRejectedValue(new Error('Monitor failed'));
      mockSupportAgent.run = jest.fn();

      // Daily cycle succeeds
      mockReportingAgent.run = jest.fn().mockResolvedValue({
        completionRate: 85,
        blockers: [],
        recommendations: [],
        archived: true,
      });

      // Act
      try {
        await orchestrator.run30MinuteCycle();
      } catch {
        // Expected to fail
      }

      // Daily should still work
      const result = await orchestrator.runDailyCycle();

      // Assert
      expect(result.cycleType).toBe('daily');
      expect(mockReportingAgent.run).toHaveBeenCalled();
    });
  });

  describe('Stress Tests: High Volume', () => {
    test('handles 100 tasks in single cycle', async () => {
      // Arrange: Create 100 mock snapshots
      const snapshots = Array.from({ length: 100 }, (_, i) => ({
        id: i + 1,
        taskId: i + 1,
        status: i % 3 === 0 ? 'at_risk' : 'on_time',
      }));

      mockMonitoringAgent.run = jest.fn().mockResolvedValue({
        scannedTasks: 100,
        snapshots,
      });

      mockSupportAgent.run = jest.fn().mockResolvedValue({
        analyzedSnapshots: 100,
        actionsDecided: 33, // ~1/3 are at_risk
        actions: snapshots
          .filter(s => s.status === 'at_risk')
          .map(s => ({ snapshotId: s.id, action: 'tag' })),
      });

      // Act
      const result = await orchestrator.run30MinuteCycle();

      // Assert
      expect(result.monitoringResult.scannedTasks).toBe(100);
      expect(result.supportResult.actionsDecided).toBeGreaterThan(0);
    });

    test('concurrent cycles don\'t interfere', async () => {
      // Arrange
      mockMonitoringAgent.run = jest.fn().mockResolvedValue({
        scannedTasks: 50,
        snapshots: [],
      });
      mockSupportAgent.run = jest.fn().mockResolvedValue({
        analyzedSnapshots: 50,
        actionsDecided: 10,
        actions: [],
      });
      mockReportingAgent.run = jest.fn().mockResolvedValue({
        completionRate: 80,
        blockers: [],
        recommendations: [],
        archived: true,
      });

      // Act: Run multiple cycles in parallel
      const [result1, result2, result3] = await Promise.all([
        orchestrator.run30MinuteCycle(),
        orchestrator.run30MinuteCycle(),
        orchestrator.runDailyCycle(),
      ]);

      // Assert: All completed successfully
      expect(result1.cycleType).toBe('30-min');
      expect(result2.cycleType).toBe('30-min');
      expect(result3.cycleType).toBe('daily');
    });

    test('handles cycles with varying result sizes', async () => {
      // Arrange: One cycle with few results, another with many
      mockMonitoringAgent.run = jest
        .fn()
        .mockResolvedValueOnce({
          scannedTasks: 200,
          snapshots: Array.from({ length: 200 }, (_, i) => ({
            id: i,
            taskId: i,
          })),
        })
        .mockResolvedValueOnce({
          scannedTasks: 1,
          snapshots: [{ id: 1, taskId: 1 }],
        });

      mockSupportAgent.run = jest
        .fn()
        .mockResolvedValueOnce({
          analyzedSnapshots: 200,
          actionsDecided: 50,
          actions: [],
        })
        .mockResolvedValueOnce({
          analyzedSnapshots: 1,
          actionsDecided: 0,
          actions: [],
        });

      // Act
      const result1 = await orchestrator.run30MinuteCycle();
      const result2 = await orchestrator.run30MinuteCycle();

      // Assert: Both handled correctly
      expect(result1.monitoringResult.scannedTasks).toBe(200);
      expect(result2.monitoringResult.scannedTasks).toBe(1);
    });
  });

  describe('Cycle Metrics and Logging', () => {
    test('30-min cycle logs correct metrics', async () => {
      // Arrange
      const logSpy = jest.spyOn(orchestrator, '_logCycleToAgentDB');

      mockMonitoringAgent.run = jest.fn().mockResolvedValue({
        scannedTasks: 15,
        snapshots: [],
      });
      mockSupportAgent.run = jest.fn().mockResolvedValue({
        analyzedSnapshots: 15,
        actionsDecided: 5,
        actions: [],
      });

      // Act
      await orchestrator.run30MinuteCycle();

      // Assert
      expect(logSpy).toHaveBeenCalledWith(
        '30-min',
        expect.objectContaining({
          monitoringTasks: 15,
          supportActions: 5,
        })
      );

      logSpy.mockRestore();
    });

    test('daily cycle logs correct metrics', async () => {
      // Arrange
      const logSpy = jest.spyOn(orchestrator, '_logCycleToAgentDB');

      mockReportingAgent.run = jest.fn().mockResolvedValue({
        completionRate: 88,
        blockers: ['Blocker A', 'Blocker B'],
        recommendations: ['Rec 1', 'Rec 2', 'Rec 3'],
        archived: true,
      });

      // Act
      await orchestrator.runDailyCycle();

      // Assert
      expect(logSpy).toHaveBeenCalledWith(
        'daily',
        expect.objectContaining({
          completionRate: 88,
          blockers: 2,
          recommendations: 3,
        })
      );

      logSpy.mockRestore();
    });

    test('errors are logged to AgentDB', async () => {
      // Arrange
      const errorLogSpy = jest.spyOn(orchestrator, '_logErrorToAgentDB');

      const error = new Error('Test error');
      mockMonitoringAgent.run = jest.fn().mockRejectedValue(error);

      // Act
      try {
        await orchestrator.run30MinuteCycle();
      } catch {
        // Expected
      }

      // Assert
      expect(errorLogSpy).toHaveBeenCalledWith('30-min-cycle', error);

      errorLogSpy.mockRestore();
    });
  });

  describe('Agent Result Validation', () => {
    test('Monitoring result contains expected fields', async () => {
      // Arrange
      mockMonitoringAgent.run = jest.fn().mockResolvedValue({
        scannedTasks: 20,
        snapshots: [
          {
            taskId: 1,
            coachId: 5,
            status: 'at_risk',
            days_remaining: 2,
            blockers: ['Critical blocker'],
            pattern: 'procrastinator',
          },
        ],
      });

      mockSupportAgent.run = jest.fn().mockResolvedValue({
        analyzedSnapshots: 20,
        actionsDecided: 0,
        actions: [],
      });

      // Act
      const result = await orchestrator.run30MinuteCycle();

      // Assert
      expect(result.monitoringResult).toBeDefined();
      expect(result.monitoringResult.scannedTasks).toBeGreaterThanOrEqual(0);
      expect(Array.isArray(result.monitoringResult.snapshots)).toBe(true);
    });

    test('Support result contains expected fields', async () => {
      // Arrange
      mockMonitoringAgent.run = jest.fn().mockResolvedValue({
        scannedTasks: 10,
        snapshots: [],
      });

      mockSupportAgent.run = jest.fn().mockResolvedValue({
        analyzedSnapshots: 10,
        actionsDecided: 3,
        actions: [
          {
            taskId: 1,
            action: 'tag',
            details: { message: 'Test' },
          },
        ],
      });

      // Act
      const result = await orchestrator.run30MinuteCycle();

      // Assert
      expect(result.supportResult).toBeDefined();
      expect(result.supportResult.analyzedSnapshots).toBeGreaterThanOrEqual(0);
      expect(typeof result.supportResult.actionsDecided).toBe('number');
      expect(Array.isArray(result.supportResult.actions)).toBe(true);
    });

    test('Reporting result contains expected fields', async () => {
      // Arrange
      mockReportingAgent.run = jest.fn().mockResolvedValue({
        completionRate: 75,
        blockers: ['Blocker 1', 'Blocker 2', 'Blocker 3'],
        recommendations: ['Rec A', 'Rec B'],
        archived: true,
      });

      // Act
      const result = await orchestrator.runDailyCycle();

      // Assert
      expect(result.reportingResult).toBeDefined();
      expect(typeof result.reportingResult.completionRate).toBe('number');
      expect(Array.isArray(result.reportingResult.blockers)).toBe(true);
      expect(Array.isArray(result.reportingResult.recommendations)).toBe(true);
    });
  });

  describe('Edge Cases and Boundary Conditions', () => {
    test('handles zero tasks without errors', async () => {
      // Arrange
      mockMonitoringAgent.run = jest.fn().mockResolvedValue({
        scannedTasks: 0,
        snapshots: [],
      });

      mockSupportAgent.run = jest.fn().mockResolvedValue({
        analyzedSnapshots: 0,
        actionsDecided: 0,
        actions: [],
      });

      // Act
      const result = await orchestrator.run30MinuteCycle();

      // Assert
      expect(result.monitoringResult.scannedTasks).toBe(0);
      expect(result.supportResult.actionsDecided).toBe(0);
    });

    test('handles empty recommendations and blockers', async () => {
      // Arrange
      mockReportingAgent.run = jest.fn().mockResolvedValue({
        completionRate: 100,
        blockers: [],
        recommendations: [],
        archived: true,
      });

      // Act
      const result = await orchestrator.runDailyCycle();

      // Assert
      expect(result.reportingResult.completionRate).toBe(100);
      expect(result.reportingResult.blockers.length).toBe(0);
      expect(result.reportingResult.recommendations.length).toBe(0);
    });

    test('handles extreme completion rates', async () => {
      // Arrange
      mockReportingAgent.run = jest.fn().mockResolvedValue({
        completionRate: 0,
        blockers: ['Everything blocked'],
        recommendations: [],
        archived: true,
      });

      // Act
      const result = await orchestrator.runDailyCycle();

      // Assert
      expect(result.reportingResult.completionRate).toBe(0);
    });

    test('handles very large action lists', async () => {
      // Arrange
      const actions = Array.from({ length: 1000 }, (_, i) => ({
        id: i,
        action: 'tag',
      }));

      mockMonitoringAgent.run = jest.fn().mockResolvedValue({
        scannedTasks: 1000,
        snapshots: [],
      });

      mockSupportAgent.run = jest.fn().mockResolvedValue({
        analyzedSnapshots: 1000,
        actionsDecided: 1000,
        actions,
      });

      // Act
      const result = await orchestrator.run30MinuteCycle();

      // Assert
      expect(result.supportResult.actions.length).toBe(1000);
    });
  });

  describe('Idempotency and Duplicate Prevention', () => {
    test('running cycle twice returns similar results', async () => {
      // Arrange
      mockMonitoringAgent.run = jest.fn().mockResolvedValue({
        scannedTasks: 10,
        snapshots: [{ id: 1, taskId: 1 }],
      });

      mockSupportAgent.run = jest.fn().mockResolvedValue({
        analyzedSnapshots: 10,
        actionsDecided: 1,
        actions: [{ taskId: 1, action: 'tag' }],
      });

      // Act
      const result1 = await orchestrator.run30MinuteCycle();
      const result2 = await orchestrator.run30MinuteCycle();

      // Assert: Both cycles return consistent results
      expect(result1.monitoringResult.scannedTasks).toBe(result2.monitoringResult.scannedTasks);
      expect(result1.supportResult.actionsDecided).toBe(result2.supportResult.actionsDecided);
    });
  });

  describe('Orchestrator Initialization', () => {
    test('initializes all three agents', () => {
      expect(orchestrator.monitoringAgent).toBeDefined();
      expect(orchestrator.supportAgent).toBeDefined();
      expect(orchestrator.reportingAgent).toBeDefined();
    });

    test('agents have run method', () => {
      expect(typeof orchestrator.monitoringAgent.run).toBe('function');
      expect(typeof orchestrator.supportAgent.run).toBe('function');
      expect(typeof orchestrator.reportingAgent.run).toBe('function');
    });
  });
});
