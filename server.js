require('dotenv').config()

const express = require('express')
const path = require('path')
const { execFile } = require('child_process')

const { fetchPrizePicksProps } = require('./prizePicksFetcher')
const { calculateHitRate } = require('./hitRateEngine')
const { adjustProbability } = require('./defenseAdjuster')
const { adjustForLocation } = require('./locationAdjuster')
const { adjustForMinutes } = require('./minutesAdjuster')
const { buildPrizePicksSlip } = require('./prizePicksSlipBuilder')

const defenseRanks = require('./defenseRanks.json')
const playerMap = require('./playerMap.json')

const app = express()
const PORT = process.env.PORT || 3000

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'))
})
/* ================= MIDDLEWARE ================= */
app.use(express.json())
app.use(express.static(path.join(__dirname, 'public')))

/* ================= CACHE ================= */
const PLAYER_TTL = 10 * 60 * 1000
const EDGES_TTL = 5 * 60 * 1000

const playerGameCache = {}
let edgesCache = {
  data: [],
  timestamp: 0,
  building: false
}

global.cachedEdges = []

/* ================= UTILS ================= */
const sleep = ms => new Promise(r => setTimeout(r, ms))

function getConfidenceGrade(prob) {
  if (prob >= 0.65) return 'A+'
  if (prob >= 0.62) return 'A'
  if (prob >= 0.58) return 'B'
  if (prob >= 0.54) return 'C'
  return 'D'
}

/* ================= HEALTH ================= */
app.get('/api/health', (_, res) => {
  res.json({ status: 'ok' })
})

/* ================= NBA STATS ================= */
function getPlayerGames(playerId, count = 10) {
  const cached = playerGameCache[playerId]
  const now = Date.now()

  if (cached && now - cached.timestamp < PLAYER_TTL) {
    return Promise.resolve(cached.games)
  }

  return new Promise((resolve, reject) => {
    execFile(
      'python',
      [path.join(__dirname, 'nba_stats.py'), playerId, count],
      (err, stdout) => {
        if (err) return reject(err)
        try {
          const games = JSON.parse(stdout)
          playerGameCache[playerId] = { games, timestamp: now }
          resolve(games)
        } catch {
          reject(new Error('Invalid NBA stats JSON'))
        }
      }
    )
  })
}

/* ================= PLAYER PROPS ================= */
app.get('/api/player-props', async (_, res) => {
  try {
    const props = await fetchPrizePicksProps()
    console.log('TOTAL PrizePicks props:', props.length)
    res.json(props)
  } catch {
    res.status(500).json({ error: 'Failed to fetch PrizePicks props' })
  }
})

/* ================= EDGE BUILDER (CORE) ================= */
async function buildEdges() {
  if (edgesCache.building) return
  edgesCache.building = true

  try {
    const props = await fetchPrizePicksProps()
    const edges = []

    console.log('🔨 Building edges from props:', props.length)

    const MAX_PROPS = 60

    for (const prop of props.slice(0, MAX_PROPS)) {
      if (!prop.player || !prop.propType || prop.line == null) continue

      const playerId = playerMap[prop.player]
      if (!playerId) continue

      const games = await getPlayerGames(playerId, 10)
      if (!Array.isArray(games) || games.length < 5) continue

      /* ✅ SAFE STAT FUNCTION MAP */
      const statFnMap = {
        player_points: g => g.points,
        player_rebounds: g => g.rebounds,
        player_assists: g => g.assists,
        player_threes: g => g.threes,
        player_points_rebounds_assists: g =>
          g.points + g.rebounds + g.assists,
        player_points_rebounds: g => g.points + g.rebounds,
        player_points_assists: g => g.points + g.assists,
        player_rebounds_assists: g => g.rebounds + g.assists,
        player_fantasy_points: g => g.fantasy
      }

      const statFn = statFnMap[prop.propType]
      if (typeof statFn !== 'function') continue

      /* ✅ CORRECT calculateHitRate USAGE */
      const { hitRate } = calculateHitRate(games, statFn, prop.line)
      if (!hitRate || hitRate < 0.55) continue

      let prob = adjustProbability(
        hitRate,
        defenseRanks[prop.opponent]?.[prop.propType] ?? 15
      )

      prob = adjustForLocation(
        prob,
        games[0]?.matchup?.includes('vs') ?? false
      )

      const avgMinutes =
        games.reduce((s, g) => s + (g.minutes || 0), 0) / games.length

      prob = adjustForMinutes(prob, avgMinutes)

      edges.push({
        player: prop.player,
        propType: prop.propType,
        line: prop.line,
        bookmaker: 'prizepicks',
        modelProb: Number(prob.toFixed(3)),
        confidence: getConfidenceGrade(prob)
      })

      await sleep(150)
    }

    edgesCache = {
      data: edges,
      timestamp: Date.now(),
      building: false
    }

    global.cachedEdges = edges

    console.log('✅ TOTAL EDGES BUILT:', edges.length)
  } catch (err) {
    edgesCache.building = false
    console.error('❌ Edge build failed:', err.message)
  }
}

/* ================= EDGE API ================= */
app.get('/api/edges/today', async (_, res) => {
  const now = Date.now()

  if (
    edgesCache.data.length &&
    now - edgesCache.timestamp < EDGES_TTL
  ) {
    return res.json(edgesCache.data)
  }

  buildEdges() // background refresh
  res.json(edgesCache.data)
})

/* ================= PRIZEPICKS SLIPS ================= */
app.get('/api/prizepicks/slips', (req, res) => {
  const legs = parseInt(req.query.legs || '2', 10)

  if (!global.cachedEdges.length) {
    return res.status(400).json({ error: 'Edges not built yet' })
  }

  const slip = buildPrizePicksSlip(global.cachedEdges, legs)
  if (!slip) {
    return res.status(400).json({ error: 'Not enough eligible props' })
  }

  res.json(slip)
})

/* ================= AUTO REFRESH ================= */
setInterval(buildEdges, 60 * 60 * 1000) // hourly
buildEdges() // initial warmup

/* ================= START ================= */
app.listen(PORT, () => {
  console.log(`🚀 BeatsEdge running → http://localhost:${PORT}`)
})
