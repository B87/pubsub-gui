# Pub/Sub GUI

> A cross-platform desktop application for Google Cloud Pub/Sub management

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Go Version](https://img.shields.io/badge/Go-1.21+-00ADD8.svg)](https://golang.org)
[![React](https://img.shields.io/badge/React-18.2+-61DAFB.svg)](https://reactjs.org)

**Pub/Sub GUI** is a modern desktop application that provides a streamlined interface for managing and monitoring Google Cloud Pub/Sub resources. Built with [Wails v2](https://wails.io), it combines the power of Go with a React frontend to deliver a fast, native desktop experience.

## ✨ Features

- 🔍 **Browse Resources** - Quickly explore topics and subscriptions across multiple GCP projects
- 📡 **Real-Time Monitoring** - Stream messages from topics and subscriptions with low latency
- 📤 **Message Publishing** - Publish messages with custom payloads and attributes
- 📝 **Message Templates** - Save and reuse message templates for faster workflows
- 🎨 **Customizable Themes** - 5 beautiful themes (Auto, Dark, Light, Dracula, Monokai) with adjustable font sizes
- 🏗️ **Resource Management** - Create, update, and delete topics and subscriptions
- 🔐 **Multi-Project Support** - Manage multiple GCP projects with saved connection profiles
- 🔑 **Multiple Auth Methods** - Support for ADC, Service Account JSON, and OAuth2 personal accounts
- 🧪 **Emulator Support** - Seamlessly switch between production GCP and [local Pub/Sub Emulator](https://cloud.google.com/pubsub/docs/emulator)
- 📸 **Snapshots & Seek** - Create snapshots, seek to snapshots, and seek to timestamps for message replay
- 📋 **Structured Logging** - Built-in logs viewer with filtering, search, and date range selection
- ⚡ **Fast & Responsive** - Optimized for performance with local caching and virtual scrolling

## 📸 Screenshots

> _Screenshots coming soon!_

## 🚀 Installation

### Quick Install (Recommended)

Install the latest release with a single command:

```bash
curl -fsSL https://raw.githubusercontent.com/b87/pubsub-gui/main/scripts/install.sh | bash
```

To install a specific version:

```bash
curl -fsSL https://raw.githubusercontent.com/b87/pubsub-gui/main/scripts/install.sh | bash -s -- v1.0.0
```

### Manual Installation

1. Download the appropriate binary for your platform from the [Releases](https://github.com/b87/pubsub-gui/releases) page:
   - **macOS**: `pubsub-gui_darwin_amd64_*.tar.gz` or `pubsub-gui_darwin_arm64_*.tar.gz`
   - **Windows**: `pubsub-gui_windows_amd64_*.zip`
   - **Linux**: `pubsub-gui_linux_amd64_*.tar.gz` or `pubsub-gui_linux_arm64_*.tar.gz`

2. Extract the archive and run the `pubsub-gui` binary

3. (Optional) Add the binary to your PATH for global access

## 🎯 Quick Start

1. **Launch the application**

2. **Connect to a GCP project**:
   - Click "Connect" in the sidebar
   - Choose authentication method:
     - **Application Default Credentials (ADC)**: Uses your local `gcloud` credentials
     - **Service Account**: Upload a JSON key file
     - **OAuth2**: Authenticate with your Google account via browser
   - Enter your GCP project ID

3. **Browse resources**:
   - Topics and subscriptions will automatically load
   - Click on any resource to view details

4. **Monitor messages**:
   - Select a topic or subscription
   - Click the "Monitor" tab
   - Messages will stream in real-time

5. **Publish messages**:
   - Select a topic
   - Click the "Publish" tab
   - Enter your message payload (JSON) and attributes
   - Click "Publish"

## 🛠️ Development

### Prerequisites

- **Go** 1.21 or higher
- **Node.js** 18 or higher
- **Wails CLI** v2.11.0+ (`go install github.com/wailsapp/wails/v2/cmd/wails@latest`)
- **GCP Account** (optional - can use [Pub/Sub Emulator](https://cloud.google.com/pubsub/docs/emulator))

### Setup

1. **Clone the repository**:
   ```bash
   git clone https://github.com/b87/pubsub-gui.git
   cd pubsub-gui
   ```

2. **Install frontend dependencies**:
   ```bash
   cd frontend
   npm install
   cd ..
   ```

3. **Run in development mode**:
   ```bash
   wails dev
   ```

   This will:
   - Start the Vite dev server with hot reload
   - Run the Go backend
   - Open the application window
   - Enable browser debugging at `http://localhost:34115`

### Building

Build for your current platform:

```bash
wails build
```

Build for specific platforms:

```bash
# macOS (Universal Binary - Intel + Apple Silicon)
wails build -platform darwin/universal

# Windows 64-bit
wails build -platform windows/amd64

# Linux 64-bit
wails build -platform linux/amd64
```

Build artifacts are located in `build/bin/`.

### Project Structure

```
pubsub-gui/
├── app.go                 # Main application struct and Wails bindings
├── main.go                # Wails initialization and entry point
├── internal/
│   ├── auth/              # GCP authentication (ADC, service account, OAuth)
│   ├── config/            # Configuration persistence
│   ├── models/            # Shared data structures and errors
│   ├── logger/            # Structured logging system
│   ├── version/           # Version checking and upgrade notifications
│   └── pubsub/
│       ├── admin/         # Topic/subscription/snapshot management
│       ├── publisher/      # Message publishing
│       └── subscriber/     # Message streaming and monitoring
├── frontend/
│   ├── src/
│   │   ├── components/   # React components
│   │   ├── contexts/      # React contexts (Theme, etc.)
│   │   ├── hooks/         # Custom React hooks
│   │   └── types/         # TypeScript definitions
│   └── wailsjs/           # Auto-generated Wails bindings (DO NOT EDIT)
└── scripts/
    └── install.sh         # Installation script
```

## 📚 Documentation

- **[CLAUDE.md](CLAUDE.md)** - Comprehensive development guide and architecture documentation
- **[PRD.md](PRD.md)** - Product Requirements Document with detailed specifications
- **[ROADMAP.md](ROADMAP.md)** - Feature roadmap and planned improvements

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines

- Follow the patterns established in `CLAUDE.md`
- Ensure all components support the theme system (see `.cursor/rules/react-tailwind.mdc`)
- Test with all supported platforms when possible
- Update documentation as needed

## 📋 Requirements

### GCP Permissions

For production GCP usage, your service account needs the following IAM roles:

- **`roles/pubsub.viewer`** - List topics and subscriptions
- **`roles/pubsub.publisher`** - Publish messages to topics
- **`roles/pubsub.subscriber`** - Pull messages from subscriptions

**Recommended for development**: `roles/pubsub.editor` (combines all above)

### Local Development

For local development with the Pub/Sub Emulator:

1. Install the [Google Cloud SDK](https://cloud.google.com/sdk/docs/install)
2. Start the emulator:

   ```bash
   gcloud beta emulators pubsub start
   ```

3. Set the environment variable:

   ```bash
   export PUBSUB_EMULATOR_HOST=localhost:8085
   ```

4. Launch the application - it will automatically detect and use the emulator

## 🐛 Troubleshooting

### Connection Issues

- **"Not connected" error**: Ensure you've configured a connection profile in Settings
- **Authentication failed**: Verify your service account JSON key is valid and has the required permissions
- **Project not found**: Check that the GCP project ID is correct and you have access to it

### Performance Issues

- **Slow message rendering**: The app uses virtual scrolling for large message lists. If you experience issues, try reducing the message buffer size in Settings
- **High memory usage**: The app limits message buffers to 500 messages by default. Adjust in Settings if needed

### Build Issues

- **Wails CLI not found**: Install with `go install github.com/wailsapp/wails/v2/cmd/wails@latest`
- **Frontend build fails**: Ensure Node.js 18+ is installed and run `npm install` in the `frontend/` directory
- **Platform-specific dependencies**: See [Wails documentation](https://wails.io/docs/gettingstarted/installation) for system dependencies

For more troubleshooting tips, see [CLAUDE.md](CLAUDE.md#troubleshooting).

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Built with [Wails v2](https://wails.io) - Go + Web frontend framework
- UI components from [Radix UI](https://www.radix-ui.com/)
- Icons from [Radix Icons](https://icons.radix-ui.com/)
- Code editor powered by [Monaco Editor](https://microsoft.github.io/monaco-editor/)

## 📮 Support

- 🐛 **Bug Reports**: [GitHub Issues](https://github.com/b87/pubsub-gui/issues)
- 💡 **Feature Requests**: [GitHub Discussions](https://github.com/b87/pubsub-gui/discussions)

## 🗺️ Roadmap


#### Integration Tests with Emulator

- Integration tests with the emulator

#### Packaging & Distribution

- One-click installers for macOS, Windows, and Linux
- Automated builds with GoReleaser
- Auto-update mechanism
- Public beta release

### Future Enhancements

#### Multi-Project Workspaces

- Tabbed interface for multiple GCP projects
- Side-by-side topic/subscription comparison
- Cross-project resource search
- Workspace save/restore

#### Advanced Replay Tools

- ✅ Subscription snapshots (create, list, seek to snapshot) - **Implemented**
- ✅ Seek to timestamp functionality - **Implemented**
- Dead-letter queue viewer with message re-drive
- Message history export (JSON, CSV formats)

#### Performance Testing Tools

- Bulk publish mode (configurable messages/second)
- Message payload generator with templates
- Latency monitoring and throughput visualization

#### Schema Registry Integration

- Validate message payloads against schemas (Avro, Protocol Buffers, JSON)
- Auto-complete for schema fields
- Schema version management

#### Long-Term Vision

- Multi-broker support (Kafka, RabbitMQ, AWS SNS/SQS)
- Cloud Monitoring integration
- Plugin system for custom validators and transformers
- Team collaboration features

---

Made with ❤️ for the Google Cloud Pub/Sub community
