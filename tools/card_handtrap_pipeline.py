#!/usr/bin/env python3
"""Build and validate catalog-wide hand-trap interaction suggestions."""

from __future__ import annotations

import argparse
import hashlib
import json
import re
from pathlib import Path
from typing import Any

import card_tag_pipeline as tag_pipeline


SCHEMA_VERSION = 1

HAND_TRAPS = {
    "builtin-ash-blossom": "하루 우라라",
    "builtin-ghost-ogre": "유령토끼",
    "builtin-nibiru": "원시생명체 니비루",
    "builtin-feedrauris-harmonia": "피드라울리스＝하르모니아",
    "builtin-dominus-spiral": "도미나스 스파이럴",
    "builtin-dominus-spark": "도미나스 스파크",
    "builtin-dd-crow": "D.D. 크로우",
    "builtin-bystial-magnamhut": "비스테드 마그나무트",
    "builtin-bystial-druiswurm": "비스테드 드루이드브룸",
    "builtin-bystial-baldrake": "비스테드 발드레이크",
    "builtin-bystial-saronir": "비스테드 살로니르",
    "builtin-skull-meister": "스컬 마이스터",
    "builtin-ghost-belle": "저택 와라시",
    "builtin-phantazmay": "환창룡 판타즈메이",
    "builtin-dominus-purge": "도미나스 퍼지",
    "builtin-dominus-impulse": "도미나스 임펄스",
    "builtin-infinite-impermanence": "무한포영",
    "builtin-dominus-verse": "열왕시편",
    "builtin-effect-veiler": "이펙트 뵐러",
    "builtin-ghost-mourner": "사요 시구레",
    "builtin-psy-framegear-gamma": "PSY프레임기어 γ",
    "builtin-herald-of-orange-light": "버밀리온 디클레어러",
    "builtin-red-reboot": "레드 리부트",
    "builtin-maxx-c": "증식의 G",
    "builtin-dimension-shifter": "디멘션 어트랙터",
    "builtin-artifact-lancea": "아티팩트－롱기누스",
    "builtin-droll-lock-bird": "드롤 & 로크 버드",
    "builtin-mulcharmy-fuwalos": "마루챠미 후와로스",
    "builtin-mulcharmy-purulia": "마루챠미 푸루리아",
    "builtin-mulcharmy-meowls": "마루챠미 냐루스",
}

TRAP_HAND_TRAPS = {
    "builtin-dominus-spiral",
    "builtin-dominus-spark",
    "builtin-dominus-purge",
    "builtin-dominus-impulse",
    "builtin-infinite-impermanence",
    "builtin-dominus-verse",
    "builtin-red-reboot",
}
MONSTER_HAND_TRAPS = set(HAND_TRAPS) - TRAP_HAND_TRAPS
BYSTIALS = {
    "builtin-bystial-magnamhut",
    "builtin-bystial-druiswurm",
    "builtin-bystial-baldrake",
    "builtin-bystial-saronir",
}
FIELD_MONSTER_NEGATES = {
    "builtin-infinite-impermanence",
    "builtin-dominus-verse",
    "builtin-effect-veiler",
}
ANY_MONSTER_EFFECT_NEGATES = {
    "builtin-psy-framegear-gamma",
    "builtin-herald-of-orange-light",
}


class InteractionError(RuntimeError):
    """Hand-trap interaction build or validation failure."""


def _root() -> Path:
    return Path(__file__).resolve().parents[1]


def _paths(root: Path) -> dict[str, Path]:
    return {
        "root": root,
        "tagged": root / ".codex-tagging" / "tagged_cards.json",
        "output": root
        / "public"
        / "data"
        / "ygo-ko-cards"
        / "handtrap-interactions.json",
    }


def _read_json(path: Path) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError as exc:
        raise InteractionError(f"required file not found: {path}") from exc
    except json.JSONDecodeError as exc:
        raise InteractionError(
            f"invalid JSON at line {exc.lineno}, column {exc.colno}: {path}"
        ) from exc


def _ordered(values: set[str]) -> list[str]:
    return [hand_trap_id for hand_trap_id in HAND_TRAPS if hand_trap_id in values]


def _effect_source_zone(
    card: dict[str, Any], effect: dict[str, Any], tags: dict[str, Any]
) -> str:
    text = effect["text"]
    applications = set(tags["application_tags"])
    if "WHILE_IN_GY" in applications or re.search(
        r"묘지의 이 카드|이 카드가 묘지에 존재|묘지에서 발동", text
    ):
        return "GRAVEYARD"
    if "WHILE_BANISHED" in applications or re.search(
        r"제외되어 있는 이 카드|제외 상태의 이 카드|제외된 이 카드", text
    ):
        return "BANISHED"
    if re.search(
        r"패의 이 카드|이 카드를 패에서|패에서 이 카드를|이 카드가 패에 존재", text
    ):
        return "HAND"
    return "MONSTER_ZONE" if card["c"] == "Monster" else "SPELL_TRAP_ZONE"


