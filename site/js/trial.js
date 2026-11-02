// open-ALERT — the Mallow trial: a Toradex Verdin AM62 on a Mallow carrier,
// running RPi ALERT beside a Raspberry Pi 4 that already does the job, on the
// same antenna. The page's shopping list, CPU estimate and results sheet.
//
// TRIAL.items is the shopping list: prices in Australian dollars (gst: false =
// ex GST), lead times in days, a source for every figure or conf 'low'.

(function () {
  'use strict';
  const isNode = typeof module === 'object' && module.exports;
  const USD = 0.69;                                   // the configurator's planning rate
  const aud = usd => Math.round(usd / USD * 100) / 100;
  const TDX = ['Toradex webshop', 'https://www.toradex.com/computer-on-modules/verdin-arm-family/ti-am62'];
  const E14 = ['element14 Australia', 'https://au.element14.com/'];
  const JAYCAR = ['Jaycar', 'https://www.jaycar.com.au/'];
  const CORE = ['Core Electronics', 'https://core-electronics.com.au/'];
  const ROJONE = ['Rojone', 'https://www.rojone.com.au/'];

  const TRIAL = {
    asof: '2026-11',
    items: [
      { id: 'verdin', need: 'must', name: 'Verdin AM62 Quad 2GB WB IT — Toradex 00761200', qty: 1,
        aud: [aud(107.40), aud(309.63)], gst: false, lead: { d: [7, 91], text: 'Toradex ships samples by express courier within 4 working days (about 1–2 weeks to Australia, an estimate); distributors\' factory lead time is 12–13 weeks' },
        where: [TDX, ['Future Electronics', 'https://www.futureelectronics.com/p/7205766'], E14], why: 'The computer under test, and the only AM62 with the CPU to run today\'s decoder on four channels (see Which module, above). The low price is Toradex\'s own sample price — Toradex sells to businesses only, so order through the Bureau; the high is a distributor\'s, about three times as much for the same part. The cheaper Dual 1GB IT is 00741201.',
        src: [['Toradex: Verdin AM62 prices', 'https://www.toradex.com/computer-on-modules/verdin-arm-family/ti-am62'], ['Toradex: how to order', 'https://toradex.com/order-now/how-to-order'], ['Future Electronics: 00761200', 'https://www.futureelectronics.com/p/7205766']], conf: 'medium' },
      { id: 'mallow', need: 'must', name: 'Mallow carrier board — Toradex 01611102 (element14 order code 4759350)', qty: 1,
        aud: [aud(107.50), 165.74], gst: false, lead: { d: [5, 91], text: '3–5 business days from element14\'s UK stock, or with the module from Toradex; 13 weeks from the factory' },
        where: [TDX, E14], why: 'Ethernet, two USB 3 ports for the sticks, 7–24 V in, an M.2 B-key slot with USB for a future SDR card. Its design files are published. The same price from Toradex or element14 — element14 is the way if Toradex won\'t sell to you.',
        src: [['Toradex: Mallow (US$107.50 samples)', 'https://www.toradex.com/products/carrier-board/mallow-carrier-board'], ['element14: Mallow', 'https://au.element14.com/toradex/01611102/carrier-board-mallow/dp/4759350'], ['Mallow datasheet', 'https://docs.toradex.com/116791-mallow_carrier_board_datasheet.pdf']], conf: 'high' },
      { id: 'heatsink', need: 'must', name: 'Verdin Industrial Heatsink Type 1 — Toradex 23111001', qty: 1,
        aud: [aud(15.60), 35], gst: false, lead: { d: [7, 21], text: 'with the module from Toradex, or Mouser / DigiKey' },
        where: [TDX, ['Mouser Australia', 'https://au.mouser.com/']], why: 'Decoding keeps every core busy: without a heatsink the module throttles and the trial measures heat, not the processor.',
        src: [['Toradex: Verdin Industrial Heatsink', 'https://www.toradex.com/accessories/verdin-industrial-heatsink-type-1']], conf: 'medium' },
      { id: 'psu', need: 'must', name: '12 V 2 A supply with a screw-terminal lead (and Mallow\'s Phoenix power plug if it isn\'t in the box)', qty: 1,
        aud: [25, 45], gst: true, lead: { d: [1, 7], text: 'any electronics shop; the Phoenix 1805410 plug from element14' },
        where: [JAYCAR, E14], why: 'Mallow takes 7–24 V on a Phoenix Contact header (its mate is the 1805410). A 12 V plug-pack with a screw-terminal adapter, or the site\'s own 12 V.',
        src: [['Mallow datasheet (power input)', 'https://docs.toradex.com/116791-mallow_carrier_board_datasheet.pdf']], conf: 'low' },
      { id: 'stick', need: 'must', name: 'RTL-SDR Blog V4 — the same model as the Pi\'s', qty: 1,
        aud: [60, 165], gst: true, lead: { d: [2, 21], text: 'kits stocked in Australia; the dongle alone from the RTL-SDR Blog store in 1–3 weeks' },
        where: [CORE, ['RTL-SDR Blog store', 'https://www.rtl-sdr.com/buy-rtl-sdr-dvb-t-dongles/']], why: 'The same model as the Pi\'s stick, so the computers are compared and not the sticks. Sticks still differ one from another — the plan swaps them halfway.',
        src: [['RPi ALERT hardware notes', 'https://github.com/cdomotor-g/RPi_ALERT/blob/main/docs/hardware.md']], conf: 'medium' },
      { id: 'splitter', need: 'must', name: 'VHF 2-way power divider (N-type)', qty: 1,
        aud: [80, 180], gst: true, lead: { d: [5, 21], text: 'RF suppliers' },
        where: [ROJONE], why: 'One antenna feeding both boxes, so both hear exactly the same bursts. Costs each side about 3.5 dB — record the Pi\'s figures before you fit it.',
        src: [], conf: 'low' },
      { id: 'leads', need: 'must', name: 'RF leads: an SMA-to-N pigtail for the new stick, and a short N–N jumper to the splitter', qty: 1,
        aud: [30, 60], gst: true, lead: { d: [2, 10], text: 'RF suppliers, Jaycar' },
        where: [ROJONE, JAYCAR], why: 'The Pi\'s stick keeps its own pigtail; the new stick needs one, and the splitter needs feeding from the antenna lead.',
        src: [], conf: 'low' },
      { id: 'eth', need: 'must', name: 'Ethernet patch lead and a spare switch or router port', qty: 1,
        aud: [5, 15], gst: true, lead: { d: [1, 5], text: 'any electronics shop' }, where: [JAYCAR], why: 'Use Ethernet, as the Pi does, so the network isn\'t a difference.', src: [], conf: 'low' },
      { id: 'usbc', need: 'maybe', name: 'USB-C data cable', qty: 1,
        aud: [10, 20], gst: true, lead: { d: [1, 5], text: 'any electronics shop' }, where: [JAYCAR],
        why: 'Only if the module has lost its Toradex Easy Installer and must be loaded again in recovery mode from a computer.', src: [], conf: 'low' },
      { id: 'console', need: 'maybe', name: '3.3 V USB-serial console cable (FTDI TTL-232R-3V3 class)', qty: 1,
        aud: [25, 45], gst: true, lead: { d: [3, 7], text: 'element14, Core Electronics' }, where: [E14, CORE],
        why: 'Plugs into Mallow\'s 6-pin console header — the way in when it won\'t boot or the network won\'t come up. Check the pin-out against the datasheet first.',
        src: [['Mallow datasheet', 'https://docs.toradex.com/116791-mallow_carrier_board_datasheet.pdf']], conf: 'low' },
      { id: 'meters', need: 'nice', name: 'Power meters: an in-line 12 V DC meter for the Mallow, a USB-C meter for the Pi', qty: 1,
        aud: [30, 70], gst: true, lead: { d: [1, 7], text: 'Jaycar, Core Electronics' }, where: [JAYCAR, CORE],
        why: 'Watts matter on a solar site: the AM62 should draw well under the Pi 4\'s 4–7 W.', src: [], conf: 'low' },
    ],
    // Every Verdin AM62 Toradex lists (its datasheet and price list,
    // 2026-11): what each could carry. `a53` is cores × GHz ÷ 1.4 — the CPU in
    // A53-at-1.4-GHz cores; a Pi 4 core is about two of those (the Pi 3B+, the
    // same four A53s at 1.4 GHz, is "half a Pi 4" in RPi ALERT's notes).
    variants: [
      { pid: '00761200', name: 'Quad 2GB WB IT', cores: 4, ghz: 1.4, ram: '2 GB', emmc: '16 GB', wifi: true, temp: '−40 to +85 °C', usd: 107.40, pick: 'buy',
        why: 'The only AM62 with the CPU for today\'s decoder on four channels. The one to trial.' },
      { pid: '00741201', name: 'Dual 1GB IT', cores: 2, ghz: 1.4, ram: '1 GB', emmc: '8 GB', wifi: false, temp: '−40 to +85 °C', usd: 81.85, pick: 'later',
        why: 'The cheaper production choice once the decoder is lighter: half the Quad, US$25.55 less.' },
      { pid: '00751201', name: 'Dual 1GB WB IT', cores: 2, ghz: 1.4, ram: '1 GB', emmc: '8 GB', wifi: true, temp: '−40 to +85 °C', usd: 94.10, pick: 'later',
        why: 'As 00741201 with Wi-Fi — only if a site has no Ethernet.' },
      { pid: '00731200', name: 'Dual 1GB ET', cores: 2, ghz: 1.4, ram: '1 GB', emmc: '4 GB', wifi: false, temp: '−20 to +85 °C', usd: 67.20, pick: 'maybe',
        why: 'Cheapest two-core; −20 °C is fine for Queensland. 4 GB of eMMC is tight for Torizon, the container and a 1 GB reading queue: shrink the queue.' },
      { pid: '00721201', name: 'Solo 512MB WB IT', cores: 1, ghz: 1.0, ram: '512 MB', emmc: '4 GB', wifi: true, temp: '−40 to +85 °C', usd: 75.00, pick: 'out',
        why: 'One core at 1.0 GHz: under even the lightest decoder\'s needs for four channels, and 512 MB.' },
      { pid: '00711200', name: 'Solo 512MB', cores: 1, ghz: 1.0, ram: '512 MB', emmc: '4 GB', wifi: false, temp: '0 to +70 °C', usd: 54.95, pick: 'out',
        why: 'As above, and only 0–70 °C.' },
    ],

    // What to compare, where to read it, and how it passes.
    measures: [
      { id: 'decoded', name: 'Bursts decoded (a week)', where: 'Each box\'s Overview (each channel\'s count), or Flood-Net\'s Reception Map filtered to the receiver', rule: 'ratio', min: 0.98, unit: '' },
      { id: 'undecoded', name: 'Bursts heard but not decoded (a week)', where: 'Each box\'s Overview', rule: 'info', unit: '' },
      { id: 'snr', name: 'Median SNR on a station both hear (dB)', where: 'Each box\'s Receivers page, or the Reception Map', rule: 'close', tol: 2, unit: 'dB' },
      { id: 'busy', name: 'Decoder busy, worst hour (%)', where: 'Each box\'s Overview: Decoder busy', rule: 'max', max: 70, unit: '%' },
      { id: 'dropped', name: 'Times a channel dropped samples', where: 'Each box\'s Overview and log', rule: 'max', max: 0, unit: '' },
      { id: 'temp', name: 'Hottest the processor got (°C)', where: 'The top of each box\'s Overview', rule: 'max', max: 70, unit: '°C' },
      { id: 'watts', name: 'Power draw, typical (W)', where: 'The power meters', rule: 'info', unit: 'W' },
      { id: 'gaps', name: 'Check-in gaps or restarts', where: 'Flood-Net\'s Base Stations tab: the connection log', rule: 'max', max: 0, unit: '' },
    ],
  };

  // A measure's verdict from the four numbers (Pi and AM62, week 1 and week 2,
  // the sticks swapped between weeks). → { cls, text } or null.
  function verdict(m, v) {
    const n = x => (x === '' || x == null || isNaN(Number(x))) ? null : Number(x);
    const pi = [n(v.pi1), n(v.pi2)], am = [n(v.am1), n(v.am2)];
    const has = a => a.some(x => x != null);
    if (!has(am)) return null;
    const sum = a => a.reduce((s, x) => s + (x || 0), 0);
    const worst = a => Math.max(...a.filter(x => x != null));
    if (m.rule === 'ratio') {
      if (!has(pi) || !sum(pi)) return null;
      const r = sum(am) / sum(pi);
      return r >= m.min ? { cls: 'ok', text: `${Math.round(r * 1000) / 10}% of the Pi's — passes` } : { cls: 'bad', text: `${Math.round(r * 1000) / 10}% of the Pi's — under ${m.min * 100}%` };
    }
    if (m.rule === 'close') {
      if (!has(pi)) return null;
      const d = sum(am.filter(x => x != null)) / am.filter(x => x != null).length - sum(pi.filter(x => x != null)) / pi.filter(x => x != null).length;
      return Math.abs(d) <= m.tol ? { cls: 'ok', text: `within ${Math.abs(Math.round(d * 10) / 10)} dB — the same` } : { cls: 'warn', text: `${Math.round(d * 10) / 10} dB — check the sticks and the splitter` };
    }
    if (m.rule === 'max') {
      const w = worst(am);
      return w <= m.max ? { cls: 'ok', text: `worst ${w}${m.unit} — passes` } : { cls: 'bad', text: `worst ${w}${m.unit} — over ${m.max}${m.unit}` };
    }
    if (m.rule === 'info' && has(pi)) {
      const r = sum(am) / (sum(pi) || 1);
      return { cls: 'info', text: `${Math.round(r * 100)}% of the Pi's` };
    }
    return null;
  }

  const API = { TRIAL, verdict, aud };
  if (isNode) { module.exports = API; return; }

  // ══ the page ══════════════════════════════════════════════════════════════
  const $ = (s, el) => (el || document).querySelector(s);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const inc = (v, gst) => gst === false ? v * 1.1 : v;
  const money = v => 'A$' + Math.round(v).toLocaleString('en-AU');
  const range = (lo, hi) => Math.round(lo) === Math.round(hi) ? money(lo) : `${money(lo)}–${Math.round(hi).toLocaleString('en-AU')}`;
  const wk = n => { const w = Math.round(n / 7); return w === 1 ? '1 week' : `${w} weeks`; };
  const days = d => d[1] <= 7 ? `${d[0]}–${d[1]} days` : d[0] >= 14 ? `${Math.round(d[0] / 7)}–${wk(d[1])}` : `${d[0]} days–${wk(d[1])}`;
  const KEY = 'open-alert:trial';
  let T = { got: {}, res: {}, channels: '151.5, 151.525, 151.95, 152.4', traffic: 'busy' };
  try { T = Object.assign(T, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) { /* private mode */ }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(T)); } catch (e) { /* private mode */ } };

  function shopping() {
    const groups = [['must', 'You need'], ['maybe', 'Only if something goes wrong'], ['nice', 'Nice to have']];
    let lo = 0, hi = 0, loAll = 0, hiAll = 0, longest = null;
    for (const it of TRIAL.items) {
      const a = inc(it.aud[0], it.gst) * it.qty, b = inc(it.aud[1], it.gst) * it.qty;
      loAll += a; hiAll += b;
      if (it.need === 'must') { lo += a; hi += b; if (!longest || it.lead.d[1] > longest.lead.d[1]) longest = it; }
    }
    const cl = $('#cost-line');
    if (cl) cl.innerHTML = `About <b>${range(lo, hi)}</b> inc GST for what you need, ${range(loAll, hiAll)} with the extras. The longest wait is the Toradex parts. The list below has each part, where to get it and how long it takes.`;
    $('#shop').innerHTML = groups.map(([g, h]) => `<h3>${h}</h3><ul class="shop">${TRIAL.items.filter(i => i.need === g).map(it => `
      <li class="${T.got[it.id] ? 'got' : ''}"><label class="shop-chk"><input type="checkbox" data-got="${it.id}"${T.got[it.id] ? ' checked' : ''}> <span class="sr-only">Got it</span></label>
        <div class="shop-main"><b>${esc(it.name)}</b>${it.conf === 'low' ? ' <span class="chip st-warn" title="Price and lead time are estimates">est.</span>' : ''}
          <div class="small dim">${esc(it.why)}</div>
          <div class="shop-meta small"><span><b>${range(inc(it.aud[0], it.gst), inc(it.aud[1], it.gst))}</b> inc GST</span><span title="${esc(it.lead.text)}">⏱ ${esc(days(it.lead.d))}</span><span>${it.where.map(([n, u]) => `<a href="${esc(u)}" target="_blank" rel="noopener">${esc(n)}</a>`).join(' · ')}</span></div>
        </div></li>`).join('')}</ul>`).join('') +
      `<p class="note"><b>Total for what you need:</b> ${range(lo, hi)} inc GST (${range(loAll, hiAll)} with everything). The longest wait is the <b>${esc(longest.name.split(' — ')[0])}</b>. <b>Order the module from Toradex direct, through the Bureau:</b> Toradex sells only to businesses, and a distributor charges about three times its price for the same part.</p>`;
  }

  function estimate() {
    const K = globalThis.OA_BUILD_API;
    if (!K) return;
    const freqs = String(T.channels).split(/[ ,;]+/).map(Number).filter(f => f >= 136 && f <= 174);
    const plan = K.planSticks(freqs, 'auto');
    const rows = ['rpi-4-4gb', 'toradex-verdin-am62-mallow'].map(id => {
      const p = K.B.platforms.find(x => x.id === id);
      const cells = K.B.decoders.map(d => {
        const u = K.load(plan, { traffic: T.traffic, decoder: d.id }).total / K.capacity(p);
        const v = K.verdict(u);
        return `<td class="num"><span class="${v.cls}">${Math.round(u * 100)}%</span></td>`;
      }).join('');
      return `<tr><th scope="row">${esc(p.short)}</th>${cells}</tr>`;
    }).join('');
    const sticks = (plan.sticks || []).map((s, i) => `stick ${i + 1}: ${s.chans.join(', ')} MHz in ${s.window.khz >= 1000 ? s.window.khz / 1000 + ' MHz' : s.window.khz + ' kHz'}`).join('; ');
    $('#est').innerHTML = `<div class="row">
        <label>Channels (MHz, as on the Pi) <input id="t-ch" value="${esc(T.channels)}" inputmode="decimal"></label>
        <label>Traffic <select id="t-tr"><option value="quiet"${T.traffic === 'quiet' ? ' selected' : ''}>Quiet</option><option value="busy"${T.traffic === 'busy' ? ' selected' : ''}>Busy</option><option value="heavy"${T.traffic === 'heavy' ? ' selected' : ''}>Heavy — hears a whole region</option></select></label></div>
      <p class="small dim">${esc(plan.error || sticks || 'Type the Pi\'s channels.')}</p>
      <div class="table-wrap"><table class="tbl"><thead><tr><th></th>${K.B.decoders.map(d => `<th class="num">${esc(d.short)}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table></div>
      <p class="small dim">Share of each computer's CPU, from the builder's model (RPi ALERT's measurements on a Pi 4; the AM62 at about half a Pi 4). Green is comfortable; amber is the edge; red drops bursts. The last two columns are planned work, not built. The trial is what replaces these guesses with numbers.</p>`;
  }

  // Every AM62 variant: what Flood-Net's four channels on a busy day, and the
  // Pi's channels on a heavy one, would ask of it — today and once lighter.
  function variants() {
    const K = globalThis.OA_BUILD_API, el = $('#variants');
    if (!K || !el) return;
    const four = K.planSticks([151.5, 151.525, 151.95, 152.4], 'auto');
    const freqs = String(T.channels).split(/[ ,;]+/).map(Number).filter(f => f >= 136 && f <= 174);
    const yours = K.planSticks(freqs, 'auto');
    const pct = (plan, traffic, dec, cap) => { const u = K.load(plan, { traffic, decoder: dec }).total / cap; const v = K.verdict(u); return `<span class="${v.cls}">${Math.round(u * 100)}%</span>`; };
    const PICK = { buy: ['ok', 'Trial this'], later: ['info', 'Later, lighter decoder'], maybe: ['warn', 'Possible, tight'], out: ['bad', 'Ruled out'] };
    el.innerHTML = `<div class="table-wrap"><table class="tbl var"><thead><tr><th>Toradex part</th><th>CPU</th><th>RAM · eMMC</th><th>Wi-Fi</th><th>Rated</th><th class="num">US$ (Toradex)</th><th class="num">4 ch, busy: today → lighter</th><th class="num">Your ${freqs.length} ch, ${esc(T.traffic)}: today → lighter</th><th>Verdict</th></tr></thead><tbody>${TRIAL.variants.map(v => {
      const cap = v.cores * (v.ghz / 1.4) / 2;      // in Pi 4 cores
      const p = PICK[v.pick];
      return `<tr class="pick-${v.pick}"><th scope="row"><b>${esc(v.pid)}</b><div class="small dim">${esc(v.name)}</div></th><td>${v.cores} × A53 ${v.ghz} GHz</td><td>${esc(v.ram)} · ${esc(v.emmc)}</td><td>${v.wifi ? 'yes' : '—'}</td><td>${esc(v.temp)}</td><td class="num">${v.usd.toFixed(2)}</td>
        <td class="num">${pct(four, 'busy', 'today', cap)} → ${pct(four, 'busy', 'lean', cap)}</td><td class="num">${yours.sticks && yours.sticks.length ? `${pct(yours, T.traffic, 'today', cap)} → ${pct(yours, T.traffic, 'lean', cap)}` : '—'}</td>
        <td><span class="chip st-${p[0] === 'ok' ? 'info' : p[0] === 'bad' ? 'bad' : p[0] === 'warn' ? 'warn' : 'info'}">${p[1]}</span><div class="small dim">${esc(v.why)}</div></td></tr>`;
    }).join('')}</tbody></table></div>`;
  }

  function results() {
    const v = T.res;
    const rows = TRIAL.measures.map(m => {
      const r = v[m.id] || {};
      const cell = k => `<td><input type="number" step="any" inputmode="decimal" data-res="${m.id}" data-k="${k}" value="${esc(r[k] == null ? '' : r[k])}" aria-label="${esc(m.name)}, ${{ pi1: 'Pi week 1', am1: 'AM62 week 1', pi2: 'Pi week 2', am2: 'AM62 week 2' }[k]}"></td>`;
      const ver = verdict(m, r);
      return `<tr><th scope="row">${esc(m.name)}<div class="small dim">${esc(m.where)}</div></th>${cell('pi1')}${cell('am1')}${cell('pi2')}${cell('am2')}<td class="small" data-ver="${m.id}">${ver ? `<span class="${ver.cls}">${esc(ver.text)}</span>` : '<span class="dim">—</span>'}</td></tr>`;
    }).join('');
    $('#results').innerHTML = `<div class="table-wrap"><table class="tbl res"><thead><tr><th>Measure</th><th>Pi · week 1</th><th>AM62 · week 1</th><th>Pi · week 2</th><th>AM62 · week 2</th><th>Verdict</th></tr></thead><tbody>${rows}</tbody></table></div>
      <div class="row"><button type="button" class="ghost small" data-act="copy">Copy the results</button><button type="button" class="ghost small" data-act="clear">Clear them</button><span class="small dim">Kept in this browser only.</span></div>`;
  }
  function verdictCell(id) {
    const m = TRIAL.measures.find(x => x.id === id), ver = verdict(m, T.res[id] || {});
    $(`[data-ver="${id}"]`).innerHTML = ver ? `<span class="${ver.cls}">${esc(ver.text)}</span>` : '<span class="dim">—</span>';
  }

  document.addEventListener('input', e => {
    const el = e.target;
    if (el.dataset.res) { (T.res[el.dataset.res] = T.res[el.dataset.res] || {})[el.dataset.k] = el.value; save(); verdictCell(el.dataset.res); }
  });
  document.addEventListener('change', e => {
    const el = e.target;
    if (el.dataset.got) { T.got[el.dataset.got] = el.checked; el.closest('li').classList.toggle('got', el.checked); save(); }
    if (el.id === 't-ch') { T.channels = el.value; save(); estimate(); variants(); }
    if (el.id === 't-tr') { T.traffic = el.value; save(); estimate(); variants(); }
  });
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    if (b.dataset.act === 'copy') {
      const lines = ['Measure\tPi wk1\tAM62 wk1\tPi wk2\tAM62 wk2\tVerdict', ...TRIAL.measures.map(m => { const r = T.res[m.id] || {}; const ver = verdict(m, r); return [m.name, r.pi1 || '', r.am1 || '', r.pi2 || '', r.am2 || '', ver ? ver.text : ''].join('\t'); })];
      const text = lines.join('\n');
      (navigator.clipboard ? navigator.clipboard.writeText(text) : Promise.reject()).then(() => toast('Results copied')).catch(() => toast('Couldn\'t copy here'));
    }
    if (b.dataset.act === 'clear') { T.res = {}; save(); results(); }
    if (b.dataset.act === 'theme') cycleTheme();
    if (b.dataset.act === 'copycode') {
      const code = document.getElementById(b.dataset.for).textContent;
      (navigator.clipboard ? navigator.clipboard.writeText(code) : Promise.reject()).then(() => toast('Copied')).catch(() => toast('Couldn\'t copy here'));
    }
  });
  function toast(t) { const el = $('#toast'); el.textContent = t; el.classList.add('show'); setTimeout(() => el.classList.remove('show'), 1800); }
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
  shopping(); estimate(); variants(); results();
})();
