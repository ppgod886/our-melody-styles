/* ============================================================
   《我们的乐章》主程序 —— 环形五线谱渲染 + 交互 + 粒子 + 名单热替换
   流程：进入（整曲循环）→ 点一段谱子（声部独响 + 浮现名单）
   → 点其中一枚音符（响一声更亮的 + 个人卡片 + 点亮）
   → 全部点亮（同时发声，汇成一个和弦）
   名单可通过右上角「⬆ 名单」上传，人数可变，整环立即重排。
   ============================================================ */

const svg = document.getElementById('stage');
const NS = 'http://www.w3.org/2000/svg';
const CX = 800, CY = 452, RX = 540, RY = 198, ROT = -10;

/* ---------- 状态 ---------- */
let entered = false;
let activeSection = -1;
let modalOpen = false;
let finaleDone = false;
let litCount = 0;
let rosterLabel = '默认名单';
let lit = [];
let noteEls = [], labelEls = [], arcEls = [];
let curStep = 24;          // 相邻两枚音符的夹角
let curF = 1;              // 音符尺寸系数（人多了自动缩小）

/* ---------- 环的缓慢旋转（音乐盒转盘） ---------- */
let spinDeg = 0;                       // 当前旋转角
const SPIN_PER_SEC = window.THEME_SPIN_PER_SEC || (360 / 75);
let noteBaseAngles = [];               // 每枚音符的基准角
let arcRangesGlobal = [];              // 每个声部的弧线范围
let arcHitEls = [];                    // 弧线热区（路径随旋转更新）
let lastT = 0;
const REDUCE_MOTION = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function el(tag, attrs, parent) {
  const n = document.createElementNS(NS, tag);
  for (const k in attrs) n.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(n);
  return n;
}

function ringPoint(deg) {
  const a = deg * Math.PI / 180, r = ROT * Math.PI / 180;
  const x = RX * Math.cos(a), y = RY * Math.sin(a);
  return {
    x: CX + x * Math.cos(r) - y * Math.sin(r),
    y: CY + x * Math.sin(r) + y * Math.cos(r),
  };
}

function ellipseArc(a0, a1) {
  const p0 = ringPoint(a0), p1 = ringPoint(a1);
  const large = (a1 - a0) > 180 ? 1 : 0;
  return `M ${p0.x.toFixed(1)} ${p0.y.toFixed(1)} A ${RX} ${RY} ${ROT} ${large} 1 ${p1.x.toFixed(1)} ${p1.y.toFixed(1)}`;
}

const glyphOf = i => (i % 3 === 0 ? '♫' : '♪');
const WAVE_NAME = { sine: '纯净正弦', triangle: '暖三角波', sawtooth: '柔锯齿', square: '8-bit 方波' };

/* ---------- 建环 ---------- */
const gArcs = document.getElementById('arcs');
const gNotes = document.getElementById('notes');
const gLabels = document.getElementById('labels');

function scaleFor(n) { return n <= 15 ? 1 : n <= 24 ? 0.78 : 0.6; }

