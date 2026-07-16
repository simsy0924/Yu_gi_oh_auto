#!/usr/bin/env python3
"""Safe, sidecar-only batch pipeline for catalog card effect tagging."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import sys
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


SCHEMA_VERSION = 1
NO_MORE_CARDS_EXIT = 20
VALIDATION_ERROR_EXIT = 2
PIPELINE_ERROR_EXIT = 1
LOW_CONFIDENCE_THRESHOLD = 0.75

ACTIVATION_TAGS = (
    "IGNITION",
    "QUICK",
    "TRIGGER",
    "ON_NORMAL_SUMMON",
    "ON_SPECIAL_SUMMON",
    "ON_FLIP",
    "ON_ATTACK",
    "ON_DAMAGE",
    "ON_SENT_GY",
    "ON_BANISHED",
    "ON_DETACH_XYZ",
    "ON_CARD_EFFECT",
    "ON_MONSTER_EFFECT",
    "ON_SUMMON_ATTEMPT",
    "CUSTOM",
)
APPLICATION_TAGS = (
    "WHILE_FACE_UP",
    "WHILE_IN_GY",
    "WHILE_BANISHED",
    "WHILE_XYZ_MATERIAL",
    "TARGET_REQUIRED",
    "NON_TARGETING",
    "SELF",
    "OPPONENT",
    "MONSTER",
    "SPELL_TRAP",
    "EXTRA_DECK_MONSTER",
    "CUSTOM",
)
OPERATION_TAGS = (
    "SEARCH",
    "DRAW",
    "SEND_DECK_TO_GY",
    "SPECIAL_SUMMON",
    "NORMAL_SUMMON",
    "DESTROY",
    "BANISH",
    "SEND_GY",
    "RETURN_HAND",
    "RETURN_DECK",
    "NEGATE_EFFECT",
    "NEGATE_ACTIVATION",
    "CHANGE_ATK_DEF",
    "CHANGE_LEVEL_RANK",
    "CHANGE_TYPE_ATTRIBUTE",
    "ATTACH_XYZ",
    "DETACH_XYZ",
    "GRANT_EFFECT",
    "TAKE_CONTROL",
    "SUMMON_LOCK",
    "EFFECT_LOCK",
    "CUSTOM",
)
ALLOWED_TAGS = {
    "activation_tags": set(ACTIVATION_TAGS),
    "application_tags": set(APPLICATION_TAGS),
    "operation_tags": set(OPERATION_TAGS),
}

NUMBERED_EFFECT_MARKER = re.compile(
    r"([①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳])\s*[:：]"
)


class PipelineError(RuntimeError):
    """Safe pipeline failure."""


class ValidationError(PipelineError):
    """Classification result validation failure."""


def _project_root() -> Path:
    override = os.environ.get("CARD_TAG_PIPELINE_ROOT")
    if override:
        return Path(override).resolve()
    return Path(__file__).resolve().parents[1]


def _paths(root: Path) -> dict[str, Path]:
    tagging = root / ".codex-tagging"
    return {
        "root": root,
        "catalog": root / "public" / "data" / "ygo-ko-cards",
        "tagging": tagging,
        "batch": tagging / "current_batch.json",
        "result": tagging / "current_result.json",
        "state": tagging / "state.json",
        "tagged": tagging / "tagged_cards.json",
        "review": tagging / "review.jsonl",
        "logs": tagging / "logs",
        "tmp": tagging / "tmp",
    }


def _ensure_runtime_dirs(paths: dict[str, Path]) -> None:
    paths["tagging"].mkdir(parents=True, exist_ok=True)
    paths["logs"].mkdir(parents=True, exist_ok=True)
    paths["tmp"].mkdir(parents=True, exist_ok=True)


def _read_json(path: Path, description: str) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError as exc:
        raise PipelineError(f"{description} not found: {path}") from exc
    except json.JSONDecodeError as exc:
        raise PipelineError(
            f"{description} is not valid JSON at line {exc.lineno}, "
            f"column {exc.colno}: {path}"
        ) from exc


def _atomic_write_bytes(path: Path, data: bytes, tmp_dir: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp_dir.mkdir(parents=True, exist_ok=True)
    fd, temporary_name = tempfile.mkstemp(
        prefix=f".{path.name}.", suffix=".tmp", dir=tmp_dir
    )
    temporary_path = Path(temporary_name)
    try:
        with os.fdopen(fd, "wb") as handle:
            handle.write(data)
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temporary_path, path)
    finally:
        if temporary_path.exists():
            temporary_path.unlink()


def _atomic_write_json(path: Path, payload: Any, tmp_dir: Path) -> None:
    serialized = (
        json.dumps(payload, ensure_ascii=False, indent=2, sort_keys=False) + "\n"
    )
    _atomic_write_bytes(path, serialized.encode("utf-8"), tmp_dir)


def _atomic_write_jsonl(path: Path, records: list[dict[str, Any]], tmp_dir: Path) -> None:
    serialized = "".join(
        json.dumps(record, ensure_ascii=False, separators=(",", ":")) + "\n"
        for record in records
    )
    _atomic_write_bytes(path, serialized.encode("utf-8"), tmp_dir)


def _catalog_card_id(card: dict[str, Any]) -> str:
    catalog_id = card.get("i")
    passcode = card.get("p")
    if not isinstance(catalog_id, int) or isinstance(catalog_id, bool):
        raise PipelineError("catalog card field 'i' must be an integer")
    if passcode is not None and (
        not isinstance(passcode, int) or isinstance(passcode, bool)
    ):
        raise PipelineError(
            f"catalog card {catalog_id} field 'p' must be an integer or null"
        )
    return f"{catalog_id}:{passcode if passcode is not None else 'null'}"


def _load_catalog(paths: dict[str, Path]) -> tuple[dict[str, Any], list[dict[str, Any]], str]:
    manifest_path = paths["catalog"] / "manifest.json"
    try:
        manifest_bytes = manifest_path.read_bytes()
    except FileNotFoundError as exc:
        raise PipelineError(f"catalog manifest not found: {manifest_path}") from exc
    try:
        manifest = json.loads(manifest_bytes.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise PipelineError(f"catalog manifest is invalid: {manifest_path}") from exc

    parts = manifest.get("parts")
    card_count = manifest.get("cardCount")
    if not isinstance(parts, list) or not parts or not all(
        isinstance(part, str) and part for part in parts
    ):
        raise PipelineError("catalog manifest 'parts' must be a non-empty string array")
    if not isinstance(card_count, int) or isinstance(card_count, bool):
        raise PipelineError("catalog manifest 'cardCount' must be an integer")

    digest = hashlib.sha256()
    digest.update(manifest_bytes)
    cards: list[dict[str, Any]] = []
    for part in parts:
        part_path = paths["catalog"] / part
        try:
            part_bytes = part_path.read_bytes()
        except FileNotFoundError as exc:
            raise PipelineError(f"catalog part not found: {part_path}") from exc
        digest.update(part.encode("utf-8"))
        digest.update(b"\0")
        digest.update(part_bytes)
        try:
            payload = json.loads(part_bytes.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError) as exc:
            raise PipelineError(f"catalog part is invalid: {part_path}") from exc
        if not isinstance(payload, list):
            raise PipelineError(f"catalog part must contain an array: {part_path}")
        for card in payload:
            if not isinstance(card, dict):
                raise PipelineError(f"catalog part contains a non-object: {part_path}")
            cards.append(card)

    if len(cards) != card_count:
        raise PipelineError(
            f"catalog count mismatch: manifest={card_count}, loaded={len(cards)}"
        )
    card_ids = [_catalog_card_id(card) for card in cards]
    if len(card_ids) != len(set(card_ids)):
        raise PipelineError("catalog composite card IDs are not unique")
    return manifest, cards, digest.hexdigest()


def _split_effect_text(text: str) -> tuple[str, list[dict[str, str]]]:
    matches = list(NUMBERED_EFFECT_MARKER.finditer(text))
    if not matches:
        stripped = text.strip()
        return "", ([{"marker": "", "text": stripped}] if stripped else [])
    common_text = text[: matches[0].start()].strip()
    effects: list[dict[str, str]] = []
    for index, match in enumerate(matches):
        start = match.end()
        end = matches[index + 1].start() if index + 1 < len(matches) else len(text)
        effects.append({"marker": match.group(1), "text": text[start:end].strip()})
    return common_text, effects


def _card_effect_units(card: dict[str, Any], card_id: str) -> list[dict[str, Any]]:
    effects: list[dict[str, Any]] = []
    scopes: list[tuple[str, str]] = []
    pendulum_text = card.get("e")
    main_text = card.get("t")
    if isinstance(pendulum_text, str) and pendulum_text.strip():
        scopes.append(("pendulum", pendulum_text))

    category = card.get("c")
    monster_type = card.get("y")
    has_main_effect = category in {"Spell", "Trap"} or (
        category == "Monster"
        and isinstance(monster_type, str)
        and "Effect" in monster_type
    )
    if has_main_effect and isinstance(main_text, str) and main_text.strip():
        scopes.append(("main", main_text))

    for scope, text in scopes:
        common_text, split_effects = _split_effect_text(text)
        for index, effect in enumerate(split_effects, start=1):
            effects.append(
                {
                    "effect_id": f"{card_id}/{scope}/{index}",
                    "scope": scope,
                    "index": index,
                    "marker": effect["marker"],
                    "common_text": common_text,
                    "text": effect["text"],
                }
            )
    return effects


def _batch_card(card: dict[str, Any]) -> dict[str, Any]:
    card_id = _catalog_card_id(card)
    return {
        "card_id": card_id,
        "catalog_id": card["i"],
        "passcode": card.get("p"),
        "name": card.get("n") if isinstance(card.get("n"), str) else "",
        "card_type": card.get("c") if isinstance(card.get("c"), str) else "",
        "subtype": card.get("r") if isinstance(card.get("r"), str) else None,
        "monster_type": card.get("y") if isinstance(card.get("y"), str) else None,
        "unreleased_translation": card.get("u") is True,
        "effects": _card_effect_units(card, card_id),
    }


def _empty_tagged(fingerprint: str) -> dict[str, Any]:
    return {
        "schema_version": SCHEMA_VERSION,
        "catalog_fingerprint": fingerprint,
        "cards": {},
    }


def _empty_state(fingerprint: str, total_cards: int) -> dict[str, Any]:
    return {
        "schema_version": SCHEMA_VERSION,
        "catalog_fingerprint": fingerprint,
        "progress": {
            "total_cards": total_cards,
            "completed": 0,
            "remaining": total_cards,
        },
        "completed_card_ids": [],
        "completed_batches": {},
        "last_merged_batch_id": None,
    }


def _load_tagged(paths: dict[str, Path], fingerprint: str) -> dict[str, Any]:
    if not paths["tagged"].exists():
        return _empty_tagged(fingerprint)
    tagged = _read_json(paths["tagged"], "tagged card sidecar")
    if not isinstance(tagged, dict):
        raise PipelineError("tagged card sidecar must be an object")
    if tagged.get("schema_version") != SCHEMA_VERSION:
        raise PipelineError("unsupported tagged card sidecar schema version")
    if tagged.get("catalog_fingerprint") != fingerprint:
        raise PipelineError(
            "catalog changed after tagging began; review and migrate state before continuing"
        )
    if not isinstance(tagged.get("cards"), dict):
        raise PipelineError("tagged card sidecar 'cards' must be an object")
    return tagged


def _load_state(
    paths: dict[str, Path], fingerprint: str, total_cards: int
) -> dict[str, Any]:
    if not paths["state"].exists():
        return _empty_state(fingerprint, total_cards)
    state = _read_json(paths["state"], "pipeline state")
    if not isinstance(state, dict):
        raise PipelineError("pipeline state must be an object")
    if state.get("schema_version") != SCHEMA_VERSION:
        raise PipelineError("unsupported pipeline state schema version")
    if state.get("catalog_fingerprint") != fingerprint:
        raise PipelineError(
            "catalog changed after tagging began; review and migrate state before continuing"
        )
    if not isinstance(state.get("completed_card_ids"), list) or not all(
        isinstance(card_id, str) for card_id in state["completed_card_ids"]
    ):
        raise PipelineError("pipeline state 'completed_card_ids' must be a string array")
    if not isinstance(state.get("completed_batches"), dict):
        raise PipelineError("pipeline state 'completed_batches' must be an object")
    return state


def _assert_state_consistent(
    state: dict[str, Any], tagged: dict[str, Any], catalog_ids: set[str]
) -> None:
    tagged_ids = set(tagged["cards"])
    state_ids = set(state["completed_card_ids"])
    unknown = tagged_ids | state_ids
    unknown.difference_update(catalog_ids)
    if unknown:
        raise PipelineError(
            f"state contains card IDs not present in the catalog: {sorted(unknown)[:5]}"
        )
    state_only = state_ids - tagged_ids
    if state_only:
        raise PipelineError(
            "state marks cards completed without sidecar results: "
            + ", ".join(sorted(state_only)[:5])
        )


def _validate_batch_shape(batch: Any) -> dict[str, Any]:
    if not isinstance(batch, dict):
        raise PipelineError("current batch must be an object")
    required = {
        "schema_version",
        "batch_id",
        "catalog_fingerprint",
        "low_confidence_threshold",
        "allowed_tags",
        "cards",
    }
    if set(batch) != required:
        raise PipelineError(
            f"current batch fields must be exactly: {', '.join(sorted(required))}"
        )
    if batch["schema_version"] != SCHEMA_VERSION:
        raise PipelineError("unsupported current batch schema version")
    if not isinstance(batch["batch_id"], str) or not batch["batch_id"]:
        raise PipelineError("current batch 'batch_id' must be a non-empty string")
    if (
        not isinstance(batch["catalog_fingerprint"], str)
        or not batch["catalog_fingerprint"]
    ):
        raise PipelineError(
            "current batch 'catalog_fingerprint' must be a non-empty string"
        )
    if batch["low_confidence_threshold"] != LOW_CONFIDENCE_THRESHOLD:
        raise PipelineError("current batch confidence threshold is unsupported")
    expected_allowed = {
        "activation_tags": list(ACTIVATION_TAGS),
        "application_tags": list(APPLICATION_TAGS),
        "operation_tags": list(OPERATION_TAGS),
    }
    if batch["allowed_tags"] != expected_allowed:
        raise PipelineError("current batch allowed tag definitions were modified")
    cards = batch["cards"]
    if not isinstance(cards, list) or not cards:
        raise PipelineError("current batch 'cards' must be a non-empty array")
    card_ids: list[str] = []
    for card in cards:
        if not isinstance(card, dict):
            raise PipelineError("current batch contains a non-object card")
        card_id = card.get("card_id")
        effects = card.get("effects")
        if not isinstance(card_id, str) or not card_id:
            raise PipelineError("batch card 'card_id' must be a non-empty string")
        if not isinstance(effects, list):
            raise PipelineError(f"batch card {card_id} 'effects' must be an array")
        effect_ids: list[str] = []
        for effect in effects:
            if not isinstance(effect, dict):
                raise PipelineError(f"batch card {card_id} has a non-object effect")
            effect_id = effect.get("effect_id")
            if not isinstance(effect_id, str) or not effect_id:
                raise PipelineError(
                    f"batch card {card_id} effect_id must be a non-empty string"
                )
            effect_ids.append(effect_id)
        if len(effect_ids) != len(set(effect_ids)):
            raise PipelineError(f"batch card {card_id} has duplicate effect IDs")
        card_ids.append(card_id)
    if len(card_ids) != len(set(card_ids)):
        raise PipelineError("current batch has duplicate card IDs")
    return batch


def _number(value: Any, field: str) -> float:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise ValidationError(f"{field} must be a number")
    converted = float(value)
    if not 0.0 <= converted <= 1.0:
        raise ValidationError(f"{field} must be between 0 and 1")
    return converted


def _string_list(value: Any, field: str, allowed: set[str]) -> list[str]:
    if not isinstance(value, list) or not all(isinstance(item, str) for item in value):
        raise ValidationError(f"{field} must be a string array")
    if len(value) != len(set(value)):
        raise ValidationError(f"{field} must not contain duplicate tags")
    invalid = sorted(set(value) - allowed)
    if invalid:
        raise ValidationError(f"{field} contains unsupported tags: {', '.join(invalid)}")
    return value


def _validate_result_payload(batch: dict[str, Any], result: Any) -> dict[str, Any]:
    if not isinstance(result, dict):
        raise ValidationError("current result must be an object")
    required = {"schema_version", "batch_id", "cards"}
    if set(result) != required:
        raise ValidationError(
            f"current result fields must be exactly: {', '.join(sorted(required))}"
        )
    if result["schema_version"] != SCHEMA_VERSION:
        raise ValidationError("unsupported current result schema version")
    if not isinstance(result["batch_id"], str):
        raise ValidationError("current result 'batch_id' must be a string")
    if result["batch_id"] != batch["batch_id"]:
        raise ValidationError(
            f"batch ID mismatch: expected {batch['batch_id']}, got {result['batch_id']}"
        )
    if not isinstance(result["cards"], list):
        raise ValidationError("current result 'cards' must be an array")

    input_cards = {card["card_id"]: card for card in batch["cards"]}
    output_ids: list[str] = []
    for index, card_result in enumerate(result["cards"]):
        location = f"cards[{index}]"
        if not isinstance(card_result, dict):
            raise ValidationError(f"{location} must be an object")
        required_card_fields = {
            "card_id",
            "effects",
            "confidence",
            "needs_review",
            "note",
        }
        if set(card_result) != required_card_fields:
            raise ValidationError(
                f"{location} fields must be exactly: "
                + ", ".join(sorted(required_card_fields))
            )
        card_id = card_result["card_id"]
        if not isinstance(card_id, str) or not card_id:
            raise ValidationError(f"{location}.card_id must be a non-empty string")
        output_ids.append(card_id)
        if not isinstance(card_result["needs_review"], bool):
            raise ValidationError(f"{location}.needs_review must be a boolean")
        if not isinstance(card_result["note"], str):
            raise ValidationError(f"{location}.note must be a string")
        card_confidence = _number(card_result["confidence"], f"{location}.confidence")
        if not isinstance(card_result["effects"], list):
            raise ValidationError(f"{location}.effects must be an array")

        input_card = input_cards.get(card_id)
        if input_card is None:
            continue
        input_effects = {
            effect["effect_id"]: effect for effect in input_card["effects"]
        }
        output_effect_ids: list[str] = []
        effect_requires_review = False
        for effect_index, effect_result in enumerate(card_result["effects"]):
            effect_location = f"{location}.effects[{effect_index}]"
            if not isinstance(effect_result, dict):
                raise ValidationError(f"{effect_location} must be an object")
            required_effect_fields = {
                "effect_id",
                "activation_tags",
                "application_tags",
                "operation_tags",
                "confidence",
                "needs_review",
                "note",
            }
            if set(effect_result) != required_effect_fields:
                raise ValidationError(
                    f"{effect_location} fields must be exactly: "
                    + ", ".join(sorted(required_effect_fields))
                )
            effect_id = effect_result["effect_id"]
            if not isinstance(effect_id, str) or not effect_id:
                raise ValidationError(
                    f"{effect_location}.effect_id must be a non-empty string"
                )
            output_effect_ids.append(effect_id)
            _string_list(
                effect_result["activation_tags"],
                f"{effect_location}.activation_tags",
                ALLOWED_TAGS["activation_tags"],
            )
            _string_list(
                effect_result["application_tags"],
                f"{effect_location}.application_tags",
                ALLOWED_TAGS["application_tags"],
            )
            _string_list(
                effect_result["operation_tags"],
                f"{effect_location}.operation_tags",
                ALLOWED_TAGS["operation_tags"],
            )
            effect_confidence = _number(
                effect_result["confidence"], f"{effect_location}.confidence"
            )
            if not isinstance(effect_result["needs_review"], bool):
                raise ValidationError(
                    f"{effect_location}.needs_review must be a boolean"
                )
            if not isinstance(effect_result["note"], str):
                raise ValidationError(f"{effect_location}.note must be a string")
            uses_custom = any(
                "CUSTOM" in effect_result[field]
                for field in (
                    "activation_tags",
                    "application_tags",
                    "operation_tags",
                )
            )
            if uses_custom and not effect_result["needs_review"]:
                raise ValidationError(
                    f"{effect_location} uses CUSTOM and requires needs_review=true"
                )
            if {"TARGET_REQUIRED", "NON_TARGETING"}.issubset(
                effect_result["application_tags"]
            ):
                raise ValidationError(
                    f"{effect_location} cannot use TARGET_REQUIRED and "
                    "NON_TARGETING together"
                )
            if (
                effect_confidence < LOW_CONFIDENCE_THRESHOLD
                and not effect_result["needs_review"]
            ):
                raise ValidationError(
                    f"{effect_location} confidence below "
                    f"{LOW_CONFIDENCE_THRESHOLD} requires needs_review=true"
                )
            effect_requires_review = effect_requires_review or bool(
                effect_result["needs_review"]
                or effect_confidence < LOW_CONFIDENCE_THRESHOLD
            )

        duplicates = sorted(
            effect_id
            for effect_id in set(output_effect_ids)
            if output_effect_ids.count(effect_id) > 1
        )
        missing = sorted(set(input_effects) - set(output_effect_ids))
        added = sorted(set(output_effect_ids) - set(input_effects))
        if duplicates:
            raise ValidationError(
                f"card {card_id} has duplicate effect IDs: {', '.join(duplicates)}"
            )
        if missing:
            raise ValidationError(
                f"card {card_id} is missing effect IDs: {', '.join(missing)}"
            )
        if added:
            raise ValidationError(
                f"card {card_id} has unexpected effect IDs: {', '.join(added)}"
            )
        if output_effect_ids != list(input_effects):
            raise ValidationError(
                f"card {card_id} effect order must match the current batch"
            )
        if (
            card_confidence < LOW_CONFIDENCE_THRESHOLD
            and not card_result["needs_review"]
        ):
            raise ValidationError(
                f"{location} confidence below {LOW_CONFIDENCE_THRESHOLD} "
                "requires needs_review=true"
            )
        if effect_requires_review and not card_result["needs_review"]:
            raise ValidationError(
                f"{location}.needs_review must be true when an effect needs review"
            )

    duplicates = sorted(
        card_id for card_id in set(output_ids) if output_ids.count(card_id) > 1
    )
    missing = sorted(set(input_cards) - set(output_ids))
    added = sorted(set(output_ids) - set(input_cards))
    if duplicates:
        raise ValidationError(
            f"duplicate output card IDs: {', '.join(duplicates)}"
        )
    if missing:
        raise ValidationError(f"missing output card IDs: {', '.join(missing)}")
    if added:
        raise ValidationError(f"unexpected output card IDs: {', '.join(added)}")
    if output_ids != list(input_cards):
        raise ValidationError("output card order must match the current batch")
    return result


def _read_and_validate(paths: dict[str, Path]) -> tuple[dict[str, Any], dict[str, Any]]:
    batch = _validate_batch_shape(_read_json(paths["batch"], "current batch"))
    try:
        result = json.loads(paths["result"].read_text(encoding="utf-8"))
    except FileNotFoundError as exc:
        raise ValidationError(f"current result not found: {paths['result']}") from exc
    except json.JSONDecodeError as exc:
        raise ValidationError(
            f"current result is not valid JSON at line {exc.lineno}, "
            f"column {exc.colno}: {paths['result']}"
        ) from exc
    return batch, _validate_result_payload(batch, result)


def _batch_id(fingerprint: str, selected: list[dict[str, Any]]) -> str:
    card_ids = [_catalog_card_id(card) for card in selected]
    digest = hashlib.sha256(
        (fingerprint + "\n" + "\n".join(card_ids)).encode("utf-8")
    ).hexdigest()[:12]
    return f"batch-{digest}"


def command_prepare(paths: dict[str, Path], batch_size: int) -> int:
    if batch_size < 1:
        raise PipelineError("--batch-size must be a positive integer")
    manifest, cards, fingerprint = _load_catalog(paths)
    tagged = _load_tagged(paths, fingerprint)
    state = _load_state(paths, fingerprint, len(cards))
    catalog_ids = {_catalog_card_id(card) for card in cards}
    _assert_state_consistent(state, tagged, catalog_ids)
    completed_ids = set(tagged["cards"])

    if paths["batch"].exists():
        current = _validate_batch_shape(_read_json(paths["batch"], "current batch"))
        if current["catalog_fingerprint"] != fingerprint:
            raise PipelineError(
                "current batch belongs to a different catalog snapshot"
            )
        current_ids = [card["card_id"] for card in current["cards"]]
        existing = [tagged["cards"].get(card_id) for card_id in current_ids]
        is_merged = all(
            record is not None and record.get("batch_id") == current["batch_id"]
            for record in existing
        )
        if not is_merged:
            overlap = [card_id for card_id in current_ids if card_id in completed_ids]
            if overlap:
                raise PipelineError(
                    "current unmerged batch overlaps completed cards: "
                    + ", ".join(overlap[:5])
                )
            print(
                f"batch_id={current['batch_id']} cards={len(current['cards'])} "
                "status=existing"
            )
            return 0

    remaining = [
        card for card in cards if _catalog_card_id(card) not in completed_ids
    ]
    if not remaining:
        print("no unclassified cards remain")
        return NO_MORE_CARDS_EXIT
    selected = remaining[:batch_size]
    batch = {
        "schema_version": SCHEMA_VERSION,
        "batch_id": _batch_id(fingerprint, selected),
        "catalog_fingerprint": fingerprint,
        "low_confidence_threshold": LOW_CONFIDENCE_THRESHOLD,
        "allowed_tags": {
            "activation_tags": list(ACTIVATION_TAGS),
            "application_tags": list(APPLICATION_TAGS),
            "operation_tags": list(OPERATION_TAGS),
        },
        "cards": [_batch_card(card) for card in selected],
    }
    _ensure_runtime_dirs(paths)
    _atomic_write_json(paths["batch"], batch, paths["tmp"])
    print(f"batch_id={batch['batch_id']} cards={len(selected)} status=prepared")
    return 0


def command_validate(paths: dict[str, Path]) -> int:
    batch, result = _read_and_validate(paths)
    needs_review = sum(
        1
        for card in result["cards"]
        if card["needs_review"]
        or float(card["confidence"]) < LOW_CONFIDENCE_THRESHOLD
    )
    print(
        f"valid batch_id={batch['batch_id']} cards={len(result['cards'])} "
        f"needs_review={needs_review}"
    )
    return 0


def _classification_equal(existing: dict[str, Any], result_card: dict[str, Any]) -> bool:
    return all(existing.get(key) == value for key, value in result_card.items())


def _review_reasons(card: dict[str, Any]) -> list[str]:
    reasons: list[str] = []
    if card["needs_review"]:
        reasons.append("needs_review")
    if float(card["confidence"]) < LOW_CONFIDENCE_THRESHOLD:
        reasons.append("low_card_confidence")
    if any(
        effect["needs_review"]
        or float(effect["confidence"]) < LOW_CONFIDENCE_THRESHOLD
        for effect in card["effects"]
    ):
        reasons.append("effect_needs_review")
    return reasons


def _rebuild_review_records(tagged: dict[str, Any]) -> list[dict[str, Any]]:
    records: list[dict[str, Any]] = []
    for card_id, card in tagged["cards"].items():
        reasons = _review_reasons(card)
        if reasons:
            records.append(
                {
                    "card_id": card_id,
                    "batch_id": card["batch_id"],
                    "review_reasons": reasons,
                    "confidence": card["confidence"],
                    "needs_review": card["needs_review"],
                    "note": card["note"],
                    "effects": card["effects"],
                }
            )
    return records


def _updated_state(
    state: dict[str, Any],
    tagged: dict[str, Any],
    catalog_order: list[str],
    batch: dict[str, Any],
    result: dict[str, Any],
    merged_at: str,
) -> dict[str, Any]:
    completed_set = set(tagged["cards"])
    completed_ids = [card_id for card_id in catalog_order if card_id in completed_set]
    batch_review_count = sum(1 for card in result["cards"] if _review_reasons(card))
    completed_batches = dict(state.get("completed_batches", {}))
    completed_batches[batch["batch_id"]] = {
        "card_ids": [card["card_id"] for card in batch["cards"]],
        "processed": len(batch["cards"]),
        "needs_review": batch_review_count,
        "merged_at": merged_at,
    }
    return {
        "schema_version": SCHEMA_VERSION,
        "catalog_fingerprint": batch["catalog_fingerprint"],
        "progress": {
            "total_cards": len(catalog_order),
            "completed": len(completed_ids),
            "remaining": len(catalog_order) - len(completed_ids),
        },
        "completed_card_ids": completed_ids,
        "completed_batches": completed_batches,
        "last_merged_batch_id": batch["batch_id"],
    }


def command_merge(paths: dict[str, Path]) -> int:
    batch, result = _read_and_validate(paths)
    _, catalog, fingerprint = _load_catalog(paths)
    if batch["catalog_fingerprint"] != fingerprint:
        raise PipelineError(
            "catalog changed after this batch was prepared; refusing to merge"
        )
    catalog_order = [_catalog_card_id(card) for card in catalog]
    catalog_ids = set(catalog_order)
    tagged = _load_tagged(paths, fingerprint)
    state = _load_state(paths, fingerprint, len(catalog))
    _assert_state_consistent(state, tagged, catalog_ids)

    result_by_id = {card["card_id"]: card for card in result["cards"]}
    batch_ids = [card["card_id"] for card in batch["cards"]]
    existing = [tagged["cards"].get(card_id) for card_id in batch_ids]
    existing_count = sum(record is not None for record in existing)
    if existing_count not in {0, len(batch_ids)}:
        raise PipelineError(
            "only part of the current batch is present in tagged_cards.json; "
            "manual recovery is required"
        )

    already_merged = existing_count == len(batch_ids)
    if already_merged:
        for card_id, record in zip(batch_ids, existing):
            assert record is not None
            if record.get("batch_id") != batch["batch_id"]:
                raise PipelineError(
                    f"card {card_id} was merged by a different batch"
                )
            if not _classification_equal(record, result_by_id[card_id]):
                raise PipelineError(
                    f"card {card_id} result differs from the already merged result"
                )
        merged_at = next(
            (
                record.get("merged_at")
                for record in existing
                if isinstance(record, dict)
                and isinstance(record.get("merged_at"), str)
            ),
            datetime.now(timezone.utc).isoformat(),
        )
    else:
        merged_at = datetime.now(timezone.utc).isoformat()
        for card_id in batch_ids:
            tagged["cards"][card_id] = {
                **result_by_id[card_id],
                "batch_id": batch["batch_id"],
                "merged_at": merged_at,
            }

    _ensure_runtime_dirs(paths)
    _atomic_write_json(paths["tagged"], tagged, paths["tmp"])

    review_records = _rebuild_review_records(tagged)
    _atomic_write_jsonl(paths["review"], review_records, paths["tmp"])
    updated_state = _updated_state(
        state, tagged, catalog_order, batch, result, merged_at
    )
    _atomic_write_json(paths["state"], updated_state, paths["tmp"])

    verb = "already_merged" if already_merged else "merged"
    batch_review_count = sum(1 for card in result["cards"] if _review_reasons(card))
    print(
        f"batch_id={batch['batch_id']} cards={len(batch_ids)} "
        f"needs_review={batch_review_count} status={verb}"
    )
    return 0


def command_status(paths: dict[str, Path]) -> int:
    _, catalog, fingerprint = _load_catalog(paths)
    catalog_ids = [_catalog_card_id(card) for card in catalog]
    tagged = _load_tagged(paths, fingerprint)
    state = _load_state(paths, fingerprint, len(catalog))
    _assert_state_consistent(state, tagged, set(catalog_ids))
    completed = len(tagged["cards"])
    review_count = len(_rebuild_review_records(tagged))

    current = "none"
    if paths["batch"].exists():
        batch = _validate_batch_shape(_read_json(paths["batch"], "current batch"))
        current_ids = [card["card_id"] for card in batch["cards"]]
        merged = all(
            tagged["cards"].get(card_id, {}).get("batch_id") == batch["batch_id"]
            for card_id in current_ids
        )
        if merged:
            batch_status = "merged"
        elif not paths["result"].exists():
            batch_status = "prepared"
        else:
            try:
                _read_and_validate(paths)
                batch_status = "result_valid"
            except PipelineError:
                batch_status = "result_invalid"
        current = (
            f"{batch['batch_id']} status={batch_status} cards={len(current_ids)}"
        )

    print(f"total_cards={len(catalog)}")
    print(f"completed={completed}")
    print(f"remaining={len(catalog) - completed}")
    print(f"needs_review={review_count}")
    print(f"current_batch={current}")
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Safe sidecar-only card tag batch pipeline"
    )
    subparsers = parser.add_subparsers(dest="command", required=True)
    prepare = subparsers.add_parser("prepare", help="prepare the next batch")
    prepare.add_argument("--batch-size", type=int, default=100)
    subparsers.add_parser("validate", help="validate current_result.json")
    subparsers.add_parser("merge", help="merge a validated result into sidecars")
    subparsers.add_parser("status", help="show pipeline progress")
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    paths = _paths(_project_root())
    try:
        if args.command == "prepare":
            return command_prepare(paths, args.batch_size)
        if args.command == "validate":
            return command_validate(paths)
        if args.command == "merge":
            return command_merge(paths)
        if args.command == "status":
            return command_status(paths)
        raise PipelineError(f"unsupported command: {args.command}")
    except ValidationError as exc:
        print(f"VALIDATION_FAILED: {exc}", file=sys.stderr)
        return VALIDATION_ERROR_EXIT
    except PipelineError as exc:
        print(f"PIPELINE_ERROR: {exc}", file=sys.stderr)
        return PIPELINE_ERROR_EXIT


if __name__ == "__main__":
    raise SystemExit(main())
