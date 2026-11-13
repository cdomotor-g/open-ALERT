// open-ALERT — tests for the hardware review page (site/hardware.html): that
// every computer, claim, photograph and word in site/data/review.js is complete
// and names a research report that exists, that the filters, the sorting, the
// compare list and the bills work, and that the page is wired into the site.

'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const SITE = path.join(ROOT, 'site');
const RESEARCH = path.join(ROOT, 'docs', 'hardware-review', 'research');
const R = require(path.join(SITE, 'data', 'review.js'));
const IMG = require(path.join(SITE, 'data', 'review-images.js'));
const K = require(path.join(SITE, 'js', 'review.js'));

const read = f => fs.readFileSync(path.join(SITE, f), 'utf8');
const byId = id => R.computers.find(c => c.id === id);
const reportIds = new Set(R.reports.map(r => r.id));
const termIds = new Set(R.terms.map(t => t.id));

// Every piece of text in the data, with where it is, and every web address.
function strings(v, where, out) {
  if (typeof v === 'string') out.push([where, v]);
  else if (Array.isArray(v)) v.forEach((x, i) => strings(x, `${where}[${i}]`, out));
  else if (v && typeof v === 'object') for (const k of Object.keys(v)) strings(v[k], `${where}.${k}`, out);
  return out;
}
const TEXT = strings(R, 'review', []);
const isUrl = s => /^https?:\/\//.test(s);

test('the research is all listed (thirteen reports and three re-checks: sixteen files), and each file exists', () => {
  const files = fs.readdirSync(RESEARCH).filter(f => f.endsWith('.md')).sort();
  assert.equal(R.reports.length, 16);
  assert.deepEqual(R.reports.map(r => r.file).sort(), files, 'the list and the folder differ');
  assert.equal(reportIds.size, R.reports.length, 'a report id is repeated');
  for (const r of R.reports) {
    assert.ok(r.title && r.covers, `${r.id}: a title and what it covers`);
    assert.equal(K.reportUrl(r.id), R.REV + r.file);
  }
  assert.equal(R.REV, 'https://github.com/cdomotor-g/open-ALERT/blob/main/docs/hardware-review/research/');
});

