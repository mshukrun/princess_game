(() => {
'use strict';
const $ = (id) => document.getElementById(id);
const rand = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;

/* ------------------------------------------------------------------ DATA */
const SUSPECTS = [
  { id: 'fox',   em: '🦊', name: 'השועל הערמומי' },
  { id: 'owl',   em: '🦉', name: 'הינשוף הזעוף' },
  { id: 'mouse', em: '🐭', name: 'העכבר הקטן' },
];
const THIEF = 'mouse';

const CLUES = [
  'עקבות כפות זעירות, קטנות ממטבע, מובילות מהחנוכייה אל תוך השלג.',
  'אין סימני נוצות או כנפיים ליד החנוכייה. מי שבא לכאן הלך על הקרקע.',
  'תושבי הכפר מספרים שהינשוף הזעוף ישב כל הלילה על הגג הגבוה ביותר, הביט בכוכבים ולא ירד.',
  'השועל הערמומי בילה את כל הערב במאפייה וטיגן סופגניות. האופה ראה אותו בכל רגע.',
  'שביל של פירורי שעווה קטנים מוביל אל האלון הזקן בקצה הכפר.',
  'ליד הפירורים מונחת פינה נגוסה של סופגנייה, עם סימני שיניים קטנים מדי בשביל שועל.',
  'קול דקיק לוחש מחור מתחת לאלון: "היה כל כך חשוך וקר בבית שלנו…"',
  'בתוך החור אתה רואה משפחת עכברים יושבת סביב שמונה נרות קטנים. הם רק רצו קצת אור וחום!',
];

const SKILLS = [
  { key: 'Space', name: 'חיתוך',  icon: '⚔️', unlock: 0, cd: 0.5 },
  { key: 'Shift', name: 'חבטה סיבובית', icon: '🌀', unlock: 0, cd: 4 },
  { key: 'Q',     name: 'מגן',    icon: '🛡️', unlock: 2, cd: 10 },
  { key: 'R',     name: 'אור',    icon: '🔥', unlock: 2, cd: 18 },
];

const WORLD_R = 34;        // walkable radius
const MAX_HEARTS = 5;

/* ------------------------------------------------------------------ MATH */
function makeRiddle(level) {
  let a, b, c, text, ans;
  switch (level) {
    case 1: a = rand(3, 12); b = rand(3, 12); text = `${a} + ${b}`; ans = a + b; break;
    case 2: a = rand(30, 90); b = rand(10, a - 5); text = `${a} − ${b}`; ans = a - b; break;
    case 3: a = rand(2, 10); b = rand(2, 10); text = `${a} × ${b}`; ans = a * b; break;
    case 4: a = rand(6, 12); b = rand(6, 12); text = `${a} × ${b}`; ans = a * b; break;
    case 5: b = rand(2, 12); ans = rand(3, 12); a = b * ans; text = `${a} ÷ ${b}`; break;
    case 6: a = rand(5, 40); ans = rand(5, 40); text = `? + ${a} = ${a + ans}`; break;
    case 7: a = rand(3, 9); b = rand(3, 9); c = rand(2, 20); text = `${a} × ${b} + ${c}`; ans = a * b + c; break;
    default: a = rand(2, 9); b = rand(2, 9); c = rand(3, 9); text = `(${a} + ${b}) × ${c}`; ans = (a + b) * c; break;
  }
  return { text: text + ' = ?', ans };
}

/* ------------------------------------------------------------------ STATE */
const S = {
  started: false, paused: true, finished: false,
  solved: 0, placed: 0, hearts: MAX_HEARTS, invuln: 0,
  female: false,
  clues: [],
  cd: SKILLS.map(() => 0),
  shieldT: 0, spinT: 0, spinBase: 0, spinHit: false, attackT: 0, lightT: 0,
  spawnT: 3,
  activePed: null, riddle: null,
  litIdx: -1, litT: 0, winT: 0,
};
const keys = {};
const G = (m, f) => (S.female ? f : m);       // Hebrew is gendered: pick the male / female wording
let yaw = 0.0;               // camera yaw
let camDist = 11, camH = 6.5;

/* ------------------------------------------------------------------ THREE SETUP */
const canvas = $('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x070b1f);
scene.fog = new THREE.FogExp2(0x070b1f, 0.012);
const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 400);

function resize() {
  renderer.setSize(innerWidth, innerHeight, false);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize); resize();

const hemi = new THREE.HemisphereLight(0x6f86ff, 0x1a2a1a, 0.55);
scene.add(hemi);
const moon = new THREE.DirectionalLight(0xaec4ff, 0.7);
moon.position.set(-25, 40, -20);
moon.castShadow = true;
moon.shadow.mapSize.set(1024, 1024);
Object.assign(moon.shadow.camera, { left: -40, right: 40, top: 40, bottom: -40, near: 1, far: 120 });
scene.add(moon);
const menorahLight = new THREE.PointLight(0xffb347, 0.2, 50);
menorahLight.position.set(0, 5, 1.5);
scene.add(menorahLight);

const mat = (c, o = {}) => new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: 0.7, metalness: 0.05 }, o));

// ground
const ground = new THREE.Mesh(new THREE.CircleGeometry(60, 48), mat(0x20382c));
ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
const snow = new THREE.Mesh(new THREE.CircleGeometry(WORLD_R + 1, 48), mat(0xcfd9ee, { roughness: 0.95 }));
snow.rotation.x = -Math.PI / 2; snow.position.y = 0.02; snow.receiveShadow = true; scene.add(snow);
const plaza = new THREE.Mesh(new THREE.CircleGeometry(8, 40), mat(0x7a7f95));
plaza.rotation.x = -Math.PI / 2; plaza.position.y = 0.04; plaza.receiveShadow = true; scene.add(plaza);

// stars + moon
{
  const n = 500, pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const th = Math.random() * Math.PI * 2, ph = Math.random() * 1.3;
    const r = 180;
    pos[i * 3] = r * Math.sin(ph) * Math.cos(th);
    pos[i * 3 + 1] = r * Math.cos(ph) + 10;
    pos[i * 3 + 2] = r * Math.sin(ph) * Math.sin(th);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  scene.add(new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: 1.2, fog: false })));
  const m = new THREE.Mesh(new THREE.SphereGeometry(7, 24, 24), new THREE.MeshBasicMaterial({ color: 0xf5f1d0, fog: false }));
  m.position.set(-90, 80, -110); scene.add(m);
}

// trees & houses (scenery outside walkable ring)
for (let i = 0; i < 40; i++) {
  const a = (i / 40) * Math.PI * 2 + Math.random() * 0.1;
  const r = 40 + Math.random() * 10;
  const t = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.4, 1.5, 6), mat(0x4a2f1b));
  trunk.position.y = 0.75; t.add(trunk);
  for (let k = 0; k < 3; k++) {
    const c = new THREE.Mesh(new THREE.ConeGeometry(2.2 - k * 0.5, 2.2, 8), mat(0x1b5a3a));
    c.position.y = 2.2 + k * 1.3; c.castShadow = true; t.add(c);
    const sn = new THREE.Mesh(new THREE.ConeGeometry(1.2 - k * 0.3, 0.8, 8), mat(0xeef3ff));
    sn.position.y = 2.7 + k * 1.3; t.add(sn);
  }
  t.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
  t.scale.setScalar(0.8 + Math.random() * 0.6);
  scene.add(t);
}
/* ------------------------------------------------------------------ HOUSES (enterable, 4 rooms each) */
// House footprint in local coords: x[-6,6], z[-5,5]; the front door is on the +z side.
const WALL_H = 3.2, WALL_T = 0.3;
const solids = [];          // world-space AABBs {x0,x1,z0,z1} the hero can't walk through
const houses = [];
const wallMat = mat(0xd9c3a0, { roughness: 0.9 });
const floorMat = mat(0x8a6038, { roughness: 0.9 });
const furnMat = mat(0x7a4b25, { roughness: 0.8 });
const ROOF_COLORS = [0xc0392b, 0x2e86c1, 0x8e44ad, 0x27ae60, 0xd68910, 0x16a085, 0xc2185b, 0x5d6d7e];
const RUG_COLORS = { BL: 0x3a63e0, BR: 0x7d3c98, FL: 0xc0803a, FR: 0x2e8b57 };
// wall segments in house-local coords: [x0, x1, z0, z1]
const WALL_SEGS = [
  [-6, 6, -5, -5],                      // back
  [-6, -6, -5, 5], [6, 6, -5, 5],       // left, right
  [-6, 2, 5, 5], [4, 6, 5, 5],          // front, with door gap x 2..4
  [-6, -4, 0.5, 0.5], [-2, 2, 0.5, 0.5], [4, 6, 0.5, 0.5],   // middle wall, doorways x -4..-2 and 2..4
  [0, 0, -5, -3], [0, 0, -1, 0.5],      // back divider, doorway z -3..-1
  [0, 0, 0.5, 2], [0, 0, 4, 5],         // front divider, doorway z 2..4
];
// furniture boxes [cx, cz, w, h, d, color?]
const FURNITURE = [
  [-5.4, 2.2, 1, 1.0, 1.8],   // kitchen counter (FL)
  [-2.5, 4.0, 1.2, 0.8, 1.2], // kitchen table (FL)
  [5.3, 3.4, 0.9, 0.7, 2.0],  // sofa (FR)
  [-4.8, -3.5, 1.6, 0.6, 2.2], // bed (BL)
  [4.5, -4.6, 2.4, 2.0, 0.5], // bookshelf (BR)
  [5.2, -2.0, 1.2, 0.8, 2.0], // desk (BR)
];
// chest spots per room [x, z, rotationY]
const CHEST_ROOM = {
  BL: [-1.3, -4.0, 0], BR: [1.5, -4.0, 0], FL: [-5.0, 4.2, Math.PI / 2], FR: [5.0, 1.3, -Math.PI / 2],
};
const ROOM_FOR_HOUSE = ['BL', 'FR', 'BR', 'FL', 'BR', 'BL', 'FL', 'FR'];
const ROOM_RECTS = { BL: [-6, 0, -5, 0.5], BR: [0, 6, -5, 0.5], FL: [-6, 0, 0.5, 5], FR: [0, 6, 0.5, 5] };

function buildHouse(idx, cx, cz) {
  const g = new THREE.Group(); g.position.set(cx, 0, cz);
  const walls = new THREE.Group(); g.add(walls);
  for (const [x0, x1, z0, z1] of WALL_SEGS) {
    const w = Math.max(x1 - x0, 0) + WALL_T, d = Math.max(z1 - z0, 0) + WALL_T;
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, WALL_H, d), wallMat);
    m.position.set((x0 + x1) / 2, WALL_H / 2, (z0 + z1) / 2); m.castShadow = true; m.receiveShadow = true; walls.add(m);
    solids.push({ x0: cx + x0 - WALL_T / 2, x1: cx + x1 + WALL_T / 2, z0: cz + z0 - WALL_T / 2, z1: cz + z1 + WALL_T / 2 });
  }
  // door frame (gold) so the entrance is easy to see
  const door = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.2, 0.4), mat(0xe6b422, { emissive: 0x5a3d00 }));
  door.position.set(3, WALL_H - 0.1, 5); walls.add(door);
  // floor + rugs
  const floor = new THREE.Mesh(new THREE.BoxGeometry(12, 0.1, 10), floorMat); floor.position.y = 0.05; floor.receiveShadow = true; g.add(floor);
  for (const k of Object.keys(ROOM_RECTS)) {
    const [x0, x1, z0, z1] = ROOM_RECTS[k];
    const rug = new THREE.Mesh(new THREE.BoxGeometry((x1 - x0) * 0.6, 0.02, (z1 - z0) * 0.6), mat(RUG_COLORS[k]));
    rug.position.set((x0 + x1) / 2, 0.11, (z0 + z1) / 2); g.add(rug);
  }
  // furniture
  for (const [fx, fz, w, h, d] of FURNITURE) {
    const f = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), furnMat);
    f.position.set(fx, h / 2, fz); f.castShadow = true; f.receiveShadow = true; g.add(f);
    solids.push({ x0: cx + fx - w / 2, x1: cx + fx + w / 2, z0: cz + fz - d / 2, z1: cz + fz + d / 2 });
  }
  // a little hanukkiah on the kitchen table, for the mood
  const mini = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.12, 0.18), mat(0xe6b422, { emissive: 0x5a3d00 }));
  mini.position.set(-2.5, 0.86, 4.0); g.add(mini);
  // roof (hidden while the hero is inside)
  const roof = new THREE.Mesh(new THREE.ConeGeometry(8.7, 3, 4), mat(ROOF_COLORS[idx]));
  roof.rotation.y = Math.PI / 4; roof.scale.z = 0.86; roof.position.y = WALL_H + 1.5; roof.castShadow = true; g.add(roof);
  const snowCap = new THREE.Mesh(new THREE.ConeGeometry(4, 1.2, 4), mat(0xf2f6ff));
  snowCap.rotation.y = Math.PI / 4; snowCap.scale.z = 0.86; snowCap.position.y = WALL_H + 2.6; roof.add(snowCap); snowCap.position.set(0, 1.1, 0);
  // warm interior light
  const lamp = new THREE.PointLight(0xffc56b, 0.9, 15); lamp.position.set(0, 2.8, 0); g.add(lamp);
  // glowing windows on the outside back wall
  for (const wx of [-3, 3]) {
    const w = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1, 0.1), new THREE.MeshBasicMaterial({ color: 0xffd36b }));
    w.position.set(wx, 1.9, -5.2); g.add(w);
  }
  scene.add(g);
  const H = { g, walls, roof, cx, cz, inside: false, near: false, wallS: 1 };
  houses.push(H); return H;
}
for (let i = 0; i < 8; i++) {
  const a = (i / 8) * Math.PI * 2;
  buildHouse(i, Math.round(Math.cos(a) * 22 * 10) / 10, Math.round(Math.sin(a) * 22 * 10) / 10);
}

