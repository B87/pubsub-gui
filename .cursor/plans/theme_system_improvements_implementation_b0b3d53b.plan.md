---
name: Theme System Improvements Implementation
overview: Implement comprehensive theme system improvements following the recommendations in THEME_SYSTEM_IMPROVEMENTS.md, focusing on Phase 1 (Quick Wins) with clear paths for Phase 2 and 3. The plan includes creating an in-app theme selector UI, accessibility improvements, legacy style cleanup, and enhanced user experience features.
todos:
  - id: settings-dialog
    content: Create SettingsDialog component with Appearance and Advanced tabs, theme selector with preview cards, and font size selector with live preview
    status: completed
  - id: backend-theme-methods
    content: Add UpdateTheme() and UpdateFontSize() methods to app.go that validate, save config, and emit events
    status: completed
  - id: settings-integration
    content: Add settings button to Sidebar and wire up SettingsDialog in App.tsx
    status: completed
    dependencies:
      - settings-dialog
      - backend-theme-methods
  - id: accessibility-audit
    content: Conduct WCAG AA contrast testing for all themes, fix low contrast issues, and document contrast ratios in themes.css
    status: completed
  - id: status-icons
    content: Add icons to status indicators (success, error, warning) in StatusIndicator.tsx and other components using color-only status
    status: completed
  - id: legacy-audit-script
    content: Create find-legacy-styles.sh script to detect inline styles, arbitrary Tailwind values, and hex colors
    status: completed
  - id: legacy-cleanup-sidebar
    content: Clean up legacy styles in Sidebar.tsx - replace inline styles and hardcoded colors with theme variables
    status: completed
    dependencies:
      - legacy-audit-script
  - id: legacy-cleanup-details
    content: Clean up legacy styles in TopicDetails.tsx and SubscriptionDetails.tsx
    status: completed
    dependencies:
      - legacy-audit-script
  - id: legacy-cleanup-monitors
    content: Clean up legacy styles in MessageDetailDialog.tsx and TopicMonitor.tsx
    status: completed
    dependencies:
      - legacy-audit-script
  - id: theme-preview-cards
    content: Enhance theme preview cards with rich visual previews showing actual UI elements in theme colors
    status: completed
    dependencies:
      - settings-dialog
  - id: transition-refinement
    content: Replace global transition with targeted selectors, add CSS variables for durations, and support prefers-reduced-motion
    status: completed
  - id: monaco-integration-verify
    content: Verify Monaco editor theme sync works correctly, test theme and font size changes update editor
    status: completed
  - id: css-mappings-complete
    content: Add comprehensive CSS variable mappings for focus rings, dividers, outlines, and document all mappings
    status: completed
---

# Theme System Improvements Implementation Plan

## Overview

This plan implements the recommendations from `THEME_SYSTEM_IMPROVEMENTS.md`, organized into three phases. Phase 1 (Quick Wins) delivers the highest impact improvements with the lowest effort, focusing on UX improvements, accessibility, and code quality.

## Architecture Overview

The theme system uses CSS custom properties defined in [`frontend/src/themes.css`](frontend/src/themes.css) with 5 themes (Auto, Dark, Light, Dracula, Monokai) and 3 font sizes. Configuration is stored in `~/.pubsub-gui/config.json` via the `AppConfig` struct in [`internal/models/connection.go`](internal/models/connection.go). Theme changes are currently made by manually editing the config file through `ConfigEditorDialog`.

**Current Flow:**

```
User edits config.json → SaveConfigFileContent() → Events emitted → ThemeContext updates
```

**New Flow (after Phase 1):**

```
User clicks Settings → SettingsDialog → UpdateTheme/UpdateFontSize methods → SaveConfigFileContent() → Events emitted → ThemeContext updates
```

## Phase 1: Quick Wins (High Impact, Low Effort)

### Task 1.1: Create Settings Dialog Component

**Files to Create:**

- [`frontend/src/components/SettingsDialog.tsx`](frontend/src/components/SettingsDialog.tsx) - Main settings dialog with tabs

**Files to Modify:**

- [`app.go`](app.go) - Add `UpdateTheme()` and `UpdateFontSize()` methods
- [`frontend/src/App.tsx`](frontend/src/App.tsx) - Add settings button and dialog state
- [`frontend/src/components/Sidebar.tsx`](frontend/src/components/Sidebar.tsx) - Add settings button/icon

**Implementation Steps:**

1. **Backend Methods** (`app.go`):

   - Add `UpdateTheme(theme string) error` method that:
     - Validates theme value
     - Updates `a.config.Theme`
     - Calls `a.configManager.SaveConfig(a.config)`
     - Emits `config:theme-changed` event
   - Add `UpdateFontSize(size string) error` method (same pattern)
   - Both methods should reuse validation logic from `SaveConfigFileContent`

