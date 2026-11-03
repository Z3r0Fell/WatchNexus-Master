// Command watchnexus-lobster is the Lobster sidecar: an embedded Tailscale
// (tsnet) node that joins a Headscale-coordinated tailnet and exposes the local
// WatchNexus server to that tailnet. It is spawned and supervised by
// LobsterService in the WatchNexus backend, which talks to it over a
// loopback-only control API authenticated with a per-install control key.
package main

import (
	"context"
	"errors"
	"flag"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"strconv"
	"strings"
	"syscall"
	"time"

	"tailscale.com/envknob"
	"tailscale.com/logtail"
)

const (
	envControlURL   = "LOBSTER_CONTROL_URL"
	envAuthKey      = "LOBSTER_AUTH_KEY"
	envControlKey   = "LOBSTER_CONTROL_KEY"
	envStateDir     = "LOBSTER_STATE_DIR"
	envHostname     = "LOBSTER_HOSTNAME"
	envControlPort  = "LOBSTER_SIDECAR_PORT"
	envUpstreamHost = "LOBSTER_UPSTREAM_HOST"
	envAppPort      = "WATCHNEXUS_PORT"
	envDataDir      = "WATCHNEXUS_DATA_DIR"
)

func envOr(name, def string) string {
	if v := strings.TrimSpace(os.Getenv(name)); v != "" {
		return v
	}
	return def
}

func envIntOr(name string, def int) int {
	if v, err := strconv.Atoi(strings.TrimSpace(os.Getenv(name))); err == nil && v > 0 && v < 65536 {
		return v
	}
	return def
}

func defaultStateDir() string {
	if d := envOr(envStateDir, ""); d != "" {
		return d
	}
	if d := envOr(envDataDir, ""); d != "" {
		return filepath.Join(d, "lobster")
	}
	return "lobster-state"
}

func defaultHostname() string {
	h, _ := os.Hostname()
	if h == "" {
		h = "server"
	}
	return "watchnexus-" + h
}

func main() {
	stateDir := flag.String("state-dir", defaultStateDir(), "Directory for tsnet state (env "+envStateDir+", default $"+envDataDir+"/lobster)")
	controlURL := flag.String("control-url", envOr(envControlURL, ""), "Headscale coordination server URL (env "+envControlURL+")")
	authKey := flag.String("auth-key", "", "Headscale pre-auth key (prefer env "+envAuthKey+" so it is not visible in the process list)")
	hostname := flag.String("hostname", envOr(envHostname, defaultHostname()), "Hostname to register on the tailnet (env "+envHostname+")")
	controlPort := flag.Int("control-port", envIntOr(envControlPort, 19091), "Loopback port for the control API (env "+envControlPort+")")
	appPort := flag.Int("app-port", envIntOr(envAppPort, 8001), "Local WatchNexus port to expose on the tailnet (env "+envAppPort+")")
	tailnetPort := flag.Int("tailnet-port", 80, "Port the node listens on inside the tailnet")
	upstreamHost := flag.String("upstream-host", envOr(envUpstreamHost, ""), "Host used to reach WatchNexus (env "+envUpstreamHost+"; default: first non-loopback local address)")
	controlKeyFile := flag.String("control-key-file", "", "File holding the control API key (alternative to env "+envControlKey+")")
	flag.Parse()

	// Logs go to stdout; LobsterService forwards them to the app log.
	log.SetOutput(os.Stdout)
	log.SetFlags(log.LstdFlags)

	// Never upload node logs to log.tailscale.com: this node belongs to a
	// self-hosted Headscale tailnet, not Tailscale Inc.'s service.
	envknob.SetNoLogsNoSupport()
	logtail.Disable()

	key, err := loadControlKey(*controlKeyFile)
	if err != nil {
		log.Fatalf("[Lobster] %v", err)
	}
	if *authKey == "" {
		*authKey = os.Getenv(envAuthKey)
	}
	if err := os.MkdirAll(*stateDir, 0o700); err != nil {
		log.Fatalf("[Lobster] cannot create state dir %s: %v", *stateDir, err)
	}

	node := NewNode(NodeConfig{
		StateDir:     *stateDir,
		ControlURL:   strings.TrimRight(*controlURL, "/"),
		AuthKey:      *authKey,
		Hostname:     *hostname,
		TailnetPort:  *tailnetPort,
		AppPort:      *appPort,
		UpstreamHost: *upstreamHost,
	})

	ctrl := NewControlServer(fmt.Sprintf("127.0.0.1:%d", *controlPort), key, node)
	ctrlErr := make(chan error, 1)
	go func() { ctrlErr <- ctrl.ListenAndServe() }()

	// Resume the node if the admin left it running before the last restart.
	if node.WasEnabled() {
		go func() {
			if _, err := node.Start(context.Background()); err != nil {
				log.Printf("[Lobster] auto-start failed: %v", err)
			}
		}()
	}

	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	select {
	case <-ctx.Done():
		log.Println("[Lobster] shutting down")
	case err := <-ctrlErr:
		if err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Printf("[Lobster] control server failed: %v", err)
			node.Shutdown()
			os.Exit(1)
		}
	}

	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	ctrl.Shutdown(shutdownCtx)
	node.Shutdown()
	log.Println("[Lobster] stopped")
}

// loadControlKey reads the control API key from the env or a file. There is
// deliberately no built-in default: a well-known key would let any local
// process drive the node.
func loadControlKey(file string) (string, error) {
	key := strings.TrimSpace(os.Getenv(envControlKey))
	if key == "" && file != "" {
		b, err := os.ReadFile(file)
		if err != nil {
			return "", fmt.Errorf("reading control key file: %w", err)
		}
		key = strings.TrimSpace(string(b))
	}
	if len(key) < 16 {
		return "", errors.New("a control key of at least 16 characters is required (" + envControlKey + " or -control-key-file)")
	}
	return key, nil
}
