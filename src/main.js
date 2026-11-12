import Phaser from 'phaser';
import { toggleMute, unlockAudio } from './game/audio/Sfx.js';
import { GAME_HEIGHT, GAME_WIDTH } from './game/constants.js';
import { BootScene } from './scenes/BootScene.js';
import { ControllersScene } from './scenes/ControllersScene.js';
import { ControlsScene } from './scenes/ControlsScene.js';
import { FightScene } from './scenes/FightScene.js';
import { MoveListScene } from './scenes/MoveListScene.js';
import { PreloadScene } from './scenes/PreloadScene.js';
import { SelectScene } from './scenes/SelectScene.js';
import { TitleScene } from './scenes/TitleScene.js';

const game = new Phaser.Game({
  type: Phaser.AUTO, // WebGL, falls back to Canvas
  parent: 'game',
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  backgroundColor: '#0b0b12',
  pixelArt: true,
  roundPixels: true,
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  input: { gamepad: false },
  fps: { target: 60 },
  scene: [BootScene, PreloadScene, TitleScene, ControllersScene, ControlsScene, MoveListScene, SelectScene, FightScene],
});

window.addEventListener('keydown', (e) => {
  unlockAudio();
  if (e.code === 'KeyM') toggleMute();
});
window.addEventListener('pointerdown', unlockAudio);

if (import.meta.env.DEV) window.game = game;
