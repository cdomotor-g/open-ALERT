# Hardware review: a base station that is not a Raspberry Pi

**Interim — 11 November 2026.** The question: which computer, other than a Raspberry Pi, can
run an ALERT receiving base station, be as open as possible, pass IT security review on an
Australian government, council or water-authority network, be bought in Australia at a
sensible price, and have room for network growth and ALERT2?

This is a review of the [Mallow trial](../../site/trial.html) and everything it assumed.
It is **not finished**: seven of sixteen research reports are in. The reports on open-hardware
boards, industrial ARM computers, ordinary small PCs, processor speeds, ALERT2 and a custom
board have not been done, and none of the findings below has had its second, independent
check. Where something is a lead and not a finding, it says so.

## The short version

1. **No rewrite is needed.** RPi ALERT's agent (the program that decodes and sends) already
   runs unchanged off a Raspberry Pi: all 247 of its own tests pass on plain Ubuntu on an
   ordinary PC processor, and its signed release ran in a locked-down container. Only its
   installer and its SD-card image are Raspberry Pi-specific.
2. **Do not run the Mallow trial as it is written, and do not order its parts yet.** The
   module's price has roughly tripled, one part on the shopping list does not fit, the speed
   figure it rests on was never measured, and its software recipe is the hardest kind to get
   approved. The table below has each point.
