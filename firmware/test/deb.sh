#!/bin/bash
# firmware/test/deb.sh — check the native package, open-alert-base, from the
# release it is built from to the last file a purge removes.
#
#   firmware/test/deb.sh [options] [system …]
#
# Systems (all three when none is named):
#   debian13      debian:trixie-slim      Node.js 20
#   ubuntu2404    ubuntu:24.04            Node.js 18
#   debian12      debian:bookworm-slim    Node.js 18, an older rtl-sdr — reported plainly, not hidden
#
# What it does, in order:
#   1. The release check (firmware/lib/fetch-agent.sh): the real release is
#      accepted; a changed tarball, a wrong hash, a wrong signature, another
#      key, and correctly signed tarballs with something bad inside are refused.
#   2. The scripts pass shellcheck; the package builds, twice the same.
#   3. On each system, in a clean container:
#      a. install — with "apt-get install ./the.deb", so everything it needs
#         comes from the system's own packages; files, owners and modes; the
#         agent's own tests as the service's user; the agent started exactly as
#         the service would start it, with stand-ins for the radio sticks and
#         for Flood-Net; both profiles; a web proxy; remove, reinstall, purge;
#         the refusal to install beside RPi ALERT's own install; systemd's
#         checker and exposure score for the service file; udev's checker
#         for the device rules.
#      b. firewall — the enterprise profile's rules, loaded as the service
#         would load them, tried from a second container ("another computer").
#         This container is given the one privilege that needs (NET_ADMIN).
#      c. systemd — a container with systemd as its first process: the package
#         installed and the real service started, sandbox and all. This
#         container is given what that needs (SYS_ADMIN for the sandbox's
#         private mounts, NET_ADMIN for the firewall rules). Where systemd
#         will not start in a container, this part is skipped and says so.
#   None of the containers is privileged or shares the computer's network.
#
# Options
#   --tarball FILE --sig FILE   the release tarball and signature already here (no download);
#                               also from the variables OA_AGENT_TARBALL and OA_AGENT_SIG
#   --deb FILE                  check this package instead of building one
#   --new-node DIR              also try the web proxy with the Node.js in DIR/bin/node (22.21 or
#                               newer, as from nodejs.org); may be given more than once.
#                               Default: the "node" on this computer, when it is such a one.
#   --no-agent-tests            leave out the agent's own test suite (about two minutes a system)
#   --no-firewall               leave out part b
#   --no-systemd                leave out part c
#   --require-systemd           count it as a failure when part c cannot run
#   --log-dir DIR               where the logs go (default: dist/test-logs/deb)
#
# Exit status: 0 when every check that ran passed; 1 when one failed; 2 when
# it was used wrongly or a tool is missing.
#
# Nothing here uses a real radio stick: this computer has none. The checks
# show that the package installs and that the software runs as it should, not
# that a real stick is heard.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source-path=SCRIPTDIR
# shellcheck source=lib.sh
. "$HERE/lib.sh"

usage() { sed -n '2,/^set -euo/p' "${BASH_SOURCE[0]}" | sed '$d' | sed 's/^# \{0,1\}//'; }

# The highest exposure score (systemd-analyze security; 0 closed … 10 open)
# the service may have before a check fails.
MAX_EXPOSURE=2.5

# ═════════════════════════════════════════════════════════════════════════════
# Inside a container
# ═════════════════════════════════════════════════════════════════════════════

T_LOG=/oa/log
SIM=/opt/oa-test                           # the stand-ins: read by the agent, written by root
SIM_DEV=/var/lib/rpi-alert/oa-test-dev     # the pretend /dev: the pretend stick writes in it
SYSTEM_PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
SHARE=/usr/share/open-alert-base
DROPIN=/etc/systemd/system/open-alert-base.service.d/10-low-port.conf
WANTS=/etc/systemd/system/multi-user.target.wants
STUB_PID=''; FRONT_PID=''; PROXY_PID=''
SIM_ENV=()

inside_begin() {
  umask 022
  set -E
  trap 'oa_fail "the check script itself stopped at line $LINENO"' ERR
  export DEBIAN_FRONTEND=noninteractive
  mkdir -p "$T_LOG"
  : "${OA_DEB:?}" "${OA_DISTRO:?}"
}

t_apt() { apt-get -y -o Dpkg::Use-Pty=0 "$@"; }

# Container images tell the package tool to leave out every package's
# documentation (to stay small). A real computer has no such rule: taken away,
# so that the install puts the package's README in place here as it does there.
t_keep_documentation() {
  local f
  for f in /etc/dpkg/dpkg.cfg.d/docker /etc/dpkg/dpkg.cfg.d/excludes; do
    if [ -f "$f" ] && grep -q '^path-exclude' "$f"; then
      rm -f "$f"
      oa_note "removed the container image's $f (it leaves out every package's documentation; a real computer has none)"
    fi
  done
}

t_apt_update() {
  local try
  for try in 1 2 3; do
    if apt-get update > "$T_LOG/apt-update.log" 2>&1; then return 0; fi
    sleep $((try * 10))
  done
  return 1
}

# A value from the agent's settings file ("web.port"), or "(not set)".
t_setting() {
  node -e '
    let v = JSON.parse(require("fs").readFileSync("/etc/rpi-alert/config.json", "utf8"));
    for (const k of process.argv[1].split(".")) v = v == null ? undefined : v[k];
    process.stdout.write(v === undefined ? "(not set)" : typeof v === "string" ? v : JSON.stringify(v));' "$1"
}
# t_settings_are "what" name=value …      one result for the lot.
t_settings_are() {
  local what=$1 pair bad=''; shift
  for pair in "$@"; do
    if [ "$(t_setting "${pair%%=*}")" != "${pair#*=}" ]; then bad="$bad ${pair%%=*} is $(t_setting "${pair%%=*}") (wanted ${pair#*=});"; fi
  done
  if [ -z "$bad" ]; then oa_ok "$what: $*"; else oa_fail "$what —$bad"; fi
}

# Change the agent's settings the way the package itself does: as the agent's
# user, through the agent's own settings code.   t_apply '{"settings": {…}}'
t_apply() {
  printf '%s\n' "$1" > "$SIM/settings.json"
  runuser -u rpi-alert -- node /usr/lib/open-alert-base/settings.js apply "$SIM/settings.json" >> "$T_LOG/settings.log" 2>&1
}

# The stand-ins, as RPi ALERT's own scripts/simulate.sh sets them up: one
# RTL-SDR Blog V4 stick that is not there (pretend /sys entries, and the
# agent's own test stand-in for the rtl_sdr program, which plays a burst with
# two readings — ALERT ids 2088 and 2089 — every few seconds).
t_rig() {
  local d="$SIM/sys/bus/usb/devices/1-1.3"
  mkdir -p "$SIM/bin" "$d"
  echo 0bda > "$d/idVendor"; echo 2838 > "$d/idProduct"; echo 00000001 > "$d/serial"
  echo RTLSDRBlog > "$d/manufacturer"; echo "Blog V4" > "$d/product"; echo 1 > "$d/busnum"; echo 4 > "$d/devnum"
  ln -sf "$OA_AGENT_DIR/test/helpers/fake-rtl_sdr" "$SIM/bin/rtl_sdr"
  install -d -o rpi-alert -g rpi-alert -m 0750 "$SIM_DEV"
  SIM_ENV=("PATH=$SIM/bin:$SYSTEM_PATH" "RPI_ALERT_SYSFS=$SIM/sys" "RPI_ALERT_DEV=$SIM_DEV" "RPI_ALERT_ASSUME_CLOCK=1"
           'RPI_ALERT_FAKE_STICKS={"1-1.3":{"frames":"2088:143,2089:12"}}')
}
SIM_SETTINGS='{"settings":{"name":"Test base","meganet":{"token":"mgn_test_token","endpoints":["http://127.0.0.1:8098/rest/v1"],"stationsUrls":["http://127.0.0.1:8098/stations.json"]},"location":{"source":"manual","lat":-27.4698,"lon":153.0251}}}'

# The Flood-Net stand-in (the agent's own test helper): it prints every call it gets.
t_stub_start() {
  node "$OA_AGENT_DIR/test/helpers/meganet-stub.js" 8098 > "$1" 2>&1 < /dev/null &
  STUB_PID=$!
  oa_wait 15 grep -q ' stub on ' "$1"
}
t_stop_all() {
  local p
  oa_stop_agent
  if id rpi-alert >/dev/null 2>&1; then oa_kill_user rpi-alert; fi
  for p in "$STUB_PID" "$FRONT_PID" "$PROXY_PID"; do
    if [ -n "$p" ]; then kill "$p" 2>/dev/null || true; wait "$p" 2>/dev/null || true; fi
  done
  STUB_PID=''; FRONT_PID=''; PROXY_PID=''
}

# Readings from the pretend stick have reached the stand-in.
t_readings_arrived() { grep -Eq '^ingest_http mgn_test_token .*"alert_id":2088' "$1"; }

# What every run with the stand-ins must show.   t_run_checks "name" PORT STUB_LOG
t_run_checks() {
  local name=$1 port=$2 stub=$3 version
  version=$(oa_pin AGENT_VERSION "$SHARE/PIN")
  if oa_wait 40 oa_http_ok "http://127.0.0.1:$port/"; then oa_ok "$name: the dashboard answers on port $port"
  else oa_fail "$name: the dashboard does not answer on port $port — see $T_LOG"; fi
  if oa_http "http://127.0.0.1:$port/api/status" 2>/dev/null | grep -q "\"version\":\"$version\""; then
    oa_ok "$name: it says it is RPi ALERT $version"
  else oa_fail "$name: /api/status does not say version $version"; fi
  if oa_wait 90 t_readings_arrived "$stub"; then
    oa_ok "$name: readings decoded from the stand-in stick reached the Flood-Net stand-in ($(grep -c '^ingest_http ' "$stub") deliveries so far)"
  else oa_fail "$name: no decoded reading reached the Flood-Net stand-in in 90 seconds — see $stub"; fi
}

# ── part a: install, check, run, remove ──────────────────────────────────────

