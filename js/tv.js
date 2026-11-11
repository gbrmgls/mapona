'use strict';
// The wall TV: drawing, placement on the walls, the YouTube player skewed onto
// its screen, and the TV control window.
G.TV = (() => {
  const DEFAULT_MEDIA = { kind: 'video', id: 'Oblb4xGO6k4' };
  const TVW = 64, TVH = 38, HALF_U = 2;          // size on the wall (px); half width in tiles
  const H_MIN = 40, H_MAX = G.Room.WALL_H - TVH - 6; // keeps it above the avatar's head
  const VW = 480, VH = 270;                       // iframe layout size (YouTube wants >= 200x200)

  const $ = (id) => document.getElementById(id);
  const el = {
    screen: $('tv-screen'), panel: $('tv-panel'), drag: $('tv-drag'), close: $('tv-close'),
    title: $('tv-title'), prev: $('tv-prev'), play: $('tv-play'), next: $('tv-next'),
    mute: $('tv-mute'), vol: $('tv-vol'), form: $('tv-form'), url: $('tv-url'), msg: $('tv-msg'),
    watch: $('tv-watch'), move: $('tv-move'), power: $('tv-power'), reset: $('tv-reset'),
    backdrop: $('focus-backdrop'), focusClose: $('focus-close'), soundHint: $('sound-hint'),
  };

  const clampU = (u) => Math.round(G.clamp(u, HALF_U, G.Room.N - HALF_U) * 8) / 8;
  const validMedia = (m) => m && ((m.kind === 'video' && /^[\w-]{11}$/.test(m.id)) || (m.kind === 'list' && /^[\w-]{10,}$/.test(m.list)));

  const saved = G.store.get('mapona.tv', {}) || {};
  const s = {
    wall: saved.wall === 'L' ? 'L' : 'R',
    u: clampU(Number.isFinite(saved.u) ? saved.u : 10),
    hb: G.clamp(Math.round(Number.isFinite(saved.hb) ? saved.hb : 52), H_MIN, H_MAX),
    media: validMedia(saved.media) ? saved.media : DEFAULT_MEDIA,
    on: saved.on !== false,
    vol: Number.isFinite(saved.vol) ? G.clamp(saved.vol, 0, 100) : 70,
    muted: !!saved.muted,
  };
  const save = () => G.store.set('mapona.tv', s);

  let player = null, ready = false, playing = false, errored = false, gestured = false;
  let focus = false, lastTransform = '', animTimer = 0, panelPlaced = false;

  // ------------------------------------------------------------------ geometry
  // Top-left of the TV on the main canvas, plus the wall slope.
  function geom(ox, oy) {
    const sl = s.wall === 'L' ? -0.5 : 0.5;
    const x0 = s.wall === 'L' ? ox - (s.u + HALF_U) * 16 : ox + (s.u - HALF_U) * 16;
    const y0 = oy + (s.wall === 'L' ? s.u + HALF_U : s.u - HALF_U) * 8 - (s.hb + TVH);
    return { x0, y0, sl };
  }

  function contains(mx, my, ox, oy) {
    const { x0, y0, sl } = geom(ox, oy);
    if (mx < x0 || mx >= x0 + TVW) return false;
    const top = y0 + sl * (mx - x0);
    return my >= top && my < top + TVH;
  }

  // Hang the TV on whichever wall is under the point (relative to the room origin).
  function placeAt(rx, ry) {
    s.wall = rx < 0 ? 'L' : 'R';
    const u = Math.abs(rx) / 16;
    s.u = clampU(u);
    s.hb = G.clamp(Math.round(u * 8 - ry - TVH / 2), H_MIN, H_MAX);
  }

  // The tile the avatar should walk to in order to use the TV.
  function approachTile() {
    const i = G.clamp(Math.floor(s.u), 0, G.Room.N - 1);
    return s.wall === 'L' ? { x: 1, y: i } : { x: i, y: 1 };
  }

  function isNear(wx, wy) {
    return s.wall === 'L'
      ? wx <= 3 && Math.abs(wy - s.u) <= 3
      : wy <= 3 && Math.abs(wx - s.u) <= 3;
  }

  // ------------------------------------------------------------------- drawing
  function draw(g, ox, oy, t) {
    const { x0, y0, sl } = geom(ox, oy);
    const R = (dx, dy, w, h, c) => { g.fillStyle = c; G.slab(g, x0 + dx, y0 + sl * dx + dy, w, h, sl); };

    // the screen lights up the room
    if (s.on) {
      const cx = x0 + TVW / 2, cy = y0 + sl * (TVW / 2) + TVH / 2;
      const a = playing ? 0.2 + 0.04 * Math.sin(t * 3.1) : 0.07;
      const hue = 200 + 70 * Math.sin(t * 0.35);
      g.save();
      G.Room.hexPath(g, ox, oy);
      g.clip();
      g.globalCompositeOperation = 'lighter';
      const gr = g.createRadialGradient(cx, cy, 6, cx, cy, 150);
      gr.addColorStop(0, `hsla(${hue},100%,65%,${a})`);
      gr.addColorStop(1, `hsla(${hue},100%,65%,0)`);
      g.fillStyle = gr;
      g.fillRect(cx - 150, cy - 150, 300, 300);
      g.restore();
    }

    R(2, 3, TVW, TVH, 'rgba(20,10,40,.28)');   // shadow on the wall
    R(0, 0, TVW, TVH, '#1c1b24');                // bezel
    R(0, 0, TVW, 1, '#3d3a4c');
    R(0, TVH - 1, TVW, 1, '#0c0b10');
    R(0, 0, 1, TVH, '#2b2938');
    R(TVW - 1, 0, 1, TVH, '#121118');
    R(4, 3, 56, 31, '#06070c');                  // screen (video sits on top of this)
    if (!s.on) {
      R(8, 6, 10, 1, 'rgba(255,255,255,.07)');
      R(8, 7, 6, 1, 'rgba(255,255,255,.05)');
    } else if (!ready || errored) {
      for (let i = 0; i < 160; i++) {
        const v = (Math.random() * 120) | 0;
        R(4 + ((Math.random() * 56) | 0), 3 + ((Math.random() * 31) | 0), 1, 1, `rgb(${v},${v},${v + 20})`);
      }
    }
    R(29, 35, 6, 1, '#4a4760');
    R(58, 35, 1, 1, !s.on ? '#ff3b3b' : playing ? '#4dff88' : '#ffb347');
  }

  // Keep the iframe glued to the painted screen: a CSS matrix that scales the
  // 480x270 player down and shears it along the wall.
  function sync(S, ox, oy) {
    el.screen.classList.toggle('off', !s.on);
    if (focus) return;
    const { x0, y0, sl } = geom(ox, oy);
    const a = (54 * S) / VW, d = (29 * S) / VH;
    const e = (x0 + 5) * S, f = (y0 + sl * 5 + 4) * S;
    const tf = `matrix(${a},${sl * a},0,${d},${e},${f})`;
    if (tf !== lastTransform) { el.screen.style.transform = tf; lastTransform = tf; }
  }

  // ------------------------------------------------------------------- YouTube
  function parseYouTube(str) {
    str = (str || '').trim();
    if (!str) return null;
    if (/^[\w-]{11}$/.test(str)) return { kind: 'video', id: str };
    if (/^(PL|UU|OL|FL)[\w-]{10,}$/.test(str)) return { kind: 'list', list: str };
    let u;
    try { u = new URL(/^https?:\/\//i.test(str) ? str : 'https://' + str); } catch (e) { return null; }
    const host = u.hostname.replace(/^(www|m|music)\./, '');
    let id = null;
    if (host === 'youtu.be') id = u.pathname.split('/')[1];
    else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
      id = u.searchParams.get('v');
      if (!id) {
        const m = u.pathname.match(/^\/(embed|shorts|live|v)\/([\w-]{11})/);
        if (m) id = m[2];
      }
    } else return null;
    const list = u.searchParams.get('list');
    // auto-generated "mix" lists (RD...) can't be embedded, prefer the single video
    if (id && /^[\w-]{11}$/.test(id) && (!list || list.startsWith('RD'))) {
      const tt = u.searchParams.get('t') || u.searchParams.get('start');
      return { kind: 'video', id, start: tt ? parseTime(tt) : 0 };
    }
    if (list && !list.startsWith('RD')) return { kind: 'list', list };
    return null;
  }

  function parseTime(v) {
    if (/^\d+$/.test(v)) return +v;
    const m = v.match(/(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?/);
    return m ? (+m[1] || 0) * 3600 + (+m[2] || 0) * 60 + (+m[3] || 0) : 0;
  }

  function loadAPI() {
    window.onYouTubeIframeAPIReady = createPlayer;
    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    tag.onerror = () => setMsg('Could not reach YouTube — the TV is showing static.');
    document.head.appendChild(tag);
  }

  function createPlayer() {
    const m = s.media;
    const vars = {
      autoplay: s.on ? 1 : 0, mute: 1, controls: 0, rel: 0, playsinline: 1,
      iv_load_policy: 3, disablekb: 1, fs: 0, loop: 1,
    };
    if (/^https?:$/.test(location.protocol)) vars.origin = location.origin;
    const opts = { width: VW, height: VH, playerVars: vars, events: { onReady, onStateChange, onError } };
    if (m.kind === 'video') {
      opts.videoId = m.id;
      vars.playlist = m.id; // makes a single video loop
      if (m.start) vars.start = m.start;
    } else {
      vars.listType = 'playlist';
      vars.list = m.list;
    }
    player = new YT.Player('yt', opts);
  }

  function onReady() {
    ready = true;
    applyVolume();
    if (s.on) player.playVideo();
    refresh();
  }

  function onStateChange(e) {
    playing = e.data === 1;
    if (playing) { errored = false; if (el.msg.dataset.kind === 'error') setMsg(''); }
    if (e.data === 0 && s.media.kind === 'video') { player.seekTo(0); player.playVideo(); }
    refresh();
  }

  function onError(e) {
    errored = true; playing = false;
    const why = {
      2: 'That link does not look like a valid video.',
      5: 'This video cannot play in the browser player.',
      100: 'Video not found (removed or private).',
      101: 'The owner does not allow this video to play on other sites.',
      150: 'The owner does not allow this video to play on other sites.',
      153: 'YouTube needs the page served over http(s) — open it through a web server.',
    }[e.data] || `YouTube error ${e.data}.`;
    setMsg(why, 'error');
    refresh();
  }

  function applyVolume() {
    if (!ready) return;
    player.setVolume(s.vol);
    if (!gestured || s.muted || s.vol === 0) player.mute(); else player.unMute();
  }

  // Browsers only allow sound after the visitor interacts with the page.
  function onGesture() {
    if (gestured) return;
    gestured = true;
    el.soundHint.hidden = true;
    applyVolume();
    if (ready && s.on) player.playVideo();
  }

  function tune(m) {
    s.media = m; errored = false; save();
    if (!s.on) setPower(true);
    if (!ready) return;
    if (m.kind === 'video') player.loadVideoById({ videoId: m.id, startSeconds: m.start || 0 });
    else { player.loadPlaylist({ list: m.list, listType: 'playlist', index: 0 }); player.setLoop(true); }
  }

  function setPower(on) {
    s.on = on; save();
    if (ready) { if (on) player.playVideo(); else player.pauseVideo(); }
    if (!on && focus) setFocus(false);
    refresh();
  }

  // ------------------------------------------------------------- watch (focus)
  function setFocus(on) {
    if (on && !s.on) setPower(true);
    focus = on;
    el.backdrop.hidden = !on;
    el.screen.classList.add('anim');
    el.screen.classList.toggle('focus', on);
    if (on) {
      const tw = Math.min(innerWidth * 0.88, innerHeight * 0.78 * (16 / 9));
      const k = tw / VW;
      el.screen.style.transform = `matrix(${k},0,0,${k},${(innerWidth - tw) / 2},${(innerHeight - VH * k) / 2})`;
    }
    lastTransform = '';
    clearTimeout(animTimer);
    animTimer = setTimeout(() => el.screen.classList.remove('anim'), 550);
    refresh();
  }

  // -------------------------------------------------------------------- panel
  function setMsg(text, kind) { el.msg.textContent = text; el.msg.dataset.kind = kind || ''; }

  function refresh() {
    let title = '—';
    if (!s.on) title = '(TV is off)';
    else if (ready) {
      try { title = (player.getVideoData && player.getVideoData().title) || 'tuning…'; } catch (e) { title = '—'; }
    } else title = 'tuning…';
    el.title.textContent = title;
    el.title.title = title;
    el.play.textContent = playing ? '❚❚' : '▶';
    el.mute.textContent = s.muted || s.vol === 0 ? '🔇' : '🔊';
    el.vol.value = s.vol;
    el.power.textContent = s.on ? '⏻ Off' : '⏻ On';
    el.watch.textContent = focus ? '⛶ Wall' : '⛶ Watch';
    const isList = s.media.kind === 'list';
    el.prev.disabled = el.next.disabled = !isList;
    el.prev.style.opacity = el.next.style.opacity = isList ? 1 : 0.4;
  }

  function openPanel() {
    el.panel.hidden = false;
    if (!panelPlaced) {
      const w = el.panel.offsetWidth;
      el.panel.style.left = Math.max(16, innerWidth - w - 28) + 'px';
      el.panel.style.top = Math.max(70, Math.round(innerHeight * 0.18)) + 'px';
      panelPlaced = true;
    }
    keepPanelOnScreen();
    refresh();
  }
  function closePanel() { el.panel.hidden = true; }
  const panelOpen = () => !el.panel.hidden;

  function keepPanelOnScreen() {
    const r = el.panel.getBoundingClientRect();
    el.panel.style.left = G.clamp(r.left, 8, Math.max(8, innerWidth - r.width - 8)) + 'px';
    el.panel.style.top = G.clamp(r.top, 8, Math.max(8, innerHeight - r.height - 8)) + 'px';
  }

  // drag the window by its title bar
  el.drag.addEventListener('pointerdown', (e) => {
    if (e.target === el.close) return;
    const r = el.panel.getBoundingClientRect(), dx = e.clientX - r.left, dy = e.clientY - r.top;
    el.drag.setPointerCapture(e.pointerId);
    const move = (ev) => {
      el.panel.style.left = ev.clientX - dx + 'px';
      el.panel.style.top = ev.clientY - dy + 'px';
    };
    const up = () => {
      el.drag.removeEventListener('pointermove', move);
      el.drag.removeEventListener('pointerup', up);
      keepPanelOnScreen();
    };
    el.drag.addEventListener('pointermove', move);
    el.drag.addEventListener('pointerup', up);
  });

  el.close.addEventListener('click', closePanel);
  el.play.addEventListener('click', () => {
    if (!s.on) return setPower(true);
    if (!ready) return;
    if (playing) player.pauseVideo(); else player.playVideo();
  });
  el.prev.addEventListener('click', () => ready && player.previousVideo());
  el.next.addEventListener('click', () => ready && player.nextVideo());
  el.mute.addEventListener('click', () => {
    s.muted = !(s.muted || s.vol === 0);
    if (!s.muted && s.vol === 0) s.vol = 50;
    save(); applyVolume(); refresh();
  });
  el.vol.addEventListener('input', () => {
    s.vol = +el.vol.value; s.muted = false;
    save(); applyVolume(); refresh();
  });
  el.form.addEventListener('submit', (e) => {
    e.preventDefault();
    const m = parseYouTube(el.url.value);
    if (!m) { setMsg('Paste a YouTube video or playlist link.', 'error'); return; }
    setMsg(m.kind === 'list' ? 'Tuning in to the playlist…' : 'Tuning in…');
    el.url.value = '';
    tune(m);
  });
  el.reset.addEventListener('click', () => { setMsg('Back on the lofi channel.'); tune(DEFAULT_MEDIA); });
  el.power.addEventListener('click', () => setPower(!s.on));
  el.watch.addEventListener('click', () => setFocus(!focus));
  el.move.addEventListener('click', () => G.Game.startMove());
  el.focusClose.addEventListener('click', () => setFocus(false));
  el.backdrop.addEventListener('click', (e) => { if (e.target === el.backdrop) setFocus(false); });

  document.addEventListener('pointerdown', onGesture, true);
  document.addEventListener('keydown', (e) => { if (e.key !== 'Escape') onGesture(); }, true);
  setInterval(() => { if (panelOpen()) refresh(); }, 1000);
  window.addEventListener('resize', () => { if (focus) setFocus(true); if (panelOpen()) keepPanelOnScreen(); });

  loadAPI();
  refresh();

  return {
    state: s, geom, contains, placeAt, approachTile, isNear, draw, sync,
    openPanel, closePanel, panelOpen, setFocus,
    focused: () => focus,
    isPlaying: () => s.on && playing,
    snapshot: () => ({ wall: s.wall, u: s.u, hb: s.hb }),
    restore: (b) => { s.wall = b.wall; s.u = b.u; s.hb = b.hb; },
    save,
  };
})();
