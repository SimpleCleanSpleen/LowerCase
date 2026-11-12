#!/usr/bin/env node
/** Regenerates all procedural art:  npm run gen:art */
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildFighter } from './fighters.mjs';
import { buildUi } from './fx.mjs';
import { buildStages } from './stages.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
for (const id of ['herc', 'bella']) console.log(`fighter ${id}: ${buildFighter(ROOT, id).names.length} poses`);
console.log(`stages: ${buildStages(ROOT).join(', ')}`);
buildUi(ROOT);
console.log('ui: font + fx');
