/**
 * Palette roles + their KEY colors.
 *
 * Every character sprite sheet is painted using ONLY these exact key colors
 * (plus full transparency). At load time each skin remaps key color -> skin
 * color, producing one recolored texture per skin.
 *
 * The keys are deliberately garish so an un-swapped sheet is obvious.
 * Add roles at the end; never change an existing key color once real art
 * uses it.
 *
 * Plain ESM with no imports so tools/ (Node) can share it with the game.
 */
export const PALETTE_ROLES = {
  outline: '#000000',
  visor: '#400040', // eye slits, boot leather, darkest interior detail
  skin: '#ff8000',
  skinShade: '#c04000',
  hair: '#804000', // hair, brows, Herc's mustache
  armor: '#00ff00',
  armorShade: '#008000',
  trim: '#ffff00', // gold/silver trim, sigil border
  sigil: '#00ffff', // the shared knightly emblem
  cape: '#ff0000', // cape / plume / tabard cloth
  armorLight: '#80ff80', // specular highlight on armor
  capeShade: '#800000',
  steel: '#8080ff', // weapon blades
  steelShade: '#4040a0',
  wood: '#ff80c0', // weapon hafts
  woodShade: '#a04070',
};

export const ROLE_NAMES = Object.keys(PALETTE_ROLES);

/** '#rrggbb' -> [r, g, b] */
export function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
}

/** Pack rgb into a single int for fast Map lookups. */
export function packRgb(r, g, b) {
  return (r << 16) | (g << 8) | b;
}
