// Helvetica metrics, shared by the SVG preview and the PDF writer so that
// text is laid out identically in both. PDFs use the built-in Helvetica font
// with WinAnsi (Windows-1252) encoding, so no font needs embedding. Arial,
// used as the fallback on screen, has the same widths.

// Advance widths in 1/1000 em for character codes 32-126.
const ASCII_WIDTHS = [
  278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, // space to /
  556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556, // 0 to ?
  1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778, // @ to O
  667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556, // P to _
  333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556, // ` to o
  556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584, // p to ~
];

// Widths for WinAnsi codes 128-255 that are not the default.
const HIGH_WIDTHS = {
  0x80: 556, 0x82: 222, 0x84: 333, 0x85: 1000, 0x8a: 667, 0x8b: 333, 0x8c: 1000, 0x8e: 611,
  0x91: 222, 0x92: 222, 0x93: 333, 0x94: 333, 0x95: 350, 0x96: 556, 0x97: 1000, 0x99: 1000,
  0x9a: 500, 0x9b: 333, 0x9c: 944, 0x9e: 500, 0x9f: 667,
  0xa0: 278, 0xa1: 333, 0xa6: 260, 0xa7: 556, 0xa8: 333, 0xa9: 737, 0xaa: 370, 0xab: 556,
  0xac: 584, 0xad: 333, 0xae: 737, 0xaf: 333, 0xb0: 400, 0xb1: 584, 0xb2: 333, 0xb3: 333,
  0xb4: 333, 0xb5: 556, 0xb6: 537, 0xb7: 278, 0xb8: 333, 0xb9: 333, 0xba: 365, 0xbb: 556,
  0xbc: 834, 0xbd: 834, 0xbe: 834, 0xbf: 611,
  0xc6: 1000, 0xc7: 722, 0xd0: 722, 0xd1: 722, 0xd7: 584, 0xdf: 611,
  0xe6: 889, 0xe7: 500, 0xf7: 584, 0xf8: 611, 0xfd: 500, 0xff: 500,
};

function highWidth(code) {
  if (code in HIGH_WIDTHS) return HIGH_WIDTHS[code];
  if (code >= 0xc0 && code <= 0xc5) return 667; // À-Å
  if (code >= 0xc8 && code <= 0xcb) return 667; // È-Ë
  if (code >= 0xcc && code <= 0xcf) return 278; // Ì-Ï
  if (code >= 0xd2 && code <= 0xd6) return 778; // Ò-Ö
  if (code === 0xd8) return 778;
  if (code >= 0xd9 && code <= 0xdc) return 722; // Ù-Ü
  if (code === 0xdd || code === 0xde) return 667;
  if (code >= 0xe0 && code <= 0xe5) return 556;
  if (code >= 0xe8 && code <= 0xeb) return 556;
  if (code >= 0xec && code <= 0xef) return 278;
  if (code >= 0xf0 && code <= 0xf6) return 556;
  if (code >= 0xf9 && code <= 0xfc) return 556;
  if (code === 0xfe) return 556;
  return 556;
}

// Unicode characters in Windows-1252's 0x80-0x9F block.
const CP1252_SPECIALS = {
  "€": 0x80, "‚": 0x82, "ƒ": 0x83, "„": 0x84, "…": 0x85, "†": 0x86, "‡": 0x87, "ˆ": 0x88,
  "‰": 0x89, "Š": 0x8a, "‹": 0x8b, "Œ": 0x8c, "Ž": 0x8e, "‘": 0x91, "’": 0x92, "“": 0x93,
  "”": 0x94, "•": 0x95, "–": 0x96, "—": 0x97, "˜": 0x98, "™": 0x99, "š": 0x9a, "›": 0x9b,
  "œ": 0x9c, "ž": 0x9e, "Ÿ": 0x9f,
};
const CP1252_TO_UNICODE = Object.fromEntries(Object.entries(CP1252_SPECIALS).map(([ch, code]) => [code, ch]));

// Convert a string to WinAnsi codes. Characters the font can't show become "?".
export function toWinAnsi(text) {
  const codes = [];
  for (const ch of String(text)) {
    const cp = ch.codePointAt(0);
    if (cp >= 32 && cp <= 126) codes.push(cp);
    else if (cp >= 0xa0 && cp <= 0xff) codes.push(cp);
    else if (ch in CP1252_SPECIALS) codes.push(CP1252_SPECIALS[ch]);
    else if (cp === 9 || cp === 10 || cp === 13) codes.push(32);
    else codes.push(63); // ?
  }
  return codes;
}

// The text as it will actually appear, after unsupported characters are replaced.
export function displayable(text) {
  return toWinAnsi(text)
    .map((code) => (code >= 0x80 && code <= 0x9f ? CP1252_TO_UNICODE[code] : String.fromCharCode(code)))
    .join("");
}

export function textWidth(text, size) {
  let units = 0;
  for (const code of toWinAnsi(text)) {
    units += code <= 126 ? ASCII_WIDTHS[code - 32] : highWidth(code);
  }
  return (units * size) / 1000;
}

// Approximate vertical metrics, as fractions of the font size.
export const CAP_HEIGHT = 0.718;
export const ASCENT = 0.718;
export const DESCENT = 0.207;
export const LINE_HEIGHT = 1.15;
