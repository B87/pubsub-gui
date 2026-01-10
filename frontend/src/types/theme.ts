// Theme type definitions for Pub/Sub GUI

export type Theme = 'light' | 'dark' | 'auto' | 'dracula' | 'monokai' | 'nord' | 'sienna';
export type FontSize = 'small' | 'medium' | 'large';
export type EffectiveTheme = Exclude<Theme, 'auto'>;

export interface ThemeConfig {
  theme: Theme;
  fontSize: FontSize;
}
