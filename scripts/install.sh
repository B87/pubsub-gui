#!/usr/bin/env bash
#
# Pub/Sub GUI Installer
# Usage: curl -fsSL https://raw.githubusercontent.com/b87/pubsub-gui/main/scripts/install.sh | bash
# Or with version: curl -fsSL https://raw.githubusercontent.com/b87/pubsub-gui/main/scripts/install.sh | bash -s -- v1.0.0
#
# Features:
# - Automatic platform detection (Linux, macOS, Windows)
# - SHA256 checksum verification for downloaded archives
# - Support for latest release or specific version
# - Linux: AppImage by default (self-contained, no dependencies needed)
#
# Environment Variables:
# - PUBSUB_GUI_REPO_URL: Override the GitHub repository URL
# - PUBSUB_GUI_INSTALL_DIR: Override the installation directory
# - PUBSUB_GUI_USE_TARBALL: Set to "1" to use tar.gz instead of AppImage on Linux
#
# Examples:
#   # Install latest version (AppImage on Linux)
#   curl -fsSL https://raw.githubusercontent.com/b87/pubsub-gui/main/scripts/install.sh | bash
#
#   # Install specific version
#   curl -fsSL https://raw.githubusercontent.com/b87/pubsub-gui/main/scripts/install.sh | bash -s -- v1.2.0
#
#   # Force tar.gz instead of AppImage on Linux
#   curl -fsSL https://raw.githubusercontent.com/b87/pubsub-gui/main/scripts/install.sh | PUBSUB_GUI_USE_TARBALL=1 bash
#

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
REPO_URL="${PUBSUB_GUI_REPO_URL:-https://github.com/B87/pubsub-gui}"
BINARY_NAME="pubsub-gui"
INSTALL_DIR="${PUBSUB_GUI_INSTALL_DIR:-}"
VERSION="${1:-latest}"

# Detect OS and architecture
detect_platform() {
    local os=""
    local arch=""
    local ext="tar.gz"
    local use_appimage="false"

    case "$(uname -s)" in
        Linux*)
            os="linux"
            # Default to AppImage for Linux (self-contained, no dependencies needed)
            # Can be overridden with PUBSUB_GUI_USE_TARBALL=1
            if [ "${PUBSUB_GUI_USE_TARBALL:-}" != "1" ]; then
                use_appimage="true"
                ext="AppImage"
            fi
            ;;
        Darwin*)
            os="darwin"
            ;;
        MINGW*|MSYS*|CYGWIN*|Windows*)
            os="windows"
            ext="zip"
            ;;
        *)
            echo -e "${RED}Error: Unsupported operating system: $(uname -s)${NC}" >&2
            exit 1
            ;;
    esac

    case "$(uname -m)" in
        x86_64|amd64)
            arch="amd64"
            ;;
        arm64|aarch64)
            arch="arm64"
            # AppImage currently only available for amd64
            if [ "$os" = "linux" ]; then
                use_appimage="false"
                ext="tar.gz"
            fi
            ;;
        armv7l|armv7)
            arch="armv7"
            # AppImage not available for armv7
            if [ "$os" = "linux" ]; then
                use_appimage="false"
                ext="tar.gz"
            fi
            ;;
        *)
            echo -e "${RED}Error: Unsupported architecture: $(uname -m)${NC}" >&2
            exit 1
            ;;
    esac

    # Windows ARM64 not supported per .goreleaser.yaml
    if [ "$os" = "windows" ] && [ "$arch" = "arm64" ]; then
        echo -e "${RED}Error: Windows ARM64 is not supported${NC}" >&2
        exit 1
    fi

    PLATFORM_OS="$os"
    PLATFORM_ARCH="$arch"
    ARCHIVE_EXT="$ext"
    USE_APPIMAGE="$use_appimage"
}

