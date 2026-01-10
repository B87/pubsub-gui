import { useState, useEffect } from 'react';
import { Search, RefreshCw, Plus, Settings, ChevronRight, Edit2 } from 'lucide-react';
import { cn } from '../lib/utils';
import ConnectionDropdown from './ConnectionDropdown';
import { Input } from './ui';
import type { Topic, Subscription, ConnectionStatus } from '../types';
import { GetVersion } from '../../wailsjs/go/main/App';
import appIcon from '../assets/images/appicon.png';

interface SidebarProps {
  status: ConnectionStatus;
  topics: Topic[];
  subscriptions: Subscription[];
  selectedResource: { type: 'topic' | 'subscription'; id: string } | null;
  onSelectTopic: (topic: Topic) => void;
  onSelectSubscription: (subscription: Subscription) => void;
  onRefresh: () => void;
  onDisconnect: () => void;
  onProfileSwitch: () => void;
  onCreateConnection: () => void;
  onCreateTopic?: () => void;
  onCreateSubscription?: () => void;
  onEditSubscription?: (subscription: Subscription) => void;
  onOpenSettings?: () => void;
  onToggleEmulator?: () => void;
  profileRefreshTrigger?: number;
  loading?: boolean;
}

export default function Sidebar({
  status,
  topics,
  subscriptions,
  selectedResource,
  onSelectTopic,
  onSelectSubscription,
  onRefresh,
  onDisconnect,
  onProfileSwitch,
  onCreateConnection,
  onCreateTopic,
  onCreateSubscription,
  onEditSubscription,
  onOpenSettings,
  onToggleEmulator,
  profileRefreshTrigger,
  loading = false,
}: SidebarProps) {
  const [topicsExpanded, setTopicsExpanded] = useState(true);
  const [subscriptionsExpanded, setSubscriptionsExpanded] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [hoveredSubscription, setHoveredSubscription] = useState<string | null>(null);
  const [version, setVersion] = useState<string>('');

  // Fetch version on component mount
  useEffect(() => {
    const fetchVersion = async () => {
      try {
        const v = await GetVersion();
        setVersion(v || 'dev');
      } catch (error) {
        console.error('Failed to fetch version:', error);
        setVersion('dev');
      }
    };
    fetchVersion();
  }, []);

  const filteredTopics = topics.filter((topic) =>
    topic.displayName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredSubscriptions = subscriptions.filter((sub) =>
    sub.displayName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div
      className="flex flex-col h-full"
      style={{ backgroundColor: 'var(--color-bg-secondary)' }}
    >
      {/* Header */}
      <div
        className="p-4 border-b"
        style={{
          borderBottomColor: 'var(--color-border-primary)',
          borderBottomWidth: '1px',
          borderBottomStyle: 'solid',
        }}
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="h-12 w-12 flex items-center justify-center shrink-0">
              <img
                src={appIcon}
                alt="Pub/Sub GUI"
                className="h-full w-auto object-contain"
              />
            </div>
            <h1
              className="text-lg font-semibold"
              style={{ color: 'var(--color-text-primary)' }}
            >
              Pub/Sub GUI
            </h1>
          </div>
          {status.isConnected && (
            <button
              onClick={onDisconnect}
              className="text-xs transition-colors"
              style={{ color: 'var(--color-text-secondary)' }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = 'var(--color-text-primary)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = 'var(--color-text-secondary)';
              }}
              title="Disconnect"
            >
              Disconnect
            </button>
          )}
        </div>
        <ConnectionDropdown
          currentProjectId={status.projectId}
          isConnected={status.isConnected}
          onProfileSwitch={onProfileSwitch}
          onCreateNew={onCreateConnection}
          refreshTrigger={profileRefreshTrigger}
        />
        {/* Emulator Toggle Button */}
        {status.isConnected && onToggleEmulator && (
          <div className="mt-3 flex items-center gap-2">
            <button
              onClick={onToggleEmulator}
              disabled={loading}
              className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm rounded-md transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-80"
              style={{
                backgroundColor: status.emulatorHost ? 'var(--color-warning-bg)' : 'var(--color-bg-tertiary)',
                borderColor: status.emulatorHost ? 'var(--color-warning-border)' : 'var(--color-border-primary)',
                color: status.emulatorHost ? 'var(--color-warning)' : 'var(--color-text-secondary)',
                borderWidth: '1px',
                borderStyle: 'solid',
              }}
              title={status.emulatorHost ? 'Disable emulator (switch to production)' : 'Enable emulator (switch to local)'}
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                {status.emulatorHost ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                )}
              </svg>
              <span className="font-medium">
                {status.emulatorHost ? 'Emulator ON' : 'Emulator OFF'}
              </span>
            </button>
          </div>
        )}
      </div>

      {/* Search & Actions */}
      {status.isConnected && (
        <div
          className="p-4 border-b space-y-2"
          style={{
            borderBottomColor: 'var(--color-border-primary)',
            borderBottomWidth: '1px',
            borderBottomStyle: 'solid',
          }}
        >
          <div className="relative">
            <Search
              className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5"
              style={{ color: 'var(--color-text-secondary)' }}
            />
            <Input
              type="text"
              placeholder="Search resources..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 h-8 text-sm"
              style={{
                backgroundColor: 'var(--color-bg-tertiary)',
                borderColor: 'var(--color-border-primary)',
              }}
            />
          </div>
          <button
            onClick={onRefresh}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              backgroundColor: 'var(--color-bg-tertiary)',
              color: 'var(--color-text-primary)',
            }}
            onMouseEnter={(e) => {
              if (!loading) {
                e.currentTarget.style.backgroundColor = 'var(--color-bg-hover)';
              }
            }}
            onMouseLeave={(e) => {
              if (!loading) {
                e.currentTarget.style.backgroundColor = 'var(--color-bg-tertiary)';
              }
            }}
          >
            <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
            {loading ? 'Refreshing...' : 'Refresh Resources'}
          </button>
        </div>
      )}

      {/* Resource Tree */}
      {status.isConnected && (
        <div className="flex-1 overflow-y-auto">
          {/* Topics Section */}
          <div
            className="border-b"
            style={{
              borderBottomColor: 'var(--color-border-primary)',
              borderBottomWidth: '1px',
              borderBottomStyle: 'solid',
            }}
          >
            <div className="flex items-center">
              <button
                onClick={() => setTopicsExpanded(!topicsExpanded)}
                className="flex-1 px-4 py-3 flex items-center justify-between transition-colors"
                style={{ backgroundColor: 'transparent' }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--color-bg-hover)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                <div className="flex items-center gap-2">
                  <ChevronRight
                    className={cn(
                      'h-4 w-4 transition-transform',
                      topicsExpanded && 'rotate-90'
                    )}
                    style={{ color: 'var(--color-text-secondary)' }}
                  />
                  <span
                    className="font-medium"
                    style={{ color: 'var(--color-text-primary)' }}
                  >
                    Topics
                  </span>
                </div>
                <span
                  className="text-xs px-2 py-1 rounded"
                  style={{
                    backgroundColor: 'var(--color-bg-tertiary)',
                    color: 'var(--color-text-secondary)',
                  }}
                >
                  {filteredTopics.length}
                </span>
              </button>
              {onCreateTopic && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onCreateTopic();
                  }}
                  className="px-3 py-3 transition-colors"
                  style={{ color: 'var(--color-accent-primary)' }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = 'var(--color-accent-hover)';
                    e.currentTarget.style.backgroundColor = 'color-mix(in srgb, var(--color-accent-primary) 10%, transparent)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = 'var(--color-accent-primary)';
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                  title="Create topic"
                >
                  <Plus className="w-5 h-5" />
                </button>
              )}
            </div>

            {topicsExpanded && (
              <div className="pb-2">
                {loading ? (
                  <div
                    className="px-4 py-2 text-sm"
                    style={{ color: 'var(--color-text-muted)' }}
                  >
                    Loading...
                  </div>
                ) : filteredTopics.length === 0 ? (
                  <div
                    className="px-4 py-2 text-sm"
                    style={{ color: 'var(--color-text-muted)' }}
                  >
                    {searchQuery ? 'No topics match your search' : 'No topics found'}
                  </div>
                ) : (
                  filteredTopics.map((topic) => {
                    const isSelected =
                      selectedResource?.type === 'topic' &&
                      selectedResource?.id === topic.name;
                    return (
                      <button
                        key={topic.name}
                        onClick={() => onSelectTopic(topic)}
                        className="w-full px-4 py-2 text-left text-sm transition-colors"
                        style={{
                          backgroundColor: isSelected
                            ? 'color-mix(in srgb, var(--color-accent-primary) 15%, transparent)'
                            : 'transparent',
                          borderLeftWidth: isSelected ? '3px' : '0',
                          borderLeftStyle: 'solid',
                          borderLeftColor: isSelected
                            ? 'var(--color-accent-primary)'
                            : 'transparent',
                        }}
                        onMouseEnter={(e) => {
                          if (!isSelected) {
                            e.currentTarget.style.backgroundColor = 'var(--color-bg-hover)';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!isSelected) {
                            e.currentTarget.style.backgroundColor = 'transparent';
                          }
                        }}
                      >
                        <div
                          className="truncate"
                          style={{ color: 'var(--color-text-primary)' }}
                        >
                          {topic.displayName}
                        </div>
                        {topic.messageRetention && (
                          <div
                            className="text-xs truncate"
                            style={{ color: 'var(--color-text-secondary)' }}
                          >
                            Retention: {topic.messageRetention}
                          </div>
                        )}
                      </button>
                    );
                  })
                )}
              </div>
            )}
          </div>

          {/* Subscriptions Section */}
          <div>
            <div className="flex items-center">
              <button
                onClick={() => setSubscriptionsExpanded(!subscriptionsExpanded)}
                className="flex-1 px-4 py-3 flex items-center justify-between transition-colors"
                style={{ backgroundColor: 'transparent' }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--color-bg-hover)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                <div className="flex items-center gap-2">
                  <ChevronRight
                    className={cn(
                      'h-4 w-4 transition-transform',
                      subscriptionsExpanded && 'rotate-90'
                    )}
                    style={{ color: 'var(--color-text-secondary)' }}
                  />
                  <span
                    className="font-medium"
                    style={{ color: 'var(--color-text-primary)' }}
                  >
                    Subscriptions
                  </span>
                </div>
                <span
                  className="text-xs px-2 py-1 rounded"
                  style={{
                    backgroundColor: 'var(--color-bg-tertiary)',
                    color: 'var(--color-text-secondary)',
                  }}
                >
                  {filteredSubscriptions.length}
                </span>
              </button>
              {onCreateSubscription && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onCreateSubscription();
                  }}
                  className="px-3 py-3 transition-colors"
                  style={{ color: 'var(--color-accent-primary)' }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = 'var(--color-accent-hover)';
                    e.currentTarget.style.backgroundColor = 'color-mix(in srgb, var(--color-accent-primary) 10%, transparent)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = 'var(--color-accent-primary)';
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                  title="Create subscription"
                >
                  <Plus className="w-5 h-5" />
                </button>
              )}
            </div>

            {subscriptionsExpanded && (
              <div className="pb-2">
                {loading ? (
                  <div
                    className="px-4 py-2 text-sm"
                    style={{ color: 'var(--color-text-muted)' }}
                  >
                    Loading...
                  </div>
                ) : filteredSubscriptions.length === 0 ? (
                  <div
                    className="px-4 py-2 text-sm"
                    style={{ color: 'var(--color-text-muted)' }}
                  >
                    {searchQuery
                      ? 'No subscriptions match your search'
                      : 'No subscriptions found'}
                  </div>
                ) : (
                  filteredSubscriptions.map((sub) => {
                    const isSelected =
                      selectedResource?.type === 'subscription' &&
                      selectedResource?.id === sub.name;
                    return (
                      <div
                        key={sub.name}
                        className="group relative"
                        style={{
                          backgroundColor: isSelected
                            ? 'color-mix(in srgb, var(--color-accent-primary) 15%, transparent)'
                            : 'transparent',
                          borderLeftWidth: isSelected ? '3px' : '0',
                          borderLeftStyle: 'solid',
                          borderLeftColor: isSelected
                            ? 'var(--color-accent-primary)'
                            : 'transparent',
                        }}
                        onMouseEnter={() => setHoveredSubscription(sub.name)}
                        onMouseLeave={() => setHoveredSubscription(null)}
                      >
                        <button
                          onClick={() => onSelectSubscription(sub)}
                          className="w-full px-4 py-2 text-left text-sm transition-colors"
                          style={{ backgroundColor: 'transparent' }}
                          onMouseEnter={(e) => {
                            if (!isSelected) {
                              e.currentTarget.style.backgroundColor = 'var(--color-bg-hover)';
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (!isSelected) {
                              e.currentTarget.style.backgroundColor = 'transparent';
                            }
                          }}
                        >
                          <div
                            className="truncate"
                            style={{ color: 'var(--color-text-primary)' }}
                          >
                            {sub.displayName}
                          </div>
                          <div
                            className="text-xs truncate"
                            style={{ color: 'var(--color-text-secondary)' }}
                          >
                            Topic: {sub.topic.split('/').pop()}
                          </div>
                        </button>
                        {onEditSubscription && hoveredSubscription === sub.name && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onEditSubscription(sub);
                            }}
                            className="absolute right-2 top-1/2 -translate-y-1/2 px-2 py-1 rounded transition-colors"
                            style={{
                              color: 'var(--color-accent-primary)',
                              backgroundColor: 'transparent',
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.color = 'var(--color-accent-hover)';
                              e.currentTarget.style.backgroundColor =
                                'color-mix(in srgb, var(--color-accent-primary) 20%, transparent)';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.color = 'var(--color-accent-primary)';
                              e.currentTarget.style.backgroundColor = 'transparent';
                            }}
                            title="Edit subscription"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Footer */}
      <div
        className="p-4 border-t"
        style={{
          borderTopColor: 'var(--color-border-primary)',
          borderTopWidth: '1px',
          borderTopStyle: 'solid',
        }}
      >
        <div className="flex items-center justify-between mb-2">
          <div className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
            <p>Pub/Sub Desktop GUI</p>
            {version && (
              <p className="mt-1" style={{ color: 'var(--color-text-muted)' }}>
                Version {version}
              </p>
            )}
          </div>
          {onOpenSettings && (
            <button
              onClick={onOpenSettings}
              className="p-2 rounded transition-colors"
              style={{
                color: 'var(--color-text-secondary)',
                backgroundColor: 'transparent',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = 'var(--color-text-primary)';
                e.currentTarget.style.backgroundColor = 'var(--color-bg-hover)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = 'var(--color-text-secondary)';
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
              title="Settings"
            >
              <Settings className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
