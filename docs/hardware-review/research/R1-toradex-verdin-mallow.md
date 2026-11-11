# R1 — Audit of the Toradex Verdin AM62 + Mallow proposal

Read on 2026-11-11. Every row names the page opened and how it was read:

- **fetched** — I read the page or the PDF itself.
- **snippet** — search-result text only; the page itself refused automated reading.
- **memory / estimate** — not checked against a source, or my own arithmetic on fetched figures.

Exchange rate used throughout: **A$1 = US$0.6878** (Reserve Bank of Australia, 11 Nov 2026 — fetched, <https://www.rba.gov.au/statistics/frequency/exchange-rates.html>).

## 0. Which sites could be read

| Site | Result |
|---|---|
| `www.toradex.com` | Refused (HTTP 403). Not retried. |
| `www.toradex.cn/en/...` | Toradex's own China-domain site. Serves the same English product pages, prices in US$, footer "Toradex Inc., 719 2nd Ave, Seattle". Allowed reading. **All "Toradex direct" prices below come from here.** I could not prove `toradex.com` shows the same figures today; the distributor prices in §3 agree with them. |
| `developer.toradex.com`, `docs.toradex.com`, `community.toradex.com` | Readable. Datasheets downloaded and read as text. |
| `au.element14.com`, `au.mouser.com`, `www.futureelectronics.com`, `www.arrow.com`, `octopart.com`, `www.avnet.com` | Refused (connection reset, 403, 400 or 503). Search snippets only. |
| `www.digikey.com.au` | Readable. |
| `abf.gov.au`, `ato.gov.au` | Refused (403). Search snippets only. |

## 1. What should change a decision

1. **The module's price has roughly tripled.** Toradex's own page now lists the Verdin AM62 Quad 2GB WB IT at **US$306.00** for 1–99 (about A$445 before freight), not US$107.40. The claim "Toradex direct is a third of element14's price" compares an old Toradex price with a current element14 price. element14's A$514.73 is Toradex's current price plus about 16 %, the same margin element14 took on the old price (A$187.47 on US$107.40). So there is no cheap direct route any more.
2. **A working set (Quad + Mallow + heatsink) is about A$612 before freight from Toradex (A$673 with 10 % added), and about A$750–800 inc GST through Mouser or element14** — for a computer the repo rates at half a Raspberry Pi 4.
3. **The heatsink part number in the repo is the wrong one.** 23111001 (Type 1 V1.0B) is marked by Toradex "Not compatible Verdin AM62" and is in Last Time Buy. The one for the AM62 is **23111101** (Type 1 V1.1B; V1.1A is 23111100), US$14.40.
4. **With a Verdin AM62, Mallow's two "USB 3" sockets run at USB 2.0 speed, and the M.2 slot has no PCIe.** The AM62 has one USB 2.0 host port and one USB 2.0 OTG port and its PCIe pins are not connected. Every stick on the Type-A sockets and the M.2 slot shares one USB 2.0 bus. RTL-SDR sticks are USB 2.0 devices, so this works, but it is not what the repo's blurb says.
5. **If the owner stays with Verdin + Mallow, the module to look at is the Verdin iMX95 Hexa 4GB ET (0227): US$337.50**, only US$31.50 more than the AM62 Quad, with six Cortex-A55 cores at 1.8 GHz (roughly 2.3 times the AM62 Quad on paper — an estimate), 4 GB RAM, 32 GB eMMC, real USB 3.2 and PCIe, and a 2039 supply commitment. Its datasheet is still marked "Preliminary" and Toradex has not published power figures.
6. **Mallow does have a TPM 2.0 chip and a clock-battery holder**; the module has the clock chip itself. Secure boot is documented for the AM62 (TI HS-FS parts, fused once with TI's key writer), but Toradex staff said on 10 Nov 2026 that it "is still an Early Access feature" on Torizon OS, fusing is one-way, and fusing "at scale is not available yet for AM62".
7. **Mallow's design files are free but not open-source licensed.** PDF schematics and the BOM download directly and say "Copyright © Toradex AG. All rights are reserved." The Altium project sits behind a contact form and an "Agree & Download" step. The published set is V1.1 / V1.1A (2023); the board on sale is V1.1C.
8. **Toradex has no Australian office.** Its distributor page lists Arrow Electronics and Future Electronics offices in Australia, plus Farnell (element14), Mouser and Avnet globally.

## 2. Verdin AM62 variants (item 1)

Part numbers in the repo are right. Current revision of each, from Toradex's revision history (fetched, <https://developer.toradex.com/hardware/verdin-som-family/modules/verdin-am62/>):

| Product | Current part number | Version, release | Repo lists |
|---|---|---|---|
| Quad 2GB WB IT | 00761200 | V1.2A, Q3 2024 | 00761200 ✓ |
| Dual 1GB WB IT | 00751201 | V1.2B, Q3 2026 (eMMC changed to Macronix) | 00751201 ✓ |
| Dual 1GB IT | 00741201 | V1.2B, Q4 2026 (eMMC changed to Macronix) | 00741201 ✓ |
| Dual 1GB ET | 00731200 | V1.2A, Q3 2024 | 00731200 ✓ |
| Solo 512MB WB IT | 00721201 | V1.2B, Q3 2026 | 00721201 ✓ |
| Solo 512MB | 00711200 | V1.2A, Q3 2024 | 00711200 ✓ |

Specifications, from the Verdin AM62 V1.2 datasheet Rev. 0.9 dated 04-Nov-2026 (fetched, <https://docs.toradex.com/116792-verdin_am62_datasheet.pdf>, Tables 1–5):

| | Quad 2GB WB IT | Dual 1GB WB IT | Dual 1GB IT | Dual 1GB ET | Solo 512MB WB IT | Solo 512MB |
|---|---|---|---|---|---|---|
| TI chip | AM6254xTCGHAALW | AM6252xTCGHAALW | AM6252xTCGHAALW | AM6232xTCGHAALW | AM6231xSGGHAALW | AM6231xKGGHHALW |
| Cortex-A53 cores | 4 | 2 | 2 | 2 | 1 | 1 |
| A53 clock | 1.4 GHz | 1.4 GHz | 1.4 GHz | 1.4 GHz | 1.0 GHz | 1.0 GHz (Toradex's web page says 800 MHz) |
| RAM (LPDDR4) | 2 GB | 1 GB | 1 GB | 1 GB | 512 MB | 512 MB |
| eMMC | 16 GB | 8 GB | 8 GB | 4 GB | 4 GB | 4 GB |
| Wi-Fi / Bluetooth | yes | yes | no | no | yes | no |
| Temperature | −40 to +85 °C | −40 to +85 °C | −40 to +85 °C | −25 to +85 °C | −40 to +85 °C | 0 to +70 °C |
| USB | 1× USB 2.0 host, 1× USB 2.0 OTG — all variants | | | | | |
| PCIe | none: PCIE_1 pins "NC" — all variants | | | | | |

- "The A53 cores run at up to 1.4GHz" (datasheet §1.3, fetched).
- Dual 1GB ET low limit changed from −20 °C to −25 °C in Rev. 0.9 ("update operating temperature range indication for ET modules from −20°C to −25°C").
- The 800 MHz figure for the Solo 512MB is on <https://www.toradex.cn/en/computer-on-modules/verdin-arm-family/ti-am62> (fetched); the datasheet says 1.0 GHz. Unresolved.
- On-module clock: "The Verdin AM62 features a low-power Epson RX8130CE real-time clock" (datasheet §1.7.14).

**Product-lifetime commitment**

| Claim | Words | Source |
|---|---|---|
| Verdin AM62: 2033+ | "Product Availability 2033+", "Minimum Product Commitment 2033+" for all six variants | fetched, <https://www.toradex.cn/en/computer-on-modules/verdin-arm-family/ti-am62> |
| General policy | "We provide 15+ years of life-cycle for all our computer modules." | fetched, <https://developer.toradex.com/hardware/hardware-resources/general-product-information/long-term-availability/> |
| It covers the product, not a revision | "Toradex guarantees minimum availability for products - not for a specific version of a product." | fetched, <https://www.toradex.cn/en/support/intended-use-and-life-cycle> |
| Mallow: 2034+ | "Availability 2034+", "Min. Product Commitment 2034+" | fetched, <https://www.toradex.cn/en/products/carrier-board/mallow-carrier-board> |

From today, 2033 is **seven years** of committed supply for the module, not the twelve the repo's `lifeYears: 12` implies.

## 3. Price and stock (item 2)

### 3.1 Toradex direct — sample price, 1–99 units, US$

All fetched 2026-11-11 from Toradex's China-domain site (see §0). No tax, no freight.

| Item | Toradex number | US$ | A$ at 0.6878 | Page |
|---|---|---|---|---|
| Verdin AM62 Quad 2GB WB IT | 0076 | **306.00** | 444.90 | <https://www.toradex.cn/en/computer-on-modules/verdin-arm-family/ti-am62> |
| Verdin AM62 Dual 1GB WB IT | 0075 | 219.35 | 318.92 | same |
| Verdin AM62 Dual 1GB IT | 0074 | **206.25** | 299.87 | same |
| Verdin AM62 Dual 1GB ET | 0073 | 162.25 | 235.90 | same |
| Verdin AM62 Solo 512MB WB IT | 0072 | 159.40 | 231.75 | same |
| Verdin AM62 Solo 512MB | 0071 | 128.75 | 187.19 | same |
| Mallow carrier board | 0161 | **100.65** | 146.34 | <https://www.toradex.cn/en/products/carrier-board/mallow-carrier-board> |
| Verdin Industrial Heatsink Type 1 V1.1B | 23111101 | **14.40** | 20.94 | <https://www.toradex.cn/en/accessories/verdin-industrial-heatsink-type-1> |
| Mallow + AM62 Quad 2GB WB IT as one item | MAL-AM62-2GB-WB-IT | 406.65 | 591.23 | <https://www.toradex.cn/en/single-board-computers/mallow> |
| Mallow + AM62 Dual 1GB IT as one item | MAL-AM62-1GB-IT | 306.90 | 446.21 | same |

- The price sits in the page as `data-price="$306.00"` beside "Verdin AM62 Quad | 2GB Wi-Fi / Bluetooth IT | PN: 0076 … Sample Quantity | 1-99". It is marked not to appear in search results, which is why searches still surface old figures.
- Each "MAL-" price is exactly module + carrier (306.00 + 100.65 = 406.65; 206.25 + 100.65 = 306.90). The page does not say the pair arrives assembled, and lists the heatsink as a separate accessory.
- Volume (100 or more) is "Get Volume Quote" only.
- Older figures a search still returns from `toradex.com` — Quad US$107.40, Mallow US$107.50, heatsink US$13.75, MAL-AM62-1GB-IT US$287.50 — are **snippets of earlier page versions**. The repo's US$107.40 is one of them.
- I found no Toradex notice explaining the rise. Memory prices rose steeply through 2026 (snippet, general trade press); that is the likely cause but I could not tie it to Toradex.

**Does the webshop sell single units, and to whom?**

| Question | Answer | Source |
|---|---|---|
| Single units | Yes: the sample tier is "1-99". | fetched, product pages above |
| Who may buy | "In general, Toradex only accepts orders submitted by industrial Customers." "Customer: shall mean a legal entity or business". Terms marked "T&C US 20160425". | fetched, <https://www.toradex.cn/en/order-now/general-terms-conditions> |
| Account | "Please login to your existing account or create a new account to process your order." Stock and the cart sit behind the login. | fetched, <https://www.toradex.cn/en/order-now/?q=0076*> |
| Payment | Order confirmation and prepayment request; bank transfer; "For smaller amounts, we accept payment by credit card." | fetched, <https://www.toradex.cn/en/order-now/how-to-order> |
| Dispatch | "Your goods will be Shipped Worldwide within 4 working days by express courier." Warehouses: "Seattle (USA), Gottmadingen (Germany), Horw (Switzerland), Bangalore (India) and Shanghai (China)". | fetched, same |
| Terms of carriage | "The Incoterms 2020 DAP is our default term. For certain countries or on customer request, we ship with FCA." | fetched, same |
| What the price leaves out | "Prices do not include additional costs such as insurance, shipping, handling, import or other duties". | fetched, terms page |
| Freight cost to Australia, transit days, stock | **Not published.** Shown on the order confirmation, after login. | — |

### 3.2 Distributors

None of these sites could be read directly except DigiKey. Dates of the snippets are unknown; several are plainly older than Toradex's price rise.

| Distributor | Quad 2GB WB IT (00761200) | Dual 1GB IT (00741200/01) | Mallow (01611102) | Heatsink | Basis |
|---|---|---|---|---|---|
| **element14 Australia** | Order code 4852670. Two figures: **A$514.73 ex GST** (repo, read 2 Nov 2026) and **A$187.47 ex GST / A$206.22 inc** (search index). See §3.3. NZ site: NZ$480.33 ex, "4 total stock", UK stock 3–5 business days. | Order code 4759329 (00741200): A$152.97 ex / A$168.27 inc, "Available to Order" — likely an old price | Order code 4759350: A$176.09 ex / A$193.70 inc (repo has A$165.74). NZ site: "Manufacturer Standard Lead Time: 14 week(s)" | Not found | snippet — <https://au.element14.com/toradex/761200/com-2ghz-32gb-arm-cortex-a72-r5f/dp/4852670>, <https://au.element14.com/c/industrial-sbcs-embedded-systems/boards-compute-modules?silicon-family-name=verdin-am62&brand=toradex>, <https://au.element14.com/toradex/01611102/carrier-board-mallow/dp/4759350> |
| **Mouser Australia** | No AU figure found. Other Mouser sites: ₹28,701.30 (India, "17 on order"); US$338.82 on a Mouser-fed shop page | Only the Dual 1GB **ET** found: US$203.99, stock 0, 12-week factory lead time | US$108.72, in stock (mouser.com; may be old) | 23111100: US$22.59 (may be old) | snippet — <https://au.mouser.com/c/?m=Toradex>, <https://www.mouser.in/en/c/embedded-solutions/computing/?m=Toradex>, <https://www.electromaker.io/shop/product/verdin-am62-quad-2gb-wb-it>, <https://www.mouser.com/ProductDetail/Toradex/Mallow?qs=2FehpBK1j95pV%2F1Wi155gA%3D%3D>, <https://www.mouser.com/c/thermal-management/?m=Toradex> |
| **DigiKey Australia** | Search for "toradex verdin am62": "did not return any results" | Listing 741200: "This product is no longer available at DigiKey" (was a Marketplace item from carriertronic GmbH) | Not listed | 23111001: "This product is no longer available at DigiKey" | **fetched** — <https://www.digikey.com.au/en/products/result?keywords=toradex%20verdin%20am62>, <https://www.digikey.com.au/en/products/detail/toradex-ag/741200/28022864>, <https://www.digikey.com.au/en/products/detail/toradex-ag/23111001/28022861> |
| **RS Australia** | No Toradex listing found by search. Not on Toradex's distributor list. | — | — | — | snippet (search only) |
| **Arrow** | Named by Toradex as its distributor in Australia. No AM62 or Mallow price found; a Verdin Development Board showed US$348.36, 5 in stock. | — | — | — | snippet — <https://www.arrow.com/en/manufacturers/t/toradex-ag.html> |
| **Future Electronics** | Two figures: US$131.91 and US$309.63 for one; 5 in stock; lead time 12 or 26 weeks | — | US$118.13 and US$136.44 for one | — | snippet — <https://www.futureelectronics.com/p/7205766>, <https://www.futureelectronics.com/p/4194871> |
| **Avnet (Americas)** | US$264.53 for one, 10 in stock | — | — | — | snippet — <https://www.avnet.com/americas/product/toradex/00761200/evolve-121379054> |

One Mouser listing (Verdin iMX95, mouser.co.uk) carries the note that the product is "available only to OEM/EMS and design business customers" (snippet). I could not see whether Mouser applies that to the AM62.

### 3.3 What element14 order code 4852670 really is

| Finding | Evidence |
|---|---|
| It is Toradex part 761200 / 00761200, the Verdin AM62 Quad 2GB WB IT. | URL slug `/toradex/761200/…/dp/4852670`; the listing's overview reads "00761200 is a Verdin AM62 Quad 2GB WB IT V1.2A System on Module (SoM)" — snippet |
| Its title and attribute table are wrong. | Swiss Farnell page title: "00761200 TORADEX, Computer-on-Module, AM69A98, Familie Aquila AM69"; URL slug "com-2ghz-32gb-arm-cortex-a72-r5f" — snippet, <https://ch.farnell.com/toradex/761200/com-2ghz-32gb-arm-cortex-a72-r5f/dp/4852670> |
| The A$514.73 price is for the Verdin AM62, not an Aquila AM69. | A$514.73 ÷ (US$306.00 ÷ 0.6878) = 1.16. The older A$187.47 ÷ (US$107.40 ÷ 0.66) = 1.15. Same margin on Toradex's price both times — my arithmetic on the figures above. |
| So A$187.47 is the old price and A$514.73 the current one. | Inference. **A person should open the page to confirm**, and confirm the item shipped is the AM62, since the title is wrong. |

## 4. Australian distributor, office and lead time (item 3)

| Claim | Words | Source |
|---|---|---|
| No Toradex office in Australia | Offices listed: Toradex AG (Europe); Toradex Inc., Toradex Brasil, Toradex Solutions Inc. (Americas); Toradex Systems Bangalore and Delhi, Toradex (China), Toradex Japan K.K. (Asia Pacific) | fetched, <https://www.toradex.cn/en/distributors> |
| Arrow Electronics is listed for Australia | Norwest NSW (+61 2 9868 9900, sales.australia@arrow.com); Brisbane; "Level 1, 1 Tonsley Boulevard, Cloverly Park, South Australia 5042" (+61 8 8193 2400); Bayswater North VIC (+61 3 9737 4900) | fetched, same |
| Future Electronics is listed for Australia | Thebarton SA; Wantirna South VIC (+61 3 9262 0600); Silverwater NSW | fetched, same |
| Global distributors named | Arrow, Avnet, Future Electronics, Farnell, Mouser, DATA MODUL. DigiKey and RS are not named. | fetched, same |

Lead time, as far as it could be read:

- Toradex direct: dispatch "within 4 working days by express courier" when in stock; transit time to Australia not stated (fetched, how-to-order page).
- element14: stock is held in the UK, "3-5 Business Days"; factory lead time 14 weeks (snippet, NZ site).
- Mouser: 12-week factory lead time on a Verdin AM62 listing with no stock (snippet).
- Future: 12 or 26 weeks (snippets disagree).

## 5. Mallow carrier board (item 4)

From the Mallow V1.1 datasheet Rev. 1.10 dated 06-Oct-2025 (fetched, <https://docs.toradex.com/116791-mallow_carrier_board_datasheet.pdf>) unless noted.

| Question | Answer | Words |
|---|---|---|
| Power input | 7–24 V DC ±10 % on a Phoenix Contact header | "Nominal input voltage can vary from 7V - 24V ±10%." Connector X6 "Phoenix Contact 1995787"; mate "Phoenix Contact 1805410, Phoenix Contact 1847055 (Alternate Part)". Table 2 of the same datasheet says "Power Input: 7 - 27V ±10%" — an inconsistency; use 7–24 V. |
| USB sockets | Two USB 3 Type-A host sockets through a hub; one USB-C socket, USB 2.0 only | "2x USB 3.1 Gen 1 Host ports (with USB Type-A connectors) through the on-board USB hub"; "1x USB 2.0 Dual-Role-Port (DRP)". "The supported level of USB 3.x depends on the SoM being used". Hub: Microchip USB5744; "Port 3 is routed to the M.2 connector (X17), and Port 4 of the USB hub is disabled." |
| USB speed with an AM62 | USB 2.0 | Toradex's own table gives "USB: 2.0" for every MAL-AM62 item and "3.1"/"3.2" for the iMX8M Plus and iMX95 ones (fetched, <https://www.toradex.cn/en/single-board-computers/mallow>) |
| M.2 slot | Key B, with one PCIe lane, USB 2.0/3.0 and SIM | "M.2 Key B slot … PCI Express 1 lane, USB 2.0/3.0, SIM card". With an AM62 the PCIe column is "-" (no PCIe). |
| Clock battery holder | Yes | "1x CR1025 Battery Holder for the Verdin VCC_BACKUP supply"; "compatible: CR927 and CR1025"; holder Keystone 3030 |
| TPM | Yes, TPM 2.0 on the board | "1x TPM 2.0"; reference to Infineon OPTIGA SLM 9670. V1.1 schematic: "The TPM device IC12 (SLM9670AQ20FW1311XTMA1) … have been added"; parts list on the TPM page names ST33KTPMI3W10001 as "Recommended part" with ST33KTPMA3W10001 and the SLM9670 as alternates (fetched, <https://docs.toradex.com/113762-mallow-v1.1-pdf-schematics.zip>). Which chip is on a V1.1C board: not confirmed. |
| Other secure element | None listed | — |
| Temperature | Datasheet: "designed to operate within a temperature range of -40 °C to +85 °C", with SD card holder −25, HDMI −30, push buttons and LVDS connector −35. Product page: "-25° to 85° C". | fetched |
| Fits which modules | "compatible with the entire family of the Verdin system-on-modules" | fetched |
| Current version | 01611102 = V1.1C, Q4 2024 | fetched, <https://developer.toradex.com/hardware/verdin-som-family/carrier-boards/mallow-carrier-board/> |
| Known faults | Two, both fixed by V1.1C (bent power connector; HDMI EDID) | fetched, <https://docs.toradex.com/115277-mallow_carrier_board_errata.pdf> |

**Design files**

| Claim | Evidence | Basis |
|---|---|---|
| Toradex says they are published | "CAE data for the board, including schematics, layout, and IPC-7351 compliant component libraries, are freely downloadable"; product page heading "Open Source Hardware — All the Design Data is available, including Altium Design Files, Schematics, and Bill of Material (BOMs)" | fetched, datasheet §1 and §5; <https://www.toradex.cn/en/products/carrier-board/mallow-carrier-board> |
| Where | <https://developer.toradex.com/carrier-board-design/reference-designs/> → Altium project `113761`, PDF schematics `113762`, assembly drawing `113763`, BOM `113764` on docs.toradex.com | fetched |
| PDF schematics and BOM download directly | 1.1 MB and 69 kB zip files, downloaded | fetched |
| The Altium project does not | The link returns a page: "Complete the short form below to download the files. Please provide a few details about your project and organization", then an "Agree & Download" button that posts `agree-with-eula = Yes`. I did not fill it in. | fetched, <https://docs.toradex.com/113761-mallow-v1.1-altium-project.zip> |
| Licence | **No open-hardware licence is named anywhere I could read.** The ReadMe in both zips says "Copyright © Toradex AG. All rights are reserved." The EULA text behind the form was not seen. | fetched |
| Version published | "Mallow V1.1" schematics (15 Sep 2023) and "Mallow V1.1A BOM" (7 Aug 2023). The board on sale is V1.1C with six component changes since. | fetched |

## 6. Heat and power (item 5)

Toradex's measurements, three modules per model, each pre-heated with a stress test (fetched, <https://developer.toradex.com/hardware/hardware-resources/power-consumption/verdin-am62-power-consumption/>). The page does not give the carrier board, the ambient temperature or whether a heatsink was fitted.

| Test | Quad 2GB WB IT, mean / peak W | Dual 1GB IT, mean / peak W |
|---|---|---|
| Idle, Ethernet up, no screen | 1.87 / 2.56 | 1.69 / 2.52 |
| One core stressed | 2.05 / 2.76 | 1.88 / 2.73 |
| All cores stressed | 2.50 / 3.49 (4 cores) | 2.08 / 3.19 (2 cores) |
| CPU NEON stress script | 3.08 / 4.06 | 2.30 / 3.44 |
| Everything at once incl. 5 GHz Wi-Fi | 3.12 / 5.19 | — |

These are module figures; Mallow's regulators, the hub and each RTL-SDR stick (roughly 1.5 W each — memory) come on top.

Thermal limits, Verdin AM62 Quad (datasheet Table "Thermal specification", fetched):

- "SoC junction temperature −40 … +105 °C"; "RθJA – junction-to-ambient thermal resistance 22.3 °C/W"; "RθJC 3.7 °C/W".
- Throttling starts at 95 °C and the board powers off at 105 °C. A Toradex field engineer: "By default, the passive and crtitical trip points are 95° and 105°" (fetched, post of 2026-04-13, <https://community.toradex.com/t/verdin-am62-power-off-due-to-thermal-protection-at-95-junction-temeprature/30266>).
- What happens in a hot place, same thread:
  - A customer's **single-core** Verdin AM62 Solo 512MB WB IT in a 55 °C chamber: "the junction temperature reached 95° and kept that value for a long time (around one hour) and then the thermal protection occurred".
  - The Toradex engineer's own test: "I tested the module in the climate chamber exactly at 55°C … for about 5 hours … I saw that the device went into shutdown only when I stressed the CPU and the junction temperature reached 105°C."
  - Neither post says whether a heatsink was fitted.

**Is a heatsink needed?** Toradex has no sentence saying so. The evidence and my arithmetic:

- Without a heatsink, if 2.0–3.1 W ends up in the chip: 22.3 °C/W × 2.0–3.1 W = 45–69 °C above ambient (my estimate). At 25 °C ambient that is 70–94 °C — under the 95 °C throttle point, with little to spare at the top of the range.
- At 55 °C ambient the two reports above show a loaded module reaching the throttle point and, under stress, powering off.
- With the Toradex heatsink (datasheet: "Module-Alu ∼2°C/W", "Alu-Ambient ∼7.5°C/W", both "Estimated"): about 9.5 °C/W × 3.1 W = 29 °C above ambient, so about 84 °C in a 55 °C cabinet (my estimate).
- So: on a bench it probably runs without one; **in an outdoor cabinet with every core busy, fit one** — a module that powers itself off is worse than one that slows down. The repo's "must" is reasonable for a field site; its stated reason ("the trial measures heat, not the processor") is unproven at room temperature.

**Which heatsink** (fetched, <https://docs.toradex.com/109465-verdin_industrial_heatsink_datasheet.pdf> Rev. 1.3 Table 4, and <https://www.toradex.cn/en/accessories/verdin-industrial-heatsink-type-1>):

| Part | Fits | State | Price |
|---|---|---|---|
| 23111001 — Type 1 V1.0B (**the repo's part**) | "Compatible with Verdin iMX8M Mini and Verdin iMX8M Plus." "Note: Not compatible Verdin AM62. Suitable for evaluation only with Verdin iMX95." | Last Time Buy, stock limited | US$14.40 |
| 23111100 — Type 1 V1.1A | "Verdin AM62 V1.1A and newer", iMX8M Mini, iMX8M Plus, iMX95 (datasheet Table 4). V1.1A added "new thermal interface material" and "extended compatibility to Verdin AM62 and iMX95". | superseded by V1.1B | — |
| **23111101 — Type 1 V1.1B** | "Compatible with Verdin iMX95, iMX8M Mini, iMX8M Plus and AM62." | Sample sales (released Q3 2026) | **US$14.40** |
| 23171100 — Type 2 V1.1A | "Compatible with Verdin AM62P." | Sample sales | US$14.40 |

It screws to the carrier's stand-offs: "four M2×10mm" screws, supplied.

## 7. Faster modules for the same carrier (item 6)

Toradex direct, 1–99 units, US$, fetched 2026-11-11 from the pages named. "On Mallow" columns are from Toradex's Mallow table (<https://www.toradex.cn/en/single-board-computers/mallow>). CPU relative to the AM62 Quad is **my estimate** (clock ratio; Arm's claim of +18 % for a Cortex-A55 over an A53 at the same clock — snippet, Arm blog). Nothing here is measured.

| Module (Toradex number) | CPU | RAM / eMMC | US$ | A$ | USB on Mallow | PCIe on Mallow | Supply commitment | CPU vs AM62 Quad (estimate) |
|---|---|---|---|---|---|---|---|---|
| Verdin AM62 Quad 2GB WB IT (0076) | 4× A53, 1.4 GHz | 2 / 16 GB | 306.00 | 444.90 | 2.0 | no | 2033+ | 1.0 |
| Verdin AM62P Quad 2GB WB IT (0099) | 4× A53, 1.4 GHz | 2 / 16 GB | 268.50 (worked out: MAL-AM62P-2GB-WB-IT 369.15 − Mallow 100.65) | 390.38 | 2.0 | no | 2033+ | 1.0 — no gain; needs the Type 2 heatsink |
| Verdin iMX8M Mini Quad 2GB IT (0059) | 4× A53, 1.6 GHz | 2 / 16 GB | 288.75 | 419.82 | 2.0 | yes | 2035+ | about 1.15 |
| Verdin iMX8M Plus QuadLite 1GB IT (0065) | 4× A53, 1.6 GHz | 1 / 8 GB | 226.20 | 328.87 | 3.1 | yes | 2036+ | about 1.15 |
| Verdin iMX8M Plus Quad 2GB WB IT (0064) | 4× A53, 1.6 GHz | 2 / 16 GB | 322.25 | 468.52 | 3.1 | yes | 2036+ | about 1.15 |
| Verdin iMX8M Plus Quad 4GB IT (0063 / 0237) | 4× A53, 1.6 GHz | 4 / 32 GB | 445.60 | 647.86 | 3.1 | yes | 2036+ | about 1.15 |
| **Verdin iMX95 Hexa 4GB ET (0227)** | **6× A55, 1.8 GHz** | 4 / 32 GB | **337.50** | 490.69 | 3.2 | yes | 2039 | **about 2.3** |
| Verdin iMX95 Hexa 4GB WB IT (0226) | 6× A55, 1.8 GHz | 4 / 32 GB | 408.50 | 593.92 | 3.2 | yes | 2039 | about 2.3 |
| Verdin iMX95 Hexa 8GB WB IT (0089) | 6× A55, 1.8 GHz | 8 / 32 GB | 627.50 | 912.33 | 3.2 | yes | 2039 | about 2.3 |
| Verdin iMX952 | 4× A55, 1.7 GHz; USB 2.0 only | — | not on sale ("Join Sample Waitlist") | — | — | — | 2041+ | — |
| Verdin iMX937 | "still in development" | — | not on sale | — | — | — | — | — |
| Verdin RK3568J | named "NEW" in the site menu; its link returns the family page | — | — | — | — | — | — | — |

Sources: <https://www.toradex.cn/en/computer-on-modules/verdin-arm-family/nxp-imx-8m-plus>, `/nxp-imx-8m-mini-nano`, `/nxp-imx95`, `/ti-am62p`, `/nxp-imx952`, `/nxp-imx937` (all fetched). Clocks: iMX8M Plus "1.6 GHz for industrial temperature range products" (fetched, <https://docs.toradex.com/116795-verdin_imx8mp_datasheet.pdf>); iMX95 "The A55 cores run at up to 1.8 GHz" (fetched, <https://docs.toradex.com/200007-verdin_imx95_datasheet.pdf>).

Notes on the iMX95:

- Datasheet Rev. 0.7 (20-Jul-2026) is headed "Preliminary – Subject to Change"; power consumption "will be available soon"; the web page says "Power Dissipation TBD".
- Hexa 4GB ET is −25 to +85 °C, no Wi-Fi. V1.1B of the 8GB part "Change SoC and PMIC to mass production version" (Q3 2026); the first version, 00891000, "is EOL and will not be shipped anymore" (fetched, <https://developer.toradex.com/hardware/verdin-som-family/modules/verdin-imx95/>).
- On the repo's own scale (AM62 Quad = half a Pi 4), 2.3 times is a little over one Pi 4. A whole-chip benchmark snippet puts four A72 cores at 1.9 GHz about 18 % ahead of four A55 cores at 1.8 GHz, which gives the same answer for six A55 cores: somewhere between 1.1 and 1.6 Pi 4s. Unmeasured.
- Secure boot: supported in Toradex's table (§8); re-signing the bootloader and kernel with TorizonCore Builder is "under development" for the iMX95.

## 8. Secure boot and device security (item 7)

| Claim | Words | Source, basis |
|---|---|---|
| TI chips come in two kinds | "General Purpose (GP) devices lack several security features and don't support secure boot." "High Security (HS) devices … support encrypted and authenticated (secure) boot." | fetched, <https://developer.toradex.com/torizon/security/secure-boot-on-am62/> |
| HS-FS is how TI ships them | HS-FS: "Device type before customer keys are programmed (the state in which the device leaves TI factory)." HS-SE: "Device type after customer keys are programmed. HS-SE devices enforce secure boot." | fetched, <https://software-dl.ti.com/tisci/esd/12_01_02/6_topic_user_guides/key_writer.html> |
| What changes at HS-SE | "An HS-SE device enforces secure boot, has a locked JTAG port, and engages firewalls between hardware modules." HS-FS: JTAG unlocked, secure boot not enforced. | fetched, <https://dev.ti.com/tirex/explore/content/am62x_academy_9_00_00_00_v1.new_id/_build_am62x_academy_9_00_00_00_v1/source/security/ti-overview.html> |
| Verdin AM62 modules carry HS-FS chips | Solo variants changed at V1.1B "to AM6231ASGGHAALW (SoC with HSFS - Secure SoC)". Quad and Dual chips end "…GHAALW" likewise. Datasheet Table 1 row "Security HSM": Yes for Quad and Dual, No for Solo. | fetched, developer page and datasheet. That every V1.2 Quad is HS-FS is my reading of the part number, not a Toradex sentence. |
| Fusing | TI's OTP Keywriter, loaded in recovery mode. "programming OTP (One-time Programmable) fuses is an irreversible process"; "errors can permanently damage the SoC". TI's tools need access approval that "usually takes 1-3 days". "The steps described here do not apply to Verdin AM62 V1.1 or earlier modules." | fetched, Toradex secure-boot-on-AM62 page |
| What Toradex supports on the AM62 (Torizon OS 7) | Bootloader authentication ✅, bootloader hardening ✅, kernel FIT image authentication ✅, root filesystem authentication ✅, container image authentication 📅 (planned). TorizonCore Builder can re-sign bootloader, kernel and root filesystem. | fetched, <https://developer.toradex.com/torizon/security/secure-boot-on-torizoncore/> |
| Low-level features need a Yocto build | OP-TEE, TPM and data encryption come from meta-toradex-security and are "available to Yocto users only." | fetched, same |
| Limits Toradex staff stated on 2026-11-10 | "Secure boot on Torizon OS is still an Early Access feature." "Fusing through an update or at scale is not available yet for AM62." "If the SMPK private key is lost, there is no recovery." "Verdin AM62 V1.2 and newer generate VPP with an LDO on the module". "Dahlia works for this, and V1.2 modules have been fused on it." Of the backup-key switch: "We have not validated the switch on Verdin AM62." Mallow is not mentioned. | fetched (raw thread, user diegom.tx, marked staff), <https://community.toradex.com/t/verdin-am62-v1-2-secure-boot-otp-key-programming-dahlia-torizon-os/30956> |
| TPM on the module | Optional, build-to-order: "The Verdin AM62 can be assembled with a Trusted Platform Module (TPM 2.0), the ST33KTPM2I"; listed under "Build-To-Order (BTO) Options". Stock variants are not described as having it. V1.2A "Added compatibility for TPM 2.0 with possibility to use SPI via carrier board loopback or I2C on SoM". | fetched, datasheet §1.7.15 and §1.9; developer page |
| TPM on Mallow | Yes (§5). Mainline Linux has a "verdin-am62: mallow: add TPM device" patch; one user thread reports "TPM error (256)" on Mallow with an AM62, no confirmed fix. | snippet, <https://lkml.iu.edu/2402.0/07354.html>, <https://community.toradex.com/t/tpm-error-256-and-tpm-interrupt-not-working-on-spi-tpm-tpm-tis-spi-spi0-1/27711> |
| Software upkeep | "In-house BSPs, updated monthly"; "Four years of support per major BSP release"; "Security advisories and fixes for supported Linux BSPs and Torizon releases." | fetched, Toradex AM62 page |

## 9. What one working set costs landed in Australia

One set = Verdin AM62 Quad 2GB WB IT + Mallow + the right heatsink. No power supply, case, RTL-SDR sticks or battery.

GST on imports: goods with a customs value of A$1,000 or less are "free of duty and GST" at the border; over A$1,000 an import declaration and 10 % GST apply (snippet, ABF: <https://www.abf.gov.au/importing-exporting-and-manufacturing/importing/how-to-import/import-declaration>; ATO: <https://www.ato.gov.au/businesses-and-organisations/gst-excise-and-indirect-taxes/gst/in-detail/rules-for-specific-transactions/international-transactions/gst-and-imported-goods>). One set from Toradex is under that line, so no GST is collected; the "+10 %" column is there so the routes compare like for like.

| Route | Module | Carrier | Heatsink | Set, ex GST | Set, inc GST | Freight | Confidence |
|---|---|---|---|---|---|---|---|
| **Toradex webshop** (business account, prepaid, express courier) | US$306.00 | US$100.65 | US$14.40 (23111101) | US$421.05 = **A$612** | no GST under A$1,000; **A$673** if 10 % is added | not published; add it. Each US$50 is A$73. | prices high (fetched from toradex.cn); freight unknown |
| **element14 Australia** | A$514.73 | A$176.09 (repo: A$165.74) | not stocked — from Toradex or Mouser, about A$23–36 inc GST plus its own freight | A$690.82 + heatsink | **A$760** + heatsink ≈ **A$783–796** | element14's own delivery charge not confirmed | medium–low (snippets; module price needs a person to confirm) |
| **Mouser Australia** (AU prices not seen; US$ figures from other Mouser sites) | US$338.82 ≈ A$493 | US$108.72 ≈ A$158 | US$22.59 ≈ A$33 (23111100) | ≈ A$684 | ≈ **A$752** | not confirmed | low |
| **Future Electronics** (Toradex-listed for Australia) | US$309.63 ≈ A$450 | US$118.13–136.44 ≈ A$172–198 | not found | ≈ A$622–649 + heatsink | ≈ A$684–713 + heatsink | not confirmed | low |
| **Arrow Australia** (Toradex-listed) | no price found | — | — | — | — | — | — |
| **DigiKey Australia, RS Australia** | not stocked | — | — | — | — | — | DigiKey fetched; RS search only |

The same set with a different module, Toradex webshop, ex GST and before freight:

| Module | Set US$ | Set A$ | +10 % |
|---|---|---|---|
| Verdin AM62 Dual 1GB IT (0074) | 321.30 | 467 | 514 |
| Verdin iMX8M Plus QuadLite 1GB IT (0065) | 341.25 | 496 | 546 |
| Verdin iMX8M Mini Quad 2GB IT (0059) | 403.80 | 587 | 646 |
| Verdin AM62 Quad 2GB WB IT (0076) | 421.05 | 612 | 673 |
| Verdin iMX8M Plus Quad 2GB WB IT (0064) | 437.30 | 636 | 699 |
| **Verdin iMX95 Hexa 4GB ET (0227)** | 452.55 | **658** | **724** |
| Verdin iMX95 Hexa 4GB WB IT (0226) | 523.55 | 761 | 837 |
| Verdin iMX8M Plus Quad 4GB IT (0063) | 560.65 | 815 | 897 |

## 10. The repo's claims, checked

| Claim in open-ALERT (`site/data/compute.js`, `site/js/trial.js`) | Verdict |
|---|---|
| Part numbers 00761200, 00741201, 00751201, 00731200, 00721201, 00711200 | Right. |
| Quad: four cores at 1.4 GHz, 2 GB, 16 GB eMMC, −40 to +85 °C | Right. |
| "Toradex sells the same part direct … for US$107.40 (about A$171 inc GST)" | **Out of date. US$306.00 now.** |
| "element14 Australia charges A$566 inc GST for the module, three times Toradex's direct price" | The A$514.73 ex GST figure looks current; the "three times" does not hold. It is about 16 % over Toradex. |
| "Dual … A$40 less direct from Toradex" than the Quad | Out of date. US$99.75 less now (306.00 − 206.25). |
| "element14's listing is titled 'Aquila AM69' but describes this module" | Right. |
| Mallow: "7–24 V in" | Right. |
| Mallow: "two USB 3 ports" | Sockets yes; **USB 2.0 speed with any AM62.** |
| Mallow: "an M.2 B-key slot with USB 2.0" | Right for the AM62 (and no PCIe). |
| "Mallow's Altium files, schematics and BOM published" | Published, yes; Altium behind a form and an agreement; all rights reserved; V1.1/V1.1A, not the current V1.1C. Not an open-hardware licence. |
| Mallow "Toradex direct is about the same (US$107.50)" | US$100.65 now. |
| "Verdin Industrial Heatsink Type 1 — Toradex 23111001", US$15.60 | **Wrong part.** 23111001 is "Not compatible Verdin AM62". Use 23111101 (or 23111100), US$14.40. |
| "without a heatsink the module throttles" | Not a Toradex statement, and unproven at room temperature. At 55 °C a loaded module does reach the throttle point and can power off (§6), so fit one in the field. |
| "Verdin AM62 availability 2033+", `lifeYears: 12` | 2033+ is right; that is 7 years from now. |
| "Factory lead time 13 weeks" | Snippets say 12 to 14 weeks (Mouser, element14 NZ), 26 on one Future page. |
| "−40 to +85 °C" for the pair | Module yes. Toradex's product page rates Mallow −25 to +85 °C. |

## 11. Could not confirm

- **Live prices and stock at element14 Australia, Mouser Australia, Arrow, Future and Avnet.** Their sites refuse automated reading. Everything from them is search-result text of unknown date; two of them show two different prices for the same module.
- **That `www.toradex.com` shows the same US$ prices as `www.toradex.cn`.** The .com site refused (403). The distributor figures fit the .cn prices.
- **Toradex's freight charge to Australia, courier transit time and webshop stock.** Behind the login, or only on the order confirmation.
- **Whether Toradex will accept an order from a government agency or an individual.** The terms say "industrial Customers" and "a legal entity or business"; they are dated 2016.
- **When and why Toradex's prices rose.** No notice found.
- **The licence on the Altium project.** The agreement text sits behind a contact form I did not submit.
- **Whether a "MAL-…" item arrives as one assembled board**, and whether Australian distributors stock those items.
- **Which TPM chip is on a Mallow V1.1C**, and whether it works under Torizon OS with an AM62 without changes.
- **Whether every Verdin AM62 Quad V1.2A carries an HS-FS chip** — read from the TI part number, not stated by Toradex in a sentence.
- **Whether anyone has fused a Verdin AM62 on a Mallow.** Toradex staff confirm it on a Dahlia carrier only.
- **Whether a heatsink was fitted in Toradex's 55 °C tests** (§6).
- **Any measured CPU figure** for the AM62, iMX8M Plus or iMX95 against a Pi 4. All ratios in §7 are estimates.
- **Power draw and heat of the Verdin iMX95** — Toradex lists them as "TBD".
- **Verdin RK3568J** — named in Toradex's menu; no product page could be read.
- **RS Australia** — no Toradex listing found by search; its site was not opened.
- **The ABF and ATO pages on the A$1,000 threshold** — refused (403); rule taken from search-result text.
- **The Solo 512MB clock** — datasheet 1.0 GHz, web page 800 MHz.

## 12. Files kept

Downloaded datasheets, schematics and saved Toradex pages are in `(working folder, not kept)/R1-dl/` (text extracts beside each PDF; saved pages under `tdxcn/`).
