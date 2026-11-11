#!/usr/bin/env node
'use strict';
// open-alert-bench.js — how many channels will this computer carry?
//
//   node open-alert-bench.js [AGENT_DIRECTORY] [--quick | --full] [--json] [--out=FILE] [--label=TEXT]
//
// It times RPi ALERT's own decoder code on this computer, prints a summary in
// plain words, and (with --json or --out) the full figures as JSON to share.
//
// One file, Node 18 or later, no packages. It needs no network, no radio stick
// and no administrator rights. It only READS the agent directory: it opens no
// port and no device, writes no file but the one --out names, and never touches
// /etc/rpi-alert or /var/lib/rpi-alert — so a base station already running on
// this computer loses nothing but some processor time while it runs.
//
// Nothing is re-implemented here: every figure comes from running the agent's
// own files (vendor/meganet/alert-dsp.js, lib/devices/alert2-air.js,
// lib/devices/sdr-bench.js, lib/devices/sdr-worker.js).
//
//   burst          one burst's decode with each decoder (Full, Lean, Light) on
//                  the real off-air recordings in the agent's test/fixtures.
//   alert2         an ALERT2 burst as the agent handles it: tried as a legacy
//                  burst first, then decoded as ALERT2.
//   betweenBursts  what a channel costs while nothing is on the air, at each
//                  window (the slice of band a stick hands over): by the agent's
//                  own measurement, by the same loop unrounded, and with the
//                  settings the decoder threads really run with.
//   parallel       the same with every core busy at once.
//   memory         memory each decoder thread adds.
//   traffic        one channel through the agent's real decoder thread under
//                  legacy and ALERT2 traffic.
//   timesARaspberryPi4, capacity, alert2Headroom, sizing, selfCheck, summary
//                  worked from the figures above.
//
// The Raspberry Pi 4 figures it compares with are few and were taken on a busy
// Pi 4. PI4 below holds every one of them with the file and lines it was read
// from, and the summary says so each time it leans on them.

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { Worker, isMainThread, parentPort, workerData } = require('node:worker_threads');

const TOOL = 'open-alert-bench';
const VERSION = '1.0.0';
const SCHEMA = 'open-alert-bench/1';
const DEFAULT_AGENT_DIRS = ['/usr/lib/open-alert-base/agent', '/opt/rpi-alert'];

// ── the Raspberry Pi 4 figures: all there are, and where each was read ──────
// Line numbers are of RPi ALERT at commit 37fee8b (10 November 2026).
const PI4 = {
  cores: 4,
  readAt: 'RPi ALERT commit 37fee8b (10 November 2026)',
  betweenBursts: {
    what: 'the share of one core a channel takes between bursts, by the agent\'s own built-in measurement, on the Raspberry Pi 4 of the first base station',
    source: 'RPi ALERT docs/roadmap.md, lines 112-113: "the bench says 240 kHz 6%, 1.2 MHz 27%, 1.44 MHz 31% a channel"',
    cores: { 240000: 0.06, 1200000: 0.27, 1440000: 0.31 },
    missing: {
      960000: 'no Raspberry Pi 4 figure: docs/hardware.md, lines 66-73, gives only "3x a 240 kHz channel"',
      2400000: 'no Raspberry Pi 4 figure: docs/hardware.md, lines 66-73, gives only "6.3x a 240 kHz channel"',
    },
    caveats: [
      'Taken in October 2026 with agent 0.15, older than the agent measured here. Agent 0.17 says it cut the work between bursts by about a quarter (docs/roadmap.md, lines 78-80); the same Pi 4 has not been measured since.',
      'The agent takes this measurement by itself a minute and a half after it starts (lib/agent.js, lines 50-52), while its channels are already decoding. That Pi 4 was a working base station with eight channels and its screen dashboard on (docs/hardware.md, lines 101-106). A measurement that has to share the processor reads high, which makes a Pi 4 look slower than it is and any other computer look faster against it.',
    ],
  },
  burstFull: {
    ms: 1000,
    what: 'one burst\'s decode with the Full decoder',
    source: 'RPi ALERT docs/hardware.md, lines 76-77: "A burst\'s decode — a second or so on a Pi 4"',
    caveat: 'A round figure in a sentence, for no named recording: a rough ratio only.',
  },
  burstLean: {
    shareOfFull: 0.335,
    what: 'the Lean decoder took 33-34 % of the Full decoder\'s time on that Pi 4, over 11,628 live bursts',
    source: 'RPi ALERT docs/roadmap.md, lines 76-78',
    caveat: 'A share of the Full decoder\'s time, not milliseconds: there is no Raspberry Pi 4 figure in milliseconds for Lean.',
  },
  burstLight: { ms: null, source: 'RPi ALERT docs/configuration.md, lines 130-134 (figures from a PC)', caveat: 'No Raspberry Pi 4 figure for the Light decoder.' },
  alert2: { ms: null, source: 'RPi ALERT docs/configuration.md, lines 119-120: "a few tenths of a second on a Pi 4"', caveat: 'Words only: no figure to divide by.' },
  underLoad: {
    factor: 1.6,
    source: 'RPi ALERT docs/roadmap.md, lines 113-114: "under load each decoder\'s busy share ran about 1.6 times that"',
    caveat: 'Seen on that one Pi 4 only. Used here as a safety margin on every computer.',
  },
};

// ── the sizing rule (firmware/bench/README.md, "How the channel count is worked out") ──
const RULE = {
  underLoad: PI4.underLoad.factor,   // margin on the between-bursts cost
  shareKept: 0.5,                    // plan to half the computer
  oneThread: 0.7,                    // one channel may take this much of one core
  minCores: 4,                       // the ALERT2 headroom rule …
  minTimesAPi4Core: 2.5,             // … each core this many times a Pi 4 core
  maxChannelsAStick: 8,              // RPi ALERT's own limit (web/sdr-plan.js)
  backlogS: 20, backlogMinS: 5, backlogMem: 0.02,   // lib/devices/sdr.js backlogLimit()
  memoryShare: 0.5,                  // plan to half the memory
  headlineWindow: 1440000,
};

const WINDOWS = [240000, 960000, 1200000, 1440000, 2400000];
const WINDOW_NOTE = { 1200000: 'measured because it is one of the three windows a Raspberry Pi 4 figure exists for', 1440000: 'the window Flood-Net\'s four channels need' };
const FS = 240000;                   // the decoder's own sample rate

// ── a piece of the measuring, in a process of its own ──────────────────────
// Every measurement runs in a fresh Node process that ends when it is done,
// so the memory it used goes back to the computer straight away and this
// process stays small. (A decoder holds tens of megabytes and Node hands
// memory back slowly: measured all in one process, a run peaked over 500 MB,
// which a small computer with a base station running on it may not have.)
// The work to do goes in on standard input and the result comes back on
// standard output, both as JSON; progress goes straight to the error stream.
function job(ctx, name, params) {
  const { spawnSync } = require('node:child_process');
  const r = spawnSync(process.execPath, [__filename, '--job=' + name], {
    input: JSON.stringify({ agentDir: ctx.agentDir, quiet: ctx.quiet, params }), encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'inherit'], maxBuffer: 64 * 1048576, timeout: 3600000 });
  if (r.error) throw new Error('a measuring process could not be run: ' + errText(r.error));
  let m = null;
  try { m = JSON.parse(String(r.stdout).trim().split('\n').pop()); } catch (e) { /* said below */ }
  if (!m) throw new Error('a measuring process stopped' + (r.signal ? ' (' + r.signal + ')' : r.status ? ' (exit ' + r.status + ')' : '') + ' and gave no result');
  if (m.error) throw new Error(m.error);
  ctx.peakJobMb = Math.max(ctx.peakJobMb || 0, m.peakMb || 0);
  if (process.env.OA_BENCH_DEBUG) process.stderr.write('      [job ' + name + '] peak ' + m.peakMb + ' MB ' + JSON.stringify(params).slice(0, 90) + '\n');
  return m.ok;
}

// ── between bursts: the agent's sdr-bench.js loop, unrounded ───────────────
// (The agent rounds to a thousandth of a core, one part in ten on a fast
// computer, and sets the pipeline up as it was before agent 0.19.)
// Unlike the agent's, the window is first run for a tenth of a second so the
// JavaScript engine has compiled the decoder (a base station runs for weeks),
// and a try is never shorter than `minTryMs`: on a fast computer the agent's
// 0.4 s of samples is over in five milliseconds, too short to time well.

// A quiet band's noise, as the agent's own sdr-bench.js makes it.
function noiseChunk(bytes, seed) {
  const u8 = new Uint8Array(bytes);
  for (let i = 0; i < bytes; i++) { seed = (seed * 1103515245 + 12345) & 0x7fffffff; u8[i] = 117 + (seed % 21); }
  return u8;
}
const chunkBytes = (rate) => (rate >= 900000 ? 65536 : 16384);      // rtl_sdr's own reads, as sdr-bench.js
const now = () => Number(process.hrtime.bigint()) / 1e9;
const codecs = (agentDir) => require(path.join(agentDir, 'lib', 'meganet-codecs'));

// One window: → the cores a channel takes, the least of `tries`.
function benchLoop(agentDir, rate, extraCfg, seconds, tries, minTryMs) {
  const { AlertDsp } = codecs(agentDir);
  const chunk = chunkBytes(rate), u8 = noiseChunk(chunk, 1);
  const pipe = new AlertDsp.Pipeline(() => {});
  pipe.configure(Object.assign({ deviceRate: rate, channelOffsetHz: 37000, specHz: 1, scopeHz: 1, fftSize: 2048 }, extraCfg || {}));
  const t00 = now();                                   // warm up, and see roughly what a chunk costs
  let k = 0;
  do { pipe.feed(u8); k++; } while (k < 12 || now() - t00 < 0.1);
  const perChunk = (now() - t00) / k;
  const n = Math.max(8, Math.round(seconds * rate * 2 / chunk), Math.ceil((minTryMs || 0) / 1000 / perChunk));
  let best = Infinity;
  for (let t = 0; t < tries; t++) {
    const t0 = now();
    for (let i = 0; i < n; i++) pipe.feed(u8);
    best = Math.min(best, (now() - t0) / (n * chunk / 2 / rate));
  }
  return best;
}

// The same loop for the every-core-busy test: warm up, say so, wait to be told
// "go", then feed the window for `ms` and say how many cores that took. Every
// thread is told "go" together and runs for the same time, so each is measured
// only while all the others are busy too.
function togetherThread(d) {
  const { AlertDsp } = codecs(d.agentDir);
  const chunk = chunkBytes(d.rate), u8 = noiseChunk(chunk, 1);
  const pipe = new AlertDsp.Pipeline(() => {});
  pipe.configure(Object.assign({ deviceRate: d.rate, channelOffsetHz: 37000, specHz: 1, scopeHz: 1, fftSize: 2048 }, d.cfg || {}));
  const t0 = now();
  let k = 0;
  do { pipe.feed(u8); k++; } while (k < 12 || now() - t0 < 0.1);
  parentPort.on('message', (m) => {
    if (m !== 'go') return;
    try {
      const t1 = now();
      let n = 0, t = 0;
      do { pipe.feed(u8); n++; t = now() - t1; } while (t < d.ms / 1000);
      parentPort.postMessage({ ok: t / (n * chunk / 2 / d.rate) });
    } catch (e) { parentPort.postMessage({ error: String((e && e.stack) || e) }); }
  });
  parentPort.postMessage({ warm: true });
}

if (!isMainThread && workerData && workerData.openAlertBench) {
  try { togetherThread(workerData); } catch (e) { parentPort.postMessage({ error: String((e && e.stack) || e) }); }
  return;
}

