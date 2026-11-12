// Single source of truth for cache / texture key naming.
export const defKey = (id) => `chardef:${id}`;
export const artKey = (id) => `charart:${id}`;
export const baseSheetKey = (id) => `${id}:base`;
export const skinTextureKey = (id, skinIndex) => `${id}:skin${skinIndex}`;
export const stageKey = (id) => `stage:${id}`;
export const stageLayerKey = (id, file) => `stage:${id}:${file}`;
export const FONT = 'pixel';

/**
 * URL for a file in public/assets, stamped with the build id. Asset file names
 * don't change between builds, so without this browsers (and GitHub Pages'
 * 10-minute cache) can mix stale sprite sheets with new code.
 */
// eslint-disable-next-line no-undef
export const assetUrl = (path) => `assets/${path}?v=${__BUILD_ID__}`;
