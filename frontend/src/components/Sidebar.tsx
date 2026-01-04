import { useState } from 'react';
import StatusIndicator from './StatusIndicator';
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
  loading = false,
}: SidebarProps) {
  const [topicsExpanded, setTopicsExpanded] = useState(true);
  const [subscriptionsExpanded, setSubscriptionsExpanded] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

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
        <StatusIndicator status={getStatusType()} projectId={status.projectId} />
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
            <button
              onClick={() => setTopicsExpanded(!topicsExpanded)}
              className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-700 transition-colors"
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
            <button
              onClick={() => setSubscriptionsExpanded(!subscriptionsExpanded)}
              className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-700 transition-colors"
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
                    <button
                      key={sub.name}
                      onClick={() => onSelectSubscription(sub)}
                      className={`w-full px-4 py-2 text-left text-sm hover:bg-slate-700 transition-colors ${
                        selectedResource?.type === 'subscription' && selectedResource?.id === sub.name
                          ? 'bg-blue-900 border-l-4 border-blue-500'
                          : ''
                      }`}
                    >
                      <div className="truncate">{sub.displayName}</div>
                      <div className="text-xs text-slate-400 truncate">
                        Topic: {sub.topic.split('/').pop()}
                      </div>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="p-4 border-t border-slate-700 text-xs text-slate-400">
        <p>Pub/Sub Desktop GUI</p>
        <p className="mt-1">Milestone 2: Resource Explorer</p>
      </div>
    </div>
  );
}
