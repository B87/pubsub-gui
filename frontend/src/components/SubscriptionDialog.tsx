import { useState, useEffect } from 'react';
import type { Topic, Subscription, SubscriptionUpdateParams } from '../types';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Button,
  FormField,
  Input,
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
  Alert,
  AlertDescription,
  Separator,
} from './ui';

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
    <Dialog open={open} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {mode === 'create' ? 'Create Subscription' : 'Edit Subscription'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Subscription ID (create only) */}
          {mode === 'create' && (
            <FormField
              label="Subscription ID"
              required
              helperText="Only lowercase letters, numbers, hyphens, and underscores allowed"
            >
              <Input
                type="text"
                value={subID}
                onChange={(e) => setSubID(e.target.value)}
                placeholder="my-subscription"
                autoFocus
                disabled={isSaving}
              />
            </FormField>
          )}

          {/* Topic selector (create only) */}
          {mode === 'create' && (
            <FormField label="Topic" required>
              <Select value={topicID} onValueChange={setTopicID} disabled={isSaving}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a topic..." />
                </SelectTrigger>
                <SelectContent>
                  {topics.map((topic) => (
                    <SelectItem key={topic.name} value={topic.name}>
                      {topic.displayName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
          )}

          {/* Ack Deadline */}
          <FormField
            label="Acknowledgement Deadline (seconds)"
            required
            helperText="Between 10 and 600 seconds"
          >
            <Input
              type="number"
              value={ackDeadline}
              onChange={(e) => setAckDeadline(e.target.value)}
              min="10"
              max="600"
              disabled={isSaving}
            />
          </FormField>

          {/* Retention Duration */}
          <FormField label="Message Retention Duration (Optional)">
            <Input
              type="text"
              value={retentionDuration}
              onChange={(e) => setRetentionDuration(e.target.value)}
              placeholder="e.g., 7d, 24h"
              disabled={isSaving}
            />
          </FormField>

          {/* Filter */}
          <FormField
            label="Filter Expression (Optional)"
            helperText="Pub/Sub filter expression syntax"
          >
            <Input
              type="text"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="attributes.event_type = 'user.signup'"
              disabled={isSaving}
            />
          </FormField>

          {/* Subscription Type */}
          <FormField label="Subscription Type" required>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setSubscriptionType('pull');
                  setPushEndpoint('');
                }}
                disabled={isSaving}
                className={`flex-1 px-4 py-3 rounded-md border-2 transition-all font-medium ${
                  subscriptionType === 'pull'
                    ? 'border-blue-500'
                    : 'border-slate-700 hover:border-slate-600'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
                style={{
                  backgroundColor:
                    subscriptionType === 'pull'
                      ? 'color-mix(in srgb, var(--color-accent-primary) 15%, transparent)'
                      : 'var(--color-bg-tertiary)',
                  color: 'var(--color-text-primary)',
                  borderColor:
                    subscriptionType === 'pull'
                      ? 'var(--color-accent-primary)'
                      : 'var(--color-border-primary)',
                }}
              >
                <div className="flex items-center justify-center gap-2">
                  {subscriptionType === 'pull' && (
                    <svg
                      className="w-5 h-5"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                      style={{ color: 'var(--color-accent-primary)' }}
                    >
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                        clipRule="evenodd"
                      />
                    </svg>
                  )}
                  <span>Pull</span>
                </div>
              </button>
              <button
                type="button"
                onClick={() => setSubscriptionType('push')}
                disabled={isSaving}
                className={`flex-1 px-4 py-3 rounded-md border-2 transition-all font-medium ${
                  subscriptionType === 'push'
                    ? 'border-blue-500'
                    : 'border-slate-700 hover:border-slate-600'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
                style={{
                  backgroundColor:
                    subscriptionType === 'push'
                      ? 'color-mix(in srgb, var(--color-accent-primary) 15%, transparent)'
                      : 'var(--color-bg-tertiary)',
                  color: 'var(--color-text-primary)',
                  borderColor:
                    subscriptionType === 'push'
                      ? 'var(--color-accent-primary)'
                      : 'var(--color-border-primary)',
                }}
              >
                <div className="flex items-center justify-center gap-2">
                  {subscriptionType === 'push' && (
                    <svg
                      className="w-5 h-5"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                      style={{ color: 'var(--color-accent-primary)' }}
                    >
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                        clipRule="evenodd"
                      />
                    </svg>
                  )}
                  <span>Push</span>
                </div>
              </button>
            </div>
          </FormField>

          {/* Push Endpoint */}
          {subscriptionType === 'push' && (
            <FormField label="Push Endpoint URL" required>
              <Input
                type="url"
                value={pushEndpoint}
                onChange={(e) => setPushEndpoint(e.target.value)}
                placeholder="https://example.com/webhook"
                disabled={isSaving}
              />
            </FormField>
          )}

          {/* Dead Letter Policy */}
          <div className="pt-4">
            <Separator className="mb-4" />
            <h4
              className="text-sm font-medium mb-3"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              Dead Letter Policy (Optional)
            </h4>
            <div className="space-y-3">
              <FormField label="Dead Letter Topic">
                <Select
                  value={deadLetterTopic || 'none'}
                  onValueChange={(value) => setDeadLetterTopic(value === 'none' ? '' : value)}
                  disabled={isSaving}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a topic..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {topics.map((topic) => (
                      <SelectItem key={topic.name} value={topic.name}>
                        {topic.displayName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
              <FormField label="Max Delivery Attempts">
                <Input
                  type="number"
                  value={maxDeliveryAttempts}
                  onChange={(e) => setMaxDeliveryAttempts(e.target.value)}
                  min="1"
                  disabled={isSaving}
                />
              </FormField>
            </div>
          </div>

          {(error || externalError) && (
            <Alert variant="destructive">
              <AlertDescription>{error || externalError}</AlertDescription>
            </Alert>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={handleClose} disabled={isSaving}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={isSaving || (mode === 'create' && (!subID.trim() || !topicID))}
              loading={isSaving}
            >
              {mode === 'create' ? 'Create' : 'Save'}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
