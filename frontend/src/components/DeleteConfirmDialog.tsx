interface DeleteConfirmDialogProps {
  open: boolean;
  resourceType: 'topic' | 'subscription';
  resourceName: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function DeleteConfirmDialog({
  open,
  resourceType,
  resourceName,
  onConfirm,
  onCancel,
}: DeleteConfirmDialogProps) {
  if (!open) return null;

  const displayName = resourceName.split('/').pop() || resourceName;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-slate-800 border border-slate-700 rounded-lg p-6 max-w-md w-full mx-4">
        <h3 className="text-lg font-semibold mb-4 text-red-400">Delete {resourceType === 'topic' ? 'Topic' : 'Subscription'}</h3>

        <div className="mb-6">
          <p className="text-slate-300 mb-2">
            Are you sure you want to delete this {resourceType}?
          </p>
          <div className="bg-slate-900 rounded p-3 mt-3">
            <code className="text-sm font-mono text-slate-200 break-all">{displayName}</code>
          </div>
          <p className="text-sm text-red-400 mt-3">
            This action cannot be undone.
          </p>
        </div>

        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded transition-colors"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
