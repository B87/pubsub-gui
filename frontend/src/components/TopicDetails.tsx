import type { Topic } from '../types';

interface TopicDetailsProps {
  topic: Topic;
}

export default function TopicDetails({ topic }: TopicDetailsProps) {
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
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

        {/* Placeholder for future features */}
        <div className="mt-6 p-4 bg-slate-800/50 border border-slate-700 rounded-lg">
          <p className="text-sm text-slate-400">
            💡 <strong>Coming in Milestone 3:</strong> Publish messages to this topic with custom payloads and attributes.
          </p>
        </div>
      </div>
    </div>
  );
}
