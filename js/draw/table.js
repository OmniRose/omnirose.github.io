// The deviation table (port of outputs/table.py).
//
// Headings run down the page from 0° to 360° and deviation runs across, with
// the fitted curve and the readings drawn on a grid. Each 10° heading line
// runs in from the edge to meet the curve, so the deviation can be read off
// where it touches.
//
// The left axis is always magnetic headings. The right axis is either
// magnetic too (a plain deviation table) or compass headings (a "combined"
// table, which lets you look up a compass heading without a second round of
// correction).

import { eastWest } from "../curve.js";
import {
  EDGE_INDENT,
  PAGE_HEIGHT,
  PAGE_WIDTH,
  SITE,
  drawDetails,
  drawFooter,
  drawQrBlock,
  drawTextBlock,
  drawTitles,
  textHeight,
} from "./common.js";

const GRID_TOP = 220;
const GRID_HEIGHT = 500;
const GRID_WIDTH = 300;
const GRID_BLEED = 2;

const WIDTH_CARDINAL = 0.5;
const WIDTH_MAJOR = 0.1;
const WIDTH_CURVE = 1;
const READING_RADIUS = 3;
const READING_COLOUR = [0.85, 0, 0];

const AXIS_LABELS = {
  magnetic: "ship's heading (magnetic)",
  compass: "ship's heading (compass)",
};

const BLURBS = {
  magnetic: [
    "Magnetic to Compass: +W (or -E) deviation.",
    "Compass to Magnetic: +E (or -W) deviation. May need a second round of correction.",
  ],
  compass: [
    "Magnetic to Compass: +W (or -E) deviation. Use left axis.",
    "Compass to Magnetic: +E (or -W) deviation. Use right axis.",
  ],
};

export const TABLE_TITLES = {
  magnetic: "Deviation table",
  compass: "Combined deviation table",
};

export function drawTable(surface, curve, { right = "magnetic", vessel = "", note = "", url = "", date } = {}) {
  const midpoint = PAGE_WIDTH / 2;
  const gridLeft = midpoint - GRID_WIDTH / 2;
  const gridRight = midpoint + GRID_WIDTH / 2;
  const gridBottom = GRID_TOP + GRID_HEIGHT;
  const contentTop = GRID_TOP + GRID_BLEED;
  const contentHeight = GRID_HEIGHT - 2 * GRID_BLEED;
  const contentLeft = gridLeft + GRID_BLEED;
  const contentRight = gridRight - GRID_BLEED;

  const { minDeviation, maxDeviation } = curve;
  const devInterval = (contentRight - contentLeft) / (maxDeviation - minDeviation);

  const gridY = (degree) => contentTop + (contentHeight / 360) * degree;
  const gridX = (deviation) => contentRight - devInterval * (maxDeviation - deviation);

  // ---- Heading lines, from each edge in to the curve.
  for (const [side, headingType] of [["left", "magnetic"], ["right", right]]) {
    // Magnetic lines run 0° to 360° inclusive. Compass lines are placed at
    // their magnetic equivalent, which already wraps around, so stop at 350°.
    const last = headingType === "magnetic" ? 360 : 350;
    for (let degree = 0; degree <= last; degree += 10) {
      const magnetic = headingType === "magnetic" ? degree : curve.compassToMagnetic(degree);
      // 0° compass lands near the bottom of the page when the deviation there is westerly.
      const labelDegree = degree === 0 && magnetic > 180 ? 360 : degree;

      const deviation = curve.deviationAt(magnetic);
      const y = gridY(magnetic);
      const xStart = side === "left" ? gridLeft : gridX(deviation);
      const xEnd = side === "left" ? gridX(deviation) : gridRight;
      surface.line(xStart, y, xEnd, y, { width: degree % 90 === 0 ? WIDTH_CARDINAL : WIDTH_MAJOR });

      const label = `${labelDegree}°`;
      const labelY = y + textHeight(label, 6) / 2;
      if (side === "left") surface.text(label, xStart - 2, labelY, { size: 6, align: "right" });
      else surface.text(label, xEnd + 2, labelY, { size: 6 });
    }
  }
  // ---- Deviation lines, top to bottom.
  const maxLabels = 17;
  const labelEvery = Math.ceil((maxDeviation - minDeviation) / maxLabels);
  for (let dev = minDeviation; dev <= maxDeviation; dev++) {
    const showLabel = dev % labelEvery === 0;
    const x = gridX(dev);
    const yStart = showLabel ? GRID_TOP : GRID_TOP + GRID_BLEED;
    const yEnd = showLabel ? gridBottom : gridBottom - GRID_BLEED;
    surface.line(x, yStart, x, yEnd, { width: dev === 0 ? WIDTH_CARDINAL : WIDTH_MAJOR });
    if (showLabel) {
      const label = eastWest(dev);
      const height = textHeight(label, 6);
      surface.text(label, x, yStart - height, { size: 6, align: "center" });
      surface.text(label, x, yEnd + height + 2, { size: 6, align: "center" });
    }
  }

  // ---- The curve and the readings.
  const points = [];
  for (let heading = 0; heading <= 360; heading += 0.5) {
    points.push([gridX(curve.deviationAt(heading)), gridY(heading)]);
  }
  surface.polyline(points, { width: WIDTH_CURVE });

  for (const [heading, deviation] of curve.readings) {
    surface.circle(gridX(deviation), gridY(heading), READING_RADIUS, { fill: READING_COLOUR });
    if (heading === 0) surface.circle(gridX(deviation), gridY(360), READING_RADIUS, { fill: READING_COLOUR });
  }

  // ---- Labels and text.
  drawTitles(surface, { vessel, note }, 60);

  const axisOffset = GRID_WIDTH / 2 + 30;
  const axisY = gridY(180);
  // Rotated labels, centred on the axis; the small shift centres the text
  // vertically on its line rather than sitting on its baseline.
  surface.text(AXIS_LABELS.magnetic, midpoint - axisOffset + 3.5, axisY, { size: 10, align: "center", angle: -90 });
  surface.text(AXIS_LABELS[right], midpoint + axisOffset - 3.5, axisY, { size: 10, align: "center", angle: 90 });
  surface.text("deviation", midpoint, GRID_TOP - 20, { size: 10, align: "center" });

  let y = GRID_TOP - 8 * 12;
  for (const line of [
    ...BLURBS[right],
    "",
    "For direct conversion between true, magnetic and compass bearings,",
    `make a conversion rose at ${SITE}`,
  ]) {
    y = line ? drawTextBlock(surface, line, 8, y) : y + 8;
  }

  drawFooter(surface);
  drawDetails(surface, { readingCount: curve.readings.length, terms: curve.terms, date });
  drawQrBlock(surface, url, PAGE_WIDTH - EDGE_INDENT - 70, PAGE_HEIGHT - EDGE_INDENT - 70 - 6, 70);
}

export function tableTitle(right, vessel) {
  return `${TABLE_TITLES[right]}${vessel ? ` for ${vessel}` : ""}`;
}