inside_install() {
  inside_begin
  local version pkg_version log pid got n bad f before after score

  oa_section "$OA_DISTRO: a clean install with apt"
  if ! t_apt_update; then oa_fail "apt-get update (see $T_LOG/apt-update.log)"; exit 1; fi
  t_keep_documentation
  if t_apt install "$OA_DEB" > "$T_LOG/apt-install.log" 2>&1; then
    oa_ok "apt-get install ./$(basename "$OA_DEB") — what it needs came from the system's own packages"
  else
    oa_fail "apt-get install ./$(basename "$OA_DEB") — see $T_LOG/apt-install.log"; tail -n 20 "$T_LOG/apt-install.log"; exit 1
  fi
  version=$(oa_pin AGENT_VERSION "$SHARE/PIN"); pkg_version=$(cat "$SHARE/VERSION")
  oa_note "$(sed -n 's/^PRETTY_NAME="\(.*\)"$/\1/p' /etc/os-release), $(uname -m): Node.js $(node -p process.versions.node), rtl-sdr $(dpkg-query -W -f '${Version}' rtl-sdr), node-undici $(dpkg-query -W -f '${Version}' node-undici 2>/dev/null || echo 'not installed'), nftables $(dpkg-query -W -f '${Version}' nftables 2>/dev/null || echo 'not installed')"
  oa_is "the package database says it is installed" "install ok installed" "$(dpkg-query -W -f '${Status}' open-alert-base)"
  oa_is "its version" "$pkg_version" "$(dpkg-query -W -f '${Version}' open-alert-base)"
  oa_has "the install said what to do next" "$T_LOG/apt-install.log" '^open-alert-base is installed\.'
  oa_check "Node.js is 18.17 or newer" node -e 'const [a, b] = process.versions.node.split(".").map(Number); process.exit(a > 18 || (a === 18 && b >= 17) ? 0 : 1)'
  oa_check "the rtl_sdr program is installed (the system's rtl-sdr package)" command -v rtl_sdr
  oa_check "the rtl_biast program is installed (for a stick's bias tee)" command -v rtl_biast
  if open-alert-base version | grep -q 'knows the RTL-SDR Blog V4'; then
    oa_ok "this system's rtl-sdr library knows the RTL-SDR Blog V4 stick"
  elif [ "$OA_DISTRO" = debian12 ]; then
    oa_note "this system's rtl-sdr library ($(dpkg-query -W -f '${Version}' rtl-sdr)) does NOT know the RTL-SDR Blog V4 stick: on Debian 12 only V3 and generic sticks can work. The package says so (open-alert-base version)."
  else
    oa_fail "this system's rtl-sdr library does not know the RTL-SDR Blog V4 stick"
  fi

  oa_section "$OA_DISTRO: files, owners and modes"
  bad=''; n=0
  while read -r f got; do
    n=$((n + 1))
    if [ "$(stat -c '%U:%G %a' "$f" 2>/dev/null || echo missing)" != "$got" ]; then bad="$bad $f is $(stat -c '%U:%G %a' "$f" 2>/dev/null || echo missing) (wanted $got);"; fi
  done <<'LIST'
/usr/bin/open-alert-base root:root 755
/usr/bin/rpi-alert root:root 755
/usr/lib/open-alert-base root:root 755
/usr/lib/open-alert-base/start root:root 755
/usr/lib/open-alert-base/settings.js root:root 644
/usr/lib/open-alert-base/proxy-preload.js root:root 644
/usr/lib/open-alert-base/agent root:root 755
/usr/lib/open-alert-base/agent/bin/rpi-alert root:root 755
/usr/lib/open-alert-base/agent/package.json root:root 644
/usr/lib/open-alert-base/agent/lib root:root 755
/usr/lib/open-alert-base/agent/vendor root:root 755
/usr/lib/open-alert-base/agent/web root:root 755
/usr/lib/open-alert-base/agent/test root:root 755
/usr/lib/open-alert-base/agent/scripts root:root 755
/usr/lib/systemd/system/open-alert-base.service root:root 644
/usr/lib/systemd/system/open-alert-base-firewall.service root:root 644
/usr/lib/udev/rules.d/60-open-alert-base.rules root:root 644
/usr/lib/modprobe.d/open-alert-base-blacklist-dvb.conf root:root 644
/usr/lib/modules-load.d/open-alert-base.conf root:root 644
/usr/share/open-alert-base/PIN root:root 644
/usr/share/open-alert-base/VERSION root:root 644
/usr/share/open-alert-base/agent.sha256 root:root 644
/usr/share/open-alert-base/rpi-alert-release.pub.pem root:root 644
/usr/share/open-alert-base/profiles/standard.json root:root 644
/usr/share/open-alert-base/profiles/enterprise.json root:root 644
/usr/share/doc/open-alert-base/README root:root 644
/usr/share/doc/open-alert-base/copyright root:root 644
/usr/share/doc/open-alert-base/changelog.gz root:root 644
/etc/open-alert-base/env root:root 640
/etc/open-alert-base/dashboard-local-only.nft root:root 644
/etc/open-alert-base/profile root:root 644
/etc/rpi-alert rpi-alert:rpi-alert 750
/etc/rpi-alert/config.json rpi-alert:rpi-alert 600
/var/lib/rpi-alert rpi-alert:rpi-alert 750
LIST
  if [ -z "$bad" ]; then oa_ok "$n files and folders have the owner and the mode they should (the settings, with the Flood-Net token: the agent's user only)"
  else oa_fail "owners and modes —$bad"; fi
  got=$(find /usr/lib/open-alert-base /usr/share/open-alert-base /usr/bin/open-alert-base /usr/bin/rpi-alert \( ! -user root -o -perm /022 -o -perm /6000 \) ! -type l | head -n 5)
  oa_is "nothing the package installed can be changed by anyone but root, and nothing runs as somebody else (set-user-id)" "" "$got"
  if dpkg --verify open-alert-base > "$T_LOG/dpkg-verify.log" 2>&1 && [ ! -s "$T_LOG/dpkg-verify.log" ]; then
    oa_ok "every installed file is as the package has it (dpkg --verify)"
  else oa_fail "dpkg --verify open-alert-base — $(head -n 3 "$T_LOG/dpkg-verify.log")"; fi
  if (cd "$OA_AGENT_DIR" && find bin lib vendor web test scripts package.json -type f -print0 | LC_ALL=C sort -z | xargs -0 sha256sum) > "$T_LOG/installed-agent.sha256" \
     && diff -q "$T_LOG/installed-agent.sha256" /oa/deb/release-agent.sha256 >/dev/null; then
    oa_ok "the agent is unchanged: $(wc -l < "$T_LOG/installed-agent.sha256") installed files, each with the SHA-256 it has in the signed release"
  else oa_fail "the installed agent differs from the signed release — diff $T_LOG/installed-agent.sha256 with the list made from the tarball"; fi
  got=$(dpkg -L open-alert-base | grep -E 'sudoers|/etc/ssh|journald|/etc/systemd/system/|\.timer$' || true)
  oa_is "the package holds no sudo rule, no SSH setting, no timer, no cap on the system log" "" "$got"
  oa_check_not "no \"alert\" maintenance account was made" id alert

  oa_section "$OA_DISTRO: the agent's user, the service, the first profile"
  got=$(getent passwd rpi-alert | cut -d: -f6,7)
  oa_is "the user rpi-alert: its home folder and no login shell" "/var/lib/rpi-alert:/usr/sbin/nologin" "$got"
  if [ "$(id -u rpi-alert)" -lt 1000 ]; then oa_ok "it is a system account (id $(id -u rpi-alert))"; else oa_fail "rpi-alert is not a system account (id $(id -u rpi-alert))"; fi
  got=$(id -Gn rpi-alert | tr ' ' '\n' | sort | tr '\n' ' ')
  oa_is "its groups" "dialout plugdev rpi-alert " "$got"
  case "$(passwd -S rpi-alert | awk '{print $2}')" in L|LK) oa_ok "no password can be typed for it (locked)" ;; *) oa_fail "the rpi-alert account's password is not locked: $(passwd -S rpi-alert)" ;; esac
  oa_check "the service is set to start with the computer" test -L "$WANTS/open-alert-base.service"
  oa_is "the profile in force after a first install" "standard" "$(cat /etc/open-alert-base/profile)"
  t_settings_are "the standard profile's settings" web.port=80 "web.bind=(not set)" remote.mode=manage hotspot.mode=off recover.mode=off kiosk.mode=off audio.mode=off
  oa_has "standard: a drop-in file gives the service the one privilege for port 80" "$DROPIN" '^AmbientCapabilities=CAP_NET_BIND_SERVICE$'
  oa_is "standard: and no other privilege" "CAP_NET_BIND_SERVICE" "$(oa_unit_values CapabilityBoundingSet | tr '\n' ' ' | sed 's/ $//')"
  oa_check_not "standard: the firewall lock is not turned on" test -e "$WANTS/open-alert-base-firewall.service"
  oa_is "the service file points the agent's root helper at a path that does not exist" "missing" \
    "$(p=$(oa_unit_values Environment | tr ' ' '\n' | sed -n 's/^RPI_ALERT_PRIV=//p'); if [ -n "$p" ] && [ ! -e "$p" ]; then echo missing; else echo "there: $p"; fi)"

  oa_section "$OA_DISTRO: the two commands"
  open-alert-base version > "$T_LOG/version.txt" 2>&1 || true
  oa_has "open-alert-base version names the package, the release, its hash and the key" "$T_LOG/version.txt" "^open-alert-base $(printf '%s' "$pkg_version" | sed 's/[+.]/\\&/g')\$"
  oa_has "… the signed release" "$T_LOG/version.txt" "signed release $(oa_pin AGENT_TAG "$SHARE/PIN")"
  oa_has "… the tarball's hash" "$T_LOG/version.txt" "$(oa_pin AGENT_SHA256 "$SHARE/PIN")"
  if open-alert-base audit > "$T_LOG/audit-standard.txt" 2>&1; then oa_ok "open-alert-base audit runs"; else oa_fail "open-alert-base audit — see $T_LOG/audit-standard.txt"; fi
  oa_has "audit: no root helper" "$T_LOG/audit-standard.txt" 'root helper: none'
  oa_has "audit: no sudo rule names the agent's user" "$T_LOG/audit-standard.txt" 'sudo rules naming rpi-alert: none'
  oa_has "audit: the agent's files match the signed release" "$T_LOG/audit-standard.txt" 'each the same as in the signed release'
  oa_has "audit (standard): one privilege" "$T_LOG/audit-standard.txt" 'Privileges: one\.'
  oa_has_not "audit: nothing of RPi ALERT's Raspberry Pi installer is present" "$T_LOG/audit-standard.txt" '^ +PRESENT'
  oa_has "audit says what has not been tested" "$T_LOG/audit-standard.txt" 'has not been run with a real radio stick'
  oa_has "audit: the Node.js it runs is the operating system's own package" "$T_LOG/audit-standard.txt" "Node\\.js +[0-9.]+ \\(/usr/bin/node\\), from the operating system's package nodejs"
  if [ -f /usr/lib/open-alert-base/bench/open-alert-bench.js ]; then
    if open-alert-base bench --help > "$T_LOG/bench-help.txt" 2>&1 && grep -q 'open-alert-bench' "$T_LOG/bench-help.txt"; then oa_ok "open-alert-base bench finds the benchmark built into the package (asked for its help only; the benchmark has its own checks)"
    else oa_fail "open-alert-base bench --help — see $T_LOG/bench-help.txt"; fi
  else
    got=0; open-alert-base bench > "$T_LOG/bench-help.txt" 2>&1 || got=$?
    oa_is "open-alert-base bench, with no benchmark in this package: says where to get it, and exit status 1" 1 "$got"
  fi
  oa_check "open-alert-base status runs with the agent stopped" open-alert-base status
  oa_check "open-alert-base profile lists the profiles" bash -c 'open-alert-base profile | grep -q "^  enterprise$" && open-alert-base profile | grep -q "^  standard$"'
  oa_is "rpi-alert version (the agent's own command)" "$version" "$(rpi-alert version 2>/dev/null | grep -Eo '[0-9]+\.[0-9]+\.[0-9]+' | head -n 1)"
  for f in daemon access import-boot-config; do
    got=0; rpi-alert "$f" > /dev/null 2>&1 || got=$?
    oa_is "rpi-alert $f is turned away (it belongs to the Raspberry Pi install)" 2 "$got"
  done
  got=0; open-alert-base no-such-command > /dev/null 2>&1 || got=$?
  oa_is "an unknown command is refused" 2 "$got"
  got=0; setpriv --reuid nobody --regid nogroup --clear-groups open-alert-base profile enterprise > "$T_LOG/profile-as-nobody.txt" 2>&1 || got=$?
  if [ "$got" != 0 ] && grep -q 'administrator' "$T_LOG/profile-as-nobody.txt"; then oa_ok "an ordinary user cannot change the profile"; else oa_fail "an ordinary user changing the profile: exit $got"; fi

  oa_section "$OA_DISTRO: how the web proxy is handed to Node.js (the start command, with a stand-in for Node.js)"
  t_start_wrapper_checks

  if [ "${OA_AGENT_TESTS:-1}" = 1 ]; then
    oa_section "$OA_DISTRO: the agent's own test suite, from the installed files, as the service's user"
    # socat and an SSH server: three of the agent's tests use them and skip themselves without.
    if t_apt install socat openssh-server > "$T_LOG/apt-test-tools.log" 2>&1; then mkdir -p /run/sshd
    else oa_note "socat and openssh-server could not be installed: three of the agent's tests will skip themselves"; fi
    got=0; open-alert-base selftest > "$T_LOG/selftest.txt" 2>&1 || got=$?
    log=$(sed -n 's/^ *full output: //p' "$T_LOG/selftest.txt"); if [ -n "$log" ] && [ -f "$log" ]; then cp "$log" "$T_LOG/agent-tests.tap"; fi
    n=$(grep -Eo 'tests [0-9]+, pass [0-9]+, fail [0-9]+, skipped [0-9]+' "$T_LOG/selftest.txt" || echo 'no count')
    if [ "$got" = 0 ] && grep -q 'fail 0' "$T_LOG/selftest.txt"; then oa_ok "open-alert-base selftest: $n (one test file is left out: it tests RPi ALERT's root helper, which this package does not install)"
    else oa_fail "open-alert-base selftest (exit $got): $n — see $T_LOG/selftest.txt and agent-tests.tap"; fi
    if grep -q '# SKIP' "$T_LOG/agent-tests.tap" 2>/dev/null; then oa_note "skipped by the agent's suite: $(grep '# SKIP' "$T_LOG/agent-tests.tap" | sed 's/^ok [0-9]* - //' | tr '\n' ';')"; fi
  else
    oa_skip "the agent's own test suite — left out (--no-agent-tests)"
  fi

  oa_section "$OA_DISTRO: the standard profile, started as the service would start it, with stand-ins for a stick and for Flood-Net"
  t_rig
  t_apply "$SIM_SETTINGS"
  t_stub_start "$T_LOG/stub-standard.log"
  oa_run_as_unit "$T_LOG/agent-standard.log" "${SIM_ENV[@]}"
  t_run_checks "standard" 80 "$T_LOG/stub-standard.log"
  pid=$(oa_agent_node_pid || true)
  if [ -n "$pid" ]; then
    oa_is "standard: it runs as the user rpi-alert" "$(id -u rpi-alert)" "$(oa_proc_status "$pid" Uid | awk '{print $2}')"
    oa_is "standard: its only privilege is the one for a low port (CAP_NET_BIND_SERVICE)" "0000000000000400" "$(oa_proc_status "$pid" CapEff)"
    oa_is "standard: and it can never get another" "0000000000000400" "$(oa_proc_status "$pid" CapBnd)"
    oa_is "standard: no-new-privileges is on" "1" "$(oa_proc_status "$pid" NoNewPrivs)"
  else oa_fail "standard: the agent's process was not found"; fi
  oa_is "standard: the only port the agent's user listens on" "80" "$(oa_listening rpi-alert | awk '{print $1}' | sort -u | tr '\n' ' ' | sed 's/ $//')"
  oa_has_not "standard: nothing was said about a web proxy, and nothing loaded for one (none is set)" "$T_LOG/agent-standard.log" 'proxy'
  if rpi-alert status > "$T_LOG/rpi-alert-status.txt" 2>&1 && grep -q "RPi ALERT $version" "$T_LOG/rpi-alert-status.txt"; then oa_ok "standard: \"rpi-alert status\" finds the running agent"
  else oa_fail "standard: rpi-alert status — see $T_LOG/rpi-alert-status.txt"; fi
  open-alert-base audit > "$T_LOG/audit-standard-running.txt" 2>&1 || true
  oa_has "standard: audit shows what listens" "$T_LOG/audit-standard-running.txt" 'TCP port 80 on every address'
  oa_has "standard: audit shows the running process's privileges, read from the kernel" "$T_LOG/audit-standard-running.txt" 'privileges in use +one: CAP_NET_BIND_SERVICE'
  oa_has "standard: audit shows where the agent calls out to, and says so when it is not HTTPS (the stand-in is plain http)" "$T_LOG/audit-standard-running.txt" 'NOT ALL OVER HTTPS'
  f=$(stat -c '%U:%G %a' /etc/rpi-alert/config.json)
  oa_is "the settings file, after the agent has written it: still the agent's alone" "rpi-alert:rpi-alert 600" "$f"
  got=$(find /var/lib/rpi-alert -maxdepth 1 -type f \( -perm /077 -o ! -user rpi-alert \) | head -n 3)
  oa_is "what the agent wrote in its data folder is readable by it alone" "" "$got"
  t_stop_all

  # The same service without its drop-in file: port 80 must be refused, which
  # shows the privilege comes from that file and from nowhere else.
  if [ "$(cat /proc/sys/net/ipv4/ip_unprivileged_port_start 2>/dev/null || echo 0)" = 1024 ]; then
    mv "$DROPIN" "$SIM/dropin.aside"
    t_stub_start "$T_LOG/stub-nodropin.log"
    oa_run_as_unit "$T_LOG/agent-nodropin.log" "${SIM_ENV[@]}"
    if oa_wait 40 grep -q 'cannot listen on port 80 (EACCES)' "$T_LOG/agent-nodropin.log"; then
      oa_ok "without the drop-in file the same service is refused port 80 (the agent falls back to 8080): the privilege comes from that file alone"
    else oa_fail "without the drop-in file the agent was not refused port 80 — see $T_LOG/agent-nodropin.log"; fi
    t_stop_all
    mkdir -p "$(dirname "$DROPIN")"; mv "$SIM/dropin.aside" "$DROPIN"
  else
    oa_skip "port 80 refused without the drop-in file — this container lets any user open low ports, so it would show nothing"
  fi

  oa_section "$OA_DISTRO: the enterprise profile"
  got=0; open-alert-base profile enterprise > "$T_LOG/profile-enterprise.txt" 2>&1 || got=$?
  oa_is "open-alert-base profile enterprise" 0 "$got"
  oa_is "the profile in force" "enterprise" "$(cat /etc/open-alert-base/profile)"
  t_settings_are "the enterprise profile's settings" web.port=8080 web.bind=127.0.0.1 remote.mode=report hotspot.mode=off recover.mode=off kiosk.mode=off audio.mode=off
  t_settings_are "a profile changes only what it names: the token and the name set before are still there" meganet.token=mgn_test_token "name=Test base"
  oa_check_not "enterprise: the drop-in file with the privilege is gone" test -e "$DROPIN"
  oa_is "enterprise: the service file gives no privilege at all" "" "$(oa_unit_values CapabilityBoundingSet; oa_unit_values AmbientCapabilities)"
  oa_check "enterprise: the firewall lock is set to load when the computer starts" test -L "$WANTS/open-alert-base-firewall.service"
  open-alert-base audit > "$T_LOG/audit-enterprise.txt" 2>&1 || true
  oa_has "audit (enterprise): no privileges at all" "$T_LOG/audit-enterprise.txt" 'Privileges: none at all'
  oa_has "audit (enterprise): Flood-Net can change nothing" "$T_LOG/audit-enterprise.txt" 'remote management +report'
  t_stub_start "$T_LOG/stub-enterprise.log"
  oa_run_as_unit "$T_LOG/agent-enterprise.log" "${SIM_ENV[@]}"
  t_run_checks "enterprise" 8080 "$T_LOG/stub-enterprise.log"
  pid=$(oa_agent_node_pid || true)
  if [ -n "$pid" ]; then
    oa_is "enterprise: it holds no privilege (in use, inheritable, ambient)" "0000000000000000 0000000000000000 0000000000000000" \
      "$(oa_proc_status "$pid" CapEff) $(oa_proc_status "$pid" CapInh) $(oa_proc_status "$pid" CapAmb)"
    oa_is "enterprise: and can never get one" "0000000000000000" "$(oa_proc_status "$pid" CapBnd)"
    oa_is "enterprise: no-new-privileges is on" "1" "$(oa_proc_status "$pid" NoNewPrivs)"
  else oa_fail "enterprise: the agent's process was not found"; fi
  if oa_wait 60 grep -Eq '^base_station_checkin mgn_test_token .*"mode":"report"' "$T_LOG/stub-enterprise.log"; then
    oa_ok "enterprise: it checks in with Flood-Net as \"report\" (health only)"
  else oa_fail "enterprise: no check-in in \"report\" mode reached the stand-in"; fi
  # The agent rewrites its settings file when a setting changes: web.bind, which this agent does not know, must survive that.
  if RPI_ALERT_PORT=8080 rpi-alert config set name "Renamed base" > "$T_LOG/config-set.txt" 2>&1; then
    t_settings_are "enterprise: web.bind is still in the settings after the agent rewrote its file (it keeps a setting it does not know)" "name=Renamed base" web.bind=127.0.0.1
  else oa_fail "rpi-alert config set name … — see $T_LOG/config-set.txt"; fi
  got=$(oa_listening rpi-alert | sort -u | tr '\n' ';')
  open-alert-base audit > "$T_LOG/audit-enterprise-running.txt" 2>&1 || true
  case "$got" in
    "8080 0100007F;"|"8080 00000000000000000000000001000000;"|"8080 0000000000000000FFFF00000100007F;")
      oa_ok "enterprise: the agent listens on this computer's own address only ($got) — this agent takes notice of web.bind"
      oa_has "enterprise: audit says so" "$T_LOG/audit-enterprise-running.txt" 'dashboard reach +this computer only — the agent listens' ;;
    "8080 00000000;"|"8080 00000000000000000000000000000000;")
      oa_ok "enterprise: one port, 8080"
      oa_note "RPi ALERT $version takes no notice of web.bind and listens on every address ($got): until the pin moves to 0.24, the firewall rules are what keeps other computers out (part b)"
      oa_has "enterprise: with the firewall lock not on (this container may not load it), audit says plainly that the dashboard is NOT kept to this computer" "$T_LOG/audit-enterprise-running.txt" 'dashboard reach +NOT KEPT TO THIS COMPUTER' ;;
    *) oa_fail "enterprise: the agent's user listens on: $got (wanted port 8080 only)" ;;
  esac
  t_stop_all

  oa_section "$OA_DISTRO: back to the standard profile"
  got=0; open-alert-base profile standard > "$T_LOG/profile-standard.txt" 2>&1 || got=$?
  oa_is "open-alert-base profile standard" 0 "$got"
  t_settings_are "the standard profile's settings again" web.port=80 "web.bind=(not set)" remote.mode=manage
  oa_has "the drop-in file is back" "$DROPIN" '^CapabilityBoundingSet=CAP_NET_BIND_SERVICE$'
  oa_check_not "the firewall lock is turned off again" test -e "$WANTS/open-alert-base-firewall.service"
  got=0; open-alert-base profile no-such > /dev/null 2>&1 || got=$?
  oa_is "a profile that does not exist is refused" 1 "$got"
  # Changing the port by hand, then "sync": the privilege follows the port.
  t_apply '{"settings":{"web":{"port":8080}}}'
  open-alert-base sync > "$T_LOG/sync.txt" 2>&1 || true
  oa_check_not "open-alert-base sync: the port moved to 8080 by hand, so the privilege is taken away" test -e "$DROPIN"
  t_apply '{"settings":{"web":{"port":80}}}'
  open-alert-base sync >> "$T_LOG/sync.txt" 2>&1 || true
  oa_check "open-alert-base sync: back on port 80, the privilege is given again" test -f "$DROPIN"

  oa_section "$OA_DISTRO: through a web proxy, with a private certificate authority"
  t_proxy_checks

  oa_section "$OA_DISTRO: remove, reinstall, purge"
  before=$(sha256sum /etc/rpi-alert/config.json | awk '{print $1}')
  if t_apt remove open-alert-base > "$T_LOG/apt-remove.log" 2>&1; then oa_ok "apt-get remove open-alert-base"; else oa_fail "apt-get remove — see $T_LOG/apt-remove.log"; fi
  oa_is "remove: the package database says removed, settings kept" "deinstall ok config-files" "$(dpkg-query -W -f '${Status}' open-alert-base 2>/dev/null)"
  got=$(ls -d /usr/lib/open-alert-base /usr/share/open-alert-base /usr/bin/open-alert-base /usr/bin/rpi-alert /usr/lib/systemd/system/open-alert-base.service /usr/lib/udev/rules.d/60-open-alert-base.rules 2>/dev/null || true)
  oa_is "remove: the program, the service file and the device rules are gone" "" "$got"
  oa_is "remove: the agent's settings are kept, untouched" "$before" "$(sha256sum /etc/rpi-alert/config.json | awk '{print $1}')"
  oa_check "remove: the data folder is kept" test -d /var/lib/rpi-alert
  oa_check "remove: the agent's user is kept" id rpi-alert
  oa_check "remove: /etc/open-alert-base/env is kept" test -f /etc/open-alert-base/env
  if t_apt install "$OA_DEB" > "$T_LOG/apt-reinstall.log" 2>&1; then oa_ok "install again"; else oa_fail "install again — see $T_LOG/apt-reinstall.log"; fi
  oa_has_not "reinstall: no profile was applied over the settings that were kept" "$T_LOG/apt-reinstall.log" 'Settings file .* made|Settings changed'
  after=$(sha256sum /etc/rpi-alert/config.json | awk '{print $1}')
  oa_is "reinstall: the settings file is byte for byte what it was" "$before" "$after"
  oa_check "reinstall: the service is set to start with the computer again" test -L "$WANTS/open-alert-base.service"
  oa_check "reinstall: the privilege for port 80 is still as the settings ask" test -f "$DROPIN"
  if t_apt purge open-alert-base > "$T_LOG/apt-purge.log" 2>&1; then oa_ok "apt-get purge open-alert-base"; else oa_fail "apt-get purge — see $T_LOG/apt-purge.log"; fi
  got=$(ls -d /etc/rpi-alert /var/lib/rpi-alert /etc/open-alert-base /etc/systemd/system/open-alert-base.service.d \
        "$WANTS/open-alert-base.service" "$WANTS/open-alert-base-firewall.service" /etc/systemd/system/open-alert-base.service \
        /etc/systemd/system/open-alert-base-firewall.service /usr/lib/open-alert-base /usr/share/open-alert-base 2>/dev/null || true)
  oa_is "purge: settings, data, the profile, the drop-in file and the start-up links are all gone" "" "$got"
  oa_check_not "purge: the agent's user is gone" id rpi-alert
  oa_check_not "purge: its group is gone" getent group rpi-alert
  oa_check_not "purge: the package database no longer knows the package" dpkg-query -W open-alert-base

  oa_section "$OA_DISTRO: it refuses to install beside RPi ALERT's own install"
  mkdir -p /opt/rpi-alert
  got=0; t_apt install "$OA_DEB" > "$T_LOG/apt-refused-1.log" 2>&1 || got=$?
  if [ "$got" != 0 ] && grep -q 'open-alert-base cannot be installed on this computer as it is' "$T_LOG/apt-refused-1.log" && grep -q 'found: /opt/rpi-alert' "$T_LOG/apt-refused-1.log"; then
    oa_ok "with /opt/rpi-alert present the install is refused, with a plain message"
  else oa_fail "with /opt/rpi-alert present: exit $got — see $T_LOG/apt-refused-1.log"; fi
  oa_check_not "… and nothing of the package was put in place" test -e /usr/lib/open-alert-base/start
  rmdir /opt/rpi-alert; dpkg --purge open-alert-base > /dev/null 2>&1 || true
  touch /etc/systemd/system/rpi-alert.service
  got=0; t_apt install "$OA_DEB" > "$T_LOG/apt-refused-2.log" 2>&1 || got=$?
  if [ "$got" != 0 ] && grep -q 'found: /etc/systemd/system/rpi-alert.service' "$T_LOG/apt-refused-2.log"; then
    oa_ok "with an rpi-alert.service present the install is refused"
  else oa_fail "with rpi-alert.service present: exit $got — see $T_LOG/apt-refused-2.log"; fi
  rm -f /etc/systemd/system/rpi-alert.service; dpkg --purge open-alert-base > /dev/null 2>&1 || true

  oa_section "$OA_DISTRO: a first install told to start locked down"
  got=0; OPEN_ALERT_BASE_PROFILE=enterprise apt-get -y -o Dpkg::Use-Pty=0 install "$OA_DEB" > "$T_LOG/apt-install-enterprise.log" 2>&1 || got=$?
  oa_is "install with OPEN_ALERT_BASE_PROFILE=enterprise" 0 "$got"
  oa_is "the profile in force" "enterprise" "$(cat /etc/open-alert-base/profile 2>/dev/null)"
  t_settings_are "its settings" web.port=8080 web.bind=127.0.0.1 remote.mode=report recover.mode=off hotspot.mode=off
  oa_check_not "no privilege was ever given" test -e "$DROPIN"

  oa_section "$OA_DISTRO: systemd's own checker and exposure score for the service file (0 is the most closed, 10 the most open)"
  if command -v systemd-analyze >/dev/null 2>&1 || t_apt install systemd > "$T_LOG/apt-systemd.log" 2>&1; then
    oa_note "systemd $(systemd-analyze --version | awk 'NR == 1 {print $2}')"
    for f in open-alert-base.service open-alert-base-firewall.service; do
      got=0; systemd-analyze verify "/usr/lib/systemd/system/$f" > "$T_LOG/verify-$f.txt" 2>&1 || got=$?
      if [ "$got" = 0 ] && ! grep -q 'open-alert-base' "$T_LOG/verify-$f.txt"; then oa_ok "systemd-analyze verify $f: nothing to report"
      else oa_fail "systemd-analyze verify $f (exit $got): $(grep 'open-alert-base' "$T_LOG/verify-$f.txt" | head -n 3)"; fi
    done
    t_score "enterprise profile (no privilege)" "$T_LOG/security-enterprise.txt"
    open-alert-base profile standard > /dev/null 2>&1 || true
    t_score "standard profile (the one privilege for port 80)" "$T_LOG/security-standard.txt"
    systemd-analyze security --offline=yes --no-pager /usr/lib/systemd/system/open-alert-base-firewall.service > "$T_LOG/security-firewall.txt" 2>&1 || true
    score=$(sed -n 's/.*Overall exposure level for [^:]*: *\([0-9.]*\).*/\1/p' "$T_LOG/security-firewall.txt" | tail -n 1)
    oa_note "exposure score of the firewall service (it runs for a moment as root to load the rules, then exits): ${score:-unknown}"
  else
    oa_skip "systemd-analyze — the systemd package could not be installed in this container"
  fi

  # udev is the part of the system that sets who may open a device when it is
  # plugged in. No real udev runs in a container, so the rules are only read
  # by its checker here; they are not tried on a device.
  oa_section "$OA_DISTRO: udev's own checker for the device rules"
  if command -v udevadm >/dev/null 2>&1 || t_apt install --no-install-recommends udev > "$T_LOG/apt-udev.log" 2>&1; then
    if udevadm verify --help > /dev/null 2>&1; then
      got=0; udevadm verify /usr/lib/udev/rules.d/60-open-alert-base.rules > "$T_LOG/udev-verify.txt" 2>&1 || got=$?
      if [ "$got" = 0 ]; then oa_ok "udevadm verify (udev $(udevadm --version)): the device rules read without a complaint"
      else oa_fail "udevadm verify (exit $got): $(head -n 3 "$T_LOG/udev-verify.txt" | tr '\n' ' ')"; fi
    else
      oa_skip "udev's checker for the device rules — this system's udev ($(udevadm --version)) has none (it came with udev 254)"
    fi
  else
    oa_skip "udev's checker for the device rules — the udev package could not be installed in this container"
  fi
  trap - ERR
}

