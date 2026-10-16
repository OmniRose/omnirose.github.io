// Deviation curve maths.
//
// Readings are pairs of [ship's heading (magnetic), deviation], with easterly
// deviation positive and westerly negative, so that:
//
//     magnetic = compass + deviation
//
// The deviation is modelled as a Fourier series in the heading θ:
//
//     A + B sin θ + C cos θ + D sin 2θ + E cos 2θ + ...
//
// The first five terms are the classic "A to E" coefficients of compass
// adjusting. The series is linear in its coefficients, so fitting it to the
// readings is an ordinary least-squares problem.

export const TERM_OPTIONS = [3, 5, 7, 9, 11, 13];
export const MIN_READINGS = 3;

export class CurveError extends Error {}

export function mod360(angle) {
  return ((angle % 360) + 360) % 360;
}

// "3°E", "7.5°W" or "0°".
export function eastWest(degrees) {
  const magnitude = formatNumber(Math.abs(degrees));
  if (degrees < 0) return `${magnitude}°W`;
  if (degrees > 0) return `${magnitude}°E`;
  return "0°";
}

// Like Python's "%g": no trailing zeros, at most 3 decimals.
export function formatNumber(n) {
  return String(Math.round(n * 1000) / 1000);
}

// A bearing written out in full: "045°M", "022.5°C".
export function bearing(degrees, letter) {
  const text = formatNumber(degrees);
  const [whole] = text.split(".");
  return `${"0".repeat(Math.max(0, 3 - whole.length))}${text}°${letter}`;
}

// The most terms the automatic choice will use: enough for the classic A to E
// coefficients plus one more harmonic.
export const MAX_AUTO_TERMS = 7;

// Pick the number of terms when the user has not chosen. Each candidate is
// scored with the Bayesian information criterion, which rewards fitting the
// readings closely but charges for every extra term, so we get the simplest
// curve that explains the readings. Candidates are limited to about half the
// number of readings so the curve smooths over measurement errors rather than
// being forced through every point.
export function chooseTerms(readings) {
  const n = readings.length;
  const limit = Math.min(MAX_AUTO_TERMS, Math.floor(n / 2) + 1);
  const candidates = availableTerms(n).filter((t) => t <= limit);
  if (candidates.length <= 1) return TERM_OPTIONS[0];

  // Readings are rarely better than a tenth of a degree, so don't reward
  // fitting more closely than that.
  const minVariance = 0.01;

  let best = candidates[0];
  let bestScore = Infinity;
  for (const terms of candidates) {
    const coefficients = fitCoefficients(readings, terms);
    let rss = 0;
    for (const [h, d] of readings) rss += (d - evaluate(coefficients, h)) ** 2;
    const score = n * Math.log(Math.max(rss / n, minVariance)) + terms * Math.log(n);
    if (score < bestScore - 1e-9) {
      bestScore = score;
      best = terms;
    }
  }
  return best;
}

// Every term count the readings can support.
export function availableTerms(readingCount) {
  return TERM_OPTIONS.filter((t) => t <= readingCount);
}

// Check readings and return { readings, errors, warnings }, where readings
// is the cleaned, sorted list of [heading, deviation] pairs.
export function validateReadings(rawReadings) {
  const errors = [];
  const warnings = [];
  const seen = new Map();
  const readings = [];

  rawReadings.forEach(([heading, deviation], index) => {
    const row = index + 1;
    if (!Number.isFinite(heading) || !Number.isFinite(deviation)) {
      errors.push(`Row ${row} needs both a heading and a deviation.`);
      return;
    }
    if (heading < 0 || heading > 360) {
      errors.push(`Row ${row}: headings go from 0° to 360°.`);
      return;
    }
    const h = mod360(heading);
    if (seen.has(h)) {
      errors.push(`Row ${row}: heading ${formatNumber(h)}° is entered twice (also row ${seen.get(h)}).`);
      return;
    }
    seen.set(h, row);
    if (Math.abs(deviation) > 30) {
      warnings.push(
        `Row ${row}: a deviation of ${eastWest(deviation)} is very large. Is the compass near something magnetic?`,
      );
    }
    readings.push([h, deviation]);
  });

  readings.sort((a, b) => a[0] - b[0]);

  if (readings.length < MIN_READINGS && errors.length === 0) {
    errors.push(`At least ${MIN_READINGS} readings are needed to draw a curve. ${readings.length} so far.`);
  }

  return { readings, errors, warnings };
}

function basisRow(heading, terms) {
  const theta = (heading * Math.PI) / 180;
  const row = [1];
  for (let k = 1; row.length < terms; k++) {
    row.push(Math.sin(k * theta), Math.cos(k * theta));
  }
  return row;
}

