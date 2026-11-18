// Princess Bug Quest - a D&D-style math battler built with Phaser 3
const W = 960, H = 600;
const FONT = '"Segoe UI","Arial","Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif';
const HEB = /[\u0590-\u05FF]/;
// (Phaser's own setRTL made text vanish, so wrap Hebrew in Unicode right-to-left isolates instead)
function heb(s) { return HEB.test(s) ? '\u2067' + s.split('\n').join('\u2069\n\u2067') + '\u2069' : s; }
function hset(t, s) { t.setText(heb(s)); return t; }

const LEVELS = [
  { room: "מטבח",        bug: '🐜', name: "נמלת הסוכר",        hp: 3,  tip: "חיבור קל!" },
  { room: "מזווה",         bug: '🪲', name: "החיפושית הפריכה",   hp: 4,  tip: "תרגילים גדולים יותר." },
  { room: "האולם הגדול",     bug: '🐛', name: "זחל טוחן השטיחים", hp: 4,  tip: "חיסור!" },
  { room: "הספרייה",        bug: '🕷️', name: "אורגת הקורים",       hp: 5,  tip: "מתחילים לוח הכפל." },
  { room: "שער הגן",    bug: '🦟', name: "אדון היתושים", hp: 5, tip: "בוס! יש לו התקפות מיוחדות!", miniBoss: true },
  { room: "הצינוק",        bug: '🪳', name: "ג'וק הצינוק",    hp: 6,  tip: "שני שלבים עכשיו." },
  { room: "חדר המוזיקה",     bug: '🦗', name: "צרצר הצווחות",  hp: 6,  tip: "זמן לחילוק." },
  { room: "חדר השינה המלכותי",  bug: '🐝', name: "צרעה עוקצנית",     hp: 7,  tip: "זהירות עם הסוגריים." },
  { room: "מערכת האוצרות", bug: '🦂', name: "עקרב האוצרות",   hp: 8,  tip: "כמעט שם!" },
  { room: "חדר הכס",    bug: '🐞', name: "מלכת החרקים",    hp: 10, tip: "הקרב האחרון!", boss: true },
];
// bug toughness: level 2 has 3x the hit points of level 1 (3 -> 9), and every later level adds the same step (+6)
LEVELS.forEach((l, i) => { l.hp = 3 + 6 * i; });

// ---------- math puzzle generator (the "dice roll") ----------
const ri = (a, b) => Phaser.Math.Between(a, b);
function makePuzzle(level) {
  let q, ans;
  const L = level; // 1..10
  const kind = (() => {
    if (L === 1) return 'add10';
    if (L === 2) return 'add20';
    if (L === 3) return Phaser.Math.RND.pick(['sub', 'sub', 'add20']);
    if (L === 4) return Phaser.Math.RND.pick(['mul5', 'mul5', 'sub']);
    if (L === 5) return Phaser.Math.RND.pick(['mul10', 'add50', 'sub', 'mul5']);
    if (L === 6) return Phaser.Math.RND.pick(['two', 'mul10', 'sub50']);
    if (L === 7) return Phaser.Math.RND.pick(['div', 'div', 'mul10', 'two']);
    if (L === 8) return Phaser.Math.RND.pick(['brackets', 'div', 'two']);
    if (L === 9) return Phaser.Math.RND.pick(['brackets', 'mul12', 'div', 'sub50']);
    return Phaser.Math.RND.pick(['brackets', 'mul12', 'div12', 'two', 'missing']);
  })();
  let a, b, c;
  switch (kind) {
    case 'add10': a = ri(1, 9); b = ri(1, 10 - a + 1); q = `${a} + ${b}`; ans = a + b; break;
    case 'add20': a = ri(5, 15); b = ri(3, 12); q = `${a} + ${b}`; ans = a + b; break;
    case 'add50': a = ri(12, 38); b = ri(11, 40); q = `${a} + ${b}`; ans = a + b; break;
    case 'sub': a = ri(8, 25); b = ri(1, a - 1); q = `${a} − ${b}`; ans = a - b; break;
    case 'sub50': a = ri(30, 90); b = ri(11, a - 5); q = `${a} − ${b}`; ans = a - b; break;
    case 'mul5': a = ri(2, 5); b = ri(2, 5); q = `${a} × ${b}`; ans = a * b; break;
    case 'mul10': a = ri(3, 10); b = ri(3, 10); q = `${a} × ${b}`; ans = a * b; break;
    case 'mul12': a = ri(6, 12); b = ri(6, 12); q = `${a} × ${b}`; ans = a * b; break;
    case 'div': b = ri(2, 9); ans = ri(2, 9); a = b * ans; q = `${a} ÷ ${b}`; break;
    case 'div12': b = ri(3, 12); ans = ri(3, 12); a = b * ans; q = `${a} ÷ ${b}`; break;
    case 'two': a = ri(2, 9); b = ri(2, 9); c = ri(1, 12);
      if (Math.random() < 0.5) { q = `${a} × ${b} + ${c}`; ans = a * b + c; }
      else { c = ri(1, a * b - 1); q = `${a} × ${b} − ${c}`; ans = a * b - c; }
      break;
    case 'brackets': a = ri(2, 9); b = ri(2, 9); c = ri(2, 6);
      if (Math.random() < 0.5) { q = `(${a} + ${b}) × ${c}`; ans = (a + b) * c; }
      else { q = `${c} × (${a} + ${b})`; ans = c * (a + b); }
      break;
    case 'missing': a = ri(3, 12); ans = ri(3, 12); c = a * ans; q = `${a} × ? = ${c}`; break;
  }
  // 3 plausible wrong answers
  const set = new Set([ans]);
  let guard = 0;
  while (set.size < 4 && guard++ < 100) {
    const off = Phaser.Math.RND.pick([-10, -3, -2, -1, 1, 2, 3, 10, ri(-6, 6)]);
    const w = ans + off;
    if (w > 0 || ans <= 3 && w >= 0) set.add(w);
  }
  let n = 1; while (set.size < 4) set.add(ans + 20 + n++);
  return { q, ans, choices: Phaser.Math.RND.shuffle([...set]) };
}

