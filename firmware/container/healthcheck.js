'use strict';
// Docker's health check: does the agent's dashboard answer? Exit 0 yes, 1 no.
// It asks the port in the settings, then 8080 (where the agent goes when it
// may not use the port it was asked for). Nothing is sent anywhere else.
const fs = require('node:fs');
const http = require('node:http');

let want = 8080;
try {
  const w = JSON.parse(fs.readFileSync('/etc/rpi-alert/config.json', 'utf8')).web;
  if (w && Number.isInteger(w.port)) want = w.port;
} catch (_) { /* no file or unreadable: 8080 */ }
const ports = want === 8080 ? [8080] : [want, 8080];

function ask(port) {
  return new Promise((resolve) => {
    const req = http.get({ host: '127.0.0.1', port, path: '/api/status', timeout: 5000 }, (res) => {
      res.resume();
      resolve(res.statusCode === 200);
    });
    req.on('timeout', () => { req.destroy(); resolve(false); });
    req.on('error', () => resolve(false));
  });
}

(async () => {
  for (const p of ports) if (await ask(p)) process.exit(0);
  process.exit(1);
})();
