import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { Users, ClipboardList, CheckCircle, AlertTriangle, PlusCircle } from 'lucide-react';
import KPICard from '../../components/ui/KPICard';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import ProgressBar from '../../components/ui/ProgressBar';
import EmptyState from '../../components/ui/EmptyState';
import Button from '../../components/ui/Button';
import { CardSkeleton, TableRowSkeleton } from '../../components/ui/Skeleton';

const AdminDashboard = () => {
  const [coaches, setCoaches]   = useState([]);
  const [tasks, setTasks]       = useState([]);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    Promise.all([
      axios.get('/api/coaches'),
      axios.get('/api/tasks'),
    ]).then(([c, t]) => {
      setCoaches(c.data);
      setTasks(t.data);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const totalCoaches  = coaches.length;
  const totalTasks    = tasks.length;
  const completed     = tasks.filter(t => t.status === 'completed').length;
  const overdue       = tasks.filter(t => t.status === 'overdue').length;
  const active        = tasks.filter(t => t.status === 'in_progress' || t.status === 'assigned').length;

  const recent = [...tasks]
    .sort((a, b) => new Date(b.assigned_at) - new Date(a.assigned_at))
    .slice(0, 6);

  return (
    <div className="space-y-8 fade-in">
      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => <CardSkeleton key={i} />)
        ) : (
          <>
            <KPICard label="Total Coaches"  value={totalCoaches} icon={Users}         color="teal"   />
            <KPICard label="Active Tasks"   value={active}       icon={ClipboardList} color="blue"   />
            <KPICard label="Completed"      value={completed}    icon={CheckCircle}   color="green"  />
            <KPICard label="Overdue"        value={overdue}      icon={AlertTriangle} color="red"    />
          </>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Coach progress */}
        <Card className="lg:col-span-2">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-sm font-heading font-semibold text-primary-900">Coach Progress</h2>
            <Link to="/admin/coaches">
              <Button variant="ghost" size="sm">View all</Button>
            </Link>
          </div>
          {loading ? (
            <div className="space-y-5">
              {[1,2,3].map(i => <div key={i} className="space-y-2"><div className="skeleton h-3 w-32" /><div className="skeleton h-2 w-full" /></div>)}
            </div>
          ) : coaches.length === 0 ? (
            <EmptyState icon={Users} title="No coaches yet" message="Add your first coach to get started." />
          ) : (
            <div className="space-y-5">
              {coaches.map(c => {
                const total = (c.assigned || 0) + (c.completed || 0) + (c.overdue || 0);
                return (
                  <div key={c.id}>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-primary-100 text-primary-700 text-xs font-bold flex items-center justify-center">
                          {c.name?.charAt(0).toUpperCase()}
                        </div>
                        <span className="text-sm font-medium text-primary-900">{c.name}</span>
                      </div>
                      <span className="text-xs text-slate-400">{c.completed || 0}/{total} done</span>
                    </div>
                    <ProgressBar value={c.completed || 0} max={total || 1} showPct={false} color={c.overdue > 0 ? 'red' : 'primary'} />
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {/* Quick actions */}
        <Card>
          <h2 className="text-sm font-heading font-semibold text-primary-900 mb-4">Quick Actions</h2>
          <div className="space-y-3">
            <Link to="/admin/assign" className="block">
              <Button variant="primary" className="w-full" icon={PlusCircle}>Assign New Task</Button>
            </Link>
            <Link to="/admin/coaches" className="block">
              <Button variant="secondary" className="w-full" icon={Users}>Manage Coaches</Button>
            </Link>
            <Link to="/admin/tasks" className="block">
              <Button variant="secondary" className="w-full" icon={ClipboardList}>View Task Board</Button>
            </Link>
          </div>

          <div className="mt-6 pt-5 border-t border-slate-100">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Summary</h3>
            <div className="space-y-2 text-sm">
              {[
                { label: 'Completion rate', value: totalTasks ? `${Math.round(completed / totalTasks * 100)}%` : '—' },
                { label: 'Overdue rate',    value: totalTasks ? `${Math.round(overdue / totalTasks * 100)}%`   : '—' },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between">
                  <span className="text-slate-500">{label}</span>
                  <span className="font-semibold text-primary-900">{value}</span>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>

      {/* Recent tasks */}
      <Card>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-sm font-heading font-semibold text-primary-900">Recent Tasks</h2>
          <Link to="/admin/tasks"><Button variant="ghost" size="sm">View all</Button></Link>
        </div>
        {loading ? (
          <table className="w-full"><tbody>{[1,2,3].map(i => <TableRowSkeleton key={i} cols={5} />)}</tbody></table>
        ) : recent.length === 0 ? (
          <EmptyState icon={ClipboardList} title="No tasks yet" message="Assign tasks to coaches to see them here." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  {['Task', 'Coach', 'Priority', 'Status', 'Due'].map(h => (
                    <th key={h} className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wide pb-3 px-2 first:pl-0">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {recent.map(t => (
                  <tr key={t.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                    <td className="py-3 px-2 pl-0 font-medium text-primary-900 max-w-[180px] truncate">{t.title}</td>
                    <td className="py-3 px-2 text-slate-600">{t.coach_name}</td>
                    <td className="py-3 px-2"><Badge value={t.priority} /></td>
                    <td className="py-3 px-2"><Badge value={t.status} /></td>
                    <td className="py-3 px-2 text-slate-500 whitespace-nowrap">
                      {new Date(t.due_date).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
};

export default AdminDashboard;
