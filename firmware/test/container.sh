#!/bin/bash
# "A && oa_ok || oa_fail" is meant: oa_ok and oa_fail never fail. Single quotes hold programs for the shell and Node.js inside a container.
# shellcheck disable=SC2015,SC2016
# firmware/test/container.sh — check the container: build it, run it the
# hardened way, and look at what a security reviewer would look at.
#
#   firmware/test/container.sh [options]
#
# What it does, in order:
#   1. The release check, then the scripts (shellcheck) and the compose files
#      (read by Docker Compose: the hardening is in them).
#   2. host-setup.sh, tried in a scratch folder: written, repeated, checked,
#      removed; the same device rule and driver block list as the package.
#   3. The build, from the release files given here (no download): the image
#      carries the release file for file, a changed tarball stops the build.
#   4. What the image holds and does not hold (no compiler, git, curl, package
#      lists, set-user-id programs); its labels; its size.
#   5. The shipped compose.yaml run for real, with stand-ins for a radio stick
#      and for Flood-Net: the dashboard through the published port, readings
#      at the stand-in, the user and the capabilities of the process, the
#      read-only root, the health check, idle memory, a graceful stop.
#   6. The USB device rule, tried with a device file made for the purpose
#      (there is no USB on this computer): refused without the rule, let
#      through to the kernel with it.
#   7. The web proxy, with a private certificate authority, with and without
#      a password, with Flood-Net reachable only through the proxy.
#
# Options
#   --tarball FILE --sig FILE   the release already here (no download); also OA_AGENT_TARBALL, OA_AGENT_SIG
#   --image NAME                check this image instead of building one
#   --log-dir DIR               where the logs go (default: dist/test-logs/container)
#   --no-proxy                  leave out part 7
#   --soak SECONDS              how long to watch the agent's memory in part 5 (default 60)
#   -h, --help                  this text
#
# Nothing here is privileged, and no container shares this computer's network.
# Nothing here uses a real radio stick: this computer has none (it has no USB).
# Exit status: 0 when every check that ran passed; 1 when one failed; 2 when it
# was used wrongly or a tool is missing.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source-path=SCRIPTDIR
# shellcheck source=lib.sh
. "$HERE/lib.sh"

usage() { sed -n '4,/^set -euo/p' "${BASH_SOURCE[0]}" | sed '$d' | sed 's/^# \{0,1\}//'; }

CDIR="$OA_FIRMWARE/container"
P=oa-ctest                       # name of everything this test makes
IMAGE="$P-image"
GIVEN_IMAGE=''; TARBALL="${OA_AGENT_TARBALL:-}"; SIG="${OA_AGENT_SIG:-}"; DO_PROXY=1; SOAK=60
LOGDIR=''; WORK=''; PORT=18080

# ── clean up, always ─────────────────────────────────────────────────────────
cleanup() {
  local c
  for c in $(docker ps -aq --filter "name=$P" 2>/dev/null); do docker rm -f -v "$c" > /dev/null 2>&1 || true; done
  for c in $(docker network ls -q --filter "name=$P" 2>/dev/null); do docker network rm "$c" > /dev/null 2>&1 || true; done
  for c in $(docker volume ls -q --filter "name=$P" 2>/dev/null); do docker volume rm -f "$c" > /dev/null 2>&1 || true; done
  if [ -n "$WORK" ]; then rm -rf "$WORK"; fi
  if [ -z "$GIVEN_IMAGE" ]; then docker image rm -f "$IMAGE" > /dev/null 2>&1 || true; fi
}

# What a container prints, from inside: the Node.js program that reads /proc for us.
#   dx NAME JAVASCRIPT [ARGS…]
dx() { local name=$1 js=$2; shift 2; docker exec "$name" node -e "$js" "$@"; }

# The agent's own process inside a container, and a line of its /proc status.
AGENT_PID_JS='const fs=require("fs");let p="";for(const d of fs.readdirSync("/proc")){if(!/^\d+$/.test(d))continue;try{const c=fs.readFileSync("/proc/"+d+"/cmdline","utf8").split("\0");if(/(^|\/)node$/.test(c[0])&&c.includes("daemon")&&c.some(a=>a.endsWith("bin/rpi-alert"))){p=d;break}}catch(e){}}'
proc_status() {
  dx "$1" "$AGENT_PID_JS"'if(!p){console.log("NOPID");process.exit(1)}process.stdout.write(fs.readFileSync("/proc/"+p+"/status","utf8"))'
}

# ── the stand-ins, written for this test (as RPi ALERT's simulate.sh sets its own up) ─
write_rig() {
  local d=$WORK/sim
  mkdir -p "$d/bin" "$d/dev" "$d/sys/bus/usb/devices/1-1.3" "$d/scripts" "$d/tls"
  echo 0bda > "$d/sys/bus/usb/devices/1-1.3/idVendor"; echo 2838 > "$d/sys/bus/usb/devices/1-1.3/idProduct"
  echo 00000001 > "$d/sys/bus/usb/devices/1-1.3/serial"; echo RTLSDRBlog > "$d/sys/bus/usb/devices/1-1.3/manufacturer"
  echo "Blog V4" > "$d/sys/bus/usb/devices/1-1.3/product"; echo 1 > "$d/sys/bus/usb/devices/1-1.3/busnum"; echo 4 > "$d/sys/bus/usb/devices/1-1.3/devnum"
  # The agent's own stand-in for the rtl_sdr program (it is linked here, and found there: /sim/agent is mounted for this test only).
  ln -sf /sim/agent/test/helpers/fake-rtl_sdr "$d/bin/rtl_sdr"
  chmod -R a+rX "$d"
  # The Flood-Net stand-in (the agent's own test helper, which listens on this container's loopback only),
  # with a plain way in (8099) and, when given a key and certificate, an HTTPS way in (443) that says what was asked.
  cat > "$d/scripts/flood.js" <<'JS'
const { spawn } = require('node:child_process'), net = require('node:net'), https = require('node:https'), http = require('node:http'), fs = require('node:fs');
const [key, cert] = process.argv.slice(2);
spawn(process.execPath, ['/sim/agent/test/helpers/meganet-stub.js', '8098'], { stdio: 'inherit' });
net.createServer((c) => { const u = net.connect(8098, '127.0.0.1'); c.pipe(u); u.pipe(c); c.on('error', () => u.destroy()); u.on('error', () => c.destroy()); }).listen(8099, '0.0.0.0');
if (key) {
  https.createServer({ key: fs.readFileSync(key), cert: fs.readFileSync(cert) }, (req, res) => {
    console.log('FRONT ' + req.method + ' ' + req.url + ' host=' + req.headers.host);
    const up = http.request({ host: '127.0.0.1', port: 8098, method: req.method, path: req.url, headers: req.headers }, (r) => { res.writeHead(r.statusCode, r.headers); r.pipe(res); });
    up.on('error', () => { res.writeHead(502); res.end(); });
    req.pipe(up);
  }).listen(443, '0.0.0.0', () => console.log('front up'));
}
JS
  # A web proxy that only tunnels (CONNECT), to one name, and says who asked (as in deb.sh).
  cat > "$d/scripts/connect-proxy.js" <<'JS'
const http = require('node:http'), net = require('node:net');
const [name, user, pass] = process.argv.slice(2);
const want = user ? 'Basic ' + Buffer.from(user + ':' + pass).toString('base64') : '';
const s = http.createServer((req, res) => { console.log('PLAIN ' + req.method + ' ' + req.url); res.writeHead(405); res.end(); });
s.on('connect', (req, sock, head) => {
  const auth = req.headers['proxy-authorization'] || '';
  console.log('CONNECT ' + req.url + ' auth=' + (!auth ? 'none' : auth === want ? 'good' : 'other'));
  if (want && auth !== want) { sock.end('HTTP/1.1 407 Proxy Authentication Required\r\nProxy-Authenticate: Basic realm="test"\r\n\r\n'); return; }
  const [host, port] = req.url.split(':');
  if (host !== name) { sock.end('HTTP/1.1 403 Forbidden\r\n\r\n'); return; }
  const up = net.connect(Number(port), host, () => { sock.write('HTTP/1.1 200 Connection Established\r\n\r\n'); up.write(head); up.pipe(sock); sock.pipe(up); });
  up.on('error', () => sock.destroy()); sock.on('error', () => up.destroy());
});
s.listen(3128, '0.0.0.0', () => console.log('proxy up'));
JS
  # Adds the settings this test needs to the file the image started with: the agent's own settings file, as a person's would be.
  cat > "$d/scripts/settings.js" <<'JS'
const fs = require('node:fs');
const f = '/etc/rpi-alert/config.json';
const c = JSON.parse(fs.readFileSync(f, 'utf8'));
const add = JSON.parse(process.argv[2]);
for (const k of Object.keys(add)) c[k] = (add[k] && typeof add[k] === 'object' && !Array.isArray(add[k])) ? Object.assign({}, c[k], add[k]) : add[k];
fs.writeFileSync(f, JSON.stringify(c, null, 2) + '\n');
console.log(JSON.stringify(c));
JS
  chmod -R a+rX "$d"
}

