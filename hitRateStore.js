// Simple in-memory store (can later move to DB)
const store = new Map();

/**
 * key = PLAYER-STAT-LINE
 * value = array of last results (1 = hit, 0 = miss)
 */

function recordResult({ player, stat, line, hit }) {
  const key = `${player}-${stat}-${line}`;
  const arr = store.get(key) || [];
  arr.push(hit ? 1 : 0);
  if (arr.length > 10) arr.shift(); // keep L10
  store.set(key, arr);
}

function getHitRate({ player, stat, line }) {
  const key = `${player}-${stat}-${line}`;
  const arr = store.get(key) || [];
  if (arr.length === 0) return null;
  const rate = arr.reduce((a, b) => a + b, 0) / arr.length;
  return { L10: Math.round(rate * 100) };
}

module.exports = { recordResult, getHitRate };
