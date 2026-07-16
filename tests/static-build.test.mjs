import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

test("GitHub Pages build contains the app shell and catalog", async () => {
  const html = await readFile("dist/index.html", "utf8");

  assert.match(html, /<div id="root"><\/div>/);
  assert.match(html, /\/Yu_gi_oh_auto\/assets\//);
  assert.match(html, /\/Yu_gi_oh_auto\/favicon\.svg/);

  await access("dist/data/ygo-ko-cards/manifest.json");
  await access("dist/data/ygo-ko-cards/part-024.json");
});
