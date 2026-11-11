# R5 - Open-hardware Linux boards (not Raspberry Pi), read 2026-11-11

Labels: fetched = page read; snippet = search-result text only; memory = unchecked.
Prices are as read on the date; per the owner's instruction only one attempt per product was made.

## Headline
1. No board found meets all of: open design files + 2 USB hosts + eMMC + industrial temperature + TPM/secure element + Pi-4-class CPU + Australian stockist. Every open design is weaker than a Pi 4 on CPU except RK3588-class boards, whose design files are only partly open.
2. Best open-hardware starting point for a custom board: Olimex iMX8MP-SOM-4GB-IND (OSHWA BG000136, CERN-OHL-S-2.0, KiCad, Bulgaria) + iMX8MP-SOM-EVB-IND (two USB 3.0 hosts, 2x GbE, M.2, -45..+85 C). Quad A53 @1.6 GHz: roughly 0.5-0.7 of a Pi 4 (memory/estimate, not measured). No onboard eMMC, RTC and TPM not stated. No Australian stockist found.
3. Best buy-in-Australia open board today: BeagleY-AI (OSHWA certified, 4x USB3 host, 4 GB, microSD only, no industrial rating) and BeaglePlay (OSHWA US002174, CC-BY-SA-4.0, but ONE USB host port). Both are quad A53 (about 0.5 Pi 4).
4. 2026 market: DRAM/eMMC shortage. Pine64 said (19 Aug 2026) no more Linux devices planned; BeagleBone AI-64 Texas-Instruments-branded DigiKey listing says "no longer manufactured". Treat all supply as volatile.
5. Rockchip boards (Radxa, FriendlyElec) are strong on CPU but publish schematic PDFs and (Radxa CM5 IO only) OrCAD/PADS/Altium exports, with no stated hardware licence; they are not "open hardware" in the OSHWA sense. Banana Pi / Orange Pi publish PDF schematics only (forum evidence).

