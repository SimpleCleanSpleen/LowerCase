import Phaser from 'phaser';
import { Fighter } from '../game/Fighter.js';
import { FLOOR_Y, GAME_HEIGHT, GAME_WIDTH, PX_PER_FOOT } from '../game/constants.js';

const TEXT = { fontFamily: 'monospace', fontSize: '8px', color: '#e8e8f0' };

/**
 * Render-verification scene: Herc vs Bella on a floor line.
 *   1 = cycle Herc's skin   2 = cycle Bella's skin   F = flip both
 */
export class StageScene extends Phaser.Scene {
  constructor() {
    super('Stage');
  }

  create() {
    const chars = this.registry.get('characters');

    this.drawBackdrop();

    this.p1 = new Fighter(this, chars.herc, 140, FLOOR_Y, { facing: 1 });
    this.p2 = new Fighter(this, chars.bella, 244, FLOOR_Y, { facing: -1 });

    this.labels = [
      this.add.text(4, FLOOR_Y + 5, '', TEXT),
      this.add.text(GAME_WIDTH - 4, FLOOR_Y + 5, '', TEXT).setOrigin(1, 0),
    ];
    this.refreshLabels();

    this.add.text(4, 4, 'UPPERCASE  render test', TEXT);
    this.add
      .text(GAME_WIDTH - 4, 4, '[1] Herc skin  [2] Bella skin  [F] flip', TEXT)
      .setOrigin(1, 0);
    this.fps = this.add.text(4, 14, '', { ...TEXT, color: '#7f7f99' });

    const kb = this.input.keyboard;
    kb.on('keydown-ONE', () => this.cycle(this.p1));
    kb.on('keydown-TWO', () => this.cycle(this.p2));
    kb.on('keydown-F', () => {
      for (const f of [this.p1, this.p2]) f.setFacing(-f.facing);
    });
  }

  cycle(fighter) {
    fighter.nextSkin();
    this.refreshLabels();
  }

  refreshLabels() {
    [this.p1, this.p2].forEach((f, i) => {
      const ft = (f.def.heightPx / PX_PER_FOOT).toFixed(0);
      this.labels[i].setText(`${f.def.displayName} ${ft}'0" · ${f.skin.name}`);
    });
  }

  drawBackdrop() {
    const g = this.add.graphics();
    g.fillGradientStyle(0x1b1d3a, 0x1b1d3a, 0x3a2a4a, 0x3a2a4a, 1);
    g.fillRect(0, 0, GAME_WIDTH, FLOOR_Y);
    g.fillStyle(0x2a2233, 1).fillRect(0, FLOOR_Y, GAME_WIDTH, GAME_HEIGHT - FLOOR_Y);
    g.fillStyle(0x6b5a7a, 1).fillRect(0, FLOOR_Y, GAME_WIDTH, 1);

    // Height guides at 5' and 7' to sanity-check sprite scale.
    for (const ft of [5, 7]) {
      const y = FLOOR_Y - ft * PX_PER_FOOT;
      g.fillStyle(0xffffff, 0.12).fillRect(0, y, GAME_WIDTH, 1);
      this.add.text(GAME_WIDTH - 4, y - 9, `${ft}'`, { ...TEXT, color: '#55556a' }).setOrigin(1, 0);
    }
  }

  update() {
    this.fps.setText(`${Math.round(this.game.loop.actualFps)} fps`);
  }
}
