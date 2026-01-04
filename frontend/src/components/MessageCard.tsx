import { useState } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/cjs/styles/prism';
import type { PubSubMessage } from '../types';

interface MessageCardProps {
  message: PubSubMessage;
}

export default function MessageCard({ message }: MessageCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [copied, setCopied] = useState<'payload' | 'id' | null>(null);

  const copyToClipboard = async (text: string, type: 'payload' | 'id') => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(type);
      setTimeout(() => setCopied(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
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

  // Format timestamp for display
  const formatTimestamp = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleString();
    } catch {
      return isoString;
    }
  };

  // Truncate payload for preview
  const payloadPreview = message.data.length > 100
    ? message.data.substring(0, 100) + '...'
    : message.data;

  // Ensure attributes is always an object (defensive check)
  const attributes = message.attributes || {};
  const attributeCount = Object.keys(attributes).length;

  return (
    <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden transition-all duration-200 hover:border-slate-600">
      {/* Header */}
      <div
        className="px-4 py-3 border-b border-slate-700 cursor-pointer hover:bg-slate-750 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            {/* Message ID */}
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <code className="text-xs text-slate-400 font-mono truncate">
                {message.id}
              </code>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  copyToClipboard(message.id, 'id');
                }}
                className="px-2 py-1 text-xs bg-slate-700 hover:bg-slate-600 rounded transition-colors flex-shrink-0"
                title="Copy message ID"
              >
                {copied === 'id' ? '✓' : 'Copy'}
              </button>
            </div>

            {/* Timestamp */}
            <div className="text-xs text-slate-400 flex-shrink-0">
              {formatTimestamp(message.receiveTime)}
            </div>

            {/* Delivery Attempt */}
            {message.deliveryAttempt !== undefined && (
              <div className="text-xs text-yellow-400 flex-shrink-0">
                Attempt: {message.deliveryAttempt}
              </div>
            )}
          </div>

          {/* Expand/Collapse Button */}
          <button
            className="ml-2 text-slate-400 hover:text-slate-200 transition-colors flex-shrink-0"
            onClick={(e) => {
              e.stopPropagation();
              setIsExpanded(!isExpanded);
            }}
          >
            {isExpanded ? (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Collapsed View */}
      {!isExpanded && (
        <div className="px-4 py-3">
          <div className="text-sm text-slate-300 font-mono whitespace-pre-wrap break-words">
            {payloadPreview}
          </div>
          {attributeCount > 0 && (
            <div className="mt-2 text-xs text-slate-400">
              {attributeCount} attribute{attributeCount !== 1 ? 's' : ''}
            </div>
          )}
        </div>
      )}

      {/* Expanded View */}
      {isExpanded && (
        <div className="px-4 py-3 space-y-4">
          {/* Payload Section */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-semibold text-slate-300">Payload</h4>
              <button
                onClick={() => copyToClipboard(message.data, 'payload')}
                className="px-2 py-1 text-xs bg-slate-700 hover:bg-slate-600 rounded transition-colors"
              >
                {copied === 'payload' ? '✓ Copied' : 'Copy Payload'}
              </button>
            </div>
            <div className="bg-slate-900 rounded border border-slate-700 overflow-hidden">
              {isJSON ? (
                <SyntaxHighlighter
                  language="json"
                  style={vscDarkPlus}
                  customStyle={{
                    margin: 0,
                    padding: '1rem',
                    background: 'transparent',
                    fontSize: '0.875rem',
                  }}
                >
                  {JSON.stringify(JSON.parse(message.data), null, 2)}
                </SyntaxHighlighter>
              ) : (
                <pre className="p-4 text-sm text-slate-300 whitespace-pre-wrap break-words font-mono">
                  {message.data}
                </pre>
              )}
            </div>
          </div>

          {/* Attributes Section */}
          {attributeCount > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-slate-300 mb-2">
                Attributes ({attributeCount})
              </h4>
              <div className="bg-slate-900 rounded border border-slate-700 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-700">
                      <th className="px-4 py-2 text-left text-slate-400 font-semibold">Key</th>
                      <th className="px-4 py-2 text-left text-slate-400 font-semibold">Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(attributes).map(([key, value]) => (
                      <tr key={key} className="border-b border-slate-800 last:border-0">
                        <td className="px-4 py-2 font-mono text-slate-300">{key}</td>
                        <td className="px-4 py-2 font-mono text-slate-300 break-words">{value}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Metadata */}
          <div className="text-xs text-slate-400 space-y-1">
            <div>Published: {formatTimestamp(message.publishTime)}</div>
            {message.orderingKey && (
              <div>Ordering Key: <code className="text-slate-300">{message.orderingKey}</code></div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
