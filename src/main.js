import { SnakeGame } from './snakeGame.js';

const GRID_SIZE = 20;
const TICK_MS = 120;
const BEST_SCORE_KEY = 'snake-best-score';

const gridElement = document.getElementById('grid');
const scoreElement = document.getElementById('score');
const bestScoreElement = document.getElementById('bestScore');
const statusElement = document.getElementById('status');
const playPauseButton = document.getElementById('playPauseBtn');
const restartButton = document.getElementById('restartBtn');
const controlsWrapper = document.getElementById('touchControls');

const game = new SnakeGame({ width: GRID_SIZE, height: GRID_SIZE });
let loopId = null;
let paused = true;
let bestScore = loadBestScore();
bestScoreElement.textContent = bestScore;

const cellMap = new Map();

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
    cell.classList.remove('snake', 'head', 'food');
  });
}

function render(state = game.getState()) {
  clearCells();
  state.snake.forEach((segment, index) => {
    const cell = getCell(segment.x, segment.y);
    if (!cell) return;
    cell.classList.add('snake');
    if (index === 0) {
      cell.classList.add('head');
    }
  });

  if (state.food) {
    const foodCell = getCell(state.food.x, state.food.y);
    if (foodCell) {
      foodCell.classList.add('food');
    }
  }

  scoreElement.textContent = state.score;
  if (state.score > bestScore) {
    persistBestScore(state.score);
  }

  updateStatus(state);
}

function updateStatus(state) {
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
    statusElement.textContent = 'Press play to start.';
  }
}

function ensureLoop() {
  if (loopId) {
    return;
  }

  loopId = setInterval(() => {
    if (paused) {
      return;
    }
    const state = game.tick();
    render(state);
    if (state.status === 'over' || state.status === 'won') {
      paused = true;
      playPauseButton.textContent = 'Play';
    }
  }, TICK_MS);
}

function resumeGame() {
  const current = game.getState();
  if (current.status === 'over' || current.status === 'won') {
    game.reset();
  }
  paused = false;
  playPauseButton.textContent = 'Pause';
  render();
  ensureLoop();
}

function pauseGame() {
  paused = true;
  playPauseButton.textContent = 'Play';
  updateStatus(game.getState());
}

function restartGame() {
  game.reset();
  paused = false;
  playPauseButton.textContent = 'Pause';
  render();
  ensureLoop();
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
  if (event.code === 'Space') {
    event.preventDefault();
    if (paused) {
      resumeGame();
    } else {
      pauseGame();
    }
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
    if (paused) {
      resumeGame();
    }
  });
}

function init() {
  buildGrid();
  render();
  ensureLoop();
  setupButtons();
  controlsWrapper.addEventListener('click', handleTouchControls);
  window.addEventListener('keydown', handleKeydown);
  window.addEventListener('blur', pauseGame);
}

init();
