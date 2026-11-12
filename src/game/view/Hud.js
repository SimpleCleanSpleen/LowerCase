import { GAME_WIDTH, ROUNDS_TO_WIN } from '../constants.js';
import { setText, text } from './text.js';

const BAR_W = 180;
const BAR_H = 9;
const BAR_Y = 12;
const GOLD = 0xffd24a;

/** Health bars, timer, round pips, combo counters, announcer text. */
export class Hud {
  constructor(scene, match, views, { names, training }) {
    this.scene = scene;
    this.match = match;
    this.views = views;
    this.training = training;
    this.g = scene.add.graphics().setScrollFactor(0).setDepth(100);
    this.trail = [1, 1];
    this.trailDelay = [0, 0];
    this.lastHp = match.fighters.map((f) => f.hp);

    const D = 101;
    this.names = [
      text(scene, 22, BAR_Y + BAR_H + 4, names[0], { depth: D }),
      text(scene, GAME_WIDTH - 22, BAR_Y + BAR_H + 4, names[1], { depth: D, align: 'right' }),
    ];
    this.timer = text(scene, GAME_WIDTH / 2, 7, '', { scale: 2, align: 'center', depth: D, tint: GOLD });
    this.combo = [0, 1].map((i) =>
      text(scene, i ? GAME_WIDTH - 16 : 16, 64, '', { scale: 2, align: i ? 'right' : 'left', depth: D, tint: GOLD }).setAlpha(0),
    );
    this.comboT = [0, 0];
    this.announceText = text(scene, GAME_WIDTH / 2, 104, '', { scale: 4, align: 'center', valign: 'middle', depth: 110 }).setAlpha(0);
    this.announceSub = text(scene, GAME_WIDTH / 2, 132, '', { scale: 2, align: 'center', valign: 'middle', depth: 110, tint: GOLD }).setAlpha(0);
    this.announceT = 0;
    this.info = text(scene, GAME_WIDTH / 2, BAR_Y + BAR_H + 16, '', { align: 'center', depth: D, tint: 0xc8c8e0 });
  }

  announce(str, sub = null, big = false) {
    setText(this.announceText, str).setScale(big ? 6 : 4).setAlpha(1);
    setText(this.announceSub, sub ?? '').setAlpha(sub ? 1 : 0);
    this.announceT = 0;
    this.announceText.setTint(big ? 0xff5a4a : 0xffffff);
    this.scene.tweens.add({ targets: this.announceText, scale: { from: (big ? 6 : 4) * 1.6, to: big ? 6 : 4 }, duration: 160, ease: 'Back.Out' });
  }

  /** Short callout on one side of the screen (e.g. COUNTER!). */
  popup(side, str) {
    const t = text(this.scene, side ? GAME_WIDTH - 16 : 16, 84, str, { scale: 2, align: side ? 'right' : 'left', depth: 105, tint: 0x7ad8ff });
    this.scene.tweens.add({ targets: t, y: 74, alpha: 0, delay: 500, duration: 500, onComplete: () => t.destroy() });
  }

  showCombo(side, n) {
    if (n < 2) return;
    setText(this.combo[side], `${n} HITS`).setAlpha(1);
    this.comboT[side] = 70;
  }

  setInfo(str) {
    setText(this.info, str);
  }

  update() {
    const m = this.match;
    const g = this.g.clear();

    m.fighters.forEach((f, i) => {
      const ratio = f.hp / f.def.maxHp;
      if (f.hp < this.lastHp[i]) this.trailDelay[i] = 28;
      this.lastHp[i] = f.hp;
      if (this.trailDelay[i] > 0) this.trailDelay[i]--;
      else if (this.trail[i] > ratio) this.trail[i] = Math.max(ratio, this.trail[i] - 0.012);
      if (this.trail[i] < ratio) this.trail[i] = ratio;

      const x0 = i ? GAME_WIDTH - 22 - BAR_W : 22;
      // frame
      g.fillStyle(0x140e1e, 1).fillRect(x0 - 2, BAR_Y - 2, BAR_W + 4, BAR_H + 4);
      g.fillStyle(0xc8a040, 1).fillRect(x0 - 1, BAR_Y - 1, BAR_W + 2, 1).fillRect(x0 - 1, BAR_Y + BAR_H, BAR_W + 2, 1);
      g.fillStyle(0x3a1020, 1).fillRect(x0, BAR_Y, BAR_W, BAR_H);
      // damage trail (red) then health (gold) — drains toward the timer
      const tw = Math.round(BAR_W * this.trail[i]);
      const hw = Math.round(BAR_W * ratio);
      const ax = (w) => (i ? x0 + BAR_W - w : x0);
      g.fillStyle(0xd83a3a, 1).fillRect(ax(tw), BAR_Y, tw, BAR_H);
      const low = ratio < 0.25 && Math.floor(m.tick / 8) % 2;
      g.fillStyle(low ? 0xff7a3a : 0xffc83a, 1).fillRect(ax(hw), BAR_Y, hw, BAR_H);
      g.fillStyle(0xfff0a0, 1).fillRect(ax(hw), BAR_Y + 1, hw, 2);
      g.fillStyle(0xc88a20, 1).fillRect(ax(hw), BAR_Y + BAR_H - 2, hw, 2);

      // round win pips
      if (!this.training)
        for (let k = 0; k < ROUNDS_TO_WIN; k++) {
          const px = i ? GAME_WIDTH / 2 + 22 + k * 10 : GAME_WIDTH / 2 - 28 - k * 10;
          g.fillStyle(0x140e1e, 1).fillRect(px - 1, BAR_Y + BAR_H + 5, 8, 8);
          g.fillStyle(k < m.wins[i] ? GOLD : 0x4a3a5a, 1).fillRect(px, BAR_Y + BAR_H + 6, 6, 6);
        }

      if (this.comboT[i] > 0 && --this.comboT[i] < 20) this.combo[i].setAlpha(this.comboT[i] / 20);
    });

    // timer plate
    g.fillStyle(0x140e1e, 1).fillRect(GAME_WIDTH / 2 - 15, 4, 30, 20);
    g.fillStyle(0xc8a040, 1).fillRect(GAME_WIDTH / 2 - 15, 23, 30, 1);
    setText(this.timer, this.training ? '--' : String(m.secondsLeft).padStart(2, '0'));

    if (this.announceText.alpha > 0) {
      this.announceT++;
      if (this.announceT > 55) {
        const a = Math.max(0, 1 - (this.announceT - 55) / 15);
        this.announceText.setAlpha(a);
        if (this.announceSub.alpha > 0) this.announceSub.setAlpha(a);
      }
    }
  }
}
