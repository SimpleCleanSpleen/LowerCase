import { EMPTY_PAD } from '../input/devices.js';
import { hurtbox } from '../sim/boxes.js';

/**
 * CPU opponent. Produces the same pad input a human would, so it plays by the
 * exact same rules (motion inputs, blocking, charging). Decisions are made
 * with a human-ish reaction delay and some randomness.
 *
 * level: 0 = easy, 1 = normal, 2 = hard
 */
const LEVELS = [
  { react: 20, block: 0.35, guessHeight: 0.4, antiAir: 0.15, aggression: 0.35, confirm: 0.2 },
  { react: 13, block: 0.6, guessHeight: 0.7, antiAir: 0.4, aggression: 0.55, confirm: 0.55 },
  { react: 8, block: 0.85, guessHeight: 0.9, antiAir: 0.7, aggression: 0.7, confirm: 0.9 },
];

export class Cpu {
  constructor(match, side, level = 1, seed = 1234) {
    this.match = match;
    this.side = side;
    this.L = LEVELS[level];
    this.seed = seed;
    this.script = []; // queued pad frames
    this.cooldown = 30;
    this.blockPlan = null; // { until, low }
    this.seenAttack = null;
  }

  rand() {
    this.seed = (this.seed * 1664525 + 1013904223) >>> 0;
    return this.seed / 4294967296;
  }

  /** Relative pad: fwd/back resolved to left/right using current facing. */
  pad(me, { fwd, back, up, down, high, mid, low } = {}) {
    const p = { ...EMPTY_PAD };
    const right = me.facing > 0;
    if (fwd) p[right ? 'right' : 'left'] = true;
    if (back) p[right ? 'left' : 'right'] = true;
    p.up = !!up;
    p.down = !!down;
    p.high = !!high;
    p.mid = !!mid;
    p.low = !!low;
    return p;
  }

  queue(frames) {
    this.script.push(...frames);
  }

  motion(me, kind, btn) {
    const f = (o) => this.pad(me, o);
    if (kind === 'qcf') this.queue([f({ down: true }), f({ down: true }), f({ down: true, fwd: true }), f({ down: true, fwd: true }), f({ fwd: true }), f({ fwd: true, [btn]: true }), f({ fwd: true, [btn]: true })]);
    else this.queue([f({ fwd: true }), f({ fwd: true }), f({ down: true }), f({ down: true }), f({ down: true, fwd: true }), f({ down: true, fwd: true, [btn]: true }), f({ [btn]: true })]);
  }

  press(me, btn, hold = 2, extra = {}) {
    for (let i = 0; i < hold; i++) this.queue([this.pad(me, { [btn]: true, ...extra })]);
    this.queue([this.pad(me, extra)]);
  }

