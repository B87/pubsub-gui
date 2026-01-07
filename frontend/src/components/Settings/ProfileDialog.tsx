import { useState, useEffect } from 'react';
import type { ConnectionProfile } from '../../types';
import { Button, Input, Label, FormField, Checkbox, Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, Alert, AlertDescription } from '../ui';

interface ProfileDialogProps {
  profile: ConnectionProfile | null;
  onSave: (profile: ConnectionProfile) => Promise<void>;
  onClose: () => void;
  error?: string;
}

export default function ProfileDialog({ profile, onSave, onClose, error: externalError }: ProfileDialogProps) {
  const isEdit = !!profile;
  const [formData, setFormData] = useState({
    name: profile?.name || '',
    projectId: profile?.projectId || '',
    authMethod: (profile?.authMethod || 'ADC') as 'ADC' | 'ServiceAccount' | 'OAuth',
    serviceAccountPath: profile?.serviceAccountPath || '',
    oauthClientPath: profile?.oauthClientPath || '',
    emulatorHost: profile?.emulatorHost || '',
    isDefault: profile?.isDefault || false,
  });
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
        emulatorHost: profile.emulatorHost || '',
        isDefault: profile.isDefault,
      });
    } else {
      setFormData({
        name: '',
        projectId: '',
        authMethod: 'ADC',
        serviceAccountPath: '',
        oauthClientPath: '',
        emulatorHost: '',
        isDefault: false,
      });
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

    setSaving(true);
    try {
      const profileToSave: ConnectionProfile = {
        id: profile?.id || Date.now().toString(),
        name: formData.name.trim(),
        projectId: formData.projectId.trim(),
        authMethod: formData.authMethod,
        serviceAccountPath: formData.authMethod === 'ServiceAccount' ? formData.serviceAccountPath.trim() : undefined,
        oauthClientPath: formData.authMethod === 'OAuth' ? formData.oauthClientPath.trim() : undefined,
        emulatorHost: formData.emulatorHost.trim() || undefined,
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
                    className="text-blue-400 hover:underline"
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

          {/* Emulator Host */}
          <FormField
            label="Emulator Host"
            helperText="Leave empty for production GCP"
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
              (formData.authMethod === 'OAuth' && !formData.oauthClientPath.trim())
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
