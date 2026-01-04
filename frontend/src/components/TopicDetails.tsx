import { useState, useEffect, useRef } from 'react';
import type { Topic, MessageTemplate, PublishResult, PubSubMessage } from '../types';
import { GetTemplates, PublishMessage, SaveTemplate, StartTopicMonitor, StopTopicMonitor, GetBufferedMessages, ClearMessageBuffer, GetAutoAck, SetAutoAck } from '../../wailsjs/go/main/App';
import { EventsOn } from '../../wailsjs/runtime/runtime';
import TemplateManager from './TemplateManager';
import TopicMonitor from './TopicMonitor';

interface TopicDetailsProps {
  topic: Topic;
}

type Tab = 'metadata' | 'publish' | 'monitor';

interface Attribute {
  key: string;
  value: string;
}

export default function TopicDetails({ topic }: TopicDetailsProps) {
  const [activeTab, setActiveTab] = useState<Tab>('metadata');
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [payload, setPayload] = useState<string>('');
  const [attributes, setAttributes] = useState<Attribute[]>([{ key: '', value: '' }]);
  const [jsonError, setJsonError] = useState<string>('');
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
  const monitoringRef = useRef<{ started: boolean, starting: boolean }>({ started: false, starting: false });

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
    monitoringRef.current = { started: false, starting: false };
  }, [topic.name]);

  // Start monitoring when topic is selected, stop when topic changes
  useEffect(() => {
    const startMonitoring = async () => {
      if (monitoringRef.current.starting || monitoringRef.current.started) return;
      monitoringRef.current.starting = true;

      try {
        await StartTopicMonitor(topic.name);
      } catch (err) {
        console.error('Failed to start monitoring:', err);
        monitoringRef.current.starting = false;
      }
    };

    startMonitoring();

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
      // Check if this is our temporary subscription
      if (data.subscriptionID.startsWith('ps-gui-mon-')) {
        setTempSubId(data.subscriptionID);
        setIsMonitoring(true);
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
      }
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

  const loadTemplates = async () => {
    try {
      const t = await GetTemplates(topic.name);
      setTemplates(t as MessageTemplate[]);
    } catch (e) {
      console.error('Failed to load templates:', e);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const validateJSON = (text: string): boolean => {
    if (!text.trim()) {
      setJsonError('');
      return true;
    }
    try {
      JSON.parse(text);
      setJsonError('');
      return true;
    } catch (e) {
      setJsonError('Invalid JSON format');
      return false;
    }
  };

  const handlePayloadChange = (value: string) => {
    setPayload(value);
    validateJSON(value);
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
      validateJSON(template.payload);
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

  return (
    <div className="p-8">
      <div className="max-w-4xl">
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
          </div>
        </div>

        {/* Metadata Tab */}
        {activeTab === 'metadata' && (
          <div className="bg-slate-800 rounded-lg border border-slate-700">
            <div className="px-6 py-4 border-b border-slate-700">
              <h3 className="text-lg font-semibold">Metadata</h3>
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
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-slate-400">
                  Payload
                </label>
                {jsonError && (
                  <span className="text-sm text-red-400">{jsonError}</span>
                )}
              </div>
              <textarea
                value={payload}
                onChange={(e) => handlePayloadChange(e.target.value)}
                rows={10}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded text-slate-200 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
                placeholder="Enter message payload (JSON or plain text)..."
              />
            </div>

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
              <div className="p-4 bg-red-900/20 border border-red-700 rounded text-red-400">
                {error}
              </div>
            )}

            {/* Success Display */}
            {publishResult && (
              <div className="p-4 bg-green-900/20 border border-green-700 rounded">
                <p className="text-green-400 font-semibold mb-2">Message published successfully!</p>
                <div className="space-y-1 text-sm text-green-300">
                  <p>Message ID: <code className="bg-slate-900 px-2 py-1 rounded">{publishResult.messageId}</code></p>
                  <p>Published at: {new Date(publishResult.timestamp).toLocaleString()}</p>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3">
              <button
                onClick={handlePublish}
                disabled={isPublishing || !payload.trim()}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 disabled:cursor-not-allowed rounded font-medium transition-colors"
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
            onClearBuffer={handleClearMonitoringBuffer}
            onToggleAutoAck={handleToggleAutoAck}
          />
        )}
      </div>
    </div>
  );
}
