const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreEl = document.getElementById('score');
const levelEl = document.getElementById('level');
const highscoreEl = document.getElementById('highscore');
const healthFill = document.getElementById('healthFill');
const xpFill = document.getElementById('xpFill');
const xpText = document.getElementById('xpText');
const levelUpModal = document.getElementById('levelUpModal');
const upgradesEl = document.getElementById('upgrades');
const gameOverEl = document.getElementById('gameOver');
const finalScoreEl = document.getElementById('finalScore');
const newHighscoreEl = document.getElementById('newHighscore');
const bestScoreDisplay = document.getElementById('bestScoreDisplay');
const restartBtn = document.getElementById('restartBtn');
const pauseBtn = document.getElementById('pauseBtn');
const pauseMenu = document.getElementById('pauseMenu');
const resumeBtn = document.getElementById('resumeBtn');
const restartFromPauseBtn = document.getElementById('restartFromPauseBtn');
const chestModal = document.getElementById('chestModal');
const chestCountEl = document.getElementById('chestCount');
const chestRewards = document.getElementById('chestRewards');
const chestCloseBtn = document.getElementById('chestCloseBtn');
const weaponSelect = document.getElementById('weaponSelect');
const ui = document.getElementById('ui');
const iphoneOnly = document.getElementById('iphoneOnly');

const isIphone = /iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
if (!isIphone) {
  iphoneOnly.classList.remove('hidden');
  canvas.style.display = 'none';
  weaponSelect.classList.add('hidden');
} else {
  iphoneOnly.classList.add('hidden');
}

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
resize();
window.addEventListener('resize', resize);

let highscore = parseInt(localStorage.getItem('iphoneSurvivorHighscore') || '0');
let startingWeapon = 'pistole';
let gameStarted = false;

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
  xpToNext: 30,
  projectileCount: 1,
  projectileSpeed: 8,
  pickupRange: 90,
  area: 1,
  critChance: 0.05
};

let weapons = {
  pistole: { level: 1, enabled: true, evolved: false },
  shotgun: { level: 0, enabled: false, evolved: false },
  katana: { level: 0, enabled: false, angle: 0, timer: 0, slashTimer: 0, evolved: false },
  orbit: { level: 0, enabled: false, angle: 0, radius: 45, damageTimer: 0, evolved: false },
  lightning: { level: 0, enabled: false, timer: 0, evolved: false },
  aura: { level: 0, enabled: false, timer: 0, evolved: false },
  boomerang: { level: 0, enabled: false, timer: 0, evolved: false },
  magnet: { level: 0, enabled: false, evolved: false },
  mine: { level: 0, enabled: false, timer: 0, evolved: false },
  laser: { level: 0, enabled: false, timer: 0, evolved: false },
  freeze: { level: 0, enabled: false, timer: 0, evolved: false }
};

let enemies = [];
let projectiles = [];
let boomerangs = [];
let mines = [];
let xpOrbs = [];
let particles = [];
let damageNumbers = [];
let score = 0;
let startTime = Date.now();
let gameRunning = false;
let levelUpPending = false;
let paused = false;
let bossTimer = 0;
let bossCount = 0;
let chestPending = false;

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
  if (paused || levelUpPending || chestPending || !gameStarted) return;
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
  if (!joystick.active || paused) return;
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

function spawnParticles(x, y, color, count = 8) {
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 1 + Math.random() * 3;
    particles.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 0.6 + Math.random() * 0.4,
      maxLife: 1,
      radius: 2 + Math.random() * 3,
      color
    });
  }
}

function spawnDamageNumber(x, y, amount) {
  if (amount < 1) return;
  damageNumbers.push({
    x: x + (Math.random() - 0.5) * 12,
    y: y - 10,
    value: Math.round(amount),
    life: 0.8,
    vy: -40
  });
}

function getXpValue(type) {
  if (type === 'fast') return 15 + player.level * 3;
  if (type === 'tank') return 26 + player.level * 4;
  if (type === 'boss') return 70 + player.level * 8;
  return 12 + player.level * 2;
}

function killDeadEnemies() {
  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i];
    if (e.health <= 0) {
      spawnParticles(e.x, e.y, e.color || '#ff4444', e.isBoss ? 25 : 12);
      if (e.isBoss) {
        xpOrbs.push({ x: e.x, y: e.y, value: 0, radius: 14, isChest: true });
      } else {
        xpOrbs.push({ x: e.x, y: e.y, value: getXpValue(e.type), radius: 6 });
      }
      score += e.isBoss ? 150 : (e.type === 'tank' ? 20 : e.type === 'fast' ? 15 : 10);
      enemies.splice(i, 1);
    }
  }
}

