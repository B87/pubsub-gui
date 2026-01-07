import { useState, useEffect } from 'react';
import type { MessageTemplate } from '../types';
import { GetTemplates, UpdateTemplate, DeleteTemplate } from '../../wailsjs/go/main/App';
import JsonEditor from './JsonEditor';
import { Button, Input, FormField, Badge, Alert, AlertDescription } from './ui';
import { X } from 'lucide-react';

interface TemplateManagerProps {
  open: boolean;
  onClose: () => void;
  currentTopicId?: string;
}

export default function TemplateManager({ open, onClose, currentTopicId }: TemplateManagerProps) {
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [editingTemplate, setEditingTemplate] = useState<MessageTemplate | null>(null);
  const [editName, setEditName] = useState<string>('');
  const [editPayload, setEditPayload] = useState<string>('');
  const [editAttributes, setEditAttributes] = useState<Array<{ key: string; value: string }>>([]);
  const [editTopicId, setEditTopicId] = useState<string>('');
  const [error, setError] = useState<string>('');

  useEffect(() => {
    if (open) {
      loadTemplates();
    }
  }, [open, currentTopicId]);

  const loadTemplates = async () => {
    try {
      const t = await GetTemplates(currentTopicId || '');
      setTemplates(t as MessageTemplate[]);
      setError('');
    } catch (e: any) {
      setError('Failed to load templates: ' + e.toString());
    }
  };

  const handleEdit = (template: MessageTemplate) => {
    setEditingTemplate(template);
    setEditName(template.name);
    // Set default empty JSON if template payload is empty
    const payloadValue = template.payload?.trim() || '{\n\n}';
    setEditPayload(payloadValue);
    setEditTopicId(template.topicId || '');
    // Convert attributes object to array
    const attrs = Object.entries(template.attributes || {}).map(([key, value]) => ({ key, value }));
    if (attrs.length === 0) {
      attrs.push({ key: '', value: '' });
    }
    setEditAttributes(attrs);
  };

  const handlePayloadChange = (value: string) => {
    setEditPayload(value);
  };

  const handleSaveEdit = async () => {
    if (!editingTemplate) return;

    if (!editName.trim()) {
      setError('Template name is required');
      return;
    }

    // Build attributes object
    const attrsObj: Record<string, string> = {};
    editAttributes.forEach(attr => {
      if (attr.key.trim()) {
        attrsObj[attr.key.trim()] = attr.value;
      }
    });

    try {
      const template: MessageTemplate = {
        ...editingTemplate,
        name: editName.trim(),
        payload: editPayload,
        topicId: editTopicId || undefined,
        attributes: attrsObj,
        updatedAt: new Date().toISOString(),
      };

      await UpdateTemplate(editingTemplate.id, template);
      setEditingTemplate(null);
      await loadTemplates();
      setError('');
    } catch (e: any) {
      setError(e.toString());
    }
  };

  const handleDelete = async (templateId: string, templateName: string) => {
    if (!confirm(`Are you sure you want to delete template "${templateName}"?`)) {
      return;
    }

    try {
      await DeleteTemplate(templateId);
      await loadTemplates();
      setError('');
    } catch (e: any) {
      setError(e.toString());
    }
  };

  const handleAttributeChange = (index: number, field: 'key' | 'value', value: string) => {
    const newAttributes = [...editAttributes];
    newAttributes[index] = { ...newAttributes[index], [field]: value };
    setEditAttributes(newAttributes);
  };

  const addAttribute = () => {
    setEditAttributes([...editAttributes, { key: '', value: '' }]);
  };

  const removeAttribute = (index: number) => {
    if (editAttributes.length > 1) {
      setEditAttributes(editAttributes.filter((_, i) => i !== index));
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-slate-800 border border-slate-700 rounded-lg p-6 max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold">Manage Templates</h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
          >
            <X className="w-6 h-6" />
          </Button>
        </div>

        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {editingTemplate ? (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Edit Template</h3>

            <FormField label="Template Name" required>
              <Input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
              />
            </FormField>

            <FormField label="Topic ID (optional)" helperText="Leave empty for global template">
              <Input
                type="text"
                value={editTopicId}
                onChange={(e) => setEditTopicId(e.target.value)}
                placeholder="Leave empty for global template"
              />
            </FormField>

            <JsonEditor
              value={editPayload}
              onChange={handlePayloadChange}
            />

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-slate-400">
                  Attributes
                </label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={addAttribute}
                  className="h-auto py-1 px-3 text-sm"
                >
                  + Add
                </Button>
              </div>
              <div className="space-y-2">
                {editAttributes.map((attr, index) => (
                  <div key={index} className="flex gap-2">
                    <Input
                      type="text"
                      value={attr.key}
                      onChange={(e) => handleAttributeChange(index, 'key', e.target.value)}
                      placeholder="Key"
                      className="flex-1"
                    />
                    <Input
                      type="text"
                      value={attr.value}
                      onChange={(e) => handleAttributeChange(index, 'value', e.target.value)}
                      placeholder="Value"
                      className="flex-1"
                    />
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => removeAttribute(index)}
                      disabled={editAttributes.length === 1}
                      className="h-auto py-2 px-3"
                    >
                      Remove
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-3 justify-end">
              <Button
                variant="outline"
                onClick={() => {
                  setEditingTemplate(null);
                  setEditPayload('');
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSaveEdit}
              >
                Save
              </Button>
            </div>
          </div>
        ) : (
          <>
            {templates.length === 0 ? (
              <div className="text-center py-8 text-slate-400">
                No templates found. Create templates from the Publish tab.
              </div>
            ) : (
              <div className="space-y-3">
                {templates.map(template => (
                  <div
                    key={template.id}
                    className="p-4 bg-slate-900 border border-slate-700 rounded-lg"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="font-semibold">{template.name}</h3>
                          {template.topicId && (
                            <Badge variant="default">
                              Topic-specific
                            </Badge>
                          )}
                          {!template.topicId && (
                            <Badge variant="secondary">
                              Global
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-slate-400 mb-1">
                          Created: {new Date(template.createdAt).toLocaleString()}
                        </p>
                        <p className="text-sm text-slate-400">
                          Updated: {new Date(template.updatedAt).toLocaleString()}
                        </p>
                        {template.topicId && (
                          <p className="text-xs text-slate-500 mt-1 font-mono">
                            {template.topicId}
                          </p>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEdit(template)}
                          className="h-auto py-1 px-3 text-sm"
                        >
                          Edit
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDelete(template.id, template.name)}
                          className="h-auto py-1 px-3 text-sm"
                        >
                          Delete
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
