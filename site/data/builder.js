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
// Decoding cost (`model`) is counted in Pi 4 cores: the work one of a
// Raspberry Pi 4's four cores can do. The figures are RPi ALERT's own, read
// from its notes on ONE Raspberry Pi 4 that was busy at the time (eight
// channels and a screen), so they may read high; what a burst or an ALERT2
// frame costs was timed on a PC and scaled (the hardware review's reports U2
// and R9, in docs/hardware-review/research/). A computer's capacity is the
// catalogue's `hw.sdrCh` ÷ 2, in Pi 4 cores (a Pi 4 is 8, so 4); its
// one-core speed is that divided by its number of cores (`cores` on the
// platform entry, or `hw.cores` in the catalogue, or read from `hw.cpu`),
// because a channel is decoded on one core and cannot use more. No computer
// but the Pi 4 has run the decoder: firmware/bench/open-alert-bench.js is how
// to settle it on a real one.

(function () {
  const RPI_HW = ['RPi ALERT hardware notes', 'https://github.com/cdomotor-g/RPi_ALERT/blob/main/docs/hardware.md'];
  const RPI_BENCH = ['RPi ALERT roadmap: the Raspberry Pi 4\'s own figures (6%, 27% and 31% of a core a channel; 1.6 times that under load)', 'https://github.com/cdomotor-g/RPi_ALERT/blob/37fee8bc/docs/roadmap.md#L112-L113'];
  const REVIEW_U2 = ['Hardware review, report U2: what the decoding costs, and where this model was wrong', 'https://github.com/cdomotor-g/open-ALERT/blob/main/docs/hardware-review/research/U2-decoder-cost-and-bench.md'];
  const REVIEW_R9 = ['Hardware review, report R9: what ALERT2 will ask of a base station', 'https://github.com/cdomotor-g/open-ALERT/blob/main/docs/hardware-review/research/R9-alert2-demands.md'];
  const REV = 'https://github.com/cdomotor-g/open-ALERT/blob/main/docs/hardware-review/research/';
  const REVIEW_R1 = ['Hardware review, report R1: the audit of the Toradex Verdin and Mallow', REV + 'R1-toradex-verdin-mallow.md'];
  const REVIEW_R2 = ['Hardware review, report R2: the audit of the Toradex Luna SL1680', REV + 'R2-toradex-luna-sl1680.md'];
  const REVIEW_R5 = ['Hardware review, report R5: open-hardware boards', REV + 'R5-open-hardware-boards.md'];
  const REVIEW_R6 = ['Hardware review, report R6: industrial Arm computers and gateways', REV + 'R6-industrial-arm-gateways.md'];
  const REVIEW_R7 = ['Hardware review, report R7: small PCs with a TPM and Secure Boot', REV + 'R7-x86-boxes.md'];
  const REVIEW_R8 = ['Hardware review, report R8: processor speeds against a Raspberry Pi 4', REV + 'R8-cpu-performance.md'];
  const OA_BENCH = ['open-ALERT firmware/bench: the benchmark that measures a real computer', 'https://github.com/cdomotor-g/open-ALERT/tree/main/firmware/bench'];
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
      'Pakronics': { ship: [10, 20], from: 'AU', note: 'Worked out at checkout from the postcode, by Australia Post: an estimate.', src: [['Pakronics BeagleY-AI page: shipping calculated at checkout by Australia Post', 'https://www.pakronics.com.au/products/beagley-ai-ss102991834']], conf: 'low' },
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
    // Every figure is in Pi 4 cores (one of a Raspberry Pi 4's four cores = 1).
    model: {
      // The windows a stick can take, how far apart its channels may be
      // (`holds`, MHz), and what ONE channel costs between bursts in each:
      //   pi4    Pi 4 cores, by RPi ALERT's own bench on the first base
      //          station's Raspberry Pi 4 (its roadmap.md: "240 kHz 6%,
      //          1.2 MHz 27%, 1.44 MHz 31% a channel") — `basis: 'bench'`.
      //          Nobody wrote down a Pi 4 figure for the other three windows:
      //          they are scaled from the nearest measured one in proportion
      //          to `rel` (960 kHz from 1.2 MHz; 1.92 and 2.4 MHz from
      //          1.44 MHz) — `basis: 'scaled'`. A second Pi 4 observation,
      //          0.12 a channel at 960 kHz with bursts, disagrees with 0.22;
      //          the higher is used (U2 §5, §7).
      //   rel    the docs' own table relative to 240 kHz (hardware.md). It
      //          matches a PC; the Pi 4's own ratios are steeper (4.5 and 5.2
      //          where it says 3.7 and 4.1).
      // `holds` keeps 50 kHz in hand for the agent's tuning rules (the DC spike
      // and a zero-IF tuner's mirror images): it reproduces the docs' own
      // examples — Flood-Net's four channels take 1.44 MHz, and 18 Bateson's
      // 151.425–151.5375 and 151.95–152.4625 take 960 kHz each.
      windows: [
        { khz: 240, holds: 0.162, rel: 1, pi4: 0.06, basis: 'bench' },
        { khz: 960, holds: 0.74, rel: 3, pi4: 0.22, basis: 'scaled' },
        { khz: 1200, holds: 0.93, rel: 3.7, pi4: 0.27, basis: 'bench' },
        { khz: 1440, holds: 1.12, rel: 4.1, pi4: 0.31, basis: 'bench' },
        { khz: 1920, holds: 1.51, rel: 5.1, pi4: 0.39, basis: 'scaled' },
        { khz: 2400, holds: 1.89, rel: 6.3, pi4: 0.48, basis: 'scaled' },
      ],
      margin: 0.05,
      maxPerStick: 8,
      // One channel in a 240 kHz window between bursts: the unit for the part
      // of a decoder's standing work that does not grow with the window
      // (`contBase`, below). The same figure as the first window's `pi4`.
      chCore240: 0.06,
      // A busy computer. On the first base station's Pi 4, with every core
      // working, each decoder took about 1.6 times its bench figure (the same
      // lines of roadmap.md). That is documented for that one Pi 4 only — a PC
      // running four decoders on four cores showed 1.13 to 1.22 (U2 §3.3) —
      // so the page shows both ends: the bench alone, and 1.6 times it. Sums
      // and verdicts use the high end.
      loadFactor: [1, 1.6],
      // ALERT2. Today every frame is tried as a legacy burst first and only
      // then decoded as ALERT2 (each decoder's `a2S`, below). `a2DecodeS` is
      // the ALERT2 decode alone: what a frame would cost once RPi ALERT skips
      // the legacy try on a channel known to carry ALERT2 — planned in its
      // roadmap, not shipped (U2 §5). Frames a minute on one channel:
      //   today  the ALERT2 link heard in Brisbane, about 20 (U2 §3.4; Harris
      //          County's 155 sites send about 31: R9 §5);
      //   storm  half of a channel's half-second slots used — a judgement,
      //          not a forecast (R9 §6.2);
      //   full   every half-second slot used: the most the slots allow, and
      //          the most one channel can ask of the software as shipped
      //          (U2 §3.4, R9 §3.4).
      a2DecodeS: 0.22,
      a2Frames: { today: 20, storm: 60, full: 120 },
      // The screen dashboard: RPi ALERT's notes call Chromium "half a Pi 4
      // core on its own". At the first base station the load fell from 4.7 to
      // 2.8 with the screen off, so this may be low.
      kioskCore: 0.5,
      safe: 0.7,            // the whole computer: plan to use no more than 70% of it
      chSafe: 0.7,          // one channel: no more than 70% of one core — it has only the one
      // Buying with headroom for ALERT2: at least four cores, each at least
      // 2.5 times a Pi 4 core (U2 §5, R9 §6.3).
      rule: { cores: 4, oneCore: 2.5 },
      coresDefault: 4,      // when neither the platform entry nor the catalogue says how many
      mbPerChannel: 43,     // measured on a PC, 1.44 MHz window (U2 §3.3); RPi ALERT's notes say about 40
      mbAgent: 52,          // the agent with no decoders (the same measurement)
      src: [RPI_HW, RPI_BENCH, REVIEW_U2, REVIEW_R9, OA_BENCH],
    },

    // RPi ALERT's decoders (Flood-Net's alert-dsp.js, #259), in Pi 4 cores:
    //   cont          the share of the window's between-bursts figure (`pi4`)
    //                 this decoder pays all the time;
    //   contBase      a standing part that does not grow with the window, in
    //                 240 kHz channels (`chCore240`);
    //   burstS        seconds of a Pi 4 core to decode one legacy burst;
    //   a2S           seconds for one ALERT2 frame: the legacy try, then the
    //                 ALERT2 decode;
    //   burstFilterS  when a channel is filtered only around bursts, the
    //                 seconds of window filtered for each burst — from 0.8 s
    //                 before it to half a second after it, about 1.7 s with
    //                 the burst.
    // Where they come from. Between bursts, the Pi 4's bench figures were
    // taken on the Full decoder (agent 0.15); the Lean default measured within
    // a tenth of it on a PC's bench (U2 §3.2), so both pay the whole figure.
    // RPi ALERT's notes say "a second or so" for a Full burst on a Pi 4 and a
    // third of that for Lean (33–34%, measured on the first base station's
    // Pi 4); timed on a PC and scaled 4 to 5 times, a burst is about 1.2 s
    // Full, 0.37 s Lean and 0.2 s Light, and an ALERT2 frame about 1.3 s,
    // 0.6 s and 0.45 s (U2 §2.3 and §5; R9 §6.1). Asleep (filtering only
    // around bursts) a channel costs 0.003 of a PC's core at 240 kHz and
    // 0.006 at 2.4 MHz where filtering always costs 0.013 and 0.083 (U2
    // §3.2): about 0.18 of a 240 kHz channel plus 0.04 of the window's cost.
    decoders: [
      { id: 'today', short: 'Full decoder', name: 'Full decoder (RPi ALERT 0.15–0.16, or Decoder: Full)', cont: 1, burstS: 1.2, a2S: 1.3, status: 'current',
        note: 'Every channel converts and copies the stick\'s whole window sample by sample, and a burst\'s decode re-filters it for each of 45 guesses: about 1.2 seconds of a Pi 4 core a burst.' },
      { id: 'filter-once', short: 'Lean (0.17)', name: 'Lean — RPi ALERT\'s default since 0.17', cont: 1, burstS: 0.37, a2S: 0.6, status: 'current',
        note: 'A burst is filtered once per carrier guess and nudged after: at the first base station to compare, 14 of 11,628 live bursts read differently from the full decoder (0.12%), in 33–34% of its time. RPi ALERT\'s notes also put the work between bursts a quarter lower since 0.17; a like-for-like run on a PC found the two within a tenth of each other and nobody has measured it on a Pi 4, so no saving is counted there.' },
      { id: 'lean', short: 'Around bursts (0.18)', name: 'Lean, filtering only around bursts — RPi ALERT 0.18, Between bursts', cont: 0.04, contBase: 0.18, burstS: 0.37, a2S: 0.6, burstFilterS: 1.7, status: 'checking',
        note: 'Between bursts each channel keeps the stick\'s last 1.4 s as bytes and looks at its channel 25 times a second; it filters only from 0.8 s before something shows to half a second after. Asleep, a channel costs four times less than filtering always at 240 kHz and 14 times less at 2.4 MHz (measured on a PC). In RPi ALERT since 0.18 behind a setting, off by default: its first live check (the first base station, November 2026) found it misses some of the weakest bursts — on one channel, readings just over the squelch that filtering always decoded — and that check has never compared ALERT2 frames. So a Pi 4 keeps filtering always, and no sizing should count on this: it is the way a small computer might fit a site, at the cost of some weak bursts. It saves much less in heavy traffic: at 20 bursts a minute a channel is awake for more than half of every minute (20 × 1.7 s).' },
      { id: 'light', short: 'Light, around bursts (0.19)', name: 'Light decoder, filtering only around bursts — RPi ALERT 0.19', cont: 0.04, contBase: 0.18, burstS: 0.2, a2S: 0.45, burstFilterS: 1.7, status: 'checking',
        note: 'As Around bursts, and each burst filtered down to 48 kHz once before its nine carrier guesses: a burst\'s decode in about half of lean\'s time (65 ms against 122 on a PC), as many true readings in 600 synthesised bursts and the same on every real one. In RPi ALERT since 0.19 as Decoder: Light, with Compare light to prove it at the first base station: not yet checked in the field.' },
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
        fit: 'Half a Pi 4 (0.5), and each core half a Pi 4 core: the builder\'s sums put Flood-Net\'s four channels at 72–109% of it on a busy day, with one channel over a whole core, so it is at its limit on today\'s default decoder. Fine for a small legacy-ALERT site or the bench. 1 GB holds the decoders and the screen dashboard; leave the screen off. Micro-USB power: a good 2.5 A supply.',
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
        id: 'onlogic-cl260', ref: 'onlogic-cl260', short: 'OnLogic CL260', kind: 'box',
        aud: [929, 929], gst: false, lead: { d: [14, 84], text: 'Not published: OnLogic sells direct from the US and the pages read show no lead time. Ask when you order. A wide guess' },
        where: [['OnLogic (direct; no Australian distributor found)', 'https://www.onlogic.com/']],
        supply: 'wide', usb: 6, m2: 'nvme', eth: 2, wifi: false, board: [170, 120], install: 'package',
        parts: 'OnLogic Cabrio CL260, N150, 8 GB, 128 GB (from US$641); ask OnLogic for the price delivered to Australia',
        fit: 'FIRST CHOICE for a 12 V or 24 V site. An N150 fanless PC: about three Pi 4s, each core about three Pi 4 cores, so it meets the ALERT2 buying rule on paper. 12–24 V DC on a terminal block runs from a site battery with no converter; a TPM 2.0; Ubuntu 24.04 offered by the maker; 0–50 °C. The price is the list price from the US in January 2026, converted at A$1 = US$0.69: check it with OnLogic.',
        src: [['CNX Software: OnLogic CL260 (TPM 2.0, 12–24 V terminal block, 0–50 °C, from US$641)', 'https://www.cnx-software.com/2026/01/21/onlogic-cl260-fanless-intel-n150-n250-industrial-mini-pc-offers-rs232-rs485-terminal-block-12-24v-dc-input/'], REVIEW_R7], conf: 'low',
      },
      {
        id: 'lenovo-thinkedge-se10n-gen2', ref: 'lenovo-thinkedge-se10n-gen2', short: 'ThinkEdge SE10n Gen2', kind: 'box',
        aud: [null, null], gst: true, lead: { d: [14, 84], text: 'By quote: no Australian price or lead time found. A wide guess' },
        where: [['Lenovo Australia, or a Lenovo partner: ask for a quote', 'https://www.lenovo.com/au/en/'], ['Lenovo specification sheet (PSREF)', 'https://psref.lenovo.com/syspool/Sys/PDF/ThinkEdge/ThinkEdge_SE10n_Gen2/ThinkEdge_SE10n_Gen2_Spec.pdf']],
        supply: 'mains', usb: 6, m2: 'nvme', eth: 2, wifi: false, board: [170, 120], install: 'package',
        parts: 'Lenovo ThinkEdge SE10n Gen2: the N150 model (0–50 °C) for a cabinet; ask for the 65 W 20 V adapter and the three-year on-site warranty',
        fit: 'FIRST CHOICE where IT wants a brand it already buys. A fanless DIN-rail PC on the N150 (or an eight-core Core 3 N355), a discrete TPM 2.0 and Secure Boot, certified by the makers of Ubuntu and Red Hat, with a three-year on-site warranty option. Power is a 20 V adapter, so a 12 V site needs a converter. Two versions: 0–40 °C and 0–50 °C (needs 0.7 metres a second of air flow). The speed shown is the N150\'s; the N355 is faster.',
        src: [['Lenovo ThinkEdge SE10n Gen2 specification sheet (PSREF, 22 October 2026)', 'https://psref.lenovo.com/syspool/Sys/PDF/ThinkEdge/ThinkEdge_SE10n_Gen2/ThinkEdge_SE10n_Gen2_Spec.pdf'], REVIEW_R7], conf: 'medium',
      },
      {
        id: 'protectli-vault-vp2430', ref: 'protectli-vault-vp2430', short: 'Protectli VP2430', kind: 'box',
        aud: [null, null], gst: true, lead: { d: [14, 84], text: 'No Australian stockist found: ask Protectli for a price and a date delivered to Australia. A wide guess' },
        where: [['Protectli (direct; no Australian stockist found)', 'https://ca.protectli.com/product/vp2430/']],
        supply: 'mains', usb: 6, m2: 'nvme', eth: 4, wifi: false, board: [144, 143], install: 'package',
        parts: 'Protectli Vault VP2430 (N150) with the optional TPM 2.0; the page lists C$649, which the site cannot convert',
        fit: 'The pick if open start-up firmware matters most: a fanless N150 box (about three Pi 4s) running coreboot, Protectli\'s open-source start-up firmware, with an optional TPM 2.0, four 2.5 Gigabit Ethernet ports, −10 to +50 °C. 12 V on a power jack only, so a battery site needs a regulated supply. A small vendor, with no Australian stockist found.',
        src: [['Protectli: Vault VP2430', 'https://ca.protectli.com/product/vp2430/'], REVIEW_R7], conf: 'medium',
      },
      {
        id: 'mini-pc-n150', ref: 'mini-pc-n150', short: 'N150 mini PC', kind: 'box',
        aud: [230, 350], gst: true, lead: { d: [2, 10], text: 'Australian online retailers; stock not checked' },
        where: [['Mwave', 'https://www.mwave.com.au/'], ['Amazon Australia', 'https://www.amazon.com.au/']],
        supply: 'mains', usb: 4, m2: 'nvme', eth: 1, wifi: true, board: [120, 115], install: 'package',
        fit: 'THE CHEAPEST WAY TO START, for the bench and an air-conditioned room only: about three Pi 4s (range 2.4–4.5; the benchmarks disagree) with each core about three Pi 4 cores, so it meets the ALERT2 buying rule on paper. Consumer brands rated 0–35 or 40 °C, with a fan, a model that changes every year, and last in a reviewer\'s ranking for an IT review. Prove the package on it, then buy a fanless box with a TPM for the site.',
        src: [REVIEW_R7, REVIEW_R8], conf: 'low',
      },
      {
        id: 'lenovo-m920q-tiny-refurb', ref: 'lenovo-m920q-tiny-refurb', short: 'Refurbished M920q Tiny', kind: 'box',
        aud: [320, 322], gst: true, lead: { d: [2, 10], text: 'Australian refurbishers (PB Tech, Reboot IT); stock not read' },
        where: [['PB Tech Australia', 'https://www.pbtech.com/product/EXWKSLEN0091060/Lenovo-Think-Center-M920Q-Intel-Core-i5-8500T-Tiny'], ['Reboot IT', 'https://reboot-it.com.au/products/lenovo-m920q-tiny-i5-8500t-2-1ghz-8gb-256gb-ssd-w11p-pc-1yr-wty']],
        supply: 'mains', usb: 6, m2: 'nvme', eth: 1, wifi: false, board: [179, 183], install: 'package',
        fit: 'CHEAP, WITH A BRAND IT KNOWS: an ex-lease Core i5-8500T "tiny", about A$320 with 8 GB and an SSD. Six cores and the fastest here by memory only (about four Pi 4 cores a core: unverified). Has a fan, office temperatures, a one-year warranty at best. Also the easiest to explain to a reviewer who already buys Lenovo.',
        src: [REVIEW_R7, REVIEW_R8], conf: 'low',
      },
      {
        id: 'compulab-fitlet3', ref: 'compulab-fitlet3', short: 'CompuLab fitlet3', kind: 'box',
        aud: [null, null], gst: true, lead: { d: [14, 84], text: 'By quote through Metromatics (Brisbane office); no lead time found. A wide guess' },
        where: [['Metromatics (Brisbane office): ask for a quote', 'https://metromatics.com.au/product/fanless-industrial-pc-fitlet3/']],
        supply: 'wide', usb: 6, m2: 'nvme', eth: 2, wifi: false, board: [133, 100], install: 'package',
        fit: 'FOR HOT CABINETS: fanless, −40 to +85 °C, 7–42 V DC on a locking plug, Intel\'s built-in TPM and an optional TPM 2.0 chip. About 1.8 Pi 4s: fast enough for today\'s four channels, but each core is about 1.8 Pi 4 cores, short of the ALERT2 rule of 2.5. Elkhart Lake is an older Intel generation than the N150.',
        src: [['Metromatics: fitlet3 (Australian seller; quote only)', 'https://metromatics.com.au/product/fanless-industrial-pc-fitlet3/'], REVIEW_R7, REVIEW_R8], conf: 'medium',
      },
      {
        id: 'fanless-industrial-x86', ref: 'fanless-industrial-x86', short: 'Fanless industrial x86', kind: 'box',
        aud: [900, 2500], gst: false, lead: { d: [10, 42], text: 'configured to order by OnLogic, Advantech or a distributor; an estimate' },
        where: [['OnLogic', 'https://www.onlogic.com/'], ['Advantech Australia', 'https://www.advantech.com/en-au']],
        supply: 'wide', usb: 4, m2: 'nvme', eth: 2, wifi: false, board: [170, 120], install: 'package',
        fit: 'A mid-range fanless industrial PC of the OnLogic Karbon or Advantech ARK class: sealed, wide DC input, industrial temperature, five years and more per model, nothing that says Raspberry Pi. About two and a half Pi 4s and a core about 2.5 Pi 4 cores: it meets the ALERT2 rule. Five to ten times the price of a Pi. A general entry: the named boxes above have better sources.',
        src: [['OnLogic Karbon', 'https://www.onlogic.com/computers/industrial/karbon/'], REVIEW_R7], conf: 'low',
      },
      {
        id: 'moxa-uc-4400a', ref: 'moxa-uc-4400a', short: 'Moxa UC-4400A', kind: 'box',
        aud: [null, null], gst: true, lead: { d: [14, 84], text: 'By quote through IP Trading or Colterlec; the secure model is made to order. No lead time found. A wide guess' },
        where: [['IP Trading: request a quote (an authorised Moxa partner)', 'https://www.iptrading.com.au/products/moxa-uc-4410a-t-arm-cortex-a53-quad-core-1-6-ghz-industrial-computer-2-ethernet-2-serial-1-can-4-di-4-do-40-to-75-c-lte-5g-wi-fi-6e'], ['Colterlec (Moxa\'s accredited Australian distributor; 1300 36 26 26)', 'https://colterlec.com.au/']],
        supply: 'wide', usb: 1, m2: false, eth: 2, wifi: false, board: [150, 105], install: 'package',
        parts: 'Moxa UC-4400A ordered with Moxa Industrial Linux 4 Secure (the IEC 62443-4-2 Security Level 2 model, Moxa\'s statement), and a powered USB hub for a second stick',
        fit: 'THE CERTIFIED INDUSTRIAL GATEWAY: a TPM, secure boot, Debian 13-based Moxa Industrial Linux 4 Secure patched to 2035 and a five-year warranty. About 0.65 of a Pi 4: a small legacy-ALERT site, not ALERT2 growth. ONE USB 2.0 port, so two sticks need a powered hub. Ask for the Secure model by name: the certified option is made to order.',
        src: [['Moxa UC-4400A series', 'https://moxa.com/Products/INDUSTRIAL-COMPUTING/Arm-Based-Computers/UC-4400A-Series'], REVIEW_R6], conf: 'medium',
      },
      {
        id: 'beagley-ai', ref: 'beagley-ai', short: 'BeagleY-AI', kind: 'board',
        aud: [149.95, 155.88], gst: true, lead: { d: [7, 14], text: 'Pakronics, in stock: "ships in 7 to 10 days" (its page, 11 November 2026)' },
        where: [['Pakronics', 'https://www.pakronics.com.au/products/beagley-ai-ss102991834'], ['Core Electronics', 'https://core-electronics.com.au/beagley-ai-open-source-development-board-4-tops.html']],
        supply: '5v', usb: 4, m2: false, eth: 1, wifi: false, board: [85, 56], install: 'package',
        fit: 'OPEN HARDWARE (OSHWA-certified) and in stock in Australia: four USB 3 ports, 4 GB, about half a Pi 4. microSD only, USB-C power, no industrial rating: a bench board and a small legacy-ALERT site, not ALERT2 growth. Runs BeagleBoard.org\'s own Debian. The hardest class to take through an IT review.',
        src: [['Pakronics: BeagleY-AI', 'https://www.pakronics.com.au/products/beagley-ai-ss102991834'], REVIEW_R5], conf: 'medium',
      },
      {
        id: 'beagleplay', ref: 'beagleplay', short: 'BeaglePlay', kind: 'board',
        aud: [219.95, 266.95], gst: true, lead: { d: [7, 21], text: 'Little Bird: none in its Sydney stock, dispatch estimated 17–23 November 2026 (its page, 11 November)' },
        where: [['Little Bird Electronics', 'https://littlebirdelectronics.com.au/products/beagleplay'], ['Core Electronics (price from a search listing; its page refuses automated reads)', 'https://core-electronics.com.au/beagleplay.html'], ['Robot Gear', 'https://www.robotgear.com.au/Product.aspx/Details/11382-BeaglePlay']],
        supply: '5v', usb: 1, m2: false, eth: 1, wifi: false, board: [85, 56], install: 'package',
        fit: 'OPEN HARDWARE with 16 GB of eMMC: the same TI AM62 chip as the Verdin, so about half a Pi 4. ONE USB host port, so more than one stick needs a powered hub. Its chip is the general-purpose kind and can never do secure boot. Runs BeagleBoard.org\'s own Debian.',
        src: [['Little Bird: BeaglePlay', 'https://littlebirdelectronics.com.au/products/beagleplay'], REVIEW_R5], conf: 'medium',
      },
      {
        id: 'toradex-verdin-imx95-mallow', ref: 'toradex-verdin-imx95-mallow', short: 'Verdin iMX95 + Mallow', kind: 'module',
        aud: [655.87, 655.87], gst: false,
        lead: { d: [7, 98], text: 'Toradex dispatches within 4 working days when it has stock, then express courier (freight and transit time are shown only after login). A distributor\'s factory lead time on a Verdin is 12–14 weeks' },
        where: [['Toradex webshop (businesses only; US$452 a set)', 'https://www.toradex.cn/en/computer-on-modules/verdin-arm-family/nxp-imx95']],
        supply: 'wide', usb: 2, m2: 'b-key', eth: 1, wifi: false, board: [100, 72], cores: 6, install: 'verdin',
        parts: 'module Hexa 4GB ET, Toradex 0227 · Mallow 01611102 · heatsink 23111101',
        fit: 'IF STAYING WITH TORADEX: the Verdin iMX95 Hexa, not the AM62. Six newer cores (about 1.1 Pi 4s, 0.75 of a Pi 4 core each: an estimate nobody has measured), USB 3 and PCIe on Mallow, supply to 2039 for the module. The datasheet is still preliminary and its power use is "TBD". Torizon OS with open-ALERT\'s container with no privileges. Still under the ALERT2 rule.',
        src: [['Toradex Verdin iMX95 (Toradex\'s China-domain site, which allowed reading)', 'https://www.toradex.cn/en/computer-on-modules/verdin-arm-family/nxp-imx95'], REVIEW_R1, REVIEW_R8], conf: 'low',
      },
      {
        id: 'toradex-verdin-am62-mallow', ref: 'toradex-verdin-am62-mallow', short: 'AM62 Quad + Mallow (not recommended)', kind: 'module',
        aud: [610.22, 727], gst: false,
        lead: { d: [7, 98], text: 'Toradex dispatches within 4 working days when it has stock, then express courier (freight and transit time are shown only after login). A distributor\'s factory lead time is 12–14 weeks (26 on one listing)' },
        where: [['Toradex webshop (businesses only; US$421 a set)', 'https://www.toradex.cn/en/computer-on-modules/verdin-arm-family/ti-am62'], ['element14 Australia (its prices are stale and its listing mistitled: check with the seller)', 'https://au.element14.com/toradex/761200/com-2ghz-32gb-arm-cortex-a72-r5f/dp/4852670'], ['Arrow Australia (Toradex\'s listed distributor; no price found)', 'https://www.arrow.com/en/manufacturers/t/toradex-ag.html'], ['Mouser Australia', 'https://au.mouser.com/c/?m=Toradex']],
        supply: 'wide', usb: 2, m2: 'b-key', eth: 1, wifi: true, board: [100, 72], install: 'verdin', parts: 'module 00761200 · Mallow 01611102 · heatsink 23111101 (the AM62\'s own: the old 23111001 does not fit it)',
        fit: 'NOT RECOMMENDED. TI silicon on a Swiss module with supply to 2033 (seven years), but four Cortex-A53 cores are about half a Pi 4 (0.5, range 0.45–0.6, from published benchmarks): four channels on a busy day take 72–109% of it and one channel 109% of a core, so it fails both ways. With an AM62, Mallow\'s two USB sockets share one USB 2.0 bus and its M.2 slot has no PCIe. US$421 a set: about A$750–800 inc GST landed through a distributor. Secure boot is still early access.',
        src: [['Toradex Verdin AM62: prices and 2033+ supply (Toradex\'s China-domain site, which allowed reading)', 'https://www.toradex.cn/en/computer-on-modules/verdin-arm-family/ti-am62'], ['Toradex Mallow carrier board datasheet', 'https://docs.toradex.com/116791-mallow_carrier_board_datasheet.pdf'], REVIEW_R1, REVIEW_R8], conf: 'medium',
      },
      {
        id: 'toradex-verdin-am62-dual-mallow', ref: 'toradex-verdin-am62-dual-mallow', short: 'AM62 Dual + Mallow (not recommended)', kind: 'module',
        aud: [465.65, 512], gst: false,
        lead: { d: [7, 98], text: 'Toradex dispatches within 4 working days when it has stock, then express courier (freight and transit time are shown only after login). A distributor\'s factory lead time is 12–14 weeks' },
        where: [['Toradex webshop (businesses only; US$321 a set)', 'https://www.toradex.cn/en/computer-on-modules/verdin-arm-family/ti-am62'], ['element14 Australia (its prices are stale: check with the seller)', 'https://au.element14.com/toradex/00741200/com-1-4ghz-1gb-arm-cortex-a53/dp/4759329']],
        supply: 'wide', usb: 2, m2: 'b-key', eth: 1, wifi: false, board: [100, 72], install: 'verdin', parts: 'module 00741201 (element14 lists the previous revision, 00741200) · Mallow 01611102 · heatsink 23111101',
        fit: 'NOT RECOMMENDED. Half the Quad\'s CPU and no Wi-Fi: the builder\'s sums put Flood-Net\'s four channels at 144–218% of it on a busy day. Overloaded, and no cheaper for the speed. For a small legacy-ALERT site a Pi 3B+ does the same for a fraction of the price.',
        src: [['Toradex Verdin AM62: prices (Toradex\'s China-domain site)', 'https://www.toradex.cn/en/computer-on-modules/verdin-arm-family/ti-am62'], REVIEW_R1, REVIEW_R8], conf: 'medium',
      },
      {
        id: 'toradex-luna-sl1680', ref: 'toradex-luna-sl1680', short: 'Luna SL1680 (comparison only)', kind: 'board',
        aud: [210.14, 210.14], gst: false,
        lead: { d: [7, 35], text: 'Toradex\'s webshop, by courier from abroad; it shows no stock or lead time and no Australian distributor lists it. An estimate' },
        where: [['Toradex webshop (US$145 for one; businesses only)', 'https://www.toradex.cn/single-board-computers/luna-sl1680']],
        supply: '5v5a', usb: 4, m2: false, eth: 1, wifi: true, board: [85, 56], install: 'luna', parts: 'Luna SBC SL1680 Quad 4GB Wi-Fi / Bluetooth ET, Toradex 0301 (03011000)',
        mainsNote: 'A 5 V supply good for 5 A — Toradex\'s figure — on a USB-C lead, or 5 V into the 40-pin header. The Luna doesn\'t negotiate USB-PD (its datasheet), so a phone or Pi 5 charger may hold it to 3 A.', mainsAud: [45, 75],
        fit: 'COMPARISON ONLY. A Pi-sized Toradex board on Synaptics\' SL1680: four Cortex-A73 cores at 2.1 GHz, about 1.2 Pi 4s (range 1.0–1.4; no benchmark of the chip exists), 4 GB, 16 GB eMMC, four USB 3 ports, about US$145. But a SAMPLE product "for evaluation / development" on the chip-maker\'s own kernel, with a five-year commitment, no secure boot from Toradex and no Australian stock. Torizon OS and open-ALERT\'s container.',
        src: [['Toradex: Luna SL1680 (Toradex\'s China-domain site, which allowed reading)', 'https://www.toradex.cn/single-board-computers/luna-sl1680'], ['Luna SL1680 datasheet (preliminary)', 'https://docs.toradex.com/118084-luna_sl1680_datasheet.pdf'], REVIEW_R2], conf: 'low',
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
      { id: 'vhf-dipole-unity', ref: 'vhf-dipole-unity', aud: [336, 600], gst: true, lead: { d: [5, 28], text: 'Techwave ships stock in 1–2 business days plus 3–8 days\' courier. RFI\'s dipoles were on backorder there (8 Nov 2026), and RFI makes them to order' }, where: [['Techwave (RFI, Pulse, PolyPhaser dealer)', 'https://store.techwave.com.au/'], ['RFI Technology Solutions (trade prices behind a login)', 'https://www.rfi.com.au/']], src: [['Techwave: RFI SMD2 VHF side-mounted dipole 148–175 MHz, A$362.53, BackOrder', 'https://store.techwave.com.au/products/vhf-side-mounted-dipole-148-175-mhz-1-5-kg'], ['Techwave: RFI COD2B VHF dipole 140–205 MHz N-female, A$599.84, BackOrder', 'https://store.techwave.com.au/products/coaxial-dipole-140-205-mhz-specify-frequency']], conf: 'medium', note: 'RFI\'s unity-gain VHF antennas at Techwave, the one Australian dealer with public prices: the SMD2 side-mounted dipole A$362.53 and the COD2B A$599.84, made to order; the GP2 ground plane A$336 in stock.', def: true },
      { id: 'rfi-col54', ref: 'rfi-col54', aud: [2928, 3218.03], gst: true, lead: { d: [14, 56], text: 'On backorder at Techwave, and RFI shows the COL54-174-P out of stock. Made to order: the lead time is an estimate' }, where: [['Techwave (RFI, Pulse, PolyPhaser dealer)', 'https://store.techwave.com.au/'], ['RFI Technology Solutions (trade prices behind a login)', 'https://www.rfi.com.au/COL54-174-P']], src: [['Techwave: RFI COL54-160-P, 150–160 MHz 6 dBd, 4.3-10-F, A$3,218.03 inc GST, BackOrder', 'https://store.techwave.com.au/products/vhf-meander-collinear-antenna-150-160-mhz-6-dbd-4-3-10'], ['Techwave: RFI COL54-166-P, 156–166 MHz, A$3,218.03, BackOrder', 'https://store.techwave.com.au/products/vhf-meander-collinear-antenna-156-166-mhz-6-dbd-4-3-10']], conf: 'medium', note: 'A$3,218 at Techwave, made to order — four to five times the old guess. It now comes only with a 4.3-10 connector, so add an N adapter (about A$52). Cheaper RFI VHF collinears there: the COL17 (3 dBd) A$651 in stock, the COL18 (4.5 dBd) A$1,227.' },
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
        note: 'No hardware cost. Done: since 0.17 RPi ALERT decodes a burst in a third of the time. Built, but off by default: filtering each channel only around bursts, 4 to 14 times less work while nothing is on the air — its first live check missed some of the weakest bursts. Not built yet: reading a frame as ALERT2 straight away on a channel known to carry it, which takes a channel with every slot used from about 1.2 Pi 4 cores to about 0.4.', src: [], conf: 'low' },
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
