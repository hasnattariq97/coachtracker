import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { Users, UserPlus, Pencil, Trash2, Mail } from 'lucide-react';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import EmptyState from '../../components/ui/EmptyState';
import { CardSkeleton } from '../../components/ui/Skeleton';

const CoachForm = ({ initial = {}, onSubmit, loading }) => {
  const [form, setForm] = useState({ name: initial.name || '', email: initial.email || '', password: '' });
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));
  const isEdit = !!initial.id;

  return (
    <form onSubmit={e => { e.preventDefault(); onSubmit(form); }} className="space-y-4">
      {[
        { id: 'name',     label: 'Full Name',  type: 'text',     placeholder: 'Sarah Johnson', required: true  },
        { id: 'email',    label: 'Email',       type: 'email',    placeholder: 'sarah@team.com', required: true  },
        { id: 'password', label: isEdit ? 'New Password (leave blank to keep)' : 'Password', type: 'password', placeholder: '••••••••', required: !isEdit },
      ].map(({ id, label, ...rest }) => (
        <div key={id}>
          <label htmlFor={id} className="block text-sm font-medium text-primary-800 mb-1.5">{label}</label>
          <input
            id={id}
            value={form[id]}
            onChange={set(id)}
            className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm bg-slate-50
                       focus:bg-white focus:border-primary-400 focus:ring-2 focus:ring-primary-100 outline-none transition-all"
            {...rest}
          />
        </div>
      ))}
      <Button type="submit" loading={loading} className="w-full mt-2">
        {isEdit ? 'Save Changes' : 'Add Coach'}
      </Button>
    </form>
  );
};

const CoachCard = ({ coach, onEdit, onDelete }) => {
  const total = (coach.assigned || 0) + (coach.completed || 0) + (coach.overdue || 0);
  const initials = coach.name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '??';

  return (
    <Card className="flex flex-col gap-4 fade-in">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-primary-100 text-primary-700 font-bold text-sm flex items-center justify-center shrink-0">
            {initials}
          </div>
          <div className="min-w-0">
            <p className="font-heading font-semibold text-primary-900 truncate">{coach.name}</p>
            <p className="text-xs text-slate-400 flex items-center gap-1 truncate">
              <Mail size={10} />{coach.email}
            </p>
          </div>
        </div>
        <div className="flex gap-1 shrink-0">
          <button onClick={() => onEdit(coach)} className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-primary-600 hover:bg-primary-50 transition-colors" aria-label="Edit coach">
            <Pencil size={14} />
          </button>
          <button onClick={() => onDelete(coach)} className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors" aria-label="Delete coach">
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100">
        {[
          { label: 'Active',    value: coach.assigned  || 0, color: 'text-primary-600' },
          { label: 'Done',      value: coach.completed || 0, color: 'text-emerald-600' },
          { label: 'Overdue',   value: coach.overdue   || 0, color: 'text-red-600'     },
        ].map(({ label, value, color }) => (
          <div key={label} className="text-center">
            <p className={`text-xl font-heading font-bold tabular-nums ${color}`}>{value}</p>
            <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wide">{label}</p>
          </div>
        ))}
      </div>
    </Card>
  );
};

const CoachesPage = () => {
  const [coaches, setCoaches]       = useState([]);
  const [loading, setLoading]       = useState(true);
  const [saving, setSaving]         = useState(false);
  const [addOpen, setAddOpen]       = useState(false);
  const [editCoach, setEditCoach]   = useState(null);
  const [deleteCoach, setDeleteCoach] = useState(null);

  const fetchCoaches = useCallback(async () => {
    try {
      const { data } = await axios.get('/api/coaches');
      setCoaches(data);
    } catch { toast.error('Failed to load coaches'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchCoaches(); }, [fetchCoaches]);

  const handleAdd = async (form) => {
    setSaving(true);
    try {
      await axios.post('/api/coaches', form);
      toast.success('Coach added!');
      setAddOpen(false);
      fetchCoaches();
    } catch (e) { toast.error(e.response?.data?.error || 'Failed to add coach'); }
    finally { setSaving(false); }
  };

  const handleEdit = async (form) => {
    setSaving(true);
    try {
      const body = { name: form.name, email: form.email };
      if (form.password) body.password = form.password;
      await axios.put(`/api/coaches/${editCoach.id}`, body);
      toast.success('Coach updated!');
      setEditCoach(null);
      fetchCoaches();
    } catch (e) { toast.error(e.response?.data?.error || 'Failed to update coach'); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    setSaving(true);
    try {
      await axios.delete(`/api/coaches/${deleteCoach.id}`);
      toast.success('Coach removed.');
      setDeleteCoach(null);
      fetchCoaches();
    } catch { toast.error('Failed to delete coach'); }
    finally { setSaving(false); }
  };

  return (
    <div className="space-y-6 fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-heading font-bold text-primary-900">Coaches</h2>
          <p className="text-sm text-slate-500">{coaches.length} coach{coaches.length !== 1 ? 'es' : ''} on your team</p>
        </div>
        <Button icon={UserPlus} onClick={() => setAddOpen(true)}>Add Coach</Button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {[1,2,3].map(i => <CardSkeleton key={i} />)}
        </div>
      ) : coaches.length === 0 ? (
        <Card>
          <EmptyState
            icon={Users}
            title="No coaches yet"
            message="Time to build your team! Add your first coach to start assigning tasks."
            action={<Button icon={UserPlus} onClick={() => setAddOpen(true)}>Add Your First Coach</Button>}
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {coaches.map(c => (
            <CoachCard key={c.id} coach={c} onEdit={setEditCoach} onDelete={setDeleteCoach} />
          ))}
        </div>
      )}

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Add New Coach">
        <CoachForm onSubmit={handleAdd} loading={saving} />
      </Modal>

      <Modal open={!!editCoach} onClose={() => setEditCoach(null)} title="Edit Coach">
        {editCoach && <CoachForm initial={editCoach} onSubmit={handleEdit} loading={saving} />}
      </Modal>

      {/* Delete confirm */}
      <Modal open={!!deleteCoach} onClose={() => setDeleteCoach(null)} title="Remove Coach" size="sm">
        <p className="text-sm text-slate-600 mb-5">
          Remove <strong>{deleteCoach?.name}</strong>? Their tasks will also be deleted. This can't be undone.
        </p>
        <div className="flex gap-3">
          <Button variant="secondary" className="flex-1" onClick={() => setDeleteCoach(null)}>Cancel</Button>
          <Button variant="danger" className="flex-1" loading={saving} onClick={handleDelete}>Remove</Button>
        </div>
      </Modal>
    </div>
  );
};

export default CoachesPage;
