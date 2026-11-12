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
  { label: 'CONTROLS', mode: 'controls' },
  { label: 'MOVE LIST', mode: 'moves' },
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

    this.items = ITEMS.map((it, i) => text(this, GAME_WIDTH / 2, 136 + i * 18, it.label, { scale: 2, align: 'center', depth: 62 }));
    this.cursor = 0;
    text(this, GAME_WIDTH / 2, GAME_HEIGHT - 12, 'UP / DOWN CHOOSE   J OR A / CROSS CONFIRM   M MUTE', { align: 'center', depth: 62, tint: 0xa0a0c0 });
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

    if (p.up || p.down) {
      this.cursor = (this.cursor + (p.up ? -1 : 1) + ITEMS.length) % ITEMS.length;
      Sfx.move();
      this.refresh();
    }
    if (p.confirm) {
      Sfx.confirm();
      const mode = ITEMS[this.cursor].mode;
      if (mode === 'controls') this.scene.start('Controls');
      else if (mode === 'moves') this.scene.start('MoveList');
      else if (mode === 'versus') this.scene.start('Controllers');
      else this.scene.start('Select', { mode });
    }
  }
}
