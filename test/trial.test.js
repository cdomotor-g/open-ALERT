// open-ALERT — tests for the Mallow trial page's shopping list and verdicts,
// and that every page carries the same menu.

'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const SITE = path.join(__dirname, '..', 'site');
const T = require(path.join(SITE, 'js', 'trial.js'));

test('every item on the trial list is priced, timed, placed and sourced', () => {
  const ids = new Set();
  for (const it of T.TRIAL.items) {
    assert.ok(!ids.has(it.id), `duplicate ${it.id}`); ids.add(it.id);
    assert.ok(['must', 'maybe', 'nice'].includes(it.need), `${it.id}.need`);
    assert.ok(it.aud[0] > 0 && it.aud[0] <= it.aud[1], `${it.id}.aud`);
    assert.equal(typeof it.gst, 'boolean', `${it.id}.gst`);
    assert.ok(it.lead.d[0] <= it.lead.d[1] && it.lead.text, `${it.id}.lead`);
    assert.ok(it.where.length, `${it.id}.where`);
    for (const [, u] of [...it.where, ...it.src]) assert.match(u, /^https?:\/\//);
    if (!it.src.length) assert.equal(it.conf, 'low', `${it.id}: an unsourced figure is an estimate`);
  }
  for (const id of ['verdin', 'mallow', 'heatsink', 'stick', 'splitter']) assert.ok(ids.has(id), `the list needs ${id}`);
});

test('the verdicts add both weeks and apply the stated limits', () => {
  const m = id => T.TRIAL.measures.find(x => x.id === id);
  assert.equal(T.verdict(m('decoded'), { pi1: 1000, am1: 990, pi2: 1000, am2: 980 }).cls, 'ok');
  assert.equal(T.verdict(m('decoded'), { pi1: 1000, am1: 900, pi2: 1000, am2: 950 }).cls, 'bad');
  assert.equal(T.verdict(m('busy'), { am1: 55, am2: 72 }).cls, 'bad');
  assert.equal(T.verdict(m('dropped'), { am1: 0, am2: 0 }).cls, 'ok');
  assert.equal(T.verdict(m('snr'), { pi1: 20, pi2: 18, am1: 19, am2: 18.5 }).cls, 'ok');
  assert.equal(T.verdict(m('decoded'), {}), null);
});

test('every page has the same menu, reaching every page', () => {
  const pages = ['index.html', 'build.html', 'trial.html'];
  const want = ['#configure', '#network', '#catalogue', 'build.html', 'trial.html', '#about'];
  for (const p of pages) {
    const s = fs.readFileSync(path.join(SITE, p), 'utf8');
    const nav = s.match(/<nav class="wrap sitenav"[\s\S]*?<\/nav>/);
    assert.ok(nav, `${p} has no site menu`);
    const hrefs = [...nav[0].matchAll(/href="([^"]+)"/g)].map(x => x[1]);
    for (const w of want) assert.ok(hrefs.some(h => h.endsWith(w)), `${p}'s menu misses ${w}`);
    assert.equal((nav[0].match(/aria-current="page"/g) || []).length, 1, `${p}: one current page in the menu`);
    assert.ok(!/MegaNet/.test(s.replace(/github\.com\/cdomotor-g\/MegaNet/g, '')), `${p} says MegaNet`);
  }
});

test('the module table names every Verdin AM62 by its Toradex part number, and keeps the Solos to small sites', () => {
  const v = T.TRIAL.variants;
  assert.equal(v.length, 6);
  for (const x of v) {
    assert.match(x.pid, /^007[1-6]12\d\d$/, `${x.name}: ${x.pid}`);
    assert.ok(['buy', 'now', 'later', 'small', 'maybe', 'out'].includes(x.pick));
    // A Solo can't carry four channels: a small site at most (0.19's Light, around bursts), or out.
    if (x.cores === 1) assert.ok(['small', 'out'].includes(x.pick), `${x.pid} is a Solo`);
  }
  assert.equal(v.filter(x => x.pick === 'buy').length, 1);
  const verdin = T.TRIAL.items.find(i => i.id === 'verdin');
  assert.ok(verdin.name.includes(v.find(x => x.pick === 'buy').pid), 'the shopping list buys the module the table picks');
});

test('the comparison rows below the Verdins are catalogued computers: the Luna SL1680 and the Raspberry Pi range', () => {
  const FILES = ['alert', 'compute', 'radio', 'sensors', 'power', 'site'];
  const CATALOG = [].concat(...FILES.map(f => require(path.join(SITE, 'data', `${f}.js`))));
  const o = T.TRIAL.others;
  for (const x of o) {
    const it = CATALOG.find(c => c.id === x.ref);
    assert.ok(it, `${x.ref}: not in the catalogue`);
    assert.ok(it.hw && it.hw.sdrCh > 0 && it.hw.cpu && it.hw.ram, `${x.ref}: no CPU, memory or SDR capacity`);
    assert.ok(Array.isArray(it.temp) && typeof it.price.aud === 'number', `${x.ref}: no rating or price`);
    assert.ok(['luna', 'pi'].includes(x.group) && x.short && x.store && x.why, `${x.ref}: incomplete row`);
    assert.ok(['buy', 'now', 'later', 'small', 'maybe', 'out', 'ref', 'paper'].includes(x.pick), `${x.ref}.pick`);
  }
  for (const id of ['toradex-luna-sl1680', 'rpi-zero-2w', 'rpi-3b-plus', 'rpi-4-4gb', 'rpi-5-4gb', 'rpi-cm4-io', 'rpi-cm5-io']) assert.ok(o.some(x => x.ref === id), `the table misses ${id}`);
  // the Luna's CPU is an estimate, and sits between a Pi 4 and a Pi 5
  const cap = id => CATALOG.find(c => c.id === id).hw.sdrCh;
  assert.ok(cap('toradex-luna-sl1680') > cap('rpi-4-4gb') && cap('toradex-luna-sl1680') < cap('rpi-5-4gb'));
  assert.equal(CATALOG.find(c => c.id === 'toradex-luna-sl1680').conf, 'low');
  assert.ok(o.find(x => x.ref === 'toradex-luna-sl1680').est, 'the Luna\'s CPU figure is marked an estimate');
});

test('the trial list adds delivery once a shop', () => {
  const D = T.delivery(T.TRIAL.items.filter(i => i.need === 'must'));
  const names = D.lines.map(l => l.name);
  assert.equal(new Set(names).size, names.length);
  for (const l of D.lines) assert.ok(l.lo >= 0 && l.lo <= l.hi, l.name);
  assert.ok(D.lo <= D.hi);
});
