// Backport upstream 3c7d293's wasm32 CardData offsets to published 0.1.2.
// The upstream npm release currently predates this fix. Fail closed if it changes.
import {readFileSync,writeFileSync} from 'node:fs';
const path='node_modules/ocgcore-wasm/dist/index.js';
let source=readFileSync(path,'utf8');
const from='e.setUint32(48,t.rscale??0,!0),e.setUint32(52,t.link_marker??0,!0)';
const to='e.setUint32(44,t.rscale??0,!0),e.setUint32(48,t.link_marker??0,!0)';
if(source.includes(from))source=source.replace(from,to);
else if(!source.includes(to))throw new Error('Unknown ocgcore-wasm CardData layout; review upstream before upgrading.');
writeFileSync(path,source);
// Backport upstream 1dabded's SELECT_SUM decoder so unsupported sum prompts
// stop cleanly instead of desynchronizing the following engine messages.
const sumFrom='selects:Array.from({length:e.u32()},()=>({code:e.u32(),controller:e.u8(),location:e.u8(),sequence:e.u32(),amount:e.u32()})),selects_must:Array.from({length:e.u32()},()=>({code:e.u32(),controller:e.u8(),location:e.u8(),sequence:e.u32(),amount:e.u32()}))';
const sumTo='selects_must:Array.from({length:e.u32()},()=>({code:e.u32(),...p(e),amount:e.u32()})),selects:Array.from({length:e.u32()},()=>({code:e.u32(),...p(e),amount:e.u32()}))';
if(source.includes(sumFrom))source=source.replace(sumFrom,sumTo);
else if(!source.includes(sumTo))throw new Error('Unknown SELECT_SUM decoder; review upstream.');
writeFileSync(path,source);
