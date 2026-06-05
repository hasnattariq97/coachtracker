import { useState } from 'react';
import { ChevronDown, ChevronUp, AlertCircle, Lightbulb } from 'lucide-react';

export default function CoachingInsightCard({ notification, onDismiss }) {
  const [expanded, setExpanded] = useState(false);
  const metadata = notification.metadata ? JSON.parse(notification.metadata) : null;

  if (!metadata) {
    return (
      <div className="bg-white border-l-4 border-teal-600 p-4 rounded shadow-sm">
        <p className="text-gray-600 text-sm">{notification.message}</p>
        <button
          onClick={onDismiss}
          className="text-teal-600 text-xs mt-2 hover:underline"
        >
          Dismiss
        </button>
      </div>
    );
  }

  const { pattern_agent, growth_agent, risk_agent, consensus } = metadata;

  return (
    <div className="bg-gradient-to-br from-teal-50 to-white border-l-4 border-teal-600 p-4 rounded shadow-sm space-y-3">
      {/* Consensus Summary */}
      <div>
        <p className="font-semibold text-gray-800 text-sm">{consensus || notification.message}</p>
      </div>

      {/* Growth Opportunity (always highlighted) */}
      {growth_agent && (
        <div className="bg-orange-50 border-l-2 border-orange-500 pl-3 py-2 rounded">
          <div className="flex items-start gap-2">
            <Lightbulb className="w-4 h-4 text-orange-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-xs font-semibold text-orange-900">Growth Opportunity</p>
              <p className="text-xs text-orange-800 mt-1">{growth_agent.summary}</p>
            </div>
          </div>
        </div>
      )}

      {/* Risk Alert (if present) */}
      {risk_agent && !risk_agent.summary.includes('no risks') && (
        <div className="bg-red-50 border-l-2 border-red-500 pl-3 py-2 rounded">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-xs font-semibold text-red-900">Risk Alert</p>
              <p className="text-xs text-red-800 mt-1">{risk_agent.summary}</p>
            </div>
          </div>
        </div>
      )}

      {/* Expandable Details */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 text-xs text-teal-600 hover:text-teal-700 pt-2"
      >
        {expanded ? (
          <>
            <ChevronUp className="w-3 h-3" />
            Hide Details
          </>
        ) : (
          <>
            <ChevronDown className="w-3 h-3" />
            Show Details
          </>
        )}
      </button>

      {expanded && (
        <div className="bg-gray-50 p-3 rounded text-xs space-y-2 border border-gray-200">
          {pattern_agent && (
            <div>
              <p className="font-semibold text-gray-700">Pattern Analysis</p>
              <p className="text-gray-600 mt-1">{pattern_agent.summary}</p>
              <p className="text-gray-500 text-xs mt-1">
                Confidence: {Math.round(pattern_agent.confidence * 100)}%
              </p>
            </div>
          )}
          {risk_agent && (
            <div className="pt-2 border-t border-gray-300">
              <p className="font-semibold text-gray-700">Risk Analysis</p>
              <p className="text-gray-600 mt-1">{risk_agent.summary}</p>
              <p className="text-gray-500 text-xs mt-1">
                Confidence: {Math.round(risk_agent.confidence * 100)}%
              </p>
            </div>
          )}
        </div>
      )}

      {/* Dismiss Button */}
      <button
        onClick={onDismiss}
        className="text-teal-600 text-xs hover:underline block mt-2"
      >
        Dismiss
      </button>
    </div>
  );
}
