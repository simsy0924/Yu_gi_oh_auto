// @ts-check

/**
 * @typedef {"EFFECT" | "SUMMON" | "CHAIN_RESOLVE"} RouteActionType
 * @typedef {"SELF" | "OPPONENT"} RouteTurnOwner
 * @typedef {"DRAW" | "STANDBY" | "MAIN1" | "BATTLE" | "MAIN2" | "END"} RoutePhase
 * @typedef {"NORMAL" | "RULE_SPECIAL" | "RITUAL" | "FUSION" | "SYNCHRO" | "XYZ" | "PENDULUM" | "LINK" | "TOKEN" | "OTHER"} RouteSummonType
 * @typedef {"HAND" | "MONSTER_ZONE" | "SPELL_TRAP_ZONE" | "FIELD_ZONE" | "PENDULUM_ZONE" | "GRAVEYARD" | "BANISHED" | "XYZ_MATERIAL" | "DECK" | "EXTRA_DECK"} RouteLocation
 *
 * @typedef {object} HandTrapRouteStep
 * @property {string} id
 * @property {number} index
 * @property {RouteActionType} actionType
 * @property {RouteTurnOwner} turnOwner
 * @property {RoutePhase} phase
 * @property {RouteSummonType} summonType
 * @property {RouteLocation} summonFrom
 * @property {string[]} operationTags
 * @property {RouteLocation[]} costDestinations
 * @property {RouteLocation[]} resultDestinations
 * @property {RouteLocation[]} materialDestinations
 *
 * @typedef {object} HandTrapRouteInput
 * @property {string} trapId
 * @property {string[]} disruptionTypes
 * @property {number} drawAmount
 * @property {HandTrapRouteStep[]} steps
 * @property {number} opponentStartingHandSize
 * @property {number} finalPlayerFieldCards
 *
 * @typedef {object} HandTrapRouteMetrics
 * @property {number} triggerCount
 * @property {string[]} triggerStepIds
 * @property {string[]} affectedStepIds
 * @property {string[]} blockedStepIds
 * @property {string[]} redirectedStepIds
 * @property {number} opponentDraws
 * @property {number} endPhaseReturns
 * @property {number} applicationCount
 * @property {number | null} firstStepIndex
 */

const MAXX_C_ID = "builtin-maxx-c";
const DROLL_ID = "builtin-droll-lock-bird";
const SHIFTER_ID = "builtin-dimension-shifter";
const LANCEA_ID = "builtin-artifact-lancea";
const FUWALOS_ID = "builtin-mulcharmy-fuwalos";
const PURULIA_ID = "builtin-mulcharmy-purulia";
const MEOWLS_ID = "builtin-mulcharmy-meowls";

/** @param {Iterable<string>} values */
function unique(values) {
  return [...new Set(values)];
}

/** @returns {HandTrapRouteMetrics} */
function emptyMetrics() {
  return {
    triggerCount: 0,
    triggerStepIds: [],
    affectedStepIds: [],
    blockedStepIds: [],
    redirectedStepIds: [],
    opponentDraws: 0,
    endPhaseReturns: 0,
    applicationCount: 0,
    firstStepIndex: null,
  };
}

/** @param {HandTrapRouteStep} step */
function isSpecialSummon(step) {
  return step.actionType === "SUMMON" && step.summonType !== "NORMAL";
}

/** @param {string} trapId @param {HandTrapRouteStep} step */
function drawTrapApplies(trapId, step) {
  if (step.actionType !== "SUMMON") return false;
  const special = isSpecialSummon(step);
  if (trapId === MAXX_C_ID) return special;
  if (trapId === FUWALOS_ID)
    return special &&
      (step.summonFrom === "DECK" || step.summonFrom === "EXTRA_DECK");
  if (trapId === PURULIA_ID) return step.summonFrom === "HAND";
  if (trapId === MEOWLS_ID)
    return special &&
      (step.summonFrom === "GRAVEYARD" || step.summonFrom === "BANISHED");
  return special;
}

/** @param {HandTrapRouteStep} step */
function addsFromDeckOutsideDrawPhase(step) {
  return (
    step.actionType === "EFFECT" &&
    step.phase !== "DRAW" &&
    (step.operationTags.includes("SEARCH") || step.operationTags.includes("DRAW"))
  );
}

/** @param {HandTrapRouteStep} step @param {RouteLocation} destination */
function hasCostDestination(step, destination) {
  return step.costDestinations.includes(destination);
}

/** @param {HandTrapRouteStep} step @param {RouteLocation} destination */
function hasNonCostDestination(step, destination) {
  return (
    step.resultDestinations.includes(destination) ||
    step.materialDestinations.includes(destination)
  );
}

/** @param {HandTrapRouteStep} step */
function sendsToGrave(step) {
  return (
    hasCostDestination(step, "GRAVEYARD") ||
    hasNonCostDestination(step, "GRAVEYARD") ||
    step.operationTags.includes("SEND_GY") ||
    step.operationTags.includes("SEND_DECK_TO_GY")
  );
}