function getEvolveHint(key) {
  if (!weapons[key] || !weapons[key].enabled || weapons[key].evolved) return '';
  if (key === 'pistole') return 'Evo mit: Schaden 28+';
  if (key === 'shotgun') return 'Evo mit: Area 1.8+';
  if (key === 'katana') return 'Evo mit: Area 1.7+';
  if (key === 'orbit') return 'Evo mit: Area 2.0+';
  if (key === 'lightning') return 'Evo mit: Crit 20%+';
  if (key === 'aura') return 'Evo mit: Area 1.8+';
  if (key === 'boomerang') return 'Evo mit: Area 1.6+';
  if (key === 'magnet') return 'Evo mit: Pickup 160+';
  if (key === 'mine') return 'Evo mit: Projektil 5+';
  if (key === 'laser') return 'Evo mit: Angriffsspeed hoch';
  if (key === 'freeze') return 'Evo mit: Crit 25%+';
  return '';
}

function updateUI() {
  scoreEl.textContent = 'Score: ' + score;
  levelEl.textContent = 'Level: ' + player.level;
  highscoreEl.textContent = 'Best: ' + highscore;
  const pct = Math.max(0, (player.health / player.maxHealth) * 100);
  healthFill.style.width = pct + '%';
  healthFill.style.background = pct > 50 ? '#4caf50' : pct > 25 ? '#ff9800' : '#f44336';

  const xpPct = Math.min(100, (player.xp / Math.max(1, player.xpToNext)) * 100);
  xpFill.style.width = xpPct + '%';
  xpText.textContent = 'XP: ' + Math.floor(player.xp) + ' / ' + player.xpToNext;
}

function applyStartingWeapon(key) {
  startingWeapon = key;
  for (const k in weapons) {
    weapons[k].enabled = false;
    weapons[k].level = 0;
    weapons[k].evolved = false;
  }
  weapons[key].enabled = true;
  weapons[key].level = 1;
}

function startGame() {
  gameStarted = true;
  gameRunning = true;
  weaponSelect.classList.add('hidden');
  ui.classList.remove('hidden');
  pauseBtn.classList.remove('hidden');
  startTime = Date.now();
  updateUI();
}

document.querySelectorAll('.weaponBtn').forEach(btn => {
  btn.addEventListener('click', () => {
    const w = btn.getAttribute('data-weapon');
    applyStartingWeapon(w);
    startGame();
  });
});

