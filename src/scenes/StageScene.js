import Phaser from 'phaser';
import { Fighter } from '../game/Fighter.js';
import { FLOOR_Y, GAME_HEIGHT, GAME_WIDTH, PX_PER_FOOT, SIM_HZ } from '../game/constants.js';
import { BINDINGS, KeyboardInput } from '../game/input.js';
import { FighterSim } from '../game/sim/FighterSim.js';
import { hitbox, hurtbox, resolveHits } from '../game/sim/combat.js';

const TEXT = { fontFamily: 'monospace', fontSize: '8px', color: '#e8e8f0' };
const STEP_MS = 1000 / SIM_HZ;
const LOG_LINES = 5;

/**
 * Training stage: Herc (P1) vs Bella (P2).
 * Hotkeys: 1 = toggle boxes, 2/3 = cycle Herc/Bella skin, 0 = reset.
 */
export class StageScene extends Phaser.Scene {
  constructor() {
    super('Stage');
  }

  create() {
    const chars = this.registry.get('characters');
    this.drawBackdrop();

    this.sims = [
      new FighterSim(chars.herc, { x: GAME_WIDTH / 2 - 52, facing: 1 }),
      new FighterSim(chars.bella, { x: GAME_WIDTH / 2 + 52, facing: -1 }),
    ];
    this.views = this.sims.map((s) => new Fighter(this, s.def, s.x, s.y, { facing: s.facing }));
    this.bindings = [BINDINGS.p1, BINDINGS.p2];
    this.controls = new KeyboardInput();
    this.events.once('shutdown', () => this.controls.destroy());
    this.accumulator = 0;
    this.tick = 0;

    // Debug overlay
    this.showBoxes = true;
    this.debug = this.add.graphics().setDepth(10);
    this.stateTexts = this.sims.map(() =>
      this.add.text(0, 0, '', { ...TEXT, color: '#ffe08a' }).setOrigin(0.5, 1).setDepth(11),
    );

    // HUD
    this.add.text(4, 4, 'UPPERCASE  training', TEXT);
    this.fps = this.add.text(4, 13, '', { ...TEXT, color: '#7f7f99' });
    this.add
      .text(GAME_WIDTH - 4, 4, '1 boxes  2/3 skins  0 reset', { ...TEXT, color: '#9a9ab0' })
      .setOrigin(1, 0);
    this.add
      .text(GAME_WIDTH - 4, 13, 'P1 AD W S R F V   P2 JL I K P ; /', { ...TEXT, color: '#7f7f99' })
      .setOrigin(1, 0);
    this.log = [];
    this.logText = this.add.text(4, 26, '', { ...TEXT, color: '#c8c8d8', lineSpacing: 1 });
    this.labels = [
      this.add.text(4, FLOOR_Y + 5, '', TEXT),
      this.add.text(GAME_WIDTH - 4, FLOOR_Y + 5, '', TEXT).setOrigin(1, 0),
    ];
    this.refreshLabels();

    const kb = this.input.keyboard;
    kb.on('keydown-ONE', () => (this.showBoxes = !this.showBoxes));
    kb.on('keydown-TWO', () => this.cycleSkin(0));
    kb.on('keydown-THREE', () => this.cycleSkin(1));
    kb.on('keydown-ZERO', () => this.resetRound());

    if (import.meta.env.DEV) {
      window.stage = this; // devtools / automated tests
      this.sims.forEach(warnIfJumpLeavesScreen);
    }
  }

  // ---------------------------------------------------------- fixed step --

  update(_time, delta) {
    // Fixed 60 Hz simulation regardless of display refresh rate; cap the
    // catch-up so a backgrounded tab doesn't fast-forward.
    this.accumulator = Math.min(this.accumulator + delta, STEP_MS * 5);
    while (this.accumulator >= STEP_MS) {
      this.simTick();
      this.accumulator -= STEP_MS;
    }
    this.draw();
  }

  simTick() {
    const [a, b] = this.sims;
    const inputs = this.bindings.map((map) => this.controls.read(map));
    this.controls.endTick();
    a.step(inputs[0], b);
    b.step(inputs[1], a);
    for (const hit of resolveHits(this.sims)) this.logHit(hit);
    this.tick++;
  }

  // -------------------------------------------------------------- render --

  draw() {
    this.sims.forEach((s, i) => this.views[i].sync(s));
    this.fps.setText(`${Math.round(this.game.loop.actualFps)} fps  tick ${this.tick}`);
    this.drawDebug();
  }

