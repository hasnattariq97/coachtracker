import React from 'react';

const styles = {
  assigned:    'bg-primary-100 text-primary-800 border border-primary-200',
  in_progress: 'bg-blue-100 text-blue-800 border border-blue-200',
  completed:   'bg-emerald-100 text-emerald-800 border border-emerald-200',
  overdue:     'bg-red-100 text-red-800 border border-red-200',
  high:        'bg-red-100 text-red-700 border border-red-200',
  medium:      'bg-amber-100 text-amber-700 border border-amber-200',
  low:         'bg-emerald-100 text-emerald-700 border border-emerald-200',
  admin:       'bg-violet-100 text-violet-800 border border-violet-200',
  coach:       'bg-primary-100 text-primary-800 border border-primary-200',
};

const labels = {
  assigned:    'Assigned',
  in_progress: 'In Progress',
  completed:   'Completed',
  overdue:     'Overdue',
  high:        'High',
  medium:      'Medium',
  low:         'Low',
};

const Badge = ({ value, className = '', children }) => {
  const style = styles[value] || 'bg-slate-100 text-slate-700 border border-slate-200';
  const text = children ?? labels[value] ?? value;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold uppercase tracking-wide ${style} ${className}`}>
      {text}
    </span>
  );
};

export default Badge;
