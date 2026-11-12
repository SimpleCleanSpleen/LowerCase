/**
 * Tiny dependency-free raster toolkit for generating pixel art in Node.
 *  - RoleCanvas: pixels hold palette ROLE names (fighters; palette-swappable)
 *  - RgbCanvas:  pixels hold RGBA (backgrounds, effects, fonts)
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { deflateSync } from 'node:zlib';

// ------------------------------------------------------------------- PNG --

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
export function encodePng(w, h, rgba) {
  const stride = w * 4 + 1;
  const raw = Buffer.alloc(stride * h);
  for (let y = 0; y < h; y++) {
    raw[y * stride] = 0;
    Buffer.from(rgba.buffer, rgba.byteOffset + y * w * 4, w * 4).copy(raw, y * stride + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr.set([8, 6, 0, 0, 0], 8);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}
export function writeFile(path, data) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, data);
}

export const hex = (h) => {
  const n = parseInt(h.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

// ------------------------------------------------------------ RoleCanvas --

export class RoleCanvas {
  constructor(w, h) {
    this.w = w;
    this.h = h;
    this.px = new Array(w * h).fill(null);
  }
  in(x, y) {
    return x >= 0 && y >= 0 && x < this.w && y < this.h;
  }
  set(x, y, role) {
    if (this.in(x, y)) this.px[y * this.w + x] = role;
  }
  get(x, y) {
    return this.in(x, y) ? this.px[y * this.w + x] : null;
  }
}

/**
 * Rasterize a shape (inside(x,y) test on pixel centers) within a bbox and
 * paint it: first a 1px outline ring OUTSIDE the shape (so each part gets a
 * crisp line where it overlaps parts behind it), then the fill.
 * shade(x, y) returns the role for each interior pixel.
 */
export function paint(cv, bbox, inside, shade, { outline = 'outline' } = {}) {
  const x0 = Math.max(0, Math.floor(bbox[0]) - 2);
  const y0 = Math.max(0, Math.floor(bbox[1]) - 2);
  const x1 = Math.min(cv.w - 1, Math.ceil(bbox[2]) + 2);
  const y1 = Math.min(cv.h - 1, Math.ceil(bbox[3]) + 2);
  if (x1 < x0 || y1 < y0 || !Number.isFinite(x0 + y0 + x1 + y1)) return;
  const W = x1 - x0 + 1;
  const mask = new Uint8Array(W * (y1 - y0 + 1));
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) if (inside(x + 0.5, y + 0.5)) mask[(y - y0) * W + x - x0] = 1;
  const m = (x, y) => x >= x0 && x <= x1 && y >= y0 && y <= y1 && mask[(y - y0) * W + x - x0];
  if (outline) {
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++)
        if (!m(x, y) && (m(x + 1, y) || m(x - 1, y) || m(x, y + 1) || m(x, y - 1))) cv.set(x, y, outline);
  }
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (m(x, y)) cv.set(x, y, shade(x + 0.5, y + 0.5));
}

// Light comes from the upper front (sprites face right; flipped at runtime).
const LIGHT = (() => {
  const l = Math.hypot(0.6, -0.8);
  return [0.6 / l, -0.8 / l];
})();

/** Role triple picker based on a surface normal. */
export function lit(nx, ny, roles, hi = 0.5, lo = -0.2) {
  const d = nx * LIGHT[0] + ny * LIGHT[1];
  if (d > hi && roles[2]) return roles[2];
  if (d > lo) return roles[0];
  return roles[1];
}

/** Tapered capsule from A (radius ra) to B (radius rb), lit as a cylinder. */
export function capsule(cv, A, B, ra, rb, roles, opts) {
  const [ax, ay] = A;
  const [bx, by] = B;
  const dx = bx - ax;
  const dy = by - ay;
  const L2 = dx * dx + dy * dy || 1e-6;
  const closest = (x, y) => {
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / L2));
    return [ax + dx * t, ay + dy * t, ra + (rb - ra) * t];
  };
  const r = Math.max(ra, rb);
  paint(
    cv,
    [Math.min(ax, bx) - r, Math.min(ay, by) - r, Math.max(ax, bx) + r, Math.max(ay, by) + r],
    (x, y) => {
      const [cx, cy, rr] = closest(x, y);
      return (x - cx) ** 2 + (y - cy) ** 2 <= rr * rr;
    },
    (x, y) => {
      const [cx, cy, rr] = closest(x, y);
      return lit((x - cx) / rr, (y - cy) / rr, roles, opts?.hi, opts?.lo);
    },
    opts,
  );
}

export function circle(cv, [cx, cy], r, roles, opts) {
  capsule(cv, [cx, cy], [cx, cy], r, r, roles, opts);
}

