#!/usr/bin/env bash
#
# Create AppImage for Pub/Sub GUI
#
# Usage:
#   ./scripts/create-appimage.sh [VERSION]
#
# Arguments:
#   VERSION  - Version string (e.g., v1.0.0). Defaults to "dev"
#
# Environment Variables:
#   BINARY_PATH      - Path to the built binary (default: build/bin/pubsub-gui)
#   ICON_PATH        - Path to the icon file (default: build/appicon.png)
#   OUTPUT_DIR       - Output directory for AppImage (default: current directory)
#   SKIP_CHECKSUM    - Set to "1" to skip checksum verification (not recommended)
#
# Prerequisites:
#   - Linux with GTK3 development libraries
#   - wget, sha256sum, imagemagick (for placeholder icon)
#   - squashfs-tools (for mksquashfs, required by appimagetool)
#   - Built binary at BINARY_PATH
#

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# =============================================================================
# Configuration - Pinned versions for reproducibility and security
# =============================================================================

# linuxdeploy: using specific release tag with SHA256 verification
LINUXDEPLOY_VERSION="1-alpha-20251107-1"
LINUXDEPLOY_URL="https://github.com/linuxdeploy/linuxdeploy/releases/download/${LINUXDEPLOY_VERSION}/linuxdeploy-x86_64.AppImage"
LINUXDEPLOY_SHA256_URL="https://github.com/linuxdeploy/linuxdeploy/releases/download/${LINUXDEPLOY_VERSION}/linuxdeploy-x86_64.AppImage.sha256"

# GTK plugin: pinned to specific commit (commit hash provides content integrity)
GTK_PLUGIN_COMMIT="3b67a1d1c1b0c8268f57f2bce40fe2d33d409cea"
GTK_PLUGIN_URL="https://raw.githubusercontent.com/linuxdeploy/linuxdeploy-plugin-gtk/${GTK_PLUGIN_COMMIT}/linuxdeploy-plugin-gtk.sh"
# Pre-computed SHA256 for the GTK plugin at this commit (13654 bytes)
GTK_PLUGIN_EXPECTED_SHA256="b0f4cbc684a0103a9651f0955b635eaea0096b3a66c0f5a2c2aa337960375171"

# =============================================================================
# Parse arguments and set defaults
# =============================================================================

VERSION="${1:-dev}"
BINARY_PATH="${BINARY_PATH:-build/bin/pubsub-gui}"
ICON_PATH="${ICON_PATH:-build/appicon.png}"
OUTPUT_DIR="${OUTPUT_DIR:-.}"
SKIP_CHECKSUM="${SKIP_CHECKSUM:-0}"

# Ensure OUTPUT_DIR exists and is absolute
OUTPUT_DIR=$(cd "$OUTPUT_DIR" && pwd)
mkdir -p "$OUTPUT_DIR"

# Working directory for downloads
WORK_DIR=$(mktemp -d)
trap "rm -rf '$WORK_DIR'" EXIT

# =============================================================================
# Helper functions
# =============================================================================

log_info() {
    echo -e "${BLUE}$1${NC}"
}

log_success() {
    echo -e "${GREEN}$1${NC}"
}

log_warn() {
    echo -e "${YELLOW}$1${NC}"
}

log_error() {
    echo -e "${RED}$1${NC}" >&2
}

# =============================================================================
# Validation
# =============================================================================

log_info "Creating AppImage for Pub/Sub GUI ${VERSION}"
echo ""

# Check we're on Linux
if [[ "$(uname -s)" != "Linux" ]]; then
    log_error "Error: AppImage creation is only supported on Linux"
    exit 1
fi

# Check binary exists
if [[ ! -f "$BINARY_PATH" ]]; then
    log_error "Error: Binary not found at $BINARY_PATH"
    log_error "Run 'wails build -platform linux/amd64' first"
    exit 1
fi

log_success "Binary found: $BINARY_PATH"

# =============================================================================
# Download and verify linuxdeploy
# =============================================================================

log_info "Downloading linuxdeploy ${LINUXDEPLOY_VERSION}..."
if ! wget -q "$LINUXDEPLOY_URL" -O "$WORK_DIR/linuxdeploy-x86_64.AppImage" 2>&1; then
    log_error "Error: Failed to download linuxdeploy"
    log_error "URL: $LINUXDEPLOY_URL"
    log_error "Please verify the version exists and the URL is correct"
    exit 1
fi

# Try to download checksum file (may not exist for all releases)
CHECKSUM_AVAILABLE=false
if wget -q "$LINUXDEPLOY_SHA256_URL" -O "$WORK_DIR/linuxdeploy-x86_64.AppImage.sha256" 2>&1; then
    CHECKSUM_AVAILABLE=true
    log_success "Downloaded linuxdeploy checksum"
else
    log_warn "Checksum file not available for this release (this is normal for some releases)"
    log_warn "Skipping checksum verification"
fi