/* ------------------------------------------------------------------ MENORAH */
const menorah = new THREE.Group();
const candleSlots = [];   // the 8 candles on the curved arms, left to right: {candle, flame}
const SLOT_ORDER = [0, 7, 1, 6, 2, 5, 3, 4];        // order in which candles return: outer arms first, working inwards
let shamash = null;
const MENORAH_R = 2.4;                              // round base radius (collision)
const MENORAH_HALF_W = 3.7;                         // half-width of the arms (collision)
{
  // Temple-style menorah: round base, one central stem, and rounded arms that sweep out and curve up.
  // Every arm ends at the same height; the middle (shamash) candle is only a little taller.
  const gold = mat(0xe6b422, { metalness: 0.2, roughness: 0.35, emissive: 0x5a3d00 });
  const put = (m, x, y, z) => { m.position.set(x, y, z); m.castShadow = true; menorah.add(m); return m; };
  const cyl = (rt, rb, h, seg = 28) => new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), gold);
  const ball = (r) => new THREE.Mesh(new THREE.SphereGeometry(r, 14, 10), gold);
  // stepped round base
  put(cyl(2.1, 2.3, 0.35), 0, 0.175, 0);
  put(cyl(1.5, 1.9, 0.35), 0, 0.525, 0);
  put(cyl(0.7, 1.2, 0.4), 0, 0.9, 0);
  const Y = 4.6;                                    // height where all the arms end
  const RADII = [0.8, 1.6, 2.4, 3.2];               // how far each pair of arms reaches out
  put(cyl(0.17, 0.26, Y + 0.3 - 1.0, 16), 0, (1.1 + Y + 0.3) / 2, 0);   // central stem
  const holder = (x, y, isS) => {
    put(new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.14, 0.22, 14), gold), x, y, 0);
    const candle = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.9, 10), mat(isS ? 0x4aa3ff : 0xf1f5ff, { emissive: isS ? 0x113355 : 0x444444 }));
    candle.position.set(x, y + 0.55, 0); candle.visible = false; menorah.add(candle);
    const flame = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.4, 8), new THREE.MeshBasicMaterial({ color: 0xffb020 }));
    flame.position.set(x, y + 1.2, 0); flame.visible = false; menorah.add(flame);
    return { candle, flame };
  };
  const left = [], right = [];
  RADII.forEach((rho, k) => {
    const h = Y - rho;                              // where this pair leaves the stem
    put(ball(0.2), 0, h, 0);                        // knob where the arms branch off
    for (const sx of [-1, 1]) {
      const pts = [];
      for (let i = 0; i <= 16; i++) { const t = (i / 16) * (Math.PI / 2); pts.push(new THREE.Vector3(sx * rho * Math.sin(t), h + rho * (1 - Math.cos(t)), 0)); }
      const arm = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 28, 0.11, 10, false), gold);
      arm.castShadow = true; menorah.add(arm);
      put(ball(0.15), sx * rho * 0.62, h + rho * (1 - Math.cos(Math.asin(0.62))), 0);   // a small bud on each curve
      (sx < 0 ? left : right).push(holder(sx * rho, Y, false));
    }
  });
  // candleSlots runs left to right: outer-left ... inner-left, inner-right ... outer-right
  left.reverse().forEach((s) => candleSlots.push(s));
  right.forEach((s) => candleSlots.push(s));
  shamash = holder(0, Y + 0.45, true);              // the middle candle: just a bit taller
  put(ball(0.22), 0, Y + 0.05, 0);
}
scene.add(menorah);
const slotByOrder = SLOT_ORDER.map((i) => candleSlots[i]);
const dreidels = [];     // (the little plaza dreidels were removed)

/* ------------------------------------------------------------------ PEDESTALS */
// Treasure chests hide the candles. Each chest is locked with a math riddle.
const woodMat = mat(0x6b3f1d, { roughness: 0.85 });
const goldMat = mat(0xe6b422, { metalness: 0.2, roughness: 0.35, emissive: 0x5a3d00 });
const rockMat = mat(0x70758a, { roughness: 1 });
const pedestals = [];   // (kept name) = chests, one hidden in a room of each house
houses.forEach((H, hi) => {
  const room = ROOM_FOR_HOUSE[hi];
  const [lx, lz, rot] = CHEST_ROOM[room];
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.8, 1), woodMat);
  body.position.y = 0.4; body.castShadow = true; g.add(body);
  for (const bx of [-0.5, 0.5]) {
    const band = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.82, 1.04), goldMat); band.position.set(bx, 0.4, 0); g.add(band);
  }
  const lid = new THREE.Group(); lid.position.set(0, 0.8, -0.5);        // hinge at back edge
  const lidMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 1.5, 12, 1, false, 0, Math.PI), woodMat);
  lidMesh.rotation.z = Math.PI / 2; lidMesh.position.z = 0.5; lidMesh.castShadow = true; lid.add(lidMesh);
  for (const bx of [-0.5, 0.5]) {
    const lb = new THREE.Mesh(new THREE.CylinderGeometry(0.52, 0.52, 0.12, 12, 1, false, 0, Math.PI), goldMat);
    lb.rotation.z = Math.PI / 2; lb.position.set(bx, 0, 0.5); lid.add(lb);
  }
  const lock = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.25, 0.1), goldMat); lock.position.set(0, -0.05, 1.03); lid.add(lock);
  g.add(lid);
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 0.8), new THREE.MeshBasicMaterial({ color: 0xffd54a, transparent: true, opacity: 0.0, side: THREE.DoubleSide }));
  glow.rotation.x = -Math.PI / 2; glow.position.y = 0.78; g.add(glow);
  const light = new THREE.PointLight(0xffcc55, 0.0, 5); light.position.y = 1.2; g.add(light);   // glows when opened
  g.position.set(H.cx + lx, 0.1, H.cz + lz);
  g.rotation.y = rot;
  scene.add(g);
  // candle that floats out when opened
  const cMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.9, 10), mat(0xf1f5ff, { emissive: 0x333333 }));
  const cFlame = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.4, 8), new THREE.MeshBasicMaterial({ color: 0xffb020 })); cFlame.position.y = 0.65;
  const floatC = new THREE.Group(); floatC.add(cMesh, cFlame); floatC.visible = false; scene.add(floatC);
  pedestals.push({ g, lid, glow, light, floatC, house: H, room, solved: false, open: 0, x: g.position.x, z: g.position.z });
});

/* ------------------------------------------------------------------ POTION BOXES (heal 2 hearts) */
const POTION_SPOT = { BL: [-5.2, -0.8], BR: [5.4, -0.1], FL: [-0.8, 4.4], FR: [0.9, 4.5] };
const potions = [];
{
  const crateMat = mat(0x2f7d6b, { emissive: 0x0a2a22 });
  const doughMat = mat(0xd9a04a, { roughness: 0.75 }), sugarMat = mat(0xffffff, { roughness: 0.95, emissive: 0x555555 }), jamMat = mat(0xc0102a, { roughness: 0.35, emissive: 0x400008 });
  houses.forEach((H, hi) => {
    const others = Object.keys(POTION_SPOT).filter((r) => r !== ROOM_FOR_HOUSE[hi]);
    [others[hi % 3], others[(hi + 1) % 3]].forEach((room) => {
      const [lx, lz] = POTION_SPOT[room];
      const g = new THREE.Group();
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.5, 0.7), crateMat); body.position.y = 0.25; body.castShadow = true; g.add(body);
      const lid = new THREE.Group(); lid.position.set(0, 0.5, -0.35);
      const lm = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.07, 0.76), crateMat); lm.position.set(0, 0.03, 0.38); lid.add(lm);
      for (const [w, d] of [[0.7, 0.1], [0.1, 0.7]]) {   // gold cross on the lid so it stands out
        const c = new THREE.Mesh(new THREE.BoxGeometry(w, 0.02, d), goldMat); c.position.set(0, 0.075, 0.38); lid.add(c);
      }
      g.add(lid);
      const bottle = new THREE.Group();     // a sufganiyah: round fried dough, powdered sugar on top and a dab of jam
      const dough = new THREE.Mesh(new THREE.SphereGeometry(0.22, 18, 12), doughMat); dough.scale.y = 0.78;
      const sugar = new THREE.Mesh(new THREE.SphereGeometry(0.225, 18, 8, 0, Math.PI * 2, 0, Math.PI * 0.38), sugarMat); sugar.scale.y = 0.78;
      const jam = new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 8), jamMat); jam.position.set(0, 0.17, 0);
      const belt = new THREE.Mesh(new THREE.TorusGeometry(0.215, 0.018, 6, 24), mat(0xf0c070)); belt.rotation.x = Math.PI / 2;   // the pale "belt" on fried dough
      bottle.add(dough, sugar, jam, belt);
      bottle.visible = false; bottle.position.y = 0.5; g.add(bottle);          // hidden until the box is opened
      g.position.set(H.cx + lx, 0.1, H.cz + lz);
      scene.add(g);
      solids.push({ x0: H.cx + lx - 0.35, x1: H.cx + lx + 0.35, z0: H.cz + lz - 0.35, z1: H.cz + lz + 0.35 });
      potions.push({ g, lid, bottle, house: H, room, used: false, t: 0, x: g.position.x, z: g.position.z });
    });
  });
}

