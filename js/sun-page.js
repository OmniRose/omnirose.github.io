// The "Swing by the sun" page: pelorus printout, readings in, deviations out.

import { bearing, eastWest, formatNumber } from "./curve.js";
import { PAGE_HEIGHT, PAGE_WIDTH } from "./draw/common.js";
import { drawPelorus } from "./draw/pelorus.js";
import { mailto } from "./email.js";
import { PdfSurface, SvgSurface } from "./draw/surface.js";
import { remember, restore } from "./remember.js";
import { encodeState } from "./state.js";
import {
  decodeSwing,
  encodeSwing,
  formatCoordinate,
  parseCoordinate,
  offsetFromEdge,
  parseShadow,
  reduceObservation,
  toUtc,
} from "./sunswing.js";
import { MagneticModel, decimalYear } from "./wmm.js";

const STORAGE_KEY = "omnirose:sun";

const $ = (selector) => document.querySelector(selector);

const els = {
  vessel: $("#vessel"),
  note: $("#note"),
  lat: $("#lat"),
  lon: $("#lon"),
  latHint: $("#lat-hint"),
  lonHint: $("#lon-hint"),
  locate: $("#locate"),
  locateHint: $("#locate-hint"),
  date: $("#date"),
  tz: $("#tz"),
  variation: $("#variation"),
  variationDir: $("#variation-dir"),
  variationHint: $("#variation-hint"),
  pc: $("#pc"),
  edge: $("#edge"),
  offsetHint: $("#offset-hint"),
  observations: $("#observations"),
  messages: $("#sun-messages"),
  summary: $("#result-summary"),
  toTable: $("#to-table"),
  emailSwing: $("#email-swing"),
};

let model = null;
let variationIsManual = false;

// ---------------------------------------------------------------- Helpers

function pad(n) {
  return String(n).padStart(2, "0");
}

