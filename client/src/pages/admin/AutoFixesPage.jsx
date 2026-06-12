import React, { useState, useEffect } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { Wrench, RefreshCw, AlertTriangle } from 'lucide-react';

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
  const [escalated, setEscalated] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadFixes = async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const [fixesRes, escalatedRes] = await Promise.all([
        axios.get('/api/auto-fixes'),
        axios.get('/api/auto-fixes/escalated'),
      ]);
      setFixes(fixesRes.data || []);
      setEscalated(escalatedRes.data || []);
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
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Total', value: total, color: 'text-gray-800' },
          { label: 'Awaiting Approval', value: pending, color: 'text-teal-700' },
          { label: 'Deployed', value: deployed, color: 'text-green-700' },
          { label: 'Escalated', value: escalated.length, color: escalated.length > 0 ? 'text-red-600' : 'text-gray-400' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl border border-gray-100 p-4 text-center">
            <p className={`text-2xl font-bold font-heading ${s.color}`}>{s.value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Auto-fix table */}
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

      {/* Escalated bugs section */}
      {!loading && escalated.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <AlertTriangle size={16} className="text-red-500" />
            <h2 className="text-base font-heading font-semibold text-gray-800">
              Escalated — Needs Manual Fix ({escalated.length})
            </h2>
          </div>
          <p className="text-xs text-gray-500 -mt-1">
            These bugs were diagnosed by Groq but deemed too complex for autonomous fixing. Fix manually and deploy.
          </p>
          <div className="space-y-3">
            {escalated.map(bug => (
              <div key={bug.id} className="bg-white border border-red-100 rounded-2xl shadow-sm p-5 space-y-3">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-medium text-gray-900">{bug.title}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {new Date(bug.updated_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      {' · '}
                      <span className="capitalize">{bug.type?.replace('_', ' ')}</span>
                    </p>
                  </div>
                  <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full font-medium capitalize
                    ${bug.priority === 'critical' ? 'bg-red-100 text-red-700'
                      : bug.priority === 'high' ? 'bg-orange-100 text-orange-700'
                      : bug.priority === 'medium' ? 'bg-blue-100 text-blue-700'
                      : 'bg-gray-100 text-gray-600'}`}
                  >
                    {bug.priority}
                  </span>
                </div>

                {bug.escalation_reason && (
                  <div className="bg-red-50 border border-red-100 rounded-lg px-3 py-2 text-xs text-red-700">
                    <span className="font-semibold">Why escalated: </span>{bug.escalation_reason}
                  </div>
                )}

                {bug.root_cause && (
                  <div className="text-xs text-gray-600">
                    <span className="font-semibold text-gray-700">Groq diagnosis: </span>{bug.root_cause}
                  </div>
                )}

                {Array.isArray(bug.affected_files) && bug.affected_files.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    <span className="text-xs text-gray-500 font-medium">Files:</span>
                    {bug.affected_files.map(f => (
                      <span key={f} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded font-mono">{f}</span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default AutoFixesPage;
