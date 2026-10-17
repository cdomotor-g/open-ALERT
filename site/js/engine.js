// open-ALERT configurator — engine.js
//
//   OAEngine   everything the configurator works out, with no DOM: the
//              questions each kind of site asks, the requirements the answers
//              imply, which catalogue items fit each slot and why, the
//              peripherals a pick drags in, the power budget and solar sizing,
//              the costs, and the consequences of the choices.
//
// Loaded after the catalogue files (site/data/*.js, which fill OA_CATALOG) and
// before ui.js. Runs the same under Node, where test/engine.test.js requires
// it with the catalogue and checks every preset end to end.
//
// ── How a design is worked out ────────────────────────────────────────────────
//
//   design    { id, role, name, qty, f: {feature answers}, picks: {slot: [{id, qty}]},
//               per: {peripheral key: item id | null} }
//   evaluate(design) → slots (shown, picked, every candidate with its fit),
//               peripherals, capabilities, requirement checks, power, cost and
//               consequences. One pure function; the page draws what it returns.
//
// Three layers, kept apart so each can be read alone:
//   requirements(d)   answers → a list of requirements, each saying which answer
//                     it came from and whether it is a must or a should.
//   fit(d, slot, it)  one candidate against those requirements and against what
//                     is already picked — ok, warn or fail, with the reasons.
//   evaluate(d)       the picks as a whole: what the site can do, what it still
//                     lacks, what it costs, what it draws and what follows.

