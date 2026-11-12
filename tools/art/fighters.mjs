/**
 * Fighter sprite generator: a tiny 2D rig (IK limbs, shaded capsules,
 * hand-drawn head stamps, rasterized weapons) posed frame by frame.
 * Outputs, per character:
 *   public/assets/characters/<id>/sheet.png   key-color sprite sheet
 *   public/assets/characters/<id>/art.json    frame size, origin, pose -> frame index
 */
import { join } from 'node:path';
import { PALETTE_ROLES } from '../../src/palette/roles.js';
import { RoleCanvas, capsule, circle, encodePng, hex, polygon, rolesToRgba, stamp, writeFile } from './lib.mjs';

const FW = 224;
const FH = 176;
const OX = 112; // origin (feet center) inside each frame
const OY = 168;
const COLS = 8;

const D = Math.PI / 180;
const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const mul = (a, k) => [a[0] * k, a[1] * k];
const len = (a) => Math.hypot(a[0], a[1]);
const rot = (v, a) => [v[0] * Math.cos(a) - v[1] * Math.sin(a), v[0] * Math.sin(a) + v[1] * Math.cos(a)];
/** Angle convention: 0 = up, 90 = forward (+x), 180 = down. */
const dir = (deg) => [Math.sin(deg * D), -Math.cos(deg * D)];

/** Two-bone IK. pick(j1, j2) chooses the joint solution. */
function ik(root, target, l1, l2, pick) {
  const v = sub(target, root);
  const d = Math.min(Math.max(len(v), Math.abs(l1 - l2) + 0.01), l1 + l2 - 0.01);
  const u = mul(v, 1 / (len(v) || 1));
  const a = Math.acos(Math.min(1, Math.max(-1, (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d))));
  const j1 = add(root, mul(rot(u, a), l1));
  const j2 = add(root, mul(rot(u, -a), l1));
  return { joint: pick(j1, j2), end: add(root, mul(u, d)) };
}

const FRONT = ['armor', 'armorShade', 'armorLight'];
const BACK = ['armorShade', 'visor', 'armor'];
const SKIN = ['skin', 'skinShade'];
const WOOD = ['wood', 'woodShade'];

const LEGEND = {
  o: 'outline', A: 'armor', a: 'armorShade', L: 'armorLight', T: 'trim', S: 'skin', s: 'skinShade',
  H: 'hair', V: 'visor', C: 'cape', c: 'capeShade', G: 'sigil', M: 'steel', m: 'steelShade',
};

// Shared knightly sigil: shield with an upward chevron.
const SIGIL = ['ooooooo', 'oTTTTTo', 'oTGTGTo', 'oGTGTGo', 'oTGGGTo', '.oTGTo.', '..oTo..', '...o...'];

// ---------------------------------------------------------------- heads --
// Facing right (3/4 view). Anchor = bottom-center where the neck attaches.

const HERC_HEAD = {
  ax: 9,
  ay: 20,
  rows: [
    '.....ooooo..........',
    '...ooCCCCCoo........',
    '..oCCCccCCCCo.......',
    '.oCcoooooooCCo......',
    '.ocoLLLLLLAooo......',
    'ooLLLLLAAAAAAo......',
    'oLLLAAAAAAAAAAo.....',
    'oLAAAAAAAAAAAAAo....',
    'oAAAAAAaTTTTTTTo....',
    'oAAAAAaToHHHooHHo...',
    'oaAAAAaToSSHHHSSSo..',
    'oaAAAAaToSSSoVSSSSo.',
    'oaAAAaaToSSSSSSSSSo.',
    'oaaAAaaToSsSSSSSSSso',
    '.oaaAaaToHHHHHHHHHHo',
    '.oaaaaaHHHHHHHHHHHHo',
    '.oaaaaHHoHHHsSHHHoHo',
    '..oaaaaToHoSSSSSoo.o',
    '...oaaaTo.oSSSSso...',
    '....oooTo..ossso....',
    '.......oo...ooo.....',
  ],
};

const BELLA_HEAD = {
  ax: 9,
  ay: 21,
  rows: [
    '......ooooo.......',
    '....ooLLLLAoo.....',
    '...oLLLLAAAAAo....',
    '..oLLLAAAAAAAAo...',
    '..oLLAAAAAAAAAAo..',
    '.oLLAAAAAAAAAAAo..',
    '.oLAAAAAAaTTTTTTo.',
    '.oAAAAAAaToooooooo',
    '.oAAAAAaToHHSSSSSo',
    '.oaAAAAaToSSSSSSSo',
    '.oaAAAAaToSSSoVSSSo',
    '.oaAAAAaToSSSSSSSSo',
    '.oaaAAAaToSSSSSSSSso',
    '.oaaAAAaToSSSSSSSSo.',
    '..oaaAAaToSSSsoSSso.',
    '..oaaaAaToSSSSSoSo..',
    '...oaaaaToSSSSSSso..',
    '...oaaaaTosSSSSso...',
    '....oaaaToossSso....',
    '.....oooTo..ooo.....',
    '.......oTo..........',
    '........o...........',
  ],
};

// Skopos: Corinthian-style helm with a horsehair crest; face mostly covered.
const SKOPOS_HEAD = {
  ax: 9,
  ay: 18,
  rows: [
    '....oooooooo.......',
    '..ooCCCCCCCCoo.....',
    '.oCCCCcccCCCCCo....',
    '.occcooooooocCo....',
    '..oooLLLLLAAoo.....',
    '.oLLLLLAAAAAAAo....',
    'oLLLAAAAAAAAAAAo...',
    'oLAAAAAAAAAAAAAAo..',
    'oAAAAAAAaTTTTTTTo..',
    'oAAAAAAaToooVVVVVo.',
    'oaAAAAAaTAAAoVVVVo.',
    'oaAAAAAaAAAAAAoAAo.',
    'oaAAAAaaAAAAAAAoSSo',
    'oaaAAAaaAAAAAAoSSSo',
    '.oaaAAaaAAAAAAoSso.',
    '.oaaaaaaAAAAAAAoo..',
    '..oaaaaaaAAAAAAo...',
    '...oaaaaaoAAAAo....',
    '....ooooo.oooo.....',
  ],
};