# A compose override for one run: the shipped file, with this computer's stand-ins in place of
# the real USB folder, and a network of this test's making.  write_override NETWORK [EXTRA-ENV-LINES…]
write_override() {
  local net=$1 f=$WORK/override.yaml; shift
  {
    echo "services:"
    echo "  base:"
    echo "    container_name: $P-base"
    echo "    volumes: !override"
    echo "      - oa-settings:/etc/rpi-alert"
    echo "      - oa-data:/var/lib/rpi-alert"
    echo "      - $AGENT_TREE:/sim/agent:ro"
    echo "      - $WORK/sim/bin:/sim/bin:ro"
    echo "      - $WORK/sim/sys:/sim/sys:ro"
    echo "      - $WORK/sim/tls:/etc/open-alert-base:ro"
    echo "    tmpfs:"
    echo "      - /sim/dev:rw,uid=990,gid=990,mode=0755"
    echo "    environment:"
    echo "      PATH: /sim/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
    echo "      RPI_ALERT_SYSFS: /sim/sys"
    echo "      RPI_ALERT_DEV: /sim/dev"
    echo "      RPI_ALERT_FAKE_STICKS: '{\"1-1.3\":{\"frames\":\"2088:143,2089:12\"}}'"
    echo "    healthcheck:"
    echo "      interval: 5s"
    echo "      start_period: 5s"
    for l in "$@"; do echo "      $l"; done
    echo "networks:"
    echo "  default:"
    echo "    name: $net"
    echo "    external: true"
  } > "$f"
}
# $@ above lands under "environment:"? No: environment lines come after the healthcheck block, so
# they are written by their own function.
write_override_env() {
  local net=$1 f=$WORK/override.yaml; shift
  write_override "$net"
  # Put the extra environment lines in the right place: rewrite the file with them under "environment:".
  local tmp=$f.new
  awk -v extra="$(printf '%s\n' "$@")" '
    { print }
    /^      RPI_ALERT_FAKE_STICKS:/ { if (extra != "") { n = split(extra, a, "\n"); for (i = 1; i <= n; i++) if (a[i] != "") print "      " a[i] } }' "$f" > "$tmp"
  mv "$tmp" "$f"
}

compose() { docker compose -p "$P" -f "$CDIR/compose.yaml" -f "$WORK/override.yaml" "$@"; }

# Add the settings this test needs to the settings volume, as the image's own user.
apply_settings() {
  docker run --rm -u 990:990 --entrypoint node -v "$P"_oa-settings:/etc/rpi-alert -v "$WORK/sim/scripts:/sim/scripts:ro" "$IMAGE" /sim/scripts/settings.js "$1" > "$LOGDIR/settings-applied.txt" 2>&1
}
STANDIN_SETTINGS_PLAIN='{"name":"Test base","meganet":{"token":"mgn_test_token","endpoints":["http://'"$P"'-flood:8099/rest/v1"],"stationsUrls":["http://'"$P"'-flood:8099/stations.json"]},"location":{"source":"manual","lat":-27.4698,"lon":153.0251}}'

readings_arrived() { docker logs "$1" 2>&1 | grep -Eq '^ingest_http mgn_test_token .*"alert_id":2088'; }
dash_ok() { curl -fsS -m 5 "http://127.0.0.1:$PORT/api/status" -o "$WORK/status.json" 2>/dev/null; }

