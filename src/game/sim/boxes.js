/**
 * Collision boxes. Rects are {x, y, w, h} with x/y = top-left, world space.
 * Hitbox data is authored relative to the fighter's feet: {x, y} is the
 * CENTER of the box, +x = forward (facing), +y = down (so y < 0 is above).
 */

export function hurtbox(f) {
  if (f.state === 'down' || f.state === 'ko' || f.state === 'getup') return null;
  const B = f.def.boxes;
  if (!f.grounded || f.state === 'launch' || f.state === 'thrown') {
    const a = B.air;
    return { x: f.x - a.w / 2, y: f.y + (a.y ?? 0) - a.h, w: a.w, h: a.h };
  }
  const b = f.isCrouchBox ? B.crouch : B.stand;
  return { x: f.x - b.w / 2, y: f.y - b.h, w: b.w, h: b.h };
}

export function hitbox(f) {
  if (f.state !== 'attack' || f.phase !== 'active' || !f.move?.hitbox) return null;
  const hb = f.move.hitbox;
  return { x: f.x + f.facing * hb.x - hb.w / 2, y: f.y + hb.y - hb.h / 2, w: hb.w, h: hb.h };
}

/** Pushbox: horizontal body width; vertical span of the current hurtbox. */
export function pushbox(f) {
  const w = f.def.boxes.push.w;
  const h = f.grounded ? (f.isCrouchBox ? f.def.boxes.crouch.h : f.def.boxes.stand.h) : f.def.boxes.air.h;
  return { x: f.x - w / 2, y: f.y - h, w, h };
}

export function overlaps(a, b) {
  return !!a && !!b && a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}
