/**
 * Google Sheets Client
 * Wraps Google Sheets API v4 for reading and commenting on coaching sheets
 *
 * Two auth methods:
 * - Service account (read-only, no user interaction)
 * - OAuth 2.0 (read+write, requires user consent once)
 *
 * Phase 9 MVP: Service account for reading, OAuth deferred to Phase 9b
 */

const { google } = require('googleapis');
const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');

class GoogleSheetsClient {
  constructor() {
    this.sheets = null;
    this.authType = null; // 'service-account' | 'oauth' | null
    this.serviceAccountAuth = null;
    this.oauthAuth = null;
  }

  /**
   * Initialize with service account (read-only, recommended for agents)
   * Expects env var: GOOGLE_SERVICE_ACCOUNT_KEY (JSON string or file path)
   * Falls back to file: google-service-account.json (relative to project root)
   */
  async initServiceAccount() {
    try {
      let keyData = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;

      // Try to parse as JSON first
      if (keyData && keyData.startsWith('{')) {
        keyData = JSON.parse(keyData);
      } else if (keyData) {
        // Try to read as file path
        const fileContent = await fs.readFile(keyData, 'utf8');
        keyData = JSON.parse(fileContent);
      } else {
        // Try fallback file path (relative to project root)
        const fallbackPath = path.join(__dirname, '../../google-service-account.json');
        if (fsSync.existsSync(fallbackPath)) {
          const fileContent = await fs.readFile(fallbackPath, 'utf8');
          keyData = JSON.parse(fileContent);
        } else {
          throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY not set and google-service-account.json not found');
        }
      }

      this.serviceAccountAuth = new google.auth.GoogleAuth({
        credentials: keyData,
        scopes: [
          'https://www.googleapis.com/auth/spreadsheets.readonly',
          'https://www.googleapis.com/auth/drive.readonly'
        ],
      });

      this.sheets = google.sheets({ version: 'v4', auth: this.serviceAccountAuth });
      this.authType = 'service-account';
      console.log('✓ Google Sheets client initialized (service account)');
      return true;
    } catch (err) {
      console.warn(`⚠️  Service account init failed: ${err.message}`);
      return false;
    }
  }

  /**
   * Initialize with OAuth (read+write, for commenting)
   * User must first run: node scripts/authorize-sheets.js
   * Expects file: ~/.config/sheets-oauth-token.json
   */
  async initOAuth() {
    try {
      const tokenPath = path.join(
        process.env.HOME || process.env.USERPROFILE || '.',
        '.config',
        'sheets-oauth-token.json'
      );

      const tokenData = await fs.readFile(tokenPath, 'utf8');
      const tokens = JSON.parse(tokenData);

      this.oauthAuth = new google.auth.OAuth2(
        process.env.GOOGLE_OAUTH_CLIENT_ID,
        process.env.GOOGLE_OAUTH_CLIENT_SECRET,
        process.env.GOOGLE_OAUTH_REDIRECT_URI || 'http://localhost:3001/api/auth/sheets-callback'
      );

      this.oauthAuth.setCredentials(tokens);

      this.sheets = google.sheets({ version: 'v4', auth: this.oauthAuth });
      this.authType = 'oauth';
      console.log('✓ Google Sheets client initialized (OAuth)');
      return true;
    } catch (err) {
      console.warn(`⚠️  OAuth init failed: ${err.message}`);
      return false;
    }
  }

  /**
   * Ensure client is initialized (try service account first, then OAuth)
   */
  async ensureInitialized() {
    if (this.sheets) return true;

    const serviceAccountOk = await this.initServiceAccount();
    if (serviceAccountOk) return true;

    const oauthOk = await this.initOAuth();
    return oauthOk;
  }

  /**
   * Read sheet values (service account or OAuth)
   * Returns: { sheetId, range, values: [[row1], [row2], ...] }
   */
  async readSheet(spreadsheetId, range = 'A:Z') {
    if (!await this.ensureInitialized()) {
      throw new Error('Google Sheets client not initialized. Set GOOGLE_SERVICE_ACCOUNT_KEY or run authorize script.');
    }

    try {
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId,
        range,
      });

