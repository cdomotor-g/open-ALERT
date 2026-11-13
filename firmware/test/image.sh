#!/bin/bash
# firmware/test/image.sh — start the disk image in a virtual machine, the way
# a freshly flashed computer starts, and check it from outside and from inside.
#
#   firmware/test/image.sh [options]
#
# What it does, in order:
#   1. Looks at the image file without starting it: the partitions, the boot
#      files and who signed them, the first set-up files, and that nothing in
#      it is one computer's own (no password, no SSH host key, no machine-id).
#   2. Makes a working copy on a larger "disk", and writes a first set-up file
#      into its CIDATA partition as a person would: the image's own example
#      (firmware/image/cidata/user-data) with parts switched on — a name, an
#      administrator account with an SSH key made for this run, the time
#      zone, a private certificate authority, a web proxy.
#   3. Starts it under QEMU with UEFI firmware, Secure Boot ON with Microsoft's
#      keys (unless --no-secure-boot), a network card, and an emulated USB
#      serial adapter that plays a receiver (a Quansheng ALERT radio's lines,
#      as RPi ALERT's scripts/simulate.sh sends them).
#   4. Checks from outside: a login prompt on the serial console, Secure Boot,
#      the dashboard through the network, that SSH refuses a password and
#      takes the key, that a port nobody opened is shut.
#   5. Checks from inside, over SSH: the first set-up was applied, the main
#      partition grew, no account has a password, security updates are on,
#      the service runs inside its sandbox (tried, not only read), systemd's
#      exposure score, the USB serial receiver is read by the sandboxed agent,
#      and a pretend radio stick — made with the kernel's own USB test driver,
#      carrying a real stick's USB ids — is given to the agent by the device
#      rule and opened by rtl_sdr inside the sandbox.
#   6. Lets Debian's own boot-loader update run and checks the boot files.
#   7. Puts the enterprise profile in force, restarts the computer, and
#      checks that everything came up again by itself, locked down.
#   8. With Secure Boot on: starts two more copies, one with a single bit
#      changed in shim and one with a single bit changed in GRUB, and checks
#      that neither is let through to the kernel.
#
# Options
#   --image FILE        the .img to check (default: dist/open-alert-base-<version>-<arch>-uefi.img)
#   --arch amd64|arm64  which image and which emulator (default: this computer's kind)
#   --no-secure-boot    start with Secure Boot off (it is then reported as not checked)
#   --no-restart        leave out part 7
#   --disk-size SIZE    size of the pretend disk the image is put on (default 8G)
#   --timeout SECONDS   how long to wait for a start (default: 240 with KVM, 1200 without)
#   --log-dir DIR       where the logs go (default: dist/test-logs/image)
#   --keep              keep the working copy of the disk afterwards
#
# It needs: qemu-system-x86_64 with the ovmf package (or qemu-system-aarch64
# with qemu-efi-aarch64), ssh, ssh-keygen, curl, jq, openssl, mtools, sfdisk;
# and, for some checks, sbverify (sbsigntool), debugfs (e2fsprogs) and socat —
# a check whose tool is missing is skipped and says so. It does not need root.
# With /dev/kvm it takes a few minutes; without, QEMU emulates the processor
# and it takes ten to twenty.
#
# Exit status: 0 when every check that ran passed; 1 when one failed; 2 when
# it was used wrongly or a tool is missing.
#
# What this does NOT show: that the image starts on any real computer, or
# that a real radio stick is heard. The machine is QEMU's; the receiver and
# the stick are pretend. See "What has been tested, and where" in
# firmware/README.md.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source-path=SCRIPTDIR
# shellcheck source=lib.sh
. "$HERE/lib.sh"

usage() { sed -n '2,/^set -euo/p' "${BASH_SOURCE[0]}" | sed '$d' | sed 's/^# \{0,1\}//'; }

# The highest exposure score (systemd-analyze security; 0 closed … 10 open)
# the service may have before a check fails. The same limit as test/deb.sh.
MAX_EXPOSURE=2.5

# ═════════════════════════════════════════════════════════════════════════════
# Inside the virtual machine (run there as root: "image.sh --inside PART …")
# ═════════════════════════════════════════════════════════════════════════════

UNIT=open-alert-base.service
FW_UNIT=open-alert-base-firewall.service
G_OUT=/root/oa-image-test          # what the checks inside leave for the next part

# A field of the agent's own status, read on this computer.   g_status 'd.devices.ports.length'
g_status() {
  node -e '
    const [url, expr] = process.argv.slice(1);
    fetch(url, { signal: AbortSignal.timeout(8000) }).then((r) => r.json())
      .then((d) => { const v = Function("d", "return (" + expr + ")")(d); process.stdout.write(typeof v === "string" ? v : JSON.stringify(v)); })
      .catch((e) => { process.stdout.write("ERROR " + e.message); process.exitCode = 1; });
  ' "http://127.0.0.1:${G_PORT:-80}/api/status" "$1" 2>/dev/null
}
g_pid() { systemctl show -p MainPID --value "$UNIT"; }
# Run a command as root from inside the service's own group of processes
# (its "control group"), which is where systemd puts the list of devices the
# service may open. Root is held to that list too.
g_in_service_group() {
  local cg
  cg="/sys/fs/cgroup$(sed -n 's/^0:://p' "/proc/$(g_pid)/cgroup")"
  ( echo "$BASHPID" > "$cg/cgroup.procs" && exec "$@" )
}
# shellcheck disable=SC2016  # the text is for the shell that is started, not this one
g_can_open() { g_in_service_group sh -c 'exec 3<"$1"' sh "$1" 2>&1; }
g_score() {
  systemd-analyze security --no-pager "$UNIT" 2>/dev/null | sed -n 's/.*Overall exposure level for [^:]*: *\([0-9.]*\).*/\1/p' | tail -n 1
}
g_score_check() {     # g_score_check "profile name"
  local score
  score=$(g_score)
  if [ -z "$score" ]; then oa_fail "systemd-analyze security gave no score"; return; fi
  oa_note "EXPOSURE SCORE of the running service, $1 profile: $score  (systemd-analyze security; 0 is most closed, 10 most open)"
  if awk -v s="$score" -v m="$MAX_EXPOSURE" 'BEGIN { exit !(s <= m) }'; then oa_ok "the exposure score ($score) is within the limit set for this check ($MAX_EXPOSURE)"
  else oa_fail "the exposure score is $score, above the limit of $MAX_EXPOSURE"; fi
}

