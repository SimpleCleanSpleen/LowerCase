import Phaser from 'phaser';
import { Cpu } from '../game/ai/Cpu.js';
import { Sfx } from '../game/audio/Sfx.js';
import { GAME_HEIGHT, GAME_WIDTH, SIM_HZ, STAGE_WIDTH } from '../game/constants.js';
import { EMPTY_PAD, KEYMAPS, Keyboard, PadSource } from '../game/input/devices.js';
import { MenuInput } from '../game/input/menu.js';
import { hitbox, hurtbox, pushbox } from '../game/sim/boxes.js';
import { Match, projBox } from '../game/sim/Match.js';
import { Effects } from '../game/view/Effects.js';
import { FighterView } from '../game/view/FighterView.js';
import { Hud } from '../game/view/Hud.js';
import { StageView } from '../game/view/StageView.js';
import { setText, text } from '../game/view/text.js';

const STEP_MS = 1000 / SIM_HZ;
const DUMMY_MODES = ['STAND', 'CROUCH', 'BLOCK ALL', 'JUMP', 'CPU'];

/**
 * A match. data: { mode: 'cpu'|'versus'|'training', p: [{id, skin}, {id, skin}], stage, cpuLevel }
 */
export class FightScene extends Phaser.Scene {
  constructor() {
    super('Fight');
  }

  init(data) {
    this.cfg = data;
  }

  create() {
    const cfg = this.cfg;
    const chars = this.registry.get('characters');
    const defs = cfg.p.map((p) => chars[p.id]);
    this.training = cfg.mode === 'training';
    this.match = new Match(defs[0], defs[1], { training: this.training });

    this.stageView = new StageView(this, cfg.stage);
    this.views = defs.map((d, i) => new FighterView(this, d, cfg.p[i].skin, 10 + i));
    this.fx = new Effects(this);
    const names = defs.map((d, i) => (cfg.mode === 'cpu' && i === 1 ? `${d.displayName} (CPU)` : d.displayName));
    this.hud = new Hud(this, this.match, this.views, { names, training: this.training });

    this.kb = new Keyboard();
    this.events.once('shutdown', () => this.kb.destroy());
    this.cpu = new Cpu(this.match, 1, cfg.cpuLevel ?? 1, (Date.now() & 0xffff) | 1);
    if (cfg.mode === 'versus') this.sources = [new PadSource(this.kb, KEYMAPS.p1, 0), new PadSource(this.kb, KEYMAPS.p2, 1)];
    else this.sources = [new PadSource(this.kb, KEYMAPS.solo, 0), null];
    this.dummyMode = 0;
    this.showBoxes = false;
    this.debug = this.add.graphics().setDepth(45);

    this.menuInput = new MenuInput(this, false);
    this.menu = null;
    this.accumulator = 0;
    this.t = 0;
    this.prevStart = false;

    const kb = this.input.keyboard;
    kb.on('keydown-ONE', () => (this.showBoxes = !this.showBoxes));
    kb.on('keydown-TWO', () => {
      if (!this.training) return;
      this.dummyMode = (this.dummyMode + 1) % DUMMY_MODES.length;
    });
    if (import.meta.env.DEV) window.fight = this;
  }

  // ------------------------------------------------------------- inputs --

  padFor(i) {
    if (this.sources[i]) return this.sources[i].poll();
    if (!this.training) return this.cpu.poll();
    // training dummy
    const me = this.match.fighters[1];
    const opp = this.match.fighters[0];
    const back = me.facing > 0 ? 'left' : 'right';
    switch (DUMMY_MODES[this.dummyMode]) {
      case 'CROUCH':
        return { ...EMPTY_PAD, down: true };
      case 'BLOCK ALL': {
        const low = opp.state === 'attack' && opp.move?.guard === 'low';
        return { ...EMPTY_PAD, [back]: true, down: low };
      }
      case 'JUMP':
        return { ...EMPTY_PAD, up: true };
      case 'CPU':
        return this.cpu.poll();
      default:
        return EMPTY_PAD;
    }
  }

  // --------------------------------------------------------------- loop --

  update(_time, delta) {
    this.t++;
    if (this.menu) {
      this.updateMenu();
      this.draw();
      return;
    }
    this.accumulator = Math.min(this.accumulator + delta, STEP_MS * 5);
    while (this.accumulator >= STEP_MS && !this.menu) {
      this.simTick();
      this.accumulator -= STEP_MS;
    }
    this.draw();
  }

  simTick() {
    const pads = [this.padFor(0), this.padFor(1)];
    this.kb.endTick();
    const start = pads[0].start || pads[1].start;
    if (start && !this.prevStart && this.match.phase !== 'over') {
      this.prevStart = start;
      return this.openMenu('PAUSED', ['RESUME', 'RESTART', 'CHARACTER SELECT', 'TITLE']);
    }
    this.prevStart = start;
    this.match.step(pads);
    for (const e of this.match.events) this.onEvent(e);
  }

