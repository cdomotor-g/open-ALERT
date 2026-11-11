#!/bin/bash
# Get the pinned RPi ALERT release, check it, and unpack it.
#
# The release is the one named in firmware/PIN. Nothing is unpacked unless all
# of these hold:
#   1. the public key kept in this repository has the fingerprint the pin names;
#   2. the tarball's SHA-256 is the one the pin names;
#   3. the signature file is that key's Ed25519 signature over the tarball
#      (checked with OpenSSL 3, and with Node as well when both are there);
#   4. the tarball holds only plain files and folders, all under one folder
#      named after the release, none of them set-user-id;
#   5. the agent inside says it is the version the pin names.
#
#   fetch-agent.sh --out DIR                       download, check, unpack into DIR
#   fetch-agent.sh --out DIR --tarball F --sig S   use two files already here (no network)
#   fetch-agent.sh --verify-only [--tarball F --sig S]
#                                                  check only, unpack nothing
# Options
#   --out DIR           where to unpack: DIR/agent and DIR/os (DIR must be empty or not exist)
#   --tarball FILE      a tarball already downloaded   (or the variable OA_AGENT_TARBALL)
#   --sig FILE          its signature file             (or the variable OA_AGENT_SIG)
#   --download-dir DIR  keep what is downloaded in DIR (default: a temporary folder, removed)
#   --pin FILE          another pin file (default: the PIN beside this script's folder)
#   --verify-only       check and stop
#
# Exit status: 0 everything checked; 1 a check failed (nothing was unpacked);
# 2 used wrongly; 3 a file could not be had, or a tool this script needs is missing.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FIRMWARE="$(dirname "$HERE")"

say()  { printf '%s\n' "$*"; }
fail() { printf 'fetch-agent: REFUSED — %s\n' "$*" >&2; exit 1; }
cant() { printf 'fetch-agent: %s\n' "$*" >&2; exit 3; }
usage() { sed -n '2,/^set -euo/p' "${BASH_SOURCE[0]}" | sed '$d' | sed 's/^# \{0,1\}//'; }

OUT=''; TARBALL="${OA_AGENT_TARBALL:-}"; SIG="${OA_AGENT_SIG:-}"; DLDIR=''; PIN="$FIRMWARE/PIN"; VERIFY_ONLY=0
while [ $# -gt 0 ]; do
  case "$1" in
    --out) OUT="${2:?--out needs a folder}"; shift 2 ;;
    --tarball) TARBALL="${2:?--tarball needs a file}"; shift 2 ;;
    --sig) SIG="${2:?--sig needs a file}"; shift 2 ;;
    --download-dir) DLDIR="${2:?--download-dir needs a folder}"; shift 2 ;;
    --pin) PIN="${2:?--pin needs a file}"; shift 2 ;;
    --verify-only) VERIFY_ONLY=1; shift ;;
    -h|--help) usage; exit 0 ;;
    *) printf 'fetch-agent: unknown option %s (try --help)\n' "$1" >&2; exit 2 ;;
  esac
done
if [ "$VERIFY_ONLY" = 0 ] && [ -z "$OUT" ]; then printf 'fetch-agent: say where to unpack with --out DIR (or use --verify-only)\n' >&2; exit 2; fi
if { [ -n "$TARBALL" ] && [ -z "$SIG" ]; } || { [ -z "$TARBALL" ] && [ -n "$SIG" ]; }; then
  printf 'fetch-agent: --tarball and --sig go together\n' >&2; exit 2
fi

