const fs = require('fs')
const path = require('path')

console.log('🟡 PrizePicks fetcher loaded')

// Absolute path to the file in project root
const FILE_PATH = path.resolve(process.cwd(), 'prizepicksProps.json')

async function fetchPrizePicksProps() {
  console.log('🟡 Loading PrizePicks projections from file...')
  console.log('📁 File path:', FILE_PATH)

  if (!fs.existsSync(FILE_PATH)) {
    throw new Error('prizepicksProps.json not found')
  }

  const raw = fs.readFileSync(FILE_PATH, 'utf-8')
  const json = JSON.parse(raw)

  if (!json || typeof json !== 'object') {
    throw new Error('Invalid JSON in prizepicksProps.json')
  }

  // Handle both possible structures safely
  const data =
    Array.isArray(json.data) ? json.data :
    Array.isArray(json) ? json :
    null

  if (!data || !data.length) {
    throw new Error('No projections found in PrizePicks JSON')
  }

  console.log('🟢 Raw projections loaded:', data.length)

  // Normalize for BeatsEdge
  const props = data.map(p => ({
    player: p.player || p.attributes?.player_name,
    propType: p.propType || `player_${p.attributes?.stat_type?.toLowerCase()}`,
    line: p.line ?? p.attributes?.line_score,
    opponent: p.opponent || p.attributes?.opponent
  }))
  .filter(p =>
    p.player &&
    p.propType &&
    typeof p.line === 'number'
  )

  console.log('🟢 Normalized props:', props.length)

  return props
}

module.exports = { fetchPrizePicksProps }
