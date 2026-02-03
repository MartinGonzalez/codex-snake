import { SnakeGame } from './snakeGame.js';

const GRID_SIZE = 20;
const TICK_MS = 120;
const BEST_SCORE_KEY = 'snake-best-score';
const DASH_STEPS = 3;
const DASH_EFFECT_TICKS = 6;
const POWER_INTERVAL = 5;
const POWER_CHOICES_COUNT = 2;
const SLOW_MODE_TICKS = 60;
const EXTRA_FOOD_SLOTS_PER_POWER = 2;
const TRIM_SEGMENTS_MIN = 2;
const STATUS_FLASH_MS = 2200;
const TIME_BONUS_MS = 10000;
const DASH_GRADIENT = {
  start: { r: 250, g: 204, b: 21 },
  end: { r: 220, g: 38, b: 38 }
};
const PICKUP_SHAKE_DURATION_MS = 360;
const PICKUP_SHAKE_BASE = 2;
const PICKUP_SHAKE_MAX = 14;
const PICKUP_PARTICLE_BASE = 5;
const PICKUP_PARTICLE_MAX = 22;
const PICKUP_PARTICLE_LIFETIME_MS = 550;
const LENGTH_FOR_MAX_EFFECT = GRID_SIZE * 0.8;
const ROUND_DURATION_MS = 30000;
const TIMER_DECIMALS = 1;
const FORCE_EFFECTS_KEY = 'snake-force-effects';

const gridElement = document.getElementById('grid');
const scoreElement = document.getElementById('score');
const timerElement = document.getElementById('timer');
const bestScoreElement = document.getElementById('bestScore');
const statusElement = document.getElementById('status');
const playPauseButton = document.getElementById('playPauseBtn');
const restartButton = document.getElementById('restartBtn');
const controlsWrapper = document.getElementById('touchControls');
const hintElement = document.getElementById('hintText');
const powerModalElement = document.getElementById('powerModal');
const powerChoicesElement = document.getElementById('powerChoices');
const powerSubtitleElement = document.getElementById('powerSubtitle');
const effectsForceToggle = document.getElementById('effectsForceToggle');
const pickupMotionMedia =
  typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-reduced-motion: reduce)')
    : null;
let prefersReducedMotion = pickupMotionMedia ? pickupMotionMedia.matches : false;

const game = new SnakeGame({ width: GRID_SIZE, height: GRID_SIZE });
let loopId = null;
let paused = true;
let dashEffectTicks = 0;
let dashUnlocked = false;
let nextPowerScore = POWER_INTERVAL;
let isPowerChoiceActive = false;
let slowModeTicks = 0;
let slowModeParity = false;
let statusOverrideMessage = null;
let statusOverrideTimeout = null;
let bestScore = loadBestScore();
let previousScore = game.getState().score;
let pickupShakeTimeout = null;
let remainingTimeMs = ROUND_DURATION_MS;
let lastTimerTimestamp = null;
let timeExpired = false;
let milestoneFoodActive = false;
let milestoneFoodPosition = null;
let forceEffectsEnabled = loadForceEffectsPreference();
let multiFoodActive = false;
bestScoreElement.textContent = bestScore;
updateTimerDisplay();

if (pickupMotionMedia && typeof pickupMotionMedia.addEventListener === 'function') {
  pickupMotionMedia.addEventListener('change', (event) => {
    prefersReducedMotion = event.matches;
    updateHintMessage();
  });
} else if (pickupMotionMedia && typeof pickupMotionMedia.addListener === 'function') {
  pickupMotionMedia.addListener((event) => {
    prefersReducedMotion = event.matches;
    updateHintMessage();
  });
}

const cellMap = new Map();

