import { useState } from "react";
import * as Tabs from "@radix-ui/react-tabs";
import { Bell, Copy, Edit2, Trash2 } from "lucide-react";
import SubscriptionMonitor from "./SubscriptionMonitor";
import SnapshotManager from "./SnapshotManager";
import DeleteConfirmDialog from "./DeleteConfirmDialog";
import { Button } from "./ui";
import type { Subscription } from "../types";

interface SubscriptionDetailsProps {
  subscription: Subscription;
  onEdit?: (subscription: Subscription) => void;
  onDelete?: (subscription: Subscription) => void;
}

export default function SubscriptionDetails({
  subscription,
  onEdit,
  onDelete,
}: SubscriptionDetailsProps) {
  const [activeTab, setActiveTab] = useState("metadata");
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <div className="flex flex-col h-full p-8">
      <style>{`
        [data-state="active"] {
          color: var(--color-text-primary) !important;
          border-bottom-color: var(--color-accent-primary) !important;
        }
      `}</style>
      <Tabs.Root
        value={activeTab}
        onValueChange={setActiveTab}
        className="flex flex-col flex-1"
      >
        <div className="w-full">
            {/* Header */}
            <div className="mb-6">
              <div className="flex items-center gap-3 mb-2">
                <div
                  className="h-8 w-8 rounded flex items-center justify-center"
                  style={{ backgroundColor: 'var(--color-accent-primary)' }}
                >
                  <Bell className="h-5 w-5" style={{ color: 'white' }} />
                </div>
                <div>
                  <h2
                    className="text-2xl font-bold"
                    style={{ color: 'var(--color-text-primary)' }}
                  >
                    {subscription.displayName}
                  </h2>
                  <p
                    className="text-sm"
                    style={{ color: 'var(--color-text-secondary)' }}
                  >
                    Subscription
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
              <Tabs.List
                className="flex gap-4"
              >
              <Tabs.Trigger
                value="metadata"
                className="px-4 py-2 font-medium transition-colors relative"
                style={{
                  color: 'var(--color-text-secondary)',
                  borderBottomWidth: '2px',
                  borderBottomStyle: 'solid',
                  borderBottomColor: 'transparent',
                }}
                onMouseEnter={(e) => {
                  if (e.currentTarget.getAttribute('data-state') !== 'active') {
                    e.currentTarget.style.color = 'var(--color-text-primary)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (e.currentTarget.getAttribute('data-state') !== 'active') {
                    e.currentTarget.style.color = 'var(--color-text-secondary)';
                  }
                }}
              >
                Metadata
              </Tabs.Trigger>
              {subscription.subscriptionType === "pull" && (
                <Tabs.Trigger
                  value="monitor"
                  className="px-4 py-2 font-medium transition-colors relative"
                  style={{
                    color: 'var(--color-text-secondary)',
                    borderBottomWidth: '2px',
                    borderBottomStyle: 'solid',
                    borderBottomColor: 'transparent',
                  }}
                  onMouseEnter={(e) => {
                    if (e.currentTarget.getAttribute('data-state') !== 'active') {
                      e.currentTarget.style.color = 'var(--color-text-primary)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (e.currentTarget.getAttribute('data-state') !== 'active') {
                      e.currentTarget.style.color = 'var(--color-text-secondary)';
                    }
                  }}
                >
                  Monitor
                </Tabs.Trigger>
              )}
              {subscription.subscriptionType === "pull" && (
                <Tabs.Trigger
                  value="snapshots"
                  className="px-4 py-2 font-medium transition-colors relative"
                  style={{
                    color: 'var(--color-text-secondary)',
                    borderBottomWidth: '2px',
                    borderBottomStyle: 'solid',
                    borderBottomColor: 'transparent',
                  }}
                  onMouseEnter={(e) => {
                    if (e.currentTarget.getAttribute('data-state') !== 'active') {
                      e.currentTarget.style.color = 'var(--color-text-primary)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (e.currentTarget.getAttribute('data-state') !== 'active') {
                      e.currentTarget.style.color = 'var(--color-text-secondary)';
                    }
                  }}
                >
                  Snapshots
                </Tabs.Trigger>
              )}
              </Tabs.List>
            </div>
          </div>

        {/* Tab Content */}
        <Tabs.Content value="metadata" className="flex-1 overflow-auto">
          <div className="w-full">
              {/* Metadata Card */}
              <div
                className="rounded-lg border"
                style={{
                  backgroundColor: 'var(--color-bg-secondary)',
                  borderColor: 'var(--color-border-primary)',
                }}
              >
                <div
                  className="px-6 py-4 border-b flex items-center justify-between"
                  style={{ borderBottomColor: 'var(--color-border-primary)' }}
                >
                  <h3
                    className="text-lg font-semibold"
                    style={{ color: 'var(--color-text-primary)' }}
                  >
                    Metadata
                  </h3>
                  <div className="flex gap-2">
                    {onEdit && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onEdit(subscription)}
                      >
                        <Edit2 className="w-4 h-4 mr-1" />
                        Edit
                      </Button>
                    )}
                    {onDelete && (
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => setShowDeleteDialog(true)}
                      >
                        <Trash2 className="w-4 h-4 mr-1" />
                        Delete
                      </Button>
                    )}
                  </div>
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
                        {subscription.name}
                      </code>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copyToClipboard(subscription.name)}
                        title="Copy to clipboard"
                      >
                        <Copy className="w-4 h-4 mr-1" />
                        Copy
                      </Button>
                    </div>
                  </div>

                  {/* Topic */}
                  <div>
                    <label
                      className="block text-sm font-medium mb-1"
                      style={{ color: 'var(--color-text-secondary)' }}
                    >
                      Topic
                    </label>
                    <div className="flex items-center gap-2">
                      <code
                        className="flex-1 px-3 py-2 rounded text-sm font-mono overflow-x-auto"
                        style={{
                          backgroundColor: 'var(--color-bg-code)',
                          color: 'var(--color-text-primary)',
                        }}
                      >
                        {subscription.topic}
                      </code>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copyToClipboard(subscription.topic)}
                        title="Copy to clipboard"
                      >
                        <Copy className="w-4 h-4 mr-1" />
                        Copy
                      </Button>
                    </div>
                  </div>

                  {/* Subscription Type */}
                  <div>
                    <label
                      className="block text-sm font-medium mb-1"
                      style={{ color: 'var(--color-text-secondary)' }}
                    >
                      Subscription Type
                    </label>
                    <div className="flex items-center gap-2">
                      <span
                        className="px-3 py-2 rounded text-sm font-medium border"
                        style={{
                          backgroundColor:
                            subscription.subscriptionType === "pull"
                              ? 'color-mix(in srgb, var(--color-accent-primary) 15%, transparent)'
                              : 'color-mix(in srgb, var(--color-accent-primary) 15%, transparent)',
                          color: 'var(--color-accent-primary)',
                          borderColor: 'var(--color-accent-primary)',
                        }}
                      >
                        {subscription.subscriptionType === "pull"
                          ? "Pull"
                          : "Push"}
                      </span>
                      {subscription.subscriptionType === "push" &&
                        subscription.pushEndpoint && (
                          <div className="flex-1">
                            <span
                              className="text-xs mr-2"
                              style={{ color: 'var(--color-text-muted)' }}
                            >
                              Endpoint:
                            </span>
                            <code
                              className="px-3 py-2 rounded text-sm font-mono"
                              style={{
                                backgroundColor: 'var(--color-bg-code)',
                                color: 'var(--color-text-primary)',
                              }}
                            >
                              {subscription.pushEndpoint}
                            </code>
                          </div>
                        )}
                    </div>
                    {subscription.subscriptionType === "push" && (
                      <p
                        className="mt-2 text-xs"
                        style={{ color: 'var(--color-text-muted)' }}
                      >
                        Push subscriptions deliver messages via HTTP POST to an
                        endpoint. Monitoring is not available for push
                        subscriptions.
                      </p>
                    )}
                  </div>

                  {/* Ack Deadline */}
                  <div>
                    <label
                      className="block text-sm font-medium mb-1"
                      style={{ color: 'var(--color-text-secondary)' }}
                    >
                      Acknowledgement Deadline
                    </label>
                    <p
                      className="px-3 py-2 rounded"
                      style={{
                        backgroundColor: 'var(--color-bg-tertiary)',
                        color: 'var(--color-text-primary)',
                      }}
                    >
                      {subscription.ackDeadline} seconds
                    </p>
                  </div>

                  {/* Retention Duration */}
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
                        backgroundColor: 'var(--color-bg-tertiary)',
                        color: 'var(--color-text-primary)',
                      }}
                    >
                      {subscription.retentionDuration}
                    </p>
                  </div>

                  {/* Filter */}
                  {subscription.filter && (
                    <div>
                      <label
                        className="block text-sm font-medium mb-1"
                        style={{ color: 'var(--color-text-secondary)' }}
                      >
                        Filter Expression
                      </label>
                      <code
                        className="block px-3 py-2 rounded text-sm font-mono overflow-x-auto"
                        style={{
                          backgroundColor: 'var(--color-bg-code)',
                          color: 'var(--color-text-primary)',
                        }}
                      >
                        {subscription.filter}
                      </code>
                    </div>
                  )}

                  {/* Dead Letter Policy */}
                  {subscription.deadLetterPolicy && (
                    <div>
                      <label
                        className="block text-sm font-medium mb-2"
                        style={{ color: 'var(--color-text-secondary)' }}
                      >
                        Dead Letter Policy
                      </label>
                      <div
                        className="rounded p-4 space-y-2"
                        style={{ backgroundColor: 'var(--color-bg-tertiary)' }}
                      >
                        <div>
                          <span
                            className="text-sm"
                            style={{ color: 'var(--color-text-secondary)' }}
                          >
                            Dead Letter Topic:
                          </span>
                          <code
                            className="block text-sm font-mono mt-1"
                            style={{ color: 'var(--color-text-primary)' }}
                          >
                            {subscription.deadLetterPolicy.deadLetterTopic}
                          </code>
                        </div>
                        <div>
                          <span
                            className="text-sm"
                            style={{ color: 'var(--color-text-secondary)' }}
                          >
                            Max Delivery Attempts:
                          </span>
                          <p
                            className="text-sm mt-1"
                            style={{ color: 'var(--color-text-primary)' }}
                          >
                            {subscription.deadLetterPolicy.maxDeliveryAttempts}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
          </div>
        </Tabs.Content>

        {subscription.subscriptionType === "pull" && (
          <Tabs.Content value="monitor" className="flex-1 overflow-hidden">
            <SubscriptionMonitor subscription={subscription} />
          </Tabs.Content>
        )}

        {subscription.subscriptionType === "pull" && (
          <Tabs.Content value="snapshots" className="flex-1 overflow-auto">
            <SnapshotManager subscription={subscription} />
          </Tabs.Content>
        )}
      </Tabs.Root>

      {/* Delete Confirmation Dialog */}
      {showDeleteDialog && onDelete && (
        <DeleteConfirmDialog
          open={showDeleteDialog}
          resourceType="subscription"
          resourceName={subscription.name}
          onConfirm={() => {
            onDelete(subscription);
            setShowDeleteDialog(false);
          }}
          onCancel={() => setShowDeleteDialog(false)}
        />
      )}
    </div>
  );
}
