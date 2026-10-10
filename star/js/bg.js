/* 星轨 · 背景：星座连线（沿音符实时绘制）+ 偶发流星 */
(() => {
  // 星座连线：直接画进 #stage 的 SVG，坐标与音符同系
  const NS = 'http://www.w3.org/2000/svg';
  const stage = document.getElementById('stage');
  const g = document.createElementNS(NS, 'g');
  stage.appendChild(g);

  const lines = [];
  const LINE_N = 22;
  for (let i = 0; i < LINE_N; i++) {
    const ln = document.createElementNS(NS, 'line');
    ln.setAttribute('class', 'constellation');
    ln.setAttribute('stroke', '#a8baff');
    ln.setAttribute('stroke-width', '0.7');
    ln.setAttribute('opacity', '0');
    g.appendChild(ln);
    lines.push(ln);
  }

  // 每帧把连线接到 window.__notePos 的相邻星（跳连，更像星座图）
  let tickN = 0;
  function draw() {
    tickN++;
    const pos = window.__notePos;
    if (!pos || !pos.length) return;
    const n = pos.length;
    for (let i = 0; i < LINE_N; i++) {
      const a = (i * 3) % n;
      const b = (a + 2 + (i % 3)) % n;
      const ln = lines[i];
      ln.setAttribute('x1', pos[a][0].toFixed(1));
      ln.setAttribute('y1', pos[a][1].toFixed(1));
      ln.setAttribute('x2', pos[b][0].toFixed(1));
      ln.setAttribute('y2', pos[b][1].toFixed(1));
      // 呼吸明灭
      const tw = .5 + .5 * Math.sin(tickN * .01 + i * 1.7);
      ln.setAttribute('opacity', (0.05 + tw * 0.16).toFixed(3));
    }
    requestAnimationFrame(draw);
  }
  requestAnimationFrame(draw);

  // 流星：独立画布，每 6~12 秒一颗
  const cv = document.createElement('canvas');
  Object.assign(cv.style, { position: 'fixed', inset: 0, width: '100%', height: '100%', zIndex: 1, pointerEvents: 'none' });
  document.body.appendChild(cv);
  const ctx = cv.getContext('2d');
  let W, H;
  const resize = () => { W = cv.width = innerWidth; H = cv.height = innerHeight; };
  addEventListener('resize', resize); resize();

  let meteors = [];
  function spawnMeteor() {
    const x = W * (0.15 + Math.random() * 0.7);
    const y = H * Math.random() * 0.4;
    const ang = Math.PI * (0.72 + Math.random() * 0.2);
    const sp = 9 + Math.random() * 6;
    meteors.push({ x, y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, life: 1 });
    setTimeout(spawnMeteor, 6000 + Math.random() * 7000);
  }
  setTimeout(spawnMeteor, 3500);

  let last = performance.now();
  function frame(now) {
    const dt = Math.min(60, now - last); last = now;
    ctx.clearRect(0, 0, W, H);
    for (const m of meteors) {
      // 拖尾
      const tailX = m.x - m.vx * 9, tailY = m.y - m.vy * 9;
      const gr = ctx.createLinearGradient(m.x, m.y, tailX, tailY);
      gr.addColorStop(0, `rgba(230,238,255,${(m.life * .9).toFixed(2)})`);
      gr.addColorStop(1, 'rgba(230,238,255,0)');
      ctx.strokeStyle = gr;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(m.x, m.y); ctx.lineTo(tailX, tailY);
      ctx.stroke();
      m.x += m.vx * dt * .06; m.y += m.vy * dt * .06;
      m.life -= .012;
    }
    meteors = meteors.filter(m => m.life > 0 && m.x > -80 && m.x < W + 80 && m.y < H + 80);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
