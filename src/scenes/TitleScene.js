import Phaser from 'phaser';
import { Sfx, unlockAudio } from '../game/audio/Sfx.js';
import { GAME_HEIGHT, GAME_WIDTH, STAGE_WIDTH } from '../game/constants.js';
import { MenuInput } from '../game/input/menu.js';
import { StageView } from '../game/view/StageView.js';
import { setText, text } from '../game/view/text.js';

const ITEMS = [
  { label: 'VERSUS CPU', mode: 'cpu' },
  { label: 'VERSUS PLAYER', mode: 'versus' },
  { label: 'TRAINING', mode: 'training' },
  { label: 'HOW TO PLAY', mode: 'help' },
];

const HELP = [
  'MOVE          A D  (OR ARROWS)',
  'JUMP / CROUCH W / S',
  'DASH          TAP FORWARD OR BACK TWICE',
  'HIGH  MID  LOW   I   J   K',
  '',
  'HOLD BACK TO BLOCK.  CROUCH-BLOCK LOWS,',
  'STAND-BLOCK HIGHS (OVERHEADS).',
  'HOLD AN ATTACK BUTTON TO CHARGE IT.',
  'THROW: FORWARD + MID UP CLOSE',
  'CHAIN LOW > MID > HIGH, CANCEL INTO SPECIALS',
  '',
  'SPECIALS   QCF = DOWN, DOWN-FWD, FWD + ATTACK',
  '           DP  = FWD, DOWN, DOWN-FWD + ATTACK',
  'HERC   QCF BULL RUSH     DP UPPER CASE',
  'BELLA  QCF SIGIL WAVE    DP RISING CLEAVE',
  '',
  '2 PLAYERS: P1 WASD + R F V    P2 ARROWS + O K ,',
  'GAMEPADS: Y X A = HIGH MID LOW',
];

export class TitleScene extends Phaser.Scene {
  constructor() {
    super('Title');
  }

  create() {
    this.stage = new StageView(this, 'keep');
    this.cameras.main.setBounds(0, 0, STAGE_WIDTH, GAME_HEIGHT);
    this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x0b0814, 0.45).setOrigin(0).setScrollFactor(0).setDepth(60);

    // logo
    const sig = this.add.sprite(GAME_WIDTH / 2, 46, 'fx', 5 * 6 + 4).setScrollFactor(0).setDepth(61).setScale(1.5).setTint(0xffd24a);
    this.tweens.add({ targets: sig, y: 42, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    text(this, GAME_WIDTH / 2 + 3, 80, 'UPPERCASE', { scale: 5, align: 'center', depth: 61, tint: 0x3a1a10 });
    text(this, GAME_WIDTH / 2, 77, 'UPPERCASE', { scale: 5, align: 'center', depth: 62, tint: 0xffd24a });
    text(this, GAME_WIDTH / 2, 118, 'KNIGHTS OF THE SIGIL', { scale: 1, align: 'center', depth: 62, tint: 0xe8d8ff });

    this.items = ITEMS.map((it, i) => text(this, GAME_WIDTH / 2, 146 + i * 18, it.label, { scale: 2, align: 'center', depth: 62 }));
    this.cursor = 0;
    this.help = this.add.container(0, 0).setDepth(70).setScrollFactor(0).setVisible(false);
    this.help.add(this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x0b0814, 0.92).setOrigin(0));
    this.help.add(text(this, GAME_WIDTH / 2, 10, 'HOW TO PLAY', { scale: 2, align: 'center', tint: 0xffd24a }));
    HELP.forEach((l, i) => this.help.add(text(this, 40, 34 + i * 12, l)));
    this.help.add(text(this, GAME_WIDTH / 2, GAME_HEIGHT - 14, 'PRESS ANY ATTACK TO GO BACK', { align: 'center', tint: 0xa0a0c0 }));

    text(this, GAME_WIDTH / 2, GAME_HEIGHT - 12, 'W S CHOOSE   J CONFIRM   M MUTE', { align: 'center', depth: 62, tint: 0xa0a0c0 });
    this.menu = new MenuInput(this);
    this.t = 0;
    this.input.keyboard.on('keydown', unlockAudio);
    this.refresh();
  }

  refresh() {
    this.items.forEach((t, i) => {
      const on = i === this.cursor;
      setText(t, on ? `> ${ITEMS[i].label} <` : ITEMS[i].label).setTint(on ? 0xffd24a : 0xc8c0d8);
    });
  }

  update() {
    this.t++;
    this.cameras.main.scrollX = (STAGE_WIDTH - GAME_WIDTH) * (0.5 + 0.5 * Math.sin(this.t / 400));
    this.stage.update(this.t);
    const [p] = this.menu.poll();

    if (this.help.visible) {
      if (p.confirm || p.back) {
        this.help.setVisible(false);
        Sfx.back();
      }
      return;
    }
    if (p.up || p.down) {
      this.cursor = (this.cursor + (p.up ? -1 : 1) + ITEMS.length) % ITEMS.length;
      Sfx.move();
      this.refresh();
    }
    if (p.confirm) {
      Sfx.confirm();
      const mode = ITEMS[this.cursor].mode;
      if (mode === 'help') this.help.setVisible(true);
      else this.scene.start('Select', { mode });
    }
  }
}