if [[ "$SKIP_CHECKSUM" != "1" ]] && [[ "$CHECKSUM_AVAILABLE" == "true" ]]; then
    log_info "Verifying linuxdeploy checksum..."
    cd "$WORK_DIR"
    sha256sum -c linuxdeploy-x86_64.AppImage.sha256 || {
        log_error "Error: linuxdeploy checksum verification failed!"
        exit 1
    }
    cd - > /dev/null
    log_success "linuxdeploy checksum verified"
elif [[ "$SKIP_CHECKSUM" == "1" ]]; then
    log_warn "Skipping linuxdeploy checksum verification (SKIP_CHECKSUM=1)"
fi

# =============================================================================
# Download and verify GTK plugin
# =============================================================================

log_info "Downloading linuxdeploy-plugin-gtk (commit ${GTK_PLUGIN_COMMIT:0:7})..."
wget -q "$GTK_PLUGIN_URL" -O "$WORK_DIR/linuxdeploy-plugin-gtk.sh" || {
    log_error "Error: Failed to download GTK plugin"
    exit 1
}

# Verify download isn't empty (catches bad commit hashes, 404s, etc.)
if [[ ! -s "$WORK_DIR/linuxdeploy-plugin-gtk.sh" ]]; then
    log_error "Error: Downloaded GTK plugin is empty (bad URL or commit hash?)"
    exit 1
fi

if [[ "$SKIP_CHECKSUM" != "1" ]]; then
    log_info "Verifying GTK plugin checksum..."
    GTK_PLUGIN_ACTUAL_SHA256=$(sha256sum "$WORK_DIR/linuxdeploy-plugin-gtk.sh" | cut -d' ' -f1)
    if [[ "$GTK_PLUGIN_ACTUAL_SHA256" != "$GTK_PLUGIN_EXPECTED_SHA256" ]]; then
        log_error "Error: GTK plugin checksum verification failed!"
        log_error "Expected: $GTK_PLUGIN_EXPECTED_SHA256"
        log_error "Actual:   $GTK_PLUGIN_ACTUAL_SHA256"
        log_error "The GTK plugin may have been modified. Update GTK_PLUGIN_EXPECTED_SHA256 if this is expected."
        exit 1
    fi
    log_success "GTK plugin checksum verified"
else
    log_warn "Skipping GTK plugin checksum verification (SKIP_CHECKSUM=1)"
fi

chmod +x "$WORK_DIR/linuxdeploy-x86_64.AppImage" "$WORK_DIR/linuxdeploy-plugin-gtk.sh"

# =============================================================================
# Prepare desktop file
# =============================================================================

log_info "Creating desktop file..."
cat > "$WORK_DIR/pubsub-gui.desktop" << 'EOF'
[Desktop Entry]
Type=Application
Name=PubSub GUI
Comment=Google Cloud Pub/Sub Management Tool
Exec=pubsub-gui
Icon=pubsub-gui
Categories=Development;
Terminal=false
EOF

# =============================================================================
# Prepare icon
# =============================================================================

if [[ ! -f "$ICON_PATH" ]]; then
    log_warn "Icon not found at $ICON_PATH, creating placeholder..."
    if command -v convert >/dev/null 2>&1; then
        convert -size 256x256 xc:'#4A90D9' \
            -gravity center -pointsize 48 -fill white \
            -annotate 0 'PS' \
            "$ICON_PATH"
        log_success "Created placeholder icon"
    else
        log_error "Error: ImageMagick (convert) not available to create placeholder icon"
        log_error "Either install imagemagick or provide an icon at $ICON_PATH"
        exit 1
    fi
fi

if [[ ! -s "$ICON_PATH" ]]; then
    log_error "Error: Icon file exists but is empty: $ICON_PATH"
    exit 1
fi

log_success "Using icon: $ICON_PATH"

# Copy icon to working directory with the name expected by desktop file
# The desktop file specifies Icon=pubsub-gui, so linuxdeploy expects pubsub-gui.png
ICON_EXT="${ICON_PATH##*.}"
ICON_FOR_LINUXDEPLOY="$WORK_DIR/pubsub-gui.${ICON_EXT}"
cp "$ICON_PATH" "$ICON_FOR_LINUXDEPLOY"
log_info "Icon copied to: $ICON_FOR_LINUXDEPLOY (matching desktop file Icon entry)"

# =============================================================================
# Create AppImage
# =============================================================================

log_info "Creating AppImage..."

# Save original working directory
ORIGINAL_PWD=$(pwd)

# Ensure OUTPUT_DIR exists and is writable
log_info "Output directory: $OUTPUT_DIR"
mkdir -p "$OUTPUT_DIR"
if [[ ! -w "$OUTPUT_DIR" ]]; then
    log_error "Error: Output directory is not writable: $OUTPUT_DIR"
    exit 1
fi

