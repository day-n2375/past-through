'use strict';
/* =========================================================
 *  웹캠 눈 깜빡임 입력
 *  - MediaPipe Face Landmarker의 blendshape(eyeBlinkLeft/Right)로 눈 감김 정도를 읽는다
 *  - 처음 1.5초 동안 '눈 뜬 상태'를 보정해서 사람/안경/조명 차이를 줄인다
 *  - 판정 결과를 window.eyeInput에 쓰고, 게임의 __game.eyeSwitch()/eyeOpen()을 호출한다
 *
 *  트리거 모드 (B 키로 순환)
 *   long   : 3초 이상 꾹 감으면 전환 (자연스러운 깜빡임은 무시)
 *   double : 빠르게 두 번 깜빡이면 전환
 *   every  : 모든 깜빡임에 바로 전환 (기본값)
 * ========================================================= */
(() => {
const MP_VERSION = '0.10.14';
const MP_BASE = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MP_VERSION}`;
const MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';

const MODES = {
  long: '꾹 감기(3초)',
  double: '두 번 깜빡',
  every: '모든 깜빡임',
};
const MODE_ORDER = ['every', 'long', 'double'];

const LONG_MS = 3000;       // long 모드: 이 시간 이상 감으면 전환
const DOUBLE_GAP_MS = 650;  // double 모드: 첫 깜빡임 후 이 시간 안에 다시 감으면 전환
const SHORT_BLINK_MS = 400; // double 모드에서 '깜빡임'으로 인정할 최대 감김 시간
const SQUINT_MS = 250;      // 실눈을 이 시간 이상 유지하면 엿보기
const NOFACE_MS = 600;      // 얼굴을 놓치면 눈을 뜬 것으로 처리
const CALIB_MS = 1500;

// 게임이 읽는 공유 상태
const eye = window.eyeInput = {
  status: 'off',          // off | loading | calibrating | on | noface | error
  message: '',
  lid: 0,                 // 0(뜸) ~ 1(감음), 보정 후 정규화 값
  closed: false,
  squint: false,
  closeTh: 0.55,          // 이 이상이면 감음
  squintLo: 0.25,         // squintLo ~ closeTh 사이를 유지하면 실눈
  mode: 'every',
  modeLabel: MODES.every,
};

let video = null, stream = null, landmarker = null, running = false;
let lastVideoTime = -1, smoothed = 0, base = { l: 0.1, r: 0.1 };
let calib = null, closeStart = 0, fired = false, lastShortBlinkEnd = -1e9;
let squintStart = 0, lastFaceTime = 0;

const openTh = () => Math.max(0.1, eye.closeTh - 0.2); // 히스테리시스: 감음/뜸 기준을 다르게
const game = () => window.__game;

function setStatus(status, message) { eye.status = status; eye.message = message; }

function ensureVideo() {
  if (video) return video;
  video = document.createElement('video');
  video.playsInline = true; video.muted = true; video.autoplay = true;
  video.id = 'webcam-preview';
  document.body.appendChild(video);
  return video;
}

async function loadLandmarker() {
  // 클래식 스크립트에서도 쓸 수 있도록 동적 import 사용
  const { FaceLandmarker, FilesetResolver } = await import(`${MP_BASE}/vision_bundle.mjs`);
  const fileset = await FilesetResolver.forVisionTasks(`${MP_BASE}/wasm`);
  const opts = delegate => ({
    baseOptions: { modelAssetPath: MODEL_URL, delegate },
    outputFaceBlendshapes: true,
    runningMode: 'VIDEO',
    numFaces: 1,
  });
  try { return await FaceLandmarker.createFromOptions(fileset, opts('GPU')); }
  catch (e) { return await FaceLandmarker.createFromOptions(fileset, opts('CPU')); }
}

async function start() {
  if (running || eye.status === 'loading') return;
  try {
    setStatus('loading', '웹캠 · 모델 불러오는 중…');
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia)
      throw new Error('이 브라우저/주소에서는 웹캠을 쓸 수 없습니다 (localhost 또는 https 필요)');
    const v = ensureVideo();
    stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480, facingMode: 'user' }, audio: false });
    v.srcObject = stream;
    await v.play();
    if (!landmarker) landmarker = await loadLandmarker();
    v.classList.add('on');
    running = true;
    beginCalibration();
    requestAnimationFrame(loop);
  } catch (e) {
    console.error(e);
    stop();
    const msg = e && e.name === 'NotAllowedError' ? '웹캠 권한이 거부되었습니다' : (e && e.message) || '웹캠 연결 실패';
    setStatus('error', msg.length > 40 ? msg.slice(0, 40) + '…' : msg);
  }
}

function stop() {
  running = false;
  if (stream) stream.getTracks().forEach(t => t.stop());
  stream = null;
  if (video) video.classList.remove('on');
  releaseEyes();
  eye.lid = 0; eye.squint = false;
  setStatus('off', '');
}

function beginCalibration() {
  calib = { start: performance.now(), l: [], r: [] };
  setStatus('calibrating', '보정 중… 눈을 뜨고 화면을 보세요');
}

function releaseEyes() {
  if (eye.closed && game()) game().eyeOpen();
  eye.closed = false; fired = false;
}

function readBlink(result) {
  const cats = result.faceBlendshapes && result.faceBlendshapes[0] && result.faceBlendshapes[0].categories;
  if (!cats) return null;
  let l = 0, r = 0;
  for (const c of cats) {
    if (c.categoryName === 'eyeBlinkLeft') l = c.score;
    else if (c.categoryName === 'eyeBlinkRight') r = c.score;
  }
  return { l, r };
}

function loop() {
  if (!running) return;
  const now = performance.now();
  if (video.readyState >= 2 && video.currentTime !== lastVideoTime) {
    lastVideoTime = video.currentTime;
    const raw = readBlink(landmarker.detectForVideo(video, now));
    if (raw) { lastFaceTime = now; process(raw, now); }
    else if (now - lastFaceTime > NOFACE_MS) {
      releaseEyes(); eye.lid = 0; eye.squint = false;
      if (eye.status !== 'calibrating') setStatus('noface', '얼굴이 보이지 않습니다');
    }
  }
  requestAnimationFrame(loop);
}

function process(raw, now) {
  if (calib) {
    calib.l.push(raw.l); calib.r.push(raw.r);
    if (now - calib.start >= CALIB_MS) {
      const avg = a => a.reduce((s, v) => s + v, 0) / Math.max(1, a.length);
      base = { l: Math.min(0.6, avg(calib.l)), r: Math.min(0.6, avg(calib.r)) };
      calib = null;
      setStatus('on', '웹캠 연결됨');
    }
    return;
  }
  if (eye.status === 'noface') setStatus('on', '웹캠 연결됨');

  // 눈 뜬 기준값을 0, 완전히 감은 상태(약 0.9)를 1로 정규화. 두 눈 중 덜 감긴 쪽 기준(윙크 무시)
  const norm = (v, b) => Math.max(0, Math.min(1, (v - b) / Math.max(0.2, 0.9 - b)));
  const v = Math.min(norm(raw.l, base.l), norm(raw.r, base.r));
  smoothed = smoothed * 0.35 + v * 0.65;
  eye.lid = smoothed;

  // 감음 / 뜸 (히스테리시스)
  if (!eye.closed && smoothed >= eye.closeTh) {
    eye.closed = true; closeStart = now; fired = false;
    onClose(now);
  } else if (eye.closed && smoothed <= openTh()) {
    eye.closed = false;
    onOpen(now, now - closeStart);
  }
  if (eye.closed && !fired && eye.mode === 'long' && now - closeStart >= LONG_MS) fire();

  // 실눈: 감음 기준보다 조금 덜 감은 상태를 일정 시간 유지
  const inSquint = !eye.closed && smoothed >= eye.squintLo && smoothed < eye.closeTh;
  if (inSquint) { if (!squintStart) squintStart = now; } else squintStart = 0;
  eye.squint = inSquint && now - squintStart >= SQUINT_MS;
}

function fire() {
  fired = true;
  if (game()) game().eyeSwitch();
}

function onClose(now) {
  if (eye.mode === 'every') fire();
  else if (eye.mode === 'double' && now - lastShortBlinkEnd <= DOUBLE_GAP_MS) { lastShortBlinkEnd = -1e9; fire(); }
}

function onOpen(now, duration) {
  if (eye.mode === 'double' && !fired && duration <= SHORT_BLINK_MS) lastShortBlinkEnd = now;
  fired = false;
  if (game()) game().eyeOpen();
}

addEventListener('keydown', e => {
  if (e.repeat) return;
  switch (e.code) {
    case 'KeyV': running ? stop() : start(); break;
    case 'KeyB': {
      const i = (MODE_ORDER.indexOf(eye.mode) + 1) % MODE_ORDER.length;
      eye.mode = MODE_ORDER[i]; eye.modeLabel = MODES[eye.mode];
      break;
    }
    // [ : 덜 민감(더 꽉 감아야 함)  ] : 더 민감
    case 'BracketLeft': eye.closeTh = Math.min(0.85, +(eye.closeTh + 0.05).toFixed(2)); eye.squintLo = Math.max(0.1, eye.closeTh - 0.3); break;
    case 'BracketRight': eye.closeTh = Math.max(0.3, +(eye.closeTh - 0.05).toFixed(2)); eye.squintLo = Math.max(0.1, eye.closeTh - 0.3); break;
    case 'KeyK': if (running) beginCalibration(); break;
  }
});
})();
