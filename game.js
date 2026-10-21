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

let player = {
  x: canvas.width / 2,
  y: canvas.height / 2,
  radius: 15,
  speed: 3,
  health: 100,
  maxHealth: 100,
  damage: 10,
  fireRate: 0.65,
  lastFire: 0,
  xp: 0,
  level: 1,
  xpToNext: 40,
  projectileCount: 1,
  projectileSpeed: 8,
  pickupRange: 90,
  area: 1,
  critChance: 0.05
};

let weapons = {
  projectile: { level: 1, enabled: true, evolved: false },
  orbit: { level: 0, enabled: false, angle: 0, radius: 45, damageTimer: 0, evolved: false },
  spread: { level: 0, enabled: false, evolved: false },
  lightning: { level: 0, enabled: false, timer: 0, evolved: false },
  aura: { level: 0, enabled: false, timer: 0, evolved: false }
};

let enemies = [];
let projectiles = [];
let xpOrbs = [];
let score = 0;
let startTime = Date.now();
let gameRunning = true;
let levelUpPending = false;

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

let spawnTimer = 0;
function spawnEnemy() {
  const side = Math.floor(Math.random() * 4);
  let x, y;
  if (side === 0) { x = Math.random() * canvas.width; y = -20; }
  else if (side === 1) { x = canvas.width + 20; y = Math.random() * canvas.height; }
  else if (side === 2) { x = Math.random() * canvas.width; y = canvas.height + 20; }
  else { x = -20; y = Math.random() * canvas.height; }
  const baseHp = 18 + player.level * 7;
  enemies.push({
    x, y,
    radius: 12,
    speed: 0.75 + Math.random() * 0.4,
    health: baseHp,
    maxHealth: baseHp
  });
}

function nearestEnemy() {
  let nearest = null;
  let minDist = Infinity;
  for (const e of enemies) {
    const d = Math.hypot(e.x - player.x, e.y - player.y);
    if (d < minDist) { minDist = d; nearest = e; }
  }
  return nearest;
}

function shootProjectiles() {
  if (!weapons.projectile.enabled) return;
  const target = nearestEnemy();
  if (!target) return;
  const baseAngle = Math.atan2(target.y - player.y, target.x - player.x);
  const count = player.projectileCount;
  const spread = weapons.spread.enabled ? 0.45 : 0.12;
  const dmgMult = weapons.projectile.evolved ? 2.2 : (1 + (weapons.projectile.level - 1) * 0.18);
  for (let i = 0; i < count; i++) {
    const offset = (i - (count - 1) / 2) * spread;
    const angle = baseAngle + offset;
    projectiles.push({
      x: player.x,
      y: player.y,
      vx: Math.cos(angle) * player.projectileSpeed,
      vy: Math.sin(angle) * player.projectileSpeed,
      damage: player.damage * dmgMult,
      radius: weapons.projectile.evolved ? 7 : 4 + Math.min(weapons.projectile.level, 4),
      piercing: weapons.projectile.evolved ? 3 : 0,
      hits: 0
    });
  }
}

function updateOrbit(dt) {
  if (!weapons.orbit.enabled) return;
  weapons.orbit.angle += dt * (weapons.orbit.evolved ? 3.5 : 2.2);
  weapons.orbit.damageTimer += dt;
  const orbitRadius = weapons.orbit.radius * player.area * (weapons.orbit.evolved ? 1.4 : 1);
  const interval = weapons.orbit.evolved ? 0.15 : 0.28;
  if (weapons.orbit.damageTimer > interval) {
    weapons.orbit.damageTimer = 0;
    const dmg = player.damage * 0.35 * weapons.orbit.level * (weapons.orbit.evolved ? 1.8 : 1);
    for (const e of enemies) {
      const d = Math.hypot(e.x - player.x, e.y - player.y);
      if (d < orbitRadius + e.radius) e.health -= dmg;
    }
  }
}

function updateLightning(dt) {
  if (!weapons.lightning.enabled) return;
  weapons.lightning.timer += dt;
  const interval = weapons.lightning.evolved ? 0.8 : 1.4;
  if (weapons.lightning.timer > interval) {
    weapons.lightning.timer = 0;
    const targets = enemies.slice().sort((a, b) => 
      Math.hypot(a.x - player.x, a.y - player.y) - Math.hypot(b.x - player.x, b.y - player.y)
    ).slice(0, weapons.lightning.evolved ? 5 : 2 + weapons.lightning.level);
    for (const e of targets) {
      e.health -= player.damage * (weapons.lightning.evolved ? 1.6 : 0.9) * weapons.lightning.level;
    }
  }
}

function updateAura(dt) {
  if (!weapons.aura.enabled) return;
  weapons.aura.timer += dt;
  if (weapons.aura.timer > 0.4) {
    weapons.aura.timer = 0;
    const rad = 55 * player.area * (weapons.aura.evolved ? 1.6 : 1);
    const dmg = player.damage * 0.25 * weapons.aura.level * (weapons.aura.evolved ? 2 : 1);
    for (const e of enemies) {
      if (Math.hypot(e.x - player.x, e.y - player.y) < rad) e.health -= dmg;
    }
  }
}

