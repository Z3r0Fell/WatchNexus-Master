# WatchNexus — Docker image built from the InstallBuilder linux-x64 payload
# Build:
#   docker buildx build --build-arg TIER=ultra --build-arg VERSION=2.9.0 \
#       -t watchnexus/ultra:2.9.0 -f Dockerfile /app/release/ultra/linux
ARG TIER=standard
ARG VERSION=2.9.0

FROM debian:bookworm-slim AS runtime

ARG TIER
ARG VERSION

LABEL org.opencontainers.image.title="WatchNexus ${TIER}"
LABEL org.opencontainers.image.version="${VERSION}"
LABEL org.opencontainers.image.source="https://watchnexus.ca"
LABEL org.opencontainers.image.licenses="Proprietary"

RUN apt-get update \
 && apt-get install -y --no-install-recommends \
        libicu72 libkrb5-3 zlib1g ca-certificates tini \
 && rm -rf /var/lib/apt/lists/*

ARG INSTALLER=watchnexus-${TIER}-${VERSION}-linux-x64-installer.run
COPY ${INSTALLER} /tmp/installer.run

RUN chmod +x /tmp/installer.run \
 && /tmp/installer.run --mode unattended --prefix /opt/watchnexus --port 8001 \
 && rm /tmp/installer.run \
 && useradd --system --home /opt/watchnexus --shell /usr/sbin/nologin watchnexus \
 && chown -R watchnexus:watchnexus /opt/watchnexus

USER watchnexus
WORKDIR /opt/watchnexus
EXPOSE 8001
VOLUME ["/var/lib/watchnexus"]

ENV ASPNETCORE_ENVIRONMENT=Production
ENV WATCHNEXUS_TIER=${TIER}
ENV WATCHNEXUS_VERSION=${VERSION}

ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["/opt/watchnexus/bin/WatchNexus.Core", "--urls", "http://0.0.0.0:8001"]
