import type React from "react"
import { useState } from "react"
import { ChevronRight } from "lucide-react"

interface JsonTreeProps {
  data: unknown
  searchQuery?: string
  depth?: number
  isLast?: boolean
}

// Utility function for conditional class names
function cn(...classes: (string | boolean | undefined)[]): string {
  return classes.filter(Boolean).join(" ")
}

export function JsonTree({ data, searchQuery = "", depth = 0, isLast = true }: JsonTreeProps) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())

  const toggleCollapse = (key: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
  }

  const highlightText = (text: string) => {
    if (!searchQuery) return text
    const regex = new RegExp(`(${searchQuery})`, "gi")
    const parts = text.split(regex)
    return parts.map((part, i) =>
      regex.test(part) ? (
        <mark
          key={i}
          className="text-inherit rounded px-0.5"
          style={{
            backgroundColor: 'color-mix(in srgb, var(--color-warning) 30%, transparent)',
          }}
        >
          {part}
        </mark>
      ) : (
        part
      ),
    )
  }

  const renderValue = (value: unknown, key: string, index: number, total: number): React.ReactNode => {
    const isLastItem = index === total - 1
    const fullKey = `${depth}-${key}`

    if (value === null) {
      return (
        <div className="flex items-start font-mono text-sm" key={fullKey}>
          <span style={{ color: 'var(--color-text-primary)' }}>{highlightText(key)}</span>
          <span className="mx-1" style={{ color: 'var(--color-text-muted)' }}>:</span>
          <span style={{ color: 'var(--color-text-muted)' }}>null</span>
          {!isLastItem && <span className="mx-1" style={{ color: 'var(--color-text-muted)' }}>,</span>}
        </div>
      )
    }

    if (typeof value === "boolean") {
      return (
        <div className="flex items-start font-mono text-sm" key={fullKey}>
          <span style={{ color: 'var(--color-text-primary)' }}>{highlightText(key)}</span>
          <span className="mx-1" style={{ color: 'var(--color-text-muted)' }}>:</span>
          <span style={{ color: 'var(--color-accent-primary)' }}>{value.toString()}</span>
          {!isLastItem && <span className="mx-1" style={{ color: 'var(--color-text-muted)' }}>,</span>}
        </div>
      )
    }

    if (typeof value === "number") {
      return (
        <div className="flex items-start font-mono text-sm" key={fullKey}>
          <span style={{ color: 'var(--color-text-primary)' }}>{highlightText(key)}</span>
          <span className="mx-1" style={{ color: 'var(--color-text-muted)' }}>:</span>
          <span style={{ color: 'var(--color-accent-primary)' }}>{value}</span>
          {!isLastItem && <span className="mx-1" style={{ color: 'var(--color-text-muted)' }}>,</span>}
        </div>
      )
    }

    if (typeof value === "string") {
      return (
        <div className="flex items-start font-mono text-sm" key={fullKey}>
          <span style={{ color: 'var(--color-text-primary)' }}>{highlightText(key)}</span>
          <span className="mx-1" style={{ color: 'var(--color-text-muted)' }}>:</span>
          <span style={{ color: 'var(--color-success)' }}>"{highlightText(value)}"</span>
          {!isLastItem && <span className="mx-1" style={{ color: 'var(--color-text-muted)' }}>,</span>}
        </div>
      )
    }

    if (Array.isArray(value)) {
      const isCollapsed = collapsed.has(fullKey)
      return (
        <div key={fullKey}>
          <div
            className="flex items-start font-mono text-sm cursor-pointer -mx-1 px-1 rounded transition-colors"
            style={{
              backgroundColor: 'transparent',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'color-mix(in srgb, var(--color-bg-secondary) 50%, transparent)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
            onClick={() => toggleCollapse(fullKey)}
          >
            <ChevronRight
              className={cn(
                "h-4 w-4 transition-transform mr-1 mt-0.5 shrink-0",
                !isCollapsed && "rotate-90",
              )}
              style={{ color: 'var(--color-text-muted)' }}
            />
            <span style={{ color: 'var(--color-text-primary)' }}>{highlightText(key)}</span>
            <span className="mx-1" style={{ color: 'var(--color-text-muted)' }}>:</span>
            <span style={{ color: 'var(--color-text-muted)' }}>[</span>
            {isCollapsed && (
              <>
                <span className="mx-1" style={{ color: 'var(--color-text-muted)' }}>...{value.length} items</span>
                <span style={{ color: 'var(--color-text-muted)' }}>]</span>
                {!isLastItem && <span style={{ color: 'var(--color-text-muted)' }}>,</span>}
              </>
            )}
          </div>
          {!isCollapsed && (
            <>
              <div
                className="ml-6 pl-3"
                style={{
                  borderLeftColor: 'color-mix(in srgb, var(--color-border-primary) 50%, transparent)',
                  borderLeftWidth: '1px',
                  borderLeftStyle: 'solid',
                }}
              >
                {value.map((item, i) => (
                  <div key={i} className="flex items-start font-mono text-sm">
                    <span className="mr-2" style={{ color: 'var(--color-text-muted)' }}>{i}:</span>
                    {typeof item === "object" && item !== null ? (
                      <JsonTree
                        data={item}
                        searchQuery={searchQuery}
                        depth={depth + 1}
                        isLast={i === value.length - 1}
                      />
                    ) : (
                      <span
                        style={{
                          color:
                            typeof item === "string"
                              ? 'var(--color-success)'
                              : typeof item === "number"
                              ? 'var(--color-accent-primary)'
                              : typeof item === "boolean"
                              ? 'var(--color-accent-primary)'
                              : item === null
                              ? 'var(--color-text-muted)'
                              : 'var(--color-text-primary)',
                        }}
                      >
                        {typeof item === "string" ? `"${highlightText(item)}"` : String(item)}
                      </span>
                    )}
                    {i < value.length - 1 && <span style={{ color: 'var(--color-text-muted)' }}>,</span>}
                  </div>
                ))}
              </div>
              <div className="font-mono text-sm" style={{ color: 'var(--color-text-muted)' }}>]{!isLastItem && ","}</div>
            </>
          )}
        </div>
      )
    }

    if (typeof value === "object") {
      const entries = Object.entries(value as Record<string, unknown>)
      const isCollapsed = collapsed.has(fullKey)
      return (
        <div key={fullKey}>
          <div
            className="flex items-start font-mono text-sm cursor-pointer -mx-1 px-1 rounded transition-colors"
            style={{
              backgroundColor: 'transparent',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'color-mix(in srgb, var(--color-bg-secondary) 50%, transparent)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
            onClick={() => toggleCollapse(fullKey)}
          >
            <ChevronRight
              className={cn(
                "h-4 w-4 transition-transform mr-1 mt-0.5 shrink-0",
                !isCollapsed && "rotate-90",
              )}
              style={{ color: 'var(--color-text-muted)' }}
            />
            <span style={{ color: 'var(--color-text-primary)' }}>{highlightText(key)}</span>
            <span className="mx-1" style={{ color: 'var(--color-text-muted)' }}>:</span>
            <span style={{ color: 'var(--color-text-muted)' }}>{"{"}</span>
            {isCollapsed && (
              <>
                <span className="mx-1" style={{ color: 'var(--color-text-muted)' }}>...{entries.length} keys</span>
                <span style={{ color: 'var(--color-text-muted)' }}>{"}"}</span>
                {!isLastItem && <span style={{ color: 'var(--color-text-muted)' }}>,</span>}
              </>
            )}
          </div>
          {!isCollapsed && (
            <>
              <div
                className="ml-6 pl-3"
                style={{
                  borderLeftColor: 'color-mix(in srgb, var(--color-border-primary) 50%, transparent)',
                  borderLeftWidth: '1px',
                  borderLeftStyle: 'solid',
                }}
              >
                {entries.map(([k, v], i) => renderValue(v, k, i, entries.length))}
              </div>
              <div className="font-mono text-sm" style={{ color: 'var(--color-text-muted)' }}>
                {"}"}
                {!isLastItem && ","}
              </div>
            </>
          )}
        </div>
      )
    }

    return <span key={fullKey}>{String(value)}</span>
  }

  if (typeof data !== "object" || data === null) {
    return (
      <span
        className="font-mono text-sm"
        style={{
          color:
            typeof data === "string"
              ? 'var(--color-success)'
              : typeof data === "number"
              ? 'var(--color-accent-primary)'
              : typeof data === "boolean"
              ? 'var(--color-accent-primary)'
              : data === null
              ? 'var(--color-text-muted)'
              : 'var(--color-text-primary)',
        }}
      >
        {typeof data === "string" ? `"${data}"` : String(data)}
      </span>
    )
  }

  const entries = Object.entries(data as Record<string, unknown>)

  return (
    <div className="space-y-0.5">
      {entries.map(([key, value], index) => renderValue(value, key, index, entries.length))}
    </div>
  )
}
