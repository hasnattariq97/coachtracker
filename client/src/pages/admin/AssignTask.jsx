import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import { PlusCircle, ChevronLeft, Check } from 'lucide-react';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';

const AssignTask = () => {
  const [coaches, setCoaches]     = useState([]);
  const [coachesError, setCoachesError] = useState(false);
  const [loading, setLoading]     = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [form, setForm]           = useState({ coach_ids: [], title: '', description: '', priority: 'medium', due_date: '' });
  const dropdownRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    axios.get('/api/coaches')
      .then(r => setCoaches(r.data))
      .catch(() => {
        setCoachesError(true);
        toast.error('Could not load coaches. Please refresh.');
      });
  }, []);

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  const toggleCoach = (coachId) => {
    setForm(f => ({
      ...f,
      coach_ids: f.coach_ids.includes(coachId)
        ? f.coach_ids.filter(id => id !== coachId)
        : [...f.coach_ids, coachId]
    }));
  };

  const toggleSelectAll = () => {
    setForm(f => ({
      ...f,
      coach_ids: f.coach_ids.length === coaches.length ? [] : coaches.map(c => c.id)
    }));
  };

  const selectedCoaches = coaches.filter(c => form.coach_ids.includes(c.id));
  const minDate = new Date().toISOString().split('T')[0];

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await axios.post('/api/tasks', {
        title: form.title,
        description: form.description,
        priority: form.priority,
        due_date: new Date(form.due_date).toISOString(),
        coach_ids: form.coach_ids,
      });
      toast.success(`Task assigned to ${selectedCoaches.length} coach${selectedCoaches.length > 1 ? 'es' : ''}! 🎯`);
      navigate('/admin/tasks');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to assign task');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl fade-in">
      <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-sm text-slate-500 hover:text-primary-700 mb-5 transition-colors">
        <ChevronLeft size={16} /> Back
      </button>

      <Card>
        <div className="mb-6">
          <h2 className="text-lg font-heading font-bold text-primary-900">Assign New Task</h2>
          <p className="text-sm text-slate-500 mt-1">Set a clear challenge with a deadline to drive momentum.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Coaches Multi-Select */}
          <div>
            <label className="block text-sm font-medium text-primary-800 mb-1.5">Assign to Coaches</label>
            <div className="relative" ref={dropdownRef}>
              <button
                type="button"
                onClick={() => setShowDropdown(!showDropdown)}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:bg-white focus:border-primary-400 focus:ring-2 focus:ring-primary-100 outline-none transition-all text-left flex justify-between items-center hover:bg-white"
              >
                <span>
                  {form.coach_ids.length === 0
                    ? 'Select coaches…'
                    : form.coach_ids.length === coaches.length
                    ? `All coaches (${coaches.length})`
                    : `${form.coach_ids.length} coach${form.coach_ids.length > 1 ? 'es' : ''} selected`}
                </span>
                <span className="text-slate-400">▼</span>
              </button>

              {showDropdown && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-10">
                  <div className="max-h-64 overflow-y-auto">
                    {/* Select All option */}
                    <button
                      type="button"
                      onClick={toggleSelectAll}
                      className="w-full px-3 py-2.5 text-left text-sm hover:bg-primary-50 border-b border-slate-100 flex items-center gap-2 font-medium text-primary-800"
                    >
                      <input
                        type="checkbox"
                        checked={form.coach_ids.length === coaches.length && coaches.length > 0}
                        readOnly
                        className="cursor-pointer"
                      />
                      Select all coaches
                    </button>

                    {coachesError ? (
                      <div className="px-3 py-2.5 text-xs text-red-600">
                        Coaches failed to load — refresh the page to try again.
                      </div>
                    ) : coaches.length === 0 ? (
                      <div className="px-3 py-2.5 text-xs text-slate-500">No coaches available</div>
                    ) : (
                      coaches.map(c => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => toggleCoach(c.id)}
                          className="w-full px-3 py-2.5 text-left text-sm hover:bg-slate-50 border-b border-slate-50 last:border-b-0 flex items-center gap-2"
                        >
                          <input
                            type="checkbox"
                            checked={form.coach_ids.includes(c.id)}
                            readOnly
                            className="cursor-pointer"
                          />
                          <span className="flex-1">{c.name}</span>
                          {form.coach_ids.includes(c.id) && <Check size={16} className="text-primary-600" />}
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {form.coach_ids.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {selectedCoaches.map(c => (
                  <span key={c.id} className="inline-flex items-center gap-1 px-2.5 py-1 bg-primary-100 text-primary-700 text-xs rounded-full font-medium">
                    {c.name}
                    <button
                      type="button"
                      onClick={() => toggleCoach(c.id)}
                      className="hover:text-primary-900"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}

            {form.coach_ids.length === 0 && (
              <p className="mt-1 text-xs text-red-600">Please select at least one coach</p>
            )}
          </div>

          {/* Title */}
          <div>
            <label htmlFor="title" className="block text-sm font-medium text-primary-800 mb-1.5">Task Title</label>
            <input
              id="title"
              value={form.title}
              onChange={set('title')}
              placeholder="e.g. Complete Q2 Growth Strategy"
              required
              maxLength={200}
              className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:bg-white focus:border-primary-400 focus:ring-2 focus:ring-primary-100 outline-none transition-all"
            />
            <p className="mt-1 text-right text-[11px] text-slate-400">{form.title.length}/200</p>
          </div>

          {/* Description */}
          <div>
            <label htmlFor="desc" className="block text-sm font-medium text-primary-800 mb-1.5">
              Description <span className="text-slate-400 font-normal">(optional)</span>
            </label>
            <textarea
              id="desc"
              value={form.description}
              onChange={set('description')}
              placeholder="What needs to be done? Be specific so your coach can hit the ground running."
              rows={3}
              maxLength={1000}
              className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:bg-white focus:border-primary-400 focus:ring-2 focus:ring-primary-100 outline-none transition-all resize-none"
            />
            <p className="mt-1 text-right text-[11px] text-slate-400">{form.description.length}/1000</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Priority */}
            <div>
              <label htmlFor="priority" className="block text-sm font-medium text-primary-800 mb-1.5">Priority</label>
              <select
                id="priority"
                value={form.priority}
                onChange={set('priority')}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:bg-white focus:border-primary-400 focus:ring-2 focus:ring-primary-100 outline-none transition-all"
              >
                <option value="high">🔴 High</option>
                <option value="medium">🟡 Medium</option>
                <option value="low">🟢 Low</option>
              </select>
            </div>

            {/* Due date */}
            <div>
              <label htmlFor="due" className="block text-sm font-medium text-primary-800 mb-1.5">Due Date</label>
              <input
                id="due"
                type="date"
                value={form.due_date}
                onChange={set('due_date')}
                min={minDate}
                required
                className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:bg-white focus:border-primary-400 focus:ring-2 focus:ring-primary-100 outline-none transition-all"
              />
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="secondary" className="flex-1" onClick={() => navigate(-1)}>Cancel</Button>
            <Button type="submit" loading={loading} icon={PlusCircle} className="flex-1">Assign Task</Button>
          </div>
        </form>
      </Card>
    </div>
  );
};

export default AssignTask;
