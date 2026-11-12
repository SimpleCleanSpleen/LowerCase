import { stageKey, stageLayerKey } from '../../assets/keys.js';

/** Parallax stage: each layer scrolls at its own factor; torches flicker. */
export class StageView {
  constructor(scene, id) {
    this.scene = scene;
    this.meta = scene.cache.json.get(stageKey(id));
    this.flames = [];
    for (const L of this.meta.layers) {
      const depth = L.front ? 50 : -10 + L.scroll;
      scene.add.image(0, 0, stageLayerKey(id, L.file)).setOrigin(0, 0).setScrollFactor(L.scroll, 0).setDepth(depth);
      for (const t of L.torches) {
        const f = scene.add.sprite(t.x, t.y + 3, 'fx', 0).setOrigin(0.5, 30 / 32).setScrollFactor(L.scroll, 0).setDepth(depth + 0.01);
        if (t.small) f.setScale(0.6);
        f.phase = Math.floor(Math.random() * 4);
        this.flames.push(f);
      }
    }
  }

  update(t) {
    for (const f of this.flames) f.setFrame((Math.floor(t / 6) + f.phase) % 4);
  }
}
