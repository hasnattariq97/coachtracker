import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import Card from '../../components/ui/Card';
import { CardSkeleton } from '../../components/ui/Skeleton';

const Overview = () => {
  const [regions, setRegions] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    axios.get('/api/admins/regions/overview')
      .then(({ data }) => setRegions(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-bold text-gray-900">Regional Overview</h1>
        <p className="text-sm text-gray-500 mt-1">6 administrative regions</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading
          ? Array.from({ length: 6 }).map((_, i) => <CardSkeleton key={i} />)
          : regions.map((region) => (
              <Card
                key={region.id}
                hover
                onClick={() => navigate(`/super-admin/region/${region.id}`)}
              >
                <h2 className="font-heading text-lg font-bold text-gray-900 mb-1">
                  {region.name}
                </h2>
                {region.admin_name ? (
                  <p className="text-xs text-gray-500 mb-3">
                    Managed by: {region.admin_name}
                  </p>
                ) : (
                  <p className="text-xs text-amber-500 mb-3">No admin assigned</p>
                )}
                <div className="flex flex-wrap gap-2">
                  <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-teal-50 text-teal-700 border border-teal-200">
                    {region.coach_count} Coaches
                  </span>
                  <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                    {region.active_tasks} Active
                  </span>
                  <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${
                    region.overdue_tasks > 0
                      ? 'bg-orange-50 text-orange-700 border-orange-200'
                      : 'bg-slate-50 text-slate-500 border-slate-200'
                  }`}>
                    {region.overdue_tasks} Overdue
                  </span>
                </div>
              </Card>
            ))
        }
      </div>
    </div>
  );
};

export default Overview;