function nowTime() {
  const d = new Date();
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function today() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// This device's offset from UTC (east positive) on a given date.
function deviceOffset(dateText) {
  const [y, m, d] = (dateText || today()).split("-").map(Number);
  return -new Date(y, m - 1, d, 12).getTimezoneOffset();
}

function offsetLabel(minutes) {
  const sign = minutes < 0 ? "−" : "+";
  const abs = Math.abs(minutes);
  return `UTC${sign}${Math.floor(abs / 60)}${abs % 60 ? `:${pad(abs % 60)}` : ""}`;
}

function fillTimezones(selected) {
  const device = deviceOffset(els.date.value);
  const options = [];
  for (let m = -12 * 60; m <= 14 * 60; m += 15) {
    if (m % 60 !== 0 && m % 30 !== 0 && ![345, 525, 765, 825].includes(Math.abs(m))) continue;
    const label = `${offsetLabel(m)}${m === device ? " (this phone)" : ""}${m === 0 ? " (GMT)" : ""}`;
    options.push(`<option value="${m}">${label}</option>`);
  }
  els.tz.innerHTML = options.join("");
  els.tz.value = String(Number.isFinite(selected) ? selected : device);
}

// ---------------------------------------------------------------- Rows

let rowCount = 0;

function addObservation({ time = "", compass = "", shadow = "" } = {}, { focus } = {}) {
  rowCount++;
  const div = document.createElement("div");
  div.className = "obs";
  div.innerHTML = `
    <div class="obs-inputs">
      <label>Time
        <span class="obs-time"><input class="time" placeholder="hh:mm:ss" inputmode="numeric" autocomplete="off">
        <button type="button" class="now" title="Set to the time now">Now</button></span>
      </label>
      <label>Compass
        <span><input class="compass" type="number" min="0" max="360" step="any" inputmode="decimal">°</span>
      </label>
      <label>Shadow edge
        <span><input class="shadow" type="number" min="0" max="360" step="any" inputmode="decimal">°</span>
      </label>
      <button type="button" class="remove" aria-label="Remove this reading" title="Remove">×</button>
    </div>
    <div class="obs-result"></div>`;
  div.querySelector(".time").value = time;
  div.querySelector(".compass").value = compass;
  div.querySelector(".shadow").value = shadow;
  els.observations.append(div);
  if (focus) div.querySelector(focus).focus();
  return div;
}

function readObservations() {
  return Array.from(els.observations.children).map((div) => ({
    element: div,
    time: div.querySelector(".time").value.trim(),
    compass: div.querySelector(".compass").value.trim(),
    shadow: div.querySelector(".shadow").value.trim(),
  }));
}

// ---------------------------------------------------------------- State

function currentState() {
  return {
    vessel: els.vessel.value.trim(),
    note: els.note.value.trim(),
    latitude: Math.round(parseCoordinate(els.lat.value, "lat") * 1e5) / 1e5,
    longitude: Math.round(parseCoordinate(els.lon.value, "lon") * 1e5) / 1e5,
    date: els.date.value,
    offsetMinutes: Number(els.tz.value),
    variationOverride: variationIsManual ? manualVariation() : NaN,
    pelorusCorrection: Number(els.pc.value) || 0,
    edgeReading: els.edge.value.trim() === "" ? NaN : Number(els.edge.value),
    observations: readObservations().map(({ time, compass, shadow }) => ({ time, compass, shadow })),
  };
}

function manualVariation() {
  const value = Number(els.variation.value);
  return els.variation.value.trim() === "" || !Number.isFinite(value) ? NaN : value * Number(els.variationDir.value);
}

function setVariationInputs(value) {
  els.variation.value = Number.isFinite(value) ? formatNumber(Math.abs(Math.round(value * 10) / 10)) : "";
  els.variationDir.value = value < 0 ? "-1" : "1";
}

function load() {
  const state = decodeSwing(location.hash);
  els.vessel.value = state.vessel;
  els.note.value = state.note;
  els.lat.value = formatCoordinate(state.latitude, "lat");
  els.lon.value = formatCoordinate(state.longitude, "lon");
  els.date.value = state.date || today();
  fillTimezones(state.offsetMinutes);
  variationIsManual = Number.isFinite(state.variationOverride);
  if (variationIsManual) setVariationInputs(state.variationOverride);
  els.pc.value = state.pelorusCorrection || 0;
  els.edge.value = Number.isFinite(state.edgeReading) ? formatNumber(state.edgeReading) : "";
  els.observations.replaceChildren();
  state.observations.forEach((o) => addObservation(o));
  if (!state.observations.length) addObservation();
  update();
}

// ---------------------------------------------------------------- Update

let pending = false;
function scheduleUpdate() {
  if (pending) return;
  pending = true;
  setTimeout(() => {
    pending = false;
    update();
  });
}

function currentVariation(latitude, longitude) {
  if (variationIsManual) {
    els.variationHint.innerHTML = 'From you. <button type="button" class="link" id="auto-variation">Work it out instead</button>';
    return manualVariation();
  }
  const date = toUtc(els.date.value, "12:00", 0);
  if (!model || !Number.isFinite(latitude) || !Number.isFinite(longitude) || !date) {
    setVariationInputs(NaN);
    els.variationHint.textContent = model
      ? "Enter your position and date to work it out, or type it in from your chart."
      : "Type it in from your chart.";
    return NaN;
  }
  const year = decimalYear(date);
  const value = model.declination(latitude, longitude, year);
  setVariationInputs(value);
  els.variationHint.textContent =
    year > model.validUntil
      ? `About ${eastWest(Math.round(value * 10) / 10)}, but OmniRose's magnetic model has expired, so check your chart.`
      : `${eastWest(Math.round(value * 10) / 10)} at your position, from the World Magnetic Model.`;
  return value;
}

function li(text, className) {
  const item = document.createElement("li");
  item.className = className;
  item.textContent = text;
  return item;
}

function update() {
  const state = currentState();
  // Don't fill the address bar with just today's date until something's been entered.
  const started =
    state.vessel || state.note || Number.isFinite(state.latitude) || Number.isFinite(state.longitude) ||
    state.observations.some((o) => o.time || o.compass || o.shadow);
  const hash = started ? encodeSwing(state) : "";
  if (location.hash !== hash) history.replaceState(null, "", hash || location.pathname);
  remember(STORAGE_KEY, hash);

  const latitude = parseCoordinate(els.lat.value, "lat");
  const longitude = parseCoordinate(els.lon.value, "lon");
  els.latHint.textContent = els.lat.value && !Number.isFinite(latitude) ? "Not sure what that is: try 50°47.2'N or 50.787" : "";
  els.lonHint.textContent = els.lon.value && !Number.isFinite(longitude) ? "Not sure what that is: try 001°18.0'W or -1.3" : "";
  const variation = currentVariation(latitude, longitude);

  const offset = els.edge.value.trim() === "" ? NaN : offsetFromEdge(Number(els.edge.value));
  els.offsetHint.textContent = Number.isFinite(offset)
    ? `So the shadow edge reads ${formatNumber(Math.round(offset * 10) / 10)}° short of the sun's bearing; OmniRose adds that back.`
    : "";

  const messages = [];
  if (!Number.isFinite(offset)) messages.push(li("Enter where your can's shadow edge meets the scale with the sun dead ahead: a number between 270 and 360, about 336 for most cans.", "warning"));
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) messages.push(li("Enter your position (step 3) to work out the sun's bearing.", "warning"));
  else if (!Number.isFinite(variation)) messages.push(li("Enter the variation (step 3).", "warning"));

  const results = [];
  const emailRows = [];
  for (const obs of readObservations()) {
    const out = obs.element.querySelector(".obs-result");
    out.replaceChildren();
    if (!obs.time && !obs.compass && !obs.shadow) continue;
    const row = `${obs.time || "--:--:--"}  compass ${obs.compass ? `${obs.compass}°` : "?"}  shadow ${obs.shadow || "?"}`;
    emailRows.push(row);

    const date = toUtc(els.date.value, obs.time, Number(els.tz.value));
    const compass = obs.compass === "" ? NaN : Number(obs.compass);
    const shadow = parseShadow(obs.shadow);
    const missing = [];
    const wrong = [];
    if (!obs.time) missing.push("time");
    else if (!date) wrong.push("The time should look like 14:05:30.");
    if (!obs.compass) missing.push("compass");
    else if (!Number.isFinite(compass) || compass < 0 || compass > 360) wrong.push("The compass reading should be from 0 to 360.");
    if (!obs.shadow) missing.push("shadow edge");
    else if (!Number.isFinite(shadow)) wrong.push("The shadow edge should be a number from 0 to 360.");
    if (missing.length || wrong.length) {
      const text = [...wrong, missing.length ? `Still to fill in: ${missing.join(", ")}.` : ""].join(" ").trim();
      out.append(Object.assign(document.createElement("p"), { className: "hint", textContent: text }));
      continue;
    }
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || !Number.isFinite(variation) || !Number.isFinite(offset)) continue;

    const r = reduceObservation({
      date,
      latitude,
      longitude,
      compass,
      shadow,
      variation,
      offset,
      pelorusCorrection: Number(els.pc.value) || 0,
    });
    results.push(r);
    emailRows[emailRows.length - 1] = `${row}  ->  ${bearing(Math.round(r.magneticHeading * 10) / 10, "M")}, deviation ${eastWest(Math.round(r.deviation * 10) / 10)}`;
    const working = document.createElement("p");
    working.className = "obs-working";
    working.innerHTML =
      `Sun ${r.sunRelative.toFixed(1)}° from the bow, bearing <b>${r.azimuth.toFixed(1)}°T</b>, ${Math.round(r.altitude)}° up → ` +
      `heading <b>${r.trueHeading.toFixed(1)}°T</b>, <b>${r.magneticHeading.toFixed(1)}°M</b> → ` +
      `deviation <b class="dev">${eastWest(Math.round(r.deviation * 10) / 10)}</b>`;
    out.append(working);
    for (const w of r.warnings) out.append(Object.assign(document.createElement("p"), { className: "obs-warning", textContent: w }));
  }

  els.messages.replaceChildren(...messages);
  updateSummary(state, results, variation);
  els.emailSwing.href = emailHref(state, emailRows, variation, offset);
}

