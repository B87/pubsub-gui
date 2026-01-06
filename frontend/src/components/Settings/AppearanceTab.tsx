import type { Theme, FontSize } from '../../types/theme';

interface AppearanceTabProps {
  theme: Theme;
  fontSize: FontSize;
  selectedTheme: Theme;
  selectedFontSize: FontSize;
  onThemeChange: (theme: Theme) => Promise<void>;
  onFontSizeChange: (fontSize: FontSize) => Promise<void>;
  saving: boolean;
}

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

export default function AppearanceTab({
  selectedTheme,
  selectedFontSize,
  onThemeChange,
  onFontSizeChange,
  saving,
}: AppearanceTabProps) {
  return (
    <div className="space-y-8">
      {/* Theme Selector */}
      <div>
        <h3 className="text-lg font-medium mb-4" style={{ color: 'var(--color-text-primary)' }}>Theme</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {themes.map((themeOption) => {
            const isSelected = selectedTheme === themeOption.value;
            const colors = getThemeColors(themeOption.value);
            return (
              <button
                key={themeOption.value}
                onClick={() => onThemeChange(themeOption.value)}
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
                  <div className="font-medium mb-2" style={{ color: 'var(--color-text-primary)' }}>{themeOption.name}</div>
                  <div className="text-xs mb-3" style={{ color: 'var(--color-text-secondary)' }}>{themeOption.description}</div>
                  {/* Rich visual preview with actual UI elements */}
                  <div
                    className="p-3 rounded border"
                    style={{
                      backgroundColor: colors.bg,
                      borderColor: 'var(--color-border-primary)',
                    }}
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
        <h3 className="text-lg font-medium mb-4" style={{ color: 'var(--color-text-primary)' }}>Font Size</h3>
        <div className="flex gap-2 mb-4">
          {fontSizes.map((sizeOption) => {
            const isSelected = selectedFontSize === sizeOption.value;
            return (
              <button
                key={sizeOption.value}
                onClick={() => onFontSizeChange(sizeOption.value)}
                disabled={saving}
                style={{
                  backgroundColor: isSelected ? 'var(--color-accent-primary)' : 'var(--color-bg-tertiary)',
                  color: isSelected ? 'white' : 'var(--color-text-primary)',
                }}
                className="px-6 py-3 rounded-md font-medium transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                onMouseEnter={(e) => {
                  if (!isSelected && !saving) {
                    e.currentTarget.style.backgroundColor = 'var(--color-bg-hover)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isSelected && !saving) {
                    e.currentTarget.style.backgroundColor = 'var(--color-bg-tertiary)';
                  }
                }}
              >
                {sizeOption.label}
              </button>
            );
          })}
        </div>
        {/* Live Preview */}
        <div
          className="p-4 rounded-lg border"
          style={{
            backgroundColor: 'var(--color-bg-secondary)',
            borderColor: 'var(--color-border-primary)',
          }}
        >
          <p className="text-sm mb-2" style={{ color: 'var(--color-text-secondary)' }}>Preview:</p>
          <p className="text-base" style={{ fontSize: 'var(--font-size-base)' }}>
            The quick brown fox jumps over the lazy dog. 1234567890
          </p>
        </div>
      </div>
    </div>
  );
}
