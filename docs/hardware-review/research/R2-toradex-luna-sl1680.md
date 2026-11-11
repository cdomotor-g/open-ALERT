# R2 — Toradex Luna SL1680: audit from primary sources

Read on 2026-11-11. Every row names the page I opened and how I know it:
**fetched** = I read the page or file myself; **snippet** = search-result text only; **memory** = not checked.
Files I downloaded are kept under `(working folder, not kept)/R2-dl/`.

One thing to know about the sources: `www.toradex.com` refused automated reading (HTTP 403) and I did not retry it. Toradex's own Chinese-language site, `www.toradex.cn`, carries the same product page (the specification, price and "intended use" blocks are in English or are short Chinese labels) and allowed reading. Rows that rest on it say "toradex.cn". Chinese text is quoted with my translation beside it; the English wording on toradex.com could not be compared.

---

## 1. The short answer

1. **The Luna SL1680 is not a production product yet.** On 2026-11-11 Toradex's own product page gives its intended use as "用于评估/开发" (for evaluation / development), and every Torizon OS release note that names it — 7.6.0, 7.7.0 (28 Aug 2026) and 7.6.2 (2 Sep 2026) — lists it under "Sample products … this release is intended for evaluation and development." The datasheet is still "Preliminary – Subject to Change" (Rev 0.2, 10 Apr 2026), with product compliance "TBA" and power figures "in progress".
2. **Its software is a different, weaker chain than a Verdin's.** It runs "Common Torizon" on Synaptics' vendor kernel (linux-syna 6.12.11, pinned to Synaptics' Astra SDK v2.1.0), not a Toradex-maintained BSP. Toradex says so itself: the Luna BSP "is built and maintained by the SoC vendor". Mainline Linux has no SL1680 support. Toradex's Secure Boot table has no Luna column. Support is "via our active community forum".
3. **Toradex promises 5 years for the Luna family, against "15+ years" for its modules**, and tells buyers who need a longer lifecycle, BSP-level control or harsh environments to pick an industrial module instead.
4. **CPU: about 1.2 times a Raspberry Pi 4 (range 1.1 to 1.35), about 0.6 of a Pi 5.** No benchmark of the Luna or of an SL1680 board was found on any page that allowed reading. The figure is built from measured Cortex-A73 results on other chips and one PassMark sample of the sister chip VS680. The repo's "about 1.1" is at the cautious end of that range and fair. It is not a headroom machine.
5. **The hardware claims in the repo hold, with five corrections** (section 2): the clock battery is a connector, not a fitted cell; the four USB ports share one hub and one SoC port; the board may arrive with an empty eMMC; the datasheet contradicts itself on temperature and memory; Wi-Fi/Bluetooth is a plug-in M.2 card on the only variant sold.
6. **Price confirmed: US$145.00 for one, ex tax**, on Toradex's shop block. That is A$210.82 ex GST at the Reserve Bank's 0.6878 on 11 Nov 2026, A$231.90 with 10% GST, before courier. No Australian stockist was found.

**What this should change:** keep the Luna as a comparison row, marked "sample — evaluation only", not as a deployment candidate. Nothing found here makes it a better answer than the Verdin AM62 for a security-reviewed, long-lived site, and several things make it worse.

---

## 2. The repo's claims, one by one

Repo record: `/home/user/open-ALERT/site/data/compute.js` lines 184–201 (`toradex-luna-sl1680`).

| # | Repo claim | Verdict | What the source says | Source (basis) |
|---|---|---|---|---|
| 1 | Four Cortex-A73 cores at 2.1 GHz | **Confirmed** | "64-bit ARM®v8-A architecture quad-core ARM® Cortex®-A73 processor cluster … Clock speed up to 2.1 GHz … 40,000 DMIPS performance rating." Synaptics' own datasheet: "Up to 2.1 GHz for each CPU, delivering up to 40000 DMIPS … 1 MB shared L2 Cache". Synaptics' kernel device tree has operating points at 0.8, 1.4, 1.8 and 2.1 GHz (2.1 GHz at 0.9 V), so the top speed is switched on in the shipped kernel. | Luna datasheet Rev 0.2 §1.2 <https://docs.toradex.com/118084-luna_sl1680_datasheet.pdf> (fetched); Synaptics SL1680 datasheet §2.1 <https://cp.synaptics.com/cognidox/download/NR-155247-DS-9.pdf> (fetched); <https://raw.githubusercontent.com/synaptics-astra/linux_6_12-main/scarthgap_6.12_v2.6.1/arch/arm64/boot/dts/synaptics/dolphin.dtsi> (fetched) |
| 2 | 4 GB RAM | **Confirmed for the one variant sold** | "Luna SBC SL1680 Quad 4GB Wi-Fi / Bluetooth ET · PN: 0301 · 4GB RAM · 16GB FLASH · -25°C to +85°C". The datasheet itself is inconsistent: "up to 4 GB of LPDDR4 RAM on a 32-bit bus" in §1.3, "up to 16 GB of 32-bit LPDDR4 DRAM" in §2.1.3, and a table headed "Luna SL1680 SBC 16GB LPDDR4". | <https://www.toradex.cn/single-board-computers/luna-sl1680> (fetched, toradex.cn); datasheet §1.3, §2.1.3, Table 1 (fetched) |
| 3 | 16 GB eMMC | **Confirmed** | "16GB FLASH" on the variant; "up to 256 GB eMMC" is the family ceiling. A microSD slot is also fitted. | same product page (fetched); datasheet §1.3.2 (fetched) |
| 4 | "A battery clock" | **Half right** | A real-time clock chip is fitted: "the low-power Analog Devices DS1339AU+T real-time clock". The battery is not stated as fitted: "supports backup power through an external battery connected via the BM02B-SRSS-TBT connector"; the connector list says "RTC battery header/holder". Budget a cell and lead. | datasheet §1.5.4, §6.1.1, §1.4 (fetched) |
| 5 | Four USB 3 ports | **Confirmed, with a catch** | "Four USB-A ports (USB 3.x)"; "4x SuperSpeed USB Type-A (Host)". The block diagram shows both dual connectors fed from one "USB Hub" on one SoC "USB 3.0" port, and the pin tables are headed "USB hub ball name". So four RTL-SDR sticks share one upstream link (as they do on a Pi 4). Per-port current limits are not given: "All USB ports include overcurrent and short-circuit protection." | datasheet §1.4, Table 3, Figure 1, Tables 20–21, §5.6 (fetched) |
| 6 | Wi-Fi | **Confirmed — as a plug-in card** | "The Luna SL1680 SBC WB variants provide integrated wireless connectivity via an external Wi-Fi and Bluetooth module. The module is installed on the M.2 (NGFF) socket, Key E." The radio chip is not named ("Module dependent"). Only one variant is listed, and it has the card. For a site where radios are not allowed the card can be unplugged. Antenna and certification details: "Information about pre-certified antennas and cables are coming soon." | datasheet §1.5.5, Table 3 (fetched); product page variant list (fetched, toradex.cn) |
| 7 | −25 to +85 °C | **Confirmed on the product page; the datasheet contradicts itself** | Product page: "Typical Extended Temperature — From -25°C to +85°C". Datasheet §1.3.1: "(−25 °C to +85 °C)". But datasheet Tables 36 and 37 give operating temperature "-40 … 85 °C", and storage temperature as 125 °C in one table and 105 °C in the other. Use −25 to +85 °C. | product page (fetched, toradex.cn); datasheet §1.3.1, Tables 36–37 (fetched) |
| 8 | 5 V only, up to 5 A, no USB-PD negotiation | **Confirmed** | "expects a regulated 5 V input power supply with a typical current draw around 3 A, peaking during start-up or heavy load conditions up to 5 A (25 W)"; input 4.75–5.25 V; under-voltage lock-out about 4.4 V. "It does not implement USB Power Delivery (USB-PD), does not participate in power negotiation, and cannot source power to downstream peripherals." 5 V into the 40-pin header also works ("ensure … proper current limiting and reverse-protection are provided externally"). Getting-started guide: "Power Supply: USB-C (5V/5A recommended)". These are supply-sizing figures, not measurements: "Detailed power-consumption characterization is currently in progress". | datasheet §10.1, Table 35, §8.1, §5.6.1 (fetched); <https://docs.toradex.com/118333-luna_sl1680_sbc_getting_started.pdf> §2.1 (fetched) |
| 9 | Part 03011000 | **Confirmed** | "0301 Luna SL1680 V1.0A · Product # 03011000 · Initial Release · Q1 2026 · Initial release, no PCN document". The shop shows "PN: 0301". | <https://developer.toradex.com/hardware/luna-family/single-board-computers/luna-sl1680/> (fetched); product page (fetched, toradex.cn) |
| 10 | About US$145 from Toradex | **Confirmed** | Shop block on the product page: sample quantity "1", `data-price="US$145.00"`, "Buy now"; volume quantity "100 - 200,000" by quote. Toradex shop prices are net of tax. CNX Software reported US$105 at announcement, then "pre-orders are open … starting price has increased to $145", "probably" for memory prices. | product page HTML (fetched, toradex.cn, 2026-11-11); <https://www.cnx-software.com/2025/12/18/toradex-luna-sl1680-a-pro-consumer-raspberry-pi-lookalike-based-on-synaptics-sl1680-edge-ai-soc/> (fetched) |
| 11 | Released early 2026, datasheet preliminary | **Confirmed** | "Initial Release · Q1 2026". Datasheet cover: "Preliminary – Subject to Change"; Rev 0.1 03-Nov-2025, Rev 0.2 10-Apr-2026. Getting-started guide Rev 0.3, 23-Mar-2026. Developer page still shows "Coming soon" for first-order recommendation, power consumption and design resources, and its link is titled "Luna SL1680 Datasheet (preliminary)". | developer page (fetched); datasheet revision table (fetched); getting-started revision table (fetched) |
| 12 | Comes with Torizon OS | **Not reliably** | Marketing: "Pre-installed Torizon OS". Getting-started guide: "will be shipped either with a fresh eMMC or with the eMMC containing the Torizon OS pre-installed, in some cases … If Torizon OS is not pre-installed on your board, you will need to manually flash it." Flashing needs a jumper, a USB-C lead to a PC and Synaptics' flashing script. And the Torizon it runs is "Common Torizon" (section 3). | product page (fetched, toradex.cn); getting-started §3.2, §4 (fetched) |
| 13 | No Australian stock | **Nothing found; not proven** | DigiKey Australia: "Sorry, "toradex luna sl1680" did not return any results." Searches found no element14, Mouser or DigiKey listing. element14 Australia and Mouser could not be read automatically (HTTP 503). | <https://www.digikey.com.au/en/products/result?keywords=toradex%20luna%20sl1680> (fetched); web searches (snippet) |
| 14 | "About 1.1 times a Raspberry Pi 4", scaled by clock, no benchmark | **Fair but cautious; best estimate 1.2 (1.1–1.35)** | See section 5. | section 5 |
| 15 | Grade: Toradex's "pro consumer" tier | **Confirmed in substance** | Toradex: "Ready-to-use SBC for commercial and light-industrial Edge AI applications"; "Light-Industrial SBCs". CNX Software, from Toradex's launch material: "designed for pro consumer and light industrial Edge AI applications"; its positioning graphic reads "Lower price, lower industrial readiness". | product page (fetched, toradex.cn); CNX article (fetched) |
| 16 | `life: 'Not stated'`, `lifeYears: 6` | **Out of date — Toradex now says 5 years** | Luna family page, "Why Luna": "5年长期服务承诺" (5-year long-term commitment); in the comparison with maker boards: "产品生命周期可能不明确" (product lifecycle may be unclear) against "5年长期服务承诺". | <https://www.toradex.cn/single-board-computers/luna-arm-family> (fetched, toradex.cn) |
| 17 | `status: 'beta'` | **Right, and stronger than the page says** | Intended use "用于评估/开发" (for evaluation / development); "Sample products: … Luna SL1680 … Due to the hardware status being "sample," this release is intended for evaluation and development." | product page (fetched, toradex.cn); <https://developer.toradex.com/news/torizon-os-7-7-0-quarterly-release/> (fetched) |
| 18 | `open.sw: 'partial'` — "Torizon OS open source" | **Partly** | The kernel source and Yocto layers are public. Synaptics' early boot stage is a closed binary: "Astra Pre-boot image is signed and encrypted using Synaptics key." Astra SDK v2.6.1 release notes: "Synaptics Proprietary TAs … which run in the OP-TEE Trusted Execution Environment. They are provided in binary format. Synaptics will migrate them into REE and open source the code to the public in a near future releases." No board design files were found. | <https://synaptics-astra.github.io/doc/v/latest/_sources/appnotes/astra-security.rst.txt> (fetched); <https://synaptics-astra.github.io/doc/v/latest/_sources/release_notes/scarthgap_6.12_v2.6.1.rst.txt> (fetched) |

Other facts from the datasheet worth having: 85 × 56 × 17 mm; Gigabit Ethernet on a Realtek RTL8211F-CG; "Power over Ethernet (PoE) pass-through capability is supported when using an optional dedicated adapter" on a 4-pin header; a 250 MHz Cortex-M3 "dedicated to security and system management"; two micro-HDMI (one in, one out); a fan header; a power button.

### Signs the documentation is immature

All from the datasheet fetched today (Rev 0.2):

- Memory ceiling given as 4 GB in one section and 16 GB in two others.
- Operating temperature −25 °C in the text, −40 °C in both tables; storage temperature 125 °C and 105 °C.
- The USB-C section calls the pull-down-only port a "downstream-facing port (DFP)"; section 8.1 correctly calls it "a USB-C device (UFP) with a fixed 5V sink role".
- "11.1 Product Compliance — TBA. More information about compliance will be available on the next releases of the datasheet." No RCM, CE or FCC statement could be found for it.
- "More information about low power modes will be available on the next releases".
- A Toradex engineer on the support forum, 25 Aug 2026: "documentation on pinmuxing is quite scarce with the SL1680"; 27 Aug 2026: "There is a known issue with device tree overlays on the Luna board." <https://community.toradex.com/t/enabling-spi-on-luna-sl1680/30786> (fetched, via the summarising tool).

---

## 3. Software

### 3.1 What is offered, and by whom

| Operating system | Offered by | Status for the Luna | Source (basis) |
|---|---|---|---|
| **Torizon OS 7 — the "Common Torizon" build** (Yocto Scarthgap, containers, OTA updates) | Toradex | The only OS Toradex ships and supports on it. Latest quarterly image: "Luna SL1680 SBC … 7.7.0+build.4 … 2026/07/16 … 846.23 MiB", served from `…/common-torizon-syn-oe-prod-frankfurt/scarthgap-7.x.y/release/4/luna-sl1680/common-torizon/torizon-docker/oedeploy/SYNAIMG-flash.tar.gz`. Monthly pre-release: 7.8.0-devel-20261012. | <https://developer.toradex.com/software/toradex-embedded-software/toradex-download-links-torizon-linux-bsp-wince-and-partner-demos/> (fetched) |
| **Synaptics Astra SDK** (Yocto Scarthgap 5.0.9, Linux 6.12.62, OP-TEE 4.5.0, U-Boot "based on U-Boot 2025.01") | Synaptics | Built for Synaptics' own Astra Machina boards. Latest is v2.6.1, "GA Release", published 13 Oct (2026). It is the base that Toradex's build takes its kernel and board support from. Running it directly on a Luna is your own port. | <https://synaptics-astra.github.io/doc/v/main/release_notes/scarthgap_6.12_v2.6.1.html> (fetched); <https://github.com/synaptics-astra/sdk/releases> (fetched) |
| **Android** | Synaptics (chip level) | The product brief calls the chips "AI-Native Linux® and Android™ systems on chip". No Android build for the Luna was found. | <https://cp.synaptics.com/cognidox/download/NR-155888-PB-7.pdf> (fetched) |
| **Debian or Ubuntu as the host OS** | Nobody | Not offered by Toradex or Synaptics. Synaptics' documentation lists only "Astra Yocto Linux" guides. A community Armbian image exists for a different board on the sister chip (Banana Pi BPI-M6), on a "legacy_5.4.195" vendor kernel. | <https://synaptics-astra.github.io/doc/v/latest/index.html> (fetched); <https://forum.banana-pi.org/t/ive-made-an-unboxing-and-more-videos-and-written-some-article-about-the-bpi-m6/16584> (fetched) |
| **"Your own OS"** | You | Toradex FAQ: "是的。您可以使用自己喜欢的操作系统。然而…您需要自行负责构建、验证和维护该软件基础架构，并依赖系统级芯片（SoC）供应商提供的BSP支持" (Yes, you may use your own OS; but you are then responsible for building, validating and maintaining it, relying on the SoC vendor's BSP support). | <https://www.toradex.cn/single-board-computers/luna-arm-family> (fetched, toradex.cn) |

So RPi ALERT on a Luna means the same route as the Verdin plan — the agent in a Debian container under Torizon — but on a kernel Toradex does not maintain.

### 3.2 The kernel

| Fact | Evidence | Source (basis) |
|---|---|---|
| Toradex's build for the Luna takes Synaptics' layer at a fixed commit | `<project name="meta-synaptics" … remote="synaptics" revision="990a66e0111040ead67b0357a0330c55ca62a602"/>` in both `default.xml` and `integration.xml`; `next.xml` names `revision="scarthgap_6.12_v2.1.0"`. The manifest was last touched "5 days" before reading ("fix common and torizon manifest for 7.8.0 release"). | <https://git.toradex.com/cgit/toradex-manifest.git/plain/common-torizon/syn/default.xml?h=scarthgap-7.x.y> and `integration.xml`, `next.xml` (fetched) |
| That commit's kernel recipe is 6.12.11 | Directory listing shows `linux-syna.inc` and `linux-syna_6.12.11.bb`; the commit sets the Astra version to `scarthgap_6.12_v2.1.0`. | <https://github.com/synaptics-astra/meta-synaptics/tree/990a66e0111040ead67b0357a0330c55ca62a602/recipes-kernel/linux> (fetched) |
| A user's Luna reported the same | "Common Torizon OS 7.5.0-devel-20260123143454+build.0 (scarthgap) … Kernel: 6.12.11-Torizon" | <https://community.toradex.com/t/enabling-spi-on-luna-sl1680/30786> (fetched, via the summarising tool) |
| Synaptics' own SDK has moved to 6.12.62 and stayed there | v2.2.0 "Kernel Version 6.12.11"; v2.3.0, v2.4.0 and v2.6.1 all "Kernel Version 6.12.62". The kernel tree's Makefile at tag `scarthgap_6.12_v2.6.1` reads VERSION 6, PATCHLEVEL 12, SUBLEVEL 62. | release notes v2.2.0, v2.3.0, v2.4.0, v2.6.1 under <https://synaptics-astra.github.io/doc/v/main/release_notes/> (fetched); <https://raw.githubusercontent.com/synaptics-astra/linux_6_12-main/scarthgap_6.12_v2.6.1/Makefile> (fetched) |
| Upstream's 6.12 long-term kernel is at 6.12.117 | kernel.org on 2026-11-11: "longterm 6.12.117 2026-11-10"; 6.12 projected end of life "Dec, 2028". | <https://www.kernel.org/releases.json>, <https://www.kernel.org/category/releases.html> (fetched) |
| **Mainline Linux does not support the SL1680** | Mainline (7.4-rc2) builds only two Synaptics device trees: `berlin4ct-dmp.dtb` and `berlin4ct-stb.dtb` ("# Berlin SoC Family"). Nothing for SL1680 / "dolphin". Synaptics' own device tree for the chip relies on dozens of `syna,berlin-*` and `syna,dolphin-*` vendor drivers (clocks, audio, video, display); I did not check each one against mainline. | <https://raw.githubusercontent.com/torvalds/linux/master/arch/arm64/boot/dts/synaptics/Makefile> (fetched); dolphin.dtsi (fetched) |
| When those point releases came out upstream | "Linux 6.12.11 … Date: Thu Jan 23 17:23:05 2025"; "Linux 6.12.62 … Date: Fri Dec 12 18:37:22 2025". | <https://cdn.kernel.org/pub/linux/kernel/v6.x/ChangeLog-6.12.11>, <https://cdn.kernel.org/pub/linux/kernel/v6.x/ChangeLog-6.12.62> (fetched) |

In plain terms: the Luna runs a vendor kernel based on a point release from January 2025, with security fixes carried in by hand. Synaptics' current kernel (December 2025's 6.12.62) is 55 point releases behind upstream's 6.12 line, and Toradex's pin is 51 behind Synaptics'. There is no route to a mainline or distribution kernel.

### 3.3 Who issues security patches, and for how long

| Question | Answer | Source (basis) |
|---|---|---|
| Who maintains the board support? | Synaptics. Toradex FAQ: "其板级支持包（BSP）由 SoC 供应商构建和维护，而 Toradex 工业级系统级模块（SoM）则采用基于 SoC 供应商 BSP 并由 Toradex 构建和维护的 BSP" (its BSP is built and maintained by the SoC vendor, whereas Toradex's industrial modules use a BSP built and maintained by Toradex). | Luna family page (fetched, toradex.cn) |
| What does Toradex promise on top? | "The SL1680 Astra DevKit and Toradex's SL1680 SBC receives a fully qualified and tested quarterly release of Torizon … This includes CVE Scanning and Triaging. Support is provided via our active community forum." | <https://www.torizon.io/supported-hardware/synaptics> (fetched) |
| A worked example | Two Linux kernel privilege-escalation flaws, "Copy Fail" (CVE-2026-31431) and "Dirty Frag" (CVE-2026-43284): Toradex's notices are dated 13 May 2026. Fixed for Toradex modules in Torizon OS 7.6.1 (6 Aug 2026). Fixed for the Luna in 7.7.0 (28 Aug 2026) and 7.6.2 (2 Sep 2026): "Fixed the Copy Fail CVE-2026-31431 and Dirty Frag CVE-2026-43284 Linux kernel vulnerabilities on Common Torizon for x86, supported Texas Instruments platforms, and Luna SL1680 and Astra Machina SL1680." That is about 15 weeks from notice to a fixed release for the Luna, three weeks after Toradex's own modules. | <https://developer.toradex.com/news/security-notice-cve-2026-31431-copy-fail/>, <https://developer.toradex.com/news/torizon-os-7-6-2-patch-release/>, <https://developer.toradex.com/news/torizon-os-7-7-0-quarterly-release/>, news feed <https://developer.toradex.com/news/rss.xml> (all fetched) |
| For how long? | **Not stated for the Luna.** The family page says "5-year" commitment without saying whether that covers software. The product page's generic security panel says "长期支持（LTS）四年的支持" (LTS: four years of support, following each major BSP release), but that panel describes Toradex's in-house BSP, which the Luna does not use. Torizon OS 7 is built on Yocto Scarthgap, "Long Term Support (until April 2028)". Synaptics publishes no support term or security-update policy in the SDK pages read. | Luna family and product pages (fetched, toradex.cn); <https://wiki.yoctoproject.org/wiki/Releases> (fetched); Astra SDK index and release notes (fetched) |
| A conflict on Toradex's own site | The Torizon "Supported Hardware Overview" lists "Luna SL1680 SBC" under "Toradex Hardware Support — Fully integrated and tested, with priority support. Production-ready." The release notes and product page say sample, evaluation and development. | <https://developer.toradex.com/torizon/torizoncore/supported-hardware/> (fetched) against the release notes above |

### 3.4 Secure boot

| Fact | Evidence | Source (basis) |
|---|---|---|
| The chip can do it | "Secure boot with RSA digital signature verification from eMMC and SPI NOR Flash … On chip 32Kbit OTP … 250MHz Secure CPU (Arm Cortex®-M3)". | Synaptics SL1680 datasheet §2.9 (fetched) |
| Synaptics' own first stage is always verified and is closed | "In the released Astra SDK, Synaptics enables only the SYNA_secure_boot_enable fuse. This means that preboot images (owned by Synaptics) are always securely booted, U-boot, kernel, and TEE images (owned by OEM) are non-securely booted." "Astra Pre-boot image is signed and encrypted using Synaptics key." | <https://synaptics-astra.github.io/doc/v/latest/_sources/appnotes/astra-security.rst.txt> (fetched) |
| The owner's own keys are possible, by burning one-time fuses | "During the OEM mass production (MP) flow, OEM can burn the OEM_secure_boot_enable OTP fuse to enable OEM secure boot … After OEM secure boot is enabled, the device won't boot unsigned image again". The guide and key-generation scripts are public ("gen_all_keys_stores.py … K0_REE.rsa.priv.pem: 2048-bit RSA private key"). The fuse guide warns: "Any violation may result in PERMANENT BRICK." | astra-security (fetched); <https://synaptics-astra.github.io/doc/v/latest/_sources/subject/mp_flow_user_guide.rst.txt>, <https://synaptics-astra.github.io/doc/v/latest/_sources/subject/otp_guide.rst.txt> (fetched) |
| Toradex does not offer it for the Luna | Toradex's Secure Boot support table has columns for Aquila, Verdin (including "Verdin AM62" and "Verdin AM62P"), SMARC, Apalis and Colibri modules. There is no Luna column. Its security layer's README covers "NXP iMX based SoMs" and "TI K3 based SoMs (e.g. AM62)" only. | <https://developer.toradex.com/torizon/security/secure-boot-on-torizoncore/> (fetched); <https://github.com/toradex/meta-toradex-security> (fetched) |

**For a small customer:** the documents and tools to sign your own images are public and no agreement step is mentioned in the pages read, so it looks possible on paper. But it is a do-it-yourself, one-way fuse job on a sample-status board, with no Toradex guide, 2048-bit RSA keys, and no word on whether it works together with Torizon's update system. Whether Toradex ships Lunas with the owner fuses untouched is not stated. Treat it as "not available as a supported feature today".

---

## 4. Lifecycle and product tier

| Fact | Evidence | Source (basis) |
|---|---|---|
| Tier | "Light-Industrial SBCs"; "commercial and light-industrial"; "pro consumer" in launch coverage. Below Toradex's industrial modules by its own description. | product and family pages (fetched, toradex.cn); CNX article (fetched) |
| Stated lifetime | "5年长期服务承诺" (5-year long-term commitment). No end year is given, and the developer site's long-term-availability page does not mention the Luna. | family page (fetched, toradex.cn); <https://developer.toradex.com/hardware/hardware-resources/long-term-availability/> (fetched) |
| Against Toradex modules | "We provide 15+ years of life-cycle for all our computer modules." | same long-term-availability page (fetched) |
| Toradex's own advice | "对于需要定制载板、更深入的低级 Linux 控制、BSP 级定制、严苛工业环境部署或更长工业生命周期保障的应用，Toradex 工业级 SoM 系列仍是最佳选择" (for custom carrier boards, deeper low-level Linux control, BSP-level customisation, harsh industrial environments or longer industrial lifecycle guarantees, Toradex's industrial modules remain the best choice). And: Luna "最适合那些…无需高度定制、恶劣环境认证或长工业生命周期要求的产品" (suits products that do not need heavy customisation, harsh-environment certification or a long industrial lifecycle). | family page (fetched, toradex.cn) |
| Current life-cycle state | Sample. Toradex's definition: "样品产品可以少量供货…处于本状态下的产品会在没有来自Toradex事先通知的情况下发生变更。软件支持不覆盖所有功能" (sample products are available in small quantities … products in this state may change without prior notice from Toradex; software support does not cover all functions). | product page, product-status panel (fetched, toradex.cn) |
| Change notices | Promised for the family ("产品变更通知（PCN）承诺"), but they apply to volume products; "Initial release, no PCN document" so far. | family page (fetched, toradex.cn); developer page (fetched) |
| Timeline | Toradex–Synaptics partnership announced 15 Oct 2025; datasheet Rev 0.1 3 Nov 2025; press coverage 16–18 Dec 2025; "Initial Release Q1 2026"; Torizon support added in 7.5.0 (29 Jan 2026); still "sample" in the 2 Sep 2026 release. Ten months after release it has not moved to volume. | <https://www.torizon.io/news/toradex-synaptics-partnership> (fetched); datasheet (fetched); <https://www.torizon.io/news/torizon-os-release-7-5-0-quarterly-release> (fetched); release notes above |

---

## 5. Performance

### 5.1 What exists

No benchmark of the Luna SL1680, or of any SL1680 board, was found on a page that allowed reading. Toradex's developer page says "Power Consumption: Coming soon" and publishes no CPU figures. The Synaptics figure is a Dhrystone rating ("40000 DMIPS"), which says little about real work.

What could be read:

| Source | Board / chip | Measure | Result | Raspberry Pi 4, same source | Raspberry Pi 5, same source | Ratio to Pi 4 | Basis |
|---|---|---|---|---|---|---|---|
| sbc-bench results table <https://raw.githubusercontent.com/ThomasKaiser/sbc-bench/master/Results.md> | Cortex-A73 cores in other chips: Khadas VIM3 (A311D) at 2.2 GHz and 2.4 GHz; ODROID-N2 (S922X) at 2.0 GHz; ODROID-N2+ at 2.4 GHz; Khadas VIM4 at 2.2 GHz | 7-zip, one thread | 2026 at 2.2 GHz; 2012 at 2.0 GHz; 2253–2379 at 2.4 GHz; 2067–2081 at 2.2 GHz. That is 0.92–1.01 per MHz. **Scaled to 2.1 GHz: 1,930–2,110** | 1741–1769 (Pi 4 B at 1.8 GHz, 64-bit) = 0.97–0.98 per MHz | 3196–3305 at 2.4 GHz | **1.10–1.20 per core** | fetched; the scaling is mine |
| same table | — | 7-zip, all cores | Not measured for four A73s alone. Estimate 4 × 1,930–2,110 × the Pi 4's own 4-thread efficiency of 0.82 to the Pi 5's 0.89 = **6,300–7,500** | 5640–5790 | 11010–11830 | **1.1–1.3 on four threads**; Pi 5 is 1.9–2.1 | fetched figures, my arithmetic |
| PassMark database <https://www.cpubenchmark.net/compare/6776vs4297vs4078/Synaptics-VS680-vs-BCM2711-vs-ARM-Cortex-A72-4-Core-1800-MHz>, <https://www.cpubenchmark.net/cpu.php?cpu=Synaptics+VS680&id=6776> and, for the Pi 5 entry, <https://www.cpubenchmark.net/compare/6776vs3958vs5743/Synaptics-VS680-vs-BCM2711-vs-BCM2712> | "Synaptics VS680", 4 cores, 2.1 GHz — the sister chip with the same CPU cores | CPU Mark / single thread | **1,728 / 879**, one sample, "margin for error … High" | BCM2711 (1.5 GHz): 852 / 607, 7 samples. "ARM Cortex-A72 4 Core 1800 MHz": 668 / 501, 317 samples | "ARM Cortex-A76 4 Core 2400 MHz": 2,179 / 1,050, 399 samples | **2.0 (multi), 1.45 (single)** against BCM2711; 0.79 / 0.84 of the Pi 5 entry | fetched |
| cool-web.de hobby review of the Banana Pi BPI-M6 (same VS680 family) | BPI-M6 | PassMark CPU Mark | 1200 | 912 (Pi 4B rev 1.1) | "almost 1.8 times" the BPI-M6 | **1.32** | **snippet only** — the page returned HTTP 503 |
| same review | BPI-M6 | sysbench | 7792 events/s | 10213, from a different page with unknown settings | — | not comparable | snippet only |
| Synaptics datasheet | SL1680 | Dhrystone | "up to 40000 DMIPS" for four cores at 2.1 GHz | — | — | — | fetched |

Why the PassMark ratio is higher than the 7-zip one: on 7-zip the A73 and the Pi 4's A72 do the same work per clock tick (0.97 against 0.97 per MHz in the table above), so the gain is the clock alone. PassMark also counts memory speed and encryption, where the Pi 4 is unusually weak (sbc-bench shows its 64-bit memory copy at about 2,200–2,800 MB/s against 4,000–5,100 for the A311D and S922X boards, and notes the Pi 4 has no ARMv8 crypto extensions: its AES score is 36,000–83,000 against 1.25–1.37 million). Narrow-band decoding in JavaScript worker threads is arithmetic on small buffers, so the 7-zip-style ratio is the better guide. The PassMark entry is also a single sample of a different chip on unknown software.

### 5.2 A defensible figure

**About 1.2 times a Raspberry Pi 4 (the 1.8 GHz, 64-bit Pi 4 the repo measures against). Plausible range 1.1 to 1.35.** An outside chance of up to 2 on work that leans on memory speed. **About 0.6 of a Raspberry Pi 5** (range 0.55–0.7).

- The repo's "about 1.1" (its `sdrCh: 9`, i.e. 4.5 Pi-4 cores) sits at the low end of that range. It is fair to keep, or to raise to 1.2 with the range shown. Either way it stays "an estimate".
- It gives no real headroom. If a Pi 4 carries 4–8 channels today, a Luna carries perhaps one more. Growth and ALERT2 want a Pi 5-class machine (twice a Pi 4) or more.
- Unknowns that could pull it down: no published thermal behaviour (is a heatsink fitted? does it hold 2.1 GHz at 0.9 V in a sealed box at 50 °C?), and Synaptics' own power note measures everything with the "CPU @ 1.8GHz" (<https://cp.synaptics.com/cognidox/download/NR-158622-AN-APPROVED.pdf>, fetched).
- The only way to settle it: run the repo's own decoder benchmark on one board for ten minutes, lid on.

---

## 6. Price and availability, late 2026

| Seller | Item | Price | Tax | Stock / lead time | Read on | Source (basis) |
|---|---|---|---|---|---|---|
| **Toradex webshop** | Luna SBC SL1680 Quad 4GB Wi-Fi / Bluetooth ET, PN 0301, quantity 1 ("sample quantity") | **US$145.00** | Net of tax (Toradex: web prices are net, tax and other charges extra) | Not shown in the page source; "Buy now" button present. 100–200,000: quote only | 2026-11-11 | <https://www.toradex.cn/single-board-computers/luna-sl1680> (fetched, toradex.cn; `data-price="US$145.00"`); net-price wording from <https://www.toradex.cn/order-now/how-to-order> (fetched; the China ordering page) |
| — in Australian dollars | same | **A$210.82 ex GST; A$231.90 inc 10% GST**, before courier and any import handling | — | — | 2026-11-11 | Reserve Bank of Australia rate 0.6878 USD per AUD on 11 Nov 2026 <https://www.rba.gov.au/statistics/frequency/exchange-rates.html> (fetched); the conversion is mine |
| Earlier prices | same | US$105 "and up" at announcement (Dec 2025), then US$145 at pre-order | — | — | — | CNX Software article and its comments (fetched) |
| **DigiKey Australia** | — | Not listed | — | "did not return any results" | 2026-11-11 | <https://www.digikey.com.au/en/products/result?keywords=toradex%20luna%20sl1680> (fetched) |
| **element14 Australia** | — | Could not be read automatically (HTTP 503). Searches return element14 pages for other Toradex modules, none for the Luna. | — | — | 2026-11-11 | web search (snippet) |
| **Mouser** | — | Could not be read automatically (HTTP 503). Searches found Mouser's Toradex pages with no Luna, and the Synaptics SL1680 evaluation kit. | — | — | 2026-11-11 | web search (snippet) |
| Courier to Australia | — | Not found | — | — | — | — |

The repo's price line (US$145, A$210.14 at 0.69, "not re-checked on 7 November 2026") is now re-checked and stands; at today's Reserve Bank rate it is A$210.82.

Toradex's family page says the Luna is sold "通过直销和分销渠道在全球范围内供应" (worldwide through direct sales and distribution channels), so distributor listings may appear once it leaves sample status. None was found today.

---

## 7. Risks for a security-sensitive, long-lived deployment

| Risk | Why it matters here | Evidence |
|---|---|---|
| **Sample status** | Toradex says a sample product "may change without prior notice" and its software "does not cover all functions". An approval written against today's board may not describe the board delivered next year. | product page status panel; release notes (section 4) |
| **Vendor kernel, no mainline** | Every kernel security fix depends on Synaptics rebasing or Toradex back-porting. A reviewer who asks "is the kernel a supported long-term kernel at current patch level?" gets "6.12.11 plus selected fixes". | section 3.2 |
| **Two vendors between you and a fix** | Synaptics maintains the board support; Toradex wraps it; support is a community forum. The one measured case took about 15 weeks. | section 3.3 |
| **No supported secure boot or documented hardening path** | Possible only by burning fuses with Synaptics' factory tools, unsupported by Toradex. | section 3.4 |
| **Closed first-stage firmware** | The pre-boot stage is a Synaptics-signed, encrypted binary; some trusted-world components are binary-only. It cannot be audited or rebuilt. | astra-security note |
| **Single source, twice over** | One board maker (Toradex), one variant, one chip maker (Synaptics), with no pin-compatible second source. A Verdin module can at least be swapped for another Verdin on the same carrier. | product page; family FAQ |
| **Short promised life** | 5 years against 15+ for Toradex modules, and no end date in writing. | section 4 |
| **Radio fitted by default** | The only variant carries Wi-Fi and Bluetooth; it is on a removable M.2 card, but removal should be confirmed with Toradex, and no regulatory compliance statement is published. | datasheet §1.5.5, §11.1 |
| **Documentation errors** | Contradictory temperature and memory figures in the datasheet; compliance and power sections empty. | section 2 |
| **May arrive blank** | First boot may need a PC, a jumper and Synaptics' flashing tool — not self-serve for a council technician. | getting-started guide |
| **Thin field history** | Released Q1 2026; forum threads show early users finding gaps (device-tree overlays, pin documentation, NPU support "in progress"). | Toradex community threads 30786 and 30051 (fetched via the summarising tool) |

### Who is Synaptics, and where is the chip made?

- **Synaptics Incorporated** — a United States company listed on Nasdaq ("Synaptics (Nasdaq: SYNA)", Toradex press release, fetched <https://www.torizon.io/news/toradex-synaptics-partnership>). Head office San Jose, California, and fabless — it designs chips and has others make them (snippet, from its annual report and company profiles).
- **The chip** is "manufactured by TSMC using 12nm FFC process", "approved for production as both consumer and industrial grade" — Synaptics' SL1680 Silicon Product Qualification Report, PN 527-002828-01 Rev F, May 2025 <https://cp.synaptics.com/cognidox/download/NR-156950-TR-7.pdf> (fetched). TSMC is the Taiwanese contract chip maker; which plant, and where the chip is packaged, is not stated.
- It comes in two grades: consumer (0 to 70 °C ambient) and industrial (−40 to 85 °C), part numbers ending `-T000-T` and `-H000-T`, "Available now" (Synaptics datasheet Table 105 and operating-conditions table, fetched). Which grade the Luna uses is not stated; −25 to +85 °C implies the industrial one.
- The SL1680's family tree is the "Berlin" set-top-box chip line: mainline Linux files it under `dts/synaptics` as "Berlin SoC Family", and its vendor drivers are named `syna,berlin-*`. Synaptics bought that line from Marvell (memory: 2017 — not checked). The sister chip VS680 is sold in consumer media boxes and the Banana Pi BPI-M6.
- **Toradex** — Toradex AG, "Ebenaustrasse 10 · 6048 Horw · Switzerland" (datasheet footer, fetched). Its site banner reads "MADE IN USA & ITAR-COMPLIANT MANUFACTURING OPTIONS – CONTACT US" (fetched, toradex.cn). Where the Luna itself is assembled is not stated.

---

## 8. Set beside the Verdin AM62 (only what these pages show)

| | Luna SL1680 | Verdin AM62 |
|---|---|---|
| Torizon release-note status | "Sample products" — evaluation and development | "Volume products … intended to be used in production" |
| Kernel and board support | Synaptics' ("built and maintained by the SoC vendor") | Toradex's own BSP |
| In Toradex's Secure Boot table | No | Yes ("Verdin AM62", with "Secure Boot on AM62x-Based Devices" guide) |
| Kernel-flaw fix in the 2026 example | 28 Aug – 2 Sep 2026 | 6 Aug 2026 |
| Stated lifetime | 5 years (family) | "15+ years of life-cycle for all our computer modules" |

Sources: release notes 7.6.1, 7.6.2, 7.7.0; Secure Boot page; long-term-availability page; Luna family page (all fetched, cited above). The Verdin's own claims are another report's job; this table only shows the gap between the two tiers on the same Toradex pages.

---

## 9. Could not confirm

- **The English wording on toradex.com** of the product page, the 5-year commitment, the intended-use line and the life-cycle definitions: `www.toradex.com` and `toradex.com` returned HTTP 403 to automated reading. Read on `www.toradex.cn` instead; the Chinese text may be a machine translation of the English.
- **Stock and lead time at Toradex** — not in the page source; the shop listing is drawn by script.
- **Courier cost to Australia, and whether GST is collected at the border** — not found. The ordering page read is the China one.
- **Any Australian stockist.** element14 Australia (`au.element14.com`, HTTP 503) and Mouser (`mouser.com`, HTTP 503) could not be read automatically. DigiKey Australia returned no results.
- **A real benchmark of the Luna or any SL1680 board.** `openbenchmarking.org` (a Phoronix result for a "Synaptics VS680 EVK" on Debian 12, kernel "5.4.195-legacy-vs680") and `browser.geekbench.com` both returned HTTP 403. `cool-web.de` returned HTTP 503. No sbc-bench entry exists for SL1680 or VS680.
- **Measured power draw** — Toradex: "currently in progress". The repo's 4.5 W is an estimate.
- **Whether a heatsink is supplied or needed, and thermal throttling behaviour.**
- **Whether the clock battery is supplied.** The datasheet describes only a connector.
- **Which Wi-Fi/Bluetooth chip is on the M.2 card**, and whether a variant without it will be sold.
- **Regulatory compliance (RCM for Australia, CE, FCC)** — datasheet: "TBA".
- **How long security updates will be issued for the Luna** — neither Toradex nor Synaptics states a term.
- **Exact kernel in the 7.7.0 release image.** The build manifest pins Synaptics' layer at the commit whose recipe is 6.12.11, and a user's 7.5.0 board reported 6.12.11; I did not unpack the 846 MiB image to read its version string.
- **Whether secure boot with the owner's keys works on a Luna as shipped**, and whether Toradex will support it.
- **Which silicon grade (consumer or industrial) the Luna uses**, and where the board is assembled.
- **Synaptics' longevity commitment for the SL1680 chip** — none found.
- **The year Synaptics bought the Berlin chip line from Marvell** — from memory only.
- **Publication years of the Astra SDK releases** — GitHub shows day and month only (v2.6.1 "13 Oct", v2.1.0 "16 Dec"); years inferred from asset timestamps and version order.
- **The GitHub repository `synaptics-astra/factory`** (the fuse and signing tools) — this session's proxy would not open it; its existence rests on the link in Synaptics' guide.

## 10. Questions to put to Toradex before spending more time on it

1. When does the Luna SL1680 move from sample to volume, and will the hardware change when it does?
2. Is the 5-year commitment hardware supply only, or does it include security updates? From what date does it run?
3. Will Torizon Secure Boot cover the Luna? If not, does Toradex support owner-key secure boot through Synaptics' fuse process?
4. Will the Luna's kernel follow upstream 6.12 point releases, and how fast after a kernel security notice?
5. Is there, or will there be, a variant without the Wi-Fi/Bluetooth card? Is there an RCM declaration?
6. Measured power at full CPU load, and the largest sealed-box ambient temperature at which it holds 2.1 GHz.
7. Stock, lead time, and delivered cost to Australia; any Australian distributor planned.
