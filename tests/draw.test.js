import { test } from "node:test";
import assert from "node:assert/strict";

import { Curve } from "../js/curve.js";
import { PAGE_HEIGHT, PAGE_WIDTH, splitIntoLines } from "../js/draw/common.js";
import { displayable, textWidth, toWinAnsi } from "../js/draw/font.js";
import { drawRoses } from "../js/draw/rose.js";
import { PdfSurface, SvgSurface } from "../js/draw/surface.js";
import { drawTable } from "../js/draw/table.js";
import { qrMatrix } from "../js/qr.js";
import { samples } from "./fixtures/samples.js";

const usable = Object.entries(samples).filter(([, s]) => s.readings.length >= 3);
const url = "https://omnirose.github.io/make/#r=0:1,90:2,180:-1";

// Check the cross-reference table points at every object.
function assertWellFormedPdf(text, expectedPages) {
  assert.ok(text.startsWith("%PDF-1.4\n"));
  assert.ok(text.endsWith("%%EOF\n"));
  const startxref = Number(text.match(/startxref\n(\d+)\n%%EOF\n$/)[1]);
  assert.ok(text.startsWith("xref\n", startxref), "startxref points at the xref table");
  const [, count] = text.slice(startxref).match(/^xref\n0 (\d+)\n/);
  const entries = text.slice(startxref).split("\n").slice(3, 2 + Number(count));
  entries.forEach((entry, i) => {
    const offset = Number(entry.slice(0, 10));
    assert.ok(text.startsWith(`${i + 1} 0 obj\n`, offset), `object ${i + 1} is at offset ${offset}`);
  });
  for (const match of text.matchAll(/<< \/Length (\d+) >>\nstream\n/g)) {
    const start = match.index + match[0].length;
    assert.ok(text.startsWith("\nendstream", start + Number(match[1])), "stream length is right");
  }
  assert.equal(Number(text.match(/\/Type \/Pages \/Kids \[[^\]]*\] \/Count (\d+)/)[1]), expectedPages);
}

test("tables render for every sample", () => {
  for (const [name, sample] of usable) {
    const curve = new Curve(sample.readings);
    for (const right of ["magnetic", "compass"]) {
      const pdf = new PdfSurface(PAGE_WIDTH, PAGE_HEIGHT, { title: name });
      drawTable(pdf, curve, { right, vessel: sample.vessel, note: sample.note, url });
      assertWellFormedPdf(pdf.toString(), 1);

      const svg = new SvgSurface(PAGE_WIDTH, PAGE_HEIGHT);
      drawTable(svg, curve, { right, vessel: sample.vessel, note: sample.note, url });
      const markup = svg.toSvg();
      assert.ok(markup.startsWith("<svg") && markup.endsWith("</svg>"));
      assert.ok(!/NaN|undefined|Infinity/.test(markup), `${name} ${right} has no bad numbers`);
    }
  }
});

test("roses render one page per degree of variation", () => {
  const curve = new Curve(samples.rya_training_almanac.readings);
  const pdf = new PdfSurface(PAGE_WIDTH, PAGE_HEIGHT);
  drawRoses(pdf, curve, { from: 2, to: -3, vessel: "Test", url });
  assertWellFormedPdf(pdf.toString(), 6);
  assert.ok(!/NaN|undefined|Infinity/.test(pdf.toString()));
});

test("the QR code is clickable in the PDF", () => {
  const curve = new Curve(samples.otter.readings);
  const pdf = new PdfSurface(PAGE_WIDTH, PAGE_HEIGHT);
  drawTable(pdf, curve, { url });
  assert.ok(pdf.toString().includes(`/URI (${url})`));
});

test("text in PDFs is escaped and encoded", () => {
  const pdf = new PdfSurface(100, 100);
  pdf.text("(Åsa's) \\ boat ° ✓", 10, 10);
  const text = pdf.toString();
  assert.ok(text.includes("(\\(\\305sa's\\) \\\\ boat \\260 ?) Tj"));
});

test("font helpers", () => {
  assert.equal(textWidth("0", 10), 5.56);
  assert.equal(textWidth("°", 10), 4);
  assert.deepEqual(toWinAnsi("a€✓"), [97, 0x80, 63]);
  assert.equal(displayable("Café – ✓"), "Café – ?");
  assert.deepEqual(splitIntoLines("one two three four", 2), ["one two three", "four"]);
});

test("QR codes have the right size and finder patterns", () => {
  for (const [text, version] of [["hi", 1], [url, 3], ["x".repeat(300), 11]]) {
    const m = qrMatrix(text);
    assert.equal(m.length, version * 4 + 17, text.slice(0, 20));
    const size = m.length;
    for (const [x, y] of [[0, 0], [size - 7, 0], [0, size - 7]]) {
      // Finder pattern: dark border, light ring, dark centre.
      assert.ok(m[y][x] && m[y + 6][x + 6] && m[y + 3][x + 3]);
      assert.ok(!m[y + 1][x + 1] && !m[y + 5][x + 5]);
    }
  }
});