# One exposure score, recorded and held to the limit.   t_score "which" FILE
t_score() {
  local score
  systemd-analyze security --offline=yes --no-pager open-alert-base.service > "$2" 2>&1 || true
  score=$(sed -n 's/.*Overall exposure level for [^:]*: *\([0-9.]*\).*/\1/p' "$2" | tail -n 1)
  if [ -n "$score" ] && awk -v s="$score" -v m="$MAX_EXPOSURE" 'BEGIN { exit !(s <= m) }'; then
    oa_ok "exposure score, $1: $score (the limit set in this check is $MAX_EXPOSURE)"
  else oa_fail "exposure score, $1: ${score:-none given} (the limit set in this check is $MAX_EXPOSURE) — see $2"; fi
}

# The start command decides how a proxy is handed to Node.js from Node's
# version alone. A stand-in for Node.js says which version it is, then shows
# what it was started with.
t_start_wrapper_checks() {
  local fake="$SIM/fake-node" out="$T_LOG/start-wrapper.txt" v want got start=/usr/lib/open-alert-base/start bad='' want_options want_own
  mkdir -p "$SIM"
  cat > "$fake" <<'FAKE'
#!/bin/bash
if [ "${1:-}" = -p ]; then echo "$FAKE_NODE_VERSION"; exit 0; fi
echo "ARGS=$*"
echo "NODE_OPTIONS=${NODE_OPTIONS:-}"
echo "NODE_USE_ENV_PROXY=${NODE_USE_ENV_PROXY:-}"
echo "HTTPS_PROXY=${HTTPS_PROXY:-} https_proxy=${https_proxy:-} NO_PROXY=${NO_PROXY:-} no_proxy=${no_proxy:-}"
FAKE
  chmod 0755 "$fake"
  run() { setpriv --reuid nobody --regid nogroup --clear-groups env -i "PATH=$SYSTEM_PATH" "OPEN_ALERT_BASE_NODE=$SIM/fake-node" "$@" /usr/lib/open-alert-base/start 2>&1; }

  got=$(run FAKE_NODE_VERSION=20.19.2)
  oa_is "no proxy set: Node.js is started with nothing added" \
    "ARGS=/usr/lib/open-alert-base/agent/bin/rpi-alert daemon|NODE_OPTIONS=|NODE_USE_ENV_PROXY=|HTTPS_PROXY= https_proxy= NO_PROXY= no_proxy=" "$(printf '%s' "$got" | tr '\n' '|')"
  : > "$out"
  for v in 18.19.1:preload 20.19.2:preload 22.20.0:preload 22.21.0:own 22.23.4:own 23.11.0:preload 24.0.0:own 26.1.0:own; do
    want=${v#*:}; v=${v%%:*}
    got=$(run "FAKE_NODE_VERSION=$v" HTTPS_PROXY=http://proxy.example:3128 NO_PROXY=localhost)
    printf '── Node.js %s\n%s\n' "$v" "$got" >> "$out"
    case "$want" in
      preload) want_options='NODE_OPTIONS=--require=/usr/lib/open-alert-base/proxy-preload.js'; want_own='NODE_USE_ENV_PROXY=' ;;
      *)       want_options='NODE_OPTIONS='; want_own='NODE_USE_ENV_PROXY=1' ;;
    esac
    if ! printf '%s\n' "$got" | grep -qx "$want_options" || ! printf '%s\n' "$got" | grep -qx "$want_own"; then bad="$bad $v"; fi
    if ! printf '%s\n' "$got" | grep -qx 'HTTPS_PROXY=http://proxy.example:3128 https_proxy=http://proxy.example:3128 NO_PROXY=localhost no_proxy=localhost'; then bad="$bad $v(variables)"; fi
  done
  oa_is "a proxy set: Node.js 18, 20, 22.20 and 23 get the start-up file; 22.21, 22.23, 24 and 26 are told to read the proxy settings themselves" "" "$bad"
  got=$(run FAKE_NODE_VERSION=20.19.2 https_proxy=http://someone:hunter2@proxy.example:3128)
  if printf '%s\n' "$got" | grep -q 'through the web proxy http://(name and password)@proxy.example:3128' && ! printf '%s\n' "$got" | grep 'through the web proxy' | grep -q hunter2; then
    oa_ok "a name and password in the proxy's address are kept out of the log line"
  else oa_fail "the proxy's name and password in the log line: $(printf '%s\n' "$got" | grep 'through the web proxy')"; fi
  got=0; setpriv --reuid nobody --regid nogroup --clear-groups env -i "PATH=$SYSTEM_PATH" OPEN_ALERT_BASE_NODE=/nonexistent/node "$start" > /dev/null 2>&1 || got=$?
  oa_is "no Node.js at the path given: a plain message and exit status 78 (\"not set up\")" 78 "$got"
}

# The proxy rig: a private certificate authority, an HTTPS front for the
# Flood-Net stand-in under two names — flood.test, which nothing can find
# except through the proxy, and direct.test, which is this computer — and a
# tiny web proxy (CONNECT only) that says who asked for what.
t_proxy_rig() {
  local d="$SIM/tls"
  mkdir -p "$d"
  if [ ! -f "$d/srv.crt" ]; then
    (
      cd "$d"
      openssl req -x509 -newkey rsa:2048 -nodes -keyout ca.key -out ca.crt -days 3 -subj "/CN=open-ALERT test authority"
      openssl req -newkey rsa:2048 -nodes -keyout srv.key -out srv.csr -subj "/CN=flood.test"
      printf 'subjectAltName=DNS:flood.test,DNS:direct.test\nbasicConstraints=CA:FALSE\nextendedKeyUsage=serverAuth\n' > ext
      openssl x509 -req -in srv.csr -CA ca.crt -CAkey ca.key -CAcreateserial -out srv.crt -days 3 -extfile ext
      chmod 0644 ca.crt srv.crt; chmod 0600 ca.key srv.key
    ) > "$T_LOG/proxy-openssl.log" 2>&1
    # The operating system's own way of trusting a private authority.
    cp "$d/ca.crt" /usr/local/share/ca-certificates/oa-test-authority.crt
    update-ca-certificates >> "$T_LOG/proxy-openssl.log" 2>&1
    grep -q ' direct\.test$' /etc/hosts || echo '127.0.0.1 direct.test' >> /etc/hosts
  fi
  cat > "$SIM/tls-front.js" <<'JS'
// HTTPS in front of the Flood-Net stand-in: says what was asked, under which name, and passes it on.
const https = require('node:https'), http = require('node:http'), fs = require('node:fs');
const [port, key, cert, toPort] = process.argv.slice(2);
https.createServer({ key: fs.readFileSync(key), cert: fs.readFileSync(cert) }, (req, res) => {
  console.log(req.method + ' ' + req.url + ' host=' + req.headers.host);
  const up = http.request({ host: '127.0.0.1', port: Number(toPort), method: req.method, path: req.url, headers: req.headers }, (r) => { res.writeHead(r.statusCode, r.headers); r.pipe(res); });
  up.on('error', () => { res.writeHead(502); res.end(); });
  req.pipe(up);
}).listen(Number(port), '127.0.0.1', () => console.log('front up'));
JS
  cat > "$SIM/connect-proxy.js" <<'JS'
// A web proxy that only tunnels (CONNECT), to one name, and says who asked.
const http = require('node:http'), net = require('node:net');
const [port, name, toPort, user, pass] = process.argv.slice(2);
const want = user ? 'Basic ' + Buffer.from(user + ':' + pass).toString('base64') : '';
const s = http.createServer((req, res) => { console.log('PLAIN ' + req.method + ' ' + req.url); res.writeHead(405); res.end(); });
s.on('connect', (req, sock, head) => {
  const auth = req.headers['proxy-authorization'] || '';
  console.log('CONNECT ' + req.url + ' auth=' + (!auth ? 'none' : auth === want ? 'good' : 'other'));
  if (want && auth !== want) { sock.end('HTTP/1.1 407 Proxy Authentication Required\r\nProxy-Authenticate: Basic realm="test"\r\n\r\n'); return; }
  if (req.url !== name + ':443') { sock.end('HTTP/1.1 403 Forbidden\r\n\r\n'); return; }
  const up = net.connect(Number(toPort), '127.0.0.1', () => { sock.write('HTTP/1.1 200 Connection Established\r\n\r\n'); up.write(head); up.pipe(sock); sock.pipe(up); });
  up.on('error', () => sock.destroy()); sock.on('error', () => up.destroy());
});
s.listen(Number(port), '127.0.0.1', () => console.log('proxy up'));
JS
}

# One run through the proxy.   t_proxy_run NAME "what Node" NODE-PATH-or-empty USER PASSWORD
t_proxy_run() {
  local name=$1 what=$2 node_path=$3 user=$4 pass=$5 cred='' alog="$T_LOG/agent-proxy-$1.log" plog="$T_LOG/proxy-$1.log" flog="$T_LOG/front-$1.log" slog="$T_LOG/stub-proxy-$1.log" extra=()
  cp -p "$SIM/env.pristine" /etc/open-alert-base/env
  if [ -n "$user" ]; then cred="$user:$pass@"; fi
  {
    echo "HTTPS_PROXY=http://${cred}127.0.0.1:3128"
    echo "NO_PROXY=direct.test,localhost,127.0.0.1"
    if [ -n "$node_path" ]; then
      echo "OPEN_ALERT_BASE_NODE=$node_path"
      # A Node.js from nodejs.org does not read the operating system's certificate list.
      echo "NODE_EXTRA_CA_CERTS=/usr/local/share/ca-certificates/oa-test-authority.crt"
    fi
  } >> /etc/open-alert-base/env
  # The agent fetches the station list once a day and keeps a copy: without
  # the copy it fetches it five seconds after it starts.
  rm -f /var/lib/rpi-alert/stations-index.json
  t_stub_start "$slog"
  node "$SIM/tls-front.js" 443 "$SIM/tls/srv.key" "$SIM/tls/srv.crt" 8098 > "$flog" 2>&1 < /dev/null &
  FRONT_PID=$!
  if [ -n "$user" ]; then extra=("$user" "$pass"); fi
  node "$SIM/connect-proxy.js" 3128 flood.test 443 "${extra[@]}" > "$plog" 2>&1 < /dev/null &
  PROXY_PID=$!
  oa_wait 15 grep -q 'front up' "$flog" || true; oa_wait 15 grep -q 'proxy up' "$plog" || true
  oa_run_as_unit "$alog" "${SIM_ENV[@]}"
  if oa_wait 90 t_readings_arrived "$slog"; then
    oa_ok "$what: readings reached the Flood-Net stand-in, which can only be reached through the proxy"
  else oa_fail "$what: no reading reached the stand-in through the proxy in 90 seconds — see $alog"; fi
  if [ -n "$user" ]; then oa_has "$what: the proxy was given the right name and password" "$plog" '^CONNECT flood\.test:443 auth=good$'
  else oa_has "$what: the proxy was asked for a tunnel to flood.test" "$plog" '^CONNECT flood\.test:443 auth=none$'; fi
  oa_has "$what: the readings went through the HTTPS front under the name flood.test (the private authority is trusted)" "$flog" '^POST /rest/v1/rpc/ingest_http host=flood\.test$'
  if oa_wait 30 grep -q '^GET /stations.json host=direct\.test$' "$flog"; then
    oa_ok "$what: NO_PROXY is honoured — the station list (direct.test) was fetched without the proxy"
  else oa_fail "$what: the station list was not fetched from direct.test — see $flog"; fi
  oa_has_not "$what: … and the proxy never heard of direct.test" "$plog" 'direct\.test'
  if [ -n "$node_path" ]; then oa_has "$what: the start command told Node.js to read the proxy settings itself" "$alog" 'reads the proxy settings itself'
  else oa_has "$what: the start command loaded the start-up file" "$alog" 'proxy-preload\.js loaded first'; fi
  if [ -n "$pass" ]; then oa_has_not "$what: the proxy's password is not in the agent's log" "$alog" "$pass"; fi
  open-alert-base audit > "$T_LOG/audit-proxy-$name.txt" 2>&1 || true
  oa_has "$what: audit names the proxy and how it is handed to Node.js" "$T_LOG/audit-proxy-$name.txt" 'web proxy http://.*127\.0\.0\.1:3128 — '
  oa_has "$what: audit shows where the agent calls out to" "$T_LOG/audit-proxy-$name.txt" 'calls out to +https://flood\.test \(readings\)'
  oa_has_not "$what: … and has no complaint about it, every address being HTTPS" "$T_LOG/audit-proxy-$name.txt" 'NOT ALL OVER HTTPS'
  if [ -n "$pass" ]; then oa_has_not "$what: … and does not print its password" "$T_LOG/audit-proxy-$name.txt" "$pass"; fi
  if [ -n "$node_path" ]; then oa_has "$what: audit says this Node.js is not from an operating-system package" "$T_LOG/audit-proxy-$name.txt" 'NOT from an operating-system package'; fi
  t_stop_all
  cp -p "$SIM/env.pristine" /etc/open-alert-base/env
}

t_proxy_checks() {
  local own n=0 path v
  own=$(node -p process.versions.node)
  t_proxy_rig
  cp -p /etc/open-alert-base/env "$SIM/env.pristine"
  t_apply '{"settings":{"meganet":{"endpoints":["https://flood.test/rest/v1"],"stationsUrls":["https://direct.test/stations.json"]}}}'
  # Without a proxy the stand-in cannot be found at all: the proxy is the only way.
  t_stub_start "$T_LOG/stub-proxy-none.log"
  oa_run_as_unit "$T_LOG/agent-proxy-none.log" "${SIM_ENV[@]}"
  if oa_wait 40 grep -Eq 'ENOTFOUND|EAI_AGAIN|fetch failed|could not|not reach' "$T_LOG/agent-proxy-none.log" && ! t_readings_arrived "$T_LOG/stub-proxy-none.log"; then
    oa_ok "with no proxy set, nothing reaches flood.test (so what follows really goes through the proxy)"
  else oa_note "with no proxy set: the agent's log did not show a failed call within 40 seconds (see $T_LOG/agent-proxy-none.log)"; fi
  t_stop_all
  t_proxy_run own "this system's Node.js $own" "" "" ""
  t_proxy_run own-auth "this system's Node.js $own, proxy with a name and password" "" someone "hunter2-oa-test"
  for path in ${OA_NEW_NODES:-}; do
    n=$((n + 1))
    if v=$("$path" -p process.versions.node 2>/dev/null); then
      t_proxy_run "new$n" "Node.js $v (from this computer, not the system's package)" "$path" "" ""
      t_proxy_run "new$n-auth" "Node.js $v, proxy with a name and password" "$path" someone "hunter2-oa-test"
    else
      oa_skip "the web proxy with the Node.js at $path — it does not run in this container"
    fi
  done
  if [ "$n" = 0 ]; then oa_skip "the web proxy with a Node.js of 22.21 or newer (the other way a proxy is handed over) — none was given (--new-node)"; fi
  t_apply "$SIM_SETTINGS"
}

# ── part b: the firewall lock ────────────────────────────────────────────────

# Install, enterprise profile, agent running with the stand-ins; the lock not yet on.
inside_fw_setup() {
  inside_begin
  oa_section "$OA_DISTRO: the enterprise profile's firewall rules — set-up"
  if ! t_apt_update; then oa_fail "apt-get update"; exit 1; fi
  if t_apt install "$OA_DEB" > "$T_LOG/fw-apt-install.log" 2>&1; then oa_ok "the package installed (nftables came with it: it is recommended)"
  else oa_fail "apt-get install — see $T_LOG/fw-apt-install.log"; exit 1; fi
  oa_check "the nft program is installed" command -v nft
  open-alert-base profile enterprise > "$T_LOG/fw-profile.txt" 2>&1 || true
  oa_is "the profile in force" "enterprise" "$(cat /etc/open-alert-base/profile)"
  t_rig
  t_apply "$SIM_SETTINGS"
  t_stub_start "$T_LOG/fw-stub.log"
  oa_run_as_unit "$T_LOG/fw-agent.log" "${SIM_ENV[@]}"
  if oa_wait 40 oa_http_ok http://127.0.0.1:8080/; then oa_ok "the agent runs; the dashboard answers this computer on port 8080"; else oa_fail "the dashboard does not answer on 127.0.0.1:8080"; fi
  open-alert-base audit > "$T_LOG/fw-audit-unlocked.txt" 2>&1 || true
  oa_has "before the lock is on, audit says the dashboard is NOT kept to this computer" "$T_LOG/fw-audit-unlocked.txt" 'dashboard reach +NOT KEPT TO THIS COMPUTER'
  trap - ERR
}

# Load the rules exactly as open-alert-base-firewall.service would, and start
# two listeners to try the second rule with.
inside_fw_lock() {
  inside_begin
  local cmd
  cmd=$(sed -n 's/^ExecStart=//p' /usr/lib/systemd/system/open-alert-base-firewall.service)
  # shellcheck disable=SC2086  # the command and its arguments, as the service file has them
  if $cmd > "$T_LOG/fw-load.txt" 2>&1; then oa_ok "the rules load ($cmd)"; else oa_fail "the rules do not load: $(head -n 3 "$T_LOG/fw-load.txt")"; fi
  # shellcheck disable=SC2086
  if $cmd >> "$T_LOG/fw-load.txt" 2>&1; then oa_ok "loading them a second time is harmless"; else oa_fail "loading the rules a second time fails"; fi
  nft list table inet open_alert_base > "$T_LOG/fw-table.txt" 2>&1 || true
  oa_has "the table is there, with the dashboard rule" "$T_LOG/fw-table.txt" 'tcp dport 8080 .*reject with tcp reset'
  oa_has "… and the rule that stops the agent's user accepting calls from other computers" "$T_LOG/fw-table.txt" "meta skuid $(id -u rpi-alert) .*drop"
  if oa_http_ok http://127.0.0.1:8080/; then oa_ok "with the lock on, this computer still reaches the dashboard"; else oa_fail "with the lock on, 127.0.0.1:8080 no longer answers"; fi
  open-alert-base audit > "$T_LOG/fw-audit-locked.txt" 2>&1 || true
  oa_has "with the lock on, audit says the dashboard is for this computer only" "$T_LOG/fw-audit-locked.txt" 'dashboard reach +this computer only — the firewall lock is on'
  if RPI_ALERT_PORT=8080 rpi-alert status > /dev/null 2>&1; then oa_ok "… and so does the rpi-alert command"; else oa_fail "rpi-alert status fails with the lock on"; fi
  if oa_wait 60 t_readings_arrived "$T_LOG/fw-stub.log"; then oa_ok "… and readings still go out"; else oa_fail "no readings reached the stand-in with the lock on"; fi
  # Two more listeners on every address: one as the agent's user (port 9999), one as root (port 9998).
  setpriv --reuid "$(id -u rpi-alert)" --regid "$(id -g rpi-alert)" --clear-groups node -e 'require("node:net").createServer((s) => s.end("x")).listen(9999, "0.0.0.0")' > /dev/null 2>&1 < /dev/null &
  node -e 'require("node:net").createServer((s) => s.end("x")).listen(9998, "0.0.0.0")' > /dev/null 2>&1 < /dev/null &
  sleep 2
  trap - ERR
}

inside_fw_unlock() {
  inside_begin
  local cmd
  cmd=$(sed -n 's/^ExecStop=-\{0,1\}//p' /usr/lib/systemd/system/open-alert-base-firewall.service)
  # shellcheck disable=SC2086
  if $cmd > "$T_LOG/fw-unload.txt" 2>&1 && ! nft list table inet open_alert_base > /dev/null 2>&1; then oa_ok "stopping the firewall service removes its table and nothing else ($cmd)"
  else oa_fail "the table is still there after: $cmd"; fi
  trap - ERR
}

# ── part c: under a real systemd ─────────────────────────────────────────────

# What the service itself can and cannot do: a short list of attempts, made by
# the service (the same user, inside the same sandbox) just before it starts
# the agent, and written where it may write. Nothing is looked at from outside.
#   t_probe_install     adds the attempts to the service, for this check only
#   t_probe NAME        what an attempt gave: "ok", or the refusal's own words
T_PROBE_OUT=/var/lib/rpi-alert/oa-probe.txt
t_probe_install() {
  cat > "$SIM/probe.sh" <<'PROBE'
#!/bin/sh
out=/var/lib/rpi-alert/oa-probe.txt
try() { n=$1; shift; if m=$("$@" 2>&1); then echo "$n: ok"; else echo "$n: $m"; fi; }
{
  echo "user: $(id -un)"
  try write-usr touch /usr/oa-probe
  try write-etc touch /etc/oa-probe
  try write-var touch /var/oa-probe
  try write-settings sh -c 'touch /etc/rpi-alert/.oa-probe && rm /etc/rpi-alert/.oa-probe'
  try write-data sh -c 'touch /var/lib/rpi-alert/.oa-probe && rm /var/lib/rpi-alert/.oa-probe'
  try see-outside-tmp test -e /tmp/oa-test-outside
  try read-env-file cat /etc/open-alert-base/env
  echo "clock-question: $(timedatectl show -p NTPSynchronized --value 2>&1 | head -n 1)"
  echo "home: $(ls -A /home /root 2>&1 | tr '\n' ' ')"
  echo "others: $(ls /proc | grep -c '^[0-9]') processes in sight"
} > "$out" 2>&1
exit 0
PROBE
  chmod 0755 "$SIM/probe.sh"
  mkdir -p /etc/systemd/system/open-alert-base.service.d
  printf '# For this check only: the service says what it can and cannot do.\n[Service]\nExecStartPre=/bin/sh %s\n' "$SIM/probe.sh" \
    > /etc/systemd/system/open-alert-base.service.d/91-oa-probe.conf
}
t_probe() { sed -n "s/^$1: //p" "$T_PROBE_OUT" 2>/dev/null | head -n 1; }
# The service runs again, as another process than the one given.
t_restarted() {
  local p
  p=$(systemctl show -p MainPID --value open-alert-base.service)
  [ "$p" != 0 ] && [ "$p" != "$1" ] && systemctl is-active --quiet open-alert-base.service
}

inside_systemd() {
  inside_begin
  local version pid got f score cg n before
  oa_section "$OA_DISTRO: installed and started by a real systemd ($(systemctl --version | awk 'NR == 1 {print $2}'))"
  if ! t_apt_update; then oa_fail "apt-get update"; exit 1; fi
  # Container images carry a file that forbids packages to start services while
  # they are installed. A real computer has no such file: taken away, so that
  # the install behaves here as it does there.
  if [ -e /usr/sbin/policy-rc.d ]; then rm -f /usr/sbin/policy-rc.d; oa_note "removed the container image's /usr/sbin/policy-rc.d (it stops packages starting services; a real computer has none)"; fi
  if t_apt install "$OA_DEB" > "$T_LOG/sd-apt-install.log" 2>&1; then oa_ok "apt-get install ./$(basename "$OA_DEB")"
  else oa_fail "apt-get install — see $T_LOG/sd-apt-install.log"; tail -n 20 "$T_LOG/sd-apt-install.log"; exit 1; fi
  version=$(oa_pin AGENT_VERSION "$SHARE/PIN")
  oa_is "the service is set to start with the computer" "enabled" "$(systemctl is-enabled open-alert-base.service 2>&1 || true)"
  if oa_wait 30 systemctl is-active --quiet open-alert-base.service; then oa_ok "the install started the service: it is running"
  else oa_fail "the service is not running after the install: $(systemctl is-active open-alert-base.service 2>&1 || true)"; journalctl -u open-alert-base --no-pager -n 30 || true; fi
  if oa_wait 40 oa_http_ok http://127.0.0.1:80/; then oa_ok "standard profile: the dashboard answers on port 80 (the drop-in file's one privilege, given by systemd)"
  else oa_fail "the dashboard does not answer on port 80"; journalctl -u open-alert-base --no-pager -n 30 || true; fi
  journalctl -u open-alert-base --no-pager > "$T_LOG/sd-journal-first.txt" 2>&1 || true
  oa_has_not "it was not refused port 80" "$T_LOG/sd-journal-first.txt" 'cannot listen on port 80'
  pid=$(systemctl show -p MainPID --value open-alert-base.service)
  oa_is "the running process: user rpi-alert" "$(id -u rpi-alert)" "$(oa_proc_status "$pid" Uid | awk '{print $2}')"
  oa_is "… its only privilege is CAP_NET_BIND_SERVICE, and it can get no other" "0000000000000400 0000000000000400" "$(oa_proc_status "$pid" CapEff) $(oa_proc_status "$pid" CapBnd)"
  oa_is "… no-new-privileges is on" "1" "$(oa_proc_status "$pid" NoNewPrivs)"
  oa_is "… the system-call filter is on" "2" "$(oa_proc_status "$pid" Seccomp)"
  oa_note "system-call filters on the process: $(oa_proc_status "$pid" Seccomp_filters)"

  oa_section "$OA_DISTRO: the sandbox, tried by the service itself (the same user, inside the same limits, just before it starts the agent)"
  mkdir -p "$SIM"
  t_probe_install
  touch /tmp/oa-test-outside
  systemctl daemon-reload
  systemctl restart open-alert-base.service
  if oa_wait 30 test -s "$T_PROBE_OUT"; then
    cp "$T_PROBE_OUT" "$T_LOG/sd-probe.txt"
    oa_is "the attempts were made as the user rpi-alert" "rpi-alert" "$(t_probe user)"
    for f in usr etc var; do
      case "$(t_probe "write-$f")" in
        *"Read-only file system"*) oa_ok "it cannot write in /$f: the whole system is read-only to it (\"Read-only file system\")" ;;
        *) oa_fail "writing in /$f from inside the service: $(t_probe "write-$f")" ;;
      esac
    done
    oa_is "but it can write in its settings folder, /etc/rpi-alert" "ok" "$(t_probe write-settings)"
    oa_is "… and in its data folder, /var/lib/rpi-alert" "ok" "$(t_probe write-data)"
    if [ "$(t_probe see-outside-tmp)" = ok ]; then oa_fail "the service sees the computer's own /tmp"; else oa_ok "it has a /tmp of its own: a file put in the computer's /tmp is not there for it"; fi
    case "$(t_probe read-env-file)" in *"Permission denied"*) oa_ok "it cannot read /etc/open-alert-base/env (where a proxy's password would be): root only" ;; *) oa_fail "reading /etc/open-alert-base/env from inside the service: $(t_probe read-env-file)" ;; esac
    oa_is "/home and /root are empty or closed to it" "" "$(t_probe home | sed "s#ls: cannot open directory '[^']*': Permission denied##g; s#/home:##; s#/root:##" | tr -d ' ')"
    # The agent holds every reading back until systemd says the clock is set
    # from the network (timedatectl): the limits must not stand in the way of
    # that question. The stand-in runs below are told to trust the clock, so
    # this is the one place it is asked from inside the service.
    got=$(timedatectl show -p NTPSynchronized --value 2>/dev/null | head -n 1 || true)
    case "$got:$(t_probe clock-question)" in
      yes:yes|yes:no|no:yes|no:no) oa_ok "it can ask systemd whether the clock is set from the network, as the agent does before it trusts a reading's time (answered \"$(t_probe clock-question)\" inside the service, \"$got\" outside)" ;;
      yes:*|no:*) oa_fail "from inside the service the clock question got no answer: $(t_probe clock-question) (outside: $got)" ;;
      *) oa_skip "the clock question from inside the service — this container's systemd does not answer it outside the service either ($got)" ;;
    esac
    oa_note "other programs: $(t_probe others) from inside the service (its own only; the computer has $(find /proc -maxdepth 1 -name '[0-9]*' | wc -l))"
  else
    oa_fail "the service did not make its attempts (no $T_PROBE_OUT) — see: journalctl -u open-alert-base"
    journalctl -u open-alert-base --no-pager -n 20 || true
  fi
  rm -f /tmp/oa-test-outside /etc/systemd/system/open-alert-base.service.d/91-oa-probe.conf
  systemctl daemon-reload
  pid=$(systemctl show -p MainPID --value open-alert-base.service)
  got=$(systemctl show -p DevicePolicy --value open-alert-base.service)
  oa_is "systemd holds the device list: policy" "closed" "$got"
  cg=$(sed -n 's/^[0-9]*:devices:\(.*\)$/\1/p' "/proc/$pid/cgroup" | head -n 1)
  if [ -n "$cg" ] && [ -r "/sys/fs/cgroup/devices$cg/devices.list" ]; then
    cp "/sys/fs/cgroup/devices$cg/devices.list" "$T_LOG/sd-devices.txt"
    if grep -q '^a \*:\* ' "$T_LOG/sd-devices.txt"; then oa_fail "the kernel's device list for the service allows every device"
    else oa_ok "the kernel's device list for the service: $(tr '\n' ',' < "$T_LOG/sd-devices.txt" | sed 's/,$//')"; fi
    if grep -q '^c 189:\* rw' "$T_LOG/sd-devices.txt"; then oa_ok "… USB device files (189) are on it, for the sticks"
    else oa_note "USB device files (189) are not on the list: this container's kernel has no USB (no \"usb_device\" in /proc/devices), so there was nothing for systemd to add"; fi
  else
    oa_skip "the kernel's device list for the service — not readable here (a cgroup-v2 system keeps it where it cannot be listed)"
  fi

  oa_section "$OA_DISTRO: the real service with stand-ins for a stick and for Flood-Net"
  t_rig
  mkdir -p /etc/systemd/system/open-alert-base.service.d
  {
    echo "# For this check only: the stand-ins for a radio stick (as RPi ALERT's scripts/simulate.sh sets them)."
    echo "[Service]"
    for f in "${SIM_ENV[@]}"; do printf 'Environment="%s"\n' "$(printf '%s' "$f" | sed 's/\\/\\\\/g; s/"/\\"/g')"; done
  } > /etc/systemd/system/open-alert-base.service.d/90-oa-test.conf
  systemctl daemon-reload
  systemctl stop open-alert-base.service
  t_apply "$SIM_SETTINGS"
  t_stub_start "$T_LOG/sd-stub-standard.log"
  systemctl start open-alert-base.service
  t_run_checks "standard, under systemd" 80 "$T_LOG/sd-stub-standard.log"
  got=$(systemctl show -p WatchdogUSec --value open-alert-base.service)
  case "$got" in 0|''|infinity) oa_fail "the agent did not arm systemd's watchdog (WatchdogUSec=$got)" ;; *) oa_ok "the agent armed systemd's watchdog from inside the sandbox ($got): a hung agent is restarted" ;; esac
  if open-alert-base audit > "$T_LOG/sd-audit-standard.txt" 2>&1; then oa_ok "open-alert-base audit runs"; else oa_fail "open-alert-base audit"; fi
  oa_has "audit gives systemd's own score for the running service" "$T_LOG/sd-audit-standard.txt" "systemd's own score: [0-9]"
  oa_has "audit reads the running process's privileges from the kernel" "$T_LOG/sd-audit-standard.txt" 'privileges in use +one: CAP_NET_BIND_SERVICE'
  oa_check "open-alert-base status" open-alert-base status
  score=$(systemd-analyze security --no-pager open-alert-base.service 2>/dev/null | sed -n 's/.*Overall exposure level for [^:]*: *\([0-9.]*\).*/\1/p' | tail -n 1)
  oa_note "exposure score of the running service, standard profile: ${score:-unknown}"
  # Killed outright, it comes back by itself.
  pid=$(systemctl show -p MainPID --value open-alert-base.service)
  kill -9 "$pid"
  if oa_wait 30 t_restarted "$pid"; then
    oa_ok "killed outright, the agent is started again by systemd"
  else oa_fail "the agent did not come back after being killed"; fi

  oa_section "$OA_DISTRO: the enterprise profile, under systemd"
  kill "$STUB_PID" 2>/dev/null || true; wait "$STUB_PID" 2>/dev/null || true
  t_stub_start "$T_LOG/sd-stub-enterprise.log"
  got=0; open-alert-base profile enterprise > "$T_LOG/sd-profile-enterprise.txt" 2>&1 || got=$?
  oa_is "open-alert-base profile enterprise (it restarts the service and loads the firewall lock)" 0 "$got"
  if [ "$got" != 0 ]; then sed 's/^/        /' "$T_LOG/sd-profile-enterprise.txt"; fi
  if oa_wait 30 systemctl is-active --quiet open-alert-base.service; then oa_ok "the service is running again"; else oa_fail "the service is not running after the profile change"; fi
  t_run_checks "enterprise, under systemd" 8080 "$T_LOG/sd-stub-enterprise.log"
  pid=$(systemctl show -p MainPID --value open-alert-base.service)
  oa_is "the running process holds no privilege, and can get none" "0000000000000000 0000000000000000 0000000000000000" \
    "$(oa_proc_status "$pid" CapEff) $(oa_proc_status "$pid" CapBnd) $(oa_proc_status "$pid" CapAmb)"
  oa_is "the only port the agent's user listens on" "8080" "$(oa_listening rpi-alert | awk '{print $1}' | sort -u | tr '\n' ' ' | sed 's/ $//')"
  oa_is "the firewall service is on, and set to load when the computer starts" "active enabled" \
    "$(systemctl is-active open-alert-base-firewall.service 2>&1 || true) $(systemctl is-enabled open-alert-base-firewall.service 2>&1 || true)"
  if nft list table inet open_alert_base > "$T_LOG/sd-fw-table.txt" 2>&1; then oa_ok "its rules are loaded"; else oa_fail "the firewall table is not loaded: $(head -n 2 "$T_LOG/sd-fw-table.txt")"; fi
  if oa_http_ok http://127.0.0.1:8080/; then oa_ok "this computer still reaches the dashboard"; else oa_fail "127.0.0.1:8080 does not answer with the lock on"; fi
  open-alert-base audit > "$T_LOG/sd-audit-enterprise.txt" 2>&1 || true
  oa_has "audit (enterprise): the firewall lock is on" "$T_LOG/sd-audit-enterprise.txt" 'firewall lock +on '
  oa_has "audit (enterprise): no privilege in use" "$T_LOG/sd-audit-enterprise.txt" 'privileges in use +none'
  score=$(systemd-analyze security --no-pager open-alert-base.service 2>/dev/null | sed -n 's/.*Overall exposure level for [^:]*: *\([0-9.]*\).*/\1/p' | tail -n 1)
  oa_note "exposure score of the running service, enterprise profile: ${score:-unknown}"
  n=$(journalctl -u open-alert-base --no-pager 2>/dev/null | grep -Eci 'operation not permitted|EPERM|permission denied|EACCES|bad system call' || true)
  journalctl -u open-alert-base --no-pager > "$T_LOG/sd-journal.txt" 2>&1 || true
  if [ "${n:-0}" = 0 ]; then oa_ok "nothing in the agent's log says the sandbox refused it something it needed"
  else oa_fail "the agent's log has $n line(s) about something refused — see $T_LOG/sd-journal.txt: $(grep -Ei 'operation not permitted|EPERM|permission denied|EACCES|bad system call' "$T_LOG/sd-journal.txt" | head -n 3)"; fi

  oa_section "$OA_DISTRO: the package installed again over itself, as an update is (under systemd)"
  before=$(sha256sum /etc/rpi-alert/config.json | awk '{print $1}')
  pid=$(systemctl show -p MainPID --value open-alert-base.service)
  if t_apt install --reinstall "$OA_DEB" > "$T_LOG/sd-apt-update.log" 2>&1; then oa_ok "apt-get install --reinstall ./$(basename "$OA_DEB")"
  else oa_fail "apt-get install --reinstall — see $T_LOG/sd-apt-update.log"; fi
  if oa_wait 30 t_restarted "$pid"; then oa_ok "the service was restarted by the update and is running"; else oa_fail "the service is not running anew after the update"; fi
  oa_is "the settings file is byte for byte what it was" "$before" "$(sha256sum /etc/rpi-alert/config.json | awk '{print $1}')"
  oa_is "the profile in force is still" "enterprise" "$(cat /etc/open-alert-base/profile)"
  oa_check "the firewall lock is still on" nft list table inet open_alert_base
  oa_check_not "and still no privilege was given" test -e "$DROPIN"
  if oa_wait 40 oa_http_ok http://127.0.0.1:8080/; then oa_ok "the dashboard answers again on port 8080"; else oa_fail "the dashboard does not answer after the update"; fi

  oa_section "$OA_DISTRO: remove and purge, under systemd"
  if t_apt remove open-alert-base > "$T_LOG/sd-apt-remove.log" 2>&1; then oa_ok "apt-get remove"; else oa_fail "apt-get remove — see $T_LOG/sd-apt-remove.log"; fi
  got=$(systemctl is-active open-alert-base.service 2>&1 || true)
  case "$got" in inactive|failed|unknown) oa_ok "remove: the service is stopped ($got)" ;; *) oa_fail "remove: the service is $got" ;; esac
  oa_check_not "remove: the firewall table is gone" nft list table inet open_alert_base
  oa_is "remove: nothing of the agent's user listens any more" "" "$(oa_listening rpi-alert | head -n 1)"
  rm -f /etc/systemd/system/open-alert-base.service.d/90-oa-test.conf
  if t_apt purge open-alert-base > "$T_LOG/sd-apt-purge.log" 2>&1; then oa_ok "apt-get purge"; else oa_fail "apt-get purge — see $T_LOG/sd-apt-purge.log"; fi
  got=$(ls -d /etc/rpi-alert /var/lib/rpi-alert /etc/open-alert-base /etc/systemd/system/open-alert-base.service.d /etc/systemd/system/open-alert-base.service /etc/systemd/system/open-alert-base-firewall.service 2>/dev/null || true)
  oa_is "purge: nothing of it is left under /etc or /var/lib" "" "$got"
  got=$(systemctl list-unit-files 'open-alert-base*' --no-legend --no-pager 2>/dev/null | head -n 3 || true)
  oa_is "purge: systemd knows no such service any more" "" "$got"
  t_stop_all
  trap - ERR
}