/** @param {HandTrapRouteStep} step */
function banishes(step) {
  return (
    hasCostDestination(step, "BANISHED") ||
    hasNonCostDestination(step, "BANISHED") ||
    step.operationTags.includes("BANISH")
  );
}

/**
 * Counts the worst-case number of distinct operations resolved by one trigger.
 * Repeating operations such as Maxx "C" draws are counted by route evaluation
 * instead, once for every matching action.
 * @param {{ application?: "ON_TRIGGER" | "AFTER_TRIGGER" | "EACH_MATCH" }[]} operations
 */
export function countWorstCaseTriggerOperations(operations) {
  return operations.filter((operation) => operation.application !== "EACH_MATCH")
    .length;
}

/**
 * Evaluates automatic route-wide hand-trap behavior. One activation is counted as
 * one trigger even when its lingering effect applies repeatedly afterwards.
 * @param {HandTrapRouteInput} input
 * @returns {HandTrapRouteMetrics}
 */
export function evaluateHandTrapRoute(input) {
  const metrics = emptyMetrics();
  const markTrigger = (/** @type {HandTrapRouteStep} */ step) => {
    if (metrics.triggerCount > 0) return;
    metrics.triggerCount = 1;
    metrics.triggerStepIds = [step.id];
    metrics.firstStepIndex = step.index;
  };

  if (input.disruptionTypes.includes("DRAW_ON_SUMMON")) {
    const matches = input.steps.filter((step) => drawTrapApplies(input.trapId, step));
    if (!matches.length) return metrics;
    markTrigger(matches[0]);
    metrics.affectedStepIds = unique(matches.map((step) => step.id));
    metrics.opponentDraws = matches.length * Math.max(1, input.drawAmount);
    metrics.applicationCount = matches.length;
    if ([FUWALOS_ID, PURULIA_ID, MEOWLS_ID].includes(input.trapId)) {
      const handAfterDiscardAndDraw =
        Math.max(0, input.opponentStartingHandSize - 1) + metrics.opponentDraws;
      const endPhaseHandLimit = Math.max(0, input.finalPlayerFieldCards) + 6;
      metrics.endPhaseReturns = Math.max(
        0,
        handAfterDiscardAndDraw - endPhaseHandLimit,
      );
    }
    return metrics;
  }

  if (
    input.trapId === DROLL_ID ||
    input.disruptionTypes.includes("PREVENT_ADD_FROM_DECK")
  ) {
    const additions = input.steps.filter(addsFromDeckOutsideDrawPhase);
    if (!additions.length) return metrics;
    markTrigger(additions[0]);
    const prevented = additions.slice(1);
    metrics.affectedStepIds = unique(prevented.map((step) => step.id));
    metrics.blockedStepIds = [...metrics.affectedStepIds];
    metrics.applicationCount = prevented.length;
    return metrics;
  }

  if (
    input.trapId === SHIFTER_ID ||
    input.disruptionTypes.includes("REPLACE_SEND_GY_WITH_BANISH")
  ) {
    const matches = input.steps.filter(sendsToGrave);
    if (!matches.length) return metrics;
    markTrigger(matches[0]);
    metrics.affectedStepIds = unique(matches.map((step) => step.id));
    metrics.blockedStepIds = unique(
      matches
        .filter((step) => hasCostDestination(step, "GRAVEYARD"))
        .map((step) => step.id),
    );
    metrics.redirectedStepIds = unique(
      matches
        .filter(
          (step) =>
            hasNonCostDestination(step, "GRAVEYARD") ||
            step.operationTags.includes("SEND_GY") ||
            step.operationTags.includes("SEND_DECK_TO_GY"),
        )
        .map((step) => step.id),
    );
    metrics.applicationCount = metrics.affectedStepIds.length;
    return metrics;
  }

  if (
    input.trapId === LANCEA_ID ||
    input.disruptionTypes.includes("PREVENT_BANISH")
  ) {
    const matches = input.steps.filter(
      (step) => step.turnOwner === "SELF" && banishes(step),
    );
    if (!matches.length) return metrics;
    markTrigger(matches[0]);
    metrics.affectedStepIds = unique(matches.map((step) => step.id));
    metrics.blockedStepIds = unique(
      matches
        .filter((step) => hasCostDestination(step, "BANISHED"))
        .map((step) => step.id),
    );
    metrics.applicationCount = metrics.affectedStepIds.length;
    return metrics;
  }

  if (input.disruptionTypes.includes("PREVENT_SPECIAL_SUMMON")) {
    const matches = input.steps.filter(isSpecialSummon);
    if (!matches.length) return metrics;
    markTrigger(matches[0]);
    metrics.affectedStepIds = unique(matches.map((step) => step.id));
    metrics.blockedStepIds = [...metrics.affectedStepIds];
    metrics.applicationCount = matches.length;
  }

  return metrics;
}
