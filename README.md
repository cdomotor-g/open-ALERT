# open-ALERT

A configurator for **ALERT and ALERT2 flood-warning networks**: field stations, repeaters
and base stations. Say what each site must do; see the hardware that fits — open and
closed, Raspberry Pi to industrial, budget to mission-critical — and then what your
choices cost and what they commit you to.

**→ Open the configurator: <https://cdomotor-g.github.io/open-ALERT/>**

**→ Build a base station: <https://cdomotor-g.github.io/open-ALERT/build.html>** — the base
station builder (below).
**→ Trial a computer beside a Pi: <https://cdomotor-g.github.io/open-ALERT/trial.html>** — the
side-by-side trial (below).

**→ Other computers, beyond the Pi: <https://cdomotor-g.github.io/open-ALERT/hardware.html>** — the
hardware review put where you can explore it (below).

Every page has the same menu: **Plan** (Sites, Network, Parts), **Build** (Base station,
Side-by-side trial, Other computers) and **Learn** (How it works).

It is a static page with no build step and no server: everything runs in the browser, and
what you build is kept in your browser and in share links.

On a phone it installs as an app (Share → Add to Home Screen on an iPhone, Install app on
Android), and opens without a signal from the last copy it saw. Old addresses under `site/`
still lead to the right page.

## How it works

Each site goes through four steps.

1. **Needs.** What must it do? The protocol (ALERT1, ALERT2, switchable, or no ALERT radio
   at all), what it measures, its power and how long it must ride out a wet spell, where
   the electronics live (an air-conditioned room, a hut, a sealed box in full Queensland
   sun), how much reliability matters against cost, whether it must be open source,
   vendor support, the skills you have, and a budget.
2. **Requirements.** The answers become a list of requirements — each a *must* or a
   *should*, each traced to the answers it came from.
3. **Hardware.** Each part of the site (controller, encoder, radio, sensors, antenna, GPS,
   backhaul, solar, regulator, battery, enclosure; receivers, host and software at a base)
   lists every catalogued option that goes there, ranked so the ones that meet every
   requirement come first, each with the reasons it fits or doesn't. Picking an
   integrated unit (an ELPRO ERT-A2, a Campbell ALERT200X, an HSE 333X) fills the slots it
   makes unnecessary. The **supporting parts** a choice drags in — coax, connectors,
   arrestor, earth kit, pole, a 12 → 5 V converter for a Pi, a boot card, a battery clock,
   an SDI-12 adapter for a DIY controller, a SIM, the ACMA licence — are added for you,
   each with alternatives.
4. **Result.** The bill of materials (type your own quotes over the catalogue prices), the
   power budget with the battery and panel sized for it, installation labour and the
   running costs over the years you choose, whether every requirement is met, and the
   **consequences**: whose firmware it runs and who maintains it, what is closed, licensing
   and compliance, the skills it needs, heat, SD cards, the life and replacement of each
   part, single suppliers, maintenance visits, and the path each reading takes.

The **Network** tab adds the sites up (each with a quantity) and checks that what the field
stations send, the repeaters relay and the bases receive actually meet — that an ALERT1
gauge has an ALERT1 base or a concentrator, that ALERT2 has a path, that a concentrating
ERT-A2 can't also repeat ALERT2 with one receiver. The **How it works** tab in the page
sets out every assumption behind the numbers (power, battery, solar, heat, labour, grades)
and what Australian law asks of a transmitter.

## The base station builder

