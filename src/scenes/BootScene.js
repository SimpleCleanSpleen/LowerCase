import Phaser from 'phaser';
import { queueCharacterDefs } from '../assets/characterAssets.js';
import { ROSTER } from '../game/constants.js';

/** Loads tiny JSON manifests needed to know what else to load. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload() {
    queueCharacterDefs(this, ROSTER);
  }

  create() {
    this.scene.start('Preload');
  }
}