// Bjorn: horned iron cap, big nose, magnificent braided beard (anchor = chin).
const BJORN_HEAD = {
  ax: 10,
  ay: 14,
  rows: [
    'oo................oo',
    'oMo..............oMo',
    'oMMo..oooooooo..oMMo',
    '.oMMooLLLLLAAAooMMo.',
    '..oMMLLLLAAAAAAMMo..',
    '...oLLAAAAAAAAAAAo..',
    '..oLAAAAAAAAAAAAAAo.',
    '..oTTTTTTTTTTTTTTTo.',
    '..oaoSSSSSSSSSSSSSo.',
    '..oaoSHHHSSSSHHHSSo.',
    '..oaoSSoVSSSSSoVSSo.',
    '..oaoSSSSSSSSssSSSSo',
    '..oaHSSSSSSSSssSSSSo',
    '..oHHHHHHHHHHHHHHHHo',
    '..oHHHHHHHsoosHHHHHo',
    '...oHHHHHHHHHHHHHHo.',
    '...oHHHHHHHHHHHHHo..',
    '....oHHHHHHHHHHHo...',
    '.....oHHHHTTHHHo....',
    '......oHHHHHHHo.....',
    '.......oHHHHHo......',
    '........oTTTo.......',
    '.........ooo........',
  ],
};

// -------------------------------------------------------------- weapons --

/** Herc: heavy bearded war axe, one-handed. */
function drawAxe(cv, grip, ang, flip) {
  const d = dir(ang);
  const e = mul(rot(d, Math.PI / 2), flip ? -1 : 1);
  const P = (a, s) => add(add(grip, mul(d, a)), mul(e, s));
  capsule(cv, P(-6, 0), P(27, 0), 1.7, 1.7, WOOD);
  polygon(cv, [P(21, -1), P(25, -1), P(23, -6)], 'steelShade');
  polygon(
    cv,
    [P(18, 1), P(27, 1), P(29, 5), P(33, 11), P(31, 15), P(25, 13), P(21, 8), P(18, 4)],
    (x, y) => {
      const s = (x - grip[0]) * e[0] + (y - grip[1]) * e[1];
      return s > 11 ? 'armorLight' : s > 5 ? 'steel' : 'steelShade';
    },
  );
  circle(cv, P(28, 0), 1.8, ['trim', 'trim']);
}

/** Bella: long glaive, two-handed. */
function drawGlaive(cv, grip, ang, flip) {
  const d = dir(ang);
  const e = mul(rot(d, Math.PI / 2), flip ? -1 : 1);
  const P = (a, s) => add(add(grip, mul(d, a)), mul(e, s));
  capsule(cv, P(-26, 0), P(40, 0), 1.6, 1.6, WOOD);
  circle(cv, P(-27, 0), 2, ['trim', 'trim']);
  polygon(
    cv,
    [P(39, -2.5), P(56, -2.5), P(64, -1), P(57, 2.5), P(50, 5), P(43, 4.5), P(39, 3)],
    (x, y) => {
      const s = (x - grip[0]) * e[0] + (y - grip[1]) * e[1];
      return s > 2.5 ? 'armorLight' : s > -0.5 ? 'steel' : 'steelShade';
    },
  );
  capsule(cv, P(38.5, -4.5), P(38.5, 5), 1.4, 1.4, ['trim', 'trim']);
}

/** Skopos: a straight two-handed longsword. */
function drawSword(cv, grip, ang, flip) {
  const d = dir(ang);
  const e = mul(rot(d, Math.PI / 2), flip ? -1 : 1);
  const P = (a, s) => add(add(grip, mul(d, a)), mul(e, s));
  capsule(cv, P(-8, 0), P(1, 0), 1.6, 1.6, ['visor', 'outline']);
  circle(cv, P(-9, 0), 2, ['trim', 'trim']);
  polygon(
    cv,
    [P(2, -2.2), P(34, -1.8), P(40, 0), P(34, 1.8), P(2, 2.2)],
    (x, y) => {
      const s = (x - grip[0]) * e[0] + (y - grip[1]) * e[1];
      return s > 0.8 ? 'armorLight' : s > -0.8 ? 'steel' : 'steelShade';
    },
  );
  capsule(cv, P(1.5, -5.5), P(1.5, 5.5), 1.3, 1.3, ['trim', 'trim']);
}

/** Bjorn: a stubby war hammer with a big square head. */
function drawHammer(cv, grip, ang, flip) {
  const d = dir(ang);
  const e = mul(rot(d, Math.PI / 2), flip ? -1 : 1);
  const P = (a, s) => add(add(grip, mul(d, a)), mul(e, s));
  capsule(cv, P(-5, 0), P(14, 0), 1.8, 1.8, WOOD);
  polygon(
    cv,
    [P(12, -8), P(23, -8), P(23, 8), P(12, 8)],
    (x, y) => {
      const s = (x - grip[0]) * e[0] + (y - grip[1]) * e[1];
      const a = (x - grip[0]) * d[0] + (y - grip[1]) * d[1];
      return a > 20.5 ? 'armorLight' : s > 4 ? 'steel' : 'steelShade';
    },
  );
  capsule(cv, P(14.5, -8), P(14.5, 8), 1, 1, ['trim', 'trim'], { outline: null });
  capsule(cv, P(20.5, -8), P(20.5, 8), 1, 1, ['trim', 'trim'], { outline: null });
}

