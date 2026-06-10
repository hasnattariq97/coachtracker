import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Clock, Zap, TrendingUp, AlertCircle, RefreshCw, Activity } from 'lucide-react';

export default function AgentDashboard() {
  const [agentStatus, setAgentStatus] = useState(null);
  const [decisions, setDecisions] = useState(null);
  const [patterns, setPatterns] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      const [statusRes, decisionsRes, patternsRes] = await Promise.all([
        axios.get('/api/admin/agent-status'),
        axios.get('/api/admin/decisions?hours=24'),
        axios.get('/api/admin/coach-patterns'),
      ]);
      setAgentStatus(statusRes.data);
      setDecisions(decisionsRes.data);
      setPatterns(patternsRes.data);
      setError(null);
    } catch (err) {
      setError('Failed to load agent data. Check backend connection.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-3 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8">
        <div className="flex items-center gap-3 text-red-600 bg-red-50 p-4 rounded-xl">
          <AlertCircle size={20} />
          <p>{error}</p>
        </div>
      </div>
    );
  }

  const queuePending = agentStatus?.groq_queue_pending ?? 0;
  const queueColor = queuePending > 30 ? 'text-red-600 bg-red-50' : queuePending > 10 ? 'text-amber-600 bg-amber-50' : 'text-teal-600 bg-teal-50';

  return (
    <div className="p-6 md:p-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 font-heading">Agent Dashboard</h1>
          <p className="text-gray-500 text-sm mt-1">Real-time view of autonomous coaching agents</p>
        </div>
        <button
          onClick={fetchData}
          className="flex items-center gap-2 px-3 py-2 text-sm text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
        >
          <RefreshCw size={14} />
          Refresh
        </button>
      </div>

      {/* Agent Status Cards */}
      <div>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Agent Status</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <AgentStatusCard title="Monitoring" data={agentStatus?.monitoring} color="teal" />
          <AgentStatusCard title="Support" data={agentStatus?.support} color="blue" />
          <AgentStatusCard title="Reporting" data={agentStatus?.reporting} color="purple" />
        </div>
      </div>

      {/* Groq Queue */}
      <div>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Groq Queue</h2>
        <div className="bg-white rounded-xl border border-gray-200 p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary-100 rounded-xl flex items-center justify-center">
              <Zap size={18} className="text-primary-600" />
            </div>
            <div>
              <p className="font-medium text-gray-900">Pending Requests</p>
              <p className="text-xs text-gray-500 mt-0.5">
                {queuePending <= 10 ? 'Healthy' : queuePending <= 30 ? 'Monitor — approaching limit' : 'High — rate limit risk'}
              </p>
            </div>
          </div>
          <div className={`text-3xl font-bold px-4 py-2 rounded-xl ${queueColor}`}>
            {queuePending}
          </div>
        </div>
      </div>

      {/* Decision Analytics + Coach Patterns */}
      <div>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Analytics</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <DecisionStats summary={decisions?.summary} />
          <CoachPatterns patterns={patterns?.patterns} />
        </div>
      </div>

      {/* Recent Decisions Table */}
      <div>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Recent Decisions (24h)</h2>
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <DecisionsTable decisions={decisions?.decisions} />
        </div>
      </div>
    </div>
  );
}

