const fetch = require('node-fetch')

async function testFetch() {
  try {
    const res = await fetch('https://api.prizepicks.com/projections', {
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'Accept': 'application/json'
      }
    })

    const json = await res.json()
    console.log('✅ FETCH SUCCESS')
    console.log('Projections:', json?.data?.length)
  } catch (err) {
    console.error('❌ FETCH FAILED:', err.message)
  }
}

testFetch()
