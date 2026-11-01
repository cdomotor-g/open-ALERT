// open-ALERT — the base-station builder.
//
// The first half is plain functions (also loaded by the tests under Node):
// how a set of channels splits across sticks, what that costs a computer's CPU,
// the bill of materials with price ranges and lead times, and the build steps.
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
    return w && g.length <= B.model.maxPerStick ? { w, cost: g.length * w.rel } : null;
  };
  // Split the channels into exactly k sticks, each a run of neighbouring
  // channels, so the decoding (channels × the window's relative cost) is least.
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
  // Bursts a channel a minute, counting every burst heard — one that decodes,
  // one that doesn't, a repeater's copy. The Brisbane base, which hears stations
  // across the region, runs near 'heavy' and filled a Pi 4 at eight channels.
  const TRAFFIC = { quiet: 2, busy: 8, heavy: 20 };
  // Pi 4 cores the plan needs on today's (or a planned) decoder.
  function load(plan, o) {
    const M = B.model;
    const dec = B.decoders.find(d => d.id === (o.decoder || 'today')) || B.decoders[0];
    const bpm = TRAFFIC[o.traffic] || TRAFFIC.busy;
    let cont = 0, burst = 0, ch = 0;
    for (const s of plan.sticks || []) {
      for (let i = 0; i < s.chans.length; i++) {
        cont += M.chCore240 * s.window.rel * dec.cont;
        burst += bpm / 60 * M.burstCoreS * dec.burst;
        ch++;
      }
    }
    const kiosk = o.kiosk ? M.kioskCore : 0;
    return { cont, burst, kiosk, total: cont + burst + kiosk, channels: ch, memMb: ch * M.mbPerChannel };
  }
  // What the platform has, in Pi 4 cores (the catalogue's channels at 960 kHz ÷ 2).
  const capacity = p => { const it = item(p.ref); return it && it.hw && it.hw.sdrCh ? it.hw.sdrCh / 2 : 0; };
  function verdict(use) {
    if (use <= 0.5) return { cls: 'ok', text: 'Plenty of headroom' };
    if (use <= B.model.safe) return { cls: 'ok', text: 'Comfortable' };
    if (use <= 1) return { cls: 'warn', text: 'At the edge — in a storm decoders fall behind and bursts are dropped' };
    return { cls: 'bad', text: 'Overloaded — channels will drop samples and lose bursts' };
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
    const cap = capacity(P);
    const use = cap ? L.total / cap : Infinity;
    const host = item(P.ref) || {};
    const warn = [];
    const rows = [];

    // the computer
    rows.push(row('Computer', P, 1));
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
    if (S.decoder && S.decoder !== 'today') warn.push(['info', `The CPU figures assume the ${S.decoder === 'wasm' ? 'shared front end and WebAssembly decoder' : 'shared front end'} — planned, not built yet. Today's decoder: ${Math.round(load(plan, Object.assign({}, S, { decoder: 'today' })).total / (capacity(P) || 1) * 100)}% of this computer's CPU.`]);
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
    if (pw.id === 'mains-plug' && (P.supply === 'wide' || P.supply === '24v')) pwr = Object.assign({}, pw, { aud: [35, 90], name: `Mains: a ${P.supply === '24v' ? '24' : '12'} V DIN-rail supply`, ref: 'meanwell-hdr-30-12', note: `${P.short} takes DC on terminals: a Mean Well HDR-series supply${P.supply === '24v' ? ' (24 V model)' : ''}.` });
    if (pw.id === 'dc12') {
      if (P.supply === 'wide') pwr = Object.assign({}, pw, { aud: [0, 0], note: `${P.short} takes 12 V straight onto its terminals — just a fuse.` });
      else if (P.supply === '24v') { pwr = Object.assign({}, pw, { aud: [60, 120], name: '12 → 24 V DC-DC converter', ref: null, note: 'The RevPi Connect 5 is a 24 V device: a step-up converter from a 12 V battery (an estimate; check its input range).', conf: 'low' }); warn.push(['info', 'The RevPi Connect 5 is built for 24 V cabinets: on 12 V it needs a step-up converter.']); }
      else if (P.supply === 'mains') { pwr = Object.assign({}, pw, { aud: [40, 90], name: '12 → 19 V DC-DC converter for the mini PC', ref: null, note: 'Mini PCs want 12–19 V from a brick; a car-PC style converter, an estimate.', conf: 'low' }); warn.push(['warn', 'A mini PC on a battery draws 8–25 W around the clock: size the battery and panel for it (the configurator\'s power budget does this).']); }
      else if (P.supply === '5v5a') pwr = Object.assign({}, pw, { name: 'Mean Well DDR-30G-5 (9–36 V in, 5 V 6 A)', ref: 'meanwell-ddr-30g-5', aud: [70, 100] });
    }
    if (pw.id === 'dcups' && P.supply === 'mains') warn.push(['warn', 'A DC UPS feeds 12 V and 5 V computers; a mini PC wants an ordinary UPS (or the 12 → 19 V converter).']);
    rows.push(row('Power', pwr, 1));

    // backhaul
    rows.push(row('Backhaul', bh, 1));
    if (bh.needsWifi && !P.wifi) warn.push(['bad', `${P.short} has no Wi-Fi: use Ethernet, or a module with Wi-Fi.`]);
    if (bh.id === 'rut241') rows.push(row('Backhaul', { id: 'iot-sim', ref: 'iot-sim-10mb', name: 'IoT SIM (first month; then A$5–15 a month)', aud: [5, 15], gst: true, lead: { d: [1, 5], text: 'Telstra, Optus or Vodafone business IoT' }, where: [], conf: 'low' }, 1));

    // the box
    rows.push(row('Enclosure', enc, 1));
    if (!enc.indoor) rows.push(row('Enclosure', { id: 'enclosure-fittings', ref: 'enclosure-fittings', aud: [60, 110], gst: true, lead: { d: [2, 7], text: 'electrical wholesalers' }, where: [['Electrical wholesalers', 'https://www.middys.com.au/']], conf: 'low' }, 1));
    const tmax = host.temp ? host.temp[1] : null;
    if (tmax != null && enc.temp != null && tmax - 10 < enc.temp) warn.push([tmax < enc.temp ? 'bad' : 'warn', `${P.short} is rated to ${tmax} °C; ${enc.indoor ? 'a room' : 'a cabinet in a hut'} can reach about ${enc.temp} °C — ${tmax < enc.temp ? 'too hot' : 'little margin'}. Shade, vent it, or pick a computer rated −20/−40 to +85 °C.`]);

    if (S.gps) rows.push(row('Extras', B.gps, 1));
    rows.push(row('Software', { id: 'rpi-alert', ref: 'rpi-alert', name: 'RPi ALERT (MIT) and a Flood-Net ingest token', aud: [0, 0], gst: true, lead: { d: [0, 1], text: 'download; the token is approved by a Flood-Net administrator in minutes' }, where: [['RPi ALERT on GitHub', 'https://github.com/cdomotor-g/RPi_ALERT']], note: 'Free. The Pi asks for its token; an administrator approves it from a phone.', conf: 'high' }, 1));

    // CPU and memory
    if (host.hw && host.hw.ram && L.memMb + (S.kiosk ? 400 : 0) > host.hw.ram * 1024 * 0.7) warn.push(['warn', `${L.channels} channels take about ${L.memMb} MB${S.kiosk ? ' and the screen dashboard about 400 MB' : ''}: tight on ${host.hw.ram} GB.`]);
    if (plan.error) warn.push(['bad', plan.error]);
    if (plan.capped) warn.push(['info', `These channels need at least ${plan.minK} sticks; planned on ${plan.minK}.`]);

    // totals
    const lines = rows.map(r => Object.assign(r, { tlo: r.lo == null ? null : r.lo * r.qty, thi: r.hi == null ? null : r.hi * r.qty }));
    const total = { lo: lines.reduce((s, r) => s + (r.tlo || 0), 0), hi: lines.reduce((s, r) => s + (r.thi || 0), 0) };
    const longest = lines.filter(r => r.lead && r.lead.d).sort((a, b) => b.lead.d[1] - a.lead.d[1])[0];
    const likely = lines.filter(r => r.lead && r.lead.d).reduce((m, r) => Math.max(m, r.lead.d[0]), 0);

    return { S, P, host, plan, sdr, mount, ant, pw: pwr, bh, enc, load: L, cap, use, verdict: verdict(use), rows: lines, total, longest, likely, warn, steps: steps(S, P, plan, sdr, mount, bh, enc, pwr) };
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
      verdin: ['Write the eMMC with Toradex Easy Installer (boot the module into recovery mode, connect USB) and choose Torizon OS.', 'Run the agent in a Debian container with the USB bus passed through, and RPi ALERT\'s <code>os/install.sh</code> inside it — or build a Yocto image with Node.js 18+ and <code>rtl-sdr</code>. Untested: this is the first port off the Pi; record what it takes.'],
      debian: ['Install Debian 13 (Trixie) from a USB stick: no desktop needed.', 'Then <code>sudo apt install git</code>, <code>git clone https://github.com/cdomotor-g/RPi_ALERT</code>, <code>sudo ./RPi_ALERT/os/install.sh</code>. The installer is plain Debian (apt, systemd, udev) but has only been run on Raspberry Pi OS: the Pi-only parts (under-voltage, boot partition settings) do nothing here.'],
    }[P.install];
    out.push({ h: 'Bench build', items: [
      ...flash,
      'Plug in one stick at a time and give each a serial of its own while the agent is stopped: <code>sudo systemctl stop rpi-alert; rtl_eeprom -s ALERT1</code> (letters, not a bare number), then unplug and replug it. Then the agent knows each stick wherever it is plugged.',
      `Set each stick's channels on the dashboard (Settings → RTL-SDR) or over SSH:<br>${freqArgs.map(a => `<code>${a}</code>`).join('<br>') || '—'}`,
      'Open <code>http://rpi-alert.local/</code> (or the box\'s screen), press <b>Request a token</b>, check the code and approve it on Flood-Net\'s <b>Admin</b> tab from your phone. Readings start within seconds.',
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
      'On the box: the Overview shows each stick, its channels and bursts decoded; no under-voltage banner; the CPU and temperature steady.',
      'On Flood-Net: the base appears on the <b>Base Stations</b> tab (it checks in every minute — Flood-Net never connects in), its readings in the <b>Message Log</b> with frequency, signal and SNR, its frames on the <b>Reception Map</b>.',
      'Pull the network for ten minutes and put it back: the readings held in the disk queue arrive, stamped with when they were heard.',
    ] });
    out.push({ h: 'Keep it going', items: [
      'Updates and settings from Flood-Net\'s Base Stations tab; SSH keys only, the <code>alert</code> account, never a shared password.',
      'Once a year: look at the arrestor and earth bond, the glands and desiccant, and compare the sticks\' SNR on a shared channel — swap a stick that has gone deaf.',
    ] });
    return out;
  }

  const API = { B, setCatalog, windowFor, splitInto, planSticks, load, capacity, verdict, build, TRAFFIC };
  if (isNode) { module.exports = API; return; }

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
    decoder: 'today', traffic: 'busy', kiosk: false, sdr: 'rtl-sdr-blog-v4', mount: 'ext-clamp',
    antenna: 'rfi-col54', coaxM: 15, arrestor: true, power: 'mains-plug', backhaul: 'lan', enclosure: 'fibox', gps: false,
  };
  let S = load0();
  function load0() {
    let s = null;
    const m = location.hash.match(/#b=([A-Za-z0-9_-]+)/);
    if (m) { try { s = JSON.parse(decodeURIComponent(escape(atob(m[1].replace(/-/g, '+').replace(/_/g, '/'))))); } catch (e) { s = null; } }
    if (!s) { try { s = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { s = null; } }
    return Object.assign({}, DEFAULT, s || {});
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* private mode */ } }
  function shareLink() {
    const b = btoa(unescape(encodeURIComponent(JSON.stringify(S)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    return location.href.split('#')[0] + '#b=' + b;
  }

  // ── controls ──
  const opt = (list, cur, label) => list.map(x => `<option value="${esc(x.id)}"${x.id === cur ? ' selected' : ''}>${esc(label ? label(x) : nameOf(x))}</option>`).join('');
  function controls() {
    const R = build(S);
    const pf = B.platforms.map(p => {
      const it = item(p.ref) || {};
      const cap = capacity(p), u = cap ? R.load.total / cap : Infinity, v = verdict(u);
      return `<label class="pf${p.id === S.platform ? ' on' : ''}"><input type="radio" name="platform" value="${esc(p.id)}"${p.id === S.platform ? ' checked' : ''}>
        <span class="pf-top"><b>${esc(p.short)}</b><span class="chip plain">${esc({ board: 'board', module: 'module + carrier', box: 'boxed' }[p.kind])}</span></span>
        <span class="pf-bar" title="This plan would use ${Math.round(u * 100)}% of its CPU"><i class="${v.cls}" style="width:${Math.min(100, u * 100).toFixed(0)}%"></i></span>
        <span class="small dim">${Math.round(u * 100)}% CPU · ${range(incGst(p.aud[0], p.gst), incGst(p.aud[1], p.gst))} · ${days(p.lead.d)}</span>
        <span class="chips">${it.temp ? `<span class="chip plain">${it.temp[0]} to ${it.temp[1]} °C</span>` : ''}<span class="chip ${it.open && it.open.hw === 'open' ? 'open' : it.open && it.open.hw === 'partial' ? 'partial' : 'closed'}">hardware ${esc((it.open && it.open.hw) || 'closed')}</span>${it.hw && it.hw.storage === 'emmc' ? '<span class="chip open">eMMC</span>' : ''}${it.hw && it.hw.storage === 'sd' ? '<span class="chip partial">SD card</span>' : ''}</span>
      </label>`;
    }).join('');
    const chs = [...new Set([...B.channels.map(c => c.mhz), ...S.channels])].sort((a, b) => a - b).map(f => {
      const c = B.channels.find(x => x.mhz === f);
      return `<label class="chk"><input type="checkbox" name="ch" value="${f}"${S.channels.includes(f) ? ' checked' : ''}> ${f.toFixed(4).replace(/0+$/, '').replace(/\.$/, '')} <span class="dim small">${esc(c ? c.note : 'yours')}</span></label>`;
    }).join('');
    const mounts = B.mounts.filter(m => m.for.includes(R.sdr.mount));
    $('#controls').innerHTML = `
      <fieldset><legend>1 · The computer</legend><div class="pfs">${pf}</div>
        <p class="small dim" id="pf-fit">${esc(R.P.fit)}</p></fieldset>
      <fieldset><legend>2 · Channels to hear</legend><div class="chks">${chs}</div>
        <div class="row"><label>Add a channel (MHz) <input type="number" id="addch" step="0.0125" min="136" max="174" placeholder="151.4375" inputmode="decimal"></label><button type="button" class="ghost small" data-act="addch">Add</button></div>
        <div class="row"><label>Sticks <select name="sticks"><option value="auto"${S.sticks === 'auto' ? ' selected' : ''}>Fewest that hold them</option>${[1, 2, 3, 4].map(k => `<option value="${k}"${String(S.sticks) === String(k) ? ' selected' : ''}>${k}</option>`).join('')}</select></label>
        <label>Traffic to plan for <select name="traffic"><option value="quiet"${S.traffic === 'quiet' ? ' selected' : ''}>Quiet (2 bursts a minute a channel)</option><option value="busy"${S.traffic === 'busy' ? ' selected' : ''}>Busy (8) — rain on a big network</option><option value="heavy"${S.traffic === 'heavy' ? ' selected' : ''}>Heavy (20) — a storm, or a site that hears a whole region</option></select></label></div>
        <div class="row"><label>Decoder <select name="decoder">${opt(B.decoders, S.decoder)}</select></label>
        <label class="chk"><input type="checkbox" name="kiosk"${S.kiosk ? ' checked' : ''}> A screen on the box (dashboard)</label></div></fieldset>
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
    $('#out-cpu').innerHTML = cpuView(R);
    $('#out-sticks').innerHTML = sticksView(R);
    $('#out-box').innerHTML = boxView(R);
    $('#out-warn').innerHTML = R.warn.length ? R.warn.map(([c, t]) => `<p class="note ${c === 'bad' ? 'bad' : ''}"><b class="${c}">${{ bad: 'Problem', warn: 'Check', info: 'Note' }[c]}:</b> ${esc(t)}</p>`).join('') : '<p class="note"><b class="ok">Fits:</b> nothing to flag in this build.</p>';
    $('#out-bom').innerHTML = bomView(R);
    $('#out-lead').innerHTML = leadView(R);
    $('#out-steps').innerHTML = R.steps.map(s => `<h3>${esc(s.h)}</h3><ol>${s.items.map(i => `<li>${i}</li>`).join('')}</ol>`).join('');
    $('#out-compare').innerHTML = compareView(R);
    save();
  }

  function cpuView(R) {
    const L = R.load, pct = R.use * 100, v = R.verdict;
    const seg = (x, cls, t) => `<i class="${cls}" style="width:${Math.min(100, x / R.cap * 100).toFixed(1)}%" title="${esc(t)}"></i>`;
    return `<div class="gauge-h"><b>${esc(R.P.short)}</b> · ${L.channels} channel${L.channels === 1 ? '' : 's'} on ${R.plan.sticks ? R.plan.sticks.length : 0} stick${R.plan.sticks && R.plan.sticks.length === 1 ? '' : 's'} · <span class="${v.cls}">${Math.round(pct)}% of its CPU — ${esc(v.text)}</span></div>
      <div class="gauge" role="img" aria-label="${Math.round(pct)}% of the CPU">${seg(L.cont, 'g-cont', 'Between bursts: every channel filtering its window')}${seg(L.burst, 'g-burst', 'Decoding bursts')}${seg(L.kiosk, 'g-kiosk', 'The screen dashboard')}<span class="g-safe" style="left:${B.model.safe * 100}%" title="Plan to stay under 70%"></span></div>
      <div class="legend small"><span><i class="g-cont"></i>between bursts ${L.cont.toFixed(2)}</span><span><i class="g-burst"></i>decoding bursts ${L.burst.toFixed(2)}</span>${L.kiosk ? `<span><i class="g-kiosk"></i>screen ${L.kiosk.toFixed(2)}</span>` : ''}<span class="dim">of ${R.cap.toFixed(1)} Pi 4 cores · ${L.memMb} MB for decoders</span></div>`;
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
      svg += x(mid + half) + 110 < W ? `<text x="${x(mid + half) + 6}" y="${y + 15}" class="lbl">${lab}</text>` : `<text x="${x(mid - half) - 6}" y="${y + 15}" class="lbl" text-anchor="end">${lab}</text>`;
      for (const f of s.chans) svg += `<line x1="${x(f)}" x2="${x(f)}" y1="${y + 3}" y2="${y + 19}" style="stroke:${cols[i]};stroke-width:2.5"/>`;
    });
    svg += '</svg>';
    const cost = st.reduce((a, s) => a + s.chans.length * s.window.rel, 0);
    const alt = R.plan.k < Math.min(4, all.length) ? splitInto(all, R.plan.k + 1) : null;
    const altCost = alt ? alt.reduce((a, s) => a + s.chans.length * s.window.rel, 0) : null;
    const hint = alt && altCost < cost * 0.8 ? `<p class="small">One more stick would cut the work between bursts by ${Math.round((1 - altCost / cost) * 100)}%: ${alt.map(s => (s.window.khz >= 1000 ? s.window.khz / 1000 + ' MHz' : s.window.khz + ' kHz')).join(' + ')} windows.</p>` : '';
    return `<div class="diagram band">${svg}</div><div class="table-wrap"><table class="tbl small"><thead><tr><th>Stick</th><th>Channels (MHz)</th><th class="num">Window</th><th class="num">Work between bursts</th></tr></thead><tbody>${st.map((s, i) => `<tr><td>${i + 1}</td><td>${s.chans.map(f => +f.toFixed(4)).join(', ')}</td><td class="num">${s.window.khz >= 1000 ? s.window.khz / 1000 + ' MHz' : s.window.khz + ' kHz'}</td><td class="num">${s.chans.length} × ${s.window.rel}</td></tr>`).join('')}</tbody></table></div>${hint}`;
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
    g += `<path d="M700 150 V300 H600" class="coax"/>${t(740, 235, `${S.coaxM} m`, 'bs')}${t(740, 249, 'LMR-400', 'bs')}`;
    if (S.arrestor) g += `<rect x="580" y="288" width="26" height="24" rx="3" class="arr"/>${t(593, 330, 'arrestor', 'bs')}<path d="M593 312 V360" class="earthw"/><path d="M582 360 h22 M586 365 h14 M590 370 h6" class="earthw"/>${t(625, 368, 'earth stake', 'bs')}`;
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
      <p class="small dim">Labour, installation and running costs (SIM, Starlink plan) are not included — the configurator works those out. Prices indicative, ${esc(B.asof)}; ex-GST prices grossed up by 10%.</p>`;
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

  // Every platform with this plan, today and with the planned decoders.
  function compareView(R) {
    const W = 760, rh = 30, x0 = 190, scale = 1.5, x = u => x0 + Math.min(u, scale) / scale * (W - x0 - 20);
    let g = `<line x1="${x(1)}" x2="${x(1)}" y1="10" y2="${16 + B.platforms.length * rh}" class="full"/><text x="${x(1)}" y="8" class="tick">100%</text><line x1="${x(B.model.safe)}" x2="${x(B.model.safe)}" y1="10" y2="${16 + B.platforms.length * rh}" class="safe"/><text x="${x(B.model.safe)}" y="8" class="tick">70%</text>`;
    B.platforms.forEach((p, i) => {
      const y = 16 + i * rh, cap = capacity(p);
      g += `<text x="${x0 - 8}" y="${y + 17}" class="rowl${p.id === S.platform ? ' cur' : ''}">${esc(p.short)}</text>`;
      B.decoders.forEach((d, j) => {
        const u = load(R.plan, Object.assign({}, S, { decoder: d.id })).total / cap;
        g += `<rect x="${x0}" y="${y + 3 + j * 8}" width="${Math.max(1, x(u) - x0)}" height="7" class="cmp d${j} ${verdict(u).cls}"><title>${esc(p.short)}, ${esc(d.name)}: ${Math.round(u * 100)}%</title></rect>`;
      });
    });
    return `<div class="diagram cmpd"><svg viewBox="0 0 ${W} ${24 + B.platforms.length * rh}" role="img" aria-label="CPU each computer would use for this plan">${g}</svg></div><div class="legend small"><span><i class="lg-d0"></i>today's decoder</span><span><i class="lg-d1"></i>shared front end (planned)</span><span><i class="lg-d2"></i>+ WebAssembly (planned)</span><span class="dim">bars past 150% are cut off</span></div>`;
  }

  // ── the system diagram's explanations ──
  const NODES = {
    field: ['Field stations', 'Rain and river gauges send each reading as a short VHF burst — ALERT (300-baud tones, a third of a second) or ALERT2 (4,800 bit/s in its own time slot). Many pass through hilltop repeaters first.'],
    antenna: ['Antenna, coax and arrestor', 'A vertical VHF antenna as high and clear as the mast allows, low-loss coax (LMR-400) to the box, and a gas-tube arrestor where the coax comes in, bonded to the earth stake. With more than one stick a splitter shares the antenna.'],
    sdr: ['RTL-SDR sticks', 'Each stick hands the computer a slice of the band — its window, 240 kHz to 2.4 MHz wide — as a stream of 8-bit samples over USB. It does no decoding itself: every channel in the window is decoded in software, which is why the window\'s width matters so much to the CPU.'],
    rtl: ['rtl_sdr', 'The standard librtlsdr program, one per stick, run by the agent (<code>agent/lib/devices/sdr.js</code>). The agent tells sticks apart by USB port, tunes each so no channel sits on the DC spike or a mirror image, and restarts <code>rtl_sdr</code> if it stalls.'],
    worker: ['A decoder thread per channel', '<code>agent/lib/devices/sdr-worker.js</code> runs Flood-Net\'s own decoder, <code>alert-dsp.js</code> — vendored verbatim, so a burst decodes on the box exactly as it does on floodwarning.net. It mixes the channel down, filters, gates on the burst, then tries 45 carrier and timing combinations. A burst nothing legacy reads is tried as ALERT2 AirLink (<code>alert2-air.js</code>). This is where the CPU goes: the planned shared front end and WebAssembly target exactly these loops.'],
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
    } else if (el.name === 'platform') S.platform = el.value;
    else if (['kiosk', 'arrestor', 'gps'].includes(el.name)) S[el.name] = el.checked;
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

  function customView() {
    const rows = B.custom;
    const W = 760, rh = 34, x0 = 300, max = Math.max(...rows.map(r => r.lead.d[1])), x = d => x0 + d / max * (W - x0 - 20);
    let g = '';
    for (let m = 0; m <= max; m += 30) g += `<line x1="${x(m)}" x2="${x(m)}" y1="14" y2="${18 + rows.length * rh}" class="grid"/><text x="${x(m)}" y="10" class="tick">${m / 30}mo</text>`;
    rows.forEach((r, i) => {
      const y = 16 + i * rh;
      g += `<text x="${x0 - 8}" y="${y + 13}" class="rowl">${esc(r.name.length > 46 ? r.name.slice(0, 44) + '…' : r.name)}</text><text x="${x0 - 8}" y="${y + 27}" class="rows">${r.aud[1] ? esc(range(r.aud[0], r.aud[1])) + ' ex GST' : 'no hardware cost'}</text>`;
      g += `<rect x="${x(0)}" y="${y + 6}" width="${x(r.lead.d[0]) - x(0)}" height="14" rx="3" class="lead-min"/><rect x="${x(r.lead.d[0])}" y="${y + 6}" width="${Math.max(2, x(r.lead.d[1]) - x(r.lead.d[0]))}" height="14" rx="3" class="lead-max"/>`;
    });
    $('#custom-chart').innerHTML = `<div class="diagram lead"><svg viewBox="0 0 ${W} ${24 + rows.length * rh}" role="img" aria-label="Time and cost of each step of the custom path">${g}</svg></div>`;
    $('#custom-list').innerHTML = rows.map(r => `<li><b>${esc(r.name)}</b> — ${r.aud[1] ? esc(range(r.aud[0], r.aud[1])) + ' ex GST, ' : ''}${esc(days(r.lead.d))}. ${esc(r.note)}${r.src.length ? ' ' + r.src.map(([t, u]) => `<a href="${esc(u)}" target="_blank" rel="noopener">${esc(t)}</a>`).join(', ') : ''} <span class="chip st-warn">estimate</span></li>`).join('');
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
    sources();
    $('.sys [data-node="worker"]').dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
})();
