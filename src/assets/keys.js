// Single source of truth for cache / texture key naming.
export const defKey = (id) => `chardef:${id}`;
export const artKey = (id) => `charart:${id}`;
export const baseSheetKey = (id) => `${id}:base`;
export const skinTextureKey = (id, skinIndex) => `${id}:skin${skinIndex}`;
export const stageKey = (id) => `stage:${id}`;
export const stageLayerKey = (id, file) => `stage:${id}:${file}`;
export const FONT = 'pixel';