(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.OAEngine = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  // ── vocabulary ──────────────────────────────────────────────────────────────

  const ROLE_LIST = ['field', 'repeater', 'base'];
  const ROLES = {
    field: { label: 'Field station', plural: 'Field stations', short: 'Field',
      blurb: 'A rain or river gauge that sends its readings by radio (or, without ALERT, by mobile or satellite).' },
    repeater: { label: 'Repeater', plural: 'Repeaters', short: 'Repeater',
      blurb: 'A hilltop relay that hears field stations and sends their readings on toward a base.' },
    base: { label: 'Base station', plural: 'Base stations', short: 'Base',
      blurb: 'Receives the bursts and forwards them to Flood-Net or your own system.' },
  };

  // Category → [label, group]. The group is what the catalogue filters by.
  const CATS = {
    'alert-unit': ['Integrated ALERT unit', 'ALERT equipment'],
    'alert-encoder': ['ALERT encoder / modem', 'ALERT equipment'],
    'alert-rx': ['ALERT receiver / decoder', 'ALERT equipment'],
    'gateway': ['Gateway', 'ALERT equipment'],
    'firmware': ['Firmware', 'Software & firmware'],
    'software': ['Base-station software', 'Software & firmware'],
    'datalogger': ['Datalogger', 'Loggers & computers'],
    'open-logger': ['Open-source datalogger', 'Loggers & computers'],
    'mcu': ['Microcontroller board', 'Loggers & computers'],
    'sbc': ['Single-board computer', 'Loggers & computers'],
    'ind-sbc': ['Industrial Raspberry Pi', 'Loggers & computers'],
    'ind-pc': ['Industrial computer / gateway', 'Loggers & computers'],
    'mini-pc': ['Mini PC', 'Loggers & computers'],
    'pc': ['Desktop or laptop', 'Loggers & computers'],
    'sdr': ['SDR receiver', 'Radios'],
    'handheld': ['Handheld radio', 'Radios'],
    'lmr': ['Land-mobile radio', 'Radios'],
    'radio-modem': ['Radio modem', 'Radios'],
    'antenna': ['Antenna', 'RF parts'],
    'coax': ['Coax', 'RF parts'],
    'connector': ['Connectors & pigtails', 'RF parts'],
    'surge': ['Lightning arrestor', 'RF parts'],
    'filter': ['RF filter', 'RF parts'],
    'duplexer': ['Duplexer', 'RF parts'],
    'gps': ['GPS', 'RF parts'],
    'rain': ['Rain gauge', 'Sensors'],
    'level': ['Water-level sensor', 'Sensors'],
    'met': ['Weather sensor', 'Sensors'],
    'iface': ['Sensor interface', 'Sensors'],
    'solar': ['Solar panel', 'Power'],
    'regulator': ['Charge controller', 'Power'],
    'battery': ['Battery', 'Power'],
    'dcdc': ['DC-DC converter', 'Power'],
    'psu': ['Power supply', 'Power'],
    'ups': ['UPS', 'Power'],
    'enclosure': ['Enclosure', 'Site'],
    'mount': ['Mast & mounting', 'Site'],
    'earth': ['Earthing', 'Site'],
    'enc-acc': ['Enclosure fittings', 'Site'],
    'cell': ['Cellular modem / router', 'Backhaul'],
    'sat': ['Satellite', 'Backhaul'],
    'lpwan': ['LoRaWAN / LPWAN', 'Backhaul'],
    'wired': ['Wired / fixed link', 'Backhaul'],
    'plan': ['Data plan', 'Backhaul'],
    'storage': ['Storage', 'Accessories'],
    'rtc': ['Real-time clock', 'Accessories'],
    'usb': ['USB adapter / hub', 'Accessories'],
    'case': ['Case & cooling', 'Accessories'],
    'cable': ['Cable', 'Accessories'],
    'display': ['Display', 'Accessories'],
    'audio': ['Audio', 'Accessories'],
    'service': ['Licence / service', 'Services'],
  };
  const catLabel = c => (CATS[c] || [c])[0];
  const catGroup = c => (CATS[c] || [c, 'Other'])[1];

  const SKILLS = {
    linux: 'Linux administration',
    electronics: 'Electronics & soldering',
    firmware: 'Writing firmware',
    logger: 'Datalogger programming (CRBasic and the like)',
    rf: 'Radio technician work',
    server: 'Running a server or database',
  };

  // Where the equipment lives, and the temperature range that implies.
  // "Sun" is a sealed box in full sun: tens of degrees over the air, which in
  // inland Queensland is itself over 40 °C (see About → assumptions).
  const ENV = {
    indoor: { t: 'Indoors, air-conditioned', range: [10, 35] },
    shelter: { t: 'Equipment hut or shaded cabinet', range: [-5, 55] },
    sun: { t: 'Sealed enclosure in full sun (Queensland)', range: [-5, 65] },
    extreme: { t: 'Frost to desert heat, in full sun', range: [-20, 70] },
  };
  const GRADE = {
    budget: { t: 'Lowest cost', min: 1, level: 'should' },
    balanced: { t: 'Balanced', min: 2, level: 'should' },
    industrial: { t: 'Industrial', min: 4, level: 'should' },
    critical: { t: 'Mission-critical', min: 4, level: 'must' },
  };

  // Rough rates the costs fall back on; the page's settings override them.
  const DEFAULT_SETTINGS = {
    gst: true,            // show prices including 10% GST
    currency: 'AUD',
    usdPerAud: 0.69,      // October 2026 planning rate (Flood-Net's ALERT2 plan uses it too)
    years: 10,            // the horizon for whole-of-life cost
    labour: true,         // include installation labour and site visits
    rate: 700,            // a person-day, AUD ex GST, fully loaded
    travel: 700,          // a crew-day of travel and vehicle, AUD ex GST
  };

  // ── questions ───────────────────────────────────────────────────────────────
  //
  // Each feature: id, the roles that ask it, its group on the page, a type
  // (choice | multi | bool | number), a default (per role where they differ),
  // options for choice/multi, and `when` to show it only where it matters.

  const opt = (v, t, d, r) => ({ v, t, d, r });
  const FEATURES = [
    // ── field ──
    { id: 'proto', roles: ['field'], group: 'Radio', type: 'choice', def: 'a2',
      label: 'How does it send its readings?',
      options: [
        opt('a1', 'ALERT (ALERT1)', '300-baud bursts on VHF — what today\'s repeaters and bases hear.'),
        opt('a2', 'ALERT2', 'GPS-timed slots with error correction — what the Bureau\'s FWIN upgrades specify.'),
        opt('both', 'ALERT1 now, ALERT2 later', 'One unit that sends either, switched over at the network\'s cut-over.'),
        opt('ip', 'No ALERT radio', 'Mobile network or satellite, straight to Flood-Net over the internet.'),
      ] },
    { id: 'sensors', roles: ['field'], group: 'Sensing', type: 'multi', def: ['rain'],
      label: 'What does it measure?',
      options: [
        opt('rain', 'Rainfall', 'A tipping-bucket gauge: one pulse per tip.'),
        opt('level', 'River or water level', 'A pressure, radar, ultrasonic, encoder or bubbler sensor.'),
        opt('met', 'Air temperature and humidity', 'A screened probe, usually SDI-12.'),
      ] },
    { id: 'levelTech', roles: ['field'], group: 'Sensing', type: 'choice', def: 'radar',
      when: f => (f.sensors || []).includes('level'),
      label: 'Which kind of level sensor?',
      options: [
        opt('radar', 'Radar, above the water', 'No contact with the water or debris; mounted on a bridge or arm.'),
        opt('pressure', 'Pressure transducer, in the water', 'Cheap and accurate; a vented cable or a barometer to compensate.'),
        opt('ultrasonic', 'Ultrasonic, above the water', 'Budget non-contact; shorter range, upset by heat and spray.'),
        opt('encoder', 'Float and shaft encoder', 'In a stilling well — the classic, where a well exists.'),
        opt('bubbler', 'Gas bubbler', 'Only the tube in the water; the gauge stays high and dry.'),
      ] },
    { id: 'txPerDay', roles: ['field'], group: 'Radio', type: 'number', def: 200, min: 1, max: 5000, step: 1, unit: 'a day',
      when: f => f.proto !== 'ip',
      label: 'Transmissions on a wet day',
      help: 'Sets the radio\'s share of the power budget. An event station sends a burst per tip; 200 is a heavy day.' },
    { id: 'logging', roles: ['field'], group: 'Sensing', type: 'bool', def: true,
      label: 'Keep a record on site', help: 'So history survives a radio outage and can be downloaded on a visit.' },
    { id: 'backup', roles: ['field'], group: 'Radio', type: 'choice', def: 'none',
      when: f => f.proto !== 'ip',
      label: 'A second way to send',
      options: [
        opt('none', 'None', ''),
        opt('cell', 'Mobile network (4G / Cat-M1)', 'Readings also go over the internet; remote access too.'),
        opt('sat', 'Satellite', 'Iridium or Myriota, where there is no mobile coverage.'),
      ] },
    { id: 'ipVia', roles: ['field'], group: 'Radio', type: 'choice', def: 'cell',
      when: f => f.proto === 'ip',
      label: 'Which network?',
      options: [opt('cell', 'Mobile network (4G / Cat-M1)', ''), opt('sat', 'Satellite', '')] },
    // ── repeater ──
    { id: 'mode', roles: ['repeater'], group: 'Radio', type: 'choice', def: 'conc',
      label: 'What does it relay?',
      options: [
        opt('a1', 'ALERT1 in, ALERT1 out', 'Store-and-forward, as today\'s repeaters do, for the addresses in its pass ranges.'),
        opt('conc', 'ALERT1 in, ALERT2 out', 'A concentrator: hears legacy stations, sends their readings on in its own ALERT2 slot.'),
        opt('a2', 'ALERT2 in, ALERT2 out', 'An ALERT2 repeater on an ALERT2 backbone.'),
        opt('both', 'Both, each as it came', 'Repeats ALERT1 as ALERT1 and ALERT2 as ALERT2, through a transition.'),
      ] },
    { id: 'freqPlan', roles: ['repeater'], group: 'Radio', type: 'choice', def: 'simplex',
      label: 'Frequencies in and out',
      options: [
        opt('simplex', 'Same channel in and out', 'Hear the burst, then send it on (most Queensland repeaters).'),
        opt('split', 'Different channels, one after the other', 'Store-and-forward across channels; one antenna will do.'),
        opt('duplex', 'Different channels at the same time', 'Full duplex: needs a duplexer (or two well-separated antennas).'),
      ] },
    { id: 'channels', roles: ['repeater', 'base'], group: 'Radio', type: 'number', def: { repeater: 1, base: 4 }, min: 1, max: 16, step: 1, unit: 'channels',
      when: (f, role) => role === 'base' ? (f.rx || []).includes('a1') : f.mode !== 'a2',
      label: 'ALERT1 channels to hear at once',
      help: 'Flood-Net\'s stations use 151.500, 151.525, 151.950 and 152.400 MHz — four channels one SDR stick hears together.' },
    { id: 'relaysPerDay', roles: ['repeater'], group: 'Radio', type: 'number', def: 1500, min: 1, max: 20000, step: 10, unit: 'a day',
      label: 'Messages relayed on a wet day', help: 'Its transmitter\'s share of the power budget.' },
    { id: 'ip', roles: ['repeater'], group: 'Radio', type: 'bool', def: false,
      label: 'Also send to Flood-Net over the internet from the site',
      help: 'Makes the repeater a base station too, where there is mobile coverage or a link.' },
    // ── base ──
    { id: 'rx', roles: ['base'], group: 'Radio', type: 'multi', def: ['a1', 'a2'],
      label: 'Which protocols must it receive?',
      options: [
        opt('a1', 'ALERT (ALERT1)', 'Today\'s field stations and repeaters.'),
        opt('a2', 'ALERT2', 'ALERT2 stations, and concentrators carrying ALERT1 inside ALERT2.'),
      ] },
    { id: 'outputs', roles: ['base'], group: 'Data', type: 'multi', def: ['floodnet'],
      label: 'Where do the readings go?',
      options: [
        opt('floodnet', 'Flood-Net', 'floodwarning.net — over HTTPS with an ingest token, or its MQTT broker.'),
        opt('mqtt', 'Your own MQTT broker', 'For SCADA historians, Node-RED, Ignition and the like.'),
        opt('local', 'A local log and dashboard', 'Readings kept and shown on the base itself.'),
        opt('scada', 'SCADA over Modbus or DNP3', 'Council water and sewerage networks.'),
        opt('legacy', 'Existing ALERT software', 'ALERT2 ASCII or serial into Contrail, DIADvisor and the like.'),
      ] },
    { id: 'redundancy', roles: ['base'], group: 'Data', type: 'choice', def: 'single',
      label: 'Redundancy',
      options: [
        opt('single', 'One receive chain', ''),
        opt('dual', 'Two receive chains', 'Two receivers on separate antennas or channels; one can fail.'),
      ] },
    { id: 'backhaul', roles: ['base'], group: 'Data', type: 'choice', def: 'wired',
      label: 'Its internet connection',
      options: [
        opt('wired', 'NBN or office network', ''),
        opt('cell', 'Mobile network', 'A 4G router and an IoT SIM.'),
        opt('starlink', 'Starlink', 'Where there is neither — 25–40 W more to supply.'),
        opt('none', 'None — store and send later', 'A survey or an isolated site; readings wait on the card.'),
      ] },
    { id: 'screen', roles: ['base'], group: 'Data', type: 'bool', def: false,
      label: 'A screen on site', help: 'A dashboard on a monitor for the room it sits in.' },
    { id: 'audio', roles: ['base'], group: 'Data', type: 'bool', def: false,
      label: 'Chirps on a speaker', help: 'Hear every burst, as a base station operator expects to.' },
    { id: 'remote', roles: ['base'], group: 'Data', type: 'bool', def: true,
      label: 'Managed remotely', help: 'Health, settings and updates from Flood-Net\'s Base Stations tab or your own tools.' },
    { id: 'survey', roles: ['base'], group: 'Data', type: 'bool', def: false,
      label: 'Also a portable survey kit', help: 'Taken to a candidate site for days: GPS, a battery clock and battery power.' },
    // ── power (all) ──
    { id: 'power', roles: ['field', 'repeater', 'base'], group: 'Power', type: 'choice',
      def: { field: 'solar', repeater: 'solar', base: 'mains_ups' },
      label: 'Power at the site',
      options: [
        opt('solar', 'Solar and battery', 'The norm for gauges and hilltops.'),
        opt('mains', 'Mains, with a backup battery', 'A 12 V battery on a mains charger.'),
        opt('mains_ups', 'Mains, with a UPS', 'Rides through outages for the hours set below.', ['base']),
        opt('battery', 'Battery only', 'Changed or charged on a visit.'),
      ] },
    { id: 'autonomy', roles: ['field', 'repeater', 'base'], group: 'Power', type: 'number', def: { field: 10, repeater: 14, base: 1 }, min: 1, max: 60, step: 1, unit: 'days',
      when: f => f.power === 'solar' || f.power === 'battery' || f.power === 'mains',
      label: 'Days it must run with no sun (or no mains)',
      help: 'Battery sizing. Ten to fourteen days rides out a long wet spell in Queensland.' },
    { id: 'upsHours', roles: ['base'], group: 'Power', type: 'number', def: 8, min: 1, max: 72, step: 1, unit: 'hours',
      when: f => f.power === 'mains_ups', label: 'Hours on the UPS' },
    { id: 'psh', roles: ['field', 'repeater', 'base'], group: 'Power', type: 'number', def: 3.5, min: 1, max: 7, step: 0.1, unit: 'sun-hours',
      when: f => f.power === 'solar',
      label: 'Worst month\'s sun, in peak-sun-hours a day',
      help: 'About 3.5 in south-east Queensland\'s winter on a tilted panel; more inland and further north.' },
    { id: 'feedM', roles: ['field', 'repeater', 'base'], group: 'Power', type: 'number', def: { field: 6, repeater: 20, base: 15 }, min: 1, max: 100, step: 1, unit: 'm',
      when: (f, role) => role !== 'field' || f.proto !== 'ip',
      label: 'Coax from radio to antenna', help: 'Sets the feedline\'s length and loss.' },
    // ── environment and priorities (all) ──
    { id: 'env', roles: ['field', 'repeater', 'base'], group: 'Site and priorities', type: 'choice',
      def: { field: 'sun', repeater: 'sun', base: 'indoor' },
      label: 'Where the electronics live',
      options: Object.keys(ENV).map(k => opt(k, ENV[k].t, `${ENV[k].range[0]} to ${ENV[k].range[1]} °C`)) },
    { id: 'grade', roles: ['field', 'repeater', 'base'], group: 'Site and priorities', type: 'choice', def: 'balanced',
      label: 'How much does reliability matter against cost?',
      options: [
        opt('budget', 'Lowest cost', 'Hobby, trial or bench. Anything that works.'),
        opt('balanced', 'Balanced', 'Sensible parts that survive a site; sorted by price.'),
        opt('industrial', 'Industrial', 'Proven in utility and hydromet use; sorted by grade.'),
        opt('critical', 'Mission-critical', 'Warnings depend on it: industrial parts only.'),
      ] },
    { id: 'open', roles: ['field', 'repeater', 'base'], group: 'Site and priorities', type: 'choice', def: 'any',
      label: 'Open source',
      options: [
        opt('any', 'Don\'t mind', ''),
        opt('prefer', 'Prefer open source', 'Closed parts are marked, not excluded.'),
        opt('require', 'Open source only', 'Software and firmware you can read, change and keep.'),
      ] },
    { id: 'support', roles: ['field', 'repeater', 'base'], group: 'Site and priorities', type: 'bool', def: false,
      label: 'Must come with vendor support and a warranty' },
    { id: 'onAir', roles: ['field', 'repeater'], group: 'Site and priorities', type: 'choice', def: 'licensed',
      when: (f, role) => role !== 'field' || f.proto !== 'ip',
      label: 'Where will it transmit?',
      options: [
        opt('licensed', 'On the air, on a licensed channel', 'Needs compliant equipment and an ACMA apparatus licence.'),
        opt('bench', 'On the bench, into a dummy load', 'Development and testing only — never on the air.'),
      ] },
    { id: 'vandal', roles: ['field', 'repeater'], group: 'Site and priorities', type: 'bool', def: false,
      label: 'Exposed to vandals or theft' },
    { id: 'skills', roles: ['field', 'repeater', 'base'], group: 'Site and priorities', type: 'multi', def: [],
      label: 'Skills you have on hand',
      options: Object.keys(SKILLS).map(k => opt(k, SKILLS[k], '')) },
    { id: 'budget', roles: ['field', 'repeater', 'base'], group: 'Site and priorities', type: 'number', def: 0, min: 0, max: 1000000, step: 50, unit: 'AUD',
      label: 'Hardware budget for one site (0 for none)' },
  ];

  function featureDefault(ft, role) {
    const v = ft.def != null && typeof ft.def === 'object' && !Array.isArray(ft.def) ? ft.def[role] : ft.def;
    return Array.isArray(v) ? v.slice() : v;
  }
  function featuresFor(role) { return FEATURES.filter(ft => ft.roles.includes(role)); }
  function defaultFeatures(role) {
    const f = {};
    for (const ft of featuresFor(role)) f[ft.id] = featureDefault(ft, role);
    return f;
  }
  function visibleFeatures(d) {
    return featuresFor(d.role).filter(ft => !ft.when || ft.when(d.f, d.role));
  }
  // A choice's options for this role (some, like a UPS, are a base's only).
  function optionsFor(ft, role) {
    return (ft.options || []).filter(o => !o.r || o.r.includes(role));
  }

  // ── slots ───────────────────────────────────────────────────────────────────
  //
  // A slot is a place in the design an item fills. `need(d)` says whether the
  // slot is part of this design at all; `optional` slots may be left empty;
  // `multi` slots take several items. An item says where it can go with
  // `slots: ['role:slot', …]` and which other slots it makes unnecessary with
  // `covers: ['role:slot', …]` (an ERT-A2 picked as the controller is also the
  // encoder and the radio).

  const radioPath = d => d.role !== 'field' || d.f.proto !== 'ip';
  const SLOTS = {
    field: [
      { id: 'controller', label: 'Logger or controller', need: () => true,
        help: 'The brain on site: reads the sensors, keeps time, logs, and decides when to send.' },
      { id: 'encoder', label: 'ALERT encoder or modem', need: radioPath,
        help: 'Turns readings into ALERT or ALERT2 on the air. Built into integrated units.' },
      { id: 'radio', label: 'VHF radio', need: radioPath,
        help: 'The transmitter the encoder keys. Built into integrated units.' },
      { id: 'rain', label: 'Rain gauge', need: d => (d.f.sensors || []).includes('rain') },
      { id: 'level', label: 'Water-level sensor', need: d => (d.f.sensors || []).includes('level') },
      { id: 'met', label: 'Temperature and humidity', need: d => (d.f.sensors || []).includes('met') },
      { id: 'antenna', label: 'VHF antenna', need: radioPath,
        help: 'A Yagi pointed at the repeater is the norm; an omni where it must reach several.' },
      { id: 'gps', label: 'GPS', need: d => needsGps(d),
        help: 'ALERT2 times every slot from GPS. Units with a GPS inside need only its antenna.' },
      { id: 'comms', label: 'Mobile or satellite link', need: d => d.f.proto === 'ip' || d.f.backup !== 'none' },
      { id: 'solar', label: 'Solar panel', need: d => d.f.power === 'solar', sized: 'solar' },
      { id: 'regulator', label: 'Charge controller', need: d => d.f.power === 'solar' },
      { id: 'battery', label: 'Battery', need: d => d.f.power !== 'mains_ups', sized: 'battery' },
      { id: 'psu', label: 'Mains charger', need: d => d.f.power === 'mains' || d.f.power === 'mains_ups' },
      { id: 'enclosure', label: 'Enclosure', need: () => true },
    ],
    repeater: [
      { id: 'repeater', label: 'Repeater unit or controller', need: () => true,
        help: 'An integrated ALERT2 repeater, or a computer or microcontroller that does the relaying.' },
      { id: 'software', label: 'Repeater software', need: () => true,
        help: 'What decides which bursts to send on. Built into integrated units.' },
      { id: 'receiver', label: 'Receiver', need: () => true,
        help: 'What hears the field stations. Built into integrated units.' },
      { id: 'encoder', label: 'ALERT encoder or modem', need: () => true },
      { id: 'radio', label: 'Transmitter', need: () => true },
      { id: 'antenna', label: 'Antenna', need: () => true,
        help: 'Usually an omni; Yagis where the stations sit in one direction.' },
      { id: 'duplexer', label: 'Duplexer', need: d => d.f.freqPlan === 'duplex' },
      { id: 'gps', label: 'GPS', need: d => needsGps(d) },
      { id: 'comms', label: 'Internet link', need: d => !!d.f.ip },
      { id: 'solar', label: 'Solar panel', need: d => d.f.power === 'solar', sized: 'solar' },
      { id: 'regulator', label: 'Charge controller', need: d => d.f.power === 'solar' },
      { id: 'battery', label: 'Battery', need: d => d.f.power !== 'mains_ups', sized: 'battery' },
      { id: 'psu', label: 'Mains charger', need: d => d.f.power === 'mains' || d.f.power === 'mains_ups' },
      { id: 'enclosure', label: 'Enclosure', need: () => true },
    ],
    base: [
      { id: 'host', label: 'Computer', need: () => true,
        help: 'Runs the software that reads the receivers and forwards the readings.' },
      { id: 'receivers', label: 'Receivers', need: () => true, multi: true,
        help: 'One or more: an SDR hears several ALERT1 channels; ALERT2 needs an ALERT2 receiver.' },
      { id: 'software', label: 'Software', need: () => true },
      { id: 'gateway', label: 'Gateway', optional: true, need: () => true,
        help: 'Optional: an industrial gateway for MQTT, Modbus or DNP3 alongside (or instead of) the computer.' },
      { id: 'antenna', label: 'Antenna', need: () => true },
      { id: 'filter', label: 'RF filter', optional: true, need: d => true,
        help: 'Keeps FM broadcast and pagers out of an SDR near a city or a hilltop transmitter site.' },
      { id: 'gps', label: 'GPS', optional: true, need: () => true,
        help: 'Exact position and a clock with no internet. Needed for a survey kit.' },
      { id: 'comms', label: 'Internet link', need: d => d.f.backhaul !== 'none' },
      { id: 'ups', label: 'UPS', need: d => d.f.power === 'mains_ups' },
      { id: 'solar', label: 'Solar panel', need: d => d.f.power === 'solar', sized: 'solar' },
      { id: 'regulator', label: 'Charge controller', need: d => d.f.power === 'solar' },
      { id: 'battery', label: 'Battery', need: d => d.f.power === 'solar' || d.f.power === 'battery' || d.f.power === 'mains', sized: 'battery' },
      { id: 'psu', label: 'Mains charger', need: d => d.f.power === 'mains' },
      { id: 'enclosure', label: 'Case or cabinet', need: () => true },
    ],
  };
  const slotDef = (role, id) => (SLOTS[role] || []).find(s => s.id === id);

  // ── catalogue access ────────────────────────────────────────────────────────

  let CATALOG = [];
  let BY_ID = new Map();
  function setCatalog(items) {
    CATALOG = items.slice();
    BY_ID = new Map(CATALOG.map(it => [it.id, it]));
  }
  const item = id => BY_ID.get(id) || null;
  const has = (arr, x) => Array.isArray(arr) && arr.includes(x);
  const can = (it, tok) => !!it && has(it.can, tok);
  const inSlot = (it, role, slot) => has(it.slots, `${role}:${slot}`);
  const covers = (it, role, slot) => !!it && has(it.covers, `${role}:${slot}`);
  const tagged = (it, tag) => !!it && has(it.tags, tag);
  function candidates(role, slot) {
    return CATALOG.filter(it => inSlot(it, role, slot));
  }

  // Power figures may differ by role (an ERT-A2 idles at 200 µA as a field
  // station and 50 mA as a repeater): `power.repeater` overrides `power`.
  function powerOf(it, role) {
    const p = Object.assign({}, it.power || {});
    if (it.power && it.power[role]) Object.assign(p, it.power[role]);
    return p;
  }

  // ── design helpers ──────────────────────────────────────────────────────────

  let seq = 0;
  function newDesign(role, name) {
    seq += 1;
    return { id: `d${Date.now().toString(36)}${seq}`, role, name: name || ROLES[role].label, qty: 1,
      f: defaultFeatures(role), picks: {}, per: {}, sizes: {} };
  }
  // Fill in anything a stored or shared design is missing (a feature added
  // since it was saved), so old links keep working.
  function normalise(d) {
    const f = defaultFeatures(d.role);
    d.f = Object.assign(f, d.f || {});
    for (const ft of featuresFor(d.role)) {
      if (ft.type === 'choice' && !optionsFor(ft, d.role).some(o => o.v === d.f[ft.id])) d.f[ft.id] = featureDefault(ft, d.role);
      if (ft.type === 'multi' && !Array.isArray(d.f[ft.id])) d.f[ft.id] = featureDefault(ft, d.role);
      if (ft.type === 'number' && !isFinite(+d.f[ft.id])) d.f[ft.id] = featureDefault(ft, d.role);
    }
    d.picks = d.picks || {};
    d.per = d.per || {};
    d.sizes = d.sizes || {};
    d.qty = Math.max(1, Math.round(+d.qty || 1));
    for (const k of Object.keys(d.picks)) {
      d.picks[k] = (d.picks[k] || []).filter(p => p && item(p.id));
      if (!d.picks[k].length) delete d.picks[k];
    }
    return d;
  }
  const picked = (d, slot) => (d.picks[slot] || []).map(p => ({ it: item(p.id), qty: p.qty || 1 })).filter(p => p.it);
  const first = (d, slot) => { const p = picked(d, slot)[0]; return p ? p.it : null; };
  function allPicked(d) {
    const out = [];
    for (const s of SLOTS[d.role]) for (const p of picked(d, s.id)) out.push({ slot: s.id, it: p.it, qty: p.qty });
    return out;
  }
  // Which picked item makes a slot optional (a gateway that publishes on its
  // own frees the base from needing a computer), if any.
  function freedBy(d, slot) {
    for (const s of SLOTS[d.role]) {
      if (s.id === slot) continue;
      for (const p of picked(d, s.id)) if (has(p.it.frees, `${d.role}:${slot}`)) return p.it;
    }
    return null;
  }
  // Which picked item makes a slot unnecessary, if any.
  function coveredBy(d, slot) {
    for (const s of SLOTS[d.role]) {
      if (s.id === slot) continue;
      for (const p of picked(d, s.id)) if (covers(p.it, d.role, slot)) return p.it;
    }
    return null;
  }

  function sendsA2(d) {
    if (d.role === 'field') return d.f.proto === 'a2' || d.f.proto === 'both';
    if (d.role === 'repeater') return d.f.mode !== 'a1';
    return false;
  }
  function needsGps(d) {
    if (d.role === 'base') return !!d.f.survey;
    return sendsA2(d);
  }

  // ── requirements ────────────────────────────────────────────────────────────
  //
  // Each: { id, text, level: 'must' | 'should', from: [feature ids], area }.
  // The checks that judge them are further down (CHECKS), keyed by id.

  function requirements(d) {
    const f = d.f, R = [];
    const add = (id, level, area, text, from) => R.push({ id, level, area, text, from });
    const env = ENV[f.env] || ENV.sun;
    if (d.role === 'field') {
      if (f.proto === 'a1' || f.proto === 'both') add('tx-a1', 'must', 'Radio', 'Send ALERT1 bursts — 300-baud AFSK on narrowband VHF FM', ['proto']);
      if (f.proto === 'a2' || f.proto === 'both') add('tx-a2', 'must', 'Radio', 'Send ALERT2 — 4,800 bit/s with forward error correction, in its own TDMA slot', ['proto']);
      if (f.proto === 'both') add('switchable', 'must', 'Radio', 'Switch from ALERT1 to ALERT2 by configuration, without new hardware', ['proto']);
      if (needsGps(d)) add('gps', 'must', 'Radio', 'GPS time for the ALERT2 slot timing', ['proto']);
      if (f.proto === 'ip') add('ip', 'must', 'Data', `Send readings over ${f.ipVia === 'sat' ? 'satellite' : 'the mobile network'} to Flood-Net (HTTPS, MQTT or HFEM)`, ['proto', 'ipVia']);
      if (f.proto !== 'ip' && f.backup !== 'none') add('backup', 'must', 'Data', `A second path over ${f.backup === 'sat' ? 'satellite' : 'the mobile network'}`, ['backup']);
      const s = f.sensors || [];
      if (s.includes('rain')) add('in-rain', 'must', 'Sensing', 'Count tipping-bucket pulses, debounced, without missing a tip while asleep', ['sensors']);
      if (s.includes('level')) add('in-level', 'must', 'Sensing', `Read a ${levelName(f.levelTech)} level sensor`, ['sensors', 'levelTech']);
      if (s.includes('met')) add('in-met', 'must', 'Sensing', 'Read an air temperature and humidity probe', ['sensors']);
      add('in-batt', 'should', 'Sensing', 'Report its own battery voltage', []);
      if (f.logging) add('log', 'should', 'Data', 'Keep a record of readings on site', ['logging']);
    }
    if (d.role === 'repeater') {
      const m = f.mode;
      if (m === 'a1' || m === 'conc' || m === 'both') add('rx-a1', 'must', 'Radio', `Hear ALERT1${f.channels > 1 ? ` on ${f.channels} channels at once` : ''}`, ['mode', 'channels']);
      if (m === 'a2' || m === 'both') add('rx-a2', 'must', 'Radio', 'Hear ALERT2', ['mode']);
      if (m === 'a1' || m === 'both') add('tx-a1', 'must', 'Radio', 'Send ALERT1 on — store-and-forward, only the addresses in its pass ranges', ['mode']);
      if (m === 'conc') add('conc', 'must', 'Radio', 'Concentrate ALERT1 readings into its own ALERT2 slot', ['mode']);
      if (m === 'a2' || m === 'both') add('tx-a2', 'must', 'Radio', 'Repeat ALERT2 in its own GPS-timed slot', ['mode']);
      if (needsGps(d)) add('gps', 'must', 'Radio', 'GPS time for the ALERT2 slot timing', ['mode']);
      if (f.freqPlan === 'duplex') add('duplex', 'must', 'Radio', 'Receive and transmit at the same time on two channels', ['freqPlan']);
      if (f.ip) add('ip', 'must', 'Data', 'Forward what it hears to Flood-Net over the internet', ['ip']);
      add('health', 'should', 'Data', 'Report its own battery and health on the air', []);
    }
    if (d.role === 'base') {
      const rx = f.rx || [];
      if (rx.includes('a1')) add('rx-a1', 'must', 'Radio', `Decode ALERT1 on ${f.channels} channel${f.channels === 1 ? '' : 's'} at once`, ['rx', 'channels']);
      if (rx.includes('a2')) add('rx-a2', 'must', 'Radio', 'Receive ALERT2 (including ALERT1 carried by concentrators)', ['rx']);
      for (const o of f.outputs || []) add(`out-${o}`, 'must', 'Data', OUTPUT_TEXT[o], ['outputs']);
      add('unattended', 'should', 'Data', 'Run unattended: start itself, reconnect its receivers, survive power cuts', []);
      if (f.redundancy === 'dual') add('dual', 'must', 'Radio', 'Two independent receive chains', ['redundancy']);
      if (f.backhaul === 'none') add('queue', 'must', 'Data', 'Keep readings until a network is there to send them', ['backhaul']);
      if (f.screen) add('screen', 'should', 'Data', 'Show a dashboard on a local screen', ['screen']);
      if (f.audio) add('audio', 'should', 'Data', 'Play each burst on a speaker', ['audio']);
      if (f.remote) add('remote', 'should', 'Data', 'Be managed remotely — health, settings, updates', ['remote']);
      if (f.survey) add('survey', 'must', 'Data', 'Survey kit: GPS position and a clock that survives a power cut', ['survey']);
      if (f.power === 'mains_ups') add('ups', 'must', 'Power', `Ride through ${f.upsHours} hours without mains`, ['power', 'upsHours']);
    }
    if (f.power === 'solar') add('power', 'must', 'Power', `Run ${f.autonomy} days without sun on a 12 V battery, recharged at ${f.psh} sun-hours a day`, ['power', 'autonomy', 'psh']);
    if (f.power === 'battery') add('power', 'must', 'Power', `Run ${f.autonomy} days on its battery between visits`, ['power', 'autonomy']);
    if (f.power === 'mains') add('power', 'must', 'Power', `Run ${f.autonomy} days on its backup battery without mains`, ['power', 'autonomy']);
    const box = siteRange(d);
    add('temp', 'must', 'Site', `Work from ${box[0]} to ${box[1]} °C (${env.t.toLowerCase()}${shielded(d) ? `, ${SHIELD_C} °C less under a sun shield` : ''})`, ['env']);
    const g = GRADE[f.grade] || GRADE.balanced;
    if (g.min > 1) add('grade', g.level, 'Site', `${g.t} parts — grade ${g.min} or better of 5`, ['grade']);
    if (f.open === 'require') add('open', 'must', 'Openness', 'Open-source software and firmware throughout', ['open']);
    if (f.open === 'prefer') add('open', 'should', 'Openness', 'Open-source software and firmware where there is a choice', ['open']);
    if (f.support) add('support', 'must', 'Support', 'Vendor support and a warranty on the main equipment', ['support']);
    if (d.role !== 'base' && radioPath(d) && f.onAir === 'licensed')
      add('compliance', 'must', 'Compliance', 'Transmitter compliant for Australian land-mobile use (AS/NZS 4295, RCM) and run under an ACMA apparatus licence', ['onAir']);
    if (f.vandal) add('vandal', 'should', 'Site', 'Lockable steel enclosure, low-profile antenna', ['vandal']);
    if (f.budget > 0) add('budget', 'should', 'Cost', `Hardware under ${money(f.budget)} a site`, ['budget']);
    return R;
  }
  const OUTPUT_TEXT = {
    floodnet: 'Forward readings to Flood-Net',
    mqtt: 'Publish readings to an MQTT broker',
    local: 'Keep a local log and dashboard',
    scada: 'Serve readings to SCADA over Modbus or DNP3',
    legacy: 'Feed existing ALERT software (ALERT2 ASCII or serial)',
  };
  function levelName(t) {
    return { radar: 'radar', pressure: 'pressure', ultrasonic: 'ultrasonic', encoder: 'shaft-encoder', bubbler: 'bubbler' }[t] || '';
  }

  // ── fit: one candidate in one slot ──────────────────────────────────────────
  //
  // Judged against the requirements that apply to any item (temperature,
  // grade, openness, support, compliance, status) and against what the design
  // already holds (a receiver the software cannot read, a sensor the logger has
  // no input for). Returns { level: 'ok' | 'warn' | 'fail', reasons: [...] }.

  const LEVEL_RANK = { ok: 0, info: 0, warn: 1, fail: 2 };
  function worse(a, b) { return LEVEL_RANK[b] > LEVEL_RANK[a] ? b : a; }

  // Outdoor or in-the-box items are judged on the site's temperature; things
  // that sit in the office (software, plans, licences) are not.
  // Where a part lives decides the temperature it is judged against: inside
  // the enclosure (the box's range, less what a sun shield takes off), or out
  // in the air on a pole or a bridge (the air's range, capped at 50 °C).
  const OUTSIDE = new Set(['rain', 'level', 'met']);
  const SHIELD_C = 10;
  function shielded(d) {
    if (d.role === 'base' || !['sun', 'extreme'].includes(d.f.env)) return false;
    if (d.per && d.per['sun-shield'] === null) return false;
    return CATALOG.some(it => it.cat === 'enc-acc' && it.kind === 'sun-shield');
  }
  function siteRange(d, it) {
    const env = ENV[d.f.env] || ENV.sun;
    if (it && OUTSIDE.has(it.cat)) return [env.range[0], Math.min(env.range[1], 50)];
    return [env.range[0], env.range[1] - (shielded(d) ? SHIELD_C : 0)];
  }
  const NO_TEMP = new Set(['software', 'firmware', 'plan', 'service', 'coax', 'connector', 'cable', 'mount', 'earth', 'enc-acc', 'antenna', 'duplexer', 'filter', 'battery', 'solar', 'enclosure', 'wired', 'case', 'audio', 'display']);
  const NO_GRADE = new Set(['wired', 'plan', 'service', 'coax', 'connector', 'mount', 'earth', 'enc-acc', 'cable', 'case', 'display', 'audio', 'enclosure']);
  const NO_OPEN = new Set(['coax', 'connector', 'surge', 'mount', 'earth', 'enc-acc', 'antenna', 'battery', 'solar', 'enclosure', 'cable', 'duplexer', 'filter', 'plan', 'service', 'case', 'rain', 'psu', 'dcdc']);

  function fit(d, slot, it, ctx) {
    const f = d.f, reasons = [];
    const say = (level, text) => reasons.push({ level, text });
    ctx = ctx || context(d);
    // status
    if (it.status === 'planned') say('warn', 'Not available yet — planned, would have to be built');
    if (it.status === 'beta') say('warn', 'Young — works on the bench, little field history yet');
    if (it.status === 'eol') say('warn', 'End of life — still sold or in stock, but being replaced');
    if (it.status === 'diy') say('warn', 'Do it yourself: the parts exist, putting them together and proving it is yours');
    if (it.status === 'existing') say('info', 'What is already on site — no purchase');
    if (it.status === 'discontinued') say('fail', 'Discontinued');
    // temperature
    if (!NO_TEMP.has(it.cat)) {
      const range = siteRange(d, it);
      const t = it.temp;
      if (!t || t[0] == null || t[1] == null) {
        say('info', 'Operating temperature not published');
      } else if (t[1] < range[1] || t[0] > range[0]) {
        const gap = Math.max(range[1] - t[1], t[0] - range[0]);
        const where = OUTSIDE.has(it.cat) ? 'the air at the site reaches' : shielded(d) ? 'the box (sun-shielded) needs' : 'the site needs';
        say(gap > 10 ? 'fail' : 'warn', `Rated ${t[0]} to ${t[1]} °C; ${where} ${range[0]} to ${range[1]} °C`);
      }
    }
    // grade (passive parts and services are not graded against it)
    const g = GRADE[f.grade] || GRADE.balanced;
    if (it.grade != null && it.grade < g.min && !NO_GRADE.has(it.cat)) say(g.level === 'must' ? 'fail' : 'warn', `Grade ${it.grade} of 5 — ${it.gradeWhy || 'below what you asked for'}`);
    // openness
    if (f.open !== 'any' && !NO_OPEN.has(it.cat) && it.open) {
      const sw = it.open.sw;
      if (sw === 'closed') say(f.open === 'require' ? 'fail' : 'warn', 'Closed-source firmware or software');
      else if (sw === 'partial') say('warn', 'Partly open: some firmware, drivers or tools are closed');
    }
    // support
    if (f.support && ['alert-unit', 'alert-encoder', 'alert-rx', 'datalogger', 'gateway', 'firmware', 'software', 'ind-sbc', 'ind-pc', 'lmr', 'radio-modem', 'sbc', 'mcu', 'open-logger', 'mini-pc'].includes(it.cat)) {
      if (it.support === 'community') say('fail', 'Community support only — no vendor warranty or support line');
      else if (it.support === 'none') say('fail', 'No support at all');
      else if (it.support === 'limited') say('warn', 'Limited vendor support');
    }
    // compliance of transmitters
    if (d.role !== 'base' && (slot === 'radio' || (covers(it, d.role, 'radio') && radioPath(d)))) {
      if (f.onAir === 'licensed') {
        if (it.acma === false) say('fail', 'Not compliant for Australian land-mobile use — bench only');
        else if (it.acma == null) say('warn', 'Australian compliance (AS/NZS 4295, RCM) not confirmed — ask the supplier');
      }
      const band = it.hw && it.hw.band;
      if (band && (band[0] > 150 || band[1] < 153)) say('fail', `Covers ${band[0]}–${band[1]} MHz, not the 150–153 MHz ALERT channels`);
    }
    // role and slot specifics
    const rs = SLOT_FIT[`${d.role}:${slot}`];
    if (rs) rs(d, it, ctx, say);
    let level = 'ok';
    for (const r of reasons) level = worse(level, r.level === 'info' ? 'ok' : r.level);
    return { level, reasons };
  }

  // What the slot-specific rules need to know about the rest of the design.
  function context(d) {
    const c = { role: d.role };
    if (d.role === 'field') {
      c.controller = first(d, 'controller');
      c.encoder = coveredBy(d, 'encoder') || first(d, 'encoder');
      c.radio = coveredBy(d, 'radio') || first(d, 'radio');
    }
    if (d.role === 'repeater') {
      c.unit = first(d, 'repeater');
      c.software = coveredBy(d, 'software') || first(d, 'software');
      c.receivers = coveredBy(d, 'receiver') ? [coveredBy(d, 'receiver')] : picked(d, 'receiver').map(p => p.it);
      c.encoder = coveredBy(d, 'encoder') || first(d, 'encoder');
      c.radio = coveredBy(d, 'radio') || first(d, 'radio');
    }
    if (d.role === 'base') {
      c.host = first(d, 'host');
      c.receivers = picked(d, 'receivers');
      c.software = first(d, 'software');
      c.gateway = first(d, 'gateway');
    }
    return c;
  }

  // The interfaces a sensor offers and whether a controller can take one.
  function sensorLink(ctrl, sensor) {
    if (!ctrl || !sensor) return { ok: true };
    const io = ctrl.io || {};
    const want = (sensor.hw && sensor.hw.iface) || [];
    const direct = want.filter(x => (io[x] || 0) > 0);
    if (direct.length) return { ok: true, via: direct[0] };
    const adapt = want.find(x => ADAPTABLE[x] && ADAPTABLE[x](ctrl));
    if (adapt) return { ok: true, via: adapt, adapter: adapt };
    return { ok: false, want };
  }
  // A microcontroller or a Linux computer can be given an interface it lacks
  // with a small board; a sealed logger or an integrated unit cannot.
  const diyHost = c => tagged(c, 'mcu') || tagged(c, 'linux');
  const ADAPTABLE = {
    sdi12: diyHost, ma420: diyHost, rs485: diyHost, pulse: diyHost, analog: diyHost, rs232: diyHost,
  };
  const IFACE_NAME = { pulse: 'a pulse input', sdi12: 'SDI-12', ma420: '4–20 mA', rs485: 'RS-485 / Modbus', analog: 'an analogue input', rs232: 'RS-232', serial: 'serial' };

  // Can this software run on this host?
  function runsOn(sw, host) {
    if (!sw || !host) return { level: 'ok' };
    const os = (host.hw && host.hw.os) || [];
    const map = sw.runsOn || {};
    let best = null;
    for (const o of os) {
      const v = map[o];
      if (v === 'ok') return { level: 'ok', os: o };
      if (v && !best) best = { level: 'warn', os: o, note: v };
    }
    return best || { level: 'fail' };
  }
  // Can this software (or gateway) read this receiver?
  function reads(sw, rx) {
    if (!sw || !rx) return false;
    return (rx.links || []).some(l => has(sw.reads, l));
  }

  const benchOnly = (d, it, say) => {
    if (it.kind === 'dummy-load' && d.f.onAir !== 'bench') say('fail', 'Radiates nothing — for the bench only');
  };
  const SLOT_FIT = {
    'field:antenna': (d, it, c, say) => benchOnly(d, it, say),
    'repeater:antenna': (d, it, c, say) => benchOnly(d, it, say),
    'field:controller': (d, it, c, say) => {
      if (d.f.logging && !can(it, 'logger')) say('warn', 'Keeps no record on site');
      if (radioPath(d)) {
        const a1 = d.f.proto === 'a1' || d.f.proto === 'both', a2 = d.f.proto === 'a2' || d.f.proto === 'both';
        if (covers(it, 'field', 'encoder')) {
          if (a1 && !can(it, 'a1-tx')) say('fail', 'Cannot send ALERT1');
          if (a2 && !can(it, 'a2-tx')) say('fail', 'Cannot send ALERT2');
        }
      } else if (!can(it, 'ip') && !first(d, 'comms')) {
        say('info', 'Needs a modem or router to reach the internet');
      }
      for (const s of ['rain', 'level', 'met']) {
        const sen = first(d, s);
        if (!sen) continue;
        const l = sensorLink(it, sen);
        if (!l.ok) say('fail', `No input for the ${sen.name} (${l.want.map(x => IFACE_NAME[x] || x).join(' or ')})`);
        else if (l.adapter) say('info', `Needs an adapter for the ${sen.name} (${IFACE_NAME[l.adapter]})`);
      }
      const p = powerOf(it, 'field');
      if (d.f.power !== 'mains' && d.f.power !== 'mains_ups' && p.w > 1) say('warn', `Draws about ${fmtW(p.w)} all day — a large panel and battery`);
      if (tagged(it, 'linux') && (it.hw && it.hw.storage) === 'sd') say('info', 'Runs from an SD card — see the consequences for keeping it alive');
    },
    'field:encoder': (d, it, c, say) => {
      const a1 = d.f.proto === 'a1' || d.f.proto === 'both', a2 = d.f.proto === 'a2' || d.f.proto === 'both';
      if (a1 && !can(it, 'a1-tx')) say('fail', 'Cannot send ALERT1');
      if (a2 && !can(it, 'a2-tx')) say('fail', 'Cannot send ALERT2');
      if (d.f.proto === 'both' && !(can(it, 'a1-tx') && can(it, 'a2-tx'))) say('fail', 'Cannot switch between ALERT1 and ALERT2');
      if (it.hosts && c.controller && !it.hosts.some(t => tagged(c.controller, t))) say(it.hostsLevel || 'fail', `Needs ${it.hostsText || 'a different controller'}`);
    },
    'field:radio': (d, it, c, say) => {
      const a2 = d.f.proto === 'a2' || d.f.proto === 'both';
      const hw = it.hw || {};
      if (!hw.dataPort) say('warn', 'No data/accessory port — audio and PTT through the mic jack');
      if (a2 && hw.flat === false) say('fail', 'No flat-audio path for 4,800 bit/s ALERT2');
      if (a2 && hw.flat == null) say('warn', 'Whether it passes 4,800 bit/s ALERT2 is unconfirmed');
      if (c.encoder && c.encoder.radios && !c.encoder.radios.some(t => tagged(it, t))) say('warn', `Not a radio ${c.encoder.name} is documented with`);
    },
    'field:gps': (d, it, c, say) => {
      const unit = c.encoder || c.controller;
      if (unit && can(unit, 'gps-int') && !tagged(it, 'gps-antenna')) say('warn', `${unit.name} has its own GPS receiver; it needs only an antenna`);
      if (unit && !can(unit, 'gps-int') && tagged(it, 'gps-antenna')) say('fail', `An antenna alone: ${unit.name} has no GPS receiver inside`);
    },
    'field:comms': (d, it, c, say) => {
      if (d.f.proto === 'ip' && d.f.ipVia === 'sat' && it.cat !== 'sat') say('warn', 'You chose satellite');
      if (d.f.proto === 'ip' && d.f.ipVia === 'cell' && it.cat === 'sat') say('warn', 'You chose the mobile network');
      if (d.f.backup === 'sat' && it.cat !== 'sat') say('warn', 'You chose satellite as the second path');
      if (d.f.backup === 'cell' && it.cat === 'sat') say('warn', 'You chose the mobile network as the second path');
    },
    'field:level': (d, it, c, say) => {
      const t = it.hw && it.hw.tech;
      if (t && d.f.levelTech && t !== d.f.levelTech) say('warn', `A ${levelName(t)} sensor; you chose ${levelName(d.f.levelTech)}`);
      if (c.controller) {
        const l = sensorLink(c.controller, it);
        if (!l.ok) say('fail', `${c.controller.name} has no ${l.want.map(x => IFACE_NAME[x] || x).join(' or ')} input`);
        else if (l.adapter) say('info', `Needs an adapter to ${c.controller.name} (${IFACE_NAME[l.adapter]})`);
      }
    },
    'field:rain': (d, it, c, say) => {
      if (c.controller) {
        const l = sensorLink(c.controller, it);
        if (!l.ok) say('fail', `${c.controller.name} has no pulse input`);
      }
    },
    'field:met': (d, it, c, say) => {
      if (c.controller) {
        const l = sensorLink(c.controller, it);
        if (!l.ok) say('fail', `${c.controller.name} has no ${l.want.map(x => IFACE_NAME[x] || x).join(' or ')} input`);
      }
    },
    'repeater:repeater': (d, it, c, say) => {
      const m = d.f.mode;
      if (covers(it, 'repeater', 'software')) {
        if ((m === 'a1' || m === 'both') && !can(it, 'a1-repeat')) say('fail', 'Cannot repeat ALERT1 as ALERT1');
        if (m === 'conc' && !can(it, 'a1-conc')) say('fail', 'Cannot concentrate ALERT1 into ALERT2');
        if ((m === 'a2' || m === 'both') && !can(it, 'a2-repeat')) say('fail', 'Cannot repeat ALERT2');
      }
      const p = powerOf(it, 'repeater');
      if (d.f.power === 'solar' && p.w > 4) say('warn', `Draws about ${fmtW(p.w)} around the clock — a big solar system on a hilltop`);
    },
    'repeater:software': (d, it, c, say) => {
      const m = d.f.mode;
      if ((m === 'a1' || m === 'both') && !can(it, 'a1-repeat')) say('fail', 'Does not repeat ALERT1');
      if (m === 'conc' && !can(it, 'a1-conc')) say('fail', 'Does not concentrate ALERT1 into ALERT2');
      if ((m === 'a2' || m === 'both') && !can(it, 'a2-repeat')) say('fail', 'Does not repeat ALERT2');
      if (c.unit) {
        const r = runsOn(it, c.unit);
        if (r.level === 'fail') say('fail', `Does not run on ${c.unit.name}`);
        else if (r.level === 'warn') say('warn', r.note);
      }
    },
    'repeater:receiver': (d, it, c, say) => {
      const m = d.f.mode;
      const needA1 = m === 'a1' || m === 'conc' || m === 'both', needA2 = m === 'a2' || m === 'both';
      const hearsA1 = can(it, 'a1-rx') || can(it, 'a1-iq'), hearsA2 = can(it, 'a2-rx');
      if (needA1 && !needA2 && !hearsA1) say('fail', 'Cannot hear ALERT1');
      if (needA2 && !needA1 && !hearsA2) say('fail', 'Cannot hear ALERT2');
      if (c.software && !reads(c.software, it) && !can(it, 'a1-audio')) say('fail', `${c.software.name} cannot read it`);
      if (can(it, 'a1-iq') && c.unit && !tagged(c.unit, 'linux')) say('fail', 'An SDR needs a Linux computer to decode it');
      if (d.f.channels > 1 && !can(it, 'multi-ch')) say('warn', `Hears one channel; you asked for ${d.f.channels}`);
    },
    'repeater:encoder': (d, it, c, say) => {
      const m = d.f.mode;
      if ((m === 'a1' || m === 'both') && !can(it, 'a1-tx')) say('fail', 'Cannot send ALERT1');
      if ((m === 'a2' || m === 'conc' || m === 'both') && !can(it, 'a2-tx')) say('fail', 'Cannot send ALERT2');
      if (it.hosts && c.unit && !it.hosts.some(t => tagged(c.unit, t))) say(it.hostsLevel || 'fail', `Needs ${it.hostsText || 'a different controller'}`);
    },
    'repeater:radio': (d, it, c, say) => {
      const hw = it.hw || {};
      if (!hw.dataPort) say('warn', 'No data/accessory port — audio and PTT through the mic jack');
      if (d.f.mode !== 'a1' && hw.flat === false) say('fail', 'No flat-audio path for 4,800 bit/s ALERT2');
      const p = powerOf(it, 'repeater');
      if (d.f.power === 'solar' && p.rxW > 3) say('warn', `Listens at about ${fmtW(p.rxW)} — power it down between sends if it is not the receiver`);
    },
    'repeater:gps': (d, it, c, say) => {
      const unit = c.unit;
      if (unit && can(unit, 'gps-int') && !tagged(it, 'gps-antenna')) say('warn', `${unit.name} has its own GPS receiver; it needs only an antenna`);
      if (unit && !can(unit, 'gps-int') && tagged(it, 'gps-antenna')) say('fail', `An antenna alone: ${unit.name} has no GPS receiver inside`);
    },
    'repeater:comms': (d, it, c, say) => {
      if (c.unit && !tagged(c.unit, 'linux') && !tagged(it, 'router') && it.cat !== 'wired') say('warn', 'Needs something to run the uplink — a router or a small computer');
    },
    'base:host': (d, it, c, say) => {
      const hw = it.hw || {};
      if (c.software) {
        const r = runsOn(c.software, it);
        if (r.level === 'fail') say('fail', `${c.software.name} does not run on it`);
        else if (r.level === 'warn') say('warn', r.note);
      }
      const sdrs = c.receivers.filter(p => can(p.it, 'a1-iq'));
      if (sdrs.length && (d.f.rx || []).includes('a1')) {
        const cap = hw.sdrCh || 0;
        if (cap === 0) say('fail', 'Too slow to decode an SDR');
        else if (cap < d.f.channels) say('warn', `Decodes about ${cap} SDR channel${cap === 1 ? '' : 's'} at once; you asked for ${d.f.channels}`);
      }
      if (d.f.screen && hw.kiosk === false) say('warn', 'Not enough memory for the screen dashboard');
      if (d.f.survey && !hw.rtc) say('info', 'No battery clock — add an RTC for surveys');
      const usb = c.receivers.reduce((n, p) => n + (p.it.io && p.it.io.usbDev ? p.qty : 0), 0);
      if (usb > ((it.io && it.io.usb) || 0)) say('info', `${usb} USB receivers for ${(it.io && it.io.usb) || 0} ports — a powered hub is added`);
      if (it.cat === 'pc' && !tagged(it, 'always-on')) say('warn', 'A desk PC: it must stay on, logged in, with the browser open');
    },
    'base:receivers': (d, it, c, say) => {
      const rx = d.f.rx || [];
      const hearsA1 = can(it, 'a1-rx') || can(it, 'a1-iq'), hearsA2 = can(it, 'a2-rx');
      if (!hearsA1 && !hearsA2) say('fail', 'Hears neither ALERT1 nor ALERT2');
      else if (rx.length === 1 && rx[0] === 'a1' && !hearsA1) say('fail', 'Does not decode ALERT1');
      else if (rx.length === 1 && rx[0] === 'a2' && !hearsA2) say('fail', 'Does not receive ALERT2');
      const via = [c.software, c.gateway].filter(Boolean);
      if (via.length && !via.some(s => reads(s, it))) say('fail', `${via.map(s => s.name).join(' and ')} cannot read it`);
      if (can(it, 'a1-iq') && c.host && !(c.host.hw && c.host.hw.sdrCh)) say('fail', `${c.host.name} cannot decode an SDR`);
      if (can(it, 'a1-iq') && !can(it, 'multi-ch') && d.f.channels > 1) say('warn', `One channel per receiver; you asked for ${d.f.channels}`);
    },
    'base:software': (d, it, c, say) => {
      if (c.host) {
        const r = runsOn(it, c.host);
        if (r.level === 'fail') say('fail', `Does not run on ${c.host.name}`);
        else if (r.level === 'warn') say('warn', r.note);
      }
      for (const p of c.receivers) if (!reads(it, p.it) && !(c.gateway && reads(c.gateway, p.it))) say('fail', `Cannot read the ${p.it.name}`);
      const outs = new Set([...(it.outputs || []), ...((c.gateway && c.gateway.outputs) || [])]);
      for (const o of d.f.outputs || []) if (!outs.has(o)) say('warn', `${OUTPUT_TEXT[o]} — not by itself`);
      if (d.f.remote && !has(it.outputs, 'remote')) say('info', 'No remote management of its own');
      if (!it.unattended) say('warn', 'Not built to run unattended');
    },
    'base:ups': (d, it, c, say) => {
      const hw = it.hw || {};
      if (hw.for && c.host && !hw.for.some(t => tagged(c.host, t))) say('fail', `A HAT for ${hw.for.join(' / ')} — not for the ${c.host.name}`);
      if (hw.dc && c.host && c.host.power && c.host.power.supply === 'mains') say('warn', `${c.host.name} runs from a mains brick; a DC UPS suits 12 V and 5 V computers`);
    },
    'base:gateway': (d, it, c, say) => {
      const ok = c.receivers.some(p => reads(it, p.it));
      if (!ok) say('warn', 'Reads none of the receivers picked');
    },
  };

  // ── capabilities and checks ─────────────────────────────────────────────────
  //
  // What the picks, together, can do — the facts the requirement checks read.

  function capabilities(d) {
    const c = context(d), k = { path: [] };
    if (d.role === 'field') {
      const enc = c.encoder, radio = c.radio;
      const radioOk = !!radio && (radio === enc || radio === c.controller || !!(radio.hw && (radio.hw.dataPort || radio.hw.micPort)));
      const encHosted = !enc || !enc.hosts || enc.hostsLevel === 'warn' || (c.controller && enc.hosts.some(t => tagged(c.controller, t)));
      k.txA1 = !!enc && can(enc, 'a1-tx') && radioOk && encHosted;
      k.txA2 = !!enc && can(enc, 'a2-tx') && radioOk && encHosted && !(radio && radio.hw && radio.hw.flat === false);
      const gpsUnit = enc && can(enc, 'gps-int') ? enc : (c.controller && can(c.controller, 'gps-int') ? c.controller : null);
      const g = first(d, 'gps');
      k.gps = gpsUnit ? !!g : !!g && !tagged(g, 'gps-antenna');
      k.gpsAntennaOnly = !!gpsUnit;
      k.logger = !!c.controller && can(c.controller, 'logger');
      k.ip = d.f.proto === 'ip' ? !!first(d, 'comms') || can(c.controller, 'ip') : false;
      k.backup = !!first(d, 'comms');
      for (const s of ['rain', 'level', 'met']) {
        const sen = first(d, s);
        k[`in-${s}`] = !!sen && sensorLink(c.controller, sen).ok && !!c.controller;
      }
      k.batt = !!c.controller && (can(c.controller, 'batt-v') || tagged(c.controller, 'mcu') || tagged(c.controller, 'linux'));
      k.switchable = !!enc && can(enc, 'a1-tx') && can(enc, 'a2-tx');
      if (c.controller) k.path.push(c.controller.name);
      if (enc && enc !== c.controller) k.path.push(enc.name);
      if (radio && radio !== enc && radio !== c.controller) k.path.push(radio.name);
    }
    if (d.role === 'repeater') {
      const u = c.unit, sw = c.software;
      const rxs = c.receivers;
      const swRuns = !!sw && (sw === u || runsOn(sw, u).level !== 'fail');
      const readable = r => r === u || (sw && (reads(sw, r) || can(r, 'a1-audio')));
      k.rxA1 = rxs.some(r => (can(r, 'a1-rx') || (can(r, 'a1-iq') && tagged(u, 'linux'))) && readable(r));
      k.rxA2 = rxs.some(r => can(r, 'a2-rx') && readable(r));
      const enc = c.encoder, radio = c.radio;
      const radioOk = !!radio && (radio === enc || radio === u || !!(radio.hw && (radio.hw.dataPort || radio.hw.micPort)));
      const encHosted = !enc || !enc.hosts || enc.hostsLevel === 'warn' || (u && enc.hosts.some(t => tagged(u, t)));
      k.txA1 = !!enc && can(enc, 'a1-tx') && radioOk && encHosted;
      k.txA2 = !!enc && can(enc, 'a2-tx') && radioOk && encHosted;
      k.a1Repeat = swRuns && can(sw, 'a1-repeat') && k.rxA1 && k.txA1;
      k.conc = swRuns && can(sw, 'a1-conc') && k.rxA1 && k.txA2;
      k.a2Repeat = swRuns && can(sw, 'a2-repeat') && k.rxA2 && k.txA2;
      const gpsUnit = u && can(u, 'gps-int') ? u : null;
      const g = first(d, 'gps');
      k.gps = gpsUnit ? !!g : !!g && !tagged(g, 'gps-antenna');
      k.multiCh = rxs.some(r => can(r, 'multi-ch')) || rxs.length >= d.f.channels;
      // One receiver set to one protocol (an ERT-A2) cannot concentrate ALERT1
      // and repeat ALERT2 at the same time.
      k.bothAtOnce = rxs.length > 1 || !rxs.some(r => r.hw && r.hw.oneMode);
      k.ip = !!first(d, 'comms') && (tagged(u, 'linux') || tagged(first(d, 'comms'), 'router'));
      k.duplex = !!first(d, 'duplexer');
      k.health = !!u && (can(u, 'batt-v') || tagged(u, 'linux') || tagged(u, 'mcu'));
      if (u) k.path.push(u.name);
    }
    if (d.role === 'base') {
      const host = c.host, sw = c.software, gw = c.gateway;
      const swOk = !!sw && !!host && runsOn(sw, host).level !== 'fail';
      const readers = [swOk ? sw : null, gw].filter(Boolean);
      const readable = r => readers.some(s => reads(s, r));
      const hearsA1 = p => (can(p.it, 'a1-rx') && (!p.it.a1Via || readers.some(s => has(s.reads, p.it.a1Via)))) || (can(p.it, 'a1-iq') && host && host.hw && host.hw.sdrCh && swOk && has(sw.decodes, 'a1-sdr'));
      const rxNeed = d.f.rx || [];
      const a1Rx = [], a2Rx = [];
      // Receivers that hear one protocol at a time (an ERT-A2 is set to ALERT1
      // or to ALERT2) are shared out last: ALERT2 first, then ALERT1.
      const ordered = c.receivers.slice().sort((a, b) => (a.it.hw && a.it.hw.oneMode ? 1 : 0) - (b.it.hw && b.it.hw.oneMode ? 1 : 0));
      for (const p of ordered) {
        if (!readable(p.it)) continue;
        const h1 = hearsA1(p), h2 = can(p.it, 'a2-rx');
        if (!(p.it.hw && p.it.hw.oneMode)) { if (h1) a1Rx.push(p); if (h2) a2Rx.push(p); continue; }
        let q = p.qty;
        if (h2 && rxNeed.includes('a2') && !a2Rx.length && q > 0) { a2Rx.push(Object.assign({}, p, { qty: 1 })); q -= 1; }
        if (h1 && rxNeed.includes('a1') && !a1Rx.length && q > 0) { a1Rx.push(Object.assign({}, p, { qty: 1 })); q -= 1; }
        if (q > 0) (h2 ? a2Rx : a1Rx).push(Object.assign({}, p, { qty: q }));
      }
      k.oneModeShort = rxNeed.length === 2 && c.receivers.some(p => p.it.hw && p.it.hw.oneMode) && (!a1Rx.length || !a2Rx.length);
      k.rxA1 = a1Rx.length > 0;
      k.rxA2 = a2Rx.length > 0;
      let ch = 0;
      for (const p of a1Rx) ch += can(p.it, 'multi-ch') ? Math.min(8, (host && host.hw && host.hw.sdrCh) || 0) * p.qty : p.qty;
      k.a1Channels = ch;
      k.chains = c.receivers.reduce((n, p) => n + p.qty, 0);
      const outs = new Set([...(swOk ? sw.outputs || [] : []), ...((gw && gw.outputs) || [])]);
      k.outputs = outs;
      k.internet = d.f.backhaul === 'none' ? false : (d.f.backhaul === 'wired' || !!first(d, 'comms'));
      k.unattended = (swOk && !!sw.unattended && !!host && host.cat !== 'pc') || (!sw && !!gw && !!gw.unattended);
      k.queue = swOk && has(sw.outputs, 'queue');
      k.gps = !!first(d, 'gps');
      k.rtc = !!host && !!(host.hw && host.hw.rtc);
      k.swOk = swOk;
      if (c.receivers.length) k.path.push(c.receivers.map(p => p.it.name).join(' + '));
      if (gw) k.path.push(gw.name);
      if (sw) k.path.push(`${sw.name}${host ? ` on ${host.name}` : ''}`);
    }
    return k;
  }

  // Each requirement's verdict: { state: 'ok' | 'warn' | 'fail', how }.
  const CHECKS = {
    'tx-a1': (d, k) => k.txA1 ? ok('ALERT1 encoder and radio in place') : no('Needs an ALERT1 encoder and a radio it can key'),
    'tx-a2': (d, k) => d.role === 'repeater'
      ? (k.a2Repeat ? ok('Repeats ALERT2') : no('Needs something that hears and repeats ALERT2'))
      : (k.txA2 ? ok('ALERT2 encoder and radio in place') : no('Needs an ALERT2 encoder and radio')),
    'switchable': (d, k) => k.switchable ? ok('One encoder does both') : no('No single encoder here sends both'),
    'gps': (d, k) => k.gps ? ok(k.gpsAntennaOnly ? 'GPS antenna for the unit\'s receiver' : 'GPS in place') : no('Add a GPS (an antenna is enough for units with a receiver inside)'),
    'ip': (d, k) => d.role === 'repeater' ? (k.ip ? ok('Uplink in place') : no('Needs an internet link and something to run the uplink'))
      : (k.ip ? ok('Uplink in place') : no('Needs a modem, router or satellite terminal')),
    'backup': (d, k) => k.backup ? ok('Second path in place') : no('Pick a modem or satellite terminal'),
    'in-rain': (d, k) => k['in-rain'] ? ok('Rain gauge on a pulse input') : no('Needs a rain gauge on a controller with a pulse input'),
    'in-level': (d, k) => k['in-level'] ? ok('Level sensor connected') : no('Needs a level sensor the controller can read'),
    'in-met': (d, k) => k['in-met'] ? ok('Probe connected') : no('Needs a probe the controller can read'),
    'in-batt': (d, k) => k.batt ? ok('Battery voltage reported') : warnS('Not reported by this controller'),
    'log': (d, k) => k.logger ? ok('Logs on site') : warnS('The controller keeps no record of its own'),
    'rx-a1': (d, k) => {
      if (d.role === 'base') {
        if (!k.rxA1) return no(k.oneModeShort ? 'One receiver hears one protocol at a time: add a second unit, or an SDR for ALERT1' : 'Needs an ALERT1 receiver the software can read');
        if (k.a1Channels < d.f.channels) return warnS(`Hears about ${k.a1Channels} of ${d.f.channels} channels at once`);
        return ok(`Up to ${k.a1Channels} channel${k.a1Channels === 1 ? '' : 's'} at once`);
      }
      if (!k.rxA1) return no('Needs a receiver that hears ALERT1');
      if (d.f.channels > 1 && !k.multiCh) return warnS('Hears one channel at a time');
      return ok('Hears ALERT1');
    },
    'rx-a2': (d, k) => k.rxA2 ? ok('ALERT2 receiver in place') : no('Needs an ALERT2 receiver the software or gateway can read'),
    'rx-a1-note': () => ok(''),
    'conc': (d, k) => k.conc ? ok('Concentrates ALERT1 into ALERT2') : no('Needs a unit or software that concentrates'),
    'duplex': (d, k) => k.duplex ? ok('Duplexer in place') : no('Add a duplexer, or two well-separated antennas'),
    'health': (d, k) => k.health ? ok('Reports its battery') : warnS('Reports nothing of its own'),
    'out-floodnet': (d, k) => k.outputs.has('floodnet') ? (k.internet ? ok('Forwards to Flood-Net') : warnS('Forwards to Flood-Net once it has a connection')) : no('Nothing here sends to Flood-Net'),
    'out-mqtt': (d, k) => k.outputs.has('mqtt') ? ok('Publishes MQTT') : no('Nothing here publishes MQTT'),
    'out-local': (d, k) => k.outputs.has('local') ? ok('Local log and dashboard') : no('No local log or dashboard'),
    'out-scada': (d, k) => k.outputs.has('scada') ? ok('Modbus / DNP3 server') : no('Add a gateway that speaks Modbus or DNP3'),
    'out-legacy': (d, k) => k.outputs.has('legacy') ? ok('Feeds existing ALERT software') : no('Nothing here feeds ALERT2 ASCII or serial on'),
    'unattended': (d, k) => k.unattended ? ok('Built to run unattended') : warnS('Needs someone to keep it running'),
    'dual': (d, k) => k.chains >= 2 ? ok(`${k.chains} receive chains`) : no('Add a second receiver'),
    'queue': (d, k) => k.queue ? ok('Queues readings on disk') : no('The software does not keep readings for later'),
    'screen': (d, k) => k.outputs.has('screen') ? ok('Screen dashboard') : warnS('No screen dashboard in this software'),
    'audio': (d, k) => k.outputs.has('audio') ? ok('Chirps on a speaker') : warnS('No chirps in this software'),
    'remote': (d, k) => k.outputs.has('remote') ? ok('Remote management') : warnS('No remote management'),
    'survey': (d, k) => k.gps ? (k.rtc || true ? ok('GPS for position and time') : warnS('No battery clock')) : no('Add a GPS'),
  };
  function ok(how) { return { state: 'ok', how }; }
  function no(how) { return { state: 'fail', how }; }
  function warnS(how) { return { state: 'warn', how }; }

  // ── peripherals ─────────────────────────────────────────────────────────────
  //
  // The supporting parts a pick drags in: the coax and arrestor behind every
  // antenna, the supply a Pi needs (a mains adapter, or a 12→5 V converter on
  // a solar site), the card it boots from, the adapter a sensor needs on a
  // microcontroller. Each line: { key, group, label, why, qty, need: 'need' |
  // 'advised', options: [item ids], pick }. The design's `per[key]` holds the
  // person's choice (or null to drop an advised line).

  const GROUPS = {
    coax: { cats: ['coax'], label: 'Coax feedline' },
    needs: { cats: [], label: '' },
    connector: { cats: ['connector'], kinds: ['n-crimp'], label: 'N connectors' },
    pigtail: { cats: ['connector'], kinds: ['pigtail'], label: 'SMA–N pigtail' },
    surge: { cats: ['surge'], label: 'Lightning arrestor' },
    earth: { cats: ['earth'], kinds: [undefined], label: 'Earthing' },
    'sensor-surge': { cats: ['earth'], kinds: ['sensor-surge'], label: 'Sensor-line surge protector' },
    splitter: { cats: ['connector'], kinds: ['splitter'], label: 'Antenna divider' },
    'sun-shield': { cats: ['enc-acc'], kinds: ['sun-shield'], label: 'Sun shield' },
    pole: { cats: ['mount'], kinds: ['pole'], label: 'Pole or mast' },
    'solar-mount': { cats: ['mount'], kinds: ['solar-bracket'], label: 'Panel bracket' },
    'gps-ant': { cats: ['gps'], kinds: ['gps-antenna'], label: 'GPS antenna' },
    'enc-acc': { cats: ['enc-acc'], kinds: [undefined], label: 'Enclosure fittings' },
    psu5: { cats: ['psu'], kinds: ['psu5'], label: '5 V mains adapter' },
    dcdc5: { cats: ['dcdc'], kinds: ['12to5'], label: '12 V → 5 V converter' },
    psu12: { cats: ['psu'], kinds: ['psu12'], label: '12 V mains supply' },
    sd: { cats: ['storage'], kinds: ['microsd'], label: 'Boot card' },
    case: { cats: ['case'], label: 'Case and cooling' },
    'usb-hub': { cats: ['usb'], kinds: ['hub'], label: 'Powered USB hub' },
    rtc: { cats: ['rtc'], label: 'Battery clock (RTC)' },
    'radio-cable': { cats: ['cable'], kinds: ['radio-data'], label: 'Radio data cable' },
    'modem-iface': { cats: ['iface'], kinds: ['afsk'], label: 'Audio / PTT interface' },
    'iface-sdi12': { cats: ['iface'], kinds: ['sdi12'], label: 'SDI-12 interface' },
    'iface-ma420': { cats: ['iface'], kinds: ['ma420'], label: '4–20 mA input' },
    'iface-rs485': { cats: ['iface'], kinds: ['rs485'], label: 'RS-485 interface' },
    'iface-pulse': { cats: ['iface'], kinds: ['pulse'], label: 'Pulse input protection' },
    'iface-analog': { cats: ['iface'], kinds: ['analog'], label: 'Analogue input' },
    'iface-rs232': { cats: ['iface'], kinds: ['rs232'], label: 'RS-232 level shifter' },
    plan: { cats: ['plan'], label: 'Data plan' },
    licence: { cats: ['service'], kinds: ['acma'], label: 'ACMA apparatus licence' },
    speaker: { cats: ['audio'], label: 'Speaker' },
    display: { cats: ['display'], label: 'Screen' },
    'fuse': { cats: ['cable'], kinds: ['dc-wiring'], label: 'Fusing and DC wiring' },
  };
  function groupOptions(gid) {
    const g = GROUPS[gid];
    return CATALOG.filter(it => g.cats.includes(it.cat) && (!g.kinds || g.kinds.includes(it.kind)));
  }

  function peripherals(d) {
    const f = d.f, role = d.role, lines = [];
    // A line offers every catalogue item in its group, narrowed by `filterFn`;
    // `forHost` narrows further to items whose hw.for names a tag the host
    // carries (a Pi 5 supply for a Pi 5, an SDI-12 adapter for a Linux board).
    const add = (key, group, qty, why, need = 'need', filterFn, forHost) => {
      let options = groupOptions(group);
      if (filterFn) options = options.filter(filterFn);
      if (forHost) options = options.filter(o => !o.hw || !o.hw.for || o.hw.for.some(t => tagged(forHost, t)));
      if (!options.length || qty <= 0) return;
      lines.push({ key, group, label: GROUPS[group].label, qty, why, need, options: options.map(o => o.id) });
    };
    const c = context(d);
    // RF: coax, connectors, arrestor behind each antenna.
    const ants = picked(d, 'antenna');
    const nAnt = ants.reduce((n, p) => n + p.qty, 0);
    // A bench design (field or repeater, never on the air) has no site to build.
    const site = role === 'base' || f.onAir !== 'bench';
    if (nAnt && radioPath(d)) {
      add('coax', 'coax', Math.round((f.feedM || 6) * nAnt), `${f.feedM || 6} m from the ${role === 'base' ? 'receivers' : 'radio'} to ${nAnt > 1 ? 'each antenna' : 'the antenna'}`);
      add('connector', 'connector', 2 * nAnt, 'One at each end of the coax');
      if (site) add('surge', 'surge', nAnt, role === 'base' ? 'Where the coax enters the building — keeps a strike off the receivers' : 'At the enclosure entry, bonded to the earth', role === 'base' ? 'advised' : 'need');
    }
    // Receivers: a pigtail per SDR, and a divider when several share an antenna.
    if (role === 'base' || role === 'repeater') {
      const rxs = role === 'base' ? picked(d, 'receivers') : (coveredBy(d, 'receiver') ? [] : picked(d, 'receiver'));
      const sdrs = rxs.filter(p => p.it.cat === 'sdr').reduce((n, p) => n + p.qty, 0);
      if (sdrs) add('pigtail', 'pigtail', sdrs, 'SMA on the stick to N on the feedline');
      const rf = rxs.filter(p => p.it.cat !== 'software').reduce((n, p) => n + p.qty, 0);
      if (role === 'base' && rf > 1 && nAnt === 1)
        add('splitter', 'splitter', 1, `One antenna to ${rf} receivers`, 'need', o => rf <= 2 || /4-way/.test(o.name));
    }
    // Site works for anything on its own pole.
    if (role !== 'base' && site) {
      add('earth', 'earth', 1, 'Mast, enclosure and arrestor bonded to one earth');
      add('pole', 'pole', 1, role === 'repeater' ? 'Carries the antenna — usually the site\'s existing tower' : 'Carries the antenna and panel above the 1% AEP flood level', 'need', o => role === 'repeater' || !/lattice/.test(o.name));
      add('enc-acc', 'enc-acc', 1, 'Glands, a vent, DIN rail and terminals');
      if (f.env === 'sun' || f.env === 'extreme') add('sun-shield', 'sun-shield', 1, 'Takes 10–15 °C off the inside of a box in full sun', 'advised');
    }
    if (role !== 'base') add('fuse', 'fuse', 1, 'A fuse at the battery and the wiring between');
    if (role === 'field' && site && (f.sensors || []).includes('level') && first(d, 'level'))
      add('sensor-surge', 'sensor-surge', 1, 'On the long cable from the river to the logger', 'advised');
    const panels = picked(d, 'solar');
    if (panels.length && f.power === 'solar' && site) add('solar-mount', 'solar-mount', sizedQty(d, 'solar', panels[0].it), 'Tilted to the north at about the site\'s latitude');
    // GPS antenna for a unit with a receiver inside.
    const gpsUnit = [first(d, 'controller'), first(d, 'encoder'), first(d, 'repeater')].find(it => can(it, 'gps-int'));
    if (gpsUnit && needsGps(d) && !(first(d, 'gps') && tagged(first(d, 'gps'), 'gps-antenna')))
      add('gps-ant', 'gps-ant', 1, `${gpsUnit.name} has a GPS receiver; it needs an active antenna`);
    // Computers: supply, card, case, clock.
    const hosts = [];
    if (role === 'base') { const h = first(d, 'host'); if (h) hosts.push(h); }
    if (role === 'field') { const h = first(d, 'controller'); if (h && (tagged(h, 'linux') || tagged(h, 'mcu'))) hosts.push(h); }
    if (role === 'repeater') { const h = first(d, 'repeater'); if (h && (tagged(h, 'linux') || tagged(h, 'mcu'))) hosts.push(h); }
    const ups = role === 'base' && f.power === 'mains_ups' ? first(d, 'ups') : null;
    const dc = f.power === 'solar' || f.power === 'battery' || f.power === 'mains' || !!(ups && ups.hw && ups.hw.dc);
    for (const h of hosts) {
      const sup = (h.power && h.power.supply) || '';
      const hw = h.hw || {};
      if (sup === '5V') {
        const w = (h.power && h.power.peakW) || 8;
        if (dc) add(`dcdc5:${h.id}`, 'dcdc5', 1, `${h.name} runs on 5 V; the site is 12 V`, 'need', o => (o.hw && o.hw.watts || 0) >= w);
        else if (!(ups && ups.hw && ups.hw.for)) add(`psu5:${h.id}`, 'psu5', 1, `${h.name} needs a supply that holds 5 V under load — under-voltage drops USB receivers`, 'need', null, h);
      }
      if ((sup === '12V' || sup === 'wide') && !dc && role === 'base') add(`psu12:${h.id}`, 'psu12', 1, `${h.name} runs on 12–24 V DC`);
      if (hw.storage === 'sd') add(`sd:${h.id}`, 'sd', 1, `${h.name} boots from a microSD card`);
      if (hw.bare) add(`case:${h.id}`, 'case', 1, `${h.name} is a bare board`, 'need', null, h);
      if (tagged(h, 'pi') && (!hw.rtc || tagged(h, 'pi5')) && (role !== 'base' || f.survey || f.backhaul === 'none'))
        add(`rtc:${h.id}`, 'rtc', 1, tagged(h, 'pi5') ? 'A cell for the Pi 5\'s own clock, so it keeps time through a power cut' : 'Keeps time through a power cut with no network or GPS', role === 'base' && f.survey ? 'need' : 'advised', null, h);
    }
    // Base station: USB hub, serial adapters, speaker, screen.
    if (role === 'base') {
      const h = first(d, 'host');
      const rxs = picked(d, 'receivers');
      let usb = 0;
      for (const p of rxs) if (p.it.io && p.it.io.usbDev) usb += p.qty;
      const g = first(d, 'gps'); if (g && g.io && g.io.usbDev) usb += 1;
      const cm = first(d, 'comms'); if (cm && cm.io && cm.io.usbDev) usb += 1;
      if (h && usb > ((h.io && h.io.usb) || 0)) add('usb-hub', 'usb-hub', 1, `${usb} USB devices for ${(h.io && h.io.usb) || 0} ports`);
      if (f.audio && h) add('speaker', 'speaker', 1, (h.hw && h.hw.audioJack) ? 'On the audio jack' : `${h.name} has no audio jack: a USB speaker`, 'need', o => (h.hw && h.hw.audioJack) || tagged(o, 'usb-audio'));
      if (f.screen && h && h.cat !== 'pc') add('display', 'display', 1, 'For the dashboard in the room', 'need', null, h);
    }
    // Field and repeater: the radio's data cable, and a DIY modem's interface.
    if (role !== 'base' && radioPath(d)) {
      const enc = c.encoder, radio = c.radio, ctrl = c.controller || c.unit;
      if (enc && radio && radio !== enc && radio !== ctrl)
        add('radio-cable', 'radio-cable', 1, `${enc.name} to the ${radio.name}'s accessory port`);
      if (enc && tagged(enc, 'diy-modem') && ctrl)
        add('modem-iface', 'modem-iface', 1, 'Tones out, PTT and isolation between the controller and the radio', 'need', null, ctrl);
    }
    // Sensor interfaces a DIY controller lacks.
    if (role === 'field') {
      const ctrl = first(d, 'controller');
      for (const s of ['rain', 'level', 'met']) {
        const sen = first(d, s);
        if (!sen || !ctrl) continue;
        const l = sensorLink(ctrl, sen);
        if (l.ok && l.adapter) add(`iface-${s}`, `iface-${l.adapter}`, 1, `${sen.name} to the ${ctrl.name} (${IFACE_NAME[l.adapter]})`, 'need', null, ctrl);
        else if (l.ok && l.via === 'pulse' && (tagged(ctrl, 'linux') || tagged(ctrl, 'mcu'))) add(`iface-${s}`, 'iface-pulse', 1, 'Debounce and surge protection between the gauge cable and a GPIO pin', 'advised', null, ctrl);
      }
    }
    // Parts a pick names for itself (a programming cable, say).
    for (const p of allPicked(d)) {
      for (const n of p.it.needs || []) {
        const opts = CATALOG.filter(o => o.cat === n.cat && (!n.kind || o.kind === n.kind));
        if (!opts.length) continue;
        lines.push({ key: `${n.key}:${p.it.id}`, group: 'needs', label: n.label, qty: n.qty || p.qty, why: n.why, need: 'need', options: opts.map(o => o.id) });
      }
    }
    // A SIM for every device that needs one.
    for (const p of allPicked(d)) {
      if (!tagged(p.it, 'needs-plan') || (coveredBy(d, 'comms') && p.slot === 'comms')) continue;
      add(`plan:${p.it.id}`, 'plan', p.qty, `A SIM for the ${p.it.name}`, 'need', o => !o.hw || !o.hw.for || o.hw.for.includes(role));
    }
    // The licence a transmitter runs under.
    if (role !== 'base' && radioPath(d) && f.onAir === 'licensed')
      add('licence', 'licence', 1, 'Every transmitting site on a licensed channel; a network\'s existing licence may already cover it', 'advised');
    // Resolve each line's pick: the person's choice, else a default.
    for (const ln of lines) {
      const chosen = d.per[ln.key];
      if (chosen === null) { ln.pick = null; continue; }
      if (chosen && ln.options.includes(chosen)) { ln.pick = chosen; continue; }
      ln.pick = defaultOption(d, ln.options);
    }
    return lines;
  }
  // The default among alternatives: the one marked `def`, else what the
  // design's priority prefers — the cheapest that is good enough, or the
  // sturdiest.
  function defaultOption(d, ids) {
    const its = ids.map(item).filter(Boolean);
    const marked = its.filter(it => it.def);
    const pool = marked.length ? marked : its;
    const g = GRADE[d.f.grade] || GRADE.balanced;
    const scored = pool.map(it => ({ it, fit: fit(d, '', it).level }));
    const okOnes = scored.filter(s => s.fit === 'ok').map(s => s.it);
    const list = okOnes.length ? okOnes : pool;
    if (d.f.grade === 'industrial' || d.f.grade === 'critical') {
      return list.slice().sort((a, b) => (b.grade || 0) - (a.grade || 0) || price(a) - price(b))[0].id;
    }
    const good = list.filter(it => (it.grade || 3) >= g.min);
    return (good.length ? good : list).slice().sort((a, b) => price(a) - price(b))[0].id;
  }

  // ── power ───────────────────────────────────────────────────────────────────
  //
  // Average watts, part by part. A field radio is powered only to send: its
  // average is its transmit draw times its seconds on air. A repeater's
  // receiver listens all day. Then the battery and panel that carry it.

  const TX_SECONDS = { a1: 0.5, a2: 0.5 };   // key-up, preamble and frame, per send
  function powerBudget(d, lines) {
    const f = d.f, rows = [];
    const add = (it, w, note, qty = 1) => { if (w > 0 || note) rows.push({ id: it.id, name: it.name, w: w * qty, note }); };
    const c = context(d);
    const proto = d.role === 'field' ? (f.proto === 'a1' ? 'a1' : 'a2') : (f.mode === 'a1' ? 'a1' : 'a2');
    const txSec = TX_SECONDS[proto];
    for (const p of allPicked(d)) {
      const it = p.it, pw = powerOf(it, d.role);
      if (['solar', 'battery', 'regulator', 'psu', 'ups', 'antenna', 'enclosure', 'duplexer', 'filter', 'software', 'firmware', 'rain'].includes(it.cat) && !pw.w) {
        if (it.cat === 'regulator' && pw.self) add(it, pw.self, 'its own draw');
        continue;
      }
      const isTx = it === c.radio || (it === c.encoder && can(it, 'radio')) || (d.role === 'field' && it === c.controller && can(it, 'radio'));
      if (d.role === 'field' && isTx) {
        const n = f.txPerDay || 0;
        const txW = pw.txW || 0;
        const avg = (pw.w || 0) + txW * txSec * n / 86400;
        add(it, avg, `${fmtW(pw.w || 0)} asleep + ${fmtW(txW)} for ${txSec} s × ${n} sends`);
        continue;
      }
      if (d.role === 'repeater' && isTx) {
        const n = f.relaysPerDay || 0;
        const listen = it === c.receivers[0] || can(it, 'radio') ? (pw.rxW != null ? pw.rxW : pw.w || 0) : (pw.offW || 0);
        const base = can(it, 'radio') ? (pw.w || listen) : listen;
        const avg = base + (pw.txW || 0) * txSec * n / 86400;
        add(it, avg, `${fmtW(base)} ${can(it, 'radio') ? 'idle' : 'standing by'} + ${fmtW(pw.txW || 0)} for ${txSec} s × ${n} relays`);
        continue;
      }
      if (pw.w) add(it, pw.w, pw.note || '', p.qty);
    }
    for (const ln of lines) {
      if (!ln.pick) continue;
      const it = item(ln.pick), pw = powerOf(it, d.role);
      if (it.cat === 'dcdc' && pw.eff) continue;   // its loss is applied below
      if (pw.w) add(it, pw.w, pw.note || '', it.unit === 'm' ? 1 : ln.qty);
    }
    let total = rows.reduce((s, r) => s + r.w, 0);
    // A 12→5 V converter loses ~10% of what passes through it.
    const conv = lines.find(ln => ln.group === 'dcdc5' && ln.pick);
    if (conv) {
      const hostW = rows.filter(r => { const it = item(r.id); return it && it.power && it.power.supply === '5V'; }).reduce((s, r) => s + r.w, 0);
      const eff = (item(conv.pick).power && item(conv.pick).power.eff) || 0.88;
      const loss = hostW * (1 / eff - 1);
      if (loss > 0) { rows.push({ id: conv.pick, name: item(conv.pick).name, w: loss, note: `${Math.round((1 - eff) * 100)}% conversion loss` }); total += loss; }
    }
    const whDay = total * 24;
    const out = { rows, w: total, whDay };
    // Battery and solar sizing.
    const bat = first(d, 'battery');
    const pan = first(d, 'solar');
    // A unit with its own solar regulator (an ERT-A2's 30 W MPPT) covers the slot.
    const reg = first(d, 'regulator') || coveredBy(d, 'regulator');
    const days = f.power === 'mains_ups' ? (f.upsHours || 0) / 24 : f.autonomy || 0;
    if (bat && bat.hw && bat.hw.ah) {
      const dod = bat.hw.dod || (bat.hw.chem === 'lfp' ? 0.8 : 0.5);
      const v = bat.hw.v || 12;
      const needAh = whDay * days / (v * dod * 0.85);
      const auto = Math.max(1, Math.ceil(needAh / bat.hw.ah - 1e-9));
      const qty = d.sizes.battery || auto;
      out.battery = { needAh, auto, qty, ah: bat.hw.ah * qty, dod, days, short: bat.hw.ah * qty < needAh * 0.98 };
    }
    if (pan && pan.hw && pan.hw.w && f.power === 'solar') {
      const eff = reg && reg.hw && (reg.hw.mppt || reg.hw.mpptW) ? 0.75 : 0.65;
      const needW = whDay * 1.2 / ((f.psh || 3.5) * eff);
      const auto = Math.max(1, Math.ceil(needW / pan.hw.w - 1e-9));
      const qty = d.sizes.solar || auto;
      out.solar = { needW, auto, qty, w: pan.hw.w * qty, eff, short: pan.hw.w * qty < needW * 0.98 };
      if (reg && reg.hw && reg.hw.a) {
        const amps = pan.hw.w * qty / 17.5 * 1.25;
        out.regulator = { amps, rating: reg.hw.a, short: amps > reg.hw.a };
      } else if (reg && reg.hw && reg.hw.mpptW) {
        out.regulator = { name: reg.name, panelW: pan.hw.w * qty, ratingW: reg.hw.mpptW, short: pan.hw.w * qty > reg.hw.mpptW };
      }
    }
    const ups = first(d, 'ups');
    if (ups && f.power === 'mains_ups') {
      const wh = (ups.hw && ups.hw.wh) || 0;
      const load = total + ((ups.hw && ups.hw.selfW) || 0);
      const hours = load > 0 ? wh * 0.8 / load : Infinity;
      out.ups = { wh, hours, short: hours < (f.upsHours || 0) };
    }
    return out;
  }
  function sizedQty(d, slot, it) {
    if (d.sizes && d.sizes[slot]) return d.sizes[slot];
    const pb = powerBudget(d, []);
    if (slot === 'solar' && pb.solar) return pb.solar.auto;
    if (slot === 'battery' && pb.battery) return pb.battery.auto;
    return 1;
  }

  // ── cost ────────────────────────────────────────────────────────────────────

  const GST = 1.1;
  function price(it) {
    if (!it || !it.price || it.price.aud == null) return Infinity;
    return it.price.gst ? it.price.aud : it.price.aud * GST;   // compare inc. GST
  }
  // An item's unit price in the currency and tax setting asked for.
  function unitPrice(it, s, role) {
    if (!it || !it.price) return null;
    const aud = role && it.priceBy && it.priceBy[role] != null ? it.priceBy[role] : it.price.aud;
    if (aud == null) return null;
    return shown(it.price.gst ? aud : aud * GST, s);
  }
  // A figure in AUD including GST, in the currency and tax setting asked for.
  function shown(audInc, s) {
    let v = s.gst ? audInc : audInc / GST;
    if (s.currency === 'USD') v *= s.usdPerAud;
    return v;
  }
  function yearlyPrice(it, s) {
    const y = it && it.yearly;
    if (!y || y.aud == null) return 0;
    let inc = y.gst === false ? y.aud * GST : y.aud;
    let v = s.gst ? inc : inc / GST;
    if (s.currency === 'USD') v *= s.usdPerAud;
    return v;
  }
  function labourPrice(audEx, s) {
    let v = s.gst ? audEx * GST : audEx;
    if (s.currency === 'USD') v *= s.usdPerAud;
    return v;
  }

  // Person-days to install one site, and visits a year to keep it.
  function effort(d) {
    const f = d.f, e = { install: 0, travel: 0, visits: 0, bench: 0, notes: [] };
    const diy = allPicked(d).some(p => tagged(p.it, 'diy') || p.it.cat === 'mcu' || (p.it.cat === 'sbc' && d.role !== 'base'));
    if (d.role !== 'base' && f.onAir === 'bench') {
      e.notes.push('On the bench: no site to install or visit');
    } else if (d.role === 'field') {
      e.install = 2 * (1 + ((f.sensors || []).includes('level') ? 0.5 : 0));   // a crew of two
      e.travel = 1 + ((f.sensors || []).includes('level') ? 0.5 : 0);
      e.visits = 1;
      e.notes.push(`A crew of two for ${e.travel} day${e.travel === 1 ? '' : 's'}${(f.sensors || []).includes('level') ? ' (a level sensor adds half a day)' : ''}`);
    } else if (d.role === 'repeater') {
      e.install = 3; e.travel = 1.5; e.visits = 1;
      e.notes.push('A crew of two for a day and a half — not counting tower work, which is a rigger\'s');
    }
    if (d.role === 'base') {
      const chains = picked(d, 'receivers').reduce((n, p) => n + p.qty, 0) || 1;
      e.install = 1 + chains; e.travel = 0; e.visits = 0;
      e.notes.push(`A day to set up and a day per receive chain to tune and prove (${chains})`);
    }
    if (diy) { e.bench = 1; e.notes.push('A day on the bench to build and test each DIY unit'); }
    return e;
  }

  function costs(d, lines, pb, s) {
    s = Object.assign({}, DEFAULT_SETTINGS, s || {});
    const rows = [];
    let hw = 0, unknown = 0, yearly = 0, oneOff = 0;
    const replace = [];
    const push = (it, qty, slot, why, kind) => {
      const over = d.prices && d.prices[it.id] != null;
      const u = over ? shown(d.prices[it.id], s) : unitPrice(it, s, d.role);
      const total = u == null ? null : u * qty;
      if (u == null) unknown += 1; else if (kind !== 'dev') hw += total;
      const y = yearlyPrice(it, s) * (it.unit === 'm' ? 1 : qty);
      yearly += y;
      if (it.lifeYears && it.lifeYears < s.years && total != null) {
        const n = Math.floor((s.years - 0.001) / it.lifeYears);
        if (n > 0) replace.push({ name: it.name, n, cost: total * n, every: it.lifeYears });
      }
      rows.push({ id: it.id, name: it.name, vendor: it.vendor, cat: it.cat, slot, qty, unit: u, total, yearly: y, why, basis: over ? 'quote-yours' : it.price && it.price.basis, over, kind });
    };
    for (const sl of SLOTS[d.role]) {
      if (!sl.need(d) || coveredBy(d, sl.id)) continue;
      for (const p of picked(d, sl.id)) {
        let qty = p.qty;
        if (sl.sized === 'battery' && pb.battery) qty = pb.battery.qty;
        if (sl.sized === 'solar' && pb.solar) qty = pb.solar.qty;
        push(p.it, qty, sl.label, '', 'slot');
        if (p.it.dev) oneOff += labourPrice((p.it.dev.days || 0) * s.rate, s);
      }
    }
    for (const ln of lines) {
      if (!ln.pick) continue;
      push(item(ln.pick), ln.qty, ln.label, ln.why, 'peripheral');
    }
    const e = effort(d);
    let labour = 0, visit = 0;
    if (s.labour) {
      labour = labourPrice(e.install * s.rate + e.travel * s.travel + e.bench * s.rate, s);
      visit = labourPrice(2 * 0.5 * s.rate + 0.5 * s.travel, s);   // two people, half a day, half a day's travel
    }
    const visitsYear = s.labour ? e.visits * visit : 0;
    const replaceTotal = replace.reduce((a, r) => a + r.cost, 0);
    const tco = hw + labour + (yearly + visitsYear) * s.years + replaceTotal;
    return { rows, hw, unknown, yearly, labour, visitsYear, replace, replaceTotal, oneOff, tco, effort: e, settings: s };
  }

  // ── evaluate ────────────────────────────────────────────────────────────────

  function evaluate(d, settings) {
    normalise(d);
    const reqs = requirements(d);
    const ctx = context(d);
    const slots = [];
    for (const sl of SLOTS[d.role]) {
      const shown = sl.need(d);
      const cov = coveredBy(d, sl.id);
      const cands = shown && !cov ? candidates(d.role, sl.id).map(it => ({ it, fit: fit(d, sl.id, it, ctx) })) : [];
      const picks = picked(d, sl.id).map(p => ({ it: p.it, qty: p.qty, fit: fit(d, sl.id, p.it, ctx) }));
      const freed = freedBy(d, sl.id);
      slots.push({ def: freed ? Object.assign({}, sl, { optional: true, help: `${sl.help ? sl.help + ' ' : ''}Optional here: ${freed.name} does this job on its own.` }) : sl, shown, covered: cov, freed, cands, picks });
    }
    const lines = peripherals(d);
    const pb = powerBudget(d, lines);
    const k = capabilities(d);
    const checks = reqs.map(r => ({ req: r, res: checkOne(d, r, k, pb, slots) }));
    // A slot that is shown, not covered, not optional and empty is its own failure.
    const empty = slots.filter(s => s.shown && !s.covered && !s.def.optional && !s.picks.length);
    const cost = costs(d, lines, pb, settings);
    if (d.f.budget > 0) {
      const ch = checks.find(c => c.req.id === 'budget');
      if (ch) {
        const hwAud = cost.settings.currency === 'USD' ? cost.hw / cost.settings.usdPerAud : cost.hw;
        const hwInc = cost.settings.gst ? hwAud : hwAud * GST;
        ch.res = hwInc <= d.f.budget ? ok(`${money(hwInc)} inc. GST`) : warnS(`${money(hwInc)} inc. GST — over by ${money(hwInc - d.f.budget)}`);
      }
    }
    const pickedFits = slots.flatMap(s => s.picks.map(p => ({ slot: s.def, ...p })));
    const issues = {
      fail: checks.filter(c => c.res.state === 'fail').length + pickedFits.filter(p => p.fit.level === 'fail').length + empty.length,
      warn: checks.filter(c => c.res.state === 'warn').length + pickedFits.filter(p => p.fit.level === 'warn').length,
    };
    const result = { design: d, reqs, slots, lines, power: pb, caps: k, checks, empty, cost, issues };
    result.consequences = consequences(d, result);
    return result;
  }

  function checkOne(d, r, k, pb, slots) {
    if (CHECKS[r.id]) return CHECKS[r.id](d, k);
    const picks = slots.flatMap(s => s.shown && !s.covered ? s.picks : []);
    const judged = picks.map(p => ({ p, rs: p.fit.reasons }));
    if (r.id === 'temp') {
      if (!picks.length) return warnS('Nothing picked yet');
      const rated = lvl => judged.filter(j => j.rs.some(x => /^Rated/.test(x.text) && x.level === lvl));
      const bad = rated('fail'), close = rated('warn');
      const names = list => list.map(j => j.p.it.name).join(', ');
      if (bad.length) return no(`${names(bad)} ${bad.length === 1 ? 'is' : 'are'} well short of it`);
      if (close.length) return warnS(`Marginal: ${names(close)} — shade, ventilate, or pick a wider-rated part`);
      const unk = judged.filter(j => j.rs.some(x => /not published/.test(x.text)));
      return unk.length && d.f.env !== 'indoor' ? warnS(`Unpublished for ${names(unk)}`) : ok('Every rated part copes');
    }
    if (r.id === 'grade') {
      const low = picks.filter(p => p.it.grade != null && !NO_GRADE.has(p.it.cat) && p.it.grade < (GRADE[d.f.grade] || GRADE.balanced).min);
      return low.length ? (r.level === 'must' ? no : warnS)(`Below it: ${low.map(p => p.it.name).join(', ')}`) : ok('Every part meets it');
    }
    if (r.id === 'open') {
      const closed = picks.filter(p => !NO_OPEN.has(p.it.cat) && p.it.open && p.it.open.sw === 'closed');
      return closed.length ? (r.level === 'must' ? no : warnS)(`Closed: ${closed.map(p => p.it.name).join(', ')}`) : ok('No closed software or firmware picked');
    }
    if (r.id === 'support') {
      const comm = picks.filter(p => p.fit.reasons.some(x => /Community support|No support/.test(x.text)));
      return comm.length ? no(`No vendor support: ${comm.map(p => p.it.name).join(', ')}`) : ok('Main equipment is vendor-supported');
    }
    if (r.id === 'compliance') {
      const c = context(d);
      const tx = c.radio;
      if (!tx) return warnS('No transmitter picked yet');
      if (tx.acma === false) return no(`${tx.name} is not compliant — bench use only`);
      if (tx.acma == null) return warnS(`Confirm ${tx.name}'s compliance with the supplier; licence through the network owner or ACMA`);
      return ok(`${tx.name} is compliant; licence it with ACMA (or under the network's licence)`);
    }
    if (r.id === 'power') {
      const p = pb;
      const bits = [];
      let st = 'ok';
      if (p.battery) { bits.push(`${Math.round(p.battery.ah)} Ah battery for ${Math.round(p.battery.needAh)} Ah needed`); if (p.battery.short) st = 'fail'; }
      else if (d.f.power !== 'mains_ups') { bits.push('no battery picked'); st = 'fail'; }
      if (d.f.power === 'solar') {
        if (p.solar) { bits.push(`${Math.round(p.solar.w)} W of panel for ${Math.round(p.solar.needW)} W needed`); if (p.solar.short) st = 'fail'; }
        else { bits.push('no panel picked'); st = 'fail'; }
        if (p.regulator && p.regulator.short) {
          bits.push(p.regulator.ratingW ? `${p.regulator.name}'s regulator takes ${p.regulator.ratingW} W of panel, not ${Math.round(p.regulator.panelW)} W` : `the regulator is ${p.regulator.rating} A for ${p.regulator.amps.toFixed(1)} A`);
          st = 'fail';
        }
      }
      return { state: st, how: bits.join('; ') };
    }
    if (r.id === 'ups') {
      if (!pb.ups) return no('Pick a UPS');
      return pb.ups.short ? no(`About ${pb.ups.hours.toFixed(1)} h at ${fmtW(pb.w)}`) : ok(`About ${pb.ups.hours === Infinity ? 'unlimited' : pb.ups.hours.toFixed(1)} h at ${fmtW(pb.w)}`);
    }
    if (r.id === 'vandal') {
      const enc = first(d, 'enclosure');
      return enc && enc.hw && enc.hw.material === 'steel' ? ok('Steel enclosure') : warnS('Consider a lockable steel enclosure');
    }
    if (r.id === 'budget') return ok('');
    return warnS('Not checked');
  }

  // ── consequences ────────────────────────────────────────────────────────────
  //
  // What follows from the picks, in the words a person deciding needs:
  // firmware and software, openness, compliance, power, environment, time,
  // skills, support, maintenance. Each: { area, level: 'good'|'info'|'warn'|'bad', text, link }.

  function consequences(d, r) {
    const out = [];
    const say = (area, level, text, link) => out.push({ area, level, text, link });
    const f = d.f;
    const picks = r.slots.flatMap(s => s.shown && !s.covered ? s.picks.map(p => p.it) : []);
    const lineItems = r.lines.filter(l => l.pick).map(l => item(l.pick));
    const everything = picks.concat(lineItems);
    // Firmware and software
    const seen = new Set();
    for (const it of picks) {
      if (!it.fw || seen.has(it.fw.name + it.id)) continue;
      seen.add(it.fw.name + it.id);
      const lic = it.fw.lic ? ` (${it.fw.lic})` : '';
      say('Firmware & software', it.fw.open === false ? 'info' : 'good', `${it.name}: ${it.fw.name}${lic}. ${it.fw.note || ''}`.trim(), it.fw.url);
    }
    for (const it of picks.filter(x => x.status === 'planned')) say('Firmware & software', 'bad', `${it.name} does not exist yet. ${it.dev ? `Building it is roughly ${it.dev.days} person-days: ${it.dev.what}` : ''}`.trim(), it.src && it.src[0] && it.src[0][1]);
    for (const it of picks.filter(x => x.status === 'beta')) say('Firmware & software', 'warn', `${it.name} is young: proven on the bench, with little field history. Pilot it before relying on it.`);
    // Openness
    const withSw = picks.filter(it => it.open && !NO_OPEN.has(it.cat));
    const closed = withSw.filter(it => it.open.sw === 'closed');
    const open = withSw.filter(it => it.open.sw === 'open');
    if (withSw.length) {
      if (!closed.length) say('Openness', 'good', `Everything with firmware or software in it is open source (${open.map(i => i.name).join(', ')}). You can read it, fix it, and keep it going if its author stops.`);
      else say('Openness', f.open === 'require' ? 'bad' : 'info', `Closed parts: ${closed.map(i => i.name).join(', ')}. Firmware fixes, features and the life of the product are the vendor's to decide — the lock-in points to weigh.`);
      const openHw = picks.filter(it => it.open && it.open.hw === 'open');
      if (openHw.length) say('Openness', 'good', `Open hardware: ${openHw.map(i => i.name).join(', ')} — schematics published.`);
    }
    // Compliance and licensing
    if (d.role !== 'base' && radioPath(d)) {
      const c = context(d);
      if (f.onAir === 'bench') say('Compliance', 'info', 'Bench only: transmit into a dummy load. Nothing here may go on the air until the transmitter is compliant and licensed.');
      else {
        say('Compliance', 'info', 'A transmitter on a licensed channel runs under an ACMA apparatus licence held by the network owner (the Bureau, a council). A new site, or a change to frequency or power, needs the licence varied or a new one.', 'https://www.acma.gov.au/apparatus-licences');
        if (c.radio && c.radio.acma === false) say('Compliance', 'bad', `${c.radio.name} is not compliant for Australian land-mobile use. Operating it on a licensed channel is an offence under the Radiocommunications Act — penalties apply.`, 'https://www.acma.gov.au/radiocommunications-equipment');
      }
      if (sendsA2(d)) say('Compliance', 'info', 'ALERT2 slots and any new repeater are part of the licence: confirm the frequency and slot plan with the network owner before transmitting.');
    }
    if (d.role === 'base') say('Compliance', 'good', 'Receive-only: a base station needs no transmitter licence.');
    if (f.power === 'mains' || f.power === 'mains_ups') say('Compliance', 'info', 'Mains wiring (anything past a plug-in supply) is a licensed electrician\'s job in Queensland.');
    if (d.role === 'repeater') say('Compliance', 'warn', 'Hilltop and tower work: climbing is for a qualified rigger (working at height, AS/NZS 1891); a site owned by someone else needs an access agreement.');
    // Power
    const pb = r.power;
    if (pb.w > 0) {
      const tail = d.role === 'base' && f.power === 'mains_ups' ? '' : (pb.battery ? ` — ${Math.round(pb.battery.ah)} Ah of battery${pb.solar ? ` and ${Math.round(pb.solar.w)} W of panel` : ''}` : '');
      say('Power', pb.battery && pb.battery.short || pb.solar && pb.solar.short ? 'bad' : 'info', `It averages ${fmtW(pb.w)} (${Math.round(pb.whDay)} Wh a day)${tail}.`);
    }
    const hungry = pb.rows.filter(rw => rw.w > 1.5 && d.role !== 'base').sort((a, b) => b.w - a.w)[0];
    if (hungry && (f.power === 'solar' || f.power === 'battery')) say('Power', 'warn', `${hungry.name} is ${Math.round(hungry.w / pb.w * 100)}% of the load. A logger that sleeps between readings draws a hundredth of it; on solar, the panel and battery are sized for this one part.`);
    const bat = first(d, 'battery');
    if (bat && bat.hw && bat.hw.chem === 'agm' && (f.env === 'sun' || f.env === 'extreme')) say('Power', 'warn', `${bat.name}: a lead-acid battery in a hot enclosure loses life fast — roughly half for every 8–10 °C over 25 °C. Shade it, or plan to replace it every ${bat.lifeYears || 3}–5 years.`);
    if (bat && bat.hw && bat.hw.chem === 'lfp') say('Power', 'info', `${bat.name}: lithium iron phosphate must not be charged below 0 °C — pick one with low-temperature charge protection for frosty sites.`);
    // Environment
    const env = ENV[f.env] || ENV.sun;
    const rated = picks.filter(it => it.temp && it.temp[1] != null && !NO_TEMP.has(it.cat));
    if (rated.length) {
      const weakest = rated.slice().sort((a, b) => a.temp[1] - b.temp[1])[0];
      if (weakest.temp[1] < env.range[1]) say('Environment', 'warn', `The weakest link for heat is ${weakest.name} (${weakest.temp[1]} °C) against ${env.range[1]} °C at the site. A sun shield, a vented box or a shaded mount takes 10–15 °C off.`);
      else say('Environment', 'good', `Every rated part copes with ${env.range[0]} to ${env.range[1]} °C (the coolest-rated is ${weakest.name}, to ${weakest.temp[1]} °C).`);
    }
    for (const it of picks.filter(x => tagged(x, 'linux') && x.hw && x.hw.storage === 'sd')) {
      say('Reliability', 'warn', `${it.name} runs from a microSD card, the usual point of failure in unattended Pis. Use a high-endurance or industrial card, a supply that holds 5 V, and a read-only root file system if the power is unreliable; keep a spare card imaged.`);
    }
    for (const it of picks.filter(x => tagged(x, 'linux') && x.hw && x.hw.storage === 'emmc')) say('Reliability', 'good', `${it.name} boots from eMMC rather than an SD card — far less exposed to power-loss corruption.`);
    // Time
    if (needsGps(d)) say('Time', 'info', 'ALERT2 stamps every report at the source and sends in a GPS-timed slot: the GPS antenna needs a clear view of the sky, and a lost fix costs the slot.');
    for (const it of picks.filter(x => tagged(x, 'pi') && x.hw && !x.hw.rtc)) say('Time', 'info', `${it.name} has no battery clock: it learns the time from the network or a GPS after every power-up. Readings are held until it does.`);
    // Skills
    const need = new Set();
    for (const it of everything) for (const s of it.skills || []) need.add(s);
    const have = new Set(f.skills || []);
    const missing = [...need].filter(s => !have.has(s));
    if (need.size) say('Skills', missing.length ? 'warn' : 'good', missing.length
      ? `This build needs ${missing.map(s => SKILLS[s].toLowerCase()).join(', ')} — skills you did not tick. Budget for training or a contractor.`
      : `It needs ${[...need].map(s => SKILLS[s].toLowerCase()).join(', ')}, which you have.`);
    const e = r.cost.effort;
    if (e.notes.length) say('Skills', 'info', `Effort per site: ${e.notes.join('; ')}.`);
    // Support and lifecycle
    for (const it of picks.filter(x => x.status === 'eol')) say('Support & lifecycle', 'warn', `${it.name} is end of life${it.successor ? ` — ${it.successor}` : ''}. Buy spares now or plan for its replacement.`);
    for (const it of picks.filter(x => x.life)) say('Support & lifecycle', 'info', `${it.name}: ${it.life}`);
    const vendors = {};
    for (const it of picks.filter(x => x.open && x.open.sw === 'closed' && ['alert-unit', 'alert-encoder', 'alert-rx', 'gateway'].includes(x.cat))) vendors[it.vendor] = (vendors[it.vendor] || 0) + 1;
    for (const v of Object.keys(vendors)) say('Support & lifecycle', 'warn', `The ALERT equipment is from one supplier (${v}). Confirm lead times, warranty and firmware support before committing a whole network, and keep about 5% spares.`);
    const community = picks.filter(x => x.support === 'community');
    if (community.length) say('Support & lifecycle', 'info', `Community-supported: ${community.map(x => x.name).join(', ')}. Help comes from forums and GitHub issues, not a support line.`);
    // Maintenance
    if (d.role === 'field' && (f.sensors || []).includes('rain')) say('Maintenance', 'info', 'Clean and test the rain gauge on every visit (leaves, insects, a bucket test); calibrate it yearly.');
    if (d.role !== 'base') say('Maintenance', 'info', `One site visit a year is assumed (${money(r.cost.visitsYear)} a year in labour and travel) — battery, earthing, antenna alignment, enclosure seals.`);
    if (r.cost.replace.length) say('Maintenance', 'info', `Over ${r.cost.settings.years} years: ${r.cost.replace.map(x => `${x.name} replaced ${x.n}× (every ${x.every} years)`).join('; ')}.`);
    // Data path
    if (r.caps.path && r.caps.path.length) say('Data path', 'info', dataPath(d, r));
    return out;
  }

  function dataPath(d, r) {
    const f = d.f, c = context(d);
    if (d.role === 'field') {
      if (f.proto === 'ip') return `Sensors → ${c.controller ? c.controller.name : 'controller'} → ${first(d, 'comms') ? first(d, 'comms').name : 'modem'} → the internet → Flood-Net (HTTPS ingest, MQTT, or BoM HFEM lines over MQTT).`;
      const p = f.proto === 'a1' ? 'ALERT1' : 'ALERT2';
      return `Sensors → ${r.caps.path.join(' → ')} → ${p} on VHF → a repeater or base station in range.`;
    }
    if (d.role === 'repeater') {
      const out = f.mode === 'a1' ? 'ALERT1' : 'ALERT2';
      return `${f.mode === 'a2' ? 'ALERT2' : 'ALERT1'}${f.mode === 'both' ? ' and ALERT2' : ''} in → ${r.caps.path.join(' → ')} → ${out} out${f.ip ? ', and over the internet to Flood-Net' : ''}.`;
    }
    const outs = [...(r.caps.outputs || [])].filter(o => OUTPUT_TEXT[o]).map(o => ({ floodnet: 'Flood-Net', mqtt: 'MQTT', local: 'local log', scada: 'Modbus/DNP3', legacy: 'ALERT software' }[o]));
    return `ALERT on the air → ${r.caps.path.join(' → ')} → ${outs.join(', ') || 'nowhere yet'}.`;
  }

  // ── auto-pick ───────────────────────────────────────────────────────────────
  //
  // Fill each empty slot with the best-fitting candidate, slot by slot in the
  // page's order, so later slots are judged against earlier picks.

  function rankCands(d, cands) {
    const g = d.f.grade;
    return cands.slice().sort((a, b) => {
      const la = LEVEL_RANK[a.fit.level], lb = LEVEL_RANK[b.fit.level];
      if (la !== lb) return la - lb;
      if (!!a.it.def !== !!b.it.def) return a.it.def ? -1 : 1;
      if (g === 'industrial' || g === 'critical') return (b.it.grade || 0) - (a.it.grade || 0) || price(a.it) - price(b.it);
      return price(a.it) - price(b.it) || (b.it.grade || 0) - (a.it.grade || 0);
    });
  }
  function autoPick(d, onlyEmpty = true) {
    normalise(d);
    for (const sl of SLOTS[d.role]) {
      if (!sl.need(d) || coveredBy(d, sl.id) || sl.optional || freedBy(d, sl.id)) continue;
      if (onlyEmpty && picked(d, sl.id).length) continue;
      const ctx = context(d);
      const cands = candidates(d.role, sl.id).map(it => ({ it, fit: fit(d, sl.id, it, ctx) }));
      const best = rankCands(d, cands)[0];
      if (best && best.fit.level !== 'fail') d.picks[sl.id] = [{ id: best.it.id, qty: 1 }];
    }
    return d;
  }

  // A design from a preset (presets.js): its answers and picks, with every
  // slot the preset leaves empty filled with the best fit.
  function fromPreset(p, over) {
    const d = newDesign(p.role, (over && over.name) || p.name);
    d.preset = p.id;
    d.qty = (over && over.qty) || 1;
    Object.assign(d.f, JSON.parse(JSON.stringify(p.f || {})));
    for (const [slot, v] of Object.entries(p.picks || {})) {
      const list = Array.isArray(v) ? v : [v];
      d.picks[slot] = list.map(x => typeof x === 'string' ? { id: x, qty: 1 } : { id: x.id, qty: x.qty || 1 }).filter(x => item(x.id));
    }
    d.per = Object.assign({}, p.per || {});
    d.sizes = Object.assign({}, p.sizes || {});
    normalise(d);
    autoPick(d, true);
    return d;
  }

  // ── network ─────────────────────────────────────────────────────────────────
  //
  // The designs together: totals, and whether what the field sends can reach
  // a base through what the repeaters relay.

  function network(designs, settings) {
    const evs = designs.map(d => ({ d, r: evaluate(d, settings) }));
    const s = Object.assign({}, DEFAULT_SETTINGS, settings || {});
    const t = { hw: 0, labour: 0, yearly: 0, tco: 0, oneOff: 0, unknown: 0, sites: 0, tx: 0, w: 0 };
    for (const { d, r } of evs) {
      t.hw += r.cost.hw * d.qty;
      t.labour += r.cost.labour * d.qty;
      t.yearly += (r.cost.yearly + r.cost.visitsYear) * d.qty;
      t.tco += r.cost.tco * d.qty + r.cost.oneOff;
      t.oneOff += r.cost.oneOff;
      t.unknown += r.cost.unknown;
      t.sites += d.qty;
      t.w += r.power.w * d.qty;
      if (d.role !== 'base' && radioPath(d)) t.tx += d.qty;
    }
    const notes = [];
    const field = designs.filter(d => d.role === 'field'), reps = designs.filter(d => d.role === 'repeater'), bases = designs.filter(d => d.role === 'base');
    const baseA1 = bases.some(b => (b.f.rx || []).includes('a1')), baseA2 = bases.some(b => (b.f.rx || []).includes('a2'));
    const capsOf = new Map(evs.map(({ d, r }) => [d, r.caps]));
    const relays = rd => {
      const m = rd.f.mode, k = capsOf.get(rd) || {};
      return {
        a1: (m === 'a1' || m === 'both') && !!k.a1Repeat,
        conc: m === 'conc' && !!k.conc,
        a2: (m === 'a2' || m === 'both' || (m === 'conc' && !!k.bothAtOnce)) && !!k.a2Repeat,
      };
    };
    const repA1 = reps.some(r => relays(r).a1);
    const repConc = reps.some(r => relays(r).conc);
    const repA2 = reps.some(r => relays(r).a2);
    for (const fd of field) {
      const p = fd.f.proto;
      if (p === 'ip') { notes.push({ level: 'good', text: `${fd.name}: straight to Flood-Net over the internet — no repeater or base needed.` }); continue; }
      if (p === 'a1' || p === 'both') {
        if (baseA1 || (repConc && baseA2)) notes.push({ level: 'good', text: `${fd.name} (ALERT1): heard by ${baseA1 ? 'an ALERT1 base' : 'a concentrator, carried in ALERT2 to an ALERT2 base'}${repA1 ? ', or relayed by an ALERT1 repeater' : ''}.` });
        else if (!bases.length) notes.push({ level: 'warn', text: `${fd.name} (ALERT1): no base station in this plan — fine if it joins a network whose bases already hear it.` });
        else notes.push({ level: 'bad', text: `${fd.name} sends ALERT1, but no base here decodes ALERT1 and no concentrator converts it.` });
      }
      if (p === 'a2' || p === 'both') {
        if (baseA2) notes.push({ level: 'good', text: `${fd.name} (ALERT2): an ALERT2 base receives it${repA2 ? ', directly or through an ALERT2 repeater' : ' directly'}.` });
        else if (!bases.length) notes.push({ level: 'warn', text: `${fd.name} (ALERT2): no base station in this plan — fine if the network's bases already receive ALERT2.` });
        else notes.push({ level: 'bad', text: `${fd.name} sends ALERT2, but no base here receives ALERT2.` });
        if (reps.length && !repA2 && p === 'a2') {
          const oneMode = reps.find(r => r.f.mode === 'conc' && !(capsOf.get(r) || {}).bothAtOnce);
          notes.push({ level: 'warn', text: `${fd.name} sends ALERT2, and none of the repeaters relays ALERT2: it must reach a base directly. ${oneMode ? `${oneMode.name} spends its one receiver on ALERT1 — repeating ALERT2 as well takes a second receiver or unit.` : 'An ALERT1 repeater cannot carry ALERT2.'}` });
        }
      }
    }
    for (const rd of reps) {
      const out = rd.f.mode === 'a1' ? 'a1' : 'a2';
      if (rd.f.mode === 'conc' && !field.some(fd => fd.f.proto === 'a1' || fd.f.proto === 'both')) notes.push({ level: 'info', text: `${rd.name} concentrates ALERT1, and no ALERT1 site is in this plan — fine if it serves legacy gauges already in the network.` });
      if (out === 'a1' && bases.length && !baseA1) notes.push({ level: 'bad', text: `${rd.name} sends ALERT1 on, but no base here decodes ALERT1.` });
      if (out === 'a2' && bases.length && !baseA2) notes.push({ level: 'bad', text: `${rd.name} sends ALERT2 on, but no base here receives ALERT2.` });
    }
    if (bases.length && !field.length && !reps.length) notes.push({ level: 'info', text: 'Receive only: these bases listen to the field stations and repeaters of a network already on the air — add those sites to check the whole path.' });
    if (!bases.length && (field.some(fd => fd.f.proto !== 'ip') || reps.length)) notes.push({ level: 'info', text: 'No base station in the plan. Add one, unless the network you are joining already has bases that hear these sites.' });
    if (baseA1 && baseA2) notes.push({ level: 'info', text: 'Two systems at once: legacy ALERT and ALERT2 run side by side through a transition — two receive chains at each base, one network in the data.' });
    return { evs, totals: t, notes, settings: s };
  }

  // ── formatting shared with the page ─────────────────────────────────────────

  function money(v, s) {
    if (v == null || !isFinite(v)) return '—';
    const cur = s && s.currency === 'USD' ? 'US$' : '$';
    if (v === 0) return `${cur}0`;
    const abs = Math.abs(v);
    const txt = abs >= 100 ? Math.round(abs).toLocaleString('en-AU') : abs.toLocaleString('en-AU', { minimumFractionDigits: abs < 10 ? 2 : 0, maximumFractionDigits: abs < 10 ? 2 : 0 });
    return `${v < 0 ? '−' : ''}${cur}${txt}`;
  }
  function fmtW(w) {
    if (w == null || !isFinite(w)) return '—';
    if (w === 0) return '0 W';
    if (w < 0.01) return `${(w * 1000).toFixed(1)} mW`;
    if (w < 1) return `${Math.round(w * 1000)} mW`;
    if (w < 10) return `${w.toFixed(1)} W`;
    return `${Math.round(w)} W`;
  }

  return {
    ROLE_LIST, ROLES, CATS, SKILLS, ENV, GRADE, FEATURES, SLOTS, GROUPS, DEFAULT_SETTINGS, OUTPUT_TEXT,
    catLabel, catGroup, setCatalog, item, candidates, featuresFor, defaultFeatures, visibleFeatures,
    newDesign, normalise, requirements, fit, evaluate, optionsFor, autoPick, rankCands, network, peripherals, fromPreset,
    powerBudget, unitPrice, yearlyPrice, price, money, fmtW, slotDef, coveredBy, freedBy, picked, context, shown,
    get catalog() { return CATALOG; },
  };
});
