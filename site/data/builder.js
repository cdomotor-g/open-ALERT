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

    // ── delivery ────────────────────────────────────────────────────────────
    // What each shop charges to deliver an order to an Australian address,
    // A$ inc GST: ship [a small order, a large or heavy one]; `freeOver` the
    // order value it delivers free above; `from` where it ships from; `ddp`
    // when it clears customs itself and charges GST at checkout; `src` its
    // delivery page.
    shops: {
      'Core Electronics': { ship: [7, 11], from: 'AU', note: 'From A$7 by tracked post, A$11 express (search listings: Core blocks automated reads).', src: [['Core Electronics product page (shipping rates; search listing)', 'https://core-electronics.com.au/servo-extension-cable-1m-male-male.html']], conf: 'low' },
      'Little Bird Electronics': { ship: [11.94, 16.73], from: 'AU', note: 'A live quote to Brisbane for a small parcel: A$11.94 by parcel post, A$16.73 express.', src: [['Little Bird shipping policy', 'https://littlebirdelectronics.com.au/pages/shipping-policy']], conf: 'high' },
      'Jaycar': { ship: [7.95, 14.95], freeOver: 99, from: 'AU', note: 'Search listings: A$7.95–9.95 standard, free over A$99 (one says A$149).', src: [['Jaycar delivery page (search listing)', 'https://jaycar-prod.australia-southeast1.gcp.storefrontcloud.io/delivery']], conf: 'low' },
      'Altronics': { ship: [10, 25], from: 'AU', note: 'Charged by weight at checkout: an estimate.', src: [['Altronics shipping options', 'https://www.altronics.com.au/shipping']], conf: 'low' },
      'element14 Australia': { ship: [26.4, 26.4], freeOver: 66, from: 'GB', note: 'About A$26 under A$60 ex GST, free above (a search listing); much of its stock comes from the UK in 3–5 days, duty and GST included.', src: [['element14 AU delivery information (could not be read)', 'https://au.element14.com/help-delivery-information']], ddp: true, conf: 'low' },
      'RS Components Australia': { ship: [22, 22], freeOver: 88, from: 'AU', note: 'A$22 under A$80 ex GST, free above.', src: [['RS Australia delivery methods & charges', 'https://au.rs-online.com/web/content/support/all-articles/delivery']], ddp: true, conf: 'medium' },
      'Techwave': { ship: [26.62, 35.64], freeOver: 1500, from: 'AU', note: 'Courier A$26.62, express A$35.64, free over A$1,500; a long antenna may go by freight.', src: [['Techwave shipping policy', 'https://store.techwave.com.au/policies/shipping-policy']], conf: 'high' },
      'Power Supplies Australia': { ship: [27.5, 27.5], freeOver: 75, from: 'AU', note: 'A$27.50, free over A$75.', src: [['ADM / Power Supplies Australia: postage & delivery', 'https://www.admtech.com.au/postage-delivery']], conf: 'high' },
      'Middy\'s': { ship: [16.5, 16.5], freeOver: 825, from: 'AU', note: 'A$16.50 under A$750 ex GST.', src: [['Middy\'s delivery terms', 'https://www.middys.com.au/delivery-terms']], conf: 'medium' },
      'SCHNAP': { ship: [20, 40], from: 'AU', note: 'Delivers only orders over A$150, priced at checkout (an estimate); or collect in Sydney.', src: [['SCHNAP product page: ordering & delivery information', 'https://www.schnap.com.au/wall-mount-electrical-enclosure-ip66-400x300x150mm-polycarbonate-nhp-arca403015.html']], conf: 'low' },
      'Mwave': { ship: [10.95, 15], from: 'AU', note: 'A$9.95–10.95 standard, about A$15 express.', src: [['Mwave shipping policy', 'https://www.mwave.com.au/policies/shipping-policy']], conf: 'high' },
      'IP Trading': { ship: [16.5, 16.5], from: 'AU', note: 'Express under 10 kg, 1–3 days.', src: [['IP Trading: RUT241 (stock 91)', 'https://www.iptrading.com.au/products/teltonika-rut241065000-compact-4g-lte-router-2x-ethernet']], conf: 'high' },
      'Starlink': { ship: [19, 34], from: 'AU', note: 'About A$19 (A$34 in late 2024): a search listing.', src: [['WhistleOut: Starlink Mini and Roam (search listing)', 'https://www.whistleout.com.au/Broadband/Guides/Starlink-Mini-and-Starlink-Roam']], conf: 'low' },
      'Battery World': { ship: [15, 20], from: 'AU', note: 'From the local store: A$15 standard, A$20 same day; it delivers only orders over A$100.', src: [['Battery World delivery', 'https://www.batteryworld.com.au/services/delivery']], conf: 'medium' },
      'DigiKey Australia': { ship: [24, 24], freeOver: 60, from: 'US', note: 'From Minnesota in about 4 days: A$24 under A$60, free above, GST charged at checkout.', src: [['DigiKey AU page footer: free delivery over A$60, A$24 under, about 4 days, CPT (search listing)', 'https://www.digikey.com.au/en/maker/search-results?pn=3523678']], ddp: true, conf: 'medium' },
      'Mouser Australia': { ship: [20, 30], freeOver: 60, from: 'US', note: 'Free over A$60, duty and GST included; the charge below that is an estimate.', src: [['au.mouser.com page footer: free shipping over A$60, DDP (search listing)', 'https://au.mouser.com/wi2wi']], ddp: true, conf: 'low' },
      'RTL-SDR Blog store': { ship: [0, 0], from: 'CN', note: 'Free economy post from its China warehouse: usually 2–4 weeks, up to 8; express costs extra.', src: [['RTL-SDR Blog store: shipping policy', 'https://www.rtl-sdr.com/buy-rtl-sdr-dvb-t-dongles/']], conf: 'high' },
      'Radio Parts': { ship: [12, 20], from: 'AU', note: 'Road freight by weight and zone from Melbourne: an estimate.', src: [['Radio Parts freight', 'https://radioparts.com.au/freight']], conf: 'low' },
      'City Technology': { ship: [15, 30], from: 'AU', note: 'Not published: an estimate.', src: [['City Technology: IS-50NX-C2', 'https://citytechnology.com.au/shop/is-50nx-c2-polyphaser-is-50nx-c2-125-1000mhz-dc-block-nf-to-nf-5041']], conf: 'low' },
      'PB Tech Australia': { ship: [10, 20], from: 'AU', note: 'Not checked: an estimate.', src: [], conf: 'low' },
      'Strictly Ham': { ship: [15, 45], from: 'AU', note: 'eParcel, or a courier for an antenna over 1.05 m, quoted at checkout: an estimate.', src: [['Strictly Ham terms and conditions (shipping & delivery)', 'https://www.strictlyham.com.au/terms-and-conditions']], conf: 'low' },
      'Toradex webshop': { ship: [60, 150], from: 'CH', note: 'Express courier from Europe, charged at checkout and not published: an estimate. Businesses only; the buyer pays any import charges.', src: [['Toradex: how to order (search listing; the page refuses automated reads)', 'https://toradex.com/order-now/how-to-order']], conf: 'low' },
      'OnLogic': { ship: [60, 150], from: 'US', note: 'Courier from the US or Europe, not published: an estimate.', src: [], conf: 'low' },
      'Advantech Australia': { ship: [0, 40], from: 'AU', note: 'Through its Australian office or distributors: an estimate.', src: [], conf: 'low' },
      'Amazon Australia': { ship: [0, 10], from: 'AU', note: 'Often free over about A$59: not checked.', src: [['Inside Retail / Internet Retailing: Amazon lowers free shipping threshold (search listing, undated)', 'https://internetretailing.com.au/amazon-lowers-free-shipping-threshold/']], conf: 'low' },
      'SE Comms': { ship: [10, 15], from: 'AU', note: 'Not published: an estimate.', src: [['SE Comms RTL-SDR category', 'https://secomms.com.au/product-category/rtl-sdr/']], conf: 'low' },
    },
    import: { threshold: 1000, clearance: [200, 280], what: 'about A$200–280 to clear it: Home Affairs\' A$50 import processing charge, A$48 biosecurity for air freight, and a courier\'s or broker\'s fee of about A$100–180',
      src: [['Australian Border Force: import processing charges', 'https://www.abf.gov.au/importing-exporting-and-manufacturing/importing/cost-of-importing-goods/charges/import-processing-charge'], ['DHL Express Australia: customs services and fees', 'https://mydhl.express.dhl/au/en/ship/customs-services.html'], ['ATO: GST on low value imported goods', 'https://www.ato.gov.au/Business/International-tax-for-business/GST-on-imported-goods-and-services/GST-on-low-value-imported-goods/'], ['DHL AU customs forum answer: brokers A$115–180 (search listing)', 'https://www.dhl.com/discover/en-au/logistics-advice/import-export-advice/customs-declaration-when-importing-and-exporting-from-australia']] },

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
    // — RPi ALERT 0.19's watch filters from 0.8 s before a burst to half a
    // second after it, about 1.7 s with the burst, at lean's rate (0.75 of the
    // full decoder's): 1.3. Asleep, a
    // channel costs 0.003 of a core at 240 kHz and 960 kHz and 0.005 at
    // 2.4 MHz on the bench where filtering always costs 0.011, 0.036 and
    // 0.074 (RPi ALERT's own measurement, lib/devices/sdr-bench.js): about
    // 0.18 + 0.02 × the window's cost, in the full decoder's 240 kHz units.
    decoders: [
      { id: 'today', short: 'Full decoder', name: 'Full decoder (RPi ALERT 0.15–0.16, or Decoder: Full)', cont: 1, burst: 1, status: 'current',
        note: 'Every channel converts and copies the stick\'s whole window sample by sample, and a burst\'s decode re-filters it for each of 45 guesses.' },
      { id: 'filter-once', short: 'Lean (0.17)', name: 'Lean — RPi ALERT 0.17\'s default', cont: 0.75, burst: 0.34, status: 'current',
        note: 'A burst is filtered once per carrier guess and nudged after: at the first base station to compare, 14 of 11,628 live bursts read differently from the full decoder (0.12%), in 33–34% of its time. Between bursts the rings are filled a block at a time and only a stick\'s first channel works out the spectrum: a quarter to two fifths less, measured.' },
      { id: 'lean', short: 'Around bursts (0.18)', name: 'Lean, filtering only around bursts — RPi ALERT 0.18, Between bursts', cont: 0.02, contBase: 0.18, burst: 0.34, burstFilterS: 1.3, status: 'checking',
        note: 'Between bursts each channel keeps the stick\'s last 1.4 s as bytes and looks at its channel 25 times a second; it filters only from 0.8 s before something shows to half a second after, so the squelch and the decoder see the samples they always did. In Flood-Net\'s tests: the same readings and the same bursts, every time. Asleep, a channel costs a quarter of filtering always at 240 kHz and a fifteenth at 2.4 MHz. In RPi ALERT 0.18 behind a setting (default off) with a Check mode; 0.19 shortens its time awake a third. Its first live check (the first base station, November 2026) found it misses some of the weakest bursts: on one channel, readings just over the squelch that filtering always decoded. So it stays off by default and a Pi 4 keeps filtering always: count it as the way a small computer fits a site, at the cost of some weak bursts.' },
      { id: 'light', short: 'Light, around bursts (0.19)', name: 'Light decoder, filtering only around bursts — RPi ALERT 0.19', cont: 0.02, contBase: 0.18, burst: 0.18, burstFilterS: 1.3, status: 'checking',
        note: 'As Around bursts, and each burst filtered down to 48 kHz once before its nine carrier guesses: a burst\'s decode in about half of lean\'s time (65 ms against 122 on the bench), as many true readings in 600 synthesised bursts and the same on every real one. In RPi ALERT 0.19 as Decoder: Light, with Compare light to prove it at the first base station.' },
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
        aud: [162.2, 163], gst: true, lead: { d: [2, 7], text: 'in stock at Core Electronics (A$162.20) and Little Bird (A$163), November 2026' }, where: [LB, CORE],
        supply: '5v', usb: 4, m2: false, eth: 1, wifi: true, board: [85, 56], install: 'pi',
        fit: 'The reference: what RPi ALERT is tested on and what runs at the Brisbane base today. Fine indoors or in a shaded, vented box.',
        src: [RPI_HW], conf: 'high',
      },
      {
        id: 'rpi-3b-plus', ref: 'rpi-3b-plus', short: 'Pi 3B+', kind: 'board',
        aud: [64.79, 83.23], gst: true, lead: { d: [2, 7], text: 'in stock at Core Electronics (A$64.79) and Little Bird (A$83.23), November 2026' }, where: [LB, CORE],
        supply: '5v', usb: 4, m2: false, eth: 1, wifi: true, board: [85, 56], install: 'pi',
        fit: 'Half a Pi 4, and since RPi ALERT 0.18–0.19 enough for a whole site: four or five channels on a busy day at under a fifth of its CPU, filtering only around bursts. 1 GB holds the decoders and the screen dashboard; leave the screen off on a heavy site. Micro-USB power: a good 2.5 A supply.',
        src: [RPI_HW], conf: 'medium',
      },
      {
        id: 'rpi-5-4gb', ref: 'rpi-5-4gb', short: 'Pi 5', kind: 'board',
        aud: [178.42, 249], gst: true, lead: { d: [2, 40], text: 'A$249 in stock at Altronics (Jaycar lists the same price): 2–7 days. A$178.42 on back-order at Core Electronics, dispatch early December; out of stock at Little Bird, Pakronics and element14' }, where: [['Altronics', 'https://www.altronics.com.au/p/z6302j-raspberry-pi-5-single-board-computer-4gb-ram/'], ['Jaycar', 'https://www.jaycar.com.au/raspberry-pi-5-single-board-computer-4gb/p/XC9106'], ['Core Electronics', 'https://core-electronics.com.au/raspberry-pi-5-model-b-4gb.html']],
        supply: '5v5a', usb: 4, m2: 'hat', eth: 1, wifi: true, board: [85, 56], install: 'pi',
        fit: 'Twice a Pi 4\'s headroom and a battery clock. Same stigma, same SD card unless you add an NVMe HAT.',
        src: [RPI_HW], conf: 'medium',
      },
      {
        id: 'rpi-cm5-io', ref: 'rpi-cm5-io', short: 'CM5 + IO board', kind: 'module',
        aud: [247.25, 255], gst: true, lead: { d: [14, 90], text: 'no Australian stock of the 4 GB, 32 GB eMMC Wi-Fi module on 7 November 2026: out of stock with no date at Core Electronics (A$219.95 + IO board A$27.30, in stock) and as Little Bird\'s A$255 dev kit — an estimate' },
        where: [CORE, LB, E14],
        supply: '5v5a', usb: 2, m2: 'nvme', eth: 1, wifi: true, board: [160, 90], install: 'cm',
        fit: 'A Pi 5 as a module: eMMC instead of an SD card, −20 to +85 °C on the module, and a carrier you can later replace with your own. The cheapest step towards a custom board.',
        src: [['Core Electronics: CM5 4 GB Wi-Fi 32 GB', 'https://core-electronics.com.au/raspberry-pi-compute-module-5-4gb-wireless-32gb-emmc.html'], ['Core Electronics: CM5 IO Board', 'https://core-electronics.com.au/raspberry-pi-compute-module-5-io-board.html']], conf: 'medium',
      },
      {
        id: 'revpi-connect-5', ref: 'revpi-connect-5', short: 'RevPi Connect 5', kind: 'box',
        aud: [1038.19, 1196.18], gst: false, lead: { d: [5, 14], text: 'DigiKey Australia from US stock (7 in a search listing) by courier; RS Australia at A$1,196.18; KUNBUS\'s own shop ships only within Europe — an estimate' },
        where: [['DigiKey Australia', 'https://www.digikey.com.au/en/products/detail/kunbus-gmbh/PR100412/26266695'], ['RS Australia', 'https://au.rs-online.com/web/p/industrial-computers/0428429']],
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
        id: 'toradex-luna-sl1680', ref: 'toradex-luna-sl1680', short: 'Luna SL1680', kind: 'board',
        aud: [210.14, 255], gst: false,
        lead: { d: [7, 35], text: 'Toradex\'s webshop, by courier from abroad; it shows no stock or lead time and no Australian distributor lists it — an estimate' },
        where: [['Toradex webshop (US$145 for one)', 'https://www.toradex.com/single-board-computers/luna-sl1680']],
        supply: '5v5a', usb: 4, m2: false, eth: 1, wifi: true, board: [85, 56], install: 'luna', parts: 'Luna SBC SL1680 Quad 4GB Wi-Fi / Bluetooth ET, Toradex 0301 (03011000)',
        mainsNote: 'A 5 V supply good for 5 A — Toradex\'s figure — on a USB-C lead, or 5 V into the 40-pin header. The Luna doesn\'t negotiate USB-PD (its datasheet), so a phone or Pi 5 charger may hold it to 3 A.', mainsAud: [45, 75],
        fit: 'A Pi-sized Toradex board: four Cortex-A73 cores at 2.1 GHz — a little more than a Pi 4, about 1.1 times, scaled by clock (no benchmarks published yet) — 4 GB, 16 GB eMMC, a battery clock, four USB 3 ports, −25 to +85 °C, about US$145. New in 2026 and untested with RPi ALERT: it comes with Torizon OS, so RPi ALERT runs in a Debian container, as on the Verdin. 5 V only, like a Pi.',
        src: [['Toradex: Luna SL1680', 'https://www.toradex.com/single-board-computers/luna-sl1680'], ['Luna SL1680 datasheet (preliminary)', 'https://docs.toradex.com/118084-luna_sl1680_datasheet.pdf'], ['Luna SL1680 getting started', 'https://docs.toradex.com/118333-luna_sl1680_sbc_getting_started.pdf']], conf: 'low',
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
        id: 'rtl-sdr-blog-v3', ref: 'rtl-sdr-blog-v3', short: 'RTL-SDR Blog V3',
        aud: [50.65, 72.39], gst: true, lead: { d: [7, 56], text: 'RTL-SDR Blog store, from China: free economy post takes 1–8 weeks (usually 2–4), or express in 2–8 business days. Its Australian reseller SE Comms (A$65 dongle, A$76 kit) is out of stock. Little Bird can get the SparkFun kit through Sydney for A$185.40' },
        where: [['RTL-SDR Blog store', 'https://www.rtl-sdr.com/buy-rtl-sdr-dvb-t-dongles/'], ['SE Comms (RTL-SDR Blog\'s Australian reseller)', 'https://secomms.com.au/product-category/rtl-sdr/'], ['Little Bird Electronics', 'https://littlebirdelectronics.com.au/']],
        mount: 'usb', open: 'partial',
        note: 'The stick to buy now: supported by every librtlsdr, and in stock at its maker — US$34.95 for the dongle alone, free post from China in 2–4 weeks (up to 8). From Australian stock it comes only as SparkFun\'s A$185 kit.',
        src: [RPI_HW, ['RTL-SDR Blog store: prices, stock by warehouse, shipping policy', 'https://www.rtl-sdr.com/buy-rtl-sdr-dvb-t-dongles/'], ['SE Comms: RTL-SDR Blog V3 dongle A$65, OutOfStock', 'https://secomms.com.au/product/rtl-sdr-blog-v3-r820t2-rtl2832u-1ppm-tcxo-sma-software-defined-radio-dongle/']], conf: 'high', def: true },
      {
        id: 'rtl-sdr-blog-v4', ref: 'rtl-sdr-blog-v4', short: 'RTL-SDR Blog V4',
        aud: [159.65, 161.19], gst: true, lead: { d: [14, 56], text: 'End of line since May 2026: only resellers\' leftover stock. Little Bird has none in Sydney or at SparkFun, and the RTL-SDR Blog store\'s V4 dongle is out of stock, so there is no date' },
        where: [['Little Bird Electronics', 'https://littlebirdelectronics.com.au/'], ['Core Electronics', 'https://core-electronics.com.au/'], ['RTL-SDR Blog store', 'https://www.rtl-sdr.com/buy-rtl-sdr-dvb-t-dongles/']],
        mount: 'usb', open: 'partial',
        note: 'End of life since May 2026 (its R828D tuner is no longer made): none in stock in November 2026, only leftovers if you find them. Metal case, TCXO, SMA. RPi ALERT knows it (Trixie\'s librtlsdr, or the RTL-SDR Blog build on Bookworm).',
        src: [RPI_HW, ['RTL-SDR Blog: V4 end of line (14 May 2026)', 'https://www.rtl-sdr.com/rtl-sdr-blog-v4-end-of-line/'], ['Little Bird: RTL-SDR Blog V4 kit A$159.65, 0 in Sydney, 0 at SparkFun (8 Nov 2026)', 'https://littlebirdelectronics.com.au/products/rtl-sdr-blog-v4-usb-dongle-with-dipole-antenna-kit-sparkfun-electronics-wrl-27543.md']], conf: 'medium',
      },
      {
        id: 'rtl-sdr-blog-v4l', ref: 'rtl-sdr-blog-v4l', short: 'RTL-SDR Blog V4L',
        aud: [55.0, 69.49], gst: true, lead: { d: [7, 56], text: 'From the RTL-SDR Blog store\'s China warehouse. Free economy post takes 1–8 weeks (usually 2–4). Express courier takes 2–8 business days plus 1–3 days to process' },
        where: [['RTL-SDR Blog store', 'https://www.rtl-sdr.com/buy-rtl-sdr-dvb-t-dongles/']],
        mount: 'usb', open: 'partial',
        note: 'The V4\'s successor (an R828S tuner, a little less filtering), in stock at its maker in China: US$37.95 the dongle, US$47.95 the kit. It needs the newest librtlsdr, and RPi ALERT hasn\'t been tested with it yet.',
        src: [['RTL-SDR Blog: V4 end of line (14 May 2026)', 'https://www.rtl-sdr.com/rtl-sdr-blog-v4-end-of-line/'], ['RTL-SDR Blog store: V4L dongle US$37.95, InStock', 'https://www.rtl-sdr.com/product/rtl-sdr-blog-v4l-lite-r828s-rtl2832u-1ppm-tcxo-sma-software-defined-radio-dongle-only/']], conf: 'medium',
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
        aud: [10, 20], gst: true, lead: { d: [1, 7], text: 'Jaycar stores or online; Little Bird\'s panel-mount extension comes from its supplier through Sydney' }, where: [['Jaycar', 'https://www.jaycar.com.au/'], ['Little Bird Electronics', 'https://littlebirdelectronics.com.au/']],
        note: 'A 0.3–0.5 m USB 2.0 extension (Jaycar\'s 0.5 m WC7708 is about A$9) and a P-clip or cable-tie saddle: the port carries no weight. Keep each stick in its own port — the agent names sticks by USB port.',
        src: [['Jaycar WC7708: 0.5 m USB 2.0 A male to A female, A$8.95 (search listing; Jaycar blocks automated reads)', 'https://jaycar.com.au/0-5m-usb-2-0-a-male-to-usb-a-female/p/WC7708'], ['Little Bird: Snap-In Panel Mount Cable – USB A extension A$10.95', 'https://littlebirdelectronics.com.au/products/snap-in-panel-mount-cable-usb-a-extension-cable']], conf: 'medium', for: ['usb'], def: true,
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
      { id: 'vhf-dipole-unity', ref: 'vhf-dipole-unity', aud: [336, 600], gst: true, lead: { d: [5, 28], text: 'Techwave ships stock in 1–2 business days plus 3–8 days\' courier. RFI\'s dipoles were on backorder there (8 Nov 2026), and RFI makes them to order' }, where: [['Techwave (RFI, Pulse, PolyPhaser dealer)', 'https://store.techwave.com.au/'], ['RFI Technology Solutions (trade prices behind a login)', 'https://www.rfi.com.au/']], src: [['Techwave: RFI SMD2 VHF side-mounted dipole 148–175 MHz, A$362.53, BackOrder', 'https://store.techwave.com.au/products/vhf-side-mounted-dipole-148-175-mhz-1-5-kg'], ['Techwave: RFI COD2B VHF dipole 140–205 MHz N-female, A$599.84, BackOrder', 'https://store.techwave.com.au/products/coaxial-dipole-140-205-mhz-specify-frequency']], conf: 'medium', note: 'RFI\'s unity-gain VHF antennas at Techwave, the one Australian dealer with public prices: the SMD2 side-mounted dipole A$362.53 and the COD2B A$599.84, made to order; the GP2 ground plane A$336 in stock.' },
      { id: 'rfi-col54', ref: 'rfi-col54', aud: [2928, 3218.03], gst: true, lead: { d: [14, 56], text: 'On backorder at Techwave, and RFI shows the COL54-174-P out of stock. Made to order: the lead time is an estimate' }, where: [['Techwave (RFI, Pulse, PolyPhaser dealer)', 'https://store.techwave.com.au/'], ['RFI Technology Solutions (trade prices behind a login)', 'https://www.rfi.com.au/COL54-174-P']], src: [['Techwave: RFI COL54-160-P, 150–160 MHz 6 dBd, 4.3-10-F, A$3,218.03 inc GST, BackOrder', 'https://store.techwave.com.au/products/vhf-meander-collinear-antenna-150-160-mhz-6-dbd-4-3-10'], ['Techwave: RFI COL54-166-P, 156–166 MHz, A$3,218.03, BackOrder', 'https://store.techwave.com.au/products/vhf-meander-collinear-antenna-156-166-mhz-6-dbd-4-3-10']], conf: 'medium', def: true, note: 'A$3,218 at Techwave, made to order — four to five times the old guess. It now comes only with a 4.3-10 connector, so add an N adapter (about A$52). Cheaper RFI VHF collinears there: the COL17 (3 dBd) A$651 in stock, the COL18 (4.5 dBd) A$1,227.' },
      { id: 'ham-collinear', ref: 'ham-collinear', aud: [150, 250], gst: true, lead: { d: [5, 21], text: 'Australian amateur-radio dealers. Strictly Ham sends antennas over 1.05 m by courier, quoted per order' }, where: [['Strictly Ham', 'https://www.strictlyham.com.au/']], src: [['Strictly Ham terms: antennas over 1.05 m and coax rolls are quoted by courier', 'https://www.strictlyham.com.au/terms-and-conditions'], ['Moonraker US: Diamond X-50 US$67.49 (search listing)', 'https://moonrakeronline.com/us/diamond-x-50-dual-band-vertical-1']], conf: 'low' },
    ],
    rf: {
      coax: { ref: 'coax-lmr400', aud: [4.95, 17.44], gst: true, unit: 'm', lead: { d: [2, 10], text: 'Radio Parts (Melbourne) and Techwave cut from stock; DigiKey cuts LMR-400 to length and delivers in about 4 days' }, where: [['Radio Parts (DOSS LL400)', 'https://radioparts.com.au/product/05054055/-'], ['Techwave (RFI, Pulse, PolyPhaser dealer)', 'https://store.techwave.com.au/'], ['DigiKey Australia (Times LMR-400)', 'https://www.digikey.com.au/product-detail/en/amphenol-times-microwave-systems/LMR-400/9644115']], src: [['Radio Parts: DOSS LL400 50 Ω low-loss coax, A$4.95/m inc GST, InStock', 'https://radioparts.com.au/product/05054055/-'], ['Techwave: CommScope CNT400, A$7.13/m, InStock', 'https://store.techwave.com.au/products/commscope-cnt-400-coaxial-cable-50-ohm-30-6000-mhz-per-meter']], conf: 'medium', note: 'LMR-400-class cable: DOSS LL400 A$4.95 a metre at Radio Parts, CommScope CNT400 A$7.13 at Techwave, Times LMR-400 about A$17 at DigiKey.' },
      nCrimp: { ref: 'n-crimp-lmr400', aud: [8.2, 16.79], gst: true, lead: { d: [1, 10], text: 'SCHNAP dispatches the same day from Sydney (it delivers only orders over A$150; collect otherwise). Techwave ships in 1–2 business days plus 3–8 days\' courier' }, where: [['SCHNAP (Bitek BC85275 for LL400)', 'https://www.schnap.com.au/n-connector-male-crimp-for-cable-nickel-15x30x15mm-bitek-bc85275.html'], ['Techwave (RFI, Pulse, PolyPhaser dealer)', 'https://store.techwave.com.au/']], src: [['SCHNAP: Bitek BC85275 N male crimp for LL400, A$8.20, InStock', 'https://www.schnap.com.au/n-connector-male-crimp-for-cable-nickel-15x30x15mm-bitek-bc85275.html'], ['Techwave: Pulse N-205 N-male solder/crimp, CNT400/LMR-400, A$13.64, InStock', 'https://store.techwave.com.au/products/pulse-n-205-n-male-connector-solder-crimp-cnt-400-b9913-and-lmr-400-cables']], conf: 'medium', note: 'N-male crimp plugs for 400-size cable: match the plug and the crimp die to the cable you buy.' },
      arrestor: { ref: 'polyphaser-is-50nx-c2', aud: [64.61, 196.6], gst: true, lead: { d: [1, 10], text: 'In stock in Australia: City Technology / Streakwave ship the IS-50NX-C2 the same day, and Techwave ships in 1–2 business days' }, where: [['City Technology (PolyPhaser IS-50NX-C2)', 'https://citytechnology.com.au/shop/is-50nx-c2-polyphaser-is-50nx-c2-125-1000mhz-dc-block-nf-to-nf-5041'], ['Streakwave', 'https://streakwave.com.au/shop/is-50nx-c2-polyphaser-is-50nx-c2-125-1000mhz-dc-block-nf-to-nf-5041'], ['Techwave (RFI, Pulse, PolyPhaser dealer)', 'https://store.techwave.com.au/'], ['PB Tech Australia (HyperLink LP-01 gas tube)', 'https://www.pbtech.com/au/product/NETEHPL1123/HyperLink-Technologies-LP-01-N-Male-to-N-Female-Bu']], note: 'Low end: a gas-tube arrestor (HyperLink LP-01, A$65); high end: the PolyPhaser IS-50NX-C2 (A$158–197, in stock). Gas tubes pass DC; the IS-50NX-C2 blocks it.', src: [['City Technology: IS-50NX-C2 A$157.52 inc GST, in stock, same-day dispatch', 'https://citytechnology.com.au/shop/is-50nx-c2-polyphaser-is-50nx-c2-125-1000mhz-dc-block-nf-to-nf-5041'], ['Streakwave: IS-50NX-C2 A$160.60 inc GST', 'https://streakwave.com.au/shop/is-50nx-c2-polyphaser-is-50nx-c2-125-1000mhz-dc-block-nf-to-nf-5041']], conf: 'high' },
      pigtail: { ref: 'sma-n-pigtail', aud: [25.22, 66.18], gst: true, lead: { d: [4, 12], text: 'Techwave ships from stock in 1–2 business days, plus 3–8 days\' courier' }, where: [['Techwave (RFI, Pulse, PolyPhaser dealer)', 'https://store.techwave.com.au/']], src: [['Techwave: Pulse RG58 SMA-male to N-male lead 0.5 m, A$25.22', 'https://store.techwave.com.au/products/pulse-rg58-cable-lead-sma-male-to-n-male-0-5m'], ['Techwave: Pulse RG58 N-female to right-angle SMA-male lead 0.5 m, A$66.18, InStock', 'https://store.techwave.com.au/products/pulse-rg58-n-female-to-right-angle-sma-male-cable-lead-0-5m']], conf: 'medium', note: 'A 0.5 m RG58 SMA-male to N-male lead (A$25) with an N-female crimp on the feedline end, or a 0.5 m N-female to right-angle SMA-male lead (A$66).' },
      split2: { ref: 'vhf-splitter-2', aud: [239.04, 239.04], gst: true, lead: { d: [4, 12], text: 'Techwave ships from stock in 1–2 business days, plus 3–8 days\' courier' }, where: [['Techwave (RFI, Pulse, PolyPhaser dealer)', 'https://store.techwave.com.au/']], src: [['Techwave: RFI SP1318-5102-11 2-way 130–180 MHz N-F, A$239.04, InStock', 'https://store.techwave.com.au/products/rfi-power-splitter-2-way-130-180-mhz-100w-nf'], ['Rojone: dividers and splitters (catalogue, no prices; quote)', 'https://www.rojone.com.au/category/h-components-passive/dividers-splitters/']], conf: 'high', note: 'RFI SP1318-5102-11, 130–180 MHz, N female: A$239 in stock at Techwave.' },
      split4: { ref: 'vhf-splitter-4', aud: [346.57, 346.57], gst: true, lead: { d: [4, 12], text: 'Techwave ships from stock in 1–2 business days, plus 3–8 days\' courier' }, where: [['Techwave (RFI, Pulse, PolyPhaser dealer)', 'https://store.techwave.com.au/']], src: [['Techwave: RFI SP1318-5104-11 4-way 130–180 MHz N-F, A$346.57, InStock', 'https://store.techwave.com.au/products/rfi-power-splitter-4-way-130-180-mhz-100w-nf']], conf: 'high', note: 'RFI SP1318-5104-11, 130–180 MHz, N female: A$347 in stock at Techwave.' },
      earth: { ref: 'earth-kit', aud: [45, 90], gst: true, lead: { d: [2, 7], text: 'electrical wholesalers. Middy\'s charges A$16.50 inc GST to deliver an order under A$750 ex GST' }, where: [['Middy\'s', 'https://www.middys.com.au/']], src: [['Middy\'s delivery terms', 'https://www.middys.com.au/delivery-terms']], conf: 'low' },
    },

    // ── power ───────────────────────────────────────────────────────────────
    power: [
      { id: 'mains-plug', name: 'Mains: the board\'s own supply', aud: [22.28, 26.37], gst: true, lead: { d: [1, 7], text: 'In stock in Sydney at Little Bird: dispatched the same day before 2 pm, then 1–3 business days by Express Post or 3–7 by Parcel Post' }, where: [['Little Bird Electronics', 'https://littlebirdelectronics.com.au/'], ['Core Electronics', 'https://core-electronics.com.au/'], ['PB Tech Australia', 'https://www.pbtech.com/au/product/SEVRBP0511/Raspberry-Pi-Official-27W-Power-Supply-White-AU-Pl']],
        note: 'The official 15 W (Pi 4) or 27 W (Pi 5, CM5 IO board) USB-C supply. RPi ALERT shows an under-voltage banner if it sags. A mini PC brings its own brick (nothing to buy).', src: [RPI_HW, ['Little Bird: Raspberry Pi 15W USB-C PSU (AU) A$24.05, 27 in Sydney', 'https://littlebirdelectronics.com.au/products/raspberry-pi-15w-usb-c-psu-au'], ['Little Bird: Raspberry Pi 27W USB-C PSU (AU) A$25.37 black / A$26.37 white, 218 / 235 in Sydney', 'https://littlebirdelectronics.com.au/products/raspberry-pi-27w-usb-c-psu-au.md']], conf: 'high', mains: true },
      { id: 'dc12', name: '12 V DC (battery or DC supply) through a DIN-rail converter', ref: 'meanwell-ddr-15g-5', aud: [48.05, 48.05], gst: true, lead: { d: [1, 10], text: 'Power Supplies Australia holds the DDR-15G-5 (VIC 100+, QLD 41, WA 11) and dispatches the same day before 1 pm. It has no DDR-30G-5 in any state; RS has 3 for next-day delivery, and DigiKey\'s factory lead time is 17 weeks' },
        where: [['Power Supplies Australia', 'https://www.power-supplies-australia.com.au/mean-well-ddr-15g-5-dc-to-dc-converter'], ['RS Components Australia', 'https://au.rs-online.com/web/p/dc-dc-converters/1757801'], ['DigiKey Australia', 'https://www.digikey.com.au/en/products/detail/mean-well-usa-inc/DDR-30G-5/8681204']],
        note: 'A Mean Well DDR-15G-5 (9–36 V in, 5 V 3 A, A$48 in stock) for a Pi 4; the DDR-30G-5 (6 A, about A$78, scarce) for a Pi 5, CM5 or Luna. Boxes with a wide DC input take 12 or 24 V directly.', src: [['Power Supplies Australia: DDR-15G-5 A$48.05 inc GST, stock VIC 100+ / QLD 41 / WA 11', 'https://www.power-supplies-australia.com.au/mean-well-ddr-15g-5-dc-to-dc-converter'], ['Power Supplies Australia: DDR-30G-5 A$78.07 inc GST, 0 in every state', 'https://www.power-supplies-australia.com.au/mean-well-ddr-30g-5-dc-to-dc-converter']], conf: 'high' },
      { id: 'dcups', name: 'Mains with battery backup (DC UPS)', ref: 'dc-ups-drc60-18ah', aud: [165, 240], gst: true, lead: { d: [3, 10], text: 'DigiKey has the DRC-60A in stock (about 4 days). The converter comes from Power Supplies Australia, and the battery from a battery shop\'s counter: Battery World delivers only orders over A$100' },
        where: [['DigiKey Australia (DRC-60A)', 'https://www.digikey.com.au/en/products/detail/mean-well-usa-inc/DRC-60A/7702895'], ['element14 Australia', 'https://au.element14.com/'], ['Power Supplies Australia', 'https://www.power-supplies-australia.com.au/'], ['Battery World', 'https://www.batteryworld.com.au/']],
        note: 'A Mean Well DRC-60A (about A$58 at DigiKey) charging an 18 Ah AGM, plus the 12 → 5 V converter for a 5 V board: hours through a power cut. RPi ALERT\'s disk queue keeps readings through anything longer. The battery\'s price is an estimate.', src: [['DigiKey AU: Mean Well DRC-60A about A$52.27 ex GST, 429 in stock (search listing)', 'https://www.digikey.com.au/en/products/detail/mean-well-usa-inc/DRC-60A/7702895'], ['element14 AU: DRC-60A 3534396 (search listing, price not shown)', 'https://au.element14.com/mean-well/drc-60a/power-supply-ac-dc-13-8v-2-8a/dp/3534396']], conf: 'low', mains: true },
    ],

    // ── backhaul ────────────────────────────────────────────────────────────
    backhaul: [
      { id: 'lan', name: 'Ethernet to the site\'s network', aud: [2.5, 12.95], gst: true, lead: { d: [1, 7], text: 'any electronics or computer shop' }, where: [['Little Bird Electronics', 'https://littlebirdelectronics.com.au/'], ['Mwave', 'https://www.mwave.com.au/products/startech-2m-cat6-sftp-patch-cable-black-ab93699'], ['Jaycar', 'https://www.jaycar.com.au/']],
        note: 'A patch lead. The agent posts out over HTTPS and never needs a port opened: Flood-Net never connects in.', src: [RPI_HOW, ['Little Bird: CAT 5 Ethernet cable A$2.50; CAT 6 3 ft A$4.90', 'https://littlebirdelectronics.com.au/products/cat-5-ethernet-cable'], ['Mwave: StarTech 2 m Cat6 SFTP patch cable A$12.95', 'https://www.mwave.com.au/products/startech-2m-cat6-sftp-patch-cable-black-ab93699']], conf: 'high', def: true },
      { id: 'rut241', name: '4G router on Ethernet (Teltonika RUT241) + IoT SIM', ref: 'teltonika-rut241', aud: [315, 349.14], gst: true, lead: { d: [1, 5], text: 'IP Trading, an authorised Teltonika partner, holds 91 and ships express for A$16.50 (1–3 days)' },
        where: [['IP Trading (authorised Teltonika partner)', 'https://www.iptrading.com.au/products/teltonika-rut241065000-compact-4g-lte-router-2x-ethernet'], ['PB Tech Australia', 'https://www.pbtech.com/au/category/networking/routers/brand-Teltonika'], ['RS Components Australia', 'https://au.rs-online.com/web/p/routers/0597667']],
        note: 'Certified, swappable, keeps the computer\'s M.2 slot free for an SDR: A$349 with 91 in stock at IP Trading, about A$315 at PB Tech. Add an IoT SIM (A$5–15 a month).', src: [['IP Trading: RUT241065000 A$349.14 inc GST, 91 in stock', 'https://www.iptrading.com.au/products/teltonika-rut241065000-compact-4g-lte-router-2x-ethernet'], ['PB Tech AU: RUT241 A$286.35 ex GST, ships tomorrow (search listing)', 'https://www.pbtech.com/au/category/networking/routers/brand-Teltonika']], conf: 'high', box: [60, 80] },
      { id: 'starlink', name: 'Starlink Mini on Ethernet', ref: 'starlink-mini', aud: [449, 599], gst: true, lead: { d: [2, 10], text: 'From Starlink online (about A$19 shipping) or from JB Hi-Fi, Officeworks or Harvey Norman stores' },
        where: [['Starlink', 'https://www.starlink.com/au'], ['JB Hi-Fi / Officeworks / Harvey Norman', 'https://www.ozbargain.com.au/product/starlink-mini']],
        note: 'Where there is no mobile coverage. A$599 full price, often on sale (A$449 is typical). Expect short overnight outages for its updates (the Brisbane base sees three nine-minute dropouts about 3 am a week) — the disk queue covers them. Plus a plan.', src: [['OzBargain: Starlink Mini deals 2024–2026 (A$288–599)', 'https://www.ozbargain.com.au/product/starlink-mini'], ['WhistleOut: Starlink Mini A$599 RRP plus A$19 shipping (search listing)', 'https://www.whistleout.com.au/Broadband/Guides/Starlink-Mini-and-Starlink-Roam']], conf: 'medium', box: [60, 40], outside: true },
      { id: 'wifi', name: 'Wi-Fi to the site\'s network', aud: [0, 0], gst: true, lead: { d: [0, 0], text: '—' }, where: [],
        note: 'The board\'s own Wi-Fi (a Verdin needs a "WB" module and u.FL antennas). Least robust in a metal box.', src: [], conf: 'high', needsWifi: true },
    ],

    // ── where it lives ──────────────────────────────────────────────────────
    enclosures: [
      { id: 'indoor-shelf', name: 'Indoors (comms room, office)', aud: [9.85, 25.1], gst: true, lead: { d: [1, 7], text: 'In stock in Little Bird\'s Sydney warehouse' }, where: [['Little Bird Electronics', 'https://littlebirdelectronics.com.au/'], ['Core Electronics', 'https://core-electronics.com.au/']],
        note: 'A case for the board (a DIN case or the maker\'s own). Bring the coax in through a wall plate or window feed-through.', src: [['Little Bird: Raspberry Pi 4 DIN Rail ABS Case A$9.85', 'https://littlebirdelectronics.com.au/products/raspberry-pi-4-din-rail-abs-case-spacious-interior-ws-21173'], ['Little Bird: Raspberry Pi Case for Pi 5 A$17.95, 133 in Sydney', 'https://littlebirdelectronics.com.au/products/raspberry-pi-5-case']], conf: 'high', indoor: true, temp: 35 },
      { id: 'rack', name: '19-inch rack shelf', ref: 'rack-shelf-19', aud: [47.95, 83.95], gst: true, lead: { d: [2, 8], text: 'Mwave: 1–2 days to dispatch, then 2–6 business days by Australia Post' }, where: [['Mwave', 'https://www.mwave.com.au/products/startech-1u-19-vented-server-rack-cabinet-cantilever-shelf-10in-deep-ac19621'], ['rackcabinets.com.au (not reachable from here)', 'https://www.rackcabinets.com.au/']],
        note: 'In an existing comms rack, beside the network gear.', src: [['Mwave: StarTech 1U 19" vented cantilever shelf 10in, A$47.95', 'https://www.mwave.com.au/products/startech-1u-19-vented-server-rack-cabinet-cantilever-shelf-10in-deep-ac19621'], ['Mwave: 4Cabling 1RU 19" cantilever shelf 265 mm, A$63.80', 'https://www.mwave.com.au/products/4cabling-1ru-19-cantilever-shelf-265mm-deep-ac95657']], conf: 'high', indoor: true, temp: 30 },
      { id: 'fibox', name: 'IP66 cabinet in a shaded hut (Fibox ARCA 400×300×150)', ref: 'fibox-arca-403015', aud: [415.03, 461.7], gst: true,
        lead: { d: [1, 7], text: 'SCHNAP holds it in Sydney and dispatches the same day (it delivers orders over A$150). NHP sells through electrical wholesalers' }, where: [['SCHNAP', 'https://www.schnap.com.au/wall-mount-electrical-enclosure-ip66-400x300x150mm-polycarbonate-nhp-arca403015.html'], ['RS Components Australia', 'https://au.rs-online.com/web/p/wall-boxes/8697898'], ['NHP (Fibox distributor; through wholesalers)', 'https://www.nhp.com.au/product/ARCA403015']],
        note: 'A$415–462 in Australia (SCHNAP in stock; RS) — about twice the UK price; the mounting plate is extra. The fittings (DIN rail, terminals, fuses, glands, vent, desiccant) are their own line. Keep it out of the sun: a sealed box in full Queensland sun runs about 65 °C inside.', src: [['SCHNAP: Fibox ARCA403015 A$461.70, InStock', 'https://www.schnap.com.au/wall-mount-electrical-enclosure-ip66-400x300x150mm-polycarbonate-nhp-arca403015.html'], ['RS AU: ARCA 403015 NO MP A$377.30 ex / A$415.03 inc GST, indicative (search listing)', 'https://au.rs-online.com/web/p/wall-boxes/8697898']], conf: 'medium', temp: 50, def: true },
    ],

    gps: { ref: 'usb-gps-puck', aud: [20.24, 22.65], gst: true, lead: { d: [1, 10], text: 'Little Bird has one TEL0137 in Sydney and 113 at the supplier. The TEL0138 comes from the supplier' }, where: [['Little Bird Electronics', 'https://littlebirdelectronics.com.au/'], ['Core Electronics', 'https://core-electronics.com.au/']],
      note: 'Optional: gives the base its exact location for Flood-Net and a clock when there is no internet.', src: [['Little Bird: DFRobot USB GPS Receiver TEL0137 A$20.24', 'https://littlebirdelectronics.com.au/products/usb-gps-receiver'], ['Little Bird: USB GPS Receiver (2m Extension Cable) TEL0138 A$22.65', 'https://littlebirdelectronics.com.au/products/usb-gps-receiver-2m-extension-cable']], conf: 'high' },

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
