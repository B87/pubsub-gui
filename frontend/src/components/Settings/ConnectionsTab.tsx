import type { ConnectionProfile } from '../../types';

interface ConnectionsTabProps {
  profiles: ConnectionProfile[];
  loadingProfiles: boolean;
  activeProfileId: string;
  error?: string;
  onCreate: () => void;
  onEdit: (profile: ConnectionProfile) => void;
  onDelete: (profile: ConnectionProfile) => void;
}

export default function ConnectionsTab({
  profiles,
  loadingProfiles,
  activeProfileId,
  error,
  onCreate,
  onEdit,
  onDelete,
}: ConnectionsTabProps) {
  return (
    <div className="space-y-4">
      {/* Header with Create Button */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium" style={{ color: 'var(--color-text-primary)' }}>
            Connection Profiles
          </h3>
          <p className="text-sm mt-1" style={{ color: 'var(--color-text-secondary)' }}>
            Manage your saved GCP connection profiles
          </p>
        </div>
        <button
          onClick={onCreate}
          style={{
            backgroundColor: 'var(--color-accent-primary)',
            color: 'white',
          }}
          className="px-4 py-2 rounded-md transition-opacity hover:opacity-90 flex items-center gap-2"
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--color-accent-hover)'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--color-accent-primary)'}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Create Profile
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <div
          style={{
            backgroundColor: 'var(--color-error-bg)',
            borderColor: 'var(--color-error-border)',
            color: 'var(--color-error)',
          }}
          className="p-3 border rounded-md text-sm"
        >
          {error}
        </div>
      )}

      {/* Profiles List */}
      {loadingProfiles ? (
        <div className="flex items-center justify-center p-8">
          <p style={{ color: 'var(--color-text-muted)' }}>Loading profiles...</p>
        </div>
      ) : profiles.length === 0 ? (
        <div
          style={{
            backgroundColor: 'var(--color-bg-secondary)',
            borderColor: 'var(--color-border-primary)',
          }}
          className="border rounded-lg p-8 text-center"
        >
          <svg
            className="w-12 h-12 mx-auto mb-4"
            style={{ color: 'var(--color-text-muted)' }}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-sm mb-2" style={{ color: 'var(--color-text-primary)' }}>
            No connection profiles yet
          </p>
          <p className="text-xs mb-4" style={{ color: 'var(--color-text-secondary)' }}>
            Create a profile to quickly switch between different GCP projects
          </p>
          <button
            onClick={onCreate}
            style={{
              backgroundColor: 'var(--color-accent-primary)',
              color: 'white',
            }}
            className="px-4 py-2 rounded-md transition-opacity hover:opacity-90"
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--color-accent-hover)'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--color-accent-primary)'}
          >
            Create Your First Profile
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {profiles.map((profile) => {
            const isActive = activeProfileId === profile.id;
            return (
              <div
                key={profile.id}
                style={{
                  backgroundColor: isActive ? 'color-mix(in srgb, var(--color-accent-primary) 20%, transparent)' : 'var(--color-bg-secondary)',
                  borderColor: isActive ? 'var(--color-accent-primary)' : 'var(--color-border-primary)',
                }}
                className="border rounded-lg p-4"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <h4 className="font-medium" style={{ color: 'var(--color-text-primary)' }}>
                        {profile.name}
                      </h4>
                      {profile.isDefault && (
                        <span
                          style={{
                            backgroundColor: 'var(--color-accent-primary)',
                            color: 'white',
                          }}
                          className="px-2 py-0.5 text-xs rounded-full"
                        >
                          Default
                        </span>
                      )}
                      {isActive && (
                        <span
                          style={{
                            backgroundColor: 'var(--color-success)',
                            color: 'white',
                          }}
                          className="px-2 py-0.5 text-xs rounded-full"
                        >
                          Active
                        </span>
                      )}
                    </div>
                    <div className="space-y-1 text-sm">
                      <p style={{ color: 'var(--color-text-secondary)' }}>
                        <span className="font-medium">Project:</span> {profile.projectId}
                      </p>
                      <p style={{ color: 'var(--color-text-secondary)' }}>
                        <span className="font-medium">Auth:</span> {profile.authMethod}
                        {profile.authMethod === 'ServiceAccount' && profile.serviceAccountPath && (
                          <span className="ml-1 text-xs" style={{ color: 'var(--color-text-muted)' }}>
                            ({profile.serviceAccountPath})
                          </span>
                        )}
                      </p>
                      {profile.emulatorHost && (
                        <p style={{ color: 'var(--color-text-secondary)' }}>
                          <span className="font-medium">Emulator:</span> {profile.emulatorHost}
                        </p>
                      )}
                      <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                        Created: {new Date(profile.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    <button
                      onClick={() => onEdit(profile)}
                      style={{ color: 'var(--color-accent-primary)' }}
                      className="p-2 rounded-md transition-colors hover:opacity-80"
                      title="Edit profile"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => onDelete(profile)}
                      style={{ color: 'var(--color-error)' }}
                      className="p-2 rounded-md transition-colors hover:opacity-80"
                      title="Delete profile"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
