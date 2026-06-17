process.env.JWT_SECRET = 'test-secret-key-minimum-32-characters-requirement';
const { generateToken, verifyToken, requireSuperAdmin, regionFilter } = require('../auth');

describe('generateToken with region_id', () => {
  test('includes region_id in payload for admin', () => {
    const token = generateToken({ id: 1, email: 'a@b.com', role: 'admin', region_id: 3 });
    const decoded = verifyToken(token);
    expect(decoded.region_id).toBe(3);
  });

  test('includes null region_id for super_admin', () => {
    const token = generateToken({ id: 1, email: 'a@b.com', role: 'super_admin', region_id: null });
    const decoded = verifyToken(token);
    expect(decoded.region_id).toBeNull();
  });

  test('includes region_name in payload', () => {
    const token = generateToken({ id: 1, email: 'a@b.com', role: 'admin', region_id: 1, region_name: 'Urban-I' });
    const decoded = verifyToken(token);
    expect(decoded.region_name).toBe('Urban-I');
  });
});

describe('requireSuperAdmin middleware', () => {
  const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
  const next = jest.fn();

  beforeEach(() => { jest.clearAllMocks(); });

  test('calls next() for super_admin', () => {
    const req = { user: { role: 'super_admin' } };
    requireSuperAdmin(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  test('returns 403 for admin', () => {
    const req = { user: { role: 'admin' } };
    requireSuperAdmin(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  test('returns 403 for coach', () => {
    const req = { user: { role: 'coach' } };
    requireSuperAdmin(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
  });
});

describe('regionFilter helper', () => {
  test('returns null for super_admin', () => {
    expect(regionFilter({ role: 'super_admin', region_id: null })).toBeNull();
  });

  test('returns region_id for admin', () => {
    expect(regionFilter({ role: 'admin', region_id: 2 })).toBe(2);
  });
});
