const API_BASE = 'https://beatsedge-api-production-ed84.up.railway.app'

const output = document.getElementById('output')

function show(data) {
  output.textContent = JSON.stringify(data, null, 2)
}

async function loadProps() {
  output.textContent = 'Loading PrizePicks props...'
  const res = await fetch(`${API_BASE}/api/player-props`)
  const data = await res.json()
  show(data.slice(0, 20)) // show first 20 only
}

async function loadEdges() {
  output.textContent = 'Building edges (this may take a moment)...'
  const res = await fetch(`${API_BASE}/api/edges/today`)
  const data = await res.json()
  show(data)
}

async function loadSlip() {
  output.textContent = 'Building PrizePicks slip...'
  const res = await fetch(`${API_BASE}/api/prizepicks/slips?legs=2`)
  const data = await res.json()
  show(data)
}
