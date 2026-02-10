const axios = require('axios')

async function fetchPrizePicksProps() {
  const res = await axios.get(
    'https://api.prizepicks.com/projections',
    {
      params: { league_id: 7 }, // NBA
      headers: {
        'User-Agent': 'Mozilla/5.0',
        Accept: 'application/json'
      },
      timeout: 15000
    }
  )

  const includedPlayers = {}

  /* ================= PLAYER LOOKUP ================= */
  for (const item of res.data.included || []) {
    if (item.type === 'new_player' && item.attributes?.name) {
      includedPlayers[item.id] = item.attributes.name
    }
  }

  /* ================= STAT MAP ================= */
  const statMap = {
    Points: 'player_points',
    Rebounds: 'player_rebounds',
    Assists: 'player_assists',
    '3-PT Made': 'player_threes',
    'Pts+Rebs+Asts': 'player_points_rebounds_assists',
    'Pts+Rebs': 'player_points_rebounds',
    'Pts+Asts': 'player_points_assists',
    'Rebs+Asts': 'player_rebounds_assists',
    'Fantasy Score': 'player_fantasy_points'
  }

  /* ================= BUILD PROPS ================= */
  const props = (res.data.data || [])
    .map(p => {
      const a = p.attributes
      if (!a) return null

      const playerRelId = p.relationships?.new_player?.data?.id
      const playerName = includedPlayers[playerRelId]

      const propType = statMap[a.stat_type]
      const line = Number(a.line_score)

      if (!playerName || !propType || !Number.isFinite(line)) {
        return null
      }

      return {
        player: playerName,
        propType,
        line,
        opponent: a.opponent ?? null
      }
    })
    .filter(Boolean)

  console.log('✅ PrizePicks NBA props:', props.length)
  console.log('🎯 SAMPLE:', props.slice(0, 3))

  return props
}

module.exports = { fetchPrizePicksProps }