## Board table
| Board | SoC (silicon maker) | CPU | RAM / storage | USB host | Ethernet | Power / temp | Open files + licence | Source |
|---|---|---|---|---|---|---|---|---|
| Olimex iMX8MP-SOM-4GB-IND + EVB-IND | NXP i.MX 8M Plus (NXP, Netherlands/US fab) | 4x A53 @1.6 GHz + M7 800 MHz, 2.3 TOPS NPU | 4 GB LPDDR4; SOM has EEPROM, no eMMC; EVB has microSD, eMMC-module connector, M.2 2280 NVMe | 2x USB3 (EVB) | 2x GbE (1 TSN) | EVB 5 V DC jack; EVB -45..+85 C; SOM page says -20..+85 C | KiCad 5.1.12; HW CERN-OHL-S-2.0, SW GPL-3.0+, docs CC-BY-SA-4.0; OSHWA BG000136 (SOM, 3 Jun 2024), BG000137 (EVB); Bulgaria. BOM/gerber presence not confirmed (repo folder not listed) | olimex.com/Products/SOM/NXP-iMX8/iMX8MP-SOM-4GB-IND/ ; certification.oshwa.org/bg000136.html ; github.com/OLIMEX/iMX8MP-SOM (fetched) |
| BeaglePlay | TI AM625 (TI) | 4x A53 @1.4 GHz + M4F + PRU; CC1352P7 | 2 GB DDR4, 16 GB eMMC | ONE USB-A host (USB-C is power/tether) | GbE + single-pair Ethernet | ~5 V (400 mA typ); temp not stated; RTC battery socket | OpenBeagle repo; CC-BY-SA-4.0; OSHWA US002174 | docs.beagleboard.io/boards/beagleplay/ and /03-design.html (fetched) |
| BeagleY-AI | TI AM67A (TI) | 4x A53 @1.4 GHz, 2x C7x DSP 4 TOPS, R5 | 4 GB LPDDR4; microSD only | 4x USB3 Type-A | GbE (PoE+ via add-on) | 5 V via USB-C; temp, RTC not stated | OpenBeagle; page says "Certified open hardware by OSHWA"; licence not named on page | beagleboard.org/boards/beagley-ai (fetched) |
| BeagleBone AI-64 | TI TDA4VM (TI) | 2x A72 @2 GHz (memory) | 4 GB, 16 GB eMMC (memory) | memory: 2x USB3 | GbE | not checked | OpenBeagle; TI-branded DigiKey listing "Obsolete: no longer manufactured" | digikey.com.au .../BEAGL-BONE-AI-64/21283880 (fetched) |
| BeagleBone Black Industrial | TI AM3358 | 1x A8 @1 GHz | not stated on page | 1 host | yes | -40..+85 C | not stated on page | beagleboard.org/boards/beaglebone-black-industrial (fetched). Far below Pi 3B+. |
| PocketBeagle 2 Industrial (Feb 2026) | TI AM6254 | 4x A53 @1.4 GHz | 1 GB DDR4, 64 GB eMMC, microSD | host count not given (USB-C only mentioned) | none mentioned | 5 V/1 A, -40..+85 C | OpenBeagle; PB2 base cert CC-BY-SA-4.0 (US002717) | cnx-software.com/2026/02/24/pocketbeagle-2-sbc-gets-industrial-version-with-1gb-ram-64gb-emmc-flash/ (fetched). Not suitable: no Ethernet, 1 USB. |
| Olimex A64-OLinuXino IND (2Ge16G / 2Ge8G) | Allwinner A64 (China) | 4x A53 @1.2 GHz | 2 GB DDR3L, 8/16 GB eMMC | 1 host + OTG | GbE | 5 V jack or LiPo; -40..+85 C; RTC pad for battery | OSHWA BG000042 | olimex.com/Products/OLinuXino/A64/A64-OLinuXino-2Ge16G-IND/ (fetched). Below Pi 3B+; 1 host. |
| Radxa CM5 / ROCK 5 | Rockchip RK3588/RK3588S | 4x A76 + 4x A55 | varies | varies | varies | varies | Schematic PDF, DXF, STP; CM5 IO board: OrCAD, PADS, Altium exports on GitHub; no hardware licence stated | docs.radxa.com/en/som/cm/cm5/download (fetched). Strong CPU, not OSHWA. |
| FriendlyElec CM3588 / NanoPi R6S | Rockchip RK3588(S) | as above | | | | | Schematic PDF, PCB DXF, 3D, layout PDF for CM3588 NAS carrier; licence not stated | wiki.friendlyelec.com/wiki/index.php/CM3588_NAS_SDK (snippet) |
| Banana Pi / Orange Pi | various | | | | | | PDF schematics; users report no BOM/layout | forum.banana-pi.org/t/bom-design-files/6649 (snippet); Orange Pi not verified |
| Pine64 | Rockchip etc. | | | | | | Announced 19 Aug 2026 no more Linux devices planned (DRAM/eMMC shortage) | cnx-software.com/news/sbc/page/3/ (fetched) |

## Judgement for this job
Reference: Pi 4 = 1.0, Pi 3B+ ~0.5 (owner). A53 quad at 1.2-1.6 GHz sits at roughly Pi 3B+ to 0.6 Pi 4 (memory; not benchmarked here). ALERT2 and 8 channels in worker threads wants at least Pi 4 class.
Rank (open hardware weighted first, then fit):
1. Olimex iMX8MP SOM + EVB: only open, OSHWA, KiCad, industrial SOM; two USB3, NVMe; i.MX 8M Plus has HAB secure boot (NXP docs, snippet) and NXP lists longevity (10-15 yr; term for industrial part not confirmed). Gaps: CPU under Pi 4, no eMMC on SOM, RTC/TPM unstated, tiny vendor, no AU stockist, OS = Armbian Debian 12 / Buildroot (mainline claim only partly verified by CNX 2024).
2. BeagleY-AI: open, OSHWA, 4 USB hosts, available in Australia; no eMMC, no industrial grade, USB-C power, consumer-grade; fine for lab/trial.
3. BeaglePlay: open, eMMC, RTC socket, AU stock; only 1 USB host (needs a hub), A53.
4. Radxa/FriendlyElec RK3588 modules: best CPU, partial design files, Chinese vendor origin (a negative for government procurement), no stated licence.
5. A64-OLinuXino-IND, BeagleBone Black Industrial: industrial temperature but CPU too weak / 1 USB.
Custom-board starting point: Olimex SOM (CERN-OHL-S, KiCad) first; BeagleBoard designs (CC-BY-SA, OpenBeagle) second.
Government fit: no board here has a vendor security-patching statement found; Beagle (TI silicon, US) and NXP are the most procurement-friendly silicon origins; Allwinner/Rockchip are Chinese.

