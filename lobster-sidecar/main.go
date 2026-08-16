package main

import (
	"flag"
	"log"
	"net"
	"os"
	"os/signal"
	"syscall"
	"time"

	"tailscale.com/tsnet"
)

var (
	instanceID  = flag.String("instance-id", "", "Unique instance identifier")
	authKey     = flag.String("auth-key", "", "Headscale pre-auth key")
	controlURL  = flag.String("control-url", "https://coord.watchnexus.local", "Headscale coordination URL")
	controlPort = flag.Int("control-port", 19091, "Local control API port")
	mediaPorts  = flag.String("media-ports", "8002:api,8003:stream", "Local WatchNexus ports (localPort:name,...)")
)

func main() {
	flag.Parse()

	if *instanceID == "" {
		hostname, _ := os.Hostname()
		*instanceID = hostname
	}

	ts := &tsnet.Server{
		Hostname:   "watchnexus-" + *instanceID,
		AuthKey:    *authKey,
		ControlURL: *controlURL,
	}
	defer ts.Close()

	ln, err := ts.Listen("tcp", ":0")
	if err != nil {
		log.Fatalf("[Lobster] tsnet listen failed: %v", err)
	}
	defer ln.Close()

	localAddr := ln.Addr().(*net.TCPAddr)
	log.Printf("[Lobster] Tailscale listener bound on %s", localAddr)

	ctrl := NewControlServer(*controlPort)
	go func() {
		if err := ctrl.Start(); err != nil {
			log.Fatalf("[Lobster] Control server failed: %v", err)
		}
	}()

	proxy := NewProxy(*mediaPorts)
	go proxy.Start(localAddr.Port)

	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)
	<-sigCh

	log.Println("[Lobster] Shutting down...")
	ctrl.Shutdown()
	proxy.Stop()
	_ = time.Now()
}