function update(dt) {
  if (!gameRunning || levelUpPending) return;

  player.x += joystick.dx * player.speed;
  player.y += joystick.dy * player.speed;
  player.x = Math.max(player.radius, Math.min(canvas.width - player.radius, player.x));
  player.y = Math.max(player.radius, Math.min(canvas.height - player.radius, player.y));

  player.lastFire += dt;
  if (player.lastFire >= player.fireRate) {
    shootProjectiles();
    player.lastFire = 0;
  }

  updateOrbit(dt);
  updateLightning(dt);
  updateAura(dt);

  for (let i = projectiles.length - 1; i >= 0; i--) {
    const p = projectiles[i];
    p.x += p.vx;
    p.y += p.vy;
    if (p.x < -60 || p.x > canvas.width + 60 || p.y < -60 || p.y > canvas.height + 60) {
      projectiles.splice(i, 1);
      continue;
    }
    for (let j = enemies.length - 1; j >= 0; j--) {
      const e = enemies[j];
      if (Math.hypot(p.x - e.x, p.y - e.y) < p.radius + e.radius) {
        e.health -= p.damage;
        p.hits = (p.hits || 0) + 1;
        if (p.hits > (p.piercing || 0)) projectiles.splice(i, 1);
        if (e.health <= 0) {
          xpOrbs.push({ x: e.x, y: e.y, value: 8 + player.level * 2, radius: 6 });
          enemies.splice(j, 1);
          score += 10;
        }
        if (p.hits > (p.piercing || 0)) break;
      }
    }
  }

  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i];
    const angle = Math.atan2(player.y - e.y, player.x - e.x);
    e.x += Math.cos(angle) * e.speed;
    e.y += Math.sin(angle) * e.speed;
    if (Math.hypot(e.x - player.x, e.y - player.y) < e.radius + player.radius) {
      player.health -= 7;
      enemies.splice(i, 1);
      if (player.health <= 0) gameOver();
    }
  }

  for (let i = xpOrbs.length - 1; i >= 0; i--) {
    const o = xpOrbs[i];
    const d = Math.hypot(o.x - player.x, o.y - player.y);
    if (d < player.pickupRange) {
      const angle = Math.atan2(player.y - o.y, player.x - o.x);
      o.x += Math.cos(angle) * 5.5;
      o.y += Math.sin(angle) * 5.5;
    }
    if (d < player.radius + o.radius) {
      player.xp += o.value;
      xpOrbs.splice(i, 1);
      checkLevelUp();
    }
  }

  spawnTimer += dt;
  const spawnInterval = Math.max(0.32, 1.7 - player.level * 0.07);
  if (spawnTimer > spawnInterval) {
    spawnEnemy();
    if (player.level > 4 && Math.random() < 0.35) spawnEnemy();
    spawnTimer = 0;
  }

  score = Math.floor((Date.now() - startTime) / 100);
  updateUI();
}

function checkLevelUp() {
  if (player.xp >= player.xpToNext) {
    player.xp -= player.xpToNext;
    player.level++;
    player.xpToNext = Math.floor(player.xpToNext * 1.32);
    showLevelUp();
  }
}

function canEvolve(weaponKey) {
  const w = weapons[weaponKey];
  if (!w.enabled || w.evolved || w.level < 5) return false;
  if (weaponKey === 'projectile' && player.damage >= 25) return true;
  if (weaponKey === 'orbit' && player.area >= 1.8) return true;
  if (weaponKey === 'lightning' && player.critChance >= 0.2) return true;
  if (weaponKey === 'aura' && player.area >= 1.6) return true;
  return false;
}

