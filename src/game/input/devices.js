/**
 * Raw input devices -> per-tick "pad" snapshots:
 *   { left, right, up, down, high, mid, low, start }   (held booleans)
 *
 * Keyboard uses KeyboardEvent.code (physical position) so bindings work on any
 * layout. Taps shorter than one tick are never lost: a key that went down and
 * up between two ticks still reads as held for that one tick.
 */

export const KEYMAPS = {
  // Solo play (vs CPU / training): movement on the left hand, attacks on the right.
  solo: {
    left: ['KeyA', 'ArrowLeft'], right: ['KeyD', 'ArrowRight'], up: ['KeyW', 'ArrowUp', 'Space'], down: ['KeyS', 'ArrowDown'],
    high: ['KeyI', 'KeyU'], mid: ['KeyJ', 'KeyH'], low: ['KeyK', 'KeyN'], start: ['Enter', 'Escape'],
  },
  // Two players sharing one keyboard.
  p1: {
    left: ['KeyA'], right: ['KeyD'], up: ['KeyW'], down: ['KeyS'],
    high: ['KeyR'], mid: ['KeyF'], low: ['KeyV'], start: ['Escape'],
  },
  p2: {
    left: ['ArrowLeft'], right: ['ArrowRight'], up: ['ArrowUp'], down: ['ArrowDown'],
    high: ['Numpad8', 'KeyO'], mid: ['Numpad5', 'KeyK'], low: ['Numpad2', 'Comma'], start: ['Enter'],
  },
};

const ACTIONS = ['left', 'right', 'up', 'down', 'high', 'mid', 'low', 'start'];

export class Keyboard {
  constructor(target = window) {
    this.down = new Set();
    this.tapped = new Set(); // went down since last poll
    this.target = target;
    this.onDown = (e) => {
      if (/^(Arrow|Space|Key[A-Z]|Comma|Slash|Numpad)/.test(e.code) && !e.ctrlKey && !e.metaKey) e.preventDefault();
      if (e.repeat) return;
      this.down.add(e.code);
      this.tapped.add(e.code);
    };
    this.onUp = (e) => this.down.delete(e.code);
    this.onBlur = () => this.down.clear();
    target.addEventListener('keydown', this.onDown);
    target.addEventListener('keyup', this.onUp);
    target.addEventListener('blur', this.onBlur);
  }
  read(map) {
    const pad = {};
    for (const a of ACTIONS) pad[a] = (map[a] ?? []).some((c) => this.down.has(c) || this.tapped.has(c));
    return pad;
  }
  /** Call once per tick after every pad has been read. */
  endTick() {
    this.tapped.clear();
  }
  destroy() {
    this.target.removeEventListener('keydown', this.onDown);
    this.target.removeEventListener('keyup', this.onUp);
    this.target.removeEventListener('blur', this.onBlur);
  }
}

/** Standard-mapping gamepads: d-pad or left stick; Y/X/A = high/mid/low. */
export function readGamepad(index) {
  const gp = navigator.getGamepads?.()[index];
  if (!gp || !gp.connected) return null;
  const b = (i) => !!gp.buttons[i]?.pressed;
  const ax = gp.axes[0] ?? 0;
  const ay = gp.axes[1] ?? 0;
  return {
    left: b(14) || ax < -0.5,
    right: b(15) || ax > 0.5,
    up: b(12) || ay < -0.5,
    down: b(13) || ay > 0.5,
    high: b(3) || b(5), // Y / RB
    mid: b(2) || b(1), // X / B
    low: b(0) || b(4), // A / LB
    start: b(9),
  };
}

export const EMPTY_PAD = Object.freeze(Object.fromEntries(ACTIONS.map((a) => [a, false])));

export function mergePads(...pads) {
  const out = { ...EMPTY_PAD };
  for (const p of pads) if (p) for (const a of ACTIONS) out[a] ||= p[a];
  return out;
}

/** Combines a keyboard map and an optional gamepad into one per-tick pad. */
export class PadSource {
  constructor(keyboard, keymap, gamepadIndex = null) {
    this.keyboard = keyboard;
    this.keymap = keymap;
    this.gamepadIndex = gamepadIndex;
  }
  poll() {
    return mergePads(this.keymap && this.keyboard.read(this.keymap), this.gamepadIndex !== null && readGamepad(this.gamepadIndex));
  }
}
