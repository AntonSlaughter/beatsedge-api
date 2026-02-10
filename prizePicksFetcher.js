const fs = require('fs')
const path = require('path')

function fetchPrizePicksProps() {
  const filePath = path.join(__dirname, 'prizepicksProps.json')

  if (!fs.existsSync(filePath)) {
    throw new Error('prizepicksProps.json not found')
  }

  const raw = fs.readFileSync(filePath, 'utf-8')
  const props = JSON.parse(raw)

  if (!Array.isArray(props)) {
    throw new Error('PrizePicks props file is not an array')
  }

  console.log(`✅ LOCAL PROPS LOADED: ${props.length}`)
  console.log('🎯 SAMPLE:', props.slice(0, 3))

  return props
}

module.exports = { fetchPrizePicksProps }
