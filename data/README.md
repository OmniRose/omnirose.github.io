# Magnetic model

`WMM.COF` here is the coefficient file for NOAA's [World Magnetic Model](https://www.ncei.noaa.gov/products/world-magnetic-model), used by the "Where are you sailing?" helper on the tool page to work out which variation pages to print. The helper stays hidden if the file is missing.

Each model is valid for five years, so this file needs replacing every five years (WMM2025 runs to the end of 2029):

1. Download the new coefficients from the NOAA page above (the `WMM.COF` file inside the "WMM20xx COF" download).
2. Replace `data/WMM.COF` with it.
3. Run `node --test`. The "site's magnetic model loads" test checks it parses and gives sensible answers.

The model is produced by NOAA and the British Geological Survey and is in the public domain.
