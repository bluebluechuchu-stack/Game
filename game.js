const canvas = document.querySelector('#game');
const ctx = canvas.getContext('2d');
const startButton = document.querySelector('#startButton');
const W = canvas.width;
const H = canvas.height;
const GAME_TIME = 30;
const holes = [];

let state = 'title';
let score = 0;
let combo = 0;
let bestCombo = 0;
let timeLeft = GAME_TIME;
let activeMole = -1;
let moleLife = 0;
let nextMole = 0.35;
let pop = 0;
let floating = null;
let bonk = null;
let flash = null;
let mouse = { x: 480, y: 320 };
let swing = 0;
let lastTime = performance.now();

for (let row = 0; row < 3; row += 1) {
  for (let col = 0; col < 3; col += 1) holes.push({ x: 250 + col * 230, y: 270 + row * 145 });
}

function startGame() {
  state = 'playing';
  score = 0;
  combo = 0;
  bestCombo = 0;
  timeLeft = GAME_TIME;
  activeMole = -1;
  moleLife = 0;
  nextMole = 0.35;
  pop = 0;
  floating = null;
  bonk = null;
  flash = null;
}

function finishGame() { state = 'finished'; activeMole = -1; pop = 0; }

function spawnMole() {
  const old = activeMole;
  activeMole = Math.floor(Math.random() * holes.length);
  if (activeMole === old) activeMole = (activeMole + 1 + Math.floor(Math.random() * 8)) % holes.length;
  const difficulty = 1 - timeLeft / GAME_TIME;
  moleLife = 1.15 + (0.55 - 1.15) * difficulty;
  pop = 0;
}

function canvasPoint(event) {
  const rect = canvas.getBoundingClientRect();
  const touch = event.touches ? event.touches[0] : event;
  return { x: (touch.clientX - rect.left) * W / rect.width, y: (touch.clientY - rect.top) * H / rect.height };
}

function handlePress(point) {
  if (state === 'title' || state === 'finished') {
    if (point.x >= 350 && point.x <= 610 && point.y >= 450 && point.y <= 522) startGame();
    return;
  }
  if (state !== 'playing') return;
  swing = 0.18;
  let chosen = -1;
  holes.some((hole, index) => {
    if (Math.hypot(point.x - hole.x, point.y - (hole.y - 32)) < 74) { chosen = index; return true; }
    return false;
  });
  if (chosen >= 0) hitHole(chosen);
}

function hitHole(index) {
  const hole = holes[index];
  if (index === activeMole && pop > 0.35) {
    combo += 1;
    bestCombo = Math.max(bestCombo, combo);
    const gained = 10 + Math.min(combo - 1, 10) * 2;
    score += gained;
    floating = { text: `+${gained}`, x: hole.x, y: hole.y - 108, life: 0.75, good: true };
    bonk = { x: hole.x, y: hole.y - 52, life: 0.3 };
    flash = { color: '255, 239, 119', life: 0.18 };
    activeMole = -1;
    pop = 0;
    nextMole = 0.08 + Math.random() * 0.14;
  } else {
    combo = 0;
    score = Math.max(0, score - 3);
    floating = { text: '-3', x: hole.x, y: hole.y - 76, life: 0.6, good: false };
    flash = { color: '255, 78, 66', life: 0.16 };
  }
}

function update(dt) {
  swing = Math.max(0, swing - dt);
  if (floating && (floating.life -= dt) <= 0) floating = null;
  if (bonk && (bonk.life -= dt) <= 0) bonk = null;
  if (flash && (flash.life -= dt) <= 0) flash = null;
  if (state !== 'playing') return;
  timeLeft = Math.max(0, timeLeft - dt);
  if (timeLeft <= 0) return finishGame();
  if (activeMole < 0) {
    nextMole -= dt;
    if (nextMole <= 0) spawnMole();
  } else {
    moleLife -= dt;
    if (moleLife <= 0) {
      combo = 0; activeMole = -1; pop = 0; nextMole = 0.12 + Math.random() * 0.2;
    } else pop = Math.min(1, pop + dt * 8);
  }
}

function draw() {
  drawBackground();
  if (state === 'title') drawTitle();
  else { drawGame(); if (state === 'finished') drawResult(); }
  drawHammer();
}

