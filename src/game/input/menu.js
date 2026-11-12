import { KEYMAPS, Keyboard, readGamepad } from './devices.js';

const BACK_KEYS = ['Escape', 'Backspace'];

/**
 * Menu navigation for up to two players: edge-triggered
 * { up, down, left, right, confirm, back } per player.
 * twoPlayer=false: player 0 uses the solo keymap (WASD/arrows + J/K/I/Enter).
 */
export class MenuInput {
  constructor(scene, twoPlayer = false) {
    this.kb = new Keyboard();
    this.twoPlayer = twoPlayer;
    this.prev = [{}, {}];
    this.hold = [{}, {}];
    scene.events.once('shutdown', () => this.kb.destroy());
  }

  raw(i) {
    const map = this.twoPlayer ? (i ? KEYMAPS.p2 : KEYMAPS.p1) : i ? null : KEYMAPS.solo;
    const k = map ? this.kb.read(map) : {};
    const gp = readGamepad(i);
    const back = (i === 0 && BACK_KEYS.some((c) => this.kb.down.has(c) || this.kb.tapped.has(c))) || (gp && navigator.getGamepads()[i]?.buttons[1]?.pressed);
    return {
      up: k.up || gp?.up,
      down: k.down || gp?.down,
      left: k.left || gp?.left,
      right: k.right || gp?.right,
      confirm: (k.high || k.mid || k.low || (k.start && !this.kb.down.has('Escape'))) || gp?.low || gp?.start,
      back: !!back,
    };
  }

  /** Call once per frame. Directions auto-repeat when held. */
  poll() {
    const out = [0, 1].map((i) => {
      const r = this.raw(i);
      const e = {};
      for (const k of Object.keys(r)) {
        const was = this.prev[i][k];
        e[k] = r[k] && !was;
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
