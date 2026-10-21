const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreEl = document.getElementById('score');
const levelEl = document.getElementById('level');
const healthFill = document.getElementById('healthFill');
const levelUpModal = document.getElementById('levelUpModal');
const upgradesEl = document.getElementById('upgrades');
const gameOverEl = document.getElementById('gameOver');
const finalScoreEl = document.getElementById('finalScore');
const restartBtn = document.getElementById('restartBtn');
const iphoneOnly = document.getElementById('iphoneOnly');

// iPhone check
const isIphone = /iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
if (!isIphone) {
  iphoneOnly.classList.remove('hidden');
  canvas.style.display = 'none';
} else {
  iphoneOnly.classList.add('hidden');
}

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
resize();
window.addEventListener('resize', resize);

// Game state
let player = {
  x: canvas.width / 2,
  y: canvas.height / 2,
  radius: 15,
  speed: 3,
  health: 100,
  maxHealth: 100,
  damage: 10,
  fireRate: 0.6,
  lastFire: 0,
  xp: 0,
  level: 1,
  xpToNext: 40,
  projectileCount: 1,
  projectileSpeed: 8,
  pickupRange: 80,
  area: 1
};

let weapons = {
  projectile: { level: 1, enabled: true },
  orbit: { level: 0, enabled: false, angle: 0, radius: 40, damageTimer: 0 },
  spread: { level: 0, enabled: false }
};

let enemies = [];
let projectiles = [];
let xpOrbs = [];
let score = 0;
let startTime = Date.now();
let gameRunning = true;
let levelUpPending = false;

// Joystick
const joystick = {
  baseX: 80,
  baseY: canvas.height - 80,
  radius: 50,
  knobX: 80,
  knobY: canvas.height - 80,
  active: false,
  dx: 0,
  dy: 0
};

function updateJoystickPos() {
  joystick.baseY = canvas.height - 80;
  if (!joystick.active) {
    joystick.knobX = joystick.baseX;
    joystick.knobY = joystick.baseY;
  }
}

// Touch handling
canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
canvas.addEventListener('touchend', handleTouchEnd, { passive: false });

function handleTouchStart(e) {
  e.preventDefault();
  const touch = e.touches[0];
  const rect = canvas.getBoundingClientRect();
  const x = touch.clientX - rect.left;
  const y = touch.clientY - rect.top;
  const dist = Math.hypot(x - joystick.baseX, y - joystick.baseY);
  if (dist < joystick.radius * 1.5) {
    joystick.active = true;
    updateKnob(x, y);
  }
}

function handleTouchMove(e) {
  e.preventDefault();
  if (!joystick.active) return;
  const touch = e.touches[0];
  const rect = canvas.getBoundingClientRect();
  const x = touch.clientX - rect.left;
  const y = touch.clientY - rect.top;
  updateKnob(x, y);
}

function handleTouchEnd(e) {
  e.preventDefault();
  joystick.active = false;
  joystick.dx = 0;
  joystick.dy = 0;
  joystick.knobX = joystick.baseX;
  joystick.knobY = joystick.baseY;
}

function updateKnob(x, y) {
  const dx = x - joystick.baseX;
  const dy = y - joystick.baseY;
  const dist = Math.hypot(dx, dy);
  const maxDist = joystick.radius;
  if (dist > maxDist) {
    const angle = Math.atan2(dy, dx);
    joystick.knobX = joystick.baseX + Math.cos(angle) * maxDist;
    joystick.knobY = joystick.baseY + Math.sin(angle) * maxDist;
  } else {
    joystick.knobX = x;
    joystick.knobY = y;
  }
  joystick.dx = (joystick.knobX - joystick.baseX) / maxDist;
  joystick.dy = (joystick.knobY - joystick.baseY) / maxDist;
}

// Spawn enemies
let spawnTimer = 0;
function spawnEnemy() {
  const side = Math.floor(Math.random() * 4);
  let x, y;
  if (side === 0) { x = Math.random() * canvas.width; y = -20; }
  else if (side === 1) { x = canvas.width + 20; y = Math.random() * canvas.height; }
  else if (side === 2) { x = Math.random() * canvas.width; y = canvas.height + 20; }
  else { x = -20; y = Math.random() * canvas.height; }
  const baseHp = 20 + player.level * 6;
  enemies.push({
    x, y,
    radius: 12,
    speed: 0.8 + Math.random() * 0.4,
    health: baseHp,
    maxHealth: baseHp
  });
}

function nearestEnemy() {
  let nearest = null;
  let minDist = Infinity;
  for (const e of enemies) {
    const d = Math.hypot(e.x - player.x, e.y - player.y);
    if (d < minDist) {
      minDist = d;
      nearest = e;
    }
  }
  return nearest;
}

