'use strict';
// The backdrop: an old neon Japanese street at night in the rain.
// Static layers (sky, skyline, shops, street) are pre-rendered on resize;
// signs, the train, cars, rain and lightning are animated every frame.
(() => {
  const NEON = [[255, 79, 216], [63, 245, 255], [255, 225, 79], [255, 70, 90], [90, 255, 150], [180, 100, 255], [255, 150, 60]];
  const LIGHTBOX = [[245, 240, 228], [255, 214, 90], [255, 96, 96], [130, 220, 255]];
  const V_WORDS = ['ラーメン', '居酒屋', 'カラオケ', '喫茶', '寿司', '焼鳥', 'ホテル', '麻雀', 'うどん', '占い', '食堂',
    '銭湯', '珈琲', '酒', '薬', '夜', '雨', 'BAR', 'スナック', '中華', '餃子', '質屋', '映画'];
  const H_WORDS = ['ネオン', '純喫茶', '名画座', 'スナック', 'ゲーム', '酒場', '横丁', '夜市', 'レコード'];
  const BODY = ['#2b1f33', '#2a2238', '#33222c', '#241b30', '#2e2630', '#262435', '#31252a'];
  const CARS = ['#2d3a5a', '#5a2d3a', '#d9d4e0', '#1c1c24', '#3f5a4a', '#7a6a50', '#3a3a48', '#8a2333'];
  const FONT = '"DotGothic16", "MS Gothic", "Osaka", monospace';

  const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;
  const pick = (r, arr) => arr[(r() * arr.length) | 0];

  function makeSign(text, col, vertical, lightbox) {
    const chars = [...text];
    const step = 12, pad = 7;
    const bw = vertical ? 15 : chars.length * step + 6;
    const bh = vertical ? chars.length * step + 6 : 16;
    const c = G.canvas(bw + pad * 2, bh + pad * 2), g = c.getContext('2d');
    g.font = `11px ${FONT}`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    const write = () => chars.forEach((ch, i) => {
      if (vertical) g.fillText(ch, pad + bw / 2, pad + 3 + step * i + step / 2 + 1);
      else g.fillText(ch, pad + 3 + step * i + step / 2, pad + bh / 2 + 1);
    });
    if (lightbox) {
      g.shadowColor = rgba(col, 1); g.shadowBlur = 8;
      g.fillStyle = rgba(col, 1); g.fillRect(pad, pad, bw, bh);
      g.shadowBlur = 0;
      g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(pad + 1, pad + 1, bw - 2, 1);
      g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(pad, pad + bh - 1, bw, 1);
      g.fillStyle = col[0] > 240 && col[1] > 230 ? '#a3122d' : '#1a0a14';
      write();
    } else {
      g.fillStyle = '#0d0a14'; g.fillRect(pad, pad, bw, bh);
      g.shadowColor = rgba(col, 1); g.shadowBlur = 6;
      g.strokeStyle = rgba(col, 1); g.lineWidth = 1;
      g.strokeRect(pad + 0.5, pad + 0.5, bw - 1, bh - 1);
      g.fillStyle = rgba(col, 1); write();
      g.shadowBlur = 0; g.globalAlpha = 0.55; g.fillStyle = '#fff'; write();
    }
    return { img: c, pad, w: bw, h: bh };
  }

  class City {
    build(W, H) {
      this.W = W; this.H = H;
      const r = G.rng(20261111);
      this.hor = Math.round(H * 0.55);
      this.street = Math.round(H * 0.8);
      this.road = this.street + 7;
      this.trackY = this.hor - 8;
      this.lanes = [
        { y: this.road + Math.round((H - this.road) * 0.4), dir: -1, next: 0 },
        { y: this.road + Math.round((H - this.road) * 0.82), dir: 1, next: 0 },
      ];
      this.signs = [];
      this.lights = [];
      this.far = this.buildFar(r);
      this.near = this.buildNear(r);

      // animated state
      this.cars = [];
      for (const lane of this.lanes) {
        for (let i = 0; i < 2; i++) this.spawnCar(lane, Math.random() * W);
        lane.next = 1 + Math.random() * 3;
      }
      this.train = { active: false, next: 2.5, x: 0, dir: 1 };
      this.flashT = 99; this.nextBolt = 10 + Math.random() * 15;
      const n = Math.round((W * H) / 1100);
      this.drops = Array.from({ length: n }, () => this.newDrop(true));
      this.splashes = [];
    }

    // ---------------------------------------------------------------- far layer
    buildFar(r) {
      const { W, H, hor, street } = this;
      const c = G.canvas(W, H), g = c.getContext('2d');

      let gr = g.createLinearGradient(0, 0, 0, hor + 40);
      gr.addColorStop(0, '#05030c');
      gr.addColorStop(0.45, '#170a2c');
      gr.addColorStop(0.8, '#3d1146');
      gr.addColorStop(1, '#6a1a52');
      g.fillStyle = gr; g.fillRect(0, 0, W, H);

      // heavy rain clouds, lit pink from below by the city
      for (let b = 0; b < 6; b++) {
        const cy = hor * (0.08 + r() * 0.62), thick = 10 + r() * 34;
        for (let k = 0; k < 70; k++) {
          const lit = r() < 0.25;
          g.fillStyle = lit ? `rgba(255,90,170,${0.04 + r() * 0.05})` : `rgba(${18 + r() * 25 | 0},${8 + r() * 10 | 0},${36 + r() * 30 | 0},${0.12 + r() * 0.14})`;
          g.fillRect((r() * (W + 100) - 50) | 0, (cy + (r() - 0.5) * thick) | 0, (30 + r() * 150) | 0, (2 + r() * 6) | 0);
        }
      }
      gr = g.createLinearGradient(0, hor - 130, 0, hor);
      gr.addColorStop(0, 'rgba(255,60,160,0)');
      gr.addColorStop(1, 'rgba(255,90,170,0.35)');
      g.fillStyle = gr; g.fillRect(0, hor - 130, W, 130);

      // farthest skyline
      this.skyline(g, r, hor, 40, 150, '#241038', 0.05);
      // landmarks
      this.tower(g, Math.round(W * 0.9), hor + 10, Math.min(200, hor * 0.7) | 0);
      this.pagoda(g, Math.round(W * 0.085), hor + 4);
      // nearer skyline
      this.skyline(g, r, hor + 4, 12, 55, '#1a0d2b', 0.12);

      // elevated railway
      g.fillStyle = '#120a1c'; g.fillRect(0, this.trackY, W, 5);
      g.fillStyle = '#3b2a50'; g.fillRect(0, this.trackY, W, 1);
      g.fillStyle = '#0d0716';
      for (let x = 20; x < W; x += 72) g.fillRect(x, this.trackY + 5, 6, street - this.trackY);
      return c;
    }

    skyline(g, r, base, minH, maxH, color, litP) {
      const { W, street } = this;
      let x = -((r() * 10) | 0);
      while (x < W) {
        const w = (12 + r() * 30) | 0, h = (minH + r() * (maxH - minH)) | 0, top = base - h;
        g.fillStyle = color; g.fillRect(x, top, w, street - top);
        if (r() < 0.3) g.fillRect(x + (w >> 1), top - 7, 1, 7);
        for (let yy = top + 3; yy < base - 2; yy += 4) {
          for (let xx = x + 2; xx < x + w - 2; xx += 3) {
            if (r() < litP) {
              g.fillStyle = r() < 0.7 ? 'rgba(255,200,130,.6)' : 'rgba(130,225,255,.55)';
              g.fillRect(xx, yy, 1, 1);
            }
          }
        }
        x += w;
      }
    }

    tower(g, cx, base, h) {
      g.fillStyle = '#3a1532';
      for (let y = 0; y < h; y++) {
        const k = y / h, half = Math.round(2 + 26 * Math.pow(1 - k, 1.8));
        g.fillRect(cx - half, base - y, 2, 1);
        g.fillRect(cx + half - 1, base - y, 2, 1);
        if (y % 7 === 0) g.fillRect(cx - half, base - y, half * 2, 1);
      }
      g.fillStyle = '#4a1a3c';
      g.fillRect(cx - 12, base - Math.round(h * 0.4), 24, 4);
      g.fillRect(cx - 7, base - Math.round(h * 0.68), 14, 3);
      g.fillStyle = 'rgba(255,120,80,.7)';
      for (let x = -10; x <= 10; x += 3) g.fillRect(cx + x, base - Math.round(h * 0.4) + 1, 1, 1);
      g.fillRect(cx, base - h - 10, 1, 10);
      this.towerTop = { x: cx, y: base - h - 11 };
    }

    pagoda(g, cx, base) {
      g.fillStyle = '#1d0f30';
      g.fillRect(cx - 22, base - 6, 44, 6);
      let y = base - 6, w = 38;
      for (let i = 0; i < 5; i++) {
        const bw = Math.round(w * 0.55);
        g.fillStyle = '#1d0f30';
        g.fillRect(cx - (bw >> 1), y - 9, bw, 9);
        y -= 9;
        for (let k = 0; k < 3; k++) g.fillRect(cx - (w >> 1) + k * 2, y - k - 1, w - k * 4, 1);
        g.fillRect(cx - (w >> 1) - 1, y - 2, 1, 1);
        g.fillRect(cx + (w >> 1), y - 2, 1, 1);
        g.fillStyle = 'rgba(255,190,110,.55)';
        g.fillRect(cx - 1, y + 4, 2, 2);
        y -= 4; w -= 5;
      }
      g.fillStyle = '#1d0f30';
      g.fillRect(cx, y - 18, 1, 18);
      for (let k = 0; k < 4; k++) g.fillRect(cx - 1, y - 4 - k * 3, 3, 1);
    }

    // --------------------------------------------------------------- near layer
    buildNear(r) {
      const { W, H, street, road } = this;
      const c = G.canvas(W, H), g = c.getContext('2d');
      const maxH = street - this.trackY + 34;

      let x = -((r() * 20) | 0);
      while (x < W) {
        const w = (40 + r() * 56) | 0;
        const h = (52 + r() * (maxH - 52)) | 0;
        this.building(g, r, x, w, h);
        x += w;
      }

      // utility poles + sagging wires
      const poles = [];
      for (let px = (20 + r() * 40) | 0; px < W + 100; px += (120 + r() * 70) | 0) poles.push(px);
      g.fillStyle = '#0b0711';
      const top = street - 150;
      for (const px of poles) {
        g.fillRect(px, top, 3, 155);
        g.fillRect(px - 9, top + 8, 21, 2);
        g.fillRect(px - 6, top + 20, 15, 2);
        g.fillRect(px + 3, top + 34, 6, 9);
        g.fillStyle = '#3a3346';
        for (const ix of [-8, -3, 6, 10]) g.fillRect(px + ix, top + 7, 1, 1);
        g.fillStyle = '#0b0711';
      }
      const wires = [[top + 9, 9], [top + 9, 12], [top + 21, 10]];
      const ends = [-60, ...poles, W + 60];
      for (let i = 0; i < ends.length - 1; i++) {
        const a = ends[i], b = ends[i + 1];
        for (const [wy, sag] of wires) {
          for (let xx = a; xx <= b; xx++) {
            const u = (xx - a) / (b - a);
            g.fillRect(xx, Math.round(wy + sag * 4 * u * (1 - u)), 1, 1);
          }
        }
      }

      // sidewalk + road
      g.fillStyle = '#1b1624'; g.fillRect(0, street, W, road - street);
      g.fillStyle = '#3b3348'; g.fillRect(0, road - 1, W, 1);
      g.fillStyle = '#100d16'; g.fillRect(0, road, W, H - road);
      for (let i = 0; i < W * (H - road) / 40; i++) {
        g.fillStyle = r() < 0.5 ? 'rgba(255,255,255,.025)' : 'rgba(0,0,0,.25)';
        g.fillRect((r() * W) | 0, (road + r() * (H - road)) | 0, 2, 1);
      }
      const mid = Math.round((this.lanes[0].y + this.lanes[1].y) / 2) - 4;
      g.fillStyle = '#4a4058';
      for (let xx = 4; xx < W; xx += 30) g.fillRect(xx, mid, 13, 1);
      const zx = Math.round(W * 0.06);
      g.fillStyle = '#2c2737';
      for (let yy = road + 3; yy < H - 2; yy += 5) g.fillRect(zx, yy, 34, 2);

      // wet reflections of every light source on the asphalt
      g.globalCompositeOperation = 'lighter';
      for (const l of this.lights) {
        for (let yy = road + 1; yy < H; yy++) {
          if (r() < 0.3) continue;
          const k = (yy - road) / (H - road);
          const a = l.a * (1 - k) * (0.6 + r() * 0.5);
          const ww = Math.max(1, Math.round(l.w * (0.5 + r() * 0.7)));
          g.fillStyle = rgba(l.col, a);
          g.fillRect(Math.round(l.x - ww / 2 + (r() * 4 - 2)), yy, ww, 1);
        }
      }
      g.globalCompositeOperation = 'source-over';
      return c;
    }

    building(g, r, x, w, h) {
      const { street } = this;
      const top = street - h;
      g.fillStyle = pick(r, BODY); g.fillRect(x, top, w, h);
      g.fillStyle = 'rgba(0,0,0,.28)'; g.fillRect(x + w - 2, top, 2, h);
      g.fillStyle = 'rgba(255,255,255,.04)'; g.fillRect(x, top, 1, h);

      // roof
      if (r() < 0.5) {
        g.fillStyle = '#120e18'; g.fillRect(x - 3, top - 4, w + 6, 4);
        g.fillStyle = '#2b2534';
        for (let i = x - 3; i < x + w + 3; i += 3) g.fillRect(i, top - 4, 1, 3);
        g.fillStyle = '#120e18';
        g.fillRect(x - 4, top - 5, 1, 1); g.fillRect(x + w + 3, top - 5, 1, 1);
      } else {
        g.fillStyle = '#18121f'; g.fillRect(x, top - 2, w, 1);
        for (let i = x; i < x + w; i += 5) g.fillRect(i, top - 4, 1, 3);
        if (r() < 0.6) {
          const tx = x + 5 + ((r() * (w - 20)) | 0);
          g.fillRect(tx, top - 12, 11, 8);
          g.fillRect(tx + 1, top - 4, 1, 3); g.fillRect(tx + 9, top - 4, 1, 3);
        }
        if (r() < 0.5) g.fillRect(x + w - 8, top - 16, 1, 14);
        // rooftop billboard
        if (r() < 0.35 && w > 50) {
          const s = makeSign(pick(r, H_WORDS), pick(r, NEON), false, r() < 0.4);
          const sx = x + ((w - s.w) >> 1), sy = top - s.h - 8;
          g.fillStyle = '#0d0912';
          g.fillRect(sx + 3, sy + s.h, 1, 8); g.fillRect(sx + s.w - 4, sy + s.h, 1, 8);
          this.addSign(r, s, sx, sy);
        }
      }

      // windows, every floor
      for (let fy = top + 7; fy < street - 30; fy += 18) {
        for (let wx = x + 5; wx + 9 < x + w - 4; wx += 13) {
          if (r() < 0.55) {
            const col = r() < 0.7 ? [255, 201, 119] : r() < 0.5 ? [159, 231, 255] : [255, 154, 213];
            g.fillStyle = rgba(col, 0.1); g.fillRect(wx - 2, fy - 2, 13, 12);
            g.fillStyle = rgba(col, 0.85); g.fillRect(wx, fy, 9, 8);
            g.fillStyle = 'rgba(70,35,25,.5)';
            g.fillRect(wx + 4, fy, 1, 8); g.fillRect(wx, fy + 4, 9, 1);
            if (r() < 0.15) { g.fillStyle = 'rgba(30,15,25,.75)'; g.fillRect(wx + 1, fy + 3, 3, 5); g.fillRect(wx + 1, fy + 2, 2, 1); }
          } else {
            g.fillStyle = '#120d18'; g.fillRect(wx, fy, 9, 8);
            g.fillStyle = 'rgba(255,255,255,.05)'; g.fillRect(wx, fy, 9, 1);
          }
          if (r() < 0.22) {
            g.fillStyle = '#4a4554'; g.fillRect(wx + 1, fy + 10, 7, 5);
            g.fillStyle = '#2a2632'; g.fillRect(wx + 2, fy + 11, 3, 3);
          }
        }
        if (r() < 0.25) { g.fillStyle = '#17121e'; g.fillRect(x + 2, fy + 9, w - 4, 1); for (let i = x + 2; i < x + w - 2; i += 3) g.fillRect(i, fy + 9, 1, 4); }
      }

      // shopfront
      g.fillStyle = '#0d0a12'; g.fillRect(x - 1, street - 19, w + 2, 2);
      if (r() < 0.62) {
        const warm = r() < 0.75 ? [255, 179, 92] : [180, 230, 255];
        g.fillStyle = rgba(warm, 0.85); g.fillRect(x + 3, street - 17, w - 6, 17);
        g.fillStyle = 'rgba(60,30,30,.35)';
        for (let i = x + 3; i < x + w - 3; i += 8) g.fillRect(i, street - 17, 1, 17);
        if (r() < 0.7) { // noren curtain
          const cloth = r() < 0.5 ? '#2b3a8f' : '#a3202d';
          const n = 3 + ((r() * 3) | 0), sw = Math.floor((w - 10) / n);
          for (let i = 0; i < n; i++) {
            g.fillStyle = cloth; g.fillRect(x + 5 + i * sw, street - 17, sw - 1, 8);
            g.fillStyle = 'rgba(255,255,255,.7)'; if (i === n >> 1) g.fillRect(x + 5 + i * sw + (sw >> 1) - 1, street - 14, 2, 2);
          }
        }
        this.lights.push({ x: x + w / 2, w: w * 0.6, col: warm, a: 0.12 });
      } else {
        g.fillStyle = '#3a3644'; g.fillRect(x + 3, street - 17, w - 6, 17);
        g.fillStyle = '#2b2835';
        for (let yy = street - 16; yy < street; yy += 2) g.fillRect(x + 3, yy, w - 6, 1);
      }

      // red lanterns
      if (r() < 0.5) {
        for (const lx of [x + 3, x + w - 7]) this.lantern(g, lx, street - 27);
      }

      // vending machine on the sidewalk
      if (r() < 0.22) {
        const vx = x + w - 15, vy = street - 18;
        g.globalCompositeOperation = 'lighter';
        const gr = g.createRadialGradient(vx + 5, vy + 8, 1, vx + 5, vy + 8, 22);
        gr.addColorStop(0, 'rgba(170,220,255,.35)'); gr.addColorStop(1, 'rgba(170,220,255,0)');
        g.fillStyle = gr; g.fillRect(vx - 20, vy - 14, 50, 46);
        g.globalCompositeOperation = 'source-over';
        g.fillStyle = '#d8e4f4'; g.fillRect(vx, vy, 11, 18);
        g.fillStyle = '#eef6ff'; g.fillRect(vx + 1, vy + 1, 9, 9);
        const cans = ['#e33', '#39f', '#fc3', '#3c6', '#f6a', '#fff'];
        for (let row = 0; row < 3; row++) for (let i = 0; i < 4; i++) { g.fillStyle = cans[(r() * cans.length) | 0]; g.fillRect(vx + 2 + i * 2, vy + 2 + row * 3, 1, 2); }
        g.fillStyle = '#2a3a52'; g.fillRect(vx + 2, vy + 13, 7, 2);
        this.lights.push({ x: vx + 5, w: 10, col: [170, 220, 255], a: 0.2 });
      }

      // neon signs
      if (r() < 0.8 && h > 70) {
        const s = makeSign(pick(r, V_WORDS), r() < 0.7 ? pick(r, NEON) : pick(r, LIGHTBOX), true, r() < 0.3);
        const room = h - s.h - 34;
        if (room > 8) {
          const sx = r() < 0.5 ? x + w - 8 : x - 6, sy = top + 6 + ((r() * room) | 0);
          g.fillStyle = '#0d0912'; g.fillRect(sx + (sx > x ? -2 : s.w), sy + 4, 2, 1); g.fillRect(sx + (sx > x ? -2 : s.w), sy + s.h - 5, 2, 1);
          this.addSign(r, s, sx, sy);
        }
      }
      if (r() < 0.35 && w > 48) {
        const s = makeSign(pick(r, H_WORDS), pick(r, r() < 0.5 ? NEON : LIGHTBOX), false, r() < 0.5);
        if (s.w < w - 4) this.addSign(r, s, x + ((w - s.w) >> 1), street - 19 - s.h - 2);
      }
    }

    lantern(g, x, y) {
      g.globalCompositeOperation = 'lighter';
      const gr = g.createRadialGradient(x + 2, y + 3, 1, x + 2, y + 3, 12);
      gr.addColorStop(0, 'rgba(255,70,50,.45)'); gr.addColorStop(1, 'rgba(255,70,50,0)');
      g.fillStyle = gr; g.fillRect(x - 10, y - 9, 25, 25);
      g.globalCompositeOperation = 'source-over';
      g.fillStyle = '#1a0a0a'; g.fillRect(x + 1, y - 2, 2, 2);
      g.fillStyle = '#ff3b3b'; g.fillRect(x, y, 4, 6);
      g.fillStyle = '#ff8a6a'; g.fillRect(x + 1, y + 1, 1, 4);
      g.fillStyle = '#a3141c'; g.fillRect(x, y + 2, 4, 1);
      g.fillStyle = '#1a0a0a'; g.fillRect(x, y, 4, 1); g.fillRect(x, y + 5, 4, 1);
      this.lights.push({ x: x + 2, w: 4, col: [255, 70, 50], a: 0.25 });
    }

    addSign(r, s, x, y) {
      this.signs.push({
        ...s, x, y,
        flicky: r() < 0.25,
        next: 1 + r() * 6, until: 0, on: true,
      });
      const col = s.img.getContext('2d').getImageData(s.pad + (s.w >> 1), s.pad + 1, 1, 1).data;
      this.lights.push({ x: x + s.w / 2, w: s.w, col: [col[0], col[1], col[2]], a: 0.28 });
    }

    // ------------------------------------------------------------------ actors
    spawnCar(lane, x) {
      const r = Math.random();
      const type = r < 0.45 ? 'sedan' : r < 0.65 ? 'taxi' : r < 0.85 ? 'van' : 'truck';
      const len = { sedan: 40, taxi: 40, van: 30, truck: 54 }[type];
      const body = type === 'taxi' ? (Math.random() < 0.6 ? '#d9a72b' : '#2f6b4f') : CARS[(Math.random() * CARS.length) | 0];
      this.cars.push({
        lane, type, len, body,
        dir: lane.dir, y: lane.y,
        x: x !== undefined ? x : lane.dir > 0 ? -len - 80 : this.W + 80,
        spd: 30 + Math.random() * 45,
      });
    }

    newDrop(anywhere) {
      const { W, H } = this;
      const near = Math.random() < 0.4;
      return {
        x: Math.random() * (W + 80),
        y: anywhere ? Math.random() * H : -20 - Math.random() * 60,
        len: near ? 9 + Math.random() * 6 : 4 + Math.random() * 4,
        spd: near ? 420 + Math.random() * 160 : 260 + Math.random() * 100,
        near,
        ground: near ? this.road + Math.random() * (H - this.road) : this.hor + Math.random() * (this.street - this.hor),
      };
    }

    update(dt, t) {
      const { W } = this;
      // cars
      for (const lane of this.lanes) {
        lane.next -= dt;
        if (lane.next <= 0) { this.spawnCar(lane); lane.next = 2 + Math.random() * 5; }
      }
      for (const c of this.cars) {
        // keep a polite distance from the car ahead
        let spd = c.spd;
        for (const o of this.cars) {
          if (o === c || o.lane !== c.lane) continue;
          const gap = c.dir > 0 ? o.x - (c.x + c.len) : c.x - (o.x + o.len);
          if (gap > 0 && gap < 22) spd = Math.min(spd, o.spd);
        }
        c.spd = spd;
        c.x += c.dir * spd * dt;
      }
      this.cars = this.cars.filter((c) => c.x > -c.len - 120 && c.x < W + 120);

      // train
      const tr = this.train;
      if (!tr.active && t > tr.next) {
        tr.active = true; tr.dir = Math.random() < 0.5 ? 1 : -1;
        tr.x = tr.dir > 0 ? -330 : W + 10;
      }
      if (tr.active) {
        tr.x += tr.dir * 120 * dt;
        if ((tr.dir > 0 && tr.x > W + 20) || (tr.dir < 0 && tr.x < -340)) { tr.active = false; tr.next = t + 14 + Math.random() * 18; }
      }

      // signs flicker
      for (const s of this.signs) {
        if (!s.flicky) continue;
        if (t > s.next) { s.until = t + 0.15 + Math.random() * 0.5; s.next = t + 2 + Math.random() * 8; }
        s.on = t < s.until ? Math.random() < 0.45 : true;
      }

      // lightning
      this.flashT += dt;
      if (t > this.nextBolt) { this.flashT = 0; this.nextBolt = t + 14 + Math.random() * 26; }

      // rain
      for (let i = 0; i < this.drops.length; i++) {
        const d = this.drops[i];
        d.y += d.spd * dt;
        d.x -= d.spd * 0.18 * dt;
        if (d.y > d.ground) {
          if (d.near && this.splashes.length < 160) this.splashes.push({ x: Math.round(d.x - d.len * 0.18), y: Math.round(d.ground), age: 0 });
          this.drops[i] = this.newDrop(false);
        } else if (d.x < -20) d.x += W + 60;
      }
      for (const s of this.splashes) s.age += dt;
      this.splashes = this.splashes.filter((s) => s.age < 0.2);
    }

    flash() {
      const f = this.flashT;
      if (f < 0.06) return 0.45;
      if (f < 0.12) return 0.08;
      if (f < 0.2) return 0.35;
      return Math.max(0, 0.35 * (1 - (f - 0.2) / 0.7));
    }

    draw(g, t) {
      const { W, H } = this;
      g.drawImage(this.far, 0, 0);

      const fl = this.flash();
      if (fl > 0) { g.fillStyle = `rgba(200,190,255,${fl})`; g.fillRect(0, 0, W, this.street); }

      if (this.towerTop && t % 1.6 < 0.8) {
        g.fillStyle = 'rgba(255,60,60,.35)'; g.fillRect(this.towerTop.x - 1, this.towerTop.y - 1, 3, 3);
        g.fillStyle = '#ff4040'; g.fillRect(this.towerTop.x, this.towerTop.y, 1, 1);
      }

      if (this.train.active) this.drawTrain(g);

      g.drawImage(this.near, 0, 0);

      for (const s of this.signs) {
        g.globalAlpha = s.on ? 1 : 0.18;
        g.drawImage(s.img, s.x - s.pad, s.y - s.pad);
      }
      g.globalAlpha = 1;

      for (const c of this.cars) this.drawCar(g, c);

      // rain
      g.lineWidth = 1;
      for (const near of [false, true]) {
        g.strokeStyle = near ? 'rgba(185,205,255,.42)' : 'rgba(160,170,230,.22)';
        g.beginPath();
        for (const d of this.drops) {
          if (d.near !== near) continue;
          const x = Math.round(d.x) + 0.5, y = Math.round(d.y);
          g.moveTo(x, y);
          g.lineTo(x - d.len * 0.18, y + d.len);
        }
        g.stroke();
      }
      g.fillStyle = 'rgba(190,215,255,.55)';
      for (const s of this.splashes) {
        if (s.age < 0.08) g.fillRect(s.x, s.y - 2, 1, 1);
        g.fillRect(s.x - 1 - (s.age > 0.1 ? 1 : 0), s.y - 1, 1, 1);
        g.fillRect(s.x + 1 + (s.age > 0.1 ? 1 : 0), s.y - 1, 1, 1);
      }

      if (fl > 0.2) { g.fillStyle = `rgba(200,190,255,${fl * 0.25})`; g.fillRect(0, 0, W, H); }
    }

    drawTrain(g) {
      const tr = this.train, y = this.trackY - 12;
      for (let i = 0; i < 5; i++) {
        const x = Math.round(tr.x + i * 64);
        g.fillStyle = '#b9b7c6'; g.fillRect(x, y, 62, 11);
        g.fillStyle = '#d8d6e2'; g.fillRect(x, y, 62, 1);
        g.fillStyle = '#3fae5a'; g.fillRect(x, y + 8, 62, 2);
        g.fillStyle = '#ffe9b0';
        for (let wx = 4; wx < 58; wx += 7) g.fillRect(x + wx, y + 2, 4, 4);
        g.fillStyle = '#5c5a6a';
        g.fillRect(x + 20, y + 2, 2, 8); g.fillRect(x + 42, y + 2, 2, 8);
        if (i % 2 === 0) { g.fillStyle = '#1a1422'; g.fillRect(x + 28, y - 3, 1, 3); g.fillRect(x + 26, y - 4, 5, 1); }
      }
    }

    drawCar(g, c) {
      const x = Math.round(c.x), y = c.y, L = c.len, d = c.dir;
      const front = d > 0 ? x + L : x, rear = d > 0 ? x : x + L;
      const R = (rx, ry, w, h, col) => {
        g.fillStyle = col;
        g.fillRect(d > 0 ? x + rx : x + L - rx - w, y - ry - h, w, h);
      };

      // light beams and their reflections on the wet road
      g.globalCompositeOperation = 'lighter';
      let gr = g.createLinearGradient(front, 0, front + d * 75, 0);
      gr.addColorStop(0, 'rgba(255,240,200,.30)'); gr.addColorStop(1, 'rgba(255,240,200,0)');
      g.fillStyle = gr;
      g.beginPath();
      g.moveTo(front, y - 7); g.lineTo(front + d * 75, y - 13); g.lineTo(front + d * 75, y + 4); g.lineTo(front, y - 3);
      g.fill();
      gr = g.createLinearGradient(0, y, 0, y + 18);
      gr.addColorStop(0, 'rgba(255,240,200,.35)'); gr.addColorStop(1, 'rgba(255,240,200,0)');
      g.fillStyle = gr; g.fillRect(front - (d > 0 ? 3 : 0), y, 3, 18);
      gr = g.createLinearGradient(0, y, 0, y + 14);
      gr.addColorStop(0, 'rgba(255,40,60,.35)'); gr.addColorStop(1, 'rgba(255,40,60,0)');
      g.fillStyle = gr; g.fillRect(rear - (d > 0 ? 0 : 2), y, 2, 14);
      g.fillStyle = 'rgba(255,40,60,.25)'; g.fillRect(rear - (d > 0 ? 3 : 1), y - 8, 4, 4);
      g.globalCompositeOperation = 'source-over';

      const glass = '#26304a', glassHi = '#5a6a8a';
      if (c.type === 'van') {
        R(0, 2, L, 12, c.body);
        R(L - 9, 7, 7, 5, glass); R(L - 8, 11, 3, 1, glassHi);
        R(3, 7, 9, 4, glass); R(14, 7, 8, 4, glass);
        R(0, 13, L, 1, 'rgba(255,255,255,.18)');
      } else if (c.type === 'truck') {
        R(0, 4, L - 13, 15, '#bdb8c8');
        R(2, 10, L - 17, 2, '#c43a5a');
        R(L - 12, 2, 12, 12, c.body);
        R(L - 8, 8, 6, 5, glass);
        R(0, 2, L, 2, '#2a2632');
      } else {
        R(0, 2, L, 6, c.body);
        R(9, 8, 20, 5, c.body);
        R(11, 8, 8, 4, glass); R(20, 8, 7, 4, glass);
        R(12, 11, 3, 1, glassHi);
        R(29, 8, 3, 1, c.body);
        R(0, 7, L, 1, 'rgba(255,255,255,.18)');
        R(9, 12, 20, 1, 'rgba(255,130,220,.45)'); // neon on the roof
        if (c.type === 'taxi') { R(16, 13, 6, 2, '#ffe14f'); R(18, 13, 2, 1, '#ff3b3b'); }
      }
      R(5, 0, 6, 3, '#050308'); R(L - 11, 0, 6, 3, '#050308');
      R(7, 1, 2, 1, '#5a5566'); R(L - 9, 1, 2, 1, '#5a5566');
      R(L - 2, 4, 2, 2, '#fff6d0');
      R(0, 4, 2, 2, '#ff2a3a');
    }
  }

  G.City = City;
})();
