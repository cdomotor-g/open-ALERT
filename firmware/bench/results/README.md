# Benchmark results

Each file here is one computer's result from `../open-alert-bench.js --full --out=FILE`.

## Samples so far

| File | Computer | Honest label |
|---|---|---|
| `2026-11-11-shared-4core-vm.json` | Intel Xeon 2.1 GHz, 4 cores, 16 GB, Ubuntu 24.04, Node 22.23, agent 0.23.1 | A **shared virtual machine** in a cloud sandbox, not a computer you can buy. It was already slightly busy (load 1.4) when the run began. Its figures: 12 channels comfortably, 24 at the very most; about 4.8 Raspberry Pi 4 cores per core (3.6 to 5.3). The ALERT2 headroom rule passes. A Pi 4 reference figure is rough, so read this as a first sample only. |

## What a result you send must contain

1. **A full run, not a quick one** (`"mode": "full"`), made on an otherwise idle
   computer, with `--out`, so the file holds `schema` `open-alert-bench/1`.
2. **A real label** written with `--label`: make, model, processor, memory, and
   anything that affects speed (fanless, power-saving mode, virtual machine,
   cloud, container). Never a person's name or a place.
3. **Which agent.** The file records the agent version and decoder commit by
   itself; do not edit it.
4. **A tidy run:** `errors` empty and `selfCheck.ok` true. If the tool warned that the computer was busy, say what else was running, or run it again.
5. **No private details.** The file holds figures and a description of the
   computer (processor name, cores, memory, system, Node version). It has no
   hostname, address, user name or serial number. Open it in a text editor
   and check before you send it; remove anything that is not wanted.
6. **Better still:** a second run after ten minutes of the first, for a
   fanless or small computer, and the temperature if the computer reports it
   (the tool records it when it can).

Name the file `YYYY-MM-DD-<short-description>.json`, for example
`2026-12-02-minipc-n100-fanless.json`. To send it, open an issue on the
open-ALERT repository and attach the file, or give it to whoever is
sizing your base stations. Do not edit the figures.
