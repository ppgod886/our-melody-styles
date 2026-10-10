/* Y2K · 背景：飘浮的全息光斑（网格由 CSS 绘制） */
(() => {
  const cv = document.createElement('canvas');
  Object.assign(cv.style, { position: 'fixed', inset: 0, width: '100%', height: '100%', zIndex: 1, pointerEvents: 'none', opacity: .8 });
  document.body.appendChild(cv);
  const ctx = cv.getContext('2d');
  let W, H;
  const resize = () => { W = cv.width = innerWidth; H = cv.height = innerHeight; };
  addEventListener('resize', resize); resize();

  const orbs = [
    { x: .16, y: .18, r: .1,  c: '255,157,242', a: .1,  ph: 0 },
    { x: .84, y: .3,  r: .13, c: '77,216,255',  a: .09, ph: 2 },
    { x: .3,  y: .75, r: .16, c: '185,107,255', a: .08, ph: 4 },
    { x: .7,  y: .62, r: .07, c: '127,227,255', a: .12, ph: 1 },
  ];

  let last = performance.now(), t = 0;
  function frame(now) {
    const dt = Math.min(100, now - last); last = now; t += dt;
    ctx.clearRect(0, 0, W, H);
    for (const o of orbs) {
      const wob = Math.sin(t * .0004 + o.ph) * 14;
      const x = o.x * W + wob, y = o.y * H - wob * .6;
      const r = o.r * Math.max(W, H) * (1 + Math.sin(t * .0006 + o.ph) * .08);
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, `rgba(${o.c},${o.a})`);
      g.addColorStop(1, `rgba(${o.c},0)`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
