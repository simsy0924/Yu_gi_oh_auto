"""Input: original part-*.json catalog from repository commit da20f72."""
import gzip, json, pathlib, sys
root=pathlib.Path(__file__).resolve().parents[1]
with gzip.open(root/'public/engine/cards.json.gz', 'rt') as source:
    codes=set(json.load(source))
ko={}
for part in sorted(pathlib.Path(sys.argv[1]).glob('part-*.json')):
    for c in json.loads(part.read_text()):
        if c.get('p') and not c.get('u'):
            ko[str(c['p'])]={'name':c['n'],'desc':c['t']}
if not ko: raise SystemExit('No Korean catalog records found')
# This card was added to the English card database after the Korean catalog
# snapshot was prepared. Keep its official Korean Neuron text in the generated
# bundle for both card IDs (the second ID is an alias of the first).
red_demons_chain = {
    'name': '레드 데몬즈 체인',
    'desc': '이 카드명의 카드는 1턴에 1장밖에 발동할 수 없다. 이 카드는 엑스트라 덱의 "레드 데몬즈 드래곤" 1장을 상대에게 보여주고, 세트한 턴에 발동할 수도 있다. ①: 패의 몬스터를 임의의 수만큼 상대에게 보여주고, 그 중의 튜너의 수 + 1장만 상대 필드의 효과 몬스터를 대상으로 하여 이 카드를 발동할 수 있다. 이 카드가 마법 & 함정 존에 존재하는 한, 대상 몬스터의 공격력은 패에서 보여준 수 × 100 내리고, 효과는 무효화된다. 대상 몬스터가 필드에 존재하지 않을 경우에 이 카드는 파괴된다.'
}
for code in ('92936364', '92936365'):
    if code in codes:
        ko[code] = dict(red_demons_chain)
(root/'public/engine/ko.json.gz').write_bytes(gzip.compress(json.dumps(ko,ensure_ascii=False,separators=(',',':')).encode(),mtime=0))
