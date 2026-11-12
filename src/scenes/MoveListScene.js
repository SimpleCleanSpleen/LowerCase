import Phaser from 'phaser';
import { Sfx } from '../game/audio/Sfx.js';
import { FLOOR_Y, GAME_HEIGHT, GAME_WIDTH, ROSTER } from '../game/constants.js';
import { MenuInput } from '../game/input/menu.js';
import { FighterView } from '../game/view/FighterView.js';
import { setText, text } from '../game/view/text.js';

const NOTES = {
  counter: 'TIMED PARRY: CATCH A STRIKE, PUNISH',
  vault: 'VAULT OVER THEM, THEN ATTACK IN AIR',
  step: 'INVULNERABLE DASH THROUGH THEM',
  buff: 'NEXT HIT: 1.5X DAMAGE + KNOCKDOWN',
  projectile: 'PROJECTILE',
  strike: 'LIGHTNING STRIKES A SPOT AHEAD',
  rush: 'CHARGING ATTACK',
  rise: 'INVULNERABLE ANTI-AIR',
};

/** Per-character move list (left / right to switch knight). */
export class MoveListScene extends Phaser.Scene {
  constructor() {
    super('MoveList');
  }

  create() {
    this.cameras.main.setBackgroundColor('#120e22');
    this.menu = new MenuInput(this);
    this.chars = this.registry.get('characters');
    this.idx = 0;
    this.items = [];
    text(this, GAME_WIDTH / 2, GAME_HEIGHT - 12, 'LEFT / RIGHT: KNIGHT   BACK: TITLE', { align: 'center', tint: 0x9a92b8 });
    this.t = 0;
    this.show();
  }

  show() {
    this.items.forEach((o) => o.destroy());
    this.view?.destroy();
    const def = this.chars[ROSTER[this.idx]];
    const M = def.moves;
    this.view = new FighterView(this, def, 0);
    this.view.sprite.setPosition(78, FLOOR_Y - 20);
    this.view.shadow.setPosition(78, FLOOR_Y - 19);
    const add = (o) => (this.items.push(o), o);
    add(text(this, 78, 18, `< ${def.displayName} >`, { scale: 2, align: 'center', tint: 0xffd24a }));
    add(text(this, 78, 38, `${Math.floor(def.heightPx / 16)}'${def.heightPx % 16 ? Math.round(((def.heightPx % 16) / 16) * 12) : 0}"   HP ${def.maxHp}`, { align: 'center', tint: 0x9a92b8 }));

    const rows = [
      ['NORMALS', null],
      [M.high.name, 'HIGH - BLOCK STANDING'],
      [M.mid.name, 'MID'],
      [M.low.name, 'LOW - BLOCK CROUCHING'],
      [M.air.name, 'ANY ATTACK IN THE AIR'],
      ['', 'HOLD AN ATTACK TO CHARGE IT'],
      ['SPECIALS', null],
      [M.sp1.name, 'SPECIAL (OR QCF+ATTACK)', NOTES[M.sp1.kind]],
      [M.sp2.name, 'FWD,DOWN,DOWN-FWD+ATTACK', NOTES[M.sp2.kind]],
      [M.unique.name, 'UNIQUE', NOTES[M.unique.kind]],
      [M.throw.name, 'THROW (UP CLOSE)'],
    ];
    let y = 22;
    for (const [name, how, note] of rows) {
      if (how === null) {
        add(text(this, 150, y, name, { tint: 0xff8a5a }));
        y += 13;
        continue;
      }
      if (name) add(text(this, 150, y, name, { tint: 0xffffff }));
      add(text(this, 262, y, how, { tint: 0xffd24a }));
      y += 11;
      if (note) {
        add(text(this, 262, y, note, { tint: 0x9a92b8 }));
        y += 11;
      }
      y += 3;
    }
  }

  update() {
    this.t++;
    this.view.sprite.setFrame(this.view.frame(`idle${Math.floor(this.t / 9) % 4}`));
    const [p] = this.menu.poll();
    if (p.left || p.right) {
      this.idx = (this.idx + (p.left ? -1 : 1) + ROSTER.length) % ROSTER.length;
      Sfx.move();
      this.show();
    }
    if (p.back || p.confirm) {
      Sfx.back();
      this.scene.start('Title');
    }
  }
}
