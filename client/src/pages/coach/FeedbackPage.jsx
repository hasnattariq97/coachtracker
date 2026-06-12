import React, { useState, useEffect } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { MessageSquare, CheckCircle, Clock, AlertTriangle } from 'lucide-react';

const STATUS_COLOR = {
  submitted:    'bg-blue-100 text-blue-700',
  diagnosing:   'bg-yellow-100 text-yellow-700',
  planning:     'bg-orange-100 text-orange-700',
  implementing: 'bg-purple-100 text-purple-700',
  review:       'bg-teal-100 text-teal-700',
  approved:     'bg-green-100 text-green-700',
  deployed:     'bg-green-200 text-green-800',
  escalated:    'bg-red-100 text-red-700',
};

const PRIORITY_COLOR = {
  low:      'bg-gray-100 text-gray-600',
  medium:   'bg-blue-100 text-blue-700',
  high:     'bg-orange-100 text-orange-700',
  critical: 'bg-red-100 text-red-700',
};

const FeedbackPage = () => {
  const [form, setForm] = useState({ type: 'bug', title: '', description: '', priority: 'medium' });
  const [submitting, setSubmitting] = useState(false);
  const [history, setHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [submitted, setSubmitted] = useState(false);

  const loadHistory = () => {
    axios.get('/api/feedback')
      .then(r => setHistory(r.data || []))
      .catch(() => {})
      .finally(() => setLoadingHistory(false));
  };

  useEffect(() => { loadHistory(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title.trim() || !form.description.trim()) {
      toast.error('Title and description are required.');
      return;
    }
    setSubmitting(true);
    try {
      await axios.post('/api/feedback', form);
      toast.success('Feedback submitted! Agents will diagnose it within 5 minutes.');
      setForm({ type: 'bug', title: '', description: '', priority: 'medium' });
      setSubmitted(true);
      loadHistory();
      setTimeout(() => setSubmitted(false), 4000);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to submit feedback.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8 fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-heading font-bold text-gray-900">Report an Issue</h1>
        <p className="text-sm text-gray-500 mt-1">
          Describe a bug or problem — AI agents will diagnose and fix it automatically.
        </p>
      </div>

      {/* Submission form */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        {submitted ? (
          <div className="flex flex-col items-center py-6 gap-3 text-center">
            <CheckCircle size={40} className="text-primary-600" />
            <p className="font-medium text-gray-900">Submitted! Agents are on it.</p>
            <p className="text-sm text-gray-500">You'll see the status update below within a few minutes.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Type + Priority row */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                <select
                  value={form.type}
                  onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="bug">Bug</option>
                  <option value="problem">Problem</option>
                  <option value="feature_request">Feature Request</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
                <select
                  value={form.priority}
                  onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </div>
            </div>

            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
              <input
                type="text"
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                placeholder="Brief summary of the issue"
                maxLength={200}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="What happened? What did you expect? Steps to reproduce…"
                rows={5}
                maxLength={5000}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
              />
              <p className="text-xs text-gray-400 mt-1 text-right">{form.description.length}/5000</p>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-xl py-2.5 text-sm transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {submitting ? 'Submitting…' : 'Submit Report'}
            </button>
          </form>
        )}
      </div>

      {/* History */}
      <div>
        <h2 className="text-base font-heading font-semibold text-gray-800 mb-3">Your Submissions</h2>
        {loadingHistory ? (
          <div className="space-y-2">
            {[1, 2].map(i => (
              <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : history.length === 0 ? (
          <div className="text-center py-10 text-gray-400 text-sm bg-white rounded-2xl border border-gray-100">
            <MessageSquare size={32} className="mx-auto mb-2 opacity-40" />
            No reports yet. Submit your first one above.
          </div>
        ) : (
          <div className="space-y-2">
            {history.map(item => (
              <div key={item.id} className="bg-white rounded-xl border border-gray-100 px-4 py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{item.title}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {new Date(item.created_at).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PRIORITY_COLOR[item.priority] || 'bg-gray-100 text-gray-600'}`}>
                    {item.priority}
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLOR[item.status] || 'bg-gray-100 text-gray-600'}`}>
                    {item.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default FeedbackPage;
