# open-ALERT base station as a hardened container: the RPi ALERT agent, from
# its signed release, unchanged, on Debian 13.
#
# Build it from the firmware folder (the build needs PIN, keys/ and lib/ in its
# context), or just run container/build.sh, which does that:
#
#   docker build -f container/Dockerfile -t open-alert-base firmware/
#
# The same file builds for linux/amd64 and linux/arm64 (add --platform): it
# holds no compiled code of its own, only Debian's packages for each.
#
# Pinning the base image. A tag such as debian:trixie-slim moves each time Debian
# publishes an update. To build from exactly one version of it, give its digest:
#   docker buildx imagetools inspect debian:trixie-slim      # shows "Digest: sha256:…"
#   docker build --build-arg BASE_IMAGE=debian:trixie-slim@sha256:<that digest> …
# Refresh it the same way when you want Debian's newer fixes (then run
# firmware/test/container.sh again).
#
# Building without the network. The release is downloaded from GitHub and
# checked in the "fetch" step. To use two files you already hold, give the
# folder that has them as a named build context (they are checked just the same):
#   docker buildx build --build-context local-release=/path/to/folder …
#   (the folder holds rpi-alert-<tag>-src.tar.gz and rpi-alert-<tag>-src.tar.gz.sig)

ARG BASE_IMAGE=debian:trixie-slim

# An empty stage that --build-context local-release=DIR replaces.
FROM scratch AS local-release

# ── step 1: get the release and check it. Nothing from this step but the
#    unpacked agent reaches the finished image ──────────────────────────────────
FROM ${BASE_IMAGE} AS fetch
RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates curl nodejs openssl tar \
 && rm -rf /var/lib/apt/lists/*
COPY PIN /fw/PIN
COPY keys/ /fw/keys/
COPY lib/ /fw/lib/
# The pin names the tag; look for the local files under that name.
RUN --mount=type=bind,from=local-release,target=/local \
    set -eu; \
    tag=$(sed -n 's/^AGENT_TAG=//p' /fw/PIN); \
    if [ -f "/local/rpi-alert-$tag-src.tar.gz" ] && [ -f "/local/rpi-alert-$tag-src.tar.gz.sig" ]; then \
      /fw/lib/fetch-agent.sh --out /out --tarball "/local/rpi-alert-$tag-src.tar.gz" --sig "/local/rpi-alert-$tag-src.tar.gz.sig"; \
    else \
      /fw/lib/fetch-agent.sh --out /out; \
    fi

# ── step 2: the image that runs ───────────────────────────────────────────────
FROM ${BASE_IMAGE}

# Filled in by container/build.sh (and the automatic build).
ARG BASE_IMAGE
ARG OA_VERSION=0.0.0
ARG OA_REVISION=unknown
ARG OA_CREATED=unknown
LABEL org.opencontainers.image.title="open-alert-base" \
      org.opencontainers.image.description="An open-ALERT flood-warning base station: the RPi ALERT agent (signed release, unchanged) that receives ALERT and ALERT2 radio telemetry on RTL-SDR USB sticks and sends it to Flood-Net over outbound HTTPS. Runs as an ordinary user, with no privileges." \
      org.opencontainers.image.source="https://github.com/cdomotor-g/open-ALERT" \
      org.opencontainers.image.url="https://github.com/cdomotor-g/open-ALERT/tree/main/firmware" \
      org.opencontainers.image.documentation="https://github.com/cdomotor-g/open-ALERT/blob/main/firmware/README.md" \
      org.opencontainers.image.licenses="MIT" \
      org.opencontainers.image.vendor="open-ALERT" \
      org.opencontainers.image.version="${OA_VERSION}" \
      org.opencontainers.image.revision="${OA_REVISION}" \
      org.opencontainers.image.created="${OA_CREATED}" \
      org.opencontainers.image.base.name="${BASE_IMAGE}"

# (The last line takes the set-user-id bit off the few programs that carry it,
# su and mount among them. The container runs with no-new-privileges, which
# makes them do nothing anyway; this makes the image itself say so.)
# nodejs: runs the agent. rtl-sdr: the program that reads a stick (rtl_sdr).
# ca-certificates: so HTTPS to Flood-Net can be checked. node-undici: what the
# start-up file needs to send through a web proxy on Debian's Node.js 20.
RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates nodejs node-undici rtl-sdr \
 && rm -rf /var/lib/apt/lists/* /var/cache/apt/* /var/log/apt /var/log/dpkg.log /var/log/alternatives.log \
 && groupadd --system --gid 990 rpi-alert \
 && useradd --system --uid 990 --gid 990 --home-dir /var/lib/rpi-alert --no-create-home --shell /usr/sbin/nologin rpi-alert \
 && install -d -o 990 -g 990 -m 0750 /etc/rpi-alert /var/lib/rpi-alert \
 && find / -xdev -type f -perm /6000 -exec chmod a-s {} +

# The agent, as released: the same folders, in the same place, as the native package.
COPY --from=fetch /out/agent/bin /usr/lib/open-alert-base/agent/bin
COPY --from=fetch /out/agent/lib /usr/lib/open-alert-base/agent/lib
COPY --from=fetch /out/agent/vendor /usr/lib/open-alert-base/agent/vendor
COPY --from=fetch /out/agent/web /usr/lib/open-alert-base/agent/web
COPY --from=fetch /out/agent/package.json /usr/lib/open-alert-base/agent/package.json
# What this layer adds: the web-proxy start-up file (the same file as the
# native package's), a health check, and first settings.
COPY deb/files/usr/lib/open-alert-base/proxy-preload.js /usr/lib/open-alert-base/proxy-preload.js
COPY container/healthcheck.js /usr/lib/open-alert-base/healthcheck.js
# Kept in a new settings volume the first time it is used (Docker copies the
# image's files into an empty named volume).
COPY --chown=990:990 container/config.default.json /etc/rpi-alert/config.json
# The agent's own command line, by the name its documentation uses (docker exec NAME rpi-alert status).
RUN ln -s /usr/lib/open-alert-base/agent/bin/rpi-alert /usr/local/bin/rpi-alert

# Nothing in here can ask for the administrator account: the helper the agent
# would call does not exist. The host keeps the time, so the agent need not ask
# systemd (which is not here) whether the clock is right.
ENV NODE_ENV=production \
    UV_THREADPOOL_SIZE=8 \
    HOME=/var/lib/rpi-alert \
    RPI_ALERT_PRIV=/nonexistent/open-alert-base-has-no-root-helper \
    RPI_ALERT_ASSUME_CLOCK=1

USER 990:990
WORKDIR /var/lib/rpi-alert
VOLUME ["/etc/rpi-alert", "/var/lib/rpi-alert"]
EXPOSE 8080
HEALTHCHECK --interval=60s --timeout=10s --start-period=60s --retries=3 \
  CMD ["node", "/usr/lib/open-alert-base/healthcheck.js"]
# The proxy start-up file does nothing unless HTTPS_PROXY is set.
ENTRYPOINT ["node", "--require=/usr/lib/open-alert-base/proxy-preload.js", "/usr/lib/open-alert-base/agent/bin/rpi-alert"]
CMD ["daemon"]
