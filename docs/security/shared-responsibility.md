# Who does what

**Draft, 11 November 2026.** Three parties are involved: **the project** (open-ALERT, which
makes the package, and RPi ALERT, which makes the program inside it), **the organisation running
the base station** (a water authority, council, agency or contractor), and **Flood-Net** (the web
service the readings go to). A control with no named owner is a control nobody does, so each
line below names one. Where the project has not yet done its part, the table says so.

| Thing to be done | The project | The organisation running it | Flood-Net |
|---|---|---|---|
| **Choose and buy the computer** | Gives the [review](../hardware-review/README.md) and its reasons | Decides, buys, owns it and keeps its asset record | |
| **Install the operating system** (Debian 13 or Ubuntu 24.04) | Says which are targeted | Installs, hardens to its own benchmark, joins it to its own management and scanning tools | |
| **Patch the operating system**, Node.js, `rtl-sdr`, `undici` | Nothing: these come from the operating system's own packages, by design | **Does this.** Debian or Ubuntu, or a paid long-term service, issues the fixes; the organisation applies them | On Ubuntu 24.04, Node.js and `rtl-sdr` come from Ubuntu's "universe" section, which Canonical patches only under its paid Ubuntu Pro service. On Debian 13 they are covered by Debian's security team to August 2028 ([R3](../hardware-review/research/R3-os-firmware-strategy.md)) |
| **Patch the agent** (RPi ALERT) | Builds a new `open-alert-base` version from each new signed RPi ALERT release | Installs the new package version when it arrives (there is no self-updater) | |
| **Sign and check releases** | RPi ALERT signs its release in GitHub Actions; open-ALERT's build checks that signature and refuses anything else. The package itself is **not yet signed** (no release has been made) | Checks the package's signature once there is one; can run `open-alert-base audit` any time to compare every agent file with the signed release | |
| **Choose the profile** | Offers `standard` and `enterprise` | Picks one (enterprise for a managed network), and changes settings only through `open-alert-base profile` or the agent's own settings | |
| **Accounts and SSH** | Installs no maintenance account, no sudo rule and no key fetch | Owns every login, key and sudo rule on the computer | |
| **Firewall and network placement** | Provides a firewall lock for the dashboard's port, in a table of its own | Owns the host firewall and where the computer sits (its own mobile link, a screened zone, or the inside network) and what the web proxy allows out | Needs outbound HTTPS to be reachable |
| **Web proxy and private certificate authority** | Supports both (see `firmware/README.md`) | Names the proxy in `/etc/open-alert-base/env`; installs its private authority into the operating system's store | |
| **Time** | Holds readings back until the clock is trusted | Points the operating system at the organisation's own time server | |
| **Logs** | The agent writes to the journal; it logs settings changes, every Flood-Net request and power or update actions; **it does not log dashboard logins** (RPi ALERT 0.23.1: not yet) | Forwards the journal to its own collector and decides how long to keep it | Keeps its own record of check-ins |
| **The ingest token** (the secret that lets this base station post readings) | Stores it with mode 0600 for the service's user only | Keeps it out of tickets and e-mail; asks for a new one if it leaks | **Issues, approves and revokes tokens.** Can refuse a base station |
| **What is sent to Flood-Net** | Documents it ([overview.md](overview.md)) | Decides whether the base station reports at all (`rpi-alert remote off`) | Receives it; keeps public readings; says what it keeps and for how long on its own pages |
| **Receive and fix flaws** | Takes private reports ([SECURITY.md](../../SECURITY.md)), fixes, publishes an advisory | Applies the fix; tells the project if it finds one | Fixes its own service; takes reports through its own route |
| **Support period** | States one ([support.md](support.md), a proposal) | Plans to replace the computer and the operating system before their own end dates | |
| **Hardware faults, warranty, spares** | Nothing: the project sells no hardware | The organisation and the maker or seller | |
| **Radio licensing and the antenna** | Nothing | The organisation. (A transmitter on an ALERT channel needs compliant equipment and an ACMA apparatus licence, normally held by the network owner: see the repository's README. Not legal advice.) | |

## In plain words

- **The project owns the software it ships and the honesty of what it says about it.** It does
  not own your operating system, your network or your computer.
- **The organisation owns the computer.** Everything an IT department normally does for a server,
  it does for this one. The package is built so that this is true: it adds no accounts, no
  remote hand-holds and no updater of its own.
- **Flood-Net owns the receiving end**: which base stations may post, and what happens to the
  readings.

Note that the open-ALERT, RPi ALERT and Flood-Net repositories sit under the same GitHub
account. A reviewer who wants each relationship written down separately should ask for it.
