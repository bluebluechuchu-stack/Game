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

function finishGame() {
  state = 'finished';
  activeMole = -1;
  pop = 0;
}

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
    if (Math.hypot(point.x - hole.x, point.y - (hole.y - 28)) < 70) {
      chosen = index;
      return true;
    }
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
    floating = { text: `+${gained}`, x: hole.x, y: hole.y - 95, life: 0.75, good: true };
    bonk = { x: hole.x, y: hole.y - 40, life: 0.3 };
    flash = { color: '255, 242, 80', life: 0.18 };
    activeMole = -1;
    pop = 0;
    nextMole = 0.08 + Math.random() * 0.14;
  } else {
    combo = 0;
    score = Math.max(0, score - 3);
    floating = { text: '-3', x: hole.x, y: hole.y - 70, life: 0.6, good: false };
    flash = { color: '255, 45, 30', life: 0.16 };
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
      combo = 0;
      activeMole = -1;
      pop = 0;
      nextMole = 0.12 + Math.random() * 0.2;
    } else pop = Math.min(1, pop + dt * 8);
  }
}

function draw() {
  drawBackground();
  if (state === 'title') drawTitle();
  else {
    drawGame();
    if (state === 'finished') drawResult();
  }
  drawHammer();
}

function drawBackground() {
  ctx.fillStyle = '#91d5f0';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#ffe27a';
  circle(82, 78, 54);
  ctx.fillStyle = '#79bd63';
  polygon([[0,175],[110,115],[220,180],[350,105],[500,180],[650,105],[790,170],[960,95],[960,260],[0,260]]);
  ctx.fillStyle = '#6fbb57';
  ctx.fillRect(0, 235, W, 405);
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  for (let i = 0; i < 28; i += 1) circle((i * 83 + 31) % 960, 225 + (i * 47) % 400, 3);
}

function drawTitle() {
  drawPanel(150, 95, 660, 450);
  centerText('哥哥的', 480, 155, 34, '#5a3723');
  centerText('打地鼠挑戰', 480, 225, 52, '#d85c45');
  drawMole(480, 365, 1, false);
  drawButton(350, 450, 260, 72, '開始挑戰');
  centerText('滑鼠點地鼠，鍵盤 1 到 9 也可以敲。', 480, 555, 20, '#5a3723');
}

function drawGame() {
  drawPanel(155, 20, 650, 92, '#fff0c9');
  labelPair('分數', score, 250, 48, '#d85c45');
  labelPair('連擊', `x${combo}`, 475, 48, '#2b8a63');
  labelPair('時間', `${Math.ceil(timeLeft).toString().padStart(2, '0')}`, 700, 48, '#b64f9d');
  ctx.fillStyle = '#d8c7a1';
  roundRect(185, 91, 590, 9, 5); ctx.fill();
  ctx.fillStyle = timeLeft / GAME_TIME < 0.25 ? '#e8814f' : '#78b84d';
  roundRect(185, 91, 590 * timeLeft / GAME_TIME, 9, 5); ctx.fill();
  holes.forEach(drawHole);
  if (activeMole >= 0) {
    const hole = holes[activeMole];
    drawMole(hole.x, hole.y + (26 + (-40 - 26) * pop), pop, false);
    centerText(String(activeMole + 1), hole.x, hole.y + 23, 17, '#fff4c4');
  }
  if (bonk) drawMole(bonk.x, bonk.y + Math.sin(bonk.life * 28) * 5, 0.82, true);
  if (floating) {
    const alpha = Math.min(1, floating.life * 2);
    centerText(floating.text, floating.x, floating.y - (0.75 - floating.life) * 35, 32, floating.good ? `rgba(255,241,107,${alpha})` : `rgba(255,141,120,${alpha})`);
  }
  if (flash) {
    ctx.fillStyle = `rgba(${flash.color}, ${flash.life})`;
    ctx.fillRect(0, 0, W, H);
  }
}

function drawResult() {
  ctx.fillStyle = 'rgba(28, 20, 12, 0.56)';
  ctx.fillRect(0, 0, W, H);
  drawPanel(235, 120, 490, 410);
  centerText('時間到！', 480, 178, 45, '#d85c45');
  centerText(score >= 250 ? '地鼠剋星！' : score >= 130 ? '超會敲！' : '再挑戰一次！', 480, 235, 31, '#2b8a63');
  centerText('最後分數', 480, 300, 21, '#5a3723');
  centerText(score, 480, 360, 62, '#b64f9d');
  centerText(`最高連擊 x${bestCombo}`, 480, 405, 21, '#5a3723');
  drawButton(350, 445, 260, 62, '再玩一次');
}

