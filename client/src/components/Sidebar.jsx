import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Users, ClipboardList, PlusCircle,
  CheckSquare, LogOut, Menu, X, Zap, Bot, Wrench, MessageSquare, MapPin
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const adminLinks = [
  { to: '/admin/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/admin/coaches',   icon: Users,            label: 'Coaches' },
  { to: '/admin/tasks',     icon: ClipboardList,    label: 'Task Board' },
  { to: '/admin/assign',            icon: PlusCircle,    label: 'Assign Task' },
  { to: '/admin/agent-dashboard',  icon: Bot,           label: 'Agent Dashboard' },
  { to: '/admin/auto-fixes',       icon: Wrench,        label: 'Auto Fixes' },
];

const coachLinks = [
  { to: '/coach/dashboard', icon: LayoutDashboard,  label: 'Dashboard' },
  { to: '/coach/tasks',     icon: CheckSquare,      label: 'My Tasks' },
  { to: '/coach/feedback',  icon: MessageSquare,    label: 'Report Issue' },
];

const superAdminLinks = [
  { to: '/super-admin/overview', icon: LayoutDashboard, label: 'Overview' },
  { to: '/super-admin/admins',   icon: Users,           label: 'Manage Admins' },
];

const NavItem = ({ to, icon: Icon, label, onClick }) => (
  <NavLink
    to={to}
    onClick={onClick}
    className={({ isActive }) =>
      `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150
       min-h-[44px] group
       ${isActive
         ? 'bg-white/20 text-white shadow-sm'
         : 'text-primary-100 hover:bg-white/10 hover:text-white'
       }`
    }
  >
    <Icon size={18} className="shrink-0" />
    {label}
  </NavLink>
);

const Sidebar = ({ role }) => {
  const { user, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigate = useNavigate();
  const links = role === 'super_admin' ? superAdminLinks : role === 'admin' ? adminLinks : coachLinks;

  const handleLogout = () => { logout(); };

  const initials = user?.name
    ? user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : '??';

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-4 py-5 border-b border-white/10">
        <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
          <Zap size={16} className="text-white" />
        </div>
        <div>
          <p className="text-white font-heading font-bold text-sm leading-tight">Coach Tracker</p>
          <p className="text-primary-200 text-[11px] capitalize">{role === 'super_admin' ? 'Super Admin' : `${role} portal`}</p>
        </div>
      </div>

      {/* Region badge (admin only) */}
      {role === 'admin' && user?.region_name && (
        <div className="px-4 py-2 border-b border-white/10">
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-primary-100 bg-white/10 rounded-full px-2.5 py-1">
            <MapPin size={10} />
            {user.region_name} Region
          </span>
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1" aria-label="Main navigation">
        {links.map(link => (
          <NavItem key={link.to} {...link} onClick={() => setMobileOpen(false)} />
        ))}
      </nav>

      {/* User + Logout */}
      <div className="px-3 py-4 border-t border-white/10 space-y-2">
        <div className="flex items-center gap-3 px-3 py-2">
          <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-white text-xs font-bold shrink-0">
            {initials}
          </div>
          <div className="min-w-0">
            <p className="text-white text-sm font-medium truncate">{user?.name || 'User'}</p>
            <p className="text-primary-200 text-xs truncate">{user?.email}</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm text-primary-100 hover:bg-white/10 hover:text-white transition-all duration-150 min-h-[44px]"
          aria-label="Log out"
        >
          <LogOut size={16} className="shrink-0" />
          Log out
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile toggle */}
      <button
        className="md:hidden fixed top-3 left-3 z-50 w-10 h-10 bg-primary-600 text-white rounded-xl flex items-center justify-center shadow-lg"
        onClick={() => setMobileOpen(o => !o)}
        aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
      >
        {mobileOpen ? <X size={18} /> : <Menu size={18} />}
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/40 z-30 backdrop-blur-sm"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed top-0 left-0 h-full w-[240px] z-40
          bg-gradient-to-b from-primary-700 to-primary-900
          shadow-xl transition-transform duration-250
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}
          md:translate-x-0
        `}
      >
        {sidebarContent}
      </aside>
    </>
  );
};

export default Sidebar;
