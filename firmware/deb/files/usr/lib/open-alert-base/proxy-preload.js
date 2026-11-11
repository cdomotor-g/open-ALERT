'use strict';
// Sends the agent's own HTTPS calls (readings to Flood-Net, the station list)
// through the organisation's web proxy, on a Node.js older than 22.21.
//
// The agent makes those calls with Node's built-in fetch(), and before 22.21
// fetch() takes no notice of HTTPS_PROXY. Debian and Ubuntu build their
// Node.js with the "undici" library that fetch() runs on as a package of its
// own, so it can be told from outside to use the proxy. Nothing in the agent
// is changed: /usr/lib/open-alert-base/start loads this file first
// (NODE_OPTIONS=--require …), and only when HTTPS_PROXY is set.
//
// With no NO_PROXY, this is the three lines that were tested with RPi ALERT's
// own uplink code on Ubuntu 24.04 (Node 18, undici 5.26) and Debian 13
// (Node 20, undici 7.3). With NO_PROXY, the addresses it lists go direct.
// If the proxy cannot be set up, the agent still starts: it receives, keeps
// what it hears on disk, and says here why nothing is being sent.
(function () {
  const proxy = process.env.HTTPS_PROXY || process.env.https_proxy;
  if (!proxy) return;
  // Once, in the agent itself: not again in each decoder thread.
  try { if (!require('node:worker_threads').isMainThread) return; } catch (_) { /* no threads: carry on */ }
  const note = (msg) => process.stderr.write('open-alert-base: ' + msg + '\n');
  let undici;
  try { undici = require('undici'); }
  catch (e) {
    note('a web proxy is set, but this Node.js (' + process.version + ') cannot be told to use it: it is older than 22.21 and has no '
      + '"undici" package beside it (Debian and Ubuntu: the node-undici package). Readings are kept on disk and not sent until this is put right.');
    return;
  }
  try {
    const viaProxy = new undici.ProxyAgent(proxy);
    const exempt = String(process.env.NO_PROXY || process.env.no_proxy || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
    if (!exempt.length) { undici.setGlobalDispatcher(viaProxy); return; }
    const direct = new undici.Agent();
    // NO_PROXY the usual way: "*" (everything), a host name, ".example.org" or
    // "example.org" (that name and everything under it), an address; a port
    // after a colon is ignored.
    const goesDirect = (origin) => {
      let host = '';
      try { host = new URL(String(origin)).hostname.toLowerCase().replace(/^\[|\]$/g, ''); } catch (_) { return false; }
      return exempt.some((e) => {
        if (e === '*') return true;
        const name = e.replace(/^\*?\./, '').replace(/^\[|\]$/g, '').replace(/^([^:]+):\d+$/, '$1');
        return host === name || host.endsWith('.' + name);
      });
    };
    class ProxyUnlessExempt extends undici.Dispatcher {
      dispatch(opts, handler) { return (goesDirect(opts.origin) ? direct : viaProxy).dispatch(opts, handler); }
      close() { return Promise.all([direct.close(), viaProxy.close()]); }
      destroy(...args) { return Promise.all([direct.destroy(...args), viaProxy.destroy(...args)]); }
    }
    undici.setGlobalDispatcher(new ProxyUnlessExempt());
  } catch (e) {
    note('the web proxy could not be set up (' + e.message + '). Readings are kept on disk and not sent until this is put right.');
  }
})();
