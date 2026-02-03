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