let spawnTimer = 0;
function spawnEnemy(type = 'normal') {
  const side = Math.floor(Math.random() * 4);
  let x, y;
  if (side === 0) { x = Math.random() * canvas.width; y = -30; }
  else if (side === 1) { x = canvas.width + 30; y = Math.random() * canvas.height; }
  else if (side === 2) { x = Math.random() * canvas.width; y = canvas.height + 30; }
  else { x = -30; y = Math.random() * canvas.height; }

  let enemy = { x, y, type, slowTimer: 0 };
  if (type === 'fast') {
    enemy.radius = 9;
    enemy.speed = 1.4 + Math.random() * 0.4;
    enemy.health = 12 + player.level * 4;
    enemy.maxHealth = enemy.health;
    enemy.color = '#ff9800';
    enemy.damage = 6;
  } else if (type === 'tank') {
    enemy.radius = 18;
    enemy.speed = 0.45 + Math.random() * 0.15;
    enemy.health = 50 + player.level * 15;
    enemy.maxHealth = enemy.health;
    enemy.color = '#9c27b0';
    enemy.damage = 12;
  } else if (type === 'boss') {
    enemy.radius = 28;
    enemy.speed = 0.55;
    enemy.health = 200 + bossCount * 120 + player.level * 20;
    enemy.maxHealth = enemy.health;
    enemy.color = '#d32f2f';
    enemy.damage = 18;
    enemy.isBoss = true;
  } else {
    enemy.radius = 12;
    enemy.speed = 0.75 + Math.random() * 0.35;
    enemy.health = 18 + player.level * 7;
    enemy.maxHealth = enemy.health;
    enemy.color = '#ff4444';
    enemy.damage = 8;
  }
  enemies.push(enemy);
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

function shootPistole() {
  if (!weapons.pistole.enabled) return;
  const target = nearestEnemy();
  if (!target) return;
  const angle = Math.atan2(target.y - player.y, target.x - player.x);
  const dmg = player.damage * (weapons.pistole.evolved ? 2.4 : 1 + (weapons.pistole.level - 1) * 0.2);
  projectiles.push({
    x: player.x,
    y: player.y,
    vx: Math.cos(angle) * player.projectileSpeed,
    vy: Math.sin(angle) * player.projectileSpeed,
    damage: dmg,
    radius: weapons.pistole.evolved ? 7 : 4,
    piercing: weapons.pistole.evolved ? 4 : 0,
    hits: 0
  });
}

function shootShotgun() {
  if (!weapons.shotgun.enabled) return;
  const target = nearestEnemy();
  if (!target) return;
  const baseAngle = Math.atan2(target.y - player.y, target.x - player.x);
  const pellets = 5 + Math.floor(weapons.shotgun.level / 1.5);
  const spread = 0.75;
  const baseDmg = player.damage * 0.22 * (weapons.shotgun.evolved ? 1.6 : 1);
  for (let i = 0; i < pellets; i++) {
    const offset = (i - (pellets - 1) / 2) * (spread / Math.max(1, pellets - 1));
    const angle = baseAngle + offset;
    projectiles.push({
      x: player.x,
      y: player.y,
      vx: Math.cos(angle) * (player.projectileSpeed * 0.75),
      vy: Math.sin(angle) * (player.projectileSpeed * 0.75),
      damage: baseDmg,
      radius: 3,
      piercing: 0,
      hits: 0,
      life: 0.28,
      isShotgun: true
    });
  }
}

function updateKatana(dt) {
  if (!weapons.katana.enabled) return;
  weapons.katana.timer += dt;
  const cooldown = weapons.katana.evolved ? 0.45 : 0.7;
  if (weapons.katana.timer < cooldown) {
    weapons.katana.slashTimer = Math.max(0, weapons.katana.slashTimer - dt);
    return;
  }
  const target = nearestEnemy();
  if (!target) return;
  const range = 70 * player.area * (weapons.katana.evolved ? 1.4 : 1);
  const distToTarget = Math.hypot(target.x - player.x, target.y - player.y);
  if (distToTarget > range) return;
  const lookAngle = Math.atan2(target.y - player.y, target.x - player.x);
  const arc = 0.9 + weapons.katana.level * 0.12;
  const dmg = player.damage * 0.85 * weapons.katana.level * (weapons.katana.evolved ? 1.7 : 1);
  let hit = false;
  for (const e of enemies) {
    const d = Math.hypot(e.x - player.x, e.y - player.y);
    if (d > range) continue;
    const angleToEnemy = Math.atan2(e.y - player.y, e.x - player.x);
    let diff = Math.abs(angleToEnemy - lookAngle);
    if (diff > Math.PI) diff = Math.PI * 2 - diff;
    if (diff < arc / 2) {
      e.health -= dmg;
      spawnDamageNumber(e.x, e.y, dmg);
      hit = true;
    }
  }
  if (hit) {
    weapons.katana.timer = 0;
    weapons.katana.angle = lookAngle;
    weapons.katana.slashTimer = 0.18;
  }
}

function updateOrbit(dt) {
  if (!weapons.orbit.enabled) return;
  weapons.orbit.angle += dt * (weapons.orbit.evolved ? 4 : 2.4);
  weapons.orbit.damageTimer += dt;
  const orbitRadius = weapons.orbit.radius * Math.pow(player.area, 0.85) * (weapons.orbit.evolved ? 1.5 : 1);
  const interval = weapons.orbit.evolved ? 0.12 : 0.25;
  if (weapons.orbit.damageTimer > interval) {
    weapons.orbit.damageTimer = 0;
    const dmg = player.damage * 0.4 * weapons.orbit.level * (weapons.orbit.evolved ? 2 : 1);
    for (const e of enemies) {
      const d = Math.hypot(e.x - player.x, e.y - player.y);
      if (d < orbitRadius + e.radius) {
        e.health -= dmg;
        spawnDamageNumber(e.x, e.y, dmg);
      }
    }
  }
}

function updateLightning(dt) {
  if (!weapons.lightning.enabled) return;
  weapons.lightning.timer += dt;
  const interval = weapons.lightning.evolved ? 0.7 : 1.3;
  if (weapons.lightning.timer > interval) {
    weapons.lightning.timer = 0;
    const maxTargets = weapons.lightning.evolved ? 6 : 3 + weapons.lightning.level;
    const targets = enemies.slice().sort((a, b) => 
      Math.hypot(a.x - player.x, a.y - player.y) - Math.hypot(b.x - player.x, b.y - player.y)
    ).slice(0, maxTargets);
    const dmg = player.damage * (weapons.lightning.evolved ? 1.8 : 1.0) * weapons.lightning.level;
    for (const e of targets) {
      e.health -= dmg;
      spawnDamageNumber(e.x, e.y, dmg);
    }
  }
}

function updateAura(dt) {
  if (!weapons.aura.enabled) return;
  weapons.aura.timer += dt;
  if (weapons.aura.timer > 0.35) {
    weapons.aura.timer = 0;
    const rad = 60 * Math.pow(player.area, 0.85) * (weapons.aura.evolved ? 1.7 : 1);
    const dmg = player.damage * 0.3 * weapons.aura.level * (weapons.aura.evolved ? 2.2 : 1);
    for (const e of enemies) {
      if (Math.hypot(e.x - player.x, e.y - player.y) < rad) {
        e.health -= dmg;
        spawnDamageNumber(e.x, e.y, dmg);
      }
    }
  }
}

function updateBoomerang(dt) {
  if (!weapons.boomerang.enabled) return;
  weapons.boomerang.timer += dt;
  const interval = weapons.boomerang.evolved ? 1.2 : 1.8;
  if (weapons.boomerang.timer > interval) {
    weapons.boomerang.timer = 0;
    const count = 1 + Math.floor(weapons.boomerang.level / 2);
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count;
      boomerangs.push({
        x: player.x,
        y: player.y,
        angle,
        dist: 0,
        maxDist: 120 + weapons.boomerang.level * 20,
        returning: false,
        damage: player.damage * (weapons.boomerang.evolved ? 1.6 : 0.9) * weapons.boomerang.level,
        radius: 8
      });
    }
  }
  for (let i = boomerangs.length - 1; i >= 0; i--) {
    const b = boomerangs[i];
    const speed = weapons.boomerang.evolved ? 180 : 140;
    if (!b.returning) {
      b.dist += speed * dt;
      if (b.dist >= b.maxDist) b.returning = true;
    } else {
      b.dist -= speed * dt;
      if (b.dist <= 0) {
        boomerangs.splice(i, 1);
        continue;
      }
    }
    b.x = player.x + Math.cos(b.angle) * b.dist;
    b.y = player.y + Math.sin(b.angle) * b.dist;
    for (const e of enemies) {
      if (Math.hypot(b.x - e.x, b.y - e.y) < b.radius + e.radius) {
        const tickDmg = b.damage * dt * 4;
        e.health -= tickDmg;
        if (Math.random() < 0.3) spawnDamageNumber(e.x, e.y, tickDmg);
      }
    }
  }
}