// `n` of those threads at once → the cores each took, all measured over the same `ms`.
function together(agentDir, n, rate, cfg, ms) {
  return new Promise((resolve, reject) => {
    const ws = [], got = [];
    let warm = 0, done = false;
    const finish = (err) => { if (done) return; done = true; for (const w of ws) w.terminate(); if (err) reject(err); else resolve(got); };
    for (let i = 0; i < n; i++) {
      const w = new Worker(__filename, { workerData: { openAlertBench: true, agentDir, rate, cfg, ms } });
      ws.push(w);
      w.on('message', (m) => {
        if (m.error) finish(new Error(m.error));
        else if (m.warm) { if (++warm === n) for (const x of ws) x.postMessage('go'); }
        else { got.push(m.ok); if (got.length === n) finish(); }
      });
      w.on('error', (e) => finish(e));
      w.on('exit', (code) => finish(new Error('a measuring thread stopped (' + code + ')')));
    }
  });
}

// The least of `passes` runs of the loop, window by window (each run a process of its own).
function runLoop(ctx, rates, cfg, P) {
  const best = {};
  for (let k = 0; k < P.loopPasses; k++) for (const rate of rates) {
    const v = job(ctx, 'loop', { rate, cfg, seconds: P.loopSeconds, tries: P.loopTries, minTryMs: P.loopMinTryMs });
    best[rate] = best[rate] == null ? v : Math.min(best[rate], v);
  }
  return best;
}

// ── helpers ────────────────────────────────────────────────────────────────
const round = (v, d) => (v == null || !Number.isFinite(v) ? null : Math.round(v * Math.pow(10, d)) / Math.pow(10, d));
const median = (a) => { const s = a.slice().sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const mean = (a) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : null);
const geomean = (a) => (a.length ? Math.exp(a.reduce((s, v) => s + Math.log(v), 0) / a.length) : null);
const errText = (e) => String((e && e.message) || e).split('\n')[0];

function slurp(file) { try { return fs.readFileSync(file, 'utf8'); } catch (e) { return null; } }
function firstMatch(file, re) { const s = slurp(file); const m = s && re.exec(s); return m ? m[1].trim() : null; }

// fn() timed: `warm` runs first, untimed, so that the JavaScript engine has
// compiled the decoder (a base station runs for weeks; Node 18 needs four or
// five runs of a decoder before it is at speed), then until `minRuns` and
// `minMs` are both met.
function timeIt(fn, minRuns, minMs, warm) {
  let last;
  for (let i = 0; i < (warm == null ? 2 : warm); i++) fn();
  const ms = [];
  const t00 = Date.now();
  while (ms.length < minRuns || (Date.now() - t00 < minMs && ms.length < 60)) {
    const t0 = process.hrtime.bigint();
    last = fn();
    ms.push(Number(process.hrtime.bigint() - t0) / 1e6);
  }
  return { ms: round(median(ms), 1), best: round(Math.min(...ms), 1), runs: ms.length, last };
}

// ── this computer ──────────────────────────────────────────────────────────
const ARM_PARTS = { '0xd03': 'Cortex-A53', '0xd04': 'Cortex-A35', '0xd05': 'Cortex-A55', '0xd07': 'Cortex-A57', '0xd08': 'Cortex-A72', '0xd09': 'Cortex-A73',
  '0xd0a': 'Cortex-A75', '0xd0b': 'Cortex-A76', '0xd0d': 'Cortex-A77', '0xd41': 'Cortex-A78', '0xd46': 'Cortex-A510', '0xd47': 'Cortex-A710', '0xd4d': 'Cortex-A715' };

function cpuLimit() {            // a container's processor allowance, in cores, or null
  const v2 = slurp('/sys/fs/cgroup/cpu.max');
  if (v2) { const m = /^(\d+)\s+(\d+)/.exec(v2); return m ? Number(m[1]) / Number(m[2]) : null; }
  const q = Number(slurp('/sys/fs/cgroup/cpu/cpu.cfs_quota_us')), p = Number(slurp('/sys/fs/cgroup/cpu/cpu.cfs_period_us'));
  return q > 0 && p > 0 ? q / p : null;
}

function temperatureC() {        // the hottest sensor the kernel shows, or null
  let hot = null;
  try {
    for (const z of fs.readdirSync('/sys/class/thermal')) {
      if (!/^thermal_zone\d+$/.test(z)) continue;
      const v = Number(slurp('/sys/class/thermal/' + z + '/temp'));
      if (Number.isFinite(v) && v > 0) hot = Math.max(hot == null ? -Infinity : hot, v / 1000);
    }
  } catch (e) { /* none */ }
  return round(hot, 1);
}

function agentRunning() {        // is a base station (or rtl_sdr) running here now?
  try {
    for (const pid of fs.readdirSync('/proc')) {
      if (!/^\d+$/.test(pid) || Number(pid) === process.pid) continue;
      const cmd = (slurp('/proc/' + pid + '/cmdline') || '').replace(/\0/g, ' ');
      if (/\brtl_sdr\b/.test(cmd) || /rpi-alert\S*\s+daemon\b/.test(cmd)) return true;
    }
  } catch (e) { /* not Linux */ }
  return false;
}

function machine() {
  const cpus = os.cpus();
  const cpuinfo = slurp('/proc/cpuinfo') || '';
  const one = (re) => { const m = re.exec(cpuinfo); return m ? m[1].trim() : null; };
  const logical = cpus.length || 1;
  const allowed = typeof os.availableParallelism === 'function' ? os.availableParallelism() : logical;
  const limit = cpuLimit();
  // Physical cores (x86 names them; ARM does not).
  const phys = new Set();
  for (const block of cpuinfo.split(/\n\s*\n/)) {
    const p = /^physical id\s*:\s*(\d+)/m.exec(block), c = /^core id\s*:\s*(\d+)/m.exec(block);
    if (p && c) phys.add(p[1] + ':' + c[1]);
  }
  // Cores of different speeds (ARM big.LITTLE, Intel P and E cores).
  const speeds = [];
  for (let i = 0; i < logical; i++) {
    const v = Number(slurp('/sys/devices/system/cpu/cpu' + i + '/cpu_capacity')) || Number(slurp('/sys/devices/system/cpu/cpu' + i + '/cpufreq/cpuinfo_max_freq')) || 0;
    if (v) speeds.push(v);
  }
  const top = speeds.length ? Math.max(...speeds) : 0;
  const fast = speeds.length === logical ? speeds.filter(v => v >= 0.8 * top).length : null;
  const arm = one(/^CPU part\s*:\s*(\S+)/m);
  const dmi = (f) => { const v = (slurp('/sys/class/dmi/id/' + f) || '').trim(); return v && !/^(to be filled|default string|system (product|manufacturer)|not specified|none|o\.e\.m\.)/i.test(v) ? v : null; };
  const board = (slurp('/proc/device-tree/model') || '').replace(/\0/g, '').trim() || one(/^Model\s*:\s*(.+)$/m) || [dmi('sys_vendor'), dmi('product_name')].filter(Boolean).join(' ') || null;
  const cg = slurp('/proc/1/cgroup') || '';
  const threads = Math.max(1, Math.min(allowed, limit ? Math.ceil(limit) : allowed));
  const cores = Math.max(1, Math.min(allowed, limit ? Math.max(1, Math.floor(limit)) : allowed, phys.size || allowed));
  return {
    cpuModel: one(/^model name\s*:\s*(.+)$/m) || (arm && ARM_PARTS[arm.toLowerCase()] ? 'ARM ' + ARM_PARTS[arm.toLowerCase()] : null) || (cpus[0] && cpus[0].model) || null,
    board,
    arch: os.arch(),
    cores,                       // processor cores this tool may use (what the ALERT2 rule counts)
    threads,                     // threads it runs at once in the every-core-busy test
    logicalCpus: logical,
    physicalCores: phys.size || null,
    fastCores: fast,             // cores within a fifth of the fastest; null when the system does not say
    cpuLimitCores: round(limit, 2),
    cpuMHz: Number(one(/^cpu MHz\s*:\s*(.+)$/m)) || (cpus[0] && cpus[0].speed) || null,
    cpuMaxMHz: (() => { const v = firstMatch('/sys/devices/system/cpu/cpu0/cpufreq/cpuinfo_max_freq', /(\d+)/); return v ? Number(v) / 1000 : null; })(),
    governor: firstMatch('/sys/devices/system/cpu/cpu0/cpufreq/scaling_governor', /(\S+)/),
    virtualMachine: /^flags\s*:.*\bhypervisor\b/m.test(cpuinfo) || fs.existsSync('/sys/hypervisor/type') || fs.existsSync('/proc/device-tree/hypervisor'),
    container: fs.existsSync('/.dockerenv') || fs.existsSync('/run/.containerenv') || /docker|kubepods|containerd|podman|lxc/.test(cg) || !!process.env.container,
    memMb: Math.round(os.totalmem() / 1048576),
    memAvailableMb: (() => { const v = firstMatch('/proc/meminfo', /^MemAvailable:\s*(\d+)/m); return v ? Math.round(Number(v) / 1024) : Math.round(os.freemem() / 1048576); })(),
    os: os.type() + ' ' + os.release(),
    distro: firstMatch('/etc/os-release', /^PRETTY_NAME="?([^"\n]+)"?/m) || firstMatch('/usr/lib/os-release', /^PRETTY_NAME="?([^"\n]+)"?/m),
    node: process.version,
    nodeMajor: Number(process.versions.node.split('.')[0]),
    v8: process.versions.v8,
    loadAvgAtStart: os.loadavg().map(v => round(v, 2)),
    loadAvgAtEnd: null,
    tempCAtStart: temperatureC(),
    tempCAtEnd: null,
    agentRunning: agentRunning(),
  };
}

// ── recordings and synthesised signals ─────────────────────────────────────
function floats(u8, name) {
  const n = u8.length >> 1;
  const re = new Float32Array(n), im = new Float32Array(n);
  for (let i = 0; i < n; i++) { re[i] = u8[2 * i] - 127.5; im[i] = u8[2 * i + 1] - 127.5; }
  return { name, re, im, seconds: n / FS };
}

function fixture(dir, name) {
  const file = path.join(dir, name);
  if (!fs.existsSync(file)) return null;
  return floats(new Uint8Array(fs.readFileSync(file)), name);
}

function toU8(re, im) {
  const u8 = new Uint8Array(re.length * 2);
  for (let i = 0; i < re.length; i++) {
    u8[2 * i] = Math.max(0, Math.min(255, Math.round(127.5 + re[i])));
    u8[2 * i + 1] = Math.max(0, Math.min(255, Math.round(127.5 + im[i])));
  }
  return u8;
}

// One PDU (ALERT2 message) of concentrated legacy readings behind two repeaters: 14 + 4K bytes.
const pdu = (bytes, src) => ({ source: src || 11762, path: [10115, 11056], hopLimit: 2, stamp: 7907,
  records: Array.from({ length: Math.max(1, Math.round((bytes - 14) / 4)) }, (_, i) => ({ id: 1000 + i, value: (i * 37) % 2048, before: i % 200 })) });

// Seconds an ALERT2 frame of `bytes` is on the air: the sync word and the coded bits at 4800 bits a second.
function alert2AirSeconds(bytes) {
  const D = Math.max(0, bytes - 22), nf = Math.ceil(D / 32);
  return (80 + 656 + (D ? 2 * (8 * (D + 16 * nf) + 7) + 2 : 0)) / 4800;
}

// ── 1. one legacy burst's decode, each decoder ─────────────────────────────
const RECORDINGS = [
  ['binary_151.500_1957.iq8', 'BINARY', 'a strong burst, recorded off the air', 'a strong legacy ALERT burst recorded off the air (ALERT Binary, about 16 dB over the noise)', '1957=29'],
  ['binary_151.500_5304_weak.iq8', 'BINARY', 'a weak burst, recorded off the air', 'a weak legacy ALERT burst recorded off the air (ALERT Binary, about 9 dB over the noise)', '5304=41'],
  ['testrig_burst_240k.iq8', 'ENHANCED_IFLOWS', 'a test-rig burst (a three-second recording)', 'a test-rig burst, a three-second recording (Enhanced iFLOWS, two readings)', '4079=420 4080=121'],
];