// The raw readings (with the deviation each gives, where it can be worked
// out), the settings they depend on, and links back to this page and on to
// the rose.
function emailHref(state, rows, variation, offset) {
  const boat = [state.vessel, state.note].filter(Boolean).join(", ");
  const lines = [`Sun swing readings${boat ? ` for ${boat}` : ""}, from OmniRose.`, ""];
  const where = Number.isFinite(state.latitude) && Number.isFinite(state.longitude)
    ? `, at ${formatCoordinate(state.latitude, "lat")} ${formatCoordinate(state.longitude, "lon")}` : "";
  const clock = Number.isFinite(state.offsetMinutes) ? els.tz.selectedOptions[0]?.textContent : "";
  lines.push(`${state.date}${where}${clock ? `, clock ${clock}` : ""}`);
  if (Number.isFinite(variation)) lines.push(`Variation ${eastWest(Math.round(variation * 10) / 10)}`);
  if (Number.isFinite(offset)) lines.push(`Shadow edge with the sun dead ahead: ${formatNumber(360 - offset)}`);
  if (rows.length) lines.push("", ...rows);
  lines.push("", "Carry on with this swing here:", location.href);
  if (els.toTable.getAttribute("aria-disabled") !== "true") lines.push("", "Make the OmniRose from it here:", els.toTable.href);
  return mailto(`OmniRose sun swing${state.vessel ? ` for ${state.vessel}` : ""}`, lines);
}

