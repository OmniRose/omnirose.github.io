// The conversion rose (port of outputs/rose.py).
//
// Three rings, one inside the other:
//
//   outer   magnetic: true rotated by the variation
//   middle  true
//   inner   compass: rotated by the variation and warped by the deviation
//
// Every degree on each ring sits at the same angle as the true bearing it
// corresponds to, so converting is a matter of reading straight across.
// Each page is for one value of variation.

import { eastWest } from "../curve.js";
import { CAP_HEIGHT, textWidth } from "./font.js";
import {
  EDGE_INDENT,
  GREY,
  PAGE_HEIGHT,
  PAGE_WIDTH,
  drawDetails,
  drawFooter,
  drawQrBlock,
  drawTextBlock,
  drawTitles,
  textHeight,
} from "./common.js";

const CENTRE_X = PAGE_WIDTH / 2;
const CENTRE_Y = PAGE_HEIGHT - CENTRE_X;
const RING_WIDTH = 30;
const RING_GAP = 2;

const WIDTH_CARDINAL = 3;
const WIDTH_MAJOR = 1;
const WIDTH_MINOR = 0.5;
const WIDTH_TICK = 0.1;

export const RINGS = {
  magnetic: { background: [1, 0.95, 0.95], text: [0.2, 0, 0], superscript: "M", label: "Magnetic bearings" },
  true: { background: [0.95, 1, 0.95], text: [0, 0.2, 0], superscript: "T", label: "True bearings" },
  compass: { background: [0.95, 0.95, 1], text: [0, 0, 0.2], superscript: "C", label: "Compass bearings" },
};

// One page per whole degree of variation from `from` to `to` (easterly positive).
export function drawRoses(surface, curve, { from, to, ...details }) {
  const low = Math.min(from, to);
  const high = Math.max(from, to);
  for (let variation = low; variation <= high; variation++) {
    if (variation !== low) surface.newPage();
    drawRose(surface, curve, variation, details);
  }
}

export function drawRose(surface, curve, variation, { vessel = "", note = "", url = "", date } = {}) {
  const magneticRadius = CENTRE_X - EDGE_INDENT;
  const trueWidth = RING_WIDTH * 1.2;
  const trueRadius = magneticRadius - RING_WIDTH - RING_GAP;
  const compassRadius = trueRadius - trueWidth - RING_GAP;

  drawRing(surface, magneticRadius, RING_WIDTH, RINGS.magnetic, (m) => m + variation);
  drawRing(surface, trueRadius, trueWidth, RINGS.true, (t) => t);
  drawRing(surface, compassRadius, RING_WIDTH, RINGS.compass, (c) => curve.compassToTrue(c, variation));

  drawCentre(surface, variation);
  drawDetails(surface, { readingCount: curve.readings.length, terms: curve.terms, date });
  drawTitles(surface, { vessel, note }, 100);
  drawQrBlock(surface, url, PAGE_WIDTH - EDGE_INDENT - 64 + 12, PAGE_HEIGHT - EDGE_INDENT - 64 - 6, 64);
}

function point(degree, radius) {
  const radians = (degree * Math.PI) / 180;
  return [CENTRE_X + radius * Math.sin(radians), CENTRE_Y - radius * Math.cos(radians)];
}

// `plot` maps a bearing on this ring to the true bearing (the angle on the page).
function drawRing(surface, outerRadius, width, style, plot) {
  const innerRadius = outerRadius - width;
  const midRadius = (innerRadius + outerRadius) / 2;

  surface.circle(CENTRE_X, CENTRE_Y, midRadius, { stroke: style.background, width });

  const angles = [];
  for (let degree = 0; degree < 360; degree++) angles.push(plot(degree));

  angles.forEach((angle, degree) => {
    let lineWidth = WIDTH_TICK;
    if (degree % 90 === 0) lineWidth = WIDTH_CARDINAL;
    else if (degree % 10 === 0) lineWidth = WIDTH_MAJOR;
    else if (degree % 5 === 0) lineWidth = WIDTH_MINOR;
    const [x1, y1] = point(angle, innerRadius);
    const [x2, y2] = point(angle, outerRadius);
    surface.line(x1, y1, x2, y2, { width: lineWidth });
  });

  // Numbers every 10°, upright, on a patch of the ring's colour so the tick
  // lines don't run through them. A superscript M, T or C replaces the "°".
  const degreeSize = 9;
  const superscriptSize = 6;
  const padding = 1;
  for (let degree = 0; degree < 360; degree += 10) {
    const text = String(degree);
    const degreeWidth = textWidth(text, degreeSize);
    const superscriptWidth = textWidth(style.superscript, superscriptSize);
    const width = degreeWidth + padding + superscriptWidth;
    const height = textHeight(text, degreeSize);

    const [cx, cy] = point(angles[degree], midRadius);
    const x = cx - width / 2;
    const y = cy + height / 2;

    surface.rect(x - 1, y - height - 1, width + 2, height + 2, { fill: style.background });
    surface.text(text, x, y, { size: degreeSize, color: style.text });
    surface.text(style.superscript, x + degreeWidth + padding, y - height + superscriptSize * CAP_HEIGHT, {
      size: superscriptSize,
      color: style.text,
    });
  }
}

function drawCentre(surface, variation) {
  const text = eastWest(variation);
  const size = 80;
  const height = size * CAP_HEIGHT;
  let y = CENTRE_Y + height / 2;
  surface.text(text, CENTRE_X, y, { size, color: [0.6, 0.6, 0.6], align: "center" });
  surface.text("variation", CENTRE_X, CENTRE_Y - height / 2 - 10, { size: 12, color: GREY, align: "center" });

  y += 2 * 10;
  for (const ring of [RINGS.magnetic, RINGS.true, RINGS.compass]) {
    y = drawTextBlock(surface, ring.label, 10, y + 4, { maxWidth: 300, background: ring.background, color: GREY });
  }

  drawFooter(surface, y + 6, 9);
}
