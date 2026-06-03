import React from 'react';

const ProgressBar = ({ value = 0, max = 100, label, color = 'primary', showPct = true }) => {
  const pct = Math.min(100, Math.round((value / (max || 1)) * 100));
  const barColor = {
    primary: 'bg-primary-500',
    green:   'bg-emerald-500',
    red:     'bg-red-500',
    orange:  'bg-accent-500',
  }[color] || 'bg-primary-500';

  return (
    <div className="w-full">
      {(label || showPct) && (
        <div className="flex justify-between items-center mb-1">
          {label && <span className="text-xs text-slate-600 font-medium">{label}</span>}
          {showPct && <span className="text-xs text-slate-500 tabular-nums">{pct}%</span>}
        </div>
      )}
      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${barColor}`}
          style={{ width: `${pct}%` }}
          role="progressbar"
          aria-valuenow={value}
          aria-valuemin={0}
          aria-valuemax={max}
        />
      </div>
    </div>
  );
};

export default ProgressBar;
