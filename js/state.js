// The tool's state lives in the URL hash, so a bookmark or shared link *is*
// the saved deviation table. The hash is never sent to a server.
//
// Format (all parts optional, any order):
//
//   #v=<vessel>&n=<note>&r=<heading>:<deviation>,...&t=<terms>&var=<from>,<to>
//
// Headings are magnetic, deviations and variations are easterly positive.
// A reading may have a blank deviation ("45:") while it is being filled in.
// Unknown keys are ignored, so the format can grow without breaking old links.

const MAX_TEXT_LENGTH = 80;
const MAX_READINGS = 72;

export function emptyState() {
  return { vessel: "", note: "", readings: [], terms: null, variation: null };
}

function number(n) {
  return Number.isFinite(n) ? String(Math.round(n * 1000) / 1000) : "";
}

export function encodeState(state) {
  const parts = [];
  if (state.vessel) parts.push(`v=${encodeURIComponent(state.vessel)}`);
  if (state.note) parts.push(`n=${encodeURIComponent(state.note)}`);
  const readings = state.readings.filter(([h, d]) => Number.isFinite(h) || Number.isFinite(d));
  if (readings.length) parts.push(`r=${readings.map(([h, d]) => `${number(h)}:${number(d)}`).join(",")}`);
  if (state.terms) parts.push(`t=${state.terms}`);
  if (state.variation) parts.push(`var=${number(state.variation[0])},${number(state.variation[1])}`);
  return parts.length ? `#${parts.join("&")}` : "";
}

function parseNumber(text) {
  if (text == null || text.trim() === "") return NaN;
  const n = Number(text);
  return Number.isFinite(n) ? n : NaN;
}

function decodeText(text, maxLength = MAX_TEXT_LENGTH) {
  try {
    return decodeURIComponent(text.replace(/\+/g, " ")).slice(0, maxLength);
  } catch {
    return "";
  }
}

// Never throws: anything it cannot understand is skipped.
export function decodeState(hash) {
  const state = emptyState();
  const body = (hash || "").replace(/^#/, "");
  if (!body) return state;

  for (const part of body.split("&")) {
    const eq = part.indexOf("=");
    if (eq < 0) continue;
    const key = part.slice(0, eq);
    const value = part.slice(eq + 1);

    if (key === "v") state.vessel = decodeText(value);
    else if (key === "n") state.note = decodeText(value);
    else if (key === "r") {
      state.readings = decodeText(value, Infinity)
        .split(",")
        .slice(0, MAX_READINGS)
        .map((pair) => pair.split(":"))
        .filter((pair) => pair.length === 2)
        .map(([h, d]) => [parseNumber(h), parseNumber(d)])
        .filter(([h, d]) => Number.isFinite(h) || Number.isFinite(d));
    } else if (key === "t") {
      const terms = parseInt(value, 10);
      if ([3, 5, 7, 9, 11, 13].includes(terms)) state.terms = terms;
    } else if (key === "var") {
      const [from, to] = decodeText(value, Infinity).split(",").map(parseNumber);
      if (Number.isFinite(from) && Number.isFinite(to)) {
        state.variation = [Math.max(-180, Math.min(180, from)), Math.max(-180, Math.min(180, to))];
      }
    }
  }
  return state;
}
