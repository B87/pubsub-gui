// Monaco Editor theme definitions for Dracula and Monokai

import type { editor } from 'monaco-editor';

/**
 * Dracula theme for Monaco Editor
 * Based on https://draculatheme.com/
 */
export const draculaTheme: editor.IStandaloneThemeData = {
  base: 'vs-dark',
  inherit: true,
  rules: [
    { token: '', foreground: 'f8f8f2', background: '282a36' },
    { token: 'comment', foreground: '6272a4', fontStyle: 'italic' },
    { token: 'string', foreground: 'f1fa8c' },
    { token: 'string.escape', foreground: 'f1fa8c', fontStyle: 'bold' },
    { token: 'constant.numeric', foreground: 'bd93f9' },
    { token: 'constant.language', foreground: 'bd93f9' },
    { token: 'constant.character', foreground: 'bd93f9' },
    { token: 'constant.other', foreground: 'bd93f9' },
    { token: 'keyword', foreground: 'ff79c6', fontStyle: 'bold' },
    { token: 'keyword.control', foreground: 'ff79c6' },
    { token: 'keyword.operator', foreground: 'ff79c6' },
    { token: 'storage', foreground: 'ff79c6' },
    { token: 'storage.type', foreground: '8be9fd', fontStyle: 'italic' },
    { token: 'entity.name.type', foreground: '8be9fd' },
    { token: 'entity.name.class', foreground: '8be9fd' },
    { token: 'entity.name.function', foreground: '50fa7b' },
    { token: 'variable', foreground: 'f8f8f2' },
    { token: 'variable.parameter', foreground: 'ffb86c', fontStyle: 'italic' },
    { token: 'support.function', foreground: '50fa7b' },
    { token: 'support.class', foreground: '8be9fd' },
    { token: 'support.type', foreground: '8be9fd' },
    { token: 'support.variable', foreground: 'f8f8f2' },
    { token: 'invalid', foreground: 'ff5555', fontStyle: 'bold' },
    { token: 'invalid.deprecated', foreground: 'ffb86c' },
  ],
  colors: {
    // Editor colors
    'editor.background': '#282a36',
    'editor.foreground': '#f8f8f2',
    'editorLineNumber.foreground': '#6272a4',
    'editorLineNumber.activeForeground': '#f8f8f2',
    'editorCursor.foreground': '#f8f8f0',
    'editor.selectionBackground': '#44475a',
    'editor.inactiveSelectionBackground': '#44475a75',
    'editor.lineHighlightBackground': '#44475a',
    'editorWhitespace.foreground': '#6272a4',
    'editorIndentGuide.background': '#6272a4',
    'editorIndentGuide.activeBackground': '#f8f8f2',

    // Gutter colors
    'editorGutter.background': '#282a36',
    'editorGutter.modifiedBackground': '#8be9fd',
    'editorGutter.addedBackground': '#50fa7b',
    'editorGutter.deletedBackground': '#ff5555',

    // Widget colors
    'editorWidget.background': '#21222c',
    'editorWidget.border': '#6272a4',
    'editorSuggestWidget.background': '#21222c',
    'editorSuggestWidget.border': '#6272a4',
    'editorSuggestWidget.foreground': '#f8f8f2',
    'editorSuggestWidget.highlightForeground': '#8be9fd',
    'editorSuggestWidget.selectedBackground': '#44475a',

    // Scrollbar colors
    'scrollbar.shadow': '#00000000',
    'scrollbarSlider.background': '#44475a',
    'scrollbarSlider.hoverBackground': '#6272a4',
    'scrollbarSlider.activeBackground': '#bd93f9',
  },
};

/**
 * Monokai theme for Monaco Editor
 * Based on the classic Monokai color scheme
 */
export const monokaiTheme: editor.IStandaloneThemeData = {
  base: 'vs-dark',
  inherit: true,
  rules: [
    { token: '', foreground: 'f8f8f2', background: '272822' },
    { token: 'comment', foreground: '75715e', fontStyle: 'italic' },
    { token: 'string', foreground: 'e6db74' },
    { token: 'string.escape', foreground: 'ae81ff', fontStyle: 'bold' },
    { token: 'constant.numeric', foreground: 'ae81ff' },
    { token: 'constant.language', foreground: 'ae81ff' },
    { token: 'constant.character', foreground: 'ae81ff' },
    { token: 'constant.other', foreground: 'ae81ff' },
    { token: 'keyword', foreground: 'f92672', fontStyle: 'bold' },
    { token: 'keyword.control', foreground: 'f92672' },
    { token: 'keyword.operator', foreground: 'f92672' },
    { token: 'storage', foreground: 'f92672' },
    { token: 'storage.type', foreground: '66d9ef', fontStyle: 'italic' },
    { token: 'entity.name.type', foreground: '66d9ef' },
    { token: 'entity.name.class', foreground: 'a6e22e' },
    { token: 'entity.name.function', foreground: 'a6e22e' },
    { token: 'variable', foreground: 'f8f8f2' },
    { token: 'variable.parameter', foreground: 'fd971f', fontStyle: 'italic' },
    { token: 'support.function', foreground: 'a6e22e' },
    { token: 'support.class', foreground: '66d9ef' },
    { token: 'support.type', foreground: '66d9ef' },
    { token: 'support.variable', foreground: 'f8f8f2' },
    { token: 'invalid', foreground: 'f92672', fontStyle: 'bold' },
    { token: 'invalid.deprecated', foreground: 'fd971f' },
  ],
  colors: {
    // Editor colors
    'editor.background': '#272822',
    'editor.foreground': '#f8f8f2',
    'editorLineNumber.foreground': '#75715e',
    'editorLineNumber.activeForeground': '#f8f8f2',
    'editorCursor.foreground': '#f8f8f0',
    'editor.selectionBackground': '#49483e',
    'editor.inactiveSelectionBackground': '#49483e75',
    'editor.lineHighlightBackground': '#3e3d32',
    'editorWhitespace.foreground': '#49483e',
    'editorIndentGuide.background': '#49483e',
    'editorIndentGuide.activeBackground': '#75715e',

    // Gutter colors
    'editorGutter.background': '#272822',
    'editorGutter.modifiedBackground': '#66d9ef',
    'editorGutter.addedBackground': '#a6e22e',
    'editorGutter.deletedBackground': '#f92672',

    // Widget colors
    'editorWidget.background': '#1e1f1c',
    'editorWidget.border': '#75715e',
    'editorSuggestWidget.background': '#1e1f1c',
    'editorSuggestWidget.border': '#75715e',
    'editorSuggestWidget.foreground': '#f8f8f2',
    'editorSuggestWidget.highlightForeground': '#66d9ef',
    'editorSuggestWidget.selectedBackground': '#49483e',

    // Scrollbar colors
    'scrollbar.shadow': '#00000000',
    'scrollbarSlider.background': '#49483e',
    'scrollbarSlider.hoverBackground': '#75715e',
    'scrollbarSlider.activeBackground': '#66d9ef',
  },
};

/**
 * Register custom Monaco themes
 * Call this function once when Monaco editor is initialized
 */
export function registerCustomThemes(monaco: any): void {
  if (!monaco || !monaco.editor) {
    console.warn('Monaco editor not available for theme registration');
    return;
  }

  try {
    monaco.editor.defineTheme('dracula', draculaTheme);
    monaco.editor.defineTheme('monokai', monokaiTheme);
  } catch (error) {
    console.error('Failed to register custom Monaco themes:', error);
  }
}
