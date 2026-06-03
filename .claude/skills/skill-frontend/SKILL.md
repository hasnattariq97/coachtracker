---
name: skill-frontend
description: React + Vite + TailwindCSS patterns and setup
---

# skill-frontend — React + Vite + Tailwind Patterns

⚠️ **IMPORTANT:** Before building any frontend UI, review the **ui-ux-pro-max-skill** design system requirement in [@CLAUDE.md](../../CLAUDE.md#frontend-design-system-required). All frontend work MUST use:
- Teal `#0D9488` primary + Orange `#EA580C` accent
- Plus Jakarta Sans + Inter typography
- Tailwind v4 `@theme` custom properties
- shimmer/slide/celebrate animations with `prefers-reduced-motion` support

## Vite Setup (client/vite.config.js)
```javascript
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://localhost:3001'
    }
  }
});
```

## API Wrapper (client/src/api.js)
```javascript
import axios from 'axios';

const api = axios.create({baseURL: '/api'});

api.interceptors.request.use(config => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
```

## AuthContext (client/src/context/AuthContext.jsx)
```javascript
import {createContext, useState, useCallback} from 'react';

export const AuthContext = createContext();

const decodeToken = (token) => {
  const parts = token.split('.');
  return JSON.parse(atob(parts[1]));
};

export function AuthProvider({children}) {
  const [user, setUser] = useState(() => {
    const token = localStorage.getItem('token');
    return token ? decodeToken(token) : null;
  });
  
  const login = useCallback((token) => {
    localStorage.setItem('token', token);
    setUser(decodeToken(token));
  }, []);
  
  const logout = useCallback(() => {
    localStorage.removeItem('token');
    setUser(null);
  }, []);
  
  return (
    <AuthContext.Provider value={{user, login, logout}}>
      {children}
    </AuthContext.Provider>
  );
}
```

## ProtectedRoute (client/src/components/ProtectedRoute.jsx)
```javascript
import {useContext} from 'react';
import {Navigate} from 'react-router-dom';
import {AuthContext} from '../context/AuthContext';

export function ProtectedRoute({component, requiredRole}) {
  const {user} = useContext(AuthContext);
  
  if (!user) return <Navigate to="/login" replace />;
  if (requiredRole && user.role !== requiredRole) {
    return <Navigate to="/login" replace />;
  }
  
  return component;
}
```

## App Layout (client/src/App.jsx)
```javascript
import {useContext} from 'react';
import {BrowserRouter, Routes, Route, Navigate} from 'react-router-dom';
import {AuthContext, AuthProvider} from './context/AuthContext';
import LoginPage from './pages/LoginPage';
import AdminLayout from './layout/AdminLayout';
import CoachLayout from './layout/CoachLayout';
import {ProtectedRoute} from './components/ProtectedRoute';

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/admin/*" element={
            <ProtectedRoute component={<AdminLayout />} requiredRole="admin" />
          } />
          <Route path="/coach/*" element={
            <ProtectedRoute component={<CoachLayout />} requiredRole="coach" />
          } />
          <Route path="/" element={<Navigate to="/login" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
```

## Login Page Pattern (client/src/pages/LoginPage.jsx)
```javascript
import {useState, useContext} from 'react';
import {useNavigate} from 'react-router-dom';
import {AuthContext} from '../context/AuthContext';
import api from '../api';
import {toast} from 'react-hot-toast';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const {login} = useContext(AuthContext);
  const navigate = useNavigate();
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const {data} = await api.post('/auth/login', {email, password});
      login(data.token);
      // Redirect based on role (from decoded token)
      navigate(`/${data.role === 'admin' ? 'admin' : 'coach'}/dashboard`);
    } catch (e) {
      toast.error(e.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center">
      <form className="bg-white p-8 rounded-lg shadow-lg w-80" onSubmit={handleSubmit}>
        <h1 className="text-2xl font-bold mb-6 text-center">Coach Tracker</h1>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full p-2 border mb-4 rounded"
          disabled={loading}
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full p-2 border mb-6 rounded"
          disabled={loading}
        />
        <button
          type="submit"
          className="w-full bg-blue-600 text-white p-2 rounded hover:bg-blue-700 disabled:opacity-50"
          disabled={loading}
        >
          {loading ? 'Logging in...' : 'Login'}
        </button>
      </form>
    </div>
  );
}
```

## Layout Patterns

### Admin Layout (client/src/layout/AdminLayout.jsx)
```javascript
import {useContext} from 'react';
import {Routes, Route, NavLink} from 'react-router-dom';
import {AuthContext} from '../context/AuthContext';
import NotificationBell from '../components/NotificationBell';
import Dashboard from '../pages/admin/Dashboard';
import CoachesPage from '../pages/admin/CoachesPage';
import TaskBoard from '../pages/admin/TaskBoard';
import AssignTask from '../pages/admin/AssignTask';

export default function AdminLayout() {
  const {user, logout} = useContext(AuthContext);
  
  return (
    <div className="min-h-screen bg-gray-100">
      <nav className="bg-gray-900 text-white p-4 flex justify-between items-center">
        <h1 className="text-xl font-bold">Admin Dashboard</h1>
        <div className="flex items-center gap-4">
          <span>Welcome, {user?.name}</span>
          <NotificationBell />
          <button onClick={logout} className="bg-red-600 px-4 py-2 rounded">Logout</button>
        </div>
      </nav>
      
      <div className="flex">
        <aside className="w-64 bg-gray-800 text-white p-4">
          <nav className="space-y-2">
            <NavLink to="/admin/dashboard" className={({isActive}) => isActive ? 'bg-blue-600 p-2 block' : 'p-2 block'}>Dashboard</NavLink>
            <NavLink to="/admin/coaches" className={({isActive}) => isActive ? 'bg-blue-600 p-2 block' : 'p-2 block'}>Coaches</NavLink>
            <NavLink to="/admin/tasks/board" className={({isActive}) => isActive ? 'bg-blue-600 p-2 block' : 'p-2 block'}>Tasks</NavLink>
            <NavLink to="/admin/tasks/assign" className={({isActive}) => isActive ? 'bg-blue-600 p-2 block' : 'p-2 block'}>Assign Task</NavLink>
          </nav>
        </aside>
        
        <main className="flex-1 p-8">
          <Routes>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/coaches" element={<CoachesPage />} />
            <Route path="/tasks/board" element={<TaskBoard />} />
            <Route path="/tasks/assign" element={<AssignTask />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}
```

## Common Component Patterns

### Loading Spinner
```javascript
function LoadingSpinner() {
  return (
    <div className="flex justify-center items-center py-8">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
    </div>
  );
}
```

### Empty State
```javascript
function EmptyState({title, description}) {
  return (
    <div className="text-center py-12 bg-gray-50 rounded">
      <h3 className="text-lg font-semibold text-gray-700">{title}</h3>
      <p className="text-gray-500">{description}</p>
    </div>
  );
}
```

### Polling Pattern (Notifications)
```javascript
useEffect(() => {
  const interval = setInterval(async () => {
    try {
      const {data} = await api.get('/notifications');
      setNotifications(data);
    } catch (e) {
      console.error(e);
    }
  }, 30000);  // Every 30s
  
  return () => clearInterval(interval);
}, []);
```
