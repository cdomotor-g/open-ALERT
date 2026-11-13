# Hardware review: a base station that is not a Raspberry Pi

**Final review, 11 November 2026**, from thirteen research reports and three re-checks of them
(sixteen files; index at the end). Checked against its sources again on 13 November 2026, when
some prices and sellers' pages were opened again. The question: which computer, other than a Raspberry Pi, can run an ALERT
receiving base station, be as open as possible, pass IT security review on an Australian
government, council or water-authority network, be bought in Australia at a sensible price,
and have room for network growth and ALERT2?

You can explore all of this on the [Other computers page](../../site/hardware.html) (published at
<https://cdomotor-g.github.io/open-ALERT/hardware.html>): filters, sorting, side-by-side
comparison, prices and where to buy, diagrams and photographs where the licence allows. The
same tables, for reading here, are in [comparison.md](comparison.md). What an IT assessor is
handed is in [docs/security](../security/README.md).

This is a review of the old Mallow trial (a Toradex Verdin AM62 on a Mallow carrier, run beside
a Raspberry Pi) and everything it assumed. That trial's page has since been re-aimed: it is now
the [side-by-side trial](../../site/trial.html), for whichever computer you pick. Where
something is a stand-in, a guess or not yet tested, this review says so.

## The answer in five lines

1. **Buy a fanless small PC on Intel's N150 class (or N250, or Core 3 N355) with a TPM 2.0 and
   UEFI Secure Boot**, on stock Debian 13 or Ubuntu 24.04 with the `open-alert-base` package.
   The OnLogic CL260 for a site on a 12 V or 24 V battery; the Lenovo ThinkEdge SE10n Gen2
   where IT wants a brand it already buys.
2. **Prove it on the bench first with a A$300 mini PC** if you like; keep the Verdin AM62 and
   the Luna SL1680 **out of the order book**.
3. **Do not run the old Mallow trial as it was written.** The module costs about three times
   what it assumed, one part does not fit, the speed figure was never measured, and its software
   recipe is the hardest kind to get approved.
4. **No rewrite is needed.** RPi ALERT's agent runs unchanged off a Raspberry Pi; open-ALERT's
   [`firmware/`](../../firmware/) wraps its signed release as a package. A container is built
   but has only been tried with stand-ins on one PC, and disk images are still being written. **Nothing has yet been run with a real
   radio stick on a computer that is not a Raspberry Pi.**
5. **Speed is a rule, not a hope:** at least four cores, each at least 2.5 times a Raspberry Pi
   4 core, if ALERT2 is to grow. Every speed figure here is a stand-in until the benchmark has
   been run on the real computer.

## What to buy, and why

Grouped as the Other computers page groups them. Figures are in [comparison.md](comparison.md); each
computer's page entry names its reports.

### 1. First choice: a fanless small PC with a TPM

An Intel N150-class chip is about 3 times a Pi 4 on each of four cores (a stand-in; the
benchmarks disagree, from 2.4 to 4.5; [R8](research/R8-cpu-performance.md)). At that planning
figure it clears the ALERT2 rule. At the low end of the published benchmarks (about 2.4 a core)
it falls just under 2.5, so run the benchmark before buying several. A PC is also the kind of
computer where the start-up chain, the operating system, Node.js and the radio driver all come
signed from the operating system's own maker, which is what an IT reviewer wants
([R4](research/R4-au-gov-it-security.md), [R7](research/R7-x86-boxes.md)).

One thing to know before "who patches it?" is asked. On Ubuntu 24.04, Node.js and the radio
driver (`rtl-sdr`) come from Ubuntu's "universe" section, which Canonical patches only under its
paid Ubuntu Pro service. On Debian 13 they are covered by Debian's own security team to August
2028 ([R3](research/R3-os-firmware-strategy.md)).

| Computer | The pick for | The facts that matter | Where |
|---|---|---|---|
| **OnLogic CL260** | A 12 V or 24 V site | 12–24 V DC on a terminal block (runs from a site battery), TPM 2.0, Ubuntu 24.04 offered by the maker, 0–50 °C, from US$641 | OnLogic direct; no Australian distributor found |
| **Lenovo ThinkEdge SE10n Gen2** | Where IT wants a brand it already buys | N150 (or, in the 0–50 °C version only, the eight-core Core 3 N355), a TPM 2.0 chip of its own, Secure Boot, DIN rail, three-year on-site warranty option, a 20 V adapter. Lenovo calls it fanless (press release, 23 February 2026); its specification does not use the word and rates both versions, 0–40 and 0–50 °C, with 0.7 m/s of moving air: ask Lenovo. The specification lists it as "Ubuntu Server Certified" and "Red Hat Enterprise Linux Certified": that is Lenovo's statement. Canonical's public list did not show it on 13 November 2026, and the Ubuntu the sheet names is Server 26.04, which the package has not been tried on. Ask Lenovo for the certificate and which release it covers | Lenovo Australia or a partner, by quote; no Australian price found |
| **Protectli Vault VP2430** | When open start-up firmware matters most | N150, coreboot (open-source start-up firmware), TPM optional, −10 to 50 °C, 12 V only | Protectli direct (C$649 on its Canadian shop); no Australian stockist found |

### 2. Cheapest way to start: for the bench and an air-conditioned room only

- **An N100 or N150 mini PC from an Australian shop**, about A$230–350 (an estimate: the deals
  seen had ended). Consumer brands, 0–35 or 40 °C, a small fan, and last of the small PCs for an
  IT review in this review's own judgement ([R7](research/R7-x86-boxes.md) found no government
  source for that order).
