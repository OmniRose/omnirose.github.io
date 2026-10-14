// Made-up boats for "Try an example". The readings were generated from
// typical deviation curves with a little measurement noise, then rounded to
// half degrees as you would write them down on a real swing.

export const examples = [
  {
    vessel: "Puffin",
    note: "Steering compass",
    description: "a small sloop swung every 45°",
    readings: [[0, -0.5], [45, 1.5], [90, 3], [135, 2.5], [180, 2.5], [225, 0.5], [270, -2.5], [315, -2.5]],
  },
  {
    vessel: "Saucy Sue",
    note: "Bulkhead compass by the chart table",
    description: "a cruiser swung every 30°",
    readings: [
      [0, 3], [30, -1], [60, -4], [90, -5.5], [120, -4], [150, -3],
      [180, -2], [210, -0.5], [240, 0.5], [270, 3], [300, 4.5], [330, 5],
    ],
  },
  {
    vessel: "Ocean Tern",
    note: "Binnacle compass, steel ketch",
    description: "a steel boat with big deviations, swung every 22.5°",
    readings: [
      [0, -5], [22.5, 0], [45, 5], [67.5, 7.5], [90, 9.5], [112.5, 9], [135, 8.5], [157.5, 7.5],
      [180, 4.5], [202.5, 3], [225, 0.5], [247.5, -1.5], [270, -4.5], [292.5, -8.5], [315, -10], [337.5, -9],
    ],
  },
];
