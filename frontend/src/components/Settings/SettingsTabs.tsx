import { ReactNode } from 'react';

interface Tab {
  id: string;
  label: string;
}

interface SettingsTabsProps {
  tabs: Tab[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
  children: ReactNode;
  contentClassName?: string;
}

export default function SettingsTabs({ tabs, activeTab, onTabChange, children, contentClassName = '' }: SettingsTabsProps) {
  // Determine if active tab needs special overflow handling (e.g., advanced tab with editor, logs tab with dropdowns)
  const needsOverflowHidden = activeTab === 'advanced' || activeTab === 'logs';
  const needsPadding = !needsOverflowHidden;

  return (
    <>
      {/* Tabs */}
      <div
        style={{
          borderBottomColor: 'var(--color-border-primary)',
        }}
        className="flex border-b"
      >
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            style={{
              color: activeTab === tab.id ? 'var(--color-accent-primary)' : 'var(--color-text-secondary)',
              borderBottomColor: activeTab === tab.id ? 'var(--color-accent-primary)' : 'transparent',
            }}
            className="px-6 py-3 text-sm font-medium transition-colors border-b-2"
            onMouseEnter={(e) => {
              if (activeTab !== tab.id) {
                e.currentTarget.style.color = 'var(--color-text-primary)';
              }
            }}
            onMouseLeave={(e) => {
              if (activeTab !== tab.id) {
                e.currentTarget.style.color = 'var(--color-text-secondary)';
              }
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div
        className={`flex-1 ${needsOverflowHidden ? 'overflow-hidden' : 'overflow-y-auto'} ${needsPadding ? 'p-6' : 'p-0'} ${contentClassName}`}
        style={{ minHeight: 0 }}
      >
        {!needsOverflowHidden && <div style={{ minHeight: '400px' }}>{children}</div>}
        {needsOverflowHidden && children}
      </div>
    </>
  );
}
