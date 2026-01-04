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
import Layout from './components/Layout';
import Sidebar from './components/Sidebar';
import ConnectionDialog from './components/ConnectionDialog';
import TopicDetails from './components/TopicDetails';
import SubscriptionDetails from './components/SubscriptionDetails';
import EmptyState from './components/EmptyState';

function App() {
  const [status, setStatus] = useState<ConnectionStatus>({ isConnected: false, projectId: '' });
  const [profiles, setProfiles] = useState<ConnectionProfile[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [selectedResource, setSelectedResource] = useState<{ type: 'topic' | 'subscription'; id: string } | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingResources, setLoadingResources] = useState(false);

  useEffect(() => {
    const initialize = async () => {
      const s = await loadStatus();
      await loadProfiles();

      // Open dialog automatically if not connected on startup
      if (s && !s.isConnected) {
        setDialogOpen(true);
      }
    };
    initialize();
  }, []);

  const loadStatus = async () => {
    try {
      const s = await GetConnectionStatus();
      setStatus(s);

      // If connected, load resources
      if (s.isConnected) {
        loadResources();
      } else {
        // Clear selection when disconnected
        setSelectedResource(null);
      }

      return s;
    } catch (e) {
      console.error('Failed to load status:', e);
      return null;
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

  const handleConnect = async (projectId: string) => {
    setError('');
    setLoading(true);

    try {
      await ConnectWithADC(projectId);
      await loadStatus();
    } catch (e: any) {
      setError(e.toString());
      throw e; // Re-throw so dialog can handle it
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      await Disconnect();
      setTopics([]);
      setSubscriptions([]);
      setSelectedResource(null);
      await loadStatus();
    } catch (e: any) {
      setError(e.toString());
    }
  };

  const handleSelectTopic = (topic: Topic) => {
    setSelectedResource({ type: 'topic', id: topic.name });
  };

  const handleSelectSubscription = (subscription: Subscription) => {
    setSelectedResource({ type: 'subscription', id: subscription.name });
  };

  const renderMainContent = () => {
    // Show connection dialog if not connected
    if (!status.isConnected) {
      return (
        <EmptyState
          icon={
            <svg className="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
            </svg>
          }
          title="Not Connected"
          description="Connect to a Google Cloud Pub/Sub project to start browsing topics and subscriptions."
          action={{
            label: 'Connect to Pub/Sub',
            onClick: () => setDialogOpen(true)
          }}
        />
      );
    }

    // Show resource details if one is selected
    if (selectedResource) {
      if (selectedResource.type === 'topic') {
        const topic = topics.find(t => t.name === selectedResource.id);
        if (topic) {
          return <TopicDetails topic={topic} />;
        }
      } else {
        const subscription = subscriptions.find(s => s.name === selectedResource.id);
        if (subscription) {
          return <SubscriptionDetails subscription={subscription} />;
        }
      }
    }

    // Show empty state when connected but no resource selected
    return (
      <EmptyState
        icon={
          <svg className="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        }
        title="Select a Resource"
        description="Choose a topic or subscription from the sidebar to view its details."
      />
    );
  };

  return (
    <>
      <Layout
        sidebar={
          <Sidebar
            status={status}
            topics={topics}
            subscriptions={subscriptions}
            selectedResource={selectedResource}
            onSelectTopic={handleSelectTopic}
            onSelectSubscription={handleSelectSubscription}
            onRefresh={loadResources}
            onDisconnect={handleDisconnect}
            loading={loadingResources}
          />
        }
      >
        {renderMainContent()}
      </Layout>

      <ConnectionDialog
        open={dialogOpen}
        onConnect={handleConnect}
        onClose={() => {
          setDialogOpen(false);
          setError('');
        }}
        error={error}
      />
    </>
  );
}

export default App;
