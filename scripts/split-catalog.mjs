import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const inputPath = path.resolve(
  process.argv[2] ?? "public/data/ygo-ko-cards.json",
);
const outputDirectory = path.resolve(
  process.argv[3] ?? "public/data/ygo-ko-cards",
);
const cardsPerPart = Number(process.argv[4] ?? 600);

if (!Number.isInteger(cardsPerPart) || cardsPerPart < 1) {
  throw new Error("cardsPerPart must be a positive integer.");
}

const payload = JSON.parse(await readFile(inputPath, "utf8"));
if (!Array.isArray(payload.cards) || payload.cards.length === 0) {
  throw new Error("Input catalog does not contain cards.");
}

await rm(outputDirectory, { recursive: true, force: true });
await mkdir(outputDirectory, { recursive: true });

const parts = [];
for (let start = 0; start < payload.cards.length; start += cardsPerPart) {
  const partName = `part-${String(parts.length + 1).padStart(3, "0")}.json`;
  const cards = payload.cards.slice(start, start + cardsPerPart);
  await writeFile(
    path.join(outputDirectory, partName),
    `${JSON.stringify(cards)}\n`,
  );
  parts.push(partName);
}

await writeFile(
  path.join(outputDirectory, "manifest.json"),
  `${JSON.stringify({
    updatedAt: payload.updatedAt,
    source: payload.source,
    cardCount: payload.cards.length,
    parts,
  })}\n`,
);

console.log(`Wrote ${payload.cards.length} cards across ${parts.length} parts.`);
