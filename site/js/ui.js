// open-ALERT configurator — ui.js
//
//   The page: the sites in the network down the side, the one being edited in
//   four steps (needs → requirements → hardware → result), the network as a
//   whole, the catalogue, and the details of any part. Everything it shows is
//   what OAEngine.evaluate() returns; this file only draws it and turns clicks
//   and keystrokes back into changes to the state.
//
// The state is one object, kept in localStorage and, on request, in a share
// link (#s=…). It holds the designs and the settings and nothing derived, so
// a link made today opens the same network tomorrow, priced from tomorrow's
// catalogue.

(function () {
  'use strict';
  const E = window.OAEngine;
  E.setCatalog(window.OA_CATALOG || []);
  const P = window.OA_PRESETS || { designs: [], networks: [] };
  const KEY = 'open-alert:v1';
  const THEME_KEY = 'open-alert:theme';

  const $ = (sel, root = document) => root.querySelector(sel);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const plural = (n, one, many) => `${n} ${n === 1 ? one : (many || one + 's')}`;
  // Lower-case a label's first letter for use mid-sentence — not "GPS" or "ALERT2 receiver".
  const lc = s => /^[A-Z][a-z]/.test(s) ? s[0].toLowerCase() + s.slice(1) : s;

  // ── state ──────────────────────────────────────────────────────────────────

  let S = null;
  function blankState() {
    return { v: 1, designs: [], active: null, view: 'configure', step: 'needs',
      settings: Object.assign({}, E.DEFAULT_SETTINGS), showUnfit: false, welcome: true,
      cat: { q: '', group: '', role: '', proto: '', open: '', grade: 0, status: '', sort: 'group' }, compare: [], more: {}, open: {} };
  }
  const fromPreset = (id, over) => E.fromPreset(P.designs.find(x => x.id === id) || id, over);
  function exampleNetwork(id) {
    const net = P.networks.find(n => n.id === id) || P.networks[0];
    if (!net) return [];
    return net.designs.map(x => fromPreset(x.preset, x));
  }
  function load() {
    let st = null;
    const m = location.hash.match(/[#&]s=([A-Za-z0-9_-]+)/);
    if (m) {
      try { st = decodeState(m[1]); toastLater('Opened the shared network'); } catch (e) { toastLater('That share link could not be read'); }
      history.replaceState(null, '', location.pathname + location.search);
    }
    if (!st) { try { st = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { st = null; } }
    const b = blankState();
    if (!st || !Array.isArray(st.designs)) { b.designs = exampleNetwork(); b.active = b.designs[0] && b.designs[0].id; return b; }
    st = Object.assign(b, st, { settings: Object.assign({}, E.DEFAULT_SETTINGS, st.settings || {}), cat: Object.assign(b.cat, st.cat || {}) });
    st.designs = st.designs.filter(d => d && E.ROLES[d.role]).map(d => E.normalise(d));
    if (!st.designs.some(d => d.id === st.active)) st.active = st.designs[0] && st.designs[0].id;
    return st;
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* private mode: the page still works */ }
  }
  function encodeState(st) {
    const keep = { v: 1, designs: st.designs.map(d => ({ id: d.id, role: d.role, name: d.name, qty: d.qty, f: d.f, picks: d.picks, per: d.per, sizes: d.sizes, prices: d.prices })), active: st.active, settings: st.settings };
    const bytes = new TextEncoder().encode(JSON.stringify(keep));
    let bin = '';
    bytes.forEach(b => { bin += String.fromCharCode(b); });
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function decodeState(s) {
    const b64 = s.replace(/-/g, '+').replace(/_/g, '/');
    const bin = atob(b64 + '==='.slice((b64.length + 3) % 4));
    const bytes = Uint8Array.from(bin, c => c.charCodeAt(0));
    const st = JSON.parse(new TextDecoder().decode(bytes));
    if (!Array.isArray(st.designs)) throw new Error('no designs');
    return st;
  }
  const active = () => S.designs.find(d => d.id === S.active) || null;

  // ── small pieces ───────────────────────────────────────────────────────────

  const money = v => E.money(v, S.settings);
  const ICON = {
    field: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 21V9M7 9l-3-5h6zM14 21h6M17 21v-7M15 10a2 2 0 1 0 4 0c0-1.5-2-4-2-4s-2 2.5-2 4z"/></svg>',
    repeater: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 9v12M8 21l4-12 4 12M9.5 16h5M8.5 5.5a5 5 0 0 1 7 0M6 3a8.5 8.5 0 0 1 12 0"/><circle cx="12" cy="8" r="1"/></svg>',
    base: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 21V10l8-6 8 6v11zM9 21v-6h6v6M17 3v4"/></svg>',
  };
  const roleTag = role => `<span class="role-tag role-${role}">${ICON[role]}${esc(E.ROLES[role].label)}</span>`;
  function protoChips(it) {
    const c = it.can || [];
    const a1 = c.filter(t => /^a1-/.test(t)), a2 = c.filter(t => /^a2-/.test(t));
    const words = { 'a1-tx': 'sends', 'a2-tx': 'sends', 'a1-rx': 'decodes', 'a1-iq': 'hears (with software)', 'a2-rx': 'receives', 'a1-repeat': 'repeats', 'a2-repeat': 'repeats', 'a1-conc': 'concentrates into ALERT2', 'a1-audio': 'audio for a decoder' };
    const out = [];
    if (a1.length) out.push(`<span class="chip a1" title="ALERT1: ${esc(a1.map(t => words[t] || t).join(', '))}">ALERT1</span>`);
    if (a2.length) out.push(`<span class="chip a2" title="ALERT2: ${esc(a2.map(t => words[t] || t).join(', '))}">ALERT2</span>`);
    return out.join('');
  }
  function openChip(it) {
    if (!it.open) return '';
    const out = [];
    if (it.open.sw === 'open') out.push(`<span class="chip open" title="${esc(it.open.lic || 'Open source')}">Open source</span>`);
    else if (it.open.sw === 'partial') out.push('<span class="chip partial" title="Some firmware, drivers or tools are closed">Partly open</span>');
    else if (it.open.sw === 'closed') out.push('<span class="chip closed" title="Closed firmware or software">Closed</span>');
    if (it.open.hw === 'open') out.push('<span class="chip open" title="Schematics published">Open hardware</span>');
    return out.join('');
  }
  const STATUS = { planned: ['Planned', 'bad'], beta: ['Young', 'warn'], eol: ['End of life', 'warn'], discontinued: ['Discontinued', 'bad'], diy: ['DIY', 'warn'], existing: ['Already on site', 'info'] };
  const statusChip = it => STATUS[it.status] ? `<span class="chip st-${STATUS[it.status][1]}">${STATUS[it.status][0]}</span>` : '';
  const grade = g => g == null ? '' : `<span class="grade" role="img" aria-label="Grade ${g} of 5" title="Grade ${g} of 5">${'●'.repeat(g)}<span>${'●'.repeat(5 - g)}</span></span>`;
  const tempChip = it => it.temp && it.temp[0] != null ? `<span class="chip plain" title="Operating temperature">${it.temp[0]}…${it.temp[1]} °C</span>` : '';
  function powerChip(it, role) {
    const p = Object.assign({}, it.power || {}, (it.power || {})[role] || {});
    const w = p.w != null ? p.w : null;
    if (w == null && !p.txW) return '';
    const bits = [];
    if (w != null) bits.push(E.fmtW(w));
    if (p.txW) bits.push(`${E.fmtW(p.txW)} sending`);
    return `<span class="chip plain" title="Average draw${p.txW ? '; draw while transmitting' : ''}">${esc(bits.join(' · '))}</span>`;
  }
  const BASIS = { retail: 'retail', list: 'list', estimate: 'estimate', quote: 'quote only', tender: 'tender', used: 'used', free: 'free', existing: 'existing' };
  function priceHtml(it, role, d) {
    const over = d && d.prices && d.prices[it.id] != null;
    const u = over ? overrideShown(d.prices[it.id]) : E.unitPrice(it, S.settings, role);
    if (u == null) return '<span class="price unknown" title="Quote only — type your quote into the bill of materials">Quote</span>';
    const b = over ? 'your quote' : BASIS[it.price && it.price.basis] || '';
    const unit = it.unit === 'm' ? '/m' : '';
    return `<span class="price">${u === 0 ? 'Free' : money(u)}${unit}${b && u !== 0 ? ` <small>${esc(b)}</small>` : ''}</span>`;
  }
  // A typed quote is kept in AUD including GST; shown in the current setting.
  const overrideShown = audInc => { let v = S.settings.gst ? audInc : audInc / 1.1; if (S.settings.currency === 'USD') v *= S.settings.usdPerAud; return v; };
  const fitWord = { ok: 'Fits', warn: 'Fits, with caveats', fail: 'Does not fit' };
  const fitIcon = { ok: '✓', warn: '!', fail: '✕', info: 'i' };
  function reasonsHtml(fit, max = 4) {
    const rs = fit.reasons.filter(r => r.level !== 'ok');
    if (!rs.length) return '';
    return `<ul class="why">${rs.slice(0, max).map(r => `<li class="r-${r.level}"><span aria-hidden="true">${fitIcon[r.level]}</span> ${esc(r.text)}</li>`).join('')}${rs.length > max ? `<li class="r-info">+ ${rs.length - max} more</li>` : ''}</ul>`;
  }
  const featureLabel = id => { const f = E.FEATURES.find(x => x.id === id); return f ? f.label : id; };

  // ── render ─────────────────────────────────────────────────────────────────

  function render() {
    preserveFocus(() => {
      for (const v of ['configure', 'network', 'catalogue', 'about']) {
        const sec = $(`#view-${v}`), tab = $(`#tab-${v}`);
        sec.hidden = S.view !== v;
        tab.setAttribute('aria-selected', String(S.view === v));
        tab.tabIndex = S.view === v ? 0 : -1;
      }
      if (S.view === 'configure') renderConfigure();
      if (S.view === 'network') renderNetwork();
      if (S.view === 'catalogue') renderCatalogue();
    });
    save();
  }
  function preserveFocus(fn) {
    const a = document.activeElement;
    let key = null;
    if (a && a !== document.body && a.dataset && (a.dataset.bind || a.dataset.act)) {
      key = { bind: a.dataset.bind, act: a.dataset.act, id: a.dataset.id, slot: a.dataset.slot, step: a.dataset.step, view: a.dataset.view, v: a.value, type: a.type, s: a.selectionStart, e: a.selectionEnd };
    }
    const y = window.scrollY;
    fn();
    if (key) {
      let sel = key.bind ? `[data-bind="${CSS.escape(key.bind)}"]` : `[data-act="${CSS.escape(key.act)}"]`;
      if (!key.bind) for (const k of ['id', 'slot', 'step', 'view']) if (key[k]) sel += `[data-${k}="${CSS.escape(key[k])}"]`;
      if (key.type === 'radio' || key.type === 'checkbox') sel += `[value="${CSS.escape(key.v)}"]`;
      const el = document.querySelector(sel);
      if (el) {
        el.focus({ preventScroll: true });
        try { if (key.s != null && el.setSelectionRange && /text|search|number/.test(el.type)) el.setSelectionRange(key.s, key.e); } catch (e) { /* number inputs refuse selection */ }
      }
    }
    window.scrollTo(0, y);
  }

  // ── configure view ─────────────────────────────────────────────────────────

  function renderConfigure() {
    const net = E.network(S.designs, S.settings);
    const ev = new Map(net.evs.map(x => [x.d.id, x.r]));
    const d = active();
    $('#view-configure').innerHTML = `${S.welcome ? welcomeHtml() : ''}
      <div class="cfg">
        <aside class="designs" aria-label="Sites in your network">${designsHtml(net, ev)}</aside>
        <div class="editor">${d ? editorHtml(d, ev.get(d.id)) : emptyEditorHtml()}</div>
      </div>`;
  }
  function welcomeHtml() {
    return `<div class="welcome">
      <div><b>Start here.</b> This is an example network — ${esc((P.networks[0] || {}).blurb || 'a small catchment')}. Pick a site under “Your network”, change what it must do, and watch the hardware, the cost and the consequences follow. Or start your own.</div>
      <div class="actions"><button type="button" data-act="start-empty">Start empty</button>
        <label class="inline">or another example <select data-bind="example" aria-label="Load an example network"><option value="">Choose…</option>${P.networks.map(n => `<option value="${esc(n.id)}">${esc(n.name)}</option>`).join('')}</select></label>
        <button type="button" class="ghost" data-act="welcome-close">Got it</button></div>
    </div>`;
  }
  function designsHtml(net, ev) {
    const groups = E.ROLE_LIST.map(role => {
      const ds = S.designs.filter(d => d.role === role);
      const items = ds.map(d => {
        const r = ev.get(d.id);
        const st = r.issues.fail ? 'fail' : r.issues.warn ? 'warn' : 'ok';
        const stTxt = r.issues.fail ? `${r.issues.fail} to fix` : r.issues.warn ? `${r.issues.warn} to note` : 'meets its needs';
        return `<li><button type="button" class="dcard${d.id === S.active ? ' active' : ''}" data-act="select" data-id="${esc(d.id)}" aria-current="${d.id === S.active}">
          <span class="dc-ico role-${role}">${ICON[role]}</span>
          <span class="dc-main"><b>${esc(d.name)}</b><span class="dc-sub">${money(r.cost.hw)}${r.cost.unknown ? '+' : ''} each <span class="st st-${st}">· ${esc(stTxt)}</span></span></span>
          <span class="dc-qty" title="Number of sites">×${d.qty}</span></button></li>`;
      }).join('');
      return `<div class="dgroup"><h3>${esc(E.ROLES[role].plural)}</h3>${items ? `<ul>${items}</ul>` : ''}
        <button type="button" class="ghost add" data-act="add" data-role="${role}">+ Add a ${esc(E.ROLES[role].label.toLowerCase())}</button></div>`;
    }).join('');
    const t = net.totals;
    return `<h2>Your network</h2>${groups}
      <div class="net-mini">
        <div><span>${plural(t.sites, 'site')}, hardware</span><b>${money(t.hw)}${t.unknown ? '+' : ''}</b></div>
        ${S.settings.labour ? `<div><span>Installation</span><b>${money(t.labour)}</b></div>` : ''}
        <div><span>Each year</span><b>${money(t.yearly)}</b></div>
        <button type="button" class="ghost" data-act="view" data-view="network">Network summary →</button>
      </div>`;
  }
  function emptyEditorHtml() {
    return `<div class="empty"><h2>No sites yet</h2><p>Add a field station, a repeater or a base station under “Your network” — or load an example network.</p>
      <div class="actions">${E.ROLE_LIST.map(r => `<button type="button" data-act="add" data-role="${r}">+ ${esc(E.ROLES[r].label)}</button>`).join('')}</div></div>`;
  }
  function editorHtml(d, r) {
    const steps = [
      ['needs', '1', 'Needs', ''],
      ['reqs', '2', 'Requirements', `${r.reqs.length}`],
      ['hardware', '3', 'Hardware', hwProgress(r)],
      ['result', '4', 'Result', r.issues.fail ? `${r.issues.fail} ✕` : r.issues.warn ? `${r.issues.warn} !` : '✓'],
    ];
    const presets = P.designs.filter(p => p.role === d.role);
    const c = r.cost;
    const yearsCost = c.tco;
    const body = { needs: needsHtml, reqs: reqsHtml, hardware: hardwareHtml, result: resultHtml }[S.step] || needsHtml;
    const idx = steps.findIndex(s => s[0] === S.step);
    return `<div class="ed-head">
        <div class="ed-title">${roleTag(d.role)}<input class="ed-name" data-bind="name" value="${esc(d.name)}" aria-label="Name of this site" maxlength="80"></div>
        <div class="ed-tools">
          <label class="qty">Sites like this <input type="number" min="1" max="10000" step="1" data-bind="qty" value="${d.qty}"></label>
          <select data-bind="preset" aria-label="Start this site from a preset"><option value="">Start from a preset…</option>${presets.map(p => `<option value="${esc(p.id)}">${esc(p.name)}</option>`).join('')}</select>
          <button type="button" class="ghost" data-act="dup">Duplicate</button>
          <button type="button" class="ghost danger" data-act="del">Remove</button>
        </div>
      </div>
      <p class="ed-blurb small dim">${esc(E.ROLES[d.role].blurb)}${d.preset ? ` Started from “${esc((P.designs.find(p => p.id === d.preset) || {}).name || d.preset)}”.` : ''}</p>
      <div class="kpis">
        ${kpi('Hardware, one site', money(c.hw) + (c.unknown ? '+' : ''), c.unknown ? `${plural(c.unknown, 'part')} priced on request` : 'parts and supporting parts')}
        ${S.settings.labour ? kpi('Installation', money(c.labour), `${c.effort.install + c.effort.bench} person-days`) : ''}
        ${kpi('Each year', money(c.yearly + c.visitsYear), 'plans, licences, a site visit')}
        ${kpi(`${S.settings.years} years, one site`, money(yearsCost) + (c.unknown ? '+' : ''), 'hardware, installation, running, replacements')}
        ${kpi('Average power', E.fmtW(r.power.w), `${Math.round(r.power.whDay)} Wh a day`)}
      </div>
      <nav class="steps" role="tablist" aria-label="Steps for this site">${steps.map(s => `<button type="button" role="tab" data-act="step" data-step="${s[0]}" aria-selected="${S.step === s[0]}"><span class="n">${s[1]}</span> ${s[2]}${s[3] ? ` <span class="count">${esc(s[3])}</span>` : ''}</button>`).join('')}</nav>
      <div class="panel" role="tabpanel">${body(d, r)}</div>
      <div class="step-nav">${idx > 0 ? `<button type="button" class="ghost" data-act="step" data-step="${steps[idx - 1][0]}">← ${steps[idx - 1][2]}</button>` : '<span></span>'}
        ${idx < steps.length - 1 ? `<button type="button" data-act="step" data-step="${steps[idx + 1][0]}">${steps[idx + 1][2]} →</button>` : `<button type="button" data-act="view" data-view="network">Network summary →</button>`}</div>`;
  }
  const kpi = (label, value, sub) => `<div class="kpi"><span class="k-l">${esc(label)}</span><span class="k-v">${esc(value)}</span><span class="k-s">${esc(sub)}</span></div>`;
  function hwProgress(r) {
    const need = r.slots.filter(s => s.shown && !s.covered && !s.def.optional);
    const done = need.filter(s => s.picks.length);
    return `${done.length}/${need.length}`;
  }

  // ── step 1: needs ──

  function needsHtml(d) {
    const fts = E.visibleFeatures(d);
    const groups = [...new Set(fts.map(f => f.group))];
    return `<p class="lead">What must this ${esc(E.ROLES[d.role].label.toLowerCase())} do? Every answer becomes a requirement the hardware is judged against.</p>
      ${groups.map(g => `<fieldset class="fgroup"><legend>${esc(g)}</legend>${fts.filter(f => f.group === g).map(f => featureHtml(d, f)).join('')}</fieldset>`).join('')}`;
  }
  function featureHtml(d, f) {
    const v = d.f[f.id];
    const id = `f-${f.id}`;
    const help = f.help ? `<span class="help">${esc(f.help)}</span>` : '';
    if (f.type === 'choice') {
      const opts = E.optionsFor(f, d.role);
      const rich = opts.some(o => o.d);
      return `<div class="feat" role="radiogroup" aria-labelledby="${id}"><span class="flabel" id="${id}">${esc(f.label)}</span>${help}
        <div class="${rich ? 'cards' : 'seg'}">${opts.map(o => `<label class="opt-card"><input type="radio" name="${id}" data-bind="f:${f.id}" value="${esc(o.v)}"${v === o.v ? ' checked' : ''}><span><b>${esc(o.t)}</b>${o.d ? `<i>${esc(o.d)}</i>` : ''}</span></label>`).join('')}</div></div>`;
    }
    if (f.type === 'multi') {
      return `<div class="feat" role="group" aria-labelledby="${id}"><span class="flabel" id="${id}">${esc(f.label)}</span>${help}
        <div class="cards">${E.optionsFor(f, d.role).map(o => `<label class="opt-card"><input type="checkbox" data-bind="fm:${f.id}" value="${esc(o.v)}"${(v || []).includes(o.v) ? ' checked' : ''}><span><b>${esc(o.t)}</b>${o.d ? `<i>${esc(o.d)}</i>` : ''}</span></label>`).join('')}</div></div>`;
    }
    if (f.type === 'bool') {
      return `<div class="feat feat-bool"><label class="switch"><input type="checkbox" data-bind="fb:${f.id}" value="1"${v ? ' checked' : ''}><span class="track" aria-hidden="true"></span><span><b>${esc(f.label)}</b>${help}</span></label></div>`;
    }
    return `<div class="feat feat-num"><label for="${id}" class="flabel">${esc(f.label)}</label>${help}
      <span class="num"><input id="${id}" type="number" data-bind="fn:${f.id}" value="${esc(v)}" min="${f.min}" max="${f.max}" step="${f.step || 1}" inputmode="decimal"><span class="unit">${esc(f.unit || '')}</span></span></div>`;
  }

  // ── step 2: requirements ──

  function reqsHtml(d, r) {
    const areas = [...new Set(r.checks.map(c => c.req.area))];
    return `<p class="lead">These follow from your answers. A <b>must</b> rules a part out when it is not met; a <b>should</b> marks it. The right-hand column is how the hardware picked so far measures up.</p>
      ${areas.map(a => `<h3 class="area">${esc(a)}</h3><ul class="reqs">${r.checks.filter(c => c.req.area === a).map(c => reqRow(c)).join('')}</ul>`).join('')}
      ${r.empty.length ? `<p class="note">Still to choose: ${r.empty.map(s => `<b>${esc(lc(s.def.label))}</b>`).join(', ')}.</p>` : ''}`;
  }
  function reqRow(c) {
    const st = c.res.state;
    return `<li class="req st-${st}"><span class="lvl lvl-${c.req.level}">${c.req.level === 'must' ? 'Must' : 'Should'}</span>
      <span class="rq"><b>${esc(c.req.text)}</b>${c.req.from.length ? `<span class="from">From: ${esc(c.req.from.map(featureLabel).join(' · '))}</span>` : ''}</span>
      <span class="res"><span aria-hidden="true">${fitIcon[st]}</span> ${esc(c.res.how || (st === 'ok' ? 'Met' : ''))}</span></li>`;
  }

  // ── step 3: hardware ──

  function hardwareHtml(d, r) {
    return `<div class="hw-tools">
        <button type="button" data-act="autopick">Fill empty slots with the best fit</button>
        <button type="button" class="ghost" data-act="repick">Re-pick everything for these needs</button>
        <label class="check"><input type="checkbox" data-bind="showUnfit" value="1"${S.showUnfit ? ' checked' : ''}> Show parts that don't fit</label>
      </div>
      <p class="small dim">Sorted ${d.f.grade === 'industrial' || d.f.grade === 'critical' ? 'by grade, then price' : 'by price'}, the parts that meet every requirement first. Pick one to see why the others rank where they do.</p>
      ${r.slots.filter(s => s.shown).map(s => slotHtml(d, r, s)).join('')}
      ${periphHtml(d, r)}`;
  }
  function slotHtml(d, r, s) {
    const id = s.def.id;
    if (s.covered) {
      return `<section class="slot covered"><header class="slot-h"><h3>${esc(s.def.label)}</h3><span class="slot-state st-ok">✓ Part of ${esc(s.covered.name)}</span></header></section>`;
    }
    const pickedIds = new Set(s.picks.map(p => p.it.id));
    const ranked = E.rankCands(d, s.cands).filter(c => !pickedIds.has(c.it.id));
    const fitting = ranked.filter(c => c.fit.level !== 'fail');
    const unfit = ranked.length - fitting.length;
    const list = S.showUnfit ? ranked : fitting;
    const expanded = S.open[`${d.id}:${id}`] || !s.picks.length || s.def.multi;
    const more = S.more[`${d.id}:${id}`];
    const shown = more ? list : list.slice(0, s.picks.length ? 4 : 5);
    let state = s.picks.length ? worstFit(s.picks) : (s.def.optional ? 'opt' : 'empty');
    const stText = { ok: '✓ Fits', warn: '! Fits, with caveats', fail: '✕ Does not fit', empty: 'Choose one', opt: 'Optional' }[state];
    const sized = s.def.sized && r.power[s.def.sized];
    return `<section class="slot st-${state}" id="slot-${esc(id)}">
      <header class="slot-h"><h3>${esc(s.def.label)}</h3><span class="slot-state st-${state}">${stText}</span></header>
      ${s.def.help ? `<p class="slot-help">${esc(s.def.help)}</p>` : ''}
      ${s.picks.map(p => pickedHtml(d, s, p, sized)).join('')}
      ${expanded ? `<div class="opts">${shown.map(c => optHtml(d, s, c)).join('') || `<p class="small dim">${list.length ? '' : (unfit ? `None of the ${plural(unfit, 'option')} fit these needs — tick “Show parts that don't fit” to see why.` : 'Nothing in the catalogue goes here yet.')}</p>`}
          ${list.length > shown.length ? `<button type="button" class="ghost more" data-act="more" data-slot="${esc(id)}">Show ${list.length - shown.length} more</button>` : ''}
          ${!S.showUnfit && unfit ? `<p class="small dim">${plural(unfit, 'part')} hidden that ${unfit === 1 ? 'does' : 'do'} not fit.</p>` : ''}</div>`
        : `<button type="button" class="ghost more" data-act="open-slot" data-slot="${esc(id)}">Compare ${plural(list.length, 'other option')}</button>`}
    </section>`;
  }
  function worstFit(picks) {
    return picks.reduce((a, p) => ({ ok: 0, warn: 1, fail: 2 }[p.fit.level] > { ok: 0, warn: 1, fail: 2 }[a] ? p.fit.level : a), 'ok');
  }
  function cardCore(d, it, fit) {
    return `<div class="card-main">
        <button type="button" class="iname" data-act="item" data-id="${esc(it.id)}">${esc(it.name)}</button>
        <span class="vendor">${esc(it.vendor || '')}</span>
        <div class="chips">${protoChips(it)}${openChip(it)}${statusChip(it)}${tempChip(it)}${powerChip(it, d.role)}${grade(it.grade)}</div>
        ${it.blurb ? `<p class="blurb">${esc(it.blurb)}</p>` : ''}
        ${fit ? reasonsHtml(fit) : ''}
      </div>`;
  }
  function optHtml(d, s, c) {
    const it = c.it;
    return `<div class="opt fit-${c.fit.level}">${cardCore(d, it, c.fit)}
      <div class="card-side">${priceHtml(it, d.role, d)}<span class="fit fit-${c.fit.level}">${fitWord[c.fit.level]}</span>
        <button type="button" data-act="pick" data-slot="${esc(s.def.id)}" data-id="${esc(it.id)}">${s.def.multi ? 'Add' : s.picks.length ? 'Use this instead' : 'Choose'}</button></div></div>`;
  }
  function pickedHtml(d, s, p, sized) {
    const it = p.it;
    let qty = '';
    if (s.def.multi) qty = `<label class="qty">Qty <input type="number" min="1" max="99" data-bind="pq:${esc(s.def.id)}:${esc(it.id)}" value="${p.qty}"></label>`;
    if (sized) {
      const auto = sized.auto;
      const need = s.def.sized === 'battery' ? `${Math.round(sized.needAh)} Ah needed` : `${Math.round(sized.needW)} W needed`;
      qty = `<label class="qty" title="Sized for the power budget; type a number to override">× <input type="number" min="1" max="99" data-bind="size:${esc(s.def.sized)}" value="${d.sizes[s.def.sized] || auto}"> <span class="small dim">${need}${d.sizes[s.def.sized] ? ' · <button type="button" class="linklike" data-act="unsize" data-slot="' + esc(s.def.sized) + '">auto</button>' : ' · auto'}</span></label>`;
    }
    const others = s.cands.length > 1 && !s.def.multi;
    return `<div class="picked fit-${p.fit.level}">${cardCore(d, it, p.fit)}
      <div class="card-side">${priceHtml(it, d.role, d)}${qty}
        <div class="btns">${others && !S.open[`${d.id}:${s.def.id}`] ? `<button type="button" class="ghost" data-act="open-slot" data-slot="${esc(s.def.id)}">Change</button>` : ''}
        <button type="button" class="ghost" data-act="unpick" data-slot="${esc(s.def.id)}" data-id="${esc(it.id)}" aria-label="Remove ${esc(it.name)}">Remove</button></div></div></div>`;
  }
  function periphHtml(d, r) {
    if (!r.lines.length) return '';
    return `<section class="slot periph"><header class="slot-h"><h3>Supporting parts these picks need</h3></header>
      <p class="slot-help">Added because of what is picked above — the peripherals people forget until the day of the install. Swap any of them; drop the ones marked advised if you have them already.</p>
      <div class="table-wrap"><table class="tbl periph-tbl"><thead><tr><th scope="col">Part</th><th scope="col">Why</th><th scope="col" class="num">Qty</th><th scope="col">Choice</th><th scope="col" class="num">Each</th><th scope="col"><span class="sr-only">Actions</span></th></tr></thead>
      <tbody>${r.lines.map(ln => {
        const it = ln.pick ? E.item(ln.pick) : null;
        const opts = ln.options.map(id => E.item(id)).filter(Boolean);
        return `<tr class="${ln.pick ? '' : 'dropped'}"><th scope="row">${esc(ln.label)}${ln.need === 'advised' ? ' <span class="chip plain">advised</span>' : ''}</th>
          <td class="small">${esc(ln.why)}</td><td class="num">${ln.qty}${it && it.unit === 'm' ? ' m' : ''}</td>
          <td>${ln.pick ? `<select data-bind="per:${esc(ln.key)}" aria-label="${esc(ln.label)}">${opts.map(o => `<option value="${esc(o.id)}"${o.id === ln.pick ? ' selected' : ''}>${esc(o.name)}</option>`).join('')}</select> <button type="button" class="linklike" data-act="item" data-id="${esc(ln.pick)}">details</button>` : '<span class="dim">left out</span>'}</td>
          <td class="num">${it ? priceHtml(it, d.role, d) : ''}</td>
          <td>${ln.need === 'advised' ? (ln.pick ? `<button type="button" class="ghost small" data-act="per-drop" data-slot="${esc(ln.key)}">Leave out</button>` : `<button type="button" class="ghost small" data-act="per-restore" data-slot="${esc(ln.key)}">Add back</button>`) : ''}</td></tr>`;
      }).join('')}</tbody></table></div></section>`;
  }

  // ── step 4: result ──

  function resultHtml(d, r) {
    const failing = r.checks.filter(x => x.res.state === 'fail'), warning = r.checks.filter(x => x.res.state === 'warn');
    const verdict = r.empty.length || failing.length
      ? `<div class="verdict bad"><b>Not there yet.</b> ${r.empty.length ? `Still to choose: ${r.empty.map(x => esc(lc(x.def.label))).join(', ')}. ` : ''}${failing.length ? `${plural(failing.length, 'requirement')} not met: ${failing.map(x => esc(x.req.text)).join('; ')}.` : ''}</div>`
      : warning.length ? `<div class="verdict warn"><b>Meets every must.</b> ${plural(warning.length, 'thing')} to note: ${warning.map(x => esc(lc(x.req.text))).join('; ')}.</div>`
        : '<div class="verdict ok"><b>Meets every requirement.</b></div>';
    const areas = [...new Set(r.consequences.map(x => x.area))];
    return `${verdict}
      <h3>Bill of materials — one site</h3>
      ${bomHtml(d, r)}
      <h3>Power</h3>${powerHtml(d, r)}
      <h3>What these choices mean</h3>
      <div class="conseq">${areas.map(a => `<div class="cq"><h4>${esc(a)}</h4><ul>${r.consequences.filter(x => x.area === a).map(x => `<li class="cq-${x.level}"><span class="cq-i" aria-hidden="true">${{ good: '✓', info: 'i', warn: '!', bad: '✕' }[x.level]}</span><span>${esc(x.text)}${x.link ? ` <a href="${esc(x.link)}" target="_blank" rel="noopener">more</a>` : ''}</span></li>`).join('')}</ul></div>`).join('')}</div>
      <div class="actions export">
        <button type="button" data-act="csv" data-scope="design">Download the bill (CSV)</button>
        <button type="button" class="ghost" data-act="print">Print</button>
        <button type="button" class="ghost" data-act="share">Copy a share link</button>
      </div>`;
  }
  function bomHtml(d, r) {
    const c = r.cost, s = S.settings;
    const slotRows = c.rows.filter(x => x.kind === 'slot'), perRows = c.rows.filter(x => x.kind !== 'slot');
    const row = x => {
      const it = E.item(x.id);
      const over = d.prices && d.prices[x.id] != null;
      const unit = over ? overrideShown(d.prices[x.id]) : x.unit;
      const total = unit == null ? null : unit * x.qty;
      return `<tr${unit == null ? ' class="unpriced"' : ''}><th scope="row"><button type="button" class="linklike" data-act="item" data-id="${esc(x.id)}">${esc(x.name)}</button><span class="small dim"> ${esc(x.vendor || '')}</span></th>
        <td class="small">${esc(x.slot)}</td><td class="num">${x.qty}${it && it.unit === 'm' ? ' m' : ''}</td>
        <td class="num"><input class="price-in" type="number" min="0" step="1" inputmode="decimal" data-bind="price:${esc(x.id)}" value="${over ? Math.round(unit * 100) / 100 : ''}" placeholder="${unit == null ? 'quote' : esc(Math.round(unit * 100) / 100)}" aria-label="Your price for ${esc(x.name)}" title="Type your own quote to replace the catalogue price"></td>
        <td class="num">${total == null ? '<span class="dim">—</span>' : money(total)}</td>
        <td class="small dim">${over ? 'your quote' : esc(BASIS[x.basis] || '')}${x.yearly ? `<br>+ ${money(x.yearly)} a year` : ''}</td></tr>`;
    };
    const sum = rows => rows.reduce((a, x) => { const over = d.prices && d.prices[x.id] != null; const u = over ? overrideShown(d.prices[x.id]) : x.unit; return a + (u == null ? 0 : u * x.qty); }, 0);
    const hw = sum(c.rows);
    const tco = hw + c.labour + (c.yearly + c.visitsYear) * s.years + c.replaceTotal;
    return `<div class="table-wrap"><table class="tbl bom"><thead><tr><th scope="col">Part</th><th scope="col">For</th><th scope="col" class="num">Qty</th><th scope="col" class="num">Each ${s.gst ? 'inc' : 'ex'} GST</th><th scope="col" class="num">Total</th><th scope="col">Basis</th></tr></thead>
      <tbody>${slotRows.map(row).join('')}
        ${perRows.length ? `<tr class="sub"><th colspan="6" scope="rowgroup">Supporting parts</th></tr>${perRows.map(row).join('')}` : ''}</tbody>
      <tfoot>
        <tr><th scope="row" colspan="4">Hardware${c.unknown ? ` <span class="small dim">(+ ${plural(c.unknown, 'part')} priced on request)</span>` : ''}</th><td class="num"><b>${money(hw)}</b></td><td></td></tr>
        ${s.labour ? `<tr><th scope="row" colspan="4">Installation <span class="small dim">(${esc(c.effort.notes.join('; '))})</span></th><td class="num">${money(c.labour)}</td><td></td></tr>` : ''}
        <tr><th scope="row" colspan="4">Each year <span class="small dim">(plans, licences${s.labour && c.visitsYear ? ', a site visit' : ''})</span></th><td class="num">${money(c.yearly + c.visitsYear)}</td><td></td></tr>
        ${c.replace.length ? `<tr><th scope="row" colspan="4">Replacements over ${s.years} years <span class="small dim">(${esc(c.replace.map(x => `${x.name} ×${x.n}`).join(', '))})</span></th><td class="num">${money(c.replaceTotal)}</td><td></td></tr>` : ''}
        <tr class="grand"><th scope="row" colspan="4">${s.years} years, one site</th><td class="num"><b>${money(tco)}</b></td><td></td></tr>
        ${c.oneOff ? `<tr><th scope="row" colspan="4">One-off development <span class="small dim">(once for the design, not per site)</span></th><td class="num">${money(c.oneOff)}</td><td></td></tr>` : ''}
      </tfoot></table></div>
      ${c.unknown ? '<p class="small dim">Most ALERT equipment is sold by quote. Type your quote into the “Each” column and every total, here and on the Network tab, follows. For scale: US agencies have reported about US$4,000 a site in hardware for an ALERT2 upgrade (Riverside County, 2022), and Flood-Net\'s ALERT2 plan uses A$6,500 for an ELPRO ERT-A2.</p>' : ''}`;
  }
  function powerHtml(d, r) {
    const pb = r.power;
    const rows = pb.rows.filter(x => x.w > 0).sort((a, b) => b.w - a.w);
    const sizing = [];
    if (pb.battery) sizing.push(`<li class="${pb.battery.short ? 'r-fail' : 'r-ok'}"><b>Battery:</b> ${Math.round(pb.battery.needAh)} Ah needed for ${pb.battery.days < 1 ? `${Math.round(pb.battery.days * 24)} hours` : plural(Math.round(pb.battery.days * 10) / 10, 'day')} at ${Math.round(pb.battery.dod * 100)}% usable — ${Math.round(pb.battery.ah)} Ah fitted (${pb.battery.qty} × ${Math.round(pb.battery.ah / pb.battery.qty)} Ah).</li>`);
    if (pb.solar) sizing.push(`<li class="${pb.solar.short ? 'r-fail' : 'r-ok'}"><b>Solar:</b> ${Math.round(pb.solar.needW)} W needed at ${d.f.psh} sun-hours and ${Math.round(pb.solar.eff * 100)}% system efficiency — ${Math.round(pb.solar.w)} W fitted (${pb.solar.qty} × ${Math.round(pb.solar.w / pb.solar.qty)} W).</li>`);
    if (pb.regulator) sizing.push(`<li class="${pb.regulator.short ? 'r-fail' : 'r-ok'}"><b>Charge controller:</b> ${pb.regulator.ratingW
      ? `${Math.round(pb.regulator.panelW)} W of panel into ${esc(pb.regulator.name)}'s built-in ${pb.regulator.ratingW} W MPPT regulator.`
      : `${pb.regulator.amps.toFixed(1)} A from the panel (with 25% margin) against its ${pb.regulator.rating} A rating.`}</li>`);
    if (pb.ups) sizing.push(`<li class="${pb.ups.short ? 'r-fail' : 'r-ok'}"><b>UPS:</b> about ${pb.ups.hours === Infinity ? '—' : pb.ups.hours.toFixed(1)} hours at ${E.fmtW(pb.w)} (${Math.round(pb.ups.wh)} Wh of battery at 80%) against ${d.f.upsHours} hours asked.</li>`);
    return `<div class="power">
      <div class="table-wrap"><table class="tbl"><thead><tr><th scope="col">Part</th><th scope="col" class="num">Average</th><th scope="col">How</th></tr></thead>
        <tbody>${rows.map(x => `<tr><th scope="row">${esc(x.name)}</th><td class="num">${E.fmtW(x.w)}</td><td class="small dim">${esc(x.note || '')}</td></tr>`).join('') || '<tr><td colspan="3" class="dim">Nothing that draws power is picked yet.</td></tr>'}</tbody>
        <tfoot><tr><th scope="row">Total</th><td class="num"><b>${E.fmtW(pb.w)}</b></td><td class="small">${Math.round(pb.whDay)} Wh a day</td></tr></tfoot></table></div>
      ${sizing.length ? `<ul class="sizing">${sizing.join('')}</ul>` : ''}</div>`;
  }

  // ── network view ───────────────────────────────────────────────────────────

  function renderNetwork() {
    const net = E.network(S.designs, S.settings);
    const t = net.totals, s = S.settings;
    const rows = net.evs.map(({ d, r }) => `<tr><td>${roleTag(d.role)}</td><th scope="row"><button type="button" class="linklike" data-act="select" data-id="${esc(d.id)}">${esc(d.name)}</button></th>
      <td class="num">${d.qty}</td><td class="num">${money(r.cost.hw)}${r.cost.unknown ? '+' : ''}</td>${s.labour ? `<td class="num">${money(r.cost.labour)}</td>` : ''}
      <td class="num">${money(r.cost.yearly + r.cost.visitsYear)}</td><td class="num"><b>${money((r.cost.hw + r.cost.labour) * d.qty)}</b></td>
      <td>${r.issues.fail ? `<span class="st st-fail">${r.issues.fail} to fix</span>` : r.issues.warn ? `<span class="st st-warn">${r.issues.warn} to note</span>` : '<span class="st st-ok">✓</span>'}</td></tr>`).join('');
    $('#view-network').innerHTML = `
      <div class="kpis wide">
        ${kpi('Sites', String(t.sites), `${plural(t.tx, 'transmitter')} to licence`)}
        ${kpi('Hardware', money(t.hw) + (t.unknown ? '+' : ''), t.unknown ? 'some parts priced on request' : 'every site')}
        ${s.labour ? kpi('Installation', money(t.labour), 'crews and travel') : ''}
        ${kpi('Each year', money(t.yearly), 'plans, licences, site visits')}
        ${kpi(`${s.years} years`, money(t.tco) + (t.unknown ? '+' : ''), 'whole of life, the network')}
        ${kpi('Power', E.fmtW(t.w), 'every site together')}
      </div>
      <h2>Does it join up?</h2>
      ${networkDiagram(net)}
      <ul class="netnotes">${net.notes.map(n => `<li class="cq-${n.level}"><span class="cq-i" aria-hidden="true">${{ good: '✓', info: 'i', warn: '!', bad: '✕' }[n.level]}</span><span>${esc(n.text)}</span></li>`).join('') || '<li class="cq-info"><span class="cq-i">i</span><span>Add sites to see how they connect.</span></li>'}</ul>
      <h2>Sites</h2>
      <div class="table-wrap"><table class="tbl"><thead><tr><th scope="col">Kind</th><th scope="col">Site</th><th scope="col" class="num">Qty</th><th scope="col" class="num">Hardware each</th>${s.labour ? '<th scope="col" class="num">Install each</th>' : ''}<th scope="col" class="num">Each year, each</th><th scope="col" class="num">Up front, all</th><th scope="col">Status</th></tr></thead>
        <tbody>${rows || `<tr><td colspan="8" class="dim">No sites yet.</td></tr>`}</tbody>
        <tfoot><tr><th scope="row" colspan="${s.labour ? 6 : 5}">Up front, the whole network</th><td class="num"><b>${money(t.hw + t.labour)}</b></td><td></td></tr>
        ${t.oneOff ? `<tr><th scope="row" colspan="${s.labour ? 6 : 5}">One-off development</th><td class="num">${money(t.oneOff)}</td><td></td></tr>` : ''}</tfoot></table></div>
      <h2>Settings</h2>
      <form class="settings" onsubmit="return false">
        <label class="check"><input type="checkbox" data-bind="s:gst" value="1"${s.gst ? ' checked' : ''}> Prices include GST</label>
        <label>Currency <select data-bind="s:currency"><option value="AUD"${s.currency === 'AUD' ? ' selected' : ''}>Australian dollars</option><option value="USD"${s.currency === 'USD' ? ' selected' : ''}>US dollars</option></select></label>
        <label>US$ per A$ <input type="number" step="0.01" min="0.3" max="1.5" data-bind="s:usdPerAud" value="${s.usdPerAud}"></label>
        <label>Years for whole-of-life <input type="number" step="1" min="1" max="40" data-bind="s:years" value="${s.years}"></label>
        <label class="check"><input type="checkbox" data-bind="s:labour" value="1"${s.labour ? ' checked' : ''}> Include installation labour and site visits</label>
        <label>A person-day, A$ ex GST <input type="number" step="10" min="0" data-bind="s:rate" value="${s.rate}"></label>
        <label>A crew-day of travel, A$ ex GST <input type="number" step="10" min="0" data-bind="s:travel" value="${s.travel}"></label>
      </form>
      <div class="actions export">
        <button type="button" data-act="csv" data-scope="network">Download the network's bill (CSV)</button>
        <button type="button" class="ghost" data-act="json">Save the network (JSON)</button>
        <label class="ghost button">Open a saved network <input type="file" accept="application/json,.json" data-bind="import" hidden></label>
        <button type="button" class="ghost" data-act="share">Copy a share link</button>
        <button type="button" class="ghost" data-act="print">Print</button>
        <button type="button" class="ghost danger" data-act="reset">Back to the example</button>
      </div>`;
  }
  // Columns for field, repeater, base, internet; a box per site design.
  function networkDiagram(net) {
    const cols = { field: [], repeater: [], base: [] };
    for (const { d } of net.evs) cols[d.role].push(d);
    const W = 760, colX = { field: 20, repeater: 220, base: 420 }, bw = 170, bh = 46, gap = 12;
    const rowsN = Math.max(1, ...Object.values(cols).map(c => c.length));
    const H = 40 + rowsN * (bh + gap);
    const proto = d => d.role === 'field' ? ({ a1: 'ALERT1', a2: 'ALERT2', both: 'ALERT1 / 2', ip: 'internet' }[d.f.proto])
      : d.role === 'repeater' ? ({ a1: 'ALERT1 → ALERT1', conc: 'ALERT1 → ALERT2', a2: 'ALERT2 → ALERT2', both: 'both' }[d.f.mode])
        : (d.f.rx || []).map(x => x === 'a1' ? 'ALERT1' : 'ALERT2').join(' + ');
    let out = '';
    for (const role of E.ROLE_LIST) {
      out += `<text class="d-col" x="${colX[role] + bw / 2}" y="22">${esc(E.ROLES[role].plural)}</text>`;
      cols[role].forEach((d, i) => {
        const y = 34 + i * (bh + gap);
        out += `<g class="d-node role-${role}"><rect x="${colX[role]}" y="${y}" width="${bw}" height="${bh}" rx="9"/><text x="${colX[role] + bw / 2}" y="${y + 19}">${esc(trim(d.name, 22))} ×${d.qty}</text><text class="d-sub" x="${colX[role] + bw / 2}" y="${y + 36}">${esc(proto(d) || '')}</text></g>`;
      });
    }
    out += `<g class="d-node d-cloud"><rect x="${W - 130}" y="34" width="120" height="${bh}" rx="23"/><text x="${W - 70}" y="${34 + 28}">Flood-Net</text></g>`;
    const arrow = (x1, x2, y, cls) => `<line class="d-arrow ${cls || ''}" x1="${x1}" y1="${y}" x2="${x2}" y2="${y}" marker-end="url(#narr)"/>`;
    const midY = 34 + bh / 2;
    if (cols.field.length && cols.repeater.length) out += arrow(colX.field + bw + 4, colX.repeater - 6, midY);
    if (cols.repeater.length && cols.base.length) out += arrow(colX.repeater + bw + 4, colX.base - 6, midY);
    if (cols.field.length && !cols.repeater.length && cols.base.length) out += arrow(colX.field + bw + 4, colX.base - 6, midY);
    if (cols.base.length) out += arrow(colX.base + bw + 4, W - 136, midY);
    if (cols.field.some(d => d.f.proto === 'ip')) out += `<path class="d-arrow dashed" d="M${colX.field + bw / 2} ${34 + rowsN * (bh + gap) - 6} C ${colX.field + bw / 2} ${H + 10}, ${W - 70} ${H + 10}, ${W - 70} ${34 + bh + 4}" marker-end="url(#narr)"/>`;
    return `<figure class="diagram net"><svg viewBox="0 0 ${W} ${H + 24}" role="img" aria-label="The network: field stations, repeaters and base stations, and what each sends">
      <defs><marker id="narr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="currentColor"/></marker></defs>${out}</svg></figure>`;
  }
  const trim = (s, n) => s.length > n ? s.slice(0, n - 1) + '…' : s;

  // ── catalogue view ─────────────────────────────────────────────────────────

  function renderCatalogue() {
    const c = S.cat;
    const all = E.catalog;
    const groups = [...new Set(all.map(it => E.catGroup(it.cat)))];
    const q = c.q.trim().toLowerCase();
    let list = all.filter(it => {
      if (c.group && E.catGroup(it.cat) !== c.group) return false;
      if (c.role && !(it.slots || []).some(s => s.startsWith(c.role + ':'))) return false;
      const cn = it.can || [];
      if (c.proto === 'a1' && !cn.some(t => /^a1-/.test(t))) return false;
      if (c.proto === 'a2' && !cn.some(t => /^a2-/.test(t))) return false;
      if (c.proto === 'both' && !(cn.some(t => /^a1-/.test(t)) && cn.some(t => /^a2-/.test(t)))) return false;
      if (c.open === 'sw' && !(it.open && it.open.sw === 'open')) return false;
      if (c.open === 'hw' && !(it.open && it.open.hw === 'open')) return false;
      if (c.open === 'closed' && !(it.open && it.open.sw === 'closed')) return false;
      if (c.grade && (it.grade || 0) < +c.grade) return false;
      if (c.status === 'buy' && ['planned', 'discontinued', 'existing'].includes(it.status)) return false;
      if (q && !`${it.name} ${it.vendor} ${it.blurb || ''} ${E.catLabel(it.cat)} ${(it.tags || []).join(' ')}`.toLowerCase().includes(q)) return false;
      return true;
    });
    const sorters = {
      group: (a, b) => groups.indexOf(E.catGroup(a.cat)) - groups.indexOf(E.catGroup(b.cat)) || E.catLabel(a.cat).localeCompare(E.catLabel(b.cat)) || a.name.localeCompare(b.name),
      price: (a, b) => E.price(a) - E.price(b),
      grade: (a, b) => (b.grade || 0) - (a.grade || 0) || E.price(a) - E.price(b),
      name: (a, b) => a.name.localeCompare(b.name),
    };
    list = list.slice().sort(sorters[c.sort] || sorters.group);
    const sel = (bind, opts, val) => `<select data-bind="cat:${bind}">${opts.map(([v, t]) => `<option value="${esc(v)}"${String(val) === String(v) ? ' selected' : ''}>${esc(t)}</option>`).join('')}</select>`;
    let lastGroup = null;
    const cards = list.map(it => {
      let head = '';
      if (c.sort === 'group' && E.catGroup(it.cat) !== lastGroup) { lastGroup = E.catGroup(it.cat); head = `<h3 class="cat-h">${esc(lastGroup)}</h3>`; }
      const where = (it.slots || []).map(s => s.split(':')).map(([r, sl]) => `${E.ROLES[r].short}: ${(E.slotDef(r, sl) || {}).label || sl}`).join(' · ');
      return `${head}<article class="ccard"><div class="cc-top"><span class="cc-cat">${esc(E.catLabel(it.cat))}</span>${priceHtml(it, (it.slots && it.slots[0] || 'field:').split(':')[0], null)}</div>
        <button type="button" class="iname" data-act="item" data-id="${esc(it.id)}">${esc(it.name)}</button><span class="vendor">${esc(it.vendor || '')}</span>
        <div class="chips">${protoChips(it)}${openChip(it)}${statusChip(it)}${tempChip(it)}${grade(it.grade)}</div>
        ${it.blurb ? `<p class="blurb">${esc(it.blurb)}</p>` : ''}
        ${where ? `<p class="small dim">Fits ${esc(where)}</p>` : '<p class="small dim">Reference only</p>'}
        <label class="check small"><input type="checkbox" data-bind="compare" value="${esc(it.id)}"${S.compare.includes(it.id) ? ' checked' : ''}> Compare</label></article>`;
    }).join('');
    $('#view-catalogue').innerHTML = `
      <p class="lead">${all.length} parts, from a $40 radio to a $7,500 ALERT2 repeater. Filter them, open any for its details and sources, or tick a few to compare.</p>
      <div class="filters">
        <label class="grow">Search <input type="search" data-bind="cat:q" value="${esc(c.q)}" placeholder="Raspberry Pi, radar, Tait, LiFePO4…"></label>
        <label>Family ${sel('group', [['', 'All'], ...groups.map(g => [g, g])], c.group)}</label>
        <label>Goes in ${sel('role', [['', 'Any site'], ['field', 'Field station'], ['repeater', 'Repeater'], ['base', 'Base station']], c.role)}</label>
        <label>Protocol ${sel('proto', [['', 'Any'], ['a1', 'ALERT1'], ['a2', 'ALERT2'], ['both', 'Both']], c.proto)}</label>
        <label>Openness ${sel('open', [['', 'Any'], ['sw', 'Open-source software'], ['hw', 'Open hardware'], ['closed', 'Closed']], c.open)}</label>
        <label>Grade ${sel('grade', [['0', 'Any'], ['2', '2 or better'], ['3', '3 or better'], ['4', '4 or better'], ['5', '5']], c.grade)}</label>
        <label>Status ${sel('status', [['', 'Everything'], ['buy', 'Buyable now']], c.status)}</label>
        <label>Sort ${sel('sort', [['group', 'By family'], ['price', 'Price'], ['grade', 'Grade'], ['name', 'Name']], c.sort)}</label>
      </div>
      <p class="small dim" aria-live="polite">${plural(list.length, 'part')} shown.${S.compare.length ? ` ${S.compare.length} ticked to compare — <button type="button" class="linklike" data-act="compare">compare them</button> · <button type="button" class="linklike" data-act="compare-clear">clear</button>` : ''}</p>
      <div class="cgrid">${cards || '<p class="dim">Nothing matches those filters.</p>'}</div>`;
  }

  // ── item details ───────────────────────────────────────────────────────────

  function itemHtml(it, ctx) {
    const p = it.price || {};
    const role = ctx && ctx.role || (it.slots && it.slots[0] || 'field:').split(':')[0];
    const pw = Object.assign({}, it.power || {});
    const specs = [];
    const add = (k, v) => { if (v != null && v !== '' && !(Array.isArray(v) && !v.length)) specs.push([k, v]); };
    add('Category', E.catLabel(it.cat));
    if (pw.w != null) add('Average draw', E.fmtW(pw.w));
    for (const r of E.ROLE_LIST) if (pw[r] && pw[r].w != null) add(`Average as a ${E.ROLES[r].label.toLowerCase()}`, E.fmtW(pw[r].w));
    if (pw.txW) add('Draw while transmitting', E.fmtW(pw.txW));
    if (pw.rxW) add('Draw while receiving', E.fmtW(pw.rxW));
    if (pw.supply) add('Supply', { '5V': '5 V (USB or header)', '12V': '12 V DC', wide: 'Wide-range DC', usb: 'USB bus power', mains: 'Mains', battery: 'Internal battery', none: 'None' }[pw.supply] || pw.supply);
    if (it.temp && it.temp[0] != null) add('Operating temperature', `${it.temp[0]} to ${it.temp[1]} °C`);
    add('Ingress', it.ip);
    add('Certifications', (it.certs || []).join(', '));
    if (it.acma != null) add('Australian land-mobile compliance', it.acma ? 'Yes' : 'No — bench or receive only');
    if (it.io) add('Interfaces', Object.entries(it.io).filter(([, v]) => v).map(([k, v]) => `${{ usb: 'USB host', usbDev: 'USB device', eth: 'Ethernet', rs232: 'RS-232', rs485: 'RS-485', pulse: 'pulse', sdi12: 'SDI-12', ai: 'analogue', ma420: '4–20 mA', gpio: 'GPIO', audio: 'audio', can: 'CAN', wifi: 'Wi-Fi', cell: 'cellular' }[k] || k}${v === true ? '' : ` × ${v}`}`).join(', '));
    if (it.hw) for (const [k, v] of Object.entries(it.hw)) if (HW_LABEL[k] && v != null && v !== '') add(HW_LABEL[k], fmtHw(k, v));
    add('Grade', it.grade != null ? `${it.grade} of 5${it.gradeWhy ? ` — ${it.gradeWhy}` : ''}` : null);
    add('Support', { vendor: 'Vendor support and warranty', community: 'Community (forums, GitHub)', limited: 'Limited vendor support', agency: 'Supplied by an agency', none: 'None' }[it.support]);
    add('Lifecycle', it.life);
    add('Confidence in this record', it.conf);
    const where = (it.slots || []).map(s => s.split(':')).map(([r, sl]) => `${E.ROLES[r].label}: ${lc((E.slotDef(r, sl) || {}).label || sl)}`);
    const priced = E.unitPrice(it, S.settings, role);
    return `<header class="dlg-h"><div><span class="cc-cat">${esc(E.catLabel(it.cat))}</span><h2 id="dlg-title">${esc(it.name)}</h2><span class="vendor">${esc(it.vendor || '')}</span></div>
        <button type="button" class="ghost" data-act="close" aria-label="Close">✕</button></header>
      <div class="chips">${protoChips(it)}${openChip(it)}${statusChip(it)}${tempChip(it)}${grade(it.grade)}</div>
      ${it.blurb ? `<p>${esc(it.blurb)}</p>` : ''}
      <div class="dlg-price">${priced == null ? '<b>Price on request</b>' : `<b>${priced === 0 ? 'Free' : money(priced)}${it.unit === 'm' ? ' a metre' : ''}</b> ${S.settings.gst ? 'inc' : 'ex'} GST`}
        ${p.basis ? `<span class="small dim"> · ${esc(BASIS[p.basis] || p.basis)}${p.src ? `, ${esc(p.src)}` : ''}${p.asof ? `, ${esc(p.asof)}` : ''}</span>` : ''}
        ${p.url ? ` <a class="small" href="${esc(p.url)}" target="_blank" rel="noopener">where</a>` : ''}
        ${it.priceBy ? `<span class="small dim"> · ${Object.entries(it.priceBy).map(([r, v]) => `as a ${E.ROLES[r].label.toLowerCase()}: ${money(E.unitPrice(it, S.settings, r))}`).join(', ')}</span>` : ''}
        ${it.yearly ? `<div class="small">Plus ${money(E.yearlyPrice(it, S.settings))} a year — ${esc(it.yearly.what || '')}</div>` : ''}</div>
      ${it.fw ? `<div class="fw"><b>Firmware / software:</b> ${esc(it.fw.name)}${it.fw.lic ? ` (${esc(it.fw.lic)})` : ''}. ${esc(it.fw.note || '')} ${it.fw.url ? `<a href="${esc(it.fw.url)}" target="_blank" rel="noopener">link</a>` : ''}</div>` : ''}
      <div class="dlg-cols">
        ${it.pros && it.pros.length ? `<div><h3>For</h3><ul class="pros">${it.pros.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>` : ''}
        ${it.cons && it.cons.length ? `<div><h3>Against</h3><ul class="cons">${it.cons.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>` : ''}
      </div>
      ${it.notes ? `<p class="small">${esc(it.notes)}</p>` : ''}
      <table class="tbl specs"><tbody>${specs.map(([k, v]) => `<tr><th scope="row">${esc(k)}</th><td>${esc(v)}</td></tr>`).join('')}</tbody></table>
      ${where.length ? `<p class="small"><b>Where it fits:</b> ${esc(where.join(' · '))}</p>` : ''}
      ${it.skills && it.skills.length ? `<p class="small"><b>Skills:</b> ${esc(it.skills.map(s => E.SKILLS[s]).join(', '))}</p>` : ''}
      ${it.src && it.src.length ? `<p class="small"><b>Sources:</b> ${it.src.map(([t, u]) => `<a href="${esc(u)}" target="_blank" rel="noopener">${esc(t)}</a>`).join(' · ')}</p>` : ''}
      ${ctx && ctx.slot ? `<div class="actions"><button type="button" data-act="pick" data-slot="${esc(ctx.slot)}" data-id="${esc(it.id)}" data-close="1">Choose for ${esc(lc((E.slotDef(ctx.role, ctx.slot) || {}).label || ''))}</button></div>` : ''}`;
  }
  const HW_LABEL = { os: 'Operating system', cpu: 'Processor', ram: 'Memory (GB)', sdrCh: 'ALERT1 SDR channels it can decode at once', rtc: 'Battery clock', wdog: 'Hardware watchdog', storage: 'Boots from', band: 'Band (MHz)', rfW: 'Transmit power (W)', dataPort: 'Data / accessory port', flat: 'Passes 4,800 bit/s (flat audio)', gainDbi: 'Gain (dBi)', loss10: 'Loss per 10 m at 150 MHz (dB)', tech: 'Technology', iface: 'Outputs', res: 'Resolution', range: 'Range', w: 'Watts', ah: 'Capacity (Ah)', chem: 'Chemistry', dod: 'Usable depth of discharge', a: 'Rating (A)', mppt: 'MPPT', ppm: 'Frequency error (ppm)', bwMHz: 'Bandwidth (MHz)', adc: 'ADC bits', material: 'Material', size: 'Size', wh: 'Battery (Wh)', watts: 'Rating (W)', kinds: 'For', cycles: 'Cycle life' };
  function fmtHw(k, v) {
    if (typeof v === 'boolean') return v ? 'Yes' : 'No';
    if (Array.isArray(v)) return k === 'band' ? `${v[0]}–${v[1]}` : v.map(x => ({ 'pi-os': 'Raspberry Pi OS', 'pi-os-cm': 'Raspberry Pi OS (Compute Module)', 'debian-arm64': 'Debian/Ubuntu (arm64)', 'debian-amd64': 'Debian/Ubuntu (x86-64)', 'debian-armhf': 'Debian (32-bit ARM)', windows: 'Windows', macos: 'macOS', 'linux-desktop': 'Linux desktop', chromeos: 'ChromeOS', crbasic: 'CRBasic', rtos: 'Firmware (no OS)', arduino: 'Arduino', micropython: 'MicroPython', 'vendor-linux': 'Vendor Linux', 'openwrt': 'OpenWrt (RutOS)', vendor: 'Vendor firmware', serial: 'serial', sdi12: 'SDI-12', ma420: '4–20 mA', rs485: 'RS-485', pulse: 'pulse', analog: 'analogue', rs232: 'RS-232' }[x] || x)).join(', ');
    if (k === 'dod') return `${Math.round(v * 100)}%`;
    if (k === 'chem') return { agm: 'Lead-acid (AGM)', gel: 'Lead-acid (gel)', lfp: 'Lithium iron phosphate', primary: 'Primary lithium (not rechargeable)' }[v] || v;
    if (k === 'storage') return { sd: 'microSD card', emmc: 'eMMC', ssd: 'SSD', nvme: 'NVMe SSD', flash: 'On-board flash' }[v] || v;
    return String(v);
  }
  function openItem(id, ctx) {
    const it = E.item(id);
    if (!it) return;
    $('#dlg-body').innerHTML = itemHtml(it, ctx);
    const dlg = $('#dlg');
    if (!dlg.open) { if (dlg.showModal) dlg.showModal(); else dlg.setAttribute('open', ''); }
  }
  function compareHtml() {
    const its = S.compare.map(E.item).filter(Boolean);
    const rows = [
      ['Family', it => E.catLabel(it.cat)], ['Vendor', it => it.vendor], ['Price', it => { const u = E.unitPrice(it, S.settings, (it.slots && it.slots[0] || 'field:').split(':')[0]); return u == null ? 'On request' : money(u); }],
      ['ALERT1', it => (it.can || []).filter(t => /^a1-/.test(t)).join(', ') || '—'], ['ALERT2', it => (it.can || []).filter(t => /^a2-/.test(t)).join(', ') || '—'],
      ['Open source', it => it.open ? `${it.open.sw || '—'}${it.open.hw === 'open' ? ', open hardware' : ''}` : '—'], ['Grade', it => it.grade != null ? `${it.grade} of 5` : '—'],
      ['Temperature', it => it.temp && it.temp[0] != null ? `${it.temp[0]} to ${it.temp[1]} °C` : '—'], ['Average draw', it => it.power && it.power.w != null ? E.fmtW(it.power.w) : '—'],
      ['Status', it => (STATUS[it.status] || ['Current'])[0]], ['Lifecycle', it => it.life || '—'], ['For', it => (it.pros || []).join('; ')], ['Against', it => (it.cons || []).join('; ')],
    ];
    return `<header class="dlg-h"><h2 id="dlg-title">Compare</h2><button type="button" class="ghost" data-act="close" aria-label="Close">✕</button></header>
      <div class="table-wrap"><table class="tbl compare"><thead><tr><th></th>${its.map(it => `<th scope="col">${esc(it.name)}</th>`).join('')}</tr></thead>
      <tbody>${rows.map(([k, f]) => `<tr><th scope="row">${esc(k)}</th>${its.map(it => `<td>${esc(f(it))}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  }

  // ── exports ────────────────────────────────────────────────────────────────

  function csvRows(designs) {
    const out = [['Site', 'Kind', 'Sites', 'Part', 'Vendor', 'For', 'Qty per site', `Each (${S.settings.currency}${S.settings.gst ? ' inc GST' : ' ex GST'})`, 'Per site', 'All sites', 'Price basis', 'Source']];
    for (const d of designs) {
      const r = E.evaluate(d, S.settings);
      for (const x of r.cost.rows) {
        const it = E.item(x.id);
        const over = d.prices && d.prices[x.id] != null;
        const u = over ? overrideShown(d.prices[x.id]) : x.unit;
        out.push([d.name, E.ROLES[d.role].label, d.qty, x.name, x.vendor || '', x.slot, x.qty, u == null ? '' : round2(u), u == null ? '' : round2(u * x.qty), u == null ? '' : round2(u * x.qty * d.qty), over ? 'your quote' : (BASIS[x.basis] || ''), (it && it.price && it.price.url) || '']);
      }
      if (S.settings.labour) out.push([d.name, E.ROLES[d.role].label, d.qty, 'Installation labour and travel', '', '', 1, round2(r.cost.labour), round2(r.cost.labour), round2(r.cost.labour * d.qty), 'estimate', '']);
    }
    return out;
  }
  const round2 = v => Math.round(v * 100) / 100;
  const csvCell = v => { const s = String(v == null ? '' : v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  function download(name, text, type) {
    const blob = new Blob([text], { type });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'site';

  // ── toast ──
  let toastTimer = null;
  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
  }
  let pendingToast = null;
  const toastLater = msg => { pendingToast = msg; };

  // ── events ─────────────────────────────────────────────────────────────────

  function pick(d, slot, id) {
    const sd = E.slotDef(d.role, slot);
    if (sd && sd.multi) {
      const list = d.picks[slot] || [];
      const ex = list.find(p => p.id === id);
      if (ex) ex.qty += 1; else list.push({ id, qty: 1 });
      d.picks[slot] = list;
    } else {
      d.picks[slot] = [{ id, qty: 1 }];
      delete S.open[`${d.id}:${slot}`];
    }
    if (sd && sd.sized) delete d.sizes[sd.sized];
  }
  document.addEventListener('click', ev => {
    const a = ev.target.closest('[data-act]');
    if (!a) {
      if (ev.target === $('#dlg')) $('#dlg').close();
      return;
    }
    const act = a.dataset.act, d = active();
    switch (act) {
      case 'view': S.view = a.dataset.view; history.replaceState(null, '', `#${S.view}`); window.scrollTo(0, 0); break;
      case 'select': S.active = a.dataset.id; S.view = 'configure'; break;
      case 'add': {
        const nd = E.newDesign(a.dataset.role, `New ${E.ROLES[a.dataset.role].label.toLowerCase()}`);
        S.designs.push(nd); S.active = nd.id; S.step = 'needs'; S.view = 'configure';
        break;
      }
      case 'step': S.step = a.dataset.step; window.scrollTo({ top: Math.min(window.scrollY, $('.editor') ? $('.editor').offsetTop - 10 : 0) }); break;
      case 'pick': if (d) { pick(d, a.dataset.slot, a.dataset.id); if (a.dataset.close) $('#dlg').close(); } break;
      case 'unpick': if (d) { d.picks[a.dataset.slot] = (d.picks[a.dataset.slot] || []).filter(p => p.id !== a.dataset.id); if (!d.picks[a.dataset.slot].length) delete d.picks[a.dataset.slot]; } break;
      case 'open-slot': if (d) S.open[`${d.id}:${a.dataset.slot}`] = true; break;
      case 'more': if (d) S.more[`${d.id}:${a.dataset.slot}`] = true; break;
      case 'unsize': if (d) delete d.sizes[a.dataset.slot]; break;
      case 'autopick': if (d) { E.autoPick(d, true); toast('Empty slots filled with the best fit'); } break;
      case 'repick': if (d) { d.picks = {}; d.per = {}; d.sizes = {}; E.autoPick(d, false); toast('Re-picked for these needs'); } break;
      case 'per-drop': if (d) d.per[a.dataset.slot] = null; break;
      case 'per-restore': if (d) delete d.per[a.dataset.slot]; break;
      case 'dup': if (d) { const c = JSON.parse(JSON.stringify(d)); c.id = E.newDesign(d.role).id; c.name = `${d.name} (copy)`; S.designs.splice(S.designs.indexOf(d) + 1, 0, c); S.active = c.id; } break;
      case 'del': if (d && confirm(`Remove “${d.name}” from the network?`)) { S.designs = S.designs.filter(x => x !== d); S.active = S.designs[0] && S.designs[0].id; } break;
      case 'item': openItem(a.dataset.id, d && S.view === 'configure' ? { role: d.role, slot: (a.closest('.slot') || {}).id ? a.closest('.slot').id.replace(/^slot-/, '') : null } : null); return;
      case 'close': $('#dlg').close(); return;
      case 'compare': $('#dlg-body').innerHTML = compareHtml(); $('#dlg').showModal(); return;
      case 'compare-clear': S.compare = []; break;
      case 'welcome-close': S.welcome = false; break;
      case 'start-empty': S.designs = []; S.active = null; S.welcome = false; break;
      case 'reset': if (confirm('Replace your network with the example?')) { S.designs = exampleNetwork(); S.active = S.designs[0] && S.designs[0].id; } break;
      case 'csv': {
        const ds = a.dataset.scope === 'network' ? S.designs : [d].filter(Boolean);
        download(`open-alert-${a.dataset.scope === 'network' ? 'network' : slug(d.name)}.csv`, csvRows(ds).map(r => r.map(csvCell).join(',')).join('\n'), 'text/csv');
        return;
      }
      case 'json': download('open-alert-network.json', JSON.stringify({ v: 1, designs: S.designs, settings: S.settings }, null, 2), 'application/json'); return;
      case 'share': {
        const url = `${location.origin}${location.pathname}#s=${encodeState(S)}`;
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(() => toast('Share link copied'), () => prompt('Copy this link:', url));
        else prompt('Copy this link:', url);
        return;
      }
      case 'print': window.print(); return;
      case 'theme': cycleTheme(); return;
      default: return;
    }
    render();
  });

  function onField(ev) {
    const el = ev.target;
    const b = el.dataset && el.dataset.bind;
    if (!b) return;
    const d = active();
    const [kind, key, sub] = b.split(':');
    const num = v => { const n = parseFloat(v); return isFinite(n) ? n : null; };
    switch (kind) {
      case 'name': if (d) d.name = el.value.slice(0, 80) || E.ROLES[d.role].label; break;
      case 'qty': if (d) { const n = num(el.value); if (n == null || n < 1) return; d.qty = Math.min(10000, Math.round(n)); } break;
      case 'preset': if (d && el.value) {
        const nd = fromPreset(el.value, { name: d.name, qty: d.qty });
        nd.id = d.id; nd.name = d.name === E.ROLES[d.role].label || /^New /.test(d.name) ? (P.designs.find(p => p.id === el.value) || {}).name || d.name : d.name;
        S.designs[S.designs.indexOf(d)] = nd; toast('Preset applied — change anything');
      } break;
      case 'example': if (el.value) { S.designs = exampleNetwork(el.value); S.active = S.designs[0] && S.designs[0].id; S.welcome = false; } break;
      case 'f': if (d) d.f[key] = el.value; break;
      case 'fm': if (d) { const set = new Set(d.f[key] || []); if (el.checked) set.add(el.value); else set.delete(el.value); d.f[key] = [...set]; } break;
      case 'fb': if (d) d.f[key] = el.checked; break;
      case 'fn': if (d) { const n = num(el.value); if (n == null) return; const ft = E.FEATURES.find(f => f.id === key); d.f[key] = Math.max(ft.min, Math.min(ft.max, n)); } break;
      case 'pq': if (d) { const p = (d.picks[key] || []).find(x => x.id === sub); const n = num(el.value); if (p && n != null && n >= 1) p.qty = Math.min(99, Math.round(n)); } break;
      case 'size': if (d) { const n = num(el.value); if (n != null && n >= 1) d.sizes[key] = Math.min(99, Math.round(n)); } break;
      case 'per': if (d) d.per[key] = el.value; break;
      case 'price': if (d) {
        d.prices = d.prices || {};
        const n = num(el.value);
        if (n == null || el.value === '') delete d.prices[key];
        else { let v = S.settings.currency === 'USD' ? n / S.settings.usdPerAud : n; d.prices[key] = S.settings.gst ? v : v * 1.1; }
      } break;
      case 'showUnfit': S.showUnfit = el.checked; break;
      case 's': {
        const s = S.settings;
        if (el.type === 'checkbox') s[key] = el.checked;
        else if (key === 'currency') s[key] = el.value;
        else { const n = num(el.value); if (n == null) return; s[key] = n; }
      } break;
      case 'cat': S.cat[key] = el.value; break;
      case 'compare': { const set = new Set(S.compare); if (el.checked) set.add(el.value); else set.delete(el.value); S.compare = [...set].slice(-4); } break;
      case 'import': {
        const file = el.files && el.files[0];
        if (!file) return;
        file.text().then(txt => {
          try {
            const st = JSON.parse(txt);
            if (!Array.isArray(st.designs)) throw new Error('no designs');
            S.designs = st.designs.filter(x => x && E.ROLES[x.role]).map(x => E.normalise(x));
            if (st.settings) S.settings = Object.assign({}, E.DEFAULT_SETTINGS, st.settings);
            S.active = S.designs[0] && S.designs[0].id;
            toast(`Opened ${plural(S.designs.length, 'site')}`);
            render();
          } catch (e) { toast('That file is not a saved open-ALERT network'); }
        });
        return;
      }
      default: return;
    }
    render();
  }
  document.addEventListener('change', ev => { const t = ev.target; if (t.type === 'number' || t.type === 'text' || t.type === 'search') return; onField(ev); });
  document.addEventListener('input', ev => { const t = ev.target; if (t.type === 'number' || t.type === 'text' || t.type === 'search') onField(ev); });
  // Tabs: arrow keys move between them, as a tab list should.
  document.addEventListener('keydown', ev => {
    const tab = ev.target.closest && ev.target.closest('[role="tab"]');
    if (!tab || !['ArrowLeft', 'ArrowRight'].includes(ev.key)) return;
    const list = [...tab.parentElement.querySelectorAll('[role="tab"]')];
    const i = list.indexOf(tab) + (ev.key === 'ArrowRight' ? 1 : -1);
    const next = list[(i + list.length) % list.length];
    next.focus(); next.click();
  });
  $('#dlg').addEventListener('close', () => { $('#dlg-body').innerHTML = ''; });

  // ── theme ──
  function applyTheme(t) {
    if (t === 'light' || t === 'dark') document.documentElement.dataset.theme = t; else delete document.documentElement.dataset.theme;
    $('#theme-label').textContent = { light: 'Light', dark: 'Dark' }[t] || 'Auto';
  }
  function cycleTheme() {
    let t = 'auto';
    try { t = localStorage.getItem(THEME_KEY) || 'auto'; } catch (e) { /* ignore */ }
    t = { auto: 'light', light: 'dark', dark: 'auto' }[t];
    try { localStorage.setItem(THEME_KEY, t); } catch (e) { /* ignore */ }
    applyTheme(t);
  }

  // ── start ──
  try { applyTheme(localStorage.getItem(THEME_KEY) || 'auto'); } catch (e) { applyTheme('auto'); }
  S = load();
  const fromHash = (location.hash || '').replace('#', '');
  if (['configure', 'network', 'catalogue', 'about'].includes(fromHash)) S.view = fromHash;
  render();
  if (pendingToast) toast(pendingToast);
  window.addEventListener('hashchange', () => {
    const h = (location.hash || '').replace('#', '');
    if (['configure', 'network', 'catalogue', 'about'].includes(h) && h !== S.view) { S.view = h; render(); }
  });
  window.OAUI = { get state() { return S; }, render };
})();
