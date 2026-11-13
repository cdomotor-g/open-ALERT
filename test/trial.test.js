// open-ALERT — tests for the side-by-side trial page: the computers to pick
// from, the shopping list and steps that follow the pick, the verdicts, the
// benchmark's figures, and that every page carries the same menu.

'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const SITE = path.join(__dirname, '..', 'site');
const T = require(path.join(SITE, 'js', 'trial.js'));
const K = require(path.join(SITE, 'js', 'builder.js'));
const B = require(path.join(SITE, 'data', 'builder.js'));
const FILES = ['alert', 'compute', 'radio', 'sensors', 'power', 'site'];
const CATALOG = [].concat(...FILES.map(f => require(path.join(SITE, 'data', `${f}.js`))));
K.setCatalog(CATALOG);
const ROLES = ['buy', 'start', 'hot', 'cert', 'open', 'gen', 'tdx', 'notrec', 'comp', 'ref', 'yard', 'out'];
const checkItem = it => {
  assert.ok(['must', 'maybe', 'nice'].includes(it.need), `${it.id}.need`);
  if (it.aud) assert.ok(it.aud[0] > 0 && it.aud[0] <= it.aud[1], `${it.id}.aud`);
  else assert.ok(it.where.length, `${it.id}: no price, so it must at least say where to ask`);
  assert.equal(typeof it.gst, 'boolean', `${it.id}.gst`);
  assert.ok(it.lead.d[0] <= it.lead.d[1] && it.lead.text, `${it.id}.lead`);
  assert.ok(it.where.length, `${it.id}.where`);
  for (const [, u] of [...it.where, ...(it.src || [])]) assert.match(u, /^https?:\/\//);
  if (!(it.src || []).length) assert.equal(it.conf, 'low', `${it.id}: an unsourced figure is an estimate`);
};

test('every part every trial needs is priced or marked unpriced, timed, placed and sourced', () => {
  const ids = new Set();
  for (const it of T.TRIAL.items) {
    assert.ok(!ids.has(it.id), `duplicate ${it.id}`); ids.add(it.id);
    checkItem(it);
  }
  for (const id of ['stick', 'splitter', 'leads', 'eth']) assert.ok(ids.has(id), `the list needs ${id}`);
});

test('the computers to pick from are the builder\'s that are not a Raspberry Pi, and the Verdin AM62 and the Luna are marked as they should be', () => {
  const ids = new Set();
  for (const pk of T.TRIAL.picks) {
    assert.ok(!ids.has(pk.id), `duplicate ${pk.id}`); ids.add(pk.id);
    const P = B.platforms.find(p => p.id === pk.id);
    assert.ok(P, `${pk.id} is not a builder computer`);
    assert.ok(!['pi', 'cm'].includes(P.install), `${pk.id} is a Raspberry Pi`);
    assert.ok(['package', 'verdin'].includes(pk.route) && P.install === pk.route, `${pk.id}: route ${pk.route} against the builder's ${P.install}`);
    assert.ok(ROLES.includes(pk.role), `${pk.id}.role`);
    assert.ok(T.TRIAL.groups.some(g => g[0] === pk.group), `${pk.id}.group`);
    for (const f of ['built', 'why', 'os', 'power']) assert.ok(pk[f] && pk[f].length > 10, `${pk.id}.${f}`);
    const it = CATALOG.find(c => c.id === pk.id);
    assert.ok(it && it.hw && it.hw.sdrCh > 0 && it.hw.ram, `${pk.id}: no speed or memory in the catalogue`);
  }
  // every builder computer that is not a Raspberry Pi and not the Luna can be picked
  const want = B.platforms.filter(p => !['pi', 'cm'].includes(p.install) && p.id !== 'toradex-luna-sl1680').map(p => p.id).sort();
  assert.deepEqual([...ids].sort(), want);
  assert.ok(ids.has('mini-pc-n150'), 'the default is a pick');
  assert.ok(!ids.has('toradex-luna-sl1680'), 'the Luna is comparison only');
  assert.equal(T.TRIAL.picks.find(p => p.id === 'toradex-verdin-am62-mallow').role, 'notrec');
  assert.equal(T.TRIAL.picks.find(p => p.id === 'toradex-verdin-am62-dual-mallow').role, 'notrec');
  assert.equal(T.TRIAL.picks.find(p => p.id === 'toradex-verdin-imx95-mallow').route, 'verdin');
  assert.equal(T.TRIAL.picks.find(p => p.id === 'onlogic-cl260').role, 'buy');
  assert.equal(T.TRIAL.picks.find(p => p.id === 'mini-pc-n150').role, 'start');
  // the first choices are the review's three named computers; the general "fanless industrial x86" entry is not one of them
  assert.deepEqual(T.TRIAL.picks.filter(p => p.role === 'buy').map(p => p.id).sort(), ['lenovo-thinkedge-se10n-gen2', 'onlogic-cl260', 'protectli-vault-vp2430']);
  const gen = T.TRIAL.picks.find(p => p.id === 'fanless-industrial-x86');
  assert.equal(gen.role, 'gen'); assert.notEqual(gen.group, 'first');
  assert.match(gen.why, /depends on the processor/);
  // nobody is told a maker certifies what it does not, or that a page could not be read when it could
  const all = JSON.stringify(T.TRIAL.picks);
  assert.ok(!/certified by the makers of Ubuntu|certified for it/i.test(all), 'the ThinkEdge\'s certification is Lenovo\'s statement');
  assert.ok(!/could not be read/.test(JSON.stringify(T.TRIAL.picks.find(p => p.id === 'lenovo-m920q-tiny-refurb'))), 'Reboot IT\'s page was read');
});

test('every pick draws a shopping list: the computer first, power, a hub where it has one USB port, then the common parts', () => {
  for (const pk of T.TRIAL.picks) {
    const P = B.platforms.find(p => p.id === pk.id);
    const list = T.listFor(pk.id);
    assert.equal(list[0].id, 'computer', pk.id);
    const ids = list.map(i => i.id);
    assert.equal(new Set(ids).size, ids.length, `${pk.id}: duplicate items`);
    for (const it of list) checkItem(it);
    for (const id of ['stick', 'splitter', 'leads', 'eth']) assert.ok(ids.includes(id), `${pk.id} misses ${id}`);
    // the computer's price is the builder's, and a quote stays a quote
    const c = list[0];
    if (P.aud && P.aud[0] != null) assert.deepEqual(c.aud, P.aud, `${pk.id}: price`); else { assert.equal(c.aud, null); assert.ok(c.quote, `${pk.id}: a quote`); }
    // one USB port: the trial's one stick fits, so a hub is on the list for a second stick only, not as something you must buy
    if (P.usb < 2) assert.equal(list.find(i => i.id === 'hub').need, 'maybe', `${pk.id} has ${P.usb} USB port: the hub is for a second stick`);
    else assert.ok(!ids.includes('hub'), `${pk.id} needs no hub`);
    // power follows how it is fed
    if (pk.psu === 'wide' || pk.psu === 'phoenix' || pk.psu === '5v') assert.ok(ids.includes('psu'), `${pk.id} needs a supply`);
    if (pk.psu === 'mains') assert.ok(!ids.includes('psu'), `${pk.id} brings its own adapter`);
    // totals: leave an unpriced thing out, and say how many
    const t = T.totals(list);
    assert.ok(t.lo <= t.hi && t.loAll <= t.hiAll, pk.id);
    assert.equal(t.unpriced, list.filter(i => i.need === 'must' && !i.aud).length, `${pk.id}: unpriced count`);
  }
  assert.ok(T.totals(T.listFor('lenovo-thinkedge-se10n-gen2')).unpriced >= 1, 'the ThinkEdge is by quote and the total says so');
  assert.equal(T.totals(T.listFor('mini-pc-n150')).unpriced, 0);
  assert.ok(T.listFor('toradex-verdin-am62-mallow')[0].name.includes('23111101'), 'the right heatsink');
  // the radio stick has one price on every page: from its maker, to a kit from an Australian shop
  const stick = T.TRIAL.items.find(i => i.id === 'stick'), bStick = B.sdrs.find(s => s.id === 'rtl-sdr-blog-v3');
  assert.deepEqual(stick.aud, bStick.aud, 'the stick\'s price range is the builder\'s');
  assert.deepEqual(stick.aud.map(Math.round), [51, 195]);
});

test('the steps follow the pick: Step 0 is the benchmark, the package route is the default, and no privileged recipe remains', () => {
  for (const pk of T.TRIAL.picks) {
    const steps = T.stepsFor(pk.id);
    assert.ok(steps.length >= 7, pk.id);
    assert.match(steps[0].h, /^Step 0/, `${pk.id}: step 0 is first`);
    const text = JSON.stringify(steps);
    assert.match(text, /firmware\/bench|open-alert-bench/, `${pk.id}: the benchmark`);
    assert.match(text, /nothing has yet been run with a real radio stick|has not yet been run with a real radio stick/i, `${pk.id}: the honest status`);
    assert.ok(!/--privileged/.test(text), `${pk.id}: a privileged container`);
    assert.ok(!/git clone/.test(text), `${pk.id}: a clone of the unsigned main branch`);
    assert.ok(!/MegaNet/.test(text), `${pk.id}: says MegaNet`);
    if (pk.route === 'package') {
      assert.match(text, /open-alert-base/, pk.id);
      assert.match(text, /github\.com\/cdomotor-g\/open-ALERT\/releases/, pk.id);
      assert.ok(!/Torizon/.test(text), `${pk.id}: Torizon on the package route`);
    } else {
      assert.match(text, /Torizon OS/, pk.id);
      assert.match(text, /firmware\/container/, pk.id);
      assert.match(text, /23111101/, `${pk.id}: the right heatsink`);
      assert.match(text, /no special privileges|no privileges/, pk.id);
    }
  }
  const moxa = JSON.stringify(T.stepsFor('moxa-uc-4400a'));
  assert.match(moxa, /powered USB hub/);
  assert.match(JSON.stringify(T.stepsFor('beagley-ai')), /BeagleBoard\.org/);
});

test('the verdicts add both weeks and apply the stated limits', () => {
  const m = id => T.TRIAL.measures.find(x => x.id === id);
  assert.equal(T.verdict(m('decoded'), { pi1: 1000, am1: 990, pi2: 1000, am2: 980 }).cls, 'ok');
  assert.equal(T.verdict(m('decoded'), { pi1: 1000, am1: 900, pi2: 1000, am2: 950 }).cls, 'bad');
  assert.equal(T.verdict(m('busy'), { am1: 55, am2: 72 }).cls, 'bad');
  assert.equal(T.verdict(m('busy'), { am1: 55, am2: 69 }).cls, 'ok');
  assert.equal(T.verdict(m('cpuall'), { am1: 40, am2: 71 }).cls, 'bad');
  assert.equal(T.verdict(m('dropped'), { am1: 0, am2: 0 }).cls, 'ok');
  assert.equal(T.verdict(m('restarts'), { am1: 0, am2: 1 }).cls, 'bad');
  assert.equal(T.verdict(m('snr'), { pi1: 20, pi2: 18, am1: 19, am2: 18.5 }).cls, 'ok');
  assert.equal(T.verdict(m('decoded'), {}), null);
});

test('a gap both computers share is the network\'s, not the trial computer\'s (flag F15)', () => {
  const g = T.TRIAL.measures.find(x => x.id === 'gaps');
  const shared = T.verdict(g, { pi1: 2, am1: 2, pi2: 1, am2: 1 });
  assert.equal(shared.cls, 'ok');
  assert.match(shared.text, /shared with the Pi/);
  const own = T.verdict(g, { pi1: 2, am1: 3, pi2: 0, am2: 0 });
  assert.equal(own.cls, 'bad');
  assert.match(own.text, /1 of its own/);
  // one week's extra gaps are not paid for by the other week's shared ones
  assert.equal(T.verdict(g, { pi1: 0, am1: 2, pi2: 5, am2: 5 }).cls, 'bad');
  // with no Pi figure the page asks for it, and does not call it shared
  const noPi = T.verdict(g, { am1: 1 });
  assert.equal(noPi.cls, 'bad');
  assert.match(noPi.text, /write the Pi/);
  assert.equal(T.verdict(g, { am1: 0, am2: 0 }).cls, 'ok');
  assert.equal(T.verdict(g, {}), null);
});

test('a sheet saved by the earlier trial still reads: every measure it used is still there with its key', () => {
  const ids = T.TRIAL.measures.map(m => m.id);
  for (const id of ['decoded', 'undecoded', 'snr', 'busy', 'dropped', 'temp', 'watts', 'gaps']) assert.ok(ids.includes(id), `the sheet lost ${id}`);
  assert.equal(new Set(ids).size, ids.length);
  const old = { decoded: { pi1: '1200', am1: '1190', pi2: '1100', am2: '1090' }, busy: { am1: '40', am2: '44' }, gaps: { am1: '0', am2: '0' } };
  for (const [id, v] of Object.entries(old)) assert.ok(T.verdict(T.TRIAL.measures.find(m => m.id === id), v), `${id} reads`);
  // and the page reads its saved state defensively
  const src = fs.readFileSync(path.join(SITE, 'js', 'trial.js'), 'utf8');
  assert.match(src, /localStorage\.getItem\(KEY\)/);
  assert.match(src, /try \{ saved = JSON\.parse\(localStorage\.getItem\(KEY\)/);
  assert.match(src, /if \(!pickOf\(T\.pick\)\) T\.pick = DEFAULT_PICK/, 'an unknown pick falls back to the default');
  // the earlier trial's ticks (the module, the carrier) open the page on that computer and count as its one line
  assert.match(src, /if \(!saved\.pick && \(T\.got\.verdin \|\| T\.got\.mallow\)\)/);
  assert.match(src, /T\.pick = 'toradex-verdin-am62-mallow'/);
  assert.ok(T.pickOf('toradex-verdin-am62-mallow'), 'the earlier trial\'s computer can still be picked');
});

test('the benchmark\'s figures are read against the ALERT2 rule and the channels you plan', () => {
  const m = id => T.TRIAL.bench.find(x => x.id === id);
  assert.equal(T.benchVerdict(m('core'), { core: 3.1 }, 4).cls, 'ok');
  assert.equal(T.benchVerdict(m('core'), { core: 1.2 }, 4).cls, 'warn');
  assert.equal(T.benchVerdict(m('core'), { core: 0.6 }, 4).cls, 'bad');
  assert.equal(T.benchVerdict(m('comfy'), { comfy: 12 }, 4).cls, 'ok');
  assert.equal(T.benchVerdict(m('comfy'), { comfy: 3 }, 4).cls, 'bad');
  assert.equal(T.benchVerdict(m('ok'), { ok: 'yes' }, 4).cls, 'ok');
  assert.equal(T.benchVerdict(m('ok'), { ok: 'no' }, 4).cls, 'bad');
  assert.equal(T.benchVerdict(m('core'), {}, 4), null);
});

test('the Verdin fold names all six AM62s by Toradex part number, with the corrected prices and the right heatsink', () => {
  const v = T.TRIAL.variants;
  assert.equal(v.length, 6);
  for (const x of v) {
    assert.match(x.pid, /^007[1-6]12\d\d$/, `${x.name}: ${x.pid}`);
    assert.ok(['notrec', 'out'].includes(x.pick), `${x.pid}: no AM62 is recommended`);
    if (x.cores === 1) assert.equal(x.pick, 'out', `${x.pid} is a Solo`);
    assert.ok(x.usd == null || x.usd > 100, `${x.pid}: the old US$107.40 is gone`);
  }
  assert.equal(v.find(x => x.pid === '00761200').usd, 306.00);
  assert.equal(v.find(x => x.pid === '00741201').usd, 206.25);
  assert.equal(T.TRIAL.verdinParts.mallow.usd, 100.65);
  assert.equal(T.TRIAL.verdinParts.heatsink.code, '23111101');
  assert.equal(T.TRIAL.verdinParts.imx95.usd, 337.50);
  assert.equal(T.TRIAL.verdinParts.imx95.code, '0227');
});

test('the comparison rows below are catalogued computers, and the Luna is comparison only', () => {
  const o = T.TRIAL.others;
  for (const x of o) {
    const it = CATALOG.find(c => c.id === x.ref);
    assert.ok(it, `${x.ref}: not in the catalogue`);
    assert.ok(it.hw && it.hw.sdrCh > 0 && it.hw.ram, `${x.ref}: no memory or speed`);
    assert.ok(['cat', 'luna', 'pi'].includes(x.group) && x.short && x.why, `${x.ref}: incomplete row`);
    assert.ok(ROLES.includes(x.role), `${x.ref}.role`);
  }
  for (const id of ['toradex-luna-sl1680', 'rpi-zero-2w', 'rpi-3b-plus', 'rpi-4-4gb', 'rpi-5-4gb', 'rpi-cm5-io', 'eurotech-reliacor-40-13', 'dell-optiplex-micro', 'olimex-imx8mp-som-evb']) assert.ok(o.some(x => x.ref === id), `the table misses ${id}`);
  assert.equal(o.find(x => x.ref === 'toradex-luna-sl1680').role, 'comp');
  assert.equal(CATALOG.find(c => c.id === 'toradex-luna-sl1680').conf, 'low');
});

test('the corrected sums: the Pi 4 is the yardstick, the N150 meets the buying rule, the AM62 and Pi 3B+ bite on one core', () => {
  const spec = id => { const p = { ref: id }; return { cap: K.capacity(p), one: K.oneCore(p), cores: K.cores(p) }; };
  const plan = K.planSticks([151.5, 151.525, 151.95, 152.4], 'auto');
  const use = id => { const s = spec(id), L = K.load(plan, { traffic: 'busy', decoder: 'filter-once' }); return { whole: L.total / s.cap, one: L.worst.need / s.one }; };
  const pi4 = use('rpi-4-4gb');
  assert.ok(pi4.whole > 0.5 && pi4.whole < 0.7, 'a Pi 4 at about 55–62% for four channels');
  assert.ok(use('mini-pc-n150').whole < pi4.whole);
  assert.ok(use('toradex-verdin-am62-mallow').one > 1, 'a channel is more than one AM62 core');
  const r = B.model.rule;
  const meets = id => { const s = spec(id); return s.cores >= r.cores && s.one >= r.oneCore; };
  assert.ok(meets('mini-pc-n150') && meets('onlogic-cl260') && !meets('rpi-4-4gb') && !meets('beagley-ai') && !meets('moxa-uc-4400a'));
});

test('every word the page marks has a plain meaning, and the page lists them where a finger can read them', () => {
  for (const [k, [w, m]] of Object.entries(T.TERMS)) {
    assert.ok(w && m.length > 40, `${k}: a real meaning`);
    assert.ok(!/MegaNet/.test(m), `${k}: says MegaNet`);
  }
  const src = fs.readFileSync(path.join(SITE, 'js', 'trial.js'), 'utf8');
  const used = new Set([...src.matchAll(/\bterm\('([a-z0-9]+)'/g)].map(x => x[1]));
  for (const k of used) assert.ok(T.TERMS[k] || K.TERMS[k], `term('${k}') has no meaning`);
  const order = (src.match(/const TERM_ORDER = \[([^\]]*)\]/) || [])[1] || '';
  for (const k of used) assert.ok(order.includes(`'${k}'`), `term '${k}' is not in the readable list`);
  const html = fs.readFileSync(path.join(SITE, 'trial.html'), 'utf8');
  assert.match(html, /id="trial-terms"/);
});

test('the page no longer carries what the review overturned', () => {
  const html = fs.readFileSync(path.join(SITE, 'trial.html'), 'utf8');
  const js = fs.readFileSync(path.join(SITE, 'js', 'trial.js'), 'utf8');
  assert.ok(!/Under review|hold off buying/i.test(html), 'the hold-off notice');
  for (const [name, s] of [['trial.html', html], ['trial.js', js]]) {
    assert.ok(!/107\.40/.test(s), `${name}: the old Toradex price`);
    assert.ok(!/Aquila AM69/.test(s), `${name}: the mistitled listing's story`);
    assert.ok(!/--privileged|git clone/.test(s), `${name}: the privileged recipe`);
    assert.ok(!/half a Pi 4 for decoding/i.test(s), `${name}: "half a Pi 4" as fact`);
    assert.ok(!/MegaNet/.test(s.replace(/github\.com\/cdomotor-g\/MegaNet/g, '')), `${name}: says MegaNet`);
  }
  assert.ok(!/two thirds of the cheaper|a third of the Quad/.test(html), 'the stale decoder claims');
  // the firmware's status is dated, points at its own notes, and does not say the container or the images exist
  assert.match(html, /As at \d+ \w+ 20\d\d/);
  assert.match(html, /blob\/main\/firmware\/README\.md/);
  assert.match(html, /the container has only been tried with stand-ins for the radio/);
  assert.match(html, /the disk images are still being written/);
  assert.ok(!/tests are unfinished/.test(html + js), 'the stale status');
  // the two figures for a full ALERT2 channel are told apart
  assert.match(html, /1\.1–1\.3 Pi 4 cores of work for its messages alone, and 1\.2–1\.8/);
  // the other words on the page come from the one list the Other computers page uses
  assert.ok(html.indexOf('data/review.js') > 0 && html.indexOf('data/review.js') < html.indexOf('js/builder.js'), 'trial.html loads the shared list of meanings before the scripts that use it');
  assert.ok(!/legacy/i.test(html), 'older ALERT, not legacy');
  assert.match(html, /Side-by-side trial/);
  assert.match(html, /Step 0|benchmark/);
});

test('every page has the same menu, reaching every page, and names the trial as the side-by-side trial', () => {
  const pages = ['index.html', 'build.html', 'trial.html', 'hardware.html'];
  const want = ['#configure', '#network', '#catalogue', 'build.html', 'trial.html', 'hardware.html', '#about'];
  for (const p of pages) {
    const s = fs.readFileSync(path.join(SITE, p), 'utf8');
    const nav = s.match(/<nav class="wrap sitenav"[\s\S]*?<\/nav>/);
    assert.ok(nav, `${p} has no site menu`);
    const hrefs = [...nav[0].matchAll(/href="([^"]+)"/g)].map(x => x[1]);
    for (const w of want) assert.ok(hrefs.some(h => h.endsWith(w)), `${p}'s menu misses ${w}`);
    assert.equal((nav[0].match(/aria-current="page"/g) || []).length, 1, `${p}: one current page in the menu`);
    assert.match(nav[0], /<b>Side-by-side trial<\/b><span>beside the Pi<\/span>/, `${p}: the trial's menu wording`);
    assert.ok(!/Mallow trial/.test(nav[0]), `${p}: the old menu wording`);
    assert.ok(!/MegaNet/.test(s.replace(/github\.com\/cdomotor-g\/MegaNet/g, '')), `${p} says MegaNet`);
  }
  const man = fs.readFileSync(path.join(SITE, 'manifest.webmanifest'), 'utf8');
  assert.ok(!/Mallow trial/.test(man));
});

test('the trial list adds delivery once a shop', () => {
  const D = T.delivery(T.listFor('onlogic-cl260').filter(i => i.need === 'must'));
  const names = D.lines.map(l => l.name);
  assert.equal(new Set(names).size, names.length);
  for (const l of D.lines) assert.ok(l.lo >= 0 && l.lo <= l.hi, l.name);
  assert.ok(D.lo <= D.hi);
  // an item with no price adds nothing to a shop's delivery
  const q = T.delivery(T.listFor('lenovo-thinkedge-se10n-gen2').filter(i => i.need === 'must'));
  assert.ok(!q.lines.some(l => /Lenovo/.test(l.name)), 'a quote is not counted for delivery');
});
