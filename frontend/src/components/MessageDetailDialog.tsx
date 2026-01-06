import { useState } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/cjs/styles/prism';
import type { PubSubMessage } from '../types';

interface MessageDetailDialogProps {
  message: PubSubMessage | null;
  open: boolean;
  onClose: () => void;
}

export default function MessageDetailDialog({ message, open, onClose }: MessageDetailDialogProps) {
  const [copied, setCopied] = useState<'payload' | 'id' | 'full' | null>(null);

  if (!open || !message) return null;

  const copyToClipboard = async (text: string, type: 'payload' | 'id' | 'full') => {
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

  // Ensure attributes is always an object
  const attributes = message.attributes || {};
  const attributeCount = Object.keys(attributes).length;

  // Create full message JSON for copying
  const fullMessageJSON = JSON.stringify({
    id: message.id,
    publishTime: message.publishTime,
    receiveTime: message.receiveTime,
    data: isJSON ? JSON.parse(message.data) : message.data,
    attributes: attributes,
    deliveryAttempt: message.deliveryAttempt,
    orderingKey: message.orderingKey,
  }, null, 2);

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-slate-800 border border-slate-700 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-700 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-slate-100">Message Details</h3>
            <div className="flex items-center gap-2 mt-1">
              <code className="text-xs text-slate-400 font-mono">{message.id}</code>
              <button
                onClick={() => copyToClipboard(message.id, 'id')}
                className="px-2 py-0.5 text-xs bg-slate-700 hover:bg-slate-600 rounded transition-colors"
                title="Copy message ID"
              >
                {copied === 'id' ? '✓' : 'Copy ID'}
              </button>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 transition-colors"
            title="Close"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto px-6 py-4">
          <div className="space-y-6">
            {/* Metadata Section */}
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <div className="text-slate-400 mb-1">Published Time</div>
                <div className="text-slate-200 font-mono">{formatTimestamp(message.publishTime)}</div>
              </div>
              <div>
                <div className="text-slate-400 mb-1">Received Time</div>
                <div className="text-slate-200 font-mono">{formatTimestamp(message.receiveTime)}</div>
              </div>
              {message.deliveryAttempt !== undefined && (
                <div>
                  <div className="text-slate-400 mb-1">Delivery Attempt</div>
                  <div className="text-yellow-400 font-semibold">{message.deliveryAttempt}</div>
                </div>
              )}
              {message.orderingKey && (
                <div>
                  <div className="text-slate-400 mb-1">Ordering Key</div>
                  <div className="text-slate-200 font-mono">{message.orderingKey}</div>
                </div>
              )}
            </div>

            {/* Attributes Section */}
            {attributeCount > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-slate-300 mb-3">
                  Attributes ({attributeCount})
                </h4>
                <div className="bg-slate-900 rounded border border-slate-700 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-700 bg-slate-800/50">
                        <th className="px-4 py-2 text-left text-slate-400 font-semibold">Key</th>
                        <th className="px-4 py-2 text-left text-slate-400 font-semibold">Value</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(attributes).map(([key, value]) => (
                        <tr key={key} className="border-b border-slate-800 last:border-0 hover:bg-slate-800/30">
                          <td className="px-4 py-2 font-mono text-slate-300 align-top">{key}</td>
                          <td className="px-4 py-2 font-mono text-slate-300 break-words">{value}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Payload Section */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-semibold text-slate-300">
                  Payload {isJSON && <span className="text-xs text-green-400 ml-2">(JSON)</span>}
                </h4>
                <button
                  onClick={() => copyToClipboard(message.data, 'payload')}
                  className="px-3 py-1.5 text-xs bg-slate-700 hover:bg-slate-600 rounded transition-colors"
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
                    showLineNumbers
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
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-700 flex items-center justify-between">
          <button
            onClick={() => copyToClipboard(fullMessageJSON, 'full')}
            className="px-4 py-2 text-sm bg-slate-700 hover:bg-slate-600 rounded transition-colors"
          >
            {copied === 'full' ? '✓ Copied Full Message' : 'Copy Full Message as JSON'}
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm bg-green-600 hover:bg-green-700 rounded transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