function updateMine(dt) {
  if (!weapons.mine.enabled) return;
  weapons.mine.timer += dt;
  const interval = weapons.mine.evolved ? 1.8 : 2.6;
  if (weapons.mine.timer > interval) {
    weapons.mine.timer = 0;
    const count = 1 + Math.floor(player.projectileCount / 2);
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = 40 + Math.random() * 50;
      mines.push({
        x: player.x + Math.cos(angle) * dist,
        y: player.y + Math.sin(angle) * dist,
        radius: 8,
        life: 8,
        damage: player.damage * 1.4 * weapons.mine.level * (weapons.mine.evolved ? 1.6 : 1)
      });
    }
  }
  for (let i = mines.length - 1; i >= 0; i--) {
    const m = mines[i];
    m.life -= dt;
    if (m.life <= 0) {
      mines.splice(i, 1);
      continue;
    }
    for (const e of enemies) {
      if (Math.hypot(m.x - e.x, m.y - e.y) < m.radius + e.radius + 4) {
        e.health -= m.damage;
        spawnDamageNumber(e.x, e.y, m.damage);
        spawnParticles(m.x, m.y, '#ff8800', 12);
        mines.splice(i, 1);
        break;
      }
    }
  }
}

function updateLaser(dt) {
  if (!weapons.laser.enabled) return;
  weapons.laser.timer += dt;
  const interval = Math.max(0.12, 0.45 - (1 - player.fireRate) * 0.4);
  if (weapons.laser.timer > interval) {
    weapons.laser.timer = 0;
    const target = nearestEnemy();
    if (!target) return;
    const dmg = player.damage * 0.35 * weapons.laser.level * (weapons.laser.evolved ? 1.8 : 1);
    target.health -= dmg;
    spawnDamageNumber(target.x, target.y, dmg);
    // visual beam
    particles.push({
      x: (player.x + target.x) / 2,
      y: (player.y + target.y) / 2,
      vx: 0, vy: 0,
      life: 0.12,
      maxLife: 0.12,
      radius: 3,
      color: weapons.laser.evolved ? '#ff4444' : '#44ff88'
    });
  }
}

function updateFreeze(dt) {
  if (!weapons.freeze.enabled) return;
  weapons.freeze.timer += dt;
  const interval = weapons.freeze.evolved ? 1.4 : 2.2;
  if (weapons.freeze.timer > interval) {
    weapons.freeze.timer = 0;
    const rad = 90 * Math.pow(player.area, 0.7);
    const slowDuration = 1.2 + player.critChance * 4;
    for (const e of enemies) {
      if (Math.hypot(e.x - player.x, e.y - player.y) < rad) {
        e.slowTimer = Math.max(e.slowTimer || 0, slowDuration);
        if (Math.random() < 0.3) spawnDamageNumber(e.x, e.y, 1);
      }
    }
    spawnParticles(player.x, player.y, '#88ccff', 16);
  }
}

function updateMagnet() {
  if (!weapons.magnet.enabled) {
    player.pickupRange = 90;
    return;
  }
  const base = 90;
  const bonus = weapons.magnet.level * 35 * (weapons.magnet.evolved ? 1.5 : 1);
  player.pickupRange = base + bonus;
}

function updateParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.life -= dt;
    if (p.life <= 0) particles.splice(i, 1);
  }
}

function updateDamageNumbers(dt) {
  for (let i = damageNumbers.length - 1; i >= 0; i--) {
    const d = damageNumbers[i];
    d.y += d.vy * dt;
    d.life -= dt;
    if (d.life <= 0) damageNumbers.splice(i, 1);
  }
}

