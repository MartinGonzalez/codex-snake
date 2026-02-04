import { SnakeGame } from './snakeGame.js';
import { applyConsumedColor, createCrates } from './colorCratesLogic.js';

const GRID_SIZE = 20;
const TICK_MS = 120;

const FOOD_COUNT = 6;
const COLORS = ['red', 'yellow', 'green', 'purple', 'blue', 'orange'];
const COLOR_HEX = {
  red: '#ff2244',
  yellow: '#facc15',
  green: '#3cff7f',
  purple: '#a855f7',
  blue: '#3b82f6',
  orange: '#fb923c'
};

const CRATE_COUNT = 4;
const CRATE_SLOTS = 3;
const ACTIVE_CRATES = 2;
const TRASH_CAPACITY = 5;

const gridElement = document.getElementById('grid');
const coinsElement = document.getElementById('coins');
const levelElement = document.getElementById('level');
const cratesElement = document.getElementById('crates');
const trashElement = document.getElementById('trash');
const controlsWrapper = document.getElementById('touchControls');

const game = new SnakeGame({ width: GRID_SIZE, height: GRID_SIZE });

let loopId = null;
let paused = true;
let gameOver = false;

let coins = 0;
let level = 1;
let crates = createCrates(CRATE_COUNT, {
  slotsPerCrate: CRATE_SLOTS,
  activeCount: ACTIVE_CRATES,
  colors: COLORS
});
let trash = [];

const cellMap = new Map();

function buildGrid() {
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
    cell.classList.remove('snake', 'head', 'food');
    cell.style.removeProperty('--food-color');
  });
}

function randomChoice(list) {
  const idx = Math.floor(Math.random() * list.length) % list.length;
  return list[idx];
}

function randomEmptyCell() {
  const empty = game.collectEmptyCells();
  if (!empty.length) return null;
  return randomChoice(empty);
}

function spawnInitialFoods() {
  const foods = [];
  for (let i = 0; i < FOOD_COUNT; i += 1) {
    const spawn = randomEmptyCell();
    if (!spawn) break;
    foods.push({ ...spawn, color: randomChoice(COLORS), id: `f${Date.now()}_${i}` });
    game.setFoods(foods);
  }
  game.setFoods(foods);
}

function respawnOneFood() {
  const spawn = randomEmptyCell();
  if (!spawn) return;
  const foods = game.getState().foods;
  foods.push({ ...spawn, color: randomChoice(COLORS), id: `f${Date.now()}_${foods.length}` });
  game.setFoods(foods);
}

function renderHud() {
  coinsElement.textContent = String(coins);
  levelElement.textContent = String(level);
}

function renderCrates() {
  cratesElement.innerHTML = '';
  crates.forEach((crate, index) => {
    const crateEl = document.createElement('div');
    crateEl.className = 'crate';
    crateEl.style.setProperty('--crate-color', COLOR_HEX[crate.color] || crate.color);

    if (crate.locked) {
      crateEl.classList.add('is-locked');
      const lock = document.createElement('span');
      lock.className = 'crate__lock';
      lock.setAttribute('aria-hidden', 'true');
      crateEl.appendChild(lock);
    }

    if (crate.justCompleted) {
      crateEl.classList.add('is-completing');
      // Clear the flag after the animation frame.
      setTimeout(() => {
        crate.justCompleted = false;
        crateEl.classList.remove('is-completing');
      }, 260);
    }

    const slots = document.createElement('div');
    slots.className = 'crate__slots';
    for (let i = 0; i < CRATE_SLOTS; i += 1) {
      const slot = document.createElement('div');
      slot.className = 'crate__slot';
      if (i < crate.filled) {
        slot.classList.add('is-filled');
      }
      slots.appendChild(slot);
    }
    crateEl.appendChild(slots);

    // Accessibility label.
    const active = index < ACTIVE_CRATES;
    crateEl.setAttribute(
      'aria-label',
      `${active ? 'Active' : 'Locked'} crate ${index + 1}: ${crate.color}, ${crate.filled}/${CRATE_SLOTS}`
    );

    cratesElement.appendChild(crateEl);
  });
}

function renderTrash() {
  trashElement.innerHTML = '';
  for (let i = 0; i < TRASH_CAPACITY; i += 1) {
    const slot = document.createElement('div');
    slot.className = 'trash__slot';
    const color = trash[i];
    if (color) {
      slot.classList.add('is-filled');
      slot.style.setProperty('--trash-color', COLOR_HEX[color] || color);
    }
    trashElement.appendChild(slot);
  }
}

function renderBoard(state = game.getState()) {
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
    cell.style.setProperty('--food-color', COLOR_HEX[food.color] || food.color);
  });

  gridElement.classList.toggle('is-gameover', gameOver);
}

function renderAll() {
  renderHud();
  renderCrates();
  renderTrash();
  renderBoard();
}

function resetRun() {
  game.reset();
  coins = 0;
  level = 1;
  crates = createCrates(CRATE_COUNT, {
    slotsPerCrate: CRATE_SLOTS,
    activeCount: ACTIVE_CRATES,
    colors: COLORS
  });
  trash = [];
  gameOver = false;
  paused = false;
  spawnInitialFoods();
  renderAll();
}

function endRun(reason = 'Trash full') {
  gameOver = true;
  paused = true;
  gridElement.classList.add('is-gameover');
  gridElement.setAttribute('aria-label', `Game over: ${reason}. Tap the board to restart.`);
}

function handleConsumedFood(food) {
  if (!food) return;

  coins += 1;

  const result = applyConsumedColor({
    color: food.color,
    crates,
    trash,
    activeCount: ACTIVE_CRATES,
    trashCapacity: TRASH_CAPACITY,
    colorsPool: COLORS
  });

  if (result.completedCrates > 0) {
    level += result.completedCrates;
  }

  if (result.gameOver) {
    endRun('Trash full');
    return;
  }

  // Ensure we always have 6 foods.
  respawnOneFood();
}

function ensureLoop() {
  if (loopId) return;
  loopId = setInterval(() => {
    if (paused || gameOver) return;
    const state = game.tick();
    if (state.ateFood) {
      handleConsumedFood(state.ateFood);
    }
    if (state.status === 'over') {
      endRun('Self collision');
    }
    renderAll();
  }, TICK_MS);
}

function handleDirectionChange(direction) {
  if (paused && !gameOver) {
    paused = false;
  }
  if (gameOver) {
    resetRun();
    return;
  }
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
  const direction = KEY_BINDINGS[event.key];
  if (!direction) return;
  event.preventDefault();
  handleDirectionChange(direction);
}

function handleTouchControls(event) {
  const button = event.target.closest('button[data-dir]');
  if (!button) return;
  event.preventDefault();
  handleDirectionChange(button.dataset.dir);
}

function init() {
  buildGrid();
  resetRun();
  ensureLoop();
  controlsWrapper.addEventListener('click', handleTouchControls);
  window.addEventListener('keydown', handleKeydown);

  gridElement.addEventListener('click', () => {
    if (gameOver) {
      resetRun();
    }
  });

  window.addEventListener('blur', () => {
    paused = true;
  });
}

init();
