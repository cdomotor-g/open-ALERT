# Instructions for Claude Code

## Atlas — this repo on the map of all the repos
- The owner keeps one map of every repository, how they depend on each other and where each is up to: **https://cdomotor-g.github.io/atlas/** (source: `cdomotor-g/atlas`). This repo is **`open-alert`** there and describes itself in **`atlas.json`** at its root (format: the Atlas's `schema/atlas.schema.json`; every field is explained there). The file is public: nothing private goes in it.
- **When you start**, look at this repo's panel on the Atlas, or `atlas.json`: what it takes from other repos (`consumes`), which repos rely on it (*Gives to* in the panel), anything *behind upstream*, and anything waiting on the owner.
- **Forward — you change something another repo relies on** (a path under one of this repo's `provides`, or one another repo's `consumes` entry watches; the Atlas's *Links* view lists them): in the same piece of work, tell each consumer. If that repo is attached to your session, make the matching change there too; otherwise open an issue in it titled `[Standalone] [<Model>/<Effort>] Upstream: <what changed> in <this repo>`, with the commit, what changed and what the consumer has to do. A breaking change always gets one. The consumer's own daily Atlas check flags the drift as well, but only your issue says why.
- **Back — this repo needs another to change**: open an issue there (attach the repo with `add_repo` if your session doesn't have it) and list it under `asks` in `atlas.json` with the issue reference. If you can't file it, list the ask without one so it shows on the map.
- **Catching up**: when you refresh something this repo copies or follows from another (a vendored copy, a generated table, a build, a citation), move that `consumes` entry's pin in the same commit — the file its `since` points at, or its `since` date. A drift issue the Atlas opened closes itself on the next check.
- **When you finish**: if where this repo is up to has changed — what's being done now, what's next, what's blocked (on the owner: `"on": "human"`) — update `status` in `atlas.json`, with today's date in `updated`. Add a `components` / `provides` / `consumes` entry when you add a part another repo uses, or start using another repo's. `.github/workflows/atlas.yml` checks the file on every push that changes it and once a day.
- The catalogue cites six sibling repositories. Its `consumes` entries are `reference` links with a review date (or, for RPi ALERT, the version the catalogue names): when you re-check a catalogue entry against its source, move that entry's `since` date to today.

## Run summary — mark where it starts
- When you finish a piece of work and write your closing report (what you did, what's left, what I need to do), start it with this marker so I can find it by scrolling — a horizontal rule, then a top-level heading with the run number:

  ```
  ---
  # 🏁 THIS RUN SUMMARY (Run 3)
  ```

- The run number counts the summaries in this chat: the first one is Run 1, and each later one is one more than the last marker already in the conversation. A new chat starts again at Run 1.
- Everything above the marker is working notes; everything below it is the report. Use the marker once per reply, only at the start of that closing report, and put nothing after the report but the report.
- Under it, use these bold labels in this order, leaving out any that would be empty: **What changed**, **Checks run**, **What you need to do**, **Open questions**.
- Short replies that are only an answer (no work done) don't need the marker and don't use up a run number.

## Git workflow
- Push straight to `main` after a patch. No pull request, and no branches unless asked.

## Checks before pushing
- `npm test` — about a second, no dependencies. It checks every catalogue record and every reference in it, loads every preset, and checks the sizing, pricing and network rules.
- A change to `site/js/ui.js`, `site/style.css` or `site/index.html`: load the page in headless Chromium (Playwright with `executablePath` under `/opt/pw-browsers`; never `playwright install`) and walk every view and step at desktop and phone width — no page errors, no horizontal scroll.

## The catalogue (`site/data/`)
- Prices are Australian dollars; `gst: false` means ex GST. Every price names its basis and source; a quote-only part is `aud: null, basis: 'quote'` (the tests enforce it).
- Every claim about a part needs a source in `src`. Where a figure is a guess, say so (`conf: 'low'`, a note) rather than present it as fact.
- A preset built from parts you can buy today must meet every "must" — the tests check this too.

## Naming and private data
- In anything a person reads, the network's app is **Flood-Net**, never "MegaNet" (its repository's name).
- No landholder contact details and no site codes anywhere — data files, presets, docs, issues or commit messages.