const POWER_UPS = [
  {
    id: 'dash',
    label: 'Dash Core',
    description: 'Unlock dash and press Space to burst forward.',
    available: () => !dashUnlocked,
    apply: applyDashBoost
  },
  {
    id: 'time',
    label: 'Time Capsule',
    description: 'Slow the world for a moment to plan your route.',
    apply: applySlowTimeBoost
  },
  {
    id: 'bonus-time',
    label: '+10 Seconds',
    description: 'Add 10 seconds to the round timer instantly.',
    apply: applyTimeBonusBoost
  },
  {
    id: 'trim',
    label: 'Snake Shears',
    description: 'Trim 25% of your tail for tight maneuvers.',
    available: () => game.getState().snake.length > 3,
    apply: applyTrimBoost
  },
  {
    id: 'multi',
    label: 'Multi Select',
    description: 'Spawn extra food so multiple squares count at once.',
    apply: applyMultiFoodBoost
  }
];

function buildGrid() {
  gridElement.style.setProperty('--grid-columns', GRID_SIZE);
  gridElement.style.setProperty('--grid-rows', GRID_SIZE);
  gridElement.style.gridTemplateColumns = `repeat(${GRID_SIZE}, 1fr)`;
  gridElement.style.gridTemplateRows = `repeat(${GRID_SIZE}, 1fr)`;
  for (let y = 0; y < GRID_SIZE; y += 1) {
    for (let x = 0; x < GRID_SIZE; x += 1) {
      const cell = document.createElement('div');
      cell.className = 'cell';
      cell.dataset.key = `${x}:${y}`;
      cell.setAttribute('role', 'gridcell');
      gridElement.appendChild(cell);
      cellMap.set(cell.dataset.key, cell);
    }
  }
}

function getCell(x, y) {
  return cellMap.get(`${x}:${y}`);
}

function clearCells() {
  cellMap.forEach((cell) => {
    cell.classList.remove('snake', 'head', 'food', 'food-extra', 'food-milestone', 'dash-active');
    cell.style.removeProperty('--snake-color');
    cell.style.removeProperty('--snake-head-color');
  });
}

function render(state = game.getState()) {
  state = ensureMilestoneFoodState(state);
  clearCells();
  const applyDash = dashEffectTicks > 0;
  state.snake.forEach((segment, index) => {
    const cell = getCell(segment.x, segment.y);
    if (!cell) return;
    cell.classList.add('snake');
    if (applyDash) {
      cell.classList.add('dash-active');
      const gradientColor = colorForDashSegment(index, state.snake.length);
      cell.style.setProperty('--snake-color', gradientColor);
      cell.style.setProperty('--snake-head-color', gradientColor);
    }
    if (index === 0) {
      cell.classList.add('head');
    }
  });

  if (dashEffectTicks > 0) {
    dashEffectTicks -= 1;
  }

  if (state.food) {
    const foodCell = getCell(state.food.x, state.food.y);
    if (foodCell) {
      foodCell.classList.add('food');
      if (isMilestoneFood(state.food)) {
        foodCell.classList.add('food-milestone');
      }
    }
  }

  if (state.extraFoods) {
    state.extraFoods.forEach((point) => {
      const cell = getCell(point.x, point.y);
      if (cell) {
        cell.classList.add('food', 'food-extra');
      }
    });
  }

  scoreElement.textContent = state.score;
  if (state.score > bestScore) {
    persistBestScore(state.score);
  }

  updateStatus(state);
  maybeShowPowerChoice(state);
  updateHintMessage();
  handlePickupEffects(state);
  previousScore = state.score;
}

function handlePickupEffects(state) {
  if (
    !state ||
    state.score <= previousScore ||
    !gridElement ||
    isMotionSuppressed() ||
    !Array.isArray(state.snake) ||
    state.snake.length === 0
  ) {
    return;
  }

  const head = state.snake[0];
  if (!head) {
    return;
  }

  const intensity = calculatePickupIntensity(state.snake.length);
  triggerPickupShake(intensity);
  spawnPickupParticles(head, intensity);
}

function calculatePickupIntensity(length) {
  const minLength = Math.max(1, game.initialLength || 1);
  const maxLength = Math.max(minLength + 1, LENGTH_FOR_MAX_EFFECT);
  const normalized = (length - minLength) / (maxLength - minLength);
  return clamp(normalized, 0, 1);
}

