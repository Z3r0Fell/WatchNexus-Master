package main

import (
	"fmt"
	"io"
	"log"
	"net"
	"strconv"
	"strings"
	"sync"
	"time"
)

type Proxy struct {
	localPorts map[int]string
	listeners  []net.Listener
	stopCh     chan struct{}
	stopOnce   sync.Once
}

func NewProxy(mediaPorts string) *Proxy {
	ports := make(map[int]string)
	for _, entry := range strings.Split(mediaPorts, ",") {
		entry = strings.TrimSpace(entry)
		if entry == "" {
			continue
		}
		parts := strings.SplitN(entry, ":", 2)
		if len(parts) != 2 {
			log.Printf("[Lobster] Skipping invalid media port entry: %s", entry)
			continue
		}
		p, err := strconv.Atoi(parts[0])
		if err != nil {
			log.Printf("[Lobster] Skipping invalid port: %s", parts[0])
			continue
		}
		ports[p] = parts[1]
	}
	return &Proxy{localPorts: ports, stopCh: make(chan struct{})}
}

func (p *Proxy) Start(tailnetPort int) {
	go func() {
		for localPort, name := range p.localPorts {
			go p.acceptLoop(localPort, name, tailnetPort)
		}
	}()
}

func (p *Proxy) Stop() {
	p.stopOnce.Do(func() { close(p.stopCh) })
	for _, ln := range p.listeners {
		ln.Close()
	}
}

func (p *Proxy) acceptLoop(localPort int, name string, tailnetPort int) {
	local := fmt.Sprintf("127.0.0.1:%d", localPort)
	ln, err := net.Listen("tcp", local)
	if err != nil {
		log.Printf("[Lobster] Proxy[%s] failed to bind %s: %v", name, local, err)
		return
	}
	p.listeners = append(p.listeners, ln)
	log.Printf("[Lobster] Proxy[%s] listening on %s -> tailnet:%d", name, local, tailnetPort)

	go func() {
		<-p.stopCh
		ln.Close()
	}()

	for {
		conn, err := ln.Accept()
		if err != nil {
			select {
			case <-p.stopCh:
				return
			default:
				log.Printf("[Lobster] Proxy[%s] accept error: %v", name, err)
				continue
			}
		}
		go p.handleConn(conn, name, tailnetPort)
	}
}

func (p *Proxy) handleConn(localConn net.Conn, name string, tailnetPort int) {
	defer localConn.Close()

	tailnet := fmt.Sprintf("127.0.0.1:%d", tailnetPort)
	remoteConn, err := net.DialTimeout("tcp", tailnet, 5*time.Second)
	if err != nil {
		log.Printf("[Lobster] Proxy[%s] dial to %s failed: %v", name, tailnet, err)
		return
	}
	defer remoteConn.Close()

	log.Printf("[Lobster] Proxy[%s] connection established", name)

	done := make(chan struct{}, 2)
	go func() {
		_, _ = io.Copy(remoteConn, localConn)
		done <- struct{}{}
	}()
	go func() {
		_, _ = io.Copy(localConn, remoteConn)
		done <- struct{}{}
	}()

	<-done
	log.Printf("[Lobster] Proxy[%s] connection closed", name)
}