# Normalize GitHub repository URL (remove www, ensure https://github.com format)
normalize_github_url() {
    local url="$1"
    # Remove www. and ensure https://github.com format
    echo "$url" | sed -E 's|^https?://www\.github\.com/|https://github.com/|' | sed -E 's|^http://github\.com/|https://github.com/|' | sed 's|/$||'
}

# Get latest release version from GitHub API
get_latest_version() {
    # Normalize the repo URL first
    local normalized_url=$(normalize_github_url "$REPO_URL")

    # Convert GitHub repository URL to API URL
    local api_url
    if echo "$normalized_url" | grep -qE '^https://github\.com/'; then
        # Extract owner/repo from URL (remove protocol and trailing slashes)
        local path=$(echo "$normalized_url" | sed 's|^https://github\.com/||' | sed 's|/$||')
        api_url="https://api.github.com/repos/${path}/releases/latest"
    else
        # If not a GitHub URL, assume it's already an API URL or construct from REPO_URL
        api_url="${normalized_url%/}/releases/latest"
    fi

    if command -v curl >/dev/null 2>&1; then
        curl -fsSL "$api_url" | sed -n 's/.*"tag_name": *"\([^"]*\)".*/\1/p' | head -1
    elif command -v wget >/dev/null 2>&1; then
        wget -qO- "$api_url" | sed -n 's/.*"tag_name": *"\([^"]*\)".*/\1/p' | head -1
    else
        echo -e "${RED}Error: curl or wget is required${NC}" >&2
        exit 1
    fi
}

# Determine install directory
determine_install_dir() {
    if [ -n "$INSTALL_DIR" ]; then
        echo "$INSTALL_DIR"
        return
    fi

    case "$PLATFORM_OS" in
        linux|darwin)
            # Try /usr/local/bin first (requires sudo), fallback to ~/.local/bin
            if [ -w "/usr/local/bin" ] || [ "$EUID" -eq 0 ]; then
                echo "/usr/local/bin"
            else
                echo "$HOME/.local/bin"
            fi
            ;;
        windows)
            # Windows: use user's local bin or Program Files
            if [ -n "${LOCALAPPDATA:-}" ]; then
                echo "$LOCALAPPDATA/Programs/pubsub-gui"
            else
                echo "$HOME/AppData/Local/Programs/pubsub-gui"
            fi
            ;;
    esac
}

# Calculate SHA256 checksum of a file
calculate_checksum() {
    local file="$1"

    if command -v shasum >/dev/null 2>&1; then
        # macOS
        shasum -a 256 "$file" | cut -d' ' -f1
    elif command -v sha256sum >/dev/null 2>&1; then
        # Linux
        sha256sum "$file" | cut -d' ' -f1
    else
        echo -e "${RED}Error: shasum or sha256sum is required for checksum verification${NC}" >&2
        exit 1
    fi
}

