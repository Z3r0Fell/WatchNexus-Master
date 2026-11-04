package main

import (
	"context"
	"errors"
	"fmt"
	"log"
	"net"
	"net/netip"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"time"

	"tailscale.com/ipn/ipnstate"
	"tailscale.com/tsnet"
)

var (
	errNotConfigured = errors.New("no coordination server configured: set " + envControlURL)
	errNotRunning    = errors.New("the mesh node is not running: start it first")
)

// Status values reported to WatchNexus (and on to LobsterPage).
const (
	statusRunning          = "running"
	statusStarting         = "starting"
	statusNeedsLogin       = "needs_login"
	statusNeedsMachineAuth = "needs_machine_auth"
	statusStopped          = "stopped"
	statusNotConfigured    = "not_configured"
)

type NodeConfig struct {
	StateDir     string
	ControlURL   string
	AuthKey      string
	Hostname     string
	TailnetPort  int
	AppPort      int
	UpstreamHost string
}

// NodeState is the JSON shape of GET /api/status.
type NodeState struct {
	Status       string   `json:"status"`
	BackendState string   `json:"backend_state"`
	Configured   bool     `json:"configured"`
	Online       bool     `json:"online"`
	Hostname     string   `json:"hostname"`
	DNSName      string   `json:"dns_name"`
	TailnetIP    string   `json:"tailnet_ip"`
	TailnetIPs   []string `json:"tailnet_ips"`
	ConnectURL   string   `json:"connect_url"`
	AuthURL      string   `json:"auth_url"`
	ControlURL   string   `json:"control_url"`
	Health       []string `json:"health"`
	Peers        []Peer   `json:"peers"`
	Message      string   `json:"message,omitempty"`
}

type Peer struct {
	Name      string `json:"name"`
	DNSName   string `json:"dns_name"`
	TailnetIP string `json:"tailnet_ip"`
	OS        string `json:"os"`
	Online    bool   `json:"online"`
	// LastSeen is only reported by control for offline peers; null otherwise.
	LastSeen *time.Time `json:"last_seen"`
}

// PairInfo is the JSON shape of POST /api/pair. Joining a Headscale tailnet
// is done either with a pre-auth key or through an interactive login URL;
// there is no separate short "pair code" protocol. So pairing reports
// honestly what is needed next:
//   - needs_login: AuthURL must be opened (or approved on Headscale) to
//     admit this server to the tailnet.
//   - running: other devices already on the tailnet reach this server at
//     ConnectURL.
type PairInfo struct {
	Status     string `json:"status"`
	AuthURL    string `json:"auth_url,omitempty"`
	ConnectURL string `json:"connect_url,omitempty"`
	TailnetIP  string `json:"tailnet_ip,omitempty"`
	DNSName    string `json:"dns_name,omitempty"`
	Hostname   string `json:"hostname"`
	Message    string `json:"message"`
}

// NodeController is what the control API drives; *Node implements it.
type NodeController interface {
	Start(ctx context.Context) (NodeState, error)
	Stop() error
	Status(ctx context.Context) NodeState
	Pair(ctx context.Context) (PairInfo, error)
}

type Node struct {
	cfg NodeConfig

	mu    sync.Mutex
	srv   *tsnet.Server
	ln    net.Listener
	proxy *Proxy
}

func NewNode(cfg NodeConfig) *Node {
	return &Node{cfg: cfg, proxy: &Proxy{AppPort: cfg.AppPort, UpstreamHost: cfg.UpstreamHost}}
}

func (n *Node) enabledMarker() string { return filepath.Join(n.cfg.StateDir, "enabled") }

// WasEnabled reports whether the node was left running by an admin, so it
// can be resumed when the sidecar restarts with the app.
func (n *Node) WasEnabled() bool {
	if n.cfg.ControlURL == "" {
		return false
	}
	_, err := os.Stat(n.enabledMarker())
	return err == nil
}

func (n *Node) current() *tsnet.Server {
	n.mu.Lock()
	defer n.mu.Unlock()
	return n.srv
}

