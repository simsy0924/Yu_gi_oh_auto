"""Report Korean-name and card-text coverage for the bundled deck catalog."""
import gzip
import json
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
ENGINE = ROOT / 'public/engine'
cards = json.loads(gzip.decompress((ENGINE / 'cards.json.gz').read_bytes()))
translations = json.loads(gzip.decompress((ENGINE / 'ko.json.gz').read_bytes()))
overrides = json.loads((ENGINE / 'ko-overrides.json').read_text(encoding='utf-8'))
for code, override in overrides.items():
    translations[code] = {**translations.get(code, {}), **override}

records = []
deckable_records = []
for code, card in cards.items():
    translation = translations.get(code, {})
    name = translation.get('name')
    desc = translation.get('desc')
    alias = str(card.get('alias') or '')
    alias_card = cards.get(alias)
    alias_translation = translations.get(alias, {})
    if not name and alias_card and alias_card.get('name') == card.get('name'):
        name = alias_translation.get('name')
        if not desc and alias_card.get('desc') == card.get('desc'):
            desc = alias_translation.get('desc')
    card_type = int(card.get('type', 0))
    deckable = not (card_type & 0x4000) and bool(card_type & 7)
    record = {
        'code': int(card.get('code', code)),
        'english_name': card.get('englishName') or card.get('name') or '',
        'has_korean_name': bool(name),
        'has_korean_text': bool(desc) or not bool(card.get('desc')),
        'source_has_text': bool(card.get('desc')),
        'alias': int(alias) if alias.isdigit() else None,
        'setcodes': card.get('setcodes', []),
    }
    records.append(record)
    if deckable:
        deckable_records.append(record)


def report(label, rows):
    name_count = sum(record['has_korean_name'] for record in rows)
    text_rows = [record for record in rows if record['source_has_text']]
    text_count = sum(record['has_korean_text'] for record in text_rows)
    print(f"{label}: {len(rows)}")
    print(f"Korean names: {name_count}; missing names: {len(rows) - name_count}")
    print(f"Korean effect text: {text_count}/{len(text_rows)}; missing text: {len(text_rows) - text_count}")


report('Catalog records', records)
report('Deckable cards', deckable_records)

if '--list' in sys.argv[1:]:
    for record in records:
        if not record['has_korean_name'] or not record['has_korean_text']:
            print(json.dumps(record, ensure_ascii=False))
