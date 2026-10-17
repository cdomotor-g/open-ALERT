# Instructions for Claude Code

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