// ---------- shared helpers ----------
function txt(scene, x, y, s, size, color = '#fff', extra = {}) {
  return scene.add.text(x, y, heb(s), Object.assign({
    fontFamily: FONT, fontSize: size + 'px', color, align: 'center',
  }, extra)).setOrigin(0.5);
}
function drawCastleBg(scene, tint) {
  const g = scene.add.graphics();
  const C = Phaser.Display.Color;
  const wallTop = C.ValueToColor(tint[0]).darken(25).color;
  const wallBot = C.ValueToColor(tint[1]).lighten(8).color;
  const FLOOR = 430;

  // ---- stone wall: gradient + staggered, individually shaded bricks ----
  g.fillGradientStyle(wallTop, wallTop, wallBot, wallBot, 1);
  g.fillRect(0, 0, W, FLOOR);
  const BH = 30, BW = 66;
  for (let row = 0, y = 0; y < FLOOR; row++, y += BH) {
    for (let x = -(row % 2) * BW / 2; x < W; x += BW) {
      const shade = Math.random();
      g.fillStyle(shade < 0.5 ? 0x000000 : 0xffffff, shade < 0.5 ? 0.05 + shade * 0.18 : 0.02 + (shade - 0.5) * 0.08);
      g.fillRect(x + 1, y + 1, BW - 2, BH - 2);
    }
  }
  g.lineStyle(2, 0x000000, 0.28);
  for (let row = 0, y = 0; y <= FLOOR; row++, y += BH) {
    g.lineBetween(0, y, W, y);
    for (let x = -(row % 2) * BW / 2; x < W; x += BW) g.lineBetween(x, y, x, y + BH);
  }
  // vaulted-ceiling shadow and side vignette
  g.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0.75, 0.75, 0, 0);
  g.fillRect(0, 0, W, 150);
  g.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0.55, 0, 0.55, 0);
  g.fillRect(0, 0, 160, FLOOR);
  g.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0, 0.55, 0, 0.55);
  g.fillRect(W - 160, 0, 160, FLOOR);

  // ---- arched windows with moonlight ----
  const windows = [150, 480, 810];
  windows.forEach(x => {
    // light beam falling on the floor
    g.fillStyle(0xdfe8ff, 0.07);
    g.fillPoints([{ x: x - 38, y: 215 }, { x: x + 38, y: 215 }, { x: x + 150, y: FLOOR + 120 }, { x: x - 30, y: FLOOR + 120 }], true);
    // stone frame + arched opening
    g.fillStyle(0x6d6577, 1); g.fillRoundedRect(x - 49, 78, 98, 150, { tl: 49, tr: 49, bl: 4, br: 4 });
    g.fillGradientStyle(0x0b1230, 0x0b1230, 0x2b3a78, 0x2b3a78, 1);
    g.fillRoundedRect(x - 40, 88, 80, 138, { tl: 40, tr: 40, bl: 0, br: 0 });
    g.fillStyle(0xfff6d0, 1); g.fillCircle(x + 14, 128, 11);                  // moon
    g.fillStyle(0xffffff, 0.8); [[-18, 112], [-5, 150], [20, 170], [-22, 180]].forEach(([dx, dy]) => g.fillCircle(x + dx, dy, 1.6));
    g.lineStyle(5, 0x2a2533, 1);                                              // window bars
    g.lineBetween(x, 88, x, 226); g.lineBetween(x - 40, 160, x + 40, 160);
    g.fillStyle(0x4d4658, 1); g.fillRect(x - 56, 226, 112, 12);               // sill
  });

  // ---- stone pillars with capitals and bases ----
  [28, 320, 640, 932].forEach((x, i) => {
    const w = i % 3 === 0 ? 56 : 46;
    g.fillGradientStyle(0x4a4356, 0x8b8398, 0x4a4356, 0x8b8398, 1);
    g.fillRect(x - w / 2, 0, w, FLOOR);
    g.lineStyle(2, 0x000000, 0.25);
    for (let y = 0; y < FLOOR; y += 52) g.lineBetween(x - w / 2, y, x + w / 2, y);
    g.fillStyle(0x6d6577, 1); g.fillRect(x - w / 2 - 8, 120, w + 16, 22); g.fillRect(x - w / 2 - 14, 140, w + 28, 12);   // capital
    g.fillStyle(0x5a5266, 1); g.fillRect(x - w / 2 - 10, FLOOR - 26, w + 20, 26);                                         // base
  });

  // ---- hanging banners ----
  [[235, 0xa3182b], [725, 0x1f4fa3]].forEach(([x, col]) => {
    g.fillStyle(0x3a2a14, 1); g.fillRect(x - 32, 118, 64, 6);
    g.fillStyle(col, 1); g.fillPoints([{ x: x - 28, y: 124 }, { x: x + 28, y: 124 }, { x: x + 28, y: 250 }, { x, y: 282 }, { x: x - 28, y: 250 }], true);
    g.lineStyle(3, 0xe8bd3c, 1); g.strokePoints([{ x: x - 28, y: 124 }, { x: x + 28, y: 124 }, { x: x + 28, y: 250 }, { x, y: 282 }, { x: x - 28, y: 250 }], true);
    g.fillStyle(0xe8bd3c, 1); g.fillCircle(x, 178, 14);                      // gold crest
    g.fillStyle(col, 1); g.fillCircle(x, 178, 8);
  });

  // ---- floor: stone flags in perspective + red carpet ----
  g.fillGradientStyle(0x2c2638, 0x2c2638, 0x14101c, 0x14101c, 1);
  g.fillRect(0, FLOOR, W, H - FLOOR);
  g.lineStyle(2, 0x000000, 0.45);
  for (let k = 0; k < 8; k++) { const y = FLOOR + Math.pow(k, 1.55) * 9 + 4; g.lineBetween(0, y, W, y); }
  for (let i = -8; i <= 8; i++) g.lineBetween(W / 2 + i * 36, FLOOR, W / 2 + i * 150, H);
  g.fillStyle(0x000000, 0.35); g.fillRect(0, FLOOR, W, 8);                    // contact shadow under the wall
  g.fillStyle(0x7a1626, 1); g.fillPoints([{ x: 430, y: FLOOR }, { x: 530, y: FLOOR }, { x: 700, y: H }, { x: 260, y: H }], true);
  g.lineStyle(5, 0xe8bd3c, 0.9);
  g.lineBetween(430, FLOOR, 260, H); g.lineBetween(530, FLOOR, 700, H);
  g.fillStyle(0x000000, 0.3);                                                  // floor vignette
  g.fillRect(0, FLOOR, 90, H - FLOOR); g.fillRect(W - 90, FLOOR, 90, H - FLOOR);

  // ---- torches on the middle pillars: iron bracket + flickering flame + warm glow ----
  [320, 640].forEach((x, i) => {
    const y = 250;
    g.fillStyle(0x1b1720, 1); g.fillRect(x - 5, y + 6, 10, 34); g.fillRect(x - 11, y + 2, 22, 8);
    const glow = scene.add.circle(x, y - 14, 95, 0xffa040, 0.16).setBlendMode(Phaser.BlendModes.ADD);
    const outer = scene.add.ellipse(x, y - 14, 18, 34, 0xff8a1f);
    const inner = scene.add.ellipse(x, y - 8, 9, 20, 0xffe27a);
    scene.tweens.add({ targets: [outer, inner], scaleY: { from: 0.85, to: 1.2 }, scaleX: { from: 0.9, to: 1.1 },
      duration: 170 + i * 40, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    scene.tweens.add({ targets: glow, alpha: { from: 0.1, to: 0.24 }, scale: { from: 0.94, to: 1.06 },
      duration: 260 + i * 70, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
  });
  return g;
}

function button(scene, x, y, w, h, label, cb, color = 0x7b3fe4) {
  const c = scene.add.container(x, y);
  const bg = scene.add.rectangle(0, 0, w, h, color).setStrokeStyle(3, 0xffffff, 0.8);
  const t = txt(scene, 0, 0, label, 28, '#fff', { fontStyle: 'bold' });
  c.add([bg, t]);
  bg.setInteractive({ useHandCursor: true })
    .on('pointerover', () => bg.setFillStyle(Phaser.Display.Color.ValueToColor(color).lighten(18).color))
    .on('pointerout', () => bg.setFillStyle(color))
    .on('pointerdown', () => { SND.unlock(); SND.sfx('click'); cb(); });
  c.bg = bg; c.label = t;
  return c;
}


// ---------- sound: everything is synthesised with Web Audio, no audio files needed ----------
const midi = n => 440 * Math.pow(2, (n - 69) / 12);
const SND = {
  ctx: null, master: null, musicBus: null, sfxBus: null,
  muted: (() => { try { return localStorage.getItem('pq-muted') === '1'; } catch (e) { return false; } })(),
  track: null, want: null, step: 0, nextTime: 0, timer: null,
  unlock() {
    try {
      if (!this.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        this.ctx = new AC();
        this.master = this.ctx.createGain(); this.master.gain.value = this.muted ? 0 : 0.6; this.master.connect(this.ctx.destination);
        this.musicBus = this.ctx.createGain(); this.musicBus.gain.value = 0.32; this.musicBus.connect(this.master);
        this.sfxBus = this.ctx.createGain(); this.sfxBus.gain.value = 0.9; this.sfxBus.connect(this.master);
      }
      if (this.ctx.state !== 'running') this.ctx.resume();
      if (this.want && !this.track) this.music(this.want);
    } catch (e) { /* audio is optional */ }
  },
  toggleMute() {
    this.muted = !this.muted;
    try { localStorage.setItem('pq-muted', this.muted ? '1' : '0'); } catch (e) {}
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.6;
    return this.muted;
  },
  tone(f, dur, type = 'square', vol = 0.3, when = 0, slideTo = null, bus = null) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + when;
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(bus || this.sfxBus);
    o.start(t); o.stop(t + dur + 0.05);
  },
  noise(dur, vol = 0.3, when = 0, hp = 800, bus = null) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + when;
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource(); src.buffer = buf;
    const f = this.ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = hp;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(bus || this.sfxBus);
    src.start(t);
  },
  sfx(name) {
    if (!this.ctx || this.muted) return;
    const T = this.tone.bind(this), N = this.noise.bind(this);
    switch (name) {
      case 'click': T(660, 0.05, 'square', 0.12); break;
      case 'correct': [523, 659, 784].forEach((f, i) => T(f, 0.12, 'triangle', 0.3, i * 0.07)); break;
      case 'wrong': T(220, 0.35, 'sawtooth', 0.25, 0, 90); break;
      case 'slash': N(0.18, 0.35, 0, 2500); T(900, 0.14, 'sawtooth', 0.14, 0, 250); break;
      case 'bughit': N(0.12, 0.4, 0, 400); T(160, 0.18, 'square', 0.3, 0, 55); break;
      case 'crit': N(0.2, 0.4, 0, 2000); T(1318, 0.25, 'triangle', 0.3, 0.05); T(1760, 0.3, 'triangle', 0.22, 0.12); break;
      case 'hurt': N(0.25, 0.4, 0, 300); T(180, 0.4, 'sawtooth', 0.3, 0, 60); break;
      case 'appear': T(70, 0.5, 'sawtooth', 0.3, 0, 180); T(90, 0.5, 'square', 0.15, 0.05, 220); break;
      case 'bugdie': T(900, 0.6, 'square', 0.22, 0, 80); N(0.3, 0.25, 0.1, 600); break;
      case 'coin': T(988, 0.07, 'square', 0.2); T(1319, 0.25, 'square', 0.2, 0.07); break;
      case 'potion': for (let i = 0; i < 6; i++) T(300 + i * 90 + Math.random() * 60, 0.1, 'sine', 0.3, i * 0.06, null); break;
      case 'levelup': [523, 659, 784, 1047, 1319].forEach((f, i) => T(f, 0.2, 'square', 0.2, i * 0.08)); break;
      case 'win': [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => T(f, 0.22, 'triangle', 0.32, i * 0.13)); break;
      case 'lose': [392, 349, 330, 262].forEach((f, i) => T(f, 0.4, 'sawtooth', 0.22, i * 0.28)); break;
      case 'bossattack': T(60, 0.6, 'sawtooth', 0.4, 0, 200); T(120, 0.5, 'square', 0.2, 0.1, 300); N(0.3, 0.3, 0, 300); break;
      case 'tick': T(880, 0.05, 'square', 0.15); break;
    }
  },
  // 16-step loops; MIDI notes, 0 = rest
  TRACKS: {
    menu:   { bpm: 92,  lead: [72,76,79,76,77,81,79,76, 74,77,81,77,79,76,72,0], bass: [48,0,0,0,53,0,0,0, 55,0,0,0,48,0,0,0], lw: 'triangle', bw: 'sine', drums: false },
    shop:   { bpm: 112, lead: [67,0,71,0,74,71,67,0, 69,0,72,0,76,72,69,0],     bass: [43,0,50,0,43,0,50,0, 48,0,55,0,48,0,55,0], lw: 'square', bw: 'triangle', drums: false },
    battle: { bpm: 132, lead: [69,72,76,72,69,72,76,81, 67,71,74,71,67,71,74,79], bass: [45,45,45,45,45,45,45,45, 43,43,43,43,43,43,43,43], lw: 'square', bw: 'sawtooth', drums: true },
    boss:   { bpm: 156, lead: [62,65,69,65,62,65,70,65, 60,64,67,64,60,64,68,64], bass: [38,38,38,38,38,38,38,38, 36,36,36,36,36,36,36,36], lw: 'sawtooth', bw: 'sawtooth', drums: true },
  },
  music(name) {
    this.want = name;
    if (!this.ctx) return;
    this.stopMusic(true);
    const tr = this.TRACKS[name];
    if (!tr) return;
    this.track = tr; this.step = 0; this.nextTime = this.ctx.currentTime + 0.1;
    this.timer = setInterval(() => this.schedule(), 60);
  },
  stopMusic(keepWant = false) {
    if (!keepWant) this.want = null;
    clearInterval(this.timer); this.timer = null; this.track = null;
  },
  schedule() {
    const tr = this.track;
    if (!tr || !this.ctx) return;
    const dur = 60 / tr.bpm / 2; // eighth notes
    while (this.nextTime < this.ctx.currentTime + 0.25) {
      const when = this.nextTime - this.ctx.currentTime, i = this.step % 16;
      if (tr.lead[i]) this.tone(midi(tr.lead[i]), dur * 0.9, tr.lw, tr.drums ? 0.16 : 0.3, when, null, this.musicBus);
      if (tr.bass[i]) this.tone(midi(tr.bass[i]), dur * 0.95, tr.bw, tr.drums ? 0.22 : 0.4, when, null, this.musicBus);
      if (tr.drums) {
        if (i % 4 === 0) this.tone(150, 0.12, 'sine', 0.7, when, 40, this.musicBus);
        if (i % 2 === 1) this.noise(0.04, 0.12, when, 7000, this.musicBus);
        if (i % 8 === 4) this.noise(0.12, 0.2, when, 1500, this.musicBus);
      }
      this.nextTime += dur; this.step++;
    }
  },
};
['pointerdown', 'keydown', 'touchstart'].forEach(ev => window.addEventListener(ev, () => SND.unlock(), { passive: true }));
window.addEventListener('keydown', e => { if (e.key === 'm' || e.key === 'M') SND.toggleMute(); });
// keep the stage quiet when the tab is hidden
document.addEventListener('visibilitychange', () => { if (SND.ctx) document.hidden ? SND.ctx.suspend() : SND.ctx.resume(); });
function addSoundToggle(scene, x = W - 24, y = 80) {
  const t = txt(scene, x, y, SND.muted ? '🔇' : '🔊', 26).setInteractive({ useHandCursor: true }).setDepth(100);
  t.on('pointerdown', () => { SND.toggleMute(); t.setText(SND.muted ? '🔇' : '🔊'); });
  scene.input.keyboard.on('keydown-M', () => t.setText(SND.muted ? '🔇' : '🔊'));
  return t;
}


// ---------- princess avatar & wardrobe (cosmetic only: no effect on attributes) ----------
const SKIN = 0xffdcb8;
const CAT = {
  dress: [
    { id: 'd0', name: 'שמלה ורודה',   color: 0xe86aa6, price: 0 },
    { id: 'd1', name: 'כחול מלכותי',  color: 0x3a5fd6, price: 10 },
    { id: 'd2', name: 'ירוק יער',     color: 0x2f9e5a, price: 12 },
    { id: 'd3', name: 'סגול כוכבים',  color: 0x8a4fd6, price: 14, deco: 'stars' },
    { id: 'd4', name: 'אדום ארגמן',   color: 0xc0243a, price: 16 },
    { id: 'd5', name: 'שמלת זהב',     color: 0xe8b83c, price: 30, deco: 'gems' },
  ],
  hair: [
    { id: 'h0', name: 'בלונדינית',  color: 0xf0b840, price: 0 },
    { id: 'h1', name: 'ערמונית',    color: 0x8a4a22, price: 6 },
    { id: 'h2', name: 'שחורה',      color: 0x2a2430, price: 6 },
    { id: 'h3', name: "ג'ינג'ית",   color: 0xd8561f, price: 8 },
    { id: 'h4', name: 'ורודה',      color: 0xff7ab8, price: 12 },
    { id: 'h5', name: 'כחולה',      color: 0x4a8af0, price: 12 },
    { id: 'h6', name: 'סגולה',      color: 0x9a5ae0, price: 12 },
    { id: 'h7', name: 'כסופה',      color: 0xdfe4ee, price: 14 },
  ],
  style: [
    { id: 't0', name: 'שיער ארוך',   style: 'long',     price: 0 },
    { id: 't1', name: 'קארה',        style: 'bob',      price: 6 },
    { id: 't2', name: 'קוקו',        style: 'ponytail', price: 8 },
    { id: 't3', name: 'צמה',         style: 'braid',    price: 10 },
    { id: 't4', name: 'שני פקעות',   style: 'buns',     price: 10 },
    { id: 't5', name: 'תלתלים',      style: 'curly',    price: 12 },
    { id: 't6', name: 'שיער קצר',    style: 'short',    price: 6 },
  ],
  jewel: [
    { id: 'j0', name: 'בלי תכשיטים',  style: 'none', price: 0 },
    { id: 'j1', name: 'סט פנינים',    style: 'set', bead: 0xf4f0ea, gem: 0xf4f0ea, price: 8 },
    { id: 'j2', name: 'סט זהב',       style: 'set', bead: 0xf2c94c, gem: 0xf2c94c, price: 12 },
    { id: 'j3', name: 'סט רובי',      style: 'set', bead: 0xf2c94c, gem: 0xd8243a, price: 16 },
    { id: 'j4', name: 'סט ספיר',      style: 'set', bead: 0xdfe4ee, gem: 0x3a6ae0, price: 16 },
    { id: 'j5', name: 'סט אמרלד',     style: 'set', bead: 0xf2c94c, gem: 0x2fb86a, price: 16 },
    { id: 'j6', name: 'סט יהלומים',   style: 'set', bead: 0xdfe4ee, gem: 0xcdf3ff, price: 26 },
  ],
  crown: [
    { id: 'c0', name: 'נזר זהב',       style: 'tiara',   price: 0 },
    { id: 'c1', name: 'כתר מלכותי',    style: 'royal',   price: 8 },
    { id: 'c2', name: 'כתר כסף',       style: 'silver',  price: 10 },
    { id: 'c3', name: 'זר פרחים',      style: 'flowers', price: 12 },
    { id: 'c4', name: 'כתר יהלומים',   style: 'diamond', price: 25 },
    { id: 'c5', name: 'כתר להבות',     style: 'flame',   price: 30 },
  ],
  shoes: [
    { id: 's0', name: 'נעלי עור',      style: 'plain',   color: 0x7a4a2a, price: 0 },
    { id: 's1', name: 'נעלי קריסטל',   style: 'crystal', color: 0xa8e6ff, price: 8 },
    { id: 's2', name: 'נעלי זהב',      style: 'plain',   color: 0xf2c94c, price: 12 },
    { id: 's3', name: 'מגפי אבירה',    style: 'boots',   color: 0x4a4f5a, price: 14 },
    { id: 's4', name: 'נעלי רובי',     style: 'bow',     color: 0xd8243a, price: 10 },
  ],
  weapon: [
    { id: 'w0', name: 'חרב פלדה',      style: 'sword', blade: 0xd8dde6, guard: 0xe8b83c, price: 0 },
    { id: 'w1', name: 'חרב זהב',       style: 'sword', blade: 0xf0c93a, guard: 0xb8892a, price: 10 },
    { id: 'w2', name: 'חרב קרח',       style: 'sword', blade: 0x9fe3ff, guard: 0x5aa0d6, glow: 0xbff0ff, price: 14 },
    { id: 'w3', name: 'חרב להבה',      style: 'sword', blade: 0xff7a1f, guard: 0x5a1a10, glow: 0xffd24a, price: 18 },
    { id: 'w4', name: 'שרביט קסמים',   style: 'wand',  price: 12 },
    { id: 'w5', name: 'גרזן קרב',      style: 'axe',   price: 16 },
  ],
  crest: [
    { id: 'r0', name: 'אריה',   emoji: '🦁', color: 0xb3262e, price: 0 },
    { id: 'r1', name: 'דרקון',  emoji: '🐉', color: 0x2f7a4a, price: 10 },
    { id: 'r2', name: 'נשר',    emoji: '🦅', color: 0x2a4fa0, price: 10 },
    { id: 'r3', name: 'ורד',    emoji: '🌹', color: 0x8a1f5a, price: 8 },
    { id: 'r4', name: 'כוכב',   emoji: '⭐', color: 0x6a3fb8, price: 8 },
    { id: 'r5', name: 'זאב',    emoji: '🐺', color: 0x4a5362, price: 12 },
    { id: 'r6', name: 'כתר',    emoji: '👑', color: 0xb8892a, price: 14 },
  ],
};
const SLOTS = [['dress', 'שמלה'], ['hair', 'צבע שיער'], ['style', 'תסרוקת'], ['crown', 'כתר'], ['jewel', 'תכשיטים'], ['shoes', 'נעליים'], ['weapon', 'נשק'], ['crest', 'סמל']];
const WARDROBE = (() => {
  const d = { owned: { dress: ['d0'], hair: ['h0'], style: ['t0'], crown: ['c0'], jewel: ['j0'], shoes: ['s0'], weapon: ['w0'], crest: ['r0'] },
              eq: { dress: 'd0', hair: 'h0', style: 't0', crown: 'c0', jewel: 'j0', shoes: 's0', weapon: 'w0', crest: 'r0' } };
  try {
    const saved = JSON.parse(localStorage.getItem('pq-wardrobe') || 'null');
    if (saved && saved.owned && saved.eq) {
      for (const k in d.owned) if (Array.isArray(saved.owned[k]) && saved.owned[k].length) { d.owned[k] = saved.owned[k]; d.eq[k] = saved.eq[k] || d.eq[k]; }
    }
  } catch (e) {}
  return d;
})();
const saveWardrobe = () => { try { localStorage.setItem('pq-wardrobe', JSON.stringify(WARDROBE)); } catch (e) {} };
const itemOf = (slot, id) => CAT[slot].find(i => i.id === id) || CAT[slot][0];
const eqItem = slot => itemOf(slot, WARDROBE.eq[slot]);
const hairColor = () => eqItem('hair').color;
const hairStyle = () => eqItem('style').style;
const weaponKey = id => 'pr_w_' + (id || WARDROBE.eq.weapon);

// hair behind the head/body; the hairstyle decides its shape
function drawHairBack(g, col = hairColor(), style = hairStyle()) {
  const dark = Phaser.Display.Color.ValueToColor(col).darken(22).color;
  const body = (x, y, w, h) => { g.fillStyle(col, 1); g.fillEllipse(x, y, w, h); g.fillStyle(dark, 0.5); g.fillEllipse(x, y + h * 0.1, w * 0.85, h * 0.8); };
  switch (style) {
    case 'bob':      body(70, 54, 76, 58); break;
    case 'short':    body(70, 44, 62, 52); break;
    case 'ponytail':
      body(70, 50, 64, 60);
      g.fillStyle(col, 1); g.fillPoints([{ x: 88, y: 26 }, { x: 112, y: 36 }, { x: 122, y: 72 }, { x: 110, y: 104 }, { x: 102, y: 74 }, { x: 94, y: 48 }], true);
      g.fillStyle(dark, 0.5); g.fillPoints([{ x: 104, y: 44 }, { x: 116, y: 70 }, { x: 110, y: 96 }, { x: 104, y: 72 }], true);
      break;
    case 'buns':
      body(70, 52, 66, 62);
      g.fillStyle(col, 1); g.fillCircle(44, 22, 15); g.fillCircle(96, 22, 15);
      g.fillStyle(dark, 0.5); g.fillCircle(46, 25, 9); g.fillCircle(98, 25, 9);
      break;
    case 'curly':
      for (let i = 0; i < 11; i++) { const a = Math.PI * (0.95 + i * 0.11); g.fillStyle(i % 2 ? col : dark, 1); g.fillCircle(70 + 33 * Math.cos(a), 52 + 31 * Math.sin(a), 14); }
      g.fillStyle(col, 1); g.fillCircle(70, 52, 30);
      [[38, 80], [102, 80], [32, 100], [108, 100], [40, 118], [100, 118]].forEach(([x, y], i) => { g.fillStyle(i % 2 ? dark : col, 1); g.fillCircle(x, y, 12); });
      break;
    case 'braid':    body(70, 56, 76, 66); break;
    default:         body(70, 68, 80, 96); // long
  }
}
// parts of the hair that go in front of the face / body
function drawHairFront(g, col, style) {
  const dark = Phaser.Display.Color.ValueToColor(col).darken(25).color;
  if (style === 'braid') {
    for (let i = 0; i < 6; i++) { const y = 76 + i * 15, x = 100 + Math.sin(i) * 3; g.fillStyle(i % 2 ? dark : col, 1); g.fillEllipse(x, y, 16, 19); }
    g.fillStyle(0xd8243a, 1); g.fillCircle(102, 164, 5); g.fillTriangle(102, 164, 92, 158, 92, 170); g.fillTriangle(102, 164, 112, 158, 112, 170);
  } else if (style === 'curly') {
    [[54, 27], [66, 22], [78, 22], [90, 27]].forEach(([x, y], i) => { g.fillStyle(i % 2 ? dark : col, 1); g.fillCircle(x, y, 9); });
  } else if (style === 'bob' || style === 'short') {
    g.fillStyle(col, 1); g.fillEllipse(48, 52, 12, style === 'bob' ? 30 : 18); g.fillEllipse(92, 52, 12, style === 'bob' ? 30 : 18);
  } else if (style === 'ponytail') {
    g.fillStyle(0xff7ab8, 1); g.fillCircle(90, 29, 5);
  } else if (style === 'buns') {
    g.fillStyle(0xff7ab8, 1); g.fillCircle(52, 30, 3.5); g.fillCircle(88, 30, 3.5);
  }
}
function drawHead(g, col = hairColor(), style = hairStyle()) {
  g.fillStyle(SKIN, 1); g.fillRect(63, 64, 14, 10); g.fillCircle(70, 44, 25);
  g.fillStyle(col, 1); g.beginPath(); g.arc(70, 44, 26, Math.PI, Math.PI * 2); g.closePath(); g.fillPath();   // hair on top
  g.fillStyle(SKIN, 1); g.fillEllipse(70, 44, 36, 20);                                                       // forehead
  g.fillStyle(0x3a2a2a, 1); g.fillCircle(61, 49, 2.8); g.fillCircle(79, 49, 2.8);
  g.fillStyle(0xffffff, 1); g.fillCircle(62, 48, 1); g.fillCircle(80, 48, 1);
  g.fillStyle(0xff9aa8, 0.6); g.fillCircle(55, 56, 4.5); g.fillCircle(85, 56, 4.5);
  g.lineStyle(2, 0xb03a4a, 1); g.beginPath(); g.arc(70, 55, 7, 0.25, Math.PI - 0.25); g.strokePath();
  drawHairFront(g, col, style);
}
// necklace + earrings + bracelets
function drawJewelPart(g, j) {
  if (j.style === 'none') return;
  for (let i = 0; i <= 10; i++) { const t = i / 10; g.fillStyle(j.bead, 1); g.fillCircle(56 + 28 * t, 73 + 15 * Math.sin(Math.PI * t), 2.3); }
  g.fillStyle(j.gem, 1); g.fillCircle(70, 91, 4.5); g.fillStyle(0xffffff, 0.75); g.fillCircle(68.5, 89.5, 1.5);
  g.lineStyle(1.2, 0x00000, 0.35); g.strokeCircle(70, 91, 4.5);
  [46, 94].forEach(x => { g.fillStyle(j.bead, 1); g.fillCircle(x, 54, 2); g.fillStyle(j.gem, 1); g.fillCircle(x, 60, 3.4); g.fillStyle(0xffffff, 0.7); g.fillCircle(x - 1, 59, 1); });
  [36, 104].forEach(x => { g.fillStyle(j.bead, 1); g.fillRoundedRect(x - 7, 117, 14, 5, 2); g.fillStyle(j.gem, 1); g.fillCircle(x, 119.5, 2.2); });
}
function drawDressPart(g, d) {
  const C = Phaser.Display.Color, base = d.color;
  const light = C.ValueToColor(base).lighten(25).color, dark = C.ValueToColor(base).darken(25).color;
  // arms first (sleeves cover the tops)
  g.fillStyle(SKIN, 1); g.fillEllipse(37, 104, 11, 44); g.fillEllipse(103, 104, 11, 44); g.fillCircle(36, 126, 6); g.fillCircle(104, 126, 6);
  g.fillStyle(dark, 1); g.fillPoints([{ x: 46, y: 100 }, { x: 94, y: 100 }, { x: 128, y: 206 }, { x: 12, y: 206 }], true);
  g.fillStyle(base, 1); g.fillPoints([{ x: 48, y: 100 }, { x: 92, y: 100 }, { x: 122, y: 204 }, { x: 18, y: 204 }], true);
  g.lineStyle(2, dark, 0.55);
  [-34, -17, 17, 34].forEach(dx => g.lineBetween(70 + dx * 0.3, 104, 70 + dx * 1.5, 203));
  g.fillStyle(light, 1); g.fillPoints([{ x: 19, y: 192 }, { x: 121, y: 192 }, { x: 122, y: 204 }, { x: 18, y: 204 }], true);
  g.fillStyle(base, 1); g.fillRoundedRect(50, 68, 40, 38, 8);
  g.fillStyle(light, 1); g.fillRect(50, 97, 40, 7);
  g.fillStyle(base, 1); g.fillCircle(46, 77, 10); g.fillCircle(94, 77, 10);
  g.fillStyle(light, 1); g.fillCircle(46, 77, 4); g.fillCircle(94, 77, 4);
  if (d.deco === 'stars') { g.fillStyle(0xffe27a, 1); [[40, 150], [70, 130], [100, 160], [60, 180], [85, 188], [48, 118]].forEach(([x, y]) => g.fillCircle(x, y, 3)); }
  if (d.deco === 'gems') {
    g.fillStyle(0xd8243a, 1); g.fillPoints([{ x: 70, y: 94 }, { x: 77, y: 100 }, { x: 70, y: 108 }, { x: 63, y: 100 }], true);
    g.fillStyle(0xffffff, 1); [[35, 196], [55, 198], [85, 198], [105, 196]].forEach(([x, y]) => g.fillCircle(x, y, 2.5));
  }
}
function drawCrownPart(g, c) {
  const poly = (pts, col, line) => { g.fillStyle(col, 1); g.fillPoints(pts, true); if (line) { g.lineStyle(1.5, line, 1); g.strokePoints(pts, true); } };
  const gem = (x, y, col, r = 3) => { g.fillStyle(col, 1); g.fillCircle(x, y, r); g.fillStyle(0xffffff, 0.7); g.fillCircle(x - 1, y - 1, r / 3); };
  switch (c.style) {
    case 'tiara':
      poly([{ x: 52, y: 27 }, { x: 58, y: 14 }, { x: 64, y: 22 }, { x: 70, y: 10 }, { x: 76, y: 22 }, { x: 82, y: 14 }, { x: 88, y: 27 }], 0xf2c94c, 0xb8892a);
      gem(70, 17, 0xd8243a); break;
    case 'royal':
      poly([{ x: 50, y: 29 }, { x: 50, y: 10 }, { x: 60, y: 20 }, { x: 70, y: 6 }, { x: 80, y: 20 }, { x: 90, y: 10 }, { x: 90, y: 29 }], 0xf2c94c, 0xb8892a);
      g.fillStyle(0xb8892a, 1); g.fillRect(50, 24, 40, 6);
      gem(50, 10, 0xd8243a); gem(70, 7, 0x3a8ad6); gem(90, 10, 0x2fa84f); break;
    case 'silver':
      poly([{ x: 50, y: 29 }, { x: 50, y: 12 }, { x: 60, y: 21 }, { x: 70, y: 8 }, { x: 80, y: 21 }, { x: 90, y: 12 }, { x: 90, y: 29 }], 0xdfe4ee, 0x8a93a6);
      g.fillStyle(0x8a93a6, 1); g.fillRect(50, 24, 40, 5);
      gem(70, 15, 0x3a8ad6, 4); break;
    case 'flowers':
      for (let i = 0; i < 9; i++) {
        const a = Math.PI * (1.08 + i * 0.105), x = 70 + 28 * Math.cos(a), y = 46 + 28 * Math.sin(a);
        g.fillStyle(0x2f9e5a, 1); g.fillCircle(x + 3, y + 3, 3.5);
        g.fillStyle([0xff7aa8, 0xffffff, 0xffe27a][i % 3], 1); g.fillCircle(x, y, 4.5);
        g.fillStyle(0xf2a33a, 1); g.fillCircle(x, y, 1.5);
      }
      break;
    case 'diamond':
      poly([{ x: 48, y: 29 }, { x: 54, y: 8 }, { x: 62, y: 20 }, { x: 70, y: 1 }, { x: 78, y: 20 }, { x: 86, y: 8 }, { x: 92, y: 29 }], 0x6fd8ff, 0xffffff);
      poly([{ x: 70, y: 9 }, { x: 76, y: 18 }, { x: 70, y: 27 }, { x: 64, y: 18 }], 0xffffff, 0x3a8ad6); break;
    case 'flame':
      poly([{ x: 50, y: 29 }, { x: 56, y: 6 }, { x: 64, y: 29 }], 0xd8243a);
      poly([{ x: 60, y: 29 }, { x: 70, y: -2 }, { x: 80, y: 29 }], 0xff8a1f);
      poly([{ x: 76, y: 29 }, { x: 84, y: 6 }, { x: 90, y: 29 }], 0xd8243a);
      poly([{ x: 65, y: 29 }, { x: 70, y: 10 }, { x: 75, y: 29 }], 0xffe27a); break;
  }
}
function drawShoesPart(g, sh) {
  const C = Phaser.Display.Color, col = sh.color, dark = C.ValueToColor(col).darken(30).color;
  [50, 90].forEach(x => {
    if (sh.style === 'boots') {
      g.fillStyle(col, 1); g.fillRoundedRect(x - 14, 198, 28, 26, 5); g.fillStyle(dark, 1); g.fillRect(x - 14, 204, 28, 3); g.fillRect(x - 14, 212, 28, 3);
    } else {
      g.fillStyle(col, 1); g.fillEllipse(x, 214, 32, 16);
      g.fillStyle(0xffffff, sh.style === 'crystal' ? 0.7 : 0.25); g.fillEllipse(x - 5, 211, 12, 4);
      if (sh.style === 'bow') { g.fillStyle(0xffffff, 1); g.fillTriangle(x, 208, x - 9, 203, x - 9, 213); g.fillTriangle(x, 208, x + 9, 203, x + 9, 213); g.fillCircle(x, 208, 2.5); }
    }
  });
}
function drawWeaponPart(g, w) {
  const C = Phaser.Display.Color;
  if (w.style === 'sword') {
    if (w.glow) { g.fillStyle(w.glow, 0.25); g.fillRoundedRect(8, 0, 34, 108, 12); }
    g.fillStyle(w.blade, 1); g.fillPoints([{ x: 25, y: 2 }, { x: 33, y: 16 }, { x: 33, y: 100 }, { x: 17, y: 100 }, { x: 17, y: 16 }], true);
    g.fillStyle(C.ValueToColor(w.blade).lighten(35).color, 1); g.fillRect(23, 14, 4, 84);
    g.fillStyle(w.guard, 1); g.fillRoundedRect(6, 100, 38, 9, 3);
    g.fillStyle(0x6a3f1a, 1); g.fillRect(21, 109, 8, 28); g.fillStyle(w.guard, 1); g.fillCircle(25, 141, 6);
  } else if (w.style === 'wand') {
    g.fillStyle(0xb07a3a, 1); g.fillRoundedRect(21, 34, 8, 108, 3);
    g.fillStyle(0xffe27a, 0.3); g.fillCircle(25, 22, 22);
    const pts = []; for (let i = 0; i < 10; i++) { const r = i % 2 ? 7 : 17, a = -Math.PI / 2 + i * Math.PI / 5; pts.push({ x: 25 + r * Math.cos(a), y: 22 + r * Math.sin(a) }); }
    g.fillStyle(0xffd23a, 1); g.fillPoints(pts, true); g.lineStyle(1.5, 0xb8892a, 1); g.strokePoints(pts, true);
  } else { // axe
    g.fillStyle(0x7a4a1f, 1); g.fillRoundedRect(21, 20, 8, 126, 3);
    g.fillStyle(0xb8c0cf, 1); g.fillPoints([{ x: 29, y: 20 }, { x: 48, y: 8 }, { x: 48, y: 66 }, { x: 29, y: 54 }], true);
    g.lineStyle(2, 0x6a7385, 1); g.strokePoints([{ x: 29, y: 20 }, { x: 48, y: 8 }, { x: 48, y: 66 }, { x: 29, y: 54 }], true);
  }
}
function buildPrincessBody(scene) {
  PR.n++;
  const key = 'pr_body_' + PR.n, g = scene.make.graphics({ x: 0, y: 0, add: false });
  drawHairBack(g); drawDressPart(g, eqItem('dress')); drawHead(g); drawJewelPart(g, eqItem('jewel')); drawCrownPart(g, eqItem('crown')); drawShoesPart(g, eqItem('shoes'));
  g.generateTexture(key, 140, 230); g.destroy();
  PR.body = key;
}
let PR = { n: 0, body: null };
function ensureCosmetics(scene) {
  if (!scene.textures.exists('pr_shield')) {
    const poly = [{ x: 4, y: 6 }, { x: 56, y: 6 }, { x: 56, y: 40 }, { x: 30, y: 74 }, { x: 4, y: 40 }];
    let g = scene.make.graphics({ x: 0, y: 0, add: false });
    g.fillStyle(0xffffff, 1); g.fillPoints(poly, true); g.generateTexture('pr_shield', 60, 80); g.destroy();
    g = scene.make.graphics({ x: 0, y: 0, add: false });
    g.lineStyle(5, 0xe8bd3c, 1); g.strokePoints(poly, true); g.generateTexture('pr_shield_rim', 60, 80); g.destroy();
    CAT.weapon.forEach(w => { const wg = scene.make.graphics({ x: 0, y: 0, add: false }); drawWeaponPart(wg, w); wg.generateTexture(weaponKey(w.id), 52, 150); wg.destroy(); });
  }
  if (!PR.body || !scene.textures.exists(PR.body)) buildPrincessBody(scene);
}
// coat-of-arms shield with an emblem
function addCrest(scene, x, y, scale, id) {
  const c = scene.add.container(x, y);
  const base = scene.add.image(0, 0, 'pr_shield'), rim = scene.add.image(0, 0, 'pr_shield_rim'), em = txt(scene, 0, -3, '', 26);
  c.add([base, rim, em]);
  c.setCrest = cid => { const it = itemOf('crest', cid || WARDROBE.eq.crest); base.setTint(it.color); em.setText(it.emoji); return c; };
  c.setCrest(id).setScale(scale);
  return c;
}
// small head-and-shoulders portrait for the top bars
function princessPortrait(scene, x = 40) {
  return scene.add.image(x, 4, PR.body).setOrigin(0.5, 0).setScale(0.4).setCrop(0, 0, 140, 112);
}
// the wardrobe: opens over another scene; spend coins on looks (no effect on attributes)
function openWardrobe(scene) {
  scene.scene.pause();
  scene.scene.launch('Wardrobe', { from: scene.scene.key });
}
class WardrobeScene extends Phaser.Scene {
  constructor() { super('Wardrobe'); }
  init(d) { this.from = d.from; }
  create() {
    ensureCosmetics(this);
    this.slot = 'dress'; this.cards = [];
    this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.75).setInteractive();
    this.add.rectangle(W / 2, H / 2, 900, 570, 0x1b1030, 0.98).setStrokeStyle(4, 0xffd86b);
    txt(this, 540, 46, '👗 ארון התלבושות של הנסיכה', 30, '#ffd86b', { fontStyle: 'bold', stroke: '#000', strokeThickness: 5 });
    this.coinTxt = txt(this, 850, 46, '', 28, '#ffd86b', { fontStyle: 'bold' });
    button(this, 120, 46, 150, 42, '✖ סגור', () => this.close(), 0x8a2f3f).label.setFontSize(20);
    // stage with the live preview
    this.add.rectangle(215, 320, 260, 420, 0x2a1a48).setStrokeStyle(3, 0xffd86b);
    this.add.rectangle(215, 500, 240, 10, 0x000000, 0.3);
    this.body = this.add.image(215, 505, PR.body).setOrigin(0.5, 1).setScale(1.5);
    this.weapon = this.add.image(332, 400, weaponKey()).setScale(1.15);
    this.crest = addCrest(this, 98, 415, 1.15);
    txt(this, 215, 548, 'הלבוש לא משפיע על המאפיינים', 16, '#cdb8e8');
    // tabs
    this.tabs = SLOTS.map(([k, label], i) => {
      const b = button(this, 880 - i * 70, 104, 67, 42, label, () => { this.slot = k; this.render(); }, 0x5a3f8a);
      b.label.setFontSize(15); b.k = k; return b;
    });
    this.add.rectangle(615, 104, 1, 1, 0, 0); // keeps tab row grouped visually
    this.input.keyboard.once('keydown-ESC', () => this.close());
    this.render();
  }
  render() {
    this.cards.forEach(o => o.destroy()); this.cards = [];
    hset(this.coinTxt, `🪙 ${STATS.coins}`);
    this.tabs.forEach(b => b.bg.setFillStyle(b.k === this.slot ? 0xe08a2a : 0x5a3f8a));
    const items = CAT[this.slot];
    items.forEach((it, i) => {
      const x = 770 - (i % 3) * 165 + 55, y = 226 + Math.floor(i / 3) * 134;
      const owned = WARDROBE.owned[this.slot].includes(it.id), on = WARDROBE.eq[this.slot] === it.id;
      const bg = this.add.rectangle(x - 55, y, 156, 128, on ? 0x1f5a37 : 0x2a1a48).setStrokeStyle(3, on ? 0x7dff9a : owned ? 0x5aa0d6 : 0x77607f)
        .setInteractive({ useHandCursor: true }).on('pointerdown', () => this.pick(it));
      const cx = x - 55, cy = y - 22;
      this.cards.push(bg);
      let preview;
      if (this.slot === 'weapon') preview = this.add.image(cx, cy, weaponKey(it.id)).setScale(0.52);
      else if (this.slot === 'crest') preview = addCrest(this, cx, cy, 0.9, it.id);
      else {
        preview = this.add.graphics();
        if (this.slot === 'dress') { drawDressPart(preview, it); preview.setScale(0.5).setPosition(cx - 35, cy - 70); }
        else if (this.slot === 'crown') { drawHairBack(preview); drawHead(preview); drawCrownPart(preview, it); preview.setScale(0.95).setPosition(cx - 66, cy - 40); }
        else if (this.slot === 'shoes') { drawShoesPart(preview, it); preview.setScale(1.1).setPosition(cx - 77, cy - 235); }
        else if (this.slot === 'hair') { drawHairBack(preview, it.color); drawHead(preview, it.color); preview.setScale(0.95).setPosition(cx - 66, cy - 40); }
        else if (this.slot === 'style') { drawHairBack(preview, hairColor(), it.style); drawHead(preview, hairColor(), it.style); preview.setScale(0.85).setPosition(cx - 60, cy - 36); }
        else { // jewellery: head and shoulders wearing the set
          drawHairBack(preview); preview.fillStyle(eqItem('dress').color, 1); preview.fillRoundedRect(44, 68, 52, 40, 9);
          drawHead(preview); drawJewelPart(preview, it); preview.setScale(0.95).setPosition(cx - 66, cy - 52);
        }
      }
      this.cards.push(preview);
      this.cards.push(txt(this, cx, y + 26, it.name, 17, '#fff', { fontStyle: 'bold' }));
      this.cards.push(txt(this, cx, y + 49, on ? '✔ לבושה' : owned ? 'ברשותך — לחצי' : `🪙 ${it.price}`, 16,
        on ? '#7dff9a' : owned ? '#9fd3ff' : STATS.coins >= it.price ? '#ffd86b' : '#ff9a9a'));
    });
  }
  pick(it) {
    const slot = this.slot;
    if (!WARDROBE.owned[slot].includes(it.id)) {
      if (STATS.coins < it.price) { SND.sfx('wrong'); this.cameras.main.shake(100, 0.004); return; }
      STATS.coins -= it.price; WARDROBE.owned[slot].push(it.id); SND.sfx('coin');
    } else SND.sfx('correct');
    WARDROBE.eq[slot] = it.id; saveWardrobe();
    if (slot !== 'weapon' && slot !== 'crest') { buildPrincessBody(this); this.body.setTexture(PR.body); }
    if (slot === 'weapon') this.weapon.setTexture(weaponKey());
    if (slot === 'crest') this.crest.setCrest();
    this.tweens.add({ targets: this.body, scale: 1.58, duration: 120, yoyo: true });
    this.render();
  }
  close() {
    this.scene.stop();
    this.scene.resume(this.from);
    const sc = this.scene.get(this.from);
    if (sc.onWardrobeClosed) sc.onWardrobeClosed();
  }
}

