/**
 * Stage background generator: parallax layers as PNGs + stage.json.
 * A layer with scroll factor f must be VIEW_W + (STAGE_W - VIEW_W) * f wide.
 */
import { join } from 'node:path';
import { RgbCanvas, dither, hex, rng, writeFile } from './lib.mjs';

export const VIEW_W = 480;
export const VIEW_H = 270;
export const STAGE_W = 768;
export const FLOOR_Y = 236;

const layerW = (f) => Math.ceil(VIEW_W + (STAGE_W - VIEW_W) * f);
const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));

/** Multi-stop ramp quantized into bands with ordered dithering between them. */
function ramp(stops, steps) {
  const out = [];
  for (let i = 0; i < steps; i++) {
    const t = i / (steps - 1);
    let k = 0;
    while (k < stops.length - 2 && t > stops[k + 1][0]) k++;
    const [t0, c0] = stops[k];
    const [t1, c1] = stops[k + 1];
    out.push(mix(hex(c0), hex(c1), Math.min(1, Math.max(0, (t - t0) / (t1 - t0)))));
  }
  return out;
}
const pick = (pal, x, y, t) => {
  const f = Math.min(0.9999, Math.max(0, t)) * (pal.length - 1);
  const i = Math.floor(f);
  return pal[Math.min(pal.length - 1, dither(x, y, f - i) ? i + 1 : i)];
};

function stones(cv, x0, y0, w, h, { base, dark, light, rowH = 10, brick = 22, seed = 1, mortar = true }) {
  const r = rng(seed);
  for (let y = y0, row = 0; y < y0 + h; y += rowH, row++) {
    const off = row % 2 ? brick / 2 : 0;
    for (let x = x0 - off; x < x0 + w; x += brick) {
      const shade = r();
      const c = shade < 0.2 ? mix(base, dark, 0.4) : shade > 0.85 ? mix(base, light, 0.35) : base;
      for (let j = 0; j < rowH; j++)
        for (let i = 0; i < brick; i++) {
          const px = Math.round(x + i);
          const py = y + j;
          if (px < x0 || px >= x0 + w || py >= y0 + h) continue;
          let col = c;
          if (mortar && (j === rowH - 1 || i === brick - 1)) col = dark;
          else if (j === 0 || i === 0) col = mix(c, light, 0.5);
          else if (r() < 0.05) col = mix(c, dark, 0.3);
          cv.set(px, py, col);
        }
    }
  }
}

function sigil(cv, cx, cy, s, cField, cTrim) {
  // shield with upward chevron, scale s
  const P = (x, y) => [cx + x * s, cy + y * s];
  cv.poly([P(-6, -7), P(6, -7), P(6, 1), P(0, 8), P(-6, 1)], cTrim);
  cv.poly([P(-5, -6), P(5, -6), P(5, 0.5), P(0, 6.8), P(-5, 0.5)], cField);
  cv.poly([P(0, -4), P(4, 0.5), P(4, 3), P(0, -1.5), P(-4, 3), P(-4, 0.5)], cTrim);
}

function banner(cv, x, y, w, h, cloth, clothShade, trim, sigilField) {
  cv.rect(x - 2, y - 2, w + 4, 2, hex('#2a1c14'));
  cv.poly([[x, y], [x + w, y], [x + w, y + h], [x + w / 2, y + h - w * 0.4], [x, y + h]], (px) => (px > x + w * 0.65 ? clothShade : cloth));
  cv.rect(x, y + 2, w, 1, trim);
  cv.rect(x, y + h - w * 0.4 - 6, w, 1, trim);
  sigil(cv, x + w / 2, y + h * 0.38, w / 16, sigilField, trim);
}

// ======================================================= Stage 1: keep ==

