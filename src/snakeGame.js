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
    this.extraFoodSlots = 0;
    this.magnetRadius = 0;
    this.reset();
  }

  reset() {
    this.extraFoodSlots = 0;
    this.magnetRadius = 0;
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
      food: null,
      extraFoods: []
    };

    this.state.food = this._spawnFood();
    this._syncExtraFoods();
    return this.getState();
  }

  getState() {
    const { snake, food, extraFoods = [], ...rest } = this.state;
    return {
      ...rest,
      snake: snake.map((segment) => ({ ...segment })),
      food: food ? { ...food } : null,
      extraFoods: extraFoods.map((cell) => ({ ...cell }))
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
    const extraFoods = Array.isArray(this.state.extraFoods) ? this.state.extraFoods : [];
    const extraIndex = extraFoods.findIndex((cell) => cell.x === nextHead.x && cell.y === nextHead.y);
    const willEatExtra = extraIndex !== -1;

    let removedTail = null;
    if (!willEatFood && !willEatExtra) {
      removedTail = nextSnake.pop() || null;
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

    if (willEatExtra) {
      this.state.score += 1;
      extraFoods.splice(extraIndex, 1);
    }

    this._applyMagnetAttraction({ removedTail });
    this._syncExtraFoods();

    if (!this.state.food && extraFoods.length === 0) {
      this.state.status = 'won';
    }

    return this.getState();
  }

  dash(steps = 3) {
    if (this.state.status === 'over' || this.state.status === 'won') {
      return this.getState();
    }

    const jumps = Math.max(1, Math.floor(steps));
    let snapshot = this.getState();

    for (let i = 0; i < jumps; i += 1) {
      snapshot = this.tick();
      if (this.state.status !== 'running') {
        break;
      }
    }

    return snapshot;
  }

  shrink(amount = 1) {
    const segmentsToRemove = Math.max(0, Math.floor(amount));
    if (segmentsToRemove === 0) {
      return this.getState();
    }

    const minLength = 1;
    const targetLength = Math.max(minLength, this.state.snake.length - segmentsToRemove);
    while (this.state.snake.length > targetLength) {
      this.state.snake.pop();
    }

    return this.getState();
  }

  addExtraFoodSlots(count = 1) {
    const slots = Math.max(0, Math.floor(count));
    if (slots === 0) {
      return this.getState();
    }

    this.extraFoodSlots += slots;
    this._syncExtraFoods();
    return this.getState();
  }

  setMagnetRadius(radius = 0) {
    const resolved = Math.max(0, Math.floor(radius));
    this.magnetRadius = resolved;
    return this.getState();
  }

  clearExtraFoodSlots() {
    this.extraFoodSlots = 0;
    if (Array.isArray(this.state.extraFoods)) {
      this.state.extraFoods.length = 0;
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
    const emptyCells = this._collectEmptyCells({ includeCurrentFood: false });
    if (emptyCells.length === 0) {
      return null;
    }
    const index = Math.floor(this.rng() * emptyCells.length) % emptyCells.length;
    return emptyCells[index];
  }

  placePreferredFood(preferred = []) {
    const emptyCells = this._collectEmptyCells({ includeCurrentFood: true });
    if (emptyCells.length === 0) {
      this.state.food = null;
      return this.getState();
    }

    for (const candidate of preferred) {
      if (!candidate) continue;
      const match = emptyCells.find((cell) => cell.x === candidate.x && cell.y === candidate.y);
      if (match) {
        this.state.food = { ...match };
        return this.getState();
      }
    }

    const centerX = Math.floor(this.width / 2);
    const centerY = Math.floor(this.height / 2);
    emptyCells.sort((a, b) => {
      return this._distanceSquared(a, centerX, centerY) - this._distanceSquared(b, centerX, centerY);
    });
    this.state.food = { ...emptyCells[0] };
    return this.getState();
  }

  _collectEmptyCells({ includeCurrentFood = true } = {}) {
    const emptyCells = [];
    const occupied = new Set(this.state.snake.map((segment) => `${segment.x}:${segment.y}`));
    if (!includeCurrentFood && this.state.food) {
      occupied.add(`${this.state.food.x}:${this.state.food.y}`);
    }
    const extraFoods = Array.isArray(this.state.extraFoods) ? this.state.extraFoods : [];
    extraFoods.forEach((cell) => occupied.add(`${cell.x}:${cell.y}`));

    for (let y = 0; y < this.height; y += 1) {
      for (let x = 0; x < this.width; x += 1) {
        const key = `${x}:${y}`;
        if (!occupied.has(key)) {
          emptyCells.push({ x, y });
        }
      }
    }

    return emptyCells;
  }

  _distanceSquared(cell, centerX, centerY) {
    const dx = cell.x - centerX;
    const dy = cell.y - centerY;
    return dx * dx + dy * dy;
  }

  _syncExtraFoods() {
    if (!Array.isArray(this.state.extraFoods)) {
      this.state.extraFoods = [];
    }

    while (this.state.extraFoods.length < this.extraFoodSlots) {
      const spawn = this._spawnFood();
      if (!spawn) {
        break;
      }
      this.state.extraFoods.push(spawn);
    }
  }

  _applyMagnetAttraction({ removedTail } = {}) {
    const radius = Math.max(0, this.magnetRadius || 0);
    if (radius === 0) {
      return;
    }

    const head = this.state.snake && this.state.snake[0];
    if (!head) {
      return;
    }

    const grow = () => {
      if (removedTail) {
        this.state.snake.push(removedTail);
        removedTail = null;
        return;
      }
      const tail = this.state.snake[this.state.snake.length - 1];
      if (tail) {
        this.state.snake.push({ ...tail });
      }
    };

    const snakeKeys = new Set(this.state.snake.map((segment) => `${segment.x}:${segment.y}`));

    const foodKeySet = new Set();
    if (this.state.food) {
      foodKeySet.add(`${this.state.food.x}:${this.state.food.y}`);
    }
    const extraFoods = Array.isArray(this.state.extraFoods) ? this.state.extraFoods : [];
    extraFoods.forEach((cell) => foodKeySet.add(`${cell.x}:${cell.y}`));

    const attractPoint = (point) => {
      if (!point) return { moved: false, consumed: false };
      const distance = Math.abs(point.x - head.x) + Math.abs(point.y - head.y);
      if (distance === 0) {
        return { moved: false, consumed: true };
      }
      if (distance > radius) {
        return { moved: false, consumed: false };
      }

      const dx = head.x - point.x;
      const dy = head.y - point.y;
      const xStep = dx === 0 ? 0 : dx > 0 ? 1 : -1;
      const yStep = dy === 0 ? 0 : dy > 0 ? 1 : -1;

      const candidates = [];
      if (Math.abs(dx) >= Math.abs(dy)) {
        if (xStep !== 0) candidates.push({ x: point.x + xStep, y: point.y });
        if (yStep !== 0) candidates.push({ x: point.x, y: point.y + yStep });
      } else {
        if (yStep !== 0) candidates.push({ x: point.x, y: point.y + yStep });
        if (xStep !== 0) candidates.push({ x: point.x + xStep, y: point.y });
      }

      for (const next of candidates) {
        const key = `${next.x}:${next.y}`;
        if (next.x === head.x && next.y === head.y) {
          return { moved: true, consumed: true, next };
        }
        if (snakeKeys.has(key)) {
          continue;
        }
        if (foodKeySet.has(key)) {
          continue;
        }
        return { moved: true, consumed: false, next };
      }

      return { moved: false, consumed: false };
    };

    // Main food.
    if (this.state.food) {
      foodKeySet.delete(`${this.state.food.x}:${this.state.food.y}`);
      const result = attractPoint(this.state.food);
      if (result.consumed) {
        this.state.score += 1;
        grow();
        this.state.food = this._spawnFood();
      } else if (result.moved && result.next) {
        this.state.food = result.next;
      }
      if (this.state.food) {
        foodKeySet.add(`${this.state.food.x}:${this.state.food.y}`);
      }
    }

    // Extra foods.
    for (let i = extraFoods.length - 1; i >= 0; i -= 1) {
      const cell = extraFoods[i];
      foodKeySet.delete(`${cell.x}:${cell.y}`);
      const result = attractPoint(cell);
      if (result.consumed) {
        this.state.score += 1;
        grow();
        extraFoods.splice(i, 1);
      } else if (result.moved && result.next) {
        extraFoods[i] = result.next;
        foodKeySet.add(`${result.next.x}:${result.next.y}`);
      } else {
        foodKeySet.add(`${cell.x}:${cell.y}`);
      }
    }
  }
}
