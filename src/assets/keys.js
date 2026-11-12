// Single source of truth for cache / texture / animation key naming.
export const defKey = (id) => `chardef:${id}`;
export const baseSheetKey = (id) => `${id}:base`;
export const skinTextureKey = (id, skinIndex) => `${id}:skin${skinIndex}`;
export const animKey = (id, skinIndex, anim) => `${id}:skin${skinIndex}:${anim}`;
