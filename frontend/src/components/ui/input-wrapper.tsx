import * as React from "react"
import { Input as ShadcnInput } from "./input"
import { cn } from "@/lib/utils"

export interface InputProps extends React.ComponentProps<"input"> {
  error?: string
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, error, ...props }, ref) => {
    return (
      <ShadcnInput
        ref={ref}
        className={cn(
          error && "border-destructive focus-visible:ring-destructive",
          className
        )}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
