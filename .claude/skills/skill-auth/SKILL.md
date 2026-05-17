---
name: skill-auth
description: JWT + bcrypt authentication patterns for Node.js + React
---

# skill-auth — JWT + Bcrypt Auth Patterns

## Architecture
- **Backend**: Express routes, JWT middleware, role guards
- **Frontend**: AuthContext (localStorage), ProtectedRoute, LoginPage
- **Token**: JWT with payload {id, name, email, role}
- **Password storage**: Always bcrypt with salt rounds 10

## Backend Patterns

### Express Middleware (server/auth.js)
```javascript
// Verify JWT and attach req.user
const verifyJWT = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({error: 'Missing token'});
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch (e) {
    res.status(401).json({error: 'Invalid token'});
  }
};

// Route guards
const requireAdmin = (req, res, next) => {
  if (req.user?.role !== 'admin') return res.status(403).json({error: 'Admin only'});
  next();
};

const requireCoach = (req, res, next) => {
  if (req.user?.role !== 'coach') return res.status(403).json({error: 'Coach only'});
  next();
};
```

### Login Route (server/routes/auth.js)
```javascript
app.post('/api/auth/login', (req, res) => {
  const {email, password} = req.body;
  if (!email || !password) return res.status(400).json({error: 'Missing fields'});
  
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user) return res.status(401).json({error: 'Invalid credentials'});
  
  const match = bcrypt.compareSync(password, user.password_hash);
  if (!match) return res.status(401).json({error: 'Invalid credentials'});
  
  const token = jwt.sign(
    {id: user.id, name: user.name, email: user.email, role: user.role},
    process.env.JWT_SECRET,
    {expiresIn: '24h'}
  );
  
  res.json({token});
});
```

## Frontend Patterns

### AuthContext (client/src/context/AuthContext.jsx)
```javascript
// Decode JWT payload without crypto (it's base64)
const decodeToken = (token) => {
  const parts = token.split('.');
  const payload = JSON.parse(atob(parts[1]));
  return payload;
};

// Manage login state + localStorage
const [user, setUser] = useState(() => {
  const token = localStorage.getItem('token');
  return token ? decodeToken(token) : null;
});

const login = (token) => {
  localStorage.setItem('token', token);
  setUser(decodeToken(token));
};

const logout = () => {
  localStorage.removeItem('token');
  setUser(null);
};
```

### ProtectedRoute (client/src/components/ProtectedRoute.jsx)
```javascript
// Only allow logged-in users with correct role
const ProtectedRoute = ({component, requiredRole}) => {
  const {user} = useContext(AuthContext);
  if (!user) return <Navigate to="/login" replace />;
  if (requiredRole && user.role !== requiredRole) {
    return <Navigate to="/login" replace />;
  }
  return component;
};

// Usage in App.jsx:
// <Route path="/admin/*" element={<ProtectedRoute component={<AdminLayout />} requiredRole="admin" />} />
```

### API Calls with Token
```javascript
// In client/src/api.js or anywhere making requests
const api = axios.create({
  baseURL: '/api'
});

api.interceptors.request.use(config => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
```

## Database Setup
```sql
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT CHECK (role IN ('admin', 'coach')),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

## Key Security Points
- Never return password_hash in any API response
- Always validate email + password on login; don't leak which field is wrong
- Passwords must be hashed with bcrypt before storing
- JWT expires in 24h; no refresh token for MVP
- All protected routes must verify JWT AND role