// ----------------------------------------------------------- characters --

const CHARS = {
  herc: {
    leg: { thigh: 17, shin: 16, ankle: 3, rThigh: [7, 5.5], rShin: [5.2, 4.4], spread: 4, knee: 4.2 },
    torso: { len: 25, rHip: 10, rChest: 13.5 },
    arm: { upper: 13, fore: 12, rU: [5.6, 4.6], rF: [4.6, 4], fist: 4.2, pauldron: 7, spread: 6, drop: 4 },
    neck: 3,
    skirt: 9,
    head: HERC_HEAD,
    weapon: drawAxe,
    twoHanded: false,
    boot: 3.4,
  },
  bella: {
    leg: { thigh: 26, shin: 25, ankle: 4, rThigh: [6.2, 4.8], rShin: [4.6, 3.8], spread: 3.5, knee: 3.8 },
    torso: { len: 34, rHip: 8.5, rChest: 11 },
    arm: { upper: 19, fore: 17, rU: [4.6, 3.8], rF: [3.9, 3.3], fist: 3.6, pauldron: 6.2, spread: 5, drop: 4 },
    neck: 4,
    skirt: 17,
    head: BELLA_HEAD,
    weapon: drawGlaive,
    twoHanded: true,
    braid: true,
    cape: true,
    boot: 3.2,
    backGrip: -18,
  },
  skopos: {
    leg: { thigh: 22, shin: 21, ankle: 3, rThigh: [6, 4.8], rShin: [4.6, 3.8], spread: 3.5, knee: 3.8 },
    torso: { len: 28, rHip: 9, rChest: 12 },
    arm: { upper: 16, fore: 15, rU: [4.8, 4], rF: [4, 3.4], fist: 3.7, pauldron: 6.4, spread: 5, drop: 4 },
    neck: 3,
    skirt: 13,
    head: SKOPOS_HEAD,
    weapon: drawSword,
    twoHanded: true,
    cape: true,
    boot: 3.2,
    backGrip: -6,
  },
  bjorn: {
    leg: { thigh: 13, shin: 12, ankle: 3, rThigh: [7.4, 6], rShin: [5.8, 5], spread: 4.5, knee: 4.6 },
    torso: { len: 21, rHip: 11.5, rChest: 14.5 },
    arm: { upper: 11, fore: 10, rU: [5.8, 5], rF: [5, 4.4], fist: 4.6, pauldron: 5.6, spread: 5, drop: 5 },
    neck: 5,
    skirt: 8,
    head: BJORN_HEAD,
    weapon: drawHammer,
    twoHanded: false,
    boot: 3.8,
  },
};

// ---------------------------------------------------------------- figure --

