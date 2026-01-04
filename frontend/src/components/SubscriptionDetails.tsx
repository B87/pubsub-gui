import type { Subscription } from '../types';

interface SubscriptionDetailsProps {
  subscription: Subscription;
}

export default function SubscriptionDetails({ subscription }: SubscriptionDetailsProps) {
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <div className="p-8">
      <div className="max-w-4xl">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <svg className="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            <div>
              <h2 className="text-2xl font-bold">{subscription.displayName}</h2>
              <p className="text-sm text-slate-400">Subscription</p>
            </div>
          </div>
        </div>

        {/* Metadata Card */}
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

            {/* Ack Deadline */}
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">
                Acknowledgement Deadline
              </label>
              <p className="px-3 py-2 bg-slate-900 rounded">{subscription.ackDeadline} seconds</p>
            </div>

            {/* Retention Duration */}
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">
                Message Retention Duration
              </label>
              <p className="px-3 py-2 bg-slate-900 rounded">{subscription.retentionDuration}</p>
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
                    <span className="text-sm text-slate-400">Dead Letter Topic:</span>
                    <code className="block text-sm font-mono mt-1">
                      {subscription.deadLetterPolicy.deadLetterTopic}
                    </code>
                  </div>
                  <div>
                    <span className="text-sm text-slate-400">Max Delivery Attempts:</span>
                    <p className="text-sm mt-1">{subscription.deadLetterPolicy.maxDeliveryAttempts}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Placeholder for future features */}
        <div className="mt-6 p-4 bg-slate-800/50 border border-slate-700 rounded-lg">
          <p className="text-sm text-slate-400">
            💡 <strong>Coming in Milestone 4:</strong> Monitor this subscription and view real-time messages with auto-acknowledge support.
          </p>
        </div>
      </div>
    </div>
  );
}
