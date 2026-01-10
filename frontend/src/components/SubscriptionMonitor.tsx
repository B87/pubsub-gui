import { useState, useEffect, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Search, X, Clock, Check } from 'lucide-react';
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
import { Alert, AlertDescription, Button, Input, Checkbox } from './ui';

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
    <div
      className="flex flex-col h-full rounded-lg border overflow-hidden"
      style={{
        backgroundColor: 'var(--color-bg-secondary)',
        borderColor: 'var(--color-border-primary)',
      }}
    >
      {/* Error Notification */}
      {error && (
        <Alert variant="destructive" className="border-b-0 rounded-none">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Toolbar */}
      <div
        className="p-4 border-b"
        style={{
          borderBottomColor: 'var(--color-border-primary)',
          backgroundColor: 'color-mix(in srgb, var(--color-bg-secondary) 50%, transparent)',
        }}
      >
        <div className="flex items-center justify-between gap-4 mb-3">
          <div className="flex-1 max-w-md relative">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
              style={{ color: 'var(--color-text-muted)' }}
            />
            <Input
              type="text"
              placeholder="Search messages (payload, attributes, ID)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-10"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2"
                style={{ color: 'var(--color-text-muted)' }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = 'var(--color-text-secondary)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = 'var(--color-text-muted)';
                }}
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-4">
            {searchQuery ? (
              <div
                className="text-xs"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                {filteredMessages.length} of {messages.length} messages
              </div>
            ) : (
              <div
                className="text-xs"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                {messages.length} messages
              </div>
            )}

            <label className="flex items-center gap-2 cursor-pointer">
              <Checkbox
                checked={autoAck}
                onCheckedChange={(checked) => handleToggleAutoAck(checked === true)}
              />
              <span
                className="text-xs"
                style={{ color: 'var(--color-text-primary)' }}
              >
                Auto-ack
              </span>
            </label>

            <Button
              variant="outline"
              size="sm"
              onClick={handleClearBuffer}
              disabled={messages.length === 0}
            >
              Clear
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsSeekDialogOpen(true)}
              title="Seek subscription to replay messages from a specific time"
            >
              <Clock className="w-4 h-4 mr-1" />
              Seek
            </Button>

            <div className="flex items-center gap-2">
              {isMonitoring ? (
                <span
                  className="flex items-center gap-1.5 text-xs font-medium"
                  style={{ color: 'var(--color-success)' }}
                >
                  <span
                    className="w-2 h-2 rounded-full animate-pulse"
                    style={{ backgroundColor: 'var(--color-success)' }}
                  ></span>
                  Monitoring
                </span>
              ) : (
                <Button
                  size="sm"
                  onClick={handleStartMonitoring}
                  disabled={isLoading}
                  loading={isLoading}
                  title={`Start monitoring (${formatShortcut({ key: 'm', ctrlOrCmd: true })})`}
                  style={{
                    backgroundColor: 'var(--color-success)',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--color-success-hover)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--color-success)';
                  }}
                >
                  {isLoading ? 'Starting...' : 'Start Monitoring'}
                </Button>
              )}
              {isMonitoring && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleStopMonitoring}
                  disabled={isLoading}
                  loading={isLoading}
                  title={`Stop monitoring (${formatShortcut({ key: 'm', ctrlOrCmd: true })})`}
                >
                  {isLoading ? 'Stopping...' : 'Stop'}
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Message Table */}
      <div
        ref={parentRef}
        className="flex-1 overflow-auto"
        style={{
          backgroundColor: 'color-mix(in srgb, var(--color-bg-tertiary) 30%, transparent)',
        }}
      >
        {isLoading && messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div style={{ color: 'var(--color-text-muted)' }}>Connecting to subscription...</div>
          </div>
        ) : filteredMessages.length === 0 && searchQuery ? (
          <div className="flex flex-col items-center justify-center h-full">
            <Search
              className="w-16 h-16 mb-4"
              style={{ color: 'var(--color-text-muted)' }}
            />
            <div
              className="mb-1"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              No messages match your search
            </div>
            <button
              onClick={() => setSearchQuery('')}
              className="text-sm"
              style={{ color: 'var(--color-accent-primary)' }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = 'var(--color-accent-hover)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = 'var(--color-accent-primary)';
              }}
            >
              Clear search
            </button>
          </div>
        ) : filteredMessages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div
                className="mb-2"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                No messages received yet
              </div>
              <div
                className="text-sm"
                style={{ color: 'var(--color-text-muted)' }}
              >
                {isMonitoring ? 'Waiting for messages...' : 'Start monitoring to receive messages'}
              </div>
            </div>
          </div>
        ) : (
          <table className="w-full">
            <thead
              className="sticky top-0 z-10 border-b-2"
              style={{
                backgroundColor: 'var(--color-bg-secondary)',
                borderBottomColor: 'var(--color-border-primary)',
              }}
            >
              <tr>
                <th
                  className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider"
                  style={{ color: 'var(--color-text-secondary)' }}
                >
                  Time
                </th>
                <th
                  className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider"
                  style={{ color: 'var(--color-text-secondary)' }}
                >
                  Message ID
                </th>
                <th
                  className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider"
                  style={{ color: 'var(--color-text-secondary)' }}
                >
                  Payload Preview
                </th>
                <th
                  className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider"
                  style={{ color: 'var(--color-text-secondary)' }}
                >
                  Attributes
                </th>
                <th
                  className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider"
                  style={{ color: 'var(--color-text-secondary)' }}
                >
                  Attempt
                </th>
                <th className="px-4 py-3 w-12"></th>
              </tr>
            </thead>
            <tbody
              style={{
                backgroundColor: 'color-mix(in srgb, var(--color-bg-secondary) 50%, transparent)',
              }}
            >
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
