'use strict';
/* =========================================================
 *  깜빡, 그 시절 — 샘플 맵 프로토타입
 *  - 2D 도트 횡스크롤, 내부 해상도 320x192 (16px 타일, 12행)
 *  - 현재(컬러, 폐허)  <->  과거(흑백 모노톤, 사람이 사는 마을)
 *  - X: 눈 깜빡임(시간 전환) / C(누르고 있기): 실눈으로 다른 시간 엿보기
 * ========================================================= */
(() => {
const T = 16, COLS = 106, ROWS = 12, VW = 320, VH = 192;
const WORLD_W = COLS * T, WORLD_H = ROWS * T;
const SOLID = new Set(['#', 'B', 'H', 'W', 'S', '=', 'D', 'R', 'F']);
const ONEWAY = new Set(['T']);
const ERA = { present: { label: '현재', year: '2026' }, past: { label: '과거', year: '1994' } };
const FONT = "'Galmuri11','DungGeunMo','Malgun Gothic','Apple SD Gothic Neo',sans-serif";
const other = e => (e === 'past' ? 'present' : 'past');

/* ---------------------------------------------------------
 *  MAP — 두 시간대 레이어를 같은 좌표계에 겹쳐서 설계
 *  '.' 빈칸  '#' 땅  'B' 돌담  'H' 집 벽  'W' 마루(2층 바닥)
 *  'S' 계단  '=' 다리  'T' 나뭇가지(아래서 통과 가능)
 *  'D' 잠긴 문  'R' 잔해  'F' 지붕  '~' 물(빠지면 리스폰)
 * --------------------------------------------------------- */
const grid = () => Array.from({ length: ROWS }, () => Array(COLS).fill('.'));
const MAP = { past: grid(), present: grid() };
function put(era, x, y, ch) {
  for (const e of era === 'both' ? ['past', 'present'] : [era])
    if (x >= 0 && x < COLS && y >= 0 && y < ROWS) MAP[e][y][x] = ch;
}
function fill(era, x0, y0, x1, y1, ch) {
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) put(era, x, y, ch);
}

// 바닥
fill('both', 0, 9, COLS - 1, 11, '#');
// [우물 광장] 현재: 부서진 수레 잔해(점프로 넘음). 과거의 같은 자리엔 장터 좌판
fill('present', 28, 7, 29, 8, 'R');
// [개울가] 과거: 온전한 다리 / 현재: 양끝 말뚝만 남음 → 과거로 건너야 함
fill('both', 37, 9, 44, 11, '.');
fill('both', 37, 10, 44, 11, '~');
fill('past', 37, 9, 44, 9, '=');
put('present', 37, 9, '='); put('present', 44, 9, '=');
// [큰 나무 언덕] 높은 돌담(5칸).
// 과거의 빈터에 사과를 심으면 → 현재에 큰 나무가 자라 가지(발판)가 생긴다
fill('both', 58, 4, 59, 8, 'B');
let treePlanted = false;
function setTree(planted) {
  treePlanted = planted;
  const ch = planted ? 'T' : '.';
  fill('present', 49, 7, 51, 7, ch);
  fill('present', 53, 5, 56, 5, ch);
}
// [옛 집] 지붕
fill('both', 65, 1, 101, 1, 'F');
fill('both', 68, 0, 98, 0, 'F');
fill('present', 72, 0, 76, 1, '.');   // 현재: 지붕 구멍(빛줄기)
fill('present', 85, 0, 88, 1, '.');
// 외벽 + 현관문 (과거: 잠김 / 현재: 문짝이 썩어 없음)
fill('both', 66, 2, 66, 8, 'H');
fill('both', 100, 2, 100, 8, 'H');
fill('past', 66, 7, 66, 8, 'D');
fill('present', 66, 7, 66, 8, '.');
// 2층 바닥 (현재: 74~78 꺼짐)
fill('both', 67, 5, 89, 5, 'W');
fill('present', 74, 5, 78, 5, '.');
// 2층 아이 방 문 (과거: 잠김 / 현재: 없음)
put('both', 80, 2, 'H');
fill('past', 80, 3, 80, 4, 'D');
// 계단 (과거: 온전 / 현재: 무너져 잔해 1칸)
put('past', 90, 8, 'S'); fill('past', 91, 7, 91, 8, 'S'); fill('past', 92, 6, 92, 8, 'S'); put('past', 93, 8, 'S');
put('present', 90, 8, 'R'); put('present', 91, 8, 'R');

const tileAt = (era, x, y) => (x < 0 || x >= COLS ? '#' : y < 0 || y >= ROWS ? '.' : MAP[era][y][x]);
const solidAt = (era, x, y) => SOLID.has(tileAt(era, x, y));
function rectHitsSolid(era, x, y, w, h) {
  for (let ty = Math.floor(y / T); ty <= Math.floor((y + h - 0.01) / T); ty++)
    for (let tx = Math.floor(x / T); tx <= Math.floor((x + w - 0.01) / T); tx++)
      if (solidAt(era, tx, ty)) return true;
  return false;
}

/* ---------------------------------------------------------
 *  PROPS — 충돌 없는 장식/NPC/조사 포인트
 *  x: 타일 좌표(왼쪽), by: 바닥 행(그 행의 윗면에 서 있음)
 * --------------------------------------------------------- */
const PROPS = [
  // 마을 입구
  { k: 'weeds', x: 1.5, by: 9, era: 'present' }, { k: 'weeds', x: 8, by: 9, era: 'present' },
  { k: 'weeds', x: 13, by: 9, era: 'present' }, { k: 'weeds', x: 19, by: 9, era: 'present' },
  { k: 'flowers', x: 2, by: 9, era: 'past' }, { k: 'flowers', x: 9, by: 9, era: 'past' }, { k: 'flowers', x: 21.5, by: 9, era: 'past' },
  { k: 'sign', x: 5, by: 9, era: 'both', h: 22, say: { past: '「솔빛마을」 어서 오세요!', present: '「솔■마을」… 글자가 지워져 읽을 수 없다.' } },
  { k: 'npc', x: 11, by: 9, era: 'past', h: 18, say: { past: '어서 오렴. 오늘따라 하늘이 참 맑구나.' } },
  { k: 'lamp', x: 15, by: 9, era: 'both' },
  // 우물 광장
  { k: 'kid', x: 19.5, by: 9, era: 'past', h: 18, v: 1, say: { past: '술래는 너야! 우물 뒤에 숨는 건 반칙!' } },
  { k: 'well', x: 23, by: 9, era: 'both', w: 1.5, h: 36, say: { past: '두레박 가득 시원한 물이 찰랑인다.', present: '말라붙은 우물. 바닥이 보이지 않는다.' } },
  { k: 'crow', x: 24.6, by: 8.25, era: 'present' },
  { k: 'kid', x: 26.2, by: 9, era: 'past', h: 18, v: 2 },
  { k: 'vendor', x: 29.2, by: 9, era: 'past', h: 22, act: 'apple', say: { past: () => (hasApple || treePlanted
      ? '맛있게 먹으렴! 씨가 튼튼해서 심으면 쑥쑥 자랄 게다.'
      : '장날이라 사과가 싸단다. 하나 가져가렴! [E]') } },
  { k: 'stall', x: 28, by: 9, era: 'past', w: 2.5 },
  { k: 'note', x: 27, by: 9, era: 'present', h: 34, say: { present: '부서진 수레가 길을 막고 있다.' } },
  { k: 'weeds', x: 31, by: 9, era: 'present' }, { k: 'weeds', x: 33.5, by: 9, era: 'present' },
  // 개울가
  { k: 'note', x: 35.5, by: 9, era: 'present', h: 20, say: { present: '다리가 끊어져 있다. …예전엔 매일 건너던 길인데.' } },
  { k: 'plankL', x: 38, by: 9, era: 'present' }, { k: 'plankR', x: 43, by: 9, era: 'present' },
  { k: 'fisher', x: 45.1, by: 9, era: 'past', h: 18, say: { past: '이 다리는 우리 아버지가 놓으신 거란다.' } },
  // 큰 나무 언덕
  { k: 'weeds', x: 46.5, by: 9, era: 'present' },
  // 나무 자리: 심기 전 / 심은 후
  { k: 'soil', x: 52, by: 9, era: 'past', h: 18, act: 'plant', when: () => !treePlanted, say: { past: () => (hasApple
      ? '볕이 잘 드는 부드러운 흙. 여기에 사과를 심자. [E]'
      : '볕이 잘 드는 빈터. 무언가 심으면 잘 자랄 것 같다.') } },
  { k: 'emptylot', x: 52, by: 9, era: 'present', h: 20, when: () => !treePlanted, say: { present: '메마른 빈터. 담장이 너무 높아 넘어갈 수 없다.' } },
  { k: 'bigtree', x: 52, by: 9, era: 'present', bg: true, h: 40, when: () => treePlanted, say: { present: '그때 심은 사과가 이렇게 자랐다. 가지를 타면 담을 넘을 수 있겠다.' } },
  { k: 'sapling', x: 52, by: 9, era: 'past', h: 28, when: () => treePlanted, say: { past: '내가 심은 사과나무 싹. 현재엔 어떻게 자랐을까?' } },
  { k: 'note', x: 56.4, by: 9, era: 'past', h: 30, say: { past: '담이 너무 높다. 대문은 굳게 잠겨 있다.' } },
  { k: 'gate', x: 58, by: 9, era: 'both' },
  // 마당
  { k: 'laundry', x: 60.5, by: 9, era: 'both' },
  { k: 'weeds', x: 61.5, by: 9, era: 'present' }, { k: 'weeds', x: 63.5, by: 9, era: 'present' },
  { k: 'dog', x: 63.6, by: 9, era: 'past', h: 14, say: { past: '멍! 멍멍!' } },
  { k: 'note', x: 64.8, by: 9, era: 'past', h: 30, say: { past: '현관문이 잠겨 있다. 지금은 들어갈 수 없다.' } },
  { k: 'note', x: 64.8, by: 9, era: 'present', h: 30, say: { present: '문짝이 썩어 떨어져 나갔다.' } },
  // 옛 집 1층
  { k: 'cobweb', x: 67, by: 6, era: 'present' }, { k: 'cobweb', x: 99, by: 6, era: 'present', flip: true },
  { k: 'window', x: 69, by: 8, era: 'both' },
  { k: 'chair', x: 70.8, by: 9, era: 'both' },
  { k: 'table', x: 72, by: 9, era: 'both' },
  { k: 'puddle', x: 75, by: 9, era: 'present' },
  { k: 'clock', x: 78, by: 8, era: 'both', h: 28, say: { past: '째깍, 째깍. 벽시계가 부지런히 간다.', present: '시계는 3시 17분에 멈춰 있다.' } },
  { k: 'window', x: 84, by: 8, era: 'both' },
  { k: 'weeds', x: 86, by: 9, era: 'present' },
  { k: 'note', x: 88.5, by: 9, era: 'present', h: 24, say: { present: '계단이 무너져 내렸다. 2층으로 갈 길이 없다.' } },
  { k: 'mom', x: 95, by: 9, era: 'past', h: 18, say: { past: '계단 조심하렴. 밥 다 됐다, 동생 좀 불러올래?' } },
  { k: 'stove', x: 97, by: 9, era: 'both' },
  // 옛 집 2층
  { k: 'window', x: 72, by: 4, era: 'both' },
  { k: 'desk', x: 67.5, by: 5, era: 'both' },
  { k: 'photo', x: 69, by: 4, era: 'both', goal: true, h: 16, say: { present: '빛바랜 액자. 얼굴을 알아볼 수 없다.' } },
  { k: 'toy', x: 76, by: 5, era: 'past' },
  { k: 'note', x: 79.4, by: 5, era: 'present', h: 20, say: { present: '바닥이 꺼져 있다. 그대로는 건널 수 없다.' } },
  { k: 'note', x: 81.4, by: 5, era: 'past', h: 34, say: { past: '방문이 잠겨 있다. 안에서 아이 웃음소리가 들린다.' } },
  { k: 'window', x: 86, by: 4, era: 'both' },
  { k: 'bed', x: 82.5, by: 5, era: 'both', w: 2 },
];

const propOn = (p, era) => (p.era === era || p.era === 'both') && (!p.when || p.when());
const sayText = (p, era) => { const v = p.say && p.say[era]; return typeof v === 'function' ? v() : v; };

/* ---------------------------------------------------------
 *  MONSTERS — '그림자'. 현재에만 존재. 닿으면 HP -1
 *  공격 수단은 없다. 눈을 깜빡여 과거로 피하는 것이 유일한 방법
 *  x0~x1: 순찰 구간(타일), row: 서 있는 바닥 행
 * --------------------------------------------------------- */
const MONSTER_DEFS = [
  { x0: 15, x1: 27, row: 9, speed: 0.55 },   // 우물 광장
  { x0: 45, x1: 57, row: 9, speed: 0.6 },    // 큰 나무 언덕
  { x0: 60, x1: 65, row: 9, speed: 0.45 },   // 마당
  { x0: 67, x1: 89, row: 9, speed: 0.7 },    // 옛 집 1층
  { x0: 81, x1: 89, row: 5, speed: 0.45 },   // 옛 집 2층 복도
];
const MONSTERS = MONSTER_DEFS.map(d => ({ ...d, w: 12, h: 12 }));
function resetMonsters() {
  MONSTERS.forEach((m, i) => {
    m.x = (i % 2 ? m.x1 : m.x0) * T + 2; m.y = m.row * T - m.h - 2; m.dir = i % 2 ? -1 : 1;
  });
}

const ZONES = [
  { x: 0, name: '마을 입구' }, { x: 18, name: '우물 광장' }, { x: 34, name: '개울가' },
  { x: 47, name: '큰 나무 언덕' }, { x: 60, name: '마당' }, { x: 66, name: '옛 집 · 1층' },
];

// 맵 개요(M)에 표시할 공략 동선
const ROUTE = [
  { n: '1', x: 29.7, y: 7, era: 'past', text: '과거: 시장 아저씨에게 사과를 받는다 [E]' },
  { n: '2', x: 40.5, y: 8, era: 'present', text: '현재: 다리가 끊김 → 과거로 깜빡여 건넌다 (물에 빠지면 HP -1)' },
  { n: '3', x: 52.5, y: 8, era: 'past', text: '과거: 언덕 빈터에 사과를 심는다 [E]' },
  { n: '4', x: 54, y: 4, era: 'present', text: '현재: 자라난 사과나무 가지를 타고 돌담을 넘는다' },
  { n: '5', x: 66.5, y: 7, era: 'present', text: '현재: 썩어 떨어진 현관문으로 들어간다 (과거엔 잠김)' },
  { n: '6', x: 91.5, y: 5, era: 'past', text: '과거: 무너지기 전의 계단으로 2층에 오른다' },
  { n: '7', x: 80.5, y: 3, era: 'present', text: '현재: 잠긴 방문이 사라진 시간으로 깜빡여 통과' },
  { n: '8', x: 76.5, y: 4, era: 'past', text: '과거: 꺼진 바닥을 건넌다 (1층으로 떨어지면 HP -1)' },
  { n: '9', x: 69.5, y: 2.6, era: 'past', text: '과거: 가족사진 = 기억 조각 획득 (목표)' },
  { n: '!', x: 28.5, y: 6, era: 'present', text: '수레 잔해: 과거에서 이 자리에 서서 깜빡이면 실패' },
  { n: 'M', x: 21, y: 8, era: 'present', text: '그림자: 현재에만 존재, 닿으면 HP -1 → 과거로 피한다' },
];

/* ---------------------------------------------------------
 *  PALETTE — 과거 팔레트는 화면 출력 시 흑백으로 변환됨
 * --------------------------------------------------------- */
const PAL = {
  present: {
    sky: ['#2a2342', '#6b3a5c', '#c4704f', '#eaa063'], sun: '#ffcf7a', mount: '#4f3a57', mount2: '#3a2a45',
    bgHouse: '#3f3049', bgRoof: '#2c2236', bgWin: '#18121f',
    dirt: '#5b4334', dirtDark: '#3f2e25', grass: '#8a8a3c', grassDark: '#5d5f2c', grassTip: '#b3a04a',
    stone: '#6b6570', stoneDark: '#4a4550', stoneLight: '#857e88', moss: '#5f7a3a',
    plaster: '#7f7262', beam: '#4e3a2c', beamDark: '#33261d', plank: '#7a5a3e', plankDark: '#553d2a', plankLight: '#8f6c4a',
    wall: '#5f5547', wallStripe: '#564c40', panel: '#43352a', stain: '#4a4036', boards: '#4f3d2c',
    door: '#5a3d2a', roof: '#5c3b3b', roofDark: '#432a2c', roofLight: '#704848',
    water: '#2f5257', waterLight: '#4f7b78', waterSpark: '#9cc0b4',
    bark: '#4b3526', barkLight: '#6a4b33', leaf: '#3f5a2a', leaf2: '#6b6f2a', leaf3: '#a85a2c',
    brick: '#7a4a3a', metal: '#5d5550', rust: '#8a4f2c', cloth: '#7b6d66', skin: '#f0c8a0',
  },
  past: {
    sky: ['#8fb8e0', '#b8d6ee', '#e2eef6', '#ffffff'], sun: '#ffffff', mount: '#9ab0c0', mount2: '#7d95a5',
    bgHouse: '#d8c9b0', bgRoof: '#7a4a3a', bgWin: '#fff2b0',
    dirt: '#8a6a4a', dirtDark: '#6a5038', grass: '#5eaa48', grassDark: '#3f8034', grassTip: '#86c860',
    stone: '#a8a29a', stoneDark: '#7e786f', stoneLight: '#c8c2b8', moss: '#7a9a5a',
    plaster: '#e8dcc4', beam: '#7a5434', beamDark: '#553a24', plank: '#b08458', plankDark: '#8a6440', plankLight: '#c89a6a',
    wall: '#efe2c6', wallStripe: '#d6c4a0', panel: '#9a6e48', stain: '#d8c8a6', boards: '#b08458',
    door: '#8a5a34', roof: '#a04a3a', roofDark: '#7a3628', roofLight: '#c05e4a',
    water: '#4a8ab8', waterLight: '#8ac0e0', waterSpark: '#ffffff',
    bark: '#7a5434', barkLight: '#9a6e48', leaf: '#5eaa48', leaf2: '#86c860', leaf3: '#86c860',
    brick: '#b06a50', metal: '#8a8a8a', rust: '#9a9a9a', cloth: '#e0e0e0', skin: '#f2cfa8',
  },
};

/* ---------------------------------------------------------
 *  DRAW HELPERS
 * --------------------------------------------------------- */
function R(c, x, y, w, h, col) {
  if (col) c.fillStyle = col;
  c.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}
function disc(c, cx, cy, r, col) {
  c.fillStyle = col;
  for (let dy = -r; dy <= r; dy++) {
    const w = Math.floor(Math.sqrt(r * r - dy * dy));
    c.fillRect(Math.round(cx - w), Math.round(cy + dy), w * 2 + 1, 1);
  }
}
function hash(x, y) {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263)) ^ 0x5bd1e995;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return (h ^ (h >>> 16)) >>> 0;
}
const hex = h => { const n = parseInt(h.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
function mix(a, b, k) {
  const A = hex(a), B = hex(b);
  return 'rgb(' + A.map((v, i) => Math.round(v + (B[i] - v) * k)).join(',') + ')';
}
const skyBands = {};
for (const e of ['past', 'present']) {
  const s = PAL[e].sky, out = [];
  for (let i = 0; i < 16; i++) {
    const f = (i / 15) * (s.length - 1), j = Math.min(Math.floor(f), s.length - 2);
    out.push(mix(s[j], s[j + 1], f - j));
  }
  skyBands[e] = out;
}

/* ---------------------------------------------------------
 *  TILE RENDER
 * --------------------------------------------------------- */
const inHouse = tx => tx >= 67 && tx <= 99;

function drawWallpaper(c, era, tx, ty, sx, sy) {
  const P = PAL[era], h = hash(tx, ty + 50);
  R(c, sx, sy, 16, 16, P.wall);
  for (let k = 1; k < 16; k += 4) R(c, sx + k, sy, 1, 16, P.wallStripe);
  if (era === 'past' && (h & 3) === 0) R(c, sx + 6, sy + 6, 2, 2, P.wallStripe);
  // 하단 판넬(징두리)
  if (ty === 8) R(c, sx, sy, 16, 16, P.panel);
  if (ty === 7 || ty === 4) { R(c, sx, sy + 9, 16, 7, P.panel); R(c, sx, sy + 8, 16, 1, P.beamDark); }
  if (era === 'present') {
    if (h % 5 === 0) R(c, sx + (h % 8), sy + ((h >> 4) % 8), 7, 5, P.stain);
    if (h % 7 === 0) {
      const px = sx + ((h >> 3) % 6), py = sy + ((h >> 6) % 6);
      R(c, px, py, 8, 8, P.boards); R(c, px, py + 3, 8, 1, P.beamDark);
    }
    if (h % 11 === 0) R(c, sx + 3, sy + ((h >> 5) % 10), 1, 6, P.beamDark); // 금
  }
}

function drawTile(c, era, ch, tx, ty, sx, sy, t) {
  const P = PAL[era], h = hash(tx, ty);
  switch (ch) {
    case '#': {
      const top = tileAt(era, tx, ty - 1) !== '#';
      R(c, sx, sy, 16, 16, P.dirt);
      if (h % 3 === 0) R(c, sx + (h % 13), sy + 6 + ((h >> 3) % 8), 2, 1, P.dirtDark);
      if (h % 4 === 1) R(c, sx + ((h >> 5) % 13), sy + 9 + ((h >> 7) % 5), 3, 2, P.dirtDark);
      if (top && inHouse(tx)) {
        // 집 안: 마룻바닥
        R(c, sx, sy, 16, 4, P.plank); R(c, sx, sy + 4, 16, 1, P.plankDark);
        R(c, sx + (h % 2 ? 5 : 11), sy, 1, 4, P.plankDark);
        if (era === 'present' && h % 4 === 0) R(c, sx + 2, sy + 1, 4, 2, P.plankDark);
      } else if (top) {
        R(c, sx, sy, 16, 4, P.grass); R(c, sx, sy + 4, 16, 1, P.grassDark);
        for (let i = 0; i < 4; i++) {
          const bx = sx + ((h >> (i * 4)) % 15);
          const bh = era === 'present' ? 1 + ((h >> (i * 3)) % 4) : 1 + ((h >> i) & 1);
          R(c, bx, sy - bh, 1, bh, i % 2 ? P.grassTip : P.grass);
        }
      }
      break;
    }
    case 'B': {
      R(c, sx, sy, 16, 16, P.stone);
      for (let r = 0; r < 4; r++) {
        R(c, sx, sy + r * 4 + 3, 16, 1, P.stoneDark);
        R(c, sx + ((r % 2) ? 3 : 10), sy + r * 4, 1, 3, P.stoneDark);
      }
      R(c, sx + 1, sy + 1, 4, 1, P.stoneLight);
      const capTop = tileAt(era, tx, ty - 1) !== 'B';
      if (capTop) { R(c, sx - 1, sy - 2, 18, 3, P.stoneLight); R(c, sx - 1, sy + 1, 18, 1, P.stoneDark); }
      if (era === 'present') {
        if (h % 2) { R(c, sx + 6, sy + 2, 1, 5, '#2e2a33'); R(c, sx + 7, sy + 7, 1, 4, '#2e2a33'); }
        R(c, sx + (h % 10), sy + 12, 6, 4, P.moss);
        if (capTop) R(c, sx + 2, sy - 3, 9, 2, P.moss);
      }
      break;
    }
    case 'H': {
      R(c, sx, sy, 16, 16, P.plaster);
      R(c, sx, sy, 3, 16, P.beam); R(c, sx + 13, sy, 3, 16, P.beam);
      if (ty % 3 === 2) R(c, sx, sy + 7, 16, 2, P.beam);
      if (era === 'present') {
        if (h % 2) R(c, sx + 4, sy + 3, 6, 6, P.stain);
        R(c, sx + 5, sy + (h % 9), 1, 5, P.beamDark);
        if (h % 3 === 0) R(c, sx, sy + 13, 16, 3, P.moss);
      }
      break;
    }
    case 'W': {
      R(c, sx, sy, 16, 4, P.plank); R(c, sx, sy + 4, 16, 2, P.plankDark);
      R(c, sx, sy + 6, 16, 10, P.beamDark);
      R(c, sx + (h % 2 ? 4 : 12), sy, 1, 4, P.plankDark);
      R(c, sx + 6, sy + 6, 3, 10, P.beam);
      if (era === 'present') {
        if (tileAt(era, tx - 1, ty) === '.') { R(c, sx, sy + 4, 3, 12, '#1a1418'); R(c, sx - 2, sy + 1, 3, 2, P.plankDark); }
        if (tileAt(era, tx + 1, ty) === '.') { R(c, sx + 13, sy + 4, 3, 12, '#1a1418'); R(c, sx + 15, sy + 2, 3, 2, P.plankDark); }
      }
      break;
    }
    case 'S': {
      R(c, sx, sy, 16, 16, P.beamDark);
      R(c, sx, sy, 16, 4, P.plank); R(c, sx, sy + 4, 16, 1, P.plankDark);
      R(c, sx + 2, sy + 6, 12, 1, P.beam);
      break;
    }
    case '=': {
      const broken = era === 'present';
      R(c, sx, sy, 16, 4, P.plank); R(c, sx, sy + 4, 16, 1, P.plankDark);
      R(c, sx + (h % 2 ? 5 : 10), sy, 1, 4, P.plankDark);
      R(c, sx + 6, sy + 5, 3, 13, P.beamDark);                        // 교각
      if (!broken || tx === 37) {
        R(c, sx + 7, sy - 9, 2, 9, P.beam);                           // 난간 기둥
        if (!broken) R(c, sx, sy - 8, 16, 2, P.beam);                 // 난간
        else R(c, sx + 2, sy - 8, 6, 2, P.beam);
      }
      if (broken) { // 부러진 끝
        const edge = tx === 37 ? sx + 13 : sx;
        R(c, edge, sy, 3, 4, '#1c1a20'); R(c, edge + (tx === 37 ? 1 : 0), sy + 1, 2, 2, P.plankDark);
      }
      break;
    }
    case 'T': {
      R(c, sx, sy + 1, 16, 4, P.bark); R(c, sx, sy + 1, 16, 1, P.barkLight);
      R(c, sx, sy + 5, 16, 1, P.beamDark);
      disc(c, sx + 3 + (h % 10), sy - 2, 3, P.leaf);
      if (h % 2) disc(c, sx + 10, sy - 1, 2, P.leaf3);
      break;
    }
    case 'D': {
      const isBottom = tileAt(era, tx, ty - 1) === 'D';
      R(c, sx + 1, sy, 14, 16, P.door);
      R(c, sx + 1, sy, 1, 16, P.beamDark); R(c, sx + 14, sy, 1, 16, P.beamDark);
      if (!isBottom) { R(c, sx + 1, sy, 14, 2, P.beamDark); R(c, sx + 4, sy + 4, 8, 9, P.plankDark); }
      else { R(c, sx + 4, sy + 1, 8, 9, P.plankDark); R(c, sx + 11, sy + 1, 2, 2, '#e0c060'); R(c, sx + 10, sy + 4, 2, 3, '#444'); }
      break;
    }
    case 'R': {
      const top = tileAt(era, tx, ty - 1) !== 'R';
      R(c, sx, sy + (top ? 4 : 0), 16, top ? 12 : 16, P.stoneDark);
      const cols = [P.brick, P.stone, P.plankDark, P.stoneLight];
      for (let i = 0; i < 6; i++) {
        const v = hash(tx * 7 + i, ty);
        R(c, sx + (v % 13), sy + (top ? 2 : 0) + ((v >> 4) % 12), 3 + (v % 4), 2 + ((v >> 2) % 3), cols[i % 4]);
      }
      if (top) { R(c, sx + 2, sy + 1, 6, 3, P.plankDark); R(c, sx + 9, sy - 2, 2, 6, P.beam); }
      break;
    }
    case 'F': {
      const lEnd = tx === 65 || tx === 68, rEnd = tx === 101 || tx === 98;
      for (let i = 0; i < 16; i++) {
        let x0 = 0, w = 16;
        if (lEnd) { x0 = 15 - i; w = i + 1; }
        if (rEnd) { x0 = 0; w = i + 1; }
        R(c, sx + x0, sy + i, w, 1, i % 4 === 3 ? P.roofDark : P.roof);
      }
      if (!lEnd && !rEnd) {
        for (let r = 0; r < 4; r++) R(c, sx + ((r % 2) ? 4 : 12), sy + r * 4, 1, 3, P.roofDark);
        R(c, sx + 2, sy + 1, 3, 1, P.roofLight);
      }
      if (era === 'present') {
        const nb = tileAt(era, tx - 1, ty) === '.' && tx > 66 ? -1 : tileAt(era, tx + 1, ty) === '.' && tx < 100 ? 1 : 0;
        if (nb) { // 깨진 가장자리
          const ex = nb < 0 ? sx : sx + 12;
          for (let i = 0; i < 16; i += 3) R(c, ex + (hash(tx, i) % 3), sy + i, 3, 2, '#1c1a20');
        }
        if (h % 3 === 0) R(c, sx + 5, sy + 6, 5, 3, P.moss);
      }
      break;
    }
    case '~': {
      R(c, sx, sy, 16, 16, P.water);
      if (tileAt(era, tx, ty - 1) !== '~') {
        R(c, sx, sy, 16, 2, P.waterLight);
        R(c, sx + ((Math.floor(t / 8) + h) % 14), sy + 1, 3, 1, P.waterSpark);
      } else if (h % 3 === 0) R(c, sx + ((Math.floor(t / 12) + h) % 12), sy + 6, 4, 1, P.waterLight);
      break;
    }
  }
}

/* ---------------------------------------------------------
 *  PROP RENDER
 * --------------------------------------------------------- */
function person(c, x, by, o, t) {
  const h = o.h || 16;
  const jump = o.jump ? Math.floor(Math.abs(Math.sin(t * 0.1 + x)) * 6) : 0;
  const y = by - h - jump;
  R(c, x + 2, y + 2, 6, 5, o.skin);
  R(c, x + 2, y, 6, 3, o.hair);
  if (o.bun) R(c, x + (o.face > 0 ? 1 : 7), y - 1, 2, 3, o.hair);
  R(c, x + (o.face > 0 ? 2 : 6), y + 2, 2, 3, o.hair);
  R(c, x + (o.face > 0 ? 6 : 3), y + 4, 1, 1, '#222');
  R(c, x + 1, y + 7, 8, h - 10, o.top);
  if (o.apron) R(c, x + 3, y + 8, 4, h - 11, '#f2f2f2');
  R(c, x + 2, y + h - 3, 2, 3, o.bottom); R(c, x + 6, y + h - 3, 2, 3, o.bottom);
}

function drawProp(c, p, era, camX, t) {
  const P = PAL[era];
  const sx = Math.round(p.x * T - camX), by = Math.round(p.by * T);
  switch (p.k) {
    case 'sign':
      if (era === 'past') {
        R(c, sx + 7, by - 18, 2, 18, P.beam);
        R(c, sx, by - 21, 17, 9, P.plankLight); R(c, sx, by - 13, 17, 1, P.plankDark);
        R(c, sx + 2, by - 19, 5, 1, P.beamDark); R(c, sx + 9, by - 19, 6, 1, P.beamDark); R(c, sx + 3, by - 16, 11, 1, P.beamDark);
      } else {
        R(c, sx + 7, by - 16, 2, 16, P.beamDark);
        for (let i = 0; i < 8; i++) R(c, sx + 1 + i * 2, by - 19 + Math.floor(i * 0.6), 2, 7, i === 6 ? P.rust : P.plankDark);
        R(c, sx + 3, by - 16, 3, 1, '#2a201a'); R(c, sx + 9, by - 13, 3, 1, '#2a201a');
        R(c, sx + 13, by - 2, 3, 2, P.plankDark); // 떨어진 조각
      }
      break;
    case 'lamp':
      if (era === 'past') {
        R(c, sx + 7, by - 32, 2, 32, P.metal); R(c, sx + 4, by - 36, 8, 3, P.beamDark);
        R(c, sx + 5, by - 33, 6, 4, '#fff8c0');
      } else {
        R(c, sx + 7, by - 22, 2, 22, P.rust);
        R(c, sx + 8, by - 26, 2, 4, P.rust); R(c, sx + 10, by - 28, 2, 3, P.rust);
        R(c, sx + 11, by - 27, 5, 3, P.metal); R(c, sx + 12, by - 24, 3, 2, '#2a2228');
      }
      break;
    case 'weeds':
      for (let i = 0; i < 6; i++) {
        const v = hash(Math.round(p.x * 10), i), hh = 4 + (v % 9);
        const sw = Math.sin(t * 0.03 + i + p.x) > 0.6 ? 1 : 0;
        R(c, sx + i * 2 + (v & 1), by - hh, 1, hh - 2, i % 2 ? P.grassTip : P.grassDark);
        R(c, sx + i * 2 + (v & 1) + sw, by - hh - 1, 1, 2, P.grassTip);
      }
      break;
    case 'flowers':
      ['#e85a7a', '#f2d04a', '#ffffff', '#8a6ad8'].forEach((col, i) => {
        R(c, sx + i * 4 + 1, by - 5, 1, 5, P.grassDark); R(c, sx + i * 4, by - 7, 3, 2, col);
      });
      break;
    case 'npc':
      person(c, sx, by, { hair: '#d8d8d8', bun: true, skin: P.skin, top: '#8a5a8a', bottom: '#4a3a3a', face: 1, h: 17 }, t);
      R(c, sx + 9, by - 9, 4, 5, '#c8a060'); // 바구니
      break;
    case 'kid':
      person(c, sx, by, {
        hair: '#2a2020', skin: P.skin, top: p.v === 1 ? '#e05050' : '#5080e0', bottom: '#3a3a5a',
        face: p.v === 1 ? 1 : -1, h: 12, jump: true,
      }, t);
      break;
    case 'mom':
      person(c, sx, by, { hair: '#3a2a20', bun: true, skin: P.skin, top: '#6a8a6a', bottom: '#4a3a3a', face: -1, h: 17, apron: true }, t);
      break;
    case 'well':
      R(c, sx, by - 12, 24, 12, P.stone); R(c, sx, by - 12, 24, 2, P.stoneLight);
      for (let i = 0; i < 4; i++) R(c, sx + 3 + i * 6, by - 9 + (i % 2) * 4, 1, 3, P.stoneDark);
      R(c, sx, by - 6, 24, 1, P.stoneDark);
      R(c, sx + 3, by - 13, 18, 2, '#1a1418');
      if (era === 'past') {
        R(c, sx + 2, by - 30, 2, 18, P.beam); R(c, sx + 20, by - 30, 2, 18, P.beam);
        R(c, sx - 2, by - 34, 28, 4, P.roof); R(c, sx, by - 36, 24, 2, P.roofLight);
        R(c, sx + 4, by - 28, 16, 1, P.beamDark);
        R(c, sx + 12, by - 28, 1, 8, P.beamDark); R(c, sx + 10, by - 21, 5, 4, P.plank);
      } else {
        R(c, sx + 2, by - 24, 2, 12, P.beamDark); R(c, sx + 20, by - 16, 2, 4, P.beamDark);
        for (let i = 0; i < 6; i++) R(c, sx + 14 + i * 2, by - 6 - i * 2, 3, 2, P.roofDark); // 쓰러진 지붕
        R(c, sx + 1, by - 12, 6, 2, P.moss); R(c, sx + 15, by - 8, 5, 3, P.moss);
      }
      break;
    case 'crow': {
      const y = by - 4 - (Math.floor(t / 40) % 3 === 0 ? 1 : 0), f = Math.floor(t / 200) % 2 ? 1 : -1;
      R(c, sx, y, 6, 3, '#1c1a20'); R(c, sx + (f > 0 ? 5 : -1), y - 1, 2, 2, '#1c1a20');
      R(c, sx + (f > 0 ? 7 : -2), y, 1, 1, '#c9a040'); R(c, sx + (f > 0 ? -2 : 6), y + 1, 2, 1, '#1c1a20');
      R(c, sx + 2, y + 3, 1, 1, '#c9a040');
      break;
    }
    case 'stall':
      for (let k = 0; k < 10; k++) R(c, sx - 2 + k * 4.4, by - 32, 5, 5, k % 2 ? '#e04a4a' : '#ffffff');
      R(c, sx, by - 28, 2, 28, P.beam); R(c, sx + 38, by - 28, 2, 28, P.beam);
      R(c, sx, by - 12, 40, 2, P.plank); R(c, sx + 2, by - 10, 36, 1, P.plankDark);
      R(c, sx + 4, by - 10, 2, 10, P.beamDark); R(c, sx + 34, by - 10, 2, 10, P.beamDark);
      for (let i = 0; i < 5; i++) disc(c, sx + 8 + i * 6, by - 14, 2, i % 2 ? '#d84040' : '#e8c040');
      break;
    case 'plankL':
      for (let k = 0; k < 6; k++) R(c, sx + k, by + 3 + k * 3, 3, 3, P.plankDark);
      R(c, sx + 3, by + 4, 1, 10, P.beam);
      break;
    case 'plankR':
      for (let k = 0; k < 5; k++) R(c, sx + 13 - k, by + 3 + k * 3, 3, 3, P.plankDark);
      break;
    case 'fisher':
      R(c, sx + 2, by - 9, 8, 6, '#5a6a8a'); R(c, sx + 2, by - 3, 3, 3, '#3a3a4a'); R(c, sx - 2, by - 3, 4, 2, '#3a3a4a');
      R(c, sx + 3, by - 14, 6, 5, P.skin); R(c, sx + 4, by - 12, 1, 1, '#222');
      R(c, sx + 2, by - 16, 8, 2, '#c8b070'); R(c, sx + 4, by - 17, 4, 1, '#c8b070');
      for (let k = 0; k < 8; k++) R(c, sx + 1 - k * 2, by - 10 - k, 2, 1, P.beamDark); // 낚싯대
      R(c, sx - 15, by - 17, 1, 33, 'rgba(255,255,255,0.7)');
      R(c, sx - 16, by + 14 + (Math.floor(t / 30) % 2), 3, 2, '#e04a4a');
      break;
    case 'sapling':
      R(c, sx + 7, by - 18, 2, 18, P.bark);
      disc(c, sx + 8, by - 22, 5, P.leaf); disc(c, sx + 5, by - 19, 3, P.leaf2);
      R(c, sx + 12, by - 12, 1, 12, P.beam); R(c, sx + 9, by - 11, 3, 1, P.beam);
      break;
    case 'bigtree': {
      R(c, sx - 3, by - 6, 22, 6, P.bark);
      R(c, sx + 1, by - 120, 14, 120, P.bark); R(c, sx + 3, by - 120, 2, 120, P.barkLight);
      R(c, sx + 9, by - 70, 2, 14, P.beamDark); disc(c, sx + 10, by - 40, 2, '#1c1612');
      const cx = sx + 8, cy = by - 122;
      [[-42, 6, 20, P.leaf], [38, 4, 20, P.leaf], [0, -6, 28, P.leaf], [-22, 20, 16, P.leaf2],
       [24, 22, 16, P.leaf2], [-6, 14, 18, P.leaf3], [16, -2, 14, P.leaf2], [-30, -8, 12, P.leaf3]]
        .forEach(([dx, dy, r, col]) => disc(c, cx + dx, cy + dy, r, col));
      break;
    }
    case 'gate':
      R(c, sx + 3, by - 30, 26, 30, P.door);
      for (let i = 0; i < 5; i++) R(c, sx + 3 + i * 5, by - 30, 1, 30, P.beamDark);
      R(c, sx + 3, by - 22, 26, 2, P.beamDark); R(c, sx + 3, by - 9, 26, 2, P.beamDark);
      R(c, sx + 14, by - 16, 4, 4, era === 'past' ? '#c8a040' : P.rust);
      if (era === 'present') { R(c, sx + 4, by - 30, 3, 24, P.moss); R(c, sx + 22, by - 14, 6, 14, P.moss); }
      break;
    case 'laundry':
      if (era === 'past') {
        R(c, sx, by - 30, 2, 30, P.beam); R(c, sx + 46, by - 30, 2, 30, P.beam);
        R(c, sx + 2, by - 28, 44, 1, '#dddddd');
        const sw = Math.floor(t / 20) % 2;
        R(c, sx + 7, by - 27, 9, 10 + sw, '#e86a6a'); R(c, sx + 20, by - 27, 7, 8, '#6a9ae8'); R(c, sx + 31, by - 27, 10, 7 - sw, '#f2e08a');
      } else {
        R(c, sx, by - 26, 2, 26, P.beamDark);
        R(c, sx + 2, by - 24, 9, 1, '#8a8478'); R(c, sx + 6, by - 23, 4, 7, P.cloth);
        R(c, sx + 22, by - 3, 28, 2, P.beamDark);
      }
      break;
    case 'dog': {
      const wag = Math.floor(t / 6) % 2;
      R(c, sx, by - 7, 10, 5, '#c89a5a'); R(c, sx + 8, by - 11, 6, 5, '#c89a5a'); R(c, sx + 8, by - 12, 2, 2, '#7a5a3a');
      R(c, sx + 12, by - 9, 1, 1, '#222'); R(c, sx + 14, by - 8, 1, 1, '#222');
      R(c, sx + 1, by - 2, 2, 2, '#a07a40'); R(c, sx + 7, by - 2, 2, 2, '#a07a40');
      R(c, sx - 2, by - 8 - wag, 2, 2, '#c89a5a');
      break;
    }
    case 'window':
      R(c, sx + 2, by - 20, 12, 14, P.beam);
      if (era === 'past') {
        R(c, sx + 3, by - 19, 10, 12, '#d6ecf8'); R(c, sx + 8, by - 19, 1, 12, P.beam); R(c, sx + 3, by - 14, 10, 1, P.beam);
        R(c, sx + 2, by - 20, 3, 15, '#e07a7a'); R(c, sx + 11, by - 20, 3, 15, '#e07a7a');
      } else {
        R(c, sx + 3, by - 19, 10, 12, '#1e1a22');
        R(c, sx + 3, by - 19, 3, 4, '#5a6a72'); R(c, sx + 9, by - 10, 4, 3, '#5a6a72'); R(c, sx + 11, by - 19, 2, 2, '#5a6a72');
        R(c, sx + 4, by - 13, 9, 1, P.beamDark);
      }
      break;
    case 'table':
      if (era === 'past') {
        R(c, sx, by - 10, 22, 2, P.plank); R(c, sx + 1, by - 8, 2, 8, P.beamDark); R(c, sx + 19, by - 8, 2, 8, P.beamDark);
        R(c, sx + 5, by - 12, 5, 2, '#f0f0f0'); R(c, sx + 13, by - 13, 3, 3, '#e0e0e0');
      } else {
        for (let k = 0; k < 11; k++) R(c, sx + k * 2, by - 3 - Math.floor(k * 0.6), 2, 2, P.plankDark);
        R(c, sx + 19, by - 8, 2, 8, P.beamDark); R(c, sx + 3, by - 2, 4, 2, '#cfcfcf');
      }
      break;
    case 'chair':
      if (era === 'past') {
        R(c, sx, by - 7, 8, 1, P.plank); R(c, sx, by - 15, 1, 15, P.beamDark); R(c, sx + 7, by - 6, 1, 6, P.beamDark);
      } else { R(c, sx, by - 2, 13, 2, P.plankDark); R(c, sx + 11, by - 7, 2, 7, P.beamDark); }
      break;
    case 'clock': {
      R(c, sx + 4, by - 26, 8, 24, P.beamDark); R(c, sx + 5, by - 25, 6, 22, P.beam);
      disc(c, sx + 8, by - 21, 3, era === 'past' ? '#f6f0dc' : '#8a8270');
      R(c, sx + 8, by - 23, 1, 2, '#222'); R(c, sx + 8, by - 21, 2, 1, '#222');
      const px = sx + 8 + (era === 'past' ? Math.round(Math.sin(t * 0.08) * 2) : 0);
      R(c, px, by - 16, 1, 8, '#c8a040'); R(c, px - 1, by - 9, 3, 2, '#c8a040');
      if (era === 'present') R(c, sx + 6, by - 23, 1, 3, '#d8d8d8');
      break;
    }
    case 'puddle': {
      R(c, sx, by - 1, 18, 1, P.waterLight); R(c, sx + 3, by - 2, 11, 1, P.water);
      const dy = (t * 1.6) % (by - 20);
      R(c, sx + 9, 20 + dy, 1, 2, P.waterSpark);
      break;
    }
    case 'stove':
      R(c, sx, by - 14, 16, 14, P.metal); R(c, sx - 1, by - 15, 18, 2, '#3a3a3a'); R(c, sx + 3, by - 10, 10, 6, '#2a2a2a');
      if (era === 'past') {
        R(c, sx + 4, by - 7, 8, 2, '#f08a3a'); R(c, sx + 3, by - 20, 9, 5, '#9a9a9a'); R(c, sx + 2, by - 20, 11, 1, '#6a6a6a');
        for (let s = 0; s < 3; s++) {
          const ph = (t * 0.015 + s / 3) % 1;
          disc(c, sx + 7 + ph * 4, by - 22 - ph * 14, 1 + Math.floor(ph * 2), 'rgba(255,255,255,' + (0.6 * (1 - ph)).toFixed(2) + ')');
        }
      } else { R(c, sx + 2, by - 12, 4, 3, P.rust); R(c, sx + 10, by - 4, 5, 3, P.rust); }
      break;
    case 'cobweb': {
      const f = p.flip ? -1 : 1, ox = p.flip ? sx + 15 : sx, oy = by;
      for (let k = 0; k < 10; k++) {
        R(c, ox + f * k, oy + k, 1, 1, 'rgba(235,235,235,0.55)');
        R(c, p.flip ? ox - (10 - k) + 1 : ox, oy + k, 10 - k, 1, 'rgba(230,230,230,0.12)');
      }
      R(c, p.flip ? ox - 9 : ox, oy + 4, 10, 1, 'rgba(235,235,235,0.3)');
      break;
    }
    case 'bed':
      if (era === 'past') {
        R(c, sx, by - 8, 30, 8, P.beam); R(c, sx + 1, by - 11, 28, 4, '#f4f4f4'); R(c, sx + 9, by - 12, 20, 5, '#6a8ad8');
        R(c, sx + 2, by - 13, 6, 3, '#ffffff'); R(c, sx, by - 18, 3, 18, P.beam);
      } else {
        R(c, sx, by - 6, 30, 6, P.beamDark); R(c, sx + 1, by - 9, 28, 3, '#7a7268'); R(c, sx + 10, by - 10, 18, 4, '#55556a');
        R(c, sx + 14, by - 9, 3, 2, '#3a3238'); R(c, sx, by - 12, 3, 12, P.beamDark);
      }
      break;
    case 'desk':
      R(c, sx, by - 12, 18, 2, P.plank); R(c, sx + 1, by - 10, 2, 10, P.beamDark); R(c, sx + 15, by - 10, 2, 10, P.beamDark);
      if (era === 'past') { R(c, sx + 3, by - 15, 7, 3, '#5a7ac8'); R(c, sx + 4, by - 17, 6, 2, '#c85a5a'); R(c, sx + 13, by - 19, 2, 7, '#444'); R(c, sx + 11, by - 20, 6, 2, '#f2d04a'); }
      else { R(c, sx + 4, by - 2, 6, 2, '#4a5a7a'); R(c, sx + 11, by - 2, 5, 2, '#6a4a4a'); }
      break;
    case 'photo': {
      if (era === 'past') {
        const pulse = 0.18 + Math.abs(Math.sin(t * 0.05)) * 0.2;
        disc(c, sx + 8, by - 8, 11, 'rgba(255,255,255,' + pulse.toFixed(2) + ')');
        R(c, sx + 2, by - 14, 12, 12, '#b08a3a'); R(c, sx + 3, by - 13, 10, 10, '#ece4d4');
        R(c, sx + 4, by - 11, 2, 2, '#444'); R(c, sx + 4, by - 9, 2, 5, '#666');
        R(c, sx + 7, by - 12, 2, 2, '#444'); R(c, sx + 7, by - 10, 2, 6, '#555');
        R(c, sx + 10, by - 8, 2, 2, '#444'); R(c, sx + 10, by - 6, 2, 2, '#777');
      } else {
        R(c, sx + 2, by - 13, 12, 12, P.beamDark); R(c, sx + 3, by - 12, 10, 10, '#8a7c66');
        R(c, sx + 4, by - 10, 4, 4, '#9a8c74');
        R(c, sx + 4, by - 12, 1, 1, '#d8d8d8'); R(c, sx + 5, by - 11, 1, 1, '#d8d8d8'); R(c, sx + 6, by - 10, 1, 1, '#d8d8d8');
      }
      break;
    }
    case 'toy':
      disc(c, sx + 8, by - 3, 3, '#e04a4a'); R(c, sx + 5, by - 3, 7, 1, '#ffffff');
      break;
    case 'vendor': // 시장 아저씨 (좌판 뒤에 서 있음)
      person(c, sx, by, { hair: '#3a2a20', skin: P.skin, top: '#4a6a9a', bottom: '#3a3a4a', face: -1, h: 18, apron: true }, t);
      R(c, sx + 1, by - 19, 8, 2, '#c84a3a'); R(c, sx - 1, by - 17, 4, 1, '#c84a3a'); // 모자
      R(c, sx + 2, by - 12, 3, 1, '#3a2a20');                                       // 콧수염
      if (Math.floor(t / 50) % 4 === 0) R(c, sx - 2, by - 11, 2, 2, P.skin);          // 손짓
      break;
    case 'soil': // 과거: 볕 드는 빈터 (사과를 심을 자리)
      R(c, sx + 1, by - 3, 14, 3, P.dirtDark); R(c, sx + 3, by - 4, 10, 1, P.dirtDark);
      R(c, sx + 4, by - 3, 2, 1, P.dirt); R(c, sx + 10, by - 2, 2, 1, P.dirt);
      R(c, sx + 12, by - 10, 1, 10, P.beam); R(c, sx + 11, by - 10, 3, 1, P.beam); // 작은 말뚝
      if (hasApple && Math.floor(t / 20) % 2) R(c, sx + 7, by - 8, 2, 2, '#ffffff'); // 반짝임
      break;
    case 'emptylot': // 현재: 메마른 빈터
      R(c, sx + 1, by - 2, 14, 2, P.dirtDark);
      R(c, sx + 3, by - 1, 4, 1, '#2a201a'); R(c, sx + 9, by - 2, 1, 2, '#2a201a');
      for (let i = 0; i < 4; i++) R(c, sx + 2 + i * 4, by - 4 - (i % 2) * 2, 1, 4 + (i % 2) * 2, '#7a6a3a');
      R(c, sx + 12, by - 4, 3, 2, P.stone);
      break;
  }
}

// 그림자 몬스터 (현재에만)
function drawMonster(c, m, camX, t) {
  const x = Math.round(m.x - camX), y = Math.round(m.y + Math.sin(t * 0.08 + m.x0) * 1.5);
  R(c, x - 1, y + 4, 1, 5, 'rgba(170,90,210,0.5)'); R(c, x + m.w, y + 4, 1, 5, 'rgba(170,90,210,0.5)');
  R(c, x + 3, y, 6, 1, '#3a1a4a');
  R(c, x + 1, y + 1, 10, 2, '#2a1236');
  R(c, x, y + 3, 12, 6, '#1c0c26');
  for (let i = 0; i < 4; i++) R(c, x + i * 3, y + 9, 3, 2 + ((Math.floor(t / 6) + i) % 2), '#1c0c26');
  const ex = m.dir > 0 ? x + 6 : x + 2;
  R(c, ex, y + 4, 2, 2, '#ff5a4a'); R(c, ex + 3, y + 4, 1, 2, '#ff5a4a');
}

/* ---------------------------------------------------------
 *  WORLD RENDER (한 시간대 전체를 그림)
 * --------------------------------------------------------- */
const DUST = Array.from({ length: 34 }, (_, i) => ({ x: hash(i, 1) % VW, y: hash(i, 2) % VH, s: 0.4 + (hash(i, 3) % 10) / 10 }));
const wrapMod = (v, m) => ((v % m) + m) % m;

function renderWorld(c, era, camX, w, h, t, overview) {
  const P = PAL[era];
  // 하늘(밴드 그라데이션)
  const bands = skyBands[era], bh = Math.ceil(h / bands.length);
  bands.forEach((col, i) => R(c, 0, i * bh, w, bh, col));
  if (era === 'present') {
    disc(c, 236 - camX * 0.03, 126, 22, 'rgba(255,200,120,0.25)');
    disc(c, 236 - camX * 0.03, 126, 15, P.sun);
    for (let i = 0; i < 5; i++) R(c, wrapMod(i * 137 - camX * 0.08, w + 200) - 100, 30 + i * 14, 60 + i * 9, 2, 'rgba(60,40,70,0.55)');
  } else {
    disc(c, 60 - camX * 0.03, 34, 10, P.sun);
    for (let i = 0; i < Math.ceil(w / 90) + 2; i++) {
      const cx = wrapMod(i * 97 + t * 0.08 - camX * 0.1, w + 120) - 60, cy = 22 + (i % 3) * 12;
      R(c, cx, cy, 26, 6, '#ffffff'); R(c, cx + 5, cy - 4, 14, 4, '#ffffff'); R(c, cx + 2, cy + 6, 22, 2, '#e6eef6');
    }
  }
  // 먼 산 2겹
  for (let x = 0; x < w; x += 2) {
    const wx = x + camX * 0.15;
    const hg = 42 + 16 * Math.sin(wx * 0.013) + 9 * Math.sin(wx * 0.037 + 1);
    R(c, x, 150 - hg, 2, hg, P.mount);
  }
  for (let x = 0; x < w; x += 2) {
    const wx = x + camX * 0.3;
    const hg = 24 + 10 * Math.sin(wx * 0.021 + 2) + 6 * Math.sin(wx * 0.05);
    R(c, x, 150 - hg, 2, hg, P.mount2);
  }
  // 배경 집들 (패럴랙스 0.5)
  const par = camX * 0.5;
  for (let i = Math.floor((par - 120) / 110); i <= Math.ceil((par + w + 120) / 110); i++) {
    const hx = i * 110 + 30 - par, hw = 40 + hash(i, 1) % 24, hh = 22 + hash(i, 2) % 16, base = 146;
    if (hx > w + 60 || hx + hw < -60) continue;
    if (era === 'present' && hash(i, 3) % 3 === 0) { // 완전히 무너진 집
      for (let x = 0; x < hw; x += 3) R(c, hx + x, base - (6 + hash(i, x) % 14), 3, 20, P.bgHouse);
      continue;
    }
    R(c, hx, base - hh, hw, hh, P.bgHouse);
    for (let k = 0; k < 10; k++) {
      let rw = hw + 4 - 2 * k;
      if (era === 'present') rw = Math.max(0, Math.floor(rw * (0.35 + (hash(i, k + 9) % 50) / 100)));
      R(c, hx - 2 + k, base - hh - 1 - k, rw, 1, P.bgRoof);
    }
    R(c, hx + 6, base - hh + 6, 6, 6, P.bgWin); R(c, hx + hw - 12, base - hh + 6, 6, 6, P.bgWin);
    if (era === 'past') {
      R(c, hx + hw - 14, base - hh - 12, 4, 8, P.bgRoof);
      for (let s = 0; s < 3; s++) {
        const ph = (t * 0.006 + s / 3 + i * 0.13) % 1;
        disc(c, hx + hw - 12 + ph * 8, base - hh - 15 - ph * 26, 1 + Math.floor(ph * 3), 'rgba(255,255,255,' + (0.7 * (1 - ph)).toFixed(2) + ')');
      }
    } else {
      R(c, hx + 6, base - hh + 8, 6, 1, P.bgRoof); R(c, hx + hw - 12, base - hh + 9, 6, 1, P.bgRoof);
      R(c, hx + hw - 6, base - hh + 2, 2, hh, '#2a3a2a'); // 덩굴
    }
  }
  // 배경 레이어 프롭(큰 나무)
  for (const p of PROPS) if (p.bg && propOn(p, era)) drawProp(c, p, era, camX, t);
  // 집 내부 벽지
  const tx0 = Math.max(0, Math.floor(camX / T)), tx1 = Math.min(COLS - 1, Math.ceil((camX + w) / T));
  for (let tx = Math.max(67, tx0); tx <= Math.min(99, tx1); tx++)
    for (let ty = 2; ty <= 8; ty++) drawWallpaper(c, era, tx, ty, tx * T - camX, ty * T);
  // 현재: 지붕 구멍으로 들어오는 빛줄기
  if (era === 'present') {
    c.fillStyle = 'rgba(255,214,150,0.16)';
    for (const [a, b, bot] of [[72, 77, 144], [85, 89, 80]]) {
      c.beginPath();
      c.moveTo(a * T - camX, 32); c.lineTo(b * T - camX, 32);
      c.lineTo(b * T - camX + (bot - 32) * 0.2, bot); c.lineTo(a * T - camX + (bot - 32) * 0.2, bot);
      c.closePath(); c.fill();
    }
  }
  // 타일
  for (let ty = 0; ty < ROWS; ty++)
    for (let tx = tx0; tx <= tx1; tx++) {
      const ch = MAP[era][ty][tx];
      if (ch !== '.') drawTile(c, era, ch, tx, ty, tx * T - camX, ty * T, t);
    }
  // 프롭
  for (const p of PROPS) {
    if (p.bg || !propOn(p, era)) continue;
    const sx = p.x * T - camX;
    if (sx < -80 || sx > w + 80) continue;
    drawProp(c, p, era, camX, t);
  }
  // 현재: 그림자 몬스터 (실눈으로 과거에서 엿볼 때도 보인다)
  if (era === 'present')
    for (const m of MONSTERS) if (m.x - camX > -20 && m.x - camX < w + 20) drawMonster(c, m, camX, t);
  // 현재: 떠다니는 먼지
  if (era === 'present' && !overview)
    for (const d of DUST) {
      const x = (d.x + t * 0.12 * d.s) % w, y = wrapMod(d.y + Math.sin(t * 0.02 + d.x) * 4, VH);
      R(c, x, y, 1, 1, 'rgba(255,228,190,0.55)');
    }
}

// 과거 = 흑백 모노톤 + 필름 그레인
function monochrome(c, w, h, grain) {
  const img = c.getImageData(0, 0, w, h), d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    let l = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    l = (l - 128) * 1.12 + 128;
    if (grain) l += (Math.random() - 0.5) * 16;
    l = l < 0 ? 0 : l > 255 ? 255 : l;
    d[i] = d[i + 1] = d[i + 2] = l;
  }
  c.putImageData(img, 0, 0);
  if (grain && Math.random() < 0.08) { c.fillStyle = 'rgba(255,255,255,0.18)'; c.fillRect(Math.floor(Math.random() * w), 0, 1, h); }
}

/* ---------------------------------------------------------
 *  GAME STATE
 * --------------------------------------------------------- */
const cvs = document.getElementById('screen');
const D = cvs.getContext('2d');
const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const buf = mk(VW, VH), bctx = buf.getContext('2d', { willReadFrequently: true });
const peekBuf = mk(VW, VH), pctx = peekBuf.getContext('2d', { willReadFrequently: true });
let S = 3;
function resize() {
  S = Math.max(2, Math.floor(Math.min(innerWidth / VW, innerHeight / VH)));
  cvs.width = VW * S; cvs.height = VH * S;
}
addEventListener('resize', resize); resize();

const keys = new Set(), hits = new Set();
const GAME_KEYS = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space'];
addEventListener('keydown', e => {
  if (GAME_KEYS.includes(e.code)) e.preventDefault();
  if (!e.repeat) hits.add(e.code);
  keys.add(e.code);
});
addEventListener('keyup', e => keys.delete(e.code));
addEventListener('blur', () => keys.clear());
const down = (...c) => c.some(k => keys.has(k));
const hit = (...c) => c.some(k => hits.has(k));

let t = 0, state = 'title', era = 'present';
const P = { x: 0, y: 0, w: 10, h: 14, vx: 0, vy: 0, onGround: false, face: 1, anim: 0, coyote: 0, jumpBuf: 0 };
let safe = null, blink = { phase: 'none', t: 0 }, peek = 0, shake = 0;
const cam = { x: 0 };
let zone = '', banner = null, toast = null, bubble = null, found = false, blinkCount = 0, dying = false;
let overview = null;

const MAX_HP = 5;
let hp = MAX_HP, inv = 0, hasApple = false, hintedMonster = false;
let groundPos = null, airStart = null;   // 마지막으로 서 있던 곳 / 떨어지기 시작한 곳

function reset() {
  P.x = 2 * T + 3; P.y = 9 * T - P.h; P.vx = P.vy = 0; P.face = 1; P.knock = 0;
  era = 'present'; found = false; blinkCount = 0; dying = false;
  safe = { x: P.x, y: P.y, era };
  groundPos = { ...safe }; airStart = null;
  blink = { phase: 'none', t: 0 }; zone = '';
  hp = MAX_HP; inv = 0; hasApple = false; hintedMonster = false;
  setTree(false); resetMonsters();
  cam.x = 0;
}
reset();

// HP 1 감소. 0이 되면 게임 오버
function hurt() {
  hp = Math.max(0, hp - 1); inv = 90; shake = 10;
  if (hp <= 0) { state = 'gameover'; blink = { phase: 'none', t: 0 }; dying = false; return true; }
  return false;
}

function say(text, frames = 170) { toast = { text, t: frames }; }

function startBlink(cb) { blink = { phase: 'close', t: 0, cb }; }
function tryBlink() {
  if (blink.phase !== 'none' || dying) return;
  const target = other(era);
  // 깜빡인 뒤의 시간에서 같은 자리에 벽/문/잔해가 있으면 실패
  if (rectHitsSolid(target, P.x, P.y, P.w, P.h)) {
    blink = { phase: 'twitch', t: 0 }; shake = 8;
    say('…눈을 감을 수 없다. 그 시간, 이 자리엔 무언가가 있다.');
    return;
  }
  startBlink(() => { era = target; blinkCount++; });
}
function lidAmount() {
  const b = blink;
  let a = 0;
  if (b.phase === 'close') a = b.t / 9;
  else if (b.phase === 'hold') a = 1;
  else if (b.phase === 'open') a = 1 - b.t / 12;
  else if (b.phase === 'twitch') a = 0.4 * Math.sin(Math.PI * b.t / 16);
  else if (b.phase === 'shut') a = 1;
  // 웹캠 입력은 화면 눈꺼풀을 움직이지 않는다 (전환이 확정된 뒤에만 shut 연출)

  return Math.max(a * a * (3 - 2 * a), peek * 0.3);
}

/* ---------------------------------------------------------
 *  웹캠 눈 깜빡임 입력 (webcam-blink.js가 호출)
 *  eyeSwitch(): 실제 눈이 감긴 상태에서 시간 전환 → 눈을 뜰 때까지 화면은 감긴 채 유지
 *  eyeOpen():   실제 눈을 떴을 때 → 눈꺼풀 열림 연출
 * --------------------------------------------------------- */
function eyeSwitch() {
  if (state !== 'play' || dying || (blink.phase !== 'none' && blink.phase !== 'twitch')) return;
  const target = other(era);
  if (rectHitsSolid(target, P.x, P.y, P.w, P.h)) {
    blink = { phase: 'twitch', t: 0 }; shake = 8;
    say('…눈을 감았지만 시간이 넘어가지 않았다. 그 시간, 이 자리엔 무언가가 있다.');
    return;
  }
  era = target; blinkCount++;
  blink = { phase: 'shut', t: 0 };
}
function eyeOpen() {
  if (blink.phase === 'shut') blink = { phase: 'open', t: 0 };
}
// 추락: HP -1 후 지정 위치에서 다시 시작
function fallDamage(pos, msg) {
  if (dying) return;
  if (hurt()) return;
  dying = true;
  startBlink(() => {
    P.x = settleX(pos); P.y = pos.y; P.vx = P.vy = 0; P.knock = 0; era = pos.era; dying = false;
    groundPos = { x: P.x, y: P.y, era }; airStart = null;
    say(msg);
  });
}
// 복귀 지점이 낭떠러지 끝이면 두 발이 모두 바닥 위에 오도록 안쪽으로 옮긴다
function settleX(pos) {
  const row = Math.floor((pos.y + P.h) / T);
  const ok = x => solidAt(pos.era, Math.floor(x / T), row) && solidAt(pos.era, Math.floor((x + P.w - 0.01) / T), row)
    && !rectHitsSolid(pos.era, x, pos.y, P.w, P.h);
  for (let d = 0; d <= 24; d += 2) {
    if (ok(pos.x + d)) return pos.x + d;
    if (ok(pos.x - d)) return pos.x - d;
  }
  return pos.x;
}
const die = () => fallDamage(safe, '…물에 빠졌다. 정신을 차려 보니 물가였다. (HP -1)');

function moveX() {
  P.x += P.vx;
  const top = Math.floor(P.y / T), bot = Math.floor((P.y + P.h - 0.01) / T);
  if (P.vx > 0) {
    const cx = Math.floor((P.x + P.w - 0.01) / T);
    for (let r = top; r <= bot; r++) if (solidAt(era, cx, r)) { P.x = cx * T - P.w; P.vx = 0; break; }
  } else if (P.vx < 0) {
    const cx = Math.floor(P.x / T);
    for (let r = top; r <= bot; r++) if (solidAt(era, cx, r)) { P.x = (cx + 1) * T; P.vx = 0; break; }
  }
}
function moveY() {
  const prevBottom = P.y + P.h;
  P.y += P.vy; P.onGround = false;
  const l = Math.floor(P.x / T), r = Math.floor((P.x + P.w - 0.01) / T);
  if (P.vy > 0) {
    const row = Math.floor((P.y + P.h - 0.01) / T);
    for (let cx = l; cx <= r; cx++) {
      const ch = tileAt(era, cx, row);
      if (SOLID.has(ch) || (ONEWAY.has(ch) && prevBottom <= row * T + 0.5)) {
        P.y = row * T - P.h; P.vy = 0; P.onGround = true; break;
      }
    }
  } else if (P.vy < 0) {
    const row = Math.floor(P.y / T);
    for (let cx = l; cx <= r; cx++) if (solidAt(era, cx, row)) { P.y = (row + 1) * T; P.vy = 0; break; }
  }
}

function currentZone() {
  const tx = (P.x + P.w / 2) / T;
  if (tx >= 66 && tx <= 100 && P.y + P.h <= 5 * T + 1) return '옛 집 · 2층';
  let z = ZONES[0].name;
  for (const Z of ZONES) if (tx >= Z.x) z = Z.name;
  return z;
}

function update() {
  t++;
  if (state === 'title') {
    if (hits.size) { state = 'play'; say('X 키로 눈을 깜빡여 보자. C를 누르고 있으면 다른 시간이 어렴풋이 보인다.', 300); }
    return;
  }
  if (state === 'map') { if (hit('KeyM', 'Escape', 'Enter')) state = 'play'; return; }
  if (state === 'ending') {
    if (hit('Enter', 'Space', 'Escape')) state = 'play';
    if (hit('KeyR')) { reset(); state = 'play'; }
    return;
  }
  if (state === 'gameover') {
    if (hit('KeyR', 'Enter')) { reset(); state = 'play'; say('다시, 처음부터.'); }
    return;
  }
  if (hit('KeyM')) { openMap(); return; }
  if (hit('KeyR')) { reset(); say('처음 장소로 돌아왔다.'); }
  if (hit('KeyX')) tryBlink();

  // 깜빡임 진행: close(9f) → hold(6f, 이때 시간 전환) → open(12f)
  if (blink.phase !== 'none') {
    blink.t++;
    if (blink.phase === 'close' && blink.t >= 9) { blink.phase = 'hold'; blink.t = 0; if (blink.cb) blink.cb(); }
    else if (blink.phase === 'hold' && blink.t >= 6) { blink.phase = 'open'; blink.t = 0; }
    else if (blink.phase === 'open' && blink.t >= 12) blink = { phase: 'none', t: 0 };
    else if (blink.phase === 'twitch' && blink.t >= 16) blink = { phase: 'none', t: 0 };
    else if (blink.phase === 'shut' && blink.t >= 240) blink = { phase: 'open', t: 0 }; // 안전장치: 4초 후 자동으로 뜸
  }
  // 실눈 엿보기는 C 키로만 (웹캠 실눈은 3초 감기 도중 오작동하므로 사용 안 함)
  peek += ((down('KeyC') && blink.phase === 'none' ? 1 : 0) - peek) * 0.18;

  // 눈을 감고 있는 동안은 시간이 멈춘다
  const frozen = blink.phase === 'close' || blink.phase === 'hold' || blink.phase === 'shut' || dying;
  if (inv > 0 && !frozen) inv--;
  if (!frozen) {
    const dir = (down('ArrowRight', 'KeyD') ? 1 : 0) - (down('ArrowLeft', 'KeyA') ? 1 : 0);
    if (P.knock > 0) P.knock--;                       // 넉백 중에는 조작 불가
    else P.vx += (dir * 1.5 - P.vx) * (P.onGround ? 0.35 : 0.2);
    if (Math.abs(P.vx) < 0.05) P.vx = 0;
    if (dir && !P.knock) P.face = dir;
    const wasGround = P.onGround;
    P.coyote = P.onGround ? 6 : P.coyote - 1;
    P.jumpBuf = hit('Space', 'ArrowUp', 'KeyW', 'KeyZ') ? 6 : P.jumpBuf - 1;
    if (P.jumpBuf > 0 && P.coyote > 0) { P.vy = -4.6; P.coyote = 0; P.jumpBuf = 0; }
    if (!down('Space', 'ArrowUp', 'KeyW', 'KeyZ') && P.vy < -2) P.vy = -2;
    P.vy = Math.min(P.vy + 0.25, 6);
    moveX(); moveY();
    P.anim += Math.abs(P.vx) * 0.12;

    const ftx = Math.floor((P.x + P.w / 2) / T);
    if (tileAt(era, ftx, Math.floor((P.y + P.h - 2) / T)) === '~' || P.y > WORLD_H) die();
    else if (P.onGround && (ftx < 35 || ftx > 46)) safe = { x: P.x, y: P.y, era };

    // 집 2층 바닥 아래(1층)로 떨어지면 HP -1, 떨어지기 직전 자리로 복귀
    if (wasGround && !P.onGround) airStart = { ...groundPos };
    if (P.onGround) {
      const inHouseX = P.x + P.w / 2 > 66 * T && P.x + P.w / 2 < 100 * T;
      if (!wasGround && airStart && inHouseX && airStart.y + P.h <= 5 * T + 1 && P.y + P.h >= 8 * T) {
        const from = airStart;
        fallDamage(from, '…2층에서 떨어졌다. (HP -1)');
      }
      groundPos = { x: P.x, y: P.y, era };
      if (!wasGround) airStart = null;
    }

    // 그림자 순찰
    for (const m of MONSTERS) {
      m.x += m.dir * m.speed;
      if (m.x < m.x0 * T) { m.x = m.x0 * T; m.dir = 1; }
      if (m.x + m.w > (m.x1 + 1) * T) { m.x = (m.x1 + 1) * T - m.w; m.dir = -1; }
    }
    // 현재에서 그림자와 닿으면 HP -1 (공격 불가, 과거로 깜빡여 피해야 함)
    if (era === 'present' && inv === 0 && !dying && blink.phase !== 'open') {
      for (const m of MONSTERS) {
        if (P.x + 2 < m.x + m.w - 2 && P.x + P.w - 2 > m.x + 2 && P.y + 2 < m.y + m.h && P.y + P.h > m.y + 2) {
          if (hurt()) break;
          const s = P.x + P.w / 2 < m.x + m.w / 2 ? -1 : 1;
          P.vx = s * 2.6; P.vy = -2.6; P.knock = 14;
          if (!hintedMonster) { hintedMonster = true; say('그림자에 닿았다! (HP -1) 공격할 수 없다. 눈을 깜빡여 과거로 피하자.', 240); }
          else say('그림자에 닿았다. (HP -1)');
          break;
        }
      }
    }
  }

  // 구역 배너
  const z = currentZone();
  if (z !== zone) { zone = z; banner = { text: z, t: 130 }; }
  if (banner && --banner.t <= 0) banner = null;
  if (toast && --toast.t <= 0) toast = null;
  if (shake > 0) shake--;

  // 말풍선(같은 층, 가장 가까운 대상)
  bubble = null;
  let best = 30;
  const pcx = P.x + P.w / 2, pfeet = P.y + P.h;
  for (const p of PROPS) {
    if (!p.say || !p.say[era] || !propOn(p, era)) continue;
    const cx = (p.x + (p.w || 1) / 2) * T, dx = Math.abs(cx - pcx);
    const floorY = p.k === 'photo' ? 5 * T : p.by * T;
    if (dx < best && Math.abs(pfeet - floorY) < 22) { best = dx; bubble = p; }
  }
  // 상호작용 [E]
  if (hit('KeyE') && bubble && bubble.act && blink.phase === 'none') {
    if (bubble.act === 'apple' && !hasApple && !treePlanted) {
      hasApple = true; say('사과를 받았다. 어딘가에 심어 볼까?');
    } else if (bubble.act === 'plant' && hasApple) {
      hasApple = false; setTree(true);
      say('사과를 심었다. …현재에선 어떻게 자랐을까?', 220);
    }
  }
  // 목표: 과거의 가족사진
  const photo = PROPS.find(p => p.goal);
  if (!found && era === 'past' && blink.phase === 'none' && Math.abs((photo.x + 0.5) * T - pcx) < 18 && pfeet <= 5 * T + 1) {
    found = true; state = 'ending';
  }

  const target = Math.max(0, Math.min(WORLD_W - VW, pcx - VW / 2 + P.face * 18));
  cam.x += (target - cam.x) * 0.1;
}

function openMap() {
  const mkMap = e => {
    const c = mk(WORLD_W, WORLD_H), x = c.getContext('2d', { willReadFrequently: true });
    renderWorld(x, e, 0, WORLD_W, WORLD_H, t, true);
    if (e === 'past') monochrome(x, WORLD_W, WORLD_H, false);
    return c;
  };
  overview = { present: mkMap('present'), past: mkMap('past') };
  state = 'map';
}

/* ---------------------------------------------------------
 *  RENDER (화면)
 * --------------------------------------------------------- */
function drawPlayer(c, camX) {
  const x = Math.round(P.x - camX), y = Math.round(P.y), f = P.face;
  const walking = P.onGround && Math.abs(P.vx) > 0.3, step = Math.floor(P.anim) % 2;
  const sway = Math.floor(t / 8) % 2;
  // 주인공은 과거에서도 컬러로 남는다 (빨간 목도리가 흑백 속 포인트)
  R(c, f > 0 ? x - 3 : x + P.w, y + 7 + sway, 3, 2, '#d8342c');
  R(c, x + 2, y + 2, 6, 5, '#f0c8a0');
  R(c, x + 1, y, 8, 3, '#2a1e1a'); R(c, f > 0 ? x + 1 : x + 7, y + 2, 2, 4, '#2a1e1a');
  const ex = f > 0 ? x + 6 : x + 3;
  if (lidAmount() > 0.45) R(c, ex - (f > 0 ? 0 : 1), y + 5, 2, 1, '#2a1e1a'); else R(c, ex, y + 4, 1, 2, '#2a1e1a');
  R(c, x + 1, y + 7, 8, 2, '#d8342c');
  R(c, x + 1, y + 9, 8, 3, '#2e4a6a'); R(c, f > 0 ? x + 7 : x + 1, y + 9, 1, 3, '#3e5e86');
  if (!P.onGround) { R(c, x + 2, y + 12, 2, 2, '#2a2630'); R(c, x + 6, y + 11, 2, 2, '#2a2630'); }
  else if (walking && step) { R(c, x + 1, y + 12, 2, 2, '#2a2630'); R(c, x + 6, y + 12, 2, 2, '#2a2630'); }
  else { R(c, x + 3, y + 12, 2, 2, '#2a2630'); R(c, x + 5, y + 12, 2, 2, '#2a2630'); }
}

function rr(x, y, w, h, r) {
  D.beginPath(); D.moveTo(x + r, y); D.arcTo(x + w, y, x + w, y + h, r); D.arcTo(x + w, y + h, x, y + h, r);
  D.arcTo(x, y + h, x, y, r); D.arcTo(x, y, x + w, y, r); D.closePath();
}
function wrap(text, maxW) {
  const out = []; let line = '';
  for (const ch of text) {
    const test = line + ch;
    if (D.measureText(test).width > maxW && line) { out.push(line); line = ch.trim() ? ch : ''; } else line = test;
  }
  if (line) out.push(line);
  return out;
}
function textBox(lines, cx, bottomY, fs, bg, fg, tail) {
  const pad = fs * 0.6, lh = fs * 1.35;
  const w = Math.max(...lines.map(l => D.measureText(l).width)) + pad * 2, h = lines.length * lh + pad * 1.4;
  let x = Math.round(cx - w / 2); x = Math.max(6, Math.min(cvs.width - w - 6, x));
  const y = Math.max(6, Math.round(bottomY - h));
  D.fillStyle = bg; rr(x, y, w, h, fs * 0.4); D.fill();
  if (tail) { D.beginPath(); D.moveTo(cx - fs * 0.4, y + h); D.lineTo(cx + fs * 0.4, y + h); D.lineTo(cx, y + h + fs * 0.5); D.fill(); }
  D.fillStyle = fg; D.textBaseline = 'top';
  lines.forEach((l, i) => D.fillText(l, x + pad, y + pad * 0.8 + i * lh));
}

// 눈꺼풀: 가장자리부터 감기고 가운데가 마지막에 닫히는 곡선
function drawLids(a) {
  if (a <= 0.002) return;
  const W = cvs.width, H = cvs.height;
  D.fillStyle = '#000';
  if (a >= 0.995) { D.fillRect(0, 0, W, H); return; }
  const m = a * H / 2, e = Math.min(H / 2, m + a * (1 - a) * H * 0.7), c = 2 * m - e;
  D.beginPath(); D.moveTo(0, 0); D.lineTo(W, 0); D.lineTo(W, e); D.quadraticCurveTo(W / 2, c, 0, e); D.closePath(); D.fill();
  D.beginPath(); D.moveTo(0, H); D.lineTo(W, H); D.lineTo(W, H - e); D.quadraticCurveTo(W / 2, H - c, 0, H - e); D.closePath(); D.fill();
}

function drawHUD() {
  const fs = Math.max(11, Math.round(S * 4));
  D.font = `${fs}px ${FONT}`; D.textBaseline = 'middle';
  const tag = (era === 'past' ? '○ ' : '● ') + ERA[era].label + '  ' + ERA[era].year;
  const tw = D.measureText(tag).width + fs * 1.2;
  D.fillStyle = era === 'past' ? 'rgba(240,240,240,0.92)' : 'rgba(30,20,36,0.82)';
  rr(fs * 0.6, fs * 0.6, tw, fs * 1.8, fs * 0.5); D.fill();
  D.fillStyle = era === 'past' ? '#111' : '#f6c27a';
  D.fillText(tag, fs * 1.2, fs * 1.5);
  if (peek > 0.5) {
    D.fillStyle = 'rgba(255,255,255,0.75)';
    D.fillText('실눈 — ' + ERA[other(era)].label + '가 어렴풋이 겹쳐 보인다', fs * 0.8 + tw + fs, fs * 1.5);
  }
  D.textAlign = 'right'; D.fillStyle = 'rgba(255,255,255,0.8)';
  D.fillText(zone, cvs.width - fs, fs * 1.5);
  D.textAlign = 'left';
  // HP 하트 + 소지품(사과)
  const u = Math.max(2, Math.round(S * 0.9)), hw = 8 * u;
  for (let i = 0; i < MAX_HP; i++) {
    const full = i < hp, blinkOut = !full && i === hp && inv > 60 && Math.floor(t / 4) % 2;
    pixelIcon(HEART, cvs.width - fs - (MAX_HP - i) * hw, fs * 2.8, u, full || blinkOut ? '#e8423a' : 'rgba(255,255,255,0.22)');
  }
  if (hasApple) pixelIcon(APPLE, cvs.width - fs - (MAX_HP + 1.4) * hw, fs * 2.8, u, '#e8423a', '#5eaa48');
  drawEyeMeter(fs);
  D.font = `${Math.round(fs * 0.8)}px ${FONT}`; D.fillStyle = 'rgba(255,255,255,0.55)';
  D.textAlign = 'right'; D.textBaseline = 'middle';
  D.fillText('←→ 이동   Space 점프   X 깜빡임   E 상호작용   C 실눈   M 맵   R 처음으로', cvs.width - fs, cvs.height - fs);
  D.textAlign = 'left';
}

// 도트 아이콘 (X: 본색, G: 보조색)
const HEART = ['.XX.XX.', 'XXXXXXX', 'XXXXXXX', '.XXXXX.', '..XXX..', '...X...'];
const APPLE = ['...G...', '..G....', '.XX.XX.', 'XXXXXXX', 'XXXXXXX', '.XXXXX.', '..X.X..'];
function pixelIcon(rows, x, y, u, col, col2) {
  rows.forEach((row, j) => [...row].forEach((ch, i) => {
    if (ch === '.') return;
    D.fillStyle = ch === 'G' ? col2 : col;
    D.fillRect(Math.round(x + i * u), Math.round(y + j * u), u, u);
  }));
}

// 웹캠 상태 + 눈 감김 게이지 (임계값 표시)
function drawEyeMeter(fs) {
  const eye = window.eyeInput;
  const sfs = Math.round(fs * 0.75), x = fs * 0.6, y = fs * 3;
  D.font = `${sfs}px ${FONT}`; D.textBaseline = 'top';
  if (!eye || eye.status === 'off') {
    D.fillStyle = 'rgba(255,255,255,0.45)'; D.fillText('V 웹캠 연결', x, y); return;
  }
  const w = fs * 9, h = sfs * 0.7;
  D.fillStyle = 'rgba(0,0,0,0.55)'; rr(x, y, w + fs * 0.8, sfs * 3.6, sfs * 0.4); D.fill();
  D.fillStyle = eye.status === 'on' ? '#9be29b' : eye.status === 'error' ? '#ff8a8a' : '#f6c27a';
  D.fillText(eye.message, x + fs * 0.4, y + sfs * 0.3, w);
  if (eye.status !== 'on') return;
  const by = y + sfs * 1.6;
  D.fillStyle = 'rgba(255,255,255,0.15)'; D.fillRect(x + fs * 0.4, by, w, h);
  D.fillStyle = eye.closed ? '#d8342c' : eye.squint ? '#f6c27a' : '#ddd';
  D.fillRect(x + fs * 0.4, by, w * Math.min(1, eye.lid), h);
  for (const [v, col] of [[eye.closeTh, '#d8342c'], [eye.squintLo, '#f6c27a']]) {
    D.fillStyle = col; D.fillRect(x + fs * 0.4 + w * v - 1, by - 3, 2, h + 6);
  }
  D.fillStyle = 'rgba(255,255,255,0.6)';
  D.fillText(`모드 ${eye.modeLabel}  ·  B 모드  [ ] 민감도  K 보정`, x + fs * 0.4, by + h + sfs * 0.3, w);
}

function drawOverlayText() {
  const fs = Math.max(11, Math.round(S * 4));
  D.font = `${fs}px ${FONT}`;
  if (bubble && blink.phase !== 'hold') {
    const cx = ((bubble.x + (bubble.w || 1) / 2) * T - cam.x) * S;
    const top = (bubble.by * T - (bubble.h || 24)) * S - fs * 0.6;
    const past = era === 'past';
    textBox(wrap(sayText(bubble, era), fs * 17), cx, top, fs, past ? 'rgba(245,245,245,0.95)' : 'rgba(22,16,28,0.9)', past ? '#111' : '#f3e3c3', true);
  }
  if (toast) {
    D.globalAlpha = Math.min(1, toast.t / 30);
    textBox(wrap(toast.text, cvs.width * 0.7), cvs.width / 2, cvs.height - fs * 2.6, fs, 'rgba(0,0,0,0.75)', '#fff', false);
    D.globalAlpha = 1;
  }
  if (banner) {
    D.globalAlpha = Math.max(0, Math.min(1, banner.t / 30, (130 - banner.t) / 20));
    D.font = `${Math.round(fs * 1.6)}px ${FONT}`; D.textAlign = 'center'; D.textBaseline = 'middle';
    D.fillStyle = 'rgba(0,0,0,0.5)'; D.fillText(banner.text, cvs.width / 2 + 2, cvs.height * 0.22 + 2);
    D.fillStyle = '#fff'; D.fillText(banner.text, cvs.width / 2, cvs.height * 0.22);
    D.textAlign = 'left'; D.globalAlpha = 1;
  }
}

function centerCard(lines, sub) {
  const fs = Math.max(11, Math.round(S * 4));
  D.fillStyle = 'rgba(0,0,0,0.72)'; D.fillRect(0, 0, cvs.width, cvs.height);
  D.textAlign = 'center'; D.textBaseline = 'middle';
  let y = cvs.height / 2 - (lines.length * fs * 1.8) / 2;
  for (const [txt, size, col] of lines) {
    D.font = `${Math.round(fs * size)}px ${FONT}`; D.fillStyle = col || '#fff';
    D.fillText(txt, cvs.width / 2, y); y += fs * size * 1.6;
  }
  if (sub && Math.floor(t / 30) % 2) { D.font = `${Math.round(fs * 0.9)}px ${FONT}`; D.fillStyle = '#ccc'; D.fillText(sub, cvs.width / 2, y + fs); }
  D.textAlign = 'left';
}

function drawMap() {
  const W = cvs.width, H = cvs.height, fs = Math.max(10, Math.round(S * 3.2)), m = fs * 1.5;
  D.fillStyle = '#0e0c13'; D.fillRect(0, 0, W, H);
  const s = (W - m * 2) / WORLD_W, sh = WORLD_H * s;
  D.font = `${Math.round(fs * 1.25)}px ${FONT}`; D.fillStyle = '#fff'; D.textBaseline = 'top';
  D.fillText('맵 디자인 개요 — 같은 좌표, 두 개의 시간', m, m * 0.6);
  const rows = { present: m * 0.6 + fs * 3.2, past: m * 0.6 + fs * 3.2 + sh + fs * 2.2 };
  D.imageSmoothingEnabled = true;
  for (const e of ['present', 'past']) {
    D.font = `${fs}px ${FONT}`; D.fillStyle = e === 'past' ? '#ddd' : '#f6c27a';
    D.fillText(e === 'present' ? '현재 (2026) · 컬러 · 폐허가 된 마을' : '과거 (1994) · 흑백 모노톤 · 사람이 사는 마을', m, rows[e] - fs * 1.4);
    D.drawImage(overview[e], m, rows[e], WORLD_W * s, sh);
    D.strokeStyle = 'rgba(255,255,255,0.25)'; D.strokeRect(m, rows[e], WORLD_W * s, sh);
  }
  D.imageSmoothingEnabled = false;
  // 구역 경계
  D.setLineDash([4, 4]); D.strokeStyle = 'rgba(255,255,255,0.35)';
  D.font = `${Math.round(fs * 0.8)}px ${FONT}`;
  for (const Z of ZONES) {
    const x = m + Z.x * T * s;
    D.beginPath(); D.moveTo(x, rows.present); D.lineTo(x, rows.past + sh); D.stroke();
    D.fillStyle = 'rgba(255,255,255,0.7)'; D.fillText(Z.name, x + 3, rows.past + sh + 4);
  }
  D.setLineDash([]);
  // 동선 마커
  const r = Math.max(6, fs * 0.65);
  for (const q of ROUTE) {
    const x = m + q.x * T * s, y = rows[q.era] + q.y * T * s;
    D.fillStyle = q.n === '!' || q.n === 'M' ? '#ff6b6b' : '#ffd166'; D.beginPath(); D.arc(x, y, r, 0, Math.PI * 2); D.fill();
    D.fillStyle = '#111'; D.font = `bold ${Math.round(r * 1.3)}px ${FONT}`; D.textAlign = 'center'; D.textBaseline = 'middle';
    D.fillText(q.n, x, y + 1); D.textAlign = 'left'; D.textBaseline = 'top';
  }
  // 플레이어 위치
  const px = m + (P.x + P.w / 2) * s, py = rows[era] + (P.y + P.h / 2) * s;
  D.strokeStyle = '#d8342c'; D.lineWidth = 2; D.beginPath(); D.arc(px, py, r * 0.9, 0, Math.PI * 2); D.stroke(); D.lineWidth = 1;
  // 동선 설명 (2열)
  D.font = `${fs}px ${FONT}`;
  const ly = rows.past + sh + fs * 2.2, colW = (W - m * 2) / 2, lh = fs * 1.45;
  ROUTE.forEach((q, i) => {
    const col = i < 6 ? 0 : 1, row = i % 6;
    D.fillStyle = q.n === '!' || q.n === 'M' ? '#ff6b6b' : '#ffd166';
    D.fillText(q.n, m + col * colW, ly + row * lh);
    D.fillStyle = '#ddd';
    D.fillText(q.text, m + col * colW + fs * 1.3, ly + row * lh, colW - fs * 2);
  });
  D.fillStyle = '#888'; D.fillText('M / Esc 닫기   ·   빨간 원 = 현재 내 위치', m, H - fs * 1.6);
}

const vignettes = {};
function vignette() {
  const key = cvs.width + 'x' + cvs.height + era;
  if (!vignettes[key]) {
    const g = D.createRadialGradient(cvs.width / 2, cvs.height / 2, cvs.height * 0.35, cvs.width / 2, cvs.height / 2, cvs.width * 0.62);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, era === 'past' ? 'rgba(0,0,0,0.6)' : 'rgba(20,0,20,0.4)');
    vignettes[key] = g;
  }
  D.fillStyle = vignettes[key]; D.fillRect(0, 0, cvs.width, cvs.height);
}

