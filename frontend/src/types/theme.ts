// Theme type definitions for Pub/Sub GUI

export type Theme = 'light' | 'dark' | 'auto' | 'dracula' | 'monokai';
export type FontSize = 'small' | 'medium' | 'large';
export type EffectiveTheme = 'light' | 'dark' | 'dracula' | 'monokai';

export interface ThemeConfig {
  theme: Theme;
  fontSize: FontSize;
}
