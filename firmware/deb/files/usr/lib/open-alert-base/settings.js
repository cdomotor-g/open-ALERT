'use strict';
// Read and change the agent's settings file for the "open-alert-base" command.
//
// It is always run as the agent's own user (rpi-alert), never as root: the
// settings folder belongs to that user, so root must not read or write in it
// (a file there could be a link to somewhere else). And it changes settings
// only through the agent's own settings code (lib/config.js), so every value
// is held to the agent's own rules and the file is written the agent's own way.
//
//   settings.js apply <profile.json>   merge a profile's "settings" into the settings file
//   settings.js summary                the settings that matter to the platform, NAME=value a line
//   settings.js differ <profile.json>  where the settings now differ from a profile, a line each
//   settings.js looser <profile.json>  which of the settings the profile holds are looser than
//                                      the profile has them, a line each
//   settings.js hold <profile.json>    put those back as the profile has them (the start
//                                      command runs this each time, before the agent starts)
//   settings.js held <profile.json>    the settings a profile holds, on one line
//
// In a profile, a setting given as null means "as the agent has it by itself":
// the agent's own default where this agent knows the setting, and taken out of
// the file where it does not (a setting that only a newer agent has).
//
// Three of the dashboard's settings (RPi ALERT 0.24) are held by the profile:
// where the profile asks for the closed value, the settings file — which the
// agent's own user can write — may ask for that or something closer still,
// never for something more open. See HELD below.

const fs = require('node:fs');
const path = require('node:path');

const AGENT = process.env.OPEN_ALERT_BASE_AGENT || '/usr/lib/open-alert-base/agent';

function die(msg, code) { process.stderr.write('open-alert-base: ' + msg + '\n'); process.exit(code || 1); }
function isObj(v) { return v && typeof v === 'object' && !Array.isArray(v); }

function agentConfig() {
  let lib;
  try { lib = require(path.join(AGENT, 'lib', 'config.js')); }
  catch (e) { die('cannot load the agent\'s settings code from ' + AGENT + ' (' + e.message + ')', 2); }
  if (typeof lib.Config !== 'function') die('this agent\'s settings code is not the kind this command knows (no Config)', 2);
  return lib;
}

