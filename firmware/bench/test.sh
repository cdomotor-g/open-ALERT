#!/usr/bin/env bash
# firmware/bench/test.sh — run the benchmark's quick mode and check what it gives back.
#
#   firmware/bench/test.sh [AGENT_DIRECTORY]
#
# AGENT_DIRECTORY is a copy of the RPi ALERT agent (the folder that holds bin,
# lib, vendor and test). Left out: $OPEN_ALERT_AGENT_DIR, then
# /home/user/RPi_ALERT/agent, then /usr/lib/open-alert-base/agent.
#
# It checks that:
#   - the tool starts, and says plainly what is wrong when given nonsense;
#   - a quick run finishes, with no network at all and (when this test is run
#     as root) as a user with no rights, and reads every recording correctly;
#   - the result holds every field, with sensible values;
#   - the summary has every section, and a saved result prints back the same;
#   - nothing in the agent directory was changed.
#
# About a minute and a half. Needs only bash and Node 18 or later.
set -euo pipefail

here=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
bench="$here/open-alert-bench.js"
node_bin=${NODE:-node}

agent=${1:-${OPEN_ALERT_AGENT_DIR:-}}
if [ -z "$agent" ]; then
  for d in /home/user/RPi_ALERT/agent /usr/lib/open-alert-base/agent; do
    if [ -f "$d/lib/meganet-codecs.js" ]; then agent=$d; break; fi
  done
fi
if [ -z "$agent" ] || [ ! -f "$agent/lib/meganet-codecs.js" ]; then
  echo "test.sh: no RPi ALERT agent directory found. Give one: firmware/bench/test.sh /path/to/agent" >&2
  exit 2
fi

tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
chmod 755 "$tmp"

passed=0
ok() { passed=$((passed + 1)); echo "ok    $*"; }
fail() { echo "FAIL  $*" >&2; exit 1; }

echo "Testing $bench"
echo "  with $("$node_bin" --version) on the agent in $agent"

# ── it starts, and refuses nonsense plainly ──────────────────────────────────
"$node_bin" --check "$bench" || fail "the script does not parse"
ok "the script parses"

"$node_bin" "$bench" --help > "$tmp/help.txt" || fail "--help did not exit 0"
for word in --quick --full --json --out --label --show; do
  grep -q -- "$word" "$tmp/help.txt" || fail "--help does not mention $word"
done
ok "--help lists every option"

"$node_bin" "$bench" --version | grep -Eq '^open-alert-bench [0-9]+\.[0-9]+\.[0-9]+$' || fail "--version"
ok "--version"

# $1: what it is; $2: the exit status wanted; $3: a word the message must hold; the rest: arguments.
refuses() {
  local what=$1 want=$2 word=$3 rc=0
  shift 3
  "$node_bin" "$bench" "$@" > "$tmp/out.txt" 2> "$tmp/err.txt" || rc=$?
  [ "$rc" -eq "$want" ] || fail "$what: exit status $rc, not $want"
  grep -q -- "$word" "$tmp/err.txt" || fail "$what: the message does not say '$word'"
  if grep -Eq '^ +at .*\(|node:internal' "$tmp/err.txt"; then fail "$what: a stack trace instead of a plain message"; fi
  ok "$what is refused plainly (exit $want)"
}
refuses "a directory that is not an agent" 2 "not an RPi ALERT agent directory" "$tmp"
refuses "an unknown option" 2 "unknown option" --no-such-option
refuses "a saved result that is not one" 2 "not a result saved by this tool" --show="$tmp/help.txt"

# ── a quick run: no network, no rights ───────────────────────────────────────
# With no network at all when this system lets a test take it away, and as the
# user "nobody" when the test itself runs as root.
run=()
how="as this user, with the network left as it is"
if [ "$(id -u)" -eq 0 ] && command -v setpriv > /dev/null && command -v unshare > /dev/null \
   && unshare -n setpriv --reuid=65534 --regid=65534 --clear-groups "$node_bin" -e 'for (const f of process.argv.slice(1)) require("node:fs").readFileSync(f)' "$bench" "$agent/lib/meganet-codecs.js" 2> /dev/null; then
  run=(unshare -n setpriv --reuid=65534 --regid=65534 --clear-groups)
  how="as the user nobody, with no network at all"
