#!/usr/bin/env bash
#
# Pub/Sub GUI Installer
# Usage: curl -fsSL https://raw.githubusercontent.com/b87/pubsub-gui/main/scripts/install.sh | bash
# Or with version: curl -fsSL https://raw.githubusercontent.com/b87/pubsub-gui/main/scripts/install.sh | bash -s -- v1.0.0
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

    case "$(uname -s)" in
        Linux*)
            os="linux"
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
            ;;
        armv7l|armv7)
            arch="armv7"
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

# Download and install
install_binary() {
    local version="$1"
    local os="$2"
    local arch="$3"
    local ext="$4"

    # Construct download URL (normalize GitHub URL first)
    local normalized_url=$(normalize_github_url "$REPO_URL")
    # Strip 'v' prefix from version for archive name (e.g., v0.0.4 -> 0.0.4)
    local version_no_v="${version#v}"
    local archive_name="${BINARY_NAME}_${os}_${arch}_${version_no_v}.${ext}"
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

    # Extract archive
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
        extracted_binary=$(find . -name "$BINARY_NAME" -type f -perm +111 | head -1)
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
