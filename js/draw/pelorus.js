// The OmniRose sun pelorus: a printable card for swinging a compass by the sun.
//
// Line the card up with the boat's centreline and stand a drinks can on the
// circle in the middle. The shadow points directly away from the sun, so the
// scale is numbered 180° round from where it's printed: a line from the
// centre along the middle of the shadow reads the sun's bearing relative to
// the bow (0 = dead ahead, 90 = on the starboard beam).
//
// The shadow is as wide as the can, so its edges run parallel to that line,
// a can's radius either side of it. With the boat moving it's only practical
// to read one thing at a time, so we read the anticlockwise edge, which
// crosses a scale of radius R at the sun's bearing minus asin(can radius / R).
// The tool adds that back.
//
// The "snail" in the middle shows this: a family of can-sized circles, each
// running into the line its anticlockwise shadow edge follows when the sun
// is dead ahead (down the starboard side, which suits right-handed readers).
// It's also a gauge for measuring an unusual can.

import { PAGE_HEIGHT, PAGE_WIDTH, GREY, drawFooter, drawTextBlock } from "./common.js";

const MM = 72 / 25.4;
const CX = PAGE_WIDTH / 2;
const CY = 430;
// The scale's radius, in points. A standard 330 ml can's shadow edge reaches
// it until the sun is about 57° up (63° for a tall slim can). Higher than
// that the sun's bearing changes fast and a slightly tilted card throws the
// reading off, so there's no inner scale for shorter shadows.
export const OUTER = 228;
export const MM_TO_POINTS = MM;
// Can diameters drawn on the snail, in mm. Lines alternate thick and thin so
// each can be followed round to the scale; the common 58 mm and 66 mm cans
// both land on thick ones.
const SNAIL_DIAMETERS = [22, 26, 30, 34, 38, 42, 46, 50, 54, 58, 62, 66, 70, 74, 78, 82, 88, 94, 100];

// How far (degrees) the anticlockwise shadow edge of a can of this diameter
// (mm) reads short of the sun's bearing on the scale.
export function edgeOffset(diameterMm) {
  const radius = (diameterMm / 2) * MM;
  return (Math.asin(Math.min(radius / OUTER, 1)) * 180) / Math.PI;
}
const INK = [0, 0, 0];
const LIGHT = [0.55, 0.55, 0.55];

function point(angle, radius) {
  const r = (angle * Math.PI) / 180;
  return [CX + radius * Math.sin(r), CY - radius * Math.cos(r)];
}

// The number printed at a physical angle (clockwise from the bow).
export function pelorusLabel(angle) {
  return (angle + 180) % 360;
}

function scale(surface, radius, { outward, labelEvery, tickScale }) {
  surface.circle(CX, CY, radius, { stroke: INK, width: 0.8 });
  const dir = outward ? 1 : -1;
  for (let angle = 0; angle < 360; angle++) {
    let length = 4 * tickScale;
    let width = 0.3;
    if (angle % 10 === 0) {
      length = 11 * tickScale;
      width = 0.8;
    } else if (angle % 5 === 0) {
      length = 7 * tickScale;
      width = 0.5;
    }
    if (pelorusLabel(angle) % 90 === 0) width = 1.6;
    const [x1, y1] = point(angle, radius);
    const [x2, y2] = point(angle, radius - dir * length);
    surface.line(x1, y1, x2, y2, { width });
  }
  for (let angle = 0; angle < 360; angle += labelEvery) {
    const offset = outward ? 6 : -11 * tickScale - 9;
    const [x, y] = point(angle, radius + offset);
    surface.text(String(pelorusLabel(angle)), x, y, { size: outward ? 9 : 7.5, align: "center", angle });
  }
}

