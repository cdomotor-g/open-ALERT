// open-ALERT — the side-by-side trial: any computer that is not a Raspberry Pi,
// running RPi ALERT's signed release beside the Raspberry Pi 4 that already
// does the job, on the same antenna. The page's picker, shopping list, steps,
// speed table and results sheet.
//
// The computers to pick from are the builder's (OA_BUILDER.platforms) that are
// not a Raspberry Pi: their price, lead time, shops, speed and fit come from
// there and from the catalogue, so each figure has one home. This file adds
// what the trial needs to say about each (TRIAL.picks) and the parts every
// trial needs whatever the computer (TRIAL.items: the stick, the splitter...).
//
// Prices are Australian dollars (gst: false = ex GST), lead times in days, a
// source for every figure or conf 'low'. `aud: null` means no price could be
// read: the page says "check with the seller" and gives the seller's link, and
// the total leaves it out and says so.
//
// Every figure about speed is a stand-in until the benchmark in firmware/bench
// has run on the real computer (hardware review, reports U2 and R8).

(function () {
  'use strict';
  const isNode = typeof module === 'object' && module.exports;
  const USD = 0.69;                                   // the configurator's planning rate
  const aud = usd => Math.round(usd / USD * 100) / 100;
  const TDX = ['Toradex webshop (businesses only)', 'https://www.toradex.com/computer-on-modules/verdin-arm-family/ti-am62'];
  const E14 = ['element14 Australia', 'https://au.element14.com/'];
  const LB = ['Little Bird Electronics', 'https://littlebirdelectronics.com.au/'];
  const CORE = ['Core Electronics', 'https://core-electronics.com.au/'];
  const REV = 'https://github.com/cdomotor-g/open-ALERT/blob/main/docs/hardware-review/research/';
  const FW = 'https://github.com/cdomotor-g/open-ALERT/tree/main/firmware';
  const RELEASES = 'https://github.com/cdomotor-g/open-ALERT/releases';
  const FW_README = 'https://github.com/cdomotor-g/open-ALERT/blob/main/firmware/README.md';

  const TRIAL = {
    asof: '2026-11',

    // ── the parts every trial needs, whatever the computer ───────────────────
    // (The computer, its power and its USB hub come from the pick: listFor().)
    items: [
      { id: 'stick', need: 'must', name: 'An RTL-SDR stick of the same model as the Pi\'s (two V3s if the Pi\'s is a V4)', qty: 1,
        aud: [50.65, 195], gst: true, lead: { d: [2, 56], text: 'a V3 from its maker: free post from China in 2–4 weeks (up to 8); or a kit from an Australian shop this week; a V4 only from leftover stock, if any' },
        where: [['RTL-SDR Blog store', 'https://www.rtl-sdr.com/buy-rtl-sdr-dvb-t-dongles/'], ['Little Bird Electronics: the kit', 'https://littlebirdelectronics.com.au/products/rtl-sdr-blog-v3-usb-dongle-with-dipole-antenna-kit'], ['Core Electronics: the kit', 'https://core-electronics.com.au/rtl-sdr-blog-v3-usb-dongle-with-dipole-antenna-kit.html'], ['Robot Gear: the kit', 'https://www.robotgear.com.au/Product.aspx/Details/11408-RTL-SDR-BLOG-V3-USB-Dongle-with-Dipole-Antenna-Kit']], why: 'The same model as the Pi\'s stick, so the computers are compared and not the sticks. A V3 is about A$51 posted from its maker (2–4 weeks), or A$162–195 as a kit with antennas from an Australian shop this week: Little Bird A$185.40 inc GST, in stock (its page, 13 November 2026); Robot Gear A$161.95 as a special order and Core Electronics about A$195, from search listings. The V4 is end of line (May 2026) and out of stock: if the Pi has a V4 and you can\'t find another, buy two V3s and give the Pi one too. The V3 "will remain in stable production" (review report R10). Sticks still differ one from another — the plan swaps them halfway. Keep the radio a replaceable USB part.',
        src: [['RTL-SDR Blog store: V3 dongle only', 'https://www.rtl-sdr.com/product/rtl-sdr-blog-v3-r820t2-rtl2832u-1ppm-tcxo-sma-software-defined-radio-dongle-only/'], ['RTL-SDR Blog V4 (out of stock)', 'https://www.rtl-sdr.com/product/rtl-sdr-blog-v4-r828d-rtl2832u-1ppm-tcxo-sma-software-defined-radio-dongle-only/'], ['Hardware review R10: the radio', REV + 'R10-custom-hardware-and-sdr.md'], ['RPi ALERT hardware notes', 'https://github.com/cdomotor-g/RPi_ALERT/blob/main/docs/hardware.md']], conf: 'medium' },
      { id: 'splitter', need: 'must', name: 'VHF 2-way power divider (N-type)', qty: 1,
        aud: [239.04, 239.04], gst: true, lead: { d: [4, 12], text: 'Techwave ships from stock in 1–2 business days, plus 3–8 days\' courier' },
        where: [['Techwave (RFI, Pulse, PolyPhaser dealer)', 'https://store.techwave.com.au/']], why: 'One antenna feeding both computers, so both hear exactly the same bursts: RFI\'s SP1318-5102-11, A$239 in stock at Techwave. Costs each side about 3.5 dB (a measure of signal strength: 3 dB is half the power) — record the Pi\'s figures before you fit it.',
        src: [['Techwave: RFI SP1318-5102-11 2-way 130–180 MHz N-F, A$239.04, InStock', 'https://store.techwave.com.au/products/rfi-power-splitter-2-way-130-180-mhz-100w-nf']], conf: 'high' },
      { id: 'leads', need: 'must', name: 'RF leads: an SMA-to-N pigtail for the new stick, and a short N–N jumper to the splitter', qty: 1,
        aud: [62.57, 103.53], gst: true, lead: { d: [4, 12], text: 'Techwave ships from stock in 1–2 business days, plus 3–8 days\' courier' },
        where: [['Techwave (RFI, Pulse, PolyPhaser dealer)', 'https://store.techwave.com.au/']], why: 'A 0.5 m SMA-male to N-male lead for the new stick (A$25) and a 1 m N–N jumper for the Pi\'s pigtail (A$37); A$104 with a right-angle lead. The feedline\'s N plug goes into the splitter\'s input.',
        src: [['Techwave: Pulse RG58 SMA-male to N-male 0.5 m, A$25.22', 'https://store.techwave.com.au/products/pulse-rg58-cable-lead-sma-male-to-n-male-0-5m'], ['Techwave: Pulse RG58 N-male to N-male 1 m, A$37.35, InStock', 'https://store.techwave.com.au/products/pulse-rg58-n-male-to-n-male-cable-lead-1m'], ['Techwave: Pulse RG58 N-female to right-angle SMA-male 0.5 m, A$66.18, InStock', 'https://store.techwave.com.au/products/pulse-rg58-n-female-to-right-angle-sma-male-cable-lead-0-5m']], conf: 'medium' },
      { id: 'eth', need: 'must', name: 'Ethernet patch lead and a spare switch or router port', qty: 1,
        aud: [2.5, 12.95], gst: true, lead: { d: [1, 7], text: 'any electronics or computer shop' }, where: [LB, ['Mwave', 'https://www.mwave.com.au/'], ['Jaycar', 'https://www.jaycar.com.au/']], why: 'Use Ethernet, as the Pi does, so the network isn\'t a difference.', src: [['Little Bird: CAT 5 Ethernet cable A$2.50', 'https://littlebirdelectronics.com.au/products/cat-5-ethernet-cable'], ['Mwave: StarTech 2 m Cat6 A$12.95', 'https://www.mwave.com.au/products/startech-2m-cat6-sftp-patch-cable-black-ab93699']], conf: 'high' },
      { id: 'usbstick', need: 'maybe', name: 'A USB stick of 8 GB or more to install the operating system from', qty: 1,
        aud: null, gst: true, lead: { d: [1, 7], text: 'any electronics or computer shop' }, where: [['Mwave', 'https://www.mwave.com.au/'], ['Jaycar', 'https://www.jaycar.com.au/']],
        why: 'Only if you have none to spare. Price not read: check with the seller.', src: [], conf: 'low' },
      { id: 'meters', need: 'nice', name: 'Power meters: an in-line DC meter for a 12 V computer, a USB-C meter for the Pi', qty: 1,
        aud: [54.5, 64.25], gst: true, lead: { d: [1, 7], text: 'Jaycar stores or online, and Little Bird\'s Sydney stock' }, where: [['Jaycar', 'https://www.jaycar.com.au/'], LB],
        why: 'Watts matter on a solar site. Jaycar\'s 20 A DC meter (QP2320, about A$35) for a 12 V computer, a USB-C meter (about A$20–30) for the Pi. A computer on a mains adapter needs a plug-in mains meter instead (not priced here).', src: [['Jaycar QP2320 20A 6.5–100V DC power meter, A$34.95 (search listing)', 'https://jaycar-prod.australia-southeast1.gcp.storefrontcloud.io/p/QP2320'], ['Little Bird: Type-C USB Power Meter Tester A$19.55, 9 in Sydney', 'https://littlebirdelectronics.com.au/products/type-c-usb-power-meter-tester'], ['Little Bird: Mini OLED USB C Power Analyzer A$29.30', 'https://littlebirdelectronics.com.au/products/mini-oled-usb-c-power-analyzer-ada6271']], conf: 'medium' },
    ],

    // ── the computers to pick from ───────────────────────────────────────────
    // `id` is the builder's platform id. group: the page's groups (D of the
    // review's decisions). route: 'package' (open-alert-base on Debian 13 or
    // Ubuntu 24.04) or 'verdin' (Torizon OS and the container with no
    // privileges). role: the chip. built: what it is built with, in a line.
    // why: what the review says of it. os: the operating system line.
    // power: how it is fed. extra: the parts besides the computer.
    groups: [
      ['first', 'First choice', 'a fanless small PC on Intel\'s N150, with a TPM and UEFI Secure Boot, on stock Debian 13 or Ubuntu 24.04'],
      ['start', 'Cheapest way to start', 'for the bench and an air-conditioned room only'],
      ['hot', 'Hot cabinets', 'built for heat'],
      ['cert', 'Certified industrial', 'the easiest to take through an IT review after the big brands'],
      ['open', 'Open hardware', 'the design files are under an open licence'],
      ['general', 'A general entry', 'any other fanless industrial PC: its speed depends on its processor'],
      ['toradex', 'Toradex, if you are staying', 'on Torizon OS with the container that has no privileges'],
    ],
    picks: [
      { id: 'onlogic-cl260', group: 'first', role: 'buy', route: 'package',
        built: 'TPM 2.0 · 12–24 V DC on a terminal block · fanless · Ubuntu 24.04 from the maker',
        why: 'The pick for a 12 V or 24 V site: it runs from a site battery with no converter. TPM 2.0, Ubuntu 24.04 offered by the maker, 0–50 °C. Bought direct from OnLogic: no Australian distributor found.',
        os: 'Ubuntu 24.04 LTS, which OnLogic offers for it (or Debian 13).', power: '12 V supply with bare leads to its terminal block (12–24 V in), or the site\'s own battery.', psu: 'wide' },
      { id: 'lenovo-thinkedge-se10n-gen2', group: 'first', role: 'buy', route: 'package',
        built: 'discrete TPM 2.0 · Secure Boot · fanless by Lenovo\'s description · DIN rail · 20 V adapter',
        why: 'The pick where IT wants a brand it already buys: a TPM chip of its own, Secure Boot and a three-year on-site warranty option. Lenovo\'s specification lists it as certified for Ubuntu Server and Red Hat Enterprise Linux; Canonical\'s public list did not show it on 13 November 2026, so ask Lenovo for the certificate and which release it covers. 0–40 or 0–50 °C versions, both rated with moving air (ask for the 0–50 °C one for a cabinet; the eight-core chip comes only in that one). No Australian price found: Lenovo Australia or a partner, by quote.',
        os: 'Debian 13 or Ubuntu 24.04 LTS. Lenovo\'s sheet names Ubuntu Server 26.04 as the Ubuntu it can ship with, which the package has not been tried on.', power: 'Its 20 V adapter, which you ask for with the quote.', psu: 'mains' },
      { id: 'protectli-vault-vp2430', group: 'first', role: 'buy', route: 'package',
        built: 'open-source start-up firmware (coreboot) · optional TPM · fanless · −10 to 50 °C · 12 V',
        why: 'The pick if open firmware matters most: coreboot is open-source start-up firmware. Ask for the optional TPM. No Australian stockist found; its list price is C$649, which this page cannot turn into Australian dollars.',
        os: 'Debian 13 or Ubuntu 24.04 LTS.', power: 'Its own 12 V, 5 A mains supply, which comes with it (its page says); up to 45 W.', psu: 'mains' },

      { id: 'mini-pc-n150', group: 'start', role: 'start', route: 'package',
        built: 'N100 / N150 · a consumer brand · mains adapter · a TPM only if the BIOS offers one',
        why: 'The cheapest way to learn what an N150 does with your channels: about A$230–350 from an Australian shop. Bench and air-conditioned room only: consumer brands are rated 0–35 or 40 °C, and the hardware review ranks them last of the small PCs for an IT review (its own judgement). Not for a cabinet.',
        os: 'Debian 13 or Ubuntu 24.04 LTS (it may arrive with Windows: wipe it).', power: 'Its own mains adapter (in the box).', psu: 'mains' },
      { id: 'lenovo-m920q-tiny-refurb', group: 'start', role: 'start', route: 'package',
        built: 'Core i5-8500T · ex-lease · a brand IT knows · has a fan · mains adapter',
        why: 'A refurbished ex-lease ThinkCentre Tiny, about A$240–320 when a refurbisher has one. PB Tech listed one at about A$322 (a search listing); Reboot IT\'s page, read on 13 November 2026, said A$239 on sale (A$299 regular) including GST, and that it had sold. A brand IT knows, but it has a fan and is rated for a room. Its speed — about four Pi 4 cores a core — is from memory only and unverified: this is what the benchmark is for.',
        os: 'Debian 13 or Ubuntu 24.04 LTS (it may arrive with Windows 11: wipe it).', power: 'Its own mains adapter (in the box).', psu: 'mains' },

      { id: 'compulab-fitlet3', group: 'hot', role: 'hot', route: 'package',
        built: 'Atom x6425E · −40 to 85 °C · 7–42 V DC · TPM · fanless',
        why: 'The one for a hot cabinet: −40 to 85 °C and 7–42 V DC. Fast enough for today\'s channels, but short of the ALERT2 buying rule. Metromatics (Brisbane office), by quote.',
        os: 'Debian 13 or Ubuntu 24.04 LTS.', power: 'A 12 V supply with bare leads (7–42 V in), or a site battery.', psu: 'wide' },

      { id: 'moxa-uc-4400a', group: 'cert', role: 'cert', route: 'package',
        built: 'Moxa Industrial Linux 4 Secure (Debian 13-based) · IEC 62443-4-2 Security Level 2 by Moxa\'s own statement · TPM · secure boot · 9–48 V DC · ONE USB 2.0 port',
        why: 'The certified one: ordered with Moxa Industrial Linux 4 Secure, patched to 2035, five-year warranty. About 0.65 of a Pi 4, so a small older-ALERT site, not ALERT2 growth. It has ONE USB 2.0 port: two sticks need a powered hub. Not checked: whether Moxa\'s Secure system lets you install Node.js and the radio driver from Debian\'s packages, which the package needs, and the package has not run on any ARM computer: ask Moxa or the seller before ordering. Quote from IP Trading or Colterlec. The faster certified computer to ask about is Eurotech\'s ReliaCOR 40-13 (in the table below; no Australian stockist found).',
        os: 'Moxa Industrial Linux 4 Secure (Debian 13-based), which it is ordered with.', power: 'A 12 V supply with bare leads (9–48 V in), or a site battery.', psu: 'wide', hub: true },

      { id: 'beagley-ai', group: 'open', role: 'open', route: 'package',
        built: 'OSHWA-certified open design · TI AM67A · four USB 3 ports · 4 GB · microSD only · 5 V USB-C',
        why: 'About A$150–156 at Pakronics or Core Electronics. About half a Pi 4: a small older-ALERT site, not ALERT2 growth, and the hardest class to take through an IT review. microSD only, so keep the card good and the writes few.',
        os: 'BeagleBoard.org\'s own Debian image, written to a microSD card.', power: 'A 5 V USB-C supply of the size its maker lists.', psu: '5v' },
      { id: 'beagleplay', group: 'open', role: 'open', route: 'package',
        built: 'open design · 16 GB eMMC · ONE USB host port · its chip can never do secure boot · 5 V',
        why: 'About A$220–267. The same chip as the Verdin AM62 and the same half of a Pi 4. It has ONE USB host port, so two sticks need a powered hub, and its chip can never do secure boot.',
        os: 'BeagleBoard.org\'s own Debian image.', power: 'A 5 V supply of the size its maker lists.', psu: '5v', hub: true },

      { id: 'fanless-industrial-x86', group: 'general', role: 'gen', route: 'package',
        built: 'a fanless industrial PC: wide DC input, a TPM on the better ones',
        why: 'Any other fanless industrial PC of this kind. Its speed depends on the processor: an Atom x6000E box is about 1.8 times a Pi 4 a core (the figure used here) and misses the ALERT2 rule, while one with an N150-class or Core processor meets it. Check the chip, the TPM, Secure Boot, the DC range and the temperature rating against the first choices before you choose it.',
        os: 'Debian 13 or Ubuntu 24.04 LTS, if the maker supports it.', power: 'A 12 V supply with bare leads (check the maker\'s DC range first), or a site battery.', psu: 'wide' },

      { id: 'toradex-verdin-imx95-mallow', group: 'toradex', role: 'tdx', route: 'verdin',
        built: 'six newer cores · USB 3 and PCIe · TPM 2.0 on the Mallow carrier · 7–24 V · supply promised to 2039 for the module, 2034 for the carrier',
        why: 'If you are staying with Toradex, this and not the AM62: the Verdin iMX95 Hexa 4GB (part 0227, US$337.50) on the same Mallow carrier. Six newer cores, USB 3 and PCIe, supply promised to 2039 for the module and to 2034 for the Mallow carrier. Its datasheet is still preliminary and its speed unmeasured (about 1.1 times a Pi 4 as a whole, 0.75 a core: an estimate nobody has measured). The container (firmware/container) is new and not released: it has only been tried with stand-ins for the radio on one PC, never on Torizon OS or an ARM computer.',
        os: 'Torizon OS, written with Toradex Easy Installer; Toradex does not support plain Debian on a Verdin.', power: 'A 12 V supply to Mallow\'s Phoenix power plug (7–24 V in).', psu: 'phoenix' },
      { id: 'toradex-verdin-am62-mallow', group: 'toradex', role: 'notrec', route: 'verdin',
        built: 'four Cortex-A53 · USB 2.0 on one shared bus · no PCIe on the M.2 slot · secure boot still Early Access · supply to 2033',
        why: 'Not recommended: about half a Pi 4 (0.5, range 0.45–0.6, never measured on this chip), about US$421 a set (about A$670 from Toradex with GST added, before the courier), and Torizon OS is the only supported system. Kept here for those who still want it: see "If you still want the Verdin".',
        os: 'Torizon OS, written with Toradex Easy Installer.', power: 'A 12 V supply to Mallow\'s Phoenix power plug (7–24 V in).', psu: 'phoenix' },
      { id: 'toradex-verdin-am62-dual-mallow', group: 'toradex', role: 'notrec', route: 'verdin',
        built: 'two Cortex-A53 · USB 2.0 on one shared bus · no PCIe on the M.2 slot · supply to 2033',
        why: 'Not recommended: a quarter of a Pi 4. The Dual 1GB IT is US$206.25 on its own, about US$321 a set with Mallow and the heatsink.',
        os: 'Torizon OS, written with Toradex Easy Installer.', power: 'A 12 V supply to Mallow\'s Phoenix power plug (7–24 V in).', psu: 'phoenix' },
    ],

    // Every Verdin AM62 Toradex lists (its datasheet and price list). Prices
    // are Toradex's own, US$ for one (review report R1, read from Toradex's
    // own .cn site on 2026-11-11); `usd: null` where the review read none.
    // element14 Australia's listed prices are stale and its listing 4852670 is
    // mistitled, so none are used. `cores × GHz` sets the speed: an A53 at
    // 1.4 GHz is half a Pi 4 core.
    variants: [
      { pid: '00761200', name: 'Quad 2GB WB IT', cores: 4, ghz: 1.4, ram: '2 GB', emmc: '16 GB', wifi: true, temp: '−40 to +85 °C', usd: 306.00, pick: 'notrec',
        why: 'The AM62 the old trial chose: US$306.00 for one, about three times what the old trial assumed. About half a Pi 4 (0.5, range 0.45–0.6).' },
      { pid: '00741201', name: 'Dual 1GB IT', cores: 2, ghz: 1.4, ram: '1 GB', emmc: '8 GB', wifi: false, temp: '−40 to +85 °C', usd: 206.25, pick: 'notrec',
        why: 'A quarter of a Pi 4. element14 lists it as 00741200, the previous revision.' },
      { pid: '00751201', name: 'Dual 1GB WB IT', cores: 2, ghz: 1.4, ram: '1 GB', emmc: '8 GB', wifi: true, temp: '−40 to +85 °C', usd: null, pick: 'notrec',
        why: 'As the Dual with Wi-Fi. No price read: check with Toradex.' },
      { pid: '00731200', name: 'Dual 1GB ET', cores: 2, ghz: 1.4, ram: '1 GB', emmc: '4 GB', wifi: false, temp: '−20 to +85 °C', usd: null, pick: 'out',
        why: 'Only 4 GB of eMMC is tight for Torizon OS and a container. No price read.' },
      { pid: '00721201', name: 'Solo 512MB WB IT', cores: 1, ghz: 1.0, ram: '512 MB', emmc: '4 GB', wifi: true, temp: '−40 to +85 °C', usd: null, pick: 'out',
        why: 'One core at 1.0 GHz and 512 MB: not four channels. No price read.' },
      { pid: '00711200', name: 'Solo 512MB', cores: 1, ghz: 1.0, ram: '512 MB', emmc: '4 GB', wifi: false, temp: '0 to +70 °C', usd: null, pick: 'out',
        why: 'As the Solo, and only 0–70 °C: too narrow for a box in the sun. No price read.' },
    ],
    // The Verdin's carrier and its heatsink, US$ for one (R1).
    verdinParts: { mallow: { usd: 100.65, code: '01611102' }, heatsink: { usd: 14.40, code: '23111101' }, oldHeatsink: '23111001', imx95: { usd: 337.50, code: '0227' } },

    // The table's other rows, for comparison: catalogue records only (the
    // Luna, the Raspberry Pi range, and three computers not yet in the builder).
    // `ref` names the catalogue record, which holds CPU, memory, rating, price
    // and sources; `hw.sdrCh` ÷ 2 is the whole computer in Pi 4 cores.
    others: [
      { group: 'cat', ref: 'dell-optiplex-micro', short: 'Dell OptiPlex Micro / Pro Micro', role: 'start', est: true, floor: true,
        why: 'A TPM and Ubuntu-certified models: the easiest paper trail for IT. Check the model: the OptiPlex Micro 7020 and 7010 are certified on Ubuntu 22.04 only, which is too old for the package; the one found certified on 24.04 is the Dell Pro Micro Plus QBM1250. Has a fan, so a room, not a cabinet. Bought new by quote. Its processor has no figure in the review: the speed shown is a floor (no slower than an N150).' },
      { group: 'cat', ref: 'eurotech-reliacor-40-13', short: 'Eurotech ReliaCOR 40-13', role: 'cert', est: true, floor: true,
        why: 'The fast certified computer to ask about: a certified PC on Ubuntu 22.04, by the ISASecure register. No Australian stockist found, and nothing was read from its maker: the speed shown is a floor (no slower than an N150), not a figure.' },
      { group: 'cat', ref: 'olimex-imx8mp-som-evb', short: 'Olimex iMX8MP SOM + EVB', role: 'open', est: true,
        why: 'Open hardware (OSHWA, CERN-OHL-S, KiCad files; made in Bulgaria): EUR 156 + EUR 50 from Olimex, no Australian stockist. The best open start for a board of your own, not a computer to trial first.' },
      { group: 'luna', ref: 'toradex-luna-sl1680', short: 'Luna SL1680', role: 'comp', est: true,
        why: 'Comparison only: a sample product "for evaluation/development" on the chip-maker\'s own kernel, a five-year commitment, about 1.2 times a Pi 4 (1.0–1.4), US$145, no Australian stock.' },
      { group: 'pi', ref: 'rpi-zero-2w', short: 'Pi Zero 2 W', role: 'ref', est: true, why: 'About 0.4 of a Pi 4 (the repository\'s 0.25 was wrong). One micro-USB port and 512 MB.' },
      { group: 'pi', ref: 'rpi-3b-plus', short: 'Pi 3B+', role: 'ref', est: true, why: 'About half a Pi 4: four channels on a busy day are at its limit.' },
      { group: 'pi', ref: 'rpi-4-4gb', short: 'Pi 4', role: 'yard', est: false, why: 'The yardstick, and the computer this trial compares against.' },
      { group: 'pi', ref: 'rpi-5-4gb', short: 'Pi 5', role: 'ref', est: true, why: 'About 2.2 times a Pi 4, the cheapest fast ARM; a Pi, though. A KUNBUS RevPi Connect 5 puts a CM5 in a DIN-rail case with a TPM.' },
      { group: 'pi', ref: 'rpi-cm5-io', short: 'CM5 + IO board', role: 'ref', est: true, why: 'A Pi 5 as a module; eMMC and −20 to +85 °C. Often out of stock in Australia.' },
    ],

    // What to compare, where to read it, and how it passes. The ids are what a
    // saved results sheet is keyed by: do not rename them. `pi1`, `am1`, `pi2`,
    // `am2` in a saved sheet are the Pi and the trial computer, weeks 1 and 2.
    measures: [
      { id: 'decoded', name: 'Bursts decoded (a week)', where: 'Each computer\'s Overview (each channel\'s count), or Flood-Net\'s Reception Map filtered to the receiver', rule: 'ratio', min: 0.98, unit: '' },
      { id: 'undecoded', name: 'Bursts heard but not decoded (a week)', where: 'Each computer\'s Overview', rule: 'info', unit: '' },
      { id: 'snr', name: 'Median SNR on a station both hear (dB)', where: 'Each computer\'s Receivers page, or the Reception Map', rule: 'close', tol: 2, unit: 'dB' },
      { id: 'busy', name: 'Decoder busy, busiest channel, worst hour (%)', where: 'Each computer\'s Overview: Decoder busy is the share of one core that channel takes', rule: 'max', max: 70, unit: '%' },
      { id: 'cpuall', name: 'Whole processor busy, worst hour (%)', where: 'The computer\'s own monitor (top), all cores together', rule: 'max', max: 70, unit: '%' },
      { id: 'dropped', name: 'Times a channel dropped samples', where: 'Each computer\'s Overview and log', rule: 'max', max: 0, unit: '' },
      { id: 'temp', name: 'Hottest the processor got (°C)', where: 'The top of each computer\'s Overview', rule: 'max', max: 70, unit: '°C' },
      { id: 'watts', name: 'Power draw, typical (W)', where: 'The power meters', rule: 'info', unit: 'W' },
      { id: 'restarts', name: 'Restarts of its own', where: 'The computer\'s log, and Flood-Net\'s Base Stations tab', rule: 'max', max: 0, unit: '' },
      { id: 'gaps', name: 'Check-in gaps (count both computers\' own)', where: 'Flood-Net\'s Base Stations tab: the connection log, one row for each', rule: 'own', unit: '' },
    ],

    // Step 0: the benchmark's figures (firmware/bench). `rule` is how each is read.
    bench: [
      { id: 'core', name: 'One core, times a Pi 4 core', where: 'The summary\'s first line', rule: 'core' },
      { id: 'whole', name: 'The whole computer, times a Pi 4', where: 'Its second line', rule: 'whole' },
      { id: 'comfy', name: 'Channels it carries comfortably', where: 'Its third line, the first count', rule: 'comfy' },
      { id: 'most', name: 'Channels at the very most', where: 'Its third line, the second count', rule: 'most' },
      { id: 'ok', name: 'Every test burst read correctly (yes or no)', where: 'Its last line', rule: 'ok' },
    ],
  };

  // ── words that mean something particular on this page ─────────────────────
  // Each gets its meaning on hover where it is used (term(), in the page) and
  // in the list under the page (#trial-terms). The builder's own words
  // (Pi 4 core, one core, the whole computer, window, busy computer) are used
  // from its list (OA_BUILD_API.TERMS) as well.
  const TERMS = {
    trialcomputer: ['the trial computer', 'The computer that is not a Raspberry Pi, run beside the Raspberry Pi 4 on the same antenna to see if it does the same job.'],
    speed: ['Speed', 'How much decoding the computer does, as a multiple of a Raspberry Pi 4 (a Pi 4 is 1.0): first the whole computer, then one core. No published benchmark runs this program, so every figure here is a stand-in until the benchmark has run on the real computer.'],
    rule: ['ALERT2 rule', 'A rule for buying with room to grow: at least four cores, each at least 2.5 times a Raspberry Pi 4 core. One ALERT2 channel with every time slot used needs more work than any Pi 4 core can do, and a channel cannot use more than one core.'],
    alltogether: ['All together', 'All the radio channels at once, as a share of the whole computer. Plan for 70% or less, so a storm has room. The two figures run from the measurement alone to a busy computer.'],
    busiest: ['Busiest channel', 'The hungriest single channel, as a share of ONE of the computer\'s cores. A channel cannot be spread over several cores, so this can bite even when the computer as a whole is idle. Plan for 70% or less.'],
    tpm: ['TPM', 'A small security chip on the computer\'s board that keeps secrets safe and lets IT check the computer has not been tampered with. Security reviews ask for one.'],
    secureboot: ['Secure Boot', 'A start-up check: the computer starts only software signed by a maker it trusts, so nobody can slip something in underneath.'],
    fanless: ['Fanless', 'No fan to clog with dust or wear out: the case is the heatsink. Such computers run hotter, so check the temperature rating.'],
    rated: ['Rated', 'The air temperature range the maker says the computer works in. A cabinet in the sun can be 20 °C hotter than the air outside it.'],
    quote: ['by quote', 'The seller does not publish a price: you ask, and they tell you.'],
    check: ['check with the seller', 'No Australian price could be read for this. The link goes to the seller; the total on this page leaves it out.'],
    hub: ['powered hub', 'A USB hub with its own power supply. It is needed when the computer has only one USB port for two sticks, or cannot power them both.'],
    bench: ['benchmark', 'A short test (firmware/bench in the open-ALERT repository) that times RPi ALERT\'s own decoder on a computer and says how many channels it can carry. It needs no radio stick and no network.'],
    package: ['package', 'A single file that installs a program the way Debian and Ubuntu install anything: sudo apt install. open-ALERT\'s package is named open-alert-base.'],
    container: ['container with no privileges', 'The program runs in a sealed box on top of the operating system, and the box is not allowed to change anything outside itself. Torizon OS runs programs this way.'],
    profile: ['profile', 'A short list of settings. The standard profile behaves like a Pi base station on a small network. The enterprise profile has no hotspot, no remote changes from Flood-Net, no self-reboots, and a dashboard reachable from the computer itself only.'],
    token: ['ingest token', 'The code that lets a base station send readings to Flood-Net. You ask for one on the computer, and an administrator approves it from Flood-Net\'s Admin tab.'],
    snr: ['SNR', 'Signal-to-noise ratio, in dB: how far a signal stands above the background hiss. Higher is better; a difference under 2 dB between the computers counts as the same.'],
    decoderbusy: ['Decoder busy', 'On a computer\'s Overview, the share of one processor core that channel\'s decoder takes, bursts and all. Under 70% leaves room for a storm.'],
    dropped: ['dropped samples', 'The computer fell behind the stick and threw away some of the radio signal: bursts in that moment are lost.'],
    swap: ['swap the sticks', 'No two sticks are equally good (one heard the same bursts 9–19 dB weaker). Moving each stick to the other computer halfway cancels that out.'],
    shared: ['a gap both share', 'If the Pi and the trial computer both fail to check in at the same time, the network or Flood-Net was out, not the trial computer. Only a gap the Pi does not have counts against it.'],
  };

  // ── the computer's own line of the shopping list ──────────────────────────
  // The builder holds each computer's price, lead time, shops and sources, and
  // the catalogue the rest: so the trial reads them from there.
  function data() {
    if (isNode) {
      const FILES = ['alert', 'compute', 'radio', 'sensors', 'power', 'site'];
      return { BD: require('../data/builder.js'), CAT: [].concat(...FILES.map(f => require(`../data/${f}.js`))) };
    }
    return { BD: globalThis.OA_BUILDER, CAT: globalThis.OA_CATALOG || [] };
  }
  const platform = id => { const d = data(); return d.BD && d.BD.platforms.find(p => p.id === id); };
  const record = id => data().CAT.find(c => c.id === id);
  const pickOf = id => TRIAL.picks.find(p => p.id === id);

  // The shopping list for a pick: the computer, how it is fed, a hub if it has
  // too few USB ports for two sticks, then the parts every trial needs.
  function listFor(id) {
    const pk = pickOf(id), P = pk && platform(id);
    if (!pk || !P) return TRIAL.items.slice();
    const priced = P.aud && P.aud[0] != null;
    const out = [{ id: 'computer', need: 'must', name: P.parts || (record(id) && record(id).name) || P.short, qty: 1,
      aud: priced ? P.aud.slice() : null, gst: P.gst !== false, quote: !priced, lead: P.lead, where: P.where || [],
      why: P.fit, src: P.src || [], conf: P.conf || 'low' }];
    if (pk.psu === 'wide') out.push({ id: 'psu', need: 'must', name: 'A 12 V supply with bare leads for its terminal block (or the site\'s own battery)', qty: 1,
      aud: [33.95, 45], gst: true, lead: { d: [1, 7], text: 'Jaycar stores or online, and Little Bird' }, where: [['Jaycar', 'https://www.jaycar.com.au/'], LB],
      why: 'Jaycar\'s 12 V 2.5 A supply (MP3490, about A$30) with a A$4 screw-terminal adapter. Check the maker\'s power rating first, and that 12 V is inside its DC range; on a battery site, wire it to the battery instead. The top of the range is an estimate.',
      src: [['Jaycar MP3490 12V DC 2.5A power supply A$29.95 (search listing)', 'https://jaycar-prod.australia-southeast1.gcp.storefrontcloud.io/p/MP3490'], ['Little Bird: Female DC power adapter, 2.1 mm jack to screw terminal, A$4.00, 4 in Sydney', 'https://littlebirdelectronics.com.au/products/female-dc-power-adapter-2-1mm-jack-to-screw-terminal-block']], conf: 'low' });
    if (pk.psu === 'phoenix') out.push({ id: 'psu', need: 'must', name: '12 V 2.5 A supply with a screw-terminal lead (and Mallow\'s Phoenix power plug if it isn\'t in the box)', qty: 1,
      aud: [33.95, 45], gst: true, lead: { d: [1, 7], text: 'Jaycar stores or online, and Little Bird. The Phoenix 1805410 plug comes from RS or Mouser' },
      where: [['Jaycar', 'https://www.jaycar.com.au/'], LB, ['RS Components Australia', 'https://au.rs-online.com/']],
      why: 'Mallow takes 7–24 V on a Phoenix Contact header (its mate is the 1805410). Jaycar\'s 12 V 2.5 A supply (MP3490, about A$30) with a A$4 screw-terminal adapter, or the site\'s own 12 V. The plug\'s price was not read.',
      src: [['Mallow datasheet (power input)', 'https://docs.toradex.com/116791-mallow_carrier_board_datasheet.pdf'], ['Jaycar MP3490 12V DC 2.5A power supply A$29.95 (search listing)', 'https://jaycar-prod.australia-southeast1.gcp.storefrontcloud.io/p/MP3490'], ['Little Bird: Female DC power adapter, 2.1 mm jack to screw terminal, A$4.00, 4 in Sydney', 'https://littlebirdelectronics.com.au/products/female-dc-power-adapter-2-1mm-jack-to-screw-terminal-block']], conf: 'low' });
    if (pk.psu === '5v') out.push({ id: 'psu', need: 'must', name: 'A 5 V supply of the size its maker lists', qty: 1,
      aud: null, gst: true, lead: { d: [1, 7], text: 'Core Electronics or Little Bird, from stock' }, where: [CORE, LB],
      why: 'A phone charger may not give it enough: read the maker\'s page for the current and the plug, then check with the seller. Price not read.', src: [], conf: 'low' });
    // The trial puts one stick on the trial computer, so its one USB port is enough: a hub is for a second stick.
    const hub = pk.hub ? [{ id: 'hub', need: 'maybe', name: 'A powered USB hub, only if you run a second stick on it (it has one USB port)', qty: 1,
      aud: null, gst: true, lead: { d: [1, 7], text: 'any computer shop' }, where: [['Mwave', 'https://www.mwave.com.au/'], CORE],
      why: 'The trial\'s one stick goes straight into the computer\'s one USB port. One port cannot feed two sticks: for a second, choose a hub with its own power supply. Whether two sticks run well through a hub on this computer has not been tested. Price not read: check with the seller.', src: [], conf: 'low' }] : [];
    return out.concat(TRIAL.items, hub);
  }

  // Delivery for a list: each priced item is bought from the first shop it
  // names, and each shop delivers once (the builder's B.shops, [small, large]
  // A$ inc GST, free over its threshold); an overseas order over A$1,000 pays a
  // clearance charge at the border. Unpriced items are not counted.
  // → { lines: [{ name, lo, hi, parts, sh }], lo, hi, unknown }
  function delivery(items) {
    const BD = data().BD;
    const shops = (BD && BD.shops) || {}, IM = BD && BD.import;
    const find = n => Object.keys(shops).find(k => n === k || n.startsWith(k + ' ') || n.startsWith(k + ':'));
    const inc = (v, gst) => gst === false ? v * 1.1 : v;
    const by = new Map();
    for (const it of items) {
      if (!it.where.length || !it.aud) continue;
      const k = find(it.where[0][0]) || it.where[0][0];
      const g = by.get(k) || { name: k, sh: shops[k] || null, vlo: 0, vhi: 0, parts: [] };
      g.vlo += inc(it.aud[0], it.gst) * it.qty; g.vhi += inc(it.aud[1], it.gst) * it.qty; g.parts.push(it.name.split(' — ')[0]);
      by.set(k, g);
    }
    const lines = [], unknown = [];
    for (const g of by.values()) {
      if (!g.sh) { unknown.push(g.name); continue; }
      let lo = g.sh.ship[0], hi = g.sh.ship[1];
      if (g.sh.freeOver != null && g.vlo >= g.sh.freeOver) { lo = 0; hi = 0; }
      else if (g.sh.freeOver != null && g.vhi >= g.sh.freeOver) { lo = 0; hi = g.sh.ship[0]; }
      const over = g.sh.from !== 'AU' && !g.sh.ddp && IM && g.vhi > IM.threshold;
      if (over) { hi += IM.clearance[1]; if (g.vlo > IM.threshold) lo += IM.clearance[0]; }
      lines.push(Object.assign(g, { lo: Math.min(lo, hi), hi, over }));
    }
    return { lines, lo: lines.reduce((a, l) => a + l.lo, 0), hi: lines.reduce((a, l) => a + l.hi, 0), unknown };
  }

  // The total for what you need: priced items inc GST, delivery, and how many
  // items have no price. → { lo, hi, loAll, hiAll, unpriced, D }
  function totals(items) {
    const inc = (v, gst) => gst === false ? v * 1.1 : v;
    let lo = 0, hi = 0, loAll = 0, hiAll = 0, unpriced = 0;
    for (const it of items) {
      if (!it.aud) { if (it.need === 'must') unpriced++; continue; }
      const a = inc(it.aud[0], it.gst) * it.qty, b = inc(it.aud[1], it.gst) * it.qty;
      loAll += a; hiAll += b;
      if (it.need === 'must') { lo += a; hi += b; }
    }
    const D = delivery(items.filter(i => i.need === 'must'));
    return { lo: lo + D.lo, hi: hi + D.hi, loAll: loAll + D.lo, hiAll: hiAll + D.hi, unpriced, D };
  }

  // A measure's verdict from the four numbers (the Pi and the trial computer,
  // week 1 and week 2, the sticks swapped between weeks). → { cls, text } or null.
  // (The trial computer's keys are still `am1` and `am2`: a sheet saved by the
  // earlier trial reads the same.)
  function verdict(m, v) {
    const n = x => (x === '' || x == null || isNaN(Number(x))) ? null : Number(x);
    const pi = [n(v.pi1), n(v.pi2)], am = [n(v.am1), n(v.am2)];
    const has = a => a.some(x => x != null);
    if (!has(am)) return null;
    const sum = a => a.reduce((s, x) => s + (x || 0), 0);
    const worst = a => Math.max(...a.filter(x => x != null));
    if (m.rule === 'ratio') {
      if (!has(pi) || !sum(pi)) return null;
      const r = sum(am) / sum(pi);
      return r >= m.min ? { cls: 'ok', text: `${Math.round(r * 1000) / 10}% of the Pi's — passes` } : { cls: 'bad', text: `${Math.round(r * 1000) / 10}% of the Pi's — under ${m.min * 100}%` };
    }
    if (m.rule === 'close') {
      if (!has(pi)) return null;
      const d = sum(am.filter(x => x != null)) / am.filter(x => x != null).length - sum(pi.filter(x => x != null)) / pi.filter(x => x != null).length;
      return Math.abs(d) <= m.tol ? { cls: 'ok', text: `within ${Math.abs(Math.round(d * 10) / 10)} dB — the same` } : { cls: 'warn', text: `${Math.round(d * 10) / 10} dB — check the sticks and the splitter` };
    }
    if (m.rule === 'max') {
      const w = worst(am);
      return w <= m.max ? { cls: 'ok', text: `worst ${w}${m.unit} — passes` } : { cls: 'bad', text: `worst ${w}${m.unit} — over ${m.max}${m.unit}` };
    }
    // A gap both computers share is the network's, not the trial computer's: only
    // what the trial computer has beyond the Pi's, week by week, counts against it.
    if (m.rule === 'own') {
      let own = 0, shared = 0, noPi = false;
      for (let i = 0; i < 2; i++) {
        if (am[i] == null) continue;
        if (pi[i] == null) { noPi = true; own += am[i]; } else { own += Math.max(0, am[i] - pi[i]); shared += Math.min(am[i], pi[i]); }
      }
      const tail = noPi ? ' (write the Pi\'s count too: a gap both share is the network\'s)' : '';
      if (own === 0) return { cls: 'ok', text: shared ? `${shared} shared with the Pi — the network's, not its own; none of its own — passes` : 'none — passes' };
      return { cls: 'bad', text: `${own} of its own${shared ? `, ${shared} shared with the Pi` : ''} — over 0${tail}` };
    }
    if (m.rule === 'info' && has(pi)) {
      const r = sum(am) / (sum(pi) || 1);
      return { cls: 'info', text: `${Math.round(r * 100)}% of the Pi's` };
    }
    return null;
  }

  // Step 0's figures, read against the rule and against the channels you plan.
  // b = the five figures as typed; channels = how many channels you plan.
  function benchVerdict(m, b, channels) {
    const x = Number(b[m.id]);
    if (b[m.id] === '' || b[m.id] == null || (m.rule !== 'ok' && isNaN(x))) return null;
    const R = (globalThis.OA_BUILD_API || (isNode ? require('./builder.js') : null) || {}).B;
    const rule = R && R.model && R.model.rule || { cores: 4, oneCore: 2.5 };
    if (m.rule === 'core') return x >= rule.oneCore ? { cls: 'ok', text: `${x} — meets the ALERT2 rule's ${rule.oneCore} a core` } : x >= 1 ? { cls: 'warn', text: `${x} — under the ALERT2 rule's ${rule.oneCore} a core: today's channels, not ALERT2 growth` } : { cls: 'bad', text: `${x} — slower core for core than a Pi 4` };
    if (m.rule === 'whole') return { cls: 'info', text: `${x} Pi 4s of decoding` };
    if (m.rule === 'comfy') return channels && x < channels ? { cls: 'bad', text: `${x} — fewer than your ${channels} channels` } : { cls: 'ok', text: channels ? `${x} — covers your ${channels} channels` : `${x}` };
    if (m.rule === 'most') return channels && x < channels ? { cls: 'bad', text: `${x} — fewer than your ${channels} channels` } : { cls: 'info', text: `${x} at the very most (a storm day)` };
    if (m.rule === 'ok') return String(b[m.id]).trim().toLowerCase().startsWith('y') ? { cls: 'ok', text: 'every burst read correctly' } : { cls: 'bad', text: 'a burst was read wrongly: a computer that decodes wrongly is broken, not fast' };
    return null;
  }

  // ── the steps, for the picked computer ────────────────────────────────────
  // Plain HTML strings in sections: { h, items: [...] }, optional `code`. The
  // same list is drawn on the page and checked by the tests.
  function stepsFor(id, ctx) {
    const pk = pickOf(id), P = platform(id);
    if (!pk || !P) return [];
    ctx = ctx || {};
    const name = P.short.replace(/ \((?:not recommended|comparison only)\)/, '');
    const out = [];
    out.push({ h: 'Step 0 — before you buy a second one: run the benchmark', items: [
      `The <b>benchmark</b> times RPi ALERT's own decoder on a computer and says how many channels it can carry. No published figure runs this program, so everything on this page about speed is a stand-in until it has run on the real thing. Run it <i>before</i> you order a second computer or a batch: on a ${esc(name)} you can borrow or already have, or on this one as soon as it is installed.`,
      `It is <code>firmware/bench</code> in <a href="${FW}/bench" target="_blank" rel="noopener">the open-ALERT repository</a>: one file that needs Node.js 18 or later, and no radio stick, no network and no administrator rights. Run it on an otherwise idle computer, about four minutes (five times as long on a Pi 4):`,
      { code: 'node open-alert-bench.js /path/to/agent --full \\\n  --label="' + name + '" --out=result.json' },
      `With <code>open-alert-base</code> installed, <code>open-alert-base bench</code> does the same. On a fanless computer run it twice, the second time after ten minutes of the first, and take the lower. Run it on the Pi 4 too (nobody has yet): that settles the yardstick.`,
      'Write its figures in the <a href="#results-h">results sheet</a> (Step 0 box): the computer is worth buying more of only if one core is at least 2.5 times a Pi 4 core for ALERT2 growth, and it carries at least your channels comfortably today.',
    ] });
    out.push({ h: 'Before anything arrives: write down the Pi\'s week', items: [
      'The splitter will cost the Pi about 3.5 dB. So for two or three days before you fit it, note what the Pi does on its own — that is your baseline:',
      'On the Pi\'s <b>Overview</b> (<code>http://&lt;the Pi&gt;/</code>): bursts decoded per channel, <i>Decoder busy</i> for each channel, any dropped samples, the processor temperature.',
      'On its <b>Receivers</b> page: the SNR of two or three stations it hears well.',
      'In <b>Flood-Net</b>: its receivers on the Reception Map, and its row on the Base Stations tab.',
      'On the Pi, over SSH: <code>rpi-alert sdr 1</code> lists its channels, gain and ppm — you will give the trial computer the same.',
    ] });
    if (pk.route === 'verdin') {
      out.push({ h: 'On the bench: put the module on the carrier, and Torizon OS on it', items: [
        'With the power off, slide the Verdin module into Mallow\'s edge connector at an angle, press it down flat and fit its screw. Fit the heatsink <b>23111101</b> (the AM62\'s and the iMX95\'s own; the old 23111001 is marked not compatible with the AM62) over it with its thermal pad.',
        'Connect Ethernet to a network with internet, then 12 V to the power header (mind the polarity marked on the board).',
        'Power on. A new module comes with <b>Toradex Easy Installer</b> on it: find its IP address (your router\'s list of devices, or a monitor on the HDMI port) and open it in a browser. Install <b>Torizon OS</b> (the plain one). Power off when it says <i>Image installed</i>, then on again. <b>Toradex does not support plain Debian on a Verdin.</b>',
        'Log in over SSH: <code>ssh torizon@&lt;its IP&gt;</code> — the first password is <code>torizon</code>, and it makes you choose a new one. Give the computer a name you will recognise in Flood-Net: <code>sudo hostnamectl set-hostname trial-verdin</code>, then <code>sudo reboot</code>.',
      ] });
      out.push({ h: 'On the bench: run RPi ALERT in the container with no privileges', items: [
        `open-ALERT's <b>container</b> takes RPi ALERT's <i>signed</i> release unchanged and runs it with no special privileges, with only the USB bus passed through for the sticks. Its files are in <code>firmware/container/</code> of <a href="${FW}" target="_blank" rel="noopener">the open-ALERT repository</a>: <b>it is new and not released.</b> So far it has only been tried with stand-ins for the radio on one PC: never on Torizon OS, never on an ARM computer, and never with a real stick. Read the firmware's notes (the section on the container) before you start, and write down what it takes.`,
        '<b>Do not</b> build RPi ALERT\'s unsigned main branch in a privileged container: the review found that the hardest software to get approved. It is not part of this trial.',
        'Give it the Pi\'s channels, gain and ppm (Settings → RTL-SDR, or <code>rpi-alert sdr 1 freq …</code> with the Pi\'s own list). Leave the screen dashboard off, and turn the Pi\'s off too if it has one, so the comparison is like for like.',
        'Press <b>Request a token</b>, check the code, and approve it on Flood-Net\'s <b>Admin</b> tab. Its receivers appear named after the computer beside the Pi\'s.',
      ] });
    } else {
      out.push({ h: `On the bench: put an operating system on the ${name}`, items: [
        `The operating system for this computer: <b>${esc(pk.os)}</b> Put it on as its maker says (a USB stick, or a card for a board): no desktop needed. Connect Ethernet to a network with internet.`,
        'Give the computer a name you will recognise in Flood-Net: <code>sudo hostnamectl set-hostname trial-' + (P.id.replace(/[^a-z0-9]+/g, '-').slice(0, 20)) + '</code>, then <code>sudo reboot</code>.',
        pk.power ? `Power: ${esc(pk.power)}` : '',
      ].filter(Boolean) });
      out.push({ h: 'On the bench: install RPi ALERT with open-alert-base', items: [
        `Download <code>open-alert-base_….deb</code> from <a href="${RELEASES}" target="_blank" rel="noopener">open-ALERT's releases</a> — <b>there were none on 13 November 2026</b>: until the first one appears, the package is built from the repository's <code>firmware/</code> folder (its README says how). Then, as the administrator:`,
        { code: 'sudo apt install ./open-alert-base_….deb\nopen-alert-base status' },
        'It carries RPi ALERT\'s <i>signed</i> release, unchanged, and apt brings what it needs from the operating system\'s own packages. To start locked down from the first moment, for a network with an IT team, name the enterprise profile when you install instead (no hotspot, no remote changes from Flood-Net, no self-reboots, the dashboard on the computer itself only, at <code>http://127.0.0.1:8080/</code>):',
        { code: 'sudo OPEN_ALERT_BASE_PROFILE=enterprise \\\n  apt install ./open-alert-base_….deb' },
        'Trial the standard profile unless the site needs the enterprise one: the Pi runs like that.',
        'Run <code>open-alert-base bench</code> if you have not, and write the figures in the results sheet.',
        'Plug in one stick at a time and give each a serial of its own while the agent is stopped: <code>sudo systemctl stop open-alert-base; rtl_eeprom -s ALERT1</code> (letters, not a bare number), unplug and replug it, then <code>sudo systemctl start open-alert-base</code>. The package keeps the kernel\'s digital-TV drivers off the sticks.' + (pk.hub ? ' This computer has one USB port: the trial\'s one stick goes straight into it, and a second stick would need a powered USB hub.' : ''),
        'Give it the Pi\'s channels, gain and ppm: <code>rpi-alert sdr 1 freq …</code> with the Pi\'s own list, or Settings → RTL-SDR. Leave the screen dashboard off, and turn the Pi\'s off too if it has one, so the comparison is like for like.',
        'Run <code>rpi-alert setup</code> to <b>Request a token</b>, check the code, and approve it on Flood-Net\'s <b>Admin</b> tab. Its receivers appear named after the computer beside the Pi\'s. The dashboard is at <code>http://&lt;its address&gt;/</code> (the standard profile).',
      ] });
    }
    out.push({ h: 'On the bench: a day with an antenna by a window', items: [
      'Leave it a day. If <i>Decoder busy</i> is near 100% on a channel, it will not cope on site: see <a href="#keepup">Will it keep up?</a> and take some channels off before going on.',
      `<b>The firmware is new.</b> Nothing has yet been run with a real radio stick on a computer that is not a Raspberry Pi. The package's own checks pass on Debian 13 and Ubuntu 24.04 with stand-ins for the radio, on one test computer that has no USB (<a href="${FW_README}" target="_blank" rel="noopener">the firmware's notes</a> have the table as it stands today). This trial is where the rest gets proved. Write down anything odd, and what you did about it.`,
      'Things that need the Pi\'s own system — the Wi-Fi hotspot, the screen, updates from Flood-Net on the enterprise profile — are not part of this trial; it is about receiving and decoding.',
    ] });
    out.push({ h: 'On site: share the antenna', items: [
      'Undo the coax at the Pi\'s stick. Between the arrestor and the sticks, fit the splitter: the antenna lead to its input (with the N–N jumper if needed), a pigtail from each output to each stick.',
      'Both computers on the same switch or router, by Ethernet. Each on its power meter.',
      'Check both are hearing: each Overview counts bursts within minutes, and both sets of receivers turn up on Flood-Net\'s Reception Map.',
      'Write down the date and time — week 1 starts now. Stick A is on the Pi, stick B on the trial computer.',
    ] });
    out.push({ h: 'After a week: swap the sticks', items: [
      'Move stick A to the trial computer and stick B to the Pi (each keeps its own pigtail). Give each stick its own ppm on its new computer — the tuning help on each stick\'s card suggests it within an hour. Write down the time: week 2 starts.',
    ] });
    out.push({ h: 'After two weeks: read off the numbers', items: [
      'Fill in the results sheet below from each computer and from Flood-Net. The verdicts work themselves out. Then decide: keep the trial computer on site beside the Pi, take it off and keep the Pi, or — if it passes — let it take over. A pass on today\'s channels says nothing about ALERT2 growth: for that, read the benchmark\'s ALERT2 line.',
    ] });
    return out;
  }
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const API = { TRIAL, TERMS, verdict, benchVerdict, aud, delivery, totals, listFor, stepsFor, platform, record, pickOf };
  if (isNode) { module.exports = API; return; }

  // ══ the page ══════════════════════════════════════════════════════════════
  const $ = (s, el) => (el || document).querySelector(s);
  const inc = (v, gst) => gst === false ? v * 1.1 : v;
  const money = v => 'A$' + Math.round(v).toLocaleString('en-AU');
  const range = (lo, hi) => Math.round(lo) === Math.round(hi) ? money(lo) : `${money(lo)}–${Math.round(hi).toLocaleString('en-AU')}`;
  const wk = n => { const w = Math.round(n / 7); return w === 1 ? '1 week' : `${w} weeks`; };
  const days = d => d[1] <= 7 ? `${d[0]}–${d[1]} days` : d[0] >= 14 ? `${Math.round(d[0] / 7)}–${wk(d[1])}` : `${d[0]} days–${wk(d[1])}`;
  const KEY = 'open-alert:trial';
  const DEFAULT_PICK = 'mini-pc-n150';
  let T = { got: {}, res: {}, bench: {}, channels: '151.5, 151.525, 151.95, 152.4', traffic: 'busy', pick: DEFAULT_PICK };
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (e) { /* private mode, or damaged */ }
  if (!saved || typeof saved !== 'object' || Array.isArray(saved)) saved = {};
  T = Object.assign(T, saved);
  if (typeof T.channels !== 'string') T.channels = Array.isArray(T.channels) ? T.channels.join(', ') : '151.5, 151.525, 151.95, 152.4';
  if (!['quiet', 'busy', 'heavy'].includes(T.traffic)) T.traffic = 'busy';
  if (!T.got || typeof T.got !== 'object') T.got = {};
  // A sheet saved by the earlier Mallow trial has no pick, and ticks for the
  // module, the carrier and the heatsink: open on that computer, and count the
  // module and the carrier, both ticked, as its one "computer" line.
  if (!saved.pick && (T.got.verdin || T.got.mallow)) {
    T.pick = 'toradex-verdin-am62-mallow';
    if (T.got.computer == null) T.got.computer = !!(T.got.verdin && T.got.mallow);
  }
  if (!T.res || typeof T.res !== 'object') T.res = {};
  if (!T.bench || typeof T.bench !== 'object') T.bench = {};
  if (!pickOf(T.pick)) T.pick = DEFAULT_PICK;
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(T)); } catch (e) { /* private mode */ } };
  const KAPI = () => globalThis.OA_BUILD_API;
  // A word with its meaning on hover (a finger or a keyboard reads the list under the page).
  const ALLTERMS = () => Object.assign({}, (KAPI() && KAPI().TERMS) || {}, TERMS);
  // The other words: their meanings live in the hardware review's list (data/review.js), loaded by this page.
  const RT = id => ((globalThis.OA_REVIEW && globalThis.OA_REVIEW.terms) || []).find(t => t.id === id);
  const mark = html => (KAPI() && KAPI().markTerms ? KAPI().markTerms(html, RT) : html);
  const term = (k, text) => { const t = ALLTERMS()[k]; return t ? `<span class="term" title="${esc(t[1])}" style="border-bottom:1px dotted;cursor:help">${esc(text || t[0])}</span>` : esc(text || k); };
  const TERM_ORDER = ['trialcomputer', 'speed', 'pi4core', 'whole', 'onecore', 'alltogether', 'busiest', 'rule', 'window', 'busy', 'slots', 'decoderbusy', 'bench', 'package', 'container', 'profile', 'token', 'tpm', 'secureboot', 'fanless', 'rated', 'hub', 'quote', 'check', 'snr', 'dropped', 'swap', 'shared'];

  const pc = x => isFinite(x) ? Math.round(x * 100) : 999;
  const pcs = (lo, hi) => pc(lo) === pc(hi) ? `${pc(hi)}%` : `${pc(lo)}–${pc(hi)}%`;
  const freqs = () => String(T.channels).split(/[ ,;]+/).map(Number).filter(f => f >= 136 && f <= 174);

  // What a computer would be asked, and how it does: { cap, one, cores } in Pi 4 cores.
  function spec(ref, extra) {
    const K = KAPI(), p = Object.assign({ ref }, extra || {});
    return { cap: K.capacity(p), one: K.oneCore(p), cores: K.cores(p), p };
  }
  function rate(S, plan, traffic, dec) {
    const K = KAPI();
    if (!plan.sticks || !plan.sticks.length || !S.cap) return null;
    const L = K.load(plan, { traffic, decoder: dec });
    const use = L.total / S.cap, useLow = L.totalLow / S.cap;
    const ch = L.worst && S.one ? L.worst.need / S.one : 0, chLow = L.worst && S.one ? L.worst.needLow / S.one : 0;
    return { L, use, useLow, ch, chLow, v: K.verdict(use, ch) };
  }
  const meetsRule = S => { const r = KAPI().B.model.rule; return S.cores >= r.cores && S.one >= r.oneCore; };
  // Every speed but the Pi 4's is a stand-in (est); a floor is "at least", for a processor the review has no figure for.
  const speedHtml = (S, est, floor) => { const w = S.cap / 4, o = S.one; const f = x => (Math.round(x * 100) / 100).toString(); const pre = floor ? 'at least ' : ''; return `<span class="var-sp">${pre}<b>${f(w)}</b> whole · <b>${f(o)}</b> a core</span>${floor ? '<div class="small dim">a floor, not a figure</div>' : est ? '<div class="small dim">a stand-in</div>' : ''}`; };

  // ── the picker and the table ──────────────────────────────────────────────
  const ROLE = { buy: ['ok', 'First choice'], start: ['info', 'Bench and cool room only'], hot: ['ok', 'For hot cabinets'], cert: ['ok', 'Certified industrial'], open: ['warn', 'Small older-ALERT site only'], gen: ['info', 'General entry: check the processor'], tdx: ['info', 'If staying with Toradex'], notrec: ['bad', 'Not recommended'], comp: ['info', 'Comparison only'], ref: ['info', 'For reference'], yard: ['ok', 'The yardstick'], out: ['bad', 'Ruled out'] };
  const chip = r => `<span class="chip st-${ROLE[r][0] === 'bad' ? 'bad' : ROLE[r][0] === 'warn' ? 'warn' : 'info'}">${esc(ROLE[r][1])}</span>`;
  const tempText = (t, assumed) => t ? `${t[0] < 0 ? '−' + -t[0] : t[0]} to +${t[1]} °C${assumed ? `<div class="small dim" title="${esc(assumed)}">assumed: no rating was read</div>` : ''}` : '<span class="dim">not stated</span>';
  const priceCell = P => {
    if (!P || !P.aud || P.aud[0] == null) return `<span class="dim">${term('quote')}</span>`;
    const lo = inc(P.aud[0], P.gst), hi = inc(P.aud[1], P.gst);
    return `<b>${range(lo, hi)}</b>${P.conf === 'low' ? ' <span class="chip st-warn" title="An estimate or an unconfirmed listing">est.</span>' : ''}`;
  };

  function picker() {
    const el = $('#t-pick');
    if (!el) return;
    const opts = TRIAL.groups.map(([g, h]) => `<optgroup label="${esc(h)}">${TRIAL.picks.filter(p => p.group === g).map(p => `<option value="${esc(p.id)}"${p.id === T.pick ? ' selected' : ''}>${esc(platform(p.id).short)}</option>`).join('')}</optgroup>`).join('');
    el.innerHTML = opts;
    const pk = pickOf(T.pick), P = platform(T.pick);
    $('#pick-card').innerHTML = `<h3>${esc(P.short)} ${chip(pk.role)}</h3><p class="small">${mark(esc(pk.why))}</p>
      <p class="small dim"><b>Built with:</b> ${mark(esc(pk.built))}</p>
      <p class="small dim"><b>Route:</b> ${pk.route === 'verdin' ? `${term('container', 'Torizon OS and the container with no privileges')}` : `${term('package', 'the open-alert-base package')} on ${esc(pk.os.replace(/\.$/, ''))}`}. <b>Power:</b> ${esc(pk.power)}</p>`;
  }

  function which() {
    const el = $('#variants');
    if (!el || !KAPI()) return;
    const K = KAPI(), yours = K.planSticks(freqs(), 'auto');
    const th = (t, key, cls) => `<th${cls ? ` class="${cls}"` : ''}>${term(key, t)}</th>`;
    const cells = (S, plan, traffic) => {
      const r = rate(S, plan, traffic, 'filter-once');
      if (!r) return '<td class="num" data-l="All together">—</td><td class="num" data-l="Busiest channel">—</td>';
      return `<td class="num" data-l="All together"><span class="${r.v.whole}">${pcs(r.useLow, r.use)}</span></td><td class="num" data-l="Busiest channel"><span class="${r.v.one}">${pcs(r.chLow, r.ch)}</span></td>`;
    };
    const ruleCell = (S, floor) => floor ? '<span class="ok">probably meets it</span><div class="small dim">no figure for its processor</div>' : meetsRule(S) ? '<span class="ok">meets it</span>' : '<span class="warn">short of it</span>';
    const head = (text, sub) => `<tr class="sub"><th colspan="7">${esc(text)}${sub ? ` <span class="grp-sub">— ${esc(sub)}</span>` : ''}</th></tr>`;
    // Two lines a computer: its figures, then what it is built with and what the review says of it, full width.
    const rowFor = (ref, short, built, role, why, priceHtml, temp, est, extra, floor) => {
      const S = spec(ref, extra);
      return `<tr class="pick-${role}"><th scope="row"><b>${esc(short)}</b><div>${chip(role)}</div></th><td data-l="Speed">${speedHtml(S, est, floor)}</td><td class="num" data-l="A$ inc GST">${priceHtml}</td><td data-l="Rated">${temp}</td>${cells(S, yours, T.traffic)}<td data-l="ALERT2 rule">${ruleCell(S, floor)}</td></tr>
        <tr class="var-more pick-${role}"><td colspan="7" class="small">${built ? `<b>Built with:</b> ${mark(esc(built))}. ` : ''}<span class="dim">${mark(esc(why))}</span></td></tr>`;
    };
    let body = '';
    for (const [g, h, sub] of TRIAL.groups) {
      if (g === 'toradex') continue;
      body += head(h, sub) + TRIAL.picks.filter(p => p.group === g).map(p => {
        const P = platform(p.id), it = record(p.id);
        return rowFor(p.id, P.short, p.built, p.role, p.why, priceCell(P), tempText(it && it.temp, it && it.tempAssumed), true);
      }).join('');
    }
    body += head('Toradex, if you are staying', 'the iMX95 and not the AM62 (the AM62 folds away below)') + TRIAL.picks.filter(p => p.id === 'toradex-verdin-imx95-mallow').map(p => {
      const P = platform(p.id), it = record(p.id); return rowFor(p.id, P.short, p.built, p.role, p.why, priceCell(P), tempText(it && it.temp, it && it.tempAssumed), true);
    }).join('');
    const catRows = g => TRIAL.others.filter(o => o.group === g).map(o => { const it = record(o.ref); if (!it) return ''; const P = it.price || {}; return rowFor(o.ref, o.short, '', o.role, o.why, P.aud == null ? `<span class="dim">${term('quote')}</span>` : `<b>${money(inc(P.aud, P.gst))}</b>`, tempText(it.temp, it.tempAssumed), o.est, null, o.floor); }).join('');
    body += head('Not in the builder yet', 'for comparison') + catRows('cat') + catRows('luna');
    body += head('Raspberry Pi', 'the yardstick and what it is made for; prices for the board alone') + catRows('pi');
    el.innerHTML = `<div class="table-wrap"><table class="tbl var stk"><thead><tr>${th('Computer', 'trialcomputer')}${th('Speed', 'speed')}<th class="num">A$ inc GST</th>${th('Rated', 'rated')}${th(`${freqs().length} ch, ${T.traffic}: all together`, 'alltogether', 'num')}${th('Busiest channel', 'busiest', 'num')}${th('ALERT2 rule', 'rule')}</tr></thead><tbody>${body}</tbody></table></div>`;
    // Colour shows only after the page's text is read, so a word in a heading
    // stays an ordinary heading when hover is not there.
  }

  // The Verdin fold: the six AM62s with the corrected prices, the right heatsink, the iMX95 and the Luna.
  function verdinFold() {
    const el = $('#verdin-fold');
    if (!el || !KAPI()) return;
    const K = KAPI(), yours = K.planSticks(freqs(), 'auto'), Vp = TRIAL.verdinParts;
    const exGst = usd => `US$${usd.toFixed(2)} ≈ ${money(aud(usd))} ex GST`;
    const rows = TRIAL.variants.map(v => {
      const capCores = v.cores * (v.ghz / 1.4) * 0.5;
      const S = { cap: capCores, one: 0.5 * v.ghz / 1.4, cores: v.cores };
      const r = rate(S, yours, T.traffic, 'filter-once');
      return `<tr class="pick-${v.pick}"><th scope="row"><b>${esc(v.pid)}</b><div class="small dim">${esc(v.name)}</div></th><td>${v.cores} × A53 ${v.ghz} GHz<div class="small dim">${Math.round(capCores / 4 * 100) / 100} of a Pi 4</div></td><td>${esc(v.ram)} · ${esc(v.emmc)} eMMC</td><td>${v.wifi ? 'yes' : '—'}</td><td class="num">${v.usd ? `<b>${esc(exGst(v.usd))}</b>` : `<span class="dim">${term('check')}</span>`}<div class="small dim">Toradex direct, for one</div></td><td class="num">${r ? `<span class="${r.v.cls}">${pcs(r.useLow, r.use)}</span>` : '—'}</td><td>${chip(v.pick)}<div class="small dim">${esc(v.why)}</div></td></tr>`;
    }).join('');
    const set = Vp.mallow.usd + Vp.heatsink.usd;
    el.innerHTML = `<div class="table-wrap"><table class="tbl var"><thead><tr><th>Part</th><th>CPU</th><th>RAM · storage</th><th>Wi-Fi</th><th class="num">Toradex's price</th><th class="num">${esc(freqs().length)} ch, ${esc(T.traffic)}: all together</th><th>Verdict</th></tr></thead><tbody>${rows}</tbody></table></div>
      <ul class="small">
        <li><b>The price, corrected.</b> Toradex lists the Quad 2GB WB IT (00761200) at <b>US$306.00</b> for one, the Dual 1GB IT at US$206.25, Mallow (${esc(Vp.mallow.code)}) at US$${Vp.mallow.usd.toFixed(2)} and the heatsink ${esc(Vp.heatsink.code)} at US$${Vp.heatsink.usd.toFixed(2)}: <b>about US$${(306 + set).toFixed(0)} a set</b>. From Toradex that is about ${money(aud(306 + set))} before GST and ${money(aud(306 + set) * 1.1)} with it, before the courier, which Toradex does not publish; report R1 put it at about A$750–800 including GST through an Australian distributor, from search listings. The much lower price the old trial used is gone (review report R1, read from Toradex's own site on 2026-11-11). element14 Australia's listed prices are stale and its <a href="https://au.element14.com/toradex/761200/com-2ghz-32gb-arm-cortex-a72-r5f/dp/4852670" target="_blank" rel="noopener">listing 4852670</a> is mistitled: check with the seller before ordering anything there.</li>
        <li><b>The right heatsink is ${esc(Vp.heatsink.code)}.</b> The old list's ${esc(Vp.oldHeatsink)} is marked "not compatible Verdin AM62".</li>
        <li><b>The iMX95 beside them.</b> The Verdin iMX95 Hexa 4GB (part ${esc(Vp.imx95.code)}, US$${Vp.imx95.usd.toFixed(2)}) goes on the same Mallow carrier: six newer cores, USB 3 and PCIe, supply promised to 2039 for the module (2034 for the Mallow carrier). Its datasheet is still preliminary and its speed unmeasured.</li>
        <li><b>With an AM62</b>, Mallow's two USB sockets run at USB 2.0 on one shared bus and its M.2 slot has no PCIe. Mallow's schematics and parts list download freely and its full drawing project sits behind a form, but none carries an open-source licence. Supply of the module is promised to 2033: seven years. Secure boot on the AM62 is "still an Early Access feature" (Toradex staff, 10 November 2026).</li>
        <li><b>The software.</b> Toradex does not support plain Debian on a Verdin: it is Torizon OS and a container. The signed release has been started in a container with no privileges at all, with no radio attached (report U1); open-ALERT's own container has since been tried with stand-ins for the radio on one PC. Whether a real stick can be opened that way, and anything on Torizon OS or an ARM computer, is untested. A privileged container built from the unsigned main branch is the hardest stack to get approved, and is no longer in this trial.</li>
        <li><b>"Half a Raspberry Pi 4"</b> was never measured: each repository cited the other. Published benchmarks of the same class of core put it at 0.5 (0.45–0.6) (report R8).</li>
      </ul>
      <p class="small dim">Sources: <a href="${REV}R1-toradex-verdin-mallow.md" target="_blank" rel="noopener">review report R1</a> · <a href="${REV}R8-cpu-performance.md" target="_blank" rel="noopener">R8</a> · <a href="https://www.toradex.com/computer-on-modules/verdin-arm-family/ti-am62" target="_blank" rel="noopener">Toradex: Verdin AM62</a> · <a href="https://docs.toradex.com/116791-mallow_carrier_board_datasheet.pdf" target="_blank" rel="noopener">Mallow datasheet</a> · <a href="https://www.toradex.com/single-board-computers/luna-sl1680" target="_blank" rel="noopener">Toradex: Luna SL1680</a> (comparison only; see the table).</p>`;
  }

  // ── will it keep up, for the pick ─────────────────────────────────────────
  function estimate() {
    const K = KAPI();
    if (!K) return;
    const plan = K.planSticks(freqs(), 'auto');
    const P = platform(T.pick);
    const targets = [['rpi-4-4gb', 'Pi 4', spec('rpi-4-4gb')], [T.pick, P.short.replace(/ \((?:not recommended|comparison only)\)/, ''), spec(T.pick)]];
    const decs = K.B.decoders;
    const rows = targets.map(([id, short, S]) => {
      const cells = decs.map(d => {
        const r = rate(S, plan, T.traffic, d.id);
        return r ? `<td class="num"><span class="${r.v.whole}">${pcs(r.useLow, r.use)}</span><div class="small">one core: <span class="${r.v.one}">${pcs(r.chLow, r.ch)}</span></div></td>` : '<td class="num">—</td>';
      }).join('');
      return `<tr><th scope="row">${esc(short)}<div class="small dim">${speedHtml(S)}</div></th>${cells}</tr>`;
    }).join('');
    const sticks = (plan.sticks || []).map((s, i) => `stick ${i + 1}: ${s.chans.join(', ')} MHz in ${s.window.khz >= 1000 ? s.window.khz / 1000 + ' MHz' : s.window.khz + ' kHz'}`).join('; ');
    const S = targets[1][2];
    let room = '';
    if (plan.sticks && plan.sticks.length && S.cap) {
      const H = K.headroom(plan, { traffic: T.traffic, decoder: 'filter-once' }, Object.assign({ ref: T.pick }));
      const f2 = x => x.toFixed(2);
      room = `<p class="small"><b>Room for ALERT2.</b> If one channel had ${term('slots', 'every slot used')}, it would need ${f2(H.needLow)}–${f2(H.need)} Pi 4 cores on ${term('onecore', 'one core')} (about 1.1–1.3 for its messages alone, and the rest for listening in this stick's ${term('window')}) — <span class="${H.cls}">${pcs(H.shareLow, H.share)} of one of this computer's</span>. ${H.meetsRule ? 'It meets the ' : 'It is short of the '}${term('rule', 'ALERT2 rule')} (at least four cores, each at least 2.5 times a Pi 4 core).${H.cls === 'bad' ? ' It could not keep up, however many cores sit idle.' : ''} A Pi 4 cannot keep up with that either; real networks run far below it (20–31 frames a minute).</p>`;
    }
    const pi4 = rate(targets[0][2], plan, T.traffic, 'filter-once');
    const reading = pi4 ? `<p class="small">How to read a pair of figures: for the Pi 4 on the default decoder, <b>${pc(pi4.useLow)}%</b> is RPi ALERT's measurement alone, and <b>${pc(pi4.use)}%</b> is the same work on ${term('busy', 'a busy computer')}. The verdicts use the higher one.</p>` : '';
    $('#est').innerHTML = `<div class="row">
        <label>Channels (MHz, as on the Pi) <input id="t-ch" value="${esc(T.channels)}" inputmode="decimal"></label>
        <label>Traffic <select id="t-tr"><option value="quiet"${T.traffic === 'quiet' ? ' selected' : ''}>Quiet</option><option value="busy"${T.traffic === 'busy' ? ' selected' : ''}>Busy</option><option value="heavy"${T.traffic === 'heavy' ? ' selected' : ''}>Heavy — hears a whole region</option></select></label></div>
      <p class="small dim">${esc(plan.error || sticks || 'Type the Pi\'s channels.')}</p>
      <div class="table-wrap"><table class="tbl"><thead><tr><th>${term('alltogether')}, and ${term('onecore')}</th>${decs.map(d => `<th class="num">${esc(d.short)}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table></div>
      ${reading}
      ${room}
      <p class="small dim">Each figure runs from RPi ALERT's own measurement to ${term('busy', 'a busy computer')} (1.6 times). Green is comfortable; amber is the edge; red drops bursts. The figures come from one busy Raspberry Pi 4 and may read high; the speed of every other computer is a stand-in until the ${term('bench', 'benchmark')} has run on it. The two <i>around bursts</i> columns are not to be sized on: filtering only around bursts missed some of the weakest bursts in its first field check, and the Light decoder has had no field check at all.</p>`;
  }

  // ── what to buy ───────────────────────────────────────────────────────────
  function shopping() {
    const items = listFor(T.pick);
    const groups = [['must', 'You need'], ['maybe', 'Only if something goes wrong or you have none'], ['nice', 'Nice to have']];
    const t = totals(items), D = t.D;
    const cl = $('#cost-line');
    if (cl) cl.innerHTML = `About <b>${range(t.lo, t.hi)}</b> inc GST, delivered, for what is priced, ${range(t.loAll, t.hiAll)} with the extras.${t.unpriced ? ` <b>${t.unpriced} thing${t.unpriced === 1 ? '' : 's'} on the list ha${t.unpriced === 1 ? 's' : 've'} no price</b> (${term('quote', 'by quote')} or ${term('check', 'check with the seller')}) and ${t.unpriced === 1 ? 'is' : 'are'} not in the total.` : ''} The list below has each part, where to get it and how long it takes.`;
    const price = it => it.aud ? `<b>${range(inc(it.aud[0], it.gst), inc(it.aud[1], it.gst))}</b> inc GST` : `<b>${it.quote ? term('quote') : term('check')}</b>`;
    $('#shop').innerHTML = groups.map(([g, h]) => items.some(i => i.need === g) ? `<h3>${h}</h3><ul class="shop">${items.filter(i => i.need === g).map(it => `
      <li class="${T.got[it.id] ? 'got' : ''}"><label class="shop-chk"><input type="checkbox" data-got="${esc(it.id)}"${T.got[it.id] ? ' checked' : ''}> <span class="sr-only">Got it</span></label>
        <div class="shop-main"><b>${esc(it.name)}</b>${it.conf === 'low' && it.aud ? ' <span class="chip st-warn" title="Price and lead time are estimates">est.</span>' : ''}
          <div class="small dim">${mark(esc(it.why))}</div>
          <div class="shop-meta small"><span>${price(it)}</span><span title="${esc(it.lead.text)}">⏱ ${esc(days(it.lead.d))}</span><span>${it.where.map(([n, u]) => `<a href="${esc(u)}" target="_blank" rel="noopener">${esc(n)}</a>`).join(' · ')}</span></div>
          ${it.src && it.src.length ? `<div class="small dim">Read from: ${it.src.map(([n, u]) => `<a href="${esc(u)}" target="_blank" rel="noopener">${esc(n)}</a>`).join(' · ')}</div>` : ''}
        </div></li>`).join('')}</ul>` : '').join('') +
      (D.lines.length ? `<h3>Delivery</h3><ul class="shop">${D.lines.map(l => `<li><span class="shop-chk" aria-hidden="true"></span><div class="shop-main"><b>Delivery from ${esc(l.name)}</b>${l.sh.conf === 'low' ? ' <span class="chip st-warn" title="An estimate">est.</span>' : ''}
          <div class="small dim">${esc(l.sh.note || '')} For: ${esc(l.parts.join(', '))}.${l.over ? ` Over A$${importInfo().threshold.toLocaleString('en-AU')} from overseas: GST at the border and ${esc(importInfo().what)}.` : ''}</div>
          <div class="shop-meta small"><span><b>${l.hi === 0 ? 'free' : range(l.lo, l.hi)}</b> inc GST</span>${l.sh.src && l.sh.src.length ? `<span><a href="${esc(l.sh.src[0][1])}" target="_blank" rel="noopener">${esc(l.sh.src[0][0])}</a></span>` : ''}</div></div></li>`).join('')}</ul>` : '') +
      (D.unknown.length ? `<p class="small dim">Delivery not counted from ${esc(D.unknown.join(', '))}.</p>` : '') +
      `<p class="note"><b>Total for what you need, delivered:</b> ${range(t.lo, t.hi)} inc GST (${range(t.loAll, t.hiAll)} with everything priced).${t.unpriced ? ` It leaves out ${t.unpriced} thing${t.unpriced === 1 ? '' : 's'} with no price: ask the sellers.` : ''} Prices are the ones read in November 2026 and say where; the owner checks them by hand, so the links matter more than the figures.</p>`;
  }
  const importInfo = () => (globalThis.OA_BUILDER && globalThis.OA_BUILDER.import) || { threshold: 1000, what: 'clearance charges' };

  // ── what to do ────────────────────────────────────────────────────────────
  function doSteps() {
    const el = $('#do-list');
    if (!el) return;
    let n = 0;
    el.innerHTML = stepsFor(T.pick).map((s, i) => {
      const body = s.items.map(x => typeof x === 'string' ? `<li>${mark(x)}</li>` : `<li style="list-style:none"><div class="code"><button type="button" class="ghost small" data-act="copycode" data-for="c${++n}">Copy</button><pre id="c${n}">${esc(x.code)}</pre></div></li>`).join('');
      return `<li><h3>${esc(s.h)}</h3><ol>${body}</ol></li>`;
    }).join('');
  }

  function drawing() {
    const P = platform(T.pick), pk = pickOf(T.pick);
    const short = P.short.replace(/ \((?:not recommended|comparison only)\)/, '');
    const a = $('#svg-pick'), b = $('#svg-pick2'), c = $('#svg-pick3');
    if (a) a.textContent = short.length > 24 ? short.slice(0, 23) + '…' : short;
    if (b) b.textContent = pk.route === 'verdin' ? 'RPi ALERT in a container' : 'RPi ALERT via open-alert-base';
    if (c) c.textContent = 'its own supply + meter';
    const fig = $('#trialset'); if (fig) fig.setAttribute('aria-label', `The antenna feeds a splitter; one side goes to the Pi's stick, the other to the ${short}'s; both computers post to Flood-Net over Ethernet`);
  }

  // ── the results sheet ─────────────────────────────────────────────────────
  function results() {
    const v = T.res, b = T.bench, nCh = freqs().length;
    const brows = TRIAL.bench.map(m => {
      const val = b[m.id] == null ? '' : b[m.id];
      const ver = benchVerdict(m, b, nCh);
      return `<tr><th scope="row">${esc(m.name)}<div class="small dim">${esc(m.where)}</div></th><td><input ${m.rule === 'ok' ? 'type="text"' : 'type="number" step="any" inputmode="decimal"'} data-bench="${m.id}" value="${esc(val)}" aria-label="${esc(m.name)}"></td><td class="small" data-bver="${m.id}">${ver ? `<span class="${ver.cls}">${esc(ver.text)}</span>` : '<span class="dim">—</span>'}</td></tr>`;
    }).join('');
    const rows = TRIAL.measures.map(m => {
      const r = v[m.id] || {};
      const cell = k => `<td><input type="number" step="any" inputmode="decimal" data-res="${m.id}" data-k="${k}" value="${esc(r[k] == null ? '' : r[k])}" aria-label="${esc(m.name)}, ${{ pi1: 'Pi week 1', am1: 'trial computer week 1', pi2: 'Pi week 2', am2: 'trial computer week 2' }[k]}"></td>`;
      const ver = verdict(m, r);
      return `<tr><th scope="row">${esc(m.name)}<div class="small dim">${esc(m.where)}</div></th>${cell('pi1')}${cell('am1')}${cell('pi2')}${cell('am2')}<td class="small" data-ver="${m.id}">${ver ? `<span class="${ver.cls}">${esc(ver.text)}</span>` : '<span class="dim">—</span>'}</td></tr>`;
    }).join('');
    $('#results').innerHTML = `<h3>Step 0: the ${term('bench', 'benchmark')} on the ${esc(platform(T.pick).short.replace(/ \((?:not recommended|comparison only)\)/, ''))}</h3>
      <div class="table-wrap"><table class="tbl res"><thead><tr><th>Figure</th><th>Value</th><th>Verdict</th></tr></thead><tbody>${brows}</tbody></table></div>
      <h3>The two weeks</h3>
      <div class="table-wrap"><table class="tbl res"><thead><tr><th>Measure</th><th>Pi · week 1</th><th>Trial computer · week 1</th><th>Pi · week 2</th><th>Trial computer · week 2</th><th>Verdict</th></tr></thead><tbody>${rows}</tbody></table></div>
      <div class="row"><button type="button" class="ghost small" data-act="copy">Copy the results</button><button type="button" class="ghost small" data-act="clear">Clear them</button><span class="small dim">Kept in this browser only.</span></div>`;
  }
  function verdictCell(id) {
    const m = TRIAL.measures.find(x => x.id === id), ver = verdict(m, T.res[id] || {});
    $(`[data-ver="${id}"]`).innerHTML = ver ? `<span class="${ver.cls}">${esc(ver.text)}</span>` : '<span class="dim">—</span>';
  }
  function benchCell(id) {
    const m = TRIAL.bench.find(x => x.id === id), ver = benchVerdict(m, T.bench, freqs().length);
    $(`[data-bver="${id}"]`).innerHTML = ver ? `<span class="${ver.cls}">${esc(ver.text)}</span>` : '<span class="dim">—</span>';
  }

  function terms() {
    const el = $('#trial-terms');
    if (!el) return;
    const all = ALLTERMS();
    // this page's own words first, then the rest from the hardware review's one list (those this page has not already given a meaning of its own)
    const own = new Set(['tpm', 'secure-boot', 'fanless', 'quote', 'package', 'container', 'profile']);
    const more = ((KAPI() && KAPI().WORDS) || []).filter(id => !own.has(id)).map(RT).filter(Boolean);
    el.innerHTML = TERM_ORDER.filter(k => all[k]).map(k => `<li><b>${esc(all[k][0].charAt(0).toUpperCase() + all[k][0].slice(1))}</b> — ${esc(all[k][1])}</li>`).join('') +
      more.map(t => `<li><b>${esc(t.term)}</b> — ${esc(t.meaning)}</li>`).join('');
  }

  function renderAll() { picker(); drawing(); which(); verdinFold(); estimate(); shopping(); doSteps(); results(); terms(); }

  document.addEventListener('input', e => {
    const el = e.target;
    if (el.dataset.res) { (T.res[el.dataset.res] = T.res[el.dataset.res] || {})[el.dataset.k] = el.value; save(); verdictCell(el.dataset.res); }
    if (el.dataset.bench) { T.bench[el.dataset.bench] = el.value; save(); TRIAL.bench.forEach(m => benchCell(m.id)); }
  });
  document.addEventListener('change', e => {
    const el = e.target;
    if (el.dataset.got) { T.got[el.dataset.got] = el.checked; el.closest('li').classList.toggle('got', el.checked); save(); }
    if (el.id === 't-ch') { T.channels = el.value; save(); estimate(); which(); verdinFold(); TRIAL.bench.forEach(m => benchCell(m.id)); }
    if (el.id === 't-tr') { T.traffic = el.value; save(); estimate(); which(); verdinFold(); }
    if (el.id === 't-pick') { T.pick = el.value; save(); renderAll(); }
  });
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    if (b.dataset.act === 'copy') {
      const lines = ['Measure\tPi wk1\tTrial wk1\tPi wk2\tTrial wk2\tVerdict', ...TRIAL.measures.map(m => { const r = T.res[m.id] || {}; const ver = verdict(m, r); return [m.name, r.pi1 || '', r.am1 || '', r.pi2 || '', r.am2 || '', ver ? ver.text : ''].join('\t'); }),
        '', 'Computer\t' + platform(T.pick).short, 'Benchmark\tValue\tVerdict', ...TRIAL.bench.map(m => { const ver = benchVerdict(m, T.bench, freqs().length); return [m.name, T.bench[m.id] || '', ver ? ver.text : ''].join('\t'); })];
      const text = lines.join('\n');
      (navigator.clipboard ? navigator.clipboard.writeText(text) : Promise.reject()).then(() => toast('Results copied')).catch(() => toast('Couldn\'t copy here'));
    }
    if (b.dataset.act === 'clear') { T.res = {}; T.bench = {}; save(); results(); }
    if (b.dataset.act === 'theme') cycleTheme();
    if (b.dataset.act === 'copycode') {
      const code = document.getElementById(b.dataset.for).textContent;
      (navigator.clipboard ? navigator.clipboard.writeText(code) : Promise.reject()).then(() => toast('Copied')).catch(() => toast('Couldn\'t copy here'));
    }
  });
  function toast(t) { const el = $('#toast'); el.textContent = t; el.classList.add('show'); setTimeout(() => el.classList.remove('show'), 1800); }
  const THEME_KEY = 'open-alert:theme';
  function applyTheme(t) {
    if (t === 'light' || t === 'dark') document.documentElement.dataset.theme = t; else delete document.documentElement.dataset.theme;
    const l = $('#theme-label'); if (l) l.textContent = { light: 'Light', dark: 'Dark' }[t] || 'Auto';
  }
  function cycleTheme() {
    let t = 'auto';
    try { t = localStorage.getItem(THEME_KEY) || 'auto'; } catch (e) { /* ignore */ }
    t = { auto: 'light', light: 'dark', dark: 'auto' }[t] || 'auto';
    try { localStorage.setItem(THEME_KEY, t); } catch (e) { /* ignore */ }
    applyTheme(t);
  }
  try { applyTheme(localStorage.getItem(THEME_KEY) || 'auto'); } catch (e) { applyTheme('auto'); }
  renderAll();
})();