# ═════════════════════════════════════════════════════════════════════════════
# On the computer that runs the checks
# ═════════════════════════════════════════════════════════════════════════════

WORK=''; LOGDIR=''; DEBDIR=''; DEB=''; TARBALL="${OA_AGENT_TARBALL:-}"; SIG="${OA_AGENT_SIG:-}"
GIVEN_DEB=''; AGENT_TESTS=1; DO_FW=1; DO_SD=1; REQUIRE_SD=0
NEW_NODE_DIRS=(); DISTROS=()

image_of() {
  case "$1" in
    debian13) echo debian:trixie-slim ;;
    ubuntu2404) echo ubuntu:24.04 ;;
    debian12) echo debian:bookworm-slim ;;
    *) return 1 ;;
  esac
}

# ── 1. the release check ─────────────────────────────────────────────────────

FETCH="$OA_FIRMWARE/lib/fetch-agent.sh"

# refused "what" "words the message must hold" fetch-agent arguments…
# The script must stop with exit status 1, say why, and unpack nothing.
refused() {
  local what=$1 words=$2 rc=0 out="$WORK/refused-out"; shift 2
  rm -rf "$out"
  "$FETCH" --out "$out" "$@" > "$WORK/refused.txt" 2>&1 || rc=$?
  if [ "$rc" = 1 ] && grep -q -- "$words" "$WORK/refused.txt" && [ ! -e "$out" ]; then oa_ok "refused: $what"
  else oa_fail "not refused as it should be: $what — exit status $rc, said: $(tail -n 2 "$WORK/refused.txt" | tr '\n' ' ')"; fi
}

