# R8 - CPU performance relative to a Raspberry Pi 4 (2026-11-11)

Method. Primary yardstick = 7-zip MIPS from Thomas Kaiser's sbc-bench results list (same tool, many boards): https://github.com/ThomasKaiser/sbc-bench/blob/master/Results.md (fetched). Pi 4 baseline row: BCM2711 1500 MHz, Pi OS Buster 5.10: 5750 multi / 1661 single (a 1800 MHz row: 6550 / 1897). Ratio = board / Pi 4 @1.5 GHz. 7-zip is integer and memory-light; it is a proxy, NOT a V8/Node test. No Node/V8 benchmark covering these chips could be found (openbenchmarking node-web-tooling returned 403; no A53/A73 entries known). Geekbench 6 browser and cpu-monkey pages returned 403 or empty.

"Fetched" = page read; "snippet" = search text only; "inferred" = my arithmetic from fetched figures; "memory" = unchecked.

## Table (ratio to Pi 4 @1.5 GHz; single = one core vs one Pi 4 core; all = all cores vs whole Pi 4)

| Processor (board) | Cores/clock | Single | All-core | Source for figures | Basis | PLAN x Pi4 (low-high) |
|---|---|---|---|---|---|---|
| BCM2837B0 Pi 3B+ | 4xA53 1.4 | 0.55-0.65 | 0.56-0.64 | sbc-bench Results.md: 3240-3670 / 914-1076 | fetched | 0.5 (0.45-0.6) |
| RP3A0 Pi Zero 2 W | 4xA53 1.0 (1.2 OC row) | 0.50 | 0.53 (1.0 GHz: 3030/838) | sbc-bench Results.md | fetched | 0.4 (0.3-0.5) sustained; 512 MB RAM, thermal limits |
| BCM2711 Pi 4 | 4xA72 1.5 | 1.0 | 1.0 | sbc-bench 5750/1661 | fetched | 1.0 |
| BCM2711 Pi 4 @1.8 | 4xA72 1.8 | 1.14 | 1.14 | sbc-bench 6550/1897 | fetched | 1.15 |
| BCM2712 Pi 5 | 4xA76 2.4 | 2.0 (7zip), 2.25 (GB6) | 2.06 (7zip), 2.2 (GB6) | sbc-bench 11830/3305; GB6.2 764/1604 vs 340/723 https://www.raspberrypi.com/news/benchmarking-raspberry-pi-5/ (snippet) | fetched/snippet | 2.2 (2.0-3.0; JS browser tests show 2.3-3x, secondary source) |
| TI AM625/AM62x | 4xA53 up to 1.4 | ~0.55-0.63 | ~0.55-0.62 | No direct AM62 sbc-bench row. Proxy: BeagleY-AI AM67A (4xA53 @1247 MHz) 3180/932 https://www.cnx-software.com/2024/10/13/beagley-ai-review-sbc-debian-12-tensorflow-lite-ai-demos/ - author says "about equivalent to a Raspberry Pi 3B+"; scaled to 1.4 GHz by me | inferred | 0.5 (0.45-0.6) |
| TI AM62P | 4xA53 1.4 | as AM62 | as AM62 | memory (same cores) | memory | 0.5 |
| TI AM67A (BeagleY-AI) | 4xA53 1.25 | 0.56 | 0.55 | CNX review above | fetched | 0.5 |
| TDA4VM / AM69 | 2xA72 2.0 / 8xA72 2.0 | ~1.3 | 0.65 / ~2.6 | scaled from Pi 4 A72 by clock | inferred | 0.65 / 2.5 |
| i.MX 8M Mini | 4xA53 1.6-1.8 | ~0.7 | ~0.7 | scaled from i.MX8MQ row | inferred | 0.7 (0.6-0.8) |
| i.MX 8M Plus | 4xA53 1.8 (EVK) | 0.81 | 0.87 | sbc-bench: 4990/1348 | fetched | 0.75 (0.65-0.85); industrial grade is 1.6 GHz (memory) |
| i.MX 8M Quad (HummingBoard Pulse) | 4xA53 1.5 | 0.72 | 0.75 | sbc-bench 4330/1201 | fetched | 0.7 |
| i.MX 93 | 2xA55 1.7 | ~0.75 | ~0.4 | scaled from RK3568 A55 | inferred, low | 0.35 (0.3-0.45); only 2 cores |
| i.MX 95 | 6xA55 up to 1.8 | ~0.8 | ~1.3 | scaled from A55 | inferred, low | 1.2 (1.0-1.5) |
| Synaptics SL1680 | 4xA73 2.1 | ~1.25 | ~1.2 | No SL1680 benchmark found. Anchored on Amlogic A311D (4xA73@2.4 + 2xA53): 9650/2376 | inferred | 1.2 (1.0-1.4) |
| Rockchip RK3568 | 4xA55 ~2.0 | 0.87-0.94 | 0.88-0.94 | sbc-bench: 5030-5430 / 1424-1567 | fetched | 0.9 (0.8-1.0) |
| Rockchip RK3399 | 2xA72+4xA53 ~1.8-2.0 | 1.0-1.15 | 1.1-1.2 | sbc-bench 6230-7000 / 1336-1906 | fetched | 1.1 (1.0-1.25) |
| Rockchip RK3588 | 4xA76+4xA55 | 1.8-1.9 | 2.7-2.9 | sbc-bench 15630-16780 / 2689-3174 | fetched | 2.5 (2.2-3.0); pin threads, little cores weaker |
| Allwinner A64 | 4xA53 1.05 | 0.47 | 0.48 | sbc-bench 2785/780 | fetched | 0.4 |
| Amlogic A311D | 4xA73+2xA53 | 1.43 | 1.68 | sbc-bench 9650/2376 | fetched | 1.6 |
| MediaTek Genio 1200 | 4xA78+4xA55 | 2.0 | 3.15 | sbc-bench 18130/3298 | fetched | 3.0 (2.5-3.3) |
| Genio 700 | 2xA78+6xA55 | ~1.9 | ~2.5 | memory/inferred | low | 2.3 |
| Renesas RZ/G2L | 2xA55 1.2 | ~0.55 | ~0.3 | inferred | low | 0.3 |
| ST STM32MP25 | 2xA35 1.5 | ~0.5 | ~0.25 | inferred | low | 0.25 |
| Intel N100 | 4 E-core 3.4 | 2.35 (7zip), ~3.5 (GB6) | 2.45 (7zip), ~4.5 (GB6) | sbc-bench 14090/3910 (but a Radxa X4 row shows 8010/3580, power-limited); CNX Mini Air12 GB6 1213/3272 vs Pi 5 789/1523 https://www.cnx-software.com/2024/04/29/raspberry-pi-5-intel-n100-mini-pc-comparison-features-benchmarks-price/ ; GB6 Pi4 via Pi blog | fetched; Pi4 GB6 ratio inferred | 3.0 (2.3-4.5) |
| Intel N150 | 4 E-core 3.6 | ~1.0x N100 | ~1.0-1.1x N100 | Jeff Geerling: N150 1.5-2x Pi 5 https://jeffgeerling.com/blog/2025/intel-n100-better-value-raspberry-pi ; GB6 N150 1294/3169 vs Pi5 904/2164 (snippet via computingforgeeks) | fetched/snippet | 3.5 (2.5-4.5) |
| Intel N97 / N200 | 4 E-core, lower clock | ~0.9x N100 | ~0.9x N100 | memory | memory | 2.8 (2.2-3.5) |
| Intel i3-N305 | 8 E-core 3.8 | 2.65 | 3.5 | sbc-bench 20000/4398 | fetched | 3.5 (3.0-4.5) |
| Intel N355 | 8 E-core | ~N305 | ~N305 | memory | memory | 3.7 |
| Celeron N5105 | 4xTremont 2.9 | 1.84 | 1.99 | sbc-bench 11450/3059; GB6 multi ~1438-1489 (snippet) vs Pi 4 723 -> 2.0 | fetched | 1.8 (1.5-2.1) |
| Celeron J4125 | 4xGoldmont+ 2.7 | 1.43 | 1.33 | sbc-bench 7620/2367; GB6 411/1276 (cpu-monkey snippet) | fetched/snippet | 1.3 (1.1-1.6) |
| Atom x6425E (Elkhart Lake) | 4xTremont 3.0 | ~1.5 (GB6 539 vs 340) | ~2.0 (GB6 1434 vs 723) | cpu-monkey snippet via search | snippet | 1.8 (1.5-2.1) |
| Celeron J6412 | 4xTremont 2.6 | ~N5105 | ~N5105 | memory | memory | 1.7 |
| Atom x6413E / x7211E / x7425E / x7835RE | Tremont/Gracemont embedded | not found | not found | no figures found | - | x6413E 1.2-1.6; x7425E ~N100 (3.0); x7835RE 8 cores ~3.5 (all memory-grade guesses) |
| Core i5-8500T (6c Coffee Lake) | 6c 3.5 boost | not confirmed | not confirmed | Geekbench page 403; snippet garbled | - | ~4-5 (memory-grade guess; verify) |
| Core i5-10500T | 6c | not confirmed | not confirmed | - | - | ~4-5 (guess) |

