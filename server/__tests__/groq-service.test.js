/**
 * GroqService Tests
 *
 * Tests for the central Groq API wrapper service with queue management.
 * Covers queue operations, intervention analysis, coaching insights, and error handling.
 *
 * @phase 9b
 * @status draft
 */

const GroqService = require('../services/groq-service');
const db = require('../db');

// Mock the groq-sdk module
jest.mock('groq-sdk');

describe('GroqService - Queue Management', () => {
  let service;

  beforeAll(() => {
    // Set test environment
    process.env.NODE_ENV = 'test';
    process.env.GROQ_API_KEY = 'test-key-12345';
  });

  beforeEach(() => {
    // Create fresh service instance for each test
    // Clear module cache to ensure fresh Groq mock
    jest.resetModules();
    jest.clearAllMocks();

    // Re-require after clearing mocks
    const Groq = require('groq-sdk');
    service = new GroqService();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('queueRequest skips database if database unavailable', async () => {
    // Mock database error
    jest.spyOn(db, 'query').mockRejectedValueOnce(new Error('Database connection failed'));

    const result = await service.queueRequest('test', {});

    // Should handle error gracefully without throwing
    expect(result).toBeUndefined();
  });

  test('queueRequest returns undefined for invalid arguments', async () => {
    const result = await service.queueRequest(null, {});
    expect(result).toBeUndefined();

    const result2 = await service.queueRequest('test', null);
    expect(result2).toBeUndefined();
  });
});

describe('GroqService - analyzeCoachForIntervention', () => {
  let service;
  let mockGroq;

  beforeEach(() => {
    // Reset Groq mock
    mockGroq = {
      chat: {
        completions: {
          create: jest.fn(),
        },
      },
    };

    // Inject mock into service
    const Groq = require('groq-sdk');
    Groq.mockImplementation(() => mockGroq);

    service = new GroqService();
    service.client = mockGroq; // Ensure client is set for tests
  });

  test('returns recommendation with confidence and reasoning', async () => {
    const snapshot = {
      task_id: 5,
      coach_id: 1,
      status: 'overdue',
      coach_pattern: 'procrastinator',
      days_remaining: -2,
    };
    const coachHistory = [
      { id: 1, status: 'completed', completed_late: true },
      { id: 2, status: 'completed', completed_late: true },
    ];

    mockGroq.chat.completions.create.mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: JSON.stringify({
              recommendation: 'escalate',
              confidence: 0.92,
              reasoning: 'Pattern shows procrastination; escalation has worked before.',
            }),
          },
        },
      ],
    });

    const result = await service.analyzeCoachForIntervention(snapshot, coachHistory);

    expect(result).toBeDefined();
    expect(result.recommendation).toBe('escalate');
    expect(result.confidence).toBeGreaterThan(0.8);
    expect(result.reasoning).toBeDefined();
  });

  test('returns fallback rule if Groq times out', async () => {
    const snapshot = {
      task_id: 5,
      coach_id: 1,
      status: 'overdue',
      coach_pattern: 'procrastinator',
      days_remaining: -2,
    };
    const coachHistory = [];

    // Simulate timeout
    mockGroq.chat.completions.create.mockImplementationOnce(
      () => new Promise((_, reject) =>
        setTimeout(() => reject(new Error('API call timeout')), 100)
      )
    );

    const result = await service.analyzeCoachForIntervention(snapshot, coachHistory);

    expect(result).toBeDefined();
    expect(result.fallbackRule).toBeDefined();
    // For overdue + procrastinator, should recommend escalate
    expect(['escalate', 'email']).toContain(result.fallbackRule);
  });

  test('returns fallback rule if Groq returns invalid JSON', async () => {
    const snapshot = {
      task_id: 5,
      coach_id: 1,
      status: 'overdue',
      coach_pattern: 'procrastinator',
      days_remaining: -2,
    };
    const coachHistory = [];

    mockGroq.chat.completions.create.mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: 'This is not valid JSON at all!!!',
          },
        },
      ],
    });

    const result = await service.analyzeCoachForIntervention(snapshot, coachHistory);

    expect(result).toBeDefined();
    expect(result.fallbackRule).toBeDefined();
  });

  test('applies correct fallback logic for different coach patterns', async () => {
    const scenarios = [
      {
        name: 'overdue + procrastinator -> escalate',
        snapshot: {
          task_id: 1,
          coach_id: 1,
          status: 'overdue',
          coach_pattern: 'procrastinator',
          days_remaining: -5,
        },
        expectedFallback: 'escalate',
      },
      {
        name: 'overdue + steady -> email',
        snapshot: {
          task_id: 2,
          coach_id: 1,
          status: 'overdue',
          coach_pattern: 'steady',
          days_remaining: -2,
        },
        expectedFallback: 'email',
      },
      {
        name: 'at_risk without blockers -> null',
        snapshot: {
          task_id: 3,
          coach_id: 1,
          status: 'at_risk',
          coach_pattern: 'fast_track',
          days_remaining: 2,
        },
        expectedFallback: null,
      },
    ];

    for (const scenario of scenarios) {
      // Simulate timeout to trigger fallback
      mockGroq.chat.completions.create.mockImplementationOnce(
        () => new Promise((_, reject) =>
          setTimeout(() => reject(new Error('timeout')), 50)
        )
      );

      const result = await service.analyzeCoachForIntervention(scenario.snapshot, []);

      expect(result.fallbackRule).toBe(scenario.expectedFallback);
    }
  });
});