func (n *Node) Start(ctx context.Context) (NodeState, error) {
	if n.cfg.ControlURL == "" {
		return n.Status(ctx), errNotConfigured
	}
	n.mu.Lock()
	if n.srv == nil {
		srv := &tsnet.Server{
			Dir:        filepath.Join(n.cfg.StateDir, "tsnet"),
			Hostname:   n.cfg.Hostname,
			ControlURL: n.cfg.ControlURL,
			AuthKey:    n.cfg.AuthKey,
			UserLogf:   log.Printf,
		}
		if err := os.MkdirAll(srv.Dir, 0o700); err != nil {
			n.mu.Unlock()
			return n.Status(ctx), fmt.Errorf("creating state dir: %w", err)
		}
		if err := srv.Start(); err != nil {
			n.mu.Unlock()
			return n.Status(ctx), fmt.Errorf("starting tsnet: %w", err)
		}
		ln, err := srv.Listen("tcp", fmt.Sprintf(":%d", n.cfg.TailnetPort))
		if err != nil {
			_ = srv.Close()
			n.mu.Unlock()
			return n.Status(ctx), fmt.Errorf("listening on tailnet port %d: %w", n.cfg.TailnetPort, err)
		}
		n.srv, n.ln = srv, ln
		go n.proxy.Serve(ln)
		if err := os.WriteFile(n.enabledMarker(), nil, 0o600); err != nil {
			log.Printf("[Lobster] could not persist enabled flag: %v", err)
		}
		log.Printf("[Lobster] node starting as %q against %s", n.cfg.Hostname, n.cfg.ControlURL)
	}
	n.mu.Unlock()

	// Give the backend a moment to reach a state worth reporting (Running,
	// or NeedsLogin with an AuthURL) so the caller sees something useful.
	deadline := time.NewTimer(8 * time.Second)
	defer deadline.Stop()
	tick := time.NewTicker(250 * time.Millisecond)
	defer tick.Stop()
	for {
		st := n.Status(ctx)
		switch st.Status {
		case statusRunning, statusNeedsMachineAuth:
			return st, nil
		case statusNeedsLogin:
			if st.AuthURL != "" {
				return st, nil
			}
		}
		select {
		case <-ctx.Done():
			return st, nil
		case <-deadline.C:
			return st, nil
		case <-tick.C:
		}
	}
}

// Stop takes the node off the tailnet and remembers that the admin wants it
// off. Node identity (state dir) is kept so a later Start rejoins as the
// same machine without a new auth key.
func (n *Node) Stop() error {
	if err := os.Remove(n.enabledMarker()); err != nil && !errors.Is(err, os.ErrNotExist) {
		log.Printf("[Lobster] could not clear enabled flag: %v", err)
	}
	n.closeNode()
	return nil
}

// Shutdown closes the node on process exit without changing the persisted
// enabled flag.
func (n *Node) Shutdown() { n.closeNode() }

func (n *Node) closeNode() {
	n.mu.Lock()
	srv, ln := n.srv, n.ln
	n.srv, n.ln = nil, nil
	n.mu.Unlock()
	if ln != nil {
		_ = ln.Close()
	}
	if srv != nil {
		_ = srv.Close()
		log.Println("[Lobster] node stopped")
	}
}

func (n *Node) Status(ctx context.Context) NodeState {
	base := NodeState{
		Status:     statusStopped,
		Configured: n.cfg.ControlURL != "",
		Hostname:   n.cfg.Hostname,
		ControlURL: n.cfg.ControlURL,
		Peers:      []Peer{},
		TailnetIPs: []string{},
		Health:     []string{},
	}
	if !base.Configured {
		base.Status = statusNotConfigured
		base.Message = errNotConfigured.Error()
		return base
	}
	srv := n.current()
	if srv == nil {
		return base
	}
	lc, err := srv.LocalClient()
	if err != nil {
		base.Status = statusStarting
		base.Message = err.Error()
		return base
	}
	cctx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()
	st, err := lc.Status(cctx)
	if err != nil {
		base.Status = statusStarting
		base.Message = err.Error()
		return base
	}
	out := mapStatus(st, n.cfg.TailnetPort)
	out.Configured = true
	out.ControlURL = n.cfg.ControlURL
	if out.Hostname == "" {
		out.Hostname = n.cfg.Hostname
	}
	return out
}

