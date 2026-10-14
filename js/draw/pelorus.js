// The OmniRose sun pelorus: a printable card for swinging a compass by the sun.
//
// Line the card up with the boat's centreline and stand a drinks can on the
// circle in the middle. The shadow points directly away from the sun, so the
// scale is numbered 180° round from where it's printed: wherever the shadow
// falls, the number under it is the sun's bearing relative to the bow
// (0 = dead ahead, 90 = on the starboard beam).

import { PAGE_HEIGHT, PAGE_WIDTH, GREY, drawFooter, drawTextBlock } from "./common.js";

const MM = 72 / 25.4;
const CX = PAGE_WIDTH / 2;
const CY = 430;
const OUTER = 228; // outer scale radius
const INNER = 150; // inner scale radius
const CANS = [
  { radius: 33 * MM, label: "standard can (66 mm)", dash: false },
  { radius: 29 * MM, label: "slim can (58 mm)", dash: true },
];
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
  drawTextBlock(surface, "Where the can's shadow crosses the scale is the sun's bearing from the bow.", 10, 60, { color: GREY });

  const steps = [
    ["1. Print at actual size (100%).", "The bar at the bottom should", "measure exactly 100 mm."],
    ["2. Stick it to something flat and", "fix it level, with the BOW line", "parallel to the centreline."],
    ["3. Stand a drinks can on the", "circle that fits it. Keep the", "card in full sun."],
    ["4. On each heading, note the time,", "the compass, and where each edge", "of the shadow crosses the scale."],
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

  // Scales: the outer one for long shadows (lower sun), the inner one for
  // shorter shadows (higher sun).
  scale(surface, OUTER, { outward: true, labelEvery: 10, tickScale: 1 });
  scale(surface, INNER, { outward: true, labelEvery: 30, tickScale: 0.8 });

  // Can circles and centre mark.
  for (const can of CANS) {
    if (can.dash) {
      for (let a = 0; a < 360; a += 6) {
        const [x1, y1] = point(a, can.radius);
        const [x2, y2] = point(a + 3, can.radius);
        surface.line(x1, y1, x2, y2, { width: 0.6, color: LIGHT });
      }
    } else {
      surface.circle(CX, CY, can.radius, { stroke: LIGHT, width: 0.6 });
    }
  }
  surface.text(CANS[0].label, CX, CY - CANS[0].radius - 4, { size: 6, color: LIGHT, align: "center" });
  surface.text(CANS[1].label, CX, CY - CANS[1].radius + 9, { size: 6, color: LIGHT, align: "center" });
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
