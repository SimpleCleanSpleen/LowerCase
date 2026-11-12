import { FLOOR_Y, GAME_WIDTH, SIM_HZ } from '../constants.js';

const DT = 1 / SIM_HZ;

/** Attack buttons in priority order (if several are pressed on one tick). */
export const ATTACKS = ['high', 'mid', 'low'];

/**
 * Pure game-logic fighter: no Phaser, no rendering, advanced exactly once per
 * fixed 60 Hz tick. Keeping logic separate from the sprite makes it
 * deterministic and testable, and leaves the door open for rollback netcode.
 *
 * Coordinates: x = horizontal center, y = feet (screen space, +y is down).
 *
 * States
 *   idle | walk | air                         neutral, can act
 *   attack  (phase: startup -> active -> recovery)
 *   blockStartup -> block -> blockRecovery
 *
 * Frame counting: `pf` = frames spent in the current state/phase *including
 * the current tick*. A 10f startup occupies exactly 10 ticks, and the first
 * active frame is tick 11 after the button press.
 *
 * Charging: if the attack button is still held when startup finishes, the
 * fighter stays in startup, gaining 1 charge per tick, until the button is
 * released or charge hits maxCharge. Damage scales linearly from baseDamage
 * (tap, 0 charge) to maxDamage (full charge). Releasing during the normal
 * startup does not cancel the attack; it just fires uncharged.
 */
export class FighterSim {
  constructor(def, { x, facing }) {
    this.def = def;
    this.spawn = { x, facing };
    this.reset();
  }

  reset() {
    this.x = this.spawn.x;
    this.y = FLOOR_Y;
    this.vx = 0;
    this.vy = 0;
    this.facing = this.spawn.facing;
    this.state = 'idle';
    this.phase = null;
    this.pf = 0;
    this.moveId = null;
    this.move = null;
    this.charge = 0;
    this.chargeLatch = false;
    this.hasHit = false;
    this.airAttackUsed = false;
    this.damageTaken = 0;
    this.flash = 0; // render-only hit feedback timer
    this.flashBlocked = false;
  }

  get grounded() {
    return this.y >= FLOOR_Y && this.vy >= 0;
  }
  get isBlocking() {
    return this.state === 'block';
  }
  /** "Center point" for hitbox offsets: middle of the hurtbox. */
  get centerY() {
    return this.y - this.def.hurtbox.h / 2;
  }
  get isNeutral() {
    return this.state === 'idle' || this.state === 'walk' || this.state === 'air';
  }

  /** Damage this attack would deal right now. */
  currentDamage() {
    const m = this.move;
    if (!m) return 0;
    return Math.round(m.baseDamage + ((m.maxDamage - m.baseDamage) * this.charge) / m.maxCharge);
  }

  /**
   * Advance one tick.
   * @param {{held: Record<string, boolean>, pressed: Record<string, boolean>}} input
   * @param {FighterSim} opponent
   */
  step(input, opponent) {
    if (this.flash > 0) this.flash--;

    if (this.state === 'attack') this.tickAttack(input);
    else if (!this.isNeutral) this.tickBlock(input);

    // A state that just ended falls through, so there's no dead frame.
    if (this.isNeutral) this.tickNeutral(input, opponent);

    this.integrate();
  }

  // ---------------------------------------------------------------- states --

  setState(state, phase = null) {
    this.state = state;
    this.phase = phase;
    this.pf = 0;
  }

  tickNeutral(input, opp) {
    const { held, pressed } = input;
    const attack = ATTACKS.find((a) => pressed[a]);

    if (!this.grounded) {
      if (attack && !this.airAttackUsed) {
        this.airAttackUsed = true;
        this.startAttack(attack, input);
      }
      return;
    }

    if (opp.x !== this.x) this.facing = opp.x > this.x ? 1 : -1;

    if (attack) return this.startAttack(attack, input);

    if (held.block) {
      this.vx = 0;
      this.setState('blockStartup');
      return this.tickBlock(input);
    }

    const dir = (held.right ? 1 : 0) - (held.left ? 1 : 0);
    this.vx = dir * this.def.physics.walkSpeed;

    if (held.up || pressed.up) {
      this.vy = this.def.physics.jumpVelocity; // keeps vx: jump arcs the way you walked
      this.airAttackUsed = false;
      this.setState('air');
      return;
    }

    const next = dir ? 'walk' : 'idle';
    if (this.state !== next) this.setState(next);
  }

  startAttack(id, input) {
    this.moveId = id;
    this.move = this.def.moves[id];
    this.charge = 0;
    this.chargeLatch = true;
    this.hasHit = false;
    if (this.grounded) this.vx = 0;
    this.setState('attack', 'startup');
    this.tickAttack(input); // the press tick is startup frame 1
  }

  tickAttack(input) {
    const m = this.move;
    if (this.chargeLatch && !input.held[this.moveId]) this.chargeLatch = false;

    if (this.phase === 'startup') {
      if (this.pf < m.startup) return void this.pf++;
      if (this.chargeLatch && this.charge < m.maxCharge) return void this.charge++;
      this.setState('attack', 'active');
    }
    if (this.phase === 'active') {
      if (this.pf < m.active) return void this.pf++;
      this.setState('attack', 'recovery');
    }
    if (this.phase === 'recovery') {
      if (this.pf < m.recovery) return void this.pf++;
      this.move = null;
      this.moveId = null;
      this.setState(this.grounded ? 'idle' : 'air');
    }
  }

  tickBlock(input) {
    const b = this.def.block;
    const held = input.held.block;

    if (this.state === 'blockStartup') {
      if (!held) this.setState('blockRecovery');
      else if (this.pf < b.startup) return void this.pf++;
      else this.setState('block');
    }
    if (this.state === 'block') {
      if (held) return void this.pf++;
      this.setState('blockRecovery');
    }
    if (this.state === 'blockRecovery') {
      if (this.pf < b.recovery) return void this.pf++;
      this.setState('idle');
    }
  }

  // --------------------------------------------------------------- physics --

  integrate() {
    const { gravity } = this.def.physics;
    if (!this.grounded) this.vy += gravity * DT; // semi-implicit Euler
    this.x += this.vx * DT;
    this.y += this.vy * DT;

    if (this.y >= FLOOR_Y) {
      this.y = FLOOR_Y;
      if (this.vy > 0) {
        this.vy = 0;
        this.vx = 0;
        if (this.state === 'air') this.setState('idle');
      }
    }

    const half = this.def.hurtbox.w / 2;
    this.x = Math.min(Math.max(this.x, half), GAME_WIDTH - half);
  }
}