## Which of the repo's assumptions hold
- Pi 3B+ = 0.5: close. 7-zip says 0.56-0.64; A53 is in-order with weak FP, so for float DSP in V8 0.45-0.55 is plausible. KEEP 0.5.
- Pi 5 = 2: roughly right (2.0-2.25 on 7-zip/Geekbench 6). JS browser benchmarks (secondary sources) suggest 2.3-3x. 2 is conservative. Use 2.2.
- Pi Zero 2 W = 0.25: WRONG by about 2x on raw numbers (0.50-0.53 at 1.0 GHz; same four A53 cores as a 3B+, lower clock). Sustained with thermal/512 MB limits ~0.4. Use 0.4.
- TI AM62 quad = 0.5: right (same A53 as 3B+, 1.4 GHz max; ~0.5-0.6).
- SL1680 = 1.1 "scaled by clock": probably slightly low. A73 at 2.1 GHz anchored on A311D gives ~1.2 (1.0-1.4). No SL1680 benchmark exists in what I could read; treat 1.1 vs 1.2 as within error. Note it is only ~2x the AM62 and below an RK3568 + a bit, never a "big" step up.
- Intel N150 = 3: reasonable, maybe a little low. 7-zip says ~2.4-2.5, Geekbench 6 ~4.5 multi, Geerling HPL ~2x Pi 5 (=4.4). Use 3.5 (2.5-4.5).

