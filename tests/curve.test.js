import { test } from "node:test";
import assert from "node:assert/strict";

import {
  Curve,
  CurveError,
  availableTerms,
  chooseTerms,
  eastWest,
  mod360,
  validateReadings,
} from "../js/curve.js";
import { samples } from "./fixtures/samples.js";

const close = (actual, expected, tolerance = 1e-3) =>
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} is not within ${tolerance} of ${expected}`);

// Smallest difference between two angles, so 359.9 and 0.1 are 0.2 apart.
const angleClose = (actual, expected, tolerance = 1e-6) => {
  const diff = Math.abs(mod360(actual - expected + 180) - 180);
  assert.ok(diff <= tolerance, `${actual}° is not within ${tolerance}° of ${expected}°`);
};

const rya = samples.rya_training_almanac.readings;

test("mod360", () => {
  assert.equal(mod360(0), 0);
  assert.equal(mod360(180), 180);
  assert.equal(mod360(359), 359);
  assert.equal(mod360(360), 0);
  assert.equal(mod360(370), 10);
  assert.equal(mod360(-10), 350);
  close(mod360(-12.34), 347.66, 1e-9);
});

test("eastWest", () => {
  assert.equal(eastWest(3), "3°E");
  assert.equal(eastWest(-7.5), "7.5°W");
  assert.equal(eastWest(0), "0°");
});

// Golden values from the original Django test suite, which used the most
// terms the readings allowed (13 for the 16 RYA readings, 11 for the 12
// handbook readings).
test("deviation matches the original site", () => {
  const curve = new Curve(rya, { terms: 13 });
  close(curve.deviationAt(0), -3.843);
  close(curve.deviationAt(100), 4.509);
  assert.equal(curve.minDeviation, -7);
  assert.equal(curve.maxDeviation, 7);

  const handbook = new Curve(samples.instrument_flying_handbook.readings, { terms: 11 });
  assert.equal(handbook.minDeviation, -7);
  assert.equal(handbook.maxDeviation, 6);
});

test("easterly deviation is added going from compass to magnetic", () => {
  // Constant 5°E deviation.
  const curve = new Curve([[0, 5], [120, 5], [240, 5]]);
  close(curve.compassToMagnetic(10), 15, 1e-9);
  close(curve.magneticToCompass(15), 10, 1e-9);
  close(curve.compassToTrue(10, -3), 12, 1e-9);
  close(curve.trueToCompass(12, -3), 10, 1e-9);
});

test("readings are on magnetic headings", () => {
  const curve = new Curve(rya, { terms: 13 });
  for (const [magnetic, deviation] of rya) {
    const compass = curve.magneticToCompass(magnetic);
    // The curve does not pass exactly through every reading, so compare
    // against the fitted deviation at that heading.
    angleClose(compass, magnetic - curve.deviationAt(magnetic), 1e-9);
    close(Math.abs(deviation - curve.deviationAt(magnetic)), 0, 0.5);
  }
});

test("conversions round trip for every degree", () => {
  for (const name of ["rya_training_almanac", "astrid_1974", "navy_admin_textbook", "otter"]) {
    const curve = new Curve(samples[name].readings);
    for (const variation of [-12, -3, 0, 4.5, 15]) {
      for (let compass = 0; compass < 360; compass++) {
        const trueBearing = curve.compassToTrue(compass, variation);
        angleClose(curve.trueToCompass(trueBearing, variation), compass, 1e-6);
      }
    }
  }
});

test("can fit every sample with enough readings", () => {
  for (const [name, sample] of Object.entries(samples)) {
    if (sample.readings.length < 3) continue;
    for (const terms of availableTerms(sample.readings.length)) {
      const curve = new Curve(sample.readings, { terms });
      assert.ok(Number.isFinite(curve.deviationAt(123)), `${name} with ${terms} terms`);
      assert.ok(curve.maxDeviation > curve.minDeviation, `${name} range`);
    }
  }
});

test("a flat line has a usable range", () => {
  const curve = new Curve(samples.flat_line.readings);
  assert.equal(curve.minDeviation, -1);
  assert.equal(curve.maxDeviation, 1);
});

test("automatic term choice", () => {
  assert.equal(chooseTerms(samples.four_points.readings), 3);
  assert.equal(chooseTerms(samples.rya_training_almanac_every_45.readings), 3);
  assert.equal(chooseTerms(samples.otter.readings), 5);
  assert.equal(chooseTerms(samples.astrid_1974.readings), 7);

  // Never forced through every reading, never more than 7 terms.
  for (const sample of Object.values(samples)) {
    const n = sample.readings.length;
    if (n < 3) continue;
    const terms = chooseTerms(sample.readings);
    assert.ok(terms <= 7);
    assert.ok(n < 5 || terms < n);
  }
});

test("term override is limited by the number of readings", () => {
  assert.deepEqual(availableTerms(4), [3]);
  assert.deepEqual(availableTerms(8), [3, 5, 7]);
  assert.deepEqual(availableTerms(16), [3, 5, 7, 9, 11, 13]);
  assert.throws(() => new Curve(samples.four_points.readings, { terms: 5 }), CurveError);
  assert.ok(new Curve(samples.rya_training_almanac_every_45.readings, { terms: 7 }).passesThroughEveryReading === false);
});

test("too few readings", () => {
  assert.throws(() => new Curve(samples.too_few_points.readings), CurveError);
});

test("validation", () => {
  const { readings, errors, warnings } = validateReadings([
    [90, 2],
    [360, 1],
    [45, NaN],
    [400, 0],
    [180, 45],
  ]);
  assert.deepEqual(readings, [[0, 1], [90, 2], [180, 45]]);
  assert.equal(errors.length, 2);
  assert.equal(warnings.length, 1);

  const dupes = validateReadings([[0, 1], [360, 2], [90, 0], [180, 0]]);
  assert.match(dupes.errors[0], /twice/);
});

test("bunched headings give a friendly error rather than nonsense", () => {
  assert.throws(() => new Curve([[10, 1], [10.0000000001, 1], [10.0000000002, 1]], { terms: 3 }), CurveError);
});