elif command -v unshare > /dev/null && unshare -rn true 2> /dev/null; then
  run=(unshare -rn)
  how="with no network at all"
fi

touch "$tmp/before"
sleep 1
echo "  the quick run, $how (about a minute) ..."
rc=0
"${run[@]}" "$node_bin" "$bench" "$agent" --quick --json > "$tmp/result.json" 2> "$tmp/progress.txt" || rc=$?
if [ "$rc" -ne 0 ]; then
  cat "$tmp/progress.txt" >&2
  "$node_bin" -e 'const j=JSON.parse(require("node:fs").readFileSync(process.argv[1],"utf8")); console.error(JSON.stringify({errors:j.errors,selfCheck:j.selfCheck},null,1))' "$tmp/result.json" >&2 || true
  fail "the quick run ended with exit status $rc"
fi
ok "the quick run finished, $how"

grep -q '^\[6/6\]' "$tmp/progress.txt" || fail "no progress was shown while it ran"
ok "progress was shown on the error stream, and only the figures on standard output"

changed=$(find "$agent" -newer "$tmp/before" 2> /dev/null | head -5)
[ -z "$changed" ] || fail "the run changed something in the agent directory: $changed"
ok "nothing in the agent directory was changed"

# ── the result has every field ───────────────────────────────────────────────
"$node_bin" - "$tmp/result.json" <<'EOF' || fail "the result is missing something (above)"
'use strict';
const j = JSON.parse(require('node:fs').readFileSync(process.argv[2], 'utf8'));
const problems = [];
const typeOf = (v) => (v === null ? 'null' : Array.isArray(v) ? 'array' : typeof v);
// path: dots; "[]" means every item of an array (which must not be empty). types: 'number', 'string|null', …
function need(path, types) {
  const want = types.split('|');
  const walk = (v, parts, at) => {
    if (!parts.length) {
      if (!want.includes(typeOf(v))) problems.push(at + ' is ' + typeOf(v) + ', not ' + types);
      else if (typeOf(v) === 'number' && !Number.isFinite(v)) problems.push(at + ' is not a finite number');
      return;
    }
    const [p, ...rest] = parts;
    if (p === '[]') {
      if (!Array.isArray(v) || !v.length) { problems.push(at + ' is not a list with something in it'); return; }
      v.forEach((x, i) => walk(x, rest, at + '[' + i + ']'));
      return;
    }
    if (v === null || typeof v !== 'object' || !(p in v)) { problems.push((at ? at + '.' : '') + p + ' is missing'); return; }
    walk(v[p], rest, (at ? at + '.' : '') + p);
  };
  walk(j, path.split('.'), '');
}
const check = (cond, what) => { if (!cond) problems.push(what); };

const W = ['240000', '960000', '1200000', '1440000', '2400000'];
const D = ['full', 'lean', 'light'];
const each = (prefix, keys, types) => keys.forEach(k => need(prefix + '.' + k, types));

need('schema', 'string'); need('tool.name', 'string'); need('tool.version', 'string');
need('mode', 'string'); need('label', 'string|null'); need('startedAt', 'string'); need('tookSeconds', 'number');

each('machine', ['cpuModel', 'board', 'governor', 'distro'], 'string|null');
each('machine', ['arch', 'os', 'node', 'v8'], 'string');
each('machine', ['cores', 'threads', 'logicalCpus', 'memMb'], 'number');
each('machine', ['physicalCores', 'fastCores', 'cpuLimitCores', 'cpuMHz', 'cpuMaxMHz', 'memAvailableMb', 'tempCAtStart', 'tempCAtEnd'], 'number|null');
each('machine', ['virtualMachine', 'container', 'agentRunning'], 'boolean');
need('machine.loadAvgAtStart.[]', 'number'); need('machine.loadAvgAtEnd.[]', 'number');

need('agent.dir', 'string'); need('agent.version', 'string'); need('agent.decoderCommit', 'string|null');
need('agent.decoders.[]', 'string'); need('agent.defaultDecoder', 'string'); need('agent.recordingsDir', 'string');
need('warnings', 'array'); need('errors', 'array');
each('sectionSeconds', ['burst', 'alert2', 'betweenBursts', 'parallel', 'memory', 'traffic'], 'number');