## Notes for planning
- Workload is 4-8 threads. A 2-core part (i.MX 93, RZ/G2L, STM32MP25, TDA4VM) cannot run 4-8 decoder workers without time-slicing; ALL-core ratio is the one that applies, and is poor.
- Pi 4 itself has 4 cores; if 8 channels run today, it is oversubscribed, so the "x Pi 4" figure should be treated against measured Pi 4 CPU load (not measured here - ask owner for `top` during a busy event).
- Geekbench 6 rates N-series ~1.5-2x better relative to Pi than 7-zip does (vector/SIMD heavy, ARM builds older). JS float DSP in V8 (scalar/some SIMD-free) probably sits between the two.
- A53-class parts (AM62, i.MX 8M, Pi 3B+, Zero 2 W): 0.5-0.8 of a Pi 4. If the owner wants "not under-specced vs Pi 4", the AM62 fails at 0.5 for the same 4-8 channel load, unless channel count at a site is 4 and lightly loaded. This is a decision-relevant correction to the earlier Toradex Verdin AM62 proposal.
- Cheapest fully-adequate (>=1.0 Pi 4) off-the-shelf candidates by this data: RK3568 (0.9, borderline), RK3399 (1.1), SL1680 (1.2), A311D (1.6), N5105/J4125 class mini PCs (1.3-1.8), N100/N150 (3+), i5 ex-lease (4+).

## Could not confirm
- Any Node.js/V8 benchmark on A53/A55/A73 or Intel N-series. node-web-tooling at openbenchmarking.org returned 403.
- Geekbench 6 browser pages (403 to automated fetch) and cpu-monkey (403) - figures from these are search snippets only.
- Direct sbc-bench rows for AM62/AM625, AM62P, i.MX 8M Mini, i.MX 93, i.MX 95, SL1680, RZ/G2L, STM32MP25, N150, N97, N200, Atom x6413E/x7xxx, i5-8500T/10500T: not in the Results.md list as fetched (page text may be truncated by the fetch tool, so absence is not proof).
- TI AM62x CoreMark-Pro numbers (SPRAD45B https://www.ti.com/document-viewer/lit/html/SPRAD45) - only seen in search listing. Dhrystone 3 DMIPS/MHz and 14228 DMIPS aggregate at 1.2 GHz seen in snippet.
- Jeff Geerling sbc-reviews raw tables, bret.dk, Phoronix not read in detail.
- Pi 4 vs Pi 5 JetStream +130% and Speedometer 62.5 vs 20.5: secondary compilation (search snippet), not primary.
- Pi 3B+ Geekbench 6: no result found.