# ═════════════════════════════════════════════════════════════════════════════
# 1. release, scripts, compose files
# ═════════════════════════════════════════════════════════════════════════════
release_and_files() {
  oa_section "The release, the scripts and the compose files"
  TARBALL_DIR=$WORK/release-files; mkdir -p "$TARBALL_DIR"
  local tag; tag=$(oa_pin AGENT_TAG)
  if [ -z "$TARBALL" ]; then
    if "$OA_FIRMWARE/lib/fetch-agent.sh" --out "$WORK/agent-release" --download-dir "$TARBALL_DIR" > "$LOGDIR/fetch.txt" 2>&1; then oa_ok "the pinned release downloaded from GitHub and checked (firmware/lib/fetch-agent.sh)"; else oa_fail "the pinned release could not be had — see $LOGDIR/fetch.txt"; return 1; fi
  else
    cp "$TARBALL" "$TARBALL_DIR/rpi-alert-$tag-src.tar.gz"; cp "$SIG" "$TARBALL_DIR/rpi-alert-$tag-src.tar.gz.sig"
    if "$OA_FIRMWARE/lib/fetch-agent.sh" --out "$WORK/agent-release" --tarball "$TARBALL" --sig "$SIG" > "$LOGDIR/fetch.txt" 2>&1; then oa_ok "the release given here is the pinned one: hash and signature check (firmware/lib/fetch-agent.sh)"; else oa_fail "the release given here fails the check — see $LOGDIR/fetch.txt"; return 1; fi
  fi
  AGENT_TREE=$WORK/agent-release/agent
  if command -v shellcheck > /dev/null 2>&1; then
    if LC_ALL=C.UTF-8 shellcheck -x "$CDIR/build.sh" "$CDIR/host-setup.sh" "$HERE/container.sh" > "$LOGDIR/shellcheck.txt" 2>&1; then oa_ok "shellcheck: build.sh, host-setup.sh and this script, nothing to report"; else oa_fail "shellcheck has findings — see $LOGDIR/shellcheck.txt"; fi
  else oa_skip "shellcheck — it is not installed on this computer"; fi
  local bad=''
  for f in "$CDIR/build.sh" "$CDIR/host-setup.sh" "$HERE/container.sh"; do
    head -n 1 "$f" | grep -q '^#!/bin/bash$' || bad="$bad $(basename "$f")"
    grep -q '^set -euo pipefail$' "$f" || bad="$bad $(basename "$f")(set -e)"
  done
  oa_is "the three scripts are bash and stop at the first error" "" "$bad"
  oa_check "healthcheck.js parses" node --check "$CDIR/healthcheck.js"
  oa_check "config.default.json is JSON" node -e 'JSON.parse(require("fs").readFileSync(process.argv[1]))' "$CDIR/config.default.json"

  # The compose files, as Docker Compose reads them.
  local f json
  for f in compose.yaml compose.torizon.yaml; do
    json=$WORK/$f.json
    if OA_IMAGE=example/open-alert-base:test docker compose -f "$CDIR/$f" config --format json > "$json" 2> "$LOGDIR/compose-$f.err"; then oa_ok "$f: Docker Compose reads it"; else oa_fail "$f: Docker Compose does not read it — $(head -n 3 "$LOGDIR/compose-$f.err")"; continue; fi
    node -e '
      const c = JSON.parse(require("fs").readFileSync(process.argv[1])).services.base, bad = [];
      const need = (ok, what) => { if (!ok) bad.push(what); };
      need(JSON.stringify(c.cap_drop) === JSON.stringify(["ALL"]), "cap_drop ALL");
      need(!c.cap_add, "no cap_add");
      need(c.privileged !== true, "not privileged");
      need(c.network_mode !== "host" && !c.network_mode, "no host networking");
      need(c.pid !== "host" && c.ipc !== "host" && !c.userns_mode, "no host pid/ipc");
      need((c.security_opt || []).some(s => /^no-new-privileges(:|=)true$/.test(s)), "no-new-privileges");
      need(c.read_only === true, "read-only root");
      need((c.tmpfs || []).some(t => t.startsWith("/tmp")), "tmpfs /tmp");
      need(String(c.user) === "990:990", "user 990:990");
      need((c.ports || []).length === 1 && c.ports[0].host_ip === "127.0.0.1" && Number(c.ports[0].target) === 8080, "one published port, on 127.0.0.1");
      need((c.device_cgroup_rules || []).includes("c 189:* rmw"), "USB device rule");
      need((c.volumes || []).some(v => v.source === "/dev/bus/usb" && v.target === "/dev/bus/usb" && v.read_only === true), "/dev/bus/usb read-only");
      need(!(c.volumes || []).some(v => v.type === "bind" && !["/dev/bus/usb"].includes(v.source) && !/ca\.crt$/.test(v.source)), "no other host folder");
      need(!c.devices, "no devices listed by default");
      need(c.restart === "unless-stopped", "restart policy");
      need(c.logging && c.logging.options && c.logging.options["max-size"] && c.logging.options["max-file"], "log limits");
      need(Number(c.mem_limit) > 0, "memory limit");
      need(Number(c.pids_limit) > 0, "process limit");
      need(c.hostname, "hostname");
      need(c.environment && "HTTPS_PROXY" in c.environment && "NO_PROXY" in c.environment, "proxy variables");
      need(c.group_add && c.group_add.length === 1, "one extra group");
      console.log(bad.join("; ")); process.exit(bad.length ? 1 : 0);
    ' "$json" > "$WORK/hard.txt" 2>&1 && oa_ok "$f: every capability dropped, no-new-privileges, read-only root, tmpfs /tmp, user 990, one port on 127.0.0.1, USB device rule and read-only /dev/bus/usb only, no host networking or folders, restart policy, log and memory limits, hostname, proxy variables" || oa_fail "$f: missing hardening — $(cat "$WORK/hard.txt")"
  done
  if docker compose -f "$CDIR/compose.torizon.yaml" config > /dev/null 2>&1; then oa_fail "compose.torizon.yaml: reads without OA_IMAGE (it should ask for the image)"; else oa_ok "compose.torizon.yaml: refuses to start without OA_IMAGE (a board has nothing to build from)"; fi
  # The documented switches are written as comments: nothing is on until a person takes the "#" off.
  grep -q '^      # - "c 188:\* rmw"' "$CDIR/compose.yaml" && grep -q '^    # devices:' "$CDIR/compose.yaml" && oa_ok "compose.yaml: the serial-port rules are there, commented out" || oa_fail "compose.yaml: the commented serial-port rules are missing"
}

# ═════════════════════════════════════════════════════════════════════════════
# 2. host-setup.sh
# ═════════════════════════════════════════════════════════════════════════════
host_setup_checks() {
  oa_section "host-setup.sh (in a scratch folder: --root)"
  local r=$WORK/host-root out rc
  "$CDIR/host-setup.sh" --root "$r" > "$LOGDIR/host-setup-1.txt" 2>&1 && oa_ok "set up: both files written" || oa_fail "set up failed — see $LOGDIR/host-setup-1.txt"
  oa_has "… the device rule file is there" "$LOGDIR/host-setup-1.txt" '^written: /etc/udev/rules.d/60-open-alert-base.rules'
  oa_has "… and the driver block list" "$LOGDIR/host-setup-1.txt" '^written: /etc/modprobe.d/open-alert-base-blacklist-dvb.conf'
  "$CDIR/host-setup.sh" --root "$r" > "$LOGDIR/host-setup-2.txt" 2>&1 || true
  oa_has "run again: it says both are already in place" "$LOGDIR/host-setup-2.txt" '^already in place: /etc/udev'
  oa_has_not "… and writes nothing" "$LOGDIR/host-setup-2.txt" '^written:'
  # The same rule and block list as the native package's (the group name aside).
  local deb=$OA_FIRMWARE/deb/files/usr/lib
  oa_is "the device rule is the package's, line for line (comments aside)" "" "$(diff <(grep -v '^#' "$deb/udev/rules.d/60-open-alert-base.rules" | grep .) <(grep -v '^#' "$r/etc/udev/rules.d/60-open-alert-base.rules" | grep .) || true)"
  oa_is "the driver block list is the package's, line for line (comments aside)" "" "$(diff <(grep -v '^#' "$deb/modprobe.d/open-alert-base-blacklist-dvb.conf" | grep .) <(grep -v '^#' "$r/etc/modprobe.d/open-alert-base-blacklist-dvb.conf" | grep .) || true)"
  oa_has "the rule gives the stick to the group plugdev, mode 0660" "$r/etc/udev/rules.d/60-open-alert-base.rules" 'idProduct.*2838.*MODE="0660", GROUP="plugdev"'
  "$CDIR/host-setup.sh" --root "$r" --group usbradio > /dev/null 2>&1 || true
  oa_has "--group names another group" "$r/etc/udev/rules.d/60-open-alert-base.rules" 'GROUP="usbradio"'
  "$CDIR/host-setup.sh" --root "$r" --check > "$LOGDIR/host-setup-check.txt" 2>&1 || true
  oa_has "--check says both are present" "$LOGDIR/host-setup-check.txt" '^present: /etc/udev'
  "$CDIR/host-setup.sh" --root "$r" --remove > "$LOGDIR/host-setup-3.txt" 2>&1 && oa_ok "--remove runs" || oa_fail "--remove failed"
  if [ -e "$r/etc/udev/rules.d/60-open-alert-base.rules" ] || [ -e "$r/etc/modprobe.d/open-alert-base-blacklist-dvb.conf" ]; then oa_fail "--remove left a file behind"; else oa_ok "--remove took both files away"; fi
  "$CDIR/host-setup.sh" --root "$r" --remove > "$LOGDIR/host-setup-4.txt" 2>&1 && oa_has "--remove again: nothing to do, no complaint" "$LOGDIR/host-setup-4.txt" '^was not there' || oa_fail "--remove a second time failed"
  rc=0; "$CDIR/host-setup.sh" --bogus > /dev/null 2>&1 || rc=$?; oa_is "an unknown option: exit status 2" 2 "$rc"
  rc=0; "$CDIR/host-setup.sh" --group 'bad name' --root "$r" > /dev/null 2>&1 || rc=$?; oa_is "a group name with a space: exit status 2" 2 "$rc"
  out=$(setpriv --reuid nobody --regid nogroup --clear-groups "$CDIR/host-setup.sh" 2>&1 || true)
  if printf '%s' "$out" | grep -q 'needs the administrator account'; then oa_ok "without the administrator account it says so and changes nothing"; else oa_fail "run as an ordinary user it did not stop with a plain message: $out"; fi
}

