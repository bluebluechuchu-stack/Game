const canvas = document.querySelector('#game');
const ctx = canvas.getContext('2d');
const scoreLabel = document.querySelector('#scoreLabel');
const comboLabel = document.querySelector('#comboLabel');
const timeLabel = document.querySelector('#timeLabel');
const livesLabel = document.querySelector('#livesLabel');
const bestLabel = document.querySelector('#bestLabel');
const overlay = document.querySelector('#overlay');
const overlayKicker = document.querySelector('#overlayKicker');
const overlayTitle = document.querySelector('#overlayTitle');
const overlayText = document.querySelector('#overlayText');
const startButton = document.querySelector('#startButton');
const pauseButton = document.querySelector('#pauseButton');
const soundButton = document.querySelector('#soundButton');
const dashButton = document.querySelector('#dashButton');
const moveButtons = [...document.querySelectorAll('.move')];

const W = canvas.width;
const H = canvas.height;
const ROUND_TIME = 60;
const keys = new Set();
const held = { up: false, down: false, left: false, right: false };
const skyStars = Array.from({ length: 70 }, (_, index) => ({
  x: (index * 137 + 31) % W,
  y: 20 + ((index * 83) % 225),
  size: 1 + (index % 4) * .45,
  phase: index * .61
}));

let state = 'title';
let lastTime = performance.now();
let elapsed = 0;
let timeLeft = ROUND_TIME;
let score = 0;
let combo = 0;
let comboWindow = 0;
let lives = 3;
let level = 1;
let best = Number(localStorage.getItem('solureMoonlakeBest') || 0);
let starTimer = 0;
let shadowTimer = 0;
let dashCooldown = 0;
let dashTimer = 0;
let pointerDown = false;
let pointerTarget = null;
let soundOn = true;
let audioContext = null;

const player = {
  x: W / 2,
  y: H * .72,
  vx: 0,
  vy: 0,
  angle: 0,
  radius: 28,
  invulnerable: 0,
  shield: 0,
  wake: 0
};

let candies = [];
let shadows = [];
let particles = [];
let ripples = [];
let notices = [];

bestLabel.textContent = best;

function random(min, max) {
  return min + Math.random() * (max - min);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function canvasPoint(event) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (event.clientX - rect.left) * W / rect.width,
    y: (event.clientY - rect.top) * H / rect.height
  };
}

function ensureAudio() {
  if (!audioContext) {
    const AudioCtor = window.AudioContext || window.webkitAudioContext;
    if (AudioCtor) audioContext = new AudioCtor();
  }
  if (audioContext?.state === 'suspended') audioContext.resume();
}

function tone(frequency, duration = .08, type = 'sine', volume = .035, delay = 0) {
  if (!soundOn) return;
  ensureAudio();
  if (!audioContext) return;
  const start = audioContext.currentTime + delay;
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, start);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(volume, start + .012);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  oscillator.connect(gain).connect(audioContext.destination);
  oscillator.start(start);
  oscillator.stop(start + duration + .02);
}

function playCollectSound(rare) {
  if (rare) {
    tone(660, .14, 'sine', .045);
    tone(880, .18, 'sine', .04, .07);
    tone(1175, .22, 'sine', .032, .14);
  } else {
    tone(640 + Math.min(combo, 10) * 24, .09, 'triangle', .035);
  }
}

function playHitSound() {
  tone(125, .22, 'sawtooth', .035);
  tone(90, .28, 'square', .02, .03);
}

function resetPlayer() {
  player.x = W / 2;
  player.y = H * .72;
  player.vx = 0;
  player.vy = 0;
  player.angle = 0;
  player.invulnerable = 0;
  player.shield = 0;
  player.wake = 0;
}

