// Blank swing record downloads on the "Swinging a compass" guide.

import { PAGE_HEIGHT, PAGE_WIDTH } from "./draw/common.js";
import { drawRecord, headingsEvery } from "./draw/record.js";
import { PdfSurface } from "./draw/surface.js";

function download(step) {
  const pdf = new PdfSurface(PAGE_WIDTH, PAGE_HEIGHT, { title: "Blank compass swing record", author: "OmniRose" });
  drawRecord(pdf, { headings: headingsEvery(step) });
  const href = URL.createObjectURL(new Blob([pdf.toBytes()], { type: "application/pdf" }));
  const a = Object.assign(document.createElement("a"), { href, download: `omnirose-swing-record-every-${String(step).replace(".", "-")}.pdf` });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(href), 60_000);
}

document.querySelectorAll("#blank-sheets [data-step]").forEach((button) =>
  button.addEventListener("click", () => download(Number(button.dataset.step))),
);
