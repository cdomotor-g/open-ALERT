#!/bin/bash
# Write a software bill of materials: the list of everything inside a build,
# with versions, in a standard form (SPDX 2.3, JSON) that security scanners
# read. It goes to standard output.
#
#   For the package alone:
#     firmware/image/sbom.sh --deb dist/open-alert-base_<version>_all.deb
#   For a disk image (build-image.sh calls it this way):
#     firmware/image/sbom.sh --image-name NAME.img --image-sha256 HASH --arch amd64 \
#         --packages NAME.packages.tsv --deb dist/open-alert-base_<version>_all.deb
#
# What it lists
#   - the open-alert-base package, with the SHA-256 of the .deb;
#   - the RPi ALERT release inside it, as firmware/PIN names it: its tag, where
#     it is downloaded from, its SHA-256 and the key that signed it;
#   - for a disk image: every Debian package in the image with its version, the
#     kind of processor it is for and the Debian source package it was built
#     from (the lines of the .packages.tsv file, which build-image.sh takes from
#     dpkg inside the image).
# For the package alone, the Debian packages it needs are named as the
# package names them ("Depends"), without versions: which versions are
# installed is the business of the computer it is installed on.
#
# It needs jq and dpkg-deb. Nothing is downloaded.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FIRMWARE="$(dirname "$HERE")"

die()   { printf 'sbom: %s\n' "$*" >&2; exit 1; }
usage() { sed -n '2,/^set -euo/p' "${BASH_SOURCE[0]}" | sed '$d' | sed 's/^# \{0,1\}//'; }

DEB=''; PACKAGES=''; IMAGE_NAME=''; IMAGE_SHA=''; ARCH=''
while [ $# -gt 0 ]; do
  case "$1" in
    --deb) DEB="${2:?--deb needs a file}"; shift 2 ;;
    --packages) PACKAGES="${2:?--packages needs a file}"; shift 2 ;;
    --image-name) IMAGE_NAME="${2:?--image-name needs a name}"; shift 2 ;;
    --image-sha256) IMAGE_SHA="${2:?--image-sha256 needs a hash}"; shift 2 ;;
    --arch) ARCH="${2:?--arch needs amd64 or arm64}"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) die "unknown option $1 (try --help)" ;;
  esac
done
for t in jq dpkg-deb sha256sum; do command -v "$t" >/dev/null 2>&1 || die "\"$t\" is not installed"; done
if [ -z "$DEB" ] || [ ! -f "$DEB" ]; then die "--deb FILE is needed (the open-alert-base package)"; fi
if [ -n "$PACKAGES" ]; then
  [ -f "$PACKAGES" ] || die "no such file: $PACKAGES"
  if [ -z "$IMAGE_NAME" ] || [ -z "$IMAGE_SHA" ] || [ -z "$ARCH" ]; then die "with --packages, give --image-name, --image-sha256 and --arch too"; fi
fi

pin() { sed -n "s|^$1=\([A-Za-z0-9._:/+=-]*\)\$|\1|p" "$FIRMWARE/PIN" | tail -n 1; }
DEB_NAME=$(basename "$DEB")
DEB_VERSION=$(dpkg-deb --field "$DEB" Version)
DEB_DEPENDS=$(dpkg-deb --field "$DEB" Depends)
DEB_SHA=$(sha256sum "$DEB" | awk '{print $1}')
# The date of the build: SOURCE_DATE_EPOCH when the caller sets one, else now.
CREATED=$(date -u -d "@${SOURCE_DATE_EPOCH:-$(date +%s)}" +%Y-%m-%dT%H:%M:%SZ)
if [ -n "$PACKAGES" ]; then SUBJECT="$IMAGE_NAME"; SUBJECT_SHA="$IMAGE_SHA"; else SUBJECT="$DEB_NAME"; SUBJECT_SHA="$DEB_SHA"; fi

