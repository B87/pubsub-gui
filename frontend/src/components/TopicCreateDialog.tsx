import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Button,
  FormField,
  Input,
} from './ui';

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
    <Dialog open={open} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Create Topic</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <FormField
            label="Topic ID"
            required
            helperText={!error && !externalError ? "Only letters, numbers, hyphens, and underscores allowed" : undefined}
            error={error || externalError}
          >
            <Input
              type="text"
              value={topicID}
              onChange={(e) => setTopicID(e.target.value)}
              placeholder="my-topic"
              autoFocus
              disabled={isCreating}
              error={error || externalError}
            />
          </FormField>

          <FormField
            label="Message Retention Duration (Optional)"
            helperText="Duration format: 1h, 24h, 7d, etc."
          >
            <Input
              type="text"
              value={messageRetention}
              onChange={(e) => setMessageRetention(e.target.value)}
              placeholder="e.g., 7d, 24h, 1h30m"
              disabled={isCreating}
            />
          </FormField>

          <DialogFooter>
            <Button variant="outline" onClick={handleClose} disabled={isCreating}>
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={isCreating || !topicID.trim()}
              loading={isCreating}
            >
              Create
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
