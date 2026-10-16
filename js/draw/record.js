// The swing record: a sheet for writing readings down during a swing.
//
// Blank, it has a row for each magnetic heading to steer, with space for the
// compass reading and the deviation. Filled in from a curve, it's the record
// of the swing behind a table and rose: each reading, what the compass
// showed, and how far the reading sits from the fitted curve.

import { bearing, eastWest, formatNumber, mod360 } from "../curve.js";
import { CAP_HEIGHT, textWidth } from "./font.js";
import {
  EDGE_INDENT,
  GREY,
  PAGE_HEIGHT,
  PAGE_WIDTH,
  SITE,
  drawDetails,
  drawFooter,
  drawQrBlock,
  drawTextBlock,
  drawTitles,
} from "./common.js";

const LEFT = 60;
const RIGHT = PAGE_WIDTH - 60;
const TABLE_TOP = 190;
const TABLE_BOTTOM = 640;
const MAX_ROW_HEIGHT = 30;
const FLAG_COLOUR = [0.85, 0, 0];
// Same threshold as the make page's "worth double-checking" warning.
const FLAG_AT = 2;

const COLUMNS = {
  blank: [
    { heading: "Magnetic heading", hint: "steer this", width: 1 },
    { heading: "Compass reading", hint: "what it showed", width: 1 },
    { heading: "Deviation", hint: "magnetic minus compass", width: 1 },
    { heading: "E / W", hint: "", width: 0.5 },
    { heading: "Notes", hint: "time, mark, conditions", width: 2 },
  ],
  filled: [
    { heading: "Magnetic heading", hint: "", width: 1 },
    { heading: "Compass reading", hint: "", width: 1 },
    { heading: "Deviation", hint: "as read", width: 1 },
    { heading: "Curve", hint: "fitted deviation", width: 1 },
    { heading: "Off curve", hint: "", width: 1 },
  ],
};

export function headingsEvery(step) {
  const headings = [];
  for (let h = 0; h < 360; h += step) headings.push(h);
  return headings;
}

// Either `curve` (a filled record) or `headings` (a blank one).
export function drawRecord(surface, { curve, headings = headingsEvery(30), vessel = "", note = "", url = "", date } = {}) {
  const filled = Boolean(curve);
  const columns = COLUMNS[filled ? "filled" : "blank"];

  surface.text("Compass swing record", PAGE_WIDTH / 2, 40, { size: 12, color: GREY, align: "center" });
  drawTitles(surface, { vessel, note }, 80);
  drawFields(surface, 145);

  const rows = filled ? filledRows(curve) : headings.map((h) => [bearing(h, "M"), "", "", "", ""]);
  drawGrid(surface, columns, rows);

  let y = TABLE_BOTTOM + 24;
  for (const line of [
    "Deviation is magnetic minus compass: East when the compass reads less than the magnetic heading,",
    "West when it reads more.",
    filled ? "" : `Then type your readings in at ${SITE}/make`,
  ]) {
    if (line) y = drawTextBlock(surface, line, 8, y);
  }

  drawFooter(surface);
  if (filled) {
    drawDetails(surface, { readingCount: curve.readings.length, terms: curve.terms, date });
    drawQrBlock(surface, url, PAGE_WIDTH - EDGE_INDENT - 70, PAGE_HEIGHT - EDGE_INDENT - 70 - 6, 70);
  }
}

function filledRows(curve) {
  const residuals = curve.residuals();
  return curve.readings
    .map(([h, d], i) => [h, d, residuals[i]])
    .sort((a, b) => a[0] - b[0])
    .map(([h, d, residual]) => {
      const off = Math.round(Math.abs(residual) * 10) / 10;
      return [
        bearing(h, "M"),
        bearing(mod360(h - d), "C"),
        eastWest(d),
        eastWest(Math.round(curve.deviationAt(h) * 10) / 10),
        { text: `${formatNumber(off)}°${Math.abs(residual) >= FLAG_AT ? "  check" : ""}`, flag: Math.abs(residual) >= FLAG_AT },
      ];
    });
}

// Date, place and method lines to write on.
function drawFields(surface, y) {
  const fields = [["Date", 80], ["Place", 130], ["Method", 110]];
  const gap = 16;
  const labelSize = 9;
  const total = fields.reduce((sum, [label, width]) => sum + textWidth(label, labelSize) + 4 + width, 0) + gap * (fields.length - 1);
  let x = (PAGE_WIDTH - total) / 2;
  for (const [label, width] of fields) {
    surface.text(label, x, y, { size: labelSize, color: GREY });
    x += textWidth(label, labelSize) + 4;
    surface.line(x, y + 2, x + width, y + 2, { width: 0.5, color: GREY });
    x += width + gap;
  }
}

function drawGrid(surface, columns, rows) {
  const units = columns.reduce((sum, c) => sum + c.width, 0);
  const xs = [LEFT];
  for (const c of columns) xs.push(xs[xs.length - 1] + ((RIGHT - LEFT) * c.width) / units);

  // Column headings, with a grey hint underneath.
  const headerBottom = TABLE_TOP;
  columns.forEach((c, i) => {
    const cx = (xs[i] + xs[i + 1]) / 2;
    surface.text(c.heading, cx, headerBottom - (c.hint ? 16 : 8), { size: 9, align: "center" });
    if (c.hint) surface.text(c.hint, cx, headerBottom - 6, { size: 7, color: GREY, align: "center" });
  });

  const rowHeight = Math.min(MAX_ROW_HEIGHT, (TABLE_BOTTOM - TABLE_TOP) / Math.max(rows.length, 1));
  const bottom = TABLE_TOP + rowHeight * rows.length;
  for (let r = 0; r <= rows.length; r++) {
    const y = TABLE_TOP + r * rowHeight;
    surface.line(LEFT, y, RIGHT, y, { width: r === 0 || r === rows.length ? 0.8 : 0.3 });
  }
  xs.forEach((x, i) => surface.line(x, TABLE_TOP, x, bottom, { width: i === 0 || i === xs.length - 1 ? 0.8 : 0.3 }));

  const size = Math.min(10, rowHeight * 0.55);
  rows.forEach((cells, r) => {
    const y = TABLE_TOP + r * rowHeight + rowHeight / 2 + (size * CAP_HEIGHT) / 2;
    cells.forEach((cell, i) => {
      const { text, flag } = typeof cell === "string" ? { text: cell } : cell;
      if (!text) return;
      surface.text(text, (xs[i] + xs[i + 1]) / 2, y, { size, align: "center", color: flag ? FLAG_COLOUR : [0, 0, 0] });
    });
  });
}
