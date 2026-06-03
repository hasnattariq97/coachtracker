import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { CheckSquare, AlertTriangle } from 'lucide-react';
import Card from '../../components/ui/Card';
import EmptyState from '../../components/ui/EmptyState';
import Button from '../../components/ui/Button';
import { TaskCardSkeleton } from '../../components/ui/Skeleton';
import TaskCard from '../../components/TaskCard';

const TABS = [
  { key: 'all',         label: 'All' },
  { key: 'active',      label: 'Active' },
  { key: 'completed',   label: 'Completed' },
  { key: 'overdue',     label: 'Overdue' },
];

const emptyMessages = {
  all:       { title: 'No tasks yet',       message: "Nothing assigned yet — enjoy the calm before the storm." },
  active:    { title: 'No active tasks',    message: "You're ahead of the game! Check back when new tasks arrive." },
  completed: { title: 'Nothing completed',  message: "Start finishing tasks and they'll show up here. You've got this!" },
  overdue:   { title: 'No overdue tasks',   message: "Great job staying on top of your work! Keep it up." },
};

const MyTasks = () => {
  const [tasks, setTasks]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const [tab, setTab]         = useState('all');

  const fetchTasks = useCallback(async () => {
    setError(null);
    try {
      const { data } = await axios.get('/api/tasks/mine');
      setTasks(data);
    } catch {
      setError('Could not load your tasks.');
      toast.error('Could not load your tasks.');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  const filtered = tasks.filter(t => {
    if (tab === 'all')       return true;
    if (tab === 'active')    return t.status === 'assigned' || t.status === 'in_progress';
    if (tab === 'completed') return t.status === 'completed';
    if (tab === 'overdue')   return t.status === 'overdue';
    return true;
  });

  const count = (key) => {
    if (key === 'all')       return tasks.length;
    if (key === 'active')    return tasks.filter(t => t.status === 'assigned' || t.status === 'in_progress').length;
    if (key === 'completed') return tasks.filter(t => t.status === 'completed').length;
    if (key === 'overdue')   return tasks.filter(t => t.status === 'overdue').length;
    return 0;
  };

  return (
    <div className="space-y-5 fade-in">
      <div>
        <h2 className="text-lg font-heading font-bold text-primary-900">My Tasks</h2>
        <p className="text-sm text-slate-500">{tasks.length} task{tasks.length !== 1 ? 's' : ''} assigned to you</p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 bg-white border border-primary-100 rounded-xl p-1 w-fit shadow-sm">
        {TABS.map(({ key, label }) => {
          const n = count(key);
          return (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-150 min-h-[36px]
                          ${tab === key ? 'bg-primary-600 text-white shadow-sm' : 'text-slate-500 hover:text-primary-700 hover:bg-primary-50'}`}
            >
              {label}
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full
                               ${tab === key ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'}`}>
                {n}
              </span>
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1,2,3].map(i => <TaskCardSkeleton key={i} />)}
        </div>
      ) : error ? (
        <Card>
          <EmptyState
            icon={AlertTriangle}
            title="Couldn't load your tasks"
            message={error}
            action={<Button variant="secondary" onClick={fetchTasks}>Try again</Button>}
          />
        </Card>
      ) : filtered.length === 0 ? (
        <Card>
          <EmptyState icon={CheckSquare} {...emptyMessages[tab]} />
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map(t => <TaskCard key={t.id} task={t} onRefresh={fetchTasks} />)}
        </div>
      )}
    </div>
  );
};

export default MyTasks;
