/**
 * Agent-Browser Helper for Coach Task Tracker E2E Tests
 *
 * Provides utilities to interact with the app via agent-browser.
 * Usage: yarn test:e2e (once configured)
 */

import { execSync } from 'child_process';

class AgentBrowserHelper {
  constructor(baseUrl = 'http://localhost:5173') {
    this.baseUrl = baseUrl;
    this.sessionId = null;
    // Use npx to find the CLI in node_modules
    this.cli = 'npx agent-browser';
  }

  /**
   * Open URL (starts browser session)
   */
  async open(path = '/') {
    const url = `${this.baseUrl}${path}`;
    try {
      const result = execSync(`${this.cli} open "${url}"`, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] });
      console.log(`✓ Opened ${url}`);
      return result;
    } catch (error) {
      if (error.message.includes('ECONNREFUSED')) {
        throw new Error(`Cannot connect to ${url}. Ensure backend is running on :3001 and frontend on :5173`);
      }
      throw new Error(`Failed to open ${url}: ${error.message.split('\n')[0]}`);
    }
  }

  /**
   * Navigate to URL (alias for open)
   */
  async navigate(path = '/') {
    return this.open(path);
  }

  /**
   * Take snapshot of current page (accessibility tree with element refs)
   */
  async snapshot() {
    try {
      const result = execSync(`${this.cli} snapshot`, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] });

      // Handle malformed JSON from snapshot
      const trimmed = result.trim();
      if (!trimmed.startsWith('{')) {
        // If snapshot returns non-JSON (error message), return empty structure
        console.log('Snapshot warning:', trimmed.substring(0, 100));
        return { elements: [] };
      }

      return JSON.parse(trimmed);
    } catch (error) {
      console.log('Snapshot parse error - returning empty:', error.message.substring(0, 80));
      return { elements: [] };  // Return empty structure instead of failing
    }
  }

  /**
   * Click element by ref (e.g., @e5)
   */
  async click(elementRef) {
    try {
      const result = execSync(`${this.cli} click "${elementRef}"`, { encoding: 'utf-8' });
      console.log(`✓ Clicked ${elementRef}`);
      return result;
    } catch (error) {
      throw new Error(`Click failed on ${elementRef}: ${error.message}`);
    }
  }

  /**
   * Type text into focused element
   */
  async type(text) {
    try {
      const result = execSync(`${this.cli} type "${text}"`, { encoding: 'utf-8' });
      console.log(`✓ Typed: ${text}`);
      return result;
    } catch (error) {
      throw new Error(`Type failed: ${error.message}`);
    }
  }

  /**
   * Fill form field by ref
   */
  async fill(elementRef, value) {
    try {
      const result = execSync(`${this.cli} fill "${elementRef}" "${value}"`, { encoding: 'utf-8' });
      console.log(`✓ Filled ${elementRef} with value`);
      return result;
    } catch (error) {
      throw new Error(`Fill failed on ${elementRef}: ${error.message}`);
    }
  }

  /**
   * Wait for element (by ref or text)
   */
  async wait(selector, timeout = 5000) {
    try {
      const result = execSync(`${this.cli} wait "${selector}" --timeout=${timeout}`, { encoding: 'utf-8' });
      console.log(`✓ Element appeared: ${selector}`);
      return result;
    } catch (error) {
      throw new Error(`Wait timeout for ${selector}: ${error.message}`);
    }
  }

  /**
   * Take screenshot
   */
  async screenshot(filename = 'screenshot.png') {
    try {
      const result = execSync(`${this.cli} screenshot "${filename}"`, { encoding: 'utf-8' });
      console.log(`✓ Screenshot saved: ${filename}`);
      return result;
    } catch (error) {
      throw new Error(`Screenshot failed: ${error.message}`);
    }
  }

  /**
   * Get page title
   */
  async getTitle() {
    try {
      const result = execSync(`${this.cli} eval "document.title"`, { encoding: 'utf-8' });
      return result.trim();
    } catch (error) {
      throw new Error(`Failed to get title: ${error.message}`);
    }
  }

  /**
   * Find element ref by text content
   */
  async findByText(text) {
    const snap = await this.snapshot();
    const element = snap.elements?.find(el => el.text?.includes(text));
    return element?.ref || null;
  }

  /**
   * Close browser session
   */
  async close() {
    try {
      execSync(`${this.cli} close`, { encoding: 'utf-8' });
      console.log('✓ Browser session closed');
    } catch (error) {
      console.warn(`Warning: failed to close browser: ${error.message}`);
    }
  }
}

export default AgentBrowserHelper;
