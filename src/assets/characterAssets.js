import { buildSkinCanvases } from '../palette/paletteSwap.js';
import { artKey, assetUrl, baseSheetKey, defKey, skinTextureKey } from './keys.js';

const charPath = (id, file) => assetUrl(`characters/${id}/${file}`);

/** Boot: queue each character's design data + generated art metadata. */
export function queueCharacterDefs(scene, roster) {
  for (const id of roster) {
    scene.load.json(defKey(id), charPath(id, 'character.json'));
    scene.load.json(artKey(id), charPath(id, 'art.json'));
  }
}

/** Preload: queue each character's key-color sprite sheet. */
export function queueCharacterSheets(scene, roster) {
  for (const id of roster) scene.load.image(baseSheetKey(id), charPath(id, 'sheet.png'));
}

/**
 * Build one recolored, frame-sliced texture per skin of every character.
 * @returns {Record<string, object>} character defs by id (with .art attached)
 */
export function buildCharacterAssets(scene, roster) {
  const defs = {};
  for (const id of roster) {
    const def = scene.cache.json.get(defKey(id));
    const art = scene.cache.json.get(artKey(id));
    const source = scene.textures.get(baseSheetKey(id)).getSourceImage();
    buildSkinCanvases(source, def.skins).forEach((canvas, i) => {
      const tex = scene.textures.addCanvas(skinTextureKey(id, i), canvas);
      const cols = Math.floor(canvas.width / art.frameWidth);
      const count = Object.keys(art.poses).length;
      for (let f = 0; f < count; f++) {
        tex.add(f, 0, (f % cols) * art.frameWidth, Math.floor(f / cols) * art.frameHeight, art.frameWidth, art.frameHeight);
      }
    });
    scene.textures.remove(baseSheetKey(id));
    defs[id] = { ...def, art };
  }
  return defs;
}