describe('GroqService - enhanceCoachingInsight', () => {
  let service;
  let mockGroq;

  beforeEach(() => {
    mockGroq = {
      chat: {
        completions: {
          create: jest.fn(),
        },
      },
    };

    const Groq = require('groq-sdk');
    Groq.mockImplementation(() => mockGroq);

    service = new GroqService();
    service.client = mockGroq; // Ensure client is set for tests
  });

  test('returns enhanced message with metrics and prediction', async () => {
    const coachHistory = [
      { id: 1, status: 'completed', completed_early: true },
      { id: 2, status: 'completed', completed_on_time: true },
    ];
    const task = { id: 5, title: 'Q2 Strategy', priority: 'high' };
    const eventType = 'completion';

    mockGroq.chat.completions.create.mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: JSON.stringify({
              message: 'You crushed this deadline. Keep building momentum.',
              tone: 'encouraging',
              metrics: ['on_time_completion_rate: 85%'],
              prediction: 'likely to meet next deadline',
              confidence: 0.88,
            }),
          },
        },
      ],
    });

    const result = await service.enhanceCoachingInsight(coachHistory, task, eventType);

    expect(result).toBeDefined();
    expect(result.message).toBeDefined();
    expect(result.tone).toBeDefined();
    expect(result.metrics).toBeDefined();
    expect(result.prediction).toBeDefined();
  });

  test('returns fallback message if Groq unavailable', async () => {
    const coachHistory = [];
    const task = { id: 5, title: 'Test Task' };
    const eventType = 'completion';

    // Don't initialize Groq (no API key)
    const serviceNoGroq = new GroqService();
    // Override the client to be null
    serviceNoGroq.client = null;

    const result = await serviceNoGroq.enhanceCoachingInsight(coachHistory, task, eventType);

    expect(result).toBeDefined();
    expect(result.message).toBe('Good work. Keep going.');
    expect(result.confidence).toBe(0);
  });

  test('returns fallback message if Groq times out', async () => {
    const coachHistory = [{ id: 1, status: 'completed' }];
    const task = { id: 5, title: 'Test Task' };
    const eventType = 'completion';

    // Simulate timeout
    mockGroq.chat.completions.create.mockImplementationOnce(
      () => new Promise((_, reject) =>
        setTimeout(() => reject(new Error('timeout')), 50)
      )
    );

    const result = await service.enhanceCoachingInsight(coachHistory, task, eventType);

    expect(result).toBeDefined();
    expect(result.message).toBeDefined();
    expect(result.confidence).toBeLessThanOrEqual(0);
  });
});

describe('GroqService - Error Handling', () => {
  let service;
  let mockGroq;
  let consoleSpy;

  beforeEach(() => {
    mockGroq = {
      chat: {
        completions: {
          create: jest.fn(),
        },
      },
    };

    const Groq = require('groq-sdk');
    Groq.mockImplementation(() => mockGroq);

    service = new GroqService();
    service.client = mockGroq; // Ensure client is set
    consoleSpy = jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  test('logs Groq API errors to console', async () => {
    const snapshot = { task_id: 1, coach_id: 1, status: 'overdue', coach_pattern: 'steady' };
    const error = new Error('Groq API rate limited');

    mockGroq.chat.completions.create.mockRejectedValueOnce(error);

    const result = await service.analyzeCoachForIntervention(snapshot, []);

    // Should have logged error
    expect(consoleSpy).toHaveBeenCalled();
    // Should return fallback
    expect(result.fallbackRule).toBe('email');
  });

  test('handles network errors gracefully', async () => {
    const snapshot = { task_id: 1, coach_id: 1, status: 'overdue' };
    const error = new Error('ECONNREFUSED: Connection refused');

    mockGroq.chat.completions.create.mockRejectedValueOnce(error);

    const result = await service.analyzeCoachForIntervention(snapshot, []);

    // Should return result with fallback, not throw
    expect(result).toBeDefined();
    expect(result.fallbackRule).toBeDefined();
  });

  test('handles invalid payload gracefully', async () => {
    const result = await service.queueRequest('test', null);

    // Should handle null payload without crashing
    expect(result).toBeUndefined();
  });
});

describe('GroqService - Queue Processing', () => {
  let service;
  let mockGroq;

  beforeEach(() => {
    mockGroq = {
      chat: {
        completions: {
          create: jest.fn(),
        },
      },
    };

    const Groq = require('groq-sdk');
    Groq.mockImplementation(() => mockGroq);

    service = new GroqService();
    service.client = mockGroq; // Ensure client is set
  });

  test('processQueue dequeues and processes pending requests', async () => {
    mockGroq.chat.completions.create.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              recommendation: 'email',
              confidence: 0.8,
              reasoning: 'test',
            }),
          },
        },
      ],
    });

    const result = await service.processQueue();

    expect(result).toBeDefined();
    expect(typeof result.processed).toBe('number');
    expect(typeof result.pending).toBe('number');
  });

  test('processQueue returns count of processed and pending requests', async () => {
    const result = await service.processQueue();

    expect(result).toHaveProperty('processed');
    expect(result).toHaveProperty('pending');
    expect(typeof result.processed).toBe('number');
    expect(typeof result.pending).toBe('number');
  });
});

describe('GroqService - Initialization', () => {
  test('initializes without Groq API key in test mode', () => {
    process.env.NODE_ENV = 'test';
    delete process.env.GROQ_API_KEY;

    const service = new GroqService();

    expect(service).toBeDefined();
    expect(service.client).toBeNull();
  });

  test('initializes with Groq API key when provided', () => {
    process.env.NODE_ENV = 'production';
    process.env.GROQ_API_KEY = 'test-key-12345';

    const Groq = require('groq-sdk');
    Groq.mockImplementation(() => ({ chat: { completions: { create: jest.fn() } } }));

    const service = new GroqService();

    expect(service).toBeDefined();
  });
});
