# R6: Industrial ARM computers, gateways and modules-on-carriers (not Raspberry Pi), checked 2026-11-11

Labels: **fetched** = page/PDF read by me; **snippet** = search result text only; **memory** = unchecked; **repo** = a statement in the owner's own repos (not independently verified).
Prices were attempted once per product, as instructed. Where there is no price, the seller and direct link are given.

## 1. The finding that matters most: CPU

Every non-Pi product in this class that is cheap and Debian-capable uses Cortex-A53 cores (i.MX 8M Plus 1.6-1.8 GHz, TI AM62 1.4 GHz, Moxa UC-3400A/4400A, Siemens IOT2050). The owner's own RPi_ALERT docs say "an A53 core at 1.4 GHz about half an A72's" (repo: /home/user/RPi_ALERT/docs/hardware.md line 211), and its builder model puts Pi 3/3B+ at 10-15% CPU for 4-5 busy channels against 5-7% on a Pi 4. By that rule:

| Part | Cores | Rough ratio to a Pi 4 (4x A72 1.5 GHz) | Basis |
|---|---|---|---|
| Moxa UC-4400A (1.6 GHz A53 x4) | 4 | about 0.55 | arithmetic from repo rule (half per clock x 1.6/1.5 x same core count); not benchmarked |
| CompuLab IOT-GATE-IMX8PLUS (1.8 GHz A53 x4) | 4 | about 0.6 | same |
| Moxa UC-3400A (1.4 GHz A53 x4) | 4 | Pi 3B+ class, about 0.45-0.5 | same |
| Siemens IOT2050 Advanced (AM6548 quad A53, clock not confirmed) | 4 | Pi 3B+ class or below | same |
| Toradex Verdin iMX95 (up to 6x A55) | 6 | not measured; A55 is faster per clock than A53 but well short of A72. Unknown, test it | no source |
| RK3588 / RK3576 boxes (A76 / A72 cores) | 8 / 6 | Pi 4 or better | memory; unverified |

So "Pi 4 class or better" from an off-the-shelf, IT-friendly, non-Pi box is NOT met by any A53 product. They match a Pi 3B+. That is enough only with RPi ALERT 0.17-0.19's lean/light decoder settings, and ALERT2 headroom is not shown. To get above a Pi 4 you leave the "industrial gateway" class (i.MX 95, RK3588/RK3576, TI AM69) and those have much weaker Australian availability and almost no security certification.

## 2. Product table

