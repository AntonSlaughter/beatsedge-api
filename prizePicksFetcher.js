const data = require('./prizepicksProps.json')

const STAT_MAP = {
  'Points': 'player_points',
  'Rebounds': 'player_rebounds',
  'Assists': 'player_assists',
  'Pts+Rebs+Asts': 'player_points_rebounds_assists',
  'Pts+Rebs': 'player_points_rebounds',
  'Pts+Asts': 'player_points_assists',
  'Rebs+Asts': 'player_rebounds_assists',
  'Fantasy Score': 'player_fantasy_points'
}

function fetchPrizePicksProps() {
  const players = {}
  for (const item of data.included || []) {
    if (item.type === 'new_player') {
      players[item.id] = item.attributes?.name
    }
  }

  const props = []

  for (const proj of data.data || []) {
    const attrs = proj.attributes
    const rel = proj.relationships

    const playerName = players[rel?.new_player?.data?.id]
    if (!playerName) continue

    const statKey = STAT_MAP[attrs.stat_display_name]
    if (!statKey) continue

    props.push({
      player: playerName,
      propType: statKey,
      line: Number(attrs.line_score),
      opponent: null
    })
  }

  console.log(`✅ LOCAL PROPS LOADED: ${props.length}`)
  return props
}

module.exports = { fetchPrizePicksProps }