function buildStage() {
  finaleTimers.forEach(clearTimeout); finaleTimers = [];
  const N = MEMBERS.length;
  curStep = 360 / N;
  curF = scaleFor(N);
  const noteAngle = i => -90 + i * curStep;
  noteBaseAngles = MEMBERS.map((_, i) => noteAngle(i));

  gArcs.innerHTML = ''; gNotes.innerHTML = ''; gLabels.innerHTML = '';
  noteEls = []; labelEls = []; arcEls = [];

  /* 声部弧线（成员已按声部连续排列） */
  const ranges = [];
  MEMBERS.forEach((m, i) => {
    if (!ranges.length || ranges[ranges.length - 1].s !== m.section) {
      ranges.push({ s: m.section, a: i, b: i });
    } else ranges[ranges.length - 1].b = i;
  });
  ranges.forEach(rg => {
    const pad = curStep * 0.35;
    const d = ellipseArc(noteAngle(rg.a) - pad, noteAngle(rg.b) + pad);
    const vis = el('path', { d, class: 'arc', fill: 'none' }, gArcs);
    const hit = el('path', {
      d, class: 'archit', fill: 'none', stroke: 'rgba(0,0,0,0)',
      'stroke-width': 52,
    }, gArcs);
    arcEls[rg.s] = vis;
    arcHitEls[rg.s] = hit;
    hit.addEventListener('click', e => {
      e.stopPropagation();
      if (finaleDone) return;
      if (activeSection === rg.s && !modalOpen) exitSection();
      else { closeModal(true); enterSection(rg.s); }
    });
    hit.addEventListener('mouseenter', () => { if (activeSection !== rg.s && !finaleDone) vis.classList.add('warm'); });
    hit.addEventListener('mouseleave', () => vis.classList.remove('warm'));
  });

  /* 音符 + 备用标签 */
  MEMBERS.forEach((m, i) => {
    const p = ringPoint(noteAngle(i));
  const g = el('g', { class: 'note', transform: `translate(${p.x.toFixed(1)},${p.y.toFixed(1)})` }, gNotes);
  g.style.setProperty('--fi', i % 5);
  if ((i * 7 + 3) % 2 === 0) g.classList.add('alt');   // 墨黑 / 香槟金交错，像乐器上的按键
    el('circle', { class: 'halo', r: 30 * curF }, g);
    el('circle', { class: 'oring', r: 25 * curF }, g);
    const bob = el('g', { class: 'bob' }, g);
    const tilt = el('g', { class: 'tilt', transform: `rotate(${(i * 47) % 14 - 7})` }, bob);
    el('text', {
      class: 'glyph', 'font-size': (sizeOf(i) * curF).toFixed(1),
      'text-anchor': 'middle', dy: '0.34em',
    }, tilt).textContent = glyphOf(i);
    el('circle', { class: 'hit', r: 38 * curF, fill: 'rgba(0,0,0,0)' }, g);
    const mini = el('text', {
      class: 'mini', y: 56 * curF, 'text-anchor': 'middle',
      'font-size': (12 * Math.max(curF, 0.75)).toFixed(1),
    }, g);
    mini.textContent = m.name;
    g.addEventListener('click', e => {
      e.stopPropagation();
      if (finaleDone) return;
      if (activeSection !== m.section) enterSection(m.section);
      selectNote(i);
    });
    noteEls.push(g);

    const lb = el('g', { class: 'lbl', transform: `translate(${p.x.toFixed(1)},${p.y.toFixed(1)})` }, gLabels);
    const nm = el('text', { class: 'nm', y: -54 * curF, 'text-anchor': 'middle' }, lb);
    nm.textContent = m.name;
    nm.style.fontSize = (21 * curF).toFixed(1) + 'px';
    const rl = el('text', { class: 'rl', y: 74 * curF, 'text-anchor': 'middle' }, lb);
    rl.textContent = m.role;
    rl.style.fontSize = (12 * curF).toFixed(1) + 'px';
    labelEls.push(lb);
  });

  /* 进度点：一个声部一小组 */
  const dotsWrap = document.getElementById('dots');
  dotsWrap.innerHTML = '';
  ranges.forEach(rg => {
    const grp = document.createElement('span');
    grp.className = 'dgrp';
    for (let d = 0; d < rg.b - rg.a + 1; d++) grp.appendChild(document.createElement('i'));
    dotsWrap.appendChild(grp);
  });

  /* 动态文案里的数字 */
  const zhNum = N === 15 ? '十五个音符' : `${N} 枚音符`;
  const gc = document.getElementById('gcount');
  if (gc) gc.textContent = zhNum;
  document.querySelector('header .en').textContent = `OUR MELODY · ${N} NOTES · ONE SONG`;
  document.getElementById('finaleOvl').textContent = `FINALE · ${N} 个音符，同时发声`;
  document.getElementById('fline').textContent = `${N} 个音符 · 一个我们 ｜ GROUP 06`;
  document.getElementById('mnumTotal').textContent = N;

  /* 重置交互状态 */
  lit = new Array(N).fill(false);
  litCount = 0; activeSection = -1; modalOpen = false;
  finaleDone = false;
  svg.classList.remove('solo', 'finale');
  document.getElementById('chip').classList.remove('show');
  document.getElementById('modal').classList.remove('show');
  document.getElementById('finale').classList.remove('show');
  buildFinaleNames();
  updateProgress();
  arcRangesGlobal = ranges.map(r => ({ s: r.s, a: r.a, b: r.b }));
  layoutRing();
}

function sizeOf(i) { return [32, 37, 34][i % 3]; }

