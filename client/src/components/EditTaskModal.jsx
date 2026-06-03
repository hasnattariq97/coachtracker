import React, { useState, useEffect } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import Modal from './ui/Modal';
import Button from './ui/Button';

const EditTaskModal = ({ task, onClose, onSaved }) => {
  const [form, setForm] = useState({ title: '', description: '', priority: 'medium', due_date: '' });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (task) {
      setForm({
        title:       task.title || '',
        description: task.description || '',
        priority:    task.priority || 'medium',
        due_date:    task.due_date ? task.due_date.split('T')[0] : '',
      });
    }
  }, [task]);

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await axios.put(`/api/tasks/${task.id}`, {
        ...form,
        due_date: new Date(form.due_date).toISOString(),
      });
      toast.success('Task updated!');
      onSaved();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update task');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open={!!task} onClose={onClose} title="Edit Task">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="edit-title" className="block text-sm font-medium text-primary-800 mb-1.5">Title</label>
          <input
            id="edit-title"
            value={form.title}
            onChange={set('title')}
            required
            maxLength={200}
            className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:bg-white focus:border-primary-400 focus:ring-2 focus:ring-primary-100 outline-none transition-all"
          />
        </div>
        <div>
          <label htmlFor="edit-desc" className="block text-sm font-medium text-primary-800 mb-1.5">Description</label>
          <textarea
            id="edit-desc"
            value={form.description}
            onChange={set('description')}
            rows={3}
            maxLength={1000}
            className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:bg-white focus:border-primary-400 focus:ring-2 focus:ring-primary-100 outline-none transition-all resize-none"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="edit-priority" className="block text-sm font-medium text-primary-800 mb-1.5">Priority</label>
            <select id="edit-priority" value={form.priority} onChange={set('priority')}
              className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:bg-white focus:border-primary-400 outline-none">
              <option value="high">🔴 High</option>
              <option value="medium">🟡 Medium</option>
              <option value="low">🟢 Low</option>
            </select>
          </div>
          <div>
            <label htmlFor="edit-due" className="block text-sm font-medium text-primary-800 mb-1.5">Due Date</label>
            <input id="edit-due" type="date" value={form.due_date} onChange={set('due_date')} required
              className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:bg-white focus:border-primary-400 outline-none" />
          </div>
        </div>
        <div className="flex gap-3 pt-1">
          <Button type="button" variant="secondary" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={loading} className="flex-1">Save Changes</Button>
        </div>
      </form>
    </Modal>
  );
};

export default EditTaskModal;