function openChest() {
  chestPending = true;
  const counts = [1, 3, 5];
  const count = counts[Math.floor(Math.random() * counts.length)];
  chestCountEl.textContent = count;
  chestRewards.innerHTML = '';

  const possible = [
    { text: '💪 Schaden +15%', apply: () => { player.damage *= 1.15; } },
    { text: '⚡ Angriffsgeschw. +10%', apply: () => { player.fireRate = Math.max(0.14, player.fireRate * 0.9); } },
    { text: '🏃 Bewegung +10%', apply: () => { player.speed *= 1.1; } },
    { text: '❤️ Max Leben +25', apply: () => { player.maxHealth += 25; player.health = Math.min(player.health + 25, player.maxHealth); } },
    { text: '🔫 Projektil-Anzahl +1', apply: () => { player.projectileCount = Math.min(player.projectileCount + 1, 8); } },
    { text: '💥 Area +12%', apply: () => { player.area *= 1.12; } },
    { text: '✨ Crit Chance +4%', apply: () => { player.critChance = Math.min(0.45, player.critChance + 0.04); } },
    { text: '🧲 Pickup-Range +20%', apply: () => { player.pickupRange *= 1.2; } }
  ];

  const chosen = [];
  for (let i = 0; i < count; i++) {
    const opt = possible[Math.floor(Math.random() * possible.length)];
    opt.apply();
    chosen.push(opt.text);
  }

  chestRewards.innerHTML = chosen.map(t => '• ' + t).join('<br>');
  chestModal.classList.remove('hidden');
}

chestCloseBtn.onclick = () => {
  chestModal.classList.add('hidden');
  chestPending = false;
};

function update(dt) {
  if (!gameRunning || levelUpPending || paused || chestPending) return;

  player.x += joystick.dx * player.speed;
  player.y += joystick.dy * player.speed;
  player.x = Math.max(player.radius, Math.min(canvas.width - player.radius, player.x));
  player.y = Math.max(player.radius, Math.min(canvas.height - player.radius, player.y));

  player.lastFire += dt;
  if (player.lastFire >= player.fireRate) {
    if (weapons.pistole.enabled) shootPistole();
    if (weapons.shotgun.enabled) shootShotgun();
    player.lastFire = 0;
  }

  updateKatana(dt);
  updateOrbit(dt);
  updateLightning(dt);
  updateAura(dt);
  updateBoomerang(dt);
  updateMine(dt);
  updateLaser(dt);
  updateFreeze(dt);
  updateMagnet();
  updateParticles(dt);
  updateDamageNumbers(dt);

  killDeadEnemies();

  for (let i = projectiles.length - 1; i >= 0; i--) {
    const p = projectiles[i];
    p.x += p.vx;
    p.y += p.vy;
    if (p.life !== undefined) {
      p.life -= dt;
      if (p.life <= 0) {
        projectiles.splice(i, 1);
        continue;
      }
    }
    if (p.x < -60 || p.x > canvas.width + 60 || p.y < -60 || p.y > canvas.height + 60) {
      projectiles.splice(i, 1);
      continue;
    }
    for (let j = enemies.length - 1; j >= 0; j--) {
      const e = enemies[j];
      if (Math.hypot(p.x - e.x, p.y - e.y) < p.radius + e.radius) {
        let dmg = p.damage;
        if (p.isShotgun) {
          const dist = Math.hypot(e.x - player.x, e.y - player.y);
          const falloff = Math.max(0.25, 1.6 - dist / 90);
          dmg *= falloff;
        }
        e.health -= dmg;
        spawnDamageNumber(e.x, e.y, dmg);
        p.hits = (p.hits || 0) + 1;
        if (p.hits > (p.piercing || 0)) projectiles.splice(i, 1);
        if (p.hits > (p.piercing || 0)) break;
      }
    }
  }

  killDeadEnemies();

  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i];
    if (e.slowTimer > 0) e.slowTimer -= dt;
    const speedMult = e.slowTimer > 0 ? 0.35 : 1;
    const angle = Math.atan2(player.y - e.y, player.x - e.x);
    e.x += Math.cos(angle) * e.speed * speedMult;
    e.y += Math.sin(angle) * e.speed * speedMult;
    if (Math.hypot(e.x - player.x, e.y - player.y) < e.radius + player.radius) {
      player.health -= e.damage || 8;
      spawnParticles(player.x, player.y, '#ff0000', 6);
      enemies.splice(i, 1);
      if (player.health <= 0) gameOver();
    }
  }

  const pullSpeed = weapons.magnet.enabled ? 8 + weapons.magnet.level * 1.5 : 5.5;
  let xpChanged = false;
  for (let i = xpOrbs.length - 1; i >= 0; i--) {
    const o = xpOrbs[i];
    const d = Math.hypot(o.x - player.x, o.y - player.y);
    if (d < player.pickupRange) {
      const angle = Math.atan2(player.y - o.y, player.x - o.x);
      o.x += Math.cos(angle) * pullSpeed;
      o.y += Math.sin(angle) * pullSpeed;
    }
    if (d < player.radius + o.radius + (o.isChest ? 8 : 0)) {
      if (o.isChest) {
        openChest();
      } else {
        player.xp += o.value;
        xpChanged = true;
        checkLevelUp();
      }
      xpOrbs.splice(i, 1);
    }
  }
  if (xpChanged) updateUI();

  spawnTimer += dt;
  const spawnInterval = Math.max(0.28, 1.6 - player.level * 0.06);
  if (spawnTimer > spawnInterval) {
    const r = Math.random();
    if (r < 0.15 && player.level >= 3) spawnEnemy('fast');
    else if (r < 0.25 && player.level >= 5) spawnEnemy('tank');
    else spawnEnemy('normal');
    if (player.level > 6 && Math.random() < 0.3) spawnEnemy();
    spawnTimer = 0;
  }

  bossTimer += dt;
  if (bossTimer > 75) {
    spawnEnemy('boss');
    bossCount++;
    bossTimer = 0;
  }

  score = Math.floor((Date.now() - startTime) / 100);
  updateUI();
}

