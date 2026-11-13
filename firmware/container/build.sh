#!/bin/bash
# Build the open-alert-base container image from the pinned RPi ALERT release.
#
#   firmware/container/build.sh                          build for this computer's processor, as open-alert-base
#   firmware/container/build.sh --platform linux/arm64   build for another (needs Docker buildx; see below)
#   firmware/container/build.sh --tag REGISTRY/NAME:TAG --push   build and publish
#
# The release is fetched from GitHub and checked (hash and signature) inside the
# build, by firmware/lib/fetch-agent.sh; a failed check stops the build.
#
# Options
#   --tag NAME[:TAG]      what to call the image (default: open-alert-base, i.e. :latest; "<version>" is
#                         also added when the name has no tag, e.g. open-alert-base:0.23.1-oa1)
#   --platform LIST       e.g. linux/amd64 or linux/amd64,linux/arm64. One platform is loaded into
#                         this computer's Docker. Several need --push (Docker cannot hold a
#                         several-platform image locally with the classic image store).
#   --push                publish to the registry in the tag, instead of loading it here
#   --base-image REF      build on this base, e.g. debian:trixie-slim@sha256:<digest>
#                         (see the top of the Dockerfile for how to find the digest)
#   --release-dir DIR     use the release tarball and signature already in DIR instead of
#                         downloading them (they are checked just the same)
#   -h, --help            this text
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FIRMWARE="$(dirname "$HERE")"

TAG=open-alert-base; PLATFORM=''; PUSH=0; BASE=''; RELDIR=''
while [ $# -gt 0 ]; do
  case "$1" in
    --tag) TAG="${2:?--tag needs a name}"; shift 2 ;;
    --platform) PLATFORM="${2:?--platform needs a list}"; shift 2 ;;
    --push) PUSH=1; shift ;;
    --base-image) BASE="${2:?--base-image needs a reference}"; shift 2 ;;
    --release-dir) RELDIR="${2:?--release-dir needs a folder}"; shift 2 ;;
    -h|--help) sed -n '2,/^set -euo/p' "${BASH_SOURCE[0]}" | sed '$d' | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) printf 'build.sh: unknown option %s (try --help)\n' "$1" >&2; exit 2 ;;
  esac
done
command -v docker >/dev/null 2>&1 || { printf 'build.sh: Docker is not installed\n' >&2; exit 3; }

pin() { sed -n "s|^$1=\([A-Za-z0-9._:/+=-]*\)\$|\1|p" "$FIRMWARE/PIN" | tail -n 1; }
VERSION="$(pin AGENT_VERSION)+oa$(pin OA_REVISION)"
# A tag may not hold "+": the version in image tags is written with a dash.
TAGVERSION="${VERSION/+/-}"
REVISION=$(git -C "$FIRMWARE" rev-parse --short=12 HEAD 2>/dev/null || echo unknown)
CREATED=$(date -u +%Y-%m-%dT%H:%M:%SZ)

args=(buildx build -f "$HERE/Dockerfile"
      --build-arg "OA_VERSION=$VERSION" --build-arg "OA_REVISION=$REVISION" --build-arg "OA_CREATED=$CREATED"
      -t "$TAG")
case "${TAG##*/}" in *:*) ;; *) args+=(-t "$TAG:$TAGVERSION") ;; esac
if [ -n "$BASE" ]; then args+=(--build-arg "BASE_IMAGE=$BASE"); fi
if [ -n "$PLATFORM" ]; then args+=(--platform "$PLATFORM"); fi
if [ -n "$RELDIR" ]; then args+=(--build-context "local-release=$RELDIR"); fi
if [ "$PUSH" = 1 ]; then args+=(--push); else args+=(--load); fi
args+=("$FIRMWARE")

printf 'building %s (agent release %s) …\n' "$TAG" "$VERSION"
docker "${args[@]}"