function drawBackground() {
  const sky = ctx.createLinearGradient(0, 0, 0, 250);
  sky.addColorStop(0, '#bdefff'); sky.addColorStop(1, '#8ed9f2');
  ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#ffe889'; circle(82, 78, 56);
  ctx.strokeStyle = 'rgba(255,232,137,.65)'; ctx.lineWidth = 10;
  for (let i = 0; i < 10; i++) { const a = i * Math.PI * 2 / 10; line(82 + Math.cos(a) * 70, 78 + Math.sin(a) * 70, 82 + Math.cos(a) * 92, 78 + Math.sin(a) * 92); }
  ctx.fillStyle = '#82c867'; polygon([[0,175],[110,115],[220,180],[350,105],[500,180],[650,105],[790,170],[960,95],[960,260],[0,260]]);
  ctx.fillStyle = '#71bd5a'; polygon([[0,218],[145,165],[310,225],[475,155],[650,220],[815,160],[960,210],[960,290],[0,290]]);
  const grass = ctx.createLinearGradient(0, 235, 0, H);
  grass.addColorStop(0, '#78c763'); grass.addColorStop(1, '#59aa4e');
  ctx.fillStyle = grass; ctx.fillRect(0, 235, W, 405);
  ctx.fillStyle = 'rgba(230,255,199,.35)';
  for (let i = 0; i < 35; i++) circle((i * 83 + 31) % 960, 240 + (i * 47) % 380, 3);
}

function drawTitle() {
  drawPanel(150, 95, 660, 450);
  centerText('哥哥的', 480, 155, 34, '#5a3723');
  centerText('打地鼠挑戰', 480, 225, 52, '#d85c45');
  drawMole(480, 365, 1, false, 1.15);
  drawButton(350, 450, 260, 72, '開始挑戰');
  centerText('滑鼠點地鼠，鍵盤 1 到 9 也可以敲。', 480, 555, 20, '#5a3723');
}

function drawGame() {
  drawPanel(155, 20, 650, 92, '#fff0c9');
  labelPair('分數', score, 250, 48, '#d85c45');
  labelPair('連擊', `x${combo}`, 475, 48, '#2b8a63');
  labelPair('時間', `${Math.ceil(timeLeft).toString().padStart(2, '0')}`, 700, 48, '#b64f9d');
  ctx.fillStyle = '#d8c7a1'; roundRect(185, 91, 590, 9, 5); ctx.fill();
  ctx.fillStyle = timeLeft / GAME_TIME < 0.25 ? '#e8814f' : '#78b84d'; roundRect(185, 91, 590 * timeLeft / GAME_TIME, 9, 5); ctx.fill();
  holes.forEach(drawHole);
  if (activeMole >= 0) {
    const h = holes[activeMole];
    drawMole(h.x, h.y + (28 + (-48 - 28) * easeOutBack(pop)), pop, false);
    centerText(String(activeMole + 1), h.x, h.y + 24, 17, '#fff4c4');
  }
  if (bonk) { drawHitBurst(bonk.x, bonk.y - 58, bonk.life / .3); drawMole(bonk.x, bonk.y + Math.sin(bonk.life * 28) * 5, .82, true); }
  if (floating) { const a = Math.min(1, floating.life * 2); centerText(floating.text, floating.x, floating.y - (.75 - floating.life) * 35, 32, floating.good ? `rgba(255,241,107,${a})` : `rgba(255,141,120,${a})`); }
  if (flash) { ctx.fillStyle = `rgba(${flash.color}, ${flash.life})`; ctx.fillRect(0, 0, W, H); }
}

function drawResult() {
  ctx.fillStyle = 'rgba(28,20,12,.56)'; ctx.fillRect(0, 0, W, H);
  drawPanel(235, 120, 490, 410);
  centerText('時間到！', 480, 178, 45, '#d85c45');
  centerText(score >= 250 ? '地鼠剋星！' : score >= 130 ? '超會敲！' : '再挑戰一次！', 480, 235, 31, '#2b8a63');
  centerText('最後分數', 480, 300, 21, '#5a3723');
  centerText(score, 480, 360, 62, '#b64f9d');
  centerText(`最高連擊 x${bestCombo}`, 480, 405, 21, '#5a3723');
  drawButton(350, 445, 260, 62, '再玩一次');
}

function drawHole(h, index) {
  ctx.save();
  ctx.fillStyle = 'rgba(43, 76, 35, .34)'; ellipse(h.x, h.y + 18, 92, 42);
  const rim = ctx.createLinearGradient(h.x, h.y - 36, h.x, h.y + 42);
  rim.addColorStop(0, '#d9974c'); rim.addColorStop(1, '#5f873e');
  ctx.fillStyle = rim; ellipse(h.x, h.y, 88, 38);
  ctx.fillStyle = '#2f2618'; ellipse(h.x, h.y + 2, 78, 31);
  ctx.restore();
  centerText(String(index + 1), h.x - 55, h.y + 2, 16, 'rgba(255,255,255,.68)');
}

