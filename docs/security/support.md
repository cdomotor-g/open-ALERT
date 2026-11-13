# Support period

**A PROPOSAL, 11 November 2026. The owner of the project has not confirmed any of this. Do not
quote it to a buyer as a commitment until they have.** It is written so that the owner can say
yes, change the numbers, or say no. Every figure in square brackets is a proposed value, not a
promise.

An assessor asks for a stated support period (one of the three basics for any internet-connected
device, and an ISM question for a supplier). The project has not published one. This is the
draft of what it could say.

## Proposed statement

> **open-ALERT's base station package (`open-alert-base`) is supported as follows.**
>
> - **Which releases get fixes:** the **latest release**, and the **one before it** for security
>   fixes only, for [12] months after the later one came out.
> - **Which operating systems:** Debian 13 and Ubuntu 24.04 LTS, on x86-64 and 64-bit ARM, for as
>   long as their makers support them, and no longer than [five years from the first release].
>   The operating system's own patches are the operating system maker's, not the project's.
> - **How fast:** a flaw rated critical or high is acknowledged within [5] working days and a
>   fixed package is published within [30] days, or a stated workaround is given sooner.
> - **Following RPi ALERT:** when RPi ALERT publishes a signed release that fixes a security flaw,
>   a new package built from it is published within [14] days.
> - **How a fix arrives:** as a new version of the package and a security advisory on GitHub. The
>   package has no self-updater; the organisation installs it.
> - **End of support:** announced at least [6] months before, on the releases page and in the
>   advisories.

## What has to be true before the owner can say this

| Needed | State today |
|---|---|
| A first release of the package | **Not yet.** No release exists (<https://github.com/cdomotor-g/open-ALERT/releases>) |
| A place the package is downloaded from and its signature | **Not yet** |
| A package repository, so that `apt` brings updates | **Not yet.** Updates would be a download and an install |
| Private flaw reporting switched on in the repository | **Not yet**, until the owner switches it on in the repository's settings ([SECURITY.md](../../SECURITY.md)) |
| Someone to read reports and build fixes within the days above | **The owner to confirm** who and how many hours. The project is small; the proposed days may be too short |
| A real radio stick run on a computer that is not a Raspberry Pi, and an ARM computer run | **Not yet** ([firmware/README.md](../../firmware/README.md)) |
| RPi ALERT's own support period | Not stated by RPi ALERT either (none was found); the two should be stated together |

## The computers' own support periods (for comparison, from the review)

These are the makers' statements as the review recorded them, not the project's:

| Computer | What the maker states |
|---|---|
| Toradex Verdin AM62 | Supply promised to 2033 ([R1](../hardware-review/research/R1-toradex-verdin-mallow.md)) |
| Toradex Verdin iMX95 on a Mallow carrier | Supply promised to 2039 for the module and to 2034 for the Mallow carrier ([R1](../hardware-review/research/R1-toradex-verdin-mallow.md)) |
| Toradex Luna SL1680 | A five-year commitment ([R2](../hardware-review/research/R2-toradex-luna-sl1680.md)) |
| Moxa UC-4400A with Moxa Industrial Linux 4 Secure | Operating system patched to 2035; five-year warranty ([R6](../hardware-review/research/R6-industrial-arm-gateways.md), [R4](../hardware-review/research/R4-au-gov-it-security.md)) |
| N150-class PCs | Not read for the first-choice models, other than warranty options (CL260 five years, ThinkEdge three years on site, Protectli two years). Ask the seller ([R7](../hardware-review/research/R7-x86-boxes.md)) |

A computer's support period and the package's are independent: the organisation should plan to
replace the first before it ends, whatever the second says.
