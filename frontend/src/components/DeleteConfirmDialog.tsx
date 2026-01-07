import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Button,
} from './ui';

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
  const displayName = resourceName.split('/').pop() || resourceName;

  return (
    <Dialog open={open} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle style={{ color: 'var(--color-error)' }}>
            Delete {resourceType === 'topic' ? 'Topic' : 'Subscription'}
          </DialogTitle>
        </DialogHeader>

        <div className="mb-6">
          <p
            className="mb-2"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            Are you sure you want to delete this {resourceType}?
          </p>
          <div
            className="rounded p-3 mt-3"
            style={{ backgroundColor: 'var(--color-bg-code)' }}
          >
            <code
              className="text-sm font-mono break-all"
              style={{ color: 'var(--color-text-primary)' }}
            >
              {displayName}
            </code>
          </div>
          <p
            className="text-sm mt-3"
            style={{ color: 'var(--color-error)' }}
          >
            This action cannot be undone.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={onConfirm}>
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