function startGame() {
  ensureAudio();
  state = 'playing';
  elapsed = 0;
  timeLeft = ROUND_TIME;
  score = 0;
  combo = 0;
  comboWindow = 0;
  lives = 3;
  level = 1;
  starTimer = 0;
  shadowTimer = 0;
  dashCooldown = 0;
  dashTimer = 0;
  candies = [];
  shadows = [];
  particles = [];
  ripples = [];
  notices = [];
  resetPlayer();
  for (let i = 0; i < 5; i += 1) spawnCandy(i === 0);
  for (let i = 0; i < 2; i += 1) spawnShadow();
  hideOverlay();
  pauseButton.textContent = '暫停';
  updateHud();
  tone(440, .1, 'sine', .03);
  tone(660, .18, 'sine', .03, .08);
}

function finishGame(reason = 'time') {
  state = 'over';
  const oldBest = best;
  if (score > best) {
    best = score;
    localStorage.setItem('solureMoonlakeBest', String(best));
  }
  bestLabel.textContent = best;
  overlayKicker.textContent = reason === 'lives' ? 'THE MIST GREW DEEP' : 'MOONLIGHT VOYAGE COMPLETE';
  overlayTitle.textContent = score > oldBest ? '新的月光紀錄！' : '小船回到岸邊了';
  overlayText.textContent = `這次收集了 ${score} 分的星星糖，最高連擊倍率到達 x${multiplier() }。月光湖把旅程好好收進了瓶子裡。`;
  startButton.textContent = '再划一次';
  showOverlay();
  tone(392, .16, 'sine', .025);
  tone(523, .2, 'sine', .025, .12);
}

function showOverlay() {
  overlay.classList.remove('hidden');
}

function hideOverlay() {
  overlay.classList.add('hidden');
}

function togglePause() {
  if (state === 'playing') {
    state = 'paused';
    pauseButton.textContent = '繼續';
    overlayKicker.textContent = 'A QUIET MOMENT';
    overlayTitle.textContent = '月光停在湖面上';
    overlayText.textContent = '小企鵝正在船裡休息。準備好後，再讓湖水繼續流動。';
    startButton.textContent = '繼續採星';
    showOverlay();
  } else if (state === 'paused') {
    state = 'playing';
    pauseButton.textContent = '暫停';
    hideOverlay();
  }
}

function multiplier() {
  return Math.min(5, 1 + Math.floor(combo / 3));
}

function safeSpawnPoint(minDistance = 130) {
  let point;
  for (let tries = 0; tries < 40; tries += 1) {
    point = { x: random(70, W - 70), y: random(255, H - 60) };
    if (distance(point, player) > minDistance) return point;
  }
  return point || { x: random(70, W - 70), y: random(255, H - 60) };
}

function spawnCandy(forceNormal = false) {
  const point = safeSpawnPoint(110);
  const rare = !forceNormal && Math.random() < .12;
  candies.push({
    x: point.x,
    y: point.y,
    radius: rare ? 21 : 15,
    rare,
    phase: random(0, Math.PI * 2),
    life: rare ? 10 : 8,
    maxLife: rare ? 10 : 8
  });
}

function spawnShadow() {
  const point = safeSpawnPoint(230);
  const angle = random(0, Math.PI * 2);
  const speed = random(45, 70) + level * 7;
  shadows.push({
    x: point.x,
    y: point.y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    radius: random(24, 34),
    phase: random(0, Math.PI * 2),
    turn: random(-.7, .7)
  });
}

function burst(x, y, colors, amount = 16, speed = 150) {
  for (let i = 0; i < amount; i += 1) {
    const angle = random(0, Math.PI * 2);
    const force = random(speed * .35, speed);
    particles.push({
      x,
      y,
      vx: Math.cos(angle) * force,
      vy: Math.sin(angle) * force,
      life: random(.45, .9),
      maxLife: 1,
      size: random(2, 7),
      color: colors[Math.floor(Math.random() * colors.length)],
      gravity: random(15, 45)
    });
  }
}

