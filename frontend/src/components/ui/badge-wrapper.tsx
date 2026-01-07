import * as React from "react"
import { Badge as ShadcnBadge, BadgeProps as ShadcnBadgeProps } from "./badge"
import { cn } from "@/lib/utils"

export interface BadgeProps extends Omit<ShadcnBadgeProps, "variant"> {
  variant?: "default" | "secondary" | "destructive" | "outline" | "success" | "warning"
}

function Badge({ className, variant = "default", style, ...props }: BadgeProps) {
  const getStyles = () => {
    switch (variant) {
      case "success":
        return {
          backgroundColor: "var(--color-success-bg)",
          borderColor: "var(--color-success-border)",
          color: "var(--color-success)",
        }
      case "warning":
        return {
          backgroundColor: "var(--color-warning-bg)",
          borderColor: "var(--color-warning-border)",
          color: "var(--color-warning)",
        }
      default:
        return style
    }
  }

  // Map custom variants to shadcn variants
  const shadcnVariant = variant === "success" || variant === "warning"
    ? "default"
    : variant

  return (
    <ShadcnBadge
      variant={shadcnVariant}
      className={cn(className)}
      style={{
        ...getStyles(),
        ...style,
      }}
      {...props}
    />
  )
}
Badge.displayName = "Badge"

export { Badge }
