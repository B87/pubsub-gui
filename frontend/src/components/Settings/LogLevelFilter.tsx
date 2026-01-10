import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Filter } from 'lucide-react';
import { Badge, Button } from '../ui';

type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning';

interface LogLevelFilterProps {
  levels: string[];
  selectedLevels: string[];
  counts?: Record<string, number>;
  onChange: (levels: string[]) => void;
}

interface LevelMeta {
  description: string;
  dotClass: string;
  badgeVariant: BadgeVariant;
}

const LEVEL_META: Record<string, LevelMeta> = {
  DEBUG: {
    description: 'Verbose diagnostics',
    dotClass: '', // Will use inline style
    badgeVariant: 'default',
  },
  INFO: {
    description: 'Normal system events',
    dotClass: '', // Will use inline style
    badgeVariant: 'secondary',
  },
  WARN: {
    description: 'Potential issues',
    dotClass: '', // Will use inline style
    badgeVariant: 'warning',
  },
  ERROR: {
    description: 'Failures to investigate',
    dotClass: '', // Will use inline style
    badgeVariant: 'destructive',
  },
};

function cn(...classes: (string | boolean | undefined)[]): string {
  return classes.filter(Boolean).join(' ');
}

function getLevelMeta(level: string): LevelMeta {
  return LEVEL_META[level.toUpperCase()] || {
    description: 'Other',
    dotClass: '',
    badgeVariant: 'default',
  };
}

function getLevelDotColor(level: string): string {
  switch (level.toUpperCase()) {
    case 'DEBUG':
      return 'var(--color-border-primary)';
    case 'INFO':
      return 'var(--color-accent-primary)';
    case 'WARN':
      return 'var(--color-warning)';
    case 'ERROR':
      return 'var(--color-error)';
    default:
      return 'var(--color-border-primary)';
  }
}

function isSameSelection(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((level) => b.includes(level));
}

