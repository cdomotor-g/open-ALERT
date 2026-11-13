#!/bin/bash
# Build a ready-to-flash disk image of an open-ALERT base station:
#   dist/open-alert-base-<version>-<arch>-uefi.img        the disk, byte for byte
#   dist/open-alert-base-<version>-<arch>-uefi.img.xz     the same, packed, for download
#   dist/open-alert-base-<version>-<arch>-uefi.img.xz.sha256
#   dist/open-alert-base-<version>-<arch>-uefi.packages.tsv   every Debian package in it, with its version
#   dist/open-alert-base-<version>-<arch>-uefi.spdx.json      the same list as a software bill of materials
#
# What is in the image, and nothing else:
#   1. Debian 13 ("trixie"), from Debian's own archive. apt checks Debian's
#      signature on everything it downloads. The packages asked for by name
#      are in packages.common and packages.<arch> beside this script, each
#      with its reason.
#   2. The open-alert-base package that firmware/deb/build-deb.sh makes from
#      the RPi ALERT release named in firmware/PIN (its hash and its signature
#      are checked there), with its "standard" profile.
#   3. The files under files/ beside this script, copied in as they are: how
#      the image differs from a stock Debian (SSH by key only, the firewall,
#      the network, the first set-up). And cidata/, the first set-up files a
#      person edits after flashing.
#
#   sudo firmware/image/build-image.sh                      for the kind of computer this is run on
#   sudo firmware/image/build-image.sh --tarball F --sig S  with the release's two files already here
# Options
#   --arch amd64|arm64   which kind of processor (default: this computer's). The build does not
#                        cross over: run it on an ARM computer for arm64.
#   --deb FILE           use this open-alert-base package instead of building one
#   --tarball F --sig S  handed to build-deb.sh: the pinned release, already downloaded
#   --out DIR            where the results go (default: dist/ at the top of the repository)
#   --size SIZE          size of the image file, e.g. 3G (the default). The main partition grows to
#                        fill whatever disk it is written to, at the first start.
#   --mirror URL         Debian's archive (default: https://deb.debian.org/debian)
#   --security-mirror URL  its security updates (default: https://security.debian.org/debian-security)
#   --no-firmware        leave out the processor microcode and network firmware (packages.firmware.<arch>);
#                        the image is then built from the "main" part of Debian's archive alone
#   --no-xz              do not pack the image (quicker, for trying things)
#   --keep-work          leave the work folder in place when a step fails, to look at
#
# It needs root (it makes file systems and device files, and installs Debian
# into a folder), and these tools: mmdebstrap, sfdisk and partx (fdisk,
# util-linux), mkfs.ext4 (e2fsprogs), mkfs.vfat (dosfstools), mcopy (mtools),
# losetup, xz, jq, Debian's archive keys (debian-archive-keyring), and what
# build-deb.sh needs. It uses one loop device and mounts one file system (the
# image's main partition). It does not need a container, and never a
# privileged one. Only the main partition is ever mounted: the two small FAT
# partitions are filled with mtools, so the computer doing the build needs no
# FAT support of its own.
#
# The two --mirror options change only where this build downloads from. The
# image itself always fetches its updates from Debian's own addresses.
#
# Not tested: nothing built by this script has run on a real computer, and no
# radio stick has been near it. See "What has been tested, and where" in
# firmware/README.md.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FIRMWARE="$(dirname "$HERE")"
REPO="$(dirname "$FIRMWARE")"

say()   { printf '%s\n' "$*"; }
step()  { printf '\n== %s\n' "$*"; }
die()   { printf 'build-image: %s\n' "$*" >&2; exit 1; }
usage() { sed -n '2,/^set -euo/p' "${BASH_SOURCE[0]}" | sed '$d' | sed 's/^# \{0,1\}//'; }

