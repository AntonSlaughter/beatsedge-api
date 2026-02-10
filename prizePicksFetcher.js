const fetch = (...args) =>
  import('node-fetch').then(({ default: fetch }) => fetch(...args))

/* ================= STAT NORMALIZATION ================= */
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

/* ================= FETCH PROPS ================= */
async function fetchPrizePicksProps() {
  const res = await fetch('https://api.prizepicks.com/projections', {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      'Accept': 'application/json',
      'Accept-Language': 'en-US,en;q=0.9',
      'Origin': 'https://app.prizepicks.com',
      'Referer': 'https://app.prizepicks.com/',
      'Connection': 'keep-alive'
    }
  })

  if (!res.ok) {
    throw new Error(`PrizePicks HTTP ${res.status}`)
  }

  const text = await res.text()

  if (text.startsWith('<')) {
    throw new Error('PrizePicks blocked request (HTML response)')
  }

  const json = JSON.parse(text)

  /* ================= BUILD PLAYER MAP ================= */
  const players = {}
  for (const item of json.included || []) {
    if (item.type === 'new_player') {
      players[item.id] = item.attributes?.name
    }
  }

  /* ================= NORMALIZE PROPS ================= */
  const props = []

  for (const proj of json.data || []) {
    const attrs = proj.attributes
    const rel = proj.relationships

    const playerId = rel?.new_player?.data?.id
    const playerName = players[playerId]

    if (!playerName) continue
    if (!attrs?.stat_display_name) continue
    if (attrs.line_score == null) continue

    const statKey = STAT_MAP[attrs.stat_display_name]
    if (!statKey) continue

    props.push({
      player: playerName,
      propType: statKey,
      line: Number(attrs.line_score),
      opponent: null
    })
  }

  console.log(`✅ NORMALIZED PROPS: ${props.length}`)
  console.log('🎯 SAMPLE:', props.slice(0, 3))

  return props
}

module.exports = { fetchPrizePicksProps }