// princess attributes, kept across levels (reset when a new game starts)
const newStats = () => ({ correct: 0, crits: 0, bestStreak: 0, coins: 0,
  powBonus: 0, timeBonus: 0, spdBonus: 0, potions: { heal: 0, pow: 0, wis: 0, spd: 0 } });
let STATS = newStats();
const strength = () => 1 + Math.floor(STATS.correct / 25) + STATS.powBonus; // bonus damage as she learns + potions
const turnTime = () => 15000 + 3000 * STATS.timeBonus;                       // wisdom potions give more time
const quickWindow = () => Math.min(0.8, 0.4 + 0.1 * STATS.spdBonus);          // speed potions widen the critical window
const POTIONS = {
  heal: { icon: '🧪', color: 0xd63a5a, name: 'שיקוי חיים', desc: '+2 ❤️ מיד', cost: 4 },
  pow:  { icon: '⚗️', color: 0xe08a2a, name: 'שיקוי כוח', desc: '+1 כוח לצמיתות', cost: 12 },
  wis:  { icon: '🔮', color: 0x3a8ad6, name: 'שיקוי חוכמה', desc: '+3 שניות לכל תור', cost: 8 },
  spd:  { icon: '🍯', color: 0xc9a21a, name: 'שיקוי מהירות', desc: 'חלון קריטי גדול יותר', cost: 8 },
};

