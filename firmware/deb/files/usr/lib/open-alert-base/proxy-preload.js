'use strict';
// Sends the agent's own HTTPS calls (readings to Flood-Net, the station list)
// through the organisation's web proxy, on a Node.js older than 22.21.
//
// The agent makes those calls with Node's built-in fetch(), and before 22.21
// fetch() takes no notice of HTTPS_PROXY. Debian and Ubuntu build their
// Node.js with the "undici" library that fetch() runs on as a package of its
// own (node-undici), so fetch() can be told from outside to use the proxy.
// Nothing in the agent is changed: /usr/lib/open-alert-base/start loads this
// file first (NODE_OPTIONS=--require …), and only when HTTPS_PROXY is set.
//
// What goes where, the same as a newer Node.js does by itself:
//   https:// addresses   through the proxy named in HTTPS_PROXY
//   http:// addresses    direct (Flood-Net's are all https)
//   NO_PROXY             the addresses it lists go direct
//
// Three rules it keeps:
//
//   1. A proxy that is set is never gone around. If it cannot be used — its
//      address cannot be read, the library is missing — every call that should
//      have gone through it is refused here, and none goes out directly. The
//      agent still starts: it receives, keeps what it hears on disk, and this
//      file says in the log why nothing is being sent.
//
//   2. The library is taken from the operating system's folders and from
//      nowhere else. Node.js looks for a library named without a path in the
//      user's home folder first ($HOME/.node_modules), and the service's home
//      is its data folder, which the agent can write. The home folder is taken
//      off Node's list before anything is looked for.
//
//   3. A proxy that takes a connection and closes it without an answer (a
//      load balancer with nothing behind it, a wrong port) is not tried again
//      and again. Left alone, the library opens thousands of connections a
//      second for as long as that lasts. Here: after a few connections in a
//      row with no answer, calls are refused for a wait that doubles each
//      time (5 seconds to one minute), and the proxy is tried again after it.
(function () {
  let proxy = process.env.HTTPS_PROXY || process.env.https_proxy;
  if (!proxy) return;
  // Once, in the agent itself: not again in each decoder thread (they make no calls).
  try { if (!require('node:worker_threads').isMainThread) return; } catch (_) { /* no threads: carry on */ }
  const path = require('node:path');
  const note = (msg) => process.stderr.write('open-alert-base: ' + msg + '\n');
  const KEPT = 'Readings are kept on disk and not sent until this is put right.';
  // Where fetch() keeps the object every call is handed to (the library's own name for it).
  const SENDER = Symbol.for('undici.globalDispatcher.1');

  // An error for a call that was not made, with the reason in plain words.
  const notSent = (why, cause) => {
    const e = new Error('open-alert-base: not sent — ' + why);
    e.code = 'OA_PROXY'; if (cause) e.cause = cause;
    return e;
  };
  // Tell a call that it failed, in whichever way this library's callers listen.
  const failCall = (handler, err) => {
    if (handler && typeof handler.onError === 'function') handler.onError(err);
    else if (handler && typeof handler.onResponseError === 'function') handler.onResponseError(null, err);
    else throw err;
    return false;
  };

  // Rule 1, when nothing else can be done: every call fetch() makes is refused.
  // If even that cannot be put in place, the agent is not started at all.
  function refuseEverything(why) {
    const err = () => notSent(why);
    const refuser = {
      dispatch(opts, handler) { return failCall(handler, err()); },
      close() { return Promise.resolve(); },
      destroy() { return Promise.resolve(); },
    };
    try {
      Object.defineProperty(globalThis, SENDER, { value: refuser, writable: true, enumerable: false, configurable: false });
      if (globalThis[SENDER] !== refuser) throw new Error('it was not taken');
    } catch (e) {
      note(why + ' And this Node.js (' + process.version + ') could not be told to send nothing (' + e.message + '): the agent is not started.');
      process.exit(78);
    }
    note(why + ' Nothing is sent directly instead. ' + KEPT);
  }

  // Rule 2: the library, from the system's folders only.
  function loadLibrary() {
    const Module = require('node:module');
    const home = process.env.HOME;
    if (typeof Module._initPaths !== 'function') throw new Error('this Node.js cannot be told where not to look for libraries');
    if (home !== undefined) delete process.env.HOME;
    try { Module._initPaths(); } finally { if (home !== undefined) process.env.HOME = home; }
    const own = [home, '/var/lib/rpi-alert', '/etc/rpi-alert'].filter(Boolean).map((p) => path.resolve(p));
    const isOwn = (p) => own.some((d) => p === d || p.startsWith(d + path.sep));
    const still = (Module.globalPaths || []).filter(isOwn);
    if (still.length) throw new Error('Node.js would still look for libraries in ' + still.join(', '));
    const where = require.resolve('undici');
    if (isOwn(where)) throw new Error('the library was found in ' + where + ', which is not a system folder');
    return require('undici');
  }

  // NO_PROXY the usual way: "*" (everything), a host name, ".example.org" or
  // "example.org" (that name and everything under it), an address; a port
  // after a colon is ignored.
  const exempt = String(process.env.NO_PROXY || process.env.no_proxy || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
  const goesDirect = (origin) => {
    let url;
    try { url = new URL(String(origin)); } catch (_) { return false; }
    if (url.protocol !== 'https:') return true;
    const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');
    return exempt.some((e) => {
      if (e === '*') return true;
      const name = e.replace(/^\*?\./, '').replace(/^\[|\]$/g, '').replace(/^([^:]+):\d+$/, '$1');
      return host === name || host.endsWith('.' + name);
    });
  };

  // The proxy's address. One written without "http://" in front is taken as
  // http://, as curl takes it. Its name and password never go in a message.
  let url = null, badAddress = '';
  try {
    if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(proxy)) proxy = 'http://' + proxy;
    url = new URL(proxy);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      badAddress = 'it starts with "' + url.protocol + '//", and a web proxy\'s address starts with http:// or https://';
    } else if (!url.hostname) badAddress = 'it names no computer';
  } catch (_) { badAddress = 'it is not an address'; }

  let why = badAddress ? 'The web proxy\'s address in HTTPS_PROXY cannot be used: ' + badAddress + '.' : '';

  let undici;
  try { undici = loadLibrary(); }
  catch (e) {
    refuseEverything(why || 'A web proxy is set, but this Node.js (' + process.version + ') cannot be told to use it: it is older than 22.21 and its '
      + '"undici" library could not be loaded from the system\'s folders (Debian and Ubuntu: the node-undici package): '
      + String(e.message).split('\n')[0] + '.');
    return;
  }

  // Rule 3: the guard on the connection to the proxy itself.
  const LIMIT = 8, WINDOW_MS = 10000, FIRST_WAIT_MS = 5000, LONGEST_WAIT_MS = 60000;
  const guard = { tries: [], wait: 0, until: 0 };
  const guardRefusal = () => notSent('the web proxy took ' + LIMIT + ' connections in a row without an answer; it is tried again in '
    + Math.max(1, Math.ceil((guard.until - Date.now()) / 1000)) + ' s');
  // A connection to the proxy is about to be opened: may it be?
  const guardAllows = () => {
    const now = Date.now();
    if (now < guard.until) return false;
    guard.tries = guard.tries.filter((t) => now - t < WINDOW_MS);
    if (guard.tries.length >= LIMIT) {
      guard.wait = Math.min(guard.wait ? guard.wait * 2 : FIRST_WAIT_MS, LONGEST_WAIT_MS);
      guard.until = now + guard.wait; guard.tries = [];
      note('the web proxy took ' + LIMIT + ' connections in a row without an answer. It is not tried again for ' + (guard.wait / 1000)
        + ' seconds; until then nothing is sent, and nothing goes out directly. ' + KEPT);
      return false;
    }
    guard.tries.push(now);
    return true;
  };
  // The proxy answered (whatever it said): it is there.
  const guardAnswered = () => { guard.tries = []; guard.wait = 0; guard.until = 0; };

  function throughProxy() {
    // A user name and password in the proxy's address are handed over as the
    // header a proxy expects ("Proxy-Authorization: Basic …"). An older undici
    // (5.26, Ubuntu 24.04's) does not take them from the address by itself.
    const opts = { uri: url.protocol + '//' + url.host };
    if (url.username || url.password) {
      opts.token = 'Basic ' + Buffer.from(decodeURIComponent(url.username) + ':' + decodeURIComponent(url.password)).toString('base64');
    }
    let guarded = false;
    if (typeof undici.Pool === 'function') {
      // The library makes its connections to the proxy through what this gives it.
      opts.clientFactory = (origin, o) => {
        const open = o && o.connect;
        if (typeof open === 'function') {
          o = Object.assign({}, o, {
            connect(args, callback) {
              if (!guardAllows()) { setImmediate(callback, guardRefusal(), null); return; }
              return open(args, callback);
            },
          });
          guarded = true;
        }
        const pool = new undici.Pool(origin, o);
        guardAsk(pool, false);
        return pool;
      };
    }
    const agent = new undici.ProxyAgent(opts);
    if (!guarded) guarded = guardOlderLibrary(agent);
    if (!guarded) note('note — on this version of the library the guard against a proxy that closes connections without answering could not be put in place.');
    return agent;
  }

  // The library asks the proxy for a tunnel through target.connect(). An
  // answer, any answer, resets the guard. A failure is handed on as an error of
  // this file's own: the library's "the other side closed" is the one error it
  // tries again at once, without end. With countHere, each ask is also counted
  // by the guard (where the connections themselves could not be).
  function guardAsk(target, countHere) {
    const ask = target.connect.bind(target);
    target.connect = function (args, callback) {
      if (typeof callback === 'function') return ask(args, callback);
      if (countHere && !guardAllows()) return Promise.reject(guardRefusal());
      return ask(args).then(
        (r) => { guardAnswered(); return r; },
        (e) => { throw (e && e.code === 'OA_PROXY') ? e : notSent('the web proxy did not answer (' + ((e && (e.code || e.message)) || 'no reason given') + ')', e); });
    };
  }

  // An older undici (5.15, Debian 12's) makes its one connection to the proxy
  // inside ProxyAgent, and takes no factory for it. The same guard is put on
  // that connection once it is made: the library keeps it under a name of its
  // own, "proxy client". Returns false when it is not there.
  function guardOlderLibrary(agent) {
    const key = Object.getOwnPropertySymbols(agent).find((s) => s.description === 'proxy client');
    const client = key && agent[key];
    if (!client || typeof client.connect !== 'function') return false;
    guardAsk(client, true);
    return true;
  }

  let viaProxy = null;
  if (!why) {
    try { viaProxy = throughProxy(); }
    catch (e) { why = 'The web proxy could not be set up (' + String(e.message).split('\n')[0] + ').'; }
  }

  try {
    const direct = new undici.Agent();
    class ProxyForHttps extends undici.Dispatcher {
      dispatch(opts, handler) {
        if (goesDirect(opts.origin)) return direct.dispatch(opts, handler);
        if (!viaProxy) return failCall(handler, notSent(why));
        return viaProxy.dispatch(opts, handler);
      }
      close() { return Promise.all([direct.close(), viaProxy ? viaProxy.close() : null]); }
      destroy(...args) { return Promise.all([direct.destroy(...args), viaProxy ? viaProxy.destroy(...args) : null]); }
    }
    const sender = new ProxyForHttps();
    undici.setGlobalDispatcher(sender);
    if (globalThis[SENDER] !== sender) throw new Error('fetch() did not take it');
    if (!viaProxy) note(why + ' Nothing is sent through it, and nothing is sent directly instead (addresses in NO_PROXY aside). ' + KEPT);
  } catch (e) {
    if (!viaProxy) { refuseEverything(why); return; }
    // The plain way, as first tested with RPi ALERT's own uplink code on
    // Ubuntu 24.04 (Node 18) and Debian 13 (Node 20): everything through the proxy.
    try {
      undici.setGlobalDispatcher(viaProxy);
      if (globalThis[SENDER] !== viaProxy) throw new Error('fetch() did not take it');
      note('NO_PROXY could not be honoured on this Node.js (' + e.message + '): every call goes through the web proxy.');
    } catch (e2) {
      refuseEverything('The web proxy could not be set up (' + e2.message + ').');
    }
  }
})();
