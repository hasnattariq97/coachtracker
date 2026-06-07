export default function CoachingInsightCard({ notification, onDismiss }) {
  const isOnTime = notification.type === 'coaching_insights' &&
                   !notification.message.toLowerCase().includes('delay');

  // Parse metadata to get actual coaching insights from agents
  let insights = null;
  if (notification.metadata) {
    try {
      insights = JSON.parse(notification.metadata);
    } catch (e) {
      // If metadata isn't valid JSON, fall back to message
      insights = null;
    }
  }

  return (
    <div className="bg-white border-l-4 border-teal-600 rounded shadow-sm overflow-hidden">
      <div className="p-4 space-y-3">
        {/* On-Time Completion with AI Coaching Insights */}
        {isOnTime && (
          <div className="space-y-3">
            <div className="flex items-start gap-2">
              <span className="text-xl">🎯</span>
              <div className="flex-1">
                <h4 className="font-semibold text-gray-900">Great execution! 💪</h4>
                {/* Display consensus message from agents */}
                <p className="text-gray-600 text-sm mt-2 leading-relaxed">
                  {insights?.consensus || notification.message || 'Excellent work on this task!'}
                </p>
              </div>
            </div>

            {/* Detailed agent insights if available */}
            {insights && (
              <div className="bg-teal-50 rounded p-3 space-y-2 text-xs">
                {insights.growth_agent?.summary && (
                  <div className="flex gap-2">
                    <span>📈</span>
                    <p className="text-gray-700">{insights.growth_agent.summary}</p>
                  </div>
                )}
                {insights.pattern_agent?.summary && (
                  <div className="flex gap-2">
                    <span>📊</span>
                    <p className="text-gray-700">{insights.pattern_agent.summary}</p>
                  </div>
                )}
                {insights.risk_agent?.summary && !insights.risk_agent.summary.toLowerCase().includes('no risk') && (
                  <div className="flex gap-2">
                    <span>⚠️</span>
                    <p className="text-gray-700">{insights.risk_agent.summary}</p>
                  </div>
                )}
              </div>
            )}
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
                  {insights?.consensus || 'No worries—it happens to everyone! Understanding what got in the way helps us all improve.'}
                </p>
              </div>
            </div>

            {/* Risk insights if available */}
            {insights?.risk_agent?.summary && (
              <div className="bg-amber-50 rounded p-3 text-xs">
                <p className="text-gray-700 flex gap-2">
                  <span>⚠️</span>
                  <span>{insights.risk_agent.summary}</span>
                </p>
              </div>
            )}

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
