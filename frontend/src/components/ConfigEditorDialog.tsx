import React, { useState, useEffect, useRef, useCallback } from 'react';
import Editor from '@monaco-editor/react';
import type { editor } from 'monaco-editor';
import * as monaco from 'monaco-editor';
import { GetConfigFileContent, SaveConfigFileContent } from '../../wailsjs/go/main/App';
import { useTheme } from '../hooks/useTheme';
import { registerCustomThemes } from '../utils/monacoThemes';

// Type for Monaco instance from @monaco-editor/react
type MonacoInstance = Parameters<NonNullable<React.ComponentProps<typeof Editor>['onMount']>>[1];

interface ConfigEditorDialogProps {
  open: boolean;
  onClose: () => void;
  error?: string;
}

export default function ConfigEditorDialog({ open, onClose, error: externalError }: ConfigEditorDialogProps) {
  const { monacoTheme, fontSize } = useTheme();
  const [content, setContent] = useState('');
  const [originalContent, setOriginalContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [jsonError, setJsonError] = useState('');
  const [isValidJSON, setIsValidJSON] = useState(true);
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<MonacoInstance | null>(null);

  // Map font size to Monaco editor font size
  const fontSizeMap = { small: 12, medium: 14, large: 16 };
  const editorFontSize = fontSizeMap[fontSize];

  // Load config content when dialog opens
  useEffect(() => {
    if (open) {
      loadConfig();
    } else {
      // Reset state when dialog closes
      setContent('');
      setError('');
      setJsonError('');
    }
  }, [open]);

  const loadConfig = async () => {
    setLoading(true);
    setError('');
    try {
      const configContent = await GetConfigFileContent();
      setContent(configContent);
      setOriginalContent(configContent);
    } catch (e: any) {
      setError('Failed to load config file: ' + e.toString());
    } finally {
      setLoading(false);
    }
  };

  const validateJSON = (text: string): boolean => {
    if (!text.trim()) {
      setJsonError('');
      setIsValidJSON(false);
      return false;
    }
    try {
      JSON.parse(text);
      setJsonError('');
      setIsValidJSON(true);
      return true;
    } catch (e: any) {
      const errorMsg = e.message || 'Invalid JSON';
      // Extract line number from error message if available
      const lineMatch = errorMsg.match(/position (\d+)/);
      const lineNumber = lineMatch ? ` at position ${lineMatch[1]}` : '';
      setJsonError(`Invalid JSON format: ${errorMsg}${lineNumber}`);
      setIsValidJSON(false);
      return false;
    }
  };

  const handleContentChange = (value: string | undefined) => {
    const newValue = value ?? '';
    setContent(newValue);
    validateJSON(newValue);
  };

  const formatJSON = useCallback(() => {
    if (!editorRef.current) return;

    const currentContent = editorRef.current.getValue();
    if (!currentContent.trim()) return;

    try {
      const parsed = JSON.parse(currentContent);
      const formatted = JSON.stringify(parsed, null, 2);
      setContent(formatted);
      // Update editor content
      editorRef.current.setValue(formatted);
      validateJSON(formatted);
    } catch (e: any) {
      // Error already shown in validation
    }
  }, []);

  const handleSave = useCallback(async () => {
    const currentContent = editorRef.current?.getValue() || content;
    if (!currentContent.trim()) {
      setError('Config content cannot be empty');
      return;
    }

    if (!validateJSON(currentContent)) {
      setError('Please fix JSON errors before saving');
      return;
    }

    setSaving(true);
    setError('');
    try {
      await SaveConfigFileContent(currentContent);
      setOriginalContent(currentContent);
      onClose();
    } catch (e: any) {
      setError('Failed to save config: ' + e.toString());
    } finally {
      setSaving(false);
    }
  }, [content, onClose]);

  const handleEditorDidMount = useCallback((editor: editor.IStandaloneCodeEditor, monacoInstance: MonacoInstance) => {
    editorRef.current = editor;
    monacoRef.current = monacoInstance;

    // Register custom Monaco themes (Dracula, Monokai)
    registerCustomThemes(monacoInstance);

    // Configure JSON validation
    // Use the new top-level json namespace instead of deprecated languages.json
    monaco.json.jsonDefaults.setDiagnosticsOptions({
      validate: true,
      allowComments: false,
      schemas: [],
    });

    // Add keyboard shortcuts
    editor.addCommand(monacoInstance.KeyMod.CtrlCmd | monacoInstance.KeyCode.KeyS, () => {
      void handleSave();
    });

    editor.addCommand(monacoInstance.KeyMod.CtrlCmd | monacoInstance.KeyCode.KeyF, () => {
      editor.getAction('actions.find')?.run();
    });

    editor.addCommand(monacoInstance.KeyMod.CtrlCmd | monacoInstance.KeyCode.Slash, () => {
      formatJSON();
    });
  }, [handleSave, formatJSON]);

  const handleReset = () => {
    if (window.confirm('Are you sure you want to reset all changes? This will reload the original config file.')) {
      setContent(originalContent);
      if (editorRef.current) {
        editorRef.current.setValue(originalContent);
      }
      validateJSON(originalContent);
      setError('');
      setJsonError('');
    }
  };

  const handleCopy = async () => {
    try {
      const textToCopy = editorRef.current?.getValue() || content;
      await navigator.clipboard.writeText(textToCopy);
      // Show brief success feedback
      const originalError = error;
      setError('');
      setTimeout(() => {
        setError('Copied to clipboard!');
        setTimeout(() => {
          setError(originalError);
        }, 2000);
      }, 0);
    } catch (e: any) {
      setError('Failed to copy to clipboard: ' + e.toString());
    }
  };


  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-slate-800 rounded-lg shadow-xl max-w-5xl w-full mx-4 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-700">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold">Edit Configuration File</h2>
              <p className="text-sm text-slate-400 mt-1">
                Editing ~/.pubsub-gui/config.json
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div className={`px-3 py-1 rounded-full text-xs font-medium ${
                isValidJSON && content.trim()
                  ? 'bg-green-900/50 text-green-300 border border-green-700'
                  : jsonError
                  ? 'bg-red-900/50 text-red-300 border border-red-700'
                  : 'bg-slate-700/50 text-slate-400 border border-slate-600'
              }`}>
                {isValidJSON && content.trim() ? '✓ Valid JSON' : jsonError ? '✗ Invalid JSON' : '—'}
              </div>
              <div className="text-xs text-slate-400">
                {content.length.toLocaleString()} chars
              </div>
            </div>
          </div>
        </div>

        {/* Warning */}
        <div className="px-6 py-3 bg-yellow-900/30 border-b border-yellow-800/50">
          <p className="text-sm text-yellow-200">
            ⚠️ Warning: Editing the config file directly can break the application if invalid JSON is saved. Make sure to validate your changes before saving.
          </p>
        </div>

        {/* Toolbar */}
        {!loading && (
          <div className="px-6 py-3 border-b border-slate-700 bg-slate-750 flex items-center gap-2">
            <button
              onClick={formatJSON}
              disabled={!content.trim() || saving}
              className="px-3 py-1.5 text-sm bg-slate-700 hover:bg-slate-600 disabled:bg-slate-800 disabled:opacity-50 text-slate-200 rounded-md transition-colors flex items-center gap-2"
              title="Format JSON (Ctrl/Cmd + /)"
            >
              <span>⚡</span>
              Format
            </button>
            <button
              onClick={handleReset}
              disabled={saving || content === originalContent}
              className="px-3 py-1.5 text-sm bg-slate-700 hover:bg-slate-600 disabled:bg-slate-800 disabled:opacity-50 text-slate-200 rounded-md transition-colors flex items-center gap-2"
              title="Reset to original content"
            >
              <span>↺</span>
              Reset
            </button>
            <button
              onClick={handleCopy}
              disabled={!content.trim() || saving}
              className="px-3 py-1.5 text-sm bg-slate-700 hover:bg-slate-600 disabled:bg-slate-800 disabled:opacity-50 text-slate-200 rounded-md transition-colors flex items-center gap-2"
              title="Copy to clipboard"
            >
              <span>📋</span>
              Copy
            </button>
            <div className="flex-1"></div>
            <div className="text-xs text-slate-400">
              <kbd className="px-1.5 py-0.5 bg-slate-700 rounded text-slate-300">Ctrl/Cmd+S</kbd> Save • <kbd className="px-1.5 py-0.5 bg-slate-700 rounded text-slate-300">Ctrl/Cmd+F</kbd> Find • <kbd className="px-1.5 py-0.5 bg-slate-700 rounded text-slate-300">Ctrl/Cmd+/</kbd> Format
            </div>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-hidden flex flex-col p-6">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <p className="text-slate-400">Loading config file...</p>
            </div>
          ) : (
            <div className="flex-1 flex flex-col" style={{ minHeight: 0 }}>
              <label htmlFor="config-content" className="block text-sm font-medium mb-2">
                Config File Content (JSON)
              </label>
              <div className="flex-1 border border-slate-600 rounded-md overflow-hidden" style={{ height: '600px' }}>
                <Editor
                  height="600px"
                  language="json"
                  theme={monacoTheme}
                  value={content}
                  onChange={handleContentChange}
                  onMount={handleEditorDidMount}
                  options={{
                    minimap: { enabled: false },
                    fontSize: editorFontSize,
                    lineNumbers: 'on',
                    roundedSelection: false,
                    scrollBeyondLastLine: false,
                    readOnly: saving,
                    automaticLayout: true,
                    tabSize: 2,
                    wordWrap: 'on',
                    formatOnPaste: true,
                    formatOnType: true,
                  }}
                />
              </div>
              {jsonError && (
                <div className="mt-2 p-2 bg-red-900/30 border border-red-700/50 rounded text-sm text-red-300">
                  <p className="font-medium">JSON Validation Error:</p>
                  <p className="text-red-400">{jsonError}</p>
                </div>
              )}
            </div>
          )}

          {(error || externalError) && (
            <div className="mt-4 p-3 bg-red-900/50 border border-red-700 rounded-md text-red-200 text-sm">
              {error || externalError}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-700 flex justify-between items-center">
          <div className="text-xs text-slate-400">
            {content !== originalContent && (
              <span className="text-yellow-400">● Unsaved changes</span>
            )}
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 text-slate-300 hover:text-white transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!content.trim() || saving || !!jsonError || loading}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 disabled:opacity-50 text-white rounded-md transition-colors"
              title="Save changes (Ctrl/Cmd+S)"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
