/**
 * GroqService Tests
 *
 * Tests for the central Groq API wrapper service with queue management.
 * Covers queue operations, intervention analysis, coaching insights, and error handling.
 *
 * @phase 9b
 * @status active
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

  test('returns recommendation from Groq with confidence and reasoning', async () => {
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
    expect(result.reasoning).not.toContain('Groq unavailable'); // Groq succeeded
  });

  test('returns fallback recommendation if Groq times out', async () => {
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
    // For overdue + procrastinator, fallback should recommend escalate
    expect(result.recommendation).toBe('escalate');
    expect(result.confidence).toBe(0); // Low confidence when using fallback
    expect(result.reasoning).toContain('Groq');
  });

  test('returns fallback recommendation if Groq returns invalid JSON', async () => {
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
    expect(result.recommendation).toBe('escalate'); // Phase 9 fallback for overdue+procrastinator
    expect(result.confidence).toBe(0);
    expect(result.reasoning).toContain('Phase 9 rules');
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
        expectedRecommendation: 'escalate',
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
        expectedRecommendation: 'email',
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
        expectedRecommendation: null,
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

      expect(result.recommendation).toBe(scenario.expectedRecommendation);
      expect(result.confidence).toBe(0); // Fallback always has low confidence
    }
  });

  test('returns null recommendation when client is unavailable', async () => {
    const serviceNoClient = new GroqService();
    serviceNoClient.client = null;

    const snapshot = {
      task_id: 1,
      coach_id: 1,
      status: 'at_risk',
      coach_pattern: 'steady',
      days_remaining: 2,
    };

    const result = await serviceNoClient.analyzeCoachForIntervention(snapshot, []);

    expect(result).toBeDefined();
    expect(result.recommendation).toBeNull();
    expect(result.confidence).toBe(0);
    expect(result.reasoning).toContain('unavailable');
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

  test('returns enhanced message with metrics and prediction from Groq', async () => {
    const coachHistory = [
      { id: 1, status: 'completed', completed_early: true, completed_late: false },
      { id: 2, status: 'completed', completed_on_time: true, completed_late: false },
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
    expect(result.message).toBe('You crushed this deadline. Keep building momentum.');
    expect(result.tone).toBe('encouraging');
    expect(result.metrics.length).toBeGreaterThan(0);
    expect(result.prediction).toBeDefined();
    expect(result.confidence).toBeGreaterThan(0.8);
  });

  test('returns fallback message if Groq unavailable', async () => {
    const coachHistory = [];
    const task = { id: 5, title: 'Test Task' };
    const eventType = 'completion';

    // Create service without Groq client
    const serviceNoGroq = new GroqService();
    serviceNoGroq.client = null;

    const result = await serviceNoGroq.enhanceCoachingInsight(coachHistory, task, eventType);

    expect(result).toBeDefined();
    expect(result.message).toBe('Good work. Keep going.');
    expect(result.tone).toBe('neutral');
    expect(result.metrics).toEqual([]);
    expect(result.prediction).toBe('');
    expect(result.confidence).toBe(0);
  });

  test('returns fallback message if Groq times out', async () => {
    const coachHistory = [
      { id: 1, status: 'completed', completed_late: false },
      { id: 2, status: 'completed', completed_late: false },
    ];
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
    expect(result.message).toBe('Good work. Keep going.');
    expect(result.confidence).toBe(0);
  });

  test('returns fallback message if coach history is empty', async () => {
    const coachHistory = [];
    const task = { id: 5, title: 'Test Task' };

    const result = await service.enhanceCoachingInsight(coachHistory, task, 'completion');

    expect(result).toBeDefined();
    expect(result.message).toBe('Good work. Keep going.');
    expect(result.confidence).toBe(0);
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

  test('logs Groq API errors to console and returns fallback', async () => {
    const snapshot = { task_id: 1, coach_id: 1, status: 'overdue', coach_pattern: 'steady' };
    const error = new Error('Groq API rate limited');

    mockGroq.chat.completions.create.mockRejectedValueOnce(error);

    const result = await service.analyzeCoachForIntervention(snapshot, []);

    // Should have logged error
    expect(consoleSpy).toHaveBeenCalled();
    // Should return fallback recommendation (email for overdue+steady)
    expect(result.recommendation).toBe('email');
    expect(result.confidence).toBe(0);
  });

  test('handles network errors gracefully', async () => {
    const snapshot = { task_id: 1, coach_id: 1, status: 'overdue' };
    const error = new Error('ECONNREFUSED: Connection refused');

    mockGroq.chat.completions.create.mockRejectedValueOnce(error);

    const result = await service.analyzeCoachForIntervention(snapshot, []);

    // Should return result with fallback, not throw
    expect(result).toBeDefined();
    expect(result.recommendation).toBeDefined();
    expect(result.confidence).toBe(0);
  });

  test('handles invalid payload gracefully', async () => {
    const result = await service.queueRequest('test', null);

    // Should handle null payload without crashing
    expect(result).toBeUndefined();
  });

  test('handles Groq response with missing fields', async () => {
    const snapshot = {
      task_id: 1,
      coach_id: 1,
      status: 'overdue',
      coach_pattern: 'steady',
    };

    mockGroq.chat.completions.create.mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: JSON.stringify({
              recommendation: 'email',
              // Missing confidence and reasoning
            }),
          },
        },
      ],
    });

    const result = await service.analyzeCoachForIntervention(snapshot, []);

    expect(result).toBeDefined();
    expect(result.recommendation).toBe('email');
    expect(result.confidence).toBe(0.5); // Default fallback
    expect(result.reasoning).toBe('No reasoning provided'); // Default fallback
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
