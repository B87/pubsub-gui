import { useState, useEffect, useRef } from 'react';
import {
  GetTopicSubscriptionTemplates,
  CreateFromTemplate,
} from '../wailsjs/go/main/App';
import { models } from '../wailsjs/go/models';

interface TemplateSelectorProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

type Step = 'select' | 'configure' | 'creating';

export default function TemplateSelector({ open, onClose, onSuccess }: TemplateSelectorProps) {
  const [step, setStep] = useState<Step>('select');
  const [templates, setTemplates] = useState<models.TopicSubscriptionTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<models.TopicSubscriptionTemplate | null>(null);
  const [baseName, setBaseName] = useState('');
  const [environment, setEnvironment] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<models.TemplateCreateResult | null>(null);

  // Refs for cleanup
  const isMountedRef = useRef(true);
  const timerIdRef = useRef<number | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      if (timerIdRef.current) {
        clearTimeout(timerIdRef.current);
      }
    };
  }, []);

  // Load templates when dialog opens
  useEffect(() => {
    if (open) {
      // Reset mount state when dialog opens
      isMountedRef.current = true;
      // Clear any pending timeout
      if (timerIdRef.current) {
        clearTimeout(timerIdRef.current);
        timerIdRef.current = null;
      }
      loadTemplates();
      // Reset state
      setStep('select');
      setSelectedTemplate(null);
      setBaseName('');
      setEnvironment('');
      setError('');
      setResult(null);
    } else {
      // Clear timeout when dialog closes
      if (timerIdRef.current) {
        clearTimeout(timerIdRef.current);
        timerIdRef.current = null;
      }
    }
  }, [open]);

  const loadTemplates = async () => {
    try {
      const data = await GetTopicSubscriptionTemplates();
      setTemplates(data || []);
    } catch (e: any) {
      setError('Failed to load templates: ' + e.toString());
    }
  };

  const handleSelectTemplate = (template: models.TopicSubscriptionTemplate) => {
    setSelectedTemplate(template);
    setStep('configure');
    setError('');
  };

  const handleBack = () => {
    if (step === 'configure') {
      setStep('select');
      setError('');
    } else if (step === 'creating') {
      setStep('configure');
    }
  };

  const validateBaseName = (name: string): string | null => {
    if (!name.trim()) {
      return 'Base name is required';
    }
    const normalized = name.toLowerCase().trim();
    if (normalized !== name) {
      return 'Base name must be lowercase';
    }
    for (const char of normalized) {
      if (!((char >= 'a' && char <= 'z') || (char >= '0' && char <= '9') || char === '-')) {
        return 'Base name must contain only lowercase letters, numbers, and hyphens';
      }
    }
    return null;
  };

  const handleCreate = async () => {
    if (!selectedTemplate) return;

    const validationError = validateBaseName(baseName);
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    setError('');

    try {
      const request = models.TemplateCreateRequest.createFrom({
        templateId: selectedTemplate.id,
        baseName: baseName.trim(),
        environment: environment.trim() || undefined,
        overrides: undefined, // Can be extended later
      });

      const createResult = await CreateFromTemplate(request);
      setResult(createResult);

      if (createResult.success) {
        setStep('creating');
        // Call onSuccess after a short delay to show result
        timerIdRef.current = setTimeout(() => {
          if (isMountedRef.current) {
            if (onSuccess) {
              onSuccess();
            }
            onClose();
          }
        }, 2000);
      } else {
        setError(createResult.error || 'Failed to create resources');
      }
    } catch (e: any) {
      setError('Failed to create resources: ' + e.toString());
    } finally {
      setLoading(false);
    }
  };

  const groupedTemplates = templates.reduce((acc, template) => {
    if (!acc[template.category]) {
      acc[template.category] = [];
    }
    acc[template.category].push(template);
    return acc;
  }, {} as Record<string, models.TopicSubscriptionTemplate[]>);

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
        }}
        className="border rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            borderBottomColor: 'var(--color-border-primary)',
          }}
          className="px-6 py-4 border-b flex items-center justify-between"
        >
          <h2 className="text-xl font-semibold" style={{ color: 'var(--color-text-primary)' }}>
            Create from Template
          </h2>
          <button
            onClick={onClose}
            style={{ color: 'var(--color-text-muted)' }}
            className="hover:opacity-80 transition-opacity"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {step === 'select' && (
            <TemplateSelectionStep
              templates={templates}
              groupedTemplates={groupedTemplates}
              onSelect={handleSelectTemplate}
            />
          )}

          {step === 'configure' && selectedTemplate && (
            <ConfigurationStep
              template={selectedTemplate}
              baseName={baseName}
              setBaseName={setBaseName}
              environment={environment}
              setEnvironment={setEnvironment}
              onBack={handleBack}
              onCreate={handleCreate}
              loading={loading}
              error={error}
            />
          )}

          {step === 'creating' && result && (
            <CreationResultStep result={result} />
          )}
        </div>
      </div>
    </div>
  );
}