function keepStage() {
  const layers = [];
  const R = rng(7);

  // sky -----------------------------------------------------------------
  const sky = new RgbCanvas(VIEW_W, VIEW_H);
  const skyPal = ramp([[0, '#120e2e'], [0.35, '#3a1f56'], [0.62, '#8a3a64'], [0.82, '#e0705a'], [1, '#ffb070']], 10);
  for (let y = 0; y < VIEW_H; y++) for (let x = 0; x < VIEW_W; x++) sky.set(x, y, pick(skyPal, x, y, y / 205));
  for (let i = 0; i < 60; i++) {
    const x = (R() * VIEW_W) | 0;
    const y = (R() * 70) | 0;
    sky.set(x, y, hex(R() < 0.3 ? '#ffffff' : '#a090c8'));
  }
  const sun = [VIEW_W * 0.74, 128];
  for (const [r, c] of [[34, '#f08a5a'], [28, '#ffb070'], [22, '#ffd08a'], [17, '#fff0c0']]) sky.disc(sun[0], sun[1], r, hex(c), r > 30 ? 120 : 255);
  layers.push({ file: 'sky.png', scroll: 0, canvas: sky });

  // clouds --------------------------------------------------------------
  const cw = layerW(0.06);
  const clouds = new RgbCanvas(cw, VIEW_H);
  for (let i = 0; i < 9; i++) {
    const cx = R() * cw;
    const cy = 40 + R() * 90;
    const n = 4 + ((R() * 4) | 0);
    for (let k = 0; k < n; k++) {
      const x = cx + (k - n / 2) * 11 + R() * 6;
      const r = 6 + R() * 7;
      clouds.disc(x, cy, r, (px, py) => (py > cy + r * 0.25 ? hex('#d8707a') : hex('#6a3a68')));
    }
    clouds.rect(Math.round(cx - n * 7), Math.round(cy + 3), Math.round(n * 14), 4, hex('#d8707a'));
  }
  layers.push({ file: 'clouds.png', scroll: 0.06, canvas: clouds });

  // mountains -----------------------------------------------------------
  const mw = layerW(0.15);
  const mts = new RgbCanvas(mw, VIEW_H);
  for (let x = 0; x < mw; x++) {
    const far = 150 + 22 * Math.sin(x * 0.012) + 10 * Math.sin(x * 0.041 + 1) + 4 * Math.sin(x * 0.13);
    const near = 182 + 14 * Math.sin(x * 0.018 + 2) + 7 * Math.sin(x * 0.07) + 3 * Math.sin(x * 0.21);
    for (let y = Math.floor(far); y < VIEW_H; y++) mts.set(x, y, y < far + 2 ? hex('#7a4a78') : hex('#4a2e5e'));
    for (let y = Math.floor(near); y < VIEW_H; y++) mts.set(x, y, y < near + 2 ? hex('#5a3a66') : hex('#33224a'));
  }
  layers.push({ file: 'mountains.png', scroll: 0.15, canvas: mts });

  // castle --------------------------------------------------------------
  const kw = layerW(0.35);
  const castle = new RgbCanvas(kw, VIEW_H);
  const st = { base: hex('#43365e'), dark: hex('#2c2240'), light: hex('#6a5a88') };
  const tower = (x, top, w, roofH) => {
    stones(castle, x, top, w, 236 - top, { ...st, rowH: 7, brick: 12, seed: x });
    for (let i = 0; i < w; i += 6) castle.rect(x + i, top - 4, 4, 4, st.base);
    castle.poly([[x - 3, top - 4], [x + w + 3, top - 4], [x + w / 2, top - 4 - roofH]], (px) => (px > x + w / 2 ? hex('#3a1f3e') : hex('#5a2e4e')));
    castle.rect(x + w / 2, top - 4 - roofH - 10, 1, 10, hex('#2a1c14'));
    castle.poly([[x + w / 2 + 1, top - roofH - 14], [x + w / 2 + 12, top - roofH - 11], [x + w / 2 + 1, top - roofH - 8]], hex('#c8283c'));
    for (let wy = top + 14; wy < 200; wy += 26) {
      castle.rect(x + w / 2 - 2, wy, 4, 7, hex('#ffc860'));
      castle.rect(x + w / 2 - 2, wy, 4, 2, hex('#ffe8a0'));
    }
  };
  const cx = kw / 2;
  stones(castle, 0, 172, kw, 64, { ...st, rowH: 7, brick: 14, seed: 3 });
  for (let i = 0; i < kw; i += 8) castle.rect(i, 168, 5, 4, st.base);
  stones(castle, cx - 50, 92, 100, 144, { ...st, rowH: 7, brick: 14, seed: 4 });
  for (let i = 0; i < 100; i += 8) castle.rect(cx - 50 + i, 88, 5, 4, st.base);
  tower(cx - 80, 70, 30, 30);
  tower(cx + 50, 64, 30, 34);
  tower(30, 120, 22, 22);
  tower(kw - 60, 116, 22, 22);
  // great gate + banners on the keep
  castle.poly([[cx - 14, 236], [cx - 14, 196], [cx, 184], [cx + 14, 196], [cx + 14, 236]], hex('#1a1226'));
  banner(castle, cx - 40, 104, 14, 46, hex('#c8283c'), hex('#86162a'), hex('#e0b040'), hex('#c8283c'));
  banner(castle, cx + 26, 104, 14, 46, hex('#c8283c'), hex('#86162a'), hex('#e0b040'), hex('#c8283c'));
  for (const wx of [cx - 20, cx + 14]) castle.rect(wx, 130, 6, 10, hex('#ffc860'));
  layers.push({ file: 'castle.png', scroll: 0.35, canvas: castle });

  // courtyard wall --------------------------------------------------------
  const ww = layerW(0.7);
  const wall = new RgbCanvas(ww, VIEW_H);
  const wst = { base: hex('#54476c'), dark: hex('#30283e'), light: hex('#7e6e96') };
  stones(wall, 0, 186, ww, 54, { ...wst, rowH: 9, brick: 24, seed: 11 });
  for (let i = 0; i < ww; i += 16) stones(wall, i, 176, 10, 10, { ...wst, rowH: 5, brick: 10, seed: i });
  wall.rect(0, 184, ww, 2, wst.light);
  const torches = [];
  for (let px = 60; px < ww; px += 150) {
    stones(wall, px - 12, 158, 24, 82, { base: hex('#62547c'), dark: wst.dark, light: hex('#8c7ca4'), rowH: 8, brick: 12, seed: px });
    wall.rect(px - 14, 154, 28, 5, hex('#8c7ca4'));
    wall.rect(px - 2, 184, 4, 10, hex('#2a1c14'));
    wall.rect(px - 4, 180, 8, 4, hex('#5a4030'));
    torches.push({ x: px, y: 178 });
    if (px + 75 < ww) banner(wall, px + 63, 192, 24, 40, hex('#2c5cc8'), hex('#1b3a8c'), hex('#e8c060'), hex('#c8283c'));
  }
  // warm torch glow baked onto the wall
  for (const t of torches)
    for (let r = 34; r > 0; r -= 6) wall.disc(t.x, t.y, r, hex('#ff9a4a'), 14);
  layers.push({ file: 'wall.png', scroll: 0.7, canvas: wall, torches });

  // floor -----------------------------------------------------------------
  const floor = new RgbCanvas(STAGE_W, VIEW_H);
  const fpal = { base: hex('#6a5872'), dark: hex('#3a2e44'), light: hex('#9a88a2') };
  let y = FLOOR_Y - 6;
  let rowH = 5;
  let row = 0;
  floor.rect(0, FLOOR_Y - 6, STAGE_W, 6, hex('#3a2e44'));
  while (y < VIEW_H) {
    stones(floor, 0, y, STAGE_W, rowH, { ...fpal, rowH, brick: 30 + row * 10, seed: 50 + row });
    y += rowH;
    rowH += 3;
    row++;
  }
  floor.rect(0, FLOOR_Y - 1, STAGE_W, 1, hex('#b8a8c0'));
  layers.push({ file: 'floor.png', scroll: 1, canvas: floor, y: 0 });

  return { id: 'keep', name: 'Sigil Keep', layers, ambient: '#ffd8c0' };
}