function checkLevelUp() {
  if (player.xp >= player.xpToNext) {
    player.xp -= player.xpToNext;
    player.level++;
    player.xpToNext = Math.floor(player.xpToNext * 1.28);
    showLevelUp();
    updateUI();
  }
}

function canEvolve(weaponKey) {
  const w = weapons[weaponKey];
  if (!w.enabled || w.evolved || w.level < 5) return false;
  if (weaponKey === 'pistole' && player.damage >= 28) return true;
  if (weaponKey === 'shotgun' && player.area >= 1.8) return true;
  if (weaponKey === 'katana' && player.area >= 1.7) return true;
  if (weaponKey === 'orbit' && player.area >= 2.0) return true;
  if (weaponKey === 'lightning' && player.critChance >= 0.20) return true;
  if (weaponKey === 'aura' && player.area >= 1.8) return true;
  if (weaponKey === 'boomerang' && player.area >= 1.6) return true;
  if (weaponKey === 'magnet' && player.pickupRange >= 160) return true;
  if (weaponKey === 'mine' && player.projectileCount >= 5) return true;
  if (weaponKey === 'laser' && player.fireRate <= 0.35) return true;
  if (weaponKey === 'freeze' && player.critChance >= 0.25) return true;
  return false;
}

function showLevelUp() {
  levelUpPending = true;
  levelUpModal.classList.remove('hidden');
  upgradesEl.innerHTML = '';

  const options = [];

  if (canEvolve('pistole')) options.push({ text: '✨🔫 Pistole → Magnum', apply: () => { weapons.pistole.evolved = true; } });
  if (canEvolve('shotgun')) options.push({ text: '✨💥 Shotgun → Boomstick', apply: () => { weapons.shotgun.evolved = true; } });
  if (canEvolve('katana')) options.push({ text: '✨⚔️ Katana → Excalibur', apply: () => { weapons.katana.evolved = true; } });
  if (canEvolve('orbit')) options.push({ text: '✨🔁 Orbit → Blades', apply: () => { weapons.orbit.evolved = true; } });
  if (canEvolve('lightning')) options.push({ text: '✨⚡ Lightning → Storm', apply: () => { weapons.lightning.evolved = true; } });
  if (canEvolve('aura')) options.push({ text: '✨💠 Aura → Nova', apply: () => { weapons.aura.evolved = true; } });
  if (canEvolve('boomerang')) options.push({ text: '✨🔄 Boomerang → Cyclone', apply: () => { weapons.boomerang.evolved = true; } });
  if (canEvolve('magnet')) options.push({ text: '✨🧲 Magnet → Black Hole', apply: () => { weapons.magnet.evolved = true; } });
  if (canEvolve('mine')) options.push({ text: '✨💣 Mine → Cluster', apply: () => { weapons.mine.evolved = true; } });
  if (canEvolve('laser')) options.push({ text: '✨🔪 Laser → Beam', apply: () => { weapons.laser.evolved = true; } });
  if (canEvolve('freeze')) options.push({ text: '✨❄️ Freeze → Blizzard', apply: () => { weapons.freeze.evolved = true; } });

  options.push({ text: '💪 Schaden +20%', apply: () => { player.damage *= 1.2; } });
  options.push({ text: '⚡ Angriffsgeschw. +12%', apply: () => { player.fireRate = Math.max(0.15, player.fireRate * 0.88); } });
  options.push({ text: '🏃 Bewegung +12%', apply: () => { player.speed *= 1.12; } });
  options.push({ text: '❤️ Max Leben +30', apply: () => { player.maxHealth += 30; player.health = Math.min(player.health + 30, player.maxHealth); } });
  options.push({ text: '🔫 Projektil-Anzahl +1', apply: () => { player.projectileCount = Math.min(player.projectileCount + 1, 7); } });
  options.push({ text: '🧲 Pickup-Range +25%', apply: () => { player.pickupRange *= 1.25; } });
  options.push({ text: '💥 Area +14%', apply: () => { player.area *= 1.14; } });
  options.push({ text: '✨ Crit Chance +5%', apply: () => { player.critChance = Math.min(0.4, player.critChance + 0.05); } });

  if (!weapons.orbit.enabled) options.push({ text: '🔁 Orbit freischalten', apply: () => { weapons.orbit.enabled = true; weapons.orbit.level = 1; } });
  else if (weapons.orbit.level < 8) options.push({ text: '🔁 Orbit Level +1', hint: getEvolveHint('orbit'), apply: () => { weapons.orbit.level++; weapons.orbit.radius += 6; } });

  if (!weapons.lightning.enabled) options.push({ text: '⚡ Lightning freischalten', apply: () => { weapons.lightning.enabled = true; weapons.lightning.level = 1; } });
  else if (weapons.lightning.level < 6) options.push({ text: '⚡ Lightning Level +1', hint: getEvolveHint('lightning'), apply: () => { weapons.lightning.level++; } });

  if (!weapons.aura.enabled) options.push({ text: '💠 Aura freischalten', apply: () => { weapons.aura.enabled = true; weapons.aura.level = 1; } });
  else if (weapons.aura.level < 6) options.push({ text: '💠 Aura Level +1', hint: getEvolveHint('aura'), apply: () => { weapons.aura.level++; } });

  if (!weapons.boomerang.enabled) options.push({ text: '🔄 Boomerang freischalten', apply: () => { weapons.boomerang.enabled = true; weapons.boomerang.level = 1; } });
  else if (weapons.boomerang.level < 6) options.push({ text: '🔄 Boomerang Level +1', hint: getEvolveHint('boomerang'), apply: () => { weapons.boomerang.level++; } });

  if (!weapons.magnet.enabled) options.push({ text: '🧲 Magnet freischalten', apply: () => { weapons.magnet.enabled = true; weapons.magnet.level = 1; } });
  else if (weapons.magnet.level < 5) options.push({ text: '🧲 Magnet Level +1', hint: getEvolveHint('magnet'), apply: () => { weapons.magnet.level++; } });

  if (!weapons.mine.enabled) options.push({ text: '💣 Mine freischalten', apply: () => { weapons.mine.enabled = true; weapons.mine.level = 1; } });
  else if (weapons.mine.level < 6) options.push({ text: '💣 Mine Level +1', hint: getEvolveHint('mine'), apply: () => { weapons.mine.level++; } });

  if (!weapons.laser.enabled) options.push({ text: '🔪 Laser freischalten', apply: () => { weapons.laser.enabled = true; weapons.laser.level = 1; } });
  else if (weapons.laser.level < 6) options.push({ text: '🔪 Laser Level +1', hint: getEvolveHint('laser'), apply: () => { weapons.laser.level++; } });

  if (!weapons.freeze.enabled) options.push({ text: '❄️ Freeze freischalten', apply: () => { weapons.freeze.enabled = true; weapons.freeze.level = 1; } });
  else if (weapons.freeze.level < 6) options.push({ text: '❄️ Freeze Level +1', hint: getEvolveHint('freeze'), apply: () => { weapons.freeze.level++; } });

  if (weapons.pistole.enabled && weapons.pistole.level < 8) options.push({ text: '🔫 Pistole Level +1', hint: getEvolveHint('pistole'), apply: () => { weapons.pistole.level++; } });
  if (weapons.shotgun.enabled && weapons.shotgun.level < 6) options.push({ text: '💥 Shotgun Level +1', hint: getEvolveHint('shotgun'), apply: () => { weapons.shotgun.level++; } });
  if (weapons.katana.enabled && weapons.katana.level < 6) options.push({ text: '⚔️ Katana Level +1', hint: getEvolveHint('katana'), apply: () => { weapons.katana.level++; } });

  options.sort(() => Math.random() - 0.5);
  const evo = options.filter(o => o.text.includes('✨'));
  const rest = options.filter(o => !o.text.includes('✨'));
  const chosen = [...evo.slice(0, 1), ...rest].slice(0, 3);

  for (const opt of chosen) {
    const btn = document.createElement('button');
    const hintHtml = opt.hint ? `<span class="evo-hint">${opt.hint}</span>` : '';
    btn.innerHTML = opt.text + hintHtml;
    btn.onclick = () => {
      opt.apply();
      levelUpModal.classList.add('hidden');
      levelUpPending = false;
    };
    upgradesEl.appendChild(btn);
  }
}

