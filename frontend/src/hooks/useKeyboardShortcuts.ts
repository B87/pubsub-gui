import { useEffect, useCallback } from 'react';

export interface KeyboardShortcut {
  key: string;
  ctrlOrCmd?: boolean;
  shift?: boolean;
  alt?: boolean;
  action: () => void;
  enabled?: boolean;
  description?: string;
}

/**
 * Detects if the current platform is Mac
 */
export const isMac = (): boolean => {
  return navigator.platform.toUpperCase().indexOf('MAC') >= 0;
};

/**
 * Checks if an input element is currently focused
 */
export const isInputFocused = (): boolean => {
  const activeElement = document.activeElement;
  if (!activeElement) return false;

  const tagName = activeElement.tagName.toLowerCase();
  const isInput = tagName === 'input' || tagName === 'textarea';
  const isContentEditable = activeElement.getAttribute('contenteditable') === 'true';

  // Check if Monaco Editor is focused
  const isMonacoEditor = activeElement.closest('.monaco-editor') !== null;

  return isInput || isContentEditable || isMonacoEditor;
};

/**
 * Hook for managing keyboard shortcuts
 *
 * @param shortcuts Array of keyboard shortcuts to register
 * @param enabled Whether shortcuts should be active (default: true)
 */
export const useKeyboardShortcuts = (
  shortcuts: KeyboardShortcut[],
  enabled: boolean = true
) => {
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!enabled) return;

    // Don't trigger shortcuts when typing in inputs
    if (isInputFocused()) {
      // Allow Escape to close dialogs even when input is focused
      if (e.key === 'Escape') {
        // Let it bubble up - dialogs will handle it
        return;
      }
      return;
    }

    const modifierKey = isMac() ? e.metaKey : e.ctrlKey;
    const hasShift = e.shiftKey;
    const hasAlt = e.altKey;

    for (const shortcut of shortcuts) {
      // Check if shortcut is enabled
      if (shortcut.enabled === false) continue;

      // Check modifier keys
      if (shortcut.ctrlOrCmd && !modifierKey) continue;
      if (!shortcut.ctrlOrCmd && modifierKey) continue;
      if (shortcut.shift && !hasShift) continue;
      if (!shortcut.shift && hasShift && shortcut.key !== 'Escape') continue;
      if (shortcut.alt && !hasAlt) continue;
      if (!shortcut.alt && hasAlt) continue;

      // Check key match (case-insensitive for letter keys)
      const keyMatch = shortcut.key.toLowerCase() === e.key.toLowerCase() ||
        shortcut.key === e.key;

      if (keyMatch) {
        e.preventDefault();
        e.stopPropagation();
        shortcut.action();
        return;
      }
    }
  }, [shortcuts, enabled]);

  useEffect(() => {
    if (!enabled) return;

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown, enabled]);
};

/**
 * Format keyboard shortcut for display
 *
 * @param shortcut Keyboard shortcut configuration
 * @returns Formatted string (e.g., "⌘P" on Mac, "Ctrl+P" on Windows)
 */
export const formatShortcut = (shortcut: { key: string; ctrlOrCmd?: boolean; shift?: boolean; alt?: boolean }): string => {
  const parts: string[] = [];

  if (shortcut.ctrlOrCmd) {
    parts.push(isMac() ? '⌘' : 'Ctrl');
  }
  if (shortcut.shift) {
    parts.push(isMac() ? '⇧' : 'Shift');
  }
  if (shortcut.alt) {
    parts.push(isMac() ? '⌥' : 'Alt');
  }

  // Format key name
  let keyName = shortcut.key;
  if (keyName === 'Enter') {
    keyName = isMac() ? '↵' : 'Enter';
  } else if (keyName === 'Escape') {
    keyName = isMac() ? '⎋' : 'Esc';
  } else if (keyName.length === 1) {
    keyName = keyName.toUpperCase();
  }

  parts.push(keyName);

  return parts.join(isMac() ? '' : '+');
};
