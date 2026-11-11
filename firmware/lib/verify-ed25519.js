#!/usr/bin/env node
'use strict';
// Check a detached Ed25519 signature with Node alone (no packages), for
// firmware/lib/fetch-agent.sh on a computer that has Node but no OpenSSL 3.
//
//   node verify-ed25519.js fingerprint <public-key.pem>
//       prints the key's fingerprint, "SHA256:…" (the SHA-256 of the key in
//       its standard DER form, base64 without the padding)
//   node verify-ed25519.js verify <public-key.pem> <signature-file> <data-file>
//       exit 0: the signature is this key's signature over exactly these bytes
//       exit 1: it is not (changed file, wrong signature, wrong key)
//       exit 2: the key or the arguments are unusable

const crypto = require('node:crypto');
const fs = require('node:fs');

function loadKey(file) {
  let key;
  try { key = crypto.createPublicKey(fs.readFileSync(file)); }
  catch (e) { process.stderr.write('cannot read the public key ' + file + ': ' + e.message + '\n'); process.exit(2); }
  if (key.asymmetricKeyType !== 'ed25519') { process.stderr.write('the public key is not an Ed25519 key\n'); process.exit(2); }
  return key;
}

const [mode, keyFile, sigFile, dataFile] = process.argv.slice(2);
if (mode === 'fingerprint' && keyFile) {
  const der = loadKey(keyFile).export({ type: 'spki', format: 'der' });
  process.stdout.write('SHA256:' + crypto.createHash('sha256').update(der).digest('base64').replace(/=+$/, '') + '\n');
} else if (mode === 'verify' && keyFile && sigFile && dataFile) {
  const key = loadKey(keyFile);
  let ok = false;
  try { ok = crypto.verify(null, fs.readFileSync(dataFile), key, fs.readFileSync(sigFile)); }
  catch (e) { process.stderr.write('could not check the signature: ' + e.message + '\n'); }
  process.exit(ok ? 0 : 1);
} else {
  process.stderr.write('usage: verify-ed25519.js fingerprint <public-key.pem>\n'
    + '       verify-ed25519.js verify <public-key.pem> <signature-file> <data-file>\n');
  process.exit(2);
}
