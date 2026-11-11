#!/bin/bash
# Build the native package: dist/open-alert-base_<agent version>+oa<N>_all.deb
#
# It takes the RPi ALERT release named in firmware/PIN (downloaded, or two
# files already here), checks its hash and its signature (firmware/lib/
# fetch-agent.sh — nothing is built from a release that fails), copies the
# agent into the package unchanged, adds the files under firmware/deb/files,
# and packs it with dpkg-deb. No compiler is involved: the package is
# JavaScript and shell, the same file for x86-64 and 64-bit ARM.
#
#   firmware/deb/build-deb.sh                           download the pinned release
#   firmware/deb/build-deb.sh --tarball F --sig S       use two files already here (no network)
# Options
#   --out DIR     where the .deb goes (default: dist/ at the top of the repository)
#   --no-bench    leave firmware/bench's benchmark out of the package
#   --lintian     also run Debian's package checker, if it is installed (its findings are shown, not fatal)
#
# Built twice from the same pin and the same files, it gives the same .deb,
# byte for byte (file times are set to the newest file time in the release).
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FIRMWARE="$(dirname "$HERE")"
REPO="$(dirname "$FIRMWARE")"

say()  { printf '%s\n' "$*"; }
die()  { printf 'build-deb: %s\n' "$*" >&2; exit 1; }
usage() { sed -n '2,/^set -euo/p' "${BASH_SOURCE[0]}" | sed '$d' | sed 's/^# \{0,1\}//'; }

OUT="$REPO/dist"; FETCH_ARGS=(); BENCH=1; LINTIAN=0
while [ $# -gt 0 ]; do
  case "$1" in
    --tarball) FETCH_ARGS+=(--tarball "${2:?--tarball needs a file}"); shift 2 ;;
    --sig) FETCH_ARGS+=(--sig "${2:?--sig needs a file}"); shift 2 ;;
    --out) OUT="${2:?--out needs a folder}"; shift 2 ;;
    --no-bench) BENCH=0; shift ;;
    --lintian) LINTIAN=1; shift ;;
    -h|--help) usage; exit 0 ;;
    *) die "unknown option $1 (try --help)" ;;
  esac
done
for t in dpkg-deb tar gzip sha256sum md5sum find sed du diff; do
  command -v "$t" >/dev/null 2>&1 || die "$t is not installed"
done

pin() { sed -n "s|^$1=\([A-Za-z0-9._:/+=-]*\)\$|\1|p" "$FIRMWARE/PIN" | tail -n 1; }
TAG=$(pin AGENT_TAG); AGENT_VERSION=$(pin AGENT_VERSION); REVISION=$(pin OA_REVISION)
if [ -z "$TAG" ] || [ -z "$AGENT_VERSION" ] || [ -z "$REVISION" ]; then die "firmware/PIN lacks AGENT_TAG, AGENT_VERSION or OA_REVISION"; fi
VERSION="${AGENT_VERSION}+oa${REVISION}"
head -n 1 "$HERE/changelog" | grep -qF "open-alert-base ($VERSION)" \
  || die "firmware/deb/changelog does not start with an entry for $VERSION: add one (what changed, in plain words)"

WORK=$(mktemp -d "${TMPDIR:-/tmp}/oa-deb.XXXXXX")
trap 'rm -rf "$WORK"' EXIT

# ── 1. the release, checked ──────────────────────────────────────────────────
say "== The pinned release"
"$FIRMWARE/lib/fetch-agent.sh" --out "$WORK/release" "${FETCH_ARGS[@]}"
REL_AGENT="$WORK/release/agent"

# ── 2. the package's own files ───────────────────────────────────────────────
STAGE="$WORK/pkg"
mkdir -p "$STAGE"
cp -a "$HERE/files/." "$STAGE/"

