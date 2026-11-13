// open-ALERT — the base-station builder.
//
// The first half is plain functions (also loaded by the tests under Node):
// how a set of channels splits across sticks, what that costs a computer's CPU
// — all of it together, and each channel on its one core — the bill of
// materials with price ranges and lead times, and the build steps.
// The second half draws the page (build.html) from them: the stick planner,
// the CPU gauge, the box drawn from what's in it, the bill, the lead-time
// chart and the instructions. State lives in localStorage and in share links.

(function () {
  'use strict';
  const isNode = typeof module === 'object' && module.exports;
  const B = isNode ? require('../data/builder.js') : globalThis.OA_BUILDER;
  let CAT = isNode ? [] : (globalThis.OA_CATALOG || []);
  const setCatalog = c => { CAT = c; };
  const item = id => CAT.find(x => x.id === id);

  // ── stick planning ────────────────────────────────────────────────────────
  // The narrowest window that holds a span of channels (MHz), or null.
  function windowFor(spanMhz) {
    const M = B.model;
    return M.windows.find(w => spanMhz <= Math.max(0, w.holds - M.margin) || (spanMhz === 0 && w.khz === M.windows[0].khz)) || null;
  }
  const groupCost = g => {
    const w = windowFor(g[g.length - 1] - g[0]);
    return w && g.length <= B.model.maxPerStick ? { w, cost: g.length * w.pi4 } : null;
  };
  // Split the channels into exactly k sticks, each a run of neighbouring
  // channels, so the work between bursts (channels × what one channel costs a
  // Pi 4 in that window) is least.
  // → [{ chans, window }] or null if they can't be split that way.
  function splitInto(freqs, k) {
    const f = [...new Set(freqs.map(Number))].filter(x => x > 0).sort((a, b) => a - b);
    const n = f.length;
    if (!n) return [];
    if (k > n) return null;
    const best = Array.from({ length: k + 1 }, () => new Array(n + 1).fill(null));
    best[0][0] = { cost: 0, cut: null };
    for (let s = 1; s <= k; s++) {
      for (let j = 1; j <= n; j++) {
        for (let i = s - 1; i < j; i++) {
          const prev = best[s - 1][i];
          if (!prev) continue;
          const g = groupCost(f.slice(i, j));
          if (!g) continue;
          const c = prev.cost + g.cost;
          if (!best[s][j] || c < best[s][j].cost - 1e-9) best[s][j] = { cost: c, cut: i };
        }
      }
    }
    if (!best[k][n]) return null;
    const out = [];
    for (let s = k, j = n; s > 0; s--) {
      const i = best[s][j].cut;
      const chans = f.slice(i, j);
      out.unshift({ chans, window: groupCost(chans).w });
      j = i;
    }
    return out;
  }
  // The plan for `sticks` ('auto' = the fewest that hold every channel).
  function planSticks(freqs, sticks) {
    const n = new Set(freqs.map(Number)).size;
    if (!n) return { sticks: [], k: 0, minK: 0 };
    let minK = 0;
    for (let k = 1; k <= Math.min(4, n); k++) if (splitInto(freqs, k)) { minK = k; break; }
    if (!minK) return { sticks: null, k: 0, minK: 0, error: 'These channels need more than four sticks.' };
    const k = sticks === 'auto' ? minK : Math.max(minK, Math.min(Number(sticks) || minK, n));
    return { sticks: splitInto(freqs, k), k, minK, capped: sticks !== 'auto' && Number(sticks) < minK };
  }

  // ── CPU ───────────────────────────────────────────────────────────────────
  // Everything is counted in Pi 4 cores (B.model, in data/builder.js, says
  // where each figure comes from). There are two limits, and both are needed:
  // the whole computer (all the channels together against what it has), and
  // one core (a channel is decoded on one core and can never use more).
  //
  // Legacy bursts a channel a minute, counting every burst heard — one that
  // decodes, one that doesn't, a repeater's copy. The Brisbane base, which
  // hears stations across the region, runs near 'heavy' and filled a Pi 4 at
  // eight channels.
  const TRAFFIC = { quiet: 2, busy: 8, heavy: 20 };
  // ALERT2 frames a minute on a channel that carries ALERT2: as heard today, a
  // storm after a changeover (half the slots used), every slot used.
  const A2_TRAFFIC = B.model.a2Frames;

  // Pi 4 cores the plan needs. o = { decoder, traffic, kiosk, a2, a2traffic, a2skip }:
  //   a2         how many of the channels carry ALERT2 (none unless told). They
  //              are counted on the channels in the widest windows first — the
  //              hardest case for one core.
  //   a2traffic  'today' | 'storm' | 'full' (A2_TRAFFIC).
  //   a2skip     true counts RPi ALERT's planned change: no legacy try on a
  //              channel that carries ALERT2 (not shipped).
  // Work that filters the window comes at both ends of B.model.loadFactor: the
  // …Low figures are the Pi 4's bench alone, the plain ones what a busy
  // computer showed (1.6 times). `total` is the figure to plan with: the high
  // end. `perChannel` is each channel's own need, which has to fit one core.
  function load(plan, o) {
    o = o || {};
    const M = B.model;
    const dec = B.decoders.find(d => d.id === (o.decoder || 'filter-once')) || B.decoders[1];
    const bpm = TRAFFIC[o.traffic] || TRAFFIC.busy;
    const fpm = A2_TRAFFIC[o.a2traffic] || A2_TRAFFIC.today;
    const fLo = M.loadFactor[0], fHi = M.loadFactor[1];
    const per = [];
    (plan.sticks || []).forEach((s, si) => s.chans.forEach(mhz => per.push({ mhz, stick: si + 1, khz: s.window.khz, window: s.window, a2: false })));
    const nA2 = Math.max(0, Math.min(per.length, Math.round(Number(o.a2) || 0)));
    per.map((c, i) => i).sort((x, y) => per[y].window.pi4 - per[x].window.pi4 || x - y).slice(0, nA2).forEach(i => { per[i].a2 = true; });
    const sum = { contLow: 0, cont: 0, legacyLow: 0, legacy: 0, a2Low: 0, a2: 0 };
    for (const c of per) {
      const filt = c.window.pi4 * dec.cont + M.chCore240 * (dec.contBase || 0);   // all the time, by the bench
      const each = c.a2 ? (o.a2skip ? M.a2DecodeS : dec.a2S) : dec.burstS;        // one burst's, or one frame's, decode
      const perS = (c.a2 ? fpm : bpm) / 60;
      // A channel that filters only around bursts is awake for `burstFilterS`
      // a burst — at most all the time, when it costs what filtering always does.
      const awake = Math.min(1, perS * (dec.burstFilterS || 0));
      const around = awake * Math.max(0, c.window.pi4 - filt);
      c.contLow = filt * fLo; c.cont = filt * fHi;
      c.burstLow = perS * each + around * fLo; c.burst = perS * each + around * fHi;
      c.needLow = c.contLow + c.burstLow; c.need = c.cont + c.burst;
      sum.contLow += c.contLow; sum.cont += c.cont;
      sum[c.a2 ? 'a2Low' : 'legacyLow'] += c.burstLow; sum[c.a2 ? 'a2' : 'legacy'] += c.burst;
    }
    const kiosk = o.kiosk ? M.kioskCore : 0;
    const burst = sum.legacy + sum.a2, burstLow = sum.legacyLow + sum.a2Low;
    const total = sum.cont + burst + kiosk, totalLow = sum.contLow + burstLow + kiosk;
    const worst = per.reduce((m, c) => (!m || c.need > m.need ? c : m), null);
    return { cont: sum.cont, contLow: sum.contLow, burst, burstLow, legacy: sum.legacy, legacyLow: sum.legacyLow, a2: sum.a2, a2Low: sum.a2Low, kiosk,
      total, totalLow, range: [totalLow, total], channels: per.length, a2Channels: nA2,
      memMb: per.length * M.mbPerChannel, memAllMb: per.length * M.mbPerChannel + M.mbAgent, perChannel: per, worst };
  }
  // What the platform has, in Pi 4 cores: the catalogue's `hw.sdrCh` ÷ 2 (a Pi 4 is 8, so 4).
  const capacity = p => { const it = item(p.ref); return it && it.hw && it.hw.sdrCh ? it.hw.sdrCh / 2 : 0; };
  // How many cores it has: `cores` on the platform entry, else `hw.cores` in the
  // catalogue, else read from the catalogue's `hw.cpu` text ("4× Cortex-A72",
  // "4× A76 + 4× A55", "quad-core", "6 cores"), else B.model.coresDefault.
  function cores(p) {
    const it = item(p.ref) || {}, hw = it.hw || {};
    const given = Number(p.cores) || Number(hw.cores);
    if (given > 0) return Math.round(given);
    const cpu = String(hw.cpu || '');
    let n = 0;
    cpu.replace(/(\d+)\s*(?:×|x(?=\s*[A-Za-z]))/g, (m, d) => { n += Number(d); return m; });
    if (!n) { const m = cpu.match(/\b(\d+)[ -]?cores?\b/i); if (m) n = Number(m[1]); }
    if (!n) { const m = cpu.match(/\b(single|dual|quad|hexa|six|octa|eight)[ -]?core/i); if (m) n = { single: 1, dual: 2, quad: 4, hexa: 6, six: 6, octa: 8, eight: 8 }[m[1].toLowerCase()]; }
    return n || B.model.coresDefault;
  }
  // One core's speed, in Pi 4 cores: the catalogue's own figure where the
  // review gives one apart from the whole (`hw.core`: the Verdin iMX95's
  // 0.75), else the whole computer divided by its cores.
  const oneCore = p => {
    const it = item(p.ref);
    if (it && it.hw && it.hw.core > 0) return it.hw.core;
    const n = cores(p);
    return n ? capacity(p) / n : 0;
  };

  // The verdict, and which limit bites. `use` is all the channels together as
  // a share of the whole computer; `chUse` (optional) the busiest channel as a
  // share of one core. → { cls, text, limit, whole, one }: `limit` is 'none',
  // 'total' (the whole computer), 'channel' (one core) or 'both'.
  function verdict(use, chUse) {
    const M = B.model, rank = { ok: 0, warn: 1, bad: 2 };
    const whole = use > 1 ? 'bad' : use > M.safe ? 'warn' : 'ok';
    const one = chUse == null ? 'ok' : chUse > 1 ? 'bad' : chUse > M.chSafe ? 'warn' : 'ok';
    const cls = rank[one] > rank[whole] ? one : whole;
    const limit = cls === 'ok' ? 'none' : rank[one] > rank[whole] ? 'channel' : rank[whole] > rank[one] ? 'total' : 'both';
    const wholeText = whole === 'bad' ? 'Overloaded — channels will drop samples and lose bursts' : 'At the edge — in a storm decoders fall behind and bursts are dropped';
    const oneText = one === 'bad' ? 'One channel needs more than one core can do — it falls behind and loses bursts, however idle the other cores are' : 'One channel takes most of one core — little room on it for a storm';
    const text = limit === 'none' ? (use <= 0.5 ? 'Plenty of headroom' : 'Comfortable')
      : limit === 'total' ? wholeText
      : limit === 'channel' ? oneText
      : whole === 'bad' ? 'Overloaded, and one channel needs more than one core can do — it will drop samples and lose bursts' : 'At the edge on both counts — the whole computer, and one channel on its one core';
    return { cls, text, limit, whole, one };
  }

  // Room for ALERT2: what one channel would need of one core if every time
  // slot on it were used (in the plan's widest window, on this decoder), and
  // whether the computer meets the buying rule (B.model.rule).
  // → { channel, need, needLow, share, shareLow, cls, cores, oneCore, rule, meetsRule }
  function headroom(plan, o, p) {
    o = o || {};
    const M = B.model, n = cores(p), one = oneCore(p);
    const L = load(plan, Object.assign({}, o, { a2: Math.max(1, Math.round(Number(o.a2) || 0)), a2traffic: 'full' }));
    const ch = L.perChannel.filter(c => c.a2).reduce((m, c) => (!m || c.need > m.need ? c : m), null);
    const share = ch && one ? ch.need / one : null, shareLow = ch && one ? ch.needLow / one : null;
    return { channel: ch, need: ch ? ch.need : 0, needLow: ch ? ch.needLow : 0, share, shareLow,
      cls: share == null ? 'ok' : share > 1 ? 'bad' : share > M.chSafe ? 'warn' : 'ok',
      cores: n, oneCore: one, rule: M.rule, meetsRule: n >= M.rule.cores && one >= M.rule.oneCore };
  }

  // Words that mean something particular on the builder page. Each gets its
  // meaning on hover where it is used (term(), below) and in the list a finger
  // can read under the CPU box (build.html, #cpu-terms).
  const TERMS = {
    pi4core: ['Pi 4 core', 'The work one of a Raspberry Pi 4\'s four processor cores can do. Every figure here is counted in these: a computer worth 12 Pi 4 cores does the decoding of three Raspberry Pi 4s.'],
    whole: ['the whole computer', 'All the channels together, and the screen if there is one, set against everything the computer has. Plan to use no more than 70% of it, so a storm has room.'],
    onecore: ['one core', 'Each channel is decoded on one processor core and cannot be spread over several. A channel that needs more work than one core can do falls behind and loses bursts, however many other cores sit idle. A computer\'s one-core speed here is its total divided by its number of cores (or the hardware review\'s own figure for a core, where it gives one); plan to use no more than 70% of a core.'],
    window: ['window', 'The slice of the radio band one stick hands to the computer, from 240 kHz to 2.4 MHz wide. Every channel on that stick works through the whole slice, so a wider window costs more.'],
    between: ['between bursts', 'The work a channel does all the time, even with nothing on the air: picking its own channel out of the stick\'s window. RPi ALERT\'s own Raspberry Pi 4 measured 0.06 of a core a channel in a 240 kHz window, 0.27 in 1.2 MHz and 0.31 in 1.44 MHz; the other windows are worked out in proportion.'],
    busy: ['busy computer', 'With every core working, RPi ALERT\'s own Raspberry Pi 4 gave each channel about 1.6 times the share of a core it had measured for one channel on its own. Nobody has measured that on another computer, so two figures are shown: the measurement alone, and 1.6 times it. The verdict uses the higher.'],
    burst: ['burst', 'One radio message in the older ALERT format, about a third of a second long. Decoding one takes about 0.37 seconds of a Pi 4 core on the default decoder, whether or not it turns out to hold a reading.'],
    frame: ['ALERT2 frame', 'One radio message in the newer ALERT2 format. Today RPi ALERT first tries each one as an older-format burst and only then reads it as ALERT2: about 0.6 seconds of a Pi 4 core in all. Reading it as ALERT2 straight away would take about 0.22; that change is planned in RPi ALERT and not yet released.'],
    slots: ['every slot used', 'ALERT2 gives each station its own time slot to send in. In the version RPi ALERT reads (1.1) a slot is at least half a second, so one channel carries at most 120 frames a minute. Real networks run far below that: the link heard in Brisbane sends about 20 a minute, and a 155-site network in the United States about 31. The newer version (1.2, January 2025) allows quarter-second slots, which RPi ALERT cannot yet read in full.'],
    decoder: ['decoder', 'The part of RPi ALERT that turns radio samples into readings. Full, Lean and Light are faster and faster ways to decode a burst; "around bursts" lets a channel rest while nothing is on the air, and is off by default because its first check in the field missed some weak bursts.'],
  };

  // The other words the builder and the trial use, with one home for their
  // meanings: the hardware review's list (site/data/review.js, `terms`), which
  // both pages load. WORDS is the ids each page's "What the words on this page
  // mean" list prints after its own; MARKS says which words in a text get the
  // meaning on hover (the first time each appears in it).
  const WORDS = ['base-station', 'floodnet', 'agent', 'alert', 'older-alert', 'channel', 'stick', 'stand-in', 'alert2-rule', 'tpm', 'secure-boot', 'uefi', 'coreboot', 'fanless', 'din', 'wide-temp',
    'hw-open', 'open-hw', 'oshwa', 'cern-ohl', 'kicad', 'module', 'emmc', 'usb', 'm2', 'arm', 'debian', 'lts', 'universe', 'torizon', 'kernel', 'package', 'container', 'image', 'signed', 'profile', 'dashboard',
    'proxy', 'iec62443', 'gst', 'quote', 'est', 'airlink', 'ppm', 'pigtail', 'rcm', 'cispr', 'smarc'];
  const MARKS = [
    [/\bTPM(?: 2\.0)?\b/, 'tpm'], [/\b(?:UEFI )?Secure Boot\b|\bsecure boot\b/, 'secure-boot'], [/\bcoreboot\b/, 'coreboot'], [/\bBIOS\b|\bUEFI\b/, 'uefi'],
    [/\bTorizon OS\b/, 'torizon'], [/\beMMC\b/, 'emmc'], [/\bOSHWA(?:-certified)?\b/, 'oshwa'], [/\bCERN-OHL-S\b/, 'cern-ohl'], [/\bKiCad\b/, 'kicad'],
    [/\bIEC 62443(?:-4-2)?(?: Security Level 2| SL2)?\b/, 'iec62443'], [/\bDIN[- ]rail\b/, 'din'], [/\bPCIe\b/, 'm2'], [/\bUbuntu 24\.04 LTS\b|\bLTS\b/, 'lts'],
    [/\bsigned(?:<\/i>)? release\b/, 'signed'], [/\b(?:enterprise|locked-down|standard) profile\b/, 'profile'], [/\bcontainer\b/, 'container'], [/\bx86\b/, 'arm'],
    [/\bkernel\b/, 'kernel'], [/\bolder[- ]ALERT\b/, 'older-alert'], [/\bfanless\b/i, 'fanless'], [/\bopen[- ]hardware\b/i, 'open-hw'], [/\bby quote\b|\bquote\b/i, 'quote'],
    [/\bpigtail\b/, 'pigtail'], [/\bppm\b/, 'ppm'], [/\bAirLink\b/, 'airlink'], [/\bRCM\b|\bRegulatory Compliance Mark\b/, 'rcm'], [/\bCISPR 32\b/, 'cispr'], [/\bSMARC\b/, 'smarc'], [/\bweb proxy\b/, 'proxy'],
    [/\bopen-alert-base\b(?! status| bench|_)|\bpackage\b/, 'package'],
  ];
  // Put a meaning on the first use of each such word in a piece of HTML, leaving
  // tags, code and links alone. `lookup(id)` gives { term, meaning } or nothing.
  function markTerms(html, lookup) {
    if (!lookup) return html;
    const seen = new Set();
    let skip = 0;
    return String(html).split(/(<[^>]+>)/).map(part => {
      if (part.startsWith('<')) {
        if (/^<(code|a|pre|span class="term")\b/i.test(part)) skip++;
        else if (/^<\/(code|a|pre|span)>/i.test(part) && skip) skip--;
        return part;
      }
      if (skip) return part;
      for (const [re, id] of MARKS) {
        if (seen.has(id)) continue;
        const t = lookup(id), m = t && part.match(re);
        if (!m) continue;
        const before = part.slice(0, m.index);
        if ((before.match(/\u0001/g) || []).length > (before.match(/\u0002/g) || []).length) continue;   // inside a word already marked
        seen.add(id);
        // \u0001 … \u0002 fence a word already marked, so a later rule cannot mark inside it
        part = `${part.slice(0, m.index)}\u0001${id}\u0003${m[0]}\u0002${part.slice(m.index + m[0].length)}`;
      }
      return part;
    }).join('').replace(/\u0001([a-z0-9-]+)\u0003([^\u0002]*)\u0002/g, (x, id, w) => {
      const t = lookup(id);
      return `<span class="term" title="${String(t.meaning).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')}" style="border-bottom:1px dotted;cursor:help">${w}</span>`;
    });
  }

  // ── the bill ──────────────────────────────────────────────────────────────
  const incGst = (v, gst) => v == null ? null : (gst === false ? v * 1.1 : v);
  const pick = (list, id) => list.find(x => x.id === id) || list.find(x => x.def) || list[0];
  function nameOf(x) { const it = x.ref && item(x.ref); return x.name || x.short || (it && it.name) || x.id; }
  function row(section, x, qty, extra) {
    const lo = incGst(x.aud[0], x.gst), hi = incGst(x.aud[1], x.gst);
    return Object.assign({ section, id: x.id || x.ref, ref: x.ref, name: nameOf(x), qty, lo, hi, lead: x.lead, where: x.where || [], note: x.note || '', conf: x.conf, src: x.src || [], planned: !!x.planned }, extra || {});
  }

  function build(S) {
    const P = pick(B.platforms, S.platform);
    const plan = planSticks(S.channels, S.sticks);
    const nSticks = plan.sticks ? plan.sticks.length : 0;
    const sdr = pick(B.sdrs, S.sdr);
    let mount = pick(B.mounts.filter(m => m.for.includes(sdr.mount)), S.mount);
    const ant = pick(B.antennas, S.antenna);
    const pw = pick(B.power, S.power);
    const bh = pick(B.backhaul, S.backhaul);
    const enc = pick(B.enclosures, S.enclosure);
    const L = load(plan, S);
    const cap = capacity(P), nCores = cores(P), one = oneCore(P);
    const use = cap ? L.total / cap : Infinity;
    const useLow = cap ? L.totalLow / cap : Infinity;
    // the busiest channel against one of this computer's cores
    const chUse = L.worst ? (one ? L.worst.need / one : Infinity) : 0;
    const chUseLow = L.worst ? (one ? L.worst.needLow / one : Infinity) : 0;
    const flags = L.perChannel.filter(c => (one ? c.need / one : Infinity) > B.model.chSafe);
    const room = headroom(plan, S, P);
    const host = item(P.ref) || {};
    const warn = [];
    const rows = [];

    // the computer
    rows.push(row('Computer', P.parts ? Object.assign({}, P, { note: `Order: ${P.parts}.` }) : P, 1));
    if (P.aud[0] == null) warn.push(['warn', `${P.short}: the price is by quote and is not in the total below. Ask the seller (the links on its line) and add it.`]);
    if (P.install === 'pi') rows.push(row('Computer', { id: 'sd-endurance', name: 'High-endurance or industrial microSD card (32 GB)', aud: [20, 60], gst: true, lead: B.platforms[0].lead, where: P.where, note: 'RPi ALERT writes little, but a remote site deserves an endurance card. A CM5 or Verdin boots from eMMC instead.', conf: 'low' }, 1));
    if ((P.kind === 'board' || P.kind === 'module') && !enc.indoor) rows.push(row('Computer', { id: 'din-mount', ref: 'din-pi-case', name: 'DIN-rail mount or case for the board', aud: [20, 45], gst: true, lead: { d: [2, 7], text: 'Australian retailers' }, where: [['Core Electronics', 'https://core-electronics.com.au/']], conf: 'low' }, 1));

    // receivers
    if (nSticks) {
      rows.push(row('Receivers', sdr, nSticks));
      if (mount.aud[1] > 0) rows.push(row('Receivers', mount, nSticks));
    }
    if (sdr.mount === 'm2') {
      if (!P.m2 || P.m2 === 'hat' || P.m2 === 'nvme') warn.push(['bad', `${P.short} has no M.2 slot carrying USB: a card SDR needs Mallow's B-key slot or a carrier of your own.`]);
      if (nSticks > 1) warn.push(['warn', `One M.2 slot holds one card: the other ${nSticks - 1} stick${nSticks > 2 ? 's' : ''} go on USB.`]);
    } else if (nSticks > P.usb) warn.push(['warn', `${nSticks} sticks and ${P.usb} USB ports: add a powered USB hub.`]);
    if (S.decoder === 'lean' || S.decoder === 'light') warn.push(['info', `The CPU figures assume RPi ALERT filtering only around bursts — built, and off by default: its first live check missed some of the weakest bursts, ones just over the squelch${S.decoder === 'light' ? ', and the Light decoder has not been checked in the field at all' : ''}. Do not choose a computer on these figures. Filtering always, the default: ${Math.round(load(plan, Object.assign({}, S, { decoder: 'filter-once' })).total / (capacity(P) || 1) * 100)}% of this computer's CPU.`]);
    if (sdr.planned) warn.push(['info', 'The M.2 card is a design to commission, not a part to buy: plan on USB sticks until it exists (see the custom path below).']);

    // RF
    rows.push(row('Antenna and RF', ant, 1));
    rows.push(row('Antenna and RF', B.rf.coax, S.coaxM, { unit: 'm' }));
    rows.push(row('Antenna and RF', B.rf.nCrimp, 4));
    if (S.arrestor) { rows.push(row('Antenna and RF', B.rf.arrestor, 1)); rows.push(row('Antenna and RF', B.rf.earth, 1)); }
    if (nSticks > 1) rows.push(row('Antenna and RF', nSticks > 2 ? B.rf.split4 : B.rf.split2, 1));
    if (sdr.mount !== 'm2' && nSticks) rows.push(row('Antenna and RF', B.rf.pigtail, nSticks));

    // power
    let pwr = pw;
    if (pw.id === 'mains-plug' && (P.supply === 'mains')) pwr = Object.assign({}, pw, { aud: [0, 0], note: 'The mini PC\'s own power brick — nothing to buy.' });
    if (pw.id === 'mains-plug' && P.mainsNote) pwr = Object.assign({}, pw, { name: 'Mains: a 5 V 5 A supply', aud: P.mainsAud || pw.aud, note: P.mainsNote, conf: 'low' });
    if (pw.id === 'mains-plug' && (P.supply === 'wide' || P.supply === '24v')) pwr = Object.assign({}, pw, { aud: [35, 90], name: `Mains: a ${P.supply === '24v' ? '24' : '12'} V DIN-rail supply`, ref: 'meanwell-hdr-30-12', note: `${P.short} takes DC on terminals: a Mean Well HDR-series supply${P.supply === '24v' ? ' (24 V model)' : ''}.` });
    if (pw.id === 'dc12') {
      if (P.supply === 'wide') pwr = Object.assign({}, pw, { aud: [0, 0], note: `${P.short} takes 12 V straight onto its terminals — just a fuse.` });
      else if (P.supply === '24v') { pwr = Object.assign({}, pw, { aud: [60, 120], name: '12 → 24 V DC-DC converter', ref: null, note: 'The RevPi Connect 5 is a 24 V device: a step-up converter from a 12 V battery (an estimate; check its input range).', conf: 'low' }); warn.push(['info', 'The RevPi Connect 5 is built for 24 V cabinets: on 12 V it needs a step-up converter.']); }
      else if (P.supply === 'mains') { pwr = Object.assign({}, pw, { aud: [40, 90], name: '12 → 19 V DC-DC converter for the mini PC', ref: null, note: 'Mini PCs want 12–19 V from a brick; a car-PC style converter, an estimate.', conf: 'low' }); warn.push(['warn', 'A mini PC on a battery draws 8–25 W around the clock: size the battery and panel for it (the configurator\'s power budget does this).']); }
      else if (P.supply === '5v5a') pwr = Object.assign({}, pw, { name: 'Mean Well DDR-30G-5 (9–36 V in, 5 V 6 A)', ref: 'meanwell-ddr-30g-5', aud: [77.73, 78.07], lead: { d: [1, 120], text: 'out of stock at Power Supplies Australia; RS had 3 for next-day delivery; 17 weeks from the factory' }, where: [['RS Components Australia', 'https://au.rs-online.com/web/p/dc-dc-converters/1757801'], ['Power Supplies Australia', 'https://www.power-supplies-australia.com.au/']] });
    }
    if (pw.id === 'dcups' && P.supply === 'mains') warn.push(['warn', 'A DC UPS feeds 12 V and 5 V computers; a mini PC wants an ordinary UPS (or the 12 → 19 V converter).']);
    rows.push(row('Power', pwr, 1));

    // backhaul
    rows.push(row('Backhaul', bh, 1));
    if (bh.needsWifi && !P.wifi) warn.push(['bad', `${P.short} has no Wi-Fi: use Ethernet, or a module with Wi-Fi.`]);
    if (bh.id === 'rut241') rows.push(row('Backhaul', { id: 'iot-sim', ref: 'iot-sim-10mb', name: 'IoT SIM (first month; then A$5–15 a month)', aud: [5, 15], gst: true, lead: { d: [1, 5], text: 'Telstra, Optus or Vodafone business IoT' }, where: [], conf: 'low' }, 1));

    // the box
    rows.push(row('Enclosure', enc, 1));
    if (!enc.indoor) rows.push(row('Enclosure', { id: 'enclosure-fittings', ref: 'enclosure-fittings', aud: [60, 110], gst: true, lead: { d: [2, 7], text: 'electrical wholesalers' }, where: [["Middy's", 'https://www.middys.com.au/']], conf: 'low' }, 1));
    const tmax = host.temp ? host.temp[1] : null;
    if (tmax != null && enc.temp != null && tmax - 10 < enc.temp) warn.push([tmax < enc.temp ? 'bad' : 'warn', `${host.tempAssumed ? `No temperature rating was read for ${P.short}, so ${tmax} °C is assumed` : `${P.short} is rated to ${tmax} °C`}; ${enc.indoor ? 'a room' : 'a cabinet in a hut'} can reach about ${enc.temp} °C — ${tmax < enc.temp ? 'too hot' : 'little margin'}. Shade, vent it, or pick a computer rated −20/−40 to +85 °C.`]);

    if (S.gps) rows.push(row('Extras', B.gps, 1));
    rows.push(row('Software', { id: 'rpi-alert', ref: 'rpi-alert', name: 'RPi ALERT (MIT) and a Flood-Net ingest token', aud: [0, 0], gst: true, lead: { d: [0, 1], text: 'download; the token is approved by a Flood-Net administrator in minutes' }, where: [['RPi ALERT on GitHub', 'https://github.com/cdomotor-g/RPi_ALERT']], note: 'Free. The Pi asks for its token; an administrator approves it from a phone.', conf: 'high' }, 1));

    // CPU and memory
    if (flags.length) {
      const mhz = c => `${+c.mhz.toFixed(4)} MHz${c.a2 ? ' (ALERT2)' : ''}`;
      const who = flags.length > 3 ? `${flags.length} channels each need` : flags.length > 1 ? `${flags.map(mhz).join(', ').replace(/, ([^,]*)$/, ' and $1')} each need` : `${mhz(flags[0])} needs`;
      warn.push([chUse > 1 ? 'bad' : 'warn', `${who} more than ${Math.round(B.model.chSafe * 100)}% of one of this computer's cores${flags.length > 1 ? ` (the busiest, ${mhz(L.worst)}: ${Math.round(chUse * 100)}%)` : ` (${Math.round(chUse * 100)}%)`}. A channel is decoded on one core and cannot be spread over several${chUse > 1 ? ', so it falls behind and loses bursts however idle the other cores are' : ', so a storm leaves it little room'}. ${P.short} has ${nCores} core${nCores === 1 ? '' : 's'}, each worth about ${one.toFixed(2).replace(/0$/, '')} of a Pi 4 core. What helps: a computer with faster cores${L.worst.khz > 240 ? ', a stick of its own for that channel so its window is narrower' : ''}${L.worst.a2 && !S.a2skip ? ', or RPi ALERT\'s planned change that reads ALERT2 frames straight away (not yet released)' : ''}. More cores do not.`]);
    }
    if (host.hw && host.hw.ram && L.memAllMb + (S.kiosk ? 400 : 0) > host.hw.ram * 1024 * 0.7) warn.push(['warn', `${L.channels} channels take about ${L.memAllMb} MB (${B.model.mbPerChannel} MB a channel and about ${B.model.mbAgent} MB for the agent itself)${S.kiosk ? ' and the screen dashboard about 400 MB' : ''}: tight on ${host.hw.ram} GB.`]);
    if (plan.error) warn.push(['bad', plan.error]);
    if (plan.capped) warn.push(['info', `These channels need at least ${plan.minK} sticks; planned on ${plan.minK}.`]);

    // delivery, once a shop
    const del = delivery(rows);
    del.rows.forEach(r => rows.push(r));
    if (del.unknown.length) warn.push(['info', `Delivery not counted from ${del.unknown.join(', ')}: add it to your quote.`]);

    // totals
    const lines = rows.map(r => Object.assign(r, { tlo: r.lo == null ? null : r.lo * r.qty, thi: r.hi == null ? null : r.hi * r.qty }));
    const total = { lo: lines.reduce((s, r) => s + (r.tlo || 0), 0), hi: lines.reduce((s, r) => s + (r.thi || 0), 0) };
    const longest = lines.filter(r => r.lead && r.lead.d && r.section !== 'Delivery').sort((a, b) => b.lead.d[1] - a.lead.d[1])[0];
    const likely = lines.filter(r => r.lead && r.lead.d).reduce((m, r) => Math.max(m, r.lead.d[0]), 0);

    return { S, P, host, plan, sdr, mount, ant, pw: pwr, bh, enc, load: L, cap, use, useLow, cores: nCores, oneCore: one, chUse, chUseLow, flags, room,
      verdict: verdict(use, chUse), rows: lines, total, longest, likely, warn, steps: steps(S, P, plan, sdr, mount, bh, enc, pwr) };
  }

  // ── delivery ──────────────────────────────────────────────────────────────
  // Each line is bought from the first shop it names; each shop delivers once,
  // at its standard rate (B.shops: [a small order, a large or heavy one]),
  // free over its threshold. An overseas order of more than A$1,000 also pays
  // a clearance charge at the border (B.import).
  const shopFor = name => { const k = Object.keys(B.shops || {}).find(k => name === k || name.startsWith(k + ' ') || name.startsWith(k + ':')); return k ? Object.assign({ name: k }, B.shops[k]) : null; };
  function delivery(rows) {
    const by = new Map();
    for (const r of rows) {
      if (!r.where.length || !(r.hi > 0) || r.planned) continue;
      const sh = shopFor(r.where[0][0]);
      const key = sh ? sh.name : r.where[0][0];
      const g = by.get(key) || { sh, name: key, lo: 0, hi: 0, parts: [] };
      g.lo += r.lo * r.qty; g.hi += r.hi * r.qty; g.parts.push(r.name);
      by.set(key, g);
    }
    const out = [], unknown = [];
    for (const g of by.values()) {
      const sh = g.sh;
      if (!sh) { unknown.push(g.name); continue; }
      let lo = sh.ship[0], hi = sh.ship[1];
      if (sh.freeOver != null && g.lo >= sh.freeOver) { lo = 0; hi = 0; }
      else if (sh.freeOver != null && g.hi >= sh.freeOver) { lo = 0; hi = sh.ship[0]; }
      const IM = B.import;
      const over = sh.from !== 'AU' && !sh.ddp && IM && g.hi > IM.threshold;
      if (over) { hi += IM.clearance[1]; if (g.lo > IM.threshold) lo += IM.clearance[0]; }
      lo = Math.min(lo, hi);
      const parts = g.parts.length > 3 ? `${g.parts.slice(0, 3).join(', ')} and ${g.parts.length - 3} more` : g.parts.join(', ');
      out.push(row('Delivery', { id: `ship-${g.name}`, name: `Delivery from ${g.name}`, aud: [lo, hi], gst: true, lead: { d: [0, 0], text: sh.text || '' },
        where: sh.src && sh.src.length ? [[sh.src[0][0], sh.src[0][1]]] : [], note: `${sh.note ? sh.note + ' ' : ''}For: ${parts}.${over ? ` Over A$${IM.threshold.toLocaleString('en-AU')} from overseas: GST at the border and ${IM.what}.` : ''}`, conf: sh.conf || 'medium', src: sh.src || [] }, 1));
    }
    return { rows: out, unknown };
  }

  // ── the build, step by step ───────────────────────────────────────────────
  function steps(S, P, plan, sdr, mount, bh, enc) {
    const freqArgs = (plan.sticks || []).map((s, i) => `rpi-alert sdr ${i + 1} freq ${s.chans.map(f => +f.toFixed(4)).join(', ')}`);
    const out = [];
    out.push({ h: 'Order', items: [
      'Order the longest lead times first (the chart above). Ask for the manufacturer\'s lead time as well as "in stock": a module that is in stock today can be 12 weeks away tomorrow.',
      'Buy one more stick than you need: two sticks are seldom equally good (one at the Brisbane base heard the same bursts 9–19 dB weaker), and a spare lets you swap the weak one out.',
    ] });
    const flash = {
      pi: ['Write the card with Raspberry Pi Imager and the RPi ALERT repository: <code>rpi-imager --repo https://cdomotor-g.github.io/RPi_ALERT/os_list.json</code> → <b>RPi ALERT (arm64)</b>. Accept the customisation (Wi-Fi, SSH).', 'Or, on a card already running Raspberry Pi OS: <code>curl -fsSL https://raw.githubusercontent.com/cdomotor-g/RPi_ALERT/main/os/bootstrap.sh | sudo bash</code>.'],
      cm: ['Put the board in USB-boot mode (the IO board\'s boot jumper or button — see its datasheet), connect its USB-C to a computer and run <code>rpiboot</code>: the eMMC appears as a drive.', 'Write it with Raspberry Pi Imager and the RPi ALERT repository, as for a Pi (<code>rpi-imager --repo https://cdomotor-g.github.io/RPi_ALERT/os_list.json</code>). RPi ALERT has not been tested on a Compute Module yet: note what you find.'],
      verdin: ['Write the eMMC with Toradex Easy Installer (boot the module into recovery mode, connect USB) and choose Torizon OS. Toradex does not support plain Debian on a Verdin.', 'Run open-ALERT\'s container, which has no special privileges: use the compose file in <code>firmware/container/</code> of <a href="https://github.com/cdomotor-g/open-ALERT" target="_blank" rel="noopener">the open-ALERT repository</a> (it is new and not released: so far it has only been tried with stand-ins for the radio on one PC, never on Torizon OS or an ARM computer; the firmware\'s notes say what works today), with the USB bus passed through for the sticks. It carries RPi ALERT\'s signed release, unchanged. <b>Honest status:</b> nothing has yet been run with a real radio stick on a computer that is not a Raspberry Pi; record what it takes.'],
      luna: ['Power it up with a screen on its HDMI port: if Torizon OS is already on the eMMC, it shows a pairing screen. If not, fit the USB_BOOT jumper, connect its USB-C to a computer and run the flash script from Toradex\'s Luna image (the getting-started guide, section 4).', 'Run open-ALERT\'s container, which has no special privileges (the compose file in <code>firmware/container/</code> of the open-ALERT repository: new, not released, and never tried on Torizon OS), with the USB bus passed through, as on a Verdin. <b>Honest status:</b> nothing has yet been run with a real radio stick on a computer that is not a Raspberry Pi, and the Luna is a sample product on the chip-maker\'s own kernel.'],
      package: ['Put Debian 13 (Trixie) or Ubuntu 24.04 LTS on the computer from a USB stick: it needs no desktop. Check which system the maker supports: OnLogic offers Ubuntu 24.04 on the CL260; Lenovo\'s sheet for the ThinkEdge names Ubuntu Server 26.04, which the package has not been tried on. On a BeagleBoard, use BeagleBoard.org\'s own Debian image.', 'Download <code>open-alert-base_….deb</code> from <a href="https://github.com/cdomotor-g/open-ALERT/releases" target="_blank" rel="noopener">open-ALERT\'s releases</a> (there were none on 13 November 2026: until the first, the package is built from the repository\'s <code>firmware/</code> folder) and install it: <code>sudo apt install ./open-alert-base_….deb</code>. It carries RPi ALERT\'s signed release, unchanged. For a network with an IT team, name the locked-down profile first: <code>sudo OPEN_ALERT_BASE_PROFILE=enterprise apt install ./open-alert-base_….deb</code> (no hotspot, nothing changed from Flood-Net, the dashboard reachable from the computer itself only).', 'Then <code>open-alert-base status</code> to see that it runs. <b>Honest status:</b> the package\'s own checks pass on Debian 13 and Ubuntu 24.04 with stand-ins for the radio, on one test computer that has no USB (<a href="https://github.com/cdomotor-g/open-ALERT/blob/main/firmware/README.md" target="_blank" rel="noopener">the firmware\'s notes</a> have the table as it stands today). Nothing has yet been run with a real radio stick on a computer that is not a Raspberry Pi. Treat this build as the first test and write down what you find.'],
      debian: ['Install Debian 13 (Trixie) from a USB stick: no desktop needed.', 'Then <code>sudo apt install git</code>, <code>git clone https://github.com/cdomotor-g/RPi_ALERT</code>, <code>sudo ./RPi_ALERT/os/install.sh</code>. The installer is plain Debian (apt, systemd, udev) but has only been run on Raspberry Pi OS: the Pi-only parts (under-voltage, boot partition settings) do nothing here.'],
    }[P.install];
    out.push({ h: 'Bench build', items: [
      ...flash,
      `Plug in one stick at a time and give each a serial of its own while the agent is stopped: <code>sudo systemctl stop ${P.install === 'package' ? 'open-alert-base' : 'rpi-alert'}; rtl_eeprom -s ALERT1</code> (letters, not a bare number), then unplug and replug it. Then the agent knows each stick wherever it is plugged.`,
      `Set each stick's channels on the dashboard (Settings → RTL-SDR) or over SSH:<br>${freqArgs.map(a => `<code>${a}</code>`).join('<br>') || '—'}`,
      P.install === 'package' ? 'Ask for a Flood-Net token. On the standard profile, open the dashboard from another computer on the same network (<code>http://&lt;the computer\'s address&gt;/</code>) and press <b>Request a token</b>. On the enterprise profile, which keeps the dashboard to the computer itself, run <code>rpi-alert setup</code> on it instead (or open <code>http://127.0.0.1:8080/</code> there, if it has a screen and a browser). Check the code and approve it on Flood-Net\'s <b>Admin</b> tab from your phone. Readings start within seconds.' : 'Open <code>http://rpi-alert.local/</code> (or the box\'s screen), press <b>Request a token</b>, check the code and approve it on Flood-Net\'s <b>Admin</b> tab from your phone. Readings start within seconds.',
      'Leave it on the bench for a day with an antenna by a window: the Overview\'s <i>Decoder busy</i> should stay under 70% and no stick should show dropped samples.',
    ] });
    const site = [];
    site.push('Mount the antenna clear of the roof and metalwork, as high as the mast allows; a drip loop in the coax before it enters.');
    if (S.arrestor) site.push('Fit the arrestor where the coax enters the building or box, bonded with a short, straight lead to the earth stake — the same earth as the mains, by an electrician.');
    if (plan.sticks && plan.sticks.length > 1) site.push(`Coax → the ${plan.sticks.length > 2 ? 'four' : 'two'}-way splitter → a pigtail to each stick. Unused splitter ports get a 50 Ω terminator.`);
    if (mount.id === 'ext-clamp') site.push('Each stick on its short extension, clamped to the rail with a P-clip, the coax looped and tied so a tug lands on the tie, not the stick.');
    if (mount.id === 'panel-lock') site.push('Each stick behind its sealed Bulgin receptacle: lock the bayonet, then tie the coax off to the box.');
    if (mount.id === 'direct') site.push('Sticks straight into the ports: tie the coax off to the case so its weight never hangs on the stick.');
    if (sdr.mount === 'm2') site.push('The SDR card in the M.2 slot, screwed down; its u.FL lead to an SMA or N bulkhead on the box wall.');
    if (bh.id === 'rut241') site.push('The 4G router on the DIN rail, its antennas outside the box (a metal box blocks them); Ethernet from router to computer.');
    if (bh.id === 'starlink') site.push('The Starlink Mini outside with a clear view of the sky, its Ethernet into the box through a gland.');
    if (!enc.indoor) site.push('In the box: supply, computer and router on the DIN rail, every cable through an IP68 gland, a breather vent and a desiccant bag. Shade the box from the afternoon sun.');
    out.push({ h: 'On site', items: site });
    out.push({ h: 'Check it end to end', items: [
      `On the box: the Overview shows each stick, its channels and bursts decoded${P.install === 'pi' || P.install === 'cm' ? '; no under-voltage banner' : ''}; the CPU and temperature steady.`,
      'On Flood-Net: the base appears on the <b>Base Stations</b> tab (it checks in every minute — Flood-Net never connects in), its readings in the <b>Message Log</b> with frequency, signal and SNR, its frames on the <b>Reception Map</b>.',
      'Pull the network for ten minutes and put it back: the readings held in the disk queue arrive, stamped with when they were heard.',
    ] });
    out.push({ h: 'Keep it going', items: [
      P.install === 'package' ? 'Updates: a new version of RPi ALERT arrives as a new <code>open-alert-base</code> package, built from the next signed release. Install it over the old one (<code>sudo apt install ./open-alert-base_….deb</code>); your settings are kept. The package installs no updater and no maintenance account: logins, SSH and operating-system updates are your organisation\'s own. Settings can be changed from Flood-Net\'s Base Stations tab on the standard profile only; the enterprise profile reports how it is and refuses changes.'
        : P.install === 'verdin' || P.install === 'luna' ? 'Updates: Torizon OS has its own, and RPi ALERT\'s arrive as a new container built from the next signed release. The container is new and has never been tried on Torizon OS: the firmware\'s notes say how it is updated.'
        : 'Updates and settings from Flood-Net\'s Base Stations tab; SSH keys only, the <code>alert</code> account, never a shared password.',
      'Once a year: look at the arrestor and earth bond, the glands and desiccant, and compare the sticks\' SNR on a shared channel — swap a stick that has gone deaf.',
    ] });
    return out;
  }

  const API = { B, setCatalog, windowFor, splitInto, planSticks, load, capacity, cores, oneCore, verdict, headroom, build, TRAFFIC, A2_TRAFFIC, TERMS, WORDS, MARKS, markTerms };
  if (isNode) { module.exports = API; return; }
  globalThis.OA_BUILD_API = API;
  if (!document.getElementById('controls')) return;   // another page using the model only

  // ══ the page ══════════════════════════════════════════════════════════════
  const $ = (s, el) => (el || document).querySelector(s);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const money = v => v == null ? '—' : 'A$' + Math.round(v).toLocaleString('en-AU');
  const range = (lo, hi) => lo == null && hi == null ? 'quote' : (Math.round(lo) === Math.round(hi) ? money(lo) : `${money(lo)}–${Math.round(hi).toLocaleString('en-AU')}`);
  const wk = n => { const w = Math.round(n / 7); return w === 1 ? '1 week' : `${w} weeks`; };
  const days = d => {
    if (!d || d[1] === 0) return '—';
    if (d[1] <= 7) return d[0] === d[1] ? `${d[0]} days` : `${d[0]}–${d[1]} days`;
    if (d[0] >= 14) return Math.round(d[0] / 7) === Math.round(d[1] / 7) ? wk(d[1]) : `${Math.round(d[0] / 7)}–${wk(d[1])}`;
    return `${d[0]} days–${wk(d[1])}`;
  };
  const KEY = 'open-alert:builder';
  const DEFAULT = {
    platform: 'rpi-4-4gb', channels: B.channels.filter(c => c.def).map(c => c.mhz), sticks: 'auto',
    decoder: 'filter-once', traffic: 'busy', kiosk: false, a2: 0, a2traffic: 'today', a2skip: false, sdr: 'rtl-sdr-blog-v3', mount: 'ext-clamp',
    antenna: 'vhf-dipole-unity', coaxM: 15, arrestor: true, power: 'mains-plug', backhaul: 'lan', enclosure: 'fibox', gps: false,
  };
  let S = load0();
  function load0() {
    let s = null;
    const m = location.hash.match(/#b=([A-Za-z0-9_-]+)/);
    if (m) { try { s = JSON.parse(decodeURIComponent(escape(atob(m[1].replace(/-/g, '+').replace(/_/g, '/'))))); } catch (e) { s = null; } }
    if (!s) { try { s = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { s = null; } }
    // Saved data that is not what this page wrote (damaged, or from a later version) must not blank the page.
    if (!s || typeof s !== 'object' || Array.isArray(s)) s = {};
    const out = Object.assign({}, DEFAULT, s);
    out.channels = Array.isArray(out.channels) ? out.channels.map(Number).filter(f => f >= 136 && f <= 174) : DEFAULT.channels.slice();
    for (const k of ['kiosk', 'arrestor', 'gps', 'a2skip']) out[k] = !!out[k];
    out.coaxM = Math.max(1, Math.min(100, Number(out.coaxM) || DEFAULT.coaxM));
    return out;
  }
  // The other words: their meanings live in the hardware review's list (data/review.js), loaded by this page.
  const RT = id => ((globalThis.OA_REVIEW && globalThis.OA_REVIEW.terms) || []).find(t => t.id === id);
  const mark = html => markTerms(html, RT);
  function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* private mode */ } }
  function shareLink() {
    const b = btoa(unescape(encodeURIComponent(JSON.stringify(S)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    return location.href.split('#')[0] + '#b=' + b;
  }

  // ── words with a meaning of their own here ──
  // The meaning on hover; the same list is printed under the CPU box (terms()).
  const term = (k, text) => `<span class="term" title="${esc(TERMS[k][1])}" style="border-bottom:1px dotted;cursor:help">${esc(text || TERMS[k][0])}</span>`;
  const pc = x => isFinite(x) ? Math.round(x * 100) : 999;
  // "36–55%": the bench alone to a busy computer; one figure when they round the same.
  const pcs = (lo, hi) => pc(lo) === pc(hi) ? `${pc(hi)}%` : `${pc(lo)}–${pc(hi)}%`;
  const mhzOf = f => String(+Number(f).toFixed(4));
  const winOf = khz => khz >= 1000 ? khz / 1000 + ' MHz' : khz + ' kHz';
  // What a platform would make of this plan: both limits.
  function fitOf(p, L) {
    const cap = capacity(p), one = oneCore(p);
    const u = cap ? L.total / cap : Infinity, uLow = cap ? L.totalLow / cap : Infinity;
    const cu = L.worst ? (one ? L.worst.need / one : Infinity) : 0;
    return { cap, one, u, uLow, cu, v: verdict(u, cu) };
  }

  // ── controls ──
  const opt = (list, cur, label) => list.map(x => `<option value="${esc(x.id)}"${x.id === cur ? ' selected' : ''}>${esc(label ? label(x) : nameOf(x))}</option>`).join('');
  function controls() {
    const R = build(S);
    const pf = B.platforms.map(p => {
      const it = item(p.ref) || {};
      const F = fitOf(p, R.load), v = F.v;
      const oneChip = v.one === 'ok' ? '' : `<span class="chip st-${v.one === 'bad' ? 'bad' : 'warn'}" title="The busiest channel needs ${pc(F.cu)}% of one of its cores. A channel is decoded on one core and cannot use more.">one core ${pc(F.cu)}%</span>`;
      const openness = (it.open && it.open.hw) || 'closed';
      const tip = id => { const t = RT(id); return t ? ` title="${esc(t.meaning)}"` : ''; };
      return `<label class="pf${p.id === S.platform ? ' on' : ''}"><input type="radio" name="platform" value="${esc(p.id)}"${p.id === S.platform ? ' checked' : ''}>
        <span class="pf-top"><b>${esc(p.short)}</b><span class="chip plain">${esc({ board: 'board', module: 'module + carrier', box: 'boxed' }[p.kind])}</span></span>
        <span class="pf-bar" title="All the channels together would use ${pcs(F.uLow, F.u)} of this computer; the busiest channel ${pc(F.cu)}% of one of its ${cores(p)} cores"><i class="${v.cls}" style="width:${Math.min(100, F.u * 100).toFixed(0)}%"></i></span>
        <span class="small dim">${pcs(F.uLow, F.u)} CPU · ${range(incGst(p.aud[0], p.gst), incGst(p.aud[1], p.gst))} · ${days(p.lead.d)}</span>
        <span class="chips">${oneChip}${it.temp ? `<span class="chip plain" title="${esc(it.tempAssumed ? 'Assumed, not the maker\'s figure. ' + it.tempAssumed : 'The air temperature the maker rates it for')}">${it.temp[0]} to ${it.temp[1]} °C${it.tempAssumed ? ' assumed' : ''}</span>` : ''}<span class="chip ${openness === 'open' ? 'open' : openness === 'partial' ? 'partial' : 'closed'}"${tip('hw-open')}>hardware ${esc(openness)}</span>${it.hw && it.hw.storage === 'emmc' ? `<span class="chip open"${tip('emmc')}>eMMC</span>` : ''}${it.hw && it.hw.storage === 'sd' ? '<span class="chip partial" title="It starts from a memory card, which wears out sooner than built-in storage">SD card</span>' : ''}</span>
      </label>`;
    }).join('');
    const nCh = R.load.channels, a2Now = Math.min(Number(S.a2) || 0, nCh);
    const a2Opts = Array.from({ length: nCh + 1 }, (_, k) => `<option value="${k}"${k === a2Now ? ' selected' : ''}>${k === 0 ? 'None' : k === nCh && nCh > 1 ? `All ${nCh}` : k}</option>`).join('');
    const a2T = [['today', `As heard today (about ${A2_TRAFFIC.today} frames a minute)`], ['storm', `A storm after a changeover (${A2_TRAFFIC.storm}: half the slots used — a judgement)`], ['full', `Every slot used (${A2_TRAFFIC.full}: the most a channel can carry)`]]
      .map(([k, t]) => `<option value="${k}"${S.a2traffic === k ? ' selected' : ''}>${esc(t)}</option>`).join('');
    const chs = [...new Set([...B.channels.map(c => c.mhz), ...S.channels])].sort((a, b) => a - b).map(f => {
      const c = B.channels.find(x => x.mhz === f);
      return `<label class="chk"><input type="checkbox" name="ch" value="${f}"${S.channels.includes(f) ? ' checked' : ''}> ${f.toFixed(4).replace(/0+$/, '').replace(/\.$/, '')} <span class="dim small">${esc(c ? c.note : 'yours')}</span></label>`;
    }).join('');
    const mounts = B.mounts.filter(m => m.for.includes(R.sdr.mount));
    $('#controls').innerHTML = `
      <fieldset><legend>1 · The computer</legend><div class="pfs">${pf}</div>
        <p class="small dim" id="pf-fit">${mark(esc(R.P.fit))}</p>
        <p class="small dim">On each card: the bar and the first figure are all your channels together as a share of that computer; then its price and how long it takes to arrive. "Hardware open, partial or closed" says whether its design files are published: open, under a licence that lets anyone make and change it; partial, some drawings without such a licence; closed, none. The temperatures are the maker's rating, or marked "assumed" where no rating was read. "eMMC" is storage soldered to the board; "SD card" means it starts from a memory card.</p></fieldset>
      <fieldset><legend>2 · Channels to hear</legend><div class="chks">${chs}</div>
        <div class="row"><label>Add a channel (MHz) <input type="number" id="addch" step="0.0125" min="136" max="174" placeholder="151.4375" inputmode="decimal"></label><button type="button" class="ghost small" data-act="addch">Add</button></div>
        <div class="row"><label>Sticks <select name="sticks"><option value="auto"${S.sticks === 'auto' ? ' selected' : ''}>Fewest that hold them</option>${[1, 2, 3, 4].map(k => `<option value="${k}"${String(S.sticks) === String(k) ? ' selected' : ''}>${k}</option>`).join('')}</select></label>
        <label><span>${term('burst', 'ALERT bursts')} to plan for</span> <select name="traffic"><option value="quiet"${S.traffic === 'quiet' ? ' selected' : ''}>Quiet (2 bursts a minute a channel)</option><option value="busy"${S.traffic === 'busy' ? ' selected' : ''}>Busy (8) — rain on a big network</option><option value="heavy"${S.traffic === 'heavy' ? ' selected' : ''}>Heavy (20) — a storm, or a site that hears a whole region</option></select></label></div>
        <div class="row"><label><span>${term('decoder', 'Decoder')}</span> <select name="decoder">${opt(B.decoders, S.decoder)}</select></label>
        <label class="chk"><input type="checkbox" name="kiosk"${S.kiosk ? ' checked' : ''}> A screen on the box (dashboard)</label></div>
        <div class="row"><label>Channels that carry ALERT2 <select name="a2">${a2Opts}</select></label>
        <label><span>${term('frame', 'ALERT2 traffic')} on each of them</span> <select name="a2traffic"${a2Now ? '' : ' disabled'}>${a2T}</select></label></div>
        <div class="row"><label class="chk"><input type="checkbox" name="a2skip" style="flex:none"${S.a2skip ? ' checked' : ''}> <span>Count a change RPi ALERT plans but has not released: read ${term('frame', 'ALERT2 frames')} straight away</span></label></div>
        <p class="small dim">ALERT2 is counted on the channels in the widest ${term('window')} first: the hardest case for ${term('onecore')}.</p></fieldset>
      <fieldset><legend>3 · Receivers</legend><div class="row">
        <label>SDR <select name="sdr">${opt(B.sdrs, S.sdr, x => x.short + (x.planned ? ' — to design' : ''))}</select></label>
        <label>Held by <select name="mount">${opt(mounts, R.mount.id)}</select></label></div>
        <p class="small dim">${esc(R.sdr.note)} ${esc(R.mount.note)}</p></fieldset>
      <fieldset><legend>4 · Antenna and RF</legend><div class="row">
        <label>Antenna <select name="antenna">${opt(B.antennas, S.antenna)}</select></label>
        <label>Coax (m) <input type="number" name="coaxM" min="1" max="100" value="${S.coaxM}" inputmode="numeric"></label>
        <label class="chk"><input type="checkbox" name="arrestor"${S.arrestor ? ' checked' : ''}> Arrestor and earth</label></div></fieldset>
      <fieldset><legend>5 · Power, backhaul, the box</legend><div class="row">
        <label>Power <select name="power">${opt(B.power, S.power)}</select></label>
        <label>Backhaul <select name="backhaul">${opt(B.backhaul, S.backhaul)}</select></label>
        <label>Where it lives <select name="enclosure">${opt(B.enclosures, S.enclosure)}</select></label>
        <label class="chk"><input type="checkbox" name="gps"${S.gps ? ' checked' : ''}> USB GPS</label></div></fieldset>
      <div class="row"><button type="button" class="ghost small" data-act="share">Copy a link to this build</button><button type="button" class="ghost small" data-act="reset">Start again</button></div>`;
  }

  // ── outputs ──
  function render() {
    const R = build(S);
    controls();
    const fold = $('#ch-detail'), wasOpen = fold ? fold.open : null;
    $('#out-cpu').innerHTML = cpuView(R);
    if (wasOpen != null && $('#ch-detail')) $('#ch-detail').open = wasOpen || (R.flags.length > 0 && !fold.dataset.flagged);
    if ($('#ch-detail')) $('#ch-detail').dataset.flagged = R.flags.length ? '1' : '';
    $('#out-sticks').innerHTML = sticksView(R);
    $('#out-box').innerHTML = boxView(R);
    $('#out-warn').innerHTML = R.warn.length ? R.warn.map(([c, t]) => `<p class="note ${c === 'bad' ? 'bad' : ''}"><b class="${c}">${{ bad: 'Problem', warn: 'Check', info: 'Note' }[c]}:</b> ${esc(t)}</p>`).join('') : '<p class="note"><b class="ok">Fits:</b> nothing to flag in this build.</p>';
    $('#out-bom').innerHTML = bomView(R);
    $('#out-lead').innerHTML = leadView(R);
    $('#out-steps').innerHTML = R.steps.map(s => `<h3>${esc(s.h)}</h3><ol>${s.items.map(i => `<li>${mark(i)}</li>`).join('')}</ol>`).join('');
    $('#out-compare').innerHTML = compareView(R);
    save();
  }

  // The CPU box: the gauge for the whole computer, the two limits side by
  // side, which of them bites, the room for ALERT2, and every channel on its
  // one core.
  function cpuView(R) {
    const L = R.load, M = B.model, v = R.verdict, n = L.channels, nSt = R.plan.sticks ? R.plan.sticks.length : 0;
    if (!n) return `<p class="dim">${esc(R.plan.error || 'Tick a channel to see what it asks of the computer.')}</p>`;
    const f2 = x => isFinite(x) ? x.toFixed(2) : '—';
    const rng = (lo, hi) => f2(lo) === f2(hi) ? f2(hi) : `${f2(lo)}–${f2(hi)}`;
    const w = x => `${Math.max(0, Math.min(100, x / R.cap * 100)).toFixed(1)}%`;
    const STRIPE = 'background:repeating-linear-gradient(135deg, color-mix(in srgb, var(--a2) 60%, var(--panel)) 0 4px, color-mix(in srgb, var(--a2) 22%, var(--panel)) 4px 8px)';
    const A2COL = 'background:color-mix(in srgb, var(--a1) 45%, var(--bad))';
    const seg = (x, cls, style, t) => x > 1e-9 ? `<i${cls ? ` class="${cls}"` : ''} style="width:${w(x)}${style ? ';' + style : ''}" title="${esc(t)}"></i>` : '';
    const extra = L.total - L.totalLow, wc = L.worst, H = R.room;
    const who = `${mhzOf(wc.mhz)} MHz${wc.a2 ? ' (ALERT2)' : ''}`;
    const head = `<div class="gauge-h"><b>${esc(R.P.short)}</b> · ${n} channel${n === 1 ? '' : 's'} on ${nSt} stick${nSt === 1 ? '' : 's'}${L.a2Channels ? ` · ${L.a2Channels} carrying ALERT2` : ''} · <span class="${v.cls}">${pcs(R.useLow, R.use)} of its CPU — ${esc(v.text.split(' — ')[0])}</span></div>`;
    const gauge = `<div class="gauge" role="img" aria-label="All the channels together: between ${pc(R.useLow)}% and ${pc(R.use)}% of the whole computer">${
      seg(L.contLow, 'g-cont', '', 'Between bursts, by the measurement alone: every channel picking itself out of its stick\'s window')}${
      seg(L.legacyLow, 'g-burst', '', 'Decoding ALERT bursts')}${
      seg(L.a2Low, '', A2COL, 'Decoding ALERT2 frames')}${
      seg(L.kiosk, 'g-kiosk', '', 'The screen dashboard')}${
      seg(extra, '', STRIPE, 'More if the computer is busy: 1.6 times the filtering, as RPi ALERT\'s own Raspberry Pi 4 showed')
    }<span class="g-safe" style="left:${M.safe * 100}%" title="Plan to stay under ${pc(M.safe)}%"></span></div>`;
    const legend = `<div class="legend small"><span><i class="g-cont"></i>${term('between')} ${f2(L.contLow)}</span><span><i class="g-burst"></i>decoding ${term('burst', 'bursts')} ${f2(L.legacyLow)}</span>${
      L.a2Channels ? `<span><i style="${A2COL}"></i>${term('frame', 'ALERT2 frames')} ${f2(L.a2Low)}</span>` : ''}${
      L.kiosk ? `<span><i class="g-kiosk"></i>screen ${f2(L.kiosk)}</span>` : ''
    }<span><i style="${STRIPE}"></i>more on a ${term('busy')}: up to ${f2(extra)}</span><span class="dim">in ${term('pi4core', 'Pi 4 cores')}; this computer is worth ${R.cap.toFixed(1)} · ${L.memMb} MB of memory for decoders</span></div>`;
    const limits = `<ul class="small">
      <li><b>${term('whole', 'The whole computer')}:</b> all ${n} channel${n === 1 ? '' : 's'} together${L.kiosk ? ' and the screen' : ''} need ${rng(L.totalLow, L.total)} Pi 4 cores of the ${R.cap.toFixed(1)} it is worth — <span class="${v.whole}">${pcs(R.useLow, R.use)}</span>.</li>
      <li><b>${term('onecore', 'One core')}:</b> the busiest channel, ${who} in a ${winOf(wc.khz)} ${term('window')}, needs ${rng(wc.needLow, wc.need)} of the ${f2(R.oneCore)} one of its ${R.cores} cores is worth — <span class="${v.one}">${pcs(R.chUseLow, R.chUse)}</span>.</li>
    </ul>`;
    const narrower = wc.khz > 240 ? ', or a stick of its own for that channel so its window is narrower' : '';
    const skip = wc.a2 && !S.a2skip ? ', or the change RPi ALERT plans that reads ALERT2 frames straight away' : '';
    const say = {
      none: ['Within both limits.', `All the channels together stay under ${pc(M.safe)}% of the computer, and the busiest one under ${pc(M.chSafe)}% of a core.`],
      total: ['The whole computer is the limit.', `All the channels together need ${pc(R.use)}% of it${R.use > 1 ? ', more than it has' : `, over the ${pc(M.safe)}% to plan for`}, while the busiest channel still fits on a core (${pc(R.chUse)}%). More cores or a faster computer fixes this; so do fewer channels, or another stick so the windows are narrower.`],
      channel: ['One core is the limit.', `${who} needs ${pc(R.chUse)}% of one core${R.chUse > 1 ? ', more than a core can do' : `, over the ${pc(M.chSafe)}% to plan for`}, and a channel cannot be spread over several cores. ${v.whole === 'ok' ? `The computer as a whole is only ${pc(R.use)}% used, so more cores would not help` : `The computer as a whole is at ${pc(R.use)}% too, over the ${pc(M.safe)}% to plan for, but more cores alone would not fix that channel`}: it needs faster ones${narrower}${skip}.`],
      both: ['Both limits bite.', `All the channels together need ${pc(R.use)}% of the computer, and ${who} needs ${pc(R.chUse)}% of one core. A bigger computer has to be faster core for core, not only have more of them.`],
    }[v.limit];
    const note = `<p class="note${v.cls === 'bad' ? ' bad' : ''}"><b class="${v.cls}">${say[0]}</b> ${say[1]}</p>`;
    const room = H.channel ? `<p class="small"><b>Room for ALERT2.</b> If one channel here had ${term('slots')} (${A2_TRAFFIC.full} frames a minute), it would need ${rng(H.needLow, H.need)} Pi 4 cores on ${term('onecore')} (about 1.1–1.3 of that is decoding its messages, an estimate timed on a PC and scaled; the rest is listening in this stick's ${term('window')}) — <span class="${H.cls}">${pcs(H.shareLow, H.share)} of one of this computer's</span>. ${H.cls === 'bad' ? 'It could not keep up, however many cores sit idle.' : H.cls === 'warn' ? 'It could keep up, with little to spare.' : 'It could keep up.'} The rule for buying with headroom is at least ${M.rule.cores} cores, each at least ${M.rule.oneCore} times a Pi 4 core: this one has ${H.cores} at about ${f2(H.oneCore)}, and ${H.meetsRule ? '<span class="ok">meets it</span>' : '<span class="warn">falls short</span>'}.${S.a2skip ? ' Counted with the change RPi ALERT plans but has not released.' : ''}</p>` : '';
    const rows = L.perChannel.map(c => {
      const sh = R.oneCore ? c.need / R.oneCore : Infinity, shLo = R.oneCore ? c.needLow / R.oneCore : Infinity;
      return `<tr><th scope="row">${mhzOf(c.mhz)}${c.a2 ? ' <span class="chip a2">ALERT2</span>' : ''}<div class="dim">stick ${c.stick} · ${winOf(c.khz)}</div></th><td class="num">${rng(c.needLow, c.need)}</td><td class="num"><span class="${sh > 1 ? 'bad' : sh > M.chSafe ? 'warn' : 'ok'}">${pcs(shLo, sh)}</span></td></tr>`;
    }).join('');
    const detail = `<details id="ch-detail" class="small"${R.flags.length ? ' open' : ''}><summary style="cursor:pointer">Each channel on its one core${R.flags.length ? ` — <span class="${v.one}">${R.flags.length} over ${pc(M.chSafe)}%</span>` : ''}</summary>
      <div class="table-wrap"><table class="tbl"><thead><tr><th title="The channel, and under it the stick it is on and that stick's window. ${esc(TERMS.window[1])}">Channel (MHz)</th><th class="num" title="${esc(TERMS.pi4core[1])}">Pi 4 cores</th><th class="num" title="${esc(TERMS.onecore[1])}">Of one core</th></tr></thead><tbody>${rows}</tbody></table></div>
      <p class="dim">Each pair of figures runs from the measurement alone to a ${term('busy')}. Green is under ${pc(M.chSafe)}% of a core, amber is over it, red is more than a whole core.</p></details>`;
    return head + gauge + legend + limits + note + room + detail;
  }

  // The band from 151.3 to 152.6 MHz with each stick's window and its channels.
  function sticksView(R) {
    const st = R.plan.sticks || [];
    if (!st.length) return '<p class="dim">Tick a channel to plan the sticks.</p>';
    const all = st.flatMap(s => s.chans);
    const lo = Math.min(151.3, Math.min(...all) - 0.3), hi = Math.max(152.6, Math.max(...all) + 0.3);
    const W = 760, x = f => 20 + (f - lo) / (hi - lo) * (W - 40);
    const cols = ['var(--a2)', 'var(--a1)', 'var(--role-field)', 'var(--role-repeater)'];
    let svg = `<svg viewBox="0 0 ${W} ${60 + st.length * 34}" role="img" aria-label="Each stick's window on the band"><line x1="20" x2="${W - 20}" y1="30" y2="30" class="axis"/>`;
    for (let t = Math.ceil(lo * 10) / 10; t <= hi; t = Math.round((t + 0.1) * 10) / 10) svg += `<line x1="${x(t)}" x2="${x(t)}" y1="26" y2="34" class="axis"/><text x="${x(t)}" y="20" class="tick">${t.toFixed(1)}</text>`;
    st.forEach((s, i) => {
      const mid = (s.chans[0] + s.chans[s.chans.length - 1]) / 2, half = s.window.khz / 2000;
      const y = 44 + i * 34;
      svg += `<rect x="${x(mid - half)}" y="${y}" width="${x(mid + half) - x(mid - half)}" height="22" rx="5" style="fill:color-mix(in srgb, ${cols[i]} 16%, transparent);stroke:${cols[i]}"/>`;
      const lab = `Stick ${i + 1} · ${s.window.khz >= 1000 ? (s.window.khz / 1000) + ' MHz' : s.window.khz + ' kHz'}`;
      // beside the window where there is room (right, then left); otherwise inside it, at its left edge
      svg += x(mid + half) + 118 < W ? `<text x="${x(mid + half) + 6}" y="${y + 15}" class="lbl">${lab}</text>`
        : x(mid - half) - 118 > 0 ? `<text x="${x(mid - half) - 6}" y="${y + 15}" class="lbl" text-anchor="end">${lab}</text>`
        : `<text x="${Math.max(x(mid - half), 20) + 6}" y="${y + 15}" class="lbl">${lab}</text>`;
      for (const f of s.chans) svg += `<line x1="${x(f)}" x2="${x(f)}" y1="${y + 3}" y2="${y + 19}" style="stroke:${cols[i]};stroke-width:2.5"/>`;
    });
    svg += '</svg>';
    const cost = st.reduce((a, s) => a + s.chans.length * s.window.pi4, 0);
    const alt = R.plan.k < Math.min(4, all.length) ? splitInto(all, R.plan.k + 1) : null;
    const altCost = alt ? alt.reduce((a, s) => a + s.chans.length * s.window.pi4, 0) : null;
    const scaled = st.some(s => s.window.basis === 'scaled');
    const hint = alt && altCost < cost * 0.8 ? `<p class="small">One more stick would cut the work between bursts by ${Math.round((1 - altCost / cost) * 100)}%: ${alt.map(s => (s.window.khz >= 1000 ? s.window.khz / 1000 + ' MHz' : s.window.khz + ' kHz')).join(' + ')} windows.</p>` : '';
    return `<div class="diagram band">${svg}</div><div class="table-wrap"><table class="tbl small"><thead><tr><th>Stick</th><th>Channels (MHz)</th><th class="num" title="${esc(TERMS.window[1])}">Window</th><th class="num" title="${esc(TERMS.between[1])}">Work between bursts, Pi 4 cores</th></tr></thead><tbody>${st.map((s, i) => `<tr><td>${i + 1}</td><td>${s.chans.map(f => +f.toFixed(4)).join(', ')}</td><td class="num">${winOf(s.window.khz)}</td><td class="num">${s.chans.length} × ${s.window.pi4}${s.window.basis === 'scaled' ? '*' : ''} = ${(s.chans.length * s.window.pi4).toFixed(2)}</td></tr>`).join('')}</tbody></table></div>
      <p class="small dim">What each channel costs a Raspberry Pi 4 while nothing is on the air, by RPi ALERT's own measurement; a ${term('busy')} may take 1.6 times this.${scaled ? ' * Nobody wrote down a Raspberry Pi 4 figure for this window: it is worked out in proportion from the nearest one measured.' : ''}</p>${hint}`;
  }

  // The box, drawn from what's in it.
  function boxView(R) {
    const indoor = R.enc.indoor, n = R.plan.sticks ? R.plan.sticks.length : 0;
    const W = 760, H = 380;
    const t = (x, y, s, c) => `<text x="${x}" y="${y}" class="${c || 'lbl'}">${esc(s)}</text>`;
    const box = (x, y, w, h, cls, label, sub) => `<g class="bx ${cls}"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="6"/>${t(x + w / 2, y + h / 2 - (sub ? 3 : -4), label, 'bl')}${sub ? t(x + w / 2, y + h / 2 + 13, sub, 'bs') : ''}</g>`;
    let g = '';
    // enclosure
    g += `<rect x="150" y="40" width="440" height="300" rx="12" class="${indoor ? 'room' : 'enc'}"/>${t(160, 60, indoor ? 'Indoors' : 'IP66 cabinet', 'cap')}`;
    if (!indoor) g += `<line x1="170" x2="570" y1="105" y2="105" class="rail"/><line x1="170" x2="570" y1="215" y2="215" class="rail"/>${t(565, 98, 'DIN rail', 'bs')}`;
    // power
    g += box(175, 75, 110, 55, 'b-pwr', R.pw.id === 'dc12' ? '12 V in' : R.pw.id === 'dcups' ? 'DC UPS' : 'Supply', R.pw.id === 'dcups' ? 'charger + battery' : R.P.supply === 'wide' ? 'to terminals' : R.P.supply === 'mains' ? 'brick' : '5 V');
    // computer
    const cw = Math.min(190, 90 + R.P.board[0] / 2), ch = 70;
    g += box(305, 70, cw, ch, 'b-cpu', R.P.short, { board: 'single board', module: 'module on carrier', box: 'sealed box' }[R.P.kind]);
    g += `<path d="M285 102 H305" class="wire"/>`;
    // router
    if (R.bh.id === 'rut241') { g += box(175, 160, 110, 45, 'b-net', '4G router', 'RUT241'); g += `<path d="M285 182 H330 V140" class="eth"/>`; }
    if (R.bh.id === 'starlink') { g += box(20, 40, 110, 45, 'b-net', 'Starlink Mini', 'outside'); g += `<path d="M130 62 H150 M150 62 C 250 62, 330 50, 360 70" class="eth"/>`; }
    if (R.bh.id === 'lan') g += `<path d="M360 70 V22 H20" class="eth"/>${t(90, 16, 'Ethernet to the site LAN', 'bs')}`;
    if (R.bh.id === 'wifi') g += `${t(470, 60, '((Wi-Fi))', 'bs')}`;
    // sticks
    const sx0 = 305, sy = 245;
    if (R.sdr.mount === 'm2') g += box(sx0 + 10, 112, 70, 22, 'b-sdr', 'M.2 SDR', '');
    for (let i = 0; i < n; i++) {
      if (R.sdr.mount === 'm2' && i === 0) continue;
      const x = sx0 + i * 62;
      if (R.mount.id === 'direct') g += `<rect x="${x + 6}" y="${140}" width="18" height="50" rx="4" class="sdr"/><text x="${x + 15}" y="${205}" class="bs">stick ${i + 1}</text>`;
      else {
        g += `<path d="M${x + 15} 140 V${sy}" class="usb"/><rect x="${x + 4}" y="${sy}" width="22" height="56" rx="4" class="sdr"/>${t(x + 15, sy + 72, 'stick ' + (i + 1), 'bs')}`;
        g += R.mount.id === 'panel-lock' ? `<rect x="${x}" y="${sy - 12}" width="30" height="10" rx="2" class="lock"/>` : `<rect x="${x + 2}" y="${sy + 20}" width="26" height="6" rx="2" class="clip"/>`;
      }
    }
    // RF: antenna, arrestor, splitter
    g += `<path d="M700 40 V150" class="mast"/><path d="M690 40 h20 M694 58 h12 M690 76 h20" class="ant"/>${t(735, 60, R.ant.ref === 'vhf-dipole-unity' ? 'dipole' : 'collinear', 'bs')}`;
    g += `<path d="M700 150 V300 H600" class="coax"/>${t(728, 235, `${S.coaxM} m`, 'bs')}${t(728, 249, 'LMR-400', 'bs')}`;
    if (S.arrestor) g += `<rect x="580" y="288" width="26" height="24" rx="3" class="arr"/>${t(593, 280, 'arrestor', 'bs')}<path d="M593 312 V360" class="earthw"/><path d="M582 360 h22 M586 365 h14 M590 370 h6" class="earthw"/>${t(650, 366, 'earth stake', 'bs')}`;
    const fy = 300;
    if (n > 1) g += `<rect x="520" y="${fy - 10}" width="40" height="20" rx="3" class="split"/>${t(540, fy + 24, 'splitter', 'bs')}<path d="M580 ${fy} H560" class="coax"/>`;
    const feedX = n > 1 ? 520 : 580;
    for (let i = 0; i < n; i++) {
      const x = sx0 + i * 62 + 15;
      const top = R.sdr.mount === 'm2' && i === 0 ? 134 : R.mount.id === 'direct' ? 190 : sy + 56;
      g += `<path d="M${feedX} ${fy} C ${feedX - 30} ${fy}, ${x} ${fy + 20}, ${x} ${top}" class="pig"/>`;
    }
    const svg = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="What goes in the box and how it connects">${g}</svg>`;
    return `<div class="diagram boxd">${svg}</div><div class="legend small"><span><i class="lg-coax"></i>coax / pigtail</span><span><i class="lg-usb"></i>USB</span><span><i class="lg-eth"></i>Ethernet</span><span><i class="lg-wire"></i>power</span></div>`;
  }

  function bomView(R) {
    let sec = '';
    const body = R.rows.map(r => {
      const head = r.section !== sec ? `<tr class="sub"><th colspan="5">${esc(r.section)}</th></tr>` : '';
      sec = r.section;
      const it = r.ref && item(r.ref);
      const where = r.where.map(([n, u]) => `<a href="${esc(u)}" target="_blank" rel="noopener">${esc(n)}</a>`).join(', ');
      const tip = [r.note, r.conf === 'low' ? 'Price and lead time are estimates.' : '', it && it.price && it.price.aud ? `Catalogue: A$${it.price.aud}${it.price.gst === false ? ' ex GST' : ''} (${[it.price.basis, it.price.src].filter(Boolean).join(', ')}).` : ''].filter(Boolean).join(' ');
      return `${head}<tr${r.planned ? ' class="planned"' : ''}><th scope="row"><span class="nm">${esc(r.name)}</span>${r.conf === 'low' ? ' <span class="chip st-warn" title="An estimate">est.</span>' : ''}${tip ? `<div class="small dim">${esc(tip)}</div>` : ''}</th><td class="num" data-l="Qty"><span>${r.qty}${r.unit === 'm' ? ' m' : ''}</span></td><td class="num" data-l="A$"><span>${range(r.tlo, r.thi)}</span></td><td class="small" data-l="Lead">${esc(days(r.lead && r.lead.d))}<div class="dim">${esc(r.lead ? r.lead.text : '')}</div></td><td class="small" data-l="Where"><span>${where || '—'}</span></td></tr>`;
    }).join('');
    return `<div class="table-wrap"><table class="tbl bomb"><thead><tr><th>Part</th><th class="num">Qty</th><th class="num">A$ inc GST</th><th>Lead time</th><th>Where</th></tr></thead><tbody>${body}</tbody>
      <tfoot><tr class="grand"><th>Total</th><td></td><td class="num">${range(R.total.lo, R.total.hi)}</td><td colspan="2" class="small">In hand in about ${R.likely <= 7 ? R.likely + ' days' : wk(R.likely)} if everything is in stock; longest wait <b>${esc(R.longest ? R.longest.name : '—')}</b> (${esc(days(R.longest && R.longest.lead.d))}).</td></tr></tfoot></table></div>
      <p class="small dim">Labour, installation and running costs (SIM, Starlink plan) are not included — the configurator works those out. Prices checked ${esc(B.asof)}, delivery once a shop (estimates marked est.); ex-GST prices grossed up by 10%.</p>`;
  }

  function leadView(R) {
    const rows = R.rows.filter(r => r.lead && r.lead.d && r.lead.d[1] > 0).sort((a, b) => b.lead.d[1] - a.lead.d[1]);
    const max = Math.max(28, ...rows.map(r => r.lead.d[1]));
    const W = 760, rh = 22, x0 = 250, x = d => x0 + d / max * (W - x0 - 20);
    let g = '';
    for (let w = 0; w <= max; w += max > 70 ? 14 : 7) g += `<line x1="${x(w)}" x2="${x(w)}" y1="18" y2="${24 + rows.length * rh}" class="grid"/><text x="${x(w)}" y="12" class="tick">${w / 7}w</text>`;
    rows.forEach((r, i) => {
      const y = 22 + i * rh;
      g += `<text x="${x0 - 8}" y="${y + 13}" class="rowl">${esc(r.name.length > 38 ? r.name.slice(0, 36) + '…' : r.name)}</text>`;
      g += `<rect x="${x(0)}" y="${y + 4}" width="${Math.max(2, x(r.lead.d[0]) - x(0))}" height="12" rx="3" class="lead-min"/><rect x="${x(r.lead.d[0])}" y="${y + 4}" width="${Math.max(2, x(r.lead.d[1]) - x(r.lead.d[0]))}" height="12" rx="3" class="lead-max"><title>${esc(r.lead.text)}</title></rect>`;
    });
    return `<div class="diagram lead"><svg viewBox="0 0 ${W} ${30 + rows.length * rh}" role="img" aria-label="Lead time of each part">${g}</svg></div><div class="legend small"><span><i class="lg-min"></i>if it's in stock</span><span><i class="lg-max"></i>if it has to be made or shipped</span></div>`;
  }

  // Every platform with this plan, on each decoder. A bar's length is all the
  // channels together as a share of the whole computer (a busy computer; the
  // notch is the measurement alone); its colour is the verdict on both limits;
  // under each name, the busiest channel as a share of one of its cores.
  function compareView(R) {
    const W = 760, rh = 6 + B.decoders.length * 8, x0 = 190, scale = 1.5, x = u => x0 + Math.min(u, scale) / scale * (W - x0 - 20);
    let g = `<line x1="${x(1)}" x2="${x(1)}" y1="10" y2="${16 + B.platforms.length * rh}" class="full"/><text x="${x(1)}" y="8" class="tick">100%</text><line x1="${x(B.model.safe)}" x2="${x(B.model.safe)}" y1="10" y2="${16 + B.platforms.length * rh}" class="safe"/><text x="${x(B.model.safe)}" y="8" class="tick">70%</text>`;
    B.platforms.forEach((p, i) => {
      const y = 16 + i * rh, F = fitOf(p, R.load);
      // the chart's gutter is narrow: a long name loses its bracketed note here (it is in the title and on the card)
      const label = p.short.replace(/ \((not recommended|comparison only)\)$/, (m, w) => w === 'not recommended' ? ' (not rec.)' : ' (compare)');
      g += `<text x="${x0 - 8}" y="${y + 14}" class="rowl${p.id === S.platform ? ' cur' : ''}">${esc(label)}<title>${esc(p.short)}</title></text>`;
      g += `<text x="${x0 - 8}" y="${y + 28}" class="rows"${F.v.one === 'ok' ? '' : ` style="fill:var(--${F.v.one});font-weight:700"`}>one channel: ${pc(F.cu)}% of a core<title>${esc(p.short)}: the busiest channel needs ${pc(F.cu)}% of one of its ${cores(p)} cores on the decoder you picked. A channel cannot use more than one core.</title></text>`;
      B.decoders.forEach((d, j) => {
        const Ld = load(R.plan, Object.assign({}, S, { decoder: d.id })), Fd = fitOf(p, Ld);
        const yb = y + 3 + j * 8;
        g += `<rect x="${x0}" y="${yb}" width="${Math.max(1, x(Fd.u) - x0)}" height="7" class="cmp d${j} ${Fd.v.cls}"><title>${esc(p.short)}, ${esc(d.name)}: all the channels ${pcs(Fd.uLow, Fd.u)} of the computer; the busiest channel ${pc(Fd.cu)}% of one core</title></rect>`;
        if (x(Fd.u) - x(Fd.uLow) > 3 && x(Fd.uLow) - x0 > 2) g += `<line x1="${x(Fd.uLow)}" x2="${x(Fd.uLow)}" y1="${yb}" y2="${yb + 7}" style="stroke:var(--panel);stroke-width:1.5"/>`;
      });
    });
    return `<div class="diagram cmpd"><svg viewBox="0 0 ${W} ${24 + B.platforms.length * rh}" role="img" aria-label="CPU each computer would use for this plan">${g}</svg></div><p class="small dim">"(not rec.)" is not recommended and "(compare)" is for comparison only: the hardware review's verdicts on those computers.</p><div class="legend small">${B.decoders.map((d, j) => `<span title="${esc(d.name)}"><i class="lg-d${j}"></i>${esc(d.short)}${d.status === 'checking' ? ' <span class="dim">(being checked)</span>' : ''}</span>`).join('')}<span class="dim">bars past 150% are cut off</span></div>
      <p class="small dim">A bar's length is all the channels together as a share of ${term('whole')}, on a ${term('busy')}; the notch in it is the measurement alone. Its colour is the verdict on both limits: green fits, amber is over 70% on one of them, red is over 100% — so a short bar can still be red when one channel is too much for ${term('onecore')}. Under each name is that one-core share on the decoder you picked.</p>`;
  }

  // ── the system diagram's explanations ──
  const NODES = {
    field: ['Field stations', 'Rain and river gauges send each reading as a short VHF burst — ALERT (300-baud tones, a third of a second) or ALERT2 (4,800 bit/s in its own time slot). Many pass through hilltop repeaters first.'],
    antenna: ['Antenna, coax and arrestor', 'A vertical VHF antenna as high and clear as the mast allows, low-loss coax (LMR-400) to the box, and a gas-tube arrestor where the coax comes in, bonded to the earth stake. With more than one stick a splitter shares the antenna.'],
    sdr: ['RTL-SDR sticks', 'Each stick hands the computer a slice of the band — its window, 240 kHz to 2.4 MHz wide — as a stream of 8-bit samples over USB. It does no decoding itself: every channel in the window is decoded in software, which is why the window\'s width matters so much to the CPU.'],
    rtl: ['rtl_sdr', 'The standard librtlsdr program, one per stick, run by the agent (<code>agent/lib/devices/sdr.js</code>). The agent tells sticks apart by USB port, tunes each so no channel sits on the DC spike or a mirror image, and restarts <code>rtl_sdr</code> if it stalls.'],
    worker: ['A decoder thread per channel', '<code>agent/lib/devices/sdr-worker.js</code> runs Flood-Net\'s own decoder, <code>alert-dsp.js</code> — vendored verbatim, so a burst decodes on the box exactly as it does on floodwarning.net. It mixes the channel down, filters, gates on the burst, then tries 45 carrier and timing combinations. A burst the older-ALERT decoder cannot read is tried as ALERT2 AirLink (<code>alert2-air.js</code>). This is where the CPU goes, and each channel has one thread: it works on one processor core and can never use more. Three savings, at three stages. Done: filtering once per carrier guess, the default since RPi ALERT 0.17, decodes a burst in a third of the time. Built, but off by default: filtering a channel only around a burst — 4 to 14 times less work between bursts, but its first live check missed some of the weakest bursts. Planned: reading a frame as ALERT2 straight away on a channel known to carry it.'],
    agent: ['The agent', '<code>agent/lib/agent.js</code>: gathers readings and receptions from every receiver (sticks, Quansheng radios, an ELPRO ERT-A2, GPS), serves the dashboard on <code>http://rpi-alert.local/</code>, and plays chirps.'],
    queue: ['The disk queue', '<code>agent/lib/spool.js</code>: every reading goes to disk first, and is sent and deleted later. No internet for days? It waits, bounded by the card (1 GB by default). No clock yet? Held until NTP, a GPS or a battery clock gives the time.'],
    uplink: ['Uplink', '<code>agent/lib/uplink.js</code> posts batches over HTTPS to Flood-Net\'s <code>ingest_http</code>, with the box\'s own ingest token; describes each receiver with <code>report_ingest_point</code> and every frame with <code>report_receptions</code>. Out only: no port is ever opened to the box.'],
    net: ['Backhaul', 'Ethernet to the site\'s network, a 4G router, Starlink or Wi-Fi. Anything that reaches the internet over HTTPS will do; outages are covered by the queue.'],
    floodnet: ['Flood-Net', 'Takes the readings into its database and shows them on the map, the Message Log (with frequency, signal and SNR), the Reception Map and Station Health — where every station\'s transmitter is measured against the rest from the carrier offsets the box reports.'],
    manage: ['Managed from Flood-Net', 'Once a minute the box checks in with Flood-Net\'s Base Stations tab: its health, a spectrum row from each stick, and any settings change, restart or update an administrator has queued. The box asks; Flood-Net never connects in.'],
  };

  // ── events ──
  function onChange(e) {
    const el = e.target;
    if (el.name === 'ch') {
      const f = Number(el.value);
      S.channels = el.checked ? [...new Set([...S.channels, f])] : S.channels.filter(x => x !== f);
      S.a2 = Math.min(Number(S.a2) || 0, S.channels.length);
    } else if (el.name === 'platform') S.platform = el.value;
    else if (['kiosk', 'arrestor', 'gps', 'a2skip'].includes(el.name)) S[el.name] = el.checked;
    else if (el.name === 'a2') S.a2 = Math.max(0, Math.round(Number(el.value) || 0));
    else if (el.name === 'coaxM') S.coaxM = Math.max(1, Math.min(100, Number(el.value) || 15));
    else if (el.name === 'sdr') { S.sdr = el.value; const sd = pick(B.sdrs, el.value); S.mount = (B.mounts.find(m => m.for.includes(sd.mount) && m.def) || B.mounts.find(m => m.for.includes(sd.mount))).id; }
    else if (el.name && el.name in S) S[el.name] = el.value;
    else return;
    render();
  }
  function onClick(e) {
    const b = e.target.closest('[data-act], [data-node]');
    if (!b) return;
    if (b.dataset.node) {
      const n = NODES[b.dataset.node];
      document.querySelectorAll('.sys [data-node]').forEach(x => x.classList.toggle('on', x === b));
      $('#sys-detail').innerHTML = `<h3>${esc(n[0])}</h3><p>${n[1]}</p>`;
      return;
    }
    const act = b.dataset.act;
    if (act === 'addch') {
      const v = Number($('#addch').value);
      if (v >= 136 && v <= 174) { S.channels = [...new Set([...S.channels, Math.round(v * 10000) / 10000])]; render(); }
    } else if (act === 'share') {
      const link = shareLink();
      (navigator.clipboard ? navigator.clipboard.writeText(link) : Promise.reject()).then(() => toast('Link copied')).catch(() => { history.replaceState(null, '', link); toast('Link is in the address bar'); });
    } else if (act === 'reset') { S = Object.assign({}, DEFAULT); render(); }
    else if (act === 'theme') cycleTheme();
  }
  function onKey(e) {
    const b = e.target.closest('[data-node]');
    if (b && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); b.dispatchEvent(new MouseEvent('click', { bubbles: true })); }
  }
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

  // A board of your own: the review's estimates as a table, and under it each
  // step's note, who would do it and where the figure comes from.
  function customView() {
    const rows = B.custom;
    const est = '<span class="chip st-warn" title="An estimate: a price or a time with no quote or published figure behind it.">est.</span>';
    const cost = r => r.aud[1] ? `${esc(range(r.aud[0], r.aud[1]))}${r.gst === false ? ' before GST' : ''} ${est}` : 'no design cost';
    const time = r => r.lead.d[1] ? `${esc(r.lead.text)} ${est}` : `<span class="dim">${esc(r.lead.text)}</span>`;
    $('#custom-chart').innerHTML = `<div class="table-wrap"><table class="tbl stk"><thead><tr><th>Step</th><th>What it might cost</th><th>How long</th></tr></thead><tbody>${rows.map(r => `<tr${r.id === 'total' ? ' class="grand"' : ''}><th scope="row">${esc(r.name)}</th><td data-l="What it might cost">${cost(r)}</td><td data-l="How long">${time(r)}</td></tr>`).join('')}</tbody></table></div>`;
    const links = list => list.map(([t, u]) => `<a href="${esc(u)}" target="_blank" rel="noopener">${esc(t)}</a>`).join(', ');
    $('#custom-list').innerHTML = rows.map(r => `<li><b>${esc(r.name)}.</b> ${mark(esc(r.note))}${r.where && r.where.length ? ` Who or where: ${links(r.where)}.` : ''}${r.src.length ? ` From: ${links(r.src)}.` : ''}</li>`).join('');
  }

  // The same meanings the hovers give, where a finger or a keyboard can read them:
  // the CPU box's own words under it, and every other word under the page.
  function terms() {
    const el = $('#cpu-terms');
    if (el) el.innerHTML = Object.values(TERMS).map(([w, m]) => `<li><b>${esc(w.charAt(0).toUpperCase() + w.slice(1))}</b> — ${esc(m)}</li>`).join('');
    const all = $('#page-terms');
    if (all) all.innerHTML = WORDS.map(RT).filter(Boolean).map(t => `<li><b>${esc(t.term)}</b> — ${esc(t.meaning)}</li>`).join('') || '<li>The list could not be loaded.</li>';
  }

  function sources() {
    const seen = new Map();
    const add = ([t, u]) => { if (u && !seen.has(u)) seen.set(u, t); };
    const scan = x => { (x.src || []).forEach(add); const it = x.ref && item(x.ref); if (it) (it.src || []).forEach(add); };
    [...B.platforms, ...B.sdrs, ...B.mounts, ...B.antennas, ...Object.values(B.rf), ...B.power, ...B.backhaul, ...B.enclosures, B.gps, ...B.custom].forEach(scan);
    B.model.src.forEach(add);
    $('#sources').innerHTML = [...seen].map(([u, t]) => `<li><a href="${esc(u)}" target="_blank" rel="noopener">${esc(t)}</a></li>`).join('');
  }

  document.addEventListener('DOMContentLoaded', () => {
    document.addEventListener('change', onChange);
    document.addEventListener('click', onClick);
    document.addEventListener('keydown', onKey);
    render();
    customView();
    terms();
    sources();
    $('.sys [data-node="worker"]').dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
})();