`site/build.html` goes deeper on one kind of site: a receiving base station running
[RPi ALERT](https://github.com/cdomotor-g/RPi_ALERT) and forwarding to Flood-Net.

- **How it works** — a diagram from field station to Flood-Net (tap a part for what it does
  and which code does it), and how a single board, a module on a carrier and a boxed computer
  fit together physically, with the SDR on USB or in an M.2 slot.
- **Build one** — pick the computer (Pi 3B+ / 4 / 5, Compute Module 5, Revolution Pi Connect 5;
  fanless N150 PCs: OnLogic CL260, Lenovo ThinkEdge SE10n Gen2, Protectli VP2430; the cheap start:
  an N150 mini PC or a refurbished ThinkCentre M920q Tiny; CompuLab fitlet3 for hot cabinets;
  a general entry for other fanless industrial x86 PCs; Moxa UC-4400A; BeagleY-AI and
  BeaglePlay; Toradex Verdin iMX95, AM62 Quad and Dual on Mallow and the Luna SL1680, the last
  three marked not recommended or comparison only), the channels, the SDR
  and how it's held (straight in, a clamped extension, a sealed Bulgin locking USB, or an M.2
  card to design), the antenna and RF chain, power, backhaul and the box. It plans the sticks
  (the narrowest window that holds each stick's channels, as RPi ALERT tunes them), works out
  the CPU each computer would need from RPi ALERT's own measurements — today and with the
  planned faster decoder — draws the box from what's in it, and gives the bill with **price
  ranges, lead times and where to buy**, a lead-time chart and the **build steps**, from
  flashing to checking the readings arrive in Flood-Net.
- **A board of your own** — later, and only for a reason. Buy off the shelf first and prove it
  with the side-by-side trial; make the decoder lighter before the hardware bigger; build a
  carrier board only if an approval or a site fails for a reason a carrier fixes. The four
  bases to start from (Mallow's files carry no open-source licence), what it takes to sell a
  board in Australia, and the hardware review's own estimates of cost and time, marked as
  estimates.
- **What the words on this page mean** — one list, shared with the trial and the Other
  computers pages (`terms` in `site/data/review.js`).

Its data is `site/data/builder.js` (ranges, lead times, suppliers and sources for every part,
referring to catalogue records for the rest) and its logic `site/js/builder.js`; the tests in
`test/builder.test.js` hold the stick planner and the CPU model to RPi ALERT's documented
cases.

## The side-by-side trial

`site/trial.html` is the plan for trying a computer that is not a Raspberry Pi beside the
Raspberry Pi 4 already running RPi ALERT, on one antenna split two ways, for two weeks with
the sticks swapped halfway. You pick the computer from the builder's non-Pi computers (the
default is an N150 mini PC, the cheapest way to learn; the OnLogic CL260 and the Lenovo
ThinkEdge are the ones to buy for real) and the page follows the pick: the set-up drawn; a
table rating every computer for your channels, for the whole computer and for one core;
**step 0, the benchmark** (`firmware/bench`) before a second computer is bought; the builder's
speed estimate; a shopping list with prices, lead times and where to buy (ticked off as parts
arrive; where no price could be read it says so and links the seller); the steps — the
Pi's baseline, the package route (Debian 13 or Ubuntu 24.04 and `open-alert-base`) or, for a
Verdin, Torizon OS and the container with no privileges; the splitter on site; a results
sheet that works out the verdicts, and what to do when it won't. The six Verdin AM62s are in
a fold ("If you still want the Verdin") with the corrected prices. The firmware is new and
nothing has yet been run with a real radio stick on a computer that is not a Raspberry Pi: the
trial is where that gets proved. (This page used to be the Mallow trial, for a Toradex Verdin
AM62 on a Mallow carrier; the hardware review found that trial should not be run as written.
A results sheet or ticks saved by the earlier page still read.) Its list and verdicts are `site/js/trial.js`, tested in
`test/trial.test.js`.

## The hardware review

`site/hardware.html` ("Other computers" in the menu) is the review of the old Mallow trial and
of which computer, other than a Raspberry Pi, should run a base station. It has the verdict,
that trial's claims one by one, what an IT security review asks, a comparison of every computer
(filters, sorting, up to three side by side), prices and where to buy with links (Australian
sellers first), diagrams, and photographs where the licence allows. Its data is
`site/data/review.js` and `site/data/review-images.js`; its code is `site/js/review.js`; its
tests are `test/review.test.js`. Every figure names the research report it rests on.

The same review, written out for reading on GitHub:

- [docs/hardware-review/README.md](docs/hardware-review/README.md): the appraisal, in plain
  words. **Buy a fanless N150-class PC with a TPM** (the OnLogic CL260 for a battery site, the
  Lenovo ThinkEdge where the brand matters), prove it on the bench with a cheap mini PC first,
  and keep the Verdin AM62 and the Luna out of the order book. The old Mallow trial was not to
  be run as it was written; its page is now the side-by-side trial.
- [docs/hardware-review/comparison.md](docs/hardware-review/comparison.md): the comparison
  tables, as Markdown.
- [docs/hardware-review/research/](docs/hardware-review/research/): the thirteen research
  reports and three re-checks of them (sixteen files).
- [docs/security/](docs/security/README.md) and [SECURITY.md](SECURITY.md): what an IT assessor
  is handed, and how to report a flaw (drafts; the owner has to switch on private reporting in
  the repository's settings).

**What is not yet known:** nothing has been run with a real radio stick on a computer that is
not a Raspberry Pi; no Pi 4 has run the benchmark, so every speed figure is a stand-in; prices
need a person to check them in a browser; no ARM computer has run the package; nobody has
checked that the package installs on Moxa's Secure system; the firmware has no release yet.

## The firmware: a base station on another computer

[`firmware/`](firmware/README.md) takes **RPi ALERT's signed release, unchanged**, and wraps it
for computers that are not a Raspberry Pi and for networks whose IT team must approve what is
plugged in: a package (`open-alert-base`) for any Debian 13 or Ubuntu 24.04 computer, the same in
a container with no privileges (for Torizon and container hosts), and ready-to-flash disk
images. Two profiles: **standard** (like a Pi base station on a small network) and
**enterprise** (no hotspot, no remote changes from Flood-Net, no self-reboots, dashboard
reachable from the computer itself only, web-proxy and private-certificate support).

As at 13 November 2026: the package is built, and its own checks pass on Debian 13 and Ubuntu
24.04 with stand-ins for the radio, on one test computer that has no USB; the container has
been tried with stand-ins for the radio on one PC only (never on Torizon OS, on an ARM computer or
with a real stick); the disk images are still being written; nothing is released; and nothing has
been tried with a real radio stick off a Raspberry Pi. The firmware is still being worked on,
so [`firmware/README.md`](firmware/README.md) is always the current word on what has been
tested where. Releases will appear at <https://github.com/cdomotor-g/open-ALERT/releases> (none
on that date). `firmware/bench` is a benchmark for how many channels a computer will carry.

## The catalogue

263 parts, each with where it fits, what it can do, its price and where the price came
from, its power, operating temperature, a 1–5 grade for field use, status (current, young,
end of life, planned, DIY), firmware and openness, pros and cons, and sources.

| Family | Parts | For example |
|---|---|---|
| ALERT equipment | 14 | ELPRO ERT-A2 and 115E-2-A2 gateway, Campbell ALERT200X / ALERT205X / ALERT121A / AL200X / AL205B, HSE 3306 / 333X / 1012, Hydrolynx |
| Software & firmware | 10 | RPi ALERT, FW-LAB Receiver, the Flood-Net Serial Monitor, Campbell ALERT2ADM, OneRain Contrail, the Bureau's Enviromon; a minimodem encoder; open-ALERT's encoder firmware and repeater (planned) |
| Loggers & computers | 57 | Raspberry Pi 5 / 4 / 3B+ / Zero 2 W / CM4 / CM5; Toradex Verdin AM62 Quad and Dual and iMX95 on Mallow, Luna SL1680; industrial Pis (Revolution Pi, Strato Pi, reComputer, OnLogic, CompuLab, EDATEC); BeagleBone, BeaglePlay, BeagleY-AI, Olimex iMX8MP, Moxa UC-4400A, Siemens IOT2050; fanless N150 PCs (OnLogic CL260, Lenovo ThinkEdge SE10n Gen2, Protectli VP2430), CompuLab fitlet3, Eurotech ReliaCOR, Dell OptiPlex Micro, refurbished ThinkCentre Tinys; N150 mini PCs and generic fanless x86; ESP32, Pico 2, STM32, Arduino Opta; Campbell CR310 / CR350 / CR1000X, OTT, HyQuest, Unidata, EnviroDIY Mayfly |
| Radios | 23 | RTL-SDR Blog V3/V4, Airspy, SDRplay, Ettus; Quansheng UV-K5; Tait TM9300 / TM8100, Maxon, Kenwood, Icom, Motorola, Ritron |
| RF parts | 31 | Yagis and collinears, LMR-400 and Heliax, PolyPhaser arrestors, cavity filters, duplexers, GPS antennas and HATs, a dummy load |
| Sensors | 32 | KISTERS / HyQuest TB3 and TB4, Rimco, OTT Pluvio²; pressure, radar, ultrasonic, encoder and bubbler level sensors; SDI-12, 4–20 mA and RS-485 interfaces |
| Power | 40 | Victron and Exotronic panels; Victron, Genasun and Morningstar regulators; AGM and LiFePO4 batteries; Mean Well supplies and DC UPSs; office UPSs; Pi UPS HATs |
| Site, backhaul, accessories | 56 | Fibox and stainless enclosures, poles and masts, earthing, sun shields; Teltonika routers, Iridium and Myriota, Starlink Mini, LoRaWAN, data plans; boot cards, RTCs, cases, hubs, screens |

Most ALERT equipment is sold by quote. Where Flood-Net's ALERT2 transition plan has a
planning figure it is used and labelled an estimate; elsewhere the price is blank and the
page asks for your quote. Prices are what one costs in November 2026 from an Australian
shop with it in stock — or, where none has, the cheapest way to get one (a back-order, or a
shop overseas), and the part says which. Every bill adds each shop's delivery once, and an
overseas order over A$1,000 the border's GST and clearance charges. GST and US dollars are a
setting.

**22 presets** (an ERT-A2 rain gauge, a Campbell ALERT2 station, an open ESP32 gauge, a Pi
Zero field station, IP gauges, a bench prototype; ERT-A2 and HSE repeaters, a DIY Pi
repeater; Pi + RTL-SDR bases, an industrial CM4 base, a turn-key ELPRO base, a desk trial,
a GNU Radio base, a Campbell base, a survey kit) and **5 example networks** are starting
points: every answer and pick can be changed.

## Run it locally

```
cd site && python3 -m http.server 8000      # then open http://localhost:8000/
```

Opening `site/index.html` straight from disk works too. The tests need Node 18 or later
and nothing else:

```
npm test
```

They check every catalogue record and every reference in it, load every preset (the ones
built from parts you can buy today must meet every *must*), and check the sizing, pricing
and network rules against what the page says they do.

## Adding hardware

The catalogue is plain JavaScript in [`site/data/`](site/data), one file per family. A part
is a record like this:

```js
{
  id: 'tait-tm9300', name: 'Tait TM9300 (TM9355) VHF mobile', vendor: 'Tait Communications (NZ)', cat: 'lmr',
  slots: ['field:radio', 'repeater:radio'],          // where it goes: role:slot
  blurb: 'The current Tait mobile — analogue FM, DMR and MPT in one, 136–174 MHz, 1 to 25 W.',
  price: { aud: 900, gst: true, basis: 'used', src: 'eBay Australia sold listing', asof: '2026-10' },
  power: { w: 0, txW: 75.9, rxW: 1.4, supply: '12V' }, temp: [-30, 60],
  grade: 5, gradeWhy: 'utility and emergency-services standard', support: 'vendor', acma: true,
  hw: { band: [136, 174], rfW: 25, dataPort: true },
  open: { hw: 'closed', sw: 'closed' },
  status: 'current', lifeYears: 15,
  pros: ['…'], cons: ['…'],
  src: [['Tait TM9300 datasheet', 'https://…']], conf: 'high', tags: ['lmr'],
}
```

The header of each data file describes its fields; [`site/js/engine.js`](site/js/engine.js)
holds the needs, the requirements they become, the per-slot fit rules, the supporting
parts, the power and cost models and the consequences. Add a part, run `npm test`, and open
a pull request. Specifications come from datasheets and vendor pages: confirm them before
you buy. The catalogue is a starting point, not an endorsement.

## Layout

```
site/index.html      the configurator (and the How it works text)
site/build.html      the base station builder (site/build.css, site/js/builder.js, site/data/builder.js)
site/trial.html      the side-by-side trial (site/js/trial.js; styles in site/build.css)
site/hardware.html   Other computers: the hardware review (site/data/review.js, site/js/review.js, site/review.css)
site/img/hw/         the photographs that page may show, each under its own licence (site/data/review-images.js)
site/style.css       light and dark themes, phone to desktop, print
site/data/*.js       the catalogue: ALERT equipment, computers, radios and RF, sensors, power, site
site/js/engine.js    needs → requirements → fit → supporting parts → power → cost → consequences
site/js/presets.js   preset sites and example networks
site/js/ui.js        draws what the engine returns; state in localStorage and share links
test/                node --test
firmware/            a base station on a computer that is not a Pi: the package, the pin, the benchmark
docs/hardware-review the review, the comparison tables and the research (thirteen reports, three re-checks)
docs/security        what an IT assessor is handed (SECURITY.md in the root says how to report a flaw)
atlas.json           this repository on the Atlas map of all the repositories
```

## Publishing

`.github/workflows/pages.yml` publishes `site/` to GitHub Pages on every push to `main` that
touches it. One-time setting: **Settings → Pages → Source: GitHub Actions**. (Under the older
"Deploy from a branch" setting, the root `index.html` sends visitors on to `site/`.)

## Related

[RPi ALERT](https://github.com/cdomotor-g/RPi_ALERT) (a Raspberry Pi base-station OS),
[quansheng_alert_v3](https://github.com/cdomotor-g/quansheng_alert_v3) (a Quansheng UV-K5 as
an ALERT1 receiver), [ALERT1v3](https://github.com/cdomotor-g/ALERT1v3) (an RTL-SDR and GNU
Radio receiver), [ALERT_PACKETS](https://github.com/cdomotor-g/ALERT_PACKETS) (encode and
decode ALERT frames) and [Flood-Net](https://floodwarning.net/), where the readings go.

Not legal advice: a transmitter on an ALERT channel needs compliant equipment and an ACMA
apparatus licence, normally held by the network owner.

MIT licence.
