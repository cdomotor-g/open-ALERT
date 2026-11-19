#!/bin/bash
# firmware/test/image.sh — start the disk image in a virtual machine, the way
# a freshly flashed computer starts, and check it from outside and from inside.
#
#   firmware/test/image.sh [options]
#
# What it does, in order:
#   1. Looks at the image file without starting it: the partitions, the boot
#      files and who signed them, the first set-up files, that the boot menu
#      is closed and takes Linux from the disk GRUB started from (no search
#      for an identifier), and that nothing in it is one computer's own (no
#      password, no SSH host key, no machine-id).
#   2. Makes a working copy on a larger "disk", and writes a first set-up file
#      into its CIDATA partition as a person would: the image's own example
#      (firmware/image/cidata/user-data) with parts switched on — a name, an
#      administrator account with an SSH key made for this run, the time
#      zone, a private certificate authority, a web proxy. And makes an
#      intruder's USB stick: a second disk labelled CIDATA whose set-up file
#      would make an account of its own.
#   3. Starts it under QEMU with UEFI firmware, Secure Boot ON with Microsoft's
#      keys (unless --no-secure-boot), a network card, the intruder's stick
#      plugged in, and an emulated USB serial adapter that plays a receiver (a
#      Quansheng ALERT radio's lines, as RPi ALERT's scripts/simulate.sh sends
#      them).
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
#   6. Lets Debian's own boot-loader updates run (GRUB's, then shim's) and
#      checks the boot files: each time grub-install writes Debian's small
#      grub.cfg, the image's own must be put back.
#   7. Puts the enterprise profile in force, restarts the computer, and
#      checks that everything came up again by itself, locked down.
#   8. Starts a fresh copy exactly as it is flashed, with nothing switched on
#      in user-data, and checks from outside what the image promises of that
#      state: it starts, the dashboard answers, and nobody can log in.
#   9. Starts another fresh copy set up as an organisation would set it up:
#      user-data with only an account and the line that chooses the
#      enterprise profile switched on. Checks that it comes up locked down
#      without anybody having logged in.
#  10. With Secure Boot on: starts two more copies, one with a single bit
#      changed in shim and one with a single bit changed in GRUB, and checks
#      that neither is let through to the kernel.
#  11. Starts one more copy with its serial port in hand, as a person with a
#      serial cable has it, and tries the boot menu's editor and GRUB's
#      command line: both must ask for a name and a password and take none,
#      and the menu's own entry must still start Linux.
#  12. Starts one more copy with a USB stick plugged in that is a whole copy
#      of the image (so its main partition carries the same identifier), its
#      EFI partition emptied and a boot menu of its own on it: the computer's
#      GRUB must not take that menu, and Linux must not start from the stick
#      (the start-up file system refuses to go on and restarts the computer,
#      or the stick shows up too late to matter).
#
# Options
#   --image FILE        the .img to check (default: dist/open-alert-base-<version>-<arch>-uefi.img)
#   --arch amd64|arm64  which image and which emulator (default: this computer's kind)
#   --no-secure-boot    start with Secure Boot off (it is then reported as not checked)
#   --no-restart        leave out part 7
#   --no-more-copies    leave out parts 8, 9, 11 and 12
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
# and it takes about ten (more on a slow computer).
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
  local got pid root_dev disk part_end disk_end fs_bytes n f own stick
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

  oa_section "Inside: the boot menu and Linux come from this disk only"
  g_stub_own "at the first start"
  oa_is "the watcher that puts it back after a GRUB or shim update is running (open-alert-image-boot-stub.path)" "active" "$(systemctl is-active open-alert-image-boot-stub.path 2>&1)"
  got=$(systemctl show -p ExecMainStartTimestampMonotonic --value open-alert-image-boot-stub.service)
  oa_is "… and its service ran at this start without an error" "success 0 ran" "$(systemctl show -p Result --value open-alert-image-boot-stub.service) $(systemctl show -p ExecMainStatus --value open-alert-image-boot-stub.service) $( [ "${got:-0}" != 0 ] && echo ran || echo 'did not run')"
  g_menu_own_disk "at the first start"
  oa_has "the kernel was started with panic=30: a start that fails restarts the computer, and the start-up file system never offers a prompt" /proc/cmdline ' panic=30( |$)'
  got=$(lsinitramfs "/boot/initrd.img-$(uname -r)" 2>/dev/null | grep -c 'scripts/local-\(premount\|bottom\)/open-alert-image-one-main-partition$' || true)
  oa_is "the start-up file system holds the check that only one disk carries the main partition (before and after it is mounted)" "2" "$got"
  got=$(lsinitramfs "/boot/initrd.img-$(uname -r)" 2>/dev/null | grep -c '^usr/lib/udev/rules.d/61-open-alert-image-own-disk-first.rules$' || true)
  oa_is "… and the udev rule that names this disk, not a USB one, when both carry an identifier" "1" "$got"

  oa_section "Inside: the first set-up file was applied"
  got=$(cloud-init status --long 2>&1 || true)
  printf '%s\n' "$got" > "$G_OUT/cloud-init-status.txt"
  if printf '%s' "$got" | grep -q '^status: done' && printf '%s' "$got" | grep -q '^errors: \[\]'; then oa_ok "cloud-init finished without an error"
  else oa_fail "cloud-init: $(printf '%s' "$got" | tr '\n' ' ' | cut -c1-300)"; fi
  if printf '%s' "$got" | grep -q 'DataSourceNoCloud \[seed=/var/lib/cloud/seed/nocloud\]'; then oa_ok "cloud-init took the set-up from its own folder on the main partition and from nowhere else ($(printf '%s' "$got" | sed -n 's/^detail: //p'))"
  else oa_fail "the set-up did not come from cloud-init's own folder: $(printf '%s' "$got" | sed -n 's/^detail: //p')"; fi
  root_dev=$(findmnt -no SOURCE /)
  disk="/dev/$(lsblk -no PKNAME "$root_dev")"
  own=$(lsblk -lnpo NAME "$disk" | sed -n '3p')
  journalctl -b -u open-alert-image-own-cidata.service --no-pager > "$G_OUT/own-cidata.txt" 2>&1 || true
  if grep -q "were taken from this disk's own CIDATA partition ($own)" "$G_OUT/own-cidata.txt"; then oa_ok "that folder was filled, before cloud-init started, from the CIDATA partition of the disk the computer started from ($own, the second partition of $disk)"
  else oa_fail "the service that fills cloud-init's folder did not say it read $own: $(grep 'open-alert-image:' "$G_OUT/own-cidata.txt" | tail -n 1)"; fi
  mkdir -p /run/oa-test-cidata
  if mount -o ro "$own" /run/oa-test-cidata 2>/dev/null; then
    if cmp -s /run/oa-test-cidata/user-data /var/lib/cloud/seed/nocloud/user-data && cmp -s /run/oa-test-cidata/meta-data /var/lib/cloud/seed/nocloud/meta-data; then oa_ok "the two files in it are that partition's, byte for byte"
    else oa_fail "the files in /var/lib/cloud/seed/nocloud are not the ones on $own"; fi
    umount /run/oa-test-cidata
  else oa_fail "$own could not be mounted to compare"; fi
  oa_is "cloud-init's folder and the files in it are root's alone (owner and mode)" "root 700 root 600 root 600" \
    "$(stat -c '%U %a' /var/lib/cloud/seed/nocloud /var/lib/cloud/seed/nocloud/user-data /var/lib/cloud/seed/nocloud/meta-data | tr '\n' ' ' | sed 's/ $//')"

  oa_section "Inside: an intruder's USB stick labelled CIDATA has been plugged in since before the first start"
  # What the stick's set-up file would have done: a name, an account, a file, a line on the console.
  stick=$(blkid -t LABEL=CIDATA -o device | grep -vx "$own" | tr '\n' ' ' | sed 's/ $//')
  if [ -n "$stick" ] && [ "$(lsblk -dno TRAN "$stick" 2>/dev/null | head -n 1)" = usb ]; then
    oa_ok "the computer sees the stick: $stick, a USB disk whose file system is labelled CIDATA like the image's own partition"
    oa_check_not "the stick's set-up file was not applied: the file it would have written is not there" test -e /root/intruder-was-here
    oa_check_not "… the account it would have made does not exist" id intruder
    oa_is "… and the only accounts a person could log in to are the ones the disk's own file named" "admin" "$(awk -F: '$3 >= 1000 && $3 < 60000 {print $1}' /etc/passwd | tr '\n' ' ' | sed 's/ $//')"
  else
    oa_fail "the intruder's stick is not there to be found (file systems labelled CIDATA: $(blkid -t LABEL=CIDATA -o device | tr '\n' ' ')), so this start shows nothing about it"
  fi
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
  # Files the build wrote itself: readable by every user, writable by root alone.
  oa_is "the files the build wrote in /etc can be read by every user and changed by root alone (hosts, hostname, fstab, Debian's addresses)" \
    "root 644 root 644 root 644 root 644" "$(stat -c '%U %a' /etc/hosts /etc/hostname /etc/fstab /etc/apt/sources.list.d/debian.sources 2>&1 | tr '\n' ' ' | sed 's/ $//')"
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
  # whoever reaches it, on two ports the image's firewall does not let in:
  # 8080 (the enterprise profile's dashboard port) and 9999. It is stopped
  # from outside once it has been tried, or goes away after three minutes
  # (the enterprise profile wants port 8080 later).
  nohup node -e '
    const net = require("net");
    for (const p of [8080, 9999]) net.createServer((s) => { s.end("open " + p + "\n"); }).listen(p, "0.0.0.0");
    setTimeout(() => process.exit(0), 180000);' oa-little-server < /dev/null > /dev/null 2>&1 &
  oa_wait 60 sh -c 'ss -Hltn | grep -q ":9999 "' || oa_note "the little server for the firewall check did not start"
  oa_is "a little server now listens on ports 8080 and 9999 on every address, and answers on the computer itself" "open 8080" \
    "$(node -e 'const s = require("net").connect(8080, "127.0.0.1"); s.setTimeout(5000, () => process.exit(1)); s.on("data", (d) => { process.stdout.write(String(d).trim()); process.exit(0); }); s.on("error", () => process.exit(1));' 2>/dev/null || true)"
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
  mkdir -p "$G_OUT"
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
  # Its device file is named after its bus and its number on the bus. The
  # agent finds the stick within seconds and rtl_sdr resets it; for the moment
  # of a reset the kernel shows the number as 0. Wait for the real one.
  node=''
  for _ in $(seq 1 60); do
    got=$(cat "$dev/devnum" 2>/dev/null || true)
    if [ -n "$got" ] && [ "$got" != 0 ]; then
      node=$(printf '/dev/bus/usb/%03d/%03d' "$(cat "$dev/busnum")" "$got")
      if [ -c "$node" ]; then break; fi
    fi
    sleep 0.5
  done
  if [ ! -c "$node" ]; then oa_fail "the pretend stick has no device file (looked for \"$node\")"; return 0; fi
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
  # rtl_sdr's own words, as the agent keeps them. They are asked for again
  # and again for a while: with no samples coming (none can, here) the agent
  # starts rtl_sdr anew every ten seconds, and has no words to show for a
  # moment each time. It also writes them in its log whenever it stops one.
  local opened='' refused=''
  for _ in $(seq 1 90); do
    got=$(g_status '(d.devices.sdrs[0] && d.devices.sdrs[0].stderr || []).join(" | ")' || true)
    if printf '%s' "$got" | grep -q 'usb_open error\|Failed to open'; then refused=$got; break; fi
    if printf '%s' "$got" | grep -Eq 'Reading samples|rtlsdr_write_reg|Allocating|Sampling at|Tuner'; then opened=$got; break; fi
    opened=$(journalctl -u "$UNIT" --no-pager | sed -n 's/^.*rtl_sdr stopped ([A-Z]*): \(.*\(Reading samples\|Allocating\).*\) — restarting.*$/\1/p' | tail -n 1)
    if [ -n "$opened" ]; then break; fi
    sleep 1
  done
  printf '%s\n' "${refused:-${opened:-$got}}" > "$G_OUT/stick-rtl_sdr.txt"
  if [ -n "$refused" ]; then oa_fail "rtl_sdr, started by the sandboxed agent, could not open the stick: $refused"
  elif [ -n "$opened" ]; then oa_ok "rtl_sdr, started by the sandboxed agent as rpi-alert, OPENED the device and went on to ask it for samples (\"$opened\"). It gets none: nothing is behind the pretend stick"
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
  local arch=$1 efi upper target before after f n
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
  # Debian's grub-install writes its own small grub.cfg beside GRUB, which
  # takes the first disk carrying the main partition's identifier. The image
  # puts its own back at once (the watcher, open-alert-image-boot-stub.path)
  # and again when the menu is made (09_open-alert-image).
  g_stub_own "after Debian's boot-loader update"
  if grep -q 'had been written by another program' "$G_OUT/grub-reconfigure.txt" || journalctl -b -u open-alert-image-boot-stub.service --no-pager 2>/dev/null | grep -q 'had been written by another program'; then
    oa_ok "… and it was Debian's grub-install that had written its own there, which the image then replaced (so this was tried for real)"
  else oa_fail "nothing says Debian's small grub.cfg was found and replaced: was it written at all? ($(tail -n 2 "$G_OUT/grub-reconfigure.txt" | tr '\n' ' '))"; fi
  oa_has "the boot menu still names the main partition by its identifier for Linux (root=UUID=)" /boot/grub/grub.cfg "root=UUID=$(findmnt -no UUID /)"
  # The same update writes the menu file anew: it must still be closed, and
  # still start Linux from this disk only.
  g_menu_closed "after Debian's boot-loader update"
  g_menu_own_disk "after Debian's boot-loader update"
  # A shim update runs grub-install too, and nothing after it: no menu is
  # made. Only the watcher can put the image's file back then.
  n=$(journalctl -b -u open-alert-image-boot-stub.service --no-pager 2>/dev/null | grep -c 'had been written by another program' || true)
  if DEBIAN_FRONTEND=noninteractive dpkg-reconfigure -fnoninteractive shim-signed > "$G_OUT/shim-reconfigure.txt" 2>&1; then oa_ok "dpkg-reconfigure shim-signed (the script a shim update runs: grub-install, and no new menu) ended without an error"
  else oa_fail "dpkg-reconfigure shim-signed failed: $(tail -n 3 "$G_OUT/shim-reconfigure.txt" | tr '\n' ' ')"; fi
  # shellcheck disable=SC2016  # the text is for the shell that is started, not this one
  if oa_wait 30 sh -c '[ "$(journalctl -b -u open-alert-image-boot-stub.service --no-pager 2>/dev/null | grep -c "had been written by another program")" -gt "$1" ] && cmp -s /usr/lib/open-alert-image/efi-grub.cfg /boot/efi/EFI/debian/grub.cfg' sh "$n"; then
    oa_ok "… its grub-install wrote Debian's small grub.cfg again, and the watcher put the image's own back within seconds: $(journalctl -b -u open-alert-image-boot-stub.service --no-pager -o cat 2>/dev/null | grep 'had been written' | tail -n 1 | cut -c1-120)"
  else oa_fail "after the shim update the image's small grub.cfg was not put back by the watcher within 30 seconds ($(journalctl -b -u open-alert-image-boot-stub.service --no-pager -o cat 2>/dev/null | tail -n 2 | tr '\n' ' '))"; fi
  g_stub_own "after the shim update"
  # A GRUB update that brings a new copy of Debian's own menu script switches
  # that script on again. The next time the menu is made, it is switched off
  # once more and the entries are still written once.
  chmod a+x /etc/grub.d/10_linux
  if update-grub > "$G_OUT/update-grub.txt" 2>&1; then oa_ok "update-grub (what a kernel update runs) ends without an error, with Debian's own menu script switched on again as a GRUB update would leave it"
  else oa_fail "update-grub failed: $(tail -n 3 "$G_OUT/update-grub.txt" | tr '\n' ' ')"; fi
  g_menu_closed "after that"
  g_menu_own_disk "after that"
  oa_check_not "… and Debian's own menu script is switched off again, so the entries are written once" test -x /etc/grub.d/10_linux
  oa_is "… each of Linux's entries is in the menu once" "" "$(grep -E "^[[:space:]]*menuentry " /boot/grub/grub.cfg | sed -E "s/^[[:space:]]*menuentry '([^']*)'.*/\1/" | sort | uniq -d | tr '\n' ';')"
  cp /boot/grub/grub.cfg "$G_OUT/grub.cfg.txt"
}

