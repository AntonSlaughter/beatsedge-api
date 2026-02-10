const axios = require('axios')

const PRIZEPICKS_URL =
  'https://api.prizepicks.com/projections?league_id=7'

async function fetchPrizePicksProps() {
  try {
    const res = await axios.get(PRIZEPICKS_URL, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        Accept: 'application/json'
      },
      timeout: 15000
    })

    if (!res.data?.data) {
      throw new Error('No data field in PrizePicks response')
    }

    return res.data.data.map(p => ({
      player: p.attributes?.name,
      propType: p.attributes?.stat_type,
      line: p.attributes?.line_score,
      opponent: null
    }))
  } catch (err) {
    console.error('❌ PrizePicks fetch failed:', err.message)
    throw err
  }
}

module.exports = { fetchPrizePicksProps }
