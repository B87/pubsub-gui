import { createContext, useState, useEffect, ReactNode } from 'react';
import { EventsOn } from '../../wailsjs/runtime/runtime';
import { WindowSetLightTheme, WindowSetDarkTheme, WindowSetSystemDefaultTheme } from '../../wailsjs/runtime/runtime';
import type { Theme, FontSize, EffectiveTheme } from '../types/theme';

interface ThemeContextValue {
  theme: Theme;
  fontSize: FontSize;
  effectiveTheme: EffectiveTheme;
  monacoTheme: string;
  setTheme: (theme: Theme) => void;
  setFontSize: (size: FontSize) => void;
}

export const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

interface ThemeProviderProps {
  children: ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const [theme, setTheme] = useState<Theme>('auto');
  const [fontSize, setFontSize] = useState<FontSize>('medium');
  const [effectiveTheme, setEffectiveTheme] = useState<EffectiveTheme>('dark');

  // Determine effective theme when "auto" is selected
  useEffect(() => {
    if (theme === 'auto') {
      // Listen for system theme changes
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

      const updateTheme = (e: MediaQueryListEvent | MediaQueryList) => {
        setEffectiveTheme(e.matches ? 'dark' : 'light');
      };

      // Set initial value
      updateTheme(mediaQuery);

      // Listen for changes
      mediaQuery.addEventListener('change', updateTheme);
      return () => mediaQuery.removeEventListener('change', updateTheme);
    } else {
      // For non-auto themes, effective theme is the same as theme
      setEffectiveTheme(theme as EffectiveTheme);
    }
  }, [theme]);

  // Apply theme to HTML element
  useEffect(() => {
    const htmlElement = document.documentElement;
    htmlElement.setAttribute('data-theme', theme);

    // Sync Wails window theme for native window chrome
    if (effectiveTheme === 'light') {
      WindowSetLightTheme();
    } else if (theme === 'auto') {
      WindowSetSystemDefaultTheme();
    } else {
      // For dark, dracula, monokai - use dark window theme
      WindowSetDarkTheme();
    }
  }, [theme, effectiveTheme]);

  // Apply font size to HTML element
  useEffect(() => {
    const htmlElement = document.documentElement;
    htmlElement.setAttribute('data-font-size', fontSize);
  }, [fontSize]);

  // Listen for theme changes from backend (config file edits)
  useEffect(() => {
    const unsubscribeTheme = EventsOn('config:theme-changed', (newTheme: string) => {
      if (isValidTheme(newTheme)) {
        setTheme(newTheme as Theme);
      }
    });

    const unsubscribeFontSize = EventsOn('config:font-size-changed', (newFontSize: string) => {
      if (isValidFontSize(newFontSize)) {
        setFontSize(newFontSize as FontSize);
      }
    });

    // Cleanup listeners on unmount
    return () => {
      if (unsubscribeTheme) unsubscribeTheme();
      if (unsubscribeFontSize) unsubscribeFontSize();
    };
  }, []);

  // Map app theme to Monaco editor theme
  const monacoTheme = getMonacoTheme(effectiveTheme);

  const value: ThemeContextValue = {
    theme,
    fontSize,
    effectiveTheme,
    monacoTheme,
    setTheme,
    setFontSize,
  };

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

// Helper function to validate theme
function isValidTheme(theme: string): boolean {
  return ['light', 'dark', 'auto', 'dracula', 'monokai'].includes(theme);
}

// Helper function to validate font size
function isValidFontSize(size: string): boolean {
  return ['small', 'medium', 'large'].includes(size);
}

// Map app theme to Monaco editor theme
function getMonacoTheme(effectiveTheme: EffectiveTheme): string {
  switch (effectiveTheme) {
    case 'light':
      return 'vs-light';
    case 'dark':
      return 'vs-dark';
    case 'dracula':
      return 'dracula';
    case 'monokai':
      return 'monokai';
    default:
      return 'vs-dark';
  }
}
