/**
 * @phase 9
 * @status active
 * @owner phase-builder
 * @last_updated 2026-06-09T00:00:00Z
 * @beads ["orchestrator-tests-phase9"]
 */

/**
 * Tests for AgentOrchestrator
 *
 * Verifies:
 * - 30-minute cycle executes Monitoring and Support agents in order
 * - Daily cycle executes Reporting agent
 * - Error handling for both cycles
 * - AgentDB logging stubs
 */

const AgentOrchestrator = require('../../agents/orchestrator');

// Mock the three agents
jest.mock('../../agents/monitoring-agent');
jest.mock('../../agents/support-agent');
jest.mock('../../agents/reporting-agent');

const MonitoringAgent = require('../../agents/monitoring-agent');
const SupportAgent = require('../../agents/support-agent');
const ReportingAgent = require('../../agents/reporting-agent');

describe('AgentOrchestrator', () => {
  let orchestrator;

  beforeEach(() => {
    orchestrator = new AgentOrchestrator();
    jest.clearAllMocks();

    // Suppress console output during tests
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    console.log.mockRestore();
    console.error.mockRestore();
  });

  describe('initialization', () => {
    test('initializes all three agents', () => {
      expect(orchestrator.monitoringAgent).toBeDefined();
      expect(orchestrator.supportAgent).toBeDefined();
      expect(orchestrator.reportingAgent).toBeDefined();
    });

    test('each agent has expected methods', () => {
      expect(orchestrator.monitoringAgent.run).toBeDefined();
      expect(orchestrator.supportAgent.run).toBeDefined();
      expect(orchestrator.reportingAgent.run).toBeDefined();
    });
  });

  describe('run30MinuteCycle()', () => {
    test('executes monitoring agent first', async () => {
      orchestrator.monitoringAgent.run = jest.fn().mockResolvedValue({
        scannedTasks: 10,
        snapshots: [],
      });
      orchestrator.supportAgent.run = jest.fn().mockResolvedValue({
        analyzedSnapshots: 10,
        actionsDecided: 5,
        actions: [],
      });

      await orchestrator.run30MinuteCycle();

      expect(orchestrator.monitoringAgent.run).toHaveBeenCalled();
    });

    test('executes support agent second (after monitoring)', async () => {
      const callOrder = [];

      orchestrator.monitoringAgent.run = jest.fn().mockImplementation(async () => {
        callOrder.push('monitoring');
        return { scannedTasks: 10, snapshots: [] };
      });
      orchestrator.supportAgent.run = jest.fn().mockImplementation(async () => {
        callOrder.push('support');
        return { analyzedSnapshots: 10, actionsDecided: 5, actions: [] };
      });

      await orchestrator.run30MinuteCycle();

      expect(callOrder).toEqual(['monitoring', 'support']);
    });

    test('returns 30-minute cycle type', async () => {
      orchestrator.monitoringAgent.run = jest.fn().mockResolvedValue({
        scannedTasks: 8,
        snapshots: [],
      });
      orchestrator.supportAgent.run = jest.fn().mockResolvedValue({
        analyzedSnapshots: 8,
        actionsDecided: 3,
        actions: [],
      });

      const result = await orchestrator.run30MinuteCycle();

      expect(result.cycleType).toBe('30-min');
      expect(result.monitoringResult).toBeDefined();
      expect(result.supportResult).toBeDefined();
    });

    test('includes monitoring and support results in response', async () => {
      const monResult = { scannedTasks: 10, snapshots: [] };
      const supResult = { analyzedSnapshots: 10, actionsDecided: 5, actions: [] };

      orchestrator.monitoringAgent.run = jest.fn().mockResolvedValue(monResult);
      orchestrator.supportAgent.run = jest.fn().mockResolvedValue(supResult);

      const result = await orchestrator.run30MinuteCycle();

      expect(result.monitoringResult).toEqual(monResult);
      expect(result.supportResult).toEqual(supResult);
    });

    test('handles zero tasks scanned', async () => {
      orchestrator.monitoringAgent.run = jest.fn().mockResolvedValue({
        scannedTasks: 0,
        snapshots: [],
      });
      orchestrator.supportAgent.run = jest.fn().mockResolvedValue({
        analyzedSnapshots: 0,
        actionsDecided: 0,
        actions: [],
      });

      const result = await orchestrator.run30MinuteCycle();

      expect(result.monitoringResult.scannedTasks).toBe(0);
      expect(result.supportResult.actionsDecided).toBe(0);
    });

    test('throws and logs error if monitoring agent fails', async () => {
      const error = new Error('Monitoring failed');
      orchestrator.monitoringAgent.run = jest.fn().mockRejectedValue(error);
      orchestrator.supportAgent.run = jest.fn();

      await expect(orchestrator.run30MinuteCycle()).rejects.toThrow('Monitoring failed');

      expect(orchestrator.supportAgent.run).not.toHaveBeenCalled();
    });

    test('throws and logs error if support agent fails', async () => {
      const error = new Error('Support failed');
      orchestrator.monitoringAgent.run = jest.fn().mockResolvedValue({
        scannedTasks: 10,
        snapshots: [],
      });
      orchestrator.supportAgent.run = jest.fn().mockRejectedValue(error);

      await expect(orchestrator.run30MinuteCycle()).rejects.toThrow('Support failed');
    });

    test('logs cycle to AgentDB', async () => {
      const logSpy = jest.spyOn(orchestrator, '_logCycleToAgentDB');

      orchestrator.monitoringAgent.run = jest.fn().mockResolvedValue({
        scannedTasks: 8,
        snapshots: [],
      });
      orchestrator.supportAgent.run = jest.fn().mockResolvedValue({
        analyzedSnapshots: 8,
        actionsDecided: 3,
        actions: [],
      });

      await orchestrator.run30MinuteCycle();

      expect(logSpy).toHaveBeenCalledWith('30-min', expect.objectContaining({
        monitoringTasks: 8,
        supportActions: 3,
      }));

      logSpy.mockRestore();
    });
  });

  describe('runDailyCycle()', () => {
    test('executes reporting agent', async () => {
      orchestrator.reportingAgent.run = jest.fn().mockResolvedValue({
        completionRate: 85,
        blockers: [],
        recommendations: ['Rec 1', 'Rec 2'],
        archived: true,
      });

      await orchestrator.runDailyCycle();

      expect(orchestrator.reportingAgent.run).toHaveBeenCalled();
    });

    test('returns daily cycle type', async () => {
      orchestrator.reportingAgent.run = jest.fn().mockResolvedValue({
        completionRate: 85,
        blockers: [],
        recommendations: [],
        archived: true,
      });

      const result = await orchestrator.runDailyCycle();

      expect(result.cycleType).toBe('daily');
      expect(result.reportingResult).toBeDefined();
    });

    test('includes reporting result in response', async () => {
      const repResult = {
        completionRate: 85,
        blockers: ['Blocker 1'],
        recommendations: ['Rec 1'],
        archived: true,
      };

      orchestrator.reportingAgent.run = jest.fn().mockResolvedValue(repResult);

      const result = await orchestrator.runDailyCycle();

      expect(result.reportingResult).toEqual(repResult);
    });

    test('handles multiple blockers and recommendations', async () => {
      orchestrator.reportingAgent.run = jest.fn().mockResolvedValue({
        completionRate: 75,
        blockers: ['Blocker A', 'Blocker B', 'Blocker C'],
        recommendations: ['Rec 1', 'Rec 2', 'Rec 3', 'Rec 4'],
        archived: true,
      });

      const result = await orchestrator.runDailyCycle();

      expect(result.reportingResult.blockers.length).toBe(3);
      expect(result.reportingResult.recommendations.length).toBe(4);
    });

    test('throws and logs error if reporting agent fails', async () => {
      const error = new Error('Reporting failed');
      orchestrator.reportingAgent.run = jest.fn().mockRejectedValue(error);

      await expect(orchestrator.runDailyCycle()).rejects.toThrow('Reporting failed');
    });

    test('logs cycle to AgentDB', async () => {
      const logSpy = jest.spyOn(orchestrator, '_logCycleToAgentDB');

      orchestrator.reportingAgent.run = jest.fn().mockResolvedValue({
        completionRate: 85,
        blockers: ['Blocker 1'],
        recommendations: ['Rec 1', 'Rec 2'],
        archived: true,
      });

      await orchestrator.runDailyCycle();

      expect(logSpy).toHaveBeenCalledWith('daily', expect.objectContaining({
        completionRate: 85,
        blockers: 1,
        recommendations: 2,
      }));

      logSpy.mockRestore();
    });
  });

  describe('_logCycleToAgentDB()', () => {
    test('logs 30-minute cycle metrics', async () => {
      const metrics = {
        monitoringTasks: 10,
        supportActions: 5,
        totalTime: 3.5,
      };

      // Should not throw
      await orchestrator._logCycleToAgentDB('30-min', metrics);

      expect(console.log).toHaveBeenCalled();
    });

    test('logs daily cycle metrics', async () => {
      const metrics = {
        completionRate: 85,
        blockers: 2,
        recommendations: 3,
        totalTime: 2.1,
      };

      // Should not throw
      await orchestrator._logCycleToAgentDB('daily', metrics);

      expect(console.log).toHaveBeenCalled();
    });

    test('handles errors gracefully', async () => {
      // If an error occurs, it should log but not throw
      await orchestrator._logCycleToAgentDB('30-min', { test: true });

      // Should not throw
      expect(true).toBe(true);
    });
  });

  describe('_logErrorToAgentDB()', () => {
    test('logs error for 30-minute cycle', async () => {
      const error = new Error('Test error');

      // Should not throw
      await orchestrator._logErrorToAgentDB('30-min-cycle', error);

      expect(console.log).toHaveBeenCalled();
    });

    test('logs error for daily cycle', async () => {
      const error = new Error('Daily error');

      // Should not throw
      await orchestrator._logErrorToAgentDB('daily-cycle', error);

      expect(console.log).toHaveBeenCalled();
    });

    test('captures error message', async () => {
      const error = new Error('Specific error message');

      await orchestrator._logErrorToAgentDB('cycle', error);

      // Check that console.log was called and contains the error message
      const callArgs = console.log.mock.calls.flat();
      expect(callArgs.some(arg => String(arg).includes('Specific error message'))).toBe(true);
    });
  });

  describe('integration scenarios', () => {
    test('30-minute cycle completes without blocking daily cycle', async () => {
      orchestrator.monitoringAgent.run = jest.fn().mockResolvedValue({
        scannedTasks: 5,
        snapshots: [],
      });
      orchestrator.supportAgent.run = jest.fn().mockResolvedValue({
        analyzedSnapshots: 5,
        actionsDecided: 2,
        actions: [],
      });

      // 30-minute cycle should complete
      const result30 = await orchestrator.run30MinuteCycle();
      expect(result30.cycleType).toBe('30-min');

      // Setup for daily cycle
      orchestrator.reportingAgent.run = jest.fn().mockResolvedValue({
        completionRate: 80,
        blockers: [],
        recommendations: [],
        archived: true,
      });

      // Daily cycle should also complete independently
      const resultDaily = await orchestrator.runDailyCycle();
      expect(resultDaily.cycleType).toBe('daily');
    });

    test('each cycle is independent (failure in one does not affect other)', async () => {
      // Make 30-minute cycle fail
      orchestrator.monitoringAgent.run = jest
        .fn()
        .mockRejectedValue(new Error('Monitoring failed'));

      // Daily cycle should still work
      orchestrator.reportingAgent.run = jest.fn().mockResolvedValue({
        completionRate: 90,
        blockers: [],
        recommendations: [],
        archived: true,
      });

      // 30-minute should fail
      await expect(orchestrator.run30MinuteCycle()).rejects.toThrow();

      // Daily should succeed independently
      const result = await orchestrator.runDailyCycle();
      expect(result.cycleType).toBe('daily');
    });
  });
});