/* ------------------------------------------------------------------ HERO */
// Builds a detailed Maccabee warrior into `root`. Returns the parts the animation needs.
function buildHero(root, female) {
  const M = (c, o = {}) => new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: 0.6, metalness: 0.12 }, o));
  const steel = M(0xb9c6d8, { metalness: 0.45, roughness: 0.38, emissive: 0x1b2434 });
  const blue = M(0x2a56c8, { roughness: 0.85 });
  const white = M(0xf3f6ff, { roughness: 0.85, emissive: 0x222233 });
  const gold = M(0xf0c030, { metalness: 0.3, roughness: 0.35, emissive: 0x4a3500 });
  const leather = M(0x6b4423, { roughness: 0.9 });
  const pants = M(0x34405a, { roughness: 0.9 });
  const skin = M(female ? 0xe8b996 : 0xd9a577, { roughness: 0.8 });
  const hair = M(female ? 0x5a3318 : 0x3b2412, { roughness: 0.9 });
  const dark = M(0x151515);
  const cyl = (rt, rb, h, m, seg = 14, open = false) => new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg, 1, open), m);
  const sph = (r, m) => new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), m);
  const box = (w, h, d, m) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
  const add = (parent, mesh, x = 0, y = 0, z = 0) => { mesh.position.set(x, y, z); mesh.castShadow = true; parent.add(mesh); return mesh; };

  // legs: trousers, knee guard, greave, boot
  const mkLeg = (x) => {
    const piv = new THREE.Group(); piv.position.set(x, 1.0, 0); root.add(piv);
    add(piv, cyl(0.15, 0.12, 0.5, pants), 0, -0.25, 0);
    add(piv, sph(0.13, steel), 0, -0.52, 0.04);
    add(piv, cyl(0.125, 0.1, 0.42, steel), 0, -0.74, 0);
    add(piv, cyl(0.135, 0.135, 0.06, gold), 0, -0.93 + 0.1, 0);
    add(piv, box(0.26, 0.18, 0.42, leather), 0, -0.93, 0.07);
    return { piv };
  };
  const legL = mkLeg(-0.2), legR = mkLeg(0.2);

  // belt + skirt / tabard
  add(root, cyl(0.4, 0.4, 0.14, leather, 18), 0, 1.07, 0).scale.z = female ? 0.72 : 0.66;
  add(root, box(0.12, 0.12, 0.05, gold), 0, 1.07, female ? 0.3 : 0.29);
  if (female) {
    const sk = cyl(0.36, 0.56, 0.5, blue, 20, true); sk.material = blue.clone(); sk.material.side = THREE.DoubleSide;
    add(root, sk, 0, 0.82, 0);
  } else {
    add(root, box(0.36, 0.62, 0.04, white), 0, 0.8, 0.27);
    add(root, box(0.36, 0.62, 0.04, blue), 0, 0.8, -0.27);
  }

  // torso: cloth, breastplate, collar
  const torso = add(root, cyl(female ? 0.42 : 0.5, female ? 0.3 : 0.38, 1.0, blue, 18), 0, 1.6, 0);
  torso.scale.z = female ? 0.7 : 0.64;
  const plate = add(root, cyl(female ? 0.435 : 0.515, female ? 0.34 : 0.42, 0.62, steel, 18), 0, 1.78, 0);
  plate.scale.z = female ? 0.72 : 0.66;
  add(root, box(0.2, 0.92, 0.05, white), 0, 1.57, female ? 0.285 : 0.31);
  add(root, cyl(female ? 0.44 : 0.52, female ? 0.44 : 0.52, 0.06, gold, 18), 0, 2.09, 0).scale.z = female ? 0.72 : 0.66;
  add(root, cyl(0.09, 0.1, 0.16, skin), 0, 2.17, 0);

  // head + face
  const head = add(root, sph(0.27, skin), 0, 2.45, 0); head.scale.y = 1.12;
  for (const ex of [-0.1, 0.1]) {
    add(root, sph(0.045, M(0xffffff)), ex, 2.48, 0.22).scale.set(1.1, 0.8, 0.5);
    add(root, sph(0.026, dark), ex, 2.48, 0.255);
    add(root, box(0.1, 0.022, 0.03, hair), ex, 2.555, 0.235).rotation.z = ex > 0 ? -0.1 : 0.1;
  }
  add(root, sph(0.04, skin), 0, 2.43, 0.275);
  add(root, box(0.09, 0.016, 0.02, M(female ? 0xb0434f : 0x8a3b3b)), 0, 2.34, 0.255);
  if (!female) {   // beard
    const beard = add(root, sph(0.2, hair), 0, 2.27, 0.1); beard.scale.set(0.95, 0.75, 0.62);
    add(root, box(0.12, 0.02, 0.03, hair), 0, 2.365, 0.262);     // moustache
  } else {         // hair fringe + braid
    for (const sx of [-0.235, 0.235]) add(root, sph(0.075, hair), sx, 2.4, 0.1);
    for (let i = 0; i < 6; i++) add(root, sph(0.095 - i * 0.008, hair), 0, 2.46 - i * 0.13, -0.28 - i * 0.025);
    add(root, sph(0.05, gold), 0, 2.46 - 6 * 0.13, -0.28 - 6 * 0.025);
  }
  // helmet: dome, rim, cheek guards, nasal guard, crest
  const dome = new THREE.Mesh(new THREE.SphereGeometry(0.31, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.56), gold);
  add(root, dome, 0, 2.47, 0).scale.y = 1.12;
  const rimH = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.025, 8, 24), gold); rimH.rotation.x = Math.PI / 2; add(root, rimH, 0, 2.52, 0);
  for (const sx of [-0.27, 0.27]) { const ch = add(root, box(0.04, 0.2, 0.17, gold), sx, 2.41, 0.06); ch.rotation.z = sx > 0 ? -0.12 : 0.12; }
  add(root, box(0.04, 0.2, 0.03, gold), 0, 2.45, 0.285);
  for (let i = 0; i < 9; i++) {
    const t = i / 8, z = 0.26 - t * 0.55, y = 2.78 + Math.sin(t * Math.PI) * 0.1 - t * 0.05;
    const c = add(root, box(0.06, 0.12 + Math.sin(t * Math.PI) * 0.08, 0.075, i % 2 ? white : blue), 0, y, z);
    c.rotation.x = -0.4 + t * 0.8;
  }

  // pauldrons + arms
  const mkArm = (sx) => {
    const piv = new THREE.Group(); piv.position.set(sx * 0.6, 1.98, 0); root.add(piv);
    const k = female ? 0.9 : 1;
    add(piv, sph(0.2 * k, steel), 0, 0.02, 0).scale.set(1, 0.72, 1);
    add(piv, cyl(0.2 * k, 0.2 * k, 0.04, gold), 0, -0.07, 0);
    add(piv, cyl(0.095 * k, 0.085 * k, 0.42, blue), 0, -0.24, 0);
    add(piv, sph(0.09 * k, blue), 0, -0.45, 0);
    add(piv, cyl(0.085 * k, 0.07 * k, 0.36, steel), 0, -0.62, 0);
    add(piv, sph(0.075 * k, skin), 0, -0.84, 0);
    return { piv };
  };
  const armR = mkArm(1), armL = mkArm(-1);

  // sword
  const sword = new THREE.Group(); sword.position.y = -0.84; sword.rotation.x = 1.0;
  const bladeM = M(0xe6edf7, { metalness: 0.5, roughness: 0.25, emissive: 0x303a48 });
  add(sword, box(0.07, 1.0, 0.025, bladeM), 0, 0.62, 0);
  add(sword, new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.18, 4), bladeM), 0, 1.21, 0).rotation.y = Math.PI / 4;
  add(sword, box(0.34, 0.05, 0.07, gold), 0, 0.11, 0);
  add(sword, cyl(0.03, 0.03, 0.2, leather, 8), 0, 0, 0);
  add(sword, sph(0.05, gold), 0, -0.13, 0);
  armR.piv.add(sword);

  // shield with a Star of David
  const shield = new THREE.Group(); shield.position.set(-0.22, -0.55, 0.06); armL.piv.add(shield);
  const disc = add(shield, cyl(0.5, 0.5, 0.07, blue, 28), 0, 0, 0); disc.rotation.z = Math.PI / 2;
  const rimS = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.04, 8, 28), gold); rimS.rotation.y = Math.PI / 2; add(shield, rimS, 0, 0, 0);
  const starG = new THREE.Group(); starG.rotation.y = -Math.PI / 2; starG.position.x = -0.045; shield.add(starG);
  for (const rot of [0, Math.PI]) {
    const sh = new THREE.Shape(); const r = 0.3;
    for (let i = 0; i < 3; i++) { const a = Math.PI / 2 + (i * 2 * Math.PI) / 3; sh[i ? 'lineTo' : 'moveTo'](Math.cos(a) * r, Math.sin(a) * r); }
    const m = new THREE.Mesh(new THREE.ShapeGeometry(sh), M(0xf3f6ff, { emissive: 0x666677, side: THREE.DoubleSide }));
    m.rotation.z = rot; starG.add(m);
  }
  add(shield, sph(0.08, gold), -0.06, 0, 0);

  // cape
  const capePiv = new THREE.Group(); capePiv.position.set(0, 2.06, -0.3); root.add(capePiv);
  const cape = new THREE.Mesh(new THREE.PlaneGeometry(0.95, 1.35, 1, 1), M(0x1f46a8, { side: THREE.DoubleSide, roughness: 0.9 }));
  cape.position.y = -0.67; cape.castShadow = true; capePiv.add(cape);
  capePiv.rotation.x = 0.1;

  // shield-skill bubble
  const bubble = new THREE.Mesh(new THREE.SphereGeometry(1.9, 20, 16), new THREE.MeshBasicMaterial({ color: 0x66aaff, transparent: true, opacity: 0.3, depthWrite: false }));
  bubble.position.y = 1.5; bubble.visible = false; root.add(bubble);

  armR.piv.rotation.x = -0.3;
  root.scale.setScalar(female ? 0.95 : 1);
  return { legL, legR, armR, armL, bubble, cape: capePiv, sword };
}
const hero = new THREE.Group();
let legL, legR, armR, armL, bubble, cape, sword;
function rebuildHero() {
  while (hero.children.length) hero.remove(hero.children[0]);
  ({ legL, legR, armR, armL, bubble, cape, sword } = buildHero(hero, S.female));
}
rebuildHero();
scene.add(hero);
hero.position.set(0, 0, 8);

// small rotating preview on the start screen
const prevCanvas = $('preview');
const prevRenderer = new THREE.WebGLRenderer({ canvas: prevCanvas, antialias: true, alpha: true });
prevRenderer.setPixelRatio(Math.min(devicePixelRatio, 2)); prevRenderer.setSize(220, 260, false);
const prevScene = new THREE.Scene();
prevScene.add(new THREE.HemisphereLight(0xdfe8ff, 0x556070, 1.1));
const prevLight = new THREE.DirectionalLight(0xffffff, 0.9); prevLight.position.set(3, 5, 6); prevScene.add(prevLight);
const prevCam = new THREE.PerspectiveCamera(32, 220 / 260, 0.1, 50); prevCam.position.set(0, 1.9, 6.8); prevCam.lookAt(0, 1.55, 0);
const prevHero = new THREE.Group(); prevScene.add(prevHero);
let prevRig = buildHero(prevHero, false);
function rebuildPreview() {
  while (prevHero.children.length) prevHero.remove(prevHero.children[0]);
  prevRig = buildHero(prevHero, S.female);
}

/* ------------------------------------------------------------------ IMPS & FX */
/* ---- Greek soldiers: they walk on the ground, can't pass walls, and path-find around buildings */
const soldiers = [];
const ENEMY_R = 0.4;
// everything solid for enemies = house walls + furniture + potion boxes (solids) + menorah + treasure chests
const enemySolids = solids.slice();
enemySolids.push({ x0: -2.5, x1: 2.5, z0: -2.5, z1: 2.5 }, { x0: -3.8, x1: 3.8, z0: -1.0, z1: 1.0 });
pedestals.forEach((p) => enemySolids.push({ x0: p.x - 0.85, x1: p.x + 0.85, z0: p.z - 0.85, z1: p.z + 0.85 }));

const NAV = { cell: 0.5, half: 34, n: 0, blocked: null, dist: null, queue: null, goal: -1 };
NAV.n = Math.round((NAV.half * 2) / NAV.cell);
const navCenter = (i) => -NAV.half + (i + 0.5) * NAV.cell;
const navCell = (v) => Math.min(NAV.n - 1, Math.max(0, Math.floor((v + NAV.half) / NAV.cell)));
(function buildNav() {
  const n = NAV.n;
  NAV.blocked = new Uint8Array(n * n); NAV.dist = new Int32Array(n * n); NAV.queue = new Int32Array(n * n);
  for (let iz = 0; iz < n; iz++) for (let ix = 0; ix < n; ix++) {
    const x = navCenter(ix), z = navCenter(iz);
    let b = Math.hypot(x, z) > WORLD_R - ENEMY_R ? 1 : 0;
    for (let k = 0; !b && k < enemySolids.length; k++) {
      const s = enemySolids[k];
      const dx = Math.max(s.x0 - x, 0, x - s.x1), dz = Math.max(s.z0 - z, 0, z - s.z1);
      if (dx * dx + dz * dz < ENEMY_R * ENEMY_R) b = 1;
    }
    NAV.blocked[iz * n + ix] = b;
  }
})();
const NAV_DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
// breadth-first "flow field" from the hero's cell: dist[cell] = steps to the hero around obstacles
function computeFlow(hx, hz) {
  const n = NAV.n, dist = NAV.dist, q = NAV.queue, blocked = NAV.blocked;
  dist.fill(-1);
  let start = navCell(hz) * n + navCell(hx);
  if (blocked[start]) {                      // hero is hugging a wall: start from the nearest free cell
    const cx = start % n, cz = (start / n) | 0; let best = -1, bd = 1e9;
    for (let dz = -6; dz <= 6; dz++) for (let dx = -6; dx <= 6; dx++) {
      const x = cx + dx, z = cz + dz; if (x < 0 || z < 0 || x >= n || z >= n || blocked[z * n + x]) continue;
      const d = dx * dx + dz * dz; if (d < bd) { bd = d; best = z * n + x; }
    }
    if (best < 0) return;
    start = best;
  }
  let head = 0, tail = 0; q[tail++] = start; dist[start] = 0;
  while (head < tail) {
    const c = q[head++], cx = c % n, cz = (c / n) | 0, d0 = dist[c];
    for (const [dx, dz] of NAV_DIRS) {
      const x = cx + dx, z = cz + dz; if (x < 0 || z < 0 || x >= n || z >= n) continue;
      const ni = z * n + x; if (dist[ni] >= 0 || blocked[ni]) continue;
      if (dx && dz && (blocked[cz * n + x] || blocked[z * n + cx])) continue;       // no cutting wall corners
      dist[ni] = d0 + 1; q[tail++] = ni;
    }
  }
}
// next cell centre to walk to from (x,z), or null
const _nx = { x: 0, z: 0 };
function flowNext(x, z) {
  const n = NAV.n, dist = NAV.dist, blocked = NAV.blocked, cx = navCell(x), cz = navCell(z);
  const here = dist[cz * n + cx];
  let best = -1, bd = here >= 0 ? here : 1e9;
  for (const [dx, dz] of NAV_DIRS) {
    const px = cx + dx, pz = cz + dz; if (px < 0 || pz < 0 || px >= n || pz >= n) continue;
    const ni = pz * n + px, d = dist[ni]; if (d < 0 || d >= bd) continue;
    if (dx && dz && (blocked[cz * n + px] || blocked[pz * n + cx])) continue;
    bd = d; best = ni;
  }
  if (best < 0) return null;
  _nx.x = navCenter(best % n); _nx.z = navCenter((best / n) | 0); return _nx;
}
// is the straight line between two points free of walls? (checked on the nav grid)
function segmentClear(ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az, len = Math.hypot(dx, dz), steps = Math.max(1, Math.ceil(len / 0.3)), n = NAV.n;
  for (let i = 0; i <= steps; i++) {
    const k = i / steps, x = ax + dx * k, z = az + dz * k;
    if (NAV.blocked[navCell(z) * n + navCell(x)]) return false;
  }
  return true;
}
// hard collision: push a circle out of every solid box
function pushOutOfSolids(p, R) {
  for (let pass = 0; pass < 2; pass++) {
    for (const b of enemySolids) {
      const px = Math.max(b.x0, Math.min(p.x, b.x1)), pz = Math.max(b.z0, Math.min(p.z, b.z1));
      const dx = p.x - px, dz = p.z - pz, d2 = dx * dx + dz * dz;
      if (d2 >= R * R) continue;
      if (d2 > 1e-8) { const d = Math.sqrt(d2); p.x = px + (dx / d) * R; p.z = pz + (dz / d) * R; }
      else {
        const ex = Math.min(p.x - b.x0, b.x1 - p.x), ez = Math.min(p.z - b.z0, b.z1 - p.z);
        if (ex < ez) p.x += (p.x - b.x0 < b.x1 - p.x ? -(ex + R) : ex + R); else p.z += (p.z - b.z0 < b.z1 - p.z ? -(ez + R) : ez + R);
      }
    }
  }
  const r = Math.hypot(p.x, p.z); if (r > WORLD_R - ENEMY_R) { p.x *= (WORLD_R - ENEMY_R) / r; p.z *= (WORLD_R - ENEMY_R) / r; }
}