function fitCoefficients(readings, terms) {
  const A = readings.map(([h]) => basisRow(h, terms));
  const b = readings.map(([, d]) => d);
  return leastSquares(A, b);
}

function evaluate(coefficients, heading) {
  const row = basisRow(heading, coefficients.length);
  return row.reduce((sum, value, i) => sum + value * coefficients[i], 0);
}

// Least squares solution of A x = b using Householder QR. Stable even when
// headings are bunched together and the columns are nearly dependent.
export function leastSquares(A, b) {
  const m = A.length;
  const n = A[0].length;
  const R = A.map((row) => row.slice());
  const y = b.slice();

  for (let k = 0; k < n; k++) {
    let norm = 0;
    for (let i = k; i < m; i++) norm += R[i][k] ** 2;
    norm = Math.sqrt(norm);
    if (norm === 0) continue;

    const alpha = R[k][k] > 0 ? -norm : norm;
    const v = [];
    for (let i = k; i < m; i++) v.push(R[i][k]);
    v[0] -= alpha;
    const vNorm2 = v.reduce((s, x) => s + x * x, 0);
    if (vNorm2 === 0) continue;

    for (let j = k; j < n; j++) {
      let dot = 0;
      for (let i = k; i < m; i++) dot += v[i - k] * R[i][j];
      const f = (2 * dot) / vNorm2;
      for (let i = k; i < m; i++) R[i][j] -= f * v[i - k];
    }
    let dot = 0;
    for (let i = k; i < m; i++) dot += v[i - k] * y[i];
    const f = (2 * dot) / vNorm2;
    for (let i = k; i < m; i++) y[i] -= f * v[i - k];
  }

  const x = new Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    let s = y[i];
    for (let j = i + 1; j < n; j++) s -= R[i][j] * x[j];
    if (Math.abs(R[i][i]) < 1e-12) {
      throw new CurveError("The readings are too bunched together to fit a curve. Try spreading them around the compass.");
    }
    x[i] = s / R[i][i];
  }
  return x;
}

export class Curve {
  // readings: [[heading, deviation], ...]; options.terms overrides the default.
  constructor(readings, { terms } = {}) {
    const { readings: clean, errors } = validateReadings(readings);
    if (errors.length) throw new CurveError(errors[0]);

    this.readings = clean;
    this.automaticTerms = terms == null;
    this.terms = terms ?? chooseTerms(clean);
    if (!availableTerms(clean.length).includes(this.terms)) {
      throw new CurveError(`A ${this.terms} term curve needs at least ${this.terms} readings.`);
    }

    this.coefficients = fitCoefficients(clean, this.terms);

    this._findDeviationRange();
  }

  // True when the curve is forced through every reading.
  get passesThroughEveryReading() {
    return this.terms === this.readings.length;
  }

  // Deviation for a ship's heading (magnetic).
  deviationAt(magneticHeading) {
    return evaluate(this.coefficients, magneticHeading);
  }

  // How far each reading is from the fitted curve.
  residuals() {
    return this.readings.map(([h, d]) => d - this.deviationAt(h));
  }

  magneticToCompass(magnetic) {
    return mod360(magnetic - this.deviationAt(magnetic));
  }

  // Solve magnetic = compass + deviation(magnetic). The deviation changes
  // slowly with heading, so simple iteration converges quickly.
  compassToMagnetic(compass, { tolerance = 1e-9, maxIterations = 100 } = {}) {
    let magnetic = compass;
    for (let i = 0; i < maxIterations; i++) {
      const next = compass + this.deviationAt(magnetic);
      const delta = Math.abs(next - magnetic);
      magnetic = next;
      if (delta < tolerance) break;
    }
    return mod360(magnetic);
  }

  // Variation is easterly positive too: true = magnetic + variation.
  magneticToTrue(magnetic, variation = 0) {
    return mod360(magnetic + variation);
  }

  trueToMagnetic(trueBearing, variation = 0) {
    return mod360(trueBearing - variation);
  }

  compassToTrue(compass, variation = 0) {
    return this.magneticToTrue(this.compassToMagnetic(compass), variation);
  }

  trueToCompass(trueBearing, variation = 0) {
    return this.magneticToCompass(this.trueToMagnetic(trueBearing, variation));
  }

  // Whole degrees bracketing the curve and readings, with a little padding.
  _findDeviationRange() {
    let min = Infinity;
    let max = -Infinity;
    for (const [, d] of this.readings) {
      min = Math.min(min, d);
      max = Math.max(max, d);
    }
    for (let heading = 0; heading < 360; heading += 0.5) {
      const d = this.deviationAt(heading);
      min = Math.min(min, d);
      max = Math.max(max, d);
    }
    const padding = 0.05;
    this.minDeviation = Math.floor(min - padding);
    this.maxDeviation = Math.ceil(max + padding);
  }
}
