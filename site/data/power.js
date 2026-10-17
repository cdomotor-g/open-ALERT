// open-ALERT catalogue — power: panels, charge controllers, batteries,
// converters, supplies and UPSes.
//
// Panels carry `hw.w`; controllers `hw.a` (charge current), `hw.mppt` and
// their own draw as `power.w` (it matters: a 10 mA controller costs a small
// site more than its logger); batteries `hw.ah`, `hw.chem` (agm | lfp) and
// `hw.dod`, the usable depth of discharge. Converters and supplies say which
// computers they suit in `hw.for` (tags) and how much they can deliver in
// `hw.watts`. UPSes carry `hw.wh` (stored energy) and `hw.selfW` (what the
// inverter or charger burns itself, which dominates at a 5 W load).
//
// Heat: Victron rates AGM float life at 7–10 years at 20 °C, 4 at 30 °C and 2
// at 40 °C — so a lead-acid battery in a sun-baked Queensland box is a
// three-to-four-year part.

(function () {
  const conv = (v, cur, rate, src, url) => ({ aud: Math.round(v * rate * 100) / 100, gst: false, basis: 'retail', src: `${src} (${cur}${v}, converted)`, url, asof: '2026-10' });
  const usd = (v, src, url) => conv(v, 'US$', 1.45, src, url);
  const SOL = ['field:solar', 'repeater:solar', 'base:solar'];
  const REG = ['field:regulator', 'repeater:regulator', 'base:regulator'];
  const BAT = ['field:battery', 'repeater:battery', 'base:battery'];
  const panel = (id, name, vendor, w, aud, src, grade, extra) => Object.assign({
    id, name, vendor, cat: 'solar', slots: SOL,
    blurb: `${w} W, 12 V nominal.`,
    price: { aud, gst: true, basis: aud == null ? 'quote' : 'retail', src, asof: '2026-10' },
    grade, gradeWhy: grade >= 4 ? 'brand-name panel' : 'budget panel', support: grade >= 4 ? 'vendor' : 'limited',
    hw: { w }, lifeYears: 20, status: 'current', pros: [], cons: [], src: [], conf: 'high', tags: [],
  }, extra || {});
  const items = [
    // ── solar panels ────────────────────────────────────────────────────────
    panel('victron-20w', 'Victron 20 W mono panel', 'Victron Energy', 20, 51.48, 'Australian Victron dealer', 4, { def: true }),
    panel('victron-30w', 'Victron 30 W mono panel', 'Victron Energy', 30, 59.4, 'Australian Victron dealer', 4),
    panel('victron-40w', 'Victron 40 W mono panel', 'Victron Energy', 40, 76.23, 'Australian Victron dealer', 4),
    panel('victron-190w', 'Victron 190 W mono panel', 'Victron Energy', 190, 194.86, 'Australian Victron dealer', 4, { blurb: '190 W, 12 V nominal — for a hungry repeater, a Starlink, or a Pi on solar.' }),
    panel('exotronic-20w', 'Exotronic Fusion 20 W panel', 'Exotronic (Australia)', 20, 36, 'Exotronic', 2),
    panel('exotronic-50w', 'Exotronic Fusion 50 W panel', 'Exotronic (Australia)', 50, 69, 'Exotronic', 2),
    panel('exotronic-115w', 'Exotronic Fusion 115 W panel', 'Exotronic (Australia)', 115, 169, 'Exotronic', 2),
    panel('campbell-sp10', 'Campbell Scientific SP10 10 W panel', 'Campbell Scientific', 10, null, 'Campbell Scientific Australia', 5,
      { blurb: '10 W with a mount rated for 58 m/s winds — the panel on a Campbell gauge.', gradeWhy: 'hydromet-rated mounting' }),
    // ── charge controllers ──────────────────────────────────────────────────
    {
      id: 'victron-mppt-75-10', name: 'Victron SmartSolar MPPT 75/10', vendor: 'Victron Energy', cat: 'regulator', slots: REG,
      blurb: 'A 10 A MPPT controller with Bluetooth monitoring and a load output with low-voltage disconnect.',
      price: { aud: 79.84, gst: true, basis: 'retail', src: 'Australian Victron dealer (on sale)', asof: '2026-10' },
      power: { w: 0.12 }, temp: [-30, 60],
      grade: 4, gradeWhy: 'Victron: the standard small MPPT', support: 'vendor',
      hw: { a: 10, mppt: true }, lifeYears: 12, status: 'current', def: true,
      pros: ['MPPT for its price', 'Bluetooth: read it from the gate'], cons: ['10–19 mA of its own — at a 2 mA logger site, five times the logger'],
      src: [['Victron MPPT 75/10 datasheet', 'https://www.victronenergy.com/upload/documents/Datasheet-SmartSolar-charge-controller-MPPT-75-10,-75-15,-100-15,-100-20_48V-EN.pdf']], conf: 'high', tags: [],
    },
    {
      id: 'victron-mppt-75-15', name: 'Victron SmartSolar MPPT 75/15', vendor: 'Victron Energy', cat: 'regulator', slots: REG,
      blurb: 'The 15 A sibling, for up to about 200 W of panel.',
      price: { aud: 86.63, gst: true, basis: 'retail', src: 'Australian Victron dealer', asof: '2026-10' },
      power: { w: 0.12 }, temp: [-30, 60],
      grade: 4, gradeWhy: 'Victron', support: 'vendor', hw: { a: 15, mppt: true }, lifeYears: 12, status: 'current',
      pros: ['Headroom for a repeater\'s panel'], cons: ['Same self-draw as the 75/10'],
      src: [['Victron MPPT 75/15', 'https://www.victronenergy.com/solar-charge-controllers/smartsolar-mppt-75-10-75-15-100-15-100-20']], conf: 'high', tags: [],
    },
    {
      id: 'genasun-gv-10', name: 'Genasun GV-10 MPPT', vendor: 'Genasun (USA)', cat: 'regulator', slots: REG,
      blurb: 'A 10.5 A MPPT built for remote telemetry: under a milliamp at night, 98% efficient, lithium or lead-acid versions.',
      price: { aud: 225, gst: true, basis: 'retail', src: 'Solar4RVs', url: 'https://www.solar4rvs.com.au/products/genasun-10-5a-mppt-12v-14-2v-lithium', asof: '2026-10' },
      power: { w: 0.011 }, temp: [-40, 85],
      grade: 5, gradeWhy: 'telemetry-grade MPPT', support: 'vendor', hw: { a: 10.5, mppt: true }, lifeYears: 15, status: 'current',
      pros: ['0.9 mA of its own', '−40 to +85 °C'], cons: ['No monitoring port', 'Choose the lithium or lead-acid version to match the battery'],
      src: [['Genasun GV-10', 'https://www.solar4rvs.com.au/products/genasun-10-5a-mppt-12v-14-2v-lithium']], conf: 'high', tags: [],
    },
    {
      id: 'morningstar-ss-10l', name: 'Morningstar SunSaver SS-10L-12V (PWM)', vendor: 'Morningstar (USA)', cat: 'regulator', slots: REG,
      blurb: 'The long-serving 10 A PWM controller of remote telemetry sites, with a low-voltage disconnect.',
      price: { aud: 180.18, gst: true, basis: 'retail', src: 'Australian dealer', asof: '2026-10' },
      power: { w: 0.1 }, temp: [-40, 60],
      grade: 5, gradeWhy: 'decades of remote-site service', support: 'vendor', hw: { a: 10, mppt: false }, lifeYears: 15, status: 'current',
      pros: ['Bulletproof, potted electronics'], cons: ['PWM wastes about 10–15% against MPPT'],
      src: [['Morningstar SunSaver', 'https://www.morningstarcorp.com/products/sunsaver/']], conf: 'high', tags: [],
    },
    {
      id: 'campbell-ch150', name: 'Campbell Scientific CH150 regulator', vendor: 'Campbell Scientific', cat: 'regulator', slots: REG,
      blurb: 'A 12 V charging regulator with temperature-compensated float and 0.16 mA of its own — for up to about 60 W of panel.',
      price: { aud: null, basis: 'quote', src: 'Campbell Scientific Australia' },
      power: { w: 0.002 }, temp: [-40, 60],
      grade: 5, gradeWhy: 'Campbell', support: 'vendor', hw: { a: 4, mppt: false }, lifeYears: 15, status: 'current',
      pros: ['Frugal and temperature-compensated'], cons: ['4 A: small panels only'],
      src: [['CH150', 'https://www.campbellsci.com/ch150']], conf: 'high', tags: [],
    },
    // ── batteries ───────────────────────────────────────────────────────────
    {
      id: 'agm-12v-7ah', name: '12 V 7 Ah AGM (Power-Sonic)', vendor: 'Power-Sonic', cat: 'battery', slots: BAT,
      blurb: 'The alarm-panel battery: enough for a frugal logger for a fortnight.',
      price: { aud: 33, gst: true, basis: 'retail', src: 'Australian retailer', asof: '2026-10' },
      grade: 4, gradeWhy: 'industrial standby battery brand', support: 'limited',
      hw: { ah: 7, chem: 'agm', dod: 0.5, v: 12 }, lifeYears: 3, status: 'current',
      pros: ['Cheap, everywhere'], cons: ['Heat halves its life again and again'], src: [], conf: 'medium', tags: [],
    },
    {
      id: 'agm-12v-18ah', name: '12 V 18 Ah AGM', vendor: 'Century, Ultracell and others', cat: 'battery', slots: BAT,
      blurb: 'The usual field-station battery size.',
      price: { aud: 80, gst: true, basis: 'estimate', src: 'typical Australian retail', asof: '2026-10' },
      grade: 4, gradeWhy: 'telecom/standby-grade AGM', support: 'limited',
      hw: { ah: 18, chem: 'agm', dod: 0.5, v: 12 }, lifeYears: 4, status: 'current', def: true,
      pros: ['Tolerant of trickle charging'], cons: ['50% usable', 'Short life in a hot box'], src: [], conf: 'low', tags: [],
    },
    {
      id: 'agm-12v-40ah', name: '12 V 40 Ah AGM', vendor: 'Century, Ultracell and others', cat: 'battery', slots: BAT,
      blurb: 'For a repeater or a two-week autonomy target.',
      price: { aud: 170, gst: true, basis: 'estimate', src: 'typical Australian retail', asof: '2026-10' },
      grade: 4, gradeWhy: 'telecom/standby-grade AGM', support: 'limited',
      hw: { ah: 40, chem: 'agm', dod: 0.5, v: 12 }, lifeYears: 4, status: 'current',
      pros: [], cons: ['14 kg'], src: [], conf: 'low', tags: [],
    },
    {
      id: 'victron-agm-110ah', name: 'Victron 12 V 110 Ah AGM deep cycle', vendor: 'Victron Energy', cat: 'battery', slots: BAT,
      blurb: 'A big deep-cycle AGM for a hungry site.',
      price: { aud: 404.28, gst: true, basis: 'retail', src: 'Australian Victron dealer', asof: '2026-10' },
      grade: 4, gradeWhy: 'deep-cycle AGM', support: 'vendor',
      hw: { ah: 110, chem: 'agm', dod: 0.5, v: 12 }, lifeYears: 4, status: 'current',
      pros: ['Deep-cycle rated'], cons: ['32 kg up a hill'], src: [['Victron AGM', 'https://www.victronenergy.com/upload/documents/Datasheet-GEL-and-AGM-Batteries-IT.pdf']], conf: 'high', tags: [],
    },
    {
      id: 'lfp-12v-12ah', name: '12 V 12 Ah LiFePO4 with low-temperature protection', vendor: 'various Australian brands', cat: 'battery', slots: BAT,
      blurb: 'Lithium iron phosphate: 80% usable, a decade of cycles, a third the weight — and a BMS that stops charging below 0 °C.',
      price: { aud: 110, gst: true, basis: 'estimate', src: 'typical Australian retail', asof: '2026-10' },
      grade: 3, gradeWhy: 'good cells with a BMS', support: 'limited',
      hw: { ah: 12, chem: 'lfp', dod: 0.8, v: 12.8 }, lifeYears: 10, status: 'current',
      pros: ['Lasts the life of the site', 'Tolerates heat far better than lead-acid'], cons: ['Must not charge below 0 °C', 'Needs a lithium charge profile'], src: [], conf: 'low', tags: [],
    },
    {
      id: 'lfp-12v-20ah', name: '12 V 20 Ah LiFePO4 with low-temperature protection', vendor: 'various Australian brands', cat: 'battery', slots: BAT,
      blurb: 'A field station\'s LiFePO4: the energy of a 32 Ah AGM in a third of the weight.',
      price: { aud: 160, gst: true, basis: 'estimate', src: 'typical Australian retail', asof: '2026-10' },
      grade: 3, gradeWhy: 'good cells with a BMS', support: 'limited',
      hw: { ah: 20, chem: 'lfp', dod: 0.8, v: 12.8 }, lifeYears: 10, status: 'current',
      pros: ['A decade of life'], cons: ['Lithium charge profile'], src: [], conf: 'low', tags: [],
    },
    {
      id: 'exotronic-alpha-50ah', name: 'Exotronic Alpha 12 V 50 Ah LiFePO4 (IP67, Bluetooth)', vendor: 'Exotronic (Australia)', cat: 'battery', slots: BAT,
      blurb: 'An IP67 LiFePO4 with Bluetooth monitoring.',
      price: { aud: 239, gst: true, basis: 'retail', src: 'Exotronic', asof: '2026-10' },
      grade: 3, gradeWhy: 'Australian brand LiFePO4', support: 'vendor',
      hw: { ah: 50, chem: 'lfp', dod: 0.8, v: 12.8 }, lifeYears: 10, status: 'current',
      pros: ['Bluetooth state of charge'], cons: [], src: [['Exotronic', 'https://www.exotronic.com.au/']], conf: 'medium', tags: [],
    },
    {
      id: 'itechworld-100ah', name: 'iTechworld iTECH100 12 V 100 Ah LiFePO4', vendor: 'iTechworld (Australia)', cat: 'battery', slots: BAT,
      blurb: 'A 100 Ah LiFePO4 at an AGM\'s price — for a Pi on solar or a repeater.',
      price: { aud: 399, gst: true, basis: 'retail', src: 'iTechworld', asof: '2026-10' },
      grade: 2, gradeWhy: 'consumer lithium brand', support: 'limited',
      hw: { ah: 100, chem: 'lfp', dod: 0.8, v: 12.8 }, lifeYears: 8, status: 'current',
      pros: ['80 Ah usable for $400'], cons: ['Check its low-temperature protection'], src: [['iTechworld', 'https://www.itechworld.com.au/']], conf: 'medium', tags: [],
    },
    {
      id: 'enerdrive-btec-100ah', name: 'Enerdrive B-TEC Ultra 12 V 100 Ah LiFePO4', vendor: 'Enerdrive (Australia)', cat: 'battery', slots: BAT,
      blurb: 'A premium IP67 LiFePO4 with Bluetooth and a strong warranty.',
      price: { aud: 1199, gst: true, basis: 'retail', src: 'Enerdrive dealers', asof: '2026-10' },
      grade: 4, gradeWhy: 'premium Australian LiFePO4', support: 'vendor',
      hw: { ah: 100, chem: 'lfp', dod: 0.8, v: 12.8 }, lifeYears: 12, status: 'current',
      pros: ['Warranty and support'], cons: ['Three times the budget brands'], src: [['Enerdrive', 'https://www.enerdrive.com.au/']], conf: 'high', tags: [],
    },
    // ── 12 V → 5 V converters ───────────────────────────────────────────────
    {
      id: 'meanwell-ddr-15g-5', name: 'Mean Well DDR-15G-5 (9–36 V in, 5 V 3 A)', vendor: 'Mean Well', cat: 'dcdc', kind: '12to5',
      blurb: 'A DIN-rail DC-DC converter that holds 5 V for a Pi 3 or 4 from a 12 V battery, −40 to +85 °C.',
      price: { aud: 48.05, gst: true, basis: 'retail', src: 'Power Supplies Australia', url: 'https://www.power-supplies-australia.com.au/', asof: '2026-10' },
      power: { eff: 0.86 }, temp: [-40, 85], grade: 4, gradeWhy: 'Mean Well industrial', support: 'vendor',
      hw: { watts: 15 }, lifeYears: 12, status: 'current', def: true,
      pros: ['Industrial, wide input, DIN rail'], cons: ['15 W: too little for a Pi 5 with USB devices'],
      src: [['DDR-15 datasheet', 'https://www.meanwell.com/']], conf: 'high', tags: [],
    },
    {
      id: 'meanwell-ddr-30g-5', name: 'Mean Well DDR-30G-5 (9–36 V in, 5 V 6 A)', vendor: 'Mean Well', cat: 'dcdc', kind: '12to5',
      blurb: 'The 30 W version — what a Pi 5 or a Pi with several SDR sticks wants.',
      price: { aud: 78.07, gst: true, basis: 'retail', src: 'Power Supplies Australia', asof: '2026-10' },
      power: { eff: 0.88 }, temp: [-40, 85], grade: 4, gradeWhy: 'Mean Well industrial', support: 'vendor',
      hw: { watts: 30 }, lifeYears: 12, status: 'current',
      pros: ['Headroom for USB peripherals'], cons: [], src: [['DDR-30 datasheet', 'https://www.meanwell.com/']], conf: 'high', tags: [],
    },
    {
      id: 'pololu-d36v28f5', name: 'Pololu D36V28F5 5 V 3.2 A regulator', vendor: 'Pololu', cat: 'dcdc', kind: '12to5',
      blurb: 'A small, efficient synchronous buck module (5.3–50 V in) for a Pi in a custom enclosure.',
      price: usd(23.95, 'Pololu'), power: { eff: 0.9 }, temp: [-40, 85], grade: 3, gradeWhy: 'quality module', support: 'limited',
      hw: { watts: 16 }, lifeYears: 10, status: 'current',
      pros: ['Efficient, tiny'], cons: ['A bare board to mount and protect'], src: [['Pololu D36V28F5', 'https://www.pololu.com/product/3782']], conf: 'high', tags: [],
    },
    {
      id: 'lm2596-module', name: 'Generic LM2596 buck module', vendor: 'unbranded', cat: 'dcdc', kind: '12to5',
      blurb: 'The $5 adjustable buck converter — the classic cause of a Pi browning out under load.',
      price: { aud: 6, gst: true, basis: 'estimate', src: 'typical online price' }, power: { eff: 0.8 }, temp: [-20, 70], grade: 1, gradeWhy: 'unbranded; poor regulation under load', support: 'none',
      hw: { watts: 10 }, lifeYears: 3, status: 'current',
      pros: ['Cheap'], cons: ['Sags under USB load; fakes abound — the under-voltage banner\'s favourite cause'], src: [], conf: 'medium', tags: [],
    },
    // ── mains supplies ──────────────────────────────────────────────────────
    {
      id: 'rpi-27w-psu', name: 'Raspberry Pi 27 W USB-C supply', vendor: 'Raspberry Pi Ltd', cat: 'psu', kind: 'psu5',
      blurb: 'The Pi 5\'s supply (5.1 V 5 A, USB-PD): without it USB devices are current-limited.',
      price: { aud: 25.37, gst: true, basis: 'retail', src: 'Australian retailer', asof: '2026-10' },
      grade: 3, gradeWhy: 'official supply', support: 'vendor', hw: { for: ['pi5'] }, lifeYears: 8, status: 'current', def: true,
      pros: ['The one that does not brown out'], cons: [], src: [['Raspberry Pi 27 W', 'https://www.raspberrypi.com/products/27w-power-supply/']], conf: 'high', tags: [],
    },
    {
      id: 'rpi-15w-psu', name: 'Raspberry Pi 15 W USB-C supply', vendor: 'Raspberry Pi Ltd', cat: 'psu', kind: 'psu5',
      blurb: 'The Pi 4\'s supply (5.1 V 3 A): under-voltage is the commonest cause of a "flaky receiver".',
      price: { aud: 24.05, gst: true, basis: 'retail', src: 'Australian retailer', asof: '2026-10' },
      grade: 3, gradeWhy: 'official supply', support: 'vendor', hw: { for: ['pi4'] }, lifeYears: 8, status: 'current', def: true,
      pros: ['Holds 5.1 V under load'], cons: [], src: [['Raspberry Pi 15 W', 'https://www.raspberrypi.com/products/type-c-power-supply/']], conf: 'high', tags: [],
    },
    {
      id: 'rpi-12w5-micro-psu', name: 'Raspberry Pi 12.5 W micro-USB supply', vendor: 'Raspberry Pi Ltd', cat: 'psu', kind: 'psu5',
      blurb: 'For the micro-USB Pis: the 3B+ and the Zero 2 W.',
      price: { aud: 16, gst: true, basis: 'estimate', src: 'typical Australian retail', asof: '2026-10' },
      grade: 3, gradeWhy: 'official supply', support: 'vendor', hw: { for: ['microusb'] }, lifeYears: 8, status: 'current', def: true,
      pros: [], cons: [], src: [['Raspberry Pi supplies', 'https://www.raspberrypi.com/products/micro-usb-power-supply/']], conf: 'medium', tags: [],
    },
    {
      id: 'meanwell-hdr-30-12', name: 'Mean Well HDR-30-12 DIN-rail 12 V supply', vendor: 'Mean Well', cat: 'psu', kind: 'psu12',
      blurb: 'An ultra-slim 30 W DIN-rail supply for a 12–24 V industrial computer or gateway.',
      price: { aud: 33.78, gst: true, basis: 'retail', src: 'Power Supplies Australia', asof: '2026-10' },
      grade: 4, gradeWhy: 'Mean Well industrial', support: 'vendor', hw: { watts: 30 }, lifeYears: 12, status: 'current', def: true,
      pros: ['DIN rail, cheap, reliable'], cons: ['Mains wiring: an electrician\'s job'], src: [['HDR-30', 'https://www.meanwell.com/']], conf: 'high', tags: [],
    },
    {
      id: 'meanwell-hdr-60-12', name: 'Mean Well HDR-60-12 DIN-rail 12 V supply', vendor: 'Mean Well', cat: 'psu', kind: 'psu12',
      blurb: '60 W for a gateway, a computer and a router on one rail.',
      price: { aud: 48.05, gst: true, basis: 'retail', src: 'Power Supplies Australia', asof: '2026-10' },
      grade: 4, gradeWhy: 'Mean Well industrial', support: 'vendor', hw: { watts: 60 }, lifeYears: 12, status: 'current',
      pros: [], cons: [], src: [['HDR-60', 'https://www.meanwell.com/']], conf: 'high', tags: [],
    },
    {
      id: 'meanwell-drc-40a', name: 'Mean Well DRC-40A (13.8 V supply + battery charger)', vendor: 'Mean Well', cat: 'psu', kind: 'charger',
      slots: ['field:psu', 'repeater:psu', 'base:psu'],
      blurb: 'A DIN-rail "security" supply: runs the site at 13.8 V from mains and keeps a 12 V battery charged for when the mains goes.',
      price: { aud: 83.31, gst: true, basis: 'retail', src: 'Power Supplies Australia', url: 'https://www.power-supplies-australia.com.au/mean-well-drc-40a-power-supply', asof: '2026-10' },
      power: { w: 1 }, temp: [-30, 70], grade: 4, gradeWhy: 'Mean Well industrial', support: 'vendor', hw: { watts: 40 }, lifeYears: 12, status: 'current', def: true,
      pros: ['AC-OK and battery-low alarms to the logger'], cons: ['Mains wiring: an electrician\'s job'], src: [['DRC-40', 'https://www.meanwell.com/']], conf: 'high', tags: [],
    },
    {
      id: 'meanwell-drc-60a', name: 'Mean Well DRC-60A (13.8 V supply + battery charger)', vendor: 'Mean Well', cat: 'psu', kind: 'charger',
      slots: ['field:psu', 'repeater:psu', 'base:psu'],
      blurb: 'The 60 W version.',
      price: { aud: 85.62, gst: true, basis: 'retail', src: 'Power Supplies Australia', asof: '2026-10' },
      power: { w: 1.2 }, temp: [-30, 70], grade: 4, gradeWhy: 'Mean Well industrial', support: 'vendor', hw: { watts: 60 }, lifeYears: 12, status: 'current',
      pros: ['Room for a router and a computer'], cons: [], src: [['DRC-60', 'https://www.meanwell.com/']], conf: 'high', tags: [],
    },
    // ── UPS ─────────────────────────────────────────────────────────────────
    {
      id: 'dc-ups-drc60-18ah', name: 'DC UPS: Mean Well DRC-60A with a 12 V 18 Ah AGM', vendor: 'Mean Well + battery', cat: 'ups', slots: ['base:ups'],
      blurb: 'The efficient way to back up a 5–15 W base: 13.8 V DC straight to a 12 V computer (or a 5 V converter), no inverter burning watts.',
      price: { aud: 166, gst: true, basis: 'estimate', src: 'DRC-60A A$85.62 + an 18 Ah AGM about A$80', asof: '2026-10' },
      power: { w: 0 }, temp: [-20, 50], grade: 4, gradeWhy: 'industrial DC UPS', support: 'vendor',
      hw: { wh: 216, selfW: 1.2, dc: true }, lifeYears: 5, status: 'current', def: true,
      pros: ['Hours more runtime than a mains UPS of the same battery', 'Battery-low alarm'], cons: ['Mains wiring: an electrician\'s job', 'The battery needs replacing every 4–5 years'],
      src: [['DRC-60', 'https://www.meanwell.com/']], conf: 'medium', tags: [],
    },
    {
      id: 'eaton-5e650', name: 'Eaton 5E 650 VA UPS', vendor: 'Eaton', cat: 'ups', slots: ['base:ups'],
      blurb: 'A small line-interactive mains UPS: plug the computer\'s supply into it.',
      price: { aud: 119, gst: true, basis: 'retail', src: 'staticice.com.au', asof: '2026-10' },
      power: { w: 0 }, temp: [0, 40], grade: 2, gradeWhy: 'office UPS', support: 'vendor',
      hw: { wh: 84, selfW: 8 }, lifeYears: 4, status: 'current',
      pros: ['No wiring'], cons: ['Its inverter burns about as much as the Pi it protects'], src: [['Eaton 5E', 'https://www.eaton.com/']], conf: 'medium', tags: [],
    },
    {
      id: 'cyberpower-vp1000', name: 'CyberPower Value Pro VP1000ELCD', vendor: 'CyberPower', cat: 'ups', slots: ['base:ups'],
      blurb: '1000 VA line-interactive UPS for a base with a router and a PC.',
      price: { aud: 179, gst: true, basis: 'retail', src: 'staticice.com.au', asof: '2026-10' },
      power: { w: 0 }, temp: [0, 40], grade: 2, gradeWhy: 'office UPS', support: 'vendor',
      hw: { wh: 150, selfW: 10 }, lifeYears: 4, status: 'current',
      pros: ['Enough for a PC and a router'], cons: ['Batteries every 3–4 years'], src: [['CyberPower', 'https://www.cyberpower.com/']], conf: 'medium', tags: [],
    },
    {
      id: 'apc-bx950mi', name: 'APC Back-UPS BX950MI', vendor: 'APC (Schneider Electric)', cat: 'ups', slots: ['base:ups'],
      blurb: '950 VA with automatic voltage regulation.',
      price: { aud: 175, gst: true, basis: 'retail', src: 'staticice.com.au', asof: '2026-10' },
      power: { w: 0 }, temp: [0, 40], grade: 2, gradeWhy: 'office UPS', support: 'vendor',
      hw: { wh: 108, selfW: 9 }, lifeYears: 4, status: 'current',
      pros: ['A brand IT departments know'], cons: [], src: [['APC Back-UPS', 'https://www.apc.com/']], conf: 'medium', tags: [],
    },
    {
      id: 'geekworm-x1200', name: 'Geekworm X1200 UPS HAT for Pi 5 (2 × 18650)', vendor: 'Geekworm', cat: 'ups', slots: ['base:ups'],
      blurb: 'A Pi 5 UPS board with two 18650 cells (bought separately) and safe-shutdown signalling.',
      price: usd(45, 'Geekworm'), power: { w: 0 }, temp: [0, 45], grade: 1, gradeWhy: 'maker board with lithium cells', support: 'limited',
      hw: { wh: 21, selfW: 0.3, for: ['pi5'] }, lifeYears: 3, status: 'current',
      pros: ['Rides out a short outage and shuts down cleanly'], cons: ['An hour or two at best', 'Lithium cells in a hot box'], src: [['Geekworm X1200', 'https://geekworm.com/']], conf: 'medium', tags: [],
    },
    {
      id: 'waveshare-ups-hat-d', name: 'Waveshare UPS HAT (D)', vendor: 'Waveshare', cat: 'ups', slots: ['base:ups'],
      blurb: 'A Pi UPS HAT on lithium cells with a fuel gauge over I²C.',
      price: usd(24.99, 'Waveshare'), power: { w: 0 }, temp: [0, 45], grade: 1, gradeWhy: 'maker board', support: 'limited',
      hw: { wh: 20, selfW: 0.3, for: ['pi4', 'pi5', 'pi'] }, lifeYears: 3, status: 'current',
      pros: ['Cheap'], cons: ['Short runtime'], src: [['Waveshare UPS HAT', 'https://www.waveshare.com/']], conf: 'low', tags: [],
    },
  ];
  if (typeof module === 'object' && module.exports) module.exports = items;
  else (globalThis.OA_CATALOG = globalThis.OA_CATALOG || []).push(...items);
})();