// the soldier model: Greek hoplite with Corinthian helmet, red crest, bronze cuirass, round shield and spear
function buildSoldier() {
  const M = (c, o = {}) => new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: 0.6, metalness: 0.1 }, o));
  const bronze = M(0xb98c4a, { metalness: 0.35, roughness: 0.4, emissive: 0x2e1f0a });
  const red = M(0xa11d1d, { roughness: 0.85 });
  const redSide = Object.assign(red.clone(), { side: THREE.DoubleSide });
  const skin = M(0xd9a577, { roughness: 0.8 }), wood = M(0x6b4423, { roughness: 0.9 }), dark = M(0x151515);
  const steel = M(0xdde4ee, { metalness: 0.4, roughness: 0.3, emissive: 0x303844 });
  const g = new THREE.Group();
  const put = (parent, geo, m, x, y, z) => { const me = new THREE.Mesh(geo, m); me.position.set(x, y, z); me.castShadow = true; parent.add(me); return me; };
  const cyl = (rt, rb, h, seg = 12, open = false) => new THREE.CylinderGeometry(rt, rb, h, seg, 1, open);
  const mkLeg = (x) => { const p = new THREE.Group(); p.position.set(x, 1.0, 0); g.add(p);
    put(p, cyl(0.14, 0.12, 0.5), skin, 0, -0.25, 0); put(p, new THREE.SphereGeometry(0.12, 10, 8), bronze, 0, -0.52, 0.04);
    put(p, cyl(0.125, 0.1, 0.42), bronze, 0, -0.74, 0); put(p, new THREE.BoxGeometry(0.24, 0.1, 0.4), wood, 0, -0.95, 0.07); return p; };
  const legL = mkLeg(-0.2), legR = mkLeg(0.2);
  put(g, cyl(0.4, 0.58, 0.42, 16, true), redSide, 0, 0.88, 0);                                   // red tunic skirt
  put(g, cyl(0.42, 0.42, 0.1, 16), wood, 0, 1.08, 0).scale.z = 0.7;                              // belt
  put(g, cyl(0.5, 0.38, 1.0, 16), bronze, 0, 1.62, 0).scale.z = 0.66;                            // muscle cuirass
  put(g, cyl(0.52, 0.52, 0.06, 16), red, 0, 2.1, 0).scale.z = 0.66;
  put(g, cyl(0.09, 0.1, 0.16), skin, 0, 2.17, 0);
  put(g, new THREE.SphereGeometry(0.27, 14, 12), skin, 0, 2.45, 0).scale.y = 1.1;                // head
  for (const ex of [-0.1, 0.1]) { put(g, new THREE.SphereGeometry(0.03, 6, 6), dark, ex, 2.46, 0.24); put(g, new THREE.BoxGeometry(0.11, 0.025, 0.03), dark, ex, 2.52, 0.245).rotation.z = ex > 0 ? 0.35 : -0.35; }
  const dome = put(g, new THREE.SphereGeometry(0.33, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.62), bronze, 0, 2.47, 0); dome.scale.y = 1.12;
  for (const sx of [-0.28, 0.28]) put(g, new THREE.BoxGeometry(0.05, 0.3, 0.2), bronze, sx, 2.34, 0.04);   // cheek guards
  put(g, new THREE.BoxGeometry(0.05, 0.26, 0.04), bronze, 0, 2.42, 0.29);                                  // nasal guard
  put(g, new THREE.BoxGeometry(0.08, 0.06, 0.62), bronze, 0, 2.82, -0.02);                                 // crest ridge
  for (let i = 0; i < 9; i++) { const t = i / 8;                                                           // big red horsehair crest
    put(g, new THREE.BoxGeometry(0.07, 0.2 + Math.sin(t * Math.PI) * 0.14, 0.085), red, 0, 2.95 + Math.sin(t * Math.PI) * 0.06, 0.26 - t * 0.6).rotation.x = -0.4 + t * 0.8; }
  const mkArm = (sx) => { const p = new THREE.Group(); p.position.set(sx * 0.6, 1.98, 0); g.add(p);
    put(p, new THREE.SphereGeometry(0.19, 10, 8), bronze, 0, 0.02, 0).scale.set(1, 0.7, 1);
    put(p, cyl(0.095, 0.085, 0.42), red, 0, -0.24, 0); put(p, cyl(0.085, 0.07, 0.36), bronze, 0, -0.62, 0);
    put(p, new THREE.SphereGeometry(0.075, 8, 8), skin, 0, -0.84, 0); return p; };
  const armR = mkArm(1), armL = mkArm(-1);
  // spear
  const spear = new THREE.Group(); spear.position.y = -0.84; spear.rotation.x = 1.25; armR.add(spear);
  put(spear, cyl(0.035, 0.035, 3.0, 8), wood, 0, 0.7, 0);
  put(spear, new THREE.ConeGeometry(0.07, 0.4, 8), steel, 0, 2.4, 0);
  put(spear, new THREE.SphereGeometry(0.05, 8, 8), bronze, 0, -0.8, 0);
  // round hoplite shield held in front of the body
  const shield = new THREE.Group(); shield.position.set(-0.05, -0.5, 0.3); armL.add(shield);
  const disc = put(shield, cyl(0.52, 0.52, 0.07, 28), red, 0, 0, 0); disc.rotation.x = Math.PI / 2;
  const rim = put(shield, new THREE.TorusGeometry(0.52, 0.045, 8, 28), bronze, 0, 0, 0);
  const ring2 = put(shield, new THREE.TorusGeometry(0.33, 0.03, 8, 24), M(0xf3e6b0), 0, 0, 0.04);
  put(shield, new THREE.SphereGeometry(0.1, 10, 8), bronze, 0, 0, 0.06);
  armL.rotation.x = -0.9;
  g.scale.setScalar(0.98);
  return { g, legL, legR, armR, armL };
}

function spawnSoldier() {
  for (let tries = 0; tries < 60; tries++) {
    const a = Math.random() * Math.PI * 2, r = 18 + Math.random() * 14;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (NAV.blocked[navCell(z) * NAV.n + navCell(x)]) continue;
    if (Math.hypot(x - hero.position.x, z - hero.position.z) < 14) continue;
    if (houses.some((H) => Math.abs(x - H.cx) < 7.5 && Math.abs(z - H.cz) < 6.5)) continue;     // not inside a house
    const m = buildSoldier(); m.g.position.set(x, 0, z); scene.add(m.g);
    soldiers.push(Object.assign(m, { hp: 2, stun: 0, state: 'chase', stT: 0, atkCd: 1, kb: new THREE.Vector3(), ph: Math.random() * 6 }));
    return true;
  }
  return false;
}
function hitSoldier(so, dmg) {
  so.hp -= dmg;
  if (so.hp <= 0) return killSoldier(so);
  so.stun = 0.45; so.state = 'chase'; so.stT = 0;
  tmp.copy(so.g.position).sub(hero.position); tmp.y = 0; so.kb.copy(tmp.normalize()).multiplyScalar(9);
  puff(so.g.position.clone().setY(1.8), 0xffd080, 6); sfx(330, 0.08, 'square');
}
function updateSoldier(so, dt, t) {
  const p = so.g.position;
  if (so.kb.lengthSq() > 0.05) { p.addScaledVector(so.kb, dt); so.kb.multiplyScalar(Math.max(0, 1 - 7 * dt)); }
  so.atkCd = Math.max(0, so.atkCd - dt);
  tmp.copy(hero.position).sub(p); tmp.y = 0;
  const d = tmp.length();
  let moving = false, faceX = tmp.x, faceZ = tmp.z;
  if (so.stun > 0) so.stun -= dt;
  else if (so.state === 'windup') {                                   // pulls the spear back...
    so.stT += dt;
    if (so.stT >= 0.5) {                                              // ...then thrusts
      so.state = 'recover'; so.stT = 0; so.atkCd = 1.4;
      if (d < 2.7 && segmentClear(p.x, p.z, hero.position.x, hero.position.z)) {
        if (S.shieldT > 0) { so.stun = 1; so.kb.copy(tmp).normalize().multiplyScalar(-9); puff(hero.position.clone().setY(1.6), 0x66aaff, 6); sfx(500, 0.1, 'triangle'); }
        else hurtHero();
      }
    }
  } else if (so.state === 'recover') { so.stT += dt; if (so.stT > 0.45) so.state = 'chase'; }
  else {
    if (d < 2.3 && so.atkCd <= 0 && segmentClear(p.x, p.z, hero.position.x, hero.position.z)) { so.state = 'windup'; so.stT = 0; }
    else if (d > 1.6) {
      let tx = hero.position.x, tz = hero.position.z;
      if (!(d < 16 && segmentClear(p.x, p.z, tx, tz))) { const nx = flowNext(p.x, p.z); if (nx) { tx = nx.x; tz = nx.z; } else { tx = p.x; tz = p.z; } }
      const dx = tx - p.x, dz = tz - p.z, dl = Math.hypot(dx, dz);
      if (dl > 0.02) { const sp = (2.5 + S.solved * 0.15) * dt; p.x += (dx / dl) * Math.min(sp, dl); p.z += (dz / dl) * Math.min(sp, dl); faceX = dx; faceZ = dz; moving = true; }
    }
  }
  for (const o of soldiers) {                                          // don't stack on each other
    if (o === so) continue;
    const ox = p.x - o.g.position.x, oz = p.z - o.g.position.z, od = Math.hypot(ox, oz);
    if (od < 0.9 && od > 0.001) { p.x += (ox / od) * (0.9 - od) * 0.5; p.z += (oz / od) * (0.9 - od) * 0.5; }
  }
  pushOutOfSolids(p, ENEMY_R);                                          // can never end up inside a wall
  if (faceX * faceX + faceZ * faceZ > 1e-4) {
    let da = Math.atan2(faceX, faceZ) - so.g.rotation.y; da = Math.atan2(Math.sin(da), Math.cos(da));
    so.g.rotation.y += da * Math.min(1, dt * 10);
  }
  so.ph += dt * (moving ? 9 : 0);
  const sw = moving ? Math.sin(so.ph) * 0.7 : 0;
  so.legL.rotation.x = sw; so.legR.rotation.x = -sw;
  so.armR.rotation.x = so.state === 'windup' ? 0.7 : so.state === 'recover' ? -1.25 : -0.2 + sw * 0.4;   // spear pulled back / thrust / carried
}
// refresh the "route to the hero" map when the hero changes cell (or every so often)
function updateFlow(dt) {
  S.flowT = (S.flowT || 0) - dt;
  const hc = navCell(hero.position.z) * NAV.n + navCell(hero.position.x);
  if (soldiers.length && (hc !== NAV.goal || S.flowT <= 0)) { computeFlow(hero.position.x, hero.position.z); NAV.goal = hc; S.flowT = 0.4; }
}
const fx = [];
const fxGeo = new THREE.SphereGeometry(0.15, 6, 6);
function puff(pos, color, n = 10) {
  for (let i = 0; i < n; i++) {
    const m = new THREE.Mesh(fxGeo, new THREE.MeshBasicMaterial({ color, transparent: true }));
    m.position.copy(pos);
    scene.add(m);
    fx.push({ m, v: new THREE.Vector3((Math.random() - 0.5) * 6, Math.random() * 5, (Math.random() - 0.5) * 6), life: 0.7 });
  }
}
function killSoldier(so) {
  puff(so.g.position.clone().setY(1.6), 0xc0392b, 8); puff(so.g.position.clone().setY(1.2), 0xb98c4a, 8);
  scene.remove(so.g);
  const i = soldiers.indexOf(so); if (i >= 0) soldiers.splice(i, 1);
  sfx(220, 0.12, 'sawtooth');
}
const ring = new THREE.Mesh(new THREE.RingGeometry(0.9, 1, 48), new THREE.MeshBasicMaterial({ color: 0xffb020, transparent: true, side: THREE.DoubleSide, depthWrite: false }));
ring.rotation.x = -Math.PI / 2; ring.visible = false; scene.add(ring);
// the spin attack's sweeping ring
const SPIN_DUR = 0.5;
const spinRing = new THREE.Mesh(new THREE.RingGeometry(2.4, 3.9, 48, 1, 0, Math.PI * 1.5), new THREE.MeshBasicMaterial({ color: 0xfff0b0, transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false }));
spinRing.rotation.x = -Math.PI / 2; spinRing.visible = false; scene.add(spinRing);

/* ------------------------------------------------------------------ AUDIO */
let ac = null;
function sfx(freq, dur, type = 'square', vol = 0.06) {
  try {
    ac = ac || new (window.AudioContext || window.webkitAudioContext)();
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.value = freq; g.gain.value = vol;
    g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + dur);
    o.connect(g); g.connect(ac.destination); o.start(); o.stop(ac.currentTime + dur);
  } catch (e) { /* audio unavailable */ }
}