need('burst.unit', 'string'); need('burst.realRecordings', 'boolean'); need('burst.typicalNote', 'string');
each('burst.recordings.[]', ['recording', 'short', 'what', 'format', 'expected'], 'string');
need('burst.recordings.[].windowSeconds', 'number'); need('burst.recordings.[].readCorrectly', 'boolean');
for (const d of D) { need('burst.recordings.[].ms.' + d, 'number'); need('burst.recordings.[].best.' + d, 'number'); need('burst.recordings.[].read.' + d, 'string'); }
each('burst.typicalMs', D, 'number'); each('burst.typicalBestMs', D, 'number');

need('alert2.measured', 'boolean'); need('alert2.unit', 'string'); need('alert2.note', 'string'); need('alert2.typicalNote', 'string');
each('alert2.bursts.[]', ['burst', 'short', 'what'], 'string');
each('alert2.bursts.[]', ['real', 'readCorrectly'], 'boolean');
each('alert2.bursts.[]', ['windowSeconds', 'alert2Ms'], 'number');
need('alert2.bursts.[].frames.[]', 'string');
for (const d of D) { need('alert2.bursts.[].legacyTryMs.' + d, 'number'); need('alert2.bursts.[].totalMs.' + d, 'number'); }
each('alert2.typicalMs', D, 'number'); each('alert2.againstALegacyBurst', D, 'number'); need('alert2.alert2DecodeAloneMs', 'number');

need('betweenBursts.unit', 'string'); need('betweenBursts.windowsHz.[]', 'number');
for (const k of ['agentOwnMeasure.filterEverySample', 'agentOwnMeasure.filterOnlyAroundBursts', 'asAgentMeasures', 'asDecoderThreadFirstChannel', 'asDecoderThreadOtherChannels', 'aChannel', 'relativeTo240k']) each('betweenBursts.' + k, W, 'number');

each('parallel', ['threads', 'aloneCores', 'ratio', 'slowdown'], 'number'); need('parallel.togetherCoresEach.[]', 'number'); need('parallel.note', 'string');
each('memory', ['threads', 'mbPerChannel', 'mbAgentWithoutDecoders'], 'number'); need('memory.note', 'string');

need('traffic.note', 'string'); need('traffic.secondsOfSignal', 'number'); need('traffic.quietCores', 'number'); need('traffic.decoders.[]', 'string');
each('traffic.scenarios.[]', ['scenario', 'short', 'what', 'kind'], 'string');
each('traffic.scenarios.[]', ['burstsAMinute', 'sent'], 'number');
each('traffic.scenarios.[]', ['allRead', 'keepsUp'], 'boolean');
for (const k of ['cores', 'msABurst', 'read']) need('traffic.scenarios.[].' + k + '.lean', 'number');

const T = 'timesARaspberryPi4';
each(T, ['standing', 'how', 'readAt'], 'string');
each(T, ['perCore', 'perCoreLowestOfAll', 'perCoreHighestOfAll', 'usableCores', 'wholeComputer', 'pi4CoresInAll'], 'number');
need(T + '.perCoreByMeasure.[]', 'number'); need(T + '.likeForLike', 'boolean');
each(T + '.betweenBursts', ['reference', 'source'], 'string'); need(T + '.betweenBursts.caveats.[]', 'string');
for (const w of W) need(T + '.betweenBursts.byWindow.' + w + '.thisCores', 'number');
for (const w of ['240000', '1200000', '1440000']) { need(T + '.betweenBursts.byWindow.' + w + '.pi4Cores', 'number'); need(T + '.betweenBursts.byWindow.' + w + '.timesAPi4Core', 'number'); }
for (const w of ['960000', '2400000']) { need(T + '.betweenBursts.byWindow.' + w + '.pi4Cores', 'null'); need(T + '.betweenBursts.byWindow.' + w + '.note', 'string'); }
each(T + '.burstFull', ['reference', 'source', 'caveat'], 'string'); each(T + '.burstFull', ['thisMs', 'timesAPi4Core'], 'number'); need(T + '.burstFull.approximate', 'boolean');
each(T + '.burstLean', ['reference', 'source', 'caveat'], 'string'); each(T + '.burstLean', ['thisShareOfFull', 'pi4ShareOfFull'], 'number');
each(T + '.burstLight', ['source', 'caveat'], 'string'); need(T + '.burstLight.thisMs', 'number'); need(T + '.burstLight.pi4Ms', 'null');
each(T + '.alert2', ['source', 'caveat'], 'string'); need(T + '.alert2.thisMs', 'number'); need(T + '.alert2.pi4Ms', 'null');
need(T + '.underLoad.factor', 'number'); each(T + '.underLoad', ['source', 'caveat'], 'string');

