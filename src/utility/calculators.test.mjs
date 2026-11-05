import test from 'node:test';
import assert from 'node:assert/strict';
import { tools } from './calculators.mjs';
const cases = {
  babycare: [{ stock: '100', daily: '6' }, /16\.67일분[\s\S]*16일/],
  bicycle: [{ distance: '20', minutes: '60' }, /20 km\/h[\s\S]*3분 0초\/km/],
  carcare: [{ distance: '150', efficiency: '15', price: '1700' }, /10 L[\s\S]*17,000원/],
  coffee: [{ coffee: '20', ratio: '15' }, /300 g[\s\S]*1:15/],
  diy: [{ width: '3', length: '4', tileWidth: '30', tileLength: '30', extra: '10' }, /12 m²[\s\S]*147개/],
  laundry: [{ power: '500', minutes: '60', washes: '10', rate: '200' }, /5 kWh[\s\S]*1,000원/],
  moving: [{ volume: '101', box: '50', fill: '80' }, /3개/],
  pets: [{ name: '나비', food: '제품 라벨대로 준비', routine: '산책 후 발 닦기', contact: '' }, /나비[\s\S]*제품 라벨대로 준비/],
  photography: [{ width: '10', height: '15', dpi: '300' }, /1182 × 1772 px/],
  plants: [{ next: '2024-02-28', interval: '1', count: '3' }, /2024-02-28\n2024-02-29\n2024-03-01/],
  powerpoint: [{ width: '1920', height: '1080' }, /16:9[\s\S]*16:9/],
  skincare: [{ opened: '2024-01-31', months: '1' }, /2024-02-29/],
  stationery: [{ width: '50', height: '30', margin: '10', gap: '2' }, /3열 × 8행 = 24개/],
  storage: [{ files: [] }, /중복 그룹/],
  travel: [{ people: '2', nights: '2', room: '100000', transport: '50000', food: '30000' }, /2박 3일[\s\S]*430,000원[\s\S]*215,000원/],
};
const run = (slug, override = {}) => tools.find(t => t.slug === slug).run({ ...cases[slug][0], ...override });
test('all 15 exact unique slugs and contract fields', () => {
  assert.deepEqual(tools.map(t => t.slug).sort(), Object.keys(cases).sort());
  assert.equal(new Set(tools.map(t => t.slug)).size, 15);
  for (const t of tools) { assert.ok(t.fields.length <= 6); assert.ok(t.title && t.description); }
});
for (const t of tools.filter(t => !['pets', 'storage'].includes(t.slug))) {
  test(`${t.slug}: useful expected output`, () => assert.match(run(t.slug).text, cases[t.slug][1]));
  test(`${t.slug}: every field rejects missing, invalid, huge inputs`, () => {
    for (const f of t.fields) {
      for (const value of ['', ' ', 'oops', 'Infinity', '1e999', '<script>', '9'.repeat(80)]) assert.throws(() => run(t.slug, { [f.name]: value }), Error);
      assert.throws(() => run(t.slug, { [f.name]: undefined }), Error);
      assert.throws(() => run(t.slug, { [f.name]: 12 }), Error);
      if (f.type === 'number') {
        assert.throws(() => run(t.slug, { [f.name]: '-1' }), Error);
        assert.throws(() => run(t.slug, { [f.name]: String(f.max + 1) }), Error);
        if (f.min > 0) assert.throws(() => run(t.slug, { [f.name]: '0' }), Error);
        if (f.step === 1) assert.throws(() => run(t.slug, { [f.name]: '1.5' }), Error);
      }
    }
  });
}
test('babycare rounds fractional day down for full days', () => assert.match(run('babycare', { stock: '1', daily: '2' }).text, /0\.5일분[\s\S]*0일/));
test('bicycle carries seconds rounded to60 into next minute', () => assert.match(run('bicycle', { distance: '1', minutes: '1.999' }).text, /2분 0초/));
test('carcare rounds won', () => assert.match(run('carcare', { distance: '1', efficiency: '3', price: '100' }).text, /33원/));
test('coffee accepts decimal grams', () => assert.match(run('coffee', { coffee: '12.5', ratio: '16' }).text, /200 g/));
test('diy no extra and exact tile count', () => assert.match(run('diy', { width: '1', length: '1', tileWidth: '50', tileLength: '50', extra: '0' }).text, /4개/));
test('diy rejects impractical output count', () => assert.throws(() => run('diy', { tileWidth: '0.000001', tileLength: '0.000001' })));
test('laundry converts minutes', () => assert.match(run('laundry', { power: '1000', minutes: '30', washes: '1', rate: '101' }).text, /0\.5 kWh[\s\S]*51원/));
test('moving exact capacity and fill upper bound', () => { assert.match(run('moving', { volume: '100', box: '50', fill: '100' }).text, /2개/); assert.throws(() => run('moving', { fill: '100.1' })); });

