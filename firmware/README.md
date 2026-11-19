# firmware — an open-ALERT base station on a computer that is not a Raspberry Pi

**First version, 11 November 2026. Tested with stand-ins for the radio sticks only — see
[What has been tested, and where](#what-has-been-tested-and-where). Not reviewed by a second
person, and not released.** Two automated reviews (one for security, one for correctness) read
it and tried it on 18 November 2026; what they found, and what was done about each point, is in
[After the two reviews](#after-the-two-reviews-18-november-2026). The automatic build first ran
on GitHub on 19 November 2026 ([what it found](#the-first-run-on-github-19-november-2026)), and
the same day the pin moved to RPi ALERT 0.24.0
([what that changed](#moving-to-rpi-alert-0240-19-november-2026)).

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
| A hardened container | Toradex's Torizon OS, and any computer that runs containers | `container/` — described under [The container](#the-container) |
| A ready-to-flash disk image | A computer that is to be a base station and nothing else | `image/` — described under [The disk image](#the-disk-image) |

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
| `container/`, `test/container.sh` | The container (its image recipe, its compose files, the one-time set-up of the computer it runs on) and its checks |
| `image/`, `test/image.sh` | The disk image (its build script, its lists of packages, the first set-up files) and the check that starts it in a virtual machine |
| `bench/` | A benchmark: how many channels a computer will carry (it has its own notes) |
| `../.github/workflows/firmware.yml` | The automatic build: see [How it is built and checked automatically](#how-it-is-built-and-checked-automatically) |
| `../dist/` | Where builds and test logs go. Not kept in git |

## The pin: which release is shipped, and how it is checked

`PIN` is a short file of `NAME=value` lines. Today it names RPi ALERT **v0.24.0** (released 19
November 2026; until then the layer was built on v0.23.1).

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

The two files are first copied into a folder of the script's own that nobody else can write,
and every check and the unpacking are done on those copies, so what is unpacked is the very
file that was checked.

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

These are the steps the move to 0.24.0 took.

1. Read the release's notes, and what its `docs/configuration.md` says of any new setting.
   Download its two files (`rpi-alert-<tag>-src.tar.gz` and `.sig`) and work out the SHA-256:
   `sha256sum rpi-alert-<tag>-src.tar.gz`.
2. In `PIN`, change `AGENT_TAG`, `AGENT_VERSION`, both addresses and `AGENT_SHA256`, set
   `OA_REVISION` back to 1, and make the comment above it say what came before. Leave the key
   lines alone unless RPi ALERT has announced a new key — and then check the new fingerprint
   against its `docs/release-signing.md` and, better, with the owner by another route.
3. Check the two files against the new pin:
   `firmware/lib/fetch-agent.sh --verify-only --tarball F --sig S`.
4. Add an entry at the top of `deb/changelog` for the new version (`deb/build-deb.sh` builds
   nothing without one).
5. New settings: a profile may name only settings the agent knows (`test/deb.sh` checks it
   against the release's own list), and `settings.js` names the ones a profile holds (`HELD`).
6. The agent's own tests: run the release's suite from an agent folder with no `os/` folder
   beside it, as the package installs it. A test that reads RPi ALERT's Raspberry Pi installer
   files (`os/…`) cannot pass here: put it in `LEFT_OUT_FILES` or `LEFT_OUT_TESTS` in
   `deb/files/usr/bin/open-alert-base`, with the reason, and nothing else.
7. Run the checks: `test/deb.sh`, `test/container.sh`, `bench/test.sh`, and build the disk image
   (`image/build-image.sh`). `test/image.sh` is best left to the automatic build, which has
   KVM. `deb/build-deb.sh` stops if the release holds a file or folder it does not know, so that
   somebody decides where it belongs.
8. Change the version wherever it is named:
   `grep -rn '<old version>' firmware docs .github atlas.json site/data` — this page, the
   package's own README, `docs/security/`, the examples in `container/`, the consumes entry in
   `atlas.json` (with its `since` date), and the catalogue's entry in `site/data/alert.js`.

## The native package: `open-alert-base`

### Building it

```
firmware/deb/build-deb.sh                                # downloads the pinned release
firmware/deb/build-deb.sh --tarball F --sig S            # uses two files already here
```

It needs `dpkg-deb`, `tar`, `gzip`, either OpenSSL 3 or Node.js, and `curl` for the download;
no compiler. The result is
`dist/open-alert-base_0.24.0+oa1_all.deb`, about 2.4 MB. The version is the agent's version,
then `+oa` and this layer's own revision (1: the first on 0.24.0; before it the layer was built
on RPi ALERT 0.23.1 as `0.23.1+oa1` and `0.23.1+oa2`, both built and tested, neither
released). `all` means one file for every kind of processor: the
package is JavaScript and shell scripts. Built twice from the same files it is the same file,
byte for byte, whatever kind of disk it is built on and whatever file mask the builder has
(the installed size it records is worked out from the files' own lengths, as Debian's tools
count it, not from the space they take on the build computer's disk). After packing, the
script unpacks its own result and compares every agent file with the release again.

### Installing it

On Debian 13 or Ubuntu 24.04, as the administrator:

```
sudo apt install ./open-alert-base_0.24.0+oa1_all.deb
rpi-alert setup                    # the Flood-Net token, a name, where the base station is
open-alert-base status
```

`apt` brings what it needs from the operating system's own packages: `nodejs` (18.17 or newer),
`rtl-sdr`, `ca-certificates`, `adduser`, and `nftables` (recommended: the enterprise profile's
firewall lock uses it). Nothing comes from npm or from anywhere else.

**On Ubuntu 24.04**, `nodejs` (18.19) and `rtl-sdr` are in the *universe* part of Ubuntu's
archive, which must be switched on, or the install stops for want of them. Node.js 18 is no
longer looked after by its own makers (since 30 April 2025), and Ubuntu gives universe packages
security fixes only through its paid Ubuntu Pro. A security reviewer will rightly ask about it.
Debian 13, with Node.js 20 in its main archive, is the better target where there is a choice,
and the better one for the enterprise profile.

To start locked down from the first moment, name the profile at install:

```
sudo OPEN_ALERT_BASE_PROFILE=enterprise apt install ./open-alert-base_0.24.0+oa1_all.deb
```

The same works on a computer that already has settings (the package removed and installed
again, say): when the profile named is not the one in force, it is put in force over them, and
the install says so. A profile changes only the settings it names; the Flood-Net token, the
name and the channels stay.

The package refuses, with a plain message, to install on a computer where RPi ALERT's own
installer has been used (`/opt/rpi-alert` or an `rpi-alert.service` is there): both would run
the same agent on the same settings. It says how to remove the other one first, and that RPi
ALERT's own `install.sh --uninstall` leaves three things behind which this package does not
want: the `alert` maintenance account (it can log in), the screen's account `rpi-alert-kiosk`,
and the agent's user in the `audio` and `video` groups. The message gives the commands that
remove them (`userdel -r alert`, `userdel -r rpi-alert-kiosk`, `gpasswd -d rpi-alert audio`,
the same for `video`), and `sudo open-alert-base audit` lists any of them that are still there.

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
| `/usr/lib/systemd/system/open-alert-base-firewall.service`, `/etc/open-alert-base/dashboard-local-only.nft`, `/usr/lib/open-alert-base/lock-keeper` | The enterprise profile's firewall lock, and the small program that keeps it in place |
| `/etc/open-alert-base/env` | Where a web proxy is named (readable by root only: it may hold a proxy's password) |
| `/usr/lib/udev/rules.d/60-open-alert-base.rules` | Lets the agent's user open RTL-SDR sticks (USB ids `0bda:2832` and `0bda:2838`, as in RPi ALERT's own rule) |
| `/usr/lib/modprobe.d/open-alert-base-blacklist-dvb.conf` | Keeps the kernel's digital-TV drivers off the sticks (the five names in RPi ALERT's own list) |
| `/usr/lib/modules-load.d/open-alert-base.conf` | Loads the two USB serial drivers when the computer starts, for serial receivers (the install loads them at once as well, so a receiver works before the first restart) |
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
| No capabilities | A *capability* is one named piece of root's power. The service has none — or exactly one, `CAP_NET_BIND_SERVICE`, when the profile in force puts the dashboard on a port below 1024 (see the profiles) |
| `ProtectSystem=strict` | The whole disk is read-only to it, except its two folders |
| `ProtectHome`, `PrivateTmp`, `PrivateMounts`, `ProtectProc=invisible` | It cannot see people's home folders, has a `/tmp` of its own and its own view of what is mounted, and cannot see other users' programs |
| `ProtectKernelTunables`, `ProtectKernelModules`, `ProtectKernelLogs`, `ProtectControlGroups`, `ProtectClock`, `ProtectHostname` | It cannot change kernel settings, load drivers, read the kernel log, or set the clock or the computer's name |
| `DevicePolicy=closed` with three `DeviceAllow` lines | Of the computer's devices it may open USB device files (the sticks) and USB serial ports — no disks, no memory, no sound card, no screen. A serial port built into the computer (`/dev/ttyS0` and the like, often an RS-232 port on an industrial PC) is closed to it too; to open one for a receiver, `sudo systemctl edit open-alert-base`, add the two lines `[Service]` and `DeviceAllow=/dev/ttyS0 rw`, and restart the service (the service file and the package's README say the same; not tried here) |
| `RestrictAddressFamilies`, `RestrictNamespaces`, `RestrictRealtime`, `RestrictSUIDSGID`, `LockPersonality` | Ordinary internet and local sockets only; none of the kernel features that sandbox escapes lean on |
| `SystemCallFilter` | Only the system calls an ordinary service needs |
| Not set: `MemoryDenyWriteExecute` | Node.js turns JavaScript into machine code as it runs, which needs memory that is both writable and executable |

systemd gives a service an *exposure score* from 0 (most closed) to 10 (most open). This one
scores **1.7** with the enterprise profile and **1.9** with the standard profile (the one extra
capability), as the running service on systemd 252, 255 and 257. RPi ALERT's own service on a
Pi, which keeps `sudo`, is not comparable and was not scored here.

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
`access` and `import-boot-config`. The last is the one that, from RPi ALERT 0.24, applies
`/etc/rpi-alert.conf` as root on a computer with no boot partition: this package applies no such
file (`audit` says so if one is there). Settings go through `rpi-alert setup`,
`rpi-alert config set`, the dashboard, or a profile.

`open-alert-base` is this layer's:

| Command | What it does |
|---|---|
| `open-alert-base version` | The package, the agent, the signed release it came from, Node.js, and whether this computer's `rtl-sdr` knows the V4 stick |
| `open-alert-base status` | Is the service running, which profile, where the dashboard is, who must log in, and the agent's own status. Ends with an error when the settings file cannot be used or no longer matches the profile |
| `open-alert-base profile` | The profile in force and the ones there are; as root, also what has been changed since |
| `sudo open-alert-base profile <name>` | Put `standard` or `enterprise` in force |
| `sudo open-alert-base sync` | After changing the dashboard's port by hand: make the service's one capability and the firewall lock follow the profile and the settings. An install and an update run it too. Status 3: the lock could not be put on; 4: the settings ask for less than the profile, and the profile was kept (where a setting the profile holds was loosened, the service is restarted, and its start puts it back) |
| `sudo open-alert-base audit` | The security posture on one page, for a reviewer: what is installed and whether every agent file still matches the signed release, who it runs as, what it is kept from (read from the running program, not only from the file), what listens on the network, the profile and the settings that matter — the dashboard's address (`web.bind`), who counts as the computer itself (`web.behindProxy`), the login rule (`web.requireLogin`), its extra names (`web.hosts`) and which of them the profile holds — the proxy, and which parts of RPi ALERT's Pi installer are absent |
| `open-alert-base selftest` | Run the agent's own test suite on this computer, as the service's user |
| `open-alert-base bench` | Run the benchmark in `bench/`, when it was built into the package |

### The two profiles

A profile is a short list of the agent's own settings, merged into
`/etc/rpi-alert/config.json` through the agent's own settings code, so every value is held to
the agent's own rules and nothing else in the file is touched. One is applied when the package
is first installed **and there is no settings file yet**. An install or an update leaves an
existing settings file as it is, with one exception: an install told which profile to use
(`OPEN_ALERT_BASE_PROFILE`) when that is not the profile in force puts it in force, and says so.

The profile in force is root's own record, `/etc/open-alert-base/profile`. The settings file
belongs to the agent's user, so the agent, or anybody using its dashboard from the computer
itself, can change it; root never takes a looser rule from it. The profile decides whether the
dashboard is kept to the computer (the firewall lock) and whether the service may have the
capability for a low port. The settings can ask for more care than the profile, never for less:
"this computer only" set under the standard profile turns the lock on; `web.bind` taken out of
the settings under the enterprise profile does not turn it off. In that case `sync` (which an
update runs) keeps the lock, says in capitals that the settings no longer match the profile,
and ends with status 4; `status` calls it a fault and ends with status 1, and `audit` lists it
as a fault. Only `sudo open-alert-base
profile standard` opens the dashboard to the network.

**The settings a profile holds.** Three of RPi ALERT 0.24's dashboard settings have no firewall
behind them, or (`web.bind`) only the lock. Where a profile asks for the closed value of one, it
*holds* it: `web.bind` on this computer's own address, `web.behindProxy` on, `web.requireLogin`
`all`. The enterprise profile holds all three; the standard profile holds `web.behindProxy`. The
service's start command (`/usr/lib/open-alert-base/start`, root's file, run by systemd each time
before the agent) reads the profile in force and, through the agent's own settings code, puts
back any of them the settings file has looser, and says so in the service's log
(`journalctl -u open-alert-base`). Something closer still is left as it is. If the settings
file is not there, the agent starts on the profile's settings; if it is not valid JSON, the
agent starts on the profile's settings too, and the broken file is kept as `config.json.bad`
(as the agent itself would keep it, before it wrote its built-in settings over it); if it is a
link or cannot be read, nothing is written over it, and the agent itself takes its most closed
values for all three. If the held settings cannot be made to hold, the agent is not started.
A setting loosened while the agent runs — `rpi-alert config set web.behindProxy false`, which
anybody on the computer itself may do — is named by `status`, `audit` and `sync`; `sync` then
restarts the service, which puts it back.

A settings file that root put in place — by configuration management, a restored backup, or
cloud-init's `write_files` — belongs to root, and the agent could not read it: it would run on
its built-in settings, without the token. The install and `sync` hand such a file to the agent's
user (readable by that user alone) and say so. They do it on the opened file itself, and only
for a plain file of root's with no second name, so a link put in its place is not followed: it
is left alone, and `sync` stops with an error. A settings file the agent cannot use for any
other reason (not valid JSON, say) stops `sync` and `profile` too, and nothing is written over
it.

| | `standard` | `enterprise` |
|---|---|---|
| For | A base station on a small network, or a network of its own | A base station inside a government or corporate network |
| Dashboard port (`web.port`) | 80, as on a Pi | 8080 |
| Dashboard reached from | The local network | This computer only: the agent listens on `127.0.0.1` only (`web.bind`), and the firewall lock keeps other computers out as well |
| Who counts as the computer itself (`web.behindProxy`) | On: a request on `127.0.0.1` that asks for `127.0.0.1` or `localhost` by name, with none of a reverse proxy's headers. A reverse proxy's callers, and a web page in a browser on this computer that comes from another site or from a name pointed at this computer, are visitors. Any program on this computer, and a page that this computer itself serves (`localhost` or `127.0.0.1`, on any port), still count as the computer itself | On, the same |
| What a visitor sees without the password (`web.requireLogin`) | `settings`: it may look; changing anything needs the password | `all`: nothing at all — what comes through a reverse proxy on this computer must log in first |
| Settings the profile holds (the settings file may not loosen them) | `web.behindProxy` | `web.bind`, `web.behindProxy`, `web.requireLogin` |
| What Flood-Net may do (`remote.mode`) | `manage`: change radio settings, restart receivers | `report`: it is told how the base station is, and whatever it asks is refused. `rpi-alert remote off` stops even that |
| Wi-Fi hotspot (`hotspot.mode`) | off | off |
| Restarting networking or the computer by itself (`recover.mode`) | off | off |
| Screen kiosk (`kiosk.mode`), audio (`audio.mode`) | off | off |
| Capabilities the service holds | One: `CAP_NET_BIND_SERVICE` | None |

Audio and self-recovery are off in both because of how the service is built: it is allowed no
sound card, and without a root helper it could not restart anything.

**What "the local network" can do, in the standard profile.** Anybody who can reach the
computer can open the dashboard and look, without a password: what is being heard, the latest
readings, how the base station is (its location and addresses are left out). Changing anything
needs the dashboard's password. The page is plain HTTP, not HTTPS. That is RPi ALERT's own rule
as it comes (`web.requireLogin` `settings`), and the standard profile keeps it; it is the reason
the enterprise profile keeps the dashboard to the computer itself and shows nothing without the
password.

**Why `web.behindProxy` is on in both.** As it comes, RPi ALERT takes every request from the
computer's own address (`127.0.0.1`) for the computer itself — its screen, or the `rpi-alert`
command — and lets it in with no password. On a Raspberry Pi whose only browser is its own
screen that is right. This package is for PCs, where somebody may browse the web: a web page in
that browser whose name has been pointed at `127.0.0.1` would be taken for the base station
itself and could change its settings, and so would every caller of a reverse proxy that does
not add `X-Forwarded-For`. RPi ALERT's own `docs/configuration.md` asks for `web.behindProxy` on
any such computer, even with no proxy. With it on, a request on `127.0.0.1` is the computer
itself only when it asks for `127.0.0.1` or `localhost` by name, in HTTP/1.1, with none of a
proxy's headers, and, when a browser sends it, from a page of one of those names. The
`rpi-alert` command, `open-alert-base status` and a browser on the computer opening
`http://localhost/` all do. The first two were tried as they are; for the browser, a request
made like a browser's (`Host: localhost`, and a page on `localhost` named as its `Origin`) was
tried, not a real browser. A page from another site, or from a name pointed at this computer,
is a visitor. One limit stays, as RPi ALERT's own `docs/hardware.md` says ("from a page of that
name"): a page that another program on this computer serves under `localhost` or `127.0.0.1`,
on any port, counts as the computer itself too, and so can change the base station's settings
without a password. On a computer that runs other web services for its browser, that is worth
knowing; the package cannot close it. It changes nothing another computer sees. The agent says
at each start that it is on, with a check to make from another computer when a reverse proxy is
in front; with no proxy, that check has nothing to try.

**Port 80 and the one capability.** A program that is not root may not open a port below 1024.
The service file gives no capability at all. When the settings ask for a port below 1024 and
the profile in force itself uses such a port (the standard profile's 80), `open-alert-base
profile` and `open-alert-base sync` write a small file of the service's own,
`/etc/systemd/system/open-alert-base.service.d/10-low-port.conf`, that adds
`CAP_NET_BIND_SERVICE` and nothing else; for any other port they remove it. So the standard
profile really serves port 80, and the enterprise profile holds no capability, whatever its
settings file says (a low port asked for there gets none, and `sync` says so with status 4).
Without that file the agent is refused port 80 and falls back to 8080 (this is checked).

**"This computer only": two guards.** The first is the agent itself: with `web.bind` =
`127.0.0.1`, which the enterprise profile sets and holds, it listens on the computer's own
address and nowhere else (RPi ALERT 0.24; 0.23 had no such setting and listened on every
address). The second is the firewall lock: one small table of *nftables* rules (nftables is
Linux's firewall) that `open-alert-base-firewall.service` loads. It refuses the dashboard's port
to everything but the computer itself, and — a second net — throws away the reply to any call
from another computer to any port the agent's user has open. It is a table of its own and
changes nothing in whatever firewall the computer already has. Both are tested: from a second
container, the agent alone keeps the dashboard's port shut; with the agent made to listen on
every address, the lock alone does.

**No lock, no agent.** In a profile that keeps the dashboard to the computer, the agent's
service is tied to the lock's (`BindsTo=`, in a small file of its own,
`/etc/systemd/system/open-alert-base.service.d/20-dashboard-lock.conf`): it runs only while the
lock's service does. The lock's service loads the rules first, and fails if they do not load —
a slip in the rules file, the file missing, no `nftables` on the computer, a kernel without
nftables — and then the agent is stopped, or not started. `profile enterprise` and `sync` say
so in capitals and end with status 3. systemd tries the lock again every 15 seconds, with no
limit on how many times (its usual limit, five starts in ten seconds, is soon reached by a
person putting the file right, and would make it give up); once it holds, the agent is started
again by itself. The lock's service then stays running, as a
keeper (`lock-keeper`): when something takes the table away — every firewall table cleared by
hand, or the system's own `nftables` service started, restarted or stopped, each of which
clears every table on Debian and Ubuntu — it puts it back at once (in about half a second in
the tests), and if it cannot, it stops with an error and the agent stops with it. Stopping the
lock's service does not open the dashboard: the table stays, and only `profile standard` (or
removing the package) takes it away. A flood-warning receiver that stops because its firewall
rule failed is the price of this; it says why, and the earlier choice (the agent runs on
without the lock) let other computers reach the dashboard without anybody being told.

Anybody logged in on the computer itself can still read and change the agent's settings through
`http://127.0.0.1:8080/` without a password: RPi ALERT treats callers from the computer itself
as its administrator. `audit` says so.

**A reverse proxy for HTTPS.** The dashboard is plain HTTP. To publish an enterprise base
station's dashboard over HTTPS with your organisation's certificate, put a reverse proxy on the
same computer, in front of `127.0.0.1:8080`. The profile already has the agent's side of it
(`web.behindProxy` on, a login for everything); the proxy must add `X-Forwarded-For` on every
route and pass the browser's `Host` on, and that name goes in `web.hosts`
(`rpi-alert config set web.hosts bs01.council.example`). RPi ALERT's `docs/configuration.md`,
"What the proxy has to do", gives the lines for nginx, Caddy and HAProxy and the check to make
from another computer. Not tried with a real proxy here. The firewall lock refuses port 8080 to
other computers, not the proxy's own port: open that one in the computer's own firewall.

### Moving to RPi ALERT 0.24.0 (19 November 2026)

RPi ALERT 0.24.0 adds four settings for a base station on an organisation's network, each as
before until it is set: `web.bind` (the one address the dashboard listens on, beside
`127.0.0.1`), `web.hosts` (more names it answers to), `web.behindProxy` (above) and
`web.requireLogin` (`all`: nothing is read without a login). It also logs every login attempt,
with the caller's address; reads `/etc/rpi-alert.conf` as root on a computer with no boot
partition, through `rpi-alert import-boot-config` (not used here); finds the Wi-Fi device by its
kind rather than its name (not used here: the hotspot is off and nothing joins Wi-Fi); and, where
systemd's tools are installed but systemd is not running (a container), trusts the computer's
clock as it does where there is no systemd at all.

What the move changed here:

- `PIN`: v0.24.0, its addresses and SHA-256; the key is unchanged. The layer's revision is 1:
  `0.24.0+oa1`.
- The enterprise profile: `web.bind` `127.0.0.1` (which it already asked for, and which 0.23.1
  ignored) now takes effect; `web.behindProxy` on and `web.requireLogin` `all` are added. The
  firewall lock stays, as the second guard, and so does the rule "no lock, no agent".
- The standard profile: `web.behindProxy` on; `web.bind` and `web.requireLogin` as RPi ALERT has
  them (named, as "as the agent has it", so that a move back from the enterprise profile opens
  what it closed). Nothing another computer sees changes.
- The profiles hold their closed settings, and the start command puts them back (above).
- `audit` reports the four settings and which of them the profile holds, and notes
  `/etc/rpi-alert.conf` if it is there; `status` gives where the dashboard is and who must log
  in; `status`, `audit` and `sync` name any held setting the file has looser.
- `sync`, `status` and `audit` name the port the agent really opens. A port below 1024 that the
  service has no privilege for (one written into the settings behind the enterprise profile, or
  the agent's own 80 when the port is taken out of the file) is refused to the agent, which
  falls back to 8080; `sync` used to ask for the firewall lock to be moved to the port it could
  not open, and `status` gave that port. `status` now calls it a fault, as `audit` and `sync`
  already did. (This was so before the move too.)
- `selftest` leaves out the tests of RPi ALERT's updater (`update-tag.test.js`) and three tests,
  by name, that read its Raspberry Pi installer's own files (`os/install.sh`,
  `os/files/systemd/rpi-alert-boot-config.service`, `os/libexec/`), which the package does not
  install, as it already left out the tests of the root helper (`priv-net.test.js`). Node.js 18
  and 20 list the three as skipped; 22 and newer leave them out of the count.
- The container: its first settings turn `web.behindProxy` on, as in the package, and leave
  `web.bind` empty (see [The container](#the-container)).
- The checks: every check of 0.23's behaviour was rewritten for 0.24's (the part of the
  listening check that only 0.23 needed is gone), and new ones added for the three settings the
  profiles use, in both profiles. None was made weaker except one, where 0.24's own log forced
  it: the standard profile's check that nothing was said about a web proxy looked for the word
  "proxy" anywhere in the agent's log, and 0.24 says at every start that `web.behindProxy` is
  on, so it now looks for "web proxy", "proxy-preload" and "NODE_USE_ENV_PROXY".
  (`web.hosts` is named by neither profile, and not tried here.)

### A web proxy and a private certificate authority

Name the proxy in `/etc/open-alert-base/env` (`HTTPS_PROXY=…`, `NO_PROXY=…`) and restart the
service. The agent makes its calls with Node.js's built-in `fetch`, which before Node.js 22.21
takes no notice of a proxy, so the start command picks one of two ways:

| Node.js | How the proxy is handed over |
|---|---|
| 22.21 or newer, 24 or newer | `NODE_USE_ENV_PROXY=1`: Node.js reads the proxy settings itself |
| Older (Debian 13's 20, Ubuntu 24.04's 18) | A short start-up file, `proxy-preload.js`, is loaded first. It points `fetch` at the proxy using the `undici` library that Debian and Ubuntu install with their Node.js. It honours `NO_PROXY`, and a user name and password in the proxy's address |
| No proxy set | Nothing is loaded and nothing is added |

A proxy's password is kept out of the log line that names the proxy. Three more rules the
start command and the start-up file keep:

- **A proxy that is set is never gone around.** An address written without `http://` in front
  (`proxy.example.internal:3128`, which curl accepts) is taken as `http://`. An address that
  cannot be used at all — a slip of the keyboard, or a kind of proxy that is not a web proxy,
  such as `socks5://` — does not stop the agent, and does not let it call out directly either:
  on any Node.js the start-up file is loaded and refuses every call that should have gone
  through the proxy (addresses in `NO_PROXY` aside). The agent receives and keeps what it hears,
  and its log says why nothing is sent.
- **The `undici` library is taken from the operating system's folders only.** Node.js looks for
  a library named without a path in the user's home folder first, and the service's home is its
  data folder, which the agent can write. The start-up file takes the home folder off Node's
  list before it looks, so a file planted there by an agent that was once taken over is not run
  at the next start.
- **A proxy that takes a connection and closes it without an answer is not called again and
  again.** (Debian's undici library otherwise opens thousands of connections a second for as
  long as that lasts: a load balancer with nothing behind it, or a wrong port, does it.) After 8
  such connections within 10 seconds, calls are refused for 5 seconds, then 10, 20, 40, and at
  most a minute, and the proxy is tried again after each wait. **Not on Node.js 22.21 or
  newer**: such a Node.js reads the proxy itself, the start-up file is not loaded, and there is
  no guard. Node.js 22.23.4 was measured doing the same (about 9,000 connections a second to a
  proxy that closes them). None of the systems this package is made for ships such a Node.js
  (Debian 13 has 20, Ubuntu 24.04 has 18, the container 20); it applies to one installed from
  elsewhere. Loading the start-up file there instead is not a way out: such a Node.js comes
  without the system's `undici`, and the file would then refuse every call.

A private certificate authority (a network that opens HTTPS traffic for inspection and signs it
again) is added to the operating system the usual way — copy its `.crt` file into
`/usr/local/share/ca-certificates/` and run `sudo update-ca-certificates`. Debian's and Ubuntu's
Node.js then trusts it with nothing more to set.

### The clock

The agent keeps every reading back until it trusts the computer's clock, so that none goes to
Flood-Net with a wrong time; once it does, it sends them with the right times. It trusts the
clock when the operating system says it is set from the network (`timedatectl` prints "System
clock synchronized: yes") or when a GPS receiver gives the time. `rpi-alert status` has a
"Clock" line that says which.

On a Raspberry Pi this matters because most have no battery clock. On an ordinary computer it
matters for another reason: a managed network often blocks the public time servers. Point the
operating system's time service at the organisation's own, as for any other server. For a
clock that is kept right some other way that the operating system does not report (a virtual
machine set by its host, say), `/etc/open-alert-base/env` has a line to switch on,
`RPI_ALERT_ASSUME_CLOCK=1`.

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
2. **The scripts and the build.** shellcheck; the package builds, twice the same, and a third
   time the same with its work folder on a memory disk (`/dev/shm`, another kind of file system)
   and the builder's file mask as tight as it goes (`umask 077`); its contents are what they
   should be and the agent in it is the release's, file for file.
3. **On each system, in clean containers** (`debian:trixie-slim`, `ubuntu:24.04`,
   `debian:bookworm-slim`):
   - *a. Install.* `apt-get install ./the.deb`; files, owners and modes; the agent's own test
     suite as the service's user; the agent started exactly as the service file says (same
     user, groups, environment, capabilities, start command — read from the installed file)
     with RPi ALERT's own stand-ins for a stick and for Flood-Net, as its `simulate.sh` sets
     them up; the dashboard answers and decoded readings reach the stand-in; both profiles, and
     what the dashboard lets in under each — raw requests from the computer itself as the
     `rpi-alert` command, a browser, a reverse proxy's caller (`X-Forwarded-For`, `Forwarded`,
     `Via`), HTTP/1.0 and a web page whose name was pointed at the computer would send them;
     that the settings file (as the agent's user would change it) cannot loosen the profile root
     put in force — "every address", a reverse proxy's callers as the computer's own, looking
     with no password, a settings file taken away, broken or replaced by a link, each put back
     or kept closed by the start command; a web proxy that is the only way to the stand-in, with a private certificate
     authority, with and without a password, on the system's Node.js and on a Node.js 22.21+
     when the test computer has one; the start-up file's three rules — a proxy address that
     cannot be used is not gone around, a look-alike `undici` in the agent's own folder is not
     loaded, a proxy that drops every connection is not hammered — and the whole agent started
     with an unusable proxy address; remove, reinstall, purge; a settings file put there by root
     before and after the install, and a link in its place; an install told which profile to use
     over settings that are already there; the refusal beside RPi ALERT's own install; systemd's
     checker and exposure score; udev's checker on the device rules.
   - *b. The two guards*, tried from a second container that plays another computer: the agent
     alone keeps the dashboard's port shut (it listens on `127.0.0.1` only); then, with the agent
     made to listen on every address (started without the start command, its settings file set
     to "every address"), the port is open until the lock is put on, and shut with it. The
     lock's keeper put back the lock after every table was cleared, after the table was removed
     by name and after its rules were emptied, and stopped with an error when the rules file no
     longer loaded. This container is given the one capability that changing firewall rules
     needs (`NET_ADMIN`).
   - *c. Under a real systemd*, as the container's first program: the package installed and the
     real service started, sandbox and all; the service itself tries what it should not be able
     to do, and asks what it must be able to ask (whether the clock is set from the network);
     both profiles; no lock, no agent — the lock cleared by hand and by the system's own
     `nftables` service started, restarted and stopped (put back each time, the agent running
     on), a slip in the rules file, the rules file missing, no `nft` program, the keeper killed
     (the agent stopped each time, and started again by itself once the lock held); the three
     settings the enterprise profile holds loosened in the file and put back by the real
     service, and loosened through `rpi-alert config set` and put back after `sync`; an update
     over itself; remove, an install again with `OPEN_ALERT_BASE_PROFILE=enterprise`, remove and
     purge. This container is given `SYS_ADMIN` (systemd needs it to build the sandbox) and
     `NET_ADMIN`, and Docker's AppArmor profile is left off it (`apparmor=unconfined`): on a
     computer with AppArmor, such as GitHub's Ubuntu runners, that profile forbids the mounts a
     service's sandbox is made of. It is still not privileged, and Docker's seccomp filter stays
     on. Where systemd will not start in a container the part is skipped and says so
     (`--require-systemd` makes that a failure).

## What has been tested, and where

**19 November 2026, on RPi ALERT 0.24.0 (`0.24.0+oa1`), after the check of the move** (see
[A check of the move](#a-check-of-the-move-19-november-2026)). On the same kind of computer as
below (x86-64, Ubuntu 24.04.5, Docker 29.9, no USB, no KVM, shared with other work), from the
release files already on it, on the files as they are in this folder:

| Check | Result |
|---|---|
| `firmware/test/deb.sh --require-systemd`, all three systems (started 02:21 UTC, 24 minutes) | **1,310 passed, none failed, 2 skipped** — Debian 13 421 and 1 skipped, Ubuntu 24.04 422, Debian 12 420 and 1 skipped, and 47 on the test computer itself. The two skips are the same two as before (the device list Debian 13's systemd keeps out of sight, and Debian 12's udev, which has no checker). The run before the check of the move: 1,280 passed, none failed, the same two skipped |
| The agent's own tests, from the installed package, as the service's user (`selftest`) | 281 tests, 277 passed, none failed, 4 skipped, on each of the three systems: the three left out by name, and one of RPi ALERT's own that needs nginx and skips itself without it. 31 of the 33 test files |
| The package | 2,467,260 bytes, 5,775 kB installed, SHA-256 `a8049af3…`; built three times, the same file each time; lintian: no errors, 6 warnings (the same six as before) |
| `firmware/test/container.sh` (3½ minutes) | **115 passed, none failed, none skipped** (113 before the check of the move). Afterwards no container, network, volume or image of its own was left |
| `firmware/bench/test.sh` on the release's agent (before the check of the move, which changed nothing it runs) | 11 of 11 on Node.js 22.23. On Node.js 18.19 (by hand, for once): 10 of 11 — the quick run took 1 minute 25 seconds there, and the summary's first line, which gives that time, came to 128 characters, over the check's limit of 125. The benchmark's wording, not 0.24.0: noted, not changed |
| shellcheck 0.9.0 on all 24 shell scripts under `firmware/` | Nothing to report |
| `npm test` at the top of the repository | 75 of 75 |
| The disk image, `image/build-image.sh`, built with 0.24.0 | Built in 3 minutes 36 seconds: 3.0 GB, 705 MB of it in use, 269 packages, about 288 MB packed; Debian 13.8, kernel 6.12.117. The package inside it is the same file as the one `deb.sh` checked (SHA-256 `a8049af3…`), its standard profile put in force by its own install |

`test/image.sh` was not run here: it is left to the automatic build, which has KVM and takes
about 4 minutes where this computer takes over 20.

What the new checks showed, on all three systems: in the standard profile the `rpi-alert`
command and a request for `localhost` are the computer itself, while a reverse proxy's caller
(`X-Forwarded-For`, or only `Via`) is a visitor, a web page under a name of its own pointed at
`127.0.0.1` is refused (`unrecognised Host header`), and one under a `.local` name, or from
another site (its `Origin`), is a visitor; a page from `localhost` on another port is still the
computer itself, in both profiles (the limit above); in the enterprise profile the agent listens
on `127.0.0.1` only, the `rpi-alert` command still works without a password, and a reverse
proxy's caller, a request in HTTP/1.0 and one with `Forwarded` get "log in first" for
everything — the status and the readings included — while the page itself is still served;
from a second container, the agent alone keeps the dashboard's port shut, and with the agent
made to listen on every address the lock alone does; the three held settings loosened in the
file are put back by the start command (also with the file taken away, broken, or replaced by a
link), and under a real systemd by the real service; loosened through `rpi-alert config set`
while it runs, `sync` names it, restarts the service, and it is put back; with port 81 written
into the settings behind the enterprise profile, `sync`, `status` and `audit` give 8080, where
the agent falls back, and `status` ends with an error. Before the first whole run on 0.24.0, a
shake-out run found two faults, both in the new checks and not in the package: a long answer
read only in part, and a stand-in stick not set up for one part.

**Everything below was run on RPi ALERT 0.23.1.**

**18 November 2026, after the third check** (see [A check of the result](#a-check-of-the-result-18-november-2026-later)).
A whole run of `firmware/test/deb.sh --require-systemd` on the files as they are in this folder
(started 23:01 UTC, 21 minutes, all three systems, the same computer and release files as in
the run described next, nothing else running on it): **1,034 checks passed, none failed, 2
skipped** — the same two skips. The package is `0.23.1+oa2` (2,433,216 bytes; built three
times, the same file each time). The checks added since: the rules file changed to throw the
dashboard's packets away (`drop`) is a lock as well, under a real systemd, on all three
systems. A run started before it was stopped part way: it had found that the first version of
the keeper's fix let a table whose rules were emptied pass for a lock, which was then put
right (the run's log: one failure, "the dashboard rule did not come back after the table's
rules were emptied"). Docker's AppArmor profile is now left off the systemd container; this
computer has no AppArmor, so that part behaves here as before.

**18 November 2026, after the two reviews.** A whole run of `firmware/test/deb.sh
--require-systemd`, on the files as they are in this folder (started 20:46 UTC, 22 minutes, all
three systems, from the release files already on the computer, on the same kind of computer as
below: x86-64, Ubuntu 24.04.5, Docker 29.9, no USB, no KVM): **1,030 checks passed, 1 failed, 2
skipped.** The one that failed is in RPi ALERT's own test suite, on Ubuntu 24.04: a test that
expects the "light" decoder to be quicker than "lean" on the same recording
(`test/lean-decoder.test.js`, line 91) found it 7 ms slower, while the computer was busy with
another build. Run again alone on Ubuntu 24.04 (`open-alert-base selftest`, twice): the first
time every test passed; the second time that one test failed in the full pass and passed when
the self-test ran it again by itself. It is a timing test of the agent's, and nothing in this
layer touches the decoders. The two skipped checks are the ones in the tables below. The new
checks (the rows marked *new* below) passed on all three systems.

Everything below was run on 11 November 2026 on one computer: a virtual machine with an ordinary
64-bit PC processor (x86-64), Ubuntu 24.04, Docker 29. **It has no USB at all, so no radio stick,
real or passed through, was involved in any of it.** (After the run described next, the
wording of three messages about the dashboard's password was made exact, in the `open-alert-base`
command and the package's README; a run on the files with that wording had not finished when
this was written.) The last whole run of
`firmware/test/deb.sh`, on the files as they are in this folder (started 20:32 UTC, 17 minutes,
all three systems, from the release files already on the computer): **760 checks passed, none
failed, 2 skipped.** Both skipped checks are in the tables below. A whole run before it, at
20:11 UTC, also passed (755 checks, 1 skipped); between the two, one line was written out in
the service file (`PrivateMounts=yes`, a limit it already had by way of the others), the note
about the clock was added, and two checks were added.

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
| The agent's own test suite from the installed files, as the service's user (30 of its 31 test files; the other tests the root helper, which is not installed) | 238 of 238 | 238 of 238 (18 November: 237 — one timing test, see above) | 238 of 238 |
| The agent started as the service file says, with stand-ins for a stick and for Flood-Net: the dashboard answers, decoded readings reach the stand-in | Passed | Passed | Passed |
| Standard profile: port 80 with exactly one capability; the same service without the drop-in file is refused port 80 | Passed | Passed | Passed |
| Enterprise profile: port 8080, no capability at all, checks in with Flood-Net as "report"; `web.bind` survives the agent rewriting its settings | Passed | Passed | Passed |
| A web proxy that is the only way out, with a private certificate authority, `NO_PROXY`, with and without a password — on the system's own Node.js (the start-up file) | Passed | Passed | Passed |
| The same on Node.js 22.23.4 (`NODE_USE_ENV_PROXY`); this Node.js was the test computer's own, not a Debian or Ubuntu package | Passed | Passed | Passed |
| Remove keeps settings and data; reinstall leaves the settings byte for byte; purge deletes everything; refused beside RPi ALERT's own install | Passed | Passed | Passed |
| *New.* The settings file, changed as the agent's user could change it, cannot loosen the profile: "every address" or a port below 1024 under the enterprise profile keeps the lock and gives no capability, `sync` ends with status 4, `status` and `audit` call it a fault; more care ("this computer only" under the standard profile) is taken; only `profile standard` takes the lock off | Passed | Passed | Passed |
| *New.* The start-up file's rules: a `socks5://` address and one with a slip in it refuse the call and nothing reaches the far end directly (`NO_PROXY` still honoured); an address without `http://` is used; a look-alike `undici` in the agent's home folder, which a plain Node.js there does load, is not loaded; a proxy that closes every connection gets 8 connections from twelve calls, none after, and is asked again after the wait; the whole agent with an unusable address runs and says why it sends nothing | Passed (undici 7.3) | Passed (undici 5.26) | Passed (undici 5.15) |
| *New.* A settings file put there by root before the install, and after it: handed to the agent's user (0600), its contents kept, no profile put over it; a link in its place is not followed (`/etc/passwd` keeps its owner and mode) and `sync` and `profile` stop | Passed | Passed | Passed |
| *New.* `OPEN_ALERT_BASE_PROFILE` on an install over settings that are already there: applied and said, the token and the name kept; once more with the same profile in force: the settings file not touched | Passed | Passed | Passed |
| systemd's checker (`systemd-analyze verify`) on both service files | Nothing to report | Nothing to report | Nothing to report |
| Exposure score of the service (`systemd-analyze security`), enterprise profile then standard: worked out from the file alone, and for the running service | 1.7, 1.9 both ways | 1.7, 1.9 both ways | 1.7, 1.9 both ways |
| *New.* Exposure score of the lock's service, which now stays running as root with one capability | 2.0 | 2.0 | 2.1 |
| udev's own checker (`udevadm verify`) on the device rules — read, not tried on a device: a container has no udev running | Nothing to report | Nothing to report | Skipped: this older udev has no checker |
| The firewall lock, tried from a second container: the dashboard's port open before, refused with the lock on, another user's port left alone, open again when the table is removed | Passed | Passed | Passed |
| *New.* The lock's keeper, started as its service starts it: every table cleared, the table removed by name, its rules emptied — put back each time (about half a second after `nft flush ruleset`, as measured there); with a slip in the rules file it stops with an error and says so | Passed | Passed | Passed |
| *New.* No lock, no agent, under a real systemd: the agent tied to the lock (`BindsTo`); every table cleared by hand, and Debian's or Ubuntu's own `nftables` service started, restarted and stopped — the lock back each time and the agent running on, the same process; a slip in the rules file, the rules file missing, no `nft` program, the keeper killed — the agent stopped, not startable by hand, `sync` status 3, `audit` says the keeper is not running; once put right, the lock and then the agent back by themselves within a minute; removed, then installed again with `OPEN_ALERT_BASE_PROFILE=enterprise`: the agent running behind the lock | Passed | Passed | Passed |
| Under a real systemd in a container: the install starts the service; port 80 by the drop-in file; the service itself is refused writing in `/usr`, `/etc` and `/var`, can write its two folders, has its own `/tmp`, cannot read the proxy file; the agent arms systemd's watchdog; killed, it is restarted; the enterprise profile loads the firewall lock; an update over itself; remove and purge | Passed | Passed | Passed |
| From inside the running service, the question the agent asks before it trusts the clock (`timedatectl`) gets an answer | Passed (the answer was "no": a container's clock is not set from the network) | Passed, the same | Passed, the same |
| The kernel's device list for the running service | Skipped: this systemd keeps it where it cannot be listed | Listed: the standard pseudo-devices only. USB was not on it, because the test computer's kernel has no USB | As Ubuntu |

Also, on the test computer itself:

| What | Result |
|---|---|
| The release check accepts the real v0.23.1 and refuses the 14 bad cases listed under Testing | Passed |
| By hand, not part of `deb.sh`: the release check downloads the release from GitHub and accepts it (20:29 UTC) | Passed |
| By hand: the release check in a clean Debian 13 container with OpenSSL alone (3.5.7), then with Node.js alone (20.19.2): the real release accepted, a changed tarball with a pin to match refused; with neither tool it stops and says so (status 3) | Passed |
| shellcheck 0.9.0 on the 11 shell scripts here | Nothing to report. 18 November: the 12 that `deb.sh` checks (the lock's keeper is the new one); and, by hand, all 21 shell scripts under `firmware/` and the 37 `run:` blocks of the workflow file: nothing to report |
| The package builds; a second build is the same file | Passed: 2,423,076 bytes (2.4 MB), 5.9 MB installed, with the benchmark in it as `bench/` had it at 20:32 UTC (the size moves by a little when that file changes). 18 November: 2,432,364 bytes, 5,614 kB installed (now counted from the files' lengths); a third build on a memory disk with `umask 077` is the same file too, and the package the disk image's build made from the same files that day was the same file as well. After the third check (`0.23.1+oa2`): 2,433,216 bytes, 5,615 kB installed, three builds and the disk image's the same file |
| lintian, Debian's package checker | No errors; 7 warnings, none acted on (no manual pages; the 0640 mode of `env`; a `systemctl` call in the install script; two files with a script line but no run permission, one of them the release's own; a udev rule without desktop-catalogue data). 18 November: 6 warnings, the same less the one about `systemctl` |
| *New.* The benchmark's quick test (`bench/test.sh`), and the repository's own tests (`npm test` at its top) | 18 November: 11 of 11, and 75 of 75; again after the third check, the same |

## What has not been tested

*Added 14 November 2026: the disk image's start test has since tried four of the points below
in a virtual machine — with pretend devices, not real ones. Each such point says so; the
results are under [The disk image](#the-disk-image-what-has-been-tested-where).*

- **A real radio stick on a computer that is not a Raspberry Pi.** Not natively, not in a
  container. The udev rule, the driver block list and the service's device list
  (`DeviceAllow=char-usb_device`) have never met a real stick: the test computer's kernel has no
  USB, so systemd had no USB device class to put on the list. This is the first thing to try on
  real hardware. *Since then, in the image's virtual machine: all three met a pretend stick (a
  software USB device with a real stick's ids) and did their part. Still no real stick.*
- **The device rules on a real udev.** udev's checker read them without a complaint on Debian
  13 and Ubuntu 24.04; no udev has applied them to a device. *Since then: Debian 13's udev
  applied the stick's rule to the pretend stick.*
- **Serial receivers** (a Quansheng radio, an ERT-A2, a GPS) under the service's device list.
  *Since then: an emulated USB serial adapter, fed a Quansheng radio's lines, was read by the
  sandboxed agent. Still no real receiver.*
- **The clock on a real computer.** The service can ask systemd whether the clock is set from
  the network, and in these containers the answer was "no", so the stand-in runs are told to
  trust the clock (`RPI_ALERT_ASSUME_CLOCK=1`, as RPi ALERT's own `simulate.sh` does). The
  agent going from "not trusted" to "trusted" on a computer whose time service has just
  answered has not been watched under this service.
- **Any ARM computer.** The package holds no compiled code, so there is no reason to expect a
  difference, but it has not been run on one. *Since then (19 November 2026): the automatic
  build ran these checks on GitHub's ARM computers, the part under a real systemd included, and
  none failed (RPi ALERT 0.23.1; see [the first run](#the-first-run-on-github-19-november-2026)).
  Still not on an ARM computer outside GitHub's, and not with a stick.*
- **A real computer start-up.** The systemd checks ran in containers. Nothing has been
  restarted to see the service, the firewall lock and the two serial drivers come up by
  themselves, and the firewall lock has not been tried beside another firewall (`ufw`,
  `firewalld`, a `flush ruleset` in `/etc/nftables.conf`). *Since then: the image's virtual
  machine was restarted and all three came up by themselves, the lock beside the image's own
  firewall table. And (18 November) under systemd in a container, Debian's own `nftables`
  service, whose file begins with `flush ruleset`, was started, restarted and stopped after the
  lock was on: the keeper put the lock back each time. Still not on a real computer, and not
  beside `ufw` or `firewalld`.*
- **A real web proxy and a real inspecting network.** The proxy in the test is a few lines
  written for it; it tunnels and can ask for a password, and does nothing else a commercial
  proxy does (no NTLM or Kerberos sign-in, for one — the start-up file cannot do those). The
  guard against a proxy that closes every connection was tried with a stand-in that does just
  that; on Node.js 22.21 or newer there is no guard (see the proxy section).
- **IPv6.** The firewall lock's rules are written for IPv4 and IPv6 alike (one `inet` table),
  but the test computer's kernel has no IPv6, so only IPv4 was tried.
- **A built-in serial port opened for the agent** with the `DeviceAllow` line the service file
  gives. Written, not tried.
- **An update from an older version of this package.** There is no older version. The same
  package installed over itself is tested.
- **Flood-Net itself.** The stand-in is RPi ALERT's own test helper.
- **A reverse proxy in front of the dashboard.** RPi ALERT 0.24's `web.behindProxy` and
  `web.requireLogin` were tried here with requests made to look like a proxy's, not with a real
  nginx, Caddy or HAProxy; RPi ALERT's own tests and `docs/configuration.md` cover those three.
  Nor has `web.hosts` been tried with a real DNS name.
- **The checks themselves on another kind of test computer.** `firmware/test/deb.sh` had only
  been run on the one computer described above. Its real-systemd part depends on how the test
  computer keeps its groups of processes (cgroups); on a computer where systemd will not start
  in a container it skips that part and says so, and that path has not been seen. *Since then
  (19 November 2026): GitHub's x86-64 and ARM computers ran it, and the part under a real
  systemd started on both.*

## Choices made here

Where the design left something open, this is what was chosen and why.

- **The capability follows the port, within what the profile in force allows.** `profile` and
  `sync` look at `web.port`: below 1024, and the profile itself on a low port, the drop-in file
  is written; otherwise it is removed. A person who moves the standard profile to port 8080
  loses the capability too. Under the enterprise profile no setting brings it back.
- **Root decides from root's own record.** What the lock and the capability follow is the
  profile named in `/etc/open-alert-base/profile`, never the agent's settings file alone (the
  agent's user can write that). Where no profile is recorded at all (an install over a settings
  file that was already there), the settings file decides, as before, and `sync` says so.
- **The firewall lock is one table of its own**, loaded by a small service of its own that
  stays running as root with one capability (`CAP_NET_ADMIN`) to keep the table in place,
  rather than a line in the computer's `/etc/nftables.conf`, which is the organisation's file.
  It watches the kernel's own reports of firewall changes (`nft monitor`), and looks at the
  table every 20 seconds as well. An organisation that loads its own firewall can also put the
  line `include "/etc/open-alert-base/dashboard-local-only.nft"` in its file, which leaves no
  gap at all.
- **The enterprise profile closes the dashboard with RPi ALERT's own settings** (`web.bind`,
  `web.behindProxy`, `web.requireLogin`, from 0.24), and keeps the firewall lock beside them as
  the second guard, with "no lock, no agent" as before. In the standard profile `web.bind` and
  `web.requireLogin` are written as "as the agent has it", so that a move back from the
  enterprise profile opens what it closed; `web.hosts` is named by neither profile, since it is
  a name only your network knows.
- **A profile holds its closed settings; the start command puts them back.** The settings file
  is the agent's user's, so root cannot stop it being changed; what root does decide is what the
  agent starts with. Putting the settings back (and saying so) was chosen over refusing to start
  the agent: a flood-warning receiver that keeps receiving with the profile's settings is better
  than one that stops because a setting was edited. Where they cannot be put back at all, the
  agent is not started.
- **Profiles are applied as the agent's user, through the agent's own settings code**, never by
  root editing the file: the settings folder belongs to that user, and root following a link
  there would be a way up.
- **The start profile can be named at install** (`OPEN_ALERT_BASE_PROFILE=enterprise`, or a
  file `/etc/open-alert-base/profile` put there beforehand), so a disk image or a container can
  be locked down from its first start. The variable is honoured over settings that are already
  there as well, so that nobody believes a computer is locked down when it is not.
- **The udev rule gives the sticks to the group `plugdev` only** (mode 0660; RPi ALERT's own
  rule lets everybody read them, 0664).
- **The two USB serial drivers are loaded at start-up, and by the install.** systemd works out
  the service's device list from the drivers loaded when the service starts; without this a
  serial receiver plugged in for the first time later would be refused until a restart. On a
  kernel built without them systemd reports that it could not load them; the file says how to
  silence that. The install tries them once and passes over a kernel that has none.
- **If the firewall lock cannot be loaded, the agent does not run** (no lock, no agent; above).
  This was the other way round until the security review of 18 November 2026: the agent ran on
  and `audit` said in capitals that the dashboard was not kept to the computer. The review
  showed how easily the lock went missing without anybody being told — a slip in the port line
  the rules file invites people to edit, or Debian's own `nftables` service started after the
  profile — and that the dashboard's status page was then open to the network.
- **The clock rule is left as the agent has it.** Readings wait until the operating system says
  the clock is set from the network; the package does not switch that off, and
  `/etc/open-alert-base/env` says how to, for a computer whose clock is kept right another way.
- **Purge deletes the agent's user**, with its settings and data, unless RPi ALERT's own install
  has appeared on the computer since — then all three are left alone.
- **`selftest` leaves out what tests parts of RPi ALERT that are not installed here**: its root
  helper (`priv-net.test.js`), its updater (`update-tag.test.js`), and three tests, by name, that
  read its Raspberry Pi installer's own files (in `config.test.js` and `root-files.test.js`).
  Of 0.24.0's 33 test files, 31 are run: 29 whole, and those two less the three tests.
- **The benchmark is built into the package when `bench/open-alert-bench.js` is there** and
  parses; `--no-bench` leaves it out.

## The container

**Tested on 13 November 2026 on one x86-64 computer (Ubuntu 24.04, Docker 29, Docker Compose 5),
with stand-ins for the radio stick and for Flood-Net. No real stick, no ARM computer, no
Torizon, no second person's review. See [what is not yet proved](#the-container-what-is-not-yet-proved).**

A *container* is a program run inside a box of its own: it sees only the files, devices and
network it is given. The same agent as the package, from the same checked release, in a box that
can do very little. Use it for Toradex's Torizon OS, or for any computer that already runs
containers (Docker, or Podman with a compose file).

### What is in `container/`

| File | What it is |
|---|---|
| `Dockerfile` | The recipe. Step one fetches the pinned release and checks it, with the same `lib/fetch-agent.sh` the package uses; the finished image holds only the unpacked agent. A failed check stops the build |
| `build.sh` | Builds it (`--platform linux/arm64`, `--tag`, `--push`, `--base-image`, `--release-dir`) |
| `compose.yaml` | The hardened way to run it on an ordinary container computer |
| `compose.torizon.yaml` | The same for Toradex Torizon OS, with the steps to load it |
| `host-setup.sh` | What the *computer* needs once: the device rule for the stick, and the block on the TV driver. `--remove` takes both away, `--check` only looks |
| `config.default.json`, `healthcheck.js` | The settings a new container starts with; the check Docker runs to ask "is the dashboard answering?" |

### What the image is

- Debian 13 (`debian:trixie-slim`) with the system's own Node.js 20, `rtl-sdr` (the program that
  reads a stick), `ca-certificates` and `node-undici` (what the web-proxy start-up file needs on
  Node.js 20). 269 MB on disk, about 67 MB to download. It builds for `linux/amd64` and
  `linux/arm64` from the same file; only the amd64 one has been built.
- The agent is the release's, file for file (the check compares every file), in the same folder
  as the package puts it. The agent's own tests are **not** in the image (the package carries
  them so a buyer can run them; an image has no use for them).
- It runs as the ordinary user number 990, never root. There is no compiler, `git`, `curl`,
  `sudo` or package list in it, and no file that can switch to another user (the few that could,
  `su` and `mount`, have that ability taken off). `RPI_ALERT_PRIV` points at nothing, so the agent
  can ask root for nothing, and `RPI_ALERT_ASSUME_CLOCK=1`: inside a box the agent cannot ask the
  computer whether its clock has been set from the network, so it trusts the clock, and **the
  computer must keep correct time**. (RPi ALERT 0.24 sees for itself that systemd is not running
  in the box and trusts the clock the same way; the variable says so outright.)
- The settings (`/etc/rpi-alert`) and what the agent has heard and not yet sent
  (`/var/lib/rpi-alert`) are two volumes, which are folders that outlive the container. A new
  settings volume starts with `config.default.json`: dashboard on port 8080; the Wi-Fi hotspot,
  self-recovery, the screen and the sound off (none of them can work in a box); remote management
  on `report` (Flood-Net is told how the station is, and can change nothing). RPi ALERT's updater
  does not apply here: **an update is a new image** built from the next signed release.
- Two of RPi ALERT 0.24's dashboard settings, on purpose. `web.bind` stays empty (every address
  in the box), as RPi ALERT has it: Docker brings the published port in on the box's own network
  address, not on its `127.0.0.1`, so an agent kept to `127.0.0.1` could not be reached from the
  computer at all — the published port (`127.0.0.1:8080` on the computer) is what keeps the
  dashboard to the computer. `web.behindProxy` is on, as in the native package. With Docker every
  caller from outside, the computer's own browser included, comes in from Docker's network,
  never from the box's own `127.0.0.1`, so none is taken for the box itself, with the setting on
  or off (checked: the computer's request through the published port is a visitor, and asking
  for `localhost` by name changes nothing). That rests on how Docker brings the port in, and was
  checked with Docker only. Another engine (rootless Podman, say, which has not been tried) or
  the computer's own network (`network_mode: host`, which neither compose file uses and the
  check refuses) may bring the computer's own callers in on the box's `127.0.0.1`; then the
  setting is what keeps a web page in the computer's browser from being taken for the box
  itself. It costs one line in the log at each start. The box's own callers — the health check,
  and `rpi-alert` run with `docker exec` — are still the box itself (checked), and a page from
  another site, sent to the box's `127.0.0.1` from inside, is a visitor (checked).
- Labels a registry shows (title, description, source, licence, version, revision, created, base
  image), and a health check on the dashboard.

### Building it

```
firmware/container/build.sh                     # for this computer; the release is downloaded and checked
firmware/container/build.sh --platform linux/arm64 --tag registry.example.org/open-alert-base:0.24.0-oa1 --push
```

The base image can be fixed to one exact version: `docker buildx imagetools inspect
debian:trixie-slim` prints its *digest* (a fingerprint, `sha256:…`); pass
`--base-image debian:trixie-slim@sha256:<that>`. The image's labels then say exactly which base
it was built on (`org.opencontainers.image.base.digest`, beside `.base.name`); built on a name
alone, they cannot. Do it again, and run `firmware/test/container.sh`, when you want Debian's
newer fixes. The automatic build does this for every container it publishes: it looks the
digest up once per release, builds both kinds of processor on it, and names it in the release
notes. (The digest is looked up at release time rather than kept in the repository beside
`PIN`: either way a reviewer can tell afterwards which base a container has, and this way each
release carries Debian's fixes of that day.) With no network, hand the build the two release
files with `--release-dir`: they are checked just the same.

### Running it: `compose.yaml`

1. Build the image (above). 2. Once, on the computer: `sudo firmware/container/host-setup.sh` —
it gives the stick's device file to the group `plugdev` and keeps the kernel's TV driver off the
stick, and prints the group's number (put it in a file `.env` beside `compose.yaml` as
`OA_USB_GID=<number>` if it is not 46). Unplug and replug the stick. 3. `docker compose -f
firmware/container/compose.yaml up -d`, then open `http://127.0.0.1:8080/` **on that computer**.

What the file takes away, and what the checks show it does:

| In `compose.yaml` | Meaning |
|---|---|
| `cap_drop: [ALL]` | The process has none of the special powers Linux splits root into (set the clock, change the network, load drivers…) |
| `no-new-privileges` | Nothing it starts can gain a power it did not have |
| `read_only: true`, `/tmp` in memory with no running of programs | The container's own files cannot be changed; it writes only its two volumes and `/tmp` |
| Not `privileged`, no host network, no host folders except `/dev/bus/usb` read-only | A box of its own, with one door to the radio |
| `device_cgroup_rules: c 189:* rmw` and `group_add` | The stick: the box may open USB device files (class 189) and nothing else on the computer. Instead of `--privileged` |
| `ports: 127.0.0.1:8080:8080` | The dashboard is reachable from the computer itself only. To let a local network in, change the left side, and set a dashboard password first |
| `restart: unless-stopped`, 10 MB × 3 log files, 768 MB of memory, 200 processes, a fixed `hostname` | Comes back after a crash or a restart; cannot fill the disk with logs; cannot take all the memory |
| `HTTPS_PROXY`, `NO_PROXY`, `NODE_EXTRA_CA_CERTS` (commented) | A web proxy and a private certificate authority: put them in `.env` / take the `#` off, as written in the file |
| Serial receivers (`c 188`, `c 166`, `devices:`) | Written as comments for people who have a Quansheng radio, an ERT-A2 or a GPS: not on by default |

The agent's own command line is `docker exec open-alert-base rpi-alert status` (and `setup`,
`token`, `help`).

### On Torizon: `compose.torizon.yaml`

The file and the steps are at the top of the file itself. What differs: the image comes from a
registry (build and push it with `build.sh --platform linux/arm64 --push`), because the board is
not the place to build; there may be no `plugdev` group, so `host-setup.sh --gid 990` makes one
with the number the file expects; and the dashboard is reached through an SSH tunnel, since a
board has no screen and the port is, as above, published to the board only. **None of that is
tried: only what the file shares with `compose.yaml` has run, on Debian.**

### How it is checked: `firmware/test/container.sh`

```
firmware/test/container.sh --tarball <release file> --sig <its signature>   # about 3 minutes
```

It builds the image from the release files given (no download), runs the real `compose.yaml` with
the stand-ins (the agent's own test stand-ins for `rtl_sdr` and for Flood-Net, mounted in for the
test only; the image does not carry them), and checks the rest. Nothing is privileged; nothing
uses this computer's network.

### The container: what has been tested, where

On the computer named at the top of this section. **98 passed, none failed, none skipped**
(13 November 2026, 20:34 UTC; shellcheck clean on the three scripts). Again on 18 November
2026, on the files after the two reviews (started 20:37 UTC, about 3½ minutes, on the same kind
of computer: Ubuntu 24.04, Docker 29.9, Compose 5.6): **108 passed, none failed, none
skipped** — ten more than then, among them the proxy rules in the last row below. And once
more on the files as they are in this folder, after the third check (started 23:23 UTC, 3
minutes 20 seconds): **108 passed, none failed, none skipped**. And on RPi ALERT 0.24.0, after
the check of the move (19 November, started 02:45 UTC, 3 minutes 19 seconds): **115 passed, none
failed, none skipped**. These last three runs built the image on
`debian:trixie-slim` by name, so their check of the digest label only noted that none was
given; a run on an image built with `--base-image` and a digest, as the automatic build makes
the published one, is described under the table.

| What | Result |
|---|---|
| The release check inside the build: a changed tarball stops the build with the check's own message | Passed |
| The build prints no warning from Docker's own checks of the recipe | Passed |
| The labels, the user (990), the two volumes, the health check, no root helper, the clock setting | Passed |
| No compiler, `git`, `curl`, `wget`, `sudo`; no package lists; no set-user-id file; no `test`, `scripts` or `os` folder from the release | Passed |
| The agent in the image is the release's, file for file; its files cannot be written by its own user | Passed |
| Both compose files are read by Docker Compose and every hardening line above is in them (each checked by reading the resolved file); the Torizon file refuses to start with no image named | Passed |
| `host-setup.sh` in a scratch folder: written, repeated (nothing rewritten), checked, removed, repeated; another group name; bad option and bad name refused; without the administrator account it says so and changes nothing; its rule and block list are the package's, line for line | Passed |
| `compose.yaml` run: the dashboard through the published port (and not on the computer's other address); the pinned version (0.23.1 until 19 November, then 0.24.0); the agent finds the stand-in stick; decoded readings reach the Flood-Net stand-in | Passed |
| *New, 19 November (0.24.0).* Who the agent takes for the box itself: the computer's request through the published port is a visitor (`"local":false`), and asking for `localhost` by name still gets "log in first" for the settings; inside, the agent listens on every address of the box, with `web.bind` empty and `web.behindProxy` on; the box's own request to `127.0.0.1`, and `rpi-alert` run with `docker exec`, are the box itself, and a request on the box's `127.0.0.1` from another site's page is a visitor | Passed |
| The agent's process: user 990; every capability set zero; no-new-privileges on; the system-call filter on; only port 8080 open by the agent | Passed |
| Read-only root (writes to `/usr`, `/etc`, the agent's folder and `/var` refused; `/tmp`, settings and data writable); `/tmp` cannot run programs; no helper behind `RPI_ALERT_PRIV` | Passed |
| Docker's health check says healthy; `rpi-alert status` works inside | Passed |
| `compose stop`: ends in under 15 seconds with the signal's status; the data is kept; start again answers; the agent killed inside is brought back by the restart policy | Passed |
| **The USB device rule**, tried with a device file of the USB class made for the purpose (this computer has no USB): without the rule, Docker refuses the open; with the rule but not the group, the file's own permission refuses; with the compose file's two lines the open reaches the kernel (which has no USB driver here, so it answers "no such device"); a read-only `/dev/bus/usb` does not stop that; a disk device is refused even with the rule | Passed |
| The web proxy, with a private certificate authority: with no proxy set nothing reaches Flood-Net's stand-in; through a proxy the readings arrive, over HTTPS, under a name only the proxy can find; with and without a name and password (the password is not in the log); `NO_PROXY` is honoured (a station-list address is fetched without the proxy) | Passed |
| The start-up file's rules, in the image itself, with no network: a `socks5://` proxy address refuses the call and nothing reaches the far end directly (an address in `NO_PROXY` still goes direct); a look-alike `undici` in the data folder, which a plain `node` there does load, is not loaded; twelve calls through a proxy that closes every connection make 8 connections, none after the calls end, and the proxy is asked again once the wait is over; the whole container started with a `socks5://` address runs, shows its dashboard and says why nothing is sent | Passed |

Numbers, measured there (a stand-in stick, so not what a real station will use):

| | |
|---|---|
| Image size | 269 MB on disk, about 67 MB compressed. 15 s to build with Debian's packages already downloaded |
| The agent with **no stick** | 74 MB of memory (the whole container 23 MB as Docker counts it) |
| The agent with **one stick**, four channels (the agent's defaults), the stand-in sending a burst every few seconds | 300 to 340 MB a minute after it started, 430 to 470 MB a few minutes later, then about level over a further 8 minutes (watched once, on the same computer). Docker's memory limit in `compose.yaml` is 768 MB for that reason. The stand-in `rtl_sdr` is a Node.js program and takes about 100 MB on top, which the real one is expected not to |

### The container: what is not yet proved

- **A real USB stick through the device rule.** The rule was tried on a made-up device file. A
  real stick, the real `rtl_sdr` opening it, and the stick keeping working for days: not tried.
  This is the first thing to try on real hardware.
- **Unplug and replug.** The read-only `/dev/bus/usb` folder is expected to show a stick plugged
  in later, and the agent to find it again; neither has been seen.
- **The host-setup rule on a real udev**, and the TV driver block against a real stick, on
  Debian, Ubuntu or Torizon. The rule is the package's, which udev's checker read without a
  complaint; no udev applied it to a device.
- **Serial receivers** (Quansheng, ERT-A2, GPS) in a container.
- **Torizon itself.** `compose.torizon.yaml` has never been loaded on a Torizon board; its
  statements about Torizon (no `plugdev` group, how compose is run, the memory) are expectations.
- **ARM.** The recipe has no compiled code of its own. The automatic build's first run (19
  November 2026) built the image and ran `test/container.sh` on GitHub's ARM computers as well
  as its PCs; one check failed on both, for a reason in the check, since put right (see
  [the first run](#the-first-run-on-github-19-november-2026)). Not on an ARM board of anybody's
  own.
- **Podman.** The compose file is written for Docker; it has not been tried with Podman.
- **A real web proxy and inspecting network**, as for the package.
- **The clock.** The image trusts the computer's clock. The computer's own time service is not
  part of it.
- **A long run.** Memory was watched for eight minutes. Days of running, a full disk, a network
  that comes and goes: not tried.
- **Docker's own limits on a real board**, for example whether the board's kernel supports the
  memory limit and the device rule.

### Choices made here

- **User number 990**, not a name only: the number is what the settings volume's files carry, and
  a computer's own user list does not matter inside the box.
- **Settings and data are volumes** whose first contents come from the image, rather than a
  start-up script that writes a settings file: no shell program runs before the agent.
- **The proxy start-up file is always loaded**; it does nothing unless `HTTPS_PROXY` is set. It is
  the package's own file, copied in the build.
- **No `curl` in the image.** The agent uses it for one optional "is Flood-Net answering" check
  and carries on without it.
- **The memory limit is 768 MB**, from the measurement above, so that the agent's own growth is not cut off.
- **The test mounts the agent's own test stand-ins in** and leaves them out of the image.

## The disk image

**Built and started on 14 November 2026, and again on 18 November after the two reviews, on one
x86-64 computer (Ubuntu 24.04, QEMU 8.2.2), in a virtual machine only; on 19 November the
automatic build built the PC image on GitHub's computers and its whole start test passed there,
with Secure Boot on, under KVM. It has never been written to a real disk or started a real
computer, and no real radio stick has been near it. The image for ARM computers has been built
(on GitHub, 19 November) and has not yet started. Not reviewed by a second person. See
[what is not yet proved](#the-disk-image-what-is-not-yet-proved).**

A *disk image* is one file that holds a whole disk, byte for byte. Written to an SSD or a USB
stick ("flashed"), it makes that disk start a computer as a base station and nothing else: what
RPi ALERT's SD-card image is for a Raspberry Pi, for an ordinary 64-bit PC. It is for a computer
bought to be a base station. A computer that already runs Debian or Ubuntu takes the package
instead, and one that runs containers takes the container.

### What is in `image/`

| File | What it is |
|---|---|
| `build-image.sh` | The build: one shell script, read from top to bottom, in nine numbered steps |
| `packages.common`, `packages.amd64`, `packages.arm64` | Every Debian package the image asks for by name, each with its reason |
| `packages.firmware.amd64` | Three more, from the part of Debian's archive that holds hardware makers' own files: fixes for Intel and AMD processors, and what some Realtek network ports need. `--no-firmware` leaves them out |
| `files/` | Twenty small files copied into the image as they are. They are everything that makes it differ from a stock Debian; each says at its top what it is for |
| `cidata/` | The first set-up files a person edits after flashing: `user-data`, `meta-data`, `README.txt` |
| `sbom.sh` | Writes a *software bill of materials*: the list of everything inside a build, with versions, in a standard form (SPDX 2.3) that security scanners read |

### What the disk image holds

- **Debian 13 ("trixie"), from Debian's own archive.** Debian's tool for installing Debian into
  a folder (`mmdebstrap`) does it; `apt` downloads the packages and checks Debian's signature
  on every one. The base is Debian's smallest, plus the packages named in the lists and what
  those cannot work without; nothing that is only "recommended". 269 packages in all, 705 MB.
  The build downloads from two places and no others: Debian's archive, and the pinned RPi ALERT
  release (checked as described under [the pin](#the-pin-which-release-is-shipped-and-how-it-is-checked)).
- **Debian's signed boot files, unchanged.** With *UEFI Secure Boot* switched on, a PC starts
  only programs signed by a key it trusts. The chain here is the one every Debian PC uses: the
  PC trusts Microsoft's key; Microsoft has signed Debian's first program (called *shim*); shim
  trusts Debian's key; Debian has signed the boot menu (GRUB) and the kernel. All four are
  copied from Debian's packages as they are, so the image starts with Secure Boot **on**.
- **The `open-alert-base` package**, the file `deb/build-deb.sh` makes, installed with its
  standard profile. Everything on this page about the package holds for the image: the same
  service, the same sandbox, the same two commands.
- **No account and no password.** The administrator account (root) is locked and no other
  account exists until the first set-up file names one. SSH takes keys only.
- **Nothing that is one computer's own.** The computer's identifier, its SSH host keys and the
  dashboard's first password are each made by the computer itself at its first start.

The disk has three partitions:

| | Size | What |
|---|---|---|
| 1 | 256 MB | The EFI system partition: the boot files, where the PC's firmware looks for them |
| 2 | 32 MB | `CIDATA`: the first set-up files. Plain FAT, so that any computer can open it |
| 3 | The rest | Debian and the base station. It grows to fill the disk at the first start |

How the image differs from a stock Debian — the twenty files in `files/`, and a few lines of
the build script (its step 5):

| What | How it is set |
|---|---|
| SSH | Keys only: no password is accepted for any account, and root cannot log in at all |
| Firewall (nftables) | What may come in from other computers: SSH, the standard profile's dashboard (port 80), ping, and the network's own answers. Everything else is thrown away — port 8080 too, the enterprise profile's port, so that the image's own firewall keeps that dashboard to the computer as well, beside the profile's lock. It is one table of its own |
| Network | Every wired port asks the network for an address (DHCP). Wi-Fi is not set up. The two kinds of name look-up that listen to the local network (LLMNR, multicast DNS) are off |
| Time | Debian's own time service (`systemd-timesyncd`) is on. The agent sends nothing until the clock is set: see [The clock](#the-clock) |
| Security updates | Debian's `unattended-upgrades` is on: it looks every day and installs Debian's security updates. An update never stops to ask a question |
| First set-up | Read by `cloud-init` from the `CIDATA` partition of this disk and from nowhere else: no network address is ever asked for set-up, and no other disk is looked at. cloud-init's own search for a disk labelled `CIDATA` is switched off (it would try a USB stick first); a small service of the image's own (`open-alert-image-own-cidata.service`) runs before it at every start and copies the two files, read-only, from the second partition of the disk that holds the main partition — found through that disk, not by a label or an identifier another disk could carry too |
| Start-up | The boot menu shows for three seconds; start-up messages go to the screen and to the first serial port (115200 baud), and both give a login prompt. No "recovery" entries (they would ask for root's password, and root has none). The menu is **closed**: its editor (`e`) and GRUB's command line (`c`) ask for a name and a password and take none, because the menu has an owner who has no password; every entry that starts Linux is marked to start by itself all the same (`--unrestricted`). A kernel or GRUB update keeps it so (`files/etc/grub.d/09_open-alert-image`, checked) |
| Which disk it starts from | **This one, and no other, even when another disk carries the same identifiers.** Every disk made from the image carries the same identifier for its main partition, so a USB stick made from it is, to Debian's usual way of finding the main partition, the same disk. Three things here keep to the disk the computer started from. (1) The small `grub.cfg` beside GRUB on the EFI partition (`files/usr/lib/open-alert-image/efi-grub.cfg`) sends GRUB to partition 3 *of the disk GRUB itself was started from*, where Debian's version takes the first disk carrying the identifier; a GRUB or shim update writes Debian's version again, and the image puts its own back at once (`open-alert-image-boot-stub.path` watches the file; the menu maker does it too). (2) The menu's entries load Linux from that same partition; none looks for an identifier. (3) Linux itself is told the main partition by its identifier (`root=UUID=…`), and the start-up file system (*initramfs*) refuses to go on while two disks carry it — just before the main partition is mounted and again just after — and restarts the computer 30 seconds later (`files/etc/initramfs-tools/scripts/`); and when a USB disk and one that is not carry the same identifier, the names that stand for it (`/dev/disk/by-uuid/…` and the like, which is what the start-up file system checks and mounts) point to the one that is not (`files/etc/udev/rules.d/`). `panic=30` on the kernel's start-up line makes every failed start a restart: without it, the start-up file system would offer a prompt as administrator to anybody at the screen or the serial port. Checked: part 12 of the test |
| Boot files | Kept in the two places Debian keeps them, so Debian's own updates of shim and GRUB go on working (checked) |

### Building the disk image

```
sudo firmware/image/build-image.sh                         # for the kind of computer it is run on
sudo firmware/image/build-image.sh --tarball F --sig S     # the release's two files already here
sudo firmware/image/build-image.sh --help
```

It needs the administrator account, because it makes file systems and installs Debian into a
folder, and these tools: `mmdebstrap`, `debian-archive-keyring`, `fdisk`, `dosfstools`,
`mtools`, `e2fsprogs`, `xz-utils`, `jq`, and what `build-deb.sh` needs. It uses one loop device
and mounts one file system, the image's main partition. It does not use a container, and never
a privileged one.

The results, in `dist/`:

| File | What |
|---|---|
| `open-alert-base-0.24.0+oa1-amd64-uefi.img` | The disk, 3.0 GB (it fits any disk of 4 GB or more) |
| `…-uefi.img.xz` and `…-uefi.img.xz.sha256` | The same packed for download, about 290 MB, and its SHA-256 |
| `…-uefi.packages.tsv` | Every Debian package in it with its version |
| `…-uefi.spdx.json` | The bill of materials: the same list, the `open-alert-base` package, and the RPi ALERT release with its hash and the key that signed it |

`--arch arm64` builds the image for 64-bit ARM computers that start the way a PC does (UEFI
firmware: ARM servers and "SystemReady" boards). The build does not cross over: it must be run
on an ARM computer. The automatic build first ran it on 19 November 2026: the image built, and
did not start in its virtual machine (QEMU found no start-up program for the network card;
`test/image.sh` now starts the card without one, untried on GitHub as yet). A board that
starts from its maker's own boot loader (most small ARM boards) needs its maker's image, and
takes the package or the container.

`--deb FILE` builds the image with a package already made instead of building one. Such a
package was not checked here, so the build fetches and checks the pinned release all the same
and compares the package's agent with it, file for file and both ways (nothing missing,
nothing added); any difference stops the build.

Two builds are not the same file byte for byte (each makes new identifiers for the file
systems, and Debian's archive moves on). What is in a build is recorded beside it instead.

### Flashing it, and the first set-up

1. Check the download, then write it to the disk — for example, on Linux (`sdX` is the disk;
   be sure of it, everything on it is lost):

   ```
   sha256sum -c open-alert-base-0.24.0+oa1-amd64-uefi.img.xz.sha256
   xz -dc open-alert-base-0.24.0+oa1-amd64-uefi.img.xz | sudo dd of=/dev/sdX bs=4M conv=fsync status=progress
   ```

   Any program that writes a disk image will do. None has been tried (the checks start the
   image file itself).
2. Unplug the disk and plug it in again. A small partition named `CIDATA` appears. Open
   `user-data` in it with a plain-text editor. Everything in it is switched off; a part is
   switched on by removing the one `#` at the start of each of its lines. `README.txt` beside
   it says the same in more words.
3. Put the disk in the computer and switch it on. Secure Boot can stay on.
4. The first start takes a minute or two longer than later ones: the main partition grows to
   fill the disk, the SSH host keys are made, the set-up file is applied.
5. Log in with the key (`ssh admin@<address>`), then `rpi-alert setup` for the Flood-Net token,
   the base station's name and where it is.

What `user-data` offers:

| Part | What it sets |
|---|---|
| 1 | The computer's name on the network |
| 2 | An administrator account and the SSH public key that opens it. **Without this part nobody can log in** |
| 3 | The time zone (for the times a person reads; readings always go to Flood-Net in UTC) |
| 4 | A private certificate authority, for a network that opens HTTPS traffic for inspection |
| 5 | A web proxy for the base station and for Debian's updates; the organisation's own time servers; a fixed address |
| 6 | Commands for the end of the first start — among them the one line that puts the **enterprise profile** in force, and one that stops the file ever being read again |

Things to know:

- **Out of the box nobody can log in**, by the network or at the keyboard. The base station
  starts, receives and shows its dashboard, and that is all, until `user-data` names an account
  (checked: part 8 of the test).
- **The account has no password**, so it cannot be used at the screen or the serial port
  either, only over SSH with its key. For a way in when the network is down, log in once over
  SSH and give it one: `sudo passwd admin`.
- **`user-data` stays on the disk**, readable by anybody who holds the disk, and a person with
  the disk in their hands can add an account through it. Put no password or private key in it.
  The last line of part 6 stops it being read again. Only the `CIDATA` partition of the disk the
  computer starts from is read: a USB stick or another disk carrying a partition of the same
  name, plugged in at a restart, is not looked at (checked: an "intruder's" stick is plugged in
  through every start of the test). Nor can a stick that is a whole copy of the image take over
  the start: the computer's GRUB never takes a boot menu from another disk, and Linux does not
  start while two disks carry the main partition (see [Secure Boot](#secure-boot); checked:
  part 12). It is read at every start, but cloud-init applies a set-up
  once for each name in `meta-data`; it is left that way on purpose, because whoever can change
  this disk's `CIDATA` partition can change its main partition too (the disk is not encrypted).
- **With the enterprise profile chosen in `user-data`, the standard profile is in force for the
  first moments of the first start**, until the set-up reaches that line. In the test that was
  about 20 seconds from the agent's first start to its start under the enterprise profile; the
  agent ran for the first 5 of them and was stopped before its log shows the dashboard coming
  up on port 80. A real computer will have other timings. On a network where that matters,
  give the computer its first start before it is plugged into that network.
- **The dashboard is reached by the computer's address.** The agent's log names it as
  `http://<name>.local/`, which works on a Raspberry Pi; on this image that kind of name
  look-up is off.
- **Kernel updates take effect at the next restart, and the image never restarts by itself.**
  When to restart is the organisation's decision (`unattended-upgrades` can be told to; it is
  not). A security update of Node.js likewise reaches the running agent when the service or
  the computer is next restarted.

### Secure Boot

What was checked, in the virtual machine, with firmware that holds Microsoft's keys and has
Secure Boot on: the image starts; the kernel says on the console that Secure Boot is on, and
the running system says the same; the kernel is in the locked-down state Debian puts it in
whenever Secure Boot is on. And the other way round: with **one bit** changed in shim the
firmware refuses to start it, and with one bit changed in GRUB shim refuses it; in both cases
no kernel starts. Shim carries both of Microsoft's signatures, the one from 2011 and the one
from 2023 that replaces it.

**What Secure Boot does and does not cover here.** It checks the programs that start — shim,
GRUB and the kernel — and nothing they are told to do: not the menu file, not the options the
kernel is started with, not the kernel's start-up file system (the *initrd*) and not the main
partition. So, on its own, it would not stop a person at the keyboard, or on a serial port
wired to a console server, from changing how Linux starts at the boot menu and getting an
administrator's prompt with no account. On this image the menu is therefore closed (above):
its editor and command line ask for a name and a password, and none works; the entries still
start by themselves (checked over the serial port: part 11 of the test).

**A USB stick made from the image.** A closed menu is worth something only if it is this
disk's menu. Every disk made from the image carries the same identifier for its main
partition, and Debian's usual small boot file has GRUB take its menu from the first disk that
carries it: a USB stick holding a copy of the image with a menu of its own, plugged in before
a restart, could then start the computer as administrator with no account, Secure Boot or
not, and with no keyboard if its menu also names a start-up file system of its own (Secure
Boot does not check that file either). On this image GRUB takes its menu from the main
partition of the disk it was itself started from and never looks at another disk, and its
entries take Linux from the same place; a GRUB or shim update that writes Debian's small file
again has it replaced within seconds. Linux is told its main partition by the identifier too,
so the start-up file system counts the disks that carry it, just before mounting it and again
just after, and while there are two it does not go on: it says so on the screen and the serial
port and restarts the computer 30 seconds later, offering no prompt. Checked in part 12 of the
test: a whole copy of the image on a USB stick, its EFI partition emptied (so the firmware
cannot start from the stick itself) and a menu of its own on it; the computer's GRUB did not
take that menu, the kernel's start-up line was the computer's own, and the start-up file
system refused to go on and restarted the computer. The stick showed up between the two
counts each time, and the partition checked and mounted was the computer's own: a rule of the
image's has the names that stand for an identifier (`/dev/disk/by-uuid/…`) point to a disk that
is not on USB before one that is. (Before that rule, in two of four starts, the stick's
partition was the one checked and mounted, because udev points such a name at the disk it saw
last; it was only read, by the kernel and the file system check, and the second count stopped
the start before anything on it was run.)

One case is left, and it is narrow: a stick the start-up file system sees *before* the
computer's own disk, with that disk still not seen when the main partition is mounted (and,
when what was mounted is a USB disk, five seconds later too). Then only one disk carries the
identifier, and it is the stick's. The same holds for a disk made from the image that is not on
USB either (a memory card in a reader built into the computer, say) and is seen first. A computer's own SATA, NVMe or eMMC disk is found well
before a USB stick (the kernel waits a second before it reads any USB disk); one whose own
disk is itself on USB, or very slow to start, is the kind of computer this case could reach.

What stays open to a person with the computer in their hands: the PC's own firmware set-up (it
decides whether Secure Boot is on, and which disk starts: a computer allowed to start from a
USB stick can be started from one), and the disk itself, which is not encrypted. A set-up
password for the firmware, and the order it starts disks in (this disk only), are the
organisation's own to set, as for any computer.

On a real computer, once it is running:

```
mokutil --sb-state          # prints "SecureBoot enabled"
```

Two things a person may see:

- Some business PCs are sold with the key for operating systems other than Windows switched
  off. Any Linux, this image included, then needs one setting changed in the PC's firmware
  set-up (it is named along the lines of "Allow Microsoft 3rd Party UEFI CA"). Not met in the
  test, where the firmware had the key.
- Before the boot menu, GRUB prints `error: prohibited by secure boot policy` once and goes on.
  It comes from one of Debian's own menu files (`/etc/grub.d/25_bli`), which asks for an
  optional part that Debian's signed GRUB may not load with Secure Boot on. It is not from this
  image's files and nothing is wrong.

### How it is checked: `firmware/test/image.sh`

```
firmware/test/image.sh              # the image in dist/; about 13 minutes without KVM
firmware/test/image.sh --help
```

It starts the image in a virtual machine (QEMU) the way a freshly flashed computer starts, and
checks it from outside and, over SSH, from inside. It needs `qemu-system-x86` and `ovmf` (the
UEFI firmware for QEMU), `mtools`, `jq`, `openssl`, `curl`, an SSH client, and for some checks
`sbsigntool` and `socat`. It does not need the administrator account. With KVM (the processor's
own support for virtual machines) it uses it; without, QEMU plays the processor in software.
Logs go to `dist/test-logs/image/`. In order:

1. **The image file, before it is started**: the partitions, the boot files and who signed
   them, the first set-up files, that the boot menu is closed, that the small `grub.cfg` on the
   EFI partition is the image's own and the menu looks for no identifier (each Linux entry takes
   the partition that file chose; `panic=30`), that cloud-init does not search other disks, that
   the firewall does not let port 8080 in, and that nothing in it is one computer's own.
2. **A working copy on a larger "disk"** (8 GB), with a `user-data` made from the image's own
   example by removing one `#` a line, as a person would: a name, an account with a key made
   for the run, the time zone, a private certificate authority, a web proxy. And an
   **intruder's USB stick**: a copy of the image's own `CIDATA` partition (the same label, even
   the same identifier) whose `user-data` would make an administrator account, write a file and
   print a line on the console.
3. **The start**, with Secure Boot on, a network card, the intruder's stick plugged in (it stays
   in through every later start of this copy), and an emulated USB serial adapter that plays a
   receiver (the lines of a Quansheng ALERT radio, as RPi ALERT's `simulate.sh` sends them).
4. **From outside**: a login prompt on the serial console; the dashboard through the network;
   SSH takes the key, refuses a password, refuses root; a port the firewall does not list is
   shut.
5. **From inside**: the set-up was applied, from this disk's own partition only, and nothing
   of the intruder's stick; the main partition grew; no account has a password; security updates are on; the service runs inside its sandbox (tried, not only
   read); systemd's exposure score; the sandboxed agent reads the USB serial receiver; and a
   **pretend radio stick** — a USB device made by the kernel's own USB test driver, carrying a
   real stick's USB ids — is handed to the agent by the device rule and opened by `rtl_sdr`
   inside the sandbox.
6. **Debian's own boot-loader updates**, made to run as a GRUB update would run them, then as
   a shim update would (which writes Debian's small `grub.cfg` and makes no new menu), and the
   menu made again as a kernel update makes it: each time the image's own small file is back,
   the menu still closed, each entry once and none looking for an identifier.
7. **The enterprise profile, then a restart**: the agent tied to the lock; the lock kept through
   the image's firewall reloaded, restarted, and every table cleared by hand; everything comes
   up again by itself.
8. **A fresh copy exactly as it is flashed**, with nothing switched on in `user-data`: it
   starts, the dashboard answers, and nobody can log in.
9. **Another fresh copy** whose `user-data` switches on only an account and the enterprise
   profile, as an organisation would: it comes up locked down without anybody logging in.
10. **Two more copies with one bit changed** in shim and in GRUB: neither starts.
11. **One more copy with its serial port in hand**, as a person with a serial cable has it:
    `c` (GRUB's command line) and `e` (the menu's editor) both ask for a name and a password and
    take none; no `grub>` prompt is ever shown; Enter on the menu's own entry still starts Linux,
    with the image's own kernel options.
12. **One more copy with a USB stick made from the image itself** plugged in: a whole copy of
    the image (its main partition carries the same identifier), its EFI partition emptied, and a
    boot menu of its own with no owner that adds a word to the kernel's start-up line. The
    computer's GRUB must not take that menu, the kernel's start-up line must be the computer's
    own, the partition the start-up file system checks and mounts must be the computer's own,
    and Linux must not start from the stick: the start-up file system refuses to go on and
    restarts the computer, with no prompt (or, if the stick shows up only after the computer's
    own disk is mounted, starts from its own disk).

### The disk image: what has been tested, where

**18 November 2026, after the two reviews.** The image built from the files as they are in
this folder (20:46 UTC, 3 minutes 45 seconds, 287 MB packed), then a whole run of
`firmware/test/image.sh` on it, alone on the computer (started 21:14 UTC, 13 minutes): **223
checks passed, none failed, 1 skipped** — the same skip as before (Debian's archive cannot be
reached from the virtual machine here). The checks added since the run below are marked *new*
in the table. In one of the starts QEMU itself crashed (signal 11) 14 seconds in; the test
makes the copy afresh and starts it once more, as it is written to, and the second start
passed. The same computer as the package's: x86-64, Ubuntu 24.04.5, no USB and no KVM.

Before the reviews: everything below is from 14 November 2026 on the test computer described
under [What has been tested, and where](#what-has-been-tested-and-where): x86-64, Ubuntu 24.04,
**no USB and no KVM**, so the virtual machine's processor was emulated in software. The virtual
machine: QEMU 8.2.2, the OVMF firmware with Secure Boot on and Microsoft's keys, 2 GB of memory,
a SATA disk, an Intel network card. A whole run of `firmware/test/image.sh` with part 8 (the
copy with nothing switched on), on an image built minutes before, ended on 18 November at
09:08 UTC with **184 checks passed, none failed, 1 skipped**. Earlier runs on 14 November also
passed (154, 174 and 175 checks, as parts 8 and 9 and one check were added). shellcheck 0.9.0
had nothing to report on the three scripts.

In the image as built: Debian 13.7, kernel 6.12.117, systemd 257.13, Node.js 20.19.2, rtl-sdr
2.0.2, OpenSSH 10.0, cloud-init 25.1.4, shim 16.1, GRUB 2.12.

| What | Result |
|---|---|
| The amd64 image builds from nothing, as root, with no container. Built three times; the last time with the builder's own file permissions set as tight as they go, to show the build does not lean on them | Passed |
| Before it is started: a disk laid out the way UEFI firmware expects (a GPT partition table) with the three partitions, the main one last; the boot files where firmware looks; shim carries Microsoft's signatures, GRUB and the kernel Debian's; `CIDATA` holds the three files as they are in `image/cidata/`, and `user-data` switches nothing on; no identifier, no SSH host key, no password, nothing in the agent's data folder; the profile is `standard` | Passed |
| **It starts with Secure Boot on**: a login prompt on the serial console; the kernel and the running system both say Secure Boot is on; the kernel is locked down; the console says there is no default password and where set-up is | Passed |
| The first set-up file, made from the image's example by removing one `#` a line, was applied from the disk's own `CIDATA` partition: the name, the account, the time zone, the certificate authority in the system's list, the proxy in the service's file (still readable by root alone), the agent restarted with it and asking the stand-in proxy | Passed |
| *New.* **Only this disk's `CIDATA` is read.** Before it starts: cloud-init's search by label is off, the boot menu is closed (an owner, no password, the Linux entries marked to start by themselves, Debian's own menu script switched off), and the firewall lists SSH and port 80 and not 8080. At the start: the console and the journal say the set-up files were taken from `/dev/sda2`, the second partition of the start-up disk; cloud-init read them from its own folder, which holds that partition's files byte for byte, root's alone. An intruder's USB stick with the same label (and identifier), plugged in from the first start to the last, was seen by the computer as `/dev/sdb`, and nothing of its set-up file was applied: no file, no account, no line on the console — at the first start, after the restart, and with the enterprise profile | Passed |
| A new identifier, new SSH host keys and the dashboard's first password were made at the first start; a second copy of the same image made a different host key | Passed |
| **The main partition grew** to fill the 8 GB disk (7,703 MB), partition and file system | Passed |
| **SSH takes the key; a password is refused** ("Permission denied (publickey)"); root is refused even with the key; no account can be opened with a password | Passed |
| **Security updates are on**: both of Debian's daily timers are waiting; `unattended-upgrade` reads its settings and names Debian's security updates; updates come from Debian's two addresses and nowhere else | Passed |
| Fetching from Debian's archive from inside the virtual machine, and a trial run of an update against it | **Skipped**: on this test computer the virtual machine cannot reach the archive. The check is there and runs where it can |
| The firewall: loaded at start; the only ports open to other computers are SSH and the dashboard; from outside, a listed port answers and an unlisted one does not. 18 November: a little server listening on 8080 and 9999 answers on the computer itself, and from outside neither answers: 8080 is no longer let in | Passed |
| **The service is active under systemd with its sandbox** — tried, not only read: user `rpi-alert`, exactly one capability (standard profile), no-new-privileges and the system-call filter on; its user cannot write in `/usr`, `/etc` or `/var`, can write its two folders, has its own `/tmp`, cannot read the proxy file or look into `/home`; inside the service's group of processes even root is refused the disk and the kernel's log; nothing in the agent's log says it was refused something it needed | Passed |
| **systemd's exposure score** for the running service (`systemd-analyze security`) | **1.9** standard profile, **1.7** enterprise — the same as the package's own tests found |
| **The dashboard answers another computer** on port 80 through the forwarded port; the agent is the pinned version, every file of it the signed release's; another computer is not let into the settings without the password | Passed |
| **An emulated USB serial receiver, read by the sandboxed agent**: the two USB serial drivers were loaded at start; the adapter belongs to the group `dialout`; the service's closed device list lets it be opened; the agent, as `rpi-alert`, opened it, took the lines for a Quansheng ALERT radio and shows it on the dashboard. Again after the restart, with no capability at all | Passed |
| **A pretend radio stick** (the kernel's USB test driver, with the USB ids of an RTL-SDR Blog stick, `0bda:2838`): udev applied the package's rule — group `plugdev`, nobody else, power saving off; the kernel's TV driver, which this kernel has, did not take it; a user outside the group is refused; the agent found it; `rtl_sdr`, started by the sandboxed agent, opened the device and asked it for samples. It got none: there is no radio behind it | Passed |
| Debian's own boot-loader update, run as a GRUB update would run it, wrote the same boot files the build had put there, file for file | Passed |
| *New.* After that update the boot menu is still closed; Debian's own menu script switched on again, as a GRUB update would leave it, then `update-grub` (what a kernel update runs): no error, still closed, the script switched off again, each entry in the menu once | Passed |
| The enterprise profile put in force by its command: port 8080, no capability, the firewall lock on beside the image's firewall and still there after the firewall is loaded again; from outside nothing answers on 8080 or 80. *New:* the agent tied to the lock; `audit` says the keeper is running; the lock still there after `systemctl restart nftables`; every table cleared by hand, the lock put back by its keeper with the agent running on (the same process), and the image's own table back after a reload | Passed |
| **A restart**: a login prompt again; the same identifier, host key and partition size; the set-up file was not applied twice; the service, the firewall lock and the two serial drivers came up by themselves; still locked down | Passed |
| **A fresh copy exactly as it is flashed**, nothing switched on in `user-data`: a login prompt; the first set-up ran to its end with nothing to set up; nothing on the console marked failed; the dashboard answers another computer on port 80; SSH answers and turns away `admin`, `root` and `debian` alike; its SSH host key is its own | Passed |
| Another fresh copy with only an account and the enterprise profile switched on in `user-data`: it came up with the enterprise profile, port 8080 for the computer itself only, no capability, the firewall lock on, and nothing answering other computers on 8080 or 80 — before anybody had logged in | Passed |
| With Secure Boot on, a copy with one bit changed in shim is refused by the firmware ("Access Denied"), and one with one bit changed in GRUB is refused by shim ("Security Violation"); no kernel starts | Passed |
| *New.* **The boot menu over the serial port** (part 11): it shows; `c` asks for a user name and turns away a name and a password ("access denied"); `e` asks for a user name too; no `grub>` prompt is ever shown; Enter on the menu's own entry starts Linux with no name or password asked, and the kernel's start-up line on the console is the image's own | Passed |
| It shuts down cleanly when asked | Passed |

Numbers, measured there. **The times are on an emulated processor**; a real PC will differ.

| | |
|---|---|
| The image | 3.0 GB as a disk (3,221,225,472 bytes), 705 MB of it in use; about 290 MB packed with xz |
| Building it | About 2 minutes 25 seconds on four processor cores, Debian's packages downloaded each time. 18 November, with the packing: 3 minutes 45 seconds, the computer shared with other work |
| First start, from power-on to a login prompt on the serial console | 96 to 105 seconds over the four runs, with the partition grown, the keys made and the set-up applied (a copy with less to set up: about 60 seconds). 18 November: 119 seconds (64 and 69 for the copies with less to set up) |
| A later start, as systemd counts it | 35 to 40 seconds (about 10 the kernel, the rest systemd and the services) |
| A restart, from the command to the next login prompt | 63 to 68 seconds, shutting down included. 18 November: 85 seconds |
| The whole check | About 11 minutes. 18 November, with part 11: 13 minutes |

### The disk image: what is not yet proved

- **A real computer.** The image has not been written to a disk or started on one. Real
  firmware differs from QEMU's from maker to maker: whether it finds the disk, whether its
  Secure Boot holds the key (see [Secure Boot](#secure-boot)), whether its network port needs a
  file the image does not have.
- **A real radio stick**, and a stick doing its work. The pretend stick shows the device rule,
  the block on the TV driver and the sandbox's device list up to the moment `rtl_sdr` has the
  device open. Nothing shows a sample being read. This is still the first thing to try on real
  hardware.
- **A real serial receiver.** The adapter was QEMU's emulated one (an FTDI type), fed by the
  test. A real Quansheng radio, an ERT-A2 or a GPS has not been plugged in.
- **The ARM image.** `build-image.sh --arch arm64` ran on GitHub's ARM computer on 19 November
  2026 and built the image; `image.sh --arch arm64` could not start it (no `efi-virtio.rom` for
  the network card in that QEMU). The change that starts the card without that file has not
  run on GitHub yet, so the ARM image has never been seen to start.
- **An update really installed.** `unattended-upgrades` has not fetched or installed anything
  here, and the virtual machine could not reach Debian's archive at all. A kernel update
  followed by a restart with Secure Boot on has not been tried; the boot-loader update was
  made to run by hand.
- **The clock.** No time server could be reached, so the clock was never set from the network
  and the agent kept its readings waiting, as it is meant to. The moment it starts to trust the
  clock has not been watched on this image.
- **Parts of the example `user-data`.** Tried: parts 1 to 4, the proxy for the base station,
  the restart line and the enterprise line. Not tried: the proxy for Debian's updates, the
  organisation's own time servers, a fixed address, the two lines that apply them at once, and
  the line that stops the file being read again. Applying a changed `user-data` a second time
  (the name in `meta-data`) has not been tried either.
- **The screen and a keyboard.** The virtual machine had no screen; only the serial console
  was watched. The log shows a login prompt was started for the screen as well.
- **The `CIDATA` partition opened on Windows or macOS.** It is plain FAT, which both read; no
  one has done it.
- **A program that writes disk images** (`dd`, or any other).
- **A long run, a power cut, a full disk.** Each start in the test lasted minutes.
- **The image built by the automatic build** has not been written to a disk or started outside
  a virtual machine either. Its start test passed on GitHub's PC (see the next section).

### What the start test showed about the package

Nothing in the package had to be changed for the image: the service started under a real
systemd on a real kernel with every limit in its service file, and the agent's log has no line
about a refusal. This was the first time the service's device list met USB at all (the
package's own tests ran on a kernel without USB): `DeviceAllow=char-usb_device` and
`char-ttyUSB` do what they are for, and the package's udev rule and driver block list were
applied by a real udev to a (pretend) device for the first time.

Four things worth knowing, none of them a fault in the service:

1. **`deb/build-deb.sh` stopped when the person running it had tight file permissions set**
   (a `umask` of 027 or 077): `dpkg-deb` refused the folder. Since 18 November it sets
   `umask 022` itself, and `test/deb.sh` builds it a third time under `umask 077` to show it.
2. **The agent names the dashboard as `http://<name>.local/`** in its log. That is RPi ALERT's
   own wording, right for a Pi; on the image, and on most computers the package is installed
   on, that name does not work.
3. **With the enterprise profile chosen in `user-data`, the standard profile runs first for a
   few seconds** (above). A build option that installs the package with the enterprise profile
   from the start — the package already allows it — would close that gap. Not built.
4. **On a network with no time server in reach the agent sends nothing**, by design: in the
   test about 190 readings were waiting for the clock after a few minutes. An organisation
   that blocks the public time servers must name its own (part 5 of `user-data`).

### The disk image: choices made here

- **One tool from Debian (`mmdebstrap`) and a plain script**, not an image-building framework:
  a reviewer can read every step, and the only programs that run are Debian's.
- **Debian's smallest base and no "recommended" packages.** What a person looking after the
  computer needs is named in the list (`less`, `nano`, `curl`, `lsusb`, `ping`).
- **Processor microcode and Realtek network firmware are in by default**, as Debian's own
  installer has put them on PCs since Debian 12: fixes for processor faults are security
  fixes. They are the only packages without source. `--no-firmware` leaves them out.
- **UEFI only.** No support for PCs that start the older way (BIOS); none has Secure Boot.
- **No swap, no disk encryption, no LVM.** One ext4 partition that grows. Encryption needs a
  password at every start or a set-up with the computer's security chip: an organisation's
  own choice, and not one a base station that must come back by itself after a power cut can
  make lightly.
- **`cloud-init` for the first set-up**, not a script of this project's own: IT teams know it.
  Its own search for a disk labelled `CIDATA` is switched off (`fs_label: null`), because it
  takes any disk with that label and tries removable ones first; a short script of the
  image's own hands it the two files from this disk's second partition instead. cloud-init also
  takes a hint from the kernel's start-up line and from the firmware's serial-number field: the
  first comes only from this disk's own boot menu, which is closed (a USB stick's menu is never
  taken, see [Secure Boot](#secure-boot)), and the second is set only by whoever controls the
  firmware (or a virtual machine's host).
- **`CIDATA` is a partition of the same disk**, so one disk is all a person handles, as with a
  Raspberry Pi's SD card. The price is that the file stays on the disk.
- **The network is `systemd-networkd`**, which is part of systemd, rather than one more
  package. No Wi-Fi: a base station inside an organisation's network is on a cable.
- **The firewall is a table of its own** that loads at every start and leaves the enterprise
  profile's lock alone. It lets in port 80 and not 8080: 8080 is the enterprise profile's port,
  where the dashboard is for the computer itself only, so this table says so too. (The agent
  also goes to 8080 when it may not have 80; under the standard profile that does not happen,
  since the profile gives it the capability for 80. A person who moves the dashboard to another
  port for the local network adds that port here.)
- **The boot menu has an owner with no password**, rather than a password: that closes its
  editor and command line and keeps to the rule that no password is stored on the image. Every
  entry that starts Linux is marked to start by itself. Debian's own menu script (`10_linux`)
  is run by the image's script, which marks its entries, and is itself switched off so that
  they are not written twice; a GRUB update that switches it on again is undone the next time
  the menu is made. If Debian's script cannot be run, the image's script fails and the menu
  maker leaves the old menu in place, so a computer is never left with a menu that asks for a
  password nobody has.
- **The boot files are put in place by the build with `mtools`**, in the places and under the
  names Debian's own installer uses, and Debian's package is told to keep the copy that a
  never-seen disk starts from up to date. The test checks that Debian's own installer, run
  afterwards, writes the very same files.
- **SSH host keys are made by a small unit of the image's own**, because Debian's unit for it
  does not run on a computer started from an image with an empty identifier file.
- **The image is 3 GB**, so that it fits a 4 GB disk and leaves room before it has grown.
- **The image starts with the standard profile**, as the design asks, and the enterprise
  profile is one line of `user-data`.
- **The pretend radio stick** in the test is the kernel's own USB test driver (`dummy_hcd`),
  which Debian's kernel carries. It was chosen over passing a real USB device through because
  the test computer, like GitHub's, has none.

## After the two reviews (18 November 2026)

Two automated reviews read everything in this folder and tried it: one for security, one for
correctness. Between them they raised 25 points: 2 that should hold back a release, 11 that
should be put right, 12 small ones. Each is below with what was done. The sections above
describe the result; the test counts are under each form's "what has been tested".

| | What was found | What was done |
|---|---|---|
| 1 | **The disk image took its first set-up from any disk labelled `CIDATA`**, a USB stick first: anybody who could reach a USB port and cause a restart could set the computer up as administrator | Put right. cloud-init no longer searches by label; the image's own service hands it the files from this disk's own partition. The start test keeps an "intruder's" stick plugged in through every start and checks nothing of it was applied. Not changed: the file is still read at each start (whoever can change that partition can change the main one too). A later check found the same attacker could still get in another way, with a stick that is a whole copy of the image: see A below |
| 2 | **The enterprise profile's lock could be missing while the agent ran**, the dashboard then open to the network: a slip in the rules file, Debian's own firewall service started after it, no nftables | Put right: no lock, no agent. The agent is tied to the lock's service, the lock is kept in place by a keeper, a missing rules file is a failure, and the image's own firewall no longer lets port 8080 in. Tried every way the review found, under a real systemd and in the image |
| 3 | **Root decided the lock and the low-port capability from a settings file the agent's user can write** | Put right: from the profile root put in force. Settings that ask for less are kept to the profile, said loudly, and end `sync` with status 4 |
| 4 | **The boot menu was open**: from its command line, at the keyboard or a serial port, the computer could be started as administrator with no account | Put right: the menu has an owner with no password; its entries start by themselves. Tried over the serial port. The Secure Boot section now says what Secure Boot does not cover. The closed menu held only while the menu came from this disk: see A below |
| 5 | The proxy start-up file took its library from the agent's own data folder first | Put right: from the system's folders only. Tried with a look-alike library |
| 6 | A proxy setting that could not be used was passed over and the agent called out directly, while the log said nothing was sent | Put right: such calls are refused; an address without `http://` is taken as `http://` |
| 7 | A proxy that drops connections made the agent open thousands of connections a second | Put right where the start-up file is used (every Node.js the package is made for). **Not on Node.js 22.21 or newer**, which handles the proxy itself: measured, and written down in the proxy section |
| 8 | The workflow could publish from any branch, over a tag already in use, and the container before the release | Put right: `main` only, a tag in use anywhere stops the run, and the order is the two per-architecture containers (`<tag>-amd64`, `<tag>-arm64`), the draft release, the joined container (`<tag>`), the public release; the jobs name an environment the owner can lock down. Not tried on GitHub |
| 9 | The release-tag check passed a value of two lines | Put right; tried |
| 10 | The published container's exact base image was not recorded | Put right: looked up once per release, in the labels and the release notes |
| 11 | `build-image.sh --deb` took a package without checking its agent, and said it matched | Put right: checked against the signed release, both ways |
| 12 | The serial drivers were loaded only from the next start, and built-in serial ports were refused without a word | Put right: the install loads them; both READMEs and the service file say how to open a built-in port |
| 13 | The release check read the release file by name several times between checking and unpacking | Put right: everything is done on a private copy |
| 14 | A settings file root put there stayed root's, and the agent ran on its built-in settings, without the token | Put right: handed to the agent's user, on the opened file; a link is left alone; a file that cannot be used stops `sync` and `profile` |
| 15 | The package's installed size came from the build disk's blocks, so two builds could differ | Put right: from the files' lengths. Built a third time on a memory disk and compared |
| 16 | A second release run under the same tag overwrote the published container | Put right (see 8) |
| 17 | The checks under a real systemd could be skipped in the workflow with the job still green | Put right: required on x86-64, a warning on ARM |
| 18 | `OPEN_ALERT_BASE_PROFILE` was ignored when settings were already there, as after a remove and reinstall | Put right: applied, and said; tried with and without systemd |
| 19 | The container was published without waiting for the ARM image's build | Put right |
| 20 | `build-deb.sh` failed under a tight file mask | Put right |
| 21 | Test counts and a paragraph marked "INTERIM" on this page were out of date | Put right: this page was rewritten from the runs of 18 November |
| 22 | `sha256sum -c SHA256SUMS` failed for anybody who downloaded only some of a release's files | Put right: `--ignore-missing`, in the release notes and here |
| 23 | The first container published is private, and nothing said so or how to pull it | Written down (the release paragraph below). **The owner's step remains** |
| 24 | RPi ALERT's own uninstall leaves its `alert` account and two groups behind | The refusal message and `audit` now say so, with the commands |
| 25 | Ubuntu 24.04's Node.js 18 is past its makers' end of life and comes from *universe* | Written down, under Installing it |

Running the checks on the result found three more faults, put right before the runs described
on this page:

- **On Debian 12's older `undici` (5.15) the guard of point 7 was not put in place**, and the
  check of a proxy that drops every connection never ended (Node.js kept busy by the very
  storm the guard is for). That library makes its connection to the proxy itself, with no way
  to hand it a factory; the start-up file now puts the same guard on that connection once it
  is made. Both check scripts now also give each such case two minutes at most, and say so as
  a failure rather than wait for ever.
- **The lock's service could give up for good.** A few starts in quick succession (as the test
  makes, and as a person putting the rules file right might) reached systemd's start limit, and
  after that it no longer tried every 15 seconds: the agent stayed stopped once the lock could
  hold again. The limit is now off for that one service.
- **Two checks killed a service by the number systemd gave for it**, and when the service was
  not running that number was 0, which ends the check script itself. They now check the number
  first.

### A check of the move (19 November 2026)

An independent check then tried the move. Each point was tried again before it was put right:

| | What was found | What was done |
|---|---|---|
| A | This page, `audit`, the package's changelog and the security overview said that with `web.behindProxy` on, a web page in a browser on this computer is a visitor. A page that this computer itself serves, under `localhost` or `127.0.0.1` on any port, still counts as the computer itself, as RPi ALERT's own `docs/hardware.md` says ("from a page of that name"): a request asking for `127.0.0.1` with `Origin: http://localhost:3000` was given the settings, while one from `http://evil.example` got "log in first" | All four, the package's own README and `status` now say what is so: a page from another site, or from a name pointed at this computer, is a visitor; any program on the computer, and a page the computer itself serves, are not (see [Why `web.behindProxy` is on in both](#the-two-profiles)). New checks in both profiles try a page from another site, a page from `localhost` on another port, and a `.local` name |
| B | Answer A7 in `docs/security/controls.md` said the settings file cannot loosen the settings the profile holds. Anybody on the computer can, with `rpi-alert config set`, until the agent next starts or `sync` restarts it; and a proxy's callers are visitors only when the proxy adds `X-Forwarded-For` | A7 now says both, as this page already did |
| C | This page said a browser on the computer had been tried | It was a request made like a browser's; now said so |
| D | This page said no check had been made weaker | One had, for a reason: now named, with the reason |
| E | The container left `web.behindProxy` off, for a reason that holds for Docker's published ports only; another engine may bring the computer's own callers in on the box's `127.0.0.1` | It is on in the container's first settings, as in the package. The health check and `docker exec … rpi-alert` are still the box itself, and a page from another site, sent to the box's `127.0.0.1`, is a visitor (checked) |
| F | `test/container.sh` left two unnamed volumes behind for each test container it removed (the image declares two), and the image's version tag; the report of the run said none was left | Each container is now removed with its volumes, and the image under both names. After a whole run, none of either is left. Those left by earlier runs since 13 November are still on the test computer |
| G | The new changelog entry has an e-mail address in its signature line | Kept: Debian's changelog format requires one, and every earlier entry uses the same GitHub no-reply address, which names only the repository's public account. The owner may choose a placeholder for every entry instead (lintian would then warn) |
| H | Older than the move: with the port taken out of the settings file behind the enterprise profile, the agent falls back to 8080, but `sync` asked for the firewall lock to be moved to port 80, and `status` gave `http://127.0.0.1:80/` | `sync`, `status` and `audit` name the port the agent really opens (above). Nothing was open to other computers meanwhile: the agent stayed on `127.0.0.1`, and the lock keeps other computers from the agent on every port |

### A check of the result (18 November 2026, later)

A third, independent check then tried the result. It found one point that should hold back a
release, two that should be put right and three small ones:

| | What was found | What was done |
|---|---|---|
| A | **A USB stick that is a whole copy of the image could supply the boot menu at a restart**, Secure Boot on: the small file beside GRUB took the first disk carrying the main partition's identifier, and the stick's menu (with no owner) started Linux with a shell as administrator. Points 1 and 4 above were closed only for `CIDATA`, the keyboard and the serial port | Put right: GRUB takes its menu from the disk it was started from, and its entries Linux from the same place; the image's own small file is put back after every GRUB or shim update; the start-up file system refuses to go on while two disks carry the main partition, and checks and mounts the computer's own disk before a USB one; `panic=30`, so that no failed start offers a prompt. Tried with that very stick in part 12 of the test. One narrow case is left (a stick seen before the computer's own disk): see [Secure Boot](#secure-boot) |
| B | This page said a USB stick could not affect the start, which A disproved | Rewritten with A |
| C | The checks under a real systemd would likely fail on GitHub's computers for a reason outside the package: Docker's AppArmor profile there forbids the mounts a service's sandbox is made of, and the package job, which every publishing job needs, would be red | Docker's AppArmor profile is left off that one test container; it is still not privileged. Not tried on GitHub (this computer has no AppArmor) |
| D | The lock's keeper took a rules file that throws the dashboard's packets away (`drop`) instead of refusing them for no lock at all, and kept the agent stopped for good, saying the table was not loaded | It now takes a dashboard rule that ends in `reject` or in `drop` for the lock (a table whose rules were emptied is still none), and its message says what is missing. Tried under a real systemd with `drop` |
| E | The package from the earlier snapshot and the new one carried the same version, `0.23.1+oa1` | The layer's revision is now 2 (`0.23.1+oa2`); `oa1` was never released |
| F | Smaller slips on this page and in the package's own README: when the workflow's checks run, which container run was cited, the order of a release's steps, and what `audit` does on a fault | Put right |

## How it is built and checked automatically

### The first run on GitHub (19 November 2026)

`.github/workflows/firmware.yml` first ran on GitHub with the push of commit `10858be` (run 1),
still on RPi ALERT 0.23.1 (`0.23.1+oa2`):

| Job | What it showed |
|---|---|
| Scripts | shellcheck: nothing to report |
| Benchmark, x86-64 and ARM | The quick test passed on both |
| Disk image for PCs | Built, and its whole start test passed with Secure Boot on, under KVM, in under 4 minutes |
| Disk image for ARM | Built; did not start: QEMU on the ARM computer could not find `efi-virtio.rom`, the network card's start-up program |
| Package, ARM | Every check ran, the part under a real systemd included: **1,029 passed, none failed, 4 skipped** |
| Package, x86-64 | **1,028 passed, 1 failed, 4 skipped.** The failure was in RPi ALERT's own test suite on Debian 12: a timing test failed in the full run and passed when the self-test ran it again alone — and `test/deb.sh` counted that as a failure although the self-test said it passed. Its logs could not be kept: the test containers write some of them as root |
| Container, x86-64 and ARM | One check failed on both: it used `setpriv` to become the user `nobody`, which only root may do, and on GitHub's computers the check already runs as an ordinary user |

What was put right after it, before the next run:

1. `test/image.sh`: on ARM the network card is started with no start-up program of its own
   (`virtio-net-pci,romfile=`); ARM's UEFI firmware brings its own driver for it.
2. `test/deb.sh`: a self-test that says "FAILED IN THE FULL RUN, PASSED WHEN RUN AGAIN ALONE"
   passed, and is counted so, with a note of the test that failed in the full run.
3. `firmware.yml`: a step makes the test logs readable by the job's own user before they are
   kept.
4. `test/container.sh`: run as root, the check becomes `nobody`; run as an ordinary user, it
   runs as itself.

Then the pin moved to RPi ALERT 0.24.0 (above). The next run is the first on `0.24.0+oa1`.

### Before the first run

The file was first written and read on a computer that cannot run it. What was checked without
running it, on 14 November 2026:

- it is well-formed (a YAML reader takes it), and every option it gives a script exists in
  that script. No checker made for such files (`actionlint`, for one) was run on it;
- each action's commit was looked up on GitHub (`git ls-remote`) and is the one its version
  tag names;
- these of its steps were run by hand on the test computer, with the commands the file gives
  them, on x86-64 only: shellcheck on the 18 scripts; the rule for a release tag; the download
  of the pinned release from GitHub and its check; the package built with lintian and checked
  with `test/deb.sh --deb` on Debian 13 (280 checks passed, none failed, 1 skipped); the container built under the name it
  would be published by, and that very image checked (95 checks passed; nothing was pushed);
  the disk image built and started (above); the benchmark's quick test (11 checks passed);
  and the step that puts a release together — the package's bill of materials, the checksums,
  the notes.

And again on 18 November 2026, after the changes the two reviews led to (the publishing order,
the checks before a release, `--require-systemd`): a YAML reader takes it, and every `needs`
names a job that exists; shellcheck has nothing to report on any of its 37 `run:` blocks (each
taken out of the file, with GitHub's `${{ … }}` parts replaced by a word); the release-tag step
turns away a tag with a `+`, an empty one, one that starts with `-` and a value of two lines,
and takes `firmware-0.23.1-oa1` (as the tag was then); the main-branch step turns away a run on another branch; the
command that looks up the base image's digest gives the digest from Docker Hub; and the step
that puts a release together was run on the files built that day (its `SHA256SUMS` checks, and
`sha256sum -c --ignore-missing` passes with the package alone). `actionlint` was again not run
(downloading it was not allowed on that computer). The step that looks for a tag already in use,
the `release` environment and everything that publishes can only be tried on GitHub.

Trying the steps by hand found one fault in the file as it first stood, since put right: it
handed the release's two files to the scripts through the variables `OA_AGENT_TARBALL` and
`OA_AGENT_SIG`, and with those set `test/deb.sh` fails one check (the one that gives the
release check a tarball *without* its signature and expects to be turned away: the variable
supplies the signature behind its back). The file now hands the two files over by option.

Not tried, because only GitHub can: the actions themselves, the ARM computers, KVM, and
publishing.

*GitHub Actions* is GitHub's service that runs a repository's builds and checks on GitHub's own
computers. This file tells it to build and check everything in this folder.

**What starts it**: a push that changes anything under `firmware/` or the file itself, and a
person pressing *Run workflow* (Actions → firmware). Nothing else: not a push elsewhere in the
repository, not a tag, not a pull request, not a timer. A newer push stops an older run that
is still going.

| Job | On | What it does |
|---|---|---|
| Scripts | x86-64 | shellcheck on every shell script under `firmware/`; for a release, the checks that it may be made (below) |
| Package | x86-64 and ARM | Downloads and checks the pinned release, builds the package, runs `test/deb.sh` (Debian 13, Ubuntu 24.04, Debian 12). On x86-64 with `--require-systemd`: the part under a real systemd may not be skipped |
| Package is the same file | x86-64 | Compares the two packages just built: one from a PC, one from an ARM computer. They must be the same file, byte for byte |
| Container | x86-64 and ARM | Builds the container and runs `test/container.sh` |
| Disk image for PCs | x86-64 | Builds the amd64 image and runs `test/image.sh`, with KVM where GitHub's computer has it |
| Disk image for ARM | ARM | Builds the arm64 image and tries `test/image.sh --arch arm64`. A failed start test is reported and does not fail the run, because nobody has seen it pass; such an image is never published |
| Benchmark | x86-64 and ARM | `bench/test.sh`, the benchmark's quick test |

"ARM" is GitHub's own 64-bit ARM computers (`ubuntu-24.04-arm`), which are free for a public
repository, as this one is.

**A release.** When a person starts it by hand and fills in *release tag* (for example
`firmware-0.24.0-oa1`), and only then. The first job's checks run alongside the builds, and
nothing is published unless they pass: they stop the release unless the tag is a plain name on
one line, the run is on the `main` branch, and the tag is in use nowhere — not as a git tag,
not as a release (published or draft), not as a container under `<tag>`, `<tag>-amd64` or
`<tag>-arm64`. Nothing published before is ever written over. The first job also looks up,
once, the exact version (the digest) that `debian:trixie-slim` names at that moment, and both
kinds of computer build the container on that one base. Then, only after every job
above has passed in the same run (the ARM image's build included; its start test may fail and
the image is then left out), and each step only after the one before it:

1. each kind of computer builds the container again on that base, checks that very image, and
   pushes it under a name of its own (`<tag>-amd64`, `<tag>-arm64`);
2. the GitHub release is made as a **draft**, which nobody but the owner sees, holding the
   package, the disk image for PCs (and the one for ARM if its start test passed) with their
   checksums, a bill of materials for the package and for each image, a `SHA256SUMS` file, and
   build provenance for each file; the names of the files on it are checked;
3. the two containers are joined as `ghcr.io/cdomotor-g/open-alert-base:<tag>`, for both kinds
   of processor, with *build provenance* — GitHub's signed record of which run, from which
   commit, made it;
4. the draft is made public, and the git tag is made then, at the commit the run was started on.

A run that stops half-way leaves no public release and no container under `<tag>` (the two
`-amd64` and `-arm64` ones may be there, and a draft for the owner to look at and delete). The
release notes name the base image by its digest and give the `docker pull` line; the
container's own labels name it too (`org.opencontainers.image.base.name` and `.base.digest`).

The publishing jobs name a GitHub *environment*, `release`. GitHub makes it at the first run,
with no rules. **For the owner, once:** Settings → Environments → `release` → limit it to the
`main` branch, and add a required reviewer if every release should wait for a person's
approval (each of the four publishing jobs then asks). A changed copy of the workflow file on
another branch cannot get round those rules, as it could get round the check in the file.

**For the owner, after the first release:** a container that a workflow pushes to ghcr.io for
the first time is **private**. To let anybody pull it: on GitHub, the account's (or
organisation's) *Packages* → `open-alert-base` → *Package settings* → *Change visibility* →
*Public*. Then:

```
docker pull ghcr.io/cdomotor-g/open-alert-base:firmware-0.24.0-oa1
OA_IMAGE=ghcr.io/cdomotor-g/open-alert-base:firmware-0.24.0-oa1 docker compose -f firmware/container/compose.yaml up -d
```

The release is marked "pre-release" unless the box is unticked. Leave it ticked until an image
has started a real computer and heard a real stick.

To check downloaded files against the release's checksums and against the record of where they
were built (`--ignore-missing` passes over the files of the release you did not download):

```
sha256sum -c --ignore-missing SHA256SUMS
gh attestation verify open-alert-base_0.24.0+oa1_all.deb --repo cdomotor-g/open-ALERT
```

**What a reviewer will ask about the file itself:**

- **Permissions.** The file as a whole grants nothing. Each job asks for what it needs: to
  read the repository, and nothing else, for every build and check (the first job may also
  read the container registry, to see whether a release's tag is taken). Only the four jobs
  that publish may write, and only where they publish: the container registry, the release,
  and GitHub's record of provenance.
- **Other people's code.** The only actions used are GitHub's own (`actions/checkout`,
  `upload-artifact`, `download-artifact`, `attest-build-provenance`), each pinned to one exact
  commit with its version beside it. Signing in to the container registry is one `docker
  login` line with the run's own short-lived token. No secret is stored in the repository's
  settings for any of it.
- **What it downloads**: Debian's and Ubuntu's packages, the three container base images the
  tests use, and the pinned RPi ALERT release, which is checked by hash and signature before
  anything else is done with it.
- **What the tests send out.** Nothing to Flood-Net: the agents under test have no token, and
  are given stand-ins for Flood-Net or for a proxy. One virtual machine of the image's start
  test is let out to the internet, to ask Debian's archive for its lists (a check that cannot
  be made on the test computer here); in its first seconds, before its set-up file has given
  it the stand-in proxy, its agent may fetch Flood-Net's public list of stations, as any new
  base station does. The other virtual machines can reach nothing outside themselves.

What the first run settled: `test/deb.sh`'s part under a real systemd starts on GitHub's
computers, x86-64 and ARM (on ARM a skip is still only a warning; it could now be made a
failure, as on x86-64); GitHub's x86-64 computer offers KVM to the image test; the ARM image
builds. What it did not: whether the ARM image starts (the fix has not run there yet), and the
publishing steps, which cannot be tried without publishing. Whether the two packages are the
same file is not among what is recorded of that run here.
