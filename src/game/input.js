/**
 * Keyboard -> per-tick action snapshots.
 *
 * Uses KeyboardEvent.code (physical key position), so bindings work the same
 * on QWERTY/AZERTY/etc. and avoid browser keyCode quirks (e.g. ';' differs
 * between Firefox and Chrome).
 */
export const BINDINGS = {
  p1: { left: 'KeyA', right: 'KeyD', up: 'KeyW', block: 'KeyS', high: 'KeyR', mid: 'KeyF', low: 'KeyV' },
  p2: { left: 'KeyJ', right: 'KeyL', up: 'KeyI', block: 'KeyK', high: 'KeyP', mid: 'Semicolon', low: 'Slash' },
};

export class KeyboardInput {
  constructor(target = window) {
    this.target = target;
    this.held = new Set();
    this.pressed = new Set(); // went down since the last sim tick (never lose a quick tap)
    this.bound = new Set(Object.values(BINDINGS).flatMap((b) => Object.values(b)));

    this.onDown = (e) => {
      if (this.bound.has(e.code)) e.preventDefault(); // e.g. '/' = Firefox quick-find
      if (e.repeat) return;
      this.held.add(e.code);
      this.pressed.add(e.code);
    };
    this.onUp = (e) => this.held.delete(e.code);
    this.onBlur = () => this.held.clear(); // don't get stuck holding after alt-tab

    target.addEventListener('keydown', this.onDown);
    target.addEventListener('keyup', this.onUp);
    target.addEventListener('blur', this.onBlur);
  }

  /** Snapshot one player's actions for the current tick. */
  read(map) {
    const held = {};
    const pressed = {};
    for (const [action, code] of Object.entries(map)) {
      held[action] = this.held.has(code);
      pressed[action] = this.pressed.has(code);
    }
    return { held, pressed };
  }

  /** Call after every sim tick has read its input. */
  endTick() {
    this.pressed.clear();
  }

  destroy() {
    this.target.removeEventListener('keydown', this.onDown);
    this.target.removeEventListener('keyup', this.onUp);
    this.target.removeEventListener('blur', this.onBlur);
  }
}
