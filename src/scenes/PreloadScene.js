import Phaser from 'phaser';
import { buildCharacterAssets, queueCharacterSheets } from '../assets/characterAssets.js';
import { GAME_HEIGHT, GAME_WIDTH, ROSTER } from '../game/constants.js';

/** Loads sprite sheets, then builds per-skin textures and animations. */
export class PreloadScene extends Phaser.Scene {
  constructor() {
    super('Preload');
  }

  preload() {
    const w = 160;
    const x = (GAME_WIDTH - w) / 2;
    const y = GAME_HEIGHT / 2;
    this.add.rectangle(x, y, w, 6).setOrigin(0, 0.5).setStrokeStyle(1, 0xffffff);
    const bar = this.add.rectangle(x + 1, y, 0, 4, 0xffd23f).setOrigin(0, 0.5);
    this.load.on('progress', (p) => (bar.width = (w - 2) * p));

    queueCharacterSheets(this, ROSTER);
  }

  create() {
    const characters = buildCharacterAssets(this, ROSTER);
    this.registry.set('characters', characters);
    this.scene.start('Stage');
  }
}