function measureBursts(AlertDsp, fixDir, modes, P) {
  const out = { unit: 'milliseconds of one core to decode one burst (the middle of several runs; the least of them in `best`)', realRecordings: true, recordings: [] };
  for (const [name, format, short, what, expect] of RECORDINGS) {
    const f = fixture(fixDir, name);
    if (!f) { out.recordings.push({ recording: name, short, what, skipped: 'not in this copy of the agent' }); continue; }
    const row = { recording: name, short, what, format, windowSeconds: round(f.seconds, 2), ms: {}, best: {}, read: {}, expected: expect, readCorrectly: true };
    for (const [mode, lean] of modes) {
      const t = timeIt(() => AlertDsp.decodeWindow(f.re, f.im, { format: AlertDsp[format], minVotes: 4, minVotesCrc: 4, lean }), P.runs, P.minMs, P.warm);
      row.ms[mode] = t.ms; row.best[mode] = t.best;
      row.read[mode] = t.last.readings.map(r => r.sensorId + '=' + r.value).join(' ');
      if (!expect.split(' ').every(x => row.read[mode].split(' ').includes(x))) row.readCorrectly = false;
    }
    out.recordings.push(row);
  }
  let rows = out.recordings.filter(r => r.ms && r.format === 'BINARY');
  if (!rows.length) {
    // No recordings (an agent installed without its test folder): a made-up burst instead, and say so.
    out.realRecordings = false;
    const B = AlertDsp.encodeFrame(AlertDsp.BINARY, 1957, 29);
    const f = floats(AlertDsp.synthIq({ fs: FS, seconds: 1.25, amp: 30, snrDb: 16, seed: 7, startSec: 0.4, frames: [B], cfoHz: 300 }), 'synthesised');
    const row = { recording: 'synthesised', short: 'a made-up burst', what: 'a made-up ALERT Binary burst (this copy of the agent has no recordings): not comparable with results taken on the real recordings',
      format: 'BINARY', windowSeconds: 1.25, ms: {}, best: {}, read: {}, expected: '1957=29', readCorrectly: true };
    for (const [mode, lean] of modes) {
      const t = timeIt(() => AlertDsp.decodeWindow(f.re, f.im, { format: AlertDsp.BINARY, minVotes: 4, minVotesCrc: 4, lean }), P.runs, P.minMs, P.warm);
      row.ms[mode] = t.ms; row.best[mode] = t.best;
      row.read[mode] = t.last.readings.map(r => r.sensorId + '=' + r.value).join(' ');
      if (row.read[mode] !== row.expected) row.readCorrectly = false;
    }
    out.recordings.push(row);
    rows = [row];
  }
  // The typical live burst: the real ALERT Binary recordings (the live networks send Binary).
  out.typicalMs = Object.fromEntries(modes.map(([m]) => [m, round(mean(rows.map(r => r.ms[m])), 1)]));
  out.typicalBestMs = Object.fromEntries(modes.map(([m]) => [m, round(mean(rows.map(r => r.best[m])), 1)]));
  out.typicalNote = out.realRecordings ? 'the mean of the two ALERT Binary recordings' : 'a made-up burst: this copy of the agent has no recordings';
  return out;
}

// ── 2. an ALERT2 burst: the legacy try, then alert2-air.js ─────────────────
const ALERT2_RECORDINGS = [
  ['alert2_151.5375_3pdus.iq8', 'a real ALERT2 frame of 74 bytes recorded off the air', 74],
  ['alert2_151.5375_2pdus.iq8', 'a real ALERT2 frame of 33 bytes recorded off the air', 33],
];

function measureAlert2(agentDir, AlertDsp, fixDir, modes, typical, P, quick) {
  const airFile = path.join(agentDir, 'lib', 'devices', 'alert2-air.js');
  if (!fs.existsSync(airFile)) return { measured: false, why: 'this agent has no ALERT2 decoder (lib/devices/alert2-air.js)', bursts: [] };
  const Air = require(airFile);
  const out = { measured: true, unit: 'milliseconds of one core for one burst',
    note: 'A burst the legacy decoder reads nothing in is then tried as ALERT2, so an ALERT2 burst costs the legacy try plus the ALERT2 decode.', bursts: [] };
  const windows = [];
  for (const [name, what, len] of ALERT2_RECORDINGS) {
    const f = fixture(fixDir, name);
    if (f) windows.push({ name, short: 'a real frame of ' + len + ' bytes, recorded off the air', what, re: f.re, im: f.im, seconds: f.seconds, real: true, expectLen: len });
  }
  let Tx = null;
  try { Tx = require(path.join(agentDir, 'test', 'helpers', 'alert2-tx')); } catch (e) { out.synthNote = 'no made-up frames: this copy of the agent has no test/helpers/alert2-tx.js'; }
  if (Tx) {
    for (const bytes of quick ? [350] : [54, 150, 350, 500]) {
      const a = alert2AirSeconds(bytes), seconds = a + 0.9;
      const w = Tx.window({ seconds, snrDb: 20, seed: 5, frames: [{ startSec: 0.4, pdus: [pdu(bytes)], cfoHz: 600 }] });
      const made = typeof Tx.mantPdu === 'function' ? Tx.mantPdu(pdu(bytes)).length : null;      // 500 asked for is 502 made
      windows.push({ name: 'made_up_' + bytes + '_bytes', short: 'a made-up frame of ' + bytes + ' bytes (' + round(a, 2) + ' s on the air)', what: 'made up with the agent\'s own test transmitter: one frame of ' + bytes + ' bytes, ' + round(a, 2) + ' s on the air', re: w.re, im: w.im, seconds, real: false, expectLen: made });
    }
  }
  if (!windows.length) return { measured: false, why: 'this copy of the agent has neither ALERT2 recordings nor its test transmitter (its test folder is missing)', bursts: [] };
  for (const w of windows) {
    const row = { burst: w.name, short: w.short, what: w.what, real: w.real, windowSeconds: round(w.seconds, 2), legacyTryMs: {}, alert2Ms: null, totalMs: {}, frames: null, readCorrectly: true };
    for (const [mode, lean] of modes) {
      const t = timeIt(() => AlertDsp.decodeWindow(w.re, w.im, { format: AlertDsp.BINARY, minVotes: 4, minVotesCrc: 4, lean }), Math.min(P.runs, 5), P.minMs / 2);
      row.legacyTryMs[mode] = t.ms;
    }
    const a = timeIt(() => Air.receive(w.re, w.im), Math.min(P.runs, 5), P.minMs / 2, P.warm);
    row.alert2Ms = a.ms;
    row.frames = a.last.frames.map(f => (f.ok ? 'ok, ' + f.len + ' bytes' : 'not read: ' + f.error));
    const ok = a.last.frames.filter(f => f.ok);
    if (ok.length !== 1 || (w.expectLen && ok[0].len !== w.expectLen)) row.readCorrectly = false;
    for (const [mode] of modes) row.totalMs[mode] = round(row.legacyTryMs[mode] + row.alert2Ms, 1);
    out.bursts.push(row);
  }
  // The typical ALERT2 burst: the real recordings if there are any, else the made-up frames.
  const real = out.bursts.filter(r => r.real), basis = real.length ? real : out.bursts;
  out.typicalNote = real.length ? 'the mean of the real recordings' : 'the mean of the made-up frames: this copy of the agent has no ALERT2 recordings';
  out.typicalMs = Object.fromEntries(modes.map(([m]) => [m, round(mean(basis.map(r => r.totalMs[m])), 1)]));
  out.alert2DecodeAloneMs = round(mean(basis.map(r => r.alert2Ms)), 1);
  out.againstALegacyBurst = Object.fromEntries(modes.map(([m]) => [m, typical[m] ? round(out.typicalMs[m] / typical[m], 2) : null]));
  return out;
}

// ── 3. between bursts, a channel, each window ──────────────────────────────
function measureBetweenBursts(ctx, has, P, quick) {
  const rates = WINDOWS.filter(r => !has.rates || has.rates.includes(r));
  const out = { unit: 'cores one channel takes while nothing is on the air (0.05 is 5 % of one core)', windowsHz: rates, windowNotes: WINDOW_NOTE };
  if (!has.ownBench) out.agentOwnMeasure = { measured: false, why: 'this agent has no measurement of its own (lib/devices/sdr-bench.js came with agent 0.15)' };
  else if (ctx.memAvailableMb != null && ctx.memAvailableMb < 700) out.agentOwnMeasure = { measured: false, why: 'left out: it wants more memory than is free here (' + ctx.memAvailableMb + ' MB)' };
  else {
    try {
      const per = {}, watched = {};
      // The least of the runs, each already the best of three tries; a window a run, to keep it small.
      for (let k = 0; k < (quick ? 1 : 3); k++) for (const rate of rates) {
        const r = job(ctx, 'agentBench', { rates: [rate] });
        const pc = r.perChannel || r;
        per[rate] = per[rate] == null ? pc[rate] : Math.min(per[rate], pc[rate]);
        if (r.watched) watched[rate] = watched[rate] == null ? r.watched[rate] : Math.min(watched[rate], r.watched[rate]);
      }
      out.agentOwnMeasure = { measured: true, note: 'the agent\'s own measurement (lib/devices/sdr-bench.js), as its settings page shows it, rounded to 0.001 of a core',
        filterEverySample: per, filterOnlyAroundBursts: Object.keys(watched).length ? watched : null };
    } catch (e) { out.agentOwnMeasure = { measured: false, why: errText(e) }; }
  }
  const fine = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, round(v, 4)]));
  const asBench = runLoop(ctx, rates, null, P);
  out.asAgentMeasures = Object.assign({ note: 'the same loop as the agent\'s own measurement, unrounded: what the Raspberry Pi 4 figures are compared with' }, fine(asBench));
  if (has.ringS) {
    out.asDecoderThreadFirstChannel = Object.assign({ note: 'with the settings the decoder threads really run with since agent 0.19, spectrum on: a stick\'s first channel' },
      fine(runLoop(ctx, rates, { ringS: 5, capture: false, specHz: 1 }, P)));
    out.asDecoderThreadOtherChannels = Object.assign({ note: 'the same with the spectrum off: a stick\'s other channels' },
      fine(runLoop(ctx, rates, { ringS: 5, capture: false, specHz: 0 }, P)));
  } else {
    out.asDecoderThreadFirstChannel = Object.assign({ note: 'this agent is older than 0.19: its decoder threads run as its own measurement does' }, fine(asBench));
    out.asDecoderThreadOtherChannels = Object.assign({ note: 'this agent is older than 0.19: its decoder threads run as its own measurement does' }, fine(asBench));
  }
  // What the sizing uses: the dearer of a stick's first and other channels.
  out.aChannel = Object.fromEntries(rates.map(r => [r, Math.max(out.asDecoderThreadFirstChannel[r], out.asDecoderThreadOtherChannels[r])]));
  out.relativeTo240k = Object.fromEntries(rates.map(r => [r, round(asBench[r] / asBench[240000], 2)]));
  return out;
}

// ── 4. every core busy at once ─────────────────────────────────────────────
// One thread alone, then as many as the computer has, turn about, each run
// the same length. The least of the runs alone against the least of the runs
// together (each the middle thread of its run): anything else the computer is
// doing can only make a run slower, never faster.
function measureParallel(ctx, threads, has, P) {
  const rate = 1440000, cfg = has.ringS ? { ringS: 5, capture: false, specHz: 0 } : null;
  const needMb = 120 + 60 * threads;
  if (ctx.memAvailableMb != null && ctx.memAvailableMb < needMb + 100) {
    return { measured: false, why: 'left out: ' + threads + ' decoders at once want about ' + needMb + ' MB and ' + ctx.memAvailableMb + ' MB is free. The channel counts below take a channel to cost the same with every core busy, which flatters them.', threads, slowdown: 1 };
  }
  const run = (n) => job(ctx, 'together', { n, rate, cfg, ms: P.togetherMs });
  const alone = [], rounds = [];
  for (let r = 0; r < P.togetherRounds; r++) { alone.push(run(1)[0]); rounds.push(run(threads)); }
  alone.push(run(1)[0]);
  const solo = Math.min(...alone);
  const best = rounds.slice().sort((x, y) => median(x) - median(y))[0];
  const ratio = median(best) / solo;
  return { measured: true, note: 'the between-bursts loop at 1.44 MHz (set up as a decoder thread is) in ' + threads + ' threads started together and run for the same ' + P.togetherMs + ' ms, against one alone; ' + P.togetherRounds + ' runs together and ' + alone.length + ' alone, the least of each. 1.0 means a channel costs the same with every core busy. A ratio under 1 can only be something else disturbing the runs alone, so the slowdown is never put under 1.',
    threads, aloneCores: round(solo, 4), togetherCoresEach: best.map(v => round(v, 4)), ratio: round(ratio, 2), slowdown: Math.max(1, round(ratio, 2)) };
}