SUITE=trixie
ARCH=''; DEB=''; OUT="$REPO/dist"; SIZE=3G; FIRMWARE_PKGS=1; XZ=1; KEEP=0
MIRROR=https://deb.debian.org/debian
SECURITY_MIRROR=https://security.debian.org/debian-security
DEB_ARGS=()
while [ $# -gt 0 ]; do
  case "$1" in
    --arch) ARCH="${2:?--arch needs amd64 or arm64}"; shift 2 ;;
    --deb) DEB="${2:?--deb needs a file}"; shift 2 ;;
    --tarball) DEB_ARGS+=(--tarball "${2:?--tarball needs a file}"); shift 2 ;;
    --sig) DEB_ARGS+=(--sig "${2:?--sig needs a file}"); shift 2 ;;
    --out) OUT="${2:?--out needs a folder}"; shift 2 ;;
    --size) SIZE="${2:?--size needs a size, e.g. 3G}"; shift 2 ;;
    --mirror) MIRROR="${2:?--mirror needs an address}"; shift 2 ;;
    --security-mirror) SECURITY_MIRROR="${2:?--security-mirror needs an address}"; shift 2 ;;
    --no-firmware) FIRMWARE_PKGS=0; shift ;;
    --no-xz) XZ=0; shift ;;
    --keep-work) KEEP=1; shift ;;
    -h|--help) usage; exit 0 ;;
    *) die "unknown option $1 (try --help)" ;;
  esac
done

HOST_ARCH=$(dpkg --print-architecture 2>/dev/null || true)
[ -n "$ARCH" ] || ARCH="$HOST_ARCH"
# What differs between the two kinds of processor: the names Debian and the
# UEFI standard give the boot files, the partition type of the main
# partition, and where the kernel is told to put its messages.
case "$ARCH" in
  amd64)
    EFI_ARCH=x64; GRUB_TARGET=x86_64-efi
    ROOT_TYPE=4F68BCE3-E8CD-4DB1-96E7-FBCAF984B709      # "Linux root (x86-64)"
    # The screen, and the first serial port at 115200 baud. The last one named
    # is where systemd's own messages and an emergency prompt go.
    CONSOLE="console=tty0 console=ttyS0,115200n8" ;;
  arm64)
    EFI_ARCH=aa64; GRUB_TARGET=arm64-efi
    ROOT_TYPE=B921B045-1DF0-41C3-AF44-4C6F280D3FAE      # "Linux root (ARM 64-bit)"
    # Nothing named: an ARM computer's firmware tells the kernel which serial
    # port is its console (they differ from board to board), and the screen
    # gets a login prompt either way.
    CONSOLE="" ;;
  *) die "--arch must be amd64 or arm64 (got \"$ARCH\")" ;;
esac
EFI_ARCH_UPPER=$(printf '%s' "$EFI_ARCH" | tr '[:lower:]' '[:upper:]')
[ "$ARCH" = "$HOST_ARCH" ] || die "this computer is $HOST_ARCH and cannot build the $ARCH image: the build installs Debian by running Debian's own programs. Run it on a computer of that kind (the automatic build uses GitHub's ARM machines for arm64)."
[ "$(id -u)" = 0 ] || die "this needs root (it makes file systems and device files): sudo $0"
for t in mmdebstrap sfdisk partx mkfs.ext4 e2fsck mkfs.vfat mcopy mmd mdir losetup mount umount chroot truncate dd sha256sum awk sed od jq dpkg-deb; do
  command -v "$t" >/dev/null 2>&1 || die "\"$t\" is not installed (see the list of tools at the top of this script)"
done
if [ "$XZ" = 1 ]; then command -v xz >/dev/null 2>&1 || die "\"xz\" is not installed (or use --no-xz)"; fi
KEYRING=/usr/share/keyrings/debian-archive-keyring.gpg
[ -e "$KEYRING" ] || KEYRING=/usr/share/keyrings/debian-archive-keyring.pgp
[ -e "$KEYRING" ] || die "Debian's archive keys are not installed (the package debian-archive-keyring): without them apt cannot check what it downloads"

pin() { sed -n "s|^$1=\([A-Za-z0-9._:/+=-]*\)\$|\1|p" "$FIRMWARE/PIN" | tail -n 1; }
VERSION="$(pin AGENT_VERSION)+oa$(pin OA_REVISION)"
[ "$VERSION" != "+oa" ] || die "firmware/PIN lacks AGENT_VERSION or OA_REVISION"
NAME="open-alert-base-${VERSION}-${ARCH}-uefi"

# The lists of packages: names only, comments and empty lines dropped.
pkg_list() { sed 's/#.*//; s/[[:space:]]*$//; /^$/d' "$@" | tr '\n' ',' | sed 's/,$//'; }
PKG_FILES=("$HERE/packages.common" "$HERE/packages.$ARCH")
COMPONENTS=main
if [ "$FIRMWARE_PKGS" = 1 ] && [ -f "$HERE/packages.firmware.$ARCH" ]; then
  PKG_FILES+=("$HERE/packages.firmware.$ARCH"); COMPONENTS="main non-free-firmware"
