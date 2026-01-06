// Package auth handles the OAuth callback server
package auth

import (
	"context"
	"fmt"
	"html/template"
	"net"
	"net/http"
	"time"
)

// CallbackServer handles the OAuth callback
type CallbackServer struct {
	port       int
	state      string
	server     *http.Server
	resultChan chan *AuthenticateResult
}

// NewCallbackServer creates a new callback server
func NewCallbackServer(port int, state string) *CallbackServer {
	return &CallbackServer{
		port:       port,
		state:      state,
		resultChan: make(chan *AuthenticateResult, 1),
	}
}

// Start starts the callback server
func (cs *CallbackServer) Start() error {
	// Check if port is already in use (might be from a previous OAuth flow)
	listener, err := net.Listen("tcp", fmt.Sprintf(":%d", cs.port))
	if err != nil {
		return fmt.Errorf("port %d is already in use. Please close any open OAuth authentication windows and try again", cs.port)
	}

	mux := http.NewServeMux()
	mux.HandleFunc("/callback", cs.handleCallback)

	cs.server = &http.Server{
		Addr:    fmt.Sprintf(":%d", cs.port),
		Handler: mux,
	}

	go func() {
		if err := cs.server.Serve(listener); err != nil && err != http.ErrServerClosed {
			cs.resultChan <- &AuthenticateResult{
				Success:  false,
				ErrorMsg: fmt.Sprintf("Callback server error: %v", err),
			}
		}
	}()

	// Give server time to start
	time.Sleep(100 * time.Millisecond)

	return nil
}

// Stop stops the callback server
func (cs *CallbackServer) Stop() error {
	if cs.server != nil {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		return cs.server.Shutdown(ctx)
	}
	return nil
}

// WaitForCallback waits for the OAuth callback with timeout
func (cs *CallbackServer) WaitForCallback(ctx context.Context) *AuthenticateResult {
	select {
	case result := <-cs.resultChan:
		return result
	case <-ctx.Done():
		return &AuthenticateResult{
			Success:  false,
			ErrorMsg: "Authentication timeout",
		}
	case <-time.After(5 * time.Minute):
		return &AuthenticateResult{
			Success:  false,
			ErrorMsg: "Authentication timeout (5 minutes)",
		}
	}
}

// handleCallback handles the OAuth callback request
func (cs *CallbackServer) handleCallback(w http.ResponseWriter, r *http.Request) {
	// Validate state parameter (CSRF protection)
	state := r.URL.Query().Get("state")
	if state != cs.state {
		// This might be a callback from a previous OAuth flow
		// Send error response but don't send to resultChan (might be for different flow)
		cs.sendErrorResponse(w, "Invalid state parameter. This might be from a previous authentication attempt. Please try again.")
		// Only send to resultChan if this is likely our flow (non-empty state)
		if state != "" {
			cs.resultChan <- &AuthenticateResult{
				Success:  false,
				ErrorMsg: "Invalid state parameter. This might be from a previous authentication attempt. Please close any open browser windows and try again.",
			}
		}
		return
	}

	// Check for error
	if errMsg := r.URL.Query().Get("error"); errMsg != "" {
		cs.sendErrorResponse(w, fmt.Sprintf("Authentication error: %s", errMsg))
		cs.resultChan <- &AuthenticateResult{
			Success:  false,
			ErrorMsg: fmt.Sprintf("Authentication error: %s", errMsg),
		}
		return
	}

	// Get authorization code
	code := r.URL.Query().Get("code")
	if code == "" {
		cs.sendErrorResponse(w, "No authorization code received")
		cs.resultChan <- &AuthenticateResult{
			Success:  false,
			ErrorMsg: "No authorization code received",
		}
		return
	}

	// Send success response
	cs.sendSuccessResponse(w)

	// Send result
	cs.resultChan <- &AuthenticateResult{
		Success:  true,
		AuthCode: code,
	}
}

// sendSuccessResponse sends a success HTML page
func (cs *CallbackServer) sendSuccessResponse(w http.ResponseWriter) {
	w.Header().Set("Content-Type", "text/html")
	tmpl := template.Must(template.New("success").Parse(successPageHTML))
	tmpl.Execute(w, nil)
}

// sendErrorResponse sends an error HTML page
func (cs *CallbackServer) sendErrorResponse(w http.ResponseWriter, errorMsg string) {
	w.Header().Set("Content-Type", "text/html")
	tmpl := template.Must(template.New("error").Parse(errorPageHTML))
	tmpl.Execute(w, map[string]string{"Error": errorMsg})
}

const successPageHTML = `
<!DOCTYPE html>
<html>
<head>
    <title>Authentication Successful</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            margin: 0;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        }
        .container {
            background: white;
            padding: 40px;
            border-radius: 10px;
            box-shadow: 0 10px 25px rgba(0,0,0,0.2);
            text-align: center;
            max-width: 400px;
        }
        .icon {
            font-size: 64px;
            margin-bottom: 20px;
        }
        h1 {
            color: #333;
            margin-bottom: 10px;
        }
        p {
            color: #666;
            line-height: 1.6;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="icon">✓</div>
        <h1>Authentication Successful!</h1>
        <p>You have successfully authenticated with Google.</p>
        <p>You can close this window and return to Pub/Sub GUI.</p>
    </div>
</body>
</html>
`

const errorPageHTML = `
<!DOCTYPE html>
<html>
<head>
    <title>Authentication Error</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            margin: 0;
            background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
        }
        .container {
            background: white;
            padding: 40px;
            border-radius: 10px;
            box-shadow: 0 10px 25px rgba(0,0,0,0.2);
            text-align: center;
            max-width: 400px;
        }
        .icon {
            font-size: 64px;
            margin-bottom: 20px;
        }
        h1 {
            color: #333;
            margin-bottom: 10px;
        }
        p {
            color: #666;
            line-height: 1.6;
        }
        .error {
            background: #fff3cd;
            border: 1px solid #ffc107;
            border-radius: 5px;
            padding: 10px;
            margin-top: 20px;
            color: #856404;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="icon">✗</div>
        <h1>Authentication Failed</h1>
        <p>There was a problem authenticating with Google.</p>
        <div class="error">{{.Error}}</div>
        <p>Please close this window and try again.</p>
    </div>
</body>
</html>
`
