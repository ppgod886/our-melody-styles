/* 水墨卷 · 背景：缓缓漂移的墨雾 */
(() => {
  const cv = document.createElement('canvas');
  Object.assign(cv.style, { position: 'fixed', inset: 0, width: '100%', height: '100%', zIndex: 1, pointerEvents: 'none' });
  document.body.appendChild(cv);
  const ctx = cv.getContext('2d');
  let W, H;
  const resize = () => { W = cv.width = innerWidth; H = cv.height = innerHeight; };
  addEventListener('resize', resize); resize();

  // 三团墨雾
  const fogs = [
    { x: .22, y: .68, r: .34, a: .05, vx: .00016, vy: -.00006 },
    { x: .72, y: .3,  r: .3,  a: .04, vx: -.00012, vy: .00008 },
    { x: .5,  y: .88, r: .4,  a: .035, vx: .0001, vy: -.00004 },
  ];

  let last = performance.now();
  function frame(now) {
    const dt = Math.min(100, now - last); last = now;
    ctx.clearRect(0, 0, W, H);
    for (const f of fogs) {
      f.x += f.vx * dt; f.y += f.vy * dt;
      if (f.x < -.2) f.x = 1.2; if (f.x > 1.2) f.x = -.2;
      if (f.y < -.2) f.y = 1.2; if (f.y > 1.2) f.y = -.2;
      const g = ctx.createRadialGradient(f.x * W, f.y * H, 0, f.x * W, f.y * H, f.r * Math.max(W, H));
      g.addColorStop(0, `rgba(70,62,50,${f.a})`);
      g.addColorStop(1, 'rgba(70,62,50,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
