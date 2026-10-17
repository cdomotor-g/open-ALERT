// open-ALERT configurator — presets.js
//
//   OA_PRESETS   starting points: designs (one site each, with its answers and
//                its picks) and example networks (designs with quantities).
//                A preset is only a starting point — every answer and pick
//                can be changed, and anything a preset leaves empty is filled
//                with the best fit when it loads.
//
// test/engine.test.js evaluates every preset: each must load, and the ones
// built from things you can buy today must meet every "must".

(function () {
  const designs = [
    // ── field stations ──────────────────────────────────────────────────────
    {
      id: 'field-ert-a2-rain', role: 'field', name: 'ALERT2 rain gauge — ELPRO ERT-A2',
      blurb: 'The Bureau\'s FWIN direction: an ERT-A2 on the existing standpipe, a reference gauge, a Yagi to the repeater.',
      f: { proto: 'a2', sensors: ['rain'], power: 'solar', env: 'sun', grade: 'industrial', support: true },
      picks: { controller: 'elpro-ert-a2', rain: 'kisters-tb3', antenna: 'rfi-yh03', gps: 'gps-active-antenna', solar: 'victron-20w', battery: 'agm-12v-18ah', enclosure: 'existing-standpipe' },
    },
    {
      id: 'field-ert-a2-river', role: 'field', name: 'ALERT2 river gauge — ERT-A2 with radar',
      blurb: 'Rain and river height: an ERT-A2 reading a radar over SDI-12, in a box on its own pole.',
      f: { proto: 'a2', sensors: ['rain', 'level'], levelTech: 'radar', power: 'solar', env: 'sun', grade: 'industrial', support: true },
      picks: { controller: 'elpro-ert-a2', rain: 'kisters-tb4', level: 'vega-vegapuls-c21', antenna: 'rfi-yh03', gps: 'gps-active-antenna', solar: 'victron-20w', battery: 'agm-12v-18ah', enclosure: 'fibox-arca-403015' },
    },
    {
      id: 'field-campbell-alert2', role: 'field', name: 'Campbell ALERT2 station — CR310 + AL200X',
      blurb: 'A Campbell logger with the AL200X in IND mode and Campbell\'s Maxon radio: a full logger behind the ALERT2 link.',
      f: { proto: 'a2', sensors: ['rain', 'level'], levelTech: 'pressure', power: 'solar', env: 'sun', grade: 'industrial', support: true, skills: ['logger'] },
      picks: { controller: 'campbell-cr310', encoder: 'campbell-al200x', radio: 'maxon-sd125e', rain: 'kisters-tb3', level: 'ott-pls-500', antenna: 'sinclair-sy203', gps: 'gps-active-antenna', solar: 'victron-20w', regulator: 'genasun-gv-10', battery: 'agm-12v-18ah', enclosure: 'fibox-arca-403015' },
    },
    {
      id: 'field-campbell-alert200x', role: 'field', name: 'Campbell ALERT200X — either protocol',
      blurb: 'The turn-key AL200X station: ALERT1 today, ALERT2 by a setting at the cut-over.',
      f: { proto: 'both', sensors: ['rain'], power: 'solar', env: 'sun', grade: 'industrial', support: true },
      picks: { controller: 'campbell-alert200x', radio: 'maxon-sd125e', rain: 'kisters-tb4', antenna: 'rfi-yh03', gps: 'gps-active-antenna', solar: 'victron-20w', regulator: 'genasun-gv-10', battery: 'agm-12v-18ah', enclosure: 'fibox-arca-302015' },
    },
    {
      id: 'field-tait-legacy-upgrade', role: 'field', name: 'ALERT1 canister upgrade — ALERT121A + Tait',
      blurb: 'Campbell Australia\'s drop-in canister wired like the ERRTS it replaces, keying a Tait radio.',
      f: { proto: 'both', sensors: ['rain'], power: 'solar', env: 'sun', grade: 'balanced', support: true },
      picks: { controller: 'campbell-alert121a', radio: 'tait-tm9300', rain: 'kisters-tb4', antenna: 'rfi-yh03', gps: 'gps-active-antenna', solar: 'victron-20w', regulator: 'victron-mppt-75-10', battery: 'agm-12v-18ah', enclosure: 'existing-standpipe' },
    },
    {
      id: 'field-diy-esp32', role: 'field', name: 'Open DIY ALERT1 rain gauge — ESP32 + Tait',
      blurb: 'The open route: an ESP32 running open-ALERT\'s planned encoder, keying a compliant land-mobile radio.',
      f: { proto: 'a1', sensors: ['rain'], power: 'solar', env: 'sun', grade: 'budget', open: 'prefer', skills: ['firmware', 'electronics'] },
      picks: { controller: 'olimex-esp32-poe-iso-ind', encoder: 'oa-a1-encoder', radio: 'tait-tm9300', rain: 'kisters-tb4', antenna: 'rfi-yh03', solar: 'exotronic-20w', regulator: 'victron-mppt-75-10', battery: 'agm-12v-7ah', enclosure: 'fibox-arca-302015' },
    },
    {
      id: 'field-pi-zero', role: 'field', name: 'Raspberry Pi field station — Zero 2 W + minimodem',
      blurb: 'What a Pi in the field costs in power: a Linux board awake all day to send a few bursts.',
      f: { proto: 'a1', sensors: ['rain'], power: 'solar', env: 'sun', grade: 'budget', open: 'prefer', skills: ['linux', 'electronics'] },
      picks: { controller: 'rpi-zero-2w', encoder: 'diy-minimodem-encoder', radio: 'tait-tm9300', rain: 'davis-aerocone', antenna: 'rfi-yh03', solar: 'victron-40w', regulator: 'victron-mppt-75-10', battery: 'lfp-12v-20ah', enclosure: 'fibox-arca-403015' },
    },
    {
      id: 'field-ip-campbell', role: 'field', name: 'IP river gauge — CR310 + 4G gateway',
      blurb: 'No ALERT radio: a Campbell logger posting to Flood-Net over the mobile network.',
      f: { proto: 'ip', ipVia: 'cell', sensors: ['rain', 'level'], levelTech: 'radar', power: 'solar', env: 'sun', grade: 'industrial', support: true, skills: ['logger'] },
      picks: { controller: 'campbell-cr310', comms: 'teltonika-trb140', rain: 'kisters-tb4', level: 'vega-vegapuls-c21', solar: 'victron-40w', regulator: 'victron-mppt-75-10', battery: 'agm-12v-40ah', enclosure: 'fibox-arca-403015' },
    },
    {
      id: 'field-ip-diy', role: 'field', name: 'Budget cellular gauge — LilyGO + ultrasonic',
      blurb: 'The cheapest river height that reports itself: an ESP32 with a Cat-M1 modem and an ultrasonic ranger.',
      f: { proto: 'ip', ipVia: 'cell', sensors: ['level'], levelTech: 'ultrasonic', power: 'solar', env: 'sun', grade: 'budget', open: 'prefer', skills: ['firmware', 'electronics'] },
      picks: { controller: 'lilygo-t-sim7080g', level: 'maxbotix-mb7389', solar: 'exotronic-20w', regulator: 'victron-mppt-75-10', battery: 'lfp-12v-12ah', enclosure: 'abs-ip65-box' },
    },
    {
      id: 'field-bench', role: 'field', name: 'Bench prototype — Pico 2 + Baofeng into a dummy load',
      blurb: 'For developing the open encoder: a $10 board and a $40 radio, never on the air.',
      f: { proto: 'a1', sensors: ['rain'], power: 'mains', autonomy: 1, feedM: 1, env: 'indoor', grade: 'budget', open: 'prefer', onAir: 'bench', skills: ['firmware', 'electronics'] },
      picks: { controller: 'rpi-pico-2', encoder: 'oa-a1-encoder', radio: 'baofeng-uv-5r', rain: 'davis-aerocone', antenna: 'dummy-load-50w', battery: 'agm-12v-7ah', psu: 'meanwell-drc-40a', enclosure: 'abs-ip65-box' },
    },
    // ── repeaters ───────────────────────────────────────────────────────────
    {
      id: 'rep-ert-a2-conc', role: 'repeater', name: 'ALERT2 concentrator — ELPRO ERT-A2',
      blurb: 'The transition plan\'s backbone: hear the legacy stations, send their readings on in an ALERT2 slot.',
      f: { mode: 'conc', freqPlan: 'simplex', power: 'solar', env: 'sun', grade: 'industrial', support: true },
      picks: { repeater: 'elpro-ert-a2', antenna: 'rfi-col54', gps: 'gps-active-antenna', solar: 'victron-20w', battery: 'victron-agm-110ah', enclosure: 'fibox-arca-403015' },
      per: { pole: 'existing-mast' },
    },
    {
      id: 'rep-ert-a2', role: 'repeater', name: 'ALERT2 repeater — ELPRO ERT-A2',
      blurb: 'An ALERT2 backbone hop: one ERT-A2 repeating ALERT2 in its own GPS-timed slot.',
      f: { mode: 'a2', freqPlan: 'simplex', power: 'solar', env: 'sun', grade: 'industrial', support: true },
      picks: { repeater: 'elpro-ert-a2', antenna: 'rfi-col54', gps: 'gps-active-antenna', solar: 'victron-20w', battery: 'victron-agm-110ah', enclosure: 'fibox-arca-403015' },
      per: { pole: 'existing-mast' },
    },
    {
      id: 'rep-hse-333x', role: 'repeater', name: 'ALERT2 repeater / concentrator — HSE 333X',
      blurb: 'The US benchmark repeater: concentrates ALERT1, repeats ALERT2 — but rated only to 50 °C.',
      f: { mode: 'conc', freqPlan: 'simplex', power: 'solar', env: 'shelter', grade: 'industrial', support: true },
      picks: { repeater: 'hse-333x', antenna: 'rfi-col54', gps: 'gps-active-antenna', solar: 'victron-40w', regulator: 'victron-mppt-75-10', battery: 'victron-agm-110ah', enclosure: 'fibox-arca-604021' },
      per: { pole: 'existing-mast' },
    },
    {
      id: 'rep-diy-pi', role: 'repeater', name: 'Open DIY ALERT1 repeater — Pi 4 + RTL-SDR + Tait',
      blurb: 'Open hardware anyone can buy, running software open-ALERT has yet to write: hear on an SDR, send on a Tait.',
      f: { mode: 'a1', freqPlan: 'simplex', power: 'solar', env: 'shelter', grade: 'balanced', open: 'prefer', skills: ['linux', 'electronics'] },
      picks: { repeater: 'rpi-4-4gb', software: 'oa-repeater', receiver: 'rtl-sdr-blog-v3', encoder: 'diy-minimodem-encoder', radio: 'tait-tm9300', antenna: 'rfi-col54', solar: 'exotronic-115w', regulator: 'victron-mppt-75-15', battery: 'itechworld-100ah', enclosure: 'fibox-arca-604021' },
      per: { pole: 'existing-mast' },
    },
    // ── base stations ───────────────────────────────────────────────────────
    {
      id: 'base-pi4-rtl', role: 'base', name: 'Budget ALERT1 base — Pi 4 + RTL-SDR (RPi ALERT)',
      blurb: 'The cheapest unattended base: four ALERT1 channels from one stick, posted to Flood-Net.',
      f: { rx: ['a1'], channels: 4, outputs: ['floodnet'], power: 'mains_ups', upsHours: 4, env: 'indoor', grade: 'budget', open: 'prefer', skills: ['linux'] },
      picks: { host: 'rpi-4-4gb', receivers: 'rtl-sdr-blog-v3', software: 'rpi-alert', antenna: 'vhf-dipole-unity', comms: 'office-network', ups: 'eaton-5e650', enclosure: 'indoor-shelf' },
    },
    {
      id: 'base-pi4-rtl-ert', role: 'base', name: 'Both protocols — Pi 4 + RTL-SDR + ERT-A2 (RPi ALERT)',
      blurb: 'ALERT1 from the stick, ALERT2 (and concentrated ALERT1) from an ERT-A2, one antenna split between them.',
      f: { rx: ['a1', 'a2'], channels: 4, outputs: ['floodnet'], power: 'mains_ups', env: 'indoor', grade: 'balanced', skills: ['linux'] },
      picks: { host: 'rpi-4-4gb', receivers: ['rtl-sdr-blog-v3', 'elpro-ert-a2'], software: 'rpi-alert', antenna: 'rfi-col54', comms: 'office-network', ups: 'dc-ups-drc60-18ah', enclosure: 'indoor-shelf' },
    },
    {
      id: 'base-industrial', role: 'base', name: 'Industrial base — reComputer R1113 (CM4) + RTL-SDR + ERT-A2',
      blurb: 'The same software on an eMMC, 9–36 V, DIN-rail Compute Module box, with a cavity filter and a 4G link.',
      f: { rx: ['a1', 'a2'], channels: 4, outputs: ['floodnet'], power: 'mains_ups', backhaul: 'cell', env: 'shelter', grade: 'industrial', skills: ['linux'] },
      picks: { host: 'seeed-recomputer-r1113', receivers: ['rtl-sdr-blog-v3', 'elpro-ert-a2'], software: 'rpi-alert', antenna: 'rfi-col54', filter: 'vhf-cavity-bandpass', comms: 'teltonika-rut241', ups: 'dc-ups-drc60-18ah', enclosure: 'fibox-arca-604021' },
    },
    {
      id: 'base-elpro', role: 'base', name: 'Turn-key ELPRO base — ERT-A2s + 115E-2-A2 gateway',
      blurb: 'No computer: two ERT-A2 receivers (one per protocol) into a DIN-rail gateway that publishes MQTT, Modbus and DNP3.',
      f: { rx: ['a1', 'a2'], channels: 1, outputs: ['floodnet', 'scada'], power: 'mains_ups', env: 'shelter', grade: 'industrial', support: true },
      picks: { receivers: [{ id: 'elpro-ert-a2', qty: 2 }], gateway: 'elpro-115e2-a2', antenna: 'rfi-col54', comms: 'office-network', ups: 'dc-ups-drc60-18ah', enclosure: 'fibox-arca-604021' },
    },
    {
      id: 'base-desk-pc', role: 'base', name: 'Desk trial — Windows PC + Quansheng (Serial Monitor)',
      blurb: 'Try it today with what is on the desk: a $50 radio on the ALERT firmware, read by Flood-Net in Chrome.',
      f: { rx: ['a1'], channels: 1, outputs: ['floodnet'], power: 'mains_ups', upsHours: 1, env: 'indoor', grade: 'budget', remote: false },
      picks: { host: 'existing-windows-pc', receivers: 'quansheng-uv-k5-v3', software: 'floodnet-serial-monitor', antenna: 'diy-ground-plane', comms: 'office-network', ups: 'apc-bx950mi', enclosure: 'indoor-shelf' },
    },
    {
      id: 'base-fwlab-x86', role: 'base', name: 'GNU Radio lab base — N150 mini PC + Airspy R2 (FW-LAB)',
      blurb: 'A 12-bit receiver for a noisy site, decoded by the FW-LAB GNU Radio receiver and published over MQTT.',
      f: { rx: ['a1'], channels: 1, outputs: ['mqtt', 'local'], power: 'mains_ups', upsHours: 4, env: 'indoor', grade: 'balanced', open: 'prefer', skills: ['linux'] },
      picks: { host: 'mini-pc-n150', receivers: 'airspy-r2', software: 'fwlab-receiver', antenna: 'rfi-col54', filter: 'vhf-cavity-bandpass', comms: 'office-network', ups: 'cyberpower-vp1000', enclosure: 'indoor-shelf' },
    },
    {
      id: 'base-campbell', role: 'base', name: 'Campbell base — AL205B + ALERT2ADM on Windows',
      blurb: 'Campbell\'s base: an ALERT2 receiver into LoggerNet, with SQL storage and alarms.',
      f: { rx: ['a2'], channels: 1, outputs: ['local', 'legacy'], power: 'mains_ups', upsHours: 4, env: 'indoor', grade: 'industrial', support: true, skills: ['logger'] },
      picks: { host: 'mini-pc-n150', receivers: 'campbell-al205b', software: 'campbell-alert2adm', antenna: 'rfi-col54', comms: 'office-network', ups: 'cyberpower-vp1000', enclosure: 'indoor-shelf' },
    },
    {
      id: 'base-survey', role: 'base', name: 'Survey kit — Pi 5 + RTL-SDR + GPS on a battery',
      blurb: 'RPi ALERT\'s survey mode: leave it on a candidate hilltop for three days and see what it hears.',
      f: { rx: ['a1'], channels: 4, outputs: ['floodnet', 'local'], power: 'battery', autonomy: 3, backhaul: 'none', survey: true, env: 'shelter', grade: 'budget', skills: ['linux'] },
      picks: { host: 'rpi-5-4gb', receivers: 'rtl-sdr-blog-v3', software: 'rpi-alert', antenna: 'rfi-col53', gps: 'usb-gps-puck', battery: 'itechworld-100ah', enclosure: 'fibox-arca-403015' },
    },
  ];

  const networks = [
    {
      id: 'small-catchment', name: 'A small catchment moving to ALERT2',
      blurb: 'six rain gauges and two river gauges on ELPRO ERT-A2s, an ALERT2 repeater on the hill, and a Pi base station that still hears the legacy ALERT1 network too',
      designs: [
        { preset: 'field-ert-a2-rain', name: 'Rain gauge', qty: 6 },
        { preset: 'field-ert-a2-river', name: 'River gauge', qty: 2 },
        { preset: 'rep-ert-a2', name: 'Hilltop repeater', qty: 1 },
        { preset: 'base-pi4-rtl-ert', name: 'Council base station', qty: 1 },
      ],
    },
    {
      id: 'open-trial', name: 'An open, low-cost trial',
      blurb: 'open DIY rain gauges, a DIY repeater and a Pi base — what open-ALERT is working toward',
      designs: [
        { preset: 'field-diy-esp32', name: 'DIY rain gauge', qty: 4 },
        { preset: 'rep-diy-pi', name: 'DIY repeater', qty: 1 },
        { preset: 'base-pi4-rtl', name: 'Pi base station', qty: 1 },
      ],
    },
    {
      id: 'campbell-network', name: 'A Campbell ALERT2 network',
      blurb: 'CR310 + AL200X gauges, an HSE concentrator and a Campbell base',
      designs: [
        { preset: 'field-campbell-alert2', name: 'Campbell gauge', qty: 5 },
        { preset: 'rep-hse-333x', name: 'Concentrator', qty: 1 },
        { preset: 'base-campbell', name: 'Campbell base', qty: 1 },
      ],
    },
    {
      id: 'ip-gauges', name: 'Gauges over the mobile network',
      blurb: 'no ALERT radio at all: IP gauges posting straight to Flood-Net',
      designs: [
        { preset: 'field-ip-campbell', name: 'Logger gauge (4G)', qty: 3 },
        { preset: 'field-ip-diy', name: 'Budget gauge (Cat-M1)', qty: 5 },
      ],
    },
    {
      id: 'listen', name: 'Listening to an existing network',
      blurb: 'receive-only bases: a Pi on the roof and a radio on a desk',
      designs: [
        { preset: 'base-pi4-rtl', name: 'Pi base station', qty: 1 },
        { preset: 'base-desk-pc', name: 'Desk trial', qty: 1 },
        { preset: 'base-survey', name: 'Survey kit', qty: 1 },
      ],
    },
  ];

  const P = { designs, networks };
  if (typeof module === 'object' && module.exports) module.exports = P;
  else globalThis.OA_PRESETS = P;
})();
