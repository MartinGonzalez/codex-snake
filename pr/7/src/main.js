import { SnakeGame } from './snakeGame.js';
import { applyConsumedColor, createCrates } from './colorCratesLogic.js';

const GRID_SIZE = 20;
const TICK_MS = 120;

const FOOD_COLORS = ['red', 'yellow', 'green', 'purple', 'blue', 'orange'];
const FOOD_COUNT = FOOD_COLORS.length;

const CRATE_COUNT = 4;
const CRATE_SLOTS = 3;
const ACTIVE_CRATES = 2;
const TRASH_CAPACITY = 5;

const gridElement = document.getElementById('grid');
const coinsElement = document.getElementById('coins');
const levelElement = document.getElementById('level');
const cratesElement = document.getElementById('crates');
const trashElement = document.getElementById('trash');
const statusElement = document.getElementById('status');
const controlsWrapper = document.getElementById('touchControls');

if (!gridElement || !coinsElement || !levelElement || !cratesElement || !trashElement) {
  throw new Error('Missing required DOM elements for Color Crates mode.');
}

const cellMap = new Map();

const game = new SnakeGame({ width: GRID_SIZE, height: GRID_SIZE });
let crates = createCrates(CRATE_COUNT, {
  slotsPerCrate: CRATE_SLOTS,
  activeCount: ACTIVE_CRATES,
  colors: FOOD_COLORS
});
/** @type {string[]} */
let trash = [];

let loopId = null;
let paused = true;
let lostByTrash = false;
let completedCratesTotal = 0;

function keyOf(point) {
  return `${point.x}:${point.y}`;
}

function randInt(maxExclusive) {
  return Math.floor(Math.random() * maxExclusive);
}

function pickRandom(list) {
  return list[randInt(list.length)];
}

function setStatus(text) {
  if (!statusElement) return;
  statusElement.textContent = text;
}

function buildGrid() {
  gridElement.style.gridTemplateColumns = `repeat(${GRID_SIZE}, 1fr)`;
  gridElement.style.gridTemplateRows = `repeat(${GRID_SIZE}, 1fr)`;

  for (let y = 0; y < GRID_SIZE; y += 1) {
    for (let x = 0; x < GRID_SIZE; x += 1) {
      const cell = document.createElement('div');
      cell.className = 'cell';
      cell.dataset.key = `${x}:${y}`;
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
    cell.classList.remove('snake', 'head', 'food');
    cell.style.removeProperty('--food-color');
  });
}

function spawnFoods(colors = FOOD_COLORS) {
  const foods = [];

  for (const color of colors) {
    const empty = game.collectEmptyCells();
    if (!empty.length) {
      break;
    }
    const point = pickRandom(empty);
    foods.push({ ...point, color });
    game.setFoods(foods);
  }

  return foods;
}

function respawnFoodColor(color) {
  const empty = game.collectEmptyCells();
  if (!empty.length) {
    // Board full: treat as win.
    game.state.status = 'won';
    return;
  }
  const point = pickRandom(empty);
  const nextFoods = [...game.state.foods, { ...point, color }];
  game.setFoods(nextFoods);
}

function renderCrates() {
  cratesElement.innerHTML = '';

  crates.forEach((crate, index) => {
    const crateEl = document.createElement('div');
    crateEl.className = 'crate';
    crateEl.style.setProperty('--crate-color', `var(--food-${crate.color})`);

    if (crate.locked) {
      crateEl.classList.add('is-locked');
      const lock = document.createElement('span');
      lock.className = 'crate__lock';
      lock.setAttribute('aria-hidden', 'true');
      crateEl.appendChild(lock);
    }

    const slots = document.createElement('div');
    slots.className = 'crate__slots';
    for (let i = 0; i < crate.slots; i += 1) {
      const slot = document.createElement('div');
      slot.className = 'crate__slot';
      if (i < crate.filled) slot.classList.add('is-filled');
      slots.appendChild(slot);
    }

    crateEl.appendChild(slots);
    crateEl.dataset.index = String(index);
    cratesElement.appendChild(crateEl);
  });
}