function triggerPickupShake(intensity) {
  const resolved = clamp(intensity, 0, 1);
  if (!gridElement) {
    return;
  }

  const distance = PICKUP_SHAKE_BASE + (PICKUP_SHAKE_MAX - PICKUP_SHAKE_BASE) * resolved;
  gridElement.style.setProperty('--pickup-shake-distance', `${distance.toFixed(2)}px`);
  gridElement.style.setProperty('--pickup-shake-duration', `${PICKUP_SHAKE_DURATION_MS}ms`);
  gridElement.classList.remove('pickup-shake');
  void gridElement.offsetWidth; // restart animation
  gridElement.classList.add('pickup-shake');
  if (pickupShakeTimeout) {
    clearTimeout(pickupShakeTimeout);
  }
  pickupShakeTimeout = setTimeout(() => {
    gridElement.classList.remove('pickup-shake');
    pickupShakeTimeout = null;
  }, PICKUP_SHAKE_DURATION_MS);
}

function spawnPickupParticles(head, intensity) {
  if (!gridElement || !head) {
    return;
  }
  const cell = getCell(head.x, head.y);
  if (!cell) {
    return;
  }
  const gridRect = gridElement.getBoundingClientRect();
  const cellRect = cell.getBoundingClientRect();
  if (!gridRect.width || !gridRect.height) {
    return;
  }

  const originX = cellRect.left + cellRect.width / 2 - gridRect.left;
  const originY = cellRect.top + cellRect.height / 2 - gridRect.top;
  const normalized = clamp(intensity, 0, 1);
  const count = Math.round(
    PICKUP_PARTICLE_BASE + (PICKUP_PARTICLE_MAX - PICKUP_PARTICLE_BASE) * normalized
  );
  const leftPercent = (originX / gridRect.width) * 100;
  const topPercent = (originY / gridRect.height) * 100;
  const lifetime = `${PICKUP_PARTICLE_LIFETIME_MS}ms`;

  for (let i = 0; i < count; i += 1) {
    const particle = document.createElement('span');
    particle.className = 'pickup-particle';
    particle.style.left = `${leftPercent}%`;
    particle.style.top = `${topPercent}%`;
    particle.style.setProperty('--pickup-particle-duration', lifetime);
    const angle = Math.random() * Math.PI * 2;
    const distance = 24 + Math.random() * 60 * (0.5 + normalized);
    const offsetX = Math.cos(angle) * distance;
    const offsetY = Math.sin(angle) * distance;
    particle.style.setProperty('--pickup-particle-offset-x', `${offsetX.toFixed(2)}px`);
    particle.style.setProperty('--pickup-particle-offset-y', `${offsetY.toFixed(2)}px`);
    const size = 4 + Math.random() * 4 * (0.5 + normalized);
    particle.style.setProperty('--pickup-particle-size', `${size.toFixed(2)}px`);
    const hue = 120 + Math.random() * 120;
    particle.style.setProperty('--pickup-particle-color', `hsl(${hue.toFixed(1)}, 90%, 70%)`);
    gridElement.appendChild(particle);
    setTimeout(() => {
      particle.remove();
    }, PICKUP_PARTICLE_LIFETIME_MS + 120);
  }
}

function resetPickupEffects() {
  previousScore = game.getState().score;
  if (!gridElement) {
    return;
  }
  gridElement.classList.remove('pickup-shake');
  if (pickupShakeTimeout) {
    clearTimeout(pickupShakeTimeout);
    pickupShakeTimeout = null;
  }
  gridElement.querySelectorAll('.pickup-particle').forEach((particle) => particle.remove());
}

function getTimestamp() {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    return performance.now();
  }
  return Date.now();
}

function updateTimerDisplay(value = remainingTimeMs) {
  if (!timerElement) {
    return;
  }
  const seconds = Math.max(0, value) / 1000;
  timerElement.textContent = `${seconds.toFixed(TIMER_DECIMALS)}s`;
}

function resetTimer() {
  remainingTimeMs = ROUND_DURATION_MS;
  lastTimerTimestamp = null;
  timeExpired = false;
  updateTimerDisplay();
}

