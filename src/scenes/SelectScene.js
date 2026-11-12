import Phaser from 'phaser';
import { stageKey, stageLayerKey } from '../assets/keys.js';
import { Sfx } from '../game/audio/Sfx.js';
import { FLOOR_Y, GAME_HEIGHT, GAME_WIDTH, ROSTER } from '../game/constants.js';
import { MenuInput } from '../game/input/menu.js';
import { FighterView } from '../game/view/FighterView.js';
import { setText, text } from '../game/view/text.js';

const LEVELS = ['EASY', 'NORMAL', 'HARD'];

/**
 * Character + color select, then stage select.
 * VS CPU: player 1 picks their fighter, then the CPU's fighter and difficulty.
 */
export class SelectScene extends Phaser.Scene {
  constructor() {
    super('Select');
  }

  init(data) {
    this.mode = data.mode;
    this.prev = data.prev; // previous picks (when returning from a match)
  }

  create() {
    this.chars = this.registry.get('characters');
    this.stageIds = this.registry.get('stages');
    const twoPlayer = this.mode === 'versus';
    this.menu = new MenuInput(this, twoPlayer);
    this.cameras.main.setBackgroundColor('#120e22');

    const g = this.add.graphics();
    for (let y = 0; y < GAME_HEIGHT; y += 2) g.fillStyle(y % 4 ? 0x1a1430 : 0x161026, 1).fillRect(0, y, GAME_WIDTH, 2);
    g.fillStyle(0x2a1f44, 1).fillRect(0, FLOOR_Y - 30, GAME_WIDTH, 2);
    text(this, GAME_WIDTH / 2, 8, this.mode === 'training' ? 'TRAINING' : 'CHOOSE YOUR KNIGHT', { scale: 2, align: 'center', tint: 0xffd24a });

    this.slots = [0, 1].map((i) => {
      const pv = this.prev?.p[i];
      const fighter = pv ? ROSTER.indexOf(pv.id) : i % ROSTER.length;
      const slot = { i, fighter, skin: pv?.skin ?? 0, done: false };
      const x = i ? GAME_WIDTH - 110 : 110;
      slot.view = new FighterView(this, this.chars[ROSTER[fighter]], slot.skin);
      slot.view.sprite.setPosition(x, FLOOR_Y - 32).setFlipX(i === 1);
      slot.view.shadow.setPosition(x, FLOOR_Y - 31);
      slot.label = text(this, x, 34, '', { align: 'center', tint: 0xa0a0c0 });
      slot.name = text(this, x, 46, '', { scale: 2, align: 'center' });
      slot.skinText = text(this, x, FLOOR_Y - 20, '', { align: 'center', tint: 0xe8d8ff });
      slot.status = text(this, x, FLOOR_Y - 6, '', { align: 'center', tint: 0xa0a0c0 });
      slot.x = x;
      return slot;
    });
    this.level = this.prev?.cpuLevel ?? 1;
    this.stageIdx = Math.max(0, this.stageIds.indexOf(this.prev?.stage));
    this.phase = 'p1';
    this.vs = text(this, GAME_WIDTH / 2, 110, 'VS', { scale: 3, align: 'center', tint: 0xff5a4a });

    // stage preview
    this.stagePrev = this.add.container(GAME_WIDTH / 2, 160).setVisible(false);
    this.stageImgs = this.stageIds.map((id) => {
      const c = this.add.container(0, 0);
      const meta = this.cache.json.get(stageKey(id));
      for (const L of meta.layers) if (!L.front) c.add(this.add.image(-60, -34, stageLayerKey(id, L.file)).setOrigin(0).setScale(0.25).setCrop(0, 0, 480, 270));
      c.add(this.add.rectangle(0, 0, 122, 70).setStrokeStyle(2, 0xffd24a));
      c.name = meta.name;
      return c;
    });
    this.stageImgs.forEach((c) => this.stagePrev.add(c));
    this.stageName = text(this, GAME_WIDTH / 2, 200, '', { align: 'center', scale: 2 });
    this.help = text(this, GAME_WIDTH / 2, GAME_HEIGHT - 12, '', { align: 'center', tint: 0xa0a0c0 });
    this.t = 0;
    this.refresh();
  }

  activeSlot() {
    if (this.mode === 'versus') return null; // both players pick at once
    return this.phase === 'p1' ? 0 : this.phase === 'p2' ? 1 : null;
  }

