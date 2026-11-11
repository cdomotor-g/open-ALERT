# R3 — Operating system and firmware route for a non-Pi ALERT base station

Read and written 2026-11-11. Every price and version below was read on that date.

**How to read the labels.** Each fact carries one of:
- **fetched** — I opened the page (or downloaded the PDF and read its text) and the quoted words or figure are on it.
- **snippet** — search-result text only; I did not open the page.
- **memory** — not checked; a lead only.
- **sibling** — found by another agent in this same piece of work (reports `R1-toradex-verdin-mallow.md` and `U1-rpi-alert-portability.md` beside this file); I did not re-open the source.
- **my assessment** — reasoning from the fetched facts, not a quotation.

**Hosts that refused automated reading (not worked around):** `layers.openembedded.org` (HTTP 403), `git.yoctoproject.org` (HTTP 403), `www.cyber.gov.au` (HTTP 503, twice). Where the same fact was on a page that allows reading (GitHub, docs.yoctoproject.org) I used that and say so.

---

## 1. The conclusions that should change a decision

1. **The CPU worry about containers is unfounded; the plan's real costs are elsewhere.** Measured CPU cost of Docker against native is 0–4% on a server (IBM: Linpack 290.8 against 290.9 GFLOPS) and 2.67% on a Raspberry Pi 2. What a container does cost is memory (about 113 MB for Docker's two background programs on a Pi 3B+, plus about 11 MB per container), disk (about 163 MB of engine packages plus a second copy of Debian and Node), a **second stream of security patches** (the Debian inside the container is not patched by Torizon's updates), and security-review friction from `--privileged`. Section 2.5.
2. **Torizon OS is free and open, but it is a Toradex-hardware route, not a many-hardware route.** "Production-ready" is said only of Toradex modules. For a generic x86 box Toradex's own page says "this workflow is not validated". BeaglePlay was only ever in the community "Common Torizon" fork, whose repository was archived on 19 Nov 2025. Section 2.2.
3. **Toradex does not support native Debian on a Verdin.** A Toradex staff member wrote on 11 Jun 2026: "It is neither supported nor recommended." So "Verdin AM62" means Torizon (containers, or a custom Yocto build) — never plain Debian with a vendor behind it. Section 3.1.
4. **Generic x86-64 with UEFI is the only hardware family where the whole stack — boot loader, kernel, Node.js, rtl-sdr — comes signed and security-patched from the distribution itself**, with Secure Boot working as installed, a TPM for disk encryption, a CIS benchmark, and (on Ubuntu) certified boxes and a paid 10–15 year patch plan. Every ARM route uses a board vendor's kernel that the Debian or Ubuntu security teams do not patch. Sections 3 and 6.
5. **Debian 13 is the right base today.** It has Node.js 20.19.2 and rtl-sdr 2.0.2 (which knows the RTL-SDR Blog V4), with security support to 9 Aug 2028 and long-term support to 30 Jun 2030. Debian 12 left regular security support in mid-2026 and its rtl-sdr (0.6.0) does not know the V4. Ubuntu 22.04 has Node 12 — too old. Ubuntu 24.04 works (Node 18.19.1, rtl-sdr 2.0.1) but both packages are in "universe", which Canonical patches only under Ubuntu Pro. Section 3.4.
6. **No distribution's packaged librtlsdr can be relied on for the radio any more.** The Blog V4 is end-of-life; its replacement, the V4L, uses a different tuner chip (R828S) that released distribution packages do not yet drive. The appliance has to ship its own pinned librtlsdr on every route. Section 3.4.
7. **BeaglePlay can never have secure boot** ("BeaglePlay uses GP silicon, so not supported" — BeagleBoard.org's maintainer). A TI AM62 board needs "HS-FS" silicon and a one-way key-fusing step; Toradex said on 10 Nov 2026 that this is "still an Early Access feature" on Torizon. On x86 it is a firmware setting. Section 6.
8. **A Yocto image of our own is technically possible but makes a one-person project the operating-system vendor.** Recipes exist (Node.js 22.23.4 on the current long-term release; rtl-sdr only in a third-party layer), software bills of materials and CVE checks are built in, and the current long-term release runs to April 2030. The Yocto Project itself lists "Steep Learning Curve" first among its drawbacks. Leave it for later. Section 4.
9. **Recommended shape: one package, three wrappers.** Ship the agent as a signed Debian package from a signed package repository (Debian 13 first); wrap the same package as an unprivileged container image for hosts whose operating system is fixed (Torizon on a Verdin); and publish recipe-built reference images per hardware family. Section 8.

---

## 2. Route (a): Torizon OS plus a container

### 2.1 Licence and cost

| Item | What the page says | Basis and source |
|---|---|---|
| Torizon OS licence | "Torizon OS is free and open source"; "Fully Open Source - no lock-in"; "Always FREE / Unlimited Devices" | fetched, <https://www.torizon.io/pricing> |
| Source availability | "All of the source code needed to build Torizon OS is publicly available and licensed under a free modifiable license." "The only proprietary pieces included are from the SoC vendor" | fetched, <https://developer.toradex.com/torizon/torizoncore/torizon-frequently-asked-questions-faq> |
| Torizon Cloud — Maker | "Always FREE", at most "5 Devices"; community support; remote updates; fleet monitoring | fetched, <https://www.torizon.io/pricing> |
| Torizon Cloud — Developer | "$249" a month or "$2,500" a year for "50 Devices"; adds remote access, API access, offline updates, scheduled updates | fetched, same page. The page shows "$" without naming the currency; no tax stated |
| Torizon Cloud — Professional | Quote only. "As low as $0.30/month per device*" — "*Depending on Volume" | fetched, same page |
| Torizon Cloud — Enterprise | Custom; private cloud or on-premise | fetched, same page |
| What is charged | Provisioning is free; charges start when cloud features (updates, monitoring, remote access) are used | fetched, same page (FAQ) |
| Vulnerability Manager | "continuously monitors the Torizon OS for vulnerabilities, provides expert analysis of each CVE, and delivers actionable outputs like VEX files and patched OS builds"; "By default, Torizon Vulnerability Manager focuses on the operating system." No price shown; the linked developer page is titled "(Beta)" | fetched, <https://www.torizon.io/vulnerability-manager> |

**My assessment.** For a fleet of 6–50 base stations the list price is "$2,500" a year. I have not converted it to Australian dollars because the page does not name the currency (US dollars is the likely reading) and shows no tax. The operating system itself costs nothing. What I could not confirm is how a fleet is kept patched *without* paying for the cloud: "offline updates" are listed under the paid Developer plan (section 9).

### 2.2 Which hardware it supports

| Hardware | Toradex's wording | Basis and source |
|---|---|---|
| Toradex modules (Verdin AM62, AM62P, iMX8M Plus, iMX95; Luna SL1680; others) | "Fully integrated and tested, with priority support. Production-ready." | fetched, <https://developer.toradex.com/torizon/torizoncore/supported-hardware/> |
| Small-memory modules | "Only modules with at least 1 GB of RAM support Torizon OS with containers." (smaller ones get the Yocto Reference Minimal image) | fetched, same page |
| TI boards | SK-AM62, SK-AM62P-LP, TMDS62LEVM (AM62L), BeagleY AI. Images from the Toradex Download Center. **BeaglePlay is not listed.** No support level stated | fetched, <https://developer.toradex.com/torizon/torizoncore/supported-hardware/supported-hardware-ti> |
| NXP boards | Only the FRDM i.MX 93, from an "Engineering Pre-Release" package source. No i.MX 8M Plus EVK | fetched, <https://developer.toradex.com/torizon/torizoncore/supported-hardware/supported-hardware-nxp> |
| x86-64 | "Torizon OS supports any x86-64 based device." Ready-made images for VirtualBox and QEMU: "validated instructions for VirtualBox and QEMU". For a real x86 board, write the image with `dd`: "this workflow is not validated." | fetched, <https://developer.toradex.com/torizon/torizoncore/supported-hardware/supported-hardware-x86> |
| Raspberry Pi, BeaglePlay, BeagleBone Black, RISC-V, x86 (community) | "Common Torizon": "This derivative work have not been reviewed or approved by Toradex." "This software is provided experimentally as-is." The repository "was archived by the owner on Nov 19, 2025. It is now read-only." | fetched, <https://github.com/commontorizon/meta-common-torizon> |
| A device already running Debian or Ubuntu | "Torizon Connector is a lightweight integration that connects Debian and Ubuntu-based devices to Torizon Cloud." It gives application updates, remote access and monitoring — but the comparison tables mark operating-system updates, provisioning at scale, secure boot with a full chain of trust, encryption and OP-TEE as **not** available on this path | fetched, <https://www.torizon.io/torizon-on-debian-ubuntu> and <https://www.torizon.io/supported-hardware/x86> |

**My assessment.** If the goal is one operating system across TI, NXP, Beagle and x86 hardware with a vendor standing behind it, Torizon OS does not deliver that: the vendor-backed tier is Toradex's own modules.

### 2.3 Releases, kernels and end dates

| Series | Built from | Kernel on AM62 / i.MX 8M Plus | State | Projected end | Basis and source |
|---|---|---|---|---|---|
| Torizon OS / BSP 6 | Yocto 4.0 "Kirkstone" | 6.1.175 (TI 09.03.06) / 5.15.209 (in 6.8.9, 07/2026) | "Maintenance" | 2026 | fetched, <https://developer.toradex.com/software/toradex-embedded-software/embedded-linux-release-matrix/> and <https://developer.toradex.com/software/toradex-embedded-software/toradex-embedded-linux-support-strategy/> |
| Torizon OS / BSP 7 | Yocto 5.0 "Scarthgap" | 6.6.142 (TI 10.01.10) / 6.6.142 (NXP L6.6.52_2.2.2) (in 7.7.0, 07/2026) | "Active", quarterly releases | 2028 | fetched, same two pages |
| BSP 8 | not stated | not stated | "Coming Soon", first release November 2026, monthly | 2030 | fetched, support-strategy page (the page says the table does not set Torizon OS 8 dates) |
| After the end date | "Toradex offers extended support period as a service." Extended end: "Contact us" | | | | fetched, support-strategy page |
| Upstream kernel end dates | 5.15: Dec 2026. 6.1: Dec 2027. 6.6: Dec 2027. 6.12: Dec 2028. 6.18: Dec 2028 | | | | fetched, <https://www.kernel.org/category/releases.html> |

The series 7 kernel (6.6) reaches its upstream end in December 2027, a year before Toradex's projected 2028 end for series 7. Toradex's page says component updates (boot loader, kernel, Yocto parts) are typically maintained for 2 to 3 years (fetched, support-strategy page; my paraphrase).

### 2.4 Security features

| Feature | What Toradex says | Basis and source |
|---|---|---|
| Updates | Remote or offline (USB stick); "Based on the Uptane Framework"; "protected from power cuts or unreliable connections" | fetched, <https://www.torizon.io/torizon-os> |
| How updates are stored | "OSTree is a technology used by Torizon OS to deliver bootable filesystem trees to a device." "Torizon OS mounts its rootfs as read-only". "OSTree preserves /etc and /var during upgrades" | fetched, <https://developer.toradex.com/torizon/torizoncore/torizoncore-technical-overview/> |
| Secure boot | Three levels: bootloader only; bootloader plus kernel; and an extended chain covering "most of the root filesystem but it still does not cover container images". Authentication of container images is listed as planned, not yet available | fetched, <https://developer.toradex.com/torizon/security/secure-boot-on-torizoncore/> |
| Secure boot on AM62 | Needs an "HS" chip and a one-way fuse step with TI's key writer: "programming OTP (One-time Programmable) fuses is an irreversible process" | fetched, <https://developer.toradex.com/torizon/security/secure-boot-on-am62> |
| Maturity on AM62 | "Secure boot on Torizon OS is still an Early Access feature." "Fusing through an update or at scale is not available yet for AM62." (Toradex staff, 10 Nov 2026) | sibling (R1, section 8) |
| Disk encryption | "Encryption isn't in the scope of Secure Boot as a mandatory component." A separate encrypted data partition can use CAAM, a TPM or OP-TEE; CAAM is "not present on TI SoCs (AM6x)" | fetched, secure-boot-on-torizoncore page |
| Bill of materials | The OS includes "Secure Boot and SBOM generation" | fetched, <https://www.torizon.io/torizon-os> |
| CVE tracking | Vulnerability Manager (section 2.1): operating system only by default; beta | fetched, <https://www.torizon.io/vulnerability-manager> |
| Certification of the maker | ISO/IEC 27001:2022 badge shown | fetched, <https://www.torizon.io/torizon-os> |

**My assessment — the gap that matters to an IT reviewer.** In the proposed plan the *application* (Node.js, librtlsdr, the agent) lives in a Debian container. Torizon's signed boot chain, its bill of materials and its Vulnerability Manager all stop at the host operating system. The container is a second small Debian system that someone must rebuild and redeploy each time Debian publishes a fix for Node.js or OpenSSL. That is two patch streams and two bills of materials for one box.

### 2.5 What a container really costs — measurements

| Resource | Measurement | Where and when | Basis and source |
|---|---|---|---|
| CPU (number crunching) | Linpack: native 290.8 GFLOPS, Docker 290.9 ("-0%"). Compression (PXZ): 76.2 against 73.5 MB/s ("-4%"). Memory bandwidth (Stream): "-0%" on all four tests | Two-socket x86 server, Docker 1.0, IBM Research report RC25482, 21 Jul 2014 | fetched (PDF read as text), <https://www.read.seas.harvard.edu/~kohler/class/cs260r-s19/containerperf14.pdf> |
| CPU, authors' conclusion | "both KVM and Docker introduce negligible overhead for CPU and memory performance (except in extreme cases). For I/O-intensive workloads, both forms of virtualization should be used carefully." | same | fetched, same PDF |
| CPU on a small ARM board | Docker "engine introduces a negligible impact on the CPU performance, with a percentage difference in the order of 2.67%". Memory copy test: at most 6.04%. Random disk input/output: "roughly 10%" | Raspberry Pi 2, Docker 1.8.0, 2016 | fetched (PDF read as text), <https://arxiv.org/pdf/1603.02955> |
| Network | "Containers that do not use NAT have identical performance to native Linux." "NAT, as used in Docker, doubles latency in this test." | IBM report | fetched, same IBM PDF |
| Memory — Docker's background programs | dockerd 72 MB + containerd 41 MB = 113 MB at cold start; about 11 MB more for the per-container helper | Raspberry Pi 3B+, Armbian 26.2.1 (Debian 13), a developer's blog post dated 1 Mar 2026. One person's measurement, not a study | fetched, <https://dev.to/gounthar/running-100-wasm-containers-on-a-raspberry-pi-with-903-mb-of-ram-36mf> |
| Memory — the agent itself in a container | "23 MB of memory idle" (Debian 13 container, all privileges dropped) | measured in this piece of work | sibling (U1, sections 1 and 8b) |
| Memory — Toradex's own floor | "Only modules with at least 1 GB of RAM support Torizon OS with containers." | | fetched, <https://developer.toradex.com/torizon/torizoncore/supported-hardware/> |
| Disk — the engine | Debian 13 arm64 packages, installed size: docker.io 70,232 kB; containerd 82,678 kB; runc 9,914 kB — about 163 MB | Debian's own package pages | fetched, <https://packages.debian.org/trixie/arm64/docker.io>, <https://packages.debian.org/trixie/arm64/containerd>, <https://packages.debian.org/trixie/arm64/runc> |
| Disk — the image | `debian:trixie-slim` for arm64: 30,214,037 bytes as stored on Docker Hub (compressed), pushed 5 Nov 2026; plus Node.js (nodejs 2,408 kB + libnode115 49,444 kB installed) | | fetched, <https://hub.docker.com/v2/repositories/library/debian/tags/trixie-slim>, <https://packages.debian.org/trixie/arm64/nodejs>, <https://packages.debian.org/trixie/arm64/libnode115> |
| A newer Pi study, set aside | A 2025 paper on a Pi 3B+ says Docker adds "0.56%" CPU latency in its text while its own table shows 134 s against 95 s. The paper contradicts itself, so I do not rely on it | | fetched, <https://arxiv.org/html/2505.02082v2> |
| Toradex's own statement | Containers "share the same kernel, allowing performance to match native applications." "There is some storage/memory overhead, however, with some library duplication" | | fetched, Torizon FAQ (URL in 2.1) |

**Verdict on the owner's worry.**
- *"Burning headroom on compute"* — **not supported by the evidence.** The decoder is number crunching in worker threads fed by a pipe from `rtl_sdr`; a container runs those as ordinary processes on the same kernel. Measured cost: 0–4%. Use host networking (`--network host`), as the trial recipe already does, and the network cost is nil too.
- *"A lot of overhead"* — **right in three other senses.** (1) Memory: roughly 110–140 MB that a native install does not spend; that is 6–7% of a 2 GB module and matters only on 1 GB parts. (2) Disk: roughly 250–350 MB (engine, base image, second Node.js), small against 8–16 GB of eMMC but not nothing on a 4 GB part. (3) Upkeep and review: two operating systems to patch, a container the secure-boot chain does not cover, and a `--privileged` flag to explain. The third is the real cost. *(my assessment, from the rows above)*

### 2.6 Passing a USB radio to a container without `--privileged`

What the trial page tells people to run today (fetched from the repository, `open-ALERT/site/trial.html` lines 150–166): an image built `FROM debian:trixie-slim` that does `git clone --depth 1 https://github.com/cdomotor-g/RPi_ALERT` (the tip of the main branch, not a signed release), started with `--privileged --network host -v /dev/bus/usb:/dev/bus/usb`, running as root.

| Point | Words from the primary source | Basis and source |
|---|---|---|
| What `--privileged` does | "Enables all Linux kernel capabilities", "Disables the default seccomp profile", "Grants access to all host devices". "A container with `--privileged` is not a securely sandboxed process." "Containers in this mode can get a root shell on the host" | fetched, <https://docs.docker.com/reference/cli/docker/container/run/> |
| The narrower tool | `--device-cgroup-rule`: "Add a rule to the cgroup allowed devices list". Example: `docker run -d --device-cgroup-rule='c 42:* rmw' --name my-container my-image`. "You still need to explicitly add initially present devices" | fetched, same page |
| Why a rule, not `--device` | "Docker assigns devices available to a container at creation time." `--device` "cannot be safely used with ephemeral devices" — a USB stick that is unplugged and replugged gets a new device file | fetched, same page |
| The number to allow | `#define USB_DEVICE_MAJOR 189` — the kernel's number for the files under `/dev/bus/usb` | fetched, <https://github.com/torvalds/linux/blob/master/include/linux/usb.h> |
| Toradex's stance | "granular permissions to hardware make your system more secure." Example: `docker run --device /dev/gpiochip0 torizon/debian:$CT_TAG_DEBIAN` | fetched, <https://developer.toradex.com/torizon/application-development/working-with-containers/run-and-manage-containers-with-the-command-line-on-torizon/> |

So the unprivileged form is: mount `/dev/bus/usb`, add `--device-cgroup-rule='c 189:* rmw'`, run as an ordinary user that belongs to the group owning those files, `--cap-drop ALL`, `--read-only`. The sibling report U1 ran the agent that way (without a stick — that machine has no USB) and it started and served its dashboard. **Still to be proved on hardware:** that `rtl_sdr` opens the stick under that rule alone, including after an unplug and replug. One host-side job stays outside any container: the kernel's TV-tuner driver must be blocked on the host so it does not claim the stick (sibling, U1 section 7.4).

### 2.7 May software run natively on Torizon OS?

| Point | Words | Basis and source |
|---|---|---|
| The standard image | "There is no software package management in the base system." "Application development is normally implemented inside Docker containers." | fetched, <https://developer.toradex.com/torizon/torizoncore/torizoncore-technical-overview/> |
| Containers are not compulsory | "the use of containers is not strictly required when using Torizon." Toradex staff (30 Apr 2025) point to the Torizon OS Yocto Reference Minimal Image, which has no container support, with applications added to the host in the Yocto build | fetched, <https://community.toradex.com/t/torizon-as-a-layer-on-debian/27632/4> |
| Marketing page says the same | "Torizon OS is available with the Docker Runtime, or it's also possible to leave Docker away" | fetched, <https://www.torizon.io/torizon-os> |
| Custom update logic | "Subsystem Updates" let you "define your own update logic for whatever generic update you want to perform" | fetched, same community thread |

**My assessment.** "Native on Torizon" therefore means "a Yocto build of our own, using Toradex's layers" — which is route (c) with Toradex's update client added. It is not `apt install nodejs`.

---

## 3. Route (b): native Debian or Ubuntu on the hardware

### 3.1 Who supports Debian or Ubuntu on which hardware

| Hardware | Who provides it | What exists (as read) | Basis and source |
|---|---|---|---|
| TI SK-AM62B, SK-AM62-LP, SK-AM62-SIP, SK-AM62P, SK-AM64B | **Texas Instruments** | "Texas Instruments uses the **Armbian** build framework to generate Debian images for its platforms." Debian 13 (`RELEASE=trixie`); branches vendor, vendor-rt, vendor-edge, edge. Ready-made images on TI's SDK download page. BeaglePlay and Toradex modules are not in TI's board list | fetched, <https://software-dl.ti.com/processor-sdk-linux/esd/AM62X/12_00_00_07_04_Debian/exports/docs/debian/Building_Debian_Image.html> |
| TI SK-AM62B | Armbian | Support level "Standard"; maintainer named; vendor kernel 6.18.13; Debian 13 minimal image 342 MB (Armbian 26.8.4, built 13 Sep 2026); Ubuntu 26.04 too | fetched, <https://armbian.com/boards/sk-am62b> |
| BeaglePlay | Armbian | Support level "Standard"; vendor kernel 6.18.13; Debian 13 minimal (Armbian 26.8.1, built 9 Aug 2026) | fetched, <https://armbian.com/boards/beagleplay> |
| BeaglePlay | **BeagleBoard.org** | "BeaglePlay Debian 13.7 2026-10-09 IoT (v6.18.x-k3)" and an XFCE desktop one; U-Boot v2026.01-Beagle. No support period stated | fetched, <https://www.beagleboard.org/distros> |
| Toradex Verdin AM62 (and other Toradex modules) | **Nobody** | Native Debian: "It is neither supported nor recommended." Toradex suggests Torizon OS with a Debian container, or a partner (staff reply, 11 Jun 2026) | fetched, <https://community.toradex.com/t/debian-12-bookworm-on-verdin-am62-wi-fi-with-toradex-bsp-recommended-build-and-integration-method/30539> |
| NXP i.MX 8M Plus EVK and FRDM | **NXP** | "Debian Linux SDK", release LDLSDK_26.06 dated 26 Jun 2026: "Debian 13 RootFS updated", kernel "LTS 6.12.49". NXP's own description: "to provide quick evaluation for customers" | fetched (PDF read as text), <https://www.nxp.com/docs/en/release-note/RN00266.pdf> |
| NXP i.MX 8M Plus EVK (8MPLUSLPD4-EVK) | Canonical | Listed three times among Ubuntu-certified development boards. Which Ubuntu release: not shown in what I could read | fetched, <https://ubuntu.com/certified> (filtered by vendor) |
| Variscite modules (i.MX 8M Plus, AM62) | Variscite | A published Debian lifecycle: Debian 12 on i.MX with kernel 6.6.y and 6.12.49 "Active", projected end 2027 Q3; Debian 13 "Planned". AM62: Debian 12 "Legacy" (end 2026 Q2), Debian 13 "Planned". "The lifecycle dates shown below are estimates" | fetched, <https://dev.variscite.com/software-and-security/software-lifecycle/debian-lifecycle/> (the page counts modules per row but does not name them) |
| Generic x86-64 UEFI computer | **Debian and Canonical themselves** | Stock installer; distribution's own signed boot loader and kernel (section 6) | fetched, <https://wiki.debian.org/SecureBoot> |

**My assessment — who patches the kernel.** On every ARM row the kernel and boot loader come from the chip or board vendor (TI's 6.18 tree, NXP's 6.12 tree, a Beagle or Armbian package feed). Debian's security team patches the *rest* of the system through `apt`, but not that kernel. On x86 the kernel is Debian's or Ubuntu's own and arrives through the same security feed as everything else. A reviewer who asks "who issues your kernel fixes, and how fast?" gets a one-word answer only on x86.

### 3.2 Canonical's certified hardware and Ubuntu Pro

| Item | What the page says | Basis and source |
|---|---|---|
| Size of the IoT list | 145 results in the IoT category | fetched, <https://ubuntu.com/certified/iot> |
| ARM boards and makers in the list | NXP 8MPLUSLPD4-EVK; Raspberry Pi 3 A+/3 B/3 B+/4 B/400/5 B/Compute Module 4 Lite/Zero 2; MediaTek Genio G350, G510, G700, G1200 EVK; Renesas RZ/G and RZ/V; NVIDIA Jetson; Qualcomm; Thundercomm | fetched, same page and <https://ubuntu.com/certified> filtered by vendor |
| Not in the list | **Texas Instruments and BeagleBoard do not appear** in the vendor filter or results. I found no Canonical–TI Ubuntu image for the AM62 | fetched (absence on the filtered page); snippet (search) |
| x86 edge boxes in the list (examples) | OnLogic Helix 330 Fanless (Intel Celeron N6211) and Helix 401 Fanless (Core i7-1270PE); Lenovo ThinkEdge SE30 (Celeron 6305E, Core i3-1115GRE, Core i5-1145G7E), SE30n Gen 2, SE50, SE60n Gen 2; DFI ALF51 (Atom E3930), EC70A-KU, GHF51 (Ryzen R1606G); AAEON PICO-APL3 (Pentium N4200), UP Squared 6000 (Atom x6425RE); Advantech ARK-1551, EPC-S202 (Atom E3950), DS-410 (Celeron J6412), AIMB-218 (Celeron N6211); ADLINK MVP-5200/6200 | fetched, <https://ubuntu.com/certified/iot> and the vendor-filtered page |
| What certification demands | Certified devices run a Canonical kernel. "We require four units of every certified board or device for continuous testing." | fetched, <https://ubuntu.com/pricing/devices> |
| Ubuntu Pro — what it gives | "Expanded Security Maintenance (ESM) provides 10 years of vulnerability fixes for critical, high and selected medium vulnerabilities across the whole Ubuntu archive." Kernel Livepatch. FIPS 140, CIS and DISA-STIG hardening profiles. Landscape (fleet management). A Legacy add-on gives "an additional 5 years" | fetched, <https://ubuntu.com/pro> and <https://ubuntu.com/pricing/pro> |
| Ubuntu Pro — free tier | "Ubuntu Pro is and always will be free for personal use on up to 5 physical machines." | fetched, <https://ubuntu.com/pro> |
| Ubuntu Pro — list prices | Workstation $25 per machine per year; server $500 per machine per year; with round-the-clock support $300 (workstation), $1,775 or $3,400 (server); the Legacy add-on costs 50% more. "$" with no currency or tax named | fetched, <https://ubuntu.com/pricing/pro> |
| Ubuntu Pro **for Devices** — price | **Not published.** "can be purchased for a one-time fee per device"; "can be paid annually or as a one-time fee for up to 10 years"; "To access support for years 11-15, the Legacy add-on must be purchased." Contact Canonical. A reseller (Advantech) says the licence price depends on the CPU model | fetched, <https://ubuntu.com/pro/devices> and <https://ubuntu.com/pricing/devices>; snippet for Advantech |
| FIPS on 24.04 | "NIST-certified FIPS crypto-modules (pending for Ubuntu 24.04 LTS)" | fetched, <https://ubuntu.com/pricing/pro> |
| Canonical's engineering services | SmartStart "From $25,000" on the page as fetched (a search snippet of the same page read "From $50,000" — the figure may have changed or differ by region); consulting $2,400 per day; "Ubuntu Pro is not included" | fetched, <https://ubuntu.com/pricing/devices> |

### 3.3 Support end dates

| Release | Released | Regular security support ends | Long-term support ends | Paid extension ends | Basis and source |
|---|---|---|---|---|---|
| Debian 12 "bookworm" | 2023-06-10 | Mid-2026 — already over. The pages differ: debian.org's table reads 2026-07-11; Debian's wiki reads 2026-07-12, and its LTS page starts the LTS window on 2026-06-11 | 2028-06-30 (run by "a group of volunteers and companies", not Debian's security team) | 2033-06-30 (ELTS) | fetched, <https://www.debian.org/releases/>, <https://wiki.debian.org/DebianReleases>, <https://wiki.debian.org/LTS> |
| Debian 13 "trixie" | 2025-08-09 | 2028-08-09 | 2030-06-30 (architectures "to be determined") | 2035-06-30 | fetched, same pages |
| Debian 14 "forky" | no date set | — | — | — | fetched, <https://www.debian.org/releases/> |
| Ubuntu 22.04 LTS | Apr 2022 | May 2027 | — | May 2032 with Ubuntu Pro; May 2037 with the Legacy add-on | fetched, <https://ubuntu.com/about/release-cycle> |
| Ubuntu 24.04 LTS | Apr 2024 | May 2029 | — | May 2034; May 2039 | fetched, same page |
| Ubuntu 26.04 LTS | Apr 2026 | May 2031 | — | May 2036; May 2041 | fetched, same page |
| Ubuntu Core 24 / 26 | Jun 2024 / May 2026 | Jun 2034 / May 2036 ("Each release includes 10 years of security maintenance.") | — | Jun 2039 / May 2041 | fetched, <https://documentation.ubuntu.com/core/reference/support-duration/> |

"Debian LTS is not handled by the Debian Security and Release teams." (fetched, <https://wiki.debian.org/LTS>)

### 3.4 Packaged Node.js and rtl-sdr

| Release | `nodejs` | `rtl-sdr` | Knows the RTL-SDR Blog V4? | Notes |
|---|---|---|---|---|
| Debian 12 | 18.20.4+dfsg-1~deb12u3 | 0.6.0-4 | **No** (older than 2.0.0) | Node meets "18+". The installer already builds librtlsdr from source when the system one is too old |
| Debian 13 | 20.19.2+dfsg-1+deb13u3 | 2.0.2-2+b1 | **Yes** | Recommended base |
| Ubuntu 22.04 | 12.22.9~dfsg-1ubuntu3.6 (universe) | 0.6.0-4 (universe) | **No** | **Node too old** for the agent |
| Ubuntu 24.04 | 18.19.1+dfsg-6ubuntu5 (universe) | 2.0.1-2build1 (universe) | **Yes** | Works; both in universe |
| Ubuntu 26.04 | 22.22.1+dfsg+~cs22.19.15-1ubuntu1 (universe) | 2.0.2-2build1 (universe) | **Yes** | Newest Node of the stable set |
| Debian testing (forky) | 24.22.2+dfsg+~cs24.19.2-1 | 2.0.3-1 | Yes | Not a release yet |

Sources, all fetched: <https://packages.debian.org/search?keywords=nodejs&searchon=names&exact=1&suite=all&section=all>, <https://packages.debian.org/search?keywords=rtl-sdr&searchon=names&exact=1&suite=all&section=all>, <https://packages.ubuntu.com/search?keywords=nodejs&searchon=names&exact=1&suite=all&section=all>, <https://packages.ubuntu.com/search?keywords=rtl-sdr&searchon=names&exact=1&suite=all&section=all>.

Supporting facts:

| Point | Words | Basis and source |
|---|---|---|
| When the V4 went into the standard driver | On 2 Nov 2023 the Osmocom list noted "The last tagged version is from 2018" and "there were many changes since then including the recently added RTL-SDR V4 dongle support." Version 2.0.0 followed; a packager's changelog for 2.0.0 lists "Blog V4 support" | fetched, <https://lists.osmocom.org/hyperkitty/list/osmocom-sdr@lists.osmocom.org/thread/SQOKBREXAFUTFBPWVXKROFGCS6JHTPTR>; snippet for the 2.0.0 changelog |
| What a wrong driver does | "If you do not update or replace the drivers, then the V4 will simply not function correctly." "Either you will get no signals, or signals may appear at the wrong frequency, or appear corrupted in some way." | fetched, <https://www.rtl-sdr.com/V4/> |
| **The V4 is discontinued** | The V4 line "was recently made end-of-life" (the R828D tuner chip ran out). The replacement V4L uses the Rafael R828S. "The official upstream Osmocom drivers have V4L support." — but a reader reports it does not work on Raspberry Pi OS or Ubuntu 26.04 without compiling, and the maker replies that distributions "will take a while to update their packages" | fetched, <https://rtl-sdr.com/rtl-sdr-blog-v4l-lite-now-available-for-purchase> (post images dated Aug 2026) |
| Upstream Node.js status | v18: end-of-life (last update 27 Mar 2025). v20: end-of-life (24 Mar 2026). v22, v24, v26: LTS. The page says production applications should use only Active LTS or Maintenance LTS releases (my paraphrase) | fetched, <https://nodejs.org/en/about/previous-releases> |
| What RPi ALERT does now | `PKGS=(nodejs rtl-sdr …)` from `apt`; if the system librtlsdr does not know the V4 it removes it and builds `rtlsdrblog/rtl-sdr-blog` from the tip of that repository into `/usr/local` | fetched from the repository, `RPi_ALERT/os/install.sh` lines 95–130 |
| Universe and patches | Ubuntu Pro's security maintenance covers "the entire Ubuntu Archive (Main and Universe repositories)"; standard maintenance is described for Main | fetched, <https://ubuntu.com/pro> and <https://ubuntu.com/pricing/pro> |

**My assessment.**
- Debian 12's and Debian 13's Node.js are past their *upstream* end, but Debian's own security team still issues fixes for the Debian 13 package (its version string ends `deb13u3`, a third security update). On Ubuntu the Node.js package is in universe, so a reviewer will ask for Ubuntu Pro. The agent has no npm packages, which keeps this exposure small: the only thing to patch is the runtime.
- Because the V4L needs a newer driver than any stable release packages, "use the distribution's rtl-sdr" is no longer a safe assumption for new builds. Package a pinned librtlsdr (a small architecture-specific package beside the agent's own) rather than cloning a repository tip during installation — a reviewer will not accept "build whatever is on GitHub today, as root".

---

## 4. Route (c): a Yocto image of our own

| Item | Finding | Basis and source |
|---|---|---|
| Current releases | 6.1 "Blacksail", Sep 2026, stable until Apr 2027. **6.0 "Wrynose", Apr 2026, long-term until Apr 2030.** 5.0 "Scarthgap", Apr 2024, long-term until Apr 2028. 4.0 "Kirkstone": ended | fetched, <https://www.yoctoproject.org/development/releases/> (the page footer still says "Last updated: 2025-01-23") |
| What 6.0 contains | "The 6.0 (wrynose) release is the new LTS release after 5.0 (scarthgap)." "Linux kernel 6.18, gcc 15.2, glibc 2.43, LLVM 22.1.2" | fetched, <https://docs.yoctoproject.org/migration-guides/release-notes-6.0.html> |
| Bill of materials | On by default: the build system generates it "by inheriting the create-spdx class in INHERIT_DISTRO"; output `IMAGE-MACHINE.spdx.json`. In 6.0: "Support only SPDX 3 and removed SPDX 2.2 support." | fetched, <https://docs.yoctoproject.org/dev/dev-manual/sbom.html> and the 6.0 release notes |
| CVE checking | New `sbom-cve-check` class analyses an image after the build; "This also obsoletes the `cve-check` class." VEX statements controlled by `SPDX_INCLUDE_VEX` | fetched, 6.0 release notes |
| Node.js recipe | `nodejs_22.23.4.bb` on the wrynose branch; `nodejs_20.20.2.bb` on scarthgap (layer meta-openembedded, meta-oe) | fetched, <https://github.com/openembedded/meta-openembedded/tree/wrynose/meta-oe/recipes-devtools/nodejs> and `/tree/scarthgap/…` |
| rtl-sdr recipe | Not in meta-openembedded that I could find. `rtl-sdr_git.bb` is in the third-party layer **meta-sdr** (master branch seen). Search text says its master and walnascar branches build rtl-sdr 2.0.2 | fetched, <https://github.com/balister/meta-sdr/tree/master/recipes-support/rtlsdr>; snippet for the version |
| Hardware layers | meta-ti: default branch scarthgap (updated 4 Nov 2026), wrynose (6 Nov 2026). meta-freescale: scarthgap, wrynose, blacksail, master (all updated Nov 2026). Toradex's layers: BSP 7 on scarthgap (section 2.3). meta-intel: not checked | fetched, <https://github.com/TexasInstruments/meta-ti/branches>, <https://github.com/Freescale/meta-freescale/branches> |
| kas | "provides an easy mechanism to setup bitbake based projects" — one file names the layers, the machine and the settings | fetched, <https://kas.readthedocs.io/en/latest/intro.html> |
| Update tools | **RAUC**: "a lightweight update client"; signatures "based on x.509 certificates"; keys on hardware tokens; "Built-In HTTP(S) streaming support"; boot loaders GRUB, Barebox, U-Boot, EFI; LGPL 2.1; "RAUC does NOT intend to be a deployment server". **Mender**: open-source client with A/B and rollback; hosted server from $34 a month for up to 50 devices (section 5). **SWUpdate**: GPLv2 per a 2018 talk | fetched, <https://rauc.readthedocs.io/en/latest/>, <https://github.com/rauc/rauc>, <https://mender.io/pricing/plans>; snippet for SWUpdate's licence |
| Effort, in the project's own words | Drawbacks listed by the Yocto Project: "Steep Learning Curve"; "Understanding What Changes You Need to Make For Your Design Requires Some Research"; "Project Workflow Could Be Confusing"; "Working in a Cross-Build Environment Can Feel Unfamiliar"; "Initial Build Times Can be Significant" | fetched, <https://docs.yoctoproject.org/overview-manual/yp-intro.html> |

**My assessment.**
- *What it buys:* the smallest image, a read-only system with two-slot updates and rollback, a bill of materials and CVE report produced by the build, and the only practical way to a fully verified boot chain on TI and NXP chips.
- *What it costs a one-person project:* a separate machine configuration and boot-loader integration for each hardware family (TI, NXP, Toradex, Intel); a rebuild and a field update for every security fix, because there is no upstream security feed to subscribe to — *we* become the vendor; and reviewers who cannot point their usual scanner or CIS benchmark at it.
- *Timing:* scarthgap (what TI's and Toradex's layers default to today) ends April 2028; wrynose runs to April 2030. A build started now should target wrynose where the hardware layers allow.
- Do this only when a customer requires a locked, verified image on an ARM module, and then for one hardware family at a time.

---

## 5. Route (d): image-based Debian or Ubuntu

| Option | What it is, from its own pages | Fits which hardware | Realistic for one person? (my assessment) | Basis and source |
|---|---|---|---|---|
| **Ubuntu Core** | "a strictly confined and immutable embedded Linux OS", "built on snaps". Needs 512 MB RAM, 1 GB storage. "Full disk encryption support requires both UEFI Secure Boot and TPM 2.0". "External I2C/SPI-based TPM modules are not currently supported." Raspberry Pi and other ARM devices need a "board-specific" implementation with custom gadget and kernel snaps. Ready-made images: generic x86 and Raspberry Pi (snippet) | x86 with UEFI and a TPM; Raspberry Pi. Not TI AM62 or i.MX 8M Plus without paid board enablement | **No, not now.** The agent would have to become a snap, and every non-Pi ARM board needs enablement work Canonical sells (SmartStart "From $25,000") | fetched, <https://documentation.ubuntu.com/core/reference/system-requirements/>, <https://ubuntu.com/core>, <https://ubuntu.com/pricing/devices>; snippet for the image list |
| **mkosi** + systemd-repart + systemd-sysupdate | mkosi: "A fancy wrapper around `dnf --installroot`, `apt`, `pacman` and `zypper`" that builds disk images. Distributions include `debian` and `ubuntu`. `SecureBoot=`: "Sign systemd-boot (if it is not signed yet) and any generated unified kernel images for UEFI SecureBoot." Signed dm-verity partitions; `SignExpectedPcr=` for TPM-measured boot; formats `disk` ("a block device OS image with a GPT partition table"), `uki`. systemd-sysupdate "atomically updates the host OS"; "will not automatically create new partitions"; downloads are verified by default; its manual warns of parts "subject to change without advance notice" | x86-64 UEFI, cleanly. ARM boards that boot through U-Boot's UEFI layer: not checked | **Yes on x86, as a second step.** It is a recipe in the repository and a CI job; it gives a read-only, verified, two-slot image from ordinary Debian packages. Not needed for a first enterprise install | fetched, <https://github.com/systemd/mkosi/blob/main/README.md>, <https://github.com/systemd/mkosi/blob/main/mkosi/resources/man/mkosi.1.md>, <https://man.archlinux.org/man/systemd-sysupdate.8.en> |
| **debos** | "a tool to make the creation of various Debian-based OS images simpler"; YAML recipes; actions for debootstrap, partitioning, overlays and OSTree; Apache-2.0. Does nothing itself about boot loaders, secure boot or updates | Any, but you supply the boot pieces | **Possible, but it only builds.** Everything hard (board boot files, updates) remains yours | fetched, <https://github.com/go-debos/debos> |
| **Armbian build framework** | Builds kernel, boot loader and a Debian or Ubuntu image per board; runs in Docker; needs "at least 8GB … of memory and ~50GB of disk space"; a `userpatches/` folder "will be merged into the build framework automatically"; has a GitHub Action. **TI itself uses it for its Debian images** | TI SK-AM62 family, BeaglePlay ("Standard" support), plus "uefi-x86" | **Yes — the realistic ARM route.** One `userpatches` folder adds our package repository and package to a Debian 13 minimal image | fetched, <https://docs.armbian.com/build-framework/getting-started/>, TI page in 3.1, Armbian board pages in 3.1 |
| **balenaOS** | Container-only operating system. Device list includes Generic x86_64 (GPT), Intel NUC, Raspberry Pi 4/5/CM4, BeagleBone Black, phyBOARD-AM62x, Compulab IOT-GATE-iMX8PLUS, Variscite DART-MX8M. **Not listed: BeaglePlay, TI SK-AM62, NXP i.MX 8M Plus EVK, Toradex Verdin.** Cloud: "Your first ten devices are always free."; then $159 a month for 30 devices (+$3 each), $329 a month for 60 (+$2 each). Secure boot with disk encryption exists, but its page lists that applications are not signed | x86 and a set of named boards | **No.** Same container costs as Torizon, a narrower board list for our candidates, and a cloud dependency a government network may refuse | fetched, <https://docs.balena.io/reference/hardware/devices/>, <https://www.balena.io/pricing>, <https://docs.balena.io/reference/OS/secure-boot-and-full-disk-encryption/overview/> |
| **Mender on Debian** | "The `mender-convert` utility can be used to convert existing disk images for use with Mender." Two root partitions plus the client. Configurations in its repository: Raspberry Pi, `generic_x86-64_hdd_config`, RockPro64, QEMU. Documentation examples cover only Raspberry Pi 4 and 5 on Debian 13. Plans: open-source (free); Basic $34 a month up to 50 devices; Professional $291 a month up to 250; Enterprise (hosted or on-premise) by quote | Raspberry Pi and generic x86; TI and NXP boards need your own integration | **Maybe later, on x86.** Useful if fleets need two-slot whole-system updates with a ready-made server | fetched, <https://docs.mender.io/operating-system-updates-debian-family/convert-a-mender-debian-image>, <https://github.com/mendersoftware/mender-convert/tree/master/configs>, <https://mender.io/pricing/plans> |
| **RAUC on Debian** | RAUC is packaged in Debian itself: 1.8-2 (Debian 12), 1.13-3+deb13u1 (Debian 13) | Any with GRUB, U-Boot or EFI | **Maybe later.** No server needed; signed bundles fit an offline or proxy-only site | fetched, <https://packages.debian.org/search?keywords=rauc&searchon=names&exact=1&suite=all&section=all> |

---

## 6. (e) Secure boot, TPM and disk encryption, by hardware family

| Family | How verified boot works | State as shipped | Disk encryption | Effort and risk (my assessment) | Basis and source |
|---|---|---|---|---|---|
| **x86-64 UEFI** | "Starting with Debian version 10 ("Buster"), Debian supports UEFI Secure Boot by employing a small UEFI loader called shim which is signed by Microsoft"; Debian signs its own GRUB and kernel. Own keys can be added as "Machine Owner Key". Secure Boot turns on kernel lockdown (unsigned modules refused). Debian 13 also ships a signed systemd-boot (`systemd-boot-efi-amd64-signed` 257.13-1~deb13u1) | On, or one firmware setting away, on any business PC or industrial box. Note: some new machines trust only the "Windows UEFI CA 2023"; newer Debian ships a shim signed for it | `systemd-cryptenroll --tpm2-device=` binds a LUKS volume to the TPM; the manual suggests "some combination of PCRs 7, 11, and 14", offers a PIN (`--tpm2-with-pin`), and advises always keeping a recovery key enrolled | **Low.** Standard, reversible, documented, what reviewers already audit | fetched, <https://wiki.debian.org/SecureBoot>, <https://packages.debian.org/search?keywords=systemd-boot-efi-amd64-signed&searchon=names&exact=1&suite=all&section=all>, <https://man.archlinux.org/man/systemd-cryptenroll.1.en> |
| **TI AM62** | Chain: chip ROM → `tiboot3.bin` ("authenticated and decrypted by the Secure ROM") → `tispl.bin` (TF-A, OP-TEE, loader, checked by TI's security firmware) → U-Boot → a signed kernel bundle. Three chip states — GP: "there is no devie protection" [sic]. HS-FS: "before a customer has blown the keys in the device", "the state at which HS device leaves TI factory"; in it "the authentication will pass for certificates signed with any key". HS-SE: "after a customer has successfully blown the keys"; these "enforce an authenticated boot flow" | TI's SDK targets HS-FS by default. Verdin AM62 V1.2 carries HS-FS chips (sibling R1, read from the part number). Mallow has a TPM 2.0 chip (sibling R1) | TI: "To allow trusted use of files outside of our initramfs we use dm-verity"; "Enable DM-verity/DM-crypt" is listed as a hardening step. No CAAM-style key store on AM6x | **High.** Fusing is one-way ("an irreversible process"); lose the signing key and there is "no recovery" (sibling R1); needs a per-board fusing step and a build that signs every stage — in practice a Yocto build | fetched, <https://software-dl.ti.com/processor-sdk-linux/esd/AM62X/latest/exports/docs/linux/Foundational_Components_Migration_Guide.html>, <https://software-dl.ti.com/processor-sdk-linux/esd/AM62X/latest/exports/docs/linux/Foundational_Components_Secure_Boot.html>, <https://docs.u-boot.org/en/latest/board/ti/k3.html>, <https://developer.toradex.com/torizon/security/secure-boot-on-am62> |
| **BeaglePlay** (AM6254) | Not available | "It's GP." (21 Jun 2024). "BeaglePlay uses GP silicon, so not supported…" "Secure boot is complex on am62, it requires hsfs silicon and a very a specific gpio pin back to the pmic…" (4 Jul 2025) — both from BeagleBoard.org's Robert Nelson | Software-only (a passphrase or a key file); no hardware-held key | **Not possible** for verified boot. Fine as a development and low-assurance board | fetched, <https://forum.beagleboard.org/t/device-type/38797>, <https://forum.beagleboard.org/t/secure-booting-on-beagleplay/42216> |
| **NXP i.MX 8M Plus** | "HABv4": "The HABv4 can be used to authenticate all of the input binaries separately." Signing with NXP's Code Signing Tool; a key table whose hash is fused; the guide covers "i.MX8M, i.MX8M Mini, i.MX8M Nano, i.MX8M Plus". (Newer chips — i.MX 93, 95 — use a different scheme, AHAB: memory, not checked) | Open (not enforcing) until the customer fuses and "closes" the chip | The chip's CAAM block can hold keys (Toradex: CAAM is "available on NXP SoCs iMX6/7/8") | **High**, like TI: one-way fuses and a signed build | fetched, <https://github.com/u-boot/u-boot/blob/master/doc/imx/habv4/guides/mx8m_spl_secure_boot.txt>, Toradex secure-boot page (2.4) |
| **Raspberry Pi** (for reference) | "The boot ROM is the immutable hardware root of trust that contains a Raspberry Pi public key burned into silicon." "The boot ROM reads a hash of your RSA 2048-bit public key stored in One-Time Programmable (OTP) memory." The loader then checks a signed `boot.img` | Off until provisioned with the Secure Boot Provisioner; once enabled, signed boot cannot be switched off (snippet, Pi 4 white paper) | Provisioner stores a device-unique secret in OTP and uses it to unlock LUKS. "By default, Raspberry Pi OS doesn't support encrypted root file systems" | **Medium–high**: one-way, and outside stock Raspberry Pi OS | fetched, <https://www.raspberrypi.com/documentation/security/security-architecture.html>; snippet for the white paper |

---

## 7. Honest table of overheads, per route

Figures are from the sections above; the words in *italics* are my assessment.

| | (a) Torizon OS + container | (b1) Native Debian 13 / Ubuntu LTS on **x86 UEFI** | (b2) Native Debian 13 on an **ARM board** (TI/Armbian/Beagle image) | (c) Own Yocto image | (d) Image-based: Ubuntu Core | (d) Image-based: mkosi (x86) or Armbian recipe (ARM) |
|---|---|---|---|---|---|---|
| **CPU cost against native** | 0–4% measured (2.5) | none | none | none | *small (snap confinement)* | none |
| **Extra memory** | ≈113 MB for Docker's programs + ≈11 MB per container (one measurement, Pi 3B+) | none | none | none; *smallest of all* | *snapd runs in the background; not measured* | none |
| **Extra disk** | ≈163 MB engine + ≈30 MB compressed base image + a second Node.js (≈52 MB) | none; *a Debian install is about 1–2 GB* | Armbian Debian 13 minimal image: 342 MB download | *smallest: tens to low hundreds of MB* | *about 1 GB minimum per Canonical* | *two copies of the system for A/B* |
| **Build effort to first working box** | *Low on a Verdin (a Dockerfile). Rework needed to drop `--privileged`* | ***Lowest:** installer + one package* | *Low–medium: a vendor or Armbian image + one package* | ***Highest:** weeks to learn, per hardware family* | *High: snap packaging + board enablement* | *Medium: a recipe and a CI job* |
| **Upkeep** | *Two patch streams (Torizon host; Debian in the container). Torizon releases quarterly* | *One: `apt` from the distribution's security feed, unattended* | *Userland by `apt`; kernel from the board vendor's feed, slower and separate* | *All of it is ours: every CVE means a rebuild and a field update* | *Automatic from the Snap Store; brand store costs extra* | *Rebuild the image when packages change; sysupdate or RAUC delivers it* |
| **Who patches the kernel** | Toradex (Toradex modules only) | Debian / Canonical security teams | TI, NXP, Beagle or Armbian | us | Canonical (on enabled boards) | as (b1) or (b2) |
| **Hardware covered** | Toradex modules properly; TI kits and x86 as images without a stated support level | any x86-64 UEFI machine | TI SK-AM62 family, BeaglePlay; NXP kits "for evaluation"; **not** Toradex modules | any, one at a time | x86 with TPM; Raspberry Pi | x86 (mkosi); TI and Beagle boards (Armbian) |
| **Verified boot** | Yes on Toradex modules after fusing; "Early Access" on AM62; chain "does not cover container images" | Yes, as installed | TI kits: only with a signed build and fusing; BeaglePlay: never | Yes, with fusing | Yes on x86 with TPM | x86: yes (signed unified kernel image, dm-verity) |
| **Disk encryption with a hardware-held key** | TPM or OP-TEE backed data partition (Mallow has a TPM) | TPM 2.0 + LUKS, standard | *only where the board has a TPM or fused keys* | yes, with work | yes on x86 | x86: yes |
| **IT-reviewer familiarity** | *Low: an unfamiliar OS, plus Docker* | ***Highest:** CIS Benchmark exists for Debian 13 (v1.1.0) and 12 (v2.0.0); Ubuntu has FIPS, CIS and STIG profiles and certified boxes* | *Medium: familiar userland, unfamiliar vendor kernel* | *Lowest: nothing to compare it against; the bill of materials is the selling point* | *Medium: Canonical's name, unfamiliar model* | *Medium–high: it is Debian inside* |
| **Money** | OS free; cloud $0 for 5 devices, "$249" a month for 50 | free; Ubuntu Pro optional (device price by quote) | free | free (time) | services "From $25,000" | free |

CIS Benchmark versions: fetched, <https://www.cisecurity.org/benchmark/debian_linux>.

---

## 8. Recommended architecture: one piece of software, many kinds of hardware

**Principle.** Keep the application independent of the operating system's packaging of the *machine*, and let each hardware family use the operating system its maker (or the distribution) actually supports. The agent is plain JavaScript with no npm packages, so one package serves every processor type.

**Layer 1 — the product: two Debian packages in a signed package repository.**
- `floodnet-base` (or whatever it is called): the agent, its systemd unit with the sandboxing it already has, the device rules and the TV-driver block list. `Architecture: all`. Depends on `nodejs (>= 18)`.
- A pinned librtlsdr and `rtl_sdr` program built from a named release that drives the V4 and the V4L, as a small per-architecture package (amd64, arm64). This replaces "clone and build during installation".
- Supported bases: **Debian 13** (first), Ubuntu 24.04 and 26.04 LTS. Not Ubuntu 22.04 (Node 12). Debian 12 only as a courtesy (it is in volunteer long-term support).
- Operating-system patches come from the distribution by unattended upgrades; the agent's own updates come from our repository the same way. In an "enterprise profile" the self-updater, hotspot and remote management are switched off (sibling U1, section 8c), which is also what makes the box reviewable.

**Layer 2 — the same packages wrapped as a container image, for hosts whose operating system is fixed.**
- A multi-architecture image built in CI *from a signed release*, run without privileges: ordinary user, all capabilities dropped, read-only root, `/dev/bus/usb` mounted with the rule `c 189:* rmw`, host networking.
- This is what runs on a Toradex Verdin under Torizon OS, on balena if someone insists, or on a council's own container host. It retires the `--privileged`, run-as-root, clone-from-main recipe on the trial page.

**Layer 3 — reference images, built by recipe, one per hardware family.**
- **x86-64 UEFI (the "approvals" reference):** stock Debian 13 with Secure Boot on, TPM-bound LUKS, our repository added. First as an installer answer file; later, if wanted, a mkosi-built read-only image with two-slot updates.
- **TI AM62 kits and BeaglePlay:** the Armbian framework (the tool TI itself uses), a `userpatches` folder that adds our repository and package to Debian 13 minimal. Say plainly that BeaglePlay has no verified boot.
- **Toradex Verdin (AM62, i.MX 8M Plus):** Torizon OS plus the Layer 2 container. No native Debian — Toradex will not support it.
- **Other i.MX 8M Plus modules:** only where the module maker publishes a maintained Debian (Variscite does, with dates); otherwise treat as Layer 2.

**What to say to an IT reviewer, by hardware.**
- x86: "Debian 13, hardened to the CIS benchmark, Secure Boot on, disk bound to the TPM, patched nightly from Debian's security archive; one extra signed repository carrying two packages." Nothing in that sentence is unusual.
- ARM kit: the same, plus "the kernel comes from Texas Instruments' tree through the board image's feed", and no verified boot unless a Yocto build and fusing are added.
- Verdin: "Toradex's Torizon OS, signed over-the-air updates, plus one unprivileged container that we rebuild whenever Debian patches it."

**What not to do now.** Do not start a Yocto distribution, Ubuntu Core snaps or balena. Revisit Yocto when a customer requires verified boot on an ARM module — and then build it for that one module, reusing Layer 1's source unchanged.

**Does this confirm or overturn the earlier plan?**
- *Overturned:* that Torizon-plus-container is the general answer for non-Pi hardware; that the container must be privileged; that the container wastes CPU.
- *Confirmed:* that on a Toradex module, Torizon plus a container is the only vendor-supported way to run a Debian userland.
- *Changed:* the lead candidate for "will pass IT approval" is a small x86-64 UEFI box on stock Debian or Ubuntu, not an ARM module.

---

## 9. Could not confirm

| Question | Why not | How to settle it |
|---|---|---|
| The price of Ubuntu Pro for Devices | Canonical publishes none ("Contact us"); Advantech's marketplace page did not show its figures to an automated reader | Ask Canonical or an Australian reseller for a quote for a named CPU |
| Which Ubuntu release the NXP 8MPLUSLPD4-EVK is certified for | The search page did not show a release per entry | Open the three entries on ubuntu.com/certified by hand |
| How a Torizon OS fleet is kept patched without a paid Torizon Cloud plan | "Offline updates" are listed under the paid Developer plan; the free Maker plan stops at 5 devices | Ask Toradex; or test an offline update on the free plan |
| Whether Toradex's "$" prices are US dollars, and whether tax is added | The pricing page names neither | Ask Toradex |
| Torizon OS 8: its Yocto release, kernel and whether it is out | The support page says BSP 8 is "Coming Soon", November 2026; the release matrix I read still showed 7.7.0 (07/2026) as latest | Re-read both pages in December 2026 |
| That `rtl_sdr` opens the stick in a container with only the device rule and group, and survives a replug | No USB on the machines used here (also open in sibling U1) | One bench test on any Debian 13 box with Docker |
| Memory used by Docker's programs on an AM62 under Torizon OS | The only figure found is one blog's measurement on a Pi 3B+ under Armbian | `ps` on the trial Verdin |
| A current, sound measurement of Docker's CPU cost on 64-bit ARM | The 2025 paper found contradicts itself; the solid figures are from 2014 (x86) and 2016 (Pi 2) | The project's own benchmark, native against container, on the trial board |
| Australian government wording on supported operating systems (ASD's ISM and Essential Eight) | cyber.gov.au answered HTTP 503 twice; not retried | Read by hand; another agent's topic |
| rtl-sdr recipe and Node.js versions on the OpenEmbedded layer index; meta-intel and Toradex layer branches | layers.openembedded.org and git.yoctoproject.org answered HTTP 403; I used GitHub for meta-openembedded, meta-ti and meta-freescale, and did not check meta-intel | Read by hand |
| Which exact rtl-sdr release first drives the V4L, and whether Debian 2.0.3 (testing) includes it | The maker's page says upstream "added V4L support" without a version | Read the Osmocom repository log |
| The exact end of Debian 12's regular security support | debian.org reads 2026-07-11, the wiki 2026-07-12, and the LTS page starts LTS on 2026-06-11 | Immaterial now (it is over), but cite one page consistently |
| AHAB on i.MX 93/95 | The U-Boot document I tried returned 404 | Only matters if an i.MX 9 board is shortlisted |
| Whether systemd-sysupdate as a whole, or only parts, is flagged as subject to change | The summary of the manual quoted "subject to change without advance notice" without its sentence | Read the manual page by hand before depending on it |
| Whether an ARM board booting through U-Boot's UEFI layer can use mkosi's signed-image flow | Not researched | A test on an SK-AM62 |
| Hardware prices and Australian stockists | Outside this topic (other reports) | — |

---

## 10. Pages opened for this report

Torizon and Toradex: <https://www.torizon.io/pricing> · <https://www.torizon.io/torizon-os> · <https://www.torizon.io/supported-hardware/x86> · <https://www.torizon.io/torizon-on-debian-ubuntu> · <https://www.torizon.io/vulnerability-manager> · <https://developer.toradex.com/torizon/torizoncore/supported-hardware/> · `…/supported-hardware-ti` · `…/supported-hardware-nxp` · `…/supported-hardware-x86` · <https://developer.toradex.com/torizon/torizoncore/torizon-frequently-asked-questions-faq> · <https://developer.toradex.com/torizon/torizoncore/torizoncore-technical-overview/> · <https://developer.toradex.com/software/toradex-embedded-software/embedded-linux-release-matrix/> · <https://developer.toradex.com/software/toradex-embedded-software/toradex-embedded-linux-support-strategy/> · <https://developer.toradex.com/torizon/security/secure-boot-on-torizoncore/> · <https://developer.toradex.com/torizon/security/secure-boot-on-am62> · <https://developer.toradex.com/torizon/application-development/working-with-containers/run-and-manage-containers-with-the-command-line-on-torizon/> · <https://community.toradex.com/t/debian-12-bookworm-on-verdin-am62-wi-fi-with-toradex-bsp-recommended-build-and-integration-method/30539> · <https://community.toradex.com/t/torizon-as-a-layer-on-debian/27632/4> · <https://github.com/commontorizon/meta-common-torizon>

Containers: <https://www.read.seas.harvard.edu/~kohler/class/cs260r-s19/containerperf14.pdf> · <https://arxiv.org/pdf/1603.02955> · <https://arxiv.org/html/2505.02082v2> · <https://dev.to/gounthar/running-100-wasm-containers-on-a-raspberry-pi-with-903-mb-of-ram-36mf> · <https://docs.docker.com/reference/cli/docker/container/run/> · <https://github.com/torvalds/linux/blob/master/include/linux/usb.h> · <https://hub.docker.com/v2/repositories/library/debian/tags/trixie-slim>

Debian, Ubuntu, vendors: <https://www.debian.org/releases/> · <https://wiki.debian.org/DebianReleases> · <https://wiki.debian.org/LTS> · <https://wiki.debian.org/SecureBoot> · packages.debian.org (nodejs, libnode115, rtl-sdr, docker.io, containerd, runc, rauc, systemd-boot-efi-amd64-signed) · packages.ubuntu.com (nodejs, rtl-sdr) · <https://ubuntu.com/certified/iot> · <https://ubuntu.com/certified> (vendor filters) · <https://ubuntu.com/pro> · <https://ubuntu.com/pro/devices> · <https://ubuntu.com/pricing/pro> · <https://ubuntu.com/pricing/devices> · <https://ubuntu.com/about/release-cycle> · <https://ubuntu.com/core> · <https://documentation.ubuntu.com/core/reference/system-requirements/> · <https://documentation.ubuntu.com/core/reference/support-duration/> · <https://software-dl.ti.com/processor-sdk-linux/esd/AM62X/12_00_00_07_04_Debian/exports/docs/debian/Building_Debian_Image.html> · <https://armbian.com/boards/sk-am62b> · <https://armbian.com/boards/beagleplay> · <https://docs.armbian.com/build-framework/getting-started/> · <https://www.beagleboard.org/distros> · <https://www.nxp.com/docs/en/release-note/RN00266.pdf> · <https://dev.variscite.com/var-som-am62/debian/debian-build-release-ti/> · <https://dev.variscite.com/software-and-security/software-lifecycle/debian-lifecycle/> · <https://www.cisecurity.org/benchmark/debian_linux> · <https://nodejs.org/en/about/previous-releases> · <https://www.kernel.org/category/releases.html>

Radio driver: <https://www.rtl-sdr.com/V4/> · <https://rtl-sdr.com/rtl-sdr-blog-v4l-lite-now-available-for-purchase> · <https://lists.osmocom.org/hyperkitty/list/osmocom-sdr@lists.osmocom.org/thread/SQOKBREXAFUTFBPWVXKROFGCS6JHTPTR>

Yocto and update tools: <https://www.yoctoproject.org/development/releases/> · <https://docs.yoctoproject.org/migration-guides/release-notes-6.0.html> · <https://docs.yoctoproject.org/dev/dev-manual/sbom.html> · <https://docs.yoctoproject.org/dev/security-manual/index.html> · <https://docs.yoctoproject.org/overview-manual/yp-intro.html> · <https://github.com/openembedded/meta-openembedded/tree/wrynose/meta-oe/recipes-devtools/nodejs> · `…/tree/scarthgap/…` · <https://github.com/balister/meta-sdr/tree/master/recipes-support/rtlsdr> · <https://github.com/TexasInstruments/meta-ti/branches> · <https://github.com/Freescale/meta-freescale/branches> · <https://kas.readthedocs.io/en/latest/intro.html> · <https://rauc.readthedocs.io/en/latest/> · <https://github.com/rauc/rauc> · <https://mender.io/pricing/plans> · <https://docs.mender.io/operating-system-updates-debian-family/convert-a-mender-debian-image> · <https://github.com/mendersoftware/mender-convert/tree/master/configs> · <https://github.com/systemd/mkosi/blob/main/README.md> · <https://github.com/systemd/mkosi/blob/main/mkosi/resources/man/mkosi.1.md> · <https://man.archlinux.org/man/systemd-sysupdate.8.en> · <https://man.archlinux.org/man/systemd-cryptenroll.1.en> · <https://github.com/go-debos/debos> · <https://docs.balena.io/reference/hardware/devices/> · <https://www.balena.io/pricing> · <https://docs.balena.io/reference/OS/secure-boot-and-full-disk-encryption/overview/>

Secure boot: <https://software-dl.ti.com/processor-sdk-linux/esd/AM62X/latest/exports/docs/linux/Foundational_Components_Migration_Guide.html> · <https://software-dl.ti.com/processor-sdk-linux/esd/AM62X/latest/exports/docs/linux/Foundational_Components_Secure_Boot.html> · <https://docs.u-boot.org/en/latest/board/ti/k3.html> · <https://docs.u-boot.org/en/latest/board/beagle/am62x_beagleplay.html> · <https://forum.beagleboard.org/t/device-type/38797> · <https://forum.beagleboard.org/t/secure-booting-on-beagleplay/42216> · <https://github.com/u-boot/u-boot/blob/master/doc/imx/habv4/guides/mx8m_spl_secure_boot.txt> · <https://www.raspberrypi.com/documentation/security/security-architecture.html>

Repository files read (not changed): `/home/user/open-ALERT/site/trial.html` lines 140–179; `/home/user/RPi_ALERT/os/install.sh` lines 45–130.

Working notes kept while researching: `(working folder, not kept)/R3-notes.txt`. Downloaded PDFs: `(working folder, not kept)/R3-dl/`.
