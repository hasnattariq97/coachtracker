# MEMORY.md — Persistent Facts

## Credentials
- Seed admin: admin@tracker.com / admin123 (bcrypt-hashed on first DB init)
- JWT secret: .env → JWT_SECRET (never hardcoded)

## Ports & Config
- Backend: http://localhost:3001
- Frontend: http://localhost:5173
- Vite proxy: /api → http://localhost:3001
- SQLite file: server/tracker.db (gitignored)

## Cron
- Production schedule: '0 * * * *' (every hour)
- Testing schedule: '*/2 * * * *' (every 2 min)
- Idempotency: always check if notification type already exists for task before inserting

## API Notes
- All protected routes require: Authorization: Bearer <token>
- Coach routes return 403 if req.user.id != task.coach_id
- Admin routes return 403 if req.user.role != 'admin'

## Gitignore Must Include
- server/.env
- server/tracker.db
- .claude/settings.local.json
- .claude/audit.log
