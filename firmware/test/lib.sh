#!/bin/bash
# firmware/test/lib.sh — what the check scripts in this folder share.
#
# It is not run by itself: a check script reads it in (". lib.sh").
#
# Two halves:
#   1. On the computer that runs the checks: results (ok / FAIL / skip), logs,
#      the release files, container images.
#   2. Inside a test container: starting the agent exactly as its service
#      would, waiting for things to happen, asking a web page for an answer.
#
# How a result is written — one line each, so a log can be counted:
#   ok    <what was checked>
#   FAIL  <what was checked> — <what was found instead>
#   skip  <what was not checked> — <why not>
#   note  <something worth knowing that is neither>
# A check that fails does not stop the run: the run goes on, so that one run
# shows every failure, and ends with a count and a non-zero exit status.

# shellcheck shell=bash

OA_TEST_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OA_FIRMWARE="$(dirname "$OA_TEST_DIR")"
OA_REPO="$(dirname "$OA_FIRMWARE")"
export OA_TEST_DIR OA_FIRMWARE OA_REPO

# ═════════════════════════════════════════════════════════════════════════════
# 1. Results
# ═════════════════════════════════════════════════════════════════════════════

OA_PASSED=0; OA_FAILED=0; OA_SKIPPED=0

oa_ok()      { OA_PASSED=$((OA_PASSED + 1)); printf 'ok    %s\n' "$*"; }
oa_fail()    { OA_FAILED=$((OA_FAILED + 1)); printf 'FAIL  %s\n' "$*"; }
oa_skip()    { OA_SKIPPED=$((OA_SKIPPED + 1)); printf 'skip  %s\n' "$*"; }
oa_note()    { printf 'note  %s\n' "$*"; }
oa_section() { printf '\n== %s\n' "$*"; }
oa_die()     { printf '%s: %s\n' "$(basename "$0")" "$*" >&2; exit 2; }

# oa_check "what" command…        ok when the command succeeds, FAIL when not.
oa_check() {
  local what=$1; shift
  if "$@" >/dev/null 2>&1; then oa_ok "$what"; else oa_fail "$what"; fi
}
# oa_check_not "what" command…    ok when the command fails.
oa_check_not() {
  local what=$1; shift
  if "$@" >/dev/null 2>&1; then oa_fail "$what"; else oa_ok "$what"; fi
}
# oa_is "what" WANTED GOT          ok when the two are the same text.
oa_is() {
  if [ "$2" = "$3" ]; then oa_ok "$1"; else oa_fail "$1 — wanted \"$2\", got \"$3\""; fi
}
# oa_has "what" FILE PATTERN       ok when the file holds a line matching the pattern (grep -E).
oa_has() {
  if grep -Eq -- "$3" "$2" 2>/dev/null; then oa_ok "$1"; else oa_fail "$1 — \"$3\" is not in $2"; fi
}
# oa_has_not "what" FILE PATTERN   ok when it holds none.
oa_has_not() {
  if grep -Eq -- "$3" "$2" 2>/dev/null; then oa_fail "$1 — \"$3\" is in $2"; else oa_ok "$1"; fi
}

# Add the results written in a log (by a check that ran somewhere else, in a
# container) to this run's count.
oa_count_log() {
  local n
  n=$(grep -c '^ok    ' "$1" 2>/dev/null || true);  OA_PASSED=$((OA_PASSED + ${n:-0}))
  n=$(grep -c '^FAIL  ' "$1" 2>/dev/null || true);  OA_FAILED=$((OA_FAILED + ${n:-0}))
  n=$(grep -c '^skip  ' "$1" 2>/dev/null || true);  OA_SKIPPED=$((OA_SKIPPED + ${n:-0}))
}

# The last lines of a run: the count, and the exit status (0 only with no failure).
oa_summary() {
  printf '\n== Result\n'
  printf '%s passed, %s failed, %s skipped.\n' "$OA_PASSED" "$OA_FAILED" "$OA_SKIPPED"
  if [ "$OA_FAILED" -gt 0 ]; then printf 'FAILED.\n'; return 1; fi
  printf 'All checks that ran passed.\n'
  return 0
}

# ═════════════════════════════════════════════════════════════════════════════
# 1b. On the computer that runs the checks
# ═════════════════════════════════════════════════════════════════════════════

# A value from firmware/PIN (or from the pin file given as $2).
oa_pin() { sed -n "s|^$1=\([A-Za-z0-9._:/+=-]*\)\$|\1|p" "${2:-$OA_FIRMWARE/PIN}" | tail -n 1; }

oa_need() {
  local t
  for t in "$@"; do command -v "$t" >/dev/null 2>&1 || oa_die "this check needs \"$t\", which is not installed"; done
}

