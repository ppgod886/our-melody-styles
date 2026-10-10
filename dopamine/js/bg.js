/* 多巴胺 · 背景：奶油底上的漂浮糖果色云团 + 终章彩纸 */
(() => {
  const cv = document.createElement('canvas');
  Object.assign(cv.style, { position: 'fixed', inset: 0, width: '100%', height: '100%', zIndex: 1, pointerEvents: 'none' });
  document.body.appendChild(cv);
  const ctx = cv.getContext('2d');
  let W, H;
  const resize = () => { W = cv.width = innerWidth; H = cv.height = innerHeight; };
  addEventListener('resize', resize); resize();

  const blobs = [
    { x: .15, y: .2,  r: .28, c: '255,214,232', a: .5,  vx: .00012, vy: .00007 },
    { x: .85, y: .25, r: .24, c: '201,242,228', a: .45, vx: -.0001, vy: .00009 },
    { x: .2,  y: .8,  r: .3,  c: '232,217,255', a: .4,  vx: .00009, vy: -.00008 },
    { x: .8,  y: .78, r: .26, c: '255,241,201', a: .5,  vx: -.00011, vy: -.00006 },
  ];
  let confetti = [];
  let finaleOn = false;

  // 监听终章出现 → 撒彩纸
  const mo = new MutationObserver(() => {
    const on = document.getElementById('finale').classList.contains('show');
    if (on && !finaleOn) {
      finaleOn = true;
      const colors = ['#ff7fa5', '#5ec8b7', '#ffb35c', '#8f9bff', '#e58fd8', '#ffe9a8'];
      for (let i = 0; i < 140; i++) {
        confetti.push({
          x: W / 2 + (Math.random() - .5) * 200, y: H * .35 + (Math.random() - .5) * 100,
          vx: (Math.random() - .5) * 9, vy: -4 - Math.random() * 6,
          rot: Math.random() * Math.PI, vr: (Math.random() - .5) * .3,
          c: colors[i % colors.length], w: 6 + Math.random() * 6, h: 4 + Math.random() * 5,
          life: 1,
        });
      }
    }
    if (!on) finaleOn = false;
  });
  const check = () => {
    const f = document.getElementById('finale');
    if (f) { mo.observe(f, { attributes: true, attributeFilter: ['class'] }); }
    else setTimeout(check, 300);
  };
  check();

  let last = performance.now();
  function frame(now) {
    const dt = Math.min(60, now - last); last = now;
    ctx.clearRect(0, 0, W, H);
    // 糖果云
    for (const b of blobs) {
      b.x += b.vx * dt; b.y += b.vy * dt;
      if (b.x < -.15) b.x = 1.15; if (b.x > 1.15) b.x = -.15;
      if (b.y < -.15) b.y = 1.15; if (b.y > 1.15) b.y = -.15;
      const g = ctx.createRadialGradient(b.x * W, b.y * H, 0, b.x * W, b.y * H, b.r * Math.max(W, H));
      g.addColorStop(0, `rgba(${b.c},${b.a})`);
      g.addColorStop(1, `rgba(${b.c},0)`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    }
    // 彩纸
    for (const p of confetti) {
      p.x += p.vx * dt * .06; p.y += p.vy * dt * .06;
      p.vy += .012 * dt * .06;
      p.rot += p.vr * dt * .06;
      p.life -= .0035;
      if (p.life > 0) {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.globalAlpha = Math.min(1, p.life);
        ctx.fillStyle = p.c;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      }
    }
    confetti = confetti.filter(p => p.life > 0 && p.y < H + 40);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
