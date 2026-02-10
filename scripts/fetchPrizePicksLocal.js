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
  const res = await fetch('https://api.prizepicks.com/projections', {
    headers: {
      'User-Agent': 'Mozilla/5.0',
      'Accept': 'application/json'
    }
  })

  const json = await res.json()

  const included = json.included || []
  const players = {}

  // Build player lookup
  for (const item of included) {
    if (item.type === 'new_player') {
      players[item.id] = item.attributes?.display_name
    }
  }

  const props = []

  for (const proj of json.data) {
    const attrs = proj.attributes
    if (!attrs?.today || attrs.status !== 'pre_game') continue

    const playerId = proj.relationships?.new_player?.data?.id
    const playerName = players[playerId]
    if (!playerName) continue

    const propType = STAT_MAP[attrs.stat_display_name]
    if (!propType) continue

    props.push({
      player: playerName,
      propType,
      line: Number(attrs.line_score),
      opponent: attrs.description?.split('/')[1] || null
    })
  }

  console.log(`✅ Parsed PrizePicks props: ${props.length}`)
  return props
}

module.exports = { fetchPrizePicksProps }