# Make sure a container image is here. Docker Hub sometimes answers "too many
# requests": wait and try again, then try the same image from two mirrors.
#   oa_image debian:trixie-slim
oa_image() {
  local image=$1 try from
  if docker image inspect "$image" >/dev/null 2>&1; then return 0; fi
  for try in 1 2 3; do
    if docker pull -q "$image" >/dev/null 2>&1; then return 0; fi
    sleep $((try * 20))
  done
  for from in "public.ecr.aws/docker/library/$image" "mirror.gcr.io/library/$image"; do
    if docker pull -q "$from" >/dev/null 2>&1; then docker tag "$from" "$image"; return 0; fi
  done
  return 1
}

# Run one part of a check in a container, show its results as they come, keep
# everything it printed in a log, and count its results.
#   oa_in_container LOG  docker-run-arguments… IMAGE command…
# A part that stops without having reported a failure is itself a failure.
oa_in_container() {
  local log=$1 rc=0; shift
  mkdir -p "$(dirname "$log")"
  docker run --rm "$@" > "$log" 2>&1 || rc=$?
  grep -E '^(ok|FAIL|skip|note)  |^== ' "$log" || true
  oa_count_log "$log"
  if [ "$rc" != 0 ] && ! grep -q '^FAIL  ' "$log"; then
    oa_fail "this part stopped early (exit status $rc) — the last lines of $log:"
    tail -n 15 "$log" | sed 's/^/        /'
  fi
  return 0
}

# The same for a container that is already running (docker exec): what the
# command prints is added to the log.
#   oa_exec_container LOG  CONTAINER command…
oa_exec_container() {
  local log=$1 name=$2 rc=0 part; shift 2
  mkdir -p "$(dirname "$log")"
  part=$(mktemp "${TMPDIR:-/tmp}/oa-part.XXXXXX")
  docker exec "$name" "$@" > "$part" 2>&1 || rc=$?
  cat "$part" >> "$log"
  grep -E '^(ok|FAIL|skip|note)  |^== ' "$part" || true
  oa_count_log "$part"
  if [ "$rc" != 0 ] && ! grep -q '^FAIL  ' "$part"; then
    oa_fail "this part stopped early (exit status $rc) — the last lines of $log:"
    tail -n 15 "$part" | sed 's/^/        /'
  fi
  rm -f "$part"
  return 0
}

# ═════════════════════════════════════════════════════════════════════════════
# 2. Inside a test container
# ═════════════════════════════════════════════════════════════════════════════

OA_UNIT_FILE=/usr/lib/systemd/system/open-alert-base.service
OA_DROPIN_DIR=/etc/systemd/system/open-alert-base.service.d
OA_AGENT_DIR=/usr/lib/open-alert-base/agent

# Wait until a command succeeds.   oa_wait SECONDS command…
oa_wait() {
  local left=$(( $1 * 2 )); shift
  while [ "$left" -gt 0 ]; do
    if "$@" >/dev/null 2>&1; then return 0; fi
    sleep 0.5; left=$((left - 1))
  done
  return 1
}

# Ask a web address for its answer, with Node (always there: the package needs
# it), so no other tool has to be installed. Prints "<status> <body>".
#   oa_http URL [seconds]
oa_http() {
  node -e '
    const [url, secs] = process.argv.slice(1);
    fetch(url, { redirect: "manual", signal: AbortSignal.timeout((Number(secs) || 5) * 1000) })
      .then(async (r) => { process.stdout.write(r.status + " " + (await r.text())); })
      .catch((e) => { process.stdout.write("000 " + ((e.cause && (e.cause.code || e.cause.message)) || e.message)); process.exitCode = 1; });
  ' "$1" "${2:-5}"
}
oa_http_ok() { oa_http "$1" "${2:-5}" 2>/dev/null | grep -q '^200 '; }

