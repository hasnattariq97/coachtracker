import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import { CheckSquare, Clock, AlertTriangle, ClipboardList, ArrowRight } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import KPICard from '../../components/ui/KPICard';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import EmptyState from '../../components/ui/EmptyState';
import { CardSkeleton, TaskCardSkeleton } from '../../components/ui/Skeleton';
import TaskCard from '../../components/TaskCard';

const greeting = (name) => {
  const h = new Date().getHours();
  const time = h < 12 ? 'morning' : h < 17 ? 'afternoon' : 'evening';
  return `Good ${time}, ${name?.split(' ')[0] || 'Coach'}!`;
};

const CoachDashboard = () => {
  const { user }              = useAuth();
  const [tasks, setTasks]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  useEffect(() => {
    axios.get('/api/tasks/mine')
      .then(r => setTasks(r.data))
      .catch(() => {
        setError('Could not load your tasks.');
        toast.error('Could not load your tasks.');
      })
      .finally(() => setLoading(false));
  }, []);

  const total     = tasks.length;
  const active    = tasks.filter(t => t.status === 'assigned' || t.status === 'in_progress').length;
  const completed = tasks.filter(t => t.status === 'completed').length;
  const overdue   = tasks.filter(t => t.status === 'overdue').length;

  const upcoming = tasks
    .filter(t => t.status !== 'completed')
    .sort((a, b) => new Date(a.due_date) - new Date(b.due_date))
    .slice(0, 3);

  return (
    <div className="space-y-8 fade-in">
      {/* Welcome banner */}
      <div className="bg-gradient-to-r from-primary-700 to-primary-600 rounded-2xl p-6 text-white">
        <p className="text-primary-200 text-sm font-medium mb-1">
          {new Date().toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}
        </p>
        <h2 className="text-2xl font-heading font-bold mb-1">{greeting(user?.name)}</h2>
        <p className="text-primary-100 text-sm">
          {loading
            ? 'Loading your tasks…'
            : overdue > 0
              ? `You have ${overdue} overdue task${overdue > 1 ? 's' : ''} — let's address them today.`
              : active > 0
                ? `You have ${active} active task${active > 1 ? 's' : ''} in progress. Keep the momentum!`
                : 'You\'re all caught up! Great work. 🎉'}
        </p>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => <CardSkeleton key={i} />)
        ) : (
          <>
            <KPICard label="Total Tasks"  value={total}     icon={ClipboardList} color="teal"   />
            <KPICard label="Active"       value={active}    icon={Clock}         color="blue"   />
            <KPICard label="Completed"    value={completed} icon={CheckSquare}   color="green"  />
            <KPICard label="Overdue"      value={overdue}   icon={AlertTriangle} color="red"    />
          </>
        )}
      </div>

      {/* Upcoming tasks */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-heading font-semibold text-primary-900">Upcoming Tasks</h3>
          <Link to="/coach/tasks">
            <Button variant="ghost" size="sm" className="gap-1">
              View all <ArrowRight size={13} />
            </Button>
          </Link>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1,2].map(i => <TaskCardSkeleton key={i} />)}
          </div>
        ) : error ? (
          <Card>
            <EmptyState
              icon={AlertTriangle}
              title="Couldn't load your tasks"
              message={error}
              action={<Button variant="secondary" onClick={() => window.location.reload()}>Try again</Button>}
            />
          </Card>
        ) : upcoming.length === 0 ? (
          <Card>
            <EmptyState
              icon={CheckSquare}
              title="No pending tasks"
              message="You're all clear! Check back later or ask your admin for new challenges."
            />
          </Card>
        ) : (
          <div className="space-y-3">
            {upcoming.map(t => <TaskCard key={t.id} task={t} onRefresh={() => axios.get('/api/tasks/mine').then(r => setTasks(r.data))} />)}
          </div>
        )}
      </div>
    </div>
  );
};

export default CoachDashboard;
