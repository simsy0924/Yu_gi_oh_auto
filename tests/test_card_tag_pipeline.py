import copy
import hashlib
import json
import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path


REPOSITORY_ROOT = Path(__file__).resolve().parents[1]
PIPELINE = REPOSITORY_ROOT / "tools" / "card_tag_pipeline.py"


class CardTagPipelineTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temporary = tempfile.TemporaryDirectory()
        self.root = Path(self.temporary.name)
        self.catalog = self.root / "public" / "data" / "ygo-ko-cards"
        self.catalog.mkdir(parents=True)
        self.cards = [
            {
                "i": 10,
                "p": 10001000,
                "n": "테스트 서치 마법",
                "t": "①: 덱에서 카드 1장을 패에 넣는다. ②: 1장 드로우한다.",
                "e": "",
                "c": "Spell",
                "r": "Normal",
                "y": None,
                "a": None,
                "v": None,
                "k": None,
                "d": None,
                "m": "",
                "g": [],
                "u": False,
            },
            {
                "i": 11,
                "p": 10001001,
                "n": "테스트 일반 몬스터",
                "t": "효과가 아닌 플레이버 텍스트.",
                "e": "",
                "c": "Monster",
                "r": None,
                "y": "Warrior / Normal",
                "a": "EARTH",
                "v": 4,
                "k": 1000,
                "d": 1000,
                "m": "",
                "g": [],
                "u": False,
            },
            {
                "i": 12,
                "p": None,
                "n": "테스트 효과 몬스터",
                "t": "이 카드가 특수 소환에 성공했을 경우에 발동할 수 있다. 필드의 카드 1장을 파괴한다.",
                "e": "",
                "c": "Monster",
                "r": None,
                "y": "Dragon / Effect",
                "a": "DARK",
                "v": 4,
                "k": 1800,
                "d": 1000,
                "m": "",
                "g": [],
                "u": False,
            },
            {
                "i": 10,
                "p": 10001003,
                "n": "테스트 함정",
                "t": "상대 몬스터의 효과가 발동했을 때 발동할 수 있다. 그 발동을 무효로 한다.",
                "e": "",
                "c": "Trap",
                "r": "Counter",
                "y": None,
                "a": None,
                "v": None,
                "k": None,
                "d": None,
                "m": "",
                "g": [],
                "u": False,
            },
        ]
        (self.catalog / "part-001.json").write_text(
            json.dumps(self.cards, ensure_ascii=False) + "\n", encoding="utf-8"
        )
        (self.catalog / "manifest.json").write_text(
            json.dumps(
                {
                    "updatedAt": "2026-07-16",
                    "source": "test",
                    "cardCount": len(self.cards),
                    "parts": ["part-001.json"],
                },
                ensure_ascii=False,
            )
            + "\n",
            encoding="utf-8",
        )
        self.source_hashes = self._source_hashes()

    def tearDown(self) -> None:
        self.temporary.cleanup()

    def _run(
        self, *arguments: str, extra_env: dict[str, str] | None = None
    ) -> subprocess.CompletedProcess[str]:
        env = os.environ.copy()
        env["CARD_TAG_PIPELINE_ROOT"] = str(self.root)
        if extra_env:
            env.update(extra_env)
        return subprocess.run(
            [sys.executable, str(PIPELINE), *arguments],
            cwd=REPOSITORY_ROOT,
            env=env,
            text=True,
            encoding="utf-8",
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            check=False,
        )

    def _source_hashes(self) -> dict[str, str]:
        return {
            path.name: hashlib.sha256(path.read_bytes()).hexdigest()
            for path in sorted(self.catalog.iterdir())
            if path.is_file()
        }

    def _prepare(self, size: int = 3) -> dict:
        result = self._run("prepare", "--batch-size", str(size))
        self.assertEqual(result.returncode, 0, result.stderr)
        return json.loads(
            (self.root / ".codex-tagging" / "current_batch.json").read_text(
                encoding="utf-8"
            )
        )

    def _valid_result(self, batch: dict, review_first: bool = False) -> dict:
        cards = []
        for card_index, card in enumerate(batch["cards"]):
            effects = []
            for effect in card["effects"]:
                operation_tags = []
                text = effect["text"]
                if "패에 넣" in text:
                    operation_tags.append("SEARCH")
                if "드로우" in text:
                    operation_tags.append("DRAW")
                if "파괴한다" in text:
                    operation_tags.append("DESTROY")
                if "발동을 무효" in text:
                    operation_tags.append("NEGATE_ACTIVATION")
                effects.append(
                    {
                        "effect_id": effect["effect_id"],
                        "activation_tags": [],
                        "application_tags": [],
                        "operation_tags": operation_tags,
                        "confidence": 0.95,
                        "needs_review": False,
                        "note": "test classification",
                    }
                )
            needs_review = review_first and card_index == 0
            if needs_review:
                effects[0]["needs_review"] = True
                effects[0]["note"] = "manual review requested"
            cards.append(
                {
                    "card_id": card["card_id"],
                    "effects": effects,
                    "confidence": 0.9,
                    "needs_review": needs_review,
                    "note": "manual review requested" if needs_review else "test classification",
                }
            )
        return {
            "schema_version": 1,
            "batch_id": batch["batch_id"],
            "cards": cards,
        }

    def _write_result(self, payload: dict) -> None:
        path = self.root / ".codex-tagging" / "current_result.json"
        path.write_text(
            json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )

    def _assert_validation_did_not_mutate(self, batch_bytes: bytes) -> None:
        tagging = self.root / ".codex-tagging"
        self.assertEqual(self._source_hashes(), self.source_hashes)
        self.assertEqual((tagging / "current_batch.json").read_bytes(), batch_bytes)
        self.assertFalse((tagging / "state.json").exists())
        self.assertFalse((tagging / "tagged_cards.json").exists())
        self.assertFalse((tagging / "review.jsonl").exists())

    def test_normal_batch_validates_and_merges_sidecar_only(self) -> None:
        batch = self._prepare()
        batch_path = self.root / ".codex-tagging" / "current_batch.json"
        first_batch_bytes = batch_path.read_bytes()
        repeated = self._run("prepare", "--batch-size", "1")
        self.assertEqual(repeated.returncode, 0, repeated.stderr)
        self.assertIn("status=existing", repeated.stdout)
        self.assertEqual(batch_path.read_bytes(), first_batch_bytes)

        self._write_result(self._valid_result(batch, review_first=True))
        validated = self._run("validate")
        self.assertEqual(validated.returncode, 0, validated.stderr)
        merged = self._run("merge")
        self.assertEqual(merged.returncode, 0, merged.stderr)

        tagging = self.root / ".codex-tagging"
        state = json.loads((tagging / "state.json").read_text(encoding="utf-8"))
        tagged = json.loads(
            (tagging / "tagged_cards.json").read_text(encoding="utf-8")
        )
        review_lines = (tagging / "review.jsonl").read_text(
            encoding="utf-8"
        ).splitlines()
        self.assertEqual(state["progress"]["completed"], 3)
        self.assertEqual(state["progress"]["remaining"], 1)
        self.assertEqual(
            set(tagged["cards"]), {card["card_id"] for card in batch["cards"]}
        )
        self.assertEqual(len(review_lines), 1)
        self.assertEqual(
            json.loads(review_lines[0])["card_id"], batch["cards"][0]["card_id"]
        )
        self.assertEqual(self._source_hashes(), self.source_hashes)

    def test_validate_rejects_missing_card_without_mutation(self) -> None:
        batch = self._prepare()
        batch_path = self.root / ".codex-tagging" / "current_batch.json"
        batch_bytes = batch_path.read_bytes()
        payload = self._valid_result(batch)
        payload["cards"].pop()
        self._write_result(payload)
        result = self._run("validate")
        self.assertEqual(result.returncode, 2)
        self.assertIn("missing output card IDs", result.stderr)
        self._assert_validation_did_not_mutate(batch_bytes)

    def test_validate_rejects_duplicate_card_without_mutation(self) -> None:
        batch = self._prepare()
        batch_path = self.root / ".codex-tagging" / "current_batch.json"
        batch_bytes = batch_path.read_bytes()
        payload = self._valid_result(batch)
        payload["cards"].append(copy.deepcopy(payload["cards"][0]))
        self._write_result(payload)
        result = self._run("validate")
        self.assertEqual(result.returncode, 2)
        self.assertIn("duplicate output card IDs", result.stderr)
        self._assert_validation_did_not_mutate(batch_bytes)

    def test_validate_rejects_unsupported_tag_without_mutation(self) -> None:
        batch = self._prepare()
        batch_path = self.root / ".codex-tagging" / "current_batch.json"
        batch_bytes = batch_path.read_bytes()
        payload = self._valid_result(batch)
        payload["cards"][0]["effects"][0]["operation_tags"] = ["MADE_UP_TAG"]
        self._write_result(payload)
        result = self._run("validate")
        self.assertEqual(result.returncode, 2)
        self.assertIn("unsupported tags", result.stderr)
        self._assert_validation_did_not_mutate(batch_bytes)

    def test_validate_rejects_wrong_batch_id_without_mutation(self) -> None:
        batch = self._prepare()
        batch_path = self.root / ".codex-tagging" / "current_batch.json"
        batch_bytes = batch_path.read_bytes()
        payload = self._valid_result(batch)
        payload["batch_id"] = "batch-wrong"
        self._write_result(payload)
        result = self._run("validate")
        self.assertEqual(result.returncode, 2)
        self.assertIn("batch ID mismatch", result.stderr)
        self._assert_validation_did_not_mutate(batch_bytes)

    def test_merge_recovers_when_rerun_after_interruption(self) -> None:
        batch = self._prepare()
        self._write_result(self._valid_result(batch, review_first=True))
        initial = self._run("merge")
        self.assertEqual(initial.returncode, 0, initial.stderr)
        tagging = self.root / ".codex-tagging"

        # Reproduce a process stop after the canonical sidecar was atomically
        # replaced but before review/state sidecars were durably replaced.
        (tagging / "state.json").unlink()
        (tagging / "review.jsonl").unlink()
        self.assertTrue((tagging / "tagged_cards.json").exists())
        self.assertFalse((tagging / "state.json").exists())

        recovered = self._run("merge")
        self.assertEqual(recovered.returncode, 0, recovered.stderr)
        self.assertIn("status=already_merged", recovered.stdout)
        state = json.loads((tagging / "state.json").read_text(encoding="utf-8"))
        self.assertEqual(state["progress"]["completed"], len(batch["cards"]))
        self.assertEqual(
            len((tagging / "review.jsonl").read_text(encoding="utf-8").splitlines()),
            1,
        )
        self.assertEqual(self._source_hashes(), self.source_hashes)

    def test_already_completed_batch_rerun_is_idempotent(self) -> None:
        batch = self._prepare()
        self._write_result(self._valid_result(batch, review_first=True))
        first = self._run("merge")
        self.assertEqual(first.returncode, 0, first.stderr)
        tagging = self.root / ".codex-tagging"
        before = {
            name: (tagging / name).read_bytes()
            for name in ("state.json", "tagged_cards.json", "review.jsonl")
        }

        second = self._run("merge")
        self.assertEqual(second.returncode, 0, second.stderr)
        self.assertIn("status=already_merged", second.stdout)
        after = {
            name: (tagging / name).read_bytes()
            for name in ("state.json", "tagged_cards.json", "review.jsonl")
        }
        self.assertEqual(after, before)
        self.assertEqual(self._source_hashes(), self.source_hashes)

    def test_prepare_returns_20_when_all_cards_are_complete(self) -> None:
        batch = self._prepare(size=10)
        self._write_result(self._valid_result(batch))
        merged = self._run("merge")
        self.assertEqual(merged.returncode, 0, merged.stderr)

        exhausted = self._run("prepare", "--batch-size", "10")
        self.assertEqual(exhausted.returncode, 20, exhausted.stderr)
        self.assertIn("no unclassified cards remain", exhausted.stdout)
        self.assertEqual(self._source_hashes(), self.source_hashes)


if __name__ == "__main__":
    unittest.main()
