# Security pack for the open-ALERT base station

**Draft, 11 November 2026.** What a person who has to approve this computer on their network is
handed. Written for an IT security assessor, a network engineer or a procurement officer at a
water authority, council or government agency. It is not a certificate and not an approval: it
is the information an assessor asks for, in one place, with the gaps marked.

## What the "base station" is here

A small computer with one or more radio sticks and an antenna, running **RPi ALERT's signed
release** (the program that listens for flood gauges, decodes their messages and sends the
readings to **Flood-Net**), installed from the **`open-alert-base`** package onto stock
Debian 13 or Ubuntu 24.04. The package, its tests and its limits are in
[`firmware/`](../../firmware/README.md). This pack answers for the package in its **enterprise
profile**: no hotspot, no remote changes from Flood-Net, no self-reboots, a dashboard reachable
from the computer itself only, and a web-proxy and private-certificate route.

## What is in this folder

| File | What it is |
|---|---|
| [overview.md](overview.md) | What the base station is, the data it handles (public rainfall and river levels), a drawing of the data flow in text, what listens and what calls out, by profile |
| [shared-responsibility.md](shared-responsibility.md) | Who does what: the project, the organisation running it, Flood-Net |
| [controls.md](controls.md) | The questions an assessor asks, each answered for the enterprise profile, with "not yet" and "depends on the operating system you install" marked honestly. Ends with the three consumer-device basics |
| [support.md](support.md) | Which releases are supported and for how long. **A proposal for the owner to confirm**, not a commitment |
| [../../SECURITY.md](../../SECURITY.md) | How to report a flaw |

## How to use it

1. Read [overview.md](overview.md) first: it is two pages and answers "what is this and what
   does it touch".
2. Go through [controls.md](controls.md) with your own checklist beside it. Each answer says
   where it comes from, and where a thing is **not yet** done or **depends on the operating
   system you install**, it says that instead of an answer.
3. Run the base station's own audit on the computer and attach its output:
   `sudo open-alert-base audit`. It prints, on one page, what is installed and whether every
   agent file still matches the signed release, who the service runs as, what it is kept from
   (read from the running program), what listens on the network, the profile and the settings
   that matter, and the proxy.
4. Take [shared-responsibility.md](shared-responsibility.md) to whoever will run the computer, so
   that "who patches the operating system" has a named answer before it is installed.
5. Report anything wrong or missing as [SECURITY.md](../../SECURITY.md) says (for a flaw) or as a
   normal issue (for a gap in this pack).

## Where the facts come from

- [`firmware/README.md`](../../firmware/README.md): what the package puts on the computer, the
  service's limits, the profiles, the tests and what has not been tested.
- [`U1-rpi-alert-portability.md`](../hardware-review/research/U1-rpi-alert-portability.md),
  section 6: RPi ALERT's security posture as an assessor would list it (every listening socket,
  everything that runs as root, every outbound connection), written from RPi ALERT 0.23.1.
- [`R4-au-gov-it-security.md`](../hardware-review/research/R4-au-gov-it-security.md) and its
  [re-check](../hardware-review/research/R4-au-gov-it-security.verify.md): what Australian
  government IT security asks, and where the questions below come from.

## Limits, said plainly

- **Nothing has yet been run with a real radio stick on a computer that is not a Raspberry
  Pi.** As at 13 November 2026 the package's own checks pass on Debian 13 and Ubuntu 24.04 with
  stand-ins for the radio, on one test computer that has no USB. No ARM computer has run it.
  The firmware is still being worked on: `firmware/README.md`, "What has been tested, and
  where", is always the current word.
- **There is no release of the package yet** (<https://github.com/cdomotor-g/open-ALERT/releases>
  has none), so there is no signed package, no published bill of materials file and no package
  repository to patch from. Where a control depends on those, it says "not yet".
- **No outside assessor has reviewed this.** The statements are the project's own, checked
  against the code and the tests.
- This pack is not legal advice and does not claim the base station meets any named standard or
  has been certified under one.