  refresh() {
    for (const s of this.slots) {
      const def = this.chars[ROSTER[s.fighter]];
      if (s.view.def !== def) {
        s.view.destroy();
        s.view = new FighterView(this, def, s.skin);
        s.view.sprite.setPosition(s.x, FLOOR_Y - 32).setFlipX(s.i === 1);
        s.view.shadow.setPosition(s.x, FLOOR_Y - 31);
      } else s.view.setSkin(s.skin);
      const cpu = this.mode === 'cpu' && s.i === 1;
      const who = this.mode === 'training' ? (s.i ? 'DUMMY' : 'YOU') : cpu ? `CPU - ${LEVELS[this.level]}` : `PLAYER ${s.i + 1}`;
      setText(s.label, who);
      setText(s.name, def.displayName);
      setText(s.skinText, `< ${def.skins[s.skin].name} >`);
      const active = this.mode === 'versus' ? !s.done && this.phase === 'chars' : this.activeSlot() === s.i;
      const levelPick = cpu && this.phase === 'level';
      setText(s.status, levelPick ? `< ${LEVELS[this.level]} >` : s.done ? 'READY!' : active ? 'A D KNIGHT   W S COLOR' : '');
      if (levelPick) s.status.setTint(0xffd24a);
      else s.status.setTint(s.done ? 0x7aff7a : 0xa0a0c0);
      s.name.setTint(active ? 0xffd24a : 0xffffff);
    }
    const stagePhase = this.phase === 'stage';
    this.stagePrev.setVisible(stagePhase);
    this.stageName.setVisible(stagePhase);
    this.vs.setVisible(!stagePhase);
    this.stageImgs.forEach((c, i) => c.setVisible(i === this.stageIdx));
    setText(this.stageName, `< ${this.stageImgs[this.stageIdx].name} >`);
    setText(this.help, stagePhase ? 'A D CHOOSE STAGE   J FIGHT   ESC BACK' : this.phase === 'level' ? 'A D CPU DIFFICULTY   J CONFIRM' : 'J CONFIRM   ESC BACK');
  }

  /** Avoid identical-looking mirror matches. */
  fixMirror(changed) {
    const [a, b] = this.slots;
    if (a.fighter === b.fighter && a.skin === b.skin) {
      const o = changed === a ? b : a;
      if (!o.done) o.skin = (o.skin + 1) % this.chars[ROSTER[o.fighter]].skins.length;
      else changed.skin = (changed.skin + 1) % this.chars[ROSTER[changed.fighter]].skins.length;
    }
  }

  handleSlot(s, p) {
    const def = () => this.chars[ROSTER[s.fighter]];
    if (p.left || p.right) {
      s.fighter = (s.fighter + (p.left ? -1 : 1) + ROSTER.length) % ROSTER.length;
      s.skin = 0;
      this.fixMirror(s);
      Sfx.move();
    }
    if (p.up || p.down) {
      s.skin = (s.skin + (p.up ? -1 : 1) + def().skins.length) % def().skins.length;
      this.fixMirror(s);
      Sfx.move();
    }
  }

  update() {
    this.t++;
    for (const s of this.slots) s.view.sprite.setFrame(s.view.frame(`idle${Math.floor(this.t / 9) % 4}`));
    const pads = this.menu.poll();
    const p = pads[0];
    let dirty = false;

    if (this.phase === 'level') {
      if (p.left || p.right) {
        this.level = Math.min(2, Math.max(0, this.level + (p.left ? -1 : 1)));
        Sfx.move();
        dirty = true;
      }
      if (p.confirm) {
        Sfx.confirm();
        this.phase = 'stage';
        dirty = true;
      }
      if (p.back) {
        Sfx.back();
        this.phase = 'p2';
        this.slots[1].done = false;
        dirty = true;
      }
    } else if (this.phase === 'stage') {
      if (p.left || p.right) {
        this.stageIdx = (this.stageIdx + (p.left ? -1 : 1) + this.stageIds.length) % this.stageIds.length;
        Sfx.move();
        dirty = true;
      }
      if (p.confirm) return this.go();
      if (p.back) {
        this.phase = this.mode === 'versus' ? 'chars' : this.mode === 'cpu' ? 'level' : 'p2';
        this.slots.forEach((s) => (s.done = this.mode === 'cpu' || (this.mode !== 'versus' && s.i === 0)));
        Sfx.back();
        dirty = true;
      }
    } else if (this.mode === 'versus') {
      this.phase = 'chars';
      pads.forEach((pp, i) => {
        const s = this.slots[i];
        if (!s.done) {
          if (Object.values(pp).some(Boolean)) dirty = true;
          this.handleSlot(s, pp);
          if (pp.confirm) {
            s.done = true;
            Sfx.confirm();
          }
        } else if (pp.back) {
          s.done = false;
          dirty = true;
        }
      });
      if (this.slots.every((s) => s.done)) this.phase = 'stage';
      if (pads[0].back && !this.slots[0].done && !this.slots[1].done) return this.scene.start('Title');
    } else {
      const s = this.slots[this.activeSlot()];
      if (Object.values(p).some(Boolean)) dirty = true;
      this.handleSlot(s, p);
      if (p.confirm) {
        s.done = true;
        Sfx.confirm();
        this.phase = this.phase === 'p1' ? 'p2' : this.mode === 'cpu' ? 'level' : 'stage';
      }
      if (p.back) {
        Sfx.back();
        if (this.phase === 'p1') return this.scene.start('Title');
        this.phase = 'p1';
        this.slots[0].done = false;
      }
    }
    if (dirty || p.confirm || p.back) this.refresh();
  }

  go() {
    Sfx.confirm();
    this.scene.start('Fight', {
      mode: this.mode,
      p: this.slots.map((s) => ({ id: ROSTER[s.fighter], skin: s.skin })),
      stage: this.stageIds[this.stageIdx],
      cpuLevel: this.level,
    });
  }
}