# ═════════════════════════════════════════════════════════════════════════════
# 3 and 4. the build and what the image holds
# ═════════════════════════════════════════════════════════════════════════════
build_checks() {
  oa_section "The build"
  local t0 t1 size labels
  t0=$(date +%s)
  if [ -n "$GIVEN_IMAGE" ]; then
    docker tag "$GIVEN_IMAGE" "$IMAGE" || { oa_fail "image $GIVEN_IMAGE is not here"; return 1; }
    oa_note "checking the image given, $GIVEN_IMAGE; it was not built here"
  else
    if "$CDIR/build.sh" --release-dir "$TARBALL_DIR" --tag "$IMAGE" > "$LOGDIR/build.txt" 2>&1; then oa_ok "container/build.sh builds the image from the release files given here (no download)"; else oa_fail "the build failed — see $LOGDIR/build.txt"; tail -n 15 "$LOGDIR/build.txt"; return 1; fi
    t1=$(date +%s); oa_note "build time (the base image and Debian packages were cached or came over the network): $((t1 - t0)) s"
    if grep -Eq '[0-9]+ warnings? found|UndefinedVar' "$LOGDIR/build.txt"; then oa_fail "the build printed a warning — see $LOGDIR/build.txt"; else oa_ok "… with no build warning (Docker's own checks of the Dockerfile)"; fi
    # A changed tarball must stop the build.
    local bad=$WORK/bad-release; mkdir -p "$bad"
    cp "$TARBALL_DIR"/*.tar.gz "$TARBALL_DIR"/*.sig "$bad/"
    printf 'x' >> "$bad"/*.tar.gz
    if "$CDIR/build.sh" --release-dir "$bad" --tag "$P-bad" > "$LOGDIR/build-bad.txt" 2>&1; then oa_fail "a changed tarball did not stop the build"; docker image rm -f "$P-bad" > /dev/null 2>&1 || true
    else
      if grep -q 'REFUSED' "$LOGDIR/build-bad.txt"; then oa_ok "a changed tarball stops the build, with the release check's own refusal"; else oa_fail "the build with a changed tarball failed, but not with the release check's message — see $LOGDIR/build-bad.txt"; fi
    fi
  fi
  size=$(docker image inspect "$IMAGE" --format '{{.Size}}')
  oa_note "IMAGE SIZE: $((size / 1000000)) MB on disk ($(docker image inspect "$IMAGE" --format '{{.Architecture}}'))"
  if [ -z "$GIVEN_IMAGE" ]; then oa_note "IMAGE SIZE (compressed, as pulled from a registry): about $(docker save "$IMAGE" | gzip -1 | wc -c | awk '{printf "%d", $1/1000000}') MB"; fi

  oa_section "What the image holds"
  labels=$(docker image inspect "$IMAGE" --format '{{json .Config.Labels}}')
  local want='title description source licenses version revision created documentation base.name' l missing=''
  for l in $want; do printf '%s' "$labels" | grep -q "\"org.opencontainers.image.$l\":\"[^\"]" || missing="$missing $l"; done
  oa_is "the labels a registry shows are all there (title, description, source, licence, version, revision, created, documentation, base)" "" "$missing"
  oa_is "the version label is the pin's: agent version +oa revision" "$(oa_pin AGENT_VERSION)+oa$(oa_pin OA_REVISION)" "$(docker image inspect "$IMAGE" --format '{{index .Config.Labels "org.opencontainers.image.version"}}')"
  oa_is "the image's user is the number 990:990" "990:990" "$(docker image inspect "$IMAGE" --format '{{.Config.User}}')"
  oa_is "the image's volumes are the settings and the data" "/etc/rpi-alert /var/lib/rpi-alert" "$(docker image inspect "$IMAGE" --format '{{range $k, $v := .Config.Volumes}}{{$k}} {{end}}' | tr ' ' '\n' | sort | grep . | tr '\n' ' ' | sed 's/ $//')"
  oa_has "the image has a health check on the dashboard" <(docker image inspect "$IMAGE" --format '{{json .Config.Healthcheck.Test}}') 'healthcheck\.js'
  docker image inspect "$IMAGE" --format '{{range .Config.Env}}{{println .}}{{end}}' > "$WORK/image-env.txt"
  oa_has "RPI_ALERT_PRIV points at nothing (the agent can ask root for nothing)" "$WORK/image-env.txt" '^RPI_ALERT_PRIV=/nonexistent/'
  oa_has "RPI_ALERT_ASSUME_CLOCK=1 (the host keeps the time)" "$WORK/image-env.txt" '^RPI_ALERT_ASSUME_CLOCK=1$'
  local run=(docker run --rm --entrypoint sh "$IMAGE" -c)
  oa_is "no compiler, make, git, curl, wget, sudo or package-building tool in the image" "" "$("${run[@]}" 'for t in gcc cc g++ c++ make git curl wget sudo pkg-config python3 pip npm yarn; do command -v $t; done; true')"
  oa_is "no package lists and no downloaded packages left behind" "0 0" "$("${run[@]}" 'a=$(ls /var/lib/apt/lists 2>/dev/null | grep -vc "^lock$\|^partial$" || true); b=$(ls /var/cache/apt/archives/*.deb 2>/dev/null | wc -l); echo "$a $b"')"
  oa_is "no set-user-id or set-group-id file anywhere" "" "$("${run[@]}" 'find / -xdev -type f -perm /6000 2>/dev/null')"
  oa_is "no shell, git or build files from the release's other folders (test, scripts, os) in the image" "" "$("${run[@]}" 'ls -d /usr/lib/open-alert-base/agent/test /usr/lib/open-alert-base/agent/scripts /usr/lib/open-alert-base/os 2>/dev/null; true')"
  # The agent in the image is the release's, file for file.
  local inimg onhost
  inimg=$(docker run --rm --entrypoint sh "$IMAGE" -c "cd /usr/lib/open-alert-base/agent && for d in bin lib vendor web package.json; do find \$d -type f; done | LC_ALL=C sort | xargs sha256sum | sha256sum")
  onhost=$(cd "$AGENT_TREE" && for d in bin lib vendor web package.json; do find "$d" -type f; done | LC_ALL=C sort | xargs sha256sum | sha256sum)
  oa_is "the agent in the image is the release's, file for file (bin, lib, vendor, web, package.json)" "$onhost" "$inimg"
  oa_is "the agent's files are owned by root and cannot be written by the agent's user" "" "$(docker run --rm --entrypoint sh "$IMAGE" -c 'find /usr/lib/open-alert-base -writable 2>/dev/null | head -n 3')"
  oa_is "Node.js and rtl_sdr are the system's (Debian packages)" "ok ok" "$(docker run --rm --entrypoint sh "$IMAGE" -c 'dpkg -S /usr/bin/node >/dev/null 2>&1 && echo -n "ok " || echo -n "no "; dpkg -S /usr/bin/rtl_sdr >/dev/null 2>&1 && echo ok || echo no')"
  oa_note "the image holds Node.js $(docker run --rm --entrypoint node "$IMAGE" -p process.versions.node), $(docker run --rm --entrypoint sh "$IMAGE" -c 'dpkg-query -W rtl-sdr node-undici | tr "\t\n" " ;"')"
  oa_is "the agent starts as itself when asked for its version" "0.23.1" "$(docker run --rm "$IMAGE" version 2>&1 | grep -Eo '[0-9]+\.[0-9]+\.[0-9]+' | head -n 1)"
}

# ═════════════════════════════════════════════════════════════════════════════
# 5. the shipped compose file, run
# ═════════════════════════════════════════════════════════════════════════════
run_checks() {
  oa_section "compose.yaml, run, with stand-ins for a stick and for Flood-Net"
  local net=$P-net st mem rss t0 t1 health nodepid w ip f
  docker network create "$net" > /dev/null
  write_override_env "$net"
  # The shipped file names its image through OA_IMAGE.
  export OA_IMAGE=$IMAGE OA_DASHBOARD=127.0.0.1:$PORT
  docker run -d --name "$P-flood" --network "$net" --entrypoint node -v "$AGENT_TREE:/sim/agent:ro" -v "$WORK/sim/scripts:/sim/scripts:ro" "$IMAGE" /sim/scripts/flood.js > /dev/null
  oa_wait 20 docker logs "$P-flood" > /dev/null 2>&1; oa_wait 20 bash -c "docker logs $P-flood 2>&1 | grep -q ' stub on '" || oa_fail "the Flood-Net stand-in did not start"
  if compose create > "$LOGDIR/compose-create.txt" 2>&1; then oa_ok "docker compose create (the shipped compose.yaml, with this test's stand-ins mounted in place of /dev/bus/usb)"; else oa_fail "docker compose create failed — see $LOGDIR/compose-create.txt"; cat "$LOGDIR/compose-create.txt"; return 1; fi
  if apply_settings "$STANDIN_SETTINGS_PLAIN"; then oa_ok "the settings volume starts from the image's file and takes the stand-in's address"; else oa_fail "could not write the settings — see $LOGDIR/settings-applied.txt"; fi
  oa_is "… with the image's first settings in it (port 8080; hotspot, self-recovery, kiosk and audio off; remote management \"report\")" "8080 off off off off report" "$(node -e 'const c = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8")); console.log([c.web.port, c.hotspot.mode, c.recover.mode, c.kiosk.mode, c.audio.mode, c.remote.mode].join(" "))' "$LOGDIR/settings-applied.txt" 2>&1)"
  compose up -d > "$LOGDIR/compose-up.txt" 2>&1 && oa_ok "docker compose up -d" || { oa_fail "docker compose up failed — see $LOGDIR/compose-up.txt"; cat "$LOGDIR/compose-up.txt"; return 1; }
  if oa_wait 60 dash_ok; then oa_ok "the dashboard answers through the published port (127.0.0.1:$PORT)"; else oa_fail "the dashboard does not answer on 127.0.0.1:$PORT — see $LOGDIR/base.log"; docker logs "$P-base" > "$LOGDIR/base.log" 2>&1; fi
  oa_has "… it says it is RPi ALERT $(oa_pin AGENT_VERSION)" "$WORK/status.json" "\"version\":\"$(oa_pin AGENT_VERSION)\""
  oa_has "… the agent says its dashboard is on port 8080 (the port the image's settings ask for)" <(docker logs "$P-base" 2>&1) 'dashboard on http://[^ ]*:8080/'
  oa_has_not "… and the log has no \"cannot listen\" message" <(docker logs "$P-base" 2>&1) 'cannot listen'
  if oa_wait 120 readings_arrived "$P-flood"; then oa_ok "readings decoded from the stand-in stick reached the Flood-Net stand-in ($(docker logs "$P-flood" 2>&1 | grep -c '^ingest_http ') so far)"; else oa_fail "no decoded reading reached the stand-in in 120 s — see $LOGDIR/base.log"; fi
  docker logs "$P-base" > "$LOGDIR/base.log" 2>&1 || true
  oa_has "the agent says it found the stand-in stick" "$LOGDIR/base.log" '1-1\.3|RTL-SDR|rtl'
  # What a reviewer asks.
  oa_section "what the running container is"
  proc_status "$P-base" > "$LOGDIR/agent-status.txt" 2>&1 || true
  oa_has "the agent's process runs as user 990, group 990" "$LOGDIR/agent-status.txt" '^Uid:[[:space:]]+990[[:space:]]+990[[:space:]]+990[[:space:]]+990'
  for f in CapInh CapPrm CapEff CapBnd CapAmb; do oa_has "$f is zero (no capability of any kind)" "$LOGDIR/agent-status.txt" "^$f:[[:space:]]+0000000000000000\$"; done
  oa_has "no-new-privileges is set (NoNewPrivs: 1)" "$LOGDIR/agent-status.txt" '^NoNewPrivs:[[:space:]]+1$'
  oa_has "the system-call filter is on (Seccomp: 2)" "$LOGDIR/agent-status.txt" '^Seccomp:[[:space:]]+2$'
  st=$(docker inspect "$P-base" --format '{{.HostConfig.Privileged}} {{.HostConfig.ReadonlyRootfs}} {{.HostConfig.NetworkMode}} {{json .HostConfig.CapDrop}} {{json .HostConfig.SecurityOpt}} {{.HostConfig.PidMode}}|{{.HostConfig.IpcMode}}')
  oa_is "Docker's record: not privileged, read-only root, bridge network, capabilities dropped, no-new-privileges, no host pid or ipc" 'false true '"$P"'-net ["ALL"] ["no-new-privileges:true"] |private' "$st"
  oa_is "Docker's record of the published port: this computer only" '[{"HostIp":"127.0.0.1","HostPort":"'"$PORT"'"}]' "$(docker inspect "$P-base" --format '{{json (index .HostConfig.PortBindings "8080/tcp")}}')"
  oa_is "the device rule and the extra group are in Docker's record" 'c 189:* rmw|["46"]' "$(docker inspect "$P-base" --format '{{index .HostConfig.DeviceCgroupRules 0}}|{{json .HostConfig.GroupAdd}}')"
  ip=$(hostname -I 2>/dev/null | awk '{print $1}')
  if [ -n "$ip" ] && [ "$ip" != 127.0.0.1 ]; then
    if curl -fsS -m 4 "http://$ip:$PORT/" > /dev/null 2>&1; then oa_fail "the dashboard also answers on this computer's other address $ip"; else oa_ok "the dashboard does not answer on this computer's other address ($ip): it is published to the loopback address only"; fi
  else oa_skip "the dashboard on this computer's other address — this computer has none"; fi
  # Where the container listens, from inside.
  oa_is "inside, the only port the agent listens on is 8080 (Docker's own name service listens on 127.0.0.11 as well, and is not the agent's)" "8080" "$(dx "$P-base" 'const fs=require("fs");const out=new Set();for(const f of ["/proc/net/tcp","/proc/net/tcp6"]){try{for(const l of fs.readFileSync(f,"utf8").split("\n").slice(1)){const c=l.trim().split(/\s+/);if(c[3]==="0A"&&c[1]!=="0B00007F:"+c[1].split(":")[1])out.add(parseInt(c[1].split(":")[1],16))}}catch(e){}}console.log([...out].sort().join(" "))')"
  # The root filesystem.
  w=$(docker exec "$P-base" sh -c 'touch /usr/x 2>&1; touch /etc/x 2>&1; touch /usr/lib/open-alert-base/agent/x 2>&1; touch /var/x 2>&1' || true)
  oa_is "the root filesystem is read-only: four writes to /usr, /etc, the agent's folder and /var all refused" "4" "$(printf '%s\n' "$w" | grep -c 'Read-only file system')"
  oa_is "… while /tmp, the settings and the data can be written" "ok ok ok" "$(docker exec "$P-base" sh -c 'touch /tmp/x && echo -n "ok "; touch /etc/rpi-alert/x && echo -n "ok "; touch /var/lib/rpi-alert/x && echo ok; rm -f /etc/rpi-alert/x /var/lib/rpi-alert/x')"
  oa_has "/tmp is a memory folder that cannot run programs (noexec, nosuid, nodev)" <(docker exec "$P-base" sh -c 'grep " /tmp " /proc/mounts') 'tmpfs /tmp tmpfs .*nodev.*noexec|tmpfs /tmp tmpfs .*noexec.*nodev|tmpfs /tmp tmpfs .*nosuid.*noexec'
  oa_is "the user cannot become root: su and the like have no set-user-id bit" "" "$(docker exec "$P-base" sh -c 'ls -l /bin/su /usr/bin/su /usr/bin/mount /bin/mount 2>/dev/null | grep -E "^-..s|^-.....s" || true')"
  oa_is "the agent cannot ask root for anything: there is no helper at the path it is given" "no" "$(docker exec "$P-base" sh -c 'test -e "$RPI_ALERT_PRIV" && echo yes || echo no')"
  # The health check, as Docker runs it (every 5 s here, so the test need not wait a minute).
  health=''
  for _ in $(seq 1 40); do health=$(docker inspect "$P-base" --format '{{.State.Health.Status}}'); if [ "$health" = healthy ]; then break; fi; sleep 2; done
  oa_is "Docker runs the image's health check, and it says healthy" healthy "$health"
  oa_is "the health check command itself answers 0 when the dashboard is up" 0 "$(docker exec "$P-base" node /usr/lib/open-alert-base/healthcheck.js; echo $?)"
  # The agent's own command line, from inside.
  oa_has "the agent's own command line works inside: rpi-alert status" <(docker exec "$P-base" rpi-alert status 2>&1) '[0-9]+\.[0-9]+\.[0-9]+|version|Version'
  # Memory and size, idle (readings are coming in every few seconds: this is a working station, not an empty one).
  sleep 20
  mem=$(docker stats --no-stream --format '{{.MemUsage}}' "$P-base" | awk '{print $1}')
  docker exec "$P-base" node -e '
    const fs = require("fs");
    for (const d of fs.readdirSync("/proc")) {
      if (!/^\d+$/.test(d)) continue;
      try {
        const st = fs.readFileSync("/proc/" + d + "/status", "utf8"), cmd = fs.readFileSync("/proc/" + d + "/cmdline", "utf8").split("\0").filter(Boolean);
        if (cmd.some(a => a.includes("process.stdout") || a === "-e")) continue;
        const rss = /VmRSS:\s+(\d+)/.exec(st); const kind = /(^|\/)node$/.test(cmd[0]) && cmd.includes("daemon") ? "agent" : /init/.test(cmd[0]) ? "init" : /fake-rtl_sdr|rtl_sdr/.test(cmd.join(" ")) ? "stand-in rtl_sdr" : "other";
        console.log(kind + "\t" + (rss ? Math.round(rss[1] / 1024) : 0) + "\t" + cmd.join(" ").slice(0, 60));
      } catch (e) { /* gone */ }
    }' > "$LOGDIR/memory-by-process.txt" 2>&1 || true
  rss=$(awk -F'\t' '$1 == "agent" {print $2}' "$LOGDIR/memory-by-process.txt" | head -n 1)
  oa_note "IDLE MEMORY: the agent itself, ${rss:-?} MB resident; the whole container $mem as Docker counts it, which also holds the stand-in rtl_sdr (a Node.js program making radio noise, much larger than the real one); a stand-in stick decoding a burst every few seconds; by process: $(awk -F'\t' '{printf "%s %s MB; ", $1, $2}' "$LOGDIR/memory-by-process.txt")"
  # The agent's size, every 30 seconds (SOAK seconds in all): a trend, not a long run.
  local series='' t=0
  while [ "$t" -lt "$SOAK" ]; do
    sleep 30; t=$((t + 30))
    series="$series $(dx "$P-base" "$AGENT_PID_JS"'console.log(Math.round(/VmRSS:\s+([0-9]+)/.exec(fs.readFileSync("/proc/"+p+"/status","utf8"))[1]/1024))')"
  done
  oa_note "AGENT SIZE over time, the agent's resident memory in MB every 30 s after the reading above (stand-in stick decoding bursts; $(docker inspect "$P-base" --format '{{.State.OOMKilled}} {{.RestartCount}}' | awk '{print "out-of-memory kills: " $1 ", restarts: " $2}')):$series"
  oa_note "PROCESSES: $(docker exec "$P-base" sh -c 'ls -d /proc/[0-9]* | wc -l') in the container (the container's init, the agent, the stand-in rtl_sdr, and the listing itself)"
  # Stop and start again.
  t0=$(date +%s)
  compose stop > "$LOGDIR/compose-stop.txt" 2>&1; t1=$(date +%s)
  oa_is "docker compose stop ends it cleanly: exit status 0 or 143 (stopped by the signal), in under 15 seconds" "ok" "$(c=$(docker inspect "$P-base" --format '{{.State.ExitCode}}'); if { [ "$c" = 0 ] || [ "$c" = 143 ]; } && [ $((t1 - t0)) -lt 15 ]; then echo ok; else echo "exit $c after $((t1 - t0)) s"; fi)"
  oa_is "what the agent had kept is in the data volume, and survives" "yes" "$(docker run --rm --entrypoint sh -v "$P"_oa-data:/d:ro "$IMAGE" -c 'ls /d >/dev/null 2>&1 && [ -n "$(ls -A /d)" ] && echo yes || echo empty')"
  compose start > /dev/null 2>&1
  if oa_wait 60 dash_ok; then oa_ok "started again: the dashboard answers, with the settings and data of before"; else oa_fail "after a stop and start the dashboard does not answer"; fi
  docker logs "$P-base" > "$LOGDIR/base.log" 2>&1 || true
  # A restart policy brings it back after it dies (killed from outside).
  nodepid=$(dx "$P-base" "$AGENT_PID_JS"'console.log(p)')
  docker exec "$P-base" sh -c "kill -9 $nodepid" > /dev/null 2>&1 || true
  sleep 3
  if oa_wait 60 dash_ok && [ "$(docker inspect "$P-base" --format '{{.RestartCount}}')" -ge 1 ]; then oa_ok "the agent killed inside (as a crash would): the container ends, and Docker's restart policy brings it back (restarts so far: $(docker inspect "$P-base" --format '{{.RestartCount}}'))"; else oa_fail "after the agent was killed the container did not come back in 60 s ($(docker inspect "$P-base" --format '{{.State.Status}} exit {{.State.ExitCode}} restarts {{.RestartCount}}'))"; fi
  compose down -v > /dev/null 2>&1 || true
  docker rm -f "$P-flood" > /dev/null 2>&1 || true
  docker network rm "$net" > /dev/null 2>&1 || true
  # The same image with no stick at all: what the agent costs just for being there.
  docker run -d --name "$P-bare" --cap-drop ALL --security-opt no-new-privileges --read-only --tmpfs /tmp "$IMAGE" > /dev/null
  oa_wait 60 bash -c "docker logs $P-bare 2>&1 | grep -q 'dashboard on'" || oa_fail "the agent with no stick did not start"
  sleep 20
  oa_note "IDLE MEMORY with no stick at all: the agent itself $(dx "$P-bare" "$AGENT_PID_JS"'console.log(Math.round(/VmRSS:\s+([0-9]+)/.exec(fs.readFileSync("/proc/"+p+"/status","utf8"))[1]/1024))') MB resident; the container $(docker stats --no-stream --format '{{.MemUsage}}' "$P-bare" | awk '{print $1}') as Docker counts it"
  docker rm -f "$P-bare" > /dev/null 2>&1 || true
}

