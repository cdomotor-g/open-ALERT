# U3 — How the open-ALERT site is put together, and every claim the Mallow trial rests on

Read-only study of `/home/user/open-ALERT` (branch `main`, commit `c467016`, 8 November 2026; `npm test`: 41 of 41 pass). No web was used. Where a claim cites RPi ALERT or Flood-Net, the cited file was opened in the local checkouts (`/home/user/RPi_ALERT`, now 0.23.1; `/home/user/MegaNet`) to see whether it says what the claim says.

**How to read the references.** `file:line` is a line in the repository at that commit. Each is browsable as
`https://github.com/cdomotor-g/open-ALERT/blob/main/<file>#L<line>` (for example `site/js/trial.js:24` is <https://github.com/cdomotor-g/open-ALERT/blob/main/site/js/trial.js#L24>). In Part B the "Rests on" column gives the outside address the repository itself cites for that claim, or says that it cites none.

**Words used here.** *Catalogue* = the 252 part records in `site/data/*.js`. *Builder* = `site/build.html`. *Trial* = `site/trial.html`. *sdrCh* = the number each computer record carries for decoding power (a Raspberry Pi 4 is 8). *conf* = how sure a record says it is (`high`, `medium`, `low`).

---

## The findings that should change a decision

1. **The "an AM62 is half a Pi 4" figure is not a measurement, and its two sources cite each other.** open-ALERT says the Pi 3B+ "is half a Pi 4 in RPi ALERT's notes" (`site/js/trial.js:65-67`). RPi ALERT's notes say their small-computer table comes "from the base-station builder's model … an A53 core at 1.4 GHz about half an A72's" (`RPi_ALERT/docs/hardware.md:210-211`). Nobody has run the decoder on a Cortex-A53. Every Verdin percentage on both pages follows from this one guess.
2. **On the repository's own numbers the Verdin AM62 Quad is under-specced for the stated goal.** It is rated 2 "Pi 4 cores" against a Pi 4's 4 (`site/data/compute.js:155`, `site/js/builder.js:93`). Eight channels in heavy traffic on today's default decoder come to 95% of it (model run, below); a Pi 4 does the same at 47%.
3. **The element14 listing that carries the trial's price and stock looks like a different product.** Its address reads `…/toradex/761200/com-2ghz-32gb-arm-cortex-a72-r5f/dp/4852670` (`site/js/trial.js:25`, `site/data/compute.js:151`): a 2 GHz Cortex-A72 / R5F module with 32 GB is an Aquila AM69's description, not a Verdin AM62's (Cortex-A53 / M4F, 1.4 GHz). The page itself admits the listing "is titled Aquila AM69" (`site/js/trial.js:24`, `:69`) and that it was never re-checked (`:23`), yet marks it `conf: 'high'` (`:25`). A$566 of the trial's A$1,270–1,570 rests on it.
4. **"Toradex direct is a third of the price" contradicts a figure in the same record.** Module US$107.40 + Mallow US$107.50 = US$214.90, but Toradex's own ready-fitted pair is quoted at US$378.50 (`site/data/compute.js:151`). element14 sells Mallow at about Toradex's price (A$165.74 against A$155.80) but every module at 2.7–3.3 times. The likely reading: US$107.40 is a volume price, not what one costs.
5. **The software route is untested and is the wrong shape for an IT security review.** Torizon OS, then RPi ALERT in a Debian container run `--privileged --network host` as root, built from an unpinned `git clone` of `main` (`site/trial.html:150-166`). The page says "This has not been done before" (`:149`) and that updates from Flood-Net, the hotspot and the screen will not work in it (`:174`).
6. **Nothing in the repository argues IT security approval.** The whole case is "industrial silicon … no Raspberry Pi stigma" (`site/data/compute.js:160`) and "Most of a Pi's bad name comes from SD cards, plug-pack supplies and sticks hanging off USB ports" (`site/build.html:156`). No source, no checklist, no mention of patching, signed boot, default passwords or an on-board Wi-Fi radio. The Verdin and Mallow records list CE and FCC only, no RCM (`compute.js:153`); the Luna lists no approvals at all.
7. **The decoder modes that make small computers fit are off by default and failed their first live check.** "Around bursts" (0.18) "misses some of the weakest bursts" (`site/data/builder.js:122`); RPi ALERT 0.23.1 still ships `decoder: 'lean'`, `watch: 'always'` (`RPi_ALERT/agent/lib/config.js:137,145`). The trial page still describes that mode as passing every test (`site/trial.html:111`).
8. **The CPU model has no ALERT2 term.** `load()` counts ALERT1 work only (`site/js/builder.js:77-91`). "Headroom for ALERT2" cannot be read off any number in the repository.
9. **The Luna SL1680's rating is clock arithmetic** (2.1 ÷ 1.8 × 8 ≈ 9; `compute.js:192`), on a preliminary datasheet, closed hardware, no stated product life, no Australian stock. A test forces the record to stay `conf: 'low'` and between a Pi 4 and a Pi 5 (`test/trial.test.js:81-83`).
10. **Adding to the site is cheap.** A new computer is one catalogue record plus one builder entry plus four count edits; a new page is one HTML file, a nav link in three pages, two forwarding stubs and three test lists (Part A, section A9). The builder already has a plain-Debian install route (`install: 'debian'`, `site/js/builder.js:246`) used by its two x86 entries.

Model run used above (the builder's own functions, default decoders, `node` against the repository; percent of each computer's CPU):

| Plan | Decoder | Pi 4 | AM62 Quad | AM62 Dual | Luna (est.) | Pi 5 / CM5 | N150 mini PC | Fanless x86 |
|---|---|---|---|---|---|---|---|---|
| 4 channels, busy | Lean (today's default) | 17% | 34% | 67% | 15% | 8% | 6% | 7% |
| 4 channels, heavy | Lean | 24% | 47% | 95% | 21% | 12% | 8% | 9% |
| 8 channels on 2 sticks, heavy | Lean | 38% | 75% | 151% | 33% | 19% | 13% | 15% |
| 8 channels on 1 stick, heavy | Lean | 47% | 95% | 189% | 42% | 24% | 16% | 19% |
| 8 channels on 1 stick, heavy | Full (pre-0.17) | 99% | 199% | 398% | 88% | 50% | 33% | 40% |

Source: `site/js/builder.js:77-99`, `site/data/builder.js:76-125`. The builder calls over 70% "at the edge" and over 100% "overloaded".

---

# Part A — a builder's guide to adding to the site

## A1. The map

| What | File | Notes |
|---|---|---|
| Configurator page | `site/index.html` (145 lines) | Four views in one page, switched by `#configure`, `#network`, `#catalogue`, `#about` (`site/js/ui.js:140-145`, `:876-883`). |
| Base station builder | `site/build.html` (187) | Logic `site/js/builder.js` (601), data `site/data/builder.js` (360), styles `site/build.css` (223). |
| Mallow trial | `site/trial.html` (256) | Logic and data together in `site/js/trial.js` (339); styles are the tail of `site/build.css` (`:163-223`). |
| Catalogue | `site/data/alert.js` (24 parts), `compute.js` (46), `radio.js` (52), `sensors.js` (36), `power.js` (39), `site.js` (55) | 252 in all. Each file ends by pushing its `items` onto `globalThis.OA_CATALOG`, or exporting them under Node (`site/data/compute.js:742-743`). |
| Rules engine | `site/js/engine.js` (1,843) | Categories `:50-103`, slots `:346-410`, host fit `:852-869`, supporting parts `:1148-1168`, delivery `:1399-1443`. |
| Presets | `site/js/presets.js` | 22 preset sites, 5 example networks. |
| Shared styles | `site/style.css` (569) | Tokens, dark mode, header, nav, chips, tables, diagrams, print. |
| Tests | `test/engine.test.js`, `builder.test.js`, `trial.test.js`, `app.test.js` | `npm test` = `node --test test/*.test.js` (`package.json:8`). No dependencies. |
| App files | `site/sw.js`, `site/manifest.webmanifest`, `site/icons/*`, `site/icon.svg` | |
| Forwarding stubs | `index.html`, `build.html`, `trial.html` at the top; `site/site/index.html`, `build.html`, `trial.html` | Old addresses. |
| Publishing | `.github/workflows/pages.yml`, `test.yml`, `atlas.yml` | |
| Map of repositories | `atlas.json` | Counts and component lists repeated here. |

There is no build step. Every page loads plain `<script>` files in order.

## A2. The catalogue record

### Fields

Described in the headers of `site/data/alert.js:1-14` (shared) and `site/data/compute.js:1-18` (computers), and in `README.md:146-171`. A computer record, as the existing ones are written (`site/data/compute.js:147-164`):

| Field | Meaning | Used by |
|---|---|---|
| `id` | lower-case letters, digits and hyphens; unique | everything |
| `name`, `vendor`, `blurb` | text a person reads | catalogue cards |
| `cat` | a key of `CATS` (`engine.js:49-102`): for computers `sbc`, `ind-sbc`, `ind-pc`, `mini-pc`, `pc`, `mcu`, `datalogger`, `open-logger` | the catalogue's group and label |
| `slots` | where it goes, as `role:slot` — a base computer is `'base:host'`; add `'repeater:repeater'` for a home-made repeater | `engine.js:346-410` |
| `can` | what it can do, from a fixed list (rule 9 below); a computer has `['logger']` | fit rules |
| `price` | `{ aud, gst, basis, src, url, asof, shop, from, stock, ship }` — see A8 | bills, delivery |
| `power` | `{ w, peakW, supply }`; `supply` is `'5V'`, `'12V'`, `'wide'` or `'mains'` (capital V here) | `engine.js:1156-1163`: a `'5V'` host on a 12 V site gets a converter, a `'wide'` or `'12V'` host on mains gets a supply |
| `temp` | `[min, max]` °C, or `null` | checked against where the site lives |
| `grade`, `gradeWhy` | 1 hobby … 5 proven in the field | "industrial" needs 4 |
| `support` | `vendor`, `community`, `limited`, `agency`, `none` | |
| `certs` | list of approvals, free text (`['CE', 'FCC', 'RCM']`) | shown only |
| `io` | `{ usb, eth, gpio, wifi, rs232, rs485, can }` | `io.usb` against the number of USB receivers (`engine.js:867-868`) |
| `hw.os` | list of operating-system keys. RPi ALERT's record says which it runs on: `pi-os`, `pi-os-cm`, `debian-arm64`, `debian-amd64`, `debian-armhf` (`site/data/alert.js:267`). A key not in that map makes the engine say "does not run on it" (`engine.js:707-718`, `:853-857`) | software fit |
| `hw.sdrCh` | decoding power; a Pi 4 is 8. 0 or missing = "too slow to decode an SDR" (`engine.js:861-862`) | engine, builder, trial |
| `hw.cpu`, `hw.ram` | text, and GB | the trial's table needs both (`test/trial.test.js:73`) |
| `hw.rtc`, `hw.wdog`, `hw.kiosk`, `hw.audioJack`, `hw.bare`, `hw.din` | battery clock, watchdog, enough memory for the screen dashboard, 3.5 mm jack, bare board (a case is added), DIN rail | `engine.js:865-866`, `:1165` |
| `hw.storage` | `sd`, `emmc`, `ssd`, `nvme`, `flash` — `sd` adds a boot card and a warning | `engine.js:1164`, `:1655-1658` |
| `open` | `{ hw, sw, lic }`, each of `open`, `partial`, `closed` | "open source only" rule |
| `life`, `lifeYears` | text, and years for whole-of-life cost | |
| `fw` | `{ name, lic, url, note }` | item dialog |
| `skills` | `linux`, `electronics`, `firmware`, `logger`, `rf`, `server` (`engine.js:106-113`) | |
| `status` | `current`, `beta`, `eol`, `planned`, `discontinued`, `diy`, `existing` | |
| `pros`, `cons`, `src` | lists; `src` is `[[title, url], …]` | all three are required |
| `conf` | `high`, `medium`, `low` | |
| `tags` | free tags: `linux` (it is a host), `pi` (switches on Pi-only rules: clock, `engine.js:1166`), `pi4`, `pi5`, `cm`, `industrial`, `x86`, `mcu` | |
| `def` | `true` puts it first among equals (`engine.js:1230`, `:1714`) | |

### Every rule the tests enforce on a record

| # | Rule | Where |
|---|---|---|
| 1 | The catalogue has more than 200 parts | `test/engine.test.js:41` |
| 2 | `id` matches `^[a-z0-9][a-z0-9-]*$` and is not repeated | `:45-47` |
| 3 | `name`, `vendor`, `blurb` are strings; `name` longer than 2 | `:48-49` |
| 4 | `cat` is a key of the engine's `CATS` | `:50` |
| 5 | `grade` is a whole number 1–5 | `:51` |
| 6 | `status` is one of `current`, `beta`, `eol`, `planned`, `discontinued`, `diy`, `existing` | `:52` (list `:33`) |
| 7 | `conf` is `high`, `medium` or `low` | `:53` |
| 8 | `price` exists; `price.basis` is one of `retail`, `list`, `estimate`, `quote`, `tender`, `used`, `free`, `existing`; `price.aud` is `null` or a number ≥ 0; **a blank price is a quote and a quote is a blank price** | `:54-56` (list `:34`) |
| 9 | Every `can` entry is one of `a1-tx`, `a2-tx`, `a1-rx`, `a2-rx`, `a1-iq`, `a1-audio`, `a1-repeat`, `a2-repeat`, `a1-conc`, `radio`, `gps-int`, `logger`, `batt-v`, `ip`, `multi-ch` | `:59` (list `:38`) |
| 10 | `support`, if given, is `vendor`, `community`, `limited`, `agency` or `none` | `:57` (list `:35`) |
| 11 | `open.sw` and `open.hw`, if not null, are `open`, `partial` or `closed` | `:58` |
| 12 | `temp`, if given, is two numbers with the first below the second | `:60-63` |
| 13 | `lifeYears`, if given, is above 0 | `:64` |
| 14 | `pros`, `cons` and `src` are lists (all three must be present) | `:65` |
| 15 | Each `src` entry is `[text, address]` and the address starts `http://` or `https://` | `:66-69` |
| 16 | `power.w`, `txW`, `rxW`, `peakW`, if given, are ≥ 0 | `:70` |
| 17 | `price.ship` is a number ≥ 0; `price.from` is two capital letters; `price.stock` is `in`, `back`, `out`, `order` or `unknown`; `price.shop` is a string | `:73-76` (list `:37`) |
| 18 | A `retail` price with a delivery charge says where it ships from | `:77` |
| 19 | Every `slots`, `covers`, `frees` entry names a real `role:slot` | `:109-112` |
| 20 | Every `reads` is offered by some part's `links`; every `radios` / `hosts` tag is carried by some part; every `hw.for` names a tag or a role; `successor` is a string | `:113-116` |
| 21 | Every slot has at least one candidate, every supporting-part group at least one option | `:120-132` |
| 22 | Every preset's picks exist and go in the slot they are picked for; each preset has a hardware cost | `:169-183` |
| 23 | Presets built only from buyable parts (not `planned`, `diy`, `discontinued`) meet every must, and there are at least 14 of them | `:185-199` (list `:29`) |
| 24 | Each bill charges a shop's delivery once; clearance only on an overseas order over the threshold | `:81-102` |
| 25 | Each computer the trial compares has `hw.sdrCh` > 0, `hw.cpu`, `hw.ram`, a `temp` pair and a numeric `price.aud` | `test/trial.test.js:70-77` |
| 26 | The trial's table must include `toradex-luna-sl1680`, `rpi-zero-2w`, `rpi-3b-plus`, `rpi-4-4gb`, `rpi-5-4gb`, `rpi-cm4-io`, `rpi-cm5-io` | `test/trial.test.js:78` |
| 27 | **The Luna's `sdrCh` must be above the Pi 4's and below the Pi 5's, and its `conf` must be `low`** | `test/trial.test.js:81-83` |
| 28 | Each builder computer's catalogue record has `hw.sdrCh` > 0 | `test/builder.test.js:36-37` |
| 29 | `rpi-4-4gb` must come to exactly 4 Pi 4 cores (so `sdrCh` 8) | `test/builder.test.js:86-88` |
| 30 | `toradex-verdin-am62-mallow`: eight channels, heavy, full decoder must be over 100%; lean must be less; around-bursts less than half | `test/builder.test.js:100-104` |
| 31 | Syntax: every `site/js/*.js`, `site/data/*.js`, `test/*.js` passes `node --check` on Node 18, 20 and 22 | `.github/workflows/test.yml:17,24` |

Rules 27, 29 and 30 mean a measured figure for the Luna, the Pi 4 or the AM62 may need the test changed with it.

## A3. The builder: a computer entry, capacity, the functions

### A platform entry (`site/data/builder.js:141-223`)

```js
{
  id: 'my-box', ref: 'my-box',            // ref = the catalogue record's id
  short: 'My box', kind: 'box',           // 'board' | 'module' | 'box'
  aud: [900, 1200], gst: false,           // low–high for one; gst false = ex GST
  lead: { d: [5, 14], text: 'why' },      // days, min–max
  where: [['Shop name', 'https://…']],    // the FIRST shop is the one delivery is charged from
  supply: 'wide',                         // '5v' | '5v5a' | 'wide' | '24v' | 'mains'
  usb: 4, m2: false, eth: 2, wifi: false, // m2: false | 'hat' | 'nvme' | 'b-key'
  board: [170, 120],                      // mm, for the drawing
  install: 'debian',                      // 'pi' | 'cm' | 'verdin' | 'luna' | 'debian'
  parts: 'order text',                    // optional: shown as "Order: …"
  fit: 'one or two sentences',            // shown under the computer cards
  src: [['title', 'https://…']], conf: 'medium',
}
```

Rules on every builder option (`test/builder.test.js:20-34`): an `id` or `ref`; `ref` exists in the catalogue; `aud` is a two-number low–high pair (or `[null, null]`); `gst` true or false; `lead.d` a min–max pair and `lead.text` a string; `where` a list; every address in `where` and `src` starts `http`; `conf` one of three; **a priced option with no `src` and no `ref` must be `conf: 'low'`** (`:33`). For a platform also: `install` is one of the five routes (`:38`).

Things the tests do not say but the code needs:

- `install` picks the flashing steps from a fixed map (`site/js/builder.js:241-247`). A new route must be added both there and to the list in `test/builder.test.js:38`, or the page throws.
- `supply` drives the power line (`site/js/builder.js:154-163`) and the drawing (`:420`).
- `m2` must be exactly `'b-key'` for a slot that carries USB. Any other value must be `false`, `'hat'` or `'nvme'`: the test expects a "Problem" for every platform whose `m2` is not `'b-key'` (`test/builder.test.js:122`), and the code raises one only for those three (`site/js/builder.js:138`).
- `where[0][0]` should start with a name in `B.shops` (`site/data/builder.js:45-72`; matched at `site/js/builder.js:204`), otherwise the bill says "Delivery not counted from …" (`:188`). A new shop needs `ship: [small, large]`, `from` (two letters), optional `freeOver`, `ddp`, `src`, and `conf: 'low'` if `src` is empty (`test/builder.test.js:42-50`).
- The first platform's `lead` is reused for the boot-card line (`site/js/builder.js:129`): keep the Pi 4 first.
- `mainsNote` and `mainsAud` (optional) replace the mains line (`:155`), as the Luna does (`site/data/builder.js:203`).
- The catalogue record's `temp[1]` is checked against the enclosure's `temp` (`site/js/builder.js:174-175`), and `hw.ram` against memory (`:181`).

### From `hw.sdrCh` to capacity

- `capacity(p)` = the catalogue record's `hw.sdrCh ÷ 2`, in "Pi 4 cores" (`site/js/builder.js:93`). A Pi 4 is 8 ÷ 2 = 4.
- `load(plan, o)` adds up the work, also in Pi 4 cores (`:77-91`). For each channel on each stick:
  - between bursts: `chCore240 × (window.rel × decoder.cont + decoder.contBase)`, with `chCore240` = 0.04 (`site/data/builder.js:97`) and `window.rel` from 1 (240 kHz) to 6.3 (2.4 MHz) (`:84-91`);
  - bursts: `bursts a minute ÷ 60 × (burstCoreS × decoder.burst + decoder.burstFilterS × chCore240 × window.rel)`, with `burstCoreS` = 1.0 (`:98`);
  - plus the screen: `kioskCore` = 0.5 (`:99`) if `o.kiosk`.
- Use = `load.total ÷ capacity`. `verdict(use)`: up to 50% "Plenty of headroom" (`ok`), up to 70% "Comfortable" (`ok`), up to 100% "At the edge" (`warn`), over "Overloaded" (`bad`) (`site/js/builder.js:94-99`; the 70% is `model.safe`, `site/data/builder.js:100`).

### The functions (`site/js/builder.js:279-281`)

Under Node: `const K = require('site/js/builder.js'); K.setCatalog(CATALOG)`. In a page: `globalThis.OA_BUILD_API` (after `data/*.js`, `data/builder.js` and `js/builder.js` have loaded). If the page has no element with id `controls`, `builder.js` stops after publishing the functions (`:282`) — that is how the trial page uses it.

| Function | Takes | Gives | Line |
|---|---|---|---|
| `setCatalog(list)` | the catalogue array | — (Node only) | `:15` |
| `windowFor(spanMhz)` | the spread of a stick's channels, MHz | the narrowest window `{ khz, holds, rel }`, or `null` | `:20-23` |
| `splitInto(freqs, k)` | channels in MHz, a number of sticks | `[{ chans, window }]` for exactly `k` sticks at least work, or `null` | `:31-59` |
| `planSticks(freqs, sticks)` | channels; `'auto'` or 1–4 | `{ sticks: [{ chans, window }], k, minK, capped }`, or `{ sticks: null, error }` if more than four sticks are needed. At most 8 channels a stick | `:61-69` |
| `load(plan, o)` | a plan; `o = { decoder, traffic, kiosk }` — `decoder` one of `today`, `filter-once` (the default), `lean`, `light`; `traffic` one of `quiet` (2 bursts a minute a channel), `busy` (8), `heavy` (20) | `{ cont, burst, kiosk, total, channels, memMb }` in Pi 4 cores | `:77-91` |
| `capacity(p)` | anything with a `ref` to a catalogue record | Pi 4 cores | `:93` |
| `verdict(use)` | load ÷ capacity | `{ cls: 'ok' or 'warn' or 'bad', text }` | `:94-99` |
| `build(S)` | the whole set of choices (`DEFAULT` at `:297-301`) | `{ rows, total, longest, likely, warn, steps, load, cap, use, verdict, plan, … }` | `:110-197` |
| `TRAFFIC` | — | `{ quiet: 2, busy: 8, heavy: 20 }` | `:75` |
| `B` | — | the data file | |

### The decoders list (`site/data/builder.js:116-125`)

| `id` | Short name | `cont` | `contBase` | `burst` | `burstFilterS` | `status` |
|---|---|---|---|---|---|---|
| `today` | Full decoder (0.15–0.16) | 1 | — | 1 | — | current |
| `filter-once` | Lean (0.17) — the default | 0.75 | — | 0.34 | — | current |
| `lean` | Around bursts (0.18) | 0.02 | 0.18 | 0.34 | 1.3 | checking |
| `light` | Light, around bursts (0.19) | 0.02 | 0.18 | 0.18 | 1.3 | checking |

The ids do not match their short names: `lean` is "around bursts", and "Lean" is `filter-once`. The comparison chart styles exactly four decoders (`site/build.css:80`, `:94` — `d0` to `d3`); a fifth needs a style.

## A4. The page skeleton

All three pages share this (compare `site/build.html:1-46`, `site/trial.html:1-46`, `site/index.html:1-45`):

```html
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<title>Page name · open-ALERT</title>
<meta name="description" content="…">
<link rel="icon" href="icon.svg" type="image/svg+xml">
<link rel="manifest" href="manifest.webmanifest">                     <!-- tested -->
<link rel="apple-touch-icon" href="icons/apple-touch-icon.png">       <!-- tested -->
<meta name="theme-color" content="#0e3b5c">                            <!-- tested -->
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="open-ALERT">
<link rel="stylesheet" href="style.css">
<link rel="stylesheet" href="build.css">   <!-- builder and trial only -->
</head>
<body>
<a class="skip" href="#main">Skip to the page</a>
<header class="hero">
  <div class="wrap hero-in">
    <img src="icon.svg" width="52" height="52" alt="">
    <div class="hero-text">
      <h1>open-ALERT <span>page name</span></h1>
      <p>One paragraph on what the page is for.</p>
    </div>
    <button type="button" class="ghost theme-btn" data-act="theme" aria-label="Colour theme" title="Colour theme"><span id="theme-label">Auto</span></button>
  </div>
  <nav class="wrap sitenav" aria-label="open-ALERT pages">
    <div class="nav-group"><span class="nav-h">Plan</span>
      <a class="nav-link" href="./#configure"><b>Sites</b><span>configure each site</span></a>
      <a class="nav-link" href="./#network"><b>Network</b><span>add them up, check they meet</span></a>
      <a class="nav-link" href="./#catalogue"><b>Parts</b><span>the hardware catalogue</span></a>
    </div>
    <div class="nav-group"><span class="nav-h">Build</span>
      <a class="nav-link" href="build.html"><b>Base station</b><span>builder, costs, steps</span></a>
      <a class="nav-link" href="trial.html"><b>Mallow trial</b><span>beside the Pi</span></a>
    </div>
    <div class="nav-group"><span class="nav-h">Learn</span>
      <a class="nav-link" href="./#about"><b>How it works</b><span>ALERT, the numbers, the law</span></a>
    </div>
  </nav>
</header>

<main id="main" class="wrap">
  <nav class="onpage" aria-label="On this page"><span class="dim small">On this page</span> <a href="#one">One</a> <a href="#two">Two</a></nav>
  <section class="sect" id="one"><h2>…</h2><p class="lead">…</p></section>
</main>

<div id="toast" role="status" aria-live="polite"></div>
<footer class="wrap small dim">
  <p>open-ALERT · MIT licence · <a href="https://github.com/cdomotor-g/open-ALERT" target="_blank" rel="noopener">source on GitHub</a> · prices indicative, November 2026 · a plan to start from, not an endorsement.</p>
</footer>

<script src="data/alert.js"></script>
<script src="data/compute.js"></script>
<script src="data/radio.js"></script>
<script src="data/sensors.js"></script>
<script src="data/power.js"></script>
<script src="data/site.js"></script>
<script src="data/builder.js"></script>
<script src="js/builder.js"></script>
<script src="js/mypage.js"></script>
<script>if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});</script>
</body>
</html>
```

What is checked:

- The menu must match `<nav class="wrap sitenav" … </nav>`, hold links ending `#configure`, `#network`, `#catalogue`, `build.html`, `trial.html`, `#about`, and carry `aria-current="page"` exactly once (`test/trial.test.js:38-50`). On the configurator the links are `#configure` and so on with ids `tab-configure`…, and `ui.js` moves `aria-current` (`site/index.html:31-40`, `site/js/ui.js:144`). On other pages they are `./#configure`.
- The manifest link, the iPhone icon link, a `theme-color` meta and `serviceWorker.register('sw.js')` must be in each page, written exactly so (`test/app.test.js:34-45`).
- The page text must not say "MegaNet" except inside `github.com/cdomotor-g/MegaNet` (`test/trial.test.js:48`; `test/builder.test.js:128-133` for `build.html`, `js/builder.js`, `data/builder.js`).

**The theme switch.** The button is `data-act="theme"` with a `#theme-label` span. Each page's script carries its own copy of the same two functions: `applyTheme` sets or removes `data-theme` on `<html>` and labels the button Auto / Light / Dark; `cycleTheme` steps auto → light → dark → auto and keeps the choice in `localStorage` under `open-alert:theme` (`site/js/ui.js:860-874`, `site/js/builder.js:555-567`, `site/js/trial.js:325-337`). A new page needs its own copy and a click handler for `[data-act="theme"]`: `builder.js` leaves before installing its own when the page has no `#controls` (`site/js/builder.js:282`).

**State.** Each page keeps its own key in `localStorage` (`open-alert:builder`, `open-alert:trial`; `site/js/builder.js:296`, `site/js/trial.js:188`) and wraps every read and write in `try`. Share links: `#s=` on the configurator (`site/js/ui.js:44`, `:777`), `#b=` on the builder (`site/js/builder.js:305-314`).

**Toast.** `<div id="toast">` plus a small `toast(text)` function that adds class `show` for 1.8 s (`site/js/trial.js:324`).

## A5. Styles: tokens and classes, with an example of each

### Tokens (`site/style.css:8-20`)

`--bg`, `--panel`, `--panel-2`, `--line`, `--line-2`, `--text`, `--dim`, `--accent`, `--accent-ink`, `--ok` (green), `--warn` (amber), `--bad` (red), `--info`, `--a1` (ALERT1, purple), `--a2` (ALERT2, blue), `--role-field`, `--role-repeater`, `--role-base`, `--hero`, `--hero-ink`, `--shadow`, `--radius` (12px), `--font`, `--mono`.

**Dark mode** redefines the same names twice: for the system setting unless the page is forced light (`@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { … } }`, `:21-32`) and for the button's choice (`:root[data-theme="dark"]`, `:33-42`). **Print** has its own values (`:552-565`). So: never write a colour in a page or a drawing; use a token or a class, and tint with `color-mix(in srgb, var(--ok) 12%, var(--panel))` as the existing rules do.

### Classes

| For | Classes | Where | Example |
|---|---|---|---|
| Page width and text | `.wrap`, `.sect`, `.lead`, `.small`, `.dim`, `.sr-only`, `.skip` | `style.css:57-64`, `build.css:3-4` | `<section class="sect" id="x"><h2>…</h2><p class="lead">…</p></section>` |
| Verdict colours on text | `.ok`, `.warn`, `.bad` | `style.css:60` | `<span class="warn">82%</span>` |
| A card | `.card-o` | `build.css:68-70` | `<div class="card-o"><h3>Passes if</h3><ul class="small"><li>…</li></ul></div>` |
| Three cards in a row (one column under 900 px) | `.cards3` | `build.css:184-186`, `:210` | `<div class="cards3"><div class="card-o">…</div> ×3</div>` |
| A note, and a red one | `.note`, `.note.bad` | `style.css:95-96` | `<p class="note"><b class="ok">Fits:</b> nothing to flag.</p>` |
| A verdict box (configurator) | `.verdict.ok`, `.verdict.warn`, `.verdict.bad` | `style.css:393-397` | `<div class="verdict warn"><b>Check:</b> …</div>` |
| Figures in tiles (configurator) | `.kpis` > `.kpi` with `.k-l`, `.k-v`, `.k-s` | `style.css:226-231` | `<div class="kpis"><div class="kpi"><span class="k-l">Hardware</span><span class="k-v">A$1,240</span><span class="k-s">inc GST</span></div></div>` |
| A table | `.table-wrap` > `table.tbl`; cells `.num` (right-aligned figures); `tr.sub` (a group heading row); `tr.grand` (total) | `style.css:371-381` | `<div class="table-wrap"><table class="tbl"><thead><tr><th>Part</th><th class="num">A$</th></tr></thead><tbody><tr class="sub"><th colspan="2">Computer</th></tr><tr><th scope="row">Pi 4</th><td class="num">162</td></tr></tbody></table></div>` |
| Table variants | `.bomb` (the builder's bill: each row becomes a small card under 640 px, using `data-l="Qty"` on cells), `.var` (the trial's computer table, rows `pick-buy`, `pick-out`, `pick-ref`), `.res` (results sheet with inputs) | `build.css:125-157`, `:212-221`, `:205-207` | `<td class="num" data-l="A$"><span>A$162</span></td>` |
| A chip | `.chip` plus one of `.a1`, `.a2`, `.open` (green), `.partial` or `.st-warn` (amber), `.st-bad` (red), `.st-info` (blue), `.closed` (grey), `.plain` | `style.css:354-365` | `<span class="chip st-warn" title="An estimate">est.</span>` — there is no green `st-ok`; the trial maps "ok" to `st-info` (`site/js/trial.js:256`) |
| A bar gauge | `.gauge` with `<i class="g-cont">`, `g-burst`, `g-kiosk` and a `.g-safe` marker; `.pf-bar` with `<i class="ok">` | `build.css:63-65`, `:71-75` | `<div class="gauge"><i class="g-cont" style="width:20%"></i><i class="g-burst" style="width:12%"></i><span class="g-safe" style="left:70%"></span></div>` |
| A key under a drawing | `.legend` with `<i class="lg-…">` swatches | `build.css:76-80` | `<div class="legend small"><span><i class="lg-min"></i>if it's in stock</span></div>` |
| A drawing | `.diagram` (a panel that scrolls sideways on a phone) around an inline `<svg viewBox>`; shared drawing classes `.d-node`, `.d-sub`, `.d-col`, `.d-link`, `.d-direct`, `.d-cloud` | `style.css:419-431` | `<figure class="diagram" aria-label="what it shows"><svg viewBox="0 0 760 150" role="img" aria-hidden="true"><g class="d-node"><rect x="10" y="40" width="150" height="70" rx="10"/><text x="85" y="70">Base station</text></g></svg></figure>` |
| Drawing sets that already exist | `.sys` (tappable signal path: `g.nd[data-node][tabindex][role=button]`, `.zone`, `.lnk`, `.lt`, `.hot`, `.cloud`), `.stack` (boards and boxes), `.boxd` (the cabinet), `.trialset` (the trial's set-up), and for generated charts `.axis`, `.tick`, `.lbl`, `.grid`, `.rowl`, `.lead-min`, `.lead-max`, `.full`, `.safe`, `.cmp` | `build.css:6-44`, `:82-122`, `:163-183` | The trial's set-up: `site/trial.html:52-74` |
| Form controls | `.ctl` > `fieldset` > `legend`, `.row`, `label.chk`, `.chks` (ticks in a grid), `.pfs` > `label.pf` (pick-one cards) | `build.css:47-65` | `site/js/builder.js:335-357` |
| Buttons | plain `button` (filled), `.ghost` (outline), `.small`, `.danger`, `.linklike` | `style.css:68-83` | `<button type="button" class="ghost small" data-act="share">Copy a link</button>` |
| Lists the trial uses | `.shop` (tick-off list), `.phases` (numbered stages), `.code` (a `<pre>` with a Copy button: `data-act="copycode" data-for="id"`), `.trouble` (`dl`), `.path`, `.src-list` (two-column sources) | `build.css:134-137`, `:190-209` | `site/trial.html:150-159` |
| Header and menu | `.hero`, `.hero-in`, `.hero-text`, `.theme-btn`, `.sitenav`, `.nav-group`, `.nav-h`, `.nav-link`, `.onpage` | `style.css:100-150` | A4 above. Under 900 px the menu is a grid three links wide; under 380 px, two (`:140-150`) |

## A6. The app files, old addresses and the workflows

**`site/sw.js` (28 lines).** Network first: every same-origin GET goes to the network; a good answer is copied into the cache `open-alert-v1`; with no signal the cached copy is served, and a page that was never cached falls back to the cached front page (`:17-27`). **There is no list of files in it, so a new file is not listed anywhere** — it is kept after it is first fetched online. That also means a page is available offline only once it has been opened online. Changing the cache name clears the old cache on activation (`:7`, `:11-15`). Because it is network first, there is no version stamp to bump.

**`site/manifest.webmanifest`.** `start_url` and `scope` `./`, `display` `standalone`, four icons, and two shortcuts (`build.html`, `trial.html`) (`:17-20`). Tested: name, start, scope, display; every icon file exists and each PNG is the size it claims; a 192 and a 512 "any" icon and a maskable one; every shortcut's file exists in `site/`; `icons/apple-touch-icon.png` is 180 × 180 (`test/app.test.js:17-35`).

**Old addresses.** The site used to be served one folder down.

- Top of the repository: `index.html` → `site/`, `build.html` → `site/build.html`, `trial.html` → `site/trial.html`. For Pages set to "Deploy from a branch".
- `site/site/index.html` → `../`, `site/site/build.html` → `../build.html`, `site/site/trial.html` → `../trial.html`. For Pages publishing `site/` as the top.
- Each has a `<meta http-equiv="refresh">`, a `rel="canonical"` link, and `location.replace('<target>' + location.search + location.hash)` so share links survive. The test wants that exact `location.replace(…)` text in all six, and `url=<target>"` in the three under `site/site/` (`test/app.test.js:47-58`).

**`.github/workflows/pages.yml`.** On a push to `main` that touches `site/**` or the workflow: Node 20, run the tests ("a broken catalogue is not published", `:33-34`), upload `site/` and deploy. One deploy at a time, a newer one cancels an older (`:18-20`). `atlas.json:33` records an unfinished job: Pages still also publishes from the branch, so two jobs publish on every push and lay the site out differently.

**`.github/workflows/test.yml`.** On every push to `main` and every pull request: Node 18, 20 and 22; `node --check` on every script; then the tests.

**`.github/workflows/atlas.yml`.** Checks `atlas.json` daily and on change; opens an issue when a repository it cites has moved on.

## A7. Every count and list to keep in step

| When you… | Change | Where |
|---|---|---|
| add or remove a **catalogue part** | "252 parts" | `README.md:100` |
| | the family table (the row count, and the examples) — families are the engine's groups (`engine.js:49-102`), not the files: Loggers & computers is 46 | `README.md:104-113` |
| | "252-part catalogue", "252 parts in six family files", "252 parts with prices" | `atlas.json:8`, `:82`, `:182` |
| | nothing in the tests (only a floor of 200, `test/engine.test.js:41`) | |
| add a **builder computer** | the list of computers | `README.md:67-69` |
| | the fixed captions under the "single board / module / boxed" drawing | `site/build.html:109`, `:116`, `:120` |
| | the trial's comparison rows, if it belongs there (`others`), and the required ids | `site/js/trial.js:86-102`, `test/trial.test.js:78` |
| | a new install route, if any | `site/js/builder.js:241-247`, `test/builder.test.js:38` |
| | a new shop, if any | `site/data/builder.js:45-72` |
| add a **page** | the menu, in every page | `site/index.html:29-42`, `site/build.html:30-43`, `site/trial.html:30-43` |
| | the pages lists and the wanted menu links | `test/app.test.js:12`, `test/trial.test.js:39-40` |
| | two forwarding stubs and their test rows | top folder, `site/site/`, `test/app.test.js:49`, `:55` |
| | a manifest shortcut (optional) | `site/manifest.webmanifest:17-20` |
| | the links at the top, the menu sentence, a section, the layout list | `README.md:8-16`, `:59-96`, `:176-185` |
| | a component and a "provides" entry, the `about` text | `atlas.json:8`, `:69-177`, `:178-222` |
| add a **data file** (a seventh family) | the file lists | `test/engine.test.js:17`, `test/builder.test.js:11`, `test/trial.test.js:67` |
| | a `<script>` line in every page | `site/index.html:134-139`, `site/build.html:177-182`, `site/trial.html:245-250` |
| add or remove a **preset** or example network | "22 presets … 5 example networks" | `README.md:123`, `atlas.json:100` |
| add or remove a **Verdin variant** | exactly six, part numbers `0071`–`0076`, exactly one marked `buy`, and the shopping list's module names that one | `test/trial.test.js:52-64` |
| change a **trial shopping item** | `verdin`, `mallow`, `heatsink`, `stick`, `splitter` must stay; every price above zero | `test/trial.test.js:13-26` |
| re-price | the "as of" month and the footers | `site/data/builder.js:37`, `site/js/trial.js:20`, `site/index.html:131`, `site/build.html:174`, `site/trial.html:242`, `README.md:117`, `site/index.html:91` |
| re-check an entry against a sibling repository | that `consumes` entry's `since` date | `atlas.json:223-359`, `CLAUDE.md` |
| finish any piece of work | `status.updated`, `summary`, `now`, `next` | `atlas.json:22-67` |

Before pushing (`CLAUDE.md`): `npm test`; and for a change to `site/js/ui.js`, `site/style.css` or `site/index.html`, load the page in headless Chromium and walk every view at desktop and phone width.

## A8. Conventions

- **Plain words.** The product is Flood-Net, never MegaNet, in anything a person reads (tested for the three pages and the builder's two scripts; not tested for `trial.js` or the catalogue).
- **A meaning on hover, and a readable key.** Hover text is a `title`: `<span class="chip st-warn" title="Price and lead time are estimates">est.</span>` (`site/js/trial.js:207`); a column heading with a `title` (`site/js/trial.js:276`); a bar with a `title` (`site/js/builder.js:325`). The readable version is a `.legend` row under each drawing (`site/js/builder.js:380`, `:455`, `:484`, `:499`) or a `p.small.dim` under each table saying what the colours mean (`site/trial.html:87`, `site/js/trial.js:240`). The site has no "what the words on this page mean" fold; the shared instructions ask for one.
- **Catalogue price** (`site/data/compute.js:13-18`, `README.md:115-121`, `site/index.html:91`):
  - `aud` — Australian dollars for one; `null` only with `basis: 'quote'`.
  - `gst` — `true` includes GST, `false` is ex GST.
  - `basis` — `retail` (a shop's price), `list` (a maker's list price), `estimate`, `quote`, `tender`, `used`, `free`, `existing`.
  - `src` — a sentence: which shop, what it cost, whether it was in stock, when it was looked at and how (the records say "search listing" when the shop's page could not be read).
  - `url`, `asof` (`'2026-11'`), `shop`, `from` (two-letter country), `stock` (`in`, `back`, `out`, `order`, `unknown`), `ship` (A$ inc GST for a small order, or `null`).
  - The rule: what one costs from an Australian shop with it in stock; if none has, the cheapest way to get one, and the record says which. Overseas prices at US$0.69, €0.63, 0.58 Swiss francs to the dollar.
- **Builder and trial price** — `aud: [low, high]`, `gst`, `lead: { d: [min, max] days, text }`, `where`, `src`, `conf`.
- **Delivery** — once a shop; an overseas order over A$1,000 from a shop that does not clear customs itself pays A$200–280 more (`site/data/builder.js:73-74`; `engine.js:1412`).
- **conf** — `high` (read from the maker's or the shop's own page), `medium`, `low` (a guess: say so in a note). `low` shows an "est." chip in the builder and trial (`site/js/builder.js:466`, `site/js/trial.js:207`). An unsourced figure must be `low`.
- **Every claim has a source** in `src`, as `[title, address]`.

## A9. Three recipes

**A new catalogue computer.** (1) Add the record to `site/data/compute.js` in the right block; `cat` `sbc`, `ind-pc` or `mini-pc` (`ind-sbc` is labelled "Industrial Raspberry Pi", `engine.js:60` — see flag F12); `slots: ['base:host', 'repeater:repeater']`; `hw.os` from the keys RPi ALERT's record knows; `hw.sdrCh`; `tags: ['linux', …]` without `pi`. (2) `npm test`. (3) Counts: `README.md:100`, `:108`; `atlas.json:8`, `:82`, `:182`.

**A new builder computer.** (1) The catalogue record, as above. (2) An entry in `B.platforms` (`site/data/builder.js:141-223`), after the Pi 4. (3) If it installs another way, a new key in `flash` (`site/js/builder.js:241-247`) and in the test's list (`test/builder.test.js:38`). (4) Its shop in `B.shops` if new. (5) `README.md:67-69`, `site/build.html:109-120`. (6) `npm test` builds a bill for it against every stick, power, backhaul and box choice (`test/builder.test.js:107-126`).

**A new page.** (1) `site/<name>.html` from the skeleton in A4, `aria-current="page"` on its own link. (2) The new link in the menu of all pages. (3) Its script: own theme code, own `localStorage` key, `OA_BUILD_API` for any CPU figures. (4) Styles at the end of `site/build.css`, or a new file. (5) Stubs `<name>.html` at the top and in `site/site/`. (6) Tests: `test/app.test.js:12`, `:49`, `:55`; `test/trial.test.js:39-40`. (7) `README.md`, `atlas.json`, optionally the manifest. (8) `npm test`, then walk it in headless Chromium at desktop and phone width. Nothing to add to `sw.js` or the workflows.

---

# Part B — every assumption, decision and claim behind the trial

Kinds: **price**, **stock**, **lead time**, **CPU**, **software**, **security**, **lifecycle**, **pass rule**, **process**, **product fact**, **decision**.

## B0. Flags: where the repository disagrees with itself

| # | What | Where | Why it matters |
|---|---|---|---|
| F1 | The element14 listing for the Quad module has an address that describes another product: `…/toradex/761200/com-2ghz-32gb-arm-cortex-a72-r5f/dp/4852670`. The page says the listing "is titled Aquila AM69 but describes this module". Its order code (4852670) sits far from the other Verdins and Mallow (4759327–4759350). It is `conf: 'high'` and "not re-checked". | `site/js/trial.js:23-25`, `:69`; `site/data/compute.js:151`; `site/data/builder.js:184` | The trial's price (A$566 inc GST), stock (5 in the UK) and lead time (5–91 days) all come from this one listing. |
| F2 | Toradex "direct" prices do not add up: module US$107.40 + Mallow US$107.50 = US$214.90, but the ready-fitted pair is US$378.50. | `site/data/compute.js:151`; `site/js/trial.js:24`, `:28` | "A third of element14's price" and the A$874–1,177 "if the Bureau can order from Toradex" total rest on US$107.40 being the price for one. |
| F3 | The half-a-Pi-4 figure cites RPi ALERT's notes, which cite the builder's model. | `site/js/trial.js:65-67`; `RPi_ALERT/docs/hardware.md:210-211` | No A53 measurement exists. |
| F4 | `sdrCh` is defined as "how many ALERT1 SDR channels RPi ALERT can decode on it at once", but the builder uses it as twice the number of Pi 4 cores. By the model a Pi 4 decodes about 33 channels at 960 kHz, not 8. The header's "15–20% of a core per channel at 960 ksps" is not the model's 12%. | `site/data/compute.js:5-8`; `site/js/builder.js:93`; `site/data/builder.js:97` | The number shown to people as "channels" is not channels. |
| F5 | The same chip gets different ratings: Verdin AM62 Quad `sdrCh` 4 and BeaglePlay `sdrCh` 3 are both a TI AM62 with four A53s at 1.4 GHz; Pi 3B+ (four A53s at 1.4 GHz) 4; Le Potato (1.5 GHz) 3; Siemens IOT2050 (1.1 GHz) 2; Pi Zero 2 W (1.0 GHz) 2. The trial's own formula (`cores × GHz ÷ 1.4`) would give the Zero 2.9. | `site/data/compute.js:155`, `:343`, `:88`, `:417`, `:389`, `:104`; `site/js/trial.js:263` | The scale is by hand, not by rule. |
| F6 | The Dual "has 8 GB eMMC as the Quad"; the trial table gives the Quad 16 GB. | `site/data/compute.js:169`; `site/js/trial.js:69` | One is wrong. |
| F7 | The catalogue still says the Quad carries "two or three channels until the decoder gets faster" and the Dual "not with today's" decoder; the builder and trial say four channels on a busy day at 34% and 67% on today's default. | `site/data/compute.js:161`, `:169`; `site/data/builder.js:194`; `site/trial.html:113` | Stale text in the record people read in the Parts view. |
| F8 | Lean decoding takes "45% of the time" and gives "the same readings" on the builder page; "33–34%" with "14 of 11,628 bursts read differently" in the data and on the trial page. | `site/build.html:159`; `site/js/builder.js:508`; `site/data/builder.js:120`; `site/trial.html:110` | Stale. |
| F9 | "Around bursts" cut the work "about 40-fold in a prototype" (builder page, custom path); as built it is "a quarter … a fifteenth" (data), "a sixth to a twentieth" (RPi ALERT). The custom path still lists it as "left" to do. | `site/build.html:159`; `site/data/builder.js:348`, `:122`; `RPi_ALERT/docs/hardware.md:201-202` | Stale; the saving was overstated. |
| F10 | The trial page says "around bursts" gave "the same readings and the same bursts every time" and is off "until its Check has run"; the builder data says the check ran and "misses some of the weakest bursts". The trial also says 1.6 s and one second where the data says 1.4 s and 0.8 s. | `site/trial.html:111`; `site/data/builder.js:122` | The trial page hides a failed check that the Dual and Solo verdicts depend on. |
| F11 | Model figures disagree with the notes they cite: 30 MB a channel against "~40 MB"; 0.04 of a core a channel at 240 kHz against a bench of 0.26 for four channels (0.065 each); a burst "about a second" against a bench of 122 ms (lean) and 65 ms (light); the screen 0.5 of a core against a live drop from load 4.7 to 2.8. | `site/data/builder.js:97-101`, `:124`; `RPi_ALERT/docs/hardware.md:76-78`, `:105-106`, `:114` | The model may be light on memory and on the screen. |
| F12 | The Verdin records are filed under category `ind-sbc`, whose label is "Industrial Raspberry Pi". | `site/data/compute.js:147`, `:166`; `site/js/engine.js:60` | The "no Raspberry Pi" computer appears under a Raspberry Pi heading. |
| F13 | The Verdin and the Luna are given `hw.os: ['debian-arm64']`, though both run Torizon OS; there is no Torizon key. The engine then reports "Runs … install by hand". | `site/data/compute.js:155`, `:174`, `:192`; `site/data/alert.js:267` | The configurator understates the work. |
| F14 | The N150 mini PC is "about four times a Pi 4" in its blurb, `sdrCh` 24 (three times), "Three times" in the builder; A$279 in the catalogue, A$230–350 in the builder, no source. | `site/data/compute.js:426-431`; `site/data/builder.js:209-213` | The cheapest "enough CPU" option has the weakest figures. |
| F15 | The pass rule says "no restarts or check-in gaps of its own", but the sum looks only at the AM62's count against zero. | `site/trial.html:76`; `site/js/trial.js:113`, `:166-168` | A shared network outage fails the trial. |
| F16 | The shopping item says "see Which module, above"; the section is now "Which computer" and is below the cost line it is quoted from. | `site/js/trial.js:24`; `site/trial.html:83` | Cosmetic. |
| F17 | The custom path's `where` links (Toradex design partners, Raspberry Pi design partners, NATA, JLCPCB) are in the data but never drawn: the page shows only `src`. | `site/data/builder.js:347-353`; `site/js/builder.js:580`, `:586` | The page's "who would do this" is missing. |
| F18 | The trial's 12 V supply is "12 V 2 A" in its name and Jaycar's 2.5 A part in its text. | `site/js/trial.js:34-37` | Cosmetic. |

## B1. The trial's design and method

| # | Where | The claim | Kind | Rests on | How to check |
|---|---|---|---|---|---|
| 1 | `site/trial.html:26`; `site/data/compute.js:160` | The candidate is a Verdin AM62 Quad on Mallow because it is "industrial parts, no Raspberry Pi". | decision | No source cited. | Set it against the need: at least a Pi 4 with headroom. The page's own figure is half a Pi 4. |
| 2 | `site/trial.html:51` | One antenna split two ways, a stick and a Flood-Net token each, makes a fair comparison. | process | <https://github.com/cdomotor-g/RPi_ALERT/blob/main/docs/configuration.md> | Sound. The splitter's two outputs should be measured as equal. |
| 3 | `site/trial.html:51`, `:235` | Flood-Net keeps the first copy of a reading and records every copy on the Reception Map. | software | <https://github.com/cdomotor-g/MegaNet/blob/main/docs/ingest-http.md> | Checked in the local copy: lines 35-37 and 194-195 say so. Holds. |
| 4 | `site/trial.html:51`, `:187`; `site/js/builder.js:239` | No two sticks are alike (one heard 9–19 dB weaker), so swap them halfway. | measurement | <https://github.com/cdomotor-g/RPi_ALERT/blob/main/docs/hardware.md> | Checked: `hardware.md:110-111`. Holds. The swap only cancels if the two weeks are alike; the sums add the weeks rather than pair them. |
| 5 | `site/trial.html:128`, `:214`; `site/js/trial.js:44` | The splitter costs each side about 3.5 dB. | product fact | <https://store.techwave.com.au/products/rfi-power-splitter-2-way-130-180-mhz-100w-nf> | A two-way split is 3 dB plus loss; read the part's sheet. |
| 6 | `site/trial.html:76`; `site/js/trial.js:106` | Passes at 98% or more of the Pi's decoded bursts over both weeks. | pass rule | No source. | Decide what loss is acceptable; compare with the Pi's own week-to-week spread from its baseline. |
| 7 | `site/trial.html:76`; `site/js/trial.js:110` | No channel ever drops samples. | pass rule | No source. | Reasonable; read from the agent's log. |
| 8 | `site/trial.html:76`; `site/js/trial.js:109`; `site/data/builder.js:100` | Decoder busy under 70% in the worst hour. | pass rule | No source ("plan to use no more than 70%"). | A convention. For "headroom for growth and ALERT2" the bar should be far lower at today's load. |
| 9 | `site/trial.html:76`, `:211-212`; `site/js/trial.js:111` | Processor under 70 °C. | pass rule | No source. | Read the AM62's rated junction temperature and Torizon's throttle points. Check the agent can read the temperature in a container (it reads `/sys/class/thermal/thermal_zone0/temp`, `RPi_ALERT/agent/lib/system.js:56`). |
| 10 | `site/trial.html:76`; `site/js/trial.js:113` | No restarts or check-in gaps. | pass rule | No source. | See F15. |
| 11 | `site/js/trial.js:108` | Median SNR within 2 dB counts as the same (a warning, not a fail). | pass rule | No source. | Fine as a sanity check. |
| 12 | `site/trial.html:77` | A couple of hours on the bench, an hour on site, two weeks, an hour to compare. | process | No source; the bring-up "has not been done before" (`:149`). | A guess. Allow days for the first bring-up. |
| 13 | `site/trial.html:78`; `site/js/trial.js:204`, `:215` | About A$1,270–1,570 delivered for what is needed (A$1,333–1,688 with the extras). | price | The items below. | Recomputed from the data: A$1,269–1,572 and A$1,333–1,688. Stands or falls with rows 19–20. |
| 14 | `site/js/trial.js:215` | Ordering the module from Toradex brings the list to about A$874–1,177. | price | <https://www.toradex.com/computer-on-modules/verdin-arm-family/ti-am62> | See F2. Also assumes 10% GST is all that is added. |
| 15 | `site/trial.html:191` | After two weeks: keep both, keep the Pi, or let the Mallow take over. | decision | — | A pass on four channels says nothing about growth or ALERT2. |
| 16 | `site/trial.html:221`; `atlas.json:27`, `:36` | The trial's numbers will recalibrate the builder's model. | process | — | The real purpose of the trial: it is the first A53 measurement. A Pi 3B+ gives the same for A$65 (row 22). |

## B2. Which computer: the Verdin table

| # | Where | The claim | Kind | Rests on | How to check |
|---|---|---|---|---|---|
| 17 | `site/trial.html:84`; `site/js/trial.js:68-81`; `test/trial.test.js:54` | Toradex makes six Verdin AM62s: Solo 512MB (0071), Solo 512MB WB IT (0072), Dual 1GB ET (0073), Dual 1GB IT (0074), Dual 1GB WB IT (0075), Quad 2GB WB IT (0076). | product fact | <https://www.toradex.com/computer-on-modules/verdin-arm-family/ti-am62>; <https://www.mouser.com/datasheet/2/1043/verdin_am62_datasheet-3358797.pdf> | Read the datasheet's table of variants. Note the only Quad has Wi-Fi and Bluetooth on the module. |
| 18 | `site/js/trial.js:69-80` | Each variant's cores, speed, memory, eMMC, Wi-Fi and temperature range (Quad: 4 × 1.4 GHz, 2 GB, 16 GB, −40 to +85 °C). | product fact | Same datasheet. | Read it. See F6. |
| 19 | `site/js/trial.js:22-25`, `:69`; `site/data/compute.js:151` | element14 Australia sells the Quad as order code 4852670 for A$514.73 ex GST. | price | <https://au.element14.com/toradex/761200/com-2ghz-32gb-arm-cortex-a72-r5f/dp/4852670> | **See F1.** Open the page by hand; read the maker's part number and the attached datasheet; ask element14 in writing which module ships. |
| 20 | `site/js/trial.js:71-79`; `site/data/compute.js:170` | element14 prices ex GST: Dual IT (4759329) A$346.54, Dual WB IT (4759330) A$368.41, Dual ET (4759328) A$272.61, Solo (4759327) A$216.76; Solo WB IT not listed; Mallow (4759350) A$165.74. | price | <https://au.element14.com/toradex/00741200/com-1-4ghz-1gb-arm-cortex-a53/dp/4759329>; <https://au.element14.com/toradex/01611102/carrier-board-mallow/dp/4759350> | By hand: "element14 blocks automated reads" (`trial.js:23`). Read on 2 November only. |
| 21 | `site/js/trial.js:23`, `:27`, `:69-79`; `site/data/compute.js:151`, `:161`; `site/data/builder.js:182` | Stock on 2 November: 5 Quads and 13 Mallows in the UK, 3 Duals plus 3 coming, Dual ET from 12 January 2027. Delivery 3–5 working days from UK stock; 13 weeks from the factory. | stock, lead time | The element14 pages. | By hand. The catalogue itself now says `stock: 'unknown'`. |
| 22 | `site/js/trial.js:65-67`, `:263`; `site/trial.html:102`; `site/data/compute.js:150`, `:155`; `site/data/builder.js:185` | Four A53 cores at 1.4 GHz are about half a Pi 4 (a Pi 4 core is about two of them). | CPU | <https://github.com/cdomotor-g/RPi_ALERT/blob/main/docs/hardware.md> | **See F3.** RPi ALERT measures what a channel costs its own computer a couple of minutes after it starts (`hardware.md:92-93`). Run 0.23 on a Pi 3B+ (A$64.79, in stock, `compute.js:84`) and read the figure. |
| 23 | `site/trial.html:84` | The AM62's cores are "the very cores of a Raspberry Pi 3B+". | CPU | The two datasheets. | Same core design; memory and cache differ. Only a measurement on an AM62 settles it — BeaglePlay is the same chip, in stock in Australia at A$266.95 (`compute.js:339`). |
| 24 | `site/js/trial.js:24`, `:69-79`; `site/data/compute.js:151`, `:170` | Toradex sells direct at US$107.40 (Quad), US$81.85, US$94.10, US$67.20, US$75.00, US$54.95, Mallow US$107.50; "Toradex's own sample price". | price | <https://www.toradex.com/computer-on-modules/verdin-arm-family/ti-am62>; <https://www.toradex.com/single-board-computers/mallow> | **See F2.** Sign in to Toradex's shop and price one of each in the basket; read the quantity breaks. |
| 25 | `site/js/trial.js:24`; `site/data/builder.js:67`, `:183`; `atlas.json:44-65` | Toradex sells direct to businesses only; express courier from Europe, the buyer pays import charges; courier A$60–150 (an estimate). | process, price | <https://toradex.com/order-now/how-to-order> ("the page refuses automated reads") | Read the page; ask for a quote with delivery to Brisbane. |
| 26 | `site/js/trial.js:69-70` | Quad: "the one to trial" — four channels in heavy traffic at about half its CPU on 0.17. | decision | The model. | Model gives 47%. Follows from row 22. |
| 27 | `site/js/trial.js:71-74`; `site/data/builder.js:194` | Dual: "works on 0.17" — four channels on a busy day at two thirds of it. | CPU, decision | The model. | Model gives 67% busy, 95% heavy: "at the edge" on the builder's own scale. |
| 28 | `site/js/trial.js:75-76` | Dual ET: 4 GB of eMMC "is tight for Torizon, the container and a 1 GB reading queue". | software | No source. | Read the size of a Torizon OS image and of the built container. |
| 29 | `site/js/trial.js:77-80`; `site/trial.html:113` | A Solo carries one or two channels on 0.19's Light decoder around bursts. | CPU | The model; <https://github.com/cdomotor-g/RPi_ALERT/blob/main/docs/hardware.md> | Needs the two modes that are off by default (F10). |
| 30 | `site/data/builder.js:190`, `:193`; `site/js/trial.js:71` | element14 lists the Dual as 00741200, "the previous revision (V1.2A)", not 00741201. | stock | The element14 page. | Read Toradex's product change notice for what changed. |
| 31 | `site/js/trial.js:90-101`; `site/data/compute.js:34`, `:88`, `:104`, `:120`, `:137` | Raspberry Pi rows: Zero 2 W a quarter of a Pi 4, 3B+ half, CM4 seven eighths, Pi 5 and CM5 twice. | CPU | <https://github.com/cdomotor-g/RPi_ALERT/blob/main/docs/hardware.md> (which says only "Fastest" for the Pi 5) | Run the agent's own measurement on each. |
| 32 | `site/js/trial.js:11`; `site/js/engine.js:135` | US$0.69 to the Australian dollar. | price | "October 2026 planning rate". | Today's rate. |

## B3. The Toradex records in the catalogue and the builder

| # | Where | The claim | Kind | Rests on | How to check |
|---|---|---|---|---|---|
| 33 | `site/data/compute.js:150`; `site/js/trial.js:28`; `site/trial.html:93` | Mallow takes 7–24 V. | product fact | <https://docs.toradex.com/116791-mallow_carrier_board_datasheet.pdf> | Read the datasheet. A 24 V battery on charge is above 24 V. |
| 34 | `site/data/compute.js:150`, `:152`, `:160` | Module and carrier are both −40 to +85 °C. | product fact | Same datasheets. | Read both; note whether that is the air or the board. |
| 35 | `site/data/compute.js:150`; `site/js/trial.js:28`; `site/data/builder.js:184` | Mallow has "two USB 3 ports for the sticks". | product fact | Mallow datasheet. | From memory (medium): the TI AM62 chip has USB 2.0 only, so the ports run at USB 2.0 with this module. That is enough for RTL-SDR sticks, but check how many ports the module drives, whether they share a hub with the M.2 slot, and each port's current limit. |
| 36 | `site/data/compute.js:150`; `site/data/builder.js:184`, `:255`, `:284`; `site/build.html:160` | Mallow's M.2 B-key slot carries USB 2.0, so a card SDR could sit there; the AM62 has no PCIe. | product fact | Mallow datasheet. | Read the slot's pin table. |
| 37 | `site/data/compute.js:156`, `:160`; `site/data/builder.js:185`, `:352` | Mallow's Altium files, schematics and parts list are published: "the best base for an open custom carrier". The module is closed; the Yocto software is open. | openness | <https://www.toradex.com/products/carrier-board/mallow-carrier-board> | Read the licence on the design files (who may use them, and with which modules). The module stays single-source. |
| 38 | `site/data/compute.js:157`; `site/data/builder.js:185`; `site/trial.html:94` | The Verdin AM62 is available to 2033 and beyond. | lifecycle | <https://www.toradex.com/computer-on-modules/verdin-arm-family/ti-am62> | Read Toradex's stated availability date, per variant. |
| 39 | `site/data/compute.js:153` | Approvals: CE, FCC. Grade 4, "industrial module and carrier with long-term availability". | security, decision | No source in the record. | Ask Toradex for the declarations; ask whether the Wi-Fi module is approved for Australia. No RCM is claimed. |
| 40 | `site/data/compute.js:152`; `site/js/trial.js:61` | Draws about 3 W, 8 W at most; "well under the Pi 4's 4–7 W". | product fact | No source. | The trial's meters; the datasheet's power table. |
| 41 | `site/data/compute.js:155`, `:158` | It runs "debian-arm64"; RPi ALERT's installer "expects Debian with apt: run it in a Debian container under Torizon — untested". | software | <https://developer.toradex.com/hardware/verdin-som-family/modules/verdin-am62/> | See F13. |
| 42 | `site/data/compute.js:161` | element14 charges A$566 inc GST for the module, "three times Toradex's direct price". | price | Rows 19 and 24. | F1 and F2. |
| 43 | `site/data/builder.js:181-184` | Builder entry: A$680.47 ex GST for module and carrier, 5–91 days, heatsink 23111001 "Toradex or Mouser; element14 Australia doesn't stock it". | price, lead time, stock | Rows 19–21. | By hand. |
| 44 | `site/data/builder.js:185` | "It needs the faster decoder for more than a couple of channels." | CPU | The model. | Out of date against rows 26–27 (F7). |
| 45 | `site/js/builder.js:244` | Install route: Toradex Easy Installer, Torizon OS, the agent in a Debian container with USB passed through — "or build a Yocto image with Node.js 18+ and rtl-sdr. Untested: this is the first port off the Pi". | software | No source. | Nobody has done either. RPi ALERT's repository has no container or Torizon files (searched). |
| 46 | `site/data/compute.js:166-181`; `site/data/builder.js:189-195` | The Dual on Mallow: A$512.28 ex GST, half the Quad, no Wi-Fi, 1 GB, no screen dashboard. | price, CPU | Rows 20, 22. | As above. |

## B4. The Luna SL1680

| # | Where | The claim | Kind | Rests on | How to check |
|---|---|---|---|---|---|
| 47 | `site/data/compute.js:184`, `:187`, `:191-192`; `site/trial.html:90` | A Pi-sized Toradex board on Synaptics' SL1680: four Cortex-A73 at 2.1 GHz, 4 GB, 16 GB eMMC, battery clock, four USB 3 ports, Wi-Fi, −25 to +85 °C; part 03011000. | product fact | <https://www.toradex.com/single-board-computers/luna-sl1680>; <https://docs.toradex.com/118084-luna_sl1680_datasheet.pdf> (preliminary) | Read the datasheet. |
| 48 | `site/data/compute.js:187`, `:192`, `:197-198`; `site/data/builder.js:204`; `site/trial.html:90`; `test/trial.test.js:81-83` | About 1.1 times a Pi 4 (`sdrCh` 9), "scaled by clock … no benchmarks published yet". | CPU | No source: arithmetic (2.1 ÷ 1.8 × 8). | Run RPi ALERT on one, or on any SL1680 board. The record and a test both mark it an estimate. |
| 49 | `site/trial.html:90` | Flood-Net's four channels "would take about a seventh of it on 0.17". | CPU | The model (15%). | Follows from row 48. |
| 50 | `site/data/compute.js:188`; `site/data/builder.js:199-201`; `site/js/trial.js:88` | US$145 for one from Toradex's shop (A$210.14 ex GST; about A$230 with GST, plus courier). No Australian distributor, no stock figure, no published courier charge. | price, stock | <https://www.toradex.com/single-board-computers/luna-sl1680> ("refuses automated reads"; "not re-checked on 7 November") | By hand. The builder's upper figure, A$255, has no source. |
| 51 | `site/data/builder.js:200` | 7–35 days to arrive. | lead time | "an estimate". | Ask Toradex. |
| 52 | `site/data/compute.js:189`, `:198` | 4.5 W typical, 25 W at most; "power use not yet measured by Toradex". | product fact | No source for 4.5 W. | Measure. |
| 53 | `site/data/compute.js:198`; `site/data/builder.js:203`; `site/trial.html:93` | 5 V only, up to 5 A, and it does not negotiate USB-PD, so a phone or Pi 5 charger may hold it to 3 A. | product fact | The preliminary datasheet. | Read the power section. A 12 V site needs the DDR-30G-5 converter, which had no Australian stock (`site/data/builder.js:309-311`). |
| 54 | `site/data/compute.js:193` | Hardware closed: "no board design files found published". Torizon OS is open source. | openness | Absence of evidence. | Look on Toradex's developer site. |
| 55 | `site/data/compute.js:194`, `:196`; `site/trial.html:94` | Released early 2026 (V1.0A), datasheet preliminary, product life "not stated"; status `beta`; `lifeYears: 6`. | lifecycle | Datasheet; the 6 years is a guess. | Ask Toradex for an availability date. |
| 56 | `site/data/compute.js:190` | Grade 3: Toradex's "pro consumer" tier, below its industrial modules. | decision | No source for the phrase. | Read how Toradex describes the range. |
| 57 | `site/data/compute.js:195`; `site/data/builder.js:204`; `site/js/builder.js:245`; `site/trial.html:92` | It comes with Torizon OS on the eMMC; RPi ALERT would run in a Debian container, "the route this trial proves on the Verdin"; flashing by a USB_BOOT jumper and Toradex's script. | software | <https://docs.toradex.com/118333-luna_sl1680_sbc_getting_started.pdf>; <https://developer.toradex.com/hardware/sbc-family/luna-sl1680/> | Untested. Ask which kernel it runs and for how long Toradex promises security fixes for it. |
| 58 | `site/data/compute.js:184-200` | No approvals listed; no watchdog listed. | security | — | Ask Toradex for the declarations (and the radio's approval for Australia). |
| 59 | `site/js/trial.js:87-89`; `site/trial.html:89-90` | "Yes, on paper — untested." | decision | Rows 47–57. | — |

## B5. Bringing it up, and the container

| # | Where | The claim | Kind | Rests on | How to check |
|---|---|---|---|---|---|
| 60 | `site/trial.html:139`; `site/js/trial.js:30-33` | A heatsink is a must: "without a heatsink the module throttles and the trial measures heat". Part 23111001, US$15.60; element14 Australia stocks only the Apalis ones, which do not fit. | product fact, price | <https://www.toradex.com/accessories/verdin-industrial-heatsink-type-1>; <https://www.digikey.nl/en/products/detail/toradex-ag/23111001/28022861> | Toradex's thermal notes for the AM62. Because the heatsink's first shop is Toradex, the trial's bill adds A$60–150 of courier for a US$15.60 part. |
| 61 | `site/trial.html:140`; `site/js/trial.js:34-37` | Power goes in on a Phoenix Contact header whose mate is part 1805410. | product fact | Mallow datasheet. `conf: 'low'`. | Read the datasheet; ask whether the plug is in the box. |
| 62 | `site/trial.html:141-142`; `site/data/compute.js:158` | A new module arrives with Toradex Easy Installer; it is reached in a browser or by VNC; install "Torizon OS (the plain one, without the evaluation containers)". | software | <https://developer.toradex.com/quickstart/5/bringup/installing-torizon> | Read Toradex's guide for the current Torizon OS version. |
| 63 | `site/trial.html:143` | Log in as `torizon`, first password `torizon`, and it makes you change it. | security | No source cited. | Read Toradex's guide. A known default password until first login. |
| 64 | `site/trial.html:145`, `:206`, `:232` | Loading Easy Installer over USB has failed for others on this exact pair. | process | <https://community.toradex.com/t/struggling-to-load-easy-installer-on-am62-mallow/23841> | Read the thread for the cause and fix. |
| 65 | `site/trial.html:149` | Torizon runs software in Docker containers; RPi ALERT's installer is made for Raspberry Pi OS; so the agent runs in a Debian container. "This has not been done before." | software | No source. | — |
| 66 | `site/trial.html:150-159` | The image: `debian:trixie-slim`, packages `nodejs rtl-sdr git ca-certificates procps`, a shallow clone of RPi ALERT's `main`, started as `node …/agent/bin/rpi-alert daemon`. | software | No source. | Checked against RPi ALERT 0.23.1: `daemon` exists (`agent/bin/rpi-alert:78`); it needs Node 18.17 or later (`agent/package.json:11`) and no other packages. Not checked: that Debian's `rtl-sdr` has every program the agent calls; what happens to its calls to `systemctl`, `systemd-notify` and `vcgencmd` (`agent/lib/agent.js:341`, `:383`; `agent/lib/system.js:43`). |
| 67 | `site/trial.html:161-166` | Run with `--privileged --network host`, `/dev/bus/usb` passed in, two volumes for `/etc/rpi-alert` and `/var/lib/rpi-alert`, restart unless stopped. | software, security | No source. | Paths match (`agent/lib/config.js:17`, `agent/lib/state.js:12`); the dashboard is on port 80 (`agent/lib/config.js:164`). **For a security review:** full privileges, the host's network, root inside, and code cloned unpinned and unsigned from `main` — while RPi ALERT has signed releases (`RPi_ALERT/docs/release-signing.md`). A production route would pass only the USB devices, run as its own user and pin a signed release. |
| 68 | `site/trial.html:174` | The Wi-Fi hotspot, updates from Flood-Net and the screen will not work in the container. | software | — | True by design. Leaves no way to update the agent short of rebuilding the image, and none for the operating system except Toradex's own. |
| 69 | `site/trial.html:169` | Leave both on Lean, "RPi ALERT 0.17's default", so the two decode alike. | process | — | Still the default in 0.23.1 (`agent/lib/config.js:137`, `:145`). But the container takes whatever `main` is that day; the Pi runs a release. Pin both to one version. |
| 70 | `site/trial.html:171` | The box's receivers appear in Flood-Net as `rpi-am62-trial-sdr1…`. | software | <https://github.com/cdomotor-g/RPi_ALERT/blob/main/docs/configuration.md> | Depends on the name the agent sees inside the container. |
| 71 | `site/trial.html:208` | If the kernel's TV driver takes the stick, unload `dvb_usb_rtl28xxu`; RPi ALERT blacklists it on a Pi. | software | No source. | On Torizon the blacklist must be made on the host, not in the container. |
| 72 | `site/js/trial.js:55-58` | Mallow has a 6-pin console header for a 3.3 V USB serial cable. | product fact | Mallow datasheet. | Read the pin-out, as the item itself says. |
| 73 | `site/js/trial.js:38-41` | The second stick must be the Pi's model; the V4 is end of life since May 2026 and out of stock, so buy two V3s if the Pi has a V4. | stock | <https://www.rtl-sdr.com/rtl-sdr-blog-v4-end-of-line/> (cited at `site/data/builder.js:240`) | Read the maker's page. This affects every design: the stick itself is a consumer part with a short life. |

## B6. The CPU model the trial reads from

| # | Where | The claim | Kind | Rests on | How to check |
|---|---|---|---|---|---|
| 74 | `site/data/builder.js:84-91` | A channel's work between bursts grows with the stick's window: 1, 3, 3.7, 4.1, 5.1, 6.3 times from 240 kHz to 2.4 MHz. | measurement | <https://github.com/cdomotor-g/RPi_ALERT/blob/main/docs/hardware.md> | Checked: `hardware.md:66-73` has the same table. |
| 75 | `site/data/builder.js:94-97` | One channel at 240 kHz costs 0.04 of a Pi 4 core between bursts. | measurement | Same: "two sticks of two channels took 0.49 of a core at 960 kHz, bursts and all". | One bench point; the other in the same sentence (0.26 at 240 kHz) gives 0.065 (F11). |
| 76 | `site/data/builder.js:98` | A burst's decode is about a second of a Pi 4 core on the full decoder; 0.34 on lean; 0.18 on light. | measurement | `hardware.md:76-78` ("a second or so"); `site/data/builder.js:120`, `:124`. | F11. |
| 77 | `site/data/builder.js:99` | The screen dashboard costs half a core. | estimate | "an estimate"; `hardware.md:207`. | At the Brisbane base the load fell from 4.7 to 2.8 with the screen off (`hardware.md:105-106`). |
| 78 | `site/js/builder.js:72-75` | Quiet is 2 bursts a minute a channel, busy 8, heavy 20; the Brisbane base "runs near heavy". | assumption | No source. | Count bursts per channel per minute in the worst hour from Flood-Net's hourly roll-ups. |
| 79 | `site/data/builder.js:101` | 30 MB a channel. | estimate | — | RPi ALERT says about 40 MB (`hardware.md:114`). |
| 80 | `site/data/builder.js:119-120`; `site/trial.html:110` | Lean: a third of the time a burst; 14 of 11,628 live bursts read differently (0.12%). | measurement | The first base station, overnight. | In RPi ALERT's records. |
| 81 | `site/data/builder.js:121-122`; `site/build.html:140` | Around bursts: a quarter to a fifteenth of the work asleep; first live check missed some of the weakest bursts; off by default. | measurement | The first base station, November 2026. | `RPi_ALERT/docs/configuration.md:146-162`. |
| 82 | `site/data/builder.js:123-124`; `site/trial.html:112` | Light: half of lean's time a burst (65 ms against 122); the same 642 readings in 600 made-up bursts. | measurement | Bench. | Not yet proved live ("checking"). |
| 83 | `site/js/builder.js:77-91` | The model counts ALERT1 only. | gap | — | Measure what an ALERT2 burst costs (`alert2-air.js`) and add a term. |
| 84 | `site/js/builder.js:238`; `site/data/builder.js:182` | "A module that is in stock today can be 12 weeks away tomorrow." | lead time | — | A fair warning; it applies most to the single-source Toradex parts. |

## B7. The custom path

| # | Where | The claim | Kind | Rests on | How to check |
|---|---|---|---|---|---|
| 85 | `site/build.html:156` | "Most of a Pi's bad name comes from SD cards, plug-pack supplies and sticks hanging off USB ports — not from the processor." A carrier of your own "carries no Raspberry Pi name". | security, decision | No source. | Ask the approving bodies what they actually object to. |
| 86 | `site/build.html:158` | Step 1: trial a CM5 on its IO board "(nothing to port)" or a Verdin AM62 on Mallow "(the open carrier design)". | decision | — | A CM5 is still a Raspberry Pi; RPi ALERT "has not been tested on a Compute Module yet" (`site/js/builder.js:243`). |
| 87 | `site/build.html:159`; `site/data/builder.js:347-348` | Step 2: a lighter decoder — "together they bring a busy site within reach of a dual-core module". 2–8 weeks, no hardware cost. | CPU | Flood-Net #259; RPi ALERT #3 (`atlas.json:360-372`). | F8, F9, F10: partly done, partly failed its check. |
| 88 | `site/build.html:160`; `site/data/builder.js:251-256`, `:349-350` | Step 3: nobody sells an RTL-SDR on an M.2 card; designing one is A$3,000–8,000 ex GST and 6–12 weeks; A$40–90 a card after; mainstream distributors do not stock the RTL2832U, so "lifetime-buy the chips". | price, process, stock | <https://forum.digikey.com/t/alternative-for-rtl-sdr-rtl2832u/29884>; the money and time are `conf: 'low'`. | Quotes from a designer. Note the supply risk it admits: the receiver chip is a consumer TV part. |
| 89 | `site/build.html:161`; `site/data/builder.js:351-352` | Step 4: a custom carrier from a published design — A$15,000–40,000 ex GST, 13–26 weeks, two board spins. | price, process | <https://www.toradex.com/products/carrier-board/mallow-carrier-board>; `conf: 'low'`. | Quotes from a Toradex or Raspberry Pi design partner. |
| 90 | `site/data/builder.js:353-354` | EMC testing and the RCM for a board of your own: A$5,000–15,000 ex GST, 2–6 weeks. "An off-the-shelf module and carrier carry their own compliance; a carrier you design needs its own before it goes on a Bureau site." | security, price | <https://www.acma.gov.au/compliance-labelling>; `conf: 'low'`. | A test lab's quote. The first half is unproven: the records list CE and FCC only (row 39), and in Australia the supplier who puts the finished box on the market answers for it. |
| 91 | `site/data/builder.js:284` | A CM5 IO board's M.2 slot is PCIe only, so a USB card SDR needs a carrier of your own. | product fact | <https://docs.toradex.com/116791-mallow_carrier_board_datasheet.pdf> (for Mallow's side) | Read the CM5 IO board's datasheet. |

---

# Part C — the custom path in full, and the builder's other computers

## C1. The custom path, word for word

Fixed text, `site/build.html:154-168`:

> **The custom path — away from the Raspberry Pi**
>
> Most of a Pi's bad name comes from SD cards, plug-pack supplies and sticks hanging off USB ports — not from the processor. A Compute Module or a Verdin module on a carrier fixes the first two today; a carrier of your own fixes the rest and carries no Raspberry Pi name. The order that keeps risk low:
>
> 1. **Trial on an off-the-shelf carrier.** A CM5 on its IO board (nothing to port) or a Verdin AM62 on Mallow (the open carrier design), with sticks held as above.
> 2. **Make the decoder lighter.** Measured on Flood-Net's own decoder: a burst's decode spends two thirds of its time re-filtering the window for each of 45 guesses — filtering once per carrier guess and nudging afterwards gives the same readings in 45% of the time. And between bursts, every channel filters the stick's whole window all the time — watching for bursts with a few FFTs a second and filtering a channel only when one arrives cut that work about 40-fold in a prototype. Both keep the box decoding exactly as the website does, and together they bring a busy site within reach of a dual-core module.
> 3. **Put the SDR on an M.2 card.** No one sells an RTL-SDR on M.2; a small card is a contained design job, testable in Mallow's B-key slot, and becomes the receiver block of the final carrier. Keep it swappable and write the software against a general SDR interface, so the RTL2832U — which mainstream distributors don't stock — can be replaced without a rewrite. Lifetime-buy the chips you'll need.
> 4. **Design the carrier.** From a published design: 9–36 V input with surge and reverse protection, a watchdog, a battery clock, the SDR on board or in M.2, a DIN-rail footprint. Then EMC testing and the RCM.
>
> *(a chart of time and cost, then the list below)*
>
> **Sources** — Every price and specification comes from these, or is marked as an estimate. Confirm before you buy: stock and lead times change weekly.

The list under the chart is drawn from `site/data/builder.js:346-355` by `customView()` (`site/js/builder.js:569-581`). As it reads on the page, each line ending in an "estimate" chip:

> - **Lighter decoder (filter once per guess, bursts-only front end)** — 2–8 weeks. No hardware cost. Half done: RPi ALERT 0.17 decodes a burst in a third of the time and does a quarter less between bursts. Left: filtering each channel only around bursts, about a fortieth of the between-bursts work in a prototype.
> - **M.2 RTL-SDR card: design and first boards** — A$3,000–8,000 ex GST, 6–12 weeks. Small, self-contained, testable on today's CM5 IO board or Mallow. Lifetime-buy the RTL2832U chips: mainstream distributors don't stock them. [DigiKey forum: no RTL2832U on DigiKey](https://forum.digikey.com/t/alternative-for-rtl-sdr-rtl2832u/29884)
> - **Custom carrier board (CM5 or Verdin)** — A$15,000–40,000 ex GST, 13–26 weeks. Start from a published design (Mallow's Altium files, or the CM5 IO board's KiCad files): 9–36 V input with surge and reverse protection, watchdog, RTC, the SDR on board or in M.2, DIN-rail footprint. [Toradex Mallow (design files)](https://www.toradex.com/products/carrier-board/mallow-carrier-board)
> - **EMC testing and RCM for a board of your own** — A$5,000–15,000 ex GST, 2–6 weeks. An off-the-shelf module and carrier carry their own compliance; a carrier you design needs its own before it goes on a Bureau site. [ACMA: the RCM](https://www.acma.gov.au/compliance-labelling)

The data behind each line, with what the page does not show:

| `id` | `aud` (ex GST) | `lead.d` days | `lead.text` | `where` (in the data, not drawn) | `conf` |
|---|---|---|---|---|---|
| `decoder` | 0 – 0 | 14 – 56 | "open-source work in Flood-Net and RPi ALERT; an estimate" | [RPi ALERT](https://github.com/cdomotor-g/RPi_ALERT), [Flood-Net](https://github.com/cdomotor-g/MegaNet) | low |
| `m2card` | 3,000 – 8,000 | 42 – 84 | "a designer, prototypes, bring-up; an estimate" | [A PCB designer with RF experience](https://www.engineersaustralia.org.au/), [JLCPCB (prototype boards)](https://jlcpcb.com/) | low |
| `carrier` | 15,000 – 40,000 | 90 – 180 | "specification, layout, two board spins; an estimate" | [Toradex design partners](https://www.toradex.com/support/partner-network/hardware/carrier-boards), [Raspberry Pi Approved Design Partners](https://www.raspberrypi.com/for-industry/design-partners/) | low |
| `emc` | 5,000 – 15,000 | 14 – 42 | "a test lab booking; an estimate" | [NATA-accredited EMC test labs](https://nata.com.au/) | low |

Added up: A$23,000–63,000 ex GST and roughly 4–9 months if the steps overlap little. Related entries elsewhere: the planned M.2 card as a receiver choice (`site/data/builder.js:251-256`: A$40–90 a card, "No off-the-shelf M.2 RTL-SDR card was found … The AM62 has no PCIe, so on a Verdin the card must be a USB device") and the "In the M.2 slot" way of holding it (`:282-285`).

## C2. The builder's computers

From `site/data/builder.js:141-223`, with `hw.sdrCh` from the catalogue. "× Pi 4" is `sdrCh ÷ 8`.

| `id` | Short name | Kind | `sdrCh` | × Pi 4 | Price in the builder | Lead (days) | Where | Install route | `conf` |
|---|---|---|---|---|---|---|---|---|---|
| `rpi-4-4gb` | Pi 4 | board | 8 | 1 | A$162.20–163 inc GST | 2–7 | Little Bird, Core Electronics | `pi` | high |
| `rpi-3b-plus` | Pi 3B+ | board | 4 | ½ | A$64.79–83.23 inc GST | 2–7 | Little Bird, Core Electronics | `pi` | medium |
| `rpi-5-4gb` | Pi 5 | board | 16 | 2 | A$178.42–249 inc GST | 2–40 | Altronics, Jaycar, Core Electronics | `pi` | medium |
| `rpi-cm5-io` | CM5 + IO board | module | 16 | 2 | A$247.25–255 inc GST | 14–90 | Core Electronics, Little Bird, element14 | `cm` | medium |
| `revpi-connect-5` | RevPi Connect 5 | box | 12 | 1½ | A$1,038.19–1,196.18 ex GST | 5–14 | DigiKey Australia, RS Australia | `cm` | low |
| `toradex-verdin-am62-mallow` | AM62 Quad + Mallow | module | 4 | ½ | A$680.47 ex GST | 5–91 | element14 Australia; Toradex webshop | `verdin` | medium |
| `toradex-verdin-am62-dual-mallow` | AM62 Dual + Mallow | module | 2 | ¼ | A$512.28–534.15 ex GST | 5–91 | element14 Australia; Toradex webshop | `verdin` | medium |
| `toradex-luna-sl1680` | Luna SL1680 | board | 9 | 1.1 (est.) | A$210.14–255 ex GST | 7–35 | Toradex webshop | `luna` | low |
| `mini-pc-n150` | N150 mini PC | box | 24 | 3 | A$230–350 inc GST | 2–10 | Mwave, Amazon Australia | `debian` | low |
| `fanless-industrial-x86` | Fanless industrial x86 | box | 20 | 2½ | A$900–2,500 ex GST | 10–42 | OnLogic, Advantech Australia | `debian` | low |

Notes on the ones that are not Toradex:

- **`mini-pc-n150`** — "Three times a Pi 4 with an SSD, for the price of a Pi 5 kit. Office temperatures, a fan, and a model that changes every year" (`site/data/builder.js:212`). `src: []`. Catalogue: 0–40 °C, grade 2, price an estimate (`site/data/compute.js:424-437`).
- **`fanless-industrial-x86`** — "Sealed, wide DC input, industrial temperature, five years and more per model, nothing that says Raspberry Pi. Five to ten times the price of a Pi" (`site/data/builder.js:220`). One generic record for a whole class (OnLogic Karbon, Advantech ARK): −25 to +70 °C, grade 4, A$1,800 ex GST "typical configured price", `conf: 'low'` (`site/data/compute.js:465-477`). No named model, no measured figure.
- **`revpi-connect-5`** — a Raspberry Pi Compute Module 5 in a German DIN-rail case, 24 V, CE and UL, a TPM; 7 in stock at DigiKey Australia (`site/data/compute.js:204-219`). Rated 1½ Pi 4s, not 2, with no reason given (the record says "expect throttling at 60 °C").
- **The `debian` route** (`site/js/builder.js:246`): "Install Debian 13 (Trixie) from a USB stick … `sudo apt install git`, `git clone …`, `sudo ./RPi_ALERT/os/install.sh`. The installer is plain Debian (apt, systemd, udev) but has only been run on Raspberry Pi OS: the Pi-only parts (under-voltage, boot partition settings) do nothing here." No container.

Other non-Pi computers already in the catalogue but not in the builder (`site/data/compute.js`): BeaglePlay (`:335`, open hardware, the AM62 chip, `sdrCh` 3, A$266.95 in stock in Australia, 0–70 °C); Siemens IOT2050 (`:381`, Debian-based, `sdrCh` 2, 0–50 °C, quote); Moxa UC-8200 (`:366`, `sdrCh` 1, quote); Radxa ROCK 5B (`:395`, `sdrCh` 16, `conf: 'low'`, quote); a used business mini PC (`:452`, `sdrCh` 30, A$200 used). Everything else in the "industrial" block is a Raspberry Pi Compute Module in a box.

---

# Could not confirm

Nothing outside the three local repositories was opened, so every outside fact below is as the repository states it.

1. **What element14 order code 4852670 really is**, its price and its stock (F1). The repository itself could not re-read the page.
2. **Toradex's price for one module**, and whether US$107.40 is a volume price (F2); whether its shop sells only to businesses; its courier charge to Australia.
3. **Any Toradex product fact**: the six variants and their specifications, Mallow's 7–24 V input, the USB and M.2 wiring, the temperature ratings, the 2033 availability date, the approvals, the licence on Mallow's design files, the heatsink that fits, the Easy Installer and Torizon steps, the default login.
4. **Anything about the Luna SL1680**: its existence as described, price, datasheet figures, software, product life. My own recollection supports only that Synaptics' SL1680 has four Cortex-A73 cores at 2.1 GHz.
5. **How fast any A53, A73 or x86 computer runs RPi ALERT's decoder.** The only measurements in either repository are on a Raspberry Pi 4.
6. **Whether the container recipe works**: it has never been run. I checked only that the command, the two folders, the port and the Node version it assumes match RPi ALERT 0.23.1's code.
7. **Whether the TI AM62 limits Mallow's ports to USB 2.0** — from memory, not from a datasheet.
8. **Any IT security requirement** of the Bureau, a council or a water authority: the repository cites none.
9. **The custom path's costs and times**: all four are marked estimates with no quote behind them.
10. **The shop prices and stock for the non-Toradex computers**: read from the records, not re-checked. The N150 and fanless x86 entries have no source at all.