/* ------------------------------------------------------------------ MUSIC (Hanukkah songs, synthesized) */
// SONGS: { name, abc } - filled below
const SONGS = [
  { name: 'מעוז צור', abc: `M:2/2
L:1/8
Q:1/4=100
K:F
F2C2 F2B2 | A2G2 F4 | c2d2 G2B2 | A2G2 F4 |
F2C2 F2B2 | A2G2 F4 | c2d2 G2B2 | A2G2 F4 |
c2c2 d2e2 | f4 c4 | f2e2 d2c2 | cBAB G4 |
A3B c4 | G3A B4 | A2G2 F2B2 | A2G2 F4 |
c2c2 d2e2 | f4 c4 | f2e2 d2c2 | cBAB G4 |
A3B c4 | G3A B4 | A2G2 F2B2 | A4 G3F | F8 |]` },
  { name: 'שיר הדריידל', abc: `M:4/4
L:1/8
Q:1/4=108
K:C
G | CCDD E C2 E | GGFE D2 z D | DDDE F D2 D | GFED C2 E2 |
GEGE G E2 E | GGFE D2 z D | FDFD F D2 D | GFED C2 z2 |]` },
  { name: 'חנוכה, אוי חנוכה', abc: `M:4/4
L:1/8
Q:1/4=120
K:Em
B | BBBB eeBB | B2AG A2G2 | B2BB e2BB | B2AG A2G2 |
GABA G2GG | A2GF G2z2 | GABA G2GG | A2GF E2E2 |
B2B4E2 | B2B4E2 | B2BB c2BA | B4 z4 |
B2BB c2BA | B2BB c2BA | G2GG A2GF | E6 z2 |]` },
];
const NOTE_SEMI = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const SHARP_ORDER = ['F', 'C', 'G', 'D', 'A', 'E', 'B'], FLAT_ORDER = ['B', 'E', 'A', 'D', 'G', 'C', 'F'];
const MAJOR_FIFTHS = { C: 0, G: 1, D: 2, A: 3, E: 4, B: 5, 'F#': 6, F: -1, Bb: -2, Eb: -3, Ab: -4, Db: -5 };
function keyAccidentals(k) {
  k = (k || 'C').trim();
  const m = k.match(/^([A-G][b#]?)\s*(m|min|minor)?/i);
  if (!m) return {};
  let tonic = m[1][0].toUpperCase() + (m[1][1] || '');
  let fifths = MAJOR_FIFTHS[tonic] || 0;
  if (m[2]) fifths -= 3;                       // relative major of a minor key is 3 fifths flatter
  const acc = {};
  if (fifths > 0) for (let i = 0; i < fifths; i++) acc[SHARP_ORDER[i]] = 1;
  else for (let i = 0; i < -fifths; i++) acc[FLAT_ORDER[i]] = -1;
  return acc;
}
function parseABC(abc, bpmOverride) {
  let L = 1 / 8, bpm = 100, keyAcc = {}, body = [];
  for (const line of abc.split(/\r?\n/)) {
    const h = line.match(/^([A-Za-z]):\s*(.*)$/);
    if (h) {
      if (h[1] === 'L') { const f = h[2].match(/(\d+)\/(\d+)/); if (f) L = +f[1] / +f[2]; }
      else if (h[1] === 'Q') { const q = h[2].match(/(?:(\d+)\/(\d+)\s*=\s*)?(\d+)/); if (q) bpm = q[1] ? (+q[3]) * ((+q[1] / +q[2]) * 4) : +q[3]; }
      else if (h[1] === 'K') keyAcc = keyAccidentals(h[2]);
      continue;
    }
    if (/^%/.test(line)) continue;
    body.push(line);
  }
  if (bpmOverride) bpm = bpmOverride;
  const s = body.join(' ').replace(/"[^"]*"|![^!]*!|\{[^}]*\}|\+[^+]*\+/g, '');
  const out = []; let barAcc = {}, pending = 1, i = 0;
  const num = () => { let n = ''; while (i < s.length && /\d/.test(s[i])) n += s[i++]; return n; };
  while (i < s.length) {
    const c = s[i];
    if (c === '|') { barAcc = {}; i++; continue; }
    if (/[\s:\[\]()\-~.]/.test(c)) { i++; continue; }
    if (c === '>') { if (out.length) { const last = out[out.length - 1]; const d = last.dur * 0.5; last.dur += d; pending = 0.5; } i++; continue; }
    if (c === '<') { if (out.length) { out[out.length - 1].dur *= 0.5; pending = 1.5; } i++; continue; }
    let acc = null;
    if (c === '^' || c === '_' || c === '=') {
      let n = 0; const ch = c; while (s[i] === ch) { n++; i++; }
      acc = ch === '^' ? n : ch === '_' ? -n : 0;
    }
    const L0 = s[i];
    if (L0 && /[A-Ga-gzxZ]/.test(L0)) {
      i++;
      let oct = L0 >= 'a' && L0 <= 'g' ? 1 : 0;
      while (s[i] === "'" || s[i] === ',') { oct += s[i] === "'" ? 1 : -1; i++; }
      let mult = 1; const a = num();
      if (a) mult = +a;
      if (s[i] === '/') { i++; const b = num(); mult = mult / (b ? +b : 2); while (s[i] === '/') { i++; mult /= 2; } }
      const dur = L * 4 * mult * (60 / bpm) * pending; pending = 1;
      if (/[zxZ]/.test(L0)) { out.push({ midi: null, dur }); continue; }
      const letter = L0.toUpperCase();
      if (acc !== null) barAcc[letter] = acc;
      const shift = barAcc[letter] !== undefined ? barAcc[letter] : (keyAcc[letter] || 0);
      out.push({ midi: 60 + NOTE_SEMI[letter] + shift + 12 * oct, dur });
    } else i++;
  }
  return out;
}
let musicGain = null, songGain = null, musicOn = true, songIdx = 0, partyIdx = 0, songTimer = 0, noiseBuf = null;
// the victory party: the same two major-key tunes, much faster, with bass, chords, claps and a drum beat
const PARTY_SONGS = [
  { name: 'מעוז צור — בקצב שמח', src: 0, bpm: 152, pickup: 0 },
  { name: 'שיר הדריידל — בקצב שמח', src: 1, bpm: 160, pickup: 0.5 },
];
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
function stopSong() {
  clearTimeout(songTimer);
  if (songGain) {
    const g = songGain; songGain = null;
    try { g.gain.setTargetAtTime(0, ac.currentTime, 0.12); setTimeout(() => { try { g.disconnect(); } catch (e) { /* gone */ } }, 1000); } catch (e) { /* ignore */ }
  }
}
function tone(type, freq, t, dur, vol, attack = 0.015) {
  const o = ac.createOscillator(), g = ac.createGain();
  o.type = type; o.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(dur, 0.06));
  o.connect(g); g.connect(songGain); o.start(t); o.stop(t + dur + 0.05);
}
function noiseHit(t, dur, vol, hp) {                               // clap / hi-hat
  if (!noiseBuf) { noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
  const s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
  s.buffer = noiseBuf; f.type = 'highpass'; f.frequency.value = hp;
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f); f.connect(g); g.connect(songGain); s.start(t); s.stop(t + dur + 0.02);
}
function kickHit(t) {
  const o = ac.createOscillator(), g = ac.createGain();
  o.type = 'sine'; o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(45, t + 0.12);
  g.gain.setValueAtTime(0.4, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
  o.connect(g); g.connect(songGain); o.start(t); o.stop(t + 0.2);
}
function keyInfo(abc) {
  const m = abc.match(/^K:\s*([A-G])([b#]?)(m|min)?/m);
  if (!m) return { pc: 0, minor: false };
  return { pc: (NOTE_SEMI[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) + 12) % 12, minor: !!m[3] };
}
// oom-pah backing: low root on beats 1 & 3, chord + clap on beats 2 & 4, hi-hat on every off-beat.
// The chord (I, V or IV) is chosen to fit the melody note sounding on each beat.
function playBacking(notes, abc, t0, bpm, pickup) {
  const { pc, minor } = keyInfo(abc), beat = 60 / bpm;
  const I = minor ? [0, 3, 7] : [0, 4, 7], IV = minor ? [5, 8, 0] : [5, 9, 0], V = [7, 11, 2];
  const starts = []; let tt = 0; for (const n of notes) { starts.push(tt); tt += n.dur; }
  let idx = 0;
  for (let b = 0; ; b++) {
    const tb = pickup * beat + b * beat; if (tb >= tt) break;
    while (idx + 1 < notes.length && starts[idx + 1] <= tb + 1e-6) idx++;
    const n = notes[idx]; let ch = I;
    if (n && n.midi !== null) { const rel = (((n.midi - 60 - pc) % 12) + 12) % 12; ch = [I, V, IV].find((c) => c.includes(rel)) || I; }
    const T = t0 + tb;
    if (b % 2 === 0) { tone('triangle', mtof(36 + ((pc + ch[0]) % 12)), T, beat * 0.85, 0.24); kickHit(T); }
    else { for (const iv of ch) tone('triangle', mtof(48 + ((pc + iv) % 12)), T, beat * 0.4, 0.055); noiseHit(T, 0.1, 0.16, 1800); }
    noiseHit(T + beat / 2, 0.035, 0.06, 7000);
  }
}
function playNext() {
  stopSong();
  if (!SONGS.length || !musicOn) return;
  try {
    ac = ac || new (window.AudioContext || window.webkitAudioContext)();
    if (ac.state === 'suspended') ac.resume();
    if (!musicGain) { musicGain = ac.createGain(); musicGain.gain.value = 0.55; musicGain.connect(ac.destination); }
    songGain = ac.createGain(); songGain.connect(musicGain);
    const party = !!S.party;
    let song, base, bpm = null, pickup = 0;
    if (party) { song = PARTY_SONGS[partyIdx++ % PARTY_SONGS.length]; base = SONGS[song.src]; bpm = song.bpm; pickup = song.pickup; }
    else { song = SONGS[songIdx++ % SONGS.length]; base = song; }
    const notes = song.notes || (song.notes = parseABC(base.abc, bpm));
    const t0 = ac.currentTime + 0.3; let t = t0;
    for (const n of notes) {
      if (n.midi !== null) {
        const f = mtof(n.midi);
        tone('triangle', f, t, Math.max(n.dur * 0.95, 0.08), party ? 0.16 : 0.13, 0.02);
        tone('sine', f * 2, t, Math.max(n.dur * 0.95, 0.08), party ? 0.06 : 0.04, 0.02);
      }
      t += n.dur;
    }
    if (party) playBacking(notes, base.abc, t0, bpm, pickup);
    toast('🎵 ' + song.name, 2500);
    songTimer = setTimeout(playNext, (t - ac.currentTime + (party ? 0.4 : 1.5)) * 1000);
  } catch (e) { /* audio unavailable */ }
}
function toggleMusic() {
  musicOn = !musicOn;
  $('music-btn').textContent = musicOn ? '🎵 מוזיקה (M)' : '🔇 מוזיקה (M)';
  if (musicOn) playNext();
  else { stopSong(); if (musicGain) { try { musicGain.disconnect(); } catch (e) { /* gone */ } musicGain = null; } }
}
$('music-btn').addEventListener('click', toggleMusic);

/* ------------------------------------------------------------------ HUD */
const skillEls = SKILLS.map((s) => {
  const d = document.createElement('div'); d.className = 'skill';
  d.innerHTML = `<span class="ky">${s.key}</span><span class="ic">${s.icon}</span><span class="nm">${s.name}</span><div class="cd"></div>`;
  $('skills').appendChild(d); return d;
});
let toastTimer = 0;
function toast(msg, ms = 2600) {
  const t = $('toast'); t.textContent = msg; t.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => (t.hidden = true), ms);
}
function drawHud() {
  $('hearts').innerHTML = '🍩'.repeat(S.hearts) + '<span class="lost">' + '🍩'.repeat(MAX_HEARTS - S.hearts) + '</span>';   // your health = sufganiyot
  $('candle-count').textContent = S.placed;
  $('carry-count').textContent = S.solved - S.placed;
}
function skillUnlocked(i) { return S.solved >= SKILLS[i].unlock; }
function updateSkillUi() {
  SKILLS.forEach((s, i) => {
    skillEls[i].classList.toggle('locked', !skillUnlocked(i));
    skillEls[i].querySelector('.cd').style.height = (S.cd[i] > 0 ? (S.cd[i] / s.cd) * 100 : 0) + '%';
  });
}
const hurtEl = $('hurt');
function flashHurt() { hurtEl.classList.add('on'); requestAnimationFrame(() => requestAnimationFrame(() => hurtEl.classList.remove('on'))); }

/* ------------------------------------------------------------------ MODALS */
function openModal(id) { S.paused = true; for (const k in keys) keys[k] = false; $(id).hidden = false; }
function closeModal(id) { $(id).hidden = true; S.paused = false; }
function anyModalOpen() { return ['puzzle', 'notebook', 'accuse', 'start', 'win'].some((id) => !$(id).hidden); }

function renderNotebook(target) {
  target.innerHTML = '';
  if (!S.clues.length) { target.innerHTML = '<li><i>עדיין אין רמזים. מצא את תיבות האוצר!</i></li>'; return; }
  S.clues.forEach((c) => { const li = document.createElement('li'); li.textContent = c; target.appendChild(li); });
}
function renderSuspects(target, clickable) {
  target.innerHTML = '';
  SUSPECTS.forEach((s) => {
    const el = document.createElement(clickable ? 'button' : 'div'); el.className = 'suspect';
    el.innerHTML = `<span class="em">${s.em}</span>${s.name}`;
    if (clickable) el.addEventListener('click', () => accuse(s));
    target.appendChild(el);
  });
}
function openNotebook() { renderNotebook($('nb-clues')); renderSuspects($('nb-suspects'), false); openModal('notebook'); }

function openPuzzle(p) {
  S.activePed = p;
  S.riddle = makeRiddle(S.solved + 1);
  $('puzzle-title').textContent = `🔒 מנעול התיבה #${S.solved + 1}`;
  $('puzzle-q').textContent = S.riddle.text;
  $('puzzle-input').value = ''; $('puzzle-fb').textContent = '';
  $('puzzle-body').hidden = false; $('clue-body').hidden = true;
  openModal('puzzle');
  setTimeout(() => $('puzzle-input').focus(), 30);
}
$('puzzle-form').addEventListener('submit', (e) => {
  e.preventDefault();
  if (Number($('puzzle-input').value) === S.riddle.ans) {
    const p = S.activePed; p.solved = true;
    p.open = 0.001; p.floatC.visible = true; p.light.intensity = 1.2;
    const clue = CLUES[S.solved];
    S.clues.push(clue);
    S.solved++;
    const unlocked = SKILLS.filter((s) => s.unlock === S.solved && s.unlock > 0);
    $('puzzle-body').hidden = true; $('clue-body').hidden = false;
    $('clue-text').textContent = '🔎 ' + clue;
    $('clue-candle').textContent = `🕯️ התיבה נפתחה! מצאת נר (${S.solved}/8) — ${G('קח', 'קחי')} אותו אל החנוכייה` +
      (unlocked.length ? `   ✨ יכולת חדשה: ${unlocked.map((s) => s.icon + ' ' + s.name).join(', ')}!` : '');
    sfx(660, 0.15, 'triangle'); setTimeout(() => sfx(880, 0.25, 'triangle'), 120);
    drawHud(); updateSkillUi();
  } else {
    $('puzzle-fb').textContent = `לא בדיוק — ${G('נסה', 'נסי')} את התרגיל החדש!`;
    S.riddle = makeRiddle(S.solved + 1);
    $('puzzle-q').textContent = S.riddle.text; $('puzzle-input').value = ''; $('puzzle-input').focus();
    sfx(150, 0.2, 'sawtooth');
  }
});
$('puzzle-cancel').addEventListener('click', () => closeModal('puzzle'));
$('clue-continue').addEventListener('click', () => {
  if ($('puzzle').hidden) return;      // already closed (e.g. Space pressed while the button had focus)
  closeModal('puzzle');
  if (S.activePed && S.activePed.solved) S.activePed.floatC.visible = false;   // candle goes into your bag
  if (S.solved === 8) toast(`מצאת את כל הנרות! ${G('חזור', 'חזרי')} לחנוכייה (E) ו${G('הנח', 'הניחי')} אותם.`, 5000);
  else toast(`הנר בתיק. ${G('הבא', 'הביאי')} אותו לחנוכייה במרכז הכפר (E).`, 3500);
});

function openAccuse() {
  renderNotebook($('accuse-clues')); renderSuspects($('accuse-suspects'), true);
  $('accuse-fb').textContent = ''; openModal('accuse');
}
function accuse(s) {
  if (s.id !== THIEF) {
    $('accuse-fb').textContent = `${s.em} ${s.name} — יש לו אליבי, או שזה לא מתאים לרמזים. ${G('קרא', 'קראי')} שוב את המחברת!`;
    sfx(150, 0.3, 'sawtooth'); return;
  }
  closeModal('accuse');
  S.finished = true; S.litIdx = -1; S.litT = 0;
  soldiers.slice().forEach(killSoldier);
  toast('🐭 זה היה העכבר הקטן! תושבי הכפר סולחים לו…', 4000);
}
$('accuse-cancel').addEventListener('click', () => closeModal('accuse'));
$('notebook-close').addEventListener('click', () => closeModal('notebook'));
$('notebook-btn').addEventListener('click', () => { if (!anyModalOpen()) openNotebook(); });

/* ------------------------------------------------------------------ INPUT */
addEventListener('keydown', (e) => {
  if (e.code === 'Escape') {
    for (const id of ['puzzle', 'notebook', 'accuse']) if (!$(id).hidden) closeModal(id);
    return;
  }
  if (e.code === 'Space' && !$('puzzle').hidden && !$('clue-body').hidden) {   // Space = "Continue" on the clue screen
    e.preventDefault();
    if (!e.repeat) $('clue-continue').click();
    return;
  }
  if (S.paused) {
    if (e.code === 'KeyN' && !$('notebook').hidden) closeModal('notebook');
    return;
  }
  keys[e.code] = true;
  if (['Space', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.code)) e.preventDefault();
  if (e.repeat) return;
  if (e.code === 'KeyE') interact();
  else if (e.code === 'KeyN') openNotebook();
  else if (e.code === 'KeyM') toggleMusic();
  else if (e.code === 'Space') useSkill(0);
  else if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') useSkill(1);
  else if (e.code === 'KeyQ') useSkill(2);
  else if (e.code === 'KeyR') useSkill(3);
});
addEventListener('keyup', (e) => { keys[e.code] = false; });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; });

let drag = null;
canvas.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, moved: 0 }; canvas.setPointerCapture(e.pointerId); });
canvas.addEventListener('pointermove', (e) => {
  if (!drag) return;
  const dx = e.clientX - drag.x; drag.x = e.clientX; drag.moved += Math.abs(dx);
  yaw -= dx * 0.006;
});
canvas.addEventListener('pointerup', () => {
  if (drag && drag.moved < 5 && !S.paused) useSkill(0);
  drag = null;
});

