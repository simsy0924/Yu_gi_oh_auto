import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {applyCatalogTranslations} from '../src/catalog.js';

const cards=JSON.parse(gunzipSync(readFileSync('public/engine/cards.json.gz')));
const translations=JSON.parse(gunzipSync(readFileSync('public/engine/ko.json.gz')));
const sources=JSON.parse(readFileSync('public/engine/sources.json'));

test('the pinned Korean catalog adds newly localized Korean cards',()=>{
  const code='89875646';
  const catalog=applyCatalogTranslations({[code]:{...cards[code]}},{...translations});
  assert.equal(catalog[code].name,'트리플 바렐 리볼브');
  assert.ok(catalog[code].desc.includes('바렛'));
});

test('Korean catalog text is normalized for the escaped card UI',()=>{
  const card=translations['19891310'];
  assert.equal(card.name,'기아기아기아 XG');
  assert.ok(card.desc.includes('\n'));
  assert.doesNotMatch(`${card.name}\n${card.desc}`,/<\/?(?:ruby|rt|br)>/i);
});

test('the bundled Korean catalog records its exact upstream revision',()=>{
  assert.equal(
    sources.sources.KoreanCardCatalog.commit,
    'eb6042f1a33661ca570c29939f7aa70807119857'
  );
});
