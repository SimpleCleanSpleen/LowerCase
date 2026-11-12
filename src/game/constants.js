// Internal (logical) resolution. The canvas is scaled up to fit the window.
// 384x216 is 16:9 and scales by 5 to exactly 1920x1080.
export const GAME_WIDTH = 384;
export const GAME_HEIGHT = 216;

// Y coordinate of the stage floor (fighters' feet).
export const FLOOR_Y = 196;

// Art scale: 1 ft = 12 px. Herc (5'0") = 60 px tall, Bella (7'0") = 84 px.
export const PX_PER_FOOT = 12;

// Characters loaded at boot. Each id maps to public/assets/characters/<id>/.
export const ROSTER = ['herc', 'bella'];
