'use strict';
// Game loop, layout and input.
(() => {
  const R = G.Room, TV = G.TV;
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const moveHint = document.getElementById('move-hint');
  const bubbles = document.getElementById('bubbles');

  let S = 2, Wi = 0, Hi = 0, ox = 0, oy = 0, vignette = null;
  const roomImg = R.build();
  const city = new G.City();
  const avatar = new G.Avatar(8, 9);
  let hover = null, moveBackup = null;
  let t = 0, last = performance.now();

  // Pick a pixel scale so the room fits; integer scales when there is room for them.
  function resize() {
    const W = innerWidth, H = innerHeight;
    const fit = Math.min(W / 760, H / 520);
    S = fit >= 2 ? Math.floor(fit) : Math.max(0.35, fit);
    Wi = Math.ceil(W / S); Hi = Math.ceil(H / S);
    canvas.width = Wi; canvas.height = Hi;
    canvas.style.width = Wi * S + 'px';
    canvas.style.height = Hi * S + 'px';
    ctx.imageSmoothingEnabled = false;

    const roomH = R.WALL_H + R.WT + R.L + R.FT;
    ox = Math.round(Wi / 2);
    oy = Math.round((Hi - roomH) / 2) + R.WALL_H + R.WT + 6;

    city.build(Wi, Hi);
    vignette = G.canvas(Wi, Hi);
    const vg = vignette.getContext('2d');
    const gr = vg.createRadialGradient(Wi / 2, Hi / 2, Math.min(Wi, Hi) * 0.35, Wi / 2, Hi / 2, Math.hypot(Wi, Hi) / 2);
    gr.addColorStop(0, 'rgba(5,0,15,0)');
    gr.addColorStop(1, 'rgba(5,0,15,.55)');
    vg.fillStyle = gr; vg.fillRect(0, 0, Wi, Hi);
  }

  const nearTV = () => TV.isNear(avatar.wx, avatar.wy);

  function faceTV() {
    if (TV.state.wall === 'L') avatar.face(-1, 0); else avatar.face(0, -1);
  }

  function say(text) {
    while (bubbles.children.length > 2) bubbles.firstChild.remove();
    const p = R.toScreen(avatar.wx, avatar.wy, ox, oy);
    const b = document.createElement('div');
    b.className = 'bubble';
    const name = document.createElement('b');
    name.textContent = 'you:';
    b.append(name, text);
    b.style.left = p.x * S + 'px';
    b.style.top = (p.y - 46) * S + 'px';
    b.addEventListener('animationend', () => b.remove());
    bubbles.appendChild(b);
  }

  const FAR_LINES = ['Too far away… walking over.', 'I need to get closer to the TV.', 'Hold on, let me get closer.'];

  // ------------------------------------------------------------------- input
  function toInternal(e) {
    const r = canvas.getBoundingClientRect();
    return { x: (e.clientX - r.left) / S, y: (e.clientY - r.top) / S };
  }

  canvas.addEventListener('pointermove', (e) => {
    const p = toInternal(e);
    if (moveBackup) { TV.placeAt(p.x - ox, p.y - oy); return; }
    const onTV = TV.contains(p.x, p.y, ox, oy);
    hover = onTV ? null : R.tileAt(p.x, p.y, ox, oy);
    canvas.classList.toggle('pointer', onTV);
  });
  canvas.addEventListener('pointerleave', () => { hover = null; });

  canvas.addEventListener('click', (e) => {
    const p = toInternal(e);
    if (moveBackup) { TV.placeAt(p.x - ox, p.y - oy); finishMove(true); return; }

    if (TV.contains(p.x, p.y, ox, oy)) {
      if (nearTV() && !avatar.walking) {
        faceTV();
        TV.openPanel();
      } else {
        const g = TV.approachTile();
        avatar.walkTo(g.x, g.y);
        avatar.onArrive = faceTV;
        if (!nearTV()) say(FAR_LINES[(Math.random() * FAR_LINES.length) | 0]);
      }
      return;
    }

    const tile = R.tileAt(p.x, p.y, ox, oy);
    if (tile) { avatar.onArrive = null; avatar.walkTo(tile.x, tile.y); }
  });

  function startMove() {
    if (moveBackup) return;
    if (TV.focused()) TV.setFocus(false);
    moveBackup = TV.snapshot();
    TV.closePanel();
    moveHint.hidden = false;
    canvas.classList.add('moving');
    canvas.classList.remove('pointer');
    hover = null;
  }

  function finishMove(commit) {
    if (!moveBackup) return;
    if (commit) TV.save(); else TV.restore(moveBackup);
    moveBackup = null;
    moveHint.hidden = true;
    canvas.classList.remove('moving');
  }

  window.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (moveBackup) finishMove(false);
    else if (TV.focused()) TV.setFocus(false);
    else if (TV.panelOpen()) TV.closePanel();
  });

  G.Game = { startMove };

  // -------------------------------------------------------------------- loop
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now; t += dt;

    avatar.update(dt);
    city.update(dt, t);
    if (TV.panelOpen() && !nearTV()) TV.closePanel();

    city.draw(ctx, t);

    // soft shadow under the floating room
    ctx.save();
    ctx.translate(ox, oy + R.L * 0.8);
    ctx.scale(1, 0.45);
    const sh = ctx.createRadialGradient(0, 0, 40, 0, 0, 430);
    sh.addColorStop(0, 'rgba(0,0,0,.55)');
    sh.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = sh;
    ctx.fillRect(-440, -440, 880, 880);
    ctx.restore();

    ctx.drawImage(roomImg, ox - R.OX, oy - R.OY);
    TV.draw(ctx, ox, oy, t);
    if (hover) R.outline(ctx, ox + (hover.x - hover.y) * R.HW, oy + (hover.x + hover.y) * R.HH, 'rgba(255,255,255,.85)');

    const p = R.toScreen(avatar.wx, avatar.wy, ox, oy);
    avatar.draw(ctx, p.x, p.y, t, TV.isPlaying());

    ctx.drawImage(vignette, 0, 0);
    TV.sync(S, ox, oy);
    requestAnimationFrame(frame);
  }

  resize();
  window.addEventListener('resize', resize);
  // Re-render the neon signs once the pixel font has arrived.
  window.addEventListener('load', () => {
    if (!document.fonts) return;
    document.fonts.load('11px "DotGothic16"', 'ラーメン').then((f) => { if (f.length) city.build(Wi, Hi); }).catch(() => {});
  });
  requestAnimationFrame(frame);
})();
