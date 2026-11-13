#!/bin/bash
# What the computer that runs the container needs, once (the container cannot
# do these itself, and should not be allowed to):
#   1. A device rule (udev) so that a radio stick plugged in gets a device file
#      the container's user can open: the group "plugdev", mode 0660.
#   2. A block on the kernel's TV-tuner driver, which would otherwise grab the
#      stick when it is plugged in, so that the program cannot open it
#      ("usb_claim_interface error -6").
# It is the same rule and the same block list the native package installs.
#
#   sudo ./host-setup.sh                 set up (run it again any time: nothing is repeated)
#   sudo ./host-setup.sh --remove        take both away again (the group is left alone)
#   ./host-setup.sh --check              say what is in place, change nothing
#
# Options
#   --group NAME   the group that owns the stick's device files (default: plugdev)
#   --gid N        the number to give that group if this script has to make it
#                  (default: whatever the computer picks; Debian and Ubuntu already
#                  have plugdev as 46). The container's user is put in the group by
#                  its number: OA_USB_GID in compose.yaml. The number is printed at the end.
#   --root DIR     write the two files under DIR instead of / and do nothing else
#                  (no group, no udev, no driver unloading): for checking this script
#   -h, --help     this text
#
# After setting up, unplug and replug the stick (or restart the computer) so the
# rule is applied to it. Nothing here has been run beside a real stick: see
# firmware/README.md, "The container".
set -euo pipefail

GROUP=plugdev; GID_WANTED=''; ROOT=''; ACTION=setup
while [ $# -gt 0 ]; do
  case "$1" in
    --remove) ACTION=remove; shift ;;
    --check) ACTION=check; shift ;;
    --group) GROUP="${2:?--group needs a name}"; shift 2 ;;
    --gid) GID_WANTED="${2:?--gid needs a number}"; shift 2 ;;
    --root) ROOT="${2:?--root needs a folder}"; shift 2 ;;
    -h|--help) sed -n '2,/^set -euo/p' "${BASH_SOURCE[0]}" | sed '$d' | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) printf 'host-setup: unknown option %s (try --help)\n' "$1" >&2; exit 2 ;;
  esac
done
case "$GROUP" in ''|*[!a-z0-9_-]*|-*) printf 'host-setup: "%s" is not a usable group name\n' "$GROUP" >&2; exit 2 ;; esac
case "$GID_WANTED" in *[!0-9]*) printf 'host-setup: --gid wants a number\n' >&2; exit 2 ;; esac

RULE="$ROOT/etc/udev/rules.d/60-open-alert-base.rules"
BLOCK="$ROOT/etc/modprobe.d/open-alert-base-blacklist-dvb.conf"

if [ -z "$ROOT" ] && [ "$ACTION" != check ] && [ "$(id -u)" != 0 ]; then
  printf 'host-setup: this changes the computer'"'"'s own files, so it needs the administrator account: sudo %s\n' "$0" >&2; exit 1
fi

# ── the two files ────────────────────────────────────────────────────────────
write_rule() {
  cat <<RULES
# open-ALERT base station, container host: receivers the container's user must be able to open.
# The device ids are the ones in RPi ALERT's own rule file (os/files/udev/60-rpi-alert.rules).
# Written by firmware/container/host-setup.sh; the same rule the native package installs.

# RTL2832U sticks (RTL-SDR Blog V2/V3/V4 and generic): the one group only.
SUBSYSTEM=="usb", ATTRS{idVendor}=="0bda", ATTRS{idProduct}=="2832", MODE="0660", GROUP="$GROUP", ENV{ID_SOFTWARE_RADIO}="1"
SUBSYSTEM=="usb", ATTRS{idVendor}=="0bda", ATTRS{idProduct}=="2838", MODE="0660", GROUP="$GROUP", ENV{ID_SOFTWARE_RADIO}="1"

# Keep USB power saving off the receivers: a sleeping stick can miss the start of a burst.
ACTION=="add", SUBSYSTEM=="usb", ATTR{idVendor}=="0bda", ATTR{idProduct}=="2832|2838", TEST=="power/control", ATTR{power/control}="on"
ACTION=="add", SUBSYSTEM=="usb", ATTR{idVendor}=="36b7", TEST=="power/control", ATTR{power/control}="on"

# The Quansheng ALERT radio (USB serial, vendor 36B7) and USB-serial adapters
# carry receivers, not modems: keep ModemManager's probing off them.
ATTRS{idVendor}=="36b7", ENV{ID_MM_DEVICE_IGNORE}="1"
SUBSYSTEM=="tty", KERNEL=="ttyUSB[0-9]*", ENV{ID_MM_DEVICE_IGNORE}="1"
SUBSYSTEM=="tty", KERNEL=="ttyACM[0-9]*", ATTRS{idVendor}=="36b7", MODE="0660", GROUP="dialout"
RULES
}
write_block() {
  cat <<'BLOCK'
# open-ALERT base station, container host: an RTL-SDR stick is a radio receiver
# here, not a digital-TV tuner. Without this the kernel's TV driver takes the
# stick when it is plugged in and rtl_sdr cannot open it.
# Written by firmware/container/host-setup.sh; the same list the native package installs.
blacklist dvb_usb_rtl28xxu
blacklist rtl2832
blacklist rtl2832_sdr
blacklist rtl2830
blacklist r820t
BLOCK
}