// ── 5. memory a channel ────────────────────────────────────────────────────
// K real decoder threads, six seconds of a 1.44 MHz window each → the memory this process then holds.
async function decoderThreadsRss(agentDir, K) {
  const rate = 1440000, WORKER = path.join(agentDir, 'lib', 'devices', 'sdr-worker.js');
  codecs(agentDir);                                            // as the agent's own main thread has it loaded
  const chunk = noiseChunk(chunkBytes(rate), 3);
  const total = Math.ceil(6 * rate * 2 / chunk.length);
  const ws = [];
  await Promise.all(Array.from({ length: K }, (_, k) => new Promise((resolve, reject) => {
    const cfg = { deviceRate: rate, channelOffsetHz: 100000 + 50000 * k, format: 'BINARY', gate: true, squelchDb: 8, minVotes: 4, minVotesCrc: 4,
      alert2: true, lean: true, watch: 'always', ringS: 5, capture: false, specHz: k === 0 ? 1 : 0 };
    const w = new Worker(WORKER, { workerData: { cfg, audio: false } });
    ws.push(w);
    let fed = 0;
    w.on('error', reject);
    w.on('message', (m) => {
      if (m.type === 'error') { reject(new Error(m.message)); return; }
      if (m.type !== 'ready' && m.type !== 'fed') return;
      if (fed >= total) { resolve(); return; }
      fed++;
      const ab = chunk.buffer.slice(0);
      w.postMessage({ type: 'iq', buf: ab }, [ab]);
    });
  })));
  await new Promise(r => setTimeout(r, 500));
  const rss = process.memoryUsage().rss;
  await Promise.all(ws.map(w => w.terminate()));
  return { rss };
}

// Real decoder threads in a fresh process of their own, against the same process with none.
function measureMemory(ctx) {
  const K = ctx.memAvailableMb != null && ctx.memAvailableMb < 700 ? 2 : 4;
  const none = [], some = [];
  for (let i = 0; i < 3; i++) { none.push(job(ctx, 'memory', { threads: 0 }).rss); some.push(job(ctx, 'memory', { threads: K }).rss); }
  const n = median(none), s = median(some);
  return { note: 'memory each of ' + K + ' real decoder threads adds on a 1.44 MHz window after six seconds of samples (the middle of three runs), with nothing queued. A decoder that falls behind may queue up to 20 s of samples on top (lib/devices/sdr.js, lines 70-81).',
    threads: K, mbPerChannel: round((s - n) / 1048576 / K, 1), mbAgentWithoutDecoders: round(n / 1048576, 1) };
}

// ── 6. one channel under traffic, through the agent's real decoder thread ──
// u8 through one sdr-worker.js, a chunk at a time, each acknowledged before
// the next (so nothing queues). `warm` goes through first, untimed: a few
// seconds of the same kind of traffic, so the JavaScript engine has compiled
// the decoders (a base station runs for weeks). Then the thread is reset and
// u8 is timed. Cores = the time it took / the seconds of signal.
function throughWorker(agentDir, cfg, u8, warm) {
  const WORKER = path.join(agentDir, 'lib', 'devices', 'sdr-worker.js');
  const CHUNK = 16384;                       // rtl_sdr's read at 240 ksps
  return new Promise((resolve, reject) => {
    const w = new Worker(WORKER, { workerData: { cfg, audio: false } });
    const blank = () => ({ bursts: 0, readings: 0, alert2Ok: 0, alert2Bad: 0 });
    let res = blank(), at = 0, t0 = 0n, warming = !!(warm && warm.length), src = warming ? warm : u8, done = false, timer = null;
    const finish = (err, val) => { if (done) return; done = true; clearTimeout(timer); w.terminate(); if (err) reject(err); else resolve(val); };
    const watchdog = () => { clearTimeout(timer); timer = setTimeout(() => finish(new Error('the decoder thread went quiet for ten minutes')), 600000); };
    watchdog();
    w.on('error', (e) => finish(e));
    w.on('exit', (code) => finish(new Error('the decoder thread stopped (' + code + ')')));
    w.on('message', (m) => {
      watchdog();
      if (m.type === 'error') { finish(new Error(m.message)); return; }
      if (m.type === 'burst') res.bursts++;
      if (m.type === 'decode') {
        res.readings += m.readings.length + (m.copies || []).length;
        if (m.alert2) for (const f of m.alert2.frames || []) { if (f.ok) res.alert2Ok++; else res.alert2Bad++; }
      }
      if (m.type !== 'ready' && m.type !== 'fed') return;
      if (warming && at >= src.length) {      // warmed up: now the real stream, timed
        warming = false; src = u8; at = 0; res = blank();
        w.postMessage({ type: 'reset' });
        t0 = process.hrtime.bigint();
      } else if (m.type === 'ready' && !warming) t0 = process.hrtime.bigint();
      if (!warming && at >= u8.length) {
        res.cores = Number(process.hrtime.bigint() - t0) / 1e9 / (u8.length / 2 / FS);
        finish(null, res); return;
      }
      const end = Math.min(src.length, at + CHUNK);
      const ab = src.buffer.slice(src.byteOffset + at, src.byteOffset + end);
      at += CHUNK;
      w.postMessage({ type: 'iq', buf: ab }, [ab]);
    });
  });
}

// When the bursts of a stream start: from two seconds in, the last of them
// early enough to be over, and decoded, before the stream ends.
function burstStarts(x) {
  const tail = Math.max(1.5, x.kind === 'alert2' ? alert2AirSeconds(x.bytes) + 0.6 : 0), a = [];
  if (x.kind !== 'quiet') for (let t = 2; t < x.seconds - tail; t += 60 / x.perMin) a.push(t);
  return a;
}

// An ALERT2 stream as a stick would send it (bytes), made a few seconds at a
// time: the agent's test transmitter works in numbers eight times that size,
// and half a minute of them at once would be 120 MB.
function alert2Stream(agentDir, x) {
  const Tx = require(path.join(agentDir, 'test', 'helpers', 'alert2-tx'));
  const starts = burstStarts(x), u8 = new Uint8Array(Math.round(x.seconds * FS) * 2);
  const cuts = [0];                          // where the pieces join: each just before a frame starts
  for (const t of starts) if (t - 0.05 - cuts[cuts.length - 1] >= 4) cuts.push(t - 0.05);
  cuts.push(x.seconds);
  for (let i = 0; i + 1 < cuts.length; i++) {
    const a = Math.round(cuts[i] * FS), b = Math.round(cuts[i + 1] * FS), frames = [];
    starts.forEach((t, k) => { if (t >= cuts[i] && t < cuts[i + 1]) frames.push({ startSec: t - a / FS, pdus: [pdu(x.bytes, 20000 + k)], cfoHz: ((k * 61) % 600) - 300 }); });
    const w = Tx.window({ seconds: (b - a) / FS, snrDb: 22, seed: 31 + i, frames });
    u8.set(toU8(w.re, w.im).subarray(0, (b - a) * 2), a * 2);
  }
  return u8;
}

// One scenario with one decoder, in a process of its own (the job "traffic":
// a decoder thread that has read a stream of bursts holds on to a good deal
// of memory, so each gets a fresh process). sc: { kind: 'quiet' | 'legacy' |
// 'alert2', perMin, bytes, seconds, warm: { kind, perMin, bytes, seconds } },
// lean: the decoder as the agent names it → { sent, cores, readings, alert2Ok, alert2Bad }.
async function trafficScenario(agentDir, sc, lean) {
  const { AlertDsp } = codecs(agentDir);
  const B = (id, v) => AlertDsp.encodeFrame(AlertDsp.BINARY, id, v);
  const make = (x) => {
    if (x.kind === 'quiet') return AlertDsp.synthIq({ fs: FS, seconds: x.seconds, amp: 30, snrDb: 25, seed: 3, bursts: [] });
    if (x.kind === 'legacy') return AlertDsp.synthIq({ fs: FS, seconds: x.seconds, amp: 30, snrDb: 25, seed: 21,
      bursts: burstStarts(x).map((t, k) => ({ startSec: t, frames: [B(1000 + k, (k * 53) % 2048)], cfoHz: ((k * 97) % 800) - 400, amp: 30 })) });
    return alert2Stream(agentDir, x);
  };
  const base = { deviceRate: FS, channelOffsetHz: 0, format: 'BINARY', gate: true, squelchDb: 8, minVotes: 4, minVotesCrc: 4, alert2: true, watch: 'always', ringS: 5, capture: false, specHz: 1 };
  const r = await throughWorker(agentDir, Object.assign({}, base, { lean }), make(sc), make(sc.warm));
  return { sent: burstStarts(sc).length, cores: r.cores, readings: r.readings, alert2Ok: r.alert2Ok, alert2Bad: r.alert2Bad };
}

function measureTraffic(ctx, modes, mode, has, quick, tick) {
  // The default decoder first; the quick run times no other.
  const mine = modes.filter(x => x[0] === mode), use = quick ? mine : mine.concat(modes.filter(x => x[0] !== mode));
  const S = quick ? 20 : 32;                 // seconds of signal a scenario
  const out = { note: 'One channel in a 240 kHz window through the agent\'s real decoder thread (lib/devices/sdr-worker.js): ' + S + ' s of made-up signal a scenario, 20-25 dB over the noise, fed as fast as the thread takes it after an untimed warm-up of ten seconds of the same kind of traffic. measuredCores = the time it took / the seconds of signal. The stream starts and ends with a quiet stretch, so it holds a little under the rate named: msABurst is what each burst added over a quiet channel, and cores = the quiet channel + the bursts a minute named x msABurst — the share of one core at that rate. 1 or more means the thread could not keep up with a real radio.',
    secondsOfSignal: S, decoders: use.map(m => m[0]), scenarios: [] };
  if (!has.alert2Tx) out.alert2Note = 'No ALERT2 traffic was tried: this copy of the agent has no test transmitter (test/helpers/alert2-tx.js).';
  // The untimed warm-ups: a burst a second for ten seconds (long frames: four of them).
  const warmLegacy = { kind: 'legacy', perMin: 60, seconds: 10 }, warmAlert2 = { kind: 'alert2', perMin: 60, bytes: 64, seconds: 10 }, warmLong = { kind: 'alert2', perMin: 24, bytes: 350, seconds: 13 };
  const q = job(ctx, 'traffic', { scenario: { kind: 'quiet', seconds: 10, warm: warmLegacy }, lean: mine[0][1] }).cores;
  out.quietCores = round(q, 4);
  const list = [
    ['legacy-busy', 'legacy ALERT, 8 bursts a minute', 'legacy ALERT, 8 bursts a minute (a busy day)', { kind: 'legacy', perMin: 8, warm: warmLegacy }],
    ['legacy-heavy', 'legacy ALERT, 20 bursts a minute', 'legacy ALERT, 20 bursts a minute (a storm)', { kind: 'legacy', perMin: 20, warm: warmLegacy }],
  ];
  if (has.alert2Tx) {
    list.push(['alert2-today', 'ALERT2, 20 frames a minute', 'ALERT2, 20 frames a minute of 74 bytes (about what one ALERT2 link carries today)', { kind: 'alert2', perMin: 20, bytes: 74, warm: warmAlert2 }]);
    list.push(['alert2-every-slot', 'ALERT2, every half-second slot used', 'ALERT2 with every half-second slot used: 120 frames a minute of 54 bytes (the most the protocol allows)', { kind: 'alert2', perMin: 120, bytes: 54, warm: warmAlert2 }]);
    if (!quick) list.push(['alert2-long-frames', 'ALERT2, long frames, 24 a minute', 'ALERT2, a 350-byte frame every 2.5 s: 24 a minute, on the air three quarters of the time', { kind: 'alert2', perMin: 24, bytes: 350, warm: warmLong }]);
  }
  for (const [name, short, what, sc] of list) {
    tick(what);
    const row = { scenario: name, short, what, kind: sc.kind, burstsAMinute: sc.perMin, sent: null, measuredCores: {}, msABurst: {}, cores: {}, read: {}, allRead: true, keepsUp: true };
    for (const [dec, lean] of use) {
      const x = job(ctx, 'traffic', { scenario: Object.assign({ seconds: S }, sc), lean });
      const got = sc.kind === 'alert2' ? x.alert2Ok : x.readings;
      const each = Math.max(0, x.cores - q) * S / x.sent;                 // seconds of one core a burst added
      const atRate = q + sc.perMin / 60 * each;
      row.sent = x.sent;
      row.measuredCores[dec] = round(x.cores, 4);
      row.msABurst[dec] = round(each * 1000, 1);
      row.cores[dec] = round(atRate, 4);
      row.read[dec] = got;
      if (got !== x.sent || (sc.kind === 'alert2' && x.alert2Bad)) row.allRead = false;
      if (atRate >= 1 || x.cores >= 1) row.keepsUp = false;
    }
    out.scenarios.push(row);
  }
  return out;
}

