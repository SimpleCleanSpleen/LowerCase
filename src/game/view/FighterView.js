import Phaser from 'phaser';
import { skinTextureKey } from '../../assets/keys.js';
import { FLOOR_Y } from '../constants.js';

/**
 * Renders a FighterSim. Frames are chosen directly from sim state every
 * frame (no time-based animations), so what you see always matches the
 * frame data exactly.
 */
export class FighterView {
  constructor(scene, def, skinIndex, depth = 10) {
    this.scene = scene;
    this.def = def;
    this.art = def.art;
    this.skinIndex = skinIndex;
    this.shadow = scene.add.ellipse(0, FLOOR_Y + 1, 44, 7, 0x000000, 0.35).setDepth(depth - 1);
    this.sprite = scene.add
      .sprite(0, 0, skinTextureKey(def.id, skinIndex), 0)
      .setOrigin(this.art.originX / this.art.frameWidth, this.art.originY / this.art.frameHeight)
      .setDepth(depth);
  }

  get skin() {
    return this.def.skins[this.skinIndex];
  }

  setSkin(i) {
    this.skinIndex = i;
    this.sprite.setTexture(skinTextureKey(this.def.id, i), this.sprite.frame.name);
  }

  setDepth(d) {
    this.sprite.setDepth(d);
    this.shadow.setDepth(d - 1);
  }

  frame(pose) {
    return this.art.poses[pose] ?? this.art.poses.idle0;
  }

  sync(s, t) {
    const sp = this.sprite;
    sp.setFrame(this.frame(poseFor(s, t)));
    sp.setPosition(Math.round(s.x), Math.round(s.y));
    sp.setFlipX(s.facing < 0);

    const h = Math.max(0, FLOOR_Y - s.y);
    this.shadow.setPosition(Math.round(s.x), FLOOR_Y + 1).setScale(Math.max(0.4, 1 - h / 160), 1).setAlpha(0.35 * Math.max(0.3, 1 - h / 200));

    if (s.flash > 4) sp.setTintFill(s.flashBlocked ? 0xa8d4ff : 0xffffff);
    else if (s.state === 'attack' && s.phase === 'startup' && s.charge > 0) {
      const k = s.charge / s.move.maxCharge;
      const pulse = (Math.sin(t * 0.6) + 1) / 2;
      const full = k >= 1;
      const g = Math.round(255 - (full ? 40 + pulse * 60 : k * 70));
      const b = Math.round(255 - (full ? 120 + pulse * 100 : k * 160));
      sp.setTint(Phaser.Display.Color.GetColor(255, g, b));
    } else if (s.buff > 0 && t % 6 < 3) sp.setTint(0xa8e0ff);
    else if (s.invuln > 0 && s.state !== 'attack' && t % 4 < 2) sp.setTint(0xb0b0ff);
    else sp.clearTint();
  }

  destroy() {
    this.sprite.destroy();
    this.shadow.destroy();
  }
}

const WALK = ['walk0', 'walk1', 'walk2', 'walk3', 'walk4', 'walk5'];
const IDLE = ['idle0', 'idle1', 'idle2', 'idle3'];

export function poseFor(s, t) {
  switch (s.state) {
    case 'idle':
      return IDLE[Math.floor(t / 9) % 4];
    case 'walkF':
      return WALK[Math.floor(s.pf / 6) % 6];
    case 'walkB':
      return WALK[5 - (Math.floor(s.pf / 7) % 6)];
    case 'crouch':
    case 'jumpSquat':
    case 'land':
      return 'crouch';
    case 'guard':
    case 'blockstun':
      return s.crouching ? 'cblock' : 'block';
    case 'dashF':
      return 'dash';
    case 'dashB':
      return 'backdash';
    case 'air':
      if (s.vaultT > 0) return s.vaultT > 8 ? 'uq_strike' : 'uq_follow';
      return s.vy < 60 ? 'jump' : 'fall';
    case 'throwWhiff':
      return 'throw_grab';
    case 'counterStrike':
      return s.pf < 12 ? 'uq_strike' : 'uq_follow';
    case 'attack': {
      const p = s.move?.pose ?? 'mid';
      if (p === 'air') return s.phase === 'startup' ? 'air_wind' : s.phase === 'active' ? 'air_strike' : 'fall';
      if (s.move.kind === 'counter') return 'uq_wind';
      if (s.move.kind === 'buff' && s.phase === 'active') return 'uq_strike';
      if (s.phase === 'active' && s.def.art.poses[`${p}_strike2`] !== undefined && Math.floor(s.pf / 4) % 2) return `${p}_strike2`;
      return `${p}_${s.phase === 'startup' ? 'wind' : s.phase === 'active' ? 'strike' : 'follow'}`;
    }
    case 'hitstun':
      return s.crouching ? 'hit_low' : 'hit_high';
    case 'launch':
    case 'thrown':
      return 'hit_air';
    case 'down':
    case 'ko':
      return 'down';
    case 'getup':
      return 'getup';
    case 'throw':
      return s.pf < s.def.moves.throw.releaseAt ? 'throw_grab' : 'throw_toss';
    case 'win':
      return Math.floor(t / 24) % 2 ? 'win1' : 'win0';
    default:
      return 'idle0';
  }
}
