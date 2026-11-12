import { text } from './text.js';

/**
 * Draws a labeled control diagram for one layout into a container.
 * Layouts: keyboard | xbox | playstation | switch | generic
 */
export const LAYOUTS = [
  { id: 'keyboard', name: 'KEYBOARD' },
  { id: 'xbox', name: 'XBOX' },
  { id: 'playstation', name: 'PLAYSTATION' },
  { id: 'switch', name: 'SWITCH PRO' },
  { id: 'generic', name: 'GENERIC PAD' },
];

const FACE = {
  // labels for [bottom, right, left, top]
  xbox: { labels: ['A', 'B', 'X', 'Y'], colors: [0x5ac85a, 0xe05050, 0x4a8ae8, 0xf0c840], shoulders: ['LB', 'RB', 'LT', 'RT'], start: 'MENU', sticks: 'offset' },
  playstation: { labels: ['cross', 'circle', 'square', 'triangle'], colors: [0x7ab0ff, 0xff7070, 0xf090d0, 0x60d0a0], shoulders: ['L1', 'R1', 'L2', 'R2'], start: 'OPTIONS', sticks: 'low' },
  switch: { labels: ['B', 'A', 'Y', 'X'], colors: [0xd8d8e0, 0xd8d8e0, 0xd8d8e0, 0xd8d8e0], shoulders: ['L', 'R', 'ZL', 'ZR'], start: '+', sticks: 'offset' },
  generic: { labels: ['1', '2', '3', '4'], colors: [0xc8c8d8, 0xc8c8d8, 0xc8c8d8, 0xc8c8d8], shoulders: ['L1', 'R1', 'L2', 'R2'], start: 'START', sticks: 'low' },
};

const ACTION_COLOR = 0xffd24a;

export function drawDiagram(scene, layout, cx, cy) {
  const c = scene.add.container(0, 0).setScrollFactor(0);
  if (layout === 'keyboard') drawKeyboard(scene, c, cx, cy);
  else drawPad(scene, c, layout, cx, cy);
  return c;
}

function label(scene, c, x, y, str, opts = {}) {
  const t = text(scene, x, y, str, { align: opts.align ?? 'center', tint: opts.tint ?? 0xffffff, scale: opts.scale ?? 1, valign: 'middle' });
  c.add(t);
  return t;
}

