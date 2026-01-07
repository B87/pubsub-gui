---
name: UI Primitives Library with shadcn/ui
overview: Integrate shadcn/ui component library and customize components to use CSS variables from the theme system. Replace duplicated UI patterns across the codebase with standardized shadcn/ui components for better maintainability and theme compatibility.
todos:
  - id: setup-shadcn
    content: Run 'npx shadcn@latest init' and configure components.json with CSS variables enabled, update tailwind.config.js
    status: completed
  - id: create-utils
    content: Create lib/utils.ts with cn() utility function for className merging
    status: completed
    dependencies:
      - setup-shadcn
  - id: map-theme-variables
    content: Map shadcn CSS variables to existing theme system variables in globals.css or themes.css
    status: completed
    dependencies:
      - setup-shadcn
  - id: install-button
    content: Install shadcn Button component and customize to add loading state support and ensure theme variable usage
    status: completed
    dependencies:
      - setup-shadcn
      - map-theme-variables
  - id: install-dialog
    content: Install shadcn Dialog component and ensure backdrop/content use theme CSS variables
    status: completed
    dependencies:
      - setup-shadcn
      - map-theme-variables
  - id: install-input
    content: Install shadcn Input and Label components, create FormField wrapper component with label/helper text/error support
    status: completed
    dependencies:
      - setup-shadcn
      - map-theme-variables
  - id: install-select
    content: Install shadcn Select component and create wrapper for easier API with options array
    status: completed
    dependencies:
      - setup-shadcn
      - map-theme-variables
  - id: install-card
    content: Install shadcn Card component and add hoverable variant if needed
    status: completed
    dependencies:
      - setup-shadcn
      - map-theme-variables
  - id: install-alert
    content: Install shadcn Alert component and add success/warning variants mapped to theme CSS variables
    status: completed
    dependencies:
      - setup-shadcn
      - map-theme-variables
  - id: install-form-components
    content: Install shadcn Checkbox, RadioGroup, Badge, and Separator components, ensure theme variable usage
    status: completed
    dependencies:
      - setup-shadcn
      - map-theme-variables
  - id: migrate-dialogs
    content: Migrate ConnectionDialog, TopicCreateDialog, DeleteConfirmDialog, SubscriptionDialog, and SettingsDialog to use shadcn Dialog and Button components
    status: completed
    dependencies:
      - install-dialog
      - install-button
  - id: migrate-forms
    content: Replace all form inputs in dialogs with shadcn Input and Select components, use FormField wrapper where appropriate
    status: completed
    dependencies:
      - install-input
      - install-select
  - id: migrate-buttons
    content: Replace all button instances across components with shadcn Button component
    status: completed
    dependencies:
      - install-button
  - id: migrate-cards
    content: Update MessageCard and other card components to use shadcn Card component where applicable
    status: completed
    dependencies:
      - install-card
  - id: migrate-alerts
    content: Replace error/success message patterns with shadcn Alert component
    status: completed
    dependencies:
      - install-alert
  - id: update-empty-state
    content: Update EmptyState component to use shadcn Button component and CSS variables
    status: completed
    dependencies:
      - install-button
  - id: update-status-indicator
    content: Update StatusIndicator to use CSS variables instead of hardcoded colors
    status: completed
  - id: theme-testing
    content: Test all updated components with all 5 themes (Auto, Dark, Light, Dracula, Monokai) to ensure proper appearance
    status: pending
    dependencies:
      - migrate-dialogs
      - migrate-forms
      - migrate-buttons
      - migrate-cards
      - migrate-alerts
---

# UI Primitives Library Plan

## Overview

Integrate **shadcn/ui** - a collection of accessible, customizable React components built on Radix UI and Tailwind CSS. Customize shadcn components to use CSS variables from the existing theme system for full theme compatibility (Auto, Dark, Light, Dracula, Monokai).

**Why shadcn/ui:**

- Already built, tested, and maintained
- Built on Radix UI (already in use in codebase)
- Highly customizable with Tailwind CSS
- Copy-paste components (not a dependency)
- Full TypeScript support
- Excellent accessibility out of the box

