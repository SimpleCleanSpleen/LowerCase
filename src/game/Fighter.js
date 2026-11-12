import Phaser from 'phaser';
import { animKey, skinTextureKey } from '../assets/keys.js';

/**
 * A fighter on screen. For now: renders, animates, faces a direction and
 * swaps skins. Physics, input and state machine come later.
 */
export class Fighter extends Phaser.GameObjects.Sprite {
  /**
   * @param {Phaser.Scene} scene
   * @param {object} def        parsed character.json
   * @param {number} x
   * @param {number} y          floor Y (feet)
   * @param {{skin?: number, facing?: 1|-1}} [opts]
   */
  constructor(scene, def, x, y, { skin = 0, facing = 1 } = {}) {
    super(scene, x, y, skinTextureKey(def.id, skin), 0);
    this.def = def;
    this.skinIndex = skin;
    this.currentAnim = 'idle';

    // Anchor on the feet so every character stands on the same floor line
    // regardless of height.
    this.setOrigin(0.5, def.footY / def.frameHeight);
    this.setFacing(facing);
    scene.add.existing(this);
    this.playAnim('idle');
  }

  get skin() {
    return this.def.skins[this.skinIndex];
  }

  setFacing(dir) {
    this.facing = dir;
    this.setFlipX(dir < 0);
    return this;
  }

  playAnim(name) {
    this.currentAnim = name;
    this.play(animKey(this.def.id, this.skinIndex, name), true);
    return this;
  }

  /** Switch skin without restarting the current animation. */
  setSkin(index) {
    const count = this.def.skins.length;
    this.skinIndex = ((index % count) + count) % count;
    const frameIdx = this.anims.currentFrame?.index ?? 1; // 1-based
    this.play({
      key: animKey(this.def.id, this.skinIndex, this.currentAnim),
      startFrame: frameIdx - 1,
    });
    return this;
  }

  nextSkin() {
    return this.setSkin(this.skinIndex + 1);
  }
}
