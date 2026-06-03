import React from 'react';

const colorMap = {
  teal:   { bg: 'bg-primary-50',  icon: 'bg-primary-100  text-primary-600',  val: 'text-primary-900' },
  blue:   { bg: 'bg-blue-50',     icon: 'bg-blue-100    text-blue-600',      val: 'text-blue-900'    },
  green:  { bg: 'bg-emerald-50',  icon: 'bg-emerald-100 text-emerald-600',   val: 'text-emerald-900' },
  red:    { bg: 'bg-red-50',      icon: 'bg-red-100     text-red-600',       val: 'text-red-900'     },
  orange: { bg: 'bg-accent-50',   icon: 'bg-accent-100  text-accent-600',    val: 'text-accent-900'  },
};

const KPICard = ({ label, value, icon: Icon, color = 'teal', trend, trendLabel }) => {
  const c = colorMap[color] || colorMap.teal;
  return (
    <div className={`rounded-xl p-5 border border-primary-100 shadow-sm ${c.bg} fade-in`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">{label}</p>
          <p className={`text-3xl font-heading font-bold tabular-nums ${c.val}`}>{value ?? '—'}</p>
          {trendLabel && (
            <p className={`text-xs mt-1 font-medium ${trend >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
              {trend >= 0 ? '▲' : '▼'} {trendLabel}
            </p>
          )}
        </div>
        {Icon && (
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${c.icon}`}>
            <Icon size={18} />
          </div>
        )}
      </div>
    </div>
  );
};

export default KPICard;