// ── 7. against a Raspberry Pi 4 ────────────────────────────────────────────
function againstPi4(out) {
  const bbm = out.betweenBursts && !out.betweenBursts.error ? out.betweenBursts.asAgentMeasures : null;
  const rates = bbm ? out.betweenBursts.windowsHz : [];
  const byWindow = {};
  for (const r of rates) {
    const ref = PI4.betweenBursts.cores[r];
    byWindow[r] = ref != null ? { pi4Cores: ref, thisCores: bbm[r], timesAPi4Core: round(ref / bbm[r], 2) }
      : { pi4Cores: null, thisCores: bbm[r], timesAPi4Core: null, note: PI4.betweenBursts.missing[r] || 'no Raspberry Pi 4 figure' };
  }
  const direct = Object.values(byWindow).map(x => x.timesAPi4Core).filter(v => v != null);
  const perCore = geomean(direct);
  const slow = out.parallel && out.parallel.slowdown ? Math.max(1, out.parallel.slowdown) : 1;
  const usable = out.machine.threads / slow;
  const full = out.burst && out.burst.typicalMs && out.burst.realRecordings ? out.burst.typicalMs.full : null;
  const rough = full ? round(PI4.burstFull.ms / full, 1) : null;
  const all = direct.concat(rough != null ? [rough] : []);
  const like = /^0\.15\./.test(out.agent.version || '');
  return {
    standing: 'Nobody has run this tool on a Raspberry Pi 4 yet. The comparison rests on three figures taken on a busy Pi 4 with an older agent, and one round figure from a sentence. Treat it as a rough guide.',
    perCore: round(perCore, 2),
    perCoreByMeasure: direct.length ? [round(Math.min(...direct), 2), round(Math.max(...direct), 2)] : null,
    perCoreLowestOfAll: all.length ? round(Math.min(...all), 2) : null,
    perCoreHighestOfAll: all.length ? round(Math.max(...all), 2) : null,
    usableCores: round(usable, 2),
    wholeComputer: perCore != null ? round(perCore * usable / PI4.cores, 2) : null,
    pi4CoresInAll: perCore != null ? round(perCore * usable, 1) : null,
    how: 'perCore: the geometric mean of (a Pi 4\'s cores a channel) / (this computer\'s cores a channel) between bursts, at the windows a Pi 4 figure exists for. wholeComputer: perCore x the cores this computer really has with all of them busy (' + out.machine.threads + ' / ' + slow + ') / a Pi 4\'s 4 cores.',
    likeForLike: like,
    likeForLikeNote: like ? null : 'The Pi 4 figures were taken with agent 0.15 and this is agent ' + out.agent.version + ': not strictly like for like.',
    betweenBursts: { reference: PI4.betweenBursts.what, source: PI4.betweenBursts.source, byWindow, caveats: PI4.betweenBursts.caveats },
    burstFull: { reference: PI4.burstFull.what + ': about ' + PI4.burstFull.ms + ' ms', source: PI4.burstFull.source, thisMs: full, timesAPi4Core: rough, approximate: true, caveat: PI4.burstFull.caveat },
    burstLean: { reference: PI4.burstLean.what, source: PI4.burstLean.source, pi4Ms: null, pi4ShareOfFull: PI4.burstLean.shareOfFull,
      thisShareOfFull: out.burst && out.burst.typicalMs && out.burst.typicalMs.lean && out.burst.typicalMs.full ? round(out.burst.typicalMs.lean / out.burst.typicalMs.full, 3) : null, caveat: PI4.burstLean.caveat },
    burstLight: { source: PI4.burstLight.source, pi4Ms: null, thisMs: out.burst && out.burst.typicalMs ? out.burst.typicalMs.light || null : null, caveat: PI4.burstLight.caveat },
    alert2: { source: PI4.alert2.source, pi4Ms: null, thisMs: out.alert2 && out.alert2.measured ? out.alert2.alert2DecodeAloneMs : null, caveat: PI4.alert2.caveat },
    underLoad: { factor: PI4.underLoad.factor, source: PI4.underLoad.source, caveat: PI4.underLoad.caveat },
    readAt: PI4.readAt,
  };
}

// ── 8. how many channels, from this computer's own figures ─────────────────
function backlogMb(rate, memMb) {            // lib/devices/sdr.js backlogLimit(), in MB
  const bps = rate * 2, mem = (memMb || 1024) * 1048576 * RULE.backlogMem;
  return Math.max(RULE.backlogMinS * bps, Math.min(RULE.backlogS * bps, mem)) / 1048576;
}

function capacity(out, mode) {
  const bb = out.betweenBursts && !out.betweenBursts.error ? out.betweenBursts.aChannel : null;
  const tr = out.traffic && !out.traffic.error ? out.traffic : null;
  if (!bb || !tr) return { error: 'not worked out: ' + (!bb ? 'the between-bursts' : 'the traffic') + ' measurement did not finish' };
  const slow = out.parallel && out.parallel.slowdown ? Math.max(1, out.parallel.slowdown) : 1;
  const usable = out.machine.threads / slow;
  const q = tr.quietCores;
  const work = (name) => { const r = tr.scenarios.find(x => x.scenario === name); return r && r.cores[mode] != null ? Math.max(0, r.cores[mode] - q) : null; };
  const levels = [['busy', 'legacy-busy', 'legacy ALERT, 8 bursts a minute on every channel (a busy day)'],
    ['storm', 'legacy-heavy', 'legacy ALERT, 20 bursts a minute on every channel (a storm)'],
    ['alert2Today', 'alert2-today', 'ALERT2 on every channel at 20 frames a minute (what one ALERT2 link carries today)']]
    .map(([key, sc, what]) => ({ key, what, burstWork: work(sc) })).filter(l => l.burstWork != null);
  const mem = out.memory && !out.memory.error ? out.memory : null;
  const rates = out.betweenBursts.windowsHz.filter(r => r !== 1200000);
  const byWindow = rates.map((rate) => {
    const row = { windowHz: rate, coresAChannel: {}, comfortably: {}, atTheVeryMost: {}, oneThreadOk: {}, memoryAllows: null };
    for (const l of levels) {
      const c = RULE.underLoad * bb[rate] + l.burstWork;
      row.coresAChannel[l.key] = round(c, 4);
      row.oneThreadOk[l.key] = c <= RULE.oneThread;
      row.comfortably[l.key] = c > RULE.oneThread ? 0 : Math.floor(RULE.shareKept * usable / c);
      row.atTheVeryMost[l.key] = c >= 1 ? 0 : Math.floor(usable / c);
    }
    if (mem) row.memoryAllows = Math.max(0, Math.floor((out.machine.memMb * RULE.memoryShare - mem.mbAgentWithoutDecoders) / (mem.mbPerChannel + backlogMb(rate, out.machine.memMb))));
    return row;
  });
  // The headline: a 1.44 MHz window, a storm of whichever kind costs more.
  const head = byWindow.find(r => r.windowHz === RULE.headlineWindow) || byWindow[byWindow.length - 1];
  const keys = levels.filter(l => l.key !== 'busy').map(l => l.key);
  let today = null;
  if (head && keys.length) {
    const cpu = Math.min(...keys.map(k => head.comfortably[k])), most = Math.min(...keys.map(k => head.atTheVeryMost[k]));
    const byMem = head.memoryAllows;
    const channels = byMem != null ? Math.min(cpu, byMem) : cpu;
    today = { channels, atTheVeryMost: byMem != null ? Math.min(most, byMem) : most, windowHz: head.windowHz,
      traffic: 'a storm on every channel: 20 bursts a minute, legacy ALERT or ALERT2, whichever costs more',
      limitedBy: byMem != null && byMem < cpu ? 'memory' : 'processor',
      sticksNeeded: Math.ceil(channels / RULE.maxChannelsAStick) };
  }
  return {
    how: 'For each channel: ' + RULE.underLoad + ' x its between-bursts cores (the margin a loaded Raspberry Pi 4 needed) + its burst work at the traffic named. "comfortably" keeps the total under ' + (RULE.shareKept * 100) + ' % of the cores this computer has with all of them busy, and each channel under ' + (RULE.oneThread * 100) + ' % of one core. "atTheVeryMost" uses all of it: do not plan to it. Memory: half of it, less the agent, over a channel\'s memory and the most it may queue.',
    decoder: mode, betweenBursts: 'filtering every sample (the setting the agent ships with)', usableCores: round(usable, 2),
    underLoadFactor: RULE.underLoad, shareKept: RULE.shareKept, oneThreadLimit: RULE.oneThread, maxChannelsAStick: RULE.maxChannelsAStick,
    trafficLevels: Object.fromEntries(levels.map(l => [l.key, { what: l.what, burstWorkCores: round(l.burstWork, 4) }])),
    byWindow, channelsToday: today,
    notMeasured: 'The radio sticks, USB, the rtl_sdr program, the agent\'s own main thread and the screen dashboard are not in these figures.',
  };
}

// The ALERT2 headroom rule, and the same question asked of this computer's own figures.
function headroom(out, mode) {
  const t = out.timesARaspberryPi4, m = out.machine;
  const cores = Math.min(m.cores, m.fastCores || m.cores);
  const coresOk = cores >= RULE.minCores;
  const per = t.perCore, lo = t.perCoreLowestOfAll, hi = t.perCoreHighestOfAll;
  const pass = per != null ? coresOk && per >= RULE.minTimesAPi4Core : null;
  let verdict = 'unknown';
  if (per != null) verdict = !coresOk ? 'fail' : lo >= RULE.minTimesAPi4Core ? 'pass' : hi < RULE.minTimesAPi4Core ? 'fail' : 'borderline';
  // Direct: one channel's thread, a 1.44 MHz window, every half-second ALERT2 slot used.
  let direct = { measured: false, why: 'the traffic measurement has no ALERT2 scenario' };
  const bb = out.betweenBursts && !out.betweenBursts.error ? out.betweenBursts.aChannel : null;
  const tr = out.traffic && !out.traffic.error ? out.traffic : null;
  const sc = tr && tr.scenarios.find(x => x.scenario === 'alert2-every-slot');
  if (bb && sc && sc.cores[mode] != null && bb[RULE.headlineWindow] != null) {
    const v = RULE.underLoad * bb[RULE.headlineWindow] + Math.max(0, sc.cores[mode] - tr.quietCores);
    direct = { measured: true, what: 'one channel in a 1.44 MHz window with every half-second ALERT2 slot used',
      formula: RULE.underLoad + ' x between-bursts cores at 1.44 MHz + (alert2-every-slot - quiet)', ofOneCore: round(v, 2), limit: RULE.oneThread, ok: v <= RULE.oneThread };
  }
  return {
    rule: 'at least ' + RULE.minCores + ' cores, each at least ' + RULE.minTimesAPi4Core + ' times a Raspberry Pi 4 core',
    why: 'Each channel is decoded on one core and can never use more than one. An ALERT2 channel with every half-second slot used is more work than one Raspberry Pi 4 core can do, however many cores there are.',
    minCores: RULE.minCores, minTimesAPi4Core: RULE.minTimesAPi4Core,
    cores, coresOk, timesAPi4Core: per, timesAPi4CoreLowest: lo, timesAPi4CoreHighest: hi,
    pass, verdict,
    verdictNote: verdict === 'borderline' ? 'Some measures put a core of this computer over ' + RULE.minTimesAPi4Core + ' times a Pi 4 core and some under: the Pi 4 figures are too few to call it.' : null,
    directCheck: direct,
  };
}

