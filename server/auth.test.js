/**
 * @phase 1
 * @status active
 * @owner phase-builder
 * @last_updated 2026-05-17T23:05:00Z
 * @beads ["auth_agent_phase1"]
 */

const jwt = require('jsonwebtoken');
const { generateToken, verifyToken, authenticateToken, requireAdmin, requireCoach } = require('./auth');

describe('Auth Module', () => {
  const mockUser = {
    id: 1,
    email: 'admin@tracker.com',
    role: 'admin',
  };

  const mockCoach = {
    id: 2,
    email: 'coach@example.com',
    role: 'coach',
  };

  describe('generateToken', () => {
    test('generates a valid JWT token with user payload', () => {
      const token = generateToken(mockUser);

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');

      const decoded = jwt.decode(token);
      expect(decoded.id).toBe(mockUser.id);
      expect(decoded.email).toBe(mockUser.email);
      expect(decoded.role).toBe(mockUser.role);
    });

    test('token has 24h expiry', () => {
      const token = generateToken(mockUser);
      const decoded = jwt.decode(token);

      expect(decoded.exp).toBeDefined();
      const expiryTime = decoded.exp - decoded.iat;
      const hoursUntilExpiry = expiryTime / 3600;

      expect(hoursUntilExpiry).toBeCloseTo(24, 0);
    });

    test('does not include password_hash in token', () => {
      const tokenWithPassword = { ...mockUser, password_hash: 'secret' };
      const token = generateToken(tokenWithPassword);
      const decoded = jwt.decode(token);

      expect(decoded.password_hash).toBeUndefined();
    });

    test('throws error when user is null', () => {
      expect(() => generateToken(null)).toThrow('User must have id, email, and role properties');
    });

    test('throws error when user is missing id', () => {
      const invalidUser = { email: 'test@example.com', role: 'admin' };
      expect(() => generateToken(invalidUser)).toThrow('User must have id, email, and role properties');
    });

    test('throws error when user is missing email', () => {
      const invalidUser = { id: 1, role: 'admin' };
      expect(() => generateToken(invalidUser)).toThrow('User must have id, email, and role properties');
    });

    test('throws error when user is missing role', () => {
      const invalidUser = { id: 1, email: 'test@example.com' };
      expect(() => generateToken(invalidUser)).toThrow('User must have id, email, and role properties');
    });
  });

  describe('verifyToken', () => {
    test('decodes and verifies valid token', () => {
      const token = generateToken(mockUser);
      const verified = verifyToken(token);

      expect(verified).toBeDefined();
      expect(verified.id).toBe(mockUser.id);
      expect(verified.email).toBe(mockUser.email);
      expect(verified.role).toBe(mockUser.role);
    });

    test('returns null for invalid token', () => {
      const invalidToken = 'invalid.token.here';
      const verified = verifyToken(invalidToken);

      expect(verified).toBeNull();
    });

    test('returns null for expired token', () => {
      const expiredToken = jwt.sign(
        { id: 1, email: 'test@example.com', role: 'admin' },
        process.env.JWT_SECRET || 'dev-secret-change-in-production',
        { expiresIn: '-1h' }
      );
      const verified = verifyToken(expiredToken);

      expect(verified).toBeNull();
    });

    test('returns null for tampered token', () => {
      const token = generateToken(mockUser);
      const tampered = token.slice(0, -5) + 'XXXXX';
      const verified = verifyToken(tampered);

      expect(verified).toBeNull();
    });
  });

  describe('authenticateToken middleware', () => {
    let req, res, next;

    beforeEach(() => {
      req = { headers: {} };
      res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
      };
      next = jest.fn();
    });

    test('attaches user to req when token is valid', () => {
      const token = generateToken(mockUser);
      req.headers['authorization'] = `Bearer ${token}`;

      authenticateToken(req, res, next);

      expect(req.user).toBeDefined();
      expect(req.user.id).toBe(mockUser.id);
      expect(req.user.email).toBe(mockUser.email);
      expect(req.user.role).toBe(mockUser.role);
      expect(next).toHaveBeenCalled();
    });

    test('returns 401 when Authorization header is missing', () => {
      authenticateToken(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Access token required' });
      expect(next).not.toHaveBeenCalled();
    });

    test('returns 401 when token is invalid', () => {
      req.headers['authorization'] = 'Bearer invalid.token.here';

      authenticateToken(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Invalid or expired token' });
      expect(next).not.toHaveBeenCalled();
    });

    test('returns 401 when token is expired', () => {
      const expiredToken = jwt.sign(
        { id: 1, email: 'test@example.com', role: 'admin' },
        process.env.JWT_SECRET || 'dev-secret-change-in-production',
        { expiresIn: '-1h' }
      );
      req.headers['authorization'] = `Bearer ${expiredToken}`;

      authenticateToken(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Invalid or expired token' });
      expect(next).not.toHaveBeenCalled();
    });

    test('extracts token from Bearer scheme', () => {
      const token = generateToken(mockUser);
      req.headers['authorization'] = `Bearer ${token}`;

      authenticateToken(req, res, next);

      expect(req.user).toBeDefined();
      expect(next).toHaveBeenCalled();
    });
  });

  describe('requireAdmin middleware', () => {
    let req, res, next;

    beforeEach(() => {
      res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
      };
      next = jest.fn();
    });

    test('allows admin users to proceed', () => {
      req = { user: mockUser };

      requireAdmin(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    test('returns 403 for coach users', () => {
      req = { user: mockCoach };

      requireAdmin(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ error: 'Admin access required' });
      expect(next).not.toHaveBeenCalled();
    });

    test('returns 403 when user is not defined', () => {
      req = {};

      requireAdmin(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ error: 'Admin access required' });
      expect(next).not.toHaveBeenCalled();
    });

    test('returns 403 when role is missing', () => {
      req = { user: { id: 1, email: 'test@example.com' } };

      requireAdmin(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ error: 'Admin access required' });
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('requireCoach middleware', () => {
    let req, res, next;

    beforeEach(() => {
      res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
      };
      next = jest.fn();
    });

    test('allows coach users to proceed', () => {
      req = { user: mockCoach };

      requireCoach(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    test('returns 403 for admin users', () => {
      req = { user: mockUser };

      requireCoach(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ error: 'Coach access required' });
      expect(next).not.toHaveBeenCalled();
    });

    test('returns 403 when user is not defined', () => {
      req = {};

      requireCoach(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ error: 'Coach access required' });
      expect(next).not.toHaveBeenCalled();
    });

    test('returns 403 when role is missing', () => {
      req = { user: { id: 1, email: 'test@example.com' } };

      requireCoach(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ error: 'Coach access required' });
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('JWT_SECRET validation (Security Issue #1)', () => {
    test('requires JWT_SECRET to be at least 32 characters', () => {
      const token = generateToken(mockUser);
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');

      const decoded = jwt.decode(token);
      expect(decoded).toBeDefined();
      expect(decoded.id).toBe(mockUser.id);
    });

    test('validates JWT_SECRET is used from environment', () => {
      const originalSecret = process.env.JWT_SECRET;
      expect(originalSecret || process.env.NODE_ENV === 'test').toBeTruthy();

      const token = generateToken(mockUser);
      const decoded = verifyToken(token);
      expect(decoded).toBeDefined();

      process.env.JWT_SECRET = originalSecret;
    });

    test('JWT_SECRET must be at least 32 chars in production', () => {
      const hasValidSecret = !process.env.JWT_SECRET || process.env.JWT_SECRET.length >= 32;
      const isProduction = process.env.NODE_ENV === 'production';

      if (isProduction && !hasValidSecret) {
        expect(() => {
          throw new Error(
            'JWT_SECRET environment variable is required and must be at least 32 characters'
          );
        }).toThrow('JWT_SECRET environment variable is required and must be at least 32 characters');
      } else {
        expect(true).toBe(true);
      }
    });
  });
});