// ---------- save / load: three slots in browser storage ----------
const SLOT_COUNT = 3;
let CUR_SLOT = null;                       // the slot the current game auto-saves into
const slotKey = i => 'pq-save-' + i;
(function migrateOldSave() {               // the single save from the earlier version becomes slot 1
  try {
    const old = localStorage.getItem('pq-save');
    if (old && !localStorage.getItem(slotKey(1))) localStorage.setItem(slotKey(1), old);
    if (old) localStorage.removeItem('pq-save');
  } catch (e) {}
})();
function readSlot(i) {
  try {
    const sv = JSON.parse(localStorage.getItem(slotKey(i)) || 'null');
    if (sv && sv.v === 1 && sv.level >= 1 && sv.level <= 10 && sv.stats) return sv;
  } catch (e) {}
  return null;
}
function writeSlot(i, level, hearts, map) {
  try {
    localStorage.setItem(slotKey(i), JSON.stringify({ v: 1, level, hearts, stats: STATS, map: map || null, t: Date.now() }));
    return true;
  } catch (e) { return false; }
}
function clearSlot(i) { try { localStorage.removeItem(slotKey(i)); } catch (e) {} }
const anySave = () => [1, 2, 3].some(i => readSlot(i));
const firstEmptySlot = () => [1, 2, 3].find(i => !readSlot(i)) || null;
// auto-save: goes to the slot of the current game
function writeSave(level, hearts, map) {
  if (!CUR_SLOT) CUR_SLOT = firstEmptySlot() || 1;
  return writeSlot(CUR_SLOT, level, hearts, map);
}
// restores a slot and returns the data the Map scene needs to continue it
function loadSlot(i) {
  const sv = readSlot(i);
  if (!sv) return null;
  const base = newStats();
  STATS = Object.assign(base, sv.stats, { potions: Object.assign(base.potions, sv.stats.potions || {}) });
  MAP = sv.map && sv.map.level === sv.level ? sv.map : null;
  CUR_SLOT = i;
  return { level: sv.level, hearts: Math.min(MAX_HEARTS, sv.hearts), fresh: !MAP };
}
function saveToast(scene, ok, msg, x = W / 2, y = 500) {
  SND.sfx(ok ? 'coin' : 'wrong');
  const t = txt(scene, x, y, ok ? (msg || '💾 המשחק נשמר!') : '❌ לא ניתן לשמור בדפדפן הזה', 26, ok ? '#7dff9a' : '#ff7a7a',
    { fontStyle: 'bold', stroke: '#000', strokeThickness: 5 }).setDepth(300);
  scene.tweens.add({ targets: t, y: y - 40, alpha: 0, delay: 700, duration: 800, onComplete: () => t.destroy() });
}
// new game: use the first empty slot, or let the player choose which one to overwrite
function startNewGame(scene) {
  const e = firstEmptySlot();
  if (e) { beginNewGame(scene, e); } else openSlots(scene, 'new');
}
function beginNewGame(scene, slot) {
  CUR_SLOT = slot; STATS = newStats(); MAP = null;
  scene.scene.start('Map', { level: 1, hearts: START_HEARTS, fresh: true });
}
function openSlots(scene, mode, payload) {
  scene.scene.pause();
  scene.scene.launch('Slots', { from: scene.scene.key, mode, payload });
}
class SlotsScene extends Phaser.Scene {
  constructor() { super('Slots'); }
  init(d) { this.from = d.from; this.mode = d.mode; this.payload = d.payload; }
  create() {
    this.pending = null; this.objs = []; this.done = false;
    this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.75).setInteractive().on('pointerdown', () => { this.pending = null; this.render(); });
    this.add.rectangle(W / 2, 312, 800, 490, 0x1b1030, 0.98).setStrokeStyle(4, 0xffd86b);
    const title = { load: '📂 טעינת משחק', save: '💾 שמירת משחק', new: '⚔ משחק חדש — בחרי מקום' }[this.mode];
    txt(this, W / 2, 108, title, 38, '#ffd86b', { fontStyle: 'bold', stroke: '#000', strokeThickness: 6 });
    this.info = txt(this, W / 2, 470, '', 22, '#ffd86b', { fontStyle: 'bold' });
    button(this, W / 2, 520, 220, 46, 'חזרה', () => this.close(), 0x8a2f3f).label.setFontSize(22);
    this.input.keyboard.once('keydown-ESC', () => this.close());
    this.render();
  }
  render() {
    this.objs.forEach(o => o.destroy()); this.objs = [];
    const hint = { load: 'בחרי משחק שמור להמשיך', save: 'בחרי מקום לשמירה', new: 'כל המקומות תפוסים — בחרי שמירה שתידרס' }[this.mode];
    hset(this.info, this.pending ? (this.pending.type === 'delete' ? 'לחצי שוב על 🗑 כדי למחוק' : 'לחצי שוב כדי לדרוס את השמירה') : hint);
    this.info.setColor(this.pending ? '#ff9a9a' : '#cdb8e8');
    for (let i = 1; i <= SLOT_COUNT; i++) {
      const x = W / 2 + (i - 2) * 250, y = 290, sv = readSlot(i);
      const cur = CUR_SLOT === i && this.mode !== 'new';
      const live = this.mode !== 'load' || !!sv;
      const bg = this.add.rectangle(x, y, 225, 230, sv ? 0x2a1a48 : 0x1f1630).setStrokeStyle(4, cur ? 0x7dff9a : sv ? 0xffd86b : 0x55456e)
        .setAlpha(live ? 1 : 0.5);
      if (live) bg.setInteractive({ useHandCursor: true }).on('pointerdown', () => this.pick(i));
      this.objs.push(bg);
      this.objs.push(txt(this, x, y - 90, `מקום ${i}`, 24, '#ffd86b', { fontStyle: 'bold' }));
      if (sv) {
        const when = new Date(sv.t).toLocaleString('he-IL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
        this.objs.push(txt(this, x, y - 48, `שלב ${sv.level} מתוך 10`, 24, '#fff', { fontStyle: 'bold' }));
        this.objs.push(txt(this, x, y - 12, `❤️ ${sv.hearts}    🪙 ${sv.stats.coins || 0}`, 20, '#ffe9a8'));
        this.objs.push(txt(this, x, y + 20, `⚔️ כוח ${1 + Math.floor((sv.stats.correct || 0) / 25) + (sv.stats.powBonus || 0)}`, 18, '#ffb36b'));
        this.objs.push(txt(this, x, y + 46, when, 16, '#cdb8e8'));
        if (cur) this.objs.push(txt(this, x, y + 70, '★ המשחק הנוכחי', 16, '#7dff9a'));
        const del = button(this, x + 88, y - 92, 40, 36, '🗑', () => this.del(i), 0x8a2f3f);
        del.label.setFontSize(20);
        this.objs.push(del);
      } else {
        this.objs.push(txt(this, x, y - 8, 'ריק', 30, '#8a7a9a'));
        if (live) this.objs.push(txt(this, x, y + 36, this.mode === 'new' ? 'התחלה כאן' : 'שמרי כאן', 18, '#9fd3ff'));
      }
    }
  }
  pick(i) {
    const sv = readSlot(i);
    if (this.mode === 'load') {
      const d = loadSlot(i);
      if (d) this.go(() => { this.scene.stop(this.from); this.scene.start('Map', d); });
      return;
    }
    if (sv && !(this.pending && this.pending.type === 'overwrite' && this.pending.i === i)) {
      this.pending = { type: 'overwrite', i }; SND.sfx('click'); this.render(); return;
    }
    if (this.mode === 'new') { this.go(() => { this.scene.stop(this.from); beginNewGame(this, i); }); return; }
    const pl = this.payload, ok = writeSlot(i, pl.level, pl.hearts, pl.map);
    if (ok) CUR_SLOT = i;
    saveToast(this, ok, `💾 נשמר במקום ${i}!`, W / 2, 440);
    this.pending = null; this.render();
    if (ok) this.time.delayedCall(900, () => this.close());
  }
  del(i) {
    if (!(this.pending && this.pending.type === 'delete' && this.pending.i === i)) { this.pending = { type: 'delete', i }; SND.sfx('click'); this.render(); return; }
    clearSlot(i); if (CUR_SLOT === i) CUR_SLOT = null;
    this.pending = null; SND.sfx('wrong'); this.render();
  }
  go(fn) { if (this.done) return; this.done = true; fn(); }
  close() {
    if (this.done) return; this.done = true;
    this.scene.stop(); this.scene.resume(this.from);
    const sc = this.scene.get(this.from);
    if (sc.onSlotsClosed) sc.onSlotsClosed();
  }
}

