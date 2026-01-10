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
  Checkbox,
  Label,
  Alert,
  AlertDescription,
} from './ui';

type AuthMethod = 'ADC' | 'ServiceAccount' | 'OAuth';

interface ConnectionDialogProps {
  open: boolean;
  onConnect: (projectId: string, authMethod: AuthMethod, serviceAccountPath?: string, oauthClientPath?: string, emulatorHost?: string, saveAsProfile?: { name: string; isDefault?: boolean }) => Promise<void>;
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
  const [useEmulator, setUseEmulator] = useState(false);
  const [emulatorHost, setEmulatorHost] = useState('localhost:8085');
  const [showEmulatorDocs, setShowEmulatorDocs] = useState(false);

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
        useEmulator ? (emulatorHost.trim() || 'localhost:8085') : undefined,
        saveProfile
      );
      setProjectId('');
      setServiceAccountPath('');
      setOAuthClientPath('');
      setSaveAsProfile(false);
      setProfileName('');
      setIsDefault(false);
      setUseEmulator(false);
      setEmulatorHost('localhost:8085');
      setShowEmulatorDocs(false);
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
    <Dialog open={open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Connect to Google Cloud Pub/Sub</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Auth Method Selection */}
          <div>
            <Label className="mb-2 block">Authentication Method</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={authMethod === 'ADC' ? 'default' : 'outline'}
                className="flex-1"
                onClick={() => setAuthMethod('ADC')}
                disabled={loading}
              >
                ADC
              </Button>
              <Button
                type="button"
                variant={authMethod === 'ServiceAccount' ? 'default' : 'outline'}
                className="flex-1"
                onClick={() => setAuthMethod('ServiceAccount')}
                disabled={loading}
              >
                Service Account
              </Button>
              <Button
                type="button"
                variant={authMethod === 'OAuth' ? 'default' : 'outline'}
                className="flex-1"
                onClick={() => setAuthMethod('OAuth')}
                disabled={loading}
              >
                OAuth
              </Button>
            </div>
          </div>

          {/* Help Text */}
          {authMethod === 'ADC' && (
            <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
              Connect using Application Default Credentials (ADC). Make sure you're authenticated with gcloud.
            </p>
          )}

          {authMethod === 'ServiceAccount' && (
            <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
              Connect using a service account JSON key file. Download from GCP Console → IAM & Admin → Service Accounts.
            </p>
          )}

          {authMethod === 'OAuth' && (
            <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
              Connect using your personal Google account. You'll need an OAuth client JSON file from GCP Console.
            </p>
          )}

          {/* Emulator Toggle */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Checkbox
                id="useEmulator"
                checked={useEmulator}
                onCheckedChange={(checked) => setUseEmulator(checked === true)}
                disabled={loading}
              />
              <Label htmlFor="useEmulator" className="cursor-pointer">
                Use local Pub/Sub emulator
              </Label>
            </div>

            {useEmulator && (
              <div className="ml-6 space-y-3">
                <FormField
                  label="Emulator Host"
                  helperText="Leave empty for default (localhost:8085)"
                >
                  <Input
                    value={emulatorHost}
                    onChange={(e) => setEmulatorHost(e.target.value)}
                    placeholder="localhost:8085"
                    disabled={loading}
                  />
                </FormField>

                {/* Expandable Documentation */}
                <div
                  className="border rounded-lg"
                  style={{ borderColor: 'var(--color-border-primary)' }}
                >
                  <button
                    type="button"
                    onClick={() => setShowEmulatorDocs(!showEmulatorDocs)}
                    className="w-full flex items-center justify-between p-3 hover:opacity-80 transition-opacity"
                    style={{ color: 'var(--color-text-primary)' }}
                  >
                    <span className="text-sm font-medium">What is the emulator?</span>
                    <svg
                      className="w-4 h-4 transition-transform"
                      style={{ transform: showEmulatorDocs ? 'rotate(180deg)' : 'none' }}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  {showEmulatorDocs && (
                    <div className="p-3 pt-0 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                      <p className="mb-2">The Pub/Sub emulator lets you test locally without connecting to GCP.</p>
                      <ul className="list-disc list-inside space-y-1 ml-2">
                        <li>No authentication required</li>
                        <li>No costs</li>
                        <li>Fast iteration</li>
                        <li>Data is ephemeral (lost when emulator stops)</li>
                      </ul>
                      <a
                        href="https://docs.cloud.google.com/pubsub/docs/emulator"
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: 'var(--color-accent-primary)' }}
                        className="text-xs mt-2 inline-block hover:underline"
                      >
                        View documentation →
                      </a>
                    </div>
                  )}
                </div>

                {/* Quick Start Helpers */}
                <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                  <p className="mb-2 font-medium">Quick start:</p>
                  <div className="space-y-1">
                    <code
                      className="block p-2 rounded text-xs"
                      style={{ backgroundColor: 'var(--color-bg-code)', color: 'var(--color-text-primary)' }}
                    >
                      gcloud beta emulators pubsub start
                    </code>
                    <p className="text-xs mt-1">Or with Docker:</p>
                    <code
                      className="block p-2 rounded text-xs"
                      style={{ backgroundColor: 'var(--color-bg-code)', color: 'var(--color-text-primary)' }}
                    >
                      docker run --rm -p 8085:8085 google/cloud-sdk:emulators gcloud beta emulators pubsub start --host-port=0.0.0.0:8085
                    </code>
                  </div>
                </div>
              </div>
            )}
          </div>

          <FormField label="GCP Project ID" required>
            <Input
              id="projectId"
              type="text"
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="my-gcp-project"
              disabled={loading}
              autoFocus
            />
          </FormField>

          {/* Service Account Path */}
          {authMethod === 'ServiceAccount' && (
            <FormField
              label="Service Account JSON Path"
              required
              helperText={
                <>
                  Download from{' '}
                  <a
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      window.open('https://console.cloud.google.com/iam-admin/serviceaccounts', '_blank');
                    }}
                    style={{ color: 'var(--color-accent-primary)' }}
                    className="hover:underline"
                  >
                    GCP Console → IAM & Admin → Service Accounts
                  </a>
                </>
              }
            >
              <Input
                id="serviceAccount"
                type="text"
                value={serviceAccountPath}
                onChange={(e) => setServiceAccountPath(e.target.value)}
                placeholder="Path to service-account.json"
                disabled={loading}
              />
            </FormField>
          )}

          {/* OAuth Client File Selection */}
          {authMethod === 'OAuth' && (
            <FormField
              label="OAuth Client JSON Path"
              required
              helperText={
                <>
                  Download from{' '}
                  <a
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      window.open('https://console.cloud.google.com/apis/credentials', '_blank');
                    }}
                    style={{ color: 'var(--color-accent-primary)' }}
                    className="hover:underline"
                  >
                    GCP Console → APIs & Services → Credentials
                  </a>
                </>
              }
            >
              <Input
                id="oauthClient"
                type="text"
                value={oauthClientPath}
                onChange={(e) => setOAuthClientPath(e.target.value)}
                placeholder="Path to client_secret_*.json"
                disabled={loading}
              />
            </FormField>
          )}

          {/* Save as Connection Profile */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Checkbox
                id="saveAsProfile"
                checked={saveAsProfile}
                onCheckedChange={(checked) => setSaveAsProfile(checked === true)}
                disabled={loading}
              />
              <Label htmlFor="saveAsProfile" className="cursor-pointer">
                Save as connection profile
              </Label>
            </div>

            {saveAsProfile && (
              <div className="ml-6 space-y-3">
                <FormField label="Connection Name">
                  <Input
                    id="profileName"
                    type="text"
                    value={profileName}
                    onChange={(e) => setProfileName(e.target.value)}
                    placeholder="Production, Staging, etc."
                    disabled={loading}
                  />
                </FormField>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="isDefault"
                    checked={isDefault}
                    onCheckedChange={(checked) => setIsDefault(checked === true)}
                    disabled={loading}
                  />
                  <Label htmlFor="isDefault" className="cursor-pointer">
                    Set as default connection
                  </Label>
                </div>
              </div>
            )}
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div
            className="rounded-md p-3 text-xs"
            style={{
              backgroundColor: 'var(--color-bg-tertiary)',
              color: 'var(--color-text-secondary)',
            }}
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

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            onClick={handleConnect}
            disabled={
              !projectId.trim() ||
              (authMethod === 'ServiceAccount' && !serviceAccountPath.trim()) ||
              (authMethod === 'OAuth' && !oauthClientPath.trim()) ||
              loading ||
              (saveAsProfile && !profileName.trim())
            }
            loading={loading}
          >
            Connect
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