test('every computer has a group, a verdict, speed figures, a link and a report behind it', () => {
  const ids = new Set();
  assert.ok(R.computers.length >= 18, 'the review compares at least eighteen computers');
  for (const c of R.computers) {
    assert.match(c.id, /^[a-z0-9][a-z0-9-]*$/, c.id);
    assert.ok(!ids.has(c.id), `${c.id} is listed twice`); ids.add(c.id);
    for (const k of ['name', 'short', 'why', 'maker', 'country', 'cpu', 'memory', 'ports', 'power', 'cooling', 'secureBoot', 'tpm', 'openText', 'certText', 'os', 'ruleWhy']) {
      assert.ok(typeof c[k] === 'string' && c[k].length > 1, `${c.id}.${k}`);
    }
    assert.ok(R.groups.some(g => g.id === c.group), `${c.id}: group ${c.group}`);
    assert.ok(R.verdicts[c.verdict], `${c.id}: verdict ${c.verdict}`);
    // speed, as times a Raspberry Pi 4, and where the figure comes from
    const s = c.speed;
    assert.ok(s && s.all > 0 && s.core > 0, `${c.id}: speed figures`);
    assert.ok(s.all <= R.speed.allMax && s.core <= R.speed.coreMax, `${c.id}: its bar would run off the chart`);
    assert.ok(typeof s.basis === 'string' && s.basis.length > 20, `${c.id}: where its speed comes from`);
    assert.ok(['stand-in', 'guess', 'memory', 'none', 'yardstick'].includes(s.conf), `${c.id}.speed.conf`);
    if (s.range) assert.ok(s.range[0] <= s.core && s.core <= s.range[1], `${c.id}: the planning figure is outside its own range`);
    assert.ok(['pass', 'likely', 'fail'].includes(c.rule), `${c.id}.rule`);
    // "passes" must follow from the figures; a computer with no figure can only be "likely"
    assert.equal(c.rule === 'pass', K.meets(c), `${c.id}: the ALERT2 rule and its own figures disagree`);
    if (c.rule === 'likely') assert.ok(s.floor, `${c.id}: "likely" is for a computer with no speed figure`);
    if (s.floor) assert.equal(s.conf, 'none', `${c.id}: a floor is not a figure`);
    // what the filters read
    for (const k of ['dc', 'wideTemp', 'cert']) assert.equal(typeof c[k], 'boolean', `${c.id}.${k}`);
    assert.ok(c.fanless === true || c.fanless === false || c.fanless === null, `${c.id}.fanless`);
    assert.ok(['open', 'partial', 'closed'].includes(c.open), `${c.id}.open`);
    assert.ok(['shop', 'quote', 'none'].includes(c.au), `${c.id}.au`);
    if (c.temp) {
      assert.ok(c.temp.length === 2 && c.temp[0] < c.temp[1], `${c.id}.temp`);
      assert.equal(c.wideTemp, c.temp[0] <= -20 && c.temp[1] >= 60, `${c.id}: "wide temperature" and its rating disagree`);
    } else {
      assert.ok(c.tempNote, `${c.id}: no temperature rating and no note saying why`);
      assert.equal(c.wideTemp, false, `${c.id}: wide temperature with no rating`);
    }
    // the firmware it takes
    assert.ok(c.firmware.length, `${c.id}: no form of the firmware`);
    for (const f of c.firmware) assert.ok(R.forms[f], `${c.id}: firmware form ${f}`);
    // price: a figure, or "check with the seller"
    assert.ok(c.price && typeof c.price.text === 'string' && c.price.detail, `${c.id}.price`);
    if (c.price.aud == null) assert.match(c.price.text, /check with the seller/, `${c.id}: no price, so it must say "check with the seller"`);
    else assert.ok(c.price.aud > 0, `${c.id}.price.aud`);
    // where to buy, and the sources
    assert.ok(c.buy.length, `${c.id}: nowhere to buy`);
    for (const b of c.buy) { assert.ok(b.name, `${c.id}: a seller without a name`); assert.match(b.url, /^https:\/\//, `${c.id}: ${b.url}`); assert.equal(typeof b.au, 'boolean', `${c.id}: ${b.name}`); }
    if (c.au !== 'none') assert.ok(c.buy.some(b => b.au), `${c.id}: said to be sold in Australia, with no Australian seller listed`);
    else assert.ok(!c.buy.some(b => b.au), `${c.id}: an Australian seller is listed, but it says none was found`);
    assert.ok(c.links.length, `${c.id}: no sources`);
    for (const l of c.links) { assert.ok(l[0], `${c.id}: a source without a name`); assert.match(l[1], /^https:\/\//, `${c.id}: ${l[1]}`); }
    assert.ok(c.reports.length, `${c.id}: no research report`);
    for (const id of c.reports) {
      assert.ok(reportIds.has(id), `${c.id}: no report ${id}`);
      assert.ok(fs.existsSync(path.join(RESEARCH, R.reports.find(r => r.id === id).file)), `${c.id}: report ${id} is not in the folder`);
    }
    assert.ok(c.good.length && c.watch.length, `${c.id}: what is good, and what to watch`);
    // its picture: a photograph the site may show, or a drawing
    assert.ok(K.KIND[c.draw] && K.DRAW[c.draw], `${c.id}: no drawing for "${c.draw}"`);
    if (c.photo) assert.ok(IMG[c.photo], `${c.id}: no photograph ${c.photo}`);
  }
  for (const g of R.groups) assert.ok(R.computers.some(c => c.group === g.id), `group ${g.id} is empty`);
});

test('the review\'s decisions are the ones on the page', () => {
  // the planning values, as times a Raspberry Pi 4: whole computer / one core
  const want = { 'rpi-4': [1, 1], 'rpi-5': [2.2, 2.2], 'rpi-cm5': [2.2, 2.2], 'verdin-am62': [0.5, 0.5], 'beagleplay': [0.5, 0.5], 'beagley-ai': [0.5, 0.5],
    'moxa-uc4400a': [0.65, 0.65], 'olimex-imx8mp': [0.65, 0.65], 'verdin-imx95': [1.1, 0.75], 'luna-sl1680': [1.2, 1.2], 'fitlet3': [1.8, 1.8],
    'onlogic-cl260': [3, 3], 'lenovo-se10n': [3, 3], 'protectli-vp2430': [3, 3], 'mini-pc-n150': [3, 3] };
  for (const [id, [all, core]] of Object.entries(want)) {
    const c = byId(id);
    assert.ok(c, `no ${id}`);
    assert.deepEqual([c.speed.all, c.speed.core], [all, core], `${id}: speed`);
  }
  // the two older Raspberry Pis in the charts: the Zero 2 W is 0.4, not the 0.25 this site once had
  const others = Object.fromEntries(R.speed.others.map(o => [o.short, o]));
  assert.deepEqual([others['Raspberry Pi 3B+'].all, others['Raspberry Pi 3B+'].core], [0.5, 0.5]);
  assert.deepEqual([others['Raspberry Pi Zero 2 W'].all, others['Raspberry Pi Zero 2 W'].core], [0.4, 0.4]);
  for (const o of R.speed.others) {
    assert.ok(o.basis.length > 20 && o.all <= R.speed.allMax && o.core <= R.speed.coreMax, `${o.short}: a chart row`);
    assert.ok(!R.computers.some(c => c.short === o.short), `${o.short} is in the table already`);
  }
  assert.equal(byId('lenovo-m920q').speed.core, 4);
  assert.equal(byId('lenovo-m920q').speed.conf, 'memory', 'the i5-8500T figure is from memory, and says so');
  assert.equal(byId('verdin-imx95').speed.conf, 'guess', 'the i.MX 95 figure is an estimate, and says so');
  // the rule: at least four cores, each at least 2.5 times a Raspberry Pi 4 core
  assert.deepEqual([R.speed.rule.cores, R.speed.rule.perCore, R.speed.rule.four, R.speed.rule.eight], [4, 2.5, 2.5, 4]);
  // what to buy, and what to leave out
  for (const id of ['onlogic-cl260', 'lenovo-se10n', 'protectli-vp2430']) { assert.equal(byId(id).group, 'first'); assert.equal(byId(id).verdict, 'buy'); assert.equal(byId(id).rule, 'pass'); }
  assert.equal(R.verdicts[byId('verdin-am62').verdict].label, 'Not recommended');
  assert.equal(R.verdicts[byId('luna-sl1680').verdict].label, 'Comparison only');
  for (const id of ['rpi-4', 'rpi-5', 'verdin-am62', 'luna-sl1680', 'moxa-uc4400a', 'fitlet3', 'beagleplay']) assert.equal(byId(id).rule, 'fail', `${id} is short of the ALERT2 rule`);
  // the heatsink that fits, and the one that does not
  const heat = R.claims.find(k => k.id === 'heatsink');
  assert.match(heat.found, /23111101/); assert.match(heat.found, /not compatible Verdin AM62/);
  // the one-port boxes say so
  for (const id of ['moxa-uc4400a', 'beagleplay']) assert.match(byId(id).ports, /^One USB/, `${id}: one USB port`);
});

test('the verdict cards, the ranking, the bills and the boards to start from name real computers', () => {
  assert.ok(R.verdict.line.length > 40);
  assert.ok(R.verdict.cards.length >= 3);
  for (const k of R.verdict.cards) { assert.ok(byId(k.id), `verdict card ${k.id}`); assert.ok(k.head && k.text && ['ok', 'info', 'bad'].includes(k.cls)); }
  for (const cls of ['ok', 'info', 'bad']) assert.ok(R.verdict.cards.some(k => k.cls === cls), `no "${cls}" verdict card`);
  for (const k of R.verdict.cards.filter(x => x.cls === 'ok')) assert.equal(byId(k.id).verdict, 'buy');
  for (const r of R.security.ranking) for (const id of r.ids) assert.ok(byId(id), `ranking: ${id}`);
  for (const b of R.custom.bases) if (b.id) assert.ok(byId(b.id), `a board to start from: ${b.id}`);
  for (const k of R.kits.list) {
    const c = byId(k.id);
    assert.ok(c, `bill for ${k.id}`);
    assert.equal(k.lines.filter(l => l.ref).length, 1, `${k.id}: the computer is on its bill once`);
    assert.ok(k.lines.some(l => /stick/i.test(l.part)), `${k.id}: no radio stick on the bill`);
    if (/^One USB/.test(c.ports)) assert.ok(k.lines.some(l => /hub/i.test(l.part)), `${k.id}: one USB port, and no hub on the bill`);
    for (const l of k.lines) {
      if (l.ref) continue;
      assert.ok(l.part && l.what && l.price, `${k.id}: an unfinished line`);
      assert.ok(l.aud === null || (Array.isArray(l.aud) && l.aud[0] <= l.aud[1]), `${k.id} / ${l.part}: aud`);
      for (const x of l.links || []) assert.match(x[1], /^https:\/\//);
    }
    const t = K.kitTotal(k);
    assert.ok(t.lo <= t.hi && t.unknown >= 0);
    if (c.price.aud == null) assert.ok(t.unknown >= 1, `${k.id}: the computer has no price, so the bill must say a line is missing`);
  }
  // every computer the review says to buy or start with has a bill
  for (const c of R.computers.filter(x => ['first', 'start', 'hot'].includes(x.group))) assert.ok(R.kits.list.some(k => k.id === c.id), `no bill for ${c.id}`);
});

test('every claim about the Mallow trial has a finding, a verdict and a report that exists', () => {
  assert.ok(R.claims.length >= 12);
  const ids = new Set();
  for (const k of R.claims) {
    assert.ok(!ids.has(k.id), `claim ${k.id} twice`); ids.add(k.id);
    assert.ok(k.said && k.found && k.verdict, `claim ${k.id}`);
    assert.ok(['ok', 'info', 'warn', 'bad', 'off'].includes(k.cls), `claim ${k.id}.cls`);
    assert.ok(k.reports.length, `claim ${k.id} names no report`);
    for (const id of k.reports) {
      assert.ok(reportIds.has(id), `claim ${k.id}: no report ${id}`);
      assert.ok(fs.existsSync(path.join(RESEARCH, R.reports.find(r => r.id === id).file)), `claim ${k.id}: ${id} is not in the folder`);
    }
  }
  // each section that draws on the research says which reports
  for (const [name, s] of Object.entries({ security: R.security, speed: R.speed, kits: R.kits, software: R.software, custom: R.custom, radio: R.radio })) {
    assert.ok(s.reports.length, `${name}: no reports`);
    for (const id of s.reports) assert.ok(reportIds.has(id), `${name}: no report ${id}`);
  }
});

test('every photograph shown has its author, licence and source, and its file', () => {
  const used = K.photosUsed();
  assert.ok(used.length >= 1);
  for (const id of used) {
    const im = IMG[id];
    assert.ok(im, `photograph ${id}`);
    for (const k of ['file', 'alt', 'subject', 'author', 'licence', 'changes']) assert.ok(typeof im[k] === 'string' && im[k].length > 1, `${id}.${k}`);
    assert.match(im.licence, /^CC BY(-SA)? \d/, `${id}: a licence that allows reuse`);
    assert.match(im.licenceUrl, /^https:\/\/creativecommons\.org\/licenses\//, `${id}.licenceUrl`);
    assert.match(im.source, /^https:\/\//, `${id}.source`);
    const f = path.join(SITE, 'img', 'hw', im.file);
    assert.ok(fs.existsSync(f), `${id}: ${im.file} is missing`);
    assert.ok(fs.statSync(f).size < 250 * 1024, `${id}: ${im.file} is too large for a phone`);
  }
  // the page shows the credit beside the picture and again in the credits table
  const js = read('js/review.js');
  for (const k of ['im.author', 'im.licence', 'im.licenceUrl', 'im.source', 'im.changes']) assert.ok(js.includes(k), `the page does not show ${k}`);
});

test('every marked word has its meaning in the one list, and every address is https', () => {
  assert.equal(termIds.size, R.terms.length, 'a word is listed twice');
  for (const t of R.terms) {
    assert.ok(t.term && t.meaning && t.meaning.length > 25, `${t.id}: a real meaning`);
    assert.ok(!t.meaning.toLowerCase().startsWith(t.term.toLowerCase() + ' is ' + t.term.toLowerCase()), `${t.id}: the meaning is the word again`);
  }
  let marked = 0;
  for (const [where, s] of TEXT) {
    for (const id of K.termIds(s)) { marked++; assert.ok(termIds.has(id), `${where}: no meaning for "${id}"`); }
    assert.ok(!/\{\{[^|}]*\}\}/.test(s), `${where}: a marked word with no words in it`);
    if (/^https?:/.test(s)) assert.match(s, /^https:\/\/[a-z0-9.-]+\//i, `${where}: ${s}`);
  }
  assert.ok(marked >= 15, 'hardly any word is marked');
  // the filters explain themselves, with a word from the list or a meaning of their own
  for (const f of K.FILTERS) assert.ok(f.term ? termIds.has(f.term) : (f.meaning || '').length > 20, `filter ${f.id}: no meaning`);
});

test('no text says MegaNet, names a model or an AI, or pulls anything from another site', () => {
  const files = ['hardware.html', 'js/review.js', 'data/review.js', 'data/review-images.js', 'review.css'];
  for (const f of files) {
    const s = read(f);
    assert.ok(!/MegaNet/i.test(s.replace(/github\.com\/cdomotor-g\/MegaNet/g, '')), `${f} says MegaNet`);
    assert.ok(!/\b(Claude|Anthropic|ChatGPT|OpenAI|GPT-?\d|Gemini|Copilot|DeepSeek|language model|LLM)\b/i.test(s), `${f} names a model or an AI`);
  }
  const html = read('hardware.html');
  assert.ok(!/<(script|img|link|iframe|video|audio|source)\b[^>]*\b(src|href)="(https?:)?\/\//i.test(html.replace(/<link rel="canonical"[^>]*>/g, '')), 'hardware.html loads something from another site');
  assert.ok(!/@import|url\(\s*['"]?(https?:)?\/\//i.test(read('review.css')), 'review.css loads something from another site');
  assert.ok(!/<img[^>]+src="(https?:)?\/\//i.test(read('js/review.js')), 'the page script shows a picture from another site');
  for (const im of Object.values(IMG)) assert.ok(!/[/:]/.test(im.file), `${im.file}: pictures are kept in site/img/hw/`);
});

test('the filters, the sorting and the compare list work', () => {
  assert.deepEqual(K.FILTERS.map(f => f.id), ['alert2', 'fanless', 'dc', 'wide', 'open', 'au', 'cert']);
  const all = R.computers;
  assert.equal(K.filterComputers(all, []).length, all.length);
  for (const f of K.FILTERS) {
    const got = K.filterComputers(all, [f.id]);
    assert.ok(got.length > 0 && got.length < all.length, `filter ${f.id} keeps ${got.length} of ${all.length}`);
  }
  const ids = on => K.filterComputers(all, on).map(c => c.id);
  assert.ok(ids(['alert2']).includes('onlogic-cl260') && !ids(['alert2']).includes('rpi-5') && !ids(['alert2']).includes('verdin-am62'));
  assert.ok(ids(['fanless', 'dc']).includes('onlogic-cl260') && !ids(['fanless', 'dc']).includes('lenovo-se10n'));
  assert.ok(ids(['wide']).includes('fitlet3') && !ids(['wide']).includes('onlogic-cl260'));
  assert.deepEqual(ids(['open']).sort(), ['beagleplay', 'beagley-ai', 'olimex-imx8mp']);
  assert.ok(ids(['cert']).includes('moxa-uc4400a'));
  assert.ok(!ids(['au']).includes('onlogic-cl260') && ids(['au']).includes('mini-pc-n150'));
  assert.deepEqual(ids(['alert2', 'fanless', 'dc']), ['onlogic-cl260'], 'the battery-site pick is the one that passes all three');
  // filters narrow: two together never show more than either alone
  assert.ok(ids(['fanless', 'wide']).every(id => ids(['fanless']).includes(id) && ids(['wide']).includes(id)));
  // sorting
  assert.deepEqual(K.sortComputers(all, 'group').map(c => c.id), all.map(c => c.id), 'the review\'s own order');
  const core = K.sortComputers(all, 'core').map(c => c.speed.core);
  assert.deepEqual(core, core.slice().sort((a, b) => b - a), 'fastest core first');
  const whole = K.sortComputers(all, 'all').map(c => c.speed.all);
  assert.deepEqual(whole, whole.slice().sort((a, b) => b - a), 'fastest computer first');
  const price = K.sortComputers(all, 'price').map(c => c.price.aud);
  const known = price.filter(p => p != null);
  assert.deepEqual(price.slice(0, known.length), known.slice().sort((a, b) => a - b), 'cheapest first, with no price last');
  assert.ok(price.slice(known.length).every(p => p == null));
  assert.equal(K.sortComputers(all, 'core').length, all.length);
  assert.equal(all[0].id, 'onlogic-cl260', 'sorting must not reorder the data itself');
  for (const s of K.SORTS) assert.ok(K.sortComputers(all, s[0]).length === all.length && s[1]);
  // compare: three at most
  assert.equal(K.MAX_COMPARE, 3);
  let r = K.toggleCompare([], 'a'); assert.deepEqual(r, { ids: ['a'], full: false });
  r = K.toggleCompare(['a', 'b'], 'c'); assert.deepEqual(r.ids, ['a', 'b', 'c']);
  r = K.toggleCompare(['a', 'b', 'c'], 'd'); assert.deepEqual(r, { ids: ['a', 'b', 'c'], full: true });
  r = K.toggleCompare(['a', 'b', 'c'], 'b'); assert.deepEqual(r, { ids: ['a', 'c'], full: false });
});

test('the software section is dated, points at the firmware\'s own notes, and says what has not been tried', () => {
  // firmware/ is worked on separately and its counts of checks keep moving, so
  // this test does NOT compare figures with firmware/README.md: a change there
  // must never stop the site from publishing. It checks what must never drift:
  // that the page carries a date, links the firmware's own notes as the place
  // that is always current, names the three forms, and says that no real radio
  // stick has been used on a computer that is not a Raspberry Pi.
  const X = R.software, T = X.tested;
  assert.equal(X.forms.length, 3);
  assert.deepEqual(X.forms.map(f => f.id), ['package', 'container', 'image']);
  for (const f of X.forms) assert.ok(f.name && f.sub && f.status && f.takes && ['ok', 'warn', 'off'].includes(f.cls), `form ${f.id}`);
  for (const r of X.profiles.rows) assert.equal(r.length, X.profiles.cols.length, `profiles: ${r[0]}`);
  for (const r of T.rows) assert.equal(r.length, T.cols.length, `tested: ${r[0]}`);
  // 1. no real radio stick off a Raspberry Pi: the first thing in the "not tested" list, in bold
  assert.match(T.not[0], /^\*\*A real radio stick on a computer that is not a Raspberry Pi\.\*\*/, 'the "not tested" list must open with the radio stick');
  assert.match(T.where, /no radio stick/i, 'the page must say no radio stick was involved in the tests');
  assert.match(T.state, /not reviewed by a second person, and not released/i);
  // 2. a date
  assert.match(T.asof, /^\d{1,2} (January|February|March|April|May|June|July|August|September|October|November|December) 20\d\d$/, 'the table needs a plain "as at" date');
  // 3. the firmware's own notes, linked as the place that is always current
  assert.equal(T.source, 'https://github.com/cdomotor-g/open-ALERT/blob/main/firmware/README.md');
  assert.match(T.current, /always the current/i, 'the page must say the firmware\'s own notes are the current word');
  assert.ok(fs.existsSync(path.join(ROOT, 'firmware', 'README.md')), 'firmware/README.md is what the page links to');
  // ... and the page really shows all three
  const js = read('js/review.js');
  for (const k of ['T.asof', 'T.current', 'T.source', 'T.not', 'T.where']) assert.ok(js.includes(k), `the page does not show ${k}`);
  // 4. a form whose folder does not exist cannot be shown as built
  for (const f of ['container', 'image']) {
    if (!fs.existsSync(path.join(ROOT, 'firmware', f))) assert.equal(X.forms.find(x => x.id === f).cls, 'off', `firmware/${f}/ does not exist, but the page does not say it is unfinished`);
  }
  // 5. releases: the address, and nothing claimed about what is there without a date
  assert.match(X.releases.url, /^https:\/\/github\.com\/cdomotor-g\/open-ALERT\/releases$/);
  assert.match(X.releases.text, /20\d\d/, 'what the page says about releases needs its date');
  // the benchmark the page tells people to run is the file the firmware folder holds
  assert.ok(fs.existsSync(path.join(ROOT, 'firmware', 'bench', 'open-alert-bench.js')), 'firmware/bench/open-alert-bench.js');
  for (const s of R.speed.bench.steps) assert.match(s.code, /open-alert-bench\.js|open-alert-base bench/, `not the benchmark's own command: ${s.code}`);
});

test('the page is wired into the site: its files, its sections and the menu on every page', () => {
  const html = read('hardware.html');
  for (const f of ['data/review-images.js', 'data/review.js', 'js/review.js']) assert.ok(html.includes(`<script src="${f}"></script>`), `hardware.html does not load ${f}`);
  assert.ok(html.indexOf('data/review.js') < html.indexOf('js/review.js'), 'the data must load before the page script');
  assert.ok(html.includes('<link rel="stylesheet" href="review.css">'));
  // every place the script writes to exists, once
  const js = read('js/review.js');
  const outs = [...new Set([...js.matchAll(/\$\('#(out-[a-z]+|rv-intro)'\)/g)].map(m => m[1]))];
  assert.ok(outs.length >= 11);
  for (const id of outs) assert.equal(html.split(`id="${id}"`).length - 1, 1, `hardware.html: id="${id}"`);
  // the links at the top of the page lead to sections that exist
  const onpage = html.match(/<nav class="onpage"[\s\S]*?<\/nav>/)[0];
  const jumps = [...onpage.matchAll(/href="#([a-z-]+)"/g)].map(m => m[1]);
  assert.ok(jumps.length >= 9);
  for (const id of jumps) assert.ok(html.includes(`id="${id}"`), `no section #${id}`);
  for (const id of ['verdict', 'trial', 'security', 'computers', 'speed', 'cost', 'software', 'custom', 'radio', 'words', 'sources']) assert.ok(jumps.includes(id), `the page does not link to #${id}`);
  // the menu: "Other computers" on every page, and one current page each
  for (const p of ['index.html', 'build.html', 'trial.html', 'hardware.html']) {
    const nav = read(p).match(/<nav class="wrap sitenav"[\s\S]*?<\/nav>/);
    assert.ok(nav, `${p} has no site menu`);
    const hrefs = [...nav[0].matchAll(/href="([^"]+)"/g)].map(x => x[1]);
    for (const w of ['#configure', '#network', '#catalogue', 'build.html', 'trial.html', 'hardware.html', '#about']) assert.ok(hrefs.some(h => h.endsWith(w)), `${p}'s menu misses ${w}`);
    assert.equal(hrefs.filter(h => h === 'hardware.html').length, 1, `${p}: one link to the page`);
    assert.match(nav[0], /<a class="nav-link" href="hardware\.html"[^>]*><b>Other computers<\/b><span>beyond the Pi<\/span><\/a>/, `${p}: the menu entry`);
    assert.equal((nav[0].match(/aria-current="page"/g) || []).length, 1, `${p}: one current page in the menu`);
  }
  assert.match(html, /<a class="nav-link" href="hardware\.html" aria-current="page">/);
  // the links the data makes into this site lead somewhere
  for (const [where, s] of TEXT) if (/^build\.html/.test(s)) assert.ok(fs.existsSync(path.join(SITE, s.split('#')[0])), `${where}: ${s}`);
});

// ── the same computer reads the same everywhere ──────────────────────────────
// The review page keeps its own list (site/data/review.js); the catalogue and
// the builder keep theirs. A figure changed in one place and not the other is
// how the Verdin iMX95 came to be 0.75 a core on one page and 0.73 on another.
const CATALOGUE_ID = { 'onlogic-cl260': 'onlogic-cl260', 'lenovo-se10n': 'lenovo-thinkedge-se10n-gen2', 'protectli-vp2430': 'protectli-vault-vp2430', 'mini-pc-n150': 'mini-pc-n150',
  'lenovo-m920q': 'lenovo-m920q-tiny-refurb', 'dell-micro': 'dell-optiplex-micro', 'fitlet3': 'compulab-fitlet3', 'moxa-uc4400a': 'moxa-uc-4400a', 'eurotech-reliacor': 'eurotech-reliacor-40-13',
  'beagley-ai': 'beagley-ai', 'beagleplay': 'beagleplay', 'olimex-imx8mp': 'olimex-imx8mp-som-evb', 'verdin-imx95': 'toradex-verdin-imx95-mallow', 'verdin-am62': 'toradex-verdin-am62-mallow',
  'luna-sl1680': 'toradex-luna-sl1680', 'rpi-4': 'rpi-4-4gb', 'rpi-5': 'rpi-5-4gb', 'rpi-cm5': 'rpi-cm5-io' };

test('each computer reads the same on the review page, in the catalogue, in the builder and on the trial page', () => {
  const B = require(path.join(SITE, 'js', 'builder.js'));
  const BD = require(path.join(SITE, 'data', 'builder.js'));
  const TR = require(path.join(SITE, 'js', 'trial.js'));
  const CAT = [].concat(...['alert', 'compute', 'radio', 'sensors', 'power', 'site'].map(f => require(path.join(SITE, 'data', `${f}.js`))));
  B.setCatalog(CAT);
  const near = (a, b, what) => assert.ok(Math.abs(a - b) < 0.011, `${what}: ${a} against ${b}`);
  for (const c of R.computers) {
    const id = CATALOGUE_ID[c.id];
    assert.ok(id, `${c.id}: which catalogue record is it?`);
    const it = CAT.find(x => x.id === id);
    assert.ok(it, `${c.id}: no catalogue record ${id}`);
    // speed: the whole computer, and one core
    near(it.hw.sdrCh / 8, c.speed.all, `${c.id}: the whole computer, catalogue against review`);
    near(B.oneCore({ ref: id }), c.speed.core, `${c.id}: one core, builder against review`);
    // the ALERT2 rule: what the builder works out is what the review says ("likely" is a floor figure, which the sums cannot tell from a pass)
    const r = BD.model.rule, meets = B.cores({ ref: id }) >= r.cores && B.oneCore({ ref: id }) >= r.oneCore;
    assert.equal(meets, c.rule !== 'fail', `${c.id}: the ALERT2 rule, builder against review`);
    // temperature: the same rating, or the catalogue's is marked as assumed where the review read none
    if (c.temp) assert.deepEqual(it.temp, c.temp, `${c.id}: temperature rating`);
    else if (it.temp) assert.ok(it.tempAssumed, `${c.id}: the review read no rating, so the catalogue's must say it is assumed`);
    // how open the hardware is; and nobody is called fanless in one place and not in the other
    assert.equal(it.open.hw, c.open, `${c.id}: how open the hardware is`);
    if (c.fanless !== null) assert.equal(it.hw.fanless, c.fanless, `${c.id}: fanless`); else assert.equal(it.hw.fanless, undefined, `${c.id}: the review does not say fanless, so the catalogue must not`);
    // price: a quote is a quote in both; a figure is within the builder's range
    if (c.price.aud == null) assert.equal(it.price.aud, null, `${c.id}: by quote on the page, priced in the catalogue`);
    const p = BD.platforms.find(x => x.id === id);
    if (p && p.aud[0] != null && c.price.aud != null) {
      const inc = v => v * (p.gst === false ? 1.1 : 1);
      assert.ok(c.price.aud >= inc(p.aud[0]) - 1 && c.price.aud <= inc(p.aud[1]) + 1, `${c.id}: the review's price (${c.price.aud}) is outside the builder's range`);
    }
  }
  // the radio stick: one price on every page
  const stick = R.kits.list[0].lines.find(l => /stick/i.test(l.part));
  const bStick = BD.sdrs.find(s => s.id === 'rtl-sdr-blog-v3'), tStick = TR.TRIAL.items.find(i => i.id === 'stick');
  assert.deepEqual(stick.aud, bStick.aud.map(Math.round), 'the stick, review against builder');
  assert.deepEqual(tStick.aud, bStick.aud, 'the stick, trial against builder');
  // the two Toradex sets are priced on one basis, so the cheaper one sorts as cheaper
  assert.ok(byId('verdin-am62').price.aud < byId('verdin-imx95').price.aud, 'the AM62 set costs less than the iMX95 set');
});

test('the review does not say more than its sources do', () => {
  const all = JSON.stringify(R);
  // the ThinkEdge: its Linux certification is Lenovo's statement, and the page says what Canonical's list showed
  const se = byId('lenovo-se10n'), seText = JSON.stringify(se);
  assert.ok(!/certified by the makers of Ubuntu/i.test(all), '"certified by the makers of Ubuntu and Red Hat" is not what any source says');
  assert.match(seText, /Lenovo\\?'s (own )?statement/); assert.match(seText, /Canonical/);
  assert.match(se.tempNote, /both/i, 'both versions are rated with moving air');
  assert.match(se.cpu, /0–50 °C version only/, 'the eight-core chip comes in one version only');
  // an N150 passes the rule at its planning figure only: every "pass" on an N150 says so
  for (const c of R.computers.filter(x => x.rule === 'pass' && /N1[05]0/.test(x.cpu))) assert.match(c.ruleWhy, /2\.4 a core/, `${c.id}: the low end of the benchmarks`);
  // prices that were read are quoted as read; a page that opened is not "could not be read"
  assert.match(byId('lenovo-m920q').price.detail, /A\$239/); assert.match(byId('lenovo-m920q').price.detail, /sold/);
  assert.match(byId('verdin-am62').price.detail, /A\$610 before GST and A\$670 with it/);
  // the ranking: a Verdin runs Torizon OS, so it does not sit with the computers that run Ubuntu or Debian
  assert.ok(!R.security.ranking.find(r => r.n === 3).ids.includes('verdin-imx95'));
  assert.match(R.security.rankNotes.join(' '), /fifth/);
  // who patches it: the Ubuntu Pro point is on the page
  assert.match(JSON.stringify(R.security.questions), /Ubuntu Pro/);
  // a full ALERT2 channel: the two figures are told apart, and the timings are called an estimate
  assert.match(R.speed.ruleWords.join(' '), /1\.1 to 1\.3[^.]*messages alone[^.]*1\.2 to 1\.8/);
  assert.match(R.speed.todayNote, /multiplied by 4 to 5/);
  // the container: started with no radio, not "runs"
  assert.match(R.claims.find(k => k.id === 'stack').found, /no radio attached/);
  // unchecked: the package on Moxa's Secure system
  assert.match(JSON.stringify(byId('moxa-uc4400a')), /Not checked|Nobody has checked/);
  // supply: the module's promise is not the carrier's
  assert.match(JSON.stringify(byId('verdin-imx95')), /2034/);
  // the forms that are not finished are not shown as built
  for (const f of R.software.forms.filter(x => x.id !== 'package')) assert.notEqual(f.cls, 'ok', `${f.id}: not finished, so not shown as done`);
});

test('the builder and the trial pages take their other words from the review\'s one list', () => {
  const B = require(path.join(SITE, 'js', 'builder.js'));
  assert.ok(B.WORDS.length >= 30);
  for (const id of B.WORDS) assert.ok(termIds.has(id), `the builder lists a word with no meaning: ${id}`);
  for (const [re, id] of B.MARKS) { assert.ok(re instanceof RegExp && !re.global, `${id}: a plain pattern`); assert.ok(termIds.has(id), `the builder marks a word with no meaning: ${id}`); }
  // a marked word gets its meaning on hover; code, links and tags are left alone
  const look = id => R.terms.find(t => t.id === id);
  const out = B.markTerms('A fanless box with a TPM 2.0; run <code>open-alert-base status</code>, see <a href="x">the TPM page</a>. Another TPM.', look);
  assert.equal(out.split('class="term"').length - 1, 2, 'fanless and the first TPM, once each');
  assert.ok(out.includes('<code>open-alert-base status</code>') && out.includes('<a href="x">the TPM page</a>'));
  assert.equal(B.markTerms('plain text', null), 'plain text');
  for (const p of ['build.html', 'trial.html']) {
    const s = read(p);
    assert.ok(s.includes('<script src="data/review.js"></script>'), `${p} does not load the list of meanings`);
    assert.ok(s.indexOf('data/review.js') < s.indexOf('js/builder.js'), `${p}: the list must load before the script that uses it`);
    assert.match(s, /What the words on this page mean/, `${p}: a readable list of meanings`);
    assert.ok(!/legacy/i.test(s), `${p}: "older ALERT", not "legacy"`);
  }
  assert.match(read('build.html'), /id="page-terms"/);
  // the review's meanings cover what those pages were found to use without one
  for (const id of ['coreboot', 'iec62443', 'oshwa', 'cern-ohl', 'kicad', 'emmc', 'm2', 'kernel', 'uefi', 'lts', 'airlink', 'ppm', 'pigtail', 'older-alert', 'hw-open', 'est']) assert.ok(B.WORDS.includes(id), `the pages' list misses ${id}`);
});