function drawFigure(cv, ch, P) {
  const O = [OX, OY];
  const at = (p) => add(O, p);
  const lean = (P.lean ?? 0) * D;
  const u = [Math.sin(lean), -Math.cos(lean)]; // up along torso
  const f = [Math.cos(lean), Math.sin(lean)]; // forward, perpendicular
  const { leg, torso, arm } = ch;

  const hip = at(P.hip);
  const neck = add(hip, mul(u, torso.len));
  const shoulder = (s) => add(add(neck, mul(u, -arm.drop)), mul(f, s * arm.spread));
  const wd = dir(P.wa ?? 0);
  const grip = at(P.fh);

  const limbArm = (side) => {
    const sh = shoulder(side);
    let hand;
    if (side < 0 && P.bh === undefined) hand = add(grip, mul(wd, ch.backGrip ?? 0));
    else if (side < 0 && typeof P.bh === 'number') hand = add(grip, mul(wd, P.bh));
    else hand = side > 0 ? grip : at(P.bh);
    const up = P[side > 0 ? 'elbowF' : 'elbowB'] === 'up';
    const { joint, end } = ik(sh, hand, arm.upper, arm.fore, (a, b) => ((up ? a[1] < b[1] : a[1] > b[1]) ? a : b));
    return { sh, el: joint, hand: end };
  };
  const limbLeg = (side, foot) => {
    const h = add(hip, mul(f, side * leg.spread));
    const ankle = add(at(foot), [0, -leg.ankle]);
    const back = P.kneesBack;
    const { joint, end } = ik(h, ankle, leg.thigh, leg.shin, (a, b) => ((back ? a[0] < b[0] : a[0] > b[0]) ? a : b));
    return { h, knee: joint, ankle: end };
  };

  const drawArm = (A, roles, side) => {
    if (side > 0) {
      capsule(cv, A.sh, A.el, arm.rU[0], arm.rU[1], roles);
      capsule(cv, A.el, A.hand, arm.rF[0], arm.rF[1], roles);
      const cuff = add(A.el, mul(sub(A.hand, A.el), 0.72));
      circle(cv, cuff, arm.rF[1] + 0.8, ['trim', 'trim'], { outline: 'outline' });
      circle(cv, A.hand, arm.fist, roles);
      circle(cv, A.sh, arm.pauldron, roles, { hi: 0.62, lo: -0.05 });
      capsule(cv, add(A.sh, [-arm.pauldron + 1.5, arm.pauldron * 0.55]), add(A.sh, [arm.pauldron - 1.5, arm.pauldron * 0.55]), 1, 1, ['trim', 'trim'], { outline: null });
    } else {
      circle(cv, A.sh, arm.pauldron - 1, roles);
      capsule(cv, A.sh, A.el, arm.rU[0], arm.rU[1], roles);
      capsule(cv, A.el, A.hand, arm.rF[0], arm.rF[1], roles);
      circle(cv, A.hand, arm.fist, roles);
    }
  };
  const drawLeg = (Lg, roles) => {
    capsule(cv, Lg.h, Lg.knee, leg.rThigh[0], leg.rThigh[1], roles);
    capsule(cv, Lg.knee, Lg.ankle, leg.rShin[0], leg.rShin[1], roles);
    circle(cv, Lg.knee, leg.knee, roles, { hi: 0.3 });
    const toeDir = P.toesUp ? [0.2, -1] : [1, 0.15];
    capsule(cv, add(Lg.ankle, [-1, 1]), add(Lg.ankle, mul(toeDir, ch.boot * 2.1)), ch.boot, ch.boot - 0.6, [roles[0], 'visor', roles[2]]);
  };

  const armF = limbArm(1);
  const armB = limbArm(-1);
  const legF = limbLeg(1, P.ff);
  const legB = limbLeg(-1, P.bf);

  // --- back layers
  if (ch.cape) {
    const sw = P.cape ?? 0;
    const top1 = add(add(neck, mul(u, -3)), mul(f, 3));
    const top2 = add(add(neck, mul(u, -2)), mul(f, -9));
    const bot = add(hip, [-12 - sw * 12, 32 - sw * 6]);
    const bot2 = add(hip, [2 - sw * 8, 26 - sw * 4]);
    const ctr = add(hip, [-8 - sw * 10, 18]);
    polygon(cv, [top1, top2, add(ctr, [-8, 0]), bot, add(bot, [6, 2]), bot2], (x) => (x < ctr[0] - 2 ? 'capeShade' : 'cape'));
  }
  if (ch.braid) {
    const headTop = add(neck, mul(u, ch.neck + 12));
    let p = add(headTop, mul(f, -7));
    const sw = P.braid ?? 0;
    for (let i = 0; i < 6; i++) {
      circle(cv, p, 2.8 - i * 0.2, ['hair', 'outline']);
      p = add(p, [-1 - sw * (i + 1) * 0.6, 3.6]);
    }
    circle(cv, add(p, [0, -1.5]), 2, ['trim', 'trim']);
  }
  if (P.weaponBehind) ch.weapon(cv, grip, P.wa ?? 0, P.flip);
  if (!P.backArmFront) drawArm(armB, BACK, -1);
  drawLeg(legB, BACK);

  // --- body
  // Torso: shorten the capsule so its rounded caps don't poke past hips/neck.
  capsule(cv, add(hip, mul(u, torso.rHip * 0.55)), add(neck, mul(u, -torso.rChest * 0.8)), torso.rHip, torso.rChest, FRONT, { hi: 0.4 });
  drawLeg(legF, FRONT);
  // tassets / armored skirt
  const w0 = torso.rHip + 1;
  polygon(
    cv,
    [add(hip, mul(f, -w0)), add(hip, mul(f, w0)), add(add(hip, mul(u, -ch.skirt)), mul(f, w0 + 3)), add(add(hip, mul(u, -ch.skirt)), mul(f, -w0 - 2))],
    (x, y) => {
      const s = (x - hip[0]) * f[0] + (y - hip[1]) * f[1];
      return s > w0 * 0.35 ? 'armor' : 'armorShade';
    },
  );
  // Cloth tabard bearing the shared sigil, hanging from the belt.
  const tb = add(hip, mul(f, 2));
  const tw = torso.rHip * 0.75;
  const tl = ch.skirt + 5;
  polygon(
    cv,
    [add(add(tb, mul(u, 3)), mul(f, -tw)), add(add(tb, mul(u, 3)), mul(f, tw)), add(add(tb, mul(u, -tl)), mul(f, tw - 1.5)), add(add(tb, mul(u, -tl - 2)), mul(f, 0)), add(add(tb, mul(u, -tl)), mul(f, -tw + 1.5))],
    (x, y) => ((x - tb[0]) * f[0] + (y - tb[1]) * f[1] > -tw * 0.3 ? 'cape' : 'capeShade'),
  );
  if (Math.abs(P.lean ?? 0) < 50) {
    const c = add(tb, mul(u, -4));
    stamp(cv, SIGIL, { o: 'outline', T: 'trim', G: 'sigil' }, c[0], c[1], 3, 2);
  }
  const belt = add(hip, mul(u, 2));
  capsule(cv, add(belt, mul(f, -torso.rHip)), add(belt, mul(f, torso.rHip)), 1.6, 1.6, ['trim', 'trim'], { outline: null });
  capsule(cv, add(neck, mul(u, -1)), add(neck, mul(u, ch.neck)), 4.6, 4.2, BACK);
  const headAt = add(neck, mul(u, ch.neck));
  const tilt = (P.lean ?? 0) + (P.head ?? 0);
  stamp(cv, ch.head.rows, LEGEND, headAt[0], headAt[1], ch.head.ax, ch.head.ay, Math.abs(tilt) > 14 ? tilt : 0);

  // --- front layers
  if (P.backArmFront) drawArm(armB, FRONT, -1);
  if (!P.weaponBehind) ch.weapon(cv, grip, P.wa ?? 0, P.flip);
  if (P.smear) drawSmear(cv, P.smear);
  drawArm(armF, FRONT, 1);
}

