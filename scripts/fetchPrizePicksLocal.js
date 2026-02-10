const fetch = (...args) =>
  import('node-fetch').then(({ default: fetch }) => fetch(...args))

console.log('🟡 PrizePicks fetcher loaded')

async function fetchPrizePicksProps() {
  console.log('🟡 Fetching PrizePicks projections...')

  const res = await fetch(
    'https://static.prizepicks.com/projections.json',
    {
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'Accept': 'application/json'
      }
    }
  )

  console.log('🟡 HTTP STATUS:', res.status)

  if (!res.ok) {
    throw new Error(`PrizePicks HTTP ${res.status}`)
  }

  const json = await res.json()

  if (!json?.data || !Array.isArray(json.data)) {
    throw new Error('Invalid PrizePicks JSON structure')
  }

  console.log('🟢 PrizePicks projections loaded:', json.data.length)

  // Normalize for BeatsEdge
  return json.data.map(p => ({
    player: p.attributes?.player_name,
    propType: `player_${p.attributes?.stat_type?.toLowerCase()}`,
    line: p.attributes?.line_score,
    opponent: p.attributes?.opponent
  })).filter(p =>
    p.player &&
    p.propType &&
    typeof p.line === 'number'
  )
}

module.exports = { fetchPrizePicksProps }