fi
for f in "${PKG_FILES[@]}"; do [ -f "$f" ] || die "missing $f"; done
PACKAGES=$(pkg_list "${PKG_FILES[@]}")

mkdir -p "$OUT"
OUT="$(cd "$OUT" && pwd)"
IMG="$OUT/$NAME.img"
WORK=$(mktemp -d "${TMPDIR:-/tmp}/oa-image.XXXXXX")
MNT="$WORK/root"
LOOP=''; ROOTDEV=''; DONE=0

# Whatever happens, leave nothing mounted and no loop device behind.
cleanup() {
  local rc=$? m
  set +e
  for m in "$MNT/dev" "$MNT/sys" "$MNT/proc" "$MNT"; do
    if mountpoint -q "$m" 2>/dev/null; then umount "$m" 2>/dev/null || umount -l "$m"; fi
  done
  if [ -n "$ROOTDEV" ]; then rm -f "$ROOTDEV"; fi
  if [ -n "$LOOP" ]; then losetup -d "$LOOP" 2>/dev/null; fi
  if [ "$DONE" != 1 ]; then
    rm -f "$IMG" "$IMG.xz" "$IMG.xz.sha256"
    if [ "$KEEP" = 1 ]; then say "build-image: stopped; the work folder is kept: $WORK"; else rm -rf "$WORK"; fi
  else
    rm -rf "$WORK"
  fi
  exit "$rc"
}
trap cleanup EXIT
trap 'exit 130' INT TERM

# Run a command inside the image being built, with a plain environment.
in_image() {
  chroot "$MNT" /usr/bin/env -i PATH=/usr/sbin:/usr/bin:/sbin:/bin HOME=/root LC_ALL=C.UTF-8 \
    DEBIAN_FRONTEND=noninteractive "$@"
}

# ═════════════════════════════════════════════════════════════════════════════
step "1. The base station package (open-alert-base $VERSION)"
# ═════════════════════════════════════════════════════════════════════════════
if [ -z "$DEB" ]; then
  "$FIRMWARE/deb/build-deb.sh" --out "$OUT" "${DEB_ARGS[@]}"
  DEB="$OUT/open-alert-base_${VERSION}_all.deb"
fi
[ -f "$DEB" ] || die "no package at $DEB"
[ "$(dpkg-deb --field "$DEB" Package)" = open-alert-base ] || die "$DEB is not the open-alert-base package"
[ "$(dpkg-deb --field "$DEB" Version)" = "$VERSION" ] || die "$DEB is version $(dpkg-deb --field "$DEB" Version), and firmware/PIN says $VERSION"
DEB_SHA=$(sha256sum "$DEB" | awk '{print $1}')
say "package    $DEB"
say "sha256     $DEB_SHA"

# ═════════════════════════════════════════════════════════════════════════════
step "2. An empty disk: three partitions"
# ═════════════════════════════════════════════════════════════════════════════
# A GPT partition table, as UEFI firmware expects:
#   1  EFI system partition, 256 MB, FAT32   the boot files; the firmware reads it
#   2  CIDATA, 32 MB, FAT16                  the first set-up files; a person edits them on any computer
#   3  the main partition, ext4              Debian and the base station; last, so that it can grow
# Sizes are in 512-byte sectors; 2048 sectors are 1 MB.
ESP_START=2048;  ESP_SECTORS=$((256 * 2048))
CID_START=$((ESP_START + ESP_SECTORS)); CID_SECTORS=$((32 * 2048))
ROOT_START=$((CID_START + CID_SECTORS))
rm -f "$IMG" "$IMG.xz" "$IMG.xz.sha256"
truncate -s "$SIZE" "$IMG"
sfdisk --quiet "$IMG" <<PARTS
label: gpt
unit: sectors
first-lba: 2048
start=$ESP_START, size=$ESP_SECTORS, type=C12A7328-F81F-11D2-BA4B-00A0C93EC93B, name="EFI system partition"
start=$CID_START, size=$CID_SECTORS, type=EBD0A0A2-B9E5-4433-87C0-68B6B72699C7, name="CIDATA"
start=$ROOT_START, type=$ROOT_TYPE, name="open-ALERT base station"
PARTS
# Read back what was really made, and work from that.
read -r GOT_START ROOT_SECTORS < <(partx --noheadings --raw --output START,SECTORS --nr 3 "$IMG")
[ "$GOT_START" = "$ROOT_START" ] || die "the main partition starts at sector $GOT_START, not $ROOT_START as asked"
sfdisk --list "$IMG" | sed -n '/^Device/,$p'

