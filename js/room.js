'use strict';
// The 20x20 isometric room: floor tiles, two bare walls, floor slab.
// Rendered once into an offscreen canvas; the game blits it every frame.
G.Room = (() => {
  const N = 20;        // tiles per side
  const HW = 16;       // half tile width  (tiles are 32x16 px)
  const HH = 8;        // half tile height
  const WALL_H = 112;  // wall height in px
  const FT = 8;        // floor slab thickness
  const WT = 4;        // wall thickness
  const PAD = 24;      // padding around the room inside its canvas (for glow)
  const L = N * HW;    // 320: horizontal span of one room edge

  // (OX, OY) = screen position of the back corner of the floor inside the room canvas.
  const OX = L + WT + PAD;
  const OY = PAD + WT + WALL_H;
  const W = OX * 2;
  const H = OY + L + FT + PAD;

  const C = {
    wallL: '#c6c2d8', wallR: '#a8a3bf', cap: '#e6e3f1', capEdge: '#f7f5fc', end: '#8a849f',
    floor: '#a99ead', floorHi: '#c0b6c4', floorLo: '#8e8394',
    edgeL: '#6c6178', edgeR: '#54485e', edgeHi: '#857a91',
  };

  // world (tile units, continuous) -> screen, relative to the room origin (ox, oy)
  function toScreen(wx, wy, ox, oy) {
    return { x: ox + (wx - wy) * HW, y: oy + (wx + wy) * HH };
  }

  // screen -> tile, or null when outside the floor
  function tileAt(x, y, ox, oy) {
    const a = (y - oy) / HH, b = (x - ox) / HW;
    const tx = Math.floor((a + b) / 2), ty = Math.floor((a - b) / 2);
    return tx >= 0 && ty >= 0 && tx < N && ty < N ? { x: tx, y: ty } : null;
  }

  // column half-height of a 32x16 diamond
  const k = (i) => (Math.min(i, 31 - i) >> 1) + 1;

  // pass 0: tile body, pass 1: bevelled edges (drawn after all bodies so
  // neighbouring tiles don't paint over them)
  function tile(g, cx, cy, pass) {
    if (pass === 0) {
      for (let i = 0; i < 32; i++) g.fillRect(cx - 16 + i, cy + 8 - k(i), 1, 2 * k(i));
      return;
    }
    g.fillStyle = C.floorHi; // top edges: light
    for (let i = 0; i < 32; i++) g.fillRect(cx - 16 + i, cy + 8 - k(i), 1, 1);
    g.fillStyle = C.floorLo; // bottom edges: dark
    for (let i = 0; i < 32; i++) g.fillRect(cx - 16 + i, cy + 7 + k(i), 1, 1);
  }

  // hover outline of the tile whose top vertex is at (cx, cy)
  function outline(g, cx, cy, color) {
    g.fillStyle = color;
    for (let i = 0; i < 32; i++) {
      g.fillRect(cx - 16 + i, cy + 8 - k(i), 1, 1);
      g.fillRect(cx - 16 + i, cy + 7 + k(i), 1, 1);
    }
  }

  function build() {
    const c = G.canvas(W, H), g = c.getContext('2d');
    const ox = OX, oy = OY;

    // inner wall faces
    g.fillStyle = C.wallL; G.slab(g, ox - L, oy + L / 2 - WALL_H, L, WALL_H, -0.5);
    g.fillStyle = C.wallR; G.slab(g, ox, oy - WALL_H, L, WALL_H, 0.5);
    g.fillStyle = 'rgba(0,0,0,.10)'; g.fillRect(ox, oy - WALL_H, 1, WALL_H); // corner seam

    // wall tops (thickness) and the visible wall ends
    g.fillStyle = C.cap;
    G.slab(g, ox - L - WT, oy + L / 2 - WALL_H + WT / 2 - WT, L + WT, WT, -0.5);
    G.slab(g, ox, oy - WALL_H - WT, L + WT, WT, 0.5);
    g.fillStyle = C.capEdge;
    G.slab(g, ox - L, oy + L / 2 - WALL_H - 1, L, 1, -0.5);
    G.slab(g, ox, oy - WALL_H - 1, L, 1, 0.5);
    g.fillStyle = C.end;
    G.slab(g, ox - L - WT, oy + L / 2 - WT / 2 - WALL_H, WT, WALL_H + FT, 0.5);
    G.slab(g, ox + L, oy + L / 2 - WALL_H, WT, WALL_H + FT, -0.5);

    // floor tiles
    g.fillStyle = C.floor;
    for (let pass = 0; pass < 2; pass++) {
      for (let y = 0; y < N; y++) {
        for (let x = 0; x < N; x++) tile(g, ox + (x - y) * HW, oy + (x + y) * HH, pass);
      }
    }

    // floor slab edges
    g.fillStyle = C.edgeL; G.slab(g, ox - L, oy + L / 2, L, FT, 0.5);
    g.fillStyle = C.edgeR; G.slab(g, ox, oy + L, L, FT, -0.5);
    g.fillStyle = C.edgeHi; G.slab(g, ox - L, oy + L / 2, L, 1, 0.5);
    G.slab(g, ox, oy + L, L, 1, -0.5);

    // moody ambient light from the neon city: pink from the left, cyan from the right,
    // a little darker towards the top of the walls
    g.globalCompositeOperation = 'source-atop';
    let gr = g.createLinearGradient(ox - L, 0, ox + L, 0);
    gr.addColorStop(0, 'rgba(255,60,200,0.16)');
    gr.addColorStop(0.5, 'rgba(120,60,255,0.04)');
    gr.addColorStop(1, 'rgba(40,230,255,0.14)');
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
    gr = g.createLinearGradient(0, oy - WALL_H, 0, oy + L);
    gr.addColorStop(0, 'rgba(25,8,55,0.30)');
    gr.addColorStop(0.35, 'rgba(25,8,55,0.05)');
    gr.addColorStop(1, 'rgba(25,8,55,0.22)');
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
    g.globalCompositeOperation = 'source-over';

    // neon strip under the floor
    g.save();
    g.shadowBlur = 8;
    g.shadowColor = '#ff4fd8'; g.fillStyle = '#ff8ae6';
    G.slab(g, ox - L, oy + L / 2 + FT - 1, L, 1, 0.5);
    g.shadowColor = '#3ff5ff'; g.fillStyle = '#9ffaff';
    G.slab(g, ox, oy + L + FT - 1, L, 1, -0.5);
    g.restore();

    return c;
  }

  // Outline of the room as seen on screen (walls + floor), used to clip TV light.
  function hexPath(g, ox, oy) {
    g.beginPath();
    g.moveTo(ox - L, oy + L / 2 - WALL_H);
    g.lineTo(ox, oy - WALL_H);
    g.lineTo(ox + L, oy + L / 2 - WALL_H);
    g.lineTo(ox + L, oy + L / 2);
    g.lineTo(ox, oy + L);
    g.lineTo(ox - L, oy + L / 2);
    g.closePath();
  }

  return { N, HW, HH, WALL_H, FT, WT, L, W, H, OX, OY, build, toScreen, tileAt, outline, hexPath };
})();
