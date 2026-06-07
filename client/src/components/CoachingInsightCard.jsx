import { useState } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';

export default function CoachingInsightCard({ notification, onDismiss }) {
  const [submittingReason, setSubmittingReason] = useState(false);
  const [delayReason, setDelayReason] = useState('');

  const isOnTime = notification.type === 'coaching_insights' &&
                   !notification.message.toLowerCase().includes('delay') &&
                   !notification.message.toLowerCase().includes('didn\'t hit');

  const handleSubmitReason = async () => {
    if (!delayReason.trim()) {
      toast.error('Please share what got in the way');
      return;
    }

    setSubmittingReason(true);
    try {
      await axios.put(`/api/tasks/${notification.task_id}/delay-reason`, {
        delay_reason: delayReason,
      });
      toast.success('Thank you for sharing. We\'ll help you move forward.');
      setDelayReason('');
      onDismiss();
    } catch (error) {
      toast.error('Could not save delay reason');
    } finally {
      setSubmittingReason(false);
    }
  };

  return (
    <div className="bg-white border-l-4 border-teal-600 rounded shadow-sm overflow-hidden">
      <div className="p-4 space-y-3">
        {/* ON-TIME: Single motivational paragraph */}
        {isOnTime && (
          <div className="space-y-2">
            <div className="flex items-start gap-2">
              <span className="text-2xl">🎯</span>
              <div className="flex-1">
                <p className="text-gray-700 text-sm leading-relaxed font-medium">
                  {notification.message || 'You did it! Great work on this task.'}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* LATE/DELAY: Coaching message + dialogue box for reason */}
        {!isOnTime && (
          <div className="space-y-3">
            <div className="flex items-start gap-2">
              <span className="text-2xl">💬</span>
              <div className="flex-1">
                <p className="text-gray-700 text-sm leading-relaxed font-medium">
                  {notification.message || 'This took longer than expected. Let\'s understand what happened.'}
                </p>
              </div>
            </div>

            {/* Dialogue Box: Why was it late? */}
            <div className="bg-amber-50 border border-amber-200 rounded p-3 space-y-2">
              <label className="text-sm font-semibold text-gray-800">
                Help us understand: What got in the way?
              </label>
              <textarea
                value={delayReason}
                onChange={(e) => setDelayReason(e.target.value)}
                placeholder="Be honest. Was it scope creep? Dependencies? Other priorities? We're here to help remove blockers."
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none"
                rows="3"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleSubmitReason}
                  disabled={submittingReason || !delayReason.trim()}
                  className="flex-1 px-3 py-1.5 text-xs font-medium bg-amber-600 text-white rounded hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {submittingReason ? 'Saving...' : 'Share'}
                </button>
                <button
                  onClick={onDismiss}
                  className="px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 rounded transition-colors"
                >
                  Skip
                </button>
              </div>
              <p className="text-xs text-gray-600">
                Your honest feedback helps us support you better. 🤝
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      {isOnTime && (
        <div className="border-t border-gray-100 px-4 py-2 bg-gray-50">
          <button
            onClick={onDismiss}
            className="text-teal-600 text-xs hover:text-teal-700 font-medium"
          >
            Got it
          </button>
        </div>
      )}
    </div>
  );
}