# ── part: the computer as it came up, standard profile ───────────────────────
# Arguments: the agent's version, the name and time zone the set-up file gave,
# "yes" when Secure Boot should be on, the size of the disk in bytes, a line
# of the certificate that was handed over, the proxy address that was set.
inside_standard() {
  local want_version=$1 want_name=$2 want_zone=$3 want_sb=$4 disk_bytes=$5 ca_line=$6 want_proxy=$7
  local got pid root_dev disk part_end disk_end fs_bytes n f
  mkdir -p "$G_OUT"

  oa_section "Inside: the computer as it came up"
  oa_note "$(. /etc/os-release && echo "$PRETTY_NAME") $(cat /etc/debian_version), kernel $(uname -r), systemd $(systemctl --version | awk 'NR == 1 {print $2}'), Node.js $(node -p process.versions.node), rtl-sdr $(dpkg-query -W -f '${Version}' rtl-sdr)"
  # systemd's own verdict on the start: "running" means nothing failed.
  # shellcheck disable=SC2016  # the text is for the shell that is started, not this one
  oa_wait 180 sh -c 'case "$(systemctl is-system-running 2>/dev/null)" in running|degraded) exit 0 ;; *) exit 1 ;; esac' || true
  got=$(systemctl is-system-running 2>/dev/null || true)
  if [ "$got" = running ]; then oa_ok "systemd says the computer came up whole (\"running\": no unit failed)"
  else oa_fail "systemd says \"$got\" — failed units: $(systemctl --failed --no-legend --plain | awk '{print $1}' | tr '\n' ' ')"; fi
  systemd-analyze time 2>/dev/null | head -n 1 | sed 's/^/note  /' || true

  if [ "$want_sb" = yes ]; then
    oa_is "Secure Boot, as the running system reports it (mokutil --sb-state)" "SecureBoot enabled" "$(mokutil --sb-state 2>&1 | head -n 1)"
    if grep -q '\[integrity\]\|\[confidentiality\]' /sys/kernel/security/lockdown 2>/dev/null; then oa_ok "the kernel is in lockdown, as Debian's kernel is whenever Secure Boot is on ($(cat /sys/kernel/security/lockdown))"
    else oa_fail "the kernel is not in lockdown: $(cat /sys/kernel/security/lockdown 2>&1)"; fi
  else
    oa_note "Secure Boot as the running system reports it: $(mokutil --sb-state 2>&1 | head -n 1)"
  fi

  oa_section "Inside: the first set-up file was applied"
  got=$(cloud-init status --long 2>&1 || true)
  printf '%s\n' "$got" > "$G_OUT/cloud-init-status.txt"
  if printf '%s' "$got" | grep -q '^status: done' && printf '%s' "$got" | grep -q '^errors: \[\]'; then oa_ok "cloud-init finished without an error"
  else oa_fail "cloud-init: $(printf '%s' "$got" | tr '\n' ' ' | cut -c1-300)"; fi
  if printf '%s' "$got" | grep -q 'DataSourceNoCloud.*seed=/dev/'; then oa_ok "the set-up came from the disk's own CIDATA partition ($(printf '%s' "$got" | sed -n 's/^detail: //p'))"
  else oa_fail "the set-up did not come from the CIDATA partition: $(printf '%s' "$got" | sed -n 's/^detail: //p')"; fi
  oa_is "the computer's name is the one in user-data" "$want_name" "$(hostname)"
  oa_is "the time zone is the one in user-data" "$want_zone" "$(timedatectl show -p Timezone --value)"
  if id admin >/dev/null 2>&1 && id -nG admin | tr ' ' '\n' | grep -qx sudo; then oa_ok "the administrator account was made, in the group that may use sudo"
  else oa_fail "the administrator account is not there or not in the sudo group: $(id admin 2>&1)"; fi
  if grep -qF "$ca_line" /etc/ssl/certs/ca-certificates.crt 2>/dev/null; then oa_ok "the private certificate authority from user-data is in the operating system's list of trusted authorities"
  else oa_fail "the certificate authority from user-data is not in /etc/ssl/certs/ca-certificates.crt"; fi
  oa_has "the web proxy from user-data is in the service's surroundings file" /etc/open-alert-base/env "^HTTPS_PROXY=$want_proxy\$"
  oa_is "… and that file is still readable by root alone (owner, group, mode)" "root root 640" "$(stat -c '%U %G %a' /etc/open-alert-base/env)"
  pid=$(g_pid)
  if tr '\0' '\n' < "/proc/$pid/environ" | grep -qx "HTTPS_PROXY=$want_proxy"; then oa_ok "the running agent was restarted by the set-up file and has the proxy"
  else oa_fail "the running agent does not have HTTPS_PROXY=$want_proxy in its surroundings"; fi
  if journalctl -u "$UNIT" --no-pager 2>/dev/null | grep -q "sending through the web proxy $want_proxy"; then oa_ok "its log says it sends through the proxy"
  else oa_fail "the service's log has no line about the web proxy"; fi

  oa_section "Inside: what is this computer's own was made here, at its first start"
  got=$(cat /etc/machine-id 2>/dev/null || true)
  if printf '%s' "$got" | grep -Eq '^[0-9a-f]{32}$'; then oa_ok "a machine-id was made (the image's file is empty)"; else oa_fail "/etc/machine-id holds \"$got\""; fi
  printf '%s\n' "$got" > "$G_OUT/machine-id"
  n=$(find /etc/ssh -maxdepth 1 -name 'ssh_host_*_key' | wc -l)
  if [ "$n" -ge 1 ]; then oa_ok "SSH host keys were made ($n; the image holds none): $(ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub 2>/dev/null | awk '{print $2}')"
  else oa_fail "there are no SSH host keys"; fi
  got=$(find /var/lib/rpi-alert -maxdepth 1 -name 'web-password.txt' | wc -l)
  oa_is "the dashboard's first password was made by this computer's agent (its file is here; the image's data folder is empty)" 1 "$got"

  oa_section "Inside: the main partition grew to fill the disk"
  root_dev=$(findmnt -no SOURCE /)
  disk="/dev/$(lsblk -no PKNAME "$root_dev")"
  part_end=$(( $(cat "/sys/class/block/${root_dev#/dev/}/start") + $(cat "/sys/class/block/${root_dev#/dev/}/size") ))
  disk_end=$(cat "/sys/class/block/${disk#/dev/}/size")
  fs_bytes=$(findmnt -bno SIZE /)
  oa_is "the disk the computer sees is the size it was given" "$disk_bytes" "$(lsblk -bdno SIZE "$disk")"
  # The last 33 sectors of a GPT disk hold the spare copy of the partition table.
  if [ $((disk_end - part_end)) -le 4096 ]; then oa_ok "the main partition ($root_dev) now ends at the end of the disk ($((disk_end - part_end)) sectors short, the partition table's spare copy)"
  else oa_fail "the main partition ends $((disk_end - part_end)) sectors before the end of the disk"; fi
  if [ "$fs_bytes" -ge $((disk_bytes * 85 / 100)) ]; then oa_ok "the file system grew with it: $((fs_bytes / 1048576)) MB on a $((disk_bytes / 1048576)) MB disk"
  else oa_fail "the file system is $((fs_bytes / 1048576)) MB on a $((disk_bytes / 1048576)) MB disk"; fi

  oa_section "Inside: accounts, SSH, updates, time, firewall"
  got=$(awk -F: '$2 !~ /^[!*]/ {print $1}' /etc/shadow | tr '\n' ' ')
  oa_is "no account can be opened with a password (every password field in /etc/shadow is locked)" "" "$got"
  oa_is "… root's included" "L" "$(passwd -S root | awk '{print $2}')"
  got=$(sshd -T 2>/dev/null | grep -E '^(passwordauthentication|kbdinteractiveauthentication|permitrootlogin) ' | sort | tr '\n' ' ')
  oa_is "SSH as the running server reads its settings: no passwords, no root" "kbdinteractiveauthentication no passwordauthentication no permitrootlogin no " "$got"
  got="$(apt-config dump APT::Periodic::Update-Package-Lists | cut -d'"' -f2) $(apt-config dump APT::Periodic::Unattended-Upgrade | cut -d'"' -f2)"
  oa_is "automatic updates are on: look for updates every day, install them every day" "1 1" "$got"
  for f in apt-daily.timer apt-daily-upgrade.timer; do
    oa_is "… $f is on and waiting" "enabled active" "$(systemctl is-enabled "$f" 2>&1) $(systemctl is-active "$f" 2>&1)"
  done
  got=$(unattended-upgrade --dry-run --debug 2>&1 | grep -i 'Allowed origins' | head -n 1)
  if printf '%s' "$got" | grep -q 'Debian-Security'; then oa_ok "unattended-upgrades reads its settings and will take Debian's security updates"
  else oa_fail "unattended-upgrade --dry-run did not name Debian-Security among its sources: $got"; fi
  got=$(grep -h '^URIs:' /etc/apt/sources.list.d/*.sources 2>/dev/null | sort -u | tr '\n' ' ')
  oa_is "updates come from Debian's own two addresses and nowhere else" "URIs: https://deb.debian.org/debian URIs: https://security.debian.org/debian-security " "$got"
  # Whether Debian's archive can be reached depends on where this check runs.
  if timeout 120 apt-get update -o Acquire::Retries=0 -o Acquire::http::Timeout=20 -o Acquire::https::Timeout=20 > "$G_OUT/apt-update.txt" 2>&1 && ! grep -q '^\(W\|E\|Err\)' "$G_OUT/apt-update.txt"; then
    oa_ok "apt-get update: Debian's archive answered and its signatures checked"
    if timeout 600 unattended-upgrade --dry-run > "$G_OUT/unattended-dry-run.txt" 2>&1; then oa_ok "unattended-upgrade --dry-run went through against the real archive"
    else oa_fail "unattended-upgrade --dry-run failed: $(tail -n 3 "$G_OUT/unattended-dry-run.txt" | tr '\n' ' ')"; fi
  else
    oa_skip "fetching from Debian's archive — it cannot be reached from this virtual machine ($(grep -m1 -E '^(W|E|Err)' "$G_OUT/apt-update.txt" | cut -c1-140))"
  fi
  oa_is "the time service is on (systemd-timesyncd)" "enabled active" "$(systemctl is-enabled systemd-timesyncd 2>&1) $(systemctl is-active systemd-timesyncd 2>&1)"
  oa_note "is the clock set from the network yet? $(timedatectl show -p NTPSynchronized --value) (the agent sends nothing until it is; whether a time server can be reached depends on where this check runs)"
  if nft list table inet open_alert_image > "$G_OUT/nft-image.txt" 2>&1 && grep -q 'policy drop' "$G_OUT/nft-image.txt"; then oa_ok "the image's firewall is loaded: what comes in is thrown away unless it is on the list"
  else oa_fail "the image's firewall table is not loaded"; fi
  oa_is "… and loads at every start (nftables.service)" "enabled active" "$(systemctl is-enabled nftables 2>&1) $(systemctl is-active nftables 2>&1)"
  ss -Hltnup > "$G_OUT/listening.txt" 2>&1 || true
  got=$(awk '$1 == "tcp" { a = $5; p = a; sub(/.*:/, "", p); sub(/:[^:]*$/, "", a);
                           if (a !~ /^127\./ && a != "[::1]") print p }' "$G_OUT/listening.txt" | sort -un | tr '\n' ' ')
  oa_is "the only TCP ports open to other computers are SSH and the dashboard" "22 80 " "$got"
  oa_note "everything that listens (ss -ltnu): $(awk '{print $1 " " $5}' "$G_OUT/listening.txt" | tr '\n' ';')"

  oa_section "Inside: the base station service, and its sandbox"
  oa_is "the service is running and set to start with the computer" "active enabled" "$(systemctl is-active "$UNIT" 2>&1) $(systemctl is-enabled "$UNIT" 2>&1)"
  pid=$(g_pid)
  oa_is "it runs as the user rpi-alert" "$(id -u rpi-alert)" "$(oa_proc_status "$pid" Uid | awk '{print $2}')"
  oa_is "its only privilege is CAP_NET_BIND_SERVICE (for port 80), and it can get no other" "0000000000000400 0000000000000400" "$(oa_proc_status "$pid" CapEff) $(oa_proc_status "$pid" CapBnd)"
  oa_is "no-new-privileges is on" "1" "$(oa_proc_status "$pid" NoNewPrivs)"
  oa_is "the system-call filter is on" "2" "$(oa_proc_status "$pid" Seccomp)"
  # Tried, not only read: as the agent's user, from inside the service's own view of the disk.
  P=(nsenter --target "$pid" --mount -- setpriv --reuid rpi-alert --regid rpi-alert --init-groups)
  for f in /usr /etc /var; do
    got=$("${P[@]}" touch "$f/oa-probe" 2>&1 || true)
    case "$got" in *"Read-only file system"*) oa_ok "the agent's user cannot write in $f: the disk is read-only to the service (\"Read-only file system\")" ;;
      *) oa_fail "writing in $f from inside the service: ${got:-it worked}" ;; esac
  done
  oa_check "but it can write in its settings folder" "${P[@]}" sh -c 'touch /etc/rpi-alert/.oa-probe && rm /etc/rpi-alert/.oa-probe'
  oa_check "… and in its data folder" "${P[@]}" sh -c 'touch /var/lib/rpi-alert/.oa-probe && rm /var/lib/rpi-alert/.oa-probe'
  oa_check_not "it cannot read the file where a proxy's password would be" "${P[@]}" cat /etc/open-alert-base/env
  oa_check_not "it cannot look into /home" "${P[@]}" ls /home
  touch /tmp/oa-outside
  oa_check_not "it has a /tmp of its own" "${P[@]}" test -e /tmp/oa-outside
  rm -f /tmp/oa-outside
  # The device list, tried by root from inside the service's group of processes.
  oa_is "systemd holds a closed device list for the service" "closed" "$(systemctl show -p DevicePolicy --value "$UNIT")"
  got=$(g_can_open "$root_dev" || true)
  case "$got" in *"Operation not permitted"*) oa_ok "inside the service's group even root is refused the disk ($root_dev: \"Operation not permitted\")" ;;
    *) oa_fail "opening $root_dev from inside the service's group: ${got:-it worked}" ;; esac
  got=$(g_can_open /dev/kmsg || true)
  case "$got" in *"Operation not permitted"*) oa_ok "… and the kernel's log (/dev/kmsg)" ;; *) oa_fail "opening /dev/kmsg from inside the service's group: ${got:-it worked}" ;; esac
  # shellcheck disable=SC2016  # the text is for the shell that is started, not this one
  oa_check "… while outside that group root can open the disk (so it is the list that refuses)" sh -c 'exec 3<"$1"' sh "$root_dev"
  g_score_check standard
  if oa_wait 30 oa_http_ok http://127.0.0.1:80/; then oa_ok "the dashboard answers on port 80 on the computer itself"; else oa_fail "the dashboard does not answer on 127.0.0.1:80"; fi
  oa_is "the agent says it is the pinned version" "$want_version" "$(g_status d.version)"
  if open-alert-base audit > "$G_OUT/audit-standard.txt" 2>&1; then oa_ok "open-alert-base audit runs (kept with the logs)"; else oa_fail "open-alert-base audit failed"; fi
  oa_check "open-alert-base status" open-alert-base status
  oa_is "every installed agent file is the signed release's" "0" "$(cd /usr/lib/open-alert-base/agent && sha256sum --quiet -c /usr/share/open-alert-base/agent.sha256 2>&1 | wc -l)"
  n=$(journalctl -u "$UNIT" --no-pager 2>/dev/null | grep -Eci 'operation not permitted|EPERM|permission denied|EACCES|bad system call' || true)
  journalctl -u "$UNIT" --no-pager > "$G_OUT/journal-standard.txt" 2>&1 || true
  if [ "${n:-0}" = 0 ]; then oa_ok "nothing in the agent's log says the sandbox refused it something it needed"
  else oa_fail "the agent's log has $n line(s) about something refused: $(grep -Ei 'operation not permitted|EPERM|permission denied|EACCES|bad system call' "$G_OUT/journal-standard.txt" | head -n 3)"; fi

  oa_section "Inside: an emulated USB serial receiver, read by the sandboxed agent"
  oa_is "the two USB serial drivers were loaded when the computer started" "cdc_acm usbserial " "$(lsmod | awk '$1 == "usbserial" || $1 == "cdc_acm" {print $1}' | sort | tr '\n' ' ')"
  if [ -c /dev/ttyUSB0 ]; then
    oa_is "the adapter is a USB serial port for the group dialout (owner, group, mode)" "root dialout 660" "$(stat -c '%U %G %a' /dev/ttyUSB0)"
    got=$(g_can_open /dev/ttyUSB0 || true)
    oa_is "the service's device list lets it be opened" "" "$got"
    if oa_wait 120 sh -c "node -e 'fetch(\"http://127.0.0.1:80/api/status\").then(r => r.json()).then(d => process.exit(d.devices.ports.some(p => p.rx > 0 && p.state === \"running\") ? 0 : 1)).catch(() => process.exit(1))'"; then
      oa_ok "the agent — user rpi-alert, inside the sandbox — opened it and reads the receiver: $(g_status 'd.devices.ports.map(p => p.name + " on " + p.port.dev + " (" + p.how + "), " + p.rx + " bytes read, " + p.state).join("; ")')"
    else
      oa_fail "the agent does not read the USB serial port: $(g_status 'd.devices.ports')"
    fi
    oa_is "it took the lines for what they are: a Quansheng ALERT radio" "quansheng" "$(g_status 'd.devices.ports[0] && d.devices.ports[0].kind')"
  else
    oa_skip "the USB serial receiver — the virtual machine has no /dev/ttyUSB0 ($(lsusb 2>/dev/null | grep -c . || true) USB devices seen)"
  fi

  # A little server for the firewall check from outside: it says "open" to
  # whoever reaches it, on one port the firewall lets in (8080) and one it
  # does not (9999). It goes away twenty seconds after it has been reached
  # (the enterprise profile wants port 8080 later), or after three minutes.
  nohup node -e '
    const net = require("net");
    let reached = false;
    for (const p of [8080, 9999]) net.createServer((s) => {
      s.end("open " + p + "\n");
      if (!reached) { reached = true; setTimeout(() => process.exit(0), 20000); }
    }).listen(p, "0.0.0.0");
    setTimeout(() => process.exit(0), 180000);' < /dev/null > /dev/null 2>&1 &
  oa_wait 60 sh -c 'ss -Hltn | grep -q ":9999 "' || oa_note "the little server for the firewall check did not start"
}

# ── part: a pretend radio stick ──────────────────────────────────────────────
# The kernel has a test driver (dummy_hcd) that plays both ends of a USB cable
# in software: a "device" described here appears on a pretend USB port just as
# a plugged-in one would, to udev, to the agent and to rtl_sdr. The device is
# given an RTL-SDR Blog stick's USB ids (0bda:2838). There is no radio chip
# behind it, so rtl_sdr gets no samples: what this shows is everything up to
# that point — the rule that hands the stick to the agent's group, the TV
# driver being kept off it, and the sandboxed service being allowed to open it.
inside_stick() {
  local g=/sys/kernel/config/usb_gadget/oa-test d dev node got udc
  oa_section "Inside: a pretend radio stick (the kernel's USB test driver, with a real stick's USB ids)"
  if ! modprobe dummy_hcd 2>/dev/null || ! modprobe libcomposite 2>/dev/null; then
    oa_skip "the pretend stick — this kernel has no USB test driver (dummy_hcd, libcomposite)"; return 0
  fi
  mountpoint -q /sys/kernel/config || mount -t configfs none /sys/kernel/config
  mkdir -p "$g/strings/0x409" "$g/configs/c.1"
  echo 0x0bda > "$g/idVendor"; echo 0x2838 > "$g/idProduct"
  echo 00000001 > "$g/strings/0x409/serialnumber"; echo RTLSDRBlog > "$g/strings/0x409/manufacturer"; echo "Blog V4" > "$g/strings/0x409/product"
  if ! mkdir "$g/functions/Loopback.0" 2>/dev/null; then
    oa_skip "the pretend stick — this kernel cannot make the test device (no \"Loopback\" function)"; rmdir "$g/configs/c.1" "$g/strings/0x409" "$g" 2>/dev/null || true; return 0
  fi
  ln -s "$g/functions/Loopback.0" "$g/configs/c.1/"
  udc=$(find /sys/class/udc -mindepth 1 -maxdepth 1 -printf '%f\n' | head -n 1)
  echo "$udc" > "$g/UDC"
  dev=''
  for _ in $(seq 1 40); do
    for d in /sys/bus/usb/devices/*; do
      if [ "$(cat "$d/idVendor" 2>/dev/null):$(cat "$d/idProduct" 2>/dev/null)" = "0bda:2838" ]; then dev=$d; fi
    done
    [ -n "$dev" ] && break
    sleep 0.5
  done
  if [ -z "$dev" ]; then oa_fail "the pretend stick did not appear on the USB bus"; return 0; fi
  udevadm settle --timeout=20 || true
  node=$(printf '/dev/bus/usb/%03d/%03d' "$(cat "$dev/busnum")" "$(cat "$dev/devnum")")
  oa_ok "it appeared as a USB device: $(lsusb -d 0bda:2838 | head -n 1) ($node)"
  oa_is "the package's device rule gave it to the agent's group and nobody else (owner, group, mode)" "root plugdev 660" "$(stat -c '%U %G %a' "$node")"
  if udevadm info "$node" | grep -q 'ID_SOFTWARE_RADIO=1'; then oa_ok "… and marked it as a software radio"; else oa_fail "udev did not apply the stick's rule: $(udevadm info "$node" | grep -c .) properties, no ID_SOFTWARE_RADIO"; fi
  oa_is "… and switched USB power saving off for it" "on" "$(cat "$dev/power/control")"
  # Who holds the stick's one interface: nobody, or "usbfs" — which is the
  # kernel's name for "a program has it" (rtl_sdr, once the agent has started
  # it). Any other name is a kernel driver that took the stick for itself.
  got=$(basename "$(readlink "$dev:1.0/driver" 2>/dev/null || echo none)")
  if lsmod | grep -q '^dvb_usb_rtl28xxu ' || { [ "$got" != none ] && [ "$got" != usbfs ]; }; then
    oa_fail "a kernel driver took the stick: $got $(lsmod | awk '$1 ~ /rtl28|rtl2832|dvb/ {print $1}' | tr '\n' ' ')"
  elif modinfo -F filename dvb_usb_rtl28xxu >/dev/null 2>&1; then
    oa_ok "the kernel's TV driver for this chip (dvb_usb_rtl28xxu, which this kernel has) did not take it: the block list holds (the stick is held by: $got)"
  else
    oa_skip "whether the block list keeps the TV driver off — this kernel has no such driver"
  fi
  got=$(g_can_open "$node" || true)
  oa_is "the service's device list lets a USB device file be opened" "" "$got"
  # Somebody outside the group is refused: this is what a refusal looks like.
  got=$(setpriv --reuid nobody --regid nogroup --clear-groups timeout 20 rtl_test -t 2>&1 || true)
  if printf '%s' "$got" | grep -q 'usb_open error -3'; then oa_ok "a user outside the group is refused it (rtl_test as \"nobody\": \"usb_open error -3\")"
  else oa_fail "rtl_test as nobody was not refused: $(printf '%s' "$got" | tail -n 3 | tr '\n' ' ')"; fi
  # The agent looks for sticks every couple of seconds and starts rtl_sdr for each.
  if oa_wait 60 sh -c "journalctl -u $UNIT --no-pager | grep -q 'found RTL-SDR 0bda:2838'"; then oa_ok "the agent found it: $(journalctl -u "$UNIT" --no-pager | grep 'found RTL-SDR 0bda:2838' | tail -n 1 | sed 's/^.*\] //')"
  else oa_fail "the agent did not find the pretend stick"; fi
  oa_wait 60 sh -c "node -e 'fetch(\"http://127.0.0.1:${G_PORT:-80}/api/status\").then(r => r.json()).then(d => process.exit((d.devices.sdrs[0] && d.devices.sdrs[0].stderr || []).length ? 0 : 1)).catch(() => process.exit(1))'" || true
  got=$(g_status '(d.devices.sdrs[0] && d.devices.sdrs[0].stderr || []).join(" | ")')
  printf '%s\n' "$got" > "$G_OUT/stick-rtl_sdr.txt"
  if printf '%s' "$got" | grep -q 'usb_open error\|Failed to open'; then oa_fail "rtl_sdr, started by the sandboxed agent, could not open the stick: $got"
  elif printf '%s' "$got" | grep -Eq 'Reading samples|rtlsdr_write_reg|Allocating|Sampling at|Tuner'; then oa_ok "rtl_sdr, started by the sandboxed agent as rpi-alert, OPENED the device and went on to ask it for samples (\"$got\"). It gets none: nothing is behind the pretend stick"
  else oa_fail "rtl_sdr said nothing that shows it opened the stick: \"$got\""; fi
  journalctl -u "$UNIT" --no-pager > "$G_OUT/journal-stick.txt" 2>&1 || true
  # Unplug it.
  echo "" > "$g/UDC" 2>/dev/null || true
  rm -f "$g/configs/c.1/Loopback.0"; rmdir "$g/configs/c.1" "$g/functions/Loopback.0" "$g/strings/0x409" "$g" 2>/dev/null || true
  modprobe -r dummy_hcd 2>/dev/null || true
  oa_check_not "unplugged again: the pretend stick is gone" lsusb -d 0bda:2838
}

# ── part: Debian's own boot-loader update ────────────────────────────────────
# When Debian publishes a security update of GRUB or shim, the package's own
# script writes the new boot files to the EFI partition. The image's boot
# files were put there by the build, not by that script: this makes the
# script run, as an update would, and checks what it leaves.
inside_bootloader() {
  local arch=$1 efi upper target before after f
  case "$arch" in amd64) efi=x64; target=x86_64-efi ;; arm64) efi=aa64; target=arm64-efi ;; *) oa_fail "unknown kind of processor $arch"; return 0 ;; esac
  upper=$(printf '%s' "$efi" | tr '[:lower:]' '[:upper:]')
  oa_section "Inside: Debian's own boot-loader update, run as a GRUB update would run it"
  oa_check "the EFI partition is mounted where the update expects it" mountpoint -q /boot/efi
  oa_is "GRUB's package is set to keep the copy firmware starts from (EFI/BOOT) up to date too" "true" "$(debconf-show "grub-efi-$arch" 2>/dev/null | sed -n 's/.*force_efi_extra_removable: //p')"
  ( cd /boot/efi && find . -type f ! -name grub.cfg -exec sha256sum {} + | sort -k2 ) > "$G_OUT/esp-as-built.txt"
  before=$(stat -c %Y "/boot/efi/EFI/BOOT/BOOT$upper.EFI")
  sleep 2
  if DEBIAN_FRONTEND=noninteractive dpkg-reconfigure -fnoninteractive "grub-efi-$arch" > "$G_OUT/grub-reconfigure.txt" 2>&1; then oa_ok "dpkg-reconfigure grub-efi-$arch (the script an update runs) ended without an error"
  else oa_fail "dpkg-reconfigure grub-efi-$arch failed: $(tail -n 3 "$G_OUT/grub-reconfigure.txt" | tr '\n' ' ')"; fi
  after=$(stat -c %Y "/boot/efi/EFI/BOOT/BOOT$upper.EFI")
  if [ "$after" -gt "$before" ]; then oa_ok "it wrote the boot files anew (Debian's grub-install ran: the file firmware starts has a new time)"
  else oa_fail "it did not write the boot files: Debian's script did not take this for a disk GRUB is installed on"; fi
  ( cd /boot/efi && find . -type f ! -name grub.cfg -exec sha256sum {} + | sort -k2 ) > "$G_OUT/esp-after-debian.txt"
  if diff "$G_OUT/esp-as-built.txt" "$G_OUT/esp-after-debian.txt" > "$G_OUT/esp-diff.txt"; then oa_ok "what Debian's own installer wrote is, file for file, what the build had put there ($(wc -l < "$G_OUT/esp-as-built.txt") files; the small grub.cfg aside)"
  else oa_fail "Debian's installer left other boot files than the build: $(tr '\n' ' ' < "$G_OUT/esp-diff.txt" | cut -c1-300)"; fi
  for f in "shim$efi.efi.signed:EFI/BOOT/BOOT$upper.EFI" "shim$efi.efi.signed:EFI/debian/shim$efi.efi" "mm$efi.efi.signed:EFI/BOOT/mm$efi.efi"; do
    oa_check "… ${f#*:} is Debian's signed ${f%%:*}, byte for byte" cmp -s "/usr/lib/shim/${f%%:*}" "/boot/efi/${f#*:}"
  done
  oa_check "… EFI/BOOT/grub$efi.efi is Debian's signed GRUB, byte for byte" cmp -s "/usr/lib/grub/$target-signed/grub$efi.efi.signed" "/boot/efi/EFI/BOOT/grub$efi.efi"
  oa_has "the small grub.cfg beside them still finds the main partition by its identifier" /boot/efi/EFI/debian/grub.cfg "search.fs_uuid $(findmnt -no UUID /) root"
  oa_has "the boot menu still names the main partition by its identifier" /boot/grub/grub.cfg "root=UUID=$(findmnt -no UUID /)"
}

# ── part: the enterprise profile ─────────────────────────────────────────────
inside_enterprise() {
  local got pid
  G_PORT=8080
  oa_section "Inside: the enterprise profile"
  # The little server of the firewall check must have let go of port 8080.
  oa_wait 200 sh -c '! ss -Hltn | grep -q ":8080 "' || oa_note "something still holds port 8080: $(ss -Hltnp | grep ':8080 ' | head -n 1)"
  got=0; open-alert-base profile enterprise > "$G_OUT/profile-enterprise.txt" 2>&1 || got=$?
  oa_is "sudo open-alert-base profile enterprise" 0 "$got"
  if [ "$got" != 0 ]; then sed 's/^/        /' "$G_OUT/profile-enterprise.txt"; fi
  if oa_wait 60 oa_http_ok http://127.0.0.1:8080/; then oa_ok "the dashboard answers on port 8080 on the computer itself"; else oa_fail "the dashboard does not answer on 127.0.0.1:8080"; fi
  pid=$(g_pid)
  oa_is "the running agent holds no privilege at all, and can get none" "0000000000000000 0000000000000000 0000000000000000" \
    "$(oa_proc_status "$pid" CapEff) $(oa_proc_status "$pid" CapBnd) $(oa_proc_status "$pid" CapAmb)"
  oa_is "the only port the agent's user listens on" "8080" "$(oa_listening rpi-alert | awk '{print $1}' | sort -u | tr '\n' ' ' | sed 's/ $//')"
  oa_is "the profile's firewall lock is on, and set to load at every start" "active enabled" "$(systemctl is-active "$FW_UNIT" 2>&1) $(systemctl is-enabled "$FW_UNIT" 2>&1)"
  oa_check "its rules are loaded beside the image's own (two tables)" sh -c 'nft list table inet open_alert_base >/dev/null && nft list table inet open_alert_image >/dev/null'
  oa_is "what Flood-Net may do (remote.mode)" "report" "$(g_status 'd.remote && d.remote.mode' 2>/dev/null || true)"
  g_score_check enterprise
  open-alert-base audit > "$G_OUT/audit-enterprise.txt" 2>&1 || true
  oa_has "audit: the firewall lock is on" "$G_OUT/audit-enterprise.txt" 'firewall lock +on '
  oa_has "audit: no privilege in use" "$G_OUT/audit-enterprise.txt" 'privileges in use +none'
  # Reloading the image's firewall must not take the lock away.
  systemctl reload nftables
  sleep 1
  oa_check "after \"systemctl reload nftables\" both tables are still loaded" sh -c 'nft list table inet open_alert_base >/dev/null && nft list table inet open_alert_image >/dev/null'
  sha256sum /etc/ssh/ssh_host_ed25519_key.pub | awk '{print $1}' > "$G_OUT/hostkey.sha256"
  findmnt -bno SIZE / > "$G_OUT/root-size"
}

# ── part: after a restart, with the enterprise profile ──────────────────────
inside_after_restart() {
  local want_sb=$1 got pid
  G_PORT=8080
  oa_section "Inside: after a restart, everything came up again by itself"
  # shellcheck disable=SC2016  # the text is for the shell that is started, not this one
  oa_wait 180 sh -c 'case "$(systemctl is-system-running 2>/dev/null)" in running|degraded) exit 0 ;; *) exit 1 ;; esac' || true
  got=$(systemctl is-system-running 2>/dev/null || true)
  if [ "$got" = running ]; then oa_ok "systemd says the computer came up whole (\"running\")"
  else oa_fail "systemd says \"$got\" — failed units: $(systemctl --failed --no-legend --plain | awk '{print $1}' | tr '\n' ' ')"; fi
  systemd-analyze time 2>/dev/null | head -n 1 | sed 's/^/note  /' || true
  if [ "$want_sb" = yes ]; then oa_is "Secure Boot is still on" "SecureBoot enabled" "$(mokutil --sb-state 2>&1 | head -n 1)"; fi
  got=$(efibootmgr 2>/dev/null | awk '/^BootCurrent:/ {c = $2} /^Boot[0-9A-F]+\*? / {n = substr($1, 5, 4); sub(/\*/, "", n); name[n] = $2} END {print name[c]}')
  oa_note "started from the firmware's entry \"$got\" (\"debian\" is the entry shim made for this disk at its first start)"
  oa_is "the machine-id is the same as before the restart" "$(cat "$G_OUT/machine-id")" "$(cat /etc/machine-id)"
  oa_is "the SSH host key is the same" "$(cat "$G_OUT/hostkey.sha256")" "$(sha256sum /etc/ssh/ssh_host_ed25519_key.pub | awk '{print $1}')"
  oa_is "the main partition is the size it grew to" "$(cat "$G_OUT/root-size")" "$(findmnt -bno SIZE /)"
  got=$(cloud-init status --long 2>&1 || true)
  if printf '%s' "$got" | grep -q '^status: done' && printf '%s' "$got" | grep -q '^errors: \[\]'; then oa_ok "cloud-init ran again without an error (the set-up file is applied once: nothing was set up twice)"
  else oa_fail "cloud-init after the restart: $(printf '%s' "$got" | tr '\n' ' ' | cut -c1-300)"; fi
  oa_is "there is still one administrator account and no other new one" "admin" "$(awk -F: '$3 >= 1000 && $3 < 60000 {print $1}' /etc/passwd | tr '\n' ' ' | sed 's/ $//')"
  if oa_wait 60 systemctl is-active --quiet "$UNIT"; then oa_ok "the service started by itself"; else oa_fail "the service is $(systemctl is-active "$UNIT" 2>&1)"; fi
  oa_is "the profile in force is still" "enterprise" "$(cat /etc/open-alert-base/profile)"
  oa_is "the firewall lock loaded by itself" "active" "$(systemctl is-active "$FW_UNIT" 2>&1)"
  oa_check "its rules and the image's are both loaded" sh -c 'nft list table inet open_alert_base >/dev/null && nft list table inet open_alert_image >/dev/null'
  oa_is "the two USB serial drivers were loaded at the start" "cdc_acm usbserial " "$(lsmod | awk '$1 == "usbserial" || $1 == "cdc_acm" {print $1}' | sort | tr '\n' ' ')"
  if oa_wait 60 oa_http_ok http://127.0.0.1:8080/; then oa_ok "the dashboard answers on port 8080 on the computer itself"; else oa_fail "the dashboard does not answer on 127.0.0.1:8080"; fi
  pid=$(g_pid)
  oa_is "the agent holds no privilege" "0000000000000000 0000000000000000" "$(oa_proc_status "$pid" CapEff) $(oa_proc_status "$pid" CapBnd)"
  oa_is "the only TCP ports open to other computers" "22 8080 " "$(ss -Hltn | awk '{ a = $4; p = a; sub(/.*:/, "", p); sub(/:[^:]*$/, "", a); if (a !~ /^127\./ && a != "[::1]") print p }' | sort -un | tr '\n' ' ')"
  if [ -c /dev/ttyUSB0 ]; then
    if oa_wait 120 sh -c "node -e 'fetch(\"http://127.0.0.1:8080/api/status\").then(r => r.json()).then(d => process.exit(d.devices.ports.some(p => p.rx > 0 && p.state === \"running\") ? 0 : 1)).catch(() => process.exit(1))'"; then
      oa_ok "the agent reads the USB serial receiver again, with no privilege at all"
    else oa_fail "the agent does not read the USB serial port after the restart: $(g_status 'd.devices.ports')"; fi
  fi
  g_score_check "enterprise (after a restart)"
  journalctl -b -u "$UNIT" --no-pager > "$G_OUT/journal-after-restart.txt" 2>&1 || true
}