# Each file system gets an identifier of its own, made here: /etc/fstab and
# the boot menu find the partitions by it, whatever disk the image lands on.
ROOT_UUID=$(cat /proc/sys/kernel/random/uuid)
ESP_ID=$(od -An -N4 -tx4 /dev/urandom | tr -d ' \n' | tr '[:lower:]' '[:upper:]')
CID_ID=$(od -An -N4 -tx4 /dev/urandom | tr -d ' \n' | tr '[:lower:]' '[:upper:]')

# The main partition: the one thing that is mounted, through a loop device
# that covers exactly that partition.
LOOP=$(losetup --find --show --offset $((ROOT_START * 512)) --sizelimit $((ROOT_SECTORS * 512)) "$IMG")
mkfs.ext4 -q -L oa-root -U "$ROOT_UUID" "$LOOP"
# The loop device is given a second name, and mounted by that one. GRUB's menu
# maker gives up without a word when the main partition is on a device named
# /dev/loop0 to /dev/loop9 (it takes that for a disk image opened inside a
# running system); under another name it does its work.
ROOTDEV="/dev/oa-image-root-$$"
# shellcheck disable=SC2046  # two numbers, as two words
mknod -m 0600 "$ROOTDEV" b $(stat -c '%Hr %Lr' "$LOOP")
mkdir -p "$MNT"
mount "$ROOTDEV" "$MNT"
say "main partition: ext4, $((ROOT_SECTORS / 2048)) MB, on $LOOP (as $ROOTDEV)"

# ═════════════════════════════════════════════════════════════════════════════
step "3. Debian 13 ($SUITE, $ARCH) from Debian's archive"
# ═════════════════════════════════════════════════════════════════════════════
# mmdebstrap is Debian's own tool for installing Debian into a folder. apt
# does the downloading and checks every package against Debian's signature
# (the keys in $KEYRING). Nothing "recommended" is added: only the packages
# named in the lists, and what those cannot work without.
say "asked for by name: $(printf '%s' "$PACKAGES" | tr ',' ' ')"
# Tell GRUB's package, before it is set up, to keep the copy of the boot files
# that firmware starts when it has no entry of its own for this disk
# (EFI/BOOT) up to date as well, each time GRUB or shim is updated. A flashed
# disk in a computer that has never seen it starts from that copy.
PRESEED="grub-efi-$ARCH grub2/force_efi_extra_removable boolean true"
mmdebstrap \
  --variant=minbase \
  --architectures="$ARCH" \
  --components="$COMPONENTS" \
  --keyring="$KEYRING" \
  --include="$PACKAGES" \
  --aptopt='Acquire::Retries "3"' \
  --essential-hook="echo '$PRESEED' | chroot \"\$1\" debconf-set-selections" \
  "$SUITE" "$MNT" \
  "deb $MIRROR $SUITE $COMPONENTS" \
  "deb $MIRROR $SUITE-updates $COMPONENTS" \
  "deb $SECURITY_MIRROR $SUITE-security $COMPONENTS"

# From here on, commands are run inside the image (in_image). They are given
# the kernel's /proc and /sys, and a small /dev made for the purpose: the usual
# few device files, and the main partition's, so that GRUB's tools can find
# it. The build computer's own /dev is not handed over.
mount -t proc proc "$MNT/proc"
mount -t sysfs -o ro sysfs "$MNT/sys"
mount -t tmpfs -o mode=0755,size=1m tmpfs "$MNT/dev"
mknod -m 0666 "$MNT/dev/null" c 1 3
mknod -m 0666 "$MNT/dev/zero" c 1 5
mknod -m 0666 "$MNT/dev/full" c 1 7
mknod -m 0666 "$MNT/dev/random" c 1 8
mknod -m 0666 "$MNT/dev/urandom" c 1 9
mknod -m 0666 "$MNT/dev/tty" c 5 0
ln -s /proc/self/fd "$MNT/dev/fd"
# shellcheck disable=SC2046  # two numbers, as two words
mknod -m 0600 "$MNT$ROOTDEV" b $(stat -c '%Hr %Lr' "$LOOP")
# On a running computer udev keeps this list of file systems by identifier;
# GRUB's menu maker looks in it before it will name the main partition by its
# identifier (root=UUID=…) and not by the build's own device name.
mkdir -p "$MNT/dev/disk/by-uuid"
ln -s "../../$(basename "$ROOTDEV")" "$MNT/dev/disk/by-uuid/$ROOT_UUID"

