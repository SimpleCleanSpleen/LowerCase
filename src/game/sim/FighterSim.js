import { FLOOR_Y, SIM_HZ } from '../constants.js';
import { InputBuffer } from '../input/InputBuffer.js';

const DT = 1 / SIM_HZ;

/** States in which the fighter accepts new commands. */
export const ACTIONABLE = new Set(['idle', 'walkF', 'walkB', 'crouch', 'guard']);
const BLOCK_CAPABLE = new Set(['idle', 'walkF', 'walkB', 'crouch', 'guard', 'blockstun']);
const CHAIN_RANK = { low: 0, mid: 1, high: 2 };
const KNOCKDOWN_FRAMES = 34;
const GETUP_FRAMES = 18;
const MAX_JUGGLE = 3;
const CANCEL_WINDOW = 8; // recovery frames during which a connected normal can cancel

/**
 * Pure game-logic fighter (no Phaser). Advanced once per fixed 60 Hz tick by
 * Match. x = horizontal center, y = feet, +y is down.
 *
 * Frame counting: `pf` is the frame number within the current state/phase,
 * starting at 1 on the tick the state is entered. "10f startup" = startup
 * frames 1..10; active frame 1 is the 11th tick after the press.
 */
export class FighterSim {
  constructor(def, side) {
    this.def = def;
    this.side = side; // 0 = P1, 1 = P2
    this.input = new InputBuffer();
    this.reset(0, 1);
  }

  reset(x, facing) {
    Object.assign(this, {
      x, y: FLOOR_Y, vx: 0, vy: 0, facing,
      hp: this.def.maxHp,
      state: 'idle', pf: 0, stun: 0, landingLag: 0,
      move: null, moveId: null, phase: null, charge: 0, chargeLatch: false, contact: null, spawned: false,
      airAttackUsed: false, crouching: false, jumpDir: 0,
      invuln: 0, slide: 0, slideDir: 0, juggle: 0,
      comboHits: 0, comboDamage: 0, flash: 0, flashBlocked: false,
      grabbed: null, thrownBy: null, throwBack: false,
      actionableAt: 0, now: 0,
    });
    this.input.clear();
  }

  // ------------------------------------------------------------ queries --

  get grounded() {
    return this.y >= FLOOR_Y && this.vy >= 0;
  }
  get actionable() {
    return ACTIONABLE.has(this.state);
  }
  get isCrouchBox() {
    if (!this.grounded) return false;
    if (this.state === 'attack') return !!this.move?.crouch;
    return this.crouching || this.state === 'jumpSquat' || this.state === 'land';
  }
  strikeInvulnerable() {
    return (
      this.invuln > 0 ||
      this.state === 'down' || this.state === 'getup' || this.state === 'thrown' || this.state === 'ko' ||
      (this.state === 'launch' && this.juggle >= MAX_JUGGLE)
    );
  }
  /** Damage this move would deal right now (before combo scaling). */
  currentDamage() {
    const m = this.move;
    if (!m) return 0;
    if (!m.maxCharge) return m.baseDamage;
    return Math.round(m.baseDamage + ((m.maxDamage - m.baseDamage) * this.charge) / m.maxCharge);
  }
  get fullyCharged() {
    return !!this.move?.maxCharge && this.charge >= this.move.maxCharge;
  }

  /** Is the fighter holding a valid guard against an attack from `atk`? */
  blocks(atk, guard) {
    if (!this.grounded || !BLOCK_CAPABLE.has(this.state)) return false;
    const towardAttacker = Math.sign(atk.x - this.x) || this.facing;
    const I = this.input;
    const away = towardAttacker === this.facing ? I.back : I.fwd;
    if (!away) return false;
    if (guard === 'high') return !I.down;
    if (guard === 'low') return I.down;
    return true;
  }

  // ------------------------------------------------------------- update --

  /** Record this tick's pad (every tick, even while frozen). */
  record(pad, frozen) {
    this.input.push(pad, this.facing, frozen);
  }

