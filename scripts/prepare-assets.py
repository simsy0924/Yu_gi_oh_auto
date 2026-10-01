"""Build versioned, same-origin data bundles. Requires Python 3 and git only."""
import gzip, json, pathlib, sqlite3, subprocess, sys
from effect_scripts import collect_effect_scripts
ROOT = pathlib.Path(__file__).resolve().parents[1]
SOURCES = {
    'CardScripts': ('https://github.com/ProjectIgnis/CardScripts.git', '1e28935380407e8f4e5a7edf50875b4b38fe56a6'),
    'BabelCDB': ('https://github.com/ProjectIgnis/BabelCDB.git', '52d5221df32c943877c8a63639edcc4f3d918916'),
}
KOREAN_CARD_CATALOG = (
    'https://github.com/DawnbrandBots/yaml-yugi.git',
    'eb6042f1a33661ca570c29939f7aa70807119857',
)
base = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / '.sources'
base.mkdir(exist_ok=True)
for name, (url, ref) in SOURCES.items():
    path = base / name
    if not path.exists():
        subprocess.run(['git', 'clone', url, str(path)], check=True)
        subprocess.run(['git', '-C', str(path), 'checkout', '--detach', ref], check=True)
    actual = subprocess.check_output(['git', '-C', str(path), 'rev-parse', 'HEAD'], text=True).strip()
    if actual != ref:
        raise SystemExit(f'{name}: expected {ref}, got {actual}; checkout pinned revision first')
out = ROOT / 'public/engine'
out.mkdir(parents=True, exist_ok=True)
def write(name, value):
    data = json.dumps(value, ensure_ascii=False, separators=(',', ':')).encode()
    (out / name).write_bytes(gzip.compress(data, mtime=0))
cards = {}
# Official master-rule cards only. Prerelease is explicit and reproducibly pinned.
for path in [base/'BabelCDB/cards.cdb', *sorted((base/'BabelCDB').glob('prerelease-*.cdb'))]:
    if 'rush' in path.name: continue
    db = sqlite3.connect(path)
    db.row_factory = sqlite3.Row
    texts = {r['id']: dict(r) for r in db.execute('SELECT * FROM texts')}
    for row in db.execute('SELECT * FROM datas'):
        d = dict(row); t = texts[d['id']]; level=d['level']; typ=d['type']
        cards[str(d['id'])] = dict(code=d['id'], alias=d['alias'],
            setcodes=[(d['setcode'] >> i) & 65535 for i in (0,16,32,48) if (d['setcode'] >> i) & 65535],
            type=typ, attack=d['atk'], defense=0 if typ & 0x4000000 else d['def'],
            link_marker=d['def'] if typ & 0x4000000 else 0,
            level=level & 255, lscale=(level >> 24)&255, rscale=(level >> 16)&255,
            race=str(d['race']), attribute=d['attribute'], name=t['name'], desc=t['desc'],
            strings=[t.get(f'str{i}', '') for i in range(1,17)])
    db.close()
scripts, pre_release_count = collect_effect_scripts(base/'CardScripts')
write('cards.json.gz', cards)
write('scripts.json.gz', scripts)
source_manifest = {
    **{key: {'url': url, 'commit': ref} for key, (url, ref) in SOURCES.items()},
    'KoreanCardCatalog': {'url': KOREAN_CARD_CATALOG[0], 'commit': KOREAN_CARD_CATALOG[1]},
    'KoreanEffectStrings': {
        'url': 'https://github.com/Team-AllYGOPro/edopro-korean.git',
        'commit': 'b4a750d9d93efb2b1449608f89c94836b690b389',
    },
}
(out/'sources.json').write_text(json.dumps({
    'ocgcore-wasm': '0.1.2',
    'sources': source_manifest,
    'cards': len(cards),
    'scripts': len(scripts),
}, indent=2)+'\n')
print(f'{len(cards)} cards, {len(scripts)} scripts ({pre_release_count} prerelease Lua files)')
