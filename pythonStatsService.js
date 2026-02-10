// pythonStatsService.js
const { exec } = require('child_process');

function fetchNBAGames(playerId, games = 5) {
  return new Promise((resolve, reject) => {
    exec(
      `python nba_stats.py ${playerId} ${games}`,
      (error, stdout, stderr) => {
        if (error) return reject(stderr);
        resolve(JSON.parse(stdout));
      }
    );
  });
}

module.exports = { fetchNBAGames };
