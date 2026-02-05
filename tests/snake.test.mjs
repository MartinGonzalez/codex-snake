import assert from 'node:assert/strict';
import { SnakeGame } from '../src/snakeGame.js';
import { applyConsumedColor, createCrates, finalizeCrateReplacement } from '../src/colorCratesLogic.js';

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
  const game = new SnakeGame({ width: 5, height: 5 });
  const state = game.tick();
  assert.equal(state.snake[0].x, 3);
  assert.equal(state.snake[0].y, 2);
  assert.equal(state.snake.length, 3);
});

test('grows immediately when any food is consumed (multi-food)', () => {
  const game = new SnakeGame({ width: 6, height: 6 });
  const head = game.state.snake[0];
  game.setFoods([{ x: head.x + 1, y: head.y, color: 'red' }]);
  const afterEat = game.tick();
  assert.equal(afterEat.score, 1);
  assert.equal(afterEat.snake.length, 4);
  assert(afterEat.ateFood);
  assert.equal(afterEat.ateFood.color, 'red');
  assert.equal(afterEat.foods.length, 0);
});

test('wraps around when crossing walls (teleport)', () => {
  const game = new SnakeGame({ width: 4, height: 4 });
  game.setDirection('up');

  // Default starts centered at y=2. Move to y=-1 which should wrap to 3.
  game.tick();
  game.tick();
  const result = game.tick();

  assert.notEqual(result.status, 'over');
  assert.equal(result.snake[0].y, 3);
});

test('detects collisions with itself', () => {
  const game = new SnakeGame({ width: 6, height: 6 });
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

test('wrong color goes to trash and losing occurs at capacity', () => {
  const rng = () => 0; // deterministic replacement selection
  const crates = createCrates(4, {
    colors: ['red', 'yellow', 'green', 'purple', 'blue', 'orange'],
    rng
  });

  // Force active crates to known colors.
  crates[0].color = 'red';
  crates[1].color = 'yellow';
  crates[2].color = 'green';
  crates[3].color = 'purple';

  const trash = [];
  for (let i = 0; i < 4; i += 1) {
    const res = applyConsumedColor({ color: 'blue', crates, trash, rng });
    assert.equal(res.gameOver, false);
  }
  assert.equal(trash.length, 4);

  const last = applyConsumedColor({ color: 'blue', crates, trash, rng });
  assert.equal(trash.length, 5);
  assert.equal(last.gameOver, true);
});

test('matching active crate fills, completes at 3, animates, then replaces color and pulls from trash', () => {
  // rng sequence: pick last candidate by returning 0.99
  const rng = (() => {
    const seq = [0.99, 0.99, 0.99];
    let i = 0;
    return () => seq[Math.min(i++, seq.length - 1)];
  })();

  const crates = createCrates(4, {
    colors: ['red', 'yellow', 'green', 'purple', 'blue', 'orange'],
    rng
  });

  crates[0].color = 'red';
  crates[1].color = 'yellow';
  crates[2].color = 'green';
  crates[3].color = 'purple';

  const trash = ['blue', 'blue'];

  applyConsumedColor({ color: 'red', crates, trash, rng });
  applyConsumedColor({ color: 'red', crates, trash, rng });

  // Third fills the crate -> completion should mark it as completing with a pending color.
  const res = applyConsumedColor({ color: 'red', crates, trash, rng });
  assert.equal(res.completedCrates, 1);
  assert.equal(crates[0].isCompleting, true);
  assert.notEqual(crates[0].pendingColor, null);

  // Finalize after the animation delay.
  const beforeColor = crates[0].color;
  finalizeCrateReplacement({ crate: crates[0], crates, trash, rng });

  assert.equal(crates[0].isCompleting, false);
  assert.notEqual(crates[0].color, beforeColor);
  assert(!['yellow', 'green', 'purple'].includes(crates[0].color));

  // If replacement color becomes 'blue', it should pull from trash.
  if (crates[0].color === 'blue') {
    assert.equal(trash.length, 0);
    assert.equal(crates[0].filled, 2);
  }
});
