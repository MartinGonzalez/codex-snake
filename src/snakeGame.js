const DIRECTIONS = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 }
};

const OPPOSITES = {
  up: 'down',
  down: 'up',
  left: 'right',
  right: 'left'
};

export class SnakeGame {
  constructor({ width = 20, height = 20, initialLength = 3, rng = Math.random } = {}) {
    this.width = width;
    this.height = height;
    this.initialLength = Math.max(1, initialLength);
    this.rng = typeof rng === 'function' ? rng : Math.random;
    this.reset();
  }

  reset() {
    const startX = Math.floor(this.width / 2);
    const startY = Math.floor(this.height / 2);
    const snake = [];

    for (let i = 0; i < this.initialLength; i += 1) {
      snake.push({ x: startX - i, y: startY });
    }

    this.state = {
      snake,
      direction: 'right',
      nextDirection: 'right',
      score: 0,
      status: 'idle',
      food: null
    };

    this.state.food = this._spawnFood();
    return this.getState();
  }

  getState() {
    const { snake, food, ...rest } = this.state;
    return {
      ...rest,
      snake: snake.map((segment) => ({ ...segment })),
      food: food ? { ...food } : null
    };
  }

  setDirection(direction) {
    if (!direction) return;
    const normalized = direction.toLowerCase();
    if (!DIRECTIONS[normalized]) return;
    if (this.state.snake.length > 1 && OPPOSITES[this.state.direction] === normalized) {
      return;
    }
    this.state.nextDirection = normalized;
  }

  tick() {
    if (this.state.status === 'over') {
      return this.getState();
    }

    if (this.state.status === 'idle') {
      this.state.status = 'running';
    }

    this.state.direction = this.state.nextDirection;
    const head = this.state.snake[0];
    const vector = DIRECTIONS[this.state.direction];
    const nextHead = { x: head.x + vector.x, y: head.y + vector.y };

    if (this._outOfBounds(nextHead)) {
      this.state.status = 'over';
      return this.getState();
    }

    const nextSnake = this.state.snake.map((segment) => ({ ...segment }));
    const willEatFood =
      this.state.food && nextHead.x === this.state.food.x && nextHead.y === this.state.food.y;

    if (!willEatFood) {
      nextSnake.pop();
    }

    if (this._collides(nextHead, nextSnake)) {
      this.state.status = 'over';
      return this.getState();
    }

    nextSnake.unshift(nextHead);
    this.state.snake = nextSnake;

    if (willEatFood) {
      this.state.score += 1;
      this.state.food = this._spawnFood();
    }

    if (!this.state.food) {
      this.state.status = 'won';
    }

    return this.getState();
  }

  _collides(target, body) {
    return body.some((segment) => segment.x === target.x && segment.y === target.y);
  }

  _outOfBounds({ x, y }) {
    return x < 0 || y < 0 || x >= this.width || y >= this.height;
  }

  _spawnFood() {
    const emptyCells = [];
    const occupied = new Set(this.state.snake.map((segment) => `${segment.x}:${segment.y}`));

    for (let y = 0; y < this.height; y += 1) {
      for (let x = 0; x < this.width; x += 1) {
        const key = `${x}:${y}`;
        if (!occupied.has(key)) {
          emptyCells.push({ x, y });
        }
      }
    }

    if (emptyCells.length === 0) {
      return null;
    }

    const index = Math.floor(this.rng() * emptyCells.length) % emptyCells.length;
    return emptyCells[index];
  }
}
