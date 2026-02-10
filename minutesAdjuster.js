function adjustForMinutes(hitRate, avgMinutes) {
  if (!avgMinutes || avgMinutes <= 0) return hitRate;

  // Baseline: 34 minutes = neutral
  const baseline = 34;

  const multiplier = avgMinutes / baseline;

  // Cap adjustment (no crazy swings)
  const cappedMultiplier = Math.min(Math.max(multiplier, 0.85), 1.15);

  return hitRate * cappedMultiplier;
}

module.exports = { adjustForMinutes };