function addNotice(text, x, y, color = '#fff3a8') {
  notices.push({ text, x, y, color, life: 1, maxLife: 1 });
}

function collectCandy(candy, index) {
  candies.splice(index, 1);
  combo = comboWindow > 0 ? combo + 1 : 1;
  comboWindow = 2.25;
  const gain = (candy.rare ? 40 : 10) * multiplier();
  score += gain;
  playCollectSound(candy.rare);
  burst(
    candy.x,
    candy.y,
    candy.rare ? ['#f3d1ff', '#bf9bff', '#9bc8ff', '#fff'] : ['#fff3a8', '#ffd86b', '#fffbd7'],
    candy.rare ? 28 : 15,
    candy.rare ? 210 : 145
  );
  ripples.push({ x: candy.x, y: candy.y, radius: 8, life: .8, maxLife: .8, color: candy.rare ? '#d4a8ff' : '#fff2a6' });
  addNotice(candy.rare ? `月光護盾 +${gain}` : `+${gain}`, candy.x, candy.y - 22, candy.rare ? '#efc9ff' : '#fff3a8');
  if (candy.rare) {
    player.shield = Math.max(player.shield, 6);
    navigator.vibrate?.([25, 25, 45]);
  }
  level = 1 + Math.floor(score / 140);
  updateHud();
}

function hitShadow(shadow, index) {
  if (player.shield > 0) {
    shadows.splice(index, 1);
    score += 15;
    burst(shadow.x, shadow.y, ['#e8d2ff', '#a6c8ff', '#ffffff'], 22, 190);
    addNotice('護盾淨化 +15', shadow.x, shadow.y, '#d9c6ff');
    tone(320, .08, 'triangle', .025);
    tone(520, .14, 'sine', .025, .05);
    return;
  }
  if (player.invulnerable > 0) return;
  lives -= 1;
  combo = 0;
  comboWindow = 0;
  player.invulnerable = 1.6;
  player.vx -= shadow.vx * 1.7;
  player.vy -= shadow.vy * 1.7;
  burst(player.x, player.y, ['#ffb5c5', '#d7c7ff', '#ffffff'], 20, 175);
  ripples.push({ x: player.x, y: player.y, radius: 12, life: .9, maxLife: .9, color: '#ffafc5' });
  addNotice('霧影碰到了小船', player.x, player.y - 36, '#ffb8c8');
  playHitSound();
  navigator.vibrate?.(80);
  updateHud();
  if (lives <= 0) finishGame('lives');
}

function triggerDash() {
  if (state !== 'playing' || dashCooldown > 0) return;
  ensureAudio();
  dashTimer = .3;
  dashCooldown = 3;
  const length = Math.hypot(player.vx, player.vy);
  const angle = length > 15 ? Math.atan2(player.vy, player.vx) : player.angle;
  player.vx += Math.cos(angle) * 330;
  player.vy += Math.sin(angle) * 330;
  burst(player.x - Math.cos(angle) * 20, player.y - Math.sin(angle) * 20, ['#d7ebff', '#a9baff', '#ffffff'], 12, 110);
  tone(230, .08, 'sine', .03);
  tone(460, .16, 'triangle', .025, .04);
}

function inputVector() {
  let x = 0;
  let y = 0;
  if (keys.has('ArrowLeft') || keys.has('a') || keys.has('A') || held.left) x -= 1;
  if (keys.has('ArrowRight') || keys.has('d') || keys.has('D') || held.right) x += 1;
  if (keys.has('ArrowUp') || keys.has('w') || keys.has('W') || held.up) y -= 1;
  if (keys.has('ArrowDown') || keys.has('s') || keys.has('S') || held.down) y += 1;

  if (pointerTarget) {
    const dx = pointerTarget.x - player.x;
    const dy = pointerTarget.y - player.y;
    if (Math.hypot(dx, dy) > 18) {
      x += dx / Math.max(1, Math.abs(dx));
      y += dy / Math.max(1, Math.abs(dy));
    }
  }

  const length = Math.hypot(x, y);
  return length > 0 ? { x: x / length, y: y / length } : { x: 0, y: 0 };
}