function tickTimer() {
  if (timeExpired) {
    return;
  }
  const current = getTimestamp();
  if (lastTimerTimestamp === null) {
    lastTimerTimestamp = current;
    return;
  }
  const delta = current - lastTimerTimestamp;
  lastTimerTimestamp = current;
  if (delta <= 0) {
    return;
  }
  remainingTimeMs = Math.max(0, remainingTimeMs - delta);
  updateTimerDisplay();
  if (remainingTimeMs === 0) {
    endRoundDueToTime();
  }
}

function endRoundDueToTime() {
  if (timeExpired) {
    return;
  }
  timeExpired = true;
  lastTimerTimestamp = null;
  paused = true;
  playPauseButton.textContent = 'Play';
  if (isPowerChoiceActive) {
    closePowerModal();
  }
  if (game.state.status !== 'over' && game.state.status !== 'won') {
    game.state.status = 'over';
  }
  const latestState = game.getState();
  render(latestState);
  setStatusOverride(`Time's up! Final score: ${latestState.score}. Press restart to try again.`, 0);
  syncControlAvailability();
}

function clamp(value, min, max) {
  if (Number.isNaN(value)) {
    return min;
  }
  return Math.min(max, Math.max(min, value));
}

function updateStatus(state) {
  if (statusOverrideMessage) {
    statusElement.textContent = statusOverrideMessage;
    return;
  }

  if (state.status === 'over') {
    statusElement.textContent = 'Game over — press restart to try again.';
    return;
  }

  if (state.status === 'won') {
    statusElement.textContent = 'Perfect run! Press restart to play again.';
    return;
  }

  if (paused && state.status !== 'idle') {
    statusElement.textContent = 'Paused';
    return;
  }

  if (state.status === 'running') {
    statusElement.textContent = 'Running';
  } else {
    statusElement.textContent = 'Press play to start your 30-second run.';
  }
}

function setStatusOverride(message, duration = STATUS_FLASH_MS) {
  statusOverrideMessage = message;
  statusElement.textContent = message;
  if (statusOverrideTimeout) {
    clearTimeout(statusOverrideTimeout);
  }
  if (duration > 0) {
    statusOverrideTimeout = setTimeout(() => {
      statusOverrideMessage = null;
      updateStatus(game.getState());
    }, duration);
  }
}

function ensureLoop() {
  if (loopId) {
    return;
  }

  loopId = setInterval(() => {
    if (paused) {
      lastTimerTimestamp = null;
      return;
    }

    tickTimer();
    if (timeExpired) {
      return;
    }

    if (slowModeTicks > 0) {
      slowModeTicks -= 1;
      slowModeParity = !slowModeParity;
      if (slowModeParity) {
        return;
      }
    } else {
      slowModeParity = false;
    }

    const state = game.tick();
    render(state);
    if (state.status === 'over' || state.status === 'won') {
      paused = true;
      playPauseButton.textContent = 'Play';
      lastTimerTimestamp = null;
      syncControlAvailability();
    }
  }, TICK_MS);
}

function resumeGame() {
  if (isPowerChoiceActive) {
    return;
  }
  if (timeExpired) {
    restartGame();
    return;
  }
  const current = game.getState();
  if (current.status === 'over' || current.status === 'won') {
    game.reset();
    resetPickupEffects();
    resetTimer();
  }
  paused = false;
  lastTimerTimestamp = null;
  playPauseButton.textContent = 'Pause';
  render();
  ensureLoop();
  syncControlAvailability();
}

function pauseGame() {
  paused = true;
  playPauseButton.textContent = 'Play';
  lastTimerTimestamp = null;
  updateStatus(game.getState());
  syncControlAvailability();
}

function restartGame() {
  closePowerModal();
  nextPowerScore = POWER_INTERVAL;
  setDashUnlocked(false);
  slowModeTicks = 0;
  slowModeParity = false;
  statusOverrideMessage = null;
  milestoneFoodActive = false;
  milestoneFoodPosition = null;
  expireMultiFoodBoost({ shouldRender: false });
  if (statusOverrideTimeout) {
    clearTimeout(statusOverrideTimeout);
    statusOverrideTimeout = null;
  }
  resetTimer();
  game.reset();
  resetPickupEffects();
  paused = false;
  playPauseButton.textContent = 'Pause';
  render();
  ensureLoop();
  syncControlAvailability();
}

