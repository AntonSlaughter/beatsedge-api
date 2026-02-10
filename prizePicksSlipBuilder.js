module.exports.buildPrizePicksSlip = function buildPrizePicksSlip(
  props,
  legs
) {
  if (!Array.isArray(props) || props.length === 0) return null

  // PrizePicks ONLY cares about model confidence
  const eligible = props
    .filter(p =>
      p.bookmaker === 'prizepicks' &&
      typeof p.modelProb === 'number' &&
      p.modelProb >= 0.55
    )
    .sort((a, b) => b.modelProb - a.modelProb)

  if (eligible.length < legs) return null

  return {
    platform: 'PrizePicks',
    legs,
    picks: eligible.slice(0, legs).map(p => ({
      player: p.player,
      prop: p.propType,
      line: p.line,
      modelProb: Number(p.modelProb.toFixed(3)),
      confidence: p.confidence
    }))
  }
}