# ── 3. the agent, unchanged ──────────────────────────────────────────────────
# What goes in: the program (bin, lib, vendor, web, package.json), and its
# tests and scripts so a buyer can run them on their own hardware.
ITEMS=(bin lib vendor web package.json test scripts)
# What is left out, knowingly. Anything else in a newer release stops the
# build until somebody decides where it belongs.
LEFT_OUT=(README.md)
for entry in "$REL_AGENT"/* "$REL_AGENT"/.[!.]*; do
  [ -e "$entry" ] || continue
  name=$(basename "$entry"); known=0
  for k in "${ITEMS[@]}" "${LEFT_OUT[@]}"; do if [ "$k" = "$name" ]; then known=1; fi; done
  [ "$known" = 1 ] || die "the release's agent folder holds \"$name\", which this script does not know: add it to ITEMS or LEFT_OUT in firmware/deb/build-deb.sh"
done
DEST="$STAGE/usr/lib/open-alert-base/agent"
mkdir -p "$DEST"
for item in "${ITEMS[@]}"; do
  [ -e "$REL_AGENT/$item" ] || die "the release's agent folder has no \"$item\""
  cp -a "$REL_AGENT/$item" "$DEST/"
done

# ── 4. the benchmark, when firmware/bench has one ────────────────────────────
BENCH_NOTE="not included"
if [ "$BENCH" = 1 ] && [ -f "$FIRMWARE/bench/open-alert-bench.js" ]; then
  if command -v node >/dev/null 2>&1 && ! node --check "$FIRMWARE/bench/open-alert-bench.js" 2>/dev/null; then
    BENCH_NOTE="LEFT OUT: firmware/bench/open-alert-bench.js does not pass \"node --check\""
  else
    install -D -m 0644 "$FIRMWARE/bench/open-alert-bench.js" "$STAGE/usr/lib/open-alert-base/bench/open-alert-bench.js"
    BENCH_NOTE="included (firmware/bench/open-alert-bench.js)"
  fi
fi

# ── 5. what the package says about itself ────────────────────────────────────
SHARE="$STAGE/usr/share/open-alert-base"
mkdir -p "$SHARE"
cp "$FIRMWARE/PIN" "$SHARE/PIN"
cp "$FIRMWARE/$(pin KEY_FILE)" "$SHARE/rpi-alert-release.pub.pem"
printf '%s\n' "$VERSION" > "$SHARE/VERSION"
( cd "$DEST" && find . -type f -print0 | LC_ALL=C sort -z | xargs -0 sha256sum ) > "$SHARE/agent.sha256"
DOC="$STAGE/usr/share/doc/open-alert-base"
sed -i "s/@VERSION@/$VERSION/g; s/@TAG@/$TAG/g" "$DOC/README" "$DOC/copyright"
gzip -9n < "$HERE/changelog" > "$DOC/changelog.gz"

# ── 6. owners, modes and times ───────────────────────────────────────────────
# Owners are set to root by dpkg-deb (--root-owner-group). Modes: folders 0755,
# files 0644, programs 0755 — whatever the build computer's own settings are.
find "$STAGE" -type d -exec chmod 0755 {} +
find "$STAGE" -type f -perm /0111 -exec chmod 0755 {} +
find "$STAGE" -type f ! -perm /0111 -exec chmod 0644 {} +
chmod 0755 "$STAGE/usr/bin/open-alert-base" "$STAGE/usr/bin/rpi-alert" "$STAGE/usr/lib/open-alert-base/start"
chmod 0644 "$STAGE/usr/lib/open-alert-base/settings.js" "$STAGE/usr/lib/open-alert-base/proxy-preload.js"
# It may come to hold a proxy's user name and password: root only.
chmod 0640 "$STAGE/etc/open-alert-base/env"

# ── 7. the control files ─────────────────────────────────────────────────────
mkdir -p "$STAGE/DEBIAN"
SIZE_KB=$(du -sk --exclude=DEBIAN "$STAGE" | awk '{print $1}')
sed "s/@VERSION@/$VERSION/g; s/@TAG@/$TAG/g; s/@INSTALLED_SIZE@/$SIZE_KB/g" "$HERE/control.in" > "$STAGE/DEBIAN/control"
cp "$HERE/debian/conffiles" "$STAGE/DEBIAN/conffiles"
for s in preinst postinst prerm postrm; do install -m 0755 "$HERE/debian/$s" "$STAGE/DEBIAN/$s"; done
( cd "$STAGE" && find . -type f ! -path './DEBIAN/*' ! -path './etc/*' -print0 | LC_ALL=C sort -z | xargs -0 md5sum | sed 's|  \./|  |' ) > "$STAGE/DEBIAN/md5sums"
chmod 0644 "$STAGE/DEBIAN/control" "$STAGE/DEBIAN/conffiles" "$STAGE/DEBIAN/md5sums"

if [ -z "${SOURCE_DATE_EPOCH:-}" ]; then
  SOURCE_DATE_EPOCH=$(find "$WORK/release" -type f -printf '%T@\n' | sort -n | tail -n 1 | cut -d. -f1)
fi
export SOURCE_DATE_EPOCH
find "$STAGE" -exec touch -h -d "@$SOURCE_DATE_EPOCH" {} +

# ── 8. pack ──────────────────────────────────────────────────────────────────
mkdir -p "$OUT"
DEB="$OUT/open-alert-base_${VERSION}_all.deb"
rm -f "$DEB"
say ""
say "== Packing"
dpkg-deb --root-owner-group -Zxz --build "$STAGE" "$DEB" >/dev/null

# ── 9. look inside what was built: the agent must be the release's, byte for byte ──
mkdir "$WORK/check"
dpkg-deb --extract "$DEB" "$WORK/check"
for item in "${ITEMS[@]}"; do
  diff -r "$REL_AGENT/$item" "$WORK/check/usr/lib/open-alert-base/agent/$item" >/dev/null \
    || die "the agent's \"$item\" inside the built package is not the release's: the package was not kept"
done
( cd "$WORK/check/usr/lib/open-alert-base/agent" && sha256sum --quiet -c "$WORK/check/usr/share/open-alert-base/agent.sha256" ) \
  || die "the package's own list of agent file hashes does not match its files"
[ "$(dpkg-deb --field "$DEB" Version)" = "$VERSION" ] || die "the built package does not say it is $VERSION"

say "package    $DEB"
say "version    $VERSION (RPi ALERT $TAG + this layer's revision $REVISION), Architecture: all"
say "agent      $(wc -l < "$SHARE/agent.sha256") files, each the same as in the signed release"
say "benchmark  $BENCH_NOTE"
say "size       $(stat -c %s "$DEB") bytes ($(du -h "$DEB" | awk '{print $1}')); $SIZE_KB kB installed"
say "sha256     $(sha256sum "$DEB" | awk '{print $1}')"

if [ "$LINTIAN" = 1 ]; then
  say ""
  if command -v lintian >/dev/null 2>&1; then
    say "== lintian (Debian's package checker; findings are for information)"
    lintian --tag-display-limit 0 "$DEB" || true
  else
    say "lintian is not installed: skipped"
  fi
fi
