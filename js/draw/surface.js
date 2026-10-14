// Drawing surfaces. The table and rose renderers draw through this small
// interface, so the on-screen preview (SVG) and the download (PDF) come from
// the same code.
//
// Coordinates are in points (1/72 inch) with the origin at the top left and y
// pointing down. Colours are [r, g, b] with components from 0 to 1. Text is
// positioned by its baseline; `align` is "left", "center" or "right", and
// `angle` rotates clockwise in degrees about (x, y).
//
//   newPage()
//   line(x1, y1, x2, y2, { width, color })
//   polyline(points, { width, color })
//   circle(cx, cy, r, { fill, stroke, width })
//   rect(x, y, w, h, { fill })
//   squares(list, size, { fill })     many filled squares, e.g. a QR code
//   text(string, x, y, { size, color, align, angle })
//   link(x, y, w, h, url)             clickable area

import { displayable, textWidth, toWinAnsi } from "./font.js";

const BLACK = [0, 0, 0];

function alignOffset(text, size, align) {
  const width = textWidth(text, size);
  if (align === "center") return -width / 2;
  if (align === "right") return -width;
  return 0;
}

// ---------------------------------------------------------------- SVG

function n(value) {
  return String(Math.round(value * 100) / 100);
}

function rgb(color = BLACK) {
  return `rgb(${color.map((c) => Math.round(c * 255)).join(",")})`;
}

function escapeXml(text) {
  return text.replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);
}

export class SvgSurface {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    this.pages = [];
    this.newPage();
  }

  get _page() {
    return this.pages[this.pages.length - 1];
  }

  newPage() {
    this.pages.push([]);
  }

  line(x1, y1, x2, y2, { width = 1, color = BLACK } = {}) {
    this._page.push(
      `<line x1="${n(x1)}" y1="${n(y1)}" x2="${n(x2)}" y2="${n(y2)}" stroke="${rgb(color)}" stroke-width="${n(width)}"/>`,
    );
  }

  polyline(points, { width = 1, color = BLACK } = {}) {
    const d = points.map(([x, y]) => `${n(x)},${n(y)}`).join(" ");
    this._page.push(
      `<polyline points="${d}" fill="none" stroke="${rgb(color)}" stroke-width="${n(width)}" stroke-linejoin="round"/>`,
    );
  }

  circle(cx, cy, r, { fill, stroke, width = 1 } = {}) {
    const attrs = [`fill="${fill ? rgb(fill) : "none"}"`];
    if (stroke) attrs.push(`stroke="${rgb(stroke)}" stroke-width="${n(width)}"`);
    this._page.push(`<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(r)}" ${attrs.join(" ")}/>`);
  }

  rect(x, y, w, h, { fill = BLACK } = {}) {
    this._page.push(`<rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" fill="${rgb(fill)}"/>`);
  }

  squares(list, size, { fill = BLACK } = {}) {
    const d = list.map(([x, y]) => `M${n(x)} ${n(y)}h${n(size)}v${n(size)}h-${n(size)}z`).join("");
    this._page.push(`<path d="${d}" fill="${rgb(fill)}" shape-rendering="crispEdges"/>`);
  }

  text(string, x, y, { size = 10, color = BLACK, align = "left", angle = 0 } = {}) {
    const shown = displayable(string);
    const dx = alignOffset(shown, size, align);
    const transform = angle ? ` transform="rotate(${n(angle)} ${n(x)} ${n(y)})"` : "";
    this._page.push(
      `<text x="${n(x + dx)}" y="${n(y)}" font-size="${n(size)}" fill="${rgb(color)}"${transform}>${escapeXml(shown)}</text>`,
    );
  }

  link(x, y, w, h, url) {
    this._page.push(
      `<a href="${escapeXml(url)}"><rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" fill="transparent"/></a>`,
    );
  }

  toSvg(pageIndex = 0, { title = "" } = {}) {
    const body = this.pages[pageIndex].join("");
    return (
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${this.width} ${this.height}" ` +
      `font-family="Helvetica, Arial, sans-serif" role="img"${title ? ` aria-label="${escapeXml(title)}"` : ""}>` +
      `<rect width="100%" height="100%" fill="#fff"/>${body}</svg>`
    );
  }
}

// ---------------------------------------------------------------- PDF

function p(value) {
  // PDF numbers: no exponents, at most 3 decimals.
  const rounded = Math.round(value * 1000) / 1000;
  return Object.is(rounded, -0) ? "0" : String(rounded);
}

function pdfString(text) {
  let out = "(";
  for (const code of toWinAnsi(text)) {
    if (code === 0x28 || code === 0x29 || code === 0x5c) out += `\\${String.fromCharCode(code)}`;
    else if (code < 128) out += String.fromCharCode(code);
    else out += `\\${code.toString(8).padStart(3, "0")}`;
  }
  return `${out})`;
}

function pdfAsciiString(text) {
  return pdfString(String(text).replace(/[^\x20-\x7e]/g, "?"));
}

// Bezier control point distance for drawing a quarter circle.
const KAPPA = 0.5522847498;

export class PdfSurface {
  constructor(width, height, { title = "", author = "" } = {}) {
    this.width = width;
    this.height = height;
    this.title = title;
    this.author = author;
    this.pages = [];
    this.newPage();
  }

  get _page() {
    return this.pages[this.pages.length - 1];
  }

  newPage() {
    this.pages.push({ ops: [], links: [] });
  }

  _y(y) {
    return this.height - y;
  }

