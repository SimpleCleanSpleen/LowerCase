import Phaser from 'phaser';
import { FONT } from '../../assets/keys.js';

/** Register the generated pixel font (call once after font.png is loaded). */
export function registerFont(scene) {
  if (scene.cache.bitmapFont.exists(FONT)) return;
  const meta = scene.cache.json.get('fontmeta');
  const data = Phaser.GameObjects.RetroFont.Parse(scene, {
    image: 'font',
    width: meta.width,
    height: meta.height,
    chars: meta.chars,
    charsPerRow: meta.charsPerRow,
    spacing: { x: 0, y: 0 },
    offset: { x: 0, y: 0 },
    lineSpacing: 1,
  });
  scene.cache.bitmapFont.add(FONT, data);
}

/**
 * Pixel text. opts: { scale, tint, align: 'left'|'center'|'right', depth, fixed }
 * Text is uppercased (the font is caps-only).
 */
export function text(scene, x, y, str, opts = {}) {
  const t = scene.add.bitmapText(x, y, FONT, String(str).toUpperCase());
  t.setLetterSpacing(-1);
  t.setScale(opts.scale ?? 1);
  if (opts.tint !== undefined) t.setTint(opts.tint);
  const ox = opts.align === 'center' ? 0.5 : opts.align === 'right' ? 1 : 0;
  t.setOrigin(ox, opts.valign === 'middle' ? 0.5 : 0);
  if (opts.depth !== undefined) t.setDepth(opts.depth);
  if (opts.fixed !== false) t.setScrollFactor(0);
  return t;
}

export function setText(t, str) {
  t.setText(String(str).toUpperCase());
  return t;
}
