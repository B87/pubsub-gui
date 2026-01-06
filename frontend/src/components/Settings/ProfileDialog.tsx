import { useState, useEffect } from 'react';
import type { ConnectionProfile } from '../../types';

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
    <div
      style={{
        backgroundColor: 'color-mix(in srgb, var(--color-bg-primary) 50%, transparent)',
        zIndex: 60,
      }}
      className="fixed inset-0 flex items-center justify-center"
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: 'var(--color-bg-secondary)',
          borderColor: 'var(--color-border-primary)',
          color: 'var(--color-text-primary)',
        }}
        className="border rounded-lg p-6 max-w-md w-full mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--color-text-primary)' }}>
          {isEdit ? 'Edit Connection Profile' : 'Create Connection Profile'}
        </h3>

        <div className="space-y-4">
          {/* Name */}
          <div>
            <label htmlFor="profile-name" className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text-primary)' }}>
              Profile Name *
            </label>
            <input
              id="profile-name"
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Production, Staging, etc."
              disabled={saving}
              style={{
                backgroundColor: 'var(--color-bg-input)',
                color: 'var(--color-text-primary)',
                borderColor: 'var(--color-border-primary)',
              }}
              className="w-full px-3 py-2 rounded-md text-sm transition-colors focus:outline-none focus:ring-2"
              onFocus={(e) => e.currentTarget.style.borderColor = 'var(--color-accent-primary)'}
              onBlur={(e) => e.currentTarget.style.borderColor = 'var(--color-border-primary)'}
            />
          </div>

          {/* Project ID */}
          <div>
            <label htmlFor="project-id" className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text-primary)' }}>
              GCP Project ID *
            </label>
            <input
              id="project-id"
              type="text"
              value={formData.projectId}
              onChange={(e) => setFormData({ ...formData, projectId: e.target.value })}
              placeholder="my-gcp-project"
              disabled={saving}
              style={{
                backgroundColor: 'var(--color-bg-input)',
                color: 'var(--color-text-primary)',
                borderColor: 'var(--color-border-primary)',
              }}
              className="w-full px-3 py-2 rounded-md text-sm transition-colors focus:outline-none focus:ring-2"
              onFocus={(e) => e.currentTarget.style.borderColor = 'var(--color-accent-primary)'}
              onBlur={(e) => e.currentTarget.style.borderColor = 'var(--color-border-primary)'}
            />
          </div>

          {/* Auth Method */}
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text-primary)' }}>
              Authentication Method *
            </label>
            <div className="flex gap-2">
              <button
                onClick={() => setFormData({ ...formData, authMethod: 'ADC' })}
                disabled={saving}
                style={{
                  backgroundColor: formData.authMethod === 'ADC' ? 'var(--color-accent-primary)' : 'var(--color-bg-tertiary)',
                  color: formData.authMethod === 'ADC' ? 'white' : 'var(--color-text-primary)',
                }}
                className="flex-1 px-4 py-2 rounded-md text-sm transition-opacity hover:opacity-90 disabled:opacity-50"
                onMouseEnter={(e) => {
                  if (formData.authMethod !== 'ADC') {
                    e.currentTarget.style.backgroundColor = 'var(--color-bg-hover)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (formData.authMethod !== 'ADC') {
                    e.currentTarget.style.backgroundColor = 'var(--color-bg-tertiary)';
                  }
                }}
              >
                ADC
              </button>
              <button
                onClick={() => setFormData({ ...formData, authMethod: 'ServiceAccount' })}
                disabled={saving}
                style={{
                  backgroundColor: formData.authMethod === 'ServiceAccount' ? 'var(--color-accent-primary)' : 'var(--color-bg-tertiary)',
                  color: formData.authMethod === 'ServiceAccount' ? 'white' : 'var(--color-text-primary)',
                }}
                className="flex-1 px-4 py-2 rounded-md text-sm transition-opacity hover:opacity-90 disabled:opacity-50"
                onMouseEnter={(e) => {
                  if (formData.authMethod !== 'ServiceAccount') {
                    e.currentTarget.style.backgroundColor = 'var(--color-bg-hover)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (formData.authMethod !== 'ServiceAccount') {
                    e.currentTarget.style.backgroundColor = 'var(--color-bg-tertiary)';
                  }
                }}
              >
                Service Account
              </button>
              <button
                onClick={() => setFormData({ ...formData, authMethod: 'OAuth' })}
                disabled={saving}
                style={{
                  backgroundColor: formData.authMethod === 'OAuth' ? 'var(--color-accent-primary)' : 'var(--color-bg-tertiary)',
                  color: formData.authMethod === 'OAuth' ? 'white' : 'var(--color-text-primary)',
                }}
                className="flex-1 px-4 py-2 rounded-md text-sm transition-opacity hover:opacity-90 disabled:opacity-50"
                onMouseEnter={(e) => {
                  if (formData.authMethod !== 'OAuth') {
                    e.currentTarget.style.backgroundColor = 'var(--color-bg-hover)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (formData.authMethod !== 'OAuth') {
                    e.currentTarget.style.backgroundColor = 'var(--color-bg-tertiary)';
                  }
                }}
              >
                OAuth
              </button>
            </div>
          </div>

          {/* Service Account Path */}
          {formData.authMethod === 'ServiceAccount' && (
            <div>
              <label htmlFor="service-account-path" className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text-primary)' }}>
                Service Account JSON Path *
              </label>
              <input
                id="service-account-path"
                type="text"
                value={formData.serviceAccountPath}
                onChange={(e) => setFormData({ ...formData, serviceAccountPath: e.target.value })}
                placeholder="/path/to/service-account.json"
                disabled={saving}
                style={{
                  backgroundColor: 'var(--color-bg-input)',
                  color: 'var(--color-text-primary)',
                  borderColor: 'var(--color-border-primary)',
                }}
                className="w-full px-3 py-2 rounded-md text-sm transition-colors focus:outline-none focus:ring-2"
                onFocus={(e) => e.currentTarget.style.borderColor = 'var(--color-accent-primary)'}
                onBlur={(e) => e.currentTarget.style.borderColor = 'var(--color-border-primary)'}
              />
            </div>
          )}

          {/* OAuth Client Path */}
          {formData.authMethod === 'OAuth' && (
            <div>
              <label htmlFor="oauth-client-path" className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text-primary)' }}>
                OAuth Client JSON Path *
              </label>
              <input
                id="oauth-client-path"
                type="text"
                value={formData.oauthClientPath}
                onChange={(e) => setFormData({ ...formData, oauthClientPath: e.target.value })}
                placeholder="/path/to/client_secret_*.json"
                disabled={saving}
                style={{
                  backgroundColor: 'var(--color-bg-input)',
                  color: 'var(--color-text-primary)',
                  borderColor: 'var(--color-border-primary)',
                }}
                className="w-full px-3 py-2 rounded-md text-sm transition-colors focus:outline-none focus:ring-2"
                onFocus={(e) => e.currentTarget.style.borderColor = 'var(--color-accent-primary)'}
                onBlur={(e) => e.currentTarget.style.borderColor = 'var(--color-border-primary)'}
              />
              <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
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
              </p>
            </div>
          )}

          {/* Emulator Host */}
          <div>
            <label htmlFor="emulator-host" className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text-primary)' }}>
              Emulator Host (optional)
            </label>
            <input
              id="emulator-host"
              type="text"
              value={formData.emulatorHost}
              onChange={(e) => setFormData({ ...formData, emulatorHost: e.target.value })}
              placeholder="localhost:8085"
              disabled={saving}
              style={{
                backgroundColor: 'var(--color-bg-input)',
                color: 'var(--color-text-primary)',
                borderColor: 'var(--color-border-primary)',
              }}
              className="w-full px-3 py-2 rounded-md text-sm transition-colors focus:outline-none focus:ring-2"
              onFocus={(e) => e.currentTarget.style.borderColor = 'var(--color-accent-primary)'}
              onBlur={(e) => e.currentTarget.style.borderColor = 'var(--color-border-primary)'}
            />
            <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
              Leave empty for production GCP
            </p>
          </div>

          {/* Is Default */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={formData.isDefault}
              onChange={(e) => setFormData({ ...formData, isDefault: e.target.checked })}
              disabled={saving}
              className="w-4 h-4 rounded"
              style={{
                backgroundColor: formData.isDefault ? 'var(--color-accent-primary)' : 'var(--color-bg-input)',
                borderColor: 'var(--color-border-primary)',
              }}
            />
            <span className="text-sm" style={{ color: 'var(--color-text-primary)' }}>
              Set as default connection profile
            </span>
          </label>

          {/* Error */}
          {(error || externalError) && (
            <div
              style={{
                backgroundColor: 'var(--color-error-bg)',
                borderColor: 'var(--color-error-border)',
                color: 'var(--color-error)',
              }}
              className="p-3 border rounded-md text-sm"
            >
              {error || externalError}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 justify-end mt-6">
          <button
            onClick={onClose}
            disabled={saving}
            style={{
              color: 'var(--color-text-secondary)',
            }}
            className="px-4 py-2 rounded-md transition-colors hover:opacity-80 disabled:opacity-50"
            onMouseEnter={(e) => e.currentTarget.style.color = 'var(--color-text-primary)'}
            onMouseLeave={(e) => e.currentTarget.style.color = 'var(--color-text-secondary)'}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={
              saving ||
              !formData.name.trim() ||
              !formData.projectId.trim() ||
              (formData.authMethod === 'ServiceAccount' && !formData.serviceAccountPath.trim()) ||
              (formData.authMethod === 'OAuth' && !formData.oauthClientPath.trim())
            }
            style={{
              backgroundColor: 'var(--color-accent-primary)',
              color: 'white',
            }}
            className="px-4 py-2 rounded-md transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
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
            {saving ? 'Saving...' : isEdit ? 'Save' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
}