function update(dt) {
  elapsed += dt;
  skyStars.forEach(star => { star.phase += dt * .8; });
  updateParticles(dt);
  updateRipples(dt);
  updateNotices(dt);
  if (state !== 'playing') return;

  timeLeft = Math.max(0, timeLeft - dt);
  if (timeLeft <= 0) {
    finishGame('time');
    return;
  }

  player.invulnerable = Math.max(0, player.invulnerable - dt);
  player.shield = Math.max(0, player.shield - dt);
  comboWindow = Math.max(0, comboWindow - dt);
  if (comboWindow <= 0) combo = 0;
  dashCooldown = Math.max(0, dashCooldown - dt);
  dashTimer = Math.max(0, dashTimer - dt);

  const input = inputVector();
  const acceleration = dashTimer > 0 ? 1450 : 900;
  player.vx += input.x * acceleration * dt;
  player.vy += input.y * acceleration * dt;

  const drag = Math.pow(input.x || input.y ? .12 : .035, dt);
  player.vx *= drag;
  player.vy *= drag;

  const maxSpeed = dashTimer > 0 ? 560 : 255;
  const speed = Math.hypot(player.vx, player.vy);
  if (speed > maxSpeed) {
    player.vx = player.vx / speed * maxSpeed;
    player.vy = player.vy / speed * maxSpeed;
  }

  player.x = clamp(player.x + player.vx * dt, 38, W - 38);
  player.y = clamp(player.y + player.vy * dt, 252, H - 35);
  if (speed > 8) player.angle = Math.atan2(player.vy, player.vx);
  player.wake += speed * dt * .02;

  starTimer -= dt;
  if (starTimer <= 0 && candies.length < 8) {
    spawnCandy();
    starTimer = Math.max(.42, 1.08 - level * .055) + random(0, .35);
  }

  shadowTimer -= dt;
  const desiredShadows = Math.min(8, 2 + Math.floor(level * .75));
  if (shadowTimer <= 0 && shadows.length < desiredShadows) {
    spawnShadow();
    shadowTimer = Math.max(1.2, 3.3 - level * .16);
  }

  for (let i = candies.length - 1; i >= 0; i -= 1) {
    const candy = candies[i];
    candy.phase += dt * (candy.rare ? 3.6 : 2.4);
    candy.life -= dt;
    if (candy.life <= 0) {
      candies.splice(i, 1);
      continue;
    }
    if (distance(player, candy) < player.radius + candy.radius) collectCandy(candy, i);
  }

  for (let i = shadows.length - 1; i >= 0; i -= 1) {
    const shadow = shadows[i];
    shadow.phase += dt * 2;
    const dx = player.x - shadow.x;
    const dy = player.y - shadow.y;
    const d = Math.max(1, Math.hypot(dx, dy));
    const chase = Math.min(.85, .16 + level * .04);
    shadow.vx += dx / d * chase * 36 * dt;
    shadow.vy += dy / d * chase * 36 * dt;
    const s = Math.hypot(shadow.vx, shadow.vy);
    const shadowMax = 80 + level * 8;
    if (s > shadowMax) {
      shadow.vx = shadow.vx / s * shadowMax;
      shadow.vy = shadow.vy / s * shadowMax;
    }
    shadow.x += shadow.vx * dt;
    shadow.y += shadow.vy * dt;
    if (shadow.x < 25 || shadow.x > W - 25) shadow.vx *= -1;
    if (shadow.y < 245 || shadow.y > H - 25) shadow.vy *= -1;
    shadow.x = clamp(shadow.x, 25, W - 25);
    shadow.y = clamp(shadow.y, 245, H - 25);
    if (distance(player, shadow) < player.radius + shadow.radius * .72) hitShadow(shadow, i);
  }

  if (speed > 50 && Math.random() < dt * 9) {
    ripples.push({
      x: player.x - Math.cos(player.angle) * 27,
      y: player.y - Math.sin(player.angle) * 16,
      radius: 4,
      life: .55,
      maxLife: .55,
      color: '#b9d7ff'
    });
  }

  updateHud();
}

function updateParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i -= 1) {
    const p = particles[i];
    p.life -= dt;
    if (p.life <= 0) {
      particles.splice(i, 1);
      continue;
    }
    p.vy += p.gravity * dt;
    p.vx *= Math.pow(.18, dt);
    p.vy *= Math.pow(.3, dt);
    p.x += p.vx * dt;
    p.y += p.vy * dt;
  }
}

function updateRipples(dt) {
  for (let i = ripples.length - 1; i >= 0; i -= 1) {
    const ripple = ripples[i];
    ripple.life -= dt;
    ripple.radius += dt * 48;
    if (ripple.life <= 0) ripples.splice(i, 1);
  }
}

function updateNotices(dt) {
  for (let i = notices.length - 1; i >= 0; i -= 1) {
    const notice = notices[i];
    notice.life -= dt;
    notice.y -= dt * 32;
    if (notice.life <= 0) notices.splice(i, 1);
  }
}

function updateHud() {
  scoreLabel.textContent = score;
  comboLabel.textContent = `x${multiplier()}`;
  timeLabel.textContent = Math.ceil(timeLeft);
  livesLabel.textContent = '♥'.repeat(Math.max(0, lives)) || '·';
  bestLabel.textContent = Math.max(best, score);
  dashButton.classList.toggle('cooldown', dashCooldown > 0);
  dashButton.textContent = dashCooldown > 0 ? `衝刺 ${dashCooldown.toFixed(1)}` : '月光衝刺';
}

function draw() {
  drawBackground();
  drawRipples();
  drawCandies();
  drawShadows();
  drawPlayer();
  drawParticles();
  drawNotices();
  drawCanvasHud();
}

function drawBackground() {
  const sky = ctx.createLinearGradient(0, 0, 0, 300);
  sky.addColorStop(0, '#171a45');
  sky.addColorStop(1, '#38457c');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);

  for (const star of skyStars) {
    const alpha = .35 + Math.sin(star.phase) * .25;
    ctx.fillStyle = `rgba(245,239,255,${alpha})`;
    circle(star.x, star.y, star.size);
  }

  const moonGlow = ctx.createRadialGradient(760, 105, 8, 760, 105, 92);
  moonGlow.addColorStop(0, 'rgba(255,250,216,.9)');
  moonGlow.addColorStop(.2, 'rgba(255,247,208,.42)');
  moonGlow.addColorStop(1, 'rgba(255,247,208,0)');
  ctx.fillStyle = moonGlow;
  circle(760, 105, 92);
  ctx.fillStyle = '#fff5cb';
  circle(760, 105, 38);
  ctx.fillStyle = 'rgba(193,184,219,.32)';
  circle(746, 94, 8);
  circle(771, 113, 5);

  ctx.fillStyle = '#202a55';
  polygon([[0,245],[115,172],[220,235],[338,150],[455,236],[585,176],[710,240],[830,165],[960,232],[960,310],[0,310]]);
  ctx.fillStyle = '#172345';
  polygon([[0,275],[155,220],[300,286],[470,214],[625,285],[790,218],[960,270],[960,330],[0,330]]);

  const lake = ctx.createLinearGradient(0, 235, 0, H);
  lake.addColorStop(0, '#293f72');
  lake.addColorStop(.5, '#152b59');
  lake.addColorStop(1, '#0d2047');
  ctx.fillStyle = lake;
  ctx.fillRect(0, 235, W, H - 235);

  const moonPath = ctx.createLinearGradient(0, 240, 0, H);
  moonPath.addColorStop(0, 'rgba(255,244,199,.22)');
  moonPath.addColorStop(1, 'rgba(165,188,255,0)');
  ctx.fillStyle = moonPath;
  polygon([[704,235],[816,235],[900,H],[560,H]]);

  ctx.strokeStyle = 'rgba(196,219,255,.15)';
  ctx.lineWidth = 2;
  for (let row = 0; row < 12; row += 1) {
    const y = 255 + row * 31;
    const offset = Math.sin(elapsed * .7 + row) * 24;
    for (let x = -70; x < W + 70; x += 150) {
      ctx.beginPath();
      ctx.ellipse(x + offset, y, 54, 8, 0, 0, Math.PI);
      ctx.stroke();
    }
  }

  drawIsland(90, 318, .8);
  drawIsland(875, 370, .66);
}