if [ "${1:-}" = "--inside" ]; then
  part=${2:?--inside needs a part}; shift 2
  trap 'oa_fail "the checks inside stopped early at line $LINENO (exit status $?)"' ERR
  case "$part" in
    standard) inside_standard "$@" ;;
    stick) inside_stick "$@" ;;
    bootloader) inside_bootloader "$@" ;;
    enterprise) inside_enterprise "$@" ;;
    after-restart) inside_after_restart "$@" ;;
    logs) tar -C "$G_OUT" -cf - . ;;
    *) echo "unknown part $part" >&2; exit 2 ;;
  esac
  exit 0
fi

# ═════════════════════════════════════════════════════════════════════════════
# On the computer that runs the checks
# ═════════════════════════════════════════════════════════════════════════════

IMAGE=''; ARCH=''; SECURE_BOOT=1; DO_RESTART=1; DISK_SIZE=8G; TIMEOUT=''; LOGDIR=''; KEEP=0
while [ $# -gt 0 ]; do
  case "$1" in
    --image) IMAGE="${2:?--image needs a file}"; shift 2 ;;
    --arch) ARCH="${2:?--arch needs amd64 or arm64}"; shift 2 ;;
    --no-secure-boot) SECURE_BOOT=0; shift ;;
    --no-restart) DO_RESTART=0; shift ;;
    --disk-size) DISK_SIZE="${2:?--disk-size needs a size}"; shift 2 ;;
    --timeout) TIMEOUT="${2:?--timeout needs seconds}"; shift 2 ;;
    --log-dir) LOGDIR="${2:?--log-dir needs a folder}"; shift 2 ;;
    --keep) KEEP=1; shift ;;
    -h|--help) usage; exit 0 ;;
    *) oa_die "unknown option $1 (try --help)" ;;
  esac
