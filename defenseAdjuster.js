function adjustProbability(baseProb, defensiveRank) {
  let adjustment = 0;

  if (defensiveRank <= 5) adjustment = -0.05;
  else if (defensiveRank >= 25) adjustment = 0.05;

  return Math.max(0, Math.min(1, baseProb + adjustment));
}

module.exports = { adjustProbability };
// defenseAdjuster.js

/**
 * @param {number} baseProb - decimal probability (ex: 0.60)
 * @param {number} defensiveRank - 1 (best defense) to 30 (worst)
 */
function adjustProbability(baseProb, defensiveRank) {
  if (typeof baseProb !== 'number' || isNaN(baseProb)) return baseProb;

  // Normalize rank: 1 → -0.05 | 15 → 0 | 30 → +0.05
  const adjustment = ((defensiveRank - 15) / 15) * 0.05;

  const adjusted = baseProb + adjustment;

  // Clamp between 5% and 95%
  return Math.min(Math.max(adjusted, 0.05), 0.95);
}

module.exports = { adjustProbability };