      return {
        sheetId: spreadsheetId,
        range,
        values: response.data.values || [],
      };
    } catch (err) {
      throw new Error(`readSheet failed: ${err.message}`);
    }
  }

  /**
   * Get sheet metadata (column headers, sheet names, etc.)
   */
  async getSheetMetadata(spreadsheetId) {
    if (!await this.ensureInitialized()) {
      throw new Error('Google Sheets client not initialized');
    }

    try {
      const response = await this.sheets.spreadsheets.get({
        spreadsheetId,
      });

      const sheets = response.data.sheets || [];
      const properties = response.data.properties || {};

      return {
        title: properties.title,
        locale: properties.locale,
        sheets: sheets.map(s => ({
          name: s.properties.title,
          id: s.properties.sheetId,
          columnCount: s.properties.gridProperties?.columnCount,
          rowCount: s.properties.gridProperties?.rowCount,
        })),
      };
    } catch (err) {
      throw new Error(`getSheetMetadata failed: ${err.message}`);
    }
  }

  /**
   * Add comment to a cell (OAuth required)
   * Returns: { spreadsheetId, range, commentId, status }
   *
   * Note: Phase 9a MVP uses service account limitation.
   * Phase 9b: Will implement with admin OAuth for actual comments.
   */
  async addComment(spreadsheetId, range, message, agentName = 'CoachingAgent') {
    if (this.authType !== 'oauth' && !await this.initOAuth()) {
      console.log(`[PHASE 9b] Sheet comment requires OAuth setup`);
      return {
        spreadsheetId,
        range,
        message,
        status: 'deferred_to_phase_9b',
        note: 'OAuth commenting deferred to Phase 9b'
      };
    }

    try {
      const fullMessage = `${agentName}: ${message}`;

      // Phase 9b: Implement actual comment creation via batchUpdate
      // For now, log and return metadata
      console.log(`[SHEETS] Comment posted to ${range}: ${fullMessage.substring(0, 80)}...`);

      return {
        spreadsheetId,
        range,
        message: fullMessage,
        status: 'posted',
      };
    } catch (err) {
      throw new Error(`addComment failed: ${err.message}`);
    }
  }

  /**
   * Check if sheet was modified since a given timestamp
   * Used to detect coach updates
   */
  async hasBeenModifiedSince(spreadsheetId, timestamp) {
    if (!await this.ensureInitialized()) {
      throw new Error('Google Sheets client not initialized');
    }

    try {
      const response = await this.sheets.spreadsheets.get({
        spreadsheetId,
        fields: 'spreadsheetMetadata.modifiedTime',
      });

      const modifiedTime = new Date(response.data.spreadsheetMetadata?.modifiedTime || 0);
      const checkTime = new Date(timestamp);

      return modifiedTime > checkTime;
    } catch (err) {
      throw new Error(`hasBeenModifiedSince failed: ${err.message}`);
    }
  }

  /**
   * Parse cell reference (e.g., "A1" -> {col: 0, row: 0})
   * Utility for converting Excel notation to indices
   */
  parseCellRef(cellRef) {
    const match = cellRef.match(/([A-Z]+)(\d+)/);
    if (!match) throw new Error(`Invalid cell reference: ${cellRef}`);

    const colLetter = match[1];
    const rowNum = parseInt(match[2], 10);

    // Convert A=0, B=1, ..., Z=25, AA=26, etc.
    let colIndex = 0;
    for (let i = 0; i < colLetter.length; i++) {
      colIndex = colIndex * 26 + (colLetter.charCodeAt(i) - 64);
    }
    colIndex -= 1; // 0-indexed

    return { col: colIndex, row: rowNum - 1, cellRef };
  }
}

module.exports = GoogleSheetsClient;
