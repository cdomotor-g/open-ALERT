# Security policy

How to report a security flaw in open-ALERT: its site, its catalogue, or the base station
package in [`firmware/`](firmware/README.md).

## Report it privately

Use GitHub's private vulnerability reporting for this repository:

**<https://github.com/cdomotor-g/open-ALERT/security/advisories/new>**

(On the repository: **Security** tab, then **Report a vulnerability**.) Only the project's
maintainers can see a report made this way, and a fix can be prepared before the flaw is public.

Please do not open a public issue, or post details anywhere public, until a fix is out.

A report is most useful with: what you found, which file or version, how to see it, and what
you think could go wrong. Do not include other people's personal details, passwords or tokens;
if a report needs a secret to be shown, say so and it will be arranged another way.

## If the flaw is in RPi ALERT, or in Flood-Net

The base station program is [RPi ALERT](https://github.com/cdomotor-g/RPi_ALERT), which
open-ALERT ships unchanged. A flaw in the program itself should be reported to RPi ALERT, through
the same GitHub route on that repository:

**<https://github.com/cdomotor-g/RPi_ALERT/security/advisories/new>**

If you are not sure which it belongs to, report it here and it will be passed on. Flood-Net, the
web service the readings go to, is run separately from this repository; a flaw in the service
itself is reported through its own repository's security page.

## What to expect

These are a proposal that the project's owner has not yet confirmed: see
[docs/security/support.md](docs/security/support.md) for the numbers. In short: an
acknowledgement within a few working days, a fix or a stated workaround for a serious flaw within
weeks, a published advisory when a fix is out, and credit if you want it.

## What is supported

The latest release of the package and the one before it, for security fixes, once there is a
release. There is no release yet. The support period is in [docs/security/support.md](docs/security/support.md).

## A note for the repository's owner

**Private reporting must be switched on before this page is true.** In the repository on
GitHub: **Settings**, then **Code security** (or **Security** in the sidebar), then
**Private vulnerability reporting**, then **Enable**. Do the same on the RPi ALERT repository.
Until then the links above will not open a form. When it is on, delete this section.

No person's name, e-mail address or telephone number is published here on purpose: reports go
through GitHub, not through one person's inbox.

## Where the security information is kept

[docs/security/](docs/security/README.md): what the base station is, what it handles, who does
what, and the answers to the questions an IT assessor asks.
