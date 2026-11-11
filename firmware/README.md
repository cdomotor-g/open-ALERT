# firmware — an open-ALERT base station on a computer that is not a Raspberry Pi

**First version, 11 November 2026. Tested with stand-ins for the radio sticks only — see
[What has been tested, and where](#what-has-been-tested-and-where). Not reviewed by a second
person, and not released.**

[RPi ALERT](https://github.com/cdomotor-g/RPi_ALERT) is the program a base station runs: it
listens to ALERT and ALERT2 flood-warning radio telemetry on RTL-SDR USB sticks, decodes it, and
sends the readings to Flood-Net over outbound HTTPS. The program itself runs on any Linux
computer. What ties it to a Raspberry Pi is its installer and its SD-card image.

This folder is the part that replaces those two. It takes a **signed release of RPi ALERT,
unchanged**, and wraps it for other computers and for networks whose IT security team has to
approve what is plugged in. Nothing of RPi ALERT is copied into this repository or edited here:
each build fetches the release, checks it, and stops if a check fails.

Why this exists, and which computers were looked at, is in the
[hardware review](../docs/hardware-review/README.md).

## The three forms

| Form | For | Where |
|---|---|---|
| A native package, `open-alert-base` | Any Debian 13 or Ubuntu 24.04 computer, an ordinary 64-bit PC or a 64-bit ARM board | `deb/` — described on this page |
| A hardened container | Toradex's Torizon OS, and any computer that runs containers | `container/` — its section is added when that part is finished |
| Ready-to-flash disk images | A computer that is to be a base station and nothing else | `image/` — its section is added when that part is finished |

All three start from the same checked release (`PIN`, `keys/`, `lib/`).

## What is in this folder

| Path | What it is |
|---|---|
| `PIN` | Which RPi ALERT release is shipped: its tag, where it is downloaded from, its SHA-256, and the fingerprint of the key that signed it |
| `keys/rpi-alert-release.pub.pem` | RPi ALERT's public release key (a copy of `os/release-signing-key.pem` in its repository) |
| `lib/fetch-agent.sh` | Gets the pinned release, checks it five ways, and only then unpacks it |
| `lib/verify-ed25519.js` | The signature check written for Node.js alone, for a computer that has no OpenSSL 3 |
| `deb/` | Builds the native package |
| `test/lib.sh`, `test/deb.sh` | The checks for the release check and for the native package |
| `bench/` | A benchmark: how many channels a computer will carry (it has its own notes) |
| `../dist/` | Where builds and test logs go. Not kept in git |

## The pin: which release is shipped, and how it is checked

`PIN` is a short file of `NAME=value` lines. Today it names RPi ALERT **v0.23.1**.

A *hash* (here SHA-256) is a fingerprint of a file: change one byte and the hash is different. A
*signature* is a proof, made with a secret key that only RPi ALERT's release process holds, that
a file is exactly what was released; anybody can check it with the matching public key. RPi
ALERT signs each release with an Ed25519 key, and this repository keeps the public half.

`lib/fetch-agent.sh` unpacks nothing unless all five of these hold:

1. The public key kept here has the fingerprint the pin names
   (`SHA256:fOdKIOUguw9edBdaecgkcSoJhXprGHvbNr1ddEVXOXI`, the one RPi ALERT's
   `docs/release-signing.md` prints).
2. The downloaded file's SHA-256 is the one the pin names.
3. The signature file is that key's signature over the file. It is checked with OpenSSL 3, and
   with Node.js as well when both are installed.
4. The file holds only plain files and folders, all inside one folder named after the release:
   no links, nothing that climbs out with `..`, nothing set to run as another user.
5. The agent inside says it is the version the pin names.

```
firmware/lib/fetch-agent.sh --verify-only                      # download, check, unpack nothing
firmware/lib/fetch-agent.sh --out DIR                          # download, check, unpack into DIR
firmware/lib/fetch-agent.sh --out DIR --tarball F --sig S      # two files already here; no network
```

It ends with status 0 when everything checked, 1 when a check failed (nothing was unpacked),
2 when it was used wrongly, 3 when a file or a tool was missing.

The downloads are from GitHub over HTTPS only. The check does not rest on that: a file from
anywhere is accepted if, and only if, it passes the five checks.

### Moving the pin to a newer release

1. Read the release's notes. Download its two files (`rpi-alert-<tag>-src.tar.gz` and `.sig`)
   and work out the SHA-256: `sha256sum rpi-alert-<tag>-src.tar.gz`.
2. In `PIN`, change `AGENT_TAG`, `AGENT_VERSION`, both addresses and `AGENT_SHA256`, and set
   `OA_REVISION` back to 1. Leave the key lines alone unless RPi ALERT has announced a new key —
   and then check the new fingerprint against its `docs/release-signing.md` and, better, with
   the owner by another route.
3. Add an entry at the top of `deb/changelog` for the new version.
4. Run `firmware/test/deb.sh`. `deb/build-deb.sh` stops if the release holds a file or folder it
   does not know, so that somebody decides where it belongs.
5. Read "Waiting for RPi ALERT 0.24" below: some things here are stop-gaps until then.

## The native package: `open-alert-base`

### Building it

```
firmware/deb/build-deb.sh                                # downloads the pinned release
firmware/deb/build-deb.sh --tarball F --sig S            # uses two files already here
```

It needs `dpkg-deb`, `tar`, `gzip`, either OpenSSL 3 or Node.js, and `curl` for the download;
no compiler. The result is
`dist/open-alert-base_0.23.1+oa1_all.deb`, about 2.4 MB. The version is the agent's version,
then `+oa` and this layer's own revision. `all` means one file for every kind of processor: the
package is JavaScript and shell scripts. Built twice from the same files it is the same file,
byte for byte. After packing, the script unpacks its own result and compares every agent file
with the release again.

### Installing it

On Debian 13 or Ubuntu 24.04, as the administrator:

```
sudo apt install ./open-alert-base_0.23.1+oa1_all.deb
rpi-alert setup                    # the Flood-Net token, a name, where the base station is
open-alert-base status
```

`apt` brings what it needs from the operating system's own packages: `nodejs` (18.17 or newer),
`rtl-sdr`, `ca-certificates`, `adduser`, and `nftables` (recommended: the enterprise profile's
firewall lock uses it). Nothing comes from npm or from anywhere else.

To start locked down from the first moment, name the profile at install:

```
sudo OPEN_ALERT_BASE_PROFILE=enterprise apt install ./open-alert-base_0.23.1+oa1_all.deb
```

The package refuses, with a plain message, to install on a computer where RPi ALERT's own
installer has been used (`/opt/rpi-alert` or an `rpi-alert.service` is there): both would run
the same agent on the same settings. It says how to remove the other one first.

Debian 12 is not a target. The package installs there and its checks pass, with one real
limit: Debian 12's `rtl-sdr` is too old to know the RTL-SDR Blog V4 stick (see the table below).

### What it puts on the computer

| Where | What |
|---|---|
| `/usr/lib/open-alert-base/agent/` | The agent, every file as in the signed release: the program, and its own tests and scripts so that a buyer can run them on their hardware |
| `/usr/share/open-alert-base/` | The pin, the release key, the SHA-256 of every agent file, the two profiles |
| `/usr/bin/rpi-alert` | RPi ALERT's own command, under the name its documentation uses |
| `/usr/bin/open-alert-base` | This layer's command (below) |
| `/usr/lib/systemd/system/open-alert-base.service` | The service |
| `/usr/lib/systemd/system/open-alert-base-firewall.service`, `/etc/open-alert-base/dashboard-local-only.nft` | The enterprise profile's firewall lock |
| `/etc/open-alert-base/env` | Where a web proxy is named (readable by root only: it may hold a proxy's password) |
| `/usr/lib/udev/rules.d/60-open-alert-base.rules` | Lets the agent's user open RTL-SDR sticks (USB ids `0bda:2832` and `0bda:2838`, as in RPi ALERT's own rule) |
| `/usr/lib/modprobe.d/open-alert-base-blacklist-dvb.conf` | Keeps the kernel's digital-TV drivers off the sticks (the five names in RPi ALERT's own list) |
| `/usr/lib/modules-load.d/open-alert-base.conf` | Loads the two USB serial drivers when the computer starts, for serial receivers |
| `/usr/share/doc/open-alert-base/` | A README for whoever looks after the computer, the licence, the change log |

The agent keeps its own usual places, so its command and its documentation stay true:
settings in `/etc/rpi-alert/` and data in `/var/lib/rpi-alert/`, both owned by its user,
`rpi-alert`. That user is a system account with no password and no login shell, in the groups
`plugdev` (the sticks) and `dialout` (serial receivers).

### The service, and what it is kept from

*systemd* is the program that starts and watches over services on Debian and Ubuntu. The
service file tells it to run the agent as the user `rpi-alert` with these limits:

| Limit | What it means |
|---|---|
| No root helper | RPi ALERT on a Pi can ask the administrator account (root) to reboot, change networks, update itself and change SSH, through a helper program. Here the agent is pointed at a helper that does not exist (`RPI_ALERT_PRIV` names a path where nothing is), so it can ask root for nothing |
| `NoNewPrivileges` | It can never gain a right it did not start with: `sudo` and set-user-id programs do nothing for it |
| No capabilities | A *capability* is one named piece of root's power. The service has none — or exactly one, `CAP_NET_BIND_SERVICE`, when the dashboard is on a port below 1024 (see the profiles) |
| `ProtectSystem=strict` | The whole disk is read-only to it, except its two folders |
| `ProtectHome`, `PrivateTmp`, `ProtectProc=invisible` | It cannot see people's home folders, has a `/tmp` of its own, and cannot see other users' programs |
| `ProtectKernelTunables`, `ProtectKernelModules`, `ProtectKernelLogs`, `ProtectControlGroups`, `ProtectClock`, `ProtectHostname` | It cannot change kernel settings, load drivers, read the kernel log, or set the clock or the computer's name |
| `DevicePolicy=closed` with three `DeviceAllow` lines | Of the computer's devices it may open USB device files (the sticks) and USB serial ports — no disks, no memory, no sound card, no screen |
| `RestrictAddressFamilies`, `RestrictNamespaces`, `RestrictRealtime`, `RestrictSUIDSGID`, `LockPersonality` | Ordinary internet and local sockets only; none of the kernel features that sandbox escapes lean on |
| `SystemCallFilter` | Only the system calls an ordinary service needs |
| Not set: `MemoryDenyWriteExecute` | Node.js turns JavaScript into machine code as it runs, which needs memory that is both writable and executable |

systemd gives a service an *exposure score* from 0 (most closed) to 10 (most open). This one
scores **1.7** with the enterprise profile and **1.9** with the standard profile (the one extra
capability), on systemd 252, 255 and 257. RPi ALERT's own service on a Pi, which keeps `sudo`, is not
comparable and was not scored here.

What is **not** installed, on purpose: no sudo rule, no "alert" maintenance account, no timer
that fetches SSH keys, no updater, no screen kiosk, no Wi-Fi hotspot, no cap on the system log.
Accounts, SSH, operating-system updates and where logs go are the organisation's own. A new
agent version arrives as a new version of this package, built from the next signed release.

With no root helper some buttons on the dashboard do nothing (restart or shut down, install an
update, join a Wi-Fi network, the hotspot, SSH access). They answer that the system helper is
not installed.

### The two commands

`rpi-alert` is RPi ALERT's own command (`rpi-alert status`, `rpi-alert setup`, …). Three of its
sub-commands belong to the Raspberry Pi install and are turned away with the reason: `daemon`,
`access` and `import-boot-config`.

`open-alert-base` is this layer's:

| Command | What it does |
|---|---|
| `open-alert-base version` | The package, the agent, the signed release it came from, Node.js, and whether this computer's `rtl-sdr` knows the V4 stick |
| `open-alert-base status` | Is the service running, which profile, and the agent's own status |
| `open-alert-base profile` | The profile in force and the ones there are; as root, also what has been changed since |
| `sudo open-alert-base profile <name>` | Put `standard` or `enterprise` in force |
| `sudo open-alert-base sync` | After changing the dashboard's port by hand: make the service's one capability and the firewall lock follow the settings |
| `sudo open-alert-base audit` | The security posture on one page, for a reviewer: what is installed and whether every agent file still matches the signed release, who it runs as, what it is kept from (read from the running program, not only from the file), what listens on the network, the profile and the settings that matter, the proxy, and which parts of RPi ALERT's Pi installer are absent |
| `open-alert-base selftest` | Run the agent's own test suite on this computer, as the service's user |
| `open-alert-base bench` | Run the benchmark in `bench/`, when it was built into the package |

### The two profiles

A profile is a short list of the agent's own settings, merged into
`/etc/rpi-alert/config.json` through the agent's own settings code, so every value is held to
the agent's own rules and nothing else in the file is touched. One is applied when the package
is first installed **and there is no settings file yet**; an existing settings file is never
overwritten by an install or an update.

| | `standard` | `enterprise` |
|---|---|---|
| For | A base station on a small network, or a network of its own | A base station inside a government or corporate network |
| Dashboard port (`web.port`) | 80, as on a Pi | 8080 |
| Dashboard reached from | The local network | This computer only (`web.bind` = `127.0.0.1`, and the firewall lock) |
| What Flood-Net may do (`remote.mode`) | `manage`: change radio settings, restart receivers | `report`: it is told how the base station is, and whatever it asks is refused. `rpi-alert remote off` stops even that |
| Wi-Fi hotspot (`hotspot.mode`) | off | off |
| Restarting networking or the computer by itself (`recover.mode`) | off | off |
| Screen kiosk (`kiosk.mode`), audio (`audio.mode`) | off | off |
| Capabilities the service holds | One: `CAP_NET_BIND_SERVICE` | None |

Audio and self-recovery are off in both because of how the service is built: it is allowed no
sound card, and without a root helper it could not restart anything.

**Port 80 and the one capability.** A program that is not root may not open a port below 1024.
The service file gives no capability at all. When the settings ask for a port below 1024,
`open-alert-base profile` and `open-alert-base sync` write a small file of the service's own,
`/etc/systemd/system/open-alert-base.service.d/10-low-port.conf`, that adds
`CAP_NET_BIND_SERVICE` and nothing else; for any other port they remove it. So the standard
profile really serves port 80, and the enterprise profile holds no capability. Without that
file the agent is refused port 80 and falls back to 8080 (this is checked).

**"This computer only", today.** RPi ALERT 0.23.1 opens its dashboard on every network address
of the computer and has no setting for that. The profile writes `web.bind` = `127.0.0.1` all the
same: checked, 0.23.1 keeps a setting it does not know, takes no notice of it, and does not lose
it when it rewrites its settings file. What keeps other computers out today is the firewall
lock: one small table of *nftables* rules (nftables is Linux's firewall) that
`open-alert-base-firewall.service` loads. It refuses the dashboard's port to everything but the
computer itself, and — a second net — throws away the reply to any call from another computer
to any port the agent's user has open. It is a table of its own and changes nothing in whatever
firewall the computer already has. If `nftables` is not installed, `profile enterprise` says in
capitals that the dashboard is not yet kept to this computer, and ends with status 3.

Anybody logged in on the computer itself can still read and change the agent's settings through
`http://127.0.0.1:8080/` without a password: RPi ALERT treats callers from the computer itself
as its administrator. `audit` says so.

### Waiting for RPi ALERT 0.24

RPi ALERT 0.24.0, not yet released, adds `web.bind`, `web.hosts`, `web.behindProxy` and
`web.requireLogin`. When the pin moves to it:

- `web.bind` takes effect by itself (the enterprise profile already carries it). The firewall
  lock stays, as a second lock.
- Decide whether the enterprise profile should also set `web.requireLogin` to `all` (nothing
  readable without a password) and whether an organisation's DNS name goes into `web.hosts`.
  Neither is set today, because 0.23.1 could not be checked against values it does not know.
- Re-run `firmware/test/deb.sh`: its check of what the agent listens on already accepts either
  answer and says which it found.

### A web proxy and a private certificate authority

Name the proxy in `/etc/open-alert-base/env` (`HTTPS_PROXY=…`, `NO_PROXY=…`) and restart the
service. The agent makes its calls with Node.js's built-in `fetch`, which before Node.js 22.21
takes no notice of a proxy, so the start command picks one of two ways:

| Node.js | How the proxy is handed over |
|---|---|
| 22.21 or newer, 24 or newer | `NODE_USE_ENV_PROXY=1`: Node.js reads the proxy settings itself |
| Older (Debian 13's 20, Ubuntu 24.04's 18) | A short start-up file, `proxy-preload.js`, is loaded first. It points `fetch` at the proxy using the `undici` library that Debian and Ubuntu install with their Node.js. It honours `NO_PROXY`, and a user name and password in the proxy's address |
| No proxy set | Nothing is loaded and nothing is added |

A proxy's password is kept out of the log line that names the proxy.

A private certificate authority (a network that opens HTTPS traffic for inspection and signs it
again) is added to the operating system the usual way — copy its `.crt` file into
`/usr/local/share/ca-certificates/` and run `sudo update-ca-certificates`. Debian's and Ubuntu's
Node.js then trusts it with nothing more to set.

### Removing it

```
sudo apt remove open-alert-base      # the settings, the data and the agent's user are kept
sudo apt purge open-alert-base       # they are deleted
```

## Testing

```
firmware/test/deb.sh                                   # everything, on all three systems
firmware/test/deb.sh --tarball F --sig S ubuntu2404    # no download; one system
firmware/test/deb.sh --help
```

It needs Docker, `dpkg-deb`, `openssl`, and `shellcheck` and `lintian` if they are to be run.
It never uses a privileged container or the computer's own network. Logs go to
`dist/test-logs/deb/`. It ends with a count and with status 0 only when every check that ran
passed. In order:

1. **The release check.** The real release is accepted. Refused: a tarball with one byte added;
   the same with a pin changed to match its hash (so only the signature stands in the way); a
   wrong hash in the pin; a signature with one bit changed, or of the wrong length; the real
   tarball signed by another key; another key put in the release key's place; a pin naming
   another version; a pin whose address is not HTTPS; and tarballs made and correctly signed by
   the test itself that hold a link, a file outside the folder, a `..` path, a set-user-id
   program, or an agent of another version.
2. **The scripts and the build.** shellcheck; the package builds, twice the same; its contents
   are what they should be and the agent in it is the release's, file for file.
3. **On each system, in clean containers** (`debian:trixie-slim`, `ubuntu:24.04`,
   `debian:bookworm-slim`):
   - *a. Install.* `apt-get install ./the.deb`; files, owners and modes; the agent's own test
     suite as the service's user; the agent started exactly as the service file says (same
     user, groups, environment, capabilities, start command — read from the installed file)
     with RPi ALERT's own stand-ins for a stick and for Flood-Net, as its `simulate.sh` sets
     them up; the dashboard answers and decoded readings reach the stand-in; both profiles; a
     web proxy that is the only way to the stand-in, with a private certificate authority, with
     and without a password, on the system's Node.js and on a Node.js 22.21+ when the test
     computer has one; remove, reinstall, purge; the refusal beside RPi ALERT's own install;
     systemd's checker and exposure score.
   - *b. The firewall lock*, tried from a second container that plays another computer. This
     container is given the one capability that changing firewall rules needs (`NET_ADMIN`).
   - *c. Under a real systemd*, as the container's first program: the package installed and the
     real service started, sandbox and all; the service itself tries what it should not be able
     to do; both profiles; an update over itself; remove and purge. This container is given
     `SYS_ADMIN` (systemd needs it to build the sandbox) and `NET_ADMIN`. Where systemd will not
     start in a container the part is skipped and says so (`--require-systemd` makes that a
     failure).

## What has been tested, and where

Everything below was run on 11 November 2026 on one computer: a virtual machine with an ordinary
64-bit PC processor (x86-64), Ubuntu 24.04, Docker 29. **It has no USB at all, so no radio stick,
real or passed through, was involved in any of it.** One run of `firmware/test/deb.sh` (started
10:14 UTC, 16 minutes): **719 checks passed, none failed, 1 skipped.** After that run, what
`audit` prints about the dashboard's reach and about where the agent calls out to was made
plainer, and checks for it were added; the run is being repeated on the files as they are now,
and this paragraph is updated when it ends.

The three systems, as the containers had them:

| | Debian 13 | Ubuntu 24.04 | Debian 12 (not a target) |
|---|---|---|---|
| Node.js | 20.19.2 | 18.19.1 | 18.20.4 |
| `rtl-sdr` | 2.0.2 | 2.0.1 | 0.6.0 — **does not know the RTL-SDR Blog V4 stick** |
| The `undici` library beside Node.js | 7.3.0 | 5.26.3 | 5.15.0 |
| systemd | 257 | 255 | 252 |
| nftables | 1.1.3 | 1.0.9 | 1.0.6 |

| What | Debian 13 | Ubuntu 24.04 | Debian 12 |
|---|---|---|---|
| `apt install ./the.deb`, everything it needs from the system's own packages; files, owners and modes; `dpkg --verify`; every installed agent file has the SHA-256 it has in the signed release | Passed | Passed | Passed |
| The agent's own test suite from the installed files, as the service's user (30 of its 31 test files; the other tests the root helper, which is not installed) | 238 of 238 | 238 of 238 | 238 of 238 |
| The agent started as the service file says, with stand-ins for a stick and for Flood-Net: the dashboard answers, decoded readings reach the stand-in | Passed | Passed | Passed |
| Standard profile: port 80 with exactly one capability; the same service without the drop-in file is refused port 80 | Passed | Passed | Passed |
| Enterprise profile: port 8080, no capability at all, checks in with Flood-Net as "report"; `web.bind` survives the agent rewriting its settings | Passed | Passed | Passed |
| A web proxy that is the only way out, with a private certificate authority, `NO_PROXY`, with and without a password — on the system's own Node.js (the start-up file) | Passed | Passed | Passed |
| The same on Node.js 22.23.4 (`NODE_USE_ENV_PROXY`); this Node.js was the test computer's own, not a Debian or Ubuntu package | Passed | Passed | Passed |
| Remove keeps settings and data; reinstall leaves the settings byte for byte; purge deletes everything; refused beside RPi ALERT's own install | Passed | Passed | Passed |
| systemd's checker (`systemd-analyze verify`) on both service files | Nothing to report | Nothing to report | Nothing to report |
| Exposure score of the service (`systemd-analyze security`, from the file and from the running service) | 1.7 enterprise, 1.9 standard | 1.7, 1.9 | 1.7, 1.9 |
| The firewall lock, tried from a second container: the dashboard's port open before, refused with the lock on, another user's port left alone, open again when the table is removed | Passed | Passed | Passed |
| Under a real systemd in a container: the install starts the service; port 80 by the drop-in file; the service itself is refused writing in `/usr`, `/etc` and `/var`, can write its two folders, has its own `/tmp`, cannot read the proxy file; the agent arms systemd's watchdog; killed, it is restarted; the enterprise profile loads the firewall lock; an update over itself; remove and purge | Passed | Passed | Passed |
| The kernel's device list for the running service | Skipped: this systemd keeps it where it cannot be listed | Listed: the standard pseudo-devices only. USB was not on it, because the test computer's kernel has no USB | As Ubuntu |

Also, on the test computer itself:

| What | Result |
|---|---|
| The release check accepts the real v0.23.1 — from local files, and downloaded from GitHub — and refuses the 14 bad cases listed under Testing | Passed |
| shellcheck 0.9.0 on the 11 shell scripts here | Nothing to report |
| The package builds; a second build is the same file | Passed: 2.4 MB, 5.9 MB installed |
| lintian, Debian's package checker | No errors; 7 warnings, none acted on (no manual pages; the 0640 mode of `env`; a `systemctl` call in the install script; two files with a script line but no run permission, one of them the release's own; a udev rule without desktop-catalogue data) |

