export default function CoachingInsightCard({ notification, onDismiss }) {
  const isOnTime = notification.type === 'coaching_insights' &&
                   !notification.message.toLowerCase().includes('delay');

  return (
    <div className="bg-white border-l-4 border-teal-600 rounded shadow-sm overflow-hidden">
      <div className="p-4 space-y-3">
        {/* On-Time Completion Message */}
        {isOnTime && (
          <div className="space-y-2">
            <div className="flex items-start gap-2">
              <span className="text-xl">🎯</span>
              <div className="flex-1">
                <h4 className="font-semibold text-gray-900">Excellent! Task completed on time!</h4>
                <p className="text-gray-600 text-sm mt-2 leading-relaxed">
                  You delivered exactly when promised. This kind of reliability builds trust and shows real professionalism.
                  Keep bringing this energy to your next tasks! 💪
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Delayed Task Message */}
        {!isOnTime && (
          <div className="space-y-3">
            <div className="flex items-start gap-2">
              <span className="text-xl">💭</span>
              <div className="flex-1">
                <h4 className="font-semibold text-gray-900">Task took longer than planned</h4>
                <p className="text-gray-600 text-sm mt-2">
                  No worries—it happens to everyone! Understanding what got in the way helps us all improve.
                </p>
              </div>
            </div>

            {/* Reason Input Section */}
            <div className="bg-teal-50 p-3 rounded border border-teal-200 space-y-2">
              <label className="text-sm font-medium text-gray-700">
                What got in the way?
              </label>
              <textarea
                placeholder="Share what slowed you down (e.g., waiting for approval, unexpected complexity, other priorities)"
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-teal-500"
                rows="3"
              />
              <p className="text-xs text-gray-600">
                Your honest feedback helps us support you better next time. 🤝
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-gray-100 px-4 py-2 bg-gray-50 flex gap-2">
        <button
          onClick={onDismiss}
          className="text-teal-600 text-xs hover:text-teal-700 font-medium"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