# The boot menu file as it is now: an owner, no password, and every entry
# that starts Linux marked to start by itself.   g_menu_closed "when"
g_menu_closed() {
  local cfg=/boot/grub/grub.cfg n rest
  n=$(grep -E "^[[:space:]]*(menuentry|submenu) " "$cfg" | grep -c -e '--unrestricted' || true)
  rest=$(grep -E "^[[:space:]]*(menuentry|submenu) " "$cfg" | grep -v -e '--unrestricted' | sed -E "s/^[[:space:]]*(menuentry|submenu) '([^']*)'.*/\2/" | tr '\n' ';')
  if grep -q '^set superusers="open-alert-nobody"$' "$cfg" && ! grep -Eq '^[[:space:]]*password' "$cfg" && [ "$n" -ge 1 ] && { [ -z "$rest" ] || [ "$rest" = "UEFI Firmware Settings;" ]; }; then
    oa_ok "$1 the boot menu is still closed: an owner with no password, and $n entries that start by themselves (needing the owner, and so out of use: ${rest:-none})"
  else
    oa_fail "$1 the boot menu is not as it should be: owner line $(grep -c '^set superusers=' "$cfg" || true), password lines $(grep -Ec '^[[:space:]]*password' "$cfg" || true), entries that start by themselves $n, others: $rest"
  fi
}

# The menu's entries start Linux from the disk GRUB itself started from: none
# looks for a partition by its identifier, and each one that loads Linux uses
# the partition the small file on the EFI partition chose ($oa_main).
#   g_menu_own_disk "when"
g_menu_own_disk() {
  local cfg=/boot/grub/grub.cfg n_linux n_own searches others
  searches=$(grep -Ec '^[[:space:]]*search[[:space:]]' "$cfg" || true)
  # shellcheck disable=SC2016  # $oa_main is GRUB's, not this shell's
  others=$(grep -E 'set root=' "$cfg" | grep -vc 'set root="\$oa_main"' || true)
  n_linux=$(grep -Ec '^[[:space:]]*linux[[:space:]]' "$cfg" || true)
  # shellcheck disable=SC2016
  n_own=$(grep -c 'if \[ -n "\$oa_main" \]; then set root="\$oa_main"; fi' "$cfg" || true)
  if [ "$searches" = 0 ] && [ "$others" = 0 ] && [ "$n_linux" -ge 1 ] && [ "$n_own" = "$n_linux" ] && grep -Eq '^[[:space:]]*linux[[:space:]].* panic=30( |$)' "$cfg"; then
    oa_ok "$1 the menu's $n_linux entries that load Linux take it from the disk GRUB started from (\$oa_main), none looks for a partition by its identifier, and the kernel is told panic=30"
  else
    oa_fail "$1 the menu could start Linux from another disk: \"search\" lines $searches, other ways of choosing the partition $others, entries that load Linux $n_linux, of them using \$oa_main $n_own, panic=30 $(grep -Ec 'panic=30' "$cfg" || true)"
  fi
}

