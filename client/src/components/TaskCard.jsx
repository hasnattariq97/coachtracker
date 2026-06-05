import React, { useState } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { CheckCircle2, Clock, AlertTriangle, MessageSquare, Link as LinkIcon, ExternalLink } from 'lucide-react';
import Badge from './ui/Badge';
import Button from './ui/Button';
import DelayReasonModal from './DelayReasonModal';

const priorityBorder = { high: 'border-l-red-500', medium: 'border-l-amber-400', low: 'border-l-emerald-500' };

const daysLeft = (due) => {
  const diff = Math.ceil((new Date(due) - new Date()) / 86400000);
  if (diff < 0) return { text: `${Math.abs(diff)}d overdue`, color: 'text-red-600' };
  if (diff === 0) return { text: 'Due today', color: 'text-amber-600' };
  if (diff <= 2) return { text: `${diff}d left`, color: 'text-amber-500' };
  return { text: `${diff}d left`, color: 'text-slate-500' };
};

const TaskCard = ({ task, onRefresh }) => {
  const [completing, setCompleting] = useState(false);
  const [celebrated, setCelebrated] = useState(false);
  const [showDelay, setShowDelay]   = useState(false);

  const due = daysLeft(task.due_date);

  const handleComplete = async () => {
    setCompleting(true);
    try {
      await axios.put(`/api/tasks/${task.id}/complete`);
      setCelebrated(true);
      toast.success("Task complete! Awesome work! 🎉");
      setTimeout(() => { onRefresh?.(); }, 600);
    } catch (e) {
      toast.error(e.response?.data?.error || 'Failed to complete task');
    } finally {
      setCompleting(false);
    }
  };

  const isCompleted = task.status === 'completed';
  const isOverdue   = task.status === 'overdue';
  const canComplete = !isCompleted;
  const canDelay    = isOverdue && !task.delay_reason;

  return (
    <>
      <div className={`
        bg-white rounded-xl border-l-4 shadow-sm border border-slate-100
        hover:shadow-md hover:-translate-y-0.5 transition-all duration-200
        ${priorityBorder[task.priority] || 'border-l-slate-300'}
        ${isOverdue && !isCompleted ? 'bg-red-50/30' : ''}
        ${celebrated ? 'celebrate' : ''}
        fade-in
      `}>
        <div className="p-5">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <Badge value={task.status} />
                <Badge value={task.priority} />
              </div>
              <h3 className={`font-heading font-semibold text-primary-900 leading-tight
                              ${isCompleted ? 'line-through text-slate-400' : ''}`}>
                {task.title}
              </h3>
            </div>
            {isCompleted && (
              <CheckCircle2 size={20} className="text-emerald-500 shrink-0 mt-0.5" />
            )}
            {isOverdue && !isCompleted && (
              <AlertTriangle size={18} className="text-red-500 shrink-0 mt-0.5" />
            )}
          </div>

          {task.description && (
            <p className="text-sm text-slate-500 mb-3 line-clamp-2">{task.description}</p>
          )}

          {isOverdue && !isCompleted && !task.delay_reason && (
            <div className="bg-red-50 border border-red-100 rounded-lg px-3 py-2 mb-3 text-xs text-red-700">
              This one slipped by — and that's okay. Share what got in the way so you can move forward together.
            </div>
          )}

          {task.delay_reason && (
            <div className="bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 mb-3">
              <p className="text-xs font-medium text-amber-700 mb-0.5 flex items-center gap-1">
                <MessageSquare size={11} /> Delay reason submitted
              </p>
              <p className="text-xs text-amber-600">{task.delay_reason}</p>
            </div>
          )}

          {task.links && task.links.length > 0 && (
            <div className="mb-3 space-y-2">
              <p className="text-xs font-semibold text-slate-600 flex items-center gap-1">
                <LinkIcon size={12} /> 📎 Resources
              </p>
              <div className="space-y-1.5">
                {task.links.map((link, idx) => (
                  <a
                    key={idx}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between p-2 bg-primary-50 hover:bg-primary-100 border border-primary-200 rounded-lg transition-colors group text-xs"
                  >
                    <div className="flex items-center gap-1.5 min-w-0 flex-1">
                      <LinkIcon size={12} className="text-primary-600 flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="font-medium text-primary-900 truncate">{link.label}</p>
                      </div>
                    </div>
                    <ExternalLink size={12} className="text-primary-400 group-hover:text-primary-600 flex-shrink-0 ml-1" />
                  </a>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center justify-between pt-3 border-t border-slate-100">
            <div className="flex items-center gap-1 text-xs">
              <Clock size={12} className="text-slate-400" />
              <span className={due.color}>{due.text}</span>
              <span className="text-slate-300 mx-1">·</span>
              <span className="text-slate-400">
                {new Date(task.due_date).toLocaleDateString([], { month: 'short', day: 'numeric' })}
              </span>
            </div>

            <div className="flex gap-2">
              {canDelay && (
                <Button size="sm" variant="ghost" onClick={() => setShowDelay(true)}
                  className="text-amber-600 hover:text-amber-700 hover:bg-amber-50">
                  Add reason
                </Button>
              )}
              {canComplete && (
                <Button size="sm" variant="primary" loading={completing} onClick={handleComplete}>
                  Complete
                </Button>
              )}
              {isCompleted && task.completed_at && (
                <span className="text-xs text-emerald-600 font-medium flex items-center gap-1">
                  <CheckCircle2 size={12} />
                  {new Date(task.completed_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      <DelayReasonModal
        open={showDelay}
        taskId={task.id}
        taskTitle={task.title}
        onClose={() => setShowDelay(false)}
        onSaved={() => { setShowDelay(false); onRefresh?.(); }}
      />
    </>
  );
};

export default TaskCard;