// ---------- Title ----------
class TitleScene extends Phaser.Scene {
  constructor() { super('Title'); }
  create() {
    drawCastleBg(this, [0x2b1650, 0x6a3a8c]);
    SND.music('menu'); addSoundToggle(this);
    txt(this, W / 2, 120, 'הנסיכה הלוחמת', 64, '#ffd86b', { fontStyle: 'bold', stroke: '#3a1a00', strokeThickness: 8 });
    txt(this, W / 2, 190, 'הרפתקת חשבון וקסמים', 28, '#f6e9ff');
    ensureCosmetics(this);
    STATS = newStats();
    const p = this.add.image(250, 478, PR.body).setOrigin(0.5, 1).setScale(0.82);
    this.tWeapon = this.add.image(318, 395, weaponKey()).setScale(0.62);
    this.tCrest = addCrest(this, 190, 400, 0.7);
    button(this, 150, 548, 230, 46, '👗 תלבושות', () => openWardrobe(this), 0x8a4fd6).label.setFontSize(22);
    this.tPrincess = p;
    if (anySave()) {
      this.loadBtn = button(this, 795, 548, 270, 46, '📂 טעינת משחק', () => openSlots(this, 'load'), 0x2a7ac0);
      this.loadBtn.label.setFontSize(20);
    }
    const bugs = ['🐜', '🪲', '🕷️', '🐞'];
    bugs.forEach((b, i) => {
      const s = txt(this, 600 + i * 80, 340 + (i % 2) * 40, b, 56);
      this.tweens.add({ targets: s, y: s.y - 15, yoyo: true, repeat: -1, duration: 600 + i * 120 });
    });
    this.tweens.add({ targets: p, angle: 3, yoyo: true, repeat: -1, duration: 900 });
    txt(this, W / 2, 262, 'חרקים פלשו לטירה!\nבלי קוביות — פותרים תרגילי חשבון כדי להניף את החרב.', 24, '#fff');
    const b = button(this, W / 2, 500, 280, 70, '⚔ יוצאים לדרך', () => startNewGame(this), 0x2fa84f);
    this.tweens.add({ targets: b, scaleX: 1.06, scaleY: 1.06, yoyo: true, repeat: -1, duration: 700 });
    this.input.keyboard.once('keydown-ENTER', () => startNewGame(this));
    txt(this, W / 2, 570, 'לחצו על תשובה או הקישו 1-4', 18, '#cdb8e8');
  }
  onSlotsClosed() {}
  onWardrobeClosed() {
    this.tPrincess.setTexture(PR.body); this.tWeapon.setTexture(weaponKey()); this.tCrest.setCrest();
  }
}

