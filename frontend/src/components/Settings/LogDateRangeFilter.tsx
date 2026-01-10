import { useEffect, useRef, useState } from 'react';
import { Calendar, ChevronDown } from 'lucide-react';
import { Button, Input } from '../ui';

interface LogDateRangeFilterProps {
  selectedDate: string;
  startDate: string;
  endDate: string;
  onSelectedDateChange: (date: string) => void;
  onStartDateChange: (date: string) => void;
  onEndDateChange: (date: string) => void;
}

type PickerMode = 'single' | 'range';

function cn(...classes: (string | boolean | undefined)[]): string {
  return classes.filter(Boolean).join(' ');
}

function toIsoDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function parseIsoDate(dateStr: string): Date | null {
  if (!dateStr) return null;
  const [year, month, day] = dateStr.split('-').map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

function formatDate(dateStr: string): string {
  const date = parseIsoDate(dateStr);
  if (!date) return '';
  const now = new Date();
  const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
  if (date.getFullYear() !== now.getFullYear()) {
    options.year = 'numeric';
  }
  return date.toLocaleDateString('en-US', options);
}

export function LogDateRangeFilter({
  selectedDate,
  startDate,
  endDate,
  onSelectedDateChange,
  onStartDateChange,
  onEndDateChange,
}: LogDateRangeFilterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<PickerMode>('single');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const todayIso = toIsoDate(new Date());
  const yesterdayIso = toIsoDate(addDays(new Date(), -1));
  const last7Start = toIsoDate(addDays(new Date(), -6));
  const last30Start = toIsoDate(addDays(new Date(), -29));

  const hasRange = Boolean(startDate || endDate);
  const isRangeComplete = Boolean(startDate && endDate);
  const isFiltered = hasRange || (selectedDate && selectedDate !== todayIso);
  const isToday = !hasRange && selectedDate === todayIso;
  const isYesterday = !hasRange && selectedDate === yesterdayIso;

  const displayText = isRangeComplete
    ? `${formatDate(startDate)} - ${formatDate(endDate)}`
    : startDate && !endDate
    ? `Since ${formatDate(startDate)}`
    : endDate && !startDate
    ? `Until ${formatDate(endDate)}`
    : isToday
    ? 'Today'
    : isYesterday
    ? 'Yesterday'
    : selectedDate
    ? formatDate(selectedDate)
    : 'Select date';

  const tagLabel = isRangeComplete
    ? 'Range'
    : startDate && !endDate
    ? 'Since'
    : endDate && !startDate
    ? 'Until'
    : null;

  const applySingleDate = (date: string, close = false) => {
    onSelectedDateChange(date);
    onStartDateChange('');
    onEndDateChange('');
    setMode('single');
    if (close) {
      setIsOpen(false);
    }
  };

  const applyRange = (start: string, end: string, close = false) => {
    onStartDateChange(start);
    onEndDateChange(end);
    if (end) {
      onSelectedDateChange(end);
    }
    setMode('range');
    if (close) {
      setIsOpen(false);
    }
  };

  const clearRange = () => {
    onStartDateChange('');
    onEndDateChange('');
    setMode('single');
  };

  const switchMode = (nextMode: PickerMode) => {
    if (nextMode === 'single') {
      clearRange();
      return;
    }
    setMode('range');
    if (!startDate && !endDate) {
      const seedDate = selectedDate || todayIso;
      onStartDateChange(seedDate);
      onEndDateChange('');
    }
  };

  const quickRanges = [
    {
      label: 'Today',
      isActive: !hasRange && selectedDate === todayIso,
      onClick: () => applySingleDate(todayIso, true),
    },
    {
      label: 'Yesterday',
      isActive: !hasRange && selectedDate === yesterdayIso,
      onClick: () => applySingleDate(yesterdayIso, true),
    },
    {
      label: 'Last 7 days',
      isActive: startDate === last7Start && endDate === todayIso,
      onClick: () => applyRange(last7Start, todayIso, true),
    },
    {
      label: 'Last 30 days',
      isActive: startDate === last30Start && endDate === todayIso,
      onClick: () => applyRange(last30Start, todayIso, true),
    },
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
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (!dropdownRef.current?.contains(target)) return;

      if (e.key === 'Escape') {
        e.preventDefault();
        setIsOpen(false);
        buttonRef.current?.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      setMode(hasRange ? 'range' : 'single');
    }
  }, [isOpen, hasRange]);

  const handleButtonKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'Enter':
      case ' ':
      case 'ArrowDown':
        e.preventDefault();
        setIsOpen(true);
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
        className="gap-2 h-8 text-xs transition-colors min-w-[200px] px-3"
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
        aria-haspopup="dialog"
        aria-label="Select date range"
      >
        <Calendar
          className="h-3.5 w-3.5 shrink-0"
          style={{ color: isFiltered ? 'var(--color-accent-primary)' : 'var(--color-text-secondary)' }}
        />
        <span
          className="max-w-[200px] truncate font-medium"
          style={{
            color: !selectedDate && !hasRange ? 'var(--color-text-secondary)' : 'var(--color-text-primary)',
          }}
        >
          {displayText}
        </span>
        {tagLabel && (
          <span
            className="text-[10px] px-1 py-0.5 rounded shrink-0"
            style={{
              backgroundColor: 'color-mix(in srgb, var(--color-accent-primary) 20%, transparent)',
              color: 'var(--color-accent-primary)',
            }}
          >
            {tagLabel}
          </span>
        )}
        <ChevronDown className={cn('h-3.5 w-3.5 transition-transform shrink-0', isOpen && 'rotate-180')} />
      </Button>
      {isOpen && (
        <div
          className="absolute top-full left-0 mt-2 rounded-xl p-3 shadow-lg z-20 min-w-[320px]"
          style={{
            backgroundColor: 'var(--color-bg-secondary)',
            borderColor: 'var(--color-border-primary)',
            borderWidth: '1px',
            borderStyle: 'solid',
          }}
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
                Date filter
              </div>
              <div className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>{displayText}</div>
            </div>
            {isFiltered && (
              <button
                type="button"
                onClick={() => applySingleDate(todayIso, true)}
                className="text-xs hover:underline"
                style={{ color: 'var(--color-accent-primary)' }}
              >
                Today
              </button>
            )}
          </div>

          <div className="mt-3 space-y-3">
            <div>
              <div className="text-xs uppercase text-text-secondary tracking-wide mb-2">
                Quick ranges
              </div>
              <div className="flex flex-wrap gap-2">
                {quickRanges.map((range) => (
                  <button
                    key={range.label}
                    type="button"
                    onClick={range.onClick}
                    className="px-2.5 py-1 rounded-full text-xs border transition-colors"
                    style={
                      range.isActive
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
                      if (!range.isActive) {
                        e.currentTarget.style.color = 'var(--color-text-primary)';
                        e.currentTarget.style.backgroundColor = 'var(--color-bg-hover)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!range.isActive) {
                        e.currentTarget.style.color = 'var(--color-text-secondary)';
                        e.currentTarget.style.backgroundColor = 'var(--color-bg-secondary)';
                      }
                    }}
                    aria-pressed={range.isActive}
                  >
                    {range.label}
                  </button>
                ))}
              </div>
            </div>

            <div
              className="pt-3"
              style={{
                borderTopColor: 'var(--color-border-primary)',
                borderTopWidth: '1px',
                borderTopStyle: 'solid',
              }}
            >
              <div className="flex items-center justify-between">
                <div className="text-xs uppercase tracking-wide" style={{ color: 'var(--color-text-secondary)' }}>
                  Custom
                </div>
                <div
                  className="inline-flex items-center gap-1 rounded-full p-0.5"
                  style={{
                    backgroundColor: 'var(--color-bg-secondary)',
                    borderColor: 'var(--color-border-primary)',
                    borderWidth: '1px',
                    borderStyle: 'solid',
                  }}
                >
                  {(['single', 'range'] as PickerMode[]).map((value) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => switchMode(value)}
                      className="px-2.5 py-1 rounded-full text-[11px] uppercase tracking-wide transition-colors"
                      style={
                        mode === value
                          ? {
                              backgroundColor: 'var(--color-accent-primary)',
                              color: 'white',
                            }
                          : {
                              color: 'var(--color-text-secondary)',
                            }
                      }
                      onMouseEnter={(e) => {
                        if (mode !== value) {
                          e.currentTarget.style.color = 'var(--color-text-primary)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (mode !== value) {
                          e.currentTarget.style.color = 'var(--color-text-secondary)';
                        }
                      }}
                      aria-pressed={mode === value}
                    >
                      {value === 'single' ? 'Single day' : 'Range'}
                    </button>
                  ))}
                </div>
              </div>

              {mode === 'single' ? (
                <div className="mt-2">
                  <label className="text-xs mb-1 block" style={{ color: 'var(--color-text-secondary)' }}>Day</label>
                  <Input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => applySingleDate(e.target.value)}
                    className="h-9 text-sm"
                  />
                </div>
              ) : (
                <div className="mt-2 space-y-2">
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <label className="text-xs mb-1 block" style={{ color: 'var(--color-text-secondary)' }}>From</label>
                      <Input
                        type="date"
                        value={startDate}
                        onChange={(e) => onStartDateChange(e.target.value)}
                        className="h-9 text-sm"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="text-xs mb-1 block" style={{ color: 'var(--color-text-secondary)' }}>To</label>
                      <Input
                        type="date"
                        value={endDate}
                        onChange={(e) => {
                          const next = e.target.value;
                          onEndDateChange(next);
                          if (next && !startDate) {
                            onStartDateChange(next);
                          }
                          if (next) {
                            onSelectedDateChange(next);
                          }
                        }}
                        className="h-9 text-sm"
                      />
                    </div>
                  </div>
                  <div className="text-[10px]" style={{ color: 'var(--color-text-tertiary)' }}>
                    Leave end blank to include up to today.
                  </div>
                </div>
              )}
            </div>

            <div
              className="flex items-center justify-between pt-2"
              style={{
                borderTopColor: 'var(--color-border-primary)',
                borderTopWidth: '1px',
                borderTopStyle: 'solid',
              }}
            >
              <div className="flex items-center gap-2">
                {hasRange && (
                  <button
                    type="button"
                    onClick={clearRange}
                    className="text-xs transition-colors"
                    style={{ color: 'var(--color-text-secondary)' }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.color = 'var(--color-text-primary)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.color = 'var(--color-text-secondary)';
                    }}
                  >
                    Clear range
                  </button>
                )}
              </div>
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
        </div>
      )}
    </div>
  );
}
