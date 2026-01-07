import { useState, useEffect, useRef, useCallback } from 'react';
import { UpdateTheme, UpdateFontSize, GetConfigFileContent, SaveConfigFileContent, GetProfiles, SaveProfile, DeleteProfile, GetConnectionStatus } from '../../wailsjs/go/main/App';
import { useTheme } from '../hooks/useTheme';
import type { Theme, FontSize } from '../types/theme';
import type { ConnectionProfile } from '../types';
import SettingsTabs from './Settings/SettingsTabs';
import AppearanceTab from './Settings/AppearanceTab';
import ConnectionsTab from './Settings/ConnectionsTab';
import AdvancedTab from './Settings/AdvancedTab';
import UpgradeTab from './Settings/UpgradeTab';
import ProfileDialog from './Settings/ProfileDialog';
import DeleteProfileDialog from './Settings/DeleteProfileDialog';

interface SettingsDialogProps {
  open: boolean;
  onClose: () => void;
}

type Tab = 'appearance' | 'connections' | 'advanced' | 'upgrade';

const tabs = [
  { id: 'appearance', label: 'Appearance' },
  { id: 'connections', label: 'Connections' },
  { id: 'advanced', label: 'Advanced' },
  { id: 'upgrade', label: 'Upgrade' },
];

export default function SettingsDialog({ open, onClose }: SettingsDialogProps) {
  const { theme, fontSize, monacoTheme } = useTheme();
  const [activeTab, setActiveTab] = useState<Tab>('appearance');
  const [selectedTheme, setSelectedTheme] = useState<Theme>(theme);
  const [selectedFontSize, setSelectedFontSize] = useState<FontSize>(fontSize);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Config editor state
  const [configContent, setConfigContent] = useState('');
  const [originalConfigContent, setOriginalConfigContent] = useState('');
  const [loadingConfig, setLoadingConfig] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);
  const [configError, setConfigError] = useState('');
  const [jsonError, setJsonError] = useState('');
  const [isValidJSON, setIsValidJSON] = useState(true);
  const editorRef = useRef<any>(null);

  // Connections tab state
  const [profiles, setProfiles] = useState<ConnectionProfile[]>([]);
  const [loadingProfiles, setLoadingProfiles] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [profileDialogOpen, setProfileDialogOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState<ConnectionProfile | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [profileToDelete, setProfileToDelete] = useState<ConnectionProfile | null>(null);
  const [activeProfileId, setActiveProfileId] = useState<string>('');

  // Map font size to Monaco editor font size
  const fontSizeMap = { small: 12, medium: 14, large: 16 };
  const editorFontSize = fontSizeMap[fontSize];

  // Update local state when theme/fontSize changes from outside
  useEffect(() => {
    setSelectedTheme(theme);
    setSelectedFontSize(fontSize);
  }, [theme, fontSize]);

  // Reset state when dialog opens/closes
  useEffect(() => {
    if (open) {
      setSelectedTheme(theme);
      setSelectedFontSize(fontSize);
      setError('');
      setActiveTab('appearance');
    } else {
      // Reset config editor state when dialog closes
      setConfigContent('');
      setConfigError('');
      setJsonError('');
      // Reset connections state
      setProfileDialogOpen(false);
      setEditingProfile(null);
      setDeleteConfirmOpen(false);
      setProfileToDelete(null);
    }
  }, [open, theme, fontSize]);

  // Load config when switching to advanced tab
  useEffect(() => {
    if (open && activeTab === 'advanced' && !configContent && !loadingConfig) {
      loadConfig();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, activeTab]);

  // Load profiles when switching to connections tab
  useEffect(() => {
    if (open && activeTab === 'connections') {
      loadProfiles();
    }
  }, [open, activeTab]);

  const loadActiveProfileId = async (profilesList: ConnectionProfile[]) => {
    try {
      const status = await GetConnectionStatus();
      // Find profile matching current connection
      const matchingProfile = profilesList.find(p =>
        p.projectId === status.projectId &&
        p.authMethod === (status.authMethod || 'ADC')
      );
      if (matchingProfile) {
        setActiveProfileId(matchingProfile.id);
      } else {
        setActiveProfileId('');
      }
    } catch (e) {
      // Ignore errors
    }
  };

  const loadProfiles = async () => {
    setLoadingProfiles(true);
    setProfileError('');
    try {
      const p = await GetProfiles();
      const profilesList = (p || []) as ConnectionProfile[];
      setProfiles(profilesList);
      await loadActiveProfileId(profilesList);
    } catch (e: any) {
      setProfileError('Failed to load profiles: ' + e.toString());
    } finally {
      setLoadingProfiles(false);
    }
  };

  const loadConfig = async () => {
    setLoadingConfig(true);
    setConfigError('');
    try {
      const content = await GetConfigFileContent();
      setConfigContent(content);
      setOriginalConfigContent(content);
      validateJSON(content);
    } catch (e: any) {
      setConfigError('Failed to load config file: ' + e.toString());
    } finally {
      setLoadingConfig(false);
    }
  };

  const validateJSON = (text: string): boolean => {
    if (!text.trim()) {
      setJsonError('');
      setIsValidJSON(false);
      return false;
    }
    try {
      JSON.parse(text);
      setJsonError('');
      setIsValidJSON(true);
      return true;
    } catch (e: any) {
      const errorMsg = e.message || 'Invalid JSON';
      const lineMatch = errorMsg.match(/position (\d+)/);
      const lineNumber = lineMatch ? ` at position ${lineMatch[1]}` : '';
      setJsonError(`Invalid JSON format: ${errorMsg}${lineNumber}`);
      setIsValidJSON(false);
      return false;
    }
  };

  const handleConfigContentChange = (value: string | undefined) => {
    const newValue = value || '';
    setConfigContent(newValue);
    validateJSON(newValue);
  };

  const formatJSON = useCallback(() => {
    if (!editorRef.current) return;
    const currentContent = editorRef.current.getValue();
    if (!currentContent.trim()) return;
    try {
      const parsed = JSON.parse(currentContent);
      const formatted = JSON.stringify(parsed, null, 2);
      setConfigContent(formatted);
      editorRef.current.setValue(formatted);
      validateJSON(formatted);
    } catch (e: any) {
      // Error already shown in validation
    }
  }, []);

  const handleSaveConfig = useCallback(async () => {
    const currentContent = editorRef.current?.getValue() || configContent;
    if (!currentContent.trim()) {
      setConfigError('Config content cannot be empty');
      return;
    }
    if (!validateJSON(currentContent)) {
      setConfigError('Please fix JSON errors before saving');
      return;
    }
    setSavingConfig(true);
    setConfigError('');
    try {
      await SaveConfigFileContent(currentContent);
      setOriginalConfigContent(currentContent);
      // Reload theme/fontSize from config in case they changed
      const parsed = JSON.parse(currentContent);
      if (parsed.theme && parsed.theme !== theme) {
        setSelectedTheme(parsed.theme);
      }
      if (parsed.fontSize && parsed.fontSize !== fontSize) {
        setSelectedFontSize(parsed.fontSize);
      }
    } catch (e: any) {
      setConfigError('Failed to save config: ' + e.toString());
    } finally {
      setSavingConfig(false);
    }
  }, [configContent, theme, fontSize]);

  const handleResetConfig = () => {
    if (window.confirm('Are you sure you want to reset all changes? This will reload the original config file.')) {
      setConfigContent(originalConfigContent);
      if (editorRef.current) {
        editorRef.current.setValue(originalConfigContent);
      }
      validateJSON(originalConfigContent);
      setConfigError('');
      setJsonError('');
    }
  };

  const handleCopyConfig = async () => {
    try {
      const textToCopy = editorRef.current?.getValue() || configContent;
      await navigator.clipboard.writeText(textToCopy);
      const originalError = configError;
      setConfigError('');
      setTimeout(() => {
        setConfigError('Copied to clipboard!');
        setTimeout(() => {
          setConfigError(originalError);
        }, 2000);
      }, 0);
    } catch (e: any) {
      setConfigError('Failed to copy to clipboard: ' + e.toString());
    }
  };

  const handleThemeChange = async (newTheme: Theme) => {
    setSelectedTheme(newTheme);
    setSaving(true);
    setError('');
    try {
      await UpdateTheme(newTheme);
    } catch (e: any) {
      setError('Failed to update theme: ' + e.toString());
      setSelectedTheme(theme); // Revert on error
    } finally {
      setSaving(false);
    }
  };

  const handleFontSizeChange = async (newSize: FontSize) => {
    setSelectedFontSize(newSize);
    setSaving(true);
    setError('');
    try {
      await UpdateFontSize(newSize);
    } catch (e: any) {
      setError('Failed to update font size: ' + e.toString());
      setSelectedFontSize(fontSize); // Revert on error
    } finally {
      setSaving(false);
    }
  };

  // Profile management handlers
  const handleCreateProfile = () => {
    setEditingProfile(null);
    setProfileDialogOpen(true);
  };

  const handleEditProfile = (profile: ConnectionProfile) => {
    setEditingProfile(profile);
    setProfileDialogOpen(true);
  };

  const handleDeleteProfile = (profile: ConnectionProfile) => {
    setProfileToDelete(profile);
    setDeleteConfirmOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!profileToDelete) return;
    setProfileError('');
    try {
      await DeleteProfile(profileToDelete.id);
      await loadProfiles();
      setDeleteConfirmOpen(false);
      setProfileToDelete(null);
    } catch (e: any) {
      setProfileError('Failed to delete profile: ' + e.toString());
    }
  };

  const handleSaveProfile = async (profile: ConnectionProfile) => {
    setProfileError('');
    try {
      await SaveProfile(profile as any);
      await loadProfiles();
      setProfileDialogOpen(false);
      setEditingProfile(null);
    } catch (e: any) {
      setProfileError('Failed to save profile: ' + e.toString());
    }
  };

  if (!open) return null;

  return (
    <div
      style={{
        backgroundColor: 'color-mix(in srgb, var(--color-bg-primary) 50%, transparent)',
      }}
      className="fixed inset-0 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: 'var(--color-bg-secondary)',
          borderColor: 'var(--color-border-primary)',
          color: 'var(--color-text-primary)',
          width: '90vw',
          maxWidth: '1200px',
          height: '85vh',
          minHeight: '600px',
        }}
        className="border rounded-lg shadow-xl mx-4 flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            borderBottomColor: 'var(--color-border-primary)',
          }}
          className="px-6 py-4 border-b"
        >
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold" style={{ color: 'var(--color-text-primary)' }}>Settings</h2>
              <p className="text-sm mt-1" style={{ color: 'var(--color-text-secondary)' }}>Customize your application appearance</p>
            </div>
            <button
              onClick={onClose}
              style={{ color: 'var(--color-text-secondary)' }}
              className="transition-colors"
              title="Close settings"
              onMouseEnter={(e) => e.currentTarget.style.color = 'var(--color-text-primary)'}
              onMouseLeave={(e) => e.currentTarget.style.color = 'var(--color-text-secondary)'}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Tabs and Content */}
        <SettingsTabs
          tabs={tabs}
          activeTab={activeTab}
          onTabChange={(tabId) => setActiveTab(tabId as Tab)}
        >
          {activeTab === 'appearance' && (
            <AppearanceTab
              theme={theme}
              fontSize={fontSize}
              selectedTheme={selectedTheme}
              selectedFontSize={selectedFontSize}
              onThemeChange={handleThemeChange}
              onFontSizeChange={handleFontSizeChange}
              saving={saving}
            />
          )}

          {activeTab === 'connections' && (
            <ConnectionsTab
              profiles={profiles}
              loadingProfiles={loadingProfiles}
              activeProfileId={activeProfileId}
              error={profileError}
              onCreate={handleCreateProfile}
              onEdit={handleEditProfile}
              onDelete={handleDeleteProfile}
            />
          )}

          {activeTab === 'advanced' && (
            <AdvancedTab
              configContent={configContent}
              originalConfigContent={originalConfigContent}
              loadingConfig={loadingConfig}
              savingConfig={savingConfig}
              configError={configError}
              jsonError={jsonError}
              isValidJSON={isValidJSON}
              onContentChange={handleConfigContentChange}
              onSave={handleSaveConfig}
              onFormat={formatJSON}
              onReset={handleResetConfig}
              onCopy={handleCopyConfig}
              monacoTheme={monacoTheme}
              editorFontSize={editorFontSize}
              editorRef={editorRef}
            />
          )}

          {activeTab === 'upgrade' && (
            <UpgradeTab saving={saving} />
          )}
        </SettingsTabs>

        {/* Error Message */}
        {error && (
          <div className="px-6 pb-4">
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
          </div>
        )}

        {/* Footer */}
        <div
          style={{
            borderTopColor: 'var(--color-border-primary)',
          }}
          className="px-6 py-4 border-t flex justify-between items-center"
        >
          {activeTab === 'advanced' && configContent !== originalConfigContent && (
            <div className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
              <span style={{ color: 'var(--color-warning)' }}>● Unsaved changes</span>
            </div>
          )}
          <div className="flex gap-3 ml-auto">
            {activeTab === 'advanced' && (
              <>
                <button
                  onClick={onClose}
                  disabled={savingConfig}
                  style={{
                    color: 'var(--color-text-secondary)',
                  }}
                  className="px-4 py-2 rounded-md transition-colors disabled:opacity-50"
                  onMouseEnter={(e) => {
                    if (!e.currentTarget.disabled) {
                      e.currentTarget.style.color = 'var(--color-text-primary)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!e.currentTarget.disabled) {
                      e.currentTarget.style.color = 'var(--color-text-secondary)';
                    }
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveConfig}
                  disabled={!configContent.trim() || savingConfig || !!jsonError || loadingConfig}
                  style={{
                    backgroundColor: 'var(--color-accent-primary)',
                    color: 'white',
                  }}
                  className="px-4 py-2 rounded-md transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Save changes (Ctrl/Cmd+S)"
                  onMouseEnter={(e) => {
                    if (!e.currentTarget.disabled) {
                      e.currentTarget.style.backgroundColor = 'var(--color-accent-hover)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!e.currentTarget.disabled) {
                      e.currentTarget.style.backgroundColor = 'var(--color-accent-primary)';
                    }
                  }}
                >
                  {savingConfig ? 'Saving...' : 'Save'}
                </button>
              </>
            )}
            {(activeTab === 'appearance' || activeTab === 'connections') && (
              <button
                onClick={onClose}
                style={{
                  backgroundColor: 'var(--color-accent-primary)',
                  color: 'white',
                }}
                className="px-4 py-2 rounded-md transition-opacity hover:opacity-90"
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--color-accent-hover)'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--color-accent-primary)'}
              >
                Close
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Profile Dialog */}
      {profileDialogOpen && (
        <ProfileDialog
          profile={editingProfile}
          onSave={handleSaveProfile}
          onClose={() => {
            setProfileDialogOpen(false);
            setEditingProfile(null);
            setProfileError('');
          }}
          error={profileError}
        />
      )}

      {/* Delete Confirmation Dialog */}
      {deleteConfirmOpen && profileToDelete && (
        <DeleteProfileDialog
          profile={profileToDelete}
          onConfirm={handleConfirmDelete}
          onCancel={() => {
            setDeleteConfirmOpen(false);
            setProfileToDelete(null);
          }}
        />
      )}
    </div>
  );
}
