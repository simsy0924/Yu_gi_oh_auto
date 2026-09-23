"""Build Korean effect-choice text from a pinned EDOPro Korean cards.cdb.

Usage: python3 scripts/prepare-ko-strings.py /path/to/edopro-korean/cards.cdb
The source revision is recorded in README.md and public/engine/sources.json.
"""
import gzip
import json
import pathlib
import sqlite3
import subprocess
import sys

root = pathlib.Path(__file__).resolve().parents[1]
source = pathlib.Path(sys.argv[1])
expected = 'b4a750d9d93efb2b1449608f89c94836b690b389'
actual = subprocess.check_output(['git', '-C', str(source.parent), 'rev-parse', 'HEAD'], text=True).strip()
if actual != expected:
    raise SystemExit(f'Korean database revision mismatch: expected {expected}, got {actual}')
with gzip.open(root / 'public/engine/cards.json.gz', 'rt') as bundle:
    codes = set(json.load(bundle))
with sqlite3.connect(source) as db:
    strings = {
        str(code): [text or '' for text in values]
        for code, *values in db.execute(
            'SELECT id, ' + ', '.join(f'str{i}' for i in range(1, 17)) + ' FROM texts'
        )
        if str(code) in codes and any(values)
    }
if not strings:
    raise SystemExit('No matching Korean effect strings found')
data = json.dumps(strings, ensure_ascii=False, separators=(',', ':')).encode()
(root / 'public/engine/ko-strings.json.gz').write_bytes(gzip.compress(data, mtime=0))
print(f'{len(strings)} cards with Korean effect strings')
