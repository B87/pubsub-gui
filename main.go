// Package main is the main package for the pubsub-gui application
package main

import (
	"context"
	"embed"

	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"

	versionpkg "pubsub-gui/internal/version"
)

//go:embed all:frontend/dist
var assets embed.FS

// version is set via ldflags during build
// Default to "dev" for development builds
var version = "dev"

func main() {
	// Create an instance of the app structure
	app := NewApp()
	// Set version in app
	app.SetVersion(version)
	// Set version in version package for upgrade checking
	versionpkg.SetVersion(version)

	// Create application with options
	err := wails.Run(&options.App{
		Title:      "pubsub-gui",
		Width:      1728,
		Height:     972,
		Fullscreen: false,
		AssetServer: &assetserver.Options{
			Assets: assets,
		},
		BackgroundColour: &options.RGBA{R: 27, G: 38, B: 54, A: 1},
		OnStartup:        app.startup,
		OnShutdown:       func(_ context.Context) { app.Disconnect() },
		Bind: []interface{}{
			app,
		},
	})

	if err != nil {
		println("Error:", err.Error())
	}
}