done

HOST_ARCH=$(dpkg --print-architecture 2>/dev/null || uname -m)
case "$HOST_ARCH" in x86_64) HOST_ARCH=amd64 ;; aarch64) HOST_ARCH=arm64 ;; esac
[ -n "$ARCH" ] || ARCH="$HOST_ARCH"
VERSION="$(oa_pin AGENT_VERSION)+oa$(oa_pin OA_REVISION)"
AGENT_VERSION=$(oa_pin AGENT_VERSION)
[ -n "$IMAGE" ] || IMAGE="$OA_REPO/dist/open-alert-base-${VERSION}-${ARCH}-uefi.img"
[ -f "$IMAGE" ] || oa_die "no image at $IMAGE — build it first: sudo firmware/image/build-image.sh"
[ -n "$LOGDIR" ] || LOGDIR="$OA_REPO/dist/test-logs/image"
mkdir -p "$LOGDIR"; LOGDIR="$(cd "$LOGDIR" && pwd)"

# What differs between the two kinds of processor.
FW_CODE=''; FW_VARS=''; SB_NOTE=''
case "$ARCH" in
  amd64)
    QEMU=qemu-system-x86_64; EFI=x64; ROOT_TYPE=4F68BCE3-E8CD-4DB1-96E7-FBCAF984B709
    if [ "$SECURE_BOOT" = 1 ] && [ -f /usr/share/OVMF/OVMF_CODE_4M.secboot.fd ] && [ -f /usr/share/OVMF/OVMF_VARS_4M.ms.fd ]; then
      FW_CODE=/usr/share/OVMF/OVMF_CODE_4M.secboot.fd; FW_VARS=/usr/share/OVMF/OVMF_VARS_4M.ms.fd
    else
      if [ "$SECURE_BOOT" = 1 ]; then SB_NOTE="this computer has no Secure Boot build of the OVMF firmware with Microsoft's keys (/usr/share/OVMF/OVMF_CODE_4M.secboot.fd and OVMF_VARS_4M.ms.fd)"; fi
      SECURE_BOOT=0; FW_CODE=/usr/share/OVMF/OVMF_CODE_4M.fd; FW_VARS=/usr/share/OVMF/OVMF_VARS_4M.fd
    fi ;;
  arm64)
    QEMU=qemu-system-aarch64; EFI=aa64; ROOT_TYPE=B921B045-1DF0-41C3-AF44-4C6F280D3FAE
    if [ "$SECURE_BOOT" = 1 ] && [ -f /usr/share/AAVMF/AAVMF_CODE.secboot.fd ] && [ -f /usr/share/AAVMF/AAVMF_VARS.ms.fd ]; then
      FW_CODE=/usr/share/AAVMF/AAVMF_CODE.secboot.fd; FW_VARS=/usr/share/AAVMF/AAVMF_VARS.ms.fd
    else
      if [ "$SECURE_BOOT" = 1 ]; then SB_NOTE="this computer has no Secure Boot build of the AAVMF firmware with Microsoft's keys (/usr/share/AAVMF/AAVMF_CODE.secboot.fd and AAVMF_VARS.ms.fd)"; fi
      SECURE_BOOT=0; FW_CODE=/usr/share/AAVMF/AAVMF_CODE.no-secboot.fd; FW_VARS=/usr/share/AAVMF/AAVMF_VARS.fd
    fi ;;
  *) oa_die "--arch must be amd64 or arm64" ;;
