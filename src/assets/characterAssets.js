import { buildSkinCanvases } from '../palette/paletteSwap.js';
import { animKey, baseSheetKey, defKey, skinTextureKey } from './keys.js';

const charPath = (id, file) => `assets/characters/${id}/${file}`;

/** Step 1 (BootScene): queue each character's definition JSON. */
export function queueCharacterDefs(scene, roster) {
  for (const id of roster) scene.load.json(defKey(id), charPath(id, 'character.json'));
}

/** Step 2 (PreloadScene): queue each character's key-color sprite sheet. */
export function queueCharacterSheets(scene, roster) {
  for (const id of roster) {
    const def = scene.cache.json.get(defKey(id));
    scene.load.image(baseSheetKey(id), charPath(id, def.sheet));
  }
}

/**
 * Step 3 (PreloadScene.create): build a recolored, frame-sliced texture plus
 * animations for every skin of every character.
 * @returns {Record<string, object>} character defs by id
 */
export function buildCharacterAssets(scene, roster) {
  const defs = {};
  for (const id of roster) {
    const def = scene.cache.json.get(defKey(id));
    const source = scene.textures.get(baseSheetKey(id)).getSourceImage();
    const canvases = buildSkinCanvases(source, def.skins);

    canvases.forEach((canvas, skinIndex) => {
      const texKey = skinTextureKey(id, skinIndex);
      const tex = scene.textures.addCanvas(texKey, canvas);
      sliceFrames(tex, def.frameWidth, def.frameHeight);

      for (const [name, anim] of Object.entries(def.animations)) {
        scene.anims.create({
          key: animKey(id, skinIndex, name),
          frames: anim.frames.map((frame) => ({ key: texKey, frame })),
          frameRate: anim.frameRate,
          repeat: anim.repeat ?? 0,
        });
      }
    });

    // Base key-color sheet is no longer needed.
    scene.textures.remove(baseSheetKey(id));
    defs[id] = def;
  }
  return defs;
}

/** Slice a texture into a left-to-right, top-to-bottom grid of numbered frames. */
function sliceFrames(texture, fw, fh) {
  const { width, height } = texture.getSourceImage();
  const cols = Math.floor(width / fw);
  const rows = Math.floor(height / fh);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      texture.add(r * cols + c, 0, c * fw, r * fh, fw, fh);
    }
  }
}
