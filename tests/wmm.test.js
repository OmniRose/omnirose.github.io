import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { MagneticModel, decimalYear, pagesForRange, parseCof } from "../js/wmm.js";
import { regions } from "../js/regions.js";

// WMM2015 (expired, kept only to check the maths) and its official test values.
const wmm2015 = new MagneticModel(readFileSync(new URL("./fixtures/WMM2015.COF", import.meta.url), "utf8"));

test("matches the official WMM2015 test values", () => {
  for (const [lat, lon, year, expected] of [
    [80, 0, 2015, -3.85],
    [0, 120, 2015, 0.57],
    [-80, 240, 2015, 69.81],
    [80, 0, 2017.5, -2.75],
    [0, 120, 2017.5, 0.32],
    [-80, 240, 2017.5, 69.58],
  ]) {
    const actual = wmm2015.declination(lat, lon, year);
    assert.ok(Math.abs(actual - expected) < 0.005, `${lat},${lon} ${year}: ${actual} vs ${expected}`);
  }
});

test("parses the coefficient file", () => {
  const cof = parseCof(readFileSync(new URL("./fixtures/WMM2015.COF", import.meta.url), "utf8"));
  assert.equal(cof.epoch, 2015);
  assert.equal(cof.maxDegree, 12);
  assert.equal(cof.coefficients.length, 90);
  assert.throws(() => parseCof("not a model"));
});

test("decimal years", () => {
  assert.equal(decimalYear(new Date(Date.UTC(2026, 0, 1))), 2026);
  assert.ok(Math.abs(decimalYear(new Date(Date.UTC(2026, 6, 2, 12))) - 2026.5) < 0.001);
});

test("declination range over an area", () => {
  // English Channel in 2015: about 3°W in the west to 0° in the east.
  const { min, max } = wmm2015.declinationRange({ south: 49.3, north: 51.2, west: -6, east: 2 }, 2015, 2015);
  assert.ok(min > -3.5 && min < -2.5, `min ${min}`);
  assert.ok(max > -0.5 && max < 0.5, `max ${max}`);
  assert.deepEqual(pagesForRange({ min: -4.4, max: -0.6 }), [-4, -1]);
});

test("areas that cross the antimeridian", () => {
  const { min, max } = wmm2015.declinationRange({ south: -19, north: -16, west: 177, east: -178 }, 2015, 2015);
  assert.ok(Number.isFinite(min) && Number.isFinite(max) && max - min < 5);
});

test("every preset region is a sensible box", () => {
  for (const r of regions) {
    assert.ok(r.south < r.north, r.name);
    assert.ok(r.south >= -90 && r.north <= 90, r.name);
    assert.ok(r.west >= -180 && r.west <= 180 && r.east >= -180 && r.east <= 180, r.name);
    const { min, max } = wmm2015.declinationRange(r, 2015, 2015, { step: 1 });
    assert.ok(Number.isFinite(min) && Number.isFinite(max), r.name);
  }
});

// The model the site actually uses, if it has been added.
const current = new URL("../data/WMM.COF", import.meta.url);
test("the site's magnetic model loads", { skip: !existsSync(current) && "data/WMM.COF not added yet" }, () => {
  const model = new MagneticModel(readFileSync(current, "utf8"));
  assert.ok(model.epoch >= 2025);
  // Sanity check: variation in the English Channel is a few degrees either side of zero.
  const dec = model.declination(50.5, -2, model.epoch);
  assert.ok(Math.abs(dec) < 5, `${dec}`);
});
