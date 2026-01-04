import { useState, useEffect, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useMessageSearch } from '../hooks/useMessageSearch';
import MessageCard from './MessageCard';
import type { PubSubMessage, Topic, Subscription } from '../types';

interface TopicMonitorProps {
  topic: Topic;
  messages: PubSubMessage[];
  isMonitoring: boolean;
  tempSubId: string | null;
  autoAck: boolean;
  monitoringError?: string;
  subscriptions?: Subscription[];
  selectedSubscription: string | null;
  onSubscriptionChange: (subscriptionId: string | null) => void;
  onStartMonitoring: () => void;
  onClearBuffer: () => void;
  onToggleAutoAck: (enabled: boolean) => void;
}

export default function TopicMonitor({
  topic,
  messages,
  isMonitoring,
  tempSubId,
  autoAck,
  monitoringError,
  subscriptions = [],
  selectedSubscription,
  onSubscriptionChange,
  onStartMonitoring,
  onClearBuffer,
  onToggleAutoAck,
}: TopicMonitorProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');

  const parentRef = useRef<HTMLDivElement>(null);

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Filter messages using search hook
  const filteredMessages = useMessageSearch(messages, debouncedSearchQuery);

  // Virtual scrolling setup
  const virtualizer = useVirtualizer({
    count: filteredMessages.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 200,
    overscan: 5,
  });

  // Auto-scroll to top when new messages arrive (if not searching)
  useEffect(() => {
    if (!searchQuery && parentRef.current && messages.length > 0) {
      parentRef.current.scrollTop = 0;
    }
  }, [messages.length, searchQuery]);

  return (
    <div className="flex flex-col h-[calc(100vh-280px)] bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
      {/* Error Notification */}
      {monitoringError && (
        <div className="p-4 bg-red-900/20 border-b border-red-700/50">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-red-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="flex-1">
              <h4 className="text-sm font-semibold text-red-400 mb-1">Failed to Start Monitoring</h4>
              <p className="text-sm text-red-300">{monitoringError}</p>
            </div>
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div className="p-4 border-b border-slate-700 bg-slate-800/50">
        <div className="flex items-center justify-between gap-4 mb-3">
          <div className="flex-1 max-w-md">
            <input
              type="text"
              placeholder="Search messages..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex items-center gap-4">
            <div className="text-xs text-slate-400">
              {messages.length} messages
            </div>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={autoAck}
                onChange={(e) => onToggleAutoAck(e.target.checked)}
                className="w-3.5 h-3.5 rounded bg-slate-700 border-slate-600 text-blue-500 focus:ring-blue-500"
              />
              <span className="text-xs text-slate-300">Auto-ack</span>
            </label>

            <button
              onClick={onClearBuffer}
              disabled={messages.length === 0}
              className="px-3 py-1.5 text-xs bg-slate-700 hover:bg-slate-600 disabled:opacity-50 rounded transition-colors"
            >
              Clear
            </button>

            <div className="flex items-center gap-2">
              {isMonitoring ? (
                <span className="flex items-center gap-1.5 text-xs text-green-400 font-medium">
                  <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
                  Monitoring
                </span>
              ) : (
                <button
                  onClick={onStartMonitoring}
                  className="px-4 py-1.5 text-xs bg-blue-600 hover:bg-blue-700 rounded transition-colors font-medium"
                >
                  Start Monitoring
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Subscription Selector */}
        <div className="flex items-center gap-3">
          <label className="text-xs text-slate-400 whitespace-nowrap">Subscription:</label>
          <select
            value={selectedSubscription || ''}
            onChange={(e) => onSubscriptionChange(e.target.value || null)}
            disabled={isMonitoring}
            className="flex-1 max-w-xs px-3 py-1.5 bg-slate-900 border border-slate-700 rounded text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            title={isMonitoring ? 'Stop monitoring to change subscription' : 'Select a subscription to monitor or use auto-create'}
          >
            <option value="">Auto-create subscription</option>
            {subscriptions.map((sub) => (
              <option key={sub.name} value={sub.name}>
                {sub.displayName}
              </option>
            ))}
          </select>
          {isMonitoring && tempSubId && (
            <div className="text-xs text-slate-500 flex items-center gap-1">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>
                {tempSubId.startsWith('ps-gui-mon-')
                  ? 'Using temporary subscription'
                  : `Using: ${subscriptions.find(s => s.name.split('/').pop() === tempSubId)?.displayName || tempSubId}`}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Message List */}
      <div ref={parentRef} className="flex-1 overflow-auto p-4 bg-slate-900/30">
        {!isMonitoring ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="text-slate-500 mb-4">
              Click "Start Monitoring" to begin receiving messages
            </div>
          </div>
        ) : filteredMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="text-slate-500 mb-2">
              {searchQuery ? 'No messages match search' : 'Waiting for messages...'}
            </div>
          </div>
        ) : (
          <div
            style={{
              height: `${virtualizer.getTotalSize()}px`,
              width: '100%',
              position: 'relative',
            }}
          >
            {virtualizer.getVirtualItems().map((virtualItem) => {
              const message = filteredMessages[virtualItem.index];
              // Use combination of ID and receiveTime for unique key (handles redelivered messages)
              const uniqueKey = `${message.id}-${message.receiveTime}`;
              return (
                <div
                  key={uniqueKey}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: `${virtualItem.size}px`,
                    transform: `translateY(${virtualItem.start}px)`,
                  }}
                >
                  <div className="pb-3">
                    <MessageCard message={message} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