**Dependencies:**

- `lucide-react` - Icon library (will be installed by shadcn)
- `class-variance-authority` - For variant management (installed by shadcn)
- `clsx` and `tailwind-merge` - For className utilities (installed by shadcn)

## Analysis of Current Duplication

### Patterns Found:

1. **Buttons**: 3+ variants duplicated across 10+ files

   - Primary (blue-600/blue-700) - used in dialogs, forms
   - Secondary (slate-700/slate-600) - used for cancel actions
   - Text buttons with hover states - used in headers, toolbars
   - Destructive (red-600/red-700) - used in delete dialogs
   - Disabled states with opacity
   - Loading states with text changes

2. **Dialogs/Modals**: Pattern repeated in 5+ files

   - Backdrop overlay (bg-black/50 or color-mix)
   - Modal container (bg-slate-800, border-slate-700, rounded-lg)
   - Header with title and optional close button
   - Content area with padding
   - Footer with action buttons
   - Click-outside-to-close behavior

3. **Input Fields**: Repeated in 8+ files

   - Text inputs (bg-slate-900, border-slate-700, focus:ring-blue-500)
   - Select dropdowns (same styling)
   - Labels (text-slate-400, font-medium, mb-2)
   - Helper text (text-xs, text-slate-500, mt-1)
   - Error states

4. **Cards**: Pattern in MessageCard, template cards

   - Container (bg-slate-800, border-slate-700, rounded-lg)
   - Header sections with borders
   - Expandable/collapsible sections

5. **Alerts/Error Messages**: Inconsistent patterns

   - Error banners (some use CSS variables, some use hardcoded red-900/20)
   - Success/warning messages

6. **Badges/Tags**: Small badges with bg-slate-700, text-slate-400

7. **Form Fields**: Label + Input + Helper text pattern repeated

## Implementation Plan

### Phase 0: shadcn/ui Setup

#### 1. Install and Configure shadcn/ui

- Install shadcn/ui CLI: `npx shadcn@latest init`
- Configure `components.json` with:
  - `style`: "new-york" (cleaner, more minimal)
  - `baseColor`: "slate" (matches current theme)
  - `cssVariables`: true (critical for theme system)
  - `tailwind.config.js` path
  - `components` directory: `src/components/ui`
- Update `tailwind.config.js` to include shadcn theme configuration
- Create `lib/utils.ts` with `cn()` utility for className merging

#### 2. Theme Integration

- Update shadcn's CSS variables in `globals.css` or `themes.css` to map to existing theme variables
- Map shadcn variables to theme system:
  - `--background` → `var(--color-bg-primary)`
  - `--foreground` → `var(--color-text-primary)`
  - `--primary` → `var(--color-accent-primary)`
  - `--destructive` → `var(--color-error)`
  - `--muted` → `var(--color-bg-tertiary)`
  - `--border` → `var(--color-border-primary)`
  - etc.

### Phase 1: Install Core shadcn Components (High Priority)

#### 1. Button Component (`npx shadcn@latest add button`)

**shadcn Variants:**

- `default` - Primary button (maps to our primary)
- `destructive` - Delete/danger actions
- `outline` - Secondary button
- `secondary` - Tertiary button
- `ghost` - Text button
- `link` - Link-style button

**Customization:**