# ── the pin ──────────────────────────────────────────────────────────────────
[ -f "$PIN" ] || cant "there is no pin file at $PIN"
# Read as data, never run: KEY=value lines of plain characters only.
pin() {
  local v
  v=$(sed -n "s|^$1=\([A-Za-z0-9._:/+=-]*\)\$|\1|p" "$PIN" | tail -n 1)
  [ -n "$v" ] || cant "the pin file $PIN has no usable $1= line"
  printf '%s' "$v"
}
TAG=$(pin AGENT_TAG); VERSION=$(pin AGENT_VERSION); URL=$(pin AGENT_URL); SIG_URL=$(pin AGENT_SIG_URL)
WANT_SHA=$(pin AGENT_SHA256); KEY="$(dirname "$PIN")/$(pin KEY_FILE)"; WANT_FP=$(pin KEY_FINGERPRINT)
[ "$TAG" = "v$VERSION" ] || fail "the pin is inconsistent: tag $TAG is not v$VERSION"
case "$URL$SIG_URL" in *' '*) fail "the pin's addresses hold a space" ;; esac
case "$URL" in https://*) ;; *) fail "the pin's tarball address is not https" ;; esac
case "$SIG_URL" in https://*) ;; *) fail "the pin's signature address is not https" ;; esac
[ -f "$KEY" ] || cant "the public key $KEY is missing"

# ── tools ────────────────────────────────────────────────────────────────────
HAVE_OPENSSL=0
if command -v openssl >/dev/null 2>&1 && openssl version 2>/dev/null | grep -Eq '^OpenSSL ([3-9]|[1-9][0-9])\.'; then HAVE_OPENSSL=1; fi
NODE=''
for n in node nodejs; do if command -v "$n" >/dev/null 2>&1; then NODE=$n; break; fi; done
[ "$HAVE_OPENSSL" = 1 ] || [ -n "$NODE" ] || cant "neither OpenSSL 3 nor Node.js is installed: one of them is needed to check the signature"
command -v tar >/dev/null 2>&1 || cant "tar is not installed"

sha256_of() {
  if command -v sha256sum >/dev/null 2>&1; then sha256sum "$1" | awk '{print $1}'
  elif command -v shasum >/dev/null 2>&1; then shasum -a 256 "$1" | awk '{print $1}'
  elif command -v openssl >/dev/null 2>&1; then openssl dgst -sha256 -r "$1" | awk '{print $1}'
  else cant "no tool to work out a SHA-256 (sha256sum, shasum or openssl)"; fi
}

# ── 1. the key is the key the pin names ──────────────────────────────────────
fp_openssl=''; fp_node=''
if [ "$HAVE_OPENSSL" = 1 ]; then
  fp_openssl="SHA256:$(openssl pkey -pubin -in "$KEY" -outform DER 2>/dev/null | openssl dgst -sha256 -binary | openssl base64 -A | tr -d '=')"
  [ "$fp_openssl" = "$WANT_FP" ] || fail "the public key in $KEY has fingerprint $fp_openssl, and the pin names $WANT_FP"
fi
if [ -n "$NODE" ]; then
  fp_node=$("$NODE" "$HERE/verify-ed25519.js" fingerprint "$KEY") || fail "the public key in $KEY is not a usable Ed25519 key"
  [ "$fp_node" = "$WANT_FP" ] || fail "the public key in $KEY has fingerprint $fp_node, and the pin names $WANT_FP"
fi
say "key        $WANT_FP (matches the pin)"

# ── get the two files ────────────────────────────────────────────────────────
TMP=''
cleanup() { if [ -n "$TMP" ]; then rm -rf "$TMP"; fi; }
trap cleanup EXIT
if [ -n "$TARBALL" ]; then
  [ -f "$TARBALL" ] || cant "there is no tarball at $TARBALL"
  [ -f "$SIG" ] || cant "there is no signature file at $SIG"
  say "tarball    $TARBALL (a file already here; nothing downloaded)"
