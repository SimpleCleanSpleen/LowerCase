import Phaser from 'phaser';
import { buildCharacterAssets, queueCharacterSheets } from '../assets/characterAssets.js';
import { assetUrl, stageKey, stageLayerKey } from '../assets/keys.js';
import { GAME_HEIGHT, GAME_WIDTH, ROSTER } from '../game/constants.js';
import { registerFont } from '../game/view/text.js';

/** Loads sheets, stage layers, font and effects; builds per-skin textures. */
export class PreloadScene extends Phaser.Scene {
  constructor() {
    super('Preload');
  }

  preload() {
    const w = 200;
    const x = (GAME_WIDTH - w) / 2;
    const y = GAME_HEIGHT / 2;
    this.add.rectangle(x, y, w, 6).setOrigin(0, 0.5).setStrokeStyle(1, 0xc8a040);
    const bar = this.add.rectangle(x + 1, y, 0, 4, 0xffd24a).setOrigin(0, 0.5);
    this.load.on('progress', (p) => (bar.width = (w - 2) * p));

    queueCharacterSheets(this, ROSTER);
    for (const id of this.cache.json.get('stages')) {
      for (const L of this.cache.json.get(stageKey(id)).layers) {
        this.load.image(stageLayerKey(id, L.file), assetUrl(`stages/${id}/${L.file}`));
      }
    }
    this.load.image('font', assetUrl('ui/font.png'));
    this.load.spritesheet('fx', assetUrl('ui/fx.png'), { frameWidth: 32, frameHeight: 32 });
    this.load.spritesheet('bolt', assetUrl('ui/bolt.png'), { frameWidth: 40, frameHeight: 160 });
  }

  create() {
    registerFont(this);
    this.registry.set('characters', buildCharacterAssets(this, ROSTER));
    this.registry.set('stages', this.cache.json.get('stages'));
    this.scene.start('Title');
  }
}
