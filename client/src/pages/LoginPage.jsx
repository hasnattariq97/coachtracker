```jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Zap, Mail, Lock, Eye, EyeOff } from 'lucide-react';
import toast from 'react-hot-toast';

const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const { login, loading, isAuthenticated, user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const sessionExpired = sessionStorage.getItem('session_expired');
    if (sessionExpired) {
      sessionStorage.removeItem('session_expired');
      toast.error('Your session expired. Please sign in again.');
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated && user) {
      const dashboardPath = user.role === 'admin' ? '/admin/dashboard' : '/coach/dashboard';
      navigate(dashboardPath, { replace: true });
    }
  }, [isAuthenticated, user, navigate]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    try {
      if (!email || !password) {
        toast.error('Please fill in both email and password.');
        return;
      }
      const decoded = await login(email, password);
      toast.success(`Welcome back, ${decoded.name || 'Coach'}!`);
    } catch (error) {
      if (error instanceof Error) {
        toast.error(error.message || 'Login failed. Please try again.');
      } else {
        toast.error('An unknown error occurred.');
      }
    }
  };

  const handleEmailChange = (event) => {
    setEmail(event.target.value);
  };

  const handlePasswordChange = (event) => {
    setPassword(event.target.value);
  };

  const handleShowPassword = () => {
    setShowPassword(!showPassword);
  };

  return (
    <div className="min-h-dvh flex flex-col md:flex-row">
      {/* Left panel */}
      <div className="hidden md:flex flex-col justify-between w-[420px] shrink-0 bg-gradient-to-b from-primary-700 to-primary-900 p-10 text-white">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center">
            <Zap size={18} className="text-white" />
          </div>
          <span className="font-heading font-bold text-lg">Coach Tracker</span>
        </div>

        <div className="space-y-6">
          <blockquote className="text-2xl font-heading font-semibold leading-snug text-white">
            "Great coaching isn't about doing the work — it's about building momentum."
          </blockquote>
          <div className="flex gap-3 items-start">
            {['Stay accountable', 'Track progress', 'Celebrate wins'].map((tag) => (
              <div key={tag} className="bg-white/10 rounded-xl px-3 py-1.5 text-xs font-medium text-primary-100">
                {tag}
              </div>
            ))}
          </div>
        </div>

        <p className="text-primary-300 text-xs"> {new Date().getFullYear()} Coach Tracker</p>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center p-6 bg-primary-50">
        <div className="w-full max-w-md fade-in">
          {/* Mobile logo */}
          <div className="md:hidden flex items-center gap-2 mb-8">
            <div className="w-9 h-9 bg-primary-600 rounded-xl flex items-center justify-center">
              <Zap size={18} className="text-white" />
            </div>
            <span className="font-heading font-bold text-lg text-primary-900">Coach Tracker</span>
          </div>

          <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-primary-200 p-6">
            <h2 className="font-heading font-bold text-lg mb-4">Sign in to your account</h2>

            <div className="flex flex-col mb-4">
              <label className="text-sm font-medium text-primary-700 mb-2" htmlFor="email">Email address</label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={handleEmailChange}
                placeholder="you@example.com"
                className="bg-primary-50 border border-primary-200 rounded-lg p-3 text-sm text-primary-700"
              />
            </div>

            <div className="flex flex-col mb-4 relative">
              <label className="text-sm font-medium text-primary-700 mb-2" htmlFor="password">Password</label>
              <input
                type={showPassword ? 'text' : 'password'}
                id="password"
                value={password}
                onChange={handlePasswordChange}
                placeholder="Password"
                className="bg-primary-50 border border-primary-200 rounded-lg p-3 text-sm text-primary-700"
              />
              <button
                type="button"
                className="absolute right-3 top-10"
                onClick={handleShowPassword}
              >
                {showPassword ? <EyeOff size={18} className="text-primary-700" /> : <Eye size={18} className="text-primary-700" />}
              </button>
            </div>

            <button
              type="submit"
              className="bg-primary-700 hover:bg-primary-800 text-white rounded-lg p-3 text-sm font-medium w-full"
            >
              Sign in
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
```