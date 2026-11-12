import Phaser from 'phaser';
import { stageKey, stageLayerKey } from '../assets/keys.js';
import { Sfx } from '../game/audio/Sfx.js';
import { GAME_HEIGHT, GAME_WIDTH, ROSTER } from '../game/constants.js';
import { SOLO_DEVICES } from '../game/input/devices.js';
import { MenuInput } from '../game/input/menu.js';
import { FighterView } from '../game/view/FighterView.js';
import { setText, text } from '../game/view/text.js';

const LEVELS = ['EASY', 'NORMAL', 'HARD'];
const ICON_W = 44;
const ICON_Y = 196;

/**
 * Character + color select, then stage select.
 *  - versus: both players pick at once with their own devices
 *  - cpu / training: player 1 picks their knight, then the opponent's
 *    (and CPU difficulty)
 */
export class SelectScene extends Phaser.Scene {
  constructor() {
    super('Select');
  }

  init(data) {
    this.mode = data.mode;
    this.prev = data.prev;
    this.devices = data.devices ?? data.prev?.devices ?? SOLO_DEVICES;
  }

  create() {
    this.chars = this.registry.get('characters');
    this.stageIds = this.registry.get('stages');
    this.menu = new MenuInput(this, this.mode === 'versus' ? this.devices : SOLO_DEVICES);
    this.cameras.main.setBackgroundColor('#120e22');
    const g = this.add.graphics();
    for (let y = 0; y < GAME_HEIGHT; y += 2) g.fillStyle(y % 4 ? 0x1a1430 : 0x161026, 1).fillRect(0, y, GAME_WIDTH, 2);
    text(this, GAME_WIDTH / 2, 6, this.mode === 'training' ? 'TRAINING' : 'CHOOSE YOUR KNIGHT', { scale: 2, align: 'center', tint: 0xffd24a });

    // roster strip
    this.iconG = this.add.graphics().setDepth(5);
    this.icons = ROSTER.map((id, i) => {
      const x = GAME_WIDTH / 2 + (i - (ROSTER.length - 1) / 2) * (ICON_W + 6);
      const v = new FighterView(this, this.chars[id], 0, 6);
      v.sprite.setScale(0.42).setPosition(x, ICON_Y + 18);
      v.shadow.setVisible(false);
      return { x, v };
    });

    this.slots = [0, 1].map((i) => {
      const pv = this.prev?.p[i];
      const fighter = pv ? ROSTER.indexOf(pv.id) : i;
      const x = i ? GAME_WIDTH - 92 : 92;
      const slot = { i, fighter, skin: pv?.skin ?? 0, done: false, x };
      slot.view = this.makeView(slot);
      slot.label = text(this, x, 30, '', { align: 'center', tint: 0xa0a0c0 });
      slot.name = text(this, x, 41, '', { scale: 2, align: 'center' });
      slot.skinText = text(this, x, 168, '', { align: 'center', tint: 0xe8d8ff });
      slot.status = text(this, x, 179, '', { align: 'center', tint: 0xa0a0c0 });
      return slot;
    });
    this.level = this.prev?.cpuLevel ?? 1;
    this.stageIdx = Math.max(0, this.stageIds.indexOf(this.prev?.stage));
    this.phase = this.mode === 'versus' ? 'chars' : 'p1';
    this.vs = text(this, GAME_WIDTH / 2, 92, 'VS', { scale: 3, align: 'center', tint: 0xff5a4a });

    this.stagePrev = this.add.container(GAME_WIDTH / 2, 110).setVisible(false).setDepth(30);
    this.stageImgs = this.stageIds.map((id) => {
      const c = this.add.container(0, 0);
      const meta = this.cache.json.get(stageKey(id));
      for (const L of meta.layers) if (!L.front) c.add(this.add.image(-60, -34, stageLayerKey(id, L.file)).setOrigin(0).setScale(0.25).setCrop(0, 0, 480, 270));
      c.add(this.add.rectangle(0, 0, 122, 70).setStrokeStyle(2, 0xffd24a));
      c.name = meta.name;
      return c;
    });
    this.stageImgs.forEach((c) => this.stagePrev.add(c));
    this.stageName = text(this, GAME_WIDTH / 2, 150, '', { align: 'center', scale: 2, depth: 31 });
    this.help = text(this, GAME_WIDTH / 2, GAME_HEIGHT - 10, '', { align: 'center', tint: 0xa0a0c0 });
    this.t = 0;
    this.refresh();
  }

  makeView(s) {
    const v = new FighterView(this, this.chars[ROSTER[s.fighter]], s.skin);
    v.sprite.setPosition(s.x, 160).setFlipX(s.i === 1);
    v.shadow.setPosition(s.x, 161);
    return v;
  }

  activeSlot() {
    return this.phase === 'p1' ? 0 : this.phase === 'p2' ? 1 : null;
  }

