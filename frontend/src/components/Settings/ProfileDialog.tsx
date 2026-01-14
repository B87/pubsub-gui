import { useState, useEffect } from 'react';
import type { ConnectionProfile, EmulatorMode, ManagedEmulatorConfig } from '../../types';
import { Button, Input, Label, FormField, Checkbox, Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, Alert, AlertDescription } from '../ui';

interface ProfileDialogProps {
  profile: ConnectionProfile | null;
  onSave: (profile: ConnectionProfile) => Promise<void>;
  onClose: () => void;
  error?: string;
}

// Helper to get effective emulator mode (migration logic)
function getEffectiveEmulatorMode(profile: ConnectionProfile | null): EmulatorMode {
  if (profile?.emulatorMode) {
    return profile.emulatorMode;
  }
  // Migration: if emulatorHost is set, treat as external mode
  if (profile?.emulatorHost) {
    return 'external';
  }
  return 'off';
}

// Default managed emulator config
const defaultManagedConfig: ManagedEmulatorConfig = {
  port: 8085,
  image: 'google/cloud-sdk:emulators',
  autoStart: true,
  autoStop: true,
  bindAddress: '127.0.0.1',
};

export default function ProfileDialog({ profile, onSave, onClose, error: externalError }: ProfileDialogProps) {
  const isEdit = !!profile;
  const [formData, setFormData] = useState({
    name: profile?.name || '',
    projectId: profile?.projectId || '',
    authMethod: (profile?.authMethod || 'ADC') as 'ADC' | 'ServiceAccount' | 'OAuth',
    serviceAccountPath: profile?.serviceAccountPath || '',
    oauthClientPath: profile?.oauthClientPath || '',
    emulatorHost: profile?.emulatorHost || 'localhost:8085',
    isDefault: profile?.isDefault || false,
  });
  const [emulatorMode, setEmulatorMode] = useState<EmulatorMode>(getEffectiveEmulatorMode(profile));
  const [managedConfig, setManagedConfig] = useState<ManagedEmulatorConfig>(
    profile?.managedEmulator || { ...defaultManagedConfig }
  );
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (profile) {
      setFormData({
        name: profile.name,
        projectId: profile.projectId,
        authMethod: profile.authMethod,
        serviceAccountPath: profile.serviceAccountPath || '',
        oauthClientPath: profile.oauthClientPath || '',
        emulatorHost: profile.emulatorHost || 'localhost:8085',
        isDefault: profile.isDefault,
      });
      setEmulatorMode(getEffectiveEmulatorMode(profile));
      setManagedConfig(profile.managedEmulator || { ...defaultManagedConfig });
    } else {
      setFormData({
        name: '',
        projectId: '',
        authMethod: 'ADC',
        serviceAccountPath: '',
        oauthClientPath: '',
        emulatorHost: 'localhost:8085',
        isDefault: false,
      });
      setEmulatorMode('off');
      setManagedConfig({ ...defaultManagedConfig });
    }
    setError('');
  }, [profile]);

  const handleSave = async () => {
    setError('');

    // Validation
    if (!formData.name.trim()) {
      setError('Profile name is required');
      return;
    }
    if (!formData.projectId.trim()) {
      setError('Project ID is required');
      return;
    }
    if (formData.authMethod === 'ServiceAccount' && !formData.serviceAccountPath.trim()) {
      setError('Service account path is required when using ServiceAccount auth method');
      return;
    }
    if (formData.authMethod === 'OAuth' && !formData.oauthClientPath.trim()) {
      setError('OAuth client path is required when using OAuth auth method');
      return;
    }
    if (emulatorMode === 'external' && !formData.emulatorHost.trim()) {
      setError('Emulator host is required for external emulator mode');
      return;
    }
    if (emulatorMode === 'managed' && (managedConfig.port < 1 || managedConfig.port > 65535)) {
      setError('Port must be between 1 and 65535');
      return;
    }

    setSaving(true);
    try {
      const profileToSave: ConnectionProfile = {
        id: profile?.id || Date.now().toString(),
        name: formData.name.trim(),
        projectId: formData.projectId.trim(),
        authMethod: formData.authMethod,
        serviceAccountPath: formData.authMethod === 'ServiceAccount' ? formData.serviceAccountPath.trim() : undefined,
        oauthClientPath: formData.authMethod === 'OAuth' ? formData.oauthClientPath.trim() : undefined,
        emulatorMode: emulatorMode,
        emulatorHost: emulatorMode === 'external' ? formData.emulatorHost.trim() : undefined,
        managedEmulator: emulatorMode === 'managed' ? managedConfig : undefined,
        isDefault: formData.isDefault,
        createdAt: profile?.createdAt || new Date().toISOString(),
      };
      await onSave(profileToSave);
    } catch (e: any) {
      setError(e.toString());
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={true} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? 'Edit Connection Profile' : 'Create Connection Profile'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Name */}
          <FormField
            label="Profile Name"
            required
          >
            <Input
              id="profile-name"
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Production, Staging, etc."
              disabled={saving}
            />
          </FormField>

          {/* Project ID */}
          <FormField
            label="GCP Project ID"
            required
          >
            <Input
              id="project-id"
              type="text"
              value={formData.projectId}
              onChange={(e) => setFormData({ ...formData, projectId: e.target.value })}
              placeholder="my-gcp-project"
              disabled={saving}
            />
          </FormField>

          {/* Auth Method */}
          <FormField
            label="Authentication Method"
            required
          >
            <div className="flex gap-2">
              <Button
                type="button"
                variant={formData.authMethod === 'ADC' ? 'default' : 'outline'}
                onClick={() => setFormData({ ...formData, authMethod: 'ADC' })}
                disabled={saving}
                className="flex-1"
              >
                ADC
              </Button>
              <Button
                type="button"
                variant={formData.authMethod === 'ServiceAccount' ? 'default' : 'outline'}
                onClick={() => setFormData({ ...formData, authMethod: 'ServiceAccount' })}
                disabled={saving}
                className="flex-1"
              >
                Service Account
              </Button>
              <Button
                type="button"
                variant={formData.authMethod === 'OAuth' ? 'default' : 'outline'}
                onClick={() => setFormData({ ...formData, authMethod: 'OAuth' })}
                disabled={saving}
                className="flex-1"
              >
                OAuth
              </Button>
            </div>
          </FormField>

          {/* Service Account Path */}
          {formData.authMethod === 'ServiceAccount' && (
            <FormField
              label="Service Account JSON Path"
              required
            >
              <Input
                id="service-account-path"
                type="text"
                value={formData.serviceAccountPath}
                onChange={(e) => setFormData({ ...formData, serviceAccountPath: e.target.value })}
                placeholder="/path/to/service-account.json"
                disabled={saving}
              />
            </FormField>
          )}

          {/* OAuth Client Path */}
          {formData.authMethod === 'OAuth' && (
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
                    style={{ color: 'var(--link-color)' }}
                    className="hover:underline"
                  >
                    GCP Console - APIs & Services - Credentials
                  </a>
                </>
              }
            >
              <Input
                id="oauth-client-path"
                type="text"
                value={formData.oauthClientPath}
                onChange={(e) => setFormData({ ...formData, oauthClientPath: e.target.value })}
                placeholder="/path/to/client_secret_*.json"
                disabled={saving}
              />
            </FormField>
          )}

          {/* Emulator Mode */}
          <FormField
            label="Emulator Mode"
            helperText="Use a local Pub/Sub emulator instead of production GCP"
          >
            <div className="flex gap-2">
              <Button
                type="button"
                variant={emulatorMode === 'off' ? 'default' : 'outline'}
                onClick={() => setEmulatorMode('off')}
                disabled={saving}
                className="flex-1"
                size="sm"
              >
                Off
              </Button>
              <Button
                type="button"
                variant={emulatorMode === 'external' ? 'default' : 'outline'}
                onClick={() => setEmulatorMode('external')}
                disabled={saving}
                className="flex-1"
                size="sm"
              >
                External
              </Button>
              <Button
                type="button"
                variant={emulatorMode === 'managed' ? 'default' : 'outline'}
                onClick={() => setEmulatorMode('managed')}
                disabled={saving}
                className="flex-1"
                size="sm"
              >
                Managed
              </Button>
            </div>
          </FormField>

          {/* External Emulator Host */}
          {emulatorMode === 'external' && (
            <div className="ml-4 pl-4 border-l-2" style={{ borderColor: 'var(--color-border-primary)' }}>
              <FormField
                label="Emulator Host"
                required
                helperText="Address of an externally running emulator"
              >
                <Input
                  id="emulator-host"
                  type="text"
                  value={formData.emulatorHost}
                  onChange={(e) => setFormData({ ...formData, emulatorHost: e.target.value })}
                  placeholder="localhost:8085"
                  disabled={saving}
                />
              </FormField>
            </div>
          )}

          {/* Managed Emulator Settings */}
          {emulatorMode === 'managed' && (
            <div className="ml-4 pl-4 border-l-2 space-y-3" style={{ borderColor: 'var(--color-border-primary)' }}>
              <FormField
                label="Port"
                helperText="Host port for the emulator"
              >
                <Input
                  id="emulator-port"
                  type="number"
                  value={managedConfig.port}
                  onChange={(e) => setManagedConfig({ ...managedConfig, port: parseInt(e.target.value) || 8085 })}
                  placeholder="8085"
                  disabled={saving}
                />
              </FormField>

              <div className="flex items-center gap-2">
                <Checkbox
                  id="auto-start"
                  checked={managedConfig.autoStart}
                  onCheckedChange={(checked) => setManagedConfig({ ...managedConfig, autoStart: checked === true })}
                  disabled={saving}
                />
                <Label htmlFor="auto-start" className="text-sm cursor-pointer">
                  Auto-start on connect
                </Label>
              </div>

              <div className="flex items-center gap-2">
                <Checkbox
                  id="auto-stop"
                  checked={managedConfig.autoStop}
                  onCheckedChange={(checked) => setManagedConfig({ ...managedConfig, autoStop: checked === true })}
                  disabled={saving}
                />
                <Label htmlFor="auto-stop" className="text-sm cursor-pointer">
                  Auto-stop on disconnect
                </Label>
              </div>

              {/* Advanced settings toggle */}
              <button
                type="button"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="text-xs hover:underline"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                {showAdvanced ? 'Hide advanced settings' : 'Show advanced settings'}
              </button>

              {showAdvanced && (
                <div className="space-y-3 pt-2">
                  <FormField
                    label="Docker Image"
                    helperText="Docker image for the emulator"
                  >
                    <Input
                      id="emulator-image"
                      type="text"
                      value={managedConfig.image || ''}
                      onChange={(e) => setManagedConfig({ ...managedConfig, image: e.target.value })}
                      placeholder="google/cloud-sdk:emulators"
                      disabled={saving}
                    />
                  </FormField>

                  <FormField
                    label="Data Directory"
                    helperText="Optional: Persist emulator data to this directory"
                  >
                    <Input
                      id="emulator-data-dir"
                      type="text"
                      value={managedConfig.dataDir || ''}
                      onChange={(e) => setManagedConfig({ ...managedConfig, dataDir: e.target.value })}
                      placeholder="/path/to/emulator-data"
                      disabled={saving}
                    />
                  </FormField>

                  <FormField
                    label="Bind Address"
                    helperText="127.0.0.1 (localhost only) or 0.0.0.0 (LAN access)"
                  >
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant={managedConfig.bindAddress === '127.0.0.1' ? 'default' : 'outline'}
                        onClick={() => setManagedConfig({ ...managedConfig, bindAddress: '127.0.0.1' })}
                        disabled={saving}
                        size="sm"
                        className="flex-1"
                      >
                        Localhost
                      </Button>
                      <Button
                        type="button"
                        variant={managedConfig.bindAddress === '0.0.0.0' ? 'default' : 'outline'}
                        onClick={() => setManagedConfig({ ...managedConfig, bindAddress: '0.0.0.0' })}
                        disabled={saving}
                        size="sm"
                        className="flex-1"
                      >
                        All Interfaces
                      </Button>
                    </div>
                  </FormField>
                </div>
              )}
            </div>
          )}

          {/* Is Default */}
          <div className="flex items-center gap-2">
            <Checkbox
              id="is-default"
              checked={formData.isDefault}
              onCheckedChange={(checked) => setFormData({ ...formData, isDefault: checked === true })}
              disabled={saving}
            />
            <Label htmlFor="is-default" className="text-sm">
              Set as default connection profile
            </Label>
          </div>

          {/* Error */}
          {(error || externalError) && (
            <Alert variant="destructive" showIcon>
              <AlertDescription>{error || externalError}</AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={
              saving ||
              !formData.name.trim() ||
              !formData.projectId.trim() ||
              (formData.authMethod === 'ServiceAccount' && !formData.serviceAccountPath.trim()) ||
              (formData.authMethod === 'OAuth' && !formData.oauthClientPath.trim()) ||
              (emulatorMode === 'external' && !formData.emulatorHost.trim())
            }
            loading={saving}
          >
            {isEdit ? 'Save' : 'Create'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