# ═════════════════════════════════════════════════════════════════════════════
# 6. the USB device rule, tried on a device file made for the purpose
# ═════════════════════════════════════════════════════════════════════════════
usb_rule_checks() {
  oa_section "The USB device rule (no USB here: a device file of the USB class is made, and opened)"
  local d=$WORK/fakeusb; mkdir -p "$d/001"
  if ! mknod "$d/001/004" c 189 3 2> "$LOGDIR/mknod.txt"; then oa_skip "the USB device rule — this computer would not make a device file (see $LOGDIR/mknod.txt)"; return 0; fi
  chown 0:46 "$d/001/004"; chmod 0660 "$d/001/004"
  # What opening it says: "ENXIO" means the open got past Docker's device rule and the file permission and reached the kernel,
  # which has no USB here; "EPERM" is the device rule's refusal; "EACCES" is the file permission's.
  local js='try{require("fs").closeSync(require("fs").openSync("/dev/bus/usb/001/004","r+"));console.log("opened")}catch(e){console.log(e.code)}'
  local base=(docker run --rm --cap-drop ALL --security-opt no-new-privileges --read-only -v "$d:/dev/bus/usb:ro" --entrypoint node)
  oa_is "no device rule: opening the stick's file is refused by Docker's device rule (EPERM)" EPERM "$("${base[@]}" --group-add 46 "$IMAGE" -e "$js")"
  oa_is "with the rule but not the group: the file's own permission refuses (EACCES)" EACCES "$("${base[@]}" --device-cgroup-rule 'c 189:* rmw' "$IMAGE" -e "$js")"
  local got; got=$("${base[@]}" --device-cgroup-rule 'c 189:* rmw' --group-add 46 "$IMAGE" -e "$js")
  case "$got" in
    ENXIO|opened) oa_ok "with the rule and the group (the compose file's two lines): the open reaches the kernel ($got: this computer has no USB driver behind the file, a real stick would answer)" ;;
    *) oa_fail "with the rule and the group the open gave \"$got\" (wanted ENXIO, or opened)" ;;
  esac
  oa_is "a read-only /dev/bus/usb mount does not stop the open (the answer above came through it), but nothing can be created in it" "ok" "$("${base[@]}" --device-cgroup-rule 'c 189:* rmw' --group-add 46 "$IMAGE" -e 'try{require("fs").writeFileSync("/dev/bus/usb/001/new","x");console.log("created")}catch(e){console.log("ok")}')"
  oa_is "a device of another kind (a disk, major 8) is refused even with the USB rule" EPERM "$(mknod "$d/001/disk" b 8 0 2>/dev/null && chown 0:46 "$d/001/disk" && chmod 0660 "$d/001/disk" && "${base[@]}" --device-cgroup-rule 'c 189:* rmw' --group-add 46 "$IMAGE" -e 'try{require("fs").closeSync(require("fs").openSync("/dev/bus/usb/001/disk","r+"));console.log("opened")}catch(e){console.log(e.code)}' || echo 'could not make the file')"
}

