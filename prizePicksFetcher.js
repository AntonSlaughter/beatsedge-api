const fs = require('fs')
const path = require('path')

async function fetchPrizePicksProps() {
  const filePath = path.join(__dirname, 'prizepicksProps.json')

  if (!fs.existsSync(filePath)) {
    throw new Error('Local PrizePicks file missing')
  }

  const raw = fs.readFileSync(filePath, 'utf8')
  const json = JSON.parse(raw)

  return json.data.map(p => ({
    player: p.attributes.name,
    propType: p.attributes.stat_type,
    line: p.attributes.line_score,
    opponent: p.attributes.opponent
  }))
}

module.exports = { fetchPrizePicksProps }
