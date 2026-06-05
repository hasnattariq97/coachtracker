/**
 * Test setup: Initialize test environment and clean up after tests
 */

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-key-minimum-32-characters-requirement';
process.env.GROQ_API_KEY = process.env.GROQ_API_KEY || 'test-key-for-unit-tests-only';

const { stopJobs } = require('./cron');

afterAll(() => {
  stopJobs();
}, 5000);
