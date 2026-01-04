import { useState } from 'react';

interface TopicCreateDialogProps {
  open: boolean;
  onClose: () => void;
  onCreate: (topicID: string, messageRetentionDuration: string) => Promise<void>;
  error?: string;
}

export default function TopicCreateDialog({
  open,
  onClose,
  onCreate,
  error: externalError,
}: TopicCreateDialogProps) {
  const [topicID, setTopicID] = useState('');
  const [messageRetention, setMessageRetention] = useState('');
  const [error, setError] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  if (!open) return null;

  const handleCreate = async () => {
    setError('');

    // Validate topic ID
    if (!topicID.trim()) {
      setError('Topic ID is required');
      return;
    }

    // Validate topic ID format (alphanumeric, hyphens, underscores)
    const topicIDRegex = /^[a-z0-9-_]+$/i;
    if (!topicIDRegex.test(topicID.trim())) {
      setError('Topic ID can only contain letters, numbers, hyphens, and underscores');
      return;
    }

    setIsCreating(true);
    try {
      await onCreate(topicID.trim(), messageRetention.trim());
      // Reset form on success
      setTopicID('');
      setMessageRetention('');
      setError('');
      onClose();
    } catch (e: any) {
      setError(e.toString());
    } finally {
      setIsCreating(false);
    }
  };

  const handleClose = () => {
    setTopicID('');
    setMessageRetention('');
    setError('');
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-slate-800 border border-slate-700 rounded-lg p-6 max-w-md w-full mx-4">
        <h3 className="text-lg font-semibold mb-4">Create Topic</h3>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-2">
              Topic ID *
            </label>
            <input
              type="text"
              value={topicID}
              onChange={(e) => setTopicID(e.target.value)}
              placeholder="my-topic"
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
              disabled={isCreating}
            />
            <p className="text-xs text-slate-500 mt-1">
              Only letters, numbers, hyphens, and underscores allowed
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-400 mb-2">
              Message Retention Duration (Optional)
            </label>
            <input
              type="text"
              value={messageRetention}
              onChange={(e) => setMessageRetention(e.target.value)}
              placeholder="e.g., 7d, 24h, 1h30m"
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={isCreating}
            />
            <p className="text-xs text-slate-500 mt-1">
              Duration format: 1h, 24h, 7d, etc.
            </p>
          </div>

          {(error || externalError) && (
            <div className="p-3 bg-red-900/20 border border-red-700 rounded text-red-400 text-sm">
              {error || externalError}
            </div>
          )}

          <div className="flex gap-3 justify-end">
            <button
              onClick={handleClose}
              disabled={isCreating}
              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 disabled:bg-slate-700 disabled:opacity-50 rounded transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={isCreating || !topicID.trim()}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 disabled:cursor-not-allowed rounded transition-colors"
            >
              {isCreating ? 'Creating...' : 'Create'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
