import { useState, useEffect, useRef } from 'react';
import './App.css';
import {
  ConnectWithADC,
  GetConnectionStatus,
  GetProfiles,
  Disconnect,
  ListTopics,
  ListSubscriptions,
  SwitchProfile,
  SaveProfile,
  CreateTopic,
  DeleteTopic,
  CreateSubscription,
  UpdateSubscription,
  DeleteSubscription,
  SyncResources
} from "../wailsjs/go/main/App";
import { EventsOn } from "../wailsjs/runtime/runtime";
import { main } from "../wailsjs/go/models";
import type { ConnectionProfile, ConnectionStatus, Topic, Subscription } from './types';
import { ThemeProvider } from './contexts/ThemeContext';
import Layout from './components/Layout';
import Sidebar from './components/Sidebar';
import ConnectionDialog from './components/ConnectionDialog';
import TopicDetails from './components/TopicDetails';
import SubscriptionDetails from './components/SubscriptionDetails';
import TopicCreateDialog from './components/TopicCreateDialog';
import SubscriptionDialog from './components/SubscriptionDialog';
import ConfigEditorDialog from './components/ConfigEditorDialog';
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
  const [profileRefreshTrigger, setProfileRefreshTrigger] = useState(0);
  const [showTopicCreateDialog, setShowTopicCreateDialog] = useState(false);
  const [showSubscriptionDialog, setShowSubscriptionDialog] = useState(false);
  const [subscriptionDialogMode, setSubscriptionDialogMode] = useState<'create' | 'edit'>('create');
  const [editingSubscription, setEditingSubscription] = useState<Subscription | null>(null);
  const [showConfigEditorDialog, setShowConfigEditorDialog] = useState(false);

  // Use ref to track selectedResource in event listeners without causing re-renders
  const selectedResourceRef = useRef(selectedResource);

  // Update ref when selectedResource changes
  useEffect(() => {
    selectedResourceRef.current = selectedResource;
  }, [selectedResource]);

  // Initialize on mount only
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

  // Set up event listeners once on mount
  useEffect(() => {
    // Listen for synchronized resource updates from backend
    const unsubscribeResourcesUpdated = EventsOn('resources:updated', (data: any) => {
      // Update state directly from synchronized data (only update what was successfully synced)
      // This allows partial updates - if topics fail but subscriptions succeed, we still update subscriptions
      if (data?.topics !== undefined) {
        setTopics(data.topics as Topic[] || []);
      }
      if (data?.subscriptions !== undefined) {
        setSubscriptions(data.subscriptions as Subscription[] || []);
      }
      setLoadingResources(false);
      // Don't clear error here - let it persist until user dismisses or new error occurs
    });

    // Listen for sync errors
    const unsubscribeSyncError = EventsOn('resources:sync-error', (data: any) => {
      const errors = data?.errors || {};
      const errorMessages: string[] = [];

      if (errors.topics) {
        errorMessages.push(`Failed to sync topics: ${errors.topics}`);
      }
      if (errors.subscriptions) {
        errorMessages.push(`Failed to sync subscriptions: ${errors.subscriptions}`);
      }

      if (errorMessages.length > 0) {
        const fullError = errorMessages.join('. ');
        setError(fullError);
        console.error('Resource sync error:', fullError);
      }
      setLoadingResources(false);
    });

    // Listen for resource change events from backend (for cleanup/UI updates)
    const unsubscribeTopicCreated = EventsOn('topic:created', () => {
      // Resources will be updated via resources:updated event
      // Just clear selection if needed
    });
    const unsubscribeTopicDeleted = EventsOn('topic:deleted', () => {
      // Clear selection if deleted topic was selected
      if (selectedResourceRef.current?.type === 'topic') {
        setSelectedResource(null);
      }
    });
    const unsubscribeSubscriptionUpdated = EventsOn('subscription:updated', () => {
      // Resources will be updated via resources:updated event
    });
    const unsubscribeSubscriptionCreated = EventsOn('subscription:created', () => {
      // Resources will be updated via resources:updated event
    });
    const unsubscribeSubscriptionDeleted = EventsOn('subscription:deleted', () => {
      // Clear selection if deleted subscription was selected
      if (selectedResourceRef.current?.type === 'subscription') {
        setSelectedResource(null);
      }
    });

    return () => {
      unsubscribeResourcesUpdated();
      unsubscribeSyncError();
      unsubscribeTopicCreated();
      unsubscribeTopicDeleted();
      unsubscribeSubscriptionUpdated();
      unsubscribeSubscriptionCreated();
      unsubscribeSubscriptionDeleted();
    };
  }, []); // Empty dependency array - only set up once

  const loadStatus = async () => {
    try {
      const s = await GetConnectionStatus();
      setStatus(s);

      // If connected, load resources
      if (s.isConnected) {
        await loadResources(); // Await to ensure resources load before continuing
      } else {
        // Clear resources when disconnected
        setTopics([]);
        setSubscriptions([]);
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
      // Trigger sync and then get cached resources
      await SyncResources();

      // Small delay to allow sync to complete
      await new Promise(resolve => setTimeout(resolve, 100));

      const [topicsData, subsData] = await Promise.all([
        ListTopics(),
        ListSubscriptions()
      ]);

      // Only set resources if we're still connected (prevent race conditions)
      const currentStatus = await GetConnectionStatus();
      if (currentStatus.isConnected) {
        setTopics(topicsData as any || []);
        setSubscriptions(subsData as any || []);
      }
    } catch (e: any) {
      setError('Failed to load resources: ' + e.toString());
      // Clear resources on error to prevent showing stale data
      setTopics([]);
      setSubscriptions([]);
    } finally {
      setLoadingResources(false);
    }
  };

  const handleConnect = async (projectId: string, saveAsProfile?: { name: string; isDefault?: boolean }) => {
    setError('');
    setLoading(true);

    try {
      await ConnectWithADC(projectId);
      await loadStatus();

      // Save as profile if requested
      if (saveAsProfile) {
        const profile: ConnectionProfile = {
          id: Date.now().toString(),
          name: saveAsProfile.name,
          projectId: projectId,
          authMethod: 'ADC',
          isDefault: saveAsProfile.isDefault || false,
          createdAt: new Date().toISOString(),
        };
        try {
          await SaveProfile(profile as any);
          await loadProfiles();
          setProfileRefreshTrigger(prev => prev + 1); // Trigger dropdown refresh
        } catch (e: any) {
          console.error('Failed to save profile:', e);
          // Don't fail the connection if profile save fails
        }
      }
    } catch (e: any) {
      setError(e.toString());
      throw e; // Re-throw so dialog can handle it
    } finally {
      setLoading(false);
    }
  };

  const handleProfileSwitch = async () => {
    // Clear current resources immediately to prevent showing stale data
    setTopics([]);
    setSubscriptions([]);
    setSelectedResource(null);
    setError('');
    setLoadingResources(true);

    try {
      // Reload status first to get the new connection state
      // This ensures we have the latest connection info
      const newStatus = await GetConnectionStatus();
      setStatus(newStatus);

      // If connected, reload resources for the new project
      if (newStatus.isConnected) {
        // Small delay to ensure backend connection is fully established
        await new Promise(resolve => setTimeout(resolve, 300));

        // Verify we're still connected before loading resources
        const verifyStatus = await GetConnectionStatus();
        if (verifyStatus.isConnected && verifyStatus.projectId === newStatus.projectId) {
          await loadResources();
        } else {
          console.warn('Connection changed during profile switch, skipping resource load');
        }
      }

      // Reload profiles to update active status
      await loadProfiles();
      setProfileRefreshTrigger(prev => prev + 1); // Trigger dropdown refresh
    } catch (e: any) {
      console.error('Failed to reload after profile switch:', e);
      setError('Failed to reload resources: ' + e.toString());
      // Ensure resources are cleared on error
      setTopics([]);
      setSubscriptions([]);
    } finally {
      setLoadingResources(false);
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

  const handleCreateTopic = async (topicID: string, messageRetentionDuration: string) => {
    try {
      await CreateTopic(topicID, messageRetentionDuration);
      await loadResources();
    } catch (e: any) {
      throw e;
    }
  };

  const handleDeleteTopic = async (topic: Topic) => {
    try {
      // Extract short topic ID from full name
      const topicID = topic.name.split('/').pop() || topic.name;
      await DeleteTopic(topicID);
      await loadResources();
      // Clear selection if deleted topic was selected
      if (selectedResource?.type === 'topic' && selectedResource?.id === topic.name) {
        setSelectedResource(null);
      }
    } catch (e: any) {
      setError('Failed to delete topic: ' + e.toString());
    }
  };

  const handleCreateSubscription = async (topicID: string, subID: string, params: any) => {
    try {
      // Extract short IDs
      const shortTopicID = topicID.split('/').pop() || topicID;
      const shortSubID = subID;

      // Create subscription with long TTL (10 years) for permanent subscriptions
      const ttlSeconds = 10 * 365 * 24 * 60 * 60; // 10 years in seconds
      await CreateSubscription(shortTopicID, shortSubID, ttlSeconds);

      // Update subscription with additional params if provided
      // Use short ID - UpdateSubscription will normalize it
      // Convert plain object to Wails-generated class instance
      if (Object.keys(params).length > 0) {
        const wailsParams = main.SubscriptionUpdateParams.createFrom(params);
        await UpdateSubscription(shortSubID, wailsParams);
      }

      await loadResources();
    } catch (e: any) {
      throw e;
    }
  };

  const handleUpdateSubscription = async (subID: string, params: any) => {
    try {
      // Convert plain object to Wails-generated class instance
      const wailsParams = main.SubscriptionUpdateParams.createFrom(params);
      await UpdateSubscription(subID, wailsParams);
      await loadResources();
    } catch (e: any) {
      throw e;
    }
  };

  const handleDeleteSubscription = async (subscription: Subscription) => {
    try {
      // Extract short subscription ID from full name
      const subID = subscription.name.split('/').pop() || subscription.name;
      await DeleteSubscription(subID);
      await loadResources();
      // Clear selection if deleted subscription was selected
      if (selectedResource?.type === 'subscription' && selectedResource?.id === subscription.name) {
        setSelectedResource(null);
      }
    } catch (e: any) {
      setError('Failed to delete subscription: ' + e.toString());
    }
  };

  const handleEditSubscription = (subscription: Subscription) => {
    setEditingSubscription(subscription);
    setSubscriptionDialogMode('edit');
    setShowSubscriptionDialog(true);
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
          return (
            <TopicDetails
              topic={topic}
              allSubscriptions={subscriptions}
              allTopics={topics}
              onDelete={handleDeleteTopic}
              onSelectSubscription={handleSelectSubscription}
              onSelectTopic={handleSelectTopic}
            />
          );
        }
      } else {
        const subscription = subscriptions.find(s => s.name === selectedResource.id);
        if (subscription) {
          return (
            <SubscriptionDetails
              subscription={subscription}
              onEdit={handleEditSubscription}
              onDelete={handleDeleteSubscription}
            />
          );
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
    <ThemeProvider>
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
            onProfileSwitch={handleProfileSwitch}
            onCreateConnection={() => setDialogOpen(true)}
            onCreateTopic={() => setShowTopicCreateDialog(true)}
            onCreateSubscription={() => {
              setEditingSubscription(null);
              setSubscriptionDialogMode('create');
              setShowSubscriptionDialog(true);
            }}
            onEditSubscription={handleEditSubscription}
            onOpenConfigEditor={() => setShowConfigEditorDialog(true)}
            profileRefreshTrigger={profileRefreshTrigger}
            loading={loadingResources}
          />
        }
      >
        {/* Global Error Banner */}
        {error && (
          <div className="p-4 bg-red-900/20 border-b border-red-700/50">
            <div className="flex items-start gap-3 max-w-7xl mx-auto">
              <svg className="w-5 h-5 text-red-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="flex-1">
                <h4 className="text-sm font-semibold text-red-400 mb-1">Error</h4>
                <p className="text-sm text-red-300">{error}</p>
              </div>
              <button
                onClick={() => setError('')}
                className="text-red-400 hover:text-red-300 transition-colors"
                title="Dismiss error"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        )}
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

      <TopicCreateDialog
        open={showTopicCreateDialog}
        onClose={() => {
          setShowTopicCreateDialog(false);
          setError('');
        }}
        onCreate={handleCreateTopic}
        error={error}
      />

      <SubscriptionDialog
        open={showSubscriptionDialog}
        mode={subscriptionDialogMode}
        topics={topics}
        subscription={editingSubscription || undefined}
        onClose={() => {
          setShowSubscriptionDialog(false);
          setEditingSubscription(null);
          setError('');
        }}
        onCreate={handleCreateSubscription}
        onUpdate={handleUpdateSubscription}
        error={error}
      />

      <ConfigEditorDialog
        open={showConfigEditorDialog}
        onClose={() => {
          setShowConfigEditorDialog(false);
          setError('');
        }}
        error={error}
      />
    </ThemeProvider>
  );
}

export default App;
