import { useState, useEffect, useRef } from 'react';
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
import MessageRow from './MessageRow';
import MessageDetailDialog from './MessageDetailDialog';
import SeekDialog from './SeekDialog';
import type { PubSubMessage } from '../types';
import type { Subscription } from '../types';
import { useKeyboardShortcuts, isInputFocused, formatShortcut } from '../hooks/useKeyboardShortcuts';
import { Alert, AlertDescription } from './ui';

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
  const [selectedMessage, setSelectedMessage] = useState<PubSubMessage | null>(null);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  const [isSeekDialogOpen, setIsSeekDialogOpen] = useState(false);

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
    estimateSize: () => 48, // Estimated height per table row
    overscan: 10,
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

  const handleOpenMessageDetail = (message: PubSubMessage) => {
    setSelectedMessage(message);
    setIsDetailDialogOpen(true);
  };

  const handleCloseMessageDetail = () => {
    setIsDetailDialogOpen(false);
    // Clear selected message after dialog animation
    setTimeout(() => setSelectedMessage(null), 200);
  };

  // Keyboard shortcut for start/stop monitoring (Cmd/Ctrl+M)
  useKeyboardShortcuts([
    {
      key: 'm',
      ctrlOrCmd: true,
      action: () => {
        // Only trigger if not typing in an input
        if (!isInputFocused() && !isLoading) {
          if (isMonitoring) {
            handleStopMonitoring();
          } else {
            handleStartMonitoring();
          }
        }
      },
      enabled: !isLoading,
      description: 'Start/stop monitoring',
    },
  ]);

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

            {/* Seek Button */}
            <button
              onClick={() => setIsSeekDialogOpen(true)}
              className="px-4 py-2 text-sm bg-slate-700 hover:bg-slate-600 rounded transition-colors flex items-center gap-2"
              title="Seek subscription to replay messages from a specific time"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Seek
            </button>

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
                title={`Stop monitoring (${formatShortcut({ key: 'm', ctrlOrCmd: true })})`}
              >
                {isLoading ? 'Stopping...' : 'Stop Monitoring'}
              </button>
            ) : (
              <button
                onClick={handleStartMonitoring}
                disabled={isLoading}
                className="px-4 py-2 text-sm bg-green-600 hover:bg-green-700 disabled:opacity-50 rounded transition-colors"
                title={`Start monitoring (${formatShortcut({ key: 'm', ctrlOrCmd: true })})`}
              >
                {isLoading ? 'Starting...' : 'Start Monitoring'}
              </button>
            )}
          </div>
        </div>

        {/* Error Banner */}
        {error && (
          <Alert variant="destructive" className="mt-4">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Search Bar */}
        <div className="mt-4 flex items-center gap-3">
          <div className="flex-1 relative">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search messages (payload, attributes, ID)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-900 border border-slate-700 rounded text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-green-500"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
          {searchQuery && (
            <div className="text-sm text-slate-400">
              {filteredMessages.length} of {messages.length} messages
            </div>
          )}
        </div>
      </div>

      {/* Message Table */}
      <div ref={parentRef} className="flex-1 overflow-auto">
        {isLoading && messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-slate-400">Connecting to subscription...</div>
          </div>
        ) : filteredMessages.length === 0 && searchQuery ? (
          <div className="flex flex-col items-center justify-center h-full">
            <svg className="w-16 h-16 text-slate-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <div className="text-slate-400 mb-1">No messages match your search</div>
            <button
              onClick={() => setSearchQuery('')}
              className="text-sm text-green-400 hover:text-green-300"
            >
              Clear search
            </button>
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
          <table className="w-full">
            <thead className="bg-slate-800 sticky top-0 z-10 border-b-2 border-slate-700">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  Time
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  Message ID
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  Payload Preview
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  Attributes
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  Attempt
                </th>
                <th className="px-4 py-3 w-12"></th>
              </tr>
            </thead>
            <tbody className="bg-slate-800/50">
              {/* Virtual spacer before visible items */}
              {virtualizer.getVirtualItems().length > 0 && virtualizer.getVirtualItems()[0].start > 0 && (
                <tr>
                  <td colSpan={6} style={{ height: `${virtualizer.getVirtualItems()[0].start}px` }}></td>
                </tr>
              )}

              {/* Visible items */}
              {virtualizer.getVirtualItems().map((virtualItem) => {
                const message = filteredMessages[virtualItem.index];
                return (
                  <MessageRow
                    key={message.id}
                    message={message}
                    onClick={() => handleOpenMessageDetail(message)}
                  />
                );
              })}

              {/* Virtual spacer after visible items */}
              {virtualizer.getVirtualItems().length > 0 && (
                <tr>
                  <td
                    colSpan={6}
                    style={{
                      height: `${
                        virtualizer.getTotalSize() -
                        (virtualizer.getVirtualItems()[virtualizer.getVirtualItems().length - 1]?.end || 0)
                      }px`
                    }}
                  ></td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Message Detail Dialog */}
      <MessageDetailDialog
        message={selectedMessage}
        open={isDetailDialogOpen}
        onClose={handleCloseMessageDetail}
      />

      {/* Seek Dialog */}
      <SeekDialog
        open={isSeekDialogOpen}
        subscriptionName={subscription.name}
        subscriptionDisplayName={subscription.displayName}
        onClose={() => setIsSeekDialogOpen(false)}
        onSeekComplete={() => {
          // Optionally clear messages after seek to show fresh data
          setMessages([]);
        }}
      />
    </div>
  );
}
