import { useState, useEffect, useRef } from 'react';
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

  useEffect(() => {
    loadProfiles();
  }, [refreshTrigger]); // Reload when refreshTrigger changes

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const loadProfiles = async () => {
    try {
      const p = await GetProfiles();
      setProfiles((p || []) as ConnectionProfile[]);
    } catch (e) {
      console.error('Failed to load profiles:', e);
    }
  };

  const handleSwitchProfile = async (profileId: string) => {
    setSwitching(true);
    try {
      // Switch profile (this disconnects old and connects new)
      await SwitchProfile(profileId);
      setIsOpen(false);

      // Notify parent to reload resources for the new connection
      onProfileSwitch();

      // Reload profiles to update active status in dropdown
      await loadProfiles();
    } catch (e: any) {
      console.error('Failed to switch profile:', e);
      alert(`Failed to switch profile: ${e.message || e}`);
    } finally {
      setSwitching(false);
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center gap-2 px-3 py-2 bg-slate-700 rounded-md hover:bg-slate-600 transition-colors cursor-pointer"
        disabled={switching}
      >
        <div className="flex-1 min-w-0 text-left">
          <p className="text-sm font-medium truncate">
            {isConnected ? currentProjectId || 'Connected' : 'Not Connected'}
          </p>
          {profiles.length > 0 && (
            <p className="text-xs text-slate-400 truncate">
              {profiles.length} saved connection{profiles.length !== 1 ? 's' : ''}
            </p>
          )}
        </div>
        <svg
          className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-slate-800 border border-slate-700 rounded-md shadow-lg z-50 max-h-96 overflow-y-auto">
          <div className="p-2 space-y-1">
            {/* Create New Connection */}
            <button
              onClick={() => {
                setIsOpen(false);
                onCreateNew();
              }}
              className="w-full px-3 py-2 text-left text-sm bg-slate-700 hover:bg-slate-600 rounded transition-colors flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span>Create New Connection</span>
            </button>

            {/* Divider */}
            {profiles.length > 0 && <div className="border-t border-slate-700 my-1" />}

            {/* Saved Profiles */}
            {profiles.length === 0 ? (
              <div className="px-3 py-2 text-sm text-slate-400 text-center">
                No saved connections
              </div>
            ) : (
              profiles.map((profile) => (
                <button
                  key={profile.id}
                  onClick={() => handleSwitchProfile(profile.id)}
                  disabled={switching}
                  className={`w-full px-3 py-2 text-left text-sm rounded transition-colors ${
                    isConnected && currentProjectId === profile.projectId
                      ? 'bg-blue-900 text-blue-200'
                      : 'bg-slate-700 hover:bg-slate-600'
                  } ${switching ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{profile.name}</p>
                      <p className="text-xs text-slate-400 truncate">
                        {profile.projectId} • {profile.authMethod}
                        {profile.emulatorHost && ' • Emulator'}
                      </p>
                    </div>
                    {isConnected && currentProjectId === profile.projectId && (
                      <svg className="w-4 h-4 text-blue-400 flex-shrink-0 ml-2" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