function drawHole(hole, index) {
  ctx.fillStyle = 'rgba(45, 35, 20, 0.25)';
  ellipse(hole.x, hole.y + 12, 85, 40);
  ctx.fillStyle = '#302819';
  ellipse(hole.x, hole.y, 76, 34);
  ctx.strokeStyle = '#a56a36';
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.ellipse(hole.x, hole.y, 76, 34, 0, Math.PI, Math.PI * 2);
  ctx.stroke();
  centerText(String(index + 1), hole.x - 55, hole.y + 2, 16, 'rgba(255,255,255,0.6)');
}

function drawMole(x, y, amount, hit) {
  const scaleY = Math.max(0.65, amount);
  ctx.fillStyle = hit ? '#b46b45' : '#8d5938';
  circle(x, y + 22, 53);
  ctx.fillStyle = '#72442c';
  circle(x - 34, y - 18 * scaleY, 18);
  circle(x + 34, y - 18 * scaleY, 18);
  ctx.fillStyle = '#f0c0a0';
  ellipse(x, y + 12, 38, 30);
  ctx.fillStyle = '#211c19';
  circle(x - 18, y - 5, 5);
  circle(x + 18, y - 5, 5);
  ctx.fillStyle = '#40251e';
  ellipse(x, y + 10, 11, 8);
  ctx.strokeStyle = '#40251e';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(x, y + 17, 12, 0.2, Math.PI - 0.2);
  ctx.stroke();
  if (hit) centerText('BONK', x, y - 52, 23, '#fff16b');
}

function drawHammer() {
  const progress = swing > 0 ? 1 - swing / 0.18 : 0;
  const angle = swing > 0 ? -0.55 + Math.sin(progress * Math.PI) * 0.9 : 0;
  ctx.save();
  ctx.translate(mouse.x, mouse.y);
  ctx.rotate(angle);
  ctx.fillStyle = '#ffd778';
  roundRect(6, -16, 18, 58, 8); ctx.fill();
  ctx.strokeStyle = '#9b6040'; ctx.lineWidth = 3; ctx.stroke();
  ctx.fillStyle = swing > 0 ? '#f0675e' : '#f27669';
  roundRect(-44, -54, 90, 42, 14); ctx.fill(); ctx.stroke();
  ctx.restore();
}

function drawPanel(x, y, w, h, color = '#ffe7b6') {
  ctx.fillStyle = color;
  ctx.strokeStyle = '#7e5636';
  ctx.lineWidth = 4;
  roundRect(x, y, w, h, 18);
  ctx.fill();
  ctx.stroke();
}

function drawButton(x, y, w, h, text) {
  ctx.fillStyle = '#f37b66';
  ctx.strokeStyle = '#8c5136';
  ctx.lineWidth = 4;
  roundRect(x, y, w, h, 18);
  ctx.fill();
  ctx.stroke();
  centerText(text, x + w / 2, y + h / 2 + 9, 29, '#fff');
}

function labelPair(label, value, x, y, color) {
  centerText(label, x, y, 17, '#5a3723');
  centerText(value, x, y + 34, 29, color);
}

function centerText(text, x, y, size, color) {
  ctx.fillStyle = color;
  ctx.font = `800 ${size}px "Microsoft JhengHei", "Noto Sans TC", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(text, x, y);
}

function circle(x, y, r) { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); }
function ellipse(x, y, rx, ry) { ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.fill(); }
function polygon(points) { ctx.beginPath(); ctx.moveTo(points[0][0], points[0][1]); points.slice(1).forEach(([x, y]) => ctx.lineTo(x, y)); ctx.closePath(); ctx.fill(); }
function roundRect(x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }

canvas.addEventListener('mousemove', event => { mouse = canvasPoint(event); });
canvas.addEventListener('mousedown', event => handlePress(canvasPoint(event)));
canvas.addEventListener('touchstart', event => { event.preventDefault(); const point = canvasPoint(event); mouse = point; handlePress(point); }, { passive: false });
window.addEventListener('keydown', event => {
  if (event.code === 'Space' && state !== 'playing') startGame();
  if (state === 'playing' && /^[1-9]$/.test(event.key)) hitHole(Number(event.key) - 1);
});
startButton.addEventListener('click', startGame);

function frame(now) {
  const dt = Math.min(0.05, (now - lastTime) / 1000);
  lastTime = now;
  update(dt);
  draw();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
