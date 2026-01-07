import * as React from "react"
import { Alert as ShadcnAlert, AlertTitle, AlertDescription } from "./alert"
import { AlertCircle, CheckCircle2, AlertTriangle, Info } from "lucide-react"
import { cn } from "@/lib/utils"

export interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "destructive" | "success" | "warning"
  showIcon?: boolean
}

const Alert = React.forwardRef<HTMLDivElement, AlertProps>(
  ({ className, variant = "default", showIcon = true, children, ...props }, ref) => {
    const getStyles = () => {
      switch (variant) {
        case "destructive":
          return {
            backgroundColor: "var(--color-error-bg)",
            borderColor: "var(--color-error-border)",
            color: "var(--color-error)",
          }
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
          return {
            backgroundColor: "var(--color-bg-secondary)",
            borderColor: "var(--color-border-primary)",
            color: "var(--color-text-primary)",
          }
      }
    }

    const getIcon = () => {
      if (!showIcon) return null
      switch (variant) {
        case "destructive":
          return <AlertCircle className="h-4 w-4" />
        case "success":
          return <CheckCircle2 className="h-4 w-4" />
        case "warning":
          return <AlertTriangle className="h-4 w-4" />
        default:
          return <Info className="h-4 w-4" />
      }
    }

    // Use destructive variant for shadcn Alert when it's destructive, otherwise default
    const shadcnVariant = variant === "destructive" ? "destructive" : "default"

    return (
      <ShadcnAlert
        ref={ref}
        variant={shadcnVariant}
        className={cn(className)}
        style={getStyles()}
        {...props}
      >
        {getIcon()}
        {children}
      </ShadcnAlert>
    )
  }
)
Alert.displayName = "Alert"

export { Alert, AlertTitle, AlertDescription }
