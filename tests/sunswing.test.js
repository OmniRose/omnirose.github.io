import { test } from "node:test";
import assert from "node:assert/strict";

import { Curve, mod360 } from "../js/curve.js";
import { examples } from "../js/examples.js";
import { sunPosition } from "../js/sun.js";
import {
  angleDifference,
  circularMean,
  decodeSwing,
  encodeSwing,
  parseShadow,
  parseTime,
  reduceObservation,
  toUtc,
} from "../js/sunswing.js";

const close = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg ?? ""} ${a} vs ${b}`);

test("a simulated swing gives back the boat's deviations", () => {
  // Saucy Sue in the Solent on a summer morning, with 1°E variation, turning
  // through 12 headings two minutes apart.
  const boat = new Curve(examples[1].readings);
  const latitude = 50.78;
  const longitude = -1.3;
  const variation = 1;
  const start = toUtc("2026-07-14", "08:30:00", 60);

  for (let i = 0; i < 12; i++) {
    const date = new Date(start.getTime() + i * 120000);
    const trueHeading = i * 30 + 7;
    const magnetic = mod360(trueHeading - variation);
    const compass = boat.magneticToCompass(magnetic);
    const { azimuth } = sunPosition(date, latitude, longitude);
    const shadow = mod360(azimuth - trueHeading); // what the pelorus shows

    const result = reduceObservation({ date, latitude, longitude, compass, shadow, variation });
    close(result.trueHeading, trueHeading, 1e-9, "true heading");
    close(result.magneticHeading, magnetic, 1e-9, "magnetic heading");
    close(result.deviation, boat.deviationAt(magnetic), 1e-9, "deviation");
    assert.deepEqual(result.warnings, []);
  }
});

test("the pelorus correction is added to the shadow reading", () => {
  const date = toUtc("2026-07-14", "09:00:00", 0);
  const base = reduceObservation({ date, latitude: 50, longitude: 0, compass: 100, shadow: 40, variation: 0 });
  const corrected = reduceObservation({ date, latitude: 50, longitude: 0, compass: 100, shadow: 38, variation: 0, pelorusCorrection: 2 });
  close(corrected.trueHeading, base.trueHeading, 1e-9);
});

test("warnings for a low, high or fast-moving sun", () => {
  const night = reduceObservation({ date: toUtc("2026-01-10", "23:00", 0), latitude: 50, longitude: 0, compass: 0, shadow: 0, variation: 0 });
  assert.match(night.warnings[0], /below the horizon/);
  const tropicalNoon = reduceObservation({ date: toUtc("2026-06-21", "12:00", 0), latitude: 20, longitude: 0, compass: 0, shadow: 0, variation: 0 });
  assert.ok(tropicalNoon.warnings.some((w) => /high/.test(w)));
  assert.ok(tropicalNoon.warnings.some((w) => /to the second/.test(w)));
});

test("shadow readings", () => {
  assert.equal(parseShadow("112"), 112);
  close(parseShadow("112/124"), 118, 1e-9);
  close(parseShadow("112 124"), 118, 1e-9);
  close(parseShadow("355/5"), 0, 1e-9);
  assert.ok(Number.isNaN(parseShadow("")));
  assert.ok(Number.isNaN(parseShadow("abc")));
  assert.ok(Number.isNaN(parseShadow("10/200")), "edges far apart are a typo");
  assert.ok(Number.isNaN(parseShadow("400")));
});

test("angles", () => {
  assert.equal(angleDifference(10, 350), 20);
  assert.equal(angleDifference(350, 10), -20);
  close(circularMean([350, 20]), 5, 1e-9);
});

test("times and dates", () => {
  assert.equal(parseTime("09:05"), 9 * 3600 + 5 * 60);
  assert.equal(parseTime("9:05:30"), 9 * 3600 + 5 * 60 + 30);
  assert.ok(Number.isNaN(parseTime("25:00")));
  assert.ok(Number.isNaN(parseTime("noon")));
  assert.equal(toUtc("2026-07-14", "14:00:00", 60).toISOString(), "2026-07-14T13:00:00.000Z");
  assert.equal(toUtc("2026-07-14", "01:00", 120).toISOString(), "2026-07-13T23:00:00.000Z");
  assert.equal(toUtc("2026-07-14", "nope", 0), null);
});

test("state round trip", () => {
  const state = {
    vessel: "Saucy Sue",
    note: "Bulkhead compass",
    latitude: 50.78,
    longitude: -1.3,
    date: "2026-07-14",
    offsetMinutes: 60,
    variationOverride: NaN,
    pelorusCorrection: 1.5,
    observations: [
      { time: "08:30:00", compass: "45", shadow: "112/124" },
      { time: "08:32:10", compass: "", shadow: "" },
    ],
  };
  const hash = encodeSwing(state);
  assert.match(hash, /o=08%3A30%3A00;45;112\/124,08%3A32%3A10;;/);
  assert.deepEqual(decodeSwing(hash), state);
  assert.deepEqual(decodeSwing("#lat=999&tz=x&o=%E0%A4%A").observations, [{ time: "", compass: "", shadow: "" }]);
  assert.ok(Number.isNaN(decodeSwing("#lat=999").latitude));
});

test("coordinates", async () => {
  const { parseCoordinate, formatCoordinate } = await import("../js/sunswing.js");
  close(parseCoordinate("50.78", "lat"), 50.78, 1e-9);
  close(parseCoordinate("-1.3", "lon"), -1.3, 1e-9);
  close(parseCoordinate("50 47.2 N", "lat"), 50 + 47.2 / 60, 1e-9);
  close(parseCoordinate("50°47.2'N", "lat"), 50 + 47.2 / 60, 1e-9);
  close(parseCoordinate("001°18.0'W", "lon"), -1.3, 1e-9);
  close(parseCoordinate("1 18 30 w", "lon"), -(1 + 18 / 60 + 30 / 3600), 1e-9);
  close(parseCoordinate("36 51 S", "lat"), -36.85, 1e-9);
  for (const [bad, kind] of [["", "lat"], ["91", "lat"], ["50 N", "lon"], ["10 E", "lat"], ["50 61 N", "lat"], ["-5 W", "lon"], ["abc", "lat"], ["50.5 30 N", "lat"]]) {
    assert.ok(Number.isNaN(parseCoordinate(bad, kind)), `${bad} as ${kind}`);
  }
  assert.equal(formatCoordinate(50 + 47.2 / 60, "lat"), "50°47.20'N");
  assert.equal(formatCoordinate(-1.3, "lon"), "001°18.00'W");
  assert.equal(formatCoordinate(-36.85, "lat"), "36°51.00'S");
  close(parseCoordinate(formatCoordinate(-122.4194, "lon"), "lon"), -122.4194, 1e-3);
});
