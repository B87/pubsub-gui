import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Alert, Button, Badge, Input } from '../ui';
import {
  Search,
  RefreshCw,
  ChevronRight,
  X,
  FileText
} from 'lucide-react';
import { JsonTree } from './JSONTree';
import { LogLevelFilter } from './LogLevelFilter';
import { LogDateRangeFilter } from './LogDateRangeFilter';
import { GetLogs, GetLogsFiltered } from '../../wailsjs/go/main/App';

interface LogEntry {
  time: string;
  level: string;
  msg: string;
  fields?: Record<string, any>;
}

interface FilteredLogsResult {
  entries: LogEntry[];
  total: number;
}

interface LogsSettingsTabProps {
  activeTab?: string;
}

const LOG_LEVELS = ['DEBUG', 'INFO', 'WARN', 'ERROR'];

// Simple cn utility for conditional classes
function cn(...classes: (string | boolean | undefined)[]): string {
  return classes.filter(Boolean).join(' ');
}

// Log Stats Component
function LogStats({ counts }: { counts: Record<string, number> }) {
  return (
    <div className="flex items-center gap-4">
      {LOG_LEVELS.map(level => (
        <div key={level} className="flex items-center gap-2">
          <span className="text-xs text-slate-200 uppercase">{level}:</span>
          <Badge variant={getLevelBadgeVariant(level)}>{counts[level] ?? 0}</Badge>
        </div>
      ))}
    </div>
  );
}

