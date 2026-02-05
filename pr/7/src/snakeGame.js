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
      foods: [],
      ateFood: null
    };

    return this.getState();
  }

  getState() {
    const { snake, foods, ateFood, ...rest } = this.state;
    return {
      ...rest,
      snake: snake.map((segment) => ({ ...segment })),
      foods: Array.isArray(foods) ? foods.map((food) => ({ ...food })) : [],
      ateFood: ateFood ? { ...ateFood } : null
    };
  }

  setFoods(foods = []) {
    this.state.foods = Array.isArray(foods) ? foods.map((food) => ({ ...food })) : [];
    return this.getState();
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

    this.state.ateFood = null;

    this.state.direction = this.state.nextDirection;
    const head = this.state.snake[0];
    const vector = DIRECTIONS[this.state.direction];
    let nextHead = { x: head.x + vector.x, y: head.y + vector.y };

    if (this._outOfBounds(nextHead)) {
      nextHead = this._wrapPoint(nextHead);
    }

    const foods = Array.isArray(this.state.foods) ? this.state.foods : [];
    const foodIndex = foods.findIndex((food) => food.x === nextHead.x && food.y === nextHead.y);
    const willEat = foodIndex !== -1;

    const nextSnake = this.state.snake.map((segment) => ({ ...segment }));
    if (!willEat) {
      nextSnake.pop();
    }

    if (this._collides(nextHead, nextSnake)) {
      this.state.status = 'over';
      return this.getState();
    }

    nextSnake.unshift(nextHead);
    this.state.snake = nextSnake;

    if (willEat) {
      const eaten = foods.splice(foodIndex, 1)[0];
      this.state.foods = foods;
      this.state.score += 1;
      this.state.ateFood = eaten;
    }

    return this.getState();
  }

  collectEmptyCells() {
    const occupied = new Set(this.state.snake.map((segment) => `${segment.x}:${segment.y}`));
    const foods = Array.isArray(this.state.foods) ? this.state.foods : [];
    foods.forEach((food) => occupied.add(`${food.x}:${food.y}`));

    const empty = [];
    for (let y = 0; y < this.height; y += 1) {
      for (let x = 0; x < this.width; x += 1) {
        const key = `${x}:${y}`;
        if (!occupied.has(key)) empty.push({ x, y });
      }
    }
    return empty;
  }

  _collides(target, body) {
    return body.some((segment) => segment.x === target.x && segment.y === target.y);
  }

  _outOfBounds({ x, y }) {
    return x < 0 || y < 0 || x >= this.width || y >= this.height;
  }

  _wrapPoint({ x, y }) {
    const wrap = (value, max) => ((value % max) + max) % max;
    return { x: wrap(x, this.width), y: wrap(y, this.height) };
  }
}
