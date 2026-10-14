import { test } from "node:test";
import assert from "node:assert/strict";

import { decodeState, emptyState, encodeState } from "../js/state.js";

test("round trip", () => {
  const state = {
    vessel: "S/V Elizabeth II & Co",
    note: "Starboard wheel compass, 100% accurate?",
    readings: [[0, -4], [22.5, -2], [45, 1.25], [90, NaN]],
    terms: 5,
    variation: [-3, 1],
  };
  const hash = encodeState(state);
  assert.match(hash, /r=0:-4,22\.5:-2,45:1\.25,90:&/);
  const back = decodeState(hash);
  assert.equal(back.vessel, state.vessel);
  assert.equal(back.note, state.note);
  assert.equal(back.terms, 5);
  assert.deepEqual(back.variation, [-3, 1]);
  assert.equal(back.readings.length, 4);
  assert.deepEqual(back.readings.slice(0, 3), state.readings.slice(0, 3));
  assert.ok(Number.isNaN(back.readings[3][1]));
});

test("empty state encodes to nothing", () => {
  assert.equal(encodeState(emptyState()), "");
  assert.deepEqual(decodeState(""), emptyState());
  assert.deepEqual(decodeState("#"), emptyState());
});

test("readings are compact", () => {
  const hash = encodeState({ ...emptyState(), readings: [[0, 1], [45, -2]] });
  assert.equal(hash, "#r=0:1,45:-2");
});

test("junk is ignored, never thrown", () => {
  for (const junk of ["#%E0%A4%A", "#r=abc", "#t=4", "#var=x,1", "#===&&&", "#r=1:2:3,4:5", "#v=%"]) {
    assert.doesNotThrow(() => decodeState(junk), junk);
  }
  assert.deepEqual(decodeState("#r=1:2:3,4:5").readings, [[4, 5]]);
  assert.equal(decodeState("#t=4").terms, null);
  assert.equal(decodeState("#var=x,1").variation, null);
});

test("long text is trimmed", () => {
  const state = decodeState(`#v=${"a".repeat(500)}`);
  assert.equal(state.vessel.length, 80);
});

test("spaces written as plus signs are understood", () => {
  assert.equal(decodeState("#v=Saucy+Sue").vessel, "Saucy Sue");
});
