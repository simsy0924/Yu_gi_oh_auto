"""Input: original part-*.json catalog from repository commit da20f72."""
import gzip, json, pathlib, sys
root=pathlib.Path(__file__).resolve().parents[1]
ko={}
for part in sorted(pathlib.Path(sys.argv[1]).glob('part-*.json')):
    for c in json.loads(part.read_text()):
        if c.get('p') and not c.get('u'):
            ko[str(c['p'])]={'name':c['n'],'desc':c['t']}
if not ko: raise SystemExit('No Korean catalog records found')
(root/'public/engine/ko.json.gz').write_bytes(gzip.compress(json.dumps(ko,ensure_ascii=False,separators=(',',':')).encode(),mtime=0))
