// "Where are you sailing?": work out which variation pages to print for an
// area, using the World Magnetic Model. The helper stays hidden unless the
// model's coefficient file (data/WMM.COF) is available.

import { eastWest } from "./curve.js";
import { regions } from "./regions.js";
import { MagneticModel, decimalYear, pagesForRange } from "./wmm.js";

const YEARS_AHEAD = 3;

function formatVariation(value) {
  return eastWest(Math.round(value * 10) / 10);
}

export async function setupWhere({ container, modelUrl, onRange }) {
  let model;
  try {
    const response = await fetch(modelUrl);
    if (!response.ok) return;
    model = new MagneticModel(await response.text());
  } catch {
    return;
  }

  const select = container.querySelector("#region");
  const result = container.querySelector("#where-result");
  const locate = container.querySelector("#use-location");
  const customForm = container.querySelector("#custom-area");

  select.innerHTML += regions.map((r, i) => `<option value="${i}">${r.name}</option>`).join("");
  container.hidden = false;

  function show(box, label) {
    const now = decimalYear(new Date());
    const expired = now >= model.validUntil;
    // Cover the next few seasons, but don't extrapolate past the model.
    const until = expired ? now : Math.min(now + YEARS_AHEAD, model.validUntil);
    const range = model.declinationRange(box, now, until);
    const [from, to] = pagesForRange(range);
    onRange([from, to]);

    const years = Math.floor(until) > Math.floor(now) ? `${Math.floor(now)}–${Math.floor(until)}` : `${Math.floor(now)}`;
    const spread =
      range.max - range.min < 0.1
        ? `variation is about ${formatVariation(range.min)}`
        : `variation is between ${formatVariation(range.min)} and ${formatVariation(range.max)}`;
    const pages = from === to ? `the ${eastWest(from)} page` : `pages from ${eastWest(from)} to ${eastWest(to)}`;
    const warning = expired
      ? ` Note: OmniRose's magnetic model (${model.name}) ran out at the start of ${model.validUntil}, so double-check against an up-to-date chart.`
      : "";
    result.textContent = `${label}: ${spread} (${years}), so you'll want ${pages}.${warning}`;
  }

  select.addEventListener("change", () => {
    const region = regions[Number(select.value)];
    resetLocate();
    if (region) show(region, region.name);
  });

  const locateLabel = locate.textContent;
  const resetLocate = () => (locate.textContent = locateLabel);
  const degrees = (value, positive, negative) => `${Math.abs(value).toFixed(1)}°${value < 0 ? negative : positive}`;

  locate.addEventListener("click", () => {
    if (!navigator.geolocation) {
      result.textContent = "Your browser can't share its location. Try picking an area instead.";
      return;
    }
    locate.textContent = "Finding you…";
    result.textContent = "";
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        select.value = "";
        locate.textContent = `✓ Using your location: ${degrees(coords.latitude, "N", "S")} ${degrees(coords.longitude, "E", "W")}`;
        // About 30 nautical miles each way.
        const dLat = 0.5;
        const dLon = Math.min(0.5 / Math.max(Math.cos((coords.latitude * Math.PI) / 180), 0.1), 10);
        const wrap = (lon) => ((((lon + 180) % 360) + 360) % 360) - 180;
        show(
          {
            south: Math.max(-90, coords.latitude - dLat),
            north: Math.min(90, coords.latitude + dLat),
            west: wrap(coords.longitude - dLon),
            east: wrap(coords.longitude + dLon),
          },
          "Within about 30 miles of you",
        );
      },
      () => {
        resetLocate();
        result.textContent = "Couldn't get your location. Try picking an area instead.";
      },
      { maximumAge: 600_000, timeout: 15_000 },
    );
  });

  customForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const value = (name) => Number(customForm.elements[name].value);
    const sign = (name) => Number(customForm.elements[`${name}-dir`].value);
    const box = {
      north: value("north") * sign("north"),
      south: value("south") * sign("south"),
      west: value("west") * sign("west"),
      east: value("east") * sign("east"),
    };
    const ok =
      Object.values(box).every(Number.isFinite) &&
      box.south < box.north &&
      Math.abs(box.north) <= 90 &&
      Math.abs(box.south) <= 90 &&
      Math.abs(box.east) <= 180 &&
      Math.abs(box.west) <= 180;
    if (!ok) {
      result.textContent = "That area doesn't look right: check the north edge is north of the south edge.";
      return;
    }
    select.value = "";
    resetLocate();
    show(box, "In that area");
  });
}
