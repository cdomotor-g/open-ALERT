// open-ALERT — tests for the base-station builder: its data, the stick
// planner and the CPU model against what RPi ALERT's docs and the hardware
// review (docs/hardware-review/research/U2 and R9) say — the whole computer
// and each channel on its one core — and that every combination of choices
// builds a bill without a gap.

'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const SITE = path.join(__dirname, '..', 'site');
const FILES = ['alert', 'compute', 'radio', 'sensors', 'power', 'site'];
const CATALOG = [].concat(...FILES.map(f => require(path.join(SITE, 'data', `${f}.js`))));
const K = require(path.join(SITE, 'js', 'builder.js'));
K.setCatalog(CATALOG);
const B = K.B;
const ids = new Set(CATALOG.map(x => x.id));

const options = () => [...B.platforms, ...B.sdrs, ...B.mounts, ...B.antennas, ...Object.values(B.rf), ...B.power, ...B.backhaul, ...B.enclosures, B.gps, ...B.custom];

test('every builder option is well formed and its references resolve', () => {
  for (const o of options()) {
    const where = o.id || o.ref;
    assert.ok(where, 'an option without an id or ref');
    if (o.ref) assert.ok(ids.has(o.ref), `${where}: no catalogue part ${o.ref}`);
    assert.ok(Array.isArray(o.aud) && o.aud.length === 2, `${where}.aud`);
    assert.ok(o.aud[0] === null || (o.aud[0] >= 0 && o.aud[0] <= o.aud[1]), `${where}.aud is not a low–high range`);
    assert.equal(typeof o.gst, 'boolean', `${where}.gst`);
    assert.ok(o.lead && Array.isArray(o.lead.d) && o.lead.d[0] <= o.lead.d[1] && typeof o.lead.text === 'string', `${where}.lead`);
    assert.ok(Array.isArray(o.where), `${where}.where`);
    for (const w of [...o.where, ...(o.src || [])]) assert.match(w[1], /^https?:\/\//, `${where}: ${w[1]}`);
    assert.ok(['high', 'medium', 'low'].includes(o.conf), `${where}.conf`);
    // a figure with no source of its own is an estimate, and says so
    if (!(o.src || []).length && !o.ref && o.aud[1] > 0) assert.equal(o.conf, 'low', `${where}: unsourced figures must be conf 'low'`);
  }
  for (const p of B.platforms) {
    const it = CATALOG.find(x => x.id === p.ref);
    assert.ok(it.hw && it.hw.sdrCh > 0, `${p.id}: the catalogue gives no SDR capacity`);
    assert.ok(['pi', 'cm', 'verdin', 'luna', 'debian', 'package'].includes(p.install), `${p.id}.install`);
    // a channel is decoded on one core, so every computer needs a number of cores and a one-core speed
    const n = K.cores(p);
    assert.ok(Number.isInteger(n) && n >= 1 && n <= 64, `${p.id}: ${n} cores`);
    // ... its capacity divided by its cores, unless the review gives one core's speed apart from the whole (`hw.core`)
    if (it.hw.core > 0) assert.equal(K.oneCore(p), it.hw.core, `${p.id}: its one-core speed is the catalogue's own figure`);
    else assert.ok(K.oneCore(p) > 0 && Math.abs(K.oneCore(p) * n - K.capacity(p)) < 1e-9, `${p.id}: its one-core speed is its capacity divided by its cores`);
  }
});

test('every shop the builder buys from has its delivery charge, and the bill charges each once', () => {
  for (const [name, sh] of Object.entries(B.shops)) {
    assert.ok(Array.isArray(sh.ship) && sh.ship.length === 2 && sh.ship[0] >= 0 && sh.ship[0] <= sh.ship[1], `${name}.ship`);
    assert.match(sh.from, /^[A-Z]{2}$/, `${name}.from`);
    if (sh.freeOver != null) assert.ok(sh.freeOver > 0, `${name}.freeOver`);
    assert.ok(Array.isArray(sh.src), `${name}.src`);
    for (const [, u] of sh.src) assert.match(u, /^https?:\/\//, `${name}.src`);
    if (!sh.src.length) assert.equal(sh.conf, 'low', `${name}: an unsourced delivery charge is an estimate`);
  }
  for (const platform of B.platforms) {
    const R = K.build({ platform: platform.id, channels: [151.5, 151.525, 151.95, 152.4], sticks: 'auto', decoder: 'filter-once', traffic: 'busy', kiosk: false,
      sdr: 'rtl-sdr-blog-v4', mount: 'ext-clamp', antenna: 'rfi-col54', coaxM: 20, arrestor: true, power: 'dc12', backhaul: 'lan', enclosure: 'fibox', gps: false });
    const del = R.rows.filter(r => r.section === 'Delivery');
    assert.equal(new Set(del.map(r => r.name)).size, del.length, `${platform.id}: a shop delivers twice`);
    for (const r of del) assert.ok(r.lo >= 0 && r.lo <= r.hi, `${platform.id}: ${r.name}`);
  }
});

test('a stick takes the narrowest window that holds its channels, as RPi ALERT does', () => {
  // Flood-Net's four channels: one stick, 1.44 MHz (hardware.md)
  const four = K.planSticks([151.5, 151.525, 151.95, 152.4], 'auto');
  assert.equal(four.sticks.length, 1);
  assert.equal(four.sticks[0].window.khz, 1440);
  // the Brisbane base's split, 151.425–151.5375 and 151.95–152.4625: 960 kHz each
  assert.equal(K.windowFor(151.5375 - 151.425).khz, 960);
  assert.equal(K.windowFor(152.4625 - 151.95).khz, 960);
  // and the planner never does worse than that split (it finds 151.425–151.95
  // in 960 kHz plus 152.4–152.4625 in 240 kHz: less work for the same sticks)
  const seven = [151.425, 151.5, 151.525, 151.5375, 151.95, 152.4, 152.4625];
  const two = K.planSticks(seven, 2);
  const work = st => st.reduce((a, s) => a + s.chans.length * s.window.rel, 0);
  assert.equal(two.sticks.length, 2);
  assert.ok(work(two.sticks) <= 4 * 3 + 3 * 3);
  // the same in Pi 4 cores, which is what the planner now keeps least
  const pi4Work = st => st.reduce((a, s) => a + s.chans.length * s.window.pi4, 0);
  assert.ok(pi4Work(two.sticks) <= 7 * B.model.windows.find(w => w.khz === 960).pi4 + 1e-9);
  // channels within 162 kHz fit 240 kHz less the tuning margin
  assert.equal(K.windowFor(0.1).khz, 240);
  assert.equal(K.windowFor(2.0), null);
  // never more than 8 a stick
  const nine = Array.from({ length: 9 }, (_, i) => 151.4 + i * 0.0125);
  assert.ok(K.planSticks(nine, 'auto').sticks.every(s => s.chans.length <= 8));
  // too far apart for four sticks
  assert.ok(K.planSticks([140, 145, 150, 155, 160], 'auto').error);
});

// ── the CPU model ───────────────────────────────────────────────────────────
const near = (got, want, tol, what) => assert.ok(Math.abs(got - want) <= tol, `${what}: ${got} is not within ${tol} of ${want}`);
const win = khz => B.model.windows.find(w => w.khz === khz);
const platform = id => B.platforms.find(p => p.id === id);
const FOUR = [151.5, 151.525, 151.95, 152.4];
const EIGHT = [151.425, 151.5, 151.5375, 151.525, 151.95, 152.4, 152.4625, 151.575];
const BUILD = { platform: 'rpi-4-4gb', channels: FOUR, sticks: 'auto', decoder: 'filter-once', traffic: 'busy', kiosk: false, a2: 0, a2traffic: 'today', a2skip: false,
  sdr: 'rtl-sdr-blog-v3', mount: 'ext-clamp', antenna: 'vhf-dipole-unity', coaxM: 15, arrestor: true, power: 'mains-plug', backhaul: 'lan', enclosure: 'fibox', gps: false };

test('between bursts the model uses RPi ALERT\'s own Raspberry Pi 4 figures, and shows the busy-computer factor as a range', () => {
  // RPi ALERT docs/roadmap.md: "the bench says 240 kHz 6%, 1.2 MHz 27%, 1.44 MHz 31% a channel"
  assert.equal(win(240).pi4, 0.06);
  assert.equal(win(1200).pi4, 0.27);
  assert.equal(win(1440).pi4, 0.31);
  for (const k of [240, 1200, 1440]) assert.equal(win(k).basis, 'bench', `${k} kHz was measured`);
  // nobody wrote down a Pi 4 figure for the others: in proportion to the docs' table, from the nearest measured window
  for (const [k, from] of [[960, 1200], [1920, 1440], [2400, 1440]]) {
    assert.equal(win(k).basis, 'scaled', `${k} kHz is worked out, and says so`);
    near(win(k).pi4, win(from).pi4 * win(k).rel / win(from).rel, 0.006, `${k} kHz in proportion`);
  }
  // a wider window never costs less
  B.model.windows.forEach((w, i, all) => { if (i) assert.ok(w.khz > all[i - 1].khz && w.pi4 > all[i - 1].pi4, `${w.khz} kHz`); });
  // "under load each decoder's busy share ran about 1.6 times that": both ends are kept, not just one
  assert.deepEqual(B.model.loadFactor, [1, 1.6]);
  const one = { sticks: [{ chans: [152.4], window: win(1200) }] };
  const quiet = K.load(one, { traffic: 'quiet' });
  near(quiet.contLow, 0.27, 1e-9, 'the bench alone');
  near(quiet.cont, 0.27 * 1.6, 1e-9, 'a busy computer');          // the docs: "152.400 alone, quiet, 0.44 in 1.2 MHz"
  near(quiet.cont, 0.44, 0.01, 'the loaded Pi 4\'s own observation');
  assert.deepEqual(quiet.range, [quiet.totalLow, quiet.total]);
  assert.ok(quiet.totalLow < quiet.total);
  // memory: about 43 MB a channel, and the agent itself on top
  assert.equal(B.model.mbPerChannel, 43);
  assert.equal(K.load(K.planSticks(FOUR, 'auto'), {}).memMb, 4 * 43);
  assert.equal(K.load(K.planSticks(FOUR, 'auto'), {}).memAllMb, 4 * 43 + B.model.mbAgent);
});

test('every decoder is costed, and an ALERT2 frame costs more than a legacy burst until the legacy try is skipped', () => {
  assert.deepEqual(B.decoders.map(d => d.id), ['today', 'filter-once', 'lean', 'light']);
  for (const d of B.decoders) {
    assert.ok(d.cont > 0 && d.cont <= 1, `${d.id}.cont`);
    assert.ok(d.burstS > 0 && d.a2S > d.burstS, `${d.id}: a frame is tried as a legacy burst first, so it costs more than one`);
    assert.ok(B.model.a2DecodeS < d.a2S, `${d.id}: skipping the legacy try must save`);
    assert.ok(['current', 'checking'].includes(d.status) && d.note.length > 40, `${d.id}`);
  }
  const lean = B.decoders.find(d => d.id === 'filter-once'), full = B.decoders.find(d => d.id === 'today'), light = B.decoders.find(d => d.id === 'light');
  // the default decoder: about 0.37 s of a Pi 4 core a legacy burst, about 0.6 s an ALERT2 frame, 0.22 s once the legacy try is skipped
  assert.equal(lean.burstS, 0.37);
  assert.equal(lean.a2S, 0.6);
  assert.equal(B.model.a2DecodeS, 0.22);
  // Lean is a third of Full (33–34% on the first base station's Pi 4), Light about half of Lean
  near(lean.burstS / full.burstS, 0.33, 0.03, 'Lean against Full');
  near(light.burstS / lean.burstS, 0.5, 0.06, 'Light against Lean');
  // the decoders that filter only around bursts are still being checked, and never a default
  for (const d of B.decoders.filter(x => x.burstFilterS)) assert.equal(d.status, 'checking', d.id);
  // asleep, such a channel costs about a quarter of filtering always at 240 kHz and a twelfth to a twentieth at 2.4 MHz
  const alone = (khz, decoder) => K.load({ sticks: [{ chans: [152.4], window: win(khz) }] }, { decoder, traffic: 'quiet' }).contLow;
  near(alone(240, 'lean') / alone(240, 'filter-once'), 0.25, 0.05, 'asleep at 240 kHz');
  assert.ok(alone(2400, 'lean') / alone(2400, 'filter-once') < 1 / 12 && alone(2400, 'lean') / alone(2400, 'filter-once') > 1 / 20, 'asleep at 2.4 MHz');
  // …and awake all the time it costs what filtering always does, never more, however busy the channel
  const four = K.planSticks([151.5, 151.525, 151.95, 152.4], 'auto');
  for (const a2traffic of ['today', 'storm', 'full']) for (const traffic of ['quiet', 'busy', 'heavy']) for (const a2 of [0, 2, 4]) {
    const o = { traffic, a2, a2traffic };
    assert.ok(K.load(four, Object.assign({ decoder: 'lean' }, o)).total <= K.load(four, Object.assign({ decoder: 'filter-once' }, o)).total + 1e-9, `around bursts costs more than always: ${traffic}, ${a2} ALERT2 ${a2traffic}`);
    assert.ok(K.load(four, Object.assign({ decoder: 'filter-once' }, o)).total < K.load(four, Object.assign({ decoder: 'today' }, o)).total, 'Lean costs less than Full');
  }
  // traffic: today's about 20 frames a minute, a storm, every half-second slot used
  assert.deepEqual(K.A2_TRAFFIC, { today: 20, storm: 60, full: 120 });
  assert.ok(K.TRAFFIC.quiet < K.TRAFFIC.busy && K.TRAFFIC.busy < K.TRAFFIC.heavy);
});

test('the CPU model gives the hardware review\'s worked figures', () => {
  const pi4 = platform('rpi-4-4gb');
  const cap = K.capacity(pi4);
  assert.equal(cap, 4);
  assert.equal(K.cores(pi4), 4);
  assert.equal(K.oneCore(pi4), 1);
  // Flood-Net's four channels on one stick, 1.44 MHz, the default decoder (U2 §5):
  // 4 × (1.6 × 0.31 + 8 ÷ 60 × 0.37) = 2.2 Pi 4 cores, 55% of a Pi 4; at 20 a minute 2.5, 62%
  const four = K.planSticks(FOUR, 'auto');
  const busy = K.load(four, { traffic: 'busy' }), heavy = K.load(four, { traffic: 'heavy' });
  near(busy.total, 2.2, 0.05, 'four channels, busy');
  near(busy.total / cap, 0.55, 0.01, 'four channels, busy, of a Pi 4');
  near(heavy.total, 2.5, 0.05, 'four channels, heavy');
  near(heavy.total / cap, 0.62, 0.01, 'four channels, heavy, of a Pi 4');
  // each channel: about 0.55–0.6 Pi 4 cores in a 1.44 MHz window
  near(busy.worst.need, 0.55, 0.01, 'a channel in 1.44 MHz, busy');
  near(heavy.worst.need, 0.6, 0.02, 'a channel in 1.44 MHz, heavy');
  // …0.15–0.25 in 240 kHz, and under 0.5 in 960 kHz
  const in240 = { sticks: [{ chans: [152.4], window: win(240) }] }, in960 = { sticks: [{ chans: [152.4], window: win(960) }] };
  near(K.load(in240, { traffic: 'busy' }).total, 0.15, 0.01, 'a channel in 240 kHz, busy');
  near(K.load(in240, { traffic: 'heavy' }).total, 0.22, 0.03, 'a channel in 240 kHz, heavy');
  assert.ok(K.load(in960, { traffic: 'busy' }).total >= 0.25 && K.load(in960, { traffic: 'heavy' }).total <= 0.5, 'a channel in 960 kHz');
  // the low end is the bench alone
  near(busy.totalLow, 4 * (0.31 + 8 / 60 * 0.37), 1e-9, 'the bench alone');
  // the old model put the work between bursts at 0.49 for these four: 2.5 to 4 times too low
  assert.ok(busy.contLow / 0.49 >= 2.5 && busy.cont / 0.49 <= 4.1);
  // one of the four an ALERT2 link at about 20 frames a minute: 2.6, 64% — the total barely moves
  const link = K.load(four, { traffic: 'heavy', a2: 1, a2traffic: 'today' });
  near(link.total, 2.6, 0.06, 'one ALERT2 link');
  near(link.a2, 0.2, 1e-9, 'an ALERT2 link at 20 frames a minute');
  assert.equal(link.a2Channels, 1);
  near(link.total - heavy.total, 0.1, 0.03, 'what today\'s ALERT2 adds');
  // eight channels in two 960 kHz windows: 3.8 legacy at 20 a minute, 4.4 with ALERT2 on all eight
  const two960 = { sticks: [{ chans: EIGHT.slice(0, 4), window: win(960) }, { chans: EIGHT.slice(4), window: win(960) }] };
  near(K.load(two960, { traffic: 'heavy' }).total, 3.8, 0.05, 'eight channels, legacy');
  near(K.load(two960, { traffic: 'heavy', a2: 8 }).total, 4.4, 0.05, 'eight channels, all ALERT2');
  // one ALERT2 channel with every slot used: 1.2 Pi 4 cores of frames; 1.3 on one core in 240 kHz, 1.7 in 1.44 MHz
  const full240 = K.load(in240, { a2: 1, a2traffic: 'full' });
  near(full240.a2, 1.2, 1e-9, 'every slot used');
  near(full240.worst.need, 1.3, 0.01, 'every slot used, 240 kHz');
  near(K.load({ sticks: [{ chans: [152.4], window: win(1440) }] }, { a2: 1, a2traffic: 'full' }).worst.need, 1.7, 0.01, 'every slot used, 1.44 MHz');
  // a storm sits between today and every slot
  const storm = K.load(in240, { a2: 1, a2traffic: 'storm' });
  near(storm.a2, 0.6, 1e-9, 'half the slots used');
  // not trying the legacy decoder first takes a full channel from about 1.2 to about 0.4 (planned, not shipped: off unless asked for)
  near(K.load(in240, { a2: 1, a2traffic: 'full', a2skip: true }).a2, 0.44, 1e-9, 'the legacy try skipped');
  assert.equal(K.load(in240, { a2: 1, a2traffic: 'full' }).a2, K.load(in240, { a2: 1, a2traffic: 'full', a2skip: false }).a2);
  // no ALERT2 unless told, never more ALERT2 channels than channels, and the ALERT2 ones are the widest windows first
  assert.equal(busy.a2Channels, 0);
  assert.equal(busy.a2, 0);
  assert.equal(K.load(four, { a2: 99 }).a2Channels, 4);
  const mixed = K.load({ sticks: [{ chans: [151.5], window: win(240) }, { chans: [151.95, 152.4], window: win(960) }] }, { a2: 2 });
  assert.deepEqual(mixed.perChannel.map(c => c.a2), [false, true, true]);
  // every channel is accounted for, and the parts add up to the total
  assert.equal(busy.perChannel.length, 4);
  near(busy.perChannel.reduce((a, c) => a + c.need, 0) + busy.kiosk, busy.total, 1e-9, 'the channels add up');
  near(busy.cont + busy.burst + busy.kiosk, busy.total, 1e-9, 'the parts add up');
  near(busy.legacy + busy.a2, busy.burst, 1e-9, 'bursts and frames add up');
});

test('the CPU model agrees with what happened at the Brisbane base', () => {
  const pi4 = platform('rpi-4-4gb');
  const cap = K.capacity(pi4);
  // eight channels in two wide windows with the screen on: overloaded ("load 9, every channel dropping samples")
  const wide = { sticks: [{ chans: EIGHT.slice(0, 4), window: B.model.windows[4] }, { chans: EIGHT.slice(4), window: B.model.windows[4] }] };
  const narrow = K.planSticks(EIGHT, 2);
  const o = { traffic: 'heavy', kiosk: true, decoder: 'today' };
  assert.ok(K.load(wide, o).total / cap > 1, 'two 1.92 MHz windows should overload a Pi 4');
  assert.ok(K.load(wide, o).total > 8 && K.load(wide, o).total < 10, 'and come to about the load of 9 the Pi showed');
  assert.ok(K.load(narrow, o).total < K.load(wide, o).total, 'narrower windows must cost less');
  // the default four channels are comfortable on a Pi 4 on a rainy day, within both limits
  const four = K.planSticks(FOUR, 'auto');
  const rain = K.load(four, { traffic: 'busy' });
  assert.ok(rain.total / cap <= B.model.safe);
  assert.equal(K.verdict(rain.total / cap, rain.worst.need / K.oneCore(pi4)).limit, 'none');
  // …and a Pi 4 is full with eight: over the 70% to plan for on today's default
  const two960 = { sticks: [{ chans: EIGHT.slice(0, 4), window: win(960) }, { chans: EIGHT.slice(4), window: win(960) }] };
  assert.ok(K.load(two960, { traffic: 'heavy' }).total / cap > B.model.safe);
  // the ALERT2 channel there, 151.5375 in 240 kHz on the full decoder, was 53% busy where a quiet channel is 6%
  const a2ch = K.load({ sticks: [{ chans: [151.5375], window: win(240) }] }, { decoder: 'today', a2: 1, a2traffic: 'today' });
  near(a2ch.worst.need, 0.53, 0.03, 'the first base station\'s ALERT2 channel');
  // an AM62 (four cores, each half a Pi 4 core) cannot carry eight in heavy traffic — not on the full decoder, and
  // not on today's default either; filtering only around bursts costs less, but it is unproven and off by default
  const am62 = platform('toradex-verdin-am62-mallow');
  assert.equal(K.capacity(am62), 2);
  assert.equal(K.cores(am62), 4);
  assert.equal(K.oneCore(am62), 0.5);
  const use = decoder => K.load(narrow, { traffic: 'heavy', decoder }).total / K.capacity(am62);
  assert.ok(use('today') > 1 && use('filter-once') > 1 && use('filter-once') < use('today') && use('lean') < use('filter-once') && use('light') < use('lean'));
  assert.ok(use('lean') < use('today') / 2, 'filtering only around bursts is less than half the full decoder\'s work');
  // with today's defaults one channel in a 1.44 MHz window is about a whole core of it before any burst arrives (U2 §0)
  near(win(1440).pi4 * B.model.loadFactor[1] / K.oneCore(am62), 1, 0.02, 'one channel on an AM62 core');
});

test('each channel is checked against one core, and the verdict says which limit bites', () => {
  const pi4 = platform('rpi-4-4gb');
  const cap = K.capacity(pi4), one = K.oneCore(pi4);
  assert.equal(B.model.chSafe, 0.7);
  // the whole-computer verdicts are what they were when only one figure is given
  assert.deepEqual([0.3, 0.6, 0.9, 1.2].map(u => K.verdict(u).cls), ['ok', 'ok', 'warn', 'bad']);
  assert.deepEqual([0.3, 0.6, 0.9, 1.2].map(u => K.verdict(u).limit), ['none', 'none', 'total', 'total']);
  assert.equal(K.verdict(0.3).text, 'Plenty of headroom');
  assert.equal(K.verdict(0.6).text, 'Comfortable');
  // one core: over 70% of it is a warning, over a whole core a failure, whatever the rest of the computer is doing
  assert.deepEqual([0.5, 0.7, 0.71, 1, 1.01].map(c => K.verdict(0.2, c).one), ['ok', 'ok', 'warn', 'warn', 'bad']);
  assert.equal(K.verdict(0.2, 0.9).limit, 'channel');
  assert.equal(K.verdict(0.2, 1.3).cls, 'bad');
  assert.equal(K.verdict(0.9, 0.5).limit, 'total');
  assert.equal(K.verdict(0.9, 0.9).limit, 'both');
  assert.equal(K.verdict(1.2, 1.2).limit, 'both');
  assert.equal(K.verdict(1.2, 0.9).limit, 'total');       // the worse of the two is the one that bites
  assert.equal(K.verdict(0.9, 1.2).limit, 'channel');
  for (const [u, c] of [[0.2, 0.9], [0.2, 1.3], [0.9, 0.9], [1.2, 1.2]]) assert.match(K.verdict(u, c).text, /one core|One channel/i, 'the words name the one-core limit');
  // one ALERT2 channel with every slot used on a Pi 4: a third of the computer, but more than one of its cores
  const lone = K.load({ sticks: [{ chans: [151.5375], window: win(240) }] }, { a2: 1, a2traffic: 'full' });
  assert.equal(K.verdict(lone.total / cap).cls, 'ok', 'the whole-computer sum alone would have passed it');
  const v = K.verdict(lone.total / cap, lone.worst.need / one);
  assert.equal(v.cls, 'bad');
  assert.equal(v.limit, 'channel');
  // the builder flags that channel, says so in words, and names the limit
  const R = K.build(Object.assign({}, BUILD, { a2: 1, a2traffic: 'full' }));
  assert.equal(R.verdict.limit, 'channel');
  assert.equal(R.flags.length, 1);
  assert.ok(R.flags[0].a2 && R.flags[0].need / R.oneCore > 1);
  assert.ok(R.chUse > 1 && R.use < 1);
  assert.ok(R.warn.some(w => w[0] === 'bad' && /one of this computer's cores/.test(w[1]) && /More cores do not/.test(w[1])), 'the warning says more cores will not help');
  // the plain four channels on a busy day flag nothing, and say so
  const calm = K.build(BUILD);
  assert.equal(calm.verdict.limit, 'none');
  assert.equal(calm.flags.length, 0);
  assert.ok(calm.useLow < calm.use && calm.chUseLow < calm.chUse, 'both figures are a range');
  assert.ok(!calm.warn.some(w => /of one of this computer's cores/.test(w[1])));
  // on a computer of half-speed cores those same four channels are too much on both counts
  const slow = K.build(Object.assign({}, BUILD, { platform: 'toradex-verdin-am62-mallow' }));
  assert.equal(slow.verdict.limit, 'both');
  assert.equal(slow.flags.length, 4);
  // every computer's flags are measured against ITS cores: 0.7 of one of them
  for (const p of B.platforms) {
    const Rp = K.build(Object.assign({}, BUILD, { platform: p.id, a2: 1, a2traffic: 'storm' }));
    for (const c of Rp.load.perChannel) assert.equal(Rp.flags.includes(c), c.need / K.oneCore(p) > 0.7, `${p.id}: ${c.mhz}`);
    assert.equal(Rp.verdict.one === 'ok', Rp.flags.length === 0, `${p.id}: the verdict and the flags agree`);
  }
});

test('room for ALERT2: the buying rule is four cores, each at least 2.5 times a Pi 4 core', () => {
  assert.deepEqual(B.model.rule, { cores: 4, oneCore: 2.5 });
  const four = K.planSticks(FOUR, 'auto');
  const pi4 = platform('rpi-4-4gb');
  // a Pi 4-class core cannot hold a channel with every slot used: 1.7 Pi 4 cores in the four channels' 1.44 MHz window
  const h = K.headroom(four, { traffic: 'busy' }, pi4);
  near(h.need, 1.7, 0.01, 'a full ALERT2 channel in 1.44 MHz');
  near(h.share, 1.7, 0.01, 'of one Pi 4 core');
  assert.equal(h.cls, 'bad');
  assert.equal(h.meetsRule, false);
  assert.ok(h.channel.a2 && h.channel.khz === 1440);
  // a core 2.5 times a Pi 4's runs it at about 70%: that is where the rule comes from
  near(h.need / B.model.rule.oneCore, 0.7, 0.03, 'the same channel on a core of 2.5');
  // the planned change (no legacy try) would let even a Pi 4 core hold it — it is not shipped, so it is off unless asked for
  const later = K.headroom(four, { traffic: 'busy', a2skip: true }, pi4);
  assert.ok(later.share < 1 && later.share > B.model.chSafe);
  // the rule needs both: enough cores, and each fast enough
  K.setCatalog([...CATALOG, { id: 'x-fast-dual', hw: { sdrCh: 12, cpu: '2× something 3 GHz' } }, { id: 'x-slow-eight', hw: { sdrCh: 16, cpu: 'eight-core' } }, { id: 'x-rule', hw: { sdrCh: 20, cpu: 'Some x86 processor, 4 cores' } }, { id: 'x-unsaid', hw: { sdrCh: 8, cpu: 'not stated' } }]);
  try {
    assert.equal(K.cores({ ref: 'x-fast-dual' }), 2);
    assert.equal(K.headroom(four, {}, { ref: 'x-fast-dual' }).meetsRule, false, 'two fast cores are not four');
    assert.equal(K.cores({ ref: 'x-slow-eight' }), 8);
    assert.equal(K.oneCore({ ref: 'x-slow-eight' }), 1);
    assert.equal(K.headroom(four, {}, { ref: 'x-slow-eight' }).meetsRule, false, 'eight slow cores do not make a fast one');
    assert.equal(K.cores({ ref: 'x-rule' }), 4);
    assert.equal(K.headroom(four, {}, { ref: 'x-rule' }).meetsRule, true);
    assert.notEqual(K.headroom(four, {}, { ref: 'x-rule' }).cls, 'bad');
    // the number of cores: the builder's own entry first, then the catalogue's, then the processor's description, then four
    assert.equal(K.cores({ ref: 'x-rule', cores: 6 }), 6);
    assert.equal(K.cores({ ref: 'x-unsaid' }), B.model.coresDefault);
    assert.equal(K.cores({ ref: 'rpi-4-4gb' }), 4);
  } finally { K.setCatalog(CATALOG); }
});

test('the trial page\'s calls into the builder still work as it makes them', () => {
  const fs = require('node:fs');
  const trial = fs.readFileSync(path.join(SITE, 'js', 'trial.js'), 'utf8');
  // every function the trial page takes from the builder is still there
  const used = new Set([...trial.matchAll(/\bK\.([A-Za-z]\w*)/g)].map(m => m[1]));
  assert.ok(used.has('load') && used.has('planSticks') && used.has('capacity') && used.has('verdict'), 'the trial page uses the builder\'s model');
  for (const name of used) assert.ok(name in K, `trial.js calls K.${name}, which the builder no longer has`);
  // …and answers the way it is called there: load(plan, { traffic, decoder }) → a total; verdict(share) → a class
  const plan = K.planSticks(FOUR, 'auto');
  for (const p of B.platforms) for (const d of B.decoders) for (const traffic of Object.keys(K.TRAFFIC)) {
    const u = K.load(plan, { traffic, decoder: d.id }).total / K.capacity(p);
    assert.ok(Number.isFinite(u) && u > 0, `${p.id}, ${d.id}, ${traffic}`);
    const v = K.verdict(u);
    assert.ok(['ok', 'warn', 'bad'].includes(v.cls) && typeof v.text === 'string' && v.text.length > 5);
  }
  // the fields load() always gave are all still numbers
  const L = K.load(plan, { traffic: 'busy', decoder: 'filter-once', kiosk: true });
  for (const k of ['cont', 'burst', 'kiosk', 'total', 'channels', 'memMb']) assert.equal(typeof L[k], 'number', `load().${k}`);
  near(L.cont + L.burst + L.kiosk, L.total, 1e-9, 'the parts it always gave still add up');
  // a plan that cannot be made (more than four sticks) costs nothing rather than throwing
  const none = K.load(K.planSticks([140, 145, 150, 155, 160], 'auto'), {});
  assert.equal(none.total, 0);
  assert.equal(none.worst, null);
  assert.doesNotThrow(() => K.load(plan));
});

test('every combination of choices builds a complete bill', () => {
  let n = 0;
  for (const platform of B.platforms) for (const sdr of B.sdrs) for (const power of B.power) for (const backhaul of B.backhaul) for (const enclosure of B.enclosures) {
    const S = { platform: platform.id, channels: [151.5, 151.525, 151.95, 152.4, 151.425], sticks: 'auto', decoder: 'today', traffic: 'busy', kiosk: true,
      sdr: sdr.id, mount: 'ext-clamp', antenna: 'rfi-col54', coaxM: 20, arrestor: true, power: power.id, backhaul: backhaul.id, enclosure: enclosure.id, gps: true };
    const R = K.build(S);
    n++;
    assert.ok(R.rows.length >= 8, `${platform.id}: too few lines`);
    for (const r of R.rows) {
      assert.ok(r.name && r.qty > 0, `${platform.id}: a line without a name or quantity`);
      assert.ok(r.lo == null || r.lo <= r.hi, `${r.name}: range`);
    }
    assert.ok(R.total.lo > 0 && R.total.lo <= R.total.hi, 'total range');
    assert.ok(R.steps.length >= 4 && R.steps.every(s => s.items.length), 'build steps');
    assert.ok(R.longest && R.longest.lead.d[1] >= R.likely, 'lead times');
    if (sdr.mount === 'm2' && platform.m2 !== 'b-key') assert.ok(R.warn.some(w => w[0] === 'bad'), `${platform.id} has no USB M.2 slot and should say so`);
    if (backhaul.needsWifi && !platform.wifi) assert.ok(R.warn.some(w => /Wi-Fi/.test(w[1])));
  }
  assert.ok(n > 100);
});

test('the builder page says where its CPU figures come from, and explains its words', () => {
  const fs = require('node:fs');
  const read = f => fs.readFileSync(path.join(SITE, f), 'utf8');
  const html = read('build.html'), js = read('js/builder.js'), data = read('data/builder.js');
  // one busy Raspberry Pi 4, may read high, and the benchmark that settles it
  assert.match(html, /one Raspberry Pi 4/);
  assert.match(html, /may read high/);
  assert.match(html, /firmware\/bench/);
  assert.ok(B.model.src.some(([, u]) => /firmware\/bench/.test(u)) && B.model.src.some(([, u]) => /RPi_ALERT\/blob\/[^/]+\/docs\/roadmap\.md/.test(u)), 'the model names its sources');
  for (const [, u] of B.model.src) assert.match(u, /^https:\/\//);
  // claims the review found stale (U3, F8 and F9) stay gone
  for (const [name, text] of [['build.html', html], ['js/builder.js', js], ['data/builder.js', data]]) {
    for (const stale of [/45% of the time/, /40-fold/, /fortieth/, /within reach of a dual-core module/, /does a quarter less between bursts/]) assert.ok(!stale.test(text), `${name} still says ${stale}`);
  }
  // every word given a meaning on hover has a real one, and the page has the list a finger can read
  assert.match(html, /id="cpu-terms"/);
  for (const [k, t] of Object.entries(K.TERMS)) {
    assert.ok(Array.isArray(t) && t[0].length > 2 && t[1].length > 80, `${k}: no real meaning`);
    assert.ok(!/MegaNet/.test(t[1]), `${k} says MegaNet`);
  }
  const used = [...js.matchAll(/term\('([A-Za-z0-9]+)'/g)].map(m => m[1]);
  assert.ok(used.length > 5, 'the page marks its words');
  for (const k of used) assert.ok(K.TERMS[k], `term('${k}') has no meaning`);
  for (const k of ['pi4core', 'whole', 'onecore', 'window', 'between', 'busy', 'burst', 'frame', 'slots', 'decoder']) assert.ok(K.TERMS[k], `no meaning for ${k}`);
});

test('the builder\'s pages and catalogue name Flood-Net, not its repository', () => {
  const fs = require('node:fs');
  for (const f of ['build.html', 'js/builder.js', 'data/builder.js']) {
    const s = fs.readFileSync(path.join(SITE, f), 'utf8').replace(/github\.com\/cdomotor-g\/MegaNet/g, '');
    assert.ok(!/MegaNet/.test(s), `${f} says MegaNet`);
  }
});

// ── the computers: the hardware review's planning values, groups and routes ──
test('the review\'s computers carry its planning values: the whole computer and one core, in Raspberry Pi 4s', () => {
  const rec = id => CATALOG.find(x => x.id === id);
  // whole computer, times a Pi 4 (the lead reviewer's values, from reports R8, R1, R2 and R6)
  const whole = { 'rpi-zero-2w': 0.4, 'rpi-3b-plus': 0.5, 'rpi-4-4gb': 1, 'rpi-5-4gb': 2.2, 'rpi-cm5-io': 2.2, 'toradex-verdin-am62-mallow': 0.5, 'beagleplay': 0.5, 'beagley-ai': 0.5,
    'moxa-uc-4400a': 0.65, 'olimex-imx8mp-som-evb': 0.65, 'toradex-verdin-imx95-mallow': 1.1, 'toradex-luna-sl1680': 1.2, 'compulab-fitlet3': 1.8, 'mini-pc-n150': 3, 'onlogic-cl260': 3,
    'lenovo-thinkedge-se10n-gen2': 3, 'protectli-vault-vp2430': 3 };
  for (const [id, x] of Object.entries(whole)) near(rec(id).hw.sdrCh / 8, x, 0.006, `${id}: times a Pi 4`);
  // the same chip gets the same speed: a BeaglePlay is a Verdin AM62 Quad (U3 F5)
  assert.equal(rec('beagleplay').hw.sdrCh, rec('toradex-verdin-am62-mallow').hw.sdrCh);
  // one core: the review gives the i.MX 95 as 1.1 in all and 0.75 a core (six cores), and the same figure must show on every page; an A53 is 0.5
  near(K.oneCore(platform('toradex-verdin-imx95-mallow')), 0.75, 0.001, 'the i.MX 95, a core');
  assert.equal(rec('toradex-verdin-imx95-mallow').hw.core, 0.75);
  assert.equal(K.cores(platform('toradex-verdin-imx95-mallow')), 6);
  near(K.oneCore(platform('moxa-uc-4400a')), 0.65, 0.005, 'a Moxa core');
  // the ALERT2 buying rule (four cores, each at least 2.5 Pi 4 cores) is met by the N150-class boxes and nothing slower
  const four = K.planSticks(FOUR, 'auto');
  const meets = B.platforms.filter(p => K.headroom(four, {}, p).meetsRule).map(p => p.id).sort();
  assert.deepEqual(meets, ['lenovo-m920q-tiny-refurb', 'lenovo-thinkedge-se10n-gen2', 'mini-pc-n150', 'onlogic-cl260', 'protectli-vault-vp2430']);
  // the general "fanless industrial x86" entry is rated as its Atom x6000E models are (the fitlet3's 1.8), so it does not claim the rule
  assert.equal(rec('fanless-industrial-x86').hw.sdrCh, rec('compulab-fitlet3').hw.sdrCh);
  assert.match(platform('fanless-industrial-x86').fit, /depends on the processor/);
  assert.ok(!/FIRST CHOICE/.test(platform('fanless-industrial-x86').fit));
  // a RevPi Connect 5 holds a Compute Module 5: the same speed
  assert.equal(rec('revpi-connect-5').hw.sdrCh, rec('rpi-cm5-io').hw.sdrCh);
  // a temperature nobody read from the maker says so, and the builder's warning does not call it a rating
  for (const id of ['lenovo-m920q-tiny-refurb', 'dell-optiplex-micro', 'beagleplay']) assert.ok((rec(id).tempAssumed || '').length > 20, `${id}: its temperature is assumed, and must say so`);
  const hot = K.build(Object.assign({}, BUILD, { platform: 'lenovo-m920q-tiny-refurb' }));
  assert.ok(hot.warn.some(w => /No temperature rating was read/.test(w[1])) && !hot.warn.some(w => /is rated to 35/.test(w[1])), 'an assumed temperature is not a rating');
  // the Verdins and the Luna run Torizon OS, not plain Debian (U3 F13)
  for (const id of ['toradex-verdin-am62-mallow', 'toradex-verdin-am62-dual-mallow', 'toradex-verdin-imx95-mallow', 'toradex-luna-sl1680']) assert.deepEqual(rec(id).hw.os, ['torizon'], id);
  const agent = rec('rpi-alert');
  assert.match(agent.runsOn.torizon, /container/);
  for (const os of ['debian-amd64', 'debian-arm64']) { assert.match(agent.runsOn[os], /open-alert-base/, os); assert.ok(!/install by hand/.test(agent.runsOn[os]), os); }
  // nobody is told a maker certifies what it does not
  for (const [name, s] of [['catalogue', JSON.stringify(rec('lenovo-thinkedge-se10n-gen2'))], ['builder', JSON.stringify(platform('lenovo-thinkedge-se10n-gen2'))]]) {
    assert.ok(!/certified by the makers of Ubuntu/i.test(s), `${name}: the ThinkEdge's certification is Lenovo's statement`);
    assert.match(s, /Canonical/, `${name}: says what Canonical's list showed`);
  }
  // a speed nobody has measured says so
  for (const id of Object.keys(whole)) if (!['rpi-4-4gb'].includes(id)) assert.ok(rec(id).conf !== 'high', `${id}: its speed is a stand-in`);
});

test('every computer the review lists is catalogued, sourced and, where it is worth building with, in the builder', () => {
  const rec = id => CATALOG.find(x => x.id === id);
  const catalogued = ['onlogic-cl260', 'lenovo-thinkedge-se10n-gen2', 'protectli-vault-vp2430', 'lenovo-m920q-tiny-refurb', 'dell-optiplex-micro', 'compulab-fitlet3', 'moxa-uc-4400a', 'eurotech-reliacor-40-13',
    'beagley-ai', 'beagleplay', 'olimex-imx8mp-som-evb', 'toradex-verdin-imx95-mallow', 'toradex-verdin-am62-mallow', 'toradex-verdin-am62-dual-mallow', 'toradex-luna-sl1680'];
  for (const id of catalogued) {
    const it = rec(id);
    assert.ok(it, `${id} is not in the catalogue`);
    assert.ok(it.src.length >= 2, `${id}: every claim needs a source`);
    assert.ok(it.hw.sdrCh > 0 && it.hw.cpu && Number.isInteger(K.cores({ ref: id })), `${id}: speed and cores`);
    assert.ok(!/MegaNet/.test(JSON.stringify(it)), `${id} says MegaNet`);
  }
  // a quote-only part is a blank price, and a foreign list price says how it was converted
  for (const id of ['lenovo-thinkedge-se10n-gen2', 'protectli-vault-vp2430', 'compulab-fitlet3', 'moxa-uc-4400a', 'eurotech-reliacor-40-13', 'dell-optiplex-micro']) {
    assert.equal(rec(id).price.aud, null, id);
    assert.equal(rec(id).price.basis, 'quote', id);
  }
  for (const id of ['onlogic-cl260', 'toradex-verdin-am62-mallow', 'toradex-verdin-am62-dual-mallow', 'toradex-verdin-imx95-mallow', 'toradex-luna-sl1680', 'olimex-imx8mp-som-evb']) assert.match(rec(id).price.src, /converted at 0\.6\d/, id);
  // the Verdins: Toradex's own prices (read 2026-11-11), the right heatsink, USB 2.0 and no PCIe with an AM62, supply to 2033 is seven years
  const quad = rec('toradex-verdin-am62-mallow'), dual = rec('toradex-verdin-am62-dual-mallow');
  near(quad.price.aud, (306.00 + 100.65 + 14.40) / 0.69, 0.01, 'the Quad set');
  near(dual.price.aud, (206.25 + 100.65 + 14.40) / 0.69, 0.01, 'the Dual set');
  assert.match(quad.price.src, /US\$306\.00/); assert.match(dual.price.src, /US\$206\.25/); assert.match(quad.price.src, /US\$100\.65/); assert.match(quad.price.src, /23111101/);
  assert.match(platform('toradex-verdin-am62-mallow').parts, /23111101/);
  assert.match(platform('toradex-verdin-imx95-mallow').parts, /23111101/);
  assert.equal(quad.lifeYears, 7);
  assert.notEqual(quad.cat, 'ind-sbc', 'not under the Industrial Raspberry Pi heading');
  assert.notEqual(dual.cat, 'ind-sbc');
  assert.ok(/USB 2\.0/.test(quad.cons.join(' ')) && /PCIe/.test(quad.cons.join(' ')), 'the AM62 on Mallow: USB 2.0, no PCIe');
  assert.ok(/early access/i.test(quad.hw.secureBoot));
  assert.ok(!/A\$566|three times|two or three channels/.test(JSON.stringify(quad) + JSON.stringify(dual)), 'the stale lines are gone');
  assert.equal(rec('toradex-verdin-imx95-mallow').hw.cores, 6);
  // the Luna: a sample product, the chip-maker's kernel, five years, 1.2 times a Pi 4, still between a Pi 4 and a Pi 5
  const luna = rec('toradex-luna-sl1680');
  assert.equal(luna.status, 'beta'); assert.equal(luna.conf, 'low'); assert.equal(luna.lifeYears, 5);
  assert.ok(/evaluation/.test(luna.blurb) && /sample/i.test(luna.blurb));
  // the BeaglePlay: one USB host port, and its chip can never do secure boot
  assert.equal(rec('beagleplay').io.usb, 1); assert.equal(platform('beagleplay').usb, 1);
  assert.match(rec('beagleplay').hw.secureBoot, /never/);
  // in the builder, each with a place to buy it
  for (const id of ['onlogic-cl260', 'lenovo-thinkedge-se10n-gen2', 'protectli-vault-vp2430', 'lenovo-m920q-tiny-refurb', 'compulab-fitlet3', 'moxa-uc-4400a', 'beagley-ai', 'beagleplay', 'toradex-verdin-imx95-mallow']) {
    const p = platform(id);
    assert.ok(p && p.where.length >= 1 && p.src.length >= 1, `${id}: no builder entry or no link`);
  }
});

test('open-ALERT\'s package is the install route for every computer that is not a Pi, a Verdin or the Luna, and its steps say what has not been tested', () => {
  for (const p of B.platforms) {
    const want = /^rpi-|^revpi-connect/.test(p.id) ? ['pi', 'cm'] : /verdin/.test(p.id) ? ['verdin'] : /luna/.test(p.id) ? ['luna'] : ['package'];
    assert.ok(want.includes(p.install), `${p.id}: install route ${p.install}`);
  }
  const pkg = K.build(Object.assign({}, BUILD, { platform: 'onlogic-cl260' }));
  const text = pkg.steps.map(s => s.items.join(' ')).join(' ');
  assert.match(text, /open-alert-base/);
  assert.match(text, /github\.com\/cdomotor-g\/open-ALERT\/releases/);
  assert.match(text, /nothing has yet been run with a real radio stick on a computer that is not a Raspberry Pi/i);
  // the package's steps do not borrow the Raspberry Pi install's upkeep: no "alert" account, no updates from Flood-Net, one request for the token
  assert.ok(!/<code>alert<\/code> account/.test(text), 'the package installs no "alert" account');
  assert.ok(!/under-voltage/.test(text), 'under-voltage is a Raspberry Pi message');
  assert.match(text, /new <code>open-alert-base<\/code> package/);
  assert.equal(text.split('Request a token').length - 1, 1, 'the token is asked for once');
  assert.ok(!/Most of these makers offer or certify/.test(text));
  const pi = K.build(BUILD).steps.map(s => s.items.join(' ')).join(' ');
  assert.match(pi, /under-voltage/); assert.match(pi, /<code>alert<\/code> account/);
  const ver = K.build(Object.assign({}, BUILD, { platform: 'toradex-verdin-imx95-mallow' }));
  const vtext = ver.steps.map(s => s.items.join(' ')).join(' ');
  assert.match(vtext, /Torizon OS/);
  assert.match(vtext, /firmware\/container/);
  assert.match(vtext, /nothing has yet been run with a real radio stick/i);
  // a computer sold by quote is flagged, so its missing price is not mistaken for a free one
  const quote = K.build(Object.assign({}, BUILD, { platform: 'moxa-uc-4400a' }));
  assert.ok(quote.warn.some(w => /by quote/.test(w[1])), 'the quote is flagged');
  assert.ok(quote.warn.some(w => /powered USB hub/.test(w[1])) || BUILD.sticks === 'auto', 'one USB port: a hub for a second stick');
});
