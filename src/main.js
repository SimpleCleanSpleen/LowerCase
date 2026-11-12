import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from './game/constants.js';
import { BootScene } from './scenes/BootScene.js';
import { PreloadScene } from './scenes/PreloadScene.js';
import { StageScene } from './scenes/StageScene.js';

const game = new Phaser.Game({
  type: Phaser.AUTO, // WebGL, falls back to Canvas
  parent: 'game',
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  backgroundColor: '#0b0b12',
  pixelArt: true, // nearest-neighbor sampling, no antialiasing
  roundPixels: true,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  fps: { target: 60 },
  scene: [BootScene, PreloadScene, StageScene],
});

// Handy for poking at things from the devtools console.
if (import.meta.env.DEV) window.game = game;
