import { useState } from 'react';
import StatusIndicator from './StatusIndicator';
import ConnectionDropdown from './ConnectionDropdown';
import type { Topic, Subscription, ConnectionStatus } from '../types';

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
  onOpenConfigEditor?: () => void;
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
  onOpenConfigEditor,
  profileRefreshTrigger,
  loading = false,
}: SidebarProps) {
  const [topicsExpanded, setTopicsExpanded] = useState(true);
  const [subscriptionsExpanded, setSubscriptionsExpanded] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [hoveredSubscription, setHoveredSubscription] = useState<string | null>(null);

  const filteredTopics = topics.filter((topic) =>
    topic.displayName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredSubscriptions = subscriptions.filter((sub) =>
    sub.displayName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getStatusType = (): 'connected' | 'disconnected' | 'connecting' | 'emulator' => {
    if (!status.isConnected) return 'disconnected';
    if (status.emulatorHost) return 'emulator';
    return 'connected';
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-slate-700">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-lg font-bold">Pub/Sub GUI</h1>
          {status.isConnected && (
            <button
              onClick={onDisconnect}
              className="text-xs text-slate-400 hover:text-slate-200 transition-colors"
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
      </div>

      {/* Search & Actions */}
      {status.isConnected && (
        <div className="p-4 border-b border-slate-700 space-y-2">
          <input
            type="text"
            placeholder="Search resources..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-md text-sm text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={onRefresh}
            disabled={loading}
            className="w-full px-3 py-2 bg-slate-700 hover:bg-slate-600 disabled:bg-slate-700 disabled:opacity-50 text-sm rounded-md transition-colors"
          >
            {loading ? 'Refreshing...' : 'Refresh Resources'}
          </button>
        </div>
      )}

      {/* Resource Tree */}
      {status.isConnected && (
        <div className="flex-1 overflow-y-auto">
          {/* Topics Section */}
          <div className="border-b border-slate-700">
            <div className="flex items-center">
              <button
                onClick={() => setTopicsExpanded(!topicsExpanded)}
                className="flex-1 px-4 py-3 flex items-center justify-between hover:bg-slate-700 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <svg
                    className={`w-4 h-4 transition-transform ${topicsExpanded ? 'rotate-90' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                  <span className="font-medium">Topics</span>
                </div>
                <span className="text-xs text-slate-400 bg-slate-700 px-2 py-1 rounded">
                  {filteredTopics.length}
                </span>
              </button>
              {onCreateTopic && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onCreateTopic();
                  }}
                  className="px-3 py-3 text-blue-400 hover:text-blue-300 transition-colors"
                  title="Create topic"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </button>
              )}
            </div>

            {topicsExpanded && (
              <div className="pb-2">
                {loading ? (
                  <div className="px-4 py-2 text-sm text-slate-400">Loading...</div>
                ) : filteredTopics.length === 0 ? (
                  <div className="px-4 py-2 text-sm text-slate-400">
                    {searchQuery ? 'No topics match your search' : 'No topics found'}
                  </div>
                ) : (
                  filteredTopics.map((topic) => (
                    <button
                      key={topic.name}
                      onClick={() => onSelectTopic(topic)}
                      className={`w-full px-4 py-2 text-left text-sm hover:bg-slate-700 transition-colors ${
                        selectedResource?.type === 'topic' && selectedResource?.id === topic.name
                          ? 'bg-blue-900 border-l-4 border-blue-500'
                          : ''
                      }`}
                    >
                      <div className="truncate">{topic.displayName}</div>
                      {topic.messageRetention && (
                        <div className="text-xs text-slate-400 truncate">
                          Retention: {topic.messageRetention}
                        </div>
                      )}
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Subscriptions Section */}
          <div>
            <div className="flex items-center">
              <button
                onClick={() => setSubscriptionsExpanded(!subscriptionsExpanded)}
                className="flex-1 px-4 py-3 flex items-center justify-between hover:bg-slate-700 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <svg
                    className={`w-4 h-4 transition-transform ${subscriptionsExpanded ? 'rotate-90' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                  <span className="font-medium">Subscriptions</span>
                </div>
                <span className="text-xs text-slate-400 bg-slate-700 px-2 py-1 rounded">
                  {filteredSubscriptions.length}
                </span>
              </button>
              {onCreateSubscription && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onCreateSubscription();
                  }}
                  className="px-3 py-3 text-blue-400 hover:text-blue-300 transition-colors"
                  title="Create subscription"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </button>
              )}
            </div>

            {subscriptionsExpanded && (
              <div className="pb-2">
                {loading ? (
                  <div className="px-4 py-2 text-sm text-slate-400">Loading...</div>
                ) : filteredSubscriptions.length === 0 ? (
                  <div className="px-4 py-2 text-sm text-slate-400">
                    {searchQuery ? 'No subscriptions match your search' : 'No subscriptions found'}
                  </div>
                ) : (
                  filteredSubscriptions.map((sub) => (
                    <div
                      key={sub.name}
                      className={`group relative ${
                        selectedResource?.type === 'subscription' && selectedResource?.id === sub.name
                          ? 'bg-blue-900 border-l-4 border-blue-500'
                          : ''
                      }`}
                      onMouseEnter={() => setHoveredSubscription(sub.name)}
                      onMouseLeave={() => setHoveredSubscription(null)}
                    >
                      <button
                        onClick={() => onSelectSubscription(sub)}
                        className="w-full px-4 py-2 text-left text-sm hover:bg-slate-700 transition-colors"
                      >
                        <div className="truncate">{sub.displayName}</div>
                        <div className="text-xs text-slate-400 truncate">
                          Topic: {sub.topic.split('/').pop()}
                        </div>
                      </button>
                      {onEditSubscription && hoveredSubscription === sub.name && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onEditSubscription(sub);
                          }}
                          className="absolute right-2 top-1/2 -translate-y-1/2 px-2 py-1 text-blue-400 hover:text-blue-300 hover:bg-blue-900/20 rounded transition-colors"
                          title="Edit subscription"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="p-4 border-t border-slate-700">
        <div className="flex items-center justify-between mb-2">
          <div className="text-xs text-slate-400">
            <p>Pub/Sub Desktop GUI</p>
            <p className="mt-1">Milestone 2: Resource Explorer</p>
          </div>
          {onOpenConfigEditor && (
            <button
              onClick={onOpenConfigEditor}
              className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-700 rounded transition-colors"
              title="Edit configuration file"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
