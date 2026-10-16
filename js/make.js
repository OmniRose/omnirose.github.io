// The "Make your rose" page: readings in, preview and PDFs out.

import { Curve, CurveError, availableTerms, chooseTerms, eastWest, formatNumber, validateReadings } from "./curve.js";
import { PAGE_HEIGHT, PAGE_WIDTH } from "./draw/common.js";
import { drawRecord, headingsEvery } from "./draw/record.js";
import { drawRose, drawRoses } from "./draw/rose.js";
import { PdfSurface, SvgSurface } from "./draw/surface.js";
import { drawTable, tableTitle } from "./draw/table.js";
import { examples } from "./examples.js";
import { decodeState, encodeState } from "./state.js";
import { setupWhere } from "./where.js";

const MAX_ROSE_PAGES = 10;
// With no variation chosen yet, preview the rose at this much, so the
// magnetic and true rings visibly differ and show what the rose is for.
const PREVIEW_VARIATION = -5;

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

const els = {
  vessel: $("#vessel"),
  note: $("#note"),
  rows: $("#reading-rows"),
  messages: $("#messages"),
  preview: $("#preview"),
  fitSummary: $("#fit-summary"),
  previewNote: $("#preview-note"),
  terms: $("#terms"),
  example: $("#example"),
  varFrom: $("#var-from"),
  varFromDir: $("#var-from-dir"),
  varTo: $("#var-to"),
  varToDir: $("#var-to-dir"),
  roseButton: $("#rose-button"),
  roseHint: $("#rose-hint"),
  shareUrl: $("#share-url"),
  copyLink: $("#copy-link"),
};

let view = "rose";
let curve = null;
let termsChoice = null; // null means automatic

// ---------------------------------------------------------------- Rows

function addRow(heading = NaN, deviation = NaN, { focus = false } = {}) {
  const index = els.rows.children.length + 1;
  const tr = document.createElement("tr");
  const west = Number.isFinite(deviation) && deviation < 0;
  tr.innerHTML = `
    <td><input type="number" class="heading" min="0" max="360" step="any" inputmode="decimal"
          aria-label="Heading for reading ${index}"><span class="unit">°</span></td>
    <td><input type="number" class="deviation" min="0" max="90" step="any" inputmode="decimal"
          aria-label="Deviation for reading ${index}"><span class="unit">°</span></td>
    <td><select class="direction" aria-label="East or west for reading ${index}">
          <option value="1">E</option><option value="-1">W</option></select></td>
    <td><button type="button" class="remove" aria-label="Remove reading ${index}" title="Remove">×</button></td>`;
  tr.querySelector(".heading").value = Number.isFinite(heading) ? formatNumber(heading) : "";
  tr.querySelector(".deviation").value = Number.isFinite(deviation) ? formatNumber(Math.abs(deviation)) : "";
  tr.querySelector(".direction").value = west ? "-1" : "1";
  els.rows.append(tr);
  if (focus) tr.querySelector(".heading").focus();
  return tr;
}

function readRows() {
  return Array.from(els.rows.children).map((tr) => {
    const headingText = tr.querySelector(".heading").value.trim();
    const deviationText = tr.querySelector(".deviation").value.trim();
    const sign = Number(tr.querySelector(".direction").value);
    const heading = headingText === "" ? NaN : Number(headingText);
    const deviation = deviationText === "" ? NaN : sign * Number(deviationText);
    return [heading, deviation];
  });
}

function setRows(readings) {
  els.rows.replaceChildren();
  for (const [h, d] of readings) addRow(h, d);
}

function fillHeadings(step) {
  // Keep any deviations already entered for headings that are still in the list.
  const existing = new Map(readRows().filter(([h]) => Number.isFinite(h)).map(([h, d]) => [h, d]));
  const readings = [];
  for (let h = 0; h < 360; h += step) readings.push([h, existing.get(h) ?? NaN]);
  setRows(readings);
}

// ---------------------------------------------------------------- State

function variationRange() {
  const from = Number(els.varFromDir.value) * Math.abs(Number(els.varFrom.value) || 0);
  const to = Number(els.varToDir.value) * Math.abs(Number(els.varTo.value) || 0);
  return [from, to];
}

function setVariation([from, to]) {
  els.varFrom.value = Math.abs(from);
  els.varFromDir.value = from < 0 ? "-1" : "1";
  els.varTo.value = Math.abs(to);
  els.varToDir.value = to < 0 ? "-1" : "1";
}

