// open-ALERT — the base-station builder's data.
//
// The builder (build.html) helps put together one ALERT receiving base station
// running RPi ALERT: a computer, RTL-SDR sticks, the RF chain, power, backhaul
// and a box. It reads the catalogue (OA_CATALOG) for each part it names with
// `ref`, and adds what a buyer needs that the catalogue doesn't carry:
//
//   aud    [low, high] in Australian dollars for one (or a metre: unit 'm') —
//          the spread across the suppliers and variants named in `where`;
//          [null, null] when only a quote will do. `gst: false` = ex GST.
//   lead   { d: [min, max] days to have it in hand, text: why }. "In stock in
//          Australia" is 2–7 days; overseas webshops 1–3 weeks; a factory
//          order is the manufacturer's stated lead time.
//   where  [[supplier, url]] — where to get it.
//   src    [[title, url]] for every figure; conf 'low' (and a note) where a
//          figure is a guess.
//   open   'open' | 'partial' | 'closed' — the hardware design.
//
// Decoding cost (`model`) is RPi ALERT's own measurements, from its
// docs/hardware.md: a channel's work grows with the stick's window (sample
// rate), and a burst's decode is about a second of a Pi 4 core. Platform
// capacity is the catalogue's `hw.sdrCh` (channels at 960 kHz on that box,
// scaled from a Pi 4's 8), turned into Pi 4 cores. Everything here is an
// estimate to plan with; the agent measures the real figures on the box.

