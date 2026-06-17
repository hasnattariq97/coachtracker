import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { TableRowSkeleton } from '../../components/ui/Skeleton';
import EmptyState from '../../components/ui/EmptyState';
import { Users } from 'lucide-react';

const RegionDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [region, setRegion] = useState(null);
  const [coaches, setCoaches] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      axios.get('/api/admins/regions/overview'),
      axios.get(`/api/admins/regions/${id}/coaches`),
    ])
      .then(([overviewRes, coachesRes]) => {
        const found = overviewRes.data.find((r) => String(r.id) === String(id));
        setRegion(found || null);
        setCoaches(coachesRes.data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/super-admin/overview')}
          className="text-sm text-teal-600 hover:text-teal-800 font-medium transition-colors"
        >
          ← Back
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-heading font-bold text-gray-900">
          {region ? region.name : `Region ${id}`}
        </h1>
        {region?.admin_name && (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-teal-50 text-teal-700 border border-teal-200">
            Managed by: {region.admin_name}
          </span>
        )}
        {region && !region.admin_name && (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-600 border border-amber-200">
            No admin assigned
          </span>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-primary-100 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-100">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Coach
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Active Tasks
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Completed
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Overdue
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {loading ? (
              <>
                <TableRowSkeleton cols={4} />
                <TableRowSkeleton cols={4} />
                <TableRowSkeleton cols={4} />
              </>
            ) : coaches.length === 0 ? (
              <tr>
                <td colSpan={4}>
                  <EmptyState
                    icon={Users}
                    title="No coaches in this region yet"
                    message="Coaches assigned to this region will appear here."
                  />
                </td>
              </tr>
            ) : (
              coaches.map((coach) => (
                <tr key={coach.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900 text-sm">{coach.name}</div>
                    <div className="text-xs text-gray-400">{coach.email}</div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">{coach.active_tasks}</td>
                  <td className="px-4 py-3 text-sm text-gray-700">{coach.completed}</td>
                  <td className="px-4 py-3 text-sm">
                    <span className={coach.overdue > 0 ? 'font-semibold text-orange-600' : 'text-gray-400'}>
                      {coach.overdue}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default RegionDetail;
