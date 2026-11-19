'use strict';
// Hands a settings file that root put in place over to the agent's user.
//
//   adopt-settings.js <file> <user id> <group id>
//
// Why: the agent's settings (/etc/rpi-alert/config.json) are read and written
// by the agent's own user. A file put there by root — configuration
// management, a restored backup, cloud-init's "write_files" — belongs to root,
// and the agent cannot read it: it would run on its built-in settings, without
// the Flood-Net token, and nobody would be told.
//
// This is the one thing root does inside the agent's folder, so it is done
// with care. The folder belongs to the agent's user, who could swap the file
// for a link to another file between a look and a change. So nothing is done
// through the file's name: the file is opened once (a link is refused at that
// moment), looked at through that opening, and changed through that opening.
// Only a plain file that belongs to root and has no second name anywhere is
// changed; it is given to the user and group named, readable by that user
// alone. Anything else is left exactly as it is, and said.
//
// Exit status: 0 nothing to do, or done; 3 left alone (the reason is printed).

const fs = require('node:fs');

const [file, uidArg, gidArg] = process.argv.slice(2);
const uid = Number(uidArg), gid = Number(gidArg);
const out = (msg) => process.stdout.write('open-alert-base: ' + msg + '\n');
if (!file || !Number.isInteger(uid) || !Number.isInteger(gid) || uid <= 0) {
  process.stderr.write('usage: adopt-settings.js <file> <user id> <group id>\n');
  process.exit(2);
}

let fd;
try {
  fd = fs.openSync(file, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW | fs.constants.O_NONBLOCK | fs.constants.O_NOCTTY);
} catch (e) {
  if (e.code === 'ENOENT') process.exit(0);
  if (e.code === 'ELOOP') { out('the settings file ' + file + ' is a link to another file: it was left alone. Put a plain file there.'); process.exit(3); }
  out('the settings file ' + file + ' could not be opened (' + e.code + '): it was left alone.');
  process.exit(3);
}
try {
  const st = fs.fstatSync(fd);
  if (!st.isFile()) { out('the settings file ' + file + ' is not a plain file: it was left alone.'); process.exit(3); }
  if (st.uid === uid) process.exit(0);                       // the agent's own already
  if (st.uid !== 0) { out('the settings file ' + file + ' belongs to another user (id ' + st.uid + '): it was left alone. The agent cannot read it.'); process.exit(3); }
  if (st.nlink !== 1) { out('the settings file ' + file + ' has a second name somewhere else: it was left alone.'); process.exit(3); }
  fs.fchownSync(fd, uid, gid);
  fs.fchmodSync(fd, 0o600);
  out('the settings file ' + file + ' belonged to root, and the agent could not read it: it now belongs to the agent\'s user, readable by that user alone.');
} finally {
  fs.closeSync(fd);
}