# Download and verify checksum file
verify_checksum() {
    local archive_path="$1"
    local archive_name="$2"
    local version="$3"
    local normalized_url="$4"
    local tmp_dir="$5"

    # Construct checksum file URL
    local checksum_file_name="${BINARY_NAME}_${version}_checksums.txt"
    local checksum_url="${normalized_url%/}/releases/download/${version}/${checksum_file_name}"
    local checksum_path="${tmp_dir}/${checksum_file_name}"

    echo -e "${BLUE}Downloading checksum file...${NC}"

    # Download checksum file
    local checksum_download_failed=false
    if command -v curl >/dev/null 2>&1; then
        if ! curl -fsSL -o "$checksum_path" "$checksum_url" 2>/dev/null; then
            checksum_download_failed=true
        fi
    elif command -v wget >/dev/null 2>&1; then
        if ! wget -q -O "$checksum_path" "$checksum_url" 2>/dev/null; then
            checksum_download_failed=true
        fi
    else
        echo -e "${YELLOW}Warning: curl or wget not available for checksum download${NC}"
        echo -e "${YELLOW}Checksum verification will be skipped${NC}"
        return 0  # Continue without checksum verification
    fi

    # Check if download failed or file is empty
    if [ "$checksum_download_failed" = true ] || [ ! -f "$checksum_path" ] || [ ! -s "$checksum_path" ]; then
        echo -e "${YELLOW}Warning: Failed to download checksum file from ${checksum_url}${NC}"
        echo -e "${YELLOW}Checksum verification will be skipped${NC}"
        return 0  # Continue without checksum verification
    fi

    # Find the expected checksum for our archive
    local expected_checksum=""
    # Look for line matching our archive name
    # Format can be: <checksum>  <filename> or <checksum>  ./<filename> or <checksum>  *<filename>
    # Try multiple patterns to handle different checksum file formats

    # First try: exact match with ./ prefix (common in Goreleaser)
    expected_checksum=$(grep -E "^[0-9a-f]{64}[[:space:]]+\./${archive_name}" "$checksum_path" 2>/dev/null | head -1 | awk '{print $1}')

    # Second try: exact match without prefix
    if [ -z "$expected_checksum" ]; then
        expected_checksum=$(grep -E "^[0-9a-f]{64}[[:space:]]+[*]?${archive_name}" "$checksum_path" 2>/dev/null | head -1 | awk '{print $1}')
    fi

    # Third try: match just the filename (basename) with ./ prefix
    if [ -z "$expected_checksum" ]; then
        local archive_basename=$(basename "$archive_name")
        expected_checksum=$(grep -E "^[0-9a-f]{64}[[:space:]]+\./${archive_basename}" "$checksum_path" 2>/dev/null | head -1 | awk '{print $1}')
    fi

    # Fourth try: match just the filename (basename) without prefix
    if [ -z "$expected_checksum" ]; then
        expected_checksum=$(grep -E "^[0-9a-f]{64}[[:space:]]+[*]?${archive_basename}" "$checksum_path" 2>/dev/null | head -1 | awk '{print $1}')
    fi

    if [ -z "$expected_checksum" ]; then
        echo -e "${YELLOW}Warning: Could not find checksum for ${archive_name} in checksum file${NC}"
        echo -e "${YELLOW}Checksum file contents:${NC}"
        cat "$checksum_path" | head -5
        echo -e "${YELLOW}Checksum verification will be skipped${NC}"
        return 0  # Continue without checksum verification
    fi

    # Calculate actual checksum
    echo -e "${BLUE}Verifying checksum...${NC}"
    local actual_checksum=$(calculate_checksum "$archive_path")

    # Compare checksums
    if [ "$expected_checksum" = "$actual_checksum" ]; then
        echo -e "${GREEN}✓ Checksum verified${NC}"
        return 0
    else
        echo -e "${RED}Error: Checksum verification failed!${NC}" >&2
        echo -e "${RED}Expected: ${expected_checksum}${NC}" >&2
        echo -e "${RED}Actual:   ${actual_checksum}${NC}" >&2
        echo -e "${RED}The downloaded file may be corrupted or tampered with.${NC}" >&2
        exit 1
    fi
}

