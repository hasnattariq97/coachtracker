import React, { useEffect } from 'react';
import { X, Pencil, Trash2, Calendar, User, Tag, Clock, MessageSquare } from 'lucide-react';
import Badge from './ui/Badge';
import Button from './ui/Button';

const Field = ({ icon: Icon, label, children }) => (
  <div className="flex items-start gap-3">
    <div className="w-7 h-7 rounded-lg bg-primary-50 flex items-center justify-center shrink-0 mt-0.5">
      <Icon size={13} className="text-primary-600" />
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-xs text-slate-400 font-medium mb-0.5">{label}</p>
      <div className="text-sm text-primary-900">{children}</div>
    </div>
  </div>
);

const TaskDetailSlideOver = ({ task, instances, onClose, onEdit, onDelete, onRefresh }) => {
  useEffect(() => {
    if (!task) return;
    const handleKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [task, onClose]);

  if (!task) return null;

  const daysLeft = Math.ceil((new Date(task.due_date) - new Date()) / 86400000);

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div
        className="fixed inset-0 flex items-center justify-center z-50 p-4"
        role="dialog"
        aria-modal="true"
        aria-label="Task details"
      >
        <div className="bg-white rounded-2xl shadow-2xl flex flex-col w-full max-w-2xl max-h-[90vh] animate-in fade-in zoom-in duration-300">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-2">
            <Badge value={task.status} />
            <Badge value={task.priority} />
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
          <div>
            <h2 className="text-lg font-heading font-bold text-primary-900 leading-snug mb-1">
              {task.title}
            </h2>
            {task.description && (
              <p className="text-sm text-slate-500 leading-relaxed">{task.description}</p>
            )}
          </div>

          <div className="space-y-4">
            <Field icon={User} label="Assigned to">
              {instances && instances.length > 1 ? (
                <div className="space-y-2">
                  <div className="text-xs text-slate-500 font-medium">{instances.length} coaches:</div>
                  <div className="space-y-1.5">
                    {instances.map(inst => (
                      <div key={inst.id} className="flex items-center justify-between text-sm">
                        <span>{inst.coach_name}</span>
                        <span className={`text-xs font-medium px-2 py-0.5 rounded ${
                          inst.status === 'completed' ? 'bg-green-100 text-green-700' :
                          inst.status === 'overdue' ? 'bg-red-100 text-red-700' :
                          'bg-slate-100 text-slate-700'
                        }`}>
                          {inst.status === 'completed' ? '✓ Completed' : inst.status === 'overdue' ? '! Overdue' : '○ Pending'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                task.coach_name || '—'
              )}
            </Field>
            <Field icon={Calendar} label="Due date">
              <span>{new Date(task.due_date).toLocaleDateString([], { weekday: 'short', month: 'long', day: 'numeric', year: 'numeric' })}</span>
              {' '}
              <span className={`text-xs font-medium ml-1 ${daysLeft < 0 ? 'text-red-600' : daysLeft === 0 ? 'text-amber-600' : 'text-slate-400'}`}>
                ({daysLeft < 0 ? `${Math.abs(daysLeft)}d overdue` : daysLeft === 0 ? 'today' : `${daysLeft}d left`})
              </span>
            </Field>
            <Field icon={Tag} label="Priority"><Badge value={task.priority} /></Field>
            <Field icon={Clock} label="Assigned">
              {new Date(task.assigned_at).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
            </Field>
            {task.completed_at && (
              <Field icon={Clock} label="Completed">
                {new Date(task.completed_at).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
              </Field>
            )}
          </div>

          {task.delay_reason && (
            <div className="bg-amber-50 border border-amber-100 rounded-xl p-4">
              <p className="text-xs font-semibold text-amber-700 mb-1.5 flex items-center gap-1.5">
                <MessageSquare size={12} /> Delay Reason
              </p>
              <p className="text-sm text-amber-800 leading-relaxed">{task.delay_reason}</p>
            </div>
          )}
        </div>

          {/* Actions */}
          <div className="shrink-0 px-5 py-4 border-t border-slate-100 flex gap-3">
            <Button variant="secondary" className="flex-1" icon={Pencil} onClick={() => onEdit(task)}>
              Edit
            </Button>
            <Button variant="danger" className="flex-1" icon={Trash2} onClick={() => onDelete(task.id)}>
              Delete
            </Button>
          </div>
        </div>
      </div>
    </>
  );
};

export default TaskDetailSlideOver;
