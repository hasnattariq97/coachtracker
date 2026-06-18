import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Zap, Mail, Lock, Eye, EyeOff } from 'lucide-react';
import toast from 'react-hot-toast';

const LoginPage = () => {
  const [email, setEmail]         = useState('');
  const [password, setPassword]   = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [peekActive, setPeekActive]     = useState(false);
  const peekTimer = useRef(null);
  const { login, loading, isAuthenticated, user } = useAuth();
  const navigate = useNavigate();

  const handlePasswordChange = (e) => {
    setPassword(e.target.value);
    if (!showPassword && e.target.value.length > 0) {
      setPeekActive(true);
      clearTimeout(peekTimer.current);
      peekTimer.current = setTimeout(() => setPeekActive(false), 600);
    }
  };

  useEffect(() => {
    if (sessionStorage.getItem('session_expired')) {
      sessionStorage.removeItem('session_expired');
      toast.error('Your session expired. Please sign in again.');
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated && user) {
      navigate(user.role === 'admin' ? '/admin/dashboard' : '/coach/dashboard', { replace: true });
    }
  }, [isAuthenticated, user, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const decoded = await login(email, password);
      const roleFallback = decoded.role === 'super_admin' ? 'Super Admin' : decoded.role === 'admin' ? 'Admin' : 'Coach';
      toast.success(`Welcome back, ${decoded.name || roleFallback}!`);
    } catch (err) {
      toast.error(err.message || 'Login failed. Please try again.');
    }
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
            {['Stay accountable', 'Track progress', 'Celebrate wins'].map(t => (
              <div key={t} className="bg-white/10 rounded-xl px-3 py-1.5 text-xs font-medium text-primary-100">
                {t}
              </div>
            ))}
          </div>
        </div>

        <p className="text-primary-300 text-xs">© {new Date().getFullYear()} Coach Tracker</p>
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

          <div className="bg-white rounded-2xl shadow-sm border border-primary-100 p-8">
            <div className="mb-7">
              <h1 className="text-2xl font-heading font-bold text-primary-900 mb-1.5">
                Welcome back
              </h1>
              <p className="text-sm text-slate-500">
                Log in to manage your tasks and keep momentum going.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-primary-800 mb-1.5">
                  Email
                </label>
                <div className="relative">
                  <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="your@email.com"
                    required
                    disabled={loading}
                    className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-lg text-sm
                               bg-slate-50 focus:bg-white focus:border-primary-400
                               focus:ring-2 focus:ring-primary-100 outline-none transition-all
                               disabled:opacity-60 disabled:cursor-not-allowed"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-primary-800 mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    id="password"
                    type={showPassword || peekActive ? 'text' : 'password'}
                    value={password}
                    onChange={handlePasswordChange}
                    placeholder="••••••••"
                    required
                    disabled={loading}
                    className="w-full pl-9 pr-10 py-2.5 border border-slate-200 rounded-lg text-sm
                               bg-slate-50 focus:bg-white focus:border-primary-400
                               focus:ring-2 focus:ring-primary-100 outline-none transition-all
                               disabled:opacity-60 disabled:cursor-not-allowed"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(v => !v)}
                    tabIndex={-1}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || !email || !password}
                className="w-full mt-2 py-2.5 bg-primary-600 text-white text-sm font-semibold
                           rounded-lg hover:bg-primary-700 active:scale-[0.98] transition-all duration-150
                           disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px]
                           flex items-center justify-center gap-2"
              >
                {loading
                  ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Signing in…</>
                  : 'Sign in'
                }
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