# ═════════════════════════════════════════════════════════════════════════════
step "4. The base station package, with its standard profile"
# ═════════════════════════════════════════════════════════════════════════════
# Installed with dpkg, from the file: everything it depends on is in the
# image already, so nothing is downloaded. Its own install script makes the
# agent's user, writes the standard profile's settings and sets the service
# to start with the computer.
cp "$DEB" "$MNT/tmp/open-alert-base.deb"
in_image dpkg --install /tmp/open-alert-base.deb
rm -f "$MNT/tmp/open-alert-base.deb"
in_image dpkg --verify open-alert-base || die "the installed package's files are not the package's"
( cd "$MNT/usr/lib/open-alert-base/agent" && sha256sum --quiet -c "$MNT/usr/share/open-alert-base/agent.sha256" ) \
  || die "the agent in the image is not the signed release's, file for file"
[ "$(cat "$MNT/etc/open-alert-base/profile" 2>/dev/null)" = standard ] || die "the standard profile was not put in force"
[ -L "$MNT/etc/systemd/system/multi-user.target.wants/open-alert-base.service" ] || die "the service is not set to start with the computer"
say "agent      $(wc -l < "$MNT/usr/share/open-alert-base/agent.sha256") files, each as in the signed release $(pin AGENT_TAG)"

# ═════════════════════════════════════════════════════════════════════════════
step "5. How this image differs from a stock Debian"
# ═════════════════════════════════════════════════════════════════════════════
# Every file under files/ is copied to the same place in the image. They are
# few, and each says at its top what it is for.
( cd "$HERE/files" && find . -type f | LC_ALL=C sort ) | while read -r f; do
  install -D -m 0644 -o root -g root "$HERE/files/$f" "$MNT/$f"
  say "  ${f#.}"
done
sed -i "s|@CONSOLE@|$CONSOLE|" "$MNT/etc/default/grub.d/50-open-alert-image.cfg"

# Where the partitions are mounted. The EFI partition is "nofail": it is only
# needed when the boot files are updated, and a base station should still
# start if that small FAT partition has been damaged by a power cut.
cat > "$MNT/etc/fstab" <<FSTAB
# <what>                                  <where>    <type> <options>            <dump> <check>
UUID=$ROOT_UUID /          ext4   errors=remount-ro    0      1
UUID=${ESP_ID:0:4}-${ESP_ID:4:4}                            /boot/efi  vfat   umask=0077,nofail    0      2
FSTAB
mkdir -p "$MNT/boot/efi"

# Where Debian's updates come from: always Debian's own addresses, whatever
# --mirror this build used.
rm -f "$MNT/etc/apt/sources.list"
IMAGE_KEYRING=/usr/share/keyrings/debian-archive-keyring.pgp
[ -e "$MNT$IMAGE_KEYRING" ] || IMAGE_KEYRING=/usr/share/keyrings/debian-archive-keyring.gpg
[ -e "$MNT$IMAGE_KEYRING" ] || die "the image has no Debian archive keys"
cat > "$MNT/etc/apt/sources.list.d/debian.sources" <<SOURCES
# Debian 13, its updates, and its security updates: from Debian, over HTTPS,
# each download checked against Debian's signature.
Types: deb
URIs: https://deb.debian.org/debian
Suites: $SUITE $SUITE-updates
Components: $COMPONENTS
Signed-By: $IMAGE_KEYRING

Types: deb
URIs: https://security.debian.org/debian-security
Suites: $SUITE-security
Components: $COMPONENTS
Signed-By: $IMAGE_KEYRING
SOURCES

# Automatic security updates: Debian's unattended-upgrades, as it comes. Its
# own file says "every day: look for updates, install the security ones".
AUTO="$MNT/etc/apt/apt.conf.d/20auto-upgrades"
if ! grep -qs 'Unattended-Upgrade "1"' "$AUTO"; then
  printf 'APT::Periodic::Update-Package-Lists "1";\nAPT::Periodic::Unattended-Upgrade "1";\n' > "$AUTO"
fi

