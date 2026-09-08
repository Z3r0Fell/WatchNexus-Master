package main

import (
	"context"
	"crypto/rand"
	"encoding/json"
	"fmt"
	"log"
	"math/big"
	"net"
	"net/http"
	"os"
	"sync"
	"time"
)

const (
	controlKeyEnv = "LOBSTER_CONTROL_KEY"
	defaultKey    = "lobster-control-default-change-me"
)

type ControlServer struct {
	port     int
	server   *http.Server
	state    NodeState
	stateMu  sync.RWMutex
controlKey string
}

type NodeState struct {
	Status     string    `json:"status"`
	Hostname   string    `json:"hostname"`
	TailnetIP  string    `json:"tailnet_ip"`
	Online     bool      `json:"online"`
	LastSeen   time.Time `json:"last_seen"`
	Peers      []Peer    `json:"peers"`
	PairCode   string    `json:"pair_code"`
}

type Peer struct {
	Name      string    `json:"name"`
	TailnetIP string    `json:"tailnet_ip"`
	Online    bool      `json:"online"`
	LastSeen  time.Time `json:"last_seen"`
}

func NewControlServer(port int) *ControlServer {
	key := os.Getenv(controlKeyEnv)
	if key == "" {
		key = defaultKey
	}
	return &ControlServer{
		port:       port,
		controlKey: key,
		state:      NodeState{Status: "stopped", Online: false},
	}
}

func (c *ControlServer) Start() error {
	mux := http.NewServeMux()
	mux.HandleFunc("/api/status", c.handleStatus)
	mux.HandleFunc("/api/start", c.requireControlKey(c.handleStart))
	mux.HandleFunc("/api/stop", c.requireControlKey(c.handleStop))
	mux.HandleFunc("/api/peers", c.requireControlKey(c.handlePeers))
	mux.HandleFunc("/api/pair", c.requireControlKey(c.handlePair))

	ln, err := net.Listen("tcp", fmt.Sprintf("127.0.0.1:%d", c.port))
	if err != nil {
		return err
	}
	log.Printf("[Lobster] Control API listening on %s", ln.Addr())

	c.server = &http.Server{
		Addr:         fmt.Sprintf("127.0.0.1:%d", c.port),
		Handler:      mux,
		ReadTimeout:  10 * time.Second,
		WriteTimeout: 15 * time.Second,
		MaxHeaderBytes: 1 << 20, // 1 MB
	}
	return c.server.Serve(ln)
}

func (c *ControlServer) Shutdown() {
	if c.server != nil {
		_ = c.server.Shutdown(context.Background())
	}
}

func (c *ControlServer) requireControlKey(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("X-Control-Key") != c.controlKey {
			writeJSON(w, map[string]string{"error": "unauthorized"})
			w.WriteHeader(http.StatusUnauthorized)
			return
		}
		next(w, r)
	}
}

func (c *ControlServer) SetState(s NodeState) {
	c.stateMu.Lock()
	c.state = s
	c.stateMu.Unlock()
}

func (c *ControlServer) GetState() NodeState {
	c.stateMu.RLock()
	defer c.stateMu.RUnlock()
	return c.state
}

func (c *ControlServer) handleStatus(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, c.GetState())
}

func (c *ControlServer) handleStart(w http.ResponseWriter, r *http.Request) {
	c.stateMu.Lock()
	c.state.Status = "running"
	c.state.Online = true
	c.state.LastSeen = time.Now()
	c.stateMu.Unlock()
	log.Println("[Lobster] Node started")
	writeJSON(w, map[string]string{"ok": "true", "status": "running"})
}

func (c *ControlServer) handleStop(w http.ResponseWriter, r *http.Request) {
	c.stateMu.Lock()
	c.state.Status = "stopped"
	c.state.Online = false
	c.state.TailnetIP = ""
	c.state.Peers = nil
	c.state.PairCode = ""
	c.stateMu.Unlock()
	log.Println("[Lobster] Node stopped")
	writeJSON(w, map[string]string{"ok": "true", "status": "stopped"})
}

func (c *ControlServer) handlePeers(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, c.GetState().Peers)
}

func (c *ControlServer) handlePair(w http.ResponseWriter, r *http.Request) {
	code := generatePairCode()
	c.stateMu.Lock()
	c.state.PairCode = code
	c.stateMu.Unlock()
	log.Printf("[Lobster] Pair code generated: %s", code)
	writeJSON(w, map[string]string{"pair_code": code, "expires_in": "300s"})
}

func writeJSON(w http.ResponseWriter, v interface{}) {
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(v)
}

func generatePairCode() string {
	const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
	var b [6]byte
	for i := range b {
		n, err := rand.Int(rand.Reader, big.NewInt(int64(len(alphabet))))
		if err != nil {
			log.Fatalf("[Lobster] crypto/rand failure: %v", err)
		}
		b[i] = alphabet[n.Int64()]
	}
	return string(b[:])
}
