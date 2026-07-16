import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const catalogDirectory = path.resolve("public/data/ygo-ko-cards");

test("catalog manifest loads every card exactly once", async () => {
  const manifest = JSON.parse(
    await readFile(path.join(catalogDirectory, "manifest.json"), "utf8"),
  );

  assert.ok(Array.isArray(manifest.parts));
  assert.ok(manifest.parts.length > 1);

  const parts = await Promise.all(
    manifest.parts.map(async (part) =>
      JSON.parse(await readFile(path.join(catalogDirectory, part), "utf8")),
    ),
  );
  const cards = parts.flat();
  const records = new Set(cards.map((card) => `${card.i}:${card.p ?? ""}`));

  assert.equal(cards.length, manifest.cardCount);
  assert.equal(records.size, manifest.cardCount);
  assert.equal(manifest.cardCount, 13_982);
});
