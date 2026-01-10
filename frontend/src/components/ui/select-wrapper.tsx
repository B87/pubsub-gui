import * as React from "react"
import {
  Select as ShadcnSelect,
  SelectTrigger as ShadcnSelectTrigger,
  SelectContent as ShadcnSelectContent,
  SelectItem as ShadcnSelectItem,
  SelectValue,
  SelectGroup,
  SelectLabel,
  SelectSeparator,
} from "./select"
import { cn } from "@/lib/utils"

// Re-export base components
export {
  ShadcnSelect as Select,
  SelectValue,
  SelectGroup,
  SelectLabel,
  SelectSeparator,
}

// Wrapper for SelectTrigger with theme CSS variables
const SelectTrigger = React.forwardRef<
  React.ElementRef<typeof ShadcnSelectTrigger>,
  React.ComponentPropsWithoutRef<typeof ShadcnSelectTrigger>
>(({ className, style, ...props }, ref) => {
  return (
    <ShadcnSelectTrigger
      ref={ref}
      className={className}
      style={{
        backgroundColor: "var(--color-bg-input)",
        borderColor: "var(--color-border-primary)",
        color: "var(--color-text-primary)",
        ...style,
      }}
      {...props}
    />
  )
})
SelectTrigger.displayName = "SelectTrigger"

// Wrapper for SelectContent with theme CSS variables
const SelectContent = React.forwardRef<
  React.ElementRef<typeof ShadcnSelectContent>,
  React.ComponentPropsWithoutRef<typeof ShadcnSelectContent>
>(({ className, style, ...props }, ref) => {
  return (
    <ShadcnSelectContent
      ref={ref}
      className={className}
      style={{
        backgroundColor: "var(--color-bg-secondary)",
        borderColor: "var(--color-border-primary)",
        color: "var(--color-text-primary)",
        ...style,
      }}
      {...props}
    />
  )
})
SelectContent.displayName = "SelectContent"

// Wrapper for SelectItem with theme CSS variables
// Note: Radix UI uses data-highlighted attribute for keyboard navigation
// We use CSS to style both hover and highlighted states
const SelectItem = React.forwardRef<
  React.ElementRef<typeof ShadcnSelectItem>,
  React.ComponentPropsWithoutRef<typeof ShadcnSelectItem>
>(({ className, style, ...props }, ref) => {
  return (
    <ShadcnSelectItem
      ref={ref}
      className={cn(
        className,
        // Override default focus styles with theme-aware hover/highlight styles
        "[&[data-highlighted]]:bg-[var(--color-bg-hover)] [&[data-highlighted]]:text-[var(--color-text-primary)]"
      )}
      style={{
        color: "var(--color-text-primary)",
        backgroundColor: "transparent",
        // Add hover background via CSS custom property
        ...style,
      }}
      onMouseEnter={(e) => {
        // Apply hover background
        if (!e.currentTarget.hasAttribute("data-highlighted")) {
          e.currentTarget.style.backgroundColor = "var(--color-bg-hover)";
        }
      }}
      onMouseLeave={(e) => {
        // Remove hover background if not highlighted
        if (!e.currentTarget.hasAttribute("data-highlighted")) {
          e.currentTarget.style.backgroundColor = "transparent";
        }
      }}
      {...props}
    />
  )
})
SelectItem.displayName = "SelectItem"

export {
  SelectTrigger,
  SelectContent,
  SelectItem,
}