function handleDirectionChange(direction) {
  game.setDirection(direction);
}

const KEY_BINDINGS = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  w: 'up',
  W: 'up',
  s: 'down',
  S: 'down',
  a: 'left',
  A: 'left',
  d: 'right',
  D: 'right'
};

function handleKeydown(event) {
  if (isPowerChoiceActive) {
    event.preventDefault();
    return;
  }

  if (event.code === 'Space') {
    event.preventDefault();
    triggerDash();
    return;
  }

  const direction = KEY_BINDINGS[event.key];
  if (!direction) {
    return;
  }
  event.preventDefault();
  if (paused && game.getState().status === 'idle') {
    resumeGame();
  }
  handleDirectionChange(direction);
}

function handleTouchControls(event) {
  if (isPowerChoiceActive) {
    event.preventDefault();
    return;
  }
  const button = event.target.closest('button[data-dir]');
  if (!button) return;
  event.preventDefault();
  if (paused && (game.getState().status === 'idle' || game.getState().status === 'running')) {
    resumeGame();
  }
  handleDirectionChange(button.dataset.dir);
}

function loadBestScore() {
  try {
    const stored = localStorage.getItem(BEST_SCORE_KEY);
    return stored ? Number(stored) : 0;
  } catch (error) {
    return 0;
  }
}

function loadForceEffectsPreference() {
  try {
    return localStorage.getItem(FORCE_EFFECTS_KEY) === 'true';
  } catch (error) {
    return false;
  }
}

function persistForceEffectsPreference(value) {
  try {
    localStorage.setItem(FORCE_EFFECTS_KEY, String(Boolean(value)));
  } catch (error) {
    // Ignore storage failures (e.g., privacy mode)
  }
}

function triggerDash() {
  const current = game.getState();
  if (!dashUnlocked) {
    if (paused) {
      if (current.status === 'idle') {
        resumeGame();
        return;
      }
      if (current.status === 'over' || current.status === 'won') {
        restartGame();
        return;
      }
    }
    setStatusOverride('Dash is locked — choose the Dash Core boost to enable it.');
    return;
  }
  if (isPowerChoiceActive) {
    return;
  }

  if (paused) {
    if (current.status === 'idle') {
      resumeGame();
    } else if (current.status === 'over' || current.status === 'won') {
      restartGame();
    } else {
      return;
    }
  }

  dashEffectTicks = DASH_EFFECT_TICKS;
  const nextState = game.dash(DASH_STEPS);
  render(nextState);

  if (nextState.status === 'over' || nextState.status === 'won') {
    paused = true;
    playPauseButton.textContent = 'Play';
  }
}

function colorForDashSegment(index, length) {
  if (length <= 1) {
    return rgbColor(DASH_GRADIENT.start);
  }
  const clampedIndex = Math.max(0, Math.min(index, length - 1));
  const t = clampedIndex / (length - 1);
  const r = lerp(DASH_GRADIENT.start.r, DASH_GRADIENT.end.r, t);
  const g = lerp(DASH_GRADIENT.start.g, DASH_GRADIENT.end.g, t);
  const b = lerp(DASH_GRADIENT.start.b, DASH_GRADIENT.end.b, t);
  return `rgb(${r}, ${g}, ${b})`;
}

function lerp(start, end, t) {
  return Math.round(start + (end - start) * t);
}

function rgbColor({ r, g, b }) {
  return `rgb(${r}, ${g}, ${b})`;
}

function persistBestScore(value) {
  bestScore = value;
  bestScoreElement.textContent = value;
  try {
    localStorage.setItem(BEST_SCORE_KEY, String(value));
  } catch (error) {
    // Ignore storage failures (e.g., privacy mode)
  }
}

function setupButtons() {
  playPauseButton.addEventListener('click', () => {
    if (paused) {
      resumeGame();
    } else {
      pauseGame();
    }
  });

  restartButton.addEventListener('click', () => {
    restartGame();
  });

  gridElement.addEventListener('click', () => {
    if (paused && !isPowerChoiceActive) {
      resumeGame();
    }
  });
}