  _op(text) {
    this._page.ops.push(text);
  }

  _stroke(color, width) {
    const [r, g, b] = color;
    return `${p(r)} ${p(g)} ${p(b)} RG ${p(width)} w`;
  }

  _fill(color) {
    const [r, g, b] = color;
    return `${p(r)} ${p(g)} ${p(b)} rg`;
  }

  line(x1, y1, x2, y2, { width = 1, color = BLACK } = {}) {
    this._op(`${this._stroke(color, width)} ${p(x1)} ${p(this._y(y1))} m ${p(x2)} ${p(this._y(y2))} l S`);
  }

  polyline(points, { width = 1, color = BLACK } = {}) {
    const path = points
      .map(([x, y], i) => `${p(x)} ${p(this._y(y))} ${i === 0 ? "m" : "l"}`)
      .join(" ");
    this._op(`q 1 J 1 j ${this._stroke(color, width)} ${path} S Q`);
  }

  _circlePath(cx, cy, r) {
    const y = this._y(cy);
    const k = KAPPA * r;
    return [
      `${p(cx + r)} ${p(y)} m`,
      `${p(cx + r)} ${p(y + k)} ${p(cx + k)} ${p(y + r)} ${p(cx)} ${p(y + r)} c`,
      `${p(cx - k)} ${p(y + r)} ${p(cx - r)} ${p(y + k)} ${p(cx - r)} ${p(y)} c`,
      `${p(cx - r)} ${p(y - k)} ${p(cx - k)} ${p(y - r)} ${p(cx)} ${p(y - r)} c`,
      `${p(cx + k)} ${p(y - r)} ${p(cx + r)} ${p(y - k)} ${p(cx + r)} ${p(y)} c h`,
    ].join(" ");
  }

  circle(cx, cy, r, { fill, stroke, width = 1 } = {}) {
    const parts = [];
    if (fill) parts.push(this._fill(fill));
    if (stroke) parts.push(this._stroke(stroke, width));
    parts.push(this._circlePath(cx, cy, r));
    parts.push(fill && stroke ? "B" : fill ? "f" : "S");
    this._op(parts.join(" "));
  }

  rect(x, y, w, h, { fill = BLACK } = {}) {
    this._op(`${this._fill(fill)} ${p(x)} ${p(this._y(y + h))} ${p(w)} ${p(h)} re f`);
  }

  squares(list, size, { fill = BLACK } = {}) {
    const path = list.map(([x, y]) => `${p(x)} ${p(this._y(y + size))} ${p(size)} ${p(size)} re`).join(" ");
    this._op(`${this._fill(fill)} ${path} f`);
  }

  text(string, x, y, { size = 10, color = BLACK, align = "left", angle = 0 } = {}) {
    const dx = alignOffset(string, size, align);
    const radians = (angle * Math.PI) / 180;
    const cos = Math.cos(radians);
    const sin = Math.sin(radians);
    this._op(
      `BT /F1 ${p(size)} Tf ${this._fill(color)} ${p(cos)} ${p(-sin)} ${p(sin)} ${p(cos)} ${p(x)} ${p(this._y(y))} Tm ` +
        `${p(dx)} 0 Td ${pdfString(string)} Tj ET`,
    );
  }

  link(x, y, w, h, url) {
    this._page.links.push({ rect: [x, this._y(y + h), x + w, this._y(y)], url });
  }

  // The finished PDF as a string of single-byte characters.
  toString() {
    const objects = [];
    const add = (body) => {
      objects.push(body);
      return objects.length;
    };
    const reserve = () => add(null);

    const catalog = reserve();
    const pagesId = reserve();
    const font = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
    const info = add(
      `<< /Title ${pdfString(this.title)} /Author ${pdfString(this.author)} /Creator (OmniRose - omnirose.github.io) ` +
        `/Producer (OmniRose) >>`,
    );

    const pageIds = this.pages.map((page) => {
      const content = page.ops.join("\n");
      const stream = add(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
      const annots = page.links.map(({ rect, url }) =>
        add(
          `<< /Type /Annot /Subtype /Link /Rect [${rect.map(p).join(" ")}] /Border [0 0 0] ` +
            `/A << /S /URI /URI ${pdfAsciiString(url)} >> >>`,
        ),
      );
      return add(
        `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${p(this.width)} ${p(this.height)}] ` +
          `/Resources << /Font << /F1 ${font} 0 R >> >> /Contents ${stream} 0 R` +
          (annots.length ? ` /Annots [${annots.map((id) => `${id} 0 R`).join(" ")}]` : "") +
          " >>",
      );
    });

    objects[catalog - 1] = `<< /Type /Catalog /Pages ${pagesId} 0 R >>`;
    objects[pagesId - 1] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`;

    let out = "%PDF-1.4\n%\xe2\xe3\xcf\xd3\n";
    const offsets = [];
    objects.forEach((body, i) => {
      offsets.push(out.length);
      out += `${i + 1} 0 obj\n${body}\nendobj\n`;
    });
    const xref = out.length;
    out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
    for (const offset of offsets) out += `${String(offset).padStart(10, "0")} 00000 n \n`;
    out += `trailer\n<< /Size ${objects.length + 1} /Root ${catalog} 0 R /Info ${info} 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
    return out;
  }

  toBytes() {
    const text = this.toString();
    const bytes = new Uint8Array(text.length);
    for (let i = 0; i < text.length; i++) bytes[i] = text.charCodeAt(i) & 0xff;
    return bytes;
  }
}
