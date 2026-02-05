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
    justCompleted: false,
    isCompleting: false,
    pendingColor: null
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

  const matchingIndex = crates
    .slice(0, activeCount)
    .findIndex((crate) => crate.color === color && !crate.isCompleting && crate.filled < crate.slots);

  if (matchingIndex === -1) {
    trash.push(color);
    return {
      completedCrates: 0,
      gameOver: trash.length >= trashCapacity
    };
  }

  const crate = crates[matchingIndex];
  crate.filled += 1;

  if (crate.filled < crate.slots) {
    return {
      completedCrates: 0,
      gameOver: false
    };
  }

  // Completion is a two-step process:
  // 1) mark the crate as completing (UI can animate it flying up)
  // 2) after a delay, the caller should finalize the replacement
  crate.justCompleted = true;
  crate.isCompleting = true;
  crate.pendingColor = chooseReplacementColor(crates, { colors: colorsPool, rng });

  return {
    completedCrates: 1,
    gameOver: false
  };
}

/**
 * Finalize a crate replacement after the completion animation finishes.
 * This applies the pending color, resets fill, and pulls matching trash.
 *
 * Returns how many crate completions were caused by trash pulling.
 */
export function finalizeCrateReplacement({
  crate,
  crates,
  trash,
  trashCapacity = 5,
  colorsPool = DEFAULT_COLORS,
  rng = Math.random
} = {}) {
  if (!crate || !Array.isArray(crates) || !Array.isArray(trash)) {
    throw new Error('finalizeCrateReplacement requires {crate, crates, trash}');
  }

  if (!crate.isCompleting || !crate.pendingColor) {
    return { completedCrates: 0, gameOver: trash.length >= trashCapacity };
  }

  crate.isCompleting = false;
  crate.justCompleted = false;
  crate.color = crate.pendingColor;
  crate.pendingColor = null;
  crate.filled = 0;

  pullFromTrashIntoCrate(trash, crate);

  // If trash pull instantly fills the crate, mark another completion (to be finalized later).
  if (crate.filled >= crate.slots) {
    crate.justCompleted = true;
    crate.isCompleting = true;
    crate.pendingColor = chooseReplacementColor(crates, { colors: colorsPool, rng });
    return { completedCrates: 1, gameOver: trash.length >= trashCapacity };
  }

  return { completedCrates: 0, gameOver: trash.length >= trashCapacity };
}