function shootProjectiles() {
  if (!weapons.projectile.enabled) return;
  const target = nearestEnemy();
  if (!target) return;
  const baseAngle = Math.atan2(target.y - player.y, target.x - player.x);
  const count = player.projectileCount;
  const spread = weapons.spread.enabled ? 0.4 : 0.15;
  for (let i = 0; i < count; i++) {
    const offset = (i - (count - 1) / 2) * spread;
    const angle = baseAngle + offset;
    projectiles.push({
      x: player.x,
      y: player.y,
      vx: Math.cos(angle) * player.projectileSpeed,
      vy: Math.sin(angle) * player.projectileSpeed,
      damage: player.damage * (1 + (weapons.projectile.level - 1) * 0.2),
      radius: 4 + weapons.projectile.level
    });
  }
}

function updateOrbit(dt) {
  if (!weapons.orbit.enabled) return;
  weapons.orbit.angle += dt * 2;
  weapons.orbit.damageTimer += dt;
  const orbitRadius = weapons.orbit.radius * player.area;
  if (weapons.orbit.damageTimer > 0.25) {
    weapons.orbit.damageTimer = 0;
    for (const e of enemies) {
      const d = Math.hypot(e.x - player.x, e.y - player.y);
      if (d < orbitRadius + e.radius) {
        e.health -= player.damage * 0.4 * weapons.orbit.level;
      }
    }
  }
}

function update(dt) {
  if (!gameRunning || levelUpPending) return;

  // Move player
  player.x += joystick.dx * player.speed;
  player.y += joystick.dy * player.speed;
  player.x = Math.max(player.radius, Math.min(canvas.width - player.radius, player.x));
  player.y = Math.max(player.radius, Math.min(canvas.height - player.radius, player.y));

  // Auto fire
  player.lastFire += dt;
  if (player.lastFire >= player.fireRate) {
    shootProjectiles();
    player.lastFire = 0;
  }

  updateOrbit(dt);

  // Projectiles
  for (let i = projectiles.length - 1; i >= 0; i--) {
    const p = projectiles[i];
    p.x += p.vx;
    p.y += p.vy;
    if (p.x < -50 || p.x > canvas.width + 50 || p.y < -50 || p.y > canvas.height + 50) {
      projectiles.splice(i, 1);
      continue;
    }
    for (let j = enemies.length - 1; j >= 0; j--) {
      const e = enemies[j];
      if (Math.hypot(p.x - e.x, p.y - e.y) < p.radius + e.radius) {
        e.health -= p.damage;
        projectiles.splice(i, 1);
        if (e.health <= 0) {
          xpOrbs.push({ x: e.x, y: e.y, value: 8 + player.level * 2, radius: 6 });
          enemies.splice(j, 1);
          score += 10;
        }
        break;
      }
    }
  }

  // Enemies
  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i];
    const angle = Math.atan2(player.y - e.y, player.x - e.x);
    e.x += Math.cos(angle) * e.speed;
    e.y += Math.sin(angle) * e.speed;
    if (Math.hypot(e.x - player.x, e.y - player.y) < e.radius + player.radius) {
      player.health -= 8;
      enemies.splice(i, 1);
      if (player.health <= 0) gameOver();
    }
  }

  // XP orbs
  for (let i = xpOrbs.length - 1; i >= 0; i--) {
    const o = xpOrbs[i];
    const d = Math.hypot(o.x - player.x, o.y - player.y);
    if (d < player.pickupRange) {
      const angle = Math.atan2(player.y - o.y, player.x - o.x);
      o.x += Math.cos(angle) * 5;
      o.y += Math.sin(angle) * 5;
    }
    if (d < player.radius + o.radius) {
      player.xp += o.value;
      xpOrbs.splice(i, 1);
      checkLevelUp();
    }
  }

  // Spawn
  spawnTimer += dt;
  const spawnInterval = Math.max(0.35, 1.8 - player.level * 0.08);
  if (spawnTimer > spawnInterval) {
    spawnEnemy();
    if (player.level > 5 && Math.random() < 0.3) spawnEnemy();
    spawnTimer = 0;
  }

  score = Math.floor((Date.now() - startTime) / 100);
  updateUI();
}

function checkLevelUp() {
  if (player.xp >= player.xpToNext) {
    player.xp -= player.xpToNext;
    player.level++;
    player.xpToNext = Math.floor(player.xpToNext * 1.35);
    showLevelUp();
  }
}