def _activated(effect: dict[str, Any], tags: dict[str, Any]) -> bool:
    return bool(tags["activation_tags"]) or "발동" in effect["text"]


def _moves_from_graveyard(text: str) -> bool:
    return bool(
        re.search(
            r"묘지.{0,100}(?:패|덱|엑스트라 덱).{0,50}(?:넣|되돌)"
            r"|묘지.{0,100}특수 소환"
            r"|묘지.{0,100}제외",
            text,
            re.S,
        )
    )


def _depends_on_graveyard_card(text: str) -> bool:
    return bool(
        re.search(
            r"묘지.{0,120}(?:대상|선택|고르고|제외|특수 소환|패에 넣|덱에 넣|되돌)",
            text,
            re.S,
        )
    )


def _depends_on_light_dark_grave_monster(text: str) -> bool:
    return bool(
        re.search(
            r"묘지.{0,100}(?:빛|어둠) 속성.{0,60}몬스터"
            r"|묘지.{0,100}몬스터.{0,60}(?:빛|어둠) 속성",
            text,
            re.S,
        )
    )


def _special_summons_from_deck(text: str) -> bool:
    return bool(re.search(r"덱에서.{0,140}특수 소환", text, re.S))


def _interruptible_by(
    card: dict[str, Any], effect: dict[str, Any], tags: dict[str, Any]
) -> tuple[list[str], list[str]]:
    text = f"{effect.get('common_text', '')}\n{effect['text']}".strip()
    operations = set(tags["operation_tags"])
    applications = set(tags["application_tags"])
    source_zone = _effect_source_zone(card, effect, tags)
    activated = _activated(effect, tags)
    matches: set[str] = set()
    notes: list[str] = []

    if (
        operations & {"SEARCH", "DRAW", "SEND_DECK_TO_GY"}
        or _special_summons_from_deck(text)
    ):
        matches.add("builtin-ash-blossom")
    if operations & {"SEARCH", "DRAW"}:
        matches.add("builtin-dominus-purge")
    if "SPECIAL_SUMMON" in operations:
        matches.add("builtin-dominus-impulse")
    if _moves_from_graveyard(text):
        matches.add("builtin-ghost-belle")
    if source_zone == "GRAVEYARD" and activated:
        matches.add("builtin-skull-meister")

    is_effect_monster = card["c"] == "Monster" and "Effect" in (card.get("y") or "")
    if is_effect_monster and activated:
        matches.update(ANY_MONSTER_EFFECT_NEGATES)
        if source_zone == "MONSTER_ZONE":
            matches.update(FIELD_MONSTER_NEGATES)
            matches.add("builtin-feedrauris-harmonia")
            matches.add("builtin-ghost-ogre")

    persistent_spell_trap = card["c"] in {"Spell", "Trap"} and card.get("r") in {
        "Continuous",
        "Equip",
        "Field",
        "Pendulum",
    }
    if persistent_spell_trap and source_zone == "SPELL_TRAP_ZONE" and activated:
        matches.add("builtin-ghost-ogre")

    if (
        {"TARGET_REQUIRED", "OPPONENT", "MONSTER"}.issubset(applications)
        and activated
    ):
        matches.add("builtin-phantazmay")
    if _depends_on_graveyard_card(text):
        matches.add("builtin-dd-crow")
    if _depends_on_light_dark_grave_monster(text):
        matches.update(BYSTIALS)
    if card["c"] == "Trap" and source_zone == "SPELL_TRAP_ZONE" and activated:
        matches.add("builtin-red-reboot")

    if "SPECIAL_SUMMON" in operations:
        notes.append(
            "증식의 G·니비루·마루챠미·사요 시구레는 소환 경로와 누적 상태에 따라 "
            "처리 전후에 적용되므로 전개 단계에서 별도 판정"
        )
    if operations & {"SEARCH", "DRAW"}:
        notes.append(
            "드롤 & 로크 버드는 첫 덱→패 처리 후 이후 처리부터 전개 단계에서 별도 판정"
        )
    if operations & {"SEND_GY", "SEND_DECK_TO_GY"}:
        notes.append(
            "디멘션 어트랙터는 사전 적용 여부에 따라 묘지 이동을 제외로 바꾸므로 "
            "전개 단계에서 별도 판정"
        )
    if "BANISH" in operations:
        notes.append(
            "아티팩트－롱기누스는 사전 적용 여부와 턴 소유자에 따라 전개 단계에서 별도 판정"
        )
    return _ordered(matches), notes


