import test from 'node:test';
import assert from 'node:assert/strict';
import {packingList} from './camping.mjs';
test('camping makes an actual adjusted checklist and downloadable artifact',()=>{
 const r=packingList({people:'3',nights:'2',weather:'rain'});
 assert.match(r.text,/갈아입을 옷 9벌/);assert.match(r.text,/우비·방수 가방 3인분/);
 assert.equal(r.download.content,r.text);
 assert.doesNotMatch(packingList({people:'1',nights:'1',weather:'mild'}).text,/방수포/);
 assert.match(packingList({people:'1',nights:'1',weather:'cold'}).text,/보온 옷/);
});
test('camping rejects missing, fractional, infinite, oversized inputs and unknown weather',()=>{
 for(const people of ['', '0','-1','1.5','Infinity','51'])assert.throws(()=>packingList({people,nights:'1',weather:'mild'}));
 assert.throws(()=>packingList({people:'1',nights:'31',weather:'mild'}));
 assert.throws(()=>packingList({people:'1',nights:'1',weather:'<img>'}));
});