# A pin of our own making, for the files that the real release key could never have signed.
#   make_pin DIR KEYFILE(public) SHA256 [TAG VERSION]
make_pin() {
  local dir=$1 key=$2 sha=$3 tag=${4:-$(oa_pin AGENT_TAG)} version=${5:-$(oa_pin AGENT_VERSION)} fp
  mkdir -p "$dir/keys"
  cp "$key" "$dir/keys/rpi-alert-release.pub.pem"
  fp="SHA256:$(openssl pkey -pubin -in "$key" -outform DER | openssl dgst -sha256 -binary | openssl base64 -A | tr -d '=')"
  {
    echo "AGENT_TAG=$tag"; echo "AGENT_VERSION=$version"
    echo "AGENT_URL=https://example.invalid/x.tar.gz"; echo "AGENT_SIG_URL=https://example.invalid/x.tar.gz.sig"
    echo "AGENT_SHA256=$sha"; echo "KEY_FILE=keys/rpi-alert-release.pub.pem"; echo "KEY_FINGERPRINT=$fp"; echo "OA_REVISION=1"
  } > "$dir/PIN"
}

# A tarball made here, signed with a key made here, and a pin that names both.
#   own_signed NAME  (the folder $WORK/own/NAME/tree is packed; prints nothing)
own_signed() {
  local name=$1 d="$WORK/own/$1"; shift
  ( cd "$d/tree" && tar -czf "$d/t.tar.gz" --owner=0 --group=0 "$@" -- * )
  openssl pkeyutl -sign -inkey "$WORK/own/key.pem" -rawin -in "$d/t.tar.gz" -out "$d/t.tar.gz.sig"
  make_pin "$d/pin" "$WORK/own/key.pub.pem" "$(sha256sum "$d/t.tar.gz" | awk '{print $1}')"
}
own_tree() {
  local d
  d="$WORK/own/$1/tree/rpi-alert-$(oa_pin AGENT_TAG)"
  mkdir -p "$d/agent/bin" "$d/os"
  printf '{\n  "name": "rpi-alert",\n  "version": "%s"\n}\n' "${2:-$(oa_pin AGENT_VERSION)}" > "$d/agent/package.json"
  printf '#!/usr/bin/env node\n' > "$d/agent/bin/rpi-alert"; chmod 0755 "$d/agent/bin/rpi-alert"
  printf '%s' "$d"
}

