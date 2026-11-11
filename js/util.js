'use strict';
// Shared helpers. Everything hangs off the global `G` namespace so the site
// works as plain <script> tags (no build step, no modules).
window.G = window.G || {};

// Small seeded PRNG (mulberry32) so the city looks the same on every visit.
G.rng = function (seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

G.clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

G.canvas = function (w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, w | 0);
  c.height = Math.max(1, h | 0);
  return c;
};

// Fill a "wall-plane" parallelogram pixel column by pixel column:
// vertical sides, top/bottom edges with slope `s` (±0.5 for isometric walls).
// This gives the crisp 2:1 staircase edges of classic isometric pixel art.
G.slab = function (ctx, x0, y0, w, h, s) {
  for (let i = 0; i < w; i++) ctx.fillRect(x0 + i, Math.floor(y0 + s * i), 1, h);
};

// localStorage can throw (private mode, blocked storage) — never let it break the page.
G.store = {
  get(key, fallback) {
    try {
      const v = localStorage.getItem(key);
      return v ? JSON.parse(v) : fallback;
    } catch (e) {
      return fallback;
    }
  },
  set(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* ignore */ }
  },
};