# The small grub.cfg beside GRUB on the EFI partition is the image's own
# (wherever there is one), and no copy of Debian's.   g_stub_own "when"
g_stub_own() {
  local got rc=0
  got=$(/bin/bash /usr/lib/open-alert-image/boot-stub --check 2>&1) || rc=$?
  if [ "$rc" = 0 ] && ! grep -Eqs '^[[:space:]]*search' /boot/efi/EFI/debian/grub.cfg; then
    oa_ok "$1 the small grub.cfg on the EFI partition is the image's own: GRUB takes its menu from partition 3 of the disk it started from, and looks for no identifier ($(printf '%s' "$got" | tr '\n' ';'))"
  else
    oa_fail "$1 the small grub.cfg on the EFI partition is not the image's own: $(printf '%s' "$got" | tr '\n' ';') — $(head -n 3 /boot/efi/EFI/debian/grub.cfg 2>&1 | tr '\n' ' ')"
  fi
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
  got=$(systemctl show -p BindsTo --value "$UNIT" | tr ' ' '\n' | grep -x "$FW_UNIT" || true)
  oa_is "the agent's service is tied to the lock's: it runs only while the lock's service does" "$FW_UNIT" "$got"
  oa_has "audit: the lock's keeper is running" "$G_OUT/audit-enterprise.txt" "the lock's keeper +running"
  # Reloading or restarting the image's firewall must not take the lock away.
  systemctl reload nftables
  sleep 1
  oa_check "after \"systemctl reload nftables\" both tables are still loaded" sh -c 'nft list table inet open_alert_base >/dev/null && nft list table inet open_alert_image >/dev/null'
  systemctl restart nftables
  sleep 1
  oa_check "after \"systemctl restart nftables\" too" sh -c 'nft list table inet open_alert_base >/dev/null && nft list table inet open_alert_image >/dev/null'
  # Every table cleared by hand: the lock's keeper puts the lock back; the
  # image's own table comes back when its service is reloaded.
  pid=$(g_pid)
  nft flush ruleset
  if oa_wait 5 nft list table inet open_alert_base; then oa_ok "every firewall table cleared by hand (nft flush ruleset): the profile's lock is put back at once by its keeper"
  else oa_fail "the profile's lock did not come back after \"nft flush ruleset\""; fi
  oa_is "… and the agent ran on undisturbed (the same process)" "$pid" "$(g_pid)"
  systemctl reload nftables
  oa_check "… the image's own table is back after \"systemctl reload nftables\"" nft list table inet open_alert_image
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
  oa_is "there is still one administrator account and no other new one (the intruder's stick is still plugged in)" "admin" "$(awk -F: '$3 >= 1000 && $3 < 60000 {print $1}' /etc/passwd | tr '\n' ' ' | sed 's/ $//')"
  oa_check_not "the stick's set-up file was not applied at this start either" test -e /root/intruder-was-here
  if journalctl -b -u open-alert-image-own-cidata.service --no-pager 2>/dev/null | grep -q "this disk's own CIDATA partition"; then oa_ok "the first set-up files were looked at again on this disk's own partition, and nowhere else"
  else oa_fail "the service that reads the disk's own CIDATA partition did not run at this start"; fi
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

# ── part: a fresh copy whose user-data chose the enterprise profile ─────────
# Nobody has logged in before this runs: what is checked is what the first
# start did by itself.
inside_enterprise_first() {
  local got pid
  G_PORT=8080
  mkdir -p "$G_OUT"
  oa_section "Inside the copy that chose the enterprise profile in user-data: put in force by the first start"
  # The profile is the last thing the first set-up does: wait until it has finished.
  timeout 900 cloud-init status --wait > /dev/null 2>&1 || true
  got=$(cloud-init status --long 2>&1 || true)
  printf '%s\n' "$got" > "$G_OUT/cloud-init-status-enterprise-copy.txt"
  if printf '%s' "$got" | grep -q '^status: done' && printf '%s' "$got" | grep -q '^errors: \[\]'; then oa_ok "cloud-init finished without an error"
  else oa_fail "cloud-init: $(printf '%s' "$got" | tr '\n' ' ' | cut -c1-300)"; fi
  oa_is "the profile in force" "enterprise" "$(cat /etc/open-alert-base/profile 2>&1)"
  oa_is "the computer kept the image's own name (user-data named none)" "open-alert-base" "$(hostname)"
  if oa_wait 90 oa_http_ok http://127.0.0.1:8080/; then oa_ok "the dashboard answers on port 8080 on the computer itself"; else oa_fail "the dashboard does not answer on 127.0.0.1:8080"; fi
  oa_is "the service is running" "active" "$(systemctl is-active "$UNIT" 2>&1)"
  pid=$(g_pid)
  oa_is "the running agent holds no privilege at all, and can get none" "0000000000000000 0000000000000000 0000000000000000" \
    "$(oa_proc_status "$pid" CapEff) $(oa_proc_status "$pid" CapBnd) $(oa_proc_status "$pid" CapAmb)"
  oa_check_not "the file that gave the standard profile its one privilege is gone" test -e "$OA_DROPIN_DIR/10-low-port.conf"
  oa_is "the only port the agent's user listens on" "8080" "$(oa_listening rpi-alert | awk '{print $1}' | sort -u | tr '\n' ' ' | sed 's/ $//')"
  oa_is "the profile's firewall lock is on, and set to load at every start" "active enabled" "$(systemctl is-active "$FW_UNIT" 2>&1) $(systemctl is-enabled "$FW_UNIT" 2>&1)"
  oa_check "its rules are loaded beside the image's own (two tables)" sh -c 'nft list table inet open_alert_base >/dev/null && nft list table inet open_alert_image >/dev/null'
  oa_is "what Flood-Net may do (remote.mode)" "report" "$(g_status 'd.remote && d.remote.mode' 2>/dev/null || true)"
  oa_is "the only TCP ports open to other computers" "22 8080 " "$(ss -Hltn | awk '{ a = $4; p = a; sub(/.*:/, "", p); sub(/:[^:]*$/, "", a); if (a !~ /^127\./ && a != "[::1]") print p }' | sort -un | tr '\n' ' ')"
  g_score_check "enterprise (chosen in user-data)"
  open-alert-base audit > "$G_OUT/audit-enterprise-copy.txt" 2>&1 || true
  oa_has "audit: the firewall lock is on" "$G_OUT/audit-enterprise-copy.txt" 'firewall lock +on '
  journalctl -u "$UNIT" --no-pager > "$G_OUT/journal-enterprise-copy.txt" 2>&1 || true
  # How long the agent ran with the standard profile before the set-up
  # changed it: from its first start to its first stop, and to its start
  # under the enterprise profile.
  got=$(journalctl -u "$UNIT" -o short-unix --no-pager 2>/dev/null | awk '
    /Started open-alert-base/  { started[n++] = $1 }
    /Stopping open-alert-base/ { if (!stopped) stopped = $1 }
    END { if (n >= 2 && stopped) printf "%d %d", stopped - started[0], started[n-1] - started[0] }')
  if [ -n "$got" ]; then oa_note "at this first start the agent ran with the standard profile (dashboard on port 80) for about ${got% *} seconds before the set-up stopped it, and was back under the enterprise profile ${got#* } seconds after it had first started"; fi
}

if [ "${1:-}" = "--inside" ]; then
  part=${2:?--inside needs a part}; shift 2
  trap 'oa_fail "the checks inside stopped early at line $LINENO (exit status $?)"' ERR
  case "$part" in
    standard) inside_standard "$@" ;;
    stick) inside_stick "$@" ;;
    bootloader) inside_bootloader "$@" ;;
    enterprise) inside_enterprise "$@" ;;
    enterprise-first) inside_enterprise_first "$@" ;;
    after-restart) inside_after_restart "$@" ;;
    logs) tar -C "$G_OUT" -cf - . ;;
    *) echo "unknown part $part" >&2; exit 2 ;;
  esac
  exit 0
fi

# ═════════════════════════════════════════════════════════════════════════════
# On the computer that runs the checks
# ═════════════════════════════════════════════════════════════════════════════