const L = ['busy', 'storm', 'alert2Today'];
each('capacity', ['how', 'decoder', 'betweenBursts', 'notMeasured'], 'string');
each('capacity', ['usableCores', 'underLoadFactor', 'shareKept', 'oneThreadLimit', 'maxChannelsAStick'], 'number');
for (const l of L) { need('capacity.trafficLevels.' + l + '.what', 'string'); need('capacity.trafficLevels.' + l + '.burstWorkCores', 'number'); }
need('capacity.byWindow.[].windowHz', 'number'); need('capacity.byWindow.[].memoryAllows', 'number');
for (const l of L) { for (const k of ['coresAChannel', 'comfortably', 'atTheVeryMost']) need('capacity.byWindow.[].' + k + '.' + l, 'number'); need('capacity.byWindow.[].oneThreadOk.' + l, 'boolean'); }
each('capacity.channelsToday', ['channels', 'atTheVeryMost', 'windowHz', 'sticksNeeded'], 'number'); each('capacity.channelsToday', ['traffic', 'limitedBy'], 'string');

const H = 'alert2Headroom';
each(H, ['rule', 'why', 'verdict'], 'string'); need(H + '.verdictNote', 'string|null');
each(H, ['minCores', 'minTimesAPi4Core', 'cores', 'timesAPi4Core', 'timesAPi4CoreLowest', 'timesAPi4CoreHighest'], 'number');
each(H, ['coresOk', 'pass'], 'boolean');
need(H + '.directCheck.measured', 'boolean'); each(H + '.directCheck', ['what', 'formula'], 'string'); each(H + '.directCheck', ['ofOneCore', 'limit'], 'number'); need(H + '.directCheck.ok', 'boolean');

need('sizing.decoder', 'string'); each('sizing.checks.[]', ['check', 'formula'], 'string'); need('sizing.checks.[].limit', 'number'); need('sizing.checks.[].ok', 'boolean');
need('selfCheck.ok', 'boolean'); need('selfCheck.problems', 'array'); need('selfCheck.note', 'string');
each('summary', ['timesAPi4Core', 'timesAPi4Whole', 'channelsToday', 'channelsAtTheVeryMost'], 'number');
need('summary.alert2Headroom', 'string'); need('summary.decoderCheck', 'boolean'); need('summary.text.[]', 'string');