test('photography exact inches require no extra pixel', () => assert.match(run('photography', { width: '2.54', height: '5.08', dpi: '100' }).text, /100 × 200 px/));
test('plants ICS uses date-only events and exclusive following day end', () => {
  const result = run('plants');
  assert.equal(result.download.name, 'watering-schedule.ics');
  assert.match(result.download.content, /DTSTART;VALUE=DATE:20240229\r\nDTEND;VALUE=DATE:20240301/);
  assert.equal((result.download.content.match(/BEGIN:VEVENT/g) || []).length, 3);
  assert.ok(result.download.content.endsWith('END:VCALENDAR\r\n'));
  assert.doesNotMatch(result.download.content, /TZID/);
});
test('plants date validity, horizon and year rollover', () => {
  for (const next of ['2023-02-29', '2024-04-31', '1899-12-31', '2101-01-01']) assert.throws(() => run('plants', { next }));
  assert.throws(() => run('plants', { next: '2100-12-31', count: '1' }));
  assert.match(run('plants', { next: '2026-12-31', count: '2' }).text, /2027-01-01/);
});
test('powerpoint exact GCD, nearest4:3 and tie', () => {
  assert.match(run('powerpoint', { width: '1200', height: '900' }).text, /정확한 화면 비율: 4:3[\s\S]*표준 비율: 4:3/);
  assert.match(run('powerpoint', { width: '14', height: '9' }).text, /14:9[\s\S]*동률/);
  assert.match(run('powerpoint', { width: '997', height: '1000' }).text, /997:1000/);
});
test('skincare clamps month end in leap and common years withyear carry', () => {
  assert.match(run('skincare', { opened: '2023-01-31' }).text, /2023-02-28/);
  assert.match(run('skincare', { opened: '2024-02-29', months: '12' }).text, /2025-02-28/);
  assert.match(run('skincare', { opened: '2026-12-15', months: '2' }).text, /2027-02-15/);
  assert.throws(() => run('skincare', { opened: '2026-02-30' }));
  assert.throws(() => run('skincare', { opened: '2100-12-31' }));
});
test('stationery exact fit, gaps and no fit', () => {
  assert.match(run('stationery', { width: '210', height: '297', margin: '0', gap: '0' }).text, /1열 × 1행 = 1개/);
  assert.match(run('stationery', { width: '210', margin: '1' }).text, /0개/);
  assert.match(run('stationery', { width: '100', height: '297', margin: '0', gap: '10' }).text, /2열 × 1행 = 2개/);
});
test('travel permits daytrip zero costs withone food day', () => {
  assert.match(run('travel', { nights: '0', room: '0', transport: '0', food: '10000' }).text, /0박 1일[\s\S]*총예산: 20,000원/);
  assert.match(run('travel', { room: '0', transport: '0', food: '0' }).text, /총예산: 0원/);
});

