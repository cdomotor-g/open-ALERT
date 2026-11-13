# Overview: what the base station is, what it handles, what it touches

**Draft, 11 November 2026.** Facts are from [`firmware/README.md`](../../firmware/README.md) and
[`U1-rpi-alert-portability.md`](../hardware-review/research/U1-rpi-alert-portability.md)
sections 6 and 7 (RPi ALERT 0.23.1, the release the firmware is pinned to).

## What it is

A base station listens, by radio, to flood-warning gauges (rain gauges and river-level
gauges) that use the ALERT and ALERT2 radio languages. A radio stick (an RTL-SDR, the size of a
thumb drive) hands the computer a slice of the radio band; **RPi ALERT**, a Node.js program,
decodes the gauges' messages and sends the readings to **Flood-Net**, which puts them on a
map. The computer is an ordinary small PC (or an ARM board) running Debian 13 or Ubuntu 24.04.
The installer is the package `open-alert-base`; the program inside is RPi ALERT's signed release,
**unchanged**. Nothing of RPi ALERT is edited in this repository: each build fetches the release,
checks it five ways (the key's fingerprint, the file's hash, its signature, that it holds only
plain files inside one folder, and the version inside), and stops if a check fails.

## The data it handles

| Data | What it is | Sensitivity |
|---|---|---|
| Gauge readings | Rainfall and river levels, with a gauge's number and the time. Public data that flood warnings are made from | Public. Integrity matters more than secrecy: a false reading could mislead a flood warning |
| Every frame heard | What the radio heard, kept briefly and sent so that the quality of reception can be shown | Public in nature; no personal data |
| The base station's own status | Its name, where it is, its host name and board, receiver settings, version, queue length. The check-in can also carry network addresses and operating-system and Node.js versions (RPi ALERT 0.23.1; [U1](../hardware-review/research/U1-rpi-alert-portability.md) 6.3) | Business-internal. The check-in can be switched off: `rpi-alert remote off` |
| The ingest token | A secret that lets this base station post readings to Flood-Net. Kept in `/etc/rpi-alert/config.json`, mode 0600, owned by the service's user. RPi ALERT's own words: "a credential for the whole network's write access" | **Secret.** Not encrypted at rest; no TPM use ([U1](../hardware-review/research/U1-rpi-alert-portability.md) 6.10) |
| The dashboard password | A hash (scrypt) in the same file | Secret |

It holds **no landholder contact details, no personal data about members of the public and no
data from the organisation's own network.** It does not read, route or store any traffic that is
not its own.

## The data flow, in text

```
   flood gauges (field stations, repeaters)
          |  radio (ALERT / ALERT2), one-way: the base station only listens
          v
   antenna --> radio stick (USB) --> [ the base station computer ]
                                       |  open-alert-base service
                                       |  (user rpi-alert, no root helper)
                                       |
                                       |  outbound HTTPS only, through the organisation's
                                       |  web proxy if one is named
                                       v
                          Flood-Net  (floodwarning.net)
                          readings, frames heard, check-in
                          Flood-Net never connects in
```

There is **no inbound path from the internet**. The base station makes calls out; nothing is
listening for a call in except the dashboard (below), which in the enterprise profile answers the
computer itself only.

## What listens on the network

| Listener | Standard profile | Enterprise profile |
|---|---|---|
| The dashboard (the base station's own web page, plain HTTP) | TCP 80, from the local network | TCP 8080, **this computer only**: `web.bind` = `127.0.0.1`, **and** a firewall lock (an nftables table of its own) that refuses the port to everything but the computer itself |
| SSH | Not installed or changed by the package. The operating system's own | Same |
| Wi-Fi hotspot | Off | Off |
| mDNS (`avahi-daemon`) | Not installed by the package | Not installed by the package |
| Flood-Net remote management | Nothing listens; the base station calls out | Same |

Two honest notes. RPi ALERT 0.23.1 does not itself know the setting `web.bind` and opens its
dashboard on every address; today it is the firewall lock that keeps other computers out. The
setting takes effect on its own when the package moves to RPi ALERT 0.24 (not yet released).
And anybody logged in on the computer itself can read and change the agent's settings through
`http://127.0.0.1:8080/` without a password: RPi ALERT treats callers from the computer itself
as administrator. The audit says so.

## What calls out

| To | For | When | Notes |
|---|---|---|---|
| `https://floodwarning.net/api/db/rest/v1`, then a fallback address of the same service | Readings, frames heard, the check-in, asking for a token | Readings every 5 s when there are any; check-in once a minute | Header `X-Ingest-Token`. The host names are in [U1](../hardware-review/research/U1-rpi-alert-portability.md) 6.3; allow them on the proxy |
| `https://floodwarning.net/stations.json`, then a fallback | Station names for the dashboard | Daily | |
| The operating system's package servers | Operating-system and package updates | As the organisation sets | The organisation's own, not the agent's |
| The organisation's time server | The clock | Continuous | The agent holds readings back until it trusts the clock |
| The agent's outage check: TCP to 1.1.1.1, 8.8.8.8 and 9.9.9.9 on 443 | "Is the internet there?" Nothing is sent | Not at all with either profile here, because self-recovery is off. With recovery on (a Raspberry Pi install): only while Flood-Net has not answered for two minutes, every 30 s | RPi ALERT 0.23.1 does not know about proxies for this check ([U1](../hardware-review/research/U1-rpi-alert-portability.md) 6.4). With self-recovery off (both profiles) this check does not run at all: in RPi ALERT 0.23.1 the part that makes it stops before any probe when recovery is off (`agent/lib/keeper.js`, read in the source; not watched on a running computer) |

What the package does **not** have: an updater that calls GitHub (there is no root helper to
run one), a key fetch from GitHub or Flood-Net, a hotspot, a kiosk, a reboot timer.

## What runs as the administrator (root)

- Only at install and removal: the package's own install scripts.
- `open-alert-base-firewall.service`, in the enterprise profile, for a moment at start-up with one
  capability (`CAP_NET_ADMIN`) to load its firewall table.
- Nothing else. The agent runs as `rpi-alert`, a system account with no password and no login
  shell, with `NoNewPrivileges`, no capabilities in the enterprise profile, a read-only disk
  except its two folders, a closed list of devices and a system-call filter. systemd scores it
  **1.7** (enterprise) out of 10, where 0 is most closed ([firmware/README.md](../../firmware/README.md)).

## The profiles, side by side

| | Standard | Enterprise |
|---|---|---|
| For | A small network or a network of its own | Inside a government or corporate network |
| Dashboard reached from | The local network | This computer only |
| What Flood-Net may do | Change radio settings, restart receivers (`manage`) | Be told how the base station is; whatever it asks is refused (`report`). `rpi-alert remote off` stops even that |
| Hotspot, self-reboot, kiosk, audio | Off | Off |
| Capabilities held by the service | One (`CAP_NET_BIND_SERVICE`, for port 80) | None |
