const TEXT_LIMIT = 200_000;
const FILE_LIMIT = 20 * 1024 * 1024;
const IMAGE_LIMIT = 5 * 1024 * 1024;
const PIXEL_LIMIT = 16_000_000;
function text(value, label = '입력', required = true) {
  if (typeof value !== 'string' || value.length > TEXT_LIMIT) throw new Error(`${label}: 20만 자 이하의 문자를 입력하세요.`);
  if (required && !value.trim()) throw new Error(`${label}을 입력하세요.`);
  return value;
}
function number(value, label, min = 0, max = Number.MAX_SAFE_INTEGER, integer = false) {
  text(value, label);
  if (!/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(value.trim())) throw new Error(`${label}: 숫자를 입력하세요.`);
  const n = Number(value);
  if (!Number.isFinite(n) || n < min || n > max || (integer && !Number.isInteger(n))) throw new Error(`${label}: ${min}~${max}${integer ? ' 정수' : ''} 범위로 입력하세요.`);
  return n;
}
function choice(value, choices, label) {
  if (!choices.includes(value)) throw new Error(`${label}을 선택하세요.`);
  return value;
}
const fmt = n => Number(n.toFixed(6)).toLocaleString('en-US', { maximumFractionDigits: 6 });
const field = (name, label, type = 'text', extra = {}) => ({ name, label, type, required: true, ...extra });
const num = (name, label, min, max, extra = {}) => field(name, label, 'number', { min, max, step: 'any', ...extra });
const select = (name, label, options, value) => field(name, label, 'select', { options: options.map(([value, label]) => ({ value, label })), value });
function rows(value, label) { return text(value, label).split(/\r?\n/).filter(line => line !== ''); }
export function csvCell(value) {
  let s = String(value);
  if (/^[\t\r\n]|^\s*[=+\-@]/.test(s)) s = `'${s}`;
  return `"${s.replaceAll('"', '""')}"`;
}
function csv(rows) { return '\uFEFF' + rows.map(row => row.map(csvCell).join(',')).join('\r\n'); }
function download(name, type, content) { return { name, type, content }; }
export function cleanTrackingURL(value) {
  text(value, '주소');
  let url;
  try { url = new URL(value); } catch { throw new Error('올바른 http 또는 https 주소를 입력하세요.'); }
  if (!['https:', 'http:'].includes(url.protocol)) throw new Error('http 또는 https 주소만 지원합니다.');
  // Preserve the literal encoding and order of every retained query component.
  const hashAt = value.indexOf('#');
  const head = hashAt < 0 ? value : value.slice(0, hashAt);
  const hash = hashAt < 0 ? '' : value.slice(hashAt);
  const queryAt = head.indexOf('?');
  if (queryAt < 0) return value;
  const kept = head.slice(queryAt + 1).split('&').filter(part => {
    const encodedKey = part.split('=', 1)[0];
    let key;
    try { key = decodeURIComponent(encodedKey.replaceAll('+', ' ')); } catch { return true; }
    return !/^(?:utm_.*|gclid|fbclid)$/i.test(key);
  });
  return head.slice(0, queryAt) + (kept.length ? '?' + kept.join('&') : '') + hash;
}
export function mailtoLink(to, subject, body) {
  text(to, '받는 이메일'); text(subject, '제목', false); text(body, '본문', false);
  if (!/^[^\s@,;<>?&#]+@[^\s@,;<>?&#]+\.[^\s@,;<>?&#]+$/.test(to)) throw new Error('받는 이메일 주소 하나를 입력하세요.');
  return `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
export function countText(value) {
  text(value, '본문');
  return { characters: Array.from(value).length, compact: Array.from(value.replace(/\s/gu, '')).length, lines: value.split(/\r\n|\r|\n/).length, segments: value.trim().split(/\s+/u).length };
}
export function checkFilename(name) {
  const problems = [];
  if (!name) problems.push('빈 이름');
  if (/[\u0000-\u001f<>:"/\\|?*]/.test(name)) problems.push('금지 문자 또는 제어 문자');
  if (/[. ]$/.test(name)) problems.push('끝의 마침표 또는 공백');
  if (/^(?:CON|PRN|AUX|NUL|COM[1-9¹²³]|LPT[1-9¹²³])$/i.test(name.split('.')[0].trimEnd())) problems.push('예약된 장치 이름');
  if (name.length > 255) problems.push('UTF-16 코드 단위 255개 초과');
  return problems;
}
export function parsePageRange(value, totalValue) {
  text(value, '페이지 범위');
  const total = number(String(totalValue), '전체 페이지 수', 1, 10000, true);
  const pages = new Set();
  for (const raw of value.split(',')) {
    const match = /^\s*(\d+)\s*(?:-\s*(\d+)\s*)?$/.exec(raw);
    if (!match) throw new Error('범위는 1-3,5 형식으로 입력하세요.');
    const from = Number(match[1]); const to = Number(match[2] ?? match[1]);
    if (from < 1 || to < from || to > total) throw new Error(`페이지는 1~${total}의 오름차순 범위여야 합니다.`);
    for (let page = from; page <= to; page++) pages.add(page);
  }
  return [...pages].sort((a, b) => a - b);
}
export function printCount(range, total, copiesValue, mode) {
  const pages = parsePageRange(range, total);
  const copies = number(copiesValue, '부수', 1, 1000, true);
  choice(mode, ['simplex', 'duplex'], '인쇄 방식');
  return { pages, copies, sheets: (mode === 'duplex' ? Math.ceil(pages.length / 2) : pages.length) * copies };
}
export function downloadSeconds(sizeValue, rateValue, efficiencyValue) {
  const size = number(sizeValue, '파일 크기 MB', 0.000001, 1e12);
  const rate = number(rateValue, '회선 속도 Mbps', 0.000001, 1e9);
  const efficiency = number(efficiencyValue, '효율 %', 0.000001, 100);
  return size * 8 / (rate * efficiency / 100);
}
export function scaleRecipe(currentValue, targetValue, ingredients) {
  const current = number(currentValue, '현재 인분', 0.000001, 1e6);
  const target = number(targetValue, '목표 인분', 0.000001, 1e6);
  return rows(ingredients, '재료 목록').map((line, i) => {
    const parts = line.split(',');
    if (parts.length !== 3 || !parts[0].trim() || !parts[2].trim()) throw new Error(`${i + 1}행: 재료명,숫자,단위 형식으로 입력하세요.`);
    const amount = number(parts[1].trim(), `${i + 1}행 분량`, 0, 1e12);
    return { name: parts[0].trim(), amount: amount * target / current, unit: parts[2].trim() };
  });
}
export function validateFiles(files, images = false) {
  if (!Array.isArray(files) || !files.length) throw new Error('파일을 선택하세요.');
  if (files.length > 1000) throw new Error('파일은 한 번에 1,000개 이하로 선택하세요.');
  let bytes = 0;
  for (const file of files) {
    if (!file || typeof file.name !== 'string' || !Number.isSafeInteger(file.size) || file.size < 0) throw new Error('올바른 파일을 선택하세요.');
    if (images && file.size > IMAGE_LIMIT) throw new Error('이미지는 파일당 5MB 이하만 지원합니다.');
    bytes += file.size;
    if (bytes > FILE_LIMIT) throw new Error('파일 합계는 20MB 이하만 지원합니다.');
    if (images && (/\.(heic|heif)$/i.test(file.name) || /image\/hei[cf]/i.test(file.type || ''))) throw new Error('HEIC/HEIF는 지원하지 않습니다. JPEG, PNG 또는 WebP로 저장한 뒤 선택하세요.');
    if (images && !/^image\/(?:jpeg|png|webp)$/i.test(file.type || '')) throw new Error('JPEG, PNG, WebP 이미지만 지원합니다.');
  }
  return files;
}
export function manifestCSV(files) {
  validateFiles(files);
  return csv([['파일명', '크기 (bytes)', '유형'], ...files.map(file => [file.name, file.size, file.type || '알 수 없음'])]);
}
export function imageDimensions(width, height, maxWidth = width) {
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width <= 0 || height <= 0 || width * height > PIXEL_LIMIT) throw new Error('이미지는 1,600만 픽셀 이하만 지원합니다.');
  if (!Number.isSafeInteger(maxWidth) || maxWidth < 1 || maxWidth > 4096) throw new Error('최대 너비는 1~4096px 정수여야 합니다.');
  const ratio = Math.min(1, maxWidth / width);
  return { width: Math.max(1, Math.round(width * ratio)), height: Math.max(1, Math.round(height * ratio)) };
}
async function convertImage(files, type, quality, maxWidth) {
  validateFiles(files, true);
  if (files.length !== 1) throw new Error('이미지는 한 번에 한 개씩 선택하세요.');
  if (typeof document === 'undefined' || typeof createImageBitmap !== 'function') throw new Error('이미지 변환은 지원되는 브라우저에서 실행하세요.');
  let bitmap;
  try { bitmap = await createImageBitmap(files[0]); } catch { throw new Error('이미지를 읽을 수 없습니다. 파일 형식을 확인하세요.'); }
  try {
    if (bitmap.width * bitmap.height > PIXEL_LIMIT) throw new Error('이미지는 1,600만 픽셀 이하만 지원합니다.');
    const dimensions = maxWidth ? imageDimensions(bitmap.width, bitmap.height, maxWidth) : { width: bitmap.width, height: bitmap.height };
    const canvas = document.createElement('canvas'); Object.assign(canvas, dimensions);
    const context = canvas.getContext('2d');
    if (!context) throw new Error('이 브라우저에서 Canvas를 사용할 수 없습니다.');
    if (type === 'image/jpeg') { context.fillStyle = '#fff'; context.fillRect(0, 0, canvas.width, canvas.height); }
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise(resolve => canvas.toBlob(resolve, type, quality));
    if (!blob || blob.type !== type) throw new Error('요청한 이미지 형식으로 저장하지 못했습니다.');
    const extension = type === 'image/png' ? 'png' : 'jpg';
    return { text: `${canvas.width} × ${canvas.height}px · ${extension.toUpperCase()} · ${blob.size.toLocaleString('en-US')} bytes\n브라우저에서 로컬 처리했습니다.${type === 'image/jpeg' ? '\n투명 영역은 흰색으로 저장됩니다.' : ''}`, download: download(`converted.${extension}`, type, blob) };
  } finally { bitmap.close(); }
}
export function cleaningRota(start, daysValue, peopleValue, tasksValue) {
  text(start, '시작 날짜');
  const days = number(daysValue, '일정 일수', 1, 31, true);
  const uniqueList = (value, label) => {
    const list = text(value, label).split(/\r?\n/).map(s => s.trim());
    if (!list.length || list.length > 100 || list.some(s => !s) || new Set(list).size !== list.length) throw new Error(`${label}: 중복 없이 1~100개를 입력하세요.`);
    return list;
  };
  const people = uniqueList(peopleValue, '담당자 목록');
  const tasks = uniqueList(tasksValue, '청소 작업 목록');
  const date = new Date(`${start}T00:00:00.000Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== start || date.getUTCFullYear() < 1) throw new Error('올바른 시작 날짜를 입력하세요.');
  const result = [];
  for (let day = 0; day < days; day++) {
    const next = new Date(date.getTime() + day * 86400000);
    if (next.getUTCFullYear() > 9999) throw new Error('일정은 9999년 이내여야 합니다.');
    tasks.forEach((task, index) => result.push([next.toISOString().slice(0, 10), task, people[(day + index) % people.length]]));
  }
  return result;
}
export function lengths(value) {
  return rows(value, '치수 목록').map((line, i) => {
    const parts = line.split(',');
    if (parts.length !== 2 || !parts[0].trim()) throw new Error(`${i + 1}행: 항목명,cm 형식으로 입력하세요.`);
    const cm = number(parts[1].trim(), `${i + 1}행 cm`, 0, 1e9);
    return { label: parts[0].trim(), cm, inches: cm / 2.54 };
  });
}
export const tools = [
  { slug: 'chrome', title: '주소 추적 매개변수 제거', description: 'utm_*, gclid, fbclid만 제거하고 다른 쿼리와 #조각을 보존합니다.', fields: [field('url', '웹 주소')], run: v => ({ text: cleanTrackingURL(v.url) }) },
  { slug: 'gmail', title: '이메일 mailto 링크 만들기', description: '메일 앱에 전달할 링크와 확인용 본문을 만듭니다. 메일은 전송하지 않습니다.', fields: [field('to', '받는 이메일'), field('subject', '제목', 'text', { required: false }), field('body', '본문', 'textarea', { required: false })], run: v => ({ text: `${mailtoLink(v.to, v.subject ?? '', v.body ?? '')}\n\n받는 사람: ${v.to}\n제목: ${v.subject ?? ''}\n본문:\n${v.body ?? ''}` }) },
  { slug: 'word', title: '한글·텍스트 글자 수 세기', description: '유니코드 문자, 줄, 공백 구분 덩어리를 계산합니다. 덩어리는 한국어 언어학적 단어 수가 아닙니다.', fields: [field('text', '본문', 'textarea')], run: v => { const c = countText(v.text); return { text: `글자 수(공백 포함): ${c.characters}\n글자 수(공백 제외): ${c.compact}\n줄 수: ${c.lines}\n공백 구분 덩어리 수: ${c.segments}\n줄바꿈도 공백 포함 글자 수에 포함됩니다.` }; } },
  { slug: 'windows', title: 'Windows 파일명 검사', description: '파일명을 줄마다 입력하면 예약 이름과 금지 문자를 검사합니다. 이름은 변경하지 않습니다.', fields: [field('names', '파일명 목록', 'textarea')], run: v => ({ text: rows(v.names, '파일명 목록').map(name => { const errors = checkFilename(name); return `${JSON.stringify(name)}: ${errors.length ? errors.join(', ') : '사용 가능 (기본 규칙)'} `; }).join('\n') }) },
  { slug: 'printer', title: '인쇄 용지 장수 계산', description: '중복 페이지는 한 번만 셉니다. 양면 인쇄는 각 부마다 새 용지를 사용합니다.', fields: [num('total', '전체 페이지 수', 1, 10000, { step: 1 }), field('range', '페이지 범위 (예: 1-3,5)'), num('copies', '부수', 1, 1000, { step: 1 }), select('mode', '인쇄 방식', [['simplex', '단면'], ['duplex', '양면']], 'simplex')], run: v => { const p = printCount(v.range, v.total, v.copies, v.mode); return { text: `선택 페이지: ${p.pages.join(', ')}\n부당 ${p.pages.length}페이지 × ${p.copies}부\n필요 용지: ${p.sheets}장` }; } },
  { slug: 'wifi', title: '파일 다운로드 예상 시간', description: '십진 MB와 Mbps를 사용합니다. 1바이트=8비트이며 실제 시간은 환경에 따라 달라집니다.', fields: [num('size', '파일 크기 (MB)', 0.000001, 1e12), num('rate', '회선 속도 (Mbps)', 0.000001, 1e9), num('efficiency', '예상 효율 (%)', 0.000001, 100, { value: '100' })], run: v => { const seconds = downloadSeconds(v.size, v.rate, v.efficiency); return { text: `예상 시간: ${fmt(seconds)}초\n약 ${fmt(seconds / 60)}분\n십진 MB 기준의 계산값입니다.` }; } },
  { slug: 'kitchen', title: '레시피 인분별 분량 환산', description: '각 줄을 재료명,분량,단위로 입력하세요. 1/2, 범위, 한 컵 같은 모호한 분량은 지원하지 않습니다.', fields: [num('current', '현재 인분', 0.000001, 1e6), num('target', '목표 인분', 0.000001, 1e6), field('ingredients', '재료 목록 (예: 밀가루,200,g)', 'textarea')], run: v => ({ text: scaleRecipe(v.current, v.target, v.ingredients).map(row => `${row.name}: ${fmt(row.amount)} ${row.unit}`).join('\n') }) },
  { slug: 'mac', title: '로컬 파일 목록 CSV 만들기', description: '선택한 파일의 이름·크기·유형만 읽습니다. 파일 내용은 읽거나 업로드하지 않습니다. 합계 20MB 이하.', fields: [field('files', '파일 선택', 'file', { multiple: true })], run: v => { const content = manifestCSV(v.files); return { text: `${v.files.length}개 파일\n${v.files.map(f => `${f.name}: ${f.size} bytes · ${f.type || '알 수 없음'}`).join('\n')}`, download: download('file-manifest.csv', 'text/csv;charset=utf-8', content) }; } },
  { slug: 'android', title: '이미지 너비 줄이기 · PNG 저장', description: 'JPEG·PNG·WebP 한 개를 브라우저에서 PNG로 저장합니다. 파일당 5MB·1,600만 픽셀 이하. 확대하지 않습니다.', fields: [field('files', '이미지 선택', 'file', { accept: 'image/jpeg,image/png,image/webp' }), num('width', '최대 너비 (px)', 1, 4096, { step: 1, value: '1200' })], run: v => convertImage(v.files, 'image/png', 1, number(v.width, '최대 너비 px', 1, 4096, true)) },
  { slug: 'iphone', title: '이미지 JPEG·PNG 변환', description: 'JPEG·PNG·WebP 한 개를 로컬 변환합니다. HEIC/HEIF 미지원. 파일당 5MB·1,600만 픽셀 이하. JPEG는 투명 영역을 흰색으로 저장합니다.', fields: [field('files', '이미지 선택', 'file', { accept: 'image/jpeg,image/png,image/webp' }), select('format', '저장 형식', [['image/jpeg', 'JPEG'], ['image/png', 'PNG']], 'image/jpeg'), num('quality', 'JPEG 품질 (1~100, PNG에는 미적용)', 1, 100, { step: 1, value: '85' })], run: v => convertImage(v.files, choice(v.format, ['image/jpeg', 'image/png'], '저장 형식'), number(v.quality, '품질', 1, 100, true) / 100) },
  { slug: 'cleaning', title: '가족·동거인 청소 당번표 CSV', description: '매일 모든 작업을 배정하며 담당자 순서를 순환합니다. 같은 사람에게 여러 작업이 배정될 수 있습니다. 날짜는 UTC 기준이고 화학제품 지침은 제공하지 않습니다.', fields: [field('people', '담당자 (한 줄에 한 명)', 'textarea'), field('tasks', '청소 작업 (한 줄에 하나)', 'textarea'), field('start', '시작 날짜', 'date'), num('days', '일정 일수', 1, 31, { step: 1 })], run: v => { const assignments = cleaningRota(v.start, v.days, v.people, v.tasks); return { text: assignments.map(([date, task, person]) => `${date} · ${task} · ${person}`).join('\n'), download: download('cleaning-rota.csv', 'text/csv;charset=utf-8', csv([['날짜', '작업', '담당자'], ...assignments])) }; } },
  { slug: 'fashion', title: '의류 치수 cm·인치 환산표', description: '각 줄을 항목명,cm로 입력하세요. 길이 단위 환산이며 브랜드별 사이즈 추천은 아닙니다.', fields: [field('rows', '치수 목록 (예: 허리,76)', 'textarea')], run: v => ({ text: lengths(v.rows).map(row => `${row.label}: ${fmt(row.cm)} cm = ${fmt(row.inches)} inch`).join('\n') + '\n브랜드별 사이즈 추천이 아닙니다.' }) },
  { slug: 'pdf', title: 'PDF 페이지 범위 계획 도우미', description: '고유 페이지·역순·제외 페이지를 계산하여 TXT로 저장합니다. PDF 파일을 읽거나 편집하지 않습니다.', fields: [num('total', '원본 전체 페이지 수', 1, 10000, { step: 1 }), field('range', '선택 범위 (예: 1-3,5)')], run: v => { const pages = parsePageRange(v.range, v.total); const selected = new Set(pages); const excluded = Array.from({ length: Number(v.total) }, (_, i) => i + 1).filter(p => !selected.has(p)); const result = `선택 (${pages.length}페이지): ${pages.join(', ')}\n선택 역순: ${[...pages].reverse().join(', ')}\n제외: ${excluded.join(', ') || '없음'}\nPDF 편집이 아닌 범위 계획입니다.`; return { text: result, download: download('pdf-page-plan.txt', 'text/plain;charset=utf-8', result) }; } }
];
