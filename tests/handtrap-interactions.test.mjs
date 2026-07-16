import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const catalogDirectory = path.resolve("public/data/ygo-ko-cards");
const interactionFile = "handtrap-interactions.json";

test("every catalog card and effect has registered hand-trap interactions", async () => {
  const manifest = JSON.parse(
    await readFile(path.join(catalogDirectory, "manifest.json"), "utf8"),
  );
  const payload = JSON.parse(
    await readFile(path.join(catalogDirectory, interactionFile), "utf8"),
  );
  const parts = await Promise.all(
    manifest.parts.map(async (part) =>
      JSON.parse(await readFile(path.join(catalogDirectory, part), "utf8")),
    ),
  );
  const cards = parts.flat();

  assert.equal(payload.schemaVersion, 1);
  assert.equal(payload.cardCount, manifest.cardCount);
  assert.equal(Object.keys(payload.cards).length, manifest.cardCount);
  assert.equal(payload.handTraps.length, 30);

  let effectCount = 0;
  for (const card of cards) {
    const cardId = `${card.i}:${card.p ?? "null"}`;
    const record = payload.cards[cardId];
    assert.ok(record, `missing interaction record for ${cardId}`);
    assert.ok(Array.isArray(record.interruptibleBy));
    assert.ok(Array.isArray(record.blocksHandTraps));
    effectCount += Object.keys(record.effects).length;
  }

  assert.equal(effectCount, payload.effectCount);
  assert.equal(payload.effectCount, 21_460);
});

test("GitHub Pages build contains the hand-trap interaction sidecar", async () => {
  await access(path.resolve("dist/data/ygo-ko-cards", interactionFile));
});