// ---------- Battle ----------
const MAX_HEARTS = 10;   // the most hearts she can ever hold
const START_HEARTS = 5;  // hearts at the start of a game or a retry
class BattleScene extends Phaser.Scene {
  constructor() { super('Battle'); }
  init(d) {
    this.level = d.level; this.startHearts = d.hearts; this.room = d.room; this.roomIdx = d.roomIdx;
    const L = LEVELS[d.level - 1];
    // the room with the key is guarded by the level's main bug; other rooms hold smaller minions
    this.E = d.room.kind === 'guard'
      ? { bug: L.bug, name: L.name, hp: L.miniBoss ? Math.round(L.hp * 1.4) : L.hp, boss: !!L.boss || !!L.miniBoss,
          specials: L.miniBoss ? ['storm', 'fog', 'drain', 'shield'] : null }
      : { bug: d.room.bug, name: 'חרק שומר', hp: Math.max(2, Math.ceil(L.hp * 0.6)), boss: false };
  }
  create() {
    const L = LEVELS[this.level - 1];
    this.L = L;
    this.hearts = this.startHearts;
    const E = this.E;
    this.bugHp = this.bugMax = E.hp;
    this.streak = 0;
    this.turnNo = 0; this.special = null; this.fog = false; this.shieldUp = false; this.limit = turnTime(); // scenes are reused, so reset
    this.locked = false;
    const tints = [[0x3a2a1a, 0x7a5a3a], [0x3a2a2a, 0x6a4a3a], [0x2a2040, 0x5a4a80], [0x1a2a40, 0x3a5a80], [0x1a3a2a, 0x3a7a5a],
                   [0x15101f, 0x2a2438], [0x30204a, 0x7a4a8a], [0x3a1a3a, 0x8a4a6a], [0x3a3010, 0x8a7020], [0x3a0a20, 0x9a1a4a]];
    drawCastleBg(this, tints[this.level - 1]);
    SND.music(E.boss ? 'boss' : 'battle'); addSoundToggle(this);

    // HUD: princess attributes bar on top
    this.add.rectangle(W / 2, 26, W, 52, 0x0d0820, 0.85);
    this.add.rectangle(W / 2, 52, W, 3, 0xffd86b, 0.9);
    ensureCosmetics(this); princessPortrait(this);
    txt(this, 118, 26, 'הנסיכה', 22, '#ffd86b', { fontStyle: 'bold' });
    this.heartTxt = txt(this, 250, 26, '', 22, '#ff7a8a', { fontStyle: 'bold' });
    this.strTxt = txt(this, 405, 26, '', 22, '#ffb36b');
    this.intTxt = txt(this, 525, 26, '', 22, '#7fd6ff');
    this.dexTxt = txt(this, 645, 26, '', 22, '#ffe46b');
    this.streakTxt = txt(this, 765, 26, '', 22, '#ff9a4a');
    this.coinTxt = txt(this, 890, 26, '', 22, '#ffd86b');
    txt(this, W / 2, 76, `שלב ${this.level} מתוך 10 — ${this.room.name}`, 22, '#ffd86b', { fontStyle: 'bold' });
    this.refreshHud();

    // Characters
    this.princess = this.add.image(190, 474, PR.body).setOrigin(0.5, 1).setScale(0.85);
    this.sword = this.add.image(268, 392, weaponKey()).setScale(0.62);
    this.crestObj = addCrest(this, 120, 398, 0.72);
    this.bug = txt(this, 740, 355, E.bug, E.boss ? 170 : 130);
    this.tweens.add({ targets: this.bug, y: this.bug.y - 12, yoyo: true, repeat: -1, duration: 700, ease: 'Sine.inOut' });
    this.tweens.add({ targets: [this.princess, this.crestObj], y: '-=6', yoyo: true, repeat: -1, duration: 900, ease: 'Sine.inOut' });
    this.shieldIcon = txt(this, 740, 355, '🛡️', E.boss ? 190 : 150).setAlpha(0.45).setVisible(false);
    txt(this, 740, 455, E.name, 26, E.boss ? '#ff6b9a' : '#ffffff', { fontStyle: 'bold' });
    // bug HP bar
    this.add.rectangle(740, 488, 240, 20, 0x000000, 0.6).setStrokeStyle(2, 0xffffff);
    this.hpBar = this.add.rectangle(620, 488, 240, 14, 0xe23c3c).setOrigin(0, 0.5);
    this.hpTxt = txt(this, 740, 488, `${this.bugHp} / ${this.bugMax}`, 14, '#ffffff', { fontStyle: 'bold', stroke: '#000', strokeThickness: 3 });

    // Puzzle panel
    this.add.rectangle(W / 2, 175, 460, 120, 0x120a1f, 0.85).setStrokeStyle(4, 0xffd86b);
    txt(this, W / 2, 130, '🎲 הקובייה של המוח', 18, '#ffd86b');
    this.qTxt = txt(this, W / 2, 175, '', 54, '#fff', { fontStyle: 'bold' });
    this.msg = txt(this, W / 2, 262, '', 22, '#cdb8e8', { stroke: '#000', strokeThickness: 5 }); hset(this.msg, L.tip);

    // timer bar
    this.add.rectangle(W / 2, 100, 460, 14, 0x000000, 0.6).setStrokeStyle(2, 0xffffff);
    this.timerBar = this.add.rectangle(W / 2 - 230, 100, 460, 10, 0x4ad2ff).setOrigin(0, 0.5);

    // answer buttons
    this.btns = [];
    for (let i = 0; i < 4; i++) {
      const bt = button(this, 150 + i * 220, 545, 190, 62, '', () => this.answer(i));
      this.btns.push(bt);
    }
    this.input.keyboard.on('keydown', e => {
      const n = parseInt(e.key, 10);
      if (n >= 1 && n <= 4) this.answer(n - 1);
    });

    this.intro();
  }
  intro() {
    this.locked = true;
    SND.sfx('appear');
    const banner = txt(this, W / 2, 300, `${this.E.name} מופיע/ה!`, 44, '#ffd86b', { fontStyle: 'bold', stroke: '#000', strokeThickness: 7 });
    banner.setScale(0.2);
    this.tweens.add({ targets: banner, scale: 1, duration: 400, ease: 'Back.out' });
    this.bug.setScale(0.1);
    this.tweens.add({ targets: this.bug, scale: 1, duration: 500, ease: 'Back.out' });
    this.time.delayedCall(1400, () => { banner.destroy(); this.nextPuzzle(); });
  }
  refreshHud() {
    this.heartTxt.setText(`❤️ ${this.hearts}`);
    hset(this.strTxt, `⚔️ כוח ${strength()}`);
    hset(this.intTxt, `🧠 חוכמה ${STATS.correct}`);
    hset(this.dexTxt, `⚡ מהירות ${STATS.crits}`);
    hset(this.streakTxt, `🔥 רצף ${this.streak}`);
    hset(this.coinTxt, `🪙 ${STATS.coins}`);
  }
  // notify that an attribute changed: pulse the stat in the top bar and float a "+1" under it
  statPop(target, label, color = '#7dff9a') {
    this.tweens.add({ targets: target, scale: 1.5, duration: 150, yoyo: true, ease: 'Sine.out' });
    const t = txt(this, target.x, 62, label, 26, color, { fontStyle: 'bold', stroke: '#000', strokeThickness: 5 }).setDepth(50);
    this.tweens.add({ targets: t, y: 110, alpha: 0, duration: 1300, ease: 'Sine.in', onComplete: () => t.destroy() });
  }
  // ----- boss special attacks: every 3rd puzzle the boss telegraphs one that changes the rules of that turn -----
  applySpecial() {
    this.special = null; this.fog = false;
    this.limit = turnTime();
    const E = this.E;
    if (!E.specials || this.turnNo % 3 !== 0) return;
    const kind = Phaser.Math.RND.pick(E.specials.filter(k => !(k === 'shield' && this.shieldUp)));
    this.special = kind;
    const INFO = {
      storm:  ['🌪️', 'סערת זמזום!', 'הזמן מתקצר בחצי!'],
      fog:    ['🌫️', 'ענן אבק!', 'התשובות מוסתרות לרגע...'],
      drain:  ['🩸', 'מציצת דם!', 'טעות כואבת יותר והחרק מתרפא!'],
      shield: ['🛡️', 'מגן כיטין!', 'התשובה הנכונה הבאה רק שוברת אותו.'],
    }[kind];
    SND.sfx('bossattack');
    this.cameras.main.shake(180, 0.006);
    this.tweens.add({ targets: this.bug, scale: 1.25, duration: 160, yoyo: true });
    hset(this.msg, `⚠️ ${INFO[0]} ${INFO[1]} ${INFO[2]}`).setColor('#ffb347');
    const ban = txt(this, W / 2, 335, `${INFO[0]} ${INFO[1]}`, 42, '#ff9a4a', { fontStyle: 'bold', stroke: '#000', strokeThickness: 7 }).setDepth(60).setScale(0.4);
    this.tweens.add({ targets: ban, scale: 1, duration: 300, ease: 'Back.out' });
    this.tweens.add({ targets: ban, alpha: 0, y: 300, delay: 1100, duration: 500, onComplete: () => ban.destroy() });
    if (kind === 'storm') this.limit = turnTime() / 2;
    if (kind === 'shield') { this.shieldUp = true; this.shieldIcon.setVisible(true); }
    if (kind === 'fog') {
      this.fog = true;
      this.btns.forEach(b => b.label.setText('❓'));
      this.time.delayedCall(2500, () => {
        if (!this.fog) return;
        this.fog = false;
        this.btns.forEach((b, i) => b.label.setText(`${i + 1}:  ${this.puzzle.choices[i]}`));
      });
    }
  }
  nextPuzzle() {
    this.turnNo = (this.turnNo || 0) + 1;
    this.puzzle = makePuzzle(this.level);
    this.qTxt.setText(this.puzzle.q.includes('=') ? this.puzzle.q : this.puzzle.q + ' = ?');
    hset(this.msg, 'בחרו את התשובה הנכונה כדי לתקוף!').setColor('#cdb8e8');
    this.btns.forEach((b, i) => {
      b.label.setText(`${i + 1}:  ${this.puzzle.choices[i]}`);
      b.bg.setFillStyle(0x7b3fe4).setInteractive();
    });
    this.turnStart = this.time.now;
    this.applySpecial();
    this.locked = false;
  }
  update(time) {
    if (this.locked || this.turnStart === undefined) return;
    const left = Math.max(0, 1 - (time - this.turnStart) / (this.limit || turnTime()));
    this.timerBar.width = 460 * left;
    this.timerBar.setFillStyle(left > 0.5 ? 0x4ad2ff : left > 0.25 ? 0xffc107 : 0xe23c3c);
    if (left <= 0) this.answer(-1);
  }
  answer(i) {
    if (this.locked) return;
    if (this.fog && i >= 0) return; // can't pick what you can't see
    this.locked = true; this.fog = false;
    const correct = i >= 0 && this.puzzle.choices[i] === this.puzzle.ans;
    const quick = (this.time.now - this.turnStart) < (this.limit || turnTime()) * quickWindow();
    if (i >= 0) this.btns[i].bg.setFillStyle(correct ? 0x2fa84f : 0xc0392b);
    const ci = this.puzzle.choices.indexOf(this.puzzle.ans);
    this.btns[ci].bg.setFillStyle(0x2fa84f);
    SND.sfx(correct ? 'correct' : 'wrong');
    if (correct) this.hitBug(quick); else this.hitPrincess(i < 0);
  }
  hitBug(quick) {
    const prevStr = strength(), prevStreak = this.streak;
    this.streak++;
    STATS.correct++;
    if (quick) STATS.crits++;
    STATS.bestStreak = Math.max(STATS.bestStreak, this.streak);
    let dmg = strength();
    let label = 'פגיעה!';
    if (quick) { dmg += 1; label = '⚡ מכה קריטית!'; }
    if (this.streak >= 3) { dmg += 1; label = '🔥 קומבו!'; }
    label += ' -' + dmg;
    if (this.shieldUp) { dmg = 0; label = '🛡️ המגן נשבר!'; this.shieldUp = false; this.shieldIcon.setVisible(false); }
    this.refreshHud();
    this.statPop(this.intTxt, '+1 🧠', '#7fd6ff');
    if (quick) this.statPop(this.dexTxt, '+1 ⚡', '#ffe46b');
    if (this.streak > prevStreak && this.streak >= 2) this.statPop(this.streakTxt, '+1 🔥', '#ff9a4a');
    if (strength() > prevStr) {
      this.statPop(this.strTxt, '+1 ⚔️', '#ffb36b'); SND.sfx('levelup');
      const up = txt(this, W / 2, 330, `⚔️ הכוח עלה ל-${strength()}!`, 40, '#ffd86b', { fontStyle: 'bold', stroke: '#000', strokeThickness: 7 }).setDepth(60).setScale(0.3);
      this.tweens.add({ targets: up, scale: 1, duration: 350, ease: 'Back.out' });
      this.tweens.add({ targets: up, alpha: 0, y: 290, delay: 1300, duration: 600, onComplete: () => up.destroy() });
    }
    hset(this.msg, 'נכון! הנסיכה תוקפת!').setColor('#7dff9a');
    // sword swing
    SND.sfx('slash');
    this.tweens.add({ targets: this.sword, x: 650, angle: 360, duration: 280, ease: 'Cubic.in',
      onComplete: () => {
        SND.sfx(quick ? 'crit' : 'bughit');
        this.cameras.main.shake(150, 0.008);
        this.tweens.add({ targets: this.bug, x: this.bug.x + 25, duration: 60, yoyo: true, repeat: 2 });
        this.bug.setTint?.(0xff0000);
        this.floatText(740, 300, label, quick ? '#ffd86b' : '#ffffff');
        this.sparkle(740, 350);
        this.bugHp = Math.max(0, this.bugHp - dmg);
        this.hpTxt.setText(`${this.bugHp} / ${this.bugMax}`);
        this.tweens.add({ targets: this.hpBar, width: 240 * this.bugHp / this.bugMax, duration: 250 });
        this.tweens.add({ targets: this.sword, x: 268, angle: 0, duration: 300, delay: 100 });
        this.time.delayedCall(800, () => this.bugHp <= 0 ? this.win() : this.nextPuzzle());
      } });
  }
  hitPrincess(timeout) {
    this.streak0 = this.streak;
    this.streak = 0;
    const drain = this.special === 'drain';
    const dmg = (this.E.boss ? 2 : 1) + (drain ? 1 : 0);
    hset(this.msg, timeout ? 'איטי מדי! החרק תוקף!' : 'טעות! החרק תוקף!').setColor('#ff7a7a');
    this.tweens.add({ targets: this.bug, x: 330, duration: 260, ease: 'Cubic.in', yoyo: true,
      onYoyo: () => {
        this.cameras.main.shake(200, 0.012);
        SND.sfx('hurt');
        this.cameras.main.flash(150, 255, 0, 0);
        this.floatText(190, 290, `-${dmg} ❤️`, '#ff7a7a');
        this.hearts = Math.max(0, this.hearts - dmg);
        this.refreshHud();
        if (drain) {
          this.bugHp = Math.min(this.bugMax, this.bugHp + 4);
          this.hpTxt.setText(`${this.bugHp} / ${this.bugMax}`);
          this.tweens.add({ targets: this.hpBar, width: 240 * this.bugHp / this.bugMax, duration: 300 });
          this.floatText(740, 300, '+4 🩸', '#ff6b9a');
        }
        this.statPop(this.heartTxt, `-${dmg} ❤️`, '#ff7a7a');
        if (this.streak0 >= 2) this.statPop(this.streakTxt, 'הרצף אופס', '#ff7a7a');
      },
      onComplete: () => {
        this.time.delayedCall(500, () => this.hearts <= 0 ? this.lose() : this.nextPuzzle());
      } });
  }
  floatText(x, y, s, color) {
    const t = txt(this, x, y, s, 38, color, { fontStyle: 'bold', stroke: '#000', strokeThickness: 6 });
    this.tweens.add({ targets: t, y: y - 70, alpha: 0, duration: 1000, onComplete: () => t.destroy() });
  }
  sparkle(x, y) {
    for (let i = 0; i < 10; i++) {
      const s = txt(this, x, y, Phaser.Math.RND.pick(['✨', '⭐', '💥']), 28);
      this.tweens.add({ targets: s, x: x + ri(-90, 90), y: y + ri(-90, 60), alpha: 0, duration: 700, onComplete: () => s.destroy() });
    }
  }
  win() {
    this.locked = true;
    this.timerBar.width = 0;
    this.tweens.killTweensOf(this.bug);
    SND.sfx('bugdie');
    this.tweens.add({ targets: this.bug, angle: 540, scale: 0, alpha: 0, duration: 700 });
    hset(this.msg, 'החרק הובס! 🎉').setColor('#ffd86b');
    this.time.delayedCall(1100, () => {
      this.scene.start('Map', { level: this.level, hearts: this.hearts, roomIdx: this.roomIdx, won: true });
    });
  }
  lose() {
    this.locked = true;
    SND.stopMusic(); SND.sfx('lose');
    this.tweens.add({ targets: this.princess, angle: 90, duration: 500 });
    this.time.delayedCall(1000, () => this.scene.start('End', { won: false, level: this.level }));
  }
}

