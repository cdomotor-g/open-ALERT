// open-ALERT — the hardware review page (site/hardware.html): the verdict, the
// Mallow trial's claims, what IT security asks, every computer compared, the
// speed chart, the bills, the software route, a board of our own and the radio.
//
// Every word and figure is in site/data/review.js; this file only draws it.
// The filters, the sorting, the compare list and the bill's sum are plain
// functions, exported under Node so test/review.test.js can check them.

(function () {
  'use strict';
  const isNode = typeof module === 'object' && module.exports;
  const R = isNode ? require('../data/review.js') : globalThis.OA_REVIEW;
  const IMG = isNode ? require('../data/review-images.js') : (globalThis.OA_REVIEW_IMAGES || {});

  // ══ the sums ══════════════════════════════════════════════════════════════

  // The filters a finger can use. `term` is the word in the list of meanings
  // that explains the filter; `meaning` is used where there is no such word.
  const FILTERS = [
    { id: 'alert2', label: 'Passes the ALERT2 rule', term: 'alert2-rule', note: 'Computers marked "likely passes", whose processors have no speed figure yet, are kept in.', test: c => c.rule === 'pass' || c.rule === 'likely' },
    { id: 'fanless', label: 'Fanless', term: 'fanless', test: c => c.fanless === true },
    { id: 'dc', label: 'Runs from 12–24 V', term: 'dc-in', test: c => c.dc === true },
    { id: 'wide', label: 'Wide temperature', term: 'wide-temp', test: c => c.wideTemp === true },
    { id: 'open', label: 'Open hardware', term: 'open-hw', test: c => c.open === 'open' },
    { id: 'au', label: 'Sold in Australia', meaning: 'An Australian shop lists it, or an Australian seller will quote for it.', test: c => c.au === 'shop' || c.au === 'quote' },
    { id: 'cert', label: 'Has a security certificate', term: 'iec62443', test: c => c.cert === true },
  ];
  const SORTS = [['group', 'The review\'s order'], ['core', 'Fastest core first'], ['all', 'Fastest computer first'], ['price', 'Cheapest first']];
  const MAX_COMPARE = 3;

  // The computers that pass every filter that is switched on.
  function filterComputers(list, on) {
    const use = FILTERS.filter(f => on && on.includes(f.id));
    return list.filter(c => use.every(f => f.test(c)));
  }
  // In the review's order, by speed, or by price (no price goes last).
  function sortComputers(list, key) {
    const gi = id => R.groups.findIndex(g => g.id === id);
    const at = c => R.computers.indexOf(c);
    const by = {
      group: (a, b) => gi(a.group) - gi(b.group) || at(a) - at(b),
      core: (a, b) => b.speed.core - a.speed.core || b.speed.all - a.speed.all || at(a) - at(b),
      all: (a, b) => b.speed.all - a.speed.all || b.speed.core - a.speed.core || at(a) - at(b),
      price: (a, b) => (a.price.aud == null ? Infinity : a.price.aud) - (b.price.aud == null ? Infinity : b.price.aud) || at(a) - at(b),
    }[key] || null;
    return by ? list.slice().sort(by) : list.slice();
  }
  // Tick or untick a computer for the side-by-side view; three at most.
  function toggleCompare(ids, id) {
    if (ids.includes(id)) return { ids: ids.filter(x => x !== id), full: false };
    if (ids.length >= MAX_COMPARE) return { ids: ids.slice(), full: true };
    return { ids: ids.concat(id), full: false };
  }
  // A bill's sum: what is known, low to high, and how many lines the seller still has to price.
  function kitTotal(kit) {
    const c = R.computers.find(x => x.id === kit.id);
    let lo = 0, hi = 0, unknown = 0;
    for (const l of kit.lines) {
      const a = l.ref ? (c.price.aud == null ? null : [c.price.aud, c.price.aud]) : l.aud;
      if (!a) unknown++; else { lo += a[0]; hi += a[1]; }
    }
    return { lo, hi, unknown };
  }
  const meets = c => c.cores != null && c.cores >= R.speed.rule.cores && c.speed.core >= R.speed.rule.perCore && !c.speed.floor;
  const termIds = text => [...String(text).matchAll(/\{\{([a-z0-9-]+)\|/g)].map(m => m[1]);
  const reportUrl = id => { const r = R.reports.find(x => x.id === id); return r ? R.REV + r.file : null; };
  const photosUsed = () => [...new Set(R.computers.map(c => c.photo).filter(Boolean))];

  // The drawings: one for each kind of thing, shown where the site has no photograph it may use.
  const KIND = { board: 'a single board', module: 'a module on a carrier board', fanless: 'a fanless box', desktop: 'a small desktop PC', din: 'a DIN-rail gateway' };
  const DRAW = {
    board: '<rect class="pcb" x="28" y="24" width="144" height="84" rx="6"/><rect class="pin" x="40" y="29" width="76" height="7" rx="1"/><rect class="ic" x="74" y="54" width="32" height="32" rx="3"/><rect class="ic2" x="116" y="60" width="20" height="20" rx="2"/><rect class="ic2" x="42" y="62" width="18" height="12" rx="2"/><rect class="port" x="152" y="30" width="26" height="18" rx="2"/><rect class="port" x="152" y="54" width="26" height="18" rx="2"/><rect class="port" x="152" y="80" width="26" height="22" rx="2"/><rect class="port" x="50" y="100" width="20" height="12" rx="2"/><rect class="port" x="80" y="100" width="14" height="12" rx="2"/><circle class="hole" cx="35" cy="31" r="2.6"/><circle class="hole" cx="35" cy="101" r="2.6"/><circle class="hole" cx="142" cy="31" r="2.6"/><circle class="hole" cx="142" cy="101" r="2.6"/>',
    module: '<rect class="pcb" x="18" y="20" width="164" height="92" rx="6"/><rect class="mod" x="54" y="36" width="88" height="46" rx="3"/><rect class="ic" x="66" y="45" width="26" height="26" rx="2"/><rect class="ic2" x="100" y="47" width="18" height="12" rx="2"/><rect class="ic2" x="100" y="63" width="30" height="9" rx="2"/><rect class="edge" x="54" y="82" width="88" height="6"/><rect class="port" x="160" y="28" width="28" height="16" rx="2"/><rect class="port" x="160" y="50" width="28" height="16" rx="2"/><rect class="port" x="160" y="74" width="28" height="22" rx="2"/><rect class="term-b" x="12" y="34" width="20" height="30" rx="2"/><circle class="screw" cx="22" cy="42" r="3"/><circle class="screw" cx="22" cy="56" r="3"/><rect class="pin" x="46" y="98" width="70" height="7" rx="1"/><circle class="hole" cx="26" cy="104" r="2.6"/><circle class="hole" cx="150" cy="104" r="2.6"/>',
    fanless: '<path class="fin" d="M34 26v18M46 26v18M58 26v18M70 26v18M82 26v18M94 26v18M106 26v18M118 26v18M130 26v18M142 26v18M154 26v18M166 26v18"/><rect class="case" x="24" y="40" width="152" height="62" rx="5"/><rect class="face" x="24" y="62" width="152" height="40" rx="5"/><rect class="port" x="36" y="74" width="16" height="9" rx="1.5"/><rect class="port" x="58" y="74" width="16" height="9" rx="1.5"/><rect class="port" x="82" y="72" width="16" height="14" rx="1.5"/><rect class="port" x="104" y="72" width="16" height="14" rx="1.5"/><rect class="term-b" x="132" y="72" width="26" height="14" rx="2"/><circle class="led" cx="166" cy="79" r="3"/><rect class="foot" x="34" y="102" width="22" height="6" rx="2"/><rect class="foot" x="144" y="102" width="22" height="6" rx="2"/>',
    desktop: '<path class="case" d="M30 52 L58 30 H178 L150 52 Z"/><rect class="face" x="30" y="52" width="120" height="48" rx="4"/><path class="case" d="M150 52 L178 30 V78 L150 100 Z"/><path class="fin" d="M42 62h56M42 68h56M42 74h56"/><circle class="led" cx="132" cy="64" r="5"/><rect class="port" x="42" y="84" width="16" height="8" rx="1.5"/><rect class="port" x="64" y="84" width="16" height="8" rx="1.5"/><circle class="hole" cx="94" cy="88" r="3"/><circle class="hole" cx="106" cy="88" r="3"/>',
    din: '<rect class="rail" x="20" y="54" width="160" height="14" rx="2"/><rect class="case" x="66" y="18" width="68" height="94" rx="5"/><rect class="term-b" x="74" y="24" width="52" height="14" rx="2"/><circle class="screw" cx="84" cy="31" r="3"/><circle class="screw" cx="100" cy="31" r="3"/><circle class="screw" cx="116" cy="31" r="3"/><circle class="led" cx="80" cy="50" r="2.6"/><circle class="led" cx="90" cy="50" r="2.6"/><circle class="led off" cx="100" cy="50" r="2.6"/><rect class="port" x="76" y="62" width="20" height="16" rx="2"/><rect class="port" x="104" y="62" width="20" height="16" rx="2"/><rect class="port" x="76" y="86" width="18" height="10" rx="1.5"/><path class="fin" d="M104 88h20M104 94h20"/>',
  };

  const API = { FILTERS, SORTS, MAX_COMPARE, filterComputers, sortComputers, toggleCompare, kitTotal, meets, termIds, reportUrl, photosUsed, KIND, DRAW };
  if (isNode) { module.exports = API; return; }

  // ══ the page ══════════════════════════════════════════════════════════════
  const $ = (s, el) => (el || document).querySelector(s);
  const $$ = (s, el) => [...(el || document).querySelectorAll(s)];
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const TERM = Object.fromEntries(R.terms.map(t => [t.id, t]));
  // A word with its meaning on hover; the same meanings are listed under "What the words mean".
  const term = (id, html) => TERM[id] ? `<span class="term" title="${esc(TERM[id].meaning)}">${html}</span>` : html;
  const rich = s => esc(s).replace(/\{\{([a-z0-9-]+)\|([^}]+)\}\}/g, (m, id, w) => term(id, w)).replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');
  const ext = (name, url) => `<a href="${esc(url)}" target="_blank" rel="noopener">${esc(name)}</a>`;
  const CHIP = { ok: 'open', info: 'st-info', warn: 'st-warn', bad: 'st-bad', off: 'closed' };
  const chip = (text, cls, title) => `<span class="chip ${CHIP[cls] || 'plain'}"${title ? ` title="${esc(title)}"` : ''}>${esc(text)}</span>`;
  const reps = ids => ids.map(id => { const r = R.reports.find(x => x.id === id); return r ? `<a class="rv-rep" href="${esc(R.REV + r.file)}" target="_blank" rel="noopener" title="${esc(r.title)}">${esc(id.replace(/v$/, ' re-check'))}</a>` : ''; }).join(' ');
  const byId = id => R.computers.find(c => c.id === id);
  const goto = (id, text) => `<a href="#c-${esc(id)}" data-goto="${esc(id)}">${esc(text || byId(id).short)}</a>`;
  const num = v => v >= 10 ? String(Math.round(v)) : String(Math.round(v * 100) / 100);
  const temp = c => c.temp ? `${c.temp[0] < 0 ? '−' + -c.temp[0] : c.temp[0]} to +${c.temp[1]} °C` : '';
  const ul = (list, cls) => `<ul${cls ? ` class="${cls}"` : ''}>${list.map(x => `<li>${rich(x)}</li>`).join('')}</ul>`;

  const KEY = 'open-alert:review';
  let S = { f: [], sort: 'group', view: 'auto', cmp: [], org: 'bureau', kit: R.kits.list[0].id };
  try { S = Object.assign(S, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) { /* private mode */ }
  // Saved data that is not what this page wrote (damaged, or from a later version) must not blank the page.
  if (!S || typeof S !== 'object' || Array.isArray(S)) S = { f: [], sort: 'group', view: 'auto', cmp: [], org: 'bureau', kit: R.kits.list[0].id };
  S.f = (Array.isArray(S.f) ? S.f : []).filter(id => FILTERS.some(f => f.id === id));
  S.cmp = (Array.isArray(S.cmp) ? S.cmp : []).filter(id => typeof id === 'string' && byId(id)).slice(0, MAX_COMPARE);
  if (!SORTS.some(s => s[0] === S.sort)) S.sort = 'group';
  if (!R.security.orgs.some(o => o.id === S.org)) S.org = 'bureau';
  if (!R.kits.list.some(k => k.id === S.kit)) S.kit = R.kits.list[0].id;
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* private mode */ } };
  const narrow = () => window.matchMedia('(max-width: 899px)').matches;
  const view = () => S.view === 'table' || S.view === 'cards' ? S.view : (narrow() ? 'cards' : 'table');

  // ── pictures: a photograph where the site may show one, otherwise a drawing made for this page ──
  function pic(c, small) {
    const im = c.photo && IMG[c.photo];
    if (im) {
      return `<figure class="rv-pic photo${small ? ' small' : ''}"><img src="img/hw/${esc(im.file)}" alt="${esc(im.alt)}" decoding="async">` +
        `<figcaption>${small ? '' : esc(im.subject) + '. '}Photo: ${ext(im.credit || im.author, im.source)}, ${ext(im.licence, im.licenceUrl)}${small ? '' : ` (${esc(im.changes)})`}</figcaption></figure>`;
    }
    return `<figure class="rv-pic drawn${small ? ' small' : ''}"><svg viewBox="0 0 200 130" class="rv-draw" role="img" aria-label="A drawing of ${esc(KIND[c.draw])}">${DRAW[c.draw]}</svg>` +
      `<figcaption>${small ? 'A drawing' : `A drawing, not a photograph: ${esc(KIND[c.draw])}`}</figcaption></figure>`;
  }

  // ── speed bars ──
  const speedCls = (v, floor) => floor ? 'floor' : v >= R.speed.rule.perCore ? 'ok' : v >= 1 ? 'warn' : 'bad';
  const speedVal = s => `${s.floor ? '≥ ' : s.conf === 'guess' || s.conf === 'memory' ? '≈ ' : ''}`;
  function bar(v, max, marks, o) {
    const pct = x => Math.max(0, Math.min(100, x / max * 100));
    const rng = o.range ? `<span class="rng" style="left:${pct(o.range[0])}%;width:${pct(o.range[1]) - pct(o.range[0])}%"></span>` : '';
    return `<span class="rv-bar" role="img" aria-label="${esc(o.label)}"><span class="fill ${speedCls(v, o.floor)}" style="width:${pct(v)}%"></span>${rng}${marks.map(m => `<span class="mk ${m[1]}" style="left:${pct(m[0])}%"></span>`).join('')}</span>`;
  }
  const CORE_MARKS = [[1, 'pi'], [R.speed.rule.perCore, 'rule']];
  const ALL_MARKS = [[1, 'pi'], [R.speed.rule.four, 'ch4'], [R.speed.rule.eight, 'ch8']];
  function speedBlock(c) {
    const s = c.speed, pre = speedVal(s);
    return `<div class="rv-speed" title="${esc(s.basis)}">
      <div class="rv-sp"><span>One core</span>${bar(s.core, R.speed.coreMax, CORE_MARKS, { range: s.range, floor: s.floor, label: `One core: ${pre}${num(s.core)} times a Raspberry Pi 4 core` })}<b>${pre}${num(s.core)}</b></div>
      <div class="rv-sp"><span>Whole computer</span>${bar(s.all, R.speed.allMax, ALL_MARKS, { floor: s.floor, label: `Whole computer: ${pre}${num(s.all)} times a Raspberry Pi 4` })}<b>${pre}${num(s.all)}</b></div>
    </div>`;
  }
  const RULE = { pass: ['Passes the ALERT2 rule at its planning figure', 'ok'], likely: ['Likely passes: no figure', 'info'], fail: ['Short of the ALERT2 rule', 'warn'] };
  const ruleChip = c => chip(RULE[c.rule][0], RULE[c.rule][1], c.ruleWhy);
  const AU = { shop: ['In Australian shops', 'ok'], quote: ['Australian seller, by quote', 'info'], none: ['No Australian seller found', 'warn'] };
  const OPEN = { open: ['Open hardware', 'ok'], partial: ['Partly open', 'warn'], closed: ['Closed', 'off'] };
  const vchip = c => chip(R.verdicts[c.verdict].label, R.verdicts[c.verdict].cls);
  const buyList = c => `<ul class="rv-buy">${c.buy.map(b => `<li>${ext(b.name, b.url)}${b.note ? ` <span class="dim">${esc(b.note)}</span>` : ''}</li>`).join('')}</ul>`;
  const fwText = c => c.firmware.map(f => R.forms[f]).join(' · ');

  // ══ 1. the verdict ═══════════════════════════════════════════════════════
  function renderVerdict() {
    const V = R.verdict;
    $('#rv-intro').innerHTML = `${rich(R.page.intro)} ${esc(R.page.rates)}`;
    $('#out-verdict').innerHTML = `<div class="verdict ok rv-line">${rich(V.line)}</div>
      <div class="rv-picks">${V.cards.map(k => { const c = byId(k.id); return `
        <article class="card-o rv-pick p-${k.cls}">
          <div class="rv-pick-h">${chip(k.head, k.cls)}<span class="small dim">${esc(R.groups.find(g => g.id === c.group).name)}</span></div>
          ${pic(c)}
          <h3>${goto(c.id, c.short)}</h3>
          <p class="small">${rich(k.text)}</p>
          ${speedBlock(c)}
          <p class="rv-price"><b>${esc(c.price.text)}</b></p>
          <p class="small">${goto(c.id, 'See it in the table')}</p>
        </article>`; }).join('')}</div>
      <p class="small dim">Bars count in ${term('pi4x', 'Raspberry Pi 4s')}: the grey line is one Raspberry Pi 4, the red line is the 2.5 a core that ${term('alert2-rule', 'the ALERT2 rule')} asks for, and the two lines on the lower bar are what four and eight channels need. ${rich(V.also)}</p>`;
  }

  // ══ 2. the Mallow trial ══════════════════════════════════════════════════
  function renderClaims() {
    $('#out-claims').innerHTML = `<p class="lead">${rich(R.page.sections.trial)}</p>
      <div class="table-wrap"><table class="tbl rv-stack rv-claims"><thead><tr><th>What the trial said or assumed</th><th>What the review found</th><th>Verdict</th><th>From report</th></tr></thead><tbody>
      ${R.claims.map(k => `<tr><th scope="row">${rich(k.said)}</th><td data-l="What the review found">${rich(k.found)}</td><td data-l="Verdict">${chip(k.verdict, k.cls)}</td><td data-l="From report" class="rv-reps">${reps(k.reports)}</td></tr>`).join('')}
      </tbody></table></div>
      <p class="small dim">Each report name opens that report on GitHub. "Re-check" is a second reader going back to the first report's sources. The trial as it is now: <a href="${esc(R.page.sections.trialLink[1])}">${esc(R.page.sections.trialLink[0])}</a>.</p>`;
  }

  // ══ 3. what IT security asks ═════════════════════════════════════════════
  function placeSvg(p) {
    const fn = '<g class="cloud"><rect x="224" y="14" width="88" height="42" rx="18"/><text x="268" y="40">Flood-Net</text></g>';
    const theirs = (x, y) => `<g class="their"><rect x="${x}" y="${y}" width="92" height="34" rx="6"/><text x="${x + 46}" y="${y + 21}">their computers</text></g>`;
    const bs = (x, y) => `<g class="bs"><rect x="${x}" y="${y}" width="96" height="38" rx="7"/><text x="${x + 48}" y="${y + 23}">Base station</text></g>`;
    const zone = (x, y, w, h, label, cls) => `<rect class="zone ${cls || ''}" x="${x}" y="${y}" width="${w}" height="${h}" rx="10"/><text class="zl" x="${x + 10}" y="${y + 16}">${label}</text>`;
    const cross = (x, y) => `<path class="x" d="M${x - 6} ${y - 6}L${x + 6} ${y + 6}M${x + 6} ${y - 6}L${x - 6} ${y + 6}"/>`;
    const id = `ar-${p.id}`;
    const defs = `<defs><marker id="${id}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L10 5L0 10z" fill="currentColor"/></marker></defs>`;
    let body = '';
    if (p.id === 'own') {
      body = zone(8, 98, 150, 84, 'Their network') + theirs(36, 134) + bs(60, 18) +
        `<path class="lnk" d="M156 37 H222" marker-end="url(#${id})"/><text class="lt" x="189" y="29">mobile link</text><text class="lt" x="189" y="52">out only</text>` +
        `<path class="no" d="M108 56 V98"/>${cross(108, 78)}<text class="lt start" x="120" y="82">no connection</text>`;
    } else if (p.id === 'screened') {
      // the base station's only way out is up through their proxy; a wall stands between it and their computers
      body = zone(8, 70, 222, 112, 'Their network') + theirs(16, 122) +
        `<rect class="zone inner" x="120" y="92" width="104" height="84" rx="10"/><text class="zl" x="130" y="168">Screened zone</text>` + bs(124, 104) +
        `<path class="lnk" d="M172 104 V80"/><g class="px"><rect x="146" y="58" width="52" height="22" rx="5"/><text x="172" y="73">proxy</text></g>` +
        `<path class="lnk" d="M172 58 V35 H222" marker-end="url(#${id})"/><text class="lt" x="199" y="27">out only</text>` +
        `${cross(114, 139)}`;
    } else {
      body = zone(8, 70, 222, 112, 'Their network') + theirs(16, 106) + bs(126, 104) +
        `<path class="join" d="M108 123 H126"/>` +
        `<path class="lnk" d="M174 104 V80"/><g class="px"><rect x="148" y="58" width="52" height="22" rx="5"/><text x="174" y="73">proxy</text></g>` +
        `<path class="lnk" d="M174 58 V35 H222" marker-end="url(#${id})"/><text class="lt" x="200" y="27">out only</text>` +
        `<text class="lt" x="117" y="164">on the same network</text>`;
    }
    const meter = [0, 1, 2].map(i => `<rect class="m${i < p.size ? ' on' : ''}" x="${236 + i * 26}" y="150" width="22" height="12" rx="3"/>`).join('');
    return `<svg viewBox="0 0 320 190" role="img" aria-label="${esc(p.name)}: ${esc(p.sum)}">${defs}${fn}${body}<text class="ml" x="274" y="142">to approve</text>${meter}<text class="mv" x="274" y="178">${esc(p.sizeText)}</text></svg>`;
  }
  function renderSecurity() {
    const X = R.security;
    $('#out-security').innerHTML = `<p class="lead">${rich(X.lead)}</p>
      <div class="rv-seg" role="group" aria-label="Whose network is it?">${X.orgs.map(o => `<button type="button" data-org="${o.id}" aria-pressed="${o.id === S.org}"><b>${esc(o.name)}</b><span>${esc(o.sub)}</span></button>`).join('')}</div>
      ${X.orgs.map(o => `<div class="card-o rv-org${o.id === S.org ? '' : ' is-off'}" data-orgcard="${o.id}">
        <h3>${esc(o.name)} <span class="dim rv-sub">${esc(o.sub)}</span></h3>
        <div class="rv-org-g">
          <div><h4>The rules</h4><p>${rich(o.rule)}</p><h4>Who decides</h4><p>${rich(o.how)}</p></div>
          <div><h4>What they will press on</h4>${ul(o.asks)}<h4>What suits</h4><p>${rich(o.fits)}</p></div>
        </div></div>`).join('')}
      <h3>The questions, in the order they matter</h3>
      <p>${rich(X.questionsLead)}</p>
      <ol class="rv-qs">${X.questions.map(q => `<li class="card-o"><h4>${esc(q.head)}${q.share ? ` <span class="chip plain">${esc(q.share)}</span>` : ''}</h4>${ul(q.asks, 'small')}<p class="small rv-best"><b>What answers it best:</b> ${rich(q.best)}</p></li>`).join('')}</ol>
      <p class="small dim">${esc(X.sharesNote)}</p>
      <h3>Three places a base station can sit</h3>
      <p>${rich(X.placesLead)}</p>
      <div class="cards3 rv-places">${X.places.map(p => `<div class="card-o rv-place">
        <h4><span class="rv-letter">${esc(p.letter)}</span> ${esc(p.name)}</h4>
        <figure class="diagram rv-dia" aria-label="${esc(p.name)}">${placeSvg(p)}</figure>
        <p class="small">${rich(p.sum)}</p>
        <p class="small"><b>What it takes away:</b> ${rich(p.removes)}</p>
        <p class="small rv-still"><b>What is still asked:</b></p>${ul(p.still, 'small')}
      </div>`).join('')}</div>
      <div class="legend small"><span><i class="lg-bs"></i>the base station</span><span><i class="lg-their"></i>the customer's network</span><span><i class="lg-cloud"></i>Flood-Net, on the internet</span><span><i class="lg-m"></i>how much there is to approve: one block for the least, three for everything</span></div>
      <h3>Which kinds of computer pass most easily</h3>
      <p>${rich(X.rankLead)}</p>
      <ol class="rv-rank">${X.ranking.map(r => `<li class="card-o"><h4>${esc(r.name)}</h4><p class="small">${rich(r.why)}</p><p class="small"><b>But:</b> ${rich(r.but)}</p><p class="small">Here: ${r.ids.map(id => goto(id)).join(' · ')}</p></li>`).join('')}</ol>
      ${ul(X.rankNotes, 'small')}
      <div class="note">${X.facts.map(f => `<p>${rich(f)}</p>`).join('')}</div>
      <p class="small dim">From reports ${reps(X.reports)}. The ranking and the shares are the review's judgement.</p>`;
  }

  // ══ 4. the computers ═════════════════════════════════════════════════════
  function specRows(c) {
    const s = c.speed, pre = speedVal(s);
    return [
      ['Verdict', `${vchip(c)}<div class="small">${rich(c.why)}</div>`],
      ['Group', esc(R.groups.find(g => g.id === c.group).name)],
      ['Processor', `${esc(c.cpu)}${c.cores ? ` · ${c.cores} cores` : ''}`],
      [term('pi4x', 'Speed') + ', one core', `<b>${pre}${num(s.core)}</b> × a Raspberry Pi 4 core${s.range ? ` <span class="dim">(${num(s.range[0])}–${num(s.range[1])})</span>` : ''}<span class="rv-sp1">${bar(s.core, R.speed.coreMax, CORE_MARKS, { range: s.range, floor: s.floor, label: `One core: ${pre}${num(s.core)} times a Raspberry Pi 4 core` })}</span>`],
      ['Speed, whole computer', `<b>${pre}${num(s.all)}</b> × a Raspberry Pi 4<span class="rv-sp1">${bar(s.all, R.speed.allMax, ALL_MARKS, { floor: s.floor, label: `Whole computer: ${pre}${num(s.all)} times a Raspberry Pi 4` })}</span><div class="small dim">${esc(s.basis)}${s.alt ? ' ' + esc(s.alt) : ''}</div>`],
      [term('alert2-rule', 'The ALERT2 rule'), `${ruleChip(c)}<div class="small dim">${esc(c.ruleWhy)}</div>`],
      ['Memory and storage', esc(c.memory)],
      ['Ports', esc(c.ports)],
      ['Power in', `${esc(c.power)}${c.dc ? ' ' + chip('Runs from a battery', 'ok', TERM['dc-in'].meaning) : ''}`],
      ['Temperature', `${temp(c) ? esc(temp(c)) : ''}${c.wideTemp ? ' ' + chip('Wide', 'ok', TERM['wide-temp'].meaning) : ''}${c.tempNote ? `<div class="small dim">${esc(c.tempNote)}</div>` : ''}`],
      ['Fan or ' + term('fanless', 'fanless'), esc(c.cooling)],
      [term('secure-boot', 'Secure boot'), esc(c.secureBoot)],
      [term('tpm', 'TPM'), esc(c.tpm)],
      [term('open-hw', 'Open hardware'), `${chip(OPEN[c.open][0], OPEN[c.open][1], TERM['hw-open'].meaning)}<div class="small dim">${esc(c.openText)}</div>`],
      ['Security certificate', `${c.cert ? chip('Yes', 'ok', TERM.iec62443.meaning) + ' ' : ''}${esc(c.certText)}`],
      ['Firmware it takes', `${esc(fwText(c))}<div class="small dim">${esc(c.os)}</div>`],
      ['Maker and country', `${esc(c.maker)}<div class="small dim">${esc(c.country)}</div>`],
      ['Price', `<b>${esc(c.price.text)}</b><div class="small dim">${esc(c.price.detail)}</div>`],
      ['Where to buy', `${chip(AU[c.au][0], AU[c.au][1])}${buyList(c)}`],
      ['Good', ul(c.good, 'pros')],
      ['Watch', ul(c.watch, 'cons')],
      ['Sources', `${c.links.map(l => ext(l[0], l[1])).join(' · ')}`],
    ];
  }
  // What is good, what to watch, where the figures come from and the sources: the same words in a card and under a table row.
  const more = c => `<div><h4>Good</h4>${ul(c.good, 'pros')}</div><div><h4>Watch</h4>${ul(c.watch, 'cons')}</div>
    <div><h4>Where its figures come from</h4><p><b>Speed:</b> ${esc(c.speed.basis)}${c.speed.alt ? ' ' + esc(c.speed.alt) : ''}</p><p><b>The ALERT2 rule:</b> ${esc(c.ruleWhy)}</p><p><b>Price:</b> ${esc(c.price.detail)}</p>
    <h4>Sources</h4><p>${c.links.map(l => ext(l[0], l[1])).join(' · ')} · reports ${reps(c.reports)}</p></div>`;
  const cmpBox = c => `<label class="chk rv-cmp"><input type="checkbox" data-compare="${esc(c.id)}"${S.cmp.includes(c.id) ? ' checked' : ''}> Compare</label>`;
  function card(c) {
    const rows = specRows(c);
    const dl = ['Processor', 'Memory and storage', 'Ports', 'Power in', 'Temperature', 'Fan or fanless', 'Secure boot', 'TPM', 'Open hardware', 'Security certificate', 'Firmware it takes', 'Maker and country'];
    return `<article class="card-o rv-card v-${R.verdicts[c.verdict].cls}" id="c-${esc(c.id)}">
      <div class="rv-pick-h">${vchip(c)}<span class="small dim">${esc(R.groups.find(g => g.id === c.group).name)}</span></div>
      ${pic(c)}
      <h3>${esc(c.name)}</h3>
      <p class="small">${rich(c.why)}</p>
      ${speedBlock(c)}
      <p class="rv-chips">${ruleChip(c)} ${chip(AU[c.au][0], AU[c.au][1])}${c.fanless === true ? ' ' + chip('Fanless', 'ok', TERM.fanless.meaning) : ''}${c.dc ? ' ' + chip('Runs from a battery', 'ok', TERM['dc-in'].meaning) : ''}${c.wideTemp ? ' ' + chip('Wide temperature', 'ok', TERM['wide-temp'].meaning) : ''}${c.open === 'open' ? ' ' + chip('Open hardware', 'ok', TERM['open-hw'].meaning) : ''}${c.cert ? ' ' + chip('Security certificate', 'ok', TERM.iec62443.meaning) : ''}</p>
      <p class="rv-price"><b>${esc(c.price.text)}</b><span class="small dim">${esc(c.price.detail)}</span></p>
      ${buyList(c)}
      <details><summary>Everything about it</summary>
        <dl class="rv-dl">${rows.filter(r => dl.includes(r[0].replace(/<[^>]+>/g, ''))).map(r => `<div><dt>${r[0]}</dt><dd>${r[1]}</dd></div>`).join('')}</dl>
        <div class="small">${more(c)}</div></details>
      ${cmpBox(c)}
    </article>`;
  }
  function row(c) {
    return `<tr id="c-${esc(c.id)}" class="v-${R.verdicts[c.verdict].cls}">
      <th scope="row"><div class="rv-rowhead">${pic(c, true)}<div><b>${esc(c.name)}</b><div class="small dim">${esc(c.maker)} · ${esc(c.country)}</div><div class="rv-v">${vchip(c)}</div><div class="small rv-why">${rich(c.why)}</div>${cmpBox(c)}</div></div></th>
      <td data-l="Processor and speed">${esc(c.cpu)}${c.cores ? `<span class="dim"> · ${c.cores} cores</span>` : ''}${speedBlock(c)}${ruleChip(c)}</td>
      <td data-l="Memory, storage and ports">${esc(c.memory)}<div class="small dim">${esc(c.ports)}</div></td>
      <td data-l="Power, temperature and cooling">${esc(c.power)}<div class="small">${temp(c) ? esc(temp(c)) : esc(c.tempNote || '')}</div><div class="small dim">${esc(c.cooling)}</div></td>
      <td data-l="Secure boot and TPM"><div class="small"><b>Secure boot:</b> ${esc(c.secureBoot)}</div><div class="small"><b>TPM:</b> ${esc(c.tpm)}</div>${c.cert ? `<div class="small">${chip('Security certificate', 'ok', TERM.iec62443.meaning)}</div><div class="small dim">${esc(c.certText)}</div>` : ''}</td>
      <td data-l="Firmware it takes, and how open it is">${esc(fwText(c))}<div class="small dim">${esc(c.os)}</div><div class="rv-v">${chip(OPEN[c.open][0], OPEN[c.open][1], TERM['hw-open'].meaning)}</div><div class="small dim">${esc(c.openText)}</div></td>
      <td data-l="Price and where to buy"><b title="${esc(c.price.detail)}">${esc(c.price.text)}</b><div class="rv-v">${chip(AU[c.au][0], AU[c.au][1])}</div>${buyList(c)}</td>
    </tr>
    <tr class="rv-more v-${R.verdicts[c.verdict].cls}"><td colspan="7"><details><summary>What is good, what to watch, and where its figures come from</summary><div class="rv-more-g small">${more(c)}</div></details></td></tr>`;
  }
  let drawn = null;                                    // the view the list was last drawn in
  function renderList() {
    const shown = sortComputers(filterComputers(R.computers, S.f), S.sort), v = view();
    drawn = v;
    const head = g => { const G = R.groups.find(x => x.id === g); return G; };
    let html = '';
    if (!shown.length) html = `<div class="empty"><h3>No computer here does all of that</h3><p>Untick a filter, or <button type="button" class="linklike" data-act="reset">show all ${R.computers.length}</button>.</p></div>`;
    else if (v === 'table') {
      let last = null;
      const body = shown.map(c => { const sub = S.sort === 'group' && c.group !== last ? `<tr class="sub"><th colspan="7">${esc(head(c.group).name)} <span class="grp-sub">${rich(head(c.group).blurb)}</span></th></tr>` : ''; last = c.group; return sub + row(c); }).join('');
      html = `<div class="table-wrap"><table class="tbl rv-stack rv-table"><colgroup><col class="c1"><col class="c2"><col class="c3"><col class="c4"><col class="c5"><col class="c6"><col class="c7"></colgroup><thead><tr><th>Computer and verdict</th><th>Processor and ${term('pi4x', 'speed')}</th><th>Memory, storage and ports</th><th>Power, temperature and cooling</th><th>${term('secure-boot', 'Secure boot')} and ${term('tpm', 'TPM')}</th><th>Firmware it takes · ${term('open-hw', 'open hardware')}?</th><th>Price and where to buy</th></tr></thead><tbody>${body}</tbody></table></div>`;
    } else {
      let last = null;
      html = `<div class="rv-cards">${shown.map(c => { const sub = S.sort === 'group' && c.group !== last ? `<h3 class="rv-gh">${esc(head(c.group).name)} <span>${rich(head(c.group).blurb)}</span></h3>` : ''; last = c.group; return sub + card(c); }).join('')}</div>`;
    }
    $('#rv-list').innerHTML = html;
    $('#rv-count').textContent = `Showing ${shown.length} of ${R.computers.length}`;
    $$('[data-filter]').forEach(b => b.setAttribute('aria-pressed', String(S.f.includes(b.dataset.filter))));
    $$('[data-view]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.view === v)));
    $('#rv-sort').value = S.sort;
    $('#rv-reset').hidden = !S.f.length;
  }
  function renderCompare() {
    const list = S.cmp.map(byId), el = $('#rv-compare'), fab = $('#rv-fab');
    fab.hidden = list.length < 2;
    fab.textContent = `Compare ${list.length} side by side`;
    if (!list.length) { el.innerHTML = ''; return; }
    const all = list.map(specRows);
    el.innerHTML = `<div class="card-o rv-cmp-card"><div class="rv-cmp-h"><h3>Side by side</h3><button type="button" class="ghost small" data-act="clearcmp">Clear</button></div>
      ${list.length < 2 ? `<p class="small dim">Tick one or two more computers to compare them with ${esc(list[0].short)}.</p>` : ''}
      <div class="table-wrap"><table class="tbl compare rv-cmp-t"><thead><tr><th></th>${list.map(c => `<th scope="col">${pic(c, true)}<b>${esc(c.short)}</b> <button type="button" class="ghost small" data-uncompare="${esc(c.id)}" aria-label="Take ${esc(c.short)} out of the comparison">Remove</button></th>`).join('')}</tr></thead>
      <tbody>${all[0].map((r, i) => `<tr><th scope="row">${r[0]}</th>${all.map(a => `<td>${a[i][1]}</td>`).join('')}</tr>`).join('')}</tbody></table></div></div>`;
  }
  function renderComputers() {
    $('#out-computers').innerHTML = `<p class="lead">${rich(R.page.sections.computers)}</p>
      <div class="rv-tools">
        <div class="rv-filters" role="group" aria-label="Show only computers that"><span class="rv-tools-l">Show only</span>${FILTERS.map(f => `<button type="button" class="rv-f" data-filter="${f.id}" aria-pressed="false" title="${esc((f.term ? TERM[f.term].meaning : f.meaning) + (f.note ? ' ' + f.note : ''))}">${esc(f.label)}</button>`).join('')}</div>
        <div class="rv-tools-row">
          <label>Sort by <select id="rv-sort">${SORTS.map(s => `<option value="${s[0]}">${esc(s[1])}</option>`).join('')}</select></label>
          <span class="rv-view" role="group" aria-label="Show as"><button type="button" class="rv-f" data-view="table" aria-pressed="false">Table</button><button type="button" class="rv-f" data-view="cards" aria-pressed="false">Cards</button></span>
          <span id="rv-count" class="small dim" role="status"></span>
          <button type="button" class="ghost small" id="rv-reset" data-act="reset" hidden>Show all</button>
        </div>
      </div>
      <div id="rv-compare"></div>
      <div id="rv-list"></div>
      <button type="button" id="rv-fab" class="rv-fab" data-act="showcmp" hidden></button>
      <div class="legend small rv-key"><span><i class="lg-ok"></i>at or over 2.5: meets the rule</span><span><i class="lg-warn"></i>1 to 2.5: fine today, short of the rule</span><span><i class="lg-bad"></i>under 1: slower than a Raspberry Pi 4</span><span><i class="lg-floor"></i>"at least": no figure, a floor</span><span><i class="lg-rule"></i>2.5 a core, the ALERT2 rule</span><span><i class="lg-pi"></i>1, a Raspberry Pi 4</span><span><i class="lg-ch4"></i>whole computer: 2.5, enough for four channels</span><span><i class="lg-ch8"></i>4, enough for eight</span></div>
      <p class="small dim">Every speed is a ${term('stand-in', 'stand-in')}; hover a bar, or open the fold under a computer, for where its figure comes from. The filter "Passes the ALERT2 rule" keeps the computers that pass at their planning figure (an N150 is planned at 3 a core; the lowest published benchmark puts it at about 2.4, just under the rule) and the ones marked "likely passes", whose processors have no speed figure yet. "Has a security certificate" means the maker says a laboratory has certified it to IEC 62443-4-2; what each certificate covers is printed under its chip. "Closed", "Partly open" and "Open hardware" say whether the design files are published, and on what terms. "Sold in Australia" means an Australian shop lists it or an Australian seller will quote for it. "Check with the seller" means no price could be read. Where a seller's page refuses automated reading, the link is given and its price was not read. The parts catalogue under <a href="./#catalogue">Parts</a> and the <a href="build.html#builder">base station builder</a> carry these computers too.</p>`;
    renderList(); renderCompare();
  }

  // ══ 5. speed and headroom ════════════════════════════════════════════════
  function chart(title, sub, key, max, marks, note) {
    // every computer in the table, and the yardsticks that are not in it, fastest first
    const list = R.computers.map(c => ({ c, s: c.speed, short: c.short })).concat((R.speed.others || []).map(o => ({ c: null, s: o, short: o.short })))
      .sort((a, b) => b.s[key] - a.s[key] || b.s[key === 'core' ? 'all' : 'core'] - a.s[key === 'core' ? 'all' : 'core']);
    const pct = x => x / max * 100;
    const ticks = Array.from({ length: max + 1 }, (_, i) => i);
    return `<div class="card-o rv-chart"><h3>${esc(title)}</h3><p class="small dim">${rich(sub)}</p>
      <div class="rv-rows" style="--marks:${marks.length}">
        ${list.map(x => { const s = x.s, v = s[key], pre = speedVal(s); return `<div class="rv-row" title="${esc(s.basis)}"><span class="rv-name${x.c ? '' : ' other'}">${x.c ? goto(x.c.id, x.short) : esc(x.short)}</span>${bar(v, max, marks, { range: key === 'core' ? s.range : null, floor: s.floor, label: `${x.short}: ${pre}${num(v)}` })}<b class="${speedCls(v, s.floor) === 'floor' ? 'dim' : speedCls(v)}">${pre}${num(v)}</b></div>`; }).join('')}
        <div class="rv-row rv-bot" aria-hidden="true"><span></span><span class="rv-axis">${ticks.map(t => `<span class="tk" style="left:${pct(t)}%">${t}</span>`).join('')}</span><span></span></div>
      </div>
      <div class="legend small">${marks.map(m => `<span><i class="lg-${m[1]}"></i>${esc(m[2])}</span>`).join('')}</div>
      <p class="small dim">${rich(note)}</p></div>`;
  }
  function renderSpeed() {
    const X = R.speed, r = X.rule;
    $('#out-speed').innerHTML = `<p class="lead">${rich(X.lead)}</p>
      <div class="rv-charts">
        ${chart('One core', `Against the ${num(r.perCore)} a core that {{alert2-rule|the ALERT2 rule}} asks for. The thin line across a bar is the range the benchmarks give.`, 'core', X.coreMax, [[1, 'pi', '1: a Raspberry Pi 4 core'], [r.perCore, 'rule', `${num(r.perCore)}: the ALERT2 rule`]], 'Times one Raspberry Pi 4 core.')}
        ${chart('The whole computer', `Against what a site needs with headroom: about ${num(r.four)} Raspberry Pi 4s for four channels and about ${num(r.eight)} for eight.`, 'all', X.allMax, [[1, 'pi', '1: a Raspberry Pi 4'], [r.four, 'ch4', `${num(r.four)}: enough for four channels`], [r.eight, 'ch8', `${num(r.eight)}: enough for eight`]], `Times a whole Raspberry Pi 4. A computer can pass here and still fail on one core. ${X.eightNote}`)}
      </div>
      <div class="legend small"><span><i class="lg-ok"></i>at or over 2.5</span><span><i class="lg-warn"></i>1 to 2.5</span><span><i class="lg-bad"></i>under 1</span><span><i class="lg-floor"></i>"at least": no figure for this processor</span><span>${esc(X.othersNote)}</span></div>
      <p class="small dim">${esc(X.othersWords)} ${(X.others || []).map(o => `<b>${esc(o.short)}</b> (${num(o.all)}): ${esc(o.basis)}`).join(' ')}</p>
      <div class="rv-two">
        <div class="card-o"><h3>The sizing rule, in words</h3>${ul(X.ruleWords)}<p class="small">${rich(X.software)}</p><p class="small dim">${rich(X.spec)}</p></div>
        <div class="card-o"><h3>What decoding costs today</h3>
          <div class="table-wrap"><table class="tbl"><tbody>${X.today.map(t => `<tr><th scope="row">${esc(t.what)}</th><td>${esc(t.cost)}</td></tr>`).join('')}</tbody></table></div>
          <p class="small dim">${rich(X.todayNote)}</p></div>
      </div>
      <div class="note"><b>These are stand-ins.</b> ${rich(X.caveat)}</div>
      <div class="card-o"><h3>How to run the benchmark</h3><p class="small">${rich(X.bench.lead)}</p>
        ${X.bench.steps.map((s, i) => `<p class="small rv-code-l">${esc(s.label)}</p><div class="code"><button type="button" class="ghost small" data-act="copycode" data-for="rv-code-${i}">Copy</button><pre id="rv-code-${i}">${esc(s.code)}</pre></div>`).join('')}
        <p class="small dim">${rich(X.bench.note)} ${ext('The benchmark and its notes', X.bench.url)}.</p></div>
      <p class="small dim">From reports ${reps(X.reports)}.</p>`;
  }

  // ══ 6. what it costs ═════════════════════════════════════════════════════
  const money = v => 'A$' + Math.round(v).toLocaleString('en-AU');
  function renderCost() {
    const X = R.kits;
    const bill = k => {
      const c = byId(k.id), t = kitTotal(k);
      const known = t.hi ? (Math.round(t.lo) === Math.round(t.hi) ? money(t.lo) : `${money(t.lo)}–${Math.round(t.hi).toLocaleString('en-AU')}`) : null;
      return `<div class="rv-kit${k.id === S.kit ? '' : ' is-off'}" data-kitcard="${esc(k.id)}">
        <h3>${goto(c.id, c.name)}</h3>
        <div class="table-wrap"><table class="tbl rv-stack rv-bill"><thead><tr><th>Part</th><th>What</th><th>Price</th><th>Where</th></tr></thead><tbody>
        ${k.lines.map(l => l.ref
          ? `<tr><th scope="row">${esc(l.part)}</th><td data-l="What">${esc(c.name)}<div class="small dim">${esc(c.price.detail)}</div></td><td data-l="Price"><b>${esc(c.price.text)}</b></td><td data-l="Where">${buyList(c)}</td></tr>`
          : `<tr><th scope="row">${esc(l.part)}</th><td data-l="What">${esc(l.what)}${l.note ? `<div class="small dim">${esc(l.note)}</div>` : ''}</td><td data-l="Price"><b>${esc(l.price)}</b></td>${l.links ? `<td data-l="Where"><ul class="rv-buy">${l.links.map(x => `<li>${ext(x[0], x[1])}</li>`).join('')}</ul></td>` : '<td class="rv-none"><span class="dim">—</span></td>'}</tr>`).join('')}
        </tbody><tfoot><tr><th scope="row" colspan="2">${known ? 'Known so far' : 'Nothing here has a price that could be read'}</th><td><b>${known || '—'}</b></td><td>${t.unknown ? `plus ${t.unknown} ${t.unknown === 1 ? 'line' : 'lines'} to check with the seller` : 'before delivery'}</td></tr></tfoot></table></div></div>`;
    };
    $('#out-cost').innerHTML = `<p class="lead">${rich(X.lead)}</p>
      <div class="rv-seg rv-kits" role="group" aria-label="Which computer">${X.list.map(k => `<button type="button" data-kit="${esc(k.id)}" aria-pressed="${k.id === S.kit}"><b>${esc(byId(k.id).short)}</b></button>`).join('')}</div>
      ${X.list.map(bill).join('')}
      <p class="small dim">Australian dollars, including GST where the seller says so. A stick price is for a kit with antennas. For the antenna, the box, the power system and the link to the internet, use the <a href="${esc(X.builder)}">base station builder</a>. From reports ${reps(X.reports)}.</p>`;
  }

  // ══ 7. the software ══════════════════════════════════════════════════════
  const wrap = (text, n) => { const out = []; let line = ''; for (const w of String(text).split(' ')) { if (line && (line + ' ' + w).length > n) { out.push(line); line = w; } else line = line ? line + ' ' + w : w; } if (line) out.push(line); return out; };
  // One box of the drawing: lines of text, wrapped to its width, in a rounded rectangle.
  function box(x, y, w, cls, parts) {
    let ty = y + 8, t = '';
    for (const [text, tc, size] of parts) { const lh = size + 4; for (const ln of wrap(text, Math.floor((w - 20) / (size * 0.56)))) { ty += lh; t += `<text class="${tc}" x="${x + 10}" y="${ty - 3}" font-size="${size}">${esc(ln)}</text>`; } ty += 3; }
    const h = ty - y + 6;
    return { h, svg: h2 => `<g class="${cls}"><rect x="${x}" y="${y}" width="${w}" height="${h2 || h}" rx="9"/>${t}</g>` };
  }
  function flowSvg(isNarrow) {
    const X = R.software, ST = { ok: 's-ok', warn: 's-warn', off: 's-off' };
    const mk = '<defs><marker id="ar-flow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L10 5L0 10z" fill="currentColor"/></marker></defs>';
    const z = isNarrow ? 1.12 : 1;                       // the tall layout is drawn smaller on a phone, so its words are larger
    const srcParts = [[X.source.name, 't1', 13.5 * z], [X.source.sub, 't2', 11.5 * z]];
    const formParts = f => [[f.name, 't1', 13 * z], [f.sub, 't2', 11.5 * z], [f.status, ST[f.cls] || 's-off', 11.5 * z]];
    const takeParts = f => [['Takes it', 't3', 10.5 * z], [f.takes, 't2', 11.5 * z]];
    let out = '', H = 0;
    if (isNarrow) {
      const W = 340, s = box(8, 8, W - 16, 'src', srcParts);
      out += s.svg(); let y = 8 + s.h, trunkEnd = y;
      for (const f of X.forms) {
        const fb = box(34, y + 16, W - 42, 'form', formParts(f)); out += fb.svg();
        const mid = y + 16 + fb.h / 2; out += `<path class="lnk" d="M20 ${mid} H32" marker-end="url(#ar-flow)"/>`; trunkEnd = mid;
        const tb = box(60, y + 16 + fb.h + 14, W - 68, 'takes', takeParts(f)); out += tb.svg();
        out += `<path class="lnk" d="M46 ${y + 16 + fb.h} V${y + 16 + fb.h + 14 + tb.h / 2} H58" marker-end="url(#ar-flow)"/>`;
        y = y + 16 + fb.h + 14 + tb.h;
      }
      out += `<path class="lnk" d="M20 ${8 + s.h} V${trunkEnd}"/>`;
      H = y + 10;
      return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-hidden="true">${mk}${out}</svg>`;
    }
    const W = 960, c1 = 10, w1 = 230, c2 = 310, w2 = 300, c3 = 680, w3 = 270, top = 30;
    const rows = X.forms.map(f => ({ f, fb: box(c2, 0, w2, 'form', formParts(f)), tb: box(c3, 0, w3, 'takes', takeParts(f)) }));
    let y = top; const mids = [];
    for (const r of rows) {
      const h = Math.max(r.fb.h, r.tb.h);
      out += box(c2, y, w2, 'form', formParts(r.f)).svg(h) + box(c3, y, w3, 'takes', takeParts(r.f)).svg(h);
      out += `<path class="lnk" d="M${c2 + w2} ${y + h / 2} H${c3 - 3}" marker-end="url(#ar-flow)"/>`;
      mids.push(y + h / 2); y += h + 14;
    }
    H = y - 14 + 10;
    const s = box(c1, 0, w1, 'src', srcParts), sy = Math.round((top + H - 10) / 2 - s.h / 2), sm = sy + s.h / 2;
    out += box(c1, sy, w1, 'src', srcParts).svg();
    for (const m of mids) out += `<path class="lnk" d="M${c1 + w1} ${sm} C ${c1 + w1 + 44} ${sm}, ${c2 - 44} ${m}, ${c2 - 3} ${m}" marker-end="url(#ar-flow)"/>`;
    out += `<text class="d-col" x="${c1 + w1 / 2}" y="16">The release</text><text class="d-col" x="${c2 + w2 / 2}" y="16">Three forms</text><text class="d-col" x="${c3 + w3 / 2}" y="16">Which computer takes it</text>`;
    return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-hidden="true">${mk}${out}</svg>`;
  }
  const flowNarrow = () => window.matchMedia('(max-width: 760px)').matches;
  function renderFlow() { const el = $('#rv-flow'); if (el) el.innerHTML = flowSvg(flowNarrow()); }
  function renderSoftware() {
    const X = R.software, T = X.tested, P = X.profiles;
    const tbl = (cols, rows, cls, marks) => `<div class="table-wrap"><table class="tbl rv-stack ${cls || ''}"><thead><tr>${cols.map(c => `<th>${esc(c)}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr><th scope="row">${rich(r[0])}</th>${r.slice(1).map((v, i) => `<td data-l="${esc(cols[i + 1])}">${marks && /^(Passed|Yes|Nothing to report|\d+ of \d+)$/.test(v) ? `<span class="ok">${esc(v)}</span>` : marks && /^No\b/.test(v) ? `<span class="bad">${esc(v)}</span>` : marks && /^Skipped/.test(v) ? `<span class="warn">${esc(v)}</span>` : esc(v)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
    $('#out-software').innerHTML = `<p class="lead">${rich(X.lead)}</p>
      <figure class="diagram rv-dia rv-flow" id="rv-flow" aria-label="RPi ALERT's signed release, taken unchanged, becomes three forms: ${esc(X.forms.map(f => `${f.name} (${f.status}; ${f.takes})`).join('; '))}"></figure>
      <div class="legend small"><span><i class="lg-warn"></i>built, and tested without a real radio</span><span><i class="lg-off"></i>being written: not finished, not released</span><span>${esc(X.pi)}</span></div>
      <h3>Standard against enterprise</h3>
      <p>${rich(X.profilesLead)}</p>
      ${tbl(P.cols, P.rows, 'rv-prof')}
      <p class="small dim">${rich(P.note)}</p>
      <p class="small dim">${rich(P.caveat)}</p>
      <h3>Does a container waste the processor?</h3>
      <p>${rich(X.containerLead)}</p>
      <div class="rv-costs">${X.container.map(k => `<div class="kpi k-${k.kind}"><span class="k-l">${esc(k.what)}</span><span class="rv-kv">${esc(k.cost)}</span></div>`).join('')}</div>
      <h3>What has been tested, and where</h3>
      <div class="note"><b>As at ${esc(T.asof)}.</b> ${esc(T.current)} ${ext('The firmware\'s own notes (firmware/README.md)', T.source)}.</div>
      <p>${esc(T.state)} ${esc(T.where)} ${esc(T.run)}</p>
      ${tbl(T.cols, T.rows, 'rv-inline rv-tested', true)}
      ${ul(T.also, 'small')}
      <div class="note bad"><b>Not tested yet:</b>${ul(T.not)}</div>
      <p class="small">${ext('The firmware\'s own notes, with every check', T.source)} · ${ext('Where releases will appear', X.releases.url)}: ${esc(X.releases.text)}</p>
      <p class="small dim">From reports ${reps(X.reports)}.</p>`;
    renderFlow();
  }

  // ══ 8. a board of our own; the radio ═════════════════════════════════════
  function renderCustom() {
    const X = R.custom;
    $('#out-custom').innerHTML = `<p class="lead">${rich(X.lead)}</p>
      <p class="rv-chips">Reasons that count: ${X.reasons.map(r => `<span class="chip plain">${esc(r)}</span>`).join(' ')}</p>
      <ol class="rv-stages">${X.stages.map(s => `<li class="card-o"><h4>${esc(s.head)}</h4><p class="small">${rich(s.text)}</p></li>`).join('')}</ol>
      <h3>What to start from</h3>
      <div class="table-wrap"><table class="tbl rv-stack"><thead><tr><th>Start from</th><th>For it</th><th>Against it</th></tr></thead><tbody>${X.bases.map(b => `<tr><th scope="row">${b.id ? goto(b.id, b.name) : esc(b.name)}</th><td data-l="For it">${rich(b.good)}</td><td data-l="Against it">${rich(b.but)}</td></tr>`).join('')}</tbody></table></div>
      <h3>What it might cost ${chip('est.', 'warn', TERM.est.meaning)}</h3>
      <p class="small">${rich(X.estimatesLead)}</p>
      <div class="table-wrap"><table class="tbl rv-est"><tbody>${X.estimates.map(e => `<tr><th scope="row">${esc(e.what)}</th><td><b>${esc(e.cost)}</b> ${chip('est.', 'warn', TERM.est.meaning)}</td></tr>`).join('')}</tbody></table></div>
      <p class="small dim">"est." marks an estimate: ${esc(TERM.est.meaning.replace(/^An estimate: /, ''))} ${rich(X.estimatesNote)} From report ${reps(X.reports)}.</p>`;
  }
  function renderRadio() {
    const X = R.radio;
    $('#out-radio').innerHTML = `<p class="lead">${rich(X.lead)}</p>
      <div class="rv-two">${X.facts.map(f => `<div class="card-o p-${f.cls} rv-pick"><div class="rv-pick-h">${chip(f.chip, f.cls)}</div><h3>${esc(f.head)}</h3><p class="small">${rich(f.text)}</p></div>`).join('')}</div>
      <p><b>Where to buy the V3:</b> ${X.buy.map(b => ext(b[0], b[1])).join(' · ')}. <span class="small dim">${esc(X.buyNote)}</span></p>
      <p>${rich(X.altLead)}</p>
      <div class="table-wrap"><table class="tbl rv-stack"><thead><tr><th>Alternative</th><th>Why it is not a straight swap</th></tr></thead><tbody>${X.alts.map(a => `<tr><th scope="row">${esc(a.name)}</th><td data-l="Why it is not a straight swap">${rich(a.why)}</td></tr>`).join('')}</tbody></table></div>
      <p class="small">${rich(X.risk)}</p>
      <p class="small dim">${X.links.map(l => ext(l[0], l[1])).join(' · ')} · from report ${reps(X.reports)}.</p>`;
  }

  // ══ 9. the words, the sources, the photo credits ═════════════════════════
  function renderWords() {
    $('#out-words').innerHTML = `<p class="small dim">A dotted line under a word on this page means its meaning shows when you hover over it. They are all here to read as well.</p>
      <dl class="rv-words">${R.terms.map(t => `<div id="w-${esc(t.id)}"><dt>${esc(t.term)}</dt><dd>${esc(t.meaning)}</dd></div>`).join('')}</dl>`;
  }
  function renderSources() {
    $('#out-sources').innerHTML = `<p>${rich(R.page.sections.sources)}</p>
      <ul class="rv-src">${R.reports.map(r => `<li><a href="${esc(R.REV + r.file)}" target="_blank" rel="noopener"><b>${esc(r.id.replace(/v$/, ' re-check'))}</b> · ${esc(r.title)}</a><span class="small dim">${esc(r.covers)}</span></li>`).join('')}</ul>
      <p class="small">${ext('The review\'s own summary', R.REPO + '/blob/main/docs/hardware-review/README.md')} · ${ext('The firmware folder', R.REPO + '/tree/main/firmware')}</p>`;
    const used = photosUsed();
    $('#out-credits').innerHTML = `<p class="small">${rich(R.page.sections.credits)}</p>
      <div class="table-wrap"><table class="tbl rv-stack rv-inline rv-credits"><thead><tr><th>Photograph of</th><th>Author</th><th>Licence</th><th>Source</th><th>Changes</th></tr></thead><tbody>
      ${used.map(id => { const im = IMG[id]; return im ? `<tr><th scope="row">${esc(im.subject)}</th><td data-l="Author">${esc(im.credit || im.author)}</td><td data-l="Licence">${ext(im.licence, im.licenceUrl)}</td><td data-l="Source">${ext(im.source.replace(/^https?:\/\//, '').split('/')[0], im.source)}</td><td data-l="Changes">${esc(im.changes)}</td></tr>` : ''; }).join('')}
      </tbody></table></div>
      <p class="small dim">The drawings of a single board, a module on a carrier, a fanless box, a small desktop and a DIN-rail gateway were made for this page and are under the site's MIT licence. Each photograph keeps its own licence, named beside it, and is not under the MIT licence; each resized copy is offered under the same licence as its original.</p>`;
  }

  // ══ events ═══════════════════════════════════════════════════════════════
  function toast(t) { const el = $('#toast'); el.textContent = t; el.classList.add('show'); clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove('show'), 2200); }
  function show(id) {
    if (!filterComputers(R.computers, S.f).some(c => c.id === id)) { S.f = []; save(); renderList(); toast('Filters cleared to show it'); }
    const el = document.getElementById('c-' + id);
    if (!el) return;
    el.scrollIntoView({ block: 'center' });
    el.classList.add('flash'); setTimeout(() => el.classList.remove('flash'), 2200);
  }
  document.addEventListener('click', e => {
    const a = e.target.closest('a[data-goto]');
    if (a) { e.preventDefault(); history.replaceState(null, '', '#c-' + a.dataset.goto); show(a.dataset.goto); return; }
    const b = e.target.closest('button');
    if (!b) return;
    const d = b.dataset;
    if (d.filter) { S.f = S.f.includes(d.filter) ? S.f.filter(x => x !== d.filter) : S.f.concat(d.filter); save(); renderList(); }
    else if (d.view) { S.view = d.view; save(); renderList(); }
    else if (d.org) { S.org = d.org; save(); $$('[data-org]').forEach(x => x.setAttribute('aria-pressed', String(x.dataset.org === S.org))); $$('[data-orgcard]').forEach(x => x.classList.toggle('is-off', x.dataset.orgcard !== S.org)); }
    else if (d.kit) { S.kit = d.kit; save(); $$('[data-kit]').forEach(x => x.setAttribute('aria-pressed', String(x.dataset.kit === S.kit))); $$('[data-kitcard]').forEach(x => x.classList.toggle('is-off', x.dataset.kitcard !== S.kit)); }
    else if (d.uncompare) { S.cmp = S.cmp.filter(x => x !== d.uncompare); save(); renderCompare(); renderList(); }
    else if (d.act === 'reset') { S.f = []; save(); renderList(); }
    else if (d.act === 'clearcmp') { S.cmp = []; save(); renderCompare(); renderList(); }
    else if (d.act === 'showcmp') { $('#rv-compare').scrollIntoView({ block: 'start' }); }
    else if (d.act === 'theme') cycleTheme();
    else if (d.act === 'copycode') {
      const code = document.getElementById(d.for).textContent;
      (navigator.clipboard ? navigator.clipboard.writeText(code) : Promise.reject()).then(() => toast('Copied')).catch(() => toast('Couldn\'t copy here'));
    }
  });
  document.addEventListener('change', e => {
    const el = e.target;
    if (el.id === 'rv-sort') { S.sort = el.value; save(); renderList(); }
    if (el.dataset.compare) {
      const r = toggleCompare(S.cmp, el.dataset.compare);
      if (r.full) { el.checked = false; toast(`Three at most: untick one first`); return; }
      S.cmp = r.ids; save(); renderCompare();
      $$(`[data-compare="${el.dataset.compare}"]`).forEach(x => { x.checked = S.cmp.includes(el.dataset.compare); });
    }
  });
  // The software drawing has a tall layout for a phone and a wide one for a desk.
  window.matchMedia('(max-width: 760px)').addEventListener('change', renderFlow);
  // Redrawn only when the view really changes, so an open fold is not closed for nothing.
  window.matchMedia('(max-width: 899px)').addEventListener('change', () => { if (S.view === 'auto' && view() !== drawn) renderList(); });
  // Printing: every computer as a card, every fold open.
  let before = null;
  window.addEventListener('beforeprint', () => { if (before != null) return; before = S.view; S.view = 'cards'; renderList(); $$('details').forEach(d => { d.dataset.was = d.open ? '1' : ''; d.open = true; }); });
  window.addEventListener('afterprint', () => { if (before != null) { S.view = before; before = null; renderList(); } $$('details').forEach(d => { if (d.dataset.was === '') d.open = false; }); });

  const THEME_KEY = 'open-alert:theme';
  function applyTheme(t) {
    if (t === 'light' || t === 'dark') document.documentElement.dataset.theme = t; else delete document.documentElement.dataset.theme;
    const l = $('#theme-label'); if (l) l.textContent = { light: 'Light', dark: 'Dark' }[t] || 'Auto';
  }
  function cycleTheme() {
    let t = 'auto';
    try { t = localStorage.getItem(THEME_KEY) || 'auto'; } catch (e) { /* ignore */ }
    t = { auto: 'light', light: 'dark', dark: 'auto' }[t] || 'auto';
    try { localStorage.setItem(THEME_KEY, t); } catch (e) { /* ignore */ }
    applyTheme(t);
  }
  try { applyTheme(localStorage.getItem(THEME_KEY) || 'auto'); } catch (e) { applyTheme('auto'); }

  renderVerdict(); renderClaims(); renderSecurity(); renderComputers(); renderSpeed(); renderCost(); renderSoftware(); renderCustom(); renderRadio(); renderWords(); renderSources();
  // The compare button steps aside while the side-by-side view is on screen.
  if ('IntersectionObserver' in window) new IntersectionObserver(es => { $('#rv-fab').classList.toggle('away', es[0].isIntersecting); }).observe($('#rv-compare'));
  if (/^#c-/.test(location.hash)) setTimeout(() => show(location.hash.slice(3)), 60);
  else if (location.hash.length > 1) { const el = document.getElementById(location.hash.slice(1)); if (el) setTimeout(() => el.scrollIntoView(), 60); }
})();
