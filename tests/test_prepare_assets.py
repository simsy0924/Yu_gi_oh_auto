import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from effect_scripts import collect_effect_scripts


class EffectScriptBundleTests(unittest.TestCase):
    def test_includes_prerelease_scripts_and_keeps_official_duplicate_precedence(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            for relative, text in {
                'chain.lua': 'chain',
                'pre-release/c123.lua': 'prerelease',
                'pre-release/c456.lua': 'new prerelease',
                'official/c123.lua': 'official',
                'official/c789.lua': 'official only',
            }.items():
                path = root / relative
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_text(text, encoding='utf-8')

            scripts, prerelease_count = collect_effect_scripts(root)

        self.assertEqual(prerelease_count, 2)
        self.assertEqual(scripts['c123.lua'], 'official')
        self.assertEqual(scripts['c456.lua'], 'new prerelease')
        self.assertEqual(scripts['c789.lua'], 'official only')
        self.assertEqual(scripts['chain.lua'], 'chain')

    def test_requires_the_prerelease_source_folder(self):
        with tempfile.TemporaryDirectory() as directory:
            with self.assertRaises(SystemExit):
                collect_effect_scripts(directory)


if __name__ == '__main__':
    unittest.main()
