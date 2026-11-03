package main

import (
	"errors"
	"fmt"
	"io"
	"log"
	"net"
	"strconv"
	"sync"
	"time"
)

// Proxy forwards TCP connections accepted on the tailnet listener to the
// local WatchNexus server (one port: API, streams and SPA are served
// together, including WebSockets, so a byte-level forwarder is used).
//
// Security: WatchNexus treats loopback callers as on-box and trusts them for
// a few endpoints (LocalRequest.IsLoopback). Forwarding remote tailnet peers
// from 127.0.0.1 would let them impersonate on-box callers, so by default the
// proxy dials the app on a non-loopback local address. UpstreamHost overrides
// that (e.g. when the app only listens on localhost), at the operator's risk.
type Proxy struct {
	AppPort      int
	UpstreamHost string
}

func (p *Proxy) Serve(ln net.Listener) {
	for {
		conn, err := ln.Accept()
		if err != nil {
			if !errors.Is(err, net.ErrClosed) {
				log.Printf("[Lobster] tailnet accept stopped: %v", err)
			}
			return
		}
		go p.handle(conn)
	}
}

func (p *Proxy) upstreamAddr() (string, error) {
	host := p.UpstreamHost
	if host == "" {
		ip, err := firstNonLoopbackIP()
		if err != nil {
			return "", err
		}
		host = ip.String()
	}
	return net.JoinHostPort(host, strconv.Itoa(p.AppPort)), nil
}

func (p *Proxy) handle(in net.Conn) {
	defer in.Close()
	addr, err := p.upstreamAddr()
	if err != nil {
		log.Printf("[Lobster] proxy: %v", err)
		return
	}
	out, err := net.DialTimeout("tcp", addr, 5*time.Second)
	if err != nil {
		log.Printf("[Lobster] proxy: dial %s failed: %v", addr, err)
		return
	}
	defer out.Close()

	var wg sync.WaitGroup
	wg.Add(2)
	pipe := func(dst, src net.Conn) {
		defer wg.Done()
		_, _ = io.Copy(dst, src)
		// Propagate EOF so request/response half-closes work.
		if cw, ok := dst.(interface{ CloseWrite() error }); ok {
			_ = cw.CloseWrite()
		} else {
			_ = dst.Close()
		}
	}
	go pipe(out, in)
	go pipe(in, out)
	wg.Wait()
}

// firstNonLoopbackIP returns a usable local unicast address (IPv4 first).
func firstNonLoopbackIP() (net.IP, error) {
	ifaces, err := net.Interfaces()
	if err != nil {
		return nil, err
	}
	var v6 net.IP
	for _, iface := range ifaces {
		if iface.Flags&net.FlagUp == 0 || iface.Flags&net.FlagLoopback != 0 {
			continue
		}
		addrs, err := iface.Addrs()
		if err != nil {
			continue
		}
		for _, a := range addrs {
			ipn, ok := a.(*net.IPNet)
			if !ok || ipn.IP.IsLoopback() || !ipn.IP.IsGlobalUnicast() {
				continue
			}
			if ip4 := ipn.IP.To4(); ip4 != nil {
				return ip4, nil
			}
			if v6 == nil {
				v6 = ipn.IP
			}
		}
	}
	if v6 != nil {
		return v6, nil
	}
	return nil, fmt.Errorf("no non-loopback local address to reach WatchNexus on; set %s", envUpstreamHost)
}