function currentState() {
  const variation = variationRange();
  const readings = readRows();
  return {
    vessel: els.vessel.value.trim(),
    note: els.note.value.trim(),
    // Headings with no deviations yet are just the starting template; leave
    // them out of the link.
    readings: readings.some(([, d]) => Number.isFinite(d)) ? readings : [],
    terms: termsChoice,
    variation: variation[0] === 0 && variation[1] === 0 ? null : variation,
  };
}

function applyState(state) {
  els.vessel.value = state.vessel;
  els.note.value = state.note;
  setRows(state.readings);
  termsChoice = state.terms;
  setVariation(state.variation ?? [0, 0]);
}

function shareUrl() {
  return location.href.split("#")[0] + encodeState(currentState());
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

function update() {
  const state = currentState();
  const hash = encodeState(state);
  if (location.hash !== hash) history.replaceState(null, "", hash || location.pathname);
  els.shareUrl.value = shareUrl();

  // Only complete rows count; half-typed rows are left alone.
  const rows = readRows();
  const complete = rows.filter(([h, d]) => Number.isFinite(h) && Number.isFinite(d));
  const anyDeviation = rows.some(([, d]) => Number.isFinite(d));
  const incompleteRows = anyDeviation ? rows.filter(([h, d]) => Number.isFinite(h) !== Number.isFinite(d)).length : 0;
  const { readings, errors, warnings } = validateReadings(complete);

  markRows(rows);

  curve = null;
  let fitError = null;
  if (!errors.length) {
    const allowed = availableTerms(readings.length);
    const terms = termsChoice && allowed.includes(termsChoice) ? termsChoice : undefined;
    try {
      curve = new Curve(readings, { terms });
    } catch (e) {
      if (!(e instanceof CurveError)) throw e;
      fitError = e.message;
    }
  }

  updateTermsSelect(readings);
  showMessages({ errors: fitError ? [...errors, fitError] : errors, warnings, incompleteRows });
  renderPreview(state);
  updateDownloads();
}

function markRows(rows) {
  const counts = new Map();
  for (const [h] of rows) if (Number.isFinite(h)) counts.set(h % 360, (counts.get(h % 360) || 0) + 1);
  Array.from(els.rows.children).forEach((tr, i) => {
    const [h, d] = rows[i];
    const bad =
      (Number.isFinite(h) && (h < 0 || h > 360 || counts.get(h % 360) > 1)) ||
      (Number.isFinite(d) && Math.abs(d) > 90);
    tr.classList.toggle("has-error", bad);
  });
}

function updateTermsSelect(readings) {
  const auto = readings.length >= 3 ? chooseTerms(readings) : null;
  const options = [`<option value="">Automatic${auto ? ` (${auto} terms)` : ""}</option>`];
  for (const t of availableTerms(readings.length)) {
    options.push(`<option value="${t}">${t} terms${t === readings.length ? " (through every reading)" : ""}</option>`);
  }
  els.terms.innerHTML = options.join("");
  els.terms.value = termsChoice && availableTerms(readings.length).includes(termsChoice) ? String(termsChoice) : "";
}

function li(text, className) {
  const item = document.createElement("li");
  item.className = className;
  item.textContent = text;
  return item;
}

function showMessages({ errors, warnings, incompleteRows }) {
  const items = [];
  // "Need 3 readings" is only worth saying once someone has started typing.
  const anyInput = readRows().some(([h, d]) => Number.isFinite(h) || Number.isFinite(d));
  for (const e of errors) if (anyInput || !/At least/.test(e)) items.push(li(e, "error"));
  for (const w of warnings) items.push(li(w, "warning"));
  if (incompleteRows) {
    items.push(li(`${incompleteRows} row${incompleteRows > 1 ? "s" : ""} still need${incompleteRows > 1 ? "" : "s"} a heading or deviation.`, "warning"));
  }

  if (curve) {
    const residuals = curve.residuals();
    const rms = Math.sqrt(residuals.reduce((s, r) => s + r * r, 0) / residuals.length);
    let worst = 0;
    residuals.forEach((r, i) => {
      if (Math.abs(r) > Math.abs(residuals[worst])) worst = i;
    });
    const [wh] = curve.readings[worst];
    if (Math.abs(residuals[worst]) >= 2) {
      items.push(
        li(
          `The reading at ${formatNumber(wh)}° is ${formatNumber(Math.abs(residuals[worst]).toFixed(1))}° away from the curve. Worth double-checking it?`,
          "warning",
        ),
      );
    }
    if (curve.passesThroughEveryReading && curve.readings.length > 3) {
      items.push(li("The curve is forced through every reading, so it may wiggle between them. Fewer terms usually gives a more trustworthy curve.", "warning"));
    }
    els.fitSummary.textContent =
      `${curve.readings.length} readings, ${curve.terms} term curve. ` +
      `On average the curve is within ${rms < 0.05 ? "0.1" : rms.toFixed(1)}° of your readings. ` +
      `Deviation ranges from ${eastWest(curve.minDeviation)} to ${eastWest(curve.maxDeviation)}.`;
  } else {
    els.fitSummary.textContent = "";
  }
  els.messages.replaceChildren(...items);
}

function renderPreview(state) {
  $$(".tabs [role=tab]").forEach((tab) => tab.setAttribute("aria-selected", String(tab.dataset.view === view)));
  if (!curve) {
    els.preview.innerHTML =
      '<p class="empty">Enter at least three readings, or try an example, and your rose will appear here.</p>';
    return;
  }
  const surface = new SvgSurface(PAGE_WIDTH, PAGE_HEIGHT);
  const details = { vessel: state.vessel, note: state.note, url: shareUrl() };
  let title;
  els.previewNote.hidden = true;
  if (view === "rose") {
    const [from, to] = variationRange();
    const unset = from === 0 && to === 0;
    const variation = unset ? PREVIEW_VARIATION : Math.min(from, to);
    drawRose(surface, curve, variation, details);
    title = `Conversion rose for ${eastWest(variation)} variation`;
    els.previewNote.hidden = !unset;
  } else {
    drawTable(surface, curve, { right: view, ...details });
    title = tableTitle(view, state.vessel);
  }
  els.preview.innerHTML = surface.toSvg(0, { title });
}

function updateDownloads() {
  $$("[data-download]").forEach((button) => {
    button.disabled = !curve;
  });
  const [from, to] = variationRange();
  const pages = Math.abs(to - from) + 1;
  if (pages > MAX_ROSE_PAGES) {
    els.roseButton.disabled = true;
    els.roseHint.textContent = `That's ${pages} pages. Please pick a range of up to ${MAX_ROSE_PAGES} degrees at a time.`;
  } else {
    els.roseHint.textContent = `${pages} page${pages > 1 ? "s" : ""}: ${eastWest(Math.min(from, to))}${pages > 1 ? ` to ${eastWest(Math.max(from, to))}` : ""}.`;
  }
}

// ---------------------------------------------------------------- Downloads

function slug(text) {
  return (
    text
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "omnirose"
  );
}

function download(kind) {
  if (!curve) return;
  const state = currentState();
  const details = { vessel: state.vessel, note: state.note, url: shareUrl() };
  let title;
  let filename;
  const pdf = new PdfSurface(PAGE_WIDTH, PAGE_HEIGHT, { author: "OmniRose" });
  if (kind === "rose") {
    const [from, to] = variationRange();
    drawRoses(pdf, curve, { from, to, ...details });
    const range = from === to ? eastWest(from) : `${eastWest(Math.min(from, to))} to ${eastWest(Math.max(from, to))}`;
    title = `Conversion roses${state.vessel ? ` for ${state.vessel}` : ""}, ${range}`;
    filename = `${slug(state.vessel)}-conversion-roses.pdf`;
  } else if (kind === "record") {
    drawRecord(pdf, { curve, ...details });
    title = `Compass swing record${state.vessel ? ` for ${state.vessel}` : ""}`;
    filename = `${slug(state.vessel)}-swing-record.pdf`;
  } else {
    drawTable(pdf, curve, { right: kind, ...details });
    title = tableTitle(kind, state.vessel);
    filename = `${slug(state.vessel)}-${kind === "compass" ? "combined" : "deviation"}-table.pdf`;
  }
  pdf.title = title;
  savePdf(pdf, filename);
}

// A sheet to take out on the swing: the headings listed in the readings
// table (every 30° if there are none), with the boat's name if it's known.
function downloadBlankRecord() {
  const state = currentState();
  const listed = readRows().map(([h]) => h).filter((h) => Number.isFinite(h) && h >= 0 && h < 360);
  const headings = listed.length ? [...new Set(listed)].sort((a, b) => a - b) : headingsEvery(30);
  const pdf = new PdfSurface(PAGE_WIDTH, PAGE_HEIGHT, { author: "OmniRose" });
  drawRecord(pdf, { headings, vessel: state.vessel, note: state.note });
  pdf.title = `Blank compass swing record${state.vessel ? ` for ${state.vessel}` : ""}`;
  savePdf(pdf, `${slug(state.vessel)}-blank-swing-record.pdf`);
}

function savePdf(pdf, filename) {
  const blob = new Blob([pdf.toBytes()], { type: "application/pdf" });
  const href = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = href;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(href), 60_000);
}

