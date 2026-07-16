import importlib.util
import sys
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
MODULE_PATH = ROOT / "tools" / "card_handtrap_pipeline.py"
sys.path.insert(0, str(ROOT / "tools"))
SPEC = importlib.util.spec_from_file_location("card_handtrap_pipeline", MODULE_PATH)
assert SPEC and SPEC.loader
PIPELINE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(PIPELINE)


class CardHandTrapPipelineTests(unittest.TestCase):
    def test_monster_effect_permission_blocks_monster_hand_traps_only(self) -> None:
        matches = PIPELINE._response_negation_scope(
            "상대가 몬스터의 효과를 발동했을 때에 발동할 수 있다. "
            "그 발동을 무효로 하고 파괴한다.",
            {"NEGATE_ACTIVATION"},
        )
        self.assertIn("builtin-ash-blossom", matches)
        self.assertIn("builtin-psy-framegear-gamma", matches)
        self.assertNotIn("builtin-infinite-impermanence", matches)

    def test_target_protection_only_blocks_targeting_hand_traps(self) -> None:
        matches = PIPELINE._response_negation_scope(
            "이 카드를 대상으로 하는 상대 효과가 발동했을 때에 발동할 수 있다. "
            "그 발동을 무효로 한다.",
            {"NEGATE_ACTIVATION"},
        )
        self.assertEqual(
            matches,
            {
                "builtin-dominus-spiral",
                "builtin-dominus-spark",
                "builtin-infinite-impermanence",
                "builtin-effect-veiler",
                "builtin-ghost-mourner",
            },
        )

    def test_unnegatable_text_is_not_a_permission(self) -> None:
        matches = PIPELINE._response_negation_scope(
            "이 카드의 발동과 효과는 무효화되지 않는다.",
            {"NEGATE_EFFECT"},
        )
        self.assertEqual(matches, set())

    def test_generated_payload_validates_against_every_catalog_card(self) -> None:
        payload = PIPELINE._read_json(PIPELINE._paths(ROOT)["output"])
        PIPELINE.validate_payload(ROOT, payload)
        self.assertEqual(payload["cardCount"], 13_982)
        self.assertEqual(payload["effectCount"], 21_460)
        self.assertEqual(len(payload["handTraps"]), 30)


if __name__ == "__main__":
    unittest.main()