test('pets generates literal user instructions anddownload', () => {
  const result = run('pets', { name: '<나비>', contact: '보호자 010-0000-0000' });
  assert.match(result.text, /<나비>[\s\S]*제품 라벨대로 준비[\s\S]*산책 후 발 닦기[\s\S]*보호자/);
  assert.equal(result.download.content, result.text);
  assert.equal(result.download.name, 'pet-care-handover.txt');
  assert.doesNotMatch(run('pets').text, /연락처:/);
});
test('pets rejects blank, nontext, oversized andcontrol input', () => {
  for (const key of ['name', 'food', 'routine']) for (const value of ['', ' ', undefined, 123, 'x'.repeat(10001), '\u0000']) assert.throws(() => run('pets', { [key]: value }));
  assert.throws(() => run('pets', { name: 'x'.repeat(101) }));
  assert.throws(() => run('pets', { contact: 'x'.repeat(501) }));
  assert.throws(() => run('pets', { contact: ' ' }));
});
const file = (name, contents) => new File([contents], name);
test('storage hashes contents, namesalone do not imply duplicates', async () => {
  const result = await run('storage', { files: [file('<same>.txt', 'abc'), file('different.txt', 'abc'), file('<same>.txt', 'abd')] });
  assert.match(result.text, /비교한 파일: 3개[\s\S]*중복 그룹: 1개[\s\S]*<same>\.txt[\s\S]*different\.txt/);
  assert.equal((result.text.match(/• /g) || []).length, 2);
});
test('storage no duplicate, emptyfiles andmultiplegroups', async () => {
  assert.match((await run('storage', { files: [file('a', 'a'), file('b', 'b')] })).text, /중복 그룹: 0개/);
  const result = await run('storage', { files: [file('a', ''), file('b', ''), file('c', '1'), file('d', '1')] });
  assert.match(result.text, /중복 그룹: 2개/);
});
test('storage validates counts, per-file and total bounds before reading', async () => {
  for (const files of [undefined, 'files', [], [file('a', '')], Array(26).fill(file('a', '')), [null, null]]) await assert.rejects(() => run('storage', { files }));
  const fake = size => ({ name: 'x', size, arrayBuffer() { throw Error('should not read'); } });
  await assert.rejects(() => run('storage', { files: [fake(20_000_000 + 1), fake(0)] }), /20MB/);
  await assert.rejects(() => run('storage', { files: Array(6).fill(fake(20_000_000)) }), /100MB/);
  await assert.rejects(() => run('storage', { files: [fake(-1), fake(0)] }), /유효한 파일/);
  await assert.rejects(() => run('storage', { files: [{ name: 'x', size: 1, arrayBuffer: async () => new ArrayBuffer(0) }, file('b', '')] }), /읽지 못했/);
});

test('stationery decimal near-fit does not incorrectly add a column', () => {
  assert.match(run('stationery', { width: '105.00000000001', height: '297', margin: '0', gap: '0' }).text, /1열 × 1행 = 1개/);
  assert.match(run('stationery', { width: '0.21', height: '0.297', margin: '0', gap: '0' }).text, /1000열 × 1000행 = 1000000개/);
});

test('moving exact decimal division does not add a false box', () => {
  assert.match(run('moving', { volume: '0.07', box: '0.01', fill: '100' }).text, /필요 상자: 7개/);
  assert.match(run('moving', { volume: '0.070000000000000000001', box: '0.01', fill: '100' }).text, /필요 상자: 8개/);
  assert.match(run('moving', { volume: '7E-2', box: '+.01', fill: '100' }).text, /필요 상자: 7개/);
});
test('diy exact decimal area and percentage preserve integer and true fraction', () => {
  const dimensions = { width: '0.07', length: '0.1', tileWidth: '1', tileLength: '10', extra: '0' };
  assert.match(run('diy', dimensions).text, /필요 타일: 7개/);
  assert.match(run('diy', { ...dimensions, width: '0.070000000000000000001' }).text, /필요 타일: 8개/);
  assert.match(run('diy', { width: '0.1', length: '0.1', tileWidth: '1', tileLength: '10', extra: '10' }).text, /필요 타일: 11개/);
  assert.match(run('diy', { width: '0.1', length: '0.1', tileWidth: '1', tileLength: '10', extra: '10.000000000000000001' }).text, /필요 타일: 12개/);
  assert.match(run('diy', { ...dimensions, extra: '0e-9999999' }).text, /필요 타일: 7개/);
});
test('photography exact centimeter-inch ratio ceilings without tolerance', () => {
  assert.match(run('photography', { width: '2.54', height: '5.08', dpi: '300' }).text, /300 × 600 px/);
  assert.match(run('photography', { width: '2.54000000000000000001', height: '5.08', dpi: '300' }).text, /301 × 600 px/);
});
test('skincare user wording describes ordinary calendar dates', () => assert.doesNotMatch(run('skincare').text, /UTC/));

test('nonzero numeric underflow cannot silently become zero extra', () => assert.throws(() => run('diy', { extra: '1e-9999999' })));

test('stationery preserves raw decimal precision on either side of exact fit', () => {
  const dimensions = { height: '297', margin: '0', gap: '0' };
  assert.match(run('stationery', { ...dimensions, width: '105.000000000000000001' }).text, /1열 × 1행 = 1개/);
  assert.match(run('stationery', { ...dimensions, width: '104.999999999999999999' }).text, /2열 × 1행 = 2개/);
  assert.match(run('stationery', { ...dimensions, width: '105' }).text, /2열 × 1행 = 2개/);
});