IMAGE=''; ARCH=''; SECURE_BOOT=1; DO_RESTART=1; DO_SECOND=1; DISK_SIZE=8G; TIMEOUT=''; LOGDIR=''; KEEP=0
while [ $# -gt 0 ]; do
  case "$1" in
    --image) IMAGE="${2:?--image needs a file}"; shift 2 ;;
    --arch) ARCH="${2:?--arch needs amd64 or arm64}"; shift 2 ;;
    --no-secure-boot) SECURE_BOOT=0; shift ;;
    --no-restart) DO_RESTART=0; shift ;;
    --no-more-copies) DO_SECOND=0; shift ;;
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
QEMU_PID=''; FEED_PID=''; PROXY_PID=''; MENU_PID=''; MENU_CAT=''
cleanup() {
  local rc=$?
  set +e
  if [ -n "$MENU_CAT" ]; then kill "$MENU_CAT" 2>/dev/null; fi
  if [ -n "$MENU_PID" ]; then kill "$MENU_PID" 2>/dev/null; fi
  if [ -n "$FEED_PID" ]; then kill "$FEED_PID" 2>/dev/null; fi
  if [ -n "$PROXY_PID" ]; then kill "$PROXY_PID" 2>/dev/null; fi
  if [ -n "$QEMU_PID" ] && kill -0 "$QEMU_PID" 2>/dev/null; then kill "$QEMU_PID" 2>/dev/null; sleep 1; kill -9 "$QEMU_PID" 2>/dev/null; fi
  if [ -f "$WORK/serial.log" ]; then tr -d '\r' < "$WORK/serial.log" | sed 's/\x1b\[[0-9;?]*[a-zA-Z]//g' > "$LOGDIR/serial-console.txt"; fi
  if [ -f "$WORK/serial2.log" ]; then tr -d '\r' < "$WORK/serial2.log" | sed 's/\x1b\[[0-9;?]*[a-zA-Z]//g' > "$LOGDIR/serial-console-enterprise-copy.txt"; fi
  if [ -f "$WORK/serial0.log" ]; then tr -d '\r' < "$WORK/serial0.log" | sed 's/\x1b\[[0-9;?]*[a-zA-Z]//g' > "$LOGDIR/serial-console-untouched-copy.txt"; fi
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
# Wait for text on the serial console of the virtual machine that is running
# (SERIAL is its console's file).   wait_serial SECONDS PATTERN [from-byte]
SERIAL="$WORK/serial.log"
wait_serial() {
  local left=$1 pat=$2 from=${3:-0}
  while [ "$left" -gt 0 ]; do
    if tail -c "+$((from + 1))" "$SERIAL" 2>/dev/null | grep -aq -- "$pat"; then return 0; fi
    if ! kill -0 "$QEMU_PID" 2>/dev/null; then return 2; fi
    sleep 2; left=$((left - 2))
  done
  return 1
}
# The host key SSH wrote down for a virtual machine at its first login.
host_key() { awk '{print $NF}' "$1" | sort | tr '\n' ' '; }
http_code() { curl -s -o "${2:-/dev/null}" -m 20 -w '%{http_code}' "$1" 2>/dev/null || true; }
# Change one bit in the middle of a file.
flip_bit() {
  local at byte
  at=$(( $(stat -c %s "$1") / 2 ))
  byte=$(od -An -tu1 -j "$at" -N 1 "$1" | tr -d ' ')
  # shellcheck disable=SC2059  # the format is the byte itself, written as an octal escape
  printf "\\$(printf '%03o' $((byte ^ 1)))" | dd of="$1" bs=1 seek="$at" conv=notrunc status=none
}
# The part of QEMU's command line every start here shares: the UEFI firmware
# and its own small store of settings, the disk, the kind of machine, the
# processor, and the serial console written to a file. Left in VM_ARGS.
#   vm_base DISK FIRMWARE-SETTINGS-COPY SERIAL-CONSOLE-FILE
VM_ARGS=()
vm_base() {
  # shellcheck disable=SC2054  # the commas are QEMU's own notation, inside one argument
  VM_ARGS=(-display none -serial "file:$3"
    -drive "if=pflash,format=raw,unit=0,file=$FW_CODE,readonly=on" -drive "if=pflash,format=raw,unit=1,file=$2"
    -drive "file=$1,format=raw,if=none,id=disk0")
  if [ "$ARCH" = amd64 ]; then
    # An ordinary PC with a SATA disk. smm=on and the "secure" flag are what
    # QEMU needs for firmware that enforces Secure Boot.
    # shellcheck disable=SC2054
    VM_ARGS+=(-machine q35,smm=on -global driver=cfi.pflash01,property=secure,value=on -device ide-hd,drive=disk0,bus=ide.0)
  else
    # shellcheck disable=SC2054
    VM_ARGS+=(-machine virt -device virtio-blk-pci,drive=disk0)
  fi
  # shellcheck disable=SC2054
  if [ "$KVM" = 1 ]; then VM_ARGS+=(-accel kvm -cpu host); else VM_ARGS+=(-accel "tcg,thread=multi" -cpu max); fi
}
# The network card: an Intel one on a PC, QEMU's own on ARM.
if [ "$ARCH" = amd64 ]; then NIC=e1000e; else NIC=virtio-net-pci; fi

# QEMU with an emulated processor has been seen to crash by itself early in
# a start: a "segmentation fault" in the emulator (QEMU 8.2.2, once in the
# first thirty-odd starts on the test computer). That is a fault of the
# emulator's, not of what it runs. When QEMU has ended on a fault of its own —
# and only then; not when a start takes too long, and not when QEMU ends any
# other way — everything is made afresh and started once more, and a note
# says so.   emulator_crashed PID   → 0 when that process was ended by a signal
EMULATOR_STATUS=0
emulator_crashed() {
  EMULATOR_STATUS=0
  wait "$1" 2>/dev/null || EMULATOR_STATUS=$?
  [ "$EMULATOR_STATUS" -gt 128 ]
}

# Start a machine and wait for a login prompt on its serial console.
#   start_and_wait PREPARE FILE-FOR-QEMU'S-OWN-MESSAGES
# PREPARE is a function that makes the machine's disk and its firmware
# settings afresh, and leaves QEMU's arguments in QEMU_ARGS and the console's
# file in SERIAL. It is called again if QEMU crashes (see above).
# Returns 0 with a login prompt, 1 with none in time, 2 when QEMU stopped.
QEMU_ARGS=()
start_and_wait() {
  local prepare=$1 out=$2 try rc
  for try in 1 2; do
    "$prepare"
    STARTED=$(date +%s)
    "$QEMU" "${QEMU_ARGS[@]}" > "$out" 2>&1 &
    QEMU_PID=$!
    rc=0; wait_serial "$TIMEOUT" 'login:' || rc=$?
    if [ "$rc" != 2 ]; then return "$rc"; fi
    if [ "$try" = 1 ] && emulator_crashed "$QEMU_PID"; then
      oa_note "QEMU itself crashed $(( $(date +%s) - STARTED )) seconds into this start (it was ended by signal $((EMULATOR_STATUS - 128))): a fault in the emulator. Everything is made afresh and started once more"
      continue
    fi
    return 2
  done
}

# Start a copy of the image in which the named boot files have one bit
# changed, with Secure Boot on and nothing else attached, and wait for the
# words that say it was refused.   refused_start NAME "WORDS" FILE-ON-THE-EFI-PARTITION…
refused_start() {
  local name=$1 words=$2 f pid left try; shift 2
  for try in 1 2; do
    cp --sparse=always "$IMAGE" "$WORK/$name.img"
    for f in "$@"; do
      mcopy -n -i "$WORK/$name.img@@$ESP_OFF" "::$f" "$WORK/$name.bin"
      flip_bit "$WORK/$name.bin"
      mcopy -o -i "$WORK/$name.img@@$ESP_OFF" "$WORK/$name.bin" "::$f"
      rm -f "$WORK/$name.bin"
    done
    cp "$FW_VARS" "$WORK/$name.vars"
    vm_base "$WORK/$name.img" "$WORK/$name.vars" "$WORK/$name.serial"
    "$QEMU" "${VM_ARGS[@]}" -m 1024 -smp 2 -net none > /dev/null 2>&1 &
    pid=$!
    left=$((TIMEOUT / 4))
    while [ "$left" -gt 0 ] && kill -0 "$pid" 2>/dev/null; do
      if grep -aq -- "$words" "$WORK/$name.serial" 2>/dev/null; then break; fi
      sleep 2; left=$((left - 2))
    done
    if [ "$try" = 1 ] && ! kill -0 "$pid" 2>/dev/null && emulator_crashed "$pid"; then
      oa_note "QEMU itself crashed during this start (it was ended by signal $((EMULATOR_STATUS - 128))): a fault in the emulator. The changed copy is made afresh and started once more"
      continue
    fi
    break
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
  # The boot menu is closed: an owner nobody can be, and entries that start by themselves.
  rootfs 'cat /boot/grub/grub.cfg' > "$WORK/grub.cfg" || true
  cp "$WORK/grub.cfg" "$LOGDIR/grub.cfg.as-built.txt" 2>/dev/null || true
  oa_has "the boot menu has an owner, so its editor and GRUB's command line ask for a name and a password" "$WORK/grub.cfg" '^set superusers="open-alert-nobody"$'
  oa_has_not "… and no password is set for that owner or anybody else, so there is none that opens them" "$WORK/grub.cfg" '^[[:space:]]*password'
  N=$(grep -E "^[[:space:]]*(menuentry|submenu) " "$WORK/grub.cfg" | grep -c -e '--unrestricted' || true)
  if [ "$N" -ge 2 ]; then oa_ok "… while the $N entries that start Linux are marked to start by themselves, as they are written (\"--unrestricted\")"
  else oa_fail "the boot menu has $N entries marked to start by themselves (wanted the two for Linux at least)"; fi
  got=$(grep -E "^[[:space:]]*(menuentry|submenu) " "$WORK/grub.cfg" | grep -v -e '--unrestricted' | sed -E "s/^[[:space:]]*(menuentry|submenu) '([^']*)'.*/\2/" | tr '\n' ';')
  case "$got" in ''|'UEFI Firmware Settings;') oa_ok "… and the only entry left needing the owner, and so out of use, is: ${got:-none}" ;;
    *) oa_fail "these menu entries need an owner nobody can be, and are not expected: $got" ;; esac
  oa_is "Debian's own menu script is switched off (its entries are written by the image's script, marked as above)" "0644" "$(rootfs 'stat /etc/grub.d/10_linux' | sed -n 's/.*Mode:[[:space:]]*\([0-7]*\).*/\1/p' | head -n 1)"
  # Where GRUB and Linux are taken from: this disk, never "the first disk
  # carrying the main partition's identifier", which a USB stick made from the
  # image carries too (part 12 plugs one in).
  if mtype -i "$IMAGE@@$ESP_OFF" ::EFI/debian/grub.cfg 2>/dev/null | cmp -s - "$OA_FIRMWARE/image/files/usr/lib/open-alert-image/efi-grub.cfg"; then
    oa_ok "the small grub.cfg beside GRUB on the EFI partition is the image's own: it takes the menu from partition 3 of the disk GRUB started from, and looks for no identifier"
  else oa_fail "the EFI partition's EFI/debian/grub.cfg is not firmware/image/files/usr/lib/open-alert-image/efi-grub.cfg"; fi
  oa_has_not "… and there is no other grub.cfg in EFI/BOOT for GRUB to read first" "$LOGDIR/efi-partition-files.txt" '^::/EFI/BOOT/grub\.cfg$'
  oa_has_not "the boot menu looks for no partition by its identifier (no \"search\" line)" "$WORK/grub.cfg" '^[[:space:]]*search[[:space:]]'
  # shellcheck disable=SC2016  # $oa_main is GRUB's, not this shell's
  oa_is "… and each of its entries that loads Linux takes it from the partition the small file chose" "$(grep -Ec '^[[:space:]]*linux[[:space:]]' "$WORK/grub.cfg")" "$(grep -c 'if \[ -n "\$oa_main" \]; then set root="\$oa_main"; fi' "$WORK/grub.cfg")"
  oa_has "the kernel is told panic=30, so that a start that fails restarts the computer and offers no prompt" "$WORK/grub.cfg" '^[[:space:]]*linux[[:space:]].* panic=30( |$)'
  oa_is "first set-up is not looked for on other disks: cloud-init's search by label is switched off (fs_label: null)" "1" "$(rootfs 'cat /etc/cloud/cloud.cfg.d/90-open-alert-image.cfg' | grep -c '^    fs_label: null$' || true)"
  oa_is "the image's firewall lets in SSH and port 80 by number, and not port 8080" "tcp dport 22 accept;tcp dport 80 accept;" \
    "$(rootfs 'cat /etc/nftables.conf' | sed -n 's/^[[:space:]]*\(tcp dport .*\)$/\1/p' | tr '\n' ';')"
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
first_disk() {
  cp --sparse=always "$IMAGE" "$WORK/disk.img"
  truncate -s "$DISK_SIZE" "$WORK/disk.img"
}
first_disk
DISK_BYTES=$(stat -c %s "$WORK/disk.img")
ssh-keygen -q -t ed25519 -N '' -C 'made for one run of firmware/test/image.sh' -f "$WORK/key"
openssl req -x509 -newkey ec -pkeyopt ec_paramgen_curve:prime256v1 -nodes -days 2 \
  -subj '/CN=open-ALERT image test authority (made for one run)' -keyout "$WORK/ca.key" -out "$WORK/ca.crt" 2>/dev/null
