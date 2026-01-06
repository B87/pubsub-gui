#!/bin/bash
# find-legacy-styles.sh
# Script to find legacy style patterns that should be migrated to theme system

echo "=== Finding legacy style patterns ==="

# Find inline style objects
echo ""
echo "1. Inline styles (style={{...}}):"
rg "style=\{\{" frontend/src/components --files-with-matches || echo "  None found"

# Find arbitrary Tailwind values
echo ""
echo "2. Arbitrary Tailwind values (bg-[#...] or text-[#...]):"
rg "className=.*bg-\[#|className=.*text-\[#|className=.*border-\[#" frontend/src/components --files-with-matches || echo "  None found"

# Find hex colors in strings (excluding CSS files)
echo ""
echo "3. Hex colors in code (excluding .css files):"
rg "#[0-9a-fA-F]{6}|#[0-9a-fA-F]{3}" frontend/src/components --type tsx --type ts | grep -v ".css" || echo "  None found"

# Find unmapped Tailwind classes
echo ""
echo "4. Potentially unmapped classes (bg-slate-950, text-slate-450, etc.):"
rg "bg-slate-(950|450)|text-slate-(450|950)" frontend/src/components --files-with-matches || echo "  None found"

# Find rgba() usage that might need color-mix()
echo ""
echo "5. rgba() usage (may need color-mix() or theme variables):"
rg "rgba\(" frontend/src/components --type tsx --type ts | grep -v ".css" || echo "  None found"

echo ""
echo "=== Audit complete ==="
