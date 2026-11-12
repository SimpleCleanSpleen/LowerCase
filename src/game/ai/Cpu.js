import { EMPTY_PAD } from '../input/devices.js';
import { hurtbox } from '../sim/boxes.js';

/**
 * CPU opponent. Produces the same pad input a human would, so it plays by the
 * exact same rules (motions, blocking, charging, special/throw/unique
 * buttons). Decisions use a human-ish reaction delay and some randomness.
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
    this.level = level;
    this.L = LEVELS[level];
    this.seed = seed;
    this.script = [];
    this.cooldown = 30;
    this.blockPlan = null;
    this.seenAttack = null;
  }

  rand() {
    this.seed = (this.seed * 1664525 + 1013904223) >>> 0;
    return this.seed / 4294967296;
  }

  /** Relative pad: fwd/back resolved to left/right using current facing. */
  pad(me, o = {}) {
    const p = { ...EMPTY_PAD };
    const right = me.facing > 0;
    if (o.fwd) p[right ? 'right' : 'left'] = true;
    if (o.back) p[right ? 'left' : 'right'] = true;
    for (const k of ['up', 'down', 'high', 'mid', 'low', 'special', 'throw', 'unique']) p[k] = !!o[k];
    return p;
  }

  queue(frames) {
    this.script.push(...frames);
  }

  dp(me, btn = 'high') {
    const f = (o) => this.pad(me, o);
    this.queue([f({ fwd: true }), f({ fwd: true }), f({ down: true }), f({ down: true }), f({ down: true, fwd: true }), f({ down: true, fwd: true, [btn]: true }), f({ [btn]: true })]);
    return this.script.shift();
  }

  press(me, btn, hold = 2, extra = {}) {
    for (let i = 0; i < hold; i++) this.queue([this.pad(me, { [btn]: true, ...extra })]);
    this.queue([this.pad(me, extra)]);
    return this.script.shift();
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
    const sp1 = me.def.moves.sp1;
    const uq = me.def.moves.unique;
    if (this.cooldown > 0) this.cooldown--;

    // --- defense: notice an incoming attack after a reaction delay
    const oppThreat = opp.state === 'attack' && opp.phase !== 'recovery' && !!opp.move?.hitbox;
    const since = opp.phase === 'startup' ? opp.pf : (opp.move?.startup ?? 0) + opp.pf;
    if (oppThreat && this.seenAttack !== opp.now - since) {
      this.seenAttack = opp.now - since;
      const guard = opp.move?.guard ?? 'mid';
      const right = this.rand() < L.guessHeight;
      const low = guard === 'low' ? right : guard === 'high' ? !right : this.rand() < 0.5;
      // Herc gambles on a perfectly timed counter now and then
      if (uq.kind === 'counter' && me.actionable && dist < 110 && opp.phase === 'startup' && this.rand() < 0.05 + 0.04 * this.level) {
        const wait = Math.max(0, (opp.move?.startup ?? 8) - opp.pf - 4);
        this.script.length = 0;
        this.queue([...Array(wait).fill(EMPTY_PAD), this.pad(me, { unique: true }), EMPTY_PAD]);
        this.blockPlan = null;
        return this.script.shift();
      }
      this.blockPlan = this.rand() < L.block ? { from: opp.now + Math.max(0, L.react - since), until: opp.now + 40, low } : null;
    }
    const projIncoming = m.projectiles.some((p) => p.owner === opp && Math.abs(p.x - me.x) < 120);
    const planLive = this.blockPlan && opp.now >= this.blockPlan.from && opp.now < this.blockPlan.until && opp.state === 'attack';
    if ((planLive || (projIncoming && this.rand() < L.block + 0.2)) && (me.actionable || me.state === 'blockstun') && !this.script.some((f) => f.unique)) {
      this.script.length = 0;
      return this.pad(me, { back: true, down: this.blockPlan?.low ?? false });
    }
    if (me.state === 'blockstun') return this.pad(me, { back: true, down: me.crouching });
    if (this.script.length) return this.script.shift();

    // --- anti-air
    if (!opp.grounded && opp.state !== 'launch' && dist < 110 && opp.vy > -200 && me.actionable && this.cooldown === 0) {
      this.cooldown = 30;
      if (this.rand() < L.antiAir) return this.dp(me);
      return this.pad(me, { back: true });
    }

    // --- hit confirm: cancel a connected normal into a special
    if (me.state === 'attack' && me.contact === 'hit' && (me.moveId === 'low' || me.moveId === 'mid') && this.rand() < L.confirm) {
      if (sp1.kind === 'rush' && dist < 90) return this.press(me, 'special');
      return this.dp(me, 'mid');
    }

    if (!me.actionable) return EMPTY_PAD;

    // --- whiff punish
    const reach = this.reach(me, opp);
    const recoveryLeft = opp.state === 'attack' && opp.phase === 'recovery' ? (opp.move?.recovery ?? 0) - opp.pf : 0;
    if (recoveryLeft > 8 && (!opp.contact || opp.contact === 'block') && this.rand() < L.confirm) {
      if (dist < reach.max) return this.press(me, reach.high > dist ? 'high' : 'mid');
      if (dist < reach.max + 70 && sp1.kind === 'rush') return this.press(me, 'special');
    }
    if (opp.state === 'down' || opp.state === 'getup') {
      if (uq.kind === 'buff' && !me.buff && this.rand() < 0.4) return this.press(me, 'unique');
      return dist > reach.max ? this.pad(me, { fwd: true }) : EMPTY_PAD;
    }

    // --- offense / spacing
    const ideal = Math.max(36, reach.max - 18);
    if (this.cooldown > 0) return dist > ideal + 10 ? this.pad(me, { fwd: true }) : EMPTY_PAD;
    this.cooldown = 10 + Math.floor(this.rand() * 25 * (1.2 - L.aggression));
    const r = this.rand();
    const zoned = m.projectiles.some((p) => p.owner === opp);

    // character tools
    if (sp1.kind === 'projectile' && dist > 150 && !m.hasProjectile(me) && r < 0.3) return this.press(me, 'special');
    if (sp1.kind === 'strike' && dist > 95 && dist < 150 && !m.hasProjectile(me) && r < 0.35) return this.press(me, 'special');
    if (sp1.kind === 'rush' && dist > 90 && dist < 200 && (zoned ? r < 0.6 : r < 0.2 + L.aggression * 0.15)) return this.press(me, 'special');
    if (uq.kind === 'vault' && (zoned || (dist > 110 && dist < 190)) && r < 0.12) return this.press(me, 'unique');
    if (uq.kind === 'step' && dist < 100 && dist > 40 && r < 0.1) return this.press(me, 'unique');
    if (uq.kind === 'buff' && !me.buff && dist > 160 && r < 0.25) return this.press(me, 'unique');

    if (dist < 60 && r < 0.18 && me.canThrow(opp)) return this.press(me, 'throw');
    if (dist < this.reach(opp, me).max + 25 && r < L.block * 0.45) {
      const low = this.rand() < 0.45;
      this.queue(Array(14 + Math.floor(this.rand() * 18)).fill(this.pad(me, { back: true, down: low })));
      return this.script.shift();
    }
    const inRange = ['low', 'mid', 'high'].filter((k) => dist <= reach[k]);
    if (inRange.length && r < 0.5 + L.aggression * 0.4) {
      const btn = inRange[Math.floor(this.rand() * inRange.length)];
      const hold = this.rand() < 0.25 ? 6 + Math.floor(this.rand() * 25) : 2;
      return this.press(me, btn, hold, btn === 'low' ? { down: true } : {});
    }
    if (dist > 110 && dist < 190 && r < 0.1) {
      this.queue([this.pad(me, { up: true, fwd: true }), this.pad(me, { fwd: true }), ...Array(18).fill(EMPTY_PAD), this.pad(me, { high: true }), EMPTY_PAD]);
      return this.script.shift();
    }
    if (dist > ideal + 40 && r < 0.35) {
      const f = this.pad(me, { fwd: true });
      this.queue([f, f, EMPTY_PAD, EMPTY_PAD, f, ...Array(16).fill(EMPTY_PAD)]);
      return this.script.shift();
    }
    if (dist > ideal) {
      this.queue(Array(8 + Math.floor(this.rand() * 14)).fill(this.pad(me, { fwd: true })));
      return this.script.shift();
    }
    if (r < 0.3) {
      this.queue(Array(6 + Math.floor(this.rand() * 10)).fill(this.pad(me, { back: true })));
      return this.script.shift();
    }
    return EMPTY_PAD;
  }

  reach(me, opp) {
    const hb = hurtbox(opp);
    const half = hb ? hb.w / 2 : 22;
    const r = (id) => me.def.moves[id].hitbox.x + me.def.moves[id].hitbox.w / 2 + half - 4;
    return { low: r('low'), mid: r('mid'), high: r('high'), max: Math.max(r('low'), r('mid'), r('high')) };
  }
}