// Three set layouts, straight from this computer's own figures.
function sizingChecks(out, mode) {
  const bb = out.betweenBursts && !out.betweenBursts.error ? out.betweenBursts.aChannel : null;
  const tr = out.traffic && !out.traffic.error ? out.traffic : null;
  if (!bb || !tr) return { error: 'not worked out: a measurement it needs did not finish', checks: [] };
  const slow = out.parallel && out.parallel.slowdown ? Math.max(1, out.parallel.slowdown) : 1;
  const usable = out.machine.threads / slow, q = tr.quietCores, load = RULE.underLoad;
  const add = (n) => { const r = tr.scenarios.find(x => x.scenario === n); return r && r.cores[mode] != null ? Math.max(0, r.cores[mode] - q) : null; };
  const storm = add('legacy-heavy'), a2 = add('alert2-today'), every = add('alert2-every-slot');
  const checks = [];
  if (storm != null && bb[1440000] != null) { const v = 4 * (load * bb[1440000] + storm);
    checks.push({ check: 'four channels on one stick in a 1.44 MHz window (Flood-Net\'s four), a storm of legacy ALERT on every one', formula: '4 x (' + load + ' x between-bursts cores at 1.44 MHz + (legacy-heavy - quiet))', cores: round(v, 2), ofThisComputer: round(v / usable, 2), limit: RULE.shareKept, ok: v / usable <= RULE.shareKept }); }
  if (a2 != null && bb[960000] != null) { const v = 8 * (load * bb[960000] + a2);
    checks.push({ check: 'eight channels on two sticks in 960 kHz windows, ALERT2 on every one at today\'s rate', formula: '8 x (' + load + ' x between-bursts cores at 960 kHz + (alert2-today - quiet))', cores: round(v, 2), ofThisComputer: round(v / usable, 2), limit: RULE.shareKept, ok: v / usable <= RULE.shareKept }); }
  if (every != null && bb[1440000] != null) { const v = load * bb[1440000] + every;
    checks.push({ check: 'one ALERT2 channel with every half-second slot used, in a 1.44 MHz window', formula: load + ' x between-bursts cores at 1.44 MHz + (alert2-every-slot - quiet)', ofOneCore: round(v, 2), limit: RULE.oneThread, ok: v <= RULE.oneThread }); }
  return { decoder: mode, checks };
}

// Did this computer read everything it should have?
function selfCheck(out) {
  const problems = [];
  for (const r of (out.burst && out.burst.recordings) || []) if (r.ms && !r.readCorrectly) problems.push('the recording ' + r.recording + ' was not read as ' + r.expected);
  for (const r of (out.alert2 && out.alert2.bursts) || []) if (!r.readCorrectly) problems.push('the ALERT2 burst ' + r.burst + ' was not read (' + (r.frames || []).join('; ') + ')');
  for (const r of (out.traffic && out.traffic.scenarios) || []) if (!r.allRead) problems.push('under traffic (' + r.scenario + ') ' + JSON.stringify(r.read) + ' of ' + r.sent + ' were read');
  return { ok: problems.length === 0, problems,
    note: 'Every recording and every made-up burst has a known right answer. A computer that reads one wrongly should not be used until that is understood.' };
}

// ── the summary, in plain words ────────────────────────────────────────────
const pct = (v, d) => (v == null ? 'not measured' : (v * 100).toFixed(d == null ? 1 : d) + ' %');
const num = (v, d) => (v == null ? 'not measured' : Number(v).toFixed(d == null ? 0 : d));
const about = (v) => (v == null ? 'could not be worked out' : v >= 10 ? String(Math.round(v)) : Number(v).toFixed(1));
const khz = (hz) => (hz >= 1000000 ? (hz / 1e6) + ' MHz' : (hz / 1000) + ' kHz');
const padE = (s, n) => String(s).padEnd(n), padS = (s, n) => String(s).padStart(n);
function took(s) { const m = Math.floor(s / 60); return (m ? m + ' min ' : '') + Math.round(s - m * 60) + ' s'; }

function wrap(text, indent, width) {
  const out = [], pad = ' '.repeat(indent);
  let line = '';
  for (const word of text.split(/\s+/)) {
    if (line && (pad + line + ' ' + word).length > (width || 100)) { out.push(pad + line); line = word; } else line = line ? line + ' ' + word : word;
  }
  if (line) out.push(pad + line);
  return out;
}

