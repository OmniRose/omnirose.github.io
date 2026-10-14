# OmniRose relaunch — Phase 1 implementation plan

> **Status (2026-10-14):** M0–M8 are built on the `relaunch` branch. WMM2025 is in `data/WMM.COF`. Still to do, and needing the owner: push, rename the repo, enable Pages. Changes from the plan:
> - jsPDF and a QR library were **not** vendored. A small PDF writer (`js/draw/surface.js`) and QR encoder (`js/qr.js`) were written instead, so there are no third-party files to download or keep up to date.
> - Automatic curve terms use the Bayesian information criterion (up to 7 terms), not a fixed "half the readings" cap.
> - Compass to magnetic now evaluates deviation at the magnetic heading; the old code used the compass heading (up to 3.9° out on boats with large deviation).
> - M8 offers preset areas, "use my location" and a custom lat/long box, rather than a map.

## Goal

A free, friendly static site at **https://omnirose.github.io/** that teaches cruising sailors why their compass lies to them, and turns their deviation readings into a printable **deviation table** and **conversion rose**.

Constraints: plain HTML/JS with no build step · no server, accounts or storage (state lives in the URL) · PDFs generated in the browser · MIT licence · simple enough for light stewardship.

Out of scope for phase 1: sun swinging and the pelorus printout, and any backend. (Magnetic variation lookup for an area is M8, after launch.)

---

## Site layout

```
index.html                 Home: cheerful intro, "make your table" call to action
make/index.html            The tool
learn/deviation.html       What deviation is and why your compass needs it
learn/swinging.html        Ways to swing a compass (landmarks, transits, GPS, sun…)
learn/using-the-rose.html  How to read the table and the rose, with worked examples
about.html                 History, licence, source code, contributing
404.html

css/site.css
js/curve.js                Maths: fitting and conversions (no DOM)
js/state.js                Readings <-> URL hash
js/draw/surface-svg.js     Drawing surface: SVG (on-screen preview)
js/draw/surface-pdf.js     Drawing surface: jsPDF (download)
js/draw/table.js           Deviation table renderer (port of outputs/table.py)
js/draw/rose.js            Conversion rose renderer (port of outputs/rose.py)
js/draw/text.js            Shared text helpers (port of outputs/base.py + helpers.py)
js/samples.js              2–3 fictional example boats for "Try an example"
vendor/qrcode/             Pinned QR-code generator + its LICENSE
js/make.js                 Tool page UI wiring
vendor/jspdf/              Pinned jsPDF UMD build + its LICENSE

tests/*.test.js            Run with `node --test` (no npm dependencies)
tests/fixtures/samples.js  All the old real-world samples (test data only, not shown on the site)
LICENSE                    MIT
README.md
```

Key design choice: `table.js` and `rose.js` draw to a small **drawing-surface interface** (`line`, `arc`, `circle`, `rect`, `text`, `measureText`, `setColour`, `setLineWidth`, `newPage`). It has two implementations, SVG and jsPDF, so the on-screen preview and the PDF come from the same code and can't drift apart.

---

## Milestones

Each milestone leaves `master` in a deployable state.

### M0. Archive, relicense, rename
1. Tag the current master `django-final` and push the tag. Leave the `swinging` branch as it is; phase 2 mines it.
2. On master, `git rm` the Django tree, `config/`, `notes/`, `TODO.md`, `PRE-RELEASE-CHECKS.md`, `physical products.md` and `LICENSE.txt`. First copy `notes/`, the old samples and the `test_output/` PDFs somewhere for reference (scratch, or `docs/legacy/` if worth keeping).
3. Add an MIT `LICENSE` (© Edmund von der Burg) and a new `README.md`: what it is, the live URL, how to run locally (`python3 -m http.server`), how to run the tests, and a link to the `django-final` tag.
4. Add a placeholder `index.html`.
5. On GitHub *(outward-facing, so confirm at the time)*: rename the repo to `omnirose.github.io`, enable Pages from `master` / root, update the repo description, and update the local `origin` remote.

**Done when** the placeholder is live at https://omnirose.github.io/.

