import React from 'react';
import { useLocation } from 'react-router-dom';
import NotificationBell from './NotificationBell';

const pageTitles = {
  '/admin/dashboard': 'Dashboard',
  '/admin/coaches':   'Coaches',
  '/admin/tasks':     'Task Board',
  '/admin/assign':    'Assign Task',
  '/coach/dashboard': 'Dashboard',
  '/coach/tasks':     'My Tasks',
};

const Header = () => {
  const { pathname } = useLocation();
  const title = pageTitles[pathname] || 'Coach Tracker';

  return (
    <header
      className="sticky top-0 z-20 h-14 bg-white/80 backdrop-blur border-b border-primary-100
                 flex items-center justify-between px-4 md:px-8"
      style={{ minHeight: 'var(--header-h)' }}
    >
      <h1 className="text-base font-heading font-semibold text-primary-900 md:ml-0 ml-10">
        {title}
      </h1>
      <NotificationBell />
    </header>
  );
};

export default Header;
