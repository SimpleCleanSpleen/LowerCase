import { GAME_WIDTH, MAX_SEPARATION, ROUND_SECONDS, ROUNDS_TO_WIN, SIM_HZ, STAGE_WIDTH } from '../constants.js';
import { EMPTY_PAD } from '../input/devices.js';
import { ACTIONABLE, FighterSim } from './FighterSim.js';
import { hitbox, hurtbox, overlaps, pushbox } from './boxes.js';

const DT = 1 / SIM_HZ;
const COMBO_SCALE = [1, 1, 0.85, 0.75, 0.65, 0.55, 0.5];
const START_GAP = 150;

/**
 * The whole fight simulation: two fighters, projectiles, hit resolution,
 * hitstop, pushboxes, stage bounds, timer and round flow. Deterministic and
 * Phaser-free; the scene feeds it pads and reads `events` back each tick.
 *
 * opts: { training: bool }
 */
export class Match {
  constructor(defA, defB, opts = {}) {
    this.training = !!opts.training;
    this.fighters = [new FighterSim(defA, 0), new FighterSim(defB, 1)];
    this.projectiles = [];
    this.events = [];
    this.wins = [0, 0];
    this.round = 0;
    this.tick = 0;
    this.hitstop = 0;
    this.shake = 0;
    this.slowmo = 0;
    this.advantage = null;
    this.pendingAdv = null;
    this.startRound();
  }

  // ------------------------------------------------------------- rounds --

  startRound() {
    this.round++;
    const mid = STAGE_WIDTH / 2;
    const [a, b] = this.fighters;
    a.reset(mid - START_GAP / 2, 1);
    b.reset(mid + START_GAP / 2, -1);
    this.projectiles = [];
    this.timer = ROUND_SECONDS * SIM_HZ;
    this.hitstop = 0;
    this.slowmo = 0;
    this.winner = null;
    this.phase = this.training ? 'fight' : 'intro';
    this.phaseT = 0;
  }

  setPhase(p) {
    this.phase = p;
    this.phaseT = 0;
  }

  get inputsLive() {
    return this.phase === 'fight';
  }

  // --------------------------------------------------------------- tick --

  /** Advance one 60 Hz tick. pads = [padP1, padP2]. */
  step(pads) {
    this.events.length = 0;
    this.tick++;
    this.phaseT++;
    const frozen = this.hitstop > 0;
    const live = this.inputsLive;
    this.fighters.forEach((f, i) => f.record(live ? pads[i] : EMPTY_PAD, frozen));

    if (this.shake > 0) this.shake--;
    this.flow();

    if (this.slowmo > 0) {
      this.slowmo--;
      if (this.slowmo % 3) return; // KO slow motion: simulate every third tick
    }
    if (frozen) {
      this.hitstop--;
      return;
    }

    const [a, b] = this.fighters;
    a.step(b, this);
    b.step(a, this);
    this.stepProjectiles();
    this.resolvePush();
    this.resolveHits();
    this.trackAdvantage();
    if (this.training) this.trainingRefill();
  }

  flow() {
    const [a, b] = this.fighters;
    switch (this.phase) {
      case 'intro':
        if (this.phaseT === 1) {
          const final = this.wins[0] === ROUNDS_TO_WIN - 1 && this.wins[1] === ROUNDS_TO_WIN - 1;
          this.emit({ type: 'announce', text: final ? 'FINAL ROUND' : `ROUND ${this.round}` });
        }
        if (this.phaseT === 60) this.emit({ type: 'announce', text: 'FIGHT!' });
        if (this.phaseT >= 80) this.setPhase('fight');
        break;
      case 'fight':
        if (this.training) break;
        if (a.hp <= 0 || b.hp <= 0) {
          this.setPhase('ko');
          this.slowmo = 75;
          this.shake = 20;
          this.emit({ type: 'announce', text: 'K.O.', big: true });
          this.emit({ type: 'ko' });
        } else if (this.hitstop === 0 && --this.timer <= 0) {
          this.timer = 0;
          this.setPhase('ko');
          this.emit({ type: 'announce', text: 'TIME', big: true });
        }
        break;
      case 'ko': {
        const settled = this.fighters.every((f) => f.grounded && !['launch', 'attack', 'hitstun', 'blockstun', 'throw', 'thrown'].includes(f.state));
        if (this.phaseT > 100 && (settled || this.phaseT > 260)) this.endRound();
        break;
      }
      case 'roundEnd':
        if (this.phaseT >= 150) {
          if (this.wins.some((w) => w >= ROUNDS_TO_WIN)) {
            this.setPhase('over');
            this.emit({ type: 'matchOver', winner: this.matchWinner });
          } else this.startRound();
        }
        break;
      default:
        break;
    }
  }

