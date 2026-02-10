require('dotenv').config()

/* ================= CORE IMPORTS ================= */
const express = require('express')
const path = require('path')
const { execFile } = require('child_process')

/* ================= INTERNAL MODULES ================= */
const { fetchPrizePicksProps } = require('./prizePicksFetcher')
const { calculateHitRate } = require('./hitRateEngine')
const { adjustProbability } = require('./defenseAdjuster')
const { adjustForLocation } = require('./locationAdjuster')
const { adjustForMinutes } = require('./minutesAdjuster')
const { buildPrizePicksSlip } = require('./prizePicksSlipBuilder')

/* ================= DATA ================= */
const defenseRanks = require('./defenseRanks.json')
const playerMap = require('./playerMap.json')

/* ================= APP SETUP ================= */
const app = express()
const PORT = process.env.PORT || 3000

/* ================= MIDDLEWARE ================= */
app.use(express.json())
app.use(express.static(path.join(__dirname, 'public')))

/* ================= ROOT ================= */
app.get('/', (_, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'))
})

/* ================= HEALTH ================= */
app.get('/api/health', (_, res) => {
  res.json({ status: 'ok' })
})

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

/* ================= UTILITIES ================= */
const sleep = ms => new Promise(r => setTimeout(r, ms))

function getConfidenceGrade(prob) {
  if (prob >= 0.65) return 'A+'
  if (prob >= 0.62) return 'A'
  if (prob >= 0.58) return 'B'
  if (prob >= 0.54) return 'C'
  return 'D'
}

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
    console.log('📊 PrizePicks props fetched:', props.length)
    res.json(props)
  } catch {
    res.status(500).json({ error: 'Failed to fetch PrizePicks props' })
  }
})

/* ================= EDGE BUILDER ================= */
async function buildEdges() {
  if (edgesCache.building) return
  edgesCache.building = true

  try {
    const props = await fetchPrizePicksProps()
    const edges = []

    console.log('🔨 Building edges from props:', props.length)

    const statFnMap = {
      player_points: g => g.points,
      player_rebounds: g => g.rebounds,
      player_assists: g => g.assists,
      player_threes: g => g.threes,
      player_points_rebounds_assists: g => g.points + g.rebounds + g.assists,
      player_points_rebounds: g => g.points + g.rebounds,
      player_points_assists: g => g.points + g.assists,
      player_rebounds_assists: g => g.rebounds + g.assists,
      player_fantasy_points: g => g.fantasy
    }

    for (const prop of props.slice(0, 10)) {
      console.log('➡️ PROP:', prop.player, prop.propType, prop.line)

      if (!prop.player || !prop.propType || prop.line == null) {
        console.log('❌ INVALID PROP')
        continue
      }

      const playerId = playerMap[prop.player]
      if (!playerId) {
        console.log('❌ PLAYER NOT FOUND IN MAP:', prop.player)
        continue
      }

      const games = await getPlayerGames(playerId, 10)
      if (!Array.isArray(games) || games.length < 5) {
        console.log('❌ NOT ENOUGH GAMES:', prop.player)
        continue
      }

      const statFn = statFnMap[prop.propType]
      if (typeof statFn !== 'function') {
        console.log('❌ STAT FUNCTION MISSING:', prop.propType)
        continue
      }

      const { hitRate } = calculateHitRate(games, statFn, prop.line)
      console.log('🎯 HIT RATE:', prop.player, hitRate)

      if (!hitRate || hitRate < 0.48) {
        console.log('❌ HIT RATE TOO LOW')
        continue
      }

      const defenseRank =
        prop.opponent && defenseRanks[prop.opponent]?.[prop.propType]
          ? defenseRanks[prop.opponent][prop.propType]
          : 30

      let prob = adjustProbability(hitRate, defenseRank)

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

      console.log('✅ EDGE ADDED:', prop.player)
      await sleep(150)
    }

    edgesCache.data = edges
    edgesCache.timestamp = Date.now()
    global.cachedEdges = edges

    console.log(`✅ Edges built: ${edges.length}`)
  } catch (err) {
    console.error('❌ Edge build failed:', err.message)
  } finally {
    edgesCache.building = false
  }
}

/* ================= EDGE API ================= */
app.get('/api/edges/today', (_, res) => {
  const now = Date.now()

  if (
    edgesCache.data.length &&
    now - edgesCache.timestamp < EDGES_TTL
  ) {
    return res.json(edgesCache.data)
  }

  buildEdges()
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

/* ================= SAFE BACKGROUND REFRESH ================= */
setInterval(() => {
  if (!edgesCache.building) {
    buildEdges()
  }
}, 60 * 60 * 1000)

/* ================= START ================= */
// 🔥 Build edges immediately on boot
buildEdges()

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 BeatsEdge running on port ${PORT}`)
})
