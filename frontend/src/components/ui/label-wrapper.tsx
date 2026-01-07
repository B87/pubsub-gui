import * as React from "react"
import { Label as ShadcnLabel } from "./label"
import { cn } from "@/lib/utils"

export interface LabelProps extends React.ComponentPropsWithoutRef<typeof ShadcnLabel> {}

const Label = React.forwardRef<
  React.ElementRef<typeof ShadcnLabel>,
  LabelProps
>(({ className, style, ...props }, ref) => {
  return (
    <ShadcnLabel
      ref={ref}
      className={className}
      style={{
        color: "var(--color-text-secondary)",
        ...style,
      }}
      {...props}
    />
  )
})
Label.displayName = "Label"

export { Label }