/** Motion smear: a crescent arc swept between two angles around a pivot. */
function drawSmear(cv, { c, r0, r1, a0, a1 }) {
  const C = add([OX, OY], c);
  const n = 14;
  const outer = [];
  const inner = [];
  for (let i = 0; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n;
    const t = i / n; // thin at the start, thick at the end
    outer.push(add(C, mul(dir(a), r1)));
    inner.push(add(C, mul(dir(a), r1 - (r1 - r0) * t)));
  }
  polygon(cv, [...outer, ...inner.reverse()], (x, y) => (Math.hypot(x - C[0], y - C[1]) > r1 - 2.5 ? 'armorLight' : 'steel'), { outline: null });
}

// ---------------------------------------------------------------- poses --

function cycle(n, fn) {
  return Array.from({ length: n }, (_, i) => fn(i, (i / n) * Math.PI * 2));
}
const shift = (p, dx, dy) => [p[0] + dx, p[1] + dy];

const HERC_POSES = (() => {
  const stance = { hip: [-1, -33], lean: 10, ff: [11, 0], bf: [-12, 0], fh: [18, -46], wa: 28, bh: [13, -55] };
  const P = {};
  cycle(4, (i) => {
    const b = [0, 0.6, 1.2, 0.6][i];
    P[`idle${i}`] = { ...stance, hip: shift(stance.hip, 0, b), fh: shift(stance.fh, 0, b), bh: shift(stance.bh, 0, b) };
  });
  cycle(6, (i, p) => {
    P[`walk${i}`] = {
      ...stance,
      hip: [-1 + Math.sin(p), -33 - Math.abs(Math.sin(p)) * 1.2],
      ff: [11 + 8 * Math.sin(p), -4 * Math.max(0, Math.cos(p))],
      bf: [-12 - 8 * Math.sin(p), -4 * Math.max(0, -Math.cos(p))],
      fh: [18 - Math.sin(p) * 1.5, -46],
    };
  });
  Object.assign(P, {
    dash: { hip: [3, -31], lean: 24, ff: [20, -3], bf: [-16, -1], fh: [22, -40], wa: 60, bh: [14, -46] },
    backdash: { hip: [-3, -36], lean: -12, ff: [10, -6], bf: [-12, -2], fh: [12, -50], wa: 10, bh: [8, -58] },
    crouch: { hip: [0, -20], lean: 20, ff: [14, 0], bf: [-12, 0], fh: [19, -32], wa: 45, bh: [13, -38] },
    jump: { hip: [0, -42], lean: 5, ff: [9, -14], bf: [-8, -9], fh: [16, -54], wa: 15, bh: [10, -60] },
    fall: { hip: [0, -38], lean: 10, ff: [11, -4], bf: [-10, -7], fh: [19, -50], wa: 45, bh: [10, -56] },

    high_wind: { hip: [-4, -33], lean: -14, ff: [12, 0], bf: [-14, 0], fh: [-6, -76], wa: -35, bh: [10, -54] },
    high_strike: {
      hip: [4, -30], lean: 26, ff: [17, 0], bf: [-13, 0], fh: [27, -40], wa: 118, bh: [2, -48],
      smear: { c: [10, -50], r0: 24, r1: 40, a0: -20, a1: 125 },
    },
    high_follow: { hip: [3, -29], lean: 24, ff: [17, 0], bf: [-13, 0], fh: [24, -28], wa: 150, bh: [4, -46] },

    mid_wind: { hip: [-3, -33], lean: 4, ff: [11, 0], bf: [-13, 0], fh: [6, -46], wa: 5, bh: [14, -53] },
    mid_strike: { hip: [4, -32], lean: 16, ff: [16, 0], bf: [-12, 0], fh: [37, -48], wa: 15, bh: [6, -50], elbowF: 'up' },
    mid_follow: { hip: [3, -32], lean: 13, ff: [15, 0], bf: [-12, 0], fh: [28, -47], wa: 15, bh: [8, -52] },

    low_wind: { hip: [-2, -22], lean: 20, ff: [14, 0], bf: [-12, 0], fh: [-6, -26], wa: -115, bh: [11, -36] },
    low_strike: {
      hip: [5, -20], lean: 30, ff: [21, 0], bf: [-12, 0], fh: [29, -14], wa: 100, bh: [8, -34],
      smear: { c: [6, -20], r0: 26, r1: 40, a0: 200, a1: 100 },
    },
    low_follow: { hip: [4, -20], lean: 26, ff: [20, 0], bf: [-12, 0], fh: [25, -11], wa: 118, bh: [8, -34] },

    air_wind: { hip: [0, -42], lean: -6, ff: [9, -14], bf: [-8, -9], fh: [-2, -72], wa: -20, bh: [10, -58] },
    air_strike: {
      hip: [2, -42], lean: 20, ff: [12, -16], bf: [-6, -10], fh: [24, -36], wa: 135, bh: [6, -54],
      smear: { c: [6, -56], r0: 22, r1: 38, a0: 0, a1: 140 },
    },

    sp1_wind: { hip: [-2, -26], lean: 34, ff: [12, 0], bf: [-15, 0], fh: [6, -30], wa: 70, bh: [4, -36] },
    sp1_strike: { hip: [7, -28], lean: 46, ff: [21, 0], bf: [-17, -2], fh: [14, -30], wa: 85, bh: [10, -38] },
    sp1_follow: { hip: [4, -30], lean: 26, ff: [16, 0], bf: [-14, 0], fh: [18, -38], wa: 60, bh: [12, -48] },

    sp2_wind: { hip: [0, -18], lean: 26, ff: [12, 0], bf: [-12, 0], fh: [12, -22], wa: 70, bh: [8, -30] },
    sp2_strike: {
      hip: [4, -40], lean: -4, ff: [7, -9], bf: [-8, -2], fh: [15, -88], wa: 15, bh: [6, -52],
      smear: { c: [8, -50], r0: 22, r1: 40, a0: 150, a1: 10 },
    },
    sp2_follow: { hip: [2, -40], lean: -8, ff: [6, -11], bf: [-6, -8], fh: [10, -86], wa: 0, bh: [4, -54] },

    throw_grab: { hip: [2, -32], lean: 15, ff: [15, 0], bf: [-12, 0], fh: [28, -52], wa: 30, bh: [25, -58], backArmFront: true },
    throw_toss: { hip: [5, -31], lean: 24, ff: [18, 0], bf: [-12, 0], fh: [35, -58], wa: 50, bh: [32, -50], backArmFront: true },

    block: { hip: [-3, -33], lean: -2, ff: [11, 0], bf: [-13, 0], fh: [15, -58], wa: 50, bh: [12, -66], backArmFront: true },
    cblock: { hip: [-2, -20], lean: 10, ff: [13, 0], bf: [-12, 0], fh: [17, -36], wa: 60, bh: [14, -43], backArmFront: true },

    hit_high: { hip: [-6, -33], lean: -18, ff: [9, 0], bf: [-14, 0], fh: [6, -46], wa: -20, bh: [-2, -46], head: -10 },
    hit_low: { hip: [-4, -20], lean: -4, ff: [12, 0], bf: [-12, 0], fh: [10, -30], wa: 10, bh: [4, -32] },
    hit_air: { hip: [0, -40], lean: -40, ff: [14, -22], bf: [6, -16], fh: [-14, -52], wa: -60, bh: [-10, -64] },
    down: { hip: [0, -7], lean: -86, ff: [30, -1], bf: [26, -4], fh: [-20, -4], wa: -100, bh: [-26, -12], toesUp: true },
    getup: { hip: [-2, -15], lean: -30, ff: [15, 0], bf: [-6, 0], fh: [-15, -3], wa: 30, bh: [4, -24] },

    win0: { hip: [0, -34], lean: 0, ff: [10, 0], bf: [-11, 0], fh: [15, -80], wa: 8, bh: [-8, -40] },
    win1: { hip: [0, -33], lean: 0, ff: [10, 0], bf: [-11, 0], fh: [17, -84], wa: -4, bh: [-8, -40] },

    // Grudge Counter: defiant parry stance, then the punishing swing
    uq_wind: { hip: [-3, -31], lean: -8, ff: [12, 0], bf: [-15, 0], fh: [15, -60], wa: -62, bh: [17, -50], backArmFront: true, head: 6 },
    uq_strike: {
      hip: [7, -29], lean: 32, ff: [21, 0], bf: [-14, 0], fh: [31, -44], wa: 104, bh: [4, -50],
      smear: { c: [10, -50], r0: 22, r1: 46, a0: -60, a1: 120 },
    },
    uq_follow: { hip: [5, -29], lean: 26, ff: [20, 0], bf: [-14, 0], fh: [27, -28], wa: 148, bh: [6, -46] },
  });
  return P;
})();