CA_LINE=$(sed -n '2p' "$WORK/ca.crt")
for v in SSH_PORT WEB_PORT WEB2_PORT SHUT_PORT RX_PORT PROXY_PORT; do free_port "$v"; done
# An intruder's USB stick. It is the image's own CIDATA partition, copied out
# as a disk of its own (so its label, and even its identifier, are the real
# one's), with another set-up file in it: one that would give the computer a
# name, make an account that can become administrator, write a file and say
# so on the console. It is plugged in before the first start and stays in.
dd if="$IMAGE" of="$WORK/intruder.img" bs=512 skip=$((CID_OFF / 512)) count=$(( (ROOT_OFF - CID_OFF) / 512 )) status=none
cat > "$WORK/intruder-user-data" <<'INTRUDER'
#cloud-config
hostname: intruder-was-here
users:
  - name: intruder
    groups: [sudo]
    shell: /bin/bash
    sudo: "ALL=(ALL) NOPASSWD:ALL"
write_files:
  - path: /root/intruder-was-here
    content: |
      written by the set-up file on a USB stick
runcmd:
  - [sh, -c, "echo INTRUDER-MARK the set-up file on the USB stick ran as user $(id -u) > /dev/console"]
INTRUDER
printf 'instance-id: brought-on-a-usb-stick\n' > "$WORK/intruder-meta-data"
mcopy -o -i "$WORK/intruder.img" "$WORK/intruder-user-data" ::user-data
mcopy -o -i "$WORK/intruder.img" "$WORK/intruder-meta-data" ::meta-data
# shellcheck disable=SC2016  # the text is for the shell that is started, not this one
oa_check "an intruder's USB stick is made: a disk labelled CIDATA like the image's own partition, with a set-up file that would make an administrator account" \
  sh -c 'mtype -i "$1" ::user-data | grep -q "name: intruder" && mdir -i "$1" :: | grep -qi "CIDATA"' sh "$WORK/intruder.img"
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
fill_in() {
  local line
  while IFS= read -r line; do
    case "$line" in
      'hostname: '*) printf 'hostname: %s\n' "$WANT_NAME" ;;
      '      - ssh-ed25519 '*) printf '      - %s\n' "$(cat "$WORK/key.pub")" ;;
      '      -----BEGIN CERTIFICATE-----'|'      -----END CERTIFICATE-----') ;;
      '      (the lines of the certificate go here)') sed 's/^/      /' "$WORK/ca.crt" ;;
      '      HTTPS_PROXY='*) printf '      HTTPS_PROXY=%s\n' "$PROXY" ;;
      *) printf '%s\n' "$line" ;;
    esac
  done
}
fill_in < "$WORK/user-data.switched-on" > "$WORK/user-data"
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
# A stand-in for a web proxy: it writes down what is asked of it and answers
# nothing. Enough to see that the agent goes to the proxy the set-up file named.
if command -v socat >/dev/null 2>&1; then
  socat -u "TCP-LISTEN:$PROXY_PORT,bind=127.0.0.1,reuseaddr,fork" "OPEN:$WORK/proxy-asked.txt,creat,append" 2>/dev/null &
  PROXY_PID=$!
fi
FIRST_TRIES=0
prepare_first() {
  FIRST_TRIES=$((FIRST_TRIES + 1))
  if [ "$FIRST_TRIES" -gt 1 ]; then
    # A second try, after QEMU crashed: the disk as it was before the first.
    first_disk
    mcopy -o -i "$WORK/disk.img@@$CID_OFF" "$WORK/user-data" ::user-data
  fi
  cp "$FW_VARS" "$WORK/vars.fd"
  SERIAL="$WORK/serial.log"
  vm_base "$WORK/disk.img" "$WORK/vars.fd" "$SERIAL"
  # shellcheck disable=SC2054  # the commas are QEMU's own notation, inside one argument
  QEMU_ARGS=("${VM_ARGS[@]}" -m 2048 -smp 4 -pidfile "$WORK/qemu.pid"
  # The network: this computer's ports are passed on to the machine's SSH (22),
  # dashboard (80), and two ports the firewall should keep shut (8080, 9999). The
  # machine may call out (it is not "restrict=on"): the check of Debian's
  # archive needs that. Its agent is given a stand-in proxy by the set-up
  # file, has no Flood-Net token, and so sends Flood-Net nothing.
  -netdev "user,id=net0,hostfwd=tcp:127.0.0.1:$SSH_PORT-:22,hostfwd=tcp:127.0.0.1:$WEB_PORT-:80,hostfwd=tcp:127.0.0.1:$WEB2_PORT-:8080,hostfwd=tcp:127.0.0.1:$SHUT_PORT-:9999"
  -device "$NIC,netdev=net0"
  -object rng-random,filename=/dev/urandom,id=rng0 -device virtio-rng-pci,rng=rng0
  # An emulated USB serial adapter (QEMU's is an FTDI one); what is written to
  # the TCP port on this side comes out of it on the other.
  -device qemu-xhci,id=usb -chardev "socket,id=receiver,host=127.0.0.1,port=$RX_PORT,server=on,wait=off" -device usb-serial,chardev=receiver,bus=usb.0
  # The intruder's stick, in a USB port.
  -drive "if=none,id=intruder,format=raw,file=$WORK/intruder.img" -device usb-storage,drive=intruder,bus=usb.0)
}
if [ "$KVM" = 1 ]; then oa_note "this computer lends its own processor to the virtual machine (KVM)"
else oa_note "no KVM here: QEMU emulates the processor in software, which is many times slower than a real one"; fi
oa_note "$("$QEMU" --version | head -n 1); firmware $FW_CODE with $(basename "$FW_VARS")"
if [ -n "$SB_NOTE" ]; then oa_skip "starting with Secure Boot on — $SB_NOTE. On a real computer: \"mokutil --sb-state\" says whether it is on"; fi
# The receiver's lines, sent again and again for as long as the checks run:
# the first lines of a Quansheng ALERT radio as RPi ALERT's scripts/simulate.sh
# sends them (its header, a status line, a decoded reading). "MegaNet:" in the
# status line is the name the radio's firmware gives its station table. It
# keeps trying to reach the adapter's port, so it does not matter when QEMU
# starts, or starts again.
feed_receiver() {
  local k=0
  trap '' PIPE
  while :; do
    if exec 9<>"/dev/tcp/127.0.0.1/$RX_PORT"; then
      while printf 'HDR,fw,4d06107f,schema,2\r\n' >&9 &&
            printf 'STA,,%d,-121,-124,0,7890,78,%d,%d,-104,OK,1045,5969,BUILTIN MegaNet:95f6f8d\r\n' $((k * 10000)) "$k" "$k" >&9 &&
            printf 'DEC,%d,,%d,12,6129,LOUDOUN BR,LVL,%d,%d,,ABF,NEG,0,0,-%d,-121,-109,40,412,16067B23,0\r\n' "$k" $((k * 10000)) $((1590 + k)) $((1590 + k)) $((60 + k % 20)) >&9; do
        k=$((k + 1)); sleep 3
      done
      exec 9>&- || true
    fi
    sleep 3
  done
}
feed_receiver 2>/dev/null &
FEED_PID=$!

rc=0; start_and_wait prepare_first "$LOGDIR/qemu-output.txt" || rc=$?
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
if grep -aq "open-alert-image: the first set-up files were taken from this disk's own CIDATA partition" "$WORK/serial.log"; then
  oa_ok "the console says where first set-up was read: \"$(grep -a -m1 -o "the first set-up files were taken from this disk's own CIDATA partition ([^)]*)" "$WORK/serial.log")\""
else oa_fail "the console has no line saying the first set-up files were read from the disk's own partition"; fi
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
# The part above left a little server on ports 8080 and 9999 that says "open",
# and that answered on the computer itself. Ports 22 and 80, which are on the
# firewall's list, have been reached from here already (SSH and the dashboard).
oa_is "port 8080 is not on the image's firewall list: what another computer sends to it is thrown away (no answer from the little server)" "" "$(port_says "$WEB2_PORT")"
oa_is "… nor is any other port nobody opened on purpose (9999: no answer)" "" "$(port_says "$SHUT_PORT")"
vm_ssh 'sudo pkill -f oa-little-server' > /dev/null 2>&1 || true
if grep -aq 'INTRUDER-MARK' "$WORK/serial.log"; then oa_fail "the console shows a line written by the intruder's set-up file: it was run"
else oa_ok "nothing on the console came from the intruder's stick"; fi
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
  if [ "$got" = 000 ]; then oa_ok "another computer asking for the dashboard on port 8080 gets nothing (the image's firewall does not let the port in, and the profile's lock refuses it)"
  else oa_fail "another computer got HTTP $got from the dashboard on port 8080"; fi
  got=$(http_code "http://127.0.0.1:$WEB_PORT/")
  if [ "$got" = 000 ]; then oa_ok "… and nothing answers on port 80 any more"; else oa_fail "something still answers on port 80: HTTP $got"; fi

  oa_section "7. Restart the computer"
  FROM=$(stat -c %s "$WORK/serial.log")
  STARTED=$(date +%s)
  vm_ssh sudo systemctl reboot >/dev/null 2>&1 || true
  rc=0; wait_serial "$TIMEOUT" 'login:' "$FROM" || rc=$?
  if [ "$rc" = 0 ]; then oa_ok "it came back: a login prompt on the serial console $(( $(date +%s) - STARTED )) seconds after the restart was asked for (shutting down included; Debian's own boot-loader installer has rewritten the boot files since the first start)"
  elif [ "$rc" = 2 ] && emulator_crashed "$QEMU_PID"; then oa_fail "QEMU itself crashed during the restart (it was ended by signal $((EMULATOR_STATUS - 128))): a fault in the emulator, and this part cannot be started again by itself. Run the check again — see $LOGDIR/serial-console.txt"
  else oa_fail "no login prompt after the restart — see $LOGDIR/serial-console.txt"; fi
  # StrictHostKeyChecking is on from the first login: a changed host key would refuse this.
  if oa_wait 300 vm_ssh true; then oa_ok "SSH gets in again, and the computer shows the same host key as before"
  else oa_fail "SSH does not get in after the restart: $(vm_ssh true 2>&1 | tail -n 1)"; fi
  in_vm "$LOGDIR/inside-after-restart.log" after-restart "$( [ "$SECURE_BOOT" = 1 ] && echo yes || echo no )"
  got=$(http_code "http://127.0.0.1:$WEB2_PORT/")
  if [ "$got" = 000 ]; then oa_ok "from outside, after the restart: the dashboard still answers this computer only"
  else oa_fail "after the restart another computer got HTTP $got from the dashboard"; fi
  if grep -aq 'INTRUDER-MARK' "$WORK/serial.log"; then oa_fail "after the restart the console shows a line written by the intruder's set-up file: it was run"
  else oa_ok "the intruder's stick was in its USB port through the restart as well, and nothing on the console came from it"; fi
