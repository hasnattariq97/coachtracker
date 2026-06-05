import { useState } from 'react';
import { ChevronDown, ChevronUp, TrendingUp, AlertTriangle } from 'lucide-react';

export default function CoachingInsightCard({ notification, onDismiss }) {
  const [expanded, setExpanded] = useState(false);
  const metadata = notification.metadata ? JSON.parse(notification.metadata) : null;

  if (!metadata) {
    return (
      <div className="bg-white border-l-4 border-teal-600 p-3 rounded shadow-sm">
        <p className="text-gray-700 text-sm font-medium">{notification.message}</p>
        <button
          onClick={onDismiss}
          className="text-teal-600 text-xs mt-2 hover:text-teal-700 font-medium"
        >
          Dismiss
        </button>
      </div>
    );
  }

  const { pattern_agent, growth_agent, risk_agent } = metadata;
  const hasRisks = risk_agent && !risk_agent.summary.toLowerCase().includes('no risks');

  return (
    <div className="bg-white border-l-4 border-teal-600 rounded shadow-sm overflow-hidden">
      {/* Main Insight - Simplified */}
      <div className="p-4 space-y-3">
        {/* Title with emoji */}
        <div className="flex items-start gap-2">
          <span className="text-lg">💪</span>
          <div className="flex-1">
            <h4 className="font-semibold text-gray-900 text-sm">Great work!</h4>
            <p className="text-gray-700 text-sm mt-1 leading-relaxed">
              {growth_agent?.summary || notification.message}
            </p>
          </div>
        </div>

        {/* Quick Stats */}
        {pattern_agent && (
          <div className="flex items-center gap-2 bg-teal-50 px-3 py-2 rounded">
            <TrendingUp className="w-4 h-4 text-teal-600 flex-shrink-0" />
            <p className="text-xs text-teal-900">{pattern_agent.summary}</p>
          </div>
        )}

        {/* Risk Alert (minimal) */}
        {hasRisks && (
          <div className="flex items-center gap-2 bg-amber-50 px-3 py-2 rounded">
            <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
            <p className="text-xs text-amber-900">{risk_agent.summary}</p>
          </div>
        )}

        {/* Expandable Details */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-2 text-xs text-teal-600 hover:text-teal-700 font-medium pt-1"
        >
          {expanded ? (
            <>
              <ChevronUp className="w-3 h-3" />
              Hide analysis
            </>
          ) : (
            <>
              <ChevronDown className="w-3 h-3" />
              View full analysis
            </>
          )}
        </button>

        {expanded && (
          <div className="bg-gray-50 p-3 rounded border border-gray-200 space-y-2 text-xs">
            {pattern_agent && (
              <div>
                <p className="font-medium text-gray-700">Your Pattern</p>
                <p className="text-gray-600 mt-1">{pattern_agent.summary}</p>
              </div>
            )}
            {growth_agent && (
              <div className="pt-2 border-t border-gray-200">
                <p className="font-medium text-gray-700">Next Step</p>
                <p className="text-gray-600 mt-1">{growth_agent.summary}</p>
              </div>
            )}
            {hasRisks && (
              <div className="pt-2 border-t border-gray-200">
                <p className="font-medium text-gray-700">Watch Out For</p>
                <p className="text-gray-600 mt-1">{risk_agent.summary}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-gray-100 px-4 py-2 bg-gray-50">
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