- **A refurbished ex-lease Lenovo ThinkCentre M920q Tiny** (Core i5-8500T), about A$240–320
  when a refurbisher has one. Reboot IT's page (read 13 November 2026) said A$239 on sale,
  A$299 regular, including GST, and that the unit had sold; PB Tech listed one at about A$322
  (a search listing). A brand IT knows; has a fan. Its speed (about 4 a core, 6 cores) is from
  memory only and **unverified**.
- **A new Dell OptiPlex Micro or Dell Pro Micro**: a TPM, a brand named on a Victorian
  government buying panel (a search listing), the easiest paper trail; has a fan. Check the
  model: on Canonical's list the OptiPlex Micro 7020 and 7010 are certified on Ubuntu 22.04
  only, whose Node.js is too old for the package; the one model found certified on 24.04 is the
  Dell Pro Micro Plus QBM1250. Not priced: ask Dell Australia or a reseller.

### 3. Hot cabinets

**CompuLab fitlet3** (Atom x6425E): −40 to 85 °C, 7–42 V DC, TPM, fanless; Metromatics
(Brisbane office), by quote. About 1.8 times a Pi 4: fast enough today, short of the ALERT2
rule.

### 4. Certified industrial

- **Moxa UC-4400A** ordered with Moxa Industrial Linux 4 Secure (Debian 13-based, IEC 62443-4-2
  Security Level 2 by Moxa's own statement, TPM, secure boot, patched to 2035, five-year
  warranty). About 0.65 of a Pi 4 and **one** USB 2.0 port, so two sticks need a powered hub.
  Quote from IP Trading or Colterlec. **Not checked:** whether Moxa's Secure system lets you
  install Node.js and `rtl-sdr` from Debian's packages, which the package needs, and the
  package has not run on any ARM computer. Ask Moxa or the seller before ordering
  ([R6](research/R6-industrial-arm-gateways.md)).
- **Eurotech ReliaCOR 40-13**: the fast certified computer to ask about (a certified x86
  computer on Ubuntu 22.04). No Australian stockist found. The product's certificate holds only
  while the separate certificate for Eurotech's development process does, and that one showed
  an end date of 11 October 2026: ask whether it was renewed
  ([R4 re-check](research/R4-au-gov-it-security.verify.md)).

### 5. Open hardware (design files under an open licence)

- **BeagleY-AI** (OSHWA-certified; TI AM67A; four USB 3 ports; 4 GB; memory card only), about
  A$150–156: Pakronics A$155.88 including GST, in stock (its page, 13 November 2026); Core
  Electronics A$149.95 from a search listing.
- **BeaglePlay** (16 GB eMMC, **one** USB host port), about A$220–267; its chip can never do
  secure boot.
- **Olimex iMX8MP-SOM-4GB-IND on its evaluation board** (OSHWA, CERN-OHL-S, KiCad files, made in
  Bulgaria; EUR 156 + EUR 50 from Olimex; no Australian stockist): the best open start for a
  board of our own.

