import React, { useState, useEffect } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { Wrench, RefreshCw } from 'lucide-react';

const STATUS_COLOR = {
  pending:          'bg-gray-100 text-gray-600',
  diagnosing:       'bg-yellow-100 text-yellow-700',
  planning:         'bg-orange-100 text-orange-700',
  implementing:     'bg-purple-100 text-purple-700',
  testing_passed:   'bg-blue-100 text-blue-700',
  review:           'bg-teal-100 text-teal-700',
  deployed:         'bg-green-100 text-green-700',
  escalated:        'bg-red-100 text-red-700',
  failed:           'bg-red-50 text-red-500',
};

const STATUS_LABEL = {
  pending:        'Pending',
  diagnosing:     'Diagnosing',
  planning:       'Planning',
  implementing:   'Implementing',
  testing_passed: 'Tests Passed',
  review:         'Awaiting Approval',
  deployed:       'Deployed ✓',
  escalated:      'Escalated',
  failed:         'Failed',
};

const AutoFixesPage = () => {
  const [fixes, setFixes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadFixes = async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const { data } = await axios.get('/api/auto-fixes');
      setFixes(data || []);
    } catch (err) {
      if (!silent) toast.error('Failed to load auto-fixes.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { loadFixes(); }, []);

  const pending  = fixes.filter(f => f.status === 'review').length;
  const deployed = fixes.filter(f => f.status === 'deployed').length;
  const total    = fixes.length;

  return (
    <div className="space-y-6 fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold text-gray-900">Auto-Fix Queue</h1>
          <p className="text-sm text-gray-500 mt-1">
            AI-generated fixes from coach-reported bugs. Approve to deploy.
          </p>
        </div>
        <button
          onClick={() => loadFixes(true)}
          disabled={refreshing}
          className="flex items-center gap-2 text-sm text-primary-600 hover:text-primary-700 font-medium disabled:opacity-50"
        >
          <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total', value: total, color: 'text-gray-800' },
          { label: 'Awaiting Approval', value: pending, color: 'text-teal-700' },
          { label: 'Deployed', value: deployed, color: 'text-green-700' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl border border-gray-100 p-4 text-center">
            <p className={`text-2xl font-bold font-heading ${s.color}`}>{s.value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="space-y-0 divide-y divide-gray-50">
            {[1, 2, 3].map(i => (
              <div key={i} className="px-6 py-4 flex gap-4 items-center">
                <div className="h-4 bg-gray-100 rounded animate-pulse flex-1" />
                <div className="h-5 w-24 bg-gray-100 rounded-full animate-pulse" />
              </div>
            ))}
          </div>
        ) : fixes.length === 0 ? (
          <div className="flex flex-col items-center py-16 text-gray-400 gap-3">
            <Wrench size={36} className="opacity-40" />
            <p className="text-sm">No auto-fixes yet. Coaches can report bugs from their dashboard.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-gray-100 bg-gray-50">
              <tr>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Issue</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Type</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Priority</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Created</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">PR</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {fixes.map(fix => (
                <tr key={fix.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 font-medium text-gray-900 max-w-xs truncate">{fix.title}</td>
                  <td className="px-6 py-4 text-gray-500 capitalize">{fix.type?.replace('_', ' ')}</td>
                  <td className="px-6 py-4">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize
                      ${fix.priority === 'critical' ? 'bg-red-100 text-red-700'
                        : fix.priority === 'high' ? 'bg-orange-100 text-orange-700'
                        : fix.priority === 'medium' ? 'bg-blue-100 text-blue-700'
                        : 'bg-gray-100 text-gray-600'}`}
                    >
                      {fix.priority}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLOR[fix.status] || 'bg-gray-100 text-gray-600'}`}>
                      {STATUS_LABEL[fix.status] || fix.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-gray-400 text-xs">
                    {new Date(fix.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                  </td>
                  <td className="px-6 py-4 text-gray-400 text-xs">
                    {fix.pr_number ? `#${fix.pr_number}` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {pending > 0 && (
        <div className="bg-teal-50 border border-teal-200 rounded-xl px-4 py-3 text-sm text-teal-800">
          <strong>{pending} fix{pending > 1 ? 'es' : ''} awaiting approval.</strong> Check your email at hasnat@niete.edu.pk for the one-click approve button.
        </div>
      )}
    </div>
  );
};

export default AutoFixesPage;
