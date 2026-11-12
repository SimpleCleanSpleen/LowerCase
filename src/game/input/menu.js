import { Keyboard, PadSource, SOLO_DEVICES, readGamepad } from './devices.js';

const KB_CONFIRM = ['KeyJ', 'KeyK', 'KeyI', 'KeyL', 'Enter', 'Space'];
const KB_BACK = ['Escape', 'Backspace'];

/**
 * Menu navigation for up to two players: edge-triggered
 * { up, down, left, right, confirm, back } per player, built from that
 * player's assigned devices (keyboard and/or controllers).
 * Controllers: A / Cross (bottom) or Start confirms, B / Circle (right) backs out.
 */
export class MenuInput {
  constructor(scene, devices = SOLO_DEVICES) {
    this.kb = new Keyboard();
    this.sources = [new PadSource(this.kb, devices.p1), new PadSource(this.kb, devices.p2)];
    this.hold = [{}, {}];
    // Buttons already held when the screen opens (e.g. the press that opened
    // it) must be released first, or they'd immediately act here too.
    this.prev = [this.raw(0), this.raw(1)];
    scene.events.once('shutdown', () => this.kb.destroy());
  }

  raw(i) {
    const src = this.sources[i];
    const k = src.useKeyboard ? this.kb : null;
    const pads = src.padIndices().map(readGamepad).filter(Boolean);
    const any = (f) => pads.some(f);
    const kb = (codes) => !!k && codes.some((c) => k.has(c));
    const p = src.poll();
    return {
      up: p.up, down: p.down, left: p.left, right: p.right,
      confirm: kb(KB_CONFIRM) || any((g) => g.low || g.start),
      back: kb(KB_BACK) || any((g) => g.back),
    };
  }

  /** Call once per frame. Directions auto-repeat when held. */
  poll() {
    const out = [0, 1].map((i) => {
      const r = this.raw(i);
      const e = {};
      for (const k of Object.keys(r)) {
        e[k] = r[k] && !this.prev[i][k];
        if (r[k] && ['up', 'down', 'left', 'right'].includes(k)) {
          this.hold[i][k] = (this.hold[i][k] ?? 0) + 1;
          if (this.hold[i][k] > 18 && this.hold[i][k] % 6 === 0) e[k] = true;
        } else this.hold[i][k] = 0;
      }
      this.prev[i] = r;
      return e;
    });
    this.kb.endTick();
    return out;
  }
}