release_checks() {
  local rc=0 d sha
  oa_section "The release check (firmware/lib/fetch-agent.sh)"
  if [ -z "$TARBALL" ]; then
    oa_note "no --tarball given: downloading the pinned release"
    if "$FETCH" --verify-only --download-dir "$WORK/dl" > "$WORK/fetch-download.txt" 2>&1; then
      TARBALL="$WORK/dl/$(basename "$(oa_pin AGENT_URL)")"; SIG="$TARBALL.sig"
      oa_ok "the pinned release downloads from $(oa_pin AGENT_URL) and passes every check"
    else
      oa_fail "the pinned release could not be downloaded and checked: $(tail -n 2 "$WORK/fetch-download.txt" | tr '\n' ' ')"; return 1
    fi
  fi
  if "$FETCH" --verify-only --tarball "$TARBALL" --sig "$SIG" > "$WORK/fetch-good.txt" 2>&1; then
    oa_ok "the real release is accepted: $(sed -n 's/^signature  //p' "$WORK/fetch-good.txt"); $(sed -n 's/^contents   //p' "$WORK/fetch-good.txt")"
  else oa_fail "the real release is refused: $(tail -n 2 "$WORK/fetch-good.txt" | tr '\n' ' ')"; return 1; fi
  if "$FETCH" --out "$WORK/release" --tarball "$TARBALL" --sig "$SIG" > /dev/null 2>&1 && [ -f "$WORK/release/agent/bin/rpi-alert" ]; then
    oa_ok "and unpacked: agent/ and os/"
  else oa_fail "the real release could not be unpacked"; return 1; fi

  # A changed tarball: one byte added at the end.
  cp "$TARBALL" "$WORK/changed.tar.gz"; printf 'x' >> "$WORK/changed.tar.gz"
  refused "a tarball with one byte added (its hash is not the pinned one)" "SHA-256" --tarball "$WORK/changed.tar.gz" --sig "$SIG"
  # … and with the pin's hash changed to match it: now only the signature stands in the way.
  make_pin "$WORK/pin-changed" "$OA_FIRMWARE/keys/rpi-alert-release.pub.pem" "$(sha256sum "$WORK/changed.tar.gz" | awk '{print $1}')"
  refused "the same tarball, with a pin that names its hash (the signature does not fit)" "signature is not" --pin "$WORK/pin-changed/PIN" --tarball "$WORK/changed.tar.gz" --sig "$SIG"
  # A wrong hash in the pin, the real files.
  make_pin "$WORK/pin-wronghash" "$OA_FIRMWARE/keys/rpi-alert-release.pub.pem" "$(printf 'no' | sha256sum | awk '{print $1}')"
  refused "the real tarball against a pin that names another hash" "SHA-256" --pin "$WORK/pin-wronghash/PIN" --tarball "$TARBALL" --sig "$SIG"
  # A signature with one bit turned over; one that is too short.
  flip_first_bit "$SIG" "$WORK/flipped.sig"
  refused "a signature with one bit changed" "signature is not" --tarball "$TARBALL" --sig "$WORK/flipped.sig"
  head -c 63 "$SIG" > "$WORK/short.sig"
  refused "a signature file of the wrong length" "not 64 bytes" --tarball "$TARBALL" --sig "$WORK/short.sig"
  # Another key: its signature over the real tarball; and the key itself in place of the release key.
  mkdir -p "$WORK/own"
  openssl genpkey -algorithm ed25519 -out "$WORK/own/key.pem" 2>/dev/null
  openssl pkey -in "$WORK/own/key.pem" -pubout -out "$WORK/own/key.pub.pem" 2>/dev/null
  openssl pkeyutl -sign -inkey "$WORK/own/key.pem" -rawin -in "$TARBALL" -out "$WORK/other-key.sig"
  refused "the real tarball signed by another key" "signature is not" --tarball "$TARBALL" --sig "$WORK/other-key.sig"
  make_pin "$WORK/pin-otherkey" "$WORK/own/key.pub.pem" "$(oa_pin AGENT_SHA256)"
  sed -i "s|^KEY_FINGERPRINT=.*|KEY_FINGERPRINT=$(oa_pin KEY_FINGERPRINT)|" "$WORK/pin-otherkey/PIN"
  refused "another key put in place of the release key (its fingerprint is not the pinned one)" "fingerprint" --pin "$WORK/pin-otherkey/PIN" --tarball "$TARBALL" --sig "$WORK/other-key.sig"
  # The pin names another version than the release holds.
  make_pin "$WORK/pin-version" "$OA_FIRMWARE/keys/rpi-alert-release.pub.pem" "$(oa_pin AGENT_SHA256)" v9.9.9 9.9.9
  refused "the real release against a pin that names another version" "outside rpi-alert-v9.9.9" --pin "$WORK/pin-version/PIN" --tarball "$TARBALL" --sig "$SIG"
  sed 's|^AGENT_URL=https://|AGENT_URL=http://|' "$OA_FIRMWARE/PIN" > "$WORK/pin-http"; mkdir -p "$WORK/keys"; cp "$OA_FIRMWARE/keys/"* "$WORK/keys/"
  refused "a pin whose download address is not https" "not https" --pin "$WORK/pin-http" --tarball "$TARBALL" --sig "$SIG"

  # Tarballs that are correctly signed (by the key made above, with a pin to
  # match) but hold something they should not: the signature is not the only check.
  d=$(own_tree good); own_signed good
  if "$FETCH" --verify-only --pin "$WORK/own/good/pin/PIN" --tarball "$WORK/own/good/t.tar.gz" --sig "$WORK/own/good/t.tar.gz.sig" > "$WORK/own-good.txt" 2>&1; then
    oa_ok "a well-formed tarball made and signed here, with its own pin, is accepted (so the refusals below are about what is inside)"
  else oa_fail "the test's own well-formed tarball is refused: $(tail -n 2 "$WORK/own-good.txt" | tr '\n' ' ')"; fi
  d=$(own_tree link); ln -s /etc/passwd "$d/agent/link"; own_signed link
  refused "a signed tarball that holds a link" "neither a plain file nor a folder" --pin "$WORK/own/link/pin/PIN" --tarball "$WORK/own/link/t.tar.gz" --sig "$WORK/own/link/t.tar.gz.sig"
  d=$(own_tree outside); mkdir -p "$WORK/own/outside/tree/elsewhere"; echo x > "$WORK/own/outside/tree/elsewhere/file"; own_signed outside
  refused "a signed tarball that holds a file outside its one folder" "outside rpi-alert-" --pin "$WORK/own/outside/pin/PIN" --tarball "$WORK/own/outside/t.tar.gz" --sig "$WORK/own/outside/t.tar.gz.sig"
  d=$(own_tree climb); echo x > "$d/agent/climber"; own_signed climb --transform 's,agent/climber,agent/../../climber,'
  refused "a signed tarball with a path that climbs out of its folder (..)" "climbs out" --pin "$WORK/own/climb/pin/PIN" --tarball "$WORK/own/climb/t.tar.gz" --sig "$WORK/own/climb/t.tar.gz.sig"
  d=$(own_tree setuid); cp /bin/true "$d/agent/bin/tool"; chmod 4755 "$d/agent/bin/tool"; own_signed setuid
  refused "a signed tarball that holds a set-user-id program" "set-user-id" --pin "$WORK/own/setuid/pin/PIN" --tarball "$WORK/own/setuid/t.tar.gz" --sig "$WORK/own/setuid/t.tar.gz.sig"
  d=$(own_tree version 0.0.1); own_signed version
  refused "a signed tarball whose agent says it is another version than the pin names" "says it is version" --pin "$WORK/own/version/pin/PIN" --tarball "$WORK/own/version/t.tar.gz" --sig "$WORK/own/version/t.tar.gz.sig"
  : "$d"

  rc=0; "$FETCH" --out "$WORK/x" --tarball "$WORK/no-such-file" --sig "$SIG" > /dev/null 2>&1 || rc=$?
  oa_is "a tarball that is not there: exit status 3 (not \"refused\": nothing was checked)" 3 "$rc"
  rc=0; "$FETCH" --no-such-option > /dev/null 2>&1 || rc=$?
  oa_is "an unknown option: exit status 2" 2 "$rc"
  rc=0; "$FETCH" --out "$WORK/x" --tarball "$TARBALL" > /dev/null 2>&1 || rc=$?
  oa_is "a tarball given without its signature: exit status 2" 2 "$rc"
  # With Node alone (no OpenSSL): the same answers.
  if command -v node >/dev/null 2>&1; then
    sha=0; node "$OA_FIRMWARE/lib/verify-ed25519.js" verify "$OA_FIRMWARE/keys/rpi-alert-release.pub.pem" "$SIG" "$TARBALL" || sha=$?
    rc=0; node "$OA_FIRMWARE/lib/verify-ed25519.js" verify "$OA_FIRMWARE/keys/rpi-alert-release.pub.pem" "$SIG" "$WORK/changed.tar.gz" 2>/dev/null || rc=$?
    oa_is "the Node-only checker (for a computer without OpenSSL 3): the real release 0, the changed tarball 1" "0 1" "$sha $rc"
    oa_is "… and it works out the same key fingerprint as the pin" "$(oa_pin KEY_FINGERPRINT)" "$(node "$OA_FIRMWARE/lib/verify-ed25519.js" fingerprint "$OA_FIRMWARE/keys/rpi-alert-release.pub.pem")"
  else
    oa_skip "the Node-only checker — Node.js is not installed on this computer"
  fi
}

