import { test } from "node:test";
import assert from "node:assert/strict";

import { azimuthRate, sunPosition } from "../js/sun.js";

const RAD = Math.PI / 180;
const DEG = 180 / Math.PI;

// An independent, simpler method: the Astronomical Almanac's low precision
// formulae for the sun (good to about 0.01° between 1950 and 2050).
function almanac(date, latitude, longitude) {
  const n = date.getTime() / 86400000 + 2440587.5 - 2451545;
  const L = 280.46 + 0.9856474 * n;
  const g = (357.528 + 0.9856003 * n) * RAD;
  const lambda = (L + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)) * RAD;
  const epsilon = (23.439 - 0.0000004 * n) * RAD;
  const ra = Math.atan2(Math.cos(epsilon) * Math.sin(lambda), Math.cos(lambda));
  const dec = Math.asin(Math.sin(epsilon) * Math.sin(lambda));
  const gmst = (18.697374558 + 24.06570982441908 * n) * 15;
  const H = (gmst + longitude) * RAD - ra;
  const lat = latitude * RAD;
  const altitude = Math.asin(Math.sin(lat) * Math.sin(dec) + Math.cos(lat) * Math.cos(dec) * Math.cos(H)) * DEG;
  const azimuth = (Math.atan2(-Math.sin(H), Math.tan(dec) * Math.cos(lat) - Math.sin(lat) * Math.cos(H)) * DEG + 360) % 360;
  return { azimuth, altitude };
}

const angleDiff = (a, b) => Math.abs(((a - b + 540) % 360) - 180);

test("agrees with an independent method all over the world", () => {
  const places = [
    [50.8, -1.3], // Solent
    [37.9, 23.7], // Aegean
    [-36.8, 174.8], // Auckland
    [18.3, -64.9], // Caribbean
    [60.2, 19.9], // Åland
    [-33.9, 18.4], // Cape Town
  ];
  let checked = 0;
  for (const [lat, lon] of places) {
    for (let day = 0; day < 365; day += 23) {
      for (let hour = 0; hour < 24; hour += 1.25) {
        const date = new Date(Date.UTC(2026, 0, 1 + day) + hour * 3600000);
        const ours = sunPosition(date, lat, lon);
        const theirs = almanac(date, lat, lon);
        // Only compare when the sun is usefully up (the almanac ignores refraction).
        if (theirs.altitude < 5 || theirs.altitude > 80) continue;
        assert.ok(angleDiff(ours.azimuth, theirs.azimuth) < 0.05, `azimuth ${lat},${lon} ${date.toISOString()}`);
        assert.ok(Math.abs(ours.altitude - theirs.altitude) < 0.25, `altitude ${lat},${lon} ${date.toISOString()}`);
        checked++;
      }
    }
  }
  assert.ok(checked > 500, `checked ${checked} positions`);
});

test("the sun is due south at local noon, and as high as theory says", () => {
  // On the equinox at Greenwich the sun crosses the meridian a few minutes
  // after 12:00 UTC (the equation of time), at an altitude of 90° - latitude.
  const lat = 51.48;
  let best = { altitude: -90 };
  for (let minute = 11 * 60; minute < 13 * 60; minute++) {
    const date = new Date(Date.UTC(2026, 2, 20) + minute * 60000);
    const pos = sunPosition(date, lat, 0);
    if (pos.altitude > best.altitude) best = { ...pos, minute };
  }
  assert.ok(angleDiff(best.azimuth, 180) < 0.3, `azimuth at noon ${best.azimuth}`);
  assert.ok(Math.abs(best.altitude - (90 - lat)) < 0.6, `noon altitude ${best.altitude}`);
  assert.ok(best.minute > 12 * 60 && best.minute < 12 * 60 + 15, `noon at minute ${best.minute}`);
});

test("in the southern hemisphere the noon sun is due north", () => {
  // Auckland is 5.24° west of the 180° meridian, so local noon is about 21
  // minutes after 00:00 UTC, plus about 2 minutes for the equation of time.
  const pos = sunPosition(new Date(Date.UTC(2026, 5, 21, 0, 23)), -36.85, 174.76);
  assert.ok(angleDiff(pos.azimuth, 0) < 0.5, `${pos.azimuth}`);
});

test("the sun rises in the east and sets in the west at the equinox", () => {
  const morning = sunPosition(new Date(Date.UTC(2026, 2, 20, 6, 30)), 0, 0);
  const evening = sunPosition(new Date(Date.UTC(2026, 2, 20, 17, 30)), 0, 0);
  assert.ok(angleDiff(morning.azimuth, 90) < 1.5, `${morning.azimuth}`);
  assert.ok(angleDiff(evening.azimuth, 270) < 1.5, `${evening.azimuth}`);
});

test("the azimuth moves faster when the sun is high", () => {
  const noonish = azimuthRate(new Date(Date.UTC(2026, 5, 21, 12, 0)), 20, 0);
  const morning = azimuthRate(new Date(Date.UTC(2026, 5, 21, 7, 0)), 20, 0);
  assert.ok(noonish > morning, `${noonish} vs ${morning}`);
  assert.ok(morning > 0.05 && morning < 0.5, `${morning}`);
});