// Individual Log Entry Component
function LogEntryCard({
  log,
  index,
  isExpanded,
  onToggle,
  searchQuery,
}: {
  log: LogEntry;
  index: number;
  isExpanded: boolean;
  onToggle: () => void;
  searchQuery: string;
}) {
  const formatTime = (timeStr: string): string => {
    try {
      const date = new Date(timeStr);
      return date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      });
    } catch {
      return timeStr;
    }
  };

  const highlightText = (text: string) => {
    if (!searchQuery) return text;
    const regex = new RegExp(`(${searchQuery})`, 'gi');
    const parts = text.split(regex);
    return parts.map((part, i) =>
      regex.test(part) ? (
        <mark
          key={i}
          className="rounded px-0.5"
          style={{
            backgroundColor: 'color-mix(in srgb, var(--color-accent-primary) 30%, transparent)',
            color: 'inherit',
          }}
        >
          {part}
        </mark>
      ) : (
        part
      )
    );
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'Enter':
      case ' ':
        e.preventDefault();
        onToggle();
        break;
    }
  };

  return (
    <div
      className="rounded overflow-hidden transition-colors"
      style={{
        backgroundColor: 'var(--color-bg-secondary)',
        borderColor: 'var(--color-border-primary)',
        borderWidth: '1px',
        borderStyle: 'solid',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = 'var(--color-accent-primary)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = 'var(--color-border-primary)';
      }}
    >
      <div
        className="px-3 py-1.5 cursor-pointer transition-colors flex items-center gap-2"
        style={{
          backgroundColor: 'transparent',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = 'var(--color-bg-hover)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = 'transparent';
        }}
        onClick={onToggle}
        onKeyDown={handleKeyDown}
        tabIndex={0}
        role="button"
        aria-expanded={isExpanded}
        aria-label={`${isExpanded ? 'Collapse' : 'Expand'} log entry`}
      >
        <ChevronRight
          className={cn(
            'h-3 w-3 transition-transform shrink-0'
          )}
          style={{ color: 'var(--color-text-secondary)' }}
        />
        <span
          className="text-xs font-mono shrink-0 w-16 uppercase"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          {log.level}
        </span>
        <span
          className="text-xs font-mono shrink-0"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          {formatTime(log.time)}
        </span>
        <span
          className="text-sm flex-1 min-w-0 truncate"
          style={{ color: 'var(--color-text-primary)' }}
        >
          {highlightText(log.msg)}
        </span>
        {log.fields && Object.keys(log.fields).length > 0 && (
          <span
            className="text-xs shrink-0"
            style={{ color: 'var(--color-text-tertiary)' }}
          >
            ({Object.keys(log.fields).length})
          </span>
        )}
      </div>
      {isExpanded && (
        <div
          className="px-3 py-2"
          style={{
            borderTopColor: 'var(--color-border-primary)',
            borderTopWidth: '1px',
            borderTopStyle: 'solid',
            backgroundColor: 'var(--color-bg-hover)',
          }}
        >
          {log.fields && Object.keys(log.fields).length > 0 ? (
            <div className="space-y-2">
              <div
                className="text-xs font-semibold uppercase tracking-wide mb-1"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                Fields
              </div>
              <div
                className="rounded p-2 border"
                style={{
                  backgroundColor: 'var(--color-bg-secondary)',
                  borderColor: 'var(--color-border-primary)',
                }}
              >
                <JsonTree data={log.fields} searchQuery={searchQuery} />
              </div>
            </div>
          ) : (
            <div
              className="text-xs italic"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              No additional fields
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function getLevelBadgeVariant(level: string): 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning' {
  switch (level.toUpperCase()) {
    case 'DEBUG':
      return 'default';
    case 'INFO':
      return 'secondary';
    case 'WARN':
      return 'warning';
    case 'ERROR':
      return 'destructive';
    default:
      return 'default';
  }
}

export function LogsSettingsTab({ activeTab }: LogsSettingsTabProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [selectedLevels, setSelectedLevels] = useState<string[]>(LOG_LEVELS);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [limit, setLimit] = useState<number>(1000);
  const [offset, setOffset] = useState<number>(0);
  const [autoRefresh, setAutoRefresh] = useState<boolean>(false);
  const [refreshInterval, setRefreshInterval] = useState<number>(5);
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());
  const autoRefreshRef = useRef<number | null>(null);
  const levelCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    LOG_LEVELS.forEach((level) => {
      counts[level] = 0;
    });
    logs.forEach((log) => {
      const level = log.level.toUpperCase();
      if (level in counts) {
        counts[level] += 1;
      }
    });
    return counts;
  }, [logs]);

  const loadLogs = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const levelFilter =
        selectedLevels.length === LOG_LEVELS.length
          ? 'all'
          : selectedLevels.length === 0
          ? 'none'
          : selectedLevels.join(',');
      const hasFilters = Boolean(startDate || endDate || levelFilter !== 'all' || searchTerm);
      const start = startDate || endDate || selectedDate;
      const end = endDate || (startDate ? '' : selectedDate);

      const result = hasFilters
        ? await GetLogsFiltered(start, end, levelFilter, searchTerm, limit, offset)
        : await GetLogs(selectedDate, limit, offset);

      if (!result) {
        setLogs([]);
        setTotal(0);
        return;
      }

      if (hasFilters) {
        const filteredResult = result as FilteredLogsResult;
        setLogs(Array.isArray(filteredResult?.entries) ? filteredResult.entries : []);
        setTotal(typeof filteredResult?.total === 'number' ? filteredResult.total : 0);
      } else {
        const entries = Array.isArray(result) ? result as LogEntry[] : [];
        setLogs(entries);
        setTotal(entries.length);
      }
    } catch (err) {
      console.error('Failed to load logs:', err);
      setError(err instanceof Error ? err.message : 'Failed to load logs');
    } finally {
      setLoading(false);
    }
  }, [selectedDate, startDate, endDate, selectedLevels, searchTerm, limit, offset]);

  useEffect(() => {
    if (activeTab === 'logs') {
      loadLogs();
    }
    return () => {
      if (autoRefreshRef.current) {
        clearInterval(autoRefreshRef.current);
      }
    };
  }, [activeTab, loadLogs]);

  useEffect(() => {
    if (activeTab === 'logs' && autoRefresh) {
      autoRefreshRef.current = setInterval(() => {
        loadLogs();
      }, refreshInterval * 1000);
      return () => {
        if (autoRefreshRef.current) {
          clearInterval(autoRefreshRef.current);
        }
      };
    } else {
      if (autoRefreshRef.current) {
        clearInterval(autoRefreshRef.current);
      }
    }
  }, [activeTab, autoRefresh, refreshInterval, loadLogs]);

  // Keyboard shortcut: Cmd+R / Ctrl+R to refresh
  useEffect(() => {
    if (activeTab !== 'logs') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input/textarea
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return;
      }

      // Handle refresh shortcut
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'r') {
        e.preventDefault();
        loadLogs();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTab, loadLogs]);


  const toggleExpanded = (index: number) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const expandAll = () => {
    setExpandedIds(new Set(logs.map((_, index) => index)));
  };

  const collapseAll = () => {
    setExpandedIds(new Set());
  };

  return (
    <div
      className="h-full w-full flex flex-col"
      style={{ backgroundColor: 'var(--color-bg-primary)', overflow: 'hidden' }}
    >
      {/* Sticky Header */}
      <header
        className="shrink-0 z-10 backdrop-blur relative"
        style={{
          borderBottomColor: 'var(--color-border-primary)',
          borderBottomWidth: '1px',
          borderBottomStyle: 'solid',
          backgroundColor: 'color-mix(in srgb, var(--color-bg-primary) 95%, transparent)',
          overflow: 'visible',
        }}
      >
        <div className="px-6 py-3" style={{ overflow: 'visible' }}>
          {/* Title and Stats Row */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <div
                  className="h-6 w-6 rounded flex items-center justify-center"
                  style={{ backgroundColor: 'var(--color-accent-primary)' }}
                >
                  <FileText className="h-4 w-4" style={{ color: 'white' }} />
                </div>
                <h1
                  className="text-xl font-semibold"
                  style={{ color: 'var(--color-text-primary)' }}
                >
                  Logs Explorer
                </h1>
              </div>
              <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>|</span>
              <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                {total > 0 ? `${offset + 1}-${Math.min(offset + logs.length, total)} of ${total}` : '0'} entries
              </span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={loadLogs}
              disabled={loading}
              className="gap-2"
              aria-label="Refresh logs (Cmd+R / Ctrl+R)"
            >
              <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
              Refresh
            </Button>
          </div>

          {/* Log Level Stats */}
          <div className="mb-3">
            <LogStats counts={levelCounts} />
          </div>

          {/* Compact Filters Row */}
          <div className="flex items-center gap-3 flex-wrap relative" style={{ overflow: 'visible' }}>
            {/* Search */}
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search
                className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5"
                style={{ color: 'var(--color-text-secondary)' }}
              />
              <Input
                placeholder="Search..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setOffset(0);
                }}
                className="pl-8 h-8 text-sm"
                style={{
                  backgroundColor: 'var(--color-bg-secondary)',
                  borderColor: 'var(--color-border-primary)',
                }}
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 transition-colors"
                  style={{ color: 'var(--color-text-secondary)' }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = 'var(--color-text-primary)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = 'var(--color-text-secondary)';
                  }}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* Log Level Filter */}
            <LogLevelFilter
              levels={LOG_LEVELS}
              selectedLevels={selectedLevels}
              counts={levelCounts}
              onChange={(levels) => {
                setSelectedLevels(levels);
                setOffset(0);
              }}
            />

            {/* Date Range */}
            <LogDateRangeFilter
              selectedDate={selectedDate}
              startDate={startDate}
              endDate={endDate}
              onSelectedDateChange={(date) => {
                setSelectedDate(date);
                setStartDate('');
                setEndDate('');
                setOffset(0);
              }}
              onStartDateChange={(date) => {
                setStartDate(date);
                setOffset(0);
              }}
              onEndDateChange={(date) => {
                setEndDate(date);
                setOffset(0);
              }}
            />

            {/* Additional Controls */}
            <div className="flex items-center gap-2 ml-auto">
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-text-secondary">Limit:</span>
                <Input
                  type="number"
                  value={limit.toString()}
                  onChange={(e) => {
                    setLimit(parseInt(e.target.value) || 100);
                    setOffset(0);
                  }}
                  min="1"
                  max="1000"
                  className="w-16 h-8 text-sm"
                />
              </div>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoRefresh}
                  onChange={(e) => setAutoRefresh(e.target.checked)}
                  className="w-3.5 h-3.5"
                />
                <span className="text-xs text-text-secondary">Auto</span>
              </label>
              {autoRefresh && (
                <div className="flex items-center gap-1.5">
                  <Input
                    type="number"
                    value={refreshInterval.toString()}
                    onChange={(e) => setRefreshInterval(parseInt(e.target.value) || 5)}
                    min="1"
                    max="60"
                    className="w-12 h-8 text-sm"
                  />
                  <span className="text-xs text-text-secondary">s</span>
                </div>
              )}
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="sm" onClick={expandAll} className="text-xs h-8 px-2">
                  Expand
                </Button>
                <Button variant="ghost" size="sm" onClick={collapseAll} className="text-xs h-8 px-2">
                  Collapse
                </Button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden p-6">
        {error && (
          <div className="shrink-0 mb-4">
            <Alert variant="destructive">{error}</Alert>
          </div>
        )}

        {/* Logs List */}
        <div className="flex-1 overflow-y-auto space-y-2 min-h-0">
          {loading && logs.length === 0 ? (
            <div className="text-center py-12" style={{ color: 'var(--color-text-secondary)' }}>
              <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2" />
              <p className="text-lg">Loading logs...</p>
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-12" style={{ color: 'var(--color-text-secondary)' }}>
              <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-lg">No logs found</p>
              <p className="text-sm mt-1">Try adjusting your filters or search query</p>
            </div>
          ) : (
            <>
              {logs.map((log, index) => (
                <LogEntryCard
                  key={`${log.time}-${index}`}
                  log={log}
                  index={index}
                  isExpanded={expandedIds.has(index)}
                  onToggle={() => toggleExpanded(index)}
                  searchQuery={searchTerm}
                />
              ))}

              {/* Pagination */}
              {total > limit && (
                <div
                  className="flex items-center justify-between pt-4"
                  style={{
                    borderTopColor: 'var(--color-border-primary)',
                    borderTopWidth: '1px',
                    borderTopStyle: 'solid',
                  }}
                >
                  <div className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                    Showing {offset + 1}-{Math.min(offset + logs.length, total)} of {total} entries
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={() => setOffset(Math.max(0, offset - limit))}
                      disabled={offset === 0 || loading}
                      variant="secondary"
                      size="sm"
                    >
                      Previous
                    </Button>
                    <Button
                      onClick={() => setOffset(offset + limit)}
                      disabled={offset + limit >= total || loading}
                      variant="secondary"
                      size="sm"
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
