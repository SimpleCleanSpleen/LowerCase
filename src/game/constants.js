// Internal (logical) resolution. The canvas is scaled up to fit the window.
// 480x270 is 16:9 and scales by 4 to exactly 1920x1080. Sized so the
// tallest jump (Bella: 84px body + ~122px apex) stays fully on screen.
export const GAME_WIDTH = 480;
export const GAME_HEIGHT = 270;

// Y coordinate of the stage floor (fighters' feet).
export const FLOOR_Y = 250;

// Art scale: 1 ft = 12 px. Herc (5'0") = 60 px tall, Bella (7'0") = 84 px.
export const PX_PER_FOOT = 12;

// Fixed simulation rate. All frame data ("10f startup") is in these ticks,
// independent of the monitor's refresh rate.
export const SIM_HZ = 60;

// Characters loaded at boot. Each id maps to public/assets/characters/<id>/.
export const ROSTER = ['herc', 'bella'];
