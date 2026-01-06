// Package fixtures provides embedded test fixtures
package fixtures

import (
	"embed"
)

// Config is the embedded config file
//
//go:embed config.json
var Config embed.FS
