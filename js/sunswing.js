// Swinging the compass by the sun.
//
// A drinks can stands on the OmniRose sun pelorus, which is lined up with
// the boat's centreline. The pelorus scale is printed so that where the
// can's shadow falls reads the sun's bearing relative to the bow. Knowing
// when and where the reading was taken gives the sun's true bearing
// (azimuth), and so the boat's true heading:
//
//   true heading     = sun azimuth - sun's relative bearing
//   magnetic heading = true heading - variation        (east positive)
//   deviation        = magnetic heading - compass reading
//
// The result is a set of [magnetic heading, deviation] readings for the
// deviation table tool.

import { mod360 } from "./curve.js";
import { azimuthRate, sunPosition } from "./sun.js";

// Signed difference a - b, between -180 and 180.
export function angleDifference(a, b) {
  return mod360(a - b + 180) - 180;
}

// Average of angles, done properly around north (350 and 10 average to 0).
export function circularMean(angles) {
  const x = angles.reduce((s, a) => s + Math.cos((a * Math.PI) / 180), 0);
  const y = angles.reduce((s, a) => s + Math.sin((a * Math.PI) / 180), 0);
  return mod360((Math.atan2(y, x) * 180) / Math.PI);
}

// A shadow reading: one number for the middle of the shadow, or two (e.g.
// "112/124" or "112 124") for where each edge crosses the scale, which are
// averaged. The edges are more precise to read than the middle.
export function parseShadow(text) {
  const parts = String(text)
    .trim()
    .split(/[\s/,;]+/)
    .filter(Boolean)
    .map(Number);
  if (!parts.length || parts.length > 2 || !parts.every((n) => Number.isFinite(n) && n >= 0 && n <= 360)) return NaN;
  if (parts.length === 2 && Math.abs(angleDifference(parts[0], parts[1])) > 60) return NaN;
  return parts.length === 1 ? mod360(parts[0]) : circularMean(parts);
}

// Parse "HH:MM" or "HH:MM:SS" into seconds after midnight.
export function parseTime(text) {
  const match = /^(\d{1,2}):(\d{2})(?::(\d{2}(?:\.\d+)?))?$/.exec(String(text).trim());
  if (!match) return NaN;
  const [h, m, s] = match.slice(1).map((part) => Number(part ?? 0));
  if (h > 23 || m > 59 || s >= 60) return NaN;
  return h * 3600 + m * 60 + s;
}

// A Date from a local date ("2026-07-14"), local time ("14:05:30") and the
// clock's offset from UTC in minutes (east positive, e.g. 60 for BST).
export function toUtc(dateText, timeText, offsetMinutes) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateText));
  const seconds = parseTime(timeText);
  if (!match || !Number.isFinite(seconds) || !Number.isFinite(offsetMinutes)) return null;
  const [y, mo, d] = match.slice(1).map(Number);
  return new Date(Date.UTC(y, mo - 1, d) + (seconds - offsetMinutes * 60) * 1000);
}

// Work out the deviation from one observation. Returns the intermediate
// values too, so the page can show its working.
export function reduceObservation({ date, latitude, longitude, compass, shadow, variation, pelorusCorrection = 0 }) {
  const { azimuth, altitude } = sunPosition(date, latitude, longitude);
  const sunRelative = mod360(shadow + pelorusCorrection);
  const trueHeading = mod360(azimuth - sunRelative);
  const magneticHeading = mod360(trueHeading - variation);
  const deviation = angleDifference(magneticHeading, compass);

  const warnings = [];
  if (altitude < 0) warnings.push("The sun was below the horizon then. Check the time, date and position.");
  else if (altitude < 5) warnings.push("The sun was very low, so the shadow would be faint and long.");
  else if (altitude > 60) warnings.push(`The sun was high (${Math.round(altitude)}°), so the shadow is short and small tilts of the card matter. Mornings and afternoons work better.`);
  const rate = azimuthRate(date, latitude, longitude);
  if (rate > 0.5) warnings.push(`The sun was moving ${rate.toFixed(1)}° a minute, so the time needs to be right to the second.`);
  if (Math.abs(deviation) > 25) warnings.push("That's a very large deviation. Is the compass or shadow reading right?");

  return { azimuth, altitude, sunRelative, trueHeading, magneticHeading, deviation, rate, warnings };
}

// ---- State in the URL hash, so a half-finished swing can be bookmarked.
//
//   #v=<vessel>&n=<note>&lat=<deg>&lon=<deg>&d=YYYY-MM-DD&tz=<minutes>
//    &var=<variation override>&pc=<pelorus correction>
//    &o=<HH:MM:SS>;<compass>;<shadow>,...

const KEYS = ["v", "n", "lat", "lon", "d", "tz", "var", "pc", "o"];

