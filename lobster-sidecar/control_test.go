package main

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"net/netip"
	"testing"
	"time"

	"tailscale.com/ipn/ipnstate"
	"tailscale.com/tailcfg"
	"tailscale.com/types/key"
)

const testKey = "0123456789abcdef0123456789abcdef"

type fakeNode struct {
	state    NodeState
	startErr error
	pair     PairInfo
	pairErr  error
	started  int
	stopped  int
}

func (f *fakeNode) Start(context.Context) (NodeState, error) { f.started++; return f.state, f.startErr }
func (f *fakeNode) Stop() error                              { f.stopped++; return nil }
func (f *fakeNode) Status(context.Context) NodeState         { return f.state }
func (f *fakeNode) Pair(context.Context) (PairInfo, error)   { return f.pair, f.pairErr }

func do(t *testing.T, h http.Handler, method, path, key string) *httptest.ResponseRecorder {
	t.Helper()
	req := httptest.NewRequest(method, path, nil)
	if key != "" {
		req.Header.Set("X-Control-Key", key)
	}
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	return rec
}

func TestControlAPIRequiresKeyOnEveryEndpoint(t *testing.T) {
	node := &fakeNode{state: NodeState{Status: statusRunning}}
	h := NewControlServer("127.0.0.1:0", testKey, node).Handler()
	cases := []struct{ method, path string }{
		{http.MethodGet, "/api/status"},
		{http.MethodGet, "/api/peers"},
		{http.MethodPost, "/api/start"},
		{http.MethodPost, "/api/stop"},
		{http.MethodPost, "/api/pair"},
	}
	for _, tc := range cases {
		for _, key := range []string{"", "wrong", testKey + "x", testKey[:len(testKey)-1]} {
			rec := do(t, h, tc.method, tc.path, key)
			if rec.Code != http.StatusUnauthorized {
				t.Errorf("%s %s key=%q: got %d, want 401", tc.method, tc.path, key, rec.Code)
			}
			if ct := rec.Header().Get("Content-Type"); ct != "application/json" {
				t.Errorf("%s %s: content-type %q", tc.method, tc.path, ct)
			}
		}
		if rec := do(t, h, tc.method, tc.path, testKey); rec.Code != http.StatusOK {
			t.Errorf("%s %s with key: got %d, want 200", tc.method, tc.path, rec.Code)
		}
	}
	if node.started != 1 || node.stopped != 1 {
		t.Errorf("unauthenticated requests reached the node: started=%d stopped=%d", node.started, node.stopped)
	}
}

func TestControlAPIAuthBeforeMethodCheck(t *testing.T) {
	h := NewControlServer("127.0.0.1:0", testKey, &fakeNode{}).Handler()
	if rec := do(t, h, http.MethodGet, "/api/start", ""); rec.Code != http.StatusUnauthorized {
		t.Fatalf("unauthenticated GET /api/start: got %d, want 401", rec.Code)
	}
	rec := do(t, h, http.MethodGet, "/api/start", testKey)
	if rec.Code != http.StatusMethodNotAllowed || rec.Header().Get("Allow") != http.MethodPost {
		t.Fatalf("GET /api/start: got %d allow=%q, want 405 POST", rec.Code, rec.Header().Get("Allow"))
	}
}

func TestHealthzIsUnauthenticated(t *testing.T) {
	h := NewControlServer("127.0.0.1:0", testKey, &fakeNode{}).Handler()
	if rec := do(t, h, http.MethodGet, "/healthz", ""); rec.Code != http.StatusOK {
		t.Fatalf("healthz: got %d", rec.Code)
	}
}

func TestControlAPIErrorStatusCodes(t *testing.T) {
	node := &fakeNode{startErr: errNotConfigured, pairErr: errNotRunning}
	h := NewControlServer("127.0.0.1:0", testKey, node).Handler()

	rec := do(t, h, http.MethodPost, "/api/start", testKey)
	if rec.Code != http.StatusConflict {
		t.Fatalf("start not configured: got %d, want 409", rec.Code)
	}
	var body map[string]string
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil || body["error"] != statusNotConfigured || body["message"] == "" {
		t.Fatalf("start body: %s (%v)", rec.Body, err)
	}
	if rec := do(t, h, http.MethodPost, "/api/pair", testKey); rec.Code != http.StatusConflict {
		t.Fatalf("pair not running: got %d, want 409", rec.Code)
	}
}

func TestPeersNeverNull(t *testing.T) {
	h := NewControlServer("127.0.0.1:0", testKey, &fakeNode{state: NodeState{Peers: []Peer{}}}).Handler()
	rec := do(t, h, http.MethodGet, "/api/peers", testKey)
	if got := rec.Body.String(); got != "[]\n" {
		t.Fatalf("peers body = %q, want []", got)
	}
}

func TestLoadControlKeyHasNoDefault(t *testing.T) {
	t.Setenv(envControlKey, "")
	if _, err := loadControlKey(""); err == nil {
		t.Fatal("expected an error with no control key configured")
	}
	t.Setenv(envControlKey, "short")
	if _, err := loadControlKey(""); err == nil {
		t.Fatal("expected an error for a short control key")
	}
	t.Setenv(envControlKey, testKey)
	if k, err := loadControlKey(""); err != nil || k != testKey {
		t.Fatalf("got %q, %v", k, err)
	}
}

