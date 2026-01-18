#!/bin/bash

# Generate app icons from SVG for all platforms
# Requires: ImageMagick (convert) and iconutil (macOS only)

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
BUILD_DIR="$PROJECT_ROOT/build"
SVG_ICON="$BUILD_DIR/appicon.svg"

echo "🎨 Generating app icons from SVG..."

# Check if ImageMagick is installed
if ! command -v magick &> /dev/null && ! command -v convert &> /dev/null; then
    echo "❌ ImageMagick (magick) is required but not installed."
    echo "   Install with: brew install imagemagick (macOS) or apt-get install imagemagick (Linux)"
    exit 1
fi

# Use magick if available (IMv7), fallback to convert (IMv6)
if command -v magick &> /dev/null; then
    IMAGEMAGICK_CMD="magick"
else
    IMAGEMAGICK_CMD="convert"
fi

# Generate PNG icon (512x512) for macOS and Linux AppImage
# Resize to fit within 512x512 (preserving aspect ratio), then extend to exactly 512x512 square
echo "📱 Generating PNG icon (512x512)..."
$IMAGEMAGICK_CMD "$SVG_ICON" -background none -resize 512x512 -gravity center -extent 512x512 "$BUILD_DIR/appicon.png"

# Generate Windows ICO file (multiple sizes)
echo "🪟 Generating Windows ICO file..."
$IMAGEMAGICK_CMD "$SVG_ICON" -background none -resize 256x256 "$BUILD_DIR/icon-256.png"
$IMAGEMAGICK_CMD "$SVG_ICON" -background none -resize 128x128 "$BUILD_DIR/icon-128.png"
$IMAGEMAGICK_CMD "$SVG_ICON" -background none -resize 64x64 "$BUILD_DIR/icon-64.png"
$IMAGEMAGICK_CMD "$SVG_ICON" -background none -resize 48x48 "$BUILD_DIR/icon-48.png"
$IMAGEMAGICK_CMD "$SVG_ICON" -background none -resize 32x32 "$BUILD_DIR/icon-32.png"
$IMAGEMAGICK_CMD "$SVG_ICON" -background none -resize 16x16 "$BUILD_DIR/icon-16.png"

# Combine into ICO file
$IMAGEMAGICK_CMD "$BUILD_DIR/icon-256.png" "$BUILD_DIR/icon-128.png" "$BUILD_DIR/icon-64.png" \
        "$BUILD_DIR/icon-48.png" "$BUILD_DIR/icon-32.png" "$BUILD_DIR/icon-16.png" \
        "$BUILD_DIR/windows/icon.ico"

# Clean up temporary PNG files
rm -f "$BUILD_DIR/icon-256.png" "$BUILD_DIR/icon-128.png" "$BUILD_DIR/icon-64.png" \
      "$BUILD_DIR/icon-48.png" "$BUILD_DIR/icon-32.png" "$BUILD_DIR/icon-16.png"

# Generate macOS ICNS file (requires iconutil)
if [[ "$OSTYPE" == "darwin"* ]]; then
    echo "🍎 Generating macOS ICNS file..."

    ICONSET_DIR="$BUILD_DIR/appicon.iconset"
    # Clean up any existing iconset directory
    rm -rf "$ICONSET_DIR"
    mkdir -p "$ICONSET_DIR"

    # Ensure output directory exists
    mkdir -p "$BUILD_DIR/bin/pubsub-gui.app/Contents/Resources"

    # Generate all required sizes for ICNS (ensure they're exactly square)
    # Standard sizes
    $IMAGEMAGICK_CMD "$SVG_ICON" -background none -resize 512x512 -gravity center -extent 512x512 "$ICONSET_DIR/icon_512x512.png"
    $IMAGEMAGICK_CMD "$SVG_ICON" -background none -resize 256x256 -gravity center -extent 256x256 "$ICONSET_DIR/icon_256x256.png"
    $IMAGEMAGICK_CMD "$SVG_ICON" -background none -resize 128x128 -gravity center -extent 128x128 "$ICONSET_DIR/icon_128x128.png"
    $IMAGEMAGICK_CMD "$SVG_ICON" -background none -resize 64x64 -gravity center -extent 64x64 "$ICONSET_DIR/icon_64x64.png"
    $IMAGEMAGICK_CMD "$SVG_ICON" -background none -resize 32x32 -gravity center -extent 32x32 "$ICONSET_DIR/icon_32x32.png"
    $IMAGEMAGICK_CMD "$SVG_ICON" -background none -resize 16x16 -gravity center -extent 16x16 "$ICONSET_DIR/icon_16x16.png"

    # Generate @2x versions
    $IMAGEMAGICK_CMD "$SVG_ICON" -background none -resize 1024x1024 -gravity center -extent 1024x1024 "$ICONSET_DIR/icon_512x512@2x.png"
    $IMAGEMAGICK_CMD "$SVG_ICON" -background none -resize 512x512 -gravity center -extent 512x512 "$ICONSET_DIR/icon_256x256@2x.png"
    $IMAGEMAGICK_CMD "$SVG_ICON" -background none -resize 256x256 -gravity center -extent 256x256 "$ICONSET_DIR/icon_128x128@2x.png"
    $IMAGEMAGICK_CMD "$SVG_ICON" -background none -resize 128x128 -gravity center -extent 128x128 "$ICONSET_DIR/icon_64x64@2x.png"
    $IMAGEMAGICK_CMD "$SVG_ICON" -background none -resize 64x64 -gravity center -extent 64x64 "$ICONSET_DIR/icon_32x32@2x.png"
    $IMAGEMAGICK_CMD "$SVG_ICON" -background none -resize 32x32 -gravity center -extent 32x32 "$ICONSET_DIR/icon_16x16@2x.png"

    # Create ICNS file
    if iconutil -c icns "$ICONSET_DIR" -o "$BUILD_DIR/bin/pubsub-gui.app/Contents/Resources/iconfile.icns" 2>&1; then
        echo "✅ macOS ICNS file generated!"
    else
        echo "❌ Failed to generate ICNS file"
        echo "   Checking iconset directory contents..."
        ls -la "$ICONSET_DIR" || true
        echo "   Attempting to diagnose issue..."
        # Clean up on failure
        rm -rf "$ICONSET_DIR"
        exit 1
    fi

    # Clean up iconset directory
    rm -rf "$ICONSET_DIR"
else
    echo "⚠️  Skipping ICNS generation (macOS only)"
fi

echo "✅ Icon generation complete!"
echo ""
echo "Generated files:"
echo "  - $BUILD_DIR/appicon.png (macOS PNG)"
echo "  - $BUILD_DIR/windows/icon.ico (Windows ICO)"
if [[ "$OSTYPE" == "darwin"* ]]; then
    echo "  - $BUILD_DIR/bin/pubsub-gui.app/Contents/Resources/iconfile.icns (macOS ICNS)"
fi