# The computer's name until user-data gives it another.
echo open-alert-base > "$MNT/etc/hostname"
cat > "$MNT/etc/hosts" <<HOSTS
127.0.0.1       localhost
127.0.1.1       open-alert-base
::1             localhost ip6-localhost ip6-loopback
ff02::1         ip6-allnodes
ff02::2         ip6-allrouters
HOSTS
# Name look-ups go through systemd-resolved.
ln -sfn ../run/systemd/resolve/stub-resolv.conf "$MNT/etc/resolv.conf"

# What starts with the computer, beyond what Debian's packages set themselves.
in_image systemctl enable systemd-networkd.service systemd-resolved.service systemd-timesyncd.service \
  nftables.service ssh.service open-alert-image-ssh-host-keys.service

# No account has a password, root included: the second field of every line of
# /etc/shadow must be "*" or start with "!" (both mean "no password opens this").
in_image passwd --lock root >/dev/null
if awk -F: '$2 !~ /^[!*]/ { bad = 1; print "  " $1 } END { exit bad ? 0 : 1 }' "$MNT/etc/shadow"; then
  die "the accounts listed above could be opened with a password (or with none)"
fi

# ═════════════════════════════════════════════════════════════════════════════
step "6. The boot files (the signed chain: shim, GRUB, kernel)"
# ═════════════════════════════════════════════════════════════════════════════
# The start-up system the kernel loads first is made again now that /etc/fstab
# says what the main partition is.
in_image update-initramfs -u -k all
KERNEL=$(cd "$MNT/boot" && find . -maxdepth 1 -name 'vmlinuz-*' | sed 's|^\./vmlinuz-||' | sort -V | tail -n 1)
[ -n "$KERNEL" ] || die "no kernel in the image's /boot"