3. **What gets a computer through IT security is mostly not the board.** It is the operating
   system (is it one the organisation's tools know, and who patches it), how it is run
   (updates, accounts, logs) and who the supplier is. No Australian rule or guidance naming
   Raspberry Pi was found. The board matters through its maker, how long its start-up software
   is supported, and whether it has secure boot (it refuses to start software nobody signed)
   and a TPM (a chip that keeps keys).
4. **The strongest first choice is an ordinary small 64-bit PC** from a brand the IT
   department already buys, with secure boot and a TPM, running stock Debian 13 or Ubuntu.
   It is the only kind of computer where the start-up chain, the system, Node.js and the
   radio driver are all signed and patched by the operating system's own maker. *Specific
   models, Australian prices and stock have not been researched yet.*
5. **ALERT2 needs fast single cores.** Each channel is decoded on one processor core. A
   fully used ALERT2 channel needs more than one whole Raspberry Pi 4 core with today's
   software. The sizing rule that follows: at least four cores, each at least 2.5 times a
   Pi 4 core. The Verdin AM62 and the Luna SL1680 both miss it.
6. **The software route is settled**: one signed package that installs on any Debian or
   Ubuntu computer, the same thing as a locked-down container for hosts that want one, and
   ready-to-flash images for chosen computers. A first version is in [`firmware/`](../../firmware/),
   unfinished.

## The Mallow trial, claim by claim

| What the trial says or assumes | What the review found | Verdict |
|---|---|---|
| Industrial parts and no Raspberry Pi name will pass IT security | Reviewers ask about the operating system, patching, accounts, logs and the supplier. The board's name is not on any Australian deny list ([R4](research/R4-au-gov-it-security.md)) | Wrong premise |
| Verdin AM62 Quad: A$566 at element14, "a third of that direct from Toradex" (US$107.40) | Toradex now lists it at US$306.00 for one. Module, Mallow and heatsink come to US$421, about A$750–800 including GST landed ([R1](research/R1-toradex-verdin-mallow.md)) | Out of date |
| Heatsink part 23111001 | Marked "not compatible Verdin AM62" and in last-time-buy. The right one is 23111101 ([R1](research/R1-toradex-verdin-mallow.md)) | Wrong part |
| An AM62 is "half a Raspberry Pi 4" | Each repository cites the other for the figure. Nobody has run the decoder on that kind of core ([U3](research/U3-open-alert-site-and-claims.md)) | Never measured |
| Four channels take about a third of it | The builder's sums are 2.5 to 4 times lower than RPi ALERT's own Pi 4 measurements for the work between bursts. On default settings one channel in a wide window is about one whole AM62 core ([U2](research/U2-decoder-cost-and-bench.md)) | Too hopeful |
| It fits with "filter only around bursts" and the Light decoder | Both are off by default. "Around bursts" missed weak bursts in its only field check; Light has had no field check ([U2](research/U2-decoder-cost-and-bench.md)) | Unproven |
| Mallow has two USB 3 ports and an M.2 slot for a radio card | With any AM62 the ports run at USB 2.0 on one shared bus, and the slot has no PCIe. Fine for RTL-SDR sticks; not for a radio card ([R1](research/R1-toradex-verdin-mallow.md)) | Partly wrong |
| Mallow's design files are published, so it is the base for an open custom board | Free to download behind a form, but marked "all rights reserved": not an open-source licence ([R1](research/R1-toradex-verdin-mallow.md)) | Overstated |
| Available to 2033 and beyond, twelve years | 2033 is seven years away ([R1](research/R1-toradex-verdin-mallow.md)) | Overstated |
| (not mentioned) secure boot | Documented for the AM62, but Toradex staff called it "still an Early Access feature" on 10 November 2026 ([R1](research/R1-toradex-verdin-mallow.md)) | Not ready |
| Torizon OS, then RPi ALERT in a privileged container built from the unsigned main branch | The hardest stack to get approved: not on the security tools' supported lists, no hardening benchmark, and privileged containers are a standard finding. The signed release runs in a container with no privileges at all ([R3](research/R3-os-firmware-strategy.md), [R4](research/R4-au-gov-it-security.md), [U1](research/U1-rpi-alert-portability.md)) | Replace |
| Install plain Debian on the Verdin instead | Toradex: "neither supported nor recommended" ([R3](research/R3-os-firmware-strategy.md)) | Not a route |
| The Luna SL1680 "should work" | Toradex sells it "for evaluation/development". Chip-maker's own kernel, five-year commitment, no Australian stock, about 1.2 times a Pi 4 ([R2](research/R2-toradex-luna-sl1680.md)) | Comparison only |

**On the worry that a container wastes processor power:** it does not. Measured cost is
0–4%. The real costs of Torizon-plus-container are about 110 MB of memory, 250–350 MB of
disk, two separate streams of security patches to follow, and a secure-boot chain that does
not cover the container. So the instinct was right about complexity, not about speed
([R3](research/R3-os-firmware-strategy.md)).

## What an IT security reviewer will ask

From [R4](research/R4-au-gov-it-security.md), in the order it tends to matter:

- **The operating system**: is it supported, who patches it and how fast, is there a
  hardening benchmark, do our scanning and endpoint tools run on it? Ubuntu LTS answers the
  most of these; Debian nearly as many; Torizon and Raspberry Pi OS the fewest.
- **The application**: what listens on the network, what runs as the administrator, can the
  supplier change or update it remotely, are updates signed, is there a list of everything
  inside it, does it work through our web proxy, where do logs go?
- **The supplier**: who owns them, is there a security contact, a way to report a flaw, a
  stated support period?
- **The hardware**: brand and owner, secure boot, TPM, how long its start-up software gets fixes.
- **The network**: a base station on its own mobile link, off the customer's network,
  shrinks the whole approval to hosting and data questions.

There is no single approval. The Bureau follows the Commonwealth's Information Security
Manual process. Councils have guidance, not rules. Large water utilities fall under
critical-infrastructure rules that tightened in June 2026.

How hard each kind of computer is to get through, easiest first: a big-brand small PC
running Ubuntu; an industrial gateway with an IEC 62443 security certificate (but the ARM
ones found are at or below a Pi 4 in speed); an industrial module on a carrier, or a
Raspberry Pi Compute Module in an industrial case, running Ubuntu; small-maker open-hardware
boards.

## Where the hardware search stands

Not yet researched: models, Australian prices, stock and links. These are **leads to
check, not recommendations**:

- Big-brand small PCs: Dell OptiPlex or Pro Micro, HP Elite or Pro Mini, Lenovo ThinkCentre
  Tiny or ThinkEdge.
- Fanless industrial PCs: OnLogic, Advantech, AAEON, DFI, ASRock Industrial; some are
  certified by Ubuntu's maker.
- Low-cost small PCs on Intel's N100 or N150 as the price floor. The builder already lists
  one, with unsourced figures.
- Open-hardware ARM: BeaglePlay has the Verdin's chip, published design files and plain
  Debian, but its chip can never do secure boot, and it has the same slow cores.
- Staying with Toradex: a Verdin iMX95 fits the same Mallow carrier for about US$30 more
  than the AM62 Quad, with six newer cores. Its datasheet is still preliminary.

Because of the ALERT2 rule above, expect the small PCs to win on speed for the money. That
expectation still has to be checked against measured figures.

## The software route

```
 RPi ALERT's signed release (unchanged, signature checked)
        │
        ├── a package for any Debian 13 / Ubuntu 24.04 computer   ← the main form
        ├── the same in a container with no privileges            ← for Torizon and container hosts
        └── ready-to-flash images for chosen computers            ← for people who just want it to work
```

Two profiles: **standard** (like a Pi base station on a small network) and **enterprise**
(no hotspot, no remote changes from Flood-Net, no self-reboots, dashboard reachable from the
machine itself only, works through a web proxy).

## What is done, and what is left

Done:

- Seven research reports (below).
- [`firmware/`](../../firmware/): the pinned-release check, the package builder and a
  benchmark, unfinished. See its README for exactly what has been tried.
- [`wip/rpi-alert-0.24-managed-network.patch`](wip/rpi-alert-0.24-managed-network.patch): an
  unfinished, unreviewed change to RPi ALERT adding the settings a managed network needs
  (listen address, accepted host names, behind-a-proxy, login for everything, a log line per
  login). Not applied anywhere.

Left, in order:

1. Research the hardware classes above: models, measured speed against a Pi 4, Australian
   price, stock and where to buy.
2. Re-check the findings in this document from their sources.
3. Finish and test `firmware/`: the package's tests, the container, a disk image, the
   automatic build.
4. Review and release the RPi ALERT settings, then point the firmware at that release.
5. Put the chosen computers in the catalogue and the builder, and correct the builder's
   processor sums to RPi ALERT's own measurements.
6. Build the page for exploring all of this: comparison tables, prices, where to buy,
   diagrams and photos.
7. Rewrite the trial page around the computer chosen.

## The research reports

Working notes written on 11 November 2026 by automated research, each with its sources and
a "could not confirm" section. Several makers' and government sites refuse automated
reading; where that happened the report says so and names what it used instead.

| Report | What it covers |
|---|---|
| [U1](research/U1-rpi-alert-portability.md) | How tied RPi ALERT is to a Raspberry Pi, and what a security reviewer would see in it |
| [U2](research/U2-decoder-cost-and-bench.md) | What decoding costs, what ALERT2 adds, a benchmark, the sizing rule |
| [U3](research/U3-open-alert-site-and-claims.md) | How this site is built, and all 91 claims the trial rests on, with 18 places the repository disagrees with itself |
| [R1](research/R1-toradex-verdin-mallow.md) | The Verdin AM62 and Mallow: prices, parts, ports, secure boot, design files |
| [R2](research/R2-toradex-luna-sl1680.md) | The Luna SL1680 |
| [R3](research/R3-os-firmware-strategy.md) | Operating-system and firmware routes compared |
| [R4](research/R4-au-gov-it-security.md) | What Australian government IT security asks of a small computer |
