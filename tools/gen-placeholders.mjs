#!/usr/bin/env node
/**
 * Generates placeholder KEY-COLOR sprite sheets for Herc and Bella.
 * Output: public/assets/characters/<id>/sheet.png (4 idle frames, 64x96 each)
 *
 * These are stand-ins: replace sheet.png with real art painted in the key
 * colors from src/palette/roles.js and everything else keeps working.
 *
 *   npm run gen:placeholders
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';
import { PALETTE_ROLES, hexToRgb } from '../src/palette/roles.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const FW = 64;
const FH = 96;
const BOB = [0, 0, 1, 1]; // idle "breathing": upper body dips 1px

const KEY = Object.fromEntries(Object.entries(PALETTE_ROLES).map(([k, v]) => [k, hexToRgb(v)]));

// ---------------------------------------------------------------- drawing --

class Frame {
  constructor() {
    this.px = new Array(FW * FH).fill(null); // role name or null
  }
  set(x, y, role) {
    if (x >= 0 && y >= 0 && x < FW && y < FH) this.px[y * FW + x] = role;
  }
  get(x, y) {
    return x >= 0 && y >= 0 && x < FW && y < FH ? this.px[y * FW + x] : null;
  }
  rect(x, y, w, h, role) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, role);
  }
  pattern(x, y, rows, legend) {
    rows.forEach((row, j) =>
      [...row].forEach((ch, i) => legend[ch] && this.set(x + i, y + j, legend[ch])),
    );
  }
  /** 1px outline around every filled pixel (4-neighborhood). */
  outline() {
    const add = [];
    for (let y = 0; y < FH; y++)
      for (let x = 0; x < FW; x++)
        if (!this.get(x, y) && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => this.get(x + dx, y + dy)))
          add.push([x, y]);
    for (const [x, y] of add) this.set(x, y, 'outline');
  }
}

// The shared knightly sigil: a shield with an upward chevron. 7x8.
function sigil(f, x, y) {
  f.pattern(
    x,
    y,
    [
      'ttttttt',
      't#####t',
      't##t##t',
      't#t#t#t',
      'tt###tt',
      't#####t',
      '.t###t.',
      '..ttt..',
    ],
    { t: 'trim', '#': 'sigil' },
  );
}

// Herc: 5'0" = 60px (rows 34..93). Stocky, plumed helm, big curled mustache.
function drawHerc(f, b) {
  // plume
  f.rect(29, 30 + b, 6, 4, 'cape');
  f.rect(31, 28 + b, 3, 2, 'cape');
  // helmet
  f.rect(24, 34 + b, 16, 14, 'armor');
  f.rect(36, 34 + b, 4, 14, 'armorShade');
  f.rect(24, 38 + b, 16, 1, 'trim');
  // face opening
  f.rect(27, 41 + b, 10, 7, 'skin');
  f.rect(35, 41 + b, 2, 7, 'skinShade');
  // grumpy brows slanting inward + eyes
  f.set(27, 41 + b, 'hair'); f.set(28, 42 + b, 'hair'); f.set(29, 42 + b, 'hair');
  f.set(36, 41 + b, 'hair'); f.set(35, 42 + b, 'hair'); f.set(34, 42 + b, 'hair');
  f.set(29, 43 + b, 'visor'); f.set(34, 43 + b, 'visor');
  // the mustache
  f.rect(26, 45 + b, 12, 2, 'hair');
  f.set(25, 44 + b, 'hair'); f.set(24, 43 + b, 'hair');
  f.set(38, 44 + b, 'hair'); f.set(39, 43 + b, 'hair');
  // gorget + torso
  f.rect(26, 48 + b, 12, 2, 'armorShade');
  f.rect(19, 50 + b, 26, 22, 'armor');
  f.rect(39, 50 + b, 6, 22, 'armorShade');
  sigil(f, 28, 54 + b);
  f.rect(19, 70 + b, 26, 2, 'trim');
  // arms + pauldrons
  f.rect(14, 51 + b, 5, 17, 'armorShade');
  f.rect(45, 51 + b, 5, 17, 'armorShade');
  f.rect(14, 68 + b, 5, 4, 'armor');
  f.rect(45, 68 + b, 5, 4, 'armor');
  f.rect(13, 49 + b, 8, 5, 'armor');
  f.rect(43, 49 + b, 8, 5, 'armor');
  f.rect(13, 53 + b, 8, 1, 'trim');
  f.rect(43, 53 + b, 8, 1, 'trim');
  // hips, legs, boots (planted: no bob)
  f.rect(20, 72, 24, 3, 'armor');
  f.rect(22, 74, 8, 15, 'armorShade');
  f.rect(34, 74, 8, 15, 'armorShade');
  f.rect(21, 89, 10, 5, 'visor');
  f.rect(33, 89, 10, 5, 'visor');
}

