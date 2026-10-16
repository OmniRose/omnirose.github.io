// Regenerate img/icon.svg: node tools/build-icon.js
//
// A simplified conversion rose: magnetic, true and compass rings, with the
// magnetic ring turned by variation and the compass ring warped by deviation.

import { writeFileSync } from "node:fs";

const C = 32;
const f = (n) => +n.toFixed(2);
const variation = -12; // exaggerated so it shows at favicon size
const deviation = (c) => 7 * Math.sin(((c + 30) * Math.PI) / 180);
const rings = [
  { name: "magnetic", outer: 31, width: 7, fill: "#ffdede", tick: "#5a1010", plot: (m) => m + variation },
  { name: "true", outer: 23.6, width: 8, fill: "#d9f5d9", tick: "#0f4a0f", plot: (t) => t },
  { name: "compass", outer: 15.2, width: 7, fill: "#dedeff", tick: "#14145a", plot: (c) => c + deviation(c) + variation },
];
const pt = (deg, r) => {
  const a = (deg * Math.PI) / 180;
  return [f(C + r * Math.sin(a)), f(C - r * Math.cos(a))];
};
let out = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">\n`;
out += `  <circle cx="32" cy="32" r="31.5" fill="#fff"/>\n`;
for (const ring of rings) {
  const mid = ring.outer - ring.width / 2;
  out += `  <circle cx="32" cy="32" r="${mid}" fill="none" stroke="${ring.fill}" stroke-width="${ring.width}"/>\n`;
  const ticks = [];
  for (let d = 0; d < 360; d += 10) {
    if (d % 90 === 0) continue;
    const len = d % 30 === 0 ? ring.width * 0.6 : ring.width * 0.3;
    const [x1, y1] = pt(ring.plot(d), ring.outer);
    const [x2, y2] = pt(ring.plot(d), ring.outer - len);
    ticks.push(`M${x1} ${y1}L${x2} ${y2}`);
  }
  out += `  <path d="${ticks.join("")}" stroke="${ring.tick}" stroke-width="0.6"/>\n`;
  const cardinals = [0, 90, 180, 270].map((d) => {
    const [x1, y1] = pt(ring.plot(d), ring.outer);
    const [x2, y2] = pt(ring.plot(d), ring.outer - ring.width);
    return `M${x1} ${y1}L${x2} ${y2}`;
  });
  out += `  <path d="${cardinals.join("")}" stroke="#000" stroke-width="1.8"/>\n`;
}
out += `</svg>\n`;
writeFileSync(new URL("../img/icon.svg", import.meta.url), out);
