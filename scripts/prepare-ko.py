"""Merge the pinned YAML Yugi Korean catalog into the bundled card data."""
import gzip
import json
import pathlib
import re
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
BREAK_TAG = re.compile(r'<br\s*/?>', re.IGNORECASE)
RUBY_TAG = re.compile(r'<ruby>(.*?)<rt>.*?</rt></ruby>', re.IGNORECASE | re.DOTALL)


def normalize_name(value):
    if not isinstance(value, str):
        return None
    value = RUBY_TAG.sub(lambda match: match.group(1), value)
    return value.strip() or None


def normalize_text(value):
    if not isinstance(value, str):
        return None
    value = BREAK_TAG.sub('\n', value)
    return value.replace('\r\n', '\n').replace('\r', '\n').strip() or None


def main():
    if len(sys.argv) != 2:
        raise SystemExit('usage: python3 scripts/prepare-ko.py /path/to/yaml-yugi/data/cards')

    source = pathlib.Path(sys.argv[1]).resolve()
    if source.name != 'cards' or source.parent.name != 'data' or not source.is_dir():
        raise SystemExit('expected the pinned YAML Yugi data/cards directory')

    manifest_path = ROOT / 'public/engine/sources.json'
    manifest = json.loads(manifest_path.read_text(encoding='utf-8'))
    expected = manifest['sources']['KoreanCardCatalog']['commit']
    repository = source.parent.parent
    actual = subprocess.check_output(
        ['git', '-C', str(repository), 'rev-parse', 'HEAD'], text=True
    ).strip()
    if actual != expected:
        raise SystemExit(
            f'YAML Yugi revision mismatch: expected {expected}, got {actual}; '
            'checkout the pinned revision first'
        )

    engine = ROOT / 'public/engine'
    cards = json.loads(gzip.decompress((engine / 'cards.json.gz').read_bytes()))
    translations = {}
    pendulum_effects = {}
    counts = {'name': 0, 'desc': 0, 'pendulum_effect': 0, 'records': 0}

    for path in sorted(source.glob('*.json')):
        card = json.loads(path.read_text(encoding='utf-8'))
        code = card.get('password')
        if code is None:
            continue
        code = str(code)
        if code not in cards:
            continue

        name = normalize_name((card.get('name') or {}).get('ko'))
        desc = normalize_text((card.get('text') or {}).get('ko'))
        pendulum_effect = normalize_text((card.get('pendulum_effect') or {}).get('ko'))
        if not name and not desc and not pendulum_effect:
            continue

        translation = translations.setdefault(code, {})
        if name and translation.get('name') != name:
            counts['name'] += not translation.get('name')
            translation['name'] = name
        if desc and translation.get('desc') != desc:
            counts['desc'] += not translation.get('desc')
            translation['desc'] = desc
        if pendulum_effect:
            pendulum_effects[code] = pendulum_effect
            counts['pendulum_effect'] += 1
        counts['records'] += 1

    if not counts['records']:
        raise SystemExit('No Korean records matched the bundled card data')

    data = json.dumps(translations, ensure_ascii=False, separators=(',', ':')).encode()
    (engine / 'ko.json.gz').write_bytes(gzip.compress(data, mtime=0))
    pendulum_data = json.dumps(pendulum_effects, ensure_ascii=False, separators=(',', ':'))
    (engine / 'ko-pendulum.json').write_text(pendulum_data + '\n', encoding='utf-8')
    print(
        f"Updated {counts['records']} matching Korean records from {expected}; "
        f"added {counts['name']} names, {counts['desc']} effect texts, "
        f"and {counts['pendulum_effect']} Pendulum effects."
    )


if __name__ == '__main__':
    main()