function gameOver() {
  gameRunning = false;
  finalScoreEl.textContent = score;
  bestScoreDisplay.textContent = Math.max(score, highscore);
  if (score > highscore) {
    highscore = score;
    localStorage.setItem('iphoneSurvivorHighscore', highscore);
    newHighscoreEl.classList.remove('hidden');
  } else {
    newHighscoreEl.classList.add('hidden');
  }
  gameOverEl.classList.remove('hidden');
}

function resetGame() {
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
    xpToNext: 30,
    projectileCount: 1,
    projectileSpeed: 8,
    pickupRange: 90,
    area: 1,
    critChance: 0.05
  };
  applyStartingWeapon(startingWeapon);
  enemies = [];
  projectiles = [];
  boomerangs = [];
  mines = [];
  xpOrbs = [];
  particles = [];
  damageNumbers = [];
  score = 0;
  startTime = Date.now();
  gameRunning = true;
  levelUpPending = false;
  paused = false;
  chestPending = false;
  bossTimer = 0;
  bossCount = 0;
  gameOverEl.classList.add('hidden');
  levelUpModal.classList.add('hidden');
  pauseMenu.classList.add('hidden');
  chestModal.classList.add('hidden');
  updateUI();
}

restartBtn.onclick = resetGame;
restartFromPauseBtn.onclick = resetGame;