# The boot menu's own folder (/boot/grub), filled as GRUB's installer fills
# it: GRUB's parts, and "core.efi", a GRUB put together for this disk. That
# one is not what starts the computer (the signed GRUB on the EFI partition
# is, and Secure Boot would refuse this one). It is there because Debian's
# update script for GRUB looks for it to know that GRUB was installed here,
# and only then writes the new boot files when a GRUB update arrives.
G="/boot/grub/$GRUB_TARGET"
mkdir -p "$MNT$G"
cp "$MNT/usr/lib/grub/$GRUB_TARGET"/*.mod "$MNT/usr/lib/grub/$GRUB_TARGET"/*.lst "$MNT/usr/lib/grub/$GRUB_TARGET/modinfo.sh" "$MNT$G/"
printf "search.fs_uuid %s root\nset prefix=(\$root)'/boot/grub'\n" "$ROOT_UUID" > "$MNT$G/load.cfg"
in_image grub-mkimage --directory "/usr/lib/grub/$GRUB_TARGET" --format "$GRUB_TARGET" --prefix /boot/grub \
  --config "$G/load.cfg" --output "$G/core.efi" ext2 part_gpt search_fs_uuid
cp "$MNT$G/core.efi" "$MNT$G/grub.efi"
in_image grub-editenv /boot/grub/grubenv create
in_image update-grub
grep -q "root=UUID=$ROOT_UUID" "$MNT/boot/grub/grub.cfg" \
  || die "the boot menu does not name the main partition by its identifier (root=UUID=$ROOT_UUID)"
grep -q "search --no-floppy --fs-uuid --set=root.* $ROOT_UUID" "$MNT/boot/grub/grub.cfg" \
  || die "the boot menu does not look for the main partition by its identifier"

# The EFI system partition, made as a file and filled with mtools: the files
# are the signed ones from Debian's packages, copied and not changed, in the
# places Debian's own "grub-install --force-extra-removable" puts them.
#   EFI/debian   what Debian's installer writes on any PC it installs
#   EFI/BOOT     the same again under the name every UEFI firmware looks for
#                on a disk it has no entry for: a freshly flashed one
SHIM_DIR="$MNT/usr/lib/shim"
GRUB_SIGNED="$MNT/usr/lib/grub/$GRUB_TARGET-signed/grub$EFI_ARCH.efi.signed"
for f in "$SHIM_DIR/shim$EFI_ARCH.efi.signed" "$SHIM_DIR/mm$EFI_ARCH.efi.signed" "$SHIM_DIR/fb$EFI_ARCH.efi.signed" \
         "$SHIM_DIR/BOOT$EFI_ARCH_UPPER.CSV" "$GRUB_SIGNED"; do
  [ -f "$f" ] || die "the signed boot file $f is not in the image: is the signed package for $ARCH in Debian's archive?"
done
# The one file here that is not Debian's: three lines that tell GRUB which
# partition holds its menu. (Debian's grub-install writes the same three.)
cat > "$WORK/grub-stub.cfg" <<STUB
search.fs_uuid $ROOT_UUID root
set prefix=(\$root)'/boot/grub'
configfile \$prefix/grub.cfg
STUB
ESP="$WORK/esp.img"
truncate -s $((ESP_SECTORS * 512)) "$ESP"
mkfs.vfat -F 32 -n EFI -i "$ESP_ID" "$ESP" >/dev/null
export MTOOLS_SKIP_CHECK=1
mmd -i "$ESP" ::EFI ::EFI/debian ::EFI/BOOT
mcopy -i "$ESP" "$SHIM_DIR/shim$EFI_ARCH.efi.signed" "::EFI/debian/shim$EFI_ARCH.efi"
mcopy -i "$ESP" "$GRUB_SIGNED"                        "::EFI/debian/grub$EFI_ARCH.efi"
mcopy -i "$ESP" "$SHIM_DIR/mm$EFI_ARCH.efi.signed"    "::EFI/debian/mm$EFI_ARCH.efi"
mcopy -i "$ESP" "$SHIM_DIR/fb$EFI_ARCH.efi.signed"    "::EFI/debian/fb$EFI_ARCH.efi"
mcopy -i "$ESP" "$SHIM_DIR/BOOT$EFI_ARCH_UPPER.CSV"   "::EFI/debian/BOOT$EFI_ARCH_UPPER.CSV"
mcopy -i "$ESP" "$WORK/grub-stub.cfg"                 "::EFI/debian/grub.cfg"
mcopy -i "$ESP" "$SHIM_DIR/shim$EFI_ARCH.efi.signed" "::EFI/BOOT/BOOT$EFI_ARCH_UPPER.EFI"
mcopy -i "$ESP" "$GRUB_SIGNED"                        "::EFI/BOOT/grub$EFI_ARCH.efi"
mcopy -i "$ESP" "$SHIM_DIR/mm$EFI_ARCH.efi.signed"    "::EFI/BOOT/mm$EFI_ARCH.efi"
mcopy -i "$ESP" "$SHIM_DIR/fb$EFI_ARCH.efi.signed"    "::EFI/BOOT/fb$EFI_ARCH.efi"
say "kernel     $KERNEL"
# shellcheck disable=SC2016  # ${Version} is dpkg-query's own notation, not the shell's
say "shim       $(in_image dpkg-query -W -f '${Version}' shim-signed)   GRUB $(in_image dpkg-query -W -f '${Version}' "grub-efi-$ARCH-signed")"
mdir -i "$ESP" -/ -b :: | sed 's|^::|  |'

# ═════════════════════════════════════════════════════════════════════════════
step "7. The first set-up partition (CIDATA)"
# ═════════════════════════════════════════════════════════════════════════════
CID="$WORK/cidata.img"
truncate -s $((CID_SECTORS * 512)) "$CID"
mkfs.vfat -F 16 -n CIDATA -i "$CID_ID" "$CID" >/dev/null
head -n 1 "$HERE/cidata/user-data" | grep -qx '#cloud-config' || die "cidata/user-data must start with the line #cloud-config"
for f in user-data meta-data README.txt; do
  mcopy -i "$CID" "$HERE/cidata/$f" "::$f"
  say "  $f"
done

# ═════════════════════════════════════════════════════════════════════════════
step "8. Nothing in the image that should differ from one computer to the next"
# ═════════════════════════════════════════════════════════════════════════════
# Each of these is made anew by the computer itself at its first start.
: > "$MNT/etc/machine-id"                       # the computer's own identifier (systemd makes it)
rm -f "$MNT/var/lib/dbus/machine-id"
rm -f "$MNT"/etc/ssh/ssh_host_*                 # SSH host keys (open-alert-image-ssh-host-keys.service)
rm -f "$MNT/var/lib/systemd/random-seed"        # the saved randomness
rm -rf "$MNT/var/lib/cloud"                     # cloud-init's memory of having run
# And nothing left over from the build.
rm -rf "$MNT"/var/lib/apt/lists/* "$MNT"/var/cache/apt/archives/*.deb "$MNT"/var/cache/apt/*.bin
rm -f "$MNT"/var/log/*.log "$MNT"/var/log/apt/* "$MNT/var/cache/debconf"/*-old "$MNT/var/lib/dpkg"/*-old
find "$MNT/tmp" "$MNT/var/tmp" -mindepth 1 -delete
# The agent has not run: its data folder is empty, so the dashboard's first
# password, the receivers' identifiers and the queue are each computer's own.
LEFT=$(find "$MNT/var/lib/rpi-alert" -mindepth 1 | head -n 5 | tr '\n' ' ')
[ -z "$LEFT" ] || die "the agent's data folder is not empty: $LEFT"
if grep -Eiq '"(token|password|hash|salt)"[[:space:]]*:[[:space:]]*"[^"]' "$MNT/etc/rpi-alert/config.json"; then
  die "the agent's settings in the image hold a token or a password"
fi
say "machine-id empty; no SSH host keys; the agent's data folder empty; no token or password in its settings"

# What is in the image, for the record and for the bill of materials.
# shellcheck disable=SC2016  # dpkg-query's own notation
in_image dpkg-query -W -f '${binary:Package}\t${Version}\t${Architecture}\t${source:Package}\t${source:Version}\n' \
  | LC_ALL=C sort > "$OUT/$NAME.packages.tsv"
USED_MB=$(df -BM --output=used "$MNT" | tail -n 1 | tr -dc '0-9')
say "$(wc -l < "$OUT/$NAME.packages.tsv") Debian packages; $USED_MB MB used of $((ROOT_SECTORS / 2048)) MB"

# ═════════════════════════════════════════════════════════════════════════════
step "9. Close the image"
# ═════════════════════════════════════════════════════════════════════════════
umount "$MNT/dev" "$MNT/sys" "$MNT/proc"
# Give back the space of files deleted along the way, so the image packs small.
fstrim "$MNT" 2>/dev/null || true
umount "$MNT"
rm -f "$ROOTDEV"; ROOTDEV=''
e2fsck -fn "$LOOP" >/dev/null || die "the main partition's file system does not pass its check"
losetup -d "$LOOP"; LOOP=''
# The two FAT partitions go to their places in the disk.
dd if="$ESP" of="$IMG" bs=512 seek="$ESP_START" conv=notrunc,sparse status=none
dd if="$CID" of="$IMG" bs=512 seek="$CID_START" conv=notrunc,sparse status=none
sfdisk --verify "$IMG" >/dev/null || die "the partition table does not pass its check"
mdir -i "$IMG@@$((ESP_START * 512))" "::EFI/BOOT/BOOT$EFI_ARCH_UPPER.EFI" >/dev/null || die "the boot file is not where firmware looks for it"
mdir -i "$IMG@@$((CID_START * 512))" ::user-data >/dev/null || die "user-data is not in the CIDATA partition"

IMG_SHA=$(sha256sum "$IMG" | awk '{print $1}')
"$HERE/sbom.sh" --image-name "$NAME.img" --image-sha256 "$IMG_SHA" --arch "$ARCH" \
  --packages "$OUT/$NAME.packages.tsv" --deb "$DEB" > "$OUT/$NAME.spdx.json"

if [ "$XZ" = 1 ]; then
  say "packing (xz) …"
  xz --threads=0 -6 --keep --force "$IMG"
  ( cd "$OUT" && sha256sum "$NAME.img.xz" > "$NAME.img.xz.sha256" )
fi
DONE=1

step "Built"
say "image      $IMG"
say "           $(stat -c %s "$IMG") bytes ($(du -h --apparent-size "$IMG" | awk '{print $1}')); $USED_MB MB of it in use"
say "sha256     $IMG_SHA"
if [ "$XZ" = 1 ]; then
  say "packed     $IMG.xz"
  say "           $(stat -c %s "$IMG.xz") bytes ($(du -h "$IMG.xz" | awk '{print $1}'))"
  say "sha256     $(awk '{print $1}' "$IMG.xz.sha256")   (also in $NAME.img.xz.sha256)"
fi
say "contents   $OUT/$NAME.packages.tsv"
say "           $OUT/$NAME.spdx.json"
say "Debian     $(awk -F'\t' '$1 == "base-files" {print $2}' "$OUT/$NAME.packages.tsv") (base-files), kernel $KERNEL"
say ""
say "To check it starts: firmware/test/image.sh --image $IMG"
say "Not yet run on a real computer, and never with a real radio stick: see firmware/README.md."
