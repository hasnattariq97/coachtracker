import React from 'react';

const EmptyState = ({ icon: Icon, title, message, action }) => (
  <div className="flex flex-col items-center justify-center py-16 px-6 text-center fade-in">
    {Icon && (
      <div className="w-16 h-16 bg-primary-100 rounded-2xl flex items-center justify-center mb-4">
        <Icon size={28} className="text-primary-500" />
      </div>
    )}
    <h3 className="text-base font-heading font-semibold text-primary-900 mb-2">{title}</h3>
    {message && <p className="text-sm text-slate-500 max-w-xs mb-6">{message}</p>}
    {action}
  </div>
);

export default EmptyState;