function summarise(o, mode) {
  const L = [], m = o.machine, t = o.timesARaspberryPi4, c = o.capacity, h = o.alert2Headroom;
  const para = (s, indent) => { for (const l of wrap(s, indent == null ? 2 : indent)) L.push(l); };
  // "  - text", its later lines indented under the text; `lead` is what the first line starts with.
  const item = (s, lead) => { const k = lead || '  - '; for (const [i, l] of wrap(s, 0, 100 - k.length).entries()) L.push((i ? ' '.repeat(k.length) : k) + l); };
  const isPi4 = /Raspberry Pi 4/i.test(m.board || '');
  const arch = { x64: 'x86-64 (Intel or AMD)', arm64: 'ARM 64-bit', arm: 'ARM 32-bit' }[m.arch] || m.arch;
  const Mode = mode.charAt(0).toUpperCase() + mode.slice(1);
  const today = c && c.channelsToday;

  L.push('open-ALERT base station benchmark ' + VERSION + ' — ' + (o.mode === 'quick' ? 'quick run (rougher figures; use the full run for a result to share)' : 'full run') + ', took ' + took(o.tookSeconds));
  L.push('');
  L.push('  Computer   ' + (m.cpuModel || 'processor not named') + (m.board ? ' — ' + m.board : ''));
  L.push('             ' + m.cores + ' core' + (m.cores === 1 ? '' : 's') + (m.logicalCpus > m.cores ? ' (' + m.logicalCpus + ' threads)' : '') + ', ' + (m.memMb / 1024).toFixed(1) + ' GB memory, ' + arch
    + (m.virtualMachine ? ', a virtual machine' : '') + (m.container ? ', inside a container' : ''));
  L.push('  System     ' + (m.distro || m.os) + ', Node ' + m.node);
  L.push('  Agent      RPi ALERT ' + (o.agent.version || '(version not found)') + ' in ' + o.agent.dir);
  if (o.label) L.push('  Label      ' + o.label);
  L.push('');
  for (const w of o.warnings) para('NOTE: ' + w);
  if (o.warnings.length) L.push('');

  L.push('IN SHORT');
  if (t.perCore != null) {
    L.push('  One core of this computer     about ' + about(t.perCore) + ' times a Raspberry Pi 4 core (' + about(t.perCoreLowestOfAll) + ' to ' + about(t.perCoreHighestOfAll) + ', depending on the measure)');
    L.push('  The whole computer            about ' + about(t.wholeComputer) + ' Raspberry Pi 4s');
  } else L.push('  Against a Raspberry Pi 4      could not be worked out');
  if (today) L.push('  Channels it carries today     ' + today.channels + ' comfortably, ' + today.atTheVeryMost + ' at the very most (in a ' + khz(today.windowHz) + ' window, a storm on every channel)');
  else L.push('  Channels it carries today     could not be worked out');
  const verdictWord = { pass: 'PASSES', fail: 'DOES NOT PASS', borderline: 'TOO CLOSE TO CALL', unknown: 'COULD NOT BE WORKED OUT' }[h.verdict];
  L.push('  ALERT2 headroom rule          ' + verdictWord + (h.timesAPi4Core != null ? ' — ' + h.cores + ' core' + (h.cores === 1 ? '' : 's') + ' (' + h.minCores + ' needed), each about ' + about(h.timesAPi4Core) + ' times a Pi 4 core (' + h.minTimesAPi4Core + ' needed)' : ''));
  L.push('  Decoder check                 ' + (o.selfCheck.ok ? 'every recording and test burst was read correctly on this computer' : 'FAILED — see the end of this report'));
  L.push('');
  para(isPi4 ? 'This computer is itself a Raspberry Pi 4, so "times a Raspberry Pi 4" here compares it with the few older Pi 4 figures on file. Please send this result in: one run on an idle Pi 4 can replace all of them (results/README.md).'
    : 'The two Raspberry Pi 4 lines rest on very few Pi 4 figures, taken on a busy Pi 4: read "How far to trust the Raspberry Pi 4 comparison" below. The channel count does not use them.');
  para('This measures decoding only. The radio sticks, USB and the screen dashboard are not in it' + (isPi4 ? '.' : ', and nothing here has been run with a real radio stick on a computer that is not a Raspberry Pi.'));
  L.push('');

  L.push('WHAT WAS MEASURED ON THIS COMPUTER');
  para('All with the agent\'s own decoder code. A "core" is one of the processor\'s cores: each channel is decoded on one of them. "Legacy ALERT" is the older protocol most stations still send; ALERT2 is its successor.');
  L.push('');
  if (o.burst && !o.burst.error) {
    const modes = Object.keys(o.burst.typicalMs);
    L.push('  Decoding one burst — milliseconds of one core' + (o.burst.realRecordings ? ', on real recordings off the air' : ''));
    L.push('    ' + padE('', 52) + modes.map(x => padS(x.charAt(0).toUpperCase() + x.slice(1), 8)).join(''));
    for (const r of o.burst.recordings) if (r.ms) L.push('    ' + padE(r.short, 52) + modes.map(x => padS(num(r.ms[x]), 8)).join(''));
    para(Mode + ' is the decoder the agent uses unless it is told otherwise.' + (o.burst.realRecordings ? '' : ' This copy of the agent has no recordings, so a made-up burst was used.'), 4);
  } else para('Decoding one burst — NOT MEASURED: ' + ((o.burst && o.burst.error) || 'no result'));
  L.push('');
  if (o.alert2 && o.alert2.measured) {
    L.push('  An ALERT2 burst — milliseconds of one core (' + Mode + ' decoder)');
    for (const r of o.alert2.bursts) L.push('    ' + padE(r.short, 52) + padS(num(r.totalMs[mode]), 8) + '   (' + num(r.legacyTryMs[mode]) + ' tried as a legacy burst first, then ' + num(r.alert2Ms) + ' as ALERT2)');
    if (o.alert2.againstALegacyBurst[mode]) L.push('    A typical ALERT2 burst costs ' + num(o.alert2.againstALegacyBurst[mode], 1) + ' times a legacy burst, because it is tried as one first.');
  } else para('An ALERT2 burst — NOT MEASURED: ' + ((o.alert2 && (o.alert2.why || o.alert2.error)) || 'no result'));
  L.push('');
  if (o.betweenBursts && !o.betweenBursts.error) {
    const b = o.betweenBursts;
    L.push('  A channel while nothing is on the air — share of one core');
    para('The "window" is the slice of the band a radio stick listens to at once; a wider one holds channels further apart and costs more.', 4);
    for (const r of b.windowsHz) L.push('    ' + padE(khz(r) + ' window', 52) + padS(pct(b.aChannel[r]), 8) + (r === 1440000 ? '   (the window Flood-Net\'s four channels need)' : ''));
    const pl = o.parallel;
    if (pl && pl.measured && pl.threads > 1) L.push('    With all ' + pl.threads + ' cores busy at once, a channel costs ' + (pl.slowdown > 1.005 ? num(pl.slowdown, 2) + ' times as much as on its own.' : 'the same as on its own.'));
    else if (pl && pl.measured === false) para('With every core busy at once — NOT MEASURED, ' + pl.why, 4);
    else if (pl && pl.error) para('With every core busy at once — NOT MEASURED: ' + pl.error, 4);
  } else para('A channel while nothing is on the air — NOT MEASURED: ' + ((o.betweenBursts && o.betweenBursts.error) || 'no result'));
  L.push('');
  if (o.memory && !o.memory.error) L.push('  Memory — ' + num(o.memory.mbPerChannel) + ' MB for each channel, on top of ' + num(o.memory.mbAgentWithoutDecoders) + ' MB for the agent itself.');
  else para('Memory — NOT MEASURED: ' + ((o.memory && (o.memory.why || o.memory.error)) || 'no result'));
  L.push('');
  if (o.traffic && !o.traffic.error) {
    L.push('  One channel under traffic, through the agent\'s real decoder thread — share of one core (' + Mode + ' decoder, 240 kHz window)');
    L.push('    ' + padE('nothing on the air', 52) + padS(pct(o.traffic.quietCores), 8));
    for (const r of o.traffic.scenarios) L.push('    ' + padE(r.short, 52) + padS(pct(r.cores[mode]), 8) + '   ' + r.read[mode] + ' of ' + r.sent + ' read' + (r.keepsUp ? '' : '   CANNOT KEEP UP'));
    para('8 legacy bursts a minute is a busy day and 20 a storm.' + (o.traffic.alert2Note ? '' : ' 20 ALERT2 frames a minute is about what one ALERT2 link carries today; every half-second slot used (120 a minute) is the most the protocol allows.'), 4);
    if (o.traffic.alert2Note) para(o.traffic.alert2Note, 4);
  } else para('One channel under traffic — NOT MEASURED: ' + ((o.traffic && o.traffic.error) || 'no result'));
  L.push('');

  L.push('HOW MANY CHANNELS');
  if (c && !c.error) {
    para('Worked out from this computer\'s own figures above, not from the Raspberry Pi 4 comparison. Each channel is counted as ' + c.underLoadFactor + ' times its share while nothing is on the air (the margin a loaded Raspberry Pi 4 needed) plus its traffic. "Comfortably" keeps half the computer free for a storm, the radio sticks\' own work, the web page and a screen dashboard. "At the very most" leaves nothing: do not plan to it.');
    L.push('');
    const lv = Object.keys(c.trafficLevels), head = { busy: 'busy day', storm: 'storm', alert2Today: 'ALERT2 today' };
    L.push('    ' + padE('Channels: comfortably / at the very most', 44) + lv.map(k => padS(head[k], 16)).join(''));
    for (const r of c.byWindow) L.push('    ' + padE('in a ' + khz(r.windowHz) + ' window', 44) + lv.map(k => padS(r.comfortably[k] + ' / ' + r.atTheVeryMost[k], 16)).join(''));
    para('busy day: legacy ALERT, 8 bursts a minute on every channel. storm: 20 a minute. ALERT2 today: every channel an ALERT2 link at 20 frames a minute.', 4);
    if (today) {
      const memRow = c.byWindow.find(r => r.windowHz === today.windowHz);
      if (memRow && memRow.memoryAllows != null) L.push('    Memory is enough for ' + memRow.memoryAllows + ' channels in a ' + khz(today.windowHz) + ' window' + (today.limitedBy === 'memory' ? ': memory, not the processor, is what limits this computer.' : '.'));
      if (today.channels > 0) para('A radio stick carries at most ' + c.maxChannelsAStick + ' channels, and only channels close enough together to fit its window, so ' + today.channels + ' channels need at least ' + today.sticksNeeded + ' stick' + (today.sticksNeeded === 1 ? '' : 's') + '.', 4);
    }
    if (o.sizing && o.sizing.checks.length) {
      L.push('');
      L.push('  Three set layouts, checked the same way:');
      for (const k of o.sizing.checks) item(k.check + ': ' + (k.ofOneCore != null ? pct(k.ofOneCore, 0) + ' of one core (the limit is ' + pct(k.limit, 0) + ')' : pct(k.ofThisComputer, 0) + ' of this computer (the limit is ' + pct(k.limit, 0) + ')'), k.ok ? '    fits      ' : '    TOO MUCH  ');
    }
  } else para('Could not be worked out: ' + ((c && c.error) || 'no result'));
  L.push('');

  L.push('THE ALERT2 HEADROOM RULE: ' + verdictWord);
  para('The rule: ' + h.rule + '.');
  para('Why: ' + h.why);
  if (h.timesAPi4Core != null) para('This computer: ' + h.cores + ' core' + (h.cores === 1 ? '' : 's') + (h.coresOk ? '' : ' — too few') + '; one core is about ' + about(h.timesAPi4Core) + ' times a Raspberry Pi 4 core (between ' + about(h.timesAPi4CoreLowest) + ' and ' + about(h.timesAPi4CoreHighest) + ', measure by measure).' + (h.verdictNote ? ' ' + h.verdictNote : ''));
  if (m.fastCores != null && m.fastCores < m.logicalCpus) para('This processor has cores of different speeds: ' + m.fastCores + ' fast and ' + (m.logicalCpus - m.fastCores) + ' slower. Only the fast ones are counted for the rule, and the per-core figures above are most likely those of a fast core.');
  if (h.directCheck.measured) {
    para('The same question asked of this computer\'s own figures, without the Raspberry Pi 4 ones: ' + h.directCheck.what + ' would take ' + pct(h.directCheck.ofOneCore, 0) + ' of the one core it runs on (the limit is ' + pct(h.directCheck.limit, 0) + '): ' + (h.directCheck.ok ? 'it fits.' : 'it does NOT fit.'));
    if (h.pass != null && h.pass !== h.directCheck.ok) para('The rule and the direct measurement disagree. The direct measurement is this computer\'s own and is the one to believe; the rule leans on the thin Raspberry Pi 4 figures.');
  }
  L.push('');

  L.push('HOW FAR TO TRUST THE RASPBERRY PI 4 COMPARISON');
  para(t.standing);
  item(PI4.betweenBursts.source + '. These are ' + PI4.betweenBursts.what + '. ' + PI4.betweenBursts.caveats.join(' '));
  item(PI4.burstFull.source + '. ' + PI4.burstFull.caveat);
  item(PI4.underLoad.source + '. ' + PI4.underLoad.caveat);
  para('There is no Raspberry Pi 4 figure at all for a 960 kHz or 2.4 MHz window, for the Lean or Light decoders in milliseconds, or for ALERT2. (Line numbers are those of ' + PI4.readAt + '.)');
  if (t.perCore != null) {
    const bw = t.betweenBursts.byWindow, parts = Object.keys(bw).filter(r => bw[r].timesAPi4Core != null).map(r => khz(Number(r)) + ' ' + about(bw[r].timesAPi4Core));
    para('Measure by measure, a core of this computer came out at: ' + parts.join(', ') + (t.burstFull.timesAPi4Core != null ? '; and by the round "a second or so" for a Full decode, about ' + about(t.burstFull.timesAPi4Core) : '') + ' times a Raspberry Pi 4 core.' + (t.likeForLikeNote ? ' ' + t.likeForLikeNote : ''));
  }
  L.push('');

  L.push('NOT MEASURED');
  item('The radio sticks themselves, USB, the rtl_sdr program that reads them, the agent\'s main thread and web page, and the screen dashboard (a browser: about half a Raspberry Pi 4 core by itself).');
  item('Heat. This run lasts minutes; a fanless computer in a hot cabinet may slow down after hours.' + (m.tempCAtStart != null ? ' The processor was at ' + m.tempCAtStart + ' °C at the start and ' + m.tempCAtEnd + ' °C at the end.' : ''));
  if (!isPi4) item('Real radio. Nothing here has been run with a real radio stick on a computer that is not a Raspberry Pi.');
  L.push('');
  if (!o.selfCheck.ok) {
    L.push('DECODER CHECK FAILED');
    for (const p of o.selfCheck.problems) item(p);
    para(o.selfCheck.note);
    L.push('');
  }
  if (o.errors.length) {
    L.push('PARTS THAT DID NOT RUN');
    for (const e of o.errors) item(e);
    L.push('');
  }
  L.push('TO SHARE THIS RESULT');
  para('Run it again with --out=result.json (the full run, on an idle computer) and send that file: firmware/bench/results/README.md in the open-ALERT repository says how. The file holds these figures and a description of the computer — no names, addresses or serial numbers.');
  return L;
}

// ── the command line ───────────────────────────────────────────────────────
const NEEDS_MB = 450;       // free memory wanted before starting: on four cores the tool itself peaks at about 350 MB

const USAGE = [
  TOOL + ' ' + VERSION + ' — how many channels will this computer carry?',
  '',
  '  node open-alert-bench.js [AGENT_FOLDER] [options]',
  '',
  'AGENT_FOLDER is a copy of the RPi ALERT agent: the folder that holds bin, lib, vendor and',
  'test (or a release unpacked, which holds that folder). Left out, it looks in',
  DEFAULT_AGENT_DIRS.join(' and then ') + '.',
  '',
  '  --quick          a quick look: about a minute on a desktop-class computer, rougher figures',
  '  --full           the full run, about four minutes (what runs if you choose neither)',
  '  --json           print the full figures as JSON instead of the summary',
  '  --out=FILE       also save the full figures as JSON in FILE, to send to somebody',
  '  --label=TEXT     what this computer is, in your own words (make, model, processor)',
  '  --fixtures=DIR   take the recorded bursts from DIR (the test/fixtures folder of a release)',
  '  --show=FILE      measure nothing: print the summary of a result saved earlier with --out',
  '  --quiet          do not show progress while it runs',
  '  --help, --version',
  '',
  'It needs no network, no radio stick and no administrator rights, and changes nothing: it only',
  'reads AGENT_FOLDER, uses the processor and, while it runs, up to about 350 MB of memory (it will',
  'not start with under ' + NEEDS_MB + ' MB free). Run it on an otherwise idle computer. A slower computer',
  'takes longer in proportion (a Raspberry Pi 4: about five times as long).',
  '',
  'It ends with status 0 when everything was measured and every test burst was read correctly,',
  '1 when a part did not run or a burst was read wrongly, 2 when it could not start.',
].join('\n');

function parseArgs(argv) {
  const o = { mode: 'full', json: false, out: null, label: null, fixtures: null, show: null, quiet: false, dir: null, job: null, help: false, version: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const value = (name) => {
      if (a === name) { if (i + 1 >= argv.length) throw new Error(name + ' needs a value'); return argv[++i]; }
      return a.startsWith(name + '=') ? a.slice(name.length + 1) : undefined;
    };
    let v;
    if (a === '--quick') o.mode = 'quick';
    else if (a === '--full') o.mode = 'full';
    else if (a === '--json') o.json = true;
    else if (a === '--quiet') o.quiet = true;
    else if (a === '--help' || a === '-h') o.help = true;
    else if (a === '--version') o.version = true;
    else if ((v = value('--out')) !== undefined) o.out = v;
    else if ((v = value('--label')) !== undefined) o.label = v;
    else if ((v = value('--fixtures')) !== undefined) o.fixtures = v;
    else if ((v = value('--show')) !== undefined) o.show = v;
    else if ((v = value('--job')) !== undefined) o.job = v;           // this tool starting itself: see job()
    else if (a.startsWith('-')) throw new Error('unknown option ' + a);
    else if (o.dir == null) o.dir = a;
    else throw new Error('more than one agent folder given');
  }
  return o;
}

// A folder as it goes into the result, which is made to be passed on: the two
// usual places in full, anything else by its last two names only, so that no
// home directory (and so no person's name) travels with the figures.
function shortDir(d) {
  if (DEFAULT_AGENT_DIRS.includes(d)) return d;
  const parts = d.split(path.sep).filter(Boolean);
  return (parts.length > 2 ? '.../' : path.sep) + parts.slice(-2).join('/');
}

const isAgentDir = (d) => fs.existsSync(path.join(d, 'lib', 'meganet-codecs.js')) && fs.existsSync(path.join(d, 'vendor', 'meganet', 'alert-dsp.js'));