function showLevelUp() {
  levelUpPending = true;
  levelUpModal.classList.remove('hidden');
  upgradesEl.innerHTML = '';

  const options = [];

  // Stat bonuses
  options.push({ text: 'Schaden +20%', apply: () => { player.damage *= 1.2; } });
  options.push({ text: 'Angriffsgeschw. +15%', apply: () => { player.fireRate = Math.max(0.18, player.fireRate * 0.85); } });
  options.push({ text: 'Bewegung +15%', apply: () => { player.speed *= 1.15; } });
  options.push({ text: 'Max Leben +25', apply: () => { player.maxHealth += 25; player.health = Math.min(player.health + 25, player.maxHealth); } });
  options.push({ text: 'Projektil-Anzahl +1', apply: () => { player.projectileCount = Math.min(player.projectileCount + 1, 6); } });
  options.push({ text: 'Pickup-Range +30%', apply: () => { player.pickupRange *= 1.3; } });
  options.push({ text: 'Area +20%', apply: () => { player.area *= 1.2; } });

  // Weapons
  if (!weapons.orbit.enabled) {
    options.push({ text: 'Orbit-Waffe freischalten', apply: () => { weapons.orbit.enabled = true; weapons.orbit.level = 1; } });
  } else {
    options.push({ text: 'Orbit Level +1', apply: () => { weapons.orbit.level++; weapons.orbit.radius += 8; } });
  }

  if (!weapons.spread.enabled && weapons.projectile.level >= 1) {
    options.push({ text: 'Spread-Shot freischalten', apply: () => { weapons.spread.enabled = true; } });
  }

  options.push({ text: 'Projektil Level +1', apply: () => { weapons.projectile.level++; } });

  // Shuffle and pick 3
  options.sort(() => Math.random() - 0.5);
  const chosen = options.slice(0, 3);

  for (const opt of chosen) {
    const btn = document.createElement('button');
    btn.textContent = opt.text;
    btn.onclick = () => {
      opt.apply();
      levelUpModal.classList.add('hidden');
      levelUpPending = false;
    };
    upgradesEl.appendChild(btn);
  }
}

function updateUI() {
  scoreEl.textContent = 'Score: ' + score;
  levelEl.textContent = 'Level: ' + player.level;
  const pct = Math.max(0, (player.health / player.maxHealth) * 100);
  healthFill.style.width = pct + '%';
  healthFill.style.background = pct > 50 ? '#4caf50' : pct > 25 ? '#ff9800' : '#f44336';
}

function gameOver() {
  gameRunning = false;
  finalScoreEl.textContent = score;
  gameOverEl.classList.remove('hidden');
}

restartBtn.onclick = () => {
  player = {
    x: canvas.width / 2,
    y: canvas.height / 2,
    radius: 15,
    speed: 3,
    health: 100,
    maxHealth: 100,
    damage: 10,
    fireRate: 0.6,
    lastFire: 0,
    xp: 0,
    level: 1,
    xpToNext: 40,
    projectileCount: 1,
    projectileSpeed: 8,
    pickupRange: 80,
    area: 1
  };
  weapons = {
    projectile: { level: 1, enabled: true },
    orbit: { level: 0, enabled: false, angle: 0, radius: 40, damageTimer: 0 },
    spread: { level: 0, enabled: false }
  };
  enemies = [];
  projectiles = [];
  xpOrbs = [];
  score = 0;
  startTime = Date.now();
  gameRunning = true;
  levelUpPending = false;
  gameOverEl.classList.add('hidden');
  levelUpModal.classList.add('hidden');
};

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // XP orbs
  ctx.fillStyle = '#00ff00';
  for (const o of xpOrbs) {
    ctx.beginPath();
    ctx.arc(o.x, o.y, o.radius, 0, Math.PI * 2);
    ctx.fill();
  }

  // Orbit visual
  if (weapons.orbit.enabled) {
    ctx.strokeStyle = 'rgba(100,200,255,0.6)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(player.x, player.y, weapons.orbit.radius * player.area, 0, Math.PI * 2);
    ctx.stroke();
    // small orbiting dots
    const r = weapons.orbit.radius * player.area;
    for (let i = 0; i < 4; i++) {
      const a = weapons.orbit.angle + (i * Math.PI / 2);
      ctx.fillStyle = '#88ccff';
      ctx.beginPath();
      ctx.arc(player.x + Math.cos(a) * r, player.y + Math.sin(a) * r, 6, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Enemies
  for (const e of enemies) {
    ctx.fillStyle = '#ff4444';
    ctx.beginPath();
    ctx.arc(e.x, e.y, e.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#333';
    ctx.fillRect(e.x - 15, e.y - e.radius - 8, 30, 4);
    ctx.fillStyle = '#4caf50';
    ctx.fillRect(e.x - 15, e.y - e.radius - 8, 30 * Math.max(0, e.health / e.maxHealth), 4);
  }

  // Projectiles
  ctx.fillStyle = '#ffff00';
  for (const p of projectiles) {
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
    ctx.fill();
  }

  // Player
  ctx.fillStyle = '#2196f3';
  ctx.beginPath();
  ctx.arc(player.x, player.y, player.radius, 0, Math.PI * 2);
  ctx.fill();

  // Joystick
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(joystick.baseX, joystick.baseY, joystick.radius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.beginPath();
  ctx.arc(joystick.knobX, joystick.knobY, 20, 0, Math.PI * 2);
  ctx.fill();
}

let lastTime = performance.now();
function loop(now) {
  const dt = Math.min((now - lastTime) / 1000, 0.05);
  lastTime = now;
  updateJoystickPos();
  update(dt);
  draw();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
