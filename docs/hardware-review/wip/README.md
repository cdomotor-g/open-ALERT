# Unfinished work, saved so a pause cannot lose it

Saved 14 November 2026. Nothing here is applied, tested to the end or reviewed. Do not use it as it stands.

| File | What it is | Where it belongs |
|---|---|---|
| `open-alert-firmware-image-and-ci.patch` | The ready-to-flash disk image (build and boot test), its notes, and the automatic build file `.github/workflows/firmware.yml`. The build file has never run. | This repository (`git apply` from the top folder) |
| `rpi-alert-0.24-managed-network.patch` | RPi ALERT 0.24.0: the settings for managed networks. Not finished, not security-reviewed, not released. | `cdomotor-g/RPi_ALERT`, on top of v0.23.1 |

The automatic build file is kept here, not in `.github/workflows/`, so that it does not start running before it has been checked.
