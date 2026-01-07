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
const SelectItem = React.forwardRef<
  React.ElementRef<typeof ShadcnSelectItem>,
  React.ComponentPropsWithoutRef<typeof ShadcnSelectItem>
>(({ className, style, ...props }, ref) => {
  return (
    <ShadcnSelectItem
      ref={ref}
      className={className}
      style={{
        color: "var(--color-text-primary)",
        ...style,
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
