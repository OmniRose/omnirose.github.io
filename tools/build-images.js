// Regenerate the example images used on the site:
//   node tools/build-images.js
// img/og.png (1200×630) was cropped from a PDF render of the same rose.

import { writeFileSync } from "node:fs";
import { Curve } from "../js/curve.js";
import { PAGE_HEIGHT, PAGE_WIDTH } from "../js/draw/common.js";
import { drawRose } from "../js/draw/rose.js";
import { SvgSurface } from "../js/draw/surface.js";
import { drawTable } from "../js/draw/table.js";
import { examples } from "../js/examples.js";
import { encodeState } from "../js/state.js";

const boat = examples[1];
const curve = new Curve(boat.readings);
const url = `https://omnirose.github.io/make/${encodeState({ ...boat, terms: null, variation: [-2, -2] })}`;
const details = { vessel: boat.vessel, note: boat.note, url, date: new Date("2026-01-01") };

const table = new SvgSurface(PAGE_WIDTH, PAGE_HEIGHT);
drawTable(table, curve, { right: "magnetic", ...details });
writeFileSync(new URL("../img/example-table.svg", import.meta.url), table.toSvg(0, { title: "Example deviation table" }));

const rose = new SvgSurface(PAGE_WIDTH, PAGE_HEIGHT);
drawRose(rose, curve, -2, details);
writeFileSync(new URL("../img/example-rose.svg", import.meta.url), rose.toSvg(0, { title: "Example conversion rose" }));