function draw() {
  if (state === 'map') { drawMap(); return; }
  const camX = Math.round(cam.x);
  renderWorld(bctx, era, camX, VW, VH, t, false);
  if (era === 'past') monochrome(bctx, VW, VH, true);
  if (peek > 0.02) {
    const o = other(era);
    renderWorld(pctx, o, camX, VW, VH, t, false);
    if (o === 'past') monochrome(pctx, VW, VH, true);
    bctx.globalAlpha = peek * 0.42; bctx.drawImage(peekBuf, 0, 0); bctx.globalAlpha = 1;
  }
  if (state !== 'title' && !(inv > 0 && Math.floor(t / 4) % 2)) drawPlayer(bctx, camX); // 무적 중 깜빡임

  D.imageSmoothingEnabled = false;
  D.fillStyle = '#000'; D.fillRect(0, 0, cvs.width, cvs.height);
  const sh = shake > 0 ? Math.round((Math.random() - 0.5) * shake) * S * 0.5 : 0;
  D.drawImage(buf, sh, 0, VW * S, VH * S);
  vignette();
  if (state === 'play') { drawOverlayText(); drawHUD(); }
  drawLids(lidAmount());

  if (state === 'title') centerCard([
    ['깜빡, 그 시절', 2.2, '#f6c27a'],
    ['눈을 감았다 뜨면, 시간이 바뀐다', 1, '#ddd'],
    ['', 0.5],
    ['←→ / A D  이동     Space / ↑  점프', 0.9, '#bbb'],
    ['X  눈 깜빡임 (현재 ⇄ 과거)     C (누르고 있기)  실눈', 0.9, '#bbb'],
    ['M  맵 디자인 개요     R  처음으로', 0.9, '#bbb'],
    ['E  상호작용     V  웹캠 연결 — 실제로 눈을 감으면 시간이 바뀐다', 0.9, '#f6c27a'],
    ['현재의 그림자는 공격할 수 없다. 깜빡여서 과거로 피하자', 0.9, '#ff8a8a'],
  ], '아무 키나 눌러 시작');
  if (state === 'ending') centerCard([
    ['기억 조각을 찾았다', 1.8, '#fff'],
    ['— 가족사진, 1994년 여름 —', 1, '#ccc'],
    ['흑백의 기억 속에서, 너만이 색을 가지고 있었다.', 0.95, '#d8342c'],
    [`깜빡인 횟수: ${blinkCount}`, 0.85, '#999'],
  ], 'Enter 계속 둘러보기   ·   R 처음부터');
  if (state === 'gameover') centerCard([
    ['기억이 흐려졌다…', 1.8, '#ff8a8a'],
    ['HP를 모두 잃었다', 1, '#ccc'],
    [`깜빡인 횟수: ${blinkCount}`, 0.85, '#999'],
  ], 'R / Enter  처음부터 다시');
}

/* ---------------------------------------------------------
 *  LOOP (고정 60fps 스텝)
 * --------------------------------------------------------- */
let last = performance.now(), acc = 0;
function frame(now) {
  acc += Math.min(100, now - last); last = now;
  while (acc >= 1000 / 60) { update(); hits.clear(); acc -= 1000 / 60; }
  draw();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// 디버그용 (콘솔에서 __game.P 등으로 확인 가능)
window.__game = {
  P, MAP, MONSTERS, eyeSwitch, eyeOpen,
  get era() { return era; }, get state() { return state; }, get zone() { return zone; },
  get hp() { return hp; }, get hasApple() { return hasApple; }, get treePlanted() { return treePlanted; },
  get airStart() { return airStart; }, get inv() { return inv; },
};
})();
