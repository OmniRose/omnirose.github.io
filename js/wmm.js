// Magnetic variation (declination) from the World Magnetic Model.
//
// Reads NOAA's standard WMM.COF coefficient file and evaluates the
// spherical harmonic model at sea level. The model is valid for five years
// from its epoch; a new coefficient file is published every five years
// (WMM2025 runs to the end of 2029).

const A = 6378.137; // WGS84 semi-major axis, km
const B = 6356.7523142; // WGS84 semi-minor axis, km
const RE = 6371.2; // geomagnetic reference radius, km

export function parseCof(text) {
  const lines = text.split(/\r?\n/).filter((line) => line.trim());
  const [epochText, name] = lines[0].trim().split(/\s+/);
  const epoch = parseFloat(epochText);
  if (!Number.isFinite(epoch)) throw new Error("Not a WMM coefficient file");

  const coefficients = [];
  let maxDegree = 0;
  for (const line of lines.slice(1)) {
    if (/^9{10,}/.test(line.trim())) break;
    const [n, m, g, h, gDot, hDot] = line.trim().split(/\s+/).map(Number);
    if (![n, m, g, h, gDot, hDot].every(Number.isFinite)) continue;
    coefficients.push({ n, m, g, h, gDot, hDot });
    maxDegree = Math.max(maxDegree, n);
  }
  return { epoch, name, maxDegree, coefficients };
}

function emptyTable(size) {
  return Array.from({ length: size + 1 }, () => new Array(size + 1).fill(0));
}

// Decimal year for a Date, e.g. 2026.5 in early July 2026.
export function decimalYear(date) {
  const year = date.getUTCFullYear();
  const start = Date.UTC(year, 0, 1);
  const end = Date.UTC(year + 1, 0, 1);
  return year + (date.getTime() - start) / (end - start);
}

export class MagneticModel {
  constructor(cofText) {
    const { epoch, name, maxDegree, coefficients } = parseCof(cofText);
    this.epoch = epoch;
    this.name = name;
    this.maxDegree = maxDegree;

    // Schmidt semi-normalisation factors, folded into the coefficients so
    // the Legendre functions below can use the simpler Gauss normalisation.
    const N = maxDegree;
    const schmidt = emptyTable(N);
    schmidt[0][0] = 1;
    for (let n = 1; n <= N; n++) {
      schmidt[n][0] = (schmidt[n - 1][0] * (2 * n - 1)) / n;
      for (let m = 1; m <= n; m++) {
        schmidt[n][m] = schmidt[n][m - 1] * Math.sqrt(((n - m + 1) * (m === 1 ? 2 : 1)) / (n + m));
      }
    }

    this.g = emptyTable(N);
    this.h = emptyTable(N);
    this.gDot = emptyTable(N);
    this.hDot = emptyTable(N);
    for (const { n, m, g, h, gDot, hDot } of coefficients) {
      this.g[n][m] = g * schmidt[n][m];
      this.h[n][m] = h * schmidt[n][m];
      this.gDot[n][m] = gDot * schmidt[n][m];
      this.hDot[n][m] = hDot * schmidt[n][m];
    }
  }

  get validFrom() {
    return this.epoch;
  }

  get validUntil() {
    return this.epoch + 5;
  }

  // Declination in degrees (east positive) at sea level for geodetic
  // latitude and longitude in degrees and a decimal year.
  declination(latitude, longitude, year) {
    const { x, y } = this.field(latitude, longitude, year);
    return (Math.atan2(y, x) * 180) / Math.PI;
  }

