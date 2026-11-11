# firmware — RPi ALERT on computers that are not a Raspberry Pi

**Work in progress, 11 November 2026. Not finished, not reviewed, not released.**

This folder takes a signed release of [RPi ALERT](https://github.com/cdomotor-g/RPi_ALERT)
*unchanged* and packages it for any Debian 13 or Ubuntu 24.04 computer, whether an ordinary
64-bit PC or a 64-bit ARM board. Why, and what else is planned, is in the
[hardware review](../docs/hardware-review/README.md).

## What is here

| Path | What it is |
|---|---|
| `PIN` | The RPi ALERT release this layer ships: its tag, download address, hash and signing-key fingerprint |
| `keys/` | RPi ALERT's public release key |
| `lib/fetch-agent.sh` | Gets the pinned release, checks its hash and its signature, and only then unpacks it |
| `deb/` | Builds the package `open-alert-base`: the agent, a locked-down service, two settings profiles (standard and enterprise), web-proxy support |
| `bench/` | A benchmark: how fast this computer decodes, set against a Raspberry Pi 4 |

Build the package (needs `dpkg-deb`, `openssl` or `node`):

```
firmware/deb/build-deb.sh          # → dist/open-alert-base_0.23.1+oa1_all.deb
```

## What has been tried, and where

| Check | Result |
|---|---|
| The release's hash and signature are checked; a tampered file is refused | Passed, 11 Nov 2026 |
| The package builds | Passed: 2.4 MB |
| It installs on Ubuntu 24.04 (an ordinary PC processor) with the system's own Node.js 18 | Passed, once, by hand |
| The agent starts as its own unprivileged user from the installed package and writes its log | Passed, once, by hand |
| The package's own tests (`test/`), Debian 13, Debian 12 | **Not written or not run** |
| The service's lock-down settings under a real system start-up | **Not run** |
| The benchmark and its test | **Not run since it was written** |
| A real radio stick on a computer that is not a Raspberry Pi | **Not tested** |
| Any ARM computer | **Not tested** |

## Known to be unfinished

- The standard profile asks for the dashboard on port 80, but the service is given no
  permission to use a port below 1024, so the agent falls back to port 8080. One of the two
  has to change.
- No container, no disk image, no automatic build yet.
- No review of any of it.
