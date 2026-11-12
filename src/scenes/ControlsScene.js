import Phaser from 'phaser';
import { Sfx } from '../game/audio/Sfx.js';
import { GAME_HEIGHT, GAME_WIDTH } from '../game/constants.js';
import { connectedPads } from '../game/input/devices.js';
import { MenuInput } from '../game/input/menu.js';
import { LAYOUTS, drawDiagram } from '../game/view/ControllerDiagram.js';
import { setText, text } from '../game/view/text.js';

/**
 * Control diagrams. Shows the layout of a detected controller by default;
 * a dropdown lets you browse every supported layout.
 */
export class ControlsScene extends Phaser.Scene {
  constructor() {
    super('Controls');
  }

  create() {
    this.cameras.main.setBackgroundColor('#120e22');
    this.menu = new MenuInput(this);
    text(this, GAME_WIDTH / 2, 8, 'CONTROLS', { scale: 2, align: 'center', tint: 0xffd24a });
    this.detectedText = text(this, GAME_WIDTH / 2, 28, '', { align: 'center', tint: 0x9a92b8 });

    this.ddBox = this.add.graphics().setDepth(5);
    this.ddLabel = text(this, GAME_WIDTH / 2, 50, '', { align: 'center', valign: 'middle', depth: 6 });
    this.listBg = this.add.graphics().setDepth(20);
    this.listItems = LAYOUTS.map((l, i) => text(this, GAME_WIDTH / 2, 66 + i * 13, l.name, { align: 'center', valign: 'middle', depth: 21 }));
    this.hint = text(this, GAME_WIDTH / 2, GAME_HEIGHT - 12, '', { align: 'center', tint: 0x9a92b8 });

    this.open = false;
    this.lastPads = '';
    const pads = connectedPads();
    this.sel = pads.length ? LAYOUTS.findIndex((l) => l.id === pads[0].type) : 0;
    this.hi = this.sel;
    this.redraw();
  }

  detected() {
    const pads = connectedPads();
    return new Set(['keyboard', ...pads.map((p) => p.type)]);
  }

  redraw() {
    this.diagram?.destroy();
    this.diagram = drawDiagram(this, LAYOUTS[this.sel].id, GAME_WIDTH / 2, 160);
    const det = this.detected();
    const pads = connectedPads();
    setText(this.detectedText, pads.length ? `DETECTED: KEYBOARD + ${pads.map((p) => LAYOUTS.find((l) => l.id === p.type).name).join(', ')}` : 'DETECTED: KEYBOARD  (PRESS A BUTTON ON A CONTROLLER TO DETECT IT)');
    const cur = LAYOUTS[this.sel];
    setText(this.ddLabel, `${cur.name}${det.has(cur.id) ? ' *' : ''}   ${this.open ? '^' : 'V'}`);
    const g = this.ddBox.clear();
    g.fillStyle(0x1a1626, 1).fillRect(GAME_WIDTH / 2 - 72, 42, 144, 17);
    g.lineStyle(1, 0xffd24a, 1).strokeRect(GAME_WIDTH / 2 - 71.5, 42.5, 143, 16);

    const lb = this.listBg.clear();
    this.listItems.forEach((t, i) => {
      t.setVisible(this.open);
      setText(t, `${LAYOUTS[i].name}${det.has(LAYOUTS[i].id) ? ' *' : ''}`).setTint(i === this.hi ? 0xffd24a : 0xc8c0d8);
    });
    if (this.open) {
      lb.fillStyle(0x1a1626, 0.97).fillRect(GAME_WIDTH / 2 - 72, 59, 144, LAYOUTS.length * 13 + 2);
      lb.lineStyle(1, 0xffd24a, 1).strokeRect(GAME_WIDTH / 2 - 71.5, 59.5, 143, LAYOUTS.length * 13 + 1);
      lb.fillStyle(0x3a2f5a, 1).fillRect(GAME_WIDTH / 2 - 70, 60 + this.hi * 13, 140, 12);
    }
    setText(this.hint, this.open ? 'UP / DOWN CHOOSE   CONFIRM SELECT   BACK CLOSE' : 'CONFIRM: OPEN LAYOUT LIST   LEFT / RIGHT: SWITCH   BACK: TITLE     * = CONNECTED');
  }

  update() {
    const [p] = this.menu.poll();
    const padKey = connectedPads().map((x) => x.type + x.index).join();
    if (padKey !== this.lastPads) {
      this.lastPads = padKey;
      this.redraw();
    }
    if (this.open) {
      if (p.up || p.down) {
        this.hi = (this.hi + (p.up ? -1 : 1) + LAYOUTS.length) % LAYOUTS.length;
        Sfx.move();
        this.redraw();
      }
      if (p.confirm) {
        this.sel = this.hi;
        this.open = false;
        Sfx.confirm();
        this.redraw();
      }
      if (p.back) {
        this.open = false;
        Sfx.back();
        this.redraw();
      }
      return;
    }
    if (p.left || p.right) {
      this.sel = (this.sel + (p.left ? -1 : 1) + LAYOUTS.length) % LAYOUTS.length;
      this.hi = this.sel;
      Sfx.move();
      this.redraw();
    }
    if (p.confirm || p.down) {
      this.open = true;
      this.hi = this.sel;
      Sfx.confirm();
      this.redraw();
    }
    if (p.back) {
      Sfx.back();
      this.scene.start('Title');
    }
  }
}