# Convert BINARY_PATH to absolute path if it's relative
if [[ "$BINARY_PATH" != /* ]]; then
    ABS_BINARY_PATH="$ORIGINAL_PWD/$BINARY_PATH"
else
    ABS_BINARY_PATH="$BINARY_PATH"
fi

# Set TMPDIR to a writable location (appimagetool/mksquashfs uses this for temporary files)
# Prefer OUTPUT_DIR as it's guaranteed to be writable
export TMPDIR="$OUTPUT_DIR/.appimage-tmp"
mkdir -p "$TMPDIR"
if [[ ! -w "$TMPDIR" ]]; then
    # Fallback to system temp if OUTPUT_DIR/.appimage-tmp isn't writable
    export TMPDIR="${TMPDIR_SYSTEM:-/tmp}"
    mkdir -p "$TMPDIR"
    if [[ ! -w "$TMPDIR" ]]; then
        log_error "Error: Cannot create writable temporary directory"
        exit 1
    fi
    log_info "Using system temp for temporary files: $TMPDIR"
else
    log_info "Using OUTPUT_DIR for temporary files: $TMPDIR"
fi

# Change to OUTPUT_DIR - linuxdeploy creates AppImage in current working directory
log_info "Changing to output directory: $OUTPUT_DIR"
cd "$OUTPUT_DIR" || {
    log_error "Error: Cannot change to output directory: $OUTPUT_DIR"
    exit 1
}

# Copy GTK plugin to OUTPUT_DIR (linuxdeploy looks for it in current directory)
cp "$WORK_DIR/linuxdeploy-plugin-gtk.sh" ./linuxdeploy-plugin-gtk.sh
chmod +x ./linuxdeploy-plugin-gtk.sh

log_info "Working directory: $(pwd)"
log_info "Temporary directory: $TMPDIR"

# Verify mksquashfs is available
if ! command -v mksquashfs >/dev/null 2>&1; then
    log_error "Error: mksquashfs not found. Please install squashfs-tools:"
    log_error "  sudo apt-get install squashfs-tools"
    exit 1
fi
log_info "mksquashfs found: $(which mksquashfs)"

# Verify we can write to current directory
if [[ ! -w . ]]; then
    log_error "Error: Current directory is not writable: $(pwd)"
    exit 1
fi

# Test write access by creating a test file
TEST_FILE=".appimage-test-$$"
if ! touch "$TEST_FILE" 2>/dev/null; then
    log_error "Error: Cannot create files in current directory: $(pwd)"
    exit 1
fi
rm -f "$TEST_FILE"
log_info "Verified write access to current directory"

export DEPLOY_GTK_VERSION=3
"$WORK_DIR/linuxdeploy-x86_64.AppImage" \
    --appdir "$WORK_DIR/AppDir" \
    --executable "$ABS_BINARY_PATH" \
    --desktop-file "$WORK_DIR/pubsub-gui.desktop" \
    --icon-file "$ICON_FOR_LINUXDEPLOY" \
    --plugin gtk \
    --output appimage

# Clean up GTK plugin from OUTPUT_DIR
rm -f ./linuxdeploy-plugin-gtk.sh

# Clean up temporary directory if we created it in OUTPUT_DIR
if [[ "$TMPDIR" == "$OUTPUT_DIR/.appimage-tmp" ]]; then
    rm -rf "$TMPDIR"
fi

# Return to original directory
cd "$ORIGINAL_PWD" || {
    log_error "Error: Cannot return to original directory: $ORIGINAL_PWD"
    exit 1
}

# =============================================================================
# Rename and move output
# =============================================================================

# Find the generated AppImage in OUTPUT_DIR (linuxdeploy creates it in CWD where we ran it)
# The name is based on the desktop file Name field (PubSub_GUI-x86_64.AppImage)
GENERATED_APPIMAGE=$(ls -1 "${OUTPUT_DIR}"/PubSub_GUI*.AppImage 2>/dev/null || ls -1 "${OUTPUT_DIR}"/*.AppImage 2>/dev/null | head -1)

if [[ -z "$GENERATED_APPIMAGE" ]]; then
    log_error "Error: AppImage was not created in output directory"
    log_error "Output directory: $OUTPUT_DIR"
    log_error "Contents of output directory:"
    ls -la "$OUTPUT_DIR" || true
    exit 1
fi

OUTPUT_NAME="pubsub-gui_linux_amd64_${VERSION}.AppImage"
OUTPUT_PATH="${OUTPUT_DIR}/${OUTPUT_NAME}"

# Rename if the generated name is different
if [[ "$(basename "$GENERATED_APPIMAGE")" != "$OUTPUT_NAME" ]]; then
    log_info "Renaming AppImage: $(basename "$GENERATED_APPIMAGE") -> $OUTPUT_NAME"
    mv "$GENERATED_APPIMAGE" "$OUTPUT_PATH"
else
    OUTPUT_PATH="$GENERATED_APPIMAGE"
fi

chmod +x "$OUTPUT_PATH"

# =============================================================================
# Summary
# =============================================================================

echo ""
log_success "AppImage created successfully!"
log_success "Output: ${OUTPUT_DIR}/${OUTPUT_NAME}"
ls -lh "${OUTPUT_DIR}/${OUTPUT_NAME}"
