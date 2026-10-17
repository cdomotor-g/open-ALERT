# open-ALERT

A configurator for **ALERT and ALERT2 flood-warning networks**: field stations, repeaters
and base stations. Say what each site must do; see the hardware that fits — open and
closed, Raspberry Pi to industrial, budget to mission-critical — and then what your
choices cost and what they commit you to.

**→ Open the configurator: <https://cdomotor-g.github.io/open-ALERT/>**

It is a static page with no build step and no server: everything runs in the browser, and
what you build is kept in your browser and in share links.

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

## The catalogue

248 parts, each with where it fits, what it can do, its price and where the price came
from, its power, operating temperature, a 1–5 grade for field use, status (current, young,
end of life, planned, DIY), firmware and openness, pros and cons, and sources.

| Family | Parts | For example |
|---|---|---|
| ALERT equipment | 14 | ELPRO ERT-A2 and 115E-2-A2 gateway, Campbell ALERT200X / ALERT205X / ALERT121A / AL200X / AL205B, HSE 3306 / 333X / 1012, Hydrolynx |
| Software & firmware | 10 | RPi ALERT, FW-LAB Receiver, the Flood-Net Serial Monitor, Campbell ALERT2ADM, OneRain Contrail, the Bureau's Enviromon; a minimodem encoder; open-ALERT's encoder firmware and repeater (planned) |
| Loggers & computers | 42 | Raspberry Pi 5 / 4 / Zero 2 W / CM4; industrial Pis (Revolution Pi, Strato Pi, reComputer, OnLogic, CompuLab, EDATEC); BeagleBone, Moxa, Siemens IOT2050; N150 mini PCs and fanless x86; ESP32, Pico 2, STM32, Arduino Opta; Campbell CR310 / CR350 / CR1000X, OTT, HyQuest, Unidata, EnviroDIY Mayfly |
| Radios | 23 | RTL-SDR Blog V3/V4, Airspy, SDRplay, Ettus; Quansheng UV-K5; Tait TM9300 / TM8100, Maxon, Kenwood, Icom, Motorola, Ritron |
| RF parts | 31 | Yagis and collinears, LMR-400 and Heliax, PolyPhaser arrestors, cavity filters, duplexers, GPS antennas and HATs, a dummy load |
| Sensors | 32 | KISTERS / HyQuest TB3 and TB4, Rimco, OTT Pluvio²; pressure, radar, ultrasonic, encoder and bubbler level sensors; SDI-12, 4–20 mA and RS-485 interfaces |
| Power | 40 | Victron and Exotronic panels; Victron, Genasun and Morningstar regulators; AGM and LiFePO4 batteries; Mean Well supplies and DC UPSs; office UPSs; Pi UPS HATs |
| Site, backhaul, accessories | 56 | Fibox and stainless enclosures, poles and masts, earthing, sun shields; Teltonika routers, Iridium and Myriota, Starlink Mini, LoRaWAN, data plans; boot cards, RTCs, cases, hubs, screens |

Most ALERT equipment is sold by quote. Where Flood-Net's ALERT2 transition plan has a
planning figure it is used and labelled an estimate; elsewhere the price is blank and the
page asks for your quote. Prices are indicative, in Australian dollars, gathered in
October 2026; GST and US dollars are a setting.

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
site/index.html      the page (and the How it works text)
site/style.css       light and dark themes, phone to desktop, print
site/data/*.js       the catalogue: ALERT equipment, computers, radios and RF, sensors, power, site
site/js/engine.js    needs → requirements → fit → supporting parts → power → cost → consequences
site/js/presets.js   preset sites and example networks
site/js/ui.js        draws what the engine returns; state in localStorage and share links
test/                node --test
```

## Publishing

`.github/workflows/pages.yml` publishes `site/` to GitHub Pages on every push to `main` that
touches it. One-time setting: **Settings → Pages → Source: GitHub Actions**.

## Related

[RPi ALERT](https://github.com/cdomotor-g/RPi_ALERT) (a Raspberry Pi base-station OS),
[quansheng_alert_v3](https://github.com/cdomotor-g/quansheng_alert_v3) (a Quansheng UV-K5 as
an ALERT1 receiver), [ALERT1v3](https://github.com/cdomotor-g/ALERT1v3) (an RTL-SDR and GNU
Radio receiver), [ALERT_PACKETS](https://github.com/cdomotor-g/ALERT_PACKETS) (encode and
decode ALERT frames) and [Flood-Net](https://floodwarning.net/), where the readings go.

Not legal advice: a transmitter on an ALERT channel needs compliant equipment and an ACMA
apparatus licence, normally held by the network owner.

MIT licence.