# Write a file only when its content would change; say which.   put_file PATH FUNCTION
put_file() {
  local path=$1 fn=$2 tmp
  tmp=$(mktemp)
  "$fn" > "$tmp"
  if [ -f "$path" ] && cmp -s "$tmp" "$path"; then
    printf 'already in place: %s\n' "${path#"$ROOT"}"
  else
    mkdir -p "$(dirname "$path")"
    install -m 0644 "$tmp" "$path"
    printf 'written: %s\n' "${path#"$ROOT"}"
    CHANGED=1
  fi
  rm -f "$tmp"
}
CHANGED=0

group_gid() { getent group "$GROUP" | cut -d: -f3; }

case "$ACTION" in
  check)
    for f in "$RULE" "$BLOCK"; do
      if [ -f "$f" ]; then printf 'present: %s\n' "${f#"$ROOT"}"; else printf 'missing: %s\n' "${f#"$ROOT"}"; fi
    done
    if [ -z "$ROOT" ]; then
      if g=$(group_gid) && [ -n "$g" ]; then printf 'group %s: number %s (OA_USB_GID=%s)\n' "$GROUP" "$g" "$g"; else printf 'group %s: not there\n' "$GROUP"; fi
      if [ -r /proc/modules ] && grep -Eq '^(dvb_usb_rtl28xxu|rtl2832|rtl2832_sdr|rtl2830|r820t) ' /proc/modules; then
        printf 'the TV driver is loaded now (it is blocked from the next start-up; unplug the stick and run: sudo modprobe -r dvb_usb_rtl28xxu rtl2832_sdr rtl2832 r820t)\n'
      fi
    fi ;;
  remove)
    for f in "$RULE" "$BLOCK"; do
      if [ -f "$f" ]; then rm -f "$f"; printf 'removed: %s\n' "${f#"$ROOT"}"; CHANGED=1; else printf 'was not there: %s\n' "${f#"$ROOT"}"; fi
    done
    if [ -z "$ROOT" ] && [ "$CHANGED" = 1 ] && command -v udevadm >/dev/null 2>&1; then udevadm control --reload 2>/dev/null || true; fi
    printf 'The group "%s" is left alone (other things may use it).\n' "$GROUP" ;;
  setup)
    if [ -z "$ROOT" ]; then
      if ! getent group "$GROUP" >/dev/null; then
        if [ -n "$GID_WANTED" ]; then groupadd --system --gid "$GID_WANTED" "$GROUP"; else groupadd --system "$GROUP"; fi
        printf 'made the group %s (number %s)\n' "$GROUP" "$(group_gid)"
      elif [ -n "$GID_WANTED" ] && [ "$(group_gid)" != "$GID_WANTED" ]; then
        printf 'note: the group %s already exists with number %s, not %s: use %s as OA_USB_GID\n' "$GROUP" "$(group_gid)" "$GID_WANTED" "$(group_gid)"
      fi
    fi
    put_file "$RULE" write_rule
    put_file "$BLOCK" write_block
    if [ -z "$ROOT" ]; then
      if command -v udevadm >/dev/null 2>&1; then
        udevadm control --reload 2>/dev/null || true
        printf 'the device rule is loaded; it applies to a stick when it is plugged in\n'
      else
        printf 'note: no udevadm here; the device rule applies after the next start-up\n'
      fi
      if [ -r /proc/modules ] && grep -Eq '^(dvb_usb_rtl28xxu|rtl2832|rtl2832_sdr|rtl2830|r820t) ' /proc/modules; then
        printf 'note: the TV driver is loaded right now. The block holds from the next start-up; to free a plugged-in stick now,\n      unplug it and run: sudo modprobe -r dvb_usb_rtl28xxu rtl2832_sdr rtl2832 r820t\n'
      fi
      printf '\nPut this in compose.yaml'"'"'s environment (a file called .env beside it):  OA_USB_GID=%s\n' "$(group_gid)"
      printf 'Then unplug and replug the stick.\n'
    fi ;;
  *) printf 'host-setup: unexpected action %s\n' "$ACTION" >&2; exit 2 ;;
esac