function updateSummary(state, results, variation) {
  const usable = results.filter((r) => r.altitude > 0);
  const readings = usable
    .map((r) => [Math.round(r.magneticHeading * 10) / 10, Math.round(r.deviation * 10) / 10])
    .sort((a, b) => a[0] - b[0]);

  if (readings.length < 3) {
    els.summary.textContent =
      readings.length === 0
        ? "Once you have a few readings, they'll be turned into deviations here."
        : `${readings.length} reading${readings.length > 1 ? "s" : ""} so far. You need at least 3, and 8 or more all the way round is better.`;
    els.toTable.setAttribute("aria-disabled", "true");
    els.toTable.href = "../make/";
    return;
  }

  const rounded = Math.round(variation);
  const hash = encodeState({
    vessel: state.vessel,
    note: state.note,
    readings,
    terms: null,
    variation: Number.isFinite(rounded) ? [rounded, rounded] : null,
  });
  els.toTable.href = `../make/${hash}`;
  els.toTable.removeAttribute("aria-disabled");

  const spread = Math.max(...readings.map(([h]) => h)) - Math.min(...readings.map(([h]) => h));
  const coverage =
    spread < 200 ? " Your headings only cover part of the circle, so the curve will be guesswork on the rest. Try to go all the way round." : "";
  els.summary.textContent =
    `${readings.length} readings, from ${eastWest(Math.min(...readings.map(([, d]) => d)))} to ` +
    `${eastWest(Math.max(...readings.map(([, d]) => d)))} of deviation.${coverage}`;
}

// ---------------------------------------------------------------- Pelorus

function showPelorus() {
  const svg = new SvgSurface(PAGE_WIDTH, PAGE_HEIGHT);
  drawPelorus(svg);
  $("#pelorus-preview").innerHTML = svg.toSvg(0, { title: "The OmniRose sun pelorus" });
}

