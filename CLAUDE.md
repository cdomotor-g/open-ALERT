# Instructions for Claude Code

## Atlas — this repo on the map of all the repos
- This repo is **`open-alert`** on the Atlas (<https://cdomotor-g.github.io/atlas/>). How to work with the map — `atlas.json`, the repositories that rely on this one, asks, pins, status and blockers — is in the shared instructions (`shared/on-the-atlas.md` in the Atlas).
- The catalogue cites six sibling repositories. Its `consumes` entries are `reference` links with a review date (or, for RPi ALERT, the version the catalogue names): when you re-check a catalogue entry against its source, move that entry's `since` date to today.

<!-- shared:start · written by tools/shared.mjs in cdomotor-g/atlas; the rules themselves live in its shared/ folder -->
## Shared instructions — loaded from the Atlas
The rules every one of my repositories shares live in one file in the Atlas: how to end a run (the run summary), pushing to `main`, plain words, private data, who clears what, and issue titles — <https://github.com/cdomotor-g/atlas/blob/main/shared/instructions.md>. This repository is on the Atlas map, so <https://github.com/cdomotor-g/atlas/blob/main/shared/on-the-atlas.md> holds as well.
`.claude/settings.json` loads them when a session starts. If they are not in front of you, fetch them before you reply (`curl -fsS https://raw.githubusercontent.com/cdomotor-g/atlas/main/shared/instructions.md`, and the same for `on-the-atlas.md`) and follow them. Where this file says something different, this file wins.
<!-- shared:end -->

## Checks before pushing
- `npm test` — about a second, no dependencies. It checks every catalogue record and every reference in it, loads every preset, and checks the sizing, pricing and network rules.
- A change to `site/js/ui.js`, `site/style.css` or `site/index.html`: load the page in headless Chromium (Playwright with `executablePath` under `/opt/pw-browsers`; never `playwright install`) and walk every view and step at desktop and phone width — no page errors, no horizontal scroll.

## The catalogue (`site/data/`)
- Prices are Australian dollars; `gst: false` means ex GST. Every price names its basis and source; a quote-only part is `aud: null, basis: 'quote'` (the tests enforce it).
- Every claim about a part needs a source in `src`. Where a figure is a guess, say so (`conf: 'low'`, a note) rather than present it as fact.
- A preset built from parts you can buy today must meet every "must" — the tests check this too.