export function encodeSwing(state) {
  const parts = [];
  const add = (key, value) => {
    if (value !== "" && value != null && !(typeof value === "number" && !Number.isFinite(value))) {
      parts.push(`${key}=${value}`);
    }
  };
  add("v", state.vessel && encodeURIComponent(state.vessel));
  add("n", state.note && encodeURIComponent(state.note));
  add("lat", state.latitude);
  add("lon", state.longitude);
  add("d", state.date);
  add("tz", state.offsetMinutes);
  add("var", state.variationOverride);
  add("pc", state.pelorusCorrection || null);
  const rows = (state.observations || [])
    .filter((o) => o.time || o.compass || o.shadow)
    .map((o) => [o.time, o.compass, o.shadow].map((x) => encodeURIComponent(String(x ?? "").trim()).replace(/%2F/gi, "/")).join(";"));
  if (rows.length) add("o", rows.join(","));
  return parts.length ? `#${parts.join("&")}` : "";
}

export function decodeSwing(hash) {
  const state = {
    vessel: "",
    note: "",
    latitude: NaN,
    longitude: NaN,
    date: "",
    offsetMinutes: NaN,
    variationOverride: NaN,
    pelorusCorrection: 0,
    observations: [],
  };
  const decode = (text) => {
    try {
      return decodeURIComponent(text);
    } catch {
      return "";
    }
  };
  for (const part of (hash || "").replace(/^#/, "").split("&")) {
    const eq = part.indexOf("=");
    if (eq < 0) continue;
    const key = part.slice(0, eq);
    const value = part.slice(eq + 1);
    if (!KEYS.includes(key)) continue;
    const num = Number(value);
    if (key === "v") state.vessel = decode(value).slice(0, 80);
    else if (key === "n") state.note = decode(value).slice(0, 80);
    else if (key === "lat" && Math.abs(num) <= 90) state.latitude = num;
    else if (key === "lon" && Math.abs(num) <= 180) state.longitude = num;
    else if (key === "d" && /^\d{4}-\d{2}-\d{2}$/.test(value)) state.date = value;
    else if (key === "tz" && Number.isFinite(num) && Math.abs(num) <= 14 * 60) state.offsetMinutes = num;
    else if (key === "var" && Number.isFinite(num) && Math.abs(num) <= 180) state.variationOverride = num;
    else if (key === "pc" && Number.isFinite(num) && Math.abs(num) <= 180) state.pelorusCorrection = num;
    else if (key === "o") {
      state.observations = value
        .split(",")
        .slice(0, 72)
        .map((row) => row.split(";").map(decode))
        .map(([time = "", compass = "", shadow = ""]) => ({ time, compass, shadow }));
    }
  }
  return state;
}

// Parse a latitude or longitude as decimal degrees ("-1.3", "50.78") or the
// way a GPS shows it ("50 47.2 N", "50°47.2'N", "001°18.0'W", "1 18 30 W").
// `kind` is "lat" or "lon". Returns NaN if it can't be understood.
export function parseCoordinate(text, kind) {
  const raw = String(text).trim().toUpperCase();
  if (!raw) return NaN;
  const hemisphere = raw.match(/[NSEW]/g);
  if (hemisphere && hemisphere.length > 1) return NaN;
  const letter = hemisphere?.[0];
  if (letter && (kind === "lat" ? !"NS".includes(letter) : !"EW".includes(letter))) return NaN;

  const numbers = raw.replace(/[NSEW°'"′″º]/g, " ").trim().split(/[\s,]+/).filter(Boolean);
  if (!numbers.length || numbers.length > 3) return NaN;
  const [d, m = "0", s = "0"] = numbers;
  const negative = d.startsWith("-");
  const parts = [d.replace(/^[-+]/, ""), m, s].map(Number);
  if (!parts.every(Number.isFinite) || parts[1] >= 60 || parts[2] >= 60 || (numbers.length > 1 && parts[0] % 1 !== 0)) {
    return NaN;
  }
  let value = parts[0] + parts[1] / 60 + parts[2] / 3600;
  if (negative || letter === "S" || letter === "W") value = -value;
  if (negative && (letter === "S" || letter === "W")) return NaN;
  return Math.abs(value) <= (kind === "lat" ? 90 : 180) ? value : NaN;
}

// Format decimal degrees the way a chart plotter does: 50°47.20'N.
export function formatCoordinate(value, kind) {
  if (!Number.isFinite(value)) return "";
  const letter = kind === "lat" ? (value < 0 ? "S" : "N") : value < 0 ? "W" : "E";
  const abs = Math.abs(value);
  let degrees = Math.floor(abs);
  let minutes = Math.round((abs - degrees) * 60 * 100) / 100;
  if (minutes >= 60) {
    degrees += 1;
    minutes = 0;
  }
  const width = kind === "lat" ? 2 : 3;
  return `${String(degrees).padStart(width, "0")}°${minutes.toFixed(2).padStart(5, "0")}'${letter}`;
}