fi

# What the checks inside kept (the audit print-outs, the agent's log, …).
mkdir -p "$LOGDIR/from-inside"
vm_ssh sudo bash oa-image-test/image.sh --inside logs 2>/dev/null | tar -C "$LOGDIR/from-inside" -xf - 2>/dev/null || true
oa_section "Shut it down"
vm_ssh sudo systemctl poweroff >/dev/null 2>&1 || true
if oa_wait 180 sh -c "! kill -0 $QEMU_PID 2>/dev/null"; then oa_ok "it shut down cleanly when asked"
else oa_fail "it did not shut down within three minutes"; kill "$QEMU_PID" 2>/dev/null || true; sleep 2; fi
QEMU_PID=''
kill "$FEED_PID" 2>/dev/null || true; FEED_PID=''

# ═════════════════════════════════════════════════════════════════════════════
# 8. A fresh copy exactly as it is flashed: nothing switched on
# ═════════════════════════════════════════════════════════════════════════════
# What a person gets who flashes the image and starts it without opening
# user-data. Nobody can log in, so everything is checked from outside.
if [ "$DO_SECOND" = 1 ]; then
  oa_section "8. A fresh copy exactly as it is flashed: nothing switched on in user-data"
  for v in SSH0_PORT U80_PORT; do free_port "$v"; done
  prepare_untouched() {
    cp --sparse=always "$IMAGE" "$WORK/disk0.img"
    truncate -s "$DISK_SIZE" "$WORK/disk0.img"
    cp "$FW_VARS" "$WORK/vars0.fd"
    SERIAL="$WORK/serial0.log"
    vm_base "$WORK/disk0.img" "$WORK/vars0.fd" "$SERIAL"
    # "restrict=on": this copy can reach nothing outside itself, and is
    # reached only through the two ports passed on to it. It has no proxy
    # set, and a test should not call the real Flood-Net.
    # shellcheck disable=SC2054  # the commas are QEMU's own notation, inside one argument
    QEMU_ARGS=("${VM_ARGS[@]}" -m 2048 -smp 4
      -netdev "user,id=net0,restrict=on,hostfwd=tcp:127.0.0.1:$SSH0_PORT-:22,hostfwd=tcp:127.0.0.1:$U80_PORT-:80"
      -device "$NIC,netdev=net0" -object rng-random,filename=/dev/urandom,id=rng0 -device virtio-rng-pci,rng=rng0)
  }
  rc=0; start_and_wait prepare_untouched "$LOGDIR/qemu-output-untouched-copy.txt" || rc=$?
  if [ "$rc" = 0 ]; then
    oa_ok "it started: a login prompt on the serial console after $(( $(date +%s) - STARTED )) seconds"
    # The first set-up runs on after the prompt: wait for its last line on the console.
    if wait_serial 300 'Cloud-init v.* finished at'; then
      oa_ok "the first set-up ran to its end with nothing to set up, reading the disk's own CIDATA partition: $(grep -a 'Cloud-init v.* finished at' "$SERIAL" | tail -n 1 | tr -d '\r' | sed 's/^.*Cloud-init/Cloud-init/' | cut -c1-140)"
    else
      oa_fail "the console has no line saying the first set-up finished — see $LOGDIR/serial-console-untouched-copy.txt"
    fi
    N=$(grep -ac '\[FAILED\]' "$SERIAL" || true)
    oa_is "nothing on the console is marked FAILED" "0" "$N"
    if oa_wait 180 sh -c "[ \"\$(curl -s -o /dev/null -m 10 -w '%{http_code}' http://127.0.0.1:$U80_PORT/)\" = 200 ]"; then oa_ok "the dashboard answers another computer on port 80"
    else oa_fail "the dashboard does not answer: HTTP $(http_code "http://127.0.0.1:$U80_PORT/")"; fi
    oa_is "the agent behind it is the pinned version" "$AGENT_VERSION" "$(curl -s -m 20 "http://127.0.0.1:$U80_PORT/api/status" | jq -r .version 2>/dev/null)"
    for who in admin root debian; do
      got=$(ssh -i "$WORK/key" -p "$SSH0_PORT" -o BatchMode=yes -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new \
        -o "UserKnownHostsFile=$WORK/known_hosts0" -o ConnectTimeout=30 -o LogLevel=ERROR "$who@127.0.0.1" true 2>&1 || true)
      case "$got" in
        *"Permission denied (publickey)."*) oa_ok "nobody can log in: SSH answers, offers keys only, and turns \"$who\" away" ;;
        *) oa_fail "SSH as \"$who\" on the untouched copy: ${got:-it got in}" ;;
      esac
    done
    if [ -s "$WORK/known_hosts" ] && [ -s "$WORK/known_hosts0" ]; then
      if [ "$(host_key "$WORK/known_hosts")" != "$(host_key "$WORK/known_hosts0")" ]; then oa_ok "this copy made an SSH host key of its own: it is not the first copy's"
      else oa_fail "two copies of the image show the same SSH host key"; fi
    fi
  else
    oa_fail "the untouched copy gave no login prompt on the serial console — see $LOGDIR/serial-console-untouched-copy.txt"
  fi
  # Nobody can log in to shut it down: it is switched off.
  if [ -n "$QEMU_PID" ]; then kill "$QEMU_PID" 2>/dev/null || true; wait "$QEMU_PID" 2>/dev/null || true; fi
  QEMU_PID=''
else
  oa_skip "a fresh copy with nothing switched on in user-data — left out (--no-more-copies)"
fi

# ═════════════════════════════════════════════════════════════════════════════
# 9. Another fresh copy: the enterprise profile chosen in user-data
# ═════════════════════════════════════════════════════════════════════════════
# What an organisation would do: flash, switch on an account and the line
# that chooses the enterprise profile, start. Nothing else is switched on, and
# nobody logs in until the first start has finished by itself.
if [ "$DO_SECOND" = 1 ]; then
  oa_section "9. Another fresh copy: only an account and the enterprise profile switched on in user-data"
  sed -e '/^#users:/,/^#      - ssh-ed25519 /s/^#//' \
      -e '/^#runcmd:/s/^#//' \
      -e '/^#  - \[open-alert-base, profile, enterprise\]/s/^#//' \
      "$OA_FIRMWARE/image/cidata/user-data" | fill_in > "$WORK/user-data2"
  cp "$WORK/user-data2" "$LOGDIR/user-data-used-enterprise-copy.txt"
  SEED_OK=1
  for want in 'users:' '  - name: admin' 'runcmd:' '  - [open-alert-base, profile, enterprise]'; do
    grep -qxF -- "$want" "$WORK/user-data2" || { SEED_OK=0; oa_fail "this copy's set-up file lacks the line \"$want\""; }
  done
  oa_is "its user-data switches on an account, the enterprise profile and nothing else (lines that are not comments)" "11" "$(grep -c -v '^#\|^$' "$WORK/user-data2")"
  for v in SSH2_PORT E80_PORT E8080_PORT; do free_port "$v"; done
  prepare_enterprise() {
    cp --sparse=always "$IMAGE" "$WORK/disk2.img"
    truncate -s "$DISK_SIZE" "$WORK/disk2.img"
    mcopy -o -i "$WORK/disk2.img@@$CID_OFF" "$WORK/user-data2" ::user-data
    cp "$FW_VARS" "$WORK/vars2.fd"
    SERIAL="$WORK/serial2.log"
    vm_base "$WORK/disk2.img" "$WORK/vars2.fd" "$SERIAL"
    # "restrict=on", as for the copy before: nothing outside itself.
    # shellcheck disable=SC2054  # the commas are QEMU's own notation, inside one argument
    QEMU_ARGS=("${VM_ARGS[@]}" -m 2048 -smp 4
      -netdev "user,id=net0,restrict=on,hostfwd=tcp:127.0.0.1:$SSH2_PORT-:22,hostfwd=tcp:127.0.0.1:$E80_PORT-:80,hostfwd=tcp:127.0.0.1:$E8080_PORT-:8080"
      -device "$NIC,netdev=net0" -object rng-random,filename=/dev/urandom,id=rng0 -device virtio-rng-pci,rng=rng0)
  }
  rc=0; start_and_wait prepare_enterprise "$LOGDIR/qemu-output-enterprise-copy.txt" || rc=$?
  if [ "$rc" = 0 ]; then
    oa_ok "it started: a login prompt on the serial console after $(( $(date +%s) - STARTED )) seconds"
    SSH_OPTS=(-i "$WORK/key" -p "$SSH2_PORT" -o BatchMode=yes -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new
      -o "UserKnownHostsFile=$WORK/known_hosts2" -o ConnectTimeout=30 -o ServerAliveInterval=20 -o LogLevel=ERROR)
    if oa_wait 300 vm_ssh true; then
      oa_ok "SSH takes the key"
      if [ -s "$WORK/known_hosts" ] && [ -s "$WORK/known_hosts2" ]; then
        if [ "$(host_key "$WORK/known_hosts")" != "$(host_key "$WORK/known_hosts2")" ]; then oa_ok "this copy made an SSH host key of its own: it is not the first copy's"
        else oa_fail "two copies of the image show the same SSH host key"; fi
      fi
      vm_ssh 'mkdir -p oa-image-test && cat > oa-image-test/lib.sh' < "$HERE/lib.sh"
      vm_ssh 'cat > oa-image-test/image.sh' < "$HERE/image.sh"
      in_vm "$LOGDIR/inside-enterprise-copy.log" enterprise-first
      oa_section "From outside: this copy answers the computer itself only"
      got=$(http_code "http://127.0.0.1:$E8080_PORT/")
      if [ "$got" = 000 ]; then oa_ok "another computer asking for the dashboard on port 8080 gets nothing"
      else oa_fail "another computer got HTTP $got from the dashboard on port 8080"; fi
      got=$(http_code "http://127.0.0.1:$E80_PORT/")
      if [ "$got" = 000 ]; then oa_ok "… and nothing answers on port 80"; else oa_fail "something answers on port 80: HTTP $got"; fi
      mkdir -p "$LOGDIR/from-inside"
      vm_ssh sudo bash oa-image-test/image.sh --inside logs 2>/dev/null | tar -C "$LOGDIR/from-inside" -xf - 2>/dev/null || true
    else
      oa_fail "SSH with the key does not get in to this copy: $(vm_ssh true 2>&1 | tail -n 1)"
    fi
    vm_ssh sudo systemctl poweroff >/dev/null 2>&1 || true
    oa_wait 180 sh -c "! kill -0 $QEMU_PID 2>/dev/null" || oa_note "this copy did not shut down within three minutes; it is stopped"
  else
    oa_fail "this copy gave no login prompt on the serial console — see $LOGDIR/serial-console-enterprise-copy.txt"
  fi
  if [ -n "$QEMU_PID" ]; then kill "$QEMU_PID" 2>/dev/null || true; fi
  QEMU_PID=''