function readProfile(file) {
  let p;
  try { p = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { die('cannot read the profile ' + file + ': ' + e.message, 2); }
  if (!isObj(p) || !isObj(p.settings)) die('the profile ' + file + ' has no "settings"', 2);
  return p;
}

// A profile's settings, flattened: [['web.port', 8080], ['web.bind', null], …].
function leaves(obj, prefix, out) {
  for (const k of Object.keys(obj)) {
    const p = prefix ? prefix + '.' + k : k;
    if (isObj(obj[k])) leaves(obj[k], p, out); else out.push([p, obj[k]]);
  }
  return out;
}
function getPath(obj, p) { let v = obj; for (const k of p.split('.')) { if (!isObj(v) || !(k in v)) return undefined; v = v[k]; } return v; }
function setPath(obj, p, value) {
  const keys = p.split('.'); let o = obj;
  for (const k of keys.slice(0, -1)) { if (!isObj(o[k])) o[k] = {}; o = o[k]; }
  o[keys[keys.length - 1]] = value;
}
function dropPath(obj, p) {
  const keys = p.split('.'); let o = obj;
  for (const k of keys.slice(0, -1)) { if (!isObj(o[k])) return false; o = o[k]; }
  const last = keys[keys.length - 1];
  if (!(last in o)) return false;
  delete o[last];
  return true;
}
// The settings a profile holds, and what "looser" means for each. A profile
// holds one only when it asks for the closed value; otherwise the settings
// file decides it alone.
//   web.bind          held when the profile keeps the dashboard to this computer
//                     (a loopback address): any other address, or none (every
//                     address), is looser.
//   web.behindProxy   held when the profile has true: false is looser (a request
//                     on this computer's own address is then taken for this
//                     computer itself whatever name it asks for).
//   web.requireLogin  held when the profile has "all": "settings" is looser
//                     (looking then needs no password).
const loopback = (v) => typeof v === 'string' && (/^127(\.\d{1,3}){3}$/.test(v) || v === '::1');
const HELD = [
  { key: 'web.bind', holds: loopback, looser: (have) => !loopback(have) },
  { key: 'web.behindProxy', holds: (want) => want === true, looser: (have) => have !== true },
  { key: 'web.requireLogin', holds: (want) => want === 'all', looser: (have) => have !== 'all' },
];
// The held settings where `data` is looser than the profile: [{ key, have, want }].
function looserThan(profile, data) {
  const out = [];
  for (const h of HELD) {
    const want = getPath(profile.settings, h.key);
    if (!h.holds(want)) continue;
    const have = getPath(data, h.key);
    if (h.looser(have)) out.push({ key: h.key, have, want });
  }
  return out;
}

const show = (v) => (v === undefined ? 'not set' : v === '' ? 'empty' : typeof v === 'string' ? v : JSON.stringify(v));

function load() {
  const lib = agentConfig();
  const c = new lib.Config();
  let exists = true;
  try { fs.lstatSync(c.file); } catch (_) { exists = false; }
  c.load();
  return { c, exists, defaults: typeof lib.defaults === 'function' ? lib.defaults() : {} };
}

// The agent says in one line what it found wrong when it loaded its settings.
// Three kinds are only remarks: the file was read and is in use — values that
// made no sense went back to their defaults (from 0.24, for the dashboard's
// own, to the cautious value), keys the agent does not know were named, or
// channels that one stick cannot hear together were left out. Anything else
// means the file is there and was NOT used (it could not be read, it is a
// link, it is not valid JSON): the agent is on its built-in settings — from
// 0.24 with the cautious values for the dashboard where it cannot tell what
// the file meant.
function unusable(c) {
  if (!c.loadError) return '';
  if (/^settings file has problems \(defaults used for them[);]|^settings file: |^channels one stick cannot hear together/.test(c.loadError)) return '';
  return c.loadError;
}

function apply(file) {
  const profile = readProfile(file);
  const { c, exists, defaults } = load();
  // A file that is there and cannot be read or understood is never written
  // over: the agent would save its built-in settings in its place, and what
  // the file held (the Flood-Net token, the channels) would be gone.
  if (c.loadError && /not valid JSON/.test(c.loadError)) {
    die('the settings file ' + c.file + ' is not valid JSON, so it was left alone. Put it right or move it away, then run this again. (' + c.loadError + ')');
  }
  if (unusable(c)) {
    die('the settings file ' + c.file + ' could not be read by the agent\'s user, so it was left alone. Put it right or move it away, then run this again. (' + c.loadError + ')');
  }
  if (c.loadError) process.stderr.write('open-alert-base: note — ' + c.loadError + '\n');
  const set = {}, unset = [];
  for (const [p, v] of leaves(profile.settings, '', [])) {
    if (v !== null) setPath(set, p, v);
    else if (getPath(defaults, p) !== undefined) setPath(set, p, getPath(defaults, p));
    else unset.push(p);
  }
  const r = c.update(set);
  if (!r.ok) die('the profile was not applied, because the agent refuses these settings: ' + r.errors.join('; '));
  const removed = unset.filter(p => dropPath(c.data, p));
  if (removed.length || !exists) c.save();
  const changed = r.changed.concat(removed.map(p => p + ' (taken out)'));
  if (!exists) console.log('Settings file ' + c.file + ' made, with the profile "' + (profile.profile || path.basename(file, '.json')) + '".');
  else if (changed.length) console.log('Settings changed: ' + changed.join(', ') + '.');
  else console.log('Settings were already as the profile has them.');
}

// Where a list of addresses points: "https://floodwarning.net", each once.
function hostsOf(list) {
  const out = [];
  for (const u of Array.isArray(list) ? list : []) { try { const h = new URL(u).origin; if (!out.includes(h)) out.push(h); } catch (_) {} }
  return out;
}

function summary() {
  const { c, exists } = load();
  const d = c.get();
  const line = (k, v) => console.log(k + '=' + String(v === undefined || v === null ? '' : v).replace(/[\r\n]+/g, ' '));
  line('file', c.file);
  line('exists', exists ? 'yes' : 'no');
  line('problems', c.loadError || '');
  line('unusable', unusable(c));
  line('web.port', (d.web || {}).port);
  line('web.bind', (d.web || {}).bind);
  line('web.hosts', Array.isArray((d.web || {}).hosts) ? d.web.hosts.join(' ') : '');
  line('web.behindProxy', (d.web || {}).behindProxy);
  line('web.requireLogin', (d.web || {}).requireLogin);
  line('web.password', (d.web || {}).passwordHash ? 'set' : 'not set');
  line('remote.mode', (d.remote || {}).mode);
  line('hotspot.mode', (d.hotspot || {}).mode);
  line('recover.mode', (d.recover || {}).mode);
  line('kiosk.mode', (d.kiosk || {}).mode);
  line('audio.mode', (d.audio || {}).enabled === false ? 'off' : (d.audio || {}).mode);
  line('meganet.enabled', (d.meganet || {}).enabled);
  line('meganet.receptions', (d.meganet || {}).receptions);
  line('meganet.token', (d.meganet || {}).token ? 'set' : 'not set');
  line('meganet.autoRequest', (d.meganet || {}).autoRequest);
  line('hosts.readings', hostsOf((d.meganet || {}).endpoints).join(' '));
  line('hosts.stations', hostsOf((d.meganet || {}).stationsUrls).join(' '));
}

function differ(file) {
  const profile = readProfile(file);
  const { c, defaults } = load();
  for (const [p, asked] of leaves(profile.settings, '', [])) {
    const have = getPath(c.get(), p);
    const want = asked === null ? getPath(defaults, p) : asked;
    if (want === undefined ? have !== undefined : JSON.stringify(have) !== JSON.stringify(want)) {
      console.log(p + ' is ' + show(have) + '; the profile has ' + (want === undefined ? 'it not set' : show(want)));
    }
  }
}

function held(file) {
  const profile = readProfile(file);
  console.log(HELD.filter(h => h.holds(getPath(profile.settings, h.key))).map(h => h.key).join(' '));
}

function looser(file) {
  const profile = readProfile(file);
  const { c } = load();
  const name = profile.profile || path.basename(file, '.json');
  for (const l of looserThan(profile, c.get())) {
    console.log(l.key + ' is ' + show(l.have) + '; the profile in force (' + name + ') holds it at ' + show(l.want));
  }
}

// Run by the start command as the agent's own user, each time, before the
// agent starts: the held settings go back to what the profile has where the
// settings file has them looser. A stricter value is left as it is. What is
// put back is said (in the service's log). Exit status: 0 the settings hold
// what the profile holds; 1 they could not be made to.
function hold(file) {
  const profile = readProfile(file);
  const name = profile.profile || path.basename(file, '.json');
  const say = (msg) => process.stderr.write('open-alert-base: ' + msg + '\n');
  const { c, exists } = load();
  const holds = HELD.filter(h => h.holds(getPath(profile.settings, h.key)));
  if (!holds.length) return;
  // The profile's own values, over what the agent would start on by itself. A
  // setting the profile leaves "as the agent has it" (null) stays as the agent
  // took it: from 0.24, the cautious value where a broken file's text shows
  // it was set, so this never opens what the agent itself would keep closed.
  const whole = () => {
    const set = {};
    for (const [p, v] of leaves(profile.settings, '', [])) if (v !== null) setPath(set, p, v);
    return set;
  };
  let set = {}, why = '';
  if (!exists) {
    // No settings file: the agent would start on its built-in settings, more
    // open than the profile. It starts on the profile's, as after a first install.
    set = whole();
    why = 'there was no settings file (' + c.file + '): made, with the profile "' + name + '"';
  } else if (c.loadError && /not valid JSON/.test(c.loadError)) {
    // Not valid JSON: the agent itself keeps the file as config.json.bad (the
    // agent's settings code has just done so, as its user) and starts on its
    // built-in settings, which it writes over the file as soon as it starts.
    // It starts on the profile's instead.
    set = whole();
    why = 'the settings file ' + c.file + ' is not valid JSON, so the agent would start on its built-in settings. It starts on the settings of the profile "'
      + name + '" instead. What the file held (the Flood-Net token, the name, the channels) is kept in ' + c.file + '.bad: put it right, copy it back, then restart the service';
  } else if (unusable(c)) {
    // There and not to be read (a link, another user's file): the agent takes
    // its cautious values for the dashboard, which are at least as closed as
    // any profile's. Nothing is written over it.
    const left = looserThan(profile, c.get());
    if (left.length) {
      say('the settings file ' + c.file + ' cannot be used (' + c.loadError + '), and the agent would start with ' + left.map(l => l.key + ' ' + show(l.have)).join(', ')
        + ', looser than the profile "' + name + '" holds: the agent is not started. Put the file right, then: sudo systemctl restart open-alert-base');
      process.exit(1);
    }
    say('note — the settings file ' + c.file + ' cannot be used (' + c.loadError + '); the agent starts on its built-in settings, with the dashboard\'s at least as closed as the profile "' + name + '" holds');
    return;
  } else {
    const left = looserThan(profile, c.get());
    if (!left.length) return;
    for (const l of left) setPath(set, l.key, l.want);
    why = 'the settings file had ' + left.map(l => l.key + ' ' + show(l.have)).join(', ') + ', looser than the profile in force ("' + name + '") holds: put back to '
      + left.map(l => l.key + ' ' + show(l.want)).join(', ') + ' before the agent starts. (The settings may ask for more than the profile, never for less; only root changes the profile: sudo open-alert-base profile <name>)';
  }
  const r = c.update(set);
  if (!r.ok) { say('the settings the profile "' + name + '" holds could not be put back, because the agent refuses them: ' + r.errors.join('; ') + '. The agent is not started.'); process.exit(1); }
  // Nothing changed, and yet the file must be written: there was none, or it was not valid JSON.
  if (!r.changed.length) c.save();
  const after = new (agentConfig().Config)(c.file);
  after.load();
  const still = looserThan(profile, after.get());
  if (still.length) { say('the settings the profile "' + name + '" holds could not be put back (' + still.map(l => l.key).join(', ') + ' still looser). The agent is not started.'); process.exit(1); }
  say(why);
}

const [cmd, arg] = process.argv.slice(2);
if (cmd === 'apply' && arg) apply(arg);
else if (cmd === 'summary') summary();
else if (cmd === 'differ' && arg) differ(arg);
else if (cmd === 'looser' && arg) looser(arg);
else if (cmd === 'held' && arg) held(arg);
else if (cmd === 'hold' && arg) hold(arg);
else die('usage: settings.js apply <profile.json> | summary | differ <profile.json> | looser <profile.json> | hold <profile.json> | held <profile.json>', 2);
