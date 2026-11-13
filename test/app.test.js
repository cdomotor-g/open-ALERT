// open-ALERT — tests that the site installs as an app (a home-screen icon on a
// phone) and that old addresses still lead somewhere.

'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const SITE = path.join(ROOT, 'site');
const PAGES = ['index.html', 'build.html', 'trial.html', 'hardware.html'];

// A PNG's width and height, from its header.
const pngSize = f => { const b = fs.readFileSync(f); assert.equal(b.toString('ascii', 1, 4), 'PNG', `${f} is not a PNG`); return [b.readUInt32BE(16), b.readUInt32BE(20)]; };

test('the app manifest names the site, starts on it and has its icons', () => {
  const m = JSON.parse(fs.readFileSync(path.join(SITE, 'manifest.webmanifest'), 'utf8'));
  assert.ok(m.name && m.short_name, 'a name');
  assert.equal(m.start_url, './');
  assert.equal(m.scope, './');
  assert.equal(m.display, 'standalone');
  const pngs = m.icons.filter(i => i.type === 'image/png');
  for (const i of m.icons) assert.ok(fs.existsSync(path.join(SITE, i.src)), `missing ${i.src}`);
  for (const i of pngs) {
    const [w, h] = pngSize(path.join(SITE, i.src));
    assert.equal(`${w}x${h}`, i.sizes, `${i.src} is ${w}x${h}`);
  }
  for (const want of ['192x192', '512x512']) assert.ok(pngs.some(i => i.sizes === want && i.purpose === 'any'), `a ${want} icon`);
  assert.ok(pngs.some(i => i.purpose === 'maskable'), 'a maskable icon for Android');
  for (const s of m.shortcuts || []) assert.ok(fs.existsSync(path.join(SITE, s.url)), `shortcut ${s.url}`);
});

test('every page links the manifest and the iPhone icon, and starts the offline helper', () => {
  assert.deepEqual(pngSize(path.join(SITE, 'icons', 'apple-touch-icon.png')), [180, 180]);
  const sw = fs.readFileSync(path.join(SITE, 'sw.js'), 'utf8');
  assert.match(sw, /addEventListener\('fetch'/);
  for (const p of PAGES) {
    const s = fs.readFileSync(path.join(SITE, p), 'utf8');
    assert.match(s, /<link rel="manifest" href="manifest\.webmanifest">/, `${p}: manifest`);
    assert.match(s, /<link rel="apple-touch-icon" href="icons\/apple-touch-icon\.png">/, `${p}: iPhone icon`);
    assert.match(s, /<meta name="theme-color"/, `${p}: theme colour`);
    assert.match(s, /serviceWorker\.register\('sw\.js'\)/, `${p}: offline helper`);
  }
});

test('old addresses forward to the pages, keeping share links', () => {
  // published with site/ as the top folder: /site/... is an old address
  for (const [f, target] of [['index.html', '../'], ['build.html', '../build.html'], ['trial.html', '../trial.html'], ['hardware.html', '../hardware.html']]) {
    const s = fs.readFileSync(path.join(SITE, 'site', f), 'utf8');
    assert.ok(s.includes(`location.replace('${target}' + location.search + location.hash)`), `site/site/${f} → ${target}`);
    assert.ok(s.includes(`url=${target}"`), `site/site/${f}: a fallback without JavaScript`);
  }
  // published from the branch, the repository's top folder is the site
  for (const [f, target] of [['index.html', 'site/'], ['build.html', 'site/build.html'], ['trial.html', 'site/trial.html'], ['hardware.html', 'site/hardware.html']]) {
    const s = fs.readFileSync(path.join(ROOT, f), 'utf8');
    assert.ok(s.includes(`location.replace('${target}' + location.search + location.hash)`), `${f} → ${target}`);
  }
});
