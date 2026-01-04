import { useState, useEffect } from 'react';
import './App.css';
import {
  ConnectWithADC,
  GetConnectionStatus,
  GetProfiles,
  Disconnect,
  ListTopics,
  ListSubscriptions
} from "../wailsjs/go/main/App";
import type { ConnectionProfile, ConnectionStatus, Topic, Subscription } from './types';

function App() {
  const [status, setStatus] = useState<ConnectionStatus>({ isConnected: false, projectId: '' });
  const [profiles, setProfiles] = useState<ConnectionProfile[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [projectId, setProjectId] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingResources, setLoadingResources] = useState(false);

  useEffect(() => {
    loadStatus();
    loadProfiles();
  }, []);

  const loadStatus = async () => {
    try {
      const s = await GetConnectionStatus();
      setStatus(s);

      // If connected, load resources
      if (s.isConnected) {
        loadResources();
      }
    } catch (e) {
      console.error('Failed to load status:', e);
    }
  };

  const loadProfiles = async () => {
    try {
      const p = await GetProfiles();
      setProfiles((p || []) as any);
    } catch (e) {
      console.error('Failed to load profiles:', e);
    }
  };

  const loadResources = async () => {
    setLoadingResources(true);
    setError('');

    try {
      const [topicsData, subsData] = await Promise.all([
        ListTopics(),
        ListSubscriptions()
      ]);

      setTopics(topicsData as any || []);
      setSubscriptions(subsData as any || []);
    } catch (e: any) {
      setError('Failed to load resources: ' + e.toString());
    } finally {
      setLoadingResources(false);
    }
  };

  const handleConnect = async () => {
    setError('');
    setLoading(true);

    try {
      await ConnectWithADC(projectId);
      await loadStatus();
      setProjectId('');
    } catch (e: any) {
      setError(e.toString());
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      await Disconnect();
      setTopics([]);
      setSubscriptions([]);
      await loadStatus();
    } catch (e: any) {
      setError(e.toString());
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Pub/Sub GUI - Milestone 2</h1>

        {/* Connection Status */}
        <div className="bg-slate-800 rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Connection Status</h2>
          <div className="space-y-2">
            <p>
              <span className="font-medium">Status:</span>{' '}
              <span className={status.isConnected ? 'text-green-400' : 'text-red-400'}>
                {status.isConnected ? 'Connected' : 'Disconnected'}
              </span>
            </p>
            {status.isConnected && (
              <>
                <p><span className="font-medium">Project ID:</span> {status.projectId}</p>
                {status.emulatorHost && (
                  <p><span className="font-medium">Emulator:</span> {status.emulatorHost}</p>
                )}
              </>
            )}
          </div>

          {status.isConnected && (
            <div className="flex gap-3 mt-4">
              <button
                onClick={handleDisconnect}
                className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded"
              >
                Disconnect
              </button>
              <button
                onClick={loadResources}
                disabled={loadingResources}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 text-white px-4 py-2 rounded"
              >
                {loadingResources ? 'Refreshing...' : 'Refresh Resources'}
              </button>
            </div>
          )}
        </div>

        {/* Connect Form */}
        {!status.isConnected && (
          <div className="bg-slate-800 rounded-lg p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">Connect with ADC</h2>
            <div className="space-y-4">
              <input
                type="text"
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                placeholder="Enter GCP Project ID"
                className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded text-white placeholder-slate-400"
              />
              <button
                onClick={handleConnect}
                disabled={!projectId || loading}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 text-white px-4 py-2 rounded"
              >
                {loading ? 'Connecting...' : 'Connect'}
              </button>
              {error && (
                <div className="bg-red-900/50 border border-red-700 rounded p-3 text-red-200">
                  {error}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Resources (shown when connected) */}
        {status.isConnected && (
          <div className="grid grid-cols-2 gap-6">
            {/* Topics */}
            <div className="bg-slate-800 rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4">Topics ({topics.length})</h2>
              {loadingResources ? (
                <p className="text-slate-400">Loading topics...</p>
              ) : topics.length === 0 ? (
                <p className="text-slate-400">No topics found</p>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {topics.map((topic) => (
                    <div key={topic.name} className="bg-slate-700 p-3 rounded">
                      <p className="font-medium">{topic.displayName}</p>
                      {topic.messageRetention && (
                        <p className="text-sm text-slate-400">
                          Retention: {topic.messageRetention}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Subscriptions */}
            <div className="bg-slate-800 rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4">Subscriptions ({subscriptions.length})</h2>
              {loadingResources ? (
                <p className="text-slate-400">Loading subscriptions...</p>
              ) : subscriptions.length === 0 ? (
                <p className="text-slate-400">No subscriptions found</p>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {subscriptions.map((sub) => (
                    <div key={sub.name} className="bg-slate-700 p-3 rounded">
                      <p className="font-medium">{sub.displayName}</p>
                      <p className="text-sm text-slate-400">
                        Topic: {sub.topic.split('/').pop()}
                      </p>
                      <p className="text-sm text-slate-400">
                        Ack Deadline: {sub.ackDeadline}s
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        <div className="mt-6 text-sm text-slate-400 text-center">
          <p>Milestone 2: Resource Explorer (Topics & Subscriptions)</p>
          <p className="mt-2">
            Backend: ✓ Admin API • ✓ List Topics • ✓ List Subscriptions
          </p>
        </div>
      </div>
    </div>
  );
}

export default App;