pauseBtn.onclick = () => {
  if (!gameRunning) return;
  paused = true;
  pauseMenu.classList.remove('hidden');
};

resumeBtn.onclick = () => {
  paused = false;
  pauseMenu.classList.add('hidden');
};

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (!gameStarted) return;

  for (const p of particles) {
    const alpha = p.life / p.maxLife;
    ctx.fillStyle = p.color;
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  for (const o of xpOrbs) {
    if (o.isChest) {
      ctx.fillStyle = '#ffd700';
      ctx.beginPath();
      ctx.arc(o.x, o.y, o.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.stroke();
    } else {
      ctx.fillStyle = '#00ff00';
      ctx.beginPath();
      ctx.arc(o.x, o.y, o.radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Mines
  ctx.fillStyle = '#ff8800';
  for (const m of mines) {
    ctx.beginPath();
    ctx.arc(m.x, m.y, m.radius, 0, Math.PI * 2);
    ctx.fill();
  }

  if (weapons.katana.enabled && weapons.katana.slashTimer > 0) {
    const range = 70 * player.area * (weapons.katana.evolved ? 1.4 : 1);
    const arc = 0.9 + weapons.katana.level * 0.12;
    ctx.strokeStyle = weapons.katana.evolved ? 'rgba(255,80,80,0.85)' : 'rgba(220,220,255,0.8)';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(player.x, player.y, range, weapons.katana.angle - arc/2, weapons.katana.angle + arc/2);
    ctx.stroke();
  }

  if (weapons.orbit.enabled) {
    const r = weapons.orbit.radius * Math.pow(player.area, 0.85) * (weapons.orbit.evolved ? 1.5 : 1);
    ctx.strokeStyle = weapons.orbit.evolved ? 'rgba(255,180,50,0.8)' : 'rgba(100,200,255,0.6)';
    ctx.lineWidth = weapons.orbit.evolved ? 4 : 3;
    ctx.beginPath();
    ctx.arc(player.x, player.y, r, 0, Math.PI * 2);
    ctx.stroke();
    const dots = weapons.orbit.evolved ? 7 : 4;
    for (let i = 0; i < dots; i++) {
      const a = weapons.orbit.angle + (i * Math.PI * 2 / dots);
      ctx.fillStyle = weapons.orbit.evolved ? '#ffaa33' : '#88ccff';
      ctx.beginPath();
      ctx.arc(player.x + Math.cos(a) * r, player.y + Math.sin(a) * r, weapons.orbit.evolved ? 9 : 6, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  if (weapons.aura.enabled) {
    const rad = 60 * Math.pow(player.area, 0.85) * (weapons.aura.evolved ? 1.7 : 1);
    ctx.fillStyle = weapons.aura.evolved ? 'rgba(255,80,80,0.18)' : 'rgba(80,255,120,0.14)';
    ctx.beginPath();
    ctx.arc(player.x, player.y, rad, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = weapons.boomerang.evolved ? '#ff66aa' : '#ffaa66';
  for (const b of boomerangs) {
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
    ctx.fill();
  }

  for (const e of enemies) {
    ctx.fillStyle = e.slowTimer > 0 ? '#88ccff' : (e.color || '#ff4444');
    ctx.beginPath();
    ctx.arc(e.x, e.y, e.radius, 0, Math.PI * 2);
    ctx.fill();
    if (e.isBoss) {
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 3;
      ctx.stroke();
    }
    const barW = e.isBoss ? 50 : 30;
    ctx.fillStyle = '#333';
    ctx.fillRect(e.x - barW/2, e.y - e.radius - 8, barW, 4);
    ctx.fillStyle = '#4caf50';
    ctx.fillRect(e.x - barW/2, e.y - e.radius - 8, barW * Math.max(0, e.health / e.maxHealth), 4);
  }

  ctx.fillStyle = '#ffff00';
  for (const p of projectiles) {
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = '#2196f3';
  ctx.beginPath();
  ctx.arc(player.x, player.y, player.radius, 0, Math.PI * 2);
  ctx.fill();

  ctx.font = 'bold 14px -apple-system, sans-serif';
  ctx.textAlign = 'center';
  for (const d of damageNumbers) {
    const alpha = d.life / 0.8;
    ctx.fillStyle = `rgba(255, 255, 100, ${alpha})`;
    ctx.fillText(d.value, d.x, d.y);
  }

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