  refresh() {
    for (const s of this.slots) {
      const def = this.chars[ROSTER[s.fighter]];
      if (s.view.def !== def) {
        s.view.destroy();
        s.view = this.makeView(s);
      } else s.view.setSkin(s.skin);
      const cpu = this.mode === 'cpu' && s.i === 1;
      setText(s.label, this.mode === 'training' ? (s.i ? 'DUMMY' : 'YOU') : cpu ? `CPU - ${LEVELS[this.level]}` : `PLAYER ${s.i + 1}`);
      setText(s.name, def.displayName);
      setText(s.skinText, `< ${def.skins[s.skin].name} >`);
      const active = this.mode === 'versus' ? !s.done && this.phase === 'chars' : this.activeSlot() === s.i;
      const levelPick = cpu && this.phase === 'level';
      setText(s.status, levelPick ? `< ${LEVELS[this.level]} >` : s.done ? 'READY!' : active ? '< > KNIGHT   ^ V COLOR' : '');
      s.status.setTint(levelPick ? 0xffd24a : s.done ? 0x7aff7a : 0xa0a0c0);
      s.name.setTint(active ? 0xffd24a : 0xffffff);
    }
    // roster cursors
    const g = this.iconG.clear();
    this.icons.forEach(({ x }, i) => {
      g.fillStyle(0x1a1430, 1).fillRect(x - ICON_W / 2, ICON_Y - 22, ICON_W, 44);
      g.lineStyle(1, 0x3a2f5a, 1).strokeRect(x - ICON_W / 2 + 0.5, ICON_Y - 21.5, ICON_W - 1, 43);
      const [a, b] = this.slots;
      if (a.fighter === i) g.lineStyle(2, 0xffd24a, 1).strokeRect(x - ICON_W / 2 + 1, ICON_Y - 21, ICON_W - 2, 42);
      if (b.fighter === i) g.lineStyle(1, 0xff6a5a, 1).strokeRect(x - ICON_W / 2 + 3.5, ICON_Y - 18.5, ICON_W - 7, 37);
    });
    const stagePhase = this.phase === 'stage';
    this.stagePrev.setVisible(stagePhase);
    this.stageName.setVisible(stagePhase);
    this.vs.setVisible(!stagePhase);
    this.stageImgs.forEach((c, i) => c.setVisible(i === this.stageIdx));
    setText(this.stageName, `< ${this.stageImgs[this.stageIdx].name} >`);
    setText(
      this.help,
      stagePhase ? 'LEFT/RIGHT STAGE   CONFIRM FIGHT   BACK RETURN' : this.phase === 'level' ? 'LEFT/RIGHT CPU DIFFICULTY   CONFIRM' : 'CONFIRM: J  OR  A / CROSS      BACK: ESC  OR  B / CIRCLE',
    );
  }

  /** Avoid identical-looking mirror matches. */
  fixMirror(changed) {
    const [a, b] = this.slots;
    if (a.fighter === b.fighter && a.skin === b.skin) {
      const o = changed === a ? b : a;
      const t = o.done ? changed : o;
      t.skin = (t.skin + 1) % this.chars[ROSTER[t.fighter]].skins.length;
    }
  }

  handleSlot(s, p) {
    const n = () => this.chars[ROSTER[s.fighter]].skins.length;
    if (p.left || p.right) {
      s.fighter = (s.fighter + (p.left ? -1 : 1) + ROSTER.length) % ROSTER.length;
      s.skin = 0;
      this.fixMirror(s);
      Sfx.move();
    }
    if (p.up || p.down) {
      s.skin = (s.skin + (p.up ? -1 : 1) + n()) % n();
      this.fixMirror(s);
      Sfx.move();
    }
  }

  update() {
    this.t++;
    const idle = `idle${Math.floor(this.t / 9) % 4}`;
    for (const s of this.slots) s.view.sprite.setFrame(s.view.frame(idle));
    for (const ic of this.icons) ic.v.sprite.setFrame(ic.v.frame(idle));
    const pads = this.menu.poll();
    const p = pads[0];
    const snap = () => JSON.stringify([this.phase, this.level, this.stageIdx, this.slots.map((s) => [s.fighter, s.skin, s.done])]);
    const before = snap();

    if (this.phase === 'level') {
      if (p.left || p.right) {
        this.level = Math.min(2, Math.max(0, this.level + (p.left ? -1 : 1)));
        Sfx.move();
      }
      if (p.confirm) {
        Sfx.confirm();
        this.phase = 'stage';
      } else if (p.back) {
        Sfx.back();
        this.phase = 'p2';
        this.slots[1].done = false;
      }
    } else if (this.phase === 'stage') {
      if (p.left || p.right) {
        this.stageIdx = (this.stageIdx + (p.left ? -1 : 1) + this.stageIds.length) % this.stageIds.length;
        Sfx.move();
      }
      if (p.confirm) return this.go();
      if (p.back) {
        Sfx.back();
        if (this.mode === 'versus') {
          this.phase = 'chars';
          this.slots.forEach((s) => (s.done = false));
        } else if (this.mode === 'cpu') this.phase = 'level';
        else {
          this.phase = 'p2';
          this.slots[1].done = false;
        }
      }
    } else if (this.mode === 'versus') {
      pads.forEach((pp, i) => {
        const s = this.slots[i];
        if (!s.done) {
          this.handleSlot(s, pp);
          if (pp.confirm) {
            s.done = true;
            Sfx.confirm();
          }
        } else if (pp.back) s.done = false;
      });
      if (this.slots.every((s) => s.done)) this.phase = 'stage';
      if (p.back && !this.slots[0].done && !this.slots[1].done) return this.scene.start('Controllers');
    } else {
      const s = this.slots[this.activeSlot()];
      this.handleSlot(s, p);
      if (p.confirm) {
        s.done = true;
        Sfx.confirm();
        this.phase = this.phase === 'p1' ? 'p2' : this.mode === 'cpu' ? 'level' : 'stage';
      } else if (p.back) {
        Sfx.back();
        if (this.phase === 'p1') return this.scene.start('Title');
        this.phase = 'p1';
        this.slots[0].done = false;
      }
    }
    if (snap() !== before) this.refresh();
  }

  go() {
    Sfx.confirm();
    this.scene.start('Fight', {
      mode: this.mode,
      p: this.slots.map((s) => ({ id: ROSTER[s.fighter], skin: s.skin })),
      stage: this.stageIds[this.stageIdx],
      cpuLevel: this.level,
      devices: this.mode === 'versus' ? this.devices : SOLO_DEVICES,
    });
  }
}
