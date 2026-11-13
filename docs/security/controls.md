# Controls: the questions an assessor asks, answered

**Draft, 11 November 2026.** The questions are the checklist in
[R4, section 7](../hardware-review/research/R4-au-gov-it-security.md) (the numbers H1, O1, A1 and
so on are R4's), which gathers them from the Commonwealth's Information Security Manual, the
critical-infrastructure rules and the buyer's guidance it read. Each is answered here **for the
`open-alert-base` package in its enterprise profile, on Debian 13 or Ubuntu 24.04**. The answers
come from [`firmware/README.md`](../../firmware/README.md) and
[U1](../hardware-review/research/U1-rpi-alert-portability.md) section 6 (RPi ALERT 0.23.1), and
are the project's own statements: no outside assessor has checked them.

**Status words**

| Status | Means |
|---|---|
| **Done** | The package does it and a test in `firmware/test/deb.sh` or RPi ALERT's own tests shows it |
| **Partly** | Some of it is done; the answer says what is missing |
| **Not yet** | Not done. It is not hidden or rounded up |
| **Depends on the operating system you install** | The package does not decide it; the operating system's maker and your build do |
| **Depends on the computer you buy** | The hardware maker decides it; see [comparison.md](../hardware-review/comparison.md) |
| **Yours** | It is the running organisation's job ([shared-responsibility.md](shared-responsibility.md)) |

**Before reading further:** nothing has yet been run with a real radio stick on a computer that
is not a Raspberry Pi; the tests ran in containers on a virtual machine with no USB; no ARM
computer has run the package; the package has no release yet. Every "Done" below is within
those limits.

## The hardware (H)

| # | Question | Answer | Status |
|---|---|---|---|
| H1 | Who makes it, who owns the maker, where is it made? | The project sells no hardware. The review's first choices are OnLogic (United States), Lenovo (listed in Hong Kong; its ownership was not researched) and Protectli (United States). Foreign-ownership answers come from the maker | Depends on the computer you buy |
| H2 | Until when will the maker supply firmware fixes? | The makers' statements, where the review found them, are in [support.md](support.md). For the first-choice PCs none was read except warranty options | Depends on the computer you buy |
| H3 | Hardware root of trust (UEFI Secure Boot or chip secure boot) and a TPM 2.0, switched on as shipped? | PCs in the first-choice group list a TPM 2.0 (the CL260 a module, the ThinkEdge a chip of its own, the Protectli as an option). The ThinkEdge's specification lists Secure Boot; for the CL260 and Protectli it was not stated. **The package does not use the TPM** and does not switch on Secure Boot: that is a set-up screen on the computer | Depends on the computer you buy; Yours |
| H4 | Can firmware be updated in the field, signed, and can we check its version? | The maker's own firmware update tools; the review did not research each maker's. The package does not touch firmware | Depends on the computer you buy |
| H5 | Which ports are open to someone standing next to it? Can unused ones be disabled? | The computer's own ports. The service itself may open only USB device files (the sticks) and USB serial ports, and no disks, memory, sound card or screen (`DevicePolicy=closed`). The package loads two USB serial drivers at start-up for serial receivers | Depends on the computer you buy; Yours (disabling ports in firmware) |
| H6 | Is storage encrypted? What is on it if stolen? | The package does not encrypt the disk. On it: the ingest token in plain text (mode 0600), a password hash, public readings and the station's name and place. Full-disk encryption with the TPM is the operating system's, and can be switched on by the organisation | Depends on the operating system you install; Yours |
| H7 | Radios we did not ask for (Wi-Fi, Bluetooth, mobile modem)? | The package's Wi-Fi hotspot is **off** in both profiles, Whether the computer has Wi-Fi or Bluetooth hardware is the maker's; it can be disabled in firmware | Depends on the computer you buy |
| H8 | Is the unit delivered genuine and untampered? | The seller's and the organisation's supply-chain process. The project can show that the **software** is the signed release: `open-alert-base audit` compares every agent file with it | Yours (hardware); Done (software check) |
| H9 | Is there a second source, and are spares held? | Any 64-bit Debian 13 or Ubuntu 24.04 computer takes the same package, so a replacement need not be the same make. The radio stick is a replaceable USB part (the RTL-SDR Blog V4 is end of line, the V3 is sold in Australia: [R10](../hardware-review/research/R10-custom-hardware-and-sdr.md)) | Partly (spares are yours) |
| H10 | Compliance mark; fits our equipment room (power, temperature, mounting)? | Per computer: the review records power input, temperature range, fan and mounting for each ([comparison.md](../hardware-review/comparison.md)) | Depends on the computer you buy |
| H11 | How is it wiped and disposed of? | `sudo apt purge open-alert-base` deletes the settings, the data and the agent's user (tested). Wipe the disk by the organisation's own procedure, and ask Flood-Net to revoke the base station's token | Done (software); Yours |

## The operating system (O)

| # | Question | Answer | Status |
|---|---|---|---|
| O1 | Which operating system and version? | The package is made for **Debian 13 and Ubuntu 24.04**, x86-64 and 64-bit ARM (ARM untested). Debian 12 installs it, but its `rtl-sdr` is too old to know the RTL-SDR Blog V4 stick, so it is not a target | Depends on the operating system you install |
| O2 | Who patches it, how fast, until when? | The operating system's maker. Node.js, `rtl-sdr`, `ca-certificates` and `nftables` all come from the operating system's own packages; **nothing comes from npm or anywhere else**, so those patches arrive with the operating system's. **Which system matters:** on Ubuntu 24.04, Node.js and `rtl-sdr` come from Ubuntu's "universe" section, which Canonical patches only under its paid Ubuntu Pro service; on Debian 13 they are covered by Debian's own security team to August 2028 ([R3](../hardware-review/research/R3-os-firmware-strategy.md)). Ubuntu LTS has a paid ten-year service; Debian's is by its community ([R4](../hardware-review/research/R4-au-gov-it-security.md) section 4.2) | Depends on the operating system you install; Yours |
| O3 | Hardened to a published benchmark? | CIS benchmarks exist for Ubuntu and for Debian 12 and 13 ([R4](../hardware-review/research/R4-au-gov-it-security.md)). Scanning a machine against one is the organisation's. The package's own service is hardened separately: systemd's exposure score is **1.7** out of 10 (enterprise) | Depends on the operating system you install; Yours |
| O4 | Default accounts or passwords? | **None are created.** The service's user, `rpi-alert`, is a system account with no password and no login shell. The package adds no maintenance account and no sudo rule. The dashboard's password is made at the first start, on that computer, and is different on every computer (see "The three basics" below) | Done |
| O5 | What is installed and listening? | `sudo open-alert-base audit` prints it on one page. In the enterprise profile one thing listens: the dashboard, TCP 8080, this computer only ([overview.md](overview.md)) | Done |
| O6 | Does our endpoint agent and scanner support it? | That is a question about the operating system. As [R4](../hardware-review/research/R4-au-gov-it-security.md) read the vendors' lists on 11 November 2026: Microsoft Defender for Endpoint lists Ubuntu and Debian; Tenable Agent lists both on x86-64, but not Debian on 64-bit ARM. The package is not an operating system and is on no vendor's list of its own | Depends on the operating system you install |
| O7 | Can only approved programs run? | **Not yet** enforced by anything the package ships. Application allow-listing is the organisation's. What the package does: the service may make only the system calls and open the devices it needs | Not yet; Yours |
| O8 | Does it send security events to our log collector, with correct time? | The agent writes to the system journal; **there is no forwarding in RPi ALERT**. The operating system's own journal forwarding, `rsyslog` or `systemd-journal-upload` carries it. The package leaves the journal's size alone. The clock is the operating system's: point it at your time server; the agent holds readings back until it trusts the clock | Depends on the operating system you install; Yours |
| O9 | If containers are used: why, how hardened, any with full privileges? | The native package uses **no container**. The container form (for Torizon and container hosts) is new: as at 13 November 2026 it has been tried on one PC with stand-ins for the radio stick, and never on Torizon OS, on an ARM computer or with a real stick. It is a container with no privileges, no capabilities and a read-only root. RPi ALERT's signed release has been started in such a container with no radio attached, and its dashboard answered ([U1](../hardware-review/research/U1-rpi-alert-portability.md) 8b); whether a radio stick can be opened that way is untested. No privileged container is proposed | Partly (the container has been tried on one PC only) |

## The application (A)

| # | Question | Answer | Status |
|---|---|---|---|
| A1 | Runs as an unprivileged user? What needs root? | It runs as `rpi-alert`. Root is used only by the package's install scripts and, in the enterprise profile, by a short-lived service that loads the firewall lock (one capability, `CAP_NET_ADMIN`). **There is no root helper**: the agent is pointed at a path where nothing exists, so it can ask root for nothing. The service holds no capabilities in the enterprise profile | Done |
| A2 | A software bill of materials? | What is inside, in words: RPi ALERT's own JavaScript (about 11,500 lines) and decoders copied from the Flood-Net repository at a named commit (about 6,300 lines), the operating system's `nodejs`, `rtl-sdr`, `ca-certificates`, `adduser` and optionally `nftables`. **No npm packages** ([U1](../hardware-review/research/U1-rpi-alert-portability.md) 6.12). The pin (`firmware/PIN`) and a SHA-256 of every agent file are installed with the package. A machine-readable bill of materials (SPDX or CycloneDX) is **not yet** produced | Partly |
| A3 | How are updates delivered, signed, verified? Can we hold and schedule them? | A new agent version arrives as a new version of the package, built from the next **signed** RPi ALERT release. The build refuses the release unless five checks pass: the key's fingerprint, the file's SHA-256, its Ed25519 signature, that it holds only plain files inside one folder, and that the agent inside says it is the pinned version. It re-checks every file after packing. There is **no self-updater**, so you hold and schedule updates by when you install. The **package itself is not yet signed** and there is no package repository, because no release has been made | Partly |
| A4 | Where do we report a flaw, and how fast do you answer? A `security.txt`? | [SECURITY.md](../../SECURITY.md): GitHub's private reporting, once the owner has switched it on. Response times are a proposal in [support.md](support.md). A `security.txt` for the project's web pages: **not yet** | Partly |
| A5 | What does it connect to, on which ports, with which TLS? | The table in [overview.md](overview.md): HTTPS (443) out to Flood-Net and a station list, nothing else in normal operation. Node.js's own TLS defaults apply; the project has not separately specified or tested versions and ciphers | Partly |
| A6 | Does it accept commands from the cloud service? Can it be turned off? Logged? | In the enterprise profile Flood-Net's mode is `report`: it is told how the base station is, and **every request is refused**. `rpi-alert remote off` stops even the check-in. Only the computer itself can change that setting. Flood-Net requests are logged | Done |
| A7 | A local web page or API? Who reaches it, with what sign-in? | The dashboard, on 8080, **this computer only**: by the firewall lock today, and by `web.bind` once the package moves to RPi ALERT 0.24. It is plain HTTP. It has a password, but anybody logged in on the computer itself is treated as the administrator, and a few read-only pages (status without location or addresses, recent readings) answer without a login in 0.23.1. `web.requireLogin` (everything behind a password) arrives with 0.24. **Dashboard logins are not logged** | Partly |
| A8 | What secrets are stored, how, what can a thief do with one? | The ingest token and the dashboard password hash, in `/etc/rpi-alert/config.json`, mode 0600, owned by `rpi-alert`. The token is plain text; **there is no encryption at rest and no use of the TPM**. A stolen token lets someone post readings as that base station ("a credential for the whole network's write access", in RPi ALERT's own words) until Flood-Net revokes it | Partly |
| A9 | Independent security review or penetration test? A threat model? | **Not yet.** RPi ALERT's code cites an earlier internal "2026-10 security appraisal" by finding number and shows the fixes; the appraisal itself was not found in the repositories read. No outside party has tested the package, and there is no written threat model | Not yet |
| A10 | What happens when the link is down? | The agent queues readings and sends them when it can (the queue is part of its status). It also holds readings back until it trusts the clock. How the queue behaves through a long outage has not been tested in this repository | Partly |
| A11 | What data does it send? Any personal information? | Public rainfall and river-level readings, the frames heard, and the base station's own status ([overview.md](overview.md)). No personal information; no landholder details. The check-in carries network addresses and software versions unless it is turned off | Done |

## The network set-up (N)

| # | Question | Answer | Status |
|---|---|---|---|
| N1 | A diagram of where it sits and every connection. | The text drawing and tables in [overview.md](overview.md) | Done |
| N2 | Outbound only? To which named hosts? Nothing inbound? | Outbound HTTPS only; no inbound path; the hosts are listed in [U1](../hardware-review/research/U1-rpi-alert-portability.md) 6.3. The dashboard is not reachable from other computers | Done |
| N3 | Does it work through our web proxy and TLS inspection? | Yes: name the proxy in `/etc/open-alert-base/env`; a private certificate authority is added the usual way (`update-ca-certificates`). Tested against a proxy written for the test, with and without a password and with a private authority, on the system's own Node.js and on Node.js 22.23. **Not tested** against a commercial proxy or a real inspecting network, and it cannot do NTLM or Kerberos sign-in | Partly |
| N4 | Which segment, and what can it reach from there? | The organisation's choice. [R4](../hardware-review/research/R4-au-gov-it-security.md) section 6 sets out three placements: on its own mobile link off your network, in a screened zone with outbound HTTPS only, or on the main network. The first two shrink the approval most | Yours |
| N5 | Can it authenticate to our switch port (802.1X)? | Not something the package provides. It is the operating system's (`wpa_supplicant` on Debian and Ubuntu); not tested here | Depends on the operating system you install |
| N6 | Does it use our DNS and time servers? | It uses whatever the operating system is set to | Yours |
| N7 | If it has its own mobile link, is there a second path to our network? | The package creates none; its one sharing feature, the hotspot, is off. Whether the operating system forwards traffic between interfaces is the operating system's setting and was not separately checked | Partly |

## Operations (P)

| # | Question | Answer | Status |
|---|---|---|---|
| P1 | Who is the system owner on our side; is it on the registers? | Yours | Yours |
| P2 | Who administers it, from where, with what sign-in? | The package adds no remote login of any kind. SSH and accounts are the operating system's | Yours |
| P3 | How do we know a patch was applied? | `open-alert-base version` (package, agent, the signed release it came from, Node.js), `dpkg --verify open-alert-base`, and `open-alert-base audit` (every agent file against the signed release) | Done |
| P4 | Who watches its logs and alerts? | Yours; see O8 | Yours |
| P5 | What if it is compromised: isolate, rebuild from a known image? | Isolate by the network. Rebuild by reinstalling the operating system and the package. Ready-made disk images are **not yet** built | Partly; Yours |
| P6 | Is its configuration backed up, and can a replacement be built from it? | The configuration is two small files: `/etc/rpi-alert/config.json` and `/etc/open-alert-base/env`. The profile is applied from the package. Backing them up is yours; the ingest token is a secret | Yours |
| P7 | Who has physical access to the room? | Yours | Yours |
| P8 | Annual review of the authorisation. | Yours | Yours |

## The supplier (S)

| # | Question | Answer | Status |
|---|---|---|---|
| S1 | Who are you (legal entity, country, owners)? | open-ALERT is an open-source project in the `cdomotor-g` GitHub account (MIT licence). **A statement of legal entity, country and owners is not yet written**: the owner must supply it, and this pack names no person | Not yet |
| S2 | Who are your suppliers? | RPi ALERT (the program, same GitHub account), the operating-system maker and the computer's maker (the organisation's choice), and Flood-Net's hosting, which the Flood-Net project should document. Build tooling is GitHub | Partly |
| S3 | What shows your commitment to security? | The release is signed and checked before use; the build is repeatable (byte-identical twice); the package's own checks pass on Debian 13 and Ubuntu 24.04 (760 passed, none failed, 2 skipped in the last whole run as at 13 November 2026: `firmware/README.md` is always the current word); the service is sandboxed to a systemd exposure score of 1.7; a flaw-reporting route ([SECURITY.md](../../SECURITY.md)). **No ISO 27001 or similar certificate, no past advisories, no independent review** | Partly |
| S4 | A written split of who does what. | [shared-responsibility.md](shared-responsibility.md) | Done (draft) |
| S5 | Support period with an end date; what if you stop? | A proposal, not yet confirmed: [support.md](support.md). If the project stops, the package is a set of plain files: the organisation holds the last version, and the agent is MIT-licensed | Not yet (proposal) |
| S6 | Will you tell us about a breach of your systems (the cloud service, the signing key, the repository)? | **Not yet** promised. Proposed: a security advisory on GitHub and, for named customers, direct notice | Not yet |
| S7 | Where is the cloud service hosted and who can reach our device from it? | Nobody can reach the device from it: the base station calls out, and in the enterprise profile Flood-Net can change nothing. Where Flood-Net is hosted is for the Flood-Net project to state | Partly |
| S8 | Commonwealth only: will you accept the cyber-risk and foreign-ownership clauses? | **Not yet answered.** A decision for the owner | Not yet |

## The three basics for any internet-connected device

Australia's smart-device rules (from 4 March 2026) cover consumer products and, in the review's
judgement, **not** this one ([R4](../hardware-review/research/R4-au-gov-it-security.md)). Their
three requirements are nonetheless the floor a buyer now expects, so here they are as they apply.

1. **No shared default password.** The package sets none. The service's account has no
   password and no login shell, and there is no maintenance account. The dashboard's password is
   made at the first start on each computer, at random (ten characters), and kept in
   `/var/lib/rpi-alert/web-password.txt` (mode 0600), shown only to someone on the computer
   itself, until somebody sets their own; the shortest password the dashboard accepts is six
   characters (RPi ALERT 0.23.1). A fresh machine therefore never shares a password with
   another. **Honest limit:** the first password sits in a file in plain text until it is
   changed, and in the enterprise profile the dashboard is reached from the computer itself,
   where any local user is already treated as administrator.
2. **A way to report a flaw.** [SECURITY.md](../../SECURITY.md). It depends on the owner
   switching on private reporting in the repository's settings: **not yet confirmed as done.**
3. **A stated support period.** [support.md](support.md), as a proposal for the owner to confirm:
   **not yet a commitment.**
