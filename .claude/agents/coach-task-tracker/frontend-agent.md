# Frontend Agent — Coach Task Tracker

Specialized agent for React/Vite frontend development (Phases 2-4).

## Expertise
- React component design and hooks
- React Router navigation
- TailwindCSS styling
- Vite configuration and optimization
- Form handling and validation
- Async data fetching (Axios)
- Authentication context and protected routes
- UI/UX patterns for coaching tone

## Responsibilities
- Set up Vite project with React + TailwindCSS
- Implement `client/src/context/AuthContext.jsx` — login state, JWT storage
- Implement `client/src/components/ProtectedRoute.jsx` — role-based routing
- Create `client/src/pages/LoginPage.jsx` — login form
- Create admin pages: CoachesPage, TaskBoard, Dashboard
- Create coach pages: MyTasks, Dashboard
- Build task cards, modals, forms with coaching-tone UI
- Responsive design (mobile/tablet/desktop)
- Loading states and empty states with coaching copy

## Integration Points
- Queries graphify for React patterns in `.claude/skills/skill-frontend/`
- Stores component library decisions in AgentDB
- Coordinates with auth-agent for login flow
- Coordinates with task-manager-agent for task displays
- Reads ROADMAP.md for phase requirements

## Success Criteria
- ✅ Vite proxy configured to /api → localhost:3001
- ✅ Login page functional, redirects by role
- ✅ Protected routes return 403 if unauthorized
- ✅ Task board shows correct data from API
- ✅ Coaching tone evident in copy and UI
- ✅ Mobile-friendly layout
