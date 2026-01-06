import { useState } from 'react';

type AuthMethod = 'ADC' | 'ServiceAccount' | 'OAuth';

interface ConnectionDialogProps {
  open: boolean;
  onConnect: (projectId: string, authMethod: AuthMethod, serviceAccountPath?: string, oauthClientPath?: string, saveAsProfile?: { name: string; isDefault?: boolean }) => Promise<void>;
  onClose: () => void;
  error?: string;
}

export default function ConnectionDialog({ open, onConnect, onClose, error }: ConnectionDialogProps) {
  const [authMethod, setAuthMethod] = useState<AuthMethod>('ADC');
  const [projectId, setProjectId] = useState('');
  const [serviceAccountPath, setServiceAccountPath] = useState('');
  const [oauthClientPath, setOAuthClientPath] = useState('');
  const [loading, setLoading] = useState(false);
  const [saveAsProfile, setSaveAsProfile] = useState(false);
  const [profileName, setProfileName] = useState('');
  const [isDefault, setIsDefault] = useState(false);

  if (!open) return null;

  const handleConnect = async () => {
    if (!projectId.trim()) return;
    if (authMethod === 'ServiceAccount' && !serviceAccountPath.trim()) {
      return;
    }
    if (authMethod === 'OAuth' && !oauthClientPath.trim()) {
      return;
    }

    setLoading(true);
    try {
      const saveProfile = saveAsProfile && profileName.trim()
        ? { name: profileName.trim(), isDefault }
        : undefined;
      await onConnect(
        projectId.trim(),
        authMethod,
        authMethod === 'ServiceAccount' ? serviceAccountPath.trim() : undefined,
        authMethod === 'OAuth' ? oauthClientPath.trim() : undefined,
        saveProfile
      );
      setProjectId('');
      setServiceAccountPath('');
      setOAuthClientPath('');
      setSaveAsProfile(false);
      setProfileName('');
      setIsDefault(false);
      onClose();
    } catch (e) {
      // Error is handled by parent
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && projectId.trim() && !loading) {
      handleConnect();
    }
  };

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
        }}
        className="border rounded-lg shadow-xl max-w-md w-full mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            borderBottomColor: 'var(--color-border-primary)',
          }}
          className="px-6 py-4 border-b"
        >
          <h2 className="text-xl font-semibold" style={{ color: 'var(--color-text-primary)' }}>
            Connect to Google Cloud Pub/Sub
          </h2>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Auth Method Selection */}
          <div>
            <label className="block text-sm font-medium mb-2">Authentication Method</label>
            <div className="flex gap-2">
              <button
                onClick={() => setAuthMethod('ADC')}
                className={`flex-1 px-3 py-2 rounded border ${
                  authMethod === 'ADC'
                    ? 'bg-blue-600 border-blue-500 text-white'
                    : 'bg-slate-700 border-slate-600 text-slate-300 hover:bg-slate-600'
                }`}
              >
                ADC
              </button>
              <button
                onClick={() => setAuthMethod('ServiceAccount')}
                className={`flex-1 px-3 py-2 rounded border ${
                  authMethod === 'ServiceAccount'
                    ? 'bg-blue-600 border-blue-500 text-white'
                    : 'bg-slate-700 border-slate-600 text-slate-300 hover:bg-slate-600'
                }`}
              >
                Service Account
              </button>
              <button
                onClick={() => setAuthMethod('OAuth')}
                className={`flex-1 px-3 py-2 rounded border ${
                  authMethod === 'OAuth'
                    ? 'bg-blue-600 border-blue-500 text-white'
                    : 'bg-slate-700 border-slate-600 text-slate-300 hover:bg-slate-600'
                }`}
              >
                OAuth
              </button>
            </div>
          </div>

          {/* Help Text */}
          {authMethod === 'ADC' && (
            <p className="text-sm text-slate-300">
              Connect using Application Default Credentials (ADC). Make sure you're authenticated with gcloud.
            </p>
          )}

          {authMethod === 'ServiceAccount' && (
            <p className="text-sm text-slate-300">
              Connect using a service account JSON key file. Download from GCP Console → IAM & Admin → Service Accounts.
            </p>
          )}

          {authMethod === 'OAuth' && (
            <p className="text-sm text-slate-300">
              Connect using your personal Google account. You'll need an OAuth client JSON file from GCP Console.
            </p>
          )}

          <div>
            <label htmlFor="projectId" className="block text-sm font-medium mb-2">
              GCP Project ID
            </label>
            <input
              id="projectId"
              type="text"
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="my-gcp-project"
              disabled={loading}
              className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-md text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
              autoFocus
            />
          </div>

          {/* Service Account Path */}
          {authMethod === 'ServiceAccount' && (
            <div>
              <label htmlFor="serviceAccount" className="block text-sm font-medium mb-2">
                Service Account JSON Path *
              </label>
              <input
                id="serviceAccount"
                type="text"
                value={serviceAccountPath}
                onChange={(e) => setServiceAccountPath(e.target.value)}
                placeholder="Path to service-account.json"
                disabled={loading}
                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-md text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
              />
              <p className="mt-1 text-xs text-slate-400">
                Download from{' '}
                <a
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    window.open('https://console.cloud.google.com/iam-admin/serviceaccounts', '_blank');
                  }}
                  className="text-blue-400 hover:underline"
                >
                  GCP Console → IAM & Admin → Service Accounts
                </a>
              </p>
            </div>
          )}

          {/* OAuth Client File Selection */}
          {authMethod === 'OAuth' && (
            <div>
              <label htmlFor="oauthClient" className="block text-sm font-medium mb-2">
                OAuth Client JSON Path *
              </label>
              <input
                id="oauthClient"
                type="text"
                value={oauthClientPath}
                onChange={(e) => setOAuthClientPath(e.target.value)}
                placeholder="Path to client_secret_*.json"
                disabled={loading}
                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-md text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
              />
              <p className="mt-1 text-xs text-slate-400">
                Download from{' '}
                <a
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    window.open('https://console.cloud.google.com/apis/credentials', '_blank');
                  }}
                  className="text-blue-400 hover:underline"
                >
                  GCP Console → APIs & Services → Credentials
                </a>
              </p>
            </div>
          )}

          {/* Save as Connection Profile */}
          <div className="space-y-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={saveAsProfile}
                onChange={(e) => setSaveAsProfile(e.target.checked)}
                disabled={loading}
                className="w-4 h-4 rounded bg-slate-700 border-slate-600 text-blue-500 focus:ring-blue-500"
              />
              <span className="text-sm text-slate-300">Save as connection profile</span>
            </label>

            {saveAsProfile && (
              <div className="ml-6 space-y-3">
                <div>
                  <label htmlFor="profileName" className="block text-sm font-medium mb-2">
                    Connection Name
                  </label>
                  <input
                    id="profileName"
                    type="text"
                    value={profileName}
                    onChange={(e) => setProfileName(e.target.value)}
                    placeholder="Production, Staging, etc."
                    disabled={loading}
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-md text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                  />
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isDefault}
                    onChange={(e) => setIsDefault(e.target.checked)}
                    disabled={loading}
                    className="w-4 h-4 rounded bg-slate-700 border-slate-600 text-blue-500 focus:ring-blue-500"
                  />
                  <span className="text-sm text-slate-300">Set as default connection</span>
                </label>
              </div>
            )}
          </div>

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

          <div
            style={{
              backgroundColor: 'var(--color-bg-tertiary)',
              color: 'var(--color-text-tertiary)',
            }}
            className="rounded-md p-3 text-xs"
          >
            <p className="font-medium mb-1" style={{ color: 'var(--color-text-secondary)' }}>
              💡 Tips:
            </p>
            {authMethod === 'ADC' && (
              <ul className="list-disc list-inside space-y-1">
                <li>Run <code style={{ backgroundColor: 'var(--color-bg-code)' }} className="px-1 rounded">gcloud auth application-default login</code></li>
                <li>Set <code style={{ backgroundColor: 'var(--color-bg-code)' }} className="px-1 rounded">PUBSUB_EMULATOR_HOST</code> for local emulator</li>
              </ul>
            )}
            {authMethod === 'ServiceAccount' && (
              <ul className="list-disc list-inside space-y-1">
                <li>Create a service account in GCP Console</li>
                <li>Grant Pub/Sub permissions (e.g., Pub/Sub Editor role)</li>
                <li>Download the JSON key file and paste the full path here</li>
              </ul>
            )}
            {authMethod === 'OAuth' && (
              <ul className="list-disc list-inside space-y-1">
                <li>Create OAuth 2.0 Client ID (Desktop app) in GCP Console</li>
                <li>Download the JSON file and paste the full path here</li>
                <li>Your browser will open for Google sign-in</li>
              </ul>
            )}
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            borderTopColor: 'var(--color-border-primary)',
          }}
          className="px-6 py-4 border-t flex justify-end gap-3"
        >
          <button
            onClick={onClose}
            disabled={loading}
            style={{
              color: 'var(--color-text-tertiary)',
            }}
            className="px-4 py-2 transition-colors disabled:opacity-50"
            onMouseEnter={(e) => {
              if (!loading) e.currentTarget.style.color = 'var(--color-text-primary)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'var(--color-text-tertiary)';
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleConnect}
            disabled={
              !projectId.trim() ||
              (authMethod === 'ServiceAccount' && !serviceAccountPath.trim()) ||
              (authMethod === 'OAuth' && !oauthClientPath.trim()) ||
              loading ||
              (saveAsProfile && !profileName.trim())
            }
            style={{
              backgroundColor: 'var(--color-accent-primary)',
              color: 'var(--color-text-primary)',
            }}
            className="px-4 py-2 rounded-md transition-colors disabled:opacity-50"
            onMouseEnter={(e) => {
              if (!e.currentTarget.disabled) {
                e.currentTarget.style.backgroundColor = 'var(--color-accent-hover)';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--color-accent-primary)';
            }}
            onMouseDown={(e) => {
              if (!e.currentTarget.disabled) {
                e.currentTarget.style.backgroundColor = 'var(--color-accent-active)';
              }
            }}
            onMouseUp={(e) => {
              if (!e.currentTarget.disabled) {
                e.currentTarget.style.backgroundColor = 'var(--color-accent-hover)';
              }
            }}
          >
            {loading ? 'Connecting...' : 'Connect'}
          </button>
        </div>
      </div>
    </div>
  );
}
