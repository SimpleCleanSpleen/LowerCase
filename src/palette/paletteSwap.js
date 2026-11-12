import { PALETTE_ROLES, ROLE_NAMES, hexToRgb, packRgb } from './roles.js';

// key rgb (packed) -> role name
const KEY_TO_ROLE = new Map(
  ROLE_NAMES.map((role) => [packRgb(...hexToRgb(PALETTE_ROLES[role])), role]),
);

/**
 * Recolor a key-color sprite sheet into one canvas per skin.
 *
 * Runs once at load on the CPU (a 256x96 sheet is ~25k pixels, i.e. well under
 * a millisecond per skin), so at runtime every skin is just an ordinary
 * texture: zero shader cost and identical behavior in WebGL and Canvas modes.
 *
 * @param {HTMLImageElement|HTMLCanvasElement} source  key-color sheet
 * @param {Array<{id:string, colors:Record<string,string>}>} skins
 * @returns {HTMLCanvasElement[]} one canvas per skin, same order as `skins`
 */
export function buildSkinCanvases(source, skins) {
  const { width, height } = source;
  const base = document.createElement('canvas');
  base.width = width;
  base.height = height;
  const baseCtx = base.getContext('2d', { willReadFrequently: true });
  baseCtx.drawImage(source, 0, 0);
  const baseData = baseCtx.getImageData(0, 0, width, height).data;

  return skins.map((skin) => {
    // role -> [r,g,b]; roles a skin omits keep their key color (visible bug).
    const lut = new Map();
    for (const role of ROLE_NAMES) {
      lut.set(role, hexToRgb(skin.colors[role] ?? PALETTE_ROLES[role]));
    }

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    const img = ctx.createImageData(width, height);
    const out = img.data;
    let unknown = 0;

    for (let i = 0; i < baseData.length; i += 4) {
      const a = baseData[i + 3];
      if (a === 0) continue;
      const role = KEY_TO_ROLE.get(packRgb(baseData[i], baseData[i + 1], baseData[i + 2]));
      if (role) {
        const [r, g, b] = lut.get(role);
        out[i] = r;
        out[i + 1] = g;
        out[i + 2] = b;
      } else {
        // Not a key color: pass through untouched.
        out[i] = baseData[i];
        out[i + 1] = baseData[i + 1];
        out[i + 2] = baseData[i + 2];
        unknown++;
      }
      out[i + 3] = a;
    }

    if (unknown > 0) {
      console.warn(`[palette] skin "${skin.id}": ${unknown} pixels are not key colors`);
    }
    ctx.putImageData(img, 0, 0);
    return canvas;
  });
}