esac
EFI_UPPER=$(printf '%s' "$EFI" | tr '[:lower:]' '[:upper:]')
oa_need "$QEMU" ssh ssh-keygen curl jq openssl mcopy mtype mdir sfdisk truncate
if [ ! -f "$FW_CODE" ] || [ ! -f "$FW_VARS" ]; then oa_die "the UEFI firmware for QEMU is not installed ($FW_CODE): the package ovmf (PCs) or qemu-efi-aarch64 (ARM)"; fi
KVM=0
if [ "$ARCH" = "$HOST_ARCH" ] && [ -w /dev/kvm ]; then KVM=1; fi
[ -n "$TIMEOUT" ] || { if [ "$KVM" = 1 ]; then TIMEOUT=240; else TIMEOUT=1200; fi; }
export MTOOLS_SKIP_CHECK=1

WORK=$(mktemp -d "${TMPDIR:-/tmp}/oa-image-test.XXXXXX")
QEMU_PID=''; FEED_PID=''; PROXY_PID=''
cleanup() {
  local rc=$?
  set +e
  if [ -n "$FEED_PID" ]; then kill "$FEED_PID" 2>/dev/null; fi
  if [ -n "$PROXY_PID" ]; then kill "$PROXY_PID" 2>/dev/null; fi
  if [ -n "$QEMU_PID" ] && kill -0 "$QEMU_PID" 2>/dev/null; then kill "$QEMU_PID" 2>/dev/null; sleep 1; kill -9 "$QEMU_PID" 2>/dev/null; fi
  if [ -f "$WORK/serial.log" ]; then tr -d '\r' < "$WORK/serial.log" | sed 's/\x1b\[[0-9;?]*[a-zA-Z]//g' > "$LOGDIR/serial-console.txt"; fi
  if [ "$KEEP" = 1 ]; then echo "The working copy is kept in $WORK"; else rm -rf "$WORK"; fi
  exit "$rc"
}
trap cleanup EXIT
trap 'exit 130' INT TERM