## Where to order (links; prices not confirmed unless stated)
- BeaglePlay: Little Bird https://littlebirdelectronics.com.au/products/beagleplay : A$266.95, GST basis not stated, 0 in Sydney, SparkFun supply, dispatch est. 17-23 Nov 2026 (fetched 2026-11-11). Core Electronics https://core-electronics.com.au/beagleplay.html : 403 to automated read; search snippet said A$219.95 inc GST (snippet, unverified).
- BeagleY-AI: Core Electronics https://core-electronics.com.au/beagley-ai-open-source-development-board-4-tops.html (403; snippet A$149.95 inc GST); Pakronics https://www.pakronics.com.au/products/beagley-ai-ss102991834 ; Mouser AU https://au.mouser.com/c/embedded-solutions/computing/single-board-computers?pg=6 (snippet: 133 in stock).
- BeagleBone AI-64: DigiKey AU https://www.digikey.com.au/en/products/detail/texas-instruments/BEAGL-BONE-AI-64/21283880 (TI-branded: obsolete). BeagleBoard-branded 102110646 https://www.digikey.com.au/en/products/detail/beagleboard/102110646/15929655 (snippet ~A$293).
- Olimex iMX8MP SOM: maker shop https://www.olimex.com/Products/SOM/NXP-iMX8/iMX8MP-SOM-4GB-IND/ : 156.00 EUR (fetched; a CNX 2024 article said 70 EUR, so price has moved); EVB https://olimex.com/Products/SOM/NXP-iMX8/iMX8MP-SOM-EVB-IND : 50 EUR, in stock (fetched). DigiKey https://www.digikey.co.uk/en/products/detail/olimex-ltd/IMX8MP-SOM-4GB-IND/24387269 (GBP 106.76 ex VAT, snippet); try DigiKey AU for the same part IMX8MP-SOM-4GB-IND. No Australian stockist found for Olimex.
- A64-OLinuXino-2Ge16G-IND: 165.36 EUR, maker site (fetched).

## Could not confirm
- Core Electronics pages: 403 (automated read refused; not circumvented).
- Mouser PDF user manual of Olimex SOM: 503. So SOM RTC, TPM, power-input range unconfirmed; secure boot on Olimex image unconfirmed (only NXP HAB capability via snippets).
- Olimex GitHub HARDWARE folder contents (BOM, gerbers) not listed.
- BeagleY-AI and BeagleBone AI-64 power, temperature, RTC; BeaglePlay temperature range, TPM, secure boot.
- BeagleBone AI-64 live status at Beagle (only TI-branded listing seen as obsolete).
- StarFive/SiFive, MNT, Seeed, Libre Computer, Orange Pi: searches returned nothing usable; not assessed. Libre OSHWA status unknown.
- Any Australian-designed/made Linux board: none found (Caligra mentioned in a snippet, unverified, likely not relevant).
- Radxa/FriendlyElec current prices and AU stockists; Okdo ROCK 3 listed at Pakronics only as a lead.
- No benchmark comparing i.MX8MP to Pi 4 was found; the ratios above are estimates.
