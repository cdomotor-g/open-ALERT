// open-ALERT — tests for the base-station builder: its data, the stick
// planner and the CPU model against what RPi ALERT's docs say, and that every
// combination of choices builds a bill without a gap.

'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const SITE = path.join(__dirname, '..', 'site');
const FILES = ['alert', 'compute', 'radio', 'sensors', 'power', 'site'];
const CATALOG = [].concat(...FILES.map(f => require(path.join(SITE, 'data', `${f}.js`))));
const K = require(path.join(SITE, 'js', 'builder.js'));
K.setCatalog(CATALOG);
const B = K.B;
const ids = new Set(CATALOG.map(x => x.id));

const options = () => [...B.platforms, ...B.sdrs, ...B.mounts, ...B.antennas, ...Object.values(B.rf), ...B.power, ...B.backhaul, ...B.enclosures, B.gps, ...B.custom];

test('every builder option is well formed and its references resolve', () => {
  for (const o of options()) {
    const where = o.id || o.ref;
    assert.ok(where, 'an option without an id or ref');
    if (o.ref) assert.ok(ids.has(o.ref), `${where}: no catalogue part ${o.ref}`);
    assert.ok(Array.isArray(o.aud) && o.aud.length === 2, `${where}.aud`);
    assert.ok(o.aud[0] === null || (o.aud[0] >= 0 && o.aud[0] <= o.aud[1]), `${where}.aud is not a low–high range`);
    assert.equal(typeof o.gst, 'boolean', `${where}.gst`);
    assert.ok(o.lead && Array.isArray(o.lead.d) && o.lead.d[0] <= o.lead.d[1] && typeof o.lead.text === 'string', `${where}.lead`);
    assert.ok(Array.isArray(o.where), `${where}.where`);
    for (const w of [...o.where, ...(o.src || [])]) assert.match(w[1], /^https?:\/\//, `${where}: ${w[1]}`);
    assert.ok(['high', 'medium', 'low'].includes(o.conf), `${where}.conf`);
    // a figure with no source of its own is an estimate, and says so
    if (!(o.src || []).length && !o.ref && o.aud[1] > 0) assert.equal(o.conf, 'low', `${where}: unsourced figures must be conf 'low'`);
  }
  for (const p of B.platforms) {
    const it = CATALOG.find(x => x.id === p.ref);
    assert.ok(it.hw && it.hw.sdrCh > 0, `${p.id}: the catalogue gives no SDR capacity`);
    assert.ok(['pi', 'cm', 'verdin', 'luna', 'debian'].includes(p.install), `${p.id}.install`);
  }
});

test('every shop the builder buys from has its delivery charge, and the bill charges each once', () => {
  for (const [name, sh] of Object.entries(B.shops)) {
    assert.ok(Array.isArray(sh.ship) && sh.ship.length === 2 && sh.ship[0] >= 0 && sh.ship[0] <= sh.ship[1], `${name}.ship`);
    assert.match(sh.from, /^[A-Z]{2}$/, `${name}.from`);
    if (sh.freeOver != null) assert.ok(sh.freeOver > 0, `${name}.freeOver`);
    assert.ok(Array.isArray(sh.src), `${name}.src`);
    for (const [, u] of sh.src) assert.match(u, /^https?:\/\//, `${name}.src`);
    if (!sh.src.length) assert.equal(sh.conf, 'low', `${name}: an unsourced delivery charge is an estimate`);
  }
  for (const platform of B.platforms) {
    const R = K.build({ platform: platform.id, channels: [151.5, 151.525, 151.95, 152.4], sticks: 'auto', decoder: 'filter-once', traffic: 'busy', kiosk: false,
      sdr: 'rtl-sdr-blog-v4', mount: 'ext-clamp', antenna: 'rfi-col54', coaxM: 20, arrestor: true, power: 'dc12', backhaul: 'lan', enclosure: 'fibox', gps: false });
    const del = R.rows.filter(r => r.section === 'Delivery');
    assert.equal(new Set(del.map(r => r.name)).size, del.length, `${platform.id}: a shop delivers twice`);
    for (const r of del) assert.ok(r.lo >= 0 && r.lo <= r.hi, `${platform.id}: ${r.name}`);
  }
});

test('a stick takes the narrowest window that holds its channels, as RPi ALERT does', () => {
  // Flood-Net's four channels: one stick, 1.44 MHz (hardware.md)
  const four = K.planSticks([151.5, 151.525, 151.95, 152.4], 'auto');
  assert.equal(four.sticks.length, 1);
  assert.equal(four.sticks[0].window.khz, 1440);
  // the Brisbane base's split, 151.425–151.5375 and 151.95–152.4625: 960 kHz each
  assert.equal(K.windowFor(151.5375 - 151.425).khz, 960);
  assert.equal(K.windowFor(152.4625 - 151.95).khz, 960);
  // and the planner never does worse than that split (it finds 151.425–151.95
  // in 960 kHz plus 152.4–152.4625 in 240 kHz: less work for the same sticks)
  const seven = [151.425, 151.5, 151.525, 151.5375, 151.95, 152.4, 152.4625];
  const two = K.planSticks(seven, 2);
  const work = st => st.reduce((a, s) => a + s.chans.length * s.window.rel, 0);
  assert.equal(two.sticks.length, 2);
  assert.ok(work(two.sticks) <= 4 * 3 + 3 * 3);
  // channels within 162 kHz fit 240 kHz less the tuning margin
  assert.equal(K.windowFor(0.1).khz, 240);
  assert.equal(K.windowFor(2.0), null);
  // never more than 8 a stick
  const nine = Array.from({ length: 9 }, (_, i) => 151.4 + i * 0.0125);
  assert.ok(K.planSticks(nine, 'auto').sticks.every(s => s.chans.length <= 8));
  // too far apart for four sticks
  assert.ok(K.planSticks([140, 145, 150, 155, 160], 'auto').error);
});

test('the CPU model agrees with what happened at the Brisbane base', () => {
  const pi4 = B.platforms.find(p => p.id === 'rpi-4-4gb');
  const cap = K.capacity(pi4);
  assert.equal(cap, 4);
  const eight = [151.425, 151.5, 151.5375, 151.525, 151.95, 152.4, 152.4625, 151.575];
  // eight channels in two wide windows with the screen on: overloaded
  const wide = { sticks: [{ chans: eight.slice(0, 4), window: B.model.windows[4] }, { chans: eight.slice(4), window: B.model.windows[4] }] };
  const narrow = K.planSticks(eight, 2);
  const o = { traffic: 'heavy', kiosk: true, decoder: 'today' };
  assert.ok(K.load(wide, o).total / cap > 1, 'two 1.92 MHz windows should overload a Pi 4');
  assert.ok(K.load(narrow, o).total < K.load(wide, o).total, 'narrower windows must cost less');
  // the default four channels are comfortable on a Pi 4 on a rainy day
  const four = K.planSticks([151.5, 151.525, 151.95, 152.4], 'auto');
  assert.ok(K.load(four, { traffic: 'busy' }).total / cap <= B.model.safe);
  // an AM62 couldn't carry eight on the full decoder, and the lighter ones bring it closer
  const am62 = B.platforms.find(p => p.id === 'toradex-verdin-am62-mallow');
  const now = K.load(narrow, { traffic: 'heavy', decoder: 'filter-once' }).total / K.capacity(am62);
  const today = K.load(narrow, { traffic: 'heavy', decoder: 'today' }).total / K.capacity(am62);
  const later = K.load(narrow, { traffic: 'heavy', decoder: 'lean' }).total / K.capacity(am62);
  assert.ok(today > 1 && now < today && later < today / 2);
});

test('every combination of choices builds a complete bill', () => {
  let n = 0;
  for (const platform of B.platforms) for (const sdr of B.sdrs) for (const power of B.power) for (const backhaul of B.backhaul) for (const enclosure of B.enclosures) {
    const S = { platform: platform.id, channels: [151.5, 151.525, 151.95, 152.4, 151.425], sticks: 'auto', decoder: 'today', traffic: 'busy', kiosk: true,
      sdr: sdr.id, mount: 'ext-clamp', antenna: 'rfi-col54', coaxM: 20, arrestor: true, power: power.id, backhaul: backhaul.id, enclosure: enclosure.id, gps: true };
    const R = K.build(S);
    n++;
    assert.ok(R.rows.length >= 8, `${platform.id}: too few lines`);
    for (const r of R.rows) {
      assert.ok(r.name && r.qty > 0, `${platform.id}: a line without a name or quantity`);
      assert.ok(r.lo == null || r.lo <= r.hi, `${r.name}: range`);
    }
    assert.ok(R.total.lo > 0 && R.total.lo <= R.total.hi, 'total range');
    assert.ok(R.steps.length >= 4 && R.steps.every(s => s.items.length), 'build steps');
    assert.ok(R.longest && R.longest.lead.d[1] >= R.likely, 'lead times');
    if (sdr.mount === 'm2' && platform.m2 !== 'b-key') assert.ok(R.warn.some(w => w[0] === 'bad'), `${platform.id} has no USB M.2 slot and should say so`);
    if (backhaul.needsWifi && !platform.wifi) assert.ok(R.warn.some(w => /Wi-Fi/.test(w[1])));
  }
  assert.ok(n > 100);
});

test('the builder\'s pages and catalogue name Flood-Net, not its repository', () => {
  const fs = require('node:fs');
  for (const f of ['build.html', 'js/builder.js', 'data/builder.js']) {
    const s = fs.readFileSync(path.join(SITE, f), 'utf8').replace(/github\.com\/cdomotor-g\/MegaNet/g, '');
    assert.ok(!/MegaNet/.test(s), `${f} says MegaNet`);
  }
});
