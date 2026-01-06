#!/bin/bash
# Release script for pubsub-gui
# Creates a git tag and pushes it to trigger GitHub Actions release workflow

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Functions
error() {
    echo -e "${RED}❌ Error:${NC} $1" >&2
    exit 1
}

info() {
    echo -e "${BLUE}ℹ️  ${NC}$1"
}

success() {
    echo -e "${GREEN}✅${NC} $1"
}

warning() {
    echo -e "${YELLOW}⚠️  ${NC}$1"
}

# Validate version format (semantic versioning: vMAJOR.MINOR.PATCH)
validate_version() {
    local version=$1
    if [[ ! $version =~ ^v[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
        error "Invalid version format: $version\nExpected format: vMAJOR.MINOR.PATCH (e.g., v1.0.0, v1.2.3)"
    fi
}

# Check if version tag already exists
check_tag_exists() {
    local version=$1
    if git rev-parse "$version" >/dev/null 2>&1; then
        error "Tag $version already exists"
    fi
}

# Check git status
check_git_status() {
    info "Checking git status..."

    # Check if we're in a git repository
    if ! git rev-parse --git-dir >/dev/null 2>&1; then
        error "Not in a git repository"
    fi

    # Check if working directory is clean
    if ! git diff-index --quiet HEAD --; then
        error "Working directory is not clean. Please commit or stash your changes."
    fi

    # Check if we're on main/master branch
    local branch=$(git rev-parse --abbrev-ref HEAD)
    if [[ "$branch" != "main" && "$branch" != "master" ]]; then
        warning "You're not on main/master branch (current: $branch)"
        read -p "Continue anyway? (y/N) " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    fi

    # Check if we're up to date with remote
    git fetch --tags
    local local_commit=$(git rev-parse HEAD)
    local remote_commit=$(git rev-parse "@{u}" 2>/dev/null || echo "")

    if [[ -n "$remote_commit" && "$local_commit" != "$remote_commit" ]]; then
        warning "Local branch is not up to date with remote"
        read -p "Continue anyway? (y/N) " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    fi

    success "Git status check passed"
}

# Run pre-release checks
run_checks() {
    info "Running pre-release checks..."

    cd "$PROJECT_ROOT"

    # Check if task command is available
    if ! command -v task >/dev/null 2>&1; then
        warning "Task runner not found. Skipping automated checks."
        return
    fi

    # Run format check
    info "Checking code format..."
    if ! task format:check >/dev/null 2>&1; then
        error "Code is not formatted. Run 'task format' to fix."
    fi

    # Run unit tests
    info "Running unit tests..."
    if ! task test:unit >/dev/null 2>&1; then
        error "Unit tests failed. Fix tests before releasing."
    fi

    success "Pre-release checks passed"
}

# Create and push tag
create_release_tag() {
    local version=$1
    local message=${2:-"Release $version"}

    info "Creating tag: $version"

    # Create annotated tag
    if git tag -a "$version" -m "$message"; then
        success "Tag $version created locally"
    else
        error "Failed to create tag $version"
    fi

    # Push tag to remote
    info "Pushing tag to remote..."
    if git push origin "$version"; then
        success "Tag $version pushed to remote"
        info "GitHub Actions release workflow will be triggered automatically"
    else
        error "Failed to push tag $version"
    fi
}

# Show release information
show_release_info() {
    local version=$1
    echo
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${GREEN}  Release $version created successfully!${NC}"
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo
    echo "Next steps:"
    echo "  1. Monitor the GitHub Actions workflow:"
    echo "     https://github.com/$(git config --get remote.origin.url | sed -E 's/.*[:/]([^/]+\/[^/]+)\.git$/\1/')/actions"
    echo "  2. Once the workflow completes, your release will be available at:"
    echo "     https://github.com/$(git config --get remote.origin.url | sed -E 's/.*[:/]([^/]+\/[^/]+)\.git$/\1/')/releases/tag/$version"
    echo
}

# Main function
main() {
    local version=""
    local message=""
    local skip_checks=false
    local dry_run=false

    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            -v|--version)
                version="$2"
                shift 2
                ;;
            -m|--message)
                message="$2"
                shift 2
                ;;
            --skip-checks)
                skip_checks=true
                shift
                ;;
            --dry-run)
                dry_run=true
                shift
                ;;
            -h|--help)
                echo "Usage: $0 [OPTIONS]"
                echo
                echo "Options:"
                echo "  -v, --version VERSION    Version tag (required, e.g., v1.0.0)"
                echo "  -m, --message MESSAGE   Tag message (optional)"
                echo "  --skip-checks          Skip pre-release checks"
                echo "  --dry-run              Show what would be done without executing"
                echo "  -h, --help             Show this help message"
                echo
                echo "Examples:"
                echo "  $0 -v v1.0.0"
                echo "  $0 -v v1.2.3 -m 'Release version 1.2.3 with new features'"
                echo "  $0 -v v2.0.0 --skip-checks"
                exit 0
                ;;
            *)
                error "Unknown option: $1\nUse --help for usage information"
                ;;
        esac
    done

    # Check if version is provided
    if [[ -z "$version" ]]; then
        error "Version is required. Use -v or --version option.\nExample: $0 -v v1.0.0"
    fi

    # Validate version format
    validate_version "$version"

    # Set default message if not provided
    if [[ -z "$message" ]]; then
        message="Release $version"
    fi

    # Change to project root
    cd "$PROJECT_ROOT"

    echo
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}  Pub/Sub GUI Release Script${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo
    info "Version: $version"
    info "Message: $message"
    echo

    if [[ "$dry_run" == true ]]; then
        warning "DRY RUN MODE - No changes will be made"
        echo
        echo "Would execute:"
        echo "  1. Check git status"
        echo "  2. Run pre-release checks"
        echo "  3. Create tag: $version"
        echo "  4. Push tag to remote"
        exit 0
    fi

    # Check if tag already exists
    check_tag_exists "$version"

    # Check git status
    check_git_status

    # Run pre-release checks (unless skipped)
    if [[ "$skip_checks" == false ]]; then
        run_checks
    else
        warning "Skipping pre-release checks"
    fi

    # Confirm before creating tag
    echo
    warning "This will create and push tag $version"
    read -p "Continue? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        info "Release cancelled"
        exit 0
    fi

    # Create and push tag
    create_release_tag "$version" "$message"

    # Show release information
    show_release_info "$version"
}

# Run main function
main "$@"