function setupEffectsToggle() {
  syncForceEffectsClass();
  syncEffectsToggleState();
  if (!effectsForceToggle) {
    return;
  }
  effectsForceToggle.addEventListener('change', (event) => {
    setForceEffectsEnabled(event.target.checked);
  });
}

function setForceEffectsEnabled(enabled) {
  const normalized = Boolean(enabled);
  if (normalized === forceEffectsEnabled) {
    syncEffectsToggleState();
    return;
  }
  forceEffectsEnabled = normalized;
  persistForceEffectsPreference(forceEffectsEnabled);
  syncForceEffectsClass();
  syncEffectsToggleState();
  updateHintMessage();
}

function syncForceEffectsClass() {
  if (document.body) {
    document.body.classList.toggle('effects-forced', forceEffectsEnabled);
  }
}

function syncEffectsToggleState() {
  if (effectsForceToggle) {
    effectsForceToggle.checked = forceEffectsEnabled;
  }
}

function isMotionSuppressed() {
  return prefersReducedMotion && !forceEffectsEnabled;
}

function syncControlAvailability() {
  playPauseButton.disabled = isPowerChoiceActive;
  if (isPowerChoiceActive) {
    playPauseButton.setAttribute('aria-disabled', 'true');
  } else {
    playPauseButton.removeAttribute('aria-disabled');
  }
}

function ensureMilestoneFoodState(state) {
  if (!state) {
    milestoneFoodActive = false;
    milestoneFoodPosition = null;
    return state;
  }

  const milestoneScore = nextPowerScore - 1;
  const eligibleStatus = state.status !== 'over' && state.status !== 'won';
  const needsMilestone =
    eligibleStatus && milestoneScore >= 0 && state.score === milestoneScore && !timeExpired;

  if (!needsMilestone) {
    milestoneFoodActive = false;
    milestoneFoodPosition = null;
    return state;
  }

  if (isMilestoneFood(state.food)) {
    return state;
  }

  const center = {
    x: Math.floor(GRID_SIZE / 2),
    y: Math.floor(GRID_SIZE / 2)
  };

  const updatedState = game.placePreferredFood([center]);
  milestoneFoodActive = true;
  milestoneFoodPosition = updatedState.food ? { ...updatedState.food } : null;
  return updatedState;
}

function isMilestoneFood(food) {
  if (!food || !milestoneFoodActive || !milestoneFoodPosition) {
    return false;
  }
  return food.x === milestoneFoodPosition.x && food.y === milestoneFoodPosition.y;
}

function maybeShowPowerChoice(state) {
  if (isPowerChoiceActive) {
    return;
  }

  if (state.status !== 'running') {
    return;
  }

  if (state.score === 0 || state.score < nextPowerScore) {
    return;
  }

  const milestone = nextPowerScore;
  nextPowerScore += POWER_INTERVAL;
  openPowerModal(milestone);
}

function openPowerModal(milestone) {
  expireMultiFoodBoost({ shouldRender: false });
  isPowerChoiceActive = true;
  pauseGame();
  syncControlAvailability();
  if (powerSubtitleElement) {
    powerSubtitleElement.textContent = `You cleared ${milestone} squares. Choose a boost to continue.`;
  }
  const options = getPowerOptions();
  renderPowerChoices(options);
  if (powerModalElement) {
    powerModalElement.classList.add('is-visible');
  }
  setStatusOverride('Pick a boost to continue!');
}

function closePowerModal() {
  if (powerModalElement) {
    powerModalElement.classList.remove('is-visible');
  }
  if (powerChoicesElement) {
    powerChoicesElement.innerHTML = '';
  }
  isPowerChoiceActive = false;
  syncControlAvailability();
}

function getPowerOptions() {
  const eligible = POWER_UPS.filter((option) => {
    return typeof option.available === 'function' ? option.available() : true;
  });
  const pool = eligible.length >= POWER_CHOICES_COUNT ? eligible : POWER_UPS;
  return pickRandomOptions(pool, POWER_CHOICES_COUNT);
}

