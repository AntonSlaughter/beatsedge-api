function calculateHitRate(games, line, statKey) {
  if (!games || games.length === 0) return 0;

  const hits = games.filter(game => game[statKey] >= line).length;

  return Math.round((hits / games.length) * 100);
}

function confidenceFromHitRate(hitRate) {
  if (hitRate >= 70) return 'HIGH';
  if (hitRate >= 55) return 'MEDIUM';
  return 'LOW';
}

module.exports = {
  calculateHitRate,
  confidenceFromHitRate
};
