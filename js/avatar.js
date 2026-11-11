'use strict';
// The player: a tiny pixel person in a hoodie and headphones.
// Drawn procedurally with fillRect so it stays pixel-perfect; mirrored for left-facing.
G.Avatar = class Avatar {
  constructor(tx, ty) {
    this.tx = tx; this.ty = ty;           // current tile
    this.wx = tx + 0.5; this.wy = ty + 0.5; // continuous position (tile centre)
    this.path = [];
    this.front = true;  // facing the camera?
    this.flip = false;  // facing screen-left?
    this.dist = 0;      // distance walked (drives the walk cycle)
    this.speed = 3.4;   // tiles per second
    this.onArrive = null;
  }

  get walking() { return this.path.length > 0; }

  // Habbo-style path: diagonal steps first, then straight. The room is empty,
  // so no obstacles to route around.
  walkTo(gx, gy) {
    const start = this.path.length ? this.path[0] : { x: this.tx, y: this.ty };
    const steps = [];
    let x = start.x, y = start.y;
    while (x !== gx || y !== gy) {
      x += Math.sign(gx - x);
      y += Math.sign(gy - y);
      steps.push({ x, y });
    }
    this.path = this.path.length ? [this.path[0], ...steps] : steps;
  }

  face(dx, dy) {
    if (!dx && !dy) return;
    const sx = dx - dy, sy = dx + dy;
    this.front = sy >= 0;
    if (sx !== 0) this.flip = sx < 0;
  }

  update(dt) {
    if (!this.path.length) { this.dist = 0; return; }
    const n = this.path[0];
    this.face(Math.sign(n.x - this.tx), Math.sign(n.y - this.ty));
    const dx = n.x + 0.5 - this.wx, dy = n.y + 0.5 - this.wy;
    const d = Math.hypot(dx, dy), step = this.speed * dt;
    if (d <= step) {
      this.wx = n.x + 0.5; this.wy = n.y + 0.5;
      this.tx = n.x; this.ty = n.y;
      this.path.shift();
      if (!this.path.length && this.onArrive) { const f = this.onArrive; this.onArrive = null; f(); }
    } else {
      this.wx += (dx / d) * step;
      this.wy += (dy / d) * step;
    }
    this.dist += step;
  }

  draw(g, fx, fy, t, music) {
    fx = Math.round(fx); fy = Math.round(fy);
    const C = Avatar.C, flip = this.flip, front = this.front;
    const P = (rx, ry, w, h, c) => {
      g.fillStyle = c;
      g.fillRect(flip ? fx - rx - w + 1 : fx + rx, fy + ry, w, h);
    };

    // shadow
    g.fillStyle = 'rgba(20,0,30,.35)';
    g.fillRect(fx - 5, fy - 2, 11, 1);
    g.fillRect(fx - 7, fy - 1, 15, 2);
    g.fillRect(fx - 5, fy + 1, 11, 1);

    const f = this.walking ? Math.floor(this.dist * 6) % 4 : -1;
    const bob = f === 1 || f === 3 ? -1 : 0;
    const sw = f === 0 ? 1 : f === 2 ? -1 : 0;                       // leg / arm swing
    const nod = !this.walking && music && (t * 1.5) % 1 < 0.45 ? 1 : 0; // vibing to the beat
    const hy = bob + nod;

    // back leg + shoe
    P(-3 - sw, -12, 3, 10, C.pantsS);
    P(-3 - sw, -2, 4, 1, C.shoeS); P(-3 - sw, -1, 4, 1, C.sole);
    // back arm
    P(-6, -23 + bob, 3, 5, C.hoodD);
    P(-6 + sw, -18 + bob, 3, 4, C.hoodD);
    P(-6 + sw, -14 + bob, 3, 2, C.skinS);
    // front leg + shoe
    P(sw, -12, 3, 10, C.pants);
    P(sw, -2, 4, 1, C.shoe); P(sw, -1, 4, 1, C.shoeS);

    // torso (hoodie)
    P(-5, -24 + bob, 10, 12, C.hood);
    P(-5, -24 + bob, 2, 12, C.hoodS);
    P(-5, -13 + bob, 10, 1, C.hoodD);
    if (front) {
      P(0, -23 + bob, 1, 3, C.string); P(2, -23 + bob, 1, 3, C.string);
      P(-1, -17 + bob, 5, 1, C.hoodS);
    } else {
      P(-4, -25 + bob, 8, 3, C.hoodS); // hood lying on the back
    }

    // front arm
    P(3, -23 + bob, 3, 5, C.hood);
    P(3 - sw, -18 + bob, 3, 4, C.hood);
    P(5 - sw, -18 + bob, 1, 4, C.hoodS);
    P(3 - sw, -14 + bob, 3, 2, C.skin);

    // neck + head
    P(-1, -25 + bob, 3, 1, C.skinS);
    if (front) {
      P(-5, -36 + hy, 11, 11, C.skin);
      P(-5, -26 + hy, 11, 1, C.skinS);
      P(-5, -38 + hy, 11, 4, C.hair);
      P(-6, -37 + hy, 1, 9, C.hair);
      P(-5, -34 + hy, 4, 6, C.hair);
      P(-1, -34 + hy, 3, 1, C.hair);
      P(3, -34 + hy, 2, 1, C.hair);
      P(-3, -38 + hy, 4, 1, C.hairH);
      const blink = t % 4.3 < 0.12;
      P(0, (blink ? -30 : -31) + hy, 1, blink ? 1 : 2, C.eye);
      P(3, (blink ? -30 : -31) + hy, 1, blink ? 1 : 2, C.eye);
      P(4, -28 + hy, 1, 1, C.blush);
      P(2, -27 + hy, 1, 1, C.mouth);
      // headphones (far-side cup)
      P(-5, -39 + hy, 9, 1, C.ph);
      P(-6, -38 + hy, 1, 6, C.ph);
      P(-6, -32 + hy, 3, 5, C.ph);
      P(-6, -32 + hy, 1, 5, C.phD);
    } else {
      P(-5, -38 + hy, 11, 13, C.hair);
      P(-6, -37 + hy, 1, 8, C.hair);
      P(4, -31 + hy, 2, 5, C.skin);
      P(-2, -26 + hy, 5, 1, C.skinS);
      P(-2, -37 + hy, 4, 1, C.hairH);
      // headphones (near-side cup)
      P(-3, -39 + hy, 9, 1, C.ph);
      P(6, -38 + hy, 1, 6, C.ph);
      P(4, -32 + hy, 3, 5, C.ph);
      P(6, -32 + hy, 1, 5, C.phD);
    }
  }
};

G.Avatar.C = {
  skin: '#f2c79b', skinS: '#d79f78', blush: '#f0988f', mouth: '#a8564e',
  hair: '#24171f', hairH: '#4a3245', eye: '#1a1020',
  hood: '#ecb33c', hoodS: '#c88a22', hoodD: '#9a6616', string: '#fff7e6',
  pants: '#2c3150', pantsS: '#1f2339',
  shoe: '#f6f2ec', shoeS: '#bdb5c9', sole: '#8d859a',
  ph: '#ff4f7b', phD: '#b52f58',
};