- Add `loading` prop support (shadcn doesn't include this by default)
- Ensure all colors use CSS variables from theme system
- Add size variants if needed

#### 2. Dialog Component (`npx shadcn@latest add dialog`)

**shadcn Components:**

- `Dialog` - Root component
- `DialogTrigger` - Button to open dialog
- `DialogContent` - Main container
- `DialogHeader` - Title and description
- `DialogFooter` - Action buttons
- `DialogTitle` - Dialog title
- `DialogDescription` - Optional description
- `DialogClose` - Close button

**Customization:**

- Wrap in custom component for easier API (optional)
- Ensure backdrop uses `color-mix` for theme compatibility
- All colors via CSS variables

#### 3. Input Component (`npx shadcn@latest add input`)

**shadcn Component:**

- Basic input with theme-compatible styling

**Customization:**

- Create wrapper component with label, helper text, error states
- Use `Label` component from shadcn for labels
- Ensure all colors use CSS variables

#### 4. Select Component (`npx shadcn@latest add select`)

**shadcn Components:**

- `Select` - Root component
- `SelectTrigger` - Button that opens dropdown
- `SelectContent` - Dropdown menu
- `SelectItem` - Individual option
- `SelectValue` - Display selected value
- `SelectLabel` - Group label (optional)

**Customization:**

- Create wrapper for easier API with options array
- Ensure dropdown styling uses CSS variables

#### 5. Card Component (`npx shadcn@latest add card`)

**shadcn Components:**

- `Card` - Root container
- `CardHeader` - Header section
- `CardTitle` - Card title
- `CardDescription` - Optional description
- `CardContent` - Main content
- `CardFooter` - Footer section

**Customization:**

- Add hoverable variant if needed
- Ensure all colors use CSS variables

#### 6. Alert Component (`npx shadcn@latest add alert`)

**shadcn Components:**

- `Alert` - Root container
- `AlertTitle` - Alert title
- `AlertDescription` - Alert message
- `AlertIcon` - Optional icon (via lucide-react)

**shadcn Variants:**

- `default` - Info alerts
- `destructive` - Error alerts

**Customization:**

- Add `success` and `warning` variants
- Map variants to theme CSS variables
- Add dismissible functionality if needed

### Phase 2: Additional shadcn Components (Medium Priority)

#### 7. Label Component (`npx shadcn@latest add label`)

**shadcn Component:**

- `Label` - Accessible label component

**Customization:**

- Create FormField wrapper component that combines Label + Input/Select + helper text
- Add required indicator support

#### 8. Checkbox Component (`npx shadcn@latest add checkbox`)

**shadcn Components:**

- `Checkbox` - Root component
- `CheckboxIndicator` - Checkmark icon

**Customization:**

- Ensure colors use CSS variables

#### 9. Radio Group Component (`npx shadcn@latest add radio-group`)

**shadcn Components:**

- `RadioGroup` - Root container
- `RadioGroupItem` - Individual radio button

**Customization:**

- Ensure colors use CSS variables

#### 10. Badge Component (`npx shadcn@latest add badge`)

**shadcn Variants:**

- `default` - Standard badge
- `secondary` - Secondary badge
- `destructive` - Error badge
- `outline` - Outlined badge

**Customization:**

- Add `success` and `warning` variants
- Map to theme CSS variables

### Phase 3: Additional Components (Lower Priority)

#### 11. Separator Component (`npx shadcn@latest add separator`)

**shadcn Component:**

- `Separator` - Horizontal or vertical divider

**Note:** Already have `@radix-ui/react-separator` installed

#### 12. Additional Components (as needed)

- `Tabs` - Already using Radix Tabs, but shadcn wrapper might be useful
- `Tooltip` - For help text and hover information
- `Popover` - For dropdown menus and popovers

**Props:**

- `size?`: 'sm' | 'md' | 'lg'
- `className?`: string

## Migration Strategy

### Step 1: Setup shadcn/ui

- Run `npx shadcn@latest init` in `frontend/` directory
- Configure `components.json` with CSS variables enabled
- Update `tailwind.config.js` with shadcn theme
- Create `lib/utils.ts` with `cn()` utility
- Map shadcn CSS variables to existing theme variables

### Step 2: Install Core Components

- Install Button, Dialog, Input, Select, Card, Alert via CLI
- Customize each component to use theme CSS variables
- Add any missing features (e.g., loading state for Button)
- Test with all 5 themes

### Step 3: Update Existing Components

**Priority order:**

1. **Dialogs**: ConnectionDialog, TopicCreateDialog, DeleteConfirmDialog, SubscriptionDialog, SettingsDialog
2. **Forms**: All form inputs in dialogs
3. **Buttons**: Replace all button instances
4. **Cards**: MessageCard, template cards
5. **Alerts**: Error messages, success messages

**Migration Pattern:**

```tsx
// Before
<button
  onClick={handleClick}
  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 disabled:opacity-50 rounded transition-colors"
>
  Submit
</button>

// After (using shadcn Button)
import { Button } from '@/components/ui/button';

<Button onClick={handleClick} disabled={loading}>
  Submit
</Button>
```

**shadcn Dialog Example:**

```tsx
// Before: Custom modal structure
<div className="fixed inset-0 bg-black/50...">
  <div className="bg-slate-800 border...">
    <h3>Title</h3>
    <div>Content</div>
    <div>Footer</div>
  </div>
</div>

// After (using shadcn Dialog)
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';

<Dialog open={open} onOpenChange={setOpen}>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Title</DialogTitle>
    </DialogHeader>
    <div>Content</div>
    <DialogFooter>
      <Button>Action</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

### Step 4: Update EmptyState Component

- Replace hardcoded button with Button primitive
- Use CSS variables for all colors

### Step 5: Update StatusIndicator Component

- Replace hardcoded colors with CSS variables
- Consider extracting status badge pattern

## File Structure

```
frontend/
├── components.json          # shadcn/ui configuration
├── lib/
│   └── utils.ts             # cn() utility for className merging
├── src/
│   ├── components/
│   │   └── ui/              # shadcn components (auto-generated)
│   │       ├── button.tsx
│   │       ├── dialog.tsx
│   │       ├── input.tsx
│   │       ├── select.tsx
│   │       ├── card.tsx
│   │       ├── alert.tsx
│   │       ├── label.tsx
│   │       ├── checkbox.tsx
│   │       ├── radio-group.tsx
│   │       ├── badge.tsx
│   │       └── separator.tsx
│   └── themes.css            # Theme CSS variables (existing)
```

## Design Principles

1. **Theme Compatibility**: All primitives MUST use CSS variables, never hardcoded colors
2. **Accessibility**: ARIA labels, keyboard navigation, focus states
3. **Composability**: Primitives can be combined (e.g., FormField wraps Input)
4. **Consistency**: Same variants, sizes, and patterns across all primitives
5. **Type Safety**: Full TypeScript support with proper prop types
6. **Flexibility**: Allow className override for edge cases

## Testing Requirements

- Visual testing with all 5 themes (Auto, Dark, Light, Dracula, Monokai)
- Test all variants and states (hover, focus, disabled, loading, error)
- Test keyboard navigation
- Test with screen readers (basic ARIA compliance)

## Benefits

1. **Reduced Code Duplication**: ~40% reduction in component code
2. **Theme Consistency**: All components automatically support all themes
3. **Easier Maintenance**: Changes to primitives propagate to all usages
4. **Better UX**: Consistent interactions across the app
5. **Type Safety**: Centralized prop types prevent errors

## Estimated Impact

- **Components to install**: 10-12 shadcn components
- **Files to update**: ~15 existing components
- **Lines of code reduction**: ~500-800 lines
- **Theme compatibility**: 100% (currently ~60%)
- **Dependencies**: No new runtime dependencies (shadcn is copy-paste)

## shadcn/ui Component Mapping

| Current Need | shadcn Component | Customization Needed |

|-------------|------------------|---------------------|

| Primary/Secondary buttons | `button` | Add loading state |

| Dialogs/Modals | `dialog` | Theme variable mapping |

| Text inputs | `input` | Wrapper with label/helper text |

| Dropdowns | `select` | Wrapper with options array |

| Cards | `card` | Optional hoverable variant |

| Error/Success alerts | `alert` | Add success/warning variants |

| Form labels | `label` | FormField wrapper component |

| Checkboxes | `checkbox` | Theme variable mapping |

| Radio buttons | `radio-group` | Theme variable mapping |

| Badges/Tags | `badge` | Add success/warning variants |

| Dividers | `separator` | Theme variable mapping |