function drawMole(x, y, amount, hit, scale = 1) {
  ctx.save(); ctx.translate(x, y); ctx.scale(scale, scale * Math.max(.68, amount));
  ctx.fillStyle = 'rgba(44,28,20,.20)'; ellipse(0, 52, 58, 18);
  const body = ctx.createLinearGradient(0, -58, 0, 62); body.addColorStop(0, hit ? '#b56b44' : '#a5653c'); body.addColorStop(1, hit ? '#7a442b' : '#744326');
  ctx.fillStyle = body; circle(0, 6, 58);
  ctx.fillStyle = '#7a442b'; circle(-39, -38, 22); circle(39, -38, 22);
  ctx.fillStyle = '#f0bf9c'; circle(0, -22, 48);
  ctx.fillStyle = '#f4cbae'; ellipse(0, 12, 36, 26);
  ctx.fillStyle = '#4b2a22'; circle(-19, -19, 6); circle(19, -19, 6); ellipse(0, 2, 12, 9);
  ctx.fillStyle = '#fff'; circle(-17, -22, 2); circle(21, -22, 2);
  ctx.strokeStyle = '#4b2a22'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 9, 14, .18, Math.PI - .18); ctx.stroke();
  ctx.fillStyle = 'rgba(255,138,124,.55)'; circle(-31, 1, 8); circle(31, 1, 8);
  if (hit) { ctx.rotate(-.12); centerText('BONK', 0, -64, 21, '#fff16b'); }
  ctx.restore();
}

function drawHammer() {
  const progress = swing > 0 ? 1 - swing / .18 : 0;
  const angle = swing > 0 ? -.62 + Math.sin(progress * Math.PI) * 1.02 : -.08;
  ctx.save(); ctx.translate(mouse.x, mouse.y); ctx.rotate(angle);
  const handle = ctx.createLinearGradient(6, -18, 30, 58); handle.addColorStop(0, '#ffe08a'); handle.addColorStop(1, '#c38342'); ctx.fillStyle = handle; roundRect(9, -18, 19, 68, 9); ctx.fill(); ctx.strokeStyle = '#8c5833'; ctx.lineWidth = 3; ctx.stroke();
  const head = ctx.createLinearGradient(-48, -58, 52, -10); head.addColorStop(0, '#ff9b91'); head.addColorStop(1, '#db5854'); ctx.fillStyle = head; roundRect(-48, -60, 98, 46, 18); ctx.fill(); ctx.strokeStyle = '#963a39'; ctx.stroke();
  ctx.restore();
}

function drawHitBurst(x, y, alpha) { ctx.save(); ctx.globalAlpha = alpha; ctx.fillStyle = '#fff16b'; for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; polygon([[x + Math.cos(a) * 14, y + Math.sin(a) * 14], [x + Math.cos(a + .18) * 48, y + Math.sin(a + .18) * 48], [x + Math.cos(a - .18) * 48, y + Math.sin(a - .18) * 48]]); } ctx.restore(); }
function drawPanel(x, y, w, h, color = '#ffe7b6') { ctx.fillStyle = color; ctx.strokeStyle = '#7e5636'; ctx.lineWidth = 4; roundRect(x, y, w, h, 18); ctx.fill(); ctx.stroke(); }
function drawButton(x, y, w, h, text) { ctx.fillStyle = '#f37b66'; ctx.strokeStyle = '#8c5136'; ctx.lineWidth = 4; roundRect(x, y, w, h, 18); ctx.fill(); ctx.stroke(); centerText(text, x + w / 2, y + h / 2 + 9, 29, '#fff'); }
function labelPair(label, value, x, y, color) { centerText(label, x, y, 17, '#5a3723'); centerText(value, x, y + 34, 29, color); }
function centerText(text, x, y, size, color) { ctx.fillStyle = color; ctx.font = `800 ${size}px "Microsoft JhengHei", "Noto Sans TC", sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.fillText(text, x, y); }
function easeOutBack(t) { const c1 = 1.7, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); }
function circle(x, y, r) { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); }
function ellipse(x, y, rx, ry) { ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.fill(); }
function line(x1, y1, x2, y2) { ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); }
function polygon(points) { ctx.beginPath(); ctx.moveTo(points[0][0], points[0][1]); points.slice(1).forEach(([x, y]) => ctx.lineTo(x, y)); ctx.closePath(); ctx.fill(); }
function roundRect(x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }

canvas.addEventListener('mousemove', event => { mouse = canvasPoint(event); });
canvas.addEventListener('mousedown', event => handlePress(canvasPoint(event)));
canvas.addEventListener('touchstart', event => { event.preventDefault(); const point = canvasPoint(event); mouse = point; handlePress(point); }, { passive: false });
window.addEventListener('keydown', event => { if (event.code === 'Space' && state !== 'playing') startGame(); if (state === 'playing' && /^[1-9]$/.test(event.key)) hitHole(Number(event.key) - 1); });
startButton.addEventListener('click', startGame);
function frame(now) { const dt = Math.min(.05, (now - lastTime) / 1000); lastTime = now; update(dt); draw(); requestAnimationFrame(frame); }
requestAnimationFrame(frame);
