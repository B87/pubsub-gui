import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import type { Topic, Subscription, MessageTemplate, PublishResult, PubSubMessage } from '../types';
import { GetTemplates, PublishMessage, SaveTemplate, StartTopicMonitor, StopTopicMonitor, GetBufferedMessages, ClearMessageBuffer, GetAutoAck, SetAutoAck } from '../../wailsjs/go/main/App';
import { EventsOn } from '../../wailsjs/runtime/runtime';
import TemplateManager from './TemplateManager';
import TopicMonitor from './TopicMonitor';
import DeleteConfirmDialog from './DeleteConfirmDialog';
import JsonEditor from './JsonEditor';
import { useKeyboardShortcuts, isInputFocused, formatShortcut } from '../hooks/useKeyboardShortcuts';
import { Alert, AlertTitle, AlertDescription } from './ui';

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
    <div className="p-8">
      <div className="w-full">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <svg className="w-8 h-8 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
            </svg>
            <div>
              <h2 className="text-2xl font-bold">{topic.displayName}</h2>
              <p className="text-sm text-slate-400">Topic</p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="mb-6 border-b border-slate-700">
          <div className="flex gap-4">
            <button
              onClick={() => setActiveTab('metadata')}
              className={`px-4 py-2 font-medium transition-colors ${
                activeTab === 'metadata'
                  ? 'text-blue-400 border-b-2 border-blue-400'
                  : 'text-slate-400 hover:text-slate-300'
              }`}
            >
              Metadata
            </button>
            <button
              onClick={() => setActiveTab('publish')}
              className={`px-4 py-2 font-medium transition-colors ${
                activeTab === 'publish'
                  ? 'text-blue-400 border-b-2 border-blue-400'
                  : 'text-slate-400 hover:text-slate-300'
              }`}
            >
              Publish
            </button>
            <button
              onClick={() => setActiveTab('monitor')}
              className={`px-4 py-2 font-medium transition-colors ${
                activeTab === 'monitor'
                  ? 'text-blue-400 border-b-2 border-blue-400'
                  : 'text-slate-400 hover:text-slate-300'
              }`}
            >
              Monitor
            </button>
            <button
              onClick={() => setActiveTab('subscriptions')}
              className={`px-4 py-2 font-medium transition-colors relative ${
                activeTab === 'subscriptions'
                  ? 'text-blue-400 border-b-2 border-blue-400'
                  : 'text-slate-400 hover:text-slate-300'
              }`}
            >
              Subscriptions
              {(subscriptions?.length ?? 0) > 0 && (
                <span className="ml-2 px-2 py-0.5 text-xs bg-blue-600 rounded-full">
                  {subscriptions?.length ?? 0}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('deadLetter')}
              className={`px-4 py-2 font-medium transition-colors relative ${
                activeTab === 'deadLetter'
                  ? 'text-blue-400 border-b-2 border-blue-400'
                  : 'text-slate-400 hover:text-slate-300'
              }`}
            >
              Dead Letter
              {((deadLetterSubscriptions?.length ?? 0) > 0 || (deadLetterTopics?.length ?? 0) > 0) && (
                <span className="ml-2 px-2 py-0.5 text-xs bg-blue-600 rounded-full">
                  {(deadLetterSubscriptions?.length ?? 0) + (deadLetterTopics?.length ?? 0)}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Metadata Tab */}
        {activeTab === 'metadata' && (
          <div className="bg-slate-800 rounded-lg border border-slate-700">
            <div className="px-6 py-4 border-b border-slate-700 flex items-center justify-between">
              <h3 className="text-lg font-semibold">Metadata</h3>
              {onDelete && (
                <button
                  onClick={() => setShowDeleteDialog(true)}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded text-sm transition-colors"
                >
                  Delete Topic
                </button>
              )}
            </div>

            <div className="p-6 space-y-4">
              {/* Full Name */}
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">
                  Full Resource Name
                </label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 px-3 py-2 bg-slate-900 rounded text-sm font-mono overflow-x-auto">
                    {topic.name}
                  </code>
                  <button
                    onClick={() => copyToClipboard(topic.name)}
                    className="px-3 py-2 bg-slate-700 hover:bg-slate-600 rounded text-sm transition-colors"
                    title="Copy to clipboard"
                  >
                    Copy
                  </button>
                </div>
              </div>

              {/* Display Name */}
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">
                  Display Name
                </label>
                <p className="px-3 py-2 bg-slate-900 rounded">{topic.displayName}</p>
              </div>

              {/* Message Retention */}
              {topic.messageRetention && (
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1">
                    Message Retention Duration
                  </label>
                  <p className="px-3 py-2 bg-slate-900 rounded">{topic.messageRetention}</p>
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
              <label className="block text-sm font-medium text-slate-400 mb-2">
                Template (Optional)
              </label>
              <select
                value={selectedTemplateId}
                onChange={(e) => handleTemplateSelect(e.target.value)}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">No template</option>
                {templates.map(t => (
                  <option key={t.id} value={t.id}>
                    {t.name} {t.topicId ? '(Topic-specific)' : '(Global)'}
                  </option>
                ))}
              </select>
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
                <label className="block text-sm font-medium text-slate-400">
                  Attributes
                </label>
                <button
                  onClick={addAttribute}
                  className="px-3 py-1 text-sm bg-slate-700 hover:bg-slate-600 rounded transition-colors"
                >
                  + Add
                </button>
              </div>
              <div className="space-y-2">
                {attributes.map((attr, index) => (
                  <div key={index} className="flex gap-2">
                    <input
                      type="text"
                      value={attr.key}
                      onChange={(e) => handleAttributeChange(index, 'key', e.target.value)}
                      placeholder="Key"
                      className="flex-1 px-3 py-2 bg-slate-900 border border-slate-700 rounded text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <input
                      type="text"
                      value={attr.value}
                      onChange={(e) => handleAttributeChange(index, 'value', e.target.value)}
                      placeholder="Value"
                      className="flex-1 px-3 py-2 bg-slate-900 border border-slate-700 rounded text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      onClick={() => removeAttribute(index)}
                      disabled={attributes.length === 1}
                      className="px-3 py-2 bg-red-600 hover:bg-red-700 disabled:bg-slate-700 disabled:cursor-not-allowed rounded transition-colors"
                    >
                      Remove
                    </button>
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
              <button
                onClick={handlePublish}
                disabled={isPublishing || !payload.trim()}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 disabled:cursor-not-allowed rounded font-medium transition-colors"
                title={isPublishing ? 'Publishing...' : `Publish message (${formatShortcut({ key: 'Enter', ctrlOrCmd: true })})`}
              >
                {isPublishing ? 'Publishing...' : 'Publish'}
              </button>
              <button
                onClick={() => setShowSaveTemplateDialog(true)}
                disabled={!payload.trim()}
                className="px-6 py-2 bg-slate-700 hover:bg-slate-600 disabled:bg-slate-800 disabled:cursor-not-allowed rounded font-medium transition-colors"
              >
                Save as Template
              </button>
              <button
                onClick={() => setShowTemplateManager(true)}
                className="px-6 py-2 bg-slate-700 hover:bg-slate-600 rounded font-medium transition-colors"
              >
                Manage Templates
              </button>
            </div>

            {/* Save Template Dialog */}
            {showSaveTemplateDialog && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                <div className="bg-slate-800 border border-slate-700 rounded-lg p-6 max-w-md w-full mx-4">
                  <h3 className="text-lg font-semibold mb-4">Save as Template</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-400 mb-2">
                        Template Name *
                      </label>
                      <input
                        type="text"
                        value={templateName}
                        onChange={(e) => setTemplateName(e.target.value)}
                        placeholder="e.g., User Signup Event"
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        autoFocus
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
                      <label htmlFor="linkToTopic" className="text-sm text-slate-400">
                        Link to this topic
                      </label>
                    </div>
                    <div className="flex gap-3 justify-end">
                      <button
                        onClick={() => {
                          setShowSaveTemplateDialog(false);
                          setTemplateName('');
                          setLinkToTopic(false);
                        }}
                        className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleSaveTemplate}
                        disabled={!templateName.trim()}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 disabled:cursor-not-allowed rounded transition-colors"
                      >
                        Save
                      </button>
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
        )}

        {/* Subscriptions Tab */}
        {activeTab === 'subscriptions' && (
          <div className="bg-slate-800 rounded-lg border border-slate-700">
            <div className="px-6 py-4 border-b border-slate-700">
              <h3 className="text-lg font-semibold">Subscriptions</h3>
              <p className="text-sm text-slate-400 mt-1">Subscriptions subscribed to this topic</p>
            </div>

            <div className="p-6">
              {loadingRelations ? (
                <div className="flex items-center justify-center py-8">
                  <div className="text-slate-400">Loading subscriptions...</div>
                </div>
              ) : relationsError ? (
                <Alert variant="destructive">
                  <AlertDescription>{relationsError}</AlertDescription>
                </Alert>
              ) : (subscriptions?.length ?? 0) === 0 ? (
                <div className="text-center py-8">
                  <svg className="w-12 h-12 mx-auto text-slate-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                  <p className="text-slate-400">No subscriptions found for this topic</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {(subscriptions || []).map((sub) => (
                    <div
                      key={sub.name}
                      className={`p-4 bg-slate-900 rounded-lg border border-slate-700 hover:border-slate-600 transition-colors ${
                        onSelectSubscription ? 'cursor-pointer' : ''
                      }`}
                      onClick={() => onSelectSubscription?.(sub)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h4 className="font-semibold text-slate-200">{sub.displayName}</h4>
                            <span className={`px-2 py-1 text-xs rounded font-medium ${
                              sub.subscriptionType === 'pull'
                                ? 'bg-blue-900/50 text-blue-300 border border-blue-700'
                                : 'bg-purple-900/50 text-purple-300 border border-purple-700'
                            }`}>
                              {sub.subscriptionType === 'pull' ? 'Pull' : 'Push'}
                            </span>
                          </div>
                          <div className="space-y-1 text-sm text-slate-400">
                            <div className="flex items-center gap-2">
                              <span>Ack Deadline:</span>
                              <span className="text-slate-300">{sub.ackDeadline}s</span>
                            </div>
                            {sub.filter && (
                              <div className="flex items-start gap-2">
                                <span>Filter:</span>
                                <code className="text-xs bg-slate-800 px-2 py-1 rounded text-slate-300 break-all">
                                  {sub.filter}
                                </code>
                              </div>
                            )}
                            {sub.deadLetterPolicy && (
                              <div className="flex items-start gap-2">
                                <span>Dead Letter Topic:</span>
                                <code className="text-xs bg-slate-800 px-2 py-1 rounded text-slate-300 break-all">
                                  {sub.deadLetterPolicy.deadLetterTopic.split('/').pop()}
                                </code>
                              </div>
                            )}
                            {sub.pushEndpoint && (
                              <div className="flex items-start gap-2">
                                <span>Endpoint:</span>
                                <code className="text-xs bg-slate-800 px-2 py-1 rounded text-slate-300 break-all">
                                  {sub.pushEndpoint}
                                </code>
                              </div>
                            )}
                          </div>
                        </div>
                        {onSelectSubscription && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelectSubscription(sub);
                            }}
                            className="px-3 py-1 text-sm bg-blue-600 hover:bg-blue-700 rounded transition-colors"
                          >
                            View
                          </button>
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
            <div className="bg-slate-800 rounded-lg border border-slate-700">
              <div className="px-6 py-4 border-b border-slate-700">
                <h3 className="text-lg font-semibold">Used as Dead Letter Topic</h3>
                <p className="text-sm text-slate-400 mt-1">Subscriptions that use this topic as their dead letter topic</p>
              </div>

              <div className="p-6">
                {loadingRelations ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="text-slate-400">Loading...</div>
                  </div>
                ) : (deadLetterSubscriptions?.length ?? 0) === 0 ? (
                  <div className="text-center py-8">
                    <svg className="w-12 h-12 mx-auto text-slate-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                    </svg>
                    <p className="text-slate-400">No subscriptions use this topic as a dead letter topic</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {(deadLetterSubscriptions || []).map((sub) => (
                      <div
                        key={sub.name}
                        className={`p-4 bg-slate-900 rounded-lg border border-slate-700 hover:border-slate-600 transition-colors ${
                          onSelectSubscription ? 'cursor-pointer' : ''
                        }`}
                        onClick={() => onSelectSubscription?.(sub)}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <h4 className="font-semibold text-slate-200">{sub.displayName}</h4>
                              <span className={`px-2 py-1 text-xs rounded font-medium ${
                                sub.subscriptionType === 'pull'
                                  ? 'bg-blue-900/50 text-blue-300 border border-blue-700'
                                  : 'bg-purple-900/50 text-purple-300 border border-purple-700'
                              }`}>
                                {sub.subscriptionType === 'pull' ? 'Pull' : 'Push'}
                              </span>
                            </div>
                            <div className="space-y-1 text-sm text-slate-400">
                              <div className="flex items-center gap-2">
                                <span>Topic:</span>
                                <code className="text-xs bg-slate-800 px-2 py-1 rounded text-slate-300">
                                  {sub.topic.split('/').pop()}
                                </code>
                              </div>
                              {sub.deadLetterPolicy && (
                                <div className="flex items-center gap-2">
                                  <span>Max Delivery Attempts:</span>
                                  <span className="text-slate-300">{sub.deadLetterPolicy.maxDeliveryAttempts}</span>
                                </div>
                              )}
                            </div>
                          </div>
                          {onSelectSubscription && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onSelectSubscription(sub);
                              }}
                              className="px-3 py-1 text-sm bg-blue-600 hover:bg-blue-700 rounded transition-colors"
                            >
                              View
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Dead Letter Topics Used Section */}
            <div className="bg-slate-800 rounded-lg border border-slate-700">
              <div className="px-6 py-4 border-b border-slate-700">
                <h3 className="text-lg font-semibold">Dead Letter Topics Used</h3>
                <p className="text-sm text-slate-400 mt-1">Dead letter topics used by subscriptions subscribed to this topic</p>
              </div>

              <div className="p-6">
                {loadingRelations ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="text-slate-400">Loading...</div>
                  </div>
                ) : (deadLetterTopics?.length ?? 0) === 0 ? (
                  <div className="text-center py-8">
                    <svg className="w-12 h-12 mx-auto text-slate-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                    </svg>
                    <p className="text-slate-400">No dead letter topics are used by subscriptions subscribed to this topic</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {(deadLetterTopics || []).map((dlTopic) => (
                      <div
                        key={dlTopic.name}
                        className={`p-4 bg-slate-900 rounded-lg border border-slate-700 hover:border-slate-600 transition-colors ${
                          onSelectTopic ? 'cursor-pointer' : ''
                        }`}
                        onClick={() => onSelectTopic?.(dlTopic)}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                              </svg>
                              <h4 className="font-semibold text-slate-200">{dlTopic.displayName}</h4>
                            </div>
                            <div className="text-sm text-slate-400">
                              <code className="text-xs bg-slate-800 px-2 py-1 rounded text-slate-300">
                                {dlTopic.name}
                              </code>
                            </div>
                          </div>
                          {onSelectTopic && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onSelectTopic(dlTopic);
                              }}
                              className="px-3 py-1 text-sm bg-blue-600 hover:bg-blue-700 rounded transition-colors"
                            >
                              View
                            </button>
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