else
  oa_skip "a fresh copy with the enterprise profile chosen in user-data — left out (--no-more-copies)"
fi

# ═════════════════════════════════════════════════════════════════════════════
# 10. Secure Boot refuses a boot file that has been changed
# ═════════════════════════════════════════════════════════════════════════════
if [ "$SECURE_BOOT" = 1 ]; then
  oa_section "10. With Secure Boot on, a boot file changed by one bit is refused"
  if refused_start changed-shim 'Access Denied' "EFI/BOOT/BOOT$EFI_UPPER.EFI" "EFI/debian/shim$EFI.efi"; then
    oa_ok "one bit changed in shim: the firmware does not start it (\"Access Denied\"), and no kernel starts"
  else oa_fail "a changed shim was not plainly refused — see $LOGDIR/serial-console-changed-shim.txt"; fi
  if refused_start changed-grub 'Security Violation' "EFI/BOOT/grub$EFI.efi" "EFI/debian/grub$EFI.efi"; then
    oa_ok "one bit changed in GRUB: shim does not start it (\"Verification failed: (0x1A) Security Violation\"), and no kernel starts"
  else oa_fail "a changed GRUB was not plainly refused — see $LOGDIR/serial-console-changed-grub.txt"; fi
fi

# ═════════════════════════════════════════════════════════════════════════════
# 11. The boot menu, tried over the serial port
# ═════════════════════════════════════════════════════════════════════════════
# What a person with a serial cable (or the keyboard) can do in the three
# seconds the menu shows: nothing but start the entry as it is written. Keys
# are typed into the machine's serial port, and what it shows is read back.
if [ "$DO_SECOND" = 1 ]; then
  oa_section "11. The boot menu with the serial port in hand: its editor and GRUB's command line are closed"
  MENU_PORT=0; free_port MENU_PORT
  MENU_OUT="$WORK/menu.serial"
  menu_seen() { LC_ALL=C grep -aq -- "$1" "$MENU_OUT" 2>/dev/null; }
  # menu_wait PATTERN SECONDS [from-byte]
  menu_wait() {
    local left=$(( $2 * 5 )) from=${3:-0}
    while [ "$left" -gt 0 ]; do
      if tail -c "+$((from + 1))" "$MENU_OUT" 2>/dev/null | LC_ALL=C grep -aq -- "$1"; then return 0; fi
      if ! kill -0 "$MENU_PID" 2>/dev/null; then return 2; fi
      sleep 0.2; left=$((left - 1))
    done
    return 1
  }
  menu_stop() {
    exec 7>&- 7<&- 2>/dev/null || true
    if [ -n "$MENU_CAT" ]; then kill "$MENU_CAT" 2>/dev/null || true; fi
    if [ -n "$MENU_PID" ]; then kill "$MENU_PID" 2>/dev/null || true; wait "$MENU_PID" 2>/dev/null || true; fi
    MENU_PID=''; MENU_CAT=''
  }
  MENU_OK=0
  for try in 1 2; do
    cp --sparse=always "$IMAGE" "$WORK/disk-menu.img"
    cp "$FW_VARS" "$WORK/vars-menu.fd"
    : > "$MENU_OUT"
    vm_base "$WORK/disk-menu.img" "$WORK/vars-menu.fd" "$WORK/unused.serial"
    # The same machine, with its serial port on a TCP port of this computer
    # instead of in a file, and no network.
    MENU_ARGS=()
    skip_next=0
    for a in "${VM_ARGS[@]}"; do
      if [ "$skip_next" = 1 ]; then skip_next=0; continue; fi
      if [ "$a" = -serial ]; then skip_next=1; continue; fi
      MENU_ARGS+=("$a")
    done
    "$QEMU" "${MENU_ARGS[@]}" -serial "tcp:127.0.0.1:$MENU_PORT,server=on,wait=off" -m 1536 -smp 2 -net none > "$LOGDIR/qemu-output-menu.txt" 2>&1 &
    MENU_PID=$!
    connected=0
    for _ in $(seq 1 100); do
      if exec 7<>"/dev/tcp/127.0.0.1/$MENU_PORT"; then connected=1; break; fi
      sleep 0.2
    done 2>/dev/null
    if [ "$connected" != 1 ]; then menu_stop; continue; fi
    cat <&7 > "$MENU_OUT" 2>/dev/null &
    MENU_CAT=$!
    rc=0; menu_wait 'GNU GRUB' "$((TIMEOUT / 2))" || rc=$?
    if [ "$rc" = 0 ]; then MENU_OK=1; break; fi
    if [ "$rc" = 2 ] && [ "$try" = 1 ] && emulator_crashed "$MENU_PID"; then
      oa_note "QEMU itself crashed during this start (it was ended by signal $((EMULATOR_STATUS - 128))): a fault in the emulator. The copy is made afresh and started once more"
      MENU_PID=''; menu_stop; continue
    fi
    break
  done
  if [ "$MENU_OK" = 1 ]; then
    oa_ok "the boot menu shows on the serial port, as it does to a person with a serial cable"
    # "c": GRUB's command line.
    printf 'c' >&7
    if menu_wait 'Enter username' 20; then oa_ok "\"c\", for GRUB's command line: it asks for a user name"
    else oa_fail "\"c\" at the boot menu did not ask for a user name — see $LOGDIR/serial-console-menu.txt"; fi
    printf 'root\r' >&7
    menu_wait 'Enter password' 20 || true
    FROM=$(stat -c %s "$MENU_OUT"); printf 'password\r' >&7
    if menu_wait 'access denied' 20 "$FROM"; then oa_ok "… and turns away a name and a password (\"access denied\"): there is none that works"
    else oa_fail "a name and a password typed at GRUB's prompt were not turned away with \"access denied\""; fi
    sleep 2
    # "e": the editor for the entry. (GRUB is back at its menu; the countdown has stopped.)
    FROM=$(stat -c %s "$MENU_OUT"); printf 'e' >&7
    if menu_wait 'Enter username' 20 "$FROM"; then oa_ok "\"e\", to change how Linux is started: it asks for a user name too"
    else oa_fail "\"e\" at the boot menu did not ask for a user name"; fi
    printf '\r' >&7; sleep 1; printf '\r' >&7; sleep 2
    if menu_seen 'grub> '; then oa_fail "a \"grub>\" prompt was shown: GRUB's command line was reached"
    else oa_ok "no \"grub>\" prompt was shown at any point: GRUB's command line was never reached"; fi
    # Enter on the entry itself: it must still start, as it is written.
    printf '\r' >&7
    if menu_wait 'Linux version' "$((TIMEOUT / 2))"; then oa_ok "Enter on the menu's own entry still starts Linux, with no name and no password asked (the entry is \"--unrestricted\")"
    else oa_fail "after all that, Enter on the menu's entry did not start Linux"; fi
    if menu_wait 'Kernel command line:' 30 && ! menu_seen 'Kernel command line:.*init=' && menu_seen 'Kernel command line:.*root=UUID='; then
      oa_ok "… and the kernel's start-up line is the image's own: nothing typed at the menu reached it"
    else oa_fail "the kernel's start-up line on the console is not the image's own — see $LOGDIR/serial-console-menu.txt"; fi
  else
    oa_fail "the boot menu never showed on the serial port — see $LOGDIR/serial-console-menu.txt and qemu-output-menu.txt"
  fi
  menu_stop
  tr -d '\r' < "$MENU_OUT" 2>/dev/null | sed 's/\x1b\[[0-9;?]*[a-zA-Z]/ /g' | LC_ALL=C tr -cd '[:print:]\n' | tr -s ' ' > "$LOGDIR/serial-console-menu.txt" || true
else
  oa_skip "the boot menu tried over the serial port — left out (--no-more-copies)"
fi

