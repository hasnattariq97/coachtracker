import React from 'react';

const Skeleton = ({ className = '', lines = 0 }) => {
  if (lines > 0) {
    return (
      <div className="space-y-2">
        {Array.from({ length: lines }).map((_, i) => (
          <div key={i} className={`skeleton h-4 ${i === lines - 1 ? 'w-3/4' : 'w-full'}`} />
        ))}
      </div>
    );
  }
  return <div className={`skeleton ${className}`} />;
};

export const CardSkeleton = () => (
  <div className="bg-white rounded-xl shadow-sm border border-primary-100 p-6 space-y-3">
    <Skeleton className="h-4 w-24" />
    <Skeleton className="h-8 w-16" />
    <Skeleton className="h-3 w-32" />
  </div>
);

export const TableRowSkeleton = ({ cols = 5 }) => (
  <tr>
    {Array.from({ length: cols }).map((_, i) => (
      <td key={i} className="px-4 py-3">
        <Skeleton className="h-4 w-full" />
      </td>
    ))}
  </tr>
);

export const TaskCardSkeleton = () => (
  <div className="bg-white rounded-xl border border-primary-100 shadow-sm p-4 space-y-3">
    <div className="flex items-start justify-between">
      <Skeleton className="h-4 w-2/3" />
      <Skeleton className="h-5 w-14 rounded-full" />
    </div>
    <Skeleton className="h-3 w-1/2" />
    <div className="flex gap-2 pt-1">
      <Skeleton className="h-5 w-16 rounded-full" />
      <Skeleton className="h-5 w-20 rounded-full" />
    </div>
  </div>
);

export default Skeleton;