# ── helpers ──────────────────────────────────────────────────────────────────
# Where a partition starts in the image file, in bytes.   part_offset NUMBER
part_offset() { sfdisk --json "$1" | jq -r --argjson n "$2" '.partitiontable.partitions[$n - 1].start * 512'; }
# A port on this computer that nothing listens on, put in the variable named.
PORT_NEXT=$((20000 + ($$ % 20000)))
free_port() {
  while (exec 3<>"/dev/tcp/127.0.0.1/$PORT_NEXT") 2>/dev/null; do PORT_NEXT=$((PORT_NEXT + 1)); done
  printf -v "$1" '%s' "$PORT_NEXT"; PORT_NEXT=$((PORT_NEXT + 1))
}
SSH_OPTS=()
vm_ssh() { timeout 900 ssh "${SSH_OPTS[@]}" admin@127.0.0.1 "$@"; }
# Run one part of the checks inside the virtual machine, show its results as
# they come out, keep everything it printed, and count its results.
#   in_vm LOG PART [arguments…]
in_vm() {
  local log=$1 rc=0; shift
  vm_ssh sudo bash oa-image-test/image.sh --inside "$@" > "$log" 2>&1 || rc=$?
  grep -E '^(ok|FAIL|skip|note)  |^== ' "$log" || true
  oa_count_log "$log"
  if [ "$rc" != 0 ] && ! grep -q '^FAIL  ' "$log"; then
    oa_fail "this part stopped early (exit status $rc) — the last lines of $log:"
    tail -n 15 "$log" | sed 's/^/        /'
  fi
  return 0
}
# Wait for text on the serial console.   wait_serial SECONDS PATTERN [from-byte]
wait_serial() {
  local left=$1 pat=$2 from=${3:-0}
  while [ "$left" -gt 0 ]; do
    if tail -c "+$((from + 1))" "$WORK/serial.log" 2>/dev/null | grep -aq -- "$pat"; then return 0; fi
    if ! kill -0 "$QEMU_PID" 2>/dev/null; then return 2; fi
    sleep 2; left=$((left - 2))
  done
  return 1
}
http_code() { curl -s -o "${2:-/dev/null}" -m 20 -w '%{http_code}' "$1" 2>/dev/null || true; }
# Change one bit in the middle of a file.
flip_bit() {
  local at byte
  at=$(( $(stat -c %s "$1") / 2 ))
  byte=$(od -An -tu1 -j "$at" -N 1 "$1" | tr -d ' ')
  # shellcheck disable=SC2059  # the format is the byte itself, written as an octal escape
  printf "\\$(printf '%03o' $((byte ^ 1)))" | dd of="$1" bs=1 seek="$at" conv=notrunc status=none
}
# Start a copy of the image in which the named boot files have one bit
# changed, with Secure Boot on and nothing else attached, and wait for the
# words that say it was refused.   refused_start NAME "WORDS" FILE-ON-THE-EFI-PARTITION…
refused_start() {
  local name=$1 words=$2 f pid left=$((TIMEOUT / 4)) args; shift 2
  cp --sparse=always "$IMAGE" "$WORK/$name.img"
  for f in "$@"; do
    mcopy -n -i "$WORK/$name.img@@$ESP_OFF" "::$f" "$WORK/$name.bin"
    flip_bit "$WORK/$name.bin"
    mcopy -o -i "$WORK/$name.img@@$ESP_OFF" "$WORK/$name.bin" "::$f"
    rm -f "$WORK/$name.bin"
  done
  cp "$FW_VARS" "$WORK/$name.vars"
  # shellcheck disable=SC2054
  args=(-m 1024 -smp 2 -display none -net none -serial "file:$WORK/$name.serial"
    -drive "if=pflash,format=raw,unit=0,file=$FW_CODE,readonly=on" -drive "if=pflash,format=raw,unit=1,file=$WORK/$name.vars"
    -drive "file=$WORK/$name.img,format=raw,if=none,id=disk0")
  # shellcheck disable=SC2054
  if [ "$ARCH" = amd64 ]; then args+=(-machine q35,smm=on -global driver=cfi.pflash01,property=secure,value=on -device ide-hd,drive=disk0,bus=ide.0)
  else args+=(-machine virt -device virtio-blk-pci,drive=disk0); fi
  if [ "$KVM" = 1 ]; then args+=(-accel kvm -cpu host); else args+=(-accel "tcg,thread=multi" -cpu max); fi
  "$QEMU" "${args[@]}" > /dev/null 2>&1 &
  pid=$!
  while [ "$left" -gt 0 ] && kill -0 "$pid" 2>/dev/null; do
    if grep -aq -- "$words" "$WORK/$name.serial" 2>/dev/null; then break; fi
    sleep 2; left=$((left - 2))
  done
  # A little longer, in case it goes on to start the kernel all the same.
  sleep 8
  kill "$pid" 2>/dev/null || true; wait "$pid" 2>/dev/null || true
  tr -d '\r' < "$WORK/$name.serial" 2>/dev/null | sed 's/\x1b\[[0-9;?]*[a-zA-Z]/ /g' | LC_ALL=C tr -cd '[:print:]\n' | tr -s ' ' > "$LOGDIR/serial-console-$name.txt" || true
  grep -aq -- "$words" "$WORK/$name.serial" 2>/dev/null && ! grep -aq 'Linux version' "$WORK/$name.serial"
}
# What a little server behind a forwarded port says, if it can be reached at all.
port_says() {
  local out=''
  if exec 7<>"/dev/tcp/127.0.0.1/$1"; then
    IFS= read -r -t 8 out <&7 || true
    exec 7<&- 7>&-
  fi
  printf '%s' "$out"
}

# ═════════════════════════════════════════════════════════════════════════════
oa_section "1. The image file, before it is started"
# ═════════════════════════════════════════════════════════════════════════════
oa_note "$IMAGE ($(du -h --apparent-size "$IMAGE" | awk '{print $1}') as a disk, $(du -h "$IMAGE" | awk '{print $1}') of it in use; sha256 $(sha256sum "$IMAGE" | awk '{print $1}'))"
PT=$(sfdisk --json "$IMAGE")
oa_is "the partition table is GPT, as UEFI firmware expects" "gpt" "$(printf '%s' "$PT" | jq -r .partitiontable.label)"
oa_is "three partitions: EFI system, CIDATA (plain FAT, so any computer opens it), the main partition" \
  "C12A7328-F81F-11D2-BA4B-00A0C93EC93B EBD0A0A2-B9E5-4433-87C0-68B6B72699C7 $ROOT_TYPE" \
  "$(printf '%s' "$PT" | jq -r '[.partitiontable.partitions[].type] | join(" ")')"
ESP_OFF=$(part_offset "$IMAGE" 1); CID_OFF=$(part_offset "$IMAGE" 2); ROOT_OFF=$(part_offset "$IMAGE" 3)
oa_is "the main partition is the last one, so that it can grow" "3" "$(printf '%s' "$PT" | jq -r '.partitiontable.partitions | to_entries | max_by(.value.start) | .key + 1')"
mdir -i "$IMAGE@@$ESP_OFF" -/ -b :: > "$LOGDIR/efi-partition-files.txt" 2>&1 || true
for f in "EFI/BOOT/BOOT$EFI_UPPER.EFI" "EFI/BOOT/grub$EFI.efi" "EFI/BOOT/mm$EFI.efi" "EFI/debian/shim$EFI.efi" "EFI/debian/grub$EFI.efi" "EFI/debian/grub.cfg"; do
  oa_has "the EFI partition holds $f" "$LOGDIR/efi-partition-files.txt" "^::/$f\$"
done
# Who signed the boot files. (A signature being there is not proof it is good:
# the proof is the start with Secure Boot on, below.)
if command -v sbverify >/dev/null 2>&1; then
  mcopy -n -i "$IMAGE@@$ESP_OFF" "::EFI/BOOT/BOOT$EFI_UPPER.EFI" "$WORK/shim.efi"
  mcopy -n -i "$IMAGE@@$ESP_OFF" "::EFI/BOOT/grub$EFI.efi" "$WORK/grub.efi"
  sbverify --list "$WORK/shim.efi" > "$LOGDIR/signature-shim.txt" 2>&1 || true
  sbverify --list "$WORK/grub.efi" > "$LOGDIR/signature-grub.txt" 2>&1 || true
  if grep -q 'subject:.*Microsoft' "$LOGDIR/signature-shim.txt"; then oa_ok "the file firmware starts (shim) carries Microsoft's signature: $(grep -m1 'issuer:' "$LOGDIR/signature-shim.txt" | sed 's/.*CN=//; s/[[:space:]]*$//')"
  else oa_fail "shim carries no signature by Microsoft — see $LOGDIR/signature-shim.txt"; fi
  oa_note "every signature on shim, by issuer: $(grep 'issuer:' "$LOGDIR/signature-shim.txt" | sed 's/.*CN=//' | sort -u | tr '\n' ';')"
  if grep -q 'subject:.*Debian Secure Boot Signer' "$LOGDIR/signature-grub.txt"; then oa_ok "GRUB carries Debian's signature: $(grep -m1 'subject:' "$LOGDIR/signature-grub.txt" | sed 's/.*CN=//; s/[[:space:]]*$//')"
  else oa_fail "GRUB carries no signature by Debian — see $LOGDIR/signature-grub.txt"; fi
else
  oa_skip "who signed the boot files — sbverify (the package sbsigntool) is not installed"
fi
for f in user-data meta-data README.txt; do
  if mtype -i "$IMAGE@@$CID_OFF" "::$f" 2>/dev/null | cmp -s - "$OA_FIRMWARE/image/cidata/$f"; then oa_ok "the CIDATA partition holds $f, as it is in firmware/image/cidata"
  else oa_fail "the CIDATA partition's $f is missing or is not the one in firmware/image/cidata"; fi
done
oa_is "user-data as shipped switches nothing on (every line is a comment)" "1" "$(mtype -i "$IMAGE@@$CID_OFF" ::user-data | grep -c -v '^#\|^$' | sed 's/^0$/1/; t; s/.*/more/')"
if command -v debugfs >/dev/null 2>&1; then
  # Reads files out of the main partition without mounting it.
  rootfs() { debugfs -R "$1" "$IMAGE?offset=$ROOT_OFF" 2>/dev/null; }
  oa_is "the image's machine-id file is empty" "" "$(rootfs 'cat /etc/machine-id')"
  oa_is "the image holds no SSH host keys" "0" "$(rootfs 'ls -l /etc/ssh' | grep -c 'ssh_host_' || true)"
  oa_is "no account in the image has a password" "" "$(rootfs 'cat /etc/shadow' | awk -F: '$2 !~ /^[!*]/ {print $1}' | tr '\n' ' ')"
  oa_is "the agent's data folder in the image is empty (no password, no identifiers, no queue)" "0" "$(rootfs 'ls -l /var/lib/rpi-alert' | grep -v ' \.\.\?$' | grep -c . || true)"
  oa_is "the profile the image starts with" "standard" "$(rootfs 'cat /etc/open-alert-base/profile')"
  KERNEL=$(rootfs 'ls -l /boot' | awk '{print $NF}' | grep '^vmlinuz-' | sort -V | tail -n 1)
  if command -v sbverify >/dev/null 2>&1 && [ -n "$KERNEL" ]; then
    rootfs "dump /boot/$KERNEL $WORK/vmlinuz" > /dev/null
    sbverify --list "$WORK/vmlinuz" > "$LOGDIR/signature-kernel.txt" 2>&1 || true
    if grep -q 'subject:.*Debian Secure Boot Signer' "$LOGDIR/signature-kernel.txt"; then oa_ok "the kernel (${KERNEL#vmlinuz-}) carries Debian's signature: $(grep -m1 'subject:' "$LOGDIR/signature-kernel.txt" | sed 's/.*CN=//; s/[[:space:]]*$//')"
    else oa_fail "the kernel carries no signature by Debian — see $LOGDIR/signature-kernel.txt"; fi
  fi