export function LogLevelFilter({
  levels,
  selectedLevels,
  counts,
  onChange,
}: LogLevelFilterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const orderedSelected = useMemo(
    () => levels.filter((level) => selectedLevels.includes(level)),
    [levels, selectedLevels]
  );

  const isFiltered = selectedLevels.length !== levels.length;

  const selectionLabel = useMemo(() => {
    if (selectedLevels.length === 0) return 'None';
    if (selectedLevels.length === levels.length) return 'All levels';
    if (selectedLevels.length === 1) return selectedLevels[0];
    return `${selectedLevels.length} of ${levels.length}`;
  }, [selectedLevels, levels]);

  const totalCount = useMemo(() => {
    return levels.reduce((sum, level) => sum + (counts?.[level] ?? 0), 0);
  }, [levels, counts]);

  const setSelection = useCallback(
    (next: string[]) => {
      const ordered = levels.filter((level) => next.includes(level));
      onChange(ordered);
    },
    [levels, onChange]
  );

  const toggleLevel = useCallback(
    (level: string) => {
      const next = selectedLevels.includes(level)
        ? selectedLevels.filter((item) => item !== level)
        : [...selectedLevels, level];
      setSelection(next);
    },
    [selectedLevels, setSelection]
  );

  const quickSets = [
    { label: 'All', levels },
    { label: 'Errors', levels: ['ERROR'] },
    { label: 'Warn + Error', levels: ['WARN', 'ERROR'] },
    { label: 'Clear', levels: [] },
  ];

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || levels.length === 0) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (!dropdownRef.current?.contains(target)) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setHighlightedIndex((prev) => (prev + 1) % levels.length);
          break;
        case 'ArrowUp':
          e.preventDefault();
          setHighlightedIndex((prev) => (prev - 1 + levels.length) % levels.length);
          break;
        case 'Enter':
        case ' ':
          e.preventDefault();
          if (highlightedIndex >= 0 && highlightedIndex < levels.length) {
            toggleLevel(levels[highlightedIndex]);
          }
          break;
        case 'Escape':
          e.preventDefault();
          setIsOpen(false);
          buttonRef.current?.focus();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, highlightedIndex, levels, toggleLevel]);

  useEffect(() => {
    if (!isOpen) return;
    const firstSelectedIndex = levels.findIndex((level) => selectedLevels.includes(level));
    setHighlightedIndex(firstSelectedIndex >= 0 ? firstSelectedIndex : 0);
  }, [isOpen, levels, selectedLevels]);

  const handleButtonKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
      case 'Enter':
      case ' ':
        e.preventDefault();
        if (!isOpen) {
          setIsOpen(true);
        }
        break;
      case 'Escape':
        if (isOpen) {
          e.preventDefault();
          setIsOpen(false);
        }
        break;
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <Button
        ref={buttonRef}
        variant="ghost"
        size="sm"
        className="gap-2 h-8 text-xs transition-colors min-w-[170px] px-3"
        style={
          isFiltered
            ? {
                backgroundColor: 'color-mix(in srgb, var(--color-accent-primary) 10%, transparent)',
                borderColor: 'color-mix(in srgb, var(--color-accent-primary) 30%, transparent)',
                borderWidth: '1px',
                borderStyle: 'solid',
                color: 'var(--color-accent-primary)',
              }
            : {
                backgroundColor: 'transparent',
                borderColor: 'var(--color-border-primary)',
                borderWidth: '1px',
                borderStyle: 'solid',
              }
        }
        onMouseEnter={(e) => {
          if (isFiltered) {
            e.currentTarget.style.backgroundColor = 'color-mix(in srgb, var(--color-accent-primary) 20%, transparent)';
          }
        }}
        onMouseLeave={(e) => {
          if (isFiltered) {
            e.currentTarget.style.backgroundColor = 'color-mix(in srgb, var(--color-accent-primary) 10%, transparent)';
          }
        }}
        onClick={() => setIsOpen(!isOpen)}
        onKeyDown={handleButtonKeyDown}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-label="Filter by log level"
      >
        <Filter
          className="h-3.5 w-3.5"
          style={{ color: isFiltered ? 'var(--color-accent-primary)' : 'var(--color-text-secondary)' }}
        />
        <span className="font-medium" style={{ color: 'var(--color-text-primary)' }}>Levels</span>
        <span style={{ color: isFiltered ? 'var(--color-accent-primary)' : 'var(--color-text-secondary)' }}>
          {selectionLabel}
        </span>
        {orderedSelected.length > 0 && (
          <span className="flex items-center -space-x-1">
            {orderedSelected.map((level) => {
              return (
                <span
                  key={level}
                  className="h-2.5 w-2.5 rounded-full border"
                  style={{
                    backgroundColor: getLevelDotColor(level),
                    borderColor: 'var(--color-border-primary)',
                  }}
                />
              );
            })}
          </span>
        )}
        <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', isOpen && 'rotate-180')} />
      </Button>
      {isOpen && (
        <div
          className="absolute top-full left-0 mt-2 rounded-xl p-3 shadow-lg z-20 min-w-[260px]"
          style={{
            backgroundColor: 'var(--color-bg-secondary)',
            borderColor: 'var(--color-border-primary)',
            borderWidth: '1px',
            borderStyle: 'solid',
          }}
          role="listbox"
        >
          <div
            className="flex items-start justify-between pb-2"
            style={{
              borderBottomColor: 'var(--color-border-primary)',
              borderBottomWidth: '1px',
              borderBottomStyle: 'solid',
            }}
          >
            <div>
              <div className="text-xs uppercase tracking-wide" style={{ color: 'var(--color-text-secondary)' }}>
                Log levels
              </div>
              <div className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>{selectionLabel}</div>
            </div>
            {isFiltered && (
              <button
                type="button"
                onClick={() => setSelection(levels)}
                className="text-xs hover:underline"
                style={{ color: 'var(--color-accent-primary)' }}
              >
                Reset
              </button>
            )}
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {quickSets.map((set) => {
              const normalized = levels.filter((level) => set.levels.includes(level));
              const isActive = isSameSelection(normalized, selectedLevels);
              return (
                <button
                  key={set.label}
                  type="button"
                  onClick={() => setSelection(normalized)}
                  className="px-2.5 py-1 rounded-full text-xs border transition-colors"
                  style={
                    isActive
                      ? {
                          backgroundColor: 'color-mix(in srgb, var(--color-accent-primary) 15%, transparent)',
                          borderColor: 'color-mix(in srgb, var(--color-accent-primary) 40%, transparent)',
                          color: 'var(--color-accent-primary)',
                        }
                      : {
                          backgroundColor: 'var(--color-bg-secondary)',
                          borderColor: 'var(--color-border-primary)',
                          color: 'var(--color-text-secondary)',
                        }
                  }
                  onMouseEnter={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.color = 'var(--color-text-primary)';
                      e.currentTarget.style.backgroundColor = 'var(--color-bg-hover)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.color = 'var(--color-text-secondary)';
                      e.currentTarget.style.backgroundColor = 'var(--color-bg-secondary)';
                    }
                  }}
                  aria-pressed={isActive}
                >
                  {set.label}
                </button>
              );
            })}
          </div>
          <div className="mt-3 space-y-1">
            {levels.map((level, index) => {
              const meta = getLevelMeta(level);
              const isSelected = selectedLevels.includes(level);
              return (
                <button
                  key={level}
                  type="button"
                  onClick={() => toggleLevel(level)}
                  onMouseEnter={(e) => {
                    setHighlightedIndex(index);
                    if (!isSelected) {
                      e.currentTarget.style.backgroundColor = 'var(--color-bg-hover)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }
                  }}
                  className="w-full flex items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors border"
                  style={
                    isSelected
                      ? {
                          backgroundColor: 'color-mix(in srgb, var(--color-accent-primary) 10%, transparent)',
                          borderColor: 'color-mix(in srgb, var(--color-accent-primary) 30%, transparent)',
                          borderWidth: '1px',
                          borderStyle: 'solid',
                          ...(highlightedIndex === index
                            ? { outline: '1px solid', outlineColor: 'color-mix(in srgb, var(--color-accent-primary) 30%, transparent)' }
                            : {}),
                        }
                      : {
                          borderColor: 'transparent',
                          borderWidth: '1px',
                          borderStyle: 'solid',
                          ...(highlightedIndex === index
                            ? { outline: '1px solid', outlineColor: 'color-mix(in srgb, var(--color-accent-primary) 30%, transparent)' }
                            : {}),
                        }
                  }
                  role="option"
                  aria-selected={isSelected}
                >
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: getLevelDotColor(level) }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>{level}</div>
                    <div className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>{meta.description}</div>
                  </div>
                  <Badge variant={meta.badgeVariant} className="min-w-[32px] text-center">
                    {counts?.[level] ?? 0}
                  </Badge>
                  <span
                    className="h-4 w-4 rounded border flex items-center justify-center"
                    style={
                      isSelected
                        ? {
                            borderColor: 'color-mix(in srgb, var(--color-accent-primary) 60%, transparent)',
                            backgroundColor: 'color-mix(in srgb, var(--color-accent-primary) 15%, transparent)',
                          }
                        : {
                            borderColor: 'var(--color-border-primary)',
                          }
                    }
                  >
                    {isSelected && <Check className="h-3 w-3" style={{ color: 'var(--color-accent-primary)' }} />}
                  </span>
                </button>
              );
            })}
          </div>
          <div
            className="mt-3 flex items-center justify-between pt-2"
            style={{
              borderTopColor: 'var(--color-border-primary)',
              borderTopWidth: '1px',
              borderTopStyle: 'solid',
            }}
          >
            <span className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
              {selectedLevels.length} of {levels.length} selected | {totalCount} in view
            </span>
            <Button
              variant="secondary"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => setIsOpen(false)}
            >
              Done
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