export function pointInPoly(x, y, pts) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i];
    const [xj, yj] = pts[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export function polygon(cv, pts, shade, opts) {
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const fn = typeof shade === 'function' ? shade : () => shade;
  paint(cv, [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)], (x, y) => pointInPoly(x, y, pts), fn, opts);
}

/**
 * Blit an ASCII stamp. `legend` maps chars to roles ('.' = transparent).
 * (ax, ay) = stamp pixel that lands on (x, y). Optional rotation (degrees,
 * nearest-neighbor) and horizontal mirror.
 */
export function stamp(cv, rows, legend, x, y, ax, ay, angle = 0) {
  const h = rows.length;
  const w = Math.max(...rows.map((r) => r.length));
  const at = (sx, sy) => {
    if (sy < 0 || sy >= h || sx < 0 || sx >= w) return null;
    const ch = rows[sy][sx] ?? '.';
    return ch === '.' ? null : legend[ch];
  };
  if (!angle) {
    for (let sy = 0; sy < h; sy++)
      for (let sx = 0; sx < w; sx++) {
        const r = at(sx, sy);
        if (r) cv.set(Math.round(x) + sx - ax, Math.round(y) + sy - ay, r);
      }
    return;
  }
  const a = (angle * Math.PI) / 180;
  const c = Math.cos(a);
  const s = Math.sin(a);
  const R = Math.ceil(Math.hypot(w, h));
  for (let dy = -R; dy <= R; dy++)
    for (let dx = -R; dx <= R; dx++) {
      // inverse-rotate destination offset into stamp space
      const sx = Math.round(ax + dx * c + dy * s);
      const sy = Math.round(ay - dx * s + dy * c);
      const r = at(sx, sy);
      if (r) cv.set(Math.round(x) + dx, Math.round(y) + dy, r);
    }
}

// ------------------------------------------------------------- RgbCanvas --

export class RgbCanvas {
  constructor(w, h) {
    this.w = w;
    this.h = h;
    this.data = new Uint8Array(w * h * 4);
  }
  set(x, y, [r, g, b], a = 255) {
    x |= 0;
    y |= 0;
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = (y * this.w + x) * 4;
    if (a >= 255) {
      this.data[i] = r;
      this.data[i + 1] = g;
      this.data[i + 2] = b;
      this.data[i + 3] = 255;
    } else {
      const k = a / 255;
      const da = this.data[i + 3] / 255;
      const oa = k + da * (1 - k);
      for (let j = 0; j < 3; j++) {
        this.data[i + j] = Math.round(([r, g, b][j] * k + this.data[i + j] * da * (1 - k)) / (oa || 1));
      }
      this.data[i + 3] = Math.round(oa * 255);
    }
  }
  get(x, y) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return null;
    const i = (y * this.w + x) * 4;
    return this.data[i + 3] ? [this.data[i], this.data[i + 1], this.data[i + 2]] : null;
  }
  rect(x, y, w, h, c, a) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, c, a);
  }
  poly(pts, c, a) {
    const ys = pts.map((p) => p[1]);
    const xs = pts.map((p) => p[0]);
    for (let y = Math.floor(Math.min(...ys)); y <= Math.ceil(Math.max(...ys)); y++)
      for (let x = Math.floor(Math.min(...xs)); x <= Math.ceil(Math.max(...xs)); x++)
        if (pointInPoly(x + 0.5, y + 0.5, pts)) this.set(x, y, typeof c === 'function' ? c(x, y) : c, a);
  }
  disc(cx, cy, r, c, a) {
    for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++)
      for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++)
        if ((x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 <= r * r) this.set(x, y, typeof c === 'function' ? c(x, y) : c, a);
  }
  png() {
    return encodePng(this.w, this.h, this.data);
  }
}

// 4x4 Bayer matrix for ordered dithering between two colors.
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);
export const dither = (x, y, t) => t > BAYER[(y & 3) * 4 + (x & 3)];

/** Deterministic PRNG so regenerated art is identical. */
export function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** RoleCanvas -> RGBA using a role->hex map. */
export function rolesToRgba(cv, palette, out, ox, oy, outW) {
  for (let y = 0; y < cv.h; y++)
    for (let x = 0; x < cv.w; x++) {
      const r = cv.px[y * cv.w + x];
      if (!r) continue;
      const c = palette[r];
      if (!c) throw new Error(`no key color for role "${r}"`);
      const i = ((oy + y) * outW + ox + x) * 4;
      out[i] = c[0];
      out[i + 1] = c[1];
      out[i + 2] = c[2];
      out[i + 3] = 255;
    }
}