// Do the values make sense?
if (!problems.length) {
  check(j.schema === 'open-alert-bench/1', 'schema is ' + j.schema);
  check(j.mode === 'quick', 'mode is ' + j.mode);
  check(j.errors.length === 0, 'parts did not run: ' + j.errors.join('; '));
  check(j.selfCheck.ok && j.selfCheck.problems.length === 0, 'the decoder check failed: ' + j.selfCheck.problems.join('; '));
  check(j.burst.realRecordings === true, 'the real recordings were not used');
  check(j.burst.recordings.length === 3 && j.burst.recordings.every(r => r.readCorrectly), 'a recording was not read correctly');
  check(j.burst.recordings[0].read.lean === '1957=29' && j.burst.recordings[1].read.light === '5304=41', 'the two ALERT Binary recordings did not read 1957=29 and 5304=41');
  check(j.burst.typicalMs.full > j.burst.typicalMs.lean && j.burst.typicalMs.lean > j.burst.typicalMs.light && j.burst.typicalMs.light > 0, 'Full, Lean, Light are not in that order of cost');
  check(j.alert2.measured && j.alert2.bursts.filter(b => b.real).length === 2 && j.alert2.bursts.every(b => b.readCorrectly), 'the ALERT2 recordings were not read');
  check(j.alert2.againstALegacyBurst.lean > 1, 'an ALERT2 burst should cost more than a legacy burst');
  check(W.every(w => j.betweenBursts.aChannel[w] > 0 && j.betweenBursts.aChannel[w] < 1), 'a between-bursts share is not between 0 and 1');
  check(j.betweenBursts.aChannel['2400000'] > j.betweenBursts.aChannel['240000'], 'a wide window should cost more than a narrow one');
  check(j.parallel.slowdown >= 1 && j.parallel.togetherCoresEach.length === j.machine.threads, 'the every-core-busy figures do not add up');
  check(j.memory.mbPerChannel > 5 && j.memory.mbPerChannel < 500, 'memory a channel is ' + j.memory.mbPerChannel + ' MB');
  const names = j.traffic.scenarios.map(s => s.scenario);
  check(['legacy-busy', 'legacy-heavy', 'alert2-today', 'alert2-every-slot'].every(n => names.includes(n)), 'a traffic scenario is missing: ' + names.join(', '));
  check(j.traffic.scenarios.every(s => s.allRead && s.read.lean === s.sent), 'not every burst under traffic was read');
  check(j.capacity.byWindow.length === 4, 'the channel table should have four windows');
  check(j.capacity.channelsToday.atTheVeryMost >= j.capacity.channelsToday.channels && j.capacity.channelsToday.channels >= 0, 'the channel counts are the wrong way round');
  check(['pass', 'borderline', 'fail'].includes(j.alert2Headroom.verdict), 'the verdict is ' + j.alert2Headroom.verdict);
  check(j.alert2Headroom.pass === (j.alert2Headroom.cores >= 4 && j.alert2Headroom.timesAPi4Core >= 2.5), 'the headroom rule was not applied as written');
  check(j.sizing.checks.length === 3, 'there should be three set layouts');
  check(j.summary.alert2Headroom === j.alert2Headroom.verdict && j.summary.channelsToday === j.capacity.channelsToday.channels, 'the summary does not match the figures');
  const text = j.summary.text.join('\n');
  for (const h of ['IN SHORT', 'WHAT WAS MEASURED ON THIS COMPUTER', 'HOW MANY CHANNELS', 'THE ALERT2 HEADROOM RULE', 'HOW FAR TO TRUST THE RASPBERRY PI 4 COMPARISON', 'NOT MEASURED', 'TO SHARE THIS RESULT'])
    check(text.includes(h), 'the summary has no "' + h + '" section');
  check(/taken on a busy Pi 4/.test(text) && /docs\/roadmap\.md, lines 112-113/.test(text), 'the summary does not say where the Raspberry Pi 4 figures come from');
  check(/not a Raspberry Pi/.test(text) || /Raspberry Pi 4/.test(j.machine.board || ''), 'the summary does not say that no real radio stick has been run off a Raspberry Pi');
  check(!/MegaNet/.test(text), 'the summary says MegaNet: the product is Flood-Net');
  check(j.summary.text.every(l => l.length <= 125), 'a summary line is over 125 characters');
}
if (problems.length) { for (const p of problems) console.error('  - ' + p); process.exit(1); }
EOF
ok "the result holds every field, with sensible values, and every burst was read correctly"

# ── a saved result prints back ───────────────────────────────────────────────
"$node_bin" "$bench" --show="$tmp/result.json" > "$tmp/summary.txt" || fail "--show did not print the saved result"
grep -q '^IN SHORT$' "$tmp/summary.txt" || fail "--show printed no summary"
"$node_bin" "$bench" --show="$tmp/result.json" --json --quiet --out="$tmp/copy.json" > "$tmp/again.json" || fail "--show --json --out"
cmp -s "$tmp/result.json" "$tmp/again.json" || fail "--show --json does not give the saved figures back unchanged"
cmp -s "$tmp/result.json" "$tmp/copy.json" || fail "--out did not save the same figures"
ok "a saved result prints back: the summary, and the same figures with --json and --out"

echo
sed -n '/^IN SHORT$/,/^$/p' "$tmp/summary.txt"
echo "All $passed checks passed."