export function drawPelorus(surface) {
  // Title and instructions.
  drawTextBlock(surface, "OmniRose sun pelorus", 22, 42);
  drawTextBlock(surface, "Read where the anticlockwise edge of the can's shadow crosses the scale.", 10, 60, { color: GREY });

  const steps = [
    ["1. Print at actual size (100%).", "The bar at the bottom should", "measure exactly 100 mm."],
    ["2. Stick it to something flat and", "fix it level, with the BOW line", "parallel to the centreline."],
    ["3. Stand a can, or anything upright with", "straight sides, on the circle that fits it.", "Note where its line meets the scale.", "No shadow on the scale? Wait for a lower sun."],
    ["4. Hold each heading until the compass", "settles. Then note the time, the compass,", "and the anticlockwise edge of the shadow."],
  ];
  steps.forEach((lines, i) => {
    const x = i % 2 === 0 ? 30 : PAGE_WIDTH - 30;
    const y = (i < 2 ? 100 : 700) + 0;
    lines.forEach((line, j) => {
      surface.text(line, x, y + j * 10, { size: 7.5, color: j === 0 ? INK : GREY, align: i % 2 === 0 ? "left" : "right" });
    });
  });

  // Bow and stern lines, outside the scale, for lining the card up.
  const top = CY - OUTER - 22;
  surface.line(CX, 92, CX, top, { width: 1.2 });
  surface.text("BOW", CX + 6, 100, { size: 9 });
  const bottom = CY + OUTER + 22;
  surface.line(CX, bottom, CX, 712, { width: 1.2 });
  surface.text("STERN", CX + 6, 710, { size: 9 });
  // Short athwartships marks.
  for (const side of [-1, 1]) {
    surface.line(CX + side * (OUTER + 22), CY, CX + side * (OUTER + 42), CY, { width: 1.2 });
  }

  scale(surface, OUTER, { outward: true, labelEvery: 10, tickScale: 1 });

  // The snail: can circles, each running into its shadow edge line. Each
  // goes from the scale straight up the starboard side, then three quarters
  // of the way round, ending on the centreline astern. The loops make it
  // easy to centre the can, and where a can's line meets the scale is its
  // shadow edge reading with the sun dead ahead.
  const [sternX, sternY] = point(180, OUTER);
  surface.line(CX, CY, sternX, sternY, { width: 0.35, color: LIGHT });
  SNAIL_DIAMETERS.forEach((diameter, i) => {
    const r = (diameter / 2) * MM;
    const bold = i % 2 === 1;
    const style = { width: bold ? 0.8 : 0.3, color: bold ? INK : LIGHT };
    const end = Math.sqrt(OUTER * OUTER - r * r);
    const path = [[CX + r, CY + end]];
    for (let angle = 90; angle >= -180; angle -= 3) path.push(point(angle, r));
    surface.polyline(path, style);
    // Size label tucked under the end of each loop, beside the centreline.
    surface.text(String(diameter), CX - 1.5, CY + r + 4.2, { size: 4.5, color: bold ? INK : LIGHT, align: "right" });
  });
  const largest = (SNAIL_DIAMETERS[SNAIL_DIAMETERS.length - 1] / 2) * MM;
  surface.text("diameter (mm)", CX - 1.5, CY + largest + 14, { size: 5.5, color: LIGHT, align: "right" });
  surface.line(CX - 6, CY, CX + 6, CY, { width: 0.4, color: LIGHT });
  surface.line(CX, CY - 6, CX, CY + 6, { width: 0.4, color: LIGHT });

  // 100 mm check bar.
  const barY = 745;
  const barX = CX - 50 * MM;
  surface.line(barX, barY, barX + 100 * MM, barY, { width: 1 });
  for (let mm = 0; mm <= 100; mm += 10) {
    const h = mm % 50 === 0 ? 6 : 3;
    surface.line(barX + mm * MM, barY - h, barX + mm * MM, barY, { width: 0.6 });
  }
  surface.text("100 mm", CX, barY + 10, { size: 7, color: GREY, align: "center" });

  drawFooter(surface, PAGE_HEIGHT - 18, 9);
}