func (n *Node) Pair(ctx context.Context) (PairInfo, error) {
	st := n.Status(ctx)
	info := PairInfo{Status: st.Status, Hostname: st.Hostname}
	switch st.Status {
	case statusNotConfigured:
		return info, errNotConfigured
	case statusStopped:
		return info, errNotRunning
	case statusNeedsLogin:
		info.AuthURL = st.AuthURL
		if st.AuthURL != "" {
			info.Message = "Open this login link (or approve it on the coordination server) to add this server to the mesh."
		} else {
			info.Message = "This server is waiting to be authorized by the coordination server. Set LOBSTER_AUTH_KEY to a pre-auth key to join automatically."
		}
	case statusNeedsMachineAuth:
		info.Message = "This server is registered but must be approved on the coordination server before it can join the mesh."
	case statusRunning:
		info.ConnectURL = st.ConnectURL
		info.TailnetIP = st.TailnetIP
		info.DNSName = st.DNSName
		info.Message = "Devices already on this mesh can open WatchNexus at the address below. New devices join the mesh with a pre-auth key from the coordination server."
	default:
		info.Message = "The mesh node is still starting; try again in a few seconds."
	}
	return info, nil
}

// mapStatus converts tsnet's LocalClient status to the sidecar's JSON
// contract. It is a pure function so it can be unit-tested.
func mapStatus(st *ipnstate.Status, tailnetPort int) NodeState {
	out := NodeState{
		BackendState: st.BackendState,
		AuthURL:      st.AuthURL,
		Peers:        []Peer{},
		TailnetIPs:   []string{},
		Health:       append([]string{}, st.Health...),
	}
	switch st.BackendState {
	case "Running":
		out.Status = statusRunning
		out.Online = true
	case "NeedsLogin":
		out.Status = statusNeedsLogin
	case "NeedsMachineAuth":
		out.Status = statusNeedsMachineAuth
	case "Stopped":
		out.Status = statusStopped
	default: // NoState, Starting, or anything new
		out.Status = statusStarting
	}

	for _, ip := range st.TailscaleIPs {
		out.TailnetIPs = append(out.TailnetIPs, ip.String())
	}
	if ip, ok := preferIPv4(st.TailscaleIPs); ok {
		out.TailnetIP = ip.String()
	}
	if st.Self != nil {
		out.Hostname = st.Self.HostName
		out.DNSName = strings.TrimSuffix(st.Self.DNSName, ".")
	}
	if out.Online && out.TailnetIP != "" {
		out.ConnectURL = connectURL(out.TailnetIP, tailnetPort)
	}

	for _, p := range st.Peer {
		if p == nil {
			continue
		}
		peer := Peer{
			Name:    p.HostName,
			DNSName: strings.TrimSuffix(p.DNSName, "."),
			OS:      p.OS,
			Online:  p.Online,
		}
		if !p.LastSeen.IsZero() {
			t := p.LastSeen
			peer.LastSeen = &t
		}
		if peer.Name == "" {
			peer.Name, _, _ = strings.Cut(peer.DNSName, ".")
		}
		if ip, ok := preferIPv4(p.TailscaleIPs); ok {
			peer.TailnetIP = ip.String()
		}
		out.Peers = append(out.Peers, peer)
	}
	sort.Slice(out.Peers, func(i, j int) bool { return out.Peers[i].Name < out.Peers[j].Name })
	return out
}

func preferIPv4(ips []netip.Addr) (netip.Addr, bool) {
	for _, ip := range ips {
		if ip.Is4() {
			return ip, true
		}
	}
	if len(ips) > 0 {
		return ips[0], true
	}
	return netip.Addr{}, false
}

func connectURL(ip string, port int) string {
	host := ip
	if strings.Contains(ip, ":") {
		host = "[" + ip + "]"
	}
	if port == 80 {
		return "http://" + host + "/"
	}
	return fmt.Sprintf("http://%s:%d/", host, port)
}