def _response_negation_scope(text: str, operations: set[str]) -> set[str]:
    if not operations & {"NEGATE_EFFECT", "NEGATE_ACTIVATION"}:
        return set()
    normalized = re.sub(
        r"[^.。]*무효화되지 않는다[^.。]*[.。]?", "", text
    )
    if not re.search(
        r"(?:효과|카드|발동).{0,100}"
        r"(?:발동했을 때|발동할 때|발동되었을 때|발동에 체인)",
        normalized,
        re.S,
    ):
        return set()
    if not re.search(
        r"그 (?:발동|효과)를 무효|발동과 효과를 무효|발동을 무효로",
        normalized,
    ):
        return set()
    if re.search(
        r"엑스트라 덱.{0,40}몬스터의 효과|필드에서 발동한 몬스터",
        normalized,
    ):
        return set()
    targeting_hand_traps = {
        "builtin-dominus-spiral",
        "builtin-dominus-spark",
        "builtin-infinite-impermanence",
        "builtin-effect-veiler",
        "builtin-ghost-mourner",
    }
    if re.search(
        r"(?:이 카드|자신 필드.{0,30}몬스터).{0,60}대상"
        r"|대상으로 하는.{0,50}(?:효과|카드)가 발동",
        normalized,
        re.S,
    ):
        return targeting_hand_traps
    if re.search(
        r"마법\s*[/·&또는]+\s*함정\s*[/·&또는]+\s*몬스터"
        r"|마법\s*[/·&]\s*함정\s*[/·&]\s*몬스터"
        r"|상대가 카드의 효과를 발동|카드 또는 효과가 발동",
        normalized,
        re.S,
    ):
        return set(HAND_TRAPS)
    if re.search(r"몬스터의 효과|몬스터 효과", normalized):
        return set(MONSTER_HAND_TRAPS)
    if re.search(
        r"함정 카드의 발동|마법\s*[/·&또는]+\s*함정", normalized
    ):
        return set(TRAP_HAND_TRAPS)
    return set()


def _blocks_hand_traps(
    card: dict[str, Any], effect: dict[str, Any], tags: dict[str, Any]
) -> tuple[list[str], bool, str]:
    text = f"{effect.get('common_text', '')}\n{effect['text']}".strip()
    operations = set(tags["operation_tags"])
    matches = _response_negation_scope(text, operations)
    reason = ""
    needs_review = False

    if re.search(
        r"카드명.{0,80}선언.{0,160}제외.{0,160}(?:같은 이름|동명의).{0,100}효과.{0,40}무효",
        text,
        re.S,
    ):
        matches.update(HAND_TRAPS)
        reason = "선언한 동명 카드의 효과를 무효화하는 범용 패트랩 대응"
    elif re.search(
        r"묘지.{0,120}몬스터.{0,100}제외.{0,180}(?:같은 이름|동명의).{0,100}효과.{0,40}무효",
        text,
        re.S,
    ):
        matches.update(MONSTER_HAND_TRAPS)
        reason = "묘지의 동명 몬스터 효과를 무효화하는 패트랩 대응"

    if matches and not reason:
        reason = "발동한 효과를 무효화하는 퍼미션 문구 기준"
    if operations & {"NEGATE_EFFECT", "NEGATE_ACTIVATION"} and not matches:
        needs_review = True
        reason = "무효 처리의 대상 범위가 패트랩 발동까지 포함되는지 수동 확인 필요"
    return _ordered(matches), needs_review, reason


def _catalog_fingerprint(manifest: dict[str, Any], cards: list[dict[str, Any]]) -> str:
    digest = hashlib.sha256()
    digest.update(
        json.dumps(manifest, ensure_ascii=False, sort_keys=True).encode("utf-8")
    )
    for card in cards:
        digest.update(
            json.dumps(card, ensure_ascii=False, sort_keys=True).encode("utf-8")
        )
    return digest.hexdigest()


