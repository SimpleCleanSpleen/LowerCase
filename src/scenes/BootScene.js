import Phaser from 'phaser';
import { queueCharacterDefs } from '../assets/characterAssets.js';
import { stageKey } from '../assets/keys.js';
import { ROSTER } from '../game/constants.js';

/** Loads the small JSON manifests that say what else to load. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload() {
    queueCharacterDefs(this, ROSTER);
    this.load.json('fontmeta', 'assets/ui/font.json');
    this.load.json('stages', 'assets/stages/index.json');
    this.load.once('filecomplete-json-stages', (_key, _type, ids) => {
      for (const id of ids) this.load.json(stageKey(id), `assets/stages/${id}/stage.json`);
    });
  }

  create() {
    this.scene.start('Preload');
  }
}
