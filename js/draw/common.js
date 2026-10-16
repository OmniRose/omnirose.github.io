// Page furniture shared by the table and the rose (port of outputs/base.py).

import { qrMatrix } from "../qr.js";
import { CAP_HEIGHT, DESCENT, LINE_HEIGHT, textWidth } from "./font.js";

// A compromise between A4 and US Letter (210 × 280 mm, shrunk slightly), so
// the same PDF prints well on either.
export const PAGE_WIDTH = 590;
export const PAGE_HEIGHT = 790;
export const EDGE_INDENT = 30;

export const GREY = [0.4, 0.4, 0.4];
export const SITE = "omnirose.github.io";

// Height of a line of text, as cairo's text extents would report it.
export function textHeight(text, size) {
  return size * (CAP_HEIGHT + (/[gjpqy,;()]/.test(text) ? DESCENT : 0));
}

// Split text into roughly equal lines at word boundaries.
export function splitIntoLines(text, lineCount) {
  const lines = [];
  const lineLength = text.length / lineCount;
  let line = [];
  for (const word of text.split(/\s+/).filter(Boolean)) {
    line.push(word);
    if (line.join(" ").length >= lineLength) {
      lines.push(line.join(" "));
      line = [];
    }
  }
  if (line.length) lines.push(line.join(" "));
  return lines;
}

// Draw centred text, shrinking it (and then wrapping it onto up to maxLines
// lines) until it fits maxWidth. Returns the y position for the next block.
export function drawTextBlock(
  surface,
  text,
  size,
  y,
  { maxLines = 1, maxWidth = PAGE_WIDTH - EDGE_INDENT, background, color = [0, 0, 0], verticalShift = "font", centreX = PAGE_WIDTH / 2 } = {},
) {
  if (!text) return y;

  let lines = [text];
  let fontSize = size;
  search: for (; fontSize > 1; fontSize--) {
    for (let count = 1; count <= maxLines; count++) {
      lines = splitIntoLines(text, count);
      if (Math.max(...lines.map((l) => textWidth(l, fontSize))) < maxWidth) break search;
    }
  }

  for (const line of lines) {
    const width = textWidth(line, fontSize);
    const height = textHeight(line, fontSize);
    if (background) {
      const padding = 2;
      surface.rect(centreX - width / 2 - padding, y - fontSize * CAP_HEIGHT - padding, width + 2 * padding, height + 2 * padding, {
        fill: background,
      });
    }
    surface.text(line, centreX, y, { size: fontSize, color, align: "center" });
    y += verticalShift === "font" ? 1.2 * LINE_HEIGHT * fontSize : 1.2 * height;
  }
  return y;
}

// The boat's name and which compass. A missing one becomes a grey label and
// a line to write it on, so a printout can't end up unattributed.
export function drawTitles(surface, { vessel, note }, y) {
  y = vessel ? drawTextBlock(surface, vessel, 32, y, { verticalShift: "text" }) : drawBlank(surface, "Boat", 18, y, 240);
  return note ? drawTextBlock(surface, note, 18, y, { verticalShift: "text" }) : drawBlank(surface, "Compass", 12, y, 160);
}

function drawBlank(surface, label, size, y, lineWidth) {
  const gap = size / 3;
  const left = (PAGE_WIDTH - textWidth(label, size) - gap - lineWidth) / 2;
  const lineX = left + textWidth(label, size) + gap;
  surface.text(label, left, y, { size, color: GREY });
  surface.line(lineX, y + 2, lineX + lineWidth, y + 2, { width: 0.5, color: GREY });
  return y + 1.2 * textHeight(label, size) + size / 2;
}

// A QR code linking back to the readings, with a caption below. (x, y) is
// the top left corner.
export function drawQrBlock(surface, url, x, y, size) {
  if (!url) return;
  const modules = qrMatrix(url);
  const cell = size / modules.length;
  const squares = [];
  modules.forEach((row, my) => {
    row.forEach((dark, mx) => {
      if (dark) squares.push([x + mx * cell, y + my * cell]);
    });
  });
  surface.squares(squares, cell);
  surface.link(x, y, size, size, url);
  surface.text("Scan to edit or reprint", x + size / 2, y + size + 8, { size: 6, color: GREY, align: "center" });
}

export function drawFooter(surface, y = PAGE_HEIGHT - EDGE_INDENT, size = 12) {
  drawTextBlock(surface, `Made with OmniRose · ${SITE}`, size, y, { color: GREY });
}

// Small print in the bottom left corner, so a printout can be matched to its readings.
export function drawDetails(surface, { readingCount, terms, date = new Date() }) {
  const printed = date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  surface.text(`${readingCount} readings · ${terms} term curve · ${printed}`, EDGE_INDENT, PAGE_HEIGHT - EDGE_INDENT + 12, {
    size: 6,
    color: GREY,
  });
}