  endRound() {
    const [a, b] = this.fighters;
    const ra = a.hp / a.def.maxHp;
    const rb = b.hp / b.def.maxHp;
    let w = null;
    if (ra > rb) w = 0;
    else if (rb > ra) w = 1;
    this.winner = w;
    this.setPhase('roundEnd');
    if (w === null) {
      this.emit({ type: 'announce', text: 'DRAW' });
      return;
    }
    this.wins[w]++;
    const f = this.fighters[w];
    if (f.state !== 'ko') {
      f.move = null;
      f.setState('win');
    }
    const perfect = f.hp === f.def.maxHp;
    this.emit({ type: 'announce', text: `${f.def.displayName.toUpperCase()} WINS`, sub: perfect ? 'PERFECT' : null });
  }

  get matchWinner() {
    return this.wins[0] >= ROUNDS_TO_WIN ? 0 : this.wins[1] >= ROUNDS_TO_WIN ? 1 : null;
  }

  emit(e) {
    this.events.push(e);
  }

  // -------------------------------------------------------- world queries --

  /** Something dangerous is coming: lets "hold back" become a guard stance. */
  threatTo(f) {
    const opp = this.fighters[1 - f.side];
    if (opp.state === 'attack' && opp.phase !== 'recovery' && Math.abs(opp.x - f.x) < 170) return true;
    return this.projectiles.some((p) => p.owner !== f && Math.abs(p.x - f.x) < 150 && Math.sign(f.x - p.x) === Math.sign(p.vx));
  }

  hasProjectile(f) {
    return this.projectiles.some((p) => p.owner === f);
  }

  spawnProjectile(f, m) {
    const P = m.projectile;
    this.projectiles.push({
      owner: f, move: m,
      x: f.x + f.facing * P.x, y: f.y + P.y, w: P.w, h: P.h,
      vx: f.facing * P.speed, age: 0,
    });
    this.emit({ type: 'projectile', fighter: f });
  }

  // ------------------------------------------------------------- physics --

  stepProjectiles() {
    const cam = this.cameraX();
    for (const p of this.projectiles) {
      p.x += p.vx * DT;
      p.age++;
      if (p.x < cam - 40 || p.x > cam + GAME_WIDTH + 40) p.dead = true;
    }
    // projectiles cancel each other out
    for (const p of this.projectiles)
      for (const q of this.projectiles)
        if (p !== q && p.owner !== q.owner && !p.dead && !q.dead && overlaps(projBox(p), projBox(q))) {
          p.dead = q.dead = true;
          this.emit({ type: 'clash', x: (p.x + q.x) / 2, y: p.y });
        }
    this.projectiles = this.projectiles.filter((p) => !p.dead);
  }

  resolvePush() {
    const [a, b] = this.fighters;
    for (const f of this.fighters) {
      const half = f.def.boxes.push.w / 2;
      f.x = Math.min(Math.max(f.x, half), STAGE_WIDTH - half);
    }
    if (a.state !== 'thrown' && b.state !== 'thrown') {
      const pa = pushbox(a);
      const pb = pushbox(b);
      if (overlaps(pa, pb)) {
        const overlap = (pa.w + pb.w) / 2 - Math.abs(a.x - b.x);
        const dir = Math.sign(b.x - a.x) || (a.facing > 0 ? 1 : -1);
        a.x -= (dir * overlap) / 2;
        b.x += (dir * overlap) / 2;
        for (const [f, o] of [[a, b], [b, a]]) {
          const half = f.def.boxes.push.w / 2;
          const clamped = Math.min(Math.max(f.x, half), STAGE_WIDTH - half);
          if (clamped !== f.x) {
            o.x += clamped - f.x;
            f.x = clamped;
          }
        }
      }
    }
    // keep both fighters on screen
    const d = b.x - a.x;
    if (Math.abs(d) > MAX_SEPARATION) {
      const excess = (Math.abs(d) - MAX_SEPARATION) / 2;
      a.x += Math.sign(d) * excess;
      b.x -= Math.sign(d) * excess;
    }
  }

  // ----------------------------------------------------------------- hits --

