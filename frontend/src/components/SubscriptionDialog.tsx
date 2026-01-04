import { useState, useEffect } from 'react';
import type { Topic, Subscription, SubscriptionUpdateParams } from '../types';

interface SubscriptionDialogProps {
  open: boolean;
  mode: 'create' | 'edit';
  topics: Topic[];
  subscription?: Subscription;
  onClose: () => void;
  onCreate?: (topicID: string, subID: string, params: SubscriptionUpdateParams) => Promise<void>;
  onUpdate?: (subID: string, params: SubscriptionUpdateParams) => Promise<void>;
  error?: string;
}

export default function SubscriptionDialog({
  open,
  mode,
  topics,
  subscription,
  onClose,
  onCreate,
  onUpdate,
  error: externalError,
}: SubscriptionDialogProps) {
  const [subID, setSubID] = useState('');
  const [topicID, setTopicID] = useState('');
  const [ackDeadline, setAckDeadline] = useState('10');
  const [retentionDuration, setRetentionDuration] = useState('');
  const [filter, setFilter] = useState('');
  const [subscriptionType, setSubscriptionType] = useState<'pull' | 'push'>('pull');
  const [pushEndpoint, setPushEndpoint] = useState('');
  const [deadLetterTopic, setDeadLetterTopic] = useState('');
  const [maxDeliveryAttempts, setMaxDeliveryAttempts] = useState('');
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Populate form when editing
  useEffect(() => {
    if (mode === 'edit' && subscription) {
      setSubID(subscription.displayName);
      setTopicID(subscription.topic);
      setAckDeadline(subscription.ackDeadline.toString());
      setRetentionDuration(subscription.retentionDuration);
      setFilter(subscription.filter || '');
      setSubscriptionType(subscription.subscriptionType);
      setPushEndpoint(subscription.pushEndpoint || '');
      if (subscription.deadLetterPolicy) {
        setDeadLetterTopic(subscription.deadLetterPolicy.deadLetterTopic);
        setMaxDeliveryAttempts(subscription.deadLetterPolicy.maxDeliveryAttempts.toString());
      }
    } else {
      // Reset form for create mode
      setSubID('');
      setTopicID('');
      setAckDeadline('10');
      setRetentionDuration('');
      setFilter('');
      setSubscriptionType('pull');
      setPushEndpoint('');
      setDeadLetterTopic('');
      setMaxDeliveryAttempts('');
    }
    setError('');
  }, [mode, subscription, open]);

  if (!open) return null;

  const handleSave = async () => {
    setError('');

    // Validation
    if (mode === 'create') {
      if (!subID.trim()) {
        setError('Subscription ID is required');
        return;
      }
      if (!topicID) {
        setError('Topic is required');
        return;
      }
    }

    const ackDeadlineNum = parseInt(ackDeadline, 10);
    if (isNaN(ackDeadlineNum) || ackDeadlineNum < 10 || ackDeadlineNum > 600) {
      setError('Ack deadline must be between 10 and 600 seconds');
      return;
    }

    if (subscriptionType === 'push' && !pushEndpoint.trim()) {
      setError('Push endpoint is required for push subscriptions');
      return;
    }

    setIsSaving(true);
    try {
      const params: SubscriptionUpdateParams = {
        ackDeadline: ackDeadlineNum,
        subscriptionType,
      };

      if (retentionDuration.trim()) {
        params.retentionDuration = retentionDuration.trim();
      }

      if (filter.trim()) {
        params.filter = filter.trim();
      }

      if (subscriptionType === 'push' && pushEndpoint.trim()) {
        params.pushEndpoint = pushEndpoint.trim();
      }

      if (deadLetterTopic.trim() && maxDeliveryAttempts.trim()) {
        const maxAttempts = parseInt(maxDeliveryAttempts, 10);
        if (!isNaN(maxAttempts) && maxAttempts > 0) {
          params.deadLetterPolicy = {
            deadLetterTopic: deadLetterTopic.trim(),
            maxDeliveryAttempts: maxAttempts,
          };
        }
      }

      if (mode === 'create' && onCreate) {
        await onCreate(topicID, subID.trim(), params);
      } else if (mode === 'edit' && onUpdate && subscription) {
        await onUpdate(subscription.name, params);
      }

      onClose();
    } catch (e: any) {
      setError(e.toString());
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    setError('');
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-slate-800 border border-slate-700 rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <h3 className="text-lg font-semibold mb-4">
          {mode === 'create' ? 'Create Subscription' : 'Edit Subscription'}
        </h3>

        <div className="space-y-4">
          {/* Subscription ID (create only) */}
          {mode === 'create' && (
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-2">
                Subscription ID *
              </label>
              <input
                type="text"
                value={subID}
                onChange={(e) => setSubID(e.target.value)}
                placeholder="my-subscription"
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                autoFocus
                disabled={isSaving}
              />
              <p className="text-xs text-slate-500 mt-1">
                Only lowercase letters, numbers, hyphens, and underscores allowed
              </p>
            </div>
          )}

          {/* Topic selector (create only) */}
          {mode === 'create' && (
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-2">
                Topic *
              </label>
              <select
                value={topicID}
                onChange={(e) => setTopicID(e.target.value)}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={isSaving}
              >
                <option value="">Select a topic...</option>
                {topics.map((topic) => (
                  <option key={topic.name} value={topic.name}>
                    {topic.displayName}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Ack Deadline */}
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-2">
              Acknowledgement Deadline (seconds) *
            </label>
            <input
              type="number"
              value={ackDeadline}
              onChange={(e) => setAckDeadline(e.target.value)}
              min="10"
              max="600"
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={isSaving}
            />
            <p className="text-xs text-slate-500 mt-1">
              Between 10 and 600 seconds
            </p>
          </div>

          {/* Retention Duration */}
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-2">
              Message Retention Duration (Optional)
            </label>
            <input
              type="text"
              value={retentionDuration}
              onChange={(e) => setRetentionDuration(e.target.value)}
              placeholder="e.g., 7d, 24h"
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={isSaving}
            />
          </div>

          {/* Filter */}
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-2">
              Filter Expression (Optional)
            </label>
            <input
              type="text"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="attributes.event_type = 'user.signup'"
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={isSaving}
            />
            <p className="text-xs text-slate-500 mt-1">
              Pub/Sub filter expression syntax
            </p>
          </div>

          {/* Subscription Type */}
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-2">
              Subscription Type *
            </label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  value="pull"
                  checked={subscriptionType === 'pull'}
                  onChange={(e) => {
                    setSubscriptionType('pull');
                    setPushEndpoint('');
                  }}
                  disabled={isSaving}
                  className="w-4 h-4"
                />
                <span>Pull</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  value="push"
                  checked={subscriptionType === 'push'}
                  onChange={(e) => setSubscriptionType('push')}
                  disabled={isSaving}
                  className="w-4 h-4"
                />
                <span>Push</span>
              </label>
            </div>
          </div>

          {/* Push Endpoint */}
          {subscriptionType === 'push' && (
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-2">
                Push Endpoint URL *
              </label>
              <input
                type="url"
                value={pushEndpoint}
                onChange={(e) => setPushEndpoint(e.target.value)}
                placeholder="https://example.com/webhook"
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={isSaving}
              />
            </div>
          )}

          {/* Dead Letter Policy */}
          <div className="border-t border-slate-700 pt-4">
            <h4 className="text-sm font-medium text-slate-400 mb-3">Dead Letter Policy (Optional)</h4>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-2">
                  Dead Letter Topic
                </label>
                <select
                  value={deadLetterTopic}
                  onChange={(e) => setDeadLetterTopic(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={isSaving}
                >
                  <option value="">Select a topic...</option>
                  {topics.map((topic) => (
                    <option key={topic.name} value={topic.name}>
                      {topic.displayName}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-2">
                  Max Delivery Attempts
                </label>
                <input
                  type="number"
                  value={maxDeliveryAttempts}
                  onChange={(e) => setMaxDeliveryAttempts(e.target.value)}
                  min="1"
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={isSaving}
                />
              </div>
            </div>
          </div>

          {(error || externalError) && (
            <div className="p-3 bg-red-900/20 border border-red-700 rounded text-red-400 text-sm">
              {error || externalError}
            </div>
          )}

          <div className="flex gap-3 justify-end pt-4 border-t border-slate-700">
            <button
              onClick={handleClose}
              disabled={isSaving}
              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 disabled:bg-slate-700 disabled:opacity-50 rounded transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving || (mode === 'create' && (!subID.trim() || !topicID))}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 disabled:cursor-not-allowed rounded transition-colors"
            >
              {isSaving ? 'Saving...' : mode === 'create' ? 'Create' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