/* ---------- 状态切换 ---------- */
function enterSection(k) {
  if (activeSection === k) return;
  activeSection = k;
  svg.classList.add('solo');
  arcEls.forEach((a, idx) => a && a.classList.toggle('hot', idx === k));
  noteEls.forEach((n, i) => n.classList.toggle('dim', MEMBERS[i].section !== k));
  labelEls.forEach((l, i) => {
    const show = MEMBERS[i].section === k;
    l.style.transitionDelay = show ? (i % 5) * 0.1 + 's' : '0s';
    l.classList.toggle('show', show);
  });
  const sec = SECTIONS[k];
  document.getElementById('chipName').textContent = sec.name;
  document.getElementById('chipEn').textContent = sec.en + ' · ' + sec.desc;
  document.getElementById('chip').classList.add('show');
  setHint('这一段谱子正在单独响起 —— 点击其中的音符，一枚枚把它们点亮');
  AudioEngine.solo(k);
}

function exitSection() {
  closeModal(true);
  activeSection = -1;
  svg.classList.remove('solo');
  arcEls.forEach(a => a && a.classList.remove('hot'));
  noteEls.forEach(n => n.classList.remove('dim'));
  labelEls.forEach(l => l.classList.remove('show'));
  document.getElementById('chip').classList.remove('show');
  setHint('点击任意一段谱线，聆听一个声部');
  AudioEngine.returnFull();
}

function selectNote(i) {
  if (!lit[i]) {
    lit[i] = true; litCount++;
    AudioEngine.lightUp(i);
    noteEls[i].classList.add('lit');
    updateProgress();
  }
  AudioEngine.accent(i);
  openModal(i);
}

/* ---------- 个人卡片 ---------- */
const modal = document.getElementById('modal');
function openModal(i) {
  const m = MEMBERS[i], sec = SECTIONS[m.section];
  document.getElementById('mnum').textContent = String(i + 1).padStart(2, '0');
  document.getElementById('mname').textContent = m.name;
  document.getElementById('mrole').textContent = m.role + ' ｜ ' + (sec ? sec.name.split(' · ')[0] : '');
  document.getElementById('mtimbre').textContent =
    '音高 ' + m.pitch + ' ｜ 音色 · ' + (WAVE_NAME[m.timbre.wave] || '合成音色');
  document.getElementById('mquote').textContent = '「' + (m.quote || '……') + '」';
  document.getElementById('mtrait').textContent = '✦ ' + (m.trait || '还没留下介绍。');
  const mimg = document.getElementById('mimg');
  if (m.img) { mimg.src = m.img; mimg.hidden = false; } else { mimg.hidden = true; }
  document.getElementById('mcount').textContent = litCount + ' / ' + MEMBERS.length;
  modal.classList.add('show');
  modalOpen = true;
}
function closeModal(silent) {
  if (!modalOpen) return;
  modal.classList.remove('show');
  modalOpen = false;
  if (!silent && litCount === MEMBERS.length && !finaleDone) {
    setTimeout(startFinale, 600);
  }
}
document.getElementById('mclose').addEventListener('click', e => { e.stopPropagation(); closeModal(false); });
modal.addEventListener('click', e => { if (e.target === modal) closeModal(false); });

/* ---------- 终章：全员一起响 ---------- */
let finaleTimers = [];
function startFinale() {
  finaleDone = true;
  activeSection = -1;
  svg.classList.remove('solo');
  svg.classList.add('finale');
  noteEls.forEach(n => n.classList.remove('dim'));
  labelEls.forEach(l => l.classList.remove('show'));
  arcEls.forEach(a => a && a.classList.remove('hot'));
  document.getElementById('chip').classList.remove('show');
  document.getElementById('hint').classList.remove('show');

  AudioEngine.finale();

  const gap = Math.max(40, Math.round(1400 / MEMBERS.length));
  noteEls.forEach((n, i) => {
    finaleTimers.push(setTimeout(() => {
      n.classList.add('flash');
      finaleTimers.push(setTimeout(() => n.classList.remove('flash'), 950));
    }, 200 + i * gap));
  });
  finaleTimers.push(setTimeout(() => dustBurst(), 1300));
  finaleTimers.push(setTimeout(() => {
    if (finaleDone) document.getElementById('finale').classList.add('show');
  }, 3400));
}

