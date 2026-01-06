#!/bin/bash
# Script to test GoReleaser build for macOS only (local testing)
# This avoids cross-compilation issues when testing locally

set -e

echo "🧪 Testing GoReleaser build for macOS only..."

# Backup original config
cp .goreleaser.yaml .goreleaser.yaml.backup

# Create temporary macOS-only config
cat > .goreleaser.yaml.tmp << 'EOF'
version: 2
project_name: pubsub-gui

before:
  hooks:
    - go mod tidy
    - "cd frontend && npm ci && npm run build && cd .."

builds:
  - id: pubsub-gui
    env:
      - CGO_ENABLED=1
    goos:
      - darwin  # macOS only for local testing
    goarch:
      - amd64
      - arm64
    dir: .
    main: .
    binary: pubsub-gui
    flags:
      - -trimpath
    ldflags:
      - -s -w
      - -X main.version={{.Version}}
      - -X main.commit={{.Commit}}
      - -X main.date={{.Date}}

archives:
  - id: default
    name_template: "{{ .ProjectName }}_{{ .Os }}_{{ .Arch }}{{ if .Arm }}v{{ .Arm }}{{ end }}_{{ .Version }}"
    files:
      - README.md

checksum:
  name_template: "{{ .ProjectName }}_{{ .Version }}_checksums.txt"
  algorithm: sha256

snapshot:

release:
  github:
    owner: "{{ .Env.GITHUB_OWNER }}"
    name: "{{ .Env.GITHUB_REPO_NAME }}"
  mode: replace
EOF

# Use temporary config
mv .goreleaser.yaml.tmp .goreleaser.yaml

# Run GoReleaser
GITHUB_OWNER=test GITHUB_REPO_NAME=pubsub-gui goreleaser release --snapshot --clean

# Restore original config
mv .goreleaser.yaml.backup .goreleaser.yaml

echo "✅ Test build complete! Original config restored."
