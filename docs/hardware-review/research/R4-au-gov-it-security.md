# R4 — What "passes IT security checks" means for a small edge computer on an Australian government or utility network (late 2026)

Read on 2026-11-11. Every row says how the fact was obtained: **fetched** (I read the page or file), **snippet** (search-result text only), **memory** (unchecked), or **judgement** (my reading of the sources, not a quoted fact).

## 0. How to read this, and what could not be read

Several government sites refuse automated reading. I did not work around any of them. Where a site refused, I used another official copy and say so.

| Site | What happened | What I used instead |
|---|---|---|
| cyber.gov.au (ASD) | WebFetch: HTTP 503. One plain curl: connection reset. Not read. | ASD's own machine-readable copy of the Information Security Manual on GitHub (`AustralianCyberSecurityCentre/ism-oscal`), which says of itself "A mirror of ISM OSCAL documents. The authoritative source can be found at https://www.cyber.gov.au/ism/oscal". For other ASD guidance: the jointly published copies on ic3.gov, and search snippets. |
| protectivesecurity.gov.au (PSPF) | WebFetch: 503. curl: no response. Not read. | Law-firm and trade-press summaries (labelled), Home Affairs pages, search snippets. **No PSPF text in this report is quoted from the PSPF itself.** |
| homeaffairs.gov.au, cisc.gov.au | WebFetch: 403. A plain curl request (curl's own identity, nothing spoofed) was served normally, with the page marking the client as a bot (`class="ms-isBot"`). Read that way. | — |
| qao.qld.gov.au (Queensland Audit Office) | "Client Challenge" bot wall. Not read. | Trade-press article quoting the audit, and snippets. |
| ags.gov.au, dta.gov.au, finance.gov.au, bom.gov.au, tenders.gov.au, media.defense.gov, lgat.tas.gov.au, techpartner.news | 503 / 403 / no response. Not read. | Snippets, labelled. |
| legislation.gov.au, forgov.qld.gov.au, digital.nsw.gov.au, olg.nsw.gov.au, audit.nsw.gov.au, ovic.vic.gov.au, etsi.org, iec.ch, isasecure.org, isa.org, ic3.gov, cisa.gov, oig.nasa.gov, learn.microsoft.com, docs.tenable.com, ubuntu.com, cisecurity.org, moxa.com, torizon.io, raspberrypi.com, kunbus.com | Read normally. | — |

A caution on quotations: pages read through the fetch tool come back through a summarising model, which can tidy wording. Where the site allowed a plain download I checked each quotation against the saved copy (the ISM, the legislation, Home Affairs, NASA, ETSI, NSW and Queensland policy pages, the law-firm and press articles, Tenable, Ubuntu, Torizon, Moxa's announcement). Not checkable that way, and so given as the tool reported them: Moxa's two product pages, raspberrypi.com/security and the CIS benchmark list. Microsoft's page came back as raw text and is quoted from that. **Where a row is labelled "snippet", any words in quotation marks are the search tool's rendering of the page, not text I read on the page.**

Downloaded copies and text extracts are in `(working folder, not kept)/R4-dl/`.

Short names used for the sources cited most often:

- **[ISM]** — ASD Information Security Manual, September 2026 (catalogue version 2026.09.4, published 2026-09-03), 1,143 controls. <https://raw.githubusercontent.com/AustralianCyberSecurityCentre/ism-oscal/main/ISM_catalog.json> (fetched; control numbers below are from this file).
- **[CIRMP]** — Security of Critical Infrastructure (Critical infrastructure risk management program) Rules (LIN 23/006) 2023, compilation of 10 June 2026. <https://www.legislation.gov.au/F2023L00112/2026-06-10/2026-06-10/text/original/epub/OEBPS/document_1/document_1.html> (fetched).
- **[SMART]** — Cyber Security (Security Standards for Smart Devices) Rules 2025. <https://legislation.gov.au/F2025L00276/asmade/2025-03-04/text/original/epub/OEBPS/document_1/document_1.html> (fetched).
- **[FOCI]** — Home Affairs, Foreign Ownership, Control or Influence Risk Assessment Guidance (with appendices). <https://www.homeaffairs.gov.au/nat-security/files/foci-risk-assessment-guidance-with-appendices.pdf> (fetched).

---

## 1. The conclusions that should change a decision

1. **There is no certificate that makes a box "approved".** At the Commonwealth level the ISM's process is: a system owner defines the system, picks controls, has them assessed, and a senior executive (the "authorising officer") accepts the leftover risk and grants an "authorisation to operate" (ISM-1633, ISM-1636, ISM-0027 — [ISM], fetched). The ISM itself says "An organisation is not required as a matter of law to comply with the ISM, unless legislation, or a direction given under legislation or by some other lawful authority, compels them to comply" ([ISM], fetched). For the Bureau that compulsion is the PSPF. Councils have no equivalent rule (section 2.8).
2. **Most of what an assessor asks is about the operating system, how it is run, and who supplies it — not the board.** Of the ISM controls that bear on a device like this, the ones the hardware itself decides are few: secure/measured boot (ISM-1745), firmware updates from the maker (ISM-1903, ISM-1904), whether the maker still supports it (ISM-1982), 64-bit (ISM-1408), external ports (ISM-0343, ISM-0345), and the supplier checks (ISM-1452, ISM-1568, ISM-1882, ISM-1632). Everything else — patching times, hardening, accounts, logging, application control, scanning, network placement — is operating system and operations ([ISM], fetched; the split is my judgement).
3. **No Australian ban, direction or guidance naming Raspberry Pi or single-board computers was found.** The ISM does not contain the words "Raspberry" or "single-board" ([ISM], fetched, text search). The only products publicly named on the Commonwealth's deny list are TikTok, DeepSeek-based AI products and Kaspersky (itnews, fetched). The NASA report blamed an unregistered, unauthorised device and a flat network, not the make of computer (section 3.4).
4. **The proposed software stack (Torizon OS with the agent in a privileged Debian container) is the hardest one to get past an enterprise security team, whatever the board.** Torizon OS is not on Microsoft Defender for Endpoint's or Tenable's supported-Linux lists, has no CIS benchmark, and privileged containers are a named finding in the CIS Docker benchmark (section 4.2). The same Toradex board running Ubuntu LTS or Debian would not have those problems.
5. **The operating system that removes the most questions is Ubuntu LTS (or RHEL), on either x86-64 or 64-bit Arm.** It is on Microsoft Defender's and Tenable Agent's lists for both chip families, has CIS and STIG benchmarks, and has a paid 10-year patch service with FIPS 140 modules (section 4.2). Debian on Arm is on Microsoft's list but not Tenable Agent's. Raspberry Pi OS is on neither.
6. **The certified industrial gateway class carries real weight with operational-technology teams, but the certified Arm models are under-powered for this job.** Moxa's IEC 62443-4-2 SL2 certified range is a dual-core Cortex-A72 at 1.5 GHz with two USB 3.0 ports (UC-8600A) or a quad-core Cortex-A53 at 1.6 GHz with one USB 2.0 port (UC-4400A) (moxa.com, fetched). A Raspberry Pi 4 has four Cortex-A72 cores. So the "most certified" option is at or below the computer the owner already calls the minimum.
7. **Large water utilities got stricter rules on 10 June 2026.** Critical water assets (at least 100,000 water or sewerage connections) are now under "enhanced" risk-program requirements: Essential Eight maturity level two or ISO/IEC 27001:2023 (or equivalent), a process for patching and for unsupported technology, a vendor assessment that covers foreign ownership, supply-chain mapping, network segregation, and "offshore or remote access to critical components" named as a risk to manage ([CIRMP], fetched). The agent's cloud-driven remote management and its updates fetched from GitHub will be questioned there.
8. **The mandatory smart-device rules that started on 4 March 2026 do not cover this product** (they cover consumer devices), but their three requirements — no shared default password, a published way to report security problems, a stated support period with an end date — are now the legal floor for consumer gear and an obvious minimum for anything sold to government ([SMART], fetched).
9. **The weakest link in an assessment is likely to be the supplier of the software, not the hardware.** The ISM asks buyers to use suppliers that have "demonstrated a commitment to the security of their products", "a commitment to transparency" and "a strong track record of maintaining the security of their own systems", and to agree a "shared responsibility model" (ISM-1568, ISM-1882, ISM-1632, ISM-1569 — [ISM], fetched). A one-person open-source project has to show these on paper (judgement).
10. **Keeping the device off the customer's network removes most of the approval.** On its own mobile link it is not connected to their network, so their network controls do not apply; what remains is where it sits, who owns it, and what it sends (section 6).

---

## 2. The frameworks, who they bind, and what they ask of a device like this

### 2.1 Summary table

| Framework | Who it binds | What it asks of a small edge computer | Source and basis |
|---|---|---|---|
| ASD Information Security Manual, September 2026 | Advice. Binding only where something else makes it so (the PSPF for Commonwealth bodies; contracts for suppliers). | A risk process ending in an authorisation to operate, plus about 1,100 controls. Those that matter here are in 2.2. | [ISM] (fetched): "An organisation is not required as a matter of law to comply with the ISM, unless legislation, or a direction given under legislation or by some other lawful authority, compels them to comply." |
| Essential Eight maturity model (ASD, November 2023 edition still current per the file name on cyber.gov.au) | Mandatory at maturity level two for non-corporate Commonwealth entities through the PSPF; one of five options for critical infrastructure; referenced by Queensland and NSW. | Eight strategies written for Windows office networks. For this device the two that bite are patch operating systems and (at level two and above for servers) application control. ASD says the model was designed to protect "internet-connected information technology networks"; it may be applied to enterprise mobility and operational technology networks but was not designed for them, and other strategies may suit those better (reported wording, not a checked quotation). | Scope wording: snippet of <https://www.cyber.gov.au/business-government/asds-cyber-security-frameworks/essential-eight/essential-eight-maturity-model> (snippet). Level-two mandate: snippet of protectivesecurity.gov.au and ASD's Commonwealth cyber posture report (snippet). Control tags per level: [ISM] (fetched) — 46 controls tagged level one, 87 level two, 123 level three. |
| Protective Security Policy Framework (PSPF), Release 2026 | "PSPF Requirements are mandatory for non-corporate Commonwealth entities"; corporate Commonwealth entities are "expected to treat the framework as better practice"; suppliers where a contract says so. The Bureau of Meteorology is a non-corporate Commonwealth entity. | Follow the ISM, authorise systems, reach Essential Eight level two, check foreign ownership in technology buying, keep a stocktake of internet-facing technology, and (2026) of legacy technology. | KWM summary of PSPF 2025, <https://www.mallesons.com/au/en/insights/latest-thinking/the-protective-security-policy-framework-has-been-updated-whats-new.html> (fetched). Release 2026 exists, "issued on 1 July 2026": snippet of protectivesecurity.gov.au (snippet). Bureau status: its 2026–27 corporate plan says it is "a non-corporate Commonwealth entity under the Public Governance, Performance and Accountability Act 2013" (snippet of bom.gov.au; the site refused reading). |
| PSPF Directions | Non-corporate Commonwealth entities. | See 3.2. None names a hardware maker of computers. | Section 3.2. |
| Cyber Security Act 2024, Part 2, and the Smart Devices Rules 2025 | Makers and suppliers of consumer internet-connectable products acquired in Australia. Started 4 March 2026. | Not this product (it is not for "personal, domestic or household use"). Three requirements: passwords, a security-report contact, a published support period. | [SMART] (fetched); Home Affairs page <https://www.homeaffairs.gov.au/about-us/our-portfolios/cyber-security/security-standards-for-smart-devices> (fetched). Section 2.5. |
| Security of Critical Infrastructure Act 2018 and the risk-program rules | The "responsible entity" for a critical water asset: a system run by one water utility that "ultimately delivers services to at least 100,000 water connections or 100,000 sewerage connections". | Baseline since 2023; enhanced since 10 June 2026. Section 2.6. | [CIRMP] (fetched); CISC page <https://www.cisc.gov.au/information-for-your-industry/water-and-sewerage/legislation-regulation-and-compliance/soci-act-2018> (fetched). |
| IEC 62443 (parts 4-1, 4-2, 3-3) | Nobody by law in Australia. Used by operational-technology teams and in tenders. | 4-1: the maker's development process. 4-2: the component's own security functions, at security levels 1–4. 3-3: the whole system's. Section 2.7. | IEC webstore, ISASecure, ISA (fetched). |
| ETSI EN 303 645 V3.1.3 (2024-09) | Nobody directly; the Australian smart-device rules take three of its provisions. | Thirteen provisions for consumer devices; a useful self-check list. Section 2.7. | <https://www.etsi.org/deliver/etsi_en/303600_303699/303645/03.01.03_60/en_303645v030103p.pdf> (fetched). |
| Queensland IS18 (Information and cyber security policy), v10.0.0, effective June 2026 | Queensland departments; statutory bodies in part. Councils: "strongly encouraged to apply the policy as recommended better practice". | An information-security management system based on ISO 27001, Essential Eight with a chosen target level, security assurance for each system. | <https://www.forgov.qld.gov.au/information-technology/queensland-government-enterprise-architecture-qgea/qgea-directions-and-guidance/qgea-policies-standards-and-guidelines/information-security-policy-is18> (fetched). |
| NSW Cyber Security Policy 2026–2027 (July 2026) | NSW departments and agencies. "This policy is not mandatory for state-owned corporations, non-government organisations, local government, and universities." | Covers "operational technology (OT) and Internet of Things (IoT) devices that handle government data ... or deliver government services"; asset inventory, third-party risk, vulnerability management, logging, Essential Eight level one. | <https://www.digital.nsw.gov.au/sites/default/files/2026-06/nsw-cyber-security-policy-2026-2027.pdf> (fetched). |
| NSW Cyber Security Guidelines – Local Government (issued January 2025) | NSW councils, voluntarily: "Compliance with the Guidelines is strongly encouraged but remains voluntary." | Same headings as the state policy, as a self-assessment. | <https://www.olg.nsw.gov.au/sites/default/files/2026-02/cyber-security-guidelines-local-government.pdf> (fetched). |
| Victorian Protective Data Security Standards | Victorian public-sector bodies under Part 4 of the Privacy and Data Protection Act 2014; water corporations are in; councils are generally excluded but "typically incur information security obligations" through functions they carry out. | Not researched in detail. | OVIC page <https://ovic.vic.gov.au/information-security/applicability-of-part-4-of-the-privacy-and-data-protection-act-2014/> (fetched: it says only that excluded bodies "may still voluntarily apply the VPDSS"); council and water detail: snippets of OVIC documents (snippet). |

### 2.2 The ISM controls that apply to a device like this (September 2026)

All rows: [ISM], fetched. Wording is quoted from the control. "E8" shows the Essential Eight maturity level the control is tagged with, if any. All apply from non-classified ("NC") up unless noted.

**Which list the device is judged against depends on what the assessor calls it.** The ISM defines a server as "A computer that provides services to users or other systems" and a network device as "IT equipment designed to facilitate the communication of data". A box that only listens to radio and posts readings out is neither; the ISM has a third bucket, "IT equipment other than workstations, servers and network devices", with its own patch and scan controls. Presented as a managed appliance it falls in that lighter bucket; presented as "a Linux server we will administer" it attracts the server controls (antivirus, application control, standard build). That is my reading, and the assessor decides.

| Topic | Control | What it says | E8 |
|---|---|---|---|
| Authorisation | ISM-1633, ISM-1203, ISM-1634 | The system owner sets the boundary and criticality, does "a threat and risk assessment for each system", and selects and tailors controls. | — |
| Authorisation | ISM-1636 | Controls "undergo a security control assessment by their organisation's own assessors or Infosec Registered Assessor Program (IRAP) assessors". | — |
| Authorisation | ISM-0027 | "System owners obtain an authorisation to operate for each ... system from its authorising officer." | — |
| Supplier | ISM-1631, ISM-1452 | Suppliers "are identified"; "A supply chain risk assessment is performed for suppliers of operating systems, applications, IT equipment, OT equipment and services". | — |
| Supplier | ISM-1567 | "Suppliers identified as high risk by a cyber supply chain risk assessment are not used." | — |
| Supplier | ISM-1568, ISM-1882, ISM-1632 | Buy from suppliers that have "demonstrated a commitment to the security of their products and services", "a commitment to transparency" and "a strong track record of maintaining the security of their own systems". | — |
| Supplier | ISM-1569 | "A shared responsibility model is created, documented and shared between suppliers and their customers". | — |
| Supplier | ISM-1786, ISM-1787, ISM-1788, ISM-1789 | An approved supplier list; sourcing from it; "Multiple potential suppliers are identified"; "Sufficient spares ... are sourced and kept in reserve." | — |
| Delivery | ISM-1790, ISM-1791, ISM-1792 | Delivered "in a manner that maintains their integrity"; integrity and authenticity "assessed as part of acceptance". | — |
| Equipment | ISM-0336 | "A networked IT equipment register is developed, implemented, maintained and regularly verified." | — |
| Equipment | ISM-1913, ISM-1858 | "Approved configurations for IT equipment"; hardened "using ASD and vendor hardening guidance, with the most restrictive guidance taking precedence". | — |
| Equipment | ISM-1982, ISM-1809 | "Networked IT equipment that is no longer supported by vendors is replaced"; compensating controls until it is. | — |
| Operating system | ISM-1743 | Operating systems from "Vendors that have demonstrated a commitment to Secure by Design and Secure by Default principles". | — |
| Operating system | ISM-1407, ISM-1408 | "The latest release, or the previous release, of operating systems are used"; "64-bit versions of operating systems are used." | ML3 (1407) |
| Operating system | ISM-1409, ISM-1914 | Hardened "using ASD and vendor hardening guidance"; an approved configuration is kept. | — |
| Operating system | ISM-0383, ISM-0380 | Default accounts or credentials "changed, disabled or removed during initial setup"; unneeded accounts, services and functions removed. | — |
| Boot | ISM-1745 | "Early Launch Antimalware, Secure Boot, Trusted Boot and Measured Boot functionality is enabled." | — |
| Kernel | ISM-2127, ISM-2128 (new September 2026) | Driver signature checking enforced; loading kernel code limited to privileged users who need it. | — |
| Application control | ISM-1490, ISM-1656 | "Application control is implemented on internet-facing servers" / "non-internet-facing servers". | ML2 / ML3 |
| Endpoint software | ISM-1034, ISM-1417, ISM-1416 | Endpoint detection "on critical servers and high-value servers"; "An antivirus application is implemented on workstations and servers"; a software firewall limiting connections "to an organisation-approved set of applications and services". | — |
| Ports | ISM-1418, ISM-0343, ISM-0345 | Removable-media reading and writing disabled where not needed; interfaces that allow direct memory access disabled. | — |
| Containers | ISM-1460, ISM-1604, ISM-1605, ISM-1606, ISM-1607 | For "a software-based isolation mechanism": from a secure-by-design vendor, hardened, on a hardened host, patched "in a timely manner", with "integrity monitoring and centralised event logging". | — |
| Patching | ISM-0298 | "A centralised and managed approach that maintains the integrity of patches or updates, and confirms that they have been applied successfully". | — |
| Patching | ISM-1877, ISM-1694 | Internet-facing servers' operating systems: "within 48 hours" when critical or exploited; otherwise "within two weeks". | ML1–3 |
| Patching | ISM-1695 | Non-internet-facing servers: "within one month". | ML1–2 |
| Patching | ISM-1878, ISM-1751 | "IT equipment other than workstations, servers and network devices": 48 hours when critical or exploited; otherwise one month. | — |
| Patching | ISM-1903, ISM-1904 | Firmware: 48 hours when critical or exploited; otherwise one month. | ML3 |
| Patching | ISM-1693 | Other applications (the agent, Node.js): "within one month of release". | ML2–3 |
| Unsupported | ISM-1501 | "Operating systems that are no longer supported by vendors are replaced." | ML1–3 |
| Scanning | ISM-1807, ISM-1808 | Automated asset discovery "at least fortnightly"; a vulnerability scanner "with an up-to-date vulnerability database". | ML1–3 |
| Scanning | ISM-1702, ISM-1752, ISM-1900 | Scanner used at least fortnightly for non-internet-facing servers, for other IT equipment, and for firmware. | ML1–3 / — / ML3 |
| Administration | ISM-1380, ISM-1387, ISM-1385 | Separate privileged environments; "Administrative activities are conducted through jump servers"; administrative infrastructure segregated "from the wider network and the internet". | ML1–3 / ML2–3 / — |
| Remote tools | ISM-2149, ISM-2150 (new September 2026) | "A list of authorised RMM tools and remote access tools is developed, enforced and maintained"; connections for unauthorised ones "are blocked at gateways". | — |
| SSH | ISM-0485, ISM-1449, ISM-0484 | "Public key-based authentication is used for SSH connections"; private keys protected; a hardened daemon configuration. | — |
| Network | ISM-0520 | "Network access controls are implemented on networks to prevent the connection of unauthorised network devices and networked IT equipment." | — |
| Network | ISM-1181, ISM-1182 | Networks "segregated into multiple network zones"; traffic between segments limited "to only that required for business purposes". | — |
| Network | ISM-2068 | "Internet connectivity for networked devices is strictly limited to those that require access." | — |
| Network | ISM-1863, ISM-2160 | Management interfaces "not directly exposed to the internet" and reachable only "from a dedicated management network". | — |
| Network | ISM-1321, ISM-1323 | Where 802.1X is used: "802.1X with EAP-TLS", with "X.509 certificates ... for devices". | — |
| Network | ISM-1781, ISM-1139, ISM-1369 | All traffic encrypted "using ASD-approved cryptography"; "Only the latest version of TLS"; AES-GCM. | — |
| Proxy | ISM-0260, ISM-0263, ISM-0958 | "All web access, including that by internal servers, is conducted through web proxies"; "TLS traffic communicated through gateways is decrypted and inspected"; an approved list of domain names. | — |
| Logging | ISM-1977, ISM-1405, ISM-1984 | "Security-relevant events for Linux operating systems are centrally logged"; a central logging facility; logs "encrypted in transit". | — |
| Logging | ISM-0988, ISM-1988 | "An accurate and consistent time source"; logs kept "in a searchable manner for at least 12 months". | — |
| Software supplier | ISM-0401, ISM-1730, ISM-2054 | "Secure by Design principles and practices are followed"; "A software bill of materials is produced and made available to consumers of software." | — |
| Software supplier | ISM-1616, ISM-1755, ISM-1717 | A vulnerability disclosure program and policy; "A 'security.txt' file is hosted for each of an organisation's internet-facing website domains". | — |
| Cryptography | ISM-0457, ISM-0465 (OFFICIAL: Sensitive and PROTECTED only) | Products "that have completed a Common Criteria evaluation against an ASD-endorsed Protection Profile" for encrypting media or sending such data over public networks. | — |

On cryptographic assurance the ISM says products "should be assessed by one of the following processes, listed in order of preference": first "a Common Criteria evaluation against an ASD-endorsed Protection Profile", second a FIPS 140-3 evaluation through the US and Canadian Cryptographic Module Validation Program, third an algorithm validation, fourth a Common Criteria evaluation against an assurance level, last "an independent security review by a reputable process or body" ([ISM], fetched). So FIPS 140-3 is recognised, second in line, and required of nobody at the non-classified level.

### 2.3 Essential Eight

- The eight strategies are embedded in the ISM as tagged controls (2.2). For a headless Linux device the relevant ones are: patch operating systems and applications on the stated clocks, restrict administrator privileges, multi-factor sign-in for administrators, application control (servers, from level two), and backups. The macro and browser strategies do not apply ([ISM], fetched; applicability is my judgement).
- ASD's own caveat that the model was not designed for operational technology is in 2.1 (snippet).
- In 2025, "22 per cent of entities reached overall Maturity Level 2, increasing from 15 per cent in 2024" (snippet of ASD's Commonwealth cyber security posture report, <https://www.cyber.gov.au/about-us/view-all-content/reports-and-statistics/the-commonwealth-cyber-security-posture-in-2025>). Most Commonwealth bodies do not meet the level they would hold a supplier's device to — which makes their security teams cautious about adding anything that lowers the score (judgement).

### 2.4 ASD guidance on edge devices, operational technology, IoT and "secure by design"

| Document | What it says that matters here | Source and basis |
|---|---|---|
| Mitigation strategies for edge devices — executive and practitioner guidance (ASD-led, February 2025) | "Edge device" here means the network's border equipment: the practitioner guide is "scoped to enterprise routers, firewalls, and VPN concentrators". CISA's page widens the term to "IoT devices, internet-facing servers, and internet-facing operational technology (OT) systems". Seven strategies; the first three are "Know the edge", "Procure secure-by-design devices", "Apply hardening guidance, updates and patches". The base station is not an edge device in this sense unless it is reachable from the internet. | Package listing: <https://www.cisa.gov/resources-tools/resources/guidance-and-strategies-protect-network-edge-devices> (fetched). Scope and strategy names: snippets of cyber.gov.au and nsa.gov (snippet). The full list of seven was not read. |
| Principles of operational technology cyber security (ASD-led, 1 October 2024) | Six principles, including "Segment and segregate OT from all other networks" and "The supply chain must be secure". On devices: "The source and provenance of all devices in the OT environment should be known." A suggested check: "plug the device in with a packet analyser capturing traffic, and check if the device unexpectedly attempts to communicate with a remote address." | <https://www.ic3.gov/CSA/2024/241001.pdf> (fetched). |
| Secure by Demand: Priority Considerations for Operational Technology Owners and Operators when Selecting Digital Products (CISA with ASD and ten others, 13 January 2025) | Twelve things buyers should look for: configuration management; logging in the baseline product; open standards; ownership ("full autonomy over said product ... minimizing dependency on the vendor"); protection of data; secure by default ("eliminate default passwords"); secure communications; secure controls; strong authentication; threat modeling ("an up-to-date threat model"); vulnerability management ("a clearly defined support period ... hardware and software bill of materials with product delivery ... a vulnerability disclosure program"); upgrade and patch tooling ("owner-controlled patch management"). The ISM cites this document in its supply-chain section. | <https://www.ic3.gov/CSA/2025/250113.pdf> (fetched); ISM reference: [ISM] (fetched). |
| Choosing secure and verifiable technologies (ASD with CISA, published by CISA 5 December 2024) | For "procuring organizations and manufacturers of digital products and services", to choose "technology that is secure by design". Named by Home Affairs as a companion to the vendor review framework. | <https://www.cisa.gov/resources-tools/resources/choosing-secure-and-verifiable-technologies> (fetched; the guide itself is on cyber.gov.au and was not read). |
| IoT secure-by-design guidance for manufacturers (ASD, first published September 2020, updated September 2023) | Maps to the thirteen provisions of ETSI EN 303 645; "focuses on devices, not their associated backend servers". | Snippet of cyber.gov.au (snippet). |
| Hardening Linux workstations and servers (ASD; an October 2026 edition exists) | Names the File Access Policy daemon (fapolicyd) as the way to do application control on Linux and points to the distribution vendor's hardening guides. | Referenced by the ISM ([ISM], fetched); content: snippet of cyber.gov.au (snippet). |

### 2.5 Cyber Security Act 2024 and the smart-device rules

| Point | Detail | Source and basis |
|---|---|---|
| Start | Part 2 and Schedule 1 commence "The day after the end of the period of 12 months beginning on the day this instrument is registered" — registered 4 March 2025, so 4 March 2026. Home Affairs: the Rules "commenced on 4 March 2026, following a 12-month transition period". | [SMART] (fetched); Home Affairs page (fetched). |
| Who | Products "that can directly or indirectly connect to the internet", intended or likely to be used "for personal, domestic or household use" and acquired in Australia by a consumer. Home Affairs: "Most smart devices manufactured on and from 4 March 2026, and intended for personal, domestic or household use". | [SMART] ss 5, 8 (fetched); Home Affairs page (fetched). |
| Excluded | Desktop computers and laptops, tablet computers, smartphones, therapeutic goods, road vehicles and road vehicle components. The first item reads "a desktop computer or a laptop". | [SMART] s 8(1)(b) (fetched). |
| Requirement 1 | Passwords must be "unique per product" or "defined by the user of the product"; unique ones not "based on incremental counters" or "derived from publicly available information". | [SMART] Sch 1 cl 2 (fetched). |
| Requirement 2 | The maker publishes "at least one point of contact to allow a person to report security issues", and says when reporters get an acknowledgement and status updates. | [SMART] Sch 1 cl 3 (fetched). |
| Requirement 3 | The maker publishes "the period, expressed as a period of time with an end date," for security updates, and "must not shorten the defined support period after it is published". | [SMART] Sch 1 cl 4 (fetched). |
| Paperwork | A statement of compliance "prepared by, or on behalf of, the manufacturer", kept for 5 years. | [SMART] ss 9–10 (fetched). |
| Regulator | "The Technology Assessment and Regulation Office within the Department of Home Affairs". | Home Affairs page (fetched). |
| For this project | A base station sold to a council or the Bureau is not a consumer product, so the Rules do not apply (judgement). Whether a bare single-board computer sold at retail is caught, or is a "desktop computer", is not settled by the text I read. | Judgement. |

### 2.6 Critical infrastructure: water and sewerage

| Point | Detail | Source and basis |
|---|---|---|
| Who | A critical water asset is a water or sewerage system or network that "is managed by a single water utility" and "ultimately delivers services to at least 100,000 water connections or 100,000 sewerage connections". Obligations: register, report cyber incidents, and "Adopt, maintain and comply with a written critical infrastructure risk management program". | CISC page (fetched). |
| In the risk-program rules | Section 4(1)(m): "a critical water asset". Section 4A(1)(i) puts it among the nine asset classes "subject to enhanced CIRMP requirements". | [CIRMP] (fetched). |
| When | The enhancing rules (LIN 26/075) were registered 9 June 2026 and commenced 10 June 2026. Grace periods of 12 months (sections 6A, 8A(2), 9A(2)) and 24 months (the rest of 8A, 8B, 8C, 9A, 10A, 11A) run from commencement. | [CIRMP] endnotes and s 4A(6) (fetched). On my reading the dates are 10 June 2027 and 10 June 2028; a law-firm summary gives 10 June 2027 for the 12-month items (snippet of corrs.com.au). |
| Baseline cyber framework (section 8) | One of: AS ISO/IEC 27001:2015; Essential Eight "maturity level one"; the NIST framework; C2M2 "Maturity Indicator Level 1"; the 2020-21 AESCSF "Security Profile 1"; or an equivalent. | [CIRMP] s 8(4)–(5) (fetched). |
| Enhanced cyber framework (section 8A(3)) | One of: AS ISO/IEC 27001:2023; Essential Eight "maturity level two"; NIST CSF 2.0; C2M2 v2.1 "Maturity Indicator Level 2"; AESCSF 2023 "Security Profile 2"; or an equivalent. | [CIRMP] (fetched). |
| Patching and old technology (section 8A(2)) | A process to minimise "failure to patch or update operating or security systems in a timely manner" and "failure to replace legacy systems, or adequately mitigate risks associated with components or technology that are redundant, unsupported, obsolete or discontinued". | [CIRMP] (fetched). |
| Network (section 8C) | Network segregation of critical systems, "logical access controls for network traffic", "centrally logging, monitoring and routinely reviewing access logs for communication paths", and "least privilege across computers that connect to critical systems". | [CIRMP] (fetched). |
| Extra risks (section 6A) | "compromise or impairment of the functions of the CI asset as a result of, or in connection with FOCI"; "offshore or remote access to critical components"; "offshore or remote access to business critical data". | [CIRMP] (fetched). |
| Vendors (section 10A) | Map the supply chain "for major suppliers and critical components". For each major supplier identify "in relation to FOCI risks—legislative or other legal requirements to which the supplier is subject", sanctions, and "the access, influence and control the supplier has over the CI asset". A major supplier is "any vendor that by nature of the product or service they offer, has a significant influence over the security" of the asset. | [CIRMP] (fetched). |
| What this means | A flood-telemetry receiver is unlikely to be a "critical component" of a water network, so the owner is unlikely to be a "major supplier" (judgement). But the utility's security team works to these rules and applies the same questions down the list: who can reach the box remotely, from where, and who owns the supplier. | Judgement. |

### 2.7 IEC 62443 and ETSI EN 303 645

| Standard | What it covers | Source and basis |
|---|---|---|
| IEC 62443-4-1 | "Secure product development lifecycle requirements" — the maker's process, not a product. | <https://www.isa.org/standards-and-publications/isa-standards/isa-iec-62443-series-of-standards> (fetched). |
| IEC 62443-4-2:2019 | "detailed technical control system component requirements (CRs) associated with the seven foundational requirements": identification and authentication control, use control, system integrity, data confidentiality, restricted data flow, timely response to events, resource availability. It defines capability security levels for components. | <https://webstore.iec.ch/en/publication/34421> (fetched). |
| IEC 62443-3-3 | "System security requirements and security levels" — for the whole system, the integrator's or owner's job. | ISA page (fetched). |
| Component types and levels | Four types: software application, embedded device, host device ("general purpose device running an operating system"), network device. Four certification levels matching security levels 1–4; a level-n certificate "includes a requirement for compliance to ISA/IEC 62443-4-1". | <https://isasecure.org/certification/iec-62443-csa-certification> (fetched). |
| A certificate is for a named product with a named operating system | Moxa's announcement is for computers "that run Moxa Industrial Linux 4 (MIL4) Secure OS", under the heading "IEC 62443-4-2 SL2 Certified UC Series With MIL4 Secure OS". Its product pages say the standard edition is what ships by default and the Secure edition is ordered as an option (as reported by the fetch tool; the product pages refused a plain download). A different operating system on the same hardware is not the certified product. | <https://moxa.com/about-us/News-Events/News/2026/new-gen-arm-computers-achieve-iec-62443-4-2-SL2> (fetched, checked against a saved copy); product pages (fetched through the tool's summary). |
| ETSI EN 303 645 V3.1.3 (2024-09) | "Cyber Security for Consumer Internet of Things: Baseline Requirements". Provisions 5.1 "No universal default passwords", 5.2 "Implement a means to manage reports of vulnerabilities", 5.3 "Keep software updated", 5.4 "Securely store sensitive security parameters", 5.5 "Communicate securely", 5.6 "Minimize exposed attack surfaces", 5.7 "Ensure software integrity", 5.8 "Ensure that personal data is secure", 5.9 "Make systems resilient to outages", 5.10 "Examine system telemetry data", 5.11 "Make it easy for users to delete user data", 5.12 "Make installation and maintenance of devices easy", 5.13 "Validate input data". | ETSI PDF (fetched). |

### 2.8 State rules, and what councils do in practice

| Point | Detail | Source and basis |
|---|---|---|
| Queensland departments | "Requirement 1: Agencies must implement an ISMS based on ISO 27001"; agencies "must also implement the Australian Signals Directorate's (ASD) Essential Eight Strategies. This includes the selection of Maturity Level target(s)"; "Accountable officers ... must obtain security assurance for systems". On operational technology: "Agencies should also consider the adoption of internationally recognised OT industry standards and frameworks." | IS18 v10.0.0 (fetched). |
| Queensland councils | "Other Queensland government entities, including local governments, are strongly encouraged to apply the policy as recommended better practice." Not mandatory. | IS18 v10.0.0 (fetched). |
| Queensland statutory bodies (many water entities) | The policy applies "to statutory bodies under the Financial and Performance Management Standard 2019 in the context of internal controls, financial information management systems and risk management". | IS18 v10.0.0 (fetched). Whether a given water authority treats IS18 as binding was not checked. |
| NSW councils | Not bound by the state policy; the council guidelines are voluntary. | NSW policy and OLG guidelines (fetched). |
| What NSW councils were found to do | "None of the councils are effectively using risk management processes to identify and manage cyber security risks." "All three councils are not effectively identifying or managing third party cyber security risks." "All three councils do not include guidance on cyber security risk assessments in their procurement policies and procedures." | Audit Office of NSW, Cyber security in local government, tabled 26 March 2024, <https://www.audit.nsw.gov.au/our-work/reports/cyber-security-in-local-government> (fetched). |
| What the NSW guidelines ask councils to ask suppliers | An inventory of third-party providers; contracts that require notice of "suspected or actual cyber security incidents and data breaches"; "cyber security clauses in contracts"; a process to monitor providers. | OLG guidelines, requirements 1.10.1–1.10.4 (fetched). |
| Queensland councils, audit findings | "Almost 80% of deficiencies in information systems and security controls at Queensland councils relate to access management, according to the state's most recent local government audit." In NSW, 2024–25 figures "found control weaknesses around system access at 71 councils (for context, there are 121 councils in the state)". | GovTech Review, 17 June 2026, an article by a vendor's staff citing the audit offices, <https://www.govtechreview.com.au/content/gov-security/article/access-management-remains-a-major-problem-at-many-australian-councils-1004309838> (fetched; not checked against the audit reports, which could not be read). |
| In practice | With no binding rule, a council's "approval" is its IT manager's (or its managed-service provider's) judgement, usually against the Essential Eight and whatever its insurer and auditor asked last year. A device that needs nothing opened inbound and can sit on a guest or isolated network, or on its own SIM, is rarely refused. A council above the 100,000-connection water threshold is a critical infrastructure entity and behaves like a utility. | Judgement, consistent with the audit findings above. |

---

## 3. Supplier and supply-chain risk

### 3.1 How foreign ownership is assessed

| Point | Detail | Source and basis |
|---|---|---|
| The framework | "On 20 December 2024 the Minister for Home Affairs announced the finalisation of Australia's Technology Vendor Review Framework". It "does not introduce any new legislative authorities or regulation". "The government has not established the framework to ban or restrict vendor access within the Australian economy, or target vendors from specific nations." "The framework will not be released publicly". | <https://www.homeaffairs.gov.au/about-us/our-portfolios/national-security/technology-and-data-security/technology-vendor-review-framework> (fetched). |
| The public guidance | "The guidance is voluntary and there are no regulatory or reporting requirements" (for organisations in general). A two-stage test: a vendor review questionnaire, then a full assessment if triggered. Model contract clauses "may also help non-corporate Commonwealth entities to meet their obligations under the Protective Security Policy Framework". | <https://www.homeaffairs.gov.au/about-us/our-portfolios/national-security/technology-and-data-security/foreign-ownership-control-or-influence-risk-assessment-guidance> (fetched). |
| Question 1 | "Is the beneficial owner of the vendor from a Five Eyes country (Australia, Canada, New Zealand, UK, and United States)?" If yes, "consider cyber security hygiene risks posed by the vendor"; "If NO, go to Section 2." With the note: "there are many non-Five Eyes countries whose interests, values and systems of government align with Australia's." | [FOCI] (fetched). |
| Section 2, jurisdiction | Whether the owner's jurisdiction is one where a government can compel access to the vendor's data, "has been the subject of an Australian Government cyber attribution", is sanctioned, or runs "government sanctioned economic coercion, intellectual property theft and/or technology transfer campaigns". Any yes leads to Section 4. | [FOCI] (fetched). |
| Section 3, state control | "state shareholding of >50% or outsized state influence", "politically exposed persons (PEPs) in senior leadership roles", or "a special relationship between the vendor and a foreign government". | [FOCI] (fetched). |
| Section 4, access | "Is the product or service connected, intermittently or continuously, to the internet, organisation systems, or subject to third-party access?" If yes: "conduct a vendor FOCI risk assessment." | [FOCI] (fetched). |
| For the Commonwealth it is mandatory | PSPF Direction 001-2024 "requires Government entities to identify indicators of FOCI risk in the procurement and maintenance of technology assets, and to appropriately manage and report those risks". "By June 2025, each Commonwealth agency must implement a process to identify and manage FOCI risk when procuring technology." The firm adds that this "could include seeking and assessing information from tenderers about their non-Australian directors, foreign shareholders and foreign revenue and investments". PSPF 2025 adds reporting of "potential or identified foreign ownership, control or influence risks identified during procurement processes". | Clayton Utz, <https://www.claytonutz.com/insights/2024/july/new-foreign-interference-and-cyber-risk-requirements-for-buying-and-managing-commonwealth-technology> (fetched); KWM (fetched). |
| For large water utilities it is now mandatory too | Section 10A of the risk-program rules (2.6). | [CIRMP] (fetched). |

**How country of origin is treated in practice.** The published test is about who owns and controls the *vendor*, not where a chip was fabricated. Applying the questionnaire as written (my application, not a government finding):

- A maker owned in the UK or US (Raspberry Pi Holdings plc; Dell; HP) stops at question 1: hygiene checks only.
- A maker owned in a friendly non-Five-Eyes country (Toradex AG, Switzerland; Moxa, Taiwan) goes through Sections 2 and 3, should answer no throughout, and ends at the same place — but the buyer has to do and file the extra steps.
- A maker whose owner sits in a jurisdiction that Australia has publicly attributed cyber operations to answers yes in Section 2, and because the device is network-connected, Section 4 then requires the full assessment. Most low-cost "open hardware" Arm boards are in this group (the makers and their chip suppliers); I did not research individual makers.
- Chips and contract manufacture are not asked about by the questionnaire. ASD's operational-technology principle that "The source and provenance of all devices ... should be known" (ic3.gov, fetched) and the utilities' duty to map "critical components" ([CIRMP] s 10A, fetched) are where that question comes in.

Other signals: Home Affairs Deputy Secretary Brendan Dowling said the focus has shifted toward hardware — "we now have tech like CCTV cameras and drones that are much more of a feature of agencies' activities" (itnews, October 2025, fetched). Direction 001-2024 "follows an audit in 2023 which uncovered over 900 Chinese Government-linked surveillance devices installed on buildings occupied by almost every Australian Government department" (Clayton Utz, fetched). In February 2023 the Defence Department said it would remove such cameras from its sites (press snippets; I found no government-wide ban instrument). At Senate estimates in May 2023 a Home Affairs official said "a minister of Home Affairs could declare a particular device to be a material risk that then a company would have to mitigate" under the risk-program obligations (itnews, 23 May 2023, <https://www.itnews.com.au/news/australian-critical-infrastructure-operators-urged-to-move-off-chinese-tech-596131>, fetched).

### 3.2 PSPF Directions that name products

| Direction | What it does | Source and basis |
|---|---|---|
| 001-2024 | Foreign ownership risk in technology procurement (above). | Clayton Utz (fetched). |
| 002-2024 | "By June 2025, all Commonwealth Government entities must have conducted a technology asset stocktake on all internet-facing systems or services". "The stocktake must capture all manufacturers, suppliers and providers". "It will not apply to services or systems accessed solely through a Government agency's internal network." Entities must also write a Technology Security Risk Management Plan that includes "FOCI risks in technology supply chains". | Clayton Utz (fetched, checked against a saved copy). |
| 003-2024 | Join ASD's Cyber Security Partnership Program; share threat information. | Clayton Utz (fetched). |
| 001-2025 | Blocks DeepSeek products on government systems. | Snippet (digitalpolicyalert.org listing). |
| 002-2025 | "requires Australian Government entities to prevent the installation of Kaspersky Lab, Inc. products and web services". | Snippet of protectivesecurity.gov.au. |
| 004-2025 (22 October 2025) | Entities must follow the "Commonwealth Technology Standard" and remove items on its Deny List. itnews: "the only products on the list the department has made public are the social media application TikTok, AI product built on DeepSeek's open-source large language model and cyber security products offered by Russian cyber security giant" Kaspersky. Cyber Daily: entities must have policies "to consider sharing risk assessments through the Department of Home Affairs Centralised Risk Sharing Capability" from 2 February 2026, and the direction stresses "selecting products that have undergone independent assessment through" IRAP. Applies to non-corporate Commonwealth entities — "basically all federal government departments and agencies excluding the likes of the ABC, NBN Co and Australia Post" (itnews). | itnews, <https://www.itnews.com.au/news/home-affairs-streamlines-risk-vetting-for-gov-tech-suppliers-621342> (fetched); Cyber Daily, <https://www.cyberdaily.au/government/12820-home-affairs-updates-protective-security-policy-framework> (fetched). The Deny List itself was not read. |
| 001-2026 | "Mitigate Vulnerabilities in Cisco SD-WAN Systems", published 26 February 2026. | Snippet of protectivesecurity.gov.au. |
| 002-2026 (reported 30 September 2026) | Reported title: Strengthening Commonwealth Cyber Posture Against AI-Enabled Risks. "all non-corporate Commonwealth entities" have until the end of March 2027 to do a "legacy technology stocktake" and write a "legacy technology risk management plan", with attention to older "hardware, software, services, protocols, and/or systems"; entities should be "rapidly patching vulnerabilities deemed critical by vendors or internal vulnerability management processes". | itnews, <https://www.itnews.com.au/news/home-affairs-orders-gov-wide-legacy-system-stocktake-within-six-months-629313> (fetched); title from a snippet. |

None of these names Raspberry Pi, any single-board computer, or any maker of small computers. The practical effect of 002-2026 for the Bureau: anything it runs must have a maker that is still patching it, and it is counting what does not (judgement).

### 3.3 Is Raspberry Pi banned or discouraged anywhere in Australian guidance?

No. What I checked:

| Check | Result | Basis |
|---|---|---|
| ISM September 2026, full text search for "Raspberry", "single-board", "country of origin" | No matches. | [ISM] (fetched). |
| PSPF directions | No hardware computer maker named (3.2). | Secondary sources and snippets; the PSPF site and the Deny List were not read. |
| Web search for a ban, prohibition or guidance | Nothing found. | Search, negative result. |
| Raspberry Pi's own security posture | A security page with a report address (security@raspberrypi.com), a `/.well-known/security.txt`, agreed disclosure dates, CVE assignment, published advisories (CVE-2026-13199, boot firmware, fixed in the 2026-05-26 release), and daily vulnerability scans of Raspberry Pi OS with a published list. The page does not state a support period, a bill of materials, or any certification. | <https://www.raspberrypi.com/security/> (fetched; last modified 2026-10-13). |

So the objections an assessor raises to a Raspberry Pi are not a rule. They are (judgement): it is the standard example of an unmanaged device plugged into a network (3.4); Raspberry Pi OS is not on enterprise security tools' supported lists (4.2); it is not on any hardware panel as a brand the agency already manages; SD-card storage; and, on a Pi 4, no TPM and secure boot that needs one-time programming. Several of these go away with a different operating system and an industrial carrier.

### 3.4 The 2018 NASA Jet Propulsion Laboratory breach — what the report actually blamed

Source: NASA Office of Inspector General, *Cybersecurity Management and Oversight at the Jet Propulsion Laboratory*, IG-19-022, 18 June 2019, <https://oig.nasa.gov/docs/IG-19-022.pdf> (fetched; page numbers from the PDF).

| Finding | The report's words |
|---|---|
| What happened | "in April 2018 JPL discovered an account belonging to an external user had been compromised and used to steal approximately 500 megabytes of data from one of its major mission systems." (Results in Brief) |
| The Raspberry Pi | "The April 2018 cyberattack exploited this particular weakness when the hacker accessed the JPL network by targeting a Raspberry Pi computer that was not authorized to be attached to the JPL network. The device should not have been permitted on the JPL network without the JPL OCIO's review and approval." (p. 12; footnote marker omitted) |
| "This particular weakness" | An incomplete inventory: "system administrators did not consistently update the inventory system when they added devices to the network ... Consequently, assets can be added to the network without being properly identified and vetted by security officials." (p. 12) |
| What let the intruder spread | "JPL did not properly segregate individual partner environments ... The cyberattacker from the April 2018 incident exploited the JPL network's lack of segmentation to move between various systems connected to the gateway". (p. 13) |
| Other causes named | Security tickets "not resolved for extended periods of time—sometimes longer than 180 days"; administrators who "misunderstood their responsibilities regarding management and review of logs"; no threat-hunting program; incident response that deviated from NASA practice. (Results in Brief) |
| Recommendations | Ten, all about process: keep the inventory current, segregate the shared gateway, security agreements with partners, fix the ticket process, review waivers, clarify who reviews logs, training, threat hunting, lessons learned, and continuous monitoring. None mentions Raspberry Pi or a class of hardware. (p. 29) |

The lesson that transfers: a device nobody registered, on a network that was not divided. The Australian controls that answer it are the equipment register (ISM-0336), network access control (ISM-0520) and segmentation (ISM-1181) — all the customer's, not the device's. A base station that arrives through procurement, is entered on the register, and sits in its own segment is the opposite of the JPL case, whatever board is inside.

---

## 4. Which certifications and properties carry real weight

### 4.1 Weight by buyer

"Bureau" = a non-corporate Commonwealth entity under the PSPF. "Utility" = a water authority under the critical-infrastructure rules. "Council" = a council below that threshold. Weights are my judgement, grounded in the rules cited.

| Property | Bureau | Utility | Council | Why (source) |
|---|---|---|---|---|
| A supported operating system with a stated patch service and end date | Decisive | Decisive | High | ISM-1501, ISM-1982, patch clocks ([ISM], fetched); "failure to patch ... legacy systems" ([CIRMP] s 8A(2), fetched); Direction 002-2026 (itnews, fetched). |
| The operating system is one the security team's tools support (endpoint agent, vulnerability scanner) | Decisive on the corporate network | High | Medium | ISM-1808, ISM-1702, ISM-1752 scanning; ISM-1034, ISM-1417 for servers ([ISM], fetched). Tool lists in 4.2. |
| A hardening benchmark exists for the operating system (CIS; STIG) | High | High | Low | ISM-1409: hardened "using ASD and vendor hardening guidance" ([ISM], fetched). Benchmarks in 4.2. |
| Signed updates, applied centrally, with proof they applied | High | High | Medium | ISM-0298 ([ISM], fetched); "owner-controlled patch management" (Secure by Demand, fetched). |
| Supplier's vulnerability-disclosure policy, security contact, advisories | High | High | Medium | ISM-1616, ISM-1755, ISM-1717 ([ISM], fetched); Secure by Demand item 11 (fetched); [SMART] cl 3 (fetched). |
| Software bill of materials | Medium–high | Medium–high | Low | ISM-1730 ([ISM], fetched); Secure by Demand: "hardware and software bill of materials with product delivery" (fetched). |
| Vendor ownership that passes the foreign-ownership questionnaire at the first question | High (must be recorded) | High (from 2026) | Low | Direction 001-2024 (Clayton Utz, fetched); [CIRMP] s 10A (fetched); [FOCI] (fetched). |
| Secure boot and measured boot; TPM 2.0 | Medium | Medium | Low | ISM-1745 ([ISM], fetched). One control among many; rarely the deciding one for non-classified data (judgement). |
| Vendor holds ISO/IEC 27001 | Medium | Medium–high | Low | Supports ISM-1632 "track record of maintaining the security of their own systems" ([ISM], fetched); ISO 27001 is itself a listed framework for utilities ([CIRMP] s 8A, fetched) and the base of Queensland's IS18 (fetched). |
| IEC 62443-4-2 certificate for the product (and 4-1 for the maker) | Low–medium | High | Low | Not referenced by the ISM controls read; Queensland tells agencies to "consider the adoption of internationally recognised OT industry standards" (IS18, fetched). It is the language utility operational-technology teams work in (judgement). |
| FIPS 140-3 validated cryptography | Low | Low | None | Second preference in the ISM's assurance list, required only via Common Criteria for OFFICIAL: Sensitive and PROTECTED data ([ISM] ISM-0457, ISM-0465, fetched). Flood telemetry is public data (judgement). |
| 802.1X with device certificates | Medium, where the network uses it | Medium | Low | ISM-1321, ISM-1323 ([ISM], fetched). A standard Linux can do it; an appliance must expose the setting. |
| Central logging to the customer's collector | High on the corporate network | High | Low | ISM-1977, ISM-1405 ([ISM], fetched); [CIRMP] s 8C(4)(e) (fetched). |
| On a government hardware panel | Medium (procurement ease, not security) | Low | Medium | Section 5. |

### 4.2 The operating system decides more than the board

| Operating system | Microsoft Defender for Endpoint (Linux) | Tenable Agent 11.2.3 | CIS benchmark | Long-term patch service | Sources (all fetched) |
|---|---|---|---|---|---|
| Ubuntu LTS, x86-64 | Supported (16.04–26.04) | Supported (18.04–26.04) | Yes (to 26.04), plus STIG variants for 20.04–24.04 | Ubuntu Pro: "10 years for the entire Ubuntu Archive"; "FIPS 140 certified cryptographic packages available with an Ubuntu Pro subscription"; list price $25 a year per workstation and $500 per server (currency not stated on the page), "free for personal use on up to 5 physical machines" | <https://learn.microsoft.com/en-us/defender-endpoint/mde-linux-prerequisites> (page dated 2026-09-14); <https://docs.tenable.com/nessus-agent/Content/RequirementsSoftware.htm>; <https://www.cisecurity.org/cis-benchmarks>; <https://ubuntu.com/pro>; <https://ubuntu.com/pricing/pro>; <https://documentation.ubuntu.com/security/docs/compliance/fips/> |
| Ubuntu LTS, 64-bit Arm | Supported (20.04–26.04) | Supported (AArch64) | Same benchmark | Same (Arm coverage of the FIPS modules not confirmed) | Same |
| Red Hat Enterprise Linux 8–10, both chip families | Supported | Supported | Yes, plus STIG variants | Not researched | Same |
| Debian 12 / 13, x86-64 | Supported (9–13) | Supported | Yes (to 13) | Community; not researched | Same |
| Debian 12 / 13, 64-bit Arm | Supported (11, 12, 13) | **Not listed** (x86-64 only) | Same benchmark | Community | Same |
| Raspberry Pi OS | **Not listed.** Microsoft: "Distributions and versions that aren't explicitly listed above are unsupported"; systems "derived from known, standard, vendor-provided Linux distributions ... can be installed and may function" but "aren't part of Microsoft's validated or maintained support baseline". | Not listed | None | No stated period found | Same; raspberrypi.com/security (fetched) |
| Torizon OS (a Yocto-built system) | **Not listed**, and not derived from a listed distribution | Not listed | None | "Software life cycles are optimized for the needs of medical and industrial devices"; no duration stated | Same; <https://www.torizon.io/security> (fetched) |
| Moxa Industrial Linux 4 (Debian 13 base, kernel 6.12) | Not listed as such (a Debian derivative: the "may function" case) | Not listed | None of its own | End of life 2033 (UC-8600A) or 2035 (UC-4400A) per the product pages as reported by the fetch tool; Moxa's announcement says "a 10-year OS support" | moxa.com (fetched) |

Notes:

- Microsoft Defender for Endpoint needs "One CPU core minimum", "1 GB of RAM minimum", "2 GB" disk, and systemd (fetched). It does not support "SSL inspection and intercepting proxies" for its own traffic (fetched) — which matters in section 6.
- Tenable adds: "Tenable Agent only supports the 4 KB base page size on Linux AArch64 architecture" (fetched). Some Arm kernels use larger pages (Raspberry Pi OS on a Pi 5 does by default — memory, not checked), so check the kernel as well as the distribution.
- A scanner can also check a Linux host over SSH without an agent; the table is about the agent. I did not check which distributions Tenable's credentialed network scans recognise.
- Other endpoint products (CrowdStrike, SentinelOne, Trend) and scanners (Qualys, Rapid7) were not checked. The customer's product is the one that matters; ask which it is.
- **Privileged container.** The CIS Docker Benchmark carries the recommendation "Ensure that privileged containers are not used" (numbered 5.4 or 5.5 depending on the version; snippet of tenable.com audit listings). A container given all of the host's privileges is not a boundary, so an assessor will treat the agent as running as root on the host and will ask why a container is there at all. The ISM's isolation controls (ISM-1604 to ISM-1607, [ISM], fetched) then apply to the container engine *and* the host: two things to harden, patch and log instead of one.
- **Toradex.** The Torizon security page carries an ISO/IEC 27001:2022 badge in its header (the fetch tool reported that it links to a certificate for Toradex AG dated 2025; I did not read the certificate or its scope); it says software bills of materials and CVE reports are published "on every TorizonCore build"; it claims no IEC 62443 certification and shows no security contact (torizon.io/security, fetched). Secure boot on the AM62 is "still an Early Access feature" per Toradex staff on 2026-11-10 (sibling report R1, section 8).

### 4.3 What IEC 62443-certified hardware looks like today (examples, not a survey)

| Product | Certificate | Processor and ports | Operating system | Source and basis |
|---|---|---|---|---|
| Moxa UC-8600A | "IEC-62443-4-2 Security Level 2 (SL2) certification under the International Electrotechnical Commission for Electrical Equipment (IECEE) Certification Body Scheme", with a statement from the testing firm DEKRA; announced 22 July 2026: "the entire UC Series 64-bit Arm-based computer portfolio is now certified". Only with the MIL4 Secure operating system. | Arm Cortex-A72, dual-core, 1.5 GHz; 4 GB RAM; 32 GB eMMC; two USB 3.0 host ports; four gigabit Ethernet; TPM 2.0; hardware root-of-trust secure boot; -40 to 75 °C; 5-year warranty (specifications as reported by the fetch tool). | Moxa Industrial Linux 4 (Debian 13, kernel 6.12), end of life 2033. | <https://moxa.com/about-us/News-Events/News/2026/new-gen-arm-computers-achieve-iec-62443-4-2-SL2>; <https://www.moxa.com/en/products/industrial-computing/arm-based-computers/uc-8600a-series> (fetched). |
| Moxa UC-4400A | Same, with MIL4 Secure. | Arm Cortex-A53, quad-core, 1.6 GHz; 4 GB RAM; 16 GB eMMC; one USB 2.0 host port; two gigabit Ethernet; LTE or 5G options; TPM 2.0 (as reported by the fetch tool). | MIL3 (Debian 11, to 2031) or MIL4 (Debian 13, to 2035). | <https://www.moxa.com/en/products/industrial-computing/arm-based-computers/uc-4400a-series> (fetched). |
| ASRock Industrial iEP-5010G | "ASRock Industrial is among the first to achieve IEC 62443-4-2 certification at Security Level 2 (SL2)". Certifying body and operating system not stated in the article. | "built on a robust x86 architecture" (details not read). | Not stated. | <https://www.iotinsider.com/news/asrock-industrials-iep-5010g-achieves-iec-62443-4-2-certification>, 13 March 2025 (fetched; trade press, not the maker). |
| KUNBUS RevPi Connect 5 (Raspberry Pi Compute Module 5 inside) | **None found.** KUNBUS has a security-report address (psirt@kunbus.com), acknowledges "within 5 business days", and "runs a CSAF trusted provider". | TPM 2.0 (Infineon SLB 9670) per its datasheet. | Not researched. | <https://kunbus.com/en/security-advisories/responsible-disclosure-policy> (fetched); datasheet (snippet). |

Against the owner's test (a Raspberry Pi 4, with four Cortex-A72 cores, does the job today; several USB receivers; headroom wanted): the dual-core UC-8600A has half the cores of a Pi 4, and the quad-core UC-4400A has slower cores and one USB 2.0 port. Neither offers headroom over a Pi 4 (judgement from the specifications as reported; no benchmark run).

---

## 5. Procurement routes

Most procurement sites refused reading, so this table rests mainly on search-result text; quoted words in "snippet" rows are the search tool's wording.

| Route | Who can use it | What is on it | Source and basis |
|---|---|---|---|
| BuyICT Hardware Marketplace (Digital Transformation Agency) | "All federal, state, territory and local government agencies ... this includes government universities and government-owned corporations". | A panel of sellers, not of brands: "currently counting 201 suppliers", for "ICT hardware, infrastructure and associated services". Extended in May 2026 "until 30 June 2028". | Snippet of techpartner.news (the page refused reading); dta.gov.au and buyict.gov.au could not be read. Whether use is mandatory for end-user hardware: an older DTA article says the end-user category "is mandatory for all non-corporate commonwealth entities" (snippet; not confirmed for 2026). |
| Commonwealth cyber-risk model clauses for ICT contracts | Commonwealth buyers. | Clauses that can require sellers to comply with "the PSPF, Essential Eight maturity model and ISM, as these security requirements apply to the seller", to undergo an IRAP assessment, and to allow review of the seller's supply chain. Foreign-ownership model clauses are in "BuyICT ClauseBank" and Finance's "Commonwealth ClauseBank". | Snippet of the Australian Government Solicitor's Legal update no. 330 (ags.gov.au refused reading); ClauseBank location: Home Affairs page (fetched). |
| Local Buy LB308, "ICT Solutions, Products, Services and New Technologies" | "Local Governments of Queensland, Northern Territory, Tasmania and other approved purchasers". | A register of pre-qualified suppliers. Hardware in scope includes "desktop computers, laptops, tablets, monitors, peripherals, networking hardware and appliances, servers". One listing shows it "Awarded" on 10 June 2026. Supplier list is on VendorPanel (not read). | Snippets of australiantenders.com.au and lgat.tas.gov.au. |
| Queensland Government ICT hardware arrangements | Queensland agencies. | Arrangements listed for "Hewlett Packard (ICTSS.1009)" and "Dell Products and Services (ICTSS.1101)". | Snippet of forgov.qld.gov.au (the page has since moved; not confirmed current). |
| Victoria, End User Computing Equipment contract (DGS-ICT-04-2024) | Victorian government bodies. | "a closed panel with six suppliers, running from 25 October 2024 to 24 October 2028", including "Acer, Dell, Lenovo and HP" for desktops and notebooks. | Snippet of buyingfor.vic.gov.au. |
| NSW, ICT End User Devices and Services (Contract 9826) | NSW agencies; others can apply to buy. | Listed as mandatory, 1 October 2023 to 30 September 2026 (so due for renewal). One council page lists Dell Australia as awarded supplier. | Snippet of info.buy.nsw.gov.au. |

What this means (judgement): the brands that state panels name are Dell, HP, Lenovo and Acer. A small-form desktop from one of them is something a council or agency already buys, images, registers and disposes of; nothing about it is new to them. Toradex, Moxa and Raspberry Pi are not panel brands; they reach government through a reseller that is on a seller panel (the Hardware Marketplace and LB308 are both seller panels), or through the owner's own quote under the buyer's low-value purchasing rules. Canonical lists Ubuntu-certified small desktops from all three big brands — Dell OptiPlex Micro 7010 and 7020, Dell Pro Micro, Lenovo ThinkCentre M75q Tiny, HP Elite Mini 800 G9, HP Pro Mini 400 G9 — in a list of 484 certified Dell, HP and Lenovo desktops (<https://ubuntu.com/certified?q=&category=Desktop&vendor=Dell+Technologies&vendor=HP&vendor=Lenovo>, fetched; which Ubuntu release each is certified for was not shown).

---

## 6. Network patterns that shrink the approval, and what is still asked

| Pattern | What it removes | What an assessor still asks | Sources |
|---|---|---|---|
| **A. Own mobile link; nothing plugged into the customer's network.** The device, an antenna and a SIM of the supplier's (or the customer's) sit on site. | The customer's network controls do not apply to it: it is not "networked IT equipment" on their network (ISM-0336, ISM-0520), no proxy, no 802.1X, no endpoint agent, no scanner. It is closer to a telemetry instrument than to IT. | 1. Who owns it and who is responsible when it breaks (ISM-1569). 2. Is there *any* path to our network — an Ethernet cable "for convenience", a shared radio controller, a USB lead to one of our PCs? If yes, it is pattern B or C. 3. Where it physically sits and who can touch it. 4. What data leaves and where it goes (public rainfall and river levels to a web service; which country hosts it). 5. For the Bureau: is it a Bureau asset or a supplier's service? If a service the Bureau relies on, the service is what gets assessed. 6. For a utility: remote access from outside the organisation is a named risk ([CIRMP] s 6A). 7. Does it share an antenna or feed with our radio system, and could it transmit? (A receive-only stick cannot.) | [ISM], [CIRMP] (fetched). The reasoning is judgement. |
| **B. An isolated segment or DMZ on the customer's network, outbound HTTPS only, through their proxy, to named hosts.** | Lateral-movement worry (the JPL lesson): it cannot reach anything inside. No inbound rule. | 1. Exact destinations by name (ISM-0958: "An organisation-approved list of domain names"; proxies block "websites through their IP addresses", ISM-1171). 2. Does it work through our proxy — an explicit proxy setting, our certificate authority if we inspect TLS (ISM-0263), no certificate pinning that breaks under inspection? 3. A VLAN alone is not accepted as separation from the internet edge: "VLANs are not used to separate network traffic between an organisation's networks and public network infrastructure" (ISM-1532). 4. It is now on our register (ISM-0336), so: who patches it and how fast (ISM-1878, ISM-1751), can our scanner see it (ISM-1752), where do its logs go (ISM-1977). 5. How is it administered — from where, by whom, with what sign-in (ISM-1863, ISM-2160)? 6. Does anything on it accept commands from outside (ISM-2149, ISM-2150)? | [ISM] (fetched). |
| **C. On the corporate or operational network.** | Nothing. | Everything in section 7, plus the customer's standard build, endpoint agent and scanner. For a utility's operational network: "Segment and segregate OT from all other networks" (ASD principles, fetched) and section 8C of the rules. | [ISM], [CIRMP], ic3.gov (fetched). |

Two features of the agent as it is documented today will draw questions under B and C. I read them in the repository, not on a public page:

- **Remote management through Flood-Net.** `/home/user/RPi_ALERT/docs/remote-management.md`: "The base station calls MegaNet; MegaNet never calls the base station. There is no port to open" — good for the firewall rule. But through that outbound channel Flood-Net's administrators can "change its settings, restart it, install updates and read its log". To an assessor that is a remote-administration tool run by a third party over a cloud service. It needs to be on the customer's list of authorised tools (ISM-2149), switchable off, and logged. The document says it applies "if the base station allows it", so a setting exists.
- **Updates and SSH keys fetched from outside.** `/home/user/RPi_ALERT/docs/release-signing.md`: releases are signed with Ed25519 and "the updater refuses a release it cannot verify against a public key pinned in the image" — this answers ISM-0298's "maintains the integrity of patches". `/home/user/RPi_ALERT/docs/access.md`: SSH public keys can be "fetched from GitHub or MegaNet" hourly. A government customer will want updates on their schedule from a source they name, and SSH keys they control only.

---

## 7. The checklist: what an assessor will ask

Each line gives the question, then where it comes from. "[ISM]" lines are fetched; others are labelled.

### 7.1 The hardware

| # | Question | Source |
|---|---|---|
| H1 | Who makes it, who owns the maker, and where is it made? | ISM-1631, ISM-1452 [ISM]; [FOCI] questionnaire; [CIRMP] s 10A for utilities. |
| H2 | Until what date will the maker supply firmware fixes? | ISM-1982, ISM-1903, ISM-1904 [ISM]; Secure by Demand item 11 (fetched). |
| H3 | Does it have a hardware root of trust — UEFI Secure Boot or the chip's own secure boot — and a TPM 2.0? Is it switched on as shipped? | ISM-1745 [ISM]. |
| H4 | Can firmware be updated in the field, signed, and can we check its version? | ISM-0298, ISM-1900, ISM-1643 [ISM]. |
| H5 | Which ports are open to someone standing next to it (USB, serial console, debug header, SD card)? Can unused ones be disabled? | ISM-0343, ISM-0345, ISM-1418 [ISM]; EN 303 645 provision 5.6 (fetched). |
| H6 | Is storage soldered or removable, and is it encrypted? What is on it if it is stolen? | ISM handling and encryption guidance [ISM]; EN 303 645 provision 5.4 (fetched). |
| H7 | Does it have radios we did not ask for (Wi-Fi, Bluetooth, a cellular modem), and can they be off? | ISM-0380, ISM-2068 [ISM]. |
| H8 | How do we know the unit delivered is genuine and untampered? | ISM-1790, ISM-1791, ISM-1792 [ISM]. |
| H9 | Is there a second source, and are spares held? | ISM-1788, ISM-1789 [ISM]. |
| H10 | Does it carry the Australian compliance mark, and can it sit in our equipment room (power, temperature, mounting)? | Not a security source; standard site practice (judgement). |
| H11 | How is it wiped and disposed of at end of life? | ISM equipment sanitisation and disposal sections [ISM]. |

### 7.2 The operating system

| # | Question | Source |
|---|---|---|
| O1 | Which operating system and version? Is it the latest or the one before? | ISM-1407 [ISM]. |
| O2 | Who patches it, how fast, and until when? | ISM-1501, ISM-1878, ISM-1751, ISM-1695 [ISM]; [CIRMP] s 8A(2). |
| O3 | Is it hardened to a published benchmark, and can you show the scan result? | ISM-1409, ISM-1914 [ISM]; CIS benchmark list (fetched). |
| O4 | Are there any default accounts or passwords? | ISM-0383 [ISM]; [SMART] cl 2; EN 303 645 provision 5.1. |
| O5 | What is installed and listening? Can you give a list of open ports and running services? | ISM-0380, ISM-1416 [ISM]; EN 303 645 provision 5.6. |
| O6 | Does our endpoint agent and our vulnerability scanner support it? | ISM-1808, ISM-1752, ISM-1034 [ISM]; vendor support lists (fetched). |
| O7 | Can only approved programs run? | ISM-1490, ISM-1656 [ISM]; ASD Hardening Linux (snippet). |
| O8 | Does it send security events to our log collector, with correct time? | ISM-1977, ISM-1405, ISM-0988 [ISM]. |
| O9 | If containers are used: why, how is the engine hardened, and does any container run with full privileges? | ISM-1604 to ISM-1607 [ISM]; CIS Docker Benchmark (snippet). |

### 7.3 The application (the agent)

| # | Question | Source |
|---|---|---|
| A1 | Does it run as an unprivileged user? What needs root, and why? | ISM-1584, ISM-2128 [ISM]. |
| A2 | Is there a software bill of materials, including the Node.js runtime and `rtl_sdr`? (Zero npm dependencies makes this short.) | ISM-1730 [ISM]; Secure by Demand item 11. |
| A3 | How are updates delivered, signed and verified? Can we hold and schedule them? | ISM-0298 [ISM]; Secure by Demand item 12 "owner-controlled patch management". |
| A4 | Where do we report a security problem, and how fast do you answer? Is there a `security.txt`? | ISM-1616, ISM-1755, ISM-1717 [ISM]; [SMART] cl 3. |
| A5 | What does it connect to, on which ports, using which TLS version and ciphers? | ISM-1139, ISM-1369, ISM-1781 [ISM]. |
| A6 | Does it accept commands from the cloud service? Which ones, who can send them, can it be turned off, is each one logged? | ISM-2149, ISM-2150 [ISM]; [CIRMP] s 6A(2)(c). |
| A7 | Is there a local web page or API? Who can reach it, with what sign-in? | ISM-1863, ISM-2160 [ISM]. |
| A8 | What secrets are stored on the device (the ingest token), how, and what can someone do with a stolen one? | EN 303 645 provision 5.4 (fetched); ISM key-management guidance [ISM]. |
| A9 | Has the code had an independent security review or penetration test? Is there a threat model? | ISM-0401, ISM-2060 [ISM]; Secure by Demand item 10. |
| A10 | What happens when the link is down — does it queue, and does it fail safely? | EN 303 645 provision 5.9 (fetched). |
| A11 | What data does it send? Any personal information? | ISM-2021 data minimisation [ISM]; EN 303 645 provision 5.8. |

### 7.4 The network set-up

| # | Question | Source |
|---|---|---|
| N1 | A diagram: where it sits, every connection in and out. | ISM-0516 [ISM]. |
| N2 | Outbound only? To which named hosts? Nothing inbound from the internet? | ISM-2068, ISM-1863, ISM-0958 [ISM]. |
| N3 | Does it work through our web proxy and with our TLS inspection? | ISM-0260, ISM-0263 [ISM]. |
| N4 | Which segment, and what can it reach from there? | ISM-1181, ISM-1182 [ISM]; [CIRMP] s 8C. |
| N5 | Can it authenticate to our switch port (802.1X with a certificate)? | ISM-0520, ISM-1321, ISM-1323 [ISM]. |
| N6 | Does it use our DNS and time servers? | ISM-0988, ISM-1782 [ISM]. |
| N7 | If it has its own mobile link: is there any second path to our network? | ISM-1181 [ISM]; the JPL report (fetched). |

### 7.5 Operations

| # | Question | Source |
|---|---|---|
| P1 | Who is the system owner on our side, and is it on the equipment and software registers? | ISM-1071, ISM-0336, ISM-1493 [ISM]. |
| P2 | Who administers it, from what machine, with what sign-in? Are personal keys used and removed when people leave? | ISM-1380, ISM-1387, ISM-0485 [ISM]. |
| P3 | How do we know a patch was applied? | ISM-0298 [ISM]. |
| P4 | Who watches its logs and alerts? | ISM-0120, ISM-1228 [ISM]. |
| P5 | What do we do if it is compromised — isolate, rebuild from a known image, how long? | ISM incident guidance [ISM]; [CIRMP] s 8C(2)(b). |
| P6 | Is its configuration backed up, and can a replacement be built from it? | Protect principle PRO-10 [ISM]; Secure by Demand item 1. |
| P7 | Who has physical access to the room? | ISM-1975, ISM-0813 [ISM]; [CIRMP] s 11. |
| P8 | Annual review of the authorisation. | ISM-1587 [ISM]. |

### 7.6 The supplier

| # | Question | Source |
|---|---|---|
| S1 | Who are you (legal entity, country, owners)? | ISM-1631 [ISM]; [FOCI] question 1. |
| S2 | Who are *your* suppliers — board maker, chip maker, operating-system vendor, cloud hosts? | ISM-1452 [ISM]; [CIRMP] s 10A; OT principle 5 (fetched). |
| S3 | What shows your commitment to security: a secure development practice, a disclosure policy, past advisories, an ISO 27001 certificate or equivalent? | ISM-1568, ISM-1882, ISM-1632 [ISM]. |
| S4 | A written split of who does what (you patch the agent; we patch the operating system; who holds which keys). | ISM-1569 [ISM]. |
| S5 | Support period with an end date, and what happens if you stop. | [SMART] cl 4; Secure by Demand items 4 and 11. |
| S6 | Will you tell us about a breach of your systems (the cloud service, the signing key, the code repository)? | OLG guideline 1.10.2 (fetched); ISM-1569 [ISM]. |
| S7 | Where is the cloud service hosted, and who can reach our device from it? | [ISM] supply-chain text on offshore services (fetched); [CIRMP] s 6A(2)(c)–(d). |
| S8 | Commonwealth only: will you accept the cyber-risk and foreign-ownership model clauses? | Home Affairs FOCI page (fetched); AGS update (snippet). |

---

## 8. Hardware classes, easiest to hardest to get through

The ranking is my judgement from the sources above. It assumes the same application and the *best available* operating system for each class. Rank 1 is easiest.

| Rank | Class | Why it sits here | Limits and honest caveats |
|---|---|---|---|
| 1 | **Enterprise-brand x86 small desktop (Dell, HP; Lenovo where the buyer accepts it) running Ubuntu LTS or RHEL** | The brands are on state panels (section 5, snippets) and Ubuntu-certified (fetched). UEFI Secure Boot and TPM 2.0 are standard on this class (memory; not verified per model here). The operating system is on Defender's and Tenable's lists and has CIS and STIG benchmarks (4.2, fetched). The maker is one the buyer has already assessed. Far more processor than a Pi 4 (memory). | It is office hardware: fan, 0–35 °C class, mains power, more watts, not DIN-rail (memory; check the model). Proprietary firmware — the least "open" option. Lenovo's ownership would need the fuller foreign-ownership steps at the Commonwealth and at large utilities (my application of [FOCI]; ownership not researched). |
| 2 | **IEC 62443-4-2 certified industrial gateway with the maker's own Linux (for example Moxa UC with MIL4 Secure)** | A product certificate from an accredited body, secure boot and TPM as shipped, a 10-year operating-system promise with a stated end date, 5-year warranty (moxa.com, fetched). Strongest with utilities' operational-technology teams. Arguably assessed as an appliance. | The certified Arm models are a dual-core Cortex-A72 or a quad-core Cortex-A53 with one or two USB ports (fetched): at or below a Pi 4. The certificate holds only with the "Secure" operating system variant as configured; adding Node.js and `rtl_sdr` is the buyer's change. The maker's Linux is not on endpoint-agent lists (4.2). For an IT-led assessor (Bureau corporate network) this can rank below class 1; for an OT-led one, above it. |
| 3 | **Industrial Arm module on a carrier (Toradex Verdin on Mallow) running Ubuntu LTS or Debian — not Torizon OS** | A Swiss maker with ISO/IEC 27001:2022 (torizon.io, fetched), long product availability, TPM on the carrier and chip-level secure boot available (R1). With Ubuntu or Debian the operating-system answers are the same as class 1 for Defender; Debian on Arm lacks Tenable Agent (4.2). | Whether mainstream Ubuntu or Debian runs well on the AM62 with a maintained kernel is a hardware question for another report; if it needs the maker's kernel, the "supported by the distribution vendor" answer weakens. Secure boot on the AM62 is "Early Access" (R1). Not a panel brand. The buyer must do the non-Five-Eyes steps of the questionnaire. |
| 3 (tie) | **Raspberry Pi 5 or Compute Module 5 in an industrial carrier, running Ubuntu LTS** | UK owner: stops at question 1 of [FOCI]. A published security process with CVEs and advisories (fetched). Ubuntu is a listed operating system for Defender and Tenable Agent on Arm (fetched). The application already runs on it. Industrial carriers add a TPM (KUNBUS datasheet, snippet). | Perception: the name is the textbook "rogue device" (3.4). No stated support period on the security page (fetched). Secure boot is a one-time, do-it-yourself step (memory). Whether Ubuntu's Raspberry Pi images are covered by Ubuntu Pro's FIPS modules, and which Pi models are Ubuntu-certified, were not confirmed. |
| 5 | **Toradex module with Torizon OS and the agent in a privileged container** | The vendor strengths of class 3. | The operating system is on no endpoint or scanner list, has no benchmark, and no stated support duration (4.2, fetched). A privileged container is a standard finding (snippet). Two layers to patch and log. This is the proposal earlier agents made; of the things in this table it is the one I would change first. |
| 5 (tie) | **Raspberry Pi with Raspberry Pi OS** | Works today; UK owner. | Operating system on no list and with no benchmark (4.2). All the perception problems, none of the mitigations. Fine for pattern A (own link, off the network) at a council. |
| 7 | **Open-hardware Arm board from a small maker (Rockchip- or Allwinner-based boards and similar)** | Cheap, fast, and open schematics in some cases. | Makers rarely publish a security contact, support period or advisories (not surveyed — judgement). Board-specific kernels that lag upstream. The vendor and chip supplier are likely to trigger the full foreign-ownership assessment (my application of [FOCI]). Hardest at the Bureau and at utilities; a council would probably not ask. |

**How much is the device?** For a non-classified system, my estimate is that the board decides perhaps a fifth of the answers in section 7 (H1–H9 and parts of S1–S2), the operating system about a third (O1–O9, and it colours P1–P5), and the application, the operations and the supplier the rest. The board matters mainly through three things: who made it, how long its firmware is supported, and which mainstream operating system runs on it properly. This is a judgement, not a measurement.

**What is "open" worth?** Open source helps with transparency (ISM-1882) and with the bill of materials (ISM-1730), and the ISM does not penalise it. But no control gives credit for open *hardware*, and the classes that pass most easily (1 and 2) have closed firmware. Open source earns its place in the application and the operating system, where the assessor can read it (judgement).

---

## 9. What I would do with this (suggestions, not findings)

1. Decide the operating system first: Ubuntu LTS (with Ubuntu Pro where the customer wants the long patch service) on whatever board is chosen. Drop the Torizon-plus-privileged-container design unless a customer asks for it.
2. Offer two hardware options rather than one: an enterprise-brand x86 small desktop for buyers whose IT team leads (the Bureau, departments), and an industrial Arm option for sites that need DIN-rail, wide temperature or low power. Ask a utility's operational-technology team whether they require an IEC 62443-4-2 certificate before buying a certified gateway that is under-powered.
3. Offer pattern A (own mobile link, off the customer's network) as the default installation. It turns the approval into a hosting agreement.
4. Publish the supplier paperwork, because it is asked for in every case and costs little: a security contact and `security.txt`, a disclosure policy with response times, a stated support period with an end date, a bill of materials per release, the release-signing description that already exists, a one-page shared-responsibility table, a network data-flow page naming every host the device talks to, and a hardening guide. These map to ISM-1717, ISM-1755, ISM-1730, ISM-0298, ISM-1569 and to the three smart-device requirements.
5. Give customers a "government mode": remote commands from the cloud service off, updates manual or from a customer-named source, SSH keys local only, proxy and custom certificate-authority settings, logs to a customer syslog collector.
6. Before the first Commonwealth conversation, fill in the Home Affairs vendor questionnaire for the chosen board maker and for the project itself, and offer it.

---

## 10. Could not confirm

- **The PSPF's own wording.** protectivesecurity.gov.au could not be read. Everything about the PSPF and its directions here is from law-firm summaries, trade press, Home Affairs pages or snippets. In particular I did not read: PSPF Release 2026 and its summary of changes; the text of Directions 001-2025, 002-2025, 004-2025, 001-2026, 002-2026; the Commonwealth Technology Standard and its Deny List (so I cannot rule out hardware entries on it beyond the three items reported publicly); the exact requirement that fixes Essential Eight maturity level two.
- **ASD publications on cyber.gov.au** other than the ISM: the Essential Eight maturity model text, the seven edge-device strategies in full, "Choosing secure and verifiable technologies", "Hardening Linux workstations and servers" (October 2026), "Implementing network segmentation and segregation", the IoT guidance. Quoted only from snippets or co-published copies.
- **The Bureau's own rules for suppliers and for equipment on its observing networks.** Nothing found; bom.gov.au refused reading. Its status as a non-corporate Commonwealth entity is from a snippet of its corporate plan.
- **Queensland Audit Office reports** on councils (bot wall). Figures are from a trade-press article written by a vendor's staff.
- **Whether any Queensland water authority or council treats IS18 as binding**, and what individual councils ask of suppliers.
- **Victoria, Western Australia, South Australia, Tasmania, the territories**: Victoria only from snippets; the others not researched.
- **Current panel details**: the Hardware Marketplace's categories, whether it is mandatory in 2026, and its sellers; the LB308 supplier list; whether NSW Contract 9826 was renewed after 30 September 2026. Whether Toradex, Moxa or Raspberry Pi products are offered by any panel seller.
- **Grace-period end dates under the enhanced risk-program rules.** 10 June 2027 and 10 June 2028 are my reading of section 4A(6) with the 10 June 2026 commencement.
- **Whether a bare single-board computer sold at retail is a "relevant connectable product" or an excluded "desktop computer"** under the smart-device rules.
- **Endpoint and scanner support beyond Microsoft Defender and Tenable Agent** (CrowdStrike, SentinelOne, Qualys, Rapid7), and whether Tenable's agentless scans recognise Debian on Arm or Raspberry Pi OS.
- **Ubuntu specifics**: which Ubuntu release each Dell, HP and Lenovo small desktop is certified for; which Raspberry Pi models are certified; whether the FIPS 140-3 modules are validated on Arm; the currency of the Ubuntu Pro prices (shown as "$").
- **Per-model security hardware of enterprise small desktops** (TPM, secure boot, firmware-resilience features) — stated from memory.
- **IEC 62443-certified x86 industrial computers** beyond one trade-press article; the certificate numbers on the certifying bodies' registers; Australian prices and stock for any product named here (not my topic).
- **KUNBUS, OnLogic, Advantech, Siemens** IEC 62443 status: not established.
- **Lenovo's ownership** and how Australian agencies treat it: not researched.
- **Hikvision/Dahua and DJI decisions**: press snippets only; no official instrument read.
- **The CIS Docker Benchmark recommendation number** for privileged containers in the current version (5.4 or 5.5).
