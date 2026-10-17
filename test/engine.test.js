// open-ALERT — tests for the catalogue, the presets and the engine.
//
//   node --test test/
//
// Every catalogue record must be well formed and every reference in it must
// resolve; every preset must load, and the ones built from parts you can buy
// today must meet every "must"; and the sizing, pricing and network checks
// must do what the "How it works" page says they do.

'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const SITE = path.join(__dirname, '..', 'site');
const E = require(path.join(SITE, 'js', 'engine.js'));
const FILES = ['alert', 'compute', 'radio', 'sensors', 'power', 'site'];
const CATALOG = [].concat(...FILES.map(f => require(path.join(SITE, 'data', `${f}.js`))));
E.setCatalog(CATALOG);
const P = require(path.join(SITE, 'js', 'presets.js'));

const preset = id => {
  const p = P.designs.find(x => x.id === id);
  assert.ok(p, `no preset ${id}`);
  return E.fromPreset(p);
};
const SETTINGS = Object.assign({}, E.DEFAULT_SETTINGS);
const near = (a, b, tol = 1e-9) => assert.ok(Math.abs(a - b) <= tol * Math.max(1, Math.abs(b)), `${a} ≉ ${b}`);
const NOT_BUYABLE = new Set(['planned', 'diy', 'discontinued']);

// ── the catalogue ────────────────────────────────────────────────────────────

const STATUS = new Set(['current', 'beta', 'eol', 'planned', 'discontinued', 'diy', 'existing']);
const BASIS = new Set(['retail', 'list', 'estimate', 'quote', 'tender', 'used', 'free', 'existing']);
const SUPPORT = new Set(['vendor', 'community', 'limited', 'agency', 'none']);
const OPEN = new Set(['open', 'partial', 'closed']);
const CAN = new Set(['a1-tx', 'a2-tx', 'a1-rx', 'a2-rx', 'a1-iq', 'a1-audio', 'a1-repeat', 'a2-repeat', 'a1-conc', 'radio', 'gps-int', 'logger', 'batt-v', 'ip', 'multi-ch']);