2. **Settings Dialog Component**:

   - Create dialog with two tabs: "Appearance" and "Advanced"
   - Appearance tab contains theme selector and font size selector
   - Use existing dialog patterns from `ConfigEditorDialog.tsx` for structure
   - Integrate with `useTheme()` hook for current values

3. **Theme Selector UI**:

   - Grid of theme preview cards (5 themes)
   - Each card shows:
     - Theme name
     - Color swatches (bg-primary, text-primary, accent-primary)
     - Active indicator (checkmark/border)
   - Click handler calls `UpdateTheme()` via Wails binding

4. **Font Size Selector**:

   - Button group: [S] [M] [L]
   - Live preview text below selector
   - Click handler calls `UpdateFontSize()` via Wails binding

5. **Integration**:

   - Add settings button to Sidebar (gear icon)
   - Wire up dialog open/close state in App.tsx
   - Test theme switching in all 5 themes

**Estimated Effort:** 8 hours

---

### Task 1.2: Accessibility Audit & Fixes

**Files to Modify:**

- [`frontend/src/themes.css`](frontend/src/themes.css) - Adjust contrast ratios
- [`frontend/src/components/StatusIndicator.tsx`](frontend/src/components/StatusIndicator.tsx) - Add icons to status colors
- All components using status colors - Add non-color indicators

**Implementation Steps:**

1. **Contrast Testing**:

   - Use WebAIM Contrast Checker or Chrome DevTools
   - Test all text/background combinations in all 5 themes
   - Document contrast ratios in `themes.css` comments

2. **Fix Low Contrast Issues**:

   - Adjust `--color-text-muted` values if below 4.5:1 ratio
   - Adjust `--color-text-disabled` if needed
   - Ensure primary text meets 7:1 (AAA) where possible

3. **Status Color Enhancements**:

   - Add icons to status indicators (CheckCircle, XCircle, ExclamationTriangle)
   - Update `StatusIndicator.tsx` to use icons + color
   - Search codebase for color-only status indicators and add icons

4. **Documentation**:

   - Add contrast ratio comments in `themes.css` for each color variable
   - Document accessibility improvements in code comments

**Estimated Effort:** 6 hours

---

### Task 1.3: Legacy Style Cleanup (Priority 1 Components)

**Files to Audit & Fix:**

- [`frontend/src/components/Sidebar.tsx`](frontend/src/components/Sidebar.tsx)
- [`frontend/src/components/TopicDetails.tsx`](frontend/src/components/TopicDetails.tsx)
- [`frontend/src/components/SubscriptionDetails.tsx`](frontend/src/components/SubscriptionDetails.tsx)
- [`frontend/src/components/MessageDetailDialog.tsx`](frontend/src/components/MessageDetailDialog.tsx)
- [`frontend/src/components/TopicMonitor.tsx`](frontend/src/components/TopicMonitor.tsx)

**Implementation Steps:**

1. **Create Audit Script** (`scripts/find-legacy-styles.sh`):
   ```bash
   # Find inline styles
   rg "style=\{\{" frontend/src/components

   # Find arbitrary Tailwind values
   rg "bg-\[#|text-\[#|border-\[#" frontend/src/components

   # Find hex colors
   rg "#[0-9a-fA-F]{6}" frontend/src/components | grep -v ".css"
   ```

2. **Component Migration Checklist** (per component):

   - [ ] Replace `style={{}}` with theme classes
   - [ ] Replace `bg-[#hex]` with theme variables
   - [ ] Replace hex colors with CSS variables
   - [ ] Replace `rgba()` with `color-mix()` or predefined vars
   - [ ] Test in all 5 themes
   - [ ] Test in all 3 font sizes

3. **Priority Order**:

   - Start with `Sidebar.tsx` (always visible)
   - Then `TopicDetails.tsx` and `SubscriptionDetails.tsx` (core functionality)
   - Then `MessageDetailDialog.tsx` and `TopicMonitor.tsx` (recently created)

4. **Testing**:

   - Visual inspection in all themes
   - Verify no hardcoded colors remain
   - Check opacity values use theme-aware colors

**Estimated Effort:** 10 hours

---

## Phase 2: Core Improvements (Medium Impact, Medium Effort)

### Task 2.1: Theme Preview Cards Enhancement

**Files to Modify:**

- [`frontend/src/components/SettingsDialog.tsx`](frontend/src/components/SettingsDialog.tsx) - Enhance theme cards

**Implementation:**

- Create `ThemePreviewCard` component with rich visual preview
- Show actual UI elements (button, text, border) in theme colors
- Add hover effects and smooth transitions
- Include theme descriptions/tooltips

**Estimated Effort:** 3-4 hours

---

### Task 2.2: Smooth Transition Refinement

**Files to Modify:**

- [`frontend/src/themes.css`](frontend/src/themes.css) - Refine transition strategy

**Implementation:**

- Replace global `* { transition }` with targeted selectors
- Add CSS variables for transition durations
- Add `@media (prefers-reduced-motion: reduce)` support
- Test performance impact

**Estimated Effort:** 2-3 hours

---