else
  oa_skip "what is inside the main partition before the first start — debugfs (the package e2fsprogs) is not installed"
fi

# ═════════════════════════════════════════════════════════════════════════════
oa_section "2. A working copy on a larger disk, with a first set-up file written as a person would"
# ═════════════════════════════════════════════════════════════════════════════
cp --sparse=always "$IMAGE" "$WORK/disk.img"
truncate -s "$DISK_SIZE" "$WORK/disk.img"
DISK_BYTES=$(stat -c %s "$WORK/disk.img")
ssh-keygen -q -t ed25519 -N '' -C 'made for one run of firmware/test/image.sh' -f "$WORK/key"
openssl req -x509 -newkey ec -pkeyopt ec_paramgen_curve:prime256v1 -nodes -days 2 \
  -subj '/CN=open-ALERT image test authority (made for one run)' -keyout "$WORK/ca.key" -out "$WORK/ca.crt" 2>/dev/null
CA_LINE=$(sed -n '2p' "$WORK/ca.crt")
for v in SSH_PORT WEB_PORT WEB2_PORT SHUT_PORT RX_PORT PROXY_PORT; do free_port "$v"; done
# From inside the virtual machine, this computer is 10.0.2.2.
PROXY="http://10.0.2.2:$PROXY_PORT"
WANT_NAME=oa-image-test; WANT_ZONE=Australia/Brisbane
# The image's own example, with parts 1 to 4 switched on, the web proxy from
# part 5 and the restart from part 6: one "#" removed from the start of each
# of their lines, as the file tells a person to do. Then the three things a
# person fills in: their key, their certificate, their proxy's address.
sed -e '/^#hostname:/s/^#//' \
    -e '/^#users:/,/^#      - ssh-ed25519 /s/^#//' \
    -e '/^#timezone:/s/^#//' \
    -e '/^#ca_certs:/,/^#      -----END CERTIFICATE-----/s/^#//' \
    -e '/^#write_files:/s/^#//' \
    -e '/^#  - path: \/etc\/open-alert-base\/env/,/^#      NO_PROXY=/s/^#//' \
    -e '/^#runcmd:/s/^#//' \
    -e '/^#  - \[systemctl, try-restart, open-alert-base\]/s/^#//' \
    "$OA_FIRMWARE/image/cidata/user-data" > "$WORK/user-data.switched-on"
{
  while IFS= read -r line; do
    case "$line" in
      'hostname: '*) printf 'hostname: %s\n' "$WANT_NAME" ;;
      '      - ssh-ed25519 '*) printf '      - %s\n' "$(cat "$WORK/key.pub")" ;;
      '      -----BEGIN CERTIFICATE-----'|'      -----END CERTIFICATE-----') ;;
      '      (the lines of the certificate go here)') sed 's/^/      /' "$WORK/ca.crt" ;;
      '      HTTPS_PROXY='*) printf '      HTTPS_PROXY=%s\n' "$PROXY" ;;
      *) printf '%s\n' "$line" ;;
    esac
  done < "$WORK/user-data.switched-on"
} > "$WORK/user-data"
cp "$WORK/user-data" "$LOGDIR/user-data-used.txt"
SEED_OK=1
for want in "hostname: $WANT_NAME" 'users:' '  - name: admin' "timezone: $WANT_ZONE" 'ca_certs:' "      $CA_LINE" 'write_files:' "      HTTPS_PROXY=$PROXY" 'runcmd:' '  - [systemctl, try-restart, open-alert-base]'; do
  grep -qxF -- "$want" "$WORK/user-data" || { SEED_OK=0; oa_fail "the set-up file made from the example lacks the line \"$want\""; }
done
if [ "$SEED_OK" = 1 ] && [ "$(head -n 1 "$WORK/user-data")" = '#cloud-config' ]; then oa_ok "the image's example user-data, with parts switched on by removing one \"#\" a line, gives the set-up file used here (kept as $LOGDIR/user-data-used.txt)"; fi
oa_has_not "nothing else was switched on: no fixed address, no enterprise profile, no \"never read again\"" "$WORK/user-data" '^(  - path: /etc/systemd/network|  - \[open-alert-base, profile|  - \[touch, /etc/cloud)'
mcopy -o -i "$WORK/disk.img@@$CID_OFF" "$WORK/user-data" ::user-data
# shellcheck disable=SC2016  # the text is for the shell that is started, not this one
oa_check "it is written into the working copy's CIDATA partition" sh -c 'mtype -i "$1" ::user-data | cmp -s - "$2"' sh "$WORK/disk.img@@$CID_OFF" "$WORK/user-data"

# ═════════════════════════════════════════════════════════════════════════════
oa_section "3. Start it (QEMU, UEFI firmware$( [ "$SECURE_BOOT" = 1 ] && echo ', Secure Boot ON with Microsoft'"'"'s keys' || echo ', Secure Boot off'))"
# ═════════════════════════════════════════════════════════════════════════════
cp "$FW_VARS" "$WORK/vars.fd"
# A stand-in for a web proxy: it writes down what is asked of it and answers
# nothing. Enough to see that the agent goes to the proxy the set-up file named.
if command -v socat >/dev/null 2>&1; then
  socat -u "TCP-LISTEN:$PROXY_PORT,bind=127.0.0.1,reuseaddr,fork" "OPEN:$WORK/proxy-asked.txt,creat,append" 2>/dev/null &
  PROXY_PID=$!
fi
# shellcheck disable=SC2054  # the commas are QEMU's own notation, inside one argument
QEMU_ARGS=(-m 2048 -smp 4 -display none -serial "file:$WORK/serial.log" -pidfile "$WORK/qemu.pid"
  -drive "if=pflash,format=raw,unit=0,file=$FW_CODE,readonly=on" -drive "if=pflash,format=raw,unit=1,file=$WORK/vars.fd"
  -drive "file=$WORK/disk.img,format=raw,if=none,id=disk0"
  -netdev "user,id=net0,hostfwd=tcp:127.0.0.1:$SSH_PORT-:22,hostfwd=tcp:127.0.0.1:$WEB_PORT-:80,hostfwd=tcp:127.0.0.1:$WEB2_PORT-:8080,hostfwd=tcp:127.0.0.1:$SHUT_PORT-:9999"
  -object rng-random,filename=/dev/urandom,id=rng0 -device virtio-rng-pci,rng=rng0
  # An emulated USB serial adapter (QEMU's is an FTDI one); what is written to
  # the TCP port on this side comes out of it on the other.
  -device qemu-xhci,id=usb -chardev "socket,id=receiver,host=127.0.0.1,port=$RX_PORT,server=on,wait=off" -device usb-serial,chardev=receiver,bus=usb.0)
if [ "$ARCH" = amd64 ]; then
  # An ordinary PC: a SATA disk, an Intel network card. smm=on and the
  # "secure" flag are what QEMU needs for firmware that enforces Secure Boot.
  # shellcheck disable=SC2054
  QEMU_ARGS+=(-machine q35,smm=on -global driver=cfi.pflash01,property=secure,value=on
    -device ide-hd,drive=disk0,bus=ide.0 -device e1000e,netdev=net0)
else
  # shellcheck disable=SC2054
  QEMU_ARGS+=(-machine virt -device virtio-blk-pci,drive=disk0 -device virtio-net-pci,netdev=net0)
fi
if [ "$KVM" = 1 ]; then QEMU_ARGS+=(-accel kvm -cpu host); oa_note "this computer lends its own processor to the virtual machine (KVM)"
else QEMU_ARGS+=(-accel "tcg,thread=multi" -cpu max); oa_note "no KVM here: QEMU emulates the processor in software, which is many times slower than a real one"; fi
oa_note "$("$QEMU" --version | head -n 1); firmware $FW_CODE with $(basename "$FW_VARS")"
if [ -n "$SB_NOTE" ]; then oa_skip "starting with Secure Boot on — $SB_NOTE. On a real computer: \"mokutil --sb-state\" says whether it is on"; fi
STARTED=$(date +%s)
"$QEMU" "${QEMU_ARGS[@]}" > "$LOGDIR/qemu-output.txt" 2>&1 &
QEMU_PID=$!
# The receiver's lines, sent again and again for as long as the checks run:
# the first lines of a Quansheng ALERT radio as RPi ALERT's scripts/simulate.sh
# sends them (its header, a status line, a decoded reading). "MegaNet:" in the
# status line is the name the radio's firmware gives its station table.
feed_receiver() {
  local k=0
  sleep 5
  exec 9<>"/dev/tcp/127.0.0.1/$RX_PORT" || return 0
  while :; do
    printf 'HDR,fw,4d06107f,schema,2\r\n' >&9 || return 0
    printf 'STA,,%d,-121,-124,0,7890,78,%d,%d,-104,OK,1045,5969,BUILTIN MegaNet:95f6f8d\r\n' $((k * 10000)) "$k" "$k" >&9 || return 0
    printf 'DEC,%d,,%d,12,6129,LOUDOUN BR,LVL,%d,%d,,ABF,NEG,0,0,-%d,-121,-109,40,412,16067B23,0\r\n' "$k" $((k * 10000)) $((1590 + k)) $((1590 + k)) $((60 + k % 20)) >&9 || return 0
    k=$((k + 1)); sleep 3
  done
}
feed_receiver 2>/dev/null &
FEED_PID=$!

