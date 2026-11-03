# Tailscale does not publish an official derper image, so build it from the
# pinned tailscale.com release (same version as lobster-sidecar/go.mod).
ARG GO_VERSION=1.27-alpine
FROM golang:${GO_VERSION} AS build
ARG TAILSCALE_VERSION=v1.104.5
RUN CGO_ENABLED=0 go install -trimpath -ldflags="-s -w" tailscale.com/cmd/derper@${TAILSCALE_VERSION}

FROM alpine:3.23
RUN apk add --no-cache ca-certificates \
    && adduser -D -H -u 10001 derper \
    && mkdir -p /data /certs && chown derper:derper /data /certs
COPY --from=build /go/bin/derper /usr/local/bin/derper
USER derper
VOLUME ["/data", "/certs"]
EXPOSE 80 443 3478/udp
ENTRYPOINT ["/usr/local/bin/derper"]
