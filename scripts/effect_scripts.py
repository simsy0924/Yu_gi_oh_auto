"""Collect Lua scripts from the pinned ProjectIgnis/CardScripts checkout."""
from pathlib import Path


def collect_effect_scripts(card_scripts_dir):
    card_scripts_dir = Path(card_scripts_dir)
    pre_release_scripts = sorted((card_scripts_dir/'pre-release').glob('*.lua'))
    if not pre_release_scripts:
        raise SystemExit(f'No prerelease Lua scripts found in {card_scripts_dir}/pre-release')

    paths = [
        *sorted(card_scripts_dir.glob('*.lua')),
        *pre_release_scripts,
        *sorted((card_scripts_dir/'official').glob('*.lua')),
    ]
    scripts = {path.name: path.read_text(encoding='utf-8-sig') for path in paths}
    return scripts, len(pre_release_scripts)