## What has not been tested

- **A real radio stick on a computer that is not a Raspberry Pi.** Not natively, not in a
  container. The udev rule, the driver block list and the service's device list
  (`DeviceAllow=char-usb_device`) have never met a real stick: the test computer's kernel has no
  USB, so systemd had no USB device class to put on the list. This is the first thing to try on
  real hardware.
- **Serial receivers** (a Quansheng radio, an ERT-A2, a GPS) under the service's device list.
- **Any ARM computer.** The package holds no compiled code, so there is no reason to expect a
  difference, but it has not been run on one. The automatic build is to run these checks on
  GitHub's ARM machines.
- **A real computer start-up.** The systemd checks ran in containers. Nothing has been
  restarted to see the service, the firewall lock and the two serial drivers come up by
  themselves, and the firewall lock has not been tried beside another firewall (`ufw`,
  `firewalld`, a `flush ruleset` in `/etc/nftables.conf`).
- **A real web proxy and a real inspecting network.** The proxy in the test is a few lines
  written for it; it tunnels and can ask for a password, and does nothing else a commercial
  proxy does (no NTLM or Kerberos sign-in, for one — the start-up file cannot do those).
- **An update from an older version of this package.** There is no older version. The same
  package installed over itself is tested.
- **Flood-Net itself.** The stand-in is RPi ALERT's own test helper.
- **RPi ALERT 0.24.**

