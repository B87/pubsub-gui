import type { PubSubMessage } from '../types';

interface MessageRowProps {
  message: PubSubMessage;
  onClick: () => void;
}

export default function MessageRow({ message, onClick }: MessageRowProps) {
  // Format timestamp for display
  const formatTimestamp = (isoString: string) => {
    try {
      const date = new Date(isoString);
      const now = new Date();
      const diff = now.getTime() - date.getTime();
      const seconds = Math.floor(diff / 1000);
      const minutes = Math.floor(seconds / 60);
      const hours = Math.floor(minutes / 60);

      // Show relative time for recent messages
      if (seconds < 60) return `${seconds}s ago`;
      if (minutes < 60) return `${minutes}m ago`;
      if (hours < 24) return `${hours}h ago`;

      // Show time for older messages
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return isoString;
    }
  };

  // Truncate payload for preview
  const truncatePayload = (data: string, maxLength: number = 80) => {
    // Remove extra whitespace and newlines
    const cleaned = data.replace(/\s+/g, ' ').trim();
    if (cleaned.length <= maxLength) return cleaned;
    return cleaned.substring(0, maxLength) + '...';
  };

  // Check if payload is JSON
  const isJSON = (() => {
    try {
      const parsed = JSON.parse(message.data);
      return typeof parsed === 'object' && parsed !== null;
    } catch {
      return false;
    }
  })();

  // Ensure attributes is always an object
  const attributes = message.attributes || {};
  const attributeCount = Object.keys(attributes).length;

  // Truncate message ID for display
  const shortId = message.id.length > 12 ? `${message.id.substring(0, 12)}...` : message.id;

  return (
    <tr
      onClick={onClick}
      className="border-b border-slate-700 hover:bg-slate-700/30 cursor-pointer transition-colors group"
    >
      {/* Timestamp */}
      <td className="px-4 py-3 text-xs text-slate-400 whitespace-nowrap">
        {formatTimestamp(message.receiveTime)}
      </td>

      {/* Message ID */}
      <td className="px-4 py-3">
        <code className="text-xs text-slate-400 font-mono" title={message.id}>
          {shortId}
        </code>
      </td>

      {/* Payload Preview */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          {isJSON && (
            <span className="px-1.5 py-0.5 text-xs bg-green-900/30 text-green-400 rounded border border-green-700/50">
              JSON
            </span>
          )}
          <span className="text-sm text-slate-300 font-mono truncate">
            {truncatePayload(message.data)}
          </span>
        </div>
      </td>

      {/* Attributes */}
      <td className="px-4 py-3 text-sm text-slate-400 text-center">
        {attributeCount > 0 ? (
          <span className="px-2 py-0.5 bg-slate-700 rounded text-xs">
            {attributeCount}
          </span>
        ) : (
          <span className="text-slate-600">—</span>
        )}
      </td>

      {/* Delivery Attempt */}
      <td className="px-4 py-3 text-sm text-center">
        {message.deliveryAttempt !== undefined ? (
          <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
            message.deliveryAttempt > 1
              ? 'bg-yellow-900/30 text-yellow-400 border border-yellow-700/50'
              : 'text-slate-500'
          }`}>
            {message.deliveryAttempt}
          </span>
        ) : (
          <span className="text-slate-600">—</span>
        )}
      </td>

      {/* Action Icon */}
      <td className="px-4 py-3 text-right">
        <svg
          className="w-4 h-4 text-slate-500 group-hover:text-slate-300 transition-colors inline-block"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </td>
    </tr>
  );
}
