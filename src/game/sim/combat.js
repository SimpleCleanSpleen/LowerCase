/**
 * Box math and hit resolution. Rects are {x, y, w, h} with x/y = top-left.
 *
 * Hitbox convention (from the design spec): offsets are measured from the
 * fighter's center point (middle of the hurtbox) to the CENTER of the hitbox.
 * +x = forward (facing direction), +y = down.
 */

export function hurtbox(f) {
  const { w, h } = f.def.hurtbox;
  return { x: f.x - w / 2, y: f.y - h, w, h };
}

/** Hitbox of the current move (any phase), or null when not attacking. */
export function hitbox(f) {
  if (f.state !== 'attack' || !f.move) return null;
  const hb = f.move.hitbox;
  const cx = f.x + f.facing * hb.x;
  const cy = f.centerY + hb.y;
  return { x: cx - hb.w / 2, y: cy - hb.h / 2, w: hb.w, h: hb.h };
}

export function overlaps(a, b) {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

/**
 * Check every active hitbox against every opposing hurtbox. All hits on a tick
 * are detected before any are applied, so simultaneous hits trade fairly.
 * Each attack can connect at most once.
 * @returns {Array<{attacker, defender, move, charge, damage, blocked}>}
 */
export function resolveHits(fighters) {
  const hits = [];
  for (const atk of fighters) {
    if (atk.phase !== 'active' || atk.hasHit) continue;
    const box = hitbox(atk);
    for (const def of fighters) {
      if (def !== atk && overlaps(box, hurtbox(def))) hits.push({ atk, def });
    }
  }

  return hits.map(({ atk, def }) => {
    const blocked = def.isBlocking;
    const damage = blocked ? 0 : atk.currentDamage();
    atk.hasHit = true;
    def.damageTaken += damage;
    def.flash = 6;
    def.flashBlocked = blocked;
    return {
      attacker: atk.def.displayName,
      defender: def.def.displayName,
      move: atk.move.name,
      charge: `${atk.charge}/${atk.move.maxCharge}`,
      damage,
      blocked,
    };
  });
}