| # | Product | SoC / cores / clock | RAM / storage | USB host | Eth | DC in | Temp | TPM / secure boot | OS and patch life | Security cert | Maker, country | Source |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | **Moxa UC-4400A** (UC-4410A-T etc.) | Cortex-A53 x4 1.6 GHz (SoC not named on page; third-party sources say i.MX 8M Plus, unconfirmed) | 4 GB LPDDR4 / 16 GB eMMC + microSD | **1 x USB 2.0 Type-A** | 2 x GbE | 9-48 VDC redundant | -40 to 75 C (non-wireless) | TPM 2.0; hardware root-of-trust secure boot (secure variants) | Moxa Industrial Linux 3 (Debian 11, kernel 5.10, EOL 2031 per UC-3400A datasheet) or MIL4 (Debian 13, kernel 6.12, EOL 2035); apt-based Debian | **IEC 62443-4-2 SL2 only with MIL4 Secure** (CTO option); CE/FCC/UL; EN 18031-1 | Moxa, Taiwan; 5-yr warranty (UC-3400A datasheet) | fetched: https://moxa.com/Products/INDUSTRIAL-COMPUTING/Arm-Based-Computers/UC-4400A-Series |
| 2 | **Moxa UC-3400A** (UC-3420A-T-LTE etc.) | Cortex-A53 x4 1.4 GHz | 4 GB DDR4 / 16 GB eMMC + microSD | **1 x USB 2.0 Type-A** | 2 x GbE | 9-48 VDC, 10.8 W max | -40 to 70 C | TPM 2.0; HW root-of-trust secure boot | MIL3 (Debian 11, EOL 2031), MIL4 (Debian 13, EOL 2035) | IEC 62443-4-2 SL2 with MIL4 Secure; certificate link given in datasheet: https://certificates.iecee.org/#/deliverables/CERT/2180763/view (could not be read automatically); 5-yr warranty | Moxa, Taiwan | fetched datasheet v1.3: https://www.moxa.com/getmedia/8dd92a8f-a20f-489c-9066-28fd3c8116d4/moxa-uc-3400a-series-datasheet-v1.3.pdf ; product page https://moxa.com/Products/INDUSTRIAL-COMPUTING/Arm-Based-Computers/UC-3400A-Series |
| 3 | **CompuLab IOT-GATE-IMX8PLUS** | i.MX 8M Plus, A53 x4 1.8 GHz + M7 | 1/2/4/8 GB; 16-128 GB eMMC | **2 x USB 2.0 + 1 x USB 3.0** | 2 x GbE | 8-36 V, PoE-PD | 0-60 C or -40 to 80 C | TPM 2.0 only via optional add-on board; secure boot via NXP HAB | Debian, Yocto; 15-yr availability, 5-yr warranty | none found (FCC, CE, UKCA, EN 62368-1 only) | CompuLab, Israel | fetched: https://www.compulab.com/products/iot-gateways/iot-gate-imx8plus-industrial-arm-iot-gateway/ |
| 4 | **Siemens SIMATIC IOT2050 Advanced** (6ES7647-0BA00-1YA2) | TI AM6548 HS, quad A53 (clock not confirmed) | 2 GB DDR4 / 16 GB eMMC + SD | 2 x USB 2.0 (snippet, distributors) | 2 x GbE (snippet) | 12-24 VDC (snippet) | 0 to 50 C (snippet, one listing) | "prepared for secure boot" (U-Boot docs, fetched) | Siemens Industrial OS (Debian-based). Support end date NOT found | none found | Siemens, Germany | fetched: https://docs.u-boot.org/en/v2022.04/board/siemens/iot2050.html ; snippet: https://au.rs-online.com/web/p/iot-gateways/2017732 |
| 5 | **Advantech EPC-R3720** (box) | i.MX 8M Plus, A53 x4 1.6 GHz | up to 8 GB per model table (not read) | 1 x USB 3.2 + 1 x USB 2.0 on the dev kit datasheet; dev kit also lists 2 x USB 2.0 via an internal header | 2 x GbE | not read | -40 to 60 C (dev kit); -40 to 70 C (ALA series, snippet) | TPM not confirmed for the box | Yocto via AIM-Linux; no Debian image found | "IEC 62443-ready" claim only; no certificate found | Advantech, Taiwan | fetched (PDF): https://advdownload.advantech.com/productfile/PIS/EPC-R3720DK/file/EPC-R3720DK_DS(011525)20250115161016.pdf ; AU page: https://www.advantech.com/en-au/products/880a61e5-3fed-41f3-bf53-8be2410c0f19/epc-r3720/mod_fde326be-b36e-4044-ba9a-28c4c49a25c6 |
| 6 | **SolidRun HummingBoard IIOT / IIOT-200-8M gateway** | i.MX 8M Plus A53 x4 | up to 8 GB / 128 GB eMMC | 2 x USB 3.0 host + 1 OTG | 2 x GbE | 9-36 V (gateway) | -40 to 85 C (SBC) | TPM 2.0; Yocto and Debian BSPs | Debian BSP | none found | SolidRun, Israel | fetched: https://www.cnx-software.com/2024/11/20/solidrun-hummingboard-i-mx8m-iiot-sbc-and-the-iiot-200-8m-gateway-edge-ai-industrial-iot-applications/ (price and availability "not announced" at that 2024 date) |
| 7 | **Toradex Verdin iMX8M Plus on Mallow** (with Torizon OS or plain Debian) | i.MX 8M Plus, A53 x4 | 1/2/4/8 GB | Mallow ports not confirmed by me (repo says two USB 3 plus an M.2 B-key, repo-only) | not read | 7-24 V (repo-only) | -40 to 85 C module | module has an unpopulated TPM assembly option (fetched); secure boot via HAB | Torizon OS 7 (Debian 12, projected EOL 2028, per a snippet); Torizon OS 8 lifecycle NOT defined as of the support-strategy page updated 2026-10-13; BSP 8 "coming soon", November 2026, projected EOL 2030 | none found | Toradex, Switzerland; module availability "2036+" (snippet) | fetched: https://developer.toradex.com/hardware/verdin-som-family/modules/verdin-imx8m-plus/ ; https://developer.toradex.com/linux-bsp/in-depth/toradex-embedded-linux-support-strategy ; shop pages (toradex.com) returned 403, not read |
| 8 | **Toradex Verdin iMX95** | up to 6 x A55 + M7 + M33 | 8 GB variant | Mallow/Dahlia dependent | | | | | Torizon | | Toradex | fetched via search: https://developer.toradex.com/hardware/verdin-som-family/modules/verdin-imx95/ ; V1.0A samples limited by eMMC supply, memory shortages may affect availability (snippet of PCN https://docs.toradex.com/118589-pcn-00891000-verdin-imx95-hexa-8gb-wb-it-v1.0a.pdf) |
| 9 | **Robustel EG5120** | ARMv8, 1.5 or 1.6 GHz A53 (retailers disagree; SoC not confirmed) | 2 GB / 16 GB eMMC | 1 x USB (retailer listing) | 2 x GbE | not read | not read | not confirmed | RobustOS Pro, Debian 11-based (snippet) | none found | Robustel, China | snippet: https://www.cnx-software.com/2022/08/25/robustel-industrial-iot-gateways-run-debian-based-os-offer-5g-4g-lte-lorawan-connectivity/ . Maker datasheet URL gave 404; no Australian seller found |
| 10 | **Phytec phyBOARD-Pollux (i.MX 8M Plus)** | A53 x4 | | | | | | TPM on -3 board revision; Secure Boot, RAUC (release notes) | Yocto only; no Debian image found | none found | Phytec, Germany | snippet: https://download.phytec.de/Software/Linux/BSP-Yocto-i.MX8MP/BSP-Yocto-NXP-i.MX8MP-PD23.1.0/ReleaseNotes . Board/module, not a finished enclosure; no Australian seller found |
| 11 | **Variscite DART/VAR-SOM-MX8M-PLUS** | A53 x4 | | | | | | | Yocto and Debian Bookworm builds (Apr 2026 release); longevity 2036 (snippet) | none found | Variscite, Israel | snippet: https://www.variscite.com/system-on-module-som/i-mx-8/i-mx-8m-plus/dart-mx8m-plus/ ; no Australian seller found |
| 12 | **ASUS IoT PE100A** | older i.MX 8M (not Plus) | | | | | -20 to 60 C | TPM only as an add-on module | Yocto, Ubuntu server | none | ASUS, Taiwan | snippet: https://www.asus.com/networking-iot-servers/aiot-industrial-solutions/embedded-computers-edge-ai-systems/pe100a/ . Old and weaker; not recommended |
| 13 | **RK3588 / RK3576 boxes** (Nodka ABOX-6116, FutureIK Aetos Endura, Forlinx) | A76+A55 / A72+A53 class | | | | -20 to 70 C | | RK3576 box lists optional TPM 2.0 (snippet) | Debian 11/12 listed on one Nodka model | none | Chinese/other makers | snippet: https://nodka.com/products/fanless-control-cabinet-automation-pc/abox-3908/ . Only way found to get above Pi 4 CPU; weakest government-review story |

