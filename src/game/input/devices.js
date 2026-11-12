/**
 * Input devices -> per-tick "pad" snapshots:
 *   { left, right, up, down, high, mid, low, special, throw, unique, start }
 *
 * One keyboard (always player 1) plus any number of USB / Bluetooth
 * controllers via the browser Gamepad API. Controller buttons are mapped by
 * POSITION, so the layout is the same on Xbox, PlayStation and Switch pads:
 *
 *        (top) HIGH
 *   (left) MID     (right) SPECIAL
 *        (bottom) LOW
 *   L bumper/trigger: THROW     R bumper/trigger: UNIQUE     Start: pause
 */

export const ACTIONS = ['left', 'right', 'up', 'down', 'high', 'mid', 'low', 'special', 'throw', 'unique', 'start'];

export const KEYMAP = {
  left: ['KeyA', 'ArrowLeft'], right: ['KeyD', 'ArrowRight'], up: ['KeyW', 'ArrowUp', 'Space'], down: ['KeyS', 'ArrowDown'],
  throw: ['KeyU'], high: ['KeyI'], unique: ['KeyO'],
  mid: ['KeyJ'], low: ['KeyK'], special: ['KeyL'],
  start: ['Enter', 'Escape'],
};

/** Standard Gamepad API button indices for each action (first match wins). */
export const PAD_BUTTONS = {
  low: [0], special: [1], mid: [2], high: [3], throw: [4, 6], unique: [5, 7], start: [9],
};

export const EMPTY_PAD = Object.freeze(Object.fromEntries(ACTIONS.map((a) => [a, false])));

export class Keyboard {
  constructor(target = window) {
    this.down = new Set();
    this.tapped = new Set(); // went down since last poll; quick taps are never lost
    this.target = target;
    this.onDown = (e) => {
      if (/^(Arrow|Space|Key[A-Z])/.test(e.code) && !e.ctrlKey && !e.metaKey) e.preventDefault();
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
  has(code) {
    return this.down.has(code) || this.tapped.has(code);
  }
  read(map = KEYMAP) {
    const pad = {};
    for (const a of ACTIONS) pad[a] = (map[a] ?? []).some((c) => this.has(c));
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

// ----------------------------------------------------------- controllers --

/** Which diagram/labels to show for a controller, from its id string. */
export function padType(id = '') {
  const s = id.toLowerCase();
  if (/045e|xbox|xinput|microsoft/.test(s)) return 'xbox';
  if (/054c|playstation|dualshock|dualsense|ps4|ps5|sony/.test(s)) return 'playstation';
  if (/057e|nintendo|pro controller|joy-con|switch/.test(s)) return 'switch';
  return 'generic';
}

export function connectedPads() {
  const out = [];
  for (const gp of navigator.getGamepads?.() ?? []) {
    if (gp && gp.connected) out.push({ index: gp.index, id: gp.id, type: padType(gp.id) });
  }
  return out;
}

/** Read one controller as a pad (null if not connected). */
export function readGamepad(index) {
  const gp = navigator.getGamepads?.()[index];
  if (!gp || !gp.connected) return null;
  const b = (i) => !!gp.buttons[i]?.pressed || (gp.buttons[i]?.value ?? 0) > 0.5;
  const ax = gp.axes[0] ?? 0;
  const ay = gp.axes[1] ?? 0;
  const pad = {
    left: b(14) || ax < -0.5,
    right: b(15) || ax > 0.5,
    up: b(12) || ay < -0.5,
    down: b(13) || ay > 0.5,
  };
  for (const [action, idx] of Object.entries(PAD_BUTTONS)) pad[action] = idx.some(b);
  pad.back = b(1);
  pad.select = b(8);
  return pad;
}

export function mergePads(...pads) {
  const out = { ...EMPTY_PAD };
  for (const p of pads) if (p) for (const a of ACTIONS) out[a] ||= !!p[a];
  return out;
}

/**
 * A player's input source: optionally the keyboard, plus controllers.
 * pads: array of gamepad indices, or 'all' (every connected controller).
 */
export class PadSource {
  constructor(keyboard, { keyboard: useKeyboard = false, pads = [] } = {}) {
    this.keyboard = keyboard;
    this.useKeyboard = useKeyboard;
    this.pads = pads;
  }
  padIndices() {
    return this.pads === 'all' ? connectedPads().map((p) => p.index) : this.pads;
  }
  connected() {
    return this.useKeyboard || this.padIndices().some((i) => readGamepad(i));
  }
  poll() {
    return mergePads(this.useKeyboard && this.keyboard.read(), ...this.padIndices().map(readGamepad));
  }
}

/** Default device setup for single-player modes: keyboard + every controller. */
export const SOLO_DEVICES = { p1: { keyboard: true, pads: 'all' }, p2: { keyboard: false, pads: [] } };