// Bella: 7'0" = 84px (rows 10..93). Tall, slender, long braid and cape.
function drawBella(f, b) {
  // behind: cape + braid
  f.rect(21, 27 + b, 22, 52, 'cape');
  f.rect(38, 18 + b, 3, 30, 'hair');
  // helmet
  f.rect(26, 10 + b, 13, 16, 'armor');
  f.rect(35, 10 + b, 4, 16, 'armorShade');
  f.rect(26, 14 + b, 13, 1, 'trim');
  // face, kind eyes, soft smile
  f.rect(28, 17 + b, 8, 8, 'skin');
  f.rect(34, 17 + b, 2, 8, 'skinShade');
  f.set(30, 20 + b, 'visor'); f.set(33, 20 + b, 'visor');
  f.set(30, 22 + b, 'skinShade'); f.rect(31, 23 + b, 2, 1, 'skinShade'); f.set(33, 22 + b, 'skinShade');
  // gorget + torso
  f.rect(28, 25 + b, 8, 3, 'armorShade');
  f.rect(23, 28 + b, 18, 30, 'armor');
  f.rect(37, 28 + b, 4, 30, 'armorShade');
  sigil(f, 28, 33 + b);
  f.rect(23, 55 + b, 18, 2, 'trim');
  // arms, pauldrons, hands
  f.rect(19, 32 + b, 4, 24, 'armorShade');
  f.rect(41, 32 + b, 4, 24, 'armorShade');
  f.rect(18, 28 + b, 7, 4, 'armor');
  f.rect(39, 28 + b, 7, 4, 'armor');
  f.rect(18, 31 + b, 7, 1, 'trim');
  f.rect(39, 31 + b, 7, 1, 'trim');
  f.rect(19, 56 + b, 4, 3, 'skin');
  f.rect(41, 56 + b, 4, 3, 'skin');
  // hips, legs, boots (planted)
  f.rect(24, 58, 16, 3, 'armor');
  f.rect(25, 61, 6, 27, 'armorShade');
  f.rect(33, 61, 6, 27, 'armorShade');
  f.rect(24, 88, 8, 6, 'visor');
  f.rect(32, 88, 8, 6, 'visor');
}

// -------------------------------------------------------------------- png --

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
function encodePng(w, h, rgba) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0; // filter: none
    rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr.set([8, 6, 0, 0, 0], 8); // 8-bit RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ------------------------------------------------------------------- main --

function buildSheet(draw) {
  const w = FW * BOB.length;
  const rgba = Buffer.alloc(w * FH * 4);
  BOB.forEach((b, i) => {
    const f = new Frame();
    draw(f, b);
    f.outline();
    for (let y = 0; y < FH; y++)
      for (let x = 0; x < FW; x++) {
        const role = f.get(x, y);
        if (!role) continue;
        const o = (y * w + i * FW + x) * 4;
        rgba.set([...KEY[role], 255], o);
      }
  });
  return encodePng(w, FH, rgba);
}

for (const [id, draw] of [['herc', drawHerc], ['bella', drawBella]]) {
  const out = join(ROOT, 'public/assets/characters', id, 'sheet.png');
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, buildSheet(draw));
  console.log(`wrote ${out}`);
}
