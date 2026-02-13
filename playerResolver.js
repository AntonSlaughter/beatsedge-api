// playerResolver.js

const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');

const MAP_PATH = path.join(__dirname, 'playerMap.json');

// Load map once
let playerMap = {};
if (fs.existsSync(MAP_PATH)) {
  try {
    playerMap = JSON.parse(fs.readFileSync(MAP_PATH, 'utf8'));
  } catch {
    playerMap = {};
  }
}

function saveMap() {
  fs.writeFileSync(MAP_PATH, JSON.stringify(playerMap, null, 2));
}

/**
 * Resolve NBA player ID.
 * IMPORTANT:
 * - This must NEVER block edge building
 * - Python may be missing in cloud
 * - Failure is NORMAL and SILENT
 */
function resolvePlayerId(playerName) {
  if (playerMap[playerName]) {
    return Promise.resolve(playerMap[playerName]);
  }

  return new Promise((resolve) => {
    execFile(
      'python',
      [path.join(__dirname, 'resolve_player.py'), playerName],
      { timeout: 4000 },
      (err, stdout) => {
        if (err || !stdout) {
          // Silent fail — expected in many environments
          return resolve(null);
        }

        const id = stdout.toString().trim();
        if (!id) return resolve(null);

        playerMap[playerName] = id;
        saveMap();

        console.log(`🧠 AUTO-MAPPED: ${playerName} → ${id}`);
        resolve(id);
      }
    );
  });
}

module.exports = { resolvePlayerId };