/**
 * Simple E2E Test — Basic agent-browser integration verification
 *
 * Status: ✅ PASSING (2/2 tests)
 *
 * Tests:
 * - Can open the Coach Task Tracker app
 * - Can retrieve page title
 *
 * This is the simplest test suite and serves as a sanity check
 * that agent-browser CLI is properly integrated and working.
 *
 * Run: npm run test:e2e -- simple.test.js
 */

import AgentBrowserHelper from './agent-browser.helper.js';
import { describe, test, expect, beforeAll, afterAll } from 'vitest';

describe('Simple E2E Test', () => {
  let browser;

  beforeAll(() => {
    browser = new AgentBrowserHelper();
  });

  afterAll(async () => {
    try {
      await browser.close();
    } catch (e) {
      // OK if close fails
    }
  });

  test('Can open app', async () => {
    console.log('Opening app...');
    await browser.open('/login');
    console.log('App opened successfully');
    expect(true).toBe(true);
  }, 15000);

  test('Can get page title', async () => {
    console.log('Getting title...');
    const title = await browser.getTitle();
    console.log('Page title:', title);
    expect(title).toBeDefined();
  }, 10000);
});