/* ------------------------------------------------------------------ SKILLS */
function useSkill(i) {
  if (S.paused || S.finished || !skillUnlocked(i) || S.cd[i] > 0) return;
  S.cd[i] = SKILLS[i].cd;
  const fwd = new THREE.Vector3(Math.sin(hero.rotation.y), 0, Math.cos(hero.rotation.y));
  if (i === 0) {          // slash
    S.attackT = 0.001; sfx(500, 0.1, 'square');
    soldiers.slice().forEach((so) => {
      const d = so.g.position.clone().sub(hero.position); d.y = 0;
      const dist = d.length();
      // the sword can't reach through a wall
      if (dist < 3.4 && (dist < 1 || d.normalize().dot(fwd) > -0.1) && segmentClear(hero.position.x, hero.position.z, so.g.position.x, so.g.position.z)) hitSoldier(so, 1);
    });
  } else if (i === 1) {   // spinning sweep: a full 360-degree turn with the sword out, hits everyone around you
    S.spinT = 0.001; S.spinBase = hero.rotation.y; S.spinHit = false; sfx(420, 0.25, 'sawtooth', 0.05);
  } else if (i === 2) {   // shield
    S.shieldT = 4; sfx(400, 0.3, 'triangle');
  } else if (i === 3) {   // maccabee light
    S.lightT = 0.001; ring.position.set(hero.position.x, 0.2, hero.position.z); ring.visible = true;
    sfx(700, 0.4, 'sine', 0.08);
    soldiers.slice().forEach((so) => { if (so.g.position.distanceTo(hero.position) < 14) hitSoldier(so, 2); });
    toast('🔥 אור המכבים מגרש את החיילים היווניים!', 1800);
  }
}

function nearestPedestal() {
  let best = null, bd = 1e9;
  for (const p of pedestals) {
    if (p.solved) continue;
    const d = Math.hypot(p.x - hero.position.x, p.z - hero.position.z);
    if (d < bd) { bd = d; best = p; }
  }
  return { p: best, d: bd };
}
function roomAt(H, x, z) {
  const lx = x - H.cx, lz = z - H.cz;
  for (const k in ROOM_RECTS) { const [x0, x1, z0, z1] = ROOM_RECTS[k]; if (lx >= x0 && lx <= x1 && lz >= z0 && lz <= z1) return k; }
  return null;
}
// the hero must stand in the same room as the chest (no opening through walls)
function canOpen(p, d) { return !!p && d < 3 && p.house.inside && roomAt(p.house, hero.position.x, hero.position.z) === p.room; }
// an unopened potion box within reach, in the same room as the hero
function potionHere() {
  for (const p of potions) {
    if (p.used || !p.house.inside) continue;
    if (roomAt(p.house, hero.position.x, hero.position.z) !== p.room) continue;
    if (Math.hypot(p.x - hero.position.x, p.z - hero.position.z) < 2.2) return p;
  }
  return null;
}
function usePotion(p) {
  if (S.hearts >= MAX_HEARTS) { toast(`🍩 הסופגניות שלך מלאות — ${G('שמור', 'שמרי')} את הסופגנייה לאחר כך!`, 2500); return; }
  p.used = true; p.t = 0.001;
  S.hearts = Math.min(MAX_HEARTS, S.hearts + 2);
  puff(new THREE.Vector3(p.x, 1.2, p.z), 0xffe9b8, 14);
  sfx(520, 0.15, 'sine', 0.08); setTimeout(() => sfx(780, 0.25, 'sine', 0.08), 120);
  toast('🍩 סופגנייה מרפאת! קיבלת עד 2 סופגניות', 2500);
  drawHud();
}
function interact() {
  if (S.paused || S.finished) return;
  const { p, d } = nearestPedestal();
  if (canOpen(p, d)) return openPuzzle(p);
  const pt = potionHere();
  if (pt) return usePotion(pt);
  if (Math.hypot(hero.position.x, hero.position.z) < 7) {
    if (S.solved > S.placed) {
      const n = S.solved - S.placed;
      while (S.placed < S.solved) slotByOrder[S.placed++].candle.visible = true;
      menorahLight.intensity = 0.2 + S.placed * 0.08;
      puff(new THREE.Vector3(0, 5, 0), 0xffd54a, 16);
      sfx(660, 0.2, 'triangle'); drawHud();
      if (S.placed >= 8) { toast(`כל הנרות במקומם! ${G('לחץ', 'לחצי')} E כדי להאשים את הגנב.`, 4500); }
      else toast(`הנחת ${n} ${n === 1 ? 'נר' : 'נרות'} בחנוכייה. חסרים עוד ${8 - S.placed}.`);
      return;
    }
    if (S.placed >= 8) return openAccuse();
    toast(`בחנוכייה חסרים ${8 - S.placed} נרות… ${G('חפש', 'חפשי')} תיבות אוצר בחדרי הבתים!`);
  }
}

/* ------------------------------------------------------------------ GAME FLOW */
function resetGame() {
  Object.assign(S, { finished: false, solved: 0, placed: 0, hearts: MAX_HEARTS, invuln: 0, clues: [], cd: SKILLS.map(() => 0),
    shieldT: 0, spinT: 0, spinBase: 0, spinHit: false, attackT: 0, lightT: 0, spawnT: 3, litIdx: -1, litT: 0, winT: 0 });
  soldiers.slice().forEach(killSoldier);
  pedestals.forEach((p) => {
    p.solved = false; p.open = 0; p.floatC.visible = false; p.lid.rotation.x = 0; p.glow.material.opacity = 0; p.light.intensity = 0;
  });
  potions.forEach((p) => { p.used = false; p.t = 0; p.lid.rotation.x = 0; p.bottle.visible = false; });
  candleSlots.forEach((s) => { s.candle.visible = false; s.flame.visible = false; });
  shamash.candle.visible = false; shamash.flame.visible = false;
  menorahLight.intensity = 0.2;
  stopParty();
  sword.rotation.x = 1.0; spinRing.visible = false;
  hero.position.set(0, 0, 8); yaw = 0;
  drawHud(); updateSkillUi();
}
// character choice on the start screen
function applyGender() {
  document.querySelectorAll('[data-f]').forEach((el) => {
    if (el.dataset.m === undefined) el.dataset.m = el.innerHTML;
    el.innerHTML = S.female ? el.dataset.f : el.dataset.m;
  });
  $('pick-m').classList.toggle('sel', !S.female);
  $('pick-f').classList.toggle('sel', S.female);
}
function setGender(female) {
  S.female = female;
  rebuildHero(); rebuildPreview(); applyGender();
}
$('pick-m').addEventListener('click', () => setGender(false));
$('pick-f').addEventListener('click', () => setGender(true));
applyGender();

$('start-btn').addEventListener('click', () => {
  $('start').hidden = true; $('hud').hidden = false; S.started = true; S.paused = false;
  sfx(440, 0.1, 'triangle'); drawHud(); updateSkillUi();
  if (musicOn) playNext();
  toast(`${G('היכנס', 'היכנסי')} לבתים דרך הדלת עם המסגרת הזהובה, ${G('חפש', 'חפשי')} בחדרים תיבת אוצר ו${G('לחץ', 'לחצי')} E כדי לפתוח אותה.`, 6000);
});
$('again-btn').addEventListener('click', () => { $('win').hidden = true; resetGame(); S.paused = false; });

function hurtHero() {
  if (S.invuln > 0 || S.shieldT > 0) return false;
  S.hearts--; S.invuln = 1.4; flashHurt(); sfx(120, 0.25, 'sawtooth', 0.1); drawHud();
  if (S.hearts <= 0) {
    toast('נפלת! חום החנוכייה מרפא אותך…', 3000);
    S.hearts = MAX_HEARTS; hero.position.set(0, 0, 8);
    soldiers.slice().forEach(killSoldier); drawHud();
  }
  return true;
}

