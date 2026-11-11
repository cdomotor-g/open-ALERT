# Skeptic check of R2 (Toradex Luna SL1680), 2026-11-11

Method: reopened the pages with WebFetch/curl and pdftotext on the datasheet. Basis for each: seen = I read it.

| # | Verdict | Notes |
|---|---|---|
| 1 | confirmed (partly) | toradex.cn: variant name, PN 0301, 16GB, -25..+85, "用于评估/开发" seen. Page text also says RAM "Up to 4GB". Price attribute not visible to my fetcher. |
| 2 | confirmed | 7.7.0 page, 28 Aug 2026: sample list, quote seen; Verdin AM62 under Volume products. |
| 3 | confirmed | 7.6.2, 2 Sep 2026, Luna sample, seen. |
| 4 | confirmed | Datasheet "Preliminary – Subject to Change", Rev 0.2 10-Apr-2026, compliance TBA, power characterisation "currently in progress"; "up to 4 GB" (line 594) vs "up to 16 GB" (line 855) seen. Temperature: I saw only storage -40..125 in one table; operating -40 not re-found. |
| 5 | confirmed | "Clock speed up to 2.1 GHz" seen in datasheet. Device-tree operating points not rechecked. |
| 6 | confirmed | "typical current draw around 3 A ... up to 5 A (25 W)", no USB-PD, UVLO 4.4 V seen. |
| 7 | partly confirmed | BM02B-SRSS-TBT external battery and DS1339 seen. USB hub topology not rechecked. |
| 8-9 | unverifiable | Getting-started PDF and developer hardware page not reopened. |
| 10 | unverifiable by me | Price US$145 not visible in my fetch (extractor reported no data-price; direct curl was reset). CNX and a search result both say pre-orders at US$145 (snippet). A$ conversion is the researcher's. |
| 11 | confirmed | "5年长期服务承诺" seen by curl on luna-arm-family. |
| 12 | confirmed | "15+ years ... all our computer modules"; page names only Apalis, Colibri, Verdin. Luna not covered. |
| 13 | confirmed | "由 SoC 供应商构建和维护" seen. |
| 14 | unverifiable | Not rechecked. |
| 15 | confirmed (kernel) | releases.json: longterm 6.12.117. Rest not rechecked. |
| 16 | confirmed | Mainline Synaptics Makefile builds only berlin4ct-dmp and berlin4ct-stb. |
| 17 | confirmed | torizon.io/supported-hardware/synaptics quotes seen. |
| 18 | confirmed | RSS pubDates: 13 May, 6 Aug, 28 Aug, 2 Sep 2026; 7.7.0 and 7.6.2 list Copy Fail/Dirty Frag fix for Luna. 15-week arithmetic is correct (13 May to 28 Aug = 15 weeks). |
| 19 | confirmed | Secure-boot table: 15 modules in Aquila, Verdin (iMX8M Mini/Plus, iMX95, AM62, AM62P), SMARC, Apalis, Colibri; no Luna/SL1680. |
| 20-22 | unverifiable | Not reopened. |
| 23 | unverifiable | PassMark returned HTTP 403 to me. |
| 24 | unverifiable | Not reopened. |
| 25 | refuted as stated | DigiKey AU returned HTTP 403 to me, not "no results"; element14 AU search shows other Toradex modules but no Luna. Still no Australian listing found. |

## Missed or worth adding
- A search result says Toradex's ordering page states it does not work with distributors and sells to business customers only. This contradicts the family page "distribution channels"; direct purchase from Toradex (shop@toradex.com) is likely the only route. Not read by me in full (snippet).
- Synaptics SL1680 bare chips are on DigiKey AU (SL1680A1-BYKXSYY-H000-T, SL1680A1-BYKXSZZ-T000-T; snippet): Astra Machina dev kit is a separate board option.
- Datasheet line 3144 itself says the USB-C input is limited to what a standard USB host can supply; a proper 5 V/5 A supply is needed.
- Toradex's own supported-hardware page calling the Luna "production-ready" conflicts with release notes; the report noted this.
