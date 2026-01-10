import { useState } from 'react';
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
} from './ui';
import { SeekToTimestamp } from '../../wailsjs/go/main/App';

interface SeekDialogProps {
  open: boolean;
  subscriptionName: string;
  subscriptionDisplayName: string;
  onClose: () => void;
  onSeekComplete?: () => void;
}

type SeekMode = 'timestamp' | 'preset';
type PresetOption = '1h' | '6h' | '24h' | '7d';

export default function SeekDialog({
  open,
  subscriptionName,
  subscriptionDisplayName,
  onClose,
  onSeekComplete,
}: SeekDialogProps) {
  const [seekMode, setSeekMode] = useState<SeekMode>('preset');
  const [selectedPreset, setSelectedPreset] = useState<PresetOption>('1h');
  const [customTimestamp, setCustomTimestamp] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showConfirmation, setShowConfirmation] = useState(false);

  // Calculate timestamp from preset
  const getPresetTimestamp = (preset: PresetOption): string => {
    const now = new Date();
    switch (preset) {
      case '1h':
        now.setHours(now.getHours() - 1);
        break;
      case '6h':
        now.setHours(now.getHours() - 6);
        break;
      case '24h':
        now.setHours(now.getHours() - 24);
        break;
      case '7d':
        now.setDate(now.getDate() - 7);
        break;
    }
    return now.toISOString();
  };

  const getPresetLabel = (preset: PresetOption): string => {
    switch (preset) {
      case '1h':
        return '1 hour ago';
      case '6h':
        return '6 hours ago';
      case '24h':
        return '24 hours ago';
      case '7d':
        return '7 days ago';
    }
  };

  const handleSeekClick = () => {
    setError(null);
    setShowConfirmation(true);
  };

  const handleConfirmSeek = async () => {
    setIsLoading(true);
    setError(null);

    try {
      let timestamp: string;
      if (seekMode === 'preset') {
        timestamp = getPresetTimestamp(selectedPreset);
      } else {
        // Convert local datetime-local input to ISO format
        const localDate = new Date(customTimestamp);
        if (isNaN(localDate.getTime())) {
          throw new Error('Invalid date/time format');
        }
        timestamp = localDate.toISOString();
      }

      await SeekToTimestamp(subscriptionName, timestamp);
      setShowConfirmation(false);
      onSeekComplete?.();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to seek subscription');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    if (!isLoading) {
      setShowConfirmation(false);
      setError(null);
      onClose();
    }
  };

  const isSeekDisabled = seekMode === 'timestamp' && !customTimestamp;

  return (
    <Dialog open={open} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Seek Subscription</DialogTitle>
          <DialogDescription>
            Seek "{subscriptionDisplayName}" to replay messages from a specific point in time.
          </DialogDescription>
        </DialogHeader>

        {!showConfirmation ? (
          <div className="space-y-6">
            {/* Mode Selection */}
            <div className="space-y-3">
              <label className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                Seek to
              </label>
              <div className="flex gap-2">
                <button
                  onClick={() => setSeekMode('preset')}
                  className={`flex-1 px-3 py-2 text-sm rounded border transition-colors ${
                    seekMode === 'preset'
                      ? 'border-green-500 bg-green-500/10 text-green-400'
                      : 'border-slate-600 hover:border-slate-500'
                  }`}
                  style={seekMode !== 'preset' ? { color: 'var(--color-text-secondary)' } : undefined}
                >
                  Quick Presets
                </button>
                <button
                  onClick={() => setSeekMode('timestamp')}
                  className={`flex-1 px-3 py-2 text-sm rounded border transition-colors ${
                    seekMode === 'timestamp'
                      ? 'border-green-500 bg-green-500/10 text-green-400'
                      : 'border-slate-600 hover:border-slate-500'
                  }`}
                  style={seekMode !== 'timestamp' ? { color: 'var(--color-text-secondary)' } : undefined}
                >
                  Custom Time
                </button>
              </div>
            </div>

            {/* Preset Options */}
            {seekMode === 'preset' && (
              <div className="grid grid-cols-2 gap-2">
                {(['1h', '6h', '24h', '7d'] as PresetOption[]).map((preset) => (
                  <button
                    key={preset}
                    onClick={() => setSelectedPreset(preset)}
                    className={`px-4 py-3 text-sm rounded border transition-colors ${
                      selectedPreset === preset
                        ? 'border-green-500 bg-green-500/10 text-green-400'
                        : 'border-slate-600 hover:border-slate-500'
                    }`}
                    style={selectedPreset !== preset ? { color: 'var(--color-text-primary)' } : undefined}
                  >
                    {getPresetLabel(preset)}
                  </button>
                ))}
              </div>
            )}

            {/* Custom Timestamp Input */}
            {seekMode === 'timestamp' && (
              <div className="space-y-2">
                <label
                  htmlFor="seek-timestamp"
                  className="text-sm font-medium"
                  style={{ color: 'var(--color-text-secondary)' }}
                >
                  Date and Time
                </label>
                <input
                  id="seek-timestamp"
                  type="datetime-local"
                  value={customTimestamp}
                  onChange={(e) => setCustomTimestamp(e.target.value)}
                  className="w-full px-3 py-2 rounded border text-sm"
                  style={{
                    backgroundColor: 'var(--color-bg-tertiary)',
                    borderColor: 'var(--color-border-primary)',
                    color: 'var(--color-text-primary)',
                  }}
                />
                <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                  Messages published after this time will be redelivered
                </p>
              </div>
            )}

            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <Alert variant="warning">
              <AlertDescription>
                <strong>Warning:</strong> Seeking will cause all messages published after the
                selected time to be redelivered. This may result in duplicate message processing
                if your subscriber doesn't handle idempotency.
              </AlertDescription>
            </Alert>

            <div
              className="rounded p-3"
              style={{ backgroundColor: 'var(--color-bg-tertiary)' }}
            >
              <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                Seeking to:{' '}
                <span style={{ color: 'var(--color-text-primary)' }}>
                  {seekMode === 'preset'
                    ? getPresetLabel(selectedPreset)
                    : new Date(customTimestamp).toLocaleString()}
                </span>
              </p>
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </div>
        )}

        <DialogFooter>
          {!showConfirmation ? (
            <>
              <Button variant="outline" onClick={handleClose} disabled={isLoading}>
                Cancel
              </Button>
              <Button onClick={handleSeekClick} disabled={isSeekDisabled}>
                Seek
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="outline"
                onClick={() => setShowConfirmation(false)}
                disabled={isLoading}
              >
                Back
              </Button>
              <Button
                variant="default"
                onClick={handleConfirmSeek}
                disabled={isLoading}
              >
                {isLoading ? 'Seeking...' : 'Confirm Seek'}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