/* ------------------------------------------------------------------ VICTORY PARTY: villagers dance with the hero */
const VILLAGER_COUNT = 16, RING_R = 9.5, RING_SPEED = 0.35;
const SKIN_TONES = [0xf1c9a5, 0xd9a577, 0xb97f55, 0x8a5a3c, 0xe8b996];
const CLOTHES = [0xc0392b, 0x2e86c1, 0x27ae60, 0x8e44ad, 0xd68910, 0x16a085, 0xc2185b, 0x5d6d7e, 0x7d6608];
const HAIRS = [0x2b1a0e, 0x5a3318, 0x8a6d3b, 0x111111];
const villagers = [];
function buildVillager(i) {
  const female = i % 2 === 1, kid = i % 5 === 4;
  const g = new THREE.Group();
  const skin = mat(SKIN_TONES[i % 5], { roughness: 0.8 }), cloth = mat(CLOTHES[i % 9], { roughness: 0.85 });
  const cloth2 = mat(CLOTHES[(i * 3 + 2) % 9], { roughness: 0.85 }), hair = mat(HAIRS[i % 4], { roughness: 0.9 });
  const pants = mat(0x3a3f55, { roughness: 0.9 });
  const put = (parent, geo, m, x, y, z) => { const me = new THREE.Mesh(geo, m); me.position.set(x, y, z); me.castShadow = true; parent.add(me); return me; };
  const mkLeg = (x) => { const p = new THREE.Group(); p.position.set(x, 0.95, 0); g.add(p);
    put(p, new THREE.CylinderGeometry(0.11, 0.09, 0.85, 8), pants, 0, -0.42, 0); put(p, new THREE.BoxGeometry(0.2, 0.12, 0.3), mat(0x3b2a1a), 0, -0.9, 0.05); return p; };
  const legL = mkLeg(-0.14), legR = mkLeg(0.14);
  put(g, new THREE.CylinderGeometry(0.33, 0.27, 0.9, 12), cloth, 0, 1.4, 0).scale.z = 0.7;
  if (female) put(g, new THREE.CylinderGeometry(0.28, 0.5, 0.6, 14, 1, true), Object.assign(cloth2.clone(), { side: THREE.DoubleSide }), 0, 0.85, 0);
  put(g, new THREE.CylinderGeometry(0.34, 0.34, 0.08, 12), cloth2, 0, 1.0, 0).scale.z = 0.7;       // sash / belt
  const mkArm = (sx) => { const p = new THREE.Group(); p.position.set(sx * 0.4, 1.78, 0); g.add(p);
    put(p, new THREE.CylinderGeometry(0.08, 0.07, 0.68, 8), cloth, 0, -0.34, 0); put(p, new THREE.SphereGeometry(0.075, 8, 8), skin, 0, -0.72, 0); return p; };
  const armL = mkArm(-1), armR = mkArm(1);
  put(g, new THREE.SphereGeometry(0.25, 14, 12), skin, 0, 2.05, 0).scale.y = 1.1;
  for (const ex of [-0.09, 0.09]) put(g, new THREE.SphereGeometry(0.03, 6, 6), mat(0x151515), ex, 2.08, 0.22);
  put(g, new THREE.BoxGeometry(0.1, 0.018, 0.02), mat(0xa04040), 0, 1.97, 0.235);
  if (female) {
    put(g, new THREE.SphereGeometry(0.27, 14, 12), hair, 0, 2.08, -0.06).scale.set(1, 1.05, 0.9);
    for (let k = 0; k < 4; k++) put(g, new THREE.SphereGeometry(0.075 - k * 0.01, 8, 8), hair, 0, 1.9 - k * 0.14, -0.25);
  } else {
    put(g, new THREE.SphereGeometry(0.26, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.4), i % 4 === 0 ? mat(0xf3f6ff) : mat(0x2a56c8), 0, 2.08, 0);   // kippah
    if (i % 4 === 0) put(g, new THREE.SphereGeometry(0.17, 10, 8), hair, 0, 1.92, 0.1).scale.set(0.95, 0.75, 0.6);
  }
  g.scale.setScalar(kid ? 0.66 : female ? 0.95 : 1);
  g.visible = false; scene.add(g);
  return { g, legL, legR, armL, armR, kid, slot: i + 1, path: [], pi: 0, arrived: false };
}
// ---- spinning dreidels thrown into the circle (letters נ ג ה ש)
const partyDreidels = [];
let letterTex = null;
function getLetterTex() {
  if (letterTex) return letterTex;
  letterTex = ['נ', 'ג', 'ה', 'ש'].map((ch) => {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const x = c.getContext('2d');
    x.fillStyle = '#f3f6ff'; x.fillRect(0, 0, 128, 128);
    x.fillStyle = '#1b3a9a'; x.font = 'bold 96px Arial, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText(ch, 64, 70);
    return new THREE.CanvasTexture(c);
  });
  return letterTex;
}
const dreidelBlue = mat(0x3a63e0, { roughness: 0.6 }), dreidelGold = mat(0xe6b422, { metalness: 0.2, roughness: 0.35, emissive: 0x5a3d00 });
function makePartyDreidel() {
  const g = new THREE.Group(), tilt = new THREE.Group(), spin = new THREE.Group();
  g.add(tilt); tilt.add(spin);
  const add = (m, x, y, z) => { m.position.set(x, y, z); m.castShadow = true; spin.add(m); return m; };
  add(new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.6, 0.6), dreidelBlue), 0, 0.75, 0);
  const tex = getLetterTex();
  for (let k = 0; k < 4; k++) {
    const pl = new THREE.Mesh(new THREE.PlaneGeometry(0.46, 0.46), new THREE.MeshBasicMaterial({ map: tex[k] }));
    const a = (k * Math.PI) / 2;
    pl.position.set(Math.sin(a) * 0.302, 0.75, Math.cos(a) * 0.302); pl.rotation.y = a; spin.add(pl);
  }
  const cone = add(new THREE.Mesh(new THREE.ConeGeometry(0.42, 0.45, 4), dreidelBlue), 0, 0.225, 0);
  cone.rotation.x = Math.PI; cone.rotation.y = Math.PI / 4;
  add(new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.35, 8), dreidelGold), 0, 1.225, 0);
  add(new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 8), dreidelGold), 0, 1.42, 0);
  g.scale.setScalar(1.5);
  scene.add(g);
  return { g, tilt, spin };
}
function throwDreidel(fromPos) {
  if (partyDreidels.length >= 7) return;
  const d = makePartyDreidel();
  const a = Math.random() * Math.PI * 2, r = 6.5 + Math.random() * 1.8;       // lands between the menorah and the dancers
  d.p0 = new THREE.Vector3(fromPos.x, 2.2, fromPos.z); d.p1 = new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r);
  d.t = 0; d.prec = Math.random() * 6; d.dir = Math.random() < 0.5 ? 1 : -1; d.landed = false;
  d.g.position.copy(d.p0);
  partyDreidels.push(d);
}
function updatePartyDreidels(dt, t) {
  for (let i = partyDreidels.length - 1; i >= 0; i--) {
    const d = partyDreidels[i]; d.t += dt;
    const FLY = 0.9, SPIN = 6.5, FALL = 1.1, REST = 1.4, FADE = 0.6;
    if (d.t < FLY) {                                                         // thrown in an arc
      const k = d.t / FLY;
      d.g.position.set(d.p0.x + (d.p1.x - d.p0.x) * k, d.p0.y * (1 - k) + 2.5 * 4 * k * (1 - k), d.p0.z + (d.p1.z - d.p0.z) * k);
      d.spin.rotation.y += dt * 25 * d.dir; d.tilt.rotation.z = 0.3;
    } else if (d.t < FLY + SPIN) {                                           // spins, slowly starting to wobble
      if (!d.landed) { d.landed = true; d.g.position.copy(d.p1); puff(d.p1.clone().setY(0.2), 0xffd54a, 8); sfx(900, 0.06, 'triangle', 0.07); }
      const k = (d.t - FLY) / SPIN;
      d.spin.rotation.y += dt * (24 * (1 - k * k) + 5) * d.dir;
      d.tilt.rotation.z = 0.04 + 0.45 * k * k * k;
      d.g.rotation.y += dt * (2 + 7 * k) * d.dir;                           // precession
    } else if (d.t < FLY + SPIN + FALL) {                                    // wobbles and tips over
      const k = (d.t - FLY - SPIN) / FALL;
      d.spin.rotation.y += dt * 5 * (1 - k) * d.dir;
      d.tilt.rotation.z = 0.49 + k * 0.95;
      d.g.rotation.y += dt * 3 * (1 - k) * d.dir;
      if (k > 0.85 && !d.fell) { d.fell = true; sfx(300, 0.1, 'sine', 0.06); }
    } else if (d.t > FLY + SPIN + FALL + REST) {                             // fade away
      const k = (d.t - FLY - SPIN - FALL - REST) / FADE;
      d.g.scale.setScalar(1.5 * Math.max(0, 1 - k));
      if (k >= 1) { scene.remove(d.g); partyDreidels.splice(i, 1); }
    }
  }
}

function ringPos(slot, T, out) {
  const a = S.partyAng + (slot * Math.PI * 2) / T;
  return out.set(Math.cos(a) * RING_R, 0, Math.sin(a) * RING_R);
}
function startParty() {
  if (S.party) return;
  S.spinT = 0; sword.rotation.x = 1.0; spinRing.visible = false;
  S.party = true; S.partyT = 0; S.partyAng = 0; S.heroArrived = false; S.dTimer = 0;
  while (villagers.length < VILLAGER_COUNT) villagers.push(buildVillager(villagers.length));
  villagers.forEach((v, i) => {
    const H = houses[i % 8];
    const ex = H.cx + 3, ez = H.cz + 6.6;                                   // just outside the front door
    const ang = Math.atan2(ez, ex), gap = Math.round((ang - Math.PI / 8) / (Math.PI / 4)) * (Math.PI / 4) + Math.PI / 8;
    v.g.position.set(ex + (i < 8 ? -0.5 : 0.5), 0, ez);
    v.g.rotation.y = 0; v.g.visible = true; v.arrived = false; v.pi = 0;
    // leave through the gap between houses, then walk in toward the ring
    v.path = [new THREE.Vector3(Math.cos(gap) * 30, 0, Math.sin(gap) * 30), new THREE.Vector3(Math.cos(gap) * (RING_R + 1.5), 0, Math.sin(gap) * (RING_R + 1.5))];
    v.delay = i * 0.25;
  });
  camDist = 17; camH = 9;
  if (musicOn) playNext();                    // switch to the fast, happy party arrangement
  toast('🎉 כל תושבי הכפר יוצאים לרקוד איתך סביב החנוכייה!', 5000);
}
function stopParty() {
  const wasParty = S.party;
  S.party = false; villagers.forEach((v) => { v.g.visible = false; });
  if (wasParty && musicOn) setTimeout(playNext, 0);      // back to the normal songs
  partyDreidels.forEach((d) => scene.remove(d.g)); partyDreidels.length = 0;
  camDist = 11; camH = 6.5; hero.rotation.set(0, 0, 0); hero.visible = true;
}
const _tgt = new THREE.Vector3();
function updateParty(dt, t) {
  S.partyT += dt;
  const T = villagers.length + 1;
  let allIn = S.heroArrived;
  villagers.forEach((v, i) => {
    if (S.partyT < v.delay) { v.g.visible = true; return; }
    const p = v.g.position;
    if (!v.arrived) {
      const tgt = v.pi < v.path.length ? v.path[v.pi] : ringPos(v.slot, T, _tgt);
      const dx = tgt.x - p.x, dz = tgt.z - p.z, d = Math.hypot(dx, dz), step = (v.kid ? 6 : 7) * dt;
      if (d <= step) { p.x = tgt.x; p.z = tgt.z; if (v.pi >= v.path.length) v.arrived = true; else v.pi++; }
      else { p.x += (dx / d) * step; p.z += (dz / d) * step; v.g.rotation.y = Math.atan2(dx, dz); }
      const sw = Math.sin(t * 14 + i) * 0.8;                                  // running
      v.legL.rotation.x = sw; v.legR.rotation.x = -sw; v.armL.rotation.x = -sw; v.armR.rotation.x = sw; p.y = 0;
      allIn = allIn && v.arrived;
    }
  });
  // hero walks to its place in the circle
  const hp = ringPos(0, T, _tgt);
  if (!S.heroArrived) {
    const dx = hp.x - hero.position.x, dz = hp.z - hero.position.z, d = Math.hypot(dx, dz), step = 8 * dt;
    if (d <= step) S.heroArrived = true;
    else { hero.position.x += (dx / d) * step; hero.position.z += (dz / d) * step; hero.rotation.y = Math.atan2(dx, dz);
      const sw = Math.sin(t * 16) * 0.8; legL.piv.rotation.x = sw; legR.piv.rotation.x = -sw; armL.piv.rotation.x = -sw; armR.piv.rotation.x = sw; }
    allIn = false;
  }
  const dancing = S.heroArrived && villagers.every((v) => v.arrived);
  if (dancing) {
    S.partyAng += RING_SPEED * dt;                                           // the hora: the whole circle turns together
    const bob = (ph) => Math.abs(Math.sin(t * 6 + ph)) * 0.22;
    const swing = (ph) => Math.sin(t * 6 + ph) * 0.7;
    villagers.forEach((v, i) => {
      const p = ringPos(v.slot, T, _tgt);
      v.g.position.set(p.x, bob(i), p.z); v.g.rotation.y = Math.atan2(-p.x, -p.z);
      v.legL.rotation.x = swing(i); v.legR.rotation.x = -swing(i);
      v.armL.rotation.x = -2.5 + Math.sin(t * 6 + i) * 0.25; v.armR.rotation.x = -2.5 - Math.sin(t * 6 + i) * 0.25;
      v.armL.rotation.z = -0.35; v.armR.rotation.z = 0.35;
    });
    const hp2 = ringPos(0, T, _tgt);
    hero.position.set(hp2.x, bob(7), hp2.z); hero.rotation.y = Math.atan2(-hp2.x, -hp2.z);
    legL.piv.rotation.x = swing(7); legR.piv.rotation.x = -swing(7);
    armL.piv.rotation.x = -2.5 + Math.sin(t * 6) * 0.25; armR.piv.rotation.x = -2.5 - Math.sin(t * 6) * 0.25;
    // someone throws a dreidel into the circle every couple of seconds
    S.dTimer -= dt;
    if (S.dTimer <= 0) {
      S.dTimer = 1.6 + Math.random() * 1.2;
      const thrower = Math.random() < 0.15 ? hero.position : villagers[Math.floor(Math.random() * villagers.length)].g.position;
      throwDreidel(thrower);
    }
    dreidels.forEach((d, i) => { d.rotation.y += dt * 9; d.position.y = Math.abs(Math.sin(t * 4 + i)) * 0.25; });   // the plaza dreidels twirl too
    // sparkles over the menorah
    if (Math.random() < dt * 6) puff(new THREE.Vector3((Math.random() - 0.5) * 7, 4.8 + Math.random() * 2.2, (Math.random() - 0.5) * 2), Math.random() < 0.5 ? 0xffd54a : 0xffffff, 3);
  }
  updatePartyDreidels(dt, t);
  cape.rotation.x = 0.2 + Math.sin(t * 5) * 0.12;
  hero.visible = true; bubble.visible = false; $('prompt').hidden = true;
  yaw += dt * 0.25;                                                          // slow cinematic camera orbit
}

/* ------------------------------------------------------------------ UPDATE */
const clock = new THREE.Clock();
let walkT = 0;
const tmp = new THREE.Vector3();