// ---------------------------------------------------------------- Events

function wire() {
  els.example.innerHTML += examples
    .map((ex, i) => `<option value="${i}">${ex.vessel}: ${ex.description}</option>`)
    .join("");

  els.example.addEventListener("change", () => {
    const ex = examples[Number(els.example.value)];
    if (!ex) return;
    els.vessel.value = ex.vessel;
    els.note.value = ex.note;
    termsChoice = null;
    setRows(ex.readings);
    els.example.value = "";
    scheduleUpdate();
  });

  $$("[data-fill]").forEach((button) =>
    button.addEventListener("click", () => {
      fillHeadings(Number(button.dataset.fill));
      els.rows.querySelector(".deviation")?.focus();
      scheduleUpdate();
    }),
  );

  $("#clear").addEventListener("click", () => {
    const hasData = readRows().some(([, d]) => Number.isFinite(d)) || els.vessel.value;
    if (hasData && !confirm("Clear everything and start again? (Your link still has the old readings if you saved it.)")) return;
    applyState({ vessel: "", note: "", readings: [], terms: null, variation: null });
    fillHeadings(45);
    scheduleUpdate();
  });

  $("#add-row").addEventListener("click", () => {
    addRow(NaN, NaN, { focus: true });
    scheduleUpdate();
  });

  els.rows.addEventListener("click", (event) => {
    const button = event.target.closest(".remove");
    if (!button) return;
    const tr = button.closest("tr");
    const next = tr.nextElementSibling || tr.previousElementSibling;
    tr.remove();
    next?.querySelector(".heading")?.focus();
    scheduleUpdate();
  });

  // A minus sign typed into the deviation means west.
  els.rows.addEventListener("change", (event) => {
    if (event.target.matches(".deviation") && Number(event.target.value) < 0) {
      event.target.value = formatNumber(Math.abs(Number(event.target.value)));
      event.target.closest("tr").querySelector(".direction").value = "-1";
      scheduleUpdate();
    }
  });

  // Enter moves on to the next row, adding one at the end.
  els.rows.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" || !event.target.matches("input")) return;
    event.preventDefault();
    const tr = event.target.closest("tr");
    if (event.target.matches(".heading")) {
      tr.querySelector(".deviation").focus();
    } else {
      const next = tr.nextElementSibling || addRow();
      const nextHeading = next.querySelector(".heading");
      (nextHeading.value ? next.querySelector(".deviation") : nextHeading).focus();
      scheduleUpdate();
    }
  });

  document.addEventListener("input", scheduleUpdate);
  document.addEventListener("change", (event) => {
    if (event.target === els.terms) termsChoice = els.terms.value ? Number(els.terms.value) : null;
    if (event.target !== els.example) scheduleUpdate();
  });

  $$(".tabs [role=tab]").forEach((tab) =>
    tab.addEventListener("click", () => {
      view = tab.dataset.view;
      scheduleUpdate();
    }),
  );

  $$("[data-download]").forEach((button) => button.addEventListener("click", () => download(button.dataset.download)));
  $("#blank-record").addEventListener("click", downloadBlankRecord);

  els.copyLink.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(els.shareUrl.value);
      els.copyLink.textContent = "Copied!";
    } catch {
      els.shareUrl.select();
      els.copyLink.textContent = "Press Ctrl/⌘ C";
    }
    setTimeout(() => (els.copyLink.textContent = "Copy link"), 2000);
  });
  els.shareUrl.addEventListener("focus", () => els.shareUrl.select());

  // Someone pasted a different link into the address bar, or went back.
  window.addEventListener("hashchange", () => {
    if (location.hash !== encodeState(currentState())) load();
  });
}

function load() {
  const state = decodeState(location.hash);
  applyState(state);
  if (!state.readings.length) fillHeadings(45);
  update();
}

wire();
load();
setupWhere({
  container: $("#where"),
  modelUrl: new URL("../data/WMM.COF", import.meta.url),
  onRange: (range) => {
    setVariation(range);
    scheduleUpdate();
  },
});
