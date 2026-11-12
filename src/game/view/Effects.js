import { GAME_HEIGHT, GAME_WIDTH } from '../constants.js';

const ROW = { flame: 0, hit: 1, block: 2, dust: 3, wave: 4, spark: 5 };
const fxFrame = (row, col) => row * 6 + col;
const hexInt = (h) => parseInt(h.replace('#', ''), 16);

/** Hit sparks, dust, projectiles, screen flash. Driven by Match events. */
export class Effects {
  constructor(scene) {
    this.scene = scene;
    this.bursts = [];
    this.projSprites = new Map();
    this.flashRect = scene.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0xffffff, 0).setOrigin(0).setScrollFactor(0).setDepth(90);
  }

  burst(kind, x, y, { scale = 1, flipX = false, speed = 3, tint } = {}) {
    const s = this.scene.add.sprite(Math.round(x), Math.round(y), 'fx', fxFrame(ROW[kind], 0)).setDepth(40).setScale(scale).setFlipX(flipX);
    if (tint) s.setTint(tint);
    this.bursts.push({ s, row: ROW[kind], t: 0, speed });
  }

  flash(alpha = 0.7) {
    this.flashRect.setAlpha(alpha);
  }

  onEvent(e, views) {
    switch (e.type) {
      case 'hit':
        this.burst('hit', e.x, e.y, { scale: e.heavy ? 1.6 : 1.1 });
        if (e.heavy) this.burst('hit', e.x + 6, e.y - 6, { scale: 0.8, speed: 4 });
        break;
      case 'block':
        this.burst('block', e.x, e.y, { scale: 1.1 });
        break;
      case 'clash':
        this.burst('hit', e.x, e.y, { scale: 1.4 });
        break;
      case 'land':
        this.burst('dust', e.fighter.x, e.fighter.y - 12, { scale: e.hard ? 1.6 : 1, speed: 4 });
        break;
      case 'dash':
        this.burst('dust', e.fighter.x - e.fighter.facing * 10, e.fighter.y - 12, { flipX: e.fighter.facing < 0, speed: 4 });
        break;
      case 'ko':
        this.flash(0.9);
        break;
      default:
        break;
    }
    void views;
  }

  update(t, match, views) {
    for (const b of this.bursts) {
      b.t++;
      const col = Math.floor(b.t / b.speed);
      if (col > 3) b.dead = true;
      else b.s.setFrame(fxFrame(b.row, col));
    }
    this.bursts = this.bursts.filter((b) => (b.dead ? (b.s.destroy(), false) : true));

    const live = new Set(match.projectiles);
    for (const [p, s] of this.projSprites) if (!live.has(p)) {
      this.burst('block', s.x, s.y, { scale: 1.3, tint: s.tintTopLeft });
      s.destroy();
      this.projSprites.delete(p);
    }
    for (const p of match.projectiles) {
      let s = this.projSprites.get(p);
      if (!s) {
        const tint = hexInt(views[p.owner.side].skin.colors.sigil);
        s = this.scene.add.sprite(p.x, p.y, 'fx', fxFrame(ROW.wave, 0)).setDepth(35).setTint(tint);
        this.projSprites.set(p, s);
      }
      s.setPosition(Math.round(p.x), Math.round(p.y)).setFlipX(p.vx < 0).setFrame(fxFrame(ROW.wave, Math.floor(t / 4) % 4));
    }

    if (this.flashRect.alpha > 0) this.flashRect.setAlpha(Math.max(0, this.flashRect.alpha - 0.05));
  }
}
