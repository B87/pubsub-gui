import { useState, useRef, useCallback } from 'react';
import Editor from '@monaco-editor/react';

interface JsonEditorProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  disabled?: boolean;
  height?: string;
}

export default function JsonEditor({ value, onChange, label = 'Payload', disabled = false, height = '300px' }: JsonEditorProps) {
  const [jsonError, setJsonError] = useState<string>('');
  const editorRef = useRef<any>(null);
  const monacoRef = useRef<any>(null);

  const validateJSON = (text: string): boolean => {
    if (!text.trim()) {
      setJsonError('');
      return true;
    }
    try {
      JSON.parse(text);
      setJsonError('');
      return true;
    } catch (e: any) {
      const errorMsg = e.message || 'Invalid JSON format';
      setJsonError(errorMsg);
      return false;
    }
  };

  const handleChange = (newValue: string | undefined) => {
    const val = newValue || '';
    onChange(val);
    validateJSON(val);
  };

  const formatJSON = useCallback(() => {
    if (!editorRef.current) return;

    const currentContent = editorRef.current.getValue();
    if (!currentContent.trim()) return;

    try {
      const parsed = JSON.parse(currentContent);
      const formatted = JSON.stringify(parsed, null, 2);
      editorRef.current.setValue(formatted);
      onChange(formatted);
      setJsonError('');
    } catch (e) {
      // Error already shown by Monaco validation
    }
  }, [onChange]);

  const handleEditorDidMount = useCallback((editor: any, monaco: any) => {
    editorRef.current = editor;
    monacoRef.current = monaco;

    monaco.languages.json.jsonDefaults.setDiagnosticsOptions({
      validate: true,
      allowComments: false,
      schemas: [],
    });
  }, []);

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="block text-sm font-medium text-slate-400">
          {label}
        </label>
        <div className="flex items-center gap-2">
          <button
            onClick={formatJSON}
            disabled={!value.trim() || disabled}
            className="px-3 py-1.5 text-sm bg-slate-700 hover:bg-slate-600 disabled:bg-slate-800 disabled:opacity-50 text-slate-200 rounded transition-colors flex items-center gap-1"
            title="Format JSON"
          >
            <span>⚡</span>
            Format
          </button>
          {jsonError && (
            <span className="text-sm text-red-400">{jsonError}</span>
          )}
        </div>
      </div>
      <div className="border border-slate-700 rounded overflow-hidden" style={{ minHeight: height }}>
        <Editor
          height={height}
          language="json"
          theme="vs-dark"
          value={value}
          onChange={handleChange}
          onMount={handleEditorDidMount}
          options={{
            minimap: { enabled: false },
            fontSize: 14,
            lineNumbers: 'on',
            roundedSelection: false,
            scrollBeyondLastLine: false,
            readOnly: disabled,
            automaticLayout: true,
            tabSize: 2,
            wordWrap: 'on',
            formatOnPaste: true,
            formatOnType: false,
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
  );
}