const BELLA_POSES = (() => {
  const stance = { hip: [-2, -52], lean: 4, ff: [16, 0], bf: [-16, 0], fh: [17, -66], wa: 40, braid: 0.3, cape: 0.2 };
  const P = {};
  cycle(4, (i) => {
    const b = [0, 0.6, 1.2, 0.6][i];
    P[`idle${i}`] = { ...stance, hip: shift(stance.hip, 0, b), fh: shift(stance.fh, 0, b), braid: 0.2 + b * 0.15 };
  });
  cycle(6, (i, p) => {
    P[`walk${i}`] = {
      ...stance,
      hip: [-2 + Math.sin(p), -52 - Math.abs(Math.sin(p)) * 1.5],
      ff: [16 + 10 * Math.sin(p), -5 * Math.max(0, Math.cos(p))],
      bf: [-16 - 10 * Math.sin(p), -5 * Math.max(0, -Math.cos(p))],
      cape: 0.5,
      braid: 0.6,
    };
  });
  Object.assign(P, {
    dash: { hip: [3, -50], lean: 18, ff: [28, -4], bf: [-20, -1], fh: [24, -60], wa: 70, cape: 1, braid: 1.2 },
    backdash: { hip: [-3, -55], lean: -10, ff: [14, -8], bf: [-16, -2], fh: [12, -70], wa: 25, cape: -0.4, braid: -0.4 },
    crouch: { hip: [0, -32], lean: 16, ff: [17, 0], bf: [-16, 0], fh: [19, -46], wa: 58, cape: 0.1 },
    jump: { hip: [0, -60], lean: 5, ff: [11, -20], bf: [-10, -13], fh: [17, -74], wa: 30, braid: -0.6, cape: -0.4 },
    fall: { hip: [0, -57], lean: 8, ff: [13, -6], bf: [-12, -9], fh: [19, -70], wa: 50, braid: 0.9, cape: 0.8 },

    high_wind: { hip: [-4, -52], lean: -10, ff: [16, 0], bf: [-17, 0], fh: [4, -100], wa: -25, braid: 0.6, cape: 0.4 },
    high_strike: {
      hip: [4, -50], lean: 18, ff: [21, 0], bf: [-16, 0], fh: [25, -72], wa: 125, cape: 0.8, braid: 1,
      smear: { c: [12, -78], r0: 40, r1: 62, a0: -10, a1: 128 },
    },
    high_follow: { hip: [3, -48], lean: 16, ff: [21, 0], bf: [-16, 0], fh: [22, -60], wa: 150, cape: 0.6, braid: 0.8 },

    mid_wind: { hip: [-5, -52], lean: -3, ff: [15, 0], bf: [-17, 0], fh: [4, -66], wa: 86, cape: 0.2 },
    mid_strike: { hip: [6, -50], lean: 12, ff: [25, 0], bf: [-16, 0], fh: [30, -62], wa: 96, bh: -20, cape: 0.7, braid: 0.9 },
    mid_follow: { hip: [4, -51], lean: 8, ff: [23, 0], bf: [-16, 0], fh: [24, -62], wa: 95, cape: 0.5 },

    low_wind: { hip: [-2, -34], lean: 18, ff: [18, 0], bf: [-16, 0], fh: [-4, -40], wa: -118, bh: -14, cape: 0.2 },
    low_strike: {
      hip: [5, -32], lean: 24, ff: [25, 0], bf: [-16, 0], fh: [26, -30], wa: 100, cape: 0.8, braid: 1,
      smear: { c: [8, -30], r0: 46, r1: 64, a0: 210, a1: 102 },
    },
    low_follow: { hip: [4, -32], lean: 20, ff: [24, 0], bf: [-16, 0], fh: [22, -26], wa: 112, cape: 0.6 },

    air_wind: { hip: [0, -60], lean: -6, ff: [11, -20], bf: [-10, -13], fh: [6, -96], wa: -15, braid: -0.4 },
    air_strike: {
      hip: [2, -60], lean: 18, ff: [14, -22], bf: [-8, -14], fh: [26, -64], wa: 140, braid: 0.8, cape: 0.6,
      smear: { c: [10, -84], r0: 36, r1: 56, a0: 0, a1: 145 },
    },

    sp1_wind: { hip: [-3, -52], lean: -5, ff: [15, 0], bf: [-17, 0], fh: [6, -82], wa: 0, cape: 0.3 },
    sp1_strike: { hip: [5, -50], lean: 10, ff: [23, 0], bf: [-16, 0], fh: [30, -70], wa: 70, cape: 0.8, braid: 0.8 },
    sp1_follow: { hip: [4, -51], lean: 8, ff: [22, 0], bf: [-16, 0], fh: [27, -68], wa: 65, cape: 0.5 },

    sp2_wind: { hip: [0, -32], lean: 18, ff: [17, 0], bf: [-16, 0], fh: [10, -32], wa: 150, bh: -16, cape: 0.2 },
    sp2_strike: {
      hip: [4, -58], lean: -6, ff: [11, -8], bf: [-10, -1], fh: [20, -94], wa: 18, cape: -0.3, braid: 1.2,
      smear: { c: [10, -66], r0: 40, r1: 62, a0: 160, a1: 14 },
    },
    sp2_follow: { hip: [2, -58], lean: -10, ff: [9, -10], bf: [-8, -6], fh: [13, -98], wa: -5, cape: -0.2, braid: 1.2 },

    throw_grab: { hip: [2, -51], lean: 10, ff: [19, 0], bf: [-16, 0], fh: [20, -66], wa: 35, bh: [30, -74], backArmFront: true },
    throw_toss: { hip: [6, -50], lean: 20, ff: [23, 0], bf: [-16, 0], fh: [24, -70], wa: 30, bh: [40, -78], backArmFront: true, cape: 0.7 },

    block: { hip: [-4, -52], lean: -4, ff: [15, 0], bf: [-17, 0], fh: [15, -82], wa: 12, bh: -32, cape: 0.1 },
    cblock: { hip: [-2, -32], lean: 6, ff: [17, 0], bf: [-16, 0], fh: [19, -62], wa: 14, bh: -28 },

    hit_high: { hip: [-8, -52], lean: -16, ff: [14, 0], bf: [-18, 0], fh: [9, -66], wa: 10, head: -10, braid: 0.9, cape: 0.6 },
    hit_low: { hip: [-4, -32], lean: -4, ff: [16, 0], bf: [-16, 0], fh: [13, -46], wa: 40, cape: 0.3 },
    hit_air: { hip: [0, -58], lean: -40, ff: [18, -32], bf: [8, -22], fh: [-16, -80], wa: -40, bh: [-24, -70], braid: 1, cape: 0.9 },
    down: { hip: [0, -9], lean: -86, ff: [46, -2], bf: [42, -6], fh: [-32, -4], wa: -95, bh: [-22, -15], toesUp: true, cape: 0, braid: 0 },
    getup: { hip: [-2, -24], lean: -25, ff: [21, 0], bf: [-6, 0], fh: [-20, -4], wa: 10, bh: [8, -32] },

    win0: { hip: [0, -53], lean: 0, ff: [14, 0], bf: [-15, 0], fh: [14, -70], wa: 0, bh: [-12, -104], backArmFront: false, cape: 0.2 },
    win1: { hip: [0, -53], lean: 0, ff: [14, 0], bf: [-15, 0], fh: [14, -70], wa: 0, bh: [-4, -106], cape: 0.2 },

    // Guardian Vault: plant the glaive, swing up and over it
    uq_wind: { hip: [3, -48], lean: 16, ff: [21, 0], bf: [-14, 0], fh: [27, -64], wa: 162, cape: 0.5, braid: 0.6 },
    uq_strike: { hip: [6, -66], lean: 58, ff: [-6, -62], bf: [-16, -52], fh: [24, -76], wa: 172, cape: 1.2, braid: 1.4, kneesBack: true },
    uq_follow: { hip: [0, -62], lean: 20, ff: [12, -24], bf: [-8, -16], fh: [22, -78], wa: 60, cape: 0.8, braid: 1 },
  });
  return P;
})();

