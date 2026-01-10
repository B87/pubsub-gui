import { useState } from "react";
import * as Tabs from "@radix-ui/react-tabs";
import SubscriptionMonitor from "./SubscriptionMonitor";
import SnapshotManager from "./SnapshotManager";
import DeleteConfirmDialog from "./DeleteConfirmDialog";
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
    <div className="flex flex-col h-full">
      <Tabs.Root
        value={activeTab}
        onValueChange={setActiveTab}
        className="flex flex-col flex-1"
      >
        <div className="p-8 border-b border-slate-700">
          <div className="w-full">
            {/* Header */}
            <div className="mb-6">
              <div className="flex items-center gap-3 mb-2">
                <svg
                  className="w-8 h-8 text-green-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                  />
                </svg>
                <div>
                  <h2 className="text-2xl font-bold">
                    {subscription.displayName}
                  </h2>
                  <p className="text-sm text-slate-400">Subscription</p>
                </div>
              </div>
            </div>

            {/* Tabs */}
            <Tabs.List className="flex gap-2 border-b border-slate-700">
              <Tabs.Trigger
                value="metadata"
                className="px-4 py-2 text-sm font-medium text-slate-400 hover:text-slate-200 data-[state=active]:text-slate-100 data-[state=active]:border-b-2 data-[state=active]:border-green-500 transition-colors"
              >
                Metadata
              </Tabs.Trigger>
              {subscription.subscriptionType === "pull" && (
                <Tabs.Trigger
                  value="monitor"
                  className="px-4 py-2 text-sm font-medium text-slate-400 hover:text-slate-200 data-[state=active]:text-slate-100 data-[state=active]:border-b-2 data-[state=active]:border-green-500 transition-colors"
                >
                  Monitor
                </Tabs.Trigger>
              )}
              {subscription.subscriptionType === "pull" && (
                <Tabs.Trigger
                  value="snapshots"
                  className="px-4 py-2 text-sm font-medium text-slate-400 hover:text-slate-200 data-[state=active]:text-slate-100 data-[state=active]:border-b-2 data-[state=active]:border-green-500 transition-colors"
                >
                  Snapshots
                </Tabs.Trigger>
              )}
            </Tabs.List>
          </div>
        </div>

        {/* Tab Content */}
        <Tabs.Content value="metadata" className="flex-1 overflow-auto">
          <div className="p-8">
            <div className="w-full">
              {/* Metadata Card */}
              <div className="bg-slate-800 rounded-lg border border-slate-700">
                <div className="px-6 py-4 border-b border-slate-700 flex items-center justify-between">
                  <h3 className="text-lg font-semibold">Metadata</h3>
                  <div className="flex gap-2">
                    {onEdit && (
                      <button
                        onClick={() => onEdit(subscription)}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded text-sm transition-colors"
                      >
                        Edit
                      </button>
                    )}
                    {onDelete && (
                      <button
                        onClick={() => setShowDeleteDialog(true)}
                        className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded text-sm transition-colors"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>

                <div className="p-6 space-y-4">
                  {/* Full Name */}
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1">
                      Full Resource Name
                    </label>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 px-3 py-2 bg-slate-900 rounded text-sm font-mono overflow-x-auto">
                        {subscription.name}
                      </code>
                      <button
                        onClick={() => copyToClipboard(subscription.name)}
                        className="px-3 py-2 bg-slate-700 hover:bg-slate-600 rounded text-sm transition-colors"
                        title="Copy to clipboard"
                      >
                        Copy
                      </button>
                    </div>
                  </div>

                  {/* Topic */}
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1">
                      Topic
                    </label>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 px-3 py-2 bg-slate-900 rounded text-sm font-mono overflow-x-auto">
                        {subscription.topic}
                      </code>
                      <button
                        onClick={() => copyToClipboard(subscription.topic)}
                        className="px-3 py-2 bg-slate-700 hover:bg-slate-600 rounded text-sm transition-colors"
                        title="Copy to clipboard"
                      >
                        Copy
                      </button>
                    </div>
                  </div>

                  {/* Subscription Type */}
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1">
                      Subscription Type
                    </label>
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-3 py-2 rounded text-sm font-medium ${
                          subscription.subscriptionType === "pull"
                            ? "bg-blue-900/50 text-blue-300 border border-blue-700"
                            : "bg-purple-900/50 text-purple-300 border border-purple-700"
                        }`}
                      >
                        {subscription.subscriptionType === "pull"
                          ? "Pull"
                          : "Push"}
                      </span>
                      {subscription.subscriptionType === "push" &&
                        subscription.pushEndpoint && (
                          <div className="flex-1">
                            <span className="text-xs text-slate-500 mr-2">
                              Endpoint:
                            </span>
                            <code className="px-3 py-2 bg-slate-900 rounded text-sm font-mono">
                              {subscription.pushEndpoint}
                            </code>
                          </div>
                        )}
                    </div>
                    {subscription.subscriptionType === "push" && (
                      <p className="mt-2 text-xs text-slate-500">
                        Push subscriptions deliver messages via HTTP POST to an
                        endpoint. Monitoring is not available for push
                        subscriptions.
                      </p>
                    )}
                  </div>

                  {/* Ack Deadline */}
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1">
                      Acknowledgement Deadline
                    </label>
                    <p className="px-3 py-2 bg-slate-900 rounded">
                      {subscription.ackDeadline} seconds
                    </p>
                  </div>

                  {/* Retention Duration */}
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1">
                      Message Retention Duration
                    </label>
                    <p className="px-3 py-2 bg-slate-900 rounded">
                      {subscription.retentionDuration}
                    </p>
                  </div>

                  {/* Filter */}
                  {subscription.filter && (
                    <div>
                      <label className="block text-sm font-medium text-slate-400 mb-1">
                        Filter Expression
                      </label>
                      <code className="block px-3 py-2 bg-slate-900 rounded text-sm font-mono overflow-x-auto">
                        {subscription.filter}
                      </code>
                    </div>
                  )}

                  {/* Dead Letter Policy */}
                  {subscription.deadLetterPolicy && (
                    <div>
                      <label className="block text-sm font-medium text-slate-400 mb-2">
                        Dead Letter Policy
                      </label>
                      <div className="bg-slate-900 rounded p-4 space-y-2">
                        <div>
                          <span className="text-sm text-slate-400">
                            Dead Letter Topic:
                          </span>
                          <code className="block text-sm font-mono mt-1">
                            {subscription.deadLetterPolicy.deadLetterTopic}
                          </code>
                        </div>
                        <div>
                          <span className="text-sm text-slate-400">
                            Max Delivery Attempts:
                          </span>
                          <p className="text-sm mt-1">
                            {subscription.deadLetterPolicy.maxDeliveryAttempts}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
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
