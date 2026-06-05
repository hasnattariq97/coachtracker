import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Bell, CheckCheck, X } from 'lucide-react';
import toast from 'react-hot-toast';
import axios from 'axios';
import CoachingInsightCard from './CoachingInsightCard';

const typeStyles = {
  assigned:       'border-l-primary-500',
  midpoint_nudge: 'border-l-accent-500',
  overdue_nudge:  'border-l-red-500',
  completed:      'border-l-emerald-500',
  delay_submitted:'border-l-amber-500',
};

const typeIcons = {
  assigned:       '🎯',
  midpoint_nudge: '⚡',
  overdue_nudge:  '⚠️',
  completed:      '✅',
  delay_submitted:'📝',
};

const NotificationBell = () => {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  const fetchNotifications = useCallback(async () => {
    try {
      const { data } = await axios.get('/api/notifications');
      setNotifications(data);
    } catch {
      toast.error('Could not load notifications');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();

    let id = null;
    const start = () => { id = setInterval(fetchNotifications, 30000); };
    const stop = () => { clearInterval(id); id = null; };

    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') stop();
      else { fetchNotifications(); start(); }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    start();

    return () => {
      stop();
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [fetchNotifications]);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  const markRead = async (id) => {
    try {
      await axios.put(`/api/notifications/${id}/read`);
      setNotifications(n => n.map(x => x.id === id ? { ...x, read: 1 } : x));
    } catch {
      toast.error('Could not mark as read');
    }
  };

  const markAllRead = async () => {
    try {
      await axios.put('/api/notifications/read-all');
      setNotifications(n => n.map(x => ({ ...x, read: 1 })));
    } catch {
      toast.error('Could not mark as read');
    }
  };

  const unread = notifications.filter(n => !n.read).length;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className="relative w-9 h-9 flex items-center justify-center rounded-xl
                   text-slate-500 hover:text-primary-700 hover:bg-primary-50
                   transition-all duration-150 min-h-[44px] min-w-[44px]"
        aria-label={`Notifications${unread > 0 ? ` (${unread} unread)` : ''}`}
        aria-haspopup="true"
        aria-expanded={open}
      >
        <Bell size={18} />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-accent-600
                           text-white text-[10px] font-bold rounded-full flex items-center
                           justify-center px-1 celebrate">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-2xl shadow-xl
                        border border-slate-100 z-50 fade-in overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
            <h3 className="text-sm font-heading font-semibold text-primary-900">Notifications</h3>
            <div className="flex items-center gap-1">
              {unread > 0 && (
                <button
                  onClick={markAllRead}
                  className="flex items-center gap-1 px-2 py-1 text-xs text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                  aria-label="Mark all as read"
                >
                  <CheckCheck size={12} /> All read
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                className="w-6 h-6 flex items-center justify-center text-slate-400 hover:text-slate-600 rounded-lg"
                aria-label="Close"
              >
                <X size={13} />
              </button>
            </div>
          </div>

          <div className="max-h-80 overflow-y-auto">
            {loading ? (
              <div className="p-3 space-y-2">
                {[1,2,3].map(i => (
                  <div key={i} className="skeleton h-12 rounded-lg" />
                ))}
              </div>
            ) : notifications.length === 0 ? (
              <div className="py-10 text-center">
                <p className="text-sm text-slate-400">No notifications yet.</p>
              </div>
            ) : (
              notifications.slice(0, 20).map(n => (
                <div key={n.id} className="border-b border-slate-50">
                  {n.type === 'coaching_insights' ? (
                    <CoachingInsightCard
                      notification={n}
                      onDismiss={() => markRead(n.id)}
                    />
                  ) : (
                    <button
                      onClick={() => markRead(n.id)}
                      className={`
                        w-full text-left px-4 py-3 border-l-4
                        hover:bg-slate-50 transition-colors
                        ${typeStyles[n.type] || 'border-l-slate-300'}
                        ${!n.read ? 'bg-primary-50/50' : 'bg-white'}
                      `}
                    >
                      <div className="flex items-start gap-2.5">
                        <span className="text-base mt-0.5 shrink-0">{typeIcons[n.type] || '🔔'}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-slate-700 leading-snug">{n.message}</p>
                          <p className="text-[10px] text-slate-400 mt-1">
                            {new Date(n.created_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                        {!n.read && <span className="w-2 h-2 bg-primary-500 rounded-full shrink-0 mt-1.5" />}
                      </div>
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
