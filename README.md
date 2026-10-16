# OmniRose

Free deviation tables and conversion roses for your boat's compass.

**https://omnirose.github.io/**

Enter the deviation readings from a compass swing and OmniRose fits a smooth curve through them, then gives you printable PDFs:

- a **deviation table** (headings against deviation, the classic chart-table card),
- a **combined table** (with compass headings on the other side, so no second round of correction), and
- **conversion roses** (true, magnetic and compass rings lined up for a given variation, so converting is just reading across).

Everything runs in the browser. Readings are kept in the page's URL hash, so a bookmark *is* the saved table, and every printout has a QR code that links back to it. There are no accounts, cookies, analytics or servers.

## Running it locally

There is no build step. Serve the repository root with any static web server:

```sh
python3 -m http.server 8000
```

Then open http://localhost:8000/. (Opening the files directly with `file://` won't work, because browsers don't load JavaScript modules that way.)

## Tests

The tests use Node's built-in test runner and need no dependencies (Node 20 or later):

```sh
node --test
```

They cover the curve fitting (including golden values from the original Python implementation), the URL format, PDF structure and QR codes. GitHub Actions runs them on every pull request.

### Manual checklist before a release

1. Load an example on the tool page, check the preview tabs, and change a reading.
2. Copy the link, open it in a new tab, and check everything comes back.
3. Download the deviation table, combined table and a range of roses; open each PDF.
4. Print a rose at actual size on A4 and on Letter, and check it's round and nothing is clipped.
5. Scan a printed QR code with a phone.
6. Check the tool page on a phone.

## How it's put together

```
index.html, about.html, 404.html    Pages
learn/                              Educational pages
make/index.html, js/make.js         The tool page
js/curve.js                         Curve fitting and bearing conversions
js/state.js                         Reading/writing state in the URL hash
js/draw/surface.js                  Drawing surfaces: SVG (preview) and PDF (download)
js/draw/table.js, js/draw/rose.js   The deviation table and conversion rose
js/draw/common.js, js/draw/font.js  Shared page furniture and Helvetica metrics
js/qr.js                            QR code encoder
js/wmm.js, js/where.js              World Magnetic Model and the "Where are you sailing?" helper
js/regions.js                       Cruising areas for that helper
data/WMM.COF                        Magnetic model coefficients (replace every 5 years; see data/README.md)
js/examples.js                      Made-up example boats
tests/                              Tests; tests/fixtures holds real-world sample tables
tools/build-images.js               Regenerates the example images in img/
```

Some details worth knowing:

- **The maths.** Deviation is modelled as a Fourier series in the heading, `A + B sin θ + C cos θ + D sin 2θ + E cos 2θ + …`, fitted by least squares (Householder QR). The number of terms is chosen with the Bayesian information criterion, up to 7, and can be overridden by the user. Readings are against **magnetic** headings, and easterly deviation and variation are positive.
- **The table and rose are drawn once, through a small surface interface** with an SVG implementation for the on-screen preview and a PDF implementation for downloads, so the two always match. The PDF writer uses the built-in Helvetica font with WinAnsi encoding, so no fonts are embedded; characters outside Windows-1252 print as `?`.
- **Page size** is 590 × 790 pt, which fits both A4 and US Letter.
- **Magnetic variation** for the "Where are you sailing?" helper comes from NOAA's World Magnetic Model, evaluated in the browser from `data/WMM.COF`. The helper hides itself if that file is missing. The code is checked against all 100 of NOAA's official WMM2025 test values, and the WMM2015 ones (`tests/fixtures/WMM2015.COF`, kept for testing only). The model expires at the end of 2029; see `data/README.md`.
- **The URL format** is documented at the top of `js/state.js`. Old links must keep working, so only ever add to it.

## History

OmniRose was first written in 2015 as a Django web app and then set aside unfinished. In 2026 it was handed to Claude to polish up and rebuild as this static site. The original code is preserved at the [`django-final`](https://github.com/OmniRose/omnirose.github.io/tree/django-final) tag, and an unfinished experiment with swinging a compass using the sun is on the `swinging` branch.

## Licence

MIT. See [LICENSE](LICENSE).