  // North (x) and east (y) components of the field in nT at sea level.
  field(latitude, longitude, year, altitude = 0) {
    const N = this.maxDegree;
    const dt = year - this.epoch;
    const lat = (latitude * Math.PI) / 180;
    const lon = (longitude * Math.PI) / 180;

    // Geodetic to geocentric spherical coordinates.
    const a2 = A * A;
    const b2 = B * B;
    const c2 = a2 - b2;
    const a4 = a2 * a2;
    const b4 = b2 * b2;
    const c4 = a4 - b4;
    const sinLat = Math.sin(lat);
    const cosLat = Math.cos(lat);
    const sinLat2 = sinLat * sinLat;
    const cosLat2 = cosLat * cosLat;
    const q = Math.sqrt(a2 - c2 * sinLat2);
    const q1 = altitude * q;
    const q2 = ((q1 + a2) / (q1 + b2)) ** 2;
    const ct = sinLat / Math.sqrt(q2 * cosLat2 + sinLat2); // cos of geocentric colatitude
    const st = Math.sqrt(1 - ct * ct);
    const r = Math.sqrt(altitude * altitude + 2 * q1 + (a4 - c4 * sinLat2) / (q * q));
    const d = Math.sqrt(a2 * cosLat2 + b2 * sinLat2);
    const ca = (altitude + d) / r;
    const sa = (c2 * cosLat * sinLat) / (r * d);

    // Associated Legendre functions (Gauss normalised) and their
    // derivatives with respect to colatitude.
    const P = emptyTable(N);
    const dP = emptyTable(N);
    P[0][0] = 1;
    for (let n = 1; n <= N; n++) {
      for (let m = 0; m <= n; m++) {
        if (n === m) {
          P[n][m] = st * P[n - 1][m - 1];
          dP[n][m] = st * dP[n - 1][m - 1] + ct * P[n - 1][m - 1];
        } else {
          const k = n > 1 ? ((n - 1) ** 2 - m * m) / ((2 * n - 1) * (2 * n - 3)) : 0;
          const p2 = n - 2 >= m ? P[n - 2][m] : 0;
          const dp2 = n - 2 >= m ? dP[n - 2][m] : 0;
          P[n][m] = ct * P[n - 1][m] - k * p2;
          dP[n][m] = ct * dP[n - 1][m] - st * P[n - 1][m] - k * dp2;
        }
      }
    }

    let bTheta = 0;
    let bPhi = 0;
    let bR = 0;
    let ratio = (RE / r) ** 2;
    for (let n = 1; n <= N; n++) {
      ratio *= RE / r;
      for (let m = 0; m <= n; m++) {
        const g = this.g[n][m] + dt * this.gDot[n][m];
        const h = this.h[n][m] + dt * this.hDot[n][m];
        const cosM = Math.cos(m * lon);
        const sinM = Math.sin(m * lon);
        const gh = g * cosM + h * sinM;
        bR += (n + 1) * ratio * gh * P[n][m];
        bTheta -= ratio * gh * dP[n][m];
        bPhi += m * ratio * (g * sinM - h * cosM) * P[n][m];
      }
    }
    // Near the poles sin(colatitude) is tiny; the east component is then
    // poorly defined anyway, so just avoid dividing by zero.
    bPhi /= Math.max(st, 1e-9);

    // Rotate back from geocentric to geodetic.
    const x = -bTheta * ca - bR * sa;
    const y = bPhi;
    return { x, y };
  }

  // Range of declination over a box and a span of years, sampled on a grid.
  // Returns { min, max } in degrees.
  declinationRange({ south, north, west, east }, fromYear, toYear, { step = 0.25 } = {}) {
    if (east < west) east += 360; // box crosses the antimeridian
    const latSteps = Math.max(1, Math.ceil((north - south) / step));
    const lonSteps = Math.max(1, Math.ceil((east - west) / step));
    const years = fromYear === toYear ? [fromYear] : [fromYear, (fromYear + toYear) / 2, toYear];
    let min = Infinity;
    let max = -Infinity;
    for (const year of years) {
      for (let i = 0; i <= latSteps; i++) {
        const lat = south + ((north - south) * i) / latSteps;
        for (let j = 0; j <= lonSteps; j++) {
          const lon = west + ((east - west) * j) / lonSteps;
          const dec = this.declination(lat, lon > 180 ? lon - 360 : lon, year);
          min = Math.min(min, dec);
          max = Math.max(max, dec);
        }
      }
    }
    return { min, max };
  }
}

// Whole-degree rose pages needed to cover a range of variation: each page
// is good for variation within half a degree of its value.
export function pagesForRange({ min, max }) {
  return [Math.round(min), Math.round(max)];
}
