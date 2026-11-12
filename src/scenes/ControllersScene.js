import Phaser from 'phaser';
import { Sfx } from '../game/audio/Sfx.js';
import { GAME_HEIGHT, GAME_WIDTH } from '../game/constants.js';
import { Keyboard, connectedPads, readGamepad } from '../game/input/devices.js';
import { LAYOUTS } from '../game/view/ControllerDiagram.js';
import { setText, text } from '../game/view/text.js';

const COL = [110, GAME_WIDTH / 2, GAME_WIDTH - 110]; // P1, unassigned, P2

/**
 * Versus setup: assign USB / Bluetooth controllers to players.
 * Each controller pushes left / right to move itself to P1 or P2.
 * The keyboard always belongs to P1. P2 needs a controller.
 */
export class ControllersScene extends Phaser.Scene {
  constructor() {
    super('Controllers');
  }

  create() {
    this.cameras.main.setBackgroundColor('#120e22');
    this.kb = new Keyboard();
    this.events.once('shutdown', () => this.kb.destroy());
    this.slot = new Map(); // gamepad index -> 0 (P1) | 1 (unassigned) | 2 (P2)
    this.prev = new Map();
    this.g = this.add.graphics();
    text(this, GAME_WIDTH / 2, 8, 'CONTROLLER SETUP', { scale: 2, align: 'center', tint: 0xffd24a });
    text(this, COL[0], 34, 'PLAYER 1', { scale: 2, align: 'center' });
    text(this, COL[2], 34, 'PLAYER 2', { scale: 2, align: 'center', tint: 0xff7a6a });
    text(this, COL[1], 38, 'NOT PLAYING', { align: 'center', tint: 0x9a92b8 });
    this.labels = [];
    this.help = text(this, GAME_WIDTH / 2, GAME_HEIGHT - 34, '', { align: 'center', tint: 0xc8c0d8 });
    text(this, GAME_WIDTH / 2, GAME_HEIGHT - 14, 'ON A CONTROLLER: LEFT / RIGHT = CHOOSE SIDE   A / CROSS = READY   B = BACK', { align: 'center', tint: 0x9a92b8 });
  }

  update() {
    const pads = connectedPads();
    if (!this.primed) {
      // ignore buttons still held from the previous screen
      this.primed = true;
      for (const p of pads) this.prev.set(p.index, readGamepad(p.index));
      return;
    }
    for (const p of pads) if (!this.slot.has(p.index)) this.slot.set(p.index, 1);
    for (const i of [...this.slot.keys()]) if (!pads.some((p) => p.index === i)) this.slot.delete(i);

    let go = this.kb.has('Enter') || this.kb.has('KeyJ');
    let back = this.kb.has('Escape') || this.kb.has('Backspace');
    for (const p of pads) {
      const r = readGamepad(p.index);
      const was = this.prev.get(p.index) ?? {};
      const s = this.slot.get(p.index);
      if (r.left && !was.left && s > 0) {
        this.slot.set(p.index, s - 1);
        Sfx.move();
      }
      if (r.right && !was.right && s < 2) {
        this.slot.set(p.index, s + 1);
        Sfx.move();
      }
      if ((r.low || r.start) && !(was.low || was.start)) go = true;
      if (r.back && !was.back) back = true;
      this.prev.set(p.index, r);
    }
    this.kb.endTick();

    const p1 = [...this.slot].filter(([, s]) => s === 0).map(([i]) => i);
    const p2 = [...this.slot].filter(([, s]) => s === 2).map(([i]) => i);
    this.draw(pads);
    setText(
      this.help,
      !pads.length
        ? 'CONNECT A USB OR BLUETOOTH CONTROLLER, THEN PRESS ANY BUTTON ON IT'
        : !p2.length
          ? 'PLAYER 2 NEEDS A CONTROLLER: PUSH IT RIGHT'
          : 'READY!  PRESS A / CROSS OR ENTER TO CONTINUE',
    );
    if (back) {
      Sfx.back();
      return this.scene.start('Title');
    }
    if (go && p2.length) {
      Sfx.confirm();
      this.scene.start('Select', { mode: 'versus', devices: { p1: { keyboard: true, pads: p1 }, p2: { keyboard: false, pads: p2 } } });
    }
  }

  draw(pads) {
    const g = this.g.clear();
    this.labels.forEach((l) => l.destroy());
    this.labels = [];
    for (const x of [COL[0], COL[2]]) {
      g.fillStyle(0x1a1430, 1).fillRect(x - 90, 52, 180, 150);
      g.lineStyle(1, 0x3a2f5a, 1).strokeRect(x - 89.5, 52.5, 179, 149);
    }
    const icon = (x, y, name, sub, tint) => {
      g.fillStyle(0x1a1626, 1).fillRoundedRect(x - 34, y - 12, 68, 24, 8);
      g.fillStyle(tint, 1).fillRoundedRect(x - 32, y - 10, 64, 20, 7);
      g.fillStyle(0x1a1626, 1).fillCircle(x - 18, y, 3).fillCircle(x + 18, y, 3);
      this.labels.push(text(this, x, y + 18, name, { align: 'center' }));
      if (sub) this.labels.push(text(this, x, y + 28, sub, { align: 'center', tint: 0x9a92b8 }));
    };
    // keyboard is always P1
    g.fillStyle(0x1a1626, 1).fillRect(COL[0] - 34, 68, 68, 22);
    g.fillStyle(0x5a5270, 1).fillRect(COL[0] - 32, 70, 64, 18);
    for (let r = 0; r < 3; r++) for (let k = 0; k < 8; k++) g.fillStyle(0x8a82a8, 1).fillRect(COL[0] - 29 + k * 7.5, 72 + r * 5, 6, 4);
    this.labels.push(text(this, COL[0], 96, 'KEYBOARD', { align: 'center' }));
    const counts = [1, 0, 0];
    for (const p of pads) {
      const s = this.slot.get(p.index);
      const y = 80 + counts[s] * 44 + (s === 1 ? 10 : 0);
      counts[s]++;
      const name = LAYOUTS.find((l) => l.id === p.type).name;
      icon(COL[s], y, `#${p.index + 1} ${name}`, s === 1 ? '< MOVE >' : null, s === 2 ? 0xc85a5a : s === 0 ? 0xc8a040 : 0x6a6286);
    }
  }
}