  step(opp, world) {
    this.now++;
    this.pf++;
    if (this.invuln > 0) this.invuln--;
    if (this.flash > 0) this.flash--;
    const P = this.def.physics;

    switch (this.state) {
      case 'jumpSquat':
        if (this.pf > P.jumpSquat) {
          this.setState('air');
          this.vy = P.jumpVelocity;
          this.vx = this.jumpDir * this.facing * P.jumpSpeed;
          this.airAttackUsed = false;
        }
        break;
      case 'air':
        this.tryAirAttack(world);
        break;
      case 'land':
        if (this.pf > this.landingLag) this.toNeutral(opp);
        break;
      case 'dashF':
      case 'dashB': {
        const D = this.def.physics[this.state];
        const t = this.pf / D.frames;
        this.vx = (this.state === 'dashF' ? 1 : -1) * this.facing * D.speed * (t < 0.7 ? 1 : 0.4);
        if (this.pf > D.frames) this.toNeutral(opp);
        break;
      }
      case 'attack':
        this.tickAttack(opp, world);
        break;
      case 'hitstun':
      case 'blockstun':
        if (this.state === 'blockstun') this.crouching = this.input.down;
        if (--this.stun <= 0) this.toNeutral(opp);
        break;
      case 'down':
        if (--this.stun <= 0) {
          this.setState('getup');
          this.stun = GETUP_FRAMES;
        }
        break;
      case 'getup':
        if (--this.stun <= 0) this.toNeutral(opp);
        break;
      case 'throw':
        this.tickThrow(opp, world);
        break;
      default:
        break;
    }

    if (this.actionable) this.tickNeutral(opp, world);
    this.integrate(world);
  }

  setState(s, keepPf = false) {
    if (this.state !== s || !keepPf) this.pf = 1;
    this.state = s;
  }

  toNeutral(opp) {
    this.move = null;
    this.moveId = null;
    this.phase = null;
    this.vx = 0;
    this.juggle = 0;
    this.comboHits = 0;
    this.comboDamage = 0;
    this.crouching = this.input.down;
    this.setState(this.crouching ? 'crouch' : 'idle');
    this.actionableAt = this.now;
    if (opp) this.face(opp);
  }

  face(opp) {
    if (opp.x !== this.x) this.facing = opp.x > this.x ? 1 : -1;
  }

  // ------------------------------------------------------------ neutral --

  tickNeutral(opp, world) {
    const I = this.input;
    const P = this.def.physics;
    this.face(opp);

    const press = I.peekPress();
    if (press) {
      I.consume(press);
      if (press.btn === 'mid' && (I.fwd || I.back) && this.canThrow(opp)) return this.startThrow(opp, I.back, world);
      return this.startMove(this.specialFor(press, world) ?? press.btn, world);
    }
    if (I.doubleTap(6) || I.doubleTap(4)) {
      const fwd = I.doubleTap(6);
      this.setState(fwd ? 'dashF' : 'dashB');
      this.crouching = false;
      if (!fwd && P.dashB.invuln) this.invuln = P.dashB.invuln;
      this.vx = (fwd ? 1 : -1) * this.facing * P[this.state].speed;
      world.emit({ type: 'dash', fighter: this });
      return;
    }
    if (I.up) {
      this.setState('jumpSquat');
      this.jumpDir = I.fwd ? 1 : I.back ? -1 : 0;
      this.vx = 0;
      this.crouching = false;
      return;
    }
    const threat = world.threatTo(this);
    if (I.down) {
      this.crouching = true;
      this.vx = 0;
      return this.setState(I.back && threat ? 'guard' : 'crouch', true);
    }
    this.crouching = false;
    if (I.fwd) {
      this.vx = this.facing * P.walkFwd;
      return this.setState('walkF', true);
    }
    if (I.back) {
      if (threat) {
        this.vx = 0;
        return this.setState('guard', true);
      }
      this.vx = -this.facing * P.walkBack;
      return this.setState('walkB', true);
    }
    this.vx = 0;
    this.setState('idle', true);
  }

