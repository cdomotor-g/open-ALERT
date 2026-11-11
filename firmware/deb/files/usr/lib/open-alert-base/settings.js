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
//
// In a profile, a setting given as null means "take this setting out", so that
// the agent's own default applies.

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
const show = (v) => (v === undefined ? 'not set' : typeof v === 'string' ? v : JSON.stringify(v));

function load() {
  const { Config } = agentConfig();
  const c = new Config();
  let exists = true;
  try { fs.lstatSync(c.file); } catch (_) { exists = false; }
  c.load();
  return { c, exists };
}

function apply(file) {
  const profile = readProfile(file);
  const { c, exists } = load();
  if (c.loadError && /not valid JSON/.test(c.loadError)) {
    die('the settings file ' + c.file + ' is not valid JSON, so it was left alone. Put it right or move it away, then run this again. (' + c.loadError + ')');
  }
  if (c.loadError) process.stderr.write('open-alert-base: note — ' + c.loadError + '\n');
  const set = {}, unset = [];
  for (const [p, v] of leaves(profile.settings, '', [])) { if (v === null) unset.push(p); else setPath(set, p, v); }
  const r = c.update(set);
  if (!r.ok) die('the profile was not applied, because the agent refuses these settings: ' + r.errors.join('; '));
  const removed = unset.filter(p => dropPath(c.data, p));
  if (removed.length || !exists) c.save();
  const changed = r.changed.concat(removed.map(p => p + ' (taken out)'));
  if (!exists) console.log('Settings file ' + c.file + ' made, with the profile "' + (profile.profile || path.basename(file, '.json')) + '".');
  else if (changed.length) console.log('Settings changed: ' + changed.join(', ') + '.');
  else console.log('Settings were already as the profile has them.');
}

function hostsOf(list) {
  const out = [];
  for (const u of Array.isArray(list) ? list : []) { try { const h = new URL(u).host; if (!out.includes(h)) out.push(h); } catch (_) {} }
  return out;
}

function summary() {
  const { c, exists } = load();
  const d = c.get();
  const line = (k, v) => console.log(k + '=' + String(v === undefined || v === null ? '' : v).replace(/[\r\n]+/g, ' '));
  line('file', c.file);
  line('exists', exists ? 'yes' : 'no');
  line('problems', c.loadError || '');
  line('web.port', (d.web || {}).port);
  line('web.bind', (d.web || {}).bind);
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
  const { c } = load();
  for (const [p, want] of leaves(profile.settings, '', [])) {
    const have = getPath(c.get(), p);
    if (want === null ? have !== undefined : JSON.stringify(have) !== JSON.stringify(want)) {
      console.log(p + ' is ' + show(have) + '; the profile has ' + (want === null ? 'it not set' : show(want)));
    }
  }
}

const [cmd, arg] = process.argv.slice(2);
if (cmd === 'apply' && arg) apply(arg);
else if (cmd === 'summary') summary();
else if (cmd === 'differ' && arg) differ(arg);
else die('usage: settings.js apply <profile.json> | summary | differ <profile.json>', 2);