function renderTrash() {
  trashElement.innerHTML = '';
  for (let i = 0; i < TRASH_CAPACITY; i += 1) {
    const slot = document.createElement('div');
    slot.className = 'trash__slot';
    if (i < trash.length) {
      slot.classList.add('is-filled');
      slot.style.setProperty('--trash-color', `var(--food-${trash[i]})`);
    }
    trashElement.appendChild(slot);
  }
}

function render(state = game.getState()) {
  clearCells();

  state.snake.forEach((segment, index) => {
    const cell = getCell(segment.x, segment.y);
    if (!cell) return;
    cell.classList.add('snake');
    if (index === 0) cell.classList.add('head');
  });

  state.foods.forEach((food) => {
    const cell = getCell(food.x, food.y);
    if (!cell) return;
    cell.classList.add('food');
    cell.style.setProperty('--food-color', `var(--food-${food.color})`);
  });

  renderCrates();
  renderTrash();

  coinsElement.textContent = String(state.score);
  levelElement.textContent = String(1 + completedCratesTotal);

  if (lostByTrash) {
    setStatus('Game over — trash is full. Tap to restart.');
  } else if (state.status === 'over') {
    setStatus('Game over — you hit yourself. Tap to restart.');
  } else if (state.status === 'won') {
    setStatus('You win — board is full. Tap to restart.');
  } else if (paused) {
    setStatus('Tap the board to start.');
  } else {
    setStatus('Running');
  }
}

function resetRun() {
  game.reset();
  crates = createCrates(CRATE_COUNT, {
    slotsPerCrate: CRATE_SLOTS,
    activeCount: ACTIVE_CRATES,
    colors: FOOD_COLORS
  });
  trash = [];
  lostByTrash = false;
  completedCratesTotal = 0;

  spawnFoods(FOOD_COLORS);
  paused = true;
  render(game.getState());
}

function startOrRestart() {
  const state = game.getState();
  if (lostByTrash || state.status === 'over' || state.status === 'won') {
    resetRun();
  }
  paused = false;
}

function step() {
  if (paused) return;
  if (lostByTrash) return;

  const next = game.tick();

  if (next.ateFood) {
    const consumedColor = next.ateFood.color;

    // Apply crates/trash logic.
    const result = applyConsumedColor({
      color: consumedColor,
      crates,
      trash,
      activeCount: ACTIVE_CRATES,
      trashCapacity: TRASH_CAPACITY,
      colorsPool: FOOD_COLORS
    });

    if (result.completedCrates > 0) {
      completedCratesTotal += result.completedCrates;
    }

    if (result.gameOver) {
      lostByTrash = true;
      paused = true;
    }

    // Respawn 1:1, keeping one food per color on the board.
    respawnFoodColor(consumedColor);
  }

  if (next.status === 'over' || next.status === 'won') {
    paused = true;
  }

  render(game.getState());
}

function ensureLoop() {
  if (loopId) return;
  loopId = setInterval(step, TICK_MS);
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
  if (event.key === ' ' || event.code === 'Space') {
    event.preventDefault();
    if (paused) startOrRestart();
    return;
  }

  const direction = KEY_BINDINGS[event.key];
  if (!direction) return;

  event.preventDefault();
  if (paused) startOrRestart();
  game.setDirection(direction);
}

function handleTouchControls(event) {
  const button = event.target.closest('button[data-dir]');
  if (!button) return;
  event.preventDefault();
  if (paused) startOrRestart();
  game.setDirection(button.dataset.dir);
}

function init() {
  buildGrid();
  resetRun();
  ensureLoop();

  gridElement.addEventListener('click', () => {
    if (paused) startOrRestart();
  });

  window.addEventListener('keydown', handleKeydown);
  if (controlsWrapper) {
    controlsWrapper.addEventListener('click', handleTouchControls);
  }

  window.addEventListener('blur', () => {
    paused = true;
    render(game.getState());
  });
}

init();
