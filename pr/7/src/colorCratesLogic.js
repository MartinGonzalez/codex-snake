const DEFAULT_COLORS = ['red', 'yellow', 'green', 'purple', 'blue', 'orange'];

export function pickDistinctColors(count, { colors = DEFAULT_COLORS, rng = Math.random } = {}) {
  const pool = Array.from(new Set(colors));
  if (count > pool.length) {
    throw new Error(`Cannot pick ${count} distinct colors from pool of ${pool.length}`);
  }
  // Fisher-Yates shuffle.
  for (let i = pool.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, count);
}

export function createCrates(
  crateCount,
  {
    slotsPerCrate = 3,
    activeCount = 2,
    colors = DEFAULT_COLORS,
    rng = Math.random
  } = {}
) {
  const picked = pickDistinctColors(crateCount, { colors, rng });
  return picked.map((color, index) => ({
    color,
    filled: 0,
    slots: slotsPerCrate,
    locked: index >= activeCount,
    justCompleted: false
  }));
}

export function getActiveCrateColors(crates, activeCount = 2) {
  return crates.slice(0, activeCount).map((crate) => crate.color);
}

function chooseReplacementColor(crates, { colors = DEFAULT_COLORS, rng = Math.random } = {}) {
  const used = new Set(crates.map((crate) => crate.color));
  const candidates = colors.filter((color) => !used.has(color));
  if (candidates.length === 0) {
    // Should not happen if pool has at least crates.length+1 colors.
    return colors[Math.floor(rng() * colors.length) % colors.length];
  }
  const idx = Math.floor(rng() * candidates.length) % candidates.length;
  return candidates[idx];
}

function pullFromTrashIntoCrate(trash, crate) {
  let moved = 0;
  for (let i = trash.length - 1; i >= 0; i -= 1) {
    if (crate.filled >= crate.slots) break;
    if (trash[i] !== crate.color) continue;
    trash.splice(i, 1);
    crate.filled += 1;
    moved += 1;
  }
  return moved;
}

/**
 * Apply a consumed food color to either active crates or the trash.
 * Mutates crates+trash in-place for performance, but also returns a summary.
 */
export function applyConsumedColor({
  color,
  crates,
  trash,
  activeCount = 2,
  trashCapacity = 5,
  colorsPool = DEFAULT_COLORS,
  rng = Math.random
} = {}) {
  if (!color || !Array.isArray(crates) || !Array.isArray(trash)) {
    throw new Error('applyConsumedColor requires {color, crates, trash}');
  }

  crates.forEach((crate) => {
    crate.justCompleted = false;
  });

  const activeColors = new Set(getActiveCrateColors(crates, activeCount));
  const matchingIndex = crates
    .slice(0, activeCount)
    .findIndex((crate) => crate.color === color && crate.filled < crate.slots);

  if (matchingIndex === -1) {
    trash.push(color);
    return {
      completedCrates: 0,
      gameOver: trash.length >= trashCapacity
    };
  }

  const crate = crates[matchingIndex];
  crate.filled += 1;

  let completedCrates = 0;

  const resolveCompletions = () => {
    // If completed, replace and pull matching trash.
    if (crate.filled < crate.slots) return;

    completedCrates += 1;
    crate.justCompleted = true;
    crate.filled = 0;
    crate.color = chooseReplacementColor(crates, { colors: colorsPool, rng });

    // Pull items from trash into this new crate color.
    pullFromTrashIntoCrate(trash, crate);

    // Chain: if the pull fills it completely, complete again.
    if (crate.filled >= crate.slots) {
      // Prevent infinite loops if colorsPool is tiny.
      // With the default pool (6) and crates (4) this is safe.
      resolveCompletions();
    }
  };

  resolveCompletions();

  return {
    completedCrates,
    gameOver: false
  };
}
