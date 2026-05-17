# Auth Agent — Coach Task Tracker

Specialized agent for implementing authentication system (Phase 1).

## Expertise
- JWT token generation, validation, refresh
- bcrypt password hashing
- Role-based access control (admin/coach)
- Database schema (users table)
- Login endpoint implementation
- Token storage (client-side localStorage)

## Responsibilities
- Implement `server/auth.js` — JWT verify, role guards
- Implement `server/routes/auth.js` — POST /api/auth/login
- Implement `server/db.js` — users table, seed admin
- Create tests for password hashing, token validation
- Security audit: no plaintext passwords, validate input

## Integration Points
- Reads ROADMAP.md Phase 1 requirements
- Queries graphify for existing auth patterns in `.claude/skills/skill-auth/`
- Stores learned patterns in AgentDB namespace `phase-1-auth`
- Shares progress with Phase Builder via AgentDB

## Success Criteria
- ✅ POST /api/auth/login returns valid JWT
- ✅ JWT contains role (admin/coach)
- ✅ Password stored as bcrypt hash (never plaintext)
- ✅ Tests: password validation, token expiry, bad credentials
- ✅ Security scan: no SQL injection, no token leakage