interface TemplateSelectionStepProps {
  templates: models.TopicSubscriptionTemplate[];
  groupedTemplates: Record<string, models.TopicSubscriptionTemplate[]>;
  onSelect: (template: models.TopicSubscriptionTemplate) => void;
}

function TemplateSelectionStep({ templates, groupedTemplates, onSelect }: TemplateSelectionStepProps) {
  const categories = ['production', 'development', 'specialized'];

  return (
    <div className="space-y-6">
      {categories.map((category) => {
        const categoryTemplates = groupedTemplates[category] || [];
        if (categoryTemplates.length === 0) return null;

        return (
          <div key={category}>
            <h3
              className="text-lg font-semibold mb-3 capitalize"
              style={{ color: 'var(--color-text-primary)' }}
            >
              {category}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {categoryTemplates.map((template) => (
                <TemplateCard
                  key={template.id}
                  template={template}
                  onClick={() => onSelect(template)}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

interface TemplateCardProps {
  template: models.TopicSubscriptionTemplate;
  onClick: () => void;
}

function TemplateCard({ template, onClick }: TemplateCardProps) {
  return (
    <button
      onClick={onClick}
      style={{
        backgroundColor: 'var(--color-bg-tertiary)',
        borderColor: 'var(--color-border-primary)',
      }}
      className="border rounded-lg p-4 text-left hover:opacity-80 transition-opacity"
    >
      <div className="flex items-start justify-between mb-2">
        <h4 className="font-semibold" style={{ color: 'var(--color-text-primary)' }}>
          {template.name}
        </h4>
        {template.isBuiltIn && (
          <span
            style={{
              backgroundColor: 'var(--color-accent-primary)',
              color: 'white',
            }}
            className="text-xs px-2 py-1 rounded"
          >
            Built-in
          </span>
        )}
      </div>
      <p className="text-sm mb-3" style={{ color: 'var(--color-text-secondary)' }}>
        {template.description}
      </p>
      <div className="flex items-center gap-4 text-xs" style={{ color: 'var(--color-text-muted)' }}>
        <span>{template.subscriptions.length} subscription{template.subscriptions.length !== 1 ? 's' : ''}</span>
        {template.deadLetter && <span>DLQ</span>}
        {template.subscriptions.some(s => s.enableExactlyOnce) && <span>Exactly-once</span>}
      </div>
    </button>
  );
}

interface ConfigurationStepProps {
  template: models.TopicSubscriptionTemplate;
  baseName: string;
  setBaseName: (value: string) => void;
  environment: string;
  setEnvironment: (value: string) => void;
  onBack: () => void;
  onCreate: () => void;
  loading: boolean;
  error: string;
}

function ConfigurationStep({
  template,
  baseName,
  setBaseName,
  environment,
  setEnvironment,
  onBack,
  onCreate,
  loading,
  error,
}: ConfigurationStepProps) {
  const baseNameError = baseName ? (() => {
    const normalized = baseName.toLowerCase().trim();
    if (normalized !== baseName) return 'Must be lowercase';
    for (const char of normalized) {
      if (!((char >= 'a' && char <= 'z') || (char >= '0' && char <= '9') || char === '-')) {
        return 'Only lowercase letters, numbers, and hyphens';
      }
    }
    return null;
  })() : null;

  const envSuffix = environment ? `-${environment.toLowerCase()}` : '';
  const topicName = `${baseName || 'example'}${envSuffix}-topic`;
  const subNames = template.subscriptions.map(
    sub => `${baseName || 'example'}${envSuffix}-${sub.name}`
  );

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--color-text-primary)' }}>
          {template.name}
        </h3>
        <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          {template.description}
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text-primary)' }}>
            Base Name *
          </label>
          <input
            type="text"
            value={baseName}
            onChange={(e) => setBaseName(e.target.value)}
            placeholder="e.g., orders, payments, events"
            style={{
              backgroundColor: 'var(--color-bg-input)',
              color: 'var(--color-text-primary)',
              borderColor: baseNameError ? 'var(--color-error-border)' : 'var(--color-border-primary)',
            }}
            className="w-full px-3 py-2 rounded-md text-sm border focus:outline-none focus:ring-2"
            onFocus={(e) => e.currentTarget.style.borderColor = 'var(--color-accent-primary)'}
            onBlur={(e) => e.currentTarget.style.borderColor = baseNameError ? 'var(--color-error-border)' : 'var(--color-border-primary)'}
          />
          {baseNameError && (
            <p className="text-xs mt-1" style={{ color: 'var(--color-error)' }}>
              {baseNameError}
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text-primary)' }}>
            Environment (optional)
          </label>
          <select
            value={environment}
            onChange={(e) => setEnvironment(e.target.value)}
            style={{
              backgroundColor: 'var(--color-bg-input)',
              color: 'var(--color-text-primary)',
              borderColor: 'var(--color-border-primary)',
            }}
            className="w-full px-3 py-2 rounded-md text-sm border focus:outline-none focus:ring-2"
          >
            <option value="">None</option>
            <option value="prod">Production</option>
            <option value="dev">Development</option>
            <option value="staging">Staging</option>
            <option value="test">Test</option>
          </select>
        </div>

        {baseName && (
          <div
            style={{
              backgroundColor: 'var(--color-bg-tertiary)',
              borderColor: 'var(--color-border-primary)',
            }}
            className="border rounded-lg p-4"
          >
            <h4 className="text-sm font-semibold mb-2" style={{ color: 'var(--color-text-primary)' }}>
              Resources to be created:
            </h4>
            <ul className="space-y-1 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
              <li>• Topic: <code style={{ color: 'var(--color-text-primary)' }}>{topicName}</code></li>
              {subNames.map((name, i) => (
                <li key={i}>• Subscription: <code style={{ color: 'var(--color-text-primary)' }}>{name}</code></li>
              ))}
              {template.deadLetter && (
                <>
                  <li>• DLQ Topic: <code style={{ color: 'var(--color-text-primary)' }}>{baseName}{envSuffix}-dlq</code></li>
                  <li>• DLQ Subscription: <code style={{ color: 'var(--color-text-primary)' }}>{baseName}{envSuffix}-dlq-sub</code></li>
                </>
              )}
            </ul>
          </div>
        )}

        {error && (
          <div
            style={{
              backgroundColor: 'var(--color-error-bg)',
              borderColor: 'var(--color-error-border)',
              color: 'var(--color-error)',
            }}
            className="border rounded-md p-3 text-sm"
          >
            {error}
          </div>
        )}
      </div>

      <div className="flex gap-3 justify-end">
        <button
          onClick={onBack}
          disabled={loading}
          style={{
            backgroundColor: 'var(--color-bg-tertiary)',
            color: 'var(--color-text-primary)',
          }}
          className="px-4 py-2 rounded-md text-sm transition-opacity disabled:opacity-50"
        >
          Back
        </button>
        <button
          onClick={onCreate}
          disabled={loading || !baseName.trim() || !!baseNameError}
          style={{
            backgroundColor: loading || !baseName.trim() || !!baseNameError ? 'var(--color-bg-tertiary)' : 'var(--color-accent-primary)',
            color: 'white',
          }}
          className="px-4 py-2 rounded-md text-sm transition-opacity disabled:opacity-50"
        >
          {loading ? 'Creating...' : 'Create Resources'}
        </button>
      </div>
    </div>
  );
}

interface CreationResultStepProps {
  result: models.TemplateCreateResult;
}

function CreationResultStep({ result }: CreationResultStepProps) {
  // Only show success content if creation was successful
  if (!result.success) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <svg className="w-8 h-8" style={{ color: 'var(--color-error)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h3 className="text-lg font-semibold" style={{ color: 'var(--color-text-primary)' }}>
            Creation Failed
          </h3>
        </div>
        {result.error && (
          <div
            style={{
              backgroundColor: 'var(--color-error-bg)',
              borderColor: 'var(--color-error-border)',
              color: 'var(--color-error)',
            }}
            className="border rounded-md p-3 text-sm"
          >
            {result.error}
          </div>
        )}
      </div>
    );
  }

  // Safe access with fallbacks for optional properties
  const topicId = result.topicId || 'N/A';
  const subscriptionIds = result.subscriptionIds || [];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <svg className="w-8 h-8" style={{ color: 'var(--color-success)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <h3 className="text-lg font-semibold" style={{ color: 'var(--color-text-primary)' }}>
          Resources Created Successfully!
        </h3>
      </div>

      <div
        style={{
          backgroundColor: 'var(--color-bg-tertiary)',
          borderColor: 'var(--color-border-primary)',
        }}
        className="border rounded-lg p-4 space-y-2"
      >
        <div className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          <strong style={{ color: 'var(--color-text-primary)' }}>Topic:</strong> {topicId}
        </div>
        {subscriptionIds.map((id, i) => (
          <div key={i} className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            <strong style={{ color: 'var(--color-text-primary)' }}>Subscription {i + 1}:</strong> {id}
          </div>
        ))}
        {result.deadLetterTopicId && (
          <>
            <div className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
              <strong style={{ color: 'var(--color-text-primary)' }}>DLQ Topic:</strong> {result.deadLetterTopicId}
            </div>
            <div className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
              <strong style={{ color: 'var(--color-text-primary)' }}>DLQ Subscription:</strong> {result.deadLetterSubId}
            </div>
          </>
        )}
      </div>

      {result.warnings && result.warnings.length > 0 && (
        <div
          style={{
            backgroundColor: 'var(--color-warning-bg)',
            borderColor: 'var(--color-warning-border)',
            color: 'var(--color-warning)',
          }}
          className="border rounded-md p-3 text-sm"
        >
          <strong>Warnings:</strong>
          <ul className="list-disc list-inside mt-1">
            {result.warnings.map((warning, i) => (
              <li key={i}>{warning}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
