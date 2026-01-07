import * as React from "react"
import { Label } from "./label"
import { Input } from "./input-wrapper"
import { cn } from "@/lib/utils"

export interface FormFieldProps {
  label?: string
  required?: boolean
  error?: string
  helperText?: string | React.ReactNode
  children: React.ReactNode
  className?: string
}

const FormField = React.forwardRef<HTMLDivElement, FormFieldProps>(
  ({ label, required, error, helperText, children, className }, ref) => {
    return (
      <div ref={ref} className={cn("space-y-2", className)}>
        {label && (
          <Label>
            {label}
            {required && (
              <span style={{ color: "var(--color-error)" }} className="ml-1">
                *
              </span>
            )}
          </Label>
        )}
        {children}
        {helperText && !error && (
          <div
            className="text-xs"
            style={{ color: "var(--color-text-muted)" }}
          >
            {helperText}
          </div>
        )}
        {error && (
          <p
            className="text-xs"
            style={{ color: "var(--color-error)" }}
          >
            {error}
          </p>
        )}
      </div>
    )
  }
)
FormField.displayName = "FormField"

export { FormField }