# Check and install Linux runtime dependencies
check_linux_dependencies() {
    if [ "$PLATFORM_OS" != "linux" ]; then
        return 0
    fi

    echo -e "${BLUE}Checking Linux runtime dependencies...${NC}"

    # Check if required libraries are available
    local missing_deps=()

    # Function to check if a library exists
    check_library() {
        local lib_name="$1"

        # Try ldconfig first (most reliable)
        if command -v ldconfig >/dev/null 2>&1; then
            if ldconfig -p 2>/dev/null | grep -q "${lib_name}.so"; then
                return 0
            fi
        fi

        # Fallback: check common library paths
        local lib_paths=(
            "/usr/lib"
            "/usr/lib64"
            "/usr/local/lib"
            "/usr/local/lib64"
            "/lib"
            "/lib64"
        )

        for lib_path in "${lib_paths[@]}"; do
            if [ -f "${lib_path}/${lib_name}.so" ] || [ -f "${lib_path}/${lib_name}.so.0" ] || \
               find "${lib_path}" -name "${lib_name}.so*" 2>/dev/null | grep -q .; then
                return 0
            fi
        done

        return 1
    }

    # Check for webkit2gtk-4.1 (most critical)
    if ! check_library "libwebkit2gtk-4.1"; then
        missing_deps+=("webkit2gtk-4.1")
    fi

    # Check for GTK3
    if ! check_library "libgtk-3"; then
        missing_deps+=("gtk-3")
    fi

    # Check for appindicator3
    if ! check_library "libappindicator3"; then
        missing_deps+=("appindicator3")
    fi

    if [ ${#missing_deps[@]} -eq 0 ]; then
        echo -e "${GREEN}✓ All runtime dependencies are installed${NC}"
        return 0
    fi

    echo -e "${YELLOW}Missing runtime dependencies detected: ${missing_deps[*]}${NC}"
    echo -e "${YELLOW}Attempting to install missing dependencies...${NC}"

    # Detect package manager and install dependencies
    if command -v apt-get >/dev/null 2>&1; then
        # Debian/Ubuntu
        local packages=()
        for dep in "${missing_deps[@]}"; do
            case "$dep" in
                webkit2gtk-4.1)
                    packages+=("libwebkit2gtk-4.1-0")
                    ;;
                gtk-3)
                    packages+=("libgtk-3-0")
                    ;;
                appindicator3)
                    packages+=("libappindicator3-1")
                    ;;
            esac
        done

        if [ ${#packages[@]} -gt 0 ]; then
            echo -e "${BLUE}Installing: ${packages[*]}${NC}"
            if [ "$EUID" -eq 0 ]; then
                apt-get update -qq && apt-get install -y "${packages[@]}" || {
                    echo -e "${YELLOW}Warning: Failed to install dependencies automatically${NC}"
                    echo -e "${YELLOW}Please install manually: sudo apt-get install ${packages[*]}${NC}"
                    return 1
                }
            else
                echo -e "${YELLOW}Root privileges required to install dependencies${NC}"
                echo -e "${YELLOW}Please run: sudo apt-get update && sudo apt-get install ${packages[*]}${NC}"
                return 1
            fi
        fi
    elif command -v yum >/dev/null 2>&1 || command -v dnf >/dev/null 2>&1; then
        # RHEL/CentOS/Fedora
        local packages=()
        for dep in "${missing_deps[@]}"; do
            case "$dep" in
                webkit2gtk-4.1)
                    packages+=("webkit2gtk4")
                    ;;
                gtk-3)
                    packages+=("gtk3")
                    ;;
                appindicator3)
                    packages+=("libappindicator-gtk3")
                    ;;
            esac
        done

        if [ ${#packages[@]} -gt 0 ]; then
            echo -e "${BLUE}Installing: ${packages[*]}${NC}"
            local pkg_manager="yum"
            if command -v dnf >/dev/null 2>&1; then
                pkg_manager="dnf"
            fi

            if [ "$EUID" -eq 0 ]; then
                $pkg_manager install -y "${packages[@]}" || {
                    echo -e "${YELLOW}Warning: Failed to install dependencies automatically${NC}"
                    echo -e "${YELLOW}Please install manually: sudo $pkg_manager install ${packages[*]}${NC}"
                    return 1
                }
            else
                echo -e "${YELLOW}Root privileges required to install dependencies${NC}"
                echo -e "${YELLOW}Please run: sudo $pkg_manager install ${packages[*]}${NC}"
                return 1
            fi
        fi
    elif command -v pacman >/dev/null 2>&1; then
        # Arch Linux
        local packages=()
        for dep in "${missing_deps[@]}"; do
            case "$dep" in
                webkit2gtk-4.1)
                    packages+=("webkit2gtk-4.1")
                    ;;
                gtk-3)
                    packages+=("gtk3")
                    ;;
                appindicator3)
                    packages+=("libappindicator-gtk3")
                    ;;
            esac
        done

        if [ ${#packages[@]} -gt 0 ]; then
            echo -e "${BLUE}Installing: ${packages[*]}${NC}"
            if [ "$EUID" -eq 0 ]; then
                pacman -S --noconfirm "${packages[@]}" || {
                    echo -e "${YELLOW}Warning: Failed to install dependencies automatically${NC}"
                    echo -e "${YELLOW}Please install manually: sudo pacman -S ${packages[*]}${NC}"
                    return 1
                }
            else
                echo -e "${YELLOW}Root privileges required to install dependencies${NC}"
                echo -e "${YELLOW}Please run: sudo pacman -S ${packages[*]}${NC}"
                return 1
            fi
        fi
    else
        echo -e "${YELLOW}Warning: Could not detect package manager${NC}"
        echo -e "${YELLOW}Please install the following runtime dependencies manually:${NC}"
        echo -e "${YELLOW}  - libwebkit2gtk-4.1-0 (or webkit2gtk-4.1)${NC}"
        echo -e "${YELLOW}  - libgtk-3-0 (or gtk3)${NC}"
        echo -e "${YELLOW}  - libappindicator3-1 (or libappindicator-gtk3)${NC}"
        return 1
    fi

    echo -e "${GREEN}✓ Runtime dependencies installed${NC}"
    return 0
}

# Download and install
install_binary() {
    local version="$1"
    local os="$2"
    local arch="$3"
    local ext="$4"

    # Check Linux dependencies before installation (only for tar.gz, not AppImage)
    if [ "$os" = "linux" ] && [ "$USE_APPIMAGE" != "true" ]; then
        if ! check_linux_dependencies; then
            echo -e "${YELLOW}Warning: Some runtime dependencies may be missing${NC}"
            echo -e "${YELLOW}The application may not run correctly until dependencies are installed${NC}"

            # Only prompt if running interactively (stdin is a TTY)
            if [ -t 0 ]; then
                read -p "Continue with installation anyway? (y/N) " -n 1 -r
                echo
                if [[ ! $REPLY =~ ^[Yy]$ ]]; then
                    echo -e "${RED}Installation cancelled${NC}"
                    exit 1
                fi
            else
                echo -e "${YELLOW}Continuing with installation (non-interactive mode)${NC}"
                echo -e "${YELLOW}Please install dependencies manually if the application fails to run${NC}"
            fi
        fi
    elif [ "$os" = "linux" ] && [ "$USE_APPIMAGE" = "true" ]; then
        echo -e "${GREEN}✓ Using AppImage (all dependencies bundled)${NC}"
    fi

    # Construct download URL (normalize GitHub URL first)
    local normalized_url=$(normalize_github_url "$REPO_URL")
    local archive_name="${BINARY_NAME}_${os}_${arch}_${version}.${ext}"
    local download_url="${normalized_url%/}/releases/download/${version}/${archive_name}"

    # Determine install directory
    local install_path=$(determine_install_dir)
    local binary_path="${install_path}/${BINARY_NAME}"
    if [ "$os" = "windows" ]; then
        binary_path="${binary_path}.exe"
    fi

    echo -e "${BLUE}Installing Pub/Sub GUI ${version}...${NC}"
    echo -e "${BLUE}Platform: ${os}/${arch}${NC}"
    echo -e "${BLUE}Download URL: ${download_url}${NC}"

    # Create temporary directory
    local tmp_dir=$(mktemp -d)
    trap "rm -rf '$tmp_dir'" EXIT

    # Download archive
    echo -e "${BLUE}Downloading archive...${NC}"
    local archive_path="${tmp_dir}/${archive_name}"

    if command -v curl >/dev/null 2>&1; then
        curl -fsSL -o "$archive_path" "$download_url" || {
            echo -e "${RED}Error: Failed to download ${download_url}${NC}" >&2
            echo -e "${YELLOW}Tip: Check if the release exists and the version is correct${NC}" >&2
            exit 1
        }
    elif command -v wget >/dev/null 2>&1; then
        wget -q -O "$archive_path" "$download_url" || {
            echo -e "${RED}Error: Failed to download ${download_url}${NC}" >&2
            echo -e "${YELLOW}Tip: Check if the release exists and the version is correct${NC}" >&2
            exit 1
        }
    else
        echo -e "${RED}Error: curl or wget is required${NC}" >&2
        exit 1
    fi

    # Verify checksum
    verify_checksum "$archive_path" "$archive_name" "$version" "$normalized_url" "$tmp_dir"

    # Handle AppImage specially (no extraction needed)
    if [ "$ext" = "AppImage" ]; then
        echo -e "${BLUE}Installing AppImage...${NC}"

        # Determine install location for AppImage
        local appimage_dir="${INSTALL_DIR:-$HOME/.local/bin}"
        local appimage_path="${appimage_dir}/${BINARY_NAME}.AppImage"

        # Create directory if needed
        mkdir -p "$appimage_dir"

        # Check if we need sudo
        local needs_sudo=false
        if [ ! -w "$appimage_dir" ] && [ "$EUID" -ne 0 ]; then
            needs_sudo=true
        fi

        # Remove existing AppImage if present
        if [ -f "$appimage_path" ]; then
            echo -e "${YELLOW}Removing existing AppImage...${NC}"
            if [ "$needs_sudo" = true ]; then
                sudo rm -f "$appimage_path"
            else
                rm -f "$appimage_path"
            fi
        fi

        # Install AppImage
        if [ "$needs_sudo" = true ]; then
            sudo cp "$archive_path" "$appimage_path"
            sudo chmod +x "$appimage_path"
        else
            cp "$archive_path" "$appimage_path"
            chmod +x "$appimage_path"
        fi

        # Create symlink for easier command-line access
        local symlink_path="${appimage_dir}/${BINARY_NAME}"
        if [ -L "$symlink_path" ] || [ -f "$symlink_path" ]; then
            if [ "$needs_sudo" = true ]; then
                sudo rm -f "$symlink_path"
            else
                rm -f "$symlink_path"
            fi
        fi
        if [ "$needs_sudo" = true ]; then
            sudo ln -sf "$appimage_path" "$symlink_path"
        else
            ln -sf "$appimage_path" "$symlink_path"
        fi

        echo -e "${GREEN}✓ Successfully installed Pub/Sub GUI AppImage to ${appimage_path}${NC}"
        echo -e "${GREEN}✓ Symlink created at ${symlink_path}${NC}"

        # Verify installation
        if [ -f "$appimage_path" ] && [ -x "$appimage_path" ]; then
            if command -v "$BINARY_NAME" >/dev/null 2>&1; then
                echo -e "${GREEN}✓ Binary is available in PATH${NC}"
            else
                echo -e "${YELLOW}⚠ Binary is not in PATH${NC}"
                echo -e "${YELLOW}Add ${appimage_dir} to your PATH, or run directly: ${appimage_path}${NC}"

                # Suggest adding to PATH
                local shell_rc=""
                if [ -n "${ZSH_VERSION:-}" ] || [ -f "$HOME/.zshrc" ]; then
                    shell_rc="$HOME/.zshrc"
                elif [ -n "${BASH_VERSION:-}" ] || [ -f "$HOME/.bashrc" ]; then
                    shell_rc="$HOME/.bashrc"
                fi

                if [ -n "$shell_rc" ] && ! grep -q "$appimage_dir" "$shell_rc" 2>/dev/null; then
                    echo -e "${BLUE}Add this to your ${shell_rc}:${NC}"
                    echo -e "${BLUE}export PATH=\"\$PATH:$appimage_dir\"${NC}"
                fi
            fi

            # Show version if available
            if "$appimage_path" --version >/dev/null 2>&1; then
                echo -e "${GREEN}Version: $("$appimage_path" --version)${NC}"
            fi
        else
            echo -e "${RED}Error: Installation verification failed${NC}" >&2
            exit 1
        fi
        return
    fi

    # Extract archive (for non-AppImage formats)
    echo -e "${BLUE}Extracting archive...${NC}"
    cd "$tmp_dir"

    if [ "$ext" = "zip" ]; then
        if command -v unzip >/dev/null 2>&1; then
            unzip -q "$archive_path"
        else
            echo -e "${RED}Error: unzip is required to extract the archive${NC}" >&2
            exit 1
        fi
    else
        if command -v tar >/dev/null 2>&1; then
            tar -xzf "$archive_path"
        else
            echo -e "${RED}Error: tar is required to extract the archive${NC}" >&2
            exit 1
        fi
    fi

    # Handle macOS .app bundles differently
    if [ "$os" = "darwin" ]; then
        # Look for .app bundle first
        local app_bundle=$(find . -name "${BINARY_NAME}.app" -type d | head -1)

        if [ -n "$app_bundle" ]; then
            # Install .app bundle to Applications directory
            local applications_dir=""
            if [ -w "/Applications" ] || [ "$EUID" -eq 0 ]; then
                applications_dir="/Applications"
            else
                applications_dir="$HOME/Applications"
            fi

            echo -e "${BLUE}Installing .app bundle to ${applications_dir}...${NC}"
            mkdir -p "$applications_dir"

            local app_dest="${applications_dir}/${BINARY_NAME}.app"
            if [ -d "$app_dest" ]; then
                echo -e "${YELLOW}Removing existing installation...${NC}"
                rm -rf "$app_dest"
            fi

            if [ "$EUID" -eq 0 ] && [ ! -w "/Applications" ]; then
                sudo cp -R "$app_bundle" "$app_dest"
                sudo chown -R "$(whoami)" "$app_dest" 2>/dev/null || true
            else
                cp -R "$app_bundle" "$app_dest"
            fi

            # Create symlink in install_path for command-line access
            local binary_inside_app="${app_dest}/Contents/MacOS/${BINARY_NAME}"
            if [ -f "$binary_inside_app" ]; then
                mkdir -p "$install_path"
                if [ -L "$binary_path" ] || [ -f "$binary_path" ]; then
                    rm -f "$binary_path"
                fi
                ln -sf "$binary_inside_app" "$binary_path"
            fi

            echo -e "${GREEN}✓ Successfully installed Pub/Sub GUI to ${app_dest}${NC}"
            echo -e "${GREEN}✓ Command-line launcher available at ${binary_path}${NC}"

            # Verify installation
            if [ -d "$app_dest" ] && [ -f "$binary_inside_app" ]; then
                if command -v "$BINARY_NAME" >/dev/null 2>&1; then
                    echo -e "${GREEN}✓ Binary is available in PATH${NC}"
                else
                    echo -e "${YELLOW}⚠ Binary is not in PATH${NC}"
                    echo -e "${YELLOW}Add ${install_path} to your PATH, or run: open ${app_dest}${NC}"
                fi

                # Show version if available
                if "$binary_inside_app" --version >/dev/null 2>&1; then
                    echo -e "${GREEN}Version: $("$binary_inside_app" --version)${NC}"
                fi
            else
                echo -e "${RED}Error: Installation verification failed${NC}" >&2
                exit 1
            fi
            return
        fi
    fi

    # For non-macOS or if no .app bundle found, look for standalone binary
    local extracted_binary=""
    if [ "$os" = "windows" ]; then
        extracted_binary=$(find . -name "${BINARY_NAME}.exe" -type f | head -1)
    else
        # /111 means "any execute bit is set" (executable by owner, group, or others)
        extracted_binary=$(find . -name "$BINARY_NAME" -type f -perm /111 | head -1)
        if [ -z "$extracted_binary" ]; then
            extracted_binary=$(find . -name "$BINARY_NAME" -type f | head -1)
        fi
    fi

    if [ -z "$extracted_binary" ]; then
        echo -e "${RED}Error: Binary not found in archive${NC}" >&2
        exit 1
    fi

    # Create install directory if it doesn't exist
    mkdir -p "$install_path"

    # Check if we need sudo
    local needs_sudo=false
    if [ ! -w "$install_path" ] && [ "$EUID" -ne 0 ]; then
        needs_sudo=true
    fi

    # Install binary
    echo -e "${BLUE}Installing to ${install_path}...${NC}"
    if [ "$needs_sudo" = true ]; then
        sudo cp "$extracted_binary" "$binary_path"
        sudo chmod +x "$binary_path"
    else
        cp "$extracted_binary" "$binary_path"
        chmod +x "$binary_path"
    fi

    # Verify installation
    if [ -f "$binary_path" ] && [ -x "$binary_path" ]; then
        echo -e "${GREEN}✓ Successfully installed Pub/Sub GUI to ${binary_path}${NC}"

        # Check if binary is in PATH
        if command -v "$BINARY_NAME" >/dev/null 2>&1; then
            echo -e "${GREEN}✓ Binary is available in PATH${NC}"
        else
            echo -e "${YELLOW}⚠ Binary is not in PATH${NC}"
            echo -e "${YELLOW}Add ${install_path} to your PATH, or run: ${binary_path}${NC}"

            # Suggest adding to PATH
            case "$PLATFORM_OS" in
                linux|darwin)
                    if [ "$install_path" = "$HOME/.local/bin" ]; then
                        local shell_rc=""
                        if [ -n "${ZSH_VERSION:-}" ]; then
                            shell_rc="$HOME/.zshrc"
                        elif [ -n "${BASH_VERSION:-}" ]; then
                            shell_rc="$HOME/.bashrc"
                        fi

                        if [ -n "$shell_rc" ]; then
                            if ! grep -q "$install_path" "$shell_rc" 2>/dev/null; then
                                echo -e "${BLUE}Add this to your ${shell_rc}:${NC}"
                                echo -e "${BLUE}export PATH=\"\$PATH:$install_path\"${NC}"
                            fi
                        fi
                    fi
                    ;;
            esac
        fi

        # Show version if available
        if "$binary_path" --version >/dev/null 2>&1; then
            echo -e "${GREEN}Version: $("$binary_path" --version)${NC}"
        fi
    else
        echo -e "${RED}Error: Installation verification failed${NC}" >&2
        exit 1
    fi
}