  tryAirAttack(world) {
    if (this.airAttackUsed) return;
    const press = this.input.peekPress();
    if (!press) return;
    this.input.consume(press);
    this.airAttackUsed = true;
    this.startMove('air', world);
  }

  /** Special move id if a motion input preceded this press (DP beats QCF). */
  specialFor(press, world) {
    for (const id of ['sp2', 'sp1']) {
      const m = this.def.moves[id];
      if (!m || !this.input.motion(m.motion, press.index)) continue;
      if (m.kind === 'projectile' && world.hasProjectile(this)) continue;
      return id;
    }
    return null;
  }

  // ------------------------------------------------------------ attacks --

  startMove(id, world) {
    const m = this.def.moves[id];
    this.move = m;
    this.moveId = id;
    this.phase = 'startup';
    this.state = 'attack';
    this.pf = 1;
    this.charge = 0;
    this.chargeLatch = !!m.maxCharge && this.input.held(id);
    this.contact = null;
    this.spawned = false;
    if (this.grounded) {
      this.vx = 0;
      this.crouching = !!m.crouch;
    }
    if (m.invuln) this.invuln = m.invuln;
    world.emit({ type: 'startup', fighter: this, move: id });
  }

  tickAttack(opp, world) {
    const m = this.move;
    if (this.chargeLatch && !this.input.held(this.moveId)) this.chargeLatch = false;

    if (this.phase === 'startup') {
      if (this.pf <= m.startup) return;
      if (this.chargeLatch && this.charge < m.maxCharge) {
        this.charge++;
        this.pf = m.startup; // hold on the last startup frame while charging
        return;
      }
      this.phase = 'active';
      this.pf = 1;
      this.onActiveStart(world);
    }
    if (this.phase === 'active') {
      if (this.pf <= m.active) {
        if (m.kind === 'rush') this.vx = this.facing * m.speed;
        return this.tryCancel(opp, world);
      }
      this.phase = 'recovery';
      this.pf = 1;
      if (m.kind === 'rush') this.vx = 0;
    }
    if (this.phase === 'recovery') {
      if (m.kind === 'rise' && !this.grounded) {
        this.pf = 1; // falling; the landing lag is the real recovery
        return;
      }
      if (this.pf <= m.recovery) return this.tryCancel(opp, world);
      if (this.grounded) this.toNeutral(opp);
      else {
        this.move = null;
        this.setState('air');
      }
    }
  }

  onActiveStart(world) {
    const m = this.move;
    if (m.kind === 'rise') {
      this.vy = m.rise.vy;
      this.vx = this.facing * m.rise.vx;
    }
    if (m.kind === 'projectile' && !this.spawned) {
      this.spawned = true;
      world.spawnProjectile(this, m);
    }
    world.emit({ type: 'swing', fighter: this, heavy: this.fullyCharged || this.moveId === 'high' });
  }

  /** Normals that connected can cancel into a special or a stronger normal. */
  tryCancel(opp, world) {
    if (!this.contact || !(this.moveId in CHAIN_RANK)) return;
    if (this.phase === 'recovery' && this.pf > CANCEL_WINDOW) return;
    const press = this.input.peekPress();
    if (!press) return;
    const sp = this.specialFor(press, world);
    if (sp) {
      this.input.consume(press);
      return this.startMove(sp, world);
    }
    if (CHAIN_RANK[press.btn] > CHAIN_RANK[this.moveId]) {
      this.input.consume(press);
      this.startMove(press.btn, world);
    }
  }

  // ------------------------------------------------------------- throws --

  canThrow(opp) {
    if (!this.grounded || !opp.grounded || opp.invuln > 0) return false;
    const ok = opp.actionable || (opp.state === 'attack' && opp.phase === 'startup');
    if (!ok) return false;
    const gap = Math.abs(opp.x - this.x) - (this.def.boxes.push.w + opp.def.boxes.push.w) / 2;
    return gap <= this.def.boxes.throwRange;
  }