rc=0; wait_serial "$TIMEOUT" 'login:' || rc=$?
BOOT_S=$(( $(date +%s) - STARTED ))
if [ "$rc" = 0 ]; then oa_ok "it started: a login prompt on the serial console after $BOOT_S seconds (the first start: partition grown, keys made, set-up applied)"
else
  oa_fail "no login prompt on the serial console after $BOOT_S seconds$( [ "$rc" = 2 ] && echo ' (QEMU stopped)') — the last of the console is in $LOGDIR/serial-console.txt"
  { tail -c 1500 "$WORK/serial.log" 2>/dev/null | tr -d '\r' | sed 's/\x1b\[[0-9;?]*[a-zA-Z]//g; s/^/        /' | tail -n 20; } || true
  sed 's/^/        /' "$LOGDIR/qemu-output.txt" 2>/dev/null || true
  oa_summary || exit 1
fi
if [ "$SECURE_BOOT" = 1 ]; then
  if grep -aq 'UEFI Secure Boot is enabled' "$WORK/serial.log"; then
    oa_ok "the kernel says on the console that it was started with Secure Boot on: the firmware accepted shim (Microsoft's signature), shim accepted GRUB and the kernel (Debian's)"
  else oa_fail "the console has no line saying Secure Boot is on"; fi
fi
if grep -aq 'There is no default password' "$WORK/serial.log"; then oa_ok "the console says, above the login prompt, that there is no default password and where set-up is"
else oa_fail "the notice above the login prompt is missing"; fi
N=$(grep -ac 'prohibited by secure boot policy' "$WORK/serial.log" || true)
if [ "$N" != 0 ]; then oa_note "GRUB printed \"error: prohibited by secure boot policy\" $N time(s) before its menu: Debian's own menu file (/etc/grub.d/25_bli) asks for an optional part that Debian's signed GRUB may not load with Secure Boot on. The start goes on"; fi

# ═════════════════════════════════════════════════════════════════════════════
oa_section "4. From outside, through the network"
# ═════════════════════════════════════════════════════════════════════════════
SSH_OPTS=(-i "$WORK/key" -p "$SSH_PORT" -o BatchMode=yes -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new
  -o "UserKnownHostsFile=$WORK/known_hosts" -o ConnectTimeout=30 -o ServerAliveInterval=20 -o LogLevel=ERROR)
if oa_wait 300 vm_ssh true; then oa_ok "SSH takes the key from the set-up file (account \"admin\")"
else
  oa_fail "SSH with the key does not get in: $(vm_ssh true 2>&1 | tail -n 1)"
  oa_summary || exit 1
fi
got=$(ssh -p "$SSH_PORT" -o PreferredAuthentications=password,keyboard-interactive -o PubkeyAuthentication=no -o BatchMode=yes \
  -o StrictHostKeyChecking=yes -o "UserKnownHostsFile=$WORK/known_hosts" -o ConnectTimeout=30 admin@127.0.0.1 true 2>&1 || true)
case "$got" in
  *"Permission denied (publickey)."*) oa_ok "SSH refuses a password: the server offers keys and nothing else (\"Permission denied (publickey).\")" ;;
  *) oa_fail "a password login was not plainly refused: $got" ;;
esac
got=$(ssh "${SSH_OPTS[@]}" root@127.0.0.1 true 2>&1 || true)
case "$got" in *"Permission denied"*) oa_ok "root cannot log in over SSH, not even with the key" ;; *) oa_fail "root over SSH: ${got:-it got in}" ;; esac
if oa_wait 120 sh -c "[ \"\$(curl -s -o /dev/null -m 10 -w '%{http_code}' http://127.0.0.1:$WEB_PORT/)\" = 200 ]"; then oa_ok "the dashboard answers another computer on port 80 (standard profile)"
else oa_fail "the dashboard does not answer through the network: HTTP $(http_code "http://127.0.0.1:$WEB_PORT/")"; fi
oa_is "the agent behind it is the pinned version" "$AGENT_VERSION" "$(curl -s -m 20 "http://127.0.0.1:$WEB_PORT/api/status" | jq -r .version 2>/dev/null)"
oa_is "another computer is not let into the settings without the dashboard's password (HTTP status)" "401" "$(http_code "http://127.0.0.1:$WEB_PORT/api/config")"

# ═════════════════════════════════════════════════════════════════════════════
# 5. From inside
# ═════════════════════════════════════════════════════════════════════════════
vm_ssh 'mkdir -p oa-image-test && cat > oa-image-test/lib.sh' < "$HERE/lib.sh"
vm_ssh 'cat > oa-image-test/image.sh' < "$HERE/image.sh"
in_vm "$LOGDIR/inside-standard.log" standard "$AGENT_VERSION" "$WANT_NAME" "$WANT_ZONE" "$( [ "$SECURE_BOOT" = 1 ] && echo yes || echo no )" "$DISK_BYTES" "$CA_LINE" "$PROXY"

oa_section "From outside again: the firewall, the proxy, the receiver"
# The part above left a little server on ports 8080 and 9999 that says "open".
oa_is "a port on the firewall's list is reached from outside (8080: the little server answers)" "open 8080" "$(port_says "$WEB2_PORT")"
oa_is "a port not on the list is not: what is sent to it is thrown away (9999: no answer)" "" "$(port_says "$SHUT_PORT")"
if [ -n "$PROXY_PID" ]; then
  if oa_wait 90 grep -aq '^CONNECT [a-z0-9.-]*:443 ' "$WORK/proxy-asked.txt"; then oa_ok "the agent's calls go to the web proxy named in the set-up file: the stand-in proxy was asked \"$(grep -a -m1 '^CONNECT ' "$WORK/proxy-asked.txt" | tr -d '\r')\""
  else oa_fail "the stand-in proxy was asked nothing"; fi
  cp "$WORK/proxy-asked.txt" "$LOGDIR/proxy-asked.txt" 2>/dev/null || true
else
  oa_skip "whether the agent's calls go to the proxy — socat is not installed for the stand-in proxy"
fi
curl -s -m 20 "http://127.0.0.1:$WEB_PORT/api/status" > "$LOGDIR/status-standard.json" 2>/dev/null || true
got=$(jq -r '[.devices.ports[] | select(.kind == "quansheng")][0] | "\(.state), firmware \(.detail.firmware // "?")"' "$LOGDIR/status-standard.json" 2>/dev/null || true)
oa_is "the dashboard shows the receiver to another computer: a Quansheng radio, running, with the firmware the lines named" "running, firmware 4d06107f" "$got"

in_vm "$LOGDIR/inside-stick.log" stick
in_vm "$LOGDIR/inside-bootloader.log" bootloader "$ARCH"

# ═════════════════════════════════════════════════════════════════════════════
# 7. The enterprise profile, and a restart
# ═════════════════════════════════════════════════════════════════════════════
if [ "$DO_RESTART" = 1 ]; then
  in_vm "$LOGDIR/inside-enterprise.log" enterprise
  oa_section "From outside: the enterprise profile keeps the dashboard to the computer itself"
  got=$(http_code "http://127.0.0.1:$WEB2_PORT/")
  if [ "$got" = 000 ]; then oa_ok "another computer asking for the dashboard on port 8080 gets nothing (the profile's lock refuses it)"
  else oa_fail "another computer got HTTP $got from the dashboard on port 8080"; fi
  got=$(http_code "http://127.0.0.1:$WEB_PORT/")
  if [ "$got" = 000 ]; then oa_ok "… and nothing answers on port 80 any more"; else oa_fail "something still answers on port 80: HTTP $got"; fi

  oa_section "7. Restart the computer"
  FROM=$(stat -c %s "$WORK/serial.log")
  STARTED=$(date +%s)
  vm_ssh sudo systemctl reboot >/dev/null 2>&1 || true
  rc=0; wait_serial "$TIMEOUT" 'login:' "$FROM" || rc=$?
  if [ "$rc" = 0 ]; then oa_ok "it came back: a login prompt on the serial console $(( $(date +%s) - STARTED )) seconds after the restart was asked for (shutting down included; Debian's own boot-loader installer has rewritten the boot files since the first start)"
  else oa_fail "no login prompt after the restart — see $LOGDIR/serial-console.txt"; fi
  # StrictHostKeyChecking is on from the first login: a changed host key would refuse this.
  if oa_wait 300 vm_ssh true; then oa_ok "SSH gets in again, and the computer shows the same host key as before"
  else oa_fail "SSH does not get in after the restart: $(vm_ssh true 2>&1 | tail -n 1)"; fi
  in_vm "$LOGDIR/inside-after-restart.log" after-restart "$( [ "$SECURE_BOOT" = 1 ] && echo yes || echo no )"
  got=$(http_code "http://127.0.0.1:$WEB2_PORT/")
  if [ "$got" = 000 ]; then oa_ok "from outside, after the restart: the dashboard still answers this computer only"
  else oa_fail "after the restart another computer got HTTP $got from the dashboard"; fi
fi

# What the checks inside kept (the audit print-outs, the agent's log, …).
mkdir -p "$LOGDIR/from-inside"
vm_ssh sudo bash oa-image-test/image.sh --inside logs 2>/dev/null | tar -C "$LOGDIR/from-inside" -xf - 2>/dev/null || true
oa_section "Shut it down"
vm_ssh sudo systemctl poweroff >/dev/null 2>&1 || true
if oa_wait 180 sh -c "! kill -0 $QEMU_PID 2>/dev/null"; then oa_ok "it shut down cleanly when asked"; QEMU_PID=''
else oa_fail "it did not shut down within three minutes"; fi

# ═════════════════════════════════════════════════════════════════════════════
# 8. Secure Boot refuses a boot file that has been changed
# ═════════════════════════════════════════════════════════════════════════════
if [ "$SECURE_BOOT" = 1 ]; then
  oa_section "8. With Secure Boot on, a boot file changed by one bit is refused"
  if refused_start changed-shim 'Access Denied' "EFI/BOOT/BOOT$EFI_UPPER.EFI" "EFI/debian/shim$EFI.efi"; then
    oa_ok "one bit changed in shim: the firmware does not start it (\"Access Denied\"), and no kernel starts"
  else oa_fail "a changed shim was not plainly refused — see $LOGDIR/serial-console-changed-shim.txt"; fi
  if refused_start changed-grub 'Security Violation' "EFI/BOOT/grub$EFI.efi" "EFI/debian/grub$EFI.efi"; then
    oa_ok "one bit changed in GRUB: shim does not start it (\"Verification failed: (0x1A) Security Violation\"), and no kernel starts"
  else oa_fail "a changed GRUB was not plainly refused — see $LOGDIR/serial-console-changed-grub.txt"; fi
fi

oa_note "logs: $LOGDIR (the serial console, the set-up file used, the audit print-outs, the agent's log)"
oa_summary