# The values a service file gives a setting, its drop-in files included, the
# way systemd reads them: later lines add to earlier ones, and an empty value
# ("Name=") forgets what came before.
#   oa_unit_values NAME
oa_unit_values() {
  local files=("$OA_UNIT_FILE") f
  if [ -d "$OA_DROPIN_DIR" ]; then
    for f in "$OA_DROPIN_DIR"/*.conf; do if [ -f "$f" ]; then files+=("$f"); fi; done
  fi
  awk -v k="$1" '
    index($0, k "=") == 1 { v = substr($0, length(k) + 2); if (v == "") n = 0; else vals[n++] = v }
    END { for (i = 0; i < n; i++) print vals[i] }' "${files[@]}"
}

# "CAP_NET_BIND_SERVICE CAP_X" → "-all,+net_bind_service,+x"; nothing → "-all".
oa_caps_for_setpriv() {
  local out="-all" c
  for c in "$@"; do
    c=${c#CAP_}; out="$out,+$(printf '%s' "$c" | tr '[:upper:]' '[:lower:]')"
  done
  printf '%s' "$out"
}

# Start the agent exactly as open-alert-base.service would, without systemd:
# the same user, group and extra groups, the same environment (the service
# file's Environment= lines and /etc/open-alert-base/env), the same privileges
# (none, or only what a drop-in file adds), no-new-privileges, the same file
# mode mask, the same folder, the same start command. All of it is read from
# the installed service file, not repeated here.
#
# What systemd adds that this cannot: the read-only file system, the device
# list and the system-call filter. Those are checked under a real systemd.
#
#   oa_run_as_unit LOGFILE [NAME=value …]     extra environment, for the stand-ins
# The agent runs in the background; its process number is left in OA_AGENT_PID.
OA_AGENT_PID=''
oa_run_as_unit() {
  local log=$1; shift
  local user group uid gid gids='' g envs=() line f mask dir cmd caps_amb caps_bnd nnp=()
  user=$(oa_unit_values User | tail -n 1); group=$(oa_unit_values Group | tail -n 1)
  uid=$(id -u "$user"); gid=$(getent group "$group" | cut -d: -f3)
  # shellcheck disable=SC2046  # the groups are separate words on purpose
  for g in $(oa_unit_values SupplementaryGroups); do
    gids="${gids:+$gids,}$(getent group "$g" | cut -d: -f3)"
  done
  # What systemd itself gives every service.
  envs=("PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
        "HOME=$(getent passwd "$user" | cut -d: -f6)" "USER=$user" "LOGNAME=$user" "SHELL=$(getent passwd "$user" | cut -d: -f7)")
  # shellcheck disable=SC2046
  for line in $(oa_unit_values Environment); do envs+=("$line"); done
  for f in $(oa_unit_values EnvironmentFile); do
    f=${f#-}
    if [ -r "$f" ]; then
      while IFS= read -r line; do
        case "$line" in ''|'#'*) continue ;; *=*) envs+=("$line") ;; esac
      done < "$f"
    fi
  done
  envs+=("$@")
  # shellcheck disable=SC2046
  caps_amb=$(oa_caps_for_setpriv $(oa_unit_values AmbientCapabilities))
  # shellcheck disable=SC2046
  caps_bnd=$(oa_caps_for_setpriv $(oa_unit_values CapabilityBoundingSet))
  if [ "$(oa_unit_values NoNewPrivileges | tail -n 1)" = yes ]; then nnp=(--no-new-privs); fi
  mask=$(oa_unit_values UMask | tail -n 1); dir=$(oa_unit_values WorkingDirectory | tail -n 1)
  cmd=$(oa_unit_values ExecStart | tail -n 1)
  (
    cd "${dir:-/}" && umask "${mask:-0022}" &&
    exec setpriv --reuid "$uid" --regid "$gid" --groups "${gids:-$gid}" \
      --inh-caps "$caps_amb" --ambient-caps "$caps_amb" --bounding-set "$caps_bnd" "${nnp[@]}" \
      env -i "${envs[@]}" "$cmd"
  ) > "$log" 2>&1 &
  OA_AGENT_PID=$!
}

# Stop what oa_run_as_unit started, and wait until it has gone.
oa_stop_agent() {
  if [ -n "$OA_AGENT_PID" ]; then
    kill "$OA_AGENT_PID" 2>/dev/null || true
    wait "$OA_AGENT_PID" 2>/dev/null || true
    OA_AGENT_PID=''
  fi
}

# End every process of a user (the agent and what it started).   oa_kill_user USER
oa_kill_user() {
  local uid d sig
  uid=$(id -u "$1" 2>/dev/null) || return 0
  for sig in TERM KILL; do
    for d in /proc/[0-9]*; do
      if [ "$(stat -c %u "$d" 2>/dev/null || true)" = "$uid" ]; then kill "-$sig" "${d#/proc/}" 2>/dev/null || true; fi
    done
    sleep 1
  done
}

# A line of /proc/<pid>/status: its value.   oa_proc_status PID NAME
oa_proc_status() { sed -n "s/^$2:[[:space:]]*//p" "/proc/$1/status" 2>/dev/null | head -n 1; }

# The process that is the agent itself (Node running "rpi-alert daemon"),
# given the process oa_run_as_unit started or any of the agent user's.
oa_agent_node_pid() {
  local d
  for d in /proc/[0-9]*; do
    if tr '\0' ' ' < "$d/cmdline" 2>/dev/null | grep -qF "$OA_AGENT_DIR/bin/rpi-alert daemon"; then printf '%s' "${d#/proc/}"; return 0; fi
  done
  return 1
}

# The TCP ports a user's processes are listening on, a line each: "<port> <address>".
#   oa_listening USER
oa_listening() {
  local uid f local_addr state sock_uid
  uid=$(id -u "$1")
  for f in /proc/net/tcp /proc/net/tcp6; do
    if [ -r "$f" ]; then
      while read -r _ local_addr _ state _ _ _ sock_uid _; do
        if [ "$state" = 0A ] && [ "$sock_uid" = "$uid" ]; then printf '%d %s\n' "$((16#${local_addr##*:}))" "${local_addr%:*}"; fi
      done < <(tail -n +2 "$f")
    fi
  done
}
