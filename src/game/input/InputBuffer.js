/**
 * Per-fighter input history used by the simulation.
 *
 * Directions are stored in numpad notation RELATIVE to facing:
 *   7 8 9      4 = back, 6 = forward, 2 = down, 8 = up
 *   4 5 6      so a quarter-circle-forward is 2 3 6
 *   1 2 3
 *
 * Button presses are buffered for a few ticks so inputs made during hitstop
 * or a frame early still come out (standard fighting-game leniency).
 */
export const BUTTONS = ['high', 'mid', 'low', 'special', 'throw', 'unique'];
const SIZE = 64;
export const PRESS_BUFFER = 5;
const MOTION_WINDOW = 16;

const MOTIONS = {
  dp: [6, 2, 3], // forward, down, down-forward
  qcf: [2, 3, 6], // down, down-forward, forward
};

export class InputBuffer {
  constructor() {
    this.frames = [];
    this.prevHeld = Object.fromEntries(BUTTONS.map((b) => [b, false]));
    this.clock = 0; // advances only on unfrozen ticks, so hitstop doesn't eat buffered presses
  }

  /** Record one tick of raw pad input. facing: 1 = right, -1 = left. */
  push(pad, facing, frozen = false) {
    if (!frozen) this.clock++;
    const fwd = facing > 0 ? pad.right : pad.left;
    const back = facing > 0 ? pad.left : pad.right;
    const h = fwd && !back ? 1 : back && !fwd ? -1 : 0;
    const v = pad.up && !pad.down ? 1 : pad.down && !pad.up ? -1 : 0;
    const dir = 5 + h + v * 3;
    const pressed = {};
    for (const b of BUTTONS) {
      pressed[b] = !!pad[b] && !this.prevHeld[b];
      this.prevHeld[b] = !!pad[b];
    }
    this.frames.push({ t: this.clock, dir, pressed, held: Object.fromEntries(BUTTONS.map((b) => [b, !!pad[b]])) });
    if (this.frames.length > SIZE) this.frames.shift();
  }

  get current() {
    return this.frames[this.frames.length - 1] ?? { dir: 5, pressed: {}, held: {} };
  }
  get dir() {
    return this.current.dir;
  }
  get fwd() {
    return [3, 6, 9].includes(this.dir);
  }
  get back() {
    return [1, 4, 7].includes(this.dir);
  }
  get down() {
    return this.dir <= 3;
  }
  get up() {
    return this.dir >= 7;
  }
  held(btn) {
    return !!this.current.held[btn];
  }

  /** Most recent unconsumed press of any button within the buffer window. */
  peekPress() {
    for (let i = this.frames.length - 1; i >= 0 && this.frames[i].t > this.clock - PRESS_BUFFER; i--) {
      for (const b of BUTTONS) if (this.frames[i].pressed[b]) return { btn: b, index: i };
    }
    return null;
  }

  consume(p) {
    if (p) this.frames[p.index].pressed[p.btn] = false;
  }

  /**
   * Was `motion` completed shortly before (or on) the press at pressIndex?
   * Scans backwards matching the sequence in reverse; other directions in
   * between are allowed (sloppy inputs still work).
   */
  motion(name, pressIndex) {
    const seq = MOTIONS[name];
    let k = seq.length - 1;
    const t0 = this.frames[pressIndex].t - MOTION_WINDOW;
    for (let i = Math.min(this.frames.length - 1, pressIndex + 1); i >= 0 && this.frames[i].t >= t0 && k >= 0; i--) {
      if (this.frames[i].dir === seq[k]) k--;
    }
    return k < 0;
  }

  /**
   * Double-tap: the stick returned to `d` (6 = forward, 4 = back) on this
   * tick, after a previous tap on `d` within the last 12 ticks.
   */
  doubleTap(d) {
    const F = this.frames;
    const n = F.length;
    if (n < 3 || F[n - 1].dir !== d || F[n - 2].dir === d) return false;
    let i = n - 2;
    while (i >= 0 && F[i].dir !== d && F[n - 1].t - F[i].t <= 12) i--;
    return i >= 0 && F[i].dir === d && F[n - 1].t - F[i].t <= 12;
  }

  clear() {
    this.frames.length = 0;
    this.clock = 0;
  }
}
