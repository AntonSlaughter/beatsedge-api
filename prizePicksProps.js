function buildPrizePicksProps(games, playerName) {
  const props = [];

  const last10 = games.slice(0, 10);

  const avg = stat =>
    last10.reduce((s, g) => s + (g[stat] || 0), 0) / last10.length;

  props.push(
    { propType: 'points', line: avg('points'), platform: 'PrizePicks' },
    { propType: 'rebounds', line: avg('rebounds'), platform: 'PrizePicks' },
    { propType: 'assists', line: avg('assists'), platform: 'PrizePicks' },
    { propType: 'points+rebounds', line: avg('points') + avg('rebounds'), platform: 'PrizePicks' },
    { propType: 'points+assists', line: avg('points') + avg('assists'), platform: 'PrizePicks' },
    { propType: 'rebounds+assists', line: avg('rebounds') + avg('assists'), platform: 'PrizePicks' },
    {
      propType: 'points+rebounds+assists',
      line: avg('points') + avg('rebounds') + avg('assists'),
      platform: 'PrizePicks'
    },
    {
      propType: 'fantasy',
      line:
        avg('points') +
        avg('rebounds') * 1.2 +
        avg('assists') * 1.5,
      platform: 'PrizePicks'
    }
  );

  return props;
}

module.exports = { buildPrizePicksProps };
