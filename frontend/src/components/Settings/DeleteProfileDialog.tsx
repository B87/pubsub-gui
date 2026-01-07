import { createPortal } from 'react-dom';
import type { ConnectionProfile } from '../../types';

interface DeleteProfileDialogProps {
  profile: ConnectionProfile;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function DeleteProfileDialog({ profile, onConfirm, onCancel }: DeleteProfileDialogProps) {
  const displayName = profile.name;

  return createPortal(
    <div
      style={{
        backgroundColor: 'color-mix(in srgb, var(--color-bg-primary) 50%, transparent)',
        zIndex: 200,
        pointerEvents: 'auto',
      }}
      className="fixed inset-0 flex items-center justify-center"
      onClick={(e) => {
        // Only close if clicking directly on the backdrop, not on child elements
        if (e.target === e.currentTarget) {
          e.stopPropagation();
          onCancel();
        }
      }}
    >
      <div
        style={{
          backgroundColor: 'var(--color-bg-secondary)',
          borderColor: 'var(--color-border-primary)',
          color: 'var(--color-text-primary)',
          pointerEvents: 'auto',
        }}
        className="border rounded-lg p-6 max-w-md w-full mx-4"
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h3
          style={{ color: 'var(--color-error)' }}
          className="text-lg font-semibold mb-4"
        >
          Delete Connection Profile
        </h3>
        <p className="mb-2" style={{ color: 'var(--color-text-secondary)' }}>
          Are you sure you want to delete this connection profile?
        </p>
        <code
          style={{
            backgroundColor: 'var(--color-bg-code)',
            color: 'var(--color-text-primary)',
          }}
          className="block rounded p-3 text-sm mb-3 break-all"
        >
          {displayName}
        </code>
        <p
          style={{ color: 'var(--color-error)' }}
          className="text-sm mb-4"
        >
          This action cannot be undone.
        </p>
        <div className="flex gap-3 justify-end">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onCancel();
            }}
            style={{
              color: 'var(--color-text-secondary)',
            }}
            className="px-4 py-2 rounded-md transition-colors hover:opacity-80"
            onMouseEnter={(e) => e.currentTarget.style.color = 'var(--color-text-primary)'}
            onMouseLeave={(e) => e.currentTarget.style.color = 'var(--color-text-secondary)'}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            style={{
              backgroundColor: 'var(--color-error)',
              color: 'var(--destructive-foreground)',
            }}
            className="px-4 py-2 rounded-md transition-opacity hover:opacity-90"
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--color-error-hover)'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--color-error)'}
          >
            Delete
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
