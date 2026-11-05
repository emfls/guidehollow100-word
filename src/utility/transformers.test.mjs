import test from 'node:test';
import assert from 'node:assert/strict';
import { tools, cleanTrackingURL, mailtoLink, countText, checkFilename, parsePageRange, printCount, downloadSeconds, scaleRecipe, csvCell, manifestCSV, validateFiles, imageDimensions, cleaningRota, lengths } from './transformers.mjs';
const tool = slug => tools.find(t => t.slug === slug);
const fakeFile = (name = 'image.png', size = 100, type = 'image/png') => ({ name, size, type });

test('contract: thirteen unique tools and no more than six main fields', () => {
  assert.deepEqual(tools.map(t => t.slug), ['chrome', 'gmail', 'word', 'windows', 'printer', 'wifi', 'kitchen', 'mac', 'android', 'iphone', 'cleaning', 'fashion', 'pdf']);
  for (const t of tools) { assert(t.fields.length <= 6); assert(t.title); assert(t.fields.every(f => typeof f.required === 'boolean')); }
});
test('chrome removes explicit trackers and preserves literal other query and fragment', () => {
  const input = 'https://example.com/a?x=a%20b&utm_source=x&x=2&gclid=3&fbclid=4&ref=z#fragment';
  assert.equal(tool('chrome').run({ url: input }).text, 'https://example.com/a?x=a%20b&x=2&ref=z#fragment');
  assert.equal(cleanTrackingURL('https://e.com/?UTM_medium=x&%67clid=y#utm_source=kept'), 'https://e.com/#utm_source=kept');
  assert.equal(cleanTrackingURL('https://e.com/?a=%XX&utm_source=x'), 'https://e.com/?a=%XX');
  assert.throws(() => cleanTrackingURL('javascript:alert(1)'));
  assert.throws(() => cleanTrackingURL('https://e.com/' + 'x'.repeat(200001)));
});
test('gmail escapes query delimiters and keeps plain confirmation text', () => {
  const result = tool('gmail').run({ to: 'a+b@example.com', subject: '한글 & ?#', body: '<script>\n줄' });
  assert(result.text.includes('mailto:a%2Bb%40example.com?subject='));
  assert(result.text.includes('%26%20%3F%23'));
  assert(result.text.includes('본문:\n<script>\n줄'));
  assert.equal(mailtoLink('a@example.com', '', ''), 'mailto:a%40example.com?subject=&body=');
  assert.throws(() => tool('gmail').run({ to: 'a@example.com?bcc=x', subject: '', body: '' }));
});
test('word counts code points, whitespace and lines, without linguistic word claims', () => {
  assert.deepEqual(countText('가 나\n😀'), { characters: 5, compact: 3, lines: 2, segments: 3 });
  assert.match(tool('word').run({ text: '한글 두 덩어리' }).text, /공백 구분 덩어리 수: 3/);
  assert.throws(() => countText(''));
});
test('windows reports reserved, invalid and trailing names without changing inputs', () => {
  assert.deepEqual(checkFilename('보고서.txt'), []);
  for (const name of ['CON', 'prn.txt', 'AUX', 'NUL', 'COM9.log', 'LPT1.txt', 'CON .txt', 'bad?.txt', 'bad\u0001.txt', 'tail.', 'tail ']) {
    assert(checkFilename(name).length > 0, name);
  }
  assert(checkFilename('😀'.repeat(128)).length > 0);
  const output = tool('windows').run({ names: '보고서.txt\nCON\ntail ' }).text;
  assert.match(output, /"보고서.txt": 사용 가능/); assert(output.includes('"tail "'));
  assert.throws(() => tool('windows').run({ names: ' ' }));
});
test('printer deduplicates ranges and rounds duplex separately for each copy', () => {
  assert.deepEqual(printCount('1-3,3', '5', '2', 'duplex'), { pages: [1, 2, 3], copies: 2, sheets: 4 });
  assert.match(tool('printer').run({ total: '5', range: '1-3,5', copies: '2', mode: 'simplex' }).text, /필요 용지: 8장/);
  for (const range of ['0', '6', '3-1', '1,,2', '1-2-3', '']) assert.throws(() => parsePageRange(range, '5'));
  assert.throws(() => printCount('1', '5', '', 'duplex'));
  assert.throws(() => printCount('1', '5', '1', 'bad'));
});
test('wifi uses eight bits per byte, efficiency and numeric bounds', () => {
  assert.equal(downloadSeconds('100', '100', '80'), 10);
  assert.match(tool('wifi').run({ size: '100', rate: '100', efficiency: '100' }).text, /8초/);
  for (const args of [['100', '0', '100'], ['100', '10', '101'], ['', '10', '100'], ['1e3', '10', '100']]) assert.throws(() => downloadSeconds(...args));
});
test('kitchen scales decimals and rejects fractions or ambiguous units in amount', () => {
  assert.deepEqual(scaleRecipe('2', '3', '밀가루,200,g\n우유,0.5,L'), [{ name: '밀가루', amount: 300, unit: 'g' }, { name: '우유', amount: 0.75, unit: 'L' }]);
  assert.equal(tool('kitchen').run({ current: '2', target: '4', ingredients: '소금,1.5,g' }).text, '소금: 3 g');
  for (const ingredients of ['밀가루,1/2,g', '우유,한 컵,컵', '설탕,1-2,g', '이름,,g', '이름,1,']) assert.throws(() => scaleRecipe('2', '3', ingredients));
  assert.throws(() => scaleRecipe('0', '2', '밀가루,200,g'));
});
test('mac metadata manifest escapes CSV formulas, commas and quotes; enforces 20MB', () => {
  assert.equal(csvCell('=SUM(1)'), '"\'=SUM(1)"');
  assert.equal(csvCell(' \t+1'), '"\' \t+1"');
  const result = tool('mac').run({ files: [fakeFile('a,"b.txt', 42, 'text/plain'), fakeFile('=1.txt')] });
  assert.match(result.download.content, /"a,""b.txt","42","text\/plain"/);
  assert.match(result.download.content, /"'=1.txt"/);
  assert.throws(() => manifestCSV([]));
  assert.throws(() => manifestCSV([fakeFile('a', 20 * 1024 * 1024 + 1)]));
  assert.throws(() => manifestCSV([fakeFile('a', 11 * 1024 * 1024), fakeFile('b', 11 * 1024 * 1024)]));
});
test('image helpers preserve ratio, avoid upscaling and reject resource bounds', () => {
  assert.deepEqual(imageDimensions(4000, 2000, 1200), { width: 1200, height: 600 });
  assert.deepEqual(imageDimensions(100, 50, 1200), { width: 100, height: 50 });
  assert.throws(() => imageDimensions(5000, 4000, 1200));
  assert.throws(() => imageDimensions(1, 1, 4097));
  assert.throws(() => validateFiles([fakeFile('a.png', 5 * 1024 * 1024 + 1)], true));
  assert.throws(() => validateFiles([fakeFile('a.HEIC', 1, 'image/heic')], true), /HEIC/);
  assert.throws(() => validateFiles([fakeFile('a.svg', 1, 'image/svg+xml')], true));
});
test('android produces PNG Canvas export and validates width/browser support', async () => {
  assert.throws(() => tool('android').run({ files: [fakeFile()], width: '0' }));
  await assert.rejects(tool('android').run({ files: [fakeFile()], width: '1200' }), /브라우저/);
  const calls = [];
  const oldDocument = globalThis.document; const oldBitmap = globalThis.createImageBitmap;
  globalThis.createImageBitmap = async () => ({ width: 4000, height: 2000, close() { calls.push('closed'); } });
  globalThis.document = { createElement: () => ({ getContext: () => ({ drawImage: (...args) => calls.push(args.slice(-2)) }), toBlob: (fn, type) => fn(new Blob(['png'], { type })) }) };
  try {
    const result = await tool('android').run({ files: [fakeFile()], width: '1200' });
    assert.equal(result.download.type, 'image/png'); assert.equal(result.download.content.type, 'image/png');
    assert.match(result.text, /1200 × 600px/); assert.deepEqual(calls[0], [1200, 600]); assert.equal(calls[1], 'closed');
  } finally { if (oldDocument === undefined) delete globalThis.document; else globalThis.document = oldDocument; if (oldBitmap === undefined) delete globalThis.createImageBitmap; else globalThis.createImageBitmap = oldBitmap; }
});
test('iphone requests actual JPEG export, applies quality and white background', async () => {
  await assert.rejects(tool('iphone').run({ files: [fakeFile('a.heic', 5, 'image/heic')], format: 'image/jpeg', quality: '85' }), /HEIC/);
  assert.throws(() => tool('iphone').run({ files: [fakeFile()], format: 'bad', quality: '85' }));
  const calls = []; const oldDocument = globalThis.document; const oldBitmap = globalThis.createImageBitmap;
  globalThis.createImageBitmap = async () => ({ width: 80, height: 50, close() {} });
  globalThis.document = { createElement: () => ({ getContext: () => ({ fillRect: () => calls.push('white'), drawImage: () => calls.push('draw') }), toBlob: (fn, type, quality) => { calls.push([type, quality]); fn(new Blob(['jpg'], { type })); } }) };
  try {
    const result = await tool('iphone').run({ files: [fakeFile()], format: 'image/jpeg', quality: '90' });
    assert.equal(result.download.name, 'converted.jpg'); assert.equal(result.download.content.type, 'image/jpeg');
    assert.deepEqual(calls, ['white', 'draw', ['image/jpeg', 0.9]]);
    assert.throws(() => tool('iphone').run({ files: [fakeFile()], format: 'image/png', quality: '101' }));
  } finally { if (oldDocument === undefined) delete globalThis.document; else globalThis.document = oldDocument; if (oldBitmap === undefined) delete globalThis.createImageBitmap; else globalThis.createImageBitmap = oldBitmap; }
});
test('cleaning rota allocates tasks evenly, crosses leap day, and escapes CSV', () => {
  const rota = cleaningRota('2028-02-28', '3', '가\n나', '바닥');
  assert.deepEqual(rota, [['2028-02-28', '바닥', '가'], ['2028-02-29', '바닥', '나'], ['2028-03-01', '바닥', '가']]);
  const multi = cleaningRota('2026-01-01', '2', '가\n나\n다', '바닥\n창문');
  assert.deepEqual(multi.map(r => r[2]), ['가', '나', '나', '다']);
  assert.deepEqual(cleaningRota('2026-01-01', '2', '가\n나', '바닥\n창문').map(r => r[2]), ['가', '나', '나', '가']);
  const output = tool('cleaning').run({ start: '2026-12-31', days: '2', people: '가\n나', tasks: '=청소' });
  assert.match(output.text, /2027-01-01/); assert.match(output.download.content, /"'=청소"/);
  assert.throws(() => cleaningRota('2026-02-29', '1', '가', '청소'));
  assert.throws(() => cleaningRota('2026-01-01', '32', '가', '청소'));
  assert.throws(() => cleaningRota('2026-01-01', '1', '가\n가', '청소'));
  assert.throws(() => cleaningRota('2026-01-01', '1', '가\n\n나', '청소'));
  assert.throws(() => cleaningRota('2026-01-01', '1', '가', '청소\n청소'));
  assert.throws(() => cleaningRota('9999-12-31', '2', '가', '청소'));
});
test('fashion converts lengths rather than recommending brand sizes', () => {
  assert.deepEqual(lengths('허리,76.2'), [{ label: '허리', cm: 76.2, inches: 30 }]);
  assert.match(tool('fashion').run({ rows: '허리,76.2' }).text, /76.2 cm = 30 inch/);
  assert.throws(() => lengths('허리,M'));
  assert.throws(() => lengths('허리,-2'));
});
test('pdf planner normalizes unique pages, reverse order and exclusions in TXT', () => {
  const result = tool('pdf').run({ total: '6', range: '5,1-3,2' });
  assert.match(result.text, /선택 \(4페이지\): 1, 2, 3, 5/);
  assert.match(result.text, /선택 역순: 5, 3, 2, 1/);
  assert.match(result.text, /제외: 4, 6/); assert.equal(result.download.content, result.text);
  assert.throws(() => tool('pdf').run({ total: '6', range: '7' }));
  assert.throws(() => tool('pdf').run({ total: '10001', range: '1' }));
});
