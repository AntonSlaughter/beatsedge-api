const fetch = require('node-fetch')

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

async function fetchPrizePicksProps() {
  const res = await fetch('https://api.prizepicks.com/projections')
  const json = await res.json()

  const players = {}
  for (const item of json.included || []) {
    if (item.type === 'new_player') {
      players[item.id] = item.attributes.name
    }
  }

  const props = []

  for (const proj of json.data || []) {
    const attrs = proj.attributes
    const rel = proj.relationships

    const playerId = rel?.new_player?.data?.id
    const playerName = players[playerId]

    if (!playerName) continue

    const statKey = STAT_MAP[attrs.stat_display_name]
    if (!statKey) continue

    props.push({
      player: playerName,
      propType: statKey,
      line: attrs.line_score,
      opponent: null
    })
  }

  console.log('✅ NORMALIZED PROPS:', props.length)
  console.log('🎯 SAMPLE:', props.slice(0, 3))

  return props
}

module.exports = { fetchPrizePicksProps }