function drawPad(scene, c, layout, cx, cy) {
  const F = FACE[layout];
  const g = scene.add.graphics();
  c.add(g);
  const body = 0x3a3450;
  const edge = 0x1a1626;
  const W = 150;
  // shoulders
  g.fillStyle(edge, 1).fillRoundedRect(cx - W / 2 - 2, cy - 44, 46, 14, 5).fillRoundedRect(cx + W / 2 - 44, cy - 44, 46, 14, 5);
  g.fillStyle(0x5a5270, 1).fillRoundedRect(cx - W / 2, cy - 42, 42, 10, 4).fillRoundedRect(cx + W / 2 - 42, cy - 42, 42, 10, 4);
  // body + grips
  g.fillStyle(edge, 1).fillRoundedRect(cx - W / 2 - 2, cy - 34, W + 4, 54, 18).fillCircle(cx - W / 2 + 22, cy + 24, 24).fillCircle(cx + W / 2 - 22, cy + 24, 24);
  g.fillStyle(body, 1).fillRoundedRect(cx - W / 2, cy - 32, W, 50, 16).fillCircle(cx - W / 2 + 22, cy + 24, 22).fillCircle(cx + W / 2 - 22, cy + 24, 22);
  g.fillStyle(0x4a4462, 1).fillRoundedRect(cx - W / 2 + 6, cy - 28, W - 12, 8, 4);

  // left stick & d-pad positions
  const offset = F.sticks === 'offset';
  const stickL = offset ? [cx - 46, cy - 12] : [cx - 26, cy + 10];
  const dpad = offset ? [cx - 26, cy + 10] : [cx - 46, cy - 12];
  const stickR = [cx + 26, cy + 10];
  g.fillStyle(edge, 1).fillCircle(stickL[0], stickL[1], 10).fillCircle(stickR[0], stickR[1], 9);
  g.fillStyle(0x6a6286, 1).fillCircle(stickL[0], stickL[1], 7).fillCircle(stickR[0], stickR[1], 6);
  g.fillStyle(edge, 1).fillRect(dpad[0] - 9, dpad[1] - 3, 18, 7).fillRect(dpad[0] - 3, dpad[1] - 9, 7, 18);
  g.fillStyle(0x7a7296, 1).fillRect(dpad[0] - 8, dpad[1] - 2, 16, 5).fillRect(dpad[0] - 2, dpad[1] - 8, 5, 16);
  // start / select
  g.fillStyle(0x7a7296, 1).fillRoundedRect(cx + 6, cy - 17, 10, 5, 2).fillRoundedRect(cx - 16, cy - 17, 10, 5, 2);

  // face buttons: bottom, right, left, top
  const fb = [cx + 46, cy - 12];
  const pos = [[0, 11], [11, 0], [-11, 0], [0, -11]].map(([dx, dy]) => [fb[0] + dx, fb[1] + dy]);
  pos.forEach(([x, y], i) => {
    g.fillStyle(edge, 1).fillCircle(x, y, 6);
    g.fillStyle(F.colors[i], 1).fillCircle(x, y, 5);
    const l = F.labels[i];
    if (layout === 'playstation') {
      g.lineStyle(1, 0x1a1626, 1);
      if (l === 'cross') g.lineBetween(x - 2, y - 2, x + 2, y + 2).lineBetween(x - 2, y + 2, x + 2, y - 2);
      if (l === 'circle') g.strokeCircle(x, y, 2.5);
      if (l === 'square') g.strokeRect(x - 2, y - 2, 4.5, 4.5);
      if (l === 'triangle') g.strokeTriangle(x, y - 3, x + 3, y + 2, x - 3, y + 2);
    } else if (layout === 'xbox') label(scene, c, x + 0.5, y + 0.5, l, { tint: 0x1a1626 });
  });

  // callouts: [anchor, label point, text, align]
  const L = cx - W / 2 - 18;
  const R = cx + W / 2 + 18;
  const call = (from, to, str, align, sub) => {
    g.lineStyle(1, 0x8a82a8, 1).lineBetween(from[0], from[1], to[0], to[1]);
    label(scene, c, to[0] + (align === 'right' ? -3 : 3), to[1], str, { align, tint: ACTION_COLOR });
    if (sub) label(scene, c, to[0] + (align === 'right' ? -3 : 3), to[1] + 9, sub, { align, tint: 0x9a92b8 });
  };
  const btn = (i) => (layout === 'playstation' ? ['CROSS', 'CIRCLE', 'SQUARE', 'TRIANGLE'][i] : F.labels[i]);
  call(pos[3], [R, cy - 40], 'HIGH', 'left', btn(3));
  call(pos[1], [R, cy - 14], 'SPECIAL', 'left', btn(1));
  call(pos[0], [R, cy + 12], 'LOW', 'left', btn(0));
  call(pos[2], [R, cy + 38], 'MID', 'left', btn(2));
  call([cx + W / 2 - 20, cy - 38], [R, cy - 62], 'UNIQUE', 'left', `${F.shoulders[1]} / ${F.shoulders[3]}`);
  call([cx - W / 2 + 20, cy - 38], [L, cy - 62], 'THROW', 'right', `${F.shoulders[0]} / ${F.shoulders[2]}`);
  call(stickL, [L, cy - 20], 'MOVE', 'right', 'STICK');
  call(dpad, [L, cy + 14], 'MOVE', 'right', 'D-PAD');
  call([cx + 11, cy - 15], [cx + 11, cy + 60], 'PAUSE', 'center', F.start);
}

function drawKeyboard(scene, c, cx, cy) {
  const g = scene.add.graphics();
  c.add(g);
  const key = (x, y, k, action, w = 18) => {
    g.fillStyle(0x1a1626, 1).fillRoundedRect(x - 1, y - 1, w + 2, 20, 3);
    g.fillStyle(0x5a5270, 1).fillRoundedRect(x, y, w, 18, 3);
    g.fillStyle(0x7a7296, 1).fillRoundedRect(x + 1, y + 1, w - 2, 12, 2);
    label(scene, c, x + w / 2, y + 7, k);
    if (action) label(scene, c, x + w / 2, y + 26, action, { tint: ACTION_COLOR });
  };
  // movement cluster
  const mx = cx - 150;
  const my = cy - 50;
  key(mx + 22, my, 'W', 'JUMP');
  key(mx, my + 34, 'A', '');
  key(mx + 22, my + 34, 'S', 'CROUCH');
  key(mx + 44, my + 34, 'D', '');
  label(scene, c, mx + 31, my + 74, 'A / D  WALK', { tint: ACTION_COLOR });
  label(scene, c, mx + 31, my + 86, 'OR ARROW KEYS', { tint: 0x9a92b8 });
  label(scene, c, mx + 31, my + 98, 'TAP TWICE: DASH', { tint: 0x9a92b8 });
  // attack cluster
  const ax = cx + 20;
  const ay = cy - 50;
  key(ax, ay, 'U', 'THROW', 30);
  key(ax + 40, ay, 'I', 'HIGH', 30);
  key(ax + 80, ay, 'O', 'UNIQUE', 30);
  key(ax + 8, ay + 34, 'J', 'MID', 30);
  key(ax + 48, ay + 34, 'K', 'LOW', 30);
  key(ax + 88, ay + 34, 'L', 'SPECIAL', 30);
  key(ax + 18, ay + 74, 'ESC', 'PAUSE', 40);
  key(ax + 70, ay + 74, 'ENTER', 'PAUSE', 44);
}
