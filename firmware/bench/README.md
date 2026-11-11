# The benchmark: how many channels will this computer carry?

`open-alert-bench.js` answers one question before you buy a batch of computers
for base stations: **how many radio channels can this one decode?**

A "channel" is one radio frequency a base station listens on. Each channel is
decoded by its own piece of the program, and that piece runs on one processor
core (one of the several workers inside the computer's processor). So the
answer depends on how fast one core is and how many cores there are.

It times RPi ALERT's own decoding code (the agent: the program that turns radio
signals into flood readings). Nothing is re-written here, so the numbers are
the agent's own.

**Honest limits.** Nothing here has been run with a real radio stick on a
computer that is not a Raspberry Pi. The benchmark measures decoding only: not
the radio sticks, USB, the `rtl_sdr` program that reads them, the agent's web
page, or the screen dashboard (a browser, about half a Raspberry Pi 4 core by
itself). It also does not measure heat: a run lasts minutes, and a fanless
computer in a hot cabinet may slow down after hours.

## What it needs

- Node.js 18 or later (nothing else; no packages).
- A copy of the agent. On a computer with the `open-alert-base` package it is
  found by itself (`/usr/lib/open-alert-base/agent`, then `/opt/rpi-alert`).
  Otherwise unpack an RPi ALERT release and give the `agent` folder.
- About 450 MB of free memory (it uses up to about 350 MB while it runs).
- It needs **no network, no radio stick and no administrator rights**. It only
  reads the agent's folder, opens no port and no device, and writes a file only
  if you ask with `--out`. On a computer that is already running a base station
  it costs processor time and nothing else, but run it when the station is quiet
  if you can, because a busy computer gives worse figures.

## How to run it on a candidate computer

```sh
# A quick look, about a minute on a desktop-class computer:
node open-alert-bench.js /path/to/agent --quick

# The full run, about four minutes (five times as long on a Raspberry Pi 4).
# Run it on an otherwise idle computer, and describe the computer with --label:
node open-alert-bench.js /path/to/agent --full \
  --label="Acme MiniPC N100, 16 GB, fanless" --out=result.json
```

With `open-alert-base` installed, `open-alert-base bench` runs it for you.

Other options: `--json` prints the full figures instead of the summary;
`--show=result.json` prints the summary of a saved result without measuring;
`--fixtures=DIR` takes the recorded bursts from a release's `test/fixtures`
folder; `--quiet` hides progress. It ends with status 0 when everything was
measured and every test burst was read correctly, 1 when a part did not run or
a burst was read wrongly, and 2 when it could not start.

## What it measures

| Part | What it is |
|---|---|
| `burst` | Milliseconds to decode one burst with each decoder (Full, Lean, Light), on the agent's real off-air recordings. Lean is the one the agent uses unless told otherwise. |
| `alert2` | An ALERT2 burst the way the agent handles it: tried as an older ALERT burst first, then decoded as ALERT2. |
| `betweenBursts` | What a channel costs while nothing is on the air, as a share of one core, at each window (the slice of radio band a stick hands over): 240 kHz, 960 kHz, 1.44 MHz, 2.4 MHz. |
| `parallel` | The same with every core busy at once, since cores share memory and heat. |
| `memory` | Memory one channel adds. |
| `traffic` | One channel through the agent's real decoder worker under older-ALERT and ALERT2 traffic. |
| `timesARaspberryPi4`, `capacity`, `alert2Headroom`, `sizing`, `selfCheck` | Worked out from the above. |

It also checks that every recorded burst is read correctly on this computer;
a computer that decodes wrongly is not "fast", it is broken.

## How to read the result

The summary ("IN SHORT") has five lines:

1. **One core compared with a Raspberry Pi 4 core**, and
2. **the whole computer compared with a Raspberry Pi 4.**
3. **Channels it carries today**: "comfortably" keeps the processor at no more
   than about half busy on a busy day; "at the very most" is the ceiling on a
   storm day. The count uses this computer's own figures and a safety margin of
   1.6 (a Pi 4 ran each decoder about 1.6 times busier under real load than the
   bench said). The count does not depend on the Pi 4 comparison.
4. **The ALERT2 headroom rule**: at least four cores, each at least 2.5 times a
   Raspberry Pi 4 core. The reason: one ALERT2 channel with every half-second
   slot used is more work than one Pi 4 core can do, and a channel can never
   use more than one core, however many cores there are.
5. **Decoder check**: every test burst read correctly.

**How far to trust the Pi 4 comparison.** Nobody has run this tool on a
Raspberry Pi 4 yet. The comparison rests on three figures from RPi ALERT's own
notes, taken on a busy Pi 4 running an older agent (0.15), and one round figure
from a sentence ("a second or so"). A measurement taken while the Pi was also
working reads high, which makes a Pi 4 look slower than it is and any other
computer look faster against it. The summary lists each figure with the file and
line it came from. Treat the comparison as a rough guide, and once somebody
has run the tool on a real Pi 4, replace those figures (the table `PI4` near
the top of the script) with the measured ones.

**Rules of thumb.** Trust the channel count more than the "times a Pi 4" lines.
A fanless or small computer should be run twice, the second time after ten
minutes of the first, to see if it slows. Take the lower of the two.

## How to send a result back

Run the full mode (`--full`) on an idle computer with `--label` and `--out`,
then follow [results/README.md](results/README.md): it says what a result must
hold and how to name the file. The file contains the figures and a description
of the computer, and no names, addresses or serial numbers.

## Checking the tool itself

`./test.sh [AGENT_FOLDER]` runs the quick mode (about a minute), takes the network
away and the user's rights away when it can, and checks the result holds every
field with sensible values, that nothing in the agent's folder changed, and that
a saved result prints back the same. It defaults to `/home/user/RPi_ALERT/agent`
when that exists, then the installed package's agent.

## What has been run, where

| What | Where | Result |
|---|---|---|
| `test.sh` (quick mode, as the user `nobody`, no network) | Shared 4-core virtual machine, Intel Xeon 2.1 GHz, Ubuntu 24.04, Node 22.23, agent 0.23.1 | 11 checks passed, 2026-11-11 |
| Full run | The same machine | 12 channels comfortably, 24 at the very most; about 4.8 Pi 4 cores per core (see [results/](results/)) |
| Any ARM computer, any Raspberry Pi, Node 18 or 20 | Not run | Not run |
| Any real radio stick on non-Pi hardware | Not run | Not run |

The one sample is a shared virtual machine and was already a little busy
(load 1.4 at the start), so its figures are a rough guide and say little about
what a dedicated small computer would do.
