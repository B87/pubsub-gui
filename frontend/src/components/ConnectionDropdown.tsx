import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { ConnectionProfile } from '../types';
import { GetProfiles, SwitchProfile } from '../../wailsjs/go/main/App';

interface ConnectionDropdownProps {
  currentProjectId: string;
  isConnected: boolean;
  onProfileSwitch: () => void;
  onCreateNew: () => void;
  refreshTrigger?: number; // When this changes, reload profiles
}

export default function ConnectionDropdown({
  currentProjectId,
  isConnected,
  onProfileSwitch,
  onCreateNew,
  refreshTrigger,
}: ConnectionDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [profiles, setProfiles] = useState<ConnectionProfile[]>([]);
  const [switching, setSwitching] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 });
  const isMountedRef = useRef(true);

  // Track component mount/unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    loadProfiles();
  }, [refreshTrigger]); // Reload when refreshTrigger changes

  // Update dropdown position when opening
  useEffect(() => {
    if (isOpen && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + 4,
        left: rect.left,
        width: rect.width,
      });
    }
  }, [isOpen]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(target) &&
        triggerRef.current &&
        !triggerRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      // Use click event (not mousedown) and bubble phase (not capture) to allow button clicks to register first
      // Small delay to ensure dropdown is fully rendered
      const timeoutId = setTimeout(() => {
        document.addEventListener('click', handleClickOutside);
      }, 0);
      return () => {
        clearTimeout(timeoutId);
        document.removeEventListener('click', handleClickOutside);
      };
    }
  }, [isOpen]);

  const loadProfiles = async () => {
    try {
      const p = await GetProfiles();
      setProfiles((p || []) as ConnectionProfile[]);
    } catch (e: any) {
      console.error('Failed to load profiles:', e);
    }
  };

  const handleSwitchProfile = async (profileId: string) => {
    setSwitching(true);

    // Close dropdown immediately to prevent UI blocking
    setIsOpen(false);

    try {
      // Switch profile (this disconnects old and connects new)

      // Wrap SwitchProfile with timeout to detect if it hangs
      let switchCompleted = false;
      const switchPromise = new Promise<void>((resolve, reject) => {
        // Start timeout immediately
        const timeoutId = setTimeout(() => {
          if (!switchCompleted) {
            switchCompleted = true;
            reject(new Error('SwitchProfile timeout after 30s - the backend call may be hanging'));
          }
        }, 30000);

        // Call SwitchProfile in next tick to allow timeout to be set up
        Promise.resolve().then(async () => {
          try {
            await SwitchProfile(profileId);
            if (!switchCompleted) {
              clearTimeout(timeoutId);
              switchCompleted = true;
              resolve();
            }
          } catch (err) {
            if (!switchCompleted) {
              clearTimeout(timeoutId);
              switchCompleted = true;
              reject(err);
            }
          }
        });
      });

      await switchPromise;

      // Notify parent to reload resources for the new connection
      // Call this AFTER SwitchProfile completes
      // Call parent callback but don't await it - it might cause component unmount
      // Use setTimeout to ensure it runs after current execution context
      setTimeout(() => {
        onProfileSwitch();
      }, 0);

      // Reload profiles to update active status in dropdown
      await loadProfiles();
    } catch (e: any) {
      console.error('Failed to switch profile:', e);
      // Only show alert if component is still mounted
      if (isMountedRef.current) {
        alert(`Failed to switch profile: ${e.message || e}`);
      }
    } finally {
      // Only update state if component is still mounted
      if (isMountedRef.current) {
        setSwitching(false);
      }
    }
  };

  return (
    <>
      <div className="relative">
        <button
          ref={triggerRef}
          onClick={(e) => {
            e.stopPropagation();
            setIsOpen(!isOpen);
          }}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-md transition-colors cursor-pointer"
          style={{
            backgroundColor: 'var(--color-bg-tertiary)',
            color: 'var(--color-text-primary)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--color-bg-hover)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--color-bg-tertiary)';
          }}
          disabled={switching}
        >
        <div className="flex-1 min-w-0 text-left">
          <p className="text-sm font-medium truncate">
            {isConnected ? currentProjectId || 'Connected' : 'Not Connected'}
          </p>
          {profiles.length > 0 && (
            <p className="text-xs truncate" style={{ color: 'var(--color-text-muted)' }}>
              {profiles.length} saved connection{profiles.length !== 1 ? 's' : ''}
            </p>
          )}
        </div>
        <svg
          className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          style={{ color: 'var(--color-text-muted)' }}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      </div>

      {isOpen &&
        createPortal(
          <div
            ref={dropdownRef}
            className="fixed rounded-md shadow-lg max-h-96 overflow-y-auto"
            style={{
              top: `${dropdownPosition.top}px`,
              left: `${dropdownPosition.left}px`,
              width: `${dropdownPosition.width}px`,
              zIndex: 9999,
              backgroundColor: 'var(--color-bg-secondary)',
              borderColor: 'var(--color-border-primary)',
              borderWidth: '1px',
              borderStyle: 'solid',
              pointerEvents: 'auto',
            }}
            onClick={(e) => {
              e.stopPropagation();
            }}
            onMouseDown={(e) => {
              e.stopPropagation();
            }}
          >
          <div className="p-2 space-y-1">
            {/* Create New Connection */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsOpen(false);
                onCreateNew();
              }}
              onMouseDown={(e) => {
                e.stopPropagation();
              }}
              className="w-full px-3 py-2 text-left text-sm rounded transition-colors flex items-center gap-2"
              style={{
                backgroundColor: 'var(--color-bg-tertiary)',
                color: 'var(--color-text-primary)',
                pointerEvents: 'auto',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--color-bg-hover)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--color-bg-tertiary)';
              }}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span>Create New Connection</span>
            </button>

            {/* Divider */}
            {profiles.length > 0 && (
              <div
                className="border-t my-1"
                style={{ borderColor: 'var(--color-border-primary)' }}
              />
            )}

            {/* Saved Profiles */}
            {profiles.length === 0 ? (
              <div className="px-3 py-2 text-sm text-center" style={{ color: 'var(--color-text-muted)' }}>
                No saved connections
              </div>
            ) : (
              profiles.map((profile) => (
                <button
                  key={profile.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!switching) {
                      handleSwitchProfile(profile.id);
                    }
                  }}
                  onMouseDown={(e) => {
                    e.stopPropagation();
                  }}
                  disabled={switching}
                  className="w-full px-3 py-2 text-left text-sm rounded transition-colors"
                  style={{
                    backgroundColor:
                      isConnected && currentProjectId === profile.projectId
                        ? 'var(--color-accent-primary)'
                        : 'var(--color-bg-tertiary)',
                    color:
                      isConnected && currentProjectId === profile.projectId
                        ? 'var(--color-accent-foreground)'
                        : 'var(--color-text-primary)',
                    opacity: switching ? 0.5 : 1,
                    cursor: switching ? 'not-allowed' : 'pointer',
                    pointerEvents: 'auto',
                  }}
                  onMouseEnter={(e) => {
                    if (!switching && (!isConnected || currentProjectId !== profile.projectId)) {
                      e.currentTarget.style.backgroundColor = 'var(--color-bg-hover)';
                    } else if (!switching) {
                      e.currentTarget.style.backgroundColor = 'var(--color-accent-hover)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isConnected || currentProjectId !== profile.projectId) {
                      e.currentTarget.style.backgroundColor = 'var(--color-bg-tertiary)';
                    } else {
                      e.currentTarget.style.backgroundColor = 'var(--color-accent-primary)';
                    }
                  }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{profile.name}</p>
                      <p className="text-xs truncate" style={{ color: 'var(--color-text-muted)' }}>
                        {profile.projectId} • {profile.authMethod}
                        {profile.emulatorHost && ' • Emulator'}
                      </p>
                    </div>
                    {isConnected && currentProjectId === profile.projectId && (
                      <svg
                        className="w-4 h-4 shrink-0 ml-2"
                        style={{ color: 'var(--color-accent-light)' }}
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