function findAgent(given) {
  if (given) {
    const d = path.resolve(given);
    if (isAgentDir(d)) return d;
    if (isAgentDir(path.join(d, 'agent'))) return path.join(d, 'agent');     // a release unpacked, or a checkout
    throw new Error(d + ' is not an RPi ALERT agent folder (it has no lib/meganet-codecs.js). Give the folder that holds bin, lib, vendor and test.');
  }
  for (const d of DEFAULT_AGENT_DIRS) if (isAgentDir(d)) return d;
  throw new Error('No RPi ALERT agent found in ' + DEFAULT_AGENT_DIRS.join(' or ') + '. Give its folder: node open-alert-bench.js /path/to/agent');
}

// The result out: the summary (or, with --json, the figures) on standard output, and the figures in --out's file.
function emit(out, args, say) {
  const json = JSON.stringify(out, null, 2);
  if (args.out) {
    try { fs.writeFileSync(path.resolve(args.out), json + '\n'); say('The full figures are in ' + path.resolve(args.out)); }
    catch (e) { console.error(TOOL + ': could not write ' + args.out + ': ' + errText(e)); process.exitCode = 1; }
  }
  process.stdout.write((args.json ? json : out.summary.text.join('\n')) + '\n');
}

// The measuring this tool starts itself to do (job() above): name → (agent folder, what to do) → the result.
const JOBS = {
  burst: (dir, p) => measureBursts(codecs(dir).AlertDsp, p.fixDir, p.modes, p.P),
  alert2: (dir, p) => measureAlert2(dir, codecs(dir).AlertDsp, p.fixDir, p.modes, p.typical, p.P, p.quick),
  agentBench: (dir, p) => require(path.join(dir, 'lib', 'devices', 'sdr-bench')).measure(p.rates),
  loop: (dir, p) => benchLoop(dir, p.rate, p.cfg, p.seconds, p.tries, p.minTryMs),
  together: (dir, p) => together(dir, p.n, p.rate, p.cfg, p.ms),
  memory: (dir, p) => decoderThreadsRss(dir, p.threads),
  traffic: (dir, p) => trafficScenario(dir, p.scenario, p.lean),
};

async function runJob(name) {
  let reply;
  try {
    if (!Object.prototype.hasOwnProperty.call(JOBS, name)) throw new Error('there is no job "' + name + '"');
    const order = JSON.parse(fs.readFileSync(0, 'utf8'));
    const ok = await JOBS[name](order.agentDir, order.params || {});
    reply = { ok, peakMb: Math.round(process.resourceUsage().maxRSS / 1024) };
  } catch (e) { reply = { error: errText(e) }; }
  process.stdout.write(JSON.stringify(reply) + '\n', () => process.exit(0));
}

async function main() {
  let args;
  try { args = parseArgs(process.argv.slice(2)); } catch (e) { console.error(TOOL + ': ' + errText(e) + '\n\n' + USAGE); process.exit(2); }
  if (args.help) { console.log(USAGE); return; }
  if (args.version) { console.log(TOOL + ' ' + VERSION); return; }
  if (Number(process.versions.node.split('.')[0]) < 18) { console.error(TOOL + ': this needs Node 18 or later; this is Node ' + process.version + '.'); process.exit(2); }
  if (args.job) { await runJob(args.job); return; }
  const say = (s) => { if (!args.quiet) process.stderr.write(s + '\n'); };
  if (args.show) {
    let text, saved = null;
    try { text = fs.readFileSync(path.resolve(args.show), 'utf8'); } catch (e) { console.error(TOOL + ': could not read ' + args.show + ': ' + errText(e)); process.exit(2); }
    try { saved = JSON.parse(text); } catch (e) { /* not JSON: said below */ }
    if (!saved || !/^open-alert-bench\//.test(saved.schema || '') || !saved.summary || !Array.isArray(saved.summary.text)) { console.error(TOOL + ': ' + args.show + ' is not a result saved by this tool.'); process.exit(2); }
    emit(saved, args, say);
    return;
  }
  let agentDir;
  try { agentDir = findAgent(args.dir); } catch (e) { console.error(TOOL + ': ' + errText(e)); process.exit(2); }

  const quick = args.mode === 'quick';
  const P = quick ? { runs: 3, minMs: 300, warm: 4, loopSeconds: 0.4, loopTries: 5, loopPasses: 2, loopMinTryMs: 40, togetherMs: 400, togetherRounds: 2 }
    : { runs: 7, minMs: 1500, warm: 6, loopSeconds: 1.0, loopTries: 5, loopPasses: 3, loopMinTryMs: 80, togetherMs: 1000, togetherRounds: 3 };
  const STEPS = 6;
  let stepNo = 0;
  const step = (s) => say('[' + (++stepNo) + '/' + STEPS + '] ' + s);
  const tick = (s) => say('      ' + s);

  // What this agent has, read from its files: nothing of it is loaded into this process.
  const dspSrc = fs.readFileSync(path.join(agentDir, 'vendor', 'meganet', 'alert-dsp.js'), 'utf8');
  const planSrc = slurp(path.join(agentDir, 'web', 'sdr-plan.js')) || '';
  const planRates = /\bRATES\s*=\s*\[([\d,\s]+)\]/.exec(planSrc);
  const has = { lean: /opts\.lean/.test(dspSrc), light: /lean === 2/.test(dspSrc), ringS: /ringS/.test(dspSrc),
    rates: planRates ? planRates[1].split(',').map(Number).filter(Boolean) : null,
    ownBench: fs.existsSync(path.join(agentDir, 'lib', 'devices', 'sdr-bench.js')),
    alert2Tx: fs.existsSync(path.join(agentDir, 'test', 'helpers', 'alert2-tx.js')) && fs.existsSync(path.join(agentDir, 'lib', 'devices', 'alert2-air.js')) };
  const modes = [['full', false]].concat(has.lean ? [['lean', true]] : [], has.light ? [['light', 2]] : []);
  const mode = has.lean ? 'lean' : 'full';       // the decoder the agent uses unless told otherwise
  const fixDir = args.fixtures ? path.resolve(args.fixtures) : path.join(agentDir, 'test', 'fixtures');
  const t00 = Date.now();
  const out = {
    schema: SCHEMA,
    tool: { name: TOOL, version: VERSION, peakMemoryMb: null },
    mode: args.mode,
    label: args.label || null,
    startedAt: new Date().toISOString(),
    tookSeconds: null,
    machine: machine(),
    agent: {
      dir: shortDir(agentDir),
      version: firstMatch(path.join(agentDir, 'package.json'), /"version"\s*:\s*"([^"]+)"/),
      decoderCommit: firstMatch(path.join(agentDir, 'vendor', 'meganet', 'SOURCE'), /^commit:\s*(.+)$/m),
      decoders: modes.map(x => x[0]),
      defaultDecoder: mode,
      recordings: !fs.existsSync(fixDir) ? null : args.fixtures ? 'a folder given with --fixtures' : 'the agent\'s own test/fixtures',
    },
    warnings: [],
    errors: [],
    sectionSeconds: {},
  };
  const M = out.machine;
  if (M.memAvailableMb != null && M.memAvailableMb < NEEDS_MB) {
    console.error(TOOL + ': only ' + M.memAvailableMb + ' MB of memory is free on this computer and this needs ' + NEEDS_MB + ' MB to run without getting in anything\'s way. Nothing was measured.'
      + (M.agentRunning ? ' A base station is running here: stopping it for the few minutes this takes would free enough.' : ''));
    process.exit(2);
  }
  // A base station running here comes first: this run takes the lowest
  // priority, set before anything is started so that all of it inherits it.
  M.lowPriority = false;
  if (M.agentRunning) { try { os.setPriority(os.constants.priority.PRIORITY_LOW); M.lowPriority = true; } catch (e) { /* not allowed: carry on as we are */ } }
  if (M.agentRunning) out.warnings.push('A base station (or the rtl_sdr program) is running on this computer. It keeps working: this run ' + (M.lowPriority ? 'gives way to it (it runs at the lowest priority) and ' : '') + 'touches none of its files. But the figures below will come out worse than the computer really is. For a result to rely on, run this while the base station is stopped.');
  else if (M.loadAvgAtStart[0] > 0.5) out.warnings.push('This computer was already busy when the run began (load ' + M.loadAvgAtStart[0] + '), so the figures will come out worse than it really is. Run it again when the computer is idle.');
  if (M.nodeMajor < 20) out.warnings.push('This ran under Node ' + process.versions.node + '. On the one computer where the same bursts were timed under Node 18, 20 and 22 (firmware/bench/results/README.md), Node 18 took about twice as long over a burst as the other two with the decoder the agent uses. So a newer Node on this computer may well carry more than this result says.');
  if (quick) out.warnings.push('This was the quick run. Its figures are rougher than the full run\'s (they can be 10 to 20 % out): use the full run before deciding anything, and for any result you share.');
  if (!fs.existsSync(fixDir)) out.warnings.push('This copy of the agent has no test recordings (' + (args.fixtures ? 'the folder given with --fixtures' : 'its test/fixtures folder') + ' is missing), so a made-up burst was timed' + (has.alert2Tx ? '' : ' and ALERT2 was not measured') + '. For figures that compare with other computers, download and unpack an RPi ALERT release and give its agent folder (firmware/bench/README.md says how).');
  if (M.cpuLimitCores != null && M.cpuLimitCores < M.logicalCpus) out.warnings.push('This container is allowed ' + M.cpuLimitCores + ' of the computer\'s ' + M.logicalCpus + ' processor threads: the figures are for that allowance, not the whole computer.');

  say(TOOL + ' ' + VERSION + ': the ' + args.mode + ' run on RPi ALERT ' + (out.agent.version || '?') + ' in ' + agentDir);
  const ctx = { agentDir, quiet: args.quiet, memAvailableMb: M.memAvailableMb, peakJobMb: 0 };
  const section = (name, fn) => {
    const t0 = Date.now();
    try { out[name] = fn(); } catch (e) { out[name] = { error: errText(e) }; out.errors.push(name + ': ' + errText(e)); }
    out.sectionSeconds[name] = round((Date.now() - t0) / 1000, 1);
  };

  step('Decoding recorded bursts with each decoder (' + modes.map(x => x[0]).join(', ') + ')');
  section('burst', () => job(ctx, 'burst', { fixDir, modes, P }));
  step('Decoding ALERT2 bursts');
  section('alert2', () => job(ctx, 'alert2', { fixDir, modes, typical: (out.burst && out.burst.typicalMs) || {}, P, quick }));
  step('A channel while nothing is on the air, at each window');
  section('betweenBursts', () => measureBetweenBursts(ctx, has, P, quick));
  step('The same with every core busy at once (' + M.threads + ' thread' + (M.threads === 1 ? '' : 's') + ')');
  section('parallel', () => measureParallel(ctx, M.threads, has, P));
  step('Memory a channel');
  section('memory', () => measureMemory(ctx));
  step('One channel under traffic, through the agent\'s real decoder thread');
  section('traffic', () => measureTraffic(ctx, modes, mode, has, quick, tick));

  out.timesARaspberryPi4 = againstPi4(out);
  out.capacity = capacity(out, mode);
  out.alert2Headroom = headroom(out, mode);
  out.sizing = sizingChecks(out, mode);
  out.selfCheck = selfCheck(out);
  M.loadAvgAtEnd = os.loadavg().map(v => round(v, 2));
  M.tempCAtEnd = temperatureC();
  out.tookSeconds = round((Date.now() - t00) / 1000, 1);
  // This process, and the largest of the measuring processes it started.
  out.tool.peakMemoryMb = Math.round(process.resourceUsage().maxRSS / 1024) + ctx.peakJobMb;
  const today = out.capacity.channelsToday || null;
  out.summary = {
    timesAPi4Core: out.timesARaspberryPi4.perCore,
    timesAPi4Whole: out.timesARaspberryPi4.wholeComputer,
    channelsToday: today ? today.channels : null,
    channelsAtTheVeryMost: today ? today.atTheVeryMost : null,
    alert2Headroom: out.alert2Headroom.verdict,
    decoderCheck: out.selfCheck.ok,
    text: null,
  };
  out.summary.text = summarise(out, mode);

  emit(out, args, say);
  if (out.errors.length || !out.selfCheck.ok) process.exitCode = 1;
}

main().catch((e) => { console.error(TOOL + ': ' + ((e && e.stack) || e)); process.exit(1); });