  startThrow(opp, back, world) {
    this.setState('throw');
    this.move = null;
    this.vx = 0;
    this.grabbed = opp;
    this.throwBack = back;
    opp.state = 'thrown';
    opp.pf = 1;
    opp.move = null;
    opp.vx = 0;
    opp.vy = 0;
    opp.thrownBy = this;
    world.emit({ type: 'grab', fighter: this });
  }

  tickThrow(opp, world) {
    const T = this.def.moves.throw;
    const t = this.grabbed;
    if (t && t.state === 'thrown') {
      const hold = this.facing * ((this.def.boxes.push.w + t.def.boxes.push.w) / 2 + 2);
      if (this.pf < T.releaseAt) {
        t.x = this.x + hold;
        t.y = FLOOR_Y - Math.min(10, this.pf);
      } else if (this.pf === T.releaseAt) {
        const dir = this.throwBack ? -this.facing : this.facing;
        if (this.throwBack) t.x = this.x - hold;
        world.applyThrow(this, t, T, dir);
        this.grabbed = null;
      }
    }
    if (this.pf >= T.duration) this.toNeutral(opp);
  }

  // ------------------------------------------------------- hit reactions --

  takeHit({ damage, hitstun, launch, dir, push }) {
    this.hp = Math.max(0, this.hp - damage);
    this.comboHits++;
    this.comboDamage += damage;
    this.move = null;
    this.moveId = null;
    this.phase = null;
    this.grabbed = null;
    this.flash = 8;
    this.flashBlocked = false;
    if (this.hp <= 0 || launch || !this.grounded) {
      const L = launch ?? { vx: 70, vy: -300 };
      this.launch(dir * L.vx, L.vy);
    } else {
      this.setState('hitstun');
      this.stun = hitstun;
      this.vx = 0;
    }
    this.slide = push;
    this.slideDir = dir;
  }

  takeBlock({ blockstun, dir, push, chip }) {
    this.hp = Math.max(1, this.hp - (chip ?? 0));
    this.setState('blockstun');
    this.stun = blockstun;
    this.crouching = this.input.down;
    this.vx = 0;
    this.flash = 8;
    this.flashBlocked = true;
    this.slide = push;
    this.slideDir = dir;
  }

  launch(vx, vy) {
    this.setState('launch');
    this.vx = vx;
    this.vy = vy;
    this.juggle++;
    this.crouching = false;
  }

  // ------------------------------------------------------------ physics --

  integrate(world) {
    if (this.state === 'thrown') return;
    const airborne = !this.grounded;
    if (airborne) this.vy += this.def.physics.gravity * DT;
    this.x += this.vx * DT;
    this.y += this.vy * DT;

    if (this.slide > 0) {
      const s = Math.min(this.slide, 2.5);
      this.x += this.slideDir * s;
      this.slide -= s;
    }

    if (this.y >= FLOOR_Y) {
      this.y = FLOOR_Y;
      if (airborne || this.vy > 0) {
        this.vy = 0;
        this.onLand(world);
      }
    }
  }

  onLand(world) {
    const P = this.def.physics;
    if (this.state === 'launch') {
      this.vx = 0;
      world.emit({ type: 'land', fighter: this, hard: true });
      if (this.hp <= 0) this.setState('ko');
      else {
        this.setState('down');
        this.stun = KNOCKDOWN_FRAMES;
      }
      return;
    }
    if (this.state === 'air' || (this.state === 'attack' && (this.moveId === 'air' || this.move?.kind === 'rise'))) {
      this.landingLag = this.move?.kind === 'rise' ? this.move.landing : P.landing;
      this.move = null;
      this.moveId = null;
      this.phase = null;
      this.vx = 0;
      this.crouching = false;
      this.setState('land');
      world.emit({ type: 'land', fighter: this });
    }
  }
}