function resetAll() {
  finaleTimers.forEach(clearTimeout); finaleTimers = [];
  lit.fill(false); litCount = 0; finaleDone = false; modalOpen = false;
  noteEls.forEach(n => n.classList.remove('lit', 'flash'));
  svg.classList.remove('finale', 'solo');
  document.getElementById('finale').classList.remove('show');
  modal.classList.remove('show');
  updateProgress();
  setHint('点击任意一段谱线，聆听一个声部');
  AudioEngine.reset();
}
document.getElementById('replay').addEventListener('click', e => { e.stopPropagation(); resetAll(); });

/* ---------- 进度 ---------- */
function updateProgress() {
  document.getElementById('ptext').textContent = '已点亮 ' + litCount + ' / ' + MEMBERS.length;
  document.querySelectorAll('#dots i').forEach((d, i) => d.classList.toggle('on', lit[i]));
}

/* ---------- 终章名单 ---------- */
function buildFinaleNames() {
  const wrap = document.getElementById('fnames');
  wrap.innerHTML = '';
  SECTIONS.forEach((sec, si) => {
    const col = document.createElement('div');
    col.className = 'f-col';
    const h = document.createElement('h4');
    h.textContent = sec.name + ' ' + sec.en;
    col.appendChild(h);
    MEMBERS.filter(m => m.section === si).forEach(m => {
      const p = document.createElement('p');
      p.textContent = m.name + ' · ' + m.role;
      col.appendChild(p);
    });
    wrap.appendChild(col);
  });
}

/* ---------- 名单热替换 ---------- */
function applyRoster(members, sections, label, persist = true) {
  MEMBERS = members;
  SECTIONS = sections;
  rosterLabel = label;
  if (persist) Roster.persist({ members, sections, label, savedAt: Date.now() });
  AudioEngine.rebuild(MEMBERS);
  buildStage();
  setHint('点击任意一段谱线，聆听一个声部');
  toast(`已加载「${label}」· ${MEMBERS.length} 位成员上线`);
}
function restoreDefault() {
  Roster.clearStored();
  applyRoster(
    MEMBERS_DEFAULT.map(m => ({ ...m })),
    SECTIONS_DEFAULT.map(s => ({ ...s })),
    '默认名单',
    false
  );
}

/* ---------- 提示语与浮消息 ---------- */
let hintTimer = null;
function setHint(text, autoFade) {
  const h = document.getElementById('hint');
  h.textContent = text;
  h.classList.add('show');
  clearTimeout(hintTimer);
  if (autoFade) hintTimer = setTimeout(() => h.classList.remove('show'), 8000);
}
let toastTimer = null;
function toast(msg, isErr) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.toggle('err', !!isErr);
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2800);
}

/* ---------- 入场 ---------- */
const gate = document.getElementById('gate');
gate.addEventListener('click', () => {
  if (entered) return;
  entered = true;
  AudioEngine.init();
  AudioEngine.startFull();
  gate.classList.add('hide');
  setTimeout(() => gate.remove(), 1600);
  setTimeout(() => setHint('点击任意一段谱线，聆听一个声部', true), 1800);
});

/* 空白处点击：关卡片 → 退回全曲 */
svg.addEventListener('click', () => {
  if (!entered || finaleDone) return;
  if (modalOpen) closeModal(false);
  else if (activeSection >= 0) exitSection();
});
document.addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;
  if (document.getElementById('rosterModal').classList.contains('show')) {
    document.getElementById('rosterModal').classList.remove('show');
    return;
  }
  if (modalOpen) closeModal(false);
  else if (activeSection >= 0) exitSection();
});

/* ---------- 金色尘埃（Canvas 粒子） ---------- */
const cv = document.getElementById('dust'), cx2 = cv.getContext('2d');
let W, H, parts = [];
function resize() {
  W = cv.width = innerWidth; H = cv.height = innerHeight;
}
addEventListener('resize', resize); resize();

const BG0 = window.BG_DUST || {};
const dustCount = BG0.count || 130;

