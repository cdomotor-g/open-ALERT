# R9 — What ALERT2 will ask of a receiving base station

Written 2026-11-11. Nothing in any repository was changed by this work. (Other files in RPi_ALERT's working tree were being edited by someone else while it ran — `agent/lib/config.js`, `agent/web/app.js` and a dozen more; the decoder files measured here, under `agent/lib/devices/`, `agent/vendor/` and `agent/test/helpers/`, match commit `37fee8b`.) Everything downloaded is under `(working folder, not kept)/R9-dl/`, and the two scripts that made the measurements are under `(working folder, not kept)/R9-scripts/`.

**How each claim is labelled**

| Label | Meaning |
|---|---|
| fetched | I downloaded the page or PDF on 2026-11-11 and read the words quoted |
| snippet | Search-result text only; the page itself was not read |
| memory | From my own recall, not checked. Treat as a lead |
| computed | My arithmetic from fetched figures; the working is shown |
| measured | Run in this session on this machine with the RPi ALERT agent's own code (agent 0.23.1, commit `37fee8b`, read only) |
| repo | Read from a local checkout (RPi_ALERT `37fee8b`, MegaNet `ac3e773`) or from the earlier report `U2-decoder-cost-and-bench.md` |

Words used: a **frame** here is one ALERT2 radio transmission (an "AirLink frame"), not the repeating TDMA cycle, which is called the **TDMA frame**. A **slot** is the time a transmitter is allowed to start in. A **Pi 4 core** is one of a Raspberry Pi 4's four cores; a **Pi 4** is four of them.

Short names for the sources used most:

| Short name | Document | URL |
|---|---|---|
| AirLink 1.1 | ALERT2 AirLink Protocol Specification, Version 1.1, March 2012, NHWC ALERT2 Technical Working Group | <https://www.bluewaterdesign.us/docs/Airlink_Ver_1.1_Final.pdf> |
| AirLink 1.2 | ALERT2 AirLink Protocol Specification, Version 1.2, January 2025 ("Final", 6 Jan 2025) | <https://www.bluewaterdesign.us/docs/ALERT2_Airlink_Specification_Version_1.2.pdf> |
| MANT 1.2 | ALERT2 MANT Protocol Specification, Version 1.2, January 2025 | <https://www.bluewaterdesign.us/docs/ALERT2_MANT_Specification_Version_1.2.pdf> |
| App 1.3 | ALERT2 Application Layer Protocol Specification, Version 1.3, Final Rev E (PDF dated Nov 2019) | <https://www.bluewaterdesign.us/docs/Application_Ver_1.3_FinalE-2.pdf> |
| IND API 2.1 | ALERT2 Intelligent Network Device API Specification, Version 2.1, January 2025 | <https://www.bluewaterdesign.us/docs/ALERT2_IND_API_Specification_Version_2.1.pdf> |
| Telos 2011 | Don Van Wie, *A Description of the ALERT2 Protocol*, Telos Services, October 2011 | <https://www.bluewaterdesign.us/docs/ALERT2_Description_102511.pdf> |
| TWG high-rate proposal | *ALERT2 High Data Rate Proposal*, Blue Water Design, in the TWG's own GitHub repository (June 2017) | <https://raw.githubusercontent.com/ALERT2TWG/documentation/master/proposals/high-data-rate.md> |
| A2X manual | Blue Water Design A2X User Manual | <https://www.bluewaterdesign.us/docs/A2X_User_Manual.pdf> |
| AL205R/B manual | Campbell Scientific AL205R / AL205B ALERT2 Repeater / Base manual | <https://s.campbellsci.com/documents/us/manuals/al205r-b.pdf> |
| ERT-A2 2025 | ELPRO ERT-A2 User Manual, September 2025 | <https://elprotech.com/wp-content/uploads/2024/11/EL-ERT-A2_Manual_Sept25.pdf> |
| ERT-A2 2021 | ELPRO ERT-A2 ALERT2 Configuration Manual, Revision 1.0 / v1.1 (2021) | <https://elprotech.com/wp-content/uploads/2021/07/UserManual_ERT-A2_v1.1-2.pdf> |
| OneRain 2015 | Logan, Thompson (Bureau of Meteorology), Gayl, *ALERT2 transmission protocol…*, HWRS 2015, Hobart | <https://onerain.com/wp-content/uploads/2020/10/alert2-transmission-protocol-overview-logan-gayl-thompson-v2.0.pdf> |
| U2 | The earlier report in this folder: what the decoding costs, measured | `(working folder, not kept)/U2-decoder-cost-and-bench.md` |

---

## 0. What should change a decision

1. **The repositories work from a superseded specification.** The current AirLink is **version 1.2, final on 6 January 2025**. The agent's decoder and Flood-Net's TDMA planner cite 1.1 (2012). Version 1.2 halves the smallest slot to **250 ms** and adds **two new error-correction modes** (modes 1 and 2) that a 1.1 receiver cannot read at all: the specification says older receivers "will not receive FEC 1 and 2 messages". The agent recognises only mode 0's sync word. MANT 1.2 also adds **AES-128 encryption of the payload**; an independent base without the network's key reads the header (who sent it, by which path) and nothing else. These are software and access questions, not hardware ones, but they decide whether a base hears a network at all (sections 1.4, 1.5).
2. **ALERT2's higher bit rate and its error correction are not what cost CPU.** Measured here, the Viterbi and Reed–Solomon steps are about 3 % of one ALERT2 decode; the rest is filtering the window of samples. The new modes' larger Viterbi would add about a fifth. CPU follows **how many bursts a minute and how many seconds of window are filtered**, the same as legacy ALERT (section 3.3).
3. **The worst case for one channel is about 1.1–1.3 Pi 4 cores of burst work, on one thread**, plus 0.1–0.5 for the channel's standing filter. I re-measured U2's figure independently and got the same (0.263 of a core of this machine against U2's 0.266). So the binding limit is still the speed of one core: **buy cores at least 2.5 times a Pi 4 core**. A Cortex-A53 class core (Verdin AM62) cannot hold one such channel (sections 3.4, 6).
4. **With 250 ms slots the agent loses frames before it runs out of CPU.** Back-to-back transmissions merge into one long burst; the burst is cut at 3 s and at most 8 frames are read from a window. In a synthesised test 74 of 110 frames were read, at only 0.157 of a core. This needs a software change before any hardware matters (section 3.4).
5. **Sizing.** At a plausible storm peak after a transition the load is about **1.3–1.7 times today's**; at the protocol's worst case on every channel at once it is **2.7–4.3 times**. Prudent to buy now: **4 channels, about 10 Pi 4 cores (2.5 Pi 4s); 8 channels, about 16 (4 Pi 4s) spread over 6–8 cores; 16 channels, about 28–32 (7–8 Pi 4s), or two computers** (section 6).
6. **A receive-only base does not need GPS.** Blue Water Design's manual says so in words; Campbell's base accepts network time (NTP) instead. GPS is needed only to transmit in a slot (section 4).
7. **An RTL-SDR stick is adequate if it has a 1 ppm crystal and a filter in front; its weakness is strong signals.** A plain stick can be 100 ppm off, which is 15 kHz at 151.5 MHz, more than a whole channel. Eight bits give about 48 dB before a strong signal in the window buries a weak one, so a base sharing a mast with a transmitter needs a cavity or band-pass filter, or a 12-bit radio (section 3.5).
8. **Real ALERT2 networks run far below the worst case.** Harris County (155 sites): about 31 messages a minute at one receiver over nine months. Charlotte: one half-second slot per site every five minutes. The Seqwater link heard in Brisbane: about 20 frames a minute. The ceiling is 120 a minute (AirLink 1.1) or 240 (1.2) (section 5).
9. **Nothing public gives an Australian ALERT2 timetable.** The Bureau's and Queensland's flood-network pages that could be read name no radio protocol. `bom.gov.au` and `hydrologicwarning.org` refused automated reading (section 5.3, *Could not confirm*).
10. **An independent open-source ALERT2 decoder now exists**: `K6NLC/alert2_decoder` (Python, GPL-3.0, first public commit 26 October 2026), built to AirLink 1.2 with modes 0–2. It is a ready cross-check for the agent's decoder, though its licence (GPL-3.0) differs from RPi ALERT's (MIT) (section 3.6).

---

## 1. The physical layer

### 1.1 The signal

| Property | Value | Words or figure that support it | Source | Label |
|---|---|---|---|---|
| Modulation | Two-level frequency shift keying, made by feeding a filtered bit stream into the audio input of an ordinary FM radio | "The air interface RF modulation is frequency shift keying (FSK)… designed to interface to the audio input of a commercial off-the-shelf (COTS) FM transceiver" (§2.3) | [AirLink 1.1](https://www.bluewaterdesign.us/docs/Airlink_Ver_1.1_Final.pdf), unchanged in [AirLink 1.2](https://www.bluewaterdesign.us/docs/ALERT2_Airlink_Specification_Version_1.2.pdf) | fetched |
| Bit rate | 4800 bits a second, one bit a symbol, so 4800 symbols a second. Tolerance ±3 % | "The data bits must be shifted out at 4800 bps, +/- 3%" (§2.3) | [AirLink 1.1](https://www.bluewaterdesign.us/docs/Airlink_Ver_1.1_Final.pdf) | fetched |
| Line code | Non-return-to-zero, most significant bit first, no start or stop bits, no gaps between blocks | §2.2.5 "bit synchronous… no 'start' or 'stop' or other bits" | [AirLink 1.1](https://www.bluewaterdesign.us/docs/Airlink_Ver_1.1_Final.pdf) | fetched |
| Pulse shape | Root-raised-cosine, roll-off 0.96, T = 1/4800 s. The reference is a 71-order filter at 43.2 kHz (9 samples a bit) | "T shall be 1/4800 seconds and beta is 0.96"; "71 order; With a sample rate of 43.2 kHz" (§2.3, Figure 2-3) | [AirLink 1.1](https://www.bluewaterdesign.us/docs/Airlink_Ver_1.1_Final.pdf) | fetched |
| Baseband width | About 4.7 kHz: (1 + 0.96) × 4800 ÷ 2 | arithmetic from the row above | — | computed |
| FM deviation | **Not specified.** The audio level is adjustable to suit the radio (±50 to ±500 mV peak to peak into 600 Ω) | §2.3 "audio output level must be continuously adjustable" | [AirLink 1.1](https://www.bluewaterdesign.us/docs/Airlink_Ver_1.1_Final.pdf) | fetched |
| Channel width | Set by the radio and the licence, not by the protocol. ELPRO: "The ERTA2 unit supports channel Bandwidth of 12.5kHz"; its 2021 specification table lists channel spacing "6.25, 12.5, 25.0kHz (software configurable)" while its text says "only supports channel spacing of 12.5kHz" | as quoted | [ERT-A2 2025](https://elprotech.com/wp-content/uploads/2024/11/EL-ERT-A2_Manual_Sept25.pdf), [ERT-A2 2021](https://elprotech.com/wp-content/uploads/2021/07/UserManual_ERT-A2_v1.1-2.pdf) | fetched |
| ELPRO radio | "ALERT2™: 2-FSK", 4800 bps, receiver sensitivity −117 dBm for ALERT and ALERT2 alike, frequency stability 1.0 ppm, 148–174 MHz | specification table | [ERT-A2 2021](https://elprotech.com/wp-content/uploads/2021/07/UserManual_ERT-A2_v1.1-2.pdf) | fetched |
| Against legacy ALERT | 300 baud audio tones; about 200 ms of preamble then a 133 ms message carrying 24 useful bits: "the data throughput is approximately 72 bits per second" | Introduction; Figure 3 | [Telos 2011](https://www.bluewaterdesign.us/docs/ALERT2_Description_102511.pdf) | fetched |

### 1.2 The preamble and tail

| Part | AirLink 1.1 (2012) | AirLink 1.2 (2025) | Source | Label |
|---|---|---|---|---|
| Carrier only | "minimum of 20 milliseconds… up to 60 milliseconds" in noisy places | "may begin with unmodulated carrier, or this may be omitted" | §2.2.1 of [1.1](https://www.bluewaterdesign.us/docs/Airlink_Ver_1.1_Final.pdf) and [1.2](https://www.bluewaterdesign.us/docs/ALERT2_Airlink_Specification_Version_1.2.pdf) | fetched |
| Tone for the receiver's gain control | 15 ms of a 2000–2500 Hz tone | "Typical durations range from 25 to 70 milliseconds"; same tone | §2.2.2 of each | fetched |
| Bit sync (correlation) | 48 bits, `0xEB90B433AAAA`: 10.0 ms | the same | §2.2.3 | fetched |
| Frame sync | 32 bits, `0x352EF853`: 6.67 ms | 32 bits that **also name the error-correction mode**: mode 0 `0x352EF853`, mode 1 `0x5898233E`, mode 2 `0xEE434E88` | §2.2.4, Figure 2-3 of [1.2](https://www.bluewaterdesign.us/docs/ALERT2_Airlink_Specification_Version_1.2.pdf) | fetched |
| Tail | carrier only, "typically 5 milliseconds" | "A 1 millisecond unmodulated carrier tail is typically sufficient" | §2.1 of each | fetched |
| IND API defaults | carrier only 10 ms, tone 55 ms, tail 5 ms (API 1.0, 2013) | carrier-only range now 0–1000 ms; minimum tail 1 ms (API 2.1 change log) | [IND API 1.0](https://s.campbellsci.com/documents/us/miscellaneous/alert2-intelligent-network-device.pdf), [IND API 2.1](https://www.bluewaterdesign.us/docs/ALERT2_IND_API_Specification_Version_2.1.pdf) | fetched |

The agent's decoder looks for the 80 bits `EB90B433AAAA 352EF853` only (repo: `/home/user/RPi_ALERT/agent/lib/devices/alert2-air.js` line 31), so it finds mode 0 frames and no others.

### 1.3 The frame, the blocks and the error correction (mode 0, the only mode in AirLink 1.1)

| Step | Detail | Source | Label |
|---|---|---|---|
| Header | 2 bytes: 2 bits version (0), 4 reserved, 10 bits length. "The maximum AirLink Payload is 1023 bytes" | §3.1 [AirLink 1.1](https://www.bluewaterdesign.us/docs/Airlink_Ver_1.1_Final.pdf) | fetched |
| Payload | One or more whole MANT messages, oldest first; over 1023 bytes the oldest are dropped | §3.2 | fetched |
| Blocks | First block always 24 bytes (2 header + 22 data, padded with `0x55`); follow-on blocks of up to 32 bytes | §3.2, Figure 3-2 | fetched |
| Scrambler | 17-bit maximal-length sequence, x^17 + x^3 + 1, restarted for each block, before the error correction | §3.3 | fetched |
| Outer code | Reed–Solomon over 8-bit symbols, 16 parity bytes a block, corrects up to 8 byte errors (the CCSDS code, shortened) | §3.4.1 | fetched |
| Interleaving | **None.** "symbol interleaving shall not be performed… It is unnecessary because MLS bit scrambling has already been applied" | §3.4.1 | fetched |
| Inner code | Convolutional, rate ½, constraint length 7, polynomials `0x6D` and `0x4F` ("the NASA standard"), second output not inverted. The first block is coded on its own so the length can be read early; all follow-on blocks are coded as one stream | §3.4.2 | fetched |
| On the air | First block 82 bytes (24 + 16 parity, doubled, + 2 tail); a full follow-on block 96; a last block of *n* bytes (*n* + 16) × 2, + 2 tail once | Figure 3-6 | fetched |
| Net rate | "an effective data throughput of 1600 bits per second" in full follow-on blocks; overhead "about 240% of payload in the first block, and 200%… in full follow-on blocks" | [Telos 2011](https://www.bluewaterdesign.us/docs/ALERT2_Description_102511.pdf), *Forward Error Correction* | fetched |
| Error detection | "error detection is at least as good as a 16-bit CRC"; "In a month of operation in a production ALERT2 system, 1 block was discarded out of 115,000 received" | [Telos 2011](https://www.bluewaterdesign.us/docs/ALERT2_Description_102511.pdf) | fetched |

The agent's own notes (repo: `/home/user/RPi_ALERT/agent/lib/devices/alert2-fec.js` lines 6–17) match every row: the same scrambler, the same Reed–Solomon with 16 parity bytes, the same two polynomials, found from frames heard off the air in Brisbane.

### 1.4 What AirLink 1.2 adds: three error-correction modes

| Mode | First block / follow-on block (bytes) | Convolutional code | Reed–Solomon parity | Receive sensitivity against mode 0 | Most data in a 250 / 500 / 2000 ms slot (bytes) | Source | Label |
|---|---|---|---|---|---|---|---|
| 0 | 24 / 32 | k = 7, rate ½, `0x6d` `0x4f` | 16 | 0 dB | 22 / 77 / 377 | Figures 3-1, 3-3, 3-7 of [AirLink 1.2](https://www.bluewaterdesign.us/docs/ALERT2_Airlink_Specification_Version_1.2.pdf) | fetched |
| 1 | 44 / 44 | k = 9, rate 2/3 (punctured), `0x1af` `0x11d` | 20 | −1.5 dB | 42 / 111 / 523 | the same | fetched |
| 2 | 54 / 54 | k = 9, rate 3/4 (punctured), `0x1af` `0x11d` | 20 | −2.5 dB | 52 / 133 / 625 | the same | fetched |

| Fact | Words that support it | Source | Label |
|---|---|---|---|
| Version 1.2 is final and public | Release history: "6 Jan 2025 1.2 Final Public TWG, David Van Wie"; revision "16 Sep 2024 1.2 Incorporated Configurable FEC" | [AirLink 1.2](https://www.bluewaterdesign.us/docs/ALERT2_Airlink_Specification_Version_1.2.pdf) | fetched |
| Old receivers do not hear the new modes | "Receivers implementing the older standard will continue to receive FEC mode 0 messages, but will not receive FEC 1 and 2 messages" (§8.1) | the same | fetched |
| The smallest slot is now 250 ms | "The minimum slot time shall be 250 milliseconds, variable in increments of 250 milliseconds" (§4.2.1). In 1.1 it was 500 ms | [AirLink 1.2](https://www.bluewaterdesign.us/docs/ALERT2_Airlink_Specification_Version_1.2.pdf), [AirLink 1.1](https://www.bluewaterdesign.us/docs/Airlink_Ver_1.1_Final.pdf) | fetched |
| Why | "it should be possible to fit most sites into a 250ms slot, cutting the effective channel utilization by a factor of 2"; of Harris County's 155 sites, "152 (98%) meet the criteria for moving to a 250ms slot" | [TWG high-rate proposal](https://raw.githubusercontent.com/ALERT2TWG/documentation/master/proposals/high-data-rate.md) | fetched |
| Products already do it | AL200X: "AirLink v1.2 draft", "Support 250-millisecond slots and configurable forward error correction"; AL205E setting "FEC, AirLink Encoding Mode… 0 (default)… 1 = medium… 2 = lowest error correction; highest throughput"; A2X: "Implements proposed protocol extension for Configurable Forward Error Correction" | [AL200X brochure](https://s.campbellsci.com/documents/us/product-brochures/b_al200x.pdf), [AL205E manual](https://s.campbellsci.com/documents/us/manuals/al205e.pdf), [A2X specifications](https://www.bluewaterdesign.us/docs/A2X_Specifications.pdf) | fetched |
| Mode 2 is on the air somewhere | The K6NLC decoder's notes: mode 2 "validated byte-exact on a recording from another network"; mode 1 "no real-world mode-1 capture has been seen yet" | <https://github.com/K6NLC/alert2_decoder> | fetched (a summary of the README by the fetch tool) |
| Net rate by mode | Mode 0: 32 of 96 bytes, 1600 bits a second. Mode 1: 44 of 96, 2200. Mode 2: 54 of 98, about 2650 | Figure 3-8 of AirLink 1.2 | computed |
| The ELPRO ERT-A2 | Neither manual mentions an error-correction mode, a 250 ms slot or encryption | [ERT-A2 2025](https://elprotech.com/wp-content/uploads/2024/11/EL-ERT-A2_Manual_Sept25.pdf), [ERT-A2 2021](https://elprotech.com/wp-content/uploads/2021/07/UserManual_ERT-A2_v1.1-2.pdf) (searched the extracted text) | fetched |

### 1.5 Encryption (MANT 1.2)

| Fact | Words that support it | Source | Label |
|---|---|---|---|
| Payloads can be encrypted; headers stay readable | "Encryption is implemented at the MANT layer, concealing the payload while leaving the header in plain text. Repeaters, therefore, need not know how to decrypt a message… plain text and encrypted messages can coexist on the same system" (§3.5) | [MANT 1.2](https://www.bluewaterdesign.us/docs/ALERT2_MANT_Specification_Version_1.2.pdf) | fetched |
| The cipher | "AES-128, in the counter mode of operation"; a 3-byte Encrypted Message ID that counts up is the nonce; "anyone possessing the encryption key is authenticated" | the same | fetched |
| It does not need accurate time | The nonce is the message counter, not the clock. (The 2017 proposal had offered a clock-based nonce in quarter seconds; the final specification uses the counter) | [MANT 1.2](https://www.bluewaterdesign.us/docs/ALERT2_MANT_Specification_Version_1.2.pdf); [2017 encryption proposal](https://raw.githubusercontent.com/ALERT2TWG/documentation/master/proposals/encryption.md) | fetched |
| Products | AL200X: "Ensure data integrity with encrypted ALERT2 messages"; A2X: "Implements proposed protocol extension for Encryption and Authorization" | [AL200X brochure](https://s.campbellsci.com/documents/us/product-brochures/b_al200x.pdf), [A2X specifications](https://www.bluewaterdesign.us/docs/A2X_Specifications.pdf) | fetched |

For a base that is not given a network's key, an encrypted network yields sources and paths but no readings. Whether any Australian network encrypts is not known.

### 1.6 How long a frame is on the air

Working: bits ÷ 4800, plus the preamble and tail.

| Frame | On the air (bytes) | Air time | How it was worked | Label |
|---|---:|---:|---|---|
| Up to 22 bytes, mode 0, 2011 planning preamble (60 ms carrier + 15 ms tone + 16.7 ms sync, 5 ms tail) | 82 | 233 ms | Telos's "228 msec first block" + tail | computed from [Telos 2011](https://www.bluewaterdesign.us/docs/ALERT2_Description_102511.pdf) |
| 54 bytes, the same preamble | 180 | 397 ms | what a half-second slot with ±50 ms buffers holds | computed |
| Up to 22 bytes, mode 0, AirLink 1.2's example timing (35 ms tone, no carrier-only, 1 ms tail) | 82 | 189 ms | 35 + 16.7 + 136.7 + 1 | computed from [AirLink 1.2](https://www.bluewaterdesign.us/docs/ALERT2_Airlink_Specification_Version_1.2.pdf) |
| Up to 42 bytes, mode 1, the same | 98 | 216 ms | 35 + 16.7 + 163.3 + 1 | computed |
| Up to 52 bytes, mode 2, the same | 100 | 219 ms | 35 + 16.7 + 166.7 + 1 | computed |
| 350 bytes, mode 0 | 1,092 | about 1.9 s | 82 + 10 × 96 + 48 + 2; the longest the Brisbane base has heard is 349 bytes, 1.9 s (repo: `/home/user/RPi_ALERT/docs/roadmap.md` lines 71–72) | computed; repo |
| 1023 bytes (the most a frame holds), mode 0 | 3,110 | 5.2–5.3 s | 82 + 31 × 96 + 50 + 2 | computed |
| 1023 bytes, mode 2 | about 1,866 | about 3.2 s | 100 + 17 × 98 + 100 | computed |
| A legacy ALERT report, for comparison | — | about 333 ms | "It takes about 333 msec to send a single ALERT sensor report" | fetched, [OneRain 2015](https://onerain.com/wp-content/uploads/2020/10/alert2-transmission-protocol-overview-logan-gayl-thompson-v2.0.pdf) |

So a typical frame is 0.19–0.4 s and the longest possible is about 5.3 s. The agent cuts a burst at 3 s (section 3.4).

---

## 2. Channel access

### 2.1 The rules

| Rule | Words or figure | Source | Label |
|---|---|---|---|
| Two access methods; time slots preferred | "The recommended access method is TDMA in order to provide a contentionless radio network. It is possible to mix access methods on a single channel, but doing so will reduce the benefits of TDMA" (§4) | [AirLink 1.2](https://www.bluewaterdesign.us/docs/ALERT2_Airlink_Specification_Version_1.2.pdf) | fetched |
| Random access (ALOHA) | Transmit as soon as there is something, then hold off 10 s measured from the end of the tail | §4.1 | fetched |
| Slots | Smallest 250 ms (was 500 ms), in 250 ms steps; a device may hold several slots, together or spread | §4.2.1 | fetched |
| The plan is fixed | "The AirLink TDMA access method is statically configured; devices' time slot allocations are invariant, unless reconfigured" (§4.2) | the same | fetched |
| TDMA frame length | 5,000–3,600,000 ms, default 15,000; a whole multiple of the smallest slot and "evenly divisible into twelve hours" | [IND API 2.1](https://www.bluewaterdesign.us/docs/ALERT2_IND_API_Specification_Version_2.1.pdf) (parameter 0x48) | fetched |
| Slot length | 250–10,000 ms, default 1,000 | IND API 2.1 (parameter 0x4A) | fetched |
| Typical frames | "generally chosen to be a multiple or sub-multiple of 60 seconds" | [Telos 2011](https://www.bluewaterdesign.us/docs/ALERT2_Description_102511.pdf) | fetched |
| Timing | UTC; "The needed clock accuracy is usually achieved by regularly syncing the clock to the time obtained from a GPS receiver". A device that cannot refresh its clock in time "must switch to a time of transmission that is randomized across the TDMA frame" | Telos 2011; AirLink 1.2 §4.4 | fetched |
| Buffers | 2011 planning: ±50 ms, so 400 ms usable in a 500 ms slot and 900 in 1000. AirLink 1.2's capacity table assumes only "23 ms pad" | Figure 4-2 of each AirLink; Figure 3-1 of 1.2 | fetched |
| Clock quality of current gear | AL200X: "60 PPB (0.06 PPM) clock drift"; A2X: 2 ppm (0–40 °C), "able to maintain synchronization for up to 4 hours without the GPS being on" | [AL200X brochure](https://s.campbellsci.com/documents/us/product-brochures/b_al200x.pdf), [A2X specifications](https://www.bluewaterdesign.us/docs/A2X_Specifications.pdf), [A2X manual](https://www.bluewaterdesign.us/docs/A2X_User_Manual.pdf) | fetched |
| Repeaters | Take a slot of their own, on the same channel if wished, and send everything heard since their last slot as one frame. "A repeater with a 5 second slot can concatenate and retransmit approximately 35 ALERT2 single block frames" | [Telos 2011](https://www.bluewaterdesign.us/docs/ALERT2_Description_102511.pdf) | fetched |
| Concentrators | A repeater that hears legacy ALERT and sends it on as ALERT2: 4 bytes a legacy reading (3 of data, 1 of "seconds held"). "ALERT Concentration is specified to operate on a time cycle of 255 seconds or less". "A single 2-second slot in a 15-second frame has a theoretical capacity of over 20,000 ALERT messages per hour" | [App 1.3](https://www.bluewaterdesign.us/docs/Application_Ver_1.3_FinalE-2.pdf) §3.1; Telos 2011 | fetched |
| ELPRO's concentrator | A second ERT-A2 in legacy ALERT mode, linked by RS-485, "will output to the repeater as ALERT2 Concentration frames"; "Repeater will aggregate data frames in periods of high message density" | [ERT-A2 2025](https://elprotech.com/wp-content/uploads/2024/11/EL-ERT-A2_Manual_Sept25.pdf) | fetched |

### 2.2 How many stations a channel holds, and how many frames an hour

| Case | Slots and stations | Frames an hour | Source | Label |
|---|---|---:|---|---|
| The textbook example | 30 gauges at ½ s each and one repeater at 5 s, in a 20 s TDMA frame | up to 5,580 (31 × 180) | [Telos 2011](https://www.bluewaterdesign.us/docs/ALERT2_Description_102511.pdf) | fetched; rate computed |
| A real network, Charlotte, USA | "each field site having an assigned 500 ms transmit window every 5 minutes… Data from the entire network are transmitted and received in approximately 2-1/2 minutes"; 72 rain gauges and the stream gauges | about 12 a site: of the order of 1,000–3,500 | <https://nc.water.usgs.gov/charlotte/data/AL2Conversion-36x48.pdf> (USGS poster, 2018) | fetched; rate computed |
| Ceiling, AirLink 1.1 | 120 slots a minute at 500 ms: a 60 s TDMA frame holds 120 transmitters, a 5-minute one 600 | 7,200 | §4.2.1 | computed |
| Ceiling, AirLink 1.2 | 240 slots a minute at 250 ms: a 60 s TDMA frame holds 240, a 5-minute one 1,200 | 14,400 | §4.2.1 | computed |
| A concentrator's reach | 84 legacy readings in a 2 s slot (345 usable bytes less 9 of headers, ÷ 4); in a 15 s frame, 20,160 an hour | — | repo: `/home/user/MegaNet/docs/tdma-planner.md` line 141, from Telos 2011 | repo |
| Legacy ALERT, where it peaks | Random access with 333 ms reports delivers at most 0.184 of the channel's time: about 2,000 reports an hour, and at that point 63 % of what is sent is lost | about 2,000 | the pure-ALOHA formula S = G·e^(−2G), peak at G = 0.5 | memory (the formula); computed |
| Legacy ALERT at 10 % loss | Offered load G ≤ 0.053: about 570 reports an hour | about 570 | the same formula | memory; computed |
| Legacy ALERT in the field | "data losses as high as 55% have been documented"; Harris County received 65 % of expected legacy reports in the Memorial Day 2015 storm, "loss of up to 60%" before the upgrade | — | Telos 2011; <https://s.campbellsci.com/documents/us/case-studies/texas-transition-alert2.pdf> | fetched |

So one ALERT2 channel can carry 4–7 times the transmissions a legacy channel delivers at its peak, 13–25 times what it delivers at tolerable loss, and each transmission carries several readings.

### 2.3 The worst-case duty a receiver must decode on one channel

| Case | On the air | Share of the time | Label |
|---|---|---:|---|
| Every 500 ms slot used, ±50 ms buffers (2011 planning) | 397 ms of each 500 | 79 % | computed |
| Every 250 ms slot used, AirLink 1.2 timing, mode 0, 22 bytes | 189 ms of each 250 | 76 % | computed |
| The same, modes 1 and 2 | 216–219 ms of each 250 | 86–88 % | computed |
| Every 500 ms slot filled to AirLink 1.2's stated capacity (77 bytes, mode 0) | about 480 ms of each 500 | about 95 % | computed |
| A repeater's 5 s run filled | 4.9–5.0 s of 5 | 98 % or more | computed |
| What the Brisbane base hears today on the Seqwater link | about 20 frames a minute of about 0.3–0.5 s | about 10–17 % | repo (U2 §3.4, §4.3); computed |

**Worst case to design for: one channel on the air 80–97 % of the time, as 120 to 240 separate transmissions a minute, or as a few long repeater runs.** A legacy channel in a severe storm can also be busy most of the time, but mostly with collided bursts that decode to nothing; each still costs a whole decode (repo: `/home/user/RPi_ALERT/docs/hardware.md` lines 112–113).

---

## 3. Decoding it off the air with a software-defined radio

### 3.1 The steps

The specification's own receive chain is "De-modulator → RRC Filter → Correlation, Bit and Frame Sync → Convolutional Decoder → Reed Solomon Decoder → MLS De-scrambler" (Figure 1-2 of [AirLink 1.1](https://www.bluewaterdesign.us/docs/Airlink_Ver_1.1_Final.pdf), fetched). It adds that the decoder "has a significantly greater computational complexity and power demand than the encoder" (§1.2), which is about 2008-era microcontrollers, not a Linux computer.

| Step | What it needs | In the agent today (repo: `alert2-air.js`, `alert2-fec.js`) |
|---|---|---|
| 1. Cut the channel out of the stick's window | A low-pass filter and a cut in sample rate to a few samples a bit | 240 ksps window → 121-tap filter → 48 kHz (10 samples a bit) |
| 2. Find the carrier | The stick's and the transmitter's frequency errors, a few hundred Hz | Spectrum of the burst against the quiet around it, within ±10 kHz |
| 3. FM demodulate | A discriminator on the mixed-down channel | 63-tap ±7 kHz filter, then the phase step between samples |
| 4. Matched filter | The same root-raised-cosine as the transmitter | 121 taps, roll-off 0.96 |
| 5. Find the sync | Correlate against the 80 known bits; no squelch needed (§5: "continuously search for the bit synchronization pattern") | Correlation, either polarity, mode 0's pattern only |
| 6. Recover the bit clock | "some form of bit clock recovery algorithm… to allow correct decoding with mismatches in system clocks" (§2.2.5); the rate may be off by ±3 % | Searches ±1 % of 4800, then finely over the whole frame. A transmitter at the edge of the ±3 % the specification allows would not be read; real ones are crystal-timed, so this has not mattered |
| 7. Viterbi | 64 states (mode 0), 256 (modes 1 and 2, with de-puncturing) | Soft-decision, 64 states |
| 8. Reed–Solomon | Up to 8 byte errors a block (10 in modes 1 and 2) | Berlekamp–Massey, Chien, Forney |
| 9. Descramble, split into MANT messages, read the application reports | Table lookups | Done; concentration records and general sensor reports |

**Sample rate.** The signal needs about 15 kHz of complex bandwidth at most (4.7 kHz of baseband on FM in a 12.5 kHz channel). The reference design works at 43.2 kHz, the K6NLC decoder resamples to 43.2 kHz, the agent to 48 kHz. An RTL-SDR's narrowest window is far wider than that already; the cost is in step 1, cutting the channel out of a wide window, exactly as for legacy ALERT.

### 3.2 Where the time goes: measured

Script: `(working folder, not kept)/R9-scripts/alert2-stage-bench.js`; output: `(working folder, not kept)/R9-dl/alert2-stage-bench-output.json`. The machine is the same shared 4-core Xeon virtual machine U2 used (Node v22.23.4), which U2 put at 4 to 5 times a Pi 4 core per thread. Frames were made with the agent's own test transmitter at 20 dB.

| One call of the agent's ALERT2 decode (`receive()`), ms of one core here | ms | Label |
|---|---:|---|
| 1.25 s window, noise only (a burst that is not ALERT2) | 41 | measured |
| 1.25 s window, 22-byte frame (one block) | 44 | measured |
| 1.25 s window, 54-byte frame (two blocks) | 54 | measured |
| 1.4 s window, 77-byte frame | 57 | measured |
| 2.0 s window, 200-byte frame | 82 | measured |
| 2.7 s window, 350-byte frame | 121 | measured |
| 3.4 s window, 500-byte frame | 145 | measured |
| For comparison, one legacy ALERT decode of a 1.25 s window: Full 262, Lean 83 (the default), Light 45 | — | repo (U2 §2.3) |

| The error correction on its own | Result | Label |
|---|---:|---|
| The agent's Viterbi (k = 7) over one second of continuous air (2400 decoded bits) | 1.3 ms | measured |
| A k = 9 Viterbi written the same way, over one second of mode 1 air (3200 bits) / mode 2 (3600 bits) | 10.5 / 12.0 ms | measured |
| Reed–Solomon, one block: clean / with 8 byte errors | 0.003 / 0.009 ms | measured |
| Reed–Solomon over one second of air (6.25 blocks), all at the limit of 8 errors | 0.06 ms | measured |

What this shows:

- **A decode costs about 33–47 ms for each second of window, whatever is in it.** A window with no frame at all costs 41 ms; adding a 22-byte frame adds 3 ms.
- **The error correction is about 3 % of the work in mode 0.** The new modes' 256-state Viterbi is 8–9 times dearer but would add only about 10 ms for each second on the air, roughly a fifth on top of a decode. The K6NLC decoder's own notes say the same: trying all three modes "adds about 20% CPU" (<https://github.com/K6NLC/alert2_decoder>, fetched).
- **So the bit rate is not the cost.** An ALERT2 decode on its own (44–57 ms) is cheaper than the default legacy decode (83 ms). An ALERT2 burst costs more than a legacy one today only because the agent tries every burst as legacy first: about 1.6 times (repo: U2 §2.3).

### 3.3 CPU for a frame against a legacy burst

| Burst | Cost on one core here | In Pi 4 core-seconds (× 4 to 5) | Label |
|---|---:|---:|---|
| Legacy ALERT, Lean decoder | 83 ms | 0.33–0.41 | repo (U2) |
| ALERT2, short frame, as shipped (legacy try, then ALERT2) | 130–148 ms | 0.52–0.74 | repo (U2) |
| ALERT2, short frame, if the legacy try were skipped on a channel known to be ALERT2 | 44–57 ms | 0.18–0.28 | measured; conversion from U2 |
| ALERT2, 350-byte frame, as shipped | about 300 ms | about 1.4 | repo (U2) |
| Added by modes 1 and 2, if written as the present Viterbi | about +10 ms for each second on the air | +0.04–0.05 | measured |

The conversion to a Pi 4 rests on U2's ratio, which U2 itself calls thin: no Pi 4 was measured in either piece of work.

### 3.4 One channel at the worst case, through the agent's real decoder thread

Script: `(working folder, not kept)/R9-scripts/alert2-v12-storm.js`; output: `(working folder, not kept)/R9-dl/alert2-v12-storm-output.json`. One channel in a 240 kHz window, 32 s of synthesised signal at 22 dB, fed through `sdr-worker.js` as a base station runs it (squelch, gate, legacy try, ALERT2 try). A quiet channel this way costs 0.015 of a core. All frames are mode 0, the only mode the agent's transmitter and decoder know.

| Scenario | Frames sent | Bursts the squelch made of them | Frames read | Cores here, Lean (default) | Cores here, Light | Lean, in Pi 4 cores (× 4 to 5) |
|---|---:|---:|---:|---:|---:|---:|
| a. Every 500 ms slot, 54-byte frames (AirLink 1.1's half-second slot) | 55 | 55, each 364 ms | **55** | **0.263** | 0.198 | **1.05–1.32** |
| b. Every 250 ms slot, 22-byte frames (AirLink 1.2's smallest slot, 240 a minute) | 110 | 10, each 3.02 s | **74** | 0.157 | 0.116 | 0.63–0.79 |
| c. Every 500 ms slot, 77-byte frames (AirLink 1.2's 500 ms capacity; about 27 ms between transmissions) | 55 | 10, each 3.02 s | **55** | 0.173 | 0.117 | 0.69–0.87 |
| d. Back-to-back 2 s repeater runs of 377 bytes | 14 | 10, each 3.02 s | **9** (5 cut off) | 0.165 | 0.114 | 0.66–0.83 |

All measured. What follows:

- **Row a repeats U2's worst case and agrees with it** (0.263 against U2's 0.266). The cost is high because every burst gets a window of its own with 0.4 s either side, never under 1.2 s, so each second of signal is filtered more than twice.
- **Rows b to d show the next limit is in the software, not the CPU.** The squelch closes only after 100 ms of quiet (ten 10 ms blocks under its threshold), so transmissions that follow each other more closely become one burst. The burst is cut at 3 s (repo: `/home/user/RPi_ALERT/agent/vendor/meganet/alert-dsp.js` lines 1251–1253 for both; `/home/user/RPi_ALERT/docs/roadmap.md` line 71: "frames longer than the burst gate's 3 s are cut off") and at most 8 frames are read from a window (repo: `alert2-air.js` line 425; the worker passes no other limit, `sdr-worker.js` line 106). At 240 a minute a third of the frames were lost while the thread used only 0.157 of a core. Long repeater runs lost every frame that straddled a 3 s cut. AirLink 1.2's example timing leaves 23 ms of pad in a slot, well under 100 ms, so on a channel planned that way full slots will always merge.
- **So the most CPU one channel can ask for, with today's software, is row a: about 1.1–1.3 Pi 4 cores of burst work on a single thread.** Adding the channel's standing filter (0.10 Pi 4 core in a 240 kHz window, 0.50 in 1.44 MHz, loaded; repo: U2 §5) gives 1.2–1.8 Pi 4 cores on one thread.
- This was synthesised signal. Real radios take time to key up and down, and the gaps on a real channel depend on each transmitter's settings. Whether real 250 ms traffic merges the same way has not been seen off the air.

### 3.5 Is an 8-bit RTL-SDR stick adequate?

| Question | Finding | Source | Label |
|---|---|---|---|
| Resolution | "The native resolution is 8 bits, but the Effective Number of Bits (ENOB) is estimated at ~7. Decimation in software may raise this value" | <https://www.rtl-sdr.com/about-rtl-sdr/> | fetched |
| Sample rate | "The maximum sample rate is 3.2 MS/s… However, the RTL-SDR is unstable at this rate and may drop samples. The maximum sample rate that does not drop samples is 2.56 MS/s" | the same | fetched |
| Frequency accuracy, good stick | RTL-SDR Blog V3: "a 1PPM TCXO… The temperature drift is around 0.5 – 1 PPM, and the initial offset is 0 – 2 PPM" | <https://www.rtl-sdr.com/wp-content/uploads/2018/02/RTL-SDR-Blog-V3-Datasheet.pdf> | fetched |
| Frequency accuracy, plain stick | "Standard dongles have a PPM offset of up to 100PPM, and tend to drift a lot" | the same | fetched |
| What that means at 151.5 MHz | 1 ppm is about 150 Hz: nothing, since the decoder searches ±10 kHz for the carrier. 100 ppm is about 15 kHz: more than a 12.5 kHz channel, so a plain stick can sit on the neighbouring channel | arithmetic | computed |
| Against a purpose-built receiver | ELPRO ERT-A2: 1.0 ppm, −117 dBm sensitivity | [ERT-A2 2021](https://elprotech.com/wp-content/uploads/2021/07/UserManual_ERT-A2_v1.1-2.pdf) | fetched |
| Sensitivity in principle | Thermal noise in 12.5 kHz is about −133 dBm; with a tuner noise figure of about 4–6 dB and about 10 dB needed over the noise, an RTL-SDR should read down to about −117 to −119 dBm, the same order as the ERT-A2. The noise figure of an RTL-SDR's tuner was not read from a datasheet; for scale, the Airspy Mini's page quotes 3.5 dB for its own front end | arithmetic; <https://airspy.com/airspy-mini/> for the 3.5 dB | computed, with the noise figure assumed (memory); fetched |
| Dynamic range | "Ideally, the maximum range represented by an 8 bit A/D converter is around 48dB"; the page advises "a band-pass filter that limits the signals getting into it" to the band wanted | <https://www.sdrutah.org/info/rx_rtl_sdr.html> | fetched (through the fetch tool's summary) |
| What narrow channels buy back | Filtering a 12.5 kHz channel out of a 1.44 MHz window gains about 21 dB (10·log of the ratio); out of 240 kHz, about 13 dB. So a weak station can sit roughly 60–70 dB below the strongest signal in the window, less the 10 dB it needs itself | arithmetic | computed |
| The weak point | A transmitter on the same mast, in or near the window (a repeater's own output, a paging transmitter), is far more than 60 dB above a distant gauge. The stick's gain must then be turned down and the weak stations are lost | follows from the two rows above | computed |
| The trade's remedy | For a repeater with two antennas: "Recommended vertical antenna separate is 6m. Alternatively, a cavity filter can be used on the receiver, recommended to provide 20db of rejection on the transmit frequency" | [ERT-A2 2025](https://elprotech.com/wp-content/uploads/2024/11/EL-ERT-A2_Manual_Sept25.pdf) | fetched |
| A step up | Airspy Mini: 12-bit, "10.4 ENOB, 70 dB SNR, 95 dB SFDR", 0.5 ppm clock, IIP3 35 dBm, Linux and ARM supported. It needs a different driver from `rtl_sdr`, so the agent would need work | <https://airspy.com/airspy-mini/> (maker's page) | fetched |
| Heat | "R820T/2 RTL-SDR dongles tend to lose PLL lock in L-band at around 1.5 GHz and above… due to the high heat": not a VHF problem | [RTL-SDR Blog V3 datasheet](https://www.rtl-sdr.com/wp-content/uploads/2018/02/RTL-SDR-Blog-V3-Datasheet.pdf) | fetched |
| Field evidence it works | The Brisbane base reads a live ALERT2 link with RTL-SDR sticks: the parity of every block checks, about 100,000 receptions a day | repo: `/home/user/RPi_ALERT/agent/lib/devices/alert2-fec.js` lines 15–17; `/home/user/MegaNet/roadmap/roadmap-113.md` line 1521 | repo |
| An FM detector's cliff | ALERT2 rides on FM, so below about 10 dB over the noise the detector fails quickly; the error correction was sized to match legacy ALERT's reach ("bit and packet error rate performance equal to or better than legacy 300 bps ALERT", §1). 37 % of legacy bursts on one Brisbane channel arrive only 8–9 dB over the noise | [AirLink 1.1](https://www.bluewaterdesign.us/docs/Airlink_Ver_1.1_Final.pdf); repo: U2 §1.4 | fetched; repo |

**Verdict.** Adequate for a receive-only base that is not next to a transmitter, provided the stick has a 1 ppm crystal (RTL-SDR Blog V3 or V4 class) and a VHF band-pass filter ahead of it. Not adequate, without a cavity filter or a 12-bit radio, on a mast shared with a transmitter in the same band. ALERT2 does not change this: it is the same band, the same channel width and the same signal levels as legacy ALERT. Modes 1 and 2 give up 1.5–2.5 dB, so links run in those modes are by design the strong ones.

### 3.6 Existing open-source ALERT2 decoders

| Project | What it is | Source | Label |
|---|---|---|---|
| `K6NLC/alert2_decoder` | "Python based software decoder for NHWC's ALERT2 protocol." Built to AirLink 1.2, MANT 1.2 and Application 1.3. Mode 0 "validated on two sites' worth of field traffic"; mode 2 validated on a recording from another network; mode 1 by round trip only. Input from `rtl_fm`, a sound card, WAV or raw IQ; resamples to 43.2 kHz. Needs numpy, scipy and libfec. **GPL-3.0.** Does **not** read the ALERT concentration protocol or encrypted messages. Three commits: 26 October to 9 November 2026 | <https://github.com/K6NLC/alert2_decoder>, <https://github.com/K6NLC/alert2_decoder/commits/main/> | fetched (through the fetch tool's summary) |
| RPi ALERT's own | `alert2-air.js` and `alert2-fec.js`: JavaScript, no dependencies, MIT, AirLink mode 0, concentration and sensor reports, no encryption | repo: `/home/user/RPi_ALERT/agent/lib/devices/`, `/home/user/RPi_ALERT/LICENSE` | repo |
| The 2008 reference design | "All of the design and software work products are in the public domain and the prototypes are available from the AUG"; the report was "available to NHWC members at the NHWC website" | [Telos 2011](https://www.bluewaterdesign.us/docs/ALERT2_Description_102511.pdf) | fetched; the files themselves were not found |
| The error-correction library the specification points to | "An Open Source implementation of the R-S encoder and decoder is available from Phil Karn, at http://www.ka9q.net/code/fec/" | [AirLink 1.2](https://www.bluewaterdesign.us/docs/ALERT2_Airlink_Specification_Version_1.2.pdf) footnote 3 | fetched (the footnote; the library page was not opened) |
| GNU Radio blocks for ALERT2 | None found in three web searches and five GitHub searches (by name, and for the frame sync word) | — | searched, not found |

The K6NLC project is useful as a second opinion on recordings, and as a description of modes 1 and 2 already proven against real traffic. Its GPL-3.0 code cannot be copied into the MIT-licensed agent; the specification itself is enough to write the modes from.

---

## 4. Does a receive-only base need GPS-disciplined timing?

**No.** GPS is what lets a transmitter stay inside its slot. A receiver finds each frame by its sync pattern and takes the bit clock from the frame itself.

| Evidence | Words | Source | Label |
|---|---|---|---|
| Maker of the reference receivers | "In TDMA mode, an ALERT2 transmitter requires a 3D GPS fix in order to acquire accurate time. For a receive-only site, it is optional, and the A2X will also support time synchronization using the NTP protocol via the Ethernet port" | [A2X manual](https://www.bluewaterdesign.us/docs/A2X_User_Manual.pdf), *Clock Source Selection: GPS or NTP* | fetched |
| Campbell's base | "GPS is required for the AL205R. NTP can be used instead of GPS in a AL205B, but time will be less accurate due to NTP jitter"; "will not transmit using TDMA with an NTP time source" | [AL205R/B manual](https://s.campbellsci.com/documents/us/manuals/al205r-b.pdf) | fetched |
| ELPRO | "All models with primary VHF/UHF radio… require GPS option for ALERT2 TDMA operation"; for a base, "Base Stations do not need a TX frequency" | [ERT-A2 2025](https://elprotech.com/wp-content/uploads/2024/11/EL-ERT-A2_Manual_Sept25.pdf) | fetched |
| The specification | Receivers "continuously search for the bit synchronization pattern in the audio"; the bit clock is "recovered from the bit stream itself" | §5 and §2.2.5 of [AirLink 1.2](https://www.bluewaterdesign.us/docs/ALERT2_Airlink_Specification_Version_1.2.pdf) | fetched |
| What the base's clock is used for | An ALERT2 time stamp is 16 bits of seconds that "rolls over at noon and midnight, UTC. On decoding, the timestamp is integrated with the full date/time of arrival". Messages with no stamp are timed by arrival | [Telos 2011](https://www.bluewaterdesign.us/docs/ALERT2_Description_102511.pdf) | fetched |
| Encryption | The nonce is a message counter, not the time | [MANT 1.2](https://www.bluewaterdesign.us/docs/ALERT2_MANT_Specification_Version_1.2.pdf) §3.5 | fetched |

So the base needs the right time to within a second or so for stamping arrivals, and to within hours to place a 12-hour time stamp. Ordinary network time does both. A GPS receiver with a pulse output would only be worth having if the base were to audit transmitters' slot timing to a few milliseconds, which nothing asks of it today. The stick's frequency error does not need GPS either: 1 ppm is 150 Hz.

One consequence for approvals: a base inside a government network that cannot reach public time servers must be given the organisation's own time server, or it will misplace time stamps after a long outage.

---

## 5. Adoption

### 5.1 United States

| Fact | Words or figure | Source | Label |
|---|---|---|---|
| First release | "The ALERT2 protocol was released by the TWG in September 2010" | [AL205R/B manual](https://s.campbellsci.com/documents/us/manuals/al205r-b.pdf) | fetched |
| First places | Denver, Colorado; Overland Park, Kansas; Kansas City, Missouri (NHWC press release, 2010) | search result for `hydrologicwarning.org` | snippet |
| 2015 | "being rolled out by about a quarter of the ALERT user agencies in the USA"; "nine ALERT2 systems in partial or full operation in nine different states"; California "funding the planning and implementation of ALERT2 upgrades to more than 25 networks comprising upwards of 4,000 ALERT gauge sites" | [OneRain 2015](https://onerain.com/wp-content/uploads/2020/10/alert2-transmission-protocol-overview-logan-gayl-thompson-v2.0.pdf) | fetched |
| Harris County, Texas (Houston) | 139 stations in the case study, 150 upgraded; three repeaters, two base stations; received reports rose from about 65 % to 99.6–99.9 % in storms | <https://s.campbellsci.com/documents/us/case-studies/texas-transition-alert2.pdf> | fetched |
| Harris County's traffic | "one receiver (Transtar) collected 12.2 million MANT PDUs from 155 sites" in nine months; "81% of MANT PDUs sent were 22 bytes or less, and 99%… were 42 bytes or less"; "The present system uses 500ms slots for the majority of these sites" | [TWG high-rate proposal](https://raw.githubusercontent.com/ALERT2TWG/documentation/master/proposals/high-data-rate.md) | fetched |
| That as a rate | About 44,500 messages a day, **31 a minute**, at one receiver; about 290 a site a day | 12.2 million ÷ about 274 days ÷ 155 | computed |
| Harris County in storms | 15,000 reports in a 48-hour event (about 5 a minute); about 13,500 transmissions over 6–11 March 2016, success "99.8%… During the worst hour of the storm, success fell to 98%"; status "six times a day" | the case study above | fetched; rates computed |
| Charlotte, North Carolina | 72 rain gauges; a 500 ms window each every 5 minutes; "about half of the radio sites have been converted" by August 2018 | <https://nc.water.usgs.gov/charlotte/data/AL2Conversion-36x48.pdf> | fetched |
| Sacramento; San Luis Obispo; San Joaquin County; Jefferson County, Texas | Named as converted or converting | <https://www.campbellsci.com/blog/alert2-wave-future-flood-alerts> (maker's blog, 8 August 2025); search results | fetched (blog); snippet (the rest) |
| Makers | AFWS Distinctive Designs, Blue Water Design, Campbell Scientific, DEC Data Systems, High Sierra Electronics, HydroLynx, J.E. Fuller, OneRain, Telos Services, TriLynx, Water and Earth Technologies (2015 list); ELPRO since | [OneRain 2015](https://onerain.com/wp-content/uploads/2020/10/alert2-transmission-protocol-overview-logan-gayl-thompson-v2.0.pdf); [ERT-A2 2025](https://elprotech.com/wp-content/uploads/2024/11/EL-ERT-A2_Manual_Sept25.pdf) | fetched |
| A current national count | Not found | — | searched, not found |

### 5.2 Station counts and report rates for one network

| Network | Sites | Channel plan | Traffic | Label |
|---|---:|---|---|---|
| Harris County | 155 | Mostly 500 ms slots; three repeaters | 31 messages a minute on average at one receiver; 5 a minute in a minor storm | fetched; computed |
| Charlotte | 72 rain gauges and the stream gauges | One 500 ms slot a site in a 5-minute TDMA frame; the whole network in 2.5 minutes | At most one frame a site every 5 minutes | fetched |
| Seqwater link heard in Brisbane, 151.5375 MHz | 27 sources | not known | "~100,000 receptions a day"; about 20 frames a minute inferred by U2; about 1,500 legacy addresses a day arrive concentrated | repo: `/home/user/MegaNet/roadmap/roadmap-113.md` lines 1503, 1521; U2 §4.3 |
| Second ALERT2 network in Brisbane, 151.500 MHz | sources 62720–62732 and 10315 | not known | not stated | repo: the same file, line 1521 |

A "reception" or "message" here is one MANT message, not one transmission; a transmission carries several. Real channels run at about 5–30 transmissions a minute against a ceiling of 120 or 240.

### 5.3 Australia: what is publicly known

| Fact | Words | Source | Label |
|---|---|---|---|
| The Bureau helped write it | "The Bureau of Meteorology has been represented on the TWG since early on to help ensure international and Australian requirements are supported"; co-author Robert Thompson, Bureau of Meteorology | [OneRain 2015](https://onerain.com/wp-content/uploads/2020/10/alert2-transmission-protocol-overview-logan-gayl-thompson-v2.0.pdf) | fetched |
| Size of the legacy fleet, 2015 | "in Australia ALERT is deployed at over 2,600 sites, 5900 sensors… across every State and Territory" | the same | fetched |
| Status, 2015 | "Australian agencies have begun evaluating ALERT2 upgrade options" | the same | fetched |
| Queensland, 2015 | 2,924 flood-warning gauges, of which "1,038 ALERT stations" (821 owned by councils); 691 using VHF radio. Recommendation 12: "That BoM advise the cross-agency forum with regard to the impacts of delays for the implementation for ALERT2. (BoM's ALERT and ENVIROMON systems currently limit the number of new stations…)" | KBR for the Queensland Government, 16 December 2015: <https://www.disaster.qld.gov.au/__data/assets/pdf_file/0029/338195/Performance-Review-of-the-Flood-Warning-Gauge-Network-in-Queensland.pdf> | fetched |
| The same review, on readiness | "ALERT2 system protocols and requirements are still being developed and not yet ready for full adaptation in Australia, until BoM releases details of the protocols, specifications and standards cannot be prepared" | Appendix C: <https://qld.gov.au/__data/assets/pdf_file/0024/337308/Appendix-C-TOR-checklist.pdf> | fetched |
| A maker, 2018 | "a long term commitment… including the transition to the ALERT2 protocol in Australia"; ALERT2 base and repeaters "soon"; "uptake of these is likely to be slow at first" | Campbell Scientific Australia, 26 June 2018: <https://s.campbellsci.com/documents/au/press-releases/Flood%20Warning%20Statement_26-6-18.pdf> | fetched |
| An Australian-made ALERT2 unit exists | ELPRO's ERT-A2: field station, repeater or base; legacy ALERT in, ALERT2 concentration out; manuals of 2021 and September 2025 | [ERT-A2 2021](https://elprotech.com/wp-content/uploads/2021/07/UserManual_ERT-A2_v1.1-2.pdf), [ERT-A2 2025](https://elprotech.com/wp-content/uploads/2024/11/EL-ERT-A2_Manual_Sept25.pdf) | fetched |
| ALERT2 is on the air in south-east Queensland now | A Seqwater ALERT2 link on 151.5375 MHz and a second ALERT2 network on 151.500 MHz, heard by the first base station | repo: `/home/user/MegaNet/roadmap/roadmap-113.md` line 1521 | repo |
| The Bureau's network programme | "$236 million over 10 years from 2023–24"; about 1,000 Queensland sites, about 750 in the core programme "by 2028/29"; national upgrades "by 2030". **Neither page names a radio protocol**: the words are "associated communications equipment" | <https://www.qra.qld.gov.au/fwin/bureau-national-disaster-warning-network>; <https://www.qld.gov.au/emergency/dealing-disasters/disaster-types/flood/for-councils-and-flood-practitioners/flood-warning-infrastructure-resources/bureau-of-meteorologys-flood-warning-infrastructure-network-fwin-program> | fetched |
| The same programme, the Bureau's own page | "around 1,600 additional flood warning sites"; acquisition "scheduled to be completed by June 2033"; Queensland "around 1,000 gauges will be upgraded by June 2029" | search result for `bom.gov.au/resources/observation-network/flood-warning-network-upgrades` | snippet |
| A user's claim | "Now that the BoM is going over to ALERT2 (4800 baud, GNSS-sync'd TDMA), has anyone got decoding for that working?" (a forum post, 26 August 2025) | <https://forum.core-electronics.com.au/t/rtl-sdr-decoding-alert/21360> | fetched; one person's unsupported statement |
| A maker's claim | "In Australia, the ALERT2 protocol has been a cornerstone in Brisbane's efforts to improve disaster resilience", then: "While not naming specific protocols, the report's recommendations reflect many of the capabilities ALERT2 already offers" | <https://www.campbellsci.com/blog/alert2-wave-future-flood-alerts> | fetched; marketing |
| A curiosity | The last page of the AirLink 1.2 PDF carries the Bureau's own back-page text ("Through the Water Act 2007, the Australian Government has given the Bureau of Meteorology responsibility… www.bom.gov.au/water"). The file passed through a Bureau template; it says nothing about a plan | [AirLink 1.2](https://www.bluewaterdesign.us/docs/ALERT2_Airlink_Specification_Version_1.2.pdf), final page | fetched |
| Flood-Net's own draft plan | Backbone first, in concentration mode: repeaters fitted with an ERT-A2 take legacy ALERT in and send ALERT2 on, field stations stay legacy; about 40 months as drafted for Queensland. The owner's note: "ALERT2 Transition is probably a fair way off yet" | repo: `/home/user/MegaNet/roadmap/roadmap-113.md` lines 1608–1612, 1832–1842 | repo (a draft by the owner, not a Bureau plan) |

**Reading of this.** No public document gives a date, a channel plan, an error-correction mode or an encryption policy for an Australian ALERT2 network. What can be seen is that the equipment exists and is made in Australia, that at least two ALERT2 networks already transmit in Brisbane, and that the likely path is the one the protocol was designed for: ALERT2 between repeaters and bases first, with legacy gauges concentrated, for years. For a base that means **both protocols at once on every site for the life of this hardware**.

---

## 6. Conclusion: how much load, and how much to buy

### 6.1 The terms

All in Pi 4 cores, for the software as shipped (Lean decoder, every sample filtered, every burst tried as legacy first). The standing figures are U2's; the worst-case burst figure is U2's and was re-measured here.

| Term | Pi 4 cores for one channel | Standing |
|---|---:|---|
| Standing filter, 240 kHz window, on a loaded computer | 0.10 | repo (U2 §5) |
| Standing filter, 960 kHz window | 0.19–0.35 | repo (U2 §5; the two Pi 4 observations disagree) |
| Standing filter, 1.44 MHz window | 0.50 | repo (U2 §5) |
| Bursts, legacy at 8 / 20 a minute | 0.05 / 0.12 | repo (U2 §5) |
| Bursts, an ALERT2 link as heard today (about 20 frames a minute) | 0.20 | repo (U2 §5) |
| Bursts, an ALERT2 channel with half its half-second slots used (60 a minute) | 0.6 | half of the next row |
| Bursts, the worst case: every half-second slot used, or a legacy channel saturated with separate bursts | 1.2 (1.05–1.32) | measured here (0.263 of a core) × 4 to 5 |
| The same with the Light decoder | 0.9 (0.79–0.99) | measured here (0.198) × 4 to 5; Light is not a default and is unproven in the field (U2) |
| The same if the legacy try were skipped on ALERT2 channels (planned, not shipped) | about 0.4 | repo (U2 §5) |

ALERT2 does not change the standing filter at all; that part depends only on the width of the window.

### 6.2 Three levels of traffic

- **Today**: legacy channels at 20 bursts a minute, one channel in four an ALERT2 link at about 20 frames a minute.
- **Storm after a transition** (a judgement, not a forecast): half the channels ALERT2 with half their half-second slots used, the rest legacy at 20 a minute.
- **Worst case**: every channel at once at the most the protocol allows.

| Site | Standing filters | Today | Storm after a transition | Worst case | Storm ÷ today | Worst ÷ today |
|---|---:|---:|---:|---:|---:|---:|
| 4 channels, one stick, 1.44 MHz window | 2.0 | 2.6 | 3.4 | 6.8 | 1.3 | 2.7 |
| 8 channels, two sticks, 960 kHz windows | 1.5–2.8 | 2.6–3.9 | 4.4–5.7 | 11.1–12.4 | 1.5–1.7 | 3.2–4.3 |
| 16 channels, four sticks, 960 kHz windows | 3.0–5.6 | 5.3–7.8 | 8.8–11.4 | 22–25 | 1.5–1.7 | 3.2–4.2 |

All computed from the table in 6.1. Working for the first row: today 2.0 + 3 × 0.12 + 0.20; storm 2.0 + 2 × 0.6 + 2 × 0.12; worst 2.0 + 4 × 1.2.

**So a plausible multiple of today's decoding load is about 1.3 to 1.7 at a storm peak after a transition, and 2.7 to 4.3 at the protocol's worst case on every channel together.** The worst case on every channel together is unlikely: a plan keeps slots spare, a slot is used only when its station has something to send, and Charlotte's whole network occupies half of its five-minute cycle by design. It is the bound, not the expectation.

### 6.3 What to buy

Two limits, both needed (U2's rule, which this work supports):

1. **Each core at least 2.5 times a Pi 4 core.** One channel is one thread. At the worst case it needs 1.2–1.8 Pi 4 cores, so a core of 2.5 runs it at 50–70 %. A core equal to a Pi 4's falls behind and drops samples; a core of half a Pi 4's (Cortex-A53 class, as on the Verdin AM62) cannot do it at all.
2. **The whole computer**: the storm case at no more than half of it, and the worst case at no more than about 85 %.

| Site | Storm case ÷ 0.5 | Worst case ÷ 0.85 | Prudent to buy | As Pi 4s | Shape |
|---|---:|---:|---:|---:|---|
| 4 channels | 6.9 | 8.0 | **about 10 Pi 4 cores** | **2.5** | 4 cores, each ≥ 2.5 × a Pi 4 core |
| 8 channels | 8.8–11.4 | 13.1–14.6 | **about 16 Pi 4 cores** | **4** | 6 to 8 cores, each ≥ 2.5 ×, so that eight worst-case threads do not have to share four cores |
| 16 channels | 17.6–22.8 | 26–29 | **about 28–32 Pi 4 cores** | **7–8** | 8 or more cores, each ≥ 3.5 ×; or two computers of the 8-channel size, which also removes a single point of failure |

Memory does not change with ALERT2: about 43 MB a channel plus up to 58 MB a channel of backlog in a 1.44 MHz window (repo: U2 §1.5, §5). 2 GB is enough for 8 channels without a screen, 4 GB with the dashboard, 4–8 GB for 16.

What would lower these figures, none of it shipped:

| Change | Effect on a worst-case ALERT2 channel | Standing |
|---|---|---|
| Skip the legacy try on a channel known to carry only ALERT2 | 1.2 → about 0.4 Pi 4 core | planned (repo: `/home/user/RPi_ALERT/docs/roadmap.md` lines 67–71) |
| One window per run of transmissions rather than per burst | Rows b–d in 3.4 already show 0.6–0.9 instead of 1.05–1.32, once the 3 s cut and the 8-frame cap are lifted | a finding of this work |
| One shared filter bank per stick | Cuts the standing 2.0–5.6 Pi 4 cores, the larger part of today's load | planned (repo: the same file, lines 99–107) |
| Modes 1 and 2 | Adds about a fifth to an ALERT2 decode; needed to hear such networks at all | not started |

With the first three, 8 channels at the worst case would fit a 4-core computer of 2.5 times a Pi 4 core. That is a reason to schedule the software, not a reason to buy less now.

### 6.4 What this says about earlier proposals

| Proposal | What follows | Basis |
|---|---|---|
| Verdin AM62 Quad (4 × Cortex-A53, rated in the repos at half a Pi 4 core a core) | One worst-case ALERT2 channel needs 2.4–3.6 of its cores on one thread. It fits only if traffic stays near today's and the two unproven decoder modes are used. Not headroom for ALERT2 | U2 §6; section 3.4 here |
| A Pi 4-class core (Luna SL1680 as the repos rate it, about 1.1) | Fine today; one full ALERT2 channel overruns a core | U2 §6; section 3.4 here |
| "ALERT2 means a higher bit rate, so more CPU" | Not so. The FEC is 3 % of a decode. More CPU comes from more transmissions a minute | section 3.2 |
| The TDMA planner's half-second floor and 120-a-minute ceiling | Out of date since January 2025: 250 ms and 240 a minute | section 1.4 |

---

## 7. Could not confirm

- **`hydrologicwarning.org` could not be read automatically.** The site's front page returned 403 and a guessed ALERT2 page 404. I did not try again. The NHWC's own document portal, its FAQ and its 2010 press release were therefore not read; the specifications were read from Blue Water Design's site (the firm that wrote much of them) and from Campbell Scientific's. I did not check that those PDFs are byte-for-byte the NHWC's.
- **`bom.gov.au` could not be read automatically.** The Bureau's *Flood Warning Infrastructure Standard* PDF returned 403 to a plain download. I did not try the Bureau's other pages. Whether that standard says anything about ALERT2 is not known; the Bureau's programme figures above marked *snippet* are search-result text.
- **`osmocom.org` (the rtl-sdr wiki) is behind a bot wall** and was not read. **`core-electronics.com.au`** returned 403 on its RTL-SDR Blog V4 page; the only Australian price I have is search-result text (below).
- **No Australian timetable, channel plan, slot length, error-correction mode or encryption policy** for any Bureau, council or water-authority ALERT2 network was found in anything public. The forum post saying the Bureau "is going over to ALERT2" is one person's statement.
- **Whether the ELPRO ERT-A2 sends or reads modes 1 and 2, uses 250 ms slots, or encrypts.** Its two manuals do not mention any of them. This is the question that decides whether Australian networks will ever use the new modes; only ELPRO can answer it.
- **Whether any network encrypts**, in Australia or elsewhere. The feature is in MANT 1.2 and in Campbell's and Blue Water Design's products.
- **The FM deviation real transmitters use.** AirLink does not set it. The agent's test transmitter assumes 2,400 Hz (repo: `/home/user/RPi_ALERT/agent/test/helpers/alert2-tx.js`).
- **Two figures in AirLink 1.2's own capacity table.** By the block lengths in the same document, mode 0 in a 500 ms slot with the stated timing (35 ms tone, 1 ms tail, 23 ms pad) holds 75 bytes if the 16.7 ms of sync is counted, not the 77 stated, and a 2 s slot 374, not 377. The table seems to count 10 ms of sync. I used the table's figures as stated and treat them as approximate.
- **No Pi 4 was measured.** Every Pi 4 core figure is this machine's result times 4 to 5, U2's conversion, which U2 itself rates as thin (3.8 to 5.9 depending on the measure). One run of U2's benchmark and of the two scripts here on an idle Pi 4 would replace the conversion.
- **Synthesised signal only** for the worst-case rows in 3.4: clean frames at 22 dB from the agent's own test transmitter, one carrier offset pattern, no fading, no collisions, no adjacent-channel signals. Whether real back-to-back transmissions merge in the squelch as the synthesised ones did depends on real key-up and key-down times and has not been seen off the air.
- **The k = 9 Viterbi timing** is for a decoder I wrote in the same style as the agent's k = 7 one, fed random soft values. It was not checked against a mode 1 or mode 2 frame, because nothing here can make one. It measures trellis work, not correctness.
- **The K6NLC decoder's code was not read or run.** What is said of it comes from the fetch tool's summary of its README and commit list.
- **A current count of ALERT2 networks or stations** in the United States or anywhere else. The latest numbers found are from 2015.
- **How a legacy channel behaves at saturation in the agent.** The worst-case legacy figure in 6.1 is inferred from the ALERT2 row (the same per-burst windows, a legacy try of 84–88 ms and a failed ALERT2 try of 41 ms); it was not run.
- **RTL-SDR dynamic range at a real shared site.** The 60–70 dB figure is arithmetic from an ideal 8-bit converter. Tuner overload, images and the stick's own spurs can make it worse; only a measurement at the site settles it.
- **The pure-ALOHA figures** in 2.2 use the textbook formula from memory and assume equal-length reports arriving at random; they are an illustration, not a measurement of any network.
- **Prices.** Not pursued, as the owner allowed. What turned up: RTL-SDR Blog V4 with dipole kit at Core Electronics "$161.19 AUD, inc GST" and at Little Bird Electronics "$159.65… Out of stock" (both *snippet*, read 2026-11-11, pages not opened; Core Electronics refused automated reading: <https://core-electronics.com.au/rtl-sdr-blog-v4-usb-dongle-dipole-antenna-kit-sparkfun.html>, <https://littlebirdelectronics.com.au/products/rtl-sdr-blog-v4-usb-dongle-with-dipole-antenna-kit-sparkfun-electronics-wrl-27543>); a search result also said the V4's tuner chip is out of production, so the V4 is a "limited edition" (*snippet*). Airspy lists no Australian distributor on <https://airspy.com/purchase/> (*fetched*); its nearest are Itead (ships from Shenzhen) and the RTL-SDR Blog store.

## 8. Suppliers and pages to follow up

| What | Who | Page |
|---|---|---|
| The current specifications (AirLink 1.2, MANT 1.2, Application 1.3, IND API 2.1) | Blue Water Design, Boulder, Colorado | <https://www.bluewaterdesign.us/alert2-expertise/> |
| ALERT2 base receiver, Australian maker; the question about modes 1–2, 250 ms slots and encryption | ELPRO Technologies (the manual's cover says "An envirada group company") | <https://elprotech.com/wp-content/uploads/2024/11/EL-ERT-A2_Manual_Sept25.pdf> |
| ALERT2 base (AL205B) and transmitter (AL200X); Australian office in Garbutt, Queensland | Campbell Scientific Australia | <https://www.campbellsci.com.au/al200x>, <https://campbellsci.com/al205b> |
| ALERT2 receiver and repeater (A2X): modes 0–2, encryption, NTP for receive-only | Blue Water Design | <https://www.bluewaterdesign.us/products/a2x/> |
| Independent open-source decoder for cross-checking recordings | K6NLC | <https://github.com/K6NLC/alert2_decoder> |
| The TWG's working papers (high data rate, encryption, ALERT2 over IP, time-series format) | ALERT2 Technical Working Group | <https://github.com/ALERT2TWG/documentation> |
| RTL-SDR Blog V4 (1 ppm crystal) in Australia | Core Electronics; Little Bird Electronics | the two pages in section 7 |
| 12-bit radio for sites beside a transmitter | Airspy (no Australian distributor listed) | <https://airspy.com/purchase/> |