(function () {
  const RPI_HW = ['RPi ALERT hardware notes', 'https://github.com/cdomotor-g/RPi_ALERT/blob/main/docs/hardware.md'];
  const RPI_HOW = ['RPi ALERT: how it works', 'https://github.com/cdomotor-g/RPi_ALERT/blob/main/docs/how-it-works.md'];
  const AU_STOCK = { d: [2, 7], text: 'stocked by Australian retailers' };
  const CORE = ['Core Electronics', 'https://core-electronics.com.au/'];
  const LB = ['Little Bird Electronics', 'https://www.littlebirdelectronics.com.au/'];
  const E14 = ['element14 Australia', 'https://au.element14.com/'];
  const JAYCAR = ['Jaycar', 'https://www.jaycar.com.au/'];
  const ALTRONICS = ['Altronics', 'https://www.altronics.com.au/'];

  const B = {
    asof: '2026-11',

    // ── the decoding model ──────────────────────────────────────────────────
    model: {
      // The windows a stick can take, how far apart its channels may be, and a
      // channel's continuous decoding at each relative to 240 kHz (hardware.md).
      // `fits` keeps 50 kHz in hand for the agent's tuning rules (the DC spike
      // and a zero-IF tuner's mirror images): it reproduces the docs' own
      // examples — Flood-Net's four channels take 1.44 MHz, and 18 Bateson's
      // 151.425–151.5375 and 151.95–152.4625 take 960 kHz each.
      windows: [
        { khz: 240, holds: 0.162, rel: 1 },
        { khz: 960, holds: 0.74, rel: 3 },
        { khz: 1200, holds: 0.93, rel: 3.7 },
        { khz: 1440, holds: 1.12, rel: 4.1 },
        { khz: 1920, holds: 1.51, rel: 5.1 },
        { khz: 2400, holds: 1.89, rel: 6.3 },
      ],
      margin: 0.05,
      maxPerStick: 8,
      // Pi 4 cores: one channel in 240 kHz between bursts (the bench: two sticks
      // of two channels took 0.49 of a core at 960 kHz, bursts and all); a
      // burst's decode attempt; the screen dashboard (an estimate).
      chCore240: 0.04,
      burstCoreS: 1.0,
      kioskCore: 0.5,
      safe: 0.7,            // plan to use no more than 70% of the CPU
      mbPerChannel: 30,
      src: [RPI_HW],
    },

    // RPi ALERT's decoders (Flood-Net's alert-dsp.js, #259): `cont` scales the
    // work between bursts with the window, `contBase` adds a part that does
    // not grow with it, `burst` a burst's decode; `burstFilterS` is the seconds
    // of a channel filtered per burst when filtering happens only around bursts
    // — RPi ALERT 0.18's watch filters from 1 s before a burst to 1 s after it,
    // at lean's rate (0.75 of the full decoder's): 2.4 s × 0.75. Asleep, a
    // channel costs 0.003 of a core at 240 kHz and 960 kHz and 0.005 at
    // 2.4 MHz on the bench where filtering always costs 0.011, 0.036 and
    // 0.074 (RPi ALERT's own measurement, lib/devices/sdr-bench.js): about
    // 0.18 + 0.02 × the window's cost, in the full decoder's 240 kHz units.
    decoders: [
      { id: 'today', short: 'Full decoder', name: 'Full decoder (RPi ALERT 0.15–0.16, or Decoder: Full)', cont: 1, burst: 1, status: 'current',
        note: 'Every channel converts and copies the stick\'s whole window sample by sample, and a burst\'s decode re-filters it for each of 45 guesses.' },
      { id: 'filter-once', short: 'Lean (0.17)', name: 'Lean — RPi ALERT 0.17\'s default', cont: 0.75, burst: 0.34, status: 'current',
        note: 'A burst is filtered once per carrier guess and nudged after: at the first base station to compare, 14 of 11,628 live bursts read differently from the full decoder (0.12%), in 33–34% of its time. Between bursts the rings are filled a block at a time and only a stick\'s first channel works out the spectrum: a quarter to two fifths less, measured.' },
      { id: 'lean', short: 'Around bursts (0.18)', name: 'Lean, filtering only around bursts — RPi ALERT 0.18, Between bursts', cont: 0.02, contBase: 0.18, burst: 0.34, burstFilterS: 1.8, status: 'checking',
        note: 'Between bursts each channel keeps the stick\'s last 1.6 s as bytes and looks at its channel 25 times a second; it filters only from a second before something shows, so the squelch and the decoder see the samples they always did. In Flood-Net\'s tests: the same readings and the same bursts, every time. Asleep, a channel costs a quarter of filtering always at 240 kHz and a fifteenth at 2.4 MHz. In RPi ALERT 0.18 behind a setting (default off) with a Check mode, to be proven at the first base station before it is the default.' },
    ],

    // Channels to offer. The first four are the ones Flood-Net's stations use
    // and a new RPi ALERT listens on by default.
    channels: [
      { mhz: 151.5, def: true, note: 'Flood-Net default' },
      { mhz: 151.525, def: true, note: 'Flood-Net default' },
      { mhz: 151.95, def: true, note: 'Flood-Net default' },
      { mhz: 152.4, def: true, note: 'Flood-Net default' },
      { mhz: 151.425, note: 'heard at a Brisbane base' },
      { mhz: 151.5375, note: 'ALERT2 heard at a Brisbane base' },
      { mhz: 151.575, note: 'heard at a Brisbane base' },
      { mhz: 152.4625, note: 'heard at a Brisbane base' },
    ],

    // ── the computer ────────────────────────────────────────────────────────
    platforms: [
      {
        id: 'rpi-4-4gb', ref: 'rpi-4-4gb', short: 'Pi 4', kind: 'board',
        aud: [150, 175], gst: true, lead: AU_STOCK, where: [LB, CORE],
        supply: '5v', usb: 4, m2: false, eth: 1, wifi: true, board: [85, 56], install: 'pi',
        fit: 'The reference: what RPi ALERT is tested on and what runs at the Brisbane base today. Fine indoors or in a shaded, vented box.',
        src: [RPI_HW], conf: 'high',
      },
      {
        id: 'rpi-5-4gb', ref: 'rpi-5-4gb', short: 'Pi 5', kind: 'board',
        aud: [170, 200], gst: true, lead: AU_STOCK, where: [LB, CORE],
        supply: '5v5a', usb: 4, m2: 'hat', eth: 1, wifi: true, board: [85, 56], install: 'pi',
        fit: 'Twice a Pi 4\'s headroom and a battery clock. Same stigma, same SD card unless you add an NVMe HAT.',
        src: [RPI_HW], conf: 'medium',
      },
      {
        id: 'rpi-cm5-io', ref: 'rpi-cm5-io', short: 'CM5 + IO board', kind: 'module',
        aud: [240, 320], gst: true, lead: { d: [5, 42], text: 'Australian retailers; the 4 GB Wi-Fi 32 GB eMMC module was out of stock at Core Electronics in early November 2026 — check before you commit' },
        where: [CORE, LB, E14],
        supply: '5v5a', usb: 2, m2: 'nvme', eth: 1, wifi: true, board: [160, 90], install: 'cm',
        fit: 'A Pi 5 as a module: eMMC instead of an SD card, −20 to +85 °C on the module, and a carrier you can later replace with your own. The cheapest step towards a custom board.',
        src: [['Core Electronics: CM5 4 GB Wi-Fi 32 GB', 'https://core-electronics.com.au/raspberry-pi-compute-module-5-4gb-wireless-32gb-emmc.html'], ['Core Electronics: CM5 IO Board', 'https://core-electronics.com.au/raspberry-pi-compute-module-5-io-board.html']], conf: 'medium',
      },
      {
        id: 'revpi-connect-5', ref: 'revpi-connect-5', short: 'RevPi Connect 5', kind: 'box',
        aud: [1000, 1250], gst: false, lead: { d: [7, 28], text: 'imported from KUNBUS (Germany) or a distributor; an estimate' },
        where: [['KUNBUS shop', 'https://revolutionpi.com/en/shop'], ['Revolution Pi distributors', 'https://revolutionpi.com/en/distributors']],
        supply: '24v', usb: 2, m2: false, eth: 2, wifi: false, board: [120, 100], install: 'cm',
        fit: 'A Compute Module 5 already in a DIN-rail PLC case, 24 V in, CE and UL: no carrier to design, vendor support, and the Pi name inside a German industrial product.',
        src: [['Revolution Pi Connect 5', 'https://revolutionpi.com/en/revpi-connect-5']], conf: 'low',
      },
      {
        id: 'toradex-verdin-am62-mallow', ref: 'toradex-verdin-am62-mallow', short: 'AM62 Quad + Mallow', kind: 'module',
        aud: [680.47, 680.47], gst: false,
        lead: { d: [5, 91], text: '3–5 business days when element14 holds UK stock; 13 weeks from the factory when it doesn\'t' },
        where: [E14, ['Toradex webshop (businesses only, about a third of the price)', 'https://www.toradex.com/computer-on-modules/verdin-arm-family/ti-am62']],
        supply: 'wide', usb: 2, m2: 'b-key', eth: 1, wifi: true, board: [100, 72], install: 'verdin', parts: 'module 00761200 (element14 4852670) · Mallow 01611102 (element14 4759350) · heatsink 23111001 (Toradex or Mouser; element14 Australia doesn\'t stock it)',
        fit: 'TI silicon on a Swiss module with availability to 2033+, on a carrier whose Altium files are published — the best base for an open custom carrier. But four Cortex-A53 cores are about half a Pi 4: it needs the faster decoder for more than a couple of channels.',
        src: [['Toradex Verdin AM62 (prices, availability)', 'https://www.toradex.com/computer-on-modules/verdin-arm-family/ti-am62'], ['element14: Mallow carrier', 'https://au.element14.com/toradex/01611102/carrier-board-mallow/dp/4759350'], ['Mallow carrier board datasheet', 'https://docs.toradex.com/116791-mallow_carrier_board_datasheet.pdf']], conf: 'medium',
      },
      {
        id: 'toradex-verdin-am62-dual-mallow', ref: 'toradex-verdin-am62-dual-mallow', short: 'AM62 Dual + Mallow', kind: 'module',
        aud: [512.28, 534.15], gst: false,
        lead: { d: [5, 91], text: '3–5 business days when element14 holds UK stock; 13 weeks from the factory when it doesn\'t' },
        where: [E14, ['Toradex webshop (businesses only, about a third of the price)', 'https://www.toradex.com/computer-on-modules/verdin-arm-family/ti-am62']],
        supply: 'wide', usb: 2, m2: 'b-key', eth: 1, wifi: false, board: [100, 72], install: 'verdin', parts: 'module 00741201 (element14 4759329, listed as 00741200) · Mallow 01611102 · heatsink 23111001',
        fit: 'The cheaper AM62: half the Quad\'s CPU, no Wi-Fi. With RPi ALERT 0.17\'s lean decoder it carries Flood-Net\'s four channels on a busy day, at about two thirds of its CPU; a site that hears a whole region wants the Quad.',
        src: [['Toradex Verdin AM62 (prices, availability)', 'https://www.toradex.com/computer-on-modules/verdin-arm-family/ti-am62'], ['element14: Mallow carrier', 'https://au.element14.com/toradex/01611102/carrier-board-mallow/dp/4759350'], ['Mallow carrier board datasheet', 'https://docs.toradex.com/116791-mallow_carrier_board_datasheet.pdf']], conf: 'medium',
      },
      {
        id: 'mini-pc-n150', ref: 'mini-pc-n150', short: 'N150 mini PC', kind: 'box',
        aud: [230, 350], gst: true, lead: { d: [2, 10], text: 'Australian online retailers' },
        where: [['Mwave', 'https://www.mwave.com.au/'], ['Amazon Australia', 'https://www.amazon.com.au/']],
        supply: 'mains', usb: 4, m2: 'nvme', eth: 1, wifi: true, board: [120, 115], install: 'debian',
        fit: 'Three times a Pi 4 with an SSD, for the price of a Pi 5 kit. Office temperatures, a fan, and a model that changes every year — fine in a comms room or for the server edition.',
        src: [], conf: 'low',
      },
      {
        id: 'fanless-industrial-x86', ref: 'fanless-industrial-x86', short: 'Fanless industrial x86', kind: 'box',
        aud: [900, 2500], gst: false, lead: { d: [10, 42], text: 'configured to order by OnLogic, Advantech or a distributor; an estimate' },
        where: [['OnLogic', 'https://www.onlogic.com/'], ['Advantech Australia', 'https://www.advantech.com/en-au']],
        supply: 'wide', usb: 4, m2: 'nvme', eth: 2, wifi: false, board: [170, 120], install: 'debian',
        fit: 'Sealed, wide DC input, industrial temperature, five years and more per model, nothing that says Raspberry Pi. Five to ten times the price of a Pi.',
        src: [['OnLogic Karbon', 'https://www.onlogic.com/computers/industrial/karbon/']], conf: 'low',
      },
    ],

    // ── the receivers ───────────────────────────────────────────────────────
    sdrs: [
      {
        id: 'rtl-sdr-blog-v4', ref: 'rtl-sdr-blog-v4', short: 'RTL-SDR Blog V4',
        aud: [60, 165], gst: true, lead: { d: [2, 21], text: 'kits stocked in Australia; the dongle alone from the RTL-SDR Blog store in 1–3 weeks' },
        where: [CORE, ['RTL-SDR Blog store', 'https://www.rtl-sdr.com/buy-rtl-sdr-dvb-t-dongles/']],
        mount: 'usb', open: 'partial',
        note: 'Metal case, TCXO, SMA. RPi ALERT knows it (Trixie\'s librtlsdr, or the RTL-SDR Blog build on Bookworm). The low end is the dongle alone, estimated.',
        src: [RPI_HW], conf: 'medium',
      },
      {
        id: 'rtl-sdr-blog-v3', ref: 'rtl-sdr-blog-v3', short: 'RTL-SDR Blog V3',
        aud: [50, 75], gst: true, lead: { d: [7, 21], text: 'RTL-SDR Blog store or Australian resellers' },
        where: [['RTL-SDR Blog store', 'https://www.rtl-sdr.com/buy-rtl-sdr-dvb-t-dongles/'], CORE],
        mount: 'usb', open: 'partial',
        note: 'Supported by every librtlsdr. Being replaced by the V4.',
        src: [RPI_HW], conf: 'medium',
      },
      {
        id: 'm2-rtl-card', short: 'RTL2832U on an M.2 card (to design)', planned: true,
        aud: [40, 90], gst: true, lead: { d: [42, 84], text: 'design, prototype boards and assembly: 6–12 weeks — an estimate' },
        where: [['A PCB designer with RF experience; JLCPCB or PCBWay for prototypes', 'https://jlcpcb.com/']],
        mount: 'm2', open: 'open',
        note: 'No off-the-shelf M.2 RTL-SDR card was found. An RTL2832U and tuner on a 2242 B-key card, using the slot\'s USB 2.0 lines, with u.FL or SMA: screwed down, nothing to knock loose. Unit cost after the design work; an estimate. The AM62 has no PCIe, so on a Verdin the card must be a USB device.',
        src: [], conf: 'low',
      },
    ],

    // How each stick is held. `perStick` items are bought once a stick.
    mounts: [
      {
        id: 'direct', name: 'Straight into the computer\'s USB port',
        aud: [0, 0], gst: true, lead: { d: [0, 0], text: '—' }, where: [],
        note: 'Cheapest. The stick levers on the port: a bump or a tug on the coax unseats it, and the agent then sees a receiver come and go.',
        src: [], conf: 'high', for: ['usb'],
      },
      {
        id: 'ext-clamp', name: 'Short USB extension, stick clamped to the rail',
        aud: [12, 30], gst: true, lead: { d: [1, 5], text: 'any electronics shop' }, where: [JAYCAR, ALTRONICS],
        note: 'A 0.3–0.5 m USB 2.0 extension and a P-clip or cable-tie saddle: the port carries no weight. Keep each stick in its own port — the agent names sticks by USB port.',
        src: [], conf: 'low', for: ['usb'], def: true,
      },
      {
        id: 'panel-lock', name: 'Sealed locking USB through the box wall (Bulgin Buccaneer)',
        aud: [90, 150], gst: true, lead: { d: [3, 126], text: 'element14 ships its UK stock in 3–5 days; Bulgin\'s factory lead time is 18 weeks' },
        where: [E14, ['RS Components Australia', 'https://au.rs-online.com/']],
        note: 'A PX0843/A IP68 panel receptacle (A$57 inc GST at element14) and its mating bayonet lead: the stick lives in its own small box or under a cover, and nothing is loosened by a door or a cable pull. The mating lead\'s price is an estimate.',
        src: [['element14: Bulgin PX0843/A', 'https://au.element14.com/bulgin/px0843-a/usb-type-a-receptacle-panel-lead/dp/1166681']], conf: 'medium', for: ['usb'],
      },
      {
        id: 'm2-slot', name: 'In the M.2 slot, screwed down',
        aud: [0, 0], gst: true, lead: { d: [0, 0], text: '—' }, where: [],
        note: 'Only for a card SDR. The slot must carry USB 2.0: Mallow\'s B-key slot does (its datasheet lists USB 2.0 and 3.x beside one PCIe lane); a CM5 IO board\'s M-key slot is PCIe only, so it needs a carrier of your own.',
        src: [['Mallow carrier board datasheet', 'https://docs.toradex.com/116791-mallow_carrier_board_datasheet.pdf']], conf: 'medium', for: ['m2'],
      },
    ],

    // ── RF ──────────────────────────────────────────────────────────────────
    antennas: [
      { id: 'vhf-dipole-unity', ref: 'vhf-dipole-unity', aud: [150, 260], gst: true, lead: { d: [5, 21], text: 'RF dealers, often made to order' }, where: [['RFI Technology Solutions', 'https://www.rfi.com.au/']], src: [], conf: 'low' },
      { id: 'rfi-col54', ref: 'rfi-col54', aud: [550, 800], gst: true, lead: { d: [7, 28], text: 'RF dealers, often made to order' }, where: [['RFI Technology Solutions', 'https://www.rfi.com.au/']], src: [], conf: 'low', def: true },
      { id: 'ham-collinear', ref: 'ham-collinear', aud: [150, 250], gst: true, lead: AU_STOCK, where: [['Amateur radio retailers', 'https://www.strictlyham.com.au/']], src: [], conf: 'low' },
    ],
    rf: {
      coax: { ref: 'coax-lmr400', aud: [8, 14], gst: true, unit: 'm', lead: { d: [3, 10], text: 'RF suppliers cut to length' }, where: [['RF Shop / Rojone and other RF suppliers', 'https://www.rojone.com.au/']], src: [], conf: 'low' },
      nCrimp: { ref: 'n-crimp-lmr400', aud: [10, 20], gst: true, lead: { d: [3, 10], text: 'RF suppliers' }, where: [['Rojone', 'https://www.rojone.com.au/']], src: [], conf: 'low' },
      arrestor: { ref: 'polyphaser-is-50nx-c2', aud: [25, 180], gst: true, lead: { d: [3, 21], text: 'a generic gas-tube from stock in days; PolyPhaser often imported' }, where: [['Rojone', 'https://www.rojone.com.au/'], E14], note: 'Low end: a generic N-type gas-discharge arrestor; high end: PolyPhaser.', src: [], conf: 'low' },
      pigtail: { ref: 'sma-n-pigtail', aud: [12, 30], gst: true, lead: AU_STOCK, where: [JAYCAR, ['Rojone', 'https://www.rojone.com.au/']], src: [], conf: 'low' },
      split2: { ref: 'vhf-splitter-2', aud: [80, 180], gst: true, lead: { d: [5, 21], text: 'RF suppliers' }, where: [['Rojone', 'https://www.rojone.com.au/']], src: [], conf: 'low' },
      split4: { ref: 'vhf-splitter-4', aud: [120, 260], gst: true, lead: { d: [5, 21], text: 'RF suppliers' }, where: [['Rojone', 'https://www.rojone.com.au/']], src: [], conf: 'low' },
      earth: { ref: 'earth-kit', aud: [45, 90], gst: true, lead: AU_STOCK, where: [['Electrical wholesalers', 'https://www.middys.com.au/']], src: [], conf: 'low' },
    },

    // ── power ───────────────────────────────────────────────────────────────
    power: [
      { id: 'mains-plug', name: 'Mains: the board\'s own supply', aud: [15, 30], gst: true, lead: AU_STOCK, where: [CORE, LB],
        note: 'The official 15 W (Pi 4) or 27 W (Pi 5, CM5 IO board) USB-C supply. RPi ALERT shows an under-voltage banner if it sags. A mini PC brings its own brick (nothing to buy).', src: [RPI_HW], conf: 'medium', mains: true },
      { id: 'dc12', name: '12 V DC (battery or DC supply) through a DIN-rail converter', ref: 'meanwell-ddr-15g-5', aud: [45, 70], gst: true, lead: { d: [2, 10], text: 'Power Supplies Australia and electrical wholesalers' },
        where: [['Power Supplies Australia', 'https://www.power-supplies-australia.com.au/']],
        note: 'A Mean Well DDR-15G-5 (9–36 V in, 5 V 3 A) for a Pi 4; the DDR-30G-5 (6 A) for a Pi 5 or CM5. Boxes with a wide DC input take 12 or 24 V directly.', src: [], conf: 'medium' },
      { id: 'dcups', name: 'Mains with battery backup (DC UPS)', ref: 'dc-ups-drc60-18ah', aud: [150, 230], gst: true, lead: { d: [3, 10], text: 'Power Supplies Australia; the battery from any battery shop' },
        where: [['Power Supplies Australia', 'https://www.power-supplies-australia.com.au/'], ['Battery World', 'https://www.batteryworld.com.au/']],
        note: 'A Mean Well DRC-60A charging an 18 Ah AGM: hours through a power cut, plus the 12 → 5 V converter for a 5 V board. RPi ALERT\'s disk queue keeps readings through anything longer.', src: [], conf: 'low', mains: true },
    ],

    // ── backhaul ────────────────────────────────────────────────────────────
    backhaul: [
      { id: 'lan', name: 'Ethernet to the site\'s network', aud: [5, 20], gst: true, lead: AU_STOCK, where: [JAYCAR],
        note: 'A patch lead. The agent posts out over HTTPS and never needs a port opened: Flood-Net never connects in.', src: [RPI_HOW], conf: 'high', def: true },
      { id: 'rut241', name: '4G router on Ethernet (Teltonika RUT241) + IoT SIM', ref: 'teltonika-rut241', aud: [280, 360], gst: true, lead: { d: [2, 10], text: 'Australian Teltonika distributors' },
        where: [['Teltonika distributors in Australia', 'https://teltonika-networks.com/where-to-buy']],
        note: 'Certified, swappable, keeps the computer\'s M.2 slot free for an SDR. Add an IoT SIM (A$5–15 a month).', src: [], conf: 'medium', box: [60, 80] },
      { id: 'starlink', name: 'Starlink Mini on Ethernet', ref: 'starlink-mini', aud: [500, 600], gst: true, lead: { d: [2, 10], text: 'Starlink and retailers' },
        where: [['Starlink', 'https://www.starlink.com/au']],
        note: 'Where there is no mobile coverage. Expect short overnight outages for its updates (the Brisbane base sees three nine-minute dropouts about 3 am a week) — the disk queue covers them. Plus a plan.', src: [], conf: 'medium', box: [60, 40], outside: true },
      { id: 'wifi', name: 'Wi-Fi to the site\'s network', aud: [0, 0], gst: true, lead: { d: [0, 0], text: '—' }, where: [],
        note: 'The board\'s own Wi-Fi (a Verdin needs a "WB" module and u.FL antennas). Least robust in a metal box.', src: [], conf: 'high', needsWifi: true },
    ],

    // ── where it lives ──────────────────────────────────────────────────────
    enclosures: [
      { id: 'indoor-shelf', name: 'Indoors (comms room, office)', aud: [30, 60], gst: true, lead: AU_STOCK, where: [CORE, LB],
        note: 'A case for the board (a DIN case or the maker\'s own). Bring the coax in through a wall plate or window feed-through.', src: [], conf: 'low', indoor: true, temp: 35 },
      { id: 'rack', name: '19-inch rack shelf', ref: 'rack-shelf-19', aud: [40, 120], gst: true, lead: AU_STOCK, where: [['Rack suppliers', 'https://www.rackcabinets.com.au/']],
        note: 'In an existing comms rack, beside the network gear.', src: [], conf: 'low', indoor: true, temp: 30 },
      { id: 'fibox', name: 'IP66 cabinet in a shaded hut (Fibox ARCA 400×300×150)', ref: 'fibox-arca-403015', aud: [180, 290], gst: true,
        lead: { d: [3, 14], text: 'NHP stocks Fibox in Australia' }, where: [['NHP (Fibox)', 'https://www.nhp.com.au/']],
        note: 'The fittings (DIN rail, terminals, fuses, glands, vent, desiccant) are their own line. Keep it out of the sun: a sealed box in full Queensland sun runs about 65 °C inside.', src: [], conf: 'low', temp: 50, def: true },
    ],

    gps: { ref: 'usb-gps-puck', aud: [25, 60], gst: true, lead: AU_STOCK, where: [JAYCAR, CORE],
      note: 'Optional: gives the base its exact location for Flood-Net and a clock when there is no internet.', src: [], conf: 'low' },

    // ── the custom path ─────────────────────────────────────────────────────
    custom: [
      { id: 'decoder', name: 'Lighter decoder (filter once per guess, bursts-only front end)', aud: [0, 0], gst: true, where: [['RPi ALERT', 'https://github.com/cdomotor-g/RPi_ALERT'], ['Flood-Net', 'https://github.com/cdomotor-g/MegaNet']], lead: { d: [14, 56], text: 'open-source work in Flood-Net and RPi ALERT; an estimate' },
        note: 'No hardware cost. Half done: RPi ALERT 0.17 decodes a burst in a third of the time and does a quarter less between bursts. Left: filtering each channel only around bursts, about a fortieth of the between-bursts work in a prototype.', src: [], conf: 'low' },
      { id: 'm2card', name: 'M.2 RTL-SDR card: design and first boards', aud: [3000, 8000], gst: false, where: [['A PCB designer with RF experience', 'https://www.engineersaustralia.org.au/'], ['JLCPCB (prototype boards)', 'https://jlcpcb.com/']], lead: { d: [42, 84], text: 'a designer, prototypes, bring-up; an estimate' },
        note: 'Small, self-contained, testable on today\'s CM5 IO board or Mallow. Lifetime-buy the RTL2832U chips: mainstream distributors don\'t stock them.', src: [['DigiKey forum: no RTL2832U on DigiKey', 'https://forum.digikey.com/t/alternative-for-rtl-sdr-rtl2832u/29884']], conf: 'low' },
      { id: 'carrier', name: 'Custom carrier board (CM5 or Verdin)', aud: [15000, 40000], gst: false, where: [['Toradex design partners', 'https://www.toradex.com/support/partner-network/hardware/carrier-boards'], ['Raspberry Pi Approved Design Partners', 'https://www.raspberrypi.com/for-industry/design-partners/']], lead: { d: [90, 180], text: 'specification, layout, two board spins; an estimate' },
        note: 'Start from a published design (Mallow\'s Altium files, or the CM5 IO board\'s KiCad files): 9–36 V input with surge and reverse protection, watchdog, RTC, the SDR on board or in M.2, DIN-rail footprint.', src: [['Toradex Mallow (design files)', 'https://www.toradex.com/products/carrier-board/mallow-carrier-board']], conf: 'low' },
      { id: 'emc', name: 'EMC testing and RCM for a board of your own', aud: [5000, 15000], gst: false, where: [['NATA-accredited EMC test labs', 'https://nata.com.au/']], lead: { d: [14, 42], text: 'a test lab booking; an estimate' },
        note: 'An off-the-shelf module and carrier carry their own compliance; a carrier you design needs its own before it goes on a Bureau site.', src: [['ACMA: the RCM', 'https://www.acma.gov.au/compliance-labelling']], conf: 'low' },
    ],
  };

  if (typeof module === 'object' && module.exports) module.exports = B;
  else globalThis.OA_BUILDER = B;
})();
