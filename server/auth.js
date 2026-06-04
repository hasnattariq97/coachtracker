/**
 * @phase 1
 * @status active
 * @owner phase-builder
 * @last_updated 2026-05-17T23:05:00Z
 * @beads ["auth_agent_phase1"]
 */

const jwt = require('jsonwebtoken');

// Require JWT_SECRET at module load time
const SECRET = process.env.JWT_SECRET || (process.env.NODE_ENV === 'test' ? 'test-secret-key-minimum-32-characters-requirement' : null);
if (!SECRET || SECRET.length < 32) {
  throw new Error(
    'JWT_SECRET environment variable is required and must be at least 32 characters. ' +
    'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
  );
}

const generateToken = (user) => {
  if (!user || !user.id || !user.email || !user.role) {
    throw new Error('User must have id, email, and role properties');
  }
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    SECRET,
    { expiresIn: '24h' }
  );
};

const verifyToken = (token) => {
  try {
    return jwt.verify(token, SECRET);
  } catch (error) {
    return null;
  }
};

const authenticateToken = (req, res, next) => {
  console.log('[AUTH] authenticateToken middleware');
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  const user = verifyToken(token);
  if (!user) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  req.user = user;
  next();
};

const requireAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

const requireCoach = (req, res, next) => {
  if (!req.user || req.user.role !== 'coach') {
    return res.status(403).json({ error: 'Coach access required' });
  }
  next();
};

module.exports = { generateToken, verifyToken, authenticateToken, requireAdmin, requireCoach };