  onEvent(e) {
    this.fx.onEvent(e, this.views);
    switch (e.type) {
      case 'announce':
        this.hud.announce(e.text, e.sub, e.big);
        if (e.text === 'FIGHT!') Sfx.fight();
        else if (!e.big) Sfx.announce();
        break;
      case 'hit':
        Sfx.hit(e.heavy);
        this.hud.showCombo(e.attacker.side, e.combo);
        break;
      case 'block':
        Sfx.block();
        break;
      case 'swing':
        Sfx.swing(e.heavy);
        break;
      case 'land':
        if (e.hard) Sfx.land();
        break;
      case 'dash':
        Sfx.dash();
        break;
      case 'projectile':
        Sfx.projectile();
        break;
      case 'grab':
        Sfx.grab();
        break;
      case 'ko':
        Sfx.ko();
        break;
      case 'matchOver':
        this.time.delayedCall(600, () => this.openMenu(`${this.match.fighters[e.winner].def.displayName} WINS!`, ['REMATCH', 'CHARACTER SELECT', 'TITLE']));
        break;
      default:
        break;
    }
  }

  // --------------------------------------------------------------- draw --

  draw() {
    const m = this.match;
    m.fighters.forEach((f, i) => {
      const v = this.views[i];
      v.sync(f, this.t);
      if (m.hitstop > 0 && f.flash > 0) v.sprite.x += this.t % 2 ? 1 : -1;
      v.setDepth(f.state === 'attack' || f.state === 'throw' ? 12 : 10 + i * 0.1);
    });
    this.stageView.update(this.t);
    this.fx.update(this.t, m, this.views);
    this.hud.update();

    const cam = this.cameras.main;
    const sx = m.shake > 0 ? (this.t % 2 ? 2 : -2) * Math.min(1, m.shake / 6) : 0;
    const sy = m.shake > 0 ? (this.t % 4 < 2 ? 1 : -1) : 0;
    cam.setScroll(Math.round(Math.min(Math.max(m.cameraX() + sx, -2), STAGE_WIDTH - GAME_WIDTH + 2)), sy);

    if (this.training) {
      const adv = m.advantage === null ? '' : m.advantage === 'KD' ? 'ADV: KNOCKDOWN' : `ADV: ${m.advantage > 0 ? '+' : ''}${m.advantage}`;
      const d = m.fighters[1];
      this.hud.setInfo(`1 BOXES   2 DUMMY: ${DUMMY_MODES[this.dummyMode]}   ${adv}${d.comboHits > 1 ? `   ${d.comboHits} HITS ${d.comboDamage} DMG` : ''}`);
    }
    this.drawBoxes();
  }

  drawBoxes() {
    const g = this.debug.clear();
    if (!this.showBoxes) return;
    const rect = (r, color, fillA) => {
      if (!r) return;
      g.fillStyle(color, fillA).fillRect(r.x, r.y, r.w, r.h);
      g.lineStyle(1, color, 1).strokeRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1);
    };
    for (const f of this.match.fighters) {
      rect(pushbox(f), 0x40ff80, 0.0);
      rect(hurtbox(f), f.strikeInvulnerable() ? 0xffffff : 0x3399ff, 0.2);
      rect(hitbox(f), 0xff3344, 0.45);
    }
    for (const p of this.match.projectiles) rect(projBox(p), 0xff3344, 0.45);
  }

  // --------------------------------------------------------------- menus --

  openMenu(title, items) {
    const c = this.add.container(0, 0).setDepth(200).setScrollFactor(0);
    c.add(this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x0b0814, 0.7).setOrigin(0).setScrollFactor(0));
    c.add(text(this, GAME_WIDTH / 2, 70, title, { scale: 3, align: 'center', tint: 0xffd24a }));
    const labels = items.map((it, i) => {
      const t = text(this, GAME_WIDTH / 2, 112 + i * 18, it, { scale: 2, align: 'center' });
      c.add(t);
      return t;
    });
    this.menu = { c, items, labels, cursor: 0 };
    this.menuInput.poll(); // sync key state so the key that opened the menu doesn't also act on it
    this.refreshMenu();
  }

  refreshMenu() {
    const M = this.menu;
    M.labels.forEach((t, i) => setText(t, i === M.cursor ? `> ${M.items[i]} <` : M.items[i]).setTint(i === M.cursor ? 0xffd24a : 0xc8c0d8));
  }

  updateMenu() {
    const M = this.menu;
    const [p, p2] = this.menuInput.poll();
    const up = p.up || p2.up;
    const down = p.down || p2.down;
    if (up || down) {
      M.cursor = (M.cursor + (up ? -1 : 1) + M.items.length) % M.items.length;
      Sfx.move();
      this.refreshMenu();
    }
    if (p.back && M.items[0] === 'RESUME') return this.closeMenu();
    if (!(p.confirm || p2.confirm)) return;
    Sfx.confirm();
    const choice = M.items[M.cursor];
    if (choice === 'RESUME') return this.closeMenu();
    if (choice === 'RESTART' || choice === 'REMATCH') return this.scene.restart(this.cfg);
    if (choice === 'CHARACTER SELECT') return this.scene.start('Select', { mode: this.cfg.mode, prev: this.cfg });
    return this.scene.start('Title');
  }

  closeMenu() {
    this.menu.c.destroy();
    this.menu = null;
    this.accumulator = 0;
    this.prevStart = true;
  }
}
