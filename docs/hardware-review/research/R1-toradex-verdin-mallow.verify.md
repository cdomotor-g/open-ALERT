# Skeptic check of R1 (Toradex Verdin AM62 + Mallow), 2026-11-11

Method: re-opened sources myself. toradex.cn pages via WebFetch (its markdown conversion drops prices) and then curl of the raw HTML (data-price attributes). Datasheets downloaded and grepped. Distributor sites not re-read (blocked); those items stay snippet-level.

| # | Verdict | Notes |
|---|---|---|
| 1 | confirmed | Raw HTML of https://www.toradex.cn/en/computer-on-modules/verdin-arm-family/ti-am62 carries data-price 306.00 / 219.35 / 206.25 / 162.25 / 159.40 / 128.75 for PN 0076..0071. Caveat: WebFetch shows no prices at all, and toradex.com not re-checked, so "toradex.com is the same" is unverified. |
| 2 | confirmed | data-price $100.65 on the Mallow page; 2034+ and -25 to 85 C confirmed. |
| 3 | confirmed | Mallow table: MAL-AM62-2GB-WB-IT 406.65, MAL-AM62-1GB-IT 306.90, MAL-IMX95-8GB-WB-IT 728.15, MAL-IMX8MP-1GB-IT 326.85. No heatsink stated. Note: other MAL- items exist (MAL-AM62-1GB 262.90, 512MB 229.40). |
| 4 | confirmed | Heatsink page: 23111001 LTB, not compatible AM62; 23111101 V1.1B compatible with AM62, US$14.40. Heatsink datasheet lists 23111100 for AM62 V1.1A and newer. (Heatsink page itself does not list 23111100.) |
| 5 | confirmed | AM62 datasheet: USB 2.0 host 1, OTG 1 for all six; PCIE_1 pins NC. Mallow table: USB 2.0, PCIe "-" for every MAL-AM62. Mallow datasheet: 4-port USB5744 hub. |
| 6 | confirmed | developer.toradex.com revision table matches (00761200 V1.2A; 00751201 Q3 2026; 00741201 Q4 2026; 00731200; 00721201 Q3 2026; 00711200). |
| 7 | mostly confirmed | Solo non-WB: web page says 800 MHz (confirmed by me); datasheet check of 1.0 GHz not redone. New: datasheet Rev 0.4 lowered Solo max junction from 105 to 95 C. |
| 8 | confirmed (web page part) | 2033+ on every variant page. Policy pages not re-opened. |
| 9 | unverifiable | element14 blocked. My search found no AU price for 00761200 and the nz page shows an AM69A98 attribute table, which supports the wrong-title claim. The 16 % margin is arithmetic only. |
| 10 | refuted as a current price, consistent with "probably old" | A search today gives element14 AU 00751200 at A$231.58 ex / A$254.74 inc, versus the report's A$172.02 / A$189.22. So the report's AU figures are stale, as it warned. |
| 11 | unverifiable | Avnet US$264.53 and Future US$131.91 (5 in stock, 26 wk) reproduced in search text only. |
| 12 | confirmed | DigiKey AU 741200: "no longer available at DigiKey". (Marketplace, 1-3 days ship text remains.) |
| 13 | confirmed | Distributors page: Arrow (Norwest, Brisbane, Cloverly Park SA, Bayswater North) and Future (Thebarton, Wantirna South, Silverwater); no Australian Toradex office. |
| 14 | unverifiable | Not re-opened. |
| 15 | confirmed | Mallow datasheet: 7V-24V +-10% (but Table says 7-27 V, as the report noted), 2x USB 3.1 Gen 1 via hub, CR1025 holder, 1x TPM 2.0, Rev 1.10 6-Oct-2025. |
| 16-17 | unverifiable | Schematics zip not re-opened. |
| 18 | confirmed | Power page: Quad idle+Ethernet 1.87/2.56; 4-core 2.50/3.49; NEON 3.08/4.06; A53 burn + 5 GHz Wi-Fi 3.12/5.19 (another max variant is 2.77/4.59). |
| 19 | partly confirmed | Datasheet RthetaJA 22.3 C/W and junction max 105 C confirmed. Forum thread not re-read. |
| 20 | partly confirmed | iMX95 page: 6x A55 1.8 GHz, commitment 2039, power TBD, ET 0227 is -25 to 85. Prices not visible to my fetch; not checked in raw HTML. New: there is also a 16GB IT (0228). |
| 21, 22 | unverifiable | Not re-checked. Mallow table confirms AM62P and iMX8MP MAL- prices (369.15, 326.85) and USB 3.1 for iMX8MP. |
| 23 | confirmed | Secure-boot page: irreversible OTP; not for V1.1 or earlier; HS-FS before / HS-SE after fusing. |
| 24 | confirmed | diegom.tx, 10 Nov 2026 4:21pm: Early Access; fusing at scale not available for AM62; no recovery if SMPK lost; Dahlia only. |
| 25 | confirmed | AM62 datasheet 1.7.15: TPM "can be assembled", ST33KTPM2I (build-to-order). Clock chip not re-grepped. |

## What the report missed or understated
- Prices are only in the raw HTML, not in rendered text, so a person looking at the page via a reader may see none. Worth telling the owner.
- The module-only price of the sibling iMX95 and others was not re-verified here; treat as medium.
- The Verdin AM62 is a 4x Cortex-A53 chip with no hardware PCIe and a single USB 2.0 port: the repo's "8 channels in worker threads" load needs a real CPU benchmark; none exists.
- Order-acceptance (business only, 2016 terms) and Toradex freight to Australia remain unanswered, and are the main buying risk.
- Torizon is Early Access for secure boot; no one has fused on Mallow. For a security-approval story this is the weakest point.
- Element14 AU prices move (A$172 to A$232 for one variant), so any quote needs a live read by a person.