test('every catalogue record is well formed', () => {
  assert.ok(CATALOG.length > 200, `only ${CATALOG.length} parts`);
  const seen = new Set();
  for (const it of CATALOG) {
    const where = `${it.id}`;
    assert.match(it.id, /^[a-z0-9][a-z0-9-]*$/, where);
    assert.ok(!seen.has(it.id), `duplicate id ${it.id}`);
    seen.add(it.id);
    for (const k of ['name', 'vendor', 'blurb']) assert.equal(typeof it[k], 'string', `${where}.${k}`);
    assert.ok(it.name.length > 2, `${where}.name`);
    assert.ok(E.CATS[it.cat], `${where}: unknown category ${it.cat}`);
    assert.ok(Number.isInteger(it.grade) && it.grade >= 1 && it.grade <= 5, `${where}.grade`);
    assert.ok(STATUS.has(it.status), `${where}.status ${it.status}`);
    assert.ok(['high', 'medium', 'low'].includes(it.conf), `${where}.conf`);
    assert.ok(it.price && BASIS.has(it.price.basis), `${where}.price.basis`);
    assert.ok(it.price.aud === null || (typeof it.price.aud === 'number' && it.price.aud >= 0), `${where}.price.aud`);
    assert.equal(it.price.aud === null, it.price.basis === 'quote', `${where}: a blank price is a quote, and a quote is a blank price`);
    if (it.support !== undefined) assert.ok(SUPPORT.has(it.support), `${where}.support`);
    if (it.open) for (const k of ['sw', 'hw']) if (it.open[k] != null) assert.ok(OPEN.has(it.open[k]), `${where}.open.${k}`);
    for (const t of it.can || []) assert.ok(CAN.has(t), `${where}: unknown capability ${t}`);
    if (it.temp) {
      assert.ok(Array.isArray(it.temp) && it.temp.length === 2, `${where}.temp`);
      if (it.temp[0] != null) assert.ok(it.temp[0] < it.temp[1], `${where}.temp`);
    }
    if (it.lifeYears !== undefined) assert.ok(it.lifeYears > 0, `${where}.lifeYears`);
    for (const k of ['pros', 'cons', 'src']) assert.ok(Array.isArray(it[k]), `${where}.${k}`);
    for (const s of it.src) {
      assert.ok(Array.isArray(s) && s.length === 2 && typeof s[0] === 'string', `${where}.src`);
      assert.match(s[1], /^https?:\/\//, `${where}.src ${s[1]}`);
    }
    if (it.power) for (const k of ['w', 'txW', 'rxW', 'peakW']) if (it.power[k] != null) assert.ok(it.power[k] >= 0, `${where}.power.${k}`);
  }
});

test('every slot, cover and link in the catalogue resolves', () => {
  const tags = new Set(CATALOG.flatMap(it => it.tags || []));
  const links = new Set(CATALOG.flatMap(it => it.links || []));
  const roles = new Set(E.ROLE_LIST);
  for (const it of CATALOG) {
    for (const ref of [...(it.slots || []), ...(it.covers || []), ...(it.frees || [])]) {
      const [role, slot] = ref.split(':');
      assert.ok(E.slotDef(role, slot), `${it.id}: no slot ${ref}`);
    }
    for (const r of it.reads || []) assert.ok(links.has(r), `${it.id} reads ${r}, which nothing offers`);
    for (const t of [...(it.radios || []), ...(it.hosts || [])]) assert.ok(tags.has(t), `${it.id}: no part is tagged ${t}`);
    for (const t of (it.hw && it.hw.for) || []) assert.ok(tags.has(t) || roles.has(t), `${it.id}: hw.for names ${t}, which no part or role carries`);
    if (it.successor) assert.equal(typeof it.successor, 'string', `${it.id}.successor`);
  }
});

test('every slot has something to choose, and every supporting-part group has options', () => {
  for (const role of E.ROLE_LIST) {
    for (const sl of E.SLOTS[role]) {
      const n = E.candidates(role, sl.id).length;
      assert.ok(n > 0, `${role}:${sl.id} has no candidates`);
    }
  }
  for (const [id, g] of Object.entries(E.GROUPS)) {
    if (id === 'needs') continue;
    const opts = CATALOG.filter(it => g.cats.includes(it.cat) && (!g.kinds || g.kinds.includes(it.kind)));
    assert.ok(opts.length > 0, `group ${id} offers nothing`);
  }
});

// ── needs and requirements ───────────────────────────────────────────────────

test('every default answer is one of its own options', () => {
  for (const role of E.ROLE_LIST) {
    const d = E.newDesign(role);
    for (const ft of E.visibleFeatures(d)) {
      const v = d.f[ft.id];
      if (ft.type === 'choice') assert.ok(E.optionsFor(ft, role).some(o => o.v === v), `${role}.${ft.id} = ${v}`);
      if (ft.type === 'multi') for (const x of v) assert.ok(E.optionsFor(ft, role).some(o => o.v === x), `${role}.${ft.id} ∋ ${x}`);
      if (ft.type === 'number') assert.ok(v >= ft.min && v <= ft.max, `${role}.${ft.id} = ${v}`);
      if (ft.type === 'bool') assert.equal(typeof v, 'boolean', `${role}.${ft.id}`);
    }
  }
});

test('every requirement traces back to answers that exist', () => {
  const ids = new Set(E.FEATURES.map(f => f.id));
  for (const p of P.designs) {
    for (const r of E.requirements(preset(p.id))) {
      assert.ok(['must', 'should'].includes(r.level), `${p.id}: ${r.id}`);
      for (const f of r.from) assert.ok(ids.has(f), `${p.id}: ${r.id} comes from unknown answer ${f}`);
    }
  }
});

test('a broken answer is put back to its default', () => {
  const d = E.newDesign('field');
  d.f.proto = 'carrier-pigeon';
  d.f.autonomy = 'lots';
  E.normalise(d);
  assert.equal(d.f.proto, E.newDesign('field').f.proto);
});

// ── presets ──────────────────────────────────────────────────────────────────

test('every preset loads, and its picks go in the slots they are picked for', () => {
  for (const p of P.designs) {
    for (const [slot, v] of Object.entries(p.picks || {})) {
      for (const x of Array.isArray(v) ? v : [v]) {
        const id = typeof x === 'string' ? x : x.id;
        const it = E.item(id);
        assert.ok(it, `${p.id}: no part ${id}`);
        assert.ok((it.slots || []).includes(`${p.role}:${slot}`), `${p.id}: ${id} does not go in ${p.role}:${slot}`);
      }
    }
    const r = E.evaluate(preset(p.id), SETTINGS);
    assert.ok(r.cost.hw > 0, `${p.id}: no hardware cost`);
    assert.ok(r.power.w >= 0, `${p.id}: power`);
  }
});

test('presets built from parts you can buy today meet every must', () => {
  let n = 0;
  for (const p of P.designs) {
    const d = preset(p.id);
    const r = E.evaluate(d, SETTINGS);
    if (r.slots.some(s => s.picks.some(x => NOT_BUYABLE.has(x.it.status)))) continue;
    n++;
    assert.deepEqual(r.empty.map(s => s.def.id), [], `${p.id}: empty slots`);
    const failing = r.checks.filter(c => c.res.state === 'fail').map(c => `${c.req.id}: ${c.res.how}`);
    assert.deepEqual(failing, [], `${p.id}`);
    const bad = r.slots.flatMap(s => s.picks).filter(x => x.fit.level === 'fail').map(x => x.it.id);
    assert.deepEqual(bad, [], `${p.id}: picks that do not fit`);
  }
  assert.ok(n >= 14, `only ${n} buyable presets`);
});

test('every example network is built from presets, and nothing in it is cut off', () => {
  for (const net of P.networks) {
    const ds = net.designs.map(x => {
      const p = P.designs.find(y => y.id === x.preset);
      assert.ok(p, `${net.id}: no preset ${x.preset}`);
      return E.fromPreset(p, x);
    });
    const r = E.network(ds, SETTINGS);
    assert.deepEqual(r.notes.filter(n => n.level === 'bad').map(n => n.text), [], net.id);
    assert.equal(r.totals.sites, net.designs.reduce((s, x) => s + x.qty, 0), net.id);
  }
});

// ── power ────────────────────────────────────────────────────────────────────

test('battery and panel are sized as the How it works page says', () => {
  for (const id of ['field-ert-a2-rain', 'field-campbell-alert2', 'rep-ert-a2', 'rep-hse-333x']) {
    const d = preset(id);
    const pb = E.evaluate(d, SETTINGS).power;
    near(pb.whDay, pb.w * 24);
    const bat = E.item(d.picks.battery[0].id);
    const dod = bat.hw.dod || (bat.hw.chem === 'lfp' ? 0.8 : 0.5);
    near(pb.battery.needAh, pb.whDay * d.f.autonomy / (12 * dod * 0.85));
    assert.equal(pb.battery.auto, Math.max(1, Math.ceil(pb.battery.needAh / bat.hw.ah - 1e-9)), id);
    const reg = d.picks.regulator ? E.item(d.picks.regulator[0].id) : E.coveredBy(d, 'regulator');
    near(pb.solar.needW, pb.whDay * 1.2 / (d.f.psh * pb.solar.eff));
    assert.ok([0.75, 0.65].includes(pb.solar.eff), id);
    if (reg && reg.hw && (reg.hw.mppt || reg.hw.mpptW)) assert.equal(pb.solar.eff, 0.75, `${id}: an MPPT controller`);
    assert.ok(!pb.battery.short && !pb.solar.short, `${id}: preset is undersized`);
  }
});

test("an ERT-A2's built-in MPPT takes up to 30 W of panel", () => {
  const d = preset('field-ert-a2-rain');
  let pb = E.evaluate(d, SETTINGS).power;
  assert.equal(pb.solar.eff, 0.75);
  assert.equal(pb.regulator.ratingW, 30);
  assert.ok(!pb.regulator.short);
  d.picks.solar = [{ id: 'victron-40w', qty: 1 }];
  const r = E.evaluate(d, SETTINGS);
  assert.ok(r.power.regulator.short);
  assert.equal(r.checks.find(c => c.req.id === 'power').res.state, 'fail');
});

test('a field radio is powered only to send', () => {
  const d = preset('field-diy-esp32');
  const radio = E.item(d.picks.radio[0].id);
  const row = n => { d.f.txPerDay = n; return E.evaluate(d, SETTINGS).power.rows.find(r => r.id === radio.id); };
  const a = row(100), b = row(200);
  near(b.w - a.w, radio.power.txW * 0.5 * 100 / 86400, 1e-6);
});

test('a longer wet spell takes a bigger battery, and an override sticks', () => {
  const d = preset('field-ert-a2-rain');
  const ten = E.evaluate(d, SETTINGS).power.battery.needAh;
  d.f.autonomy = 20;
  near(E.evaluate(d, SETTINGS).power.battery.needAh, ten * 2);
  d.sizes.battery = 3;
  assert.equal(E.evaluate(d, SETTINGS).power.battery.qty, 3);
});

test('a UPS runs for its battery over the load', () => {
  const d = preset('base-pi4-rtl');
  const pb = E.evaluate(d, SETTINGS).power;
  const ups = E.item(d.picks.ups[0].id);
  near(pb.ups.hours, ups.hw.wh * 0.8 / (pb.w + ups.hw.selfW));
});

// ── prices ───────────────────────────────────────────────────────────────────

test('prices follow the GST and currency settings', () => {
  const ert = E.item('elpro-ert-a2');                  // a planning figure, ex GST
  assert.equal(ert.price.gst, false);
  near(E.unitPrice(ert, Object.assign({}, SETTINGS, { gst: true }), 'field'), ert.price.aud * 1.1);
  near(E.unitPrice(ert, Object.assign({}, SETTINGS, { gst: false }), 'field'), ert.price.aud);
  near(E.unitPrice(ert, Object.assign({}, SETTINGS, { gst: false, currency: 'USD', usdPerAud: 0.69 }), 'field'), ert.price.aud * 0.69);
  near(E.unitPrice(ert, Object.assign({}, SETTINGS, { gst: false }), 'repeater'), ert.priceBy.repeater);
  assert.equal(E.unitPrice(E.item('hse-333x'), SETTINGS, 'repeater'), null);
  assert.equal(E.money(0, SETTINGS), '$0');
  assert.equal(E.money(1234.4, SETTINGS), '$1,234');
  assert.equal(E.money(5.5, SETTINGS), '$5.50');
  assert.equal(E.money(1000, Object.assign({}, SETTINGS, { currency: 'USD' })), 'US$1,000');
});

test('a typed quote replaces the catalogue price in every total', () => {
  const d = preset('rep-hse-333x');
  const before = E.evaluate(d, SETTINGS).cost;
  assert.ok(before.unknown >= 1);
  d.prices = { 'hse-333x': 11000 };                   // AUD inc GST, as the page stores it
  const after = E.evaluate(d, SETTINGS).cost;
  assert.equal(after.unknown, before.unknown - 1);
  near(after.hw, before.hw + 11000, 1e-6);
});

// ── fit ──────────────────────────────────────────────────────────────────────

test('a non-compliant radio is ruled out on the air, and allowed on the bench', () => {
  const d = preset('field-bench');
  d.picks.radio = [{ id: 'baofeng-uv-5r', qty: 1 }];
  d.f.onAir = 'licensed';
  let r = E.evaluate(d, SETTINGS);
  assert.equal(r.checks.find(c => c.req.id === 'compliance').res.state, 'fail');
  d.f.onAir = 'bench';
  r = E.evaluate(d, SETTINGS);
  assert.equal(r.checks.find(c => c.req.id === 'compliance'), undefined);
});

test('"open source only" rules closed parts out; "prefer" only marks them', () => {
  const d = preset('field-diy-esp32');                 // keys a closed Tait radio
  d.f.open = 'require';
  assert.equal(E.evaluate(d, SETTINGS).checks.find(c => c.req.id === 'open').res.state, 'fail');
  d.f.open = 'prefer';
  assert.equal(E.evaluate(d, SETTINGS).checks.find(c => c.req.id === 'open').res.state, 'warn');
});

test('parts are judged against the site temperature, sensors against the air', () => {
  const d = preset('rep-diy-pi');
  d.f.env = 'extreme';
  const pi = E.evaluate(d, SETTINGS).slots.find(s => s.def.id === 'repeater').picks[0];
  assert.equal(pi.fit.level, 'fail');                 // a Pi rated 0–50 °C in a box that reaches 60
  const f = preset('field-ert-a2-river');
  const level = E.evaluate(f, SETTINGS).slots.find(s => s.def.id === 'level').picks[0];
  assert.notEqual(level.fit.level, 'fail');           // a radar in the air, not in the box
});

test('an ERT-A2 base hears one protocol per unit', () => {
  const d = preset('base-elpro');                     // two ERT-A2s: one per protocol
  let k = E.evaluate(d, SETTINGS).caps;
  assert.ok(k.rxA1 && k.rxA2 && !k.oneModeShort);
  d.picks.receivers = [{ id: 'elpro-ert-a2', qty: 1 }];
  k = E.evaluate(d, SETTINGS).caps;
  assert.ok(k.oneModeShort);
  assert.ok(!(k.rxA1 && k.rxA2));
});

test('supporting parts follow the picks', () => {
  const pi = E.evaluate(preset('base-pi4-rtl'), SETTINGS).lines.map(l => l.group);
  assert.ok(pi.includes('sd'), 'a Pi boots from a card');
  assert.ok(pi.includes('coax') && pi.includes('connector'), 'feedline');
  const ert = E.evaluate(preset('field-ert-a2-rain'), SETTINGS).lines.map(l => l.group);
  assert.ok(!ert.includes('sd') && !ert.includes('dcdc5'), 'no boot card or 5 V converter for an ERT-A2');
  assert.ok(ert.includes('surge') && ert.includes('earth'), 'arrestor and earth at a field site');
});

test('a bench design has no site to build, install or visit', () => {
  const d = preset('field-bench');
  let r = E.evaluate(d, SETTINGS);
  const groups = r.lines.map(l => l.group);
  for (const g of ['earth', 'pole', 'surge', 'licence', 'sun-shield']) assert.ok(!groups.includes(g), `bench design gets ${g}`);
  assert.equal(r.cost.effort.install + r.cost.effort.travel + r.cost.effort.visits, 0);
  assert.equal(r.slots.find(s => s.def.id === 'antenna').picks[0].fit.level, 'ok');
  d.f.onAir = 'licensed';
  r = E.evaluate(d, SETTINGS);
  assert.equal(r.slots.find(s => s.def.id === 'antenna').picks[0].fit.level, 'fail', 'a dummy load on the air');
  assert.ok(r.lines.some(l => l.group === 'earth'));
});

// ── the network ──────────────────────────────────────────────────────────────

test('an ALERT1 gauge needs an ALERT1 base or a concentrator', () => {
  const gauge = preset('field-diy-esp32');
  const a2base = preset('base-campbell');
  let notes = E.network([gauge, a2base], SETTINGS).notes;
  assert.ok(notes.some(n => n.level === 'bad'), 'ALERT1 into an ALERT2-only base');
  notes = E.network([gauge, preset('rep-hse-333x'), a2base], SETTINGS).notes;
  assert.ok(!notes.some(n => n.level === 'bad'), 'a concentrator carries it');
});

test('one ERT-A2 cannot concentrate ALERT1 and repeat ALERT2 at once', () => {
  const notes = E.network([preset('field-ert-a2-rain'), preset('rep-ert-a2-conc'), preset('base-pi4-rtl-ert')], SETTINGS).notes;
  assert.ok(notes.some(n => n.level === 'warn' && /one receiver/.test(n.text)), JSON.stringify(notes));
  const ok = E.network([preset('field-ert-a2-rain'), preset('rep-ert-a2'), preset('base-pi4-rtl-ert')], SETTINGS).notes;
  assert.ok(ok.some(n => n.level === 'good' && /ALERT2 repeater/.test(n.text)));
});

test('network totals add up the sites', () => {
  const a = preset('field-ert-a2-rain'), b = preset('base-pi4-rtl');
  a.qty = 3;
  const net = E.network([a, b], SETTINGS);
  const ra = E.evaluate(a, SETTINGS), rb = E.evaluate(b, SETTINGS);
  near(net.totals.hw, ra.cost.hw * 3 + rb.cost.hw, 1e-9);
  assert.equal(net.totals.tx, 3);
});
