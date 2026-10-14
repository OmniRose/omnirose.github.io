// Real-world deviation tables collected for the original OmniRose test suite.
// Test data only: these are not shown on the site.
// Sources are noted where known (some links may no longer work).

export const samples = {
  rya_training_almanac: {
    vessel: "S/V Elizabeth II",
    note: "Starboard wheel compass",
    readings: [[0, -4], [22.5, -2], [45, 0], [67.5, 2], [90, 4], [112.5, 5], [135, 6], [157.5, 5], [180, 4], [202.5, 2], [225, 0], [247.5, -2], [270, -4], [292.5, -5], [315, -6], [337.5, -5]],
  },
  rya_training_almanac_every_45: {
    readings: [[0, -4], [45, 0], [90, 4], [135, 6], [180, 4], [225, 0], [270, -4], [315, -6]],
  },
  rya_training_almanac_every_90: {
    readings: [[0, -4], [90, 4], [180, 4], [270, -4]],
  },
  astrid_1974: {
    vessel: "Astrid",
    note: "Steering compass, 1974",
    readings: [[0, 2], [15, 2], [30, 1], [45, 0], [60, 0], [75, 0], [90, 0], [105, -1], [120, -2], [135, -3], [150, -3], [165, -2], [180, -1], [195, 0], [210, 2], [225, 3], [240, 3], [255, 2], [270, 2], [285, 2], [300, 2], [315, 4], [330, 4], [345, 3]],
  },
  opencpn_sample: {
    source: "http://opencpn.org/ocpn/node/178",
    readings: [[0, 1], [30, 3], [60, 4], [90, 4], [120, 3], [150, 2], [180, -1], [210, -3], [240, -5], [270, -6], [300, -4], [330, -2]],
  },
  global_security: {
    source: "http://www.globalsecurity.org/military/library/policy/army/fm/55-501/fig6-6-2.gif",
    readings: [[0, -4], [15, -4], [30, -3.5], [45, -3.2], [60, -3], [75, -2.5], [90, -2], [105, -1.8], [120, -1.2], [135, -0.8], [150, -0.5], [165, 1.5], [180, 2], [195, 2.5], [210, 3], [225, 3.5], [240, 4], [255, 3.5], [270, 3], [285, 2], [300, 1.5], [315, 1], [330, 0.5], [345, -1]],
  },
  fokker_team: {
    source: "http://www.collectors-edition.de/FokkerTeam/Steuertabelle.JPG",
    readings: [[0, 3], [30, 1], [60, -1], [90, 0], [120, 3], [150, 5], [180, 6], [210, 5], [240, 4], [270, 2], [300, 3], [330, 3]],
  },
  code7700_direction: {
    source: "http://code7700.com/direction.html",
    readings: [[0, 1], [15, 1], [30, 1], [45, 1], [60, 2], [75, 2], [90, 2], [105, 2], [120, 2], [135, 0], [150, -1], [165, -1], [180, -1], [195, -1], [210, -1], [225, -1], [240, -2], [255, -2], [270, -2], [285, -2], [300, -2], [315, -1], [330, 0], [345, 1]],
  },
  instrument_flying_handbook: {
    source: "http://www.americanflyers.net/aviationlibrary/instrument_flying_handbook/chapter_3.htm",
    readings: [[0, 1], [30, 2], [60, 2], [90, 5], [120, 3], [150, 5], [180, -4], [210, 0], [240, 3], [270, 1], [300, -4], [330, -5]],
  },
  anonymous_1: {
    readings: [[0, -2], [45, -4], [90, -3], [135, -1], [180, 2], [225, 4], [270, 3], [315, 0]],
  },
  anonymous_2: {
    readings: [[0, -2], [45, -2], [90, -1], [135, 0], [180, 1], [225, 1], [270, 0.5], [315, -1]],
  },
  sv_selah: {
    source: "http://threesheetsnw.com/svselah/2011/06/23/that-took-an-adjustment/",
    readings: [[0, 1], [45, 1], [90, 0], [135, 0], [180, -1], [225, -1], [270, 0], [315, 0]],
  },
  seadog: {
    source: "https://www.flickr.com/photos/seadog-images/3591881376/",
    readings: [[0, 1], [45, 1.5], [90, 1], [135, 1], [180, 1], [225, 1.5], [270, 0], [315, 1]],
  },
  otter: {
    source: "Pembrokeshire Cruising Training Boat",
    readings: [[0, -4], [45, -7], [90, -5], [135, -4], [180, -1], [225, 2], [270, 4], [315, 1]],
  },
  afm_51_37: {
    source: "http://code7700.com/images/compass_correction_card_afm_51-37_figure_1-15.png",
    readings: [[0, 1], [15, 1], [30, 1], [45, 1], [60, 2], [75, 2], [90, 2], [105, 2], [120, 2], [135, 0], [150, -1], [165, -1], [180, -1], [195, -1], [210, -1], [225, -1], [240, -2], [255, -2], [270, -2], [285, -2], [300, -2], [315, -1], [330, 0], [345, 1]],
  },
  flat_line: {
    readings: [[0, 0], [90, 0], [180, 0], [270, 0]],
  },
  four_points: {
    readings: [[0, 0], [90, 2], [180, 0], [270, -2]],
  },
  too_few_points: {
    readings: [[0, 0], [90, 1]],
  },
  long_name: {
    source: "Pembrokeshire Cruising Training Boat",
    vessel: "A Really Long Vessel Name (which is a bit of a silly thing to have, realllllly)",
    note: "Lorem ipsum dolor sit amet, consectetur adipisicing elit, sed do eiusmod tempor",
    readings: [[0, -4], [45, -7], [90, -5], [135, -4], [180, -1], [225, 2], [270, 4], [315, 1]],
  },
  navy_admin_textbook: {
    source: "http://navyadministration.tpub.com/14067/css/14067_139.htm",
    vessel: "Navy Admin Textbook Sample",
    note: "http://navyadministration.tpub.com/14067/css/14067_139.htm",
    readings: [[0, -14], [15, -10], [30, -5], [45, 1], [60, 2], [75, 5], [90, 7], [105, 9], [120, 15], [135, 16], [150, 12], [165, 13], [180, 14], [195, 14], [210, 12], [225, 9], [240, 4], [255, -1], [270, -7], [285, -12], [300, -15], [315, -19], [330, -19], [345, -17]],
  },
};
