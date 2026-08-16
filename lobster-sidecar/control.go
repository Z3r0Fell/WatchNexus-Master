package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net"
	"net/http"
	"sync"
	"time"
)

type ControlServer struct {
	port     int
	server   *http.Server
	state    NodeState
	stateMu  sync.RWMutex
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
	return &ControlServer{
		port:   port,
		state: NodeState{Status: "stopped", Online: false},
	}
}

func (c *ControlServer) Start() error {
	mux := http.NewServeMux()
	mux.HandleFunc("/api/status", c.handleStatus)
	mux.HandleFunc("/api/start", c.handleStart)
	mux.HandleFunc("/api/stop", c.handleStop)
	mux.HandleFunc("/api/peers", c.handlePeers)
	mux.HandleFunc("/api/pair", c.handlePair)

	c.server = &http.Server{Addr: fmt.Sprintf("127.0.0.1:%d", c.port), Handler: mux}
	ln, err := net.Listen("tcp", c.server.Addr)
	if err != nil {
		return err
	}
	log.Printf("[Lobster] Control API listening on %s", ln.Addr())
	return c.server.Serve(ln)
}

func (c *ControlServer) Shutdown() {
	if c.server != nil {
		_ = c.server.Close()
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
		b[i] = alphabet[time.Now().UnixNano()%int64(len(alphabet))]
	}
	return string(b[:])
}
