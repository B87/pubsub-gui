import React, { useCallback, type RefObject } from 'react';
import Editor from '@monaco-editor/react';
import type { editor } from 'monaco-editor';
import * as monaco from 'monaco-editor';
import { registerCustomThemes } from '../../utils/monacoThemes';

// Type for Monaco instance from @monaco-editor/react
type MonacoInstance = Parameters<NonNullable<React.ComponentProps<typeof Editor>['onMount']>>[1];

interface AdvancedTabProps {
  configContent: string;
  originalConfigContent: string;
  loadingConfig: boolean;
  savingConfig: boolean;
  configError: string;
  jsonError: string;
  isValidJSON: boolean;
  onContentChange: (value: string | undefined) => void;
  onSave: () => Promise<void>;
  onFormat: () => void;
  onReset: () => void;
  onCopy: () => Promise<void>;
  monacoTheme: string;
  editorFontSize: number;
  editorRef: RefObject<editor.IStandaloneCodeEditor>;
}

export default function AdvancedTab({
  configContent,
  originalConfigContent,
  loadingConfig,
  savingConfig,
  configError,
  jsonError,
  isValidJSON,
  onContentChange,
  onSave,
  onFormat,
  onReset,
  onCopy,
  monacoTheme,
  editorFontSize,
  editorRef,
}: AdvancedTabProps) {
  const handleEditorDidMount = useCallback((editor: editor.IStandaloneCodeEditor, monacoInstance: MonacoInstance) => {
    editorRef.current = editor;
    registerCustomThemes(monacoInstance);
    // Use the new top-level json namespace instead of deprecated languages.json
    monaco.json.jsonDefaults.setDiagnosticsOptions({
      validate: true,
      allowComments: false,
      schemas: [],
    });
    editor.addCommand(monacoInstance.KeyMod.CtrlCmd | monacoInstance.KeyCode.KeyS, () => {
      void onSave();
    });
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyF, () => {
      editor.getAction('actions.find')?.run();
    });
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Slash, () => {
      onFormat();
    });
  }, [onSave, onFormat]);

  return (
    <div className="flex-1 flex flex-col" style={{ minHeight: 0 }}>
      {/* Warning */}
      <div
        className="mb-4 p-3 border rounded"
        style={{
          backgroundColor: 'var(--color-warning-bg)',
          borderColor: 'var(--color-warning-border)',
        }}
      >
        <p className="text-sm" style={{ color: 'var(--color-warning)' }}>
          ⚠️ Warning: Editing the config file directly can break the application if invalid JSON is saved. Make sure to validate your changes before saving.
        </p>
      </div>

      {/* Toolbar */}
      {!loadingConfig && (
        <div
          className="mb-4 p-3 border rounded flex items-center gap-2"
          style={{
            backgroundColor: 'var(--color-bg-secondary)',
            borderColor: 'var(--color-border-primary)',
          }}
        >
          <button
            onClick={onFormat}
            disabled={!configContent.trim() || savingConfig}
            style={{
              backgroundColor: 'var(--color-bg-tertiary)',
              color: 'var(--color-text-primary)',
            }}
            className="px-3 py-1.5 text-sm rounded-md transition-opacity hover:opacity-90 disabled:opacity-50 flex items-center gap-2"
            title="Format JSON (Ctrl/Cmd + /)"
            onMouseEnter={(e) => {
              if (!e.currentTarget.disabled) {
                e.currentTarget.style.backgroundColor = 'var(--color-bg-hover)';
              }
            }}
            onMouseLeave={(e) => {
              if (!e.currentTarget.disabled) {
                e.currentTarget.style.backgroundColor = 'var(--color-bg-tertiary)';
              }
            }}
          >
            <span>⚡</span>
            Format
          </button>
          <button
            onClick={onReset}
            disabled={savingConfig || configContent === originalConfigContent}
            style={{
              backgroundColor: 'var(--color-bg-tertiary)',
              color: 'var(--color-text-primary)',
            }}
            className="px-3 py-1.5 text-sm rounded-md transition-opacity hover:opacity-90 disabled:opacity-50 flex items-center gap-2"
            title="Reset to original content"
            onMouseEnter={(e) => {
              if (!e.currentTarget.disabled) {
                e.currentTarget.style.backgroundColor = 'var(--color-bg-hover)';
              }
            }}
            onMouseLeave={(e) => {
              if (!e.currentTarget.disabled) {
                e.currentTarget.style.backgroundColor = 'var(--color-bg-tertiary)';
              }
            }}
          >
            <span>↺</span>
            Reset
          </button>
          <button
            onClick={onCopy}
            disabled={!configContent.trim() || savingConfig}
            style={{
              backgroundColor: 'var(--color-bg-tertiary)',
              color: 'var(--color-text-primary)',
            }}
            className="px-3 py-1.5 text-sm rounded-md transition-opacity hover:opacity-90 disabled:opacity-50 flex items-center gap-2"
            title="Copy to clipboard"
            onMouseEnter={(e) => {
              if (!e.currentTarget.disabled) {
                e.currentTarget.style.backgroundColor = 'var(--color-bg-hover)';
              }
            }}
            onMouseLeave={(e) => {
              if (!e.currentTarget.disabled) {
                e.currentTarget.style.backgroundColor = 'var(--color-bg-tertiary)';
              }
            }}
          >
            <span>📋</span>
            Copy
          </button>
          <div className="flex-1"></div>
          <div className="flex items-center gap-2">
            <div
              className="px-3 py-1 rounded-full text-xs font-medium border"
              style={{
                backgroundColor: isValidJSON && configContent.trim()
                  ? 'var(--color-success-bg)'
                  : jsonError
                  ? 'var(--color-error-bg)'
                  : 'var(--color-bg-tertiary)',
                color: isValidJSON && configContent.trim()
                  ? 'var(--color-success)'
                  : jsonError
                  ? 'var(--color-error)'
                  : 'var(--color-text-muted)',
                borderColor: isValidJSON && configContent.trim()
                  ? 'var(--color-success-border)'
                  : jsonError
                  ? 'var(--color-error-border)'
                  : 'var(--color-border-primary)',
              }}
            >
              {isValidJSON && configContent.trim() ? '✓ Valid JSON' : jsonError ? '✗ Invalid JSON' : '—'}
            </div>
            <div className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
              {configContent.length.toLocaleString()} chars
            </div>
          </div>
          <div className="text-xs ml-4" style={{ color: 'var(--color-text-secondary)' }}>
            <kbd
              className="px-1.5 py-0.5 rounded"
              style={{
                backgroundColor: 'var(--color-bg-tertiary)',
                color: 'var(--color-text-primary)',
              }}
            >
              Ctrl/Cmd+S
            </kbd>{' '}
            Save •{' '}
            <kbd
              className="px-1.5 py-0.5 rounded"
              style={{
                backgroundColor: 'var(--color-bg-tertiary)',
                color: 'var(--color-text-primary)',
              }}
            >
              Ctrl/Cmd+F
            </kbd>{' '}
            Find •{' '}
            <kbd
              className="px-1.5 py-0.5 rounded"
              style={{
                backgroundColor: 'var(--color-bg-tertiary)',
                color: 'var(--color-text-primary)',
              }}
            >
              Ctrl/Cmd+/
            </kbd>{' '}
            Format
          </div>
        </div>
      )}

      {/* Editor */}
      {loadingConfig ? (
        <div className="flex items-center justify-center h-full">
          <p style={{ color: 'var(--color-text-muted)' }}>Loading config file...</p>
        </div>
      ) : (
        <div className="flex-1 flex flex-col" style={{ minHeight: 0 }}>
          <div
            className="flex-1 border rounded-md overflow-hidden"
            style={{
              height: '600px',
              borderColor: 'var(--color-border-primary)',
            }}
          >
            <Editor
              height="600px"
              language="json"
              theme={monacoTheme}
              value={configContent}
              onChange={onContentChange}
              onMount={handleEditorDidMount}
              options={{
                minimap: { enabled: false },
                fontSize: editorFontSize,
                lineNumbers: 'on',
                roundedSelection: false,
                scrollBeyondLastLine: false,
                readOnly: savingConfig,
                automaticLayout: true,
                tabSize: 2,
                wordWrap: 'on',
                formatOnPaste: true,
                formatOnType: true,
              }}
            />
          </div>
          {jsonError && (
            <div
              className="mt-2 p-2 border rounded text-sm"
              style={{
                backgroundColor: 'var(--color-error-bg)',
                borderColor: 'var(--color-error-border)',
                color: 'var(--color-error)',
              }}
            >
              <p className="font-medium">JSON Validation Error:</p>
              <p style={{ color: 'var(--color-error)' }}>{jsonError}</p>
            </div>
          )}
          {configError && (
            <div
              className="mt-2 p-2 border rounded-md text-sm"
              style={{
                backgroundColor: 'var(--color-error-bg)',
                borderColor: 'var(--color-error-border)',
                color: 'var(--color-error)',
              }}
            >
              {configError}
            </div>
          )}
          {configContent !== originalConfigContent && (
            <div className="mt-2 text-xs" style={{ color: 'var(--color-warning)' }}>
              ● Unsaved changes
            </div>
          )}
        </div>
      )}
    </div>
  );
}
