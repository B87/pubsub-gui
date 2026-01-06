import { useState, useEffect, useRef, useCallback } from 'react';
import Editor from '@monaco-editor/react';
import { UpdateTheme, UpdateFontSize, GetConfigFileContent, SaveConfigFileContent } from '../../wailsjs/go/main/App';
import { useTheme } from '../hooks/useTheme';
import { registerCustomThemes } from '../utils/monacoThemes';
import type { Theme, FontSize } from '../types/theme';

interface SettingsDialogProps {
  open: boolean;
  onClose: () => void;
}

type Tab = 'appearance' | 'advanced';

const themes: { value: Theme; name: string; description: string }[] = [
  { value: 'auto', name: 'Auto', description: 'Matches your system theme' },
  { value: 'dark', name: 'Dark', description: 'Dark slate backgrounds with blue accents' },
  { value: 'light', name: 'Light', description: 'Bright, clean appearance' },
  { value: 'dracula', name: 'Dracula', description: 'Purple-accent cyberpunk aesthetic' },
  { value: 'monokai', name: 'Monokai', description: 'Cyan-accent coding theme' },
];

const fontSizes: { value: FontSize; label: string }[] = [
  { value: 'small', label: 'S' },
  { value: 'medium', label: 'M' },
  { value: 'large', label: 'L' },
];