function showLevelUp() {
  levelUpPending = true;
  levelUpModal.classList.remove('hidden');
  upgradesEl.innerHTML = '';

  const options = [];

  // Evolutions (priority)
  if (canEvolve('projectile')) {
    options.push({ text: '✨ Projektil → Laser (Evolution)', apply: () => { weapons.projectile.evolved = true; } });
  }
  if (canEvolve('orbit')) {
    options.push({ text: '✨ Orbit → Blades (Evolution)', apply: () => { weapons.orbit.evolved = true; } });
  }
  if (canEvolve('lightning')) {
    options.push({ text: '✨ Lightning → Storm (Evolution)', apply: () => { weapons.lightning.evolved = true; } });
  }
  if (canEvolve('aura')) {
    options.push({ text: '✨ Aura → Nova (Evolution)', apply: () => { weapons.aura.evolved = true; } });
  }

  // Stats
  options.push({ text: 'Schaden +20%', apply: () => { player.damage *= 1.2; } });
  options.push({ text: 'Angriffsgeschw. +12%', apply: () => { player.fireRate = Math.max(0.16, player.fireRate * 0.88); } });
  options.push({ text: 'Bewegung +12%', apply: () => { player.speed *= 1.12; } });
  options.push({ text: 'Max Leben +30', apply: () => { player.maxHealth += 30; player.health = Math.min(player.health + 30, player.maxHealth); } });
  options.push({ text: 'Projektil-Anzahl +1', apply: () => { player.projectileCount = Math.min(player.projectileCount + 1, 7); } });
  options.push({ text: 'Pickup-Range +25%', apply: () => { player.pickupRange *= 1.25; } });
  options.push({ text: 'Area +18%', apply: () => { player.area *= 1.18; } });
  options.push({ text: 'Crit Chance +5%', apply: () => { player.critChance = Math.min(0.4, player.critChance + 0.05); } });

  // Unlock / level weapons
  if (!weapons.orbit.enabled) options.push({ text: 'Orbit freischalten', apply: () => { weapons.orbit.enabled = true; weapons.orbit.level = 1; } });
  else if (weapons.orbit.level < 8) options.push({ text: 'Orbit Level +1', apply: () => { weapons.orbit.level++; weapons.orbit.radius += 6; } });

  if (!weapons.lightning.enabled) options.push({ text: 'Lightning freischalten', apply: () => { weapons.lightning.enabled = true; weapons.lightning.level = 1; } });
  else if (weapons.lightning.level < 6) options.push({ text: 'Lightning Level +1', apply: () => { weapons.lightning.level++; } });

  if (!weapons.aura.enabled) options.push({ text: 'Aura freischalten', apply: () => { weapons.aura.enabled = true; weapons.aura.level = 1; } });
  else if (weapons.aura.level < 6) options.push({ text: 'Aura Level +1', apply: () => { weapons.aura.level++; } });

  if (!weapons.spread.enabled) options.push({ text: 'Spread-Shot freischalten', apply: () => { weapons.spread.enabled = true; } });

  if (weapons.projectile.level < 8) options.push({ text: 'Projektil Level +1', apply: () => { weapons.projectile.level++; } });

  options.sort(() => Math.random() - 0.5);
  // Prefer evolutions if available
  const evo = options.filter(o => o.text.includes('✨'));
  const rest = options.filter(o => !o.text.includes('✨'));
  const chosen = [...evo.slice(0, 1), ...rest].slice(0, 3);

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
    fireRate: 0.65,
    lastFire: 0,
    xp: 0,
    level: 1,
    xpToNext: 40,
    projectileCount: 1,
    projectileSpeed: 8,
    pickupRange: 90,
    area: 1,
    critChance: 0.05
  };
  weapons = {
    projectile: { level: 1, enabled: true, evolved: false },
    orbit: { level: 0, enabled: false, angle: 0, radius: 45, damageTimer: 0, evolved: false },
    spread: { level: 0, enabled: false, evolved: false },
    lightning: { level: 0, enabled: false, timer: 0, evolved: false },
    aura: { level: 0, enabled: false, timer: 0, evolved: false }
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

  ctx.fillStyle = '#00ff00';
  for (const o of xpOrbs) {
    ctx.beginPath();
    ctx.arc(o.x, o.y, o.radius, 0, Math.PI * 2);
    ctx.fill();
  }

  if (weapons.orbit.enabled) {
    const r = weapons.orbit.radius * player.area * (weapons.orbit.evolved ? 1.4 : 1);
    ctx.strokeStyle = weapons.orbit.evolved ? 'rgba(255,180,50,0.8)' : 'rgba(100,200,255,0.6)';
    ctx.lineWidth = weapons.orbit.evolved ? 4 : 3;
    ctx.beginPath();
    ctx.arc(player.x, player.y, r, 0, Math.PI * 2);
    ctx.stroke();
    const dots = weapons.orbit.evolved ? 6 : 4;
    for (let i = 0; i < dots; i++) {
      const a = weapons.orbit.angle + (i * Math.PI * 2 / dots);
      ctx.fillStyle = weapons.orbit.evolved ? '#ffaa33' : '#88ccff';
      ctx.beginPath();
      ctx.arc(player.x + Math.cos(a) * r, player.y + Math.sin(a) * r, weapons.orbit.evolved ? 8 : 6, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  if (weapons.aura.enabled) {
    const rad = 55 * player.area * (weapons.aura.evolved ? 1.6 : 1);
    ctx.fillStyle = weapons.aura.evolved ? 'rgba(255,80,80,0.15)' : 'rgba(80,255,120,0.12)';
    ctx.beginPath();
    ctx.arc(player.x, player.y, rad, 0, Math.PI * 2);
    ctx.fill();
  }

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

  ctx.fillStyle = weapons.projectile.evolved ? '#ff66ff' : '#ffff00';
  for (const p of projectiles) {
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = '#2196f3';
  ctx.beginPath();
  ctx.arc(player.x, player.y, player.radius, 0, Math.PI * 2);
  ctx.fill();

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