else
  command -v curl >/dev/null 2>&1 || cant "curl is not installed (or hand over the two files with --tarball and --sig)"
  if [ -n "$DLDIR" ]; then mkdir -p "$DLDIR"; else TMP=$(mktemp -d "${TMPDIR:-/tmp}/oa-fetch.XXXXXX"); DLDIR=$TMP; fi
  TARBALL="$DLDIR/$(basename "$URL")"; SIG="$DLDIR/$(basename "$SIG_URL")"
  for pair in "$URL|$TARBALL" "$SIG_URL|$SIG"; do
    from=${pair%%|*}; to=${pair#*|}
    say "download   $from"
    curl --fail --silent --show-error --location --proto '=https' --proto-redir '=https' --tlsv1.2 \
         --retry 3 --retry-delay 2 --connect-timeout 30 --max-time 600 --output "$to.part" "$from" \
      || { rm -f "$to.part"; cant "could not download $from"; }
    mv -f "$to.part" "$to"
  done
fi

# ── 2. the hash ──────────────────────────────────────────────────────────────
got_sha=$(sha256_of "$TARBALL")
[ "$got_sha" = "$WANT_SHA" ] || fail "the tarball's SHA-256 is $got_sha, and the pin names $WANT_SHA"
say "sha256     $got_sha (matches the pin)"

# ── 3. the signature ─────────────────────────────────────────────────────────
[ "$(wc -c < "$SIG" | tr -d ' ')" = 64 ] || fail "the signature file is not 64 bytes long, as an Ed25519 signature is"
checked=''
if [ "$HAVE_OPENSSL" = 1 ]; then
  openssl pkeyutl -verify -pubin -inkey "$KEY" -rawin -in "$TARBALL" -sigfile "$SIG" >/dev/null 2>&1 \
    || fail "the signature is not the release key's signature over this tarball (checked with OpenSSL)"
  checked="OpenSSL"
fi
if [ -n "$NODE" ]; then
  "$NODE" "$HERE/verify-ed25519.js" verify "$KEY" "$SIG" "$TARBALL" \
    || fail "the signature is not the release key's signature over this tarball (checked with Node)"
  checked="${checked:+$checked and }Node"
fi
say "signature  Ed25519, good (checked with $checked)"

# ── 4. what is inside ────────────────────────────────────────────────────────
TOP="rpi-alert-$TAG"
names=$(tar -tzf "$TARBALL") || fail "the tarball cannot be read"
# Compared as plain text, not as a pattern: the dots in the name stand for dots.
bad=$(printf '%s\n' "$names" | awk -v top="$TOP" '$0 != top && $0 != top "/" && index($0, top "/") != 1 { print; exit }')
[ -z "$bad" ] || fail "the tarball holds something outside $TOP/: $bad"
bad=$(printf '%s\n' "$names" | grep -E '(^|/)\.\.(/|$)' | head -n 1 || true)
[ -z "$bad" ] || fail "the tarball holds a path that climbs out of its folder: $bad"
bad=$(tar -tvzf "$TARBALL" | grep -Ev '^[-d]' | head -n 1 || true)
[ -z "$bad" ] || fail "the tarball holds something that is neither a plain file nor a folder: $bad"
# No file that would run as somebody else (set-user-id or set-group-id).
bad=$(tar -tvzf "$TARBALL" | grep -E '^.{3}[sS]|^.{6}[sS]' | head -n 1 || true)
[ -z "$bad" ] || fail "the tarball holds a set-user-id or set-group-id file: $bad"
printf '%s\n' "$names" | grep -qx "$TOP/agent/package.json" || fail "the tarball has no $TOP/agent/package.json"
in_version=$(tar -xzOf "$TARBALL" "$TOP/agent/package.json" | sed -n 's/^[[:space:]]*"version"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' | head -n 1)
[ "$in_version" = "$VERSION" ] || fail "the agent inside says it is version '${in_version:-unknown}', and the pin names $VERSION"
say "contents   $(printf '%s\n' "$names" | wc -l | tr -d ' ') entries under $TOP/, plain files and folders only; the agent says $in_version"

if [ "$VERIFY_ONLY" = 1 ]; then say "verified   RPi ALERT $TAG (nothing unpacked)"; exit 0; fi

# ── 5. unpack ────────────────────────────────────────────────────────────────
if [ -e "$OUT" ] && [ -n "$(ls -A "$OUT" 2>/dev/null)" ]; then cant "$OUT is not empty: give an empty or a new folder"; fi
mkdir -p "$OUT"
# Unpacked as the user running this, with that user's ordinary file modes:
# nothing in the tarball decides who owns a file or what it may do.
( umask 022; tar -xzf "$TARBALL" -C "$OUT" --strip-components=1 --no-same-owner --no-same-permissions )
[ -f "$OUT/agent/bin/rpi-alert" ] || fail "the unpacked release has no agent/bin/rpi-alert"
say "verified   RPi ALERT $TAG, unpacked into $OUT"