# Copy a file with its first bit turned over.
flip_first_bit() {
  local first
  first=$(head -c 1 "$1" | od -An -tu1 | tr -d ' ')
  { printf '%b' "\\0$(printf '%03o' $(( first ^ 1 )))"; tail -c +2 "$1"; } > "$2"
}

# ── 2. the scripts and the build ─────────────────────────────────────────────

script_checks() {
  local files=() f bad=''
  oa_section "The scripts"
  files=("$OA_FIRMWARE/lib/fetch-agent.sh" "$OA_FIRMWARE/deb/build-deb.sh" "$OA_FIRMWARE/deb/debian/preinst" "$OA_FIRMWARE/deb/debian/postinst"
         "$OA_FIRMWARE/deb/debian/prerm" "$OA_FIRMWARE/deb/debian/postrm" "$OA_FIRMWARE/deb/files/usr/bin/open-alert-base" "$OA_FIRMWARE/deb/files/usr/bin/rpi-alert"
         "$OA_FIRMWARE/deb/files/usr/lib/open-alert-base/start" "$OA_FIRMWARE/test/lib.sh" "$OA_FIRMWARE/test/deb.sh")
  if command -v shellcheck >/dev/null 2>&1; then
    if shellcheck -x "${files[@]}" > "$LOGDIR/shellcheck.txt" 2>&1; then oa_ok "shellcheck $(shellcheck --version | awk '/^version:/ {print $2}'): ${#files[@]} shell scripts, nothing to report"
    else oa_fail "shellcheck has findings — see $LOGDIR/shellcheck.txt"; fi
  else oa_skip "shellcheck — it is not installed on this computer"; fi
  for f in "${files[@]}"; do
    head -n 1 "$f" | grep -q '^#!/bin/bash$' || bad="$bad $(basename "$f")(first line)"
    case "$f" in */lib.sh) ;; *) grep -q '^set -euo pipefail$' "$f" || bad="$bad $(basename "$f")(set -euo pipefail)" ;; esac
  done
  oa_is "every script is bash and stops at the first error (set -euo pipefail; lib.sh takes it from the script that reads it in)" "" "$bad"
  if command -v node >/dev/null 2>&1; then
    bad=''
    for f in "$OA_FIRMWARE/lib/verify-ed25519.js" "$OA_FIRMWARE/deb/files/usr/lib/open-alert-base/settings.js" "$OA_FIRMWARE/deb/files/usr/lib/open-alert-base/proxy-preload.js"; do
      node --check "$f" 2>/dev/null || bad="$bad $(basename "$f")"
    done
    oa_is "the three JavaScript files of this layer parse" "" "$bad"
  fi
  for f in standard enterprise; do
    if command -v node >/dev/null 2>&1; then
      oa_check "the $f profile is valid JSON with a \"settings\" part" node -e 'const p = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8")); if (!p.settings || p.profile !== process.argv[2]) process.exit(1)' \
        "$OA_FIRMWARE/deb/files/usr/share/open-alert-base/profiles/$f.json" "$f"
    fi
  done
}