func TestMapStatusRunning(t *testing.T) {
	seen := time.Date(2026, 1, 2, 3, 4, 5, 0, time.UTC)
	st := &ipnstate.Status{
		BackendState: "Running",
		TailscaleIPs: []netip.Addr{netip.MustParseAddr("fd7a:115c:a1e0::1"), netip.MustParseAddr("100.64.0.1")},
		Self:         &ipnstate.PeerStatus{HostName: "watchnexus-box", DNSName: "watchnexus-box.mesh.example."},
		Peer: map[key.NodePublic]*ipnstate.PeerStatus{
			key.NewNode().Public(): {HostName: "phone", DNSName: "phone.mesh.example.", OS: "android", Online: true,
				TailscaleIPs: []netip.Addr{netip.MustParseAddr("100.64.0.3")}, ID: tailcfg.StableNodeID("a")},
			key.NewNode().Public(): {HostName: "laptop", Online: false, LastSeen: seen,
				TailscaleIPs: []netip.Addr{netip.MustParseAddr("fd7a:115c:a1e0::2")}},
		},
	}
	got := mapStatus(st, 80)
	if got.Status != statusRunning || !got.Online {
		t.Fatalf("status=%q online=%v", got.Status, got.Online)
	}
	if got.TailnetIP != "100.64.0.1" {
		t.Errorf("tailnet_ip=%q, want IPv4 preferred", got.TailnetIP)
	}
	if got.ConnectURL != "http://100.64.0.1/" {
		t.Errorf("connect_url=%q", got.ConnectURL)
	}
	if got.Hostname != "watchnexus-box" || got.DNSName != "watchnexus-box.mesh.example" {
		t.Errorf("hostname=%q dns=%q", got.Hostname, got.DNSName)
	}
	if len(got.Peers) != 2 || got.Peers[0].Name != "laptop" || got.Peers[1].Name != "phone" {
		t.Fatalf("peers not sorted/mapped: %+v", got.Peers)
	}
	if got.Peers[0].TailnetIP != "fd7a:115c:a1e0::2" || got.Peers[0].Online || got.Peers[0].LastSeen == nil || !got.Peers[0].LastSeen.Equal(seen) {
		t.Errorf("laptop peer: %+v", got.Peers[0])
	}
	if !got.Peers[1].Online || got.Peers[1].TailnetIP != "100.64.0.3" || got.Peers[1].OS != "android" || got.Peers[1].LastSeen != nil {
		t.Errorf("phone peer: %+v", got.Peers[1])
	}
}

func TestMapStatusStates(t *testing.T) {
	cases := map[string]string{
		"NeedsLogin":       statusNeedsLogin,
		"NeedsMachineAuth": statusNeedsMachineAuth,
		"Stopped":          statusStopped,
		"Starting":         statusStarting,
		"NoState":          statusStarting,
		"":                 statusStarting,
	}
	for backend, want := range cases {
		got := mapStatus(&ipnstate.Status{BackendState: backend, AuthURL: "https://hs.example/register/abc"}, 80)
		if got.Status != want || got.Online {
			t.Errorf("%q: status=%q online=%v, want %q offline", backend, got.Status, got.Online, want)
		}
		if got.ConnectURL != "" {
			t.Errorf("%q: connect_url should be empty when not running", backend)
		}
		if got.Peers == nil || got.TailnetIPs == nil || got.Health == nil {
			t.Errorf("%q: slices must be non-nil so JSON encodes [] not null", backend)
		}
	}
	if got := mapStatus(&ipnstate.Status{BackendState: "NeedsLogin", AuthURL: "https://hs.example/register/abc"}, 80); got.AuthURL != "https://hs.example/register/abc" {
		t.Errorf("auth_url not surfaced: %q", got.AuthURL)
	}
}

func TestNodeStatusNotConfigured(t *testing.T) {
	n := NewNode(NodeConfig{StateDir: t.TempDir(), Hostname: "h"})
	st := n.Status(context.Background())
	if st.Status != statusNotConfigured || st.Configured || st.Message == "" {
		t.Fatalf("got %+v", st)
	}
	if _, err := n.Start(context.Background()); err != errNotConfigured {
		t.Fatalf("Start err = %v, want errNotConfigured", err)
	}
	if _, err := n.Pair(context.Background()); err != errNotConfigured {
		t.Fatalf("Pair err = %v, want errNotConfigured", err)
	}
	if n.WasEnabled() {
		t.Fatal("unconfigured node must not auto-start")
	}
}

func TestNodeStoppedPair(t *testing.T) {
	n := NewNode(NodeConfig{StateDir: t.TempDir(), Hostname: "h", ControlURL: "http://127.0.0.1:1"})
	if st := n.Status(context.Background()); st.Status != statusStopped || !st.Configured {
		t.Fatalf("got %+v", st)
	}
	if _, err := n.Pair(context.Background()); err != errNotRunning {
		t.Fatalf("Pair err = %v, want errNotRunning", err)
	}
}

func TestConnectURL(t *testing.T) {
	if got := connectURL("100.64.0.1", 8080); got != "http://100.64.0.1:8080/" {
		t.Error(got)
	}
	if got := connectURL("fd7a::1", 80); got != "http://[fd7a::1]/" {
		t.Error(got)
	}
}