# Main installation flow
main() {
    echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║   Pub/Sub GUI Installer               ║${NC}"
    echo -e "${BLUE}╚════════════════════════════════════════╝${NC}"
    echo ""

    # Detect platform
    detect_platform

    # Show platform info
    local format_info="$ARCHIVE_EXT"
    if [ "$USE_APPIMAGE" = "true" ]; then
        format_info="AppImage (self-contained)"
    fi
    echo -e "${BLUE}Platform: ${PLATFORM_OS}/${PLATFORM_ARCH} (${format_info})${NC}"

    # Get version
    local install_version="$VERSION"
    if [ "$VERSION" = "latest" ]; then
        echo -e "${BLUE}Fetching latest version...${NC}"
        install_version=$(get_latest_version)
        if [ -z "$install_version" ]; then
            echo -e "${RED}Error: Failed to fetch latest version${NC}" >&2
            echo -e "${YELLOW}Tip: Check your internet connection and repository URL${NC}" >&2
            exit 1
        fi
        echo -e "${GREEN}Latest version: ${install_version}${NC}"
    fi

    # Install
    install_binary "$install_version" "$PLATFORM_OS" "$PLATFORM_ARCH" "$ARCHIVE_EXT"

    echo ""
    echo -e "${GREEN}Installation complete!${NC}"
    echo -e "${BLUE}Run '${BINARY_NAME} --help' to get started${NC}"
}

# Run main function
main "$@"
