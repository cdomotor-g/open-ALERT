// open-ALERT — the Mallow trial: a Toradex Verdin AM62 on a Mallow carrier,
// running RPi ALERT beside a Raspberry Pi 4 that already does the job, on the
// same antenna. The page's shopping list, CPU estimate and results sheet.
//
// TRIAL.items is the shopping list: prices in Australian dollars (gst: false =
// ex GST), lead times in days, a source for every figure or conf 'low'.

(function () {
  'use strict';
  const isNode = typeof module === 'object' && module.exports;
  const USD = 0.69;                                   // the configurator's planning rate
  const aud = usd => Math.round(usd / USD * 100) / 100;
  const TDX = ['Toradex webshop', 'https://www.toradex.com/computer-on-modules/verdin-arm-family/ti-am62'];
  const E14 = ['element14 Australia', 'https://au.element14.com/'];
  const JAYCAR = ['Jaycar', 'https://www.jaycar.com.au/'];
  const CORE = ['Core Electronics', 'https://core-electronics.com.au/'];
  const ROJONE = ['Rojone', 'https://www.rojone.com.au/'];

  const TRIAL = {
    asof: '2026-11',
    items: [
      { id: 'verdin', need: 'must', name: 'Verdin AM62 Quad 2GB WB IT — Toradex 00761200 (element14 4852670)', qty: 1,
        aud: [514.73, 514.73], gst: false, lead: { d: [5, 91], text: 'element14 listed 5 in UK stock on 2 November (3–5 business days); 13 weeks from the factory when that\'s gone. element14 blocks automated reads, so this was not re-checked in the November review: confirm before ordering' },
        where: [E14, TDX], why: 'The computer under test, with the headroom for a busy site: Flood-Net\'s four channels at about a third of its CPU on RPi ALERT 0.17 (see Which module, above). element14\'s listing is titled "Aquila AM69" but describes this module — confirm with element14 before ordering. Toradex sells the same part direct, to businesses only, for US$107.40 (about A$171 inc GST plus courier): a third of element14\'s price, if the Bureau can order it.',
        src: [['element14 Australia: 00761200', 'https://au.element14.com/toradex/761200/com-2ghz-32gb-arm-cortex-a72-r5f/dp/4852670'], ['Toradex: Verdin AM62 prices', 'https://www.toradex.com/computer-on-modules/verdin-arm-family/ti-am62'], ['Toradex: how to order', 'https://toradex.com/order-now/how-to-order']], conf: 'high' },
      { id: 'mallow', need: 'must', name: 'Mallow carrier board — Toradex 01611102 (element14 4759350)', qty: 1,
        aud: [165.74, 165.74], gst: false, lead: { d: [5, 91], text: '13 in element14\'s UK stock, 3–5 business days; 13 weeks from the factory' },
        where: [E14, TDX], why: 'Ethernet, two USB 3 ports for the sticks, 7–24 V in, an M.2 B-key slot with USB for a future SDR card. Its design files are published. Toradex direct is about the same (US$107.50).',
        src: [['element14 Australia: Mallow', 'https://au.element14.com/toradex/01611102/carrier-board-mallow/dp/4759350'], ['Mallow datasheet', 'https://docs.toradex.com/116791-mallow_carrier_board_datasheet.pdf']], conf: 'high' },
      { id: 'heatsink', need: 'must', name: 'Verdin Industrial Heatsink Type 1 — Toradex 23111001', qty: 1,
        aud: [aud(15.60), 40], gst: false, lead: { d: [7, 21], text: 'not stocked by element14 Australia: from Toradex with the module, or Mouser / DigiKey' },
        where: [TDX, ['Mouser Australia', 'https://au.mouser.com/'], ['DigiKey Australia', 'https://www.digikey.com.au/']], why: 'Decoding keeps every core busy: without a heatsink the module throttles and the trial measures heat, not the processor. element14 Australia stocks only Toradex\'s Apalis heatsinks, which don\'t fit. The low price is Toradex\'s US$15.60; the high, a distributor\'s with shipping (an estimate).',
        src: [['Toradex: Verdin Industrial Heatsink', 'https://www.toradex.com/accessories/verdin-industrial-heatsink-type-1'], ['DigiKey: 23111001', 'https://www.digikey.nl/en/products/detail/toradex-ag/23111001/28022861']], conf: 'medium' },
      { id: 'psu', need: 'must', name: '12 V 2 A supply with a screw-terminal lead (and Mallow\'s Phoenix power plug if it isn\'t in the box)', qty: 1,
        aud: [33.95, 45], gst: true, lead: { d: [1, 7], text: 'Jaycar stores or online, and Little Bird. The Phoenix 1805410 plug comes from RS or Mouser' },
        where: [['Jaycar', 'https://www.jaycar.com.au/'], ['Little Bird Electronics', 'https://littlebirdelectronics.com.au/'], ['RS Components Australia', 'https://au.rs-online.com/']], why: 'Mallow takes 7–24 V on a Phoenix Contact header (its mate is the 1805410). Jaycar\'s 12 V 2.5 A supply (MP3490, about A$30) with a A$4 screw-terminal adapter, or the site\'s own 12 V.',
        src: [['Mallow datasheet (power input)', 'https://docs.toradex.com/116791-mallow_carrier_board_datasheet.pdf'], ['Jaycar MP3490 12V DC 2.5A power supply A$29.95 (search listing)', 'https://jaycar-prod.australia-southeast1.gcp.storefrontcloud.io/p/MP3490'], ['Little Bird: Female DC power adapter, 2.1 mm jack to screw terminal, A$4.00, 4 in Sydney', 'https://littlebirdelectronics.com.au/products/female-dc-power-adapter-2-1mm-jack-to-screw-terminal-block']], conf: 'low' },
      { id: 'stick', need: 'must', name: 'An RTL-SDR stick of the same model as the Pi\'s (two V3s if the Pi\'s is a V4)', qty: 1,
        aud: [50.65, 161.19], gst: true, lead: { d: [7, 56], text: 'a V3 from its maker: free post from China in 2–4 weeks (up to 8); a V4 only from leftover stock, if any' },
        where: [['RTL-SDR Blog store', 'https://www.rtl-sdr.com/buy-rtl-sdr-dvb-t-dongles/'], ['Little Bird Electronics', 'https://littlebirdelectronics.com.au/'], ['Core Electronics', 'https://core-electronics.com.au/']], why: 'The same model as the Pi\'s stick, so the computers are compared and not the sticks. The V4 is end of life (May 2026) and out of stock: if the Pi has a V4 and you can\'t find another, buy two V3s (about A$51 each) and give the Pi one too. Sticks still differ one from another — the plan swaps them halfway.',
        src: [['RTL-SDR Blog store: V3 dongle only', 'https://www.rtl-sdr.com/product/rtl-sdr-blog-v3-r820t2-rtl2832u-1ppm-tcxo-sma-software-defined-radio-dongle-only/'], ['RTL-SDR Blog V4 (out of stock)', 'https://www.rtl-sdr.com/product/rtl-sdr-blog-v4-r828d-rtl2832u-1ppm-tcxo-sma-software-defined-radio-dongle-only/'], ['RPi ALERT hardware notes', 'https://github.com/cdomotor-g/RPi_ALERT/blob/main/docs/hardware.md']], conf: 'medium' },
      { id: 'splitter', need: 'must', name: 'VHF 2-way power divider (N-type)', qty: 1,
        aud: [239.04, 239.04], gst: true, lead: { d: [4, 12], text: 'Techwave ships from stock in 1–2 business days, plus 3–8 days\' courier' },
        where: [['Techwave (RFI, Pulse, PolyPhaser dealer)', 'https://store.techwave.com.au/']], why: 'One antenna feeding both boxes, so both hear exactly the same bursts: RFI\'s SP1318-5102-11, A$239 in stock at Techwave. Costs each side about 3.5 dB — record the Pi\'s figures before you fit it.',
        src: [['Techwave: RFI SP1318-5102-11 2-way 130–180 MHz N-F, A$239.04, InStock', 'https://store.techwave.com.au/products/rfi-power-splitter-2-way-130-180-mhz-100w-nf']], conf: 'high' },
      { id: 'leads', need: 'must', name: 'RF leads: an SMA-to-N pigtail for the new stick, and a short N–N jumper to the splitter', qty: 1,
        aud: [62.57, 103.53], gst: true, lead: { d: [4, 12], text: 'Techwave ships from stock in 1–2 business days, plus 3–8 days\' courier' },
        where: [['Techwave (RFI, Pulse, PolyPhaser dealer)', 'https://store.techwave.com.au/']], why: 'A 0.5 m SMA-male to N-male lead for the new stick (A$25) and a 1 m N–N jumper for the Pi\'s pigtail (A$37); A$104 with a right-angle lead. The feedline\'s N plug goes into the splitter\'s input.',
        src: [['Techwave: Pulse RG58 SMA-male to N-male 0.5 m, A$25.22', 'https://store.techwave.com.au/products/pulse-rg58-cable-lead-sma-male-to-n-male-0-5m'], ['Techwave: Pulse RG58 N-male to N-male 1 m, A$37.35, InStock', 'https://store.techwave.com.au/products/pulse-rg58-n-male-to-n-male-cable-lead-1m'], ['Techwave: Pulse RG58 N-female to right-angle SMA-male 0.5 m, A$66.18, InStock', 'https://store.techwave.com.au/products/pulse-rg58-n-female-to-right-angle-sma-male-cable-lead-0-5m']], conf: 'medium' },
      { id: 'eth', need: 'must', name: 'Ethernet patch lead and a spare switch or router port', qty: 1,
        aud: [2.5, 12.95], gst: true, lead: { d: [1, 7], text: 'any electronics or computer shop' }, where: [['Little Bird Electronics', 'https://littlebirdelectronics.com.au/'], ['Mwave', 'https://www.mwave.com.au/'], ['Jaycar', 'https://www.jaycar.com.au/']], why: 'Use Ethernet, as the Pi does, so the network isn\'t a difference.', src: [['Little Bird: CAT 5 Ethernet cable A$2.50', 'https://littlebirdelectronics.com.au/products/cat-5-ethernet-cable'], ['Mwave: StarTech 2 m Cat6 A$12.95', 'https://www.mwave.com.au/products/startech-2m-cat6-sftp-patch-cable-black-ab93699']], conf: 'high' },
      { id: 'usbc', need: 'maybe', name: 'USB-C data cable', qty: 1,
        aud: [1.95, 12.25], gst: true, lead: { d: [1, 7], text: 'In stock in Little Bird\'s Sydney warehouse' }, where: [['Little Bird Electronics', 'https://littlebirdelectronics.com.au/'], ['Jaycar', 'https://www.jaycar.com.au/']],
        why: 'Only if the module has lost its Toradex Easy Installer and must be loaded again in recovery mode from a computer. Check a cheap cable carries data, not just power.', src: [['Little Bird: USB-A to USB-C cable 1 m A$1.95', 'https://littlebirdelectronics.com.au/products/usb-a-to-usb-c-cable-1m'], ['Little Bird: Reversible USB A to C cable 0.3 m A$12.25', 'https://littlebirdelectronics.com.au/products/reversible-usb-a-to-c-cable-0-3m']], conf: 'medium' },
      { id: 'console', need: 'maybe', name: '3.3 V USB-serial console cable (FTDI TTL-232R-3V3 class)', qty: 1,
        aud: [8.1, 40.1], gst: true, lead: { d: [1, 7], text: 'In stock in Little Bird\'s Sydney warehouse: 104 modules, but only 1 cable' }, where: [['Little Bird Electronics', 'https://littlebirdelectronics.com.au/'], ['element14 Australia', 'https://au.element14.com/'], ['Core Electronics', 'https://core-electronics.com.au/']],
        why: 'Plugs into Mallow\'s 6-pin console header — the way in when it won\'t boot or the network won\'t come up: an A$8 FT232RL adapter with jumper leads, or Adafruit\'s A$40 TTL-232 cable. Check the pin-out against the datasheet first.',
        src: [['Mallow datasheet', 'https://docs.toradex.com/116791-mallow_carrier_board_datasheet.pdf'], ['Little Bird: FT232RL USB to TTL adapter module 5V/3.3V A$8.10, 104 in Sydney', 'https://littlebirdelectronics.com.au/products/ftdi-ft232rl-usb-to-ttl-serial-converter-adapter-module-5v-and-3-3v'], ['Little Bird: Adafruit FTDI Serial TTL-232 USB Cable (AF-70) A$40.10', 'https://littlebirdelectronics.com.au/products/ftdi-serial-ttl-232-usb-cable']], conf: 'medium' },
      { id: 'meters', need: 'nice', name: 'Power meters: an in-line 12 V DC meter for the Mallow, a USB-C meter for the Pi', qty: 1,
        aud: [54.5, 64.25], gst: true, lead: { d: [1, 7], text: 'Jaycar stores or online, and Little Bird\'s Sydney stock' }, where: [['Jaycar', 'https://www.jaycar.com.au/'], ['Little Bird Electronics', 'https://littlebirdelectronics.com.au/']],
        why: 'Watts matter on a solar site: the AM62 should draw well under the Pi 4\'s 4–7 W. Jaycar\'s 20 A DC meter (QP2320, about A$35) for the Mallow, a USB-C meter (about A$20–30) for the Pi.', src: [['Jaycar QP2320 20A 6.5–100V DC power meter, A$34.95 (search listing)', 'https://jaycar-prod.australia-southeast1.gcp.storefrontcloud.io/p/QP2320'], ['Little Bird: Type-C USB Power Meter Tester A$19.55, 9 in Sydney', 'https://littlebirdelectronics.com.au/products/type-c-usb-power-meter-tester'], ['Little Bird: Mini OLED USB C Power Analyzer A$29.30', 'https://littlebirdelectronics.com.au/products/mini-oled-usb-c-power-analyzer-ada6271']], conf: 'medium' },
    ],
    // Every Verdin AM62 Toradex lists (its datasheet and price list,
    // 2026-11): what each could carry, and what element14 Australia charges
    // for it (ex GST, 2026-11-02; `usd` is Toradex's own sample price). `a53` is cores × GHz ÷ 1.4 — the CPU in
    // A53-at-1.4-GHz cores; a Pi 4 core is about two of those (the Pi 3B+, the
    // same four A53s at 1.4 GHz, is "half a Pi 4" in RPi ALERT's notes).
    variants: [
      { pid: '00761200', e14: { code: '4852670', ex: 514.73, note: '5 in element14\'s UK stock, 3–5 business days; 13 weeks from the factory. Its element14 listing is titled \'Aquila AM69\' but describes the Verdin AM62 Quad — confirm before ordering' }, name: 'Quad 2GB WB IT', cores: 4, ghz: 1.4, ram: '2 GB', emmc: '16 GB', wifi: true, temp: '−40 to +85 °C', usd: 107.40, pick: 'buy',
        why: 'Headroom for a site that hears a whole region: four channels in heavy traffic at about half its CPU on 0.17. The one to trial.' },
      { pid: '00741201', e14: { code: '4759329', ex: 346.54, note: 'Listed as 00741200, the previous revision (V1.2A); 3 in UK stock plus 3 coming, 3–5 business days; 13 weeks from the factory' }, name: 'Dual 1GB IT', cores: 2, ghz: 1.4, ram: '1 GB', emmc: '8 GB', wifi: false, temp: '−40 to +85 °C', usd: 81.85, pick: 'now',
        why: 'Carries four channels on a busy day on 0.17, at about two thirds of its CPU; not a heavy site. The cheaper production choice, US$25.55 less direct (A$185 less at element14).' },
      { pid: '00751201', e14: { code: '4759330', ex: 368.41, note: 'Listed as 00751200, the previous revision (V1.2A); stock not shown' }, name: 'Dual 1GB WB IT', cores: 2, ghz: 1.4, ram: '1 GB', emmc: '8 GB', wifi: true, temp: '−40 to +85 °C', usd: 94.10, pick: 'now',
        why: 'As 00741201 with Wi-Fi — only if a site has no Ethernet.' },
      { pid: '00731200', e14: { code: '4759328', ex: 272.61, note: 'Out of stock: deliveries from 12/01/2027; 13 weeks from the factory' }, name: 'Dual 1GB ET', cores: 2, ghz: 1.4, ram: '1 GB', emmc: '4 GB', wifi: false, temp: '−20 to +85 °C', usd: 67.20, pick: 'maybe',
        why: 'Cheapest two-core; −20 °C is fine for Queensland. 4 GB of eMMC is tight for Torizon, the container and a 1 GB reading queue: shrink the queue.' },
      { pid: '00721201', e14: { code: null, ex: null, note: 'Not listed by element14 Australia' }, name: 'Solo 512MB WB IT', cores: 1, ghz: 1.0, ram: '512 MB', emmc: '4 GB', wifi: true, temp: '−40 to +85 °C', usd: 75.00, pick: 'small',
        why: 'One core at 1.0 GHz and 512 MB: on RPi ALERT 0.19\'s Light decoder filtering only around bursts, one stick of one or two channels (about a fifth of it on a busy day, half on a heavy one). Not four channels, and not with the screen dashboard.' },
      { pid: '00711200', e14: { code: '4759327', ex: 216.76, note: 'Stock not shown' }, name: 'Solo 512MB', cores: 1, ghz: 1.0, ram: '512 MB', emmc: '4 GB', wifi: false, temp: '0 to +70 °C', usd: 54.95, pick: 'out',
        why: 'As the Solo above, but only 0–70 °C: too narrow for a box in the sun.' },
    ],
    // The rest of the table, for comparison: Toradex's Luna SL1680 board and
    // the Raspberry Pi range. Each names its catalogue record (`ref`), which
    // holds its CPU, memory, rating, price and sources; `hw.sdrCh` ÷ 2 is its
    // CPU in Pi 4 cores, as in the builder.
    others: [
      { group: 'luna', ref: 'toradex-luna-sl1680', short: 'Luna SL1680', detail: '03011000 · Quad 4GB WB ET', store: '16 GB eMMC', pick: 'paper', est: true,
        buy: 'Toradex direct, US$145 plus courier; no Australian stock found',
        why: 'Yes on paper: a little more than a Pi 4 (about 1.1 times, scaled by clock — no benchmarks published yet), 4 GB, eMMC, a battery clock, four USB 3 ports for sticks, −25 to +85 °C. But it is new (early 2026, datasheet preliminary), comes with Torizon OS — RPi ALERT would run in a Debian container, the route this trial proves on the Verdin — and takes 5 V at up to 5 A, like a Pi. Toradex hasn\'t said how long it will make it.' },
      { group: 'pi', ref: 'rpi-zero-2w', short: 'Pi Zero 2 W', detail: 'Raspberry Pi Zero 2 W', store: 'microSD', pick: 'maybe',
        why: 'A quarter of a Pi 4: four channels on a busy day come near the 70% line on 0.17, and are comfortable on 0.19 around bursts. One micro-USB port (a hub for a second stick) and 512 MB: no screen dashboard.' },
      { group: 'pi', ref: 'rpi-3b-plus', short: 'Pi 3B+', detail: 'Raspberry Pi 3 Model B+', store: 'microSD', pick: 'now',
        why: 'The Verdin Quad\'s very cores, so the same half a Pi 4: four channels on a busy day at about a third of it on 0.17. 1 GB, micro-USB power, 0–50 °C.' },
      { group: 'pi', ref: 'rpi-4-4gb', short: 'Pi 4', detail: 'Raspberry Pi 4 Model B, 4 GB', store: 'microSD', pick: 'ref',
        why: 'What RPi ALERT is tested on, and the Pi this trial compares against. Rated 0–50 °C, an SD card, no battery clock.' },
      { group: 'pi', ref: 'rpi-5-4gb', short: 'Pi 5', detail: 'Raspberry Pi 5, 4 GB', store: 'microSD', pick: 'now',
        why: 'Twice a Pi 4, and a battery clock (add the cell). Needs the 27 W supply; 0–70 °C; an SD card unless you add an NVMe HAT.' },
      { group: 'pi', ref: 'rpi-cm4-io', short: 'CM4 + IO board', detail: 'Compute Module 4 on its IO Board', store: 'eMMC', pick: 'now',
        why: 'A Pi 4 at 1.5 GHz as a module: eMMC, −20 to +85 °C and 12 V in on the IO board. The heart of most industrial Pis.' },
      { group: 'pi', ref: 'rpi-cm5-io', short: 'CM5 + IO board', detail: 'Compute Module 5, 4 GB, 32 GB eMMC, on its IO Board', store: '32 GB eMMC', pick: 'now',
        why: 'A Pi 5 as a module: eMMC, −20 to +85 °C, a battery clock. Often out of stock in Australia; 5 V 5 A in.' },
    ],

    // What to compare, where to read it, and how it passes.
    measures: [
      { id: 'decoded', name: 'Bursts decoded (a week)', where: 'Each box\'s Overview (each channel\'s count), or Flood-Net\'s Reception Map filtered to the receiver', rule: 'ratio', min: 0.98, unit: '' },
      { id: 'undecoded', name: 'Bursts heard but not decoded (a week)', where: 'Each box\'s Overview', rule: 'info', unit: '' },
      { id: 'snr', name: 'Median SNR on a station both hear (dB)', where: 'Each box\'s Receivers page, or the Reception Map', rule: 'close', tol: 2, unit: 'dB' },
      { id: 'busy', name: 'Decoder busy, worst hour (%)', where: 'Each box\'s Overview: Decoder busy', rule: 'max', max: 70, unit: '%' },
      { id: 'dropped', name: 'Times a channel dropped samples', where: 'Each box\'s Overview and log', rule: 'max', max: 0, unit: '' },
      { id: 'temp', name: 'Hottest the processor got (°C)', where: 'The top of each box\'s Overview', rule: 'max', max: 70, unit: '°C' },
      { id: 'watts', name: 'Power draw, typical (W)', where: 'The power meters', rule: 'info', unit: 'W' },
      { id: 'gaps', name: 'Check-in gaps or restarts', where: 'Flood-Net\'s Base Stations tab: the connection log', rule: 'max', max: 0, unit: '' },
    ],
  };

  // Delivery for the list: each item is bought from the first shop it names,
  // and each shop delivers once (the builder's B.shops, [small, large] A$ inc
  // GST, free over its threshold); an overseas order over A$1,000 pays a
  // clearance charge at the border. → { lines: [{ name, lo, hi, parts, sh }], lo, hi, unknown }
  function delivery(items) {
    const BD = isNode ? require('../data/builder.js') : globalThis.OA_BUILDER;
    const shops = (BD && BD.shops) || {}, IM = BD && BD.import;
    const find = n => Object.keys(shops).find(k => n === k || n.startsWith(k + ' ') || n.startsWith(k + ':'));
    const inc = (v, gst) => gst === false ? v * 1.1 : v;
    const by = new Map();
    for (const it of items) {
      if (!it.where.length) continue;
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

  // A measure's verdict from the four numbers (Pi and AM62, week 1 and week 2,
  // the sticks swapped between weeks). → { cls, text } or null.
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
    if (m.rule === 'info' && has(pi)) {
      const r = sum(am) / (sum(pi) || 1);
      return { cls: 'info', text: `${Math.round(r * 100)}% of the Pi's` };
    }
    return null;
  }

  const API = { TRIAL, verdict, aud, delivery };
  if (isNode) { module.exports = API; return; }

  // ══ the page ══════════════════════════════════════════════════════════════
  const $ = (s, el) => (el || document).querySelector(s);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const inc = (v, gst) => gst === false ? v * 1.1 : v;
  const money = v => 'A$' + Math.round(v).toLocaleString('en-AU');
  const range = (lo, hi) => Math.round(lo) === Math.round(hi) ? money(lo) : `${money(lo)}–${Math.round(hi).toLocaleString('en-AU')}`;
  const wk = n => { const w = Math.round(n / 7); return w === 1 ? '1 week' : `${w} weeks`; };
  const days = d => d[1] <= 7 ? `${d[0]}–${d[1]} days` : d[0] >= 14 ? `${Math.round(d[0] / 7)}–${wk(d[1])}` : `${d[0]} days–${wk(d[1])}`;
  const KEY = 'open-alert:trial';
  let T = { got: {}, res: {}, channels: '151.5, 151.525, 151.95, 152.4', traffic: 'busy' };
  try { T = Object.assign(T, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) { /* private mode */ }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(T)); } catch (e) { /* private mode */ } };

  function shopping() {
    const groups = [['must', 'You need'], ['maybe', 'Only if something goes wrong'], ['nice', 'Nice to have']];
    let lo = 0, hi = 0, loAll = 0, hiAll = 0, longest = null;
    for (const it of TRIAL.items) {
      const a = inc(it.aud[0], it.gst) * it.qty, b = inc(it.aud[1], it.gst) * it.qty;
      loAll += a; hiAll += b;
      if (it.need === 'must') { lo += a; hi += b; if (!longest || it.lead.d[1] > longest.lead.d[1]) longest = it; }
    }
    const D = delivery(TRIAL.items.filter(i => i.need === 'must'));
    lo += D.lo; hi += D.hi; loAll += D.lo; hiAll += D.hi;
    const cl = $('#cost-line');
    if (cl) cl.innerHTML = `About <b>${range(lo, hi)}</b> inc GST, delivered, for what you need, ${range(loAll, hiAll)} with the extras. The longest wait is the Toradex parts. The list below has each part, where to get it and how long it takes.`;
    $('#shop').innerHTML = groups.map(([g, h]) => `<h3>${h}</h3><ul class="shop">${TRIAL.items.filter(i => i.need === g).map(it => `
      <li class="${T.got[it.id] ? 'got' : ''}"><label class="shop-chk"><input type="checkbox" data-got="${it.id}"${T.got[it.id] ? ' checked' : ''}> <span class="sr-only">Got it</span></label>
        <div class="shop-main"><b>${esc(it.name)}</b>${it.conf === 'low' ? ' <span class="chip st-warn" title="Price and lead time are estimates">est.</span>' : ''}
          <div class="small dim">${esc(it.why)}</div>
          <div class="shop-meta small"><span><b>${range(inc(it.aud[0], it.gst), inc(it.aud[1], it.gst))}</b> inc GST</span><span title="${esc(it.lead.text)}">⏱ ${esc(days(it.lead.d))}</span><span>${it.where.map(([n, u]) => `<a href="${esc(u)}" target="_blank" rel="noopener">${esc(n)}</a>`).join(' · ')}</span></div>
        </div></li>`).join('')}</ul>`).join('') +
      (D.lines.length ? `<h3>Delivery</h3><ul class="shop">${D.lines.map(l => `<li><span class="shop-chk" aria-hidden="true"></span><div class="shop-main"><b>Delivery from ${esc(l.name)}</b>${l.sh.conf === 'low' ? ' <span class="chip st-warn" title="An estimate">est.</span>' : ''}
          <div class="small dim">${esc(l.sh.note || '')} For: ${esc(l.parts.join(', '))}.${l.over ? ` Over A$${TRIAL_IMPORT().threshold.toLocaleString('en-AU')} from overseas: GST at the border and ${esc(TRIAL_IMPORT().what)}.` : ''}</div>
          <div class="shop-meta small"><span><b>${l.hi === 0 ? 'free' : range(l.lo, l.hi)}</b> inc GST</span>${l.sh.src && l.sh.src.length ? `<span><a href="${esc(l.sh.src[0][1])}" target="_blank" rel="noopener">${esc(l.sh.src[0][0])}</a></span>` : ''}</div></div></li>`).join('')}</ul>` : '') +
      (D.unknown.length ? `<p class="small dim">Delivery not counted from ${esc(D.unknown.join(', '))}.</p>` : '') +
      `<p class="note"><b>Total for what you need, delivered:</b> ${range(lo, hi)} inc GST (${range(loAll, hiAll)} with everything). Prices are element14 Australia's where it stocks the part (2 November 2026). <b>The module is most of it:</b> Toradex sells the same 00761200 direct, to businesses only, for about A$171 inc GST — a third of element14's — so if the Bureau can order from Toradex, the whole list comes to about ${range(lo - 514.73 * 1.1 + 171, hi - 514.73 * 1.1 + 171)}.</p>`;
  }

  const TRIAL_IMPORT = () => (globalThis.OA_BUILDER && globalThis.OA_BUILDER.import) || { threshold: 1000, what: 'clearance charges' };

  function estimate() {
    const K = globalThis.OA_BUILD_API;
    if (!K) return;
    const freqs = String(T.channels).split(/[ ,;]+/).map(Number).filter(f => f >= 136 && f <= 174);
    const plan = K.planSticks(freqs, 'auto');
    const rows = ['rpi-4-4gb', 'toradex-verdin-am62-mallow'].map(id => {
      const p = K.B.platforms.find(x => x.id === id);
      const cells = K.B.decoders.map(d => {
        const u = K.load(plan, { traffic: T.traffic, decoder: d.id }).total / K.capacity(p);
        const v = K.verdict(u);
        return `<td class="num"><span class="${v.cls}">${Math.round(u * 100)}%</span></td>`;
      }).join('');
      return `<tr><th scope="row">${esc(p.short)}</th>${cells}</tr>`;
    }).join('');
    const sticks = (plan.sticks || []).map((s, i) => `stick ${i + 1}: ${s.chans.join(', ')} MHz in ${s.window.khz >= 1000 ? s.window.khz / 1000 + ' MHz' : s.window.khz + ' kHz'}`).join('; ');
    $('#est').innerHTML = `<div class="row">
        <label>Channels (MHz, as on the Pi) <input id="t-ch" value="${esc(T.channels)}" inputmode="decimal"></label>
        <label>Traffic <select id="t-tr"><option value="quiet"${T.traffic === 'quiet' ? ' selected' : ''}>Quiet</option><option value="busy"${T.traffic === 'busy' ? ' selected' : ''}>Busy</option><option value="heavy"${T.traffic === 'heavy' ? ' selected' : ''}>Heavy — hears a whole region</option></select></label></div>
      <p class="small dim">${esc(plan.error || sticks || 'Type the Pi\'s channels.')}</p>
      <div class="table-wrap"><table class="tbl"><thead><tr><th></th>${K.B.decoders.map(d => `<th class="num">${esc(d.short)}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table></div>
      <p class="small dim">Share of each computer's CPU, from the builder's model (RPi ALERT's measurements on a Pi 4; the AM62 at about half a Pi 4). Green is comfortable; amber is the edge; red drops bursts. In the last two columns the second figure is RPi ALERT 0.19's Light decoder filtering only around bursts: built, and being checked at the first base station. The trial is what replaces these estimates with numbers.</p>`;
  }

  // The table: every AM62 variant, then the Luna and the Raspberry Pis — what
  // Flood-Net's four channels on a busy day, and the Pi's channels in your
  // traffic, would ask of each, on RPi ALERT 0.17 and on 0.19's Light decoder
  // filtering only around bursts.
  function variants() {
    const K = globalThis.OA_BUILD_API, el = $('#variants');
    if (!K || !el) return;
    const CAT = globalThis.OA_CATALOG || [];
    const four = K.planSticks([151.5, 151.525, 151.95, 152.4], 'auto');
    const freqs = String(T.channels).split(/[ ,;]+/).map(Number).filter(f => f >= 136 && f <= 174);
    const yours = K.planSticks(freqs, 'auto');
    const pct = (plan, traffic, dec, cap) => { const u = K.load(plan, { traffic, decoder: dec }).total / cap; const v = K.verdict(u); return `<span class="${v.cls}">${Math.round(u * 100)}%</span>`; };
    const PICK = { buy: ['ok', 'Trial this'], now: ['ok', 'Works on 0.17'], later: ['info', 'Later, lighter decoder'], small: ['info', '1–2 channels, on 0.19'], maybe: ['warn', 'Possible, tight'], out: ['bad', 'Ruled out'], ref: ['ok', 'The Pi you have'], paper: ['info', 'Should work — untested'] };
    const chip = p => `<span class="chip st-${p[0] === 'bad' ? 'bad' : p[0] === 'warn' ? 'warn' : 'info'}">${esc(p[1])}</span>`;
    const pi4s = (cap, est) => { const x = cap / 4; return `<div class="small dim" title="CPU for decoding, with a Raspberry Pi 4 as 1${est ? ' — an estimate' : ''}">≈ ${x >= 0.95 ? (Math.round(x * 10) / 10) : x === 0.5 ? '½' : x === 0.25 ? '¼' : Math.round(x * 100) / 100} × a Pi 4${est ? ' (est.)' : ''}</div>`; };
    const temp = t => `${t[0] < 0 ? '−' + -t[0] : t[0]} to +${t[1]} °C`;
    const loads = cap => `<td class="num" data-l="4 ch, busy">${pct(four, 'busy', 'filter-once', cap)} → ${pct(four, 'busy', 'light', cap)}</td><td class="num" data-l="Yours">${yours.sticks && yours.sticks.length ? `${pct(yours, T.traffic, 'filter-once', cap)} → ${pct(yours, T.traffic, 'light', cap)}` : '—'}</td>`;
    const mallow = TRIAL.items.find(i => i.id === 'mallow'), sink = TRIAL.items.find(i => i.id === 'heatsink');
    const head = (text, sub) => `<tr class="sub"><th colspan="9">${esc(text)}${sub ? ` <span class="grp-sub">— ${esc(sub)}</span>` : ''}</th></tr>`;
    const verdin = TRIAL.variants.map(v => {
      const cap = v.cores * (v.ghz / 1.4) / 2;      // in Pi 4 cores
      return `<tr class="pick-${v.pick}"><th scope="row"><b>${esc(v.pid)}</b><div class="small dim">${esc(v.name)}</div></th><td>${v.cores} × A53 ${v.ghz} GHz${pi4s(cap)}</td><td>${esc(v.ram)} · ${esc(v.emmc)} eMMC</td><td>${v.wifi ? 'yes' : '—'}</td><td>${esc(v.temp)}</td><td class="num">${v.e14.ex ? `<b>${money(v.e14.ex * 1.1)}</b><div class="small dim">element14 ${esc(v.e14.code)}</div>` : '<span class="dim">not at element14</span>'}<div class="small dim" title="Toradex's own sample price, to businesses, converted">Toradex direct ≈ ${money(aud(v.usd) * 1.1)}</div></td>
        ${loads(cap)}
        <td>${chip(PICK[v.pick])}<div class="small dim">${esc(v.why)}</div><div class="small dim">element14: ${esc(v.e14.note)}.</div></td></tr>`;
    }).join('');
    const other = group => TRIAL.others.filter(o => o.group === group).map(o => {
      const it = CAT.find(x => x.id === o.ref);
      if (!it) return '';
      const cap = it.hw.sdrCh / 2, pr = it.price;
      return `<tr class="pick-${o.pick}"><th scope="row"><b>${esc(o.short)}</b><div class="small dim">${esc(o.detail)}</div></th><td>${esc(it.hw.cpu)}${pi4s(cap, o.est)}</td><td>${it.hw.ram < 1 ? it.hw.ram * 1024 + ' MB' : it.hw.ram + ' GB'} · ${esc(o.store)}</td><td>${it.io && it.io.wifi ? 'yes' : '—'}</td><td>${esc(temp(it.temp))}</td><td class="num"><b>${money(pr.gst === false ? pr.aud * 1.1 : pr.aud)}</b><div class="small dim">${esc(o.buy || pr.src)}</div></td>
        ${loads(cap)}
        <td>${chip(PICK[o.pick])}<div class="small dim">${esc(o.why)}</div></td></tr>`;
    }).join('');
    el.innerHTML = `<div class="table-wrap"><table class="tbl var"><thead><tr><th>Computer</th><th>CPU</th><th>RAM · storage</th><th>Wi-Fi</th><th>Rated</th><th class="num">A$ inc GST</th><th class="num" title="RPi ALERT 0.17 filtering always → 0.19 Light, filtering only around bursts">4 ch, busy: 0.17 → 0.19</th><th class="num" title="RPi ALERT 0.17 filtering always → 0.19 Light, filtering only around bursts">Your ${freqs.length} ch, ${esc(T.traffic)}: 0.17 → 0.19</th><th>Verdict</th></tr></thead><tbody>
      ${head('Toradex Verdin AM62', `the module only: add a Mallow carrier (${money(mallow.aud[0] * 1.1)}) and a heatsink (${range(sink.aud[0] * 1.1, sink.aud[1] * 1.1)})`)}${verdin}
      ${head('Toradex Luna SL1680', 'a whole board, the size of a Pi')}${other('luna')}
      ${head('Raspberry Pi', 'what RPi ALERT is made for; prices for the board alone')}${other('pi')}
    </tbody></table></div>`;
  }

  function results() {
    const v = T.res;
    const rows = TRIAL.measures.map(m => {
      const r = v[m.id] || {};
      const cell = k => `<td><input type="number" step="any" inputmode="decimal" data-res="${m.id}" data-k="${k}" value="${esc(r[k] == null ? '' : r[k])}" aria-label="${esc(m.name)}, ${{ pi1: 'Pi week 1', am1: 'AM62 week 1', pi2: 'Pi week 2', am2: 'AM62 week 2' }[k]}"></td>`;
      const ver = verdict(m, r);
      return `<tr><th scope="row">${esc(m.name)}<div class="small dim">${esc(m.where)}</div></th>${cell('pi1')}${cell('am1')}${cell('pi2')}${cell('am2')}<td class="small" data-ver="${m.id}">${ver ? `<span class="${ver.cls}">${esc(ver.text)}</span>` : '<span class="dim">—</span>'}</td></tr>`;
    }).join('');
    $('#results').innerHTML = `<div class="table-wrap"><table class="tbl res"><thead><tr><th>Measure</th><th>Pi · week 1</th><th>AM62 · week 1</th><th>Pi · week 2</th><th>AM62 · week 2</th><th>Verdict</th></tr></thead><tbody>${rows}</tbody></table></div>
      <div class="row"><button type="button" class="ghost small" data-act="copy">Copy the results</button><button type="button" class="ghost small" data-act="clear">Clear them</button><span class="small dim">Kept in this browser only.</span></div>`;
  }
  function verdictCell(id) {
    const m = TRIAL.measures.find(x => x.id === id), ver = verdict(m, T.res[id] || {});
    $(`[data-ver="${id}"]`).innerHTML = ver ? `<span class="${ver.cls}">${esc(ver.text)}</span>` : '<span class="dim">—</span>';
  }

  document.addEventListener('input', e => {
    const el = e.target;
    if (el.dataset.res) { (T.res[el.dataset.res] = T.res[el.dataset.res] || {})[el.dataset.k] = el.value; save(); verdictCell(el.dataset.res); }
  });
  document.addEventListener('change', e => {
    const el = e.target;
    if (el.dataset.got) { T.got[el.dataset.got] = el.checked; el.closest('li').classList.toggle('got', el.checked); save(); }
    if (el.id === 't-ch') { T.channels = el.value; save(); estimate(); variants(); }
    if (el.id === 't-tr') { T.traffic = el.value; save(); estimate(); variants(); }
  });
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    if (b.dataset.act === 'copy') {
      const lines = ['Measure\tPi wk1\tAM62 wk1\tPi wk2\tAM62 wk2\tVerdict', ...TRIAL.measures.map(m => { const r = T.res[m.id] || {}; const ver = verdict(m, r); return [m.name, r.pi1 || '', r.am1 || '', r.pi2 || '', r.am2 || '', ver ? ver.text : ''].join('\t'); })];
      const text = lines.join('\n');
      (navigator.clipboard ? navigator.clipboard.writeText(text) : Promise.reject()).then(() => toast('Results copied')).catch(() => toast('Couldn\'t copy here'));
    }
    if (b.dataset.act === 'clear') { T.res = {}; save(); results(); }
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
  shopping(); estimate(); variants(); results();
})();