function update(dt, t) {
  // ambient animation (always)
  potions.forEach((p) => {
    if (p.t <= 0) return;
    p.t = Math.min(p.t + dt, 1.4);
    p.lid.rotation.x = -1.7 * Math.min(p.t / 0.4, 1);
    p.bottle.visible = p.t < 1.2;
    p.bottle.position.y = 0.5 + Math.min(p.t, 1) * 1.1;
    p.bottle.rotation.y += dt * 4;
  });
  pedestals.forEach((p) => {
    if (!p.solved) return;
    if (p.open > 0 && p.open < 1) {
      p.open = Math.min(1, p.open + dt * 1.5);
      p.lid.rotation.x = -1.9 * (1 - Math.pow(1 - p.open, 3));
      p.glow.material.opacity = 0.9 * p.open;
    }
    if (p.floatC.visible) {
      p.floatC.position.set(p.x, 1.6 + Math.sin(t * 3) * 0.12 + p.open * 0.6, p.z);
      p.floatC.rotation.y += dt * 2;
    }
  });
  dreidels.forEach((d, i) => { d.rotation.y += dt * (2 + i * 0.3); });
  const flick = 1 + Math.sin(t * 18) * 0.15;
  candleSlots.concat(shamash).forEach((s) => { if (s.flame.visible) s.flame.scale.set(flick, flick + Math.sin(t * 23) * 0.1, flick); });
  for (let i = fx.length - 1; i >= 0; i--) {
    const f = fx[i]; f.life -= dt; f.v.y -= 12 * dt; f.m.position.addScaledVector(f.v, dt);
    f.m.material.opacity = Math.max(f.life / 0.7, 0);
    if (f.life <= 0) { scene.remove(f.m); fx.splice(i, 1); }
  }
  if (ring.visible) {
    S.lightT += dt; const k = S.lightT / 0.7; ring.scale.setScalar(1 + k * 14); ring.material.opacity = 1 - k;
    if (k >= 1) { ring.visible = false; S.lightT = 0; }
  }

  // victory sequence
  if (S.finished) {
    S.litT += dt;
    if (S.litT > 0.9 && S.litIdx < 8) {
      S.litT = 0; S.litIdx++;
      if (S.litIdx === 0) { shamash.candle.visible = true; shamash.flame.visible = true; }
      else {
        const s = candleSlots[S.litIdx - 1]; s.flame.visible = true;
      }
      menorahLight.intensity = 0.6 + S.litIdx * 0.2; sfx(500 + S.litIdx * 70, 0.3, 'triangle');
      if (S.litIdx === 8) { S.winT = 0.001; startParty(); }
    }
    if (S.winT > 0) {
      S.winT += dt;
      if (S.winT > 45 && $('win').hidden) {          // let the party run for a good while first
        $('win-text').textContent = G('יהודה החזיר', 'יהודית החזירה') + ' את הנרות, ותושבי הכפר הזמינו את משפחת העכברים לחגוג איתם עם לביבות, סופגניות ומשחקי סביבון. האור זורח הכי חזק כשמשתפים אותו. פתרת את התעלומה!';
        openModal('win'); S.winT = 0;
      }
    }
  }

  if (S.party) { updateParty(dt, t); return; }

  if (S.paused) return;

  // timers
  for (let i = 0; i < S.cd.length; i++) if (S.cd[i] > 0) S.cd[i] = Math.max(0, S.cd[i] - dt);
  S.invuln = Math.max(0, S.invuln - dt);
  S.shieldT = Math.max(0, S.shieldT - dt);
  bubble.visible = S.shieldT > 0;
  hero.visible = !(S.invuln > 0 && Math.floor(t * 14) % 2 === 0);

  // camera turn
  if (keys.KeyZ) yaw += 2 * dt;
  if (keys.KeyC) yaw -= 2 * dt;

  // movement
  const fz = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0);
  const rx = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0);
  const mv = new THREE.Vector3(-Math.sin(yaw) * fz + Math.cos(yaw) * rx, 0, -Math.cos(yaw) * fz - Math.sin(yaw) * rx);
  let moving = false;
  if (mv.lengthSq() > 0) {
    mv.normalize(); hero.rotation.y = Math.atan2(mv.x, mv.z);
    hero.position.addScaledVector(mv, 7.5 * dt);
    moving = true;
  }
  // bounds + pedestal collision
  const rr = Math.hypot(hero.position.x, hero.position.z);
  if (rr > WORLD_R) { hero.position.x *= WORLD_R / rr; hero.position.z *= WORLD_R / rr; }
  for (const p of pedestals) {
    const dx = hero.position.x - p.x, dz = hero.position.z - p.z, d = Math.hypot(dx, dz);
    if (d < 1.15 && d > 0) { hero.position.x = p.x + (dx / d) * 1.15; hero.position.z = p.z + (dz / d) * 1.15; }
  }
  // walls & furniture (circle vs box)
  for (let pass = 0; pass < 2; pass++) {
    for (const b of solids) {
      const px = Math.max(b.x0, Math.min(hero.position.x, b.x1));
      const pz = Math.max(b.z0, Math.min(hero.position.z, b.z1));
      let dx = hero.position.x - px, dz = hero.position.z - pz;
      const d2 = dx * dx + dz * dz, R = 0.5;
      if (d2 < R * R) {
        if (d2 > 1e-8) { const d = Math.sqrt(d2); hero.position.x = px + (dx / d) * R; hero.position.z = pz + (dz / d) * R; }
        else {   // center is inside the box: push out through the nearest side
          const ex = Math.min(hero.position.x - b.x0, b.x1 - hero.position.x), ez = Math.min(hero.position.z - b.z0, b.z1 - hero.position.z);
          if (ex < ez) hero.position.x += (hero.position.x - b.x0 < b.x1 - hero.position.x ? -(ex + R) : ex + R);
          else hero.position.z += (hero.position.z - b.z0 < b.z1 - hero.position.z ? -(ez + R) : ez + R);
        }
      }
    }
  }
  // roofs off & walls low when the hero is in / near a house, so the camera can see
  for (const H of houses) {
    const dx = hero.position.x - H.cx, dz = hero.position.z - H.cz;
    H.inside = Math.abs(dx) < 6.4 && Math.abs(dz) < 5.4;
    H.near = Math.abs(dx) < 9 && Math.abs(dz) < 8;
    H.roof.visible = !(Math.abs(dx) < 18 && Math.abs(dz) < 18);   // camera sits up to 11 behind the hero
    const target = H.near ? 0.38 : 1;
    H.wallS += (target - H.wallS) * Math.min(1, dt * 8);
    H.walls.scale.y = H.wallS;
  }
  { // menorah: round base + the wide arms (they start low on the outer sides, so keep out of the whole width)
    const mx = hero.position.x, mz = hero.position.z, d = Math.hypot(mx, mz), R = MENORAH_R + 0.3;
    if (d < R) { const k = d > 1e-6 ? R / d : 0; hero.position.x = d > 1e-6 ? mx * k : 0; hero.position.z = d > 1e-6 ? mz * k : R; }
    const HW = MENORAH_HALF_W + 0.4, HD = 1.0 + 0.4;
    if (Math.abs(hero.position.x) < HW && Math.abs(hero.position.z) < HD) hero.position.z = hero.position.z >= 0 ? HD : -HD;
  }

  // walk animation
  if (moving) walkT += dt * 11;
  const sw = moving ? Math.sin(walkT) * 0.7 : 0;
  legL.piv.rotation.x = sw; legR.piv.rotation.x = -sw;
  armL.piv.rotation.x = -sw * 0.6;
  cape.rotation.x = 0.1 + (moving ? 0.25 + Math.sin(walkT * 0.7) * 0.1 : 0);
  if (S.attackT > 0) {
    S.attackT += dt; const k = Math.min(S.attackT / 0.28, 1);
    armR.piv.rotation.x = -2.8 + 2.5 * (1 - Math.pow(1 - k, 2));
    if (k >= 1) S.attackT = 0;
  } else armR.piv.rotation.x = -0.3 + sw * 0.6;

  // spinning sweep
  if (S.spinT > 0) {
    S.spinT += dt; const k = Math.min(S.spinT / SPIN_DUR, 1);
    hero.rotation.y = S.spinBase + k * Math.PI * 2;
    armR.piv.rotation.x = -1.57; armL.piv.rotation.x = -1.2; sword.rotation.x = Math.PI;      // sword straight out
    spinRing.visible = true; spinRing.position.set(hero.position.x, 0.25, hero.position.z);
    spinRing.rotation.z = -k * Math.PI * 2; spinRing.material.opacity = 0.55 * (1 - k * 0.6);
    cape.rotation.x = 0.6;
    if (!S.spinHit && k > 0.3) {                                             // the blade comes round: hit everything close
      S.spinHit = true;
      soldiers.slice().forEach((so) => {
        const dx = so.g.position.x - hero.position.x, dz = so.g.position.z - hero.position.z;
        if (Math.hypot(dx, dz) < 3.9 && segmentClear(hero.position.x, hero.position.z, so.g.position.x, so.g.position.z)) hitSoldier(so, 1);
      });
    }
    if (k >= 1) { S.spinT = 0; sword.rotation.x = 1.0; spinRing.visible = false; }
  }

  // Greek soldiers
  S.spawnT -= dt;
  const maxSoldiers = 2 + Math.floor(S.solved / 2);
  if (!S.finished && S.spawnT <= 0 && soldiers.length < maxSoldiers) S.spawnT = spawnSoldier() ? 6 : 0.5;
  updateFlow(dt);
  for (const so of soldiers.slice()) updateSoldier(so, dt, t);

  // prompt & compass
  const { p, d } = nearestPedestal();
  const pr = $('prompt');
  const PRESS = G('לחץ', 'לחצי') + ' E — ';
  if (canOpen(p, d)) { pr.textContent = PRESS + G('פתח', 'פתחי') + ' את התיבה הנעולה'; pr.hidden = false; }
  else if (potionHere()) { pr.textContent = PRESS + G('פתח', 'פתחי') + ' קופסת סופגניות 🍩'; pr.hidden = false; }
  else if (Math.hypot(hero.position.x, hero.position.z) < 7 && !S.finished) {
    pr.textContent = S.solved > S.placed ? PRESS + G('הנח', 'הניחי') + ' את הנרות בחנוכייה'
      : S.placed >= 8 ? PRESS + G('האשם', 'האשימי') + ' את הגנב!' : PRESS + G('בדוק', 'בדקי') + ' את החנוכייה';
    pr.hidden = false;
  } else pr.hidden = true;
  $('dist').textContent = p ? Math.round(d) + ' מ׳' : (S.finished ? '–' : 'החנוכייה');
  updateSkillUi();
}

/* ------------------------------------------------------------------ MINIMAP (rotates with the camera: up = where the camera looks) */
const mm = $('minimap'), mmc = mm.getContext('2d');
const MM = 180, MM_DPR = Math.min(devicePixelRatio || 1, 2);
mm.width = MM * MM_DPR; mm.height = MM * MM_DPR;
function drawMinimap() {
  if (S.party) { mm.style.display = 'none'; return; }
  mm.style.display = '';
  const c = MM / 2, r = c - 3, s = r / (WORLD_R + 2);          // pixels per world metre
  const x = mmc;
  x.setTransform(MM_DPR, 0, 0, MM_DPR, 0, 0);
  x.clearRect(0, 0, MM, MM);
  x.save();
  x.beginPath(); x.arc(c, c, r, 0, Math.PI * 2); x.clip();
  x.translate(c, c); x.rotate(yaw); x.scale(s, s);
  // snow field + plaza
  x.fillStyle = '#4b5f8a'; x.beginPath(); x.arc(0, 0, WORLD_R + 1, 0, Math.PI * 2); x.fill();
  x.fillStyle = '#6b7396'; x.beginPath(); x.arc(0, 0, 8, 0, Math.PI * 2); x.fill();
  // menorah
  x.fillStyle = '#f2c230'; x.beginPath(); x.arc(0, 0, 2.2, 0, Math.PI * 2); x.fill(); x.fillRect(-3.4, -0.55, 6.8, 1.1);
  // houses: floor plan, plus a gold dot while their candle chest is still closed
  houses.forEach((H, i) => {
    x.save(); x.translate(H.cx, H.cz);
    x.fillStyle = '#6b4a2a'; x.fillRect(-6, -5, 12, 10);
    x.strokeStyle = '#e3cfa6'; x.lineWidth = 0.55; x.lineCap = 'square'; x.beginPath();
    for (const [x0, x1, z0, z1] of WALL_SEGS) { x.moveTo(x0, z0); x.lineTo(x1, z1); }
    x.stroke();
    x.fillStyle = '#ffd54a'; x.fillRect(2, 4.6, 2, 0.9);                                  // front door
    const ch = pedestals[i];
    x.fillStyle = ch && ch.solved ? '#5ec27a' : '#ffd54a';
    x.beginPath(); x.arc(0, 0, ch && ch.solved ? 1.1 : 1.6, 0, Math.PI * 2); x.fill();
    if (ch && !ch.solved) { x.strokeStyle = '#1a1a2e'; x.lineWidth = 0.4; x.beginPath(); x.arc(0, 0, 1.6, 0, Math.PI * 2); x.stroke(); }
    x.restore();
  });
  // soldiers
  x.fillStyle = '#ff4040';
  for (const so of soldiers) { x.beginPath(); x.arc(so.g.position.x, so.g.position.z, 1.2, 0, Math.PI * 2); x.fill(); }
  // hero arrow (points where the hero faces)
  x.save(); x.translate(hero.position.x, hero.position.z); x.rotate(-hero.rotation.y);
  x.fillStyle = '#ffffff'; x.strokeStyle = '#2a56c8'; x.lineWidth = 0.5;
  x.beginPath(); x.moveTo(0, 2.6); x.lineTo(-1.7, -1.6); x.lineTo(0, -0.6); x.lineTo(1.7, -1.6); x.closePath(); x.fill(); x.stroke();
  x.restore();
  x.restore();
  // rim + north marker
  x.strokeStyle = '#3b4a8a'; x.lineWidth = 2; x.beginPath(); x.arc(c, c, r, 0, Math.PI * 2); x.stroke();
  x.fillStyle = '#ffffff'; x.font = 'bold 12px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillText('N', c + Math.sin(yaw) * (r - 9), c - Math.cos(yaw) * (r - 9));
}

function render() {
  if (!$('hud').hidden) drawMinimap();
  if (!$('start').hidden) {      // spinning character preview while choosing
    prevHero.rotation.y = clock.elapsedTime * 0.8;
    prevRig.cape.rotation.x = 0.15 + Math.sin(clock.elapsedTime * 2) * 0.05;
    prevRenderer.render(prevScene, prevCam);
  }
  const tx = hero.position.x, tz = hero.position.z;
  if (S.party) {            // party: orbit around the menorah so we see the whole circle
    camera.position.set(Math.sin(yaw) * camDist, camH, Math.cos(yaw) * camDist);
    camera.lookAt(0, 2.8, 0);
  } else {
    camera.position.set(tx + Math.sin(yaw) * camDist, camH, tz + Math.cos(yaw) * camDist);
    camera.lookAt(tx, 1.8, tz);
  }
  renderer.render(scene, camera);
}

function loop() {
  const dt = Math.min(clock.getDelta(), 0.05);
  update(dt, clock.elapsedTime);
  render();
  requestAnimationFrame(loop);
}
// idle camera orbit on the title screen
yaw = 0.6;
loop();
})();
