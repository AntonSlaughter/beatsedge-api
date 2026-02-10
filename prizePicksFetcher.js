const fs = require('fs')
const path = require('path')

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

let cachedProps = null

function fetchPrizePicksProps() {
  if (cachedProps) return cachedProps

  const filePath = path.join(__dirname, 'prizepicksProps.json')
  const raw = fs.readFileSync(filePath, 'utf8')
  const json = JSON.parse(raw)

  const players = {}
  for (const item of json.included || []) {
    if (item.type === 'new_player') {
      players[item.id] = item.attributes?.name
    }
  }

  const props = []

  for (const proj of json.data || []) {
    const attrs = proj.attributes
    const rel = proj.relationships

    const playerId = rel?.new_player?.data?.id
    const playerName = players[playerId]
    const statKey = STAT_MAP[attrs?.stat_display_name]

    if (!playerName || !statKey || attrs.line_score == null) continue

    props.push({
      player: playerName,
      propType: statKey,
      line: Number(attrs.line_score),
      opponent: null
    })
  }

  console.log(`✅ LOCAL PROPS LOADED: ${props.length}`)

  cachedProps = props
  return props
}

module.exports = { fetchPrizePicksProps }
