# R10 - Custom hardware path and radio front end (read 2026-11-11)

Basis labels: fetched = page opened; snippet = search-result text only; memory = unchecked; estimate = my own reasoning, not sourced.
Per the owner's instruction, prices got one attempt per product. Where a page was unreadable, the seller and ordering link are given instead.

## 1. Module standards

| Standard / family | What was confirmed | Vendors / processors | Australia | Source (basis) |
|---|---|---|---|---|
| OSM (SGET) | Four sizes: 0 (30x15 mm, 188 pins), S (30x30, 332), M (30x45, 476), L (45x45, 662). Solderable (BGA/LGA) modules, not connectors. Spec version not stated on page (page dated 2024-02-23). Spec 1.2 and Design Guide 1.1 exist. | Size-S seen: Kontron (i.MX8M Mini), F&S (i.MX8MM), iesy (i.MX8MM), TQ (TI AM62Lx), Geniatech (i.MX95, 2026-01), Avnet, Aries, iWave | No Australian distributor found | https://sget.org/standards/osm/ (fetched, sizes); https://www.cnx-software.com/2026/01/15/geniatech-smarc-and-osm-system-on-modules-nxp-i-mx-95-soc/ (snippet); https://www.tq-group.com/en/products/tq-embedded/form-factors/osm/ (snippet) |
| SMARC 2.1 | Many vendors for NXP i.MX95: congatec, ADLINK, iWave, TQ, Advantech, Geniatech. Renesas RZ/G2L, RZ/V2L (Aries). MediaTek Genio 700/1200 (ADLINK, older). No TI AM62 SMARC found (search only). Toradex also sells SMARC (i.MX8M Plus, i.MX95). | NXP, Renesas, MediaTek, Intel (not checked) | No Australian stock found | https://www.eenewseurope.com/en/smarc-2-1-module-adds-nxp-i-mx95/ , https://www.tq-group.com/en/products/tq-embedded/cpu-families/arm-architecture/tqma95xxsa/ , https://www.futureelectronics.com/en/npi/toradex-smarc-system-on-modules-for-imx-8m-plus-imx-95 (all snippet) |
| Toradex Verdin | Proprietary but documented; Toradex publishes the family spec and carrier design guide. Modules: AM62, iMX8M Mini, iMX8M Plus, iMX95. Single-vendor module supply. | Toradex only | element14 Australia lists Verdin iMX8M Mini and dev board (no Toradex AU distributor on Toradex's list per search) | https://developer.toradex.com/hardware/verdin-som-family/carrier-boards/mallow-carrier-board (fetched); https://au.element14.com/toradex/00681100/com-2gb-1-6ghz-arm-cortex-a53/dp/4759325 (snippet) |
| Raspberry Pi CM4/CM5 | Large ecosystem; CM5 sold in 32 configurations. CM5 IO Board designed in KiCad, files downloadable. | Broadcom BCM2712 | Core Electronics lists CM5 variants (AUD inc GST: 2GB Lite $66.54 special, 8GB Lite $194.95; both out of stock when read, restock Dec 1-10); element14 AU CM5 dev kit about AUD 225 inc GST | https://core-electronics.com.au/raspberry-pi/boards/compute-module-5.html (page 403 for me; figures from search snippet) |
| CM4-connector clones | Radxa CM5 (RK3588S), Orange Pi CM5, Banana Pi BPI-CM5 Pro (RK3576, also ArmSoM-CM5). Only "mostly" compatible: Radxa CM5 needs the carrier to supply its own Ethernet PHY; dual HDMI not supported. Pin compatibility must be tested per carrier. | Rockchip | Not checked | https://www.cnx-software.com/2022/09/08/radxa-cm5-rockchip-rk3588s-module-raspberry-pi-cm4/ , https://www.cnx-software.com/2024/09/09/banana-pi-bpi-cm5-pro-rockchip-rk3576-raspberry-pi-cm4-alternative-with-up-to-16gb-ram-128gb-flash-a-6-tops-npu/ (snippet) |

Not covered: COM-HPC Mini, COM Express Mini, Qseven (no time; they are x86-oriented and likely oversized for this job). Pine64 SOQuartz not checked.

Reading: no single standard gives both "many vendors" and "cheap". SMARC has the widest vendor field but little Australian stock. OSM is the newest and smallest but solder-down only (not field-replaceable, awkward for a small outfit's first board). Verdin is documented but single-source.

## 2. Open carrier designs

- Toradex Mallow: Altium project, PDF schematics, assembly drawing, BOM, STEP/3D PDF are downloadable from the product page. Versions: V1.1A public Q3 2023; V1.1B Q3 2024; V1.1C Q4 2024. The posted files are labelled V1.1 and the BOM filename V1.1A, so they may lag the sub-revisions. No licence or commercial-use terms are stated on the page. (fetched: https://developer.toradex.com/hardware/verdin-som-family/carrier-boards/mallow-carrier-board)
- Toradex reference-design page lists Aquila, Verdin (Zinnia, Ivy, Ivy Plus, Mallow, Dev Board, Dahlia), SMARC dev board, Apalis, Colibri. Page says "We encourage our customers to use the reference designs as a starting point for any custom board design", but notes the Zinnia and Ivy schematics are "not intended to be copied or used as a reference design". No licence stated. Ask Toradex in writing before relying on it commercially. (fetched: https://developer.toradex.com/carrier-board-design/reference-designs)
- Raspberry Pi CM5 IO Board: KiCad ZIP on Raspberry Pi's site. Explicit licence text found only for the CM4 IO board (modified BSD); check the licence file in the CM5 zip. (snippet: https://www.raspberrypi.com/news/compute-module-io-board-hardware-designs/ ; https://pip.raspberrypi.com/categories/1098-design-files)
- Community CM5 carrier in KiCad: piecol/cm5_minima_rev3 (listing only, not examined). Eric Schlaepfer rebuilt a CM5 as KiCad (hackster article, snippet).
- BeagleBoard, Olimex, open SMARC/OSM carriers: not checked.

## 3. Cost and time to a lawful product (Australia)

Sourced:
- ACMA: a supplier must show compliance, sign a declaration of conformity (own format allowed but must contain all of ACMA Form C02), keep records in English, and register on the national database before labelling with the RCM. Level 2 EMC items "need testing, and you can use a testing body". (snippet: https://www.acma.gov.au/step-2-show-your-product-complies , https://www.acma.gov.au/step-3-sign-and-keep-records ; both returned 503 when I tried to open them, so the text is from search snippets.)
- Standard for IT/multimedia equipment: AS/NZS CISPR 32 is on ACMA's mandated EMC standards list (snippet: https://www.acma.gov.au/sites/default/files/2026-07/ACMA-mandated%20EMC%20standards.pdf; direct fetch 503).
- Overseas entities cannot register as responsible supplier; the Australian importer or manufacturer is responsible (snippet: https://www.eess.gov.au/rcm/acma-requirements-use-of-rcm/).
- Accredited labs: EMC Technologies (NATA 5292; Keilor Park VIC, and a Seven Hills NSW site), C-PRAV Labs list CISPR 32 in scope (snippet: https://nata.com.au/accredited-organisation/melbourne-laboratory-emc-test-laboratory-5292-5285/).
- Contract manufacturers claiming prototype/NPI/low volume: Circuitwise (Sydney), Allegro Services (Sydney), Elemental Electronics, Precision Electronic Technologies, Alfatron (Vic), Entech Electronics (Adelaide, Melb, Syd offices), Rush PCB (Mitcham Vic), Hetech (Brisbane). Minimums and prices not published; need quotes. (snippet: https://circuitwise.com.au/ , https://www.digikey.com.au/en/design-services-providers/entech-electronics ; list from a vendor blog, low confidence)
- Toradex "free manufacturing" offer for Verdin iMX8M Mini designs exists on an older page; not verified as current (snippet: https://toradex.com/free-manufacturing-for-toradex-verdin-imx8m-mini-designs).

Estimates (mine, not sourced; treat as ranges to be replaced by quotes):
- Design (schematic + layout, module-based carrier, 4-6 layer): 150-400 engineer hours, AUD 15-60k if outsourced; 3-6 months with one or two respins.
- Prototypes: AUD 2-6k per spin (JLCPCB/PCBWay assembly cheaper but longer shipping and parts sourcing).
- Pre-compliance EMC plus formal CISPR 32 report: likely AUD 5-15k at an Australian lab (no Australian price found; the only figure found was a US 5-10k unspecified-currency estimate for FCC+CE).
- Electrical safety for ELV DC equipment: using a certified external DC supply avoids mains design; the carrier then falls mainly under EMC. Confirm with a lab. Not researched.
- Total NRE to first sellable units: about AUD 40-120k and 9-15 months. Low confidence.

## 4. Radio front end

| Option | What was confirmed | Fit for rtl_sdr-style capture | Australian source / link | Basis |
|---|---|---|---|---|
| RTL-SDR Blog V3 | Stays "in stable production" per the maker. Brand run by RTL-SDR.com; manufacturing partner not named. RTL2832U + R820T2, TCXO. | Yes (it is the RTL-SDR family; the agent already uses rtl_sdr) | Core Electronics V3 + dipole kit about AUD 195 inc GST (snippet): https://core-electronics.com.au/rtl-sdr-blog-v3-usb-dongle-with-dipole-antenna-kit.html ; Little Bird (SparkFun-branded) AUD 185.40, GST not stated, in stock: https://littlebirdelectronics.com.au/products/rtl-sdr-blog-v3-usb-dongle-with-dipole-antenna-kit ; Robot Gear special order AUD 161.95: https://www.robotgear.com.au/Product.aspx/Details/11408-RTL-SDR-BLOG-V3-USB-Dongle-with-Dipole-Antenna-Kit ; maker-listed Australian resellers: https://www.secomms.com.au/?s=rtl+sdr&post_type=product and https://hamshack.com.au/ | fetched (maker page + Little Bird), snippet (others) |
| RTL-SDR Blog V4 | End of line: Rafael R828D no longer made, last stock faulty. Maker says no more V4 production. Fakes warned about. | Was fine; now unavailable new | https://www.rtl-sdr.com/rtl-sdr-blog-v4-end-of-line/ | fetched |
| RTL-SDR Blog V4 Lite (R828S) | Limited edition from a stockpile (chip also out of production); needs driver update. Maker's buy page lists V4L as current. | Needs updated rtl-sdr driver; would be a risk for a pinned Pi image | https://www.rtl-sdr.com/buy-rtl-sdr-dvb-t-dongles/ | fetched |
| Nooelec NESDR SMArt v5 | Nooelec webstore SKU 100701; Amazon ID B01HA642SW. Australian stock unconfirmed; nooelec.com offers AUD display on some items. | Yes (RTL2832U family) | https://www.nooelec.com/store/nesdr-smart-sdr.html ; amazon.com.au search for B01HA642SW | snippet |
| Airspy R2 / Mini | R820T2 discontinued by Rafael; Airspy said production continues, Mini listing mentions R820T2 or R860. 12-bit, 10 MHz (R2) / 6 MHz (Mini) bandwidth in memory only. No Australian seller found. | Native sample capture via libairspy, not rtl_sdr; agent would need a new capture path | https://airspy.com/purchase/ (lists resellers, mostly UK/EU) | snippet |
| SDRplay RSP1B / RSPdx-R2 | RS Australia lists RSP1B in stock about AUD 412.49 ex GST (snippet; page 403 when I tried). SDRplay API is proprietary, closed source (licence copy on GitHub mirror); RSP1B needs API 3.14+, RSPdxR2 3.15+; SoapySDRPlay3 wrapper is separate. | Via proprietary API, not rtl_sdr; hard to justify for "open source as far as possible" | https://au.rs-online.com/web/b/sdrplay ; https://www.sdrplay.com/purchase/ | snippet |
| KrakenSDR | Five coherent RTL-SDR channels (cnx-software). Mouser UK GBP 563; Lab401 EUR 799; no Australian seller found. | Five RTL2832U tuners in one box: actually matches the 4-8 channel use but is a direction-finding product | https://lab401.com/collections/sdr/products/krakensdr ; https://crowdsupply.com/krakenrf/krakensdr | snippet |
| ADALM-Pluto | Core Electronics page says "retired"; element14 AU shows notify-me. | Libiio path, 20 MHz+ bandwidth, not rtl_sdr | https://core-electronics.com.au/adalm-pluto-sdr-active-learning-module.html ; https://au.element14.com/analog-devices/adalm-pluto/learning-module-plutosdr-3-8ghz/dp/4032976 | snippet |
| LimeSDR XTRX (mini PCIe), Mini 2.0 (USB) | Open hardware; Lime Suite NG is the open driver stack. XTRX USD 699 (2023 listing); Mini 2.0 USD 399 (2022). No M.2 XTRX confirmed. Overkill and costly for a 150 MHz narrowband job. | Via Lime Suite / SoapySDR | https://limemicro.com/news/lime-micro-opens-orders-for-the-limesdr-xtrx-an-open-hardware-mpcie-software-defined-radio | snippet |
| wavelet-lab uSDR / xSDR (M.2 2230) | uSDR USD 299 (2023). xSDR USD 549, crowdfund ended 2026-03-26, limited stock. Host libs MIT, gateware CERN-OHL-P-2.0. Linux PCIe kernel driver release unconfirmed. | SoapySDR; promising M.2 form but supply is crowdfund-scale | https://www.crowdsupply.com/wavelet-lab/xsdr | snippet |
| Ettus B200mini | Not found in results. | - | not checked | - |
| Discriminator audio into sound card; multichannel receiver chip | Not researched. | - | - | - |

Reading: for supply chain, the V3 is the only RTL-SDR Blog model still in "stable production" and Australian shops list it. All RTL tuner chips (R820T2, R828D, R828S) are Rafael parts that have been or are being discontinued, so any RTL-SDR-based design has a component-lifecycle problem that an IT reviewer can read in public. Nooelec is a US company with a long record and gets less "grey import" suspicion, but I have no Australian stock evidence. SDR chips with a vendor driver (SDRplay) or open driver (Lime, Pluto) cost 4-10x more.

## 5. Staged path (estimate-based; confirm with quotes)

Stage 0 (now): off-the-shelf computer already chosen by the other research threads, RTL-SDR Blog V3 or Nooelec NESDR sticks, USB hub, external 12 V supply. Keep the radio stage as a replaceable USB part; record the exact dongle model and rtl_sdr version in the image.

Stage 1 (decision: is there appetite for hardware liability?): a carrier on a CM5-class or Verdin module only if the off-the-shelf box fails an approval for a concrete reason (no wide DC input, no TPM, no watchdog, no surge protection, no battery-backed clock). Start from the Toradex Mallow design (get written permission) or the Raspberry Pi CM5 IO KiCad design.

Per-unit carrier cost (estimate, excluding module, radio and NRE amortisation): 10 units AUD 150-300, 50 units AUD 90-180, 250 units AUD 60-120. Add the module (CM5 8GB Lite about AUD 195 inc GST as read; Verdin price not obtained) and the radio. NRE AUD 40-120k, spread: at 10 units this dominates; at 250 it is roughly 160-480 per unit. Low confidence.

Decision points: (1) Did off-the-shelf pass the IT/security review? If yes, stop. (2) Is a supplier willing to be the RCM responsible supplier? (3) Does Toradex or Raspberry Pi permit commercial reuse of their reference files? (4) Is a V3-class RTL stick still buyable at the time of order, or does the design move to a different radio?

## Could not confirm

- Any licence text covering Mallow/Dahlia/Verdin Dev Board files (page states none).
- Whether the posted Mallow files match V1.1B/C.
- Current prices and stock for: Nooelec in Australia, Airspy in Australia, SDRplay at RS (403), Core Electronics pages (403), Ettus B200mini, KrakenSDR in Australia, Radxa/Orange Pi/Banana Pi modules, Verdin modules.
- ACMA compliance level assigned to a computer with a receive-only radio, record retention period, and whether the receive-only radio brings in extra standards. ACMA pages returned 503 each attempt; only snippets seen.
- Electrical-safety rules for ELV DC equipment.
- Real Australian contract-manufacturer minimums and EMC lab prices.
- COM-HPC Mini, COM Express Mini, Qseven, Pine64 SOQuartz, BeagleBoard, Olimex.
- Exact date of the RTL-SDR Blog V4 end-of-line post (page undated; press says May 2026 in a snippet).
- Whether SGET OSM spec 1.2 date and current member list.