// ---------- Between levels ----------
// ---------- level map: choose which room to enter; one of them holds the key ----------
const ROOM_NAMES = ['חדר הנרות', 'המסדרון המזרחי', 'חדר התפירה', 'חדר הכלים', 'המרתף הקטן', 'חדר הנשק',
  'האולם הקטן', 'חדר השעונים', 'חדר המראות', 'הגג', 'חדר הפרחים', 'חדר הכביסה'];
let MAP = null;
function newMap(level) {
  const n = level <= 3 ? 3 : level <= 7 ? 4 : 5;     // at least 3 rooms on every level
  const keyIdx = ri(0, n - 1);
  const names = Phaser.Math.RND.shuffle([...ROOM_NAMES]).slice(0, n);
  const mainBug = LEVELS[level - 1].bug;
  const rooms = names.map((name, i) => {
    let kind = 'guard';                              // the key room is guarded by the level's bug
    if (i !== keyIdx) { const r = Math.random(); kind = r < 0.55 ? 'fight' : r < 0.85 ? 'treasure' : 'trap'; }
    return { name, kind, bug: Phaser.Math.RND.pick(LEVELS.map(x => x.bug).filter(b => b !== mainBug)), visited: false, icon: '❓' };
  });
  return { level, rooms, hasKey: false };
}
function rollDrops(n, level) {
  const out = [];
  for (let i = 0; i < n; i++) {
    if (Math.random() < 0.55) { const c = ri(2, 4) + level; STATS.coins += c; out.push({ coins: c }); }
    else { const k = Phaser.Math.RND.pick(['heal', 'heal', 'pow', 'wis', 'spd']); STATS.potions[k]++; out.push({ potion: k }); }
  }
  return out;
}

class MapScene extends Phaser.Scene {
  constructor() { super('Map'); }
  init(d) { this.d = d; }
  create() {
    const d = this.d, L = LEVELS[d.level - 1];
    if (d.fresh || !MAP || MAP.level !== d.level) MAP = newMap(d.level);
    this.hearts = d.hearts;
    this.busy = false;
    const tints = [[0x3a2a1a, 0x7a5a3a], [0x3a2a2a, 0x6a4a3a], [0x2a2040, 0x5a4a80], [0x1a2a40, 0x3a5a80], [0x1a3a2a, 0x3a7a5a],
                   [0x15101f, 0x2a2438], [0x30204a, 0x7a4a8a], [0x3a1a3a, 0x8a4a6a], [0x3a3010, 0x8a7020], [0x3a0a20, 0x9a1a4a]];
    const g = drawCastleBg(this, tints[d.level - 1]);
    g.fillStyle(0x000000, 0.45); g.fillRect(0, 52, W, H - 52); // dim the decorations behind the map
    SND.music('menu'); addSoundToggle(this);

    // top bar
    this.add.rectangle(W / 2, 26, W, 52, 0x0d0820, 0.9);
    this.add.rectangle(W / 2, 52, W, 3, 0xffd86b, 0.9);
    ensureCosmetics(this); this.portrait = princessPortrait(this);
    txt(this, 118, 26, 'הנסיכה', 22, '#ffd86b', { fontStyle: 'bold' });
    this.heartTxt = txt(this, 290, 26, '', 22, '#ff7a8a', { fontStyle: 'bold' });
    this.coinTxt = txt(this, 430, 26, '', 22, '#ffd86b', { fontStyle: 'bold' });
    this.potTxt = txt(this, 570, 26, '', 22, '#7fd6ff', { fontStyle: 'bold' });
    this.keyTxt = txt(this, 760, 26, '', 24, '#ffffff', { fontStyle: 'bold' });
    txt(this, W / 2, 84, `שלב ${d.level} מתוך 10 — ${L.room}`, 28, '#ffd86b', { fontStyle: 'bold' });

    // layout: rooms in a row, corridors down to the entrance hall
    const rooms = MAP.rooms, n = rooms.length;
    const xs = rooms.map((_, i) => W / 2 + (i - (n - 1) / 2) * (n === 3 ? 270 : n === 4 ? 215 : 180));
    const cw = n === 5 ? 160 : 190, ch = 130, ry = 205, hallY = 400;
    const cg = this.add.graphics();
    cg.lineStyle(10, 0x55456e, 1);
    xs.forEach(x => { cg.lineBetween(x, ry + ch / 2, x, 335); });
    cg.lineBetween(xs[0], 335, xs[n - 1], 335);
    cg.lineBetween(W / 2, 335, W / 2, hallY - 40);
    this.add.rectangle(W / 2, hallY, 260, 80, 0x2e2346).setStrokeStyle(4, 0xffd86b);
    txt(this, W / 2, hallY + 22, '🏰 אולם הכניסה', 20, '#ffd86b');
    this.princess = this.add.image(W / 2, hallY - 8, PR.body).setScale(0.32).setDepth(20);

    this.cards = rooms.map((room, i) => {
      const x = xs[i];
      const bg = this.add.rectangle(x, ry, cw, ch, 0x3a2a5a).setStrokeStyle(4, 0xffd86b);
      const icon = txt(this, x, ry - 12, room.icon, 52);
      const name = txt(this, x, ry + 46, room.name, 19, '#fff', { fontStyle: 'bold' });
      bg.setInteractive({ useHandCursor: true })
        .on('pointerover', () => { if (!room.visited && !this.busy) bg.setFillStyle(0x5a3f8a); })
        .on('pointerout', () => bg.setFillStyle(room.visited ? 0x2a2238 : 0x3a2a5a))
        .on('pointerdown', () => this.enter(i));
      return { bg, icon, name, x };
    });

    this.hint = txt(this, W / 2, 485, d.level === 5 ? '⚠️ אדון היתושים מסתתר באחד החדרים — הוא שומר על המפתח!' : 'בחרי חדר להיכנס אליו — באחד מהם מסתתר מפתח!', 22, d.level === 5 ? '#ffb347' : '#cdb8e8');
    button(this, 130, 538, 220, 48, '👗 תלבושות', () => openWardrobe(this), 0x8a4fd6).label.setFontSize(22);
    button(this, 830, 538, 200, 48, '💾 שמירה', () => openSlots(this, 'save', { level: this.d.level, hearts: this.hearts, map: MAP }), 0x2a7ac0).label.setFontSize(22);
    this.door = button(this, W / 2, 538, 380, 56, '', () => this.useDoor(), 0x555577);
    this.door.label.setFontSize(24);
    this.refresh();

    // coming back from a fight we just won
    if (d.won) {
      const room = rooms[d.roomIdx];
      room.visited = true;
      if (room.kind === 'guard') {
        MAP.hasKey = true; room.icon = '🔑';
        this.refresh();
        this.found('🔑 מצאת את המפתח!', rollDrops(2, d.level), true,
          () => { if (d.level >= 10) this.scene.start('End', { won: true }); });
      } else {
        room.icon = '✅';
        this.refresh();
        this.found('החרק הובס!', rollDrops(1, d.level), false);
      }
    }
  }
  onWardrobeClosed() { this.princess.setTexture(PR.body); this.portrait.setTexture(PR.body).setCrop(0, 0, 140, 112); this.refresh(); }
  refresh() {
    this.heartTxt.setText(`❤️ ${this.hearts}`);
    hset(this.coinTxt, `🪙 ${STATS.coins}`);
    const p = STATS.potions;
    hset(this.potTxt, `🧪 שיקויים ${p.heal + p.pow + p.wis + p.spd}`);
    writeSave(this.d.level, this.hearts, MAP); // auto-save whenever something changes on the map
    hset(this.keyTxt, MAP.hasKey ? '🔑 יש מפתח!' : '🔒 אין מפתח');
    this.keyTxt.setColor(MAP.hasKey ? '#7dff9a' : '#ff9a9a');
    MAP.rooms.forEach((room, i) => {
      const c = this.cards[i];
      c.icon.setText(room.icon);
      c.bg.setFillStyle(room.visited ? 0x2a2238 : 0x3a2a5a).setAlpha(room.visited ? 0.75 : 1);
    });
    const last = this.d.level >= 10;
    hset(this.door.label, MAP.hasKey ? (last ? '👑 לפתוח את דלת הכס!' : '🚪 לשלב הבא ➜') : '🔒 הדלת נעולה — מצאי את המפתח');
    this.door.bg.setFillStyle(MAP.hasKey ? 0x2fa84f : 0x555577);
  }
  enter(i) {
    const room = MAP.rooms[i];
    if (this.busy || room.visited) return;
    this.busy = true;
    this.hint.setText('');
    this.tweens.add({ targets: this.princess, x: this.cards[i].x, y: 205 - 14, duration: 650, ease: 'Sine.inOut',
      onComplete: () => {
        if (room.kind === 'guard' || room.kind === 'fight') {
          SND.sfx('appear');
          this.cameras.main.fadeOut(250, 0, 0, 0);
          this.time.delayedCall(260, () => this.scene.start('Battle', { level: this.d.level, hearts: this.hearts, room, roomIdx: i }));
        } else if (room.kind === 'treasure') {
          room.visited = true; room.icon = '💰'; this.refresh();
          this.found('🎁 מצאת חדר אוצרות!', rollDrops(3, this.d.level), false);
        } else { // trap
          room.visited = true; room.icon = '💥';
          this.hearts = Math.max(1, this.hearts - 1);
          this.cameras.main.shake(250, 0.015); this.cameras.main.flash(180, 255, 0, 0); SND.sfx('hurt');
          this.refresh();
          this.found('💥 מלכודת! -1 ❤️\nאבל בין הפירורים מצאת:', rollDrops(1, this.d.level), false);
        }
      } });
  }
  useDoor() {
    if (this.busy) return;
    if (!MAP.hasKey) {
      SND.sfx('wrong'); this.cameras.main.shake(120, 0.006);
      this.hint.setText('הדלת נעולה! מצאי את המפתח באחד החדרים.').setColor('#ff9a9a');
      return;
    }
    this.busy = true; SND.sfx('levelup');
    if (this.d.level >= 10) this.scene.start('End', { won: true });
    else this.scene.start('Victory', { level: this.d.level, hearts: this.hearts });
  }
  // modal listing what the princess found
  found(title, drops, key, onClose) {
    this.busy = true;
    const layer = this.add.container(0, 0).setDepth(200);
    layer.add(this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.7).setInteractive());
    layer.add(this.add.rectangle(W / 2, H / 2, 640, 340, 0x1b1030, 0.98).setStrokeStyle(4, 0xffd86b));
    layer.add(txt(this, W / 2, 190, title, 34, '#ffd86b', { fontStyle: 'bold', stroke: '#000', strokeThickness: 6 }));
    const items = [];
    if (key) items.push({ icon: '🔑', cap: 'מפתח לדלת!' });
    drops.forEach(dr => items.push(dr.coins ? { icon: '💰', cap: `+${dr.coins} 🪙`, coin: true } : { icon: POTIONS[dr.potion].icon, cap: POTIONS[dr.potion].name }));
    items.forEach((it, i) => {
      const x = W / 2 + (i - (items.length - 1) / 2) * 150;
      const ic = txt(this, x, 305, it.icon, 56).setScale(0);
      const cap = txt(this, x, 355, it.cap, 20, '#ffe9a8').setAlpha(0);
      layer.add([ic, cap]);
      this.tweens.add({ targets: ic, scale: 1, duration: 400, delay: 250 + i * 300, ease: 'Back.out',
        onStart: () => SND.sfx(key && i === 0 ? 'win' : it.coin ? 'coin' : 'potion') });
      this.tweens.add({ targets: cap, alpha: 1, duration: 250, delay: 400 + i * 300 });
    });
    layer.add(button(this, W / 2, 440, 220, 54, 'מעולה! ➜', () => {
      layer.destroy(); this.busy = false;
      this.hint.setText(MAP.hasKey ? 'יש לך את המפתח! אפשר לצאת מהדלת, או לחקור עוד חדרים.' : 'בחרי חדר נוסף — המפתח עדיין מסתתר.').setColor('#cdb8e8');
      this.refresh();
      if (onClose) onClose();
    }, 0x2fa84f));
  }
}

