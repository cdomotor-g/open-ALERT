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
    panel('victron-20w', 'Victron 20 W mono panel', 'Victron Energy', 20, 51.48, 'Solar 4 RVs', 4, { def: true,
      price: { aud: 51.48, gst: true, basis: 'retail', src: 'Solar 4 RVs (Victron dealer): A$51.48 inc GST, In Stock. Regular Australia Post A$19.56 (freight from the shop\'s own checkout calculator for one, to Brisbane 4000); A$23.23 to Longreach', url: 'https://www.solar4rvs.com.au/products/victron-solar-panel-20w-12v-mono', asof: '2026-11', shop: 'Solar 4 RVs', from: 'AU', stock: 'in', ship: 19.56 }, src: [['Solar 4 RVs: Victron 20 W panel', 'https://www.solar4rvs.com.au/products/victron-solar-panel-20w-12v-mono'], ['Solar 4 RVs shipping policy (freight quoted live by its checkout)', 'https://www.solar4rvs.com.au/policies/shipping-policy']] }),
    panel('victron-30w', 'Victron 30 W mono panel', 'Victron Energy', 30, 59.4, 'Solar 4 RVs', 4, {
      price: { aud: 59.4, gst: true, basis: 'retail', src: 'Solar 4 RVs (Victron dealer): A$59.40 inc GST, In Stock. Regular Australia Post A$11.88 (freight from the shop\'s own checkout calculator for one, to Brisbane 4000); A$15.55 to Longreach', url: 'https://www.solar4rvs.com.au/products/victron-solar-panel-30w-12v-mono', asof: '2026-11', shop: 'Solar 4 RVs', from: 'AU', stock: 'in', ship: 11.88 }, src: [['Solar 4 RVs: Victron 30 W panel', 'https://www.solar4rvs.com.au/products/victron-solar-panel-30w-12v-mono'], ['Solar 4 RVs shipping policy (freight quoted live by its checkout)', 'https://www.solar4rvs.com.au/policies/shipping-policy']] }),
    panel('victron-40w', 'Victron 40 W mono panel', 'Victron Energy', 40, 76.23, 'Solar 4 RVs', 4, {
      price: { aud: 76.23, gst: true, basis: 'retail', src: 'Solar 4 RVs (Victron dealer): A$76.23 inc GST, In Stock. Courier A$23.00 (freight from the shop\'s own checkout calculator for one, to Brisbane 4000); A$60.05 by Australia Post to Longreach', url: 'https://www.solar4rvs.com.au/products/victron-solar-panel-40w-12v-mono', asof: '2026-11', shop: 'Solar 4 RVs', from: 'AU', stock: 'in', ship: 23.0 }, src: [['Solar 4 RVs: Victron 40 W panel', 'https://www.solar4rvs.com.au/products/victron-solar-panel-40w-12v-mono'], ['Solar 4 RVs shipping policy (freight quoted live by its checkout)', 'https://www.solar4rvs.com.au/policies/shipping-policy']] }),
    panel('victron-190w', 'Victron 190 W mono panel', 'Victron Energy', 190, 196.71, 'Solar 4 RVs', 4, { blurb: '190 W, 12 V nominal — for a hungry repeater, a Starlink, or a Pi on solar.',
      price: { aud: 196.71, gst: true, basis: 'retail', src: 'Solar 4 RVs (Victron dealer): A$196.71 inc GST, In Stock. A 10.5 kg panel goes by courier: A$36.14 (freight from the shop\'s own checkout calculator for one, to Brisbane 4000); A$101.85 to Longreach', url: 'https://www.solar4rvs.com.au/products/victron-solar-panel-190w-12v-mono', asof: '2026-11', shop: 'Solar 4 RVs', from: 'AU', stock: 'in', ship: 36.14 }, src: [['Solar 4 RVs: Victron 190 W panel', 'https://www.solar4rvs.com.au/products/victron-solar-panel-190w-12v-mono'], ['Solar 4 RVs shipping policy (freight quoted live by its checkout)', 'https://www.solar4rvs.com.au/policies/shipping-policy']] }),
    panel('exotronic-20w', 'Exotronic Fusion 20 W panel', 'Exotronic (Australia)', 20, 59, 'Solar 4 RVs', 2, {
      price: { aud: 59, gst: true, basis: 'retail', src: 'Solar 4 RVs and Exotronic (one business, one catalogue): In Stock at a regular price of A$59 inc GST. Both shops show A$224.10 during their Black Friday sale (to 30 Nov 2026) — the 200 W panel\'s sale price, apparently an error, so confirm before ordering; the sale\'s 10% off would make it A$53.10. Regular Australia Post quoted free to Brisbane 4000 and Longreach at the listed price', url: 'https://www.solar4rvs.com.au/products/exotronic-20w-fusion-fixed-solar-panel', asof: '2026-11', shop: 'Solar 4 RVs', from: 'AU', stock: 'in', ship: 0 }, src: [['Solar 4 RVs: Exotronic 20 W Fusion panel', 'https://www.solar4rvs.com.au/products/exotronic-20w-fusion-fixed-solar-panel'], ['Exotronic: 20 W Fusion panel', 'https://www.exotronic.com.au/products/exotronic-20w-fusion-fixed-solar-panel'], ['Solar 4 RVs shipping policy (freight quoted live by its checkout)', 'https://www.solar4rvs.com.au/policies/shipping-policy']] }),
    panel('exotronic-50w', 'Exotronic Fusion 50 W panel', 'Exotronic (Australia)', 50, 62.1, 'Solar 4 RVs', 2, {
      price: { aud: 62.1, gst: true, basis: 'retail', src: 'Solar 4 RVs and Exotronic (one business): A$62.10 inc GST, In Stock — Black Friday price to 30 Nov 2026, regularly A$69. Regular Australia Post A$7.70 (freight from the shop\'s own checkout calculator for one, to Brisbane 4000); A$10.02 to Longreach', url: 'https://www.solar4rvs.com.au/products/exotronic-50w-fusion-fixed-solar-panel', asof: '2026-11', shop: 'Solar 4 RVs', from: 'AU', stock: 'in', ship: 7.7 }, src: [['Solar 4 RVs: Exotronic 50 W Fusion panel', 'https://www.solar4rvs.com.au/products/exotronic-50w-fusion-fixed-solar-panel'], ['Solar 4 RVs shipping policy (freight quoted live by its checkout)', 'https://www.solar4rvs.com.au/policies/shipping-policy']] }),
    panel('exotronic-115w', 'Exotronic Fusion 115 W panel', 'Exotronic (Australia)', 115, 189, 'Solar 4 RVs', 2, {
      price: { aud: 189, gst: true, basis: 'retail', src: 'Solar 4 RVs and Exotronic (one business): the 115 W Narrow Fusion panel is In Stock at a regular price of A$189 inc GST. Both shops show A$224.10 during their Black Friday sale (to 30 Nov 2026), more than the regular price — apparently an error, so confirm before ordering; 10% off would make it A$170.10. Courier quoted free to Brisbane 4000 and Longreach at the listed price', url: 'https://www.solar4rvs.com.au/products/exotronic-115w-narrow-fusion-fixed-solar-panel', asof: '2026-11', shop: 'Solar 4 RVs', from: 'AU', stock: 'in', ship: 0 }, src: [['Solar 4 RVs: Exotronic 115 W Narrow Fusion panel', 'https://www.solar4rvs.com.au/products/exotronic-115w-narrow-fusion-fixed-solar-panel'], ['Solar 4 RVs shipping policy (freight quoted live by its checkout)', 'https://www.solar4rvs.com.au/policies/shipping-policy']] }),
    panel('campbell-sp10', 'Campbell Scientific SP10 10 W panel', 'Campbell Scientific', 10, null, 'Campbell Scientific Australia', 5,
      { blurb: '10 W with a mount rated for 58 m/s winds — the panel on a Campbell gauge.', gradeWhy: 'hydromet-rated mounting' }),
    // ── charge controllers ──────────────────────────────────────────────────
    {
      id: 'victron-mppt-75-10', name: 'Victron SmartSolar MPPT 75/10', vendor: 'Victron Energy', cat: 'regulator', slots: REG,
      blurb: 'A 10 A MPPT controller with Bluetooth monitoring and a load output with low-voltage disconnect.',
      price: { aud: 79.84, gst: true, basis: 'retail', src: 'Solar 4 RVs (Victron dealer): A$79.84 inc GST, In Stock. Regular Australia Post free (freight from the shop\'s own checkout calculator for one, to Brisbane 4000); A$7.70 to Longreach', url: 'https://www.solar4rvs.com.au/products/victron-smartsolar-mppt-75v-10a-12v-24v-bluetooth-solar-charge-controller', asof: '2026-11', shop: 'Solar 4 RVs', from: 'AU', stock: 'in', ship: 0 },
      power: { w: 0.12 }, temp: [-30, 60],
      grade: 4, gradeWhy: 'Victron: the standard small MPPT', support: 'vendor',
      hw: { a: 10, mppt: true }, lifeYears: 12, status: 'current', def: true,
      pros: ['MPPT for its price', 'Bluetooth: read it from the gate'], cons: ['10–19 mA of its own — at a 2 mA logger site, five times the logger'],
      src: [['Victron MPPT 75/10 datasheet', 'https://www.victronenergy.com/upload/documents/Datasheet-SmartSolar-charge-controller-MPPT-75-10,-75-15,-100-15,-100-20_48V-EN.pdf'], ['Solar 4 RVs: SmartSolar MPPT 75/10', 'https://www.solar4rvs.com.au/products/victron-smartsolar-mppt-75v-10a-12v-24v-bluetooth-solar-charge-controller'], ['Solar 4 RVs shipping policy (freight quoted live by its checkout)', 'https://www.solar4rvs.com.au/policies/shipping-policy']], conf: 'high', tags: [],
    },
    {
      id: 'victron-mppt-75-15', name: 'Victron SmartSolar MPPT 75/15', vendor: 'Victron Energy', cat: 'regulator', slots: REG,
      blurb: 'The 15 A sibling, for up to about 200 W of panel.',
      price: { aud: 86.63, gst: true, basis: 'retail', src: 'Solar 4 RVs (Victron dealer): A$86.63 inc GST, In Stock. Award RV lists it at A$80 but on back-order. Regular Australia Post free (freight from the shop\'s own checkout calculator for one, to Brisbane 4000) and to Longreach', url: 'https://www.solar4rvs.com.au/products/victron-smartsolar-mppt-75v-15a-12v-24v-bluetooh-solar-charge-controller', asof: '2026-11', shop: 'Solar 4 RVs', from: 'AU', stock: 'in', ship: 0 },
      power: { w: 0.12 }, temp: [-30, 60],
      grade: 4, gradeWhy: 'Victron', support: 'vendor', hw: { a: 15, mppt: true }, lifeYears: 12, status: 'current',
      pros: ['Headroom for a repeater\'s panel'], cons: ['Same self-draw as the 75/10'],
      src: [['Victron MPPT 75/15', 'https://www.victronenergy.com/solar-charge-controllers/smartsolar-mppt-75-10-75-15-100-15-100-20'], ['Solar 4 RVs: SmartSolar MPPT 75/15', 'https://www.solar4rvs.com.au/products/victron-smartsolar-mppt-75v-15a-12v-24v-bluetooh-solar-charge-controller'], ['Award RV: SmartSolar MPPT 75/15 (back-ordered)', 'https://www.awardrv.com.au/products/victron-energy-smart-mppt-controller-75-15'], ['Solar 4 RVs shipping policy (freight quoted live by its checkout)', 'https://www.solar4rvs.com.au/policies/shipping-policy']], conf: 'high', tags: [],
    },
    {
      id: 'genasun-gv-10', name: 'Genasun GV-10 MPPT', vendor: 'Genasun (USA)', cat: 'regulator', slots: REG,
      blurb: 'A 10.5 A MPPT built for remote telemetry: under a milliamp at night, 98% efficient, lithium or lead-acid versions.',
      price: { aud: 202.5, gst: true, basis: 'retail', src: 'Solar 4 RVs: GV-10 (lithium version) A$202.50 inc GST, In Stock — Black Friday price to 30 Nov 2026, regularly A$225. Regular Australia Post free (freight from the shop\'s own checkout calculator for one, to Brisbane 4000) and to Longreach', url: 'https://www.solar4rvs.com.au/products/genasun-10-5a-mppt-12v-14-2v-lithium', asof: '2026-11', shop: 'Solar 4 RVs', from: 'AU', stock: 'in', ship: 0 },
      power: { w: 0.011 }, temp: [-40, 85],
      grade: 5, gradeWhy: 'telemetry-grade MPPT', support: 'vendor', hw: { a: 10.5, mppt: true }, lifeYears: 15, status: 'current',
      pros: ['0.9 mA of its own', '−40 to +85 °C'], cons: ['No monitoring port', 'Choose the lithium or lead-acid version to match the battery'],
      src: [['Genasun GV-10', 'https://www.solar4rvs.com.au/products/genasun-10-5a-mppt-12v-14-2v-lithium'], ['Solar 4 RVs shipping policy (freight quoted live by its checkout)', 'https://www.solar4rvs.com.au/policies/shipping-policy']], conf: 'high', tags: [],
    },
    {
      id: 'morningstar-ss-10l', name: 'Morningstar SunSaver SS-10L-12V (PWM)', vendor: 'Morningstar (USA)', cat: 'regulator', slots: REG,
      blurb: 'The long-serving 10 A PWM controller of remote telemetry sites, with a low-voltage disconnect.',
      price: { aud: 187, gst: true, basis: 'retail', src: 'Solar 4 RVs: SS-10L-12V A$187 inc GST, Special Order (no stock on hand). No Australian shop was found with it in stock; the check ended before every dealer could be searched. Regular Australia Post A$7.70 (freight from the shop\'s own checkout calculator for one, to Brisbane 4000) and to Longreach', url: 'https://www.solar4rvs.com.au/products/morningstar-sunsaver-10amp-12v-led', asof: '2026-11', shop: 'Solar 4 RVs', from: 'AU', stock: 'order', ship: 7.7 },
      power: { w: 0.1 }, temp: [-40, 60],
      grade: 5, gradeWhy: 'decades of remote-site service', support: 'vendor', hw: { a: 10, mppt: false }, lifeYears: 15, status: 'current',
      pros: ['Bulletproof, potted electronics'], cons: ['PWM wastes about 10–15% against MPPT'],
      src: [['Morningstar SunSaver', 'https://www.morningstarcorp.com/products/sunsaver/'], ['Solar 4 RVs: SunSaver SS-10L-12V', 'https://www.solar4rvs.com.au/products/morningstar-sunsaver-10amp-12v-led'], ['Solar 4 RVs shipping policy (freight quoted live by its checkout)', 'https://www.solar4rvs.com.au/policies/shipping-policy']], conf: 'high', tags: [],
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
      price: { aud: 27.5, gst: true, basis: 'retail', src: 'Radio Parts: Power-Sonic PS1270 A$27.50 inc GST, 5 in stock. Road freight A$10 per 10 kg to metro areas (Brisbane included), A$20 per 10 kg to rural Queensland. Cheaper non-Power-Sonic 7 Ah AGMs exist (Auscell A$23.65 + A$13 freight at Battery Specialists); SCHNAP has the PS-1270 at A$37.80 but delivers only orders over A$150', url: 'https://www.radioparts.com.au/product/03294160/ps1270-7ah-12v-sla-battery-f1-terminal-sealed-lead-acid', asof: '2026-11', shop: 'Radio Parts', from: 'AU', stock: 'in', ship: 10 },
      grade: 4, gradeWhy: 'industrial standby battery brand', support: 'limited',
      hw: { ah: 7, chem: 'agm', dod: 0.5, v: 12 }, lifeYears: 3, status: 'current',
      pros: ['Cheap, everywhere'], cons: ['Heat halves its life again and again'], src: [['Radio Parts: Power-Sonic PS1270', 'https://www.radioparts.com.au/product/03294160/ps1270-7ah-12v-sla-battery-f1-terminal-sealed-lead-acid'], ['Radio Parts freight rates', 'https://www.radioparts.com.au/freight'], ['Battery Specialists: Auscell 12 V 7 Ah', 'https://batteryspecialists.com.au/products/auscell-12v-7ah-sla-agm-battery-f1-terminals'], ['SCHNAP: Power-Sonic PS-1270', 'https://www.schnap.com.au/12v-7ah-sla-battery-f1-agm-vrla-5-year-power-sonic-ps-1270.html']], conf: 'medium', tags: [],
    },
    {
      id: 'agm-12v-18ah', name: '12 V 18 Ah AGM', vendor: 'Century, Ultracell and others', cat: 'battery', slots: BAT,
      blurb: 'The usual field-station battery size.',
      price: { aud: 79.84, gst: true, basis: 'retail', src: 'Battery Specialists (HBPlus, Carrum Downs VIC): Auscell 12 V 18 Ah AGM A$79.84, In stock; Fusion 18 Ah A$80.30, Power-Sonic PS12180NB A$126. Standard road freight A$20 for this 5 kg battery from the shop\'s checkout calculator, the same to Brisbane 4000 and Longreach. The page does not say GST; Australian consumer prices must include it', url: 'https://batteryspecialists.com.au/products/auscell-12v-18ah-sla-agm-battery', asof: '2026-11', shop: 'Battery Specialists', from: 'AU', stock: 'in', ship: 20 },
      grade: 4, gradeWhy: 'telecom/standby-grade AGM', support: 'limited',
      hw: { ah: 18, chem: 'agm', dod: 0.5, v: 12 }, lifeYears: 4, status: 'current', def: true,
      pros: ['Tolerant of trickle charging'], cons: ['50% usable', 'Short life in a hot box'], src: [['Battery Specialists: Auscell 12 V 18 Ah AGM', 'https://batteryspecialists.com.au/products/auscell-12v-18ah-sla-agm-battery'], ['Battery Specialists shipping policy (freight by weight at checkout)', 'https://batteryspecialists.com.au/policies/shipping-policy']], conf: 'low', tags: [],
    },
    {
      id: 'agm-12v-40ah', name: '12 V 40 Ah AGM', vendor: 'Century, Ultracell and others', cat: 'battery', slots: BAT,
      blurb: 'For a repeater or a two-week autonomy target.',
      price: { aud: 186.74, gst: true, basis: 'retail', src: 'Battery Specialists (HBPlus): Auscell 12 V 40 Ah A$186.74, In stock. Its checkout quotes A$13 road freight only because the listing gives the battery a weight of 1 kg; the shop charges A$25 for a correctly weighed 13.4 kg 40 Ah battery (Drypower 12SB40CL), the same to Brisbane 4000 and Longreach, so A$25 is used here', url: 'https://batteryspecialists.com.au/products/auscell-12v-40ah-sealed-lead-acid-battery', asof: '2026-11', shop: 'Battery Specialists', from: 'AU', stock: 'in', ship: 25 },
      grade: 4, gradeWhy: 'telecom/standby-grade AGM', support: 'limited',
      hw: { ah: 40, chem: 'agm', dod: 0.5, v: 12 }, lifeYears: 4, status: 'current',
      pros: [], cons: ['14 kg'], src: [['Battery Specialists: Auscell 12 V 40 Ah', 'https://batteryspecialists.com.au/products/auscell-12v-40ah-sealed-lead-acid-battery'], ['Battery Specialists: Drypower 12 V 40 Ah (freight reference)', 'https://batteryspecialists.com.au/products/drypower-12sb40cl-12v-40ah-sla-battery'], ['Battery Specialists shipping policy (freight by weight at checkout)', 'https://batteryspecialists.com.au/policies/shipping-policy']], conf: 'low', tags: [],
    },
    {
      id: 'victron-agm-110ah', name: 'Victron 12 V 110 Ah AGM deep cycle', vendor: 'Victron Energy', cat: 'battery', slots: BAT,
      blurb: 'A big deep-cycle AGM for a hungry site.',
      price: { aud: 404.28, gst: true, basis: 'retail', src: 'Solar 4 RVs: Victron 12 V 110 Ah AGM (BAT412101085) A$404.28 inc GST, In Stock at Victron\'s Australian warehouse (up to 5 days before dispatch). Award RV lists it at A$395 but on back-order. A 32 kg battery: the only freight offered is expedited courier, A$150.81 to Brisbane 4000 and A$255.62 to Longreach, from the shop\'s checkout calculator', url: 'https://www.solar4rvs.com.au/products/victron-energy-12v-110ah-agm-deep-cycle-battery-bat412101085', asof: '2026-11', shop: 'Solar 4 RVs', from: 'AU', stock: 'in', ship: 150.81 },
      grade: 4, gradeWhy: 'deep-cycle AGM', support: 'vendor',
      hw: { ah: 110, chem: 'agm', dod: 0.5, v: 12 }, lifeYears: 4, status: 'current',
      pros: ['Deep-cycle rated'], cons: ['32 kg up a hill'], src: [['Victron AGM', 'https://www.victronenergy.com/upload/documents/Datasheet-GEL-and-AGM-Batteries-IT.pdf'], ['Solar 4 RVs: Victron 12 V 110 Ah AGM', 'https://www.solar4rvs.com.au/products/victron-energy-12v-110ah-agm-deep-cycle-battery-bat412101085'], ['Award RV: Victron 12 V 110 Ah AGM (back-ordered)', 'https://www.awardrv.com.au/products/victron-energy-12v110ah-agm-deep-cycle-battery-m8'], ['Solar 4 RVs shipping policy (freight quoted live by its checkout)', 'https://www.solar4rvs.com.au/policies/shipping-policy']], conf: 'high', tags: [],
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
      price: { aud: 159, gst: true, basis: 'retail', src: 'Solar 4 RVs: Exotronic Alpha 12 V 20 Ah IP67 LiFePO4 A$159 inc GST, In Stock — Black Friday price to 30 Nov 2026, regularly A$199. The listing rates charging at 5–45 °C but does not say the BMS stops charging in the cold, so check before relying on it. Lithium goes by courier: A$35.19 to Brisbane 4000, A$88.41 to Longreach (shop\'s checkout calculator)', url: 'https://www.solar4rvs.com.au/products/exotronic-12v-20ah-alpha-ip67-smart-bluetooth-lithium-battery', asof: '2026-11', shop: 'Solar 4 RVs', from: 'AU', stock: 'in', ship: 35.19 },
      grade: 3, gradeWhy: 'good cells with a BMS', support: 'limited',
      hw: { ah: 20, chem: 'lfp', dod: 0.8, v: 12.8 }, lifeYears: 10, status: 'current',
      pros: ['A decade of life'], cons: ['Lithium charge profile'], src: [['Solar 4 RVs: Exotronic Alpha 12 V 20 Ah', 'https://www.solar4rvs.com.au/products/exotronic-12v-20ah-alpha-ip67-smart-bluetooth-lithium-battery'], ['Solar 4 RVs shipping policy (freight quoted live by its checkout)', 'https://www.solar4rvs.com.au/policies/shipping-policy']], conf: 'low', tags: [],
    },
    {
      id: 'exotronic-alpha-50ah', name: 'Exotronic Alpha 12 V 50 Ah LiFePO4 (IP67, Bluetooth)', vendor: 'Exotronic (Australia)', cat: 'battery', slots: BAT,
      blurb: 'An IP67 LiFePO4 with Bluetooth monitoring.',
      price: { aud: 239, gst: true, basis: 'retail', src: 'Solar 4 RVs and Exotronic (one business): A$239 inc GST, In Stock (regularly A$299). Courier A$37.13 (freight from the shop\'s own checkout calculator for one, to Brisbane 4000); A$90.35 to Longreach', url: 'https://www.solar4rvs.com.au/products/exotronic-12v-50ah-alpha-ip67-smart-bluetooth-lithium-battery-copy', asof: '2026-11', shop: 'Solar 4 RVs', from: 'AU', stock: 'in', ship: 37.13 },
      grade: 3, gradeWhy: 'Australian brand LiFePO4', support: 'vendor',
      hw: { ah: 50, chem: 'lfp', dod: 0.8, v: 12.8 }, lifeYears: 10, status: 'current',
      pros: ['Bluetooth state of charge'], cons: [], src: [['Exotronic', 'https://www.exotronic.com.au/'], ['Solar 4 RVs: Exotronic Alpha 12 V 50 Ah', 'https://www.solar4rvs.com.au/products/exotronic-12v-50ah-alpha-ip67-smart-bluetooth-lithium-battery-copy'], ['Solar 4 RVs shipping policy (freight quoted live by its checkout)', 'https://www.solar4rvs.com.au/policies/shipping-policy']], conf: 'medium', tags: [],
    },
    {
      id: 'itechworld-100ah', name: 'iTechworld iTECH100 12 V 100 Ah LiFePO4', vendor: 'iTechworld (Australia)', cat: 'battery', slots: BAT,
      blurb: 'A 100 Ah LiFePO4 at an AGM\'s price — for a Pi on solar or a repeater.',
      price: { aud: 399, gst: true, basis: 'retail', src: 'iTechworld: iTECH100 A$399 inc GST, In Stock (regularly A$599). Free shipping in its Black Friday sale; otherwise StarTrack A$35.32 to Brisbane 4000 and Border Express A$56.16 to Longreach (shop\'s checkout calculator)', url: 'https://itechworld.com.au/products/100ah-12v-lithium-ion-battery-slim-lifepo4-deep-cycle-camping-rv-solar-itech100a', asof: '2026-11', shop: 'iTechworld', from: 'AU', stock: 'in', ship: 0 },
      grade: 2, gradeWhy: 'consumer lithium brand', support: 'limited',
      hw: { ah: 100, chem: 'lfp', dod: 0.8, v: 12.8 }, lifeYears: 8, status: 'current',
      pros: ['80 Ah usable for $400'], cons: ['Check its low-temperature protection'], src: [['iTechworld', 'https://www.itechworld.com.au/'], ['iTechworld: iTECH100', 'https://itechworld.com.au/products/100ah-12v-lithium-ion-battery-slim-lifepo4-deep-cycle-camping-rv-solar-itech100a']], conf: 'medium', tags: [],
    },
    {
      id: 'enerdrive-btec-100ah', name: 'Enerdrive B-TEC Ultra 12 V 100 Ah LiFePO4', vendor: 'Enerdrive (Australia)', cat: 'battery', slots: BAT,
      blurb: 'A premium IP67 LiFePO4 with Bluetooth and a strong warranty.',
      price: { aud: 886, gst: true, basis: 'retail', src: 'Solar 4 RVs: Enerdrive B-TEC Ultra 12 V 100 Ah IP67 A$886 inc GST (regularly A$1,299), In Stock at Enerdrive\'s warehouse, up to 7 days before dispatch. Courier free to Brisbane 4000, A$43.07 to Longreach (shop\'s checkout calculator)', url: 'https://www.solar4rvs.com.au/products/enerdrive-b-tec-ultra-12v-100ah-lithium-battery-ip67-waterproof', asof: '2026-11', shop: 'Solar 4 RVs', from: 'AU', stock: 'in', ship: 0 },
      grade: 4, gradeWhy: 'premium Australian LiFePO4', support: 'vendor',
      hw: { ah: 100, chem: 'lfp', dod: 0.8, v: 12.8 }, lifeYears: 12, status: 'current',
      pros: ['Warranty and support'], cons: ['More than twice the price of the budget brands'], src: [['Enerdrive', 'https://www.enerdrive.com.au/'], ['Solar 4 RVs: Enerdrive B-TEC Ultra 12 V 100 Ah', 'https://www.solar4rvs.com.au/products/enerdrive-b-tec-ultra-12v-100ah-lithium-battery-ip67-waterproof'], ['Solar 4 RVs shipping policy (freight quoted live by its checkout)', 'https://www.solar4rvs.com.au/policies/shipping-policy']], conf: 'high', tags: [],
    },
    // ── 12 V → 5 V converters ───────────────────────────────────────────────
    {
      id: 'meanwell-ddr-15g-5', name: 'Mean Well DDR-15G-5 (9–36 V in, 5 V 3 A)', vendor: 'Mean Well', cat: 'dcdc', kind: '12to5',
      blurb: 'A DIN-rail DC-DC converter that holds 5 V for a Pi 3 or 4 from a 12 V battery, −40 to +85 °C.',
      price: { aud: 48.05, gst: true, basis: 'retail', src: 'Power Supplies Australia (Mean Well distributor): A$48.05 inc GST, in stock (VIC 100+, QLD 41). Delivery A$27.50 inc GST on orders under A$75, free above', url: 'https://www.power-supplies-australia.com.au/mean-well-ddr-15g-5-dc-to-dc-converter', asof: '2026-11', shop: 'Power Supplies Australia', from: 'AU', stock: 'in', ship: 27.5 },
      power: { eff: 0.86 }, temp: [-40, 85], grade: 4, gradeWhy: 'Mean Well industrial', support: 'vendor',
      hw: { watts: 15 }, lifeYears: 12, status: 'current', def: true,
      pros: ['Industrial, wide input, DIN rail'], cons: ['15 W: too little for a Pi 5 with USB devices'],
      src: [['DDR-15 datasheet', 'https://www.meanwell.com/'], ['Power Supplies Australia: DDR-15G-5', 'https://www.power-supplies-australia.com.au/mean-well-ddr-15g-5-dc-to-dc-converter'], ['Power Supplies Australia (ADM) postage: free over A$75 inc GST, else A$27.50', 'https://www.admtech.com.au/postage-delivery']], conf: 'high', tags: [],
    },
    {
      id: 'meanwell-ddr-30g-5', name: 'Mean Well DDR-30G-5 (9–36 V in, 5 V 6 A)', vendor: 'Mean Well', cat: 'dcdc', kind: '12to5',
      blurb: 'The 30 W version — what a Pi 5 or a Pi with several SDR sticks wants.',
      price: { aud: 70.66, gst: false, basis: 'retail', src: 'RS Australia: A$70.66 ex GST (A$77.73 inc), 3 in Australian stock — figures from a search-engine listing, as RS blocks automated reads. Power Supplies Australia lists it at A$78.07 inc GST but has none in any warehouse. RS online delivery for a private or guest account: A$20 ex GST (A$22 inc) on orders under A$80 ex GST; free over A$60 ex GST with a business account', url: 'https://au.rs-online.com/web/p/dc-dc-converters/1757801', asof: '2026-11', shop: 'RS Australia', from: 'AU', stock: 'in', ship: 22 },
      power: { eff: 0.88 }, temp: [-40, 85], grade: 4, gradeWhy: 'Mean Well industrial', support: 'vendor',
      hw: { watts: 30 }, lifeYears: 12, status: 'current',
      pros: ['Headroom for USB peripherals'], cons: [], src: [['DDR-30 datasheet', 'https://www.meanwell.com/'], ['RS Australia: DDR-30G-5 (stock no. 175-7801)', 'https://au.rs-online.com/web/p/dc-dc-converters/1757801'], ['Power Supplies Australia: DDR-30G-5 (no stock)', 'https://www.power-supplies-australia.com.au/mean-well-ddr-30g-5-dc-to-dc-converter'], ['RS Australia delivery charges', 'https://au.rs-online.com/web/content/support/all-articles/delivery']], conf: 'high', tags: [],
    },
    {
      id: 'pololu-d36v28f5', name: 'Pololu D36V28F5 5 V 3.2 A regulator', vendor: 'Pololu', cat: 'dcdc', kind: '12to5',
      blurb: 'A small, efficient synchronous buck module (5.3–50 V in) for a Pi in a custom enclosure.',
      price: { aud: 30.95, gst: true, basis: 'retail', src: 'Robot Gear (Australian Pololu stockist): A$30.95 inc GST as a Special Order — none on hand, from its supplier in 7–10 days; shipping from A$4.90. Pololu itself has 52 in stock at US$23.95 (A$34.71 ex GST at 0.69) plus postage from the USA', url: 'https://www.robotgear.com.au/Product.aspx/Details/6661-5V-3-2A-Step-Down-Voltage-Regulator-D36V28F5', asof: '2026-11', shop: 'Robot Gear', from: 'AU', stock: 'order', ship: 4.9 }, power: { eff: 0.9 }, temp: [-40, 85], grade: 3, gradeWhy: 'quality module', support: 'limited',
      hw: { watts: 16 }, lifeYears: 10, status: 'current',
      pros: ['Efficient, tiny'], cons: ['A bare board to mount and protect'], src: [['Pololu D36V28F5', 'https://www.pololu.com/product/3782'], ['Robot Gear: D36V28F5', 'https://www.robotgear.com.au/Product.aspx/Details/6661-5V-3-2A-Step-Down-Voltage-Regulator-D36V28F5'], ['Robot Gear shipping', 'https://www.robotgear.com.au/Article.aspx/Details?title=ShippingAndDelivery']], conf: 'high', tags: [],
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
      price: { aud: 21.12, gst: true, basis: 'retail', src: 'Pakronics: A$21.12 inc GST, 54 in stock, ships from Melbourne within a day; regular shipping A$9.99 (shop\'s checkout calculator, Brisbane 4000). Pi Australia has it in stock at A$25.37 plus A$9.50', url: 'https://www.pakronics.com.au/products/raspberry-pi-27w-usb-c-power-supply-white-rpi-sc1150', asof: '2026-11', shop: 'Pakronics', from: 'AU', stock: 'in', ship: 9.99 },
      grade: 3, gradeWhy: 'official supply', support: 'vendor', hw: { for: ['pi5'] }, lifeYears: 8, status: 'current', def: true,
      pros: ['The one that does not brown out'], cons: [], src: [['Raspberry Pi 27 W', 'https://www.raspberrypi.com/products/27w-power-supply/'], ['Pakronics: Raspberry Pi 27 W supply', 'https://www.pakronics.com.au/products/raspberry-pi-27w-usb-c-power-supply-white-rpi-sc1150'], ['Pi Australia: Raspberry Pi 27 W supply', 'https://piaustralia.com.au/products/raspberry-pi-27w-usb-c-power-supply']], conf: 'high', tags: [],
    },
    {
      id: 'rpi-15w-psu', name: 'Raspberry Pi 15 W USB-C supply', vendor: 'Raspberry Pi Ltd', cat: 'psu', kind: 'psu5',
      blurb: 'The Pi 4\'s supply (5.1 V 3 A): under-voltage is the commonest cause of a "flaky receiver".',
      price: { aud: 14.08, gst: true, basis: 'retail', src: 'Pakronics: black A$14.08 inc GST, 11 in stock, ships from Melbourne; regular shipping A$9.99 (shop\'s checkout calculator, Brisbane 4000). Pi Australia has it in stock at A$24.05 plus A$9.50', url: 'https://www.pakronics.com.au/products/raspberry-pi-4-model-b-official-power-supply-unit-black-rpi-sc0219', asof: '2026-11', shop: 'Pakronics', from: 'AU', stock: 'in', ship: 9.99 },
      grade: 3, gradeWhy: 'official supply', support: 'vendor', hw: { for: ['pi4'] }, lifeYears: 8, status: 'current', def: true,
      pros: ['Holds 5.1 V under load'], cons: [], src: [['Raspberry Pi 15 W', 'https://www.raspberrypi.com/products/type-c-power-supply/'], ['Pakronics: Raspberry Pi 15 W supply', 'https://www.pakronics.com.au/products/raspberry-pi-4-model-b-official-power-supply-unit-black-rpi-sc0219'], ['Pi Australia: Raspberry Pi 15 W supply', 'https://piaustralia.com.au/products/raspberry-pi-power-supply-usb-c-5v-15w-black']], conf: 'high', tags: [],
    },
    {
      id: 'rpi-12w5-micro-psu', name: 'Raspberry Pi 12.5 W micro-USB supply', vendor: 'Raspberry Pi Ltd', cat: 'psu', kind: 'psu5',
      blurb: 'For the micro-USB Pis: the 3B+ and the Zero 2 W.',
      price: { aud: 20.18, gst: true, basis: 'retail', src: 'Pi Australia: official 5 V 2.5 A micro-USB supply A$20.18 inc GST, in stock; regular post A$9.50 (shop\'s checkout calculator, Brisbane 4000). Pakronics lists it at A$14.08 inc GST but out of stock', url: 'https://piaustralia.com.au/products/raspberry-pi-power-supply-5v-2-5-amp', asof: '2026-11', shop: 'Pi Australia', from: 'AU', stock: 'in', ship: 9.5 },
      grade: 3, gradeWhy: 'official supply', support: 'vendor', hw: { for: ['microusb'] }, lifeYears: 8, status: 'current', def: true,
      pros: [], cons: [], src: [['Raspberry Pi supplies', 'https://www.raspberrypi.com/products/micro-usb-power-supply/'], ['Pi Australia: Raspberry Pi 5 V 2.5 A supply', 'https://piaustralia.com.au/products/raspberry-pi-power-supply-5v-2-5-amp'], ['Pakronics: micro-USB supply (out of stock)', 'https://www.pakronics.com.au/products/official-raspberry-pi-micro-usb-power-supply-5-1v-2-5a-white-rpi-sc0626']], conf: 'medium', tags: [],
    },
    {
      id: 'meanwell-hdr-30-12', name: 'Mean Well HDR-30-12 DIN-rail 12 V supply', vendor: 'Mean Well', cat: 'psu', kind: 'psu12',
      blurb: 'An ultra-slim DIN-rail supply, 24 W in its 12 V model (12 V 2 A; the HDR-30 range tops out at 36 W), for a 12–24 V industrial computer or gateway.',
      price: { aud: 33.78, gst: true, basis: 'retail', src: 'Power Supplies Australia (Mean Well distributor): A$33.78 inc GST, in stock (VIC 100+). Delivery A$27.50 inc GST on orders under A$75, free above', url: 'https://www.power-supplies-australia.com.au/mean-well-hdr-30-12-power-supply', asof: '2026-11', shop: 'Power Supplies Australia', from: 'AU', stock: 'in', ship: 27.5 },
      grade: 4, gradeWhy: 'Mean Well industrial', support: 'vendor', hw: { watts: 24 }, lifeYears: 12, status: 'current', def: true,
      pros: ['DIN rail, cheap, reliable'], cons: ['Mains wiring: an electrician\'s job'], src: [['HDR-30', 'https://www.meanwell.com/'], ['Power Supplies Australia: HDR-30-12', 'https://www.power-supplies-australia.com.au/mean-well-hdr-30-12-power-supply'], ['Power Supplies Australia (ADM) postage: free over A$75 inc GST, else A$27.50', 'https://www.admtech.com.au/postage-delivery']], conf: 'high', tags: [],
    },
    {
      id: 'meanwell-hdr-60-12', name: 'Mean Well HDR-60-12 DIN-rail 12 V supply', vendor: 'Mean Well', cat: 'psu', kind: 'psu12',
      blurb: '60 W for a gateway, a computer and a router on one rail.',
      price: { aud: 48.05, gst: true, basis: 'retail', src: 'Power Supplies Australia (Mean Well distributor): A$48.05 inc GST, in stock (VIC 6, WA 20, QLD 88). Delivery A$27.50 inc GST on orders under A$75, free above', url: 'https://www.power-supplies-australia.com.au/mean-well-hdr-60-12-power-supply', asof: '2026-11', shop: 'Power Supplies Australia', from: 'AU', stock: 'in', ship: 27.5 },
      grade: 4, gradeWhy: 'Mean Well industrial', support: 'vendor', hw: { watts: 60 }, lifeYears: 12, status: 'current',
      pros: [], cons: [], src: [['HDR-60', 'https://www.meanwell.com/'], ['Power Supplies Australia: HDR-60-12', 'https://www.power-supplies-australia.com.au/mean-well-hdr-60-12-power-supply'], ['Power Supplies Australia (ADM) postage: free over A$75 inc GST, else A$27.50', 'https://www.admtech.com.au/postage-delivery']], conf: 'high', tags: [],
    },
    {
      id: 'meanwell-drc-40a', name: 'Mean Well DRC-40A (13.8 V supply + battery charger)', vendor: 'Mean Well', cat: 'psu', kind: 'charger',
      slots: ['field:psu', 'repeater:psu', 'base:psu'],
      blurb: 'A DIN-rail "security" supply: runs the site at 13.8 V from mains and keeps a 12 V battery charged for when the mains goes.',
      price: { aud: 83.31, gst: true, basis: 'retail', src: 'Power Supplies Australia (Mean Well distributor): A$83.31 inc GST, in stock (VIC 1, QLD 42). Delivery free on orders of A$75 or more', url: 'https://www.power-supplies-australia.com.au/mean-well-drc-40a-power-supply', asof: '2026-11', shop: 'Power Supplies Australia', from: 'AU', stock: 'in', ship: 0 },
      power: { w: 1 }, temp: [-30, 70], grade: 4, gradeWhy: 'Mean Well industrial', support: 'vendor', hw: { watts: 40 }, lifeYears: 12, status: 'current', def: true,
      pros: ['AC-OK and battery-low alarms to the logger'], cons: ['Mains wiring: an electrician\'s job'], src: [['DRC-40', 'https://www.meanwell.com/'], ['Power Supplies Australia: DRC-40A', 'https://www.power-supplies-australia.com.au/mean-well-drc-40a-power-supply'], ['Power Supplies Australia (ADM) postage: free over A$75 inc GST, else A$27.50', 'https://www.admtech.com.au/postage-delivery']], conf: 'high', tags: [],
    },
    {
      id: 'meanwell-drc-60a', name: 'Mean Well DRC-60A (13.8 V supply + battery charger)', vendor: 'Mean Well', cat: 'psu', kind: 'charger',
      slots: ['field:psu', 'repeater:psu', 'base:psu'],
      blurb: 'The 60 W version.',
      price: { aud: 85.62, gst: true, basis: 'retail', src: 'Power Supplies Australia (Mean Well distributor): A$85.62 inc GST, in stock (VIC 100+, WA 5, QLD 7). Delivery free on orders of A$75 or more', url: 'https://www.power-supplies-australia.com.au/mean-well-drc-60a-power-supply', asof: '2026-11', shop: 'Power Supplies Australia', from: 'AU', stock: 'in', ship: 0 },
      power: { w: 1.2 }, temp: [-30, 70], grade: 4, gradeWhy: 'Mean Well industrial', support: 'vendor', hw: { watts: 60 }, lifeYears: 12, status: 'current',
      pros: ['Room for a router and a computer'], cons: [], src: [['DRC-60', 'https://www.meanwell.com/'], ['Power Supplies Australia: DRC-60A', 'https://www.power-supplies-australia.com.au/mean-well-drc-60a-power-supply'], ['Power Supplies Australia (ADM) postage: free over A$75 inc GST, else A$27.50', 'https://www.admtech.com.au/postage-delivery']], conf: 'high', tags: [],
    },
    // ── UPS ─────────────────────────────────────────────────────────────────
    {
      id: 'dc-ups-drc60-18ah', name: 'DC UPS: Mean Well DRC-60A with a 12 V 18 Ah AGM', vendor: 'Mean Well + battery', cat: 'ups', slots: ['base:ups'],
      blurb: 'The efficient way to back up a 5–15 W base: 13.8 V DC straight to a 12 V computer (or a 5 V converter), no inverter burning watts.',
      price: { aud: 165.46, gst: true, basis: 'retail', src: 'DRC-60A A$85.62 (Power Supplies Australia, in stock, free delivery over A$75) + an Auscell 18 Ah AGM A$79.84 (Battery Specialists, in stock, A$20 road freight): two orders, A$20 delivery in all', url: 'https://www.power-supplies-australia.com.au/mean-well-drc-60a-power-supply', asof: '2026-11', shop: 'Power Supplies Australia + Battery Specialists', from: 'AU', stock: 'in', ship: 20 },
      power: { w: 0 }, temp: [-20, 50], grade: 4, gradeWhy: 'industrial DC UPS', support: 'vendor',
      hw: { wh: 216, selfW: 1.2, dc: true }, lifeYears: 5, status: 'current', def: true,
      pros: ['Hours more runtime than a mains UPS of the same battery', 'Battery-low alarm'], cons: ['Mains wiring: an electrician\'s job', 'The battery needs replacing every 4–5 years'],
      src: [['DRC-60', 'https://www.meanwell.com/'], ['Power Supplies Australia: DRC-60A', 'https://www.power-supplies-australia.com.au/mean-well-drc-60a-power-supply'], ['Battery Specialists: Auscell 12 V 18 Ah AGM', 'https://batteryspecialists.com.au/products/auscell-12v-18ah-sla-agm-battery']], conf: 'medium', tags: [],
    },
    {
      id: 'eaton-5e650', name: 'Eaton 5E 650 VA UPS', vendor: 'Eaton', cat: 'ups', slots: ['base:ups'],
      blurb: 'A small line-interactive mains UPS: plug the computer\'s supply into it.',
      price: { aud: 119, gst: true, basis: 'retail', src: 'Out of stock: staticICE lists only Umart and MSY (one business), at A$119 inc GST, and both shops\' own pages show the 5E650IUSB-AU out of stock for delivery and at every store. No other Australian seller was found. Umart and MSY work out delivery at checkout', url: 'https://www.umart.com.au/product/eaton-5e-ups-650va-360w-2-x-anz-outlets-5e650iusb-au-40513', asof: '2026-11', shop: 'Umart', from: 'AU', stock: 'out', ship: null },
      power: { w: 0 }, temp: [0, 40], grade: 2, gradeWhy: 'office UPS', support: 'vendor',
      hw: { wh: 84, selfW: 8 }, lifeYears: 4, status: 'current',
      pros: ['No wiring'], cons: ['Its inverter burns about as much as the Pi it protects'], src: [['Eaton 5E', 'https://www.eaton.com/'], ['Umart: Eaton 5E650IUSB-AU (out of stock)', 'https://www.umart.com.au/product/eaton-5e-ups-650va-360w-2-x-anz-outlets-5e650iusb-au-40513'], ['staticICE: 5E650', 'https://www.staticice.com.au/cgi-bin/search.cgi?q=5E650']], conf: 'medium', tags: [],
    },
    {
      id: 'cyberpower-vp1000', name: 'CyberPower Value Pro VP1000ELCD', vendor: 'CyberPower', cat: 'ups', slots: ['base:ups'],
      blurb: '1000 VA line-interactive UPS for a base with a router and a PC.',
      price: { aud: 179, gst: true, basis: 'retail', src: 'Umart (and MSY, one business): A$179 inc GST, in stock for delivery and in Brisbane stores. Umart works out delivery at checkout and does not publish a rate. Mwave lists it at A$176.98 but only in stock with its supplier (ships in 7–15 days); MegaBuy A$209 plus A$19.95 to Brisbane 4000 (A$30.95 to Longreach)', url: 'https://www.umart.com.au/product/cyberpower-value-pro-1000va-550w-line-interactive-ups-vp1000elcd-54600', asof: '2026-11', shop: 'Umart', from: 'AU', stock: 'in', ship: null },
      power: { w: 0 }, temp: [0, 40], grade: 2, gradeWhy: 'office UPS', support: 'vendor',
      hw: { wh: 150, selfW: 10 }, lifeYears: 4, status: 'current',
      pros: ['Enough for a PC and a router'], cons: ['Batteries every 3–4 years'], src: [['CyberPower', 'https://www.cyberpower.com/'], ['Umart: CyberPower VP1000ELCD', 'https://www.umart.com.au/product/cyberpower-value-pro-1000va-550w-line-interactive-ups-vp1000elcd-54600'], ['Mwave: VP1000ELCD (supplier stock)', 'https://www.mwave.com.au/products/cyberpower-vp1000elcd-value-pro-1000va-550w-sine-wave-ups-ac32114'], ['staticICE: VP1000ELCD', 'https://www.staticice.com.au/cgi-bin/search.cgi?q=VP1000ELCD']], conf: 'medium', tags: [],
    },
    {
      id: 'apc-bx950mi', name: 'APC Back-UPS BX950MI', vendor: 'APC (Schneider Electric)', cat: 'ups', slots: ['base:ups'],
      blurb: '950 VA with automatic voltage regulation.',
      price: { aud: 174.97, gst: true, basis: 'retail', src: 'MegaBuy: BX950MI-AZ A$174.97 inc GST, sold online for delivery in 1–3 days; delivery A$27.95 to Brisbane 4000 and to Longreach from the page\'s postcode calculator. Umart and MSY have it in stock at A$175 (delivery worked out at checkout)', url: 'https://www.megabuy.com.au/apc-back-ups-950va-230v-avr-australian-sockets-p1253900.html', asof: '2026-11', shop: 'MegaBuy', from: 'AU', stock: 'in', ship: 27.95 },
      power: { w: 0 }, temp: [0, 40], grade: 2, gradeWhy: 'office UPS', support: 'vendor',
      hw: { wh: 108, selfW: 9 }, lifeYears: 4, status: 'current',
      pros: ['A brand IT departments know'], cons: [], src: [['APC Back-UPS', 'https://www.apc.com/'], ['MegaBuy: APC BX950MI-AZ', 'https://www.megabuy.com.au/apc-back-ups-950va-230v-avr-australian-sockets-p1253900.html'], ['Umart: APC BX950MI-AZ', 'https://www.umart.com.au/product/apc-by-schneider-back-ups-bx950mi-az-avr-ups-59461'], ['staticICE: BX950MI', 'https://www.staticice.com.au/cgi-bin/search.cgi?q=BX950MI']], conf: 'medium', tags: [],
    },
    {
      id: 'geekworm-x1200', name: 'Geekworm X1200 UPS HAT for Pi 5 (2 × 18650)', vendor: 'Geekworm', cat: 'ups', slots: ['base:ups'],
      blurb: 'A Pi 5 UPS board with two 18650 cells (bought separately) and safe-shutdown signalling.',
      price: { aud: 69.57, gst: false, basis: 'retail', src: 'Geekworm (ships from China): US$48 (A$69.57 at 0.69), in stock; GST is added at checkout. YunExpress US$6 (A$9.57 with GST) to Brisbane 4000 in 5–12 business days. No Australian shop found with it. Cells not included', url: 'https://geekworm.com/products/x1200', asof: '2026-11', shop: 'Geekworm', from: 'CN', stock: 'in', ship: 9.57 }, power: { w: 0 }, temp: [0, 45], grade: 1, gradeWhy: 'maker board with lithium cells', support: 'limited',
      hw: { wh: 21, selfW: 0.3, for: ['pi5'] }, lifeYears: 3, status: 'current',
      pros: ['Rides out a short outage and shuts down cleanly'], cons: ['An hour or two at best', 'Lithium cells in a hot box'], src: [['Geekworm X1200', 'https://geekworm.com/'], ['Geekworm: X1200 shop page', 'https://geekworm.com/products/x1200']], conf: 'medium', tags: [],
    },
    {
      id: 'waveshare-ups-hat-d', name: 'Waveshare UPS HAT (D)', vendor: 'Waveshare', cat: 'ups', slots: ['base:ups'],
      blurb: 'A Pi UPS HAT on lithium cells with a fuel gauge over I²C.',
      price: { aud: 38.55, gst: true, basis: 'retail', src: 'Pi Australia: Waveshare UPS HAT (D) A$38.55 inc GST, in stock; regular post A$9.50 (shop\'s checkout calculator, Brisbane 4000). Takes one 21700 cell, not included', url: 'https://piaustralia.com.au/products/ups-hat-d-for-raspberry-pi-supports-21700-li-battery-not-included-5v-uninterruptible-power-supply-pogo-pins-connector', asof: '2026-11', shop: 'Pi Australia', from: 'AU', stock: 'in', ship: 9.5 }, power: { w: 0 }, temp: [0, 45], grade: 1, gradeWhy: 'maker board', support: 'limited',
      hw: { wh: 20, selfW: 0.3, for: ['pi4', 'pi3'] }, lifeYears: 3, status: 'current',
      pros: ['Cheap'], cons: ['Short runtime', 'Made for the Pi 3 and 4 (pogo pins under the board), not the Pi 5'], src: [['Waveshare UPS HAT', 'https://www.waveshare.com/'], ['Pi Australia: Waveshare UPS HAT (D)', 'https://piaustralia.com.au/products/ups-hat-d-for-raspberry-pi-supports-21700-li-battery-not-included-5v-uninterruptible-power-supply-pogo-pins-connector']], conf: 'low', tags: [],
    },
  ];
  if (typeof module === 'object' && module.exports) module.exports = items;
  else (globalThis.OA_CATALOG = globalThis.OA_CATALOG || []).push(...items);
})();