  drawDebug() {
    const g = this.debug.clear();
    this.stateTexts.forEach((t) => t.setVisible(this.showBoxes));
    if (!this.showBoxes) return;

    this.sims.forEach((s, i) => {
      const hurt = hurtbox(s);
      g.fillStyle(0x3399ff, 0.18).fillRect(hurt.x, hurt.y, hurt.w, hurt.h);
      g.lineStyle(1, 0x3399ff, 1).strokeRect(hurt.x + 0.5, hurt.y + 0.5, hurt.w - 1, hurt.h - 1);

      const hit = hitbox(s);
      if (hit && s.phase === 'active') {
        g.fillStyle(0xff3344, 0.45).fillRect(hit.x, hit.y, hit.w, hit.h);
        g.lineStyle(1, 0xff3344, 1).strokeRect(hit.x + 0.5, hit.y + 0.5, hit.w - 1, hit.h - 1);
      } else if (hit && s.phase === 'startup') {
        // faint preview of where the hit will land
        g.lineStyle(1, 0xff3344, 0.35).strokeRect(hit.x + 0.5, hit.y + 0.5, hit.w - 1, hit.h - 1);
      }

      // center point (origin for hitbox offsets)
      g.fillStyle(0xffffff, 0.9).fillRect(Math.round(s.x) - 1, Math.round(s.centerY), 3, 1);
      g.fillRect(Math.round(s.x), Math.round(s.centerY) - 1, 1, 3);

      this.stateTexts[i]
        .setPosition(Math.round(s.x), Math.max(9, Math.round(hurt.y) - 2))
        .setText(stateLabel(s));
    });
  }

  // ----------------------------------------------------------------- hud --

  logHit(h) {
    const line = h.blocked
      ? `${h.defender} BLOCKED ${h.attacker}'s ${h.move} (0)`
      : `${h.attacker} ${h.move} > ${h.defender}  ${h.damage} dmg  [chg ${h.charge}]`;
    console.log(`[tick ${this.tick}] ${line}`);
    this.log.push(line);
    if (this.log.length > LOG_LINES) this.log.shift();
    this.logText.setText(this.log.join('\n'));
    this.refreshLabels();
  }

  cycleSkin(i) {
    this.views[i].nextSkin();
    this.refreshLabels();
  }

  resetRound() {
    this.sims.forEach((s) => s.reset());
    this.log = [];
    this.logText.setText('');
    this.refreshLabels();
  }

  refreshLabels() {
    this.sims.forEach((s, i) => {
      const v = this.views[i];
      const ft = (s.def.heightPx / PX_PER_FOOT).toFixed(0);
      this.labels[i].setText(`${s.def.displayName} ${ft}'0" · ${v.skin.name} · taken ${s.damageTaken}`);
    });
  }

  drawBackdrop() {
    const g = this.add.graphics();
    g.fillGradientStyle(0x1b1d3a, 0x1b1d3a, 0x3a2a4a, 0x3a2a4a, 1);
    g.fillRect(0, 0, GAME_WIDTH, FLOOR_Y);
    g.fillStyle(0x2a2233, 1).fillRect(0, FLOOR_Y, GAME_WIDTH, GAME_HEIGHT - FLOOR_Y);
    g.fillStyle(0x6b5a7a, 1).fillRect(0, FLOOR_Y, GAME_WIDTH, 1);
  }
}

function stateLabel(s) {
  if (s.state === 'attack') {
    const m = s.move;
    if (s.phase === 'startup' && s.charge > 0) {
      return `CHARGE ${s.charge}/${m.maxCharge} (${s.currentDamage()})`;
    }
    const len = m[s.phase];
    return `${s.phase.toUpperCase()} ${s.pf}/${len}`;
  }
  switch (s.state) {
    case 'blockStartup': return `BLOCK UP ${s.pf}/${s.def.block.startup}`;
    case 'block': return 'BLOCK';
    case 'blockRecovery': return `BLOCK REC ${s.pf}/${s.def.block.recovery}`;
    default: return s.state.toUpperCase();
  }
}

/** Dev guard: flag jump tuning that would carry a fighter off the top of the screen. */
function warnIfJumpLeavesScreen(s) {
  const { jumpVelocity: v, gravity: g } = s.def.physics;
  const headTop = FLOOR_Y - (v * v) / (2 * g) - s.def.hurtbox.h;
  if (headTop < 0) {
    console.warn(`[tuning] ${s.def.displayName}'s jump peaks ${Math.ceil(-headTop)}px above the screen`);
  }
}