/**
 * Derive a pose set from another character's: scale positions (kx, ky),
 * swap the back-hand grip for this weapon, then apply per-pose overrides.
 */
function adapt(src, kx, ky, backGrip, overrides) {
  const S = (p) => [p[0] * kx, p[1] * ky];
  const out = {};
  for (const [n, P] of Object.entries(src)) {
    const q = { ...P, hip: S(P.hip), ff: S(P.ff), bf: S(P.bf), fh: S(P.fh) };
    if (Array.isArray(P.bh)) q.bh = S(P.bh);
    else q.bh = backGrip;
    if (P.smear) q.smear = { ...P.smear, c: S(P.smear.c), r0: P.smear.r0 * kx, r1: P.smear.r1 * kx };
    out[n] = q;
  }
  for (const [n, o] of Object.entries(overrides)) out[n] = { ...(out[n] ?? {}), ...o };
  return out;
}

const SKOPOS_POSES = adapt(BELLA_POSES, 0.9, 0.85, -6, {
  // Whirling Blade: a two-frame spin
  sp1_wind: { hip: [-3, -44], lean: 8, ff: [14, 0], bf: [-16, 0], fh: [-8, -50], wa: -100, bh: -6, cape: 0.4 },
  sp1_strike: { hip: [4, -43], lean: 14, ff: [20, 0], bf: [-14, 0], fh: [28, -52], wa: 92, bh: -6, cape: 1, smear: { c: [4, -52], r0: 26, r1: 44, a0: -80, a1: 95 } },
  sp1_strike2: { hip: [4, -43], lean: 6, ff: [16, 0], bf: [-18, 0], fh: [-18, -52], wa: -92, bh: -6, cape: -0.6, smear: { c: [4, -52], r0: 26, r1: 44, a0: 100, a1: 265 } },
  sp1_follow: { hip: [3, -43], lean: 10, ff: [18, 0], bf: [-14, 0], fh: [22, -54], wa: 80, bh: -6, cape: 0.6 },
  // Shadowstep: coil, then a low blur dash
  uq_wind: { hip: [-2, -34], lean: 30, ff: [16, 0], bf: [-16, 0], fh: [8, -40], wa: 125, bh: -6, cape: 0.3 },
  uq_strike: { hip: [6, -32], lean: 48, ff: [24, -2], bf: [-22, -5], fh: [-4, -36], wa: -118, bh: -6, cape: 1.4 },
  uq_follow: { hip: [2, -40], lean: 12, ff: [16, 0], bf: [-14, 0], fh: [18, -54], wa: 62, bh: -6, cape: 0.6 },
  win0: { hip: [0, -45], lean: 0, ff: [12, 0], bf: [-13, 0], fh: [10, -84], wa: 4, bh: [-6, -50], cape: 0.2 },
  win1: { hip: [0, -45], lean: 0, ff: [12, 0], bf: [-13, 0], fh: [12, -86], wa: -6, bh: [-6, -50], cape: 0.3 },
});