function drawIsland(x, y, scale) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.fillStyle = 'rgba(8,16,39,.35)';
  ellipse(0, 19, 75, 20);
  ctx.fillStyle = '#26354d';
  ellipse(0, 0, 68, 25);
  ctx.fillStyle = '#394b55';
  ellipse(-8, -8, 52, 18);
  ctx.fillStyle = '#557063';
  circle(-22, -28, 23);
  circle(12, -23, 28);
  ctx.restore();
}

function drawCandies() {
  for (const candy of candies) {
    const remaining = clamp(candy.life / candy.maxLife, 0, 1);
    const blink = remaining < .28 ? .35 + Math.sin(elapsed * 18) * .3 : 1;
    const pulse = 1 + Math.sin(candy.phase) * .12;
    ctx.save();
    ctx.globalAlpha = blink;
    ctx.translate(candy.x, candy.y + Math.sin(candy.phase) * 5);
    ctx.scale(pulse, pulse);
    ctx.shadowBlur = candy.rare ? 28 : 18;
    ctx.shadowColor = candy.rare ? '#d9a6ff' : '#ffe58b';
    ctx.fillStyle = candy.rare ? '#dba8ff' : '#ffe98f';
    starPath(0, 0, candy.radius, candy.radius * .46, 5);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.78)';
    circle(-candy.radius * .18, -candy.radius * .22, candy.radius * .14);
    if (candy.rare) {
      ctx.strokeStyle = 'rgba(239,221,255,.72)';
      ctx.lineWidth = 2;
      circleStroke(0, 0, candy.radius + 7 + Math.sin(candy.phase) * 2);
    }
    ctx.restore();
  }
}

function drawShadows() {
  for (const shadow of shadows) {
    ctx.save();
    ctx.translate(shadow.x, shadow.y + Math.sin(shadow.phase) * 5);
    ctx.rotate(Math.atan2(shadow.vy, shadow.vx));
    ctx.globalAlpha = .68;
    ctx.shadowBlur = 22;
    ctx.shadowColor = '#6e76bb';
    const fog = ctx.createRadialGradient(0, 0, 4, 0, 0, shadow.radius * 1.5);
    fog.addColorStop(0, 'rgba(71,67,118,.92)');
    fog.addColorStop(.55, 'rgba(38,38,84,.65)');
    fog.addColorStop(1, 'rgba(25,27,65,0)');
    ctx.fillStyle = fog;
    ellipse(0, 0, shadow.radius * 1.7, shadow.radius);
    ctx.fillStyle = 'rgba(12,16,42,.82)';
    ellipse(0, 2, shadow.radius, shadow.radius * .6);
    ctx.fillStyle = '#cfc7ff';
    circle(shadow.radius * .35, -5, 2.6);
    circle(shadow.radius * .35, 7, 2.6);
    ctx.restore();
  }
}