All about half to two-thirds of a Pi 4: a small older-ALERT site, not ALERT2 growth, and the
hardest class to take through an IT review ([R5](research/R5-open-hardware-boards.md)).

### 6. Toradex, if staying

The **Verdin iMX95 Hexa 4GB** (part 0227, US$337.50) on the same Mallow carrier, not the AM62:
six newer cores, USB 3 and PCIe, supply promised to 2039 for the module (2034 for the Mallow
carrier). Its datasheet is still preliminary
and its speed (about 1.1 in all, 0.75 a core) is an estimate nobody has measured. On Torizon OS
with the container that has no privileges. The AM62 Quad stays in every table marked "not
recommended", the Luna SL1680 marked "comparison only".

### 7. For reference

The **Raspberry Pi 4** (the yardstick) and the **Raspberry Pi 5 / Compute Module 5** (the
cheapest fast ARM, 2.2 times a Pi 4; a KUNBUS RevPi Connect 5 puts one in a DIN-rail case with a
TPM). A Pi 5 does not clear the 2.5 line.

### The one thing to do first

Buy one A$300 N100 or N150 mini PC, install Debian 13 or Ubuntu 24.04, install `open-alert-base`
([firmware/README.md](../../firmware/README.md)), plug in a real radio stick, and run the
benchmark in [`firmware/bench`](../../firmware/bench/). That settles the two biggest open
questions at once (does the package work with a real stick off a Pi; what does this decoder
really cost on this class of processor) for the price of the cheapest computer in the table. Then
order the CL260 or the ThinkEdge.

## The old Mallow trial, claim by claim

That trial was **not to be run as written**. Its page is now the side-by-side trial.

| What the trial says or assumes | What the review found | Verdict |
|---|---|---|
| Industrial parts and no Raspberry Pi name will pass IT security | Reviewers ask about the operating system, patching, accounts, logs and the supplier. The board's name is not on any Australian deny list ([R4](research/R4-au-gov-it-security.md)) | Wrong premise |
| Verdin AM62 Quad: A$566 at element14, "a third of that direct from Toradex" (US$107.40) | Toradex lists the Quad 2GB WB IT (00761200) at **US$306.00** for one, the Dual 1GB IT at US$206.25, Mallow at US$100.65 and the right heatsink at US$14.40: about **US$421 a set**. From Toradex that is about A$610 before GST and A$670 with it, before the courier, which Toradex does not publish; R1 put it at about A$750–800 landed including GST through an Australian distributor, from search listings. The old US$107.40 is gone. element14 Australia's prices are stale and its listing 4852670 is mistitled ([R1](research/R1-toradex-verdin-mallow.md), [R1 re-check](research/R1-toradex-verdin-mallow.verify.md)) | Out of date |
| Heatsink part 23111001 | Marked "not compatible Verdin AM62". The right one is 23111101 ([R1](research/R1-toradex-verdin-mallow.md)) | Wrong part |
| An AM62 is "half a Raspberry Pi 4" | Never measured: each repository cited the other ([U3](research/U3-open-alert-site-and-claims.md)). Published benchmarks of the same class of core put it at 0.5 (0.45–0.6) ([R8](research/R8-cpu-performance.md)) | Never measured (about right) |
| Four channels take about a third of it | The builder's sums were 2.5 to 4 times lower than RPi ALERT's own Pi 4 measurements for the work between bursts. On default settings one channel in a wide window is about one whole AM62 core ([U2](research/U2-decoder-cost-and-bench.md)). The builder is now corrected | Too hopeful |
| It fits with "filter only around bursts" and the Light decoder | Both are off by default. "Around bursts" missed weak bursts in its only field check; Light has had no field check ([U2](research/U2-decoder-cost-and-bench.md)) | Unproven |
| Mallow has two USB 3 ports and an M.2 slot for a radio card | With any AM62 the two sockets run at USB 2.0 on one shared bus, and the M.2 slot has no PCIe. Fine for RTL-SDR sticks; not for a radio card ([R1](research/R1-toradex-verdin-mallow.md)) | Partly wrong |
| Mallow's design files are published, so it is the base for an open custom board | The schematics and parts list download directly and the Altium project sits behind a form, but none carries an open-source licence: "All rights are reserved" ([R1](research/R1-toradex-verdin-mallow.md), [R10](research/R10-custom-hardware-and-sdr.md)). Get written permission before building on them | Overstated |
| Available to 2033 and beyond, twelve years | Supply of the module is promised to 2033: seven years. The Mallow carrier is promised to 2034 ([R1](research/R1-toradex-verdin-mallow.md)) | Overstated |
| (not mentioned) secure boot | Documented for the AM62, but Toradex staff called it "still an Early Access feature" on 10 November 2026 ([R1](research/R1-toradex-verdin-mallow.md)) | Not ready |
| Torizon OS, then RPi ALERT in a privileged container built from the unsigned main branch | The hardest stack to get approved: not on the security tools' supported lists, no hardening benchmark, and privileged containers are a standard finding ([R3](research/R3-os-firmware-strategy.md), [R4](research/R4-au-gov-it-security.md)). The signed release was started in a container with no privileges at all, with no radio attached ([U1](research/U1-rpi-alert-portability.md)); whether a radio stick can be opened that way is untested | Replace |
| Install plain Debian on the Verdin instead | Toradex does not support it: "neither supported nor recommended" ([R3](research/R3-os-firmware-strategy.md)) | Not a route |
| The Luna SL1680 "should work" | Toradex sells it as a sample product "for evaluation/development". Chip-maker's own kernel, five-year commitment, about 1.2 times a Pi 4 (1.0–1.4), US$145, no Australian stock ([R2](research/R2-toradex-luna-sl1680.md), [R2 re-check](research/R2-toradex-luna-sl1680.verify.md)) | Comparison only |