Not individually checked (time budget): Advantech UNO ARM/ICR, Kontron i.MX 8M Plus boxes, Wago, Phoenix Contact, Weidmuller, Welotec, Digi ConnectCore, TechNexion, Seeed non-Pi. A Kontron "AL i.MX8M Mini" (4 x A53 1.6 GHz, DIN-rail) surfaced in a search snippet only (https://www.kontron.com/en/products/al-i.mx8m-mini/p177212); i.MX 8M Mini is weaker than 8M Plus.

## 3. Rank for this job

Criteria: (a) likelihood of passing a government IT review, (b) CPU vs Pi 4, (c) price, (d) Australian availability.

1. **Moxa UC-4400A, ordered as MIL4 Secure.** Best on (a): the only product here where I found a named IEC 62443-4-2 SL2 certification (certificate on the IECEE site, claimed by Moxa; I could not open it). Moxa Industrial Linux is Debian 13 with a stated 2035 EOL. Three Australian sellers (Moxa distributor Colterlec, IP Trading, RS). Weak on (b): about 0.55 Pi 4, and **only one USB 2.0 port**, so two RTL-SDR sticks need an external powered hub (an extra part for the IT reviewer to accept). SL2 applies to the "Secure" CTO option, not the default MIL3 Standard, and the ordering route for a CTO in Australia is a quote.
2. **Moxa UC-3400A (MIL4 Secure).** Same security story; slower CPU (1.4 GHz), one USB; comes with LTE modem you may not need. Pi 3B+ class.
3. **CompuLab IOT-GATE-IMX8PLUS.** Best on (b)/(c) among finished boxes: 1.8 GHz, 3 USB ports (no hub needed), 15-year availability, evaluation kit price listed as US$655 (fetched, not the base price). Weak on (a): no 62443 certificate found, TPM is an add-on, Israeli maker. Australian seller: Touchpoint (quote only; B2B).
4. **Toradex Verdin iMX8M Plus on Mallow, Debian or Torizon.** Good module longevity and open BSP, but you build and certify an assembled device yourself; Torizon OS 8 support dates are unpublished; TPM not fitted by default; no Australian distributor found on Toradex's page (element14 Australia stocks modules, per snippet; its page returned 503).
5. **SolidRun IIOT-200-8M**, **Advantech EPC-R3720**, **Siemens IOT2050 Advanced**: viable, none has a named SL2 certificate that I found; the IOT2050 has a narrow temperature range and an unknown support end date; EPC-R3720 is Yocto-oriented.
6. **RK3588/RK3576 boxes**: only route to better-than-Pi-4 CPU in a fanless box, but weakest for government review and Australian support.

## 4. Router-style platforms (Cisco IR1101/IR1800 IOx, Cradlepoint, Teltonika)

Likely cannot host this workload. Reasons found:
- Cisco's IOx app hosting passes a USB *storage* path into a container, as a mounted volume (EXT2/EXT3 only), not a raw USB device (snippet: https://devicebase.net/en/cisco-catalyst-ir1100-rugged-series/updates/iox-access-to-usb-storage/3wz). rtl_sdr needs raw libusb access to an RTL2832U. I found no Cisco page showing arbitrary USB passthrough. IOx on IR1101 also has a small, low-power CPU and constrained RAM (memory; not confirmed here).
- Teltonika: Docker is an installable package on RUTC-series; the documented USB use is storage expansion; a community post says even RUTX11 could start very few containers for lack of memory (snippet: https://wiki.teltonika-networks.com/view/Docker_Configuration_Example and https://community.teltonika.lt/t/docker-support-on-rutx50-rutos-firmware/19371). No page on passing a USB radio into a container.
- Cradlepoint: nothing found.
The better IT-trust angle is a Moxa/Siemens-style device that is itself on the IT-approved vendor list, rather than a router.

## 5. Where to look in Australia (links to check price by hand)

- Moxa UC-4410A-T, IP Trading (Authorised Moxa Partner; "Request Quote", stock "Enquire", $0.00 placeholder price): https://www.iptrading.com.au/products/moxa-uc-4410a-t-arm-cortex-a53-quad-core-1-6-ghz-industrial-computer-2-ethernet-2-serial-1-can-4-di-4-do-40-to-75-c-lte-5g-wi-fi-6e (fetched, 2026-11-11). Also UC-4414A-I-T, UC-4434A-I-T and UC-3420A-T-LTE are listed on iptrading.com.au (search listing).
- Colterlec (Moxa accredited; phone 1300 36 26 26, sales@colterlec.com.au; lists UC-3400A and UC-4400A in its selection guide): https://colterlec.com.au/ (snippet).
- RS Australia lists some Moxa computers: https://au.rs-online.com/web/b/moxa (older UC models seen).
- CompuLab IOT-GATE-IMX8PLUS, Touchpoint ("Call for Details", 02 8424 3500, B2B): https://www.touchpoint.com.au/shop/compulab-iot-gate-imx8plus-industrial-iot-gateway/ (fetched). CompuLab direct: https://www.compulab.com/products/iot-gateways/iot-gate-imx8plus-industrial-arm-iot-gateway/
- Toradex: webshop toradex.com/order-now (403 to automated reading); element14 Australia lists module 00631101 (page returned 503): https://au.element14.com/toradex/00631101/com-1-6ghz-4gb-arm-cortex-a53/dp/4759323
- Advantech EPC-R3720: Digi-Key Australia dev kit EPC-R3720IQ-AWA12 (Windows on Arm kit, not the Linux part): https://www.digikey.com.au/en/product-highlight/a/advantech/epc-r3720iq-awa12-windows-on-arm-development-kit
- Siemens IOT2050: RS Australia https://au.rs-online.com/web/p/iot-gateways/2017732 (403 to automated reading).
- One price signal only: rspsupply.com shows UC-4410A-T $973.66 / $811.38 sale, currency not stated (snippet), https://rspsupply.com/p-831061-moxa-uc-4410a-t-arm-based-computer.aspx. Not trusted as AUD.

## 6. Could not confirm

- The IECEE certificate 2180763 contents (page is a script app; only its URL from Moxa's datasheet). Moxa's claim that MIL4 Secure models are IEC 62443-4-2 SL2 certified is from Moxa's own datasheet and product page, not the certificate. No IEC 62443-4-1 certificate (process) for Moxa was found; the Moxa pages do not mention it.
- The SoC inside Moxa UC-3400A/4400A (Moxa does not name it; "i.MX 8M Plus" appears only in third-party text for the 4400A).
- Whether the UC-4400A's single USB 2.0 port can power two RTL-SDR sticks through a hub (not tested).
- Any real benchmark of A53 vs A72 for this decoder beyond the owner's own "about half" rule. Web search gave no clean per-clock figure.
- Siemens IOT2050: official datasheet, clock speed, temperature, Industrial OS end of support. Siemens pages were not found by search; figures above are from distributors.
- Toradex: Mallow carrier specs (USB/Ethernet/power), Torizon OS 8 and its Debian version and EOL, Australian distributor, any price (toradex.com returns 403).
- Advantech EPC-R3720: power input, TPM, full model table; Australian reseller.
- Robustel EG5120: SoC, USB, temperature, certs (datasheet link 404); Australian seller.
- Kontron, Wago, Phoenix Contact, Weidmuller, Welotec, Digi, TechNexion, Seeed non-Pi, Cradlepoint: not researched.
- Prices in AUD for any product: none confirmed.
