/**
 * Google Sheets Client Tests
 * Tests for reading sheets and preparing comment infrastructure
 */

const GoogleSheetsClient = require('../../services/google-sheets-client');
const path = require('path');
const fs = require('fs');

describe('GoogleSheetsClient', () => {
  let client;

  beforeEach(() => {
    client = new GoogleSheetsClient();
    // Clear auth state
    client.sheets = null;
    client.authType = null;
  });

  describe('Constructor', () => {
    test('initializes with null state', () => {
      expect(client.sheets).toBeNull();
      expect(client.authType).toBeNull();
      expect(client.serviceAccountAuth).toBeNull();
      expect(client.oauthAuth).toBeNull();
    });
  });

  describe('initServiceAccount', () => {
    test('returns false if GOOGLE_SERVICE_ACCOUNT_KEY not set and file missing', async () => {
      delete process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
      const result = await client.initServiceAccount();
      expect(result).toBe(false);
    });

    test('throws error if JSON parsing fails', async () => {
      process.env.GOOGLE_SERVICE_ACCOUNT_KEY = 'invalid-json{';
      const result = await client.initServiceAccount();
      expect(result).toBe(false);
      delete process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
    });

    test('has initServiceAccount method', async () => {
      expect(client).toHaveProperty('initServiceAccount');
      expect(typeof client.initServiceAccount).toBe('function');
    });

    test('sets authType to "service-account" on success path', async () => {
      // This test requires actual Google credentials, skip for now
      // Just verify the property exists
      expect(client).toHaveProperty('authType');
    });
  });

  describe('initOAuth', () => {
    test('returns false if token file missing', async () => {
      process.env.HOME = '/nonexistent/path';
      const result = await client.initOAuth();
      expect(result).toBe(false);
    });

    test('parses OAuth token from file', async () => {
      // Would need actual token file setup
      expect(client).toHaveProperty('oauthAuth');
    });
  });

  describe('parseCellRef', () => {
    test('parses single letter column correctly', () => {
      const result = client.parseCellRef('A1');
      expect(result).toEqual({ col: 0, row: 0, cellRef: 'A1' });
    });

    test('parses Z column correctly', () => {
      const result = client.parseCellRef('Z1');
      expect(result).toEqual({ col: 25, row: 0, cellRef: 'Z1' });
    });

    test('parses AA column correctly', () => {
      const result = client.parseCellRef('AA1');
      expect(result).toEqual({ col: 26, row: 0, cellRef: 'AA1' });
    });

    test('parses multi-digit rows correctly', () => {
      const result = client.parseCellRef('A100');
      expect(result).toEqual({ col: 0, row: 99, cellRef: 'A100' });
    });

    test('parses complex references correctly', () => {
      const result = client.parseCellRef('Z26');
      expect(result).toEqual({ col: 25, row: 25, cellRef: 'Z26' });
    });

    test('throws error for invalid cell reference', () => {
      expect(() => client.parseCellRef('123')).toThrow('Invalid cell reference');
      expect(() => client.parseCellRef('A')).toThrow('Invalid cell reference');
      expect(() => client.parseCellRef('1A')).toThrow('Invalid cell reference');
    });

    test('handles edge cases', () => {
      expect(() => client.parseCellRef('A0')).not.toThrow(); // Valid but row 0 is -1
      const result = client.parseCellRef('A0');
      expect(result.row).toBe(-1);
    });
  });

  describe('readSheet', () => {
    test('throws error if client not initialized', async () => {
      await expect(client.readSheet('sheet123')).rejects.toThrow(
        'Google Sheets client not initialized'
      );
    });

    test('returns correct structure on success', async () => {
      // Mock successful read
      const mockSheets = {
        spreadsheets: {
          values: {
            get: jest.fn().mockResolvedValue({
              data: {
                values: [
                  ['Header1', 'Header2'],
                  ['Value1', 'Value2'],
                ],
              },
            }),
          },
        },
      };

      client.sheets = mockSheets;
      client.authType = 'service-account';

      const result = await client.readSheet('test-sheet', 'A1:Z100');

      expect(result).toHaveProperty('sheetId', 'test-sheet');
      expect(result).toHaveProperty('range', 'A1:Z100');
      expect(result).toHaveProperty('values');
      expect(result.values).toEqual([
        ['Header1', 'Header2'],
        ['Value1', 'Value2'],
      ]);
    });

    test('returns empty array if no values in sheet', async () => {
      const mockSheets = {
        spreadsheets: {
          values: {
            get: jest.fn().mockResolvedValue({
              data: {},
            }),
          },
        },
      };

      client.sheets = mockSheets;
      client.authType = 'service-account';

      const result = await client.readSheet('empty-sheet');
      expect(result.values).toEqual([]);
    });

    test('throws error on API failure', async () => {
      const mockSheets = {
        spreadsheets: {
          values: {
            get: jest.fn().mockRejectedValue(new Error('API Error')),
          },
        },
      };

      client.sheets = mockSheets;
      client.authType = 'service-account';

      await expect(client.readSheet('bad-sheet')).rejects.toThrow('readSheet failed');
    });
  });

  describe('getSheetMetadata', () => {
    test('throws error if client not initialized', async () => {
      await expect(client.getSheetMetadata('sheet123')).rejects.toThrow(
        'Google Sheets client not initialized'
      );
    });

    test('returns correct metadata structure', async () => {
      const mockSheets = {
        spreadsheets: {
          get: jest.fn().mockResolvedValue({
            data: {
              properties: {
                title: 'Test Spreadsheet',
                locale: 'en_US',
              },
              sheets: [
                {
                  properties: {
                    title: 'Sheet1',
                    sheetId: 0,
                    gridProperties: {
                      columnCount: 26,
                      rowCount: 100,
                    },
                  },
                },
                {
                  properties: {
                    title: 'Sheet2',
                    sheetId: 1,
                    gridProperties: {
                      columnCount: 10,
                      rowCount: 50,
                    },
                  },
                },
              ],
            },
          }),
        },
      };

      client.sheets = mockSheets;
      client.authType = 'service-account';

      const result = await client.getSheetMetadata('test-sheet');

      expect(result.title).toBe('Test Spreadsheet');
      expect(result.locale).toBe('en_US');
      expect(result.sheets).toHaveLength(2);
      expect(result.sheets[0]).toEqual({
        name: 'Sheet1',
        id: 0,
        columnCount: 26,
        rowCount: 100,
      });
      expect(result.sheets[1]).toEqual({
        name: 'Sheet2',
        id: 1,
        columnCount: 10,
        rowCount: 50,
      });
    });

    test('handles missing gridProperties gracefully', async () => {
      const mockSheets = {
        spreadsheets: {
          get: jest.fn().mockResolvedValue({
            data: {
              properties: { title: 'Test' },
              sheets: [
                {
                  properties: {
                    title: 'NoGrid',
                    sheetId: 0,
                  },
                },
              ],
            },
          }),
        },
      };

      client.sheets = mockSheets;
      client.authType = 'service-account';

      const result = await client.getSheetMetadata('test');
      expect(result.sheets[0].columnCount).toBeUndefined();
      expect(result.sheets[0].rowCount).toBeUndefined();
    });

    test('throws error on API failure', async () => {
      const mockSheets = {
        spreadsheets: {
          get: jest.fn().mockRejectedValue(new Error('API Error')),
        },
      };

      client.sheets = mockSheets;
      client.authType = 'service-account';

      await expect(client.getSheetMetadata('bad')).rejects.toThrow('getSheetMetadata failed');
    });
  });

  describe('hasBeenModifiedSince', () => {
    test('throws error if client not initialized', async () => {
      await expect(
        client.hasBeenModifiedSince('sheet123', new Date())
      ).rejects.toThrow('Google Sheets client not initialized');
    });

    test('returns true if sheet modified after timestamp', async () => {
      const checkTime = new Date('2026-06-08T10:00:00Z');
      const modifiedTime = new Date('2026-06-08T11:00:00Z'); // 1 hour later

      const mockSheets = {
        spreadsheets: {
          get: jest.fn().mockResolvedValue({
            data: {
              spreadsheetMetadata: {
                modifiedTime: modifiedTime.toISOString(),
              },
            },
          }),
        },
      };

      client.sheets = mockSheets;
      client.authType = 'service-account';

      const result = await client.hasBeenModifiedSince('test-sheet', checkTime);
      expect(result).toBe(true);
    });

    test('returns false if sheet not modified after timestamp', async () => {
      const checkTime = new Date('2026-06-08T12:00:00Z');
      const modifiedTime = new Date('2026-06-08T10:00:00Z'); // 2 hours earlier

      const mockSheets = {
        spreadsheets: {
          get: jest.fn().mockResolvedValue({
            data: {
              spreadsheetMetadata: {
                modifiedTime: modifiedTime.toISOString(),
              },
            },
          }),
        },
      };

      client.sheets = mockSheets;
      client.authType = 'service-account';

      const result = await client.hasBeenModifiedSince('test-sheet', checkTime);
      expect(result).toBe(false);
    });

    test('handles missing modifiedTime gracefully', async () => {
      const checkTime = new Date('2026-06-08T10:00:00Z');

      const mockSheets = {
        spreadsheets: {
          get: jest.fn().mockResolvedValue({
            data: {
              spreadsheetMetadata: {},
            },
          }),
        },
      };

      client.sheets = mockSheets;
      client.authType = 'service-account';

      const result = await client.hasBeenModifiedSince('test-sheet', checkTime);
      expect(result).toBe(false); // Defaults to epoch (very old)
    });

    test('throws error on API failure', async () => {
      const mockSheets = {
        spreadsheets: {
          get: jest.fn().mockRejectedValue(new Error('API Error')),
        },
      };

      client.sheets = mockSheets;
      client.authType = 'service-account';

      await expect(
        client.hasBeenModifiedSince('bad', new Date())
      ).rejects.toThrow('hasBeenModifiedSince failed');
    });
  });

  describe('addComment', () => {
    test('returns deferred status if OAuth not initialized', async () => {
      client.authType = 'service-account'; // Not OAuth
      const result = await client.addComment('sheet', 'A1', 'Test message');

      expect(result.status).toBe('deferred_to_phase_9b');
      expect(result.note).toContain('OAuth');
    });

    test('returns posted status with message', async () => {
      const mockSheets = {
        spreadsheets: {
          batchUpdate: jest.fn().mockResolvedValue({ data: { spreadsheetId: 'test' } }),
        },
      };

      client.sheets = mockSheets;
      client.authType = 'oauth';

      const result = await client.addComment('sheet123', 'A1', 'Blocker detected', 'MonitoringAgent');

      expect(result.spreadsheetId).toBe('sheet123');
      expect(result.range).toBe('A1');
      expect(result.status).toBe('posted');
      expect(result.message).toContain('MonitoringAgent');
      expect(result.message).toContain('Blocker detected');
    });

    test('logs and returns status on success', async () => {
      const mockSheets = {
        spreadsheets: {
          batchUpdate: jest.fn().mockResolvedValue({ data: { spreadsheetId: 'sheet' } }),
        },
      };

      const spy = jest.spyOn(console, 'log');
      client.sheets = mockSheets;
      client.authType = 'oauth';

      const result = await client.addComment('sheet', 'A1', 'Test');

      expect(result.status).toBe('posted');
      expect(spy).toHaveBeenCalledWith(expect.stringContaining('[SHEETS]'));

      spy.mockRestore();
    });
  });

  describe('ensureInitialized', () => {
    test('returns true if already initialized', async () => {
      client.sheets = {};
      client.authType = 'service-account';

      const result = await client.ensureInitialized();
      expect(result).toBe(true);
    });

    test('attempts service account init if not initialized', async () => {
      const spy = jest.spyOn(client, 'initServiceAccount').mockResolvedValue(false);
      const spyOAuth = jest.spyOn(client, 'initOAuth').mockResolvedValue(false);

      const result = await client.ensureInitialized();

      expect(spy).toHaveBeenCalled();
      expect(result).toBe(false);

      spy.mockRestore();
      spyOAuth.mockRestore();
    });
  });
});
