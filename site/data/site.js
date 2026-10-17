// open-ALERT catalogue — the site: enclosures, masts, earthing and fittings;
// backhaul and data plans; and the small parts a computer needs (boot card,
// clock, case, screen, speaker). Many of these are "supporting parts" the
// engine adds by rule (`kind` says which rule), each with alternatives.
//
// Small-part prices marked "estimate" are typical Australian retail, not
// quotes — swap in your own on the bill of materials.

(function () {
  const conv = (v, cur, rate, src, url) => ({ aud: Math.round(v * rate * 100) / 100, gst: false, basis: 'retail', src: `${src} (${cur}${v}, converted)`, url, asof: '2026-10' });
  const usd = (v, src, url) => conv(v, 'US$', 1.45, src, url);
  const gbp = (v, src, url) => conv(v, '£', 1.95, src, url);
  const est = (aud, src) => ({ aud, gst: true, basis: 'estimate', src: src || 'typical Australian retail', asof: '2026-10' });
  const ENC = ['field:enclosure', 'repeater:enclosure', 'base:enclosure'];
  const COMMS = ['field:comms', 'repeater:comms', 'base:comms'];
  const items = [
    // ── enclosures ──────────────────────────────────────────────────────────
    {
      id: 'existing-standpipe', name: 'The existing standpipe or canister housing', vendor: 'on site', cat: 'enclosure', slots: ['field:enclosure', 'repeater:enclosure'],
      blurb: 'An ALERT site\'s galvanised standpipe already houses the canister and battery — an ERT-A2 or ALERT121A mounts to it on a bracket.',
      price: { aud: 0, gst: true, basis: 'existing' }, grade: 4, hw: { material: 'steel' }, status: 'existing', lifeYears: 30,
      pros: ['No purchase; wiring stays'], cons: ['Check its condition and earthing'], src: [['ERT-A2 datasheet (standpipe bracket)', 'https://elprotech.com/wp-content/uploads/2020/08/DS_EL-ERT-A2_August_2020_V2.pdf']], conf: 'medium', tags: [],
    },
    {
      id: 'fibox-arca-302015', name: 'Fibox ARCA 302015 (300×200×150 mm, IP66)', vendor: 'Fibox (NHP in Australia)', cat: 'enclosure', slots: ENC,
      blurb: 'UV-stabilised polycarbonate with a mounting plate and quarter-turn lock: a logger, a radio and a 7 Ah battery.',
      price: gbp(62.56, 'IP Enclosures UK, ex VAT'), grade: 4, gradeWhy: 'industrial enclosure', ip: 'IP66', hw: { material: 'pc', size: '300×200×150' }, lifeYears: 20, status: 'current',
      pros: ['Light, does not corrode, RF-transparent'], cons: ['Small for an 18 Ah battery'], src: [['Fibox ARCA', 'https://www.fibox.com/']], conf: 'high', tags: [],
    },
    {
      id: 'fibox-arca-403015', name: 'Fibox ARCA 403015 (400×300×150 mm, IP66)', vendor: 'Fibox (NHP in Australia)', cat: 'enclosure', slots: ENC,
      blurb: 'Room for a logger, a radio, an 18–26 Ah battery and the charge controller on one plate.',
      price: gbp(94.73, 'IP Enclosures UK, ex VAT'), grade: 4, gradeWhy: 'industrial enclosure', ip: 'IP66', hw: { material: 'pc', size: '400×300×150' }, lifeYears: 20, status: 'current', def: true,
      pros: ['The usual field-station box'], cons: ['Polycarbonate: a determined vandal gets in'], src: [['Fibox ARCA', 'https://www.fibox.com/']], conf: 'high', tags: [],
    },
    {
      id: 'fibox-arca-403021', name: 'Fibox ARCA 403021 (400×300×210 mm, IP66/IK10)', vendor: 'Fibox (NHP in Australia)', cat: 'enclosure', slots: ENC,
      blurb: 'The deeper version, impact-rated IK10 — bought locally from RS Australia.',
      price: { aud: 432.74, gst: true, basis: 'retail', src: 'RS Australia', url: 'https://au.rs-online.com/web/p/general-purpose-enclosures/2880947', asof: '2026-10' },
      grade: 4, gradeWhy: 'industrial enclosure', ip: 'IP66', hw: { material: 'pc', size: '400×300×210' }, lifeYears: 20, status: 'current',
      pros: ['Depth for a radio and a DIN rail'], cons: ['Australian retail costs twice the UK price'], src: [['RS Australia', 'https://au.rs-online.com/web/p/general-purpose-enclosures/2880947']], conf: 'high', tags: [],
    },
    {
      id: 'fibox-arca-604021', name: 'Fibox ARCA 604021 (600×400×210 mm, IP66)', vendor: 'Fibox (NHP in Australia)', cat: 'enclosure', slots: ENC,
      blurb: 'A cabinet for a repeater or an outdoor base: radios, a computer, a 40 Ah battery, a DIN rail of supplies.',
      price: gbp(162.12, 'IP Enclosures UK, ex VAT'), grade: 4, gradeWhy: 'industrial enclosure', ip: 'IP66', hw: { material: 'pc', size: '600×400×210' }, lifeYears: 20, status: 'current',
      pros: ['Room to work in'], cons: [], src: [['Fibox ARCA', 'https://www.fibox.com/']], conf: 'high', tags: [],
    },
    {
      id: 'ss316-600x400', name: '316 stainless steel enclosure (600×400×200 mm, IP66)', vendor: 'various', cat: 'enclosure', slots: ENC,
      blurb: 'Lockable stainless steel for vandal-prone sites and coastal air.',
      price: gbp(570.61, 'UK supplier, ex VAT'), grade: 5, gradeWhy: 'heavy-duty enclosure', ip: 'IP66', hw: { material: 'steel', size: '600×400×200' }, lifeYears: 30, status: 'current',
      pros: ['Survives vandals and salt'], cons: ['Heavy; blocks GPS and Wi-Fi — antennas outside'], src: [], conf: 'medium', tags: [],
    },
    {
      id: 'abs-ip65-box', name: 'Budget IP65 ABS box', vendor: 'Jaycar, Altronics', cat: 'enclosure', slots: ENC,
      blurb: 'An electronics-store weatherproof box: fine for a trial, brittle after a few Queensland summers.',
      price: est(45), grade: 2, gradeWhy: 'ABS yellows and cracks in UV', ip: 'IP65', hw: { material: 'abs' }, lifeYears: 4, status: 'current',
      pros: ['Cheap, local'], cons: ['UV-brittle; poor sealing at the glands'], src: [], conf: 'low', tags: [],
    },
    {
      id: 'indoor-shelf', name: 'Indoors on a shelf — no cabinet', vendor: '—', cat: 'enclosure', slots: ['base:enclosure'],
      blurb: 'A base in an office or plant room needs only its own case.',
      price: { aud: 0, gst: true, basis: 'free' }, grade: 3, hw: { material: 'none' }, status: 'current', def: true,
      pros: ['Nothing to buy'], cons: ['Keep it out of reach and on the UPS'], src: [], conf: 'high', tags: [],
    },
    {
      id: 'rack-shelf-19', name: '19-inch rack shelf', vendor: 'various', cat: 'enclosure', slots: ['base:enclosure'],
      blurb: 'A vented shelf in the comms rack, beside the router and the UPS.',
      price: est(70), grade: 3, hw: { material: 'steel' }, lifeYears: 20, status: 'current',
      pros: ['Tidy, with the network gear'], cons: [], src: [], conf: 'low', tags: [],
    },
    // ── mounting, earthing, fittings ────────────────────────────────────────
    {
      id: 'galv-pole-4m', name: 'Galvanised steel pole, 4 m, with base plate', vendor: 'local fabricator', cat: 'mount', kind: 'pole',
      blurb: 'Carries the antenna, the panel and the enclosure above the 1% AEP flood level.',
      price: est(220, 'typical fabricated price'), grade: 4, lifeYears: 30, status: 'current', def: true,
      pros: [], cons: ['A footing to dig and pour'], src: [], conf: 'low', tags: [],
    },
    {
      id: 'existing-mast', name: 'The existing mast or tower', vendor: 'on site', cat: 'mount', kind: 'pole',
      blurb: 'A repeater site\'s tower already there — its condition is a rigger\'s question.',
      price: { aud: 0, gst: true, basis: 'existing' }, grade: 4, status: 'existing', lifeYears: 30,
      pros: ['No purchase'], cons: ['Flood-Net\'s ALERT2 plan budgets about $4,000 for a condition audit of a backbone site'], src: [['Flood-Net ALERT2 transition plan', 'https://github.com/cdomotor-g/MegaNet/blob/main/alert2-plan.js']], conf: 'medium', tags: [],
    },
    {
      id: 'guyed-lattice-mast-9m', name: 'Guyed aluminium lattice mast, 9 m', vendor: 'Essential Communications Services', cat: 'mount', kind: 'pole',
      blurb: 'A new repeater mast — climbable, guyed, from about $2,800 for 9 m to $7,200 for 21 m.',
      price: { aud: 2784, gst: false, basis: 'list', src: 'NSW DPI agtech catalogue', url: 'https://www.agtech.dpi.nsw.gov.au/collections/all?page=37', asof: '2026-10' },
      grade: 4, gradeWhy: 'commercial mast', lifeYears: 30, status: 'current',
      pros: ['Height where a hill has none'], cons: ['Footings, guys, approvals and a rigger'], src: [['NSW DPI agtech', 'https://www.agtech.dpi.nsw.gov.au/collections/all?page=37']], conf: 'medium', tags: [],
    },
    {
      id: 'roof-mast-1-8m', name: 'Hills roof mast 1.8 m (FB607314)', vendor: 'Hills', cat: 'mount', kind: 'pole',
      blurb: 'A base station\'s antenna on the building roof.',
      price: { aud: 85, gst: true, basis: 'retail', src: 'Australian retailer', asof: '2026-10' }, grade: 3, lifeYears: 20, status: 'current',
      pros: [], cons: [], src: [], conf: 'medium', tags: [],
    },
    {
      id: 'solar-pole-bracket', name: 'Pole-mount solar panel bracket', vendor: 'various', cat: 'mount', kind: 'solar-bracket',
      blurb: 'Holds the panel tilted north at about the site\'s latitude, above the reach of floods and cattle.',
      price: est(60), grade: 3, lifeYears: 20, status: 'current', def: true,
      pros: [], cons: [], src: [], conf: 'low', tags: [],
    },
    {
      id: 'earth-kit', name: 'Earth kit: 1.4 m copper-bonded stake, clamp, 6 mm² cable', vendor: 'Utilux and others', cat: 'earth',
      blurb: 'One earth for the mast, the enclosure and the arrestor — the difference between a strike and a site visit.',
      price: est(60, 'Utilux stake A$17.59 plus clamp and cable'), grade: 4, lifeYears: 20, status: 'current', def: true,
      pros: [], cons: ['Test the earth resistance'], src: [['Utilux ER1314WC10-1', 'https://www.utilux.com.au/']], conf: 'medium', tags: [],
    },
    {
      id: 'novaris-sl420', name: 'Novaris SL420-G 4–20 mA surge protector', vendor: 'Novaris (Australia)', cat: 'earth', kind: 'sensor-surge',
      blurb: 'A DIN-rail protector on the level sensor\'s loop, where a long cable to the river meets the logger.',
      price: est(120, 'typical distributor price'), temp: [-55, 70], grade: 5, gradeWhy: 'Australian surge specialist', support: 'vendor', lifeYears: 15, status: 'current', def: true,
      pros: ['Saves the logger when lightning finds the sensor cable'], cons: [], src: [['Novaris', 'https://www.novaris.com.au/']], conf: 'medium', tags: [],
    },
    {
      id: 'novaris-sl4-485', name: 'Novaris SL4-12-485 RS-485 + 12 V surge protector', vendor: 'Novaris (Australia)', cat: 'earth', kind: 'sensor-surge',
      blurb: 'Protects an RS-485 (or SDI-12) sensor line and its 12 V supply in one 12 mm module.',
      price: est(140, 'typical distributor price'), grade: 5, gradeWhy: 'Australian surge specialist', support: 'vendor', lifeYears: 15, status: 'current',
      pros: ['Data and power in one'], cons: [], src: [['IPD: Novaris SL4', 'https://www.ipd.com.au/novaris-sl4-24-485-signal-and-power-surge-protection-with-base-4-8k']], conf: 'medium', tags: [],
    },
    {
      id: 'enclosure-fittings', name: 'Fittings: DIN rail, terminals, fuses, IP68 glands, breather vent, desiccant', vendor: 'various', cat: 'enc-acc',
      blurb: 'What turns a box into an installation — and keeps the condensation out.',
      price: est(80), grade: 4, lifeYears: 10, status: 'current', def: true,
      pros: [], cons: [], src: [], conf: 'low', tags: [],
    },
    {
      id: 'sun-shield', name: 'Sun shield (white powder-coated aluminium canopy)', vendor: 'local fabricator', cat: 'enc-acc', kind: 'sun-shield',
      blurb: 'A canopy over the enclosure with an air gap: takes 10–15 °C off the inside on a Queensland afternoon.',
      price: est(150, 'typical fabricated price'), grade: 4, lifeYears: 20, status: 'current', def: true,
      pros: ['The cheapest way to keep batteries and Pis alive'], cons: [], src: [], conf: 'low', tags: [],
    },
    {
      id: 'radio-data-cable', name: 'Radio accessory / data cable', vendor: 'radio dealer', cat: 'cable', kind: 'radio-data',
      blurb: 'From the encoder to the radio\'s accessory port: audio in, audio out, PTT, ground — made to suit the radio.',
      price: est(45), grade: 3, lifeYears: 10, status: 'current', def: true,
      pros: [], cons: ['Set the deviation once it is wired'], src: [], conf: 'low', tags: [],
    },
    {
      id: 'dc-wiring-fuse', name: 'Battery fuse, holder and DC wiring', vendor: 'various', cat: 'cable', kind: 'dc-wiring',
      blurb: 'A fuse at the battery terminal and properly sized cable to everything it feeds.',
      price: est(35), grade: 4, lifeYears: 15, status: 'current', def: true,
      pros: [], cons: [], src: [], conf: 'low', tags: [],
    },
    {
      id: 'vhf-splitter-2', name: 'VHF 2-way power divider (N-type)', vendor: 'various', cat: 'connector', kind: 'splitter',
      blurb: 'Feeds one antenna to two receivers — an ALERT1 SDR and an ALERT2 receiver side by side, as ELPRO suggests for a migration.',
      price: est(120, 'typical RF supplier price'), grade: 4, lifeYears: 20, status: 'current', def: true,
      pros: ['One antenna, two receive chains'], cons: ['About 3.5 dB to each port'], src: [['ELPRO ALERT2 introduction', 'https://elprotech.com/wp-content/uploads/2024/12/Alert-2-Introduction-BH-V1.pdf']], conf: 'low', tags: [],
    },
    {
      id: 'vhf-splitter-4', name: 'VHF 4-way power divider (N-type)', vendor: 'various', cat: 'connector', kind: 'splitter',
      blurb: 'One antenna to up to four receivers.',
      price: est(180, 'typical RF supplier price'), grade: 4, lifeYears: 20, status: 'current',
      pros: [], cons: ['About 6.5 dB to each port'], src: [], conf: 'low', tags: [],
    },
    // ── computer parts ──────────────────────────────────────────────────────
    {
      id: 'sandisk-max-endurance-64', name: 'SanDisk Max Endurance microSD 64 GB', vendor: 'SanDisk', cat: 'storage', kind: 'microsd',
      blurb: 'Made for dash-cams that write all day: the sensible consumer card for a Pi.',
      price: { aud: 32, gst: true, basis: 'retail', src: 'staticice.com.au', asof: '2026-10' }, temp: [-25, 85], grade: 2, lifeYears: 4, status: 'current', def: true,
      pros: ['High endurance, cheap'], cons: ['Consumer flash: no power-loss protection'], src: [['SanDisk', 'https://www.westerndigital.com/']], conf: 'medium', tags: [],
    },
    {
      id: 'samsung-pro-endurance-64', name: 'Samsung PRO Endurance microSD 64 GB', vendor: 'Samsung', cat: 'storage', kind: 'microsd',
      blurb: 'Samsung\'s high-endurance card.',
      price: { aud: 69, gst: true, basis: 'retail', src: 'staticice.com.au', asof: '2026-10' }, temp: [-25, 85], grade: 2, lifeYears: 4, status: 'current',
      pros: [], cons: [], src: [], conf: 'medium', tags: [],
    },
    {
      id: 'kingston-industrial-16', name: 'Kingston Industrial microSD 16 GB (pSLC)', vendor: 'Kingston', cat: 'storage', kind: 'microsd',
      blurb: 'Pseudo-SLC industrial flash rated −40 to +85 °C: far more write endurance and tolerance of heat.',
      price: { aud: 69, gst: true, basis: 'retail', src: 'staticice.com.au', asof: '2026-10' }, temp: [-40, 85], grade: 4, gradeWhy: 'industrial pSLC', lifeYears: 8, status: 'current',
      pros: ['The card for a hot, remote box'], cons: ['Small (16 GB is plenty for RPi ALERT)'], src: [['Kingston Industrial', 'https://www.kingston.com/']], conf: 'medium', tags: [],
    },
    {
      id: 'ds3231-rtc', name: 'DS3231 battery-backed RTC (Adafruit)', vendor: 'Adafruit', cat: 'rtc',
      blurb: 'A temperature-compensated clock with a coin cell for a Pi 3 or 4 (dtoverlay=i2c-rtc,ds3231).',
      price: usd(17.5, 'Adafruit'), grade: 2, hw: { for: ['pi4', 'pi3', 'zero', 'pi'] }, lifeYears: 8, status: 'current', def: true,
      pros: ['Survey timing through a power cut'], cons: [], src: [['RPi ALERT: clock', 'https://github.com/cdomotor-g/RPi_ALERT/blob/main/docs/how-it-works.md']], conf: 'high', tags: [],
    },
    {
      id: 'pi5-rtc-battery', name: 'Raspberry Pi 5 RTC battery', vendor: 'Raspberry Pi Ltd', cat: 'rtc',
      blurb: 'The rechargeable cell for the Pi 5\'s own clock, on the J5 connector.',
      price: est(9), grade: 3, hw: { for: ['pi5'] }, lifeYears: 8, status: 'current', def: true,
      pros: ['Uses the clock already on the board'], cons: [], src: [['Pi 5 RTC battery', 'https://www.raspberrypi.com/products/rtc-battery/']], conf: 'medium', tags: [],
    },
    {
      id: 'flirc-pi4-case', name: 'Flirc aluminium case (Pi 4)', vendor: 'Flirc', cat: 'case',
      blurb: 'The whole case is the heatsink: silent, sealed, no fan to fail.',
      price: est(39), grade: 3, hw: { for: ['pi4'] }, lifeYears: 10, status: 'current', def: true,
      pros: ['Passive cooling'], cons: [], src: [['Flirc', 'https://flirc.tv/']], conf: 'low', tags: [],
    },
    {
      id: 'rpi5-official-case', name: 'Raspberry Pi 5 case (with fan)', vendor: 'Raspberry Pi Ltd', cat: 'case',
      blurb: 'The official case with a temperature-controlled fan.',
      price: est(16), grade: 2, hw: { for: ['pi5'] }, lifeYears: 6, status: 'current', def: true,
      pros: ['Cheap'], cons: ['A fan to fail'], src: [], conf: 'medium', tags: [],
    },
    {
      id: 'din-pi-case', name: 'DIN-rail case for a Pi', vendor: 'various', cat: 'case',
      blurb: 'Mounts the Pi on the rail beside the supplies in a cabinet.',
      price: est(30), grade: 3, hw: { for: ['pi'] }, lifeYears: 10, status: 'current',
      pros: ['Tidy cabinet installs'], cons: [], src: [], conf: 'low', tags: [],
    },
    {
      id: 'zero-case', name: 'Pi Zero case', vendor: 'various', cat: 'case',
      blurb: 'A small plastic case for the Zero 2 W.',
      price: est(10), grade: 2, hw: { for: ['zero'] }, lifeYears: 6, status: 'current', def: true,
      pros: [], cons: [], src: [], conf: 'low', tags: [],
    },
    {
      id: 'sbc-case-generic', name: 'Case for the board', vendor: 'various', cat: 'case',
      blurb: 'Whatever case the board\'s maker sells.',
      price: est(20), grade: 2, hw: { for: ['linux'] }, lifeYears: 6, status: 'current',
      pros: [], cons: [], src: [], conf: 'low', tags: [],
    },
    {
      id: 'generic-5v-usbc', name: '5 V 3 A USB-C supply', vendor: 'various', cat: 'psu', kind: 'psu5',
      blurb: 'A good-quality 5 V 3 A supply for a board that is not a Pi.',
      price: est(20), grade: 2, hw: { for: ['linux', 'mcu'] }, lifeYears: 6, status: 'current',
      pros: [], cons: ['Cheap ones sag under load'], src: [], conf: 'low', tags: [],
    },
    {
      id: 'rpi-touch-display-2', name: 'Raspberry Pi Touch Display 2', vendor: 'Raspberry Pi Ltd', cat: 'display',
      blurb: 'A 7-inch touchscreen on the Pi\'s DSI connector: RPi ALERT\'s kiosk dashboard comes up when it is plugged in.',
      price: { aud: 108.63, gst: true, basis: 'retail', src: 'Pi Australia', url: 'https://piaustralia.com.au/products/raspberry-pi-touch-display-2', asof: '2026-10' },
      grade: 2, hw: { for: ['pi'] }, lifeYears: 6, status: 'current', def: true,
      pros: ['Powered from the Pi'], cons: [], src: [['Touch Display 2', 'https://www.raspberrypi.com/products/touch-display-2/']], conf: 'high', tags: [],
    },
    {
      id: 'hdmi-monitor', name: 'An HDMI monitor', vendor: 'any', cat: 'display',
      blurb: 'Any monitor on the computer\'s HDMI port.',
      price: est(150), grade: 2, hw: { for: ['linux', 'x86'] }, lifeYears: 8, status: 'current',
      pros: [], cons: [], src: [], conf: 'low', tags: [],
    },
    {
      id: 'speaker-35mm', name: 'Small powered speaker (3.5 mm)', vendor: 'any', cat: 'audio',
      blurb: 'For the chirps, on the audio jack.',
      price: est(25), grade: 2, lifeYears: 5, status: 'current', def: true,
      pros: [], cons: [], src: [], conf: 'low', tags: [],
    },
    {
      id: 'usb-speaker', name: 'USB speaker (or USB sound card + speaker)', vendor: 'any', cat: 'audio',
      blurb: 'For a computer without an audio jack, such as a Pi 5.',
      price: est(30), grade: 2, lifeYears: 5, status: 'current',
      pros: [], cons: [], src: [], conf: 'low', tags: ['usb-audio'],
    },
    // ── backhaul ────────────────────────────────────────────────────────────
    {
      id: 'teltonika-trb140', name: 'Teltonika TRB140 LTE gateway', vendor: 'Teltonika (Lithuania)', cat: 'cell', slots: COMMS,
      blurb: 'The smallest industrial LTE gateway: one Ethernet port, I/O, 9–30 V, −40 to +75 °C, 1.15 W idle.',
      price: { aud: 229, gst: true, basis: 'retail', src: 'staticice.com.au', asof: '2026-10' },
      power: { w: 1.15, supply: 'wide' }, temp: [-40, 75], grade: 4, gradeWhy: 'industrial router line', support: 'vendor', certs: ['RCM', 'CE'],
      io: { eth: 1 }, hw: {}, open: { hw: 'closed', sw: 'partial', lic: 'RutOS (OpenWrt-based)' }, lifeYears: 8, status: 'current',
      pros: ['Lowest idle draw of the range', 'Industrial temperature'], cons: ['Runs Python, not Node.js — an uplink, not a host for RPi ALERT'],
      src: [['TRB140 power', 'https://wiki.teltonika-networks.com/view/TRB140_Power_Consumption']], conf: 'high', tags: ['router', 'needs-plan'],
    },
    {
      id: 'teltonika-rut241', name: 'Teltonika RUT241 4G router', vendor: 'Teltonika (Lithuania)', cat: 'cell', slots: COMMS,
      blurb: 'Compact industrial 4G router with Ethernet, Wi-Fi and I/O: 1.31 W idle.',
      price: { aud: 289, gst: true, basis: 'retail', src: 'staticice.com.au', asof: '2026-10' },
      power: { w: 1.31, supply: 'wide' }, temp: [-40, 75], grade: 4, gradeWhy: 'industrial router line', support: 'vendor', certs: ['RCM', 'CE'],
      io: { eth: 2, wifi: true }, hw: {}, open: { hw: 'closed', sw: 'partial', lic: 'RutOS' }, lifeYears: 8, status: 'current', def: true,
      pros: ['Remote management (RMS)', 'Wide supply'], cons: ['Draws 1.3 W all day: switch it from the logger at a small solar site'],
      src: [['RUT241 power', 'https://wiki.teltonika-networks.com/view/RUT241_Power_Consumption']], conf: 'high', tags: ['router', 'needs-plan'],
    },
    {
      id: 'teltonika-rut956', name: 'Teltonika RUT956 4G router (RS-232/485, GNSS)', vendor: 'Teltonika (Lithuania)', cat: 'cell', slots: COMMS,
      blurb: 'Dual-SIM 4G with RS-232, RS-485, GNSS and I/O — a serial device straight onto the internet.',
      price: { aud: 469, gst: true, basis: 'retail', src: 'staticice.com.au', asof: '2026-10' },
      power: { w: 1.79, supply: 'wide' }, temp: [-40, 75], grade: 5, gradeWhy: 'industrial router line', support: 'vendor', certs: ['RCM', 'CE'],
      io: { eth: 4, rs232: 1, rs485: 1, wifi: true }, hw: {}, open: { hw: 'closed', sw: 'partial', lic: 'RutOS' }, lifeYears: 8, status: 'current',
      pros: ['Serial-to-IP for an ERT-A2 or a logger', 'Dual SIM'], cons: ['1.8 W idle'],
      src: [['RUT956', 'https://teltonika-networks.com/products/routers/rut956']], conf: 'high', tags: ['router', 'needs-plan'],
    },
    {
      id: 'teltonika-rutx11', name: 'Teltonika RUTX11 LTE Cat 6 router', vendor: 'Teltonika (Lithuania)', cat: 'cell', slots: ['base:comms', 'repeater:comms'],
      blurb: 'Gigabit, dual-SIM Cat 6 with Wi-Fi 5 — a base station\'s main link.',
      price: { aud: 645.87, gst: true, basis: 'retail', src: 'staticice.com.au', asof: '2026-10' },
      power: { w: 3.9, supply: 'wide' }, temp: [-40, 75], grade: 4, gradeWhy: 'industrial router line', support: 'vendor', certs: ['RCM', 'CE'],
      io: { eth: 4, wifi: true }, hw: {}, open: { hw: 'closed', sw: 'partial', lic: 'RutOS' }, lifeYears: 8, status: 'current',
      pros: ['Fast, dual SIM failover'], cons: ['3.9 W idle'], src: [['RUTX11', 'https://teltonika-networks.com/products/routers/rutx11']], conf: 'high', tags: ['router', 'needs-plan'],
    },
    {
      id: 'huawei-e8372h', name: 'Huawei E8372h 4G USB modem', vendor: 'Huawei (Telstra-branded)', cat: 'cell', slots: ['base:comms'],
      blurb: 'A $44 USB modem for a Pi base station — consumer-grade, but it works.',
      price: { aud: 44, gst: true, basis: 'retail', src: 'Australian retailer', asof: '2026-10' },
      power: { w: 1.5, supply: 'usb' }, temp: [0, 45], grade: 1, gradeWhy: 'consumer USB stick', support: 'limited',
      io: { usbDev: true }, hw: {}, open: { hw: 'closed', sw: 'closed', lic: null }, lifeYears: 4, status: 'current',
      pros: ['Cheap'], cons: ['Consumer temperature range', 'Takes a USB port and power from the Pi'], src: [], conf: 'medium', tags: ['needs-plan'],
    },
    {
      id: 'sixfab-4g-hat', name: 'Sixfab 4G/LTE modem kit for Raspberry Pi (Quectel EG25-G)', vendor: 'Sixfab', cat: 'cell', slots: ['base:comms', 'repeater:comms', 'field:comms'],
      blurb: 'A Quectel LTE module on a Pi HAT, managed through NetworkManager and ModemManager.',
      price: usd(140, 'Sixfab'), power: { w: 1.2, supply: 'none' }, temp: [-30, 75], grade: 2, gradeWhy: 'maker board, industrial module', support: 'limited',
      hw: { for: ['pi'] }, open: { hw: 'partial', sw: 'open', lic: null }, lifeYears: 6, status: 'current',
      pros: ['No separate router'], cons: ['Pi only; antenna outside the box'], src: [['Sixfab', 'https://sixfab.com/product/raspberry-pi-4g-lte-modem-kit/']], conf: 'medium', tags: ['needs-plan'],
    },
    {
      id: 'rockblock-9603', name: 'RockBLOCK 9603 (Iridium short-burst data)', vendor: 'Ground Control (UK)', cat: 'sat', slots: ['field:comms', 'repeater:comms'],
      blurb: 'Iridium SBD from anywhere on earth: 50-byte messages, priced per message. Cell towers fail in floods; satellites do not.',
      price: gbp(242, 'Ground Control'),
      yearly: { aud: 281, gst: false, what: 'line rental (about £12 a month) — plus about US$0.10–0.20 per 50-byte message' },
      power: { w: 0.05, supply: 'usb' }, temp: [-40, 85], grade: 4, gradeWhy: 'Iridium: proven remote telemetry', support: 'vendor',
      io: { usbDev: true }, hw: {}, open: { hw: 'closed', sw: 'closed', lic: null }, lifeYears: 8, status: 'current',
      pros: ['Works where nothing else does'], cons: ['Every message costs money — hourly reports add up to about US$90 a month'],
      src: [['RockBLOCK', 'https://learn.adafruit.com/using-the-rockblock-iridium-modem/service-setup']], conf: 'medium', tags: [],
    },
    {
      id: 'myriota-hyperpulse', name: 'Myriota HyperPulse developer kit', vendor: 'Myriota (Adelaide)', cat: 'sat', slots: ['field:comms'],
      blurb: 'Australian satellite IoT (5G NTN over Viasat L-band), commercial in Australia since December 2025 — small messages, very low power.',
      price: usd(199, 'Myriota'), yearly: { aud: null, what: 'airtime, quoted by Myriota' },
      power: { w: 0.01, supply: 'battery' }, temp: [-40, 85], grade: 3, gradeWhy: 'new service', support: 'vendor',
      hw: {}, open: { hw: 'closed', sw: 'closed', lic: null }, lifeYears: 8, status: 'beta',
      pros: ['Australian, frugal'], cons: ['Airtime pricing not public; latency of minutes'], src: [['Myriota HyperPulse', 'https://itbrief.com.au/story/myriota-launches-hyperpulse-5g-ntn-for-iot-in-remote-regions']], conf: 'medium', tags: [],
    },
    {
      id: 'starlink-mini', name: 'Starlink Mini', vendor: 'SpaceX', cat: 'sat', slots: ['base:comms', 'repeater:comms'],
      blurb: 'Broadband anywhere with a view of the sky — at 25–40 W, a solar site\'s biggest load by far.',
      price: { aud: 599, gst: true, basis: 'retail', src: 'Starlink Australia RRP', asof: '2026-10' },
      yearly: { aud: 960, gst: true, what: 'Roam 100 GB at about A$80 a month (a standby plan is about A$15 a month at 0.5 Mbit/s)' },
      power: { w: 30, supply: 'wide' }, temp: [-30, 50], grade: 3, gradeWhy: 'consumer service, robust hardware', support: 'limited',
      hw: {}, open: { hw: 'closed', sw: 'closed', lic: null }, lifeYears: 5, status: 'current',
      pros: ['Real broadband at a remote base'], cons: ['25–40 W around the clock', 'A consumer service with no SLA'], src: [['Starlink', 'https://www.starlink.com/']], conf: 'medium', tags: ['router'],
    },
    {
      id: 'dragino-lsn50v2', name: 'Dragino LSN50-V2 LoRaWAN node', vendor: 'Dragino', cat: 'lpwan', slots: ['field:comms'],
      blurb: 'A battery LoRaWAN node with pulse, ADC and UART inputs, on the class-licensed 915 MHz band — needs a LoRaWAN gateway in range.',
      price: usd(85.99, 'Dragino reseller'), power: { w: 0.005, supply: 'battery' }, temp: [-40, 85], grade: 2, gradeWhy: 'IoT node', support: 'limited',
      hw: {}, open: { hw: 'partial', sw: 'open', lic: null }, lifeYears: 6, status: 'current',
      pros: ['No licence (LIPD class licence)', 'Years on a battery'], cons: ['Short range; a gateway within a few km', 'Not a flood-warning path the Bureau uses'],
      src: [['Dragino LSN50-V2', 'https://www.dragino.com/']], conf: 'medium', tags: [],
    },
    {
      id: 'nbn-service', name: 'NBN fixed broadband', vendor: 'any retailer', cat: 'wired', slots: ['base:comms'],
      blurb: 'The base station\'s own fixed line, where the office network will not have it.',
      price: { aud: 0, gst: true, basis: 'free' }, yearly: { aud: 900, gst: true, what: 'about A$75 a month' },
      power: { w: 8, supply: 'mains' }, grade: 3, support: 'vendor', hw: {}, lifeYears: 10, status: 'current',
      pros: ['Fast, cheap per gigabyte'], cons: ['Fails in the same storm as the power'], src: [], conf: 'low', tags: ['router'],
    },
    {
      id: 'office-network', name: 'The office network', vendor: 'existing', cat: 'wired', slots: ['base:comms'],
      blurb: 'A port on the existing network, with outbound HTTPS allowed.',
      price: { aud: 0, gst: true, basis: 'existing' }, power: { w: 0 }, grade: 3, hw: {}, status: 'existing', def: true,
      pros: ['Nothing to buy'], cons: ['IT policy: RPi ALERT needs outbound HTTPS only'], src: [], conf: 'high', tags: ['router'],
    },
    // ── data plans ──────────────────────────────────────────────────────────
    {
      id: 'iot-sim-10mb', name: 'IoT SIM, 10–50 MB a month', vendor: 'Telstra, Optus or Vodafone business IoT', cat: 'plan',
      blurb: 'Enough for a gauge reporting every 15 minutes over HTTPS or MQTT.',
      price: { aud: 2, gst: true, basis: 'estimate', src: 'A$2 SIM charge' }, yearly: { aud: 96, gst: true, what: 'about A$8 a month' },
      grade: 4, hw: { for: ['field', 'repeater'] }, status: 'current', def: true,
      pros: [], cons: ['Watch excess data: some IoT plans charge about A$30 per MB over'], src: [['Telstra IoT plans', 'https://telstra.com.au/help/critical-information-summaries/business/internet-of-things-and']], conf: 'low', tags: [],
    },
    {
      id: 'telstra-lpwan-500kb', name: 'Telstra IoT LPWAN 500 KB plan', vendor: 'Telstra', cat: 'plan',
      blurb: 'A$1.50 a month for Cat-M1 / NB-IoT devices sending compact messages (well under 500 KB).',
      price: { aud: 2, gst: true, basis: 'retail', src: 'Telstra CIS' }, yearly: { aud: 18, gst: true, what: 'A$1.50 a month' },
      grade: 4, hw: { for: ['field'] }, status: 'current',
      pros: ['Cheapest'], cons: ['Excess about A$30/MB — a chatty JSON post every 15 minutes is 3 MB a month'], src: [['Telstra IoT plans', 'https://telstra.com.au/help/critical-information-summaries/business/internet-of-things-and']], conf: 'medium', tags: [],
    },
    {
      id: 'mobile-data-5gb', name: 'Mobile data plan, a few GB a month', vendor: 'any carrier', cat: 'plan',
      blurb: 'For a base station or a router: readings, receptions, heartbeats and updates.',
      price: { aud: 0, gst: true, basis: 'estimate' }, yearly: { aud: 240, gst: true, what: 'about A$20 a month' },
      grade: 3, hw: { for: ['base', 'repeater', 'field'] }, status: 'current', def: true,
      pros: ['No excess-data surprises'], cons: [], src: [], conf: 'low', tags: [],
    },
    {
      id: 'onence-lifetime', name: '1NCE IoT Lifetime Flat (500 MB over 10 years)', vendor: '1NCE', cat: 'plan',
      blurb: 'One payment for ten years and 500 MB — for a frugal device; confirm its Australian network partner.',
      price: usd(10, '1NCE'), yearly: { aud: 0, what: 'none' }, grade: 2, hw: { for: ['field'] }, status: 'current',
      pros: ['Ten years for the price of a coffee'], cons: ['Australian coverage unconfirmed', '4 MB a month on average'], src: [['1NCE', 'https://1nce.com/']], conf: 'low', tags: [],
    },
    // ── licence ─────────────────────────────────────────────────────────────
    {
      id: 'acma-apparatus-licence', name: 'ACMA apparatus licence (new site or variation)', vendor: 'ACMA, via the network owner', cat: 'service', kind: 'acma',
      blurb: 'Every transmitting site on a licensed channel: a new licence, or the network\'s varied. One-off planning figure; the annual fee follows ACMA\'s schedule.',
      price: { aud: 1500, gst: false, basis: 'estimate', src: 'Flood-Net ALERT2 transition plan (licensing per network change)', url: 'https://github.com/cdomotor-g/MegaNet/blob/main/alert2-plan.js', asof: '2026-10' },
      yearly: { aud: null, what: 'annual apparatus licence fee — ACMA\'s fee schedule, by band, area and power' },
      grade: 5, status: 'current', def: true,
      pros: [], cons: ['A council or the Bureau holds it — talk to them first'], src: [['ACMA apparatus licences', 'https://www.acma.gov.au/apparatus-licences']], conf: 'medium', tags: [],
    },
  ];
  if (typeof module === 'object' && module.exports) module.exports = items;
  else (globalThis.OA_CATALOG = globalThis.OA_CATALOG || []).push(...items);
})();