function spawn() {
  return {
    x: Math.random() * W, y: H + Math.random() * H * 0.3,
    r: 0.6 + Math.random() * 1.8,
    vy: 0.12 + Math.random() * 0.35,
    vx: (Math.random() - 0.5) * 0.12,
    tw: Math.random() * Math.PI * 2,
    ts: 0.5 + Math.random() * 1.5,
    a: 0.25 + Math.random() * 0.55,
  };
}
for (let i = 0; i < dustCount; i++) {
  const p = spawn();
  p.y = Math.random() * H;
  parts.push(p);
}
function dustBurst() {
  const cx0 = innerWidth / 2, cy0 = innerHeight * 0.5;
  const scale = Math.min(innerWidth / 1600, innerHeight / 900);
  for (let i = 0; i < 220; i++) {
    const ang = Math.random() * Math.PI * 2;
    const sp = 1.5 + Math.random() * 5.5;
    parts.push({
      x: cx0 + Math.cos(ang) * 540 * scale * (0.8 + Math.random() * 0.3),
      y: cy0 + Math.sin(ang) * 198 * scale * (0.8 + Math.random() * 0.3),
      r: 0.8 + Math.random() * 2.4,
      vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp - 0.4,
      tw: Math.random() * Math.PI * 2, ts: 2 + Math.random() * 3,
      a: 0.9, life: 1,
    });
  }
}
/* 每帧按旋转角重排音符 / 标签 / 声部弧线 */
function layoutRing() {
  if (!noteEls.length) return;
  const posArr = [];
  const pad = curStep * 0.35;
  for (let i = 0; i < MEMBERS.length; i++) {
    const p = ringPoint(noteBaseAngles[i] + spinDeg);
    const t = `translate(${p.x.toFixed(1)},${p.y.toFixed(1)})`;
    noteEls[i].setAttribute('transform', t);
    if (labelEls[i]) labelEls[i].setAttribute('transform', t);
    posArr.push([p.x, p.y]);
  }
  window.__notePos = posArr;
  arcRangesGlobal.forEach((rg, k) => {
    const d = ellipseArc(noteBaseAngles[rg.a] - pad + spinDeg, noteBaseAngles[rg.b] + pad + spinDeg);
    if (arcEls[rg.s]) arcEls[rg.s].setAttribute('d', d);
    if (arcHitEls[rg.s]) arcHitEls[rg.s].setAttribute('d', d);
  });
}

function tick(ts) {
  const D = window.BG_DUST || {};
  const dustRgb = D.rgb || '186, 158, 108';
  const glowRgb = D.glow || '206, 176, 122';
  /* 旋转推进（进入后才开始转，尊重系统"减弱动态效果"设置） */
  if (!lastT) lastT = ts;
  const dt = Math.min(100, ts - lastT);
  lastT = ts;
  if (!REDUCE_MOTION && entered) {
    spinDeg = (spinDeg + dt * 0.001 * SPIN_PER_SEC) % 360;
    layoutRing();
  }
  cx2.clearRect(0, 0, W, H);
  for (const p of parts) {
    p.x += p.vx; p.y -= p.vy; p.tw += 0.02 * p.ts;
    if (p.life !== undefined) {
      p.life -= 0.006;
      p.vx *= 0.985; p.vy *= 0.985;
    }
    const alpha = p.life !== undefined
      ? Math.max(0, p.a * p.life) * (0.6 + 0.4 * Math.sin(p.tw))
      : p.a * (0.55 + 0.45 * Math.sin(p.tw));
    if (alpha <= 0.01) continue;
    cx2.beginPath();
    cx2.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    cx2.fillStyle = `rgba(${dustRgb}, ${alpha.toFixed(3)})`;
    cx2.fill();
    if (p.r > 1.6) {
      cx2.beginPath();
      cx2.arc(p.x, p.y, p.r * 3.2, 0, Math.PI * 2);
      cx2.fillStyle = `rgba(${glowRgb}, ${(alpha * 0.08).toFixed(3)})`;
      cx2.fill();
    }
  }
  parts = parts.filter(p =>
    p.life === undefined ? p.y > -20 : p.life > 0
  );
  if (parts.length < dustCount && Math.random() < 0.35) parts.push(spawn());
  requestAnimationFrame(tick);
}
tick();

/* ---------- 启动：优先用本机保存的名单 ---------- */
(function boot() {
  const stored = Roster.loadStored();
  if (stored && Array.isArray(stored.members)) {
    MEMBERS = stored.members;
    if (stored.sections && stored.sections.length === 3) SECTIONS = stored.sections;
    rosterLabel = stored.label || '上传名单';
    AudioEngine.rebuild(MEMBERS);
  }
  buildStage();
  Roster.initUI({
    apply: applyRoster,
    resetDefault: restoreDefault,
    getMembers: () => MEMBERS,
    getLabel: () => rosterLabel,
    toast,
  });

})();