class VictoryScene extends Phaser.Scene {
  constructor() { super('Victory'); }
  init(d) { this.d = d; }
  create() {
    drawCastleBg(this, [0x1a3a2a, 0x3a7a5a]);
    SND.music('shop'); SND.sfx('win'); addSoundToggle(this);
    this.hearts = Math.min(MAX_HEARTS, this.d.hearts + 2);
    const healed = this.hearts - this.d.hearts;

    txt(this, W / 2, 42, `שלב ${this.d.level} הושלם!`, 46, '#ffd86b', { fontStyle: 'bold', stroke: '#000', strokeThickness: 7 });

    // ----- loot: 2-3 drops, each a pile of coins or a potion -----
    const drops = [];
    const n = ri(2, 3);
    for (let i = 0; i < n; i++) {
      if (Math.random() < 0.45) drops.push({ coins: ri(2, 4) + this.d.level });
      else drops.push({ potion: Phaser.Math.RND.weightedPick(['heal', 'heal', 'pow', 'wis', 'spd']) });
    }
    txt(this, W / 2, 98, 'מצאת בשלל:', 22, '#fff');
    drops.forEach((dr, i) => {
      const x = W / 2 + (i - (n - 1) / 2) * 190;
      const label = dr.coins ? `+${dr.coins} 🪙` : POTIONS[dr.potion].name;
      const icon = txt(this, x, 150, dr.coins ? '💰' : POTIONS[dr.potion].icon, 52).setScale(0);
      const cap = txt(this, x, 195, label, 20, '#ffd86b').setAlpha(0);
      this.tweens.add({ targets: icon, scale: 1, duration: 450, delay: 900 + i * 350, ease: 'Back.out', onStart: () => SND.sfx(dr.coins ? 'coin' : 'potion') });
      this.tweens.add({ targets: cap, alpha: 1, duration: 300, delay: 1100 + i * 350 });
      if (dr.coins) STATS.coins += dr.coins; else STATS.potions[dr.potion]++;
    });

    // ----- status -----
    this.heartsTxt = txt(this, 250, 250, '', 30, '#ff7a8a', { fontStyle: 'bold' });
    this.coinsTxt = txt(this, 760, 250, '', 30, '#ffd86b', { fontStyle: 'bold' });
    this.noteTxt = txt(this, W / 2, 292, healed ? `המרפאה המלכותית מחזירה ${healed} ❤️` : 'את במלוא הבריאות!', 20, '#cdb8e8');
    this.statTxt = txt(this, W / 2, 322, '', 22, '#ffe9a8');

    // ----- potion bag + shop -----
    this.bagBtns = {};
    Object.keys(POTIONS).forEach((k, i) => {
      const P = POTIONS[k], x = 130 + i * 233;
      this.add.rectangle(x, 410, 215, 130, 0x120a1f, 0.8).setStrokeStyle(2, P.color);
      txt(this, x, 372, `${P.icon} ${P.name}`, 20, '#fff', { fontStyle: 'bold' });
      txt(this, x, 398, P.desc, 16, '#cdb8e8');
      const drink = button(this, x, 440, 170, 38, '', () => this.drink(k), P.color);
      drink.label.setFontSize(20);
      this.bagBtns[k] = { drink };
    });

    button(this, 800, 492, 240, 40, '👗 תלבושות', () => openWardrobe(this), 0x8a4fd6).label.setFontSize(22);
    button(this, 160, 492, 240, 40, '💾 שמירה', () => openSlots(this, 'save', { level: this.d.level + 1, hearts: this.hearts, map: null }), 0x2a7ac0).label.setFontSize(22);
    this.shopBtn = button(this, W / 2, 492, 300, 40, '', () => this.openShop(), 0x8a4fd6);
    this.shopBtn.label.setFontSize(22);
    const go = () => { writeSave(this.d.level + 1, this.hearts, null); this.scene.start('Map', { level: this.d.level + 1, hearts: this.hearts, fresh: true }); };
    const next = LEVELS[this.d.level];
    txt(this, W / 2, 530, `הבא: ${next.room} — ${next.name} ${next.bug}`, 20, '#cdb8e8');
    button(this, W / 2, 568, 260, 48, 'קדימה! ➜', go, 0x2fa84f).label.setFontSize(24);
    this.input.keyboard.once('keydown-ENTER', go);
    this.refresh();
  }
  refresh() {
    this.heartsTxt.setText(`❤️ ${this.hearts}`);
    hset(this.coinsTxt, `🪙 ${STATS.coins}`);
    hset(this.statTxt, `⚔️ כוח ${strength()}   ⏱ ${turnTime() / 1000} שניות   ⚡ חלון קריטי ${Math.round(quickWindow() * 100)}%`);
    for (const k in POTIONS) {
      const { drink } = this.bagBtns[k];
      const have = STATS.potions[k];
      const canDrink = have > 0 && !(k === 'heal' && this.hearts >= MAX_HEARTS) && !(k === 'spd' && quickWindow() >= 0.8);
      hset(drink.label, `שתה (${have})`);
      drink.bg.setAlpha(canDrink ? 1 : 0.4);
    }
    hset(this.shopBtn.label, `🏪 לחנות  (🪙 ${STATS.coins})`);
  }
  pop(x, y, label, color = '#7dff9a') {
    const t = txt(this, x, y, label, 30, color, { fontStyle: 'bold', stroke: '#000', strokeThickness: 5 }).setDepth(50);
    this.tweens.add({ targets: t, y: y - 60, alpha: 0, duration: 1200, onComplete: () => t.destroy() });
  }
  drink(k) {
    if (STATS.potions[k] <= 0) return;
    if (k === 'heal' && this.hearts >= MAX_HEARTS) return this.pop(250, 250, 'הלבבות מלאים', '#ff7a7a');
    if (k === 'spd' && quickWindow() >= 0.8) return this.pop(W / 2, 322, 'המהירות במקסימום', '#ff7a7a');
    STATS.potions[k]--;
    SND.sfx(k === 'pow' ? 'levelup' : 'potion');
    if (k === 'heal') { this.hearts = Math.min(MAX_HEARTS, this.hearts + 2); this.pop(250, 250, '+2 ❤️'); }
    if (k === 'pow') { STATS.powBonus++; this.pop(W / 2, 322, '+1 ⚔️ כוח'); }
    if (k === 'wis') { STATS.timeBonus++; this.pop(W / 2, 322, '+3 ⏱ שניות'); }
    if (k === 'spd') { STATS.spdBonus++; this.pop(W / 2, 322, '+10% ⚡ חלון קריטי'); }
    this.cameras.main.flash(180, 255, 255, 255);
    this.refresh();
  }
  onWardrobeClosed() { this.refresh(); }
  openShop() {
    this.scene.pause();
    this.scene.launch('Shop');
  }
}

// ---------- Shop (opens over the between-level screen) ----------
class ShopScene extends Phaser.Scene {
  constructor() { super('Shop'); }
  create() {
    this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.72).setInteractive(); // blocks clicks behind
    this.add.rectangle(W / 2, H / 2, 840, 540, 0x1b1030, 0.98).setStrokeStyle(4, 0xffd86b);
    txt(this, W / 2, 62, '🏪 החנות של המכשפה', 40, '#ffd86b', { fontStyle: 'bold', stroke: '#000', strokeThickness: 6 });
    txt(this, 150, 150, '🧙‍♀️', 70);
    txt(this, 470, 150, '"ברוכה הבאה, נסיכה!\nמטבעות יוצאים — שיקויים נכנסים."', 22, '#fff');
    this.coinTxt = txt(this, 800, 150, '', 32, '#ffd86b', { fontStyle: 'bold' });

    this.rows = {};
    Object.keys(POTIONS).forEach((k, i) => {
      const P = POTIONS[k], y = 235 + i * 80;
      this.add.rectangle(W / 2, y, 760, 70, 0x2a1a48, 1).setStrokeStyle(2, P.color);
      txt(this, 130, y, P.icon, 44);
      txt(this, 330, y - 14, P.name, 24, '#fff', { fontStyle: 'bold' });
      txt(this, 330, y + 15, P.desc, 17, '#cdb8e8');
      const owned = txt(this, 545, y, '', 20, '#ffe9a8');
      const btn = button(this, 745, y, 190, 46, `קנה 🪙 ${P.cost}`, () => this.buy(k), P.color);
      btn.label.setFontSize(22);
      this.rows[k] = { owned, btn };
    });
    button(this, W / 2, 558, 240, 44, 'חזרה ➜', () => this.close(), 0x2fa84f).label.setFontSize(24);
    this.input.keyboard.once('keydown-ESC', () => this.close());
    this.refresh();
  }
  refresh() {
    hset(this.coinTxt, `🪙 ${STATS.coins}`);
    for (const k in POTIONS) {
      hset(this.rows[k].owned, `יש לך: ${STATS.potions[k]}`);
      this.rows[k].btn.bg.setAlpha(STATS.coins >= POTIONS[k].cost ? 1 : 0.4);
    }
  }
  buy(k) {
    const P = POTIONS[k];
    if (STATS.coins < P.cost) return this.pop(W / 2, 520, 'אין מספיק מטבעות', '#ff7a7a');
    STATS.coins -= P.cost; STATS.potions[k]++;
    SND.sfx('coin');
    this.pop(this.rows[k].btn.x, this.rows[k].btn.y - 30, `+1 ${P.icon}`);
    this.pop(800, 190, `-${P.cost} 🪙`, '#ffd86b');
    this.refresh();
  }
  pop(x, y, label, color = '#7dff9a') {
    const t = txt(this, x, y, label, 28, color, { fontStyle: 'bold', stroke: '#000', strokeThickness: 5 }).setDepth(50);
    this.tweens.add({ targets: t, y: y - 50, alpha: 0, duration: 1000, onComplete: () => t.destroy() });
  }
  close() {
    this.scene.stop();
    this.scene.resume('Victory');
    this.scene.get('Victory').refresh();
  }
}

// ---------- End ----------
class EndScene extends Phaser.Scene {
  constructor() { super('End'); }
  init(d) { this.d = d; }
  create() {
    if (this.d.won) {
      drawCastleBg(this, [0x3a2a6a, 0xd89a3a]);
      SND.music('menu'); SND.sfx('win'); addSoundToggle(this);
      txt(this, W / 2, 110, '👑 הטירה ניצלה! 👑', 56, '#ffd86b', { fontStyle: 'bold', stroke: '#000', strokeThickness: 8 });
      ensureCosmetics(this); if (CUR_SLOT) clearSlot(CUR_SLOT);
      this.add.image(W / 2, 440, PR.body).setOrigin(0.5, 1).setScale(1.0);
      this.add.image(W / 2 + 95, 340, weaponKey()).setScale(0.8).setAngle(15);
      addCrest(this, W / 2 - 90, 345, 0.85);
      txt(this, W / 2, 400, 'נסיכה, ניצחת את מלכת החרקים\nופתרת את כל תרגילי החשבון!', 30, '#fff');
      for (let i = 0; i < 40; i++) {
        const s = txt(this, ri(0, W), ri(-300, 0), Phaser.Math.RND.pick(['🎉', '✨', '⭐', '👑']), ri(24, 44));
        this.tweens.add({ targets: s, y: H + 50, duration: ri(2500, 5000), repeat: -1, delay: ri(0, 3000) });
      }
      button(this, W / 2, 520, 300, 66, '↻ משחק חדש', () => this.scene.start('Title'), 0x7b3fe4);
    } else {
      drawCastleBg(this, [0x2a0a0a, 0x5a1a1a]);
      addSoundToggle(this);
      txt(this, W / 2, 130, 'החרקים ניצחו הפעם…', 52, '#ff7a7a', { fontStyle: 'bold', stroke: '#000', strokeThickness: 7 });
      txt(this, W / 2, 270, '😵👸', 110);
      txt(this, W / 2, 380, 'תרגול עושה מושלם — נסו שוב!', 28, '#fff');
      const retry = () => this.scene.start('Map', { level: this.d.level, hearts: START_HEARTS, fresh: true });
      button(this, W / 2 - 170, 480, 300, 66, `↻ שוב שלב ${this.d.level}`, retry, 0x2fa84f);
      button(this, W / 2 + 170, 480, 300, 66, '🏰 תפריט ראשי', () => this.scene.start('Title'), 0x7b3fe4);
      this.input.keyboard.once('keydown-ENTER', retry);
    }
  }
}

window.__game = new Phaser.Game({
  type: Phaser.AUTO,
  width: W, height: H,
  backgroundColor: '#120a1f',
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  scene: [TitleScene, MapScene, BattleScene, VictoryScene, ShopScene, WardrobeScene, SlotsScene, EndScene],
});