## Choices made here

Where the design left something open, this is what was chosen and why.

- **The capability follows the port, not the profile's name.** `profile` and `sync` look at
  `web.port`: below 1024, the drop-in file is written; otherwise it is removed. A person who
  moves the standard profile to port 8080 loses the capability too.
- **The firewall lock is one table of its own**, loaded by a small service of its own that runs
  for a moment as root with one capability (`CAP_NET_ADMIN`), rather than a line in the
  computer's `/etc/nftables.conf`, which is the organisation's file.
- **`web.bind` is in the enterprise profile already**, after checking that 0.23.1 keeps and
  ignores it. In the standard profile it is written as "the agent's own default", which takes
  it out of the file while the agent does not know the setting.
- **Profiles are applied as the agent's user, through the agent's own settings code**, never by
  root editing the file: the settings folder belongs to that user, and root following a link
  there would be a way up.
- **The start profile can be named at install** (`OPEN_ALERT_BASE_PROFILE=enterprise`, or a
  file `/etc/open-alert-base/profile` put there beforehand), so a disk image or a container can
  be locked down from its first start.
- **The udev rule gives the sticks to the group `plugdev` only** (mode 0660; RPi ALERT's own
  rule lets everybody read them, 0664).
- **The two USB serial drivers are loaded at start-up.** systemd works out the service's device
  list from the drivers loaded when the service starts; without this a serial receiver plugged
  in for the first time later would be refused until a restart. On a kernel built without them
  systemd reports that it could not load them; the file says how to silence that.
- **Purge deletes the agent's user**, with its settings and data, unless RPi ALERT's own install
  has appeared on the computer since — then all three are left alone.
- **The agent's `priv-net` test file is left out of `selftest`**: it tests RPi ALERT's root
  helper, which is not installed here. The other 30 files are run.
- **The benchmark is built into the package when `bench/open-alert-bench.js` is there** and
  parses; `--no-bench` leaves it out.