# ═════════════════════════════════════════════════════════════════════════════
# 7. the web proxy
# ═════════════════════════════════════════════════════════════════════════════
proxy_checks() {
  oa_section "The web proxy and a private certificate authority"
  local in=$P-in out=$P-out d=$WORK/sim/tls
  (
    cd "$d"
    openssl req -x509 -newkey rsa:2048 -nodes -keyout ca.key -out ca.crt -days 3 -subj "/CN=open-ALERT container test authority"
    openssl req -newkey rsa:2048 -nodes -keyout srv.key -out srv.csr -subj "/CN=flood.test"
    printf 'subjectAltName=DNS:flood.test,DNS:direct.test\nbasicConstraints=CA:FALSE\nextendedKeyUsage=serverAuth\n' > ext
    openssl x509 -req -in srv.csr -CA ca.crt -CAkey ca.key -CAcreateserial -out srv.crt -days 3 -extfile ext
    chmod 0644 ca.crt srv.crt srv.key; rm -f ca.key
  ) > "$LOGDIR/proxy-openssl.log" 2>&1 || { oa_fail "could not make the test certificates — see $LOGDIR/proxy-openssl.log"; return 0; }
  docker network create "$in" > /dev/null; docker network create "$out" > /dev/null
  export OA_IMAGE=$IMAGE OA_DASHBOARD=127.0.0.1:$PORT
  local mode user pass cred n
  for mode in none plain auth; do
    user=''; pass=''; cred=''
    if [ "$mode" = auth ]; then user=someone; pass=hunter2-oa-test; cred="$user:$pass@"; fi
    oa_section "proxy: $mode"
    # Flood-Net lives on the "out" network under the name flood.test: the agent's network cannot find it.
    # A second one, direct.test, is on the agent's own network (a name that is not to go through the proxy).
    docker run -d --name "$P-flood" --network "$out" --network-alias flood.test --entrypoint node -v "$AGENT_TREE:/sim/agent:ro" -v "$WORK/sim/scripts:/sim/scripts:ro" -v "$WORK/sim/tls:/sim/tls:ro" "$IMAGE" /sim/scripts/flood.js /sim/tls/srv.key /sim/tls/srv.crt > /dev/null
    docker run -d --name "$P-direct" --network "$in" --network-alias direct.test --entrypoint node -v "$AGENT_TREE:/sim/agent:ro" -v "$WORK/sim/scripts:/sim/scripts:ro" -v "$WORK/sim/tls:/sim/tls:ro" "$IMAGE" /sim/scripts/flood.js /sim/tls/srv.key /sim/tls/srv.crt > /dev/null
    docker run -d --name "$P-proxy" --network "$in" --entrypoint node -v "$WORK/sim/scripts:/sim/scripts:ro" "$IMAGE" /sim/scripts/connect-proxy.js flood.test $user $pass > /dev/null
    docker network connect "$out" "$P-proxy"
    for n in flood direct; do oa_wait 30 bash -c "docker logs $P-$n 2>&1 | grep -q 'front up'" || oa_fail "the HTTPS front of $n did not come up"; done
    oa_wait 20 bash -c "docker logs $P-proxy 2>&1 | grep -q 'proxy up'" || oa_fail "the proxy did not come up"
    write_override_env "$in" \
      'HTTPS_PROXY: "'"http://${cred}$P-proxy:3128"'"' \
      'NO_PROXY: "direct.test,localhost,127.0.0.1"' \
      'NODE_EXTRA_CA_CERTS: /etc/open-alert-base/ca.crt'
    if [ "$mode" = none ]; then
      # No proxy set: say so by leaving the variables empty.
      write_override_env "$in" 'NODE_EXTRA_CA_CERTS: /etc/open-alert-base/ca.crt'
    fi
    compose create > /dev/null 2>&1 || { oa_fail "docker compose create failed"; }
    apply_settings '{"name":"Test base","meganet":{"token":"mgn_test_token","endpoints":["https://flood.test/rest/v1"],"stationsUrls":["https://direct.test/stations.json"]},"location":{"source":"manual","lat":-27.4698,"lon":153.0251}}' || oa_fail "could not write the settings"
    compose up -d > "$LOGDIR/compose-up-proxy-$mode.txt" 2>&1 || oa_fail "docker compose up failed"
    if [ "$mode" = none ]; then
      oa_wait 60 bash -c "docker logs $P-base 2>&1 | grep -Eq 'ENOTFOUND|EAI_AGAIN|fetch failed|could not|not reach'" || true
      if readings_arrived "$P-flood"; then oa_fail "with no proxy set, readings reached flood.test (it should not be reachable)"; else oa_ok "with no proxy set, nothing reaches flood.test from the agent's network (so what follows really goes through the proxy)"; fi
      docker logs "$P-base" > "$LOGDIR/agent-proxy-none.log" 2>&1 || true
      oa_has "… the agent's log shows the failed call" "$LOGDIR/agent-proxy-none.log" 'ENOTFOUND|EAI_AGAIN|fetch failed|could not|not reach'
    else
      if oa_wait 120 readings_arrived "$P-flood"; then oa_ok "proxy $mode: readings reached Flood-Net's stand-in, which can only be reached through the proxy"; else oa_fail "proxy $mode: no reading reached the stand-in in 120 s — see $LOGDIR/agent-proxy-$mode.log"; fi
      docker logs "$P-base" > "$LOGDIR/agent-proxy-$mode.log" 2>&1 || true
      docker logs "$P-proxy" > "$LOGDIR/proxy-$mode.log" 2>&1 || true
      docker logs "$P-flood" > "$LOGDIR/flood-$mode.log" 2>&1 || true
      docker logs "$P-direct" > "$LOGDIR/direct-$mode.log" 2>&1 || true
      if [ "$mode" = auth ]; then oa_has "proxy $mode: the proxy was given the right name and password" "$LOGDIR/proxy-$mode.log" '^CONNECT flood\.test:443 auth=good$'
      else oa_has "proxy $mode: the proxy was asked for a tunnel to flood.test" "$LOGDIR/proxy-$mode.log" '^CONNECT flood\.test:443 auth=none$'; fi
      oa_has "proxy $mode: the readings arrived over HTTPS under the name flood.test (the private authority is trusted through NODE_EXTRA_CA_CERTS)" "$LOGDIR/flood-$mode.log" '^FRONT POST /rest/v1/rpc/ingest_http host=flood\.test$'
      if oa_wait 40 bash -c "docker logs $P-direct 2>&1 | grep -q '^FRONT GET /stations.json host=direct.test$'"; then oa_ok "proxy $mode: NO_PROXY is honoured — the station list (direct.test) was fetched without the proxy"; else oa_fail "proxy $mode: the station list was not fetched from direct.test"; fi
      docker logs "$P-proxy" > "$LOGDIR/proxy-$mode.log" 2>&1 || true
      oa_has_not "proxy $mode: … and the proxy never heard of direct.test" "$LOGDIR/proxy-$mode.log" 'direct\.test'
      if [ "$mode" = auth ]; then oa_has_not "proxy $mode: the proxy's password is not in the agent's log" "$LOGDIR/agent-proxy-$mode.log" "$pass"; fi
    fi
    compose down -v > /dev/null 2>&1 || true
    for n in flood direct proxy; do docker rm -f "$P-$n" > /dev/null 2>&1 || true; done
  done
  docker network rm "$in" "$out" > /dev/null 2>&1 || true
  oa_note "the proxy in this test is a few lines written for it (it tunnels, and can ask for a password); a real one, and a real inspecting network, have not been tried"
}