# ═════════════════════════════════════════════════════════════════════════════
# 12. A USB stick made from the image itself, with a boot menu of its own
# ═════════════════════════════════════════════════════════════════════════════
# A worse stick than the one of part 2: a whole copy of the image, so that its
# main partition carries the very identifier the computer's own does. Its EFI
# partition is emptied, so the firmware cannot start from the stick itself (as
# on a computer set to start from its own disk only), and its boot menu is
# replaced by one with no owner, which says so on the console and adds a word
# of its own to the kernel's start-up line. The computer's own GRUB must not
# take that menu, and Linux must not start from the stick: either the start-up
# file system sees two disks carrying the main partition and refuses to go on
# (and restarts the computer, with no prompt), or the stick shows up only
# after the computer's own disk is mounted and it starts from its own disk.
if [ "$DO_SECOND" = 1 ] && command -v debugfs >/dev/null 2>&1; then
  oa_section "12. A USB stick made from the image itself, with a boot menu of its own, plugged in at a start"
  ROOT_UUID=$(debugfs -R 'stats' "$IMAGE?offset=$ROOT_OFF" 2>/dev/null | sed -n 's/^Filesystem UUID:[[:space:]]*//p')
  cp --sparse=always "$IMAGE" "$WORK/clone.img"
  if ! fallocate --punch-hole --offset "$ESP_OFF" --length "$((CID_OFF - ESP_OFF))" "$WORK/clone.img" 2>/dev/null; then
    dd if=/dev/zero of="$WORK/clone.img" bs=512 seek=$((ESP_OFF / 512)) count=$(( (CID_OFF - ESP_OFF) / 512 )) conv=notrunc status=none
  fi
  # Its boot menu: the image's own, with no owner, entries that need none,
  # Linux taken from wherever GRUB found this menu, and two marks of its own.
  { echo 'echo "OA-STICK-MENU: this boot menu came from the USB stick"'
    sed -e '/^set superusers=/d' -e '/^export superusers$/d' -e 's/ --unrestricted {$/ {/' -e '/oa_main/d' \
        -e 's/^\([[:space:]]*linux[[:space:]].*\)$/\1 oa_from_the_stick=1/' "$WORK/grub.cfg"; } > "$WORK/stick-grub.cfg"
  printf 'cd /boot/grub\nrm grub.cfg\nwrite %s grub.cfg\n' "$WORK/stick-grub.cfg" > "$WORK/stick-debugfs.txt"
  debugfs -w -f "$WORK/stick-debugfs.txt" "$WORK/clone.img?offset=$ROOT_OFF" > "$WORK/stick-debugfs-out.txt" 2>&1 || true
  if [ -n "$ROOT_UUID" ] && ! mdir -i "$WORK/clone.img@@$ESP_OFF" :: > /dev/null 2>&1 \
     && debugfs -R 'cat /boot/grub/grub.cfg' "$WORK/clone.img?offset=$ROOT_OFF" 2>/dev/null | grep -q 'OA-STICK-MENU' \
     && [ "$(debugfs -R 'stats' "$WORK/clone.img?offset=$ROOT_OFF" 2>/dev/null | sed -n 's/^Filesystem UUID:[[:space:]]*//p')" = "$ROOT_UUID" ]; then
    oa_ok "the stick is made: a whole copy of the image (its main partition carries the same identifier, $ROOT_UUID), its EFI partition emptied, and a boot menu of its own with no owner that adds \"oa_from_the_stick=1\" to the kernel's start-up line"
    STICK_SERIAL="$WORK/stick.serial"
    STICK_RESULT=''
    for try in 1 2; do
      cp --sparse=always "$IMAGE" "$WORK/disk-stick.img"
      cp "$FW_VARS" "$WORK/vars-stick.fd"
      : > "$STICK_SERIAL"
      vm_base "$WORK/disk-stick.img" "$WORK/vars-stick.fd" "$STICK_SERIAL"
      # shellcheck disable=SC2054  # the commas are QEMU's own notation, inside one argument
      "$QEMU" "${VM_ARGS[@]}" -m 1536 -smp 2 -net none \
        -device qemu-xhci,id=usb -drive "if=none,id=clone,format=raw,file=$WORK/clone.img" -device usb-storage,drive=clone,bus=usb.0,removable=on \
        > "$LOGDIR/qemu-output-stick-copy.txt" 2>&1 &
      QEMU_PID=$!
      left=$TIMEOUT
      while [ "$left" -gt 0 ] && kill -0 "$QEMU_PID" 2>/dev/null; do
        if grep -aq 'NOT STARTING\|login:\|(initramfs)\|OA-STICK-MENU' "$STICK_SERIAL"; then break; fi
        sleep 2; left=$((left - 2))
      done
      if [ "$try" = 1 ] && ! kill -0 "$QEMU_PID" 2>/dev/null && emulator_crashed "$QEMU_PID"; then
        oa_note "QEMU itself crashed during this start (it was ended by signal $((EMULATOR_STATUS - 128))): a fault in the emulator. It is started once more"
        QEMU_PID=''; continue
      fi
      break
    done
    if grep -aq 'NOT STARTING' "$STICK_SERIAL"; then
      STICK_RESULT=refused
      # It restarts by itself 30 seconds later; wait for the next start to begin.
      left=$((TIMEOUT / 2))
      while [ "$left" -gt 0 ] && kill -0 "$QEMU_PID" 2>/dev/null; do
        if [ "$(grep -ac 'Linux version' "$STICK_SERIAL" || true)" -ge 2 ]; then break; fi
        sleep 2; left=$((left - 2))
      done
    elif grep -aq 'login:' "$STICK_SERIAL"; then STICK_RESULT=started
    fi
    sleep 3
    if [ -n "$QEMU_PID" ]; then kill "$QEMU_PID" 2>/dev/null || true; wait "$QEMU_PID" 2>/dev/null || true; fi
    QEMU_PID=''
    tr -d '\r' < "$STICK_SERIAL" 2>/dev/null | sed 's/\x1b\[[0-9;?]*[a-zA-Z]/ /g' | LC_ALL=C tr -cd '[:print:]\n' | tr -s ' ' > "$LOGDIR/serial-console-stick-copy.txt" || true
    if grep -aq 'OA-STICK-MENU' "$STICK_SERIAL"; then oa_fail "the computer's GRUB took the boot menu from the USB stick — see $LOGDIR/serial-console-stick-copy.txt"
    else oa_ok "the computer's own GRUB did not take the stick's boot menu (nothing it says came on the console)"; fi
    got=$(grep -a -m1 -o 'Kernel command line:[^\r]*' "$STICK_SERIAL" || true)
    if [ -n "$got" ] && ! printf '%s' "$got" | grep -q 'oa_from_the_stick'; then oa_ok "… and Linux was started with the computer's own start-up line: $(printf '%s' "$got" | cut -c1-150)"
    else oa_fail "the kernel's start-up line is missing or is the stick's: \"$got\""; fi
    # Which disk the stick is, as the kernel names it.
    stick_dev=$(grep -a -o '\[sd[a-z]*\] Attached SCSI removable disk' "$STICK_SERIAL" | head -n 1 | sed 's/^\[\(sd[a-z]*\)\].*/\1/')
    mounted=$(grep -a -o "EXT4-fs ([a-z0-9]*): mounted filesystem $ROOT_UUID" "$STICK_SERIAL" | head -n 1 | sed 's/^EXT4-fs (\([a-z0-9]*\)).*/\1/')
    oa_note "the kernel named the stick ${stick_dev:-(not seen)}; the main partition was mounted from ${mounted:-(nothing)}"
    if [ -n "$mounted" ] && [ -n "$stick_dev" ]; then
      if [ "${mounted#"$stick_dev"}" = "$mounted" ]; then oa_ok "the partition the start-up file system checked and mounted was the computer's own ($mounted), not the stick's: the names for the identifier stayed on the disk that is not on USB"
      else oa_fail "the start-up file system checked and mounted the stick's partition ($mounted)"; fi
    fi
    case "$STICK_RESULT" in
      refused)
        oa_ok "the start-up file system saw two disks carrying the main partition and did not go on: \"$(grep -a -m1 -o 'NOT STARTING[^:]*' "$STICK_SERIAL")\""
        if grep -aq 'Rebooting automatically due to panic= boot argument' "$STICK_SERIAL"; then oa_ok "… it offered no prompt and restarted the computer by itself (\"Rebooting automatically due to panic= boot argument\")"
        else oa_fail "after refusing, it did not say it was restarting the computer"; fi
        if [ "$(grep -ac 'Linux version' "$STICK_SERIAL" || true)" -ge 2 ]; then oa_ok "… and the computer did start again, about 30 seconds later (it does so for as long as the stick stays in)"
        else oa_fail "the computer did not start again after refusing"; fi ;;
      started)
        if [ -n "$mounted" ] && [ -n "$stick_dev" ] && [ "${mounted#"$stick_dev"}" = "$mounted" ]; then
          oa_ok "the stick showed up only after the computer's own disk was mounted, and Linux started from the computer's own disk ($mounted, not the stick's $stick_dev)"
        else oa_fail "Linux started, from ${mounted:-an unknown partition}, with the stick (${stick_dev:-not seen}) plugged in"; fi ;;
      *) oa_fail "neither a refusal nor a login prompt in time — see $LOGDIR/serial-console-stick-copy.txt" ;;
    esac
    if grep -aq '(initramfs)' "$STICK_SERIAL"; then oa_fail "the start-up file system offered its prompt on the console — see $LOGDIR/serial-console-stick-copy.txt"
    else oa_ok "the start-up file system offered no prompt on the console"; fi
  else
    oa_fail "the stick could not be made (identifier \"$ROOT_UUID\"; see $WORK/stick-debugfs-out.txt)"
    sed 's/^/        /' "$WORK/stick-debugfs-out.txt" 2>/dev/null | tail -n 5 || true
  fi
  rm -f "$WORK/clone.img" "$WORK/disk-stick.img"
elif [ "$DO_SECOND" = 1 ]; then
  oa_skip "a stick made from the image — debugfs (the package e2fsprogs) is needed to give the stick a boot menu of its own"
else
  oa_skip "a stick made from the image, plugged in at a start — left out (--no-more-copies)"
fi

oa_note "logs: $LOGDIR (the serial console, the set-up file used, the audit print-outs, the agent's log)"
oa_summary