  resolveHits() {
    const hits = [];
    for (const atk of this.fighters) {
      if (atk.contact || atk.state !== 'attack') continue;
      const def = this.fighters[1 - atk.side];
      if (def.strikeInvulnerable()) continue;
      const hb = hitbox(atk);
      if (overlaps(hb, hurtbox(def))) hits.push({ atk, def, hb, move: atk.move, damage: atk.currentDamage(), full: atk.fullyCharged });
    }
    for (const p of this.projectiles) {
      const def = this.fighters[1 - p.owner.side];
      if (p.dead || def.strikeInvulnerable()) continue;
      if (def.state === 'attack' && def.phase === 'active' && def.move.projInvuln) continue; // e.g. Bull Rush plows through
      if (overlaps(projBox(p), hurtbox(def))) {
        p.dead = true;
        hits.push({ atk: p.owner, def, move: p.move, damage: p.move.baseDamage, projectile: p });
      }
    }
    this.projectiles = this.projectiles.filter((p) => !p.dead);
    for (const h of hits) this.applyHit(h);
  }

  applyHit({ atk, def, hb, move, damage, full, projectile }) {
    const src = projectile ?? atk;
    const dir = Math.sign(def.x - src.x) || atk.facing;
    const nearWall = def.x < 40 || def.x > STAGE_WIDTH - 40;
    const blocked = def.blocks(src, projectile ? 'mid' : move.guard);
    if (!projectile) atk.contact = blocked ? 'block' : 'hit';
    const x = projectile ? projectile.x : (hb.x + hb.w / 2 + def.x) / 2;
    const y = projectile ? projectile.y : hb.y + hb.h / 2;

    if (blocked) {
      def.takeBlock({ blockstun: move.blockstun, dir, push: move.pushBlock, chip: move.chip });
      if (nearWall && !projectile && atk.grounded) {
        atk.slide = move.pushBlock;
        atk.slideDir = -dir;
      }
      this.hitstop = Math.max(this.hitstop, 7);
      this.emit({ type: 'block', x, y, attacker: atk, defender: def });
    } else {
      const scaled = Math.max(1, Math.round(damage * COMBO_SCALE[Math.min(def.comboHits, COMBO_SCALE.length - 1)]));
      const knock = move.knockdown || full;
      const launch = move.launch ?? (knock ? { vx: 110, vy: -320 } : null);
      const chargeBonus = move.maxCharge ? Math.round((atk.charge / move.maxCharge) * 6) : 0;
      def.takeHit({ damage: scaled, hitstun: move.hitstun + chargeBonus, launch, dir, push: move.pushHit });
      if (nearWall && !projectile && atk.grounded) {
        atk.slide = move.pushHit;
        atk.slideDir = -dir;
      }
      const heavy = scaled >= 16 || full || def.hp <= 0;
      this.hitstop = Math.max(this.hitstop, Math.min(16, 8 + Math.floor(scaled / 3)));
      if (heavy) this.shake = Math.max(this.shake, 10);
      this.emit({ type: 'hit', x, y, attacker: atk, defender: def, damage: scaled, heavy, combo: def.comboHits });
    }
    this.pendingAdv = { atk, def };
  }

  applyThrow(atk, def, T, dir) {
    def.takeHit({ damage: T.damage, hitstun: 0, launch: { vx: T.launch.vx, vy: T.launch.vy }, dir, push: 0 });
    this.hitstop = 8;
    this.shake = 8;
    this.emit({ type: 'hit', x: def.x, y: def.y - 40, attacker: atk, defender: def, damage: T.damage, heavy: true, combo: 1 });
  }

  /** Training readout: frame advantage after the last contact. */
  trackAdvantage() {
    const p = this.pendingAdv;
    if (!p) return;
    if (ACTIONABLE.has(p.atk.state) && ACTIONABLE.has(p.def.state)) {
      this.advantage = p.def.actionableAt - p.atk.actionableAt;
      this.pendingAdv = null;
    } else if (['down', 'launch', 'ko'].includes(p.def.state)) {
      this.advantage = 'KD';
      this.pendingAdv = null;
    }
  }

  trainingRefill() {
    for (const f of this.fighters) {
      if (f.actionable && f.now - f.actionableAt > 60 && f.hp < f.def.maxHp) f.hp = f.def.maxHp;
    }
  }

  /** Camera left edge (world x) following the fighters' midpoint. */
  cameraX() {
    const [a, b] = this.fighters;
    const mid = (a.x + b.x) / 2;
    return Math.min(Math.max(mid - GAME_WIDTH / 2, 0), STAGE_WIDTH - GAME_WIDTH);
  }

  get secondsLeft() {
    return Math.ceil(this.timer / SIM_HZ);
  }
}

export function projBox(p) {
  return { x: p.x - p.w / 2, y: p.y - p.h / 2, w: p.w, h: p.h };
}

