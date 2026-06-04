import React, { useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { ClipboardList, Search, Filter } from 'lucide-react';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import EmptyState from '../../components/ui/EmptyState';
import Modal from '../../components/ui/Modal';
import { TableRowSkeleton } from '../../components/ui/Skeleton';
import TaskDetailSlideOver from '../../components/TaskDetailSlideOver';
import EditTaskModal from '../../components/EditTaskModal';

const STATUSES = ['all', 'assigned', 'in_progress', 'completed', 'overdue'];

const TaskBoard = () => {
  const [tasks, setTasks]           = useState([]);
  const [coaches, setCoaches]       = useState([]);
  const [loading, setLoading]       = useState(true);
  const [rawSearch, setRawSearch]   = useState('');
  const [search, setSearch]         = useState('');
  const [statusFilter, setStatus]   = useState('all');
  const [coachFilter, setCoach]     = useState('all');
  const [selected, setSelected]     = useState(null);
  const [selectedInstances, setSelectedInstances] = useState(null);
  const [editing, setEditing]       = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const fetchAll = useCallback(async () => {
    try {
      const [t, c] = await Promise.all([axios.get('/api/tasks'), axios.get('/api/coaches')]);
      setTasks(t.data);
      setCoaches(c.data);
    } catch { toast.error('Failed to load tasks'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  useEffect(() => {
    const id = setTimeout(() => setSearch(rawSearch), 300);
    return () => clearTimeout(id);
  }, [rawSearch]);

  const filtered = useMemo(() => tasks.filter(t => {
    if (statusFilter !== 'all' && t.status !== statusFilter) return false;
    if (coachFilter  !== 'all' && String(t.coach_id) !== coachFilter) return false;
    if (search && !t.title.toLowerCase().includes(search.toLowerCase()) &&
        !t.coach_name?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }), [tasks, statusFilter, coachFilter, search]);

  // Group tasks by title/description/priority/due_date to show one card per task
  const groupedTasks = useMemo(() => {
    const groups = {};
    filtered.forEach(t => {
      const key = `${t.title}|${t.description}|${t.priority}|${t.due_date}`;
      if (!groups[key]) {
        groups[key] = {
          baseTask: t,
          instances: [],
          allIds: [],
        };
      }
      groups[key].instances.push(t);
      groups[key].allIds.push(t.id);
    });
    return Object.values(groups);
  }, [filtered]);

  const confirmDelete = (id) => {
    setDeleteTarget(id);
  };

  const executeDelete = async () => {
    try {
      // deleteTarget now contains array of all task IDs for this task
      const idsToDelete = Array.isArray(deleteTarget) ? deleteTarget : [deleteTarget];
      await Promise.all(idsToDelete.map(id => axios.delete(`/api/tasks/${id}`)));
      toast.success(`Task${idsToDelete.length > 1 ? 's' : ''} deleted.`);
      setSelected(null);
      setDeleteTarget(null);
      fetchAll();
    } catch { toast.error('Failed to delete task'); }
  };

  const daysLeft = (due) => {
    const diff = Math.ceil((new Date(due) - new Date()) / 86400000);
    if (diff < 0) return <span className="text-red-600 font-medium">{Math.abs(diff)}d overdue</span>;
    if (diff === 0) return <span className="text-amber-600 font-medium">Due today</span>;
    return <span className="text-slate-500">{diff}d left</span>;
  };

  return (
    <div className="space-y-5 fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-heading font-bold text-primary-900">Task Board</h2>
          <p className="text-sm text-slate-500">{groupedTasks.length} task{groupedTasks.length !== 1 ? 's' : ''}</p>
        </div>
      </div>

      {/* Filters */}
      <Card className="py-4 px-5">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={rawSearch}
              onChange={e => setRawSearch(e.target.value)}
              placeholder="Search tasks or coaches…"
              className="w-full pl-8 pr-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:bg-white focus:border-primary-400 focus:ring-2 focus:ring-primary-100 outline-none transition-all"
            />
          </div>
          <select
            value={statusFilter}
            onChange={e => setStatus(e.target.value)}
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:border-primary-400 outline-none"
          >
            {STATUSES.map(s => <option key={s} value={s}>{s === 'all' ? 'All statuses' : s.replace('_', ' ')}</option>)}
          </select>
          <select
            value={coachFilter}
            onChange={e => setCoach(e.target.value)}
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:border-primary-400 outline-none"
          >
            <option value="all">All coaches</option>
            {coaches.map(c => <option key={c.id} value={String(c.id)}>{c.name}</option>)}
          </select>
        </div>
      </Card>

      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                {['Task', 'Coach', 'Priority', 'Status', 'Due', 'Actions'].map(h => (
                  <th key={h} className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wide py-3 px-4 first:pl-5">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => <TableRowSkeleton key={i} cols={6} />)
              ) : groupedTasks.length === 0 ? (
                <tr><td colSpan={6} className="py-12">
                  <EmptyState icon={ClipboardList} title="No tasks found" message="Try adjusting your filters." />
                </td></tr>
              ) : groupedTasks.map(group => {
                const t = group.baseTask;
                const hasOverdue = group.instances.some(inst => inst.status === 'overdue');
                return (
                  <tr
                    key={t.id}
                    className={`border-b border-slate-50 hover:bg-slate-50 transition-colors cursor-pointer
                                ${hasOverdue ? 'bg-red-50/40' : ''}`}
                    onClick={() => {
                      setSelected(t);
                      setSelectedInstances(group.instances);
                    }}
                  >
                    <td className="py-3 px-4 pl-5 font-medium text-primary-900 max-w-[200px]">
                      <p className="truncate">{t.title}</p>
                      {t.description && <p className="text-xs text-slate-400 truncate mt-0.5">{t.description}</p>}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex flex-wrap gap-1.5 items-center">
                        {group.instances.map(inst => (
                          <div key={inst.id} className="flex items-center gap-1 group/coach relative">
                            <div className="w-7 h-7 rounded-full bg-primary-100 text-primary-700 text-xs font-bold flex items-center justify-center shrink-0">
                              {inst.coach_name?.charAt(0).toUpperCase()}
                            </div>
                            <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${
                              inst.status === 'completed' ? 'bg-green-100 text-green-700' :
                              inst.status === 'overdue' ? 'bg-red-100 text-red-700' :
                              'bg-slate-100 text-slate-700'
                            }`}>
                              {inst.status === 'completed' ? '✓' : inst.status === 'overdue' ? '!' : '○'}
                            </span>
                            {/* Hover tooltip */}
                            <div className="hidden group-hover/coach:block absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-slate-900 text-white text-xs rounded whitespace-nowrap z-10">
                              {inst.coach_name}
                            </div>
                          </div>
                        ))}
                      </div>
                    </td>
                    <td className="py-3 px-4"><Badge value={t.priority} /></td>
                    <td className="py-3 px-4">
                      {group.instances.length === 1 ? (
                        <Badge value={t.status} />
                      ) : (
                        <div className="text-xs space-y-1">
                          <div className="text-slate-600">
                            {group.instances.filter(i => i.status === 'completed').length}/{group.instances.length} done
                          </div>
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap text-xs">
                      <div>{new Date(t.due_date).toLocaleDateString([], { month: 'short', day: 'numeric' })}</div>
                      <div>{daysLeft(t.due_date)}</div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                        <Button size="sm" variant="ghost" onClick={() => setEditing(t)}>Edit</Button>
                        <Button size="sm" variant="ghost" onClick={() => confirmDelete(group.allIds)} className="text-red-500 hover:text-red-700 hover:bg-red-50">Del</Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <TaskDetailSlideOver task={selected} instances={selectedInstances} onClose={() => { setSelected(null); setSelectedInstances(null); }} onEdit={t => { setSelected(null); setSelectedInstances(null); setEditing(t); }} onDelete={confirmDelete} onRefresh={fetchAll} />
      <EditTaskModal task={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); fetchAll(); }} />

      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Delete Task" size="sm">
        <p className="text-sm text-slate-600 mb-5">
          Delete this task? This can't be undone.
        </p>
        <div className="flex gap-3">
          <Button variant="secondary" className="flex-1" onClick={() => setDeleteTarget(null)}>Cancel</Button>
          <Button variant="danger" className="flex-1" onClick={executeDelete}>Delete</Button>
        </div>
      </Modal>
    </div>
  );
};

export default TaskBoard;
