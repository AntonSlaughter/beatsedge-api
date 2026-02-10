const fs = require('fs')

const fetch = (...args) =>
  import('node-fetch').then(({ default: fetch }) => fetch(...args))

console.log('🟡 Script started')

async function run() {
  console.log('🟡 Fetching PrizePicks projections...')

  const res = await fetch('https://static.prizepicks.com/projections.json')

  console.log('🟡 HTTP STATUS:', res.status)

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`)
  }

  const json = await res.json()

  console.log('🟢 JSON LOADED')
  console.log('🟢 DATA LENGTH:', json.data?.length)

  fs.writeFileSync(
    'prizepicksProps.json',
    JSON.stringify(json, null, 2)
  )

  console.log('✅ FILE SAVED: prizepicksProps.json')
}

run().catch(err => {
  console.error('❌ SCRIPT FAILED:', err.message)
})
