/**
 * Agent-Browser Configuration
 *
 * Run E2E tests against Coach Task Tracker
 */

export default {
  // Browser settings
  headless: false, // Set to true for CI/CD
  viewport: {
    width: 1280,
    height: 720,
  },

  // Timeout settings (ms)
  timeout: 30000,
  navigationTimeout: 10000,

  // Base URL for tests
  baseUrl: 'http://localhost:5173',

  // Screenshot directory
  screenshotDir: './screenshots',

  // Enable network interception for debugging
  recordHAR: false, // Set to true to record network traffic

  // Device emulation (optional)
  // device: 'iPhone 12',

  // Accessibility tree depth (for snapshots)
  snapshotDepth: 3,

  // Polling interval for element waits
  pollInterval: 100,
};
