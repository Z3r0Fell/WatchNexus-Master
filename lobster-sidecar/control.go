package main

import (
	"context"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/json"
	"errors"
	"log"
	"net"
	"net/http"
	"time"
)

// ControlServer is the sidecar's local control API. It binds to loopback
// only and every endpoint requires the X-Control-Key header.
type ControlServer struct {
	addr    string
	keyHash [32]byte
	node    NodeController
	server  *http.Server
}

func NewControlServer(addr, key string, node NodeController) *ControlServer {
	c := &ControlServer{addr: addr, keyHash: sha256.Sum256([]byte(key)), node: node}
	c.server = &http.Server{
		Addr:              addr,
		Handler:           c.Handler(),
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       10 * time.Second,
		WriteTimeout:      30 * time.Second,
		MaxHeaderBytes:    16 << 10,
	}
	return c
}

func (c *ControlServer) Handler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("/api/status", c.method(http.MethodGet, c.handleStatus))
	mux.HandleFunc("/api/peers", c.method(http.MethodGet, c.handlePeers))
	mux.HandleFunc("/api/start", c.method(http.MethodPost, c.handleStart))
	mux.HandleFunc("/api/stop", c.method(http.MethodPost, c.handleStop))
	mux.HandleFunc("/api/pair", c.method(http.MethodPost, c.handlePair))
	mux.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) {
		// Unauthenticated liveness probe; reveals nothing.
		writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
	})
	return c.requireControlKey(mux)
}

func (c *ControlServer) ListenAndServe() error {
	ln, err := net.Listen("tcp", c.addr)
	if err != nil {
		return err
	}
	log.Printf("[Lobster] control API listening on %s", ln.Addr())
	return c.server.Serve(ln)
}

func (c *ControlServer) Shutdown(ctx context.Context) {
	_ = c.server.Shutdown(ctx)
}

// requireControlKey rejects any request (except the liveness probe) whose
// X-Control-Key does not match. Both sides are hashed first so the
// comparison is constant-time and does not leak the key length.
func (c *ControlServer) requireControlKey(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/healthz" {
			got := sha256.Sum256([]byte(r.Header.Get("X-Control-Key")))
			if subtle.ConstantTimeCompare(got[:], c.keyHash[:]) != 1 {
				writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
				return
			}
		}
		next.ServeHTTP(w, r)
	})
}

func (c *ControlServer) method(m string, h http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != m {
			w.Header().Set("Allow", m)
			writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
			return
		}
		h(w, r)
	}
}

func (c *ControlServer) handleStatus(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, c.node.Status(r.Context()))
}

func (c *ControlServer) handlePeers(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, c.node.Status(r.Context()).Peers)
}

func (c *ControlServer) handleStart(w http.ResponseWriter, r *http.Request) {
	st, err := c.node.Start(r.Context())
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, st)
}

func (c *ControlServer) handleStop(w http.ResponseWriter, r *http.Request) {
	if err := c.node.Stop(); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "stop_failed", "message": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, c.node.Status(r.Context()))
}

func (c *ControlServer) handlePair(w http.ResponseWriter, r *http.Request) {
	info, err := c.node.Pair(r.Context())
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, info)
}

func writeError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, errNotConfigured):
		writeJSON(w, http.StatusConflict, map[string]string{"error": statusNotConfigured, "message": err.Error()})
	case errors.Is(err, errNotRunning):
		writeJSON(w, http.StatusConflict, map[string]string{"error": "not_running", "message": err.Error()})
	default:
		log.Printf("[Lobster] request failed: %v", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal", "message": err.Error()})
	}
}

// writeJSON sets headers and status before writing the body (a body write
// first would lock in an implicit 200).
func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}