function downloadPelorus() {
  const pdf = new PdfSurface(PAGE_WIDTH, PAGE_HEIGHT, { title: "OmniRose sun pelorus", author: "OmniRose" });
  drawPelorus(pdf);
  const href = URL.createObjectURL(new Blob([pdf.toBytes()], { type: "application/pdf" }));
  const a = Object.assign(document.createElement("a"), { href, download: "omnirose-sun-pelorus.pdf" });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(href), 60_000);
}

// ---------------------------------------------------------------- Events

function wire() {
  $("#download-pelorus").addEventListener("click", downloadPelorus);

  $("#add-now").addEventListener("click", () => {
    if (!els.date.value) els.date.value = today();
    // Use the last row if it's still empty, rather than leaving a blank one behind.
    const last = readObservations().at(-1);
    if (last && !last.time && !last.compass && !last.shadow) {
      last.element.querySelector(".time").value = nowTime();
      last.element.querySelector(".compass").focus();
    } else {
      addObservation({ time: nowTime() }, { focus: ".compass" });
    }
    scheduleUpdate();
  });
  $("#add-blank").addEventListener("click", () => {
    addObservation({}, { focus: ".time" });
    scheduleUpdate();
  });

  els.observations.addEventListener("click", (event) => {
    const obs = event.target.closest(".obs");
    if (event.target.closest(".now")) {
      obs.querySelector(".time").value = nowTime();
      if (!els.date.value) els.date.value = today();
      obs.querySelector(".compass").focus();
      scheduleUpdate();
    } else if (event.target.closest(".remove")) {
      obs.remove();
      if (!els.observations.children.length) addObservation();
      scheduleUpdate();
    }
  });

  // Tidy up positions once they've been typed.
  for (const [input, kind] of [[els.lat, "lat"], [els.lon, "lon"]]) {
    input.addEventListener("change", () => {
      const value = parseCoordinate(input.value, kind);
      if (Number.isFinite(value)) input.value = formatCoordinate(value, kind);
    });
  }

  els.variation.addEventListener("input", () => {
    variationIsManual = true;
  });
  els.variationDir.addEventListener("change", () => {
    variationIsManual = true;
  });
  els.variationHint.addEventListener("click", (event) => {
    if (event.target.id === "auto-variation") {
      variationIsManual = false;
      scheduleUpdate();
    }
  });

  els.date.addEventListener("change", () => fillTimezones(Number(els.tz.value)));

  els.locate.addEventListener("click", () => {
    if (!navigator.geolocation) {
      els.locateHint.textContent = "Your browser can't share its location; type it in from your GPS instead.";
      return;
    }
    els.locateHint.textContent = "Finding you…";
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        els.lat.value = formatCoordinate(coords.latitude, "lat");
        els.lon.value = formatCoordinate(coords.longitude, "lon");
        els.locateHint.textContent = "Got it.";
        scheduleUpdate();
      },
      () => {
        els.locateHint.textContent = "Couldn't get your location; type it in from your GPS instead.";
      },
      { enableHighAccuracy: false, maximumAge: 600_000, timeout: 20_000 },
    );
  });

  els.toTable.addEventListener("click", (event) => {
    if (els.toTable.getAttribute("aria-disabled") === "true") event.preventDefault();
  });

  document.addEventListener("input", scheduleUpdate);
  document.addEventListener("change", scheduleUpdate);
  window.addEventListener("hashchange", () => {
    if (location.hash && location.hash !== encodeSwing(currentState())) load();
  });
}

async function loadModel() {
  try {
    const response = await fetch(new URL("../data/WMM.COF", import.meta.url));
    if (response.ok) model = new MagneticModel(await response.text());
  } catch {
    model = null;
  }
  update();
}

showPelorus();
wire();
restore(STORAGE_KEY, $("#restored"));
load();
loadModel();
