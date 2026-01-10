// Export wrapper components with theme support and additional features
// These are the components that should be used throughout the app

// Button wrapper - adds loading state support
export { Button } from "./button-wrapper"

// Dialog wrapper - applies theme CSS variables
export {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
  DialogClose,
  DialogPortal,
} from "./dialog-wrapper"

// Input wrapper - adds error state support
export { Input } from "./input-wrapper"

// Use Select wrapper - applies theme CSS variables
export {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
  SelectGroup,
  SelectLabel,
  SelectSeparator,
} from "./select-wrapper"

// Use native Label - CSS variables handle styling
export { Label } from "./label"

// Alert wrapper - adds success/warning variants
export { Alert, AlertTitle, AlertDescription } from "./alert-wrapper"

// Badge wrapper - adds success/warning variants
export { Badge } from "./badge-wrapper"

// FormField - custom wrapper for form fields
export { FormField } from "./form-field"

// Native shadcn components (no wrappers needed)
export * from "./card"
export * from "./checkbox"
export * from "./radio-group"
export * from "./separator"