**On the worry that a container wastes processor power:** it does not. Others have measured
0–4% on other software (a study on a server and one on a Raspberry Pi 2); nobody has measured
it on this decoder. The real costs of Torizon plus a container are about 110 MB of memory, 250–350 MB of disk, two
separate streams of security patches to follow, and a secure-boot chain that stops short of the
container. So the instinct was right about complexity, not about speed
([R3](research/R3-os-firmware-strategy.md)).

If you are staying with Toradex, the Verdin iMX95 on the same carrier is the better module
(group 6 above), running the unprivileged container.

## What IT security asks

From [R4](research/R4-au-gov-it-security.md) and [its re-check](research/R4-au-gov-it-security.verify.md).
The answers for this base station are written out in [docs/security](../security/README.md).

**There is no single approval.** The Bureau follows the Commonwealth's Information Security
Manual process: the controls are assessed, then a senior officer authorises the system. Councils
have guidance, not rules. Water utilities with 100,000 or more connections fall under
critical-infrastructure rules that were tightened on 10 June 2026.

**The questions come in this order of weight:**

- **The operating system**: is it supported, who patches it and how fast, is there a hardening
  benchmark, do our scanning and endpoint tools run on it?
- **The application**: what listens on the network, what runs as the administrator, can the
  supplier change it remotely, are updates signed, is there a bill of materials, does it work
  through our web proxy, where do logs go?
- **The supplier**: who owns them, is there a security contact, a flaw-reporting policy, a
  stated support period?
- **The hardware**: maker and owner, secure boot, TPM, how long its firmware is supported.
- **The network placement.** A base station on its own mobile link, off the customer's network,
  shrinks the approval to hosting and data questions.

**No Australian rule or guidance names Raspberry Pi.** NASA's 2019 report blamed an unregistered
device and a flat network, not the Pi.

**Easiest to hardest to take through:**

1. A big-brand small PC on Ubuntu LTS.
2. A certified industrial gateway. Moxa's ARM ones are at or below a Pi 4 in speed; Eurotech's
   ReliaCOR 40-13 is a certified x86 computer on Ubuntu, with no Australian stockist found.
3. An industrial module on a carrier, or a Pi Compute Module in an industrial case, on Ubuntu or
   Debian (not Torizon OS).
4. Small-maker open-hardware boards.

R4 ranks Torizon OS with a privileged container, and Raspberry Pi OS, fifth of its seven
classes: below the first three here and above small-maker open-hardware boards. It did not rank
Torizon OS with a container that has no privileges, which is how a Verdin would run, because
Toradex supports only Torizon OS on a Verdin. Among small PCs, the order (Dell and Lenovo, then
industrial makers, then Protectli, then consumer mini PCs) is R7's own judgement.

