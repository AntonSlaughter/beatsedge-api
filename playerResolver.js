const fs = require('fs')
const path = require('path')
const { execFile } = require('child_process')

const MAP_PATH = path.join(__dirname, 'playerMap.json')

// Load map once
let playerMap = {}
if (fs.existsSync(MAP_PATH)) {
  playerMap = JSON.parse(fs.readFileSync(MAP_PATH, 'utf8'))
}

// Persist map safely
function saveMap() {
  fs.writeFileSync(MAP_PATH, JSON.stringify(playerMap, null, 2))
}

// Resolve player ID using python + nba_api
function resolvePlayerId(playerName) {
  if (playerMap[playerName]) {
    return Promise.resolve(playerMap[playerName])
  }

  return new Promise((resolve) => {
    execFile(
      'python3',
      [path.join(__dirname, 'resolve_player.py'), playerName],
      (err, stdout) => {
        if (err) {
          console.log('❌ RESOLVE FAILED:', playerName)
          return resolve(null)
        }

        const id = stdout.trim()
        if (!id) return resolve(null)

        playerMap[playerName] = id
        saveMap()

        console.log(`🧠 AUTO-MAPPED: ${playerName} → ${id}`)
        resolve(id)
      }
    )
  })
}

module.exports = { resolvePlayerId }
