import { useState, useEffect } from 'react';
import { models } from '../../wailsjs/go/models';
import { Button, Input, Label, FormField, Select, SelectTrigger, SelectContent, SelectItem, SelectValue, Checkbox, Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, Alert, AlertDescription } from '../ui';

interface TemplateDialogProps {
  template: models.TopicSubscriptionTemplate | null;
  onSave: (template: models.TopicSubscriptionTemplate) => Promise<void>;
  onClose: () => void;
  error?: string;
}

export default function TemplateDialog({ template, onSave, onClose, error: externalError }: TemplateDialogProps) {
  const isEdit = !!template;
  const [formData, setFormData] = useState({
    id: template?.id || '',
    name: template?.name || '',
    description: template?.description || '',
    category: (template?.category || 'production') as 'production' | 'development' | 'specialized',
    // Topic config
    topicRetention: template?.topic?.messageRetentionDuration || '',
    // Subscription config (first subscription)
    subscriptionName: template?.subscriptions?.[0]?.name || 'sub',
    ackDeadline: template?.subscriptions?.[0]?.ackDeadline || 30,
    retentionDuration: template?.subscriptions?.[0]?.retentionDuration || '',
    enableExactlyOnce: template?.subscriptions?.[0]?.enableExactlyOnce || false,
    enableOrdering: template?.subscriptions?.[0]?.enableOrdering || false,
    filter: template?.subscriptions?.[0]?.filter || '',
    // Dead letter
    hasDeadLetter: !!template?.deadLetter,
    maxDeliveryAttempts: template?.deadLetter?.maxDeliveryAttempts || 5,
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (template) {
      setFormData({
        id: template.id,
        name: template.name,
        description: template.description,
        category: template.category as 'production' | 'development' | 'specialized',
        topicRetention: template.topic?.messageRetentionDuration || '',
        subscriptionName: template.subscriptions?.[0]?.name || 'sub',
        ackDeadline: template.subscriptions?.[0]?.ackDeadline || 30,
        retentionDuration: template.subscriptions?.[0]?.retentionDuration || '',
        enableExactlyOnce: template.subscriptions?.[0]?.enableExactlyOnce || false,
        enableOrdering: template.subscriptions?.[0]?.enableOrdering || false,
        filter: template.subscriptions?.[0]?.filter || '',
        hasDeadLetter: !!template.deadLetter,
        maxDeliveryAttempts: template.deadLetter?.maxDeliveryAttempts || 5,
      });
    } else {
      setFormData({
        id: '',
        name: '',
        description: '',
        category: 'production',
        topicRetention: '',
        subscriptionName: 'sub',
        ackDeadline: 30,
        retentionDuration: '',
        enableExactlyOnce: false,
        enableOrdering: false,
        filter: '',
        hasDeadLetter: false,
        maxDeliveryAttempts: 5,
      });
    }
    setError('');
  }, [template]);

  const handleSave = async () => {
    setError('');

    // Validation
    if (!formData.name.trim()) {
      setError('Template name is required');
      return;
    }
    if (formData.ackDeadline < 10 || formData.ackDeadline > 600) {
      setError('Ack deadline must be between 10 and 600 seconds');
      return;
    }
    if (formData.hasDeadLetter && (formData.maxDeliveryAttempts < 5 || formData.maxDeliveryAttempts > 100)) {
      setError('Max delivery attempts must be between 5 and 100');
      return;
    }

    setSaving(true);
    try {
      // Build template structure using createFrom
      const topicConfig = models.TopicTemplateConfig.createFrom({
        messageRetentionDuration: formData.topicRetention || undefined,
      });

      const subscriptionConfig = models.SubscriptionTemplateConfig.createFrom({
        name: formData.subscriptionName,
        ackDeadline: formData.ackDeadline,
        retentionDuration: formData.retentionDuration || undefined,
        enableExactlyOnce: formData.enableExactlyOnce,
        enableOrdering: formData.enableOrdering,
        filter: formData.filter || undefined,
      });

      const deadLetterConfig = formData.hasDeadLetter
        ? models.DeadLetterTemplateConfig.createFrom({
            maxDeliveryAttempts: formData.maxDeliveryAttempts,
          })
        : undefined;

      // Generate ID if not provided (for new templates)
      const templateId = isEdit && formData.id.trim()
        ? formData.id.trim()
        : formData.id.trim() || `custom-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

      const templateToSave = models.TopicSubscriptionTemplate.createFrom({
        id: templateId,
        name: formData.name.trim(),
        description: formData.description.trim(),
        category: formData.category,
        isBuiltIn: false,
        topic: topicConfig,
        subscriptions: [subscriptionConfig],
        deadLetter: deadLetterConfig,
      });

      await onSave(templateToSave);
    } catch (e: any) {
      setError(e.toString());
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={true} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="px-6 py-4 border-b">
          <DialogTitle>
            {isEdit ? 'Edit Template' : 'Create Template'}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {(error || externalError) && (
            <Alert variant="destructive" showIcon>
              <AlertDescription>{error || externalError}</AlertDescription>
            </Alert>
          )}

          {/* Basic Info */}
          <div className="space-y-4">
            {!isEdit && (
              <FormField
                label="Template ID"
                helperText="Leave empty to auto-generate (recommended)"
              >
                <Input
                  type="text"
                  value={formData.id}
                  onChange={(e) => setFormData({ ...formData, id: e.target.value })}
                  placeholder="e.g., my-custom-template"
                />
              </FormField>
            )}

            <FormField
              label="Name"
              required
            >
              <Input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., My Custom Template"
              />
            </FormField>

            <FormField label="Description">
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Describe what this template is for..."
                rows={3}
                style={{
                  backgroundColor: 'var(--color-bg-input)',
                  color: 'var(--color-text-primary)',
                  borderColor: 'var(--color-border-primary)',
                }}
                className="w-full px-3 py-2 rounded-md text-sm border focus:outline-none focus:ring-2 resize-none"
              />
            </FormField>

            <FormField label="Category">
              <Select
                value={formData.category}
                onValueChange={(value) => setFormData({ ...formData, category: value as any })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="production">Production</SelectItem>
                  <SelectItem value="development">Development</SelectItem>
                  <SelectItem value="specialized">Specialized</SelectItem>
                </SelectContent>
              </Select>
            </FormField>
          </div>

          {/* Topic Config */}
          <div className="space-y-4 pt-4 border-t" style={{ borderColor: 'var(--color-border-primary)' }}>
            <h4 className="font-medium">Topic Configuration</h4>
            <FormField
              label="Message Retention Duration"
              helperText="Format: 10m, 1h, 24h, 168h (7 days), 720h (30 days). Leave empty for default."
            >
              <Input
                type="text"
                value={formData.topicRetention}
                onChange={(e) => setFormData({ ...formData, topicRetention: e.target.value })}
                placeholder="e.g., 168h (7 days), 720h (30 days)"
              />
            </FormField>
          </div>

          {/* Subscription Config */}
          <div className="space-y-4 pt-4 border-t" style={{ borderColor: 'var(--color-border-primary)' }}>
            <h4 className="font-medium">Subscription Configuration</h4>
            <FormField label="Subscription Name">
              <Input
                type="text"
                value={formData.subscriptionName}
                onChange={(e) => setFormData({ ...formData, subscriptionName: e.target.value })}
                placeholder="e.g., sub, worker, processor"
              />
            </FormField>

            <FormField
              label="Ack Deadline (seconds)"
              required
              helperText="Must be between 10 and 600 seconds"
            >
              <Input
                type="number"
                value={formData.ackDeadline}
                onChange={(e) => setFormData({ ...formData, ackDeadline: parseInt(e.target.value) || 30 })}
                min={10}
                max={600}
              />
            </FormField>

            <FormField label="Retention Duration">
              <Input
                type="text"
                value={formData.retentionDuration}
                onChange={(e) => setFormData({ ...formData, retentionDuration: e.target.value })}
                placeholder="e.g., 7d, 24h"
              />
            </FormField>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="exactly-once"
                  checked={formData.enableExactlyOnce}
                  onCheckedChange={(checked) => setFormData({ ...formData, enableExactlyOnce: checked === true })}
                />
                <Label htmlFor="exactly-once" className="text-sm">Enable Exactly-Once Delivery</Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="ordering"
                  checked={formData.enableOrdering}
                  onCheckedChange={(checked) => setFormData({ ...formData, enableOrdering: checked === true })}
                />
                <Label htmlFor="ordering" className="text-sm">Enable Message Ordering</Label>
              </div>
            </div>

            <FormField label="Message Filter">
              <Input
                type="text"
                value={formData.filter}
                onChange={(e) => setFormData({ ...formData, filter: e.target.value })}
                placeholder="e.g., attributes.eventType = 'user.signup'"
              />
            </FormField>
          </div>

          {/* Dead Letter Config */}
          <div className="space-y-4 pt-4 border-t" style={{ borderColor: 'var(--color-border-primary)' }}>
            <div className="flex items-center gap-2">
              <Checkbox
                id="dead-letter"
                checked={formData.hasDeadLetter}
                onCheckedChange={(checked) => setFormData({ ...formData, hasDeadLetter: checked === true })}
              />
              <Label htmlFor="dead-letter" className="font-medium">Enable Dead Letter Queue</Label>
            </div>

            {formData.hasDeadLetter && (
              <FormField
                label="Max Delivery Attempts"
                helperText="Must be between 5 and 100"
              >
                <Input
                  type="number"
                  value={formData.maxDeliveryAttempts}
                  onChange={(e) => setFormData({ ...formData, maxDeliveryAttempts: parseInt(e.target.value) || 5 })}
                  min={5}
                  max={100}
                />
              </FormField>
            )}
          </div>
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
            disabled={saving || !formData.name.trim()}
            loading={saving}
          >
            {isEdit ? 'Save' : 'Create'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
