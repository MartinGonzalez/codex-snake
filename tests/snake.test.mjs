import assert from 'node:assert/strict';
import { SnakeGame } from '../src/snakeGame.js';

function test(name, fn) {
  try {
    fn();
    console.log(`✓ ${name}`);
  } catch (error) {
    console.error(`✗ ${name}`);
    throw error;
  }
}

test('moves forward in the current direction after each tick', () => {
  const game = new SnakeGame({ width: 5, height: 5, rng: () => 0 });
  const state = game.tick();
  assert.equal(state.snake[0].x, 3);
  assert.equal(state.snake[0].y, 2);
  assert.equal(state.snake.length, 3);
});

test('grows immediately when food is consumed', () => {
  const game = new SnakeGame({ width: 6, height: 6, rng: () => 0 });
  const head = game.state.snake[0];
  game.state.food = { x: head.x + 1, y: head.y };
  const afterEat = game.tick();
  assert.equal(afterEat.score, 1);
  assert.equal(afterEat.snake.length, 4);
});

test('detects collisions with walls', () => {
  const game = new SnakeGame({ width: 4, height: 4, rng: () => 0 });
  game.setDirection('up');
  game.tick();
  game.tick();
  const result = game.tick();
  assert.equal(result.status, 'over');
});

test('detects collisions with itself', () => {
  const game = new SnakeGame({ width: 6, height: 6, rng: () => 0 });
  game.state.snake = [
    { x: 2, y: 2 },
    { x: 1, y: 2 },
    { x: 1, y: 3 },
    { x: 2, y: 3 },
    { x: 3, y: 3 },
    { x: 3, y: 2 }
  ];
  game.state.direction = 'left';
  game.state.nextDirection = 'left';
  const result = game.tick();
  assert.equal(result.status, 'over');
});

test('food never spawns on the snake', () => {
  const game = new SnakeGame({ width: 3, height: 3, rng: () => 0.75 });
  game.state.snake = [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 2, y: 0 },
    { x: 2, y: 1 },
    { x: 1, y: 1 },
    { x: 0, y: 1 },
    { x: 0, y: 2 },
    { x: 1, y: 2 }
  ];
  const food = game._spawnFood();
  assert.deepEqual(food, { x: 2, y: 2 });
});

test('shrink removes tail segments while keeping the head', () => {
  const game = new SnakeGame({ width: 6, height: 6, rng: () => 0 });
  game.state.snake = [
    { x: 3, y: 3 },
    { x: 2, y: 3 },
    { x: 1, y: 3 },
    { x: 1, y: 4 },
    { x: 1, y: 5 }
  ];
  const originalHead = { ...game.state.snake[0] };
  const result = game.shrink(2);
  assert.equal(result.snake.length, 3);
  assert.deepEqual(result.snake[0], originalHead);
});

test('extra food slots spawn multiple consumable foods', () => {
  const game = new SnakeGame({ width: 6, height: 6, rng: () => 0.33 });
  const state = game.addExtraFoodSlots(2);
  assert.equal(state.extraFoods.length, 2);
  const uniqueKeys = new Set(state.extraFoods.map((cell) => `${cell.x}:${cell.y}`));
  assert.equal(uniqueKeys.size, 2);
});

test('consuming an extra food increases score and respawns elsewhere', () => {
  const game = new SnakeGame({ width: 6, height: 6, rng: () => 0 });
  game.addExtraFoodSlots(1);
  const target = { x: 3, y: 2 };
  game.state.extraFoods = [target];
  game.extraFoodSlots = 1;
  game.state.food = { x: 5, y: 5 };
  game.state.snake = [
    { x: 2, y: 2 },
    { x: 1, y: 2 },
    { x: 0, y: 2 }
  ];
  game.state.direction = 'right';
  game.state.nextDirection = 'right';
  const beforeScore = game.state.score;
  const result = game.tick();
  assert.equal(result.score, beforeScore + 1);
  assert(result.extraFoods.every((cell) => cell.x !== target.x || cell.y !== target.y));
});

test('clearing extra food slots removes bonus foods', () => {
  const game = new SnakeGame({ width: 5, height: 5, rng: () => 0.1 });
  game.addExtraFoodSlots(2);
  assert(game.getState().extraFoods.length > 0);
  const afterClear = game.clearExtraFoodSlots();
  assert.equal(afterClear.extraFoods.length, 0);
});

test('preferred food placement uses requested coordinate when it is free', () => {
  const game = new SnakeGame({ width: 5, height: 5, rng: () => 0 });
  game.state.snake = [
    { x: 0, y: 0 },
    { x: 0, y: 1 },
    { x: 0, y: 2 }
  ];
  const preferred = { x: 2, y: 2 };
  const result = game.placePreferredFood([preferred]);
  assert.deepEqual(result.food, preferred);
});

test('preferred food placement falls back near center when blocked', () => {
  const game = new SnakeGame({ width: 5, height: 5, rng: () => 0 });
  const center = { x: 2, y: 2 };
  game.state.snake = [center, { x: 2, y: 1 }, { x: 1, y: 1 }];
  const result = game.placePreferredFood([center]);
  assert.notDeepEqual(result.food, center);
  const dx = result.food.x - center.x;
  const dy = result.food.y - center.y;
  assert(dx * dx + dy * dy >= 1);
  assert(dx * dx + dy * dy <= 2); // stays near the center, away from edges
});

test('wall bounce prevents wall death by auto-turning when active', () => {
  const game = new SnakeGame({ width: 4, height: 4, rng: () => 0 });
  game.setWallBounceActive(true);

  // Place head at the right edge heading right.
  game.state.snake = [
    { x: 3, y: 1 },
    { x: 2, y: 1 },
    { x: 1, y: 1 }
  ];
  game.state.direction = 'right';
  game.state.nextDirection = 'right';

  const result = game.tick();
  assert.notEqual(result.status, 'over');
  // rng()=0 -> picks 'up' from ['up','down']
  assert.equal(result.snake[0].x, 3);
  assert.equal(result.snake[0].y, 0);
});
