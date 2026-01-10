import { useState } from 'react';
import { Plus, Edit2, Trash2 } from 'lucide-react';
import { models } from '../../wailsjs/go/models';
import { Button, Alert, AlertDescription } from '../ui';

interface TemplatesTabProps {
  templates: models.TopicSubscriptionTemplate[];
  loadingTemplates: boolean;
  error?: string;
  onCreate: () => void;
  onEdit: (template: models.TopicSubscriptionTemplate) => void;
  onDelete: (template: models.TopicSubscriptionTemplate) => void;
}

export default function TemplatesTab({
  templates,
  loadingTemplates,
  error,
  onCreate,
  onEdit,
  onDelete,
}: TemplatesTabProps) {
  const customTemplates = templates.filter(t => !t.isBuiltIn);

  return (
    <div className="space-y-4">
      {/* Header with Create Button */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium" style={{ color: 'var(--color-text-primary)' }}>
            Custom Templates
          </h3>
          <p className="text-sm mt-1" style={{ color: 'var(--color-text-secondary)' }}>
            Create and manage your own topic/subscription templates
          </p>
        </div>
        <Button onClick={onCreate}>
          <Plus className="w-4 h-4 mr-1" />
          Create Template
        </Button>
      </div>

      {/* Error Message */}
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Loading State */}
      {loadingTemplates && (
        <div className="flex items-center justify-center py-8">
          <div style={{ color: 'var(--color-text-muted)' }}>Loading templates...</div>
        </div>
      )}

      {/* Templates List */}
      {!loadingTemplates && customTemplates.length === 0 && (
        <div
          style={{
            backgroundColor: 'var(--color-bg-tertiary)',
            borderColor: 'var(--color-border-primary)',
          }}
          className="border rounded-lg p-8 text-center"
        >
          <p style={{ color: 'var(--color-text-secondary)' }} className="mb-2">
            No custom templates yet
          </p>
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
            Create your first template to get started
          </p>
        </div>
      )}

      {!loadingTemplates && customTemplates.length > 0 && (
        <div className="space-y-3">
          {customTemplates.map((template) => (
            <div
              key={template.id}
              style={{
                backgroundColor: 'var(--color-bg-tertiary)',
                borderColor: 'var(--color-border-primary)',
              }}
              className="border rounded-lg p-4"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                      {template.name}
                    </h4>
                    <span
                      style={{
                        backgroundColor: 'var(--color-bg-secondary)',
                        color: 'var(--color-text-secondary)',
                      }}
                      className="text-xs px-2 py-0.5 rounded capitalize"
                    >
                      {template.category}
                    </span>
                  </div>
                  <p className="text-sm mb-2" style={{ color: 'var(--color-text-secondary)' }}>
                    {template.description || 'No description'}
                  </p>
                  <div className="flex items-center gap-4 text-xs" style={{ color: 'var(--color-text-muted)' }}>
                    <span>{template.subscriptions.length} subscription{template.subscriptions.length !== 1 ? 's' : ''}</span>
                    {template.deadLetter && <span>DLQ</span>}
                    {template.subscriptions.some(s => s.enableExactlyOnce) && <span>Exactly-once</span>}
                  </div>
                </div>
                <div className="flex gap-2 ml-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onEdit(template)}
                    title="Edit template"
                  >
                    <Edit2 className="w-4 h-4 mr-1" />
                    Edit
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => onDelete(template)}
                    title="Delete template"
                  >
                    <Trash2 className="w-4 h-4 mr-1" />
                    Delete
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