build_checks() {
  local version name sha1 sha2 got bad n
  oa_section "The package"
  version="$(oa_pin AGENT_VERSION)+oa$(oa_pin OA_REVISION)"; name="open-alert-base_${version}_all.deb"
  mkdir -p "$DEBDIR"
  if [ -n "$GIVEN_DEB" ]; then
    cp "$GIVEN_DEB" "$DEBDIR/$name"
    oa_note "checking the package given (--deb $GIVEN_DEB), not building one"
  else
    if "$OA_FIRMWARE/deb/build-deb.sh" --tarball "$TARBALL" --sig "$SIG" > "$LOGDIR/build-1.txt" 2>&1; then oa_ok "firmware/deb/build-deb.sh builds dist/$name"
    else oa_fail "build-deb.sh failed — see $LOGDIR/build-1.txt"; tail -n 5 "$LOGDIR/build-1.txt"; return 1; fi
    if "$OA_FIRMWARE/deb/build-deb.sh" --tarball "$TARBALL" --sig "$SIG" --out "$WORK/build2" > "$LOGDIR/build-2.txt" 2>&1; then
      sha1=$(sha256sum "$OA_REPO/dist/$name" | awk '{print $1}'); sha2=$(sha256sum "$WORK/build2/$name" | awk '{print $1}')
      oa_is "built a second time it is the same file, byte for byte (sha256)" "$sha1" "$sha2"
    else oa_fail "the second build failed — see $LOGDIR/build-2.txt"; fi
    cp "$OA_REPO/dist/$name" "$DEBDIR/$name"
  fi
  DEB="$DEBDIR/$name"
  oa_note "package: $(stat -c %s "$DEB") bytes, sha256 $(sha256sum "$DEB" | awk '{print $1}'); installed size $(dpkg-deb -f "$DEB" Installed-Size) kB"
  oa_is "its name in the package" "open-alert-base" "$(dpkg-deb -f "$DEB" Package)"
  oa_is "its version" "$version" "$(dpkg-deb -f "$DEB" Version)"
  oa_is "it is for every kind of processor (Architecture: all)" "all" "$(dpkg-deb -f "$DEB" Architecture)"
  oa_is "what it needs (Depends)" "nodejs (>= 18.17), rtl-sdr, ca-certificates, adduser" "$(dpkg-deb -f "$DEB" Depends)"
  dpkg-deb -c "$DEB" > "$LOGDIR/deb-contents.txt"
  got=$(awk '$2 != "root/root"' "$LOGDIR/deb-contents.txt" | head -n 3)
  oa_is "every file in it belongs to root" "" "$got"
  got=$(grep -E '^.{3}[sS]|^.{6}[sS]|^.{8}w' "$LOGDIR/deb-contents.txt" | head -n 3 || true)
  oa_is "none is set-user-id, set-group-id or writable by everybody" "" "$got"
  got=$(awk '{print $6}' "$LOGDIR/deb-contents.txt" | grep -Ev '^\./(usr(/|$)|etc(/|$))|^\./$' | head -n 3 || true)
  oa_is "it puts files under /usr and /etc only" "" "$got"
  got=$(awk '{print $6}' "$LOGDIR/deb-contents.txt" | grep -E '^\./etc/' | grep -v '/$' | sort | tr '\n' ' ')
  oa_is "under /etc: its two settings files, and nothing else" "./etc/open-alert-base/dashboard-local-only.nft ./etc/open-alert-base/env " "$got"
  dpkg-deb -x "$DEB" "$WORK/deb-x"
  (cd "$WORK/release/agent" && find bin lib vendor web test scripts package.json -type f -print0 | LC_ALL=C sort -z | xargs -0 sha256sum) > "$DEBDIR/release-agent.sha256"
  (cd "$WORK/deb-x/usr/lib/open-alert-base/agent" && find . -type f | sed 's|^\./||' | LC_ALL=C sort | tr '\n' '\0' | xargs -0 sha256sum) > "$WORK/deb-agent.sha256"
  n=$(wc -l < "$DEBDIR/release-agent.sha256")
  if diff -q "$DEBDIR/release-agent.sha256" "$WORK/deb-agent.sha256" > /dev/null; then oa_ok "the agent in the package is the signed release's, unchanged: $n files, the same names and the same SHA-256 each, and no file more"
  else oa_fail "the agent in the package differs from the signed release: $(diff "$DEBDIR/release-agent.sha256" "$WORK/deb-agent.sha256" | head -n 3 | tr '\n' ' ')"; fi
  bad=''
  for got in sudoers 'rpi-alert-priv' 'rpi-alert-update' 'authorized_keys' 'journald.conf' '\.timer$'; do
    if awk '{print $6}' "$LOGDIR/deb-contents.txt" | grep -Eq "$got"; then bad="$bad $got"; fi
  done
  oa_is "it holds no sudo rule, no root helper, no updater, no SSH key list, no log cap, no timer" "" "$bad"
  oa_has "the copyright file names the MIT licence, RPi ALERT and the decoders it carries" "$WORK/deb-x/usr/share/doc/open-alert-base/copyright" 'vendor/meganet'
  oa_has "the README in the package says what has not been tested" "$WORK/deb-x/usr/share/doc/open-alert-base/README" 'NOT YET TESTED WITH A REAL RADIO STICK'
  got=$(grep -rIl 'MegaNet' "$WORK/deb-x/usr/bin" "$WORK/deb-x/usr/share/doc/open-alert-base/README" "$WORK/deb-x/etc" "$WORK/deb-x/usr/share/open-alert-base/profiles" 2>/dev/null | head -n 3 || true)
  oa_is "what a person reads says Flood-Net, never the repository's earlier name" "" "$got"
  if command -v lintian >/dev/null 2>&1; then
    lintian --tag-display-limit 0 "$DEB" > "$LOGDIR/lintian.txt" 2>&1 || true
    if grep -q '^E:' "$LOGDIR/lintian.txt"; then oa_fail "lintian (Debian's package checker) reports errors: $(grep '^E:' "$LOGDIR/lintian.txt" | head -n 3 | tr '\n' ' ')"
    else oa_ok "lintian (Debian's package checker): no errors; $(grep -c '^W:' "$LOGDIR/lintian.txt" || true) warnings, kept in $LOGDIR/lintian.txt"; fi
  else oa_skip "lintian — it is not installed on this computer"; fi
}

# ── 3. one system ────────────────────────────────────────────────────────────

# Is the port open, seen from a second container ("another computer")?   probe IMAGE ADDRESS PORT
probe() {
  docker run --rm "$1" bash -c "if timeout 5 bash -c 'exec 3<>/dev/tcp/$2/$3' 2>/dev/null; then echo open; else echo closed; fi" 2>/dev/null || echo error
}

# Wait (up to five minutes: it installs systemd first) until the systemd in a
# container says it is up; give up at once if the container has stopped.
systemd_is_up() {
  local i
  for i in $(seq 1 150); do
    if [ "$(docker inspect -f '{{.State.Running}}' "$1" 2>/dev/null)" != true ]; then return 1; fi
    case "$(docker exec "$1" systemctl is-system-running 2>/dev/null || true)" in running|degraded) return 0 ;; esac
    sleep 2
  done
  : "$i"
  return 1
}
# Remove the systemd container, and the empty groups its systemd left in the
# computer's cgroup folder (they are the container's own, named after its id).
remove_systemd_container() {
  local id g
  id=$(docker inspect -f '{{.Id}}' "$1" 2>/dev/null || true)
  docker rm -f "$1" > /dev/null 2>&1 || true
  if [ -n "$id" ]; then
    for g in /sys/fs/cgroup/*/docker/"$id" /sys/fs/cgroup/docker/"$id"; do
      if [ -d "$g" ]; then find "$g" -depth -type d -exec rmdir {} + 2>/dev/null || true; fi
    done
  fi
}

run_distro() {
  local name=$1 image dir c ip common=() new_nodes='' d i=0 cg tries
  image=$(image_of "$name"); dir="$LOGDIR/$name"; mkdir -p "$dir"
  if ! oa_image "$image"; then oa_section "$name ($image)"; oa_fail "the container image $image could not be had (tried Docker Hub and two mirrors)"; return 0; fi
  common=(-v "$OA_FIRMWARE:/oa/firmware:ro" -v "$DEBDIR:/oa/deb:ro" -v "$dir:/oa/log" -e "OA_DEB=/oa/deb/$(basename "$DEB")" -e "OA_DISTRO=$name" -e "OA_AGENT_TESTS=$AGENT_TESTS")
  for d in "${NEW_NODE_DIRS[@]}"; do
    i=$((i + 1)); common+=(-v "$d:/opt/oa-node-$i:ro"); new_nodes="$new_nodes /opt/oa-node-$i/bin/node"
  done
  common+=(-e "OA_NEW_NODES=${new_nodes# }")

  # a. Ordinary container, no added privilege. Low ports are closed to
  #    ordinary users, as on a real computer (containers leave them open).
  oa_in_container "$dir/install.txt" "${common[@]}" --sysctl net.ipv4.ip_unprivileged_port_start=1024 "$image" bash /oa/firmware/test/deb.sh --inside install

  # b. The firewall rules: this container may change its own firewall
  #    (NET_ADMIN), and a second, plain container plays another computer.
  if [ "$DO_FW" = 1 ]; then
    c="oa-test-fw-$name-$$"
    docker rm -f "$c" > /dev/null 2>&1 || true
    if docker run -d --name "$c" --cap-add NET_ADMIN "${common[@]}" "$image" sleep 3600 > /dev/null 2>&1; then
      oa_exec_container "$dir/firewall.txt" "$c" bash /oa/firmware/test/deb.sh --inside fw-setup
      ip=$(docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' "$c")
      oa_is "before the lock: another computer can open the dashboard's port (RPi ALERT up to 0.23 listens on every address)" "open" "$(probe "$image" "$ip" 8080)"
      oa_exec_container "$dir/firewall.txt" "$c" bash /oa/firmware/test/deb.sh --inside fw-lock
      oa_is "with the lock on: another computer is refused the dashboard's port" "closed" "$(probe "$image" "$ip" 8080)"
      oa_is "… and cannot reach any other port the agent's user might open (tried: 9999)" "closed" "$(probe "$image" "$ip" 9999)"
      oa_is "… while a port another user of this computer opens is left alone (tried: 9998, root's) — the rules touch only the agent" "open" "$(probe "$image" "$ip" 9998)"
      oa_exec_container "$dir/firewall.txt" "$c" bash /oa/firmware/test/deb.sh --inside fw-unlock
      oa_is "with the table removed the port is open again (so it was these rules that closed it)" "open" "$(probe "$image" "$ip" 8080)"
    else
      oa_fail "the firewall container could not be started"
    fi
    docker rm -f "$c" > /dev/null 2>&1 || true
  else
    oa_section "$name: the firewall rules"; oa_skip "the firewall rules — left out (--no-firewall)"
  fi

  # c. A real systemd. It needs somewhere to keep its groups of processes:
  #    the computer's own cgroup folder, shared in.
  if [ "$DO_SD" = 1 ]; then
    c="oa-test-sd-$name-$$"
    if [ -f /sys/fs/cgroup/cgroup.controllers ]; then tries="/sys/fs/cgroup"
    elif [ -d /sys/fs/cgroup/unified ] && [ "$name" = debian13 ]; then tries="/sys/fs/cgroup/unified /sys/fs/cgroup"   # systemd 257 has no cgroup v1
    elif [ -d /sys/fs/cgroup/unified ]; then tries="/sys/fs/cgroup /sys/fs/cgroup/unified"
    else tries="/sys/fs/cgroup"; fi
    cg=''
    for d in $tries; do
      docker rm -f "$c" > /dev/null 2>&1 || true
      docker run -d --name "$c" --cap-add SYS_ADMIN --cap-add NET_ADMIN --sysctl net.ipv4.ip_unprivileged_port_start=1024 \
        --tmpfs /run --tmpfs /run/lock --tmpfs /tmp:exec -v "$d:/sys/fs/cgroup:rw" --cgroupns=host -e container=docker "${common[@]}" "$image" \
        bash -c 'export DEBIAN_FRONTEND=noninteractive; (apt-get update && apt-get install -y systemd systemd-sysv dbus) > /oa/log/sd-apt-systemd.log 2>&1; exec /sbin/init' > /dev/null 2>&1 || continue
      if systemd_is_up "$c"; then cg=$d; break; fi
      docker logs "$c" > "$dir/sd-container-$(basename "$d").txt" 2>&1 || true
    done
    if [ -n "$cg" ]; then
      oa_exec_container "$dir/systemd.txt" "$c" bash /oa/firmware/test/deb.sh --inside systemd
    else
      oa_section "$name: under a real systemd"
      if [ "$REQUIRE_SD" = 1 ]; then oa_fail "systemd would not start in a container on this computer (see $dir/sd-container-*.txt), and --require-systemd was given"
      else oa_skip "the package under a real systemd — systemd would not start in a container on this computer (see $dir/sd-container-*.txt)"; fi
    fi
    remove_systemd_container "$c"
  else
    oa_section "$name: under a real systemd"; oa_skip "the package under a real systemd — left out (--no-systemd)"
  fi
}

main() {
  local d v
  while [ $# -gt 0 ]; do
    case "$1" in
      --tarball) TARBALL="${2:?--tarball needs a file}"; shift 2 ;;
      --sig) SIG="${2:?--sig needs a file}"; shift 2 ;;
      --deb) GIVEN_DEB="${2:?--deb needs a file}"; shift 2 ;;
      --new-node) NEW_NODE_DIRS+=("${2:?--new-node needs a folder}"); shift 2 ;;
      --no-agent-tests) AGENT_TESTS=0; shift ;;
      --no-firewall) DO_FW=0; shift ;;
      --no-systemd) DO_SD=0; shift ;;
      --require-systemd) REQUIRE_SD=1; shift ;;
      --log-dir) LOGDIR="${2:?--log-dir needs a folder}"; shift 2 ;;
      -h|--help) usage; exit 0 ;;
      -*) oa_die "unknown option $1 (try --help)" ;;
      *) image_of "$1" > /dev/null || oa_die "unknown system \"$1\": debian13, ubuntu2404 or debian12"; DISTROS+=("$1"); shift ;;
    esac
  done
  if [ ${#DISTROS[@]} = 0 ]; then DISTROS=(debian13 ubuntu2404 debian12); fi
  if { [ -n "$TARBALL" ] && [ -z "$SIG" ]; } || { [ -z "$TARBALL" ] && [ -n "$SIG" ]; }; then oa_die "--tarball and --sig go together"; fi
  oa_need docker dpkg-deb openssl tar sha256sum awk sed
  docker info > /dev/null 2>&1 || oa_die "Docker is not running (or this user may not use it)"
  LOGDIR="${LOGDIR:-$OA_REPO/dist/test-logs/deb}"
  rm -rf "$LOGDIR"; mkdir -p "$LOGDIR"; LOGDIR="$(cd "$LOGDIR" && pwd)"
  WORK=$(mktemp -d "${TMPDIR:-/tmp}/oa-test-deb.XXXXXX")
  trap 'rm -rf "$WORK"' EXIT
  DEBDIR="$WORK/deb"
  # A Node.js of 22.21 or newer on this computer, to try the other way a proxy is handed over.
  if [ ${#NEW_NODE_DIRS[@]} = 0 ] && command -v node > /dev/null 2>&1; then
    d=$(dirname "$(dirname "$(readlink -f "$(command -v node)")")")
    if [ "$d" != /usr ] && [ -x "$d/bin/node" ] && "$d/bin/node" -e 'const [a, b] = process.versions.node.split(".").map(Number); process.exit(a >= 24 || (a === 22 && b >= 21) ? 0 : 1)' 2>/dev/null; then
      NEW_NODE_DIRS=("$d")
    fi
  fi
  for d in "${NEW_NODE_DIRS[@]}"; do
    v=$("$d/bin/node" -p process.versions.node 2>/dev/null) || oa_die "--new-node $d: there is no working $d/bin/node"
    : "$v"
  done

  echo "Checking the package open-alert-base — $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "On: $(sed -n 's/^PRETTY_NAME="\(.*\)"$/\1/p' /etc/os-release 2>/dev/null), $(uname -m), Docker $(docker version --format '{{.Server.Version}}' 2>/dev/null)"
  echo "Logs: $LOGDIR"

  release_checks || { oa_summary || true; exit 1; }
  script_checks
  build_checks || { oa_summary || true; exit 1; }

  for d in "${DISTROS[@]}"; do
    ( run_distro "$d" ) 2>&1 | tee "$LOGDIR/$d.results.txt"
    oa_count_log "$LOGDIR/$d.results.txt"
  done
  oa_summary
}

if [ "${1:-}" = --inside ]; then
  case "${2:-}" in
    install) inside_install ;;
    fw-setup) inside_fw_setup ;;
    fw-lock) inside_fw_lock ;;
    fw-unlock) inside_fw_unlock ;;
    systemd) inside_systemd ;;
    *) oa_die "unknown part \"${2:-}\"" ;;
  esac
  if [ "$OA_FAILED" -gt 0 ]; then exit 1; fi
  exit 0
fi
main "$@"
