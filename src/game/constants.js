// Internal (logical) resolution; the canvas scales up to fit the window.
// 480x270 is 16:9 and scales by exactly 4 to 1920x1080.
export const GAME_WIDTH = 480;
export const GAME_HEIGHT = 270;

// Stages are wider than the screen; the camera follows the fighters.
export const STAGE_WIDTH = 768;
export const FLOOR_Y = 236;
/** Fighters can't get further apart than this (keeps both on screen). */
export const MAX_SEPARATION = GAME_WIDTH - 72;

// Art scale: 1 ft = 16 px. Herc (5'0") = 80 px tall, Bella (7'0") = 112 px.
export const PX_PER_FOOT = 16;

// Fixed simulation rate. All frame data is counted in these ticks.
export const SIM_HZ = 60;

export const ROUND_SECONDS = 60;
export const ROUNDS_TO_WIN = 2;

// Characters loaded at boot. Each id maps to public/assets/characters/<id>/.
export const ROSTER = ['herc', 'bella'];