// ======================================================= Stage 2: hall ==

function hallStage() {
  const layers = [];
  const R = rng(21);

  // back wall + rose window ----------------------------------------------
  const bw = layerW(0.2);
  const back = new RgbCanvas(bw, VIEW_H);
  stones(back, 0, 0, bw, VIEW_H, { base: hex('#2a2440'), dark: hex('#17132a'), light: hex('#3e365c'), rowH: 12, brick: 28, seed: 5 });
  const cx = bw / 2;
  const cy = 92;
  const glass = ['#2c5cc8', '#c8283c', '#e8c060', '#3a8ad8', '#8a2a9a'].map(hex);
  back.disc(cx, cy, 66, hex('#4a4266'));
  back.disc(cx, cy, 62, hex('#14101e'));
  for (let yy = cy - 60; yy <= cy + 60; yy++)
    for (let xx = cx - 60; xx <= cx + 60; xx++) {
      const dx = xx + 0.5 - cx;
      const dy = yy + 0.5 - cy;
      const r = Math.hypot(dx, dy);
      if (r > 59) continue;
      const a = (Math.atan2(dy, dx) + Math.PI) / (Math.PI * 2);
      const seg = Math.floor(a * 16);
      const ring = Math.floor(r / 15);
      const lead = Math.abs(a * 16 - Math.round(a * 16)) * r < 0.9 || Math.abs(r - Math.round(r / 15) * 15) < 0.8;
      back.set(xx, yy, lead ? hex('#14101e') : glass[(seg + ring * 3) % glass.length]);
    }
  back.disc(cx, cy, 17, hex('#14101e'));
  back.disc(cx, cy, 15, hex('#e8e0f8'));
  sigil(back, cx, cy + 1, 1.6, hex('#c8283c'), hex('#e8c060'));
  // moonlight shafts
  back.poly([[cx - 50, cy + 10], [cx + 50, cy + 10], [cx + 170, 240], [cx - 70, 240]], hex('#b8c8ff'), 22);
  back.poly([[cx - 20, cy + 20], [cx + 30, cy + 20], [cx + 110, 240], [cx + 10, 240]], hex('#d8e0ff'), 18);
  for (let i = 0; i < 40; i++) back.set(cx - 40 + R() * 160, 120 + R() * 110, hex('#e8eeff'), 120);
  layers.push({ file: 'back.png', scroll: 0.2, canvas: back });

  // pillars + banners + candles --------------------------------------------
  const pw = layerW(0.5);
  const mid = new RgbCanvas(pw, VIEW_H);
  const torches = [];
  const colPal = ramp([[0, '#2a2440'], [0.3, '#5a5078'], [0.55, '#8a80a8'], [0.8, '#5a5078'], [1, '#1e1a30']], 7);
  const camMid = ((STAGE_W - VIEW_W) / 2) * 0.5;
  for (let px = -63; px < pw; px += 240) {
    for (let x = 0; x < 30; x++) for (let y2 = 20; y2 < 236; y2++) mid.set(px + x, y2, pick(colPal, px + x, y2, x / 29));
    for (let x = -6; x < 36; x++) {
      for (let y2 = 12; y2 < 22; y2++) mid.set(px + x, y2, y2 < 14 ? hex('#a098c0') : hex('#5a5078'));
      for (let y2 = 222; y2 < 236; y2++) mid.set(px + x, y2, y2 < 224 ? hex('#a098c0') : hex('#4a4266'));
    }
    if (px + 135 < pw) {
      if (Math.abs(px + 135 - camMid - VIEW_W / 2) > 90) banner(mid, px + 106, 30, 28, 84, hex('#8a1a2a'), hex('#5a0e1a'), hex('#e8c060'), hex('#2c5cc8'));
      // candelabra
      const kx = px + 135;
      mid.rect(kx - 1, 170, 2, 66, hex('#8a6a30'));
      mid.rect(kx - 12, 170, 24, 2, hex('#c8a040'));
      for (const ox of [-12, 0, 12]) {
        mid.rect(kx + ox - 1, 162, 3, 8, hex('#f0e8d8'));
        torches.push({ x: kx + ox, y: 160, small: true });
      }
      mid.rect(kx - 6, 234, 12, 2, hex('#c8a040'));
    }
  }
  for (const t of torches) for (let r = 18; r > 0; r -= 6) mid.disc(t.x, t.y, r, hex('#ffb060'), 12);
  layers.push({ file: 'pillars.png', scroll: 0.5, canvas: mid, torches });

  // floor -------------------------------------------------------------------
  const floor = new RgbCanvas(STAGE_W, VIEW_H);
  let y = FLOOR_Y - 8;
  let h = 5;
  let row = 0;
  while (y < VIEW_H) {
    const tile = 20 + row * 8;
    for (let x = 0; x < STAGE_W; x++)
      for (let j = 0; j < h; j++) {
        const odd = (Math.floor((x + (row % 2) * tile * 0.5) / tile) + row) % 2;
        const c = odd ? hex('#d8d0e8') : hex('#3a3252');
        floor.set(x, y + j, j === 0 ? mix(c, [255, 255, 255], 0.2) : c);
      }
    y += h;
    h += 3;
    row++;
  }
  // red carpet runner with gold trim
  floor.rect(0, 244, STAGE_W, 14, hex('#8a1a2a'));
  floor.rect(0, 244, STAGE_W, 2, hex('#e8c060'));
  floor.rect(0, 256, STAGE_W, 2, hex('#e8c060'));
  for (let x = 0; x < STAGE_W; x += 2) floor.set(x, 250, hex('#a8283a'));
  floor.rect(0, FLOOR_Y - 9, STAGE_W, 1, hex('#14101e'));
  layers.push({ file: 'floor.png', scroll: 1, canvas: floor });

  // foreground pillars (in front of fighters, only at stage edges) -----------
  const fw = layerW(1.25);
  const fore = new RgbCanvas(fw, VIEW_H);
  for (const px of [-26, fw - 18]) {
    for (let x = 0; x < 44; x++) for (let y2 = 0; y2 < VIEW_H; y2++) fore.set(px + x, y2, pick(ramp([[0, '#0c0a16'], [0.5, '#1e1a30'], [1, '#0c0a16']], 4), px + x, y2, x / 43));
  }
  layers.push({ file: 'fore.png', scroll: 1.25, canvas: fore, front: true });

  return { id: 'hall', name: 'Moonlit Hall', layers, ambient: '#d8e0ff' };
}

export function buildStages(root) {
  const out = [];
  for (const st of [keepStage(), hallStage()]) {
    const dir = join(root, 'public/assets/stages', st.id);
    const meta = { id: st.id, name: st.name, width: STAGE_W, floorY: FLOOR_Y, layers: [] };
    for (const L of st.layers) {
      writeFile(join(dir, L.file), L.canvas.png());
      meta.layers.push({ file: L.file, scroll: L.scroll, front: !!L.front, torches: L.torches ?? [] });
    }
    writeFile(join(dir, 'stage.json'), `${JSON.stringify(meta, null, 1)}\n`);
    out.push(st.id);
  }
  writeFile(join(root, 'public/assets/stages/index.json'), `${JSON.stringify(out)}\n`);
  return out;
}
