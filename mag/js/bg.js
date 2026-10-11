/* 杂志刊 · 背景：动态胶片颗粒（低频刷新的噪点层） */
(() => {
  const grain = document.querySelector('.grain') || document.createElement('div');
  grain.classList.add('grain-layer');
  Object.assign(grain.style, {
    position: 'fixed', inset: '-40px', zIndex: 4, pointerEvents: 'none',
    opacity: .35, mixBlendMode: 'multiply',
  });
  if (!grain.parentElement) document.body.appendChild(grain);

  // 程序生成噪点贴图（两张交替，胶片跳帧感）
  const make = (alpha) => {
    const c = document.createElement('canvas');
    c.width = 280; c.height = 280;
    const x = c.getContext('2d');
    const d = x.createImageData(280, 280);
    for (let i = 0; i < d.data.length; i += 4) {
      const v = 120 + Math.random() * 135 | 0;
      d.data[i] = d.data[i + 1] = d.data[i + 2] = v;
      d.data[i + 3] = Math.random() < alpha ? 46 : 0;
    }
    x.putImageData(d, 0, 0);
    return `url(${c.toDataURL()})`;
  };

  const a = make(.5), b = make(.5);
  let flip = false;
  if (window.REDUCE_MOTION) { grain.style.backgroundImage = a; return; }
  setInterval(() => {
    flip = !flip;
    grain.style.backgroundImage = flip ? a : b;
  }, 85);
  grain.style.backgroundImage = a;
})();