### Task 2.3: Monaco Editor Integration Fix

**Files to Modify:**

- [`frontend/src/components/JsonEditor.tsx`](frontend/src/components/JsonEditor.tsx) - Verify Monaco theme sync
- [`frontend/src/utils/monacoThemes.ts`](frontend/src/utils/monacoThemes.ts) - Ensure custom themes registered

**Implementation:**

- Verify `registerCustomThemes()` is called on mount
- Test theme switching updates Monaco editor
- Test font size changes update Monaco editor
- Add error handling if theme registration fails

**Estimated Effort:** 3-4 hours

---

### Task 2.4: Complete CSS Variable Mappings

**Files to Modify:**

- [`frontend/src/themes.css`](frontend/src/themes.css) - Add comprehensive mappings

**Implementation:**

- Add mappings for focus rings, dividers, outlines
- Document all mappings in header comment
- Test with common Tailwind classes
- Add proactive mappings for future-proofing

**Estimated Effort:** 4-6 hours

---

## Phase 3: Polish & Optimization (Low Impact, Variable Effort)

### Task 3.1: Theme-Specific Visual Enhancements

**Files to Modify:**

- [`frontend/src/themes.css`](frontend/src/themes.css) - Add theme-specific styles

**Implementation:**

- Add Dracula purple glow on focus states
- Add Monokai cyan accent lines
- Add Light theme softer shadows
- Test in all components

**Estimated Effort:** 6-8 hours

---

### Task 3.2: Quick Theme Toggle

**Files to Modify:**

- [`frontend/src/App.tsx`](frontend/src/App.tsx) - Add keyboard shortcut handler
- [`frontend/src/components/SettingsDialog.tsx`](frontend/src/components/SettingsDialog.tsx) - Add menu integration

**Implementation:**

- Add `Cmd/Ctrl + Shift + T` keyboard shortcut
- Cycle through themes on shortcut
- Add menu item: View → Theme → [Theme Name]
- Add status bar theme indicator

**Estimated Effort:** 2-3 hours

---

### Task 3.3: Onboarding Flow

**Files to Create:**

- [`frontend/src/components/WelcomeDialog.tsx`](frontend/src/components/WelcomeDialog.tsx)

**Implementation:**

- Show welcome dialog on first launch
- Display theme previews
- Allow theme/font size selection
- Store "hasSeenWelcome" in config or localStorage

**Estimated Effort:** 4-5 hours

---

## Implementation Order

### Week 1: Phase 1 Core

1. Task 1.1: Settings Dialog (8 hours)
2. Task 1.2: Accessibility Audit (6 hours)
3. Task 1.3: Legacy Cleanup - Priority 1 (10 hours)

**Total:** ~24 hours (3 days)

### Week 2-3: Phase 1 Completion + Phase 2 Start

4. Task 2.1: Theme Preview Cards (4 hours)
5. Task 2.2: Transition Refinement (3 hours)
6. Task 2.3: Monaco Integration (4 hours)
7. Task 2.4: CSS Mappings (6 hours)

**Total:** ~17 hours (2 days)

### Week 4+: Phase 3 (Optional)

8. Task 3.1: Theme Enhancements (8 hours)
9. Task 3.2: Quick Toggle (3 hours)
10. Task 3.3: Onboarding (5 hours)

**Total:** ~16 hours (2 days)

---

## Testing Strategy

### Visual Testing

- Test all components in all 5 themes
- Test all 3 font sizes
- Test theme switching performance (<50ms target)
- Visual regression testing (screenshots)

### Accessibility Testing

- WCAG AA compliance (0 violations target)
- Contrast ratio verification
- Screen reader compatibility
- Keyboard navigation

### Integration Testing

- Settings dialog saves correctly
- Theme changes apply instantly
- Font size changes apply instantly
- Config file remains valid JSON
- Events fire correctly

---

## Success Metrics

- **Theme Adoption:** >40% users using non-default themes
- **Time to First Theme Change:** <2 minutes
- **Config Errors:** 0% after UI implementation
- **Theme Switch Performance:** <50ms
- **WCAG Compliance:** 100% (0 violations)
- **Legacy Patterns:** 0 instances in Priority 1 components

---

## Risk Mitigation

- **Breaking Changes:** Test thoroughly in all themes before merging
- **Performance:** Benchmark theme switching, optimize if >50ms
- **Browser Compatibility:** Test `color-mix()` fallbacks for older browsers
- **User Confusion:** Add tooltips and descriptions in Settings dialog

---

## Dependencies

- Wails bindings must be regenerated after adding `UpdateTheme()` and `UpdateFontSize()` methods
- Monaco editor custom themes must be registered before use
- Config file must be writable (permissions checked in `config.Manager`)

---

## Notes

- Phase 1 is critical and should be completed first
- Phase 2 and 3 can be done incrementally based on priorities
- All theme changes must maintain backward compatibility with existing config files
- Consider adding analytics to track theme usage (future enhancement)