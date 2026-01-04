import { useState } from 'react';

interface ConnectionDialogProps {
  open: boolean;
  onConnect: (projectId: string, saveAsProfile?: { name: string; isDefault?: boolean }) => Promise<void>;
  onClose: () => void;
  error?: string;
}

export default function ConnectionDialog({ open, onConnect, onClose, error }: ConnectionDialogProps) {
  const [projectId, setProjectId] = useState('');
  const [loading, setLoading] = useState(false);
  const [saveAsProfile, setSaveAsProfile] = useState(false);
  const [profileName, setProfileName] = useState('');
  const [isDefault, setIsDefault] = useState(false);

  if (!open) return null;

  const handleConnect = async () => {
    if (!projectId.trim()) return;

    setLoading(true);
    try {
      const saveProfile = saveAsProfile && profileName.trim()
        ? { name: profileName.trim(), isDefault }
        : undefined;
      await onConnect(projectId.trim(), saveProfile);
      setProjectId('');
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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-slate-800 rounded-lg shadow-xl max-w-md w-full mx-4">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-700">
          <h2 className="text-xl font-semibold">Connect to Google Cloud Pub/Sub</h2>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <p className="text-sm text-slate-300">
            Connect using Application Default Credentials (ADC). Make sure you're authenticated with gcloud.
          </p>

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
            <div className="p-3 bg-red-900/50 border border-red-700 rounded-md text-red-200 text-sm">
              {error}
            </div>
          )}

          <div className="bg-slate-700 rounded-md p-3 text-xs text-slate-300">
            <p className="font-medium mb-1">💡 Tips:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Run <code className="bg-slate-800 px-1 rounded">gcloud auth application-default login</code></li>
              <li>Set <code className="bg-slate-800 px-1 rounded">PUBSUB_EMULATOR_HOST</code> for local emulator</li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-700 flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 text-slate-300 hover:text-white transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleConnect}
            disabled={!projectId.trim() || loading || (saveAsProfile && !profileName.trim())}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 disabled:opacity-50 text-white rounded-md transition-colors"
          >
            {loading ? 'Connecting...' : 'Connect'}
          </button>
        </div>
      </div>
    </div>
  );
}
