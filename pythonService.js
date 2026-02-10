const { exec } = require('child_process');

function getPlayerGames(playerId, games = 5) {
  return new Promise((resolve, reject) => {
    exec(
      `python nba_stats.py ${playerId} ${games}`,
      (error, stdout, stderr) => {
        if (error) return reject(error);
        if (stderr) return reject(stderr);

        try {
          resolve(JSON.parse(stdout));
        } catch (e) {
          reject('Invalid JSON from Python');
        }
      }
    );
  });
}

module.exports = { getPlayerGames };
