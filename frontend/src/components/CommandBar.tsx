import { useState, useEffect, useRef, useMemo } from 'react';
import { searchCommandBar, groupActions, highlightMatch, type CommandBarAction } from '../utils/commandBarActions';
import { formatShortcut, isMac } from '../hooks/useKeyboardShortcuts';
import type { Topic, Subscription } from '../types';

interface CommandBarProps {
  open: boolean;
  onClose: () => void;
  onExecute: (action: CommandBarAction) => void;
  actions: CommandBarAction[];
  topics: Topic[];
  subscriptions: Subscription[];
}

export default function CommandBar({
  open,
  onClose,
  onExecute,
  actions,
  topics,
  subscriptions,
}: CommandBarProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  // Search results
  const searchResults = useMemo(() => {
    const allActions = [...actions];

    // Add topic actions
    for (const topic of topics) {
      allActions.push({
        id: `topic-${topic.name}`,
        type: 'topic',
        label: topic.displayName,
        description: 'Jump to topic',
        keywords: [topic.displayName, topic.name],
        icon: 'M8 4H6a2 2 0 00-2 2v12a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-2m-4-1v8m0 0l4-4m-4 4L8 9',
        execute: () => {
          onExecute({
            id: `topic-${topic.name}`,
            type: 'topic',
            label: topic.displayName,
            keywords: [],
            execute: () => {},
          });
        },
      });
    }

    // Add subscription actions
    for (const subscription of subscriptions) {
      allActions.push({
        id: `subscription-${subscription.name}`,
        type: 'subscription',
        label: subscription.displayName,
        description: 'Jump to subscription',
        keywords: [subscription.displayName, subscription.name],
        icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
        execute: () => {
          onExecute({
            id: `subscription-${subscription.name}`,
            type: 'subscription',
            label: subscription.displayName,
            keywords: [],
            execute: () => {},
          });
        },
      });
    }

    return searchCommandBar(query, allActions, topics, subscriptions);
  }, [query, actions, topics, subscriptions, onExecute]);

  const groupedResults = useMemo(() => groupActions(searchResults), [searchResults]);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setQuery('');
      setSelectedIndex(0);
      // Small delay to ensure DOM is ready
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [open]);

  // Handle keyboard navigation
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => Math.min(prev + 1, searchResults.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => Math.max(prev - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (searchResults[selectedIndex]) {
          onExecute(searchResults[selectedIndex]);
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, searchResults, selectedIndex, onExecute, onClose]);

  // Scroll selected item into view
  useEffect(() => {
    if (resultsRef.current) {
      const selectedElement = resultsRef.current.querySelector(`[data-index="${selectedIndex}"]`);
      if (selectedElement) {
        selectedElement.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }
  }, [selectedIndex]);

  if (!open) return null;

  const renderActionItem = (action: CommandBarAction, index: number) => {
    const isSelected = index === selectedIndex;
    const labelParts = highlightMatch(action.label, query);

    return (
      <div
        key={action.id}
        data-index={index}
        onClick={() => onExecute(action)}
        className={`
          flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors
          ${isSelected
            ? 'bg-blue-600 text-white'
            : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
          }
        `}
        style={{
          backgroundColor: isSelected
            ? 'var(--color-accent-primary)'
            : 'var(--color-bg-secondary)',
          color: isSelected
            ? 'var(--color-text-primary)'
            : 'var(--color-text-secondary)',
        }}
      >
        {/* Icon */}
        {action.icon && (
          <svg
            className="w-5 h-5 shrink-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={action.icon} />
          </svg>
        )}

        {/* Label and description */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium">
              {labelParts.map((part, i) => (
                <span
                  key={i}
                  className={part.match ? 'bg-yellow-500/30 text-yellow-200' : ''}
                  style={part.match ? {
                    backgroundColor: 'var(--color-warning)',
                    color: 'var(--color-text-primary)',
                  } : {}}
                >
                  {part.text}
                </span>
              ))}
            </span>
            {action.shortcut && (
              <span className="text-xs opacity-60">
                {action.shortcut}
              </span>
            )}
          </div>
          {action.description && (
            <div className="text-xs opacity-70 mt-0.5">
              {action.description}
            </div>
          )}
        </div>

        {/* Type badge */}
        {action.type !== 'action' && (
          <span
            className="text-xs px-2 py-1 rounded bg-slate-700/50"
            style={{
              backgroundColor: 'var(--color-bg-tertiary)',
            }}
          >
            {action.type === 'topic' ? 'Topic' : 'Subscription'}
          </span>
        )}
      </div>
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Command bar"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Command bar */}
      <div
        className="relative w-full max-w-2xl mx-4 rounded-lg shadow-2xl overflow-hidden"
        style={{
          backgroundColor: 'var(--color-bg-primary)',
          borderColor: 'var(--color-border-primary)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search input */}
        <div
          className="flex items-center gap-3 px-4 py-3 border-b"
          style={{
            borderColor: 'var(--color-border-primary)',
          }}
        >
          <svg
            className="w-5 h-5 text-slate-400 shrink-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            placeholder="Type a command or search resources..."
            className="flex-1 bg-transparent text-slate-100 placeholder-slate-400 focus:outline-none"
            style={{
              color: 'var(--color-text-primary)',
            }}
            autoFocus
          />
          <kbd
            className="px-2 py-1 text-xs rounded bg-slate-700 text-slate-300"
            style={{
              backgroundColor: 'var(--color-bg-tertiary)',
              color: 'var(--color-text-tertiary)',
            }}
          >
            {isMac() ? '⌘' : 'Ctrl'}+P
          </kbd>
        </div>

        {/* Results */}
        <div
          ref={resultsRef}
          className="max-h-96 overflow-y-auto"
          style={{
            backgroundColor: 'var(--color-bg-primary)',
          }}
        >
          {searchResults.length === 0 ? (
            <div className="px-4 py-8 text-center text-slate-400">
              <p>No results found</p>
              <p className="text-xs mt-2">Try a different search term</p>
            </div>
          ) : (
            <>
              {/* Actions */}
              {groupedResults.actions.length > 0 && (
                <div>
                  <div
                    className="px-4 py-2 text-xs font-semibold text-slate-400 uppercase tracking-wider"
                    style={{
                      color: 'var(--color-text-tertiary)',
                    }}
                  >
                    Actions
                  </div>
                  {groupedResults.actions.map((action, i) => {
                    const index = searchResults.indexOf(action);
                    return renderActionItem(action, index);
                  })}
                </div>
              )}

              {/* Topics */}
              {groupedResults.topics.length > 0 && (
                <div>
                  <div
                    className="px-4 py-2 text-xs font-semibold text-slate-400 uppercase tracking-wider border-t"
                    style={{
                      color: 'var(--color-text-tertiary)',
                      borderColor: 'var(--color-border-primary)',
                    }}
                  >
                    Topics
                  </div>
                  {groupedResults.topics.map((action, i) => {
                    const index = searchResults.indexOf(action);
                    return renderActionItem(action, index);
                  })}
                </div>
              )}

              {/* Subscriptions */}
              {groupedResults.subscriptions.length > 0 && (
                <div>
                  <div
                    className="px-4 py-2 text-xs font-semibold text-slate-400 uppercase tracking-wider border-t"
                    style={{
                      color: 'var(--color-text-tertiary)',
                      borderColor: 'var(--color-border-primary)',
                    }}
                  >
                    Subscriptions
                  </div>
                  {groupedResults.subscriptions.map((action, i) => {
                    const index = searchResults.indexOf(action);
                    return renderActionItem(action, index);
                  })}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer hint */}
        <div
          className="px-4 py-2 text-xs text-slate-400 border-t flex items-center justify-between"
          style={{
            borderColor: 'var(--color-border-primary)',
            color: 'var(--color-text-tertiary)',
          }}
        >
          <span>
            <kbd className="px-1.5 py-0.5 rounded bg-slate-700/50">↑↓</kbd> Navigate
            {' '}
            <kbd className="px-1.5 py-0.5 rounded bg-slate-700/50">Enter</kbd> Select
            {' '}
            <kbd className="px-1.5 py-0.5 rounded bg-slate-700/50">Esc</kbd> Close
          </span>
        </div>
      </div>
    </div>
  );
}