### M1. Core maths: `js/curve.js` + tests
Port `CurveCalculations` and `equations.py`:
- `fitCurve(readings, {terms})`: the deviation is a Fourier series `A + Σ (Bₖ sin kθ + Cₖ cos kθ)`, which is **linear in its coefficients**, so this is ordinary least squares. Solve with Householder QR (about 40 lines; stays stable if the headings are bunched together). No scipy equivalent needed.
- Choosing the number of terms (odd: 3, 5, 7, 9, 11, 13):
  - **Default:** the largest that is no more than about half the number of readings, so the curve is smoothed rather than forced through every point, with a minimum of 3. Fine-tune the exact rule against the fixtures so typical 8-, 12- and 16-reading swings give sensible curves.
  - **Advanced override:** any term count that is ≤ the number of readings.
  - At least 3 readings are needed.
- `deviationAt`, `compassToMagnetic`, `magneticToCompass` (iterative inverse, same tolerance and iteration count), `magneticToTrue`, `trueToMagnetic`, `compassToTrue`, `trueToCompass`, `mod360`.
- `minDeviation` / `maxDeviation` with the same padding and floor/ceil.
- `eastWest(deg)` formatter (`3°E`, `7°W`, `0°`).
- `validateReadings`: headings 0–<360, duplicate headings, NaN, at least 3 readings, and a soft warning for implausibly large deviations (say over 30°).

Tests (`tests/curve.test.js`) use the golden values from the old `curve/tests.py`:
- `deviation_at(0) = -3.843`, `deviation_at(100) = 4.509` (RYA sample)
- min/max deviation for the RYA and handbook samples
- the compass↔true table, including with variation 10
- `mod360` cases
- equation choice: the new default rule, the override limits, and too few points
- note: the golden values above came from the old "most terms" rule, so those tests pass the term count explicitly

Also a **round-trip property test**: `trueToCompass(compassToTrue(x, v), v) ≈ x` for every degree and several variations, across all samples.

### M2. State in the URL: `js/state.js`
- The readings live in the **hash**, not the query string, so they never reach a server, even GitHub's logs.
- A readable, compact format, e.g. `#v=S%2FV%20Elizabeth%20II&n=Starboard%20wheel&r=0:-4,22.5:-2,45:1.5&t=13`
  - `v` vessel, `n` note, `r` heading:deviation pairs, `t` optional term override.
  - Version prefix (`#1;…` or `ver=1`) so the format can change later.
- `encode(state)` / `decode(hash)` that tolerate junk, plus unit tests for round trips and malformed input.

### M3. The tool page (first usable release)
- Vessel name and note fields.
- A readings table: heading and deviation, with add and remove rows. Clear guidance on sign: "E is +, W is −", or an E/W toggle so nobody has to think about signs.
- Quick-start buttons to pre-fill headings every 45°, 30° or 22.5°, plus **"Try an example"**, which loads one of 2–3 made-up boats with friendly names and realistic curve shapes.
- A collapsed **"Advanced: curve terms"** setting, explained in plain words, with a note when the curve is forced through every point.
- Live updates as you type: validation messages, the hash updates (`history.replaceState`), and the SVG preview of the deviation table redraws.
- **"Copy link to these readings"** button, with a cheerful note: "Bookmark this. It *is* your saved table."
- Works on a phone.

Initially the preview can be a simple SVG of the curve and readings. It turns into the full table preview in M4.

### M4. Deviation table: SVG preview + PDF
Port `outputs/table.py` onto the drawing-surface interface:
- Page 590×790 pt, a safe fit for both A4 and Letter (keep this).
- Degree grids, deviation grid and axis labels, the fitted curve, the reading dots, title, note and the instructions blurb.
- Both variants: compass-indexed and magnetic-indexed.
- A **QR code** on the page encodes the user's shareable URL, so scanning the laminated card reopens the readings. Next to it goes a short line, "Scan to edit · omnirose.github.io", not the full long URL. Use a pinned, vendored QR library.
- Fix an old blurb typo: the magnetic-magnetic variant says "+W (or -W)".
- Replace the old copyright line ("© OmniRose.com") with "Made with OmniRose · omnirose.github.io".

