import React from 'react';

const Card = ({ children, className = '', hover = false, ...props }) => (
  <div
    className={`
      bg-white rounded-xl shadow-sm border border-primary-100 p-6
      ${hover ? 'hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-pointer' : ''}
      ${className}
    `}
    {...props}
  >
    {children}
  </div>
);

export default Card;