export default function SettingsDialog({ open, onClose }: SettingsDialogProps) {
  const { theme, fontSize, monacoTheme } = useTheme();
  const [activeTab, setActiveTab] = useState<Tab>('appearance');
  const [selectedTheme, setSelectedTheme] = useState<Theme>(theme);
  const [selectedFontSize, setSelectedFontSize] = useState<FontSize>(fontSize);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Config editor state
  const [configContent, setConfigContent] = useState('');
  const [originalConfigContent, setOriginalConfigContent] = useState('');
  const [loadingConfig, setLoadingConfig] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);
  const [configError, setConfigError] = useState('');
  const [jsonError, setJsonError] = useState('');
  const [isValidJSON, setIsValidJSON] = useState(true);
  const editorRef = useRef<any>(null);
  const monacoRef = useRef<any>(null);

  // Map font size to Monaco editor font size
  const fontSizeMap = { small: 12, medium: 14, large: 16 };
  const editorFontSize = fontSizeMap[fontSize];

  // Update local state when theme/fontSize changes from outside
  useEffect(() => {
    setSelectedTheme(theme);
    setSelectedFontSize(fontSize);
  }, [theme, fontSize]);

  // Reset state when dialog opens/closes
  useEffect(() => {
    if (open) {
      setSelectedTheme(theme);
      setSelectedFontSize(fontSize);
      setError('');
      setActiveTab('appearance');
    } else {
      // Reset config editor state when dialog closes
      setConfigContent('');
      setConfigError('');
      setJsonError('');
    }
  }, [open, theme, fontSize]);

  // Load config when switching to advanced tab
  useEffect(() => {
    if (open && activeTab === 'advanced' && !configContent && !loadingConfig) {
      loadConfig();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, activeTab]);

  const loadConfig = async () => {
    setLoadingConfig(true);
    setConfigError('');
    try {
      const content = await GetConfigFileContent();
      setConfigContent(content);
      setOriginalConfigContent(content);
      validateJSON(content);
    } catch (e: any) {
      setConfigError('Failed to load config file: ' + e.toString());
    } finally {
      setLoadingConfig(false);
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
      const lineMatch = errorMsg.match(/position (\d+)/);
      const lineNumber = lineMatch ? ` at position ${lineMatch[1]}` : '';
      setJsonError(`Invalid JSON format: ${errorMsg}${lineNumber}`);
      setIsValidJSON(false);
      return false;
    }
  };

  const handleConfigContentChange = (value: string | undefined) => {
    const newValue = value || '';
    setConfigContent(newValue);
    validateJSON(newValue);
  };

  const formatJSON = useCallback(() => {
    if (!editorRef.current) return;
    const currentContent = editorRef.current.getValue();
    if (!currentContent.trim()) return;
    try {
      const parsed = JSON.parse(currentContent);
      const formatted = JSON.stringify(parsed, null, 2);
      setConfigContent(formatted);
      editorRef.current.setValue(formatted);
      validateJSON(formatted);
    } catch (e: any) {
      // Error already shown in validation
    }
  }, []);

  const handleSaveConfig = useCallback(async () => {
    const currentContent = editorRef.current?.getValue() || configContent;
    if (!currentContent.trim()) {
      setConfigError('Config content cannot be empty');
      return;
    }
    if (!validateJSON(currentContent)) {
      setConfigError('Please fix JSON errors before saving');
      return;
    }
    setSavingConfig(true);
    setConfigError('');
    try {
      await SaveConfigFileContent(currentContent);
      setOriginalConfigContent(currentContent);
      // Reload theme/fontSize from config in case they changed
      const parsed = JSON.parse(currentContent);
      if (parsed.theme && parsed.theme !== theme) {
        setSelectedTheme(parsed.theme);
      }
      if (parsed.fontSize && parsed.fontSize !== fontSize) {
        setSelectedFontSize(parsed.fontSize);
      }
    } catch (e: any) {
      setConfigError('Failed to save config: ' + e.toString());
    } finally {
      setSavingConfig(false);
    }
  }, [configContent, theme, fontSize]);

  const handleEditorDidMount = useCallback((editor: any, monaco: any) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
    registerCustomThemes(monaco);
    monaco.languages.json.jsonDefaults.setDiagnosticsOptions({
      validate: true,
      allowComments: false,
      schemas: [],
    });
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      handleSaveConfig();
    });
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyF, () => {
      editor.getAction('actions.find')?.run();
    });
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Slash, () => {
      formatJSON();
    });
  }, [handleSaveConfig, formatJSON]);

  const handleResetConfig = () => {
    if (window.confirm('Are you sure you want to reset all changes? This will reload the original config file.')) {
      setConfigContent(originalConfigContent);
      if (editorRef.current) {
        editorRef.current.setValue(originalConfigContent);
      }
      validateJSON(originalConfigContent);
      setConfigError('');
      setJsonError('');
    }
  };

  const handleCopyConfig = async () => {
    try {
      const textToCopy = editorRef.current?.getValue() || configContent;
      await navigator.clipboard.writeText(textToCopy);
      const originalError = configError;
      setConfigError('');
      setTimeout(() => {
        setConfigError('Copied to clipboard!');
        setTimeout(() => {
          setConfigError(originalError);
        }, 2000);
      }, 0);
    } catch (e: any) {
      setConfigError('Failed to copy to clipboard: ' + e.toString());
    }
  };

  const handleThemeChange = async (newTheme: Theme) => {
    setSelectedTheme(newTheme);
    setSaving(true);
    setError('');
    try {
      await UpdateTheme(newTheme);
    } catch (e: any) {
      setError('Failed to update theme: ' + e.toString());
      setSelectedTheme(theme); // Revert on error
    } finally {
      setSaving(false);
    }
  };

  const handleFontSizeChange = async (newSize: FontSize) => {
    setSelectedFontSize(newSize);
    setSaving(true);
    setError('');
    try {
      await UpdateFontSize(newSize);
    } catch (e: any) {
      setError('Failed to update font size: ' + e.toString());
      setSelectedFontSize(fontSize); // Revert on error
    } finally {
      setSaving(false);
    }
  };

  // Get theme color swatches for preview
  const getThemeColors = (themeValue: Theme) => {
    // These will be applied via CSS variables when the theme is active
    // For preview, we show approximate colors
    const colorMap: Record<Theme, { bg: string; text: string; accent: string }> = {
      dark: { bg: '#0f172a', text: '#f1f5f9', accent: '#3b82f6' },
      light: { bg: '#ffffff', text: '#111827', accent: '#3b82f6' },
      dracula: { bg: '#282a36', text: '#f8f8f2', accent: '#bd93f9' },
      monokai: { bg: '#272822', text: '#f8f8f2', accent: '#66d9ef' },
      auto: { bg: '#0f172a', text: '#f1f5f9', accent: '#3b82f6' }, // Default to dark
    };
    return colorMap[themeValue];
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-slate-800 rounded-lg shadow-xl max-w-5xl w-full mx-4 max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-700">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold">Settings</h2>
              <p className="text-sm text-slate-400 mt-1">Customize your application appearance</p>
            </div>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-200 transition-colors"
              title="Close settings"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-700">
          <button
            onClick={() => setActiveTab('appearance')}
            className={`px-6 py-3 text-sm font-medium transition-colors ${
              activeTab === 'appearance'
                ? 'text-blue-400 border-b-2 border-blue-500'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Appearance
          </button>
          <button
            onClick={() => setActiveTab('advanced')}
            className={`px-6 py-3 text-sm font-medium transition-colors ${
              activeTab === 'advanced'
                ? 'text-blue-400 border-b-2 border-blue-500'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Advanced
          </button>
        </div>

        {/* Content */}
        <div className={`flex-1 ${activeTab === 'advanced' ? 'overflow-hidden' : 'overflow-y-auto'} ${activeTab === 'advanced' ? 'p-0' : 'p-6'}`}>
          {activeTab === 'appearance' && (
            <div className="space-y-8">
              {/* Theme Selector */}
              <div>
                <h3 className="text-lg font-medium mb-4">Theme</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {themes.map((themeOption) => {
                    const isSelected = selectedTheme === themeOption.value;
                    const colors = getThemeColors(themeOption.value);
                    return (
                      <button
                        key={themeOption.value}
                        onClick={() => handleThemeChange(themeOption.value)}
                        disabled={saving}
                        className={`relative p-4 rounded-lg border-2 transition-all ${
                          isSelected
                            ? 'border-blue-500 bg-blue-900/20'
                            : 'border-slate-700 hover:border-slate-600 bg-slate-700/50'
                        } disabled:opacity-50 disabled:cursor-not-allowed`}
                      >
                        {isSelected && (
                          <div className="absolute top-2 right-2">
                            <svg className="w-5 h-5 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                              <path
                                fillRule="evenodd"
                                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                                clipRule="evenodd"
                              />
                            </svg>
                          </div>
                        )}
                        <div className="text-left">
                          <div className="font-medium mb-2">{themeOption.name}</div>
                          <div className="text-xs text-slate-400 mb-3">{themeOption.description}</div>
                          {/* Rich visual preview with actual UI elements */}
                          <div
                            className="p-3 rounded border border-slate-600"
                            style={{ backgroundColor: colors.bg }}
                          >
                            <div className="space-y-2">
                              {/* Preview button */}
                              <button
                                className="w-full px-3 py-1.5 rounded text-xs font-medium transition-colors"
                                style={{
                                  backgroundColor: colors.accent,
                                  color: colors.bg,
                                }}
                                disabled
                                onClick={(e) => e.preventDefault()}
                              >
                                Button
                              </button>
                              {/* Preview text */}
                              <div className="space-y-1">
                                <div
                                  className="text-xs font-medium"
                                  style={{ color: colors.text }}
                                >
                                  Primary Text
                                </div>
                                <div
                                  className="text-xs opacity-70"
                                  style={{ color: colors.text }}
                                >
                                  Secondary Text
                                </div>
                              </div>
                              {/* Preview border/accent */}
                              <div
                                className="h-1 rounded"
                                style={{ backgroundColor: colors.accent }}
                              />
                            </div>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Font Size Selector */}
              <div>
                <h3 className="text-lg font-medium mb-4">Font Size</h3>
                <div className="flex gap-2 mb-4">
                  {fontSizes.map((sizeOption) => {
                    const isSelected = selectedFontSize === sizeOption.value;
                    return (
                      <button
                        key={sizeOption.value}
                        onClick={() => handleFontSizeChange(sizeOption.value)}
                        disabled={saving}
                        className={`px-6 py-3 rounded-md font-medium transition-all ${
                          isSelected
                            ? 'bg-blue-600 text-white'
                            : 'bg-slate-700 text-slate-200 hover:bg-slate-600'
                        } disabled:opacity-50 disabled:cursor-not-allowed`}
                      >
                        {sizeOption.label}
                      </button>
                    );
                  })}
                </div>
                {/* Live Preview */}
                <div className="p-4 bg-slate-700/50 rounded-lg border border-slate-600">
                  <p className="text-sm text-slate-400 mb-2">Preview:</p>
                  <p className="text-base" style={{ fontSize: 'var(--font-size-base)' }}>
                    The quick brown fox jumps over the lazy dog. 1234567890
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'advanced' && (
            <div className="flex-1 flex flex-col p-6" style={{ minHeight: 0 }}>
              {/* Warning */}
              <div className="mb-4 p-3 bg-yellow-900/30 border border-yellow-800/50 rounded">
                <p className="text-sm text-yellow-200">
                  ⚠️ Warning: Editing the config file directly can break the application if invalid JSON is saved. Make sure to validate your changes before saving.
                </p>
              </div>

              {/* Toolbar */}
              {!loadingConfig && (
                <div className="mb-4 p-3 border border-slate-700 bg-slate-700/50 rounded flex items-center gap-2">
                  <button
                    onClick={formatJSON}
                    disabled={!configContent.trim() || savingConfig}
                    className="px-3 py-1.5 text-sm bg-slate-700 hover:bg-slate-600 disabled:bg-slate-800 disabled:opacity-50 text-slate-200 rounded-md transition-colors flex items-center gap-2"
                    title="Format JSON (Ctrl/Cmd + /)"
                  >
                    <span>⚡</span>
                    Format
                  </button>
                  <button
                    onClick={handleResetConfig}
                    disabled={savingConfig || configContent === originalConfigContent}
                    className="px-3 py-1.5 text-sm bg-slate-700 hover:bg-slate-600 disabled:bg-slate-800 disabled:opacity-50 text-slate-200 rounded-md transition-colors flex items-center gap-2"
                    title="Reset to original content"
                  >
                    <span>↺</span>
                    Reset
                  </button>
                  <button
                    onClick={handleCopyConfig}
                    disabled={!configContent.trim() || savingConfig}
                    className="px-3 py-1.5 text-sm bg-slate-700 hover:bg-slate-600 disabled:bg-slate-800 disabled:opacity-50 text-slate-200 rounded-md transition-colors flex items-center gap-2"
                    title="Copy to clipboard"
                  >
                    <span>📋</span>
                    Copy
                  </button>
                  <div className="flex-1"></div>
                  <div className="flex items-center gap-2">
                    <div className={`px-3 py-1 rounded-full text-xs font-medium ${
                      isValidJSON && configContent.trim()
                        ? 'bg-green-900/50 text-green-300 border border-green-700'
                        : jsonError
                        ? 'bg-red-900/50 text-red-300 border border-red-700'
                        : 'bg-slate-700/50 text-slate-400 border border-slate-600'
                    }`}>
                      {isValidJSON && configContent.trim() ? '✓ Valid JSON' : jsonError ? '✗ Invalid JSON' : '—'}
                    </div>
                    <div className="text-xs text-slate-400">
                      {configContent.length.toLocaleString()} chars
                    </div>
                  </div>
                  <div className="text-xs text-slate-400 ml-4">
                    <kbd className="px-1.5 py-0.5 bg-slate-700 rounded text-slate-300">Ctrl/Cmd+S</kbd> Save • <kbd className="px-1.5 py-0.5 bg-slate-700 rounded text-slate-300">Ctrl/Cmd+F</kbd> Find • <kbd className="px-1.5 py-0.5 bg-slate-700 rounded text-slate-300">Ctrl/Cmd+/</kbd> Format
                  </div>
                </div>
              )}

              {/* Editor */}
              {loadingConfig ? (
                <div className="flex items-center justify-center h-full">
                  <p className="text-slate-400">Loading config file...</p>
                </div>
              ) : (
                <div className="flex-1 flex flex-col" style={{ minHeight: 0 }}>
                  <label htmlFor="config-content" className="block text-sm font-medium mb-2">
                    Config File Content (~/.pubsub-gui/config.json)
                  </label>
                  <div className="flex-1 border border-slate-600 rounded-md overflow-hidden" style={{ height: '600px' }}>
                    <Editor
                      height="600px"
                      language="json"
                      theme={monacoTheme}
                      value={configContent}
                      onChange={handleConfigContentChange}
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
                    <div className="mt-2 p-2 bg-red-900/30 border border-red-700/50 rounded text-sm text-red-300">
                      <p className="font-medium">JSON Validation Error:</p>
                      <p className="text-red-400">{jsonError}</p>
                    </div>
                  )}
                  {configError && (
                    <div className="mt-2 p-2 bg-red-900/50 border border-red-700 rounded-md text-red-200 text-sm">
                      {configError}
                    </div>
                  )}
                  {configContent !== originalConfigContent && (
                    <div className="mt-2 text-xs text-yellow-400">
                      ● Unsaved changes
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Error Message */}
        {error && (
          <div className="px-6 pb-4">
            <div className="p-3 bg-red-900/50 border border-red-700 rounded-md text-red-200 text-sm">{error}</div>
          </div>
        )}

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-700 flex justify-between items-center">
          {activeTab === 'advanced' && configContent !== originalConfigContent && (
            <div className="text-xs text-slate-400">
              <span className="text-yellow-400">● Unsaved changes</span>
            </div>
          )}
          <div className="flex gap-3 ml-auto">
            {activeTab === 'advanced' && (
              <>
                <button
                  onClick={onClose}
                  disabled={savingConfig}
                  className="px-4 py-2 text-slate-300 hover:text-white transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveConfig}
                  disabled={!configContent.trim() || savingConfig || !!jsonError || loadingConfig}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 disabled:opacity-50 text-white rounded-md transition-colors"
                  title="Save changes (Ctrl/Cmd+S)"
                >
                  {savingConfig ? 'Saving...' : 'Save'}
                </button>
              </>
            )}
            {activeTab === 'appearance' && (
              <button
                onClick={onClose}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors"
              >
                Close
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
