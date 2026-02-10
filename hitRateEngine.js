function calculateHitRate(games, statFn, line) {
  if (typeof statFn !== 'function') {
    throw new Error('statFn is not a function')
  }

  let hits = 0
  let total = 0

  for (const game of games) {
    const value = statFn(game)
    if (typeof value !== 'number') continue

    total++
    if (value > line) hits++
  }

  const hitRate = total ? hits / total : 0

  return {
    hits,
    total,
    hitRate
  }
}

module.exports = { calculateHitRate }
