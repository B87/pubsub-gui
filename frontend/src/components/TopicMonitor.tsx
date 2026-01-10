import { useState, useEffect, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Search, X, Info } from 'lucide-react';
import { useMessageSearch } from '../hooks/useMessageSearch';
import MessageRow from './MessageRow';
import MessageDetailDialog from './MessageDetailDialog';
import type { PubSubMessage, Topic, Subscription } from '../types';
import { Alert, AlertTitle, AlertDescription, Button, Input, Checkbox, Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from './ui';

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
  const [selectedMessage, setSelectedMessage] = useState<PubSubMessage | null>(null);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);

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

  // Auto-scroll to top when new messages arrive (if not searching)
  useEffect(() => {
    if (!searchQuery && parentRef.current && messages.length > 0) {
      parentRef.current.scrollTop = 0;
    }
  }, [messages.length, searchQuery]);

  const handleOpenMessageDetail = (message: PubSubMessage) => {
    setSelectedMessage(message);
    setIsDetailDialogOpen(true);
  };

  const handleCloseMessageDetail = () => {
    setIsDetailDialogOpen(false);
    // Clear selected message after dialog animation
    setTimeout(() => setSelectedMessage(null), 200);
  };

  return (
    <div
      className="flex flex-col h-full rounded-lg border overflow-hidden"
      style={{
        backgroundColor: 'var(--color-bg-secondary)',
        borderColor: 'var(--color-border-primary)',
      }}
    >
      {/* Error Notification */}
      {monitoringError && (
        <Alert variant="destructive" className="border-b-0 rounded-none">
          <AlertTitle>Failed to Start Monitoring</AlertTitle>
          <AlertDescription>{monitoringError}</AlertDescription>
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
                onCheckedChange={(checked) => onToggleAutoAck(checked === true)}
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
              onClick={onClearBuffer}
              disabled={messages.length === 0}
            >
              Clear
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
                  onClick={onStartMonitoring}
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
                  Start Monitoring
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Subscription Selector */}
        <div className="flex items-center gap-3">
          <label
            className="text-xs whitespace-nowrap"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            Subscription:
          </label>
          <Select
            value={selectedSubscription || 'none'}
            onValueChange={(value) => onSubscriptionChange(value === 'none' ? null : value)}
            disabled={isMonitoring}
          >
            <SelectTrigger className="flex-1 max-w-xs" title={isMonitoring ? 'Stop monitoring to change subscription' : 'Select a subscription to monitor or use auto-create'}>
              <SelectValue placeholder="Auto-create subscription" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Auto-create subscription</SelectItem>
              {subscriptions.map((sub) => (
                <SelectItem key={sub.name} value={sub.name}>
                  {sub.displayName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {isMonitoring && tempSubId && (
            <div
              className="text-xs flex items-center gap-1"
              style={{ color: 'var(--color-text-muted)' }}
            >
              <Info className="w-3 h-3" />
              <span>
                {tempSubId.startsWith('ps-gui-mon-')
                  ? 'Using temporary subscription'
                  : `Using: ${subscriptions.find(s => s.name.split('/').pop() === tempSubId)?.displayName || tempSubId}`}
              </span>
            </div>
          )}
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
        {!isMonitoring ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div
              className="mb-4"
              style={{ color: 'var(--color-text-muted)' }}
            >
              Click "Start Monitoring" to begin receiving messages
            </div>
          </div>
        ) : filteredMessages.length === 0 && searchQuery ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
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
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div
              className="mb-2"
              style={{ color: 'var(--color-text-muted)' }}
            >
              Waiting for messages...
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
                // Use combination of ID and receiveTime for unique key (handles redelivered messages)
                const uniqueKey = `${message.id}-${message.receiveTime}`;
                return (
                  <MessageRow
                    key={uniqueKey}
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
    </div>
  );
}
