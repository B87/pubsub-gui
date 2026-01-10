import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { MessageSquare, Copy, Plus, X } from 'lucide-react';
import type { Topic, Subscription, MessageTemplate, PublishResult, PubSubMessage } from '../types';
import { GetTemplates, PublishMessage, SaveTemplate, StartTopicMonitor, StopTopicMonitor, GetBufferedMessages, ClearMessageBuffer, GetAutoAck, SetAutoAck } from '../../wailsjs/go/main/App';
import { EventsOn } from '../../wailsjs/runtime/runtime';
import TemplateManager from './TemplateManager';
import TopicMonitor from './TopicMonitor';
import DeleteConfirmDialog from './DeleteConfirmDialog';
import JsonEditor from './JsonEditor';
import { useKeyboardShortcuts, isInputFocused, formatShortcut } from '../hooks/useKeyboardShortcuts';
import { Alert, AlertTitle, AlertDescription, Button, Input, Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from './ui';

interface TopicDetailsProps {
  topic: Topic;
  allSubscriptions: Subscription[];
  allTopics: Topic[];
  onDelete?: (topic: Topic) => void;
  onSelectSubscription?: (subscription: Subscription) => void;
  onSelectTopic?: (topic: Topic) => void;
}

type Tab = 'metadata' | 'publish' | 'monitor' | 'subscriptions' | 'deadLetter';

interface Attribute {
  key: string;
  value: string;
}

export default function TopicDetails({ topic, allSubscriptions, allTopics, onDelete, onSelectSubscription, onSelectTopic }: TopicDetailsProps) {
  const [activeTab, setActiveTab] = useState<Tab>('metadata');
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [payload, setPayload] = useState<string>('');
  const [attributes, setAttributes] = useState<Attribute[]>([{ key: '', value: '' }]);
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishResult, setPublishResult] = useState<PublishResult | null>(null);
  const [error, setError] = useState<string>('');
  const [showSaveTemplateDialog, setShowSaveTemplateDialog] = useState(false);
  const [showTemplateManager, setShowTemplateManager] = useState(false);
  const [templateName, setTemplateName] = useState<string>('');
  const [linkToTopic, setLinkToTopic] = useState<boolean>(false);

  // Monitoring state
  const [monitoringMessages, setMonitoringMessages] = useState<PubSubMessage[]>([]);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [tempSubId, setTempSubId] = useState<string | null>(null);
  const [autoAck, setAutoAck] = useState(true);
  const [monitoringError, setMonitoringError] = useState<string>('');
  const monitoringRef = useRef<{ started: boolean, starting: boolean }>({ started: false, starting: false });
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedSubscriptionForMonitoring, setSelectedSubscriptionForMonitoring] = useState<string | null>(null);
  const [monitorSubscriptions, setMonitorSubscriptions] = useState<Subscription[]>([]);
  const [loadingMonitorSubscriptions, setLoadingMonitorSubscriptions] = useState(false);

  // Local filtering using useMemo for instant updates
  const subscriptions = useMemo(() => {
    return allSubscriptions.filter(sub => sub.topic === topic.name);
  }, [allSubscriptions, topic.name]);

  const deadLetterSubscriptions = useMemo(() => {
    return allSubscriptions.filter(sub =>
      sub.deadLetterPolicy?.deadLetterTopic === topic.name
    );
  }, [allSubscriptions, topic.name]);

  const deadLetterTopics = useMemo(() => {
    // Collect unique dead letter topics from subscriptions subscribed to this topic
    const deadLetterTopicSet = new Set<string>();
    subscriptions.forEach(sub => {
      if (sub.deadLetterPolicy?.deadLetterTopic) {
        deadLetterTopicSet.add(sub.deadLetterPolicy.deadLetterTopic);
      }
    });

    // Filter topics that are in the dead letter topic set
    return allTopics.filter(t => deadLetterTopicSet.has(t.name));
  }, [subscriptions, allTopics]);

  const [loadingRelations] = useState(false);
  const [relationsError] = useState<string>('');

  // Load templates when topic changes
  useEffect(() => {
    loadTemplates();
    // Reset form when topic changes
    setPayload('');
    setAttributes([{ key: '', value: '' }]);
    setSelectedTemplateId('');
    setPublishResult(null);
    setError('');
    // Reset monitoring state when topic changes
    setMonitoringMessages([]);
    setIsMonitoring(false);
    setTempSubId(null);
    setMonitoringError('');
    setSelectedSubscriptionForMonitoring(null);
    monitoringRef.current = { started: false, starting: false };
  }, [topic.name]);

  // Stop monitoring when topic changes
  useEffect(() => {
    return () => {
      const stopMonitoring = async () => {
        try {
          await StopTopicMonitor(topic.name);
          monitoringRef.current.started = false;
          monitoringRef.current.starting = false;
        } catch (err) {
          console.error('Failed to stop monitoring:', err);
        }
      };
      stopMonitoring();
    };
  }, [topic.name]);

  // Set up Wails event listeners for monitoring
  useEffect(() => {
    const unsubscribeMessage = EventsOn('message:received', (message: PubSubMessage) => {
      // Only add messages if we have an active subscription ID for this topic
      // This ensures we only capture messages for the current topic being monitored
      if (tempSubId) {
        setMonitoringMessages((prev) => {
          // Deduplicate: check if message with same ID and receiveTime already exists
          const messageKey = `${message.id}-${message.receiveTime}`;
          const exists = prev.some(m => `${m.id}-${m.receiveTime}` === messageKey);
          if (exists) {
            return prev; // Don't add duplicate
          }
          const updated = [message, ...prev];
          return updated.slice(0, 1000);
        });
      }
    });

    const unsubscribeStarted = EventsOn('monitor:started', (data: { subscriptionID: string }) => {
      // Set tempSubId for both auto-created and existing subscriptions
      setTempSubId(data.subscriptionID);
      setIsMonitoring(true);
      setMonitoringError(''); // Clear any errors when monitoring starts successfully
      monitoringRef.current.started = true;
      monitoringRef.current.starting = false;

      // Load buffered messages
      GetBufferedMessages(data.subscriptionID)
        .then((bufferedMessages: PubSubMessage[]) => {
          // Deduplicate buffered messages against existing ones
          setMonitoringMessages((prev) => {
            const existingKeys = new Set(prev.map(m => `${m.id}-${m.receiveTime}`));
            const newMessages = bufferedMessages.filter(m => {
              const key = `${m.id}-${m.receiveTime}`;
              return !existingKeys.has(key);
            });
            return [...newMessages, ...prev].slice(0, 1000);
          });
        })
        .catch((err: unknown) => {
          console.error('Failed to load buffered messages:', err);
        });
    });

    const unsubscribeStopped = EventsOn('monitor:stopped', (data: { subscriptionID: string }) => {
      if (data.subscriptionID === tempSubId) {
        setIsMonitoring(false);
        setTempSubId(null);
        monitoringRef.current.started = false;
        monitoringRef.current.starting = false;
      }
    });

    return () => {
      unsubscribeMessage();
      unsubscribeStarted();
      unsubscribeStopped();
    };
  }, [tempSubId]);

  // Load auto-ack setting on mount
  useEffect(() => {
    GetAutoAck()
      .then(setAutoAck)
      .catch((err: unknown) => console.error('Failed to get auto-ack setting:', err));
  }, []);

  // Set default empty JSON object when publish tab is active and payload is empty
  useEffect(() => {
    if (activeTab === 'publish' && !payload.trim() && !selectedTemplateId) {
      const defaultPayload = '{\n\n}';
      setPayload(defaultPayload);
    }
  }, [activeTab, payload, selectedTemplateId]);

  const loadTemplates = async () => {
    try {
      const t = await GetTemplates(topic.name);
      setTemplates(t as MessageTemplate[]);
    } catch (e) {
      console.error('Failed to load templates:', e);
    }
  };

  // Relations are now computed locally via useMemo - no need to load them

  // Load subscriptions for monitoring when monitor tab becomes active (using local filtering)
  useEffect(() => {
    if (activeTab === 'monitor') {
      setLoadingMonitorSubscriptions(true);
      // Filter subscriptions locally - only pull subscriptions can be monitored
      const pullSubs = subscriptions.filter(sub => sub.subscriptionType === 'pull');
      setMonitorSubscriptions(pullSubs);
      setLoadingMonitorSubscriptions(false);
    }
  }, [activeTab, subscriptions]);

  // Keyboard shortcut for publishing (Cmd/Ctrl+Enter when publish tab is active)
  useKeyboardShortcuts([
    {
      key: 'Enter',
      ctrlOrCmd: true,
      action: () => {
        // Only trigger if publish tab is active and not typing in an input
        if (activeTab === 'publish' && !isInputFocused() && !isPublishing && payload.trim()) {
          handlePublish();
        }
      },
      enabled: activeTab === 'publish' && !isPublishing && !!payload.trim(),
      description: 'Publish message',
    },
  ]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const handlePayloadChange = (value: string) => {
    setPayload(value);
  };

  const handleAttributeChange = (index: number, field: 'key' | 'value', value: string) => {
    const newAttributes = [...attributes];
    newAttributes[index] = { ...newAttributes[index], [field]: value };
    setAttributes(newAttributes);
  };

  const addAttribute = () => {
    setAttributes([...attributes, { key: '', value: '' }]);
  };

  const removeAttribute = (index: number) => {
    if (attributes.length > 1) {
      setAttributes(attributes.filter((_, i) => i !== index));
    }
  };

  const handleTemplateSelect = (templateId: string) => {
    setSelectedTemplateId(templateId);
    if (!templateId || templateId.trim() === '') {
      // Clear template - reset to default empty JSON
      setPayload('{\n\n}');
      setAttributes([{ key: '', value: '' }]);
      return;
    }
    const template = templates.find(t => t.id === templateId);
    if (template) {
      setPayload(template.payload);
      // Convert attributes object to array
      const attrs = Object.entries(template.attributes || {}).map(([key, value]) => ({ key, value }));
      if (attrs.length === 0) {
        attrs.push({ key: '', value: '' });
      }
      setAttributes(attrs);
    }
  };

  const handlePublish = async () => {
    setError('');
    setPublishResult(null);

    // Validate payload is not empty
    if (!payload.trim()) {
      setError('Payload cannot be empty');
      return;
    }

    // Build attributes object (filter out empty keys)
    const attrsObj: Record<string, string> = {};
    attributes.forEach(attr => {
      if (attr.key.trim()) {
        attrsObj[attr.key.trim()] = attr.value;
      }
    });

    setIsPublishing(true);
    try {
      const result = await PublishMessage(topic.name, payload, attrsObj);
      setPublishResult(result as PublishResult);
      setError('');
    } catch (e: any) {
      setError(e.toString());
      setPublishResult(null);
    } finally {
      setIsPublishing(false);
    }
  };

  const handleSaveTemplate = async () => {
    if (!templateName.trim()) {
      setError('Template name is required');
      return;
    }

    // Build attributes object
    const attrsObj: Record<string, string> = {};
    attributes.forEach(attr => {
      if (attr.key.trim()) {
        attrsObj[attr.key.trim()] = attr.value;
      }
    });

    try {
      const template: MessageTemplate = {
        id: '',
        name: templateName.trim(),
        topicId: linkToTopic ? topic.name : undefined,
        payload: payload,
        attributes: attrsObj,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await SaveTemplate(template);
      setShowSaveTemplateDialog(false);
      setTemplateName('');
      setLinkToTopic(false);
      await loadTemplates();
      setError('');
    } catch (e: any) {
      setError(e.toString());
    }
  };

  const handleClearMonitoringBuffer = async () => {
    if (!tempSubId) return;
    try {
      await ClearMessageBuffer(tempSubId);
      setMonitoringMessages([]);
    } catch (err) {
      console.error('Failed to clear buffer:', err);
    }
  };

  const handleToggleAutoAck = async (enabled: boolean) => {
    try {
      await SetAutoAck(enabled);
      setAutoAck(enabled);
    } catch (err) {
      console.error('Failed to update auto-ack setting:', err);
    }
  };

  const handleStartMonitoring = async () => {
    if (monitoringRef.current.starting || monitoringRef.current.started) return;
    monitoringRef.current.starting = true;
    setMonitoringError(''); // Clear any previous errors

    try {
      // Pass selected subscription ID (or empty string for auto-create)
      const subscriptionID = selectedSubscriptionForMonitoring || '';
      await StartTopicMonitor(topic.name, subscriptionID);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      // Extract a user-friendly error message
      let friendlyError = errorMessage;
      if (errorMessage.includes('Permission denied')) {
        friendlyError = 'Permission denied: You need the "pubsub.subscriptions.create" permission to monitor topics. Please contact your administrator to grant this permission.';
      } else if (errorMessage.includes('NotFound')) {
        friendlyError = 'Resource not found: The topic or project may not exist or you may not have access to it.';
      } else if (errorMessage.includes('failed to create temporary subscription')) {
        friendlyError = `Failed to create monitoring subscription: ${errorMessage.split('failed to create temporary subscription:')[1]?.trim() || errorMessage}`;
      } else if (errorMessage.includes('is not subscribed to topic')) {
        friendlyError = `Selected subscription is not subscribed to this topic. Please select a different subscription or use auto-create.`;
      } else if (errorMessage.includes('monitoring is not supported for push subscriptions')) {
        friendlyError = 'Push subscriptions cannot be monitored. Please select a pull subscription or use auto-create.';
      }
      setMonitoringError(friendlyError);
      monitoringRef.current.starting = false;
    }
  };

  return (
    <div className="flex flex-col h-full p-8">
      <div className="w-full">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <div
              className="h-8 w-8 rounded flex items-center justify-center"
              style={{ backgroundColor: 'var(--color-accent-primary)' }}
            >
              <MessageSquare
                className="w-5 h-5"
                style={{ color: 'white' }}
              />
            </div>
            <div>
              <h2
                className="text-2xl font-semibold"
                style={{ color: 'var(--color-text-primary)' }}
              >
                {topic.displayName}
              </h2>
              <p
                className="text-sm"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                Topic
              </p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div
          className="mb-6 border-b"
          style={{
            borderBottomColor: 'var(--color-border-primary)',
            borderBottomWidth: '1px',
            borderBottomStyle: 'solid',
          }}
        >
          <div className="flex gap-4">
            {(['metadata', 'publish', 'monitor', 'subscriptions', 'deadLetter'] as Tab[]).map((tab) => {
              const isActive = activeTab === tab;
              const getBadgeCount = () => {
                if (tab === 'subscriptions') return subscriptions?.length ?? 0;
                if (tab === 'deadLetter') return (deadLetterSubscriptions?.length ?? 0) + (deadLetterTopics?.length ?? 0);
                return 0;
              };
              const badgeCount = getBadgeCount();
              return (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className="px-4 py-2 font-medium transition-colors relative"
                  style={{
                    color: isActive
                      ? 'var(--color-text-primary)'
                      : 'var(--color-text-secondary)',
                    borderBottomWidth: isActive ? '2px' : '0',
                    borderBottomStyle: 'solid',
                    borderBottomColor: isActive
                      ? 'var(--color-accent-primary)'
                      : 'transparent',
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.color = 'var(--color-text-primary)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.color = 'var(--color-text-secondary)';
                    }
                  }}
                >
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                  {badgeCount > 0 && (
                    <span
                      className="ml-2 px-2 py-0.5 text-xs rounded-full"
                      style={{
                        backgroundColor: 'var(--color-accent-primary)',
                        color: 'white',
                      }}
                    >
                      {badgeCount}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Metadata Tab */}
        {activeTab === 'metadata' && (
          <div
            className="rounded-lg border"
            style={{
              backgroundColor: 'var(--color-bg-secondary)',
              borderColor: 'var(--color-border-primary)',
              borderWidth: '1px',
              borderStyle: 'solid',
            }}
          >
            <div
              className="px-6 py-4 border-b flex items-center justify-between"
              style={{
                borderBottomColor: 'var(--color-border-primary)',
                borderBottomWidth: '1px',
                borderBottomStyle: 'solid',
              }}
            >
              <h3
                className="text-lg font-semibold"
                style={{ color: 'var(--color-text-primary)' }}
              >
                Metadata
              </h3>
              {onDelete && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setShowDeleteDialog(true)}
                >
                  Delete Topic
                </Button>
              )}
            </div>

            <div className="p-6 space-y-4">
              {/* Full Name */}
              <div>
                <label
                  className="block text-sm font-medium mb-1"
                  style={{ color: 'var(--color-text-secondary)' }}
                >
                  Full Resource Name
                </label>
                <div className="flex items-center gap-2">
                  <code
                    className="flex-1 px-3 py-2 rounded text-sm font-mono overflow-x-auto"
                    style={{
                      backgroundColor: 'var(--color-bg-code)',
                      color: 'var(--color-text-primary)',
                    }}
                  >
                    {topic.name}
                  </code>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyToClipboard(topic.name)}
                    title="Copy to clipboard"
                  >
                    <Copy className="w-4 h-4 mr-1" />
                    Copy
                  </Button>
                </div>
              </div>

              {/* Display Name */}
              <div>
                <label
                  className="block text-sm font-medium mb-1"
                  style={{ color: 'var(--color-text-secondary)' }}
                >
                  Display Name
                </label>
                <p
                  className="px-3 py-2 rounded"
                  style={{
                    backgroundColor: 'var(--color-bg-code)',
                    color: 'var(--color-text-primary)',
                  }}
                >
                  {topic.displayName}
                </p>
              </div>

              {/* Message Retention */}
              {topic.messageRetention && (
                <div>
                  <label
                    className="block text-sm font-medium mb-1"
                    style={{ color: 'var(--color-text-secondary)' }}
                  >
                    Message Retention Duration
                  </label>
                  <p
                    className="px-3 py-2 rounded"
                    style={{
                      backgroundColor: 'var(--color-bg-code)',
                      color: 'var(--color-text-primary)',
                    }}
                  >
                    {topic.messageRetention}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Publish Tab */}
        {activeTab === 'publish' && (
          <div className="space-y-6">
            {/* Template Dropdown */}
            <div>
              <label
                className="block text-sm font-medium mb-2"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                Template (Optional)
              </label>
              <Select
                value={selectedTemplateId || 'none'}
                onValueChange={(value) => handleTemplateSelect(value === 'none' ? '' : value)}
              >
                <SelectTrigger
                  className="w-full"
                  style={{
                    backgroundColor: 'var(--color-bg-tertiary)',
                    borderColor: 'var(--color-border-primary)',
                  }}
                >
                  <SelectValue placeholder="No template" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No template</SelectItem>
                  {templates.map(t => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name} {t.topicId ? '(Topic-specific)' : '(Global)'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Payload */}
            <JsonEditor
              value={payload}
              onChange={handlePayloadChange}
              disabled={isPublishing}
            />

            {/* Attributes */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label
                  className="block text-sm font-medium"
                  style={{ color: 'var(--color-text-secondary)' }}
                >
                  Attributes
                </label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={addAttribute}
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Add
                </Button>
              </div>
              <div className="space-y-2">
                {attributes.map((attr, index) => (
                  <div key={index} className="flex gap-2">
                    <Input
                      type="text"
                      value={attr.key}
                      onChange={(e) => handleAttributeChange(index, 'key', e.target.value)}
                      placeholder="Key"
                      className="flex-1"
                      style={{
                        backgroundColor: 'var(--color-bg-tertiary)',
                        borderColor: 'var(--color-border-primary)',
                      }}
                    />
                    <Input
                      type="text"
                      value={attr.value}
                      onChange={(e) => handleAttributeChange(index, 'value', e.target.value)}
                      placeholder="Value"
                      className="flex-1"
                      style={{
                        backgroundColor: 'var(--color-bg-tertiary)',
                        borderColor: 'var(--color-border-primary)',
                      }}
                    />
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => removeAttribute(index)}
                      disabled={attributes.length === 1}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            {/* Error Display */}
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* Success Display */}
            {publishResult && (
              <Alert variant="success">
                <AlertTitle>Message published successfully!</AlertTitle>
                <AlertDescription>
                  <div className="space-y-1 text-sm">
                    <p>Message ID: <code style={{ backgroundColor: 'var(--color-bg-code)' }} className="px-2 py-1 rounded">{publishResult.messageId}</code></p>
                    <p>Published at: {new Date(publishResult.timestamp).toLocaleString()}</p>
                  </div>
                </AlertDescription>
              </Alert>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3">
              <Button
                onClick={handlePublish}
                disabled={isPublishing || !payload.trim()}
                loading={isPublishing}
                title={isPublishing ? 'Publishing...' : `Publish message (${formatShortcut({ key: 'Enter', ctrlOrCmd: true })})`}
              >
                Publish
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowSaveTemplateDialog(true)}
                disabled={!payload.trim()}
              >
                Save as Template
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowTemplateManager(true)}
              >
                Manage Templates
              </Button>
            </div>

            {/* Save Template Dialog */}
            {showSaveTemplateDialog && (
              <div
                className="fixed inset-0 flex items-center justify-center z-50"
                style={{
                  backgroundColor: 'color-mix(in srgb, var(--color-bg-primary) 50%, transparent)',
                }}
              >
                <div
                  className="rounded-lg p-6 max-w-md w-full mx-4"
                  style={{
                    backgroundColor: 'var(--color-bg-secondary)',
                    borderColor: 'var(--color-border-primary)',
                    borderWidth: '1px',
                    borderStyle: 'solid',
                  }}
                >
                  <h3
                    className="text-lg font-semibold mb-4"
                    style={{ color: 'var(--color-text-primary)' }}
                  >
                    Save as Template
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <label
                        className="block text-sm font-medium mb-2"
                        style={{ color: 'var(--color-text-secondary)' }}
                      >
                        Template Name *
                      </label>
                      <Input
                        type="text"
                        value={templateName}
                        onChange={(e) => setTemplateName(e.target.value)}
                        placeholder="e.g., User Signup Event"
                        autoFocus
                        style={{
                          backgroundColor: 'var(--color-bg-tertiary)',
                          borderColor: 'var(--color-border-primary)',
                        }}
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="linkToTopic"
                        checked={linkToTopic}
                        onChange={(e) => setLinkToTopic(e.target.checked)}
                        className="w-4 h-4"
                      />
                      <label
                        htmlFor="linkToTopic"
                        className="text-sm"
                        style={{ color: 'var(--color-text-secondary)' }}
                      >
                        Link to this topic
                      </label>
                    </div>
                    <div className="flex gap-3 justify-end">
                      <Button
                        variant="outline"
                        onClick={() => {
                          setShowSaveTemplateDialog(false);
                          setTemplateName('');
                          setLinkToTopic(false);
                        }}
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={handleSaveTemplate}
                        disabled={!templateName.trim()}
                      >
                        Save
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Template Manager */}
            <TemplateManager
              open={showTemplateManager}
              onClose={() => {
                setShowTemplateManager(false);
                loadTemplates();
              }}
              currentTopicId={topic.name}
            />
          </div>
        )}

        {/* Monitor Tab */}
        {activeTab === 'monitor' && (
          <div className="flex-1 flex flex-col min-h-0 -mx-8 -mb-8 px-8 pb-8">
            <TopicMonitor
              topic={topic}
              messages={monitoringMessages}
              isMonitoring={isMonitoring}
              tempSubId={tempSubId}
              autoAck={autoAck}
              monitoringError={monitoringError}
              subscriptions={monitorSubscriptions}
              selectedSubscription={selectedSubscriptionForMonitoring}
              onSubscriptionChange={setSelectedSubscriptionForMonitoring}
              onStartMonitoring={handleStartMonitoring}
              onClearBuffer={handleClearMonitoringBuffer}
              onToggleAutoAck={handleToggleAutoAck}
            />
          </div>
        )}

        {/* Subscriptions Tab */}
        {activeTab === 'subscriptions' && (
          <div
            className="rounded-lg border"
            style={{
              backgroundColor: 'var(--color-bg-secondary)',
              borderColor: 'var(--color-border-primary)',
              borderWidth: '1px',
              borderStyle: 'solid',
            }}
          >
            <div
              className="px-6 py-4 border-b"
              style={{
                borderBottomColor: 'var(--color-border-primary)',
                borderBottomWidth: '1px',
                borderBottomStyle: 'solid',
              }}
            >
              <h3
                className="text-lg font-semibold"
                style={{ color: 'var(--color-text-primary)' }}
              >
                Subscriptions
              </h3>
              <p
                className="text-sm mt-1"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                Subscriptions subscribed to this topic
              </p>
            </div>

            <div className="p-6">
              {loadingRelations ? (
                <div className="flex items-center justify-center py-8">
                  <div style={{ color: 'var(--color-text-secondary)' }}>
                    Loading subscriptions...
                  </div>
                </div>
              ) : relationsError ? (
                <Alert variant="destructive">
                  <AlertDescription>{relationsError}</AlertDescription>
                </Alert>
              ) : (subscriptions?.length ?? 0) === 0 ? (
                <div className="text-center py-8">
                  <svg
                    className="w-12 h-12 mx-auto mb-4"
                    style={{ color: 'var(--color-text-muted)' }}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                  <p style={{ color: 'var(--color-text-secondary)' }}>
                    No subscriptions found for this topic
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {(subscriptions || []).map((sub) => (
                    <div
                      key={sub.name}
                      className={`p-4 rounded-lg border transition-colors ${
                        onSelectSubscription ? 'cursor-pointer' : ''
                      }`}
                      style={{
                        backgroundColor: 'var(--color-bg-tertiary)',
                        borderColor: 'var(--color-border-primary)',
                        borderWidth: '1px',
                        borderStyle: 'solid',
                      }}
                      onMouseEnter={(e) => {
                        if (onSelectSubscription) {
                          e.currentTarget.style.borderColor = 'var(--color-border-secondary)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (onSelectSubscription) {
                          e.currentTarget.style.borderColor = 'var(--color-border-primary)';
                        }
                      }}
                      onClick={() => onSelectSubscription?.(sub)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h4
                              className="font-semibold"
                              style={{ color: 'var(--color-text-primary)' }}
                            >
                              {sub.displayName}
                            </h4>
                            <span
                              className="px-2 py-1 text-xs rounded font-medium"
                              style={{
                                backgroundColor: sub.subscriptionType === 'pull'
                                  ? 'color-mix(in srgb, var(--color-accent-primary) 20%, transparent)'
                                  : 'color-mix(in srgb, var(--color-accent-primary) 20%, transparent)',
                                color: sub.subscriptionType === 'pull'
                                  ? 'var(--color-accent-primary)'
                                  : 'var(--color-accent-primary)',
                                borderColor: 'var(--color-border-primary)',
                                borderWidth: '1px',
                                borderStyle: 'solid',
                              }}
                            >
                              {sub.subscriptionType === 'pull' ? 'Pull' : 'Push'}
                            </span>
                          </div>
                          <div
                            className="space-y-1 text-sm"
                            style={{ color: 'var(--color-text-secondary)' }}
                          >
                            <div className="flex items-center gap-2">
                              <span>Ack Deadline:</span>
                              <span style={{ color: 'var(--color-text-primary)' }}>
                                {sub.ackDeadline}s
                              </span>
                            </div>
                            {sub.filter && (
                              <div className="flex items-start gap-2">
                                <span>Filter:</span>
                                <code
                                  className="text-xs px-2 py-1 rounded break-all"
                                  style={{
                                    backgroundColor: 'var(--color-bg-code)',
                                    color: 'var(--color-text-primary)',
                                  }}
                                >
                                  {sub.filter}
                                </code>
                              </div>
                            )}
                            {sub.deadLetterPolicy && (
                              <div className="flex items-start gap-2">
                                <span>Dead Letter Topic:</span>
                                <code
                                  className="text-xs px-2 py-1 rounded break-all"
                                  style={{
                                    backgroundColor: 'var(--color-bg-code)',
                                    color: 'var(--color-text-primary)',
                                  }}
                                >
                                  {sub.deadLetterPolicy.deadLetterTopic.split('/').pop()}
                                </code>
                              </div>
                            )}
                            {sub.pushEndpoint && (
                              <div className="flex items-start gap-2">
                                <span>Endpoint:</span>
                                <code
                                  className="text-xs px-2 py-1 rounded break-all"
                                  style={{
                                    backgroundColor: 'var(--color-bg-code)',
                                    color: 'var(--color-text-primary)',
                                  }}
                                >
                                  {sub.pushEndpoint}
                                </code>
                              </div>
                            )}
                          </div>
                        </div>
                        {onSelectSubscription && (
                          <Button
                            variant="default"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelectSubscription(sub);
                            }}
                          >
                            View
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Dead Letter Tab */}
        {activeTab === 'deadLetter' && (
          <div className="space-y-6">
            {/* Used as Dead Letter Topic Section */}
            <div
              className="rounded-lg border"
              style={{
                backgroundColor: 'var(--color-bg-secondary)',
                borderColor: 'var(--color-border-primary)',
                borderWidth: '1px',
                borderStyle: 'solid',
              }}
            >
              <div
                className="px-6 py-4 border-b"
                style={{
                  borderBottomColor: 'var(--color-border-primary)',
                  borderBottomWidth: '1px',
                  borderBottomStyle: 'solid',
                }}
              >
                <h3
                  className="text-lg font-semibold"
                  style={{ color: 'var(--color-text-primary)' }}
                >
                  Used as Dead Letter Topic
                </h3>
                <p
                  className="text-sm mt-1"
                  style={{ color: 'var(--color-text-secondary)' }}
                >
                  Subscriptions that use this topic as their dead letter topic
                </p>
              </div>

              <div className="p-6">
                {loadingRelations ? (
                  <div className="flex items-center justify-center py-8">
                    <div style={{ color: 'var(--color-text-secondary)' }}>Loading...</div>
                  </div>
                ) : (deadLetterSubscriptions?.length ?? 0) === 0 ? (
                  <div className="text-center py-8">
                    <svg
                      className="w-12 h-12 mx-auto mb-4"
                      style={{ color: 'var(--color-text-muted)' }}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                    </svg>
                    <p style={{ color: 'var(--color-text-secondary)' }}>
                      No subscriptions use this topic as a dead letter topic
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {(deadLetterSubscriptions || []).map((sub) => (
                      <div
                        key={sub.name}
                        className={`p-4 rounded-lg border transition-colors ${
                          onSelectSubscription ? 'cursor-pointer' : ''
                        }`}
                        style={{
                          backgroundColor: 'var(--color-bg-tertiary)',
                          borderColor: 'var(--color-border-primary)',
                          borderWidth: '1px',
                          borderStyle: 'solid',
                        }}
                        onMouseEnter={(e) => {
                          if (onSelectSubscription) {
                            e.currentTarget.style.borderColor = 'var(--color-border-secondary)';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (onSelectSubscription) {
                            e.currentTarget.style.borderColor = 'var(--color-border-primary)';
                          }
                        }}
                        onClick={() => onSelectSubscription?.(sub)}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <h4
                                className="font-semibold"
                                style={{ color: 'var(--color-text-primary)' }}
                              >
                                {sub.displayName}
                              </h4>
                              <span
                                className="px-2 py-1 text-xs rounded font-medium"
                                style={{
                                  backgroundColor: 'color-mix(in srgb, var(--color-accent-primary) 20%, transparent)',
                                  color: 'var(--color-accent-primary)',
                                  borderColor: 'var(--color-border-primary)',
                                  borderWidth: '1px',
                                  borderStyle: 'solid',
                                }}
                              >
                                {sub.subscriptionType === 'pull' ? 'Pull' : 'Push'}
                              </span>
                            </div>
                            <div
                              className="space-y-1 text-sm"
                              style={{ color: 'var(--color-text-secondary)' }}
                            >
                              <div className="flex items-center gap-2">
                                <span>Topic:</span>
                                <code
                                  className="text-xs px-2 py-1 rounded"
                                  style={{
                                    backgroundColor: 'var(--color-bg-code)',
                                    color: 'var(--color-text-primary)',
                                  }}
                                >
                                  {sub.topic.split('/').pop()}
                                </code>
                              </div>
                              {sub.deadLetterPolicy && (
                                <div className="flex items-center gap-2">
                                  <span>Max Delivery Attempts:</span>
                                  <span style={{ color: 'var(--color-text-primary)' }}>
                                    {sub.deadLetterPolicy.maxDeliveryAttempts}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                          {onSelectSubscription && (
                            <Button
                              variant="default"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                onSelectSubscription(sub);
                              }}
                            >
                              View
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Dead Letter Topics Used Section */}
            <div
              className="rounded-lg border"
              style={{
                backgroundColor: 'var(--color-bg-secondary)',
                borderColor: 'var(--color-border-primary)',
                borderWidth: '1px',
                borderStyle: 'solid',
              }}
            >
              <div
                className="px-6 py-4 border-b"
                style={{
                  borderBottomColor: 'var(--color-border-primary)',
                  borderBottomWidth: '1px',
                  borderBottomStyle: 'solid',
                }}
              >
                <h3
                  className="text-lg font-semibold"
                  style={{ color: 'var(--color-text-primary)' }}
                >
                  Dead Letter Topics Used
                </h3>
                <p
                  className="text-sm mt-1"
                  style={{ color: 'var(--color-text-secondary)' }}
                >
                  Dead letter topics used by subscriptions subscribed to this topic
                </p>
              </div>

              <div className="p-6">
                {loadingRelations ? (
                  <div className="flex items-center justify-center py-8">
                    <div style={{ color: 'var(--color-text-secondary)' }}>Loading...</div>
                  </div>
                ) : (deadLetterTopics?.length ?? 0) === 0 ? (
                  <div className="text-center py-8">
                    <MessageSquare
                      className="w-12 h-12 mx-auto mb-4"
                      style={{ color: 'var(--color-text-muted)' }}
                    />
                    <p style={{ color: 'var(--color-text-secondary)' }}>
                      No dead letter topics are used by subscriptions subscribed to this topic
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {(deadLetterTopics || []).map((dlTopic) => (
                      <div
                        key={dlTopic.name}
                        className={`p-4 rounded-lg border transition-colors ${
                          onSelectTopic ? 'cursor-pointer' : ''
                        }`}
                        style={{
                          backgroundColor: 'var(--color-bg-tertiary)',
                          borderColor: 'var(--color-border-primary)',
                          borderWidth: '1px',
                          borderStyle: 'solid',
                        }}
                        onMouseEnter={(e) => {
                          if (onSelectTopic) {
                            e.currentTarget.style.borderColor = 'var(--color-border-secondary)';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (onSelectTopic) {
                            e.currentTarget.style.borderColor = 'var(--color-border-primary)';
                          }
                        }}
                        onClick={() => onSelectTopic?.(dlTopic)}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <MessageSquare
                                className="w-5 h-5"
                                style={{ color: 'var(--color-error)' }}
                              />
                              <h4
                                className="font-semibold"
                                style={{ color: 'var(--color-text-primary)' }}
                              >
                                {dlTopic.displayName}
                              </h4>
                            </div>
                            <div className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                              <code
                                className="text-xs px-2 py-1 rounded"
                                style={{
                                  backgroundColor: 'var(--color-bg-code)',
                                  color: 'var(--color-text-primary)',
                                }}
                              >
                                {dlTopic.name}
                              </code>
                            </div>
                          </div>
                          {onSelectTopic && (
                            <Button
                              variant="default"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                onSelectTopic(dlTopic);
                              }}
                            >
                              View
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Delete Confirmation Dialog */}
        {showDeleteDialog && onDelete && (
          <DeleteConfirmDialog
            open={showDeleteDialog}
            resourceType="topic"
            resourceName={topic.name}
            onConfirm={() => {
              onDelete(topic);
              setShowDeleteDialog(false);
            }}
            onCancel={() => setShowDeleteDialog(false)}
          />
        )}
      </div>
    </div>
  );
}
