# U2 — What the decoding costs, how ALERT2 changes it, and a benchmark anyone can run

Written 2026-11-11. Everything here was read from the local checkouts — RPi_ALERT at `37fee8bc` (agent 0.23.1), MegaNet at `ac3e773b`, open-ALERT at `c4670161` — or measured in this session. No live database was queried and nothing in any repository was changed. The links are the same files on GitHub at those commits, with the lines; they were built from the local files, not fetched.

Words used here: a **window** is the slice of the band a stick hands over, as wide as its sample rate. **Between bursts** is the work a channel does while nothing is on the air. A **Pi 4 core** is one of a Raspberry Pi 4's four Cortex-A72 cores; "cores" without more means cores of the computer measured.

## 0. What should change a decision

1. **The limit ALERT2 growth hits first is the speed of one core, not the number of cores.** Each channel is decoded in one thread and can never use more than one core ([RPi_ALERT docs/how-it-works.md:72-77](https://github.com/cdomotor-g/RPi_ALERT/blob/37fee8bc/docs/how-it-works.md#L72-L77), [RPi_ALERT agent/lib/devices/sdr.js:128-129](https://github.com/cdomotor-g/RPi_ALERT/blob/37fee8bc/agent/lib/devices/sdr.js#L128-L129)). Measured here end to end through the agent's real worker thread, an ALERT2 channel with every half-second TDMA slot used costs 0.27 of a core of this machine with today's default decoder, which is about 1.1–1.3 Pi 4 cores (section 3.4). A Pi 4-class core cannot keep up with that; it falls behind and drops samples. Ask for cores at least **2.5 times a Pi 4 core**.
2. **Today's load is modest and the model fits the field.** Four channels in one 1.44 MHz window come to about 2.2–2.5 Pi 4 cores; eight channels on two sticks in 960 kHz windows to about 2.5–4.4 (section 5). That is consistent with what the first base station saw: a Pi 4 is comfortable with four and full with eight.
3. **An ALERT2 burst costs about 1.6 times a legacy burst**, because every burst is tried with the legacy decoder first and only then as ALERT2 ([RPi_ALERT agent/lib/devices/sdr-worker.js:15-18](https://github.com/cdomotor-g/RPi_ALERT/blob/37fee8bc/agent/lib/devices/sdr-worker.js#L15-L18)). The ALERT2 decode on its own is cheaper than a legacy decode (49 ms against 83 ms here). The higher bit rate is not what costs.
4. **The Verdin AM62 sizing rests on two decoder modes that are not proven.** The table that gives the AM62 its place ([RPi_ALERT docs/hardware.md:210-218](https://github.com/cdomotor-g/RPi_ALERT/blob/37fee8bc/docs/hardware.md#L210-L218)) assumes *Filter only around bursts* and the *Light* decoder. The first missed weak bursts in its only field check and stays off by default ([RPi_ALERT docs/configuration.md:169-179](https://github.com/cdomotor-g/RPi_ALERT/blob/37fee8bc/docs/configuration.md#L169-L179)); the second has not been checked in the field ([RPi_ALERT docs/roadmap.md:93-94](https://github.com/cdomotor-g/RPi_ALERT/blob/37fee8bc/docs/roadmap.md#L93-L94)); and the check has never compared ALERT2 frames ([RPi_ALERT docs/configuration.md:175-176](https://github.com/cdomotor-g/RPi_ALERT/blob/37fee8bc/docs/configuration.md#L175-L176)). With the defaults, a core half a Pi 4's is at about one whole core for a single channel in a 1.44 MHz window before any burst arrives (section 6).
5. **The Pi 4 reference numbers are thin.** Three bench figures from one busy Pi 4 on agent 0.15.x, and two round figures in prose. Nobody has timed a named recording on a Pi 4. "Times a Pi 4" for this machine comes out between 3.8 and 5.9 depending on the measure. One run of the script below on an idle Pi 4 would replace all of them.
6. **open-ALERT's builder model prices decoding lower than RPi ALERT's own Pi 4 figures** (section 6): 0.04 of a core for a 240 kHz channel where the Pi 4 measured 0.06; window multipliers of 3.7 and 4.1 where the Pi 4 measured 4.5 and 5.2; no allowance for the 1.6 times a loaded Pi showed; 30 MB a channel where the docs say 40 and this machine measured 43; and an ALERT2 burst priced as a legacy one.
7. **A benchmark exists.** `bench-draft.js` takes an agent directory, needs only Node, runs about three minutes (40 s with `--quick`) and prints JSON with three pass/fail sizing checks (section 3).

## 1. The cost model in the repositories

### 1.1 How threads are used

| Fact | Source |
|---|---|
| One `rtl_sdr` process per stick streams 8-bit IQ to the agent; each channel in the window has a worker thread of its own running Flood-Net's `AlertDsp.Pipeline`, all fed the same stream | [RPi_ALERT docs/how-it-works.md:72-77](https://github.com/cdomotor-g/RPi_ALERT/blob/37fee8bc/docs/how-it-works.md#L72-L77), [RPi_ALERT agent/lib/devices/sdr.js:5-10](https://github.com/cdomotor-g/RPi_ALERT/blob/37fee8bc/agent/lib/devices/sdr.js#L5-L10) |
| "a burst on one channel never waits for a decode on another: they run on separate cores" | [RPi_ALERT docs/how-it-works.md:77](https://github.com/cdomotor-g/RPi_ALERT/blob/37fee8bc/docs/how-it-works.md#L77) |
| The worker is a Node `worker_threads` Worker (`sdr-worker.js`), one per channel, restarted if it exits | [RPi_ALERT agent/lib/devices/sdr.js:128-141](https://github.com/cdomotor-g/RPi_ALERT/blob/37fee8bc/agent/lib/devices/sdr.js#L128-L141) |
| The main thread copies every chunk once per channel and hands it over | [RPi_ALERT agent/lib/devices/sdr.js:183-185](https://github.com/cdomotor-g/RPi_ALERT/blob/37fee8bc/agent/lib/devices/sdr.js#L183-L185), [RPi_ALERT agent/lib/devices/sdr.js:654-656](https://github.com/cdomotor-g/RPi_ALERT/blob/37fee8bc/agent/lib/devices/sdr.js#L654-L656) |
| Every channel's decoder takes in the whole window and filters its own channel out of it; there is no shared front end | [RPi_ALERT docs/hardware.md:58-63](https://github.com/cdomotor-g/RPi_ALERT/blob/37fee8bc/docs/hardware.md#L58-L63), [RPi_ALERT docs/roadmap.md:95-97](https://github.com/cdomotor-g/RPi_ALERT/blob/37fee8bc/docs/roadmap.md#L95-L97) |
| At most 8 channels a stick, each a decoder thread | [RPi_ALERT agent/web/sdr-plan.js:80](https://github.com/cdomotor-g/RPi_ALERT/blob/37fee8bc/agent/web/sdr-plan.js#L80), [RPi_ALERT docs/hardware.md:114](https://github.com/cdomotor-g/RPi_ALERT/blob/37fee8bc/docs/hardware.md#L114) |
| *Decoder busy* is the worker's event-loop utilisation, sampled every 2 s and smoothed: the share of one core that channel takes, bursts and all | [RPi_ALERT agent/lib/devices/sdr.js:151-163](https://github.com/cdomotor-g/RPi_ALERT/blob/37fee8bc/agent/lib/devices/sdr.js#L151-L163), [RPi_ALERT agent/lib/devices/sdr.js:545](https://github.com/cdomotor-g/RPi_ALERT/blob/37fee8bc/agent/lib/devices/sdr.js#L545) |
| A decoder may fall 20 s behind (within 2 % of memory, never under 5 s) before its samples are dropped | [RPi_ALERT agent/lib/devices/sdr.js:70-81](https://github.com/cdomotor-g/RPi_ALERT/blob/37fee8bc/agent/lib/devices/sdr.js#L70-L81), [RPi_ALERT docs/hardware.md:98-100](https://github.com/cdomotor-g/RPi_ALERT/blob/37fee8bc/docs/hardware.md#L98-L100) |
| A burst's decode runs inside the channel's own thread, so it holds that channel up for its length | [RPi_ALERT agent/lib/devices/sdr-worker.js:6-7](https://github.com/cdomotor-g/RPi_ALERT/blob/37fee8bc/agent/lib/devices/sdr-worker.js#L6-L7) |

So it scales across cores up to one core per channel, and no further. Measured here: four threads at once cost 1.13–1.22 times one alone each (section 3.3). On the loaded Pi 4 at the first base station each decoder ran about 1.6 times what the bench says ([RPi_ALERT docs/roadmap.md:113-114](https://github.com/cdomotor-g/RPi_ALERT/blob/37fee8bc/docs/roadmap.md#L113-L114)).

### 1.2 Between bursts, by window

| Window | Relative cost in the docs | Pi 4, by the agent's own bench | Source |
|---|---|---|---|
| 240 kHz | 1× | 6 % of a core | [RPi_ALERT docs/hardware.md:66-73](https://github.com/cdomotor-g/RPi_ALERT/blob/37fee8bc/docs/hardware.md#L66-L73), [RPi_ALERT docs/roadmap.md:112-113](https://github.com/cdomotor-g/RPi_ALERT/blob/37fee8bc/docs/roadmap.md#L112-L113) |
| 960 kHz | 3× | not written down | [RPi_ALERT docs/hardware.md:66-73](https://github.com/cdomotor-g/RPi_ALERT/blob/37fee8bc/docs/hardware.md#L66-L73) |
| 1.2 MHz | 3.7× | 27 % | [RPi_ALERT docs/hardware.md:66-73](https://github.com/cdomotor-g/RPi_ALERT/blob/37fee8bc/docs/hardware.md#L66-L73), [RPi_ALERT docs/roadmap.md:112-113](https://github.com/cdomotor-g/RPi_ALERT/blob/37fee8bc/docs/roadmap.md#L112-L113) |
| 1.44 MHz | 4.1× | 31 % | [RPi_ALERT docs/hardware.md:66-73](https://github.com/cdomotor-g/RPi_ALERT/blob/37fee8bc/docs/hardware.md#L66-L73), [RPi_ALERT docs/roadmap.md:112-113](https://github.com/cdomotor-g/RPi_ALERT/blob/37fee8bc/docs/roadmap.md#L112-L113) |
| 1.92 MHz | 5.1× | not written down | [RPi_ALERT docs/hardware.md:66-73](https://github.com/cdomotor-g/RPi_ALERT/blob/37fee8bc/docs/hardware.md#L66-L73) |
| 2.4 MHz | 6.3× | not written down | [RPi_ALERT docs/hardware.md:66-73](https://github.com/cdomotor-g/RPi_ALERT/blob/37fee8bc/docs/hardware.md#L66-L73) |

Other figures on the same subject:

| Fact | Source |
|---|---|
| The same multipliers are the planner's `COST` table | [RPi_ALERT agent/web/sdr-plan.js:72](https://github.com/cdomotor-g/RPi_ALERT/blob/37fee8bc/agent/web/sdr-plan.js#L72) |
| The decoder itself works at 240 ksps whatever the window; a wider window is more work and (8-bit samples) hears weak bursts a little better | [RPi_ALERT docs/hardware.md:59-63](https://github.com/cdomotor-g/RPi_ALERT/blob/37fee8bc/docs/hardware.md#L59-L63), [RPi_ALERT agent/web/sdr-plan.js:12-16](https://github.com/cdomotor-g/RPi_ALERT/blob/37fee8bc/agent/web/sdr-plan.js#L12-L16) |
| Bench Pi 4, two sticks of two channels, bursts and all: 0.49 of a core in 960 kHz windows, 0.26 in 240 kHz (0.12 and 0.065 a channel) | [RPi_ALERT docs/hardware.md:77-78](https://github.com/cdomotor-g/RPi_ALERT/blob/37fee8bc/docs/hardware.md#L77-L78) |
| On a PC (2026-10-24): 1.2 MHz 5.7 % of a core, 2.7 % with the first filter taken out, 240 kHz 1.5 % | [RPi_ALERT docs/roadmap.md:109-112](https://github.com/cdomotor-g/RPi_ALERT/blob/37fee8bc/docs/roadmap.md#L109-L112) |
| Loaded Pi 4: each decoder about 1.6 times its bench figure; 152.400 alone and quiet, 0.44 of a core in 1.2 MHz | [RPi_ALERT docs/roadmap.md:113-114](https://github.com/cdomotor-g/RPi_ALERT/blob/37fee8bc/docs/roadmap.md#L113-L114) |
| 0.17 fills the rings a block at a time ("a quarter less work between bursts") and works out the spectrum on a stick's first channel only ("another sixth") | [RPi_ALERT docs/roadmap.md:78-80](https://github.com/cdomotor-g/RPi_ALERT/blob/37fee8bc/docs/roadmap.md#L78-L80), [RPi_ALERT docs/configuration.md:188-189](https://github.com/cdomotor-g/RPi_ALERT/blob/37fee8bc/docs/configuration.md#L188-L189) |
| The agent measures this itself 90 s after it starts: 0.4 s of noise a window, best of three, in a thread of its own | [RPi_ALERT agent/lib/devices/sdr-bench.js:17-26](https://github.com/cdomotor-g/RPi_ALERT/blob/37fee8bc/agent/lib/devices/sdr-bench.js#L17-L26), [RPi_ALERT agent/lib/agent.js:50-52](https://github.com/cdomotor-g/RPi_ALERT/blob/37fee8bc/agent/lib/agent.js#L50-L52) |
| Flood-Net's notes, a PC, per second of signal: 6–8 ms at 240 ksps, 39 at 960 ksps, 94 at 2.4 Msps | [MegaNet docs/serial-sdr.md:68-70](https://github.com/cdomotor-g/MegaNet/blob/ac3e773b/docs/serial-sdr.md#L68-L70) |

The Pi 4's own ratios are steeper than the table: 27 / 6 = 4.5 times at 1.2 MHz and 31 / 6 = 5.2 times at 1.44 MHz, against 3.7 and 4.1. The table matches an x86 machine (this one measured 3.6 and 3.9, section 3.2).

### 1.3 One burst's decode: Full, Lean, Light

| Decoder | What it does | Cost in the docs | Source |
|---|---|---|---|
| Full | 3 carrier candidates × 3 tone guesses × 5 nudges = 45 tries, the window filtered again for each (121 taps at 240 ksps) | "a second or so on a Pi 4"; "a second or two on a Pi" | [RPi_ALERT docs/hardware.md:76-77](https://github.com/cdomotor-g/RPi_ALERT/blob/37fee8bc/docs/hardware.md#L76-L77), [RPi_ALERT agent/lib/devices/sdr-worker.js:6-7](https://github.com/cdomotor-g/RPi_ALERT/blob/37fee8bc/agent/lib/devices/sdr-worker.js#L6-L7), [RPi_ALERT agent/vendor/meganet/alert-dsp.js:576-590](https://github.com/cdomotor-g/RPi_ALERT/blob/37fee8bc/agent/vendor/meganet/alert-dsp.js#L576-L590) |
| Lean (default since 0.17) | Filters once for each of 9 guesses, nudges afterwards on the 12 kHz baseband | 33–34 % of Full's time on the Pi 4 at the first base station; 14 of 11,628 live bursts read differently (0.12 %) | [RPi_ALERT docs/roadmap.md:75-78](https://github.com/cdomotor-g/RPi_ALERT/blob/37fee8bc/docs/roadmap.md#L75-L78), [RPi_ALERT docs/configuration.md:125-128](https://github.com/cdomotor-g/RPi_ALERT/blob/37fee8bc/docs/configuration.md#L125-L128) |
| Light (0.19) | The window to 48 kHz once, then the 9 guesses from there | About half of Lean: 65 ms against 122 on Flood-Net's bench (a PC); 61 against 128 on the rig recording | [RPi_ALERT docs/configuration.md:130-134](https://github.com/cdomotor-g/RPi_ALERT/blob/37fee8bc/docs/configuration.md#L130-L134), [MegaNet docs/serial-sdr.md:76-88](https://github.com/cdomotor-g/MegaNet/blob/ac3e773b/docs/serial-sdr.md#L76-L88) |
| Compare / Compare light | Decodes each burst both ways and counts differences | "about half as much again per burst", skipped while bursts wait | [RPi_ALERT docs/configuration.md:135-140](https://github.com/cdomotor-g/RPi_ALERT/blob/37fee8bc/docs/configuration.md#L135-L140) |

A decode window is the burst and 0.4 s either side, never under 1.2 s; a burst is cut at 3 s; a burst under 60 ms is ignored ([RPi_ALERT agent/vendor/meganet/alert-dsp.js:1251-1264](https://github.com/cdomotor-g/RPi_ALERT/blob/37fee8bc/agent/vendor/meganet/alert-dsp.js#L1251-L1264)). A burst that decodes to nothing still costs a whole decode ([RPi_ALERT docs/hardware.md:112-113](https://github.com/cdomotor-g/RPi_ALERT/blob/37fee8bc/docs/hardware.md#L112-L113)). There is no Pi 4 figure in milliseconds for Lean or Light, and none for any named recording.

### 1.4 Filter only around bursts

| Fact | Source |
|---|---|
| The last 1.4 s of the window kept as bytes; the channel looked at 25 times a second; the pipeline filters from 0.8 s before something shows to half a second after | [RPi_ALERT agent/vendor/meganet/alert-dsp.js:1413-1414](https://github.com/cdomotor-g/RPi_ALERT/blob/37fee8bc/agent/vendor/meganet/alert-dsp.js#L1413-L1414), [RPi_ALERT docs/configuration.md:152-160](https://github.com/cdomotor-g/RPi_ALERT/blob/37fee8bc/docs/configuration.md#L152-L160) |
| A quiet channel costs "from 2½ times less at 240 kHz to about 20 times less at 2.4 MHz"; "a sixth to a twentieth" | [RPi_ALERT docs/configuration.md:157-158](https://github.com/cdomotor-g/RPi_ALERT/blob/37fee8bc/docs/configuration.md#L157-L158), [RPi_ALERT docs/hardware.md:200-204](https://github.com/cdomotor-g/RPi_ALERT/blob/37fee8bc/docs/hardware.md#L200-L204) |
| A PC, per second of signal: 2.6 ms against 6–8 at 240 ksps, 3.0 against 39 at 960 ksps, 4.4 against 94 at 2.4 Msps | [MegaNet docs/serial-sdr.md:68-70](https://github.com/cdomotor-g/MegaNet/blob/ac3e773b/docs/serial-sdr.md#L68-L70) |
| First field check (a Pi 4, from 4 November 2026): about one reading in 13–19 came from only one of the two decoders; on 151.500 the watched one missed weak bursts 8–9 dB over the noise, and 37 % of that channel's bursts are that weak | [RPi_ALERT docs/configuration.md:169-179](https://github.com/cdomotor-g/RPi_ALERT/blob/37fee8bc/docs/configuration.md#L169-L179), [RPi_ALERT docs/roadmap.md:88-91](https://github.com/cdomotor-g/RPi_ALERT/blob/37fee8bc/docs/roadmap.md#L88-L91) |
| The check compares legacy readings only, never ALERT2 frames | [RPi_ALERT docs/configuration.md:175-176](https://github.com/cdomotor-g/RPi_ALERT/blob/37fee8bc/docs/configuration.md#L175-L176) |
| Off by default; "keep Filter every sample on any computer with the power for it" | [RPi_ALERT docs/configuration.md:176-179](https://github.com/cdomotor-g/RPi_ALERT/blob/37fee8bc/docs/configuration.md#L176-L179) |
| A window that is not a whole multiple of 240 kHz (288 kHz) is never slept through | [RPi_ALERT agent/vendor/meganet/alert-dsp.js:1459-1462](https://github.com/cdomotor-g/RPi_ALERT/blob/37fee8bc/agent/vendor/meganet/alert-dsp.js#L1459-L1462) |

### 1.5 Memory

| Fact | Source |
|---|---|
| About 40 MB a channel (its own decoder thread) | [RPi_ALERT docs/hardware.md:114](https://github.com/cdomotor-g/RPi_ALERT/blob/37fee8bc/docs/hardware.md#L114), [RPi_ALERT docs/hardware.md:220-221](https://github.com/cdomotor-g/RPi_ALERT/blob/37fee8bc/docs/hardware.md#L220-L221) |
| Since 0.19 a 5 s decode ring rather than 8 and no capture bytes: "about 10 MB less a channel" | [RPi_ALERT docs/configuration.md:184-186](https://github.com/cdomotor-g/RPi_ALERT/blob/37fee8bc/docs/configuration.md#L184-L186), [RPi_ALERT agent/lib/devices/sdr.js:493-495](https://github.com/cdomotor-g/RPi_ALERT/blob/37fee8bc/agent/lib/devices/sdr.js#L493-L495) |
| A backlog of up to 20 s of samples a channel on top when a decoder falls behind (2.88 MB a second at 1.44 MHz), capped at 2 % of memory, never under 5 s | [RPi_ALERT agent/lib/devices/sdr.js:70-81](https://github.com/cdomotor-g/RPi_ALERT/blob/37fee8bc/agent/lib/devices/sdr.js#L70-L81) |
| The screen dashboard: Chromium is "half a Pi 4 core on its own, and a few hundred MB" | [RPi_ALERT docs/hardware.md:207-208](https://github.com/cdomotor-g/RPi_ALERT/blob/37fee8bc/docs/hardware.md#L207-L208) |

Measured here: 43 MB of resident memory a channel at 1.44 MHz, 52 MB for the process without decoders (section 3.3).

### 1.6 What the first base station saw (18 Bateson, a Pi 4)

| Observation | Source |
|---|---|
| Eight channels in two 1.92 MHz windows, kiosk on: load 9, every channel dropping samples, most bursts lost | [RPi_ALERT docs/hardware.md:101-103](https://github.com/cdomotor-g/RPi_ALERT/blob/37fee8bc/docs/hardware.md#L101-L103) |
| The same eight split over two sticks in 960 kHz each: load about 4.5 | [RPi_ALERT docs/hardware.md:103-105](https://github.com/cdomotor-g/RPi_ALERT/blob/37fee8bc/docs/hardware.md#L103-L105) |
| The kiosk was the rest: screen off, load 4.7 to 2.8 | [RPi_ALERT docs/hardware.md:105-106](https://github.com/cdomotor-g/RPi_ALERT/blob/37fee8bc/docs/hardware.md#L105-L106) |
| A fifth channel on a 1.92 Msps stick put every decoder into dropping samples | [RPi_ALERT docs/roadmap.md:101-103](https://github.com/cdomotor-g/RPi_ALERT/blob/37fee8bc/docs/roadmap.md#L101-L103) |
| The ALERT2 channel, 151.5375, in 240 kHz with the full decoder: 53 % busy where a quiet channel is 6 %; its legacy decodes read 96 of 1,131 bursts, the rest ALERT2 | [RPi_ALERT docs/roadmap.md:69-71](https://github.com/cdomotor-g/RPi_ALERT/blob/37fee8bc/docs/roadmap.md#L69-L71) |
| "A Pi 4 should keep up with four channels in 1.44 MHz" (a bench-test expectation, not a result) | [RPi_ALERT docs/bench-test.md:79](https://github.com/cdomotor-g/RPi_ALERT/blob/37fee8bc/docs/bench-test.md#L79) |

### 1.7 What is planned to make it faster

| Plan | Expected gain, as written | Source |
|---|---|---|
| Learn that a channel carries only ALERT2 and skip its legacy decode | "would halve its CPU" | [RPi_ALERT docs/roadmap.md:67-71](https://github.com/cdomotor-g/RPi_ALERT/blob/37fee8bc/docs/roadmap.md#L67-L71) |
| Make *Filter only around bursts* the default, once it wakes for the weakest bursts and the check covers ALERT2 | a sixth to a twentieth between bursts | [RPi_ALERT docs/roadmap.md:84-95](https://github.com/cdomotor-g/RPi_ALERT/blob/37fee8bc/docs/roadmap.md#L84-L95) |
| Make *Light* the default after *Compare light* at the first base station | half of Lean a burst | [RPi_ALERT docs/roadmap.md:93-95](https://github.com/cdomotor-g/RPi_ALERT/blob/37fee8bc/docs/roadmap.md#L93-L95) |
| One thread per stick that converts the samples and cuts out every channel once (a polyphase filter bank), each decoder given its own 240 ksps stream | not put in numbers; the first filter is two thirds of a channel's work at 960 kHz | [RPi_ALERT docs/roadmap.md:99-107](https://github.com/cdomotor-g/RPi_ALERT/blob/37fee8bc/docs/roadmap.md#L99-L107) |
| A half-band cascade cut to the ±20 kHz the decoder reads | "roughly a third off a wide window's channel" | [RPi_ALERT docs/roadmap.md:107-109](https://github.com/cdomotor-g/RPi_ALERT/blob/37fee8bc/docs/roadmap.md#L107-L109) |
| Try Binary, then Enhanced iFLOWS only when Binary finds nothing | a convenience; it would add work on some bursts | [RPi_ALERT docs/roadmap.md:81-83](https://github.com/cdomotor-g/RPi_ALERT/blob/37fee8bc/docs/roadmap.md#L81-L83) |
| The ALERT2 decoder into Flood-Net's own code | no speed claim | [RPi_ALERT docs/roadmap.md:65-67](https://github.com/cdomotor-g/RPi_ALERT/blob/37fee8bc/docs/roadmap.md#L65-L67) |

None of these is in the shipped defaults today.

## 2. ALERT2 off the air

### 2.1 How the agent decodes it

| Step | Detail | Source |
|---|---|---|
| When | In the channel's own worker: a burst of 100 ms or more that the legacy decoder read nothing in (no reading, repeat or shadow) is tried again from the same window | [RPi_ALERT agent/lib/devices/sdr-worker.js:15-18](https://github.com/cdomotor-g/RPi_ALERT/blob/37fee8bc/agent/lib/devices/sdr-worker.js#L15-L18), [RPi_ALERT agent/lib/devices/sdr-worker.js:37](https://github.com/cdomotor-g/RPi_ALERT/blob/37fee8bc/agent/lib/devices/sdr-worker.js#L37), [RPi_ALERT agent/lib/devices/sdr-worker.js:59](https://github.com/cdomotor-g/RPi_ALERT/blob/37fee8bc/agent/lib/devices/sdr-worker.js#L59) |
| Signal | 4800 bits a second, two-level NRZ (one bit a symbol, so 4800 symbols a second), root-raised-cosine shaped (β 0.96), on FM; TDMA slots | [RPi_ALERT agent/lib/devices/alert2-air.js:4-7](https://github.com/cdomotor-g/RPi_ALERT/blob/37fee8bc/agent/lib/devices/alert2-air.js#L4-L7), [RPi_ALERT docs/how-it-works.md:125](https://github.com/cdomotor-g/RPi_ALERT/blob/37fee8bc/docs/how-it-works.md#L125) |
| Front end | 240 ksps window → 121-tap low-pass and ÷5 to 48 kHz (10 samples a bit) → where the burst is → its carrier (1,024-point FFTs) → mixed down, 63-tap ±7 kHz filter → FM discriminator → matched RRC filter (121 taps) | [RPi_ALERT agent/lib/devices/alert2-air.js:30](https://github.com/cdomotor-g/RPi_ALERT/blob/37fee8bc/agent/lib/devices/alert2-air.js#L30), [RPi_ALERT agent/lib/devices/alert2-air.js:98-100](https://github.com/cdomotor-g/RPi_ALERT/blob/37fee8bc/agent/lib/devices/alert2-air.js#L98-L100), [RPi_ALERT agent/lib/devices/alert2-air.js:416-424](https://github.com/cdomotor-g/RPi_ALERT/blob/37fee8bc/agent/lib/devices/alert2-air.js#L416-L424) |
| Sync and clock | The 80-bit sync 0xEB90B433AAAA 352EF853 by correlation, either polarity; then the bit clock that opens the eye widest, over the first block and again over the whole frame | [RPi_ALERT agent/lib/devices/alert2-air.js:31-37](https://github.com/cdomotor-g/RPi_ALERT/blob/37fee8bc/agent/lib/devices/alert2-air.js#L31-L37), [RPi_ALERT agent/lib/devices/alert2-air.js:233-248](https://github.com/cdomotor-g/RPi_ALERT/blob/37fee8bc/agent/lib/devices/alert2-air.js#L233-L248), [RPi_ALERT agent/lib/devices/alert2-air.js:452-469](https://github.com/cdomotor-g/RPi_ALERT/blob/37fee8bc/agent/lib/devices/alert2-air.js#L452-L469) |
| Forward error correction | Rate ½, constraint length 7 convolutional code (0x6d, 0x4f), soft-decision Viterbi over 64 states; Reed–Solomon over GF(256) with 16 parity bytes a block (8 byte errors corrected); a x^17+x^3+1 scrambler | [RPi_ALERT agent/lib/devices/alert2-fec.js:6-20](https://github.com/cdomotor-g/RPi_ALERT/blob/37fee8bc/agent/lib/devices/alert2-fec.js#L6-L20), [RPi_ALERT agent/lib/devices/alert2-fec.js:45-70](https://github.com/cdomotor-g/RPi_ALERT/blob/37fee8bc/agent/lib/devices/alert2-fec.js#L45-L70) |
| Blocks | First block 24 bytes (holds the length), follow-on blocks of 32, each with 16 parity bytes; up to 8 frames read in one window | [RPi_ALERT agent/lib/devices/alert2-air.js:17-20](https://github.com/cdomotor-g/RPi_ALERT/blob/37fee8bc/agent/lib/devices/alert2-air.js#L17-L20), [RPi_ALERT agent/lib/devices/alert2-air.js:425-430](https://github.com/cdomotor-g/RPi_ALERT/blob/37fee8bc/agent/lib/devices/alert2-air.js#L425-L430) |
| Limits | A frame longer than the 3 s burst gate is cut off and not read; the longest heard so far is 349 bytes, 1.9 s | [RPi_ALERT docs/roadmap.md:71-72](https://github.com/cdomotor-g/RPi_ALERT/blob/37fee8bc/docs/roadmap.md#L71-L72), [RPi_ALERT docs/how-it-works.md:151-152](https://github.com/cdomotor-g/RPi_ALERT/blob/37fee8bc/docs/how-it-works.md#L151-L152) |
| Switch | `receivers.sdr.alert2: false` turns it off | [RPi_ALERT docs/configuration.md:119-120](https://github.com/cdomotor-g/RPi_ALERT/blob/37fee8bc/docs/configuration.md#L119-L120) |

### 2.2 Cost in the docs

| Fact | Source |
|---|---|
| "0.1–0.2 s a burst on a PC, a few times that on a Pi 4" | [RPi_ALERT docs/how-it-works.md:151](https://github.com/cdomotor-g/RPi_ALERT/blob/37fee8bc/docs/how-it-works.md#L151) |
| "each try costs a few tenths of a second on a Pi 4" | [RPi_ALERT docs/configuration.md:119-120](https://github.com/cdomotor-g/RPi_ALERT/blob/37fee8bc/docs/configuration.md#L119-L120) |
| On a PC, 2026-10-24, "the fixture's burst": legacy decode 288 ms (full decoder), ALERT2 decode 54 ms | [RPi_ALERT docs/roadmap.md:69-70](https://github.com/cdomotor-g/RPi_ALERT/blob/37fee8bc/docs/roadmap.md#L69-L70) |
| A long ALERT2 frame gets the legacy decoder's 45 tries first | [RPi_ALERT agent/lib/devices/sdr.js:71-73](https://github.com/cdomotor-g/RPi_ALERT/blob/37fee8bc/agent/lib/devices/sdr.js#L71-L73) |

### 2.3 Measured here (section 3 has the method)

| One burst, ms of one core of this machine | Full | Lean | Light |
|---|---|---|---|
| Legacy ALERT Binary, real recordings (mean of two, 1.25 s windows) | 262 | 83 | 45 |
| Real ALERT2 frame, 74 bytes: the legacy try | 266 | 87 | 53 |
| Real ALERT2 frame, 74 bytes: the ALERT2 decode | 56 | 56 | 56 |
| Real ALERT2 frames (mean of the 74- and 33-byte ones): try + decode | 293 | 131 | 97 |
| **An ALERT2 burst against a legacy burst** | **1.1×** | **1.6×** | **2.2×** |
| Synthesised 350-byte frame, 1.84 s on the air: try + decode | 695 | 303 | 227 |
| Synthesised 500-byte frame, 2.55 s on the air: try + decode | 960 | 399 | 278 |

The ALERT2 decode alone averages 49 ms here, less than a Lean legacy decode. Both grow with the length of the window: about 70 ms (Lean try) and 42 ms (ALERT2) for each second of window. The docs' PC figures (288 and 54 ms) are within 8 % of this machine's (266–280 and 52–56 ms), so "a PC" in the docs is a machine of this class.

## 3. The benchmark, and this machine

### 3.1 The script

`(working folder, not kept)/bench-draft.js` — a draft, in no repository.

```
node bench-draft.js /path/to/RPi_ALERT/agent            # about 3 minutes
node bench-draft.js /path/to/RPi_ALERT/agent --quick    # about 40 seconds
   [--no-mem] [--no-parallel] [--no-storm] [--fixtures=DIR]
```

It needs Node 18.17 or later and a copy of the agent directory: no packages, no stick, no network. It only reads the agent directory and prints one JSON object. Everything is timed with the agent's own code:

| Section | What it times |
|---|---|
| `burst` | `AlertDsp.decodeWindow()` as the pipeline calls it, each decoder the vendored `alert-dsp.js` has, on the real recordings in `agent/test/fixtures` |
| `alert2` | The legacy try and then `alert2-air.js receive()`, on the two real ALERT2 recordings and on frames made with the agent's own test transmitter (54 to 500 bytes, and six back-to-back slots) |
| `betweenBursts` | The agent's own `sdr-bench.js measure()` (what the Overview shows); the same loop unrounded; and the loop with the settings the worker really runs with since 0.19 |
| `parallel` | That loop in as many threads as cores, at once, against one alone |
| `memory` | Resident memory each real `sdr-worker.js` thread adds, in a fresh process |
| `storm` | One channel through the real `sdr-worker.js` thread, fed a synthesised stream as fast as it will take it: legacy at 8 and 20 bursts a minute, ALERT2 at 20 a minute, with every half-second slot used, and with long frames |
| `timesARaspberryPi4` | The ratios below, each with its source, and `null` with a note where the docs hold no comparable Pi 4 figure |
| `sizing` | Three pass/fail checks worked from the machine's own figures |

**The Pi 4 reference numbers in the script, and where each comes from:**

| Measure | Pi 4 figure | Source | Comparable? |
|---|---|---|---|
| Between bursts, 240 kHz | 0.06 of a core | [RPi_ALERT docs/roadmap.md:112-113](https://github.com/cdomotor-g/RPi_ALERT/blob/37fee8bc/docs/roadmap.md#L112-L113) | Yes: the same bench loop. Taken on agent 0.15.x on a busy Pi |
| Between bursts, 1.2 MHz | 0.27 | [RPi_ALERT docs/roadmap.md:112-113](https://github.com/cdomotor-g/RPi_ALERT/blob/37fee8bc/docs/roadmap.md#L112-L113) | Yes, as above |
| Between bursts, 1.44 MHz | 0.31 | [RPi_ALERT docs/roadmap.md:112-113](https://github.com/cdomotor-g/RPi_ALERT/blob/37fee8bc/docs/roadmap.md#L112-L113) | Yes, as above |
| Between bursts, 960 kHz | none | [RPi_ALERT docs/hardware.md:66-73](https://github.com/cdomotor-g/RPi_ALERT/blob/37fee8bc/docs/hardware.md#L66-L73) gives only "3×"; [RPi_ALERT docs/hardware.md:77-78](https://github.com/cdomotor-g/RPi_ALERT/blob/37fee8bc/docs/hardware.md#L77-L78) is a busy share with bursts | No. The script prints `null` |
| Between bursts, 2.4 MHz | none | [RPi_ALERT docs/hardware.md:66-73](https://github.com/cdomotor-g/RPi_ALERT/blob/37fee8bc/docs/hardware.md#L66-L73) gives only "6.3×" | No. `null` |
| A burst, Full | about 1,000 ms | [RPi_ALERT docs/hardware.md:76-77](https://github.com/cdomotor-g/RPi_ALERT/blob/37fee8bc/docs/hardware.md#L76-L77) ("a second or so"), [RPi_ALERT agent/lib/devices/sdr-worker.js:6-7](https://github.com/cdomotor-g/RPi_ALERT/blob/37fee8bc/agent/lib/devices/sdr-worker.js#L6-L7) | Roughly: a round figure in prose for no named recording. Marked `approximate` |
| A burst, Lean | none in ms; 33–34 % of Full | [RPi_ALERT docs/roadmap.md:77-78](https://github.com/cdomotor-g/RPi_ALERT/blob/37fee8bc/docs/roadmap.md#L77-L78) | Only as a share. `null` |
| A burst, Light | none | [RPi_ALERT docs/configuration.md:130-132](https://github.com/cdomotor-g/RPi_ALERT/blob/37fee8bc/docs/configuration.md#L130-L132) is a PC | No. `null` |
| An ALERT2 try | none ("a few tenths of a second") | [RPi_ALERT docs/configuration.md:119-120](https://github.com/cdomotor-g/RPi_ALERT/blob/37fee8bc/docs/configuration.md#L119-L120), [RPi_ALERT docs/how-it-works.md:151](https://github.com/cdomotor-g/RPi_ALERT/blob/37fee8bc/docs/how-it-works.md#L151) | No. `null` |
| Under real load | 1.6 times the bench | [RPi_ALERT docs/roadmap.md:113-114](https://github.com/cdomotor-g/RPi_ALERT/blob/37fee8bc/docs/roadmap.md#L113-L114) | Used as margin in `sizing` |

The headline `perCore` is the geometric mean of the three comparable between-bursts ratios. `wholeComputer` is that, times the machine's cores, over the every-core-busy slowdown, over a Pi 4's four cores.

### 3.2 This machine

`/proc/cpuinfo`: **Intel(R) Xeon(R) Processor @ 2.10GHz**, family 6 model 207, 4 virtual cores under a hypervisor (a Firecracker VM, kernel 6.18.44), 16 GB, AVX-512; x86-64; **Node v22.23.4** (V8 12.4). It is a shared machine: other work was running during some runs, so each figure is the least of several passes, and the run below began at a load of 0.15.

**Between bursts, cores a channel** (final run, agent 0.23.1; like-for-like run on the 0.15.1 tree in the last two columns):

| Window | Agent's own bench | Same loop, unrounded | Worker's real settings, first channel | Other channels | Filtering only around bursts | Against 240 kHz | Pi 4 (docs) | Times a Pi 4 core | 0.15.1 tree | Times a Pi 4 core, like for like |
|---|---|---|---|---|---|---|---|---|---|---|
| 240 kHz | 0.014 | 0.0134 | 0.0076 | 0.0072 | 0.003 | 1 | 0.06 | 4.5 | 0.0147 | 4.1 |
| 960 kHz | 0.041 | 0.0391 | 0.0355 | 0.0331 | 0.004 | 2.9 | none | — | 0.0441 | — |
| 1.2 MHz | 0.049 | 0.0480 | 0.0451 | 0.0425 | 0.004 | 3.6 | 0.27 | 5.6 | 0.0508 | 5.3 |
| 1.44 MHz | 0.058 | 0.0526 | 0.0494 | 0.0501 | 0.004 | 3.9 | 0.31 | 5.9 | 0.0593 | 5.2 |
| 2.4 MHz | 0.084 | 0.0829 | 0.0745 | 0.0767 | 0.006 | 6.2 | none | — | 0.0917 | — |

Three things fall out of this table:

- The agent's own bench runs the pipeline with its capture ring on ([RPi_ALERT agent/lib/devices/sdr-bench.js:41-42](https://github.com/cdomotor-g/RPi_ALERT/blob/37fee8bc/agent/lib/devices/sdr-bench.js#L41-L42)) while the workers have run with it off since 0.19 ([RPi_ALERT agent/lib/devices/sdr.js:493-495](https://github.com/cdomotor-g/RPi_ALERT/blob/37fee8bc/agent/lib/devices/sdr.js#L493-L495)). So the bench, and the cost the settings page shows, is about 0.003–0.008 of a core of this machine too high for every channel: nearly double at 240 kHz, 6–11 % in a wide window. The error is on the safe side.
- Filtering only around bursts takes a quiet channel to 0.003–0.006 of a core at any window: 4 times less at 240 kHz, 14 times less at 2.4 MHz. The docs' claim holds on this machine.
- The 0.15.1 and 0.23.1 trees measured within about 10 % of each other on this loop, so the "quarter less" of 0.17 barely shows here; whether a Pi 4 gained more is not known.

**One burst's decode, ms of one core** (median; the real recordings in `agent/test/fixtures`):

| Recording | Window | Full | Lean | Light | Reads |
|---|---|---|---|---|---|
| `binary_151.500_1957.iq8` (live ALERT Binary, about 16 dB) | 1.25 s | 251 | 81 | 43 | 1957 = 29, every decoder |
| `binary_151.500_5304_weak.iq8` (live, about 9 dB) | 1.25 s | 273 | 84 | 46 | 5304 = 41, every decoder |
| `testrig_burst_240k.iq8` (Enhanced iFLOWS test rig) | 3 s | 213 | 85 | 50 | 4079 = 420 and 4080 = 121, every decoder |
| Typical live burst (mean of the two Binary ones) | | **262** | **83** | **45** | |
| The same, agent 0.15.1 (Full only) | | 264 | — | — | |

Lean is 32 % of Full here (the Pi 4 at the first base station: 33–34 %). Light is 54 % of Lean (the docs: about half).

### 3.3 Threads and memory

| Measure | Result |
|---|---|
| The 1.44 MHz loop in 4 threads at once against one alone | 1.17 times each (1.13–1.22 over three runs) |
| Resident memory each of 4 real decoder threads adds, 1.44 MHz, after 6 s of samples | 43 MB (39–44 over runs with 4 and 8 threads) |
| The process with no decoders | 52–55 MB |

### 3.4 One channel under traffic, through the real worker

A 240 kHz window, 32 s of synthesised signal a scenario, squelch, gate, legacy decode and ALERT2 try as on a base station. Cores of this machine; a quiet channel this way costs 0.011.

| Scenario | Bursts a minute | Lean | Light | Full | All decoded? | Lean, in Pi 4 cores (× 4 to × 5) |
|---|---|---|---|---|---|---|
| Legacy ALERT Binary, busy | 8 | 0.021 | 0.018 | 0.040 | 4 of 4 | 0.08–0.11 |
| Legacy ALERT Binary, heavy | 20 | 0.038 | 0.024 | 0.089 | 10 of 10 | 0.15–0.19 |
| ALERT2, 74-byte frames | 20 | 0.057 | 0.046 | 0.115 | 10 of 10 | 0.23–0.29 |
| ALERT2, every half-second slot used, 54-byte frames | 120 | **0.266** | 0.190 | 0.628 | 57 of 57 | **1.06–1.33** |
| ALERT2, 350-byte frames, 74 % of the time on the air | 24 | 0.130 | 0.097 | 0.301 | 12 of 12 | 0.52–0.65 |

Through the worker a burst costs 84–88 ms (legacy, Lean) and 143–148 ms (ALERT2, Lean): the same 1.6 to 1.7 times as section 2.3.

A check against the field: the ALERT2 row with the Full decoder, 0.115, times 4 to 5 is 0.46–0.58 Pi 4 cores. The first base station's Pi 4 showed 53 % busy on its ALERT2 channel in 240 kHz with the Full decoder ([RPi_ALERT docs/roadmap.md:69-71](https://github.com/cdomotor-g/RPi_ALERT/blob/37fee8bc/docs/roadmap.md#L69-L71)). So that channel carries about 20 bursts a minute, and the conversion holds.

### 3.5 Times a Raspberry Pi 4

| Measure | This machine | Pi 4 (docs) | Times a Pi 4 core |
|---|---|---|---|
| Between bursts, three windows, agent 0.23.1 | table above | 0.06 / 0.27 / 0.31 | 5.3 (4.5–5.9) |
| The same on the 0.15.1 tree, like for like | table above | 0.06 / 0.27 / 0.31 | **4.8** (4.1–5.3) |
| A burst, Full | 262 ms | about 1,000 ms | about 3.8, approximate |
| A burst, Lean; Light; an ALERT2 try | 83; 45; 49 ms | no figure | not computed |
| Whole computer, 4 cores, with the 1.17 slowdown | | a Pi 4 = 1 | 4.5 (4.1 like for like) |

So this machine is **about 4 to 5 times a Pi 4 core per thread**, and with four cores about 4 Pi 4s. Sections 3.4 and 5 convert with × 4 to × 5. The spread (3.8 to 5.9) is the uncertainty in the Pi 4 reference, not in this machine: see *Could not confirm*.

The three sizing checks on this machine all pass: one thread with a full ALERT2 channel in a 1.44 MHz window 0.33 of a core (limit 0.7); four channels at heavy legacy traffic 12 % of the computer (limit 50 %); eight channels of ALERT2 at 20 a minute 24 %.

### 3.6 The script's output

The full output of the final run on agent 0.23.1 is in Appendix A. The like-for-like run on the 0.15.1 tree is in `(working folder, not kept)/bench-output-0.15.1.json`, the same run's file for 0.23.1 in `(working folder, not kept)/bench-output-current.json`. The 0.15.1 tree was taken with `git archive b744c95 agent` into the scratchpad; the repository was not touched.

## 4. Flood-Net: the ALERT2 transition plan, and what traffic to expect

### 4.1 The plan

| Fact | Source |
|---|---|
| A draft for management, an Admin tab (`alert2-plan.js`): equipment (ERT-A2s, 115E-2 units for base stations), work by region and catchment, timeline, FTE, cost | [MegaNet roadmap/roadmap-113.md:1882-1886](https://github.com/cdomotor-g/MegaNet/blob/ac3e773b/roadmap/roadmap-113.md#L1882-L1886) |
| Backbone first, catchment by catchment: each catchment cut over in one step to an ALERT2 backbone in *concentration* mode — repeaters fitted with an ERT-A2 take legacy ALERT in and send ALERT2 on; the field stations stay legacy | [MegaNet roadmap/roadmap-113.md:1832-1836](https://github.com/cdomotor-g/MegaNet/blob/ac3e773b/roadmap/roadmap-113.md#L1832-L1836) |
| An ALERT1 repeater cannot carry ALERT2, and a catchment's bases must receive ALERT2 before it cuts over | [MegaNet roadmap/roadmap-113.md:1836-1838](https://github.com/cdomotor-g/MegaNet/blob/ac3e773b/roadmap/roadmap-113.md#L1836-L1838) |
| As drafted for Queensland: about $29.9m over about 40 months; the first catchment on the ALERT2 backbone about 11 months in, every one by about month 24; 87 backbone sites audited, about 39 retrofitted, 13 rebuilt; 49 of Queensland's 90 repeaters shared between catchments | [MegaNet roadmap/roadmap-113.md:1836-1842](https://github.com/cdomotor-g/MegaNet/blob/ac3e773b/roadmap/roadmap-113.md#L1836-L1842) |
| Converting the field stations is a switch; off, they stay ALERT1 and are concentrated | [MegaNet roadmap/roadmap-113.md:1839](https://github.com/cdomotor-g/MegaNet/blob/ac3e773b/roadmap/roadmap-113.md#L1839) |
| The owner: "ALERT2 Transition is probably a fair way off yet"; most stations stay legacy ALERT for some time | [MegaNet roadmap/roadmap-113.md:1608-1612](https://github.com/cdomotor-g/MegaNet/blob/ac3e773b/roadmap/roadmap-113.md#L1608-L1612) |
| Network Review's starting point: "a two-minute frame of half-second slots", spares kept for growth, one frequency to a network | [MegaNet docs/network-review.md:535-540](https://github.com/cdomotor-g/MegaNet/blob/ac3e773b/docs/network-review.md#L535-L540) |

So for a base station the first years of ALERT2 are **both at once**: the legacy channels as now, and one or more ALERT2 backbone channels carrying concentrated legacy readings.

### 4.2 Bit rate, frame sizes and what a channel can carry

| Fact | Source |
|---|---|
| 4800 bps on the air, 1.667 ms a byte | [MegaNet docs/tdma-planner.md:84](https://github.com/cdomotor-g/MegaNet/blob/ac3e773b/docs/tdma-planner.md#L84) |
| A frame is 82 bytes on the air for up to 22 bytes of payload, then (n + 16) × 2 for each follow-on block of up to 32 | [MegaNet docs/tdma-planner.md:91-106](https://github.com/cdomotor-g/MegaNet/blob/ac3e773b/docs/tdma-planner.md#L91-L106) |
| Air time: 233 ms for a 22-byte payload, 300–313 ms for a typical sensor report, 397 ms for 54 bytes (what a half-second slot holds), 1.15 s for 200 bytes, 5.28 s for the 1,023-byte maximum | [MegaNet docs/tdma-planner.md:119-132](https://github.com/cdomotor-g/MegaNet/blob/ac3e773b/docs/tdma-planner.md#L119-L132) |
| A frame of 5 s to an hour, 60 or 120 s typical; a slot at least 500 ms | [MegaNet docs/tdma-planner.md:51-57](https://github.com/cdomotor-g/MegaNet/blob/ac3e773b/docs/tdma-planner.md#L51-L57) |
| A 2 s slot in a 15 s frame carries 84 concentrated legacy readings a frame, 20,160 an hour | [MegaNet docs/tdma-planner.md:141](https://github.com/cdomotor-g/MegaNet/blob/ac3e773b/docs/tdma-planner.md#L141) |
| Concentration: 9 bytes of headers and 4 bytes a legacy reading; a reading waits at most 255 s | [MegaNet docs/tdma-planner.md:231-235](https://github.com/cdomotor-g/MegaNet/blob/ac3e773b/docs/tdma-planner.md#L231-L235) |
| Slots are sized for the storm peak, not the average day; 20 % of slots kept spare by default | [MegaNet docs/tdma-planner.md:33-36](https://github.com/cdomotor-g/MegaNet/blob/ac3e773b/docs/tdma-planner.md#L33-L36), [MegaNet docs/tdma-planner.md:290-291](https://github.com/cdomotor-g/MegaNet/blob/ac3e773b/docs/tdma-planner.md#L290-L291) |
| A tipping-bucket gauge at 60 mm an hour sends one legacy reading a minute | [MegaNet docs/tdma-planner.md:236-238](https://github.com/cdomotor-g/MegaNet/blob/ac3e773b/docs/tdma-planner.md#L236-L238) |

With half-second slots a channel can carry at most 120 transmissions a minute, 96 with the 20 % spare. That is the ceiling section 3.4 measured.

### 4.3 What is on the air now, at the first base station

| Fact | Source |
|---|---|
| 151.5375 MHz is a Seqwater ALERT2 link: about 100,000 receptions a day from 27 sources, none in the register | [MegaNet roadmap/roadmap-113.md:1521](https://github.com/cdomotor-g/MegaNet/blob/ac3e773b/roadmap/roadmap-113.md#L1521) |
| 151.500 MHz carries a second ALERT2 network (sources 62720–62732, 10315) | [MegaNet roadmap/roadmap-113.md:1521](https://github.com/cdomotor-g/MegaNet/blob/ac3e773b/roadmap/roadmap-113.md#L1521) |
| In 30 days the receivers decoded only ALERT Binary and ALERT2, no Enhanced iFLOWS; ALERT2 carried about 1,500 legacy addresses a day, about 1,000 of them through one concentrator | [MegaNet roadmap/roadmap-113.md:1503](https://github.com/cdomotor-g/MegaNet/blob/ac3e773b/roadmap/roadmap-113.md#L1503) |
| About 96,000 reception rows a day; 70 % of ALERT2 rows are repeat copies over other repeater paths | [MegaNet roadmap/roadmap-113.md:1665](https://github.com/cdomotor-g/MegaNet/blob/ac3e773b/roadmap/roadmap-113.md#L1665) |
| About 80,000 receptions a day (8 November) | [MegaNet roadmap/roadmap-113.md:266](https://github.com/cdomotor-g/MegaNet/blob/ac3e773b/roadmap/roadmap-113.md#L266) |
| One concentrator, 11762, is the route for about 1,650 legacy addresses | [MegaNet roadmap/roadmap-113.md:459](https://github.com/cdomotor-g/MegaNet/blob/ac3e773b/roadmap/roadmap-113.md#L459) |
| The register's repeaters: 146 | [MegaNet roadmap/roadmap-113.md:1417](https://github.com/cdomotor-g/MegaNet/blob/ac3e773b/roadmap/roadmap-113.md#L1417) |
| At the first base station one night's *Compare* covered 11,628 bursts across the station | [RPi_ALERT docs/roadmap.md:76-78](https://github.com/cdomotor-g/RPi_ALERT/blob/37fee8bc/docs/roadmap.md#L76-L78) |
| open-ALERT's traffic levels: quiet 2, busy 8, heavy 20 bursts a channel a minute; the Brisbane base "runs near heavy" | [open-ALERT site/js/builder.js:72-75](https://github.com/cdomotor-g/open-ALERT/blob/c4670161/site/js/builder.js#L72-L75) |

A reception is one record of one PDU, not one burst; a frame carries several. No document gives bursts a minute for a channel. Section 3.4's check puts the ALERT2 link at about 20 a minute, which is open-ALERT's "heavy".

## 5. A headroom rule of thumb

Work in **Pi 4 cores**. For each channel:

```
Pi 4 cores  =  1.6 × between-bursts cost of its window  +  (bursts a minute ÷ 60) × seconds a burst
```

| Term | Value | Standing |
|---|---|---|
| Between bursts, 240 kHz | 0.06 | Pi 4 bench, documented |
| Between bursts, 960 kHz | 0.12–0.22 | Not documented as a bench figure. 0.12 is the bench Pi 4's busy share a channel; 0.22 is 1.2 MHz's 0.27 scaled by this machine's ratio. The two disagree |
| Between bursts, 1.2 MHz / 1.44 MHz | 0.27 / 0.31 | Pi 4 bench, documented |
| Between bursts, 2.4 MHz | about 0.45–0.5 | Derived: 1.44 MHz's 0.31 scaled by this machine's ratio |
| × 1.6 | on a loaded computer | Documented for the Pi 4 only |
| A legacy burst, Lean | about 0.37 s (0.33–0.41) | Derived: 83 ms here × 4 to 5; agrees with the docs' a third of "a second or so" |
| A legacy burst, Light / Full | about 0.2 s / 1.2 s | Derived the same way; Full agrees with "a second or so" |
| An ALERT2 burst, short frame, Lean | about 0.6 s (0.52–0.74) | Derived: 130–148 ms here |
| An ALERT2 burst, 350-byte frame, Lean | about 1.4 s | Derived: 303–317 ms here |
| An ALERT2 burst with the legacy try skipped (planned) | about 0.22 s | Derived: 49 ms here |

Two limits, both needed:

- **The whole computer**: keep the sum under half of what the computer has, counted in Pi 4 cores. open-ALERT plans to 70 % ([open-ALERT site/data/builder.js:100](https://github.com/cdomotor-g/open-ALERT/blob/c4670161/site/data/builder.js#L100)); half leaves room for the screen dashboard, `rtl_sdr`, the web page and a storm.
- **Each channel**: keep any one channel under 0.7 of one core, because it has one thread.

Worked, with the Lean decoder and *Filter every sample* (the defaults), the screen off:

| Site | Pi 4 cores | On a Pi 4 (4 cores) |
|---|---|---|
| 4 channels, one stick, 1.44 MHz, legacy at 8 a minute | 4 × (0.50 + 0.05) = **2.2** | 55 % |
| The same at 20 a minute | 4 × (0.50 + 0.12) = **2.5** | 62 % |
| The same, one of the four an ALERT2 link at 20 a minute | **2.6** | 64 % |
| 8 channels, two sticks at 960 kHz, legacy at 20 a minute | 8 × (0.19 to 0.35 + 0.12) = **2.5–3.8** | 62–95 % |
| The same, all eight ALERT2 at 20 a minute | 8 × (0.19 to 0.35 + 0.20) = **3.1–4.4** | 78–110 % |
| One ALERT2 channel with every slot used, 240 kHz window | 0.10 + 1.2 = **1.3 on one thread** | cannot keep up |
| The same in a 1.44 MHz window | 0.50 + 1.2 = **1.7 on one thread** | cannot keep up |

For comparison, the first base station's Pi 4 ran at a load of about 4.5 with eight channels in two 960 kHz windows, then on the Full decoder and with its kiosk on (section 1.6): the same order.

**The rule:**

- **Today**, N channels need about **0.55–0.6 Pi 4 cores each** in a 1.44 MHz window, 0.25–0.5 each at 960 kHz, 0.15–0.25 each at 240 kHz, at busy to heavy legacy traffic.
- **Under ALERT2 as it is on the air now** (about 20 frames a minute on a link), add about 0.1 Pi 4 core for each ALERT2 channel. The totals barely move.
- **Under ALERT2 at what the protocol allows** (a channel's slots filling in a storm), allow **1.2 Pi 4 cores of burst work for each ALERT2 channel, on one thread**. No Pi 4-class core does that with today's software.
- **Prudent margin**: a computer with at least 4 cores, each at least **2.5 times a Pi 4 core** (so the worst channel sits near 0.7 of a core in a 1.44 MHz window), which is 10 Pi 4 cores in all: twice the heaviest eight-channel case above with ALERT2 on every channel. For memory, 40–45 MB a channel plus up to 58 MB a channel of backlog at 1.44 MHz: 2 GB is enough headless, 4 GB with the screen dashboard.
- The planned software changes move this a long way (skipping the legacy try takes a full ALERT2 channel from 1.2 to about 0.4 Pi 4 cores; Light takes it to about 0.9). None is a default today, so buy for the software as shipped.

## 6. What this says about the computers already proposed

These follow from the figures above and the repositories' own ratings; none of these boards was measured.

| Computer | The repositories' rating | What follows | Source of the rating |
|---|---|---|---|
| Toradex Verdin AM62 Quad (4 × Cortex-A53, 1.4 GHz) | "an A53 core at 1.4 GHz about half an A72's" — a stated ratio, not a measurement | At half a Pi 4 core, one channel in a 1.44 MHz window is 0.62 of a core by the bench and about 1.0 loaded, before any burst. A link at 20 ALERT2 frames a minute adds about 0.4 of a core. A full ALERT2 channel needs 2.1–2.7 of its cores on one thread. It fits only with the two unproven modes, or in 240 kHz windows | [RPi_ALERT docs/hardware.md:210-218](https://github.com/cdomotor-g/RPi_ALERT/blob/37fee8bc/docs/hardware.md#L210-L218), [open-ALERT site/data/builder.js:185](https://github.com/cdomotor-g/open-ALERT/blob/c4670161/site/data/builder.js#L185) |
| Toradex Luna SL1680 (4 × Cortex-A73, 2.1 GHz) | "about 1.1 times" a Pi 4, "scaled by clock (no benchmarks published yet)" | About a Pi 4: fine today, the same single-thread ceiling for ALERT2 | [open-ALERT site/data/builder.js:204](https://github.com/cdomotor-g/open-ALERT/blob/c4670161/site/data/builder.js#L204) |
| Raspberry Pi 4 | the reference | Four channels at 55–64 %; eight channels full; a full ALERT2 channel beyond one core | section 5 |

And the builder's model against RPi ALERT's own figures:

| Builder model | Its value | RPi ALERT's figure | Source |
|---|---|---|---|
| A 240 kHz channel between bursts | 0.04 Pi 4 core | 0.06 by the bench on a Pi 4; 0.065 a channel busy on the bench Pi 4 | [open-ALERT site/data/builder.js:94-97](https://github.com/cdomotor-g/open-ALERT/blob/c4670161/site/data/builder.js#L94-L97), [RPi_ALERT docs/roadmap.md:112-113](https://github.com/cdomotor-g/RPi_ALERT/blob/37fee8bc/docs/roadmap.md#L112-L113), [RPi_ALERT docs/hardware.md:77-78](https://github.com/cdomotor-g/RPi_ALERT/blob/37fee8bc/docs/hardware.md#L77-L78) |
| Window multipliers at 1.2 and 1.44 MHz | 3.7 and 4.1 | 4.5 and 5.2 on the Pi 4 | [open-ALERT site/data/builder.js:84-91](https://github.com/cdomotor-g/open-ALERT/blob/c4670161/site/data/builder.js#L84-L91), [RPi_ALERT docs/roadmap.md:112-113](https://github.com/cdomotor-g/RPi_ALERT/blob/37fee8bc/docs/roadmap.md#L112-L113) |
| Load factor | none | 1.6 on a loaded Pi 4 | [open-ALERT site/js/builder.js:77-91](https://github.com/cdomotor-g/open-ALERT/blob/c4670161/site/js/builder.js#L77-L91), [RPi_ALERT docs/roadmap.md:113-114](https://github.com/cdomotor-g/RPi_ALERT/blob/37fee8bc/docs/roadmap.md#L113-L114) |
| Lean between bursts | 0.75 of Full | within 10 % of 0.15.1 on this machine's bench loop | [open-ALERT site/data/builder.js:119](https://github.com/cdomotor-g/open-ALERT/blob/c4670161/site/data/builder.js#L119), section 3.2 |
| An ALERT2 burst | priced as any burst (0.34 s Lean) | about 0.6 s Lean, derived | [open-ALERT site/js/builder.js:85](https://github.com/cdomotor-g/open-ALERT/blob/c4670161/site/js/builder.js#L85), section 2.3 |
| Memory a channel | 30 MB | about 40 MB in the docs; 43 MB measured here | [open-ALERT site/data/builder.js:101](https://github.com/cdomotor-g/open-ALERT/blob/c4670161/site/data/builder.js#L101), [RPi_ALERT docs/hardware.md:114](https://github.com/cdomotor-g/RPi_ALERT/blob/37fee8bc/docs/hardware.md#L114) |
| Capacity of a computer | its catalogue channel count ÷ 2 | no measurement behind any non-Pi entry | [open-ALERT site/js/builder.js:92-93](https://github.com/cdomotor-g/open-ALERT/blob/c4670161/site/js/builder.js#L92-L93) |

For Flood-Net's four channels in 1.44 MHz with Lean the builder gives 4 × 0.04 × 4.1 × 0.75 = 0.49 Pi 4 core between bursts. The Pi 4's own bench gives 4 × 0.31 = 1.24, and loaded about 2.0. The builder is low by 2.5 to 4 times on this term.

## 7. Could not confirm

- **No Pi 4 was measured in this work.** Every Pi 4 figure is from the docs. The three bench figures were taken on agent 0.15.x by a bench that starts 90 s after the agent, on a Pi that was running eight channels and a kiosk; a bench thread competing for cores reads high. If so, "times a Pi 4" here is too generous and a Pi 4 is better than 0.27 and 0.31 at the wide windows.
- **The two Pi 4 observations for wide windows disagree.** 0.12 of a core a channel at 960 kHz, bursts and all, on the bench Pi 4 ([RPi_ALERT docs/hardware.md:77-78](https://github.com/cdomotor-g/RPi_ALERT/blob/37fee8bc/docs/hardware.md#L77-L78)); 0.27 at 1.2 MHz by the bench on the first base station's Pi 4 ([RPi_ALERT docs/roadmap.md:112-113](https://github.com/cdomotor-g/RPi_ALERT/blob/37fee8bc/docs/roadmap.md#L112-L113)). On this machine 1.2 MHz is only 1.2 times 960 kHz. Which is right for an idle Pi 4 is not known.
- **No Pi 4 figure in milliseconds** for a Lean, Light or ALERT2 decode, or for any named recording. Section 5's seconds a burst are this machine's times 4 to 5.
- **Whether 0.17's "quarter less work between bursts" shows on a Pi 4.** It did not show on this machine's bench loop.
- **The 1.6 load factor on anything but that Pi 4.** This machine showed 1.13–1.22 with four threads on four shared virtual cores.
- **Which of the two ALERT2 recordings the docs' "288 ms and 54 ms" refers to**, and what "a PC" was.
- **Bursts a minute on any channel.** Not written down anywhere; 20 a minute on 151.5375 is inferred from the 53 % busy share. The live database was not queried.
- **How many slots of an Australian ALERT2 channel will really be used.** The 120-a-minute case is what half-second slots allow, not a forecast. No document gives a planned frame, slot count or station count per channel for a Bureau network.
- **How many stations, channels or base stations the transition covers in total.** The plan's inventory is worked from the register in the app; the roadmap gives only the figures in section 4.1.
- **`rtl_sdr` itself, USB handling and the agent's main thread** are in none of the measurements; nor is an ARM machine. Node's JIT on ARM64 may rank the decoders differently.
- **Cortex-A53 at half a Cortex-A72, and the Luna at 1.1 times a Pi 4**, are the repositories' assumptions. Neither board has run the agent or this script.
- **Enhanced iFLOWS and ASCII bursts under load**: only one Enhanced iFLOWS recording was timed; the storm scenarios are ALERT Binary and ALERT2.
- **Synthesised ALERT2 frames** were made with the agent's own test transmitter at 20–22 dB. Real weak or colliding frames may cost differently (a sync that does not decode is still paid for).

## Appendix A — output of `node bench-draft.js /home/user/RPi_ALERT/agent` (final run)

```json
{
 "script": "bench-draft.js (draft 1, 2026-11-11)",
 "machine": {
  "cpuModel": "Intel(R) Xeon(R) Processor @ 2.10GHz",
  "board": null,
  "arch": "x64",
  "cores": 4,
  "cpuMHz": 2100,
  "cpuMaxMHz": null,
  "governor": null,
  "hypervisor": true,
  "memMb": 16086,
  "os": "Linux 6.18.44-fc-v378",
  "node": "v22.23.4",
  "v8": "12.4.254.21-node.57",
  "loadAvgAtStart": [
   0.15,
   0.84,
   0.8
  ],
  "loadAvgAtEnd": [
   1.24,
   1.03,
   0.89
  ]
 },
 "agent": {
  "dir": "/home/user/RPi_ALERT/agent",
  "version": "0.23.1",
  "meganetCommit": "ed3ed3bf4d40c6c4dd4038ef069a04de5fee427c (2026-11-08)",
  "decoders": [
   "full",
   "lean",
   "light"
  ],
  "burstWatch": true
 },
 "burst": {
  "unit": "ms of one core for one burst's decode (median of the runs; best in brackets in `best`)",
  "fixtures": [
   {
    "fixture": "binary_151.500_1957.iq8",
    "what": "a live ALERT Binary burst, ~16 dB over the noise, the window the agent decoded (burst and 0.4 s either side)",
    "format": "BINARY",
    "windowSeconds": 1.25,
    "ms": {
     "full": 250.6,
     "lean": 81.3,
     "light": 43.4
    },
    "best": {
     "full": 238.7,
     "lean": 71.9,
     "light": 40.7
    },
    "readings": {
     "full": "1957=29",
     "lean": "1957=29",
     "light": "1957=29"
    },
    "combos": {
     "full": 45,
     "lean": 45,
     "light": 45
    }
   },
   {
    "fixture": "binary_151.500_5304_weak.iq8",
    "what": "a weak live ALERT Binary burst, ~9 dB",
    "format": "BINARY",
    "windowSeconds": 1.25,
    "ms": {
     "full": 272.8,
     "lean": 84.4,
     "light": 46.2
    },
    "best": {
     "full": 260.9,
     "lean": 80.4,
     "light": 42.1
    },
    "readings": {
     "full": "5304=41",
     "lean": "5304=41",
     "light": "5304=41"
    },
    "combos": {
     "full": 45,
     "lean": 45,
     "light": 45
    }
   },
   {
    "fixture": "testrig_burst_240k.iq8",
    "what": "the ERT-A2 test rig's Enhanced iFLOWS burst, a 3 s capture (two readings)",
    "format": "ENHANCED_IFLOWS",
    "windowSeconds": 3,
    "ms": {
     "full": 212.8,
     "lean": 85.4,
     "light": 49.9
    },
    "best": {
     "full": 203.8,
     "lean": 78.5,
     "light": 46.4
    },
    "readings": {
     "full": "4079=420 4080=121",
     "lean": "4079=420 4080=121",
     "light": "4080=121 4079=420"
    },
    "combos": {
     "full": 45,
     "lean": 45,
     "light": 45
    }
   }
  ],
  "typicalMs": {
   "full": 261.7,
   "lean": 82.9,
   "light": 44.8
  },
  "typicalBestMs": {
   "full": 249.8,
   "lean": 76.2,
   "light": 41.4
  }
 },
 "alert2": {
  "unit": "ms of one core for one burst",
  "note": "a burst the legacy decoder reads nothing in is tried as ALERT2 (sdr-worker.js): its cost is the legacy try plus the ALERT2 decode",
  "bursts": [
   {
    "burst": "alert2_151.5375_3pdus.iq8",
    "what": "a real ALERT2 frame recorded off the air on 151.5375 MHz",
    "windowSeconds": 1.35,
    "legacyTryMs": {
     "full": 265.8,
     "lean": 87.1,
     "light": 52.7
    },
    "alert2Ms": 56.3,
    "totalMs": {
     "full": 322.1,
     "lean": 143.4,
     "light": 109
    },
    "frames": [
     "ok 74 B"
    ]
   },
   {
    "burst": "alert2_151.5375_2pdus.iq8",
    "what": "a real ALERT2 frame recorded off the air on 151.5375 MHz",
    "windowSeconds": 1.25,
    "legacyTryMs": {
     "full": 221.5,
     "lean": 75.6,
     "light": 42.1
    },
    "alert2Ms": 41.9,
    "totalMs": {
     "full": 263.4,
     "lean": 117.5,
     "light": 84
    },
    "frames": [
     "ok 33 B"
    ]
   },
   {
    "burst": "synth_54B",
    "what": "synthesised: one 54-byte frame, 0.32 s on the air, 20 dB",
    "windowSeconds": 1.22,
    "legacyTryMs": {
     "full": 244.6,
     "lean": 75.7,
     "light": 40.1
    },
    "alert2Ms": 43.3,
    "totalMs": {
     "full": 287.9,
     "lean": 119,
     "light": 83.4
    },
    "frames": [
     "ok 54 B"
    ]
   },
   {
    "burst": "synth_150B",
    "what": "synthesised: one 150-byte frame, 0.8 s on the air, 20 dB",
    "windowSeconds": 1.7,
    "legacyTryMs": {
     "full": 335.6,
     "lean": 106.4,
     "light": 57.8
    },
    "alert2Ms": 64.7,
    "totalMs": {
     "full": 400.3,
     "lean": 171.1,
     "light": 122.5
    },
    "frames": [
     "ok 150 B"
    ]
   },
   {
    "burst": "synth_350B",
    "what": "synthesised: one 350-byte frame, 1.84 s on the air, 20 dB",
    "windowSeconds": 2.74,
    "legacyTryMs": {
     "full": 577.1,
     "lean": 185.2,
     "light": 108.8
    },
    "alert2Ms": 117.9,
    "totalMs": {
     "full": 695,
     "lean": 303.1,
     "light": 226.7
    },
    "frames": [
     "ok 350 B"
    ]
   },
   {
    "burst": "synth_500B",
    "what": "synthesised: one 500-byte frame, 2.55 s on the air, 20 dB",
    "windowSeconds": 3.45,
    "legacyTryMs": {
     "full": 812.2,
     "lean": 250.3,
     "light": 129.6
    },
    "alert2Ms": 148.2,
    "totalMs": {
     "full": 960.4,
     "lean": 398.5,
     "light": 277.8
    },
    "frames": [
     "ok 502 B"
    ]
   },
   {
    "burst": "synth_6slots",
    "what": "synthesised: six 54-byte frames in six back-to-back half-second slots (3 s of a full TDMA channel)",
    "windowSeconds": 3.8,
    "legacyTryMs": {
     "full": 849.7,
     "lean": 269.3,
     "light": 148.3
    },
    "alert2Ms": 156.2,
    "totalMs": {
     "full": 1005.9,
     "lean": 425.5,
     "light": 304.5
    },
    "frames": [
     "ok 54 B",
     "ok 54 B",
     "ok 54 B",
     "ok 54 B",
     "ok 54 B",
     "ok 54 B"
    ],
    "coreSecondsPerSecondOnAir": {
     "full": 0.335,
     "lean": 0.142,
     "light": 0.102
    }
   }
  ],
  "realFrameAgainstLegacyBurst": {
   "full": {
    "alert2BurstMs": 292.8,
    "legacyBurstMs": 261.7,
    "ratio": 1.12
   },
   "lean": {
    "alert2BurstMs": 130.5,
    "legacyBurstMs": 82.9,
    "ratio": 1.57
   },
   "light": {
    "alert2BurstMs": 96.5,
    "legacyBurstMs": 44.8,
    "ratio": 2.15
   }
  },
  "alert2DecodeAloneMs": 49.1
 },
 "betweenBursts": {
  "unit": "cores one channel takes while nothing is on the air (seconds of one core per second of signal)",
  "windowsHz": [
   240000,
   960000,
   1200000,
   1440000,
   2400000
  ],
  "agentBench": {
   "note": "lib/devices/sdr-bench.js measure(), as the agent runs it and the Overview shows it (rounded to 0.001 of a core)",
   "filterEverySample": {
    "240000": 0.014,
    "960000": 0.041,
    "1200000": 0.049,
    "1440000": 0.058,
    "2400000": 0.084
   },
   "filterOnlyAroundBursts": {
    "240000": 0.003,
    "960000": 0.004,
    "1200000": 0.004,
    "1440000": 0.004,
    "2400000": 0.006
   }
  },
  "asAgentBenchUnrounded": {
   "240000": 0.0134,
   "960000": 0.0391,
   "1200000": 0.048,
   "1440000": 0.0526,
   "2400000": 0.0829
  },
  "asWorkerFirstChannel": {
   "240000": 0.0076,
   "960000": 0.0355,
   "1200000": 0.0451,
   "1440000": 0.0494,
   "2400000": 0.0745,
   "note": "the SDR worker's own settings since 0.19 (sdr.js dspCfg: ringS 5, capture off), spectrum on: a stick's first channel"
  },
  "asWorkerOtherChannels": {
   "240000": 0.0072,
   "960000": 0.0331,
   "1200000": 0.0425,
   "1440000": 0.0501,
   "2400000": 0.0767,
   "note": "the same with the spectrum off: a stick's second and later channels"
  },
  "relativeTo240k": {
   "240000": 1,
   "960000": 2.92,
   "1200000": 3.59,
   "1440000": 3.94,
   "2400000": 6.2
  }
 },
 "parallel": {
  "note": "the between-bursts loop at 1.44 MHz in 4 threads at once against one alone (best try of each thread): 1.0 means a channel costs the same with every core busy",
  "threads": 4,
  "aloneCores": 0.0562,
  "togetherCoresEach": [
   0.0657,
   0.0653,
   0.0638,
   0.0681
  ],
  "slowdown": 1.17
 },
 "memory": {
  "note": "resident memory each of 4 real sdr-worker.js threads adds, on a 1.44 MHz window after 6 s of samples (no backlog: each chunk is acknowledged before the next). The docs say ~40 MB a channel (docs/hardware.md:114), 10 MB less since 0.19 (docs/configuration.md:184-186). A decoder that falls behind may queue up to 20 s of samples on top, within 2 % of memory and never under 5 s (lib/devices/sdr.js:70-81): at 1.44 MHz, 14-58 MB a channel.",
  "workers": 4,
  "mbPerChannel": 37.1,
  "mbProcessWithoutDecoders": 52.3
 },
 "storm": {
  "note": "one channel in a 240 kHz window through the real sdr-worker.js thread, 32 s of synthesised signal a scenario, fed as fast as the thread takes it (after an untimed warm-up); cores = time taken / seconds of signal. Signals 20-25 dB over the noise.",
  "scenarios": [
   {
    "scenario": "legacy-busy",
    "what": "legacy ALERT Binary, 8 bursts a minute",
    "burstsAMinute": 8,
    "cores": {
     "lean": 0.021,
     "light": 0.018,
     "full": 0.04
    },
    "msABurst": {
     "lean": 83.8,
     "light": 60.5,
     "full": 231.4
    },
    "heard": {
     "bursts": 4,
     "legacyReadings": 4,
     "alert2FramesOk": 0,
     "alert2FramesBad": 0
    }
   },
   {
    "scenario": "legacy-heavy",
    "what": "legacy ALERT Binary, 20 bursts a minute",
    "burstsAMinute": 20,
    "cores": {
     "lean": 0.038,
     "light": 0.024,
     "full": 0.089
    },
    "msABurst": {
     "lean": 87.7,
     "light": 42.5,
     "full": 249
    },
    "heard": {
     "bursts": 10,
     "legacyReadings": 10,
     "alert2FramesOk": 0,
     "alert2FramesBad": 0
    }
   },
   {
    "scenario": "alert2-heavy",
    "what": "ALERT2, 20 frames a minute of 74 bytes (0.5 s on the air)",
    "burstsAMinute": 20,
    "cores": {
     "lean": 0.057,
     "light": 0.046,
     "full": 0.115
    },
    "msABurst": {
     "lean": 148.4,
     "light": 111.4,
     "full": 333.4
    },
    "heard": {
     "bursts": 10,
     "legacyReadings": 0,
     "alert2FramesOk": 10,
     "alert2FramesBad": 0
    }
   },
   {
    "scenario": "alert2-full-channel",
    "what": "ALERT2, every half-second TDMA slot used: 120 frames a minute of 54 bytes",
    "burstsAMinute": 120,
    "cores": {
     "lean": 0.266,
     "light": 0.19,
     "full": 0.628
    },
    "msABurst": {
     "lean": 143.3,
     "light": 100.7,
     "full": 346.3
    },
    "heard": {
     "bursts": 57,
     "legacyReadings": 0,
     "alert2FramesOk": 57,
     "alert2FramesBad": 0
    }
   },
   {
    "scenario": "alert2-long-frames",
    "what": "ALERT2, a 350-byte frame (1.84 s on the air) every 2.5 s: 24 a minute, 74 % of the time on the air",
    "burstsAMinute": 24,
    "cores": {
     "lean": 0.13,
     "light": 0.097,
     "full": 0.301
    },
    "msABurst": {
     "lean": 317.1,
     "light": 230.5,
     "full": 774.8
    },
    "heard": {
     "bursts": 12,
     "legacyReadings": 0,
     "alert2FramesOk": 12,
     "alert2FramesBad": 0
    }
   }
  ],
  "quietCores": 0.0109
 },
 "timesARaspberryPi4": {
  "headline": {
   "perCore": 5.3,
   "wholeComputer": 4.53,
   "how": "perCore: the geometric mean of (Pi 4 cores a channel) / (this computer's cores a channel) between bursts at the windows the docs hold a Pi 4 bench figure for (240 kHz, 1200 kHz, 1440 kHz). wholeComputer: perCore x this computer's 4 cores / the every-core-busy slowdown (1.17) / a Pi 4's 4 cores.",
   "likeForLike": false,
   "warning": "The Pi 4 figures were taken with agent 0.15.x and this is agent 0.23.1: not strictly like for like (see betweenBursts.caveats). Run against a 0.15.x agent tree (git archive b744c95 agent) for the like-for-like figure.",
   "perCoreByWindow": [
    4.48,
    5.89
   ]
  },
  "betweenBursts": {
   "reference": "cores one channel takes between bursts, by the agent's own sdr-bench.js, on the Pi 4 at the first base station (18 Bateson), agent 0.15.x, written down 2026-10-24",
   "source": "RPi_ALERT docs/roadmap.md:112-113 (\"On 18 Bateson's Pi 4 the bench says 240 kHz 6%, 1.2 MHz 27%, 1.44 MHz 31% a channel\")",
   "byWindow": {
    "240000": {
     "pi4Cores": 0.06,
     "thisCores": 0.0134,
     "timesAPi4Core": 4.48
    },
    "960000": {
     "pi4Cores": null,
     "thisCores": 0.0391,
     "timesAPi4Core": null,
     "note": "no Pi 4 bench figure in the docs: docs/hardware.md:66-73 gives only the relative cost (3x a 240 kHz channel) and docs/hardware.md:77-78 a busy share with bursts (0.49 of a core for four channels), which is not this measurement"
    },
    "1200000": {
     "pi4Cores": 0.27,
     "thisCores": 0.048,
     "timesAPi4Core": 5.63
    },
    "1440000": {
     "pi4Cores": 0.31,
     "thisCores": 0.0526,
     "timesAPi4Core": 5.89
    },
    "2400000": {
     "pi4Cores": null,
     "thisCores": 0.0829,
     "timesAPi4Core": null,
     "note": "no Pi 4 bench figure in the docs: docs/hardware.md:66-73 gives only the relative cost (6.3x a 240 kHz channel)"
    }
   },
   "caveats": [
    "Taken with agent 0.15.x. Agent 0.17 says it cut the work between bursts by about a quarter (docs/roadmap.md:78-80), so the same Pi 4 may score lower (better) today and a ratio from a current agent may overstate this computer. On the x86 machine this draft was written on, the 0.15.1 and 0.23.1 trees measured within about 5 % of each other on this loop; a Pi 4 has not been re-measured. For a strict like-for-like figure run this script against a 0.15.x agent tree (git archive b744c95 agent).",
    "Under real load each decoder on that Pi 4 was about 1.6 times busier than this bench says (docs/roadmap.md:113-114)."
   ]
  },
  "burstFull": {
   "reference": "one burst's decode with the full (45-guess) decoder: about 1000 ms",
   "source": "RPi_ALERT docs/hardware.md:76-77 (\"A burst's decode \u2014 a second or so on a Pi 4\"); agent/lib/devices/sdr-worker.js:6-7 (\"a second or two on a Pi\")",
   "thisMs": 261.7,
   "timesAPi4Core": 3.8,
   "approximate": true,
   "caveat": "A round figure in prose, not a timed run of a named recording: an approximate ratio only."
  },
  "burstLean": {
   "reference": "lean against full on the Pi 4 at the first base station: 33-34 % of the full decoder's time over 11,628 live bursts",
   "source": "RPi_ALERT docs/roadmap.md:77-78",
   "pi4Ms": null,
   "thisShareOfFull": 0.317,
   "pi4ShareOfFull": 0.335,
   "note": "A share of the full decoder's time, not milliseconds: no Pi 4 ms figure for lean in the docs."
  },
  "burstLight": {
   "source": "RPi_ALERT docs/configuration.md:130-132 (\"65 ms against 122 on MegaNet's bench\") \u2014 a PC, not a Pi 4",
   "pi4Ms": null,
   "thisMs": 44.8,
   "note": "No Pi 4 figure for the light decoder in the docs."
  },
  "alert2": {
   "source": "RPi_ALERT docs/configuration.md:119-120 (\"a few tenths of a second on a Pi 4\"); docs/how-it-works.md:151 (\"0.1-0.2 s a burst on a PC, a few times that on a Pi 4\")",
   "pi4Ms": null,
   "thisMs": 49.1,
   "note": "Prose only (\"a few tenths of a second\"): no figure to divide by."
  },
  "againstTheDocsPc": {
   "reference": "the docs' own PC figures for the ALERT2 fixture's burst, full decoder, 2026-10-24: legacy decode 288 ms, ALERT2 decode 54 ms",
   "source": "RPi_ALERT docs/roadmap.md:69-70",
   "thisLegacyFullMs": 265.8,
   "thisAlert2Ms": 56.3,
   "note": "which of the two ALERT2 recordings the docs timed is not said; this is the three-PDU one"
  },
  "underLoad": "On the Pi 4 each decoder ran about 1.6 times busier under real load than the bench says (RPi_ALERT docs/roadmap.md:113-114): size from the bench x 1.6, or from the Overview's Decoder busy on the real box."
 },
 "sizing": {
  "decoder": "lean",
  "betweenBursts": "filter every sample (the default)",
  "note": "The screen dashboard (Chromium, about half a Pi 4 core: docs/hardware.md:207-208), rtl_sdr itself and the agent's main thread are not in these figures.",
  "checks": [
   {
    "check": "one channel's thread, in a 1.44 MHz window, with every half-second ALERT2 slot used",
    "formula": "1.6 x between-bursts cores at 1.44 MHz + (alert2-full-channel - quiet)",
    "ofOneCore": 0.33,
    "limit": 0.7,
    "ok": true
   },
   {
    "check": "four channels on one stick in a 1.44 MHz window, legacy ALERT at 20 bursts a minute each",
    "formula": "4 x (1.6 x between-bursts cores at 1.44 MHz + (legacy-heavy - quiet))",
    "cores": 0.42,
    "ofThisComputer": 0.12,
    "limit": 0.5,
    "ok": true
   },
   {
    "check": "eight channels on two sticks in 960 kHz windows, ALERT2 at 20 frames a minute on every one",
    "formula": "8 x (1.6 x between-bursts cores at 960 kHz + (alert2-heavy - quiet))",
    "cores": 0.82,
    "ofThisComputer": 0.24,
    "limit": 0.5,
    "ok": true
   }
  ]
 },
 "tookSeconds": 185.7
}
```