# ═════════════════════════════════════════════════════════════════════════════
main() {
  while [ $# -gt 0 ]; do
    case "$1" in
      --tarball) TARBALL="${2:?--tarball needs a file}"; shift 2 ;;
      --sig) SIG="${2:?--sig needs a file}"; shift 2 ;;
      --image) GIVEN_IMAGE="${2:?--image needs a name}"; shift 2 ;;
      --log-dir) LOGDIR="${2:?--log-dir needs a folder}"; shift 2 ;;
      --no-proxy) DO_PROXY=0; shift ;;
      --soak) SOAK="${2:?--soak needs a number of seconds}"; shift 2 ;;
      -h|--help) usage; exit 0 ;;
      *) oa_die "unknown option $1 (try --help)" ;;
    esac
  done
  if { [ -n "$TARBALL" ] && [ -z "$SIG" ]; } || { [ -z "$TARBALL" ] && [ -n "$SIG" ]; }; then oa_die "--tarball and --sig go together"; fi
  oa_need docker openssl curl tar sha256sum awk node setpriv
  docker info > /dev/null 2>&1 || oa_die "Docker is not running (or this user may not use it)"
  docker compose version > /dev/null 2>&1 || oa_die "Docker Compose (the \"docker compose\" command) is not installed"
  LOGDIR="${LOGDIR:-$OA_REPO/dist/test-logs/container}"
  rm -rf "$LOGDIR"; mkdir -p "$LOGDIR"; LOGDIR="$(cd "$LOGDIR" && pwd)"
  WORK=$(mktemp -d "${TMPDIR:-/tmp}/oa-test-container.XXXXXX"); chmod 0755 "$WORK"
  trap cleanup EXIT
  cleanup_before=$(docker ps -aq --filter "name=$P" | wc -l)
  [ "$cleanup_before" = 0 ] || oa_die "containers named $P* are here already: remove them first"
  oa_image debian:trixie-slim || oa_die "the base image debian:trixie-slim could not be had (tried Docker Hub and two mirrors)"

  echo "Checking the container open-alert-base — $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "On: $(sed -n 's/^PRETTY_NAME="\(.*\)"$/\1/p' /etc/os-release 2>/dev/null), $(uname -m), Docker $(docker version --format '{{.Server.Version}}' 2>/dev/null), Compose $(docker compose version --short 2>/dev/null)"
  echo "Logs: $LOGDIR"

  write_rig
  release_and_files || { oa_summary || true; exit 1; }
  host_setup_checks
  build_checks || { oa_summary || true; exit 1; }
  run_checks
  usb_rule_checks
  if [ "$DO_PROXY" = 1 ]; then proxy_checks; else oa_skip "the web proxy checks — left out (--no-proxy)"; fi
  oa_summary
}
main "$@"