function drawPlayer() {
  const blink = player.invulnerable > 0 && Math.floor(player.invulnerable * 12) % 2 === 0;
  if (blink) return;
  ctx.save();
  ctx.translate(player.x, player.y);
  ctx.rotate(player.angle);

  ctx.fillStyle = 'rgba(5,12,35,.35)';
  ellipse(-4, 16, 43, 14);

  if (player.shield > 0) {
    ctx.save();
    ctx.rotate(-player.angle);
    ctx.strokeStyle = `rgba(217,190,255,${.45 + Math.sin(elapsed * 5) * .18})`;
    ctx.lineWidth = 4;
    ctx.shadowBlur = 18;
    ctx.shadowColor = '#cba7ff';
    circleStroke(0, 0, 43 + Math.sin(elapsed * 4) * 3);
    ctx.restore();
  }

  ctx.fillStyle = '#8e5d4d';
  ctx.beginPath();
  ctx.moveTo(36, 0);
  ctx.quadraticCurveTo(16, 24, -32, 18);
  ctx.quadraticCurveTo(-40, 0, -32, -18);
  ctx.quadraticCurveTo(16, -24, 36, 0);
  ctx.fill();
  ctx.strokeStyle = '#d5a06f';
  ctx.lineWidth = 4;
  ctx.stroke();

  ctx.fillStyle = '#f1c889';
  ctx.beginPath();
  ctx.moveTo(18, 0);
  ctx.quadraticCurveTo(4, 12, -26, 10);
  ctx.quadraticCurveTo(-31, 0, -26, -10);
  ctx.quadraticCurveTo(4, -12, 18, 0);
  ctx.fill();

  ctx.save();
  ctx.translate(-3, -10);
  ctx.rotate(-player.angle);
  ctx.fillStyle = '#171b34';
  ellipse(0, 0, 16, 19);
  ctx.fillStyle = '#fff7ec';
  ellipse(3, 3, 11, 13);
  ctx.fillStyle = '#26243b';
  circle(7, -3, 2.1);
  ctx.fillStyle = '#efb767';
  ctx.beginPath();
  ctx.moveTo(13, 0);
  ctx.lineTo(22, 4);
  ctx.lineTo(13, 7);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  ctx.strokeStyle = '#e7c38c';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(-3, 1);
  ctx.lineTo(-31, 28);
  ctx.stroke();
  ctx.fillStyle = '#d59d65';
  ellipse(-35, 31, 13, 5);
  ctx.restore();
}

