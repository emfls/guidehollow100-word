const fmt = (n, digits = 2) => n.toLocaleString('ko-KR', { maximumFractionDigits: digits });
function num(v, name, { min = 0.000001, max = 1e9, integer = false } = {}) {
  const raw = v[name];
  if (typeof raw !== 'string' || !raw.trim() || raw.length > 64 || !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(raw.trim())) throw Error('숫자를 올바르게 입력하세요.');
  const n = Number(raw);
  if (!Number.isFinite(n) || (n === 0 && /[1-9]/.test(raw.trim().split(/[eE]/)[0])) || n < min || n > max || (integer && !Number.isInteger(n))) throw Error('입력 범위와 정수 조건을 확인하세요.');
  return n;
}
function date(v, name) {
  const s = v[name];
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s) || s < '1900-01-01' || s > '2100-12-31') throw Error('1900~2100년의 유효한 날짜를 입력하세요.');
  const d = new Date(s + 'T00:00:00Z');
  if (!Number.isFinite(+d) || d.toISOString().slice(0, 10) !== s) throw Error('유효한 날짜를 입력하세요.');
  return d;
}
const iso = d => d.toISOString().slice(0, 10);
const addDays = (d, n) => new Date(+d + n * 86400000);
const field = (name, label, settings = {}) => ({ name, label, type: 'number', required: true, min: 0.000001, max: 1e9, step: 'any', ...settings });
const count = (name, label, settings = {}) => field(name, label, { min: 1, step: 1, ...settings });
const day = (name, label) => ({ name, label, type: 'date', required: true, min: '1900-01-01', max: '2100-12-31' });
const tool = (slug, title, description, fields, run) => ({ slug, title, description, fields, run });
function decimalIntegers(values) {
  const parts = values.map(value => {
    const [mantissa, exponent = '0'] = (Number(value) === 0 ? '0' : String(value).trim().toLowerCase()).split('e');
    const [whole, fraction = ''] = mantissa.split('.');
    return { digits: BigInt(whole + fraction), places: fraction.length - Number(exponent) };
  });
  const places = Math.max(0, ...parts.map(part => part.places));
  return [10n ** BigInt(places), ...parts.map(part => part.digits * 10n ** BigInt(places - part.places))];
}

const ceilRatio = (numerator, denominator) => (numerator + denominator - 1n) / denominator;

