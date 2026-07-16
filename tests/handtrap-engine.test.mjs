import assert from "node:assert/strict";
import test from "node:test";

import {
  countWorstCaseTriggerOperations,
  evaluateHandTrapRoute,
} from "../src/handtrap-engine.js";

const step = (id, patch = {}) => ({
  id,
  index: Number(id.replace(/\D/g, "")) || 0,
  actionType: "EFFECT",
  turnOwner: "SELF",
  phase: "MAIN1",
  summonType: "NORMAL",
  summonFrom: "HAND",
  operationTags: [],
  costDestinations: [],
  resultDestinations: [],
  materialDestinations: [],
  ...patch,
});

const evaluate = (patch) =>
  evaluateHandTrapRoute({
    trapId: "custom",
    disruptionTypes: [],
    drawAmount: 1,
    steps: [],
    opponentStartingHandSize: 5,
    finalPlayerFieldCards: 0,
    ...patch,
  });

test("Droll triggers after the first non-draw-phase deck addition and blocks only later additions", () => {
  const metrics = evaluate({
    trapId: "builtin-droll-lock-bird",
    disruptionTypes: ["PREVENT_ADD_FROM_DECK"],
    steps: [
      step("s1", { phase: "DRAW", operationTags: ["DRAW"] }),
      step("s2", { operationTags: ["SEARCH"] }),
      step("s3", { operationTags: ["DRAW"] }),
    ],
  });

  assert.equal(metrics.triggerCount, 1);
  assert.deepEqual(metrics.triggerStepIds, ["s2"]);
  assert.deepEqual(metrics.affectedStepIds, ["s3"]);
  assert.deepEqual(metrics.blockedStepIds, ["s3"]);
});

test("Maxx C and each Mulcharmy count only their own summon sources", () => {
  const steps = [
    step("s1", {
      actionType: "SUMMON",
      summonType: "LINK",
      summonFrom: "EXTRA_DECK",
    }),
    step("s2", {
      actionType: "SUMMON",
      summonType: "NORMAL",
      summonFrom: "HAND",
    }),
    step("s3", {
      actionType: "SUMMON",
      summonType: "RULE_SPECIAL",
      summonFrom: "GRAVEYARD",
    }),
  ];
  const draws = (trapId) =>
    evaluate({
      trapId,
      disruptionTypes: ["DRAW_ON_SUMMON"],
      steps,
    }).opponentDraws;

  assert.equal(draws("builtin-maxx-c"), 2);
  assert.equal(draws("builtin-mulcharmy-fuwalos"), 1);
  assert.equal(draws("builtin-mulcharmy-purulia"), 1);
  assert.equal(draws("builtin-mulcharmy-meowls"), 1);
});

test("Mulcharmy estimates the end-phase random return separately from gross draws", () => {
  const metrics = evaluate({
    trapId: "builtin-mulcharmy-fuwalos",
    disruptionTypes: ["DRAW_ON_SUMMON"],
    steps: [1, 2, 3, 4].map((index) =>
      step(`s${index}`, {
        actionType: "SUMMON",
        summonType: "LINK",
        summonFrom: "EXTRA_DECK",
      }),
    ),
  });

  assert.equal(metrics.opponentDraws, 4);
  assert.equal(metrics.endPhaseReturns, 2);
});

test("Lancea blocks banish costs, affects banish effects, and only applies on the combo player's turn", () => {
  const metrics = evaluate({
    trapId: "builtin-artifact-lancea",
    disruptionTypes: ["PREVENT_BANISH"],
    steps: [
      step("s1", { costDestinations: ["BANISHED"] }),
      step("s2", { operationTags: ["BANISH"] }),
      step("s3", {
        turnOwner: "OPPONENT",
        costDestinations: ["BANISHED"],
      }),
    ],
  });

  assert.deepEqual(metrics.affectedStepIds, ["s1", "s2"]);
  assert.deepEqual(metrics.blockedStepIds, ["s1"]);
  assert.equal(metrics.applicationCount, 2);
});

test("Dimension Shifter blocks send-to-GY costs and redirects later graveyard movement", () => {
  const metrics = evaluate({
    trapId: "builtin-dimension-shifter",
    disruptionTypes: ["REPLACE_SEND_GY_WITH_BANISH"],
    steps: [
      step("s1", { costDestinations: ["GRAVEYARD"] }),
      step("s2", { resultDestinations: ["GRAVEYARD"] }),
      step("s3", { materialDestinations: ["GRAVEYARD"] }),
    ],
  });

  assert.deepEqual(metrics.affectedStepIds, ["s1", "s2", "s3"]);
  assert.deepEqual(metrics.blockedStepIds, ["s1"]);
  assert.deepEqual(metrics.redirectedStepIds, ["s2", "s3"]);
});

test("a composite hand trap keeps every one-shot operation separate", () => {
  const count = countWorstCaseTriggerOperations([
    { application: "ON_TRIGGER", conditionText: "2+" },
    { application: "ON_TRIGGER", conditionText: "4+" },
    { application: "ON_TRIGGER", conditionText: "6" },
    { application: "EACH_MATCH" },
  ]);

  assert.equal(count, 3);
});