jq --null-input --raw-input \
  --arg subject "$SUBJECT" --arg subject_sha "$SUBJECT_SHA" --arg created "$CREATED" \
  --arg image "$IMAGE_NAME" --arg image_sha "$IMAGE_SHA" --arg arch "$ARCH" \
  --arg deb "$DEB_NAME" --arg deb_version "$DEB_VERSION" --arg deb_sha "$DEB_SHA" --arg deb_depends "$DEB_DEPENDS" \
  --arg tag "$(pin AGENT_TAG)" --arg agent_version "$(pin AGENT_VERSION)" --arg agent_url "$(pin AGENT_URL)" \
  --arg agent_sha "$(pin AGENT_SHA256)" --arg key "$(pin KEY_FINGERPRINT)" '
  # The lines of the .packages.tsv file (none, for the package alone):
  # name, version, processor, source package, source version.
  [ inputs | select(length > 0) | split("\t") ] as $rows
  | ($image != "") as $is_image
  | { SPDXID: "SPDXRef-open-alert-base", name: "open-alert-base", versionInfo: $deb_version,
      supplier: "Organization: open-ALERT", downloadLocation: "https://github.com/cdomotor-g/open-ALERT",
      packageFileName: $deb, filesAnalyzed: false, primaryPackagePurpose: "APPLICATION",
      checksums: [ { algorithm: "SHA256", checksumValue: $deb_sha } ],
      licenseConcluded: "NOASSERTION", licenseDeclared: "NOASSERTION", copyrightText: "NOASSERTION",
      comment: ("The native package built by firmware/deb/build-deb.sh. It holds the RPi ALERT agent unchanged. The Debian packages it needs (its Depends field): " + $deb_depends)
    } as $oab
  | { SPDXID: "SPDXRef-rpi-alert", name: "rpi-alert", versionInfo: $agent_version,
      supplier: "Organization: RPi ALERT (github.com/cdomotor-g/RPi_ALERT)", downloadLocation: $agent_url,
      filesAnalyzed: false, primaryPackagePurpose: "APPLICATION",
      checksums: [ { algorithm: "SHA256", checksumValue: $agent_sha } ],
      licenseConcluded: "NOASSERTION", licenseDeclared: "NOASSERTION", copyrightText: "NOASSERTION",
      externalRefs: [ { referenceCategory: "PACKAGE-MANAGER", referenceType: "purl",
                        referenceLocator: ("pkg:github/cdomotor-g/RPi_ALERT@" + $tag) } ],
      comment: ("The signed release " + $tag + " named in firmware/PIN. The SHA-256 is that of its source tarball, whose Ed25519 signature is checked at build against the release key with the fingerprint " + $key + ".")
    } as $agent
  | [ $rows | to_entries[] | .value as $r
      | { SPDXID: ("SPDXRef-deb-" + (.key | tostring) + "-" + ($r[0] | gsub("[^A-Za-z0-9.-]"; "-"))),
          name: ($r[0] | sub(":.*$"; "")), versionInfo: $r[1],
          supplier: "Organization: Debian", downloadLocation: "NOASSERTION", filesAnalyzed: false,
          licenseConcluded: "NOASSERTION", licenseDeclared: "NOASSERTION", copyrightText: "NOASSERTION",
          sourceInfo: ("Debian 13 binary package for " + $r[2] + ", built from the source package " + $r[3] + " " + $r[4]),
          externalRefs: [ { referenceCategory: "PACKAGE-MANAGER", referenceType: "purl",
                            referenceLocator: ("pkg:deb/debian/" + ($r[0] | sub(":.*$"; "") | @uri) + "@" + ($r[1] | @uri)
                                               + "?arch=" + $r[2] + "&distro=debian-13") } ]
        }
      # The base station package is in the dpkg list too: it is described above.
      | select(.name != "open-alert-base")
    ] as $debian
  | { SPDXID: "SPDXRef-image", name: $image, versionInfo: $deb_version,
      supplier: "Organization: open-ALERT", downloadLocation: "https://github.com/cdomotor-g/open-ALERT",
      packageFileName: $image, filesAnalyzed: false, primaryPackagePurpose: "OPERATING-SYSTEM",
      checksums: [ { algorithm: "SHA256", checksumValue: $image_sha } ],
      licenseConcluded: "NOASSERTION", licenseDeclared: "NOASSERTION", copyrightText: "NOASSERTION",
      comment: ("A whole-disk image for " + $arch + " computers with UEFI firmware, built by firmware/image/build-image.sh: Debian 13 from the Debian archive, and the open-alert-base package. The SHA-256 is that of the unpacked .img file.")
    } as $img
  | {
      spdxVersion: "SPDX-2.3", dataLicense: "CC0-1.0", SPDXID: "SPDXRef-DOCUMENT",
      name: $subject,
      documentNamespace: ("https://github.com/cdomotor-g/open-ALERT/firmware/spdx/" + ($subject | @uri) + "-" + $subject_sha),
      creationInfo: { created: $created, creators: [ "Tool: open-ALERT firmware/image/sbom.sh" ] },
      packages: ((if $is_image then [ $img ] else [] end) + [ $oab, $agent ] + $debian),
      relationships: (
        [ { spdxElementId: "SPDXRef-DOCUMENT", relationshipType: "DESCRIBES",
            relatedSpdxElement: (if $is_image then "SPDXRef-image" else "SPDXRef-open-alert-base" end) },
          { spdxElementId: "SPDXRef-open-alert-base", relationshipType: "CONTAINS", relatedSpdxElement: "SPDXRef-rpi-alert" } ]
        + (if $is_image then
             [ { spdxElementId: "SPDXRef-image", relationshipType: "CONTAINS", relatedSpdxElement: "SPDXRef-open-alert-base" } ]
             + [ $debian[] | { spdxElementId: "SPDXRef-image", relationshipType: "CONTAINS", relatedSpdxElement: .SPDXID } ]
           else [] end)
      )
    }
' < "${PACKAGES:-/dev/null}"
