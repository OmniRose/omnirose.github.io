// Where the sun is in the sky, using NOAA's solar position algorithm (based
// on Jean Meeus, "Astronomical Algorithms"). Good to about 0.01° for
// dates this century, far better than anyone can read a shadow.

const RAD = Math.PI / 180;
const DEG = 180 / Math.PI;

function julianDay(date) {
  return date.getTime() / 86400000 + 2440587.5;
}

// The sun's azimuth (degrees true, clockwise from north) and altitude
// (degrees above the horizon, corrected for refraction) at a moment and place.
export function sunPosition(date, latitude, longitude) {
  const jd = julianDay(date);
  const t = (jd - 2451545) / 36525; // Julian centuries since J2000

  const meanLongitude = (280.46646 + t * (36000.76983 + t * 0.0003032)) % 360;
  const meanAnomaly = 357.52911 + t * (35999.05029 - 0.0001537 * t);
  const eccentricity = 0.016708634 - t * (0.000042037 + 0.0000001267 * t);
  const centre =
    Math.sin(meanAnomaly * RAD) * (1.914602 - t * (0.004817 + 0.000014 * t)) +
    Math.sin(2 * meanAnomaly * RAD) * (0.019993 - 0.000101 * t) +
    Math.sin(3 * meanAnomaly * RAD) * 0.000289;
  const trueLongitude = meanLongitude + centre;
  const omega = 125.04 - 1934.136 * t;
  const apparentLongitude = trueLongitude - 0.00569 - 0.00478 * Math.sin(omega * RAD);

  const meanObliquity = 23 + (26 + (21.448 - t * (46.815 + t * (0.00059 - t * 0.001813))) / 60) / 60;
  const obliquity = meanObliquity + 0.00256 * Math.cos(omega * RAD);

  const declination = Math.asin(Math.sin(obliquity * RAD) * Math.sin(apparentLongitude * RAD)) * DEG;

  const y = Math.tan((obliquity / 2) * RAD) ** 2;
  const equationOfTime =
    4 *
    DEG *
    (y * Math.sin(2 * meanLongitude * RAD) -
      2 * eccentricity * Math.sin(meanAnomaly * RAD) +
      4 * eccentricity * y * Math.sin(meanAnomaly * RAD) * Math.cos(2 * meanLongitude * RAD) -
      0.5 * y * y * Math.sin(4 * meanLongitude * RAD) -
      1.25 * eccentricity * eccentricity * Math.sin(2 * meanAnomaly * RAD)); // minutes

  const minutesUtc = (((jd + 0.5) % 1) + 1) % 1 * 1440;
  let trueSolarTime = (minutesUtc + equationOfTime + 4 * longitude) % 1440;
  if (trueSolarTime < 0) trueSolarTime += 1440;
  const hourAngle = trueSolarTime / 4 < 0 ? trueSolarTime / 4 + 180 : trueSolarTime / 4 - 180;

  const lat = latitude * RAD;
  const dec = declination * RAD;
  const cosZenith = Math.min(
    1,
    Math.max(-1, Math.sin(lat) * Math.sin(dec) + Math.cos(lat) * Math.cos(dec) * Math.cos(hourAngle * RAD)),
  );
  const zenith = Math.acos(cosZenith) * DEG;

  // Azimuth measured clockwise from north.
  const azimuth =
    (Math.atan2(
      Math.sin(hourAngle * RAD),
      Math.cos(hourAngle * RAD) * Math.sin(lat) - Math.tan(dec) * Math.cos(lat),
    ) *
      DEG +
      180 +
      360) %
    360;

  const elevation = 90 - zenith;
  return { azimuth, altitude: elevation + refraction(elevation), declination, equationOfTime };
}

// Atmospheric refraction in degrees (NOAA's approximation). It lifts the sun
// a little but doesn't change its azimuth.
function refraction(elevation) {
  if (elevation > 85) return 0;
  const te = Math.tan(elevation * RAD);
  let seconds;
  if (elevation > 5) seconds = 58.1 / te - 0.07 / te ** 3 + 0.000086 / te ** 5;
  else if (elevation > -0.575) seconds = 1735 + elevation * (-518.2 + elevation * (103.4 + elevation * (-12.79 + elevation * 0.711)));
  else seconds = -20.772 / te;
  return seconds / 3600;
}

// How fast the sun's azimuth is changing, in degrees per minute.
export function azimuthRate(date, latitude, longitude) {
  const before = sunPosition(new Date(date.getTime() - 30000), latitude, longitude).azimuth;
  const after = sunPosition(new Date(date.getTime() + 30000), latitude, longitude).azimuth;
  return Math.abs(((after - before + 540) % 360) - 180);
}