function AgentStatusCard({ title, data, color }) {
  const colorMap = {
    teal: 'bg-teal-50 text-teal-600',
    blue: 'bg-blue-50 text-blue-600',
    purple: 'bg-purple-50 text-purple-600',
  };
  const iconColor = colorMap[color] || colorMap.teal;

  const formatTime = (ts) => {
    if (!ts) return '—';
    const diff = Date.now() - new Date(ts).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center gap-3 mb-4">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${iconColor}`}>
          <Clock size={16} />
        </div>
        <h3 className="font-semibold text-gray-900">{title} Agent</h3>
      </div>
      {!data ? (
        <p className="text-sm text-gray-400 italic">No data yet</p>
      ) : (
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-500">Last run</span>
            <span className="font-medium">{formatTime(data.timestamp)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Status</span>
            <span className={`font-semibold ${data.status === 'success' ? 'text-green-600' : 'text-red-600'}`}>
              {data.status === 'success' ? '✓ Complete' : `⚠ ${data.status}`}
            </span>
          </div>
          {data.snapshots_created != null && (
            <div className="flex justify-between">
              <span className="text-gray-500">Snapshots</span>
              <span className="font-medium">{data.snapshots_created}</span>
            </div>
          )}
          {data.coaches_at_risk != null && (
            <div className="flex justify-between">
              <span className="text-gray-500">At-risk coaches</span>
              <span className={`font-medium ${data.coaches_at_risk > 0 ? 'text-amber-600' : 'text-gray-700'}`}>{data.coaches_at_risk}</span>
            </div>
          )}
          {data.actions_taken != null && (
            <div className="flex justify-between">
              <span className="text-gray-500">Actions taken</span>
              <span className="font-medium">{data.actions_taken}</span>
            </div>
          )}
          {data.report_generated != null && (
            <div className="flex justify-between">
              <span className="text-gray-500">Report</span>
              <span className="font-medium text-green-600">{data.report_generated ? 'Generated' : 'Pending'}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function DecisionStats({ summary }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
        <Activity size={16} className="text-primary-600" />
        Decision Quality
      </h3>
      {!summary ? (
        <p className="text-sm text-gray-400 italic">No data yet</p>
      ) : (
        <div className="space-y-4">
          <Stat label="Total Decisions (24h)" value={summary.total_decisions} big />
          <Stat label="Avg. Groq Confidence" value={summary.groq_vs_fallback?.groq_confidence_avg ?? '—'} />
          <div>
            <p className="text-xs text-gray-500 mb-1">Fallback Decisions</p>
            <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${
              (summary.groq_vs_fallback?.fallback_count ?? 0) > 5 ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-700'
            }`}>
              {summary.groq_vs_fallback?.fallback_count ?? 0}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, big }) {
  return (
    <div>
      <p className="text-xs text-gray-500 mb-0.5">{label}</p>
      <p className={`font-bold text-gray-900 ${big ? 'text-3xl' : 'text-xl'}`}>{value ?? '—'}</p>
    </div>
  );
}

function CoachPatterns({ patterns }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
        <TrendingUp size={16} className="text-primary-600" />
        Coach Patterns (7d)
      </h3>
      {!patterns || Object.keys(patterns).length === 0 ? (
        <p className="text-sm text-gray-400 italic">No pattern data yet</p>
      ) : (
        <div className="space-y-3">
          {Object.entries(patterns).map(([pattern, data]) => {
            const patternLabels = {
              procrastinator: { label: 'Procrastinator', color: 'bg-red-100 text-red-700' },
              fast_track: { label: 'Fast-track', color: 'bg-green-100 text-green-700' },
              steady: { label: 'Steady', color: 'bg-teal-100 text-teal-700' },
              inconsistent: { label: 'Inconsistent', color: 'bg-amber-100 text-amber-700' },
            };
            const meta = patternLabels[pattern] || { label: pattern, color: 'bg-gray-100 text-gray-700' };
            return (
              <div key={pattern} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${meta.color}`}>
                    {meta.label}
                  </span>
                  <span className="text-xs text-gray-500">{data.coaches?.length ?? 0} coaches</span>
                </div>
                <span className="text-sm font-semibold text-gray-900">{data.detections} detections</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function DecisionsTable({ decisions }) {
  if (!decisions?.length) {
    return <p className="text-sm text-gray-400 italic text-center py-8">No decisions in the last 24 hours</p>;
  }

  const confidenceClass = (conf) => {
    if (!conf || parseFloat(conf) === 0) return 'bg-gray-100 text-gray-600';
    if (parseFloat(conf) > 0.8) return 'bg-green-100 text-green-800';
    if (parseFloat(conf) > 0.5) return 'bg-blue-100 text-blue-800';
    return 'bg-gray-100 text-gray-600';
  };

  const formatTime = (ts) => {
    if (!ts) return '—';
    return new Date(ts).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            {['Time', 'Agent', 'Coach', 'Groq Rec.', 'Actual', 'Confidence'].map(h => (
              <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {decisions.slice(0, 20).map((d, i) => (
            <tr key={d.id ?? i} className={d.overridden ? 'bg-yellow-50' : ''}>
              <td className="px-4 py-3 text-gray-600 font-mono text-xs">{formatTime(d.timestamp)}</td>
              <td className="px-4 py-3 text-gray-700 capitalize">{(d.agent_type || '—').replace(/_/g, ' ')}</td>
              <td className="px-4 py-3 text-gray-700">Coach {d.coach_id}</td>
              <td className="px-4 py-3 font-mono text-xs text-gray-500">{d.groq_recommendation || '—'}</td>
              <td className="px-4 py-3 font-mono text-xs font-semibold text-gray-900">{d.final_action || '—'}</td>
              <td className="px-4 py-3">
                <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${confidenceClass(d.groq_confidence)}`}>
                  {d.groq_confidence && parseFloat(d.groq_confidence) > 0
                    ? `${Math.round(parseFloat(d.groq_confidence) * 100)}%`
                    : 'Fallback'}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