export const tools = [
  tool('babycare', '기저귀 재고 사용 일수', '현재 재고와 하루 사용량으로 예상 소진 기간을 계산합니다.', [count('stock', '재고 (개)'), count('daily', '하루 사용량 (개)')], v => {
    const days = num(v, 'stock', { integer: true }) / num(v, 'daily', { integer: true });
    return { text: `기저귀 재고: 약 ${fmt(days)}일분\n온전히 사용할 수 있는 기간: ${Math.floor(days)}일` };
  }),
  tool('bicycle', '자전거 평균 속도와 페이스', '이동 거리와 총 소요 시간 기준의 평균값입니다.', [field('distance', '거리 (km)'), field('minutes', '시간 (분)')], v => {
    const km = num(v, 'distance'), minutes = num(v, 'minutes');
    const seconds = Math.round(minutes / km * 60);
    return { text: `평균 속도: ${fmt(km / minutes * 60)} km/h\n평균 페이스: ${Math.floor(seconds / 60)}분 ${seconds % 60}초/km (초 단위 반올림)` };
  }),
  tool('carcare', '자동차 여행 연료비', '입력한 연비가 유지된다고 가정한 예상 연료비입니다.', [field('distance', '주행 거리 (km)'), field('efficiency', '연비 (km/L)'), field('price', '유류 가격 (원/L)')], v => {
    const liters = num(v, 'distance') / num(v, 'efficiency');
    return { text: `예상 연료: ${fmt(liters, 3)} L\n예상 연료비: ${fmt(liters * num(v, 'price'), 0)}원 (원 단위 반올림)` };
  }),
  tool('coffee', '커피 추출 물 비율', '원두 1g당 물 비율로 물 무게를 계산합니다.', [field('coffee', '원두 (g)'), field('ratio', '원두 1g당 물 (g)', { max: 100 })], v => ({ text: `필요한 물: ${fmt(num(v, 'coffee') * num(v, 'ratio', { max: 100 }))} g\n원두:물 = 1:${fmt(num(v, 'ratio', { max: 100 }))}` })),
  tool('diy', '바닥 타일 필요 수량', '전체 면적 기준의 수량이며 절단 배치나 무늬 맞춤은 반영하지 않습니다.', [field('width', '방 너비 (m)', { max: 10000 }), field('length', '방 길이 (m)', { max: 10000 }), field('tileWidth', '타일 너비 (cm)', { max: 10000 }), field('tileLength', '타일 길이 (cm)', { max: 10000 }), field('extra', '여유분 (%)', { min: 0, max: 100 })], v => {
    const area = num(v, 'width', { max: 10000 }) * num(v, 'length', { max: 10000 });
    num(v, 'tileWidth', { max: 10000 }); num(v, 'tileLength', { max: 10000 }); num(v, 'extra', { min: 0, max: 100 });
    const [unit, width, length, tileWidth, tileLength, extra] = decimalIntegers([v.width, v.length, v.tileWidth, v.tileLength, v.extra]);
    const quantity = ceilRatio(width * length * 10000n * (100n * unit + extra), tileWidth * tileLength * 100n * unit);
    if (quantity > 1000000000n) throw Error('계산 수량이 너무 큽니다. 치수와 단위를 확인하세요.');
    return { text: `방 면적: ${fmt(area)} m²\n필요 타일: ${quantity}개 (여유분 적용 후 올림)\n면적 추정치이며 절단·파손·배치 조건에 따라 달라집니다.` };
  }),
  tool('laundry', '세탁 전력 사용량과 비용', '입력 전력이 세탁 내내 일정하다는 가정이며 누진요금과 부가요금은 제외합니다.', [field('power', '소비전력 (W)'), field('minutes', '1회 세탁 시간 (분)'), count('washes', '세탁 횟수 (회)'), field('rate', '전기 단가 (원/kWh)')], v => {
    const kwh = num(v, 'power') / 1000 * num(v, 'minutes') / 60 * num(v, 'washes', { integer: true });
    return { text: `전력 사용량: ${fmt(kwh, 3)} kWh\n예상 전력 비용: ${fmt(kwh * num(v, 'rate'), 0)}원 (원 단위 반올림)\n일정 전력 가정, 누진요금·부가요금 제외` };
  }),
  tool('moving', '이사 상자 수량', '부피와 상자 충전율로 필요한 상자 수를 올림 계산합니다.', [field('volume', '짐 총부피 (L)'), field('box', '상자 용량 (L)'), field('fill', '상자 충전율 (%)', { max: 100 })], v => {
    num(v, 'volume'); num(v, 'box'); num(v, 'fill', { max: 100 });
    const [unit, volume, box, fill] = decimalIntegers([v.volume, v.box, v.fill]);
    const boxes = ceilRatio(volume * 100n * unit, box * fill);
    if (boxes > 1000000000n) throw Error('계산 수량이 너무 큽니다. 용량과 충전율을 확인하세요.');
    return { text: `필요 상자: ${boxes}개 (올림)\n모양·무게·깨짐 방지 공간에 따라 실제 수량은 달라집니다.` };
  }),
  tool('pets', '반려동물 돌봄 인계 메모', '직접 작성한 식사·생활 지침을 텍스트 파일로 정리합니다. 급여량을 제안하지 않습니다.', [
    { name: 'name', label: '반려동물 이름', type: 'text', required: true },
    { name: 'food', label: '직접 정한 식사 지침', type: 'textarea', required: true },
    { name: 'routine', label: '생활·돌봄 지침', type: 'textarea', required: true },
    { name: 'contact', label: '연락처 (선택)', type: 'text', required: false },
  ], v => {
    const read = (key, max, optional = false) => {
      if (optional && (v[key] === undefined || v[key] === '')) return '';
      if (typeof v[key] !== 'string' || !v[key].trim() || v[key].length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(v[key])) throw Error('이름과 돌봄 지침을 입력하고 길이를 확인하세요.');
      return v[key].trim();
    };
    const name = read('name', 100), food = read('food', 10000), routine = read('routine', 10000), contact = read('contact', 500, true);
    const text = `반려동물 돌봄 인계 메모\n이름: ${name}\n\n식사 지침 (사용자 작성)\n${food}\n\n생활·돌봄 지침 (사용자 작성)\n${routine}${contact ? `\n\n연락처: ${contact}` : ''}\n\n작성자가 제공한 지침을 정리한 메모입니다. 급여량·치료 지침을 자동 제안하지 않습니다.`;
    return { text, download: { name: 'pet-care-handover.txt', type: 'text/plain;charset=utf-8', content: text } };
  }),
  tool('photography', '사진 인화 필요 픽셀', '인화 치수와 DPI 기준의 최소 픽셀 수를 각 변별로 올림합니다.', [field('width', '인화 너비 (cm)', { max: 1000 }), field('height', '인화 높이 (cm)', { max: 1000 }), count('dpi', '인화 해상도 (DPI)', { max: 2400 })], v => {
    const dpi = num(v, 'dpi', { integer: true, max: 2400 });
    num(v, 'width', { max: 1000 }); num(v, 'height', { max: 1000 });
    const [unit, w, h] = decimalIntegers([v.width, v.height]);
    const width = Number(ceilRatio(w * BigInt(dpi) * 100n, unit * 254n)), height = Number(ceilRatio(h * BigInt(dpi) * 100n, unit * 254n));
    return { text: `필요 이미지 크기: ${width} × ${height} px (각 변 올림)\n총 픽셀: ${fmt(width * height / 1e6)} MP\n원본 선명도·크롭·인화 장비 품질은 별도입니다.` };
  }),
  tool('plants', '식물 물주기 일정과 ICS', '직접 정한 간격의 일정만 만들며 식물별 적정 주기를 권장하지 않습니다.', [day('next', '다음 물주기 날짜'), count('interval', '간격 (일)', { max: 3650 }), count('count', '일정 수 (회)', { max: 366 })], v => {
    const start = date(v, 'next'), interval = num(v, 'interval', { integer: true, max: 3650 }), n = num(v, 'count', { integer: true, max: 366 });
    const dates = Array.from({ length: n }, (_, i) => addDays(start, i * interval));
    if (iso(addDays(dates.at(-1), 1)) > '2100-12-31') throw Error('마지막 일정 종료일은 2100년 이내여야 합니다.');
    const compact = d => iso(d).replaceAll('-', '');
    const events = dates.map(d => ['BEGIN:VEVENT', `UID:watering-${compact(d)}-${interval}-${n}@local.utility`, 'DTSTAMP:20000101T000000Z', `DTSTART;VALUE=DATE:${compact(d)}`, `DTEND;VALUE=DATE:${compact(addDays(d, 1))}`, 'SUMMARY:식물 물주기', 'END:VEVENT'].join('\r\n'));
    return { text: `물주기 일정 (종일):\n${dates.map(iso).join('\n')}\n입력 간격 기준입니다. 흙 상태와 식물 상태를 직접 확인하세요.`, download: { name: 'watering-schedule.ics', type: 'text/calendar;charset=utf-8', content: ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Utility Network//Watering//KO', 'CALSCALE:GREGORIAN', ...events, 'END:VCALENDAR', ''].join('\r\n') } };
  }),
  tool('powerpoint', '슬라이드 화면 비율', '정확한 정수 비율과 16:9·4:3 중 더 가까운 비율을 표시합니다.', [count('width', '가로 (px)'), count('height', '세로 (px)')], v => {
    const width = num(v, 'width', { integer: true }), height = num(v, 'height', { integer: true });
    let a = width, b = height; while (b) [a, b] = [b, a % b];
    const difference = Math.abs(width / height - 16 / 9) - Math.abs(width / height - 4 / 3);
    return { text: `정확한 화면 비율: ${width / a}:${height / a}\n가까운 표준 비율: ${Math.abs(difference) < 1e-12 ? '16:9와 4:3 동률' : difference < 0 ? '16:9' : '4:3'} (가로/세로 비의 절대 차이 기준)` };
  }),
  tool('skincare', '화장품 개봉 후 날짜 계산', '제품 라벨의 개봉 후 사용 개월 수를 직접 입력해 달력 날짜를 계산합니다.', [day('opened', '개봉일'), count('months', '제품 라벨의 사용 기간 (개월)', { max: 120 })], v => {
    const opened = date(v, 'opened'), months = num(v, 'months', { integer: true, max: 120 });
    const first = new Date(Date.UTC(opened.getUTCFullYear(), opened.getUTCMonth() + months, 1));
    const last = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
    first.setUTCDate(Math.min(opened.getUTCDate(), last));
    if (iso(first) > '2100-12-31') throw Error('계산 날짜는 2100년 이내여야 합니다.');
    return { text: `개봉 후 ${months}개월 달력 날짜: ${iso(first)}\n해당 월에 같은 일자가 없으면 말일로 맞춥니다. 달력 날짜를 기준으로 한 개인 일정이며 제품 안전성·사용 가능 기한을 보장하지 않습니다. 제품 표시와 변질 상태를 확인하세요.` };
  }),
  tool('stationery', 'A4 라벨 격자 수량', 'A4 210×297 mm 세로 용지의 동일 크기 직사각형 격자를 계산합니다.', [field('width', '라벨 너비 (mm)', { max: 210 }), field('height', '라벨 높이 (mm)', { max: 297 }), field('margin', '사방 여백 (mm)', { min: 0, max: 104 }), field('gap', '라벨 사이 간격 (mm)', { min: 0, max: 297 })], v => {
    num(v, 'width', { max: 210 }); num(v, 'height', { max: 297 }); num(v, 'margin', { min: 0, max: 104 }); num(v, 'gap', { min: 0, max: 297 });
    const [unit, w, h, m, g] = decimalIntegers([v.width, v.height, v.margin, v.gap]);
    const cols = (210n * unit - 2n * m + g) / (w + g), rows = (297n * unit - 2n * m + g) / (h + g);
    if (cols * rows > 1000000000n) throw Error('라벨 수량이 너무 큽니다. 치수를 확인하세요.');
    return { text: `A4 세로 격자: ${cols}열 × ${rows}행 = ${cols * rows}개\n회전 없이 계산한 수학적 배치입니다. 프린터 여백·배율·라벨지 오차를 반영하지 않으며 실제 인쇄를 보장하지 않습니다.` };
  }),
  tool('storage', '중복 파일 찾기', '선택한 파일을 기기에서 SHA-256으로 비교합니다. 파일을 업로드하거나 삭제하지 않습니다.', [
    { name: 'files', label: '비교할 파일 (최대 25개, 각 20MB, 합계 100MB)', type: 'file', required: true, multiple: true },
  ], async v => {
    const files = v.files;
    if (!Array.isArray(files) || files.length < 2 || files.length > 25) throw Error('비교할 파일을 2~25개 선택하세요.');
    let total = 0;
    for (const file of files) {
      if (!file || typeof file.name !== 'string' || !file.name.trim() || file.name.length > 500 || !Number.isSafeInteger(file.size) || file.size < 0 || file.size > 20_000_000 || typeof file.arrayBuffer !== 'function') throw Error('유효한 파일을 선택하세요. 파일당 최대 20MB입니다.');
      total += file.size;
    }
    if (total > 100_000_000) throw Error('파일 합계는 최대 100MB입니다.');
    if (!globalThis.crypto?.subtle) throw Error('보안 연결에서 파일 비교를 실행하세요.');
    const groups = new Map();
    for (const file of files) {
      const buffer = await file.arrayBuffer();
      if (!(buffer instanceof ArrayBuffer) || buffer.byteLength !== file.size) throw Error('파일을 읽지 못했습니다. 다시 선택하세요.');
      const hash = Array.from(new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256', buffer)), b => b.toString(16).padStart(2, '0')).join('');
      const key = `${file.size}:${hash}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(file);
    }
    const duplicates = [...groups.values()].filter(group => group.length > 1);
    const text = duplicates.length ? duplicates.map((group, i) => `중복 그룹 ${i + 1} (${group[0].size}바이트/파일)\n${group.map(file => `• ${file.name}`).join('\n')}`).join('\n\n') : '선택한 파일에서 같은 크기·SHA-256 해시의 중복 파일을 찾지 못했습니다.';
    return { text: `비교한 파일: ${files.length}개\n중복 그룹: ${duplicates.length}개\n\n${text}\n\n기기 안에서 크기와 SHA-256 해시가 같은 파일을 비교했습니다. 업로드·삭제하지 않았습니다.` };
  }),
  tool('travel', '여행 총예산', '숙박은 전체 인원의 객실 총액, 식비는 1인 1일 비용으로 계산합니다.', [count('people', '인원 (명)', { max: 10000 }), count('nights', '숙박 (박)', { max: 3650, min: 0 }), field('room', '1박 객실 총액 (원)', { min: 0 }), field('transport', '전체 교통비 (원)', { min: 0 }), field('food', '1인 하루 식비 (원)', { min: 0 })], v => {
    const people = num(v, 'people', { integer: true, max: 10000 }), nights = num(v, 'nights', { min: 0, integer: true, max: 3650 });
    const lodging = nights * num(v, 'room', { min: 0 }), transport = num(v, 'transport', { min: 0 }), food = people * (nights + 1) * num(v, 'food', { min: 0 });
    const total = lodging + transport + food;
    return { text: `일정 가정: ${nights}박 ${nights + 1}일 (식비는 숙박 수 + 1일)\n숙박비: ${fmt(lodging, 0)}원\n전체 교통비: ${fmt(transport, 0)}원\n식비: ${fmt(food, 0)}원\n총예산: ${fmt(total, 0)}원\n1인당: ${fmt(total / people, 0)}원 (원 단위 반올림)\n관광·쇼핑·보험 등 별도 비용은 제외합니다.` };
  }),
];