function pickRandomOptions(pool, count) {
  if (!pool.length) {
    return [];
  }
  const bucket = [...pool];
  const selection = [];
  while (bucket.length > 0 && selection.length < count) {
    const index = Math.floor(Math.random() * bucket.length);
    selection.push(bucket.splice(index, 1)[0]);
  }
  while (selection.length < count) {
    selection.push(pool[Math.floor(Math.random() * pool.length)]);
  }
  return selection;
}

function renderPowerChoices(options) {
  if (!powerChoicesElement) {
    return;
  }
  powerChoicesElement.innerHTML = '';
  options.forEach((power) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'power-choice';
    button.innerHTML = `<strong>${power.label}</strong><span>${power.description}</span>`;
    button.addEventListener('click', () => handlePowerChoice(power));
    powerChoicesElement.appendChild(button);
  });
}

function handlePowerChoice(power) {
  closePowerModal();
  if (!power) {
    return;
  }
  power.apply();
  resumeGame();
}

function setDashUnlocked(enabled) {
  dashUnlocked = enabled;
  if (document.body) {
    document.body.classList.toggle('dash-unlocked', enabled);
  }
  updateHintMessage();
}

function applyDashBoost() {
  if (dashUnlocked) {
    setStatusOverride('Dash already unlocked — keep blazing!');
    return;
  }
  setDashUnlocked(true);
  setStatusOverride('Dash unlocked! Press Space to burst forward.');
}

function applySlowTimeBoost() {
  slowModeTicks = Math.max(slowModeTicks, SLOW_MODE_TICKS);
  slowModeParity = false;
  setStatusOverride('Time slowed — take a breather.');
}

function applyTimeBonusBoost() {
  const before = remainingTimeMs;
  remainingTimeMs = clamp(remainingTimeMs + TIME_BONUS_MS, 0, Number.POSITIVE_INFINITY);
  updateTimerDisplay();
  const addedSeconds = ((remainingTimeMs - before) / 1000).toFixed(1);
  setStatusOverride(`⏱ +${addedSeconds}s added to the clock!`);
}

function applyTrimBoost() {
  const currentLength = game.getState().snake.length;
  const trimAmount = Math.max(TRIM_SEGMENTS_MIN, Math.floor(currentLength * 0.25));
  const nextState = game.shrink(trimAmount);
  render(nextState);
  setStatusOverride('Snake trimmed for tighter turns.');
}

function applyMultiFoodBoost() {
  multiFoodActive = true;
  const nextState = game.addExtraFoodSlots(EXTRA_FOOD_SLOTS_PER_POWER);
  render(nextState);
  setStatusOverride('Multiple squares activated — collect them all!');
}

function expireMultiFoodBoost({ shouldRender = true } = {}) {
  if (!multiFoodActive) {
    return;
  }
  multiFoodActive = false;
  const nextState = game.clearExtraFoodSlots();
  if (shouldRender) {
    render(nextState);
  }
}

function updateHintMessage() {
  if (!hintElement) {
    return;
  }
  const state = game.getState();
  const delta = Math.max(nextPowerScore - state.score, 0);
  const boostCopy =
    delta === 0 ? 'Boost ready now.' : `Boost in ${delta} square${delta === 1 ? '' : 's'}.`;
  const dashCopy = dashUnlocked
    ? 'Press Space to dash.'
    : 'Unlock dash by choosing the Dash Core boost.';
  const timeSeconds = Math.ceil(remainingTimeMs / 1000);
  const timeCopy = timeExpired
    ? 'Round complete.'
    : `${timeSeconds}s remaining${paused ? ' (paused)' : ''}.`;
  const effectsCopy = forceEffectsEnabled
    ? 'Effects forced on.'
    : prefersReducedMotion
      ? 'Effects follow your system setting.'
      : '';
  const motionSuffix = effectsCopy ? ` ${effectsCopy}` : '';
  hintElement.textContent = `Use arrow keys or WASD. ${dashCopy} ${boostCopy} ${timeCopy}${motionSuffix}`;
}

function init() {
  buildGrid();
  render();
  ensureLoop();
  setupButtons();
  setupEffectsToggle();
  controlsWrapper.addEventListener('click', handleTouchControls);
  window.addEventListener('keydown', handleKeydown);
  window.addEventListener('blur', pauseGame);
}

init();
