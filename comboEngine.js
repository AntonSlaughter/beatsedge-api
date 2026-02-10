function calculatePRA(games, line) {
  if (!Array.isArray(games) || games.length === 0) {
    return null;
  }

  let hits = 0;

  games.forEach(game => {
    const pra = game.points + game.rebounds + game.assists;
    if (pra >= line) hits++;
  });

  const hitRate = Math.round((hits / games.length) * 100);

  return {
    line,
    games: games.length,
    hits,
    hitRate,
    recommendation: hitRate >= 60 ? 'OVER' : 'PASS'
  };
}

module.exports = { calculatePRA };