**The supplier is the likely weak point.** The project should publish a flaw-reporting policy
([SECURITY.md](../../SECURITY.md)), a support period ([support.md](../security/support.md)), a
bill of materials, a who-does-what table
([shared-responsibility.md](../security/shared-responsibility.md)) and a data-flow page
([overview.md](../security/overview.md)). These now exist as drafts.

## Speed, and the ALERT2 rule

From [U2](research/U2-decoder-cost-and-bench.md), [R8](research/R8-cpu-performance.md) and
[R9](research/R9-alert2-demands.md).

**Each radio channel is decoded on one processor core**, so the speed of one core matters as
well as the total.

**Planning values, as "times a Raspberry Pi 4", whole computer / one core:**

| Processor | Computers | Whole / one core |
|---|---|---|
| Pi 3B+ | | 0.5 / 0.5 |
| Pi Zero 2 W | (the repository's earlier 0.25 was wrong) | 0.4 / 0.4 |
| Pi 4 | the yardstick | 1.0 / 1.0 |
| Pi 5, CM5 | | 2.2 / 2.2 |
| TI AM62 and AM67A (four Cortex-A53, 1.4 GHz) | Verdin AM62 Quad, BeaglePlay, BeagleY-AI | 0.5 / 0.5 |
| NXP i.MX 8M Plus (four A53, 1.6–1.8 GHz) | Moxa UC-4400A, CompuLab IOT-GATE-IMX8PLUS, Olimex iMX8MP | 0.65 / 0.65 |
| NXP i.MX 95 (six A55, 1.8 GHz) | Verdin iMX95 | about 1.1 / 0.75: an estimate nobody has measured |
| Synaptics SL1680 | Luna | 1.2 / 1.2 |
| Intel Atom x6425E | fitlet3 | about 1.8 / 1.8 |
| Intel N100 / N150 | the first-choice PCs and the mini PCs | about 3 / 3 (range 2.4–4.5: the benchmarks disagree) |
| Core 3 N355 (eight cores) | ThinkEdge option | about 3 a core, more in total |
| Core i5-8500T (2018) | M920q Tiny | about 4 a core **by memory only (unverified)** |

**No published benchmark runs this JavaScript decoder, so every figure is a stand-in.** The
benchmark in [`firmware/bench`](../../firmware/bench/) settles it on the real computer, and
**no Pi 4 has run it yet.**

**Today's load**, on a busy Pi 4: about 0.55–0.6 Pi 4 cores a channel in a 1.44 MHz window,
0.25–0.5 at 960 kHz, 0.15–0.25 at 240 kHz. Four channels on one stick: about 2.2–2.5 Pi 4
cores, or 55–62% of a Pi 4, in busy to heavy traffic. Those are the top of each range. By the
measurement alone, with nothing else loading the computer, the same four channels take about
1.4 Pi 4 cores, 36%: the builder shows both ends (36–55% on a busy day). The site's builder had
been showing sums 2.5 to 4 times lower than this for the work between bursts; it is corrected.

Two kinds of figure are in that paragraph. The work between bursts is RPi ALERT's own Raspberry
Pi 4 figure, and the higher end is what that Pi 4 showed while busy with eight channels and a
screen, so it may read high. What each burst costs, and the ALERT2 figures below, were timed on
a PC-class virtual machine and multiplied by 4 to 5 to stand for a Pi 4
([U2](research/U2-decoder-cost-and-bench.md), [R9](research/R9-alert2-demands.md)): estimates
until a Pi 4 runs the benchmark.

**ALERT2.** A channel whose time slots are all used needs about 1.1–1.3 Pi 4 cores of work for
its messages alone, and 1.2–1.8 once the cost of listening in the stick's window is added
([R9](research/R9-alert2-demands.md)); the builder shows 1.3 in the narrowest window and 1.5–1.7
in a 1.44 MHz one. All of it lands on one core, more than any Pi 4-class core has. Real networks
run far below that (20–31 frames a minute). So the rule for buying with headroom: **at least
four cores, each at least 2.5 times a Pi 4 core.** Prudent totals: four channels about 2.5 Pi
4s; eight channels about 4. The Verdin AM62, the Luna SL1680 and every Beagle board miss it; so
do the Pi 5 (2.2) and the fitlet3 (1.8). The N150-class PCs clear it at their planning figure of
about 3; at the low end of the benchmarks (about 2.4) they fall just under.

**The version of ALERT2.** The repositories work from the superseded ALERT2 AirLink 1.1.
Version 1.2 (January 2025) adds modes the agent cannot hear and optional encryption. Those are
software and access questions, not hardware ([R9](research/R9-alert2-demands.md)).

**One software change is worth more than any hardware.** Not trying the legacy decoder first on
a known ALERT2 channel takes a full channel from about 1.2 to about 0.4 Pi 4 cores. It is
planned in RPi ALERT, not shipped ([U2](research/U2-decoder-cost-and-bench.md)).

## The software route, and what is tested

[RPi ALERT's](https://github.com/cdomotor-g/RPi_ALERT) agent runs unchanged off a Raspberry Pi:
247 of its 247 tests pass on plain Ubuntu on a PC processor ([U1](research/U1-rpi-alert-portability.md)).
Only its installer and its SD-card image are Raspberry Pi-specific.

```
 RPi ALERT's SIGNED release (unchanged, signature checked)
        |
        |-- a package, open-alert-base, for any Debian 13 / Ubuntu 24.04 computer (x86 or ARM)
        |-- the same in a container with no privileges, for Torizon and container hosts
        '-- ready-to-flash disk images
```

Two profiles: **standard** (like a Pi base station on a small network) and **enterprise** (no
hotspot, no remote changes from Flood-Net, no self-reboots, dashboard reachable from the machine
itself only, web-proxy and private-certificate support).

**Which computer takes which:**

- Every x86 PC, the CompuLab box included, takes the **package** (and the disk image, when
  there is one). The Moxa should take it, but nobody has checked that Moxa's Secure system lets
  you install what the package needs: ask Moxa.
- The Beagle boards take the package on BeagleBoard.org's own Debian.
- A Verdin takes the **container** on Torizon.

**What has been tested, and where**, as at 13 November 2026. The firmware is still being worked
on, so [firmware/README.md](../../firmware/README.md) is always the current word: read it for
the full table. What it said on that date:

- The package builds, installs and starts on **Debian 13 and Ubuntu 24.04** (and Debian 12, which
  is not a target) in containers on one virtual machine with an ordinary PC processor and **no
  USB at all**. The last whole run of its checks reported 760 passed, none failed, 2 skipped.
  It is a first version: not reviewed by a second person, and not released.
- **Nothing has been run with a real radio stick on a computer that is not a Raspberry Pi.**
  Not natively, not in a container. The device rules and the service's device list have never
  met a real stick.
- Not tested: the device rules on a real computer, serial receivers, the clock on a real
  computer, any ARM computer, a real computer start-up, a real web proxy and inspecting network,
  an update from an older package, Flood-Net itself, RPi ALERT 0.24.
- The container (`firmware/container/`) is built, and its own checks pass on one PC with
  stand-ins for the radio stick and for Flood-Net. It has not been tried on Torizon OS, on an ARM
  computer or with a real stick. The disk images (`firmware/image/`) are still being written.
  Nothing is released. The package is the main form.
- **Releases** of the firmware will appear at
  <https://github.com/cdomotor-g/open-ALERT/releases>; there were none on that date.

An unfinished, unreviewed change to RPi ALERT that adds the settings a managed network needs
(listen address, accepted host names, behind-a-proxy, login for everything, a log line per
login) is kept in [`wip/rpi-alert-0.24-managed-network.patch`](wip/rpi-alert-0.24-managed-network.patch).
It is not applied anywhere.

## A board of our own, later

From [R10](research/R10-custom-hardware-and-sdr.md). **Buy off the shelf first.** Build only if
an approval or a site fails for a concrete reason a carrier board fixes: wide DC input, a TPM, a
watchdog, surge protection, a battery clock, the radio on the board.

**Bases to start from:**

- The Raspberry Pi CM5 IO board (KiCad files; fast; but a Pi).
- SMARC 2.1 (the widest choice of module makers, NXP i.MX 95; no Australian distributor found).
- Toradex Mallow (schematics and parts list free to download, the full drawing project behind
  a form; no open-source licence: get written permission).
- Olimex's open iMX8MP module.

**To sell one in Australia:** a supplier's declaration of conformity, AS/NZS CISPR 32 emissions
testing at an accredited laboratory, the Regulatory Compliance Mark, and an Australian
responsible supplier.

**Unsourced estimates** (the report says so; treat as a guess to be replaced by quotes):
A$40,000–120,000 and 9–15 months before the first unit; A$150–300 a carrier at 10 units, A$90–180
at 50, A$60–120 at 250, before the module and the radio.

## The radio

From [R10](research/R10-custom-hardware-and-sdr.md). The RTL-SDR Blog V4 is end of line; the V3
"will remain in stable production" and is sold in Australia (Core Electronics, Little Bird,
Robot Gear). **Keep the radio a replaceable USB part.** None of the alternatives is a drop-in.
Every RTL-SDR tuner chip comes from one maker, which is one more reason to record the exact
stick a base station uses.

## What is still open

- **Nothing has been run with a real radio stick on a computer that is not a Raspberry Pi.**
  This is the first thing to try on real hardware.
- **No Pi 4 has run the benchmark** in `firmware/bench`, so there is no measured baseline, and
  every speed figure in this review is a stand-in.
- **Prices need a human's check in a browser.** Several shops refuse automated reading; a
  number marked "check with the seller" is one nobody could read. The owner asked that links
  matter more than figures.
- **ARM is untested.** The package holds no compiled code, so no difference is expected, but
  no ARM computer has run it.
- **The firmware release is not cut** (`firmware/README.md`: "not released"; no releases at the
  address above on 13 November 2026). The container has not been tried on Torizon OS or on an
  ARM computer, and the disk images are still being written.
- **Nobody has checked that the package installs on Moxa's Secure system**, or on Ubuntu 26.04,
  the Ubuntu that Lenovo's sheet for the ThinkEdge names.
- **The ThinkEdge's Ubuntu and Red Hat certification is Lenovo's statement.** Canonical's public
  list did not show the machine on 13 November 2026; Red Hat's was not checked. Ask Lenovo.
- The Verdin iMX95's speed, the i5-8500T's speed and the Eurotech and Dell processors' speeds
  are estimates or floors, not measurements.
- The security pack ([docs/security](../security/README.md)) is a draft; its support periods are
  a proposal for the owner to confirm, and private reporting must be switched on in the
  repository's settings before [SECURITY.md](../../SECURITY.md) is true.

## The research reports

Working notes written on 11 November 2026 by automated research, each with its sources and a
"could not confirm" section. Several makers' and government sites refuse automated reading;
where that happened the report says so and names what it used instead. Three have a second,
independent re-check (`*.verify.md`).

| Report | What it covers |
|---|---|
| [U1](research/U1-rpi-alert-portability.md) | How tied RPi ALERT is to a Raspberry Pi, and what a security reviewer would see in it |
| [U2](research/U2-decoder-cost-and-bench.md) | What decoding costs, what ALERT2 adds, a benchmark, the sizing rule |
| [U3](research/U3-open-alert-site-and-claims.md) | How this site is built, and the claims the trial rests on, with the places the repository disagrees with itself |
| [R1](research/R1-toradex-verdin-mallow.md) | The Verdin AM62 and Mallow: prices, parts, ports, secure boot, design files |
| [R1 re-check](research/R1-toradex-verdin-mallow.verify.md) | A second reader re-opened R1's sources: the price and the heatsink stand |
| [R2](research/R2-toradex-luna-sl1680.md) | The Luna SL1680 |
| [R2 re-check](research/R2-toradex-luna-sl1680.verify.md) | A second reader re-opened R2's sources |
| [R3](research/R3-os-firmware-strategy.md) | Operating-system and firmware routes compared |
| [R4](research/R4-au-gov-it-security.md) | What Australian government IT security asks of a small computer |
| [R4 re-check](research/R4-au-gov-it-security.verify.md) | A second reader re-opened R4's sources, and found a certified fast computer the first report missed |
| [R5](research/R5-open-hardware-boards.md) | Open-hardware boards and where to buy them in Australia |
| [R6](research/R6-industrial-arm-gateways.md) | Industrial ARM computers and gateways: Moxa, CompuLab and others |
| [R7](research/R7-x86-boxes.md) | Small PCs with a TPM and Secure Boot: big-brand, fanless industrial and cheap |
| [R8](research/R8-cpu-performance.md) | Processor speeds against a Raspberry Pi 4, and how far each can be trusted |
| [R9](research/R9-alert2-demands.md) | What ALERT2 will ask of a base station |
| [R10](research/R10-custom-hardware-and-sdr.md) | A board of our own, and the radio |
