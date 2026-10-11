import re, glob

# ============ 1) 共享 main.js：gcount 支持 data-fmt、dustCount ??、REDUCE_MOTION 暴露、
#                 closeModal 的 600ms timer 纳管 + startFinale 重入保护 ============
p = '_shared_main.js'
src = open(p, encoding='utf-8').read()

old = """  const gc = document.getElementById('gcount');
  if (gc) gc.textContent = zhNum;"""
new = """  const gc = document.getElementById('gcount');
  if (gc) gc.textContent = gc.dataset.fmt ? gc.dataset.fmt.replace('{n}', String(N)) : zhNum;"""
assert old in src, 'gcount'
src = src.replace(old, new)

old = "const dustCount = BG0.count || 130;"
new = "const dustCount = (BG0.count ?? 130);"
assert old in src, 'dustCount'
src = src.replace(old, new)

old = "const REDUCE_MOTION = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;"
new = old + "\nwindow.REDUCE_MOTION = REDUCE_MOTION;"
assert old in src, 'REDUCE_MOTION'
src = src.replace(old, new)

old = """  if (!silent && litCount === MEMBERS.length && !finaleDone) {
    setTimeout(startFinale, 600);
  }"""
new = """  if (!silent && litCount === MEMBERS.length && !finaleDone) {
    finaleTimers.push(setTimeout(startFinale, 600));
  }"""
assert old in src, 'closeModal timer'
src = src.replace(old, new)

old = """let finaleTimers = [];
function startFinale() {
  finaleDone = true;"""
new = """let finaleTimers = [];
function startFinale() {
  if (finaleDone) return;   // 防重入：600ms 内重复关卡片不会跑两遍终章
  finaleDone = true;"""
assert old in src, 'startFinale guard'
src = src.replace(old, new)

open(p, 'w', encoding='utf-8').write(src)
print('main.js patched')

# ============ 2) 五站 gate 增加 gcount span（各站措辞） ============
GATE_FMT = {
    'ink': '{n} 枚墨点',
    'dopamine': '{n} 颗糖果音符',
    'y2k': '{n} 道电波',
    'mag': '{n} 篇专稿',
    'star': '{n} 颗待认领的星',
}
GATE_OLD = {
    'ink': '二十五枚墨点落于纸上',
    'dopamine': '二十五颗糖果音符围成一环' if False else None,
    'y2k': None,
    'mag': None,
    'star': '二十五颗待认领的星',
}
for v, fmtv in GATE_FMT.items():
    p = f'{v}/index.html'
    src = open(p, encoding='utf-8').read()
    if 'id="gcount"' in src:
        print(v, 'gcount already'); continue
    # 找 gate 里第一段 g-line 的开头文本，把整段首词包进 span
    m = re.search(r'(<p class="g-line">\s*)([^<]{2,24})', src)
    assert m, v + ' g-line not found'
    lead = m.group(2)
    newblock = m.group(1) + '<span id="gcount" data-fmt="' + fmtv + '">' + lead + '</span>'
    src = src[:m.start(2)] + newblock + src[m.end(2):]
    open(p, 'w', encoding='utf-8').write(src)
    print(v, 'gcount span added, lead=', lead)

# ============ 3) star bg.js：连线层 pointer-events none + 减弱动态 ============
p = 'star/js/bg.js'
src = open(p, encoding='utf-8').read()
old = "  const g = document.createElementNS(NS, 'g');\n  stage.appendChild(g);"
new = "  const g = document.createElementNS(NS, 'g');\n  g.style.pointerEvents = 'none';\n  stage.appendChild(g);\n  if (window.REDUCE_MOTION) { return; }"
assert old in src, 'star g'
src = src.replace(old, new)
open(p, 'w', encoding='utf-8').write(src)
print('star bg patched')

# ============ 4) ink / dopamine / y2k bg.js：减弱动态时只画一帧 ============
for v in ['ink', 'dopamine', 'y2k']:
    p = f'{v}/js/bg.js'
    src = open(p, encoding='utf-8').read()
    old = "  requestAnimationFrame(frame);\n})();"
    new = "  if (window.REDUCE_MOTION) { frame(performance.now()); return; }\n  requestAnimationFrame(frame);\n})();"
    assert old in src, v + ' rAF'
    src = src.replace(old, new)
    open(p, 'w', encoding='utf-8').write(src)
    print(v, 'bg RM guard')

# ============ 5) mag bg.js：复用 .grain 节点 + 减弱动态保留静态贴图 ============
p = 'mag/js/bg.js'
src = open(p, encoding='utf-8').read()
old = """  const grain = document.createElement('div');
  grain.className = 'grain-layer';
  Object.assign(grain.style, {
    position: 'fixed', inset: '-40px', zIndex: 4, pointerEvents: 'none',
    opacity: .35, mixBlendMode: 'multiply',
  });
  document.body.appendChild(grain);"""
new = """  const grain = document.querySelector('.grain') || document.createElement('div');
  grain.classList.add('grain-layer');
  Object.assign(grain.style, {
    position: 'fixed', inset: '-40px', zIndex: 4, pointerEvents: 'none',
    opacity: .35, mixBlendMode: 'multiply',
  });
  if (!grain.parentElement) document.body.appendChild(grain);"""
assert old in src, 'mag grain'
src = src.replace(old, new)
# 减弱动态：不闪帧
old = """  let flip = false;
  setInterval(() => {"""
new = """  let flip = false;
  if (window.REDUCE_MOTION) { grain.style.backgroundImage = a; return; }
  setInterval(() => {"""
assert old in src
src = src.replace(old, new)
open(p, 'w', encoding='utf-8').write(src)
print('mag bg patched')