Vendor jsPDF at a pinned version and use its built-in Helvetica (the degree sign is in WinAnsi, so no font embedding).

**Check:** compare the output side by side with `test_output/table_*.pdf` for every sample.

### M5. Conversion rose: SVG preview + PDF
Port `outputs/rose.py`:
- Three rings: magnetic (outer, red tint), true (middle, green), compass (inner, blue, warped by the curve). Tick weights at 1/5/10/90°, and labels every 10° with M/T/C superscripts on a background patch.
- The variation drawn large in the centre, the legend, and the vessel name and note.
- Variation range picker in sailor terms: "from 3° W to 1° E", not signed integers. One page per degree, **capped at 10 pages** with a friendly message. M8 makes the range smarter.
- The same QR code and short line as on the table.
- The preview shows the rose for the first variation in the range.

**Check:** compare against `test_output/rose_*.pdf`, including `rose_rya_training_almanac_multiple.pdf`.

### M6. Educational content
Write fresh, cheerful pages, drawing on the old about page, `notes/calibrating.md`, the swinging branch's `compass_theory.html` and `sun_home.html`, and `TODO.md`'s list of swinging methods:
- **What is deviation?** Your compass is pulled by the engine, the electronics, even the phone in your pocket. Why it differs from variation. Why it changes with heading.
- **Swinging your compass:** landmarks and transits, a pelorus, GPS course over ground in calm water, the sun (a teaser for phase 2), a hand-bearing compass held well away from the boat. When to re-swing.
- **Using your table and rose:** worked examples (T → M → C and back), plus a "laminate it and keep it at the chart table" tip.
- **About:** the project's history, MIT licence, link to the source, and how to contribute or report a problem.

Use small inline SVG diagrams where they help. No external fonts or trackers.

### M7. Polish and launch
- Accessibility pass: labels, keyboard entry in the readings table, contrast, a print stylesheet.
- Test in Safari, Chrome and Firefox on desktop and phone. Do real test prints on A4 and Letter and check that the rose isn't scaled ("Actual size").
- `404.html`, favicon, `<meta>` description and Open Graph image.
- Add a GitHub Action that runs `node --test` on PRs. It's the only CI, and it's cheap insurance for light stewardship.
- Issue templates: bug report and "my numbers look wrong".
- Launch: README badges, a GitHub release `v1.0`, and an optional post on a sailing forum.

---

## Testing strategy
- **Maths:** `node --test`, no dependencies, using the golden values from the Django test suite plus property tests.
- **Rendering:** visual comparison against the old `test_output/` PDFs during M4/M5. Optionally, snapshot the SVG output for the samples so later PRs that change the drawing show up in the diff.
- **Manual:** a short checklist in the README covering enter readings, copy link, reopen, download both PDFs, and print.

### M8. "Where are you sailing?" variation range (after launch)
Instead of asking for a variation range, let the sailor say where they'll be sailing and work the range out for them:
- Pick an area: draw a box on a simple map, or choose from presets (e.g. "English Channel", "Baltic", "Caribbean"). Keep any map lightweight and without API keys; a static SVG world map may be enough.
- Run the **World Magnetic Model** in JS (vendored coefficients) across the area for this year and the next few, and take the min/max variation, rounded outward.
- Prefill the rose range from that and explain it ("Around the Solent, variation is about 1° W, so here are pages for 2° W to 0°"). Note that WMM coefficients are replaced every 5 years, so this needs one small update at a time we know in advance.
- Review whether the 10-page cap still makes sense once ranges are chosen this way.

## Decisions made
1. **Curve terms:** a capped default of about half the number of readings, plus an advanced override (M1, M3).
2. **QR code** on both PDFs plus a short text line (M4, M5).
3. **Examples:** 2–3 fictional boats; the real samples are test fixtures only (M3, tests).
4. **Rose range:** a 10-page cap for now, with location-based ranges in M8.

## Phase 2 (later, not part of this plan)
Sun swing tool from the `swinging` branch: the pelorus printout, two-video sync and step-through in the browser, and solar azimuth (NOAA algorithm in JS). It reuses M8's World Magnetic Model code for the variation at the swing location.
