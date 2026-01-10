import { useState, useEffect, useCallback } from 'react';
import { EventsOn } from '../../wailsjs/runtime/runtime';
import {
  ListSnapshotsForSubscription,
  CreateSnapshot,
  DeleteSnapshot,
  SeekToSnapshot,
} from '../../wailsjs/go/main/App';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
  Button,
  Alert,
  AlertDescription,
  Input,
  Label,
} from './ui';
import type { SnapshotInfo, Subscription } from '../types';

interface SnapshotManagerProps {
  subscription: Subscription;
}

export default function SnapshotManager({ subscription }: SnapshotManagerProps) {
  const [snapshots, setSnapshots] = useState<SnapshotInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isSeekDialogOpen, setIsSeekDialogOpen] = useState(false);
  const [selectedSnapshot, setSelectedSnapshot] = useState<SnapshotInfo | null>(null);
  const [newSnapshotName, setNewSnapshotName] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const loadSnapshots = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await ListSnapshotsForSubscription(subscription.name);
      setSnapshots(result || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load snapshots');
    } finally {
      setIsLoading(false);
    }
  }, [subscription.name]);

  useEffect(() => {
    loadSnapshots();
  }, [loadSnapshots]);

  // Listen for snapshot events
  useEffect(() => {
    const unsubscribeCreated = EventsOn('snapshot:created', () => {
      loadSnapshots();
    });

    const unsubscribeDeleted = EventsOn('snapshot:deleted', () => {
      loadSnapshots();
    });

    return () => {
      unsubscribeCreated();
      unsubscribeDeleted();
    };
  }, [loadSnapshots]);

  const handleCreateSnapshot = async () => {
    if (!newSnapshotName.trim()) {
      setActionError('Snapshot name is required');
      return;
    }

    // Validate snapshot name (alphanumeric, hyphens, underscores)
    const namePattern = /^[a-zA-Z][a-zA-Z0-9-_]*$/;
    if (!namePattern.test(newSnapshotName)) {
      setActionError('Snapshot name must start with a letter and contain only letters, numbers, hyphens, and underscores');
      return;
    }

    setActionLoading(true);
    setActionError(null);
    try {
      await CreateSnapshot(subscription.name, newSnapshotName);
      setIsCreateDialogOpen(false);
      setNewSnapshotName('');
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to create snapshot');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteSnapshot = async () => {
    if (!selectedSnapshot) return;

    setActionLoading(true);
    setActionError(null);
    try {
      await DeleteSnapshot(selectedSnapshot.displayName);
      setIsDeleteDialogOpen(false);
      setSelectedSnapshot(null);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to delete snapshot');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSeekToSnapshot = async () => {
    if (!selectedSnapshot) return;

    setActionLoading(true);
    setActionError(null);
    try {
      await SeekToSnapshot(subscription.name, selectedSnapshot.displayName);
      setIsSeekDialogOpen(false);
      setSelectedSnapshot(null);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to seek to snapshot');
    } finally {
      setActionLoading(false);
    }
  };

  const formatDate = (isoString: string): string => {
    try {
      return new Date(isoString).toLocaleString();
    } catch {
      return isoString;
    }
  };

  const openDeleteDialog = (snapshot: SnapshotInfo) => {
    setSelectedSnapshot(snapshot);
    setActionError(null);
    setIsDeleteDialogOpen(true);
  };

  const openSeekDialog = (snapshot: SnapshotInfo) => {
    setSelectedSnapshot(snapshot);
    setActionError(null);
    setIsSeekDialogOpen(true);
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold" style={{ color: 'var(--color-text-primary)' }}>
            Snapshots
          </h3>
          <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>
            Snapshots preserve the message acknowledgment state for replay
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadSnapshots}
            className="px-3 py-2 text-sm rounded border transition-colors hover:bg-slate-700"
            style={{ borderColor: 'var(--color-border-primary)' }}
            disabled={isLoading}
          >
            {isLoading ? 'Loading...' : 'Refresh'}
          </button>
          <Button onClick={() => setIsCreateDialogOpen(true)}>
            Create Snapshot
          </Button>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Snapshots List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div style={{ color: 'var(--color-text-muted)' }}>Loading snapshots...</div>
        </div>
      ) : snapshots.length === 0 ? (
        <div
          className="rounded-lg border p-8 text-center"
          style={{
            backgroundColor: 'var(--color-bg-secondary)',
            borderColor: 'var(--color-border-primary)',
          }}
        >
          <svg
            className="w-12 h-12 mx-auto mb-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            style={{ color: 'var(--color-text-muted)' }}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"
            />
          </svg>
          <p style={{ color: 'var(--color-text-secondary)' }}>No snapshots available</p>
          <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>
            Create a snapshot to preserve the current message state for replay
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {snapshots.map((snapshot) => (
            <div
              key={snapshot.name}
              className="rounded-lg border p-4 flex items-center justify-between"
              style={{
                backgroundColor: 'var(--color-bg-secondary)',
                borderColor: 'var(--color-border-primary)',
              }}
            >
              <div>
                <div className="font-medium" style={{ color: 'var(--color-text-primary)' }}>
                  {snapshot.displayName}
                </div>
                <div className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>
                  Expires: {formatDate(snapshot.expireTime)}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => openSeekDialog(snapshot)}
                  className="px-3 py-1.5 text-sm rounded transition-colors bg-green-600 hover:bg-green-700 text-white"
                >
                  Seek
                </button>
                <button
                  onClick={() => openDeleteDialog(snapshot)}
                  className="px-3 py-1.5 text-sm rounded transition-colors"
                  style={{
                    backgroundColor: 'var(--color-error-bg)',
                    color: 'var(--color-error)',
                  }}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Snapshot Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={(open) => !open && setIsCreateDialogOpen(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create Snapshot</DialogTitle>
            <DialogDescription>
              Create a snapshot of the current message state for "{subscription.displayName}"
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="snapshot-name">Snapshot Name</Label>
              <Input
                id="snapshot-name"
                placeholder="my-snapshot"
                value={newSnapshotName}
                onChange={(e) => setNewSnapshotName(e.target.value)}
              />
              <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                Must start with a letter; can contain letters, numbers, hyphens, and underscores
              </p>
            </div>

            {actionError && (
              <Alert variant="destructive">
                <AlertDescription>{actionError}</AlertDescription>
              </Alert>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)} disabled={actionLoading}>
              Cancel
            </Button>
            <Button onClick={handleCreateSnapshot} disabled={actionLoading || !newSnapshotName.trim()}>
              {actionLoading ? 'Creating...' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={(open) => !open && setIsDeleteDialogOpen(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle style={{ color: 'var(--color-error)' }}>Delete Snapshot</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <p style={{ color: 'var(--color-text-secondary)' }}>
              Are you sure you want to delete this snapshot?
            </p>
            <div
              className="rounded p-3"
              style={{ backgroundColor: 'var(--color-bg-tertiary)' }}
            >
              <code className="text-sm font-mono" style={{ color: 'var(--color-text-primary)' }}>
                {selectedSnapshot?.displayName}
              </code>
            </div>
            <p className="text-sm" style={{ color: 'var(--color-error)' }}>
              This action cannot be undone.
            </p>

            {actionError && (
              <Alert variant="destructive">
                <AlertDescription>{actionError}</AlertDescription>
              </Alert>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)} disabled={actionLoading}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteSnapshot} disabled={actionLoading}>
              {actionLoading ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Seek Confirmation Dialog */}
      <Dialog open={isSeekDialogOpen} onOpenChange={(open) => !open && setIsSeekDialogOpen(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Seek to Snapshot</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <Alert variant="warning">
              <AlertDescription>
                <strong>Warning:</strong> Seeking to a snapshot will replay messages that were
                acknowledged after the snapshot was created. This may cause duplicate message processing.
              </AlertDescription>
            </Alert>

            <div
              className="rounded p-3"
              style={{ backgroundColor: 'var(--color-bg-tertiary)' }}
            >
              <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                Snapshot:{' '}
                <span style={{ color: 'var(--color-text-primary)' }}>
                  {selectedSnapshot?.displayName}
                </span>
              </p>
            </div>

            {actionError && (
              <Alert variant="destructive">
                <AlertDescription>{actionError}</AlertDescription>
              </Alert>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsSeekDialogOpen(false)} disabled={actionLoading}>
              Cancel
            </Button>
            <Button onClick={handleSeekToSnapshot} disabled={actionLoading}>
              {actionLoading ? 'Seeking...' : 'Confirm Seek'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
