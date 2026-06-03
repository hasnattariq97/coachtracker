import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import { PlusCircle, ChevronLeft } from 'lucide-react';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';

const AssignTask = () => {
  const [coaches, setCoaches]   = useState([]);
  const [loading, setLoading]   = useState(false);
  const [form, setForm]         = useState({ coach_id: '', title: '', description: '', priority: 'medium', due_date: '' });
  const navigate = useNavigate();

  useEffect(() => {
    axios.get('/api/coaches').then(r => setCoaches(r.data)).catch(() => {});
  }, []);

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  const minDate = new Date().toISOString().split('T')[0];

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await axios.post('/api/tasks', {
        ...form,
        coach_id: Number(form.coach_id),
        due_date: new Date(form.due_date).toISOString(),
      });
      toast.success("Task assigned! Let's see some momentum. 🎯");
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
          {/* Coach */}
          <div>
            <label htmlFor="coach" className="block text-sm font-medium text-primary-800 mb-1.5">Assign to Coach</label>
            <select
              id="coach"
              value={form.coach_id}
              onChange={set('coach_id')}
              required
              className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:bg-white focus:border-primary-400 focus:ring-2 focus:ring-primary-100 outline-none transition-all"
            >
              <option value="">Select a coach…</option>
              {coaches.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
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
