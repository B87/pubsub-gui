import { useState, useEffect, useRef, useMemo } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { EventsOn } from '../../wailsjs/runtime/runtime';
import {
  StartMonitor,
  StopMonitor,
  GetBufferedMessages,
  ClearMessageBuffer,
  SetAutoAck,
  GetAutoAck,
} from '../../wailsjs/go/main/App';
import { useMessageSearch } from '../hooks/useMessageSearch';
import MessageCard from './MessageCard';
import type { PubSubMessage } from '../types';
import type { Subscription } from '../types';

interface SubscriptionMonitorProps {
  subscription: Subscription;
}

export default function SubscriptionMonitor({ subscription }: SubscriptionMonitorProps) {
  const [messages, setMessages] = useState<PubSubMessage[]>([]);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [autoAck, setAutoAck] = useState(true);
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
    estimateSize: () => 200, // Estimated height per message card
    overscan: 5,
  });

  // Load auto-ack setting on mount
  useEffect(() => {
    GetAutoAck()
      .then(setAutoAck)
      .catch((err: unknown) => console.error('Failed to get auto-ack setting:', err));
  }, []);

  // Set up Wails event listeners
  useEffect(() => {
    // Message received event
    const unsubscribeMessage = EventsOn('message:received', (message: PubSubMessage) => {
      setMessages((prev) => {
        // Add to beginning (newest first)
        const updated = [message, ...prev];
        // Enforce buffer limit (remove oldest if needed)
        // Buffer size is managed by backend, but we can add client-side limit as safety
        return updated.slice(0, 1000); // Safety limit
      });

      // Scroll to top when new message arrives (if not searching)
      if (!searchQuery && parentRef.current) {
        parentRef.current.scrollTop = 0;
      }
    });

    // Monitor started event
    const unsubscribeStarted = EventsOn('monitor:started', (data: { subscriptionID: string }) => {
      if (data.subscriptionID === subscription.name) {
        setIsMonitoring(true);
        setIsLoading(false);
        setError(null);
      }
    });

    // Monitor stopped event
    const unsubscribeStopped = EventsOn('monitor:stopped', (data: { subscriptionID: string }) => {
      if (data.subscriptionID === subscription.name) {
        setIsMonitoring(false);
        setIsLoading(false);
      }
    });

    // Monitor error event
    const unsubscribeError = EventsOn('monitor:error', (data: { subscriptionID: string; error: string }) => {
      if (data.subscriptionID === subscription.name) {
        setError(data.error);
        setIsLoading(false);
      }
    });

    return () => {
      unsubscribeMessage();
      unsubscribeStarted();
      unsubscribeStopped();
      unsubscribeError();
    };
  }, [subscription.name]);

  // Load buffered messages when monitoring starts
  useEffect(() => {
    if (isMonitoring) {
      // Load existing buffered messages
      GetBufferedMessages(subscription.name)
        .then((bufferedMessages: PubSubMessage[]) => {
          setMessages(bufferedMessages);
        })
        .catch((err: unknown) => {
          console.error('Failed to load buffered messages:', err);
        });
    }
  }, [isMonitoring, subscription.name]);

  const handleStartMonitoring = async () => {
    setIsLoading(true);
    setError(null);
    try {
      await StartMonitor(subscription.name);
      // Event listener will update isMonitoring state
    } catch (err) {
      setIsLoading(false);
      setError(err instanceof Error ? err.message : 'Failed to start monitoring');
    }
  };

  const handleStopMonitoring = async () => {
    setIsLoading(true);
    try {
      await StopMonitor(subscription.name);
      // Event listener will update isMonitoring state
    } catch (err) {
      setIsLoading(false);
      setError(err instanceof Error ? err.message : 'Failed to stop monitoring');
    }
  };

  const handleClearBuffer = async () => {
    try {
      await ClearMessageBuffer(subscription.name);
      setMessages([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to clear buffer');
    }
  };

  const handleToggleAutoAck = async (enabled: boolean) => {
    try {
      await SetAutoAck(enabled);
      setAutoAck(enabled);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update auto-ack setting');
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-6 border-b border-slate-700 bg-slate-800">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-100">{subscription.displayName}</h2>
            <p className="text-sm text-slate-400 mt-1">Subscription Monitor</p>
          </div>
          <div className="flex items-center gap-3">
            {/* Message Count */}
            <div className="text-sm text-slate-400">
              {messages.length} message{messages.length !== 1 ? 's' : ''}
            </div>

            {/* Auto-Ack Toggle */}
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={autoAck}
                onChange={(e) => handleToggleAutoAck(e.target.checked)}
                className="w-4 h-4 rounded bg-slate-700 border-slate-600 text-green-500 focus:ring-green-500"
              />
              <span className="text-sm text-slate-300">Auto-ack</span>
            </label>

            {/* Clear Buffer Button */}
            <button
              onClick={handleClearBuffer}
              disabled={messages.length === 0}
              className="px-4 py-2 text-sm bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed rounded transition-colors"
            >
              Clear Buffer
            </button>

            {/* Start/Stop Button */}
            {isMonitoring ? (
              <button
                onClick={handleStopMonitoring}
                disabled={isLoading}
                className="px-4 py-2 text-sm bg-red-600 hover:bg-red-700 disabled:opacity-50 rounded transition-colors"
              >
                {isLoading ? 'Stopping...' : 'Stop Monitoring'}
              </button>
            ) : (
              <button
                onClick={handleStartMonitoring}
                disabled={isLoading}
                className="px-4 py-2 text-sm bg-green-600 hover:bg-green-700 disabled:opacity-50 rounded transition-colors"
              >
                {isLoading ? 'Starting...' : 'Start Monitoring'}
              </button>
            )}
          </div>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="mt-4 p-3 bg-red-900/50 border border-red-700 rounded text-sm text-red-200">
            {error}
          </div>
        )}

        {/* Search Bar */}
        <div className="mt-4">
          <input
            type="text"
            placeholder="Search messages (payload, attributes)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-4 py-2 bg-slate-900 border border-slate-700 rounded text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>
      </div>

      {/* Message List */}
      <div ref={parentRef} className="flex-1 overflow-auto p-6">
        {isLoading && messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-slate-400">Connecting to subscription...</div>
          </div>
        ) : filteredMessages.length === 0 && searchQuery ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-slate-400">No messages match your search</div>
          </div>
        ) : filteredMessages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="text-slate-400 mb-2">No messages received yet</div>
              <div className="text-sm text-slate-500">
                {isMonitoring ? 'Waiting for messages...' : 'Start monitoring to receive messages'}
              </div>
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
              return (
                <div
                  key={message.id}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: `${virtualItem.size}px`,
                    transform: `translateY(${virtualItem.start}px)`,
                  }}
                >
                  <div className="mb-4">
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