  poll() {
    const m = this.match;
    const me = m.fighters[this.side];
    const opp = m.fighters[1 - this.side];
    if (!m.inputsLive) {
      this.script.length = 0;
      return EMPTY_PAD;
    }
    const dist = Math.abs(opp.x - me.x);
    const L = this.L;
    if (this.cooldown > 0) this.cooldown--;

    // --- defense: notice an incoming attack after a reaction delay
    const oppThreat = opp.state === 'attack' && opp.phase !== 'recovery';
    const since = opp.phase === 'startup' ? opp.pf : (opp.move?.startup ?? 0) + opp.pf;
    if (oppThreat && this.seenAttack !== opp.now - since) {
      this.seenAttack = opp.now - since; // identifies this particular attack
      const willBlock = this.rand() < L.block;
      const guard = opp.move?.guard ?? 'mid';
      const right = this.rand() < L.guessHeight;
      const low = guard === 'low' ? right : guard === 'high' ? !right : this.rand() < 0.5;
      this.blockPlan = willBlock ? { from: opp.now + Math.max(0, L.react - since), until: opp.now + 40, low } : null;
    }
    const projIncoming = m.projectiles.some((p) => p.owner === opp && Math.abs(p.x - me.x) < 120);
    if ((this.blockPlan && opp.now >= this.blockPlan.from && opp.now < this.blockPlan.until && (oppThreat || opp.state === 'attack')) || (projIncoming && this.rand() < L.block + 0.2)) {
      if (me.actionable || me.state === 'blockstun') {
        this.script.length = 0;
        return this.pad(me, { back: true, down: this.blockPlan?.low ?? false });
      }
    }
    if (me.state === 'blockstun') return this.pad(me, { back: true, down: me.crouching });
    if (this.script.length) return this.script.shift();

    // --- anti-air: opponent jumping at us
    if (!opp.grounded && opp.state !== 'launch' && dist < 110 && opp.vy > -200 && me.actionable && this.cooldown === 0) {
      this.cooldown = 30;
      if (this.rand() < L.antiAir) {
        this.motion(me, 'dp', 'high');
        return this.script.shift();
      }
      return this.pad(me, { back: true });
    }

    // --- hit confirm: cancel a connected normal into a special
    if (me.state === 'attack' && me.contact === 'hit' && me.moveId in { low: 1, mid: 1 } && this.rand() < L.confirm) {
      const sp = me.def.id === 'herc' ? (dist < 70 ? 'dp' : 'qcf') : 'dp';
      this.motion(me, sp, 'mid');
      return this.script.shift();
    }

    if (!me.actionable) return EMPTY_PAD;

    // --- whiff punish: opponent is stuck in recovery of a move that missed
    if (opp.state === 'attack' && opp.phase === 'recovery' && !opp.contact && this.rand() < L.confirm) {
      const reach = this.reach(me, opp).max;
      if (dist < reach) {
        this.press(me, me.def.id === 'herc' ? 'high' : 'mid', 2);
        return this.script.shift();
      }
      if (dist < reach + 70 && me.def.id === 'herc') {
        this.motion(me, 'qcf', 'high');
        return this.script.shift();
      }
    }
    if (opp.state === 'down' || opp.state === 'getup') return dist > 70 ? this.pad(me, { fwd: true }) : EMPTY_PAD;

    // --- offense / spacing
    if (this.cooldown > 0) return dist > this.idealRange(me) + 10 ? this.pad(me, { fwd: true }) : EMPTY_PAD;
    this.cooldown = 10 + Math.floor(this.rand() * 25 * (1.2 - L.aggression));
    const r = this.rand();
    const reach = this.reach(me, opp);

    if (me.def.id === 'bella' && dist > 150 && !m.hasProjectile(me) && r < 0.3) {
      this.motion(me, 'qcf', 'mid');
      return this.script.shift();
    }
    if (dist < this.reach(opp, me).max + 25 && r < L.block * 0.45) {
      // anticipate: hold guard for a moment, guessing high or low
      const low = this.rand() < 0.45;
      this.queue(Array(14 + Math.floor(this.rand() * 18)).fill(this.pad(me, { back: true, down: low })));
      return this.script.shift();
    }
    const zoned = m.projectiles.some((p) => p.owner === opp);
    if (me.def.id === 'herc' && dist > 90 && dist < 200 && (zoned ? r < 0.7 : r < 0.25 + L.aggression * 0.2)) {
      this.motion(me, 'qcf', 'high');
      return this.script.shift();
    }
    if (dist < 60 && r < 0.2 && me.canThrow(opp)) {
      this.press(me, 'mid', 2, { fwd: true });
      return this.script.shift();
    }
    const inRange = ['low', 'mid', 'high'].filter((k) => dist <= reach[k]);
    if (inRange.length && r < 0.5 + L.aggression * 0.4) {
      const btn = inRange[Math.floor(this.rand() * inRange.length)];
      const hold = this.rand() < 0.25 ? 6 + Math.floor(this.rand() * 25) : 2; // sometimes charge
      this.press(me, btn, hold, btn === 'low' ? { down: true } : {});
      return this.script.shift();
    }
    if (dist > 110 && dist < 190 && r < (me.def.id === 'herc' ? 0.12 : 0.06)) {
      this.queue([this.pad(me, { up: true, fwd: true }), this.pad(me, { fwd: true })]);
      this.queue(Array(18).fill(this.pad(me, {})));
      this.queue([this.pad(me, { high: true }), this.pad(me, {})]);
      return this.script.shift();
    }
    if (dist > this.idealRange(me) + 40 && r < (me.def.id === 'herc' ? 0.6 : 0.2)) {
      const f = this.pad(me, { fwd: true });
      this.queue([f, f, EMPTY_PAD, EMPTY_PAD, f, ...Array(16).fill(EMPTY_PAD)]);
      return this.script.shift();
    }
    if (dist > this.idealRange(me)) {
      this.queue(Array(8 + Math.floor(this.rand() * 14)).fill(this.pad(me, { fwd: true })));
      return this.script.shift();
    }
    if (r < 0.3) {
      this.queue(Array(6 + Math.floor(this.rand() * 10)).fill(this.pad(me, { back: true })));
      return this.script.shift();
    }
    return EMPTY_PAD;
  }

  idealRange(me) {
    return me.def.id === 'bella' ? 90 : 42;
  }

  reach(me, opp) {
    const hb = hurtbox(opp);
    const half = hb ? hb.w / 2 : 22;
    const r = (id) => me.def.moves[id].hitbox.x + me.def.moves[id].hitbox.w / 2 + half - 4;
    return { low: r('low'), mid: r('mid'), high: r('high'), max: Math.max(r('low'), r('mid'), r('high')) };
  }
}