def build_payload(root: Path) -> dict[str, Any]:
    paths = _paths(root)
    pipeline_paths = tag_pipeline._paths(root)
    manifest, cards, tag_fingerprint = tag_pipeline._load_catalog(pipeline_paths)
    tagged = _read_json(paths["tagged"])
    if tagged.get("catalog_fingerprint") != tag_fingerprint:
        raise InteractionError("tagged card sidecar does not match the catalog")

    records: dict[str, Any] = {}
    effect_count = 0
    review_count = 0
    for card in cards:
        card_id = tag_pipeline._catalog_card_id(card)
        tagged_card = tagged["cards"].get(card_id)
        if tagged_card is None:
            raise InteractionError(f"missing tagged card: {card_id}")
        tagged_effects = {
            effect["effect_id"]: effect for effect in tagged_card["effects"]
        }
        effect_records: dict[str, Any] = {}
        card_interrupts: set[str] = set()
        card_blocks: set[str] = set()
        for effect in tag_pipeline._card_effect_units(card, card_id):
            tags = tagged_effects.get(effect["effect_id"])
            if tags is None:
                raise InteractionError(f"missing tagged effect: {effect['effect_id']}")
            interruptible_by, notes = _interruptible_by(card, effect, tags)
            blocks, needs_review, block_reason = _blocks_hand_traps(card, effect, tags)
            confidence = 0.72 if needs_review else 0.9
            if needs_review:
                review_count += 1
            effect_key = f"{effect['scope']}/{effect['index']}"
            effect_records[effect_key] = {
                "interruptibleBy": interruptible_by,
                "blocksHandTraps": blocks,
                "interactionNotes": notes,
                "confidence": confidence,
                "needsReview": needs_review,
                "note": block_reason or "명시된 효과·대상·발동 위치 문구 기준",
            }
            card_interrupts.update(interruptible_by)
            card_blocks.update(blocks)
            effect_count += 1
        records[card_id] = {
            "interruptibleBy": _ordered(card_interrupts),
            "blocksHandTraps": _ordered(card_blocks),
            "effects": effect_records,
        }

    return {
        "schemaVersion": SCHEMA_VERSION,
        "catalogFingerprint": _catalog_fingerprint(manifest, cards),
        "cardCount": len(cards),
        "effectCount": effect_count,
        "needsReview": review_count,
        "handTraps": [
            {"id": hand_trap_id, "name": name}
            for hand_trap_id, name in HAND_TRAPS.items()
        ],
        "cards": records,
    }


def validate_payload(root: Path, payload: dict[str, Any]) -> None:
    paths = tag_pipeline._paths(root)
    _, cards, _ = tag_pipeline._load_catalog(paths)
    if payload.get("schemaVersion") != SCHEMA_VERSION:
        raise InteractionError("unsupported interaction schema version")
    if payload.get("cardCount") != len(cards):
        raise InteractionError("interaction card count does not match catalog")
    if set(payload.get("cards", {})) != {
        tag_pipeline._catalog_card_id(card) for card in cards
    }:
        raise InteractionError("interaction card IDs do not exactly match catalog")
    allowed = set(HAND_TRAPS)
    effect_count = 0
    for card in cards:
        card_id = tag_pipeline._catalog_card_id(card)
        record = payload["cards"][card_id]
        expected_effects = {
            f"{effect['scope']}/{effect['index']}"
            for effect in tag_pipeline._card_effect_units(card, card_id)
        }
        if set(record.get("effects", {})) != expected_effects:
            raise InteractionError(f"interaction effects mismatch: {card_id}")
        for field in ("interruptibleBy", "blocksHandTraps"):
            if not set(record.get(field, [])).issubset(allowed):
                raise InteractionError(f"unknown hand trap in {card_id}.{field}")
        for effect_key, effect in record["effects"].items():
            for field in ("interruptibleBy", "blocksHandTraps"):
                values = effect.get(field)
                if not isinstance(values, list) or len(values) != len(set(values)):
                    raise InteractionError(
                        f"invalid {field}: {card_id}/{effect_key}"
                    )
                if not set(values).issubset(allowed):
                    raise InteractionError(
                        f"unknown hand trap: {card_id}/{effect_key}/{field}"
                    )
            effect_count += 1
    if payload.get("effectCount") != effect_count:
        raise InteractionError("interaction effect count is incorrect")


def command_build(root: Path) -> int:
    payload = build_payload(root)
    validate_payload(root, payload)
    output = _paths(root)["output"]
    output.write_text(
        json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + "\n",
        encoding="utf-8",
    )
    print(
        f"cards={payload['cardCount']} effects={payload['effectCount']} "
        f"needs_review={payload['needsReview']} output={output}"
    )
    return 0


def command_validate(root: Path) -> int:
    payload = _read_json(_paths(root)["output"])
    validate_payload(root, payload)
    print(
        f"valid cards={payload['cardCount']} effects={payload['effectCount']} "
        f"needs_review={payload['needsReview']}"
    )
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Build catalog-wide hand-trap interaction suggestions"
    )
    parser.add_argument("command", choices=("build", "validate"))
    args = parser.parse_args()
    root = _root()
    return command_build(root) if args.command == "build" else command_validate(root)


if __name__ == "__main__":
    raise SystemExit(main())
