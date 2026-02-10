function adjustForLocation(probability, isHome) {
  const adjustment = isHome ? 0.05 : -0.05;

  const adjusted = probability + adjustment;

  return Math.max(0.05, Math.min(0.95, adjusted));
}

module.exports = { adjustForLocation };
