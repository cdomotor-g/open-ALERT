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
