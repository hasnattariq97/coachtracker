import React from 'react';
import { Loader2 } from 'lucide-react';

const variants = {
  primary:   'bg-primary-600 text-white hover:bg-primary-700 shadow-sm',
  secondary: 'bg-primary-50 text-primary-700 border border-primary-200 hover:bg-primary-100',
  ghost:     'text-primary-600 hover:bg-primary-50',
  danger:    'bg-red-600 text-white hover:bg-red-700 shadow-sm',
  accent:    'bg-accent-600 text-white hover:bg-accent-700 shadow-sm',
};

const sizes = {
  sm: 'px-3 py-1.5 text-xs gap-1.5',
  md: 'px-4 py-2 text-sm gap-2',
  lg: 'px-5 py-2.5 text-sm gap-2',
};

const Button = ({
  children,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  className = '',
  icon: Icon,
  ...props
}) => (
  <button
    disabled={disabled || loading}
    className={`
      inline-flex items-center justify-center font-medium rounded-lg
      transition-all duration-150 active:scale-95 min-h-[44px]
      focus-visible:outline-2 focus-visible:outline-primary-600 focus-visible:outline-offset-2
      disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100
      ${variants[variant]} ${sizes[size]} ${className}
    `}
    {...props}
  >
    {loading
      ? <Loader2 size={14} className="animate-spin shrink-0" />
      : Icon && <Icon size={14} className="shrink-0" />
    }
    {children}
  </button>
);

export default Button;
