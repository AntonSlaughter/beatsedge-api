function evaluateProp(games, stat, line) {
  let hits = 0;

  games.forEach(game => {
    if ((game[stat] ?? 0) > line) hits++;
  });

  const total = games.length;
  const hitRate = (hits / total) * 100;

  let recommendation = 'PASS';
  let confidence = 'Low';

  if (hitRate >= 70) {
    recommendation = 'OVER';
    confidence = 'High';
  } else if (hitRate >= 60) {
    recommendation = 'OVER';
    confidence = 'Medium';
  } else if (hitRate >= 50) {
    recommendation = 'LEAN OVER';
  }

  return {
    hits,
    total,
    hitRate: hitRate.toFixed(1),
    recommendation,
    confidence
  };
}

module.exports = { evaluateProp };