function drawRipples() {
  for (const ripple of ripples) {
    ctx.save();
    ctx.globalAlpha = clamp(ripple.life / ripple.maxLife, 0, 1) * .7;
    ctx.strokeStyle = ripple.color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(ripple.x, ripple.y, ripple.radius * 1.65, ripple.radius * .55, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}

function drawParticles() {
  for (const p of particles) {
    ctx.save();
    ctx.globalAlpha = clamp(p.life / p.maxLife, 0, 1);
    ctx.fillStyle = p.color;
    ctx.shadowBlur = 8;
    ctx.shadowColor = p.color;
    circle(p.x, p.y, p.size);
    ctx.restore();
  }
}

function drawNotices() {
  for (const notice of notices) {
    ctx.save();
    ctx.globalAlpha = clamp(notice.life / notice.maxLife, 0, 1);
    ctx.fillStyle = notice.color;
    ctx.font = '800 20px "Microsoft JhengHei", sans-serif';
    ctx.textAlign = 'center';
    ctx.shadowBlur = 8;
    ctx.shadowColor = notice.color;
    ctx.fillText(notice.text, notice.x, notice.y);
    ctx.restore();
  }
}

function drawCanvasHud() {
  ctx.save();
  ctx.fillStyle = 'rgba(9,14,38,.48)';
  roundRect(18, 18, 190, 42, 16);
  ctx.fill();
  ctx.fillStyle = '#ddd5ff';
  ctx.font = '700 17px "Microsoft JhengHei", sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`第 ${level} 層月光`, 34, 45);

  if (player.shield > 0) {
    ctx.fillStyle = 'rgba(9,14,38,.48)';
    roundRect(W - 220, 18, 202, 42, 16);
    ctx.fill();
    ctx.fillStyle = '#efd2ff';
    ctx.textAlign = 'right';
    ctx.fillText(`護盾 ${player.shield.toFixed(1)} 秒`, W - 34, 45);
  }
  ctx.restore();
}

function circle(x, y, radius) {
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
}

function circleStroke(x, y, radius) {
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.stroke();
}

function ellipse(x, y, radiusX, radiusY) {
  ctx.beginPath();
  ctx.ellipse(x, y, radiusX, radiusY, 0, 0, Math.PI * 2);
  ctx.fill();
}

function polygon(points) {
  ctx.beginPath();
  ctx.moveTo(points[0][0], points[0][1]);
  points.slice(1).forEach(([x, y]) => ctx.lineTo(x, y));
  ctx.closePath();
  ctx.fill();
}

function roundRect(x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + width, y, x + width, y + height, radius);
  ctx.arcTo(x + width, y + height, x, y + height, radius);
  ctx.arcTo(x, y + height, x, y, radius);
  ctx.arcTo(x, y, x + width, y, radius);
  ctx.closePath();
}

function starPath(x, y, outer, inner, points) {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i += 1) {
    const radius = i % 2 === 0 ? outer : inner;
    const angle = -Math.PI / 2 + i * Math.PI / points;
    const px = x + Math.cos(angle) * radius;
    const py = y + Math.sin(angle) * radius;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

startButton.addEventListener('click', () => {
  if (state === 'paused') togglePause();
  else startGame();
});

pauseButton.addEventListener('click', togglePause);

dashButton.addEventListener('click', triggerDash);

soundButton.addEventListener('click', () => {
  soundOn = !soundOn;
  soundButton.textContent = `音效：${soundOn ? '開' : '關'}`;
  soundButton.setAttribute('aria-pressed', String(soundOn));
  if (soundOn) tone(660, .1, 'sine', .025);
});

window.addEventListener('keydown', event => {
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(event.key)) event.preventDefault();
  keys.add(event.key);
  if (event.key === ' ') triggerDash();
  if (event.key === 'Escape' || event.key === 'p' || event.key === 'P') togglePause();
});

window.addEventListener('keyup', event => keys.delete(event.key));

canvas.addEventListener('pointerdown', event => {
  pointerDown = true;
  pointerTarget = canvasPoint(event);
  canvas.setPointerCapture(event.pointerId);
  ensureAudio();
});

canvas.addEventListener('pointermove', event => {
  if (pointerDown) pointerTarget = canvasPoint(event);
});

canvas.addEventListener('pointerup', event => {
  pointerDown = false;
  pointerTarget = null;
  canvas.releasePointerCapture(event.pointerId);
});

canvas.addEventListener('pointercancel', () => {
  pointerDown = false;
  pointerTarget = null;
});

for (const button of moveButtons) {
  const direction = button.dataset.dir;
  const press = event => {
    event.preventDefault();
    held[direction] = true;
    button.classList.add('active');
    ensureAudio();
  };
  const release = event => {
    event.preventDefault();
    held[direction] = false;
    button.classList.remove('active');
  };
  button.addEventListener('pointerdown', press);
  button.addEventListener('pointerup', release);
  button.addEventListener('pointercancel', release);
  button.addEventListener('pointerleave', release);
}

window.addEventListener('blur', () => {
  keys.clear();
  Object.keys(held).forEach(key => { held[key] = false; });
  if (state === 'playing') togglePause();
});

function frame(now) {
  const dt = Math.min(.04, (now - lastTime) / 1000 || 0);
  lastTime = now;
  update(dt);
  draw();
  requestAnimationFrame(frame);
}

updateHud();
requestAnimationFrame(frame);