const BJORN_POSES = adapt(HERC_POSES, 0.95, 0.8, undefined, {
  // Thunderclap: hammer up, then slam the ground
  sp1_wind: { hip: [-3, -26], lean: -12, ff: [10, 0], bf: [-12, 0], fh: [-4, -58], wa: -30, bh: [8, -40] },
  sp1_strike: { hip: [4, -20], lean: 30, ff: [16, 0], bf: [-11, 0], fh: [22, -10], wa: 150, bh: [6, -28], smear: { c: [6, -34], r0: 16, r1: 30, a0: -20, a1: 150 } },
  sp1_follow: { hip: [3, -20], lean: 26, ff: [16, 0], bf: [-11, 0], fh: [20, -9], wa: 160, bh: [6, -26] },
  // Storm Charge: hammer to the sky, catch the lightning, flex
  uq_wind: { hip: [0, -25], lean: -4, ff: [9, 0], bf: [-10, 0], fh: [6, -60], wa: 0, bh: [-6, -56] },
  uq_strike: { hip: [0, -26], lean: -10, ff: [10, 0], bf: [-11, 0], fh: [4, -64], wa: -6, bh: [-10, -58], head: -6 },
  uq_follow: { hip: [0, -26], lean: 4, ff: [9, 0], bf: [-10, 0], fh: [13, -46], wa: 30, bh: [-10, -44] },
});

const POSES = { herc: HERC_POSES, bella: BELLA_POSES, skopos: SKOPOS_POSES, bjorn: BJORN_POSES };
export const FIGHTER_IDS = Object.keys(POSES);

// ---------------------------------------------------------------- build --

const KEY = Object.fromEntries(Object.entries(PALETTE_ROLES).map(([k, v]) => [k, hex(v)]));

export function buildFighter(root, id, previewPalette) {
  const ch = CHARS[id];
  const poses = POSES[id];
  const names = Object.keys(poses);
  const rows = Math.ceil(names.length / COLS);
  const W = FW * COLS;
  const H = FH * rows;
  const rgba = new Uint8Array(W * H * 4);
  const preview = previewPalette ? new Uint8Array(W * H * 4) : null;

  names.forEach((name, i) => {
    const cv = new RoleCanvas(FW, FH);
    drawFigure(cv, ch, poses[name]);
    const ox = (i % COLS) * FW;
    const oy = Math.floor(i / COLS) * FH;
    rolesToRgba(cv, KEY, rgba, ox, oy, W);
    if (preview) rolesToRgba(cv, previewPalette, preview, ox, oy, W);
  });

  const dirOut = join(root, 'public/assets/characters', id);
  writeFile(join(dirOut, 'sheet.png'), encodePng(W, H, rgba));
  writeFile(
    join(dirOut, 'art.json'),
    `${JSON.stringify({ frameWidth: FW, frameHeight: FH, originX: OX, originY: OY, poses: Object.fromEntries(names.map((n, i) => [n, i])) }, null, 1)}\n`,
  );
  return { names, preview: preview && { w: W, h: H, data: preview } };
}